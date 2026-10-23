/* ============================================================
   ★ DNF 风格城镇 HUD
   ── 左上：角色卡（头像 / 名字 / 职业 / 等级 / HP / MP / EXP）
   ── 右上：任务追踪 + 金币
   ── 左侧：功能按钮组
   ── 底部：技能快捷栏
   原则：只显示"每时每刻都要看"的信息，其余全部收进面板
   ============================================================ */
const JOB_NAMES = ['剑士','剑客','枪手','格斗家','炼药师','撼山者','符咒师','丹道师'];
const JOB_TITLE = ['剑士（宝剑）','剑客（大刀）','枪手（长枪）','格斗家（手套）','炼药师（药草）','撼山者（大斧）','符咒师（符咒）','丹道师（药鼎）'];
let townSideBtnRegions = [];

/* 通用状态条 */
function hudBar(x, y, w, h, ratio, c1, c2, label){
  ctx.fillStyle = 'rgba(0,0,0,0.66)';
  ctx.beginPath(); ctx.roundRect(x, y, w, h, h/2); ctx.fill();
  if(ratio > 0.002){
    const g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, c1); g.addColorStop(1, c2);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.roundRect(x, y, Math.max(h, w * ratio), h, h/2); ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  ctx.beginPath(); ctx.roundRect(x + 1, y + 1, w - 2, Math.max(1, h * 0.42), h * 0.4); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.roundRect(x + 0.5, y + 0.5, w - 1, h - 1, h/2); ctx.stroke();
  if(label){
    ctx.textAlign = 'center';
    ctx.font = 'bold 9px "Microsoft YaHei"';
    ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(0,0,0,0.75)';
    ctx.strokeText(label, x + w/2, y + h - 2.5);
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.fillText(label, x + w/2, y + h - 2.5);
  }
}

/* 侧边按钮矢量图标 */
function drawTownBtnIcon(kind, cx, cy, color){
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = color;
  ctx.fillStyle = hexA(color, 0.9);
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  if(kind === 'inventory'){
    ctx.beginPath(); ctx.roundRect(-12, -6, 24, 18, 3); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-5, -6); ctx.lineTo(-5, -11);
    ctx.lineTo(5, -11); ctx.lineTo(5, -6); ctx.stroke();
    ctx.fillRect(-2.5, -1, 5, 9);
  } else if(kind === 'skillMenu'){
    ctx.beginPath();
    for(let i = 0; i < 12; i++){
      const a = -Math.PI/2 + i * Math.PI/6;
      const r = (i % 2 === 0) ? 12 : 5.4;
      const px = Math.cos(a) * r, py = Math.sin(a) * r;
      if(i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath(); ctx.fill(); ctx.stroke();
  } else if(kind === 'characterInfo'){
    ctx.beginPath(); ctx.arc(0, -7, 5.5, 0, TAU); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-11, 11);
    ctx.quadraticCurveTo(-9, -1, 0, -1);
    ctx.quadraticCurveTo(9, -1, 11, 11);
    ctx.stroke();
  } else if(kind === 'questMenu'){
    ctx.beginPath(); ctx.roundRect(-10, -11, 20, 22, 2.5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-5, -5); ctx.lineTo(4, -5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-5, 0); ctx.lineTo(5, 0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-5, 5); ctx.lineTo(2, 5); ctx.stroke();
    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.moveTo(6, 9); ctx.quadraticCurveTo(1, 4, 6, -1);
    ctx.quadraticCurveTo(11, 4, 6, 9);
    ctx.closePath(); ctx.fill();
  } else if(kind === 'auction'){
    /* 交易行：天平 + 金币 */
    ctx.beginPath(); ctx.moveTo(0, -11); ctx.lineTo(0, 8); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-11, -6); ctx.lineTo(11, -6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-8, 10); ctx.lineTo(8, 10); ctx.stroke();
    ctx.beginPath(); ctx.arc(-9, -1, 4.2, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.arc(9, -1, 4.2, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, -10, 2.2, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

function drawTownSideButtons(){
  /* ★ 手机端：画布只是中间一条横带，摇杆在画布外面，canvas 画图标对不上，
     改由 #mTownBtns（js/42_mobile_bar.js）用 DOM 按钮画在摇杆右边 */
  const _tc = document.getElementById('touchControls');
  if(_tc && _tc.classList.contains('mobile')){
    townSideBtnRegions = [];
    return;
  }
  const items = [
    { id:'inventory',     key:'I', label:'背包', color:'#5b9cff' },
    { id:'skillMenu',     key:'U', label:'技能', color:'#ffc860' },
    { id:'characterInfo', key:'C', label:'角色', color:'#5be08a' },
    { id:'questMenu',     key:'Q', label:'任务', color:'#ffd166' },
    { id:'auction',       key:'T', label:'交易行', color:'#c39bff' }
  ];
  /* ★ 电脑端：贴着触控「跳跃 ↑」键的右侧排成一横排（06_touch.js 算好锚点）
     没有锚点（手机 / 触控未启用）就退回左侧竖排 */
  const anchor = window.__hudIconAnchor;
  const horiz = !!(anchor && anchor.x > 0);
  const S = 52;
  const x0 = horiz ? Math.round(anchor.x) : 84;
  const y0 = horiz ? Math.round(anchor.y - S / 2) : 158;
  const step = horiz ? S + 10 : 62;

  /* ★ 检查是否有未使用的技能点 */
  const hasSkillPoints = G && G.player && (G.player.skillPoints || 0) > 0;

  townSideBtnRegions = [];
  const mx = MOUSE.in ? MOUSE.x : -9999, my = MOUSE.in ? MOUSE.y : -9999;
  for(let i = 0; i < items.length; i++){
    const it = items[i];
    const x = horiz ? x0 + i * step : x0;
    const y = horiz ? y0 : y0 + i * step;
    const hover = mx >= x && mx <= x + S && my >= y && my <= y + S;
    const bg = ctx.createLinearGradient(x, y, x, y + S);
    bg.addColorStop(0, hover ? 'rgba(44,64,90,0.96)' : 'rgba(12,18,28,0.86)');
    bg.addColorStop(1, 'rgba(8,12,20,0.94)');
    ctx.fillStyle = bg;
    ctx.beginPath(); ctx.roundRect(x, y, S, S, 7); ctx.fill();
    ctx.strokeStyle = hover ? it.color : hexA(it.color, 0.42);
    ctx.lineWidth = hover ? 2 : 1.3;
    ctx.beginPath(); ctx.roundRect(x + 0.5, y + 0.5, S - 1, S - 1, 7); ctx.stroke();
    drawTownBtnIcon(it.id, x + S/2, y + S/2 - 3, it.color);
    /* 快捷键角标 */
    ctx.fillStyle = 'rgba(0,0,0,0.82)';
    ctx.beginPath(); ctx.roundRect(x + 3, y + S - 14, 13, 12, 2); ctx.fill();
    ctx.textAlign = 'center';
    ctx.font = 'bold 9px "Microsoft YaHei"';
    ctx.fillStyle = hexA(it.color, 0.95);
    ctx.fillText(it.key, x + 9.5, y + S - 5);
    /* 名称：竖排写在右边，横排写在下面 */
    ctx.fillStyle = hover ? '#ffffff' : 'rgba(180,196,212,0.85)';
    ctx.font = '11px "Microsoft YaHei"';
    if(horiz){
      ctx.textAlign = 'center';
      ctx.fillText(it.label, x + S / 2, y + S + 13);
      ctx.textAlign = 'left';
    } else {
      ctx.textAlign = 'left';
      ctx.fillText(it.label, x + S + 6, y + S/2 + 3);
    }
    /* ★ 技能按钮：有未使用技能点时显示红色感叹号 */
    if(it.id === 'skillMenu' && hasSkillPoints){
      const pulse = 0.7 + 0.3 * Math.sin(performance.now() * 0.005);
      ctx.save();
      ctx.globalAlpha = pulse;
      /* 红色圆圈 */
      ctx.fillStyle = '#ff3333';
      ctx.beginPath(); ctx.arc(x + S - 6, y + 6, 9, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      /* 白色感叹号 */
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px "Microsoft YaHei"';
      ctx.textAlign = 'center';
      ctx.fillText('!', x + S - 6, y + 10);
      ctx.restore();
    }
    townSideBtnRegions.push({ id: it.id, x: x, y: y, w: S, h: S });
  }
}

/* 新 NPC 复用已有立绘，避免灰色占位（传送使已改用专属立绘） */
npcImages.grocer    = npcImages.merchant;
npcImages.watchman  = npcImages.wanderer;
npcImages.teaminer  = npcImages.healer;
npcImages.recycler  = npcImages.reforger;
npcImages.painter   = npcImages.wanderer;
npcImages.ferry     = npcImages.wanderer;
npcImages.urchin    = npcImages.wanderer;

/* ══════════════════════════════════════════════
   ★ 任务引导箭头（仿 DNF）
   所有需要下副本的任务 → 指向对应传送使（地图入口）
   剧情/交任务 → 可直接在任务面板操作，箭头指向传送使
   目标在屏幕内：目标头顶跳动的金色箭头
   目标在屏幕外：屏幕边缘呼吸箭头 + 距离
   ══════════════════════════════════════════════ */
function questGuideTarget(){
  if(!G || !G.player) return null;
  const q = questOf(G.player);
  const cq = MAIN_QUESTS[q.idx];
  if(!cq) return null;
  const st = cq.steps[q.step];
  /* 所有任务都指向传送使（地图入口），玩家可直接在任务面板交付 */
  let id = 'gate_east';
  /* 深渊前置任务：qa2 通关子夜鬼门 → 指向深渊传送使·玄冥 */
  if(cq.id === 'qa2' || cq.id === 'qa1') return NPCS.find(n => n.id === 'porter') || null;
  /* 根据任务索引指向对应的传送使 */
  if(q.idx < 11) id = 'gate_east';        /* 第一~三章 → 青鸾（q0~q10，关卡索引 0~6） */
  else if(q.idx < 18) id = 'gate_south';  /* 第四~五章 → 朱明（q11~q17，关卡索引 7~12） */
  else id = 'gate_west';                  /* 第六章+ → 白泽（q18+，关卡索引 13~23） */
  return NPCS.find(n => n.id === id) || null;
}
function drawQuestGuideArrow(){
  if(gameState !== 'town' || !townPlayer) return;
  const tgt = questGuideTarget();
  if(!tgt) return;
  const sx = tgt.x - townCam.x, sy = tgt.y - townCam.y;
  const pulse = 0.55 + 0.45 * Math.sin(performance.now() * 0.006);
  const onScreen = sx > 60 && sx < VW - 60 && sy > 90 && sy < VH - 60;
  ctx.save();
  if(onScreen){
    /* 目标头顶箭头 */
    const ay = sy - 250 + Math.sin(performance.now() * 0.005) * 7;
    ctx.globalAlpha = 0.6 + 0.4 * pulse;
    ctx.fillStyle = '#ffd166';
    ctx.strokeStyle = 'rgba(60,36,0,0.9)'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sx, ay + 22); ctx.lineTo(sx - 13, ay); ctx.lineTo(sx - 5, ay);
    ctx.lineTo(sx - 5, ay - 12); ctx.lineTo(sx + 5, ay - 12); ctx.lineTo(sx + 5, ay);
    ctx.lineTo(sx + 13, ay);
    ctx.closePath(); ctx.fill(); ctx.stroke();
  } else {
    /* 屏幕边缘箭头 + 距离 */
    const cx = VW/2, cy = VH/2;
    const ang = Math.atan2(sy - cy, sx - cx);
    const m = 96;
    const ex = clamp(cx + Math.cos(ang) * (VW/2 - m), 70, VW - 70);
    const ey = clamp(cy + Math.sin(ang) * (VH/2 - m), 100, VH - 130);
    ctx.translate(ex, ey); ctx.rotate(ang);
    ctx.globalAlpha = 0.45 + 0.4 * pulse;
    ctx.fillStyle = '#ffd166';
    ctx.strokeStyle = 'rgba(60,36,0,0.9)'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(20, 0); ctx.lineTo(-12, -14); ctx.lineTo(-4, 0); ctx.lineTo(-12, 14);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
    const dist = Math.round(Math.hypot(tgt.x - townPlayer.x, tgt.y - townPlayer.y) / 10);
    ctx.save();
    ctx.font = 'bold 12px "Microsoft YaHei"';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(8,10,20,0.75)';
    const label = tgt.name.split('·').pop() + ' ' + dist + 'm';
    const lw = ctx.measureText(label).width + 14;
    ctx.beginPath(); ctx.roundRect(ex - lw/2, ey + 16, lw, 20, 10); ctx.fill();
    ctx.fillStyle = '#ffd166';
    ctx.fillText(label, ex, ey + 30);
  }
  ctx.restore();
}

/* ★ 背包容量警告横幅 */
function drawBagWarning(){
  if(!G || !G.player) return;
  const inv = G.player.inventory || [];
  const cap = (typeof BAG_CAPACITY !== 'undefined') ? BAG_CAPACITY : 30;
  const warn = (typeof BAG_WARN_THRESHOLD !== 'undefined') ? BAG_WARN_THRESHOLD : 25;
  if(inv.length < warn) return;
  const full = inv.length >= cap;
  const pulse = 0.6 + 0.4 * Math.sin(performance.now() * 0.005);
  ctx.save();
  const bw = 320, bh = 30;
  const bx = VW / 2 - bw / 2, by = 90;
  ctx.globalAlpha = full ? (0.7 + 0.3 * pulse) : (0.5 + 0.3 * pulse);
  ctx.fillStyle = full ? 'rgba(180,30,20,0.85)' : 'rgba(180,120,20,0.75)';
  ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 6); ctx.fill();
  ctx.strokeStyle = full ? '#ff6a5a' : '#ffd166'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.roundRect(bx + 0.5, by + 0.5, bw - 1, bh - 1, 6); ctx.stroke();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 13px "Microsoft YaHei"';
  const msg = full
    ? '⚠ 背包已满！新装备将无法拾取，请分解或出售'
    : '⚠ 背包即将满（' + inv.length + '/' + cap + '），请及时清理';
  ctx.fillText(msg, VW / 2, by + 20);
  ctx.restore();
}

/* ★ 城镇小地图 */
function drawTownMinimap(){
  if(!townPlayer || !TOWN_DEFS) return;
  
  const MAP_W = 180, MAP_H = 108;
  const MAP_X = VW - MAP_W - 20, MAP_Y = 20;
  const SCALE = MAP_W / TOWN_W;
  
  ctx.save();
  
  /* 背景 */
  ctx.fillStyle = 'rgba(10,16,26,0.85)';
  ctx.beginPath(); ctx.roundRect(MAP_X, MAP_Y, MAP_W, MAP_H, 6); ctx.fill();
  ctx.strokeStyle = 'rgba(201,168,76,0.5)'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.roundRect(MAP_X + 0.5, MAP_Y + 0.5, MAP_W - 1, MAP_H - 1, 6); ctx.stroke();
  
  /* 标题 */
  ctx.fillStyle = '#ffd166';
  ctx.font = 'bold 11px "Microsoft YaHei"';
  ctx.textAlign = 'center';
  ctx.fillText('城镇地图', MAP_X + MAP_W / 2, MAP_Y + 12);
  
  /* 绘制五个城镇 */
  const townColors = {
    center: '#6a4a7e',
    east: '#1e4a4e',
    south: '#4e2418',
    west: '#343e54',
    north: '#241a3e'
  };
  
  for(const def of TOWN_DEFS){
    const tx = MAP_X + def.ox * SCALE;
    const ty = MAP_Y + 18 + def.oy * SCALE;
    const tw = TOWN_ZONE_W * SCALE;
    const th = TOWN_ZONE_H * SCALE;
    
    /* 判断玩家是否在这个城镇 */
    const playerInTown = townPlayer.x >= def.ox && townPlayer.x < def.ox + TOWN_ZONE_W &&
                         townPlayer.y >= def.oy && townPlayer.y < def.oy + TOWN_ZONE_H;
    
    /* 城镇方块 */
    ctx.fillStyle = playerInTown ? '#ffd166' : townColors[def.key];
    ctx.globalAlpha = playerInTown ? 0.9 : 0.6;
    ctx.fillRect(tx, ty, tw, th);
    
    /* 边框 */
    ctx.strokeStyle = playerInTown ? '#ffd166' : 'rgba(201,168,76,0.4)';
    ctx.lineWidth = playerInTown ? 2 : 1;
    ctx.strokeRect(tx, ty, tw, th);
    
    /* 城镇名称 */
    ctx.globalAlpha = 1;
    ctx.fillStyle = playerInTown ? '#000' : '#ccc';
    ctx.font = '9px "Microsoft YaHei"';
    ctx.textAlign = 'center';
    const shortName = def.name.split('·')[0];
    ctx.fillText(shortName, tx + tw / 2, ty + th / 2 + 3);
  }
  
  /* 玩家位置标记 */
  const px = MAP_X + townPlayer.x * SCALE;
  const py = MAP_Y + 18 + townPlayer.y * SCALE;
  
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#ff4444';
  ctx.beginPath();
  ctx.arc(px, py, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1;
  ctx.stroke();
  
  ctx.restore();
}


function drawTownHud(){
  const p = G && G.player;
  if(!p) return;
  ctx.save();

  /* ---------------- 角色卡 ---------------- */
  const X = 18, Y = 14, W = 306, H = 98;
  const bg = ctx.createLinearGradient(X, Y, X + W, Y + H);
  bg.addColorStop(0, 'rgba(10,16,26,0.92)');
  bg.addColorStop(1, 'rgba(10,16,26,0.46)');
  ctx.fillStyle = bg;
  ctx.beginPath(); ctx.roundRect(X, Y, W, H, 6); ctx.fill();
  ctx.strokeStyle = 'rgba(201,168,76,0.5)'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.roundRect(X + 0.5, Y + 0.5, W - 1, H - 1, 6); ctx.stroke();
  /* 左上角金饰 */
  ctx.fillStyle = 'rgba(201,168,76,0.9)';
  ctx.beginPath();
  ctx.moveTo(X + 8, Y); ctx.lineTo(X + 40, Y); ctx.lineTo(X + 8, Y + 8);
  ctx.closePath(); ctx.fill();

  /* 头像：直接用角色立绘的头部（识别度最高） */
  const AS = 66, ax = X + 10, ay = Y + 16;
  const ag = ctx.createLinearGradient(ax, ay, ax, ay + AS);
  ag.addColorStop(0, 'rgba(84,116,158,0.42)');
  ag.addColorStop(1, 'rgba(8,14,22,0.92)');
  ctx.fillStyle = ag;
  ctx.beginPath(); ctx.roundRect(ax, ay, AS, AS, 5); ctx.fill();
  ctx.strokeStyle = '#c9a84c'; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.roundRect(ax + 0.5, ay + 0.5, AS - 1, AS - 1, 5); ctx.stroke();
  {
    const at = atlasOf(p.weaponIdx || 0);
    let drew = false;
    if(at && at.img && at.img.complete && at.img.naturalWidth > 0){
      ctx.save();
      ctx.beginPath(); ctx.roundRect(ax + 2, ay + 2, AS - 4, AS - 4, 4); ctx.clip();
      /* 放大到框的 ~2 倍，脚踩到框外下方 → 框内正好是头和肩（DNF 头像感） */
      const bodyPx = AS * 2.0 * (at.bodyWorld / 110);
      drawSpriteFrame(at, 'idle', 0.18, ax + AS/2, ay + AS + bodyPx * 0.62, 1, bodyPx);
      ctx.restore();
      drew = true;
    }
    if(!drew) drawEquipIcon('weapon', (WEAPONS[p.weaponIdx || 0] || WEAPONS[0]).id, ax + 6, ay + 6, AS - 12);
  }
  /* 等级角标 */
  const lvTxt = 'Lv.' + (p.level || 1);
  ctx.font = 'bold 9px "Microsoft YaHei"';
  const lvw = ctx.measureText(lvTxt).width + 10;
  ctx.fillStyle = 'rgba(0,0,0,0.88)';
  ctx.beginPath(); ctx.roundRect(ax + 1, ay + AS - 14, lvw, 13, 3); ctx.fill();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd166';
  ctx.fillText(lvTxt, ax + 1 + lvw/2, ay + AS - 4);

  /* 名字 / 职业 */
  const tx = ax + AS + 12;
  ctx.textAlign = 'left';
  ctx.font = 'bold 16px "Microsoft YaHei"';
  ctx.fillStyle = '#ffffff';
  ctx.fillText((G.playerName || p.name || '拾灯人').slice(0, 9), tx, Y + 24);
  ctx.font = '11px "Microsoft YaHei"';
  ctx.fillStyle = '#8fa8bc';
  ctx.fillText(JOB_NAMES[p.weaponIdx || 0] + ' · ' + ((WEAPONS[p.weaponIdx || 0] || {}).name || ''), tx, Y + 40);
  /* 伤害类型标签：物理·力量 / 魔法·智力（DNF 分系），放卡片右上角 */
  {
    const isMag = (WEAPONS[p.weaponIdx || 0] || {}).dmgType === 'magic';
    const tag = isMag ? '魔法·智力' : '物理·力量';
    ctx.font = 'bold 9px "Microsoft YaHei"';
    const tw2 = ctx.measureText(tag).width + 12;
    const gx2 = X + W - tw2 - 8, gy2 = Y + 6;
    ctx.fillStyle = isMag ? 'rgba(98,60,180,0.6)' : 'rgba(150,50,40,0.6)';
    ctx.beginPath(); ctx.roundRect(gx2, gy2, tw2, 15, 3); ctx.fill();
    ctx.strokeStyle = isMag ? 'rgba(177,139,255,0.8)' : 'rgba(255,138,107,0.8)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(gx2 + 0.5, gy2 + 0.5, tw2 - 1, 14, 3); ctx.stroke();
    ctx.textAlign = 'center';
    ctx.fillStyle = isMag ? '#d9c4ff' : '#ffc9a8';
    ctx.fillText(tag, gx2 + tw2/2, gy2 + 11);
    ctx.textAlign = 'left';
  }

  /* 状态条 */
  const bw = X + W - tx - 12;
  const hpR  = clamp(p.hp / Math.max(1, p.maxHp), 0, 1);
  const mpR  = clamp(p.mp / Math.max(1, p.maxMp), 0, 1);
  const expNeed = getExpNeed(p.level || 1);
  const expR = clamp((p.exp || 0) / Math.max(1, expNeed), 0, 1);
  hudBar(tx, Y + 50, bw, 14, hpR, '#ff5f4d', '#9c1710', Math.ceil(p.hp) + ' / ' + p.maxHp);
  hudBar(tx, Y + 67, bw, 10, mpR, '#59a8ff', '#16408c', '');
  hudBar(tx, Y + 80, bw, 7, expR, '#ffd166', '#b8860b', '');
  /* EXP 百分比小字 */
  ctx.textAlign = 'right';
  ctx.font = '9px "Microsoft YaHei"';
  ctx.fillStyle = 'rgba(255,209,102,0.85)';
  ctx.fillText('EXP ' + (expR * 100).toFixed(1) + '%', X + W - 10, Y + 78);

  /* ---------------- 金币（角色卡下方） ---------------- */
  const p2 = questOf(p);
  const hasQuest = !!(p2 && MAIN_QUESTS[p2.idx]);
  const gy = Y + H + (hasQuest ? 26 : 8);
  void hasQuest;
  const goldTxt = (p.gold || 0).toLocaleString();
  ctx.font = 'bold 13px "Microsoft YaHei"';
  const gw = ctx.measureText(goldTxt).width + 40;
  const gx = X;
  ctx.fillStyle = 'rgba(10,14,20,0.82)';
  ctx.beginPath(); ctx.roundRect(gx, gy, gw, 26, 13); ctx.fill();
  ctx.strokeStyle = 'rgba(255,209,102,0.45)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.roundRect(gx + 0.5, gy + 0.5, gw - 1, 25, 13); ctx.stroke();
  /* 金币图标 */
  const cg = ctx.createRadialGradient(gx + 14, gy + 13, 1, gx + 14, gy + 13, 8);
  cg.addColorStop(0, '#fff3b0'); cg.addColorStop(0.6, '#ffd166'); cg.addColorStop(1, '#b8860b');
  ctx.fillStyle = cg;
  ctx.beginPath(); ctx.arc(gx + 14, gy + 13, 8, 0, TAU); ctx.fill();
  ctx.fillStyle = '#8a6a12';
  ctx.textAlign = 'center';
  ctx.font = 'bold 9px "Microsoft YaHei"';
  ctx.fillText('G', gx + 14, gy + 16);
  /* 数值 */
  ctx.textAlign = 'left';
  ctx.font = 'bold 13px "Microsoft YaHei"';
  ctx.fillStyle = '#ffd166';
  ctx.fillText(goldTxt, gx + 27, gy + 18);

  /* ---------------- 底部技能快捷栏 ----------------
     手机浏览器由右下角的触屏按键代替，这里不再画，避免两排图标叠在一起 */
  const w = WEAPONS[p.weaponIdx || 0];
  /* ★ 城镇里不画技能快捷栏：城镇没有战斗，那排图标只会挡住画面 */
  if(w && w.skills && !window.IS_MOBILE_UI && gameState !== 'town'){
    const SS = 46, SG = 6, SL = 6;
    const totalW = SL * SS + (SL - 1) * SG;
    const sx = VW/2 - totalW/2, sy = VH - SS - 14;
    for(let i = 0; i < SL; i++){
      const sk = w.skills[i] || {};
      const x = sx + i * (SS + SG);
      const unl = !!(p.skillsUnlocked && p.skillsUnlocked[i]);
      if(!unl) continue;   /* ★ 只显示已领悟的技能槽 */
      const lvOk = (p.level || 1) >= (sk.unlock || 1);
      const lit = unl && lvOk;
      ctx.fillStyle = 'rgba(6,10,16,0.88)';
      ctx.beginPath(); ctx.roundRect(x, sy, SS, SS, 5); ctx.fill();
      const entry = getSkillIconImage(w.id, i);
      if(skillIconReady(entry)){
        ctx.save();
        ctx.globalAlpha = lit ? 0.95 : 0.22;
        ctx.drawImage(entry.img, x + 6, sy + 6, SS - 12, SS - 12);
        ctx.restore();
      } else {
        /* 图标未解码时用技能名首字兜底，避免一整排问号 */
        ctx.textAlign = 'center';
        ctx.fillStyle = lit ? '#cfe0f0' : '#37424e';
        ctx.font = 'bold 16px "Microsoft YaHei"';
        ctx.fillText((sk.name || '？').charAt(0), x + SS/2, sy + SS/2 + 6);
      }
      ctx.strokeStyle = lit ? 'rgba(255,209,102,0.72)' : 'rgba(90,100,112,0.42)';
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.roundRect(x + 0.5, sy + 0.5, SS - 1, SS - 1, 5); ctx.stroke();
      /* 快捷键 */
      ctx.fillStyle = 'rgba(0,0,0,0.82)';
      ctx.beginPath(); ctx.roundRect(x + 2, sy + SS - 13, 12, 11, 2); ctx.fill();
      ctx.textAlign = 'center';
      ctx.font = 'bold 8px "Microsoft YaHei"';
      ctx.fillStyle = lit ? '#ffd166' : '#6a7886';
      ctx.fillText(String(i + 1), x + 8, sy + SS - 4);
      if(!lit){
        ctx.fillStyle = 'rgba(0,0,0,0.42)';
        ctx.beginPath(); ctx.roundRect(x, sy, SS, SS, 5); ctx.fill();
      }
    }
  }

  /* ---------------- 底部操作提示（小字，避开左手触控区） ---------------- */
  if(!window.IS_MOBILE_UI){
    ctx.textAlign = 'right';
    ctx.font = '11px "Microsoft YaHei"';
    ctx.fillStyle = 'rgba(170,188,204,0.55)';
    ctx.fillText('WASD 移动　J 交互　Q 任务　I 背包　U 技能　C 角色', VW - 20, VH - 12);
  }

  ctx.restore();
}

function drawTown(){
  if(!townPlayer) return;   /* 城镇玩家还没初始化时不要空转（避免整帧异常） */
  const area = townRegionAt(townPlayer.x, townPlayer.y);
  // 天空渐变（屏幕固定，随坊区换色）
  const skyGrad = ctx.createLinearGradient(0, 0, 0, GY_TOP);
  skyGrad.addColorStop(0, area.sky[0]);
  skyGrad.addColorStop(0.7, area.sky[1]);
  skyGrad.addColorStop(1, area.sky[2]);
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, VW, GY_TOP);

  // 远处建筑（古风坡顶瓦房剪影，随镜头轻量视差滚动，贴合守灯人村落世界观）
  const HORIZON = GY_BOTTOM - 100;
  const parallax = 0.22;   /* 远景视差系数：比前景慢，产生纵深感 */
  const skyW = VW + 320;
  const pxo = -((townCam.x * parallax) % 160);
  /* 远景两层：雾色山影 → 古风屋脊剪影 */
  ctx.fillStyle = area.bld;
  ctx.globalAlpha = 0.35;
  for(let i = -1; i < 12; i++){
    const bx = i * 160 + pxo - 80;
    const bh = 60 + hash01(i * 3.7 + 1) * 46;
    /* 山峦（远处朦胧） */
    ctx.beginPath();
    ctx.moveTo(bx - 80, HORIZON);
    ctx.lineTo(bx, HORIZON - bh - 20);
    ctx.lineTo(bx + 80, HORIZON);
    ctx.closePath(); ctx.fill();
  }
  ctx.globalAlpha = 0.55;
  /* 古风瓦房剪影：坡顶 + 飞檐翘角 */
  for(let i = -1; i < 14; i++){
    const bx = i * 120 + pxo - 40;
    const bw = 96, bh = 52 + hash01(i * 5.3 + 2) * 30;
    const baseY = HORIZON - 6;
    /* 屋身 */
    ctx.fillStyle = shadeColor(area.bld, -6);
    ctx.fillRect(bx, baseY - bh, bw, bh);
    /* 坡顶（两段斜面 + 正脊） */
    ctx.fillStyle = shadeColor(area.bld, -20);
    ctx.beginPath();
    ctx.moveTo(bx - 6, baseY - bh);
    ctx.lineTo(bx + bw/2, baseY - bh - 26);
    ctx.lineTo(bx + bw + 6, baseY - bh);
    ctx.closePath(); ctx.fill();
    /* 飞檐（两端微翘） */
    ctx.beginPath();
    ctx.moveTo(bx - 6, baseY - bh); ctx.lineTo(bx - 14, baseY - bh - 8); ctx.lineTo(bx + 2, baseY - bh - 3);
    ctx.moveTo(bx + bw + 6, baseY - bh); ctx.lineTo(bx + bw + 14, baseY - bh - 8); ctx.lineTo(bx + bw - 2, baseY - bh - 3);
    ctx.fill();
    /* 窗（零星暖光） */
    if(hash01(i * 7.1 + 3) > 0.4){
      ctx.fillStyle = 'rgba(255,196,110,0.35)';
      ctx.fillRect(bx + bw*0.3, baseY - bh + 16, 12, 14);
    }
  }
  ctx.globalAlpha = 1;

  /* 中景：牌坊 + 石灯柱剪影（守灯人村落的标志物） */
  for(let i = 0; i < 4; i++){
    const bx = i * 420 + pxo * 1.6 + 120;
    /* 石灯塔（灯柱 + 灯龛，呼应「镇岳灯柱」） */
    ctx.fillStyle = shadeColor(area.bld, -10);
    ctx.fillRect(bx - 6, HORIZON - 120, 12, 120);
    ctx.fillRect(bx - 14, HORIZON - 120, 28, 12);          /* 柱础 */
    ctx.beginPath();
    ctx.moveTo(bx - 14, HORIZON - 132);
    ctx.lineTo(bx + 14, HORIZON - 132);
    ctx.lineTo(bx, HORIZON - 156);
    ctx.closePath(); ctx.fill();                          /* 灯龛顶 */
    const lp = 0.55 + 0.25 * Math.sin((G ? G.t : 0) * 2 + i);
    const lg2 = ctx.createRadialGradient(bx, HORIZON - 142, 1, bx, HORIZON - 142, 22);
    lg2.addColorStop(0, 'rgba(255,214,130,' + lp + ')');
    lg2.addColorStop(1, 'rgba(255,150,40,0)');
    ctx.fillStyle = lg2;
    ctx.beginPath(); ctx.arc(bx, HORIZON - 142, 22, 0, TAU); ctx.fill();
  }
  /* 檐下成串灯笼（呼吸灯，呼应九灯） */
  for(let i = 0; i < 7; i++){
    const lx = i * 190 + pxo + 60;
    const ly = HORIZON - 40 + Math.sin(i * 1.7) * 8;
    const lg = ctx.createRadialGradient(lx, ly, 1, lx, ly, 24);
    lg.addColorStop(0, area.lamp);
    lg.addColorStop(1, 'rgba(255,150,40,0)');
    ctx.fillStyle = lg;
    ctx.beginPath(); ctx.arc(lx, ly, 24, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,214,140,0.9)';
    ctx.beginPath(); ctx.arc(lx, ly, 3, 0, TAU); ctx.fill();
  }
  /* 地平线雾带 */
  const fog = ctx.createLinearGradient(0, HORIZON - 30, 0, HORIZON + 12);
  fog.addColorStop(0, 'rgba(120,110,170,0)');
  fog.addColorStop(0.6, 'rgba(120,110,170,0.22)');
  fog.addColorStop(1, 'rgba(70,64,110,0.0)');
  ctx.fillStyle = fog;
  ctx.fillRect(0, HORIZON - 30, VW, 42);

  /* ══════════ 世界层（随镜头滚动） ══════════ */
  ctx.save();
  ctx.translate(-Math.round(townCam.x), -Math.round(townCam.y));

  /* ★ 地面分层：草地基色 → 坊区地块 → 泥土地（自然、有材质感） */
  const t = G ? G.t : performance.now() * 0.001;
  drawTownGround(t);

  /* 街道：先画所有横街，再画竖街（竖街压在上面形成路口）；每条街只在本镇范围内 */
  for(const st of TOWN_STREETS){
    if(st.axis === 'h'){
      const y0 = st.c - st.w/2, y1 = y0 + st.w;
      const sw = st.x1 - st.x0;
      /* 石板路面：中间亮、两侧暗，形成车辙磨损感 */
      const gg = ctx.createLinearGradient(0, y0, 0, y1);
      gg.addColorStop(0, '#565a55'); gg.addColorStop(0.18, '#71746c'); gg.addColorStop(0.5, '#7c7f76'); gg.addColorStop(0.82, '#6e716a'); gg.addColorStop(1, '#53564f');
      ctx.fillStyle = gg;
      ctx.fillRect(st.x0, y0, sw, st.w);
      /* 黄昏暖色反光（沿路面淡淡铺一层，压掉灰紫感） */
      const warmG = ctx.createLinearGradient(0, y0, 0, y1);
      warmG.addColorStop(0, 'rgba(255,178,96,0.02)');
      warmG.addColorStop(0.5, 'rgba(255,186,104,0.10)');
      warmG.addColorStop(1, 'rgba(255,178,96,0.02)');
      ctx.fillStyle = warmG;
      ctx.fillRect(st.x0, y0, sw, st.w);
      /* 路缘石（上下） */
      ctx.fillStyle = 'rgba(170,170,200,0.30)';
      ctx.fillRect(st.x0, y0, sw, 5);
      ctx.fillRect(st.x0, y1 - 5, sw, 5);
      ctx.fillStyle = 'rgba(20,20,34,0.30)';
      ctx.fillRect(st.x0, y0 + 5, sw, 2);
      ctx.fillRect(st.x0, y1 - 7, sw, 2);
      /* 石板砖缝：错缝铺装（横缝 + 交错竖缝），更像青石大街 */
      ctx.strokeStyle = 'rgba(24,24,42,0.34)'; ctx.lineWidth = 1;
      const tile = st.main ? 96 : 72;
      for(let row = 0; row < 2; row++){
        const ry = y0 + 7 + row * (st.w - 14) / 2;
        ctx.beginPath(); ctx.moveTo(st.x0, ry); ctx.lineTo(st.x1, ry); ctx.stroke();
        const off = row ? tile * 0.5 : 0;
        for(let x = st.x0 + off; x < st.x1; x += tile){
          ctx.beginPath(); ctx.moveTo(x, y0 + 6); ctx.lineTo(x, y1 - 6); ctx.stroke();
        }
      }
      /* 主街中线（DNF 式砖带） */
      if(st.main){
        ctx.strokeStyle = 'rgba(255,220,150,0.16)';
        ctx.lineWidth = 3;
        ctx.setLineDash([26, 18]);
        ctx.beginPath(); ctx.moveTo(st.x0, st.c); ctx.lineTo(st.x1, st.c); ctx.stroke();
        ctx.setLineDash([]);
      }
    } else {
      const x0 = st.c - st.w/2, x1 = x0 + st.w;
      const sh = st.y1 - st.y0;
      const gg = ctx.createLinearGradient(x0, 0, x1, 0);
      gg.addColorStop(0, '#53564f'); gg.addColorStop(0.18, '#6e716a'); gg.addColorStop(0.5, '#7a7d74'); gg.addColorStop(0.82, '#6c6f68'); gg.addColorStop(1, '#51544d');
      ctx.fillStyle = gg;
      ctx.fillRect(x0, st.y0, st.w, sh);
      const warmV = ctx.createLinearGradient(x0, 0, x1, 0);
      warmV.addColorStop(0, 'rgba(255,178,96,0.02)');
      warmV.addColorStop(0.5, 'rgba(255,186,104,0.09)');
      warmV.addColorStop(1, 'rgba(255,178,96,0.02)');
      ctx.fillStyle = warmV;
      ctx.fillRect(x0, st.y0, st.w, sh);
      ctx.fillStyle = 'rgba(170,170,200,0.28)';
      ctx.fillRect(x0, st.y0, 5, sh);
      ctx.fillRect(x1 - 5, st.y0, 5, sh);
      /* 竖街砖缝 */
      ctx.strokeStyle = 'rgba(24,24,42,0.34)'; ctx.lineWidth = 1;
      const vtile = st.main ? 96 : 72;
      for(let col = 0; col < 2; col++){
        const cx = x0 + 7 + col * (st.w - 14) / 2;
        ctx.beginPath(); ctx.moveTo(cx, st.y0); ctx.lineTo(cx, st.y1); ctx.stroke();
        const off = col ? vtile * 0.5 : 0;
        for(let y = st.y0 + off; y < st.y1; y += vtile){
          ctx.beginPath(); ctx.moveTo(x0 + 6, y); ctx.lineTo(x1 - 6, y); ctx.stroke();
        }
      }
      if(st.main){
        ctx.strokeStyle = 'rgba(255,220,150,0.16)';
        ctx.lineWidth = 3;
        ctx.setLineDash([26, 18]);
        ctx.beginPath(); ctx.moveTo(st.c, st.y0); ctx.lineTo(st.c, st.y1); ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    /* 路名牌（街道名水印，走在路上就能看到） */
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.font = 'bold 15px "Microsoft YaHei"';
    ctx.fillStyle = 'rgba(220,225,255,0.55)';
    ctx.textAlign = 'center';
    if(st.axis === 'h'){
      for(let x = st.x0 + 400; x < st.x1; x += 1100) ctx.fillText(st.name, x, st.c - st.w/2 + 22);
    } else {
      ctx.translate(st.c, 0);
      ctx.rotate(Math.PI/2);
      for(let y = st.y0 + 500; y < st.y1; y += 1100) ctx.fillText(st.name, y, 5);
    }
    ctx.restore();
    /* 街灯：沿街点缀 */
    if(st.axis === 'h'){
      for(let x = st.x0 + 260; x < st.x1; x += 520){
        const ly = st.c - st.w/2 - 6;
        const lg = ctx.createRadialGradient(x, ly, 1, x, ly, 30);
        lg.addColorStop(0, area.lamp); lg.addColorStop(1, 'rgba(255,150,40,0)');
        ctx.fillStyle = lg;
        ctx.beginPath(); ctx.arc(x, ly, 30, 0, TAU); ctx.fill();
        ctx.fillStyle = '#20222e';
        ctx.fillRect(x - 2, ly - 44, 4, 44);
        ctx.fillStyle = 'rgba(255,214,140,0.95)';
        ctx.beginPath(); ctx.arc(x, ly - 46, 5, 0, TAU); ctx.fill();
      }
    }
  }

  /* ★ 每镇中央广场（街道之后绘制，压在路口上面） */
  drawTownPlaza();

  /* 城镇边界：每镇一圈矮墙（区分镇内与荒野） */
  ctx.fillStyle = '#26263a';
  for(const def of TOWN_DEFS){
    const zx = def.ox, zy = def.oy;
    const top = Math.max(TOWN_GROUND_TOP, zy + 40);
    ctx.fillRect(zx, top, TOWN_ZONE_W, 10);
    ctx.fillRect(zx, zy + TOWN_ZONE_H - 14, TOWN_ZONE_W, 14);
    ctx.fillRect(zx, top, 12, zy + TOWN_ZONE_H - 14 - top);
    ctx.fillRect(zx + TOWN_ZONE_W - 12, top, 12, zy + TOWN_ZONE_H - 14 - top);
  }

  /* 建筑 + NPC + 玩家按「脚底 y」排序绘制（2.5D 前后遮挡） */
  const camCx = townCam.x + VW/2, camCy = townCam.y + VH/2;
  const drawables = [];
  for(const b of TOWN_BUILDINGS){
    if(Math.abs(b.x - camCx) > VW * 0.9 + b.w/2) continue;
    if(Math.abs(b.y - camCy) > VH * 0.9 + b.h) continue;
    drawables.push({ y:b.y, fn:()=>drawBuilding(b) });
  }
  for(const npc of NPCS){
    if(Math.abs(npc.x - camCx) > VW * 0.9) continue;
    drawables.push({ y:npc.y, fn:()=>drawNPC(npc) });
  }
  if(townPlayer) drawables.push({ y:townPlayer.y, fn:()=>drawTownPlayer(townPlayer) });
  /* ★ 联机：同房间的其他玩家一起参与 y 排序，才能正确前后遮挡 */
  if(window.ONLINE && window.ONLINE.collectDrawables) window.ONLINE.collectDrawables(drawables);
  drawables.sort((a,b)=>a.y-b.y);
  for(const d of drawables) d.fn();

  ctx.restore();
  /* ══════════ 世界层结束 ══════════ */

  /* ★ 天际飞鸟：雁群掠过天空（屏幕层） */
  drawTownBirds(t);

  /* ★ 主线任务追踪 HUD（左侧功能按钮下方，可收起） */
  drawQuestTracker(18, 412);

  /* 当前坊区名（顶部中央） */
  ctx.textAlign = 'center';
  ctx.font = 'bold 17px "Microsoft YaHei"';
  ctx.fillStyle = 'rgba(255,255,255,0.50)';
  ctx.fillText(area.name, VW/2, 40);
  ctx.font = '11px "Microsoft YaHei"';
  ctx.fillStyle = 'rgba(170,190,210,0.38)';
  ctx.fillText(area.sub, VW/2, 58);

  /* ══════════ DNF 风格城镇 HUD（统一入口，避免文字堆叠） ══════════ */
  drawTownHud();

  /* ★ 左侧功能按钮组（方形图标式，DNF 侧栏风格） */
  drawTownSideButtons();

  /* ★ 任务引导箭头（仿 DNF：指向当前任务目标） */
  drawQuestGuideArrow();

  /* ★ 背包容量警告 */
  drawBagWarning();

  /* ★ 城镇小地图 */
  drawTownMinimap();

  /* ★ 环境粒子 - 飘落花瓣 */
  for(let i = 0; i < 12; i++){
    const px = (t * 25 + i * 107) % (VW + 40) - 20;
    const py = (t * 35 + i * 67) % (GY_BOTTOM - 50);
    const rot = t * 2 + i;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(rot);
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = i % 3 === 0 ? '#ffb7c5' : (i % 3 === 1 ? '#ffc9d5' : '#ffdde5');
    ctx.beginPath();
    ctx.ellipse(0, 0, 4, 2.5, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

/* ★ 天际飞鸟：5 只雁鸟横穿天空，翅膀上下扇动，越远越小 */
function drawTownBirds(t){
  const skyBot = GY_BOTTOM - 120;
  ctx.save();
  ctx.strokeStyle = 'rgba(26,22,38,0.60)';
  ctx.lineCap = 'round';
  for(let i = 0; i < 5; i++){
    const spd = 24 + (i % 3) * 8;
    const bx = (t * spd + i * 260) % (VW + 180) - 90;
    const by = 74 + i * 24 + Math.sin(t * 0.9 + i * 1.7) * 12;
    if(by > skyBot) continue;
    const flap = Math.sin(t * 7 + i * 2.1);
    const s = 8 - i * 0.7;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(bx - s, by - flap * s * 0.45);
    ctx.quadraticCurveTo(bx, by + 2.5, bx + s, by - flap * s * 0.45);
    ctx.stroke();
  }
  ctx.restore();
}

/* 绘制NPC */
function drawNPC(npc){
  const x = npc.x, y = npc.y;
  // NPC阴影
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(x, y, 50, 12, 0, 0, TAU);
  ctx.fill();

  // 用图片绘制NPC（带呼吸动作）；传送门用专属漩涡绘制
  if(npc.type === 'portal'){
    const t2 = (G ? G.t : performance.now() * 0.001);
    const breathe = Math.sin(t2 * 2.2 + npc.x * 0.01) * 5;
    const gy2 = y - 88;
    /* 传送门：渐变漩涡 + 双环 + 环绕光点 */
    const pg = ctx.createRadialGradient(x, gy2, 4, x, gy2, 66);
    pg.addColorStop(0, 'rgba(150,235,255,0.85)');
    pg.addColorStop(0.45, 'rgba(90,140,255,0.40)');
    pg.addColorStop(1, 'rgba(60,80,200,0)');
    ctx.fillStyle = pg;
    ctx.beginPath(); ctx.ellipse(x, gy2, 36, 54 + breathe, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(160,240,255,0.75)'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.ellipse(x, gy2, 30, 50 + breathe, 0, 0, TAU); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 1.2;
    for(let k = 0; k < 3; k++){
      const ph = t2 * 1.6 + k * 2.1;
      ctx.beginPath(); ctx.ellipse(x, gy2, 10 + k * 9, 16 + k * 13, Math.sin(ph) * 0.6, 0, TAU); ctx.stroke();
    }
    for(let k = 0; k < 5; k++){
      const a = t2 * 1.8 + k * TAU / 5;
      ctx.fillStyle = 'rgba(190,245,255,0.9)';
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * 40, gy2 + Math.sin(a) * (58 + breathe), 2.2, 0, TAU);
      ctx.fill();
    }
  } else {
    const img = npcImages[npc.id];
    if(img && img.complete && img.naturalWidth > 0){
      // 呼吸动作：轻微上下抖动
      const breatheOffset = Math.sin((G ? G.t : 0) * 2 + npc.x * 0.01) * 4;
      // 图片绘制：保持比例，高度约200像素
      const imgH = 200;
      const imgW = img.width * (imgH / img.height);
      ctx.drawImage(img, x - imgW/2, y - imgH + breatheOffset, imgW, imgH);
    } else if(npc.type !== 'lore') {
      // 图片未加载完成时的简易绘制
      ctx.fillStyle = '#888';
      ctx.beginPath();
      ctx.arc(x, y - 100, 35, 0, TAU);
      ctx.fill();
    }
  }

  /* ---- 名牌：深色底带 + 描边字，DNF 风格 ---- */
  ctx.textAlign = 'center';
  ctx.font = 'bold 17px "Microsoft YaHei"';
  const nameW = ctx.measureText(npc.name).width;
  ctx.fillStyle = 'rgba(8,10,20,0.62)';
  ctx.beginPath();
  ctx.roundRect(x - nameW/2 - 10, y - 246, nameW + 20, 24, 8);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,214,120,0.35)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(0,0,0,0.7)';
  ctx.strokeText(npc.name, x, y - 228);
  ctx.fillStyle = '#ffe9b0';
  ctx.fillText(npc.name, x, y - 228);

  /* ★ 交互状态：远处是感叹号气泡，进入范围变成 J 键提示 */
  const d = townPlayer ? Math.abs(townPlayer.x - npc.x) : 999;
  const tNow = (G ? G.t : performance.now() * 0.001);
  /* ★ 任务状态标记（DNF 式）：！= 有任务进行中，？= 可交付领奖 */
  let questMark = null, markGold = true;
  if(npc.type === 'quest' && G && G.player){
    const qq = questOf(G.player);
    if(qq.readyTurnIn) questMark = '？';
    else if(MAIN_QUESTS[qq.idx]) questMark = '！';
  } else if(npc.type === 'dungeon' && G && G.player){
    const qq = questOf(G.player);
    const st = qq && MAIN_QUESTS[qq.idx] ? MAIN_QUESTS[qq.idx].steps[qq.step] : null;
    if(st && (st.type === 'clear' || st.type === 'kills')) questMark = '！';
  }
  if(d < 130 && d >= 80){
    const bobY = Math.sin(tNow * 3) * 4;
    const by = y - 278 + bobY;
    const isQ = questMark === '？';
    ctx.fillStyle = questMark ? 'rgba(255,214,90,0.98)' : 'rgba(255,214,90,0.95)';
    ctx.beginPath();
    ctx.arc(x, by, 14, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(80,50,0,0.85)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#3a2600';
    ctx.font = 'bold 18px "Microsoft YaHei"';
    ctx.fillText(questMark || '!', x, by + 7);
  } else if(d < 80){
    /* 键位提示胶囊：宽度按文字实测，避免长短不一时挤压或溢出 */
    const verb = NPC_VERB[npc.type] || '交谈';
    const pulse = 0.72 + 0.28 * Math.sin(tNow * 4);
    ctx.font = 'bold 13px "Microsoft YaHei"';
    const tw = ctx.measureText(verb).width;
    const cw = Math.round(44 + tw), ch = 26, cy = y - 278;
    ctx.globalAlpha = pulse;
    ctx.fillStyle = 'rgba(10,12,24,0.88)';
    ctx.beginPath();
    ctx.roundRect(x - cw/2, cy - ch/2, cw, ch, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,214,90,0.9)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.globalAlpha = 1;
    /* 金色 J 键帽 */
    ctx.fillStyle = '#ffd45a';
    ctx.beginPath();
    ctx.roundRect(x - cw/2 + 6, cy - 9, 18, 18, 4);
    ctx.fill();
    ctx.fillStyle = '#2a1c00';
    ctx.font = 'bold 13px "Consolas", monospace';
    ctx.fillText('J', x - cw/2 + 15, cy + 5);
    /* 动词：左对齐接在键帽后面 */
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffe9b0';
    ctx.font = 'bold 13px "Microsoft YaHei"';
    ctx.fillText(verb, x - cw/2 + 30, cy + 5);
    ctx.textAlign = 'center';
  } else if(questMark){
    /* ★ 远距离也要看到任务标记（弹跳的！/？） */
    const bobY = Math.sin(tNow * 2.4) * 5;
    const by = y - 282 + bobY;
    const glow = questMark === '？' ? 1 : 0.75;
    ctx.save();
    ctx.globalAlpha = 0.35 * glow;
    const mg = ctx.createRadialGradient(x, by, 2, x, by, 26);
    mg.addColorStop(0, 'rgba(255,214,90,0.9)'); mg.addColorStop(1, 'rgba(255,214,90,0)');
    ctx.fillStyle = mg;
    ctx.beginPath(); ctx.arc(x, by, 26, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.fillStyle = questMark === '？' ? '#ffe27a' : '#ffd166';
    ctx.strokeStyle = 'rgba(60,36,0,0.9)'; ctx.lineWidth = 4;
    ctx.font = 'bold 34px "Microsoft YaHei"';
    ctx.strokeText(questMark, x, by + 12);
    ctx.fillText(questMark, x, by + 12);
  }
}

/* 绘制城镇玩家（持剑角色） */
function drawTownPlayer(p){
  const x = p.x, y = p.y;
  const weaponIdx = (G && G.player && G.player.weaponIdx) || 0;
  const townAtlas = atlasOf(weaponIdx);
  const auraScale = townAtlas ? (townAtlas.bodyWorld / 110) : 1;

  // 阴影
  ctx.fillStyle = 'rgba(0,0,0,0.32)';
  ctx.beginPath();
  ctx.ellipse(x, y + 2, 32, 8, 0, 0, TAU);
  ctx.fill();

  /* ★ 武器强化/增幅光效（城镇中全功率展示） */
  if(G && G.player && G.player.equipment) drawPlayerWeaponAura(G.player, x, y, auraScale, {strong:true});

  if(!drawTownPlayerSprite(p)){
    // 精灵表未加载时的简易小人
    ctx.fillStyle = '#3a3a5a';
    ctx.fillRect(x - 12, y - 30, 10, 30);
    ctx.fillRect(x + 2, y - 30, 10, 30);
    const bodyColors = ['#4a6a9a', '#4a4a4a', '#4a6a9a', '#6a4a4a'];
    ctx.fillStyle = bodyColors[weaponIdx] || '#4a6a9a';
    ctx.beginPath(); ctx.roundRect(x - 15, y - 70, 30, 45, 6); ctx.fill();
    ctx.fillStyle = '#f0d9b8';
    ctx.beginPath(); ctx.arc(x, y - 85, 14, 0, TAU); ctx.fill();
    ctx.fillStyle = '#2a2a2a';
    ctx.beginPath(); ctx.arc(x, y - 88, 14, Math.PI, 0); ctx.fill();
  }

  if(G && G.player && G.player.equipment) drawPlayerWeaponAuraFront(G.player, x, y, auraScale, {strong:true});

  /* ★ 标尺（?cal=1 时显示，用于校准装备外观锚点） */
  if(window.DBG_CAL && townAtlas){
    const bp = 150 * (townAtlas.bodyWorld / 110);
    ctx.save();
    ctx.font = '10px monospace';
    for(let i = 0; i <= 10; i++){
      const fy = y - bp * (i / 10);
      ctx.strokeStyle = i % 5 === 0 ? 'rgba(255,90,90,0.95)' : 'rgba(255,90,90,0.45)';
      ctx.beginPath(); ctx.moveTo(x - 110, fy); ctx.lineTo(x + 110, fy); ctx.stroke();
      ctx.fillStyle = '#ffe';
      ctx.textAlign = 'left';
      ctx.fillText((i / 10).toFixed(1), x + 114, fy + 3);
    }
    ctx.fillStyle = '#7df';
    ctx.fillText('bp=' + bp.toFixed(1), x - 110, y + 14);
    ctx.restore();
  }

  /* 头顶名字和等级 */
  const weaponNames = (typeof JOB_NAMES !== 'undefined') ? JOB_NAMES : ['剑士', '剑客', '枪手', '格斗家'];
  const charName = (G && G.playerName) || weaponNames[weaponIdx];
  const charLevel = p.level || (G && G.player ? G.player.level : 1) || 1;
  const nameY = y - 178;

  ctx.textAlign = 'center';
  ctx.font = 'bold 16px "Microsoft YaHei"';
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillText(charName, x + 1, nameY + 1);
  ctx.fillStyle = '#fff';
  ctx.fillText(charName, x, nameY);
  ctx.font = '13px "Microsoft YaHei"';
  ctx.fillStyle = '#ffd700';
  ctx.fillText('Lv.' + charLevel, x, nameY + 18);
}

