/* ===== 角色系统：一个账号多个角色 + 角色名唯一 =====
   存储结构（和云存档同一个 data 字段，不额外建表）：
     { v:3, t, activeId, chars:[ {id,name,charIdx,level,t,p:{...存档字段}} ] }
   · 老存档（v:2 单角色）自动迁移成 chars[0]
   · 角色名唯一性：本机先查自己列表；登录后查云端表 wujinxiake_names
     （表没建也不报错，只是降级为「本机唯一」）
*/
(function(){
'use strict';

/* ===== 角色包存储：按「身份」分命名空间 =====
   修复：以前所有身份共用一把钥匙 wjx_chars_v1，于是「游客试玩」会直接读到
   上一次登录账号留下的角色（一进「侠客之路」就看到自己账号的角色）。
   现在：
     · 已登录 → wjx_chars_v3:<uid>
     · 游客   → wjx_chars_v3:guest
   两者永不相通；老键 wjx_chars_v1 只在「登录态」下被认领一次（登录后有云端
   存档会覆盖，所以不会串号），游客态一律不读。                              */
const LOCAL_KEY  = 'wjx_chars_v3';
const LEGACY_KEY = 'wjx_chars_v1';
const NAME_TABLE = 'wujinxiake_names';
const MAX_CHARS  = 6;

let bundle = { v: 3, t: 0, activeId: '', chars: [] };
let boundKey = '';      /* 当前 bundle 对应的存储键 */
let bootedKey = null;   /* 已经载入过的键，避免重复载入打断当前列表 */

function sb(){ return window.SB || null; }
function logged(){ return !!(window.AUTH && window.AUTH.loggedIn && window.AUTH.uid); }
function $(id){ return document.getElementById(id); }
function toast(t, c){ if(typeof showToast === 'function') showToast(t, c || '#ffcf6e'); }
function newId(){ return 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function norm(n){ return String(n || '').trim(); }
function lower(n){ return norm(n).toLowerCase(); }

/* 当前身份对应的存储键：登录用 uid，游客用独立槽位 */
function keyOf(){
  const uid = (window.AUTH && window.AUTH.loggedIn && window.AUTH.uid) || '';
  return uid ? (LOCAL_KEY + ':' + uid) : (LOCAL_KEY + ':guest');
}

function normalize(d){
  return {
    v: 3, t: Number(d.t) || 0,
    activeId: d.activeId || (d.chars[0] && d.chars[0].id) || '',
    chars: (d.chars || []).map(function(c){
      return {
        id: c.id || newId(), name: c.name || '无名侠客',
        charIdx: c.charIdx | 0, level: c.level | 0 || 1,
        t: Number(c.t) || 0, p: c.p || {}
      };
    })
  };
}

function loadLocal(){
  const key = keyOf();
  bundle = { v: 3, t: 0, activeId: '', chars: [] };
  boundKey = key;
  bootedKey = key;
  let got = false;
  try{
    const s = localStorage.getItem(key);
    if(s){
      const d = JSON.parse(s);
      if(d && d.chars && d.chars.length){ bundle = normalize(d); got = true; }
    }
  }catch(e){}
  if(!got && logged()) migrateLegacy();
  if(!get(bundle.activeId) && bundle.chars.length) bundle.activeId = bundle.chars[0].id;
  return bundle;
}

/* 老键只允许「已登录」认领：老键没有身份信息，认领后立刻删除，
   避免第二个账号登录时又把这批角色复制一遍。 */
function migrateLegacy(){
  try{
    const s = localStorage.getItem(LEGACY_KEY);
    if(!s) return;
    const d = JSON.parse(s);
    if(!d || !d.chars || !d.chars.length){ localStorage.removeItem(LEGACY_KEY); return; }
    bundle = normalize(d);
    persist();
    localStorage.removeItem(LEGACY_KEY);
  }catch(e){}
}

function persist(){
  const k = keyOf();
  boundKey = k;
  try{ localStorage.setItem(k, JSON.stringify(bundle)); }catch(e){}
}

/* 本机是否存在「游客专属角色包」（给云存档判断游客进度归属用） */
function hasGuestBundle(){
  try{ return !!localStorage.getItem(LOCAL_KEY + ':guest'); }catch(e){ return false; }
}

/* ---------- 查询 ---------- */
function all(){
  return bundle.chars.slice().sort(function(a, b){ return (b.t || 0) - (a.t || 0); });
}
function get(id){
  for(let i = 0; i < bundle.chars.length; i++) if(bundle.chars[i].id === id) return bundle.chars[i];
  return null;
}
function active(){
  return get(bundle.activeId) || all()[0] || null;
}
function count(){ return bundle.chars.length; }

function loadBundle(data, useActive){
  if(!data || !data.chars || !data.chars.length) return false;
  /* ★ 只有当前身份能接收这份角色包：防止游客态被云端/本地的账号包覆盖 */
  bundle = normalize(data);
  if(useActive === false) bundle.activeId = (data.chars[0] && data.chars[0].id) || bundle.activeId;
  if(!get(bundle.activeId)) bundle.activeId = bundle.chars[0].id;
  persist();
  return true;
}

/* 把「当前进度快照」写进当前角色，并返回整包（给云存档用） */
function pack(one){
  if(!one) return bundle;
  let c = active();
  if(!c){
    c = { id: newId(), name: (typeof playerName !== 'undefined' && playerName) || one.name || '无名侠客',
          charIdx: one.charIdx | 0, level: 1, t: Date.now(), p: {} };
    bundle.chars.push(c);
    bundle.activeId = c.id;
  }
  c.name = one.name || c.name;
  c.charIdx = (typeof one.charIdx === 'number') ? one.charIdx : c.charIdx;
  c.level = (one.p && one.p.level) | 0 || c.level || 1;
  c.p = one.p || c.p || {};
  c.t = Date.now();
  bundle.t = c.t;
  persist();
  return bundle;
}

/* 当前角色 → 可直接喂给 CloudSave.apply 的单角色存档 */
function activeSave(){
  const c = active();
  if(!c) return null;
  return { v: 2, t: c.t || Date.now(), name: c.name, charIdx: c.charIdx | 0, p: c.p || {} };
}

/* ---------- 名字查重 ---------- */
function localTaken(name){
  const n = lower(name);
  for(let i = 0; i < bundle.chars.length; i++){
    if(lower(bundle.chars[i].name) === n) return true;
  }
  return false;
}

async function remoteTaken(name){
  if(!logged() || !sb()) return false;
  try{
    const res = await sb().from(NAME_TABLE).select('name').eq('name', norm(name)).maybeSingle();
    if(res.error) return false;          /* 表不存在 / 无权限 → 不阻断 */
    return !!res.data;
  }catch(e){ return false; }
}

async function reserveName(name){
  if(!logged() || !sb()) return;
  try{ await sb().from(NAME_TABLE).insert({ name: norm(name), user_id: window.AUTH.uid }); }catch(e){}
}

function checkFormat(name){
  const n = norm(name);
  if(n.length < 2) return '名字至少 2 个字';
  if(n.length > 10) return '名字最多 10 个字';
  if(!/^[\u4e00-\u9fa5A-Za-z0-9_·]+$/.test(n)) return '名字只能用中文、字母、数字';
  return '';
}

/* 创建角色前的完整校验：格式 → 本机重复 → 云端重复 */
async function validate(name, ignoreId){
  const f = checkFormat(name);
  if(f) return f;
  const n = lower(name);
  for(let i = 0; i < bundle.chars.length; i++){
    const c = bundle.chars[i];
    if(c.id !== ignoreId && lower(c.name) === n) return '这个名字你已经用过了，换一个';
  }
  if(await remoteTaken(name)) return '这个名字已经被别人占了，换一个';
  return '';
}

/* ---------- 创建 / 进入 ---------- */
/* 从命名界面创建：snapshot 为当前 G.player 的快照（由 CloudSave 提供） */
async function createFromNaming(name, charIdx, done){
  const nm = norm(name) || '无名侠客';
  if(count() >= MAX_CHARS){ toast('最多创建 ' + MAX_CHARS + ' 个角色', '#ff8f6e'); return; }
  const err = await validate(nm, '');
  if(err){ toast(err, '#ff8f6e'); return; }

  let p = {};
  try{
    if(window.CloudSave && window.CloudSave.snapshotNow){
      const snap = window.CloudSave.snapshotNow();
      if(snap && snap.p) p = snap.p;
    }
  }catch(e){}

  if(typeof p.pills !== 'number') p.pills = 3;   /* ★ 新角色赠送 3 枚重生丸 */
  if(window.MOUNT) MOUNT.ensure(p);             /* ★ 新角色赠送 1 级白阶飞行道具并自动装备 */
  const c = { id: newId(), name: nm, charIdx: charIdx | 0, level: (p.level | 0) || 1, t: Date.now(), p: p };
  bundle.chars.push(c);
  bundle.activeId = c.id;
  bundle.t = c.t;
  persist();
  reserveName(nm);          /* 异步占名，失败也不拦 */
  /* ★ 新建角色＝正式进游戏了，允许写盘 */
  try{ if(window.CloudSave && window.CloudSave.arm) window.CloudSave.arm(); }catch(e){}
  toast('角色「' + nm + '」创建成功', '#7af0c8');
  if(typeof done === 'function') done();
}

function enter(id, done){
  const c = get(id);
  if(!c){ toast('角色不存在', '#ff8f6e'); return; }
  bundle.activeId = c.id;
  persist();
  closePanel();
  /* 在城镇/战斗里切换角色：先回到菜单态，apply 才会生效（会重新进城镇） */
  try{
    if(typeof gameState !== 'undefined' &&
       ['menu', 'charSelect', 'nameInput'].indexOf(gameState) < 0) gameState = 'menu';
  }catch(e){}
  if(window.CloudSave && window.CloudSave.applyData){
    const ok = window.CloudSave.applyData(activeSave());
    if(!ok){ toast('进入失败，请刷新重试', '#ff8f6e'); return; }
    if(typeof done === 'function') done();
  }
}

function remove(id){
  const c = get(id);
  if(!c) return;
  if(!confirm('删除角色「' + c.name + '」？\n\n该角色的等级、装备、金币会一起删除，无法恢复。')) return;
  bundle.chars = bundle.chars.filter(function(x){ return x.id !== id; });
  if(bundle.activeId === id) bundle.activeId = (bundle.chars[0] && bundle.chars[0].id) || '';
  persist();
  /* 释放名字，别人可以再用 */
  if(logged() && sb()){
    try{ sb().from(NAME_TABLE).delete().eq('name', c.name).then(function(){}); }catch(e){}
  }
  try{
    if(window.CloudSave && window.CloudSave.save) window.CloudSave.save();
  }catch(e){}
  renderPanel();
}

/* ---------- 面板 ---------- */
function openPanel(){
  /* ★ 进面板前先把身份对齐：游客态绝不展示账号角色 */
  if(bootedKey !== keyOf()) loadLocal();
  renderPanel();
  const h = document.querySelector('#charPanel .cp-head b');
  if(h) h.textContent = logged() ? '选择角色' : '选择角色 · 游客';
  const p = $('charPanel'); if(p) p.classList.add('open');
}
function closePanel(){ const p = $('charPanel'); if(p) p.classList.remove('open'); }

function jobName(idx){
  try{
    if(typeof CHARACTERS !== 'undefined' && CHARACTERS[idx]) return CHARACTERS[idx].name || ('门派' + (idx + 1));
  }catch(e){}
  return '门派' + ((idx | 0) + 1);
}

function renderPanel(){
  const box = $('cpList');
  if(!box) return;
  const list = all();
  if(!list.length){
    box.innerHTML = '<div class="cp-empty">' + (logged()
      ? '还没有角色，点下面「创建新角色」开始'
      : '游客模式还没有角色。<br>这里的角色只存在这台设备上；注册账号后才会变成你名下的专属角色。') + '</div>';
    return;
  }
  box.innerHTML = list.map(function(c){
    const cur = c.id === bundle.activeId;
    return '<div class="cp-item' + (cur ? ' cur' : '') + '" data-id="' + c.id + '">' +
      '<div class="cp-main"><b>' + escapeHtml(c.name) + '</b>' +
      '<em>' + jobName(c.charIdx) + ' · Lv.' + (c.level || 1) + '</em></div>' +
      '<button class="cp-go" data-go="' + c.id + '" type="button">进入</button>' +
      '<button class="cp-del" data-del="' + c.id + '" type="button">删除</button>' +
      '</div>';
  }).join('');
}

function escapeHtml(s){
  return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){
    return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c];
  });
}

function bindPanel(){
  const p = $('charPanel');
  if(!p) return;
  p.addEventListener('click', function(e){
    const t = e.target;
    if(!t) return;
    if(t.id === 'charPanel' || t.id === 'cpClose'){ closePanel(); return; }
    if(t.id === 'cpNew'){ closePanel(); startCreate(); return; }
    if(t.dataset && t.dataset.go){ enter(t.dataset.go); return; }
    if(t.dataset && t.dataset.del){ remove(t.dataset.del); return; }
  });
}

/* 进入职业选择（创建新角色） */
function startCreate(){
  if(count() >= MAX_CHARS){ toast('最多创建 ' + MAX_CHARS + ' 个角色', '#ff8f6e'); return; }
  if(typeof charSelectState !== 'undefined'){
    charSelectState.phase = 'single';
    charSelectState.step = 0;
    charSelectState.selections = [0, 0];
  }
  if(typeof gameState !== 'undefined') gameState = 'charSelect';
}

/* ---------- 启动 ---------- */
/* 身份（账号 / 游客）由 00_auth.js 决定，而且是异步的：
   登录成功派发 wjx:auth，真正进入游戏派发 wjx:enter。
   所以这里不在脚本加载时就读角色包，等身份落定再读 —— 否则会先读到
   上一个身份的包，「游客试玩」就会看到自己账号的角色。 */
function rebind(){
  if(bootedKey === keyOf()) return;
  loadLocal();
  try{ window.dispatchEvent(new CustomEvent('wjx:chars', { detail: { key: boundKey, n: bundle.chars.length } })); }catch(e){}
}

function boot(){
  bindPanel();
  window.addEventListener('wjx:auth', rebind);
  window.addEventListener('wjx:enter', function(){ if(bootedKey !== keyOf()) rebind(); });
  /* 兜底：auth 脚本异常 / 离线时也别让角色系统一直空着 */
  setTimeout(function(){ if(bootedKey === null) rebind(); }, 3000);
}

window.CHARS = {
  all: all, get: get, active: active, count: count,
  bundle: function(){ return bundle; },
  key: function(){ return boundKey; },
  hasGuestBundle: hasGuestBundle,
  loadBundle: loadBundle, pack: pack, activeSave: activeSave,
  validate: validate, createFromNaming: createFromNaming,
  enter: enter, remove: remove,
  openPanel: openPanel, closePanel: closePanel, renderPanel: renderPanel,
  startCreate: startCreate, rebind: rebind
};

if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();

})();
