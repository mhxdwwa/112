/* ===== 位置中继通道（Cloudflare Worker + Durable Object） =====
   作用：把位置/聊天/切磋这类「喊一声」的消息从 Supabase Realtime 挪走，
         Supabase 只留账号、存档、在线名单 —— 实时消息额度基本不再消耗。

   用法（在 36_online.js 里）：
     RELAY.send({e:'pos', p:{...}})     → 发出去（返回 false 表示没连上，调用方回退 Supabase）
     RELAY.on('pos', function(p){...})  → 收到别人的消息（p 是 payload）
     RELAY.ok                           → 当前是否已连上

   设计要点：
     · 断线自动重连（1s → 2s → 4s … 最多 30s 退避）
     · 45 秒发一次 "ping"，Worker 用 auto-response 回 "pong"，不产生费用
     · 连不上就当没有这层，游戏照旧走 Supabase，不会卡住
*/
(function () {
  'use strict';

  const URL = 'wss://wscls.cn/api/wjx-relay';
  const PING_MS = 45000;

  let ws = null;
  let connected = false;
  let retry = 0;
  let retryTimer = null;
  let pingTimer = null;
  let paused = false;
  const handlers = {};

  function emit(ev, payload) {
    const list = handlers[ev];
    if (!list) return;
    for (let i = 0; i < list.length; i++) {
      try { list[i](payload); } catch (e) { /* 单个处理器出错不影响其他人 */ }
    }
  }

  function scheduleRetry() {
    if (paused) return;
    const wait = Math.min(30000, 1000 * Math.pow(2, Math.min(retry++, 5)));
    clearTimeout(retryTimer);
    retryTimer = setTimeout(connect, wait);
  }

  function connect() {
    if (paused) return;
    if (ws && (ws.readyState === 0 || ws.readyState === 1)) return;
    let sock;
    try { sock = new WebSocket(URL); } catch (e) { scheduleRetry(); return; }
    ws = sock;

    sock.onopen = function () {
      connected = true;
      retry = 0;
      try {
        sock.send(JSON.stringify({ e: 'hi', p: { t: Date.now() } }));
      } catch (e) {}
      if (pingTimer) clearInterval(pingTimer);
      pingTimer = setInterval(function () {
        if (sock.readyState === 1) { try { sock.send('ping'); } catch (e) {} }
      }, PING_MS);
    };

    sock.onmessage = function (ev) {
      const raw = ev && ev.data;
      if (typeof raw !== 'string' || raw === 'pong') return;
      if (raw.charAt(0) !== '{') return;
      let m;
      try { m = JSON.parse(raw); } catch (e) { return; }
      if (!m || !m.e) return;
      emit(m.e, m.p);
    };

    sock.onclose = function () {
      connected = false;
      ws = null;
      if (pingTimer) { clearInterval(pingTimer); pingTimer = null; }
      scheduleRetry();
    };

    sock.onerror = function () { connected = false; };
  }

  function send(msg) {
    if (!ws || ws.readyState !== 1) return false;
    try { ws.send(JSON.stringify(msg)); return true; } catch (e) { return false; }
  }

  function on(ev, fn) {
    (handlers[ev] = handlers[ev] || []).push(fn);
  }

  /* 切到后台时不重连，回来立刻重连：省手机电量和流量 */
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { paused = true; }
    else {
      paused = false;
      retry = 0;
      connect();
    }
  });

  window.RELAY = {
    connect: connect,
    send: send,
    on: on,
    get ok() { return connected; },
    get url() { return URL; },
    stats() {
      return { connected: connected, readyState: ws ? ws.readyState : -1, retry: retry };
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', connect);
  } else {
    connect();
  }
})();
