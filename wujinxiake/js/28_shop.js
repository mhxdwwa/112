/* ===== 商店界面 ===== */
let shopClickRegions = [];
let shopTab = 'buy'; // 'buy' or 'sell'
/* ★ 商店列表滚动（滚轮 / 拖拽滚动条，列表超出面板时显示滚动条） */
let shopListScroll = 0;
let shopScrollMax = 0;
let shopScrollBarRegion = null;
let shopListRegion = null;   /* 列表可视区域（用于按住拖动滚动） */
let shopSelectedIndex = -1; // 出售模式下选中的背包物品索引

/* ===== DNF风格商店：按等级分级售卖装备 ===== */
const SHOP_SLOT_LABELS = { weapon:'武器', head:'头部', armor:'上衣', shoes:'鞋履', necklace:'项链', ring:'戒指', bracer:'护腕', accessory:'饰品' };

/* 根据玩家等级生成商店货品 */
function getShopItems(){
  const p = G.player;
  const pLv = p.level || 1;
  // 商店卖当前等级段的装备：向下取整到5的倍数
  const shopLv = Math.max(1, Math.floor(pLv / 5) * 5);
  const pWeaponType = ['sword','blade','spear','fist'][p.weaponIdx || 0];
  const pWeaponId = ['sword','blade','spear','fist'][p.weaponIdx || 0];

  // 武器名字按职业取
  const weaponNamePool = {
    sword:  ['秋叶刀','虚祖国刀','裂创心灵之刃','青光震兽剑','含光斩岩剑','魔剑阿波菲斯'],
    blade:  ['荧光剑','蓝光剑','朱星剑','万仞圣光剑','双龙魔影剑','逸龙剑抉择'],
    spear:  ['铁骑步枪','狂暴左轮','狩猎之王','死亡舞步','毁灭公爵','爆裂者血鹰'],
    fist:   ['粗布拳套','裂地拳套','狂野锤','海妖散月拳套','落日鹰眼','双龙吞云']
  };
  const wNames = weaponNamePool[pWeaponType] || weaponNamePool.sword;

  // 每个槽位两档：普通(白) Lv=shopLv-2，高级(蓝) Lv=shopLv+3
  const items = [];
  for(const slot of EQUIP_SLOTS){
    const tierIdx = slot === 'weapon' ? (p.weaponIdx||0)*2 : 0;
    let baseNames;
    if(slot === 'weapon'){
      baseNames = wNames;
    } else {
      baseNames = EQUIP_NAMES[slot];
    }
    // 普通装备（白色）
    const commonLv = Math.max(1, shopLv - 2);
    const commonName = baseNames[Math.min(Math.floor(commonLv/5), baseNames.length-1)];
    items.push({
      slot: slot, tier: 'common', tierIdx: 0,
      name: '白.' + commonName, level: commonLv,
      price: Math.round(200 + commonLv * 80),
      weaponType: slot === 'weapon' ? pWeaponType : null
    });
    // 高级装备（蓝色）
    const advLv = shopLv + 3;
    const advName = baseNames[Math.min(Math.floor(advLv/5)+1, baseNames.length-1)];
    items.push({
      slot: slot, tier: 'advanced', tierIdx: 1,
      name: '蓝.' + advName, level: advLv,
      price: Math.round(1500 + advLv * 250),
      weaponType: slot === 'weapon' ? pWeaponType : null
    });
  }
  return items;
}

/* 预览一件装备的属性（用于商店展示） */
function previewShopStat(item){
  const tier = EQUIP_TIERS[item.tierIdx];
  const lv = item.level;
  const st = { atk:0, hp:0, def:0, spd:0, crit:0 };
  if(item.slot === 'weapon') st.atk = Math.round(10 * tier.baseMul * (1 + lv * 0.1));
  if(item.slot === 'head') st.hp = Math.round(30 * tier.baseMul * (1 + lv * 0.1));
  if(item.slot === 'armor'){ st.hp = Math.round(30 * tier.baseMul * (1 + lv * 0.1)); st.def = Math.round(5 * tier.baseMul * (1 + lv * 0.1)); }
  if(item.slot === 'shoes') st.spd = Math.round(10 * tier.baseMul * (1 + lv * 0.08));
  if(item.slot === 'accessory' || item.slot === 'necklace' || item.slot === 'ring' || item.slot === 'bracer') st.crit = Math.round(3 * tier.baseMul * (1 + lv * 0.1));
  return st;
}

function drawShop(){
  if(!G || !G.player) return;
  const p = G.player;
  equipHoverRegions = []; /* 每帧重置悬停区域 */

  // 半透明背景，可看到城镇
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, 0, VW, VH);

  // 主面板 - 居中偏下
  const panelW = 900, panelH = 520;
  const panelX = (VW - panelW) / 2, panelY = (VH - panelH) / 2 + 20;
  
  const pg = ctx.createLinearGradient(panelX, panelY, panelX, panelY+panelH);
  pg.addColorStop(0,'#1a2a1a'); pg.addColorStop(1,'#0a150a');
  ctx.fillStyle = pg;
  ctx.beginPath(); ctx.roundRect(panelX, panelY, panelW, panelH, 10); ctx.fill();
  ctx.strokeStyle = '#2ecc71'; ctx.lineWidth = 2; ctx.stroke();

  // 顶部标题栏
  ctx.textAlign = 'center';
  ctx.fillStyle = '#2ecc71';
  ctx.font = 'bold 22px "Microsoft YaHei"';
  ctx.fillText('李掌柜的杂货铺', VW/2, panelY + 28);

  ctx.fillStyle = '#ffd700';
  ctx.font = '14px "Microsoft YaHei"';
  ctx.fillText(`金币: ${p.gold || 0}    |    Lv.${p.level||1}`, VW/2, panelY + 50);

  shopClickRegions = [];

  // 标签页：购买 / 出售
  const tabW = 100, tabH = 30;
  const tabY = panelY + 60;
  const buyTabX = VW/2 - tabW - 5;
  const sellTabX = VW/2 + 5;
  
  // 购买标签
  ctx.fillStyle = shopTab === 'buy' ? '#2ecc71' : 'rgba(40,60,40,0.7)';
  ctx.beginPath(); ctx.roundRect(buyTabX, tabY, tabW, tabH, 5); ctx.fill();
  ctx.fillStyle = shopTab === 'buy' ? '#fff' : '#aaa';
  ctx.font = 'bold 14px "Microsoft YaHei"';
  ctx.fillText('购买', buyTabX + tabW/2, tabY + 20);
  shopClickRegions.push({ x: buyTabX, y: tabY, w: tabW, h: tabH, switchTab: 'buy' });
  
  // 出售标签
  ctx.fillStyle = shopTab === 'sell' ? '#e67e22' : 'rgba(60,40,20,0.7)';
  ctx.beginPath(); ctx.roundRect(sellTabX, tabY, tabW, tabH, 5); ctx.fill();
  ctx.fillStyle = shopTab === 'sell' ? '#fff' : '#aaa';
  ctx.fillText('出售', sellTabX + tabW/2, tabY + 20);
  shopClickRegions.push({ x: sellTabX, y: tabY, w: tabW, h: tabH, switchTab: 'sell' });

  // 左侧：玩家装备栏 (小尺寸)
  const eqPanelX = panelX + 15;
  const eqPanelY = tabY + 40;
  const eqPanelW = 200;
  const eqPanelH = panelH - 80;
  
  ctx.fillStyle = 'rgba(20,30,20,0.6)';
  ctx.beginPath(); ctx.roundRect(eqPanelX, eqPanelY, eqPanelW, eqPanelH, 6); ctx.fill();
  ctx.strokeStyle = 'rgba(46,204,113,0.3)'; ctx.lineWidth = 1; ctx.stroke();
  
  ctx.textAlign = 'center';
  ctx.fillStyle = '#2ecc71';
  ctx.font = 'bold 13px "Microsoft YaHei"';
  ctx.fillText('我的装备', eqPanelX + eqPanelW/2, eqPanelY + 18);
  
  // 已装备的5个槽位
  const slots = ['weapon', 'head', 'armor', 'shoes', 'necklace', 'ring', 'bracer'];
  const slotNames = { weapon: '武器', head: '头部', armor: '上衣', shoes: '鞋子', necklace: '项链', ring: '戒指', bracer: '护腕' };
  const slotSize = 36;
  const slotGap = 4;
  
  for(let i = 0; i < slots.length; i++){
    const slot = slots[i];
    const eq = p.equipment[slot];
    const sx = eqPanelX + 10;
    const sy = eqPanelY + 30 + i * (slotSize + slotGap + 14);
    
    // 槽位格子
    ctx.fillStyle = eq ? 'rgba(40,60,40,0.8)' : 'rgba(30,30,30,0.5)';
    ctx.beginPath(); ctx.roundRect(sx, sy, slotSize, slotSize, 4); ctx.fill();
    ctx.strokeStyle = eq ? (eq.tierColor || '#444') : '#444';
    ctx.lineWidth = 1; ctx.stroke();
    
    if(eq){
      drawEquipIcon(eq.slot, eq.weaponType, sx, sy, slotSize);
      if(eq.enhance > 0){
        ctx.fillStyle = '#ffd700'; ctx.font = 'bold 10px "Microsoft YaHei"'; ctx.textAlign = 'center';
        ctx.fillText(`+${eq.enhance}`, sx + slotSize - 8, sy + 10);
      }
    } else {
      ctx.globalAlpha = 0.2;
      drawEquipIcon(slot, 'sword', sx, sy, slotSize);
      ctx.globalAlpha = 1;
    }
    
    // 槽位名 + 装备名
    ctx.textAlign = 'left';
    ctx.fillStyle = '#888'; ctx.font = '10px "Microsoft YaHei"';
    ctx.fillText(slotNames[slot], sx + slotSize + 6, sy + 12);
    if(eq){
      ctx.fillStyle = eq.tierColor || '#fff'; ctx.font = '10px "Microsoft YaHei"';
      const shortName = eq.name.length > 6 ? eq.name.slice(0,6)+'..' : eq.name;
      ctx.fillText(shortName, sx + slotSize + 6, sy + 26);
    }
  }
  
  // 中间/右侧：根据标签页显示不同内容
  const contentX = eqPanelX + eqPanelW + 15;
  const contentY = eqPanelY;
  const contentW = panelW - eqPanelW - 30;
  const contentH = eqPanelH;
  
  if(shopTab === 'buy'){
    // 购买模式：显示商店物品（超出面板可滚动，带滚动条）
    const items = getShopItems();
    const cardW = Math.floor((contentW - 30) / 2);   /* 右侧留出滚动条宽度 */
    const cardH = 72;
    const gapX = 8, gapY = 6;
    const startY = contentY;
    const rows = Math.ceil(items.length / 2);
    shopScrollMax = Math.max(0, rows * (cardH + gapY) - contentH);
    shopListScroll = clamp(shopListScroll, 0, shopScrollMax);
    const scY = shopListScroll;
    shopListRegion = { x: contentX, y: contentY, w: contentW, h: contentH };

    ctx.save();
    ctx.beginPath(); ctx.roundRect(contentX, contentY, contentW, contentH, 6); ctx.clip();

    for(let i = 0; i < items.length; i++){
      const item = items[i];
      const col = i % 2;
      const row = Math.floor(i / 2);
      const cx = contentX + col * (cardW + gapX);
      const cy = startY + row * (cardH + gapY) - scY;
      if(cy + cardH < contentY || cy > contentY + contentH) continue;   /* 视口外跳过 */

      const tierInfo = EQUIP_TIERS[item.tierIdx];
      const stats = previewShopStat(item);
      const canAfford = p.gold >= item.price;
      const pLv = p.level || 1;
      const levelOk = pLv >= item.level;
      const locked = !levelOk;

      // 卡片背景
      ctx.fillStyle = locked ? 'rgba(25,25,30,0.7)' : 'rgba(30,40,30,0.8)';
      ctx.beginPath(); ctx.roundRect(cx, cy, cardW, cardH, 5); ctx.fill();
      ctx.strokeStyle = locked ? '#444' : tierInfo.color;
      ctx.lineWidth = 1; ctx.stroke();

      // 图标
      const iconSize = 40;
      ctx.fillStyle = 'rgba(15,20,15,0.7)';
      ctx.beginPath(); ctx.roundRect(cx+5, cy+5, iconSize, iconSize, 3); ctx.fill();
      drawEquipIcon(item.slot, item.weaponType || 'sword', cx+5, cy+5, iconSize);

      // 名称
      ctx.textAlign = 'left';
      ctx.fillStyle = locked ? '#555' : tierInfo.color;
      ctx.font = 'bold 12px "Microsoft YaHei"';
      ctx.fillText(item.name, cx + 50, cy + 16);

      // 等级+品级
      ctx.fillStyle = locked ? '#444' : '#888';
      ctx.font = '10px "Microsoft YaHei"';
      ctx.fillText(`Lv.${item.level} ${tierInfo.name} ${SHOP_SLOT_LABELS[item.slot]}`, cx + 50, cy + 30);

      // 属性
      let statLine = '';
      if(stats.atk) statLine += `攻+${stats.atk} `;
      if(stats.hp) statLine += `命+${stats.hp} `;
      if(stats.def) statLine += `防+${stats.def} `;
      if(stats.spd) statLine += `速+${stats.spd} `;
      if(stats.crit) statLine += `暴+${stats.crit}% `;
      ctx.fillStyle = locked ? '#333' : '#8fd';
      ctx.font = '10px "Microsoft YaHei"';
      ctx.fillText(statLine.trim() || '—', cx + 50, cy + 44);

      // 价格
      ctx.fillStyle = locked ? '#444' : (canAfford ? '#ffd700' : '#ff6a4a');
      ctx.font = 'bold 11px "Microsoft YaHei"';
      ctx.fillText(`${item.price}G`, cx + 50, cy + 60);

      // 购买按钮
      const btnW = 50, btnH = 22;
      const btnX = cx + cardW - btnW - 6, btnY = cy + (cardH - btnH)/2;
      if(!locked){
        ctx.fillStyle = canAfford ? '#2e7d32' : '#4a2a2a';
        ctx.beginPath(); ctx.roundRect(btnX, btnY, btnW, btnH, 3); ctx.fill();
        ctx.fillStyle = canAfford ? '#fff' : '#888';
        ctx.font = 'bold 11px "Microsoft YaHei"'; ctx.textAlign = 'center';
        ctx.fillText('购买', btnX + btnW/2, btnY + 15);
      } else {
        ctx.fillStyle = '#555'; ctx.font = '10px "Microsoft YaHei"'; ctx.textAlign = 'center';
        ctx.fillText(`需Lv.${item.level}`, btnX + btnW/2, btnY + 15);
      }

      shopClickRegions.push({ x: cx, y: cy, w: cardW, h: cardH, item: locked ? null : item, locked: locked });
    }
    ctx.restore();

    /* 滚动条（可拖拽） */
    shopScrollBarRegion = null;
    if(shopScrollMax > 0){
      const tbW = 8;
      const tbX = contentX + contentW - tbW - 2;
      const viewH = contentH;
      const thH = Math.max(30, viewH * viewH / (viewH + shopScrollMax));
      const thY = contentY + (viewH - thH) * (shopListScroll / shopScrollMax);
      ctx.fillStyle = 'rgba(255,255,255,0.10)';
      ctx.beginPath(); ctx.roundRect(tbX, contentY, tbW, viewH, 4); ctx.fill();
      ctx.fillStyle = 'rgba(46,204,113,0.65)';
      ctx.beginPath(); ctx.roundRect(tbX, thY, tbW, thH, 4); ctx.fill();
      shopScrollBarRegion = { x: tbX - 4, y: contentY, w: tbW + 8, h: viewH, thumbH: thH };
    }
  } else {
    // 出售模式：显示背包物品
    ctx.textAlign = 'left';
    ctx.fillStyle = '#e67e22';
    ctx.font = 'bold 13px "Microsoft YaHei"';
    ctx.fillText('背包物品 (点击选中后出售，回收价80%)', contentX + 5, contentY + 15);
    
    // 背包格子（超出面板可滚动，带滚动条）
    const bagStartX = contentX + 5;
    const bagStartY = contentY + 25;
    const bagSlotSize = 48;
    const bagCols = Math.floor((contentW - 10) / (bagSlotSize + 4));

    if(p.inventory && p.inventory.length > 0){
      const bagRows = Math.ceil(p.inventory.length / bagCols);
      const viewH = contentY + contentH - bagStartY;
      shopScrollMax = Math.max(0, bagRows * (bagSlotSize + 4) - viewH);
      shopListScroll = clamp(shopListScroll, 0, shopScrollMax);
      const scY = shopListScroll;
      shopListRegion = { x: contentX, y: bagStartY, w: contentW, h: viewH };

      ctx.save();
      ctx.beginPath(); ctx.roundRect(contentX, bagStartY, contentW, viewH, 6); ctx.clip();
      equipHoverRegions = []; /* 出售模式：悬停显示装备详情 */
      for(let i = 0; i < p.inventory.length; i++){
        const eq = p.inventory[i];
        const col = i % bagCols;
        const row = Math.floor(i / bagCols);
        const sx = bagStartX + col * (bagSlotSize + 4);
        const sy = bagStartY + row * (bagSlotSize + 4) - scY;
        if(sy + bagSlotSize < bagStartY || sy > bagStartY + viewH) continue;
        
        // 格子背景
        const isSelected = shopSelectedIndex === i;
        ctx.fillStyle = isSelected ? 'rgba(230,126,34,0.5)' : 'rgba(30,30,40,0.7)';
        ctx.beginPath(); ctx.roundRect(sx, sy, bagSlotSize, bagSlotSize, 4); ctx.fill();
        ctx.strokeStyle = isSelected ? '#e67e22' : (eq.tierColor || '#555');
        ctx.lineWidth = isSelected ? 2 : 1; ctx.stroke();
        
        // 装备图标
        drawEquipIcon(eq.slot, eq.weaponType || 'sword', sx, sy, bagSlotSize);
        
        // 强化等级
        if(eq.enhance > 0){
          ctx.fillStyle = '#ffd700'; ctx.font = 'bold 10px "Microsoft YaHei"'; ctx.textAlign = 'center';
          ctx.fillText(`+${eq.enhance}`, sx + bagSlotSize - 8, sy + 10);
        }
        
        // 回收价格提示
        const sellPrice = calcSellPrice(eq);
        ctx.fillStyle = '#ffd700'; ctx.font = '9px "Microsoft YaHei"'; ctx.textAlign = 'center';
        ctx.fillText(`${sellPrice}G`, sx + bagSlotSize/2, sy + bagSlotSize - 3);
        
        shopClickRegions.push({ x: sx, y: sy, w: bagSlotSize, h: bagSlotSize, selectSellItem: i });
        equipHoverRegions.push({ x: sx, y: sy, w: bagSlotSize, h: bagSlotSize, equip: eq });
      }
      ctx.restore();

      /* 滚动条（可拖拽） */
      shopScrollBarRegion = null;
      if(shopScrollMax > 0){
        const tbW = 8;
        const tbX = contentX + contentW - tbW - 2;
        const thH = Math.max(30, viewH * viewH / (viewH + shopScrollMax));
        const thY = bagStartY + (viewH - thH) * (shopListScroll / shopScrollMax);
        ctx.fillStyle = 'rgba(255,255,255,0.10)';
        ctx.beginPath(); ctx.roundRect(tbX, bagStartY, tbW, viewH, 4); ctx.fill();
        ctx.fillStyle = 'rgba(230,126,34,0.65)';
        ctx.beginPath(); ctx.roundRect(tbX, thY, tbW, thH, 4); ctx.fill();
        shopScrollBarRegion = { x: tbX - 4, y: bagStartY, w: tbW + 8, h: viewH, thumbH: thH };
      }
    } else {
      shopScrollMax = 0; shopScrollBarRegion = null; shopListRegion = null;
      ctx.fillStyle = '#666'; ctx.font = '13px "Microsoft YaHei"';
      ctx.fillText('背包空空如也', contentX + 20, contentY + 60);
    }
    
    // 选中物品详情和出售按钮
    if(shopSelectedIndex >= 0 && p.inventory && p.inventory[shopSelectedIndex]){
      const eq = p.inventory[shopSelectedIndex];
      const detailX = contentX + contentW - 180;
      const detailY = contentY + contentH - 120;
      
      ctx.fillStyle = 'rgba(20,20,30,0.8)';
      ctx.beginPath(); ctx.roundRect(detailX, detailY, 170, 110, 6); ctx.fill();
      ctx.strokeStyle = eq.tierColor || '#666'; ctx.lineWidth = 1; ctx.stroke();
      
      ctx.textAlign = 'left';
      ctx.fillStyle = eq.tierColor || '#fff'; ctx.font = 'bold 12px "Microsoft YaHei"';
      ctx.fillText(`${eq.name} +${eq.enhance||0}`, detailX + 8, detailY + 18);
      
      ctx.fillStyle = '#aaa'; ctx.font = '10px "Microsoft YaHei"';
      ctx.fillText(`${eq.tierName} Lv.${eq.level}`, detailX + 8, detailY + 35);
      
      const sellPrice = calcSellPrice(eq);
      ctx.fillStyle = '#ffd700'; ctx.font = 'bold 13px "Microsoft YaHei"';
      ctx.fillText(`回收价: ${sellPrice} 金币`, detailX + 8, detailY + 55);
      
      // 出售按钮
      const sellBtnX = detailX + 10, sellBtnY = detailY + 68;
      const sellBtnW = 150, sellBtnH = 30;
      ctx.fillStyle = '#c0392b';
      ctx.beginPath(); ctx.roundRect(sellBtnX, sellBtnY, sellBtnW, sellBtnH, 4); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = 'bold 13px "Microsoft YaHei"'; ctx.textAlign = 'center';
      ctx.fillText('确认出售', sellBtnX + sellBtnW/2, sellBtnY + 20);
      shopClickRegions.push({ x: sellBtnX, y: sellBtnY, w: sellBtnW, h: sellBtnH, sellItem: shopSelectedIndex });
    }
  }

  // 返回按钮（右上角，避开下方商品/背包列表）
  const backW = 122, backH = 30;
  const backX = panelX + panelW - backW - 16, backY = panelY + 14;
  ctx.fillStyle = 'rgba(70,32,26,0.88)';
  ctx.beginPath(); ctx.roundRect(backX, backY, backW, backH, 6); ctx.fill();
  ctx.strokeStyle = 'rgba(255,170,130,0.55)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.roundRect(backX + 0.5, backY + 0.5, backW - 1, backH - 1, 6); ctx.stroke();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd8c0'; ctx.font = 'bold 14px "Microsoft YaHei"';
  ctx.fillText('返回城镇 ✕', backX + backW/2, backY + 20);
  shopClickRegions.push({ x: backX, y: backY, w: backW, h: backH, item: null });
}

/* 计算装备出售价格（原价80%） */
function calcSellPrice(equip){
  if(!equip) return 0;
  const tierInfo = EQUIP_TIERS.find(t => t.id === equip.tier) || EQUIP_TIERS[0];
  const basePrice = Math.round((100 + equip.level * 50) * tierInfo.baseMul);
  const enhanceBonus = (equip.enhance || 0) * 20;
  return Math.round((basePrice + enhanceBonus) * 0.8);
}

