/* ============================================================
   药 水 系 统（回血瓶 / 回蓝瓶）
   ------------------------------------------------------------
   模仿 DNF：
     · 按等级分 6 档（新手 / 下级 / 中级 / 上级 / 特级 / 大师）
     · 回复量 = 最大生命（法力）的百分比，档位越高回得越多
     · 同类药水有冷却（默认 10 秒），战斗里不能无限灌
     · 存在 p.potions = { hp3: 12, mp2: 5 }，冷却记在 p.potionCd
   ============================================================ */
(function(){
  'use strict';

  function now(){ return Date.now(); }

  function potions(p){ if(!p.potions) p.potions = {}; return p.potions; }
  function count(p, id){ return (p && p.potions && p.potions[id]) | 0; }
  function total(p, kind){
    const m = (p && p.potions) || {};
    let n = 0;
    for(const k in m){ if(k.indexOf(kind) === 0) n += m[k] | 0; }
    return n;
  }

  /* 冷却：p.potionCd = { hp: 毫秒时间戳, mp: 毫秒时间戳 } */
  function cdLeft(p, kind){
    if(!p.potionCd) p.potionCd = { hp:0, mp:0 };
    const t = p.potionCd[kind] || 0;
    const s = (t - now()) / 1000;
    return s > 0 ? s : 0;
  }

  /* 自动挑一瓶：优先高档位（血少了先喝高档的，避免浪费低档） */
  function best(p, kind){
    const m = (p && p.potions) || {};
    let pickId = '', pickG = -1;
    for(const k in m){
      if(k.indexOf(kind) !== 0) continue;
      if((m[k] | 0) <= 0) continue;
      const g = potionGradeOf(k);
      if(g > pickG){ pickG = g; pickId = k; }
    }
    return pickId || '';
  }

  function use(p, id){
    if(!p) return { ok:false, msg:'还没有进入角色' };
    if(!id){
      /* 没指定就自动：血瓶优先 */
      id = best(p, 'hp') || best(p, 'mp');
    }
    if(!id) return { ok:false, msg:'没有可用的药水' };
    const meta = potionMeta(id);
    if(count(p, id) <= 0) return { ok:false, msg:'没有' + meta.name + '了' };
    const kind = meta.kind;
    const cd = cdLeft(p, kind);
    if(cd > 0) return { ok:false, msg:(kind === 'hp' ? '血瓶' : '蓝瓶') + '冷却中（' + cd.toFixed(1) + 's）' };

    const maxV = kind === 'hp' ? (p.maxHp || 0) : (p.maxMp || 0);
    const gain = Math.max(1, Math.round(maxV * meta.pct));
    if(kind === 'hp'){
      const before = p.hp || 0;
      p.hp = Math.min(maxV, before + gain);
      if(p.displayHp != null) p.displayHp = Math.min(maxV, (p.displayHp || 0) + gain);
      /* ★ 战斗中死亡状态被药水救回来（血瓶不能复活，只是防止误判） */
      if(p.hp > 0 && p.dead && !p.__realDead) p.dead = false;
    } else {
      p.mp = Math.min(maxV, (p.mp || 0) + gain);
    }
    p.potions[id] = count(p, id) - 1;
    if(p.potions[id] <= 0) delete p.potions[id];
    if(!p.potionCd) p.potionCd = { hp:0, mp:0 };
    p.potionCd[kind] = now() + (typeof POTION_CD !== 'undefined' ? POTION_CD : 10) * 1000;

    try{ if(window.CloudSave && CloudSave.queue) CloudSave.queue(); }catch(e){}
    return { ok:true, msg: meta.name + '　回复 ' + gain + ' 点' + (kind === 'hp' ? '生命' : '法力'), gain: gain, meta: meta };
  }

  /* 快捷：喝一瓶血 / 一瓶蓝（自动挑最高档） */
  function quick(p, kind){
    const id = best(p, kind);
    if(!id) return { ok:false, msg:'没有' + (kind === 'hp' ? '回血瓶' : '回蓝瓶') + '了' };
    return use(p, id);
  }

  /* 新角色赠送 */
  function starter(p){
    if(!p.potions) p.potions = {};
    p.potions.hp1 = (p.potions.hp1 | 0) + 10;
    p.potions.mp1 = (p.potions.mp1 | 0) + 5;
    if(!p.potionCd) p.potionCd = { hp:0, mp:0 };
  }

  window.POTION = {
    count: count, total: total, cdLeft: cdLeft, best: best,
    use: use, quick: quick, starter: starter,
    meta: function(id){ return potionMeta(id); },
    grades: function(){ return POTION_GRADES; }
  };
})();
