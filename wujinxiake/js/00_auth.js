/* ===== 无尽侠客 · 账号系统（Supabase Auth） =====
   注册：邮箱 + 用户名 + 密码
   登录：用户名 + 密码
   ---------------------------------------------------------------
   Supabase Auth 只认邮箱，所以内部登录标识用
        u<用户名哈希>@wujinxiake.app
   哈希而不是明文拼接，避免别人拿用户名去枚举/反查真实邮箱；
   真实邮箱写在 user_metadata.real_email，只有本人能读到。
   这样「用户名唯一」由 auth 的邮箱唯一约束保证，不用额外建表。
*/
(function(){
'use strict';

var SUPABASE_URL = 'https://xbygooadskfqllnhwmet.supabase.co';
var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhieWdvb2Fkc2tmcWxsbmh3bWV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5NjU0NDgsImV4cCI6MjA5ODU0MTQ0OH0.ryfpesmsFqBnaJurlMhjEJOWxZV4oFg3NBu7kQD8EKA';
var DOMAIN = 'wujinxiake.app';

/* FNV-1a 双通道：纯同步计算，任何浏览器结果一致（不依赖 crypto.subtle） */
function hashUser(u){
  u = String(u || '').trim().toLowerCase();
  var h1 = 0x811c9dc5 >>> 0, h2 = 0x01000193 >>> 0;
  for(var i = 0; i < u.length; i++){
    var c = u.charCodeAt(i);
    h1 ^= c; h1 = Math.imul(h1, 0x01000193) >>> 0;
    h2 = (h2 + Math.imul(c + 1, 0x9e3779b1) + i) >>> 0;
    h2 = Math.imul(h2 ^ (h2 >>> 15), 0x2c1b3c6d) >>> 0;
  }
  return (h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0'));
}
function loginEmail(username){ return 'u' + hashUser(username) + '@' + DOMAIN; }

var state = { user:null, username:'', offline:false, ready:false };
var booted = false;

/* ---------- 游客模式标记 ----------
   点过「游客试玩」后，这台设备就是游客身份：
     · 不再静默恢复上一个账号的会话（否则刷新一下又变回别人）
     · 角色列表 / 本地存档走独立的「guest」槽位，看不到任何账号的数据
   只有在登录页主动登录 / 注册成功、或点「注册 · 登录」按钮时才清除。 */
var GUEST_KEY = 'wjx_guest_mode';
function guestMode(){
  try{ return localStorage.getItem(GUEST_KEY) === '1'; }catch(e){ return false; }
}
function setGuestMode(on){
  try{
    if(on) localStorage.setItem(GUEST_KEY, '1');
    else localStorage.removeItem(GUEST_KEY);
  }catch(e){}
}

/* ---------- 启动闸门：登录 + 图片都好了才进游戏 ---------- */
window.Boot = {
  authReady: false,
  imgReady: false,
  auth(){ this.authReady = true; this.hideAuth(); this.maybeEnter(); },
  img(){ this.imgReady = true; this.maybeEnter(); },
  hideAuth(){
    var a = document.getElementById('authLayer');
    if(!a) return;
    var wasShown = a.classList.contains('show');
    a.classList.remove('show');
    /* 从没显示过（游客直接进游戏）：立刻收起来，别闪一下登录页 */
    if(!wasShown){
      a.style.transition = 'none';
      a.style.opacity = '0';
      a.style.visibility = 'hidden';
      a.style.display = 'none';
      return;
    }
    a.style.transition = 'opacity .4s ease, visibility .4s';
    /* 下一帧再改值，过渡才会真正跑起来 */
    requestAnimationFrame(function(){
      a.style.opacity = '0';
      a.style.visibility = 'hidden';
    });
    setTimeout(function(){ a.style.display = 'none'; }, 460);
  },
  maybeEnter(){
    if(!this.authReady || !this.imgReady) return;
    if(booted) return;
    booted = true;
    var b = document.getElementById('bootOverlay');
    if(b){
      b.classList.add('boot-hide');
      setTimeout(function(){ b.style.display = 'none'; }, 520);
    }
    window.__dbgFreeze = false;
    document.documentElement.classList.add('game-entered');
    window.dispatchEvent(new CustomEvent('wjx:enter'));
    if(window.__bootTip) window.__bootTip('加载完成，正在进入…');
  }
};

/* ---------- 对外接口 ---------- */
window.AUTH = {
  get user(){ return state.user; },
  get uid(){ return state.user ? state.user.id : ''; },
  get username(){ return state.username; },
  get offline(){ return state.offline; },
  get guest(){ return state.offline && !state.user; },
  get loggedIn(){ return !!state.user; },
  loginEmail: loginEmail,
  /* 扫码登录成功（setSession 之后）显式采纳会话：
     游客模式下 SIGNED_IN 事件会被忽略，所以必须由调用方主动推一把 */
  adoptSession: function(user){
    if(!user || !user.id) return false;
    var meta = user.user_metadata || {};
    if(meta.game !== 'wujinxiake') return false;
    adopt(user);
    return true;
  },
  /* 退出登录：mode='reg' 时退出后直接打开「注册」页 */
  logout: function(mode){
    function go(){
      state.user = null;
      state.offline = false;
      setGuestMode(false);
      try{ localStorage.removeItem('wjx_session_hint'); }catch(e){}
      try{ localStorage.removeItem('wjx_last_user'); }catch(e){}
      var url = location.pathname + (mode === 'reg' ? '?auth=reg' : '?auth=login');
      location.replace(url);
    }
    try{
      if(window.SB && window.SB.auth && window.SB.auth.signOut){
        window.SB.auth.signOut().then(go).catch(go);
        return;
      }
    }catch(e){}
    go();
  }
};
window.SB = null;

/* ---------- 工具 ---------- */
function $(id){ return document.getElementById(id); }
function val(id){ var el = $(id); return el ? String(el.value || '').trim() : ''; }
function msg(text, kind){
  var el = $('authMsg');
  if(!el) return;
  el.textContent = text || '';
  el.className = 'auth-msg' + (kind ? ' ' + kind : '');
}
function busy(btn, on, label){
  if(!btn) return;
  btn.disabled = !!on;
  if(on){ btn.dataset.old = btn.textContent; btn.textContent = label || '请稍候…'; }
  else if(btn.dataset.old){ btn.textContent = btn.dataset.old; }
}
function friendly(err){
  var m = (err && (err.message || err.error_description || err.msg)) || String(err || '');
  var low = m.toLowerCase();
  if(low.indexOf('invalid login') >= 0) return '用户名或密码错误';
  if(low.indexOf('already registered') >= 0 || low.indexOf('already been registered') >= 0) return '这个用户名已经被用了，换一个';
  if(low.indexOf('email not confirmed') >= 0) return '账号需要邮箱验证，请联系管理员';
  if(low.indexOf('password should be') >= 0) return '密码太短，至少要 6 位';
  if(low.indexOf('unable to validate email') >= 0) return '用户名含有不支持的字符，换一个试试';
  if(low.indexOf('rate limit') >= 0 || low.indexOf('too many') >= 0 || (err && err.status === 429)) return '操作太频繁，等一分钟再试';
  if(low.indexOf('failed to fetch') >= 0 || low.indexOf('networkerror') >= 0) return '网络连接失败，检查网络后重试';
  return '操作失败：' + (m || '未知错误');
}

var RE_USER = /^[\u4e00-\u9fa5A-Za-z0-9_-]{2,16}$/;
var RE_MAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/* ---------- 登录 / 注册 ---------- */
async function doLogin(ev){
  if(ev) ev.preventDefault();
  var u = val('lgUser'), p = $('lgPass') ? $('lgPass').value : '';
  if(!u || !p){ msg('请输入用户名和密码'); return; }
  if(!RE_USER.test(u)){ msg('用户名格式不对（2-16 位，中文/字母/数字/下划线）'); return; }
  var btn = $('lgBtn');
  busy(btn, true, '登录中…');
  msg('正在验证账号…', 'ok');
  try{
    if(!window.SB) throw new Error('网络组件未加载，请刷新页面');
    var res = await window.SB.auth.signInWithPassword({ email: loginEmail(u), password: p });
    if(res.error) throw res.error;
    adopt(res.data.user);
    msg('登录成功，正在进入…', 'ok');
    window.Boot.auth();
  }catch(err){
    msg(friendly(err));
  }finally{
    busy(btn, false);
  }
}

async function doRegister(ev){
  if(ev) ev.preventDefault();
  var mail = val('rgMail'), u = val('rgUser'), p = $('rgPass') ? $('rgPass').value : '', p2 = $('rgPass2') ? $('rgPass2').value : '';
  if(!mail || !RE_MAIL.test(mail)){ msg('请输入正确的邮箱地址'); return; }
  if(!u || !RE_USER.test(u)){ msg('用户名 2-16 位，可用中文/字母/数字/下划线'); return; }
  if(!p || p.length < 6){ msg('密码至少 6 位'); return; }
  if(p !== p2){ msg('两次输入的密码不一致'); return; }
  var btn = $('rgBtn');
  busy(btn, true, '注册中…');
  msg('正在创建账号…', 'ok');
  try{
    if(!window.SB) throw new Error('网络组件未加载，请刷新页面');
    var res = await window.SB.auth.signUp({
      email: loginEmail(u),
      password: p,
      options: { data: { username: u, real_email: mail, game: 'wujinxiake' } }
    });
    if(res.error) throw res.error;
    if(!res.data.session){
      msg('账号已创建，但开启了邮箱验证。请联系管理员关闭「Confirm email」后即可直接登录。');
      return;
    }
    adopt(res.data.user);
    msg('注册成功，正在进入…', 'ok');
    window.Boot.auth();
  }catch(err){
    msg(friendly(err));
  }finally{
    busy(btn, false);
  }
}

function adopt(user){
  state.user = user || null;
  state.offline = false;
  /* 真正登录上就不再是游客：清掉游客标记，角色/存档切回这个 uid 的槽位 */
  if(user) setGuestMode(false);
  var meta = (user && user.user_metadata) || {};
  state.username = meta.username || meta.name || (user && user.email ? String(user.email).split('@')[0] : '');
  state.ready = true;
  try{ localStorage.setItem('wjx_last_user', state.username); }catch(e){}
  window.dispatchEvent(new CustomEvent('wjx:auth', { detail: { uid: user ? user.id : '', username: state.username } }));
}

/* ---------- 界面 ---------- */
function selectTab(reg){
  document.querySelectorAll('.auth-tab').forEach(function(x){
    x.classList.toggle('active', (x.getAttribute('data-tab') === 'reg') === !!reg);
  });
  var fl = $('formLogin'), fr = $('formReg');
  if(fl) fl.classList.toggle('hidden', !!reg);
  if(fr) fr.classList.toggle('hidden', !reg);
  msg('');
  var first = reg ? $('rgMail') : $('lgUser');
  if(first) try{ first.focus(); }catch(e){}
}

function bindUI(){
  document.querySelectorAll('.auth-tab').forEach(function(t){
    t.addEventListener('click', function(){
      selectTab(t.getAttribute('data-tab') === 'reg');
    });
  });
  var fl = $('formLogin'); if(fl) fl.addEventListener('submit', doLogin);
  var fr = $('formReg');   if(fr) fr.addEventListener('submit', doRegister);

  var off = $('authOffline');
  if(off) off.addEventListener('click', function(){
    if(!confirm('确定以「游客」身份试玩？\n\n· 游客有自己独立的试玩存档，不会看到任何账号的角色\n· 进度只存在这台浏览器里，换设备或清缓存会丢\n\n想要属于自己的专属角色和云端存档，请点「取消」回去注册。')) return;
    state.offline = true;
    state.user = null;
    setGuestMode(true);                                  /* ★ 这台设备进入游客身份 */
    try{ localStorage.setItem('wjx_guest_at', String(Date.now())); }catch(e){}
    /* ★ 关键：把上一个账号的登录票据彻底注销。
       否则刷新页面时 Supabase 会静默恢复会话，游客瞬间变回那个账号 —— 
       这正是「游客试玩却进了自己账号」的另一半原因。 */
    try{
      if(window.SB && window.SB.auth && window.SB.auth.signOut){
        window.SB.auth.signOut().catch(function(){});
      }
    }catch(e){}
    try{ localStorage.removeItem('wjx_last_user'); }catch(e){}
    msg('游客模式：独立试玩存档，只存本机', 'ok');
    window.Boot.auth();
  });

  /* 记住上次用户名，少打一次字 */
  try{
    var last = localStorage.getItem('wjx_last_user');
    if(last && $('lgUser')) $('lgUser').value = last;
  }catch(e){}
}

function showAuth(){
  var a = $('authLayer');
  if(a){
    a.classList.add('show');
    /* 直接给终值，不依赖 CSS 过渡（首帧就要清晰可见） */
    a.style.transition = 'none';
    a.style.opacity = '1';
    a.style.visibility = 'visible';
    setTimeout(function(){ a.style.transition = ''; }, 60);
  }
  var tip = $('authLoadTip');
  if(tip) tip.textContent = '资源加载中…';
  var f = $('lgUser');
  if(f) try{ f.focus(); }catch(e){}
}

/* 底部实时显示图片加载进度：登录的同时后台在下资源 */
window.__bootTip = function(text){
  var tip = $('authLoadTip');
  if(tip) tip.textContent = text;
};

/* ---------- 启动 ---------- */
function start(){
  bindUI();

  /* ?auth=reg / ?auth=login / ?auth=switch：从「退出 / 换账号」或「注册登录」跳过来，
     强制停在登录页，并退出游客身份（用户明确要求去登录，就不能再当游客） */
  var wantAuth = /[?&]auth=(reg|login|switch)\b/.test(location.search);
  if(wantAuth){
    setGuestMode(false);
    state.offline = false;
    try{ history.replaceState(null, '', location.pathname); }catch(e){}
  }

  try{
    if(window.supabase && window.supabase.createClient){
      window.SB = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
      });
    }
  }catch(e){
    console.warn('[auth] Supabase 初始化失败', e);
  }

  /* ★ 这台设备上次点过「游客试玩」：不恢复任何账号会话，直接以游客进游戏。
     这是「游客试玩」和「账号」彻底隔离的第一道闸门。 */
  if(!wantAuth && guestMode()){
    state.offline = true;
    state.user = null;
    if(!window.SB){
      /* 连不上 Supabase 也照样能游客玩 */
      window.__dbgFreeze = true;
      window.Boot.auth();
      return;
    }
    /* 防御：万一还残留着上个账号的票据，再注销一次 */
    try{ window.SB.auth.signOut().catch(function(){}); }catch(e){}
    /* 游客模式下任何「登录复活」事件都不采纳 */
    window.SB.auth.onAuthStateChange(function(evt, session){
      if(state.offline && session && session.user) return;
    });
    window.Boot.auth();
    return;
  }

  if(!window.SB){
    showAuth();
    msg('网络组件加载失败。可以先「离线游玩」，刷新页面可重试登录。', 'err');
    return;
  }

  /* 已登录过：静默恢复会话，直接进游戏 */
  window.SB.auth.getSession().then(function(res){
    var s = res && res.data && res.data.session;
    /* ★ 已经切到游客了，就别再登回去 */
    if(state.offline) return;
    if(s && s.user && !wantAuth){
      /* ★ 安全检查：只允许在本游戏注册过的账号自动登录
         注册时 user_metadata.game = 'wujinxiake'，没有这个标记的
         说明是从同域其他站点（如班级宠物）带过来的 session */
      var meta = s.user.user_metadata || {};
      if(meta.game === 'wujinxiake'){
        adopt(s.user);
        window.Boot.auth();
        return;
      }
      /* 不是本游戏的账号：清掉这个 session，让用户重新注册/登录 */
      try{ window.SB.auth.signOut(); }catch(e){}
    }
    /* 要换账号：先把旧会话清掉，免得又自动登回去 */
    if(s && wantAuth){
      try{ window.SB.auth.signOut(); }catch(e){}
    }
    window.__dbgFreeze = true;   /* 登录时先冻结主循环，省点性能 */
    showAuth();
    if(wantAuth) selectTab(true);
  }).catch(function(){
    window.__dbgFreeze = true;
    showAuth();
    if(wantAuth) selectTab(true);
  });

  /* token 过期自动续期失败 → 提示重新登录 */
  window.SB.auth.onAuthStateChange(function(evt, session){
    if(evt === 'SIGNED_OUT' && !state.offline && booted){
      /* 不做强制跳转，避免误伤；下次刷新会要求登录 */
      console.warn('[auth] 登录状态已失效');
    }
    if(evt === 'SIGNED_IN' && session && session.user && !state.user){
      /* ★ 游客模式不接纳任何会话（扫码登录会显式调 AUTH.adoptSession） */
      if(state.offline) return;
      /* ★ 同样检查：只接受本游戏注册的账号 */
      var meta = session.user.user_metadata || {};
      if(meta.game === 'wujinxiake'){
        adopt(session.user);
      } else {
        /* 不是本游戏的账号，退出 */
        try{ window.SB.auth.signOut(); }catch(e){}
      }
    }
  });
}

if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', start);
} else {
  start();
}

})();
