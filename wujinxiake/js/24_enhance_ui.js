/* ============================================================
   ★ 洗练：消耗混沌魔石重铸随机词条（对标 DNF 的「净化 / 洗练」）
   ============================================================ */
function doReforge(){
  const p = G.player;
  if(!p || !p.equipment) return;
  const slot = reforgeSelectedSlot || 'weapon';
  const eq = p.equipment[slot];
  if(!eq){ enhanceMsg('该部位没有装备，无法洗练', '#ff8a7a'); return; }
  const tier = EQUIP_TIERS.find(t => t.id === eq.tier) || EQUIP_TIERS[0];
  if(!tier.extraStats){ enhanceMsg('普通装备没有随机词条，洗练无效', '#ff8a7a'); return; }

  const cost = reforgeCostOf(eq);
  if(!p.materials) p.materials = {};
  const have = p.materials.chaos_stone || 0;
  if(have < cost.stone){ enhanceMsg('混沌魔石不足：需要 ' + cost.stone + ' 个（当前 ' + have + ' 个）', '#ff8a7a'); playSound('impact'); return; }
  if((p.gold || 0) < cost.gold){ enhanceMsg('金币不足：需要 ' + cost.gold + ' 金币（当前 ' + (p.gold || 0) + '）', '#ff8a7a'); playSound('impact'); return; }

  p.materials.chaos_stone -= cost.stone;
  p.gold -= cost.gold;
  const before = (eq.affixes || []).map(a => a.label + '+' + a.value + (a.suffix || '')).join('，');
  eq.affixes = rollEquipAffixes(eq);
  const after = (eq.affixes || []).map(a => a.label + '+' + a.value + (a.suffix || '')).join('，');
  G.reforgeLast = { before: before, after: after, name: eq.name };
  recalcPlayerStats();
  enhanceMsg('洗练完成！新词条：' + (after || '无'), '#5ee08a', 4600);
  playSound('skillCast');
}

function drawReforgeTab(p, fx, fy, fw, fh){
  const slot = reforgeSelectedSlot || 'weapon';
  const eq = p.equipment[slot];

  ctx.textAlign = 'center';
  ctx.fillStyle = '#5ee08a'; ctx.font = 'bold 20px "Microsoft YaHei"';
  ctx.fillText('装 备 洗 练', fx + fw/2, fy + 30);
  ctx.fillStyle = 'rgba(180,200,190,0.85)'; ctx.font = '12px "Microsoft YaHei"';
  ctx.fillText('消耗混沌魔石重铸装备的随机词条（词条数量不变，数值与类型重新随机）', fx + fw/2, fy + 54);

  if(!eq){
    ctx.fillStyle = '#7a8a80'; ctx.font = '14px "Microsoft YaHei"';
    ctx.fillText('请先在左侧选择要洗练的装备', fx + fw/2, fy + fh/2);
    return;
  }

  /* 装备卡片 */
  const boxW = Math.min(fw - 40, 470), boxX = fx + (fw - boxW)/2, boxY = fy + 70, boxH = 176;
  ctx.fillStyle = 'rgba(12,18,16,0.85)';
  ctx.strokeStyle = hexA(eq.tierColor || '#8a9a90', 0.8); ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.roundRect(boxX, boxY, boxW, boxH, 6); ctx.fill(); ctx.stroke();

  ctx.textAlign = 'left';
  ctx.fillStyle = eq.tierColor || '#fff'; ctx.font = 'bold 16px "Microsoft YaHei"';
  ctx.fillText((eq.enhance > 0 ? '+' + eq.enhance + ' ' : '') + eq.name, boxX + 14, boxY + 26);
  ctx.fillStyle = '#8ea6c0'; ctx.font = '11px "Microsoft YaHei"';
  ctx.fillText((SLOT_NAMES[eq.slot] || '') + ' · ' + eq.tierName + ' · Lv.' + eq.level, boxX + 14, boxY + 44);

  ctx.strokeStyle = hexA(eq.tierColor || '#8a9a90', 0.3); ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(boxX + 14, boxY + 54); ctx.lineTo(boxX + boxW - 14, boxY + 54); ctx.stroke();

  ctx.fillStyle = '#c9a84c'; ctx.font = 'bold 12px "Microsoft YaHei"';
  ctx.fillText('当前词条', boxX + 14, boxY + 74);
  const affs = eq.affixes || [];
  if(affs.length){
    let yy = boxY + 94;
    for(const af of affs){
      ctx.fillStyle = AFFIX_COLOR[af.key] || '#c98bff';
      ctx.font = '13px "Microsoft YaHei"';
      ctx.fillText('◆ ' + af.label + ' +' + af.value + (af.suffix || ''), boxX + 20, yy);
      yy += 20;
    }
  } else {
    ctx.fillStyle = '#6a7a72'; ctx.font = '13px "Microsoft YaHei"';
    ctx.fillText('该装备没有随机词条', boxX + 20, boxY + 94);
  }

  /* 消耗 */
  const cost = reforgeCostOf(eq);
  const haveStone = (p.materials && p.materials.chaos_stone) || 0;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#eaeaea'; ctx.font = '13px "Microsoft YaHei"';
  const okStone = haveStone >= cost.stone, okGold = (p.gold || 0) >= cost.gold;
  ctx.fillStyle = okStone ? '#5ee08a' : '#ff8a7a';
  ctx.fillText('混沌魔石 ' + cost.stone + ' / 持有 ' + haveStone, fx + fw/2 - 110, boxY + boxH + 34);
  ctx.fillStyle = okGold ? '#ffd166' : '#ff8a7a';
  ctx.fillText('金币 ' + cost.gold + ' / 持有 ' + (p.gold || 0), fx + fw/2 + 110, boxY + boxH + 34);

  /* 按钮 */
  const canDo = okStone && okGold && affs.length > 0;
  const btnW = 190, btnH = 42;
  const bx = fx + fw/2 - btnW/2, by = boxY + boxH + 56;
  ctx.fillStyle = canDo ? 'rgba(94,224,138,0.9)' : 'rgba(70,80,76,0.85)';
  ctx.beginPath(); ctx.roundRect(bx, by, btnW, btnH, 6); ctx.fill();
  ctx.strokeStyle = canDo ? '#c8ffdd' : 'rgba(140,150,146,0.6)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.roundRect(bx, by, btnW, btnH, 6); ctx.stroke();
  ctx.fillStyle = canDo ? '#06200f' : '#9aa6a0';
  ctx.font = 'bold 17px "Microsoft YaHei"';
  ctx.fillText('洗 练', fx + fw/2, by + 28);

  G.enhanceClickRegions.push({ x: bx, y: by, w: btnW, h: btnH, action: 'reforge' });

  /* 上次结果对比 */
  if(G.reforgeLast && G.reforgeLast.name === eq.name){
    ctx.font = '11px "Microsoft YaHei"';
    ctx.fillStyle = '#7f8f88';
    ctx.fillText('上次：' + (G.reforgeLast.before || '无'), fx + fw/2, by + btnH + 16);
    ctx.fillStyle = '#5ee08a';
    ctx.fillText('→ ' + (G.reforgeLast.after || '无'), fx + fw/2, by + btnH + 32);
  }
}

function drawAmplifyTab(p, fx, fy, fw, fh){
  const slot = amplifySelectedSlot || 'weapon';
  const eq = p.equipment[slot];

  ctx.textAlign = 'center';
  ctx.fillStyle = '#c96bff'; ctx.font = 'bold 17px "Microsoft YaHei"';
  ctx.fillText('装 备 增 幅', fx + fw/2, fy + 22);

  if(!eq){
    ctx.fillStyle = '#8fa8bc'; ctx.font = 'bold 15px "Microsoft YaHei"';
    ctx.fillText('「' + SLOT_NAMES[slot] + '」部位暂无装备', fx + fw/2, fy + 150);
    ctx.fillStyle = '#6f8b9e'; ctx.font = '12px "Microsoft YaHei"';
    ctx.fillText('先去地下城打怪掉落装备，或点击左侧其他已装备部位', fx + fw/2, fy + 180);
    return;
  }

  const ampLv = eq.amplify || 0;
  const enhLv = eq.enhance || 0;
  const tierKey = equipTierKey(eq);
  const tierObj = EQUIP_TIERS.find(t => t.id === tierKey) || EQUIP_TIERS[0];
  const cur = calcAmplifyStats(eq);
  const isMax = ampLv >= AMPLIFY_MAX_LV;
  const nextLv = Math.min(ampLv + 1, AMPLIFY_MAX_LV);
  const nxt = calcAmplifyStats(Object.assign({}, eq, { amplify: nextLv }));
  const ac = amplifyCostOf(ampLv, eq);
  if(!p.amplifyStones) p.amplifyStones = {};
  const haveStone = p.amplifyStones[ac.stone.id] || 0;
  const haveGold = p.gold || 0;

  const iconX = fx + 18, iconY = fy + 34, iconS = 70;
  ctx.fillStyle = 'rgba(24,12,26,0.75)';
  ctx.beginPath(); ctx.roundRect(iconX, iconY, iconS, iconS, 6); ctx.fill();
  ctx.strokeStyle = eq.tierColor || '#666'; ctx.lineWidth = 2; ctx.stroke();
  if(enhLv >= 10 || ampLv >= 10) drawEquipGlowRing(iconX+iconS/2, iconY+iconS/2, iconS, eq, 0.9);
  drawEquipIcon(eq.slot, eq.weaponType, iconX, iconY, iconS);

  ctx.textAlign = 'left';
  ctx.fillStyle = eq.tierColor || '#fff'; ctx.font = 'bold 17px "Microsoft YaHei"';
  ctx.fillText(eq.name, fx + 102, fy + 52);
  ctx.fillStyle = '#a89a7a'; ctx.font = '12px "Microsoft YaHei"';
  ctx.fillText(tierObj.name + '（' + (equipTierGain(eq).label) + '）　Lv.' + (eq.level||1) + '　' + SLOT_NAMES[slot], fx + 102, fy + 74);
  ctx.fillStyle = '#ff9ae0'; ctx.font = 'bold 13px "Microsoft YaHei"';
  ctx.fillText('增幅 +' + ampLv + '　／　强化 +' + enhLv, fx + 102, fy + 96);

  const glow = getEquipGlowInfo(eq);
  ctx.font = '11px "Microsoft YaHei"';
  if(glow.active){
    ctx.fillStyle = glow.mixed ? '#ffd6f2' : (glow.ampOn ? '#ff9ae0' : '#eaf6ff');
    ctx.fillText('武器光效：' + glow.label, fx + 102, fy + 116);
  } else {
    ctx.fillStyle = '#6f8b9e';
    ctx.fillText('武器光效：强化/增幅达到 +10 后开启', fx + 102, fy + 116);
  }

  /* 当前增幅属性 */
  const sx = fx + 18, sy = fy + 152;
  ctx.textAlign = 'left'; ctx.fillStyle = '#c9a2ff'; ctx.font = 'bold 12px "Microsoft YaHei"';
  ctx.fillText('当前增幅属性（异次元四维）', sx, sy - 8);
  const rows = [
    ['力量', '+' + cur.str, '#c9a2ff'],
    ['体力', '+' + cur.vit, '#c9a2ff'],
    ['转化攻击', '+' + cur.atk, '#2ee6a8'],
    ['转化生命', '+' + cur.hp, '#2ee6a8'],
    ['无视防御', '+' + cur.pierce, '#9fe6ff']
  ];
  for(let i = 0; i < rows.length; i++){
    ctx.fillStyle = '#8fa8bc'; ctx.font = '12px "Microsoft YaHei"';
    ctx.fillText(rows[i][0], sx, sy + 16 + i*21);
    ctx.fillStyle = rows[i][2]; ctx.font = 'bold 12px "Microsoft YaHei"';
    ctx.fillText(rows[i][1], sx + 96, sy + 16 + i*21);
  }

  /* 下一级预览 */
  const nx = fx + 402, ny = fy + 128, nw = fw - 420, nh = 152;
  ctx.fillStyle = 'rgba(16,8,20,0.6)';
  ctx.beginPath(); ctx.roundRect(nx, ny, nw, nh, 6); ctx.fill();
  ctx.strokeStyle = 'rgba(201,107,255,0.4)'; ctx.lineWidth = 1; ctx.stroke();
  ctx.textAlign = 'left';
  ctx.fillStyle = '#c96bff'; ctx.font = 'bold 13px "Microsoft YaHei"';
  ctx.fillText(isMax ? '已达最高增幅等级' : ('下一级：+' + (ampLv+1) + ' 提升预览'), nx + 14, ny + 24);

  if(!isMax){
    ctx.fillStyle = '#ff9ae0'; ctx.font = 'bold 12px "Microsoft YaHei"';
    ctx.fillText('成功率 ' + Math.round(amplifyRateOf(ampLv, eq)*100) + '%', nx + 14, ny + 46);
    ctx.fillStyle = '#8fa8bc'; ctx.font = '11px "Microsoft YaHei"';
    ctx.fillText('力量 +' + (nxt.str-cur.str) + '　体力 +' + (nxt.vit-cur.vit), nx + 14, ny + 70);
    ctx.fillText('攻击 +' + (nxt.atk-cur.atk) + '　生命 +' + (nxt.hp-cur.hp), nx + 14, ny + 90);
    ctx.fillText('无视防御 +' + (nxt.pierce-cur.pierce), nx + 14, ny + 110);
    ctx.fillStyle = '#6f8b9e'; ctx.font = '10px "Microsoft YaHei"';
    ctx.fillText('品阶越高，增幅四维成长越高', nx + 14, ny + nh - 12);
  } else {
    ctx.fillStyle = '#ff9ae0'; ctx.font = '11px "Microsoft YaHei"';
    ctx.fillText('增幅已达上限 +' + AMPLIFY_MAX_LV, nx + 14, ny + 52);
    ctx.fillText('粉光将保持最强状态', nx + 14, ny + 74);
  }

  /* 消耗 */
  ctx.textAlign = 'left'; ctx.font = '12px "Microsoft YaHei"';
  ctx.fillStyle = haveStone >= ac.count ? ac.stone.color : '#ff6a5a';
  ctx.fillText('需要：' + ac.stone.name + ' ×' + ac.count + '（持有 ' + haveStone + '）', fx + 18, fy + 276);
  ctx.fillStyle = haveGold >= ac.gold ? '#ffd700' : '#ff6a5a';
  ctx.fillText('金币：' + ac.gold + '（持有 ' + haveGold + '）', fx + 18, fy + 298);

  /* 按钮 */
  const canAmp = !isMax && haveStone >= ac.count && haveGold >= ac.gold;
  const btnW = 190, btnH = 44;
  const btnX = fx + fw/2 - btnW/2, btnY = fy + 318;
  const bgrd = ctx.createLinearGradient(0, btnY, 0, btnY+btnH);
  if(canAmp){ bgrd.addColorStop(0,'#e9a6ff'); bgrd.addColorStop(1,'#8b3fb0'); }
  else { bgrd.addColorStop(0,'#463a4a'); bgrd.addColorStop(1,'#281e2a'); }
  ctx.fillStyle = bgrd;
  ctx.beginPath(); ctx.roundRect(btnX, btnY, btnW, btnH, 7); ctx.fill();
  ctx.strokeStyle = canAmp ? '#ffd6f2' : '#5a4a5e'; ctx.lineWidth = 1; ctx.stroke();
  ctx.textAlign = 'center';
  ctx.fillStyle = canAmp ? '#2a0a20' : '#8a7a8e';
  ctx.font = 'bold 18px "Microsoft YaHei"';
  ctx.fillText(isMax ? '已 满 级' : '增 幅', btnX + btnW/2, btnY + 29);
  G.enhanceClickRegions.push({ x: btnX, y: btnY, w: btnW, h: btnH, action: 'amplify' });

  ctx.fillStyle = 'rgba(150,130,170,0.75)'; ctx.font = '11px "Microsoft YaHei"';
  ctx.fillText('增幅 +10 起武器出现粉色光效；增幅石由分解装备获得', fx + fw/2, fy + 390);
}

/* ★ 角色属性界面（DNF风格 - 100%还原） */
function drawCharacterInfo(){
  if(!G || !G.player) return;
  const p = G.player;

  // 全屏半透明遮罩
  ctx.fillStyle = 'rgba(0,0,0,0.9)';
  ctx.fillRect(0, 0, VW, VH);

  // 主面板尺寸：900x600，DNF标准比例
  const panelW = 900, panelH = 600;
  const panelX = (VW - panelW) / 2, panelY = (VH - panelH) / 2;

  // 面板背景：深灰蓝渐变
  const pg = ctx.createLinearGradient(panelX, panelY, panelX, panelY+panelH);
  pg.addColorStop(0,'#1a1a2e');
  pg.addColorStop(1,'#0f0f1a');
  ctx.fillStyle = pg;
  ctx.fillRect(panelX, panelY, panelW, panelH);

  // 外框：金色双层边框
  ctx.strokeStyle = '#ffd700';
  ctx.lineWidth = 2;
  ctx.strokeRect(panelX, panelY, panelW, panelH);
  ctx.strokeStyle = 'rgba(255,215,0,0.3)';
  ctx.lineWidth = 1;
  ctx.strokeRect(panelX+3, panelY+3, panelW-6, panelH-6);

  // 顶部标题栏背景
  ctx.fillStyle = 'rgba(255,215,0,0.08)';
  ctx.fillRect(panelX+3, panelY+3, panelW-6, 40);

  // 标题"个人信息"
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd700';
  ctx.font = 'bold 22px "Microsoft YaHei"';
  ctx.fillText('个 人 信 息', VW/2, panelY + 28);

  // 左右分栏：左35%，右65%
  const leftW = panelW * 0.35;
  const rightW = panelW * 0.65;
  const leftX = panelX + 15;
  const rightX = panelX + leftW + 15;
  const contentY = panelY + 50;

  // 垂直分割线
  ctx.strokeStyle = 'rgba(204,204,204,0.3)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(panelX + leftW + 5, contentY);
  ctx.lineTo(panelX + leftW + 5, panelY + panelH - 55);
  ctx.stroke();

  // ========== 左侧面板 ==========
  let ly = contentY;

  // 角色名和职业
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 16px "Microsoft YaHei"';
  ctx.fillText(p.name || '角色', leftX, ly + 18);

  const weaponIdx = p.weaponIdx || 0;
  const jobTitle = JOB_TITLE[weaponIdx] || '未知职业';
  ctx.fillStyle = '#cccccc';
  ctx.font = '14px "Microsoft YaHei"';
  ctx.fillText('Lv.' + p.level + ' ' + jobTitle, leftX, ly + 38);

  ly += 50;

  // 经验条
  const expNeed = getExpNeed(p.level);
  const expPct = Math.min(1, (p.exp||0) / expNeed);
  const expBarW = leftW - 30;
  const expBarX = leftX;
  const expBarY = ly;

  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(expBarX, expBarY, expBarW, 10);
  ctx.fillStyle = '#4CAF50';
  ctx.fillRect(expBarX, expBarY, expBarW * expPct, 10);
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 1;
  ctx.strokeRect(expBarX, expBarY, expBarW, 10);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#ffffff';
  ctx.font = '11px "Microsoft YaHei"';
  ctx.fillText('EXP ' + (p.exp||0) + ' / ' + expNeed, expBarX + expBarW, expBarY + 22);

  ly += 35;

  // 装备栏：3x3网格，每格60x60
  const eqSlots = [
    {slot:'head', name:'头盔'}, {slot:'necklace', name:'项链'}, {slot:'armor', name:'上衣'},
    {slot:'pants', name:'下装'}, {slot:'belt', name:'腰带'}, {slot:'shoes', name:'鞋子'},
    {slot:'bracer', name:'手镯'}, {slot:'ring', name:'戒指'}, {slot:'weapon', name:'武器'}
  ];

  const eqCellSize = 58;
  const eqGap = 5;
  const eqStartX = leftX;
  const eqStartY = ly;

  for(let i = 0; i < eqSlots.length; i++){
    const col = i % 3;
    const row = Math.floor(i / 3);
    const cx = eqStartX + col * (eqCellSize + eqGap);
    const cy = eqStartY + row * (eqCellSize + eqGap);
    const slot = eqSlots[i].slot;
    const eq = p.equipment[slot];

    // 格子背景
    ctx.fillStyle = eq ? '#1e2840' : '#141928';
    ctx.fillRect(cx, cy, eqCellSize, eqCellSize);

    // 边框：有装备用彩色，无装备用灰色
    if(eq){
      ctx.strokeStyle = eq.tierColor || '#666';
      ctx.lineWidth = 2;
    } else {
      ctx.strokeStyle = 'rgba(100,120,150,0.3)';
      ctx.lineWidth = 1;
    }
    ctx.strokeRect(cx, cy, eqCellSize, eqCellSize);

    // 装备图标
    if(eq){
      ctx.save();
      ctx.globalAlpha = 0.95;
      drawEquipIcon(eq.slot, eq.weaponType, cx + 6, cy + 6, eqCellSize - 12);
      ctx.restore();

      // 强化等级（右下角黄色）
      if(eq.enhance > 0){
        ctx.fillStyle = 'rgba(0,0,0,0.8)';
        ctx.fillRect(cx + 2, cy + eqCellSize - 16, 24, 14);
        ctx.fillStyle = '#ffd700';
        ctx.font = 'bold 11px "Microsoft YaHei"';
        ctx.textAlign = 'left';
        ctx.fillText('+' + eq.enhance, cx + 4, cy + eqCellSize - 5);
      }
    } else {
      // 空槽位：半透明图标
      ctx.globalAlpha = 0.15;
      drawEquipIcon(slot, 'sword', cx + 12, cy + 12, eqCellSize - 24);
      ctx.globalAlpha = 1;
    }
  }

  ly = eqStartY + 3 * (eqCellSize + eqGap) + 15;

  // HP/MP条：高度20px
  const hpPct = (p.hp || 0) / (p.maxHp || 1);
  const mpPct = (p.mp || 0) / (p.maxMp || 1);
  const barW = leftW - 30;

  // HP条
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(leftX, ly, barW, 20);
  ctx.fillStyle = '#F44336';
  ctx.fillRect(leftX, ly, barW * hpPct, 20);
  ctx.strokeStyle = '#8B0000';
  ctx.lineWidth = 1;
  ctx.strokeRect(leftX, ly, barW, 20);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 13px "Microsoft YaHei"';
  ctx.fillText('HP ' + Math.ceil(p.hp) + ' / ' + p.maxHp, leftX + barW/2, ly + 14);

  ly += 22;

  // MP条
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(leftX, ly, barW, 20);
  ctx.fillStyle = '#2196F3';
  ctx.fillRect(leftX, ly, barW * mpPct, 20);
  ctx.strokeStyle = '#00008B';
  ctx.lineWidth = 1;
  ctx.strokeRect(leftX, ly, barW, 20);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 13px "Microsoft YaHei"';
  ctx.fillText('MP ' + Math.ceil(p.mp) + ' / ' + p.maxMp, leftX + barW/2, ly + 14);

  // ========== 右侧面板 ==========
  let ry = contentY;

  // 战斗力值显示区
  ctx.fillStyle = 'rgba(255,215,0,0.05)';
  ctx.fillRect(rightX, ry, rightW - 30, 70);
  ctx.strokeStyle = 'rgba(255,215,0,0.3)';
  ctx.lineWidth = 1;
  ctx.strokeRect(rightX, ry, rightW - 30, 70);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = '15px "Microsoft YaHei"';
  ctx.fillText('我的战斗力值', rightX + (rightW-30)/2, ry + 20);

  ctx.fillStyle = '#ffd700';
  ctx.font = 'bold 42px "Microsoft YaHei"';
  ctx.fillText(totalPower(p).toLocaleString(), rightX + (rightW-30)/2, ry + 58);

  ry += 80;

  // 属性行绘制函数
  function drawStatLine(icon, label, value, color, y){
    ctx.textAlign = 'left';
    ctx.fillStyle = '#aaaaaa';
    ctx.font = '13px "Microsoft YaHei"';
    ctx.fillText(icon, rightX + 5, y);
    ctx.fillText(label, rightX + 25, y);
    ctx.textAlign = 'right';
    ctx.fillStyle = color;
    ctx.font = 'bold 13px "Microsoft YaHei"';
    ctx.fillText(value, rightX + rightW - 35, y);
  }

  // 分区标题函数
  function drawSectionTitle(title, y){
    ctx.fillStyle = 'rgba(255,215,0,0.08)';
    ctx.fillRect(rightX, y, rightW - 30, 22);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px "Microsoft YaHei"';
    ctx.fillText(title, rightX + 8, y + 15);
    return y + 26;
  }

  const num = (v) => Math.round(v || 0).toLocaleString();
  const pct = (v) => (Math.round((v || 0) * 10) / 10) + '%';

  // 四维属性
  ry = drawSectionTitle('⚡ 四维属性', ry);
  drawStatLine('✕', '力量', num(p.statStr), '#F44336', ry); ry += 18;
  drawStatLine('◆', '智力', num(p.statInt), '#9C27B0', ry); ry += 18;
  drawStatLine('♥', '体力', num(p.statVit), '#4CAF50', ry); ry += 18;
  drawStatLine('◇', '精神', num(p.statSpr), '#2196F3', ry); ry += 22;

  // 攻击属性
  const w = WEAPONS[weaponIdx];
  const realAtk = Math.round(p.atk * w.atkMul);
  const critPct = Math.round((p.critBonus || 0) * 100);

  ry = drawSectionTitle('⚔ 攻击属性', ry);
  drawStatLine('\\', '物理攻击', num(p.statPatk), '#ffffff', ry); ry += 18;
  drawStatLine('◇', '魔法攻击', num(p.statMatk), '#ffffff', ry); ry += 18;
  drawStatLine('⚡', '独立攻击', num(realAtk), '#ffffff', ry); ry += 18;
  drawStatLine('*', '物理暴击', critPct + '%', '#E91E63', ry); ry += 18;
  drawStatLine('⊕', '攻击速度', '+' + pct(p.statAtkSpd), '#4CAF50', ry); ry += 18;
  drawStatLine('—', '暴击伤害', '+' + num(p.statCritDmg) + '%', '#4CAF50', ry); ry += 22;

  // 防御属性
  const defVal = Math.round(p.def || 0);
  const spdVal = Math.round(p.moveSpeed || 0);

  ry = drawSectionTitle('🛡 防御属性', ry);
  drawStatLine('○', '物理防御', num(defVal), '#ffffff', ry); ry += 18;
  drawStatLine('◇', '魔法防御', num(p.statMdef), '#ffffff', ry); ry += 18;
  drawStatLine('⊕', '命中率', '+' + pct(p.statHit), '#4CAF50', ry); ry += 18;
  drawStatLine('○', '回避率', '+' + pct(p.statDodge), '#4CAF50', ry); ry += 18;
  drawStatLine('➤', '移动速度', num(spdVal), '#00BCD4', ry); ry += 22;

  // 词条加成
  ry = drawSectionTitle('📜 词条加成', ry);
  drawStatLine('', '伤害增加', '+' + num(p.statDmgBonus) + '%', '#4CAF50', ry); ry += 18;
  drawStatLine('◆', '附加伤害', '+' + num(p.statAddDmg) + '%', '#4CAF50', ry); ry += 18;
  drawStatLine('➤', '穿透', num(p.pierce), '#ffffff', ry); ry += 18;
  drawStatLine('⊕', '冷却缩减', '+' + num(p.cdReducePct) + '%', '#aaaaaa', ry); ry += 18;
  drawStatLine('♥', '吸血', '+' + pct((p.lifesteal || 0) * 100), '#aaaaaa', ry); ry += 22;

  // 金币和击杀
  ctx.fillStyle = 'rgba(255,215,0,0.05)';
  ctx.fillRect(rightX, ry, rightW - 30, 36);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#FFC107';
  ctx.font = '12px "Microsoft YaHei"';
  ctx.fillText('💰 金币: ' + (p.gold || 0).toLocaleString(), rightX + 8, ry + 15);
  ctx.fillStyle = '#ffffff';
  ctx.fillText('💀 击杀: ' + (G.totalKills || 0), rightX + 8, ry + 30);

  // 关闭按钮：右上角 X
  const closeSize = 32;
  const closeX = panelX + panelW - closeSize - 8;
  const closeY = panelY + 8;

  // 绘制 X 按钮背景
  ctx.fillStyle = 'rgba(255,215,0,0.15)';
  ctx.beginPath();
  ctx.roundRect(closeX, closeY, closeSize, closeSize, 6);
  ctx.fill();
  ctx.strokeStyle = '#ffd700';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // 绘制 X 符号
  ctx.strokeStyle = '#ffd700';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(closeX + 8, closeY + 8);
  ctx.lineTo(closeX + closeSize - 8, closeY + closeSize - 8);
  ctx.moveTo(closeX + closeSize - 8, closeY + 8);
  ctx.lineTo(closeX + 8, closeY + closeSize - 8);
  ctx.stroke();

  // 注册点击区域
  if(!G.charInfoClickRegions) G.charInfoClickRegions = [];
  G.charInfoClickRegions = [
    { x: closeX, y: closeY, w: closeSize, h: closeSize, action: 'back' }
  ];
}

function initTown(){
  /* ★ 固定出生点：不管上次存在哪儿，所有角色都从中央主城「引灯亭」旁
       （引灯人·阿箬脚下）进城。存档只保证数据对，不记位置。 */
  {
    const sp = (window.CloudSave && window.CloudSave.fixedSpawn)
      ? window.CloudSave.fixedSpawn()
      : ((TOWN_DEFS_BY_KEY && TOWN_DEFS_BY_KEY.center) || TOWN_DEFS[0]).spawn;
    townPlayer = { x: sp.x, y: sp.y, facing: 1, moveSpeed: 260, walkPhase: 0, state: 'idle' };
    /* 出城/切镇用：把当前镇标记为主城，避免地图错位 */
    try{ if(sp.townKey && typeof setTownKey === 'function') setTownKey(sp.townKey); }catch(e){}
  }
  townCam.x = clamp(townPlayer.x - VW/2, 0, Math.max(0, TOWN_W - VW));
  townCam.y = clamp(townPlayer.y - VH/2, 0, Math.max(0, TOWN_H - VH));
  /* 城镇保留触屏层：摇杆走路、普攻键＝交互、技能槽按已学情况显示 */
  if(window.showTouchControls) window.showTouchControls(false);
}

function updateTown(dt){
  if(!townPlayer) return;
  // 移动控制（键盘+虚拟摇杆）：八方向自由行走
  let dx = 0, dy = 0;
  if(keys['KeyA'] || keys['ArrowLeft'])  dx -= 1;
  if(keys['KeyD'] || keys['ArrowRight']) dx += 1;
  if(keys['KeyW'] || keys['ArrowUp'])    dy -= 1;
  if(keys['KeyS'] || keys['ArrowDown'])  dy += 1;
  // 虚拟摇杆支持
  if(touchState.p1 && touchState.p1.active){
    dx += touchState.p1.x;
    dy += touchState.p1.y;
  }
  const moving = (dx !== 0 || dy !== 0);
  if(moving){
    const len = Math.hypot(dx, dy) || 1;
    townPlayer.x += dx / len * townPlayer.moveSpeed * dt;
    townPlayer.y += dy / len * townPlayer.moveSpeed * dt * 0.72;   /* 纵向略慢，走街道的纵深感 */
    if(Math.abs(dx) > 0.1) townPlayer.facing = dx > 0 ? 1 : -1;
    townPlayer.walkPhase += dt * 8;
    townPlayer.state = 'walk';
  } else {
    townPlayer.state = 'idle';
  }
  townPlayer.x = clamp(townPlayer.x, 60, TOWN_W - 60);
  townPlayer.y = clamp(townPlayer.y, 200, TOWN_H - 70);

  /* ★ 建筑碰撞：进入建筑占地矩形时沿最浅轴推出（不能穿墙） */
  for(const b of TOWN_BUILDINGS){
    if(!TOWN_SOLID_KINDS[b.kind]) continue;
    const rx0 = b.x - b.w/2, rx1 = b.x + b.w/2;
    const ry0 = b.y - b.h,   ry1 = b.y;
    const px = townPlayer.x, py = townPlayer.y;
    if(px > rx0 && px < rx1 && py > ry0 && py < ry1){
      const dl = px - rx0, dr = rx1 - px, du = py - ry0, dd = ry1 - py;
      const m = Math.min(dl, dr, du, dd);
      if(m === dd) townPlayer.y = ry1;         /* 从前方（下）顶出 → 站到门前 */
      else if(m === du) townPlayer.y = ry0;
      else if(m === dl) townPlayer.x = rx0;
      else townPlayer.x = rx1;
    }
  }

  /* ★ 镜头平滑跟随 */
  const tx = clamp(townPlayer.x - VW/2, 0, Math.max(0, TOWN_W - VW));
  const ty = clamp(townPlayer.y - VH/2, 0, Math.max(0, TOWN_H - VH));
  townCam.x += (tx - townCam.x) * Math.min(1, dt * 6);
  townCam.y += (ty - townCam.y) * Math.min(1, dt * 6);

  /* 街道吸附微引导：靠近街道中心线时轻轻往路上带（不锁死，草地也能走） */
  void 0;

  // NPC交互检测（按J键，全地图就近）
  if(pressed['KeyJ']){
    pressed['KeyJ'] = false;
    const best = townNearestNpc();
    if(best) triggerNpc(best);
  }
}

/* 就近 NPC：80px 内可交互 */
function townNearestNpc(){
  if(!townPlayer) return null;
  let best = null, bestD = 1e9;
  for(const npc of NPCS){
    const d = Math.hypot(townPlayer.x - npc.x, (townPlayer.y - npc.y) * 1.6);
    if(d < 110 && d < bestD){ bestD = d; best = npc; }
  }
  return best;
}

/* 地下城选择菜单 */
let dungeonSelectClickRegions = [];

/* 背包系统 */
/* ============================================================
   ★ DNF 式装备详情卡
   —— 四维 / 三攻 / 双防 / 暴击命中回避三速 / 随机词条
   —— 绿色括号 = 强化+增幅带来的额外增量
   ============================================================ */
const CARD_ROWS = [
  { k:'patk',    n:'物理攻击力', c:'#ff9a6b', f:'i' },
  { k:'matk',    n:'魔法攻击力', c:'#7fb8ff', f:'i' },
  { k:'pdef',    n:'物理防御力', c:'#8fd2ff', f:'i' },
  { k:'mdef',    n:'魔法防御力', c:'#8fd2ff', f:'i' },
  { k:'str',     n:'力量',       c:'#ff7676', f:'i' },
  { k:'int',     n:'智力',       c:'#b18bff', f:'i' },
  { k:'vit',     n:'体力',       c:'#5ee08a', f:'i' },
  { k:'spr',     n:'精神',       c:'#6ab7ff', f:'i' },
  { k:'hp',      n:'生命值',     c:'#5ee08a', f:'i' },
  { k:'mp',      n:'内力值',     c:'#6ab7ff', f:'i' },
  { k:'spd',     n:'移速加成',   c:'#ffd166', f:'i' },
  { k:'pcrit',   n:'物理暴击',   c:'#ff7bc0', f:'p' },
  { k:'hit',     n:'命中率',     c:'#ffd166', f:'p' },
  { k:'dodge',   n:'回避率',     c:'#5ee08a', f:'p' },
  { k:'atkSpd',  n:'攻击速度',   c:'#ffd166', f:'p' },
  { k:'castSpd', n:'施放速度',   c:'#b18bff', f:'p' },
  { k:'moveSpd', n:'移动速度',   c:'#5ee08a', f:'p' }
];
const AFFIX_COLOR = {
  dmgBonus:'#ff8f5c', addDmg:'#c98bff', critDmg:'#ff6b6b', pierce:'#9fe6ff',
  elemFire:'#ff7a45', elemIce:'#5fd3ff', elemLight:'#ffe066', elemDark:'#b388ff',
  atkSpd:'#ffd166', moveSpd:'#5ee08a', hit:'#ffd166', dodge:'#5ee08a',
  lifesteal:'#ff6b9d', cdReduce:'#7fd4ff'
};

function hexA(hex, a){
  if(!hex || hex.charAt(0) !== '#') return 'rgba(200,200,200,' + a + ')';
  let h = hex.slice(1);
  if(h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
  const n = parseInt(h, 16);
  return 'rgba(' + ((n>>16)&255) + ',' + ((n>>8)&255) + ',' + (n&255) + ',' + a + ')';
}

function cardVal(v, f){
  if(f === 'p'){ const n = Math.round(v*10)/10; return (n >= 0 ? '+' : '') + n + '%'; }
  const n = Math.round(v);
  return (n >= 0 ? '+' : '') + n;
}

/* 强化 0 / 增幅 0 的对照面板，用于算增量 */
function equipBaseStats(eq){
  if(!eq) return null;
  if(!eq.dnf) rollEquipDnf(eq);
  const c = Object.assign({}, eq);
  c.enhance = 0; c.amplify = 0;
  return equipFullStats(c);
}

function drawCardSep(x, y, w, color){
  ctx.save();
  ctx.strokeStyle = color; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x, y+0.5); ctx.lineTo(x+w, y+0.5); ctx.stroke();
  ctx.restore();
}

/* 主渲染：返回实际高度 */
/* 套装效果的文本化（详情卡与任务面板共用） */
const SET_STAT_NAME = {
  str:'力量', int:'智力', vit:'体力', spr:'精神',
  patk:'物攻', matk:'魔攻', pdef:'物防', mdef:'魔防',
  pcrit:'暴击', hit:'命中', dodge:'回避',
  atkSpd:'攻速', castSpd:'施放', moveSpd:'移速',
  hp:'生命', mp:'内力',
  dmgBonus:'伤害增加', addDmg:'附加伤害', critDmg:'暴击伤害',
  pierce:'无视防御', lifesteal:'生命汲取', cdReduce:'冷却缩减',
  elemFire:'火属性强化', elemIce:'冰属性强化', elemLight:'光属性强化', elemDark:'暗属性强化'
};
const SET_STAT_SUFFIX = {
  pcrit:'%', hit:'%', dodge:'%', atkSpd:'%', castSpd:'%', moveSpd:'%',
  dmgBonus:'%', addDmg:'%', critDmg:'%', lifesteal:'%', cdReduce:'%'
};
function setBonusText(obj){
  if(!obj) return '';
  const parts = [];
  for(const k in obj){
    const v = obj[k];
    if(!v) continue;
    parts.push((SET_STAT_NAME[k] || k) + (v > 0 ? '+' : '') + v + (SET_STAT_SUFFIX[k] || ''));
  }
  return parts.join('  ');
}

function drawEquipCard(eq, ax, ay, opt){
  opt = opt || {};
  if(!eq) return 0;
  if(!eq.dnf) rollEquipDnf(eq);
  const cur  = equipFullStats(eq);
  const base = equipBaseStats(eq) || cur;

  const W = opt.w || 340;
  const PAD = 11, LH = 15;
  const tierColor = eq.tierColor || '#cccccc';
  const ICON = 60;

  /* 只列有数值的行，避免卡片过长 */
  const rows = [];
  for(const r of CARD_ROWS){
    const cv = cur[r.k] || 0, bv = base[r.k] || 0;
    if(Math.abs(cv) < 0.05 && Math.abs(bv) < 0.05) continue;
    rows.push({
      label: r.n, color: r.c, val: cardVal(cv, r.f),
      delta: (Math.abs(cv - bv) >= 0.05) ? cardVal(cv - bv, r.f) : ''
    });
  }
  const affixes = eq.affixes || [];
  const enhLv = eq.enhance || 0, ampLv = eq.amplify || 0;
  const dAtk = cur.patk - base.patk, dDef = cur.pdef - base.pdef, dHp = cur.hp - base.hp;
  const dStr = cur.str - base.str, dVit = cur.vit - base.vit;
  const showDetail = (enhLv > 0 || ampLv > 0 || opt.alwaysDetail);

  /* 套装信息 */
  const setDef = eq.setId ? SET_BY_ID[eq.setId] : null;
  const setInfo = setDef
      ? setPieceInfo(opt.equipment || (G && G.player ? G.player.equipment : null), eq.setId)
      : null;

  /* 双列属性，高度砍半 */
  const cols = (W >= 330) ? 2 : 1;
  const colGap = 12;
  const colW = (W - PAD*2 - (cols-1)*colGap) / cols;
  const perCol = cols === 1 ? rows.length : Math.ceil(rows.length / cols);
  const rowsH = perCol * LH;

  const headH = ICON + 16;
  let H = PAD + headH + 6 + rowsH;
  if(affixes.length) H += 9 + 13 + affixes.length * LH;
  if(setDef) H += 9 + 13 + 2 * LH;
  if(showDetail) H += 9 + 13 + (ampLv > 0 ? 13 : 0);
  if(eq.sysGift) H += 13;   /* ★ 系统赠送标记行 */
  H += PAD - 2;
  const fullH = H;
  if(opt.maxH && H > opt.maxH) H = opt.maxH;

  let x = ax, y = ay;
  if(!opt.noClamp){
    if(x + W > VW - 6) x = VW - 6 - W;
    if(y + H > VH - 6) y = Math.max(6, VH - 6 - H);
    if(x < 6) x = 6;
    if(y < 6) y = 6;
  }

  ctx.save();
  ctx.textAlign = 'left';

  /* 底板 + 顶部品阶色 + 双层描边 */
  ctx.fillStyle = 'rgba(6,8,16,0.97)';
  ctx.beginPath(); ctx.roundRect(x, y, W, H, 5); ctx.fill();
  ctx.save();
  ctx.beginPath(); ctx.roundRect(x, y, W, H, 5); ctx.clip();
  const gr = ctx.createLinearGradient(x, y, x, y + 92);
  gr.addColorStop(0, hexA(tierColor, 0.30));
  gr.addColorStop(0.55, hexA(tierColor, 0.10));
  gr.addColorStop(1, hexA(tierColor, 0));
  ctx.fillStyle = gr; ctx.fillRect(x, y, W, 92);
  ctx.restore();
  ctx.strokeStyle = hexA(tierColor, 0.88); ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.roundRect(x+0.5, y+0.5, W-1, H-1, 5); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.07)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.roundRect(x+3.5, y+3.5, W-7, H-7, 4); ctx.stroke();

  if(H < fullH){ ctx.beginPath(); ctx.roundRect(x, y, W, H, 5); ctx.clip(); }

  /* ---------- 头部：图标 + 名称 + 职业/品阶 + 战力 ---------- */
  const ix = x + PAD, iy = y + PAD;
  /* 图标底框（品阶渐变） */
  const boxG = ctx.createLinearGradient(ix, iy, ix, iy + ICON);
  boxG.addColorStop(0, hexA(tierColor, 0.26));
  boxG.addColorStop(1, 'rgba(4,6,12,0.95)');
  ctx.fillStyle = boxG;
  ctx.beginPath(); ctx.roundRect(ix, iy, ICON, ICON, 4); ctx.fill();
  ctx.strokeStyle = hexA(tierColor, 0.75); ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.roundRect(ix + 0.5, iy + 0.5, ICON - 1, ICON - 1, 4); ctx.stroke();
  /* 品阶角标（左下小菱形） */
  ctx.fillStyle = tierColor;
  ctx.beginPath();
  ctx.moveTo(ix + 7, iy + ICON - 9); ctx.lineTo(ix + 10, iy + ICON - 6);
  ctx.lineTo(ix + 7, iy + ICON - 3); ctx.lineTo(ix + 4, iy + ICON - 6);
  ctx.closePath(); ctx.fill();
  /* 装备图标本体 */
  ctx.save();
  ctx.globalAlpha = 0.96;
  drawEquipIcon(eq.slot, eq.weaponType, ix + 5, iy + 5, ICON - 10);
  ctx.restore();

  const tx = ix + ICON + 11;
  let ty = iy + 14;
  /* 名称：强化前缀 + 品阶色 */
  ctx.font = 'bold 15px "Microsoft YaHei"';
  ctx.fillStyle = tierColor;
  const nameStr = (enhLv > 0 ? '+' + enhLv + ' ' : '') + (eq.name || '');
  ctx.fillText(nameStr, tx, ty);

  /* 副标题：部位 · 品阶 · 等级 · 品级 */
  ty += 16;
  ctx.font = '11px "Microsoft YaHei"';
  ctx.fillStyle = '#8ea6c0';
  ctx.fillText((SLOT_NAMES[eq.slot] || '') + ' · ' + eq.tierName + ' · Lv.' + eq.level, tx, ty);
  ty += 13;
  /* 品级（最上级等）+ 强化增幅徽标 */
  ctx.fillStyle = (eq.grade === '最上级' ? '#ffd166' : '#6f8398');
  ctx.fillText(eq.grade || '', tx, ty);
  if(ampLv > 0){
    ctx.fillStyle = '#ff9ae0';
    ctx.fillText('增幅+' + ampLv, tx + 52, ty);
  }
  /* ★ 系统赠送标记 */
  if(eq.sysGift){
    ty += 13;
    ctx.fillStyle = '#ff8a7a';
    ctx.font = '10px "Microsoft YaHei"';
    ctx.fillText('系统赠送 · 不可分解/出售/交易', tx, ty);
  }
  /* 战力 */
  ty += 15;
  ctx.font = 'bold 12px "Microsoft YaHei"';
  ctx.fillStyle = '#ffcf6b';
  ctx.fillText('战力 ' + equipScore(eq).toLocaleString(), tx, ty);

  let cy = y + PAD + headH;
  drawCardSep(x + PAD, cy, W - PAD*2, hexA(tierColor, 0.35));
  cy += 11;

  /* 属性行（单列 / 双列） */
  for(let i = 0; i < rows.length; i++){
    const r = rows[i];
    const col = cols === 1 ? 0 : Math.floor(i / perCol);
    const row = cols === 1 ? i : (i % perCol);
    const x0 = x + PAD + col * (colW + colGap);
    const ly = cy + row * LH;
    ctx.textAlign = 'left';
    ctx.font = '12px "Microsoft YaHei"';
    ctx.fillStyle = '#93a5b8';
    ctx.fillText(r.label, x0, ly);
    ctx.fillStyle = r.color;
    ctx.fillText(r.val, x0 + Math.min(96, colW * 0.52), ly);
    if(r.delta){
      ctx.textAlign = 'right';
      ctx.font = '11px "Microsoft YaHei"';
      ctx.fillStyle = '#5ee08a';
      ctx.fillText('(' + r.delta + ')', x0 + colW, ly);
    }
  }
  cy += rowsH;

  /* 随机词条 */
  if(affixes.length){
    cy += 7;
    ctx.textAlign = 'left';
    ctx.font = 'bold 11px "Microsoft YaHei"';
    ctx.fillStyle = '#c9a84c';
    ctx.fillText('随机词条', x + PAD, cy);
    cy += 13;
    for(const af of affixes){
      ctx.font = '12px "Microsoft YaHei"';
      ctx.fillStyle = AFFIX_COLOR[af.key] || '#c98bff';
      ctx.fillText('◆ ' + af.label + ' +' + af.value + (af.suffix || ''), x + PAD, cy);
      cy += LH;
    }
  }

  /* 套装信息 */
  if(setDef){
    cy += 7;
    drawCardSep(x + PAD, cy, W - PAD*2, hexA(tierColor, 0.22));
    ctx.textAlign = 'left';
    ctx.font = 'bold 12px "Microsoft YaHei"';
    ctx.fillStyle = setDef.color;
    ctx.fillText('【' + setDef.name + '】', x + PAD, cy + 12);
    ctx.textAlign = 'right';
    ctx.font = 'bold 11px "Microsoft YaHei"';
    ctx.fillStyle = setInfo.active4 ? '#5ee08a' : (setInfo.active2 ? '#a9e08a' : '#7b8b9b');
    ctx.fillText('(' + setInfo.count + '/4)', x + W - PAD, cy + 12);
    ctx.textAlign = 'left';
    cy += 26;
    const bMul = setBonusMul(opt.equipment || (G && G.player ? G.player.equipment : null), eq.setId);
    const lines = [
      { need:2, text:'2 件：' + setBonusText(scaleSetBonus(setDef.bonus2, bMul)), on:setInfo.active2 },
      { need:4, text:'4 件：' + setBonusText(scaleSetBonus(setDef.bonus4, bMul)), on:setInfo.active4 }
    ];
    for(const ln of lines){
      ctx.font = '11px "Microsoft YaHei"';
      ctx.fillStyle = ln.on ? '#8ae0a8' : '#5b6b7a';
      ctx.fillText(ln.text, x + PAD, cy);
      cy += LH;
    }
  }

  /* 强化 / 增幅 提升明细 */
  if(showDetail){
    cy += 6;
    drawCardSep(x + PAD, cy, W - PAD*2, hexA(tierColor, 0.28));
    cy += 12;
    ctx.textAlign = 'left';
    ctx.font = '11px "Microsoft YaHei"';
    ctx.fillStyle = enhLv > 0 ? '#ffd700' : '#57636f';
    ctx.fillText('强化 +' + enhLv, x + PAD, cy);
    ctx.fillStyle = enhLv > 0 ? '#9fe6c0' : '#495460';
    ctx.fillText(enhLv > 0
        ? ('攻击+' + Math.round(dAtk) + '  防御+' + Math.round(dDef) + '  生命+' + Math.round(dHp) + '  穿透+' + Math.round(cur.pierce - base.pierce))
        : '未强化', x + 66, cy);
    if(ampLv > 0){
      cy += 13;
      ctx.fillStyle = '#ff9ae0';
      ctx.fillText('增幅 +' + ampLv, x + PAD, cy);
      ctx.fillStyle = '#ffc6ef';
      ctx.fillText('力量+' + Math.round(dStr) + '  体力+' + Math.round(dVit), x + 66, cy);
    }
  }

  ctx.restore();
  return H;
}


function drawEquipTooltip(){
  if(!MOUSE.in || !equipHoverRegions || !equipHoverRegions.length) return;
  const r = hitTestRegion(MOUSE.x, MOUSE.y, equipHoverRegions);
  if(!r || !r.equip) return;
  const W = 356;
  let x = MOUSE.x + 22;
  if(x + W > VW - 8) x = MOUSE.x - W - 22;
  if(x < 8) x = 8;
  drawEquipCard(r.equip, x, MOUSE.y + 14, { w: W });
}

/* ★ 穿戴对比：已穿戴 vs 背包选中，逐条显示增减 */
function drawEquipCompare(newEq, curEq, ax, ay, w){
  if(!newEq || !curEq) return 0;
  const a = equipFullStats(newEq), b = equipFullStats(curEq);
  const rows = [];
  for(const r of CARD_ROWS){
    const av = a[r.k] || 0, bv = b[r.k] || 0;
    if(Math.abs(av - bv) < 0.05) continue;
    rows.push({ n:r.n, d:av - bv, f:r.f });
  }
  const pA = equipScore(newEq), pB = equipScore(curEq);
  const LH = 16, PAD = 10;
  const H = PAD*2 + 20 + rows.length * LH + 6;
  ctx.save();
  ctx.fillStyle = 'rgba(10,14,26,0.92)';
  ctx.beginPath(); ctx.roundRect(ax, ay, w, H, 6); ctx.fill();
  ctx.strokeStyle = 'rgba(201,168,76,0.4)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.roundRect(ax + 0.5, ay + 0.5, w - 1, H - 1, 6); ctx.stroke();
  ctx.textAlign = 'left';
  ctx.font = 'bold 12px "Microsoft YaHei"';
  const dp = Math.round(pA - pB);
  ctx.fillStyle = '#ffd166';
  ctx.fillText('与已穿戴对比', ax + PAD, ay + 16);
  ctx.textAlign = 'right';
  ctx.fillStyle = dp > 0 ? '#5ee08a' : (dp < 0 ? '#ff7a6a' : '#8ea6b8');
  ctx.fillText('战力 ' + (dp >= 0 ? '+' : '') + dp, ax + w - PAD, ay + 16);
  ctx.textAlign = 'left';
  let y = ay + 34;
  for(const row of rows){
    const up = row.d > 0;
    ctx.font = '11px "Microsoft YaHei"';
    ctx.fillStyle = '#a9bccd';
    ctx.fillText(row.n, ax + PAD, y);
    ctx.textAlign = 'right';
    ctx.fillStyle = up ? '#5ee08a' : '#ff7a6a';
    ctx.font = 'bold 11px "Microsoft YaHei"';
    ctx.fillText((up ? '▲ ' : '▼ ') + cardVal(Math.abs(row.d), row.f).replace('+',''), ax + w - PAD, y);
    ctx.textAlign = 'left';
    y += LH;
  }
  ctx.restore();
  return H;
}

/* ★ 精简对比条：战力差 + 差异最大的前几条属性，横排两行，放在双卡下方 */
function drawCompareStrip(newEq, curEq, ax, ay, w){
  if(!newEq || !curEq) return;
  const a = equipFullStats(newEq), b = equipFullStats(curEq);
  const deltas = [];
  for(const r of CARD_ROWS){
    const dv = (a[r.k] || 0) - (b[r.k] || 0);
    if(Math.abs(dv) < 0.05) continue;
    deltas.push({ n:r.n, d:dv, f:r.f });
  }
  deltas.sort((x, y) => Math.abs(y.d) - Math.abs(x.d));
  const dp = Math.round(equipScore(newEq) - equipScore(curEq));
  const H = 46;
  ctx.save();
  ctx.fillStyle = 'rgba(10,14,26,0.92)';
  ctx.beginPath(); ctx.roundRect(ax, ay, w, H, 6); ctx.fill();
  ctx.strokeStyle = 'rgba(201,168,76,0.45)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.roundRect(ax + 0.5, ay + 0.5, w - 1, H - 1, 6); ctx.stroke();
  ctx.textAlign = 'left';
  ctx.font = 'bold 12px "Microsoft YaHei"';
  ctx.fillStyle = '#ffd166';
  ctx.fillText('对比结论', ax + 10, ay + 18);
  ctx.fillStyle = dp > 0 ? '#5ee08a' : (dp < 0 ? '#ff7a6a' : '#8ea6b8');
  ctx.fillText('战力 ' + (dp >= 0 ? '+' : '') + dp, ax + 78, ay + 18);
  ctx.font = '11px "Microsoft YaHei"';
  ctx.fillStyle = '#a9bccd';
  const line = deltas.slice(0, 8)
    .map(r => r.n + ' ' + (r.d > 0 ? '+' : '') + cardVal(r.d, r.f).replace(/^\+/, ''))
    .join('　');
  ctx.fillText(line || '两件装备属性相同', ax + 10, ay + 37);
  ctx.restore();
}
/* ★ 背包容量上限 */
const BAG_CAPACITY = 30;
const BAG_WARN_THRESHOLD = 25;  /* 达到此数量时弹出提醒 */
let bagWarnShown = false;        /* 本次登录是否已提醒过（避免反复弹窗） */
function isBagFull(){ return G && G.player && (G.player.inventory || []).length >= BAG_CAPACITY; }
function isBagNearlyFull(){ return G && G.player && (G.player.inventory || []).length >= BAG_WARN_THRESHOLD; }
function bagSpaceLeft(){ return BAG_CAPACITY - (G && G.player ? (G.player.inventory || []).length : 0); }

let inventoryClickRegions = [];
let inventoryTab = 'equipment'; // equipment / material / consumable
let enhanceSelectedSlot = 'weapon';
let blacksmithTab = 'enhance'; // 'enhance', 'decompose', 'amplify'
let decomposeSelectedIndex = -1; // 分解选中的背包物品索引（保留兼容）
let decomposeSelectedIndices = []; // 分解选中的背包物品索引列表（支持多选）
let amplifySelectedSlot = 'weapon'; // 增幅选中的装备槽位
let reforgeSelectedSlot = 'weapon'; // 洗练选中的装备槽位
let inventorySelectedIndex = -1; // 背包中选中的装备索引
let selectedMaterial = null; // 选中的材料
let inventoryMessage = ''; // 背包提示消息
let inventoryMessageTimer = 0; // 消息计时器

/* 技能升级界面 */
let skillMenuClickRegions = [];

/* 通关结算界面 */
let stageClearClickRegions = [];
let stageClearData = null;

/* ★ 翻牌奖励发放：选中卡牌才发放（另外两张只展示不发放） */
function grantCardReward(card){
  if(!card || !G || !G.player) return;
  const p = G.player;
  if(card.type === 'gold'){
    p.gold = (p.gold || 0) + (card.amount || 0);
  } else if(card.type === 'equip' && card.equip){
    if(!p.inventory) p.inventory = [];
    if(p.inventory.length < BAG_CAPACITY){
      p.inventory.push(card.equip);
    }
  }
}

/* 背包界面 */
/* 技能升级界面 */
/* ===== DNF风格技能修炼界面（6技能槽） ===== */
let skillMenuMsg = '';
let skillMenuMsgUntil = 0;
let skillResetArmUntil = 0;

function skillMenuMsgShow(text){
  skillMenuMsg = text;
  skillMenuMsgUntil = performance.now() + 2400;
}

function drawSkillMenu(){
  if(!G || !G.player) return;
  const p = G.player;
  const w = WEAPONS[p.weaponIdx || 0];
  const skills = w.skills;

  ctx.fillStyle = 'rgba(2,5,10,0.90)';
  ctx.fillRect(0, 0, VW, VH);

  /* 顶部标题栏 */
  const topGrad = ctx.createLinearGradient(0,0,0,118);
  topGrad.addColorStop(0,'#15243d'); topGrad.addColorStop(1,'#070c16');
  ctx.fillStyle = topGrad; ctx.fillRect(0,0,VW,118);
  ctx.strokeStyle = 'rgba(201,168,76,0.45)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0,118); ctx.lineTo(VW,118); ctx.stroke();

  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd700';
  ctx.font = 'bold 30px "Microsoft YaHei"';
  ctx.fillText('技 能 修 炼', VW/2, 45);

  let spent = 0;
  for(let i = 0; i < skills.length; i++){
    const lv = (p.skillLevels && p.skillLevels[i]) || 0;
    if(lv > 0){
      if(i < 3){
        spent += skillSpent(skills[i], lv);
      } else {
        spent += skillSpCost(skills[i], 1) + skillSpent(skills[i], lv);
      }
    }
  }
  const remain = p.skillPoints || 0;
  ctx.fillStyle = '#9fe6ff'; ctx.font = '14px "Microsoft YaHei"';
  ctx.fillText('角色 Lv.' + p.level + '   ｜   剩余技能点 ' + remain + ' SP   ｜   已投入 ' + spent + ' SP   ｜   累计获得 ' + (remain + spent) + ' SP', VW/2, 72);
  ctx.fillStyle = '#6f8b9e'; ctx.font = '12px "Microsoft YaHei"';
  ctx.fillText('每升 1 级获得 ' + SP_PER_LEVEL + ' SP · 技能可升到的等级受角色等级限制（基础技每 2 级 +1，高阶技每 3 级 +1）· 技能等级每+1，伤害+12%', VW/2, 96);

  skillMenuClickRegions = [];

  const cardW = 478, cardH = 138, gapX = 22, gapY = 12;
  const startX = (VW - (cardW*2 + gapX)) / 2;
  const startY = 130;

  for(let i = 0; i < 6; i++){
    const sk = skills[i];
    if(!sk) continue;
    const col = i % 2, row = Math.floor(i/2);
    const x = startX + col*(cardW+gapX);
    const y = startY + row*(cardH+gapY);
    const curLv = (p.skillLevels && p.skillLevels[i]) || 0;
    const maxLv = skillMaxLv(sk);
    const unlockLv = sk.unlock || 1;
    const isLocked = !!sk.locked;
    const levelTooLow = (p.level || 1) < unlockLv;
    const isMax = curLv >= maxLv;
    /* ★ 受角色等级限制：当前最多只能点到 lvCap */
    const lvCap = skillLvCap(p, sk);
    const lvCapped = !levelTooLow && curLv >= lvCap && lvCap < maxLv;
    const cost = skillSpCost(sk, Math.max(1, curLv));
    const clickable = !isLocked && !levelTooLow && !isMax && !lvCapped;
    const dead = isLocked || levelTooLow;

    /* 卡片 */
    const bg = ctx.createLinearGradient(x,y,x+cardW,y+cardH);
    if(dead){ bg.addColorStop(0,'rgba(20,24,32,0.94)'); bg.addColorStop(1,'rgba(12,15,22,0.94)'); }
    else { bg.addColorStop(0,'rgba(30,38,58,0.96)'); bg.addColorStop(1,'rgba(16,21,34,0.96)'); }
    ctx.fillStyle = bg;
    ctx.beginPath(); ctx.roundRect(x,y,cardW,cardH,8); ctx.fill();
    ctx.strokeStyle = dead ? 'rgba(80,88,100,0.55)' : '#c9a84c';
    ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.roundRect(x,y,cardW,cardH,8); ctx.stroke();

    /* 图标框 */
    const icx = x+14, icy = y+16, ics = 58;
    ctx.fillStyle = 'rgba(8,12,20,0.92)';
    ctx.beginPath(); ctx.roundRect(icx,icy,ics,ics,7); ctx.fill();
    ctx.strokeStyle = dead ? '#3a424e' : (w.color || '#9fe6ff');
    ctx.lineWidth = 1.5; ctx.stroke();

    /* ★ 六个技能槽统一使用 SVG 图标；图标未解码时用技能首字兜底 */
    {
      const entry = getSkillIconImage(w.id, i);
      if(skillIconReady(entry)){
        ctx.save();
        ctx.globalAlpha = dead ? 0.32 : 0.95;
        ctx.drawImage(entry.img, icx+11, icy+11, ics-22, ics-22);
        ctx.restore();
      } else {
        ctx.textAlign = 'center';
        ctx.fillStyle = dead ? '#3a4450' : '#9fb6ca';
        ctx.font = 'bold 20px "Microsoft YaHei"';
        ctx.fillText((sk.name || '？').charAt(0), icx + ics/2, icy + ics/2 + 7);
      }
    }

    /* 槽位编号角标 */
    ctx.fillStyle = 'rgba(0,0,0,0.82)';
    ctx.beginPath(); ctx.arc(icx+ics-4, icy+ics-4, 10, 0, TAU); ctx.fill();
    ctx.strokeStyle = dead ? '#3a424e' : '#c9a84c'; ctx.lineWidth = 1; ctx.stroke();
    ctx.textAlign = 'center';
    ctx.fillStyle = dead ? '#7c8794' : '#ffd700';
    ctx.font = 'bold 11px "Microsoft YaHei"';
    ctx.fillText(String(i+1), icx+ics-4, icy+ics+1);

    /* 技能名 */
    ctx.textAlign = 'left';
    ctx.fillStyle = dead ? '#8a94a2' : '#ffffff';
    ctx.font = 'bold 17px "Microsoft YaHei"';
    ctx.fillText(sk.name, x+84, y+30);

    /* 规则标签 */
    ctx.fillStyle = '#7f97ab'; ctx.font = '11px "Microsoft YaHei"';
    ctx.fillText('学习 Lv.' + unlockLv + '   ·   最高 Lv.' + maxLv + '   ·   每级 ' + (sk.spCost||3) + ' SP起' +
                 (isLocked || levelTooLow ? '' : '   ·   当前可升 Lv.' + lvCap), x+84, y+51);

    /* 等级 */
    ctx.fillStyle = isMax ? '#ffd700' : '#9fe6ff';
    ctx.font = 'bold 13px "Microsoft YaHei"';
    ctx.fillText('Lv.' + curLv + ' / ' + maxLv, x+84, y+74);

    /* 进度条：底色画满 maxLv，亮色画到「当前可升上限」，再用实色画到已学等级 */
    const barX = x+170, barW = cardW-170-124, barY = y+66, barH = 8;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath(); ctx.roundRect(barX,barY,barW,barH,4); ctx.fill();
    if(!dead){
      /* 角色等级允许的上限（灰色） */
      const capR = maxLv > 0 ? clamp(lvCap/maxLv, 0, 1) : 0;
      ctx.fillStyle = 'rgba(120,140,160,0.55)';
      ctx.beginPath(); ctx.roundRect(barX,barY,Math.max(2,barW*capR),barH,4); ctx.fill();
    }
    const lvR = maxLv > 0 ? clamp(curLv/maxLv, 0, 1) : 0;
    const barGrad = ctx.createLinearGradient(barX,0,barX+barW,0);
    barGrad.addColorStop(0,'#9fe6ff'); barGrad.addColorStop(1,'#ffd700');
    ctx.fillStyle = barGrad;
    ctx.beginPath(); ctx.roundRect(barX,barY,Math.max(2,barW*lvR),barH,4); ctx.fill();

    /* 描述 */
    ctx.fillStyle = dead ? '#5d6875' : '#8fa8bc'; ctx.font = '11px "Microsoft YaHei"';
    ctx.fillText(sk.desc || '', x+84, y+97);

    /* 伤害成长：显示实际伤害数值对比 */
    if(!isLocked && typeof calcSkillDamage === 'function'){
      const curDmg = calcSkillDamage(p, i);
      const nextDmg = calcSkillDamageNext(p, i);
      const pctNow = Math.round((Math.max(0, curLv-1) * SKILL_DMG_PER_LV)*100);
      ctx.fillStyle = '#ffd700'; ctx.font = 'bold 11px "Microsoft YaHei"';
      if(isMax){
        ctx.fillText('伤害：' + curDmg.toLocaleString() + '（已满级）', x+84, y+117);
      } else if(nextDmg > 0){
        const diff = nextDmg - curDmg;
        const pctNext = Math.round((Math.max(0, curLv) * SKILL_DMG_PER_LV)*100);
        ctx.fillText('伤害：' + curDmg.toLocaleString() + ' → ' + nextDmg.toLocaleString() + '（+' + diff.toLocaleString() + '，+' + (pctNext-pctNow) + '%）', x+84, y+117);
      } else {
        ctx.fillText('伤害：' + curDmg.toLocaleString() + '（当前等级上限）', x+84, y+117);
      }
    } else {
      ctx.fillStyle = '#5d6875'; ctx.font = '11px "Microsoft YaHei"';
      ctx.fillText(isLocked ? '该技能尚未设计开放，技能槽已预留' : ('角色等级达到 Lv.' + unlockLv + ' 后可学习'), x+84, y+117);
    }

    /* 按钮 */
    const bw = 104, bh = 42;
    const bx = x + cardW - bw - 14, by = y + cardH - bh - 16;
    let btnText = '升级', btnSub = cost + ' SP', btnColor = '#c9a84c', textColor = '#1a1200';
    if(isLocked){ btnText='未开放'; btnSub='设计中'; btnColor='#3a424e'; textColor='#7c8794'; }
    else if(levelTooLow){ btnText='等级不足'; btnSub='需Lv.'+unlockLv; btnColor='#3a424e'; textColor='#7c8794'; }
    else if(isMax){ btnText='已满级'; btnSub='Lv.'+maxLv; btnColor='#4a4330'; textColor='#c9b878'; }
    /* ★ 技能还能升，但角色等级不够 —— DNF 里最常见的「卡等级」 */
    else if(lvCapped){ btnText='角色等级不足'; btnSub='需 Lv.'+skillNextLvNeed(p, sk); btnColor='#3f3a52'; textColor='#a99ec0'; }
    else if(curLv < 1){ btnText='学习'; btnSub=cost+' SP'; btnColor='#3f7fd0'; textColor='#eaf6ff'; }
    else if(remain < cost){ btnText='点数不足'; btnSub='需'+cost+' SP'; btnColor='#4a3540'; textColor='#c08a9a'; }

    ctx.fillStyle = btnColor;
    ctx.beginPath(); ctx.roundRect(bx,by,bw,bh,6); ctx.fill();
    ctx.strokeStyle = clickable ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1; ctx.stroke();
    ctx.textAlign = 'center';
    ctx.fillStyle = textColor; ctx.font = 'bold 14px "Microsoft YaHei"';
    ctx.fillText(btnText, bx+bw/2, by+19);
    ctx.font = '10px "Microsoft YaHei"';
    ctx.fillText(btnSub, bx+bw/2, by+34);

    skillMenuClickRegions.push({ x:bx, y:by, w:bw, h:bh, skillIdx:i });
  }

  /* 操作提示 */
  if(skillMenuMsg && performance.now() < skillMenuMsgUntil){
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd700'; ctx.font = 'bold 14px "Microsoft YaHei"';
    ctx.fillText(skillMenuMsg, VW/2, 600);
  }

  /* 重置技能点 */
  const rw = 156, rh = 40, rx = VW/2 - 330, ry = VH - 62;
  const arm = performance.now() < skillResetArmUntil;
  ctx.fillStyle = arm ? 'rgba(200,70,60,0.88)' : 'rgba(58,50,70,0.9)';
  ctx.beginPath(); ctx.roundRect(rx,ry,rw,rh,7); ctx.fill();
  ctx.strokeStyle = arm ? '#ff8a7a' : '#6a5a7a'; ctx.lineWidth = 1; ctx.stroke();
  ctx.textAlign = 'center';
  ctx.fillStyle = arm ? '#ffffff' : '#c0b0d0';
  ctx.font = 'bold 13px "Microsoft YaHei"';
  ctx.fillText(arm ? '再次点击确认重置' : '重置技能点', rx+rw/2, ry+25);
  skillMenuClickRegions.push({ x:rx, y:ry, w:rw, h:rh, reset:true });

  /* 返回按钮 */
  const btnW = 200, btnH = 45;
  const btnX = VW/2 + 130, btnY = VH - 65;
  ctx.fillStyle = 'rgba(80,80,100,0.85)';
  ctx.beginPath(); ctx.roundRect(btnX, btnY, btnW, btnH, 8); ctx.fill();
  ctx.strokeStyle = '#888'; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 16px "Microsoft YaHei"';
  ctx.fillText('返 回', btnX + btnW/2, btnY + 29);
  skillMenuClickRegions.push({ x: btnX, y: btnY, w: btnW, h: btnH, close: true });
}

