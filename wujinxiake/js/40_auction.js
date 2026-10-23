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

  let tab = 'buy';
  let listings = [];
  let sellPick = -1;
  let loading = false;

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
  function myUid() {
    try { if (window.AUTH && window.AUTH.uid) return window.AUTH.uid; } catch (e) {}
    try {
      let id = localStorage.getItem('wjx_guest_id');
      if (!id) { id = 'guest-' + Math.random().toString(36).slice(2, 10); localStorage.setItem('wjx_guest_id', id); }
      return id;
    } catch (e) { return 'anon'; }
  }
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
    return tierIdx(eq.tier) <= TIER_ORDER.indexOf('legend');
  }
  function itemLabel(eq) {
    const pre = (eq.enhance ? '+' + eq.enhance + ' ' : '') + (eq.amplify ? '增幅' + eq.amplify + ' ' : '');
    return pre + eq.name;
  }

  /* ---------- 面板 ---------- */
  function isOpen() { const el = $('ahPanel'); return !!(el && el.classList.contains('open')); }

  function open() {
    const el = $('ahPanel');
    if (!el) return;
    el.classList.add('open');
    setTab('buy');
    refresh();
  }
  function close() { const el = $('ahPanel'); if (el) el.classList.remove('open'); }

  function setTab(t) {
    tab = t;
    document.querySelectorAll('#ahPanel .ah-tabs button').forEach(function (b) {
      b.classList.toggle('on', b.dataset.tab === t);
    });
    const buy = $('ahList'), sell = $('ahSell');
    if (buy) buy.style.display = t === 'buy' ? '' : 'none';
    if (sell) sell.style.display = t === 'sell' ? '' : 'none';
    if (t === 'sell') renderSell();
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
    const uid = myUid();
    box.innerHTML = listings.map(function (l) {
      const eq = l.item || {};
      const color = TIER_COLOR[eq.tier] || '#dfe6ee';
      const mine = l.seller === uid;
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
          '<div class="ah-meta">' + (ok ? '可上架' : '史诗品质不可上架') + '</div>' +
        '</div>');
    }
    box.innerHTML = '' +
      '<div class="ah-sell-head">背包里的装备（传说及以下可上架）</div>' +
      '<div class="ah-sell-list">' + (rows.length ? rows.join('') : '<div class="ah-empty">背包里没有装备</div>') + '</div>' +
      '<div class="ah-sell-bar">' +
        '<span>售价</span>' +
        '<input id="ahPrice" type="number" min="1" max="100000000" placeholder="输入金币" />' +
        '<button id="ahAdd" class="ah-btn" type="button">上架</button>' +
      '</div>' +
      '<div class="ah-sell-tip" id="ahSellTip">选中一件装备 → 填价格 → 上架</div>';

    box.querySelectorAll('.ah-row.pick').forEach(function (r) {
      r.addEventListener('click', function () {
        const i = r.dataset.i | 0;
        const eq = (player().inventory || [])[i];
        if (!canList(eq)) { tip('这件装备不能上架（只有传说及以下可以）', true); return; }
        sellPick = i;
        box.querySelectorAll('.ah-row.pick').forEach(function (x) { x.classList.remove('on'); });
        r.classList.add('on');
        tip('已选中：' + itemLabel(eq));
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

  /* ---------- 上架 / 购买 / 下架 ---------- */
  function doSell() {
    const p = player();
    if (!p) return;
    const inp = $('ahPrice');
    const price = Math.floor(Number(inp && inp.value) || 0);
    if (sellPick < 0 || !(p.inventory || [])[sellPick]) { tip('先选一件装备', true); return; }
    if (!(price >= 1)) { tip('价格要大于 0', true); return; }
    const eq = p.inventory[sellPick];
    if (!canList(eq)) { tip('这件装备不能上架', true); return; }
    const btn = $('ahAdd');
    if (btn) { btn.disabled = true; btn.textContent = '上架中…'; }

    fetch(apiBase() + '/add', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ item: eq, price: price, seller: myUid(), sellerName: myName() })
    }).then(function (r) { return r.json(); }).then(function (d) {
      if (btn) { btn.disabled = false; btn.textContent = '上架'; }
      if (!d || !d.ok) {
        const why = (d && d.reason) === 'tier-locked' ? '这件品质不能上架' :
                    (d && d.reason) === 'full' ? '交易行满了，稍后再试' : '上架失败，稍后再试';
        tip(why, true);
        return;
      }
      p.inventory.splice(sellPick, 1);
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
      (p.inventory = p.inventory || []).push(d.item);
      save();
      renderGold();
      alert('购买成功：' + itemLabel(d.item) + '（已放进背包）');
      refresh();
    }).catch(function () { alert('购买失败：连不上交易行'); });
  }

  function cancel(id) {
    if (!confirm('下架这件装备？会退回你的背包')) return;
    fetch(apiBase() + '/cancel', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: id, seller: myUid() })
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

  window.AUCTION = { open: open, close: close, isOpen: isOpen, refresh: refresh };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
