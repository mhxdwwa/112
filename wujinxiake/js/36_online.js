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
function myRoom(){
  /* ★ 组队刷图时进「队伍房间」：副本里只看得见队友，城镇里其他人不会跟进来 */
  if(inCoopLevel() && teamLead) return 'T' + teamLead;
  return roomCode || LOBBY;
}
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
  /* ★ 组队治疗：同房间队友的治疗技能会把回血广播过来 */
  ch.on('broadcast', { event: 'heal' }, function(m){ if(relayOk()) return; onHeal(m.payload); });
  /* ★ 组队刷图 */
  ch.on('broadcast', { event: 'tinv' },  function(m){ if(relayOk()) return; handleTeamInvite(m.payload); });
  ch.on('broadcast', { event: 'trsp' },  function(m){ if(relayOk()) return; handleTeamResp(m.payload); });
  ch.on('broadcast', { event: 'tsync' }, function(m){ if(relayOk()) return; handleTeamSync(m.payload); });
  ch.on('broadcast', { event: 'tquit' }, function(m){ if(relayOk()) return; handleTeamQuit(m.payload); });
  ch.on('broadcast', { event: 'tlead' }, function(m){ if(relayOk()) return; handleTeamLead(m.payload); });
  ch.on('broadcast', { event: 'tkick' }, function(m){ if(relayOk()) return; handleTeamKick(m.payload); });
  ch.on('broadcast', { event: 'tgo' },   function(m){ if(relayOk()) return; handleTeamGo(m.payload); });
  ch.on('broadcast', { event: 'hit' },   function(m){ if(relayOk()) return; onHit(m.payload); });
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
  RELAY.on('heal', function(p){ onHeal(p); });
  RELAY.on('tinv',  function(p){ handleTeamInvite(p); });
  RELAY.on('trsp',  function(p){ handleTeamResp(p); });
  RELAY.on('tsync', function(p){ handleTeamSync(p); });
  RELAY.on('tquit', function(p){ handleTeamQuit(p); });
  RELAY.on('tlead', function(p){ handleTeamLead(p); });
  RELAY.on('tkick', function(p){ handleTeamKick(p); });
  RELAY.on('tgo',   function(p){ handleTeamGo(p); });
  RELAY.on('hit',   function(p){ onHit(p); });
  /* 中继刚连上时补发一次位置，免得别人看不到站着的你 */
  if(othersOnline()){ lastPosSig = ''; try{ sendPos(); }catch(e){} }
}

/* ---------- 组队刷图（最多 4 人，各自掉各自捡） ----------
   设计：没有主机，每个人本地跑自己的战斗实例。
   · 队长选关 → 广播 tgo，全队一起 startLevel
   · 副本里互相广播坐标，同屏看得见队友
   · 伤害用「敌人编号 ekey」广播同步，谁打死算谁的 ——
     每个客户端各自击杀、各自按自己的概率生成掉落，天然互不影响 */
const TEAM_MAX = 4;
let teamLead = '';          /* 队长 uid；空 = 没队伍 */
let teamMembers = [];       /* [{id,name,lv,job}]，含队长自己 */
let coopLv = -1;            /* 组队进的关卡号；-1 = 不在组队副本里 */

function inTeam(){ return !!teamLead; }
function isLead(){ return !!teamLead && teamLead === uid; }
function inCoopLevel(){
  if(coopLv < 0 || !inTeam()) return false;
  if(typeof gameState === 'undefined') return false;
  return gameState === 'playing' || gameState === 'stageClear' || gameState === 'paused';
}

/* 邀请别人组队 */
function inviteTeam(id){
  if(!id) return;
  if(!relayOk() && (!ch || !joined)){ chatLine('', '还没连上服务器，稍后再试', true); return; }
  const r = remotes.get(id);
  if(!r){ chatLine('', '对方已离开城镇', true); hideCard(); return; }
  if(inTeam() && !isLead()){ chatLine('', '只有队长能邀请人', true); return; }
  if(inTeam() && teamMembers.length >= TEAM_MAX){ chatLine('', '队伍已满（最多 ' + TEAM_MAX + ' 人）', true); return; }
  rtSend('tinv', { id: uid, n: myName, to: id, lv: myLv, job: myCharIdx() });
  chatLine('', '已向 ' + (r.name || '对方') + ' 发出组队邀请，等回应…', true);
  hideCard();
}

function handleTeamInvite(p){
  p = p || {};
  if(!p.id || p.id === uid) return;
  if(p.to && p.to !== uid) return;
  if(inTeam()){
    rtSend('trsp', { id: uid, n: myName, to: p.id, ok: false, busy: 1 });
    chatLine('', '你已经在一个队伍里了（先点「离开队伍」再加入）', true);
    return;
  }
  if(typeof gameState !== 'undefined' && gameState !== 'town'){
    rtSend('trsp', { id: uid, n: myName, to: p.id, ok: false, busy: 2 });
    chatLine('', '只能在城镇里组队（先把当前这张图打完）', true);
    return;
  }
  const yes = confirm((p.n || '有人') + ' 邀请你组队刷图\n\n最多 4 人，一起进同一张图打怪；\n掉落各自随机、只能捡自己那份。\n\n要加入吗？');
  if(!yes){
    rtSend('trsp', { id: uid, n: myName, to: p.id, ok: false });
    chatLine('', '你拒绝了 ' + (p.n || '对方') + ' 的组队邀请', true);
    return;
  }
  teamLead = p.id;
  teamMembers = [{ id: uid, name: myName, lv: myLv, job: myCharIdx() }];
  rtSend('trsp', { id: uid, n: myName, to: p.id, ok: true, lv: myLv, job: myCharIdx() });
  chatLine('', '已加入 ' + (p.n || '对方') + ' 的队伍，等队长选关', true);
  renderTeam(); track();
}

function handleTeamResp(p){
  p = p || {};
  if(p.to !== uid) return;
  if(!p.ok){
    chatLine('', (p.n || '对方') + (p.busy === 2 ? ' 还在副本里' : (p.busy ? ' 已在别的队伍里' : ' 拒绝了组队邀请')), true);
    return;
  }
  if(!teamLead){
    teamLead = uid;
    teamMembers = [{ id: uid, name: myName, lv: myLv, job: myCharIdx() }];
  }
  if(!isLead()) return;
  if(teamMembers.some(function(m){ return m.id === p.id; })) return;
  if(teamMembers.length >= TEAM_MAX){
    chatLine('', '队伍已满，' + (p.n || '对方') + ' 没能加入', true);
    broadcastTeam();
    return;
  }
  teamMembers.push({ id: p.id, name: p.n || '侠客', lv: p.lv || 1, job: p.job | 0 });
  broadcastTeam();
  chatLine('', (p.n || '对方') + ' 加入了队伍（' + teamMembers.length + '/' + TEAM_MAX + '）', true);
}

function broadcastTeam(){
  if(!isLead()) return;
  rtSend('tsync', { lead: teamLead, members: teamMembers });
  renderTeam();
}

function handleTeamSync(p){
  p = p || {};
  if(!p.lead || !inTeam() || p.lead !== teamLead) return;
  teamMembers = (p.members || []).slice(0, TEAM_MAX);
  renderTeam();
}

function leaveTeam(){
  if(!inTeam()) return;
  rtSend('tquit', { id: uid, n: myName, lead: teamLead });
  teamLead = ''; teamMembers = []; coopLv = -1;
  renderTeam(); track();
  chatLine('', '已离开队伍', true);
}

function handleTeamQuit(p){
  p = p || {};
  if(!inTeam() || p.lead !== teamLead) return;
  teamMembers = teamMembers.filter(function(m){ return m.id !== p.id; });
  if(p.id === teamLead){
    /* ★ DNF 式：队长走了不散队，自动把队长交给下一个还在队的成员 */
    if(teamMembers.length){
      teamLead = teamMembers[0].id;
      teamMembers[0].lead = true;
      chatLine('', (p.n || '队长') + ' 离开了，' + (teamMembers[0].name || '队友') + ' 接任队长', true);
      if(isLead()) broadcastTeam(); else renderTeam();
    } else {
      teamLead = ''; teamMembers = []; coopLv = -1;
      renderTeam(); chatLine('', '队伍已解散', true);
    }
    track();
    return;
  }
  renderTeam();
  if(isLead()){
    broadcastTeam();
    chatLine('', (p.n || '队友') + ' 离开了队伍', true);
  }
}

/* ★ 委任队长（城镇里转让：只有当前队长能操作） */
function appointLead(id){
  if(!isLead() || !id || id === uid) return;
  if(!teamMembers.some(function(m){ return m.id === id; })) return;
  if(coopLv >= 0){ chatLine('', '副本里不能转让队长，回城镇再操作', true); return; }
  if(!confirm('把队长交给这位队友？\n\n交出后由他来选关带全队。')) return;
  const oldLead = teamLead;
  rtSend('tlead', { lead: oldLead, to: id, n: myName });   /* ★ 先通知全队换队长 */
  teamLead = id;
  sortTeamLeadFirst();
  renderTeam();
  /* 等队友把新队长记下来，再补发两次名单（一次用旧队长号、一次用新队长号），
     免得有人因为队长对不上而把名单忽略掉 */
  setTimeout(function(){ rtSend('tsync', { lead: oldLead, members: teamMembers }); }, 120);
  setTimeout(function(){ rtSend('tsync', { lead: id, members: teamMembers }); }, 500);
  chatLine('', '你已把队长交给 ' + (nameOf(id) || '队友'), true);
  track();
}

function handleTeamLead(p){
  p = p || {};
  if(!inTeam() || p.lead !== teamLead) return;
  if(!p.to) return;
  teamLead = p.to;
  sortTeamLeadFirst();
  renderTeam();
  chatLine('', (nameOf(p.to) || '队友') + ' 成为新队长，由他选关', true);
  track();
}

/* ★ 请离队伍（只有队长能踢人） */
function kickMember(id){
  if(!isLead() || !id || id === uid) return;
  if(!teamMembers.some(function(m){ return m.id === id; })) return;
  if(!confirm('把 ' + (nameOf(id) || '这位队友') + ' 请离队伍？')) return;
  rtSend('tkick', { lead: teamLead, to: id, n: myName });
  teamMembers = teamMembers.filter(function(m){ return m.id !== id; });
  renderTeam();
  setTimeout(function(){ if(isLead()) broadcastTeam(); }, 400);
  chatLine('', '已把 ' + (nameOf(id) || '队友') + ' 请离队伍', true);
}

function handleTeamKick(p){
  p = p || {};
  if(!inTeam() || p.lead !== teamLead) return;
  if(p.to !== uid) return;
  teamLead = ''; teamMembers = []; coopLv = -1;
  renderTeam(); track();
  chatLine('', (p.n || '队长') + ' 把你请离了队伍', true);
}

function nameOf(id){
  for(const m of teamMembers){ if(m.id === id) return m.name; }
  const r = remotes.get(id);
  return r ? r.name : '';
}
function sortTeamLeadFirst(){
  if(!teamLead) return;
  teamMembers.sort(function(a, b){
    if(a.id === teamLead) return -1;
    if(b.id === teamLead) return 1;
    return 0;
  });
}

/* 队伍面板 */
function renderTeam(){
  const box = $('opTeam');
  const cnt = $('opTeamCount');
  if(cnt) cnt.textContent = String(teamMembers.length || 0);
  const leave = $('opTeamLeave');
  if(leave) leave.style.display = inTeam() ? '' : 'none';
  if(!box) return;
  if(!inTeam() || !teamMembers.length){
    box.innerHTML = '<div class="op-empty">还没组队 —— 在城镇里点别人，选「邀请组队」</div>';
    return;
  }
  box.innerHTML = teamMembers.map(function(m){
    const me = m.id === uid;
    const lead = (m.id === teamLead) ? '<i>队长</i>' : '';
    const acts = (isLead() && !me)
      ? '<button class="op-mini" data-act="lead" data-id="' + esc(m.id) + '">委任</button>' +
        '<button class="op-mini warn" data-act="kick" data-id="' + esc(m.id) + '">请离</button>'
      : '';
    return '<div class="op-player' + (me ? ' me' : '') + '">' +
           '<span>' + esc(m.name || '侠客') + lead + '</span>' +
           '<em>Lv.' + (m.lv || 1) + ' · ' + esc(jobName(m.job | 0)) + '</em>' + acts + '</div>';
  }).join('');
  /* 委任 / 请离（事件委托，列表每次重画也不用重新绑定） */
  if(!box.__teamBound){
    box.__teamBound = true;
    box.addEventListener('click', function(e){
      const b = e.target && e.target.closest ? e.target.closest('button[data-act]') : null;
      if(!b) return;
      const id = b.getAttribute('data-id') || '';
      if(b.getAttribute('data-act') === 'lead') appointLead(id);
      else kickMember(id);
    });
  }
}

/* ★ 组队刷图：队长选关后带全队一起进（08_menu 的选关点击会调这里） */
function teamGo(levelIdx){
  if(!inTeam() || !isLead()){
    /* 队员自己进图就是单刷，不占用队伍频道（队长开图时仍会把你拉进去） */
    return;
  }
  if(teamMembers.length > 1){
    rtSend('tgo', { lead: uid, lv: levelIdx | 0, diff: (typeof G !== 'undefined' && G) ? (G.currentDifficulty || 'normal') : 'normal' });
    chatLine('', '全队 ' + teamMembers.length + ' 人进入第 ' + ((levelIdx | 0) + 1) + ' 关，出发！', true);
  }
  enterCoopLevel(levelIdx | 0);
}

function handleTeamGo(p){
  p = p || {};
  if(!inTeam() || p.lead !== teamLead) return;
  if(p.diff && typeof G !== 'undefined' && G) G.currentDifficulty = p.diff;
  chatLine('', '队长带你刷第 ' + ((p.lv | 0) + 1) + ' 关，出发！', true);
  enterCoopLevel(p.lv | 0);
  try{ startLevel(p.lv | 0); }
  catch(e){ console.warn('[online] 组队进图失败', e); chatLine('', '进图失败，先在城镇里试一次', true); }
}

function enterCoopLevel(lv){
  coopLv = lv;
  /* 副本里只留队友：城镇里其他人不再显示 */
  const ids = {};
  teamMembers.forEach(function(m){ ids[m.id] = 1; });
  remotes.forEach(function(v, k){ if(!ids[k]) remotes.delete(k); });
  lastPosSig = '';
  track();
  try{ sendPos(); }catch(e){}
}

/* ---------- 组队伤害同步 ---------- */
/* 我打到怪：把「打谁、打多少」广播给队友 */
let _lastHitAt = 0;
function teamHit(e, dmg, isCrit){
  if(!inCoopLevel() || !e || !e.alive) return;
  const k = e.ekey;
  if(!k) return;
  /* 限流：多段伤害一秒能打十几下，别把网络打满；但「致命一击」必须发出去，
     否则队友那边这只怪永远死不了 */
  const lethal = (e.hp <= 0);
  const now = Date.now();
  if(!lethal && now - _lastHitAt < 70) return;
  _lastHitAt = now;
  rtSend('hit', { from: uid, k: k, dmg: Math.round(dmg) || 0, c: isCrit ? 1 : 0 });
}

/* 队友打到怪：在我自己这份战场上同步掉血，打死算我的掉落 */
function onHit(p){
  p = p || {};
  if(!p.from || p.from === uid) return;
  if(!inCoopLevel()) return;
  if(typeof G === 'undefined' || !G || !G.enemies) return;
  let tgt = null;
  for(const e of G.enemies){ if(e.alive && e.ekey === p.k){ tgt = e; break; } }
  if(!tgt) return;
  const dmg = Math.max(1, p.dmg | 0);
  tgt.hp -= dmg;
  tgt.hitFlash = 0.12;
  tgt.hurtT = Math.max(tgt.hurtT || 0, 0.12);
  try{
    spawnText(tgt.x, tgt.y, 100 + tgt.h, (p.c ? '暴击 ' : '') + dmg, p.c ? '#ff9a5a' : '#ffd9a0', p.c ? 30 : 20);
    addEffect('hitRing', tgt.x, tgt.y, 0.22, { color: '#ffd9a0', r: 32 });
  }catch(err){}
  if(tgt.hp <= 0){
    try{ killEnemy(tgt); }catch(err){ tgt.alive = false; tgt.deathT = 0; }
  }
}

/* ---------- 组队治疗（两条通道共用） ---------- */
/* 施法者这边：广播“我放了一个治疗光环”，并给范围内的队友撒治疗特效 */
function healAllies(pct, radius){
  const me = (typeof G !== 'undefined' && G) ? G.player : null;
  if(!me || !joined && !relayOk()) return;
  const R = radius || 320;
  try{
    rtSend('heal', { from: uid, x: Math.round(me.x), y: Math.round(me.y), r: R, pct: pct || 0.2 });
  }catch(e){}
  /* 本地反馈：让施法者看到队友也被照顾到了 */
  try{
    remotes.forEach(function(r){
      const d = Math.hypot(r.x - me.x, (r.y - me.y) * 0.5);
      if(d > R) return;
      try{ spawnText(r.x, r.y, 180, '受治疗', '#7ed957', 20); }catch(e){}
      try{ addEffect('explosion', r.x, r.y, 0.5, {color:'#7ed957', r:96}); }catch(e){}
    });
  }catch(e){}
}

/* 接受方这边：判断自己是否在光环内，是就按自己的最大生命百分比回血 */
function onHeal(p){
  p = p || {};
  if(!p.from || p.from === uid) return;
  if(typeof gameState === 'undefined' || gameState !== 'playing') return;
  if(typeof G === 'undefined' || !G || !G.player) return;
  const me = G.player;
  if(me.dead || me.hp <= 0) return;
  const R = p.r || 320;
  const d = Math.hypot(me.x - (p.x || 0), (me.y - (p.y || 0)) * 0.5);
  if(d > R) return;
  const amt = Math.round(me.maxHp * (p.pct || 0.2));
  const heal = Math.min(me.maxHp - me.hp, amt);
  if(heal <= 0) return;
  me.hp += heal;
  try{ spawnText(me.x, me.y, 200, '队友治疗 +' + heal, '#7ed957', 28); }catch(e){}
  try{ addEffect('explosion', me.x, me.y, 0.5, {color:'#7ed957', r:120}); }catch(e){}
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

/* 城镇里广播位置；★ 组队刷图时副本里也要广播（队友要互相看得见） */
function sendPos(){
  if(!ch || !joined) return;
  const coop = inCoopLevel();
  if(typeof gameState === 'undefined') return;
  if(gameState !== 'town' && !coop) return;
  /* 副本里用战斗里的主角；城镇里用城镇小人（别拿 townPlayer 的旧坐标当战斗坐标） */
  const p = coop
    ? ((typeof G !== 'undefined' && G && G.player) ? G.player : null)
    : ((typeof townPlayer !== 'undefined' && townPlayer) ? townPlayer : null);
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
    /* ★ 组队刷图：顺带带上血量百分比，副本里队友头顶能看血条 */
    hp: (coop && p.maxHp) ? Math.max(0, Math.min(100, Math.round(p.hp / p.maxHp * 100))) : 0,
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
  if(p.hp !== undefined) r.hp = p.hp | 0;   /* 0~100 血量百分比 */
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
    '<div class="oc-acts"><button id="ocTeam" type="button">邀请组队</button>' +
    '<button id="ocPk" type="button">邀请切磋</button>' +
    '<button id="ocClose" type="button">关闭</button></div>';
  c.classList.add('open');
  var _esc = document.getElementById('btnEsc'); if(_esc) _esc.classList.add('behind');
  const tm = $('ocTeam');
  if(tm) tm.addEventListener('click', function(){ inviteTeam(cardTarget); });
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
  /* ★ 回到城镇 / 选关界面：立刻丢掉副本里队友的影子（不然会在城里残留几秒） */
  if(coopLv >= 0 && typeof gameState !== 'undefined' &&
     (gameState === 'town' || gameState === 'levelSelect' || gameState === 'menu')){
    coopLv = -1;
    remotes.clear();
    try{ track(); }catch(e){}
  }
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

  /* ★ 组队副本里给队友加一条小血条，方便照应 */
  if(inCoopLevel() && r.hp){
    const bw = 46, bh = 5, bx = r.x - bw/2, by = ny + 18;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
    ctx.fillStyle = r.hp > 35 ? '#5fd98a' : '#ff6a5a';
    ctx.fillRect(bx, by, bw * (r.hp / 100), bh);
  }

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

/* ---------- 小队面板（DNF 式：左上角列出队友名字 + 血条） ---------- */
function drawTeamHud(){
  if(!inTeam() || !teamMembers.length) return;
  try{
    if(typeof ctx === 'undefined' || !ctx) return;
    const x = 18, y = 152, w = 158, rowH = 34;
    const h = 24 + teamMembers.length * rowH + 4;
    ctx.save();
    ctx.fillStyle = 'rgba(8,12,20,0.62)';
    ctx.beginPath(); ctx.roundRect(x, y, w, h, 8); ctx.fill();
    ctx.strokeStyle = 'rgba(201,168,76,0.45)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffd166';
    ctx.font = 'bold 11px "Microsoft YaHei"';
    ctx.fillText('小队 ' + teamMembers.length + '/' + TEAM_MAX, x + 9, y + 15);
    for(let i = 0; i < teamMembers.length; i++){
      const m = teamMembers[i];
      const ry = y + 22 + i * rowH;
      const isMe = m.id === uid;
      const rr = remotes.get(m.id);
      let hpPct = 100;
      if(isMe){
        const p = (typeof G !== 'undefined' && G && G.player) ? G.player : null;
        hpPct = (p && p.maxHp) ? Math.round(Math.max(0, p.hp) / p.maxHp * 100) : 100;
      } else {
        hpPct = rr ? (rr.hp || 0) : 0;
      }
      let nm = m.name || '侠客';
      if(nm.length > 7) nm = nm.slice(0, 7) + '…';
      ctx.fillStyle = isMe ? '#9fe6ff' : '#c6d6e4';
      ctx.font = 'bold 11px "Microsoft YaHei"';
      ctx.fillText(nm, x + 9, ry + 12);
      if(m.id === teamLead){
        const nw = ctx.measureText(nm).width;
        ctx.fillStyle = '#ffd98e';
        ctx.font = '9px "Microsoft YaHei"';
        ctx.fillText('队长', x + 9 + nw + 5, ry + 12);
      }
      const bw = w - 18, bh = 6, by = ry + 17;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(x + 9, by, bw, bh);
      ctx.fillStyle = hpPct > 35 ? '#5fd98a' : '#ff6a5a';
      ctx.fillRect(x + 9, by, bw * Math.max(0, Math.min(100, hpPct)) / 100, bh);
    }
    ctx.restore();
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
  healAllies: healAllies,          /* ★ 治疗技能调用：pct=回血百分比, radius=范围 */
  /* ★ 组队刷图 */
  teamGo: teamGo,                  /* ★ 选关时调用：有队伍就把全队一起带进去 */
  appointLead: appointLead,        /* ★ 转让队长 */
  kickMember: kickMember,          /* ★ 请离队员 */
  drawTeamHud: drawTeamHud,        /* ★ 副本/城镇左上角的小队面板 */
  teamHit: teamHit,                /* ★ 玩家伤害入口：e=敌人 dmg=伤害 isCrit=暴击 */
  inviteTeam: inviteTeam,
  leaveTeam: leaveTeam,
  teamInfo: function(){
    return { lead: teamLead, members: teamMembers.slice(), max: TEAM_MAX,
             inTeam: inTeam(), isLead: isLead(), coop: coopLv >= 0 };
  },
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
  const tleave = $('opTeamLeave');
  if(tleave) tleave.addEventListener('click', function(){ leaveTeam(); });
  renderTeam();
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
    /* ★ 回到城镇就退出组队副本状态（房间切回公共频道，重新看得见城里的人） */
    if(coopLv >= 0 && typeof gameState !== 'undefined' && (gameState === 'town' || gameState === 'levelSelect')){
      coopLv = -1;
      try{ remotes.clear(); lastPosSig = ''; track(); sendPos(); }catch(e){}
    }
    if(joined && Date.now() - lastTrack > 60000) track();
  }, 5000);
}

/* 对外暴露：触屏 ESC / 其他模块需要能关掉资料卡 */
window.__wjxCard = { show: showCard, hide: hideCard, render: renderCardProfile };

if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();

})();
