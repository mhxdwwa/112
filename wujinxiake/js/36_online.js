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
const SEND_MS  = 110;      /* 位置广播间隔 */
const DROP_MS  = 9000;     /* 这么久没消息就当掉线 */

let uid = '', myName = '', myLv = 1, myJob = 0;
let ch = null, joined = false, roomCode = '', pendingRoom = '';
let sendTimer = null, lastTrack = 0;
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

  ch.on('broadcast', { event: 'pos' },  function(m){ onPos(m.payload); });
  ch.on('broadcast', { event: 'chat' }, function(m){ onChat(m.payload); });
  ch.on('broadcast', { event: 'bye' },  function(m){
    const p = m.payload || {};
    if(p.id) remotes.delete(p.id);
  });
  ch.on('presence', { event: 'sync' }, function(){ renderPlayers(); renderMembers(); });

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
    ch.track({ uid: uid, name: myName, lv: myLv, job: myJob, room: roomCode, at: lastTrack });
  }catch(e){}
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
    const tag = p.room ? '<i>房 ' + esc(p.room) + '</i>' : '';
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

function joinRoom(code){
  if(!sb()){ chatLine('', '网络组件未加载，无法联机', true); return; }
  code = String(code || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if(!code){ chatLine('', '请输入房间码', true); return; }
  if(!joined){
    pendingRoom = code;
    chatLine('', '正在连接服务器，连上后自动进入房间 ' + code, true);
    connect();
    return;
  }

  leaveRoom(true);
  roomCode = code;
  remotes.clear();
  setText('opRoomCode', roomCode);
  const r = $('opRoom'); if(r) r.classList.remove('hidden');
  chatLine('', '进入房间 ' + roomCode, true);
  track();
  renderMembers();
  setTimeout(function(){ if(roomCode) track(); }, 1200);
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

function sendPos(){
  if(!ch || !joined || !roomCode) return;
  if(!inPlayableState()) return;
  const p = (typeof townPlayer !== 'undefined' && townPlayer) ? townPlayer
          : (typeof G !== 'undefined' && G && G.player ? G.player : null);
  if(!p) return;

  if(typeof G !== 'undefined' && G && G.player){
    myJob = G.player.weaponIdx | 0;
    myLv = G.player.level | 0;
  }
  try{
    ch.send({
      type: 'broadcast', event: 'pos',
      payload: {
        id: uid, n: myName, lv: myLv, w: myJob, r: roomCode,
        x: Math.round(p.x), y: Math.round(p.y),
        f: p.facing >= 0 ? 1 : -1,
        s: (p.state === 'walk' || p.state === 'run') ? 'w' : 'i',
        t: Date.now()
      }
    });
  }catch(e){}
}

function onPos(p){
  if(!p || !p.id || p.id === uid) return;
  if(!roomCode || p.r !== roomCode) return;   /* 不同房间不显示 */
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
  r.seen = Date.now();
}

function onChat(p){
  if(!p || p.id === uid) return;
  if(p.r !== roomCode) return;
  chatLine(p.n || '侠客', p.m || '');
}

function updateRemotes(dt, now){
  remotes.forEach(function(r, id){
    if(now - r.seen > DROP_MS){ remotes.delete(id); return; }
    const dx = r.tx - r.x, dy = r.ty - r.y;
    const d = Math.hypot(dx, dy);
    if(d > 0.8){
      const k = Math.min(1, dt * 16);
      r.x += dx * k; r.y += dy * k;
      if(Math.abs(dx) > 0.5) r.f = dx > 0 ? 1 : -1;
      r.phase += dt * 9;
      r.walking = true;
    } else {
      r.walking = false;
    }
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

  if(!remotes.size || !roomCode) return;
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

  drawSpriteFrame(at, walking ? 'run' : 'idle', prog, r.x, r.y, r.f || 1, bodyPx);
  ctx.restore();
}

/* ---------- 聊天发送 ---------- */
function sendChat(){
  const el = $('opMsg');
  if(!el) return;
  const m = String(el.value || '').trim();
  if(!m) return;
  el.value = '';
  if(!roomCode){ chatLine('', '先加入一个房间才能聊天', true); return; }
  chatLine(myName, m);
  if(!ch || !joined) return;
  try{
    ch.send({ type: 'broadcast', event: 'chat', payload: { id: uid, n: myName, m: m, r: roomCode } });
  }catch(e){}
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
  if(create) create.addEventListener('click', function(){ joinRoom(randCode()); });
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

if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();

})();
