/* ===== 联机：世界频道 / 房间 / 城镇同屏 / 聊天 =====
   Supabase Realtime 的 Presence + Broadcast，不依赖数据库表。
   只用一个频道 wjx:world：大厅在线名单和房间同步共用，join 一次就够
   （Realtime 每个 socket 的 join 是串行的，两个频道会互相排队）。
   · presence 里的 room 字段决定「和谁同屏」
   · 位置广播带 room，收到后过滤，只有同房间的人会显示出来
*/
(function(){
'use strict';

const CHANNEL_NAME = 'wjx:world';
/* 不进房间时，所有在城镇的人共用这个公共频道 —— 这就是「同一频道看到多人」 */
const LOBBY = 'LOBBY';
function myRoom(){ return roomCode || LOBBY; }
const SEND_MS  = 300;      /* 位置广播间隔（有移动时）。原 110ms → 300ms，省 ~2.7 倍消息，远端靠插值保持顺滑 */
const IDLE_MS  = 4000;     /* 原地不动时的保活广播（原来不动也在 9 次/秒地发，极耗额度） */
const DROP_MS  = 9000;     /* 这么久没消息就当掉线 */

let uid = '', myName = '', myLv = 1, myJob = 0;
let ch = null, joined = false, roomCode = '', pendingRoom = '';
let sendTimer = null, lastTrack = 0;
let lastPosSig = '', lastPosAt = 0;   /* 位置去重 + 保活时间戳 */
const remotes = new Map();

function sb(){ return window.SB || null; }
function logged(){ return !!(window.AUTH && window.AUTH.loggedIn); }
function $(id){ return document.getElementById(id); }
function setText(id, t){ const el = $(id); if(el) el.textContent = t; }
function esc(s){
  return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){
    return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c];
  });
}

/* ---------- 身份 ---------- */
function initIdentity(){
  if(logged()){
    uid = window.AUTH.uid;
    myName = window.AUTH.username || '侠客';
  } else {
    let gid = '';
    try{ gid = localStorage.getItem('wjx_guest_id') || ''; }catch(e){}
    if(!gid){
      gid = 'g' + Math.random().toString(36).slice(2, 10);
      try{ localStorage.setItem('wjx_guest_id', gid); }catch(e){}
    }
    uid = gid;
    myName = '游客' + gid.slice(1, 5);
  }
}

/* ---------- 面板 ---------- */
function panel(open){
  const p = $('onlinePanel');
  if(!p) return;
  p.classList.toggle('open', !!open);
  const btn = $('btnOnline');
  if(btn) btn.classList.toggle('on', !!open);
}

function chatLine(who, text, sys){
  const box = $('opChat');
  if(!box) return;
  const d = document.createElement('div');
  d.className = 'op-line' + (sys ? ' sys' : '');
  d.innerHTML = sys ? esc(text) : '<b>' + esc(who) + '</b>：' + esc(text);
  box.appendChild(d);
  while(box.childElementCount > 60) box.removeChild(box.firstChild);
  box.scrollTop = box.scrollHeight;
}

/* ---------- 连接 ---------- */
function connect(){
  if(!sb() || ch) return;
  ch = sb().channel(CHANNEL_NAME, {
    config: { presence: { key: uid }, broadcast: { self: false } }
  });

  /* ★ Supabase 只作为「中继连不上时的保底通道」；中继正常时这些广播直接忽略，
       避免同一条消息被处理两次 */
  ch.on('broadcast', { event: 'pos' },  function(m){ if(relayOk()) return; onPos(m.payload); });
  ch.on('broadcast', { event: 'chat' }, function(m){ if(relayOk()) return; onChat(m.payload); });
  ch.on('broadcast', { event: 'pkinv' }, function(m){ if(relayOk()) return; handlePkInvite(m.payload); });
  ch.on('broadcast', { event: 'pkrsp' }, function(m){ if(relayOk()) return; handlePkResp(m.payload); });
  ch.on('broadcast', { event: 'pkinfo' }, function(m){ if(relayOk()) return; handlePkInfo(m.payload); });
  ch.on('broadcast', { event: 'pkinfo_d' }, function(m){ if(relayOk()) return; handlePkInfoD(m.payload); });
  ch.on('broadcast', { event: 'bye' },  function(m){
    const p = m.payload || {};
    if(p.id) remotes.delete(p.id);
  });
  ch.on('presence', { event: 'sync' }, function(){
    renderPlayers(); renderMembers();
    /* 有人进来：立刻补发一次位置，否则站立不动的玩家对方看不见 */
    if(othersOnline()){ lastPosSig = ''; try{ sendPos(); }catch(e){} }
  });

  setText('opState', '连接中…');
  ch.subscribe(function(status, err){
    if(status === 'SUBSCRIBED'){
      joined = true;
      setText('opState', '在线');
      track();
      startSend();
      renderPlayers(); renderMembers();
      /* 连上之前就点了「创建/加入」的，这里补上 */
      if(pendingRoom){
        const c = pendingRoom;
        pendingRoom = '';
        joinRoom(c);
      }
    } else if(status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED'){
      joined = false;
      setText('opState', status === 'CLOSED' ? '已断开' : '连接失败');
      window.__wjxOnlineErr = status + ' :: ' + String((err && (err.message || err.reason)) || err || '');
      console.warn('[online]', status, err);
      /* 断线自动重连（30 秒一次，不打扰玩家） */
      if(status !== 'CLOSED'){
        setTimeout(function(){
          if(ch){ try{ sb().removeChannel(ch); }catch(e){} ch = null; }
          connect();
        }, 30000);
      }
    }
  }, 25000);
}

function track(){
  if(!ch || !joined) return;
  lastTrack = Date.now();
  try{
    ch.track({ uid: uid, name: myName, lv: myLv, job: myJob, room: myRoom(), at: lastTrack });
  }catch(e){}
}

function othersOnline(){
  try{ return presenceList().filter(function(p){ return p.uid !== uid; }).length > 0; }catch(e){ return true; }
}

function presenceList(){
  const out = [];
  if(!ch) return out;
  const st = ch.presenceState ? ch.presenceState() : {};
  Object.keys(st || {}).forEach(function(k){
    const arr = st[k] || [];
    const m = arr.length ? arr[arr.length - 1] : null;
    if(m && m.uid) out.push(m);
  });
  return out;
}

function renderPlayers(){
  const list = presenceList();
  setText('opCount', String(list.length || 0));
  const box = $('opPlayers');
  if(!box) return;
  if(!list.length){ box.innerHTML = '<div class="op-empty">还没有人，等你来</div>'; return; }
  box.innerHTML = list.map(function(p){
    const isMe = p.uid === uid;
    const cls = 'op-player' + (isMe ? ' me' : '') + (p.room ? ' inroom' : '');
    const tag = (p.room && p.room !== LOBBY) ? '<i>房 ' + esc(p.room) + '</i>' : '';
    return '<div class="' + cls + '"><span>' + esc(p.name || '侠客') + '</span>' +
           '<em>Lv.' + (p.lv || 1) + '</em>' + tag + '</div>';
  }).join('');
}

function renderMembers(){
  const list = presenceList().filter(function(p){ return roomCode && p.room === roomCode; });
  const box = $('opMembers');
  if(!box) return;
  if(!roomCode){ box.innerHTML = ''; return; }
  if(!list.length){ box.innerHTML = '<div class="op-empty">房间里只有你</div>'; return; }
  box.innerHTML = list.map(function(p){
    return '<span class="op-chip' + (p.uid === uid ? ' me' : '') + '">' +
           esc(p.name || '侠客') + ' <em>Lv.' + (p.lv || 1) + '</em></span>';
  }).join('');
}

/* ---------- 房间 ---------- */
function randCode(){
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for(let i = 0; i < 4; i++) s += abc[Math.floor(Math.random() * abc.length)];
  return s;
}

/* ★ 单频道：全服只有一个公共频道，所有人都在里面，不再分房间 */
function joinRoom(code){
  chatLine('', '现在所有玩家都在同一个公共频道，不用房间码，进城镇就能互相看见。', true);
  if(roomCode) leaveRoom(true);
}
function createRoom(){
  chatLine('', '公共频道只有一个，全服玩家自动同频道。', true);
}

function leaveRoom(silent){
  const was = roomCode;
  roomCode = '';
  remotes.clear();
  const r = $('opRoom'); if(r) r.classList.add('hidden');
  setText('opRoomCode', '');
  const m = $('opMembers'); if(m) m.innerHTML = '';
  if(was){
    track();
    if(!silent) chatLine('', '已离开房间', true);
  }
}

/* ---------- 传输层：优先走 Cloudflare 中继，失败退回 Supabase ---------- */
function relayOk(){
  try{ return !!(window.RELAY && window.RELAY.ok); }catch(e){ return false; }
}

/* 统一出口：先试中继，再试 Supabase；两者都不通返回 false */
function rtSend(event, payload){
  try{
    if(window.RELAY && window.RELAY.ok && window.RELAY.send) return !!window.RELAY.send({ e: event, p: payload });
  }catch(e){}
  if(ch && joined){
    try{ ch.send({ type:'broadcast', event: event, payload: payload }); return true; }catch(e){}
  }
  return false;
}

/* 中继收到别人消息 → 交给同一批业务处理器 */
function wireRelay(){
  if(!window.RELAY || wireRelay.done) return;
  wireRelay.done = true;
  RELAY.on('pos',      function(p){ onPos(p); });
  RELAY.on('chat',     function(p){ onChat(p); });
  RELAY.on('pkinv',    function(p){ handlePkInvite(p); });
  RELAY.on('pkrsp',    function(p){ handlePkResp(p); });
  RELAY.on('pkinfo',   function(p){ handlePkInfo(p); });
  RELAY.on('pkinfo_d', function(p){ handlePkInfoD(p); });
  /* 中继刚连上时补发一次位置，免得别人看不到站着的你 */
  if(othersOnline()){ lastPosSig = ''; try{ sendPos(); }catch(e){} }
}

/* ---------- 切磋 / 资料卡 消息处理（两条通道共用） ---------- */
function handlePkInvite(p){
  p = p || {};
  if(!p.id || p.id === uid) return;
  if(p.to && p.to !== uid) return;
  const yes = confirm((p.n || '有人') + ' 邀请你切磋一场，接受吗？\n\n接受后立刻进入战斗，你已经学会的技能都能用。');
  rtSend('pkrsp', { id: uid, n: myName, to: p.id, ok: !!yes, cid: myCharIdx() });
  if(yes) startSpar(p.cid | 0);
  else chatLine('', '你拒绝了 ' + (p.n || '对方') + ' 的切磋邀请', true);
}
function handlePkResp(p){
  p = p || {};
  if(p.to !== uid) return;
  if(p.ok){ chatLine('', (p.n || '对方') + ' 接受了切磋，开始！', true); startSpar(p.cid | 0); }
  else chatLine('', (p.n || '对方') + ' 拒绝了切磋邀请', true);
}
function handlePkInfo(p){
  p = p || {};
  if(!p.id || p.to !== uid) return;
  rtSend('pkinfo_d', { id: uid, to: p.id, d: myProfile() });
}
function handlePkInfoD(p){
  p = p || {};
  if(!p.d || p.to !== uid) return;
  if(cardTarget && p.id !== cardTarget) return;
  renderCardProfile(p.d);
}

/* ---------- 位置同步 ---------- */
function startSend(){
  if(sendTimer) return;
  sendTimer = setInterval(sendPos, SEND_MS);
}

function inPlayableState(){
  if(typeof gameState === 'undefined') return false;
  return gameState === 'town' || gameState === 'playing' || gameState === 'shopMenu' ||
         gameState === 'inventory' || gameState === 'skillMenu' || gameState === 'enhanceMenu' ||
         gameState === 'characterInfo' || gameState === 'gameMenu' || gameState === 'questMenu';
}

/* 只在「城镇」广播位置：副本/菜单里根本看不到其他玩家，发了纯是浪费额度 */
function sendPos(){
  if(!ch || !joined) return;
  if(typeof gameState === 'undefined' || gameState !== 'town') return;
  const p = (typeof townPlayer !== 'undefined' && townPlayer) ? townPlayer
          : (typeof G !== 'undefined' && G && G.player ? G.player : null);
  if(!p) return;

  if(typeof G !== 'undefined' && G && G.player){
    myJob = G.player.weaponIdx | 0;
    myLv = G.player.level | 0;
  }
  /* ★ 省额度：内容没变就别发；只有自己一个人在线时也不发（没人需要接收） */
  const _sig = [Math.round(p.x / 4), Math.round(p.y / 4), p.facing >= 0 ? 1 : -1,
                (p.state === 'walk' || p.state === 'run') ? 'w' : 'i'].join(',');
  const _now = Date.now();
  if(_sig !== lastPosSig){
    lastPosSig = _sig;
    lastPosAt = _now;
  } else {
    if(_now - lastPosAt < IDLE_MS) return;      /* 没动 → 除非到保活时间，否则不广播 */
    if(!othersOnline()) return;                 /* 频道里只有我 → 发了也没人收 */
    lastPosAt = _now;
  }

  rtSend('pos', {
    id: uid, n: myName, lv: myLv, w: myJob, r: myRoom(),
    x: Math.round(p.x), y: Math.round(p.y),
    f: p.facing >= 0 ? 1 : -1,
    s: (p.state === 'walk' || p.state === 'run') ? 'w' : 'i',
    mt: (window.MOUNT && typeof G !== 'undefined' && G.player) ? MOUNT.modelOf(G.player) : '',
    t: Date.now()
  });
}

function onPos(p){
  if(!p || !p.id || p.id === uid) return;
  if(p.r !== myRoom()) return;   /* 公共频道 = 所有在城镇的人；房间内只看同房间的 */
  let r = remotes.get(p.id);
  if(!r){
    r = { id: p.id, x: p.x, y: p.y, tx: p.x, ty: p.y, f: p.f || 1, state: 'i',
          weaponIdx: p.w | 0, name: p.n || '侠客', lv: p.lv || 1, seen: 0, phase: 0 };
    remotes.set(p.id, r);
  }
  r.tx = p.x; r.ty = p.y; r.f = p.f || 1;
  r.state = p.s === 'w' ? 'w' : 'i';
  r.name = p.n || r.name;
  r.lv = p.lv || r.lv;
  r.weaponIdx = (p.w === undefined || p.w === null) ? r.weaponIdx : (p.w | 0);
  if(p.mt !== undefined) r.mt = p.mt || '';
  r.seen = Date.now();
}

function onChat(p){
  if(!p || p.id === uid) return;
  if(p.r !== myRoom()) return;
  chatLine(p.n || '侠客', p.m || '');
}

function updateRemotes(dt, now){
  remotes.forEach(function(r, id){
    if(now - r.seen > DROP_MS){ remotes.delete(id); return; }
    const dx = r.tx - r.x, dy = r.ty - r.y;
    const d = Math.hypot(dx, dy);
    if(d > 0.8){
      const k = Math.min(1, dt * 8);   /* 200ms 时间常数：配合 300ms 广播间隔，远端走动不跳格 */
      r.x += dx * k; r.y += dy * k;
      if(Math.abs(dx) > 0.5) r.f = dx > 0 ? 1 : -1;
      r.phase += dt * 9;
      r.walking = true;
    } else {
      r.walking = false;
    }
  });
}

/* ---------- 点击其他玩家：信息卡 + 邀请切磋 ---------- */
let cardTarget = '';

function jobName(w){
  try{
    if(typeof CHARACTERS !== 'undefined' && CHARACTERS[w]) return CHARACTERS[w].name || ('门派' + ((w | 0) + 1));
  }catch(e){}
  return '门派' + ((w | 0) + 1);
}
function myCharIdx(){
  try{ if(typeof G !== 'undefined' && G && G.player) return G.player.weaponIdx | 0; }catch(e){}
  try{ if(window.CHARS && CHARS.active()) return CHARS.active().charIdx | 0; }catch(e){}
  return 0;
}
const SLOT_CN = { weapon:'武器', head:'头饰', armor:'上衣', shoes:'鞋', necklace:'项链', ring:'戒指', bracer:'护腕', accessory:'戒指' };

/* 我自己的资料（发给对方看） */
function myProfile(){
  const out = { name: myName, lv: myLv, job: myCharIdx(), eq: [], st: null };
  try{
    const p = (typeof G !== 'undefined' && G && G.player) ? G.player : null;
    if(p){
      out.lv = p.level | 0;
      out.name = (typeof CHARS !== 'undefined' && CHARS.active && CHARS.active() ? CHARS.active().name : null) || myName;
      out.st = {
        atk: Math.round(p.atk || 0), def: Math.round(p.def || 0),
        hp: Math.round(p.maxHp || 0), mp: Math.round(p.maxMp || 0),
        crit: Math.round((p.critBonus || 0) * 100),
        dmg: WEAPONS[p.weaponIdx] ? (WEAPONS[p.weaponIdx].dmgType === 'magic' ? '魔法' : '物理') : '物理'
      };
      const eqs = p.equipment || {};
      const slots = (typeof EQUIP_SLOTS !== 'undefined') ? EQUIP_SLOTS : Object.keys(eqs);
      slots.forEach(function(s){
        const it = eqs[s];
        if(!it || !it.name) return;
        out.eq.push({ s:s, n:it.name, e:it.enhance | 0, a:it.amplify | 0, l:it.level | 0 });
      });
    }
  }catch(e){}
  return out;
}

function showCard(r){
  const c = $('opCard');
  if(!c) return;
  cardTarget = r.id;
  c.innerHTML = '<div class="oc-head"><b>' + esc(r.name) + '</b>' +
    '<em>Lv.' + (r.lv || 1) + ' · ' + esc(jobName(r.weaponIdx)) + '</em></div>' +
    '<div class="oc-body" id="ocBody"><div class="oc-tip">正在读取对方的装备与属性…</div></div>' +
    '<div class="oc-acts"><button id="ocPk" type="button">邀请切磋</button>' +
    '<button id="ocClose" type="button">关闭</button></div>';
  c.classList.add('open');
  var _esc = document.getElementById('btnEsc'); if(_esc) _esc.classList.add('behind');
  const pk = $('ocPk');
  if(pk) pk.addEventListener('click', function(){ invitePk(cardTarget); });
  const cl = $('ocClose');
  if(cl) cl.addEventListener('click', hideCard);
  /* 向对方要一份资料 */
  rtSend('pkinfo', { id: uid, to: r.id });
}

function renderCardProfile(d){
  const box = $('ocBody');
  if(!box || !d) return;
  let h = '';
  if(d.st){
    h += '<div class="oc-stats">' +
      '<span>攻击 <b>' + (d.st.atk | 0) + '</b><i>' + esc(d.st.dmg || '') + '</i></span>' +
      '<span>防御 <b>' + (d.st.def | 0) + '</b></span>' +
      '<span>生命 <b>' + (d.st.hp | 0) + '</b></span>' +
      '<span>法力 <b>' + (d.st.mp | 0) + '</b></span>' +
      '<span>暴击 <b>' + (d.st.crit | 0) + '%</b></span>' +
      '</div>';
  }
  if(d.eq && d.eq.length){
    h += '<div class="oc-eqs">' + d.eq.map(function(it){
      const pre = (it.e ? '+' + it.e + ' ' : '') + (it.a ? '增幅' + it.a + ' ' : '');
      return '<div class="oc-eq"><span>' + esc(SLOT_CN[it.s] || it.s) + '</span>' +
             '<b>' + esc(pre + it.n) + '</b>' +
             '<em>' + (it.l ? 'Lv.' + it.l : '') + '</em></div>';
    }).join('') + '</div>';
  } else {
    h += '<div class="oc-tip">对方还没穿装备</div>';
  }
  box.innerHTML = h;
}
function hideCard(){
  const c = $('opCard'); if(c) c.classList.remove('open');
  const e = document.getElementById('btnEsc'); if(e) e.classList.remove('behind');
  cardTarget = '';
}

function invitePk(id){
  if(!id) return;
  const r = remotes.get(id);
  if(!r){ chatLine('', '对方已离开', true); hideCard(); return; }
  if(!relayOk() && (!ch || !joined)){ chatLine('', '还没连上服务器，稍后再试', true); return; }
  rtSend('pkinv', { id: uid, n: myName, to: id, cid: myCharIdx() });
  chatLine('', '已向 ' + (r.name || '对方') + ' 发出切磋邀请，等对方回应…', true);
  hideCard();
}

/* 切磋：进入战斗（用当前角色属性 vs 对手角色），已学技能都能用 */
function startSpar(oppChar){
  hideCard();
  try{
    if(typeof startGatekeeperPvp === 'function'){ startGatekeeperPvp(); return; }
    if(typeof startPvpWithChar === 'function') startPvpWithChar(myCharIdx(), oppChar | 0);
  }catch(e){ console.warn('[online] 切磋启动失败', e); }
}

function hookCanvasClick(){
  const cv = document.getElementById('c');
  if(!cv || cv.__wjxClickBound) return;
  cv.__wjxClickBound = true;
  cv.addEventListener('click', function(e){
    if(typeof gameState === 'undefined' || gameState !== 'town') return;
    if(!remotes.size) return;
    const r0 = cv.getBoundingClientRect();
    if(!r0.width) return;
    const vw = (typeof VW !== 'undefined' && VW) ? VW : 1280;
    const vh = (typeof VH !== 'undefined' && VH) ? VH : 720;
    let wx = (e.clientX - r0.left) * (vw / r0.width);
    let wy = (e.clientY - r0.top) * (vh / r0.height);
    try{ if(typeof townCam !== 'undefined' && townCam){ wx += townCam.x; wy += townCam.y; } }catch(err){}
    let best = null, bd = 1e9;
    remotes.forEach(function(r){
      const d = Math.hypot(r.x - wx, (r.y - 40) - wy);
      if(d < bd){ bd = d; best = r; }
    });
    if(best && bd < 120) showCard(best);
    else if(cardTarget) hideCard();
  });
  /* 手机/触屏：点屏幕空白或按 ESC 也关掉卡片 */
  document.addEventListener('keydown', function(e){
    if(e.key === 'Escape' && cardTarget) hideCard();
  });
}

/* ---------- 绘制 ---------- */
let _lastTick = 0;
function collectDrawables(arr){
  if(!arr) return;
  const nowMs = performance.now();
  const dt = _lastTick ? Math.min(0.1, (nowMs - _lastTick) / 1000) : 0.016;
  _lastTick = nowMs;
  updateRemotes(dt, Date.now());

  if(!remotes.size) return;
  remotes.forEach(function(r){ arr.push({ y: r.y, fn: function(){ drawOne(r); } }); });
}

function drawOne(r){
  if(typeof atlasOf !== 'function' || typeof drawSpriteFrame !== 'function') return;
  const at = atlasOf(r.weaponIdx);
  if(!at) return;
  const bodyPx = 150 * (at.bodyWorld / 110);
  const walking = !!r.walking;
  const prog = walking
    ? (((r.phase / (Math.PI * 2)) % 1 + 1) % 1)
    : ((performance.now() * 0.0006) % 1);

  ctx.save();
  const ny = r.y - bodyPx * 1.02;
  ctx.textAlign = 'center';
  ctx.font = 'bold 12px "Microsoft YaHei"';
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(0,0,0,0.62)';
  ctx.strokeText(r.name, r.x, ny);
  ctx.fillStyle = '#9fe6ff';
  ctx.fillText(r.name, r.x, ny);

  ctx.font = '10px "Microsoft YaHei"';
  ctx.lineWidth = 2.5;
  ctx.strokeText('Lv.' + r.lv, r.x, ny + 13);
  ctx.fillStyle = '#ffe1a6';
  ctx.fillText('Lv.' + r.lv, r.x, ny + 13);

  /* ★ 对方也踩着飞行道具：画在脚下，并且保持站姿 */
  if(r.mt && window.MOUNT){
    MOUNT.draw(ctx, r.x, r.y + 2, 1, r.mt, performance.now() / 1000, walking, r.f || 1);
  }
  drawSpriteFrame(at, (r.mt || !walking) ? 'idle' : 'run', prog, r.x, r.y, r.f || 1, bodyPx);
  ctx.restore();
}

/* ---------- 聊天发送 ---------- */
function sendChat(){
  const el = $('opMsg');
  if(!el) return;
  const m = String(el.value || '').trim();
  if(!m) return;
  el.value = '';
  chatLine(myName, m);
  rtSend('chat', { id: uid, n: myName, m: m, r: myRoom() });
}

/* ---------- 对外接口 ---------- */
window.ONLINE = {
  collectDrawables: collectDrawables,
  get room(){ return roomCode; },
  get count(){ return presenceList().length; },
  get remoteCount(){ return remotes.size; },
  get online(){ return joined; },
  join: joinRoom,
  leave: leaveRoom,
  panel: panel,
  chat: sendChat,
  copyCode: function(){
    if(!roomCode) return '';
    try{ navigator.clipboard.writeText(roomCode); }catch(e){}
    return roomCode;
  }
};

/* ---------- 初始化 ---------- */
function boot(){
  const btn = $('btnOnline');
  if(btn) btn.addEventListener('click', function(){ panel(!$('onlinePanel').classList.contains('open')); });
  const close = $('opClose');
  if(close) close.addEventListener('click', function(){ panel(false); });

  const create = $('opCreate');
  if(create) create.addEventListener('click', function(){ createRoom(); });
  const join = $('opJoin');
  if(join) join.addEventListener('click', function(){ joinRoom($('opCode') ? $('opCode').value : ''); });
  const code = $('opCode');
  if(code) code.addEventListener('keydown', function(e){ if(e.key === 'Enter'){ e.preventDefault(); joinRoom(code.value); } });
  const leave = $('opLeave');
  if(leave) leave.addEventListener('click', function(){ leaveRoom(); });
  const send = $('opSend');
  if(send) send.addEventListener('click', sendChat);
  const msg = $('opMsg');
  if(msg) msg.addEventListener('keydown', function(e){ if(e.key === 'Enter'){ e.preventDefault(); sendChat(); } });

  /* 输入框里敲字不要触发游戏快捷键 */
  document.addEventListener('keydown', function(e){
    const t = e.target;
    if(t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) e.stopImmediatePropagation();
  }, true);

  initIdentity();
  hookCanvasClick();
  /* 中继脚本可能比本文件后加载，等一下再挂上 */
  (function ensureRelay(tries){
    try{
      if(window.RELAY){ window.RELAY.connect(); wireRelay(); return; }
    }catch(e){}
    if(tries > 0) setTimeout(function(){ ensureRelay(tries - 1); }, 120);
  })(25);
  setText('opName', myName);
  setText('opAccount', logged() ? myName : '游客（未登录）');
  setText('opState', logged() ? '连接中…' : '游客模式');

  const lo = $('opLogout');
  if(lo) lo.addEventListener('click', function(){
    if(!logged()){
      chatLine('', '当前是游客模式，刷新页面即可注册或登录', true);
      return;
    }
    if(confirm('退出 ' + myName + ' 并切换其他账号？\n（进度已自动保存）')) window.AUTH.logout();
  });

  if(!sb()){
    setText('opState', '联机不可用');
    chatLine('', '网络组件未加载，联机不可用', true);
    return;
  }
  connect();

  /* 进入游戏后刷新身份与等级 */
  window.addEventListener('wjx:enter', function(){
    initIdentity();
    setText('opName', myName);
    setText('opAccount', logged() ? myName : '游客（未登录）');
    track();
  });

  /* presence 偶尔漏事件，定期刷新一下列表 */
  setInterval(function(){
    renderPlayers();
    renderMembers();
    if(joined && Date.now() - lastTrack > 60000) track();
  }, 5000);
}

/* 对外暴露：触屏 ESC / 其他模块需要能关掉资料卡 */
window.__wjxCard = { show: showCard, hide: hideCard, render: renderCardProfile };

if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();

})();
