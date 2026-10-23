/* ============================================================
   ★ ESC 系统菜单 + 装备图鉴（装备系统）
   照搬 DNF：ESC 打开游戏菜单（各类系统入口），菜单里点
   「装备系统」进入图鉴，按部位/等级段/品阶分类浏览全部装备与属性。
   ============================================================ */
let gameMenuClickRegions = [];
let wikiClickRegions = [];
let wikiSlot = 'weapon';      /* 当前部位 */
let wikiLvIdx = -1;           /* 当前等级段（-1 = 全部，0..6 = EQUIP_LV_LADDER 下标） */
let wikiTierIdx = -1;         /* -1 = 全部品阶 */
let wikiSelIdx = 0;           /* 图鉴列表选中项 */
let wikiScroll = 0, wikiScrollMax = 0;
let wikiListRegion = null, wikiScrollBarRegion = null, wikiScrollDrag = null;
let wikiItems = [];
let wikiCache = new Map();

function mulberry32(a){
  return function(){
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function wikiHash(s){
  let h = 2166136261;
  for(let i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
/* ★ 确定性生成一件图鉴样板装备（固定品阶/等级段），直接按名称构造，不依赖概率 */
function wikiGenItem(slot, tierIdx, lvIdx, k, wtIdx){
  const key = slot + '|' + tierIdx + '|' + lvIdx + '|' + k + '|' + (wtIdx == null ? -1 : wtIdx);
  if(wikiCache.has(key)) return wikiCache.get(key);
  const ti = Math.max(0, Math.min(5, tierIdx));
  const tier = EQUIP_TIERS[ti];
  const level = EQUIP_LV_LADDER[clamp(lvIdx, 0, EQUIP_LV_LADDER.length - 1)];
  const wt = (wtIdx != null && wtIdx >= 0 && WEAPONS[wtIdx]) ? WEAPONS[wtIdx].id : 'sword';

  /* ★ 按装备设定的名称来确定品阶分类，而非百分比概率 */
  let name;
  if(slot === 'weapon'){
    if(ti >= 3){
      /* 粉/橙/史诗：从 ELITE 名池取专属名 */
      const elite = ELITE_WEAPON_NAMES[wt] || ELITE_WEAPON_NAMES.sword;
      const pool = elite[tier.id] || [];
      name = pool.length ? pool[k % pool.length] : (SIMPLE_WEAPON_NAMES[wt] || '铁剑');
    } else {
      /* 白/蓝/紫：前缀 + 基础名 */
      name = TIER_NAME_PREFIX[tier.id] + '·' + (SIMPLE_WEAPON_NAMES[wt] || '铁剑');
    }
  } else {
    if(ti >= 3){
      /* 粉/橙/史诗：从 ELITE 名池取专属名 */
      const elite = ELITE_NAMES[slot] || (slot === 'accessory' ? ELITE_NAMES.ring : null);
      const pool = (elite && elite[tier.id]) ? elite[tier.id] : [];
      name = pool.length ? pool[k % pool.length] : (SIMPLE_EQUIP_NAMES[slot] || '布衣');
    } else {
      /* 白/蓝/紫：前缀 + 基础名 */
      name = TIER_NAME_PREFIX[tier.id] + '·' + (SIMPLE_EQUIP_NAMES[slot] || '布衣');
    }
  }

  /* 直接构造装备对象，指定品阶与名称 */
  const eq = {
    slot: slot,
    name: name,
    tier: tier.id,
    tierName: tier.name,
    tierColor: tier.color,
    grade: '中级',
    gradeMul: 1.0,
    level: level,
    enhance: 0,
    amplify: 0,
    weaponType: slot === 'weapon' ? wt : null,
    baseAtk: Math.round((slot === 'weapon' ? 10 * tier.baseMul * (1 + level * 0.1) : 0)),
    baseHp: Math.round((slot === 'head' || slot === 'armor' ? 30 * tier.baseMul * (1 + level * 0.1) : 0)),
    baseDef: Math.round((slot === 'armor' ? 5 * tier.baseMul * (1 + level * 0.1) : 0)),
    baseSpd: Math.round((slot === 'shoes' ? 10 * tier.baseMul * (1 + level * 0.08) : 0)),
    baseCrit: Math.round((slot === 'accessory' || slot === 'necklace' || slot === 'ring' || slot === 'bracer' ? 3 * tier.baseMul * (1 + level * 0.1) : 0)),
    extraStats: []
  };

  /* 用确定性种子生成 DNF 属性与词条 */
  const rng = mulberry32(wikiHash(key));
  const orig = Math.random;
  Math.random = rng;
  try {
    rollEquipDnf(eq);
  } finally {
    Math.random = orig;
  }

  wikiCache.set(key, eq);
  return eq;
}
function buildWikiList(){
  wikiItems = [];
  /* wikiLvIdx=-1 表示全部等级，生成时用最高等级(6)以解锁所有品阶 */
  const lv = wikiLvIdx < 0 ? 6 : wikiLvIdx;
  /* 图鉴展示所有品阶，不受等级限制 */
  const tiers = wikiTierIdx < 0 ? [0, 1, 2, 3, 4, 5] : [wikiTierIdx];
  for(const ti of tiers){
    if(wikiSlot === 'weapon'){
      /* 武器：按品阶展示所有命名武器 */
      if(ti >= 3){
        /* 粉/橙/史诗：展示 ELITE 名池中的所有专属名 */
        for(let wi = 0; wi < WEAPONS.length; wi++){
          const wt = WEAPONS[wi].id;
          const elite = ELITE_WEAPON_NAMES[wt] || ELITE_WEAPON_NAMES.sword;
          const tier = EQUIP_TIERS[ti];
          const pool = elite[tier.id] || [];
          const count = Math.max(1, pool.length);
          for(let k = 0; k < count; k++){
            wikiItems.push({ eq: wikiGenItem('weapon', ti, lv, k, wi), wtIdx: wi });
          }
        }
      } else {
        /* 白/蓝/紫：8 种职业武器各出一件 */
        for(let wi = 0; wi < WEAPONS.length; wi++){
          wikiItems.push({ eq: wikiGenItem('weapon', ti, lv, 0, wi), wtIdx: wi });
        }
      }
    } else if(wikiSlot === 'mount'){
      /* 飞行道具：按品阶展示，每个品阶展示所有命名道具 */
      if(window.MOUNT && MOUNT.TIERS){
        const mt = MOUNT.TIERS[ti];
        if(mt){
          var pool = MOUNT.POOL && MOUNT.POOL[mt.id];
          if(pool){
            for(var pi = 0; pi < pool.length; pi++){
              var eq = MOUNT.make(mt.id, pool[pi].lv);
              eq.name = pool[pi].name;
              eq.model = pool[pi].model;
              wikiItems.push({ eq: eq, isMount: true });
            }
          } else {
            var eq = MOUNT.make(mt.id, mt.lv);
            wikiItems.push({ eq: eq, isMount: true });
          }
        }
      }
    } else {
      /* 非武器部位：按品阶展示所有命名装备 */
      if(ti >= 3){
        /* 粉/橙/史诗：展示 ELITE 名池中的所有专属名 */
        const tier = EQUIP_TIERS[ti];
        const elite = ELITE_NAMES[wikiSlot] || (wikiSlot === 'accessory' ? ELITE_NAMES.ring : null);
        const pool = (elite && elite[tier.id]) ? elite[tier.id] : [];
        const count = Math.max(1, pool.length);
        for(let k = 0; k < count; k++){
          wikiItems.push({ eq: wikiGenItem(wikiSlot, ti, lv, k, -1) });
        }
      } else {
        /* 白/蓝/紫：展示 2 件（相同名称，不同品级） */
        for(let k = 0; k < 2; k++){
          wikiItems.push({ eq: wikiGenItem(wikiSlot, ti, lv, k, -1) });
        }
      }
    }
  }
  /* 排序：品阶降序（粉橙在前），同品阶内武器按职业顺序聚集 */
  wikiItems.sort(function(a, b){
    const ia = EQUIP_TIERS.findIndex(t => t.id === a.eq.tier);
    const ib = EQUIP_TIERS.findIndex(t => t.id === b.eq.tier);
    if(ib !== ia) return ib - ia;
    const wa = a.wtIdx == null ? 99 : a.wtIdx;
    const wb = b.wtIdx == null ? 99 : b.wtIdx;
    if(wa !== wb) return wa - wb;
    return (a.eq.name || '').localeCompare(b.eq.name || '', 'zh');
  });
  wikiSelIdx = Math.min(wikiSelIdx, Math.max(0, wikiItems.length - 1));
}
function openEquipWiki(){
  wikiSlot = 'weapon'; wikiLvIdx = -1; wikiTierIdx = -1;
  wikiSelIdx = 0; wikiScroll = 0; wikiScrollMax = 0;
  wikiCache.clear();  /* 清除缓存，确保使用最新的品阶生成规则 */
  buildWikiList();
  gameState = 'equipWiki';
}

/* ---- ESC 系统菜单（DNF 式） ---- */
function drawGameMenu(){
  const p = G && G.player;
  ctx.fillStyle = 'rgba(6,8,16,0.72)';
  ctx.fillRect(0, 0, VW, VH);

  const PW = 640, PH = 520;
  const px = (VW - PW) / 2, py = (VH - PH) / 2;
  const bg = ctx.createLinearGradient(0, py, 0, py + PH);
  bg.addColorStop(0, '#1d2436'); bg.addColorStop(1, '#10141f');
  ctx.fillStyle = bg;
  ctx.beginPath(); ctx.roundRect(px, py, PW, PH, 12); ctx.fill();
  ctx.strokeStyle = 'rgba(201,168,76,0.85)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(px + 1, py + 1, PW - 2, PH - 2, 12); ctx.stroke();
  ctx.strokeStyle = 'rgba(201,168,76,0.22)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.roundRect(px + 6, py + 6, PW - 12, PH - 12, 9); ctx.stroke();

  /* 标题 */
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffd166';
  ctx.font = 'bold 22px "Microsoft YaHei"';
  ctx.fillText('系统菜单', px + 26, py + 42);
  ctx.fillStyle = 'rgba(160,175,195,0.8)';
  ctx.font = '12px "Microsoft YaHei"';
  ctx.fillText('按 ESC 或点击 ✕ 关闭', px + 26, py + 62);
  if(p){
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffd700';
    ctx.font = '13px "Microsoft YaHei"';
    ctx.fillText((p.name || '冒险家') + '　Lv.' + (p.level || 1) + '　金币 ' + (p.gold || 0) + '　重生丸 ' + (p.pills | 0), px + PW - 26, py + 42);
  }
  /* 右上角关闭按钮 */
  ctx.fillStyle = 'rgba(140,40,40,0.85)';
  ctx.beginPath(); ctx.roundRect(px + PW - 46, py + 16, 30, 30, 6); ctx.fill();
  ctx.strokeStyle = 'rgba(255,120,120,0.6)'; ctx.lineWidth = 1; ctx.stroke();
  ctx.textAlign = 'center'; ctx.fillStyle = '#ffd9d9';
  ctx.font = 'bold 16px "Microsoft YaHei"';
  ctx.fillText('✕', px + PW - 31, py + 37);
  gameMenuClickRegions = [{ x: px + PW - 46, y: py + 16, w: 30, h: 30, id: 'close' }];

  /* 功能按钮网格 3×3 */
  const items = [
    { id:'characterInfo', icon:'👤', name:'角色信息', desc:'属性面板 · C' },
    { id:'inventory',     icon:'🎒', name:'行囊',     desc:'装备 · 道具 · I' },
    { id:'equipWiki',     icon:'📖', name:'装备系统', desc:'全部装备图鉴' },
    { id:'skillMenu',     icon:'✨', name:'技能',     desc:'加点 · 技能栏' },
    { id:'questMenu',     icon:'📜', name:'任务',     desc:'主线任务链 · Q' },
    { id:'enhanceMenu',   icon:'🔨', name:'铁匠铺',   desc:'强化 · 分解 · 增幅' },
    { id:'shop',          icon:'🏪', name:'杂货铺',   desc:'购买 · 出售' },
    { id:'levelSelect',   icon:'🗺️', name:'选择地图', desc:'挑战地下城' },
    { id:'menu',          icon:'🚪', name:'返回主菜单', desc:'结束本次冒险' }
  ];
  const bw = 180, bh = 96, gx = 20, gy = 16;
  const startX = px + (PW - (bw * 3 + gx * 2)) / 2, startY = py + 92;
  ctx.textAlign = 'center';
  for(let i = 0; i < items.length; i++){
    const it = items[i];
    const col = i % 3, row = Math.floor(i / 3);
    const bx = startX + col * (bw + gx), by = startY + row * (bh + gy);
    const hot = it.id === 'equipWiki';
    const bgd = ctx.createLinearGradient(bx, by, bx, by + bh);
    bgd.addColorStop(0, hot ? 'rgba(80,60,20,0.9)' : 'rgba(44,54,78,0.9)');
    bgd.addColorStop(1, 'rgba(16,20,32,0.95)');
    ctx.fillStyle = bgd;
    ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 8); ctx.fill();
    ctx.strokeStyle = hot ? '#ffd166' : 'rgba(120,135,158,0.5)';
    ctx.lineWidth = hot ? 2 : 1;
    ctx.beginPath(); ctx.roundRect(bx + 0.5, by + 0.5, bw - 1, bh - 1, 8); ctx.stroke();
    ctx.font = '24px "Microsoft YaHei"';
    ctx.fillText(it.icon, bx + bw / 2, by + 34);
    ctx.fillStyle = hot ? '#ffd166' : '#e6edf5';
    ctx.font = 'bold 15px "Microsoft YaHei"';
    ctx.fillText(it.name, bx + bw / 2, by + 60);
    ctx.fillStyle = 'rgba(150,165,185,0.75)';
    ctx.font = '10px "Microsoft YaHei"';
    ctx.fillText(it.desc, bx + bw / 2, by + 78);
    gameMenuClickRegions.push({ x: bx, y: by, w: bw, h: bh, id: it.id });
  }
  ctx.textAlign = 'left';
}

/* ---- 装备图鉴（装备系统） ---- */
function drawEquipWiki(){
  ctx.fillStyle = 'rgba(6,8,16,0.74)';
  ctx.fillRect(0, 0, VW, VH);

  const PW = 1220, PH = 650;
  const px = (VW - PW) / 2, py = (VH - PH) / 2;
  const bg = ctx.createLinearGradient(0, py, 0, py + PH);
  bg.addColorStop(0, '#1c2334'); bg.addColorStop(1, '#0f131e');
  ctx.fillStyle = bg;
  ctx.beginPath(); ctx.roundRect(px, py, PW, PH, 12); ctx.fill();
  ctx.strokeStyle = 'rgba(201,168,76,0.85)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(px + 1, py + 1, PW - 2, PH - 2, 12); ctx.stroke();
  ctx.strokeStyle = 'rgba(201,168,76,0.22)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.roundRect(px + 6, py + 6, PW - 12, PH - 12, 9); ctx.stroke();

  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffd166'; ctx.font = 'bold 21px "Microsoft YaHei"';
  ctx.fillText('装备系统 · 图鉴', px + 26, py + 40);
  ctx.fillStyle = 'rgba(160,175,195,0.75)'; ctx.font = '11px "Microsoft YaHei"';
  ctx.fillText('按 ESC 返回系统菜单', px + 26, py + 60);
  ctx.fillStyle = 'rgba(140,40,40,0.85)';
  ctx.beginPath(); ctx.roundRect(px + PW - 46, py + 14, 30, 30, 6); ctx.fill();
  ctx.strokeStyle = 'rgba(255,120,120,0.6)'; ctx.lineWidth = 1; ctx.stroke();
  ctx.textAlign = 'center'; ctx.fillStyle = '#ffd9d9';
  ctx.font = 'bold 16px "Microsoft YaHei"';
  ctx.fillText('✕', px + PW - 31, py + 35);
  wikiClickRegions = [{ x: px + PW - 46, y: py + 14, w: 30, h: 30, id: 'close' }];
  ctx.textAlign = 'left';

  /* 左栏：部位分类 */
  const railX = px + 20, railY = py + 80, railW = 128;
  ctx.fillStyle = '#ffd166'; ctx.font = 'bold 13px "Microsoft YaHei"';
  ctx.fillText('部位分类', railX, railY - 8);
  const slotTabs = ['weapon','head','armor','shoes','necklace','ring','bracer','mount'];
  for(let i = 0; i < slotTabs.length; i++){
    const s = slotTabs[i];
    const ty = railY + i * 40;
    const on = wikiSlot === s;
    ctx.fillStyle = on ? 'rgba(90,70,25,0.95)' : 'rgba(40,48,66,0.85)';
    ctx.beginPath(); ctx.roundRect(railX, ty, railW, 34, 6); ctx.fill();
    ctx.strokeStyle = on ? '#ffd166' : 'rgba(110,125,148,0.45)'; ctx.lineWidth = on ? 1.6 : 1;
    ctx.beginPath(); ctx.roundRect(railX + 0.5, ty + 0.5, railW - 1, 33, 6); ctx.stroke();
    ctx.textAlign = 'center';
    ctx.fillStyle = on ? '#ffd166' : '#c6d2e0';
    ctx.font = (on ? 'bold ' : '') + '13px "Microsoft YaHei"';
    ctx.fillText(SLOT_NAMES[s] || s, railX + railW / 2, ty + 22);
    wikiClickRegions.push({ x: railX, y: ty, w: railW, h: 34, slot: s });
    ctx.textAlign = 'left';
  }
  /* 左栏下段：等级段 */
  const lvY = railY + slotTabs.length * 40 + 24;
  ctx.fillStyle = '#ffd166'; ctx.font = 'bold 13px "Microsoft YaHei"';
  ctx.fillText('等级段', railX, lvY - 8);
  /* 全部等级按钮 */
  {
    const ty = lvY;
    const on = wikiLvIdx === -1;
    ctx.fillStyle = on ? 'rgba(90,70,25,0.95)' : 'rgba(40,48,66,0.85)';
    ctx.beginPath(); ctx.roundRect(railX, ty, railW, 30, 6); ctx.fill();
    ctx.strokeStyle = on ? '#ffd166' : 'rgba(110,125,148,0.45)'; ctx.lineWidth = on ? 1.6 : 1;
    ctx.beginPath(); ctx.roundRect(railX + 0.5, ty + 0.5, railW - 1, 29, 6); ctx.stroke();
    ctx.textAlign = 'center';
    ctx.fillStyle = on ? '#ffd166' : '#c6d2e0';
    ctx.font = (on ? 'bold ' : '') + '13px "Microsoft YaHei"';
    ctx.fillText('全部', railX + railW / 2, ty + 20);
    wikiClickRegions.push({ x: railX, y: ty, w: railW, h: 30, lv: -1 });
    ctx.textAlign = 'left';
  }
  for(let i = 0; i < EQUIP_LV_LADDER.length; i++){
    const ty = lvY + (i + 1) * 36;
    const on = wikiLvIdx === i;
    ctx.fillStyle = on ? 'rgba(90,70,25,0.95)' : 'rgba(40,48,66,0.85)';
    ctx.beginPath(); ctx.roundRect(railX, ty, railW, 30, 6); ctx.fill();
    ctx.strokeStyle = on ? '#ffd166' : 'rgba(110,125,148,0.45)'; ctx.lineWidth = on ? 1.6 : 1;
    ctx.beginPath(); ctx.roundRect(railX + 0.5, ty + 0.5, railW - 1, 29, 6); ctx.stroke();
    ctx.textAlign = 'center';
    ctx.fillStyle = on ? '#ffd166' : '#c6d2e0';
    ctx.font = (on ? 'bold ' : '') + '13px "Microsoft YaHei"';
    ctx.fillText('Lv.' + EQUIP_LV_LADDER[i], railX + railW / 2, ty + 20);
    wikiClickRegions.push({ x: railX, y: ty, w: railW, h: 30, lv: i });
    ctx.textAlign = 'left';
  }

  /* 中栏：品阶筛选 + 装备列表（可滚动） */
  const listX = px + 170, listY = py + 80, listW = 470;
  ctx.fillStyle = '#ffd166'; ctx.font = 'bold 13px "Microsoft YaHei"';
  ctx.fillText('品阶', listX, listY - 8);
  const tierChips = [{ idx:-1, name:'全部', color:'#c6d2e0' }].concat(
    EQUIP_TIERS.map((t, i) => ({ idx:i, name:t.name, color:t.color })));
  let chipX = listX;
  for(const c of tierChips){
    const on = wikiTierIdx === c.idx;
    ctx.font = '12px "Microsoft YaHei"';
    const cw2 = 14 + ctx.measureText(c.name).width + 14;
    ctx.fillStyle = on ? hexA(c.color, 0.28) : 'rgba(36,44,62,0.9)';
    ctx.beginPath(); ctx.roundRect(chipX, listY + 2, cw2, 26, 13); ctx.fill();
    ctx.strokeStyle = on ? c.color : 'rgba(110,125,148,0.4)'; ctx.lineWidth = on ? 1.5 : 1;
    ctx.beginPath(); ctx.roundRect(chipX + 0.5, listY + 2.5, cw2 - 1, 25, 13); ctx.stroke();
    ctx.textAlign = 'center';
    ctx.fillStyle = c.color;
    ctx.fillText(c.name, chipX + cw2 / 2, listY + 20);
    wikiClickRegions.push({ x: chipX, y: listY + 2, w: cw2, h: 26, tier: c.idx });
    chipX += cw2 + 8;
    ctx.textAlign = 'left';
  }

  const listTop = listY + 42;
  const listH = py + PH - listTop - 20;
  ctx.fillStyle = 'rgba(14,18,30,0.85)';
  ctx.beginPath(); ctx.roundRect(listX, listTop, listW, listH, 8); ctx.fill();
  ctx.strokeStyle = 'rgba(110,125,148,0.35)'; ctx.lineWidth = 1; ctx.stroke();

  const rowH = 58, visN = Math.floor((listH - 10) / rowH);
  const contentH = wikiItems.length * rowH;
  wikiScrollMax = Math.max(0, contentH - visN * rowH);
  wikiScroll = clamp(wikiScroll, 0, wikiScrollMax);
  wikiListRegion = { x: listX, y: listTop, w: listW, h: listH };

  ctx.save();
  ctx.beginPath(); ctx.roundRect(listX + 1, listTop + 1, listW - 2, listH - 2, 8); ctx.clip();
  for(let i = 0; i < wikiItems.length; i++){
    const ry = listTop + 5 + i * rowH - wikiScroll;
    if(ry + rowH < listTop || ry > listTop + listH) continue;
    const it = wikiItems[i], eq = it.eq;
    const sel = i === wikiSelIdx;
    const rc = eq.tierColor || '#cccccc';
    const rbg = ctx.createLinearGradient(listX + 8, ry, listX + 8, ry + rowH - 6);
    rbg.addColorStop(0, sel ? hexA(rc, 0.22) : 'rgba(38,46,66,0.9)');
    rbg.addColorStop(1, 'rgba(14,18,30,0.95)');
    ctx.fillStyle = rbg;
    ctx.beginPath(); ctx.roundRect(listX + 8, ry, listW - 20, rowH - 6, 6); ctx.fill();
    ctx.strokeStyle = sel ? '#ffd166' : hexA(rc, 0.55);
    ctx.lineWidth = sel ? 2 : 1;
    ctx.beginPath(); ctx.roundRect(listX + 8.5, ry + 0.5, listW - 21, rowH - 7, 6); ctx.stroke();
    /* 图标 */
    ctx.save(); ctx.globalAlpha = 0.96;
    if(it.isMount && window.MOUNT && MOUNT.drawIcon){
      MOUNT.drawIcon(ctx, listX + 40, ry + rowH/2, rowH - 12, eq.model || 'board', performance.now()/1000);
    } else {
      drawEquipIcon(eq.slot, eq.weaponType, listX + 16, ry + 5, rowH - 16);
    }
    ctx.restore();
    /* 名字与信息 */
    ctx.fillStyle = rc;
    ctx.font = 'bold 13px "Microsoft YaHei"';
    ctx.fillText((eq.name || '') + (eq.setName ? '　[' + eq.setName + '套装]' : ''), listX + 84, ry + 20);
    ctx.fillStyle = 'rgba(170,185,205,0.85)';
    ctx.font = '11px "Microsoft YaHei"';
    const sub = (eq.tierName || '') + ' · Lv.' + eq.level + ' · ' + (eq.grade || '') +
      (eq.weaponType ? ' · ' + (WEAPONS.find(w => w.id === eq.weaponType) || {}).name : '');
    ctx.fillText(sub, listX + 84, ry + 38);
    wikiClickRegions.push({ x: listX + 8, y: ry, w: listW - 20, h: rowH - 6, selIdx: i });
  }
  ctx.restore();
  /* 滚动条 */
  if(wikiScrollMax > 0){
    const trackX = listX + listW - 12, trackY = listTop + 4, trackH = listH - 8;
    ctx.fillStyle = 'rgba(60,72,95,0.6)';
    ctx.beginPath(); ctx.roundRect(trackX, trackY, 7, trackH, 3); ctx.fill();
    const th = Math.max(26, trackH * (1 - wikiScrollMax / Math.max(1, contentH)));
    const ty2 = trackY + (trackH - th) * (wikiScroll / Math.max(1, wikiScrollMax));
    ctx.fillStyle = '#c9a84c';
    ctx.beginPath(); ctx.roundRect(trackX, ty2, 7, th, 3); ctx.fill();
    wikiScrollBarRegion = { x: trackX - 4, y: trackY, w: 15, h: trackH, thumbH: th };
  } else {
    wikiScrollBarRegion = null;
  }
  if(!wikiItems.length){
    ctx.fillStyle = 'rgba(150,165,185,0.7)';
    ctx.font = '12px "Microsoft YaHei"';
    ctx.fillText('该分类下暂无装备', listX + 24, listTop + 34);
  }

  /* 右栏：选中装备属性详情 */
  const detX = listX + listW + 22, detW = px + PW - detX - 24;
  ctx.fillStyle = '#ffd166'; ctx.font = 'bold 13px "Microsoft YaHei"';
  ctx.fillText('属性详情', detX, listY + 6);
  const selIt = wikiItems[wikiSelIdx];
  if(selIt){
    const cardW = Math.min(detW, 470);
    drawEquipCard(selIt.eq, detX, listY + 18, { w: cardW, maxH: py + PH - listY - 40 });
  } else {
    ctx.fillStyle = 'rgba(150,165,185,0.7)';
    ctx.font = '12px "Microsoft YaHei"';
    ctx.fillText('点击左侧列表中的装备查看属性', detX, listY + 40);
  }
}

/* ---- 剧情对话 ---- */
function showDialogue(lines, onEnd){
  DIALOGUE = { lines: lines.slice(), idx:0, t:0, chars:0, onEnd: onEnd || null };
}
function advanceDialogue(){
  if(!DIALOGUE) return;
  const line = DIALOGUE.lines[DIALOGUE.idx] || '';
  if(DIALOGUE.chars < line.length){ DIALOGUE.chars = line.length; return; }
  DIALOGUE.idx++;
  DIALOGUE.chars = 0;
  if(DIALOGUE.idx >= DIALOGUE.lines.length){
    const cb = DIALOGUE.onEnd;
    DIALOGUE = null;
    if(cb) cb();
  }
}
/* ★ 序章只播一次：新角色首次进入城镇时自动触发 */
function maybeShowPrologue(){
  if(!G || !G.player || G.isPvp) return;
  const p = G.player;
  if(p.prologueSeen) return;
  p.prologueSeen = true;
  showDialogue(PROLOGUE_LINES, function(){
    /* 序章读完 → 解锁 1、2 技（与 q0 的 unlock 保持一致，避免重复解锁） */
    unlockPlayerSkill(p, 0);
    unlockPlayerSkill(p, 1);
    questToastMsg('第一盏灯 · 余烬', '任务已接取：跟着金色箭头去找传送使·青鸾，走到他面前按 J 交谈。', '#ffd166');
  });
}
function updateDialogue(dt){
  if(!DIALOGUE) return;
  DIALOGUE.t += dt;
  const line = DIALOGUE.lines[DIALOGUE.idx] || '';
  DIALOGUE.chars = Math.min(line.length, DIALOGUE.chars + dt * 46);
}
function drawDialogue(){
  if(!DIALOGUE) return;
  const x = 80, w = VW - 160, h = 210, y = VH - h - 42;
  ctx.save();
  /* 压暗 */
  ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 0, VW, VH);
  /* 卷轴底 */
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, 'rgba(26,22,18,0.97)'); g.addColorStop(1, 'rgba(12,10,8,0.97)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 10); ctx.fill();
  ctx.strokeStyle = '#c9a84c'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 10); ctx.stroke();
  ctx.strokeStyle = 'rgba(201,168,76,0.3)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.roundRect(x + 5, y + 5, w - 10, h - 10, 8); ctx.stroke();
  /* 灯芯光 */
  const lg = ctx.createRadialGradient(x + 54, y + 48, 2, x + 54, y + 48, 60);
  lg.addColorStop(0, 'rgba(255,220,140,0.85)'); lg.addColorStop(1, 'rgba(255,180,60,0)');
  ctx.fillStyle = lg;
  ctx.beginPath(); ctx.arc(x + 54, y + 48, 60, 0, TAU); ctx.fill();
  /* 说话人 */
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffd166'; ctx.font = 'bold 17px "Microsoft YaHei"';
  ctx.fillText('拾灯人 · 独白', x + 30, y + 38);
  /* 正文 */
  ctx.fillStyle = '#efe6d6'; ctx.font = '19px "Microsoft YaHei"';
  const line = DIALOGUE.lines[DIALOGUE.idx] || '';
  const shown = line.slice(0, Math.floor(DIALOGUE.chars));
  wrapText(shown, x + 34, y + 82, w - 68, 32);
  /* 提示 */
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(255,220,150,' + (0.55 + 0.45 * Math.sin(performance.now() * 0.006)) + ')';
  ctx.font = '13px "Microsoft YaHei"';
  ctx.fillText('空格 / 点击 继续   (' + (DIALOGUE.idx + 1) + '/' + DIALOGUE.lines.length + ')', x + w - 28, y + h - 18);
  ctx.restore();
}
function wrapText(text, x, y, maxW, lh){
  const chars = text.split('');
  let line = '', yy = y;
  for(let i = 0; i < chars.length; i++){
    const test = line + chars[i];
    if(ctx.measureText(test).width > maxW && line){
      ctx.fillText(line, x, yy);
      line = chars[i]; yy += lh;
    } else line = test;
  }
  if(line) ctx.fillText(line, x, yy);
}

/* ---- 任务提示横幅（DNF 风格，屏幕上方滑入淡出） ---- */
function updateQuestToast(dt){
  if(!questToast) return;
  questToast.t += dt;
  if(questToast.t >= questToast.dur) questToast = null;
}
function drawQuestToast(){
  if(!questToast) return;
  const T = questToast;
  const a = T.t < 0.30 ? T.t / 0.30
          : (T.t > T.dur - 0.55 ? Math.max(0, (T.dur - T.t) / 0.55) : 1);
  const W = 470, H = T.sub ? 94 : 60;
  const x = VW / 2 - W / 2;
  const y = 104 - (1 - a) * 26;
  ctx.save();
  ctx.globalAlpha = a;
  /* 底：中间亮两侧虚的横带 */
  const g = ctx.createLinearGradient(x, 0, x + W, 0);
  g.addColorStop(0, 'rgba(10,12,16,0)');
  g.addColorStop(0.14, 'rgba(10,12,16,0.90)');
  g.addColorStop(0.86, 'rgba(10,12,16,0.90)');
  g.addColorStop(1, 'rgba(10,12,16,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x, y, W, H);
  /* 上下金线 */
  const lg = ctx.createLinearGradient(x, 0, x + W, 0);
  lg.addColorStop(0, 'rgba(201,168,76,0)');
  lg.addColorStop(0.5, 'rgba(201,168,76,0.95)');
  lg.addColorStop(1, 'rgba(201,168,76,0)');
  ctx.fillStyle = lg;
  ctx.fillRect(x, y, W, 1.6);
  ctx.fillRect(x, y + H - 1.6, W, 1.6);
  /* 左右菱形装饰 */
  ctx.fillStyle = 'rgba(201,168,76,0.9)';
  for(const dx of [x + 16, x + W - 16]){
    ctx.beginPath();
    ctx.moveTo(dx, y + 9); ctx.lineTo(dx + 4, y + 13);
    ctx.lineTo(dx, y + 17); ctx.lineTo(dx - 4, y + 13);
    ctx.closePath(); ctx.fill();
  }
  /* 标题 */
  ctx.textAlign = 'center';
  ctx.fillStyle = T.color;
  ctx.font = 'bold 19px "Microsoft YaHei"';
  ctx.fillText(T.title, VW / 2, y + 30);
  /* 副标题 */
  if(T.sub){
    ctx.fillStyle = 'rgba(214,226,238,0.86)';
    ctx.font = '12px "Microsoft YaHei"';
    ctx.fillText(T.sub, VW / 2, y + 56);
    if(T.sub.length > 40){
      /* 太长时做二次换行处理 */
    }
  }
  /* 即将消失时下方提示 */
  ctx.restore();
}

/* ---- 任务 HUD ---- */
/* 主线任务追踪（城镇左侧，可点击「−」收起 /「+」展开） */
let questTrackerCollapsed = false;
let questTrackerClickRegions = [];
function drawQuestTracker(x, y){
  questTrackerClickRegions = [];
  if(!G || !G.player || G.isPvp) return;
  const p = G.player;
  const q = questOf(p);
  if(!q) return;
  const cq = MAIN_QUESTS[q.idx];
  /* 收起时只留「任务追踪」+ 号，宽度收到刚好包住四个字 */
  const W = questTrackerCollapsed ? 112 : 286, HH = 30;
  /* 给手机端图标栏避让用：框在画布虚拟坐标里的位置（高度按展开时的正文粗估） */
  window.__questTrackerBox = { x: x, y: y, w: W, h: questTrackerCollapsed ? HH : 112 };
  ctx.save();
  ctx.textAlign = 'left';
  /* 头部栏（常显，点击右侧按钮收起/展开） */
  ctx.fillStyle = 'rgba(10,14,18,0.80)';
  ctx.beginPath(); ctx.roundRect(x, y, W, HH, 7); ctx.fill();
  ctx.strokeStyle = 'rgba(255,209,102,0.45)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.roundRect(x + 0.5, y + 0.5, W - 1, HH - 1, 7); ctx.stroke();
  const fl = 0.6 + 0.4 * Math.sin(performance.now() * 0.004);
  const fg = ctx.createRadialGradient(x + 15, y + 15, 1, x + 15, y + 15, 14);
  fg.addColorStop(0, 'rgba(255,240,190,' + fl + ')');
  fg.addColorStop(1, 'rgba(255,170,60,0)');
  ctx.fillStyle = fg;
  ctx.beginPath(); ctx.arc(x + 15, y + 15, 14, 0, TAU); ctx.fill();
  ctx.fillStyle = '#ffd166'; ctx.font = 'bold 13px "Microsoft YaHei"';
  ctx.fillText('任务追踪', x + 30, y + 20);
  /* 收起态：字后面直接接 + 号，不再画分隔与章节名 */
  if(cq && !questTrackerCollapsed){
    ctx.fillStyle = '#8ea6b8'; ctx.font = '11px "Microsoft YaHei"';
    ctx.fillText(cq.chapter + '「' + cq.title + '」', x + 96, y + 20);
  }
  /* 收起/展开按钮 */
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.beginPath(); ctx.roundRect(x + W - 24, y + 6, 20, 18, 4); ctx.fill();
  ctx.strokeStyle = 'rgba(255,209,102,0.6)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.roundRect(x + W - 23.5, y + 6.5, 19, 17, 4); ctx.stroke();
  ctx.fillStyle = '#ffd166'; ctx.font = 'bold 14px "Microsoft YaHei"';
  ctx.textAlign = 'center';
  ctx.fillText(questTrackerCollapsed ? '+' : '−', x + W - 14, y + 19.5);
  ctx.textAlign = 'left';
  questTrackerClickRegions.push({ id:'toggle', x:x + W - 24, y:y + 6, w:20, h:18 });
  if(questTrackerCollapsed){ ctx.restore(); return; }

  /* 内容体 */
  const h = cq ? 92 : 54;
  ctx.fillStyle = 'rgba(10,14,18,0.72)';
  ctx.beginPath(); ctx.roundRect(x, y + HH, W, h, 7); ctx.fill();
  ctx.strokeStyle = 'rgba(255,209,102,0.30)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.roundRect(x, y + HH, W, h, 7); ctx.stroke();

  if(!cq){
    ctx.fillStyle = '#ffd166'; ctx.font = 'bold 14px "Microsoft YaHei"';
    ctx.fillText('九灯已亮 · 墟界重光', x + 14, y + HH + 23);
    ctx.fillStyle = '#9fb3c4'; ctx.font = '11px "Microsoft YaHei"';
    ctx.fillText('主线已全部完成', x + 14, y + HH + 41);
    ctx.restore();
    return;
  }
  ctx.fillStyle = '#d8e4ee'; ctx.font = '12px "Microsoft YaHei"';
  const st = cq.steps[q.step];
  ctx.fillText('· ' + (q.readyTurnIn ? '目标已完成！回城找「引灯人」交付任务' : (st ? st.text : '任务完成')), x + 14, y + HH + 21);
  if(st){
    const pr = questStepProgress(p, st);
    if(pr.max > 1 || st.type === 'kills' || st.type === 'level' || st.type === 'enhance'){
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(x + 14, y + HH + 30, W - 28, 5);
      ctx.fillStyle = '#7dffd4';
      ctx.fillRect(x + 14, y + HH + 30, (W - 28) * clamp(pr.cur / pr.max, 0, 1), 5);
      ctx.fillStyle = '#8ea6b8'; ctx.font = '10px "Microsoft YaHei"';
      ctx.textAlign = 'right';
      ctx.fillText(pr.txt, x + W - 14, y + HH + 50);
      ctx.textAlign = 'left';
    }
  }
  ctx.fillStyle = '#6f8496'; ctx.font = '10px "Microsoft YaHei"';
  ctx.fillText('Q 查看任务', x + 14, y + HH + h - 8);
  ctx.restore();
}

/* ---- 任务面板 ---- */
/* ---- 任务面板 ---- */
let questClickRegions = [];
let questReturnState = 'town';
let questViewIdx = -1;        /* 当前查看的任务索引（-1 = 跟随进行中） */
let questListScroll = 0;      /* 任务列表滚动量 */
let questScrollMax = 0;
let questScrollBarRegion = null;
let questListRegion = null;
let questScrollDrag = null;
/* 判断任务是否锁定（未推进到该进度） */
function questLocked(q, i){ return !q || i > q.idx; }
function drawQuestMenu(){
  if(!G || !G.player) return;
  const p = G.player;
  const q = questOf(p);
  drawTown();
  ctx.fillStyle = 'rgba(0,0,0,0.78)'; ctx.fillRect(0, 0, VW, VH);
  questClickRegions = [];
  const panelW = 1000, panelH = 600;
  const px = (VW - panelW) / 2, py = (VH - panelH) / 2;
  const g = ctx.createLinearGradient(px, py, px, py + panelH);
  g.addColorStop(0, '#141a20'); g.addColorStop(1, '#0a0e12');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.roundRect(px, py, panelW, panelH, 12); ctx.fill();
  ctx.strokeStyle = '#c9a84c'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(px, py, panelW, panelH, 12); ctx.stroke();

  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd166'; ctx.font = 'bold 26px "Microsoft YaHei"';
  ctx.fillText('主 线 · 墟 界 九 灯', VW / 2, py + 36);
  ctx.fillStyle = '#7f93a5'; ctx.font = '12px "Microsoft YaHei"';
  const lit = Math.min(9, q ? q.idx : 0);
  ctx.fillText('已点亮 ' + lit + ' / 9 盏　·　' + (q && MAIN_QUESTS[q.idx] ? '当前：' + MAIN_QUESTS[q.idx].chapter : '九灯已归位'), VW / 2, py + 58);

  /* 左：任务链（可滚动、可点击切换查看、未解锁显示锁） */
  const listX = px + 26, listY = py + 78, rowH = 46;
  const listW = 330, listH = py + panelH - listY - 70;
  const totalRows = MAIN_QUESTS.length;
  const viewIdx0 = (questViewIdx >= 0 ? questViewIdx : (q ? q.idx : 0));
  /* 滚动范围 */
  questScrollMax = Math.max(0, totalRows * rowH - listH);
  questListScroll = clamp(questListScroll, 0, questScrollMax);
  const rowTop = i => listY + i * rowH - questListScroll;
  /* 保证查看/进行中的行在可视区内 */
  {
    const cy = rowTop(viewIdx0);
    if(cy < listY) questListScroll = clamp(viewIdx0 * rowH, 0, questScrollMax);
    else if(cy + rowH > listY + listH) questListScroll = clamp((viewIdx0 + 1) * rowH - listH, 0, questScrollMax);
  }
  ctx.save();
  ctx.beginPath(); ctx.rect(listX - 6, listY - 4, listW + 12, listH + 8); ctx.clip();
  for(let i = 0; i < totalRows; i++){
    const mq = MAIN_QUESTS[i];
    const done = q && q.done.indexOf(mq.id) >= 0;
    const cur = q && q.idx === i;
    const locked = questLocked(q, i);
    const sel = viewIdx0 === i;
    const y = rowTop(i);
    if(y + rowH < listY || y > listY + listH) continue;
    ctx.fillStyle = sel ? 'rgba(60,120,170,0.35)' : (done ? 'rgba(40,80,60,0.22)' : (cur ? 'rgba(255,209,102,0.10)' : 'rgba(255,255,255,0.03)'));
    ctx.beginPath(); ctx.roundRect(listX, y, listW, rowH - 8, 6); ctx.fill();
    ctx.strokeStyle = sel ? '#7dd8ff' : (done ? 'rgba(94,224,138,0.5)' : (cur ? 'rgba(255,209,102,0.65)' : 'rgba(120,130,140,0.25)'));
    ctx.lineWidth = sel || cur ? 2 : 1;
    ctx.beginPath(); ctx.roundRect(listX, y, listW, rowH - 8, 6); ctx.stroke();
    ctx.textAlign = 'left';
    const mark = done ? '✦ ' : (cur ? '▶ ' : (locked ? '🔒 ' : '· '));
    ctx.fillStyle = done ? '#5ee08a' : (cur ? '#ffd166' : (locked ? '#5a6a78' : '#a9bccd'));
    ctx.font = 'bold 13px "Microsoft YaHei"';
    ctx.fillText(mark + mq.chapter + '「' + mq.title + '」', listX + 12, y + 17);
    ctx.fillStyle = locked ? '#4a5a68' : '#67788a'; ctx.font = '10px "Microsoft YaHei"';
    ctx.fillText(done ? '已完成' : (cur ? '进行中' : (locked ? '🔒 未解锁' : '待开启')), listX + 12, y + 31);
    questClickRegions.push({ id:'view', idx:i, x:listX, y:y, w:listW, h:rowH - 8 });
  }
  ctx.restore();
  /* 滚动条 */
  questScrollBarRegion = null; questListRegion = { x:listX, y:listY, w:listW, h:listH };
  if(questScrollMax > 0){
    const trackX = listX + listW + 8, trackY = listY, trackH = listH;
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.beginPath(); ctx.roundRect(trackX, trackY, 6, trackH, 3); ctx.fill();
    const thumbH = Math.max(24, trackH * (listH / (totalRows * rowH)));
    const thumbY = trackY + (trackH - thumbH) * (questListScroll / questScrollMax);
    ctx.fillStyle = 'rgba(201,168,76,0.65)';
    ctx.beginPath(); ctx.roundRect(trackX, thumbY, 6, thumbH, 3); ctx.fill();
    questScrollBarRegion = { x:trackX - 4, y:trackY, w:14, h:trackH, thumbH:thumbH };
  }
  /* 可滚动提示 */
  if(questScrollMax > 0){
    ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(150,164,180,0.55)'; ctx.font = '10px "Microsoft YaHei"';
    ctx.fillText('↕ 滚轮 / 拖动查看更多任务', listX, listY + listH + 16);
  }

  /* 右：详情（查看选中的任务；未选则显示进行中） */
  const rx = px + 380, rw = panelW - 406, ry = py + 78;
  const viewI = (questViewIdx >= 0 ? questViewIdx : (q ? q.idx : -1));
  const cq = viewI >= 0 ? MAIN_QUESTS[viewI] : null;
  const lockedView = viewI >= 0 ? questLocked(q, viewI) : false;
  const isCur = q && viewI === q.idx;
  ctx.fillStyle = 'rgba(255,255,255,0.035)';
  ctx.beginPath(); ctx.roundRect(rx, ry, rw, 330, 8); ctx.fill();
  ctx.strokeStyle = 'rgba(201,168,76,0.3)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.roundRect(rx, ry, rw, 330, 8); ctx.stroke();
  if(cq){
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffd166'; ctx.font = 'bold 19px "Microsoft YaHei"';
    ctx.fillText(cq.chapter + '「' + cq.title + '」', rx + 18, ry + 32);
    /* 状态徽标 */
    ctx.font = '11px "Microsoft YaHei"';
    const stTxt = lockedView ? '🔒 未解锁 · 先完成前面的任务' : (isCur ? (q.readyTurnIn ? '✔ 可交付 · 找引灯人领奖' : '● 进行中') : (q && q.done.indexOf(cq.id) >= 0 ? '✔ 已完成' : '待开启'));
    ctx.fillStyle = lockedView ? '#8a6a5a' : (isCur ? '#7dd8ff' : '#67788a');
    ctx.textAlign = 'right';
    ctx.fillText(stTxt, rx + rw - 18, ry + 30);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#a9bccd'; ctx.font = '13px "Microsoft YaHei"';
    wrapText(cq.brief, rx + 18, ry + 60, rw - 36, 22);
    ctx.fillStyle = '#7dd8ff'; ctx.font = 'bold 13px "Microsoft YaHei"';
    ctx.fillText('任务目标', rx + 18, ry + 122);
    for(let i = 0; i < cq.steps.length; i++){
      const st = cq.steps[i];
      const ok = !lockedView && ((isCur && ((q.step > i) || (q.step === i && questStepDone(p, st)))) || (!isCur && q && q.done.indexOf(cq.id) >= 0));
      const pr = isCur ? questStepProgress(p, st) : { txt:'' };
      ctx.fillStyle = ok ? '#5ee08a' : (isCur && q.step === i ? '#ffffff' : '#6d7f8f');
      ctx.font = '13px "Microsoft YaHei"';
      ctx.fillText((ok ? '✔ ' : (lockedView ? '🔒 ' : '○ ')) + st.text + (isCur && (st.type === 'kills' || st.type === 'level' || st.type === 'enhance') ? '　(' + pr.txt + ')' : ''), rx + 26, ry + 146 + i * 22);
    }
    ctx.fillStyle = '#ffd166'; ctx.font = 'bold 13px "Microsoft YaHei"';
    ctx.fillText('任务奖励', rx + 18, ry + 222);
    const r = cq.reward || {};
    const parts = [];
    if(r.exp) parts.push('经验 ' + r.exp);
    if(r.gold) parts.push('金币 ' + r.gold);
    if(r.sp) parts.push('技能点 ' + r.sp);
    if(r.equip) parts.push('装备 ×' + r.equip);
    if(r.mats) for(const k in r.mats){
      const nm = { enhance_stone_low:'下级强化石', enhance_stone_mid:'中级强化石', enhance_stone_high:'高级强化石', chaos_stone:'混沌魔石' }[k] || k;
      parts.push(nm + ' ×' + r.mats[k]);
    }
    ctx.fillStyle = '#d8e4ee'; ctx.font = '12px "Microsoft YaHei"';
    ctx.fillText(parts.join('　·　') || '无', rx + 26, ry + 244);
    if(cq.unlock && cq.unlock.length){
      const names = cq.unlock.map(i => {
        const w = WEAPONS[p.weaponIdx];
        return (w && w.skills[i]) ? w.skills[i].name : ('技能' + (i + 1));
      });
      ctx.fillStyle = '#7dffd4'; ctx.font = '12px "Microsoft YaHei"';
      ctx.fillText('解锁技能：' + names.join('、'), rx + 18, ry + 272);
    }
    if(cq.tip){
      ctx.fillStyle = '#8ea6b8'; ctx.font = '11px "Microsoft YaHei"';
      wrapText(cq.tip, rx + 18, ry + 296, rw - 36, 16);
    }
  } else {
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd166'; ctx.font = 'bold 20px "Microsoft YaHei"';
    ctx.fillText('九灯已亮，墟界重光。', rx + rw / 2, ry + 150);
  }

  /* 技能解锁总览 */
  const sy = ry + 346;
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(255,255,255,0.035)';
  ctx.beginPath(); ctx.roundRect(rx, sy, rw, 108, 8); ctx.fill();
  ctx.fillStyle = '#9fe6ff'; ctx.font = 'bold 13px "Microsoft YaHei"';
  ctx.fillText('本职业六技', rx + 18, sy + 22);
  const w = WEAPONS[p.weaponIdx];
  for(let i = 0; i < 6; i++){
    const sk = w.skills[i];
    const unl = p.skillsUnlocked && p.skillsUnlocked[i];
    const lvOk = (p.level || 1) >= (sk.unlock || 1);
    const bx = rx + 18 + (i % 3) * 226;
    const by = sy + 38 + Math.floor(i / 3) * 32;
    ctx.fillStyle = unl && lvOk ? '#7dffd4' : (unl ? '#ffd166' : '#5a6b7a');
    ctx.font = '12px "Microsoft YaHei"';
    ctx.fillText((unl ? (lvOk ? '◆ ' : '◇ ') : '✕ ') + (i + 1) + '. ' + sk.name, bx, by + 10);
    if(!unl){
      ctx.fillStyle = '#546574'; ctx.font = '9px "Microsoft YaHei"';
      ctx.fillText('待主线解锁', bx + 100, by + 10);
    } else if(!lvOk){
      ctx.fillStyle = '#8a6a2a'; ctx.font = '9px "Microsoft YaHei"';
      ctx.fillText('需 Lv.' + sk.unlock, bx + 100, by + 10);
    }
  }

  /* 返回 */
  const bw = 120, bh = 38, bx2 = VW / 2 - bw / 2, by2 = py + panelH - 52;
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(90,110,130,0.7)';
  ctx.beginPath(); ctx.roundRect(bx2, by2, bw, bh, 8); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 16px "Microsoft YaHei"';
  ctx.fillText('返回 (Q)', VW / 2, by2 + 25);
  questClickRegions.push({ id:'back', x:bx2, y:by2, w:bw, h:bh });
}

