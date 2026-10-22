/* ===== 渲染 ===== */
const SCENE_SEED = [];
for(let i=0;i<200;i++) SCENE_SEED.push({x:Math.random()*VW, y:Math.random()*GY_TOP, s:Math.random(), r:Math.random()*TAU});

function drawBambooForestSky(){
  const g = ctx.createLinearGradient(0,0,0,GY_TOP);
  g.addColorStop(0,'#050e0e'); g.addColorStop(0.3,'#0a1a18'); g.addColorStop(0.7,'#122824'); g.addColorStop(1,'#1a3830');
  ctx.fillStyle = g; ctx.fillRect(0,0,VW,GY_TOP);
  const mx = 1030, my = 100;
  const mg = ctx.createRadialGradient(mx,my,5,mx,my,250);
  mg.addColorStop(0,'rgba(220,255,220,0.95)'); mg.addColorStop(0.15,'rgba(180,240,180,0.6)'); mg.addColorStop(0.5,'rgba(100,200,120,0.15)'); mg.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle = mg; ctx.beginPath(); ctx.arc(mx,my,250,0,TAU); ctx.fill();
  ctx.fillStyle = '#f0fff0'; ctx.beginPath(); ctx.arc(mx,my,32,0,TAU); ctx.fill();
}
function drawBambooForestFar(){
  ctx.fillStyle = '#061210';
  ctx.beginPath(); ctx.moveTo(-20, GY_TOP);
  for(let x=-20;x<=VW+20;x+=30){ const h = 120+Math.sin(x*0.004)*60+Math.sin(x*0.011)*30; ctx.lineTo(x, GY_TOP-h); }
  ctx.lineTo(VW+20, GY_TOP); ctx.fill();
  for(let layer=0;layer<3;layer++){
    ctx.fillStyle = layer===0?'#081a14':layer===1?'#0a2018':'#0c2a1e';
    ctx.globalAlpha = 0.6+layer*0.25;
    const count = 15+layer*5;
    for(let i=0;i<count;i++){
      const x = (i*(VW/count)+layer*37)%VW;
      const h = 180+(i*31)%150+layer*40;
      const w = 5+layer*2;
      ctx.fillRect(x, GY_TOP-h, w, h);
    }
  }
  ctx.globalAlpha = 1;
}
function drawBambooForestMid(){
  /* 中层：较近的竹林和灌木 */
  for(let i=0;i<20;i++){
    const x = (i*67+23)%VW;
    const h = 120+(i*17)%80;
    ctx.fillStyle = '#0a2a1e';
    ctx.fillRect(x, GY_TOP-h, 4, h);
    /* 竹叶 */
    ctx.fillStyle = '#0c3a28';
    for(let j=0;j<3;j++){
      const ly = GY_TOP-h+j*25;
      ctx.beginPath(); ctx.ellipse(x+2, ly, 8, 3, (j%2)*0.5-0.25, 0, TAU); ctx.fill();
    }
  }
  /* 灌木丛 */
  for(let i=0;i<12;i++){
    const x = (i*110+45)%VW;
    ctx.fillStyle = '#082a1a';
    ctx.beginPath(); ctx.ellipse(x, GY_TOP-15, 25, 18, 0, 0, TAU); ctx.fill();
  }
}
function drawBambooForestNear(){
  /* 近层：地面草丛和碎石 */
  for(let i=0;i<30;i++){
    const x = (i*43+17)%VW;
    ctx.fillStyle = '#0a3a22';
    ctx.beginPath(); ctx.ellipse(x, GY_TOP-5, 12, 8, 0, 0, TAU); ctx.fill();
  }
  /* 碎石 */
  for(let i=0;i<15;i++){
    const x = (i*87+33)%VW;
    ctx.fillStyle = '#1a2a1a';
    ctx.beginPath(); ctx.arc(x, GY_TOP-3, 3+(i%3), 0, TAU); ctx.fill();
  }
}
function drawBloodMoonSky(){
  const g = ctx.createLinearGradient(0,0,0,GY_TOP);
  g.addColorStop(0,'#0a0202'); g.addColorStop(0.3,'#1a0505'); g.addColorStop(0.6,'#2a0808'); g.addColorStop(1,'#3a0c0c');
  ctx.fillStyle = g; ctx.fillRect(0,0,VW,GY_TOP);
  const mx = 1000, my = 110;
  const mg = ctx.createRadialGradient(mx,my,30,mx,my,300);
  mg.addColorStop(0,'rgba(255,60,30,0.8)'); mg.addColorStop(0.3,'rgba(200,20,10,0.3)'); mg.addColorStop(0.6,'rgba(150,0,0,0.1)'); mg.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle = mg; ctx.beginPath(); ctx.arc(mx,my,300,0,TAU); ctx.fill();
  ctx.fillStyle = '#ff3322'; ctx.beginPath(); ctx.arc(mx,my,55,0,TAU); ctx.fill();
}
function drawBloodMoonFar(){
  ctx.fillStyle = '#120303';
  ctx.beginPath(); ctx.moveTo(-20, GY_TOP);
  for(let x=-20;x<=VW+20;x+=25){ const h = 100+Math.sin(x*0.005)*70+Math.sin(x*0.013)*40+Math.cos(x*0.008)*25; ctx.lineTo(x, GY_TOP-h); }
  ctx.lineTo(VW+20, GY_TOP); ctx.fill();
  ctx.fillStyle = '#0a0101';
  const tx = VW*0.65, ty = GY_TOP;
  ctx.fillRect(tx-80, ty-160, 160, 160);
  ctx.beginPath(); ctx.moveTo(tx-110, ty-160); ctx.lineTo(tx, ty-240); ctx.lineTo(tx+110, ty-160); ctx.fill();
}
function drawBloodMoonMid(){
  /* 中层：枯树和墓碑 */
  for(let i=0;i<15;i++){
    const x = (i*83+41)%VW;
    const h = 80+(i*23)%60;
    /* 枯树干 */
    ctx.fillStyle = '#1a0505';
    ctx.fillRect(x-3, GY_TOP-h, 6, h);
    /* 枯枝 */
    ctx.strokeStyle = '#1a0505'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x, GY_TOP-h+20); ctx.lineTo(x+15, GY_TOP-h+10); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, GY_TOP-h+35); ctx.lineTo(x-12, GY_TOP-h+25); ctx.stroke();
  }
  /* 墓碑 */
  for(let i=0;i<8;i++){
    const x = (i*160+80)%VW;
    ctx.fillStyle = '#0a0202';
    ctx.fillRect(x-8, GY_TOP-25, 16, 25);
    ctx.beginPath(); ctx.arc(x, GY_TOP-25, 8, Math.PI, TAU); ctx.fill();
  }
}
function drawBloodMoonNear(){
  /* 近层：血迹和碎骨 */
  for(let i=0;i<20;i++){
    const x = (i*67+29)%VW;
    ctx.fillStyle = 'rgba(80,10,10,0.6)';
    ctx.beginPath(); ctx.ellipse(x, GY_TOP-4, 15, 6, 0, 0, TAU); ctx.fill();
  }
  /* 碎骨 */
  for(let i=0;i<12;i++){
    const x = (i*103+51)%VW;
    ctx.fillStyle = '#2a1a1a';
    ctx.fillRect(x-4, GY_TOP-6, 8, 3);
    ctx.fillRect(x-1, GY_TOP-8, 3, 6);
  }
}
function drawSnowMountainSky(){
  const g = ctx.createLinearGradient(0,0,0,GY_TOP);
  g.addColorStop(0,'#050a14'); g.addColorStop(0.3,'#0a1828'); g.addColorStop(0.6,'#142a44'); g.addColorStop(1,'#1e3a58');
  ctx.fillStyle = g; ctx.fillRect(0,0,VW,GY_TOP);
  const mx = 1050, my = 90;
  const mg = ctx.createRadialGradient(mx,my,8,mx,my,200);
  mg.addColorStop(0,'rgba(220,240,255,0.95)'); mg.addColorStop(0.2,'rgba(180,220,255,0.4)'); mg.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle = mg; ctx.beginPath(); ctx.arc(mx,my,200,0,TAU); ctx.fill();
  ctx.fillStyle = '#e8f4ff'; ctx.beginPath(); ctx.arc(mx,my,35,0,TAU); ctx.fill();
}
function drawSnowMountainFar(){
  for(let layer=0;layer<3;layer++){
    const colors = ['#0a1828','#0e2038','#122848'];
    ctx.fillStyle = colors[layer];
    ctx.beginPath(); ctx.moveTo(-20, GY_TOP);
    for(let x=-20;x<=VW+20;x+=20){ const base = 120+layer*50; const h = base+Math.sin(x*0.003+layer*2)*80+Math.sin(x*0.009+layer)*35+Math.cos(x*0.006)*20; ctx.lineTo(x, GY_TOP-h); }
    ctx.lineTo(VW+20, GY_TOP); ctx.fill();
  }
}
function drawSnowMountainMid(){
  /* 中层：雪松和岩石 */
  for(let i=0;i<18;i++){
    const x = (i*71+35)%VW;
    const h = 90+(i*19)%70;
    /* 雪松 */
    ctx.fillStyle = '#0a2838';
    ctx.beginPath(); ctx.moveTo(x, GY_TOP-h); ctx.lineTo(x-12, GY_TOP-h+30); ctx.lineTo(x+12, GY_TOP-h+30); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x, GY_TOP-h+20); ctx.lineTo(x-15, GY_TOP-h+55); ctx.lineTo(x+15, GY_TOP-h+55); ctx.fill();
    /* 积雪 */
    ctx.fillStyle = '#c8e0f0';
    ctx.beginPath(); ctx.moveTo(x, GY_TOP-h); ctx.lineTo(x-8, GY_TOP-h+15); ctx.lineTo(x+8, GY_TOP-h+15); ctx.fill();
  }
  /* 岩石 */
  for(let i=0;i<10;i++){
    const x = (i*127+63)%VW;
    ctx.fillStyle = '#1a2a3a';
    ctx.beginPath(); ctx.ellipse(x, GY_TOP-20, 18, 22, 0, 0, TAU); ctx.fill();
    /* 岩顶积雪 */
    ctx.fillStyle = '#a8c8e0';
    ctx.beginPath(); ctx.ellipse(x, GY_TOP-38, 14, 6, 0, 0, TAU); ctx.fill();
  }
}
function drawSnowMountainNear(){
  /* 近层：雪堆和冰晶 */
  for(let i=0;i<25;i++){
    const x = (i*53+21)%VW;
    ctx.fillStyle = '#d8e8f4';
    ctx.beginPath(); ctx.ellipse(x, GY_TOP-6, 14, 8, 0, 0, TAU); ctx.fill();
  }
  /* 冰晶 */
  for(let i=0;i<15;i++){
    const x = (i*89+47)%VW;
    ctx.strokeStyle = '#a0d0f0'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x, GY_TOP-8); ctx.lineTo(x, GY_TOP-18); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x-4, GY_TOP-13); ctx.lineTo(x+4, GY_TOP-13); ctx.stroke();
  }
}
