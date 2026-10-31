/* ============================================================
   ★ 房间场景：8 套配色 + 8 类道具，按「关卡主题 × 房间号」轮换
   —— 同一个副本里每进一个房间，天光、地色、远景都会变
   ============================================================ */
const ROOM_PALETTES = [
  { name:'晨雾竹林', sky:['#0d1f30','#1d4256','#3d6d6a'], far:'#17324a', mid:'#1d3b34', near:'#12281f',
    ground:['#2f4a33','#12241a'], accent:'#9fe6ff', prop:'bamboo', fog:'rgba(150,220,210,0.10)' },
  { name:'赤月荒原', sky:['#1a0d16','#3a1420','#6e2630'], far:'#2a1220', mid:'#341420', near:'#1c0a10',
    ground:['#4a2422','#201010'], accent:'#ff8a7a', prop:'deadTree', fog:'rgba(255,120,100,0.10)' },
  { name:'雪岭云海', sky:['#182436','#2e4460','#7a94b0'], far:'#2a3c54', mid:'#324a62', near:'#1e2e40',
    ground:['#4a5e72','#22313f'], accent:'#cfeaff', prop:'pine', fog:'rgba(200,230,255,0.14)' },
  { name:'古寺残垣', sky:['#221a2c','#3e2a48','#6a4a5a'], far:'#2a1c34', mid:'#33223e', near:'#1c1226',
    ground:['#4a3a42','#221820'], accent:'#ffd166', prop:'ruins', fog:'rgba(255,210,150,0.08)' },
  { name:'幽光洞窟', sky:['#08121c','#122436','#1c3a4a'], far:'#0e2030', mid:'#122a36', near:'#08161e',
    ground:['#223a44','#0c1a22'], accent:'#7dffd4', prop:'crystal', fog:'rgba(120,255,220,0.10)' },
  { name:'落日戈壁', sky:['#2a1408','#5a2a10','#a8542a'], far:'#3a1c10', mid:'#46220e', near:'#281208',
    ground:['#6a4020','#2a1608'], accent:'#ffb04a', prop:'mesa', fog:'rgba(255,170,90,0.10)' },
  { name:'冥河渡口', sky:['#0e0e1a','#1c1c34','#2e2e50'], far:'#14142a', mid:'#1a1a34', near:'#0e0e1c',
    ground:['#2a2a44','#10101c'], accent:'#b388ff', prop:'lantern', fog:'rgba(160,140,255,0.12)' },
  { name:'天穹裂隙', sky:['#0a0818','#241a44','#4a2a6a'], far:'#1a1236', mid:'#201640', near:'#120c26',
    ground:['#342a52','#141026'], accent:'#eaf6ff', prop:'rift', fog:'rgba(200,190,255,0.10)' }
];
function roomPaletteIdx(){
  if(!G) return 0;
  let base = 0;
  try{ const lvl = getLevelConfig(G.levelIdx || 0); base = lvl ? (lvl.theme || 0) : 0; }catch(e){ base = 0; }
  const r = G.roomIdx || 0;
  return (base * 3 + r) % ROOM_PALETTES.length;
}
function roomPal(){ return ROOM_PALETTES[roomPaletteIdx()]; }

/* 确定性伪随机：同一房间每次绘制一致，不会闪 */
function rndAt(i, salt){
  const x = Math.sin((i + 1) * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function drawRoomMountain(pal, off, alpha){
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = pal.far;
  const baseY = GY_TOP + 6;
  for(let k = -1; k < 4; k++){
    const bx = k * 640 - (off % 640);
    ctx.beginPath();
    ctx.moveTo(bx - 40, baseY);
    ctx.quadraticCurveTo(bx + 110, baseY - 210 - (k % 2) * 60, bx + 260, baseY);
    ctx.quadraticCurveTo(bx + 400, baseY - 150, bx + 620, baseY);
    ctx.lineTo(bx + 660, baseY + 30);
    ctx.lineTo(bx - 60, baseY + 30);
    ctx.closePath(); ctx.fill();
  }
  /* 山脊高光 */
  ctx.strokeStyle = hexA(pal.accent, 0.18);
  ctx.lineWidth = 2;
  for(let k = -1; k < 4; k++){
    const bx = k * 640 - (off % 640);
    ctx.beginPath();
    ctx.moveTo(bx + 110, baseY - 200);
    ctx.quadraticCurveTo(bx + 160, baseY - 120, bx + 230, baseY - 20);
    ctx.stroke();
  }
  ctx.restore();
}

function drawRoomProp(kind, x, baseY, scale, col, accent){
  ctx.save();
  ctx.translate(x, baseY);
  ctx.scale(scale, scale);
  ctx.fillStyle = col;
  ctx.strokeStyle = col;

  if(kind === 'bamboo'){
    ctx.lineCap = 'round';
    for(let b = 0; b < 3; b++){
      const bx = (b - 1) * 22;
      const bh = 190 + b * 46;
      ctx.lineWidth = 9 - b * 1.5;
      ctx.beginPath(); ctx.moveTo(bx, 0); ctx.lineTo(bx + Math.sin(b) * 10, -bh); ctx.stroke();
      /* 竹节 */
      ctx.strokeStyle = hexA(accent, 0.35); ctx.lineWidth = 2;
      for(let j = 1; j < 4; j++){
        const yy = -bh * j / 4;
        ctx.beginPath(); ctx.moveTo(bx - 6, yy); ctx.lineTo(bx + 7, yy); ctx.stroke();
      }
      /* 叶 */
      ctx.strokeStyle = col;
      ctx.lineWidth = 3;
      for(let j = 0; j < 4; j++){
        const yy = -bh + j * 22;
        const dir = j % 2 ? 1 : -1;
        ctx.beginPath(); ctx.moveTo(bx, yy); ctx.quadraticCurveTo(bx + dir * 24, yy - 10, bx + dir * 40, yy - 4); ctx.stroke();
      }
    }
  } else if(kind === 'deadTree'){
    ctx.lineCap = 'round';
    ctx.lineWidth = 12;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-4, -120); ctx.stroke();
    ctx.lineWidth = 8;
    for(let b = 0; b < 4; b++){
      const yy = -40 - b * 24;
      const dir = b % 2 ? 1 : -1;
      ctx.beginPath(); ctx.moveTo(-3, yy); ctx.lineTo(dir * 44, yy - 46); ctx.stroke();
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(dir * 44, yy - 46); ctx.lineTo(dir * 62, yy - 78); ctx.stroke();
      ctx.lineWidth = 8;
    }
  } else if(kind === 'pine'){
    for(let i = 0; i < 4; i++){
      const w = 92 - i * 18, yy = -30 - i * 44;
      ctx.beginPath();
      ctx.moveTo(-w, yy); ctx.lineTo(0, yy - 74); ctx.lineTo(w, yy);
      ctx.closePath(); ctx.fill();
    }
    ctx.fillRect(-8, -30, 16, 34);
  } else if(kind === 'ruins'){
    /* 断墙 + 立柱 */
    ctx.fillRect(-90, -150, 180, 150);
    ctx.fillStyle = '#000';
    ctx.globalAlpha = 0.18;
    ctx.fillRect(-90, -150, 180, 22);
    ctx.globalAlpha = 1;
    ctx.fillStyle = col;
    ctx.fillRect(-60, -86, 34, 86);
    ctx.fillRect(26, -66, 34, 66);
    /* 破口 */
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.moveTo(-18, -150); ctx.lineTo(14, -112); ctx.lineTo(-6, -74); ctx.lineTo(-30, -104);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = hexA(accent, 0.5);
    ctx.fillRect(-90, -154, 180, 4);
  } else if(kind === 'crystal'){
    ctx.fillStyle = hexA('#7dffd4', 0.20);
    for(let i = 0; i < 5; i++){
      const cx = (i - 2) * 26;
      const hh = 70 + rndAt(i, 3) * 110;
      const ww = 12 + rndAt(i, 7) * 12;
      ctx.beginPath();
      ctx.moveTo(cx, 0); ctx.lineTo(cx - ww, -hh * 0.4); ctx.lineTo(cx, -hh); ctx.lineTo(cx + ww, -hh * 0.4);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = hexA('#d8fff2', 0.55); ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = hexA('#7dffd4', 0.20);
    }
  } else if(kind === 'mesa'){
    ctx.beginPath();
    ctx.moveTo(-110, 0); ctx.lineTo(-80, -108); ctx.lineTo(60, -108); ctx.lineTo(100, 0);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = hexA(accent, 0.16);
    ctx.fillRect(-74, -108, 128, 8);
  } else if(kind === 'lantern'){
    /* 灯杆 + 悬灯 */
    ctx.lineWidth = 8;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -190); ctx.lineTo(46, -190); ctx.stroke();
    const ly = -152 + Math.sin((G ? G.t : 0) * 1.2) * 3;
    ctx.fillStyle = hexA('#b388ff', 0.30);
    ctx.beginPath(); ctx.arc(52, ly, 34, 0, TAU); ctx.fill();
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.ellipse(52, ly, 13, 17, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = hexA('#e8dcff', 0.85);
    ctx.beginPath(); ctx.arc(52, ly, 5, 0, TAU); ctx.fill();
  } else if(kind === 'rift'){
    /* 浮空岩 + 裂光 */
    for(let i = 0; i < 3; i++){
      const cx = (i - 1) * 60, cy = -90 - i * 48;
      ctx.beginPath();
      ctx.moveTo(cx - 26, cy); ctx.lineTo(cx, cy - 16); ctx.lineTo(cx + 26, cy); ctx.lineTo(cx, cy + 14);
      ctx.closePath(); ctx.fill();
    }
    ctx.strokeStyle = hexA(accent, 0.45);
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, -230); ctx.lineTo(-10, -140); ctx.lineTo(8, -90); ctx.stroke();
  }
  ctx.restore();
}

function drawRoomScenery(pal, camX){
  /* 远山 */
  drawRoomMountain(pal, camX * 0.10, 1.0);
  drawRoomMountain(pal, camX * 0.18 + 320, 0.65);

  /* 中层道具 */
  const midOff = camX * 0.36;
  const spacing = 250;
  const i0 = Math.floor(midOff / spacing) - 2;
  ctx.save();
  ctx.globalAlpha = 0.92;
  for(let i = i0; i < i0 + Math.ceil(VW / spacing) + 4; i++){
    const x = i * spacing - midOff;
    const sc = 0.72 + rndAt(i, 11) * 0.42;
    drawRoomProp(pal.prop, x, GY_TOP + 12, sc, pal.mid, pal.accent);
  }
  ctx.restore();

  /* 近层剪影（压暗，制造纵深） */
  const nearOff = camX * 0.66;
  const sp2 = 330;
  const j0 = Math.floor(nearOff / sp2) - 2;
  ctx.save();
  ctx.globalAlpha = 0.55;
  for(let i = j0; i < j0 + Math.ceil(VW / sp2) + 4; i++){
    const x = i * sp2 - nearOff;
    const sc = 0.9 + rndAt(i, 23) * 0.35;
    drawRoomProp(pal.prop, x, GY_BOTTOM - 6, sc, pal.near, pal.accent);
  }
  ctx.restore();
}

function drawSky(){
  const pal = roomPal();
  const g = ctx.createLinearGradient(0, 0, 0, GY_TOP + 40);
  g.addColorStop(0, pal.sky[0]);
  g.addColorStop(0.58, pal.sky[1]);
  g.addColorStop(1, pal.sky[2]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, VW, GY_TOP + 40);

  /* 天光：位置随房间号变化 */
  const idx = roomPaletteIdx();
  const lx = VW * (0.18 + (idx % 4) * 0.22);
  const ly = 96 + (idx % 3) * 34;
  const lr = 74 + (idx % 3) * 20;
  const lg = ctx.createRadialGradient(lx, ly, 2, lx, ly, lr * 2.6);
  lg.addColorStop(0, hexA(pal.accent, 0.95));
  lg.addColorStop(0.20, hexA(pal.accent, 0.55));
  lg.addColorStop(1, hexA(pal.accent, 0));
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = lg;
  ctx.beginPath(); ctx.arc(lx, ly, lr * 2.6, 0, TAU); ctx.fill();
  ctx.fillStyle = hexA(pal.accent, 0.9);
  ctx.beginPath(); ctx.arc(lx, ly, lr * 0.55, 0, TAU); ctx.fill();
  ctx.restore();

  /* 星尘 */
  ctx.save();
  for(let i = 0; i < 42; i++){
    const sx = rndAt(i, 5) * VW;
    const sy = rndAt(i, 9) * (GY_TOP - 60);
    const tw = 0.35 + 0.65 * Math.abs(Math.sin((G ? G.t : 0) * 0.8 + i));
    ctx.globalAlpha = tw * 0.55;
    ctx.fillStyle = pal.accent;
    ctx.fillRect(sx, sy, 1.6, 1.6);
  }
  ctx.restore();

  /* 云雾带 */
  const t = (G ? G.t : 0);
  ctx.save();
  ctx.globalAlpha = 0.5;
  for(let i = 0; i < 3; i++){
    const fogY = GY_TOP - 120 + i * 52;
    const off = (t * (7 + i * 4)) % (VW + 400);
    const fg = ctx.createLinearGradient(0, fogY, 0, fogY + 46);
    fg.addColorStop(0, 'rgba(255,255,255,0)');
    fg.addColorStop(0.5, pal.fog);
    fg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = fg;
    ctx.fillRect(-100 + off - (VW + 400), fogY, VW + 400, 46);
    ctx.fillRect(-100 + off, fogY, VW + 400, 46);
  }
  ctx.restore();
}

function drawFarScenery(){
  const pal = roomPal();
  const camX = (G && G.camera) ? G.camera.x : 0;
  drawRoomScenery(pal, camX);
}

function drawGround(){
  const pal = roomPal();
  const camX = (G && G.camera) ? G.camera.x : 0;
  const g = ctx.createLinearGradient(0, GY_TOP, 0, GY_BOTTOM + 30);
  g.addColorStop(0, pal.ground[0]);
  g.addColorStop(1, pal.ground[1]);
  ctx.fillStyle = g;
  ctx.fillRect(0, GY_TOP, VW, VH - GY_TOP);

  /* 透视地砖：随房间色调整 */
  ctx.strokeStyle = hexA(pal.accent, 0.10);
  ctx.lineWidth = 1;
  for(let i = 1; i <= 9; i++){
    const yy = GY_TOP + (i / 9) * (i / 9) * GY_DEPTH;
    ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(VW, yy); ctx.stroke();
  }
  /* 纵向砖缝（跟随相机） */
  const off = camX * 0.6 % 120;
  for(let i = -2; i < VW / 120 + 2; i++){
    const x = i * 120 - off;
    ctx.beginPath();
    ctx.moveTo(x, GY_TOP);
    ctx.lineTo(x + (x - VW / 2) * 0.16, VH);
    ctx.stroke();
  }
  /* 地表高光 */
  const hg = ctx.createLinearGradient(0, GY_TOP, 0, GY_TOP + 26);
  hg.addColorStop(0, hexA(pal.accent, 0.20));
  hg.addColorStop(1, hexA(pal.accent, 0));
  ctx.fillStyle = hg;
  ctx.fillRect(0, GY_TOP, VW, 26);

  /* 房间角落的花草/碎石点缀 */
  ctx.save();
  ctx.globalAlpha = 0.35;
  for(let i = 0; i < 18; i++){
    const rx = (rndAt(i, 31) * (VW + 400) - camX * 0.85) % (VW + 400);
    const ry = GY_TOP + 16 + rndAt(i, 37) * (GY_DEPTH - 20);
    ctx.fillStyle = pal.near;
    ctx.beginPath();
    ctx.ellipse(rx < 0 ? rx + VW + 400 : rx, ry, 8 + rndAt(i, 41) * 12, 3, 0, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

function drawShadow(x,y,w,alpha){
  const sc = depthScale(y);
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
  ctx.fillStyle = '#000';
  ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.1,w*sc), Math.max(0.1,w*sc*0.3), 0, 0, TAU); ctx.fill();
  ctx.globalAlpha = 1;
}

function drawFighter(o){
  const sc = depthScale(o.y)*o.scale;
  
  /* ★ 根据武器类型调整体型（DNF风格职业区别） */
  let bodyMul = 1.0;
  if(o.weapon === 'sword') bodyMul = 1.0;      // 剑士：标准体型
  else if(o.weapon === 'blade') bodyMul = 0.95; // 剑客（大刀）：矮壮
  else if(o.weapon === 'spear') bodyMul = 1.1; // 枪手（长枪）：高瘦
  else if(o.weapon === 'fist') bodyMul = 0.9;  // 格斗家（手套）：矮壮肌肉型
  
  const px = o.x, py = o.y - o.h;
  const pal = o.pal, facing = o.facing || 1;
  const lean = o.bodyLean || 0, knee = o.kneeBend || 0;
  const legPose = o.legPose || 0;
  ctx.save();
  ctx.translate(px, py); ctx.scale(facing*bodyMul, bodyMul); ctx.scale(sc,sc);
  ctx.rotate(lean); ctx.translate(0, lean*30 + knee*0.5);
  const isRunning = o.pose === 'run';
  const legSwing = isRunning ? Math.sin(o.walkPhase) : 0;
  const bodyBob = isRunning ? Math.abs(Math.sin(o.walkPhase))*3 : 0;
  ctx.translate(0, -bodyBob);
  const drawLeg = (isFront, swing)=>{
    const hipX = isFront?4:-4, hipY = -35;
    /* 弓步姿态：前腿弯曲前弓，后腿蹬直 */
    const poseFront = isFront ? legPose : -legPose*0.3;
    const poseBack = isFront ? -legPose*0.5 : legPose*0.7;
    const kneeX = hipX+swing*15+poseFront*12, kneeY = hipY+18-Math.abs(legPose)*3;
    const footX = hipX+swing*20+poseFront*22+poseBack*8, footY = 0;
    ctx.strokeStyle = pal.pants; ctx.lineWidth = 9; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(hipX, hipY); ctx.lineTo(kneeX, kneeY); ctx.stroke();
    ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(kneeX, kneeY); ctx.lineTo(footX, footY); ctx.stroke();
    ctx.fillStyle = '#2a1a10';
    ctx.beginPath(); ctx.ellipse(footX+3, footY, 8, 4, 0, 0, TAU); ctx.fill();
  };
  drawLeg(false, -legSwing);
  ctx.fillStyle = pal.cloth;
  ctx.beginPath(); ctx.moveTo(-12,-34); ctx.lineTo(12,-34); ctx.quadraticCurveTo(18,-50,16,-65); ctx.quadraticCurveTo(0,-70,-16,-65); ctx.quadraticCurveTo(-18,-50,-12,-34); ctx.fill();
  ctx.fillStyle = pal.belt; ctx.fillRect(-13,-42,26,6);
  ctx.fillStyle = '#d8b040'; ctx.fillRect(-3,-42,6,6);
  const headY = -82;
  ctx.fillStyle = pal.skin; ctx.beginPath(); ctx.roundRect(-4,-72,8,8,2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(0, headY, 11, 13, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = pal.hat; ctx.beginPath(); ctx.arc(0, headY-3, 12, Math.PI, TAU); ctx.fill();
  ctx.fillStyle = (o.isPlayer?'#5ee7ff':'#ff4a3a'); ctx.beginPath(); ctx.arc(5, headY, 2, 0, TAU); ctx.fill();
  drawLeg(true, legSwing);
  /* 后臂（左手） - 计算终点，稍后由武器覆盖 */
  const bUAng = o.backUpperArmAng!==undefined?o.backUpperArmAng:1.65;
  const bFAng = o.backForeArmAng!==undefined?o.backForeArmAng:0.25;
  const bSx = -6, bSy = -62;
  const bEx = bSx+Math.cos(bUAng)*20, bEy = bSy+Math.sin(bUAng)*20;
  const bWx = bEx+Math.cos(bUAng+bFAng)*18, bWy = bEy+Math.sin(bUAng+bFAng)*18;
  ctx.strokeStyle = pal.cloth; ctx.lineWidth = 9;
  ctx.beginPath(); ctx.moveTo(bSx, bSy); ctx.lineTo(bEx, bEy); ctx.stroke();
  ctx.strokeStyle = pal.skin; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(bEx, bEy); ctx.lineTo(bWx, bWy); ctx.stroke();
  /* 前臂（右手） */
  const uAng = o.upperArmAng!==undefined?o.upperArmAng:1.65;
  const fAng = o.foreArmAng!==undefined?o.foreArmAng:0.25;
  const wAng = o.weaponAng!==undefined?o.weaponAng:-0.6;
  const sx = 8, sy = -62;
  const ex = sx+Math.cos(uAng)*20, ey = sy+Math.sin(uAng)*20;
  const wx = ex+Math.cos(uAng+fAng)*18, wy = ey+Math.sin(uAng+fAng)*18;
  ctx.strokeStyle = pal.cloth; ctx.lineWidth = 9;
  ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
  ctx.strokeStyle = pal.skin; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(wx, wy); ctx.stroke();
  /* ★ 修复：武器始终水平，尖端朝向前方 */
  const weaponDrawAng = 0; /* 武器始终水平 */
  drawWeaponWithHands(o.weapon, wx, wy, weaponDrawAng, pal.skin, bWx, bWy, uAng+fAng);
  /* ★ 修复：后手画在武器之上，位置对齐水平武器的握把 */
  if(o.weapon && o.weapon !== 'fist'){
    let gripOffsetX = 6, gripOffsetY = 0;
    if(o.weapon === 'blade'){ gripOffsetX = -10; }
    else if(o.weapon === 'spear'){ gripOffsetX = -4; }
    else if(o.weapon === 'axe'){ gripOffsetX = 3; }
    /* 水平武器：握把位置直接在手腕沿水平方向偏移 */
    const backHandX = wx + gripOffsetX; /* cos(0)=1, sin(0)=0 */
    const backHandY = wy;
    ctx.fillStyle = pal.skin;
    ctx.beginPath(); ctx.ellipse(backHandX, backHandY, 5, 4.5, 0, 0, TAU); ctx.fill();
  }
  ctx.restore();
}
function drawWeaponWithHands(type, wx, wy, ang, skinColor, bWx, bWy, frontArmAngle){
  if(!type){
    /* 空手：画两个拳头 */
    ctx.fillStyle = skinColor;
    ctx.beginPath(); ctx.arc(wx,wy,7,0,TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(bWx,bWy,6,0,TAU); ctx.fill();
    return;
  }
  ctx.save(); ctx.translate(wx,wy); ctx.rotate(ang);
  const metal = '#d0e4f5', wood = '#5a3a1a';
  if(type === 'sword'){
    ctx.fillStyle = wood; ctx.fillRect(-2,-2.5,17,5);
    ctx.fillStyle = '#d8b040'; ctx.beginPath(); ctx.roundRect(15,-7,4,14,2); ctx.fill();
    ctx.fillStyle = metal; ctx.beginPath(); ctx.moveTo(19,-2.5); ctx.lineTo(85,-1.5); ctx.lineTo(95,0); ctx.lineTo(85,1.5); ctx.lineTo(19,2.5); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillRect(19,-0.5,70,1);
    /* 前手 - 握剑柄 */
    ctx.fillStyle = skinColor;
    ctx.beginPath(); ctx.ellipse(6, 0, 6, 5, 0, 0, TAU); ctx.fill();
    /* 手指细节 */
    ctx.strokeStyle = skinColor; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(3,-4); ctx.lineTo(3,-6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(6,-4.5); ctx.lineTo(6,-7); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(9,-4); ctx.lineTo(9,-6); ctx.stroke();
    /* 后手 - 辅助握柄（稍偏后） */
    ctx.fillStyle = skinColor;
    ctx.beginPath(); ctx.ellipse(1, 0, 5, 4.5, 0.1, 0, TAU); ctx.fill();
  } else if(type === 'blade'){
    /* ★ 长柄朴刀（贴合刀客立绘手中刀）：藏青长杆 + 鎏金护手/柄尾 + 红缨 + 弧形暗钢单刃 */
    ctx.fillStyle = '#232a3d'; ctx.fillRect(-58,-2.6,72,5.2);
    ctx.fillStyle = '#3a4a6b'; ctx.fillRect(-58,-1,72,1.6);
    /* 鎏金柄尾 + 红缨 */
    ctx.fillStyle = '#c9a227'; ctx.beginPath(); ctx.roundRect(-62,-4,7,8,2.5); ctx.fill();
    ctx.fillStyle = '#c0252b';
    ctx.beginPath(); ctx.moveTo(-58,-2); ctx.quadraticCurveTo(-70,2,-64,10); ctx.quadraticCurveTo(-58,4,-55,2); ctx.closePath(); ctx.fill();
    /* 鎏金护手盘 */
    ctx.fillStyle = '#c9a227'; ctx.beginPath(); ctx.ellipse(15,0,5,9.5,0,0,TAU); ctx.fill();
    ctx.fillStyle = '#e8cf6e'; ctx.beginPath(); ctx.ellipse(15,0,2.6,6.5,0,0,TAU); ctx.fill();
    /* 刀身：弧形单刃，暗钢色 */
    ctx.fillStyle = '#3c4356';
    ctx.beginPath();
    ctx.moveTo(19,-3.2);
    ctx.quadraticCurveTo(62,-16,102,-4.5);
    ctx.quadraticCurveTo(104,-1,100,2.2);
    ctx.quadraticCurveTo(60,7,19,4.2);
    ctx.closePath(); ctx.fill();
    /* 刃口高光 */
    ctx.strokeStyle = '#aebdd2'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(20,3.4); ctx.quadraticCurveTo(60,6.2,99,1.6); ctx.stroke();
    /* 前手 - 握刀柄 */
    ctx.fillStyle = skinColor;
    ctx.beginPath(); ctx.ellipse(-4, 0, 6, 5, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = skinColor; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-7,-4); ctx.lineTo(-7,-6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-4,-4.5); ctx.lineTo(-4,-7); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-1,-4); ctx.lineTo(-1,-6); ctx.stroke();
    /* 后手 */
    ctx.fillStyle = skinColor;
    ctx.beginPath(); ctx.ellipse(-10, 0, 5, 4.5, 0.1, 0, TAU); ctx.fill();
  } else if(type === 'spear'){
    ctx.fillStyle = wood; ctx.fillRect(-10,-1.5,95,3);
    ctx.fillStyle = metal; ctx.beginPath(); ctx.moveTo(78,0); ctx.lineTo(100,-4); ctx.lineTo(105,0); ctx.lineTo(100,4); ctx.closePath(); ctx.fill();
    /* 前手 - 握枪杆中前部 */
    ctx.fillStyle = skinColor;
    ctx.beginPath(); ctx.ellipse(20, 0, 5, 5, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = skinColor; ctx.lineWidth = 2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(18,-4); ctx.lineTo(18,-5.5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(20,-4.5); ctx.lineTo(20,-6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(22,-4); ctx.lineTo(22,-5.5); ctx.stroke();
    /* 后手 - 握枪杆尾部 */
    ctx.fillStyle = skinColor;
    ctx.beginPath(); ctx.ellipse(-4, 0, 5, 5, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = skinColor; ctx.lineWidth = 2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-6,-4); ctx.lineTo(-6,-5.5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-4,-4.5); ctx.lineTo(-4,-6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-2,-4); ctx.lineTo(-2,-5.5); ctx.stroke();
  } else if(type === 'axe'){
    ctx.fillStyle = wood; ctx.fillRect(0,-2,55,4);
    ctx.fillStyle = metal; ctx.beginPath(); ctx.moveTo(40,-2); ctx.lineTo(55,-22); ctx.lineTo(65,0); ctx.lineTo(55,22); ctx.lineTo(40,2); ctx.closePath(); ctx.fill();
    /* 前手 */
    ctx.fillStyle = skinColor;
    ctx.beginPath(); ctx.ellipse(10, 0, 6, 5, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = skinColor; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(8,-4); ctx.lineTo(8,-6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(10,-4.5); ctx.lineTo(10,-7); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(12,-4); ctx.lineTo(12,-6); ctx.stroke();
    /* 后手 */
    ctx.fillStyle = skinColor;
    ctx.beginPath(); ctx.ellipse(3, 0, 5, 4.5, 0.1, 0, TAU); ctx.fill();
  } else if(type === 'dual'){
    ctx.fillStyle = metal; ctx.fillRect(10,-2,50,4); ctx.fillRect(10,-20,50,4);
    /* 前手 */
    ctx.fillStyle = skinColor;
    ctx.beginPath(); ctx.ellipse(18, -1, 5, 5, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(18, -19, 5, 5, 0, 0, TAU); ctx.fill();
  } else if(type === 'fist'){
    /* 拳法：不画武器，画拳头 */
    ctx.fillStyle = skinColor;
    ctx.beginPath(); ctx.ellipse(5, 0, 7, 6, 0, 0, TAU); ctx.fill();
    /* 指关节 */
    ctx.fillStyle = '#d4b896';
    ctx.beginPath(); ctx.arc(8, -3, 2, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(10, 0, 2, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(8, 3, 2, 0, TAU); ctx.fill();
  }
  ctx.restore();
}
/* 纯武器绘制（不含手），用于投射物和特效 */
function drawWeapon(type, wx, wy, ang){
  if(!type) return;
  ctx.save(); ctx.translate(wx,wy); ctx.rotate(ang);
  const metal = '#d0e4f5', wood = '#5a3a1a';
  if(type === 'sword'){
    ctx.fillStyle = wood; ctx.fillRect(0,-2,15,4);
    ctx.fillStyle = '#d8b040'; ctx.beginPath(); ctx.roundRect(15,-7,4,14,2); ctx.fill();
    ctx.fillStyle = metal; ctx.beginPath(); ctx.moveTo(19,-2.5); ctx.lineTo(85,-1.5); ctx.lineTo(95,0); ctx.lineTo(85,1.5); ctx.lineTo(19,2.5); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillRect(19,-0.5,70,1);
  } else if(type === 'blade'){
    /* ★ 长柄朴刀（与刀客立绘手中刀同款）：藏青长杆+鎏金护手+红缨+弧形暗钢刃 */
    ctx.fillStyle = '#232a3d'; ctx.fillRect(-58,-2.6,72,5.2);
    ctx.fillStyle = '#3a4a6b'; ctx.fillRect(-58,-1,72,1.6);
    ctx.fillStyle = '#c9a227'; ctx.beginPath(); ctx.roundRect(-62,-4,7,8,2.5); ctx.fill();
    ctx.fillStyle = '#c0252b';
    ctx.beginPath(); ctx.moveTo(-58,-2); ctx.quadraticCurveTo(-70,2,-64,10); ctx.quadraticCurveTo(-58,4,-55,2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#c9a227'; ctx.beginPath(); ctx.ellipse(15,0,5,9.5,0,0,TAU); ctx.fill();
    ctx.fillStyle = '#e8cf6e'; ctx.beginPath(); ctx.ellipse(15,0,2.6,6.5,0,0,TAU); ctx.fill();
    ctx.fillStyle = '#3c4356';
    ctx.beginPath();
    ctx.moveTo(19,-3.2);
    ctx.quadraticCurveTo(62,-16,102,-4.5);
    ctx.quadraticCurveTo(104,-1,100,2.2);
    ctx.quadraticCurveTo(60,7,19,4.2);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#aebdd2'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(20,3.4); ctx.quadraticCurveTo(60,6.2,99,1.6); ctx.stroke();
  } else if(type === 'spear'){
    ctx.fillStyle = wood; ctx.fillRect(-10,-1.5,95,3);
    ctx.fillStyle = metal; ctx.beginPath(); ctx.moveTo(78,0); ctx.lineTo(100,-4); ctx.lineTo(105,0); ctx.lineTo(100,4); ctx.closePath(); ctx.fill();
  } else if(type === 'axe'){
    ctx.fillStyle = wood; ctx.fillRect(0,-2,55,4);
    ctx.fillStyle = metal; ctx.beginPath(); ctx.moveTo(40,-2); ctx.lineTo(55,-22); ctx.lineTo(65,0); ctx.lineTo(55,22); ctx.lineTo(40,2); ctx.closePath(); ctx.fill();
  } else if(type === 'dual'){
    ctx.fillStyle = metal; ctx.fillRect(10,-2,50,4); ctx.fillRect(10,-20,50,4);
  } else if(type === 'fist'){
    /* ★ 拳套（太极拳锋）：护腕 + 拳锋，拳劲齐射用 */
    ctx.fillStyle = '#3a3f4d'; ctx.fillRect(-14,-9,12,18);
    ctx.fillStyle = '#c9a227'; ctx.fillRect(-4,-9,3.5,18);
    ctx.fillStyle = '#e8c9a0';
    ctx.beginPath(); ctx.ellipse(9,0,13,10.5,0,0,TAU); ctx.fill();
    ctx.fillStyle = '#d4b896';
    for(let k=-1;k<=1;k++){ ctx.beginPath(); ctx.arc(17,k*5,2.4,0,TAU); ctx.fill(); }
  } else if(type === 'cauldron'){
    /* ★ 三足青铜鼎（丹道师本命法宝）：鼎身+双耳+三足+炉火 */
    ctx.fillStyle = '#46543a';
    ctx.fillRect(-16,-23,5,11); ctx.fillRect(11,-23,5,11);            /* 双耳 */
    ctx.beginPath(); ctx.ellipse(0,-5,22,14,0,0,TAU); ctx.fill();     /* 鼎身 */
    ctx.fillStyle = '#6e825c';
    ctx.beginPath(); ctx.ellipse(0,-11,21,6,0,0,TAU); ctx.fill();     /* 口沿 */
    ctx.fillStyle = '#46543a';
    ctx.beginPath(); ctx.moveTo(-15,5); ctx.lineTo(-9,5); ctx.lineTo(-12,21); ctx.lineTo(-17,21); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(15,5); ctx.lineTo(9,5); ctx.lineTo(12,21); ctx.lineTo(17,21); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-2,5); ctx.lineTo(2,5); ctx.lineTo(1,23); ctx.lineTo(-5,23); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#8a9a76'; ctx.lineWidth = 1.4;                  /* 云雷纹 */
    ctx.beginPath(); ctx.moveTo(-14,-5); ctx.lineTo(14,-5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-12,0); ctx.lineTo(12,0); ctx.stroke();
    ctx.fillStyle = 'rgba(255,140,60,0.9)';                            /* 炉火 */
    ctx.beginPath(); ctx.moveTo(-6,-15); ctx.quadraticCurveTo(0,-31,6,-15); ctx.quadraticCurveTo(0,-19,-6,-15); ctx.fill();
  } else if(type === 'pill'){
    /* ★ 金丹：修仙小说常见的圆润丹药——实心金核+丹纹+高光 */
    const pg = ctx.createRadialGradient(-3,-4,1,0,0,11);
    pg.addColorStop(0,'#fff6c8'); pg.addColorStop(0.45,'#ffd166'); pg.addColorStop(1,'#c98a12');
    ctx.fillStyle = '#b8860b'; ctx.beginPath(); ctx.arc(0,0,11,0,TAU); ctx.fill();
    ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(0,0,10,0,TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(120,70,10,0.7)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(0,0,6.5,0.6,2.6); ctx.stroke();
    ctx.beginPath(); ctx.arc(0,0,3.5,2.8,5.2); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath(); ctx.arc(-3.5,-4,2,0,TAU); ctx.fill();
  } else if(type === 'talisman'){
    /* ★ 黄符（符咒师本命）：符纸+朱砂符文+符尾飘带 */
    ctx.fillStyle = '#ffe066'; ctx.fillRect(-7,-24,14,48);
    ctx.strokeStyle = '#b08a00'; ctx.lineWidth = 1.5; ctx.strokeRect(-7,-24,14,48);
    ctx.strokeStyle = '#c0252b'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0,-16); ctx.lineTo(0,14); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-4,-8); ctx.lineTo(4,-8); ctx.moveTo(-4,0); ctx.lineTo(4,0); ctx.moveTo(-4,8); ctx.lineTo(4,8); ctx.stroke();
    ctx.fillStyle = '#c0252b'; ctx.beginPath(); ctx.arc(0,-19,1.8,0,TAU); ctx.fill();
    ctx.strokeStyle = '#e84a4a'; ctx.lineWidth = 1.6;                  /* 符尾 */
    ctx.beginPath(); ctx.moveTo(-5,24); ctx.quadraticCurveTo(0,32,4,26); ctx.stroke();
  }
  ctx.restore();
}
function drawProjectile(pr){
  const sc = depthScale(pr.y);
  const px = pr.x, py = pr.y - (pr.h||0)*sc;
  ctx.save();
  if(pr.kind === 'realSword'){
    ctx.translate(px,py); ctx.rotate(pr.rot); ctx.scale(1.5,1.5); drawWeapon('sword',0,0,0);
    ctx.restore(); return;
  }
  if(pr.kind === 'realBlade'){
    ctx.globalCompositeOperation = 'lighter';
    const glow = ctx.createRadialGradient(px,py,2,px,py,50*sc);
    glow.addColorStop(0,'rgba(255,138,74,0.6)'); glow.addColorStop(0.5,'rgba(255,100,30,0.3)'); glow.addColorStop(1,'rgba(255,50,0,0)');
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(px,py,50*sc,0,TAU); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.translate(px,py); ctx.rotate(pr.rot); ctx.scale(1.5,1.5); drawWeapon('blade',0,0,0);
    ctx.restore(); return;
  }
  if(pr.kind === 'realTalisman'){
    /* 符咒师齐射：黄符模型 + 金色灵光 */
    ctx.globalCompositeOperation = 'lighter';
    const glow = ctx.createRadialGradient(px,py,2,px,py,34*sc);
    glow.addColorStop(0,'rgba(255,224,102,0.45)'); glow.addColorStop(1,'rgba(255,224,102,0)');
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(px,py,34*sc,0,TAU); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.translate(px,py); ctx.rotate(pr.rot); ctx.scale(1.0,1.0);
    drawWeapon('talisman',0,0,0);
    ctx.restore(); return;
  }
  if(pr.kind === 'realPill'){
    /* ★ 金丹：实心金丹模型（圆润丹药+丹纹+高光），不再是光绘光球 */
    const s3 = pr.scale || 1.4;
    ctx.globalCompositeOperation = 'lighter';
    const glow = ctx.createRadialGradient(px,py,2,px,py,28*sc);
    glow.addColorStop(0,'rgba(255,209,102,0.35)'); glow.addColorStop(1,'rgba(255,209,102,0)');
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(px,py,28*sc,0,TAU); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.translate(px,py); ctx.rotate(pr.rot||0); ctx.scale(s3,s3);
    drawWeapon('pill',0,0,0);
    ctx.restore(); return;
  }
  if(pr.kind === 'realFist' || pr.kind === 'realAxe' || pr.kind === 'realCauldron'){
    const s2 = pr.scale || 1.4;
    ctx.translate(px,py); ctx.rotate(pr.rot); ctx.scale(s2,s2);
    drawWeapon(pr.kind === 'realFist' ? 'fist' : (pr.kind === 'realAxe' ? 'axe' : 'cauldron'), 0, 0, 0);
    ctx.restore(); return;
  }
  if(pr.kind === 'realSpear'){
    const s = pr.scale||1.0;
    ctx.translate(px,py); ctx.rotate(pr.rot); ctx.scale(s,s); drawWeapon('spear',0,0,0);
    ctx.restore(); return;
  }
  if(pr.kind === 'glowWeapon'){
    /* 带光晕的兵刃投射物（冰刀 / 凤凰枪 / 梨花枪 / 剑雨） */
    const gwCol = pr.color || '#ffffff';
    const gwS = pr.scale || 1.5;
    ctx.globalCompositeOperation = 'lighter';
    /* 拖尾光带（沿运动反方向） */
    const spd = Math.hypot(pr.vx, pr.vy) || 1;
    const tx2 = px - pr.vx/spd * 120 * gwS, ty2 = py - pr.vy/spd * 120 * gwS;
    const tg = ctx.createLinearGradient(px, py, tx2, ty2);
    tg.addColorStop(0, gwCol); tg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 0.34;
    ctx.strokeStyle = tg; ctx.lineWidth = 9*gwS; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(tx2, ty2); ctx.stroke();
    /* 兵刃周围的小光晕 */
    const gg = ctx.createRadialGradient(px,py,2,px,py,24*gwS*sc);
    gg.addColorStop(0,'rgba(255,255,255,0.55)');
    gg.addColorStop(0.4,gwCol);
    gg.addColorStop(1,'rgba(0,0,0,0)');
    ctx.globalAlpha = 0.32;
    ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(px,py,22*gwS*sc,0,TAU); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.translate(px,py); ctx.rotate(pr.rot); ctx.scale(gwS,gwS);
    ctx.shadowColor = gwCol; ctx.shadowBlur = _fxBlur(16);
    drawWeapon(pr.weaponType || 'blade',0,0,0);
    ctx.shadowBlur = 0;
    ctx.restore(); return;
  }
  if(pr.kind === 'qiBomb'){
    ctx.globalCompositeOperation = 'lighter';
    const r = 45;
    const g = ctx.createRadialGradient(px,py,5,px,py,r*2.5);
    g.addColorStop(0,'#fff'); g.addColorStop(0.2,'#ffe066'); g.addColorStop(0.5,pr.color); g.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px,py,r*2.5,0,TAU); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(px,py,r*0.5,0,TAU); ctx.fill();
  }
  if(pr.kind === 'dart'){
    ctx.translate(px,py); ctx.rotate(pr.rot);
    ctx.fillStyle = '#888'; ctx.beginPath(); ctx.moveTo(0,-3); ctx.lineTo(12,0); ctx.lineTo(0,3); ctx.closePath(); ctx.fill();
  }
  /* ★ 远程普攻法术弹：按角色设定主题化（缩小体积） */
  if(pr.kind === 'spellShot'){
    const sub = pr.subKind;
    const col = pr.color || '#ffffff', glow = pr.glow || '#ffffff', core = pr.core || '#ffffff';
    const dir = (pr.vx >= 0 ? 1 : -1);
    /* 拖尾光带（缩短、变细，贴合缩小后的粒子） */
    ctx.globalCompositeOperation = 'lighter';
    const spd = Math.hypot(pr.vx, pr.vy) || 1;
    const tl = pr.w * 1.7;
    const tx2 = px - pr.vx/spd * tl, ty2 = py - pr.vy/spd * tl;
    const tg = ctx.createLinearGradient(px, py, tx2, ty2);
    tg.addColorStop(0, glow); tg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 0.42; ctx.strokeStyle = tg; ctx.lineWidth = Math.max(2.5, pr.w*0.22); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(tx2, ty2); ctx.stroke();
    ctx.globalAlpha = 1;

    if(sub === 'herb'){
      /* 炼药师：一株带灵气的小草（光球缩小，草是主视觉） */
      const rr = pr.w * 0.72 * sc;
      const gg = ctx.createRadialGradient(px, py, 1, px, py, rr);
      gg.addColorStop(0, 'rgba(220,255,180,0.55)'); gg.addColorStop(0.55, glow); gg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(px, py, rr, 0, TAU); ctx.fill();
      ctx.save(); ctx.translate(px, py);
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#5cc63a'; ctx.lineWidth = 2.2;
      for(let b=-1;b<=1;b++){ ctx.beginPath(); ctx.moveTo(b*2.5, 6); ctx.quadraticCurveTo(b*6 + dir*3, -2, b*7 + dir*5, -12); ctx.stroke(); }
      ctx.strokeStyle = '#a6ff6e'; ctx.lineWidth = 1.0;
      for(let b=-1;b<=1;b++){ ctx.beginPath(); ctx.moveTo(b*2.5, 6); ctx.quadraticCurveTo(b*6 + dir*3, -2, b*7 + dir*5, -12); ctx.stroke(); }
      ctx.restore();
    } else if(sub === 'talisman'){
      /* ★ 符咒师：真正的黄符纸模型（缩小到与面前漂浮符纸相当），只留薄薄一层灵光 */
      ctx.globalCompositeOperation = 'source-over';
      const gg = ctx.createRadialGradient(px, py, 1, px, py, pr.w * 0.5 * sc);
      gg.addColorStop(0, 'rgba(255,242,168,0.38)'); gg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(px, py, pr.w * 0.5 * sc, 0, TAU); ctx.fill();
      ctx.save(); ctx.translate(px, py);
      ctx.rotate(pr.rot || (G ? G.t * 9 : 0));
      ctx.scale(0.9, 0.9);
      drawWeapon('talisman', 0, 0, 0);
      ctx.restore();
    } else if(sub === 'cauldron'){
      /* ★ 丹道师：本命鼎飞出去砸人（三足青铜鼎模型+炉火灵光），不再是光绘仙丹 */
      ctx.globalCompositeOperation = 'source-over';
      const fg = ctx.createRadialGradient(px, py, 1, px, py, pr.w * 0.7 * sc);
      fg.addColorStop(0, 'rgba(255,150,70,0.38)'); fg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = fg; ctx.beginPath(); ctx.arc(px, py, pr.w * 0.7 * sc, 0, TAU); ctx.fill();
      ctx.save(); ctx.translate(px, py);
      ctx.rotate(pr.rot || 0);
      ctx.scale(0.52, 0.52);
      drawWeapon('cauldron', 0, 0, 0);
      ctx.restore();
    } else {
      /* 兜底：绿弹 */
      const rr = pr.w * 0.9 * sc;
      const gg = ctx.createRadialGradient(px, py, 1, px, py, rr);
      gg.addColorStop(0, '#ffffff'); gg.addColorStop(0.35, glow); gg.addColorStop(0.7, col); gg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(px, py, rr, 0, TAU); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }
  /* ★ 长兵器怪的远程刺击 */
  if(pr.kind === 'enemyShot'){
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.translate(px,py); ctx.rotate(pr.rot || 0);
    const eg = ctx.createLinearGradient(-18*sc, 0, 18*sc, 0);
    eg.addColorStop(0, 'rgba(127,224,176,0)');
    eg.addColorStop(0.55, pr.color || '#7fe0b0');
    eg.addColorStop(1, '#dcfff2');
    ctx.strokeStyle = eg; ctx.lineWidth = Math.max(2, 4*sc); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-18*sc, 0); ctx.lineTo(16*sc, 0); ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(16*sc, 0, Math.max(1.5, 3*sc), 0, TAU); ctx.fill();
    ctx.restore();
  }
  /* ★ 妖狐的狐火 */
  if(pr.kind === 'foxfire'){
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const fr = 20 * sc;
    const fgr = ctx.createRadialGradient(px, py, 2, px, py, fr*2.2);
    fgr.addColorStop(0, '#ffffff');
    fgr.addColorStop(0.24, '#ffcc44');
    fgr.addColorStop(0.55, pr.color || '#ff6a00');
    fgr.addColorStop(1, 'rgba(255,60,0,0)');
    ctx.fillStyle = fgr;
    ctx.beginPath(); ctx.arc(px, py, fr*2.2, 0, TAU); ctx.fill();
    /* 尾焰 */
    const _fa = pr.rot || 0;
    for(let i=1;i<=3;i++){
      ctx.globalAlpha = Math.max(0, 0.34 - i*0.09);
      ctx.beginPath();
      ctx.arc(px - Math.cos(_fa)*i*9*sc, py - Math.sin(_fa)*i*5*sc, fr*(0.62 - i*0.13), 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }
  /* ★ 朱雀火羽 */
  if(pr.kind === 'feather'){
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.translate(px, py); ctx.rotate(pr.rot || 0);
    const pg2 = ctx.createLinearGradient(-20*sc, 0, 20*sc, 0);
    pg2.addColorStop(0, 'rgba(255,100,0,0)');
    pg2.addColorStop(0.6, '#ffaa22');
    pg2.addColorStop(1, '#fff3c0');
    ctx.fillStyle = pg2;
    ctx.beginPath();
    ctx.moveTo(-20*sc, 0);
    ctx.quadraticCurveTo(0, -7*sc, 20*sc, 0);
    ctx.quadraticCurveTo(0, 7*sc, -20*sc, 0);
    ctx.fill();
    ctx.restore();
  }
  if(pr.kind === 'flameWave'){
    ctx.globalCompositeOperation = 'lighter';
    const waveW = pr.w*sc, waveH = pr.hh*sc;
    const g = ctx.createRadialGradient(px,py,5,px,py,waveW);
    g.addColorStop(0,'#fff'); g.addColorStop(0.3,'#ffcc00'); g.addColorStop(0.6,'#ff6a20'); g.addColorStop(1,'rgba(255,50,0,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(px,py,waveW,waveH,0,0,TAU); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(px,py,waveW*0.3,waveH*0.3,0,0,TAU); ctx.fill();
  }
  if(pr.kind === 'fireOrb'){
    ctx.globalCompositeOperation = 'lighter';
    const orbCol = pr.color || '#ff6600';
    const lotusR = 24 * sc;
    const t = G.t || 0;
    const rotAngle = t * 6 + (pr.orbIndex || 0) * 1.2;
    /* 七色莲花花瓣 */
    const petalColors = ['#3366ff','#ff3300','#33cc33','#ffcc00','#cc33ff','#ff6600','#00ccff'];
    const petalCount = 7;
    for(let i=0;i<petalCount;i++){
      const pa = rotAngle + i*(TAU/petalCount);
      const petalLen = lotusR * (1.0 + 0.3*Math.sin(t*8+i*1.5));
      const tipX = px + Math.cos(pa)*petalLen*0.5;
      const tipY = py + Math.sin(pa)*petalLen*0.3;
      ctx.globalAlpha = 0.8;
      ctx.save();
      ctx.translate(tipX, tipY);
      ctx.rotate(pa);
      const pg = ctx.createRadialGradient(0,0,1,0,0,lotusR*0.55);
      pg.addColorStop(0,'#fff');
      pg.addColorStop(0.3, petalColors[i]);
      pg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = pg;
      ctx.beginPath();
      ctx.ellipse(0, 0, lotusR*0.55, lotusR*0.25, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
    /* 中心白光 */
    ctx.globalAlpha = 0.95;
    const cg = ctx.createRadialGradient(px,py,2,px,py,lotusR*0.45);
    cg.addColorStop(0,'#fff');
    cg.addColorStop(0.5, orbCol);
    cg.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle = cg;
    ctx.beginPath(); ctx.arc(px,py,lotusR*0.45,0,TAU); ctx.fill();
    /* 外层光晕 */
    ctx.globalAlpha = 0.35;
    const og = ctx.createRadialGradient(px,py,lotusR*0.2,px,py,lotusR*1.6);
    og.addColorStop(0, orbCol);
    og.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle = og;
    ctx.beginPath(); ctx.arc(px,py,lotusR*1.6,0,TAU); ctx.fill();
    ctx.globalAlpha = 1.0;
  }
  ctx.restore();
}

/* ============================================================
   角色本体光影（drawCharGhost）
   用真实职业精灵帧绘制半透明发光的「分身/法相」，替代丑陋的几何体。
   直接基于 CHAR_ATLASES 取帧 drawImage，自包含、不依赖外部 drawSpriteFrame。
   atKey: 职业键('fist'/'sword'/...)；anim: 动画名；frameT: 帧进度 0~1；
   x,y: 脚底世界坐标；facing: 1/-1；bodyWorld: 世界身高像素；
   tint: 染色(可为 null)；alpha: 总透明度。返回是否绘制成功。
   ============================================================ */
function drawCharGhost(atKey, anim, frameT, x, y, facing, bodyWorld, tint, alpha){
  const at = CHAR_ATLASES[atKey];
  const draw = at && charAtlasDrawable(at);
  if(!draw) return false;
  const anims = draw.anims || {};
  const frames = (anims[anim] && anims[anim].frames) || [0];
  let fi = frames[Math.floor((frameT || 0) * (frames.length - 1) + 0.5)];
  if(fi == null || fi < 0) fi = frames[0] || 0;
  const cols = draw.cols, rows = draw.rows, cw = draw.cellW, ch = draw.cellH;
  const sx = (fi % cols) * cw;
  const sy = Math.floor(fi / cols) * ch;
  const sc = (bodyWorld || draw.bodyWorld) / draw.bodyH;
  const dw = cw * sc, dh = ch * sc;
  const dx = x - draw.feetX * sc;
  const dy = y - draw.groundY * sc;
  ctx.save();
  ctx.globalAlpha = clamp(alpha, 0, 1);
  if(facing < 0){ ctx.translate(x, 0); ctx.scale(-1, 1); ctx.translate(-x, 0); }
  if(tint){
    ctx.globalCompositeOperation = 'lighter';
    ctx.shadowColor = tint; ctx.shadowBlur = _fxBlur(24);
  }
  ctx.drawImage(draw.img, sx, sy, cw, ch, dx, dy, dw, dh);
  ctx.shadowBlur = 0;
  ctx.restore();
  return true;
}

/* ★ 阴影模糊按画质缩放：低画质时统一压到 35%，大幅省下每帧的高斯模糊开销 */
function _fxBlur(v){
  const s = (window.PFX && window.PFX.shadow !== undefined) ? window.PFX.shadow : 1;
  return v * s;
}
function drawEffects(dt){
  /* ★ 屏外特效直接跳过绘制：大地图里技能常在视野外空转，
     以前照样每帧画带 shadowBlur 的大特效，白烧一大半性能 */
  const _camX = (G && G.camera) ? G.camera.x : 0;
  const _cullL = _camX - 460, _cullR = _camX + VW + 460;
  for(const ef of G.effects){
    if(ef.x < _cullL || ef.x > _cullR) continue;
    const k = ef.t/ef.dur;
    const sc = depthScale(ef.y);
    ctx.save();
    if(ef.type === 'slashArc'){
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = (1-k)*0.9;
      ctx.translate(ef.x+ef.facing*60, ef.y-65*sc);
      ctx.scale(ef.facing*(ef.size||1), (ef.size||1));
      if(ef.typeStr === 'blade'){
        ctx.rotate(-0.8+k*1.6);
        ctx.strokeStyle = ef.color; ctx.lineWidth = 20*(1-k*0.5);
        ctx.beginPath(); ctx.arc(0,0,75,-1.4,1.4); ctx.stroke();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 6*(1-k*0.5);
        ctx.beginPath(); ctx.arc(0,0,75,-1.4,1.4); ctx.stroke();
      } else {
        ctx.rotate(-0.6+k*1.4);
        ctx.strokeStyle = ef.color; ctx.lineWidth = 15*(1-k*0.5); ctx.lineCap = 'round';
        ctx.beginPath(); ctx.arc(0,0,70,-1.2,1.2); ctx.stroke();
      }
    }
    else if(ef.type === 'vine'){
      /* 藤蔓：从地面向上生长，带叶片 */
      ctx.globalCompositeOperation = 'lighter';
      const grow = Math.min(1, k * 4.2);
      const vh = (ef.h || 140) * grow;
      const vn = ef.n || 3;
      ctx.lineCap = 'round';
      for(let v = 0; v < vn; v++){
        const bx = ef.x + (v - (vn - 1) / 2) * 18;
        ctx.globalAlpha = (1 - k) * 0.9;
        ctx.strokeStyle = ef.color || '#7ed957';
        ctx.lineWidth = Math.max(1.5, (1 - k) * 10);
        ctx.beginPath(); ctx.moveTo(bx, ef.y);
        for(let i = 1; i <= 7; i++){
          const yy = ef.y - vh * (i / 7);
          const xx = bx + Math.sin(i * 1.25 + k * 5 + v * 1.9) * 15 * (i / 7);
          ctx.lineTo(xx, yy);
        }
        ctx.stroke();
        ctx.fillStyle = ef.color2 || '#b6ff8a';
        for(let i = 2; i <= 5; i++){
          const yy = ef.y - vh * (i / 6);
          const xx = bx + Math.sin(i * 1.25 + k * 5 + v * 1.9) * 15 * (i / 6);
          ctx.beginPath();
          ctx.ellipse(xx + (i % 2 ? 9 : -9), yy, 10 * (1 - k * 0.35), 4.2, i % 2 ? -0.6 : 0.6, 0, TAU);
          ctx.fill();
        }
      }
    }
    else if(ef.type === 'talisman'){
      /* 符纸：黄纸红字，带旋转飘落 */
      const n = ef.n || 1;
      for(let i = 0; i < n; i++){
        const ang = (ef.rot || 0) + i * 2.1 + k * 6;
        const rad = (ef.r || 30) * (1 - k * 0.3);
        const tx = ef.x + Math.cos(ang) * rad;
        const ty = ef.y - 40 + Math.sin(ang) * rad * 0.6 - (ef.rise || 0) * k;
        ctx.save();
        ctx.translate(tx, ty);
        ctx.rotate(Math.sin(k * 6 + i) * 0.5);
        ctx.globalAlpha = (1 - k) * 0.95;
        ctx.fillStyle = ef.color || '#ffe066';
        ctx.fillRect(-7, -13, 14, 26);
        ctx.strokeStyle = '#c0392b';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(0, -8); ctx.lineTo(0, 8);
        ctx.moveTo(-3.5, -4); ctx.lineTo(3.5, -4);
        ctx.moveTo(-3.5, 1); ctx.lineTo(3.5, 1);
        ctx.moveTo(-3, 5.5); ctx.lineTo(3, 5.5);
        ctx.stroke();
        ctx.restore();
      }
    }
    else if(ef.type === 'cauldron'){
      /* 巨鼎：青铜三足，内部丹火 */
      const s = (ef.scale || 1) * (0.6 + k * 0.55);
      ctx.save();
      ctx.translate(ef.x, ef.y - 40 * s);
      ctx.scale(s, s);
      ctx.globalAlpha = (1 - k * 0.8) * 0.95;
      const cg = ctx.createLinearGradient(0, -40, 0, 50);
      cg.addColorStop(0, '#8a6a3a'); cg.addColorStop(0.5, '#5a4222'); cg.addColorStop(1, '#2e2010');
      ctx.fillStyle = cg;
      ctx.beginPath();
      ctx.moveTo(-46, -26);
      ctx.lineTo(46, -26);
      ctx.quadraticCurveTo(40, 30, 22, 44);
      ctx.lineTo(-22, 44);
      ctx.quadraticCurveTo(-40, 30, -46, -26);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#d8b050'; ctx.lineWidth = 3; ctx.stroke();
      /* 鼎口 */
      ctx.fillStyle = '#3a2a12';
      ctx.beginPath(); ctx.ellipse(0, -26, 47, 10, 0, 0, TAU); ctx.fill();
      /* 三足 */
      ctx.fillStyle = '#3a2a12';
      ctx.fillRect(-28, 42, 8, 16); ctx.fillRect(20, 42, 8, 16); ctx.fillRect(-4, 42, 8, 18);
      /* 内部丹火 */
      ctx.globalCompositeOperation = 'lighter';
      const fg = ctx.createRadialGradient(0, -10, 2, 0, -10, 42);
      fg.addColorStop(0, '#fff6c8'); fg.addColorStop(0.4, ef.color || '#ff7a4a'); fg.addColorStop(1, 'rgba(255,60,0,0)');
      ctx.fillStyle = fg;
      ctx.beginPath(); ctx.arc(0, -14, 36, 0, TAU); ctx.fill();
      ctx.restore();
    }
    else if(ef.type === 'axeWave'){
      /* 斧气：半月形冲击波，朝 facing 方向扩散 */
      ctx.save();
      ctx.translate(ef.x, ef.y - 60 * sc);
      ctx.scale(ef.facing || 1, 1);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = (1 - k) * 0.9;
      const rr = (ef.r || 120) * (0.35 + k);
      ctx.strokeStyle = ef.color || '#ffb04a';
      ctx.lineWidth = 28 * (1 - k * 0.6);
      ctx.beginPath(); ctx.arc(0, 0, rr, -1.15, 1.15); ctx.stroke();
      ctx.strokeStyle = '#fff2d0';
      ctx.lineWidth = 9 * (1 - k * 0.6);
      ctx.beginPath(); ctx.arc(0, 0, rr, -1.0, 1.0); ctx.stroke();
      ctx.restore();
    }
    else if(ef.type === 'poisonCloud'){
      /* 毒雾：多层绿色半透明云团，缓慢上升扩散 */
      ctx.globalCompositeOperation = 'lighter';
      const pc = ef.color || '#7ed957';
      for(let i = 0; i < 7; i++){
        const a = i / 7 * TAU + k * 1.2;
        const rad = (ef.r || 70) * (0.25 + k * 0.85) * (0.6 + (i % 3) * 0.22);
        const cx0 = ef.x + Math.cos(a) * rad * 0.7;
        const cy0 = ef.y - 34 - k * 46 + Math.sin(a) * rad * 0.42;
        const g = ctx.createRadialGradient(cx0, cy0, 1, cx0, cy0, rad * 0.72);
        g.addColorStop(0, hexA(pc, 0.42 * (1 - k)));
        g.addColorStop(0.55, hexA(pc, 0.20 * (1 - k)));
        g.addColorStop(1, hexA(pc, 0));
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(cx0, cy0, rad * 0.72, 0, TAU); ctx.fill();
      }
    }
    /* ★ 新增：地面窜出的岩石尖刺（撼山者 / 山石系通用） */
    else if(ef.type === 'rockSpike'){
      const n = ef.n || 5;
      const dir = ef.facing || 1;
      const reach = ef.reach || 220;
      for(let i = 0; i < n; i++){
        /* 沿 facing 方向依次窜出，形成推进的裂地波 */
        const t0 = clamp(k * (n + 2) - i * 0.9, 0, 1);
        if(t0 <= 0) continue;
        const grow = t0 < 0.35 ? (t0 / 0.35) : 1;
        const fallK = t0 > 0.72 ? (t0 - 0.72) / 0.28 : 0;
        const hgt = (ef.h || 76) * (0.55 + (i % 3) * 0.22) * grow * (1 - fallK * 0.55);
        const sx = ef.x + dir * (reach / n) * i;
        const sw = (ef.w || 22) * (0.7 + (i % 2) * 0.4);
        ctx.save();
        ctx.globalAlpha = 1 - fallK * 0.9;
        /* 石刺主体 */
        ctx.beginPath();
        ctx.moveTo(sx - sw, ef.y + 4);
        ctx.lineTo(sx - sw * 0.28, ef.y - hgt);
        ctx.lineTo(sx + sw * 0.10, ef.y - hgt * 1.12);
        ctx.lineTo(sx + sw * 0.95, ef.y - hgt * 0.42);
        ctx.lineTo(sx + sw, ef.y + 4);
        ctx.closePath();
        const rg = ctx.createLinearGradient(sx - sw, ef.y - hgt, sx + sw, ef.y);
        rg.addColorStop(0, ef.color || '#c9a06a');
        rg.addColorStop(0.5, '#6a5030');
        rg.addColorStop(1, '#2e2418');
        ctx.fillStyle = rg; ctx.fill();
        ctx.strokeStyle = hexA(ef.color || '#ffb04a', 0.75); ctx.lineWidth = 2; ctx.stroke();
        /* 顶端碎裂高光 */
        if(grow > 0.9 && fallK < 0.3){
          ctx.globalCompositeOperation = 'lighter';
          ctx.fillStyle = hexA(ef.color || '#ffb04a', 0.5 * (1 - fallK));
          ctx.beginPath();
          ctx.moveTo(sx - sw * 0.28, ef.y - hgt);
          ctx.lineTo(sx + sw * 0.10, ef.y - hgt * 1.12);
          ctx.lineTo(sx + sw * 0.5, ef.y - hgt * 0.62);
          ctx.closePath(); ctx.fill();
        }
        ctx.restore();
      }
    }
    /* ★ 新增：贴地推进的冲击波（尘环 + 碎裂纹） */
    else if(ef.type === 'shockWave'){
      const dir = ef.facing || 1;
      const reach = (ef.r || 240) * (0.15 + k * 0.95);
      ctx.save();
      ctx.translate(ef.x, ef.y + 2);
      ctx.scale(dir, 1);
      /* 尘浪 */
      for(let i = 0; i < 3; i++){
        const rr = reach * (1 - i * 0.16);
        ctx.globalAlpha = (1 - k) * (0.55 - i * 0.13);
        ctx.fillStyle = ef.color || '#ffb04a';
        ctx.beginPath();
        ctx.ellipse(0, 0, rr, rr * 0.30, 0, Math.PI * 0.06, Math.PI * 1.94);
        ctx.fill();
      }
      /* 前缘亮线 */
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = (1 - k) * 0.85;
      ctx.strokeStyle = '#fff2d0';
      ctx.lineWidth = 4 * (1 - k * 0.5) + 1;
      ctx.beginPath();
      ctx.ellipse(0, 0, reach, reach * 0.30, 0, Math.PI * 0.1, Math.PI * 1.9);
      ctx.stroke();
      ctx.restore();
    }
    /* ★ 新增：火星爆裂（带火花拖尾的放射爆点，通用"炸裂"底子） */
    else if(ef.type === 'emberBurst'){
      const n = ef.n || 16;
      const rr = (ef.r || 120) * (0.2 + k * 1.05);
      ctx.save();
      ctx.translate(ef.x, ef.y);
      ctx.globalCompositeOperation = 'lighter';
      for(let i = 0; i < n; i++){
        const a = (i / n) * TAU + (ef.rot || 0);
        const wob = Math.sin(k * 9 + i * 1.7) * 0.16;
        const r1 = rr * (0.55 + (i % 4) * 0.16);
        const r0 = r1 * 0.28;
        const px = Math.cos(a + wob) * r1, py = Math.sin(a + wob) * r1 * 0.62;
        const qx = Math.cos(a + wob) * r0, qy = Math.sin(a + wob) * r0 * 0.62;
        const g = ctx.createLinearGradient(qx, qy, px, py);
        g.addColorStop(0, hexA('#ffffff', 0.9 * (1 - k)));
        g.addColorStop(0.35, hexA(ef.color || '#ffb04a', 0.85 * (1 - k)));
        g.addColorStop(1, hexA(ef.color || '#ffb04a', 0));
        ctx.strokeStyle = g;
        ctx.lineWidth = 5 * (1 - k * 0.6) + 1;
        ctx.beginPath(); ctx.moveTo(qx, qy); ctx.lineTo(px, py); ctx.stroke();
      }
      /* 中心闪光 */
      ctx.globalAlpha = (1 - k) * (1 - k);
      const cg = ctx.createRadialGradient(0, 0, 1, 0, 0, rr * 0.55);
      cg.addColorStop(0, hexA('#ffffff', 0.95));
      cg.addColorStop(0.4, hexA(ef.color || '#ffb04a', 0.6));
      cg.addColorStop(1, hexA(ef.color || '#ffb04a', 0));
      ctx.fillStyle = cg;
      ctx.beginPath(); ctx.arc(0, 0, rr * 0.55, 0, TAU); ctx.fill();
      ctx.restore();
    }
    /* ★ 新增：毒蛛群 —— 自地底爬出成群毒蛛，扑向目标（炼药师·千蛛万毒手） */
    else if(ef.type === 'spiderSwarm'){
      const n = ef.n || 6;
      const dir = ef.facing || 1;
      const reach = ef.reach || 260;
      for(let i = 0; i < n; i++){
        const t0 = clamp(k * (n + 2) - i * 0.8, 0, 1);
        if(t0 <= 0) continue;
        const sx = ef.x + dir * (reach / n) * i + Math.sin(i * 2.1) * 18;
        const sy = ef.y - 8 - Math.abs(Math.sin(t0 * Math.PI * 3)) * 16;
        const sz = (ef.size || 16) * (0.6 + (i % 3) * 0.22) * t0;
        ctx.save();
        ctx.globalAlpha = (1 - k) * 0.9 * t0;
        ctx.translate(sx, sy);
        ctx.strokeStyle = ef.color || '#b388ff';
        ctx.lineWidth = 2.4; ctx.lineCap = 'round';
        /* 八条腿 */
        for(let f = 0; f < 8; f++){
          const a = -Math.PI * 0.85 + f * (Math.PI * 0.7 / 7);
          const knee = sz * 0.75;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos(a) * knee, Math.sin(a) * knee * 0.5);
          ctx.lineTo(Math.cos(a) * sz * 1.5, Math.sin(a) * sz * 1.5 * 0.5 + sz * 0.55);
          ctx.stroke();
        }
        /* 发光的毒体 */
        ctx.globalCompositeOperation = 'lighter';
        const bg = ctx.createRadialGradient(0, 0, 1, 0, 0, sz * 1.3);
        bg.addColorStop(0, '#fff'); bg.addColorStop(0.35, ef.color2 || '#7ed957'); bg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = bg;
        ctx.beginPath(); ctx.ellipse(0, 0, sz * 0.95, sz * 0.78, 0, 0, TAU); ctx.fill();
        ctx.restore();
      }
    }
    /* ★ 新增：火龙柱 —— 火焰长龙绕柱盘旋升腾（丹道师·九龙神火罩） */
    else if(ef.type === 'flameDragon'){
      const segs = ef.n || 22;
      const H = ef.h || 460;
      const R = ef.r || 70;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const phase = ef.t * (ef.speed || 3.2) + (ef.rot || 0);
      for(let i = 0; i < segs; i++){
        const f = i / segs;
        const grow = clamp(k * 2.4 - f * 0.9, 0, 1);
        if(grow <= 0) continue;
        const a = phase + f * TAU * (ef.turns || 2.4);
        const rr = R * (0.45 + f * 0.75);
        const dx = ef.x + Math.cos(a) * rr;
        const dy = ef.y - H * f * grow;
        const sz = (ef.size || 26) * (1.25 - f * 0.7) * grow;
        const al = (1 - k) * (0.9 - f * 0.5);
        ctx.globalAlpha = al;
        const g = ctx.createRadialGradient(dx, dy, 1, dx, dy, sz);
        g.addColorStop(0, '#fff6c8');
        g.addColorStop(0.35, ef.color || '#ff5a2a');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(dx, dy, sz, 0, TAU); ctx.fill();
        /* 龙须 */
        if(i % 3 === 0){
          ctx.globalAlpha = al * 0.6;
          ctx.strokeStyle = ef.color2 || '#ffd166'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(dx, dy);
          ctx.lineTo(dx + Math.cos(a + 1.6) * sz * 1.8, dy + Math.sin(a + 1.6) * sz * 1.2);
          ctx.stroke();
        }
      }
      ctx.restore();
    }
    /* ★ 新增：陨石坠落 —— 燃烧巨石自天砸下（撼山者·力劈华山 / 盘古开天） */
    else if(ef.type === 'meteorFall'){
      const n = ef.n || 5;
      for(let i = 0; i < n; i++){
        const t0 = clamp(k * (n + 1.5) - i * 0.85, 0, 1);
        if(t0 <= 0) continue;
        const mx = ef.x + (i - (n - 1) / 2) * (ef.gap || 92);
        const fall = t0 * t0;
        const my = ef.y - (ef.from || 620) * (1 - fall);
        const sz = (ef.size || 30) * (0.6 + (i % 3) * 0.25);
        ctx.save();
        /* 拖尾 */
        ctx.globalCompositeOperation = 'lighter';
        const tg = ctx.createLinearGradient(mx, my - 190, mx, my);
        tg.addColorStop(0, 'rgba(255,180,80,0)');
        tg.addColorStop(1, hexA(ef.color || '#ffb04a', 0.75));
        ctx.fillStyle = tg;
        ctx.beginPath();
        ctx.moveTo(mx - sz * 0.7, my - 190);
        ctx.lineTo(mx + sz * 0.7, my - 190);
        ctx.lineTo(mx + sz * 0.16, my);
        ctx.lineTo(mx - sz * 0.16, my);
        ctx.closePath(); ctx.fill();
        /* 石体 */
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1 - k * 0.2;
        ctx.fillStyle = '#4a3524';
        ctx.beginPath();
        ctx.moveTo(mx - sz, my - sz * 0.35);
        ctx.lineTo(mx - sz * 0.55, my - sz);
        ctx.lineTo(mx + sz * 0.5, my - sz * 0.8);
        ctx.lineTo(mx + sz, my - sz * 0.2);
        ctx.lineTo(mx + sz * 0.45, my + sz * 0.7);
        ctx.lineTo(mx - sz * 0.6, my + sz * 0.55);
        ctx.closePath(); ctx.fill();
        /* 燃烧边缘 */
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.85;
        ctx.strokeStyle = ef.color2 || '#ffd08a'; ctx.lineWidth = 3;
        ctx.stroke();
        ctx.restore();
      }
    }
    /* ★ 新增：符阵 —— 地面旋转的双层符文圆环（符咒师专属） */
    else if(ef.type === 'runeCircle'){
      ctx.save();
      ctx.translate(ef.x, ef.y + 2);
      ctx.globalCompositeOperation = 'lighter';
      const R = (ef.r || 200) * (0.55 + k * 0.45);
      const rot = ef.t * (ef.speed || 1.8) + (ef.rot || 0);
      ctx.globalAlpha = (1 - k * 0.75) * 0.9;
      ctx.strokeStyle = ef.color || '#ffe066';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(0, 0, R, R * 0.34, 0, 0, TAU); ctx.stroke();
      ctx.lineWidth = 2; ctx.globalAlpha *= 0.7;
      ctx.beginPath(); ctx.ellipse(0, 0, R * 0.78, R * 0.26, 0, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(0, 0, R * 0.42, R * 0.14, 0, 0, TAU); ctx.stroke();
      /* 辐条符文 */
      const spokes = ef.n || 8;
      for(let i = 0; i < spokes; i++){
        const a = rot + i / spokes * TAU;
        const cxp = Math.cos(a) * R, cyp = Math.sin(a) * R * 0.34;
        ctx.globalAlpha = (1 - k * 0.6) * 0.85;
        ctx.fillStyle = ef.color2 || '#fff6b0';
        const gs = 7 + Math.sin(ef.t * 5 + i) * 2;
        ctx.beginPath(); ctx.ellipse(cxp, cyp, gs, gs * 0.55, a, 0, TAU); ctx.fill();
        ctx.globalAlpha *= 0.55;
        ctx.strokeStyle = ef.color || '#ffe066'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(cxp * 0.45, cyp * 0.45); ctx.lineTo(cxp * 0.95, cyp * 0.95); ctx.stroke();
      }
      ctx.restore();
    }
    /* ★ 新增：丹丸环绕 —— 数枚发光丹丸沿椭圆轨道环绕（丹道师金丹 / 炼药师毒丹） */
    else if(ef.type === 'pillOrbit'){
      const n = ef.n || 7;
      const R = (ef.r || 110) * (0.5 + k * 0.5);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const rot = ef.t * (ef.speed || 2.6);
      for(let i = 0; i < n; i++){
        const a = rot + i / n * TAU;
        const px = ef.x + Math.cos(a) * R;
        const py = ef.y - (ef.h || 70) + Math.sin(a) * R * 0.42;
        const sz = (ef.size || 13) * (0.8 + 0.2 * Math.sin(ef.t * 6 + i));
        ctx.globalAlpha = (1 - k) * 0.35;
        ctx.strokeStyle = ef.color2 || '#fff6c8'; ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(ef.x + Math.cos(a - 0.4) * R, ef.y - (ef.h || 70) + Math.sin(a - 0.4) * R * 0.42);
        ctx.stroke();
        ctx.globalAlpha = (1 - k) * 0.95;
        const g = ctx.createRadialGradient(px, py, 1, px, py, sz * 1.6);
        g.addColorStop(0, '#fff'); g.addColorStop(0.4, ef.color || '#ffd166'); g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(px, py, sz * 1.6, 0, TAU); ctx.fill();
      }
      ctx.restore();
    }
    else if(ef.type === 'ghostHand'){
      /* 鬼手：自地底伸出的灰白爪，依次冒出 */
      const n = ef.n || 5;
      for(let i = 0; i < n; i++){
        const t0 = clamp(k * n - i, 0, 1);
        if(t0 <= 0) continue;
        const hx = ef.x + (i - (n - 1) / 2) * (ef.gap || 52);
        const rise = 70 * t0;
        ctx.save();
        ctx.translate(hx, ef.y);
        ctx.globalAlpha = (1 - k) * 0.85 * t0;
        ctx.strokeStyle = ef.color || '#cdd8e8';
        ctx.lineWidth = 7;
        ctx.lineCap = 'round';
        /* 手臂 */
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(6, -rise * 0.55, 0, -rise);
        ctx.stroke();
        /* 五指 */
        ctx.lineWidth = 4;
        for(let f = -2; f <= 2; f++){
          ctx.beginPath();
          ctx.moveTo(0, -rise);
          ctx.quadraticCurveTo(f * 7, -rise - 14, f * 9, -rise - 22);
          ctx.stroke();
        }
        ctx.restore();
      }
    }
    else if(ef.type === 'hitRing'){
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = (1-k)*0.5;
      ctx.strokeStyle = ef.color; ctx.lineWidth = Math.max(1.5, 5*(1-k));
      ctx.beginPath(); ctx.ellipse(ef.x, ef.y, ef.r*(0.5+k), ef.r*0.4*(0.5+k), 0, 0, TAU); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    else if(ef.type === 'explosion'){
      ctx.globalCompositeOperation = 'source-over';
      /* 爆炸冲击：原来每帧两个径向渐变 + 加法发光 + 纯白内核，一屏十几个就爆白且疯狂掉帧。
         现在改成单层渐变 + 细冲击环，视觉是「气浪炸开」，不再是一片白光。 */
      const r = ef.r*(0.15+k*0.95);
      const g = ctx.createRadialGradient(ef.x,ef.y-30*sc, r*0.12, ef.x,ef.y-30*sc, r*0.8);
      g.addColorStop(0, ef.color);
      g.addColorStop(0.62, ef.color);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = (1-k*0.8)*0.5;
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(ef.x,ef.y-30*sc,r*0.8,0,TAU); ctx.fill();
      ctx.globalAlpha = (1-k)*0.4;
      ctx.strokeStyle = ef.color; ctx.lineWidth = Math.max(2, 6*(1-k));
      ctx.beginPath(); ctx.arc(ef.x,ef.y-30*sc,r*0.85,0,TAU); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    else if(ef.type === 'lotusBurst'){
      /* 七彩莲花绽放效果 */
      ctx.globalCompositeOperation = 'lighter';
      const colors = ef.colors || ['#3366ff','#ff3300','#33cc33','#ffcc00','#cc33ff','#ff6600','#00ccff'];
      const petalCount = 7;
      const baseR = ef.r * (0.3 + k * 0.7);
      const rotAngle = ef.t * (ef.rotateSpeed || 8);
      
      /* 绘制七色莲花花瓣 */
      for(let i=0;i<petalCount;i++){
        const pa = rotAngle + i*(TAU/petalCount);
        const petalLen = baseR * (0.8 + 0.2*Math.sin(ef.t*6+i*1.2));
        const petalW = baseR * 0.35;
        const tipX = ef.x + Math.cos(pa)*petalLen*0.4;
        const tipY = ef.y + Math.sin(pa)*petalLen*0.25;
        
        ctx.globalAlpha = (1-k*0.5)*0.75;
        ctx.save();
        ctx.translate(tipX, tipY);
        ctx.rotate(pa);
        
        const pg = ctx.createRadialGradient(0,0,1,0,0,petalLen*0.5);
        pg.addColorStop(0,'#fff');
        pg.addColorStop(0.3, colors[i%colors.length]);
        pg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = pg;
        ctx.beginPath();
        ctx.ellipse(0, 0, petalLen*0.5, petalW, 0, 0, TAU);
        ctx.fill();
        ctx.restore();
      }
      
      /* 中心光晕 */
      ctx.globalAlpha = (1-k)*0.6;
      const cg = ctx.createRadialGradient(ef.x,ef.y,2,ef.x,ef.y,baseR*0.35);
      cg.addColorStop(0,'#fff');
      cg.addColorStop(0.6, colors[0]);
      cg.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle = cg;
      ctx.beginPath(); ctx.arc(ef.x,ef.y,baseR*0.35,0,TAU); ctx.fill();
    }
    else if(ef.type === 'bladeArray'){
      ctx.globalAlpha = 0.6*(1-k*0.5);
      ctx.strokeStyle = '#ff8a4a'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.ellipse(ef.x, ef.y, 100, 45, 0, 0, TAU); ctx.stroke();
    }
    else if(ef.type === 'levelup'){
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = (1-k)*0.8;
      ctx.strokeStyle = '#ffe066'; ctx.lineWidth = 8*(1-k);
      ctx.beginPath(); ctx.ellipse(ef.x, ef.y, 50+k*200, 20+k*80, 0, 0, TAU); ctx.stroke();
    }
    else if(ef.type === 'stormAura'){
      ctx.globalCompositeOperation = 'lighter';
      ctx.translate(ef.x, ef.y); ctx.scale(1, 0.6);
      for(let i=0;i<12;i++){
        const a = ef.t*15+i*(TAU/12), r = 90+Math.sin(ef.t*20+i)*20;
        ctx.save(); ctx.translate(Math.cos(a)*r, Math.sin(a)*r); ctx.rotate(a);
        ctx.fillStyle = '#ff8a4a'; ctx.beginPath(); ctx.moveTo(-5,0); ctx.lineTo(5,0); ctx.lineTo(0,-50); ctx.closePath(); ctx.fill();
        ctx.restore();
      }
    }
    else if(ef.type === 'bladeOrbit'){
      ctx.globalCompositeOperation = 'lighter';
      const boCol = ef.color || '#ff8a4a';
      const boS = ef.scale || 1.0;
      for(let i=0;i<ef.blades.length;i++){
        const b = ef.blades[i];
        const a = ef.t*12+b.angle;
        const rx = ef.x+Math.cos(a)*b.rad, ry = ef.y-60+Math.sin(a)*b.rad*0.5;
        /* 剑阵地面光环 */
        ctx.globalAlpha = 0.35;
        ctx.strokeStyle = boCol; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(rx, ef.y, 46*boS, 16*boS, 0, 0, TAU); ctx.stroke();
        /* 环上的剑本体 */
        ctx.globalAlpha = 1;
        ctx.save();
        ctx.translate(rx, ry); ctx.rotate(a + Math.PI/2);
        ctx.shadowColor = boCol; ctx.shadowBlur = _fxBlur(26);
        ctx.scale(boS*1.5, boS*1.5);
        drawWeapon(ef.weaponType || 'sword', 0, 0, 0);
        ctx.restore();
        /* 剑尖拖尾光点 */
        ctx.globalAlpha = 0.75;
        const g2 = ctx.createRadialGradient(rx, ry, 1, rx, ry, 26*boS);
        g2.addColorStop(0, '#ffffff'); g2.addColorStop(0.4, boCol); g2.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g2;
        ctx.beginPath(); ctx.arc(rx, ry, 26*boS, 0, TAU); ctx.fill();
      }
      ctx.shadowBlur = 0;
    }
    else if(ef.type === 'swordArray'){
      const efOwner = ef.owner || G.player;
      const efAtk = ef.ownerAtk || getAtk(efOwner);
      ef.timer += dt;
      for(let i=0;i<ef.swords.length;i++){
        const sw = ef.swords[i];
        if(sw.state === 'orbit'){
          sw.angle += dt*5;
          sw.x = ef.cx+Math.cos(sw.angle)*sw.rad;
          sw.y = ef.cy+sw.yOffset+Math.sin(sw.angle)*sw.rad*0.4;
          sw.rot = Math.PI/2;
          if(ef.timer > sw.delay){
            sw.state = 'dive';
            const alive = G.enemies.filter(e=>e.alive);
            if(efOwner.isPlayer){
              if(G.isPvp){
                const o = efOwner===G.player?G.player2:G.player;
                if(o && !o.dead) sw.target = {x:o.x+rand(-30,30), y:o.y+rand(-10,10)};
                else sw.target = {x:efOwner.x+rand(-200,200), y:rand(GY_TOP+50,GY_BOTTOM)};
              } else if(alive.length){
                /* ★ 集中攻击：敌人少时所有剑集中打同一个，确保伤害打满 */
                if(alive.length <= 3){
                  /* 找离剑最近的敌人作为集火目标 */
                  let bestE = alive[0], bestD = Infinity;
                  for(const e of alive){
                    const d = (e.x-sw.x)*(e.x-sw.x)+(e.y-sw.y)*(e.y-sw.y);
                    if(d < bestD){ bestD = d; bestE = e; }
                  }
                  sw.target = {x:bestE.x+rand(-15,15), y:bestE.y+rand(-8,8)};
                  sw.focusTarget = bestE; /* 标记集火目标，追踪时锁定 */
                } else {
                  sw.target = alive[(Math.random()*alive.length)|0];
                }
              }
              else sw.target = {x:efOwner.x+rand(-200,200), y:rand(GY_TOP+50,GY_BOTTOM)};
            } else {
              sw.target = {x:G.player.x+rand(-30,30), y:G.player.y+rand(-10,10)};
            }
            sw.startX = sw.target.x+(Math.random()-0.5)*200;
            sw.startY = sw.target.y-500-Math.random()*200;
            sw.x = sw.startX; sw.y = sw.startY; sw.diveT = 0;
          }
        } else if(sw.state === 'dive'){
          sw.diveT += dt*4.0;
          const kk = clamp(sw.diveT, 0, 1);
          /* ★ 智能追踪：俯冲阶段动态追踪最近敌人 */
          if(efOwner.isPlayer && kk < 0.9){
            /* ★ 集火模式：如果有focusTarget且还活着，锁定追踪 */
            if(sw.focusTarget && sw.focusTarget.alive){
              sw.target.x = lerp(sw.target.x, sw.focusTarget.x, dt*8);
              sw.target.y = lerp(sw.target.y, sw.focusTarget.y, dt*8);
            } else {
              let bestDist = Infinity, bestTarget = null;
              for(const e of G.enemies){
                if(!e.alive || sw.hitSet.has(e)) continue;
                const d = (e.x-sw.x)*(e.x-sw.x) + (e.y-sw.y)*(e.y-sw.y);
                if(d < bestDist){ bestDist = d; bestTarget = e; }
              }
              if(G.isPvp){
                const o = efOwner===G.player?G.player2:G.player;
                if(o && !o.dead){
                  const d = (o.x-sw.x)*(o.x-sw.x) + (o.y-sw.y)*(o.y-sw.y);
                  if(d < bestDist){ bestTarget = o; }
                }
              }
              if(bestTarget){
                sw.target.x = lerp(sw.target.x, bestTarget.x, dt*5);
                sw.target.y = lerp(sw.target.y, bestTarget.y, dt*5);
              }
            }
          } else if(!efOwner.isPlayer && kk < 0.9){
            const t = G.player;
            if(t && !t.dead){
              sw.target.x = lerp(sw.target.x, t.x, dt*5);
              sw.target.y = lerp(sw.target.y, t.y, dt*5);
            }
          }
          const tx = sw.target.x+rand(-5,5), ty = sw.target.y-30;
          const ek = kk*kk*kk;
          sw.x = lerp(sw.startX, tx, ek); sw.y = lerp(sw.startY, ty, ek);
          const fdx = sw.x-(sw.prevX||sw.x), fdy = sw.y-(sw.prevY||sw.y);
          if(Math.abs(fdx)>0.1||Math.abs(fdy)>0.1) sw.rot = Math.atan2(fdy,fdx);
          sw.prevX = sw.x; sw.prevY = sw.y;
          if(efOwner.isPlayer){
            const diveDmg = G.isPvp ? efAtk*10.0 : (72 + efAtk * 1.6);
            for(const e of G.enemies){
              if(!e.alive || sw.hitSet.has(e)) continue;
              const edx = e.x-sw.x, edy = (e.y-sw.y)*2.2;
              if(edx*edx+edy*edy < 70*70){
                damageEnemy(e, diveDmg, efOwner, {kb:120});
                sw.hitSet.add(e);
              }
            }
            /* ★ 修复：PvP模式下剑也要能击中对手 */
            if(G.isPvp){
              const t = efOwner===G.player?G.player2:G.player;
              if(t && !t.dead && t.invuln<=0 && !sw.hitSet.has(t)){
                const edx = t.x-sw.x, edy = (t.y-sw.y)*2.2;
                if(edx*edx+edy*edy < 70*70){
                  damagePvpPlayer(t, diveDmg, efOwner, {kb:120});
                  sw.hitSet.add(t);
                }
              }
            }
          } else {
            const t = G.player;
            if(t && !t.dead && t.invuln<=0 && !sw.hitSet.has(t)){
              const edx = t.x-sw.x, edy = (t.y-sw.y)*2.2;
              if(edx*edx+edy*edy < 70*70){
                damagePlayer(efAtk*2.0);
                sw.hitSet.add(t);
              }
            }
          }
          if(kk >= 1){
            sw.state = 'landed'; sw.landedT = 0; sw.rot = Math.PI/2; sw.x = tx; sw.y = ty;
            const landDmg = G.isPvp ? efAtk*5.0 : (36 + efAtk * 1.0);
            meleeAoe(efOwner, tx, ty, 90, landDmg, {kb:150});
          }
        } else if(sw.state === 'landed'){ sw.landedT += dt; }
      }
      for(const sw of ef.swords){
        if(sw.state === 'landed' && sw.landedT > 0.6) continue;
        if(!isFinite(sw.x) || !isFinite(sw.y)) continue;
        const scale = sw.state === 'orbit' ? 0.8+Math.sin(ef.t*10+sw.angle)*0.1 : 1.2;
        ctx.save();
        ctx.translate(sw.x, sw.y); ctx.scale(scale, scale); ctx.rotate(sw.rot);
        drawWeapon('sword', 0, 0, 0);
        ctx.restore();
      }
    }
    else if(ef.type === 'skyGlow'){
      const gk = ef.t/ef.dur;
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = (1-gk)*0.5;
      const sg = ctx.createRadialGradient(ef.x,ef.y,5,ef.x,ef.y,200+gk*100);
      sg.addColorStop(0,'#fff'); sg.addColorStop(0.3,ef.color||'#9fe6ff'); sg.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(ef.x,ef.y,200+gk*100,0,TAU); ctx.fill();
    }
    else if(ef.type === 'groundFire'){
      ctx.globalCompositeOperation = 'lighter';
      const fs = (ef.size||40)*sc;
      ctx.globalAlpha = (1-k)*0.7;
      const g = ctx.createRadialGradient(ef.x,ef.y,2,ef.x,ef.y-fs*0.3,fs);
      g.addColorStop(0,'#fff'); g.addColorStop(0.3,'#ffcc00'); g.addColorStop(0.6,'#ff6a20'); g.addColorStop(1,'rgba(255,50,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(ef.x,ef.y,fs,fs*0.6,0,0,TAU); ctx.fill();
    }
    else if(ef.type === 'groundCrack'){
      const delay = ef.delay||0;
      const actualK = clamp((ef.t-delay)/(ef.dur-delay), 0, 1);
      if(actualK > 0){
        ctx.translate(ef.x, ef.y); ctx.rotate(ef.angle); ctx.globalAlpha = 1-actualK;
        ctx.fillStyle = ef.color;
        ctx.beginPath(); ctx.moveTo(0,-5); ctx.lineTo(100+actualK*100,-2); ctx.lineTo(120+actualK*100,0); ctx.lineTo(100+actualK*100,2); ctx.lineTo(0,5); ctx.fill();
      }
    }
    else if(ef.type === 'skySword'){
      const fallK = clamp(ef.t/(ef.dur*0.6), 0, 1);
      const yOff = -800*(1-fallK*fallK);
      ctx.translate(ef.x, ef.y+yOff);
      ctx.fillStyle = '#e0f4ff';
      ctx.beginPath(); ctx.moveTo(-30,0); ctx.lineTo(30,0); ctx.lineTo(35,400); ctx.lineTo(0,450); ctx.lineTo(-35,400); ctx.closePath(); ctx.fill();
    }
    else if(ef.type === 'fallBlade'){
      const delay = ef.delay||0;
      const actualK = clamp((ef.t-delay)/(ef.dur-delay), 0, 1);
      if(actualK > 0){
        const yOff = -300*(1-actualK*actualK);
        ctx.translate(ef.x, ef.y-20*sc+yOff); ctx.rotate(Math.PI/2);
        drawWeapon('blade',0,0,0);
      }
    }
    else if(ef.type === 'goldenPillar'){
      const gk = ef.t/ef.dur;
      const alpha = gk<0.2 ? gk/0.2 : (1-gk)/0.8;
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = clamp(alpha,0,1)*0.6;
      const pillarH = 500;
      const pg = ctx.createLinearGradient(ef.x,ef.y,ef.x,ef.y-pillarH);
      pg.addColorStop(0, ef.color||'#ffd700'); pg.addColorStop(1,'rgba(255,215,0,0)');
      ctx.fillStyle = pg;
      const pw = 40+Math.sin(ef.t*15)*10;
      ctx.fillRect(ef.x-pw, ef.y-pillarH, pw*2, pillarH);
    }
    else if(ef.type === 'bloodStain'){
      ctx.translate(ef.x, ef.y); ctx.scale(1,0.4);
      ctx.fillStyle = `rgba(120,0,0,${(1-k)*0.8})`;
      ctx.beginPath(); ctx.arc(0,0,ef.size,0,TAU); ctx.fill();
    }
    else if(ef.type === 'lightning'){
      const lk = ef.t/ef.dur;
      const alpha = lk<0.1 ? lk/0.1 : (1-lk)/0.9;
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = clamp(alpha,0,1)*0.9;
      
      const endX = ef.endX !== undefined ? ef.endX : ef.x;
      const endY = ef.endY !== undefined ? ef.endY : ef.y;
      const width = ef.width || 4;
      
      /* 绘制闪电主干 */
      ctx.strokeStyle = ef.color || '#88ccff';
      ctx.lineWidth = width;
      ctx.shadowColor = ef.color || '#88ccff';
      ctx.shadowBlur = _fxBlur(20);
      ctx.beginPath();
      
      const segments = 12;
      const dx = (endX-ef.x)/segments;
      const dy = (endY-ef.y)/segments;
      
      ctx.moveTo(ef.x, ef.y);
      for(let i=1; i<segments; i++){
        const px = ef.x + dx*i + (Math.random()-0.5)*30;
        const py = ef.y + dy*i + (Math.random()-0.5)*20;
        ctx.lineTo(px, py);
      }
      ctx.lineTo(endX, endY);
      ctx.stroke();
      
      /* 绘制分支 */
      ctx.lineWidth = width*0.5;
      ctx.globalAlpha = clamp(alpha,0,1)*0.6;
      for(let b=0; b<3; b++){
        const branchStart = Math.floor(Math.random()*segments*0.7);
        const bx = ef.x + dx*branchStart;
        const by = ef.y + dy*branchStart;
        const branchAngle = (Math.random()-0.5)*Math.PI*0.6;
        const branchLen = 40+Math.random()*60;
        
        ctx.beginPath();
        ctx.moveTo(bx, by);
        const bSegs = 4;
        for(let i=1; i<=bSegs; i++){
          const t = i/bSegs;
          const bpx = bx + Math.cos(branchAngle)*branchLen*t + (Math.random()-0.5)*15;
          const bpy = by + Math.sin(branchAngle)*branchLen*t + (Math.random()-0.5)*10;
          ctx.lineTo(bpx, bpy);
        }
        ctx.stroke();
      }
      
      /* 发光效果 */
      ctx.lineWidth = width*2;
      ctx.globalAlpha = clamp(alpha,0,1)*0.3;
      ctx.beginPath();
      ctx.moveTo(ef.x, ef.y);
      for(let i=1; i<segments; i++){
        const px = ef.x + dx*i + (Math.random()-0.5)*30;
        const py = ef.y + dy*i + (Math.random()-0.5)*20;
        ctx.lineTo(px, py);
      }
      ctx.lineTo(endX, endY);
      ctx.stroke();
      
      ctx.shadowBlur = 0;
    }
    else if(ef.type === 'skyPillar'){
      /* 通天剑柱 - 从地面向天空延伸的光柱 */
      const pk = ef.t/ef.dur;
      const alpha = pk<0.15 ? pk/0.15 : (1-pk)/0.85;
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = clamp(alpha,0,1)*0.8;
      const h = ef.height || 500;
      const w = 60+Math.sin(ef.t*12)*15;
      const pg = ctx.createLinearGradient(ef.x,ef.y,ef.x,ef.y-h);
      pg.addColorStop(0, ef.color||'#9fe6ff');
      pg.addColorStop(0.5, (ef.color||'#9fe6ff')+'cc');
      pg.addColorStop(1, 'rgba(159,230,255,0)');
      ctx.fillStyle = pg;
      ctx.fillRect(ef.x-w, ef.y-h, w*2, h);
      /* 光柱核心 */
      ctx.globalAlpha = clamp(alpha,0,1)*0.5;
      const coreW = w*0.4;
      ctx.fillStyle = '#fff';
      ctx.fillRect(ef.x-coreW, ef.y-h, coreW*2, h);
    }
    else if(ef.type === 'skyCrack'){
      /* 天空裂痕 */
      const ck = ef.t/ef.dur;
      const alpha = ck<0.2 ? ck/0.2 : (1-ck)/0.8;
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = clamp(alpha,0,1)*0.7;
      const w = ef.width || 80;
      ctx.strokeStyle = ef.color || '#9fe6ff';
      ctx.lineWidth = 4;
      ctx.shadowColor = ef.color || '#9fe6ff';
      ctx.shadowBlur = _fxBlur(15);
      ctx.beginPath();
      ctx.moveTo(ef.x-w/2, ef.y);
      for(let i=1;i<8;i++){
        const px = ef.x-w/2+w*(i/8);
        const py = ef.y+(Math.random()-0.5)*20;
        ctx.lineTo(px, py);
      }
      ctx.lineTo(ef.x+w/2, ef.y);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
    else if(ef.type === 'gateSlash'){
      /* 天门裂开 - 两道巨大的剑气 */
      const gk = ef.t/ef.dur;
      const alpha = gk<0.15 ? gk/0.15 : (1-gk)/0.85;
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = clamp(alpha,0,1)*0.9;
      const side = ef.side || 1;
      const targetY = ef.targetY || 500;
      const w = 80+gk*40;
      const pg = ctx.createLinearGradient(ef.x,0,ef.x,targetY);
      pg.addColorStop(0, 'rgba(159,230,255,0)');
      pg.addColorStop(0.3, ef.color||'#9fe6ff');
      pg.addColorStop(1, ef.color||'#9fe6ff');
      ctx.fillStyle = pg;
      ctx.beginPath();
      ctx.moveTo(ef.x-10, 0);
      ctx.lineTo(ef.x+w*side, targetY*0.5);
      ctx.lineTo(ef.x-10, targetY);
      ctx.closePath();
      ctx.fill();
    }
    else if(ef.type === 'flyingSword'){
      /* 飞剑 - 从手中飞向天空 */
      const fk = ef.t/ef.dur;
      const alpha = fk<0.1 ? fk/0.1 : (fk>0.9 ? (1-fk)/0.1 : 1);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = clamp(alpha,0,1)*0.9;
      
      /* 计算当前位置 */
      const startX = ef.x;
      const startY = ef.y;
      const targetX = ef.targetX || startX;
      const targetY = ef.targetY || startY;
      const currentX = startX + (targetX-startX)*fk;
      const currentY = startY + (targetY-startY)*fk;
      
      ctx.translate(currentX, currentY);
      
      /* 计算旋转角度 */
      const angle = Math.atan2(targetY-startY, targetX-startX);
      ctx.rotate(angle + Math.PI/2);
      
      /* 绘制剑模型 */
      ctx.scale(1.5, 1.5);
      
      /* 剑身发光 */
      ctx.shadowColor = ef.color || '#9fe6ff';
      ctx.shadowBlur = _fxBlur(25);
      
      /* 剑身 */
      ctx.fillStyle = ef.color || '#9fe6ff';
      ctx.beginPath();
      ctx.moveTo(-5, -50);
      ctx.lineTo(5, -50);
      ctx.lineTo(4, 35);
      ctx.lineTo(0, 45);
      ctx.lineTo(-4, 35);
      ctx.closePath();
      ctx.fill();
      
      /* 剑身高光 */
      ctx.fillStyle = '#fff';
      ctx.globalAlpha = clamp(alpha,0,1)*0.6;
      ctx.beginPath();
      ctx.moveTo(-2, -45);
      ctx.lineTo(2, -45);
      ctx.lineTo(1, 30);
      ctx.lineTo(0, 35);
      ctx.lineTo(-1, 30);
      ctx.closePath();
      ctx.fill();
      
      /* 剑柄 */
      ctx.globalAlpha = clamp(alpha,0,1)*0.9;
      ctx.fillStyle = '#d0f0ff';
      ctx.fillRect(-8, 35, 16, 10);
      
      /* 剑格 */
      ctx.fillStyle = '#9fe6ff';
      ctx.fillRect(-10, 33, 20, 4);
      
      ctx.shadowBlur = 0;
    }
    else if(ef.type === 'ghostSword'){
      /* 幽灵剑影 */
      const delay = ef.delay || 0;
      const gk = clamp((ef.t-delay)/(ef.dur-delay), 0, 1);
      if(gk > 0){
        const alpha = gk<0.2 ? gk/0.2 : (1-gk)/0.8;
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = clamp(alpha,0,1)*0.7;
        ctx.translate(ef.x, ef.y);
        ctx.rotate(ef.rot || 0);
        ctx.scale(1.2, 1.2);
        /* 剑身 */
        ctx.fillStyle = ef.color || '#9fe6ff';
        ctx.shadowColor = ef.color || '#9fe6ff';
        ctx.shadowBlur = _fxBlur(20);
        ctx.beginPath();
        ctx.moveTo(-4, -40);
        ctx.lineTo(4, -40);
        ctx.lineTo(3, 30);
        ctx.lineTo(0, 40);
        ctx.lineTo(-3, 30);
        ctx.closePath();
        ctx.fill();
        /* 剑柄 */
        ctx.fillStyle = '#d0f0ff';
        ctx.fillRect(-6, 30, 12, 8);
        ctx.shadowBlur = 0;
      }
    }
    else if(ef.type === 'asuraAvatar'){
      /* 修罗/六道法相虚影：六道轮回拳调用时作「六道法相」，带道名标签 */
      /* ★ 可跟随施法者盘旋：ef.follow 为玩家引用时，按 ef.orbit 角度绕其旋转 */
      if(ef.follow && ef.follow.alive !== false && !ef.follow.dead){
        const sp = ef.rotSpeed || 0.5;
        const a = (ef.orbit || 0) + ef.t * sp;
        const R = ef.ringR || 96;
        ef.x = ef.follow.x + Math.cos(a) * R;
        ef.y = (ef.follow.y - 78) + Math.sin(a) * R * 0.42;
      }
      const ak = ef.t/ef.dur;
      const alpha = ak<0.2 ? ak/0.2 : (1-ak)/0.8;
      const facing = ef.facing || ((ef.follow && ef.x < ef.follow.x) ? 1 : -1);
      if(ef.spriteKey){
        /* ★ 角色本体光影：用真实职业精灵帧绘制六道法相（不再是丑陋几何体） */
        const gA = clamp(alpha,0,1);
        if(gA > 0.02){
          const anim = ef.anim || 'skill';
          const ft = (ef.frameT != null) ? ef.frameT : ((ef.t * 0.5) % 1);
          const gh = ef.ghostH || 86;
          /* 1) 清晰本体光影（朝向施法者，半透明） */
          drawCharGhost(ef.spriteKey, anim, ft, ef.x, ef.y, facing, gh, null, gA * 0.92);
          /* 2) 六道辉光：同色 lighter 笼罩，强化「道」的色彩区分 */
          if(ef.color) drawCharGhost(ef.spriteKey, anim, ft, ef.x, ef.y, facing, gh, ef.color, gA * 0.42);
        }
      } else {
        /* 原几何体（兼容其它技能的虚影调用） */
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = clamp(alpha,0,1)*0.62;
        ctx.save();
        ctx.translate(ef.x - facing*40, ef.y - 80);
        ctx.rotate((ef.spin || 0) * ef.t);
        ctx.scale(facing*2.5, 2.5);
        ctx.fillStyle = ef.color || '#ff2244';
        ctx.shadowColor = ef.color || '#ff2244';
        ctx.shadowBlur = _fxBlur(30);
        ctx.beginPath(); ctx.ellipse(0, 0, 20, 35, 0, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.arc(0, -40, 12, 0, TAU); ctx.fill();
        const swing = Math.sin(ef.t*8 + (ef.orbit||0)) * 10;
        ctx.lineWidth = 6;
        ctx.strokeStyle = ef.color || '#ff2244';
        ctx.beginPath();
        ctx.moveTo(-15, -10); ctx.lineTo(-35 - swing, 18);
        ctx.moveTo(15, -10);  ctx.lineTo(35 + swing, 18);
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.restore();
      }
      /* 道名标签（保持直立，不被自旋影响） */
      if(ef.label){
        ctx.globalAlpha = clamp(alpha,0,1)*0.92;
        ctx.fillStyle = ef.color || '#fff';
        ctx.font = 'bold 16px "Microsoft YaHei"';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(ef.label, ef.x, ef.y - 200);
        ctx.globalAlpha = 1;
      }
    }
    else if(ef.type === 'samsaraVortex'){
      /* 轮回漩涡：六道轮回拳核心异象 —— 身前显化轮回黑洞，六色法轮旋绕，
         可锁定敌人（ef.ref）实时跟随，把战场笼罩进轮回领域 */
      if(ef.ref && ef.ref.alive){ ef.x = ef.ref.x; ef.y = ef.ref.y; }
      const vk = ef.t/ef.dur;
      const va = vk < 0.2 ? vk/0.2 : (1-vk)/0.8;
      const R = (ef.big ? 230 : 150) * (0.7 + vk*0.5);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = clamp(va,0,1);
      ctx.translate(ef.x, ef.y - 30);
      /* 黑暗漩涡核心 */
      const cg = ctx.createRadialGradient(0,0,2,0,0,R);
      cg.addColorStop(0, 'rgba(8,0,18,0.95)');
      cg.addColorStop(0.42, '#3a0a2a');
      cg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = cg;
      ctx.beginPath(); ctx.arc(0,0,R,0,TAU); ctx.fill();
      /* 六色螺旋臂（对应六道） */
      const cols = ['#ffd86b','#ff8a3c','#ff2a4a','#9b5cff','#6bffb0','#4ab8ff'];
      ctx.lineWidth = 5;
      for(let c=0;c<6;c++){
        ctx.strokeStyle = cols[c];
        ctx.globalAlpha = clamp(va,0,1)*0.85;
        ctx.beginPath();
        for(let s=0;s<=40;s++){
          const tt = s/40;
          const a = ef.t*4 + c*(TAU/6) + tt*3.2;
          const rr = R*(1-tt);
          const px = Math.cos(a)*rr, py = Math.sin(a)*rr*0.7;
          if(s===0) ctx.moveTo(px,py); else ctx.lineTo(px,py);
        }
        ctx.stroke();
      }
      /* 外环 */
      ctx.globalAlpha = clamp(va,0,1)*0.7;
      ctx.strokeStyle = ef.color || '#ff5a3c'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0,0,R,0,TAU); ctx.stroke();
      /* 中央六道星点（六色，对应六道） */
      ctx.globalAlpha = clamp(va,0,1);
      for(let c=0;c<6;c++){
        const a = ef.t*1.5 + c*(TAU/6);
        ctx.fillStyle = cols[c];
        ctx.beginPath(); ctx.arc(Math.cos(a)*R*0.18, Math.sin(a)*R*0.18*0.7, 4, 0, TAU); ctx.fill();
      }
    }
    else if(ef.type === 'spaceCrack'){
      /* 空间裂痕 */
      const sk = ef.t/ef.dur;
      const alpha = sk<0.2 ? sk/0.2 : (1-sk)/0.8;
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = clamp(alpha,0,1)*0.8;
      const w = ef.width || 80;
      const h = ef.height || 40;
      /* 裂痕核心 - 黑暗 */
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.ellipse(ef.x, ef.y, w/2, h/2, 0, 0, TAU);
      ctx.fill();
      /* 裂痕边缘 - 红色能量 */
      ctx.strokeStyle = ef.color || '#ff4400';
      ctx.lineWidth = 3;
      ctx.shadowColor = ef.color || '#ff4400';
      ctx.shadowBlur = _fxBlur(15);
      ctx.beginPath();
      for(let i=0;i<12;i++){
        const a = (i/12)*TAU;
        const r = 1+Math.random()*0.3;
        const px = ef.x+Math.cos(a)*(w/2)*r;
        const py = ef.y+Math.sin(a)*(h/2)*r;
        if(i===0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
    else if(ef.type === 'taiChiArc'){
      /* 太极拳攻击范围弧形特效 */
      const ak = ef.t/ef.dur;
      const alpha = ak<0.15 ? ak/0.15 : (1-ak)/0.85;
      const facing = ef.facing || 1;
      const radius = ef.radius || 80;
      const comboType = ef.comboType || 'wardOff';
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = clamp(alpha,0,1)*0.7;
      ctx.save();
      ctx.translate(ef.x, ef.y);
      /* 外圈弧形 - 攻击范围指示 */
      const arcStart = facing>0 ? -Math.PI*0.45 : Math.PI*0.55;
      const arcEnd = facing>0 ? Math.PI*0.45 : Math.PI*1.45;
      const expandR = radius * (0.6 + ak*0.5);
      ctx.strokeStyle = ef.color || '#ffcc33';
      ctx.lineWidth = 4*(1-ak*0.5);
      ctx.shadowColor = ef.color || '#ffcc33';
      ctx.shadowBlur = _fxBlur(15);
      ctx.beginPath();
      ctx.arc(0, 0, expandR, arcStart, arcEnd);
      ctx.stroke();
      /* 内圈弧形 */
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2*(1-ak*0.5);
      ctx.globalAlpha = clamp(alpha,0,1)*0.5;
      ctx.beginPath();
      ctx.arc(0, 0, expandR*0.7, arcStart+0.2, arcEnd-0.2);
      ctx.stroke();
      /* 太极图案中心 */
      if(comboType === 'cloudHands'){
        /* 云手：双圆旋转 */
        const rot = ef.t * 12;
        ctx.globalAlpha = clamp(alpha,0,1)*0.6;
        ctx.strokeStyle = '#ffcc33';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(Math.cos(rot)*15, Math.sin(rot)*10, expandR*0.4, 0, Math.PI);
        ctx.stroke();
        ctx.strokeStyle = '#fff';
        ctx.beginPath();
        ctx.arc(-Math.cos(rot)*15, -Math.sin(rot)*10, expandR*0.4, Math.PI, TAU);
        ctx.stroke();
      } else {
        /* 其他招式：中心气劲点 */
        ctx.globalAlpha = clamp(alpha,0,1)*0.8;
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(0, 0, 6*(1-ak), 0, TAU);
        ctx.fill();
      }
      /* 范围边缘光点 */
      ctx.globalAlpha = clamp(alpha,0,1)*0.6;
      for(let i=0;i<8;i++){
        const dotAngle = arcStart + (i/8)*(arcEnd-arcStart);
        const dx = Math.cos(dotAngle)*expandR;
        const dy = Math.sin(dotAngle)*expandR;
        ctx.fillStyle = i%2===0?'#ffcc33':'#fff';
        ctx.beginPath();
        ctx.arc(dx, dy, 3*(1-ak), 0, TAU);
        ctx.fill();
      }
      ctx.shadowBlur = 0;
      ctx.restore();
    }
    else if(ef.type === 'afterImage'){
      /* 残影：用同一套精灵表绘制半透明残像，形成瞬身拖影 */
      const aiK = 1 - k;
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = clamp(aiK * (ef.alpha || 0.5), 0, 1);
      const aiAt = CHAR_ATLASES[['sword','blade','spear','fist'][ef.weaponIdx || 0]];
      let drew = false;
      if(aiAt && aiAt.ready && aiAt.img && aiAt.img.naturalWidth){
        const aiBody = aiAt.bodyWorld * sc;
        ctx.shadowColor = ef.color || '#ffffff';
        ctx.shadowBlur = _fxBlur(22);
        drew = drawSpriteFrame(aiAt, ef.anim || 'skill', 0.5, ef.x, ef.y, ef.facing || 1, aiBody, null);
        ctx.shadowBlur = 0;
      }
      if(!drew){
        /* 兜底：竖向光带 */
        const ag = ctx.createLinearGradient(ef.x, ef.y - 110*sc, ef.x, ef.y);
        ag.addColorStop(0, 'rgba(255,255,255,0)');
        ag.addColorStop(0.5, ef.color || '#ffffff');
        ag.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = ag;
        ctx.fillRect(ef.x - 26*sc, ef.y - 110*sc, 52*sc, 110*sc);
      }
    }
    else if(ef.type === 'dharmaWheel'){
      /* 炁轮：多层旋转法阵 + 刻度 */
      ctx.globalCompositeOperation = 'lighter';
      const dwK = ef.t/ef.dur;
      const dwA = dwK < 0.15 ? dwK/0.15 : (1-dwK)/0.85;
      const dwR = (ef.r || 180) * (0.6 + dwK*0.5);
      const dwCol = ef.color || '#7dffd4';
      ctx.globalAlpha = clamp(dwA,0,1) * 0.85;
      ctx.translate(ef.x, ef.y);
      ctx.scale(1, 0.42);
      ctx.strokeStyle = dwCol; ctx.lineWidth = 3; ctx.shadowColor = dwCol; ctx.shadowBlur = 20;
      ctx.beginPath(); ctx.arc(0,0,dwR,0,TAU); ctx.stroke();
      ctx.lineWidth = 1.5; ctx.globalAlpha = clamp(dwA,0,1)*0.55;
      ctx.beginPath(); ctx.arc(0,0,dwR*0.78,0,TAU); ctx.stroke();
      ctx.beginPath(); ctx.arc(0,0,dwR*0.5,0,TAU); ctx.stroke();
      /* 旋转刻度 */
      ctx.globalAlpha = clamp(dwA,0,1)*0.75;
      const dwN = 24;
      for(let i=0;i<dwN;i++){
        const a = i/dwN*TAU + ef.t*1.6;
        const r1 = dwR*0.82, r2 = dwR*0.98;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a)*r1, Math.sin(a)*r1);
        ctx.lineTo(Math.cos(a)*r2, Math.sin(a)*r2);
        ctx.stroke();
      }
      /* 内圈光晕 */
      ctx.globalAlpha = clamp(dwA,0,1)*0.5;
      const dwg = ctx.createRadialGradient(0,0,4,0,0,dwR*0.7);
      dwg.addColorStop(0,'#ffffff'); dwg.addColorStop(0.4,dwCol); dwg.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle = dwg;
      ctx.beginPath(); ctx.arc(0,0,dwR*0.7,0,TAU); ctx.fill();
      ctx.shadowBlur = 0;
    }
    else if(ef.type === 'punchWave'){
      /* 拳风：锥形冲击波 */
      ctx.globalCompositeOperation = 'lighter';
      const pwK = ef.t/ef.dur;
      const pwA = (1-pwK) * 0.85;
      const pwLen = (ef.len || 160) * (0.4 + pwK*0.9);
      ctx.globalAlpha = clamp(pwA,0,1);
      ctx.translate(ef.x, ef.y - 55*sc);
      ctx.scale(ef.facing || 1, 1);
      const pwg = ctx.createLinearGradient(0,0,pwLen,0);
      pwg.addColorStop(0, ef.color || '#ffcc33');
      pwg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = pwg;
      ctx.beginPath();
      ctx.moveTo(0, -10*sc);
      ctx.quadraticCurveTo(pwLen*0.6, -46*sc, pwLen, 0);
      ctx.quadraticCurveTo(pwLen*0.6, 46*sc, 0, 10*sc);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.globalAlpha = clamp(pwA,0,1)*0.7;
      ctx.beginPath(); ctx.arc(0,0,pwLen*0.45,-0.9,0.9); ctx.stroke();
    }
    else if(ef.type === 'fistArc'){
      /* 拳影：弧形拳风 + 可选冲击环 */
      ctx.globalCompositeOperation = 'lighter';
      const faK = ef.t/ef.dur;
      const faS = ef.scale || 1.0;
      ctx.globalAlpha = clamp(1-faK, 0, 1) * 0.92;
      ctx.translate(ef.x, ef.y - 58*sc);
      ctx.scale((ef.facing || 1) * faS, faS);
      ctx.rotate(-0.5 + faK*1.0);
      ctx.strokeStyle = ef.color || '#ffcc33';
      ctx.lineWidth = 16 * (1 - faK*0.5);
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(0,0,54,-1.15,1.15); ctx.stroke();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 5 * (1 - faK*0.5);
      ctx.beginPath(); ctx.arc(0,0,54,-1.15,1.15); ctx.stroke();
      if(ef.ring){
        ctx.globalAlpha = clamp(1-faK,0,1)*0.6;
        ctx.strokeStyle = ef.color || '#ffcc33';
        ctx.lineWidth = 6*(1-faK);
        ctx.beginPath(); ctx.arc(0,0,60+faK*120,0,TAU); ctx.stroke();
      }
    }
    else if(ef.type === 'spearLine'){
      /* 直线贯穿光：起止点之间的渐细光带 */
      const slK = ef.t/ef.dur;
      const slA = slK < 0.12 ? slK/0.12 : (1-slK)/0.88;
      const w = ef.width || 14;
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = clamp(slA,0,1) * 0.95;
      ctx.strokeStyle = ef.color || '#ffffff';
      ctx.shadowColor = ef.color || '#ffffff';
      ctx.shadowBlur = _fxBlur(28);
      ctx.lineCap = 'round';
      ctx.lineWidth = w * (1 - slK*0.35);
      ctx.beginPath(); ctx.moveTo(ef.x, ef.y); ctx.lineTo(ef.endX, ef.endY); ctx.stroke();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = w * 0.35 * (1 - slK*0.3);
      ctx.beginPath(); ctx.moveTo(ef.x, ef.y); ctx.lineTo(ef.endX, ef.endY); ctx.stroke();
      /* 横向扩散 */
      ctx.globalAlpha = clamp(slA,0,1) * 0.3;
      ctx.lineWidth = w * 2.4 * (1 - slK);
      ctx.beginPath(); ctx.moveTo(ef.x, ef.y); ctx.lineTo(ef.endX, ef.endY); ctx.stroke();
      ctx.shadowBlur = 0;
    }
    else if(ef.type === 'qiColumn'){
      /* 炁柱：自脚下冲天而起的螺旋气柱 */
      const qcK = ef.t/ef.dur;
      const qcA = qcK < 0.15 ? qcK/0.15 : (1-qcK)/0.85;
      const qcCol = ef.color || '#7dffd4';
      ctx.globalCompositeOperation = 'lighter';
      const qcH = 720;
      const qcW = 78 + Math.sin(ef.t*16)*16;
      /* 外层气柱 */
      ctx.globalAlpha = clamp(qcA,0,1) * 0.85;
      const qcg = ctx.createLinearGradient(ef.x, ef.y, ef.x, ef.y - qcH);
      qcg.addColorStop(0, '#ffffff');
      qcg.addColorStop(0.18, qcCol);
      qcg.addColorStop(0.6, qcCol + 'bb');
      qcg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = qcg;
      ctx.fillRect(ef.x - qcW, ef.y - qcH, qcW*2, qcH);
      /* 核心白柱 */
      ctx.globalAlpha = clamp(qcA,0,1) * 0.9;
      const qcCore = ctx.createLinearGradient(ef.x, ef.y, ef.x, ef.y - qcH*0.8);
      qcCore.addColorStop(0, '#ffffff');
      qcCore.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = qcCore;
      ctx.fillRect(ef.x - qcW*0.3, ef.y - qcH, qcW*0.6, qcH);
      /* 环绕气旋 */
      ctx.globalAlpha = clamp(qcA,0,1) * 0.85;
      ctx.strokeStyle = qcCol; ctx.lineWidth = 5;
      ctx.shadowColor = qcCol; ctx.shadowBlur = _fxBlur(18);
      for(let i=0;i<7;i++){
        const yy = ef.y - 30 - i*100;
        const a = ef.t*7 + i*0.9;
        ctx.beginPath();
        ctx.ellipse(ef.x, yy, qcW*(1.4 - i*0.06), 16, Math.sin(a)*0.25, 0, TAU);
        ctx.stroke();
      }
      /* 地面冲击环 */
      ctx.globalAlpha = clamp(qcA,0,1) * 0.6;
      ctx.lineWidth = 8 * (1-qcK);
      ctx.beginPath(); ctx.ellipse(ef.x, ef.y, 120 + qcK*260, 40 + qcK*90, 0, 0, TAU); ctx.stroke();
      ctx.shadowBlur = 0;
    }
    else if(ef.type === 'palmPrint'){
      /* 金色巨掌：自天拍落 */
      const ppK = ef.t/ef.dur;
      const ppA = ppK < 0.12 ? ppK/0.12 : (1-ppK)/0.88;
      const ppCol = ef.color || '#ffd700';
      const ppS = (ef.scale || 1.0) * (ppK < 0.55 ? lerp(1.5, 1.0, ppK/0.55) : 1.0);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = clamp(ppA,0,1) * 0.9;
      ctx.translate(ef.x, ef.y - 40*sc);
      ctx.scale(ppS, ppS);
      ctx.shadowColor = ppCol; ctx.shadowBlur = _fxBlur(34);
      const drawPalm = (a)=>{
        ctx.save();
        ctx.rotate(a);
        ctx.fillStyle = ppCol;
        /* 掌心 */
        ctx.beginPath(); ctx.ellipse(0, 10, 62, 46, 0, 0, TAU); ctx.fill();
        /* 五指 */
        const fingers = [[-46,-30,-0.3,34,16],[ -18,-46,-0.12,44,17],[12,-48,0.05,46,17],[40,-38,0.22,38,15],[62,-14,0.42,26,12]];
        for(const f of fingers){
          ctx.save(); ctx.translate(f[0], f[1]); ctx.rotate(f[2]);
          ctx.beginPath(); ctx.ellipse(0, -f[3]*0.5, f[4]*0.5, f[3]*0.75, 0, 0, TAU); ctx.fill();
          ctx.restore();
        }
        /* 掌心高光 */
        ctx.fillStyle = '#ffffff'; ctx.globalAlpha = clamp(ppA,0,1)*0.45;
        ctx.beginPath(); ctx.ellipse(0, 10, 26, 18, 0, 0, TAU); ctx.fill();
        ctx.restore();
      };
      drawPalm(-0.12);
      ctx.globalAlpha = clamp(ppA,0,1) * 0.35;
      drawPalm(0.16);
      ctx.shadowBlur = 0;
      /* 掌压气流 */
      ctx.globalAlpha = clamp(ppA,0,1) * 0.5;
      ctx.strokeStyle = ppCol; ctx.lineWidth = 5;
      for(let i=0;i<3;i++){
        ctx.beginPath();
        ctx.ellipse(0, 20, 120+i*70+ppK*60, 46+i*26+ppK*24, 0, 0, TAU);
        ctx.stroke();
      }
    }
    else if(ef.type === 'giganticSword'){
      /* 天地一剑：贯穿画面的巨剑虚影 */
      const gsK = ef.t/ef.dur;
      const gsA = gsK < 0.1 ? gsK/0.1 : (1-gsK)/0.9;
      const gsCol = ef.color || '#eaf6ff';
      const fall = gsK < 0.35 ? (1 - gsK/0.35) * 520 : 0;
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = clamp(gsA,0,1) * 0.92;
      ctx.translate(ef.x, ef.y - fall);
      /* ★ tipDown：剑尖朝下（默认朝上）。御雷真诀等"自天而降"的剑用这个，
         翻转后再上移 780，使剑尖正好落在 ef.y */
      if(ef.tipDown){ ctx.scale(1, -1); ctx.translate(0, -780); }
      ctx.shadowColor = gsCol; ctx.shadowBlur = _fxBlur(44);
      /* 剑身 */
      const gsg = ctx.createLinearGradient(0, -760, 0, 0);
      gsg.addColorStop(0, 'rgba(255,255,255,0)');
      gsg.addColorStop(0.35, gsCol);
      gsg.addColorStop(1, '#ffffff');
      ctx.fillStyle = gsg;
      ctx.beginPath();
      ctx.moveTo(0, -780);
      ctx.lineTo(34, -640);
      ctx.lineTo(26, 40);
      ctx.lineTo(-26, 40);
      ctx.lineTo(-34, -640);
      ctx.closePath();
      ctx.fill();
      /* 剑刃高光 */
      ctx.fillStyle = '#ffffff'; ctx.globalAlpha = clamp(gsA,0,1)*0.85;
      ctx.fillRect(-7, -740, 14, 770);
      /* 护手 */
      ctx.globalAlpha = clamp(gsA,0,1);
      ctx.fillStyle = gsCol;
      ctx.fillRect(-96, 34, 192, 20);
      ctx.fillRect(-15, 48, 30, 86);
      ctx.shadowBlur = 0;
    }
    else if(ef.type === 'chainBolt'){
      /* ★ 雷链（天雷剑诀专属）：两点之间拉出锯齿雷光，逐帧抖动 = 电弧跳跃感 */
      const ck = ef.t/ef.dur;
      const ca = ck < 0.15 ? ck/0.15 : (1-ck)/0.85;
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = clamp(ca, 0, 1);
      ctx.shadowColor = ef.color || '#eaf6ff';
      ctx.shadowBlur = _fxBlur(16);
      ctx.lineCap = 'round';
      const bx1 = ef.x, by1 = ef.y, bx2 = ef.endX, by2 = ef.endY;
      const segs = 7;
      for(let pass = 0; pass < 2; pass++){
        ctx.lineWidth = pass === 0 ? 9 * (1 - ck*0.4) : 3;
        ctx.strokeStyle = pass === 0 ? (ef.color || '#eaf6ff') : '#ffffff';
        ctx.beginPath();
        ctx.moveTo(bx1, by1);
        for(let s = 1; s < segs; s++){
          const t2 = s / segs;
          const jitter = (pass === 0 ? 16 : 8) * (1 - ck);
          ctx.lineTo(bx1 + (bx2-bx1)*t2 + rand(-jitter, jitter), by1 + (by2-by1)*t2 + rand(-jitter, jitter));
        }
        ctx.lineTo(bx2, by2);
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
    }
    else if(ef.type === 'swordStake'){
      /* ★ 插地剑桩（诛仙剑阵）：手中剑自天而降、剑尖插入地面，留在地上围成剑阵 */
      const sf = ef.scale || 1.5;
      const fallDur = ef.fallDur || 0.32;
      const sk2 = Math.min(1, ef.t / fallDur);
      const ease = 1 - Math.pow(1 - sk2, 3);
      const fallFrom = ef.fromH || 640;
      const yOff = -(1 - ease) * fallFrom;
      const kk = ef.t / ef.dur;
      const fade = kk > 0.86 ? (1 - kk) / 0.14 : 1;
      const col = ef.color || '#c4b0ff';
      ctx.globalAlpha = clamp(fade, 0, 1);
      /* 下落时的剑光柱 */
      if(sk2 < 1){
        ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createLinearGradient(ef.x, ef.y + yOff - 220, ef.x, ef.y + yOff);
        g.addColorStop(0, 'rgba(0,0,0,0)');
        g.addColorStop(0.65, col);
        g.addColorStop(1, 'rgba(255,255,255,0.9)');
        ctx.fillStyle = g;
        ctx.fillRect(ef.x - 7, ef.y + yOff - 220, 14, 220);
      }
      ctx.globalCompositeOperation = 'source-over';
      /* 剑本体（手中剑模型，剑尖朝下：旋转 90°，原点抬到剑柄） */
      ctx.save();
      ctx.translate(ef.x, ef.y + yOff - 96 * sf);
      ctx.rotate(Math.PI / 2);
      ctx.scale(sf, sf);
      ctx.globalCompositeOperation = 'lighter';
      ctx.shadowColor = col; ctx.shadowBlur = _fxBlur(18);
      drawWeapon('sword', 0, 0, 0);
      ctx.shadowBlur = 0;
      ctx.restore();
      /* 落地冲击环 */
      if(sk2 >= 1){
        const ik = Math.min(1, (ef.t - fallDur) / 0.45);
        ctx.globalAlpha = clamp(fade * (1 - ik), 0, 1) * 0.85;
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = col; ctx.lineWidth = 4 * (1 - ik);
        ctx.beginPath(); ctx.ellipse(ef.x, ef.y, 40 + ik * 88, 12 + ik * 26, 0, 0, TAU); ctx.stroke();
      }
    }
    else if(ef.type === 'giganticWeapon'){
      /* 巨兵虚影：从天而降的重型武器（巨尺 / 霸王枪） */
      const gwK = ef.t/ef.dur;
      const gwA = gwK < 0.1 ? gwK/0.1 : (1-gwK)/0.9;
      const gwCol = ef.color || '#ff8a20';
      const gwFall = gwK < 0.4 ? (1 - gwK/0.4) * 600 : 0;
      const gwS = ef.scale || 4.0;
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = clamp(gwA,0,1) * 0.95;
      ctx.translate(ef.x, ef.y - gwFall);
      /* ★ 朝向镜像：f=-1 时刀尖/枪尖翻向左侧敌人（ef.f 由技能按施法者朝向传入） */
      ctx.scale(ef.f || 1, 1);
      ctx.rotate(ef.rot || 0);
      ctx.shadowColor = gwCol; ctx.shadowBlur = _fxBlur(40);
      ctx.scale(gwS, gwS);
      drawWeapon(ef.weaponType || 'blade', 0, 0, 0);
      ctx.shadowBlur = 0;
      /* 落点冲击环 */
      if(gwK > 0.35){
        const ik = (gwK - 0.35) / 0.65;
        ctx.save();
        ctx.rotate(-(ef.rot || 0));
        ctx.globalAlpha = clamp(1-ik,0,1) * 0.7;
        ctx.strokeStyle = gwCol; ctx.lineWidth = 8*(1-ik);
        ctx.beginPath(); ctx.ellipse(0, 0, 80 + ik*360, 30 + ik*120, 0, 0, TAU); ctx.stroke();
        ctx.restore();
      }
    }
    else if(ef.type === 'dharmaWheel' || ef.type === 'qiCharge' || ef.type === 'enemyCastRing'){
      /* 兜底：不放任何绘制，避免未知特效穿透到默认分支 */
    }
    ctx.restore();
  }
}

function drawEntityHealthBars(){
  const drawBar = (ent, isPlayer)=>{
    if(ent.dead || (!ent.isPlayer && !ent.alive)) return;
    const sc = depthScale(ent.y)*(ent.scale||1);
    /* 血条高度：有精灵表时按精灵实际身高算，否则用旧的固定值 */
    let headH = 160;
    if(!isPlayer){
      const _m = monsterAtlasOf(ent.typeKey);
      if(_m && _m.ready) headH = _m.bodyWorld + 20;
    }
    const px = ent.x, py = ent.y-ent.h-headH*sc;
    ctx.save(); ctx.translate(px, py);
    if(!isPlayer && ent.def){
      ctx.textAlign = 'center';
      ctx.font = 'bold 12px "Microsoft YaHei"';
      ctx.fillStyle = ent.def.boss?'#ff6a4a':'#ffccaa';
      ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.lineWidth = 3;
      ctx.strokeText(ent.def.name, 0, -8);
      ctx.fillText(ent.def.name, 0, -8);
      /* ★ 词条徽标 */
      if(ent.affix && ENEMY_AFFIX[ent.affix]){
        const af = ENEMY_AFFIX[ent.affix];
        ctx.font = 'bold 10px "Microsoft YaHei"';
        const tw = ctx.measureText(af.name).width + 10;
        ctx.fillStyle = hexA(af.color, 0.88);
        ctx.beginPath(); ctx.roundRect(-tw/2, -28, tw, 14, 3); ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.roundRect(-tw/2, -28, tw, 14, 3); ctx.stroke();
        ctx.fillStyle = '#0b0f14';
        ctx.fillText(af.name, 0, -17);
      }
    }
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(-35,0,70,6); ctx.fillRect(-35,8,70,4);
    const hpW = 70*clamp(ent.hp/ent.maxHp,0,1);
    const hpGrd = ctx.createLinearGradient(-35,0,35,0);
    if(isPlayer){ hpGrd.addColorStop(0,'#2ee6a8'); hpGrd.addColorStop(1,'#7ed6ff'); }
    else { hpGrd.addColorStop(0,'#ff4444'); hpGrd.addColorStop(1,'#ffaa00'); }
    ctx.fillStyle = hpGrd; ctx.fillRect(-35,0,hpW,6);
    const mpW = 70*clamp(ent.mp/ent.maxMp,0,1);
    ctx.fillStyle = '#c96bff'; ctx.fillRect(-35,8,mpW,4);
    ctx.restore();
  };
  if(G.player) drawBar(G.player, true);
  if(G.player2) drawBar(G.player2, true);
  for(const e of G.enemies) drawBar(e, false);
}

/* ★ 改进9: 技能蓄力进度圈 */
function drawSkillChargeIndicator(){
  if(!G) return;
  const drawCharge = (p) => {
    if(!p || p.dead || !p.action) return;
    // 检查是否是蓄力类技能
    const chargeTypes = ['swordCharge','storm','bladeCharge','spearThrust','spearCharge','fistCharge','fistMeditate'];
    if(!chargeTypes.includes(p.action.type)) return;
    
    const progress = clamp(p.action.t / (p.action.dur || 0.6), 0, 1);
    const color = WEAPONS[p.weaponIdx] ? WEAPONS[p.weaponIdx].color : '#fff';
    
    // 脚下进度圈
    ctx.save();
    ctx.translate(p.x, p.y);
    
    // 背景圆环
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, 35, 0, TAU);
    ctx.stroke();
    
    // 进度圆环
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(0, 0, 35, -Math.PI/2, -Math.PI/2 + TAU * progress);
    ctx.stroke();
    
    // 发光效果
    ctx.globalAlpha = 0.3 + Math.sin(G.t * 8) * 0.1;
    ctx.strokeStyle = color;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(0, 0, 35, -Math.PI/2, -Math.PI/2 + TAU * progress);
    ctx.stroke();
    
    ctx.restore();
  };
  
  if(G.player) drawCharge(G.player);
  if(G.player2) drawCharge(G.player2);
}

