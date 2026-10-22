/* ============================================================
   ★ DNF 式怪物词条：普通怪有概率携带一条特性
   ============================================================ */
const ENEMY_AFFIX = {
  berserk: { name:'狂暴', color:'#ff5a4a', atk:1.40, hp:0.85, desc:'攻击力+40%，生命-15%' },
  armored: { name:'铁甲', color:'#8fd2ff', def:1.80, spd:0.80, desc:'防御力+80%，移速-20%' },
  swift:   { name:'迅捷', color:'#5ee08a', spd:1.45, desc:'移动速度+45%' },
  regen:   { name:'再生', color:'#7ef0b0', desc:'每秒回复1.2%生命' },
  venom:   { name:'剧毒', color:'#b388ff', desc:'死亡时爆出毒雾' },
  elite:   { name:'精英', color:'#ffd166', atk:1.20, hp:1.45, def:1.20, scale:1.10, desc:'全属性提升' }
};

function applyEnemyAffix(e, isBoss){
  if(isBoss || !e) return;
  /* ★ 越往深处，带词条的怪越常见（上限 60%，避免全员精英打不动） */
  const chance = Math.min(0.60, 0.20 + (G.levelIdx || 0) * 0.022);
  if(Math.random() > chance) return;
  const pool = ['berserk','armored','swift','regen','venom','elite'];
  const key = pool[Math.floor(Math.random() * pool.length)];
  const af = ENEMY_AFFIX[key];
  if(!af) return;
  e.affix = key;
  if(af.hp){ e.maxHp = Math.max(1, Math.round(e.maxHp * af.hp)); e.hp = e.maxHp; }
  if(af.atk) e.atk = e.atk * af.atk;
  if(af.def) e.defense = Math.round((e.defense || 0) * af.def);
  if(af.spd) e.def = Object.assign({}, e.def, { spd: e.def.spd * af.spd });
  if(af.scale) e.scale = e.scale * af.scale;
}

function spawnWaveEnemies(){
  if(!G || G.isPvp) return;
  const p = G.player;
  const diffMul = G.diffMul || 1.0;
  const hpMul = (G.currentHpMul||1.0) * diffMul, atkMul = (G.currentAtkMul||1.0) * diffMul;
  const wave = G.currentWave || ['bandit'];
  const isBossWave = G.currentIsBoss || false;
  G.enemies = G.enemies.filter(e => !e.alive);

  /* ★ 每波怪数：模板数量 + 关卡增量 + 房间序号增量（越往深处越密） */
  const _cfg = G.currentLvlCfg || getLevelConfig(G.levelIdx || 0);
  const _extra = isBossWave ? 0 : ((_cfg.extraPerWave || 0) + (G.waveIdx || 0));
  const _total = Math.min(18, wave.length + _extra);

  for(let i=0;i<_total;i++){
    const typeKey = wave[i % wave.length];
    const baseDef = ENEMY_TYPES[typeKey];
    /* 构造实际def，Boss波时大幅强化 */
    let def, scale, hp, atk;
    if(isBossWave){
      const bHpMul = G.currentBossHpMul || 3.0;
      const bAtkMul = G.currentBossAtkMul || 2.0;
      const bScaleMul = G.currentBossScaleMul || 2.0;
      /* ★ 体型上限 3.2：魔尊这类基础 scale 1.7 的再乘 3.2 会到 5.4 倍，直接撑出屏幕 */
      scale = Math.min(3.2, baseDef.scale * bScaleMul);
      hp = Math.round(baseDef.hp * bHpMul * hpMul);
      atk = baseDef.atk * bAtkMul * atkMul;
      def = Object.assign({}, baseDef, { boss:true, name:G.currentBossName||baseDef.name, scale:scale });
    } else {
      scale = baseDef.scale;
      hp = Math.round(baseDef.hp * hpMul);
      atk = baseDef.atk * atkMul;
      def = Object.assign({}, baseDef, { scale:scale });
    }
    /* ★ 分批从右侧涌入：每 6 只一排，排与排略微错开，避免排到房间外 */
    const _slot = i % 6, _ring = Math.floor(i / 6);
    const spawnDist = isBossWave ? 600+rand(-30,30) : 470 + _slot*84 + _ring*44 + rand(-28,28);
    const ex = p.x + spawnDist, ey = p.y+rand(-50,50);
    const spdMul = G.currentSpdMul || 1.0;
    /* ★ DNF式：敌人等级和防御 */
    const eLv = (G.levelIdx || 0) + 1;
    const eDef = isBossWave ? Math.round(80 * Math.pow(1.05, eLv)) : Math.round(50 * Math.pow(1.05, eLv));
    const en = { isEnemy:true, alive:true, typeKey, def, x:ex, y:clamp(ey, GY_TOP+50, GY_BOTTOM-30), h:0, vy:0, kx:0, hp, maxHp:hp, mp:baseDef.maxMp, maxMp:baseDef.maxMp, atk, level:eLv, defense:eDef, facing:-1, radius:26*scale, scale, spdMul:spdMul, state:'idle', walkPhase:rand(0,TAU), atkCd:rand(0.8,1.6), skillCd:rand(2,4), hurtT:0, hitFlash:0, launchT:0, deathT:0, action:null };
    /* ★ 精灵表按需加载 */
    ensureMonsterAtlas(typeKey);
    /* ★ 怪物词条 */
    applyEnemyAffix(en, isBossWave);
    G.enemies.push(en);
  }
}

/* ===== 城镇系统 ===== */
let townPlayer = null;
let townNPCInteract = null;
let townClickRegions = [];

/* 强化菜单覆盖层 */
const SLOT_NAMES = { weapon:'武器', head:'头部', armor:'上衣', shoes:'鞋子', necklace:'项链', ring:'戒指', bracer:'护腕', accessory:'戒指' };

/* 打开铁匠铺时自动选中有装备的部位 */
function autoSelectEquipSlots(){
  const p = G && G.player;
  if(!p || !p.equipment) return;
  const first = EQUIP_SLOTS.find(sl => p.equipment[sl]);
  if(first){
    if(!p.equipment[enhanceSelectedSlot]) enhanceSelectedSlot = first;
    if(!p.equipment[amplifySelectedSlot]) amplifySelectedSlot = first;
    if(!p.equipment[reforgeSelectedSlot]) reforgeSelectedSlot = first;
  }
}

function drawEnhanceOverlay(){
  if(!G || !G.player) return;
  const p = G.player;

  /* ★ 关键修复：每帧重建点击区域，避免旧区域堆积导致按钮失效/误触 */
  G.enhanceClickRegions = [];
  equipHoverRegions = [];

  ctx.fillStyle = 'rgba(0,0,0,0.62)';
  ctx.fillRect(0, 0, VW, VH);

  const panelW = 960, panelH = 568;
  const panelX = (VW - panelW) / 2, panelY = (VH - panelH) / 2;

  const pg = ctx.createLinearGradient(panelX, panelY, panelX, panelY+panelH);
  pg.addColorStop(0,'#2a1a0a'); pg.addColorStop(1,'#140a00');
  ctx.fillStyle = pg;
  ctx.beginPath(); ctx.roundRect(panelX, panelY, panelW, panelH, 10); ctx.fill();
  ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(panelX, panelY, panelW, panelH, 10); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,209,102,0.25)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.roundRect(panelX+4, panelY+4, panelW-8, panelH-8, 8); ctx.stroke();

  /* 标题 */
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd166'; ctx.font = 'bold 22px "Microsoft YaHei"';
  ctx.fillText('铁匠 · 王大锤', VW/2, panelY + 28);

  /* 资源总览 */
  if(!p.materials) p.materials = {};
  if(!p.amplifyStones) p.amplifyStones = {};
  let ampTotal = 0;
  for(const k in p.amplifyStones) ampTotal += p.amplifyStones[k] || 0;
  ctx.fillStyle = '#ffd700'; ctx.font = '12px "Microsoft YaHei"';
  ctx.fillText('金币 ' + (p.gold||0) + '　｜　下级石 ' + (p.materials.enhance_stone_low||0) +
    ' · 中级石 ' + (p.materials.enhance_stone_mid||0) +
    ' · 高级石 ' + (p.materials.enhance_stone_high||0) +
    '　｜　增幅石 ' + ampTotal, VW/2, panelY + 50);

  /* 四个标签页 */
  const tabW = 96, tabH = 28;
  const tabY = panelY + 58;
  const tabs = [
    { id:'enhance', label:'强 化', color:'#ffd166' },
    { id:'decompose', label:'分 解', color:'#e67e22' },
    { id:'amplify', label:'增 幅', color:'#c96bff' },
    { id:'reforge', label:'洗 练', color:'#5ee08a' }
  ];
  const totalTabW = tabW * tabs.length + 10 * (tabs.length - 1);
  const tabStartX = VW/2 - totalTabW/2;

  for(let i = 0; i < tabs.length; i++){
    const tab = tabs[i];
    const tx = tabStartX + i * (tabW + 10);
    ctx.fillStyle = blacksmithTab === tab.id ? tab.color : 'rgba(40,30,20,0.7)';
    ctx.beginPath(); ctx.roundRect(tx, tabY, tabW, tabH, 5); ctx.fill();
    ctx.fillStyle = blacksmithTab === tab.id ? '#1a0a00' : '#888';
    ctx.font = 'bold 13px "Microsoft YaHei"';
    ctx.fillText(tab.label, tx + tabW/2, tabY + 19);
    G.enhanceClickRegions.push({ x: tx, y: tabY, w: tabW, h: tabH, action: 'switchTab', tab: tab.id });
  }

  /* 左侧：装备栏 */
  const eqPanelX = panelX + 12;
  const eqPanelY = tabY + 36;
  const eqPanelW = 180;
  const eqPanelH = 400;

  ctx.fillStyle = 'rgba(20,15,10,0.6)';
  ctx.beginPath(); ctx.roundRect(eqPanelX, eqPanelY, eqPanelW, eqPanelH, 6); ctx.fill();
  ctx.strokeStyle = 'rgba(255,209,102,0.3)'; ctx.lineWidth = 1; ctx.stroke();

  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd166'; ctx.font = 'bold 12px "Microsoft YaHei"';
  ctx.fillText('我 的 装 备', eqPanelX + eqPanelW/2, eqPanelY + 16);

  const slots = EQUIP_SLOTS;
  const slotSize = 28;
  const slotGap = 10;

  for(let i = 0; i < slots.length; i++){
    const slot = slots[i];
    const eq = p.equipment[slot];
    const sx = eqPanelX + 8;
    const sy = eqPanelY + 24 + i * (slotSize + slotGap);

    const isHighlighted = (blacksmithTab === 'enhance' && enhanceSelectedSlot === slot) ||
                          (blacksmithTab === 'amplify' && amplifySelectedSlot === slot) ||
                          (blacksmithTab === 'reforge' && reforgeSelectedSlot === slot);

    ctx.fillStyle = isHighlighted ? 'rgba(255,209,102,0.4)' : 'rgba(30,25,15,0.7)';
    ctx.beginPath(); ctx.roundRect(sx, sy, slotSize, slotSize, 3); ctx.fill();
    ctx.strokeStyle = isHighlighted ? '#ffd166' : (eq ? (eq.tierColor || '#555') : '#333');
    ctx.lineWidth = isHighlighted ? 2 : 1;
    ctx.beginPath(); ctx.roundRect(sx, sy, slotSize, slotSize, 3); ctx.stroke();

    if(eq){
      if((eq.enhance||0) >= 10 || (eq.amplify||0) >= 10) drawEquipGlowRing(sx+slotSize/2, sy+slotSize/2, slotSize, eq, 0.55);
      drawEquipIcon(eq.slot, eq.weaponType, sx, sy, slotSize);
      ctx.textAlign = 'center'; ctx.font = 'bold 9px "Microsoft YaHei"';
      if((eq.enhance||0) > 0){ ctx.fillStyle = '#ffd700'; ctx.fillText('+' + eq.enhance, sx + slotSize - 7, sy + 9); }
      if((eq.amplify||0) > 0){ ctx.fillStyle = '#ff9ae0'; ctx.fillText('+' + eq.amplify, sx + slotSize - 7, sy + 19); }
    } else {
      ctx.globalAlpha = 0.18;
      drawEquipIcon(slot, 'sword', sx, sy, slotSize);
      ctx.globalAlpha = 1;
    }

    ctx.textAlign = 'left';
    ctx.fillStyle = '#888'; ctx.font = '9px "Microsoft YaHei"';
    ctx.fillText(SLOT_NAMES[slot], sx + slotSize + 5, sy + 10);
    if(eq){
      ctx.fillStyle = eq.tierColor || '#aaa'; ctx.font = '9px "Microsoft YaHei"';
      const shortName = eq.name.length > 5 ? eq.name.slice(0,5)+'..' : eq.name;
      ctx.fillText(shortName, sx + slotSize + 5, sy + 22);
    }

    if(eq) equipHoverRegions.push({ x: sx, y: sy, w: eqPanelW - 16, h: slotSize, equip: eq });
    if(blacksmithTab === 'enhance' || blacksmithTab === 'amplify' || blacksmithTab === 'reforge'){
      G.enhanceClickRegions.push({ x: sx, y: sy, w: eqPanelW - 16, h: slotSize, action: 'selectSlot', slot: slot });
    }
  }

  /* 背包栏 */
  const bagPanelX = eqPanelX;
  const bagPanelY = eqPanelY + 24 + slots.length * (slotSize + slotGap) + 4;
  const bagPanelW = eqPanelW;
  const bagPanelH = eqPanelY + eqPanelH - bagPanelY;

  ctx.fillStyle = 'rgba(20,15,10,0.6)';
  ctx.beginPath(); ctx.roundRect(bagPanelX, bagPanelY, bagPanelW, bagPanelH, 6); ctx.fill();
  ctx.strokeStyle = 'rgba(255,209,102,0.2)'; ctx.lineWidth = 1; ctx.stroke();

  ctx.textAlign = 'center';
  ctx.fillStyle = '#aa8844'; ctx.font = 'bold 11px "Microsoft YaHei"';
  ctx.fillText('背 包', bagPanelX + bagPanelW/2, bagPanelY + 14);

  const bagSlotSize = 26;
  const bagCols = Math.floor((bagPanelW - 10) / (bagSlotSize + 3));
  if(p.inventory && p.inventory.length > 0){
    for(let i = 0; i < Math.min(p.inventory.length, bagCols * 3); i++){
      const eq = p.inventory[i];
      const col = i % bagCols;
      const row = Math.floor(i / bagCols);
      const bx = bagPanelX + 5 + col * (bagSlotSize + 3);
      const by = bagPanelY + 20 + row * (bagSlotSize + 3);

      const isSelected = blacksmithTab === 'decompose' && decomposeSelectedIndex === i;

      ctx.fillStyle = isSelected ? 'rgba(230,126,34,0.5)' : 'rgba(25,20,10,0.7)';
      ctx.beginPath(); ctx.roundRect(bx, by, bagSlotSize, bagSlotSize, 3); ctx.fill();
      ctx.strokeStyle = isSelected ? '#e67e22' : (eq.tierColor || '#444');
      ctx.lineWidth = isSelected ? 2 : 1; ctx.stroke();

      drawEquipIcon(eq.slot, eq.weaponType || 'sword', bx, by, bagSlotSize);

      equipHoverRegions.push({ x: bx, y: by, w: bagSlotSize, h: bagSlotSize, equip: eq });
      if(blacksmithTab === 'decompose'){
        G.enhanceClickRegions.push({ x: bx, y: by, w: bagSlotSize, h: bagSlotSize, action: 'selectDecompose', index: i });
      }
    }
  } else {
    ctx.fillStyle = '#665544'; ctx.font = '10px "Microsoft YaHei"';
    ctx.fillText('空空如也', bagPanelX + bagPanelW/2, bagPanelY + 44);
  }

  /* 右侧功能区 */
  const funcX = eqPanelX + eqPanelW + 15;
  const funcY = eqPanelY;
  const funcW = panelW - eqPanelW - 30;
  const funcH = eqPanelH;

  if(blacksmithTab === 'enhance'){
    drawEnhanceTab(p, funcX, funcY, funcW, funcH);
  } else if(blacksmithTab === 'decompose'){
    drawDecomposeTab(p, funcX, funcY, funcW, funcH);
  } else if(blacksmithTab === 'amplify'){
    drawAmplifyTab(p, funcX, funcY, funcW, funcH);
  } else if(blacksmithTab === 'reforge'){
    drawReforgeTab(p, funcX, funcY, funcW, funcH);
  }

  /* 结果提示条 */
  const msg = (G.enhanceMsg && performance.now() < G.enhanceMsg.until) ? G.enhanceMsg : null;
  ctx.textAlign = 'center';
  ctx.font = msg ? 'bold 14px "Microsoft YaHei"' : '12px "Microsoft YaHei"';
  ctx.fillStyle = msg ? msg.color : 'rgba(150,170,190,0.8)';
  const hintMap = {
    enhance: '提示：选择左侧装备后点击按钮。强化 +10 起武器发白光，增幅 +10 起发粉光，二者叠加会混色',
    decompose: '提示：分解背包中不需要的装备，可获得对应品阶的增幅石',
    amplify: '提示：增幅额外提供力量与体力，品阶越高成长越多，失败等级不变',
    reforge: '提示：洗练会重铸该装备的全部随机词条，词条数量由品阶决定（普通装备无词条）'
  };
  ctx.fillText(msg ? msg.text : (hintMap[blacksmithTab] || hintMap.enhance), VW/2, panelY + panelH - 56);

  /* 返回按钮 */
  const btnW = 140, btnH = 36;
  const btnX = VW/2 - btnW/2, btnY = panelY + panelH - 44;
  ctx.fillStyle = 'rgba(100,80,40,0.7)';
  ctx.beginPath(); ctx.roundRect(btnX, btnY, btnW, btnH, 6); ctx.fill();
  ctx.strokeStyle = 'rgba(255,209,102,0.4)'; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 14px "Microsoft YaHei"'; ctx.textAlign = 'center';
  ctx.fillText('返回城镇', VW/2, btnY + 23);
  G.enhanceClickRegions.push({ x: btnX, y: btnY, w: btnW, h: btnH, action: 'back' });

  /* 强化成功闪光 */
  if(G.enhanceFxAt && performance.now() - G.enhanceFxAt < 420){
    const k = 1 - (performance.now() - G.enhanceFxAt) / 420;
    ctx.fillStyle = 'rgba(255,235,170,' + (0.20 * k) + ')';
    ctx.fillRect(panelX, panelY, panelW, panelH);
  }
}

/* 通用：装备属性行 */
function drawStatLine(label, base, enh, amp, x, y, bold){
  ctx.textAlign = 'left';
  ctx.fillStyle = '#8fa8bc'; ctx.font = '12px "Microsoft YaHei"';
  ctx.fillText(label, x, y);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#cbd8e6'; ctx.font = '12px "Microsoft YaHei"';
  ctx.fillText(String(base || 0), x + 128, y);
  ctx.fillStyle = '#ffd166';
  ctx.fillText('+' + (enh || 0), x + 196, y);
  ctx.fillStyle = '#ff9ae0';
  ctx.fillText('+' + (amp || 0), x + 262, y);
  ctx.fillStyle = '#2ee6a8'; ctx.font = (bold ? 'bold ' : '') + '13px "Microsoft YaHei"';
  ctx.fillText('= ' + ((base||0) + (enh||0) + (amp||0)), x + 340, y);
}

/* 强化标签页 */
function drawEnhanceTab(p, fx, fy, fw, fh){
  const slot = enhanceSelectedSlot || 'weapon';
  const eq = p.equipment[slot];

  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd166'; ctx.font = 'bold 17px "Microsoft YaHei"';
  ctx.fillText('装 备 强 化', fx + fw/2, fy + 22);

  if(!eq){
    ctx.fillStyle = '#8fa8bc'; ctx.font = 'bold 15px "Microsoft YaHei"';
    ctx.fillText('「' + SLOT_NAMES[slot] + '」部位暂无装备', fx + fw/2, fy + 150);
    ctx.fillStyle = '#6f8b9e'; ctx.font = '12px "Microsoft YaHei"';
    ctx.fillText('先去地下城打怪掉落装备，或点击左侧其他已装备部位', fx + fw/2, fy + 180);
    return;
  }

  const enhLv = eq.enhance || 0;
  const ampLv = eq.amplify || 0;
  const tierKey = equipTierKey(eq);
  const g = equipTierGain(eq);
  const tierObj = EQUIP_TIERS.find(t => t.id === tierKey) || EQUIP_TIERS[0];
  const cur = calcEnhanceStats(eq);
  const amp = calcAmplifyStats(eq);
  const isMax = enhLv >= ENHANCE_MAX_LV;
  const nextLv = Math.min(enhLv + 1, ENHANCE_MAX_LV);
  const nxt = calcEnhanceStats(Object.assign({}, eq, { enhance: nextLv }));
  const matInfo = enhanceMaterialOf(eq);
  const cost = enhanceCostOf(enhLv);
  const haveMat = (p.materials && p.materials[matInfo.id]) || 0;
  const haveGold = p.gold || 0;

  /* 图标 + 光效 */
  const iconX = fx + 18, iconY = fy + 34, iconS = 70;
  ctx.fillStyle = 'rgba(30,20,10,0.75)';
  ctx.beginPath(); ctx.roundRect(iconX, iconY, iconS, iconS, 6); ctx.fill();
  ctx.strokeStyle = eq.tierColor || '#666'; ctx.lineWidth = 2; ctx.stroke();
  if(enhLv >= 10 || ampLv >= 10) drawEquipGlowRing(iconX+iconS/2, iconY+iconS/2, iconS, eq, 0.9);
  drawEquipIcon(eq.slot, eq.weaponType, iconX, iconY, iconS);

  /* 名称 */
  ctx.textAlign = 'left';
  ctx.fillStyle = eq.tierColor || '#fff'; ctx.font = 'bold 17px "Microsoft YaHei"';
  ctx.fillText(eq.name, fx + 102, fy + 52);
  ctx.fillStyle = '#a89a7a'; ctx.font = '12px "Microsoft YaHei"';
  ctx.fillText(tierObj.name + '（' + g.label + '）　Lv.' + (eq.level||1) + '　' + SLOT_NAMES[slot], fx + 102, fy + 74);
  ctx.fillStyle = '#ffd166'; ctx.font = 'bold 13px "Microsoft YaHei"';
  ctx.fillText('强化 +' + enhLv + '　／　增幅 +' + ampLv, fx + 102, fy + 96);

  /* 光效说明 */
  const glow = getEquipGlowInfo(eq);
  ctx.font = '11px "Microsoft YaHei"';
  if(glow.active){
    ctx.fillStyle = glow.mixed ? '#ffd6f2' : (glow.ampOn ? '#ff9ae0' : '#eaf6ff');
    ctx.fillText('武器光效：' + glow.label, fx + 102, fy + 116);
  } else {
    ctx.fillStyle = '#6f8b9e';
    ctx.fillText('武器光效：强化/增幅达到 +10 后开启', fx + 102, fy + 116);
  }

  /* 属性表 */
  const sx = fx + 18, sy = fy + 150;
  ctx.textAlign = 'right'; ctx.fillStyle = '#6f8b9e'; ctx.font = '10px "Microsoft YaHei"';
  ctx.fillText('基础', sx + 128, sy - 20);
  ctx.fillStyle = '#b9a45e'; ctx.fillText('强化', sx + 196, sy - 20);
  ctx.fillStyle = '#b06a9a'; ctx.fillText('增幅', sx + 262, sy - 20);
  ctx.fillStyle = '#5fae8e'; ctx.fillText('合计', sx + 340, sy - 20);

  drawStatLine('攻击力', eq.baseAtk, cur.atk, amp.atk, sx, sy);
  drawStatLine('防御力', eq.baseDef, cur.def, 0, sx, sy + 22);
  drawStatLine('生命值', eq.baseHp, cur.hp, amp.hp, sx, sy + 44);
  drawStatLine('无视防御', 0, cur.pierce, amp.pierce, sx, sy + 66);
  if(amp.str > 0 || amp.vit > 0){
    ctx.textAlign = 'left'; ctx.fillStyle = '#ff9ae0'; ctx.font = '11px "Microsoft YaHei"';
    ctx.fillText('异次元：力量 +' + amp.str + '　体力 +' + amp.vit + '（1力量=1.5攻击，1体力=8生命）', sx, sy + 88);
  }

  /* 下一级预览 */
  const nx = fx + 402, ny = fy + 128, nw = fw - 420, nh = 152;
  ctx.fillStyle = 'rgba(12,10,6,0.6)';
  ctx.beginPath(); ctx.roundRect(nx, ny, nw, nh, 6); ctx.fill();
  ctx.strokeStyle = 'rgba(255,209,102,0.35)'; ctx.lineWidth = 1; ctx.stroke();
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffd166'; ctx.font = 'bold 13px "Microsoft YaHei"';
  ctx.fillText(isMax ? '已达最高强化等级' : ('下一级：+' + (enhLv+1) + ' 提升预览'), nx + 14, ny + 24);

  if(!isMax){
    const rate = Math.round(ENHANCE_TABLE[enhLv+1].rate * 100);
    ctx.fillStyle = '#9fe6ff'; ctx.font = 'bold 12px "Microsoft YaHei"';
    ctx.fillText('成功率 ' + rate + '%', nx + 14, ny + 46);
    ctx.fillStyle = '#8fa8bc'; ctx.font = '11px "Microsoft YaHei"';
    const dAtk = nxt.atk - cur.atk, dDef = nxt.def - cur.def, dHp = nxt.hp - cur.hp, dP = nxt.pierce - cur.pierce;
    const lines = [];
    if(eq.baseAtk) lines.push('攻击 +' + dAtk + '　无视防御 +' + dP);
    if(eq.baseDef) lines.push('防御 +' + dDef);
    if(eq.baseHp)  lines.push('生命 +' + dHp);
    if(!lines.length) lines.push('该部位强化不提供额外属性');
    for(let i = 0; i < lines.length && i < 3; i++) ctx.fillText(lines[i], nx + 14, ny + 68 + i*17);
    ctx.fillStyle = '#6f8b9e'; ctx.font = '10px "Microsoft YaHei"';
    ctx.fillText('每级成长：' + g.label + ' 基础攻击×' + Math.round(g.atkPct*100) + '%', nx + 14, ny + nh - 12);
  } else {
    ctx.fillStyle = '#ffd700'; ctx.font = '11px "Microsoft YaHei"';
    ctx.fillText('继续强化不再提升属性', nx + 14, ny + 50);
    ctx.fillText('可前往「增幅」继续提升', nx + 14, ny + 72);
  }

  /* 材料需求 */
  ctx.textAlign = 'left'; ctx.font = '12px "Microsoft YaHei"';
  ctx.fillStyle = haveMat >= cost.mat ? '#9fe6ff' : '#ff6a5a';
  ctx.fillText('需要：' + matInfo.name + ' ×' + cost.mat + '（持有 ' + haveMat + '）', fx + 18, fy + 276);
  ctx.fillStyle = haveGold >= cost.gold ? '#ffd700' : '#ff6a5a';
  ctx.fillText('金币：' + cost.gold + '（持有 ' + haveGold + '）', fx + 18, fy + 298);

  /* 强化按钮 */
  const canEnhance = !isMax && haveMat >= cost.mat && haveGold >= cost.gold;
  const btnW = 190, btnH = 44;
  const btnX = fx + fw/2 - btnW/2, btnY = fy + 318;
  const bgrd = ctx.createLinearGradient(0, btnY, 0, btnY+btnH);
  if(canEnhance){ bgrd.addColorStop(0,'#ffe28a'); bgrd.addColorStop(1,'#c9a000'); }
  else { bgrd.addColorStop(0,'#4a4436'); bgrd.addColorStop(1,'#2a261e'); }
  ctx.fillStyle = bgrd;
  ctx.beginPath(); ctx.roundRect(btnX, btnY, btnW, btnH, 7); ctx.fill();
  ctx.strokeStyle = canEnhance ? '#fff3a0' : '#5a5240'; ctx.lineWidth = 1; ctx.stroke();
  ctx.textAlign = 'center';
  ctx.fillStyle = canEnhance ? '#2a1a00' : '#8a8270';
  ctx.font = 'bold 18px "Microsoft YaHei"';
  ctx.fillText(isMax ? '已 满 级' : '强 化', btnX + btnW/2, btnY + 29);
  G.enhanceClickRegions.push({ x: btnX, y: btnY, w: btnW, h: btnH, action: 'enhance' });

  /* 规则说明 */
  ctx.fillStyle = 'rgba(140,160,180,0.75)'; ctx.font = '11px "Microsoft YaHei"';
  ctx.fillText('白阶每级 +' + Math.round(ENHANCE_TIER_GAIN.common.atkPct*100) + '% 基础攻击　·　粉阶每级 +' +
    Math.round(ENHANCE_TIER_GAIN.epic.atkPct*100) + '% 基础攻击　·　失败惩罚：+5~+7 掉1级，+8以上归零',
    fx + fw/2, fy + 390);
}

/* 分解标签页 */
function drawDecomposeTab(p, fx, fy, fw, fh){
  ctx.textAlign = 'center';
  ctx.fillStyle = '#e67e22'; ctx.font = 'bold 16px "Microsoft YaHei"';
  ctx.fillText('装 备 分 解', fx + fw/2, fy + 20);

  ctx.fillStyle = '#aaa'; ctx.font = '12px "Microsoft YaHei"';
  ctx.fillText('分解背包中的装备，获得对应品阶的增幅石（增幅石用于增幅）', fx + fw/2, fy + 42);

  if(decomposeSelectedIndex >= 0 && p.inventory && p.inventory[decomposeSelectedIndex]){
    const eq = p.inventory[decomposeSelectedIndex];

    const eqIconX = fx + fw/2 - 35, eqIconY = fy + 60;
    ctx.fillStyle = 'rgba(30,20,10,0.6)';
    ctx.beginPath(); ctx.roundRect(eqIconX, eqIconY, 70, 70, 5); ctx.fill();
    ctx.strokeStyle = eq.tierColor || '#666'; ctx.lineWidth = 2; ctx.stroke();
    drawEquipIcon(eq.slot, eq.weaponType, eqIconX, eqIconY, 70);

    ctx.textAlign = 'center';
    ctx.fillStyle = eq.tierColor || '#fff'; ctx.font = 'bold 14px "Microsoft YaHei"';
    ctx.fillText(eq.name + ' +' + (eq.enhance||0), fx + fw/2, eqIconY + 88);
    ctx.fillStyle = '#aaa'; ctx.font = '12px "Microsoft YaHei"';
    ctx.fillText((eq.tierName || '') + '  Lv.' + (eq.level||1), fx + fw/2, eqIconY + 106);

    const stoneKey = equipTierKey(eq);
    const stoneInfo = AMPLIFY_STONES[stoneKey] || AMPLIFY_STONES.common;
    const stoneCount = 1 + (eq.enhance || 0) + Math.floor((eq.level||1) / 10);

    ctx.fillStyle = '#e67e22'; ctx.font = 'bold 13px "Microsoft YaHei"';
    ctx.fillText('分解获得', fx + fw/2, eqIconY + 135);

    const stoneX = fx + fw/2 - 20, stoneY = eqIconY + 145;
    ctx.fillStyle = stoneInfo.color;
    ctx.beginPath();
    ctx.moveTo(stoneX + 20, stoneY);
    ctx.lineTo(stoneX + 35, stoneY + 15);
    ctx.lineTo(stoneX + 20, stoneY + 35);
    ctx.lineTo(stoneX + 5, stoneY + 15);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 10px "Microsoft YaHei"';
    ctx.fillText('x' + stoneCount, stoneX + 50, stoneY + 22);

    ctx.fillStyle = stoneInfo.color; ctx.font = '12px "Microsoft YaHei"';
    ctx.fillText(stoneInfo.name, fx + fw/2, stoneY + 50);

    const btnX = fx + fw/2 - 70, btnY = stoneY + 65;
    ctx.fillStyle = 'rgba(230,126,34,0.85)';
    ctx.beginPath(); ctx.roundRect(btnX, btnY, 140, 38, 6); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 15px "Microsoft YaHei"'; ctx.textAlign = 'center';
    ctx.fillText('确认分解', btnX + 70, btnY + 25);
    G.enhanceClickRegions.push({ x: btnX, y: btnY, w: 140, h: 38, action: 'decompose' });
  } else {
    ctx.textAlign = 'center';
    ctx.fillStyle = '#888'; ctx.font = '14px "Microsoft YaHei"';
    ctx.fillText('请在左侧背包中选择要分解的装备', fx + fw/2, fy + 92);

    ctx.fillStyle = '#e67e22'; ctx.font = 'bold 13px "Microsoft YaHei"';
    ctx.fillText('当前增幅石', fx + fw/2, fy + 136);

    if(!p.amplifyStones) p.amplifyStones = {};
    let stoneY = fy + 158;
    for(const key in AMPLIFY_STONES){
      const stone = AMPLIFY_STONES[key];
      const count = p.amplifyStones[stone.id] || 0;
      ctx.fillStyle = stone.color; ctx.font = '12px "Microsoft YaHei"';
      ctx.fillText(stone.name + '：' + count + ' 个', fx + fw/2, stoneY);
      stoneY += 20;
    }
  }
}

/* 增幅标签页 */
