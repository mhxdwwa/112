/* ===== 无尽侠客 · 位置中继（Cloudflare Worker + Durable Object） =====
   目的：把「位置广播」从 Supabase Realtime 挪出来，几乎不花额度。
   · 一个全局房间 world，所有人都在里面
   · 用 Hibernation API（state.acceptWebSocket）：没人发消息时不产生计时费用
   · 收一条消息 → 原样转发给房间内其他人（不做任何解析，最省 CPU）
   · 客户端每 45 秒发一次字符串 "ping"，用 auto-response 直接回 "pong"，
     既保活又不唤醒对象、不产生额外费用

   部署路由：wscls.cn/api/wjx-relay*  （WebSocket 地址 wss://wscls.cn/api/wjx-relay）
*/
const ROOM = 'world';

export class Room {
  constructor(state) {
    this.state = state;
    try {
      /* 协议层 ping/pong：命中时完全不唤醒对象，不计 CPU、不计时长 */
      state.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
    } catch (e) {}
  }

  async fetch(request) {
    if ((request.headers.get('Upgrade') || '').toLowerCase() !== 'websocket') {
      return new Response('wjx-relay alive', {
        status: 200,
        headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' }
      });
    }
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    this.state.acceptWebSocket(server);
    return new Response(null, { status: 101, webSocket: client });
  }

  webSocketMessage(ws, message) {
    if (typeof message !== 'string') return;
    if (message === 'ping') return;              /* 已由 auto-response 处理 */
    if (message.length > 4096) return;           /* 防滥用 */

    /* 原样转发给房间里除自己以外的所有人 */
    const all = this.state.getWebSockets();
    for (let i = 0; i < all.length; i++) {
      const other = all[i];
      if (other === ws) continue;
      try { other.send(message); } catch (e) {}
    }
  }

  webSocketClose(ws, code, reason) {
    try { ws.close(code, reason); } catch (e) {}
  }

  webSocketError(ws) {
    try { ws.close(); } catch (e) {}
  }
}

export default {
  async fetch(request, env) {
    const upgrade = (request.headers.get('Upgrade') || '').toLowerCase();
    if (upgrade !== 'websocket') {
      return new Response('wjx-relay alive', {
        status: 200,
        headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' }
      });
    }
    const id = env.ROOM.idFromName(ROOM);
    return env.ROOM.get(id).fetch(request);
  }
};
