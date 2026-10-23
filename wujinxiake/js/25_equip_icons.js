/* ===== DNF风格装备图标绘制 ===== */
/* ★ 装备图标贴图（AI 生图 → 抠图 → 128px）：武器 8 种 + 防具 6 部位，加载失败自动回退程序绘制 */
const equipIconImgs = {};
(function(){
  const map = {
    wi_sword:'icons/wi_sword.webp', wi_blade:'icons/wi_blade.webp', wi_spear:'icons/wi_spear.webp',
    wi_fist:'icons/wi_fist.webp', wi_herb:'icons/wi_herb.webp', wi_axe:'icons/wi_axe.webp',
    wi_talisman:'icons/wi_talisman.webp', wi_cauldron:'icons/wi_cauldron.webp',
    eq_head:'icons/eq_head.webp', eq_armor:'icons/eq_armor.webp', eq_shoes:'icons/eq_shoes.webp',
    eq_necklace:'icons/eq_necklace.webp', eq_ring:'icons/eq_ring.webp', eq_bracer:'icons/eq_bracer.webp'
  };
  for(const k in map){
    const im = new Image();
    im.src = map[k];
    equipIconImgs[k] = im;
  }
})();

function drawEquipIcon(slot, weaponType, x, y, size){
  ctx.save();
  ctx.translate(x + size/2, y + size/2);
  const s = size / 60; // 缩放基准
  ctx.scale(s, s);

  /* ★ 优先使用专属图标贴图（128px 透明 PNG，等比铺满 60 基准格） */
  const _iconKey = slot === 'weapon' ? ('wi_' + (weaponType || 'sword')) : ('eq_' + slot);
  const _iconImg = equipIconImgs[_iconKey];
  if(_iconImg && _iconImg.complete && _iconImg.naturalWidth > 0){
    ctx.drawImage(_iconImg, -30, -30, 60, 60);
    ctx.restore();
    return;
  }

  if(slot === 'weapon'){
    if(weaponType === 'sword'){
      /* 短剑：银色剑身 + 金色护手 + 棕色剑柄 */
      const grad = ctx.createLinearGradient(-3, -22, 3, -22);
      grad.addColorStop(0, '#8899bb'); grad.addColorStop(0.5, '#e8f0ff'); grad.addColorStop(1, '#8899bb');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(-4, -20); ctx.lineTo(0, -26); ctx.lineTo(4, -20); ctx.lineTo(3, 5); ctx.lineTo(-3, 5);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#c9a84a';
      ctx.fillRect(-8, 5, 16, 4); // 护手
      ctx.fillStyle = '#6b4a2a';
      ctx.fillRect(-2, 9, 4, 12); // 剑柄
      ctx.fillStyle = '#c9a84a';
      ctx.beginPath(); ctx.arc(0, 22, 3, 0, TAU); ctx.fill(); // 剑首
    } else if(weaponType === 'blade'){
      /* 大刀：宽刃弯刀 */
      const grad = ctx.createLinearGradient(-10, -15, 10, -15);
      grad.addColorStop(0, '#994444'); grad.addColorStop(0.5, '#e8c0c0'); grad.addColorStop(1, '#994444');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(-8, -18); ctx.quadraticCurveTo(5, -22, 12, -8);
      ctx.lineTo(6, 8); ctx.lineTo(-6, 5); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#8a6a3a';
      ctx.fillRect(-10, 8, 20, 4); // 护手
      ctx.fillStyle = '#4a3a2a';
      ctx.fillRect(-2, 12, 4, 10); // 刀柄
    } else if(weaponType === 'spear'){
      /* 长枪：长柄 + 枪头 */
      ctx.fillStyle = '#8a6a3a';
      ctx.fillRect(-1.5, -10, 3, 30); // 枪杆
      const grad = ctx.createLinearGradient(-5, -25, 5, -25);
      grad.addColorStop(0, '#8899bb'); grad.addColorStop(0.5, '#e8f0ff'); grad.addColorStop(1, '#8899bb');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(0, -28); ctx.lineTo(-5, -15); ctx.lineTo(5, -15); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#c9a84a';
      ctx.fillRect(-6, -15, 12, 3); // 枪缨座
    } else if(weaponType === 'herb'){
      /* 药草：一束草药 + 药囊 */
      ctx.strokeStyle = '#4a8a3a'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      for(let i = -2; i <= 2; i++){
        ctx.beginPath();
        ctx.moveTo(i * 3, 20);
        ctx.quadraticCurveTo(i * 7, 2, i * 9, -16 - Math.abs(i) * 3);
        ctx.stroke();
      }
      ctx.fillStyle = '#7ed957';
      for(let i = -2; i <= 2; i++){
        ctx.beginPath();
        ctx.ellipse(i * 8, -10 - Math.abs(i) * 3, 7, 4, i * 0.4, 0, TAU);
        ctx.fill();
      }
      ctx.fillStyle = '#c9a84a';
      ctx.fillRect(-10, 10, 20, 5);
      ctx.fillStyle = '#8a6a3a';
      ctx.beginPath(); ctx.ellipse(0, 18, 9, 6, 0, 0, TAU); ctx.fill();
    } else if(weaponType === 'axe'){
      /* 大斧：宽刃 + 长柄 */
      ctx.fillStyle = '#6b4a2a';
      ctx.fillRect(-2, -12, 4, 34);
      const ag = ctx.createLinearGradient(0, -22, 18, -6);
      ag.addColorStop(0, '#8899bb'); ag.addColorStop(0.5, '#e8f0ff'); ag.addColorStop(1, '#8899bb');
      ctx.fillStyle = ag;
      ctx.beginPath();
      ctx.moveTo(2, -20); ctx.quadraticCurveTo(20, -18, 18, -2);
      ctx.quadraticCurveTo(10, -8, 2, -8); ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-2, -20); ctx.quadraticCurveTo(-20, -18, -18, -2);
      ctx.quadraticCurveTo(-10, -8, -2, -8); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#c9a84a';
      ctx.fillRect(-4, -22, 8, 4);
    } else if(weaponType === 'talisman'){
      /* 符咒：一叠黄符 */
      for(let i = 0; i < 3; i++){
        ctx.save();
        ctx.rotate((i - 1) * 0.18);
        ctx.fillStyle = i === 2 ? '#fff6c8' : '#ffe066';
        ctx.fillRect(-9, -22 + i * 2, 18, 30);
        ctx.strokeStyle = '#c0392b'; ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(0, -16 + i * 2); ctx.lineTo(0, 2 + i * 2);
        ctx.moveTo(-5, -10 + i * 2); ctx.lineTo(5, -10 + i * 2);
        ctx.moveTo(-5, -4 + i * 2); ctx.lineTo(5, -4 + i * 2);
        ctx.stroke();
        ctx.restore();
      }
    } else if(weaponType === 'cauldron'){
      /* 药鼎：三足青铜鼎 */
      const cg = ctx.createLinearGradient(0, -18, 0, 16);
      cg.addColorStop(0, '#8a6a3a'); cg.addColorStop(1, '#3a2a12');
      ctx.fillStyle = cg;
      ctx.beginPath();
      ctx.moveTo(-16, -14); ctx.lineTo(16, -14);
      ctx.quadraticCurveTo(14, 10, 8, 16);
      ctx.lineTo(-8, 16);
      ctx.quadraticCurveTo(-14, 10, -16, -14);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#d8b050'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#2a1a08';
      ctx.beginPath(); ctx.ellipse(0, -14, 17, 5, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#3a2a12';
      ctx.fillRect(-10, 16, 5, 6); ctx.fillRect(5, 16, 5, 6); ctx.fillRect(-2, 16, 4, 7);
      ctx.fillStyle = '#ff7a4a';
      ctx.beginPath(); ctx.arc(0, -10, 6, 0, TAU); ctx.fill();
    } else {
      /* 拳套：金属护手 */
      ctx.fillStyle = '#aabbddee';
      ctx.beginPath();
      ctx.roundRect(-12, -5, 24, 16, 5); ctx.fill();
      ctx.fillStyle = '#c9a84a';
      ctx.beginPath(); ctx.arc(-8, -8, 4, 0, TAU); ctx.arc(0, -10, 4, 0, TAU); ctx.arc(8, -8, 4, 0, TAU); ctx.fill();
      ctx.fillStyle = '#6b4a2a';
      ctx.fillRect(-12, 11, 24, 4);
    }
  } else if(slot === 'head'){
    /* 头盔：金属盔 + 顶缨 */
    const grad = ctx.createLinearGradient(-12, -15, 12, 10);
    grad.addColorStop(0, '#aabbddee'); grad.addColorStop(1, '#667799');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, -2, 13, Math.PI, 0); ctx.fill();
    ctx.fillStyle = '#8899bb';
    ctx.fillRect(-13, -2, 26, 6); // 盔檐
    ctx.fillStyle = '#cc3333';
    ctx.fillRect(-1.5, -22, 3, 8); // 顶缨
  } else if(slot === 'armor'){
    /* 胸甲：金属铠甲 */
    const grad = ctx.createLinearGradient(-14, -18, 14, 18);
    grad.addColorStop(0, '#aabbddee'); grad.addColorStop(0.5, '#8899bb'); grad.addColorStop(1, '#556688');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(-14, -15); ctx.lineTo(-8, -18); ctx.lineTo(8, -18); ctx.lineTo(14, -15);
    ctx.lineTo(12, 15); ctx.lineTo(-12, 15); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#445577'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, -15); ctx.lineTo(0, 15); ctx.stroke();
    ctx.fillStyle = '#c9a84a';
    ctx.beginPath(); ctx.arc(0, -2, 3, 0, TAU); ctx.fill(); // 胸甲扣
  } else if(slot === 'shoes'){
    /* 靴子：短靴 */
    ctx.fillStyle = '#6b4a2a';
    ctx.beginPath();
    ctx.roundRect(-10, -8, 12, 20, 3); ctx.fill(); // 鞋筒
    ctx.beginPath();
    ctx.roundRect(-10, 8, 18, 6, 3); ctx.fill(); // 鞋底
    ctx.fillStyle = '#8a6a3a';
    ctx.fillRect(-10, 6, 12, 3); // 鞋口
  } else if(slot === 'necklace'){
    /* 项链：链圈 + 吊坠宝石 */
    ctx.strokeStyle = '#c9a84a'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(0, -2, 11, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
    ctx.fillStyle = '#ff66aa';
    ctx.beginPath();
    ctx.moveTo(0, 5); ctx.lineTo(-5, 12); ctx.lineTo(0, 20); ctx.lineTo(5, 12); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffd166';
    ctx.beginPath(); ctx.arc(0, 13, 2.5, 0, TAU); ctx.fill();
  } else if(slot === 'ring'){
    /* 戒指：金色戒指 + 宝石 */
    ctx.strokeStyle = '#c9a84a'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 5, 8, 0, TAU); ctx.stroke();
    ctx.fillStyle = '#ff66aa';
    ctx.beginPath();
    ctx.moveTo(0, -5); ctx.lineTo(-4, 0); ctx.lineTo(0, 3); ctx.lineTo(4, 0); ctx.closePath(); ctx.fill();
  } else if(slot === 'bracer'){
    /* 护腕：腕甲 */
    ctx.fillStyle = '#8899bb';
    ctx.beginPath(); ctx.roundRect(-13, -8, 26, 18, 5); ctx.fill();
    ctx.strokeStyle = '#556688'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.roundRect(-13, -8, 26, 18, 5); ctx.stroke();
    ctx.fillStyle = '#c9a84a';
    ctx.beginPath(); ctx.arc(0, 1, 4, 0, TAU); ctx.fill();
  } else if(slot === 'accessory'){
    /* 旧存档饰品（视作戒指）：金色戒指 + 宝石 */
    ctx.strokeStyle = '#c9a84a'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 5, 8, 0, TAU); ctx.stroke();
    ctx.fillStyle = '#ff66aa';
    ctx.beginPath();
    ctx.moveTo(0, -5); ctx.lineTo(-4, 0); ctx.lineTo(0, 3); ctx.lineTo(4, 0); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

function drawInventory(){
  if(!G || !G.player) return;
  const p = G.player;
  
  ctx.fillStyle = 'rgba(4,6,12,0.93)';
  ctx.fillRect(0, 0, VW, VH);

  // 顶部标题栏（深蓝黑 + 金色分隔线 + 暗角，统一 UI 质感）
  const topGrad = ctx.createLinearGradient(0,0,0,104);
  topGrad.addColorStop(0,'#16202e'); topGrad.addColorStop(0.7,'#0d1420'); topGrad.addColorStop(1,'#080c14');
  ctx.fillStyle = topGrad; ctx.fillRect(0,0,VW,104);
  const hair = ctx.createLinearGradient(0,0,VW,0);
  hair.addColorStop(0,'rgba(201,168,76,0)');
  hair.addColorStop(0.5,'rgba(201,168,76,0.85)');
  hair.addColorStop(1,'rgba(201,168,76,0)');
  ctx.fillStyle = hair; ctx.fillRect(0, 103, VW, 1.5);

  ctx.textAlign = 'center';
  ctx.save();
  ctx.shadowColor = 'rgba(255,196,96,0.45)'; ctx.shadowBlur = 14;
  ctx.fillStyle = '#ffe9b0';
  ctx.font = 'bold 27px "Microsoft YaHei"';
  ctx.fillText('行 囊', VW/2, 44);
  ctx.restore();
  ctx.fillStyle = 'rgba(160,178,196,0.75)';
  ctx.font = '11px "Microsoft YaHei"';
  ctx.fillText('装备 · 材料 · 消耗品', VW/2, 66);

  inventoryClickRegions = [];
  equipHoverRegions = [];

  // 右上角金币（金色胶囊，替代居中文字）
  {
    const gtxt = '金币 ' + (p.gold || 0);
    ctx.font = 'bold 14px "Microsoft YaHei"';
    const gw = ctx.measureText(gtxt).width + 34;
    const gx = VW - gw - 28, gy = 22, gh = 30;
    ctx.fillStyle = 'rgba(30,26,14,0.9)';
    ctx.beginPath(); ctx.roundRect(gx, gy, gw, gh, 15); ctx.fill();
    ctx.strokeStyle = 'rgba(201,168,76,0.6)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(gx + 0.5, gy + 0.5, gw - 1, gh - 1, 15); ctx.stroke();
    ctx.fillStyle = '#ffd45a';
    ctx.beginPath(); ctx.arc(gx + 17, gy + gh/2, 6, 0, TAU); ctx.fill();
    ctx.fillStyle = '#7a5a00';
    ctx.beginPath(); ctx.arc(gx + 17, gy + gh/2, 3, 0, TAU); ctx.fill();
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffe9b0';
    ctx.fillText(gtxt, gx + 28, gy + 20);
    ctx.textAlign = 'center';
  }

  /* ★ 金币正下方：重生丸数量（死亡时能用它原地满血复活） */
  {
    const n = (typeof p.pills === 'number') ? (p.pills | 0) : 0;
    const ptxt = '重生丸 ' + n;
    ctx.font = 'bold 13px "Microsoft YaHei"';
    const pw = ctx.measureText(ptxt).width + 34;
    const px2 = VW - pw - 28, py2 = 58, ph2 = 26;
    ctx.fillStyle = n > 0 ? 'rgba(30,20,34,0.9)' : 'rgba(24,24,28,0.85)';
    ctx.beginPath(); ctx.roundRect(px2, py2, pw, ph2, 13); ctx.fill();
    ctx.strokeStyle = n > 0 ? 'rgba(255,140,190,0.6)' : 'rgba(110,110,120,0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(px2 + 0.5, py2 + 0.5, pw - 1, ph2 - 1, 13); ctx.stroke();
    /* 药丸图标：小胶囊 */
    ctx.save();
    ctx.translate(px2 + 16, py2 + ph2/2);
    ctx.rotate(-0.6);
    ctx.fillStyle = n > 0 ? '#ff8ab0' : '#666';
    ctx.beginPath(); ctx.roundRect(-7, -4, 14, 8, 4); ctx.fill();
    ctx.fillStyle = n > 0 ? '#ffd6e6' : '#888';
    ctx.beginPath(); ctx.roundRect(-7, -4, 7, 8, 4); ctx.fill();
    ctx.restore();
    ctx.textAlign = 'left';
    ctx.fillStyle = n > 0 ? '#ffd6e6' : '#8b8b93';
    ctx.fillText(ptxt, px2 + 28, py2 + 18);
    ctx.textAlign = 'center';
  }
  
  // 提示消息
  if(inventoryMessage && inventoryMessageTimer > 0){
    ctx.fillStyle = '#ff6a4a';
    ctx.font = 'bold 14px "Microsoft YaHei"';
    ctx.fillText(inventoryMessage, VW/2, 110);
    inventoryMessageTimer--;
  }
  
  // 标签页
  const tabW = 120, tabH = 35;
  const tabs = [
    { id: 'equipment', name: '装备' },
    { id: 'material', name: '材料' },
    { id: 'consumable', name: '消耗品' }
  ];
  const totalTabW = tabW * tabs.length + 10 * (tabs.length - 1);
  const startTabX = VW/2 - totalTabW/2;
  
  for(let i = 0; i < tabs.length; i++){
    const tab = tabs[i];
    const tx = startTabX + i * (tabW + 10);
    const ty = 110;
    
    ctx.fillStyle = inventoryTab === tab.id ? 'rgba(201,168,76,0.92)' : 'rgba(28,34,46,0.9)';
    ctx.beginPath();
    ctx.roundRect(tx, ty, tabW, tabH, 5);
    ctx.fill();
    ctx.strokeStyle = inventoryTab === tab.id ? 'rgba(255,224,150,0.9)' : 'rgba(201,168,76,0.35)';
    ctx.lineWidth = inventoryTab === tab.id ? 1.6 : 1;
    ctx.stroke();
    if(inventoryTab === tab.id){
      ctx.fillStyle = 'rgba(255,224,150,0.5)';
      ctx.fillRect(tx + 10, ty + tabH - 2, tabW - 20, 2);
    }

    ctx.fillStyle = inventoryTab === tab.id ? '#2a1c00' : '#9fb0c0';
    ctx.font = 'bold 14px "Microsoft YaHei"';
    ctx.fillText(tab.name, tx + tabW/2, ty + 23);
    
    inventoryClickRegions.push({ x: tx, y: ty, w: tabW, h: tabH, tab: tab.id });
  }
  
  // 内容区域
  const contentX = 100, contentY = 170;
  const contentW = VW - 200, contentH = VH - 280;

  const cg = ctx.createLinearGradient(contentX, contentY, contentX, contentY+contentH);
  cg.addColorStop(0,'#151b28'); cg.addColorStop(1,'#0a0e14');
  ctx.fillStyle = cg;
  ctx.beginPath();
  ctx.roundRect(contentX, contentY, contentW, contentH, 8);
  ctx.fill();
  ctx.strokeStyle = 'rgba(201,168,76,0.55)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(201,168,76,0.18)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(contentX+4, contentY+4, contentW-8, contentH-8, 6);
  ctx.stroke();
  
  if(inventoryTab === 'equipment'){
    /* ══════════════════════════════════════════════
       ★ DNF 式三栏布局
         左：已装备（2 列 × 4 行紧凑网格，不溢出）
         中：背包（6 列 × 5 行整齐方格墙）
         右：装备详情 + 穿戴对比
       ══════════════════════════════════════════════ */
    const eqX = contentX + 22, eqY = contentY + 22;
    const SLOT = 58, S_GAP = 8, EQ_COLS = 2, EQ_ROWS = 4;
    const eqPanelW = EQ_COLS * SLOT + (EQ_COLS - 1) * S_GAP + 24;
    const eqPanelH = EQ_ROWS * SLOT + (EQ_ROWS - 1) * S_GAP + 46;

    /* 已装备底框 */
    ctx.fillStyle = 'rgba(18,22,36,0.72)';
    ctx.beginPath(); ctx.roundRect(eqX, eqY, eqPanelW, eqPanelH, 8); ctx.fill();
    ctx.strokeStyle = 'rgba(201,168,76,0.30)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(eqX + 0.5, eqY + 0.5, eqPanelW - 1, eqPanelH - 1, 8); ctx.stroke();

    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffe9b0';
    ctx.font = 'bold 14px "Microsoft YaHei"';
    ctx.fillText('已装备', eqX + 12, eqY + 22);
    ctx.textAlign = 'right';
    ctx.font = '11px "Microsoft YaHei"';
    ctx.fillStyle = 'rgba(255,207,107,0.95)';
    ctx.fillText('战力 ' + totalPower(p), eqX + eqPanelW - 12, eqY + 22);
    ctx.textAlign = 'left';

    const slotNames = { weapon:'武器', head:'头', armor:'衣', shoes:'鞋', necklace:'链', ring:'戒', bracer:'腕', mount:'飞' };
    /* 列优先的 DNF 站位：左列 武器/上衣/项链/戒指，右列 头/鞋/腕/飞行道具 */
    const eqGrid = [
      ['weapon', 'head'],
      ['armor',  'shoes'],
      ['necklace','bracer'],
      ['ring',   'mount']
    ];

    for(let r = 0; r < eqGrid.length; r++){
      for(let c = 0; c < EQ_COLS; c++){
        const slot = eqGrid[r][c];
        if(!slot) continue;
        const eq = p.equipment[slot];
        const sx = eqX + 12 + c * (SLOT + S_GAP);
        const sy = eqY + 34 + r * (SLOT + S_GAP);
        const tcol = eq ? (eq.tierColor || '#8fa8bc') : '#3a4450';

        const sg = ctx.createLinearGradient(sx, sy, sx, sy + SLOT);
        sg.addColorStop(0, eq ? hexA(tcol, 0.24) : 'rgba(40,48,62,0.5)');
        sg.addColorStop(1, 'rgba(8,12,20,0.92)');
        ctx.fillStyle = sg;
        ctx.beginPath(); ctx.roundRect(sx, sy, SLOT, SLOT, 5); ctx.fill();
        ctx.strokeStyle = eq ? hexA(tcol, 0.85) : 'rgba(90,100,112,0.45)';
        ctx.lineWidth = eq ? 1.5 : 1;
        ctx.beginPath(); ctx.roundRect(sx + 0.5, sy + 0.5, SLOT - 1, SLOT - 1, 5); ctx.stroke();

        if(eq){
          ctx.save(); ctx.globalAlpha = 0.96;
          if(slot === 'mount' && window.MOUNT && MOUNT.drawIcon){
            /* ★ 飞行道具：直接画真实模型（滑板 / 风火轮 / 御风滑板 / 翅膀） */
            MOUNT.drawIcon(ctx, sx + SLOT/2, sy + SLOT/2, SLOT - 6, eq.model || 'board', performance.now()/1000);
          } else {
            drawEquipIcon(eq.slot, eq.weaponType, sx + 5, sy + 5, SLOT - 10);
          }
          ctx.restore();
          if(eq.setId){
            ctx.fillStyle = 'rgba(255,209,102,0.9)';
            ctx.beginPath(); ctx.arc(sx + SLOT - 7, sy + 7, 3, 0, TAU); ctx.fill();
          }
        } else {
          ctx.save(); ctx.globalAlpha = 0.13;
          if(slot === 'mount' && window.MOUNT && MOUNT.drawIcon){
            MOUNT.drawIcon(ctx, sx + SLOT/2, sy + SLOT/2, SLOT - 12, 'board', performance.now()/1000);
          } else {
            drawEquipIcon(slot, 'sword', sx + 8, sy + 8, SLOT - 16);
          }
          ctx.restore();
        }
        if(eq && eq.enhance > 0){
          ctx.textAlign = 'left';
          ctx.fillStyle = 'rgba(0,0,0,0.75)';
          ctx.beginPath(); ctx.roundRect(sx + 2, sy + SLOT - 14, 22, 12, 2); ctx.fill();
          ctx.fillStyle = '#ffd700';
          ctx.font = 'bold 9px "Microsoft YaHei"';
          ctx.fillText('+' + eq.enhance, sx + 4, sy + SLOT - 5);
        }
        ctx.textAlign = 'right';
        ctx.font = '9px "Microsoft YaHei"';
        ctx.fillStyle = eq ? 'rgba(255,255,255,0.6)' : 'rgba(150,164,180,0.45)';
        ctx.fillText(slotNames[slot], sx + SLOT - 3, sy + SLOT - 4);

        inventoryClickRegions.push({ x: sx, y: sy, w: SLOT, h: SLOT, unequip: slot });
        if(eq) equipHoverRegions.push({ x: sx, y: sy, w: SLOT, h: SLOT, equip: eq });
      }
    }

    /* ---- 已装备下方：飞行道具模型预览（真模型，会动） ---- */
    {
      const pvY = eqY + eqPanelH + 10;
      const pvH = Math.max(96, contentY + contentH - pvY - 12);
      const mo = p.equipment.mount || null;
      ctx.fillStyle = 'rgba(18,22,36,0.72)';
      ctx.beginPath(); ctx.roundRect(eqX, pvY, eqPanelW, pvH, 8); ctx.fill();
      ctx.strokeStyle = mo ? hexA(mo.tierColor || '#8fa8bc', 0.55) : 'rgba(201,168,76,0.30)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.roundRect(eqX + 0.5, pvY + 0.5, eqPanelW - 1, pvH - 1, 8); ctx.stroke();

      ctx.textAlign = 'left';
      ctx.font = 'bold 12px "Microsoft YaHei"';
      ctx.fillStyle = mo ? (mo.tierColor || '#ffe9b0') : 'rgba(160,178,196,0.7)';
      ctx.fillText('飞行道具', eqX + 10, pvY + 17);

      if(mo && window.MOUNT && MOUNT.drawIcon){
        /* 品阶底光 */
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const rg = ctx.createRadialGradient(eqX + eqPanelW/2, pvY + pvH*0.62, 2, eqX + eqPanelW/2, pvY + pvH*0.62, 46);
        rg.addColorStop(0, hexA(mo.tierColor || '#8fa8bc', 0.26));
        rg.addColorStop(1, hexA(mo.tierColor || '#8fa8bc', 0));
        ctx.fillStyle = rg;
        ctx.beginPath(); ctx.arc(eqX + eqPanelW/2, pvY + pvH*0.62, 46, 0, TAU); ctx.fill();
        ctx.restore();
        MOUNT.drawIcon(ctx, eqX + eqPanelW/2, pvY + pvH*0.44, Math.min(78, pvH - 34),
                       mo.model || 'board', performance.now()/1000);
        ctx.textAlign = 'center';
        ctx.font = 'bold 11px "Microsoft YaHei"';
        ctx.fillStyle = mo.tierColor || '#ffe9b0';
        ctx.fillText(String(mo.name || '飞行道具').slice(0, 7), eqX + eqPanelW/2, pvY + pvH - 16);
        ctx.font = '10px "Microsoft YaHei"';
        ctx.fillStyle = 'rgba(160,220,255,0.9)';
        const dnf = mo.dnf || {};
        ctx.fillText('移速 +' + (dnf.moveSpd || 0) + '%　回避 +' + (dnf.dodge || 0) + '%', eqX + eqPanelW/2, pvY + pvH - 4);
      } else {
        ctx.textAlign = 'center';
        ctx.font = '11px "Microsoft YaHei"';
        ctx.fillStyle = 'rgba(150,164,180,0.6)';
        ctx.fillText('未装备', eqX + eqPanelW/2, pvY + pvH/2 + 4);
      }
      ctx.textAlign = 'left';
    }

    /* ---- 中：背包（6 × 5 整齐方格） ---- */
    const bagX = eqX + eqPanelW + 22, bagY = contentY + 22;
    const CELL = 58, C_GAP = 6, GRID_COLS = 6, GRID_ROWS = 5;
    const bagGridW = GRID_COLS * (CELL + C_GAP) - C_GAP;
    const bagGridH = GRID_ROWS * (CELL + C_GAP) - C_GAP;
    const bagPanelW = bagGridW + 24, bagPanelH = bagGridH + 46;

    ctx.fillStyle = 'rgba(18,22,36,0.72)';
    ctx.beginPath(); ctx.roundRect(bagX, bagY, bagPanelW, bagPanelH, 8); ctx.fill();
    ctx.strokeStyle = 'rgba(201,168,76,0.30)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(bagX + 0.5, bagY + 0.5, bagPanelW - 1, bagPanelH - 1, 8); ctx.stroke();

    const inv = p.inventory || [];
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffe9b0'; ctx.font = 'bold 14px "Microsoft YaHei"';
    ctx.fillText('背包', bagX + 12, bagY + 22);
    ctx.textAlign = 'right';
    ctx.font = '11px "Microsoft YaHei"';
    ctx.fillStyle = inv.length > GRID_COLS * GRID_ROWS ? '#ff8a6a' : 'rgba(150,164,180,0.7)';
    ctx.fillText(inv.length + ' / ' + (GRID_COLS * GRID_ROWS) +
      (inv.length > GRID_COLS * GRID_ROWS ? '（已满，请分解）' : ''), bagX + bagPanelW - 12, bagY + 22);
    ctx.textAlign = 'left';

    for(let r = 0; r < GRID_ROWS; r++){
      for(let c = 0; c < GRID_COLS; c++){
        const idx = r * GRID_COLS + c;
        const bx = bagX + 12 + c * (CELL + C_GAP);
        const by = bagY + 34 + r * (CELL + C_GAP);
        const eq = inv[idx] || null;
        const sel = inventorySelectedIndex === idx;
        const tcol = eq ? (eq.tierColor || '#8fa8bc') : '#2c3444';
        const bg2 = ctx.createLinearGradient(bx, by, bx, by + CELL);
        bg2.addColorStop(0, eq ? hexA(tcol, 0.22) : 'rgba(30,36,48,0.5)');
        bg2.addColorStop(1, 'rgba(8,12,20,0.9)');
        ctx.fillStyle = bg2;
        ctx.beginPath(); ctx.roundRect(bx, by, CELL, CELL, 4); ctx.fill();
        ctx.strokeStyle = sel ? '#ffd700' : (eq ? hexA(tcol, 0.72) : 'rgba(80,92,108,0.35)');
        ctx.lineWidth = sel ? 2.2 : 1;
        ctx.beginPath(); ctx.roundRect(bx + 0.5, by + 0.5, CELL - 1, CELL - 1, 4); ctx.stroke();
        if(eq){
          ctx.save(); ctx.globalAlpha = 0.96;
          if(eq.slot === 'mount' && window.MOUNT && MOUNT.drawIcon){
            MOUNT.drawIcon(ctx, bx + CELL/2, by + CELL/2, CELL - 8, eq.model || 'board', performance.now()/1000);
          } else {
            drawEquipIcon(eq.slot, eq.weaponType, bx + 5, by + 5, CELL - 10);
          }
          ctx.restore();
          if(eq.enhance > 0){
            ctx.textAlign = 'left';
            ctx.fillStyle = 'rgba(0,0,0,0.75)';
            ctx.beginPath(); ctx.roundRect(bx + 2, by + CELL - 14, 22, 12, 2); ctx.fill();
            ctx.fillStyle = '#ffd700';
            ctx.font = 'bold 9px "Microsoft YaHei"';
            ctx.fillText('+' + eq.enhance, bx + 4, by + CELL - 5);
          }
          if(eq.setId){
            ctx.fillStyle = 'rgba(255,209,102,0.92)';
            ctx.beginPath(); ctx.arc(bx + CELL - 7, by + 7, 3, 0, TAU); ctx.fill();
          }
          inventoryClickRegions.push({ x: bx, y: by, w: CELL, h: CELL, selectIndex: idx });
          equipHoverRegions.push({ x: bx, y: by, w: CELL, h: CELL, equip: eq });
        }
      }
    }

    /* ---- 右：装备详情面板 ---- */
    const detailX = bagX + bagPanelW + 22;
    const detailY = contentY + 22;
    const detailW = contentX + contentW - detailX - 22;
    
    ctx.fillStyle = 'rgba(15,18,35,0.9)';
    ctx.beginPath();
    ctx.roundRect(detailX, detailY, detailW, contentH - 60, 6);
    ctx.fill();
    ctx.strokeStyle = '#c9a84c';
    ctx.lineWidth = 1;
    ctx.stroke();
    
    const selectedEq = inventorySelectedIndex >= 0 ? p.inventory[inventorySelectedIndex] : null;
    
    if(selectedEq){
      ctx.textAlign = 'left';
      /* ★ DNF 式详情：左右双卡并排（左=背包新装备，右=已穿戴），互不遮挡 */
      const colW = Math.max(170, Math.floor((detailW - 30) / 2));
      const cardMaxH = contentH - 150;

      /* 小标题 */
      ctx.font = 'bold 11px "Microsoft YaHei"';
      ctx.fillStyle = '#9fe6ff';
      ctx.fillText('▼ 背包（点击的）', detailX + 8, detailY + 8);
      const curEq = p.equipment[selectedEq.slot];
      ctx.fillStyle = '#ffd166';
      ctx.fillText('▼ 已穿戴（当前）', detailX + colW + 22, detailY + 8);

      drawEquipCard(selectedEq, detailX + 8, detailY + 16,
        { w: colW, maxH: cardMaxH });
      if(curEq && curEq !== selectedEq){
        drawEquipCard(curEq, detailX + colW + 22, detailY + 16,
          { w: colW, maxH: cardMaxH });
      }

      /* ★ 底部精简对比条：战力差 + 最大差异属性（不遮卡） */
      if(curEq && curEq !== selectedEq){
        drawCompareStrip(selectedEq, curEq, detailX + 8, detailY + contentH - 128, detailW - 16);
      }

      // 穿戴按钮
      const wearBtnY = detailY + contentH - 60;
      const wearBtnW = detailW - 30;
      ctx.fillStyle = 'rgba(100,200,100,0.7)';
      ctx.beginPath();
      ctx.roundRect(detailX + 15, wearBtnY, wearBtnW, 35, 6);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 14px "Microsoft YaHei"';
      ctx.textAlign = 'center';
      ctx.fillText('穿 戴', detailX + 15 + wearBtnW/2, wearBtnY + 23);
      
      inventoryClickRegions.push({ x: detailX + 15, y: wearBtnY, w: wearBtnW, h: 35, wearSelected: true });
    } else {
      ctx.fillStyle = '#666';
      ctx.font = '14px "Microsoft YaHei"';
      ctx.textAlign = 'left';
      ctx.fillText('点击左侧装备查看详情', detailX + 15, detailY + 50);
    }
    
  } else if(inventoryTab === 'material'){
    // 材料标签页：格子形式
    const materials = p.materials || {};
    const matNames = {
      enhance_stone_low: '下级强化石',
      enhance_stone_mid: '中级强化石',
      enhance_stone_high: '高级强化石',
      chaos_stone: '混沌魔石'
    };
    const matDesc = {
      enhance_stone_low: '用于强化白色/绿色品质的装备，+0至+6强化等级',
      enhance_stone_mid: '用于强化蓝色/紫色品质的装备，+0至+12强化等级',
      enhance_stone_high: '用于强化粉色/橙色品质的装备，+0至+15强化等级',
      chaos_stone: '铁匠铺「洗练」重铸装备随机词条'
    };
    
    const matColors = {
      enhance_stone_low: '#88ccff',
      enhance_stone_mid: '#ff8a4a',
      enhance_stone_high: '#ff4a4a',
      chaos_stone: '#9b6bff'
    };
    
    const matKeys = Object.keys(matNames);
    for(let i = 0; i < matKeys.length; i++){
      const matType = matKeys[i];
      const count = materials[matType] || 0;
      
      const mx = contentX + 30 + i * 80;
      const my = contentY + 50;
      
      // 材料格子
      ctx.fillStyle = 'rgba(20,20,40,0.8)';
      ctx.beginPath();
      ctx.roundRect(mx, my, 60, 60, 6);
      ctx.fill();
      ctx.strokeStyle = matColors[matType] || '#888';
      ctx.lineWidth = 2;
      ctx.stroke();

      // 强化石水晶图标
      ctx.save();
      ctx.translate(mx + 30, my + 30);
      const stoneGrad = ctx.createLinearGradient(-10, -15, 10, 15);
      stoneGrad.addColorStop(0, matColors[matType] || '#888');
      stoneGrad.addColorStop(1, 'rgba(255,255,255,0.3)');
      ctx.fillStyle = stoneGrad;
      ctx.beginPath();
      ctx.moveTo(0, -18); ctx.lineTo(-12, -5); ctx.lineTo(-8, 15);
      ctx.lineTo(8, 15); ctx.lineTo(12, -5); ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();

      // 数量
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px "Microsoft YaHei"';
      ctx.textAlign = 'center';
      ctx.fillText(`x${count}`, mx + 30, my + 52);
      
      // 名称
      ctx.fillStyle = '#aaa';
      ctx.font = '11px "Microsoft YaHei"';
      ctx.fillText(matNames[matType], mx + 30, my + 80);
      
      // 点击选中材料
      inventoryClickRegions.push({ x: mx, y: my, w: 60, h: 80, selectMaterial: matType });
    }
    
    // 右侧材料详情
    if(selectedMaterial && matNames[selectedMaterial]){
      const detailX = contentX + 300;
      const detailY = contentY + 50;
      const detailW = contentX + contentW - detailX - 30;
      
      ctx.fillStyle = 'rgba(20,20,40,0.8)';
      ctx.beginPath();
      ctx.roundRect(detailX, detailY, detailW, 200, 8);
      ctx.fill();
      ctx.strokeStyle = '#555';
      ctx.stroke();
      
      ctx.textAlign = 'left';
      ctx.fillStyle = matColors[selectedMaterial] || '#fff';
      ctx.font = 'bold 18px "Microsoft YaHei"';
      ctx.fillText(matNames[selectedMaterial], detailX + 15, detailY + 35);
      
      ctx.fillStyle = '#aaa';
      ctx.font = '13px "Microsoft YaHei"';
      ctx.fillText(`数量: ${materials[selectedMaterial] || 0} 个`, detailX + 15, detailY + 65);
      
      ctx.fillStyle = '#2ee6a8';
      ctx.font = '13px "Microsoft YaHei"';
      ctx.fillText('用途:', detailX + 15, detailY + 95);
      
      ctx.fillStyle = '#ccc';
      ctx.font = '12px "Microsoft YaHei"';
      // 分行显示
      const desc = matDesc[selectedMaterial] || '';
      const maxChars = 20;
      for(let j = 0; j < 3; j++){
        const line = desc.substring(j * maxChars, (j + 1) * maxChars);
        if(line){
          ctx.fillText(line, detailX + 15, detailY + 120 + j * 20);
        }
      }
    }
    
  } else if(inventoryTab === 'consumable'){
    let y = contentY + 40;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 15px "Microsoft YaHei"';
    ctx.fillText('消耗品 — 回血瓶 / 回蓝瓶（按等级掉落，回复上限的百分比，同类共享 ' +
                 (typeof POTION_CD !== 'undefined' ? POTION_CD : 10) + ' 秒冷却）', contentX + 30, y);
    y += 26;

    if(!p.potions) p.potions = {};
    if(!p.potionCd) p.potionCd = { hp:0, mp:0 };

    /* 冷却提示 */
    const cdHp = (window.POTION ? POTION.cdLeft(p, 'hp') : 0);
    const cdMp = (window.POTION ? POTION.cdLeft(p, 'mp') : 0);
    ctx.font = '12px "Microsoft YaHei"';
    ctx.fillStyle = cdHp > 0 ? '#ff9a7a' : 'rgba(150,164,180,0.85)';
    ctx.fillText('血瓶 ' + (cdHp > 0 ? '冷却 ' + cdHp.toFixed(1) + 's' : '可用'), contentX + 30, y);
    ctx.fillStyle = cdMp > 0 ? '#ff9a7a' : 'rgba(150,164,180,0.85)';
    ctx.fillText('蓝瓶 ' + (cdMp > 0 ? '冷却 ' + cdMp.toFixed(1) + 's' : '可用'), contentX + 132, y);
    y += 12;

    /* 6 档 × 2 种，两列排布 */
    const colW = Math.floor((contentW - 70) / 2);
    for(let gi = 0; gi < 6; gi++){
      for(let ki = 0; ki < 2; ki++){
        const kind = ki === 0 ? 'hp' : 'mp';
        const meta = potionMeta(potionId(kind, gi + 1));
        const cnt = p.potions[meta.id] | 0;
        const cx0 = contentX + 30 + ki * (colW + 10);
        const itemY = y + gi * 45;
        const has = cnt > 0;

        ctx.fillStyle = has ? 'rgba(30,44,56,0.86)' : 'rgba(22,24,32,0.5)';
        ctx.beginPath(); ctx.roundRect(cx0, itemY, colW, 39, 5); ctx.fill();
        ctx.strokeStyle = has ? meta.color : 'rgba(80,88,100,0.45)';
        ctx.lineWidth = 1;
        ctx.stroke();

        /* 小药瓶图标 */
        ctx.save();
        ctx.translate(cx0 + 20, itemY + 20);
        ctx.fillStyle = has ? meta.color : 'rgba(90,100,112,0.5)';
        ctx.beginPath(); ctx.roundRect(-6, -7, 12, 15, 2.5); ctx.fill();
        ctx.fillStyle = 'rgba(235,245,255,0.9)';
        ctx.fillRect(-2.5, -11, 5, 5);
        ctx.fillStyle = '#c9a84c';
        ctx.fillRect(-3.5, -14, 7, 3.5);
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fillRect(-4, -4.5, 2, 9);
        ctx.restore();

        ctx.textAlign = 'left';
        ctx.fillStyle = has ? '#fff' : '#666';
        ctx.font = 'bold 12px "Microsoft YaHei"';
        ctx.fillText(meta.name, cx0 + 34, itemY + 16);
        ctx.fillStyle = has ? 'rgba(200,215,230,0.85)' : '#555';
        ctx.font = '10px "Microsoft YaHei"';
        ctx.fillText('×' + cnt + '　' + meta.desc, cx0 + 34, itemY + 30);

        if(has){
          const uw = 44, uh = 23, ux = cx0 + colW - uw - 7, uy = itemY + 8;
          ctx.fillStyle = 'rgba(46,230,168,0.72)';
          ctx.beginPath(); ctx.roundRect(ux, uy, uw, uh, 4); ctx.fill();
          ctx.fillStyle = '#fff'; ctx.font = 'bold 11px "Microsoft YaHei"';
          ctx.textAlign = 'center';
          ctx.fillText('使用', ux + uw/2, uy + 15);
          ctx.textAlign = 'left';
          inventoryClickRegions.push({ x: ux, y: uy, w: uw, h: uh, usePotion: meta.id });
        }
      }
    }
    y += 6 * 45 + 12;
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(150,164,180,0.72)';
    ctx.font = '11px "Microsoft YaHei"';
    ctx.fillText('战斗中也能喝：点战斗界面左侧的红 / 蓝药水瓶，或按 H（血） · G（蓝）。', contentX + 30, y);
  }
  
  // 返回按钮
  const btnW = 200, btnH = 45;
  const btnX = VW/2 - btnW/2, btnY = VH - 70;
  ctx.fillStyle = 'rgba(100,100,100,0.5)';
  ctx.beginPath();
  ctx.roundRect(btnX, btnY, btnW, btnH, 8);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 16px "Microsoft YaHei"';
  ctx.textAlign = 'center';
  ctx.fillText('返回', VW/2, btnY + 28);
  inventoryClickRegions.push({ x: btnX, y: btnY, w: btnW, h: btnH, close: true });
}

function drawStageClear(){
  // 半透明背景，可以看到地图和角色
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(0, 0, VW, VH);
  
  stageClearClickRegions = [];
  
  // 顶部通关标题
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd700';
  ctx.font = 'bold 42px "Microsoft YaHei"';
  ctx.shadowColor = '#ffd700';
  ctx.shadowBlur = 15;
  ctx.fillText('通 关 !', VW/2, 55);
  ctx.shadowBlur = 0;
  
  if(stageClearData){
    const lvlName = getLevelConfig(stageClearData.levelIdx).name;
    ctx.fillStyle = '#fff';
    ctx.font = '18px "Microsoft YaHei"';
    ctx.fillText(lvlName, VW/2, 85);
    
    // 左侧：基础奖励信息面板
    const panelW = 340, panelH = 260;
    const panelX = 40, panelY = 110;
    ctx.fillStyle = 'rgba(20,20,40,0.85)';
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 10);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,215,0,0.5)';
    ctx.lineWidth = 1;
    ctx.stroke();
    
    ctx.textAlign = 'left';
    ctx.font = '15px "Microsoft YaHei"';
    let y = panelY + 30;
    
    ctx.fillStyle = '#ff6a4a';
    ctx.fillText(`击杀怪物: ${stageClearData.kills}`, panelX + 20, y); y += 30;
    
    ctx.fillStyle = '#ffd700';
    ctx.fillText(`获得金币: ${stageClearData.gold}`, panelX + 20, y); y += 30;
    
    ctx.fillStyle = '#2ee6a8';
    ctx.fillText(`获得装备: ${stageClearData.equipmentCount} 件`, panelX + 20, y); y += 25;
    
    // 显示具体装备名称
    if(stageClearData.rewardEquips && stageClearData.rewardEquips.length > 0){
      for(const eq of stageClearData.rewardEquips){
        ctx.fillStyle = eq.tierColor || '#fff';
        ctx.font = '12px "Microsoft YaHei"';
        ctx.fillText(`  · ${eq.tierName} ${eq.name} Lv.${eq.level}`, panelX + 25, y); y += 20;
      }
      ctx.font = '15px "Microsoft YaHei"';
    }
    y += 5;
    
    ctx.fillStyle = '#88ccff';
    ctx.fillText(`获得材料: ${stageClearData.materialCount} 个`, panelX + 20, y); y += 25;
    if(stageClearData.rewardMats && stageClearData.rewardMats.length > 0){
      const matNames = { enhance_stone_low:'下级强化石', enhance_stone_mid:'中级强化石', enhance_stone_high:'高级强化石' };
      const matCounts = {};
      for(const m of stageClearData.rewardMats) matCounts[m] = (matCounts[m]||0)+1;
      for(const m in matCounts){
        ctx.fillStyle = '#6699cc';
        ctx.font = '12px "Microsoft YaHei"';
        ctx.fillText(`  · ${matNames[m]||m} x${matCounts[m]}`, panelX + 25, y); y += 18;
      }
      ctx.font = '15px "Microsoft YaHei"';
    }
    y += 5;
    
    ctx.fillStyle = '#c96bff';
    ctx.fillText(`获得经验: ${stageClearData.exp}`, panelX + 20, y); y += 35;
    
    // 评价
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff6a4a';
    ctx.font = 'bold 24px "Microsoft YaHei"';
    ctx.fillText(`评价: ${stageClearData.rating}`, panelX + panelW/2, y);
    
    // 右侧：3张翻牌
    const cardW = 150, cardH = 200, cardGap = 20;
    const totalCardW = cardW * 3 + cardGap * 2;
    const cardStartX = VW/2 - totalCardW/2 + 100;
    const cardY = 130;
    
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 18px "Microsoft YaHei"';
    const chosen = stageClearData.chosenCard;
    ctx.fillText((chosen === undefined || chosen === null) ? '翻一张卡牌获取奖励（只能选一张）' : '已翻开的奖励', cardStartX + totalCardW/2, cardY - 10);
    
    if(!stageClearData.cardsFlipped) stageClearData.cardsFlipped = [false, false, false];
    
    for(let i = 0; i < 3; i++){
      const cx = cardStartX + i * (cardW + cardGap);
      const cy = cardY + 10;
      const flipped = stageClearData.cardsFlipped[i];
      const card = stageClearData.cards ? stageClearData.cards[i] : null;
      
      if(flipped && card){
        // 翻开状态：显示奖励内容
        ctx.fillStyle = 'rgba(30,30,50,0.9)';
        ctx.beginPath(); ctx.roundRect(cx, cy, cardW, cardH, 8); ctx.fill();
        ctx.strokeStyle = card.color || '#ffd700';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // 奖励图标
        if(card.type === 'gold'){
          ctx.fillStyle = '#ffd700';
          ctx.beginPath(); ctx.arc(cx + cardW/2, cy + 60, 28, 0, TAU); ctx.fill();
          ctx.fillStyle = '#8B6914';
          ctx.font = 'bold 22px "Microsoft YaHei"';
          ctx.fillText('$', cx + cardW/2, cy + 68);
        } else if(card.type === 'equip'){
          // 装备图标
          ctx.fillStyle = 'rgba(0,0,0,0.3)';
          ctx.beginPath(); ctx.roundRect(cx + cardW/2 - 30, cy + 30, 60, 60, 6); ctx.fill();
          drawEquipIcon(card.equip.slot, card.equip.weaponType || 'sword', cx + cardW/2 - 30, cy + 30, 60);
        }
        
        // 奖励名称
        ctx.fillStyle = card.color || '#fff';
        ctx.font = 'bold 14px "Microsoft YaHei"';
        ctx.fillText(card.label || '???', cx + cardW/2, cy + 120);
        
        ctx.fillStyle = '#aaa';
        ctx.font = '12px "Microsoft YaHei"';
        ctx.fillText(card.sublabel || '', cx + cardW/2, cy + 145);
        
        // 发光效果（好物品）
        if(card.color === '#e91e63' || card.color === '#9b59b6'){
          ctx.shadowColor = card.color;
          ctx.shadowBlur = 10;
          ctx.strokeStyle = card.color;
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.roundRect(cx+2, cy+2, cardW-4, cardH-4, 6); ctx.stroke();
          ctx.shadowBlur = 0;
        }

        /* ★ 标记：选中卡「已获得」，其余两张「已错过」 */
        const isChosen = (chosen === i);
        const tag = isChosen ? '已获得' : '已错过';
        const tagColor = isChosen ? '#2ee6a8' : '#ff7a6a';
        ctx.fillStyle = tagColor;
        ctx.font = 'bold 13px "Microsoft YaHei"';
        ctx.fillText(tag, cx + cardW/2, cy + cardH - 14);
        if(isChosen){
          /* 选中卡描金边高亮 */
          ctx.strokeStyle = '#ffd700';
          ctx.lineWidth = 2.5;
          ctx.beginPath(); ctx.roundRect(cx, cy, cardW, cardH, 8); ctx.stroke();
        } else {
          /* 未选中卡压暗一点，突出「错过了」 */
          ctx.fillStyle = 'rgba(0,0,0,0.22)';
          ctx.beginPath(); ctx.roundRect(cx, cy, cardW, cardH, 8); ctx.fill();
        }
      } else {
        // 未翻开状态：卡牌背面
        const grad = ctx.createLinearGradient(cx, cy, cx, cy + cardH);
        grad.addColorStop(0, '#2a1a4a');
        grad.addColorStop(0.5, '#1a0a3a');
        grad.addColorStop(1, '#2a1a4a');
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.roundRect(cx, cy, cardW, cardH, 8); ctx.fill();
        
        ctx.strokeStyle = '#6a4aaa';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // 卡牌背面花纹
        ctx.strokeStyle = 'rgba(106,74,170,0.4)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.roundRect(cx+10, cy+10, cardW-20, cardH-20, 5); ctx.stroke();
        ctx.beginPath(); ctx.roundRect(cx+18, cy+18, cardW-36, cardH-36, 4); ctx.stroke();
        
        // 中央问号
        ctx.fillStyle = '#8a6acc';
        ctx.font = 'bold 48px "Microsoft YaHei"';
        ctx.fillText('?', cx + cardW/2, cy + cardH/2 + 16);
        
        // 提示文字
        ctx.fillStyle = '#6a5a8a';
        ctx.font = '12px "Microsoft YaHei"';
        ctx.fillText('点击翻开', cx + cardW/2, cy + cardH - 20);
        
        // 注册点击区域
        stageClearClickRegions.push({ x: cx, y: cy, w: cardW, h: cardH, flipCard: i });
      }
    }
    
    // 检查是否全部翻开
    const allFlipped = stageClearData.cardsFlipped && stageClearData.cardsFlipped.every(f => f);
    if(allFlipped){
      stageClearData.allCardsFlipped = true;
    }
  }
  
  // 返回城镇按钮（全部翻开后才显示）
  const showReturn = !stageClearData || !stageClearData.cards || stageClearData.allCardsFlipped;
  if(showReturn){
    const btnW = 200, btnH = 44;
    const btnX = VW/2 - btnW/2, btnY = VH - 70;
    ctx.fillStyle = 'rgba(255,209,102,0.8)';
    ctx.beginPath();
    ctx.roundRect(btnX, btnY, btnW, btnH, 8);
    ctx.fill();
    ctx.fillStyle = '#333';
    ctx.font = 'bold 18px "Microsoft YaHei"';
    ctx.textAlign = 'center';
    ctx.fillText('返回城镇', VW/2, btnY + 28);
    stageClearClickRegions.push({ x: btnX, y: btnY, w: btnW, h: btnH });
  } else {
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '14px "Microsoft YaHei"';
    ctx.fillText('翻开所有卡牌后返回', VW/2, VH - 45);
  }
}

function drawDungeonSelect(){
  ctx.fillStyle = 'rgba(0,0,0,0.85)';
  ctx.fillRect(0, 0, VW, VH);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd700';
  ctx.font = 'bold 36px "Microsoft YaHei"';
  ctx.fillText('守门人', VW/2, 100);

  ctx.fillStyle = '#ccc';
  ctx.font = '18px "Microsoft YaHei"';
  ctx.fillText('想进地下城？去找城里的四方传送使', VW/2, 140);
  ctx.fillStyle = '#8fa4b8';
  ctx.font = '14px "Microsoft YaHei"';
  ctx.fillText('东 · 青鸾（1~20）｜南 · 朱明（21~40）｜西 · 白泽（41~60）｜传送阵 · 玄冥（深渊）', VW/2, 168);

  dungeonSelectClickRegions = [];

  // 单卡片：守门人试炼（PvP）
  const cardW = 360, cardH = 210;
  const dx = VW/2 - cardW/2, dy = 220;
  ctx.fillStyle = 'rgba(60,120,180,0.3)';
  ctx.beginPath();
  ctx.roundRect(dx, dy, cardW, cardH, 15);
  ctx.fill();
  ctx.strokeStyle = '#64B5F6';
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.fillStyle = '#64B5F6';
  ctx.font = 'bold 28px "Microsoft YaHei"';
  ctx.fillText('⚔ 守门人试炼', dx + cardW/2, dy + 66);

  ctx.fillStyle = '#ccc';
  ctx.font = '16px "Microsoft YaHei"';
  ctx.fillText('用当前等级装备挑战守门人', dx + cardW/2, dy + 110);
  ctx.fillText('根据你的实力匹配对手', dx + cardW/2, dy + 138);

  dungeonSelectClickRegions.push({ x: dx, y: dy, w: cardW, h: cardH, action: 'pvp' });

  // 返回按钮
  ctx.fillStyle = 'rgba(100,100,100,0.5)';
  ctx.beginPath();
  ctx.roundRect(VW/2 - 100, VH - 80, 200, 45, 8);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 16px "Microsoft YaHei"';
  ctx.fillText('返回城镇', VW/2, VH - 52);
  dungeonSelectClickRegions.push({ x: VW/2 - 100, y: VH - 80, w: 200, h: 45, action: 'back' });
}

