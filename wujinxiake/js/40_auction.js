/* ===== 无尽侠客 · 交易行 =====
   后端：Cloudflare Worker（wjx-relay 的 Durable Object）里的 auction/* 接口，
        与位置中继共用同一个对象，所以「同一件装备只能被买走一次」是天然的原子操作。
   规则：
     · 只有「传说及以下」（普通/高级/稀有/神器/传说）能上架，史诗不能上架
     · 上架时把装备从背包里拿出来，取消上架会退回背包
     · 购买直接扣金币，装备进背包
*/
(function () {
  'use strict';

  const $ = function (id) { return document.getElementById(id); };
  const TIER_ORDER = ['common', 'advanced', 'rare', 'epic', 'legend', 'mythic'];
  const TIER_COLOR = {
    common: '#dfe6ee', advanced: '#5aa9ff', rare: '#b57bff',
    epic: '#ff5fa2', legend: '#ff9f43', mythic: '#ffd166'
  };
  const SLOT_CN = {
    weapon: '武器', head: '头饰', armor: '上衣', shoes: '鞋',
    necklace: '项链', ring: '戒指', bracer: '护腕', accessory: '戒指', mount: '飞行道具'
  };

  /* 强化 / 增幅材料：史诗级（高级强化石、史诗增幅石）不可交易 */
  const MAT_META = {
    enhance_stone_low:    { name: '下级强化石', color: '#cfd8e3', trade: true },
    enhance_stone_mid:    { name: '中级强化石', color: '#5aa9ff', trade: true },
    enhance_stone_high:   { name: '高级强化石', color: '#ff9f43', trade: false },
    chaos_stone:          { name: '混沌魔石',   color: '#b57bff', trade: true },
    amplify_stone_common: { name: '普通增幅石', color: '#cfd8e3', trade: true },
    amplify_stone_advanced:{ name: '高级增幅石', color: '#5aa9ff', trade: true },
    amplify_stone_rare:   { name: '稀有增幅石', color: '#b57bff', trade: true },
    amplify_stone_epic:   { name: '神器增幅石', color: '#ff5fa2', trade: true },
    amplify_stone_legend: { name: '传说增幅石', color: '#ff9f43', trade: true },
    amplify_stone_mythic: { name: '史诗增幅石', color: '#ffd166', trade: false }
  };

  let tab = 'buy';
  let listings = [];
  let sellPick = -1;
  let loading = false;
  let history = [];
  let historyLoaded = false;

  function apiBase() {
    const host = location.hostname;
    if (!host || host === '127.0.0.1' || host === 'localhost') {
      return 'https://wscls.cn/api/wjx-relay/auction';
    }
    return location.origin + '/api/wjx-relay/auction';
  }

  function player() {
    try { if (typeof G !== 'undefined' && G && G.player) return G.player; } catch (e) {}
    return null;
  }
  /* ★ 卖家身份：可能同时有「账号 uid」和「本机游客 id」两个，
     两个都要记住 —— 之前挂单是游客身份、后来登录了，也要能领到钱、能下架 */
  function myUids(){
    const out = [];
    try { if (window.AUTH && window.AUTH.uid) out.push(String(window.AUTH.uid)); } catch (e) {}
    let g = '';
    try {
      g = localStorage.getItem('wjx_guest_id') || '';
      if (!g) { g = 'guest-' + Math.random().toString(36).slice(2, 10); localStorage.setItem('wjx_guest_id', g); }
    } catch (e) { g = 'anon'; }
    if (g) out.push(g);
    try {
      const extra = JSON.parse(localStorage.getItem('wjx_trade_uids') || '[]');
      for (let i = 0; i < extra.length; i++) if (extra[i] && out.indexOf(String(extra[i])) < 0) out.push(String(extra[i]));
    } catch (e) {}
    try { localStorage.setItem('wjx_trade_uids', JSON.stringify(out.slice(0, 8))); } catch (e) {}
    return out;
  }
  function myUid() { return myUids()[0]; }
  function myName() {
    const p = player();
    if (p && p.name) return p.name;
    try { if (window.CHARS && CHARS.active && CHARS.active()) return CHARS.active().name; } catch (e) {}
    return '侠客';
  }
  function gold() { const p = player(); return p ? (p.gold | 0) : 0; }
  function save() {
    try { if (window.CloudSave && CloudSave.save) CloudSave.save(); } catch (e) {}
  }

  function tierIdx(t) { const i = TIER_ORDER.indexOf(String(t || 'common')); return i < 0 ? 0 : i; }
  function canList(eq) {
    if (!eq || !eq.name || !eq.slot) return false;
    if (eq.locked) return false;
    if (eq.tier === 'mythic') return false;      /* 史诗不可交易 */
    if (eq.sealed === false && tierIdx(eq.tier) >= 2) return false;   /* 紫以上开封后不可上架 */
    return tierIdx(eq.tier) <= TIER_ORDER.indexOf('legend');
  }
  function noTradeWhy(eq){
    if (!eq) return '';
    if (eq.tier === 'mythic') return '史诗装备不可交易';
    if (eq.sealed === false && tierIdx(eq.tier) >= 2) return '已开封 · 不能上架';
    return '不可上架';
  }
  function isMat(eq){ return !!(eq && eq.kind === 'material'); }
  function itemLabel(eq) {
    if (isMat(eq)) {
      const m = MAT_META[eq.matId] || {};
      return (m.name || eq.name || '材料') + ' ×' + (eq.qty | 0);
    }
    const pre = (eq.enhance ? '+' + eq.enhance + ' ' : '') + (eq.amplify ? '增幅' + eq.amplify + ' ' : '');
    return pre + eq.name + (eq.sealed ? '（未开封）' : '');
  }

  /* ---------- 面板 ---------- */
  function isOpen() { const el = $('ahPanel'); return !!(el && el.classList.contains('open')); }

  function open() {
    const el = $('ahPanel');
    if (!el) return;
    el.classList.add('open');
    setTab('buy');
    refresh();
    claim();          /* ★ 打开就顺手把「卖出去的钱」领回来 */
    loadHistory();    /* ★ 预加载交易历史 */
  }
  function close() { const el = $('ahPanel'); if (el) el.classList.remove('open'); }

  function setTab(t) {
    tab = t;
    document.querySelectorAll('#ahPanel .ah-tabs button').forEach(function (b) {
      b.classList.toggle('on', b.dataset.tab === t);
    });
    const buy = $('ahList'), sell = $('ahSell'), hist = $('ahHistory');
    if (buy) buy.style.display = t === 'buy' ? '' : 'none';
    if (sell) sell.style.display = t === 'sell' ? '' : 'none';
    if (hist) hist.style.display = t === 'history' ? '' : 'none';
    if (t === 'sell') renderSell();
    if (t === 'history') loadHistory();
  }

  function refresh() {
    const box = $('ahList');
    if (!box) return;
    loading = true;
    if (!listings.length) box.innerHTML = '<div class="ah-empty">正在读取商品…</div>';
    fetch(apiBase() + '/list', { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        loading = false;
        listings = (d && d.list) || [];
        renderList();
        renderGold();
      })
      .catch(function () {
        loading = false;
        box.innerHTML = '<div class="ah-empty">交易行连不上，检查一下网络（或稍后再试）</div>';
      });
  }

  function renderGold() {
    const g = $('ahGold');
    if (g) g.textContent = '金币 ' + gold().toLocaleString('zh-CN');
  }

  function renderList() {
    const box = $('ahList');
    if (!box) return;
    if (!listings.length) {
      box.innerHTML = '<div class="ah-empty">还没有人上架装备，你可以先去「我要上架」</div>';
      return;
    }
    const mineUids = myUids();
    box.innerHTML = listings.map(function (l) {
      const eq = l.item || {};
      const color = isMat(eq) ? ((MAT_META[eq.matId] || {}).color || '#cfd8e3') : (TIER_COLOR[eq.tier] || '#dfe6ee');
      const mine = mineUids.indexOf(String(l.seller || '')) >= 0;
      const price = (l.price | 0).toLocaleString('zh-CN');
      return '' +
        '<div class="ah-row" data-id="' + l.id + '">' +
          '<div class="ah-name" style="color:' + color + '">' + esc(itemLabel(eq)) +
            '<em>· ' + esc(SLOT_CN[eq.slot] || eq.slot) + (eq.level ? ' · Lv.' + (eq.level | 0) : '') + '</em>' +
          '</div>' +
          '<div class="ah-meta">卖家 ' + esc(l.sellerName || '侠客') + (mine ? '（你）' : '') + '</div>' +
          '<div class="ah-price">' + price + ' 金币</div>' +
          (mine
            ? '<button class="ah-btn ghost" data-act="cancel" data-id="' + l.id + '">下架</button>'
            : '<button class="ah-btn" data-act="buy" data-id="' + l.id + '">购买</button>') +
        '</div>';
    }).join('');

    box.querySelectorAll('button[data-act]').forEach(function (b) {
      b.addEventListener('click', function () {
        if (b.dataset.act === 'buy') buy(b.dataset.id);
        else cancel(b.dataset.id);
      });
    });
  }

  /* ★ 加载交易历史 */
  function loadHistory() {
    const uid = myUid();
    if (!uid) return;
    fetch(apiBase() + '/history', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ uid: uid })
    }).then(function (r) { return r.json(); }).then(function (d) {
      if (d && d.ok) {
        history = d.history || [];
        historyLoaded = true;
        renderHistory();
      }
    }).catch(function () {});
  }

  /* ★ 渲染交易历史 */
  function renderHistory() {
    const box = $('ahHistory');
    if (!box) return;
    if (!history.length) {
      box.innerHTML = '<div class="ah-empty">暂无交易记录</div>';
      return;
    }
    box.innerHTML = history.map(function (h) {
      const eq = h.item || {};
      const color = isMat(eq) ? ((MAT_META[eq.matId] || {}).color || '#cfd8e3') : (TIER_COLOR[eq.tier] || '#dfe6ee');
      const isSell = h.role === 'seller';
      const action = isSell ? '卖出' : '买入';
      const actionColor = isSell ? '#5ee08a' : '#7fb8ff';
      const other = isSell ? (h.buyerName || '侠客') : (h.sellerName || '侠客');
      const time = new Date(h.at).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
      return '' +
        '<div class="ah-row hist">' +
          '<div class="ah-name" style="color:' + color + '">' + esc(itemLabel(eq)) +
            '<em>· ' + esc(SLOT_CN[eq.slot] || eq.slot) + (eq.level ? ' · Lv.' + (eq.level | 0) : '') + '</em>' +
          '</div>' +
          '<div class="ah-meta"><span style="color:' + actionColor + '">' + action + '</span> ' +
            (isSell ? '给' : '自') + ' <b>' + esc(other) + '</b> · ' + time +
          '</div>' +
          '<div class="ah-price" style="color:' + (isSell ? '#5ee08a' : '#ff9a7a') + '">' +
            (isSell ? '+' : '-') + (h.price | 0).toLocaleString('zh-CN') + ' 金币' +
          '</div>' +
        '</div>';
    }).join('');
  }

  function matCount(p, id) {
    if (id.indexOf('amplify_') === 0) return (p.amplifyStones || {})[id] | 0;
    return (p.materials || {})[id] | 0;
  }
  function matTake(p, id, n) {
    if (id.indexOf('amplify_') === 0) p.amplifyStones[id] = (p.amplifyStones[id] | 0) - n;
    else p.materials[id] = (p.materials[id] | 0) - n;
  }
  function matGive(p, id, n) {
    if (id.indexOf('amplify_') === 0) { if (!p.amplifyStones) p.amplifyStones = {}; p.amplifyStones[id] = (p.amplifyStones[id] | 0) + n; }
    else { if (!p.materials) p.materials = {}; p.materials[id] = (p.materials[id] | 0) + n; }
  }

  function renderSell() {
    const box = $('ahSell');
    if (!box) return;
    const p = player();
    if (!p) { box.innerHTML = '<div class="ah-empty">先进入城镇再来上架</div>'; return; }
    const inv = p.inventory || [];
    for (let i = 0; i < inv.length; i++) if (inv[i] && inv[i].__sellId) delete inv[i].__sellId;
    const rows = [];
    for (let i = 0; i < inv.length; i++) {
      const eq = inv[i];
      if (!eq || !eq.name) continue;
      const ok = canList(eq);
      const color = TIER_COLOR[eq.tier] || '#dfe6ee';
      rows.push('' +
        '<div class="ah-row pick' + (i === sellPick ? ' on' : '') + (ok ? '' : ' off') + '" data-i="' + i + '">' +
          '<div class="ah-name" style="color:' + color + '">' + esc(itemLabel(eq)) +
            '<em>· ' + esc(SLOT_CN[eq.slot] || eq.slot) + (eq.level ? ' · Lv.' + (eq.level | 0) : '') + '</em>' +
          '</div>' +
          '<div class="ah-meta">' + (ok ? '可上架' : noTradeWhy(eq)) + '</div>' +
        '</div>');
    }
    /* 材料：强化石 / 增幅石 / 混沌魔石，史诗级材料不可交易 */
    const matRows = [];
    Object.keys(MAT_META).forEach(function (id) {
      const n = matCount(p, id);
      if (n <= 0) return;
      const ok = !!MAT_META[id].trade;
      const key = 'm:' + id;
      matRows.push('' +
        '<div class="ah-row pick' + (sellPick === key ? ' on' : '') + (ok ? '' : ' off') + '" data-mat="' + id + '">' +
          '<div class="ah-name" style="color:' + MAT_META[id].color + '">' + esc(MAT_META[id].name) +
            '<em>· 材料 × ' + n + '</em>' +
          '</div>' +
          '<div class="ah-meta">' + (ok ? '可上架' : '史诗级材料 · 不可交易') + '</div>' +
        '</div>');
    });

    box.innerHTML = '' +
      '<div class="ah-sell-head">背包里的装备（传说及以下 · 需未开封）</div>' +
      '<div class="ah-sell-list">' + (rows.length ? rows.join('') : '<div class="ah-empty">背包里没有装备</div>') + '</div>' +
      '<div class="ah-sell-head">材料（强化 / 增幅）</div>' +
      '<div class="ah-sell-list">' + (matRows.length ? matRows.join('') : '<div class="ah-empty">没有可上架的材料</div>') + '</div>' +
      '<div class="ah-sell-bar">' +
        '<span>数量</span><input id="ahQty" type="number" min="1" max="999" value="1" style="width:64px" />' +
        '<span>售价</span>' +
        '<input id="ahPrice" type="number" min="1" max="100000000" placeholder="输入金币" />' +
        '<button id="ahAdd" class="ah-btn" type="button">上架</button>' +
      '</div>' +
      '<div class="ah-sell-tip" id="ahSellTip">选中一件装备或材料 → 填价格 → 上架（材料可填数量）</div>';

    box.querySelectorAll('.ah-row.pick[data-i]').forEach(function (r) {
      r.addEventListener('click', function () {
        const i = r.dataset.i | 0;
        const eq = (player().inventory || [])[i];
        if (!canList(eq)) { tip(noTradeWhy(eq) || '这件装备不能上架', true); return; }
        sellPick = i;
        box.querySelectorAll('.ah-row.pick').forEach(function (x) { x.classList.remove('on'); });
        r.classList.add('on');
        tip('已选中：' + itemLabel(eq));
      });
    });
    box.querySelectorAll('.ah-row.pick[data-mat]').forEach(function (r) {
      r.addEventListener('click', function () {
        const id = r.dataset.mat;
        if (!MAT_META[id] || !MAT_META[id].trade) { tip('史诗级材料不可交易', true); return; }
        sellPick = 'm:' + id;
        box.querySelectorAll('.ah-row.pick').forEach(function (x) { x.classList.remove('on'); });
        r.classList.add('on');
        tip('已选中：' + MAT_META[id].name + ' × ' + matCount(player(), id));
      });
    });
    const add = $('ahAdd');
    if (add) add.addEventListener('click', doSell);
  }

  function tip(msg, bad) {
    const el = $('ahSellTip');
    if (!el) return;
    el.textContent = msg;
    el.style.color = bad ? '#ff9a7a' : '#8fa5ba';
  }

  /* ---------- 卖家收款 ----------
     卖出瞬间买家扣了金币、卖家却不在同一个客户端，所以钱先存在
     Worker 的账本里；卖家下次打开交易行（或任意时刻调用）领走。 */
  var claimBusy = false;
  function claim() {
    if (claimBusy) return;
    claimBusy = true;
    fetch(apiBase() + '/claim', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sellers: myUids() })
    }).then(function (r) { return r.json(); }).then(function (d) {
      claimBusy = false;
      if (!d || !d.ok || !(d.gold > 0)) return;
      const p = player();
      if (!p) return;
      p.gold = (p.gold | 0) + (d.gold | 0);
      save();
      renderGold();
      let msg = '交易行到账 +' + (d.gold | 0).toLocaleString('zh-CN') + ' 金币';
      const s = (d.sales && d.sales[0]) || null;
      if (s) msg += '（' + (s.name || '物品') + ' 被 ' + (s.buyerName || '侠客') + ' 买走）';
      try { if (typeof showToast === 'function') showToast(msg, '#ffd166'); } catch (e) {}
      try { alert(msg); } catch (e) {}
    }).catch(function () { claimBusy = false; });
  }

  /* ---------- 上架 / 购买 / 下架 ---------- */
  function doSell() {
    const p = player();
    if (!p) return;
    const inp = $('ahPrice');
    const price = Math.floor(Number(inp && inp.value) || 0);
    if (!(price >= 1)) { tip('价格要大于 0', true); return; }

    let payloadItem = null, takeFn = null;
    if (typeof sellPick === 'string' && sellPick.indexOf('m:') === 0) {
      const id = sellPick.slice(2);
      const have = matCount(p, id);
      const qty = Math.max(1, Math.min(have, Math.floor(Number(($('ahQty') || {}).value) || 1)));
      if (!MAT_META[id] || !MAT_META[id].trade) { tip('史诗级材料不可交易', true); return; }
      if (!(have >= qty)) { tip('数量不足', true); return; }
      payloadItem = { kind: 'material', matId: id, name: MAT_META[id].name, qty: qty, tier: 'common' };
      takeFn = function () { matTake(p, id, qty); };
    } else {
      const i = sellPick | 0;
      const eq = (p.inventory || [])[i];
      if (!eq) { tip('先选一件装备', true); return; }
      if (!canList(eq)) { tip(noTradeWhy(eq) || '这件装备不能上架', true); return; }
      payloadItem = eq;
      takeFn = function () { p.inventory.splice(i, 1); };
    }

    const btn = $('ahAdd');
    if (btn) { btn.disabled = true; btn.textContent = '上架中…'; }

    fetch(apiBase() + '/add', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ item: payloadItem, price: price, seller: myUid(), sellerName: myName() })
    }).then(function (r) { return r.json(); }).then(function (d) {
      if (btn) { btn.disabled = false; btn.textContent = '上架'; }
      if (!d || !d.ok) {
        const why = (d && d.reason) === 'tier-locked' ? '这件物品不能上架（史诗级不可交易）' :
                    (d && d.reason) === 'unsealed' ? '已开封的装备不能上架' :
                    (d && d.reason) === 'full' ? '交易行满了，稍后再试' : '上架失败，稍后再试';
        tip(why, true);
        return;
      }
      takeFn();
      sellPick = -1;
      save();
      tip('已上架成功');
      if (inp) inp.value = '';
      renderSell();
      refresh();
    }).catch(function () {
      if (btn) { btn.disabled = false; btn.textContent = '上架'; }
      tip('上架失败：连不上交易行', true);
    });
  }

  function buy(id) {
    const p = player();
    if (!p) return;
    const l = listings.filter(function (x) { return x.id === id; })[0];
    if (!l) return;
    if (gold() < (l.price | 0)) { alert('金币不够（需要 ' + l.price + '，你有 ' + gold() + '）'); return; }
    if (!confirm('购买「' + itemLabel(l.item) + '」？\n将花费 ' + l.price + ' 金币')) return;

    fetch(apiBase() + '/buy', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: id, buyer: myUid(), buyerName: myName() })
    }).then(function (r) { return r.json(); }).then(function (d) {
      if (!d || !d.ok) {
        const why = (d && d.reason) === 'gone' ? '这件已经被别人买走了' :
                    (d && d.reason) === 'own' ? '这是你自己上架的' : '购买失败';
        alert(why);
        refresh();
        return;
      }
      p.gold = Math.max(0, (p.gold | 0) - (d.price | 0));
      if (isMat(d.item)) {
        matGive(p, d.item.matId, d.item.qty | 0);
        save();
        renderGold();
        alert('购买成功：' + itemLabel(d.item) + '（已放入材料栏）');
      } else {
        (p.inventory = p.inventory || []).push(d.item);
        save();
        renderGold();
        alert('购买成功：' + itemLabel(d.item) + '（已放进背包）');
      }
      refresh();
    }).catch(function () { alert('购买失败：连不上交易行'); });
  }

  function cancel(id) {
    if (!confirm('下架这件装备？会退回你的背包')) return;
    fetch(apiBase() + '/cancel', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: id, seller: myUid(), sellers: myUids() })
    }).then(function (r) { return r.json(); }).then(function (d) {
      if (!d || !d.ok) { alert('下架失败'); refresh(); return; }
      const p = player();
      if (p) { (p.inventory = p.inventory || []).push(d.item); save(); }
      refresh();
    }).catch(function () { alert('下架失败：连不上交易行'); });
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ---------- 事件 ---------- */
  function boot() {
    const closeBtn = $('ahClose');
    if (closeBtn) closeBtn.addEventListener('click', close);
    /* 面板开着时每 60 秒看一次有没有新的卖出款到账 */
    setInterval(function(){ if (isOpen()) claim(); }, 60000);
    document.querySelectorAll('#ahPanel .ah-tabs button').forEach(function (b) {
      b.addEventListener('click', function () { setTab(b.dataset.tab); });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && isOpen()) { close(); e.stopPropagation(); return; }
      if ((e.code === 'KeyT') && !e.repeat) {
        if (typeof gameState === 'undefined' || gameState !== 'town') return;
        if (isOpen()) close(); else open();
      }
    }, true);
  }

  window.AUCTION = { open: open, close: close, isOpen: isOpen, refresh: refresh, claim: claim };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
