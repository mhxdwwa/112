/* ===== 扫码登录（电脑出码 / 手机扫码确认） =====
   电脑端：登录页「扫码登录」按钮 → 生成一次性二维码 → 轮询 Worker
   手机端：账号面板「扫码登录」按钮 → 打开相机扫二维码 → 把本机登录票据
          写到同一个票据里 → 电脑端拿到票据直接 setSession 完成登录

   握手走 Cloudflare Worker（和交易行同一个 Durable Object），
   不额外消耗 Supabase 的请求额度；票据 5 分钟有效、一次性。
*/
(function () {
  'use strict';

  var QR_BASE = (location.hostname && location.hostname !== '127.0.0.1' && location.hostname !== 'localhost')
    ? (location.origin + '/api/wjx-relay/qr')
    : 'https://wscls.cn/api/wjx-relay/qr';
  var SCAN_URL = 'https://wscls.cn/wujinxiake/?qr=';

  function $(id) { return document.getElementById(id); }
  function post(path, body) {
    return fetch(QR_BASE + '/' + path, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body || {})
    }).then(function (r) { return r.json(); });
  }
  function isPhone() {
    var ua = navigator.userAgent || '';
    var touch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 1);
    var small = Math.min(window.innerWidth || 0, window.innerHeight || 0) <= 820;
    return (touch && small) || /Android|iPhone|iPad|iPod|Mobile|HarmonyOS/i.test(ua);
  }
  function toast(t, c) { try { if (typeof showToast === 'function') showToast(t, c || '#ffcf6e'); } catch (e) {} }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ================= 电脑端：出码 ================= */
  var qrToken = null, qrTimer = null, qrDone = false, qrTick = 0;

  function modalHtml() {
    return '' +
      '<div id="qrModal" class="qr-modal">' +
      '  <div class="qr-box">' +
      '    <div class="qr-head"><b>扫码登录</b><button id="qrClose" type="button">×</button></div>' +
      '    <div class="qr-tip">用<b>手机浏览器</b>打开游戏并登录账号 → 点左上角用户名 → 「扫码登录」→ 扫这个码</div>' +
      '    <div id="qrCodeWrap" class="qr-code"></div>' +
      '    <div id="qrStatus" class="qr-status">正在生成二维码…</div>' +
      '    <div class="qr-acts">' +
      '      <button id="qrRefresh" class="ghost" type="button">刷新二维码</button>' +
      '      <button id="qrCancel" class="ghost" type="button">取消</button>' +
      '    </div>' +
      '  </div>' +
      '</div>';
  }

  function ensureModal() {
    if ($('qrModal')) return $('qrModal');
    var wrap = document.createElement('div');
    wrap.innerHTML = modalHtml();
    document.body.appendChild(wrap.firstChild);
    $('qrClose').addEventListener('click', closeModal);
    $('qrCancel').addEventListener('click', closeModal);
    $('qrRefresh').addEventListener('click', function () { genQR(); });
    return $('qrModal');
  }

  function openModal() { ensureModal().classList.add('open'); genQR(); }
  function closeModal() {
    stopPoll();
    var m = $('qrModal'); if (m) m.classList.remove('open');
    qrToken = null;
  }
  function stopPoll() { if (qrTimer) { clearInterval(qrTimer); qrTimer = null; } }

  function setStatus(html, color) {
    var s = $('qrStatus'); if (!s) return;
    s.innerHTML = html;
    s.style.color = color || '#9fb3c6';
  }

  function genQR() {
    stopPoll();
    qrDone = false; qrTick = 0;
    var wrap = $('qrCodeWrap'); if (wrap) wrap.innerHTML = '';
    setStatus('正在生成二维码…', '#9fb3c6');
    post('new', {}).then(function (d) {
      if (!d || !d.ok || !d.token) { setStatus('生成失败：连不上服务器，稍后再试', '#ff8f6e'); return; }
      qrToken = d.token;
      var url = SCAN_URL + encodeURIComponent(d.token);
      try {
        if (typeof QRCode !== 'undefined') {
          /* eslint-disable no-new */
          new QRCode(wrap, { text: url, width: 208, height: 208, colorDark: '#0d1420', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.M });
        } else {
          throw new Error('no lib');
        }
      } catch (e) {
        wrap.innerHTML = '<div class="qr-fallback">二维码组件没加载出来，<br>用手机打开这个链接也能确认：<br><b>' + esc(url) + '</b></div>';
      }
      setStatus('<i class="dot"></i>等待手机扫码确认（5 分钟内有效）', '#ffd166');
      qrTimer = setInterval(poll, 1500);
      poll();
    }).catch(function () { setStatus('生成失败：连不上服务器，稍后再试', '#ff8f6e'); });
  }

  function poll() {
    if (qrDone || !qrToken) return;
    qrTick++;
    if (qrTick > 220) { stopPoll(); setStatus('二维码已过期，点「刷新二维码」重新生成', '#ff8f6e'); return; }
    post('get', { token: qrToken }).then(function (d) {
      if (qrDone) return;
      if (!d || !d.ok) return;
      if (d.status === 'verified' && d.payload) { qrDone = true; stopPoll(); onVerified(d.payload); }
      else if (d.status === 'expired' || d.status === 'gone') { stopPoll(); setStatus('二维码已过期，点「刷新二维码」重新生成', '#ff8f6e'); }
    }).catch(function () {});
  }

  async function onVerified(pl) {
    setStatus('✅ 已确认，正在登录 <b>' + esc(pl.username || '侠客') + '</b> …', '#7af0c8');
    try { post('del', { token: qrToken }); } catch (e) {}
    try {
      if (!window.SB || !window.SB.auth) throw new Error('网络组件未加载');
      if (!pl.access_token) throw new Error('票据不完整');
      const res = await window.SB.auth.setSession({ access_token: pl.access_token, refresh_token: pl.refresh_token });
      if (res && res.error) throw res.error;
      await new Promise(function (r) { setTimeout(r, 400); });
      if (window.AUTH && window.AUTH.loggedIn && window.Boot) {
        window.Boot.auth();
        setTimeout(function () { closeModal(); }, 300);
        return;
      }
    } catch (e) {
      console.warn('[qr] 直接登录失败', e);
    }
    /* 兜底：刷新一次，会话已经写进 localStorage，会自动登录 */
    setStatus('正在进入…', '#7af0c8');
    setTimeout(function () {
      try { history.replaceState(null, '', location.pathname); } catch (e) {}
      location.replace(location.pathname + '?t=' + Date.now());
    }, 500);
  }

  function buildDeskButton() {
    var lg = $('lgBtn');
    if (!lg || $('authQR')) return;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'authQR';
    btn.className = 'auth-qr';
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><path d="M14 14h3v3h-3zM20 14v3M14 20h7"/></svg><span>扫码登录（手机扫一扫）</span>';
    btn.addEventListener('click', function (e) { e.preventDefault(); openModal(); });
    lg.parentNode.insertBefore(btn, lg);
  }

  /* ================= 手机端：扫码 ================= */
  var scanning = false, scanStream = null, scanRaf = 0;

  function scanHtml() {
    return '' +
      '<div id="qrScan" class="qr-scan">' +
      '  <div class="qs-box">' +
      '    <div class="qs-head"><b>扫码登录</b><button id="qsClose" type="button">取消</button></div>' +
      '    <div class="qs-cam"><video id="qsVideo" playsinline muted></video><div class="qs-frame"></div></div>' +
      '    <div id="qsMsg" class="qs-msg">正在打开相机…</div>' +
      '    <div class="qs-tip">把电脑上的二维码放进框里。<br>扫码后，<b>你这台手机登录的账号</b>会直接登到电脑上。</div>' +
      '  </div>' +
      '</div>';
  }

  function ensureScan() {
    if ($('qrScan')) return $('qrScan');
    var wrap = document.createElement('div');
    wrap.innerHTML = scanHtml();
    document.body.appendChild(wrap.firstChild);
    $('qsClose').addEventListener('click', stopScan);
    return $('qrScan');
  }

  function setMsg(html, color) {
    var m = $('qsMsg'); if (!m) return;
    m.innerHTML = html; m.style.color = color || '#cfe0ee';
  }

  function stopScan() {
    scanning = false;
    if (scanRaf) { cancelAnimationFrame(scanRaf); scanRaf = 0; }
    if (scanStream) { try { scanStream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {} scanStream = null; }
    var el = $('qrScan'); if (el) el.classList.remove('open');
  }

  function startScan() {
    ensureScan().classList.add('open');
    setMsg('正在打开相机…');
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setMsg('这个浏览器不支持调用相机，请用系统相机扫二维码（扫出来会打开游戏并自动确认）', '#ff9a7a');
      return;
    }
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then(function (st) {
        scanStream = st;
        var v = $('qsVideo');
        v.srcObject = st;
        v.setAttribute('playsinline', '');
        v.play().catch(function () {});
        setMsg('对准电脑上的二维码…');
        scanning = true;
        loop();
      })
      .catch(function (e) {
        setMsg('打不开相机（' + (e && e.name ? e.name : '未知') + '）。<br>也可以直接用系统相机扫，扫出来会打开游戏并自动确认。', '#ff9a7a');
      });
  }

  function loop() {
    if (!scanning) return;
    var v = $('qsVideo');
    if (v && v.readyState === v.HAVE_ENOUGH_DATA) {
      var w = v.videoWidth, h = v.videoHeight;
      if (w > 0 && h > 0) {
        var cv = document.createElement('canvas');
        var S = 320;
        cv.width = S; cv.height = Math.round(h * S / w);
        var cc = cv.getContext('2d');
        cc.drawImage(v, 0, 0, cv.width, cv.height);
        var img = cc.getImageData(0, 0, cv.width, cv.height);
        var code = null;
        try { if (typeof jsQR !== 'undefined') code = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' }); } catch (e) {}
        if (code && code.data) {
          var tk = tokenFromUrl(code.data);
          if (tk) { scanning = false; setMsg('识别成功，正在确认…', '#7af0c8'); setTimeout(function () { confirmToken(tk); }, 200); return; }
        }
      }
    }
    scanRaf = requestAnimationFrame(loop);
  }

  function tokenFromUrl(u) {
    try {
      var m = String(u).match(/[?&]qr=([A-Za-z0-9]+)/);
      return m ? m[1] : '';
    } catch (e) { return ''; }
  }

  /* 手机端确认：把本机登录票据交给这个二维码 */
  async function confirmToken(token) {
    try {
      if (!window.SB || !window.SB.auth) { setMsg('网络组件没加载好，刷新页面再试', '#ff9a7a'); return; }
      const res = await window.SB.auth.getSession();
      const sess = res && res.data && res.data.session;
      if (!sess || !sess.user) {
        /* 没登录：记住这个码，跳到登录页，登录完自动回来确认 */
        try { sessionStorage.setItem('wjx_pending_qr', token); } catch (e) {}
        setMsg('你还<b>没登录账号</b>。<br>请先用账号密码登录，登录成功后会自动帮电脑确认。', '#ffd166');
        toast('请先登录游戏账号，登录后会自动完成扫码', '#ffd166');
        setTimeout(function () {
          try { if (window.AUTH && window.AUTH.logout) window.AUTH.logout(); } catch (e) {}
        }, 2200);
        return;
      }
      const meta = sess.user.user_metadata || {};
      const d = await post('put', {
        token: token,
        payload: {
          username: meta.username || meta.name || '',
          uid: sess.user.id || '',
          access_token: sess.access_token || '',
          refresh_token: sess.refresh_token || ''
        }
      });
      try { sessionStorage.removeItem('wjx_pending_qr'); } catch (e) {}
      if (!d || !d.ok) {
        const why = (d && d.reason === 'expired') ? '这个二维码过期了，请在电脑上点「刷新二维码」' :
                    (d && d.reason === 'used') ? '这个码已经用过了' :
                    (d && d.reason === 'gone') ? '二维码无效，请在电脑上重新生成' : '确认失败，请重试';
        if ($('qrScan')) setMsg(why, '#ff9a7a'); else toast(why, '#ff9a7a');
        return;
      }
      const done = '✅ 已确认，电脑正在以「' + esc(meta.username || '你的账号') + '」登录';
      if ($('qrScan')) { setMsg(done, '#7af0c8'); setTimeout(stopScan, 1400); }
      else toast(done, '#7af0c8');
    } catch (e) {
      if ($('qrScan')) setMsg('确认失败：' + esc(e && e.message || e), '#ff9a7a');
      else toast('确认失败', '#ff9a7a');
    }
  }

  function buildPhoneButton() {
    var acc = $('accSwitch');
    if (!acc || $('accQR')) return;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'accQR';
    btn.className = 'ghost hidden';   /* 登录后才显示，和「退出 / 换账号」同步 */
    btn.textContent = '扫码登录';
    btn.addEventListener('click', function () {
      try { if (window.ACCOUNT && window.ACCOUNT.close) window.ACCOUNT.close(); } catch (e) {}
      startScan();
    });
    acc.parentNode.insertBefore(btn, acc);
  }

  /* 用系统相机扫 → 直接带着 ?qr=xxx 打开游戏：自动确认 */
  function bootPending() {
    var tk = '';
    try {
      var m = location.search.match(/[?&]qr=([A-Za-z0-9]+)/);
      if (m) {
        tk = m[1];
        sessionStorage.setItem('wjx_pending_qr', tk);
        try { history.replaceState(null, '', location.pathname); } catch (e) {}
      } else {
        tk = sessionStorage.getItem('wjx_pending_qr') || '';
      }
    } catch (e) { return; }
    if (!tk) return;
    var tries = 0;
    var t = setInterval(function () {
      tries++;
      var logged = !!(window.AUTH && window.AUTH.loggedIn);
      if (logged) {
        clearInterval(t);
        sessionStorage.removeItem('wjx_pending_qr');
        confirmToken(tk);
      } else if (tries > 360) {   /* 3 分钟还没登录就放弃 */
        clearInterval(t);
        sessionStorage.removeItem('wjx_pending_qr');
      }
    }, 500);
  }

  function boot() {
    buildDeskButton();
    buildPhoneButton();
    bootPending();
  }

  window.QRL = {
    openDesk: openModal, closeDesk: closeModal,
    scan: startScan, stopScan: stopScan, confirm: confirmToken,
    isPhone: isPhone
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
