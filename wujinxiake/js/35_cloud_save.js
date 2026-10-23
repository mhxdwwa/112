/* ===== 云存档 =====
   本地 localStorage 永远写一份（离线也能玩），登录后再同步到 Supabase。
   进游戏时比对本地/云端时间戳，谁新用谁。
   依赖表 wujinxiake_saves（SQL 见 sql/wujinxiake_saves.sql）。
   表没建好时自动降级为「仅本机存档」，不报错、不卡流程。
*/
(function(){
'use strict';

const KEY      = 'wjx_save_v1';
const TABLE    = 'wujinxiake_saves';
const SAVE_EVERY = 20000;   /* 自动保存间隔 */
const DEBOUNCE   = 2500;    /* 操作后延迟落盘 */

/* 需要持久化的玩家字段（其余是运行时状态，不进存档） */
const PERSIST = [
  'weaponIdx', 'level', 'exp',
  'skillPoints', 'skillLevels', 'skillsUnlocked',
  'equipment', 'inventory', 'gold', 'materials', 'amplifyStones',
  'props', 'propBonuses', 'clearedLevels',
  'potions', 'potionCd',
  'hp', 'mp', 'pills',
  /* ★ 任务进度也要存：不然每次读档都退回「序章·余烬」，第一个任务永远做不完 */
  'quest', 'prologueSeen', 'questKills'
];

let uid = '', uname = '';
let cloudState = 'idle';     /* idle | ok | unavailable | error */
let lastPushAt = 0, lastStr = '', pushing = false, timer = null, warned = false;
let lastSaveAt = 0;          /* 最近一次落盘时间（账号面板展示用） */
/* ★ 存档闸门：只有「真正进入了某个角色」之后才允许写盘。
      登录后先停在「选择角色」界面，此时 G.player 还是空的，
      若这时被自动保存/关页面触发落盘，会把当前角色的进度覆盖成空档。 */
let armed = false;

/* ---------- ★ 固定出生点：所有角色都从「引灯亭」旁进城 ---------- */
function fixedSpawn(){
  try{
    const def = (typeof TOWN_DEFS_BY_KEY !== 'undefined' && TOWN_DEFS_BY_KEY.center) || TOWN_DEFS[0];
    const npc = (def.npcs || []).filter(function(n){ return n.id === 'questmaster'; })[0];
    const ox = def.ox | 0, oy = def.oy | 0;
    if(npc) return { x: ox + npc.x, y: oy + npc.y + 80, townKey: def.key };
    return { x: def.spawn.x, y: def.spawn.y, townKey: def.key };
  }catch(e){
    return { x: 4740, y: 2860, townKey: 'center' };
  }
}
window.WJX_FIXED_SPAWN = fixedSpawn;

function sb(){ return window.SB || null; }
function logged(){ return !!(window.AUTH && window.AUTH.loggedIn && window.AUTH.uid); }

/* 取当前进度快照 */
function snapshot(){
  if(typeof G === 'undefined' || !G || !G.player) return null;
  const p = G.player;
  let nm = G.playerName || '';
  if(!nm && typeof playerName !== 'undefined') nm = playerName;
  /* 注意：charIdx 是「角色位」不是武器索引，两者在 CHARACTERS 里并不相同 */
  const ci = (typeof G.selectedChar === 'number') ? G.selectedChar : (p.weaponIdx | 0);
  const out = { v: 2, t: Date.now(), name: nm, charIdx: ci, p: {} };
  for(let i = 0; i < PERSIST.length; i++){
    const k = PERSIST[i];
    if(p[k] !== undefined && p[k] !== null) out.p[k] = p[k];
  }
  return out;
}

/* 把快照写回游戏（只在菜单/选角阶段调用，避免打断战斗） */
function apply(data){
  if(!data) return false;
  /* 多角色整包：先载入角色列表，再取当前角色那份进度 */
  if(data.chars && data.chars.length && window.CHARS && window.CHARS.loadBundle){
    window.CHARS.loadBundle(data, true);
    data = window.CHARS.activeSave();
  }
  if(!data || !data.p) return false;
  if(typeof startSingleWithChar !== 'function') return false;
  if(typeof gameState !== 'undefined' &&
     gameState !== 'menu' && gameState !== 'charSelect' && gameState !== 'nameInput') return false;

  const chars = (typeof CHARACTERS !== 'undefined' && CHARACTERS.length) ? CHARACTERS.length : 8;
  let idx = 0;
  if(typeof data.charIdx === 'number'){
    idx = data.charIdx;
  } else if(data.p && typeof data.p.weaponIdx === 'number' && typeof CHARACTERS !== 'undefined'){
    /* 兼容老存档：那时候存的是武器索引，找回对应角色位 */
    for(let i = 0; i < CHARACTERS.length; i++){
      if(CHARACTERS[i].weaponIdx === data.p.weaponIdx){ idx = i; break; }
    }
  }
  idx = Math.max(0, Math.min(chars - 1, idx | 0));
  startSingleWithChar(idx);

  G.playerName = data.name || '无名侠客';
  try{ if(typeof playerName !== 'undefined') playerName = G.playerName; }catch(e){}

  for(let i = 0; i < PERSIST.length; i++){
    const k = PERSIST[i];
    if(data.p[k] !== undefined) G.player[k] = data.p[k];
  }
  /* ★ 老存档迁移：已学技能但未解锁的，自动解锁 */
  if(G.player.skillLevels && G.player.skillsUnlocked){
    for(let i = 0; i < G.player.skillLevels.length; i++){
      if(G.player.skillLevels[i] > 0 && !G.player.skillsUnlocked[i]){
        G.player.skillsUnlocked[i] = true;
      }
    }
  }
  /* ★ 老存档迁移：补发遗漏的技能点
     根据角色等级计算应获得的SP总量，与实际持有+已投入对比，差额补发 */
  try{
    const pLv = G.player.level || 1;
    const expectedTotal = SP_START + (pLv - 1) * SP_PER_LEVEL;
    let actualSpent = 0;
    const w = (typeof WEAPONS !== 'undefined') ? WEAPONS[G.player.weaponIdx] : null;
    if(w && w.skills && G.player.skillLevels){
      for(let i = 0; i < w.skills.length; i++){
        const lv = G.player.skillLevels[i] || 0;
        if(lv > 0 && typeof skillSpent === 'function') actualSpent += skillSpent(w.skills[i], lv);
      }
    }
    const actualTotal = (G.player.skillPoints || 0) + actualSpent;
    if(actualTotal < expectedTotal){
      const missing = expectedTotal - actualTotal;
      G.player.skillPoints = (G.player.skillPoints || 0) + missing;
    }
  }catch(e){ console.warn('[save] SP迁移计算失败', e); }
  /* 有存档 = 序章早就看过了：别重播，也顺便让「听完留音」这一步判定通过 */
  if(!G.player.prologueSeen) G.player.prologueSeen = true;
  /* ★ 老存档：没有重生丸字段的补发 3 枚（用光了会是 0，不会被重置） */
  if(typeof G.player.pills !== 'number') G.player.pills = 3;
  /* ★ 老存档：没飞行道具的补一块 1 级白板（踩上就不再用跑动动画） */
  if(window.MOUNT) MOUNT.ensure(G.player);
  /* ★ 老存档：属性丹已删除，永久加成清零、旧丹药清空，改为回血/回蓝瓶 */
  G.player.propBonuses = { atk:0, hp:0, mp:0, cdReduce:0, crit:0 };
  G.player.props = {};
  if(!G.player.potions) G.player.potions = {};
  if(!G.player.potionCd) G.player.potionCd = { hp:0, mp:0 };
  /* ★ 老存档迁移：更新装备品阶颜色（史诗改金色，传说改红色） */
  try{
    const updateEquipColor = function(eq){
      if(!eq || !eq.tier) return;
      const tier = (typeof EQUIP_TIERS !== 'undefined') ? EQUIP_TIERS.find(function(t){ return t.id === eq.tier; }) : null;
      if(tier){
        eq.tierColor = tier.color;
      }
    };
    /* 更新穿戴装备 */
    if(G.player.equipment){
      for(const slot in G.player.equipment){
        updateEquipColor(G.player.equipment[slot]);
      }
    }
    /* 更新背包装备 */
    if(G.player.inventory && Array.isArray(G.player.inventory)){
      for(let i = 0; i < G.player.inventory.length; i++){
        updateEquipColor(G.player.inventory[i]);
      }
    }
  }catch(e){ console.warn('[save] 装备颜色迁移失败', e); }

  /* ★ 老存档迁移：按新公式重新计算基础属性（HP/MP/ATK成长优化） */
  try{
    if(typeof ensureBaseStat === 'function') ensureBaseStat(G.player);
    const bs = G.player.baseStat;
    if(bs && typeof getLevelGrowth === 'function'){
      /* 找到角色初始值 */
      const pLv = G.player.level || 1;
      const char = (typeof CHARACTERS !== 'undefined') ? CHARACTERS.find(function(c){ return c.id === G.player.charId; }) : null;
      const startHp = char ? char.hp : 5000;
      const startMp = char ? char.mp : 80;
      const startAtk = char ? char.atk : 10;
      /* 重新从1级累加成长 */
      let totalHp = startHp, totalMp = startMp;
      for(let lv = 2; lv <= pLv; lv++){
        const g = getLevelGrowth(lv);
        totalHp += g.hp;
        totalMp += g.mp;
      }
      bs.maxHp = totalHp;
      bs.maxMp = totalMp;
      /* ATK: 初始值 × 1.08^(level-1)（沿用升级时的倍率逻辑） */
      bs.atk = Math.round(startAtk * Math.pow(1.08, pLv - 1));
    }
    if(typeof recalcPlayerStats === 'function') recalcPlayerStats();
  }catch(e){ console.warn('[save] 属性重算失败', e); }

  const hp = Number(data.p.hp), mp = Number(data.p.mp);
  G.player.hp = Math.min(G.player.maxHp, Math.max(1, isFinite(hp) && hp > 0 ? hp : G.player.maxHp));
  G.player.mp = Math.min(G.player.maxMp, Math.max(0, isFinite(mp) ? mp : G.player.maxMp));
  /* ★ 进入城镇时恢复满血满蓝 */
  G.player.hp = G.player.maxHp;
  G.player.mp = G.player.maxMp;

  try{
    if(typeof initTown === 'function') initTown();
    gameState = 'town';
    /* ★ 已有角色不需要命名，关闭命名输入框 */
    if(typeof nameInputActive !== 'undefined') nameInputActive = false;
    if(typeof startBGM === 'function') startBGM();
    /* ★ 加载存档后刷新技能栏UI */
    if(typeof refreshSkillLockUI === 'function') refreshSkillLockUI();
  }catch(e){ console.warn('[save] 进入城镇失败', e); }
  armed = true;      /* ★ 已经真正进角色了，之后才允许写盘 */
  return true;
}

/* ---------- 本地 ---------- */
/* 每个账号一份本机存档：wjx_save_v1:<uid>；游客仍用 wjx_save_v1。
   同一台电脑/手机换账号时，不会把上一个人的进度带过去。 */
function acctId(){ return uid || (window.AUTH && window.AUTH.uid) || ''; }
function keyOf(){ const id = acctId(); return id ? KEY + ':' + id : KEY; }
function saveLocal(data){
  try{
    localStorage.setItem(keyOf(), JSON.stringify(data));
    /* 游客每次落盘都刷新时间戳：之后注册时凭它把这份进度认领过去 */
    if(!acctId()) localStorage.setItem('wjx_guest_at', String(Date.now()));
    return true;
  }
  catch(e){ console.warn('[save] 本地写入失败', e); return false; }
}
function loadLocal(){
  try{
    const s = localStorage.getItem(keyOf());
    if(!s) return null;
    const d = JSON.parse(s);
    return (d && (d.p || (d.chars && d.chars.length))) ? d : null;
  }catch(e){ return null; }
}
/* 游客存档迁移：登录后第一次没找到账号自己的存档时，用游客那份兜底，
   这样「先试玩、再注册」的进度不会丢。
   只认最近 6 小时内确实点过「游客试玩」的那份，避免同一台机器上
   别的同学很久以前留下的游客进度被新账号继承。 */
function guestFresh(){
  try{
    const t = Number(localStorage.getItem('wjx_guest_at') || 0);
    return !!t && (Date.now() - t) < 6 * 3600 * 1000;
  }catch(e){ return false; }
}
function loadGuest(){
  try{
    if(!uid || !guestFresh()) return null;
    const s = localStorage.getItem(KEY);
    if(!s) return null;
    const d = JSON.parse(s);
    return (d && (d.p || (d.chars && d.chars.length))) ? d : null;
  }catch(e){ return null; }
}

/* ---------- 云端 ---------- */
async function pullCloud(){
  if(!logged() || !sb()) return null;
  try{
    const res = await sb().from(TABLE).select('data,updated_at').eq('user_id', uid).maybeSingle();
    if(res.error){
      const code = String(res.error.code || '');
      if(code === '42P01' || code === 'PGRST205'){ cloudState = 'unavailable'; }
      else { cloudState = 'error'; console.warn('[save] 拉取失败', res.error); }
      return null;
    }
    cloudState = 'ok';
    const d = res.data && res.data.data;
    return (d && (d.p || (d.chars && d.chars.length))) ? d : null;
  }catch(e){
    cloudState = 'error';
    return null;
  }
}

async function pushCloud(data){
  if(!logged() || !sb()) return false;
  try{
    const res = await sb().from(TABLE).upsert(
      { user_id: uid, data: data, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    );
    if(res.error){
      const code = String(res.error.code || '');
      if(code === '42P01' || code === 'PGRST205'){
        cloudState = 'unavailable';
        if(!warned){
          warned = true;
          console.warn('[save] 云存档表不存在，已降级为本地存档');
        }
      } else {
        cloudState = 'error';
        console.warn('[save] 云端保存失败', res.error);
      }
      return false;
    }
    cloudState = 'ok';
    return true;
  }catch(e){
    cloudState = 'error';
    return false;
  }
}

/* ---------- 保存入口 ---------- */
/* 存档打包：单角色进度写进当前角色，再把整个角色列表一起存 */
function payload(){
  const one = snapshot();
  if(!one) return null;
  if(window.CHARS && window.CHARS.pack) return window.CHARS.pack(one);
  return one;
}

function saveNow(force){
  /* ★ 还没进角色就别写盘，避免把角色数据冲掉 */
  if(!armed) return;
  const data = payload();
  if(!data) return;
  const str = JSON.stringify(data);
  if(str === lastStr && !force) return;
  lastStr = str;
  saveLocal(data);
  lastPushAt = Date.now();
  lastSaveAt = lastPushAt;

  if(!logged() || cloudState === 'unavailable') return;
  if(pushing) return;
  pushing = true;
  pushCloud(data).finally(function(){ pushing = false; });
}

function queueSave(){
  if(timer) clearTimeout(timer);
  timer = setTimeout(function(){ timer = null; saveNow(); }, DEBOUNCE);
}

/* ---------- 启动：比对本地 / 云端 ---------- */
async function boot(){
  if(!logged()){ return; }
  uid = window.AUTH.uid;
  uname = window.AUTH.username;

  const ownLocal = loadLocal();
  const guestLocal = ownLocal ? null : loadGuest();
  const local = ownLocal || guestLocal;
  const cloud = await pullCloud();

  /* ?new=1 忽略存档，重新开局 */
  const url = String(location.search || '');
  if(url.indexOf('new=1') >= 0){ return; }

  let pick = null;
  if(cloud && local) pick = (Number(cloud.t) || 0) >= (Number(local.t) || 0) ? cloud : local;
  else pick = cloud || local;
  if(!pick) return;

  /* 云端比本地新很多 → 采用云端 */
  if(cloud && local && Number(cloud.t) > Number(local.t) + 3000) pick = cloud;

  /* ★ 登录后不直接站到大街上：先把角色列表载入，弹出「选择角色」 */
  if(window.CHARS && window.CHARS.loadBundle){
    let bundle = pick;
    /* 老存档（单角色 v2）→ 转成多角色整包 */
    if(!(bundle.chars && bundle.chars.length)){
      bundle = {
        v: 3, t: Number(pick.t) || Date.now(), activeId: 'c_mig',
        chars: [{
          id: 'c_mig', name: pick.name || '无名侠客',
          charIdx: (typeof pick.charIdx === 'number' ? pick.charIdx : 0) | 0,
          level: (pick.p && pick.p.level) | 0 || 1,
          t: Number(pick.t) || Date.now(), p: pick.p || {}
        }]
      };
    }
    window.CHARS.loadBundle(bundle, true);
    lastStr = JSON.stringify(bundle);
    /* 游客进度已经并入账号，标记作废，避免下次又拿它兜底 */
    if(pick === guestLocal){ try{ localStorage.removeItem('wjx_guest_at'); }catch(e){} }
    setTimeout(function(){
      try{
        if(window.CHARS.count() > 0){ window.CHARS.openPanel(); }
        else { window.CHARS.startCreate(); }
      }catch(e){}
      if(typeof showToast === 'function'){
        showToast('欢迎回来，共 ' + window.CHARS.count() + ' 个角色 · 选一个进入江湖', '#7af0c8');
      }
    }, 420);
    return;
  }

  /* 兜底：没有角色系统时按老逻辑直接进 */
  if(apply(pick)){
    lastStr = JSON.stringify(pick);
    /* 游客进度已经并入账号，标记作废，避免下次又拿它兜底 */
    if(pick === guestLocal){ try{ localStorage.removeItem('wjx_guest_at'); }catch(e){} }
    setTimeout(function(){
      var who = (window.CHARS && window.CHARS.active && window.CHARS.active()) || pick;
      var lv = (who && who.level) || (pick.p && pick.p.level) || 1;
      if(typeof showToast === 'function') showToast('已读取角色：' + ((who && who.name) || pick.name || '无名侠客') + '  Lv.' + lv, '#7af0c8');
    }, 700);
  }
}

/* ---------- 事件 ---------- */
window.addEventListener('wjx:enter', function(){ setTimeout(boot, 260); });

window.addEventListener('load', function(){
  /* 定时自动保存 */
  setInterval(function(){
    if(typeof gameState === 'undefined') return;
    if(gameState === 'town' || gameState === 'playing' || gameState === 'shopMenu' ||
       gameState === 'inventory' || gameState === 'skillMenu' || gameState === 'enhanceMenu'){
      saveNow();
    }
  }, SAVE_EVERY);

  /* 切后台 / 关页面立即存 */
  document.addEventListener('visibilitychange', function(){ if(document.hidden) saveNow(true); });
  window.addEventListener('pagehide', function(){ saveNow(true); });
  window.addEventListener('beforeunload', function(){ saveNow(true); });
});

/* ---------- 对外接口 ---------- */
window.CloudSave = {
  save: function(){ saveNow(true); },
  queue: queueSave,
  load: function(){ return loadLocal(); },
  /* ★ 允许写盘（进入角色 / 新建角色后调用） */
  arm: function(){ armed = true; },
  isArmed: function(){ return armed; },
  fixedSpawn: fixedSpawn,
  snapshotNow: function(){ return snapshot(); },
  applyData: function(d){ return apply(d); },
  applyBundle: function(b){ return apply(b); },
  status: function(){ return { cloud: cloudState, logged: logged(), user: uname, last: lastSaveAt }; },
  reset: function(){
    try{ localStorage.removeItem(keyOf()); }catch(e){}
    if(logged() && sb()) sb().from(TABLE).delete().eq('user_id', uid).then(function(){});
    location.href = location.pathname + '?new=1';
  }
};

})();
