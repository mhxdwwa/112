/* ===== 无尽侠客 · 位置中继 + 交易行（Cloudflare Worker + Durable Object） =====
   一、位置中继（WebSocket）
       wss://wscls.cn/api/wjx-relay
       一个全局房间 world，收一条转发给房间内其他人。
       用 Hibernation API（state.acceptWebSocket）：没人发消息时不产生计时费用。
       客户端每 45 秒发一次 "ping"，auto-response 直接回 "pong"，不唤醒对象、不计费。

   二、交易行（HTTP，与消息共用同一个 Durable Object：单线程执行，天然原子）
       GET  /api/wjx-relay/auction/list      → { ok, list:[{id,item,price,seller,sellerName,at}] }
       POST /api/wjx-relay/auction/add       → { ok, id }    body:{item,price,seller,sellerName}
       POST /api/wjx-relay/auction/buy       → { ok, item }  body:{id,buyer,buyerName}
       POST /api/wjx-relay/auction/cancel    → { ok, item }  body:{id,seller}
       POST /api/wjx-relay/auction/history   → { ok, history:[...] }  body:{uid}

   部署路由：wscls.cn/api/wjx-relay*
*/
const ROOM = 'world';
const AK = 'a:';                 /* 交易行存储前缀 */
const HK = 'h:';                 /* 交易记录前缀 */
const MAX_LIST = 400;            /* 最多同时挂多少件，防滥用 */
const MAX_PRICE = 100000000;     /* 单件最高价 */
const MAX_HISTORY = 50;          /* 每个用户最多保留多少条交易记录 */

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'content-type',
      'access-control-allow-methods': 'GET,POST,OPTIONS'
    }
  });
}

export class Room {
  constructor(state) {
    this.state = state;
    try {
      /* 协议层 ping/pong：命中时完全不唤醒对象，不计 CPU、不计时长 */
      state.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
    } catch (e) {}
  }

  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '');

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-headers': 'content-type',
          'access-control-allow-methods': 'GET,POST,OPTIONS'
        }
      });
    }

    /* ---------- 交易行 ---------- */
    if (path.endsWith('/auction/list')) return this.auctionList();
    if (path.endsWith('/auction/add')) return this.auctionAdd(request);
    if (path.endsWith('/auction/buy')) return this.auctionBuy(request);
    if (path.endsWith('/auction/cancel')) return this.auctionCancel(request);
    if (path.endsWith('/auction/history')) return this.auctionHistory(request);
    if (path.endsWith('/auction/claim')) return this.auctionClaim(request);

    /* ---------- WebSocket 位置中继 ---------- */
    if ((request.headers.get('Upgrade') || '').toLowerCase() === 'websocket') {
      const pair = new WebSocketPair();
      const client = pair[0];
      const server = pair[1];
      this.state.acceptWebSocket(server);
      return new Response(null, { status: 101, webSocket: client });
    }

    return new Response('wjx-relay alive', {
      status: 200,
      headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' }
    });
  }

  /* ---------- 交易行实现 ---------- */
  async auctionList() {
    const map = await this.state.storage.list({ prefix: AK, limit: MAX_LIST });
    const list = [];
    for (const [, v] of map) list.push(v);
    list.sort(function (a, b) { return (b.at || 0) - (a.at || 0); });
    return json({ ok: true, list: list, count: list.length });
  }

  async auctionAdd(request) {
    let b;
    try { b = await request.json(); } catch (e) { return json({ ok: false, reason: 'bad-json' }, 400); }
    const item = b && b.item;
    const price = Math.floor(Number(b && b.price) || 0);
    if (!item || !item.name || !item.slot) return json({ ok: false, reason: 'bad-item' }, 400);
    if (!(price > 0 && price <= MAX_PRICE)) return json({ ok: false, reason: 'bad-price' }, 400);
    /* 只允许传说及以下（common/advanced/rare/epic/legend），史诗 mythic 不能挂 */
    const tier = String(item.tier || 'common');
    if (['common', 'advanced', 'rare', 'epic', 'legend'].indexOf(tier) < 0) {
      return json({ ok: false, reason: 'tier-locked' }, 400);
    }
    const all = await this.state.storage.list({ prefix: AK, limit: MAX_LIST + 1 });
    if (all.size >= MAX_LIST) return json({ ok: false, reason: 'full' }, 400);

    const id = crypto.randomUUID();
    const rec = {
      id: id,
      item: item,
      price: price,
      seller: String(b.seller || ''),
      sellerName: String(b.sellerName || '侠客').slice(0, 24),
      at: Date.now()
    };
    await this.state.storage.put(AK + id, rec);
    return json({ ok: true, id: id, listing: rec });
  }

  async auctionBuy(request) {
    let b;
    try { b = await request.json(); } catch (e) { return json({ ok: false, reason: 'bad-json' }, 400); }
    const id = String((b && b.id) || '');
    if (!id) return json({ ok: false, reason: 'bad-id' }, 400);
    const key = AK + id;
    const rec = await this.state.storage.get(key);
    if (!rec) return json({ ok: false, reason: 'gone' }, 200);
    if (rec.seller && b.buyer && rec.seller === b.buyer) {
      return json({ ok: false, reason: 'own' }, 200);   /* 不能买自己的 */
    }
    /* Durable Object 单线程 + 输入闸门：get 与 delete 之间不会插入其它请求，天然防重复购买 */
    await this.state.storage.delete(key);
    
    /* ★ 记录交易历史：给卖家和买家各存一条 */
    const historyRec = {
      id: id,
      item: rec.item,
      price: rec.price,
      seller: rec.seller,
      sellerName: rec.sellerName,
      buyer: String(b.buyer || ''),
      buyerName: String(b.buyerName || '侠客').slice(0, 24),
      at: Date.now(),
      type: 'sold'
    };
    /* 卖家记录 */
    if (rec.seller) {
      await this.addToHistory(rec.seller, { ...historyRec, role: 'seller' });
    }
    /* 买家记录 */
    if (b.buyer) {
      await this.addToHistory(b.buyer, { ...historyRec, role: 'buyer' });
    }
    
    /* ★ 同时把钱存到账本里，等卖家来领 */
    const claimKey = 'c:' + rec.seller;
    const existing = await this.state.storage.get(claimKey) || { gold: 0, sales: [] };
    existing.gold += rec.price;
    existing.sales.push({ name: rec.item.name, price: rec.price, buyerName: b.buyerName, at: Date.now() });
    await this.state.storage.put(claimKey, existing);
    
    return json({ ok: true, item: rec.item, price: rec.price, seller: rec.seller, sellerName: rec.sellerName });
  }

  /* ★ 添加交易记录到用户历史 */
  async addToHistory(uid, rec) {
    const hKey = HK + uid;
    const list = await this.state.storage.get(hKey) || [];
    list.unshift(rec);
    /* 只保留最近的 MAX_HISTORY 条 */
    if (list.length > MAX_HISTORY) list.length = MAX_HISTORY;
    await this.state.storage.put(hKey, list);
  }

  /* ★ 获取交易历史 */
  async auctionHistory(request) {
    let b;
    try { b = await request.json(); } catch (e) { return json({ ok: false, reason: 'bad-json' }, 400); }
    const uid = String((b && b.uid) || '');
    if (!uid) return json({ ok: false, reason: 'no-uid' }, 400);
    const hKey = HK + uid;
    const list = await this.state.storage.get(hKey) || [];
    return json({ ok: true, history: list });
  }

  /* ★ 卖家领取卖出的金币 */
  async auctionClaim(request) {
    let b;
    try { b = await request.json(); } catch (e) { return json({ ok: false, reason: 'bad-json' }, 400); }
    const sellers = (b && b.sellers) || [];
    if (!sellers.length) return json({ ok: true, gold: 0 });
    let totalGold = 0;
    let allSales = [];
    for (const uid of sellers) {
      const claimKey = 'c:' + uid;
      const rec = await this.state.storage.get(claimKey);
      if (rec && rec.gold > 0) {
        totalGold += rec.gold;
        allSales = allSales.concat(rec.sales || []);
        await this.state.storage.delete(claimKey);
      }
    }
    return json({ ok: true, gold: totalGold, sales: allSales });
  }

  async auctionCancel(request) {
    let b;
    try { b = await request.json(); } catch (e) { return json({ ok: false, reason: 'bad-json' }, 400); }
    const id = String((b && b.id) || '');
    if (!id) return json({ ok: false, reason: 'bad-id' }, 400);
    const key = AK + id;
    const rec = await this.state.storage.get(key);
    if (!rec) return json({ ok: false, reason: 'gone' }, 200);
    if (!b.seller || rec.seller !== b.seller) return json({ ok: false, reason: 'not-yours' }, 200);
    await this.state.storage.delete(key);
    return json({ ok: true, item: rec.item });
  }

  /* ---------- 位置中继 ---------- */
  webSocketMessage(ws, message) {
    if (typeof message !== 'string') return;
    if (message === 'ping') return;              /* 已由 auto-response 处理 */
    if (message.length > 4096) return;           /* 防滥用 */

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
    const id = env.ROOM.idFromName(ROOM);
    return env.ROOM.get(id).fetch(request);
  }
};
