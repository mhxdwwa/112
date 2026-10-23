/* ===== 无尽侠客 · 重生丸 =====
   角色被打死时，如果身上还有重生丸，就弹窗询问：
     · 使用 → 原地满血复活（并给 2.5 秒无敌，避免刚站起来又被打死）
     · 不用 → 判定失败，回到「侠途止步」界面
   新角色创建时送 3 枚，数量存在存档字段 p.pills 里。
*/
(function () {
  'use strict';

  function player() {
    try { if (typeof G !== 'undefined' && G && G.player) return G.player; } catch (e) {}
    return null;
  }
  function el(id) { return document.getElementById(id); }

  function isAsking() {
    const box = el('reviveBox');
    return !!(box && box.classList.contains('open'));
  }

  /* 死亡时调用：有重生丸就弹窗并返回 true（表示别急着进结算界面） */
  function ask() {
    const p = player();
    if (!p) return false;
    /* 兜底：新建角色 / 老存档还没写过这个字段时，第一次给 3 枚（用光后是 0，不会再补） */
    if (typeof p.pills !== 'number') p.pills = 3;
    if ((p.pills | 0) <= 0) return false;
    const box = el('reviveBox');
    if (!box) return false;
    const n = el('rvCount');
    if (n) n.textContent = String(p.pills | 0);
    box.classList.add('open');
    try { G.awaitRevive = true; } catch (e) {}
    return true;
  }

  function close() {
    const box = el('reviveBox');
    if (box) box.classList.remove('open');
    try { G.awaitRevive = false; } catch (e) {}
  }

  function use() {
    const p = player();
    if (!p) { close(); return; }
    if ((p.pills | 0) <= 0) { giveUp(); return; }
    p.pills = (p.pills | 0) - 1;
    p.hp = p.maxHp;
    p.mp = Math.max(p.mp | 0, Math.round((p.maxMp | 0) * 0.5));
    p.dead = false;
    p.hurtT = 0;
    p.invuln = Math.max(p.invuln || 0, 2.5);
    close();
    try { gameState = 'playing'; } catch (e) {}
    try { if (window.CloudSave && CloudSave.save) CloudSave.save(); } catch (e) {}
  }

  /* 不用重生丸：判定失败，回城镇（沿用结算界面「返回」的同一条清理路径） */
  function giveUp() {
    const p = player();
    close();
    if (p) {
      p.dead = false;
      p.hp = Math.max(1, Math.round((p.maxHp || 1) * 0.5));
    }
    try {
      if (typeof restoreSingleGIfNeeded === 'function') restoreSingleGIfNeeded();
      if (typeof initTown === 'function') initTown();
      gameState = 'town';
    } catch (e) {
      try { gameState = 'gameover'; } catch (e2) {}
    }
    try { if (window.CloudSave && CloudSave.save) CloudSave.save(); } catch (e) {}
  }

  function boot() {
    const b1 = el('rvUse'), b2 = el('rvGiveUp');
    if (b1) b1.addEventListener('click', use);
    if (b2) b2.addEventListener('click', giveUp);
  }

  window.REVIVE = { ask: ask, use: use, giveUp: giveUp, isAsking: isAsking };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
