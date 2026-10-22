/* ============================================================
   ★ DNF 式房间传送门（世界坐标绘制）
   ============================================================ */
function drawRoomPortal(){
  if(!G || !G.portal) return;
  const t = G.portal.t || 0;
  const x = G.portal.x;
  const baseY = GY_BOTTOM + 6;
  const openK = Math.min(1, t / 0.7);
  const ease = 1 - Math.pow(1 - openK, 3);
  const br = 0.86 + Math.sin(t * 2.6) * 0.14;      /* 呼吸 */

  /* 门洞几何 */
  const rw = 58 * ease;          /* 半宽 */
  const rh = 132 * ease;         /* 半高 */
  const ay = baseY - 42 - rh;    /* 门洞圆心 */
  const pilX = 92 * ease;        /* 立柱中心距门轴 */

  ctx.save();
  ctx.textAlign = 'center';

  /* ================= ① 地面法阵 ================= */
  const fr = 120 * ease;
  if(fr > 8){
    ctx.save();
    ctx.translate(x, baseY - 16);
    ctx.scale(1, 0.32);

    /* 外辉光 */
    const cg = ctx.createRadialGradient(0, 0, 0, 0, 0, fr);
    cg.addColorStop(0, 'rgba(200,250,255,' + (0.62 * ease) + ')');
    cg.addColorStop(0.42, 'rgba(80,195,255,' + (0.38 * ease) + ')');
    cg.addColorStop(1, 'rgba(30,80,200,0)');
    ctx.fillStyle = cg;
    ctx.beginPath(); ctx.arc(0, 0, fr, 0, TAU); ctx.fill();

    ctx.globalCompositeOperation = 'lighter';
    /* 外环 */
    ctx.globalAlpha = 0.9 * ease;
    ctx.strokeStyle = '#a7ecff';
    ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.arc(0, 0, fr * 0.95, 0, TAU); ctx.stroke();
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(0, 0, fr * 0.88, 0, TAU); ctx.stroke();
    /* 外圈刻度（24 根，长短交替）*/
    for(let i = 0; i < 24; i++){
      const a = t * 0.5 + i * TAU / 24;
      const r1 = fr * (i % 3 === 0 ? 0.78 : 0.84);
      ctx.globalAlpha = (0.25 + 0.6 * Math.abs(Math.sin(t * 2.2 + i * 0.5))) * ease;
      ctx.lineWidth = i % 3 === 0 ? 2.2 : 1.4;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r1, Math.sin(a) * r1);
      ctx.lineTo(Math.cos(a) * fr * 0.93, Math.sin(a) * fr * 0.93);
      ctx.stroke();
    }
    /* 内环 */
    ctx.globalAlpha = 0.85 * ease;
    ctx.lineWidth = 1.8;
    ctx.strokeStyle = '#d6f8ff';
    ctx.beginPath(); ctx.arc(0, 0, fr * 0.60, 0, TAU); ctx.stroke();
    /* 内圈反向符文刻度 */
    for(let i = 0; i < 16; i++){
      const a = -t * 0.85 + i * TAU / 16;
      ctx.globalAlpha = (0.2 + 0.55 * Math.abs(Math.cos(t * 1.8 + i * 0.7))) * ease;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * fr * 0.36, Math.sin(a) * fr * 0.36);
      ctx.lineTo(Math.cos(a) * fr * 0.57, Math.sin(a) * fr * 0.57);
      ctx.stroke();
    }
    /* 双三角（六芒） */
    ctx.strokeStyle = '#eafcff';
    ctx.globalAlpha = (0.42 + Math.sin(t * 2.0) * 0.18) * ease;
    ctx.lineWidth = 1.6;
    for(let sp = 0; sp < 2; sp++){
      ctx.beginPath();
      for(let i = 0; i < 3; i++){
        const a = t * 0.22 + sp * Math.PI / 3 + i * TAU / 3 - Math.PI / 2;
        const px = Math.cos(a) * fr * 0.70, py = Math.sin(a) * fr * 0.70;
        if(i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath(); ctx.stroke();
    }
    /* 中心符文点 */
    ctx.globalAlpha = 0.7 * ease;
    for(let i = 0; i < 8; i++){
      const a = t * 0.6 + i * TAU / 8;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(Math.cos(a) * fr * 0.21, Math.sin(a) * fr * 0.21, 2.4, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  /* ================= ② 门后的光晕（溢出） ================= */
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const halo = ctx.createRadialGradient(x, ay, 10, x, ay, 200 * ease);
  halo.addColorStop(0, 'rgba(150,235,255,' + (0.30 * ease * br) + ')');
  halo.addColorStop(0.4, 'rgba(70,170,255,' + (0.14 * ease) + ')');
  halo.addColorStop(1, 'rgba(30,80,200,0)');
  ctx.fillStyle = halo;
  ctx.beginPath(); ctx.ellipse(x, ay, 200 * ease, 220 * ease, 0, 0, TAU); ctx.fill();
  ctx.restore();

  /* ================= ③ 门洞：星云漩涡 ================= */
  if(rh > 4){
    ctx.save();
    /* 底色 */
    const bg2 = ctx.createRadialGradient(x, ay + rh * 0.15, 3, x, ay, rh * 1.05);
    bg2.addColorStop(0, 'rgba(240,253,255,' + (0.98 * ease) + ')');
    bg2.addColorStop(0.20, 'rgba(150,235,255,' + (0.92 * ease) + ')');
    bg2.addColorStop(0.48, 'rgba(56,150,245,' + (0.85 * ease) + ')');
    bg2.addColorStop(0.76, 'rgba(22,62,150,' + (0.88 * ease) + ')');
    bg2.addColorStop(1, 'rgba(8,18,52,' + (0.94 * ease) + ')');
    ctx.fillStyle = bg2;
    ctx.beginPath(); ctx.ellipse(x, ay, rw, rh, 0, 0, TAU); ctx.fill();

    /* 漩涡（裁剪在门洞内） */
    ctx.save();
    ctx.beginPath(); ctx.ellipse(x, ay, rw * 0.97, rh * 0.97, 0, 0, TAU); ctx.clip();
    ctx.globalCompositeOperation = 'lighter';

    /* 螺旋臂：用逐渐缩小的倾斜椭圆环表示 */
    const arms = 5;
    for(let i = 0; i < arms; i++){
      const ph = ((t * 0.35 + i / arms) % 1);
      const s2 = 0.30 + ph * 0.78;
      ctx.globalAlpha = Math.sin(ph * Math.PI) * 0.55 * ease;
      ctx.strokeStyle = i % 2 ? 'rgba(200,248,255,0.95)' : 'rgba(120,205,255,0.95)';
      ctx.lineWidth = 2.6 - ph * 1.4;
      ctx.beginPath();
      ctx.ellipse(x, ay + (ph - 0.5) * rh * 0.55,
                  rw * s2, rh * s2 * 0.86,
                  (t * 1.1 + i * 0.7) % TAU, 0, TAU);
      ctx.stroke();
    }
    /* 快速内旋 */
    for(let i = 0; i < 3; i++){
      const ph = ((t * 1.25 + i / 3) % 1);
      ctx.globalAlpha = Math.sin(ph * Math.PI) * 0.5 * ease;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.ellipse(x, ay, rw * (0.15 + ph * 0.62), rh * (0.12 + ph * 0.66), -t * 2.2, 0, TAU);
      ctx.stroke();
    }
    /* 星点 */
    for(let i = 0; i < 16; i++){
      const a = i * 2.399 + t * 0.55;
      const rr = 0.14 + ((i * 0.137) % 1) * 0.78;
      const px = x + Math.cos(a) * rw * rr;
      const py = ay + Math.sin(a) * rh * rr;
      ctx.globalAlpha = (0.22 + 0.62 * Math.abs(Math.sin(t * 3 + i))) * ease;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(px, py, 1.3 + (i % 3) * 0.7, 0, TAU); ctx.fill();
    }
    /* 中心白核 */
    const coreR = (15 + Math.sin(t * 5.2) * 3.4) * ease;
    const coreG = ctx.createRadialGradient(x, ay, 0, x, ay, coreR * 2.6);
    coreG.addColorStop(0, 'rgba(255,255,255,' + (0.98 * ease) + ')');
    coreG.addColorStop(0.34, 'rgba(215,250,255,' + (0.6 * ease) + ')');
    coreG.addColorStop(1, 'rgba(140,225,255,0)');
    ctx.globalAlpha = 1;
    ctx.fillStyle = coreG;
    ctx.beginPath(); ctx.arc(x, ay, coreR * 2.6, 0, TAU); ctx.fill();
    ctx.restore();

    /* 门洞描边：内亮外柔 */
    ctx.globalAlpha = 0.95 * ease;
    ctx.strokeStyle = '#eafcff';
    ctx.lineWidth = 2.6;
    ctx.beginPath(); ctx.ellipse(x, ay, rw, rh, 0, 0, TAU); ctx.stroke();
    ctx.globalAlpha = 0.4 * ease;
    ctx.strokeStyle = '#7fd8ff';
    ctx.lineWidth = 9;
    ctx.beginPath(); ctx.ellipse(x, ay, rw + 5, rh + 5, 0, 0, TAU); ctx.stroke();
    ctx.restore();
  }

  /* ================= ④ 石台台阶 ================= */
  ctx.save();
  ctx.globalAlpha = ease;
  const stepW = 118 * ease, stepH = 13;
  for(let i = 0; i < 2; i++){
    const w = stepW - i * 14, hh = stepH;
    const yy = baseY - hh * (i + 1) * 0.72;
    const g2 = ctx.createLinearGradient(x - w, yy, x + w, yy + hh);
    g2.addColorStop(0, '#2b3341');
    g2.addColorStop(0.5, '#48566b');
    g2.addColorStop(1, '#232a36');
    ctx.fillStyle = g2;
    ctx.beginPath(); ctx.roundRect(x - w, yy, w * 2, hh, 3); ctx.fill();
    ctx.strokeStyle = 'rgba(10,16,26,0.7)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(x - w, yy, w * 2, hh, 3); ctx.stroke();
    /* 台阶符文缝 */
    ctx.fillStyle = 'rgba(120,215,255,' + (0.5 * Math.abs(Math.sin(t * 2 + i))) + ')';
    ctx.fillRect(x - w * 0.42, yy + hh * 0.36, w * 0.84, 1.6);
  }
  ctx.restore();

  /* ================= ⑤ 立柱 + 火炬 ================= */
  const pilTop = ay - rh + 6;
  const drawPillar = (cx, sgn) => {
    const pw = 22;
    const ph = (baseY - 20) - pilTop;
    /* 柱身 */
    const g3 = ctx.createLinearGradient(cx - pw/2, 0, cx + pw/2, 0);
    g3.addColorStop(0, '#161c26');
    g3.addColorStop(0.28, '#414e62');
    g3.addColorStop(0.55, '#586780');
    g3.addColorStop(1, '#151a24');
    ctx.fillStyle = g3;
    ctx.beginPath(); ctx.roundRect(cx - pw/2, pilTop, pw, ph, 4); ctx.fill();
    /* 柱身凹槽 */
    ctx.strokeStyle = 'rgba(8,12,20,0.55)';
    ctx.lineWidth = 1.6;
    for(let i = 0; i < 3; i++){
      ctx.beginPath();
      ctx.moveTo(cx - 6.2 + i * 6.2, pilTop + 16);
      ctx.lineTo(cx - 6.2 + i * 6.2, baseY - 26);
      ctx.stroke();
    }
    /* 柱身符文竖线 */
    const runeY = pilTop + 26 + ((t * 22) % Math.max(1, ph - 50));
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(140,235,255,0.9)';
    ctx.shadowColor = '#5ec8ff'; ctx.shadowBlur = 12;
    ctx.beginPath(); ctx.roundRect(cx - 3, runeY, 6, 16, 3); ctx.fill();
    ctx.restore();
    /* 柱头 */
    ctx.fillStyle = '#6a7a94';
    ctx.beginPath(); ctx.roundRect(cx - pw/2 - 5, pilTop - 11, pw + 10, 14, 3); ctx.fill();
    ctx.fillStyle = '#8496b0';
    ctx.beginPath(); ctx.roundRect(cx - pw/2 - 3, pilTop - 18, pw + 6, 8, 2); ctx.fill();
    /* 柱础 */
    ctx.fillStyle = '#4d5a70';
    ctx.beginPath(); ctx.roundRect(cx - pw/2 - 6, baseY - 32, pw + 12, 14, 3); ctx.fill();

    /* 火炬盆 */
    const fy = pilTop - 24;
    ctx.fillStyle = '#3d4859';
    ctx.beginPath();
    ctx.moveTo(cx - 11, fy); ctx.lineTo(cx + 11, fy);
    ctx.lineTo(cx + 7, fy + 9); ctx.lineTo(cx - 7, fy + 9);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#64738c';
    ctx.beginPath(); ctx.roundRect(cx - 12, fy - 3, 24, 4, 1.5); ctx.fill();
    /* 火苗 */
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const fh = (13 + Math.sin(t * 8 + cx) * 3.2) * br;
    const fg = ctx.createRadialGradient(cx, fy - fh * 0.5, 0, cx, fy - fh * 0.5, fh * 1.5);
    fg.addColorStop(0, 'rgba(255,255,255,0.95)');
    fg.addColorStop(0.3, 'rgba(255,230,150,0.85)');
    fg.addColorStop(0.6, 'rgba(255,140,60,0.55)');
    fg.addColorStop(1, 'rgba(255,90,30,0)');
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.ellipse(cx, fy - fh * 0.5, fh * 0.52, fh * 1.05, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  };
  ctx.save();
  ctx.globalAlpha = ease;
  if(pilX > 10){
    drawPillar(x - pilX, 1);
    drawPillar(x + pilX, -1);
  }
  ctx.restore();

  /* ================= ⑥ 拱券 ================= */
  if(rw > 12){
    ctx.save();
    ctx.globalAlpha = ease;
    ctx.lineCap = 'round';
    /* 外圈深石 */
    ctx.strokeStyle = '#1b2230';
    ctx.lineWidth = 22;
    ctx.beginPath();
    ctx.ellipse(x, ay, rw + 22, rh + 20, 0, Math.PI * 1.02, Math.PI * 1.98);
    ctx.stroke();
    /* 主体 */
    ctx.strokeStyle = '#4a576c';
    ctx.lineWidth = 18;
    ctx.beginPath();
    ctx.ellipse(x, ay, rw + 22, rh + 20, 0, Math.PI * 1.02, Math.PI * 1.98);
    ctx.stroke();
    /* 内高光 */
    ctx.strokeStyle = 'rgba(150,175,205,0.55)';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.ellipse(x, ay, rw + 13, rh + 11, 0, Math.PI * 1.04, Math.PI * 1.96);
    ctx.stroke();

    /* 拱石分块 */
    ctx.strokeStyle = 'rgba(12,18,26,0.62)';
    ctx.lineWidth = 1.6;
    for(let i = 0; i <= 8; i++){
      const a = Math.PI * 1.02 + (Math.PI * 0.96) * (i / 8);
      const c = Math.cos(a), s2 = Math.sin(a);
      ctx.beginPath();
      ctx.moveTo(x + c * (rw + 15), ay + s2 * (rh + 13));
      ctx.lineTo(x + c * (rw + 30), ay + s2 * (rh + 27));
      ctx.stroke();
    }

    /* 拱心石 + 宝石 */
    const ksY = ay - rh - 20;
    ctx.fillStyle = '#64738c';
    ctx.beginPath();
    ctx.moveTo(x - 13, ksY + 4);
    ctx.lineTo(x + 13, ksY + 4);
    ctx.lineTo(x + 9, ksY - 22);
    ctx.lineTo(x - 9, ksY - 22);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(12,18,26,0.7)'; ctx.lineWidth = 1.4; ctx.stroke();
    /* 宝石 */
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const gemR = 5 + Math.sin(t * 4.2) * 1.4;
    const gemG = ctx.createRadialGradient(x, ksY - 9, 0, x, ksY - 9, gemR * 3.4);
    gemG.addColorStop(0, 'rgba(255,255,255,0.98)');
    gemG.addColorStop(0.3, 'rgba(170,240,255,0.8)');
    gemG.addColorStop(1, 'rgba(90,190,255,0)');
    ctx.fillStyle = gemG;
    ctx.beginPath(); ctx.arc(x, ksY - 9, gemR * 3.4, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.restore();
  }

  /* ================= ⑦ 上升光粒 ================= */
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const nP = Math.round(16 * ease);
  for(let i = 0; i < nP; i++){
    const ph = (t * 0.36 + i * 0.0625) % 1;
    const sway = Math.sin(i * 2.7 + t * 1.6) * (10 + (i % 4) * 6);
    const py = baseY - 12 - ph * 250;
    const px = x + sway * (1 - ph * 0.5);
    ctx.globalAlpha = (1 - ph) * 0.9 * ease;
    ctx.fillStyle = i % 3 === 0 ? '#ffffff' : '#a9e8ff';
    ctx.beginPath(); ctx.arc(px, py, 1.4 + (1 - ph) * 2.3, 0, TAU); ctx.fill();
  }
  ctx.restore();

  /* ================= ⑧ 悬浮铭牌 ================= */
  if(ease > 0.40){
    const labelY = ay - rh - 76;
    const aL = Math.min(1, (ease - 0.40) / 0.6) * (0.78 + Math.sin(t * 3.6) * 0.22);
    ctx.save();
    ctx.globalAlpha = aL;
    ctx.font = 'bold 15px "Microsoft YaHei"';
    const txt = '进入下一区域';
    const tw = ctx.measureText(txt).width;
    const bx = x - tw/2 - 20, by = labelY - 17, bw = tw + 40, bh = 25;
    /* 牌底 */
    const pg = ctx.createLinearGradient(0, by, 0, by + bh);
    pg.addColorStop(0, 'rgba(12,26,48,0.92)');
    pg.addColorStop(1, 'rgba(6,14,28,0.92)');
    ctx.fillStyle = pg;
    ctx.strokeStyle = 'rgba(150,225,255,0.65)';
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 5); ctx.fill(); ctx.stroke();
    /* 内描边 */
    ctx.strokeStyle = 'rgba(150,225,255,0.22)';
    ctx.beginPath(); ctx.roundRect(bx + 3, by + 3, bw - 6, bh - 6, 3); ctx.stroke();
    /* 左右流光箭头 */
    ctx.fillStyle = 'rgba(170,235,255,0.95)';
    for(let k = 0; k < 2; k++){
      const dir = k ? 1 : -1;
      const ax2 = x + dir * (bw/2 - 4) - dir * ((t * 26) % 12);
      ctx.globalAlpha = aL * (0.35 + 0.65 * Math.abs(Math.sin(t * 2.4 + k * 2)));
      ctx.beginPath();
      ctx.moveTo(ax2 + dir * 4, labelY - 3);
      ctx.lineTo(ax2 - dir * 1, labelY + 1);
      ctx.lineTo(ax2 + dir * 4, labelY + 5);
      ctx.closePath(); ctx.fill();
    }
    ctx.globalAlpha = aL;
    ctx.fillStyle = '#e2f9ff';
    ctx.shadowColor = 'rgba(120,220,255,0.9)';
    ctx.shadowBlur = 10;
    ctx.fillText(txt, x, labelY + 5);
    ctx.restore();
  }

  ctx.restore();
}

/* ============================================================
   ★ DNF 式房间小地图（右上角）
   ============================================================ */
function drawRoomMinimap(){
  if(!G || G.isPvp || gameState !== 'playing') return;
  const total = G.roomTotal || ROOM_TOTAL;
  const cur = G.roomIdx || 0;
  const nodeW = 46, nodeH = 30, gap = 16;
  const totalW = total * nodeW + (total - 1) * gap;
  const x0 = 26, y0 = 28;

  ctx.save();
  /* 底板 */
  ctx.fillStyle = 'rgba(10,14,24,0.82)';
  ctx.strokeStyle = 'rgba(201,168,76,0.55)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.roundRect(x0 - 10, y0 - 8, totalW + 20, nodeH + 16, 5); ctx.fill(); ctx.stroke();

  for(let i = 0; i < total; i++){
    const nx = x0 + i * (nodeW + gap);
    const ny = y0;
    const isBoss = (i === total - 1);
    const done = i < cur || (i === cur && G.waveState === 'cleared');
    const nowRoom = (i === cur) && G.waveState !== 'cleared';

    /* 连接线 */
    if(i < total - 1){
      ctx.strokeStyle = done ? 'rgba(120,220,160,0.8)' : 'rgba(90,100,120,0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(nx + nodeW, ny + nodeH/2);
      ctx.lineTo(nx + nodeW + gap, ny + nodeH/2);
      ctx.stroke();
    }

    /* 房间格 */
    let fill = 'rgba(40,46,62,0.9)', border = 'rgba(120,130,150,0.6)';
    if(isBoss){ fill = 'rgba(70,20,24,0.9)'; border = 'rgba(230,90,80,0.85)'; }
    if(done){ fill = 'rgba(24,58,40,0.92)'; border = 'rgba(90,220,150,0.9)'; }
    if(nowRoom){
      const pulse = 0.6 + Math.sin((G.t || 0) * 4) * 0.4;
      fill = isBoss ? 'rgba(120,30,30,0.95)' : 'rgba(90,72,20,0.95)';
      border = isBoss ? 'rgba(255,120,100,' + (0.6 + pulse * 0.4) + ')'
                      : 'rgba(255,209,102,' + (0.6 + pulse * 0.4) + ')';
    }
    ctx.fillStyle = fill;
    ctx.strokeStyle = border;
    ctx.lineWidth = nowRoom ? 2 : 1;
    ctx.beginPath(); ctx.roundRect(nx, ny, nodeW, nodeH, 3); ctx.fill(); ctx.stroke();

    /* 图标 */
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 13px "Microsoft YaHei"';
    if(done){
      ctx.fillStyle = '#7ef0b0';
      ctx.fillText('✓', nx + nodeW/2, ny + nodeH/2 + 1);
    } else if(isBoss){
      ctx.fillStyle = nowRoom ? '#ffb0a0' : '#e2605a';
      ctx.fillText('☠', nx + nodeW/2, ny + nodeH/2 + 1);
    } else {
      ctx.fillStyle = nowRoom ? '#ffd166' : '#7b8798';
      ctx.fillText(String(i + 1), nx + nodeW/2, ny + nodeH/2 + 1);
    }
    ctx.textBaseline = 'alphabetic';
  }

  /* 标题 */
  ctx.textAlign = 'right';
  ctx.font = 'bold 11px "Microsoft YaHei"';
  ctx.fillStyle = 'rgba(201,168,76,0.95)';
  ctx.fillText('地下城 · 房间 ' + Math.min(cur + 1, total) + '/' + total, x0 + totalW, y0 - 12);
  ctx.restore();
}

function drawBottomUI(){
  if(!G || !G.player) return;
  const p = G.player, w = WEAPONS[p.weaponIdx];
  const panelH = 52, panelY = VH-panelH;
  
  /* ★ 战斗界面左侧背包按钮 */
  const bagBtnX = 40, bagBtnY = VH / 2;
  const bagBtnSize = 40;
  ctx.fillStyle = 'rgba(100,150,255,0.7)';
  ctx.beginPath();
  ctx.arc(bagBtnX, bagBtnY, bagBtnSize/2, 0, Math.PI*2);
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 11px "Microsoft YaHei"';
  ctx.textAlign = 'center';
  ctx.fillText('背包', bagBtnX, bagBtnY + 4);
  
  ctx.fillStyle = 'rgba(5,10,20,0.85)';
  ctx.fillRect(0,panelY,VW,panelH);
  ctx.strokeStyle = 'rgba(100,180,255,0.3)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0,panelY); ctx.lineTo(VW,panelY); ctx.stroke();
  if(G.isPvp){
    drawPvpSideUI(p, w, 'left', panelY, panelH);
    if(G.player2){
      const w2 = WEAPONS[G.player2.weaponIdx];
      drawPvpSideUI(G.player2, w2, 'right', panelY, panelH);
    }
    ctx.textAlign = 'center'; ctx.fillStyle = '#ffd166'; ctx.font = 'bold 20px "Microsoft YaHei"';
    ctx.fillText('VS', VW/2, panelY+32);
  } else {
    const barX = 220, barW = 200, barH = 14, barGap = 4;
    const hpY = panelY+8, mpY = hpY+barH+barGap;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath(); ctx.roundRect(barX,hpY,barW,barH,3); ctx.fill();
    /* ★ 改进2: 血条延迟效果 - 先画延迟条(红色) */
    const damageHpR = clamp((p.damageHp||p.hp)/p.maxHp, 0, 1);
    ctx.fillStyle = '#ff3333'; ctx.fillRect(barX, hpY, barW*damageHpR, barH);
    /* 再画当前血量(绿色渐变) */
    const displayHpR = clamp((p.displayHp||p.hp)/p.maxHp, 0, 1);
    const hpGrad = ctx.createLinearGradient(barX, hpY, barX + barW * displayHpR, hpY);
    hpGrad.addColorStop(0, '#2ee6a8');
    hpGrad.addColorStop(1, '#7ed6ff');
    ctx.fillStyle = hpGrad; ctx.fillRect(barX, hpY, barW*displayHpR, barH);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 11px "Microsoft YaHei"'; ctx.textAlign = 'center';
    ctx.fillText(`气血 ${Math.ceil(p.hp)} / ${p.maxHp}`, barX+barW/2, hpY+11);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath(); ctx.roundRect(barX,mpY,barW,barH,3); ctx.fill();
    const mpR = clamp(p.mp/p.maxMp, 0, 1);
    ctx.fillStyle = '#2196F3'; ctx.fillRect(barX, mpY, barW*mpR, barH);
    ctx.fillStyle = '#fff'; ctx.fillText(`内力 ${Math.ceil(p.mp)} / ${p.maxMp}`, barX+barW/2, mpY+11);
    /* ★ 经验条（替代体力条） */
    const stY = mpY+barH+barGap;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath(); ctx.roundRect(barX,stY,barW,barH*0.7,3); ctx.fill();
    const expNeed = getExpNeed(p.level);
    const expR = clamp((p.exp||0)/expNeed, 0, 1);
    ctx.fillStyle = '#9fe6ff'; ctx.fillRect(barX, stY, barW*expR, barH*0.7);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 9px "Microsoft YaHei"';
    ctx.fillText(`经验 ${Math.floor(p.exp||0)}/${expNeed}`, barX+barW/2, stY+8);
    const infoX = barX+barW+30;
    ctx.textAlign = 'left'; ctx.fillStyle = '#ffe066'; ctx.font = 'bold 16px "Microsoft YaHei"';
    ctx.fillText(`Lv.${p.level}`, infoX, panelY+18);
    ctx.fillStyle = '#aaa'; ctx.font = '12px "Microsoft YaHei"';
    ctx.fillText(`经验 ${p.exp}/${p.expNext}`, infoX, panelY+36);
    /* ★ 金币与关卡显示 */
    ctx.fillStyle = '#ffd700'; ctx.font = 'bold 12px "Microsoft YaHei"';
    ctx.fillText(`金币 ${p.gold||0}`, infoX, panelY+54);
    ctx.fillStyle = '#88ccff'; ctx.font = '11px "Microsoft YaHei"';
    ctx.fillText(`第 ${(G.levelIdx||0)+1} 关`, infoX, panelY+70);
    
    /* ★ 装备状态显示 */
    if(p.equipment && p.equipment.weapon){
      const eq = p.equipment.weapon;
      ctx.fillStyle = eq.tierColor || '#fff'; ctx.font = 'bold 11px "Microsoft YaHei"';
      ctx.fillText(`${eq.name} +${eq.enhance||0}`, infoX+120, panelY+18);
    }
    const wepX = infoX+200;
    ctx.fillStyle = w.color; ctx.font = 'bold 14px "Microsoft YaHei"';
    ctx.fillText(w.name, wepX, panelY+18);
    ctx.fillStyle = '#999'; ctx.font = '11px "Microsoft YaHei"';
    ctx.fillText(`攻击 ${Math.round(playerAtk())}`, wepX, panelY+36);
    const skillBaseX = VW-478;
    ctx.textAlign = 'center';
    for(let i=0;i<6;i++){
      const sk = w.skills[i];
      if(!sk) continue;
      /* ★ 只显示已领悟的技能（未学的槽位不出现，按键保留） */
      if(!(p.skillsUnlocked && p.skillsUnlocked[i])) continue;
      const sx = skillBaseX+i*78, cd = p.cds[i] || 0;
      const awake = i >= 3;
      ctx.fillStyle = cd>0 ? 'rgba(30,30,30,0.9)' : (awake ? 'rgba(70,45,20,0.92)' : 'rgba(40,60,90,0.9)');
      ctx.beginPath(); ctx.roundRect(sx, panelY+5, 72, panelH-10, 5); ctx.fill();
      ctx.strokeStyle = cd>0 ? 'rgba(100,100,100,0.5)' : (awake ? '#ffb84d' : w.color);
      ctx.lineWidth = awake && cd<=0 ? 2 : 1.5; ctx.stroke();
      ctx.fillStyle = cd>0 ? '#666' : (awake ? '#ffd88a' : '#fff');
      ctx.font = 'bold 10px "Microsoft YaHei"';
      const nm = sk.name.length > 5 ? sk.name.slice(0,5) : sk.name;
      ctx.fillText(nm, sx+36, panelY+22);
      ctx.font = '9px "Microsoft YaHei"';
      if(cd>0){ ctx.fillStyle = '#ff6a4a'; ctx.fillText(`冷却 ${cd.toFixed(1)}s`, sx+36, panelY+38); }
      else { ctx.fillStyle = '#7fd4ff'; ctx.fillText(`MP ${sk.cost}`, sx+36, panelY+38); }
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.font = 'bold 10px "Microsoft YaHei"';
      ctx.fillText(String(i+1), sx+10, panelY+panelH-12);
    }
  }
}
function drawPvpSideUI(pl, w, side, panelY, panelH){
  const isLeft = side==='left';
  const plColor = isLeft?'#5ee7ff':'#ff6a5a';
  const barW = 140, barH = 12;
  const barX = isLeft?100:VW-100-barW;
  const hpY = panelY+6, mpY = hpY+barH+3;
  ctx.textAlign = isLeft?'left':'right';
  ctx.fillStyle = plColor; ctx.font = 'bold 13px "Microsoft YaHei"';
  ctx.fillText(isLeft?'P1':'P2', isLeft?barX:barX+barW, panelY+panelH-4);
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.beginPath(); ctx.roundRect(barX,hpY,barW,barH,3); ctx.fill();
  ctx.fillStyle = '#e63946';
  ctx.fillRect(barX, hpY, barW*clamp(pl.hp/pl.maxHp,0,1), barH);
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.beginPath(); ctx.roundRect(barX,mpY,barW,barH,3); ctx.fill();
  ctx.fillStyle = '#64B5F6';
  ctx.fillRect(barX, mpY, barW*clamp(pl.mp/pl.maxMp,0,1), barH);
  const wepX = isLeft?barX+barW+12:barX-12;
  ctx.textAlign = isLeft?'left':'right';
  ctx.fillStyle = w.color; ctx.font = 'bold 12px "Microsoft YaHei"';
  ctx.fillText(w.name, wepX, panelY+16);
  const skillR = 18, skillGap = 46, skillCY = panelY+panelH/2;
  const entry = (i)=>getSkillIconImage(w.id, i);
  for(let i=0;i<3;i++){
    const cx = isLeft ? barX+barW+120+i*skillGap : barX-120-i*skillGap;
    const cd = pl.cds[i], sk = w.skills[i], ic = entry(i);
    if(cd > 0){
      ctx.fillStyle = 'rgba(18,20,26,0.92)';
      ctx.beginPath(); ctx.arc(cx, skillCY, skillR, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(230,230,240,0.85)';
      ctx.font = 'bold 12px "Microsoft YaHei"'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(cd.toFixed(1), cx, skillCY);
    } else {
      ctx.fillStyle = hexToRgba(w.color, 0.7);
      ctx.beginPath(); ctx.arc(cx, skillCY, skillR, 0, TAU); ctx.fill();
      if(skillIconReady(ic)) ctx.drawImage(ic.img, cx-skillR*0.72, skillCY-skillR*0.72, skillR*1.44, skillR*1.44);
    }
  }
}

/* ★ 改进1: BOSS顶部大血条 */
function drawBossHealthBar(){
  if(!G || G.isPvp) return;
  const boss = G.enemies.find(e => e.alive && e.def && e.def.boss);
  if(!boss) return;
  
  const barW = VW * 0.5, barH = 18;
  const barX = (VW - barW) / 2, barY = 25;
  
  // BOSS名字
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ff6a4a';
  ctx.font = 'bold 16px "Microsoft YaHei"';
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(0,0,0,0.8)';
  ctx.strokeText(boss.def.name, VW/2, barY - 8);
  ctx.fillText(boss.def.name, VW/2, barY - 8);
  
  // 血条背景
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.beginPath();
  ctx.roundRect(barX - 2, barY - 2, barW + 4, barH + 4, 4);
  ctx.fill();
  
  // 血条渐变
  const hpRatio = clamp(boss.hp / boss.maxHp, 0, 1);
  const grad = ctx.createLinearGradient(barX, 0, barX + barW * hpRatio, 0);
  grad.addColorStop(0, '#ff2222');
  grad.addColorStop(0.5, '#ff6600');
  grad.addColorStop(1, '#ff2222');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.roundRect(barX, barY, barW * hpRatio, barH, 3);
  ctx.fill();
  
  // 边框
  ctx.strokeStyle = '#c9a84c';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(barX, barY, barW, barH, 3);
  ctx.stroke();
  
  // HP数值
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 11px "Microsoft YaHei"';
  ctx.fillText(`${Math.ceil(boss.hp)} / ${boss.maxHp}`, VW/2, barY + 13);
}

function drawUI(){
  if(!G || !G.player) return;
  /* ★ 主线任务追踪 HUD（左上） */
  drawQuestTracker(18, 14);
  if(!G.isPvp){
    const lvlIdx = G.levelIdx || 0;
    const lvl = getLevelConfig(lvlIdx);
    const waveIdx = G.waveIdx || 0;
    ctx.textAlign = 'right'; ctx.fillStyle = '#fff'; ctx.font = 'bold 20px "Microsoft YaHei"';
    if(lvl){
      ctx.fillText(lvl.name, VW-30, 36);
      ctx.font = '14px "Microsoft YaHei"'; ctx.fillStyle = '#aaa';
      const waveLabel = waveIdx < 3 ? `第 ${waveIdx+1}/3 波` : 'BOSS战';
      ctx.fillText(waveLabel, VW-30, 56);
    } else {
      ctx.fillText('全部通关！', VW-30, 40);
    }
    ctx.font = '14px "Microsoft YaHei"'; ctx.fillStyle = '#aaa';
    ctx.fillText(`击杀 ${G.totalKills}`, VW-30, 76);
  }
  if(G.combo > 1){
    ctx.fillStyle = '#ffd166'; ctx.font = 'bold 48px "Microsoft YaHei"'; ctx.textAlign = 'right';
    ctx.fillText(G.combo, VW-50, 150);
    ctx.font = 'bold 20px "Microsoft YaHei"'; ctx.fillText('连击', VW-50, 180);
  }
  /* 横幅提示 */
  if(G.bannerTimer > 0 && G.bannerText){
    const alpha = Math.min(1, G.bannerTimer * 2);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(VW/2-300, VH*0.22-30, 600, 60);
    const isBoss = G.bannerText.indexOf('BOSS') >= 0;
    ctx.fillStyle = isBoss ? '#ff6a4a' : '#ffe066';
    ctx.font = isBoss ? 'bold 32px "Microsoft YaHei"' : 'bold 26px "Microsoft YaHei"';
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,0.8)';
    ctx.strokeText(G.bannerText, VW/2, VH*0.22+8);
    ctx.fillText(G.bannerText, VW/2, VH*0.22+8);
    ctx.restore();
  }
  /* ★ 改进1: 绘制BOSS血条 */
  drawBossHealthBar();
}

function drawTexts(){
  ctx.save(); ctx.textAlign = 'center';
  for(const t of G.texts){
    ctx.globalAlpha = clamp((1-t.t/t.dur)*1.6, 0, 1);
    ctx.font = `bold ${t.size}px "Microsoft YaHei"`;
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,0.75)';
    ctx.strokeText(t.text, t.x, t.y-t.h);
    ctx.fillStyle = t.color;
    ctx.fillText(t.text, t.x, t.y-t.h);
  }
  ctx.restore();
}

function drawMenu(){
  drawSky(); drawFarScenery(); drawGround();
  ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillRect(0,0,VW,VH);
  menuClickRegions = [];
  
  /* ★ 主菜单角色立绘：8 位行者分列两侧 */
  const t = performance.now() * 0.001;
  const charPositions = [
    { x: 112, y: 512, weaponIdx: 0 },
    { x: 214, y: 548, weaponIdx: 1 },
    { x: 316, y: 524, weaponIdx: 2 },
    { x: 108, y: 626, weaponIdx: 3 },
    { x: 214, y: 654, weaponIdx: 4 },
    { x: VW - 112, y: 512, weaponIdx: 5 },
    { x: VW - 214, y: 548, weaponIdx: 6 },
    { x: VW - 316, y: 524, weaponIdx: 7 }
  ];
  
  for(const pos of charPositions){
    const at = CHAR_ATLASES[WEAPONS[pos.weaponIdx] ? WEAPONS[pos.weaponIdx].id : 'sword'];
    if(at && at.ready){
      const bodyPx = 150 * (at.bodyWorld / 110);
      const prog = (t * 0.32 + pos.weaponIdx * 0.11) % 1;
      ctx.save();
      ctx.globalAlpha = 0.62;
      drawSpriteFrame(at, 'idle', prog, pos.x, pos.y, pos.x < VW/2 ? 1 : -1, bodyPx);
      ctx.restore();
    }
  }
  
  ctx.textAlign = 'center';
  ctx.fillStyle = '#9fe6ff'; ctx.font = 'bold 64px "Microsoft YaHei"';
  ctx.shadowColor = '#9fe6ff';
  ctx.shadowBlur = 20;
  ctx.fillText('无尽侠客', VW/2, 140);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#fff'; ctx.font = '24px "Microsoft YaHei"';
  ctx.fillText('选择你的职业，开启冒险之旅', VW/2, 180);

  /* 三个功能按钮：单人冒险 / 双人PK / 开始 */
  const btnW = 260, btnH = 60, gap = 24;
  const totalH = btnH*3 + gap*2;
  let by = VH/2 - totalH/2;
  const bx = VW/2 - btnW/2;

  const buttons = [
    { id:'single', label:'单人冒险', desc:'城镇刷图 · 装备成长', color:'#3cb478' },
    { id:'pvp',    label:'双人PK',   desc:'本地对战 · 1级平衡', color:'#3c78b4' },
    { id:'start',  label:'开始',     desc:'新的冒险旅程',         color:'#b4783c' }
  ];

  const pulse = 0.8+Math.sin(performance.now()*0.004)*0.2;

  for(let i=0;i<buttons.length;i++){
    const b = buttons[i];
    const sel = (menuSelection === i);
    const y = by + i*(btnH+gap);

    ctx.fillStyle = sel ? b.color : 'rgba(40,40,60,0.7)';
    ctx.beginPath(); ctx.roundRect(bx, y, btnW, btnH, 12); ctx.fill();
    ctx.strokeStyle = sel ? '#fff' : 'rgba(120,120,140,0.5)';
    ctx.lineWidth = sel ? 3 : 1.5;
    ctx.stroke();

    ctx.fillStyle = '#fff'; ctx.font = 'bold 26px "Microsoft YaHei"';
    ctx.fillText(b.label, VW/2, y + 30);
    ctx.fillStyle = sel ? 'rgba(255,255,255,0.85)' : '#888';
    ctx.font = '13px "Microsoft YaHei"';
    ctx.fillText(b.desc, VW/2, y + 50);

    menuClickRegions.push({id:b.id, x:bx, y:y, w:btnW, h:btnH});
  }

  ctx.fillStyle = '#666'; ctx.font = '16px "Microsoft YaHei"';
  ctx.fillText('W/S选择 · 回车确认', VW/2, VH-40);
}
function drawPvpSelect(){
  drawSky(); drawFarScenery(); drawGround();
  ctx.fillStyle = 'rgba(0,0,0,0.82)'; ctx.fillRect(0,0,VW,VH);
  pvpSelectClickRegions = [];
  ctx.textAlign = 'center'; ctx.fillStyle = '#ffd166'; ctx.font = 'bold 32px "Microsoft YaHei"';
  ctx.fillText(pvpState==='select1'?'玩家1 选择职业':'玩家2 选择职业', VW/2, 58);

  const cardW = 236, cardH = 232, gapX = 16, gapY = 14;
  const totalW = cardW*4 + gapX*3;
  const startX = VW/2 - totalW/2, startY = 92;

  for(let i=0;i<CHARACTERS.length;i++){
    const ch = CHARACTERS[i];
    const w = WEAPONS[ch.weaponIdx], b = PVP_BALANCE[w.id];
    const col = i % 4, row = Math.floor(i / 4);
    const sx = startX + col*(cardW+gapX), sy = startY + row*(cardH+gapY);
    const sel = (pvpState==='select1'&&pvpSelect[0]===ch.weaponIdx)||(pvpState==='select2'&&pvpSelect[1]===ch.weaponIdx);
    ctx.fillStyle = sel?'rgba(60,120,200,0.45)':'rgba(20,20,30,0.66)';
    ctx.beginPath(); ctx.roundRect(sx,sy,cardW,cardH,9); ctx.fill();
    ctx.strokeStyle = sel?ch.color:'rgba(80,80,100,0.45)'; ctx.lineWidth = sel?3:1.2;
    ctx.beginPath(); ctx.roundRect(sx,sy,cardW,cardH,9); ctx.stroke();

    /* 立绘 */
    const at = CHAR_ATLASES[w.id];
    const feetY = sy + 116;
    if(at && at.ready){
      const _t = G ? G.t : performance.now()*0.001;
      drawCharCardSprite(ch.weaponIdx, sx+cardW/2, feetY, 120*((at.bodyWorld||110)/110), _t*0.34 + i*0.05);
    }
    ctx.textAlign = 'center';
    ctx.fillStyle = ch.color; ctx.font = 'bold 20px "Microsoft YaHei"';
    ctx.fillText(ch.name, sx+cardW/2, sy+146);
    ctx.fillStyle = '#b8c6d4'; ctx.font = '11px "Microsoft YaHei"';
    ctx.fillText(w.name + ' · ' + (b?b.desc:'均衡'), sx+cardW/2, sy+164);
    /* 血量 / 攻击 */
    ctx.fillStyle = '#8fa6b8'; ctx.font = '10px "Microsoft YaHei"';
    ctx.fillText('生命 ' + (b?b.hp:'-') + '　攻击 ' + (b?b.atk:'-') + '　速度 ' + (b?b.spd:'-'), sx+cardW/2, sy+184);
    /* 六技能点阵 */
    for(let k=0;k<6;k++){
      const bx = sx + cardW/2 - 52 + k*18;
      ctx.fillStyle = k < 2 ? ch.color : hexA(ch.color, 0.35);
      ctx.beginPath(); ctx.arc(bx, sy+204, 4, 0, TAU); ctx.fill();
    }
    pvpSelectClickRegions.push({id:'weapon', index:ch.weaponIdx, x:sx, y:sy, w:cardW, h:cardH});
  }

  ctx.textAlign = 'center';
  const btnY = 596, btnW = 220, btnH = 50, btnX = VW/2-btnW/2;
  const pulse = 0.8+Math.sin(performance.now()*0.004)*0.2;
  ctx.fillStyle = `rgba(60,180,120,${0.5*pulse})`;
  ctx.beginPath(); ctx.roundRect(btnX,btnY,btnW,btnH,10); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 22px "Microsoft YaHei"';
  ctx.fillText(pvpState==='select1'?'确认选择':'开始战斗！', VW/2, btnY+33);
  pvpSelectClickRegions.push({id: pvpState==='select1'?'confirm':'fight', x:btnX, y:btnY, w:btnW, h:btnH});
}

function drawCharSelect(){
  drawSky(); drawFarScenery(); drawGround();
  ctx.fillStyle = 'rgba(0,0,0,0.86)'; ctx.fillRect(0,0,VW,VH);
  charSelectClickRegions = [];
  
  const isPvp = charSelectState.phase === 'pvp';
  const step = charSelectState.step;
  const title = isPvp ? (step===0 ? '玩家1 选择角色' : '玩家2 选择角色') : '选择角色';
  
  ctx.textAlign = 'center'; ctx.fillStyle = '#ffd166'; ctx.font = 'bold 34px "Microsoft YaHei"';
  ctx.fillText(title, VW/2, 52);
  ctx.fillStyle = '#7f93a8'; ctx.font = '13px "Microsoft YaHei"';
  ctx.fillText('八位行者，八条通往墟巅的路', VW/2, 74);
  
  if(isPvp && step===1){
    ctx.fillStyle = '#aaa'; ctx.font = '14px "Microsoft YaHei"';
    ctx.fillText(`玩家1已选择：${CHARACTERS[charSelectState.selections[0]].name}`, VW/2, 92);
  }
  
  /* ★ 8 职业：2 行 × 4 列 */
  const COLS = 4, cardW = 228, cardH = 246, gapX = 18, gapY = 12;
  const totalW = cardW * COLS + gapX * (COLS - 1);
  const startX = VW/2 - totalW/2;
  const startY = isPvp && step === 1 ? 104 : 88;
  
  for(let i=0;i<CHARACTERS.length;i++){
    const char = CHARACTERS[i];
    const weapon = WEAPONS[char.weaponIdx];
    const col = i % COLS, row = Math.floor(i / COLS);
    const cx = startX + col * (cardW + gapX);
    const cy = startY + row * (cardH + gapY);
    const sel = charSelectState.selections[step] === i;
    
    ctx.fillStyle = sel ? 'rgba(52,104,168,0.62)' : 'rgba(18,18,28,0.72)';
    ctx.beginPath(); ctx.roundRect(cx, cy, cardW, cardH, 10); ctx.fill();
    ctx.strokeStyle = sel ? char.color : 'rgba(80,80,100,0.45)';
    ctx.lineWidth = sel ? 3 : 1.4;
    ctx.beginPath(); ctx.roundRect(cx, cy, cardW, cardH, 10); ctx.stroke();
    if(sel){
      ctx.save();
      ctx.shadowColor = char.color; ctx.shadowBlur = 16;
      ctx.strokeStyle = hexA(char.color, 0.8); ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.roundRect(cx-2, cy-2, cardW+4, cardH+4, 11); ctx.stroke();
      ctx.restore();
    }
    
    /* 立绘区 */
    const previewX = cx + cardW/2;
    const feetY = cy + 122;
    ctx.save();
    ctx.beginPath(); ctx.roundRect(cx+1, cy+1, cardW-2, 138, 9); ctx.clip();
    const glow = ctx.createRadialGradient(previewX, feetY-52, 5, previewX, feetY-52, 96);
    glow.addColorStop(0, hexA(char.color, sel ? 0.26 : 0.12));
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow; ctx.fillRect(cx, cy, cardW, 140);
    ctx.fillStyle = 'rgba(0,0,0,0.38)';
    ctx.beginPath(); ctx.ellipse(previewX, feetY+3, 44, 8, 0, 0, TAU); ctx.fill();
    ctx.restore();
    
    const at = CHAR_ATLASES[weapon.id];
    const bodyPx = 128 * ((at ? at.bodyWorld : 110) / 110);
    let drawn = false;
    if(at && at.ready){
      const _selT = G ? G.t : performance.now()*0.001;
      drawCharCardSprite(char.weaponIdx, previewX, feetY, bodyPx, (_selT * 0.34 + i * 0.07));
      drawn = true;
    }
    if(!drawn){
      ctx.save();
      ctx.translate(previewX, cy + 64); ctx.scale(1.12, 1.12);
      drawCharPreview(char, weapon);
      ctx.restore();
    }
    
    /* 名称 */
    ctx.textAlign = 'center';
    ctx.fillStyle = char.color; ctx.font = 'bold 21px "Microsoft YaHei"';
    ctx.fillText(char.name, cx+cardW/2, cy+156);
    ctx.fillStyle = '#b8c6d4'; ctx.font = '11px "Microsoft YaHei"';
    ctx.fillText(char.title + ' · ' + weapon.name, cx+cardW/2, cy+173);
    ctx.fillStyle = '#8398aa'; ctx.font = '10px "Microsoft YaHei"';
    ctx.fillText(char.desc, cx+cardW/2, cy+189);
    
    /* 四维条 2×2 */
    const stats = [
      ['生命', char.hp/175, '#2ee6a8'],
      ['内力', char.mp/110, '#c96bff'],
      ['攻击', char.atk/16, '#ff6a4a'],
      ['速度', char.spd/300, '#ffd96a']
    ];
    for(let si=0; si<4; si++){
      const [label, ratio, color] = stats[si];
      const gx = cx + 14 + (si % 2) * 104;
      const gy = cy + 200 + Math.floor(si / 2) * 20;
      ctx.textAlign = 'left';
      ctx.fillStyle = '#7f93a5'; ctx.font = '9px "Microsoft YaHei"';
      ctx.fillText(label, gx, gy + 7);
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(gx + 22, gy + 1, 66, 5);
      const grd = ctx.createLinearGradient(gx + 22, 0, gx + 88, 0);
      grd.addColorStop(0, color); grd.addColorStop(1, 'rgba(255,255,255,0.85)');
      ctx.fillStyle = grd;
      ctx.fillRect(gx + 22, gy + 1, 66 * clamp(ratio, 0, 1), 5);
    }
    
    charSelectClickRegions.push({id:'char', index:i, x:cx, y:cy, w:cardW, h:cardH});
  }
  
  /* 确认按钮 */
  ctx.textAlign = 'center';
  const btnY = 632, btnW = 240, btnH = 48, btnX = VW/2-btnW/2;
  const pulse = 0.8+Math.sin(performance.now()*0.004)*0.2;
  ctx.fillStyle = `rgba(60,180,120,${0.5*pulse})`;
  ctx.beginPath(); ctx.roundRect(btnX, btnY, btnW, btnH, 10); ctx.fill();
  ctx.strokeStyle = `rgba(100,255,150,${0.6*pulse})`; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(btnX, btnY, btnW, btnH, 10); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 23px "Microsoft YaHei"';
  const btnText = isPvp ? (step===0 ? '确认，玩家2选择' : '开始对战！') : '开始闯关！';
  ctx.fillText(btnText, VW/2, btnY+32);
  charSelectClickRegions.push({id:'confirm', x:btnX, y:btnY, w:btnW, h:btnH});
  
  /* 返回按钮 */
  const backBtnX = 24, backBtnY = 16, backBtnW = 92, backBtnH = 34;
  ctx.fillStyle = 'rgba(100,100,120,0.5)';
  ctx.beginPath(); ctx.roundRect(backBtnX, backBtnY, backBtnW, backBtnH, 7); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 16px "Microsoft YaHei"';
  ctx.fillText('返回', backBtnX+backBtnW/2, backBtnY+23);
  charSelectClickRegions.push({id:'back', x:backBtnX, y:backBtnY, w:backBtnW, h:backBtnH});
}

