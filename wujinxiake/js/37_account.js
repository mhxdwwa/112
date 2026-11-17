/* ===== 账号状态 / 存档位置 =====
   右上角一枚小胶囊：游客＝琥珀点，登录后＝绿点。
   点开说明「我是谁、进度存在哪、最近什么时候存的」，游客可直接去注册。
   只做展示与跳转，不碰游戏逻辑。
*/
(function(){
'use strict';

function $(id){ return document.getElementById(id); }
function toast(t, c){ if(typeof showToast === 'function') showToast(t, c || '#ffcf6e'); }
function pad(n){ return (n < 10 ? '0' : '') + n; }
function hhmm(ts){
  if(!ts) return '—';
  const d = new Date(ts);
  return pad(d.getHours()) + ':' + pad(d.getMinutes());
}

let guestToasted = false;

function info(){
  const a = window.AUTH || {};
  const logged = !!a.loggedIn;
  let cs = { cloud: 'idle', last: 0 };
  try{ if(window.CloudSave && window.CloudSave.status) cs = window.CloudSave.status(); }catch(e){}
  return { logged: logged, name: logged ? (a.username || '侠客') : '游客', cloud: cs.cloud || 'idle', last: cs.last || 0 };
}

function update(){
  const i = info();
  const btn = $('btnAccount'), nm = $('accName');
  if(nm) nm.textContent = i.logged ? i.name : '游客';
  if(btn) btn.classList.toggle('cloud', i.logged && i.cloud === 'ok');

  const who = $('accWho'), where = $('accWhere'), when = $('accWhen'), tip = $('accTip');
  if(who) who.textContent = i.logged ? i.name : '游客（未登录）';
  if(where){
    if(!i.logged){ where.textContent = '仅本机（浏览器）'; where.className = 'warn'; }
    else if(i.cloud === 'ok'){ where.textContent = '云端已同步'; where.className = 'ok'; }
    else if(i.cloud === 'unavailable'){ where.textContent = '云端未就绪 · 仅本机'; where.className = 'warn'; }
    else if(i.cloud === 'error'){ where.textContent = '云端连接失败 · 仅本机'; where.className = 'warn'; }
    else { where.textContent = '检测中…'; where.className = ''; }
  }
  if(when) when.textContent = i.last ? hhmm(i.last) : '尚未保存';

  if(tip){
    tip.textContent = i.logged
      ? '已登录：每 20 秒自动同步云端，关页面也会立刻保存。想换人，点「退出 / 换账号」用你自己的账号登录。'
      : '游客模式：这里的角色和进度都是这台设备上的独立试玩存档，看不到也动不了任何账号的数据。想拥有自己的专属角色和云端存档，点「注册 / 登录」。';
  }

  const loginBtn = $('accLogin'), saveBtn = $('accSave'), switchBtn = $('accSwitch');
  const charsBtn = $('accChars');
  if(loginBtn) loginBtn.classList.toggle('hidden', i.logged);
  if(saveBtn) saveBtn.classList.toggle('hidden', !i.logged);
  if(switchBtn) switchBtn.classList.toggle('hidden', !i.logged);
  const qrBtn = $('accQR');
  if(qrBtn) qrBtn.classList.toggle('hidden', !i.logged);
  if(charsBtn) charsBtn.classList.toggle('hidden', !(window.CHARS && window.CHARS.count() > 0));
}

function open(on){
  const p = $('accountPanel');
  if(!p) return;
  p.classList.toggle('open', !!on);
  update();
}

function boot(){
  const btn = $('btnAccount');
  if(btn) btn.addEventListener('click', function(e){
    e.stopPropagation();
    open(!$('accountPanel').classList.contains('open'));
  });
  const close = $('accClose');
  if(close) close.addEventListener('click', function(){ open(false); });

  const login = $('accLogin');
  if(login) login.addEventListener('click', function(){
    const ok = confirm('去注册 / 登录？\n\n· 游客试玩存档会留在本机，不会丢\n· 登录后进入你自己账号名下的角色列表（一个邮箱 = 一个专属账号）\n· 想一直当游客，点「取消」');
    if(!ok) return;
    try{ window.CloudSave && window.CloudSave.save(); }catch(e){}
    /* ★ 带上 ?auth=login：跳过游客模式，停在登录页
       （以前是 location.reload()，在游客模式下会又回到游客身份，永远登不进去） */
    location.replace(location.pathname + '?auth=login');
  });

  const save = $('accSave');
  if(save) save.addEventListener('click', function(){
    try{ window.CloudSave && window.CloudSave.save(); }catch(e){}
    toast('已保存', '#7af0c8');
    setTimeout(update, 400);
  });

  const chars = $('accChars');
  if(chars) chars.addEventListener('click', function(){
    open(false);
    if(window.CHARS) window.CHARS.openPanel();
  });

  const sw = $('accSwitch');
  if(sw) sw.addEventListener('click', function(){
    const name = (window.AUTH && window.AUTH.username) || '当前账号';
    const ok = confirm('退出「' + name + '」？\n\n· 退出后可以直接注册一个属于自己的账号，或登录别的账号\n· 当前进度已存在这个账号的云存档里，重新登录同一账号即可继续');
    if(!ok) return;
    try{ window.CloudSave && window.CloudSave.save(); }catch(e){}
    setTimeout(function(){
      if(window.AUTH && window.AUTH.loggedIn) window.AUTH.logout('reg');
      else location.replace(location.pathname + '?auth=reg');
    }, 450);
  });

  /* 点面板外面收起 */
  document.addEventListener('click', function(e){
    const p = $('accountPanel');
    if(!p || !p.classList.contains('open')) return;
    if(p.contains(e.target) || (e.target && e.target.id === 'btnAccount')) return;
    open(false);
  });

  window.addEventListener('wjx:enter', function(){
    setTimeout(update, 300);
    if(!guestToasted && !(window.AUTH && window.AUTH.loggedIn)){
      guestToasted = true;
      setTimeout(function(){ toast('游客模式：独立试玩存档 · 点右上角「游客」可注册专属账号', '#ffcf6e'); }, 2200);
    }
  });
  window.addEventListener('wjx:auth', function(){ setTimeout(update, 120); });

  update();
  setInterval(update, 2500);
}

if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();

})();
