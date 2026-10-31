/* ===== 技能函数 ===== */
/* ★ 技能目标：wantRef=true 时返回目标「对象引用」而不是坐标快照，
   这样技能在延迟回调里能读到目标的实时位置（智能追踪的基础） */
function getSkillTarget(p, wantRef){
  if(!p.isPlayer){
    const t = G.player;
    if(t && !t.dead) return wantRef ? t : {x:t.x, y:t.y};
    return null;
  }
  if(G.isPvp){
    const o = p===G.player?G.player2:G.player;
    if(o && !o.dead) return wantRef ? o : {x:o.x, y:o.y};
    return null;
  }
  /* 单人模式：锁定最近存活敌人（不限制方向） */
  let tgt=null, best=1e9;
  for(const e of G.enemies){
    if(!e.alive) continue;
    const dx = e.x-p.x, dy = e.y-p.y;
    const d = dx*dx + dy*dy*4; /* Y轴距离加权 */
    if(d<best){ best=d; tgt=e; }
  }
  if(!tgt) return null;
  return wantRef ? tgt : {x:tgt.x, y:tgt.y};
}
/* 目标是否还活着（敌人用 alive，玩家用 dead） */
function skAlive(r){
  if(!r) return false;
  if(r.alive !== undefined && r.alive === false) return false;
  if(r.dead) return false;
  if(typeof r.hp === 'number' && r.hp <= 0) return false;
  return true;
}

function castSwordQi(){
  /* 剑开天门：锁定目标位置，天空裂开，飞剑攻击目标 */
  const p = currentSkillCaster || G.player; playSound('skillCast');
  const atkVal = skillAtkVal(p);
  
  /* ★ 智能锁定目标：活坐标，施法全程跟随敌人移动 */
  const tgt = skAim(p, 200);
  /* 裂痕位置：目标上方（实时跟随，敌人跑到哪就劈到哪） */
  const crackX = () => tgt.x;
  const crackY = () => tgt.y - 200;
  
  spawnText(p.x, p.y, 200, '剑 开 天 门', '#9fe6ff', 38);
  p.action = {type:'swordCharge', dur:0.5, t:0};
  
  /* 第一阶段：天空震颤，裂痕预兆（只留少量尘屑，不再满天光点） */
  for(let i=0;i<6;i++){
    setTimeout(()=>{
      if(!G || gameState!=='playing') return;
      const cx = crackX() + rand(-40, 40);
      const cy = crackY() + rand(-20, 20);
      spawnParticles(cx, cy, 2, {color:'#7f9aa8', angle:rand(0, TAU), spread:0.5, spMin:40, spMax:120, lifeMin:0.2, lifeMax:0.4, sizeMin:2, sizeMax:4, grav:-60});
      if(i === 3) addEffect('hitRing', cx, cy, 0.3, {color:'#8fc6dd', r:16});
    }, i*55);
  }
  
  /* 第二阶段：天空裂开 */
  setTimeout(()=>{
    if(!G || gameState!=='playing') return;
    playSound('thunder');
    
    /* 天空裂痕 */
    addEffect('skyCrack', crackX(), crackY(), 1.5, {width:180, color:'#9fe6ff'});
    addEffect('skyCrack', crackX()-30, crackY()+20, 1.2, {width:120, color:'#d0f0ff'});
    addEffect('skyCrack', crackX()+30, crackY()-20, 1.2, {width:120, color:'#d0f0ff'});
    
    /* 裂痕粒子（原来 80 颗发光点，现在只留少量碎石尘屑） */
    for(let i=0;i<8;i++){
      setTimeout(()=>{
        if(!G || gameState!=='playing') return;
        const cx = crackX() + rand(-60, 60);
        const cy = crackY() + rand(-30, 30);
        spawnParticles(cx, cy, 2, {color:i%2===0?'#8fb8c8':'#c8d6dc', angle:Math.PI/2, spread:0.8, spMin:60, spMax:150, lifeMin:0.3, lifeMax:0.55, sizeMin:2, sizeMax:5, grav:320});
      }, i*45);
    }
    
    /* 第三阶段：剑从手中飞出 */
    setTimeout(()=>{
      if(!G || gameState!=='playing') return;
      playSound('swordSwing');
      if(p.action && p.action.type==='swordCharge') p.action = null;
      
      /* 剑从手中飞向天空裂痕 */
      const handX = p.x + p.facing*40;
      const handY = p.y - 70;
      
      /* 飞剑特效 - 使用模型剑 */
      addEffect('flyingSword', handX, handY, 0.6, {
        targetX: crackX(), targetY: crackY(), 
        color:'#9fe6ff', weaponId:'sword'
      });
      
      /* 剑飞行轨迹：只在剑身后留少量气流碎屑（原来每步 3 颗发光点） */
      for(let i=0;i<8;i++){
        setTimeout(()=>{
          if(!G || gameState!=='playing') return;
          const progress = i/8;
          const sx = handX + (crackX()-handX)*progress;
          const sy = handY + (crackY()-handY)*progress;
          spawnParticles(sx, sy, 1, {color:'#93b6c4', angle:Math.atan2(crackY()-handY, crackX()-handX)+Math.PI, spread:0.35, spMin:40, spMax:110, lifeMin:0.18, lifeMax:0.35, sizeMin:2, sizeMax:4, grav:-40});
        }, i*45);
      }
      
      /* 第四阶段：剑到达裂痕后炸裂攻击 */
      setTimeout(()=>{
        if(!G || gameState!=='playing') return;
        playSound('explosion');
        
        /* 剑在裂痕处炸裂 */
        addEffect('explosion', crackX(), crackY(), 0.8, {r:200, color:'#9fe6ff'});
        addEffect('explosion', crackX(), crackY(), 0.6, {r:150, color:'#fff'});
        
        /* 剑气从天空劈落攻击目标 */
        meleeAoe(p, tgt.x, tgt.y, 250, atkVal*25.0, {kb:350, launch:true});
        
        /* 多道剑气从天而降：16 把实体飞剑（原来 8 道，单把伤害减半，总量不变） */
        for(let i=0;i<16;i++){
          setTimeout(()=>{
            if(!G || gameState!=='playing') return;
            const angle = (i/16)*TAU;
            const dist = rand(80, 200);
            const sx = tgt.x + Math.cos(angle)*dist;
            const sy = tgt.y - 320;
            const ex = tgt.x + Math.cos(angle)*dist*0.3;
            const ey = tgt.y;
            
            /* 剑气投射物：真实剑模型飞行 */
            const dx = ex-sx, dy = ey-sy;
            const speed = 1250;
            const flightTime = Math.hypot(dx, dy)/speed;
            G.projectiles.push({ kind:'realSword', x:sx, y:sy, h:60, vx:(dx/Math.hypot(dx,dy))*speed, vy:(dy/Math.hypot(dx,dy))*speed, life:flightTime+0.1, w:80, hh:50, dmg:atkVal*2.5, pierce:1, hitSet:new Set(), color:'#9fe6ff', facing:Math.sign(dx)||1, rot:Math.atan2(dy, dx), owner:p });
            
            /* 剑身后只留一丝气流，不再拖一长串光点 */
            spawnParticles(sx, sy, 2, {color:'#8fb8c8', angle:Math.atan2(dy, dx), spread:0.3, spMin:60, spMax:160, lifeMin:0.15, lifeMax:0.3, sizeMin:2, sizeMax:4, grav:0});
          }, i*32);
        }
        
        /* 落地冲击：只留 5 处土石翻起（原来 12 处光爆 + 200 颗碎片） */
        for(let i=0;i<5;i++){
          setTimeout(()=>{
            if(!G || gameState!=='playing') return;
            const a = i*(TAU/5);
            const dist = rand(50, 150);
            const ex = tgt.x + Math.cos(a)*dist;
            const ey = tgt.y + Math.sin(a)*dist*0.3;
            addEffect('explosion', ex, ey, 0.45, {r:48, color:'#8fb8c8'});
            addEffect('groundCrack', tgt.x, tgt.y, 1.0, {delay:i*0.04, angle:a, color:'#9fe6ff'});
            spawnParticles(ex, ey, 2, {color:i%2===0?'#a8c4d0':'#8fa8b4', angle:-Math.PI/2, spread:1.0, spMin:80, spMax:220, lifeMin:0.3, lifeMax:0.6, sizeMin:2, sizeMax:5, grav:520});
          }, i*55);
        }
        
        /* 碎石飞溅：8 处，每处 2 颗（原来 50 处 × 4 颗） */
        for(let i=0;i<8;i++){
          const a = rand(0, TAU);
          const spd = rand(150, 420);
          setTimeout(()=>{
            if(!G || gameState!=='playing') return;
            spawnParticles(tgt.x+rand(-30,30), tgt.y-20+rand(-30,30), 2, {color:i%2===0?'#b6c8d0':'#8fa8b4', angle:a, spread:1.2, spMin:spd*0.4, spMax:spd, lifeMin:0.4, lifeMax:0.85, sizeMin:2, sizeMax:6, grav:620});
          }, i*22);
        }
        
        /* 冲击波：只留两圈 */
        for(let r=0;r<2;r++){
          setTimeout(()=>{
            if(!G || gameState!=='playing') return;
            addEffect('hitRing', tgt.x, tgt.y-20, 0.45, {color:'#8fc6dd', r:60+r*50});
          }, r*70);
        }
        
        G.shake = Math.max(G.shake, 30); G.flash = 0.22; G.hitFlashColor = '#bcd8e4'; fxHitstop(0.18);
      }, 600);
    }, 400);
  }, 400);
}
function castSwordSky(){
  /* 剑二十三：二十三柄幽灵剑影从虚空中凝聚，环绕飞舞后齐射目标 */
  const p = currentSkillCaster || G.player; playSound('skillCast');
  const atkVal = skillAtkVal(p);
  const tgt = skAim(p, 240);            /* 活坐标：全程跟随 */
  const lx = () => tgt.x, ly = () => tgt.y;
  spawnText(p.x, p.y, 200, '剑 二 十 三', '#9fe6ff', 42);
  p.action = {type:'swordCharge', dur:1.0, t:0};
  
  /* 虚空凝聚 - 15柄剑影依次出现 */
  const ghostSwords = [];
  for(let i=0;i<15;i++){
    setTimeout(()=>{
      if(!G || gameState!=='playing') return;
      const a = (i/15)*TAU, r = 100+rand(-20,20);
      const sx = p.x+Math.cos(a)*r;
      const sy = p.y-70+Math.sin(a)*r*0.4;
      ghostSwords.push({x:sx, y:sy, angle:a, rot:rand(-0.5,0.5)});
      addEffect('ghostSword', sx, sy, 2.0, {rot:rand(-Math.PI,Math.PI), color:'#9fe6ff', delay:i*0.03});
      spawnParticles(sx, sy, 2, {color:i%2===0?'#8fb8c8':'#b6c8d0', angle:-Math.PI/2, spread:0.8, spMin:40, spMax:110, lifeMin:0.25, lifeMax:0.5, sizeMin:2, sizeMax:5, grav:-90});
      if(i%5===0) playSound('swordSwing');
    }, i*40);
  }
  
  /* 剑影环绕 - 少量气流，不再每圈撒光点 */
  setTimeout(()=>{
    if(!G || gameState!=='playing') return;
    for(let i=0;i<8;i++){
      setTimeout(()=>{
        if(!G || gameState!=='playing') return;
        const a = (i/23)*TAU + G.t*3;
        const r = 80+Math.sin(G.t*5+i)*20;
        const sx = p.x+Math.cos(a)*r;
        const sy = p.y-70+Math.sin(a)*r*0.4;
        spawnParticles(sx, sy, 1, {color:'#93b6c4', angle:a+Math.PI, spread:0.25, spMin:25, spMax:65, lifeMin:0.18, lifeMax:0.3, sizeMin:2, sizeMax:4, grav:-40});
      }, i*28);
    }
  }, 920);
  
  /* 万剑齐发 - 23柄剑影射向目标 */
  setTimeout(()=>{
    if(!G || gameState!=='playing') return;
    if(p.action && p.action.type==='swordCharge') p.action = null;
    playSound('explosion');
    
    /* 剑二十三：23 把实体剑影齐射（原来 15 把；单把 5.0→3.25，总伤害不变） */
    for(let i=0;i<23;i++){
      setTimeout(()=>{
        if(!G || gameState!=='playing') return;
        const startA = (i/23)*TAU;
        const startR = 80;
        const sx = p.x+Math.cos(startA)*startR;
        const sy = p.y-70+Math.sin(startA)*startR*0.4;
        const dx = lx()-sx, dy = ly()-sy;
        const dist = Math.hypot(dx, dy);
        const speed = 1250;
        const flightTime = dist/speed;
        
        /* 剑气投射物 */
        G.projectiles.push({ kind:'realSword', x:sx, y:sy, h:65, vx:(dx/dist)*speed, vy:(dy/dist)*speed*0.3, life:flightTime+0.1, w:70, hh:50, dmg:atkVal*3.25, pierce:1, hitSet:new Set(), color:'#9fe6ff', facing:Math.sign(dx)||1, rot:Math.atan2(dy*0.3, dx), owner:p, ghost:true });
        
        /* 尾迹：每把只留 2 颗碎屑 */
        spawnParticles(sx, sy, 2, {color:'#8fb8c8', angle:Math.atan2(dy, dx), spread:0.3, spMin:70, spMax:180, lifeMin:0.15, lifeMax:0.3, sizeMin:2, sizeMax:4, grav:0});
        
        if(i%6===0) playSound('swordSwing');
      }, i*24);
    }
    
    /* 最终爆炸 */
    setTimeout(()=>{
      if(!G || gameState!=='playing') return;
      meleeAoe(p, lx(), ly(), 220, atkVal*25.0, {kb:400, launch:true});
      addEffect('explosion', lx(), ly(), 0.7, {r:180, color:'#8fb8c8'});
      
      /* 剑痕地面：只留 5 道 */
      for(let i=0;i<5;i++){
        setTimeout(()=>{
          if(!G || gameState!=='playing') return;
          const a = (i/5)*TAU;
          const dist = rand(30, 150);
          const ex = lx()+Math.cos(a)*dist;
          const ey = ly()+Math.sin(a)*dist*0.3;
          addEffect('groundCrack', lx(), ly(), 1.2, {delay:i*0.03, angle:a, color:'#9fe6ff'});
        }, i*30);
      }
      
      /* 碎石飞溅：8 处 × 2 颗（原来 80 处 × 5 颗） */
      for(let i=0;i<8;i++){
        const a = rand(0, TAU);
        const spd = rand(150, 500);
        setTimeout(()=>{
          if(!G || gameState!=='playing') return;
          spawnParticles(lx()+rand(-40,40), ly()-20+rand(-40,40), 2, {color:i%2===0?'#b6c8d0':'#8fa8b4', angle:a, spread:1.4, spMin:spd*0.4, spMax:spd, lifeMin:0.4, lifeMax:0.9, sizeMin:2, sizeMax:6, grav:700});
        }, i*22);
      }
      
      /* 冲击波：只留两圈 */
      for(let r=0;r<2;r++){
        setTimeout(()=>{
          if(!G || gameState!=='playing') return;
          addEffect('hitRing', lx(), ly()-20, 0.45, {color:'#8fc6dd', r:60+r*50});
        }, r*70);
      }
      
      G.shake = Math.max(G.shake, 32); G.flash = 0.22; G.hitFlashColor = '#bcd8e4'; fxHitstop(0.2);
      spawnText(lx(), ly(), 150, '二 十 三', '#d0f0ff', 36);
    }, 700);
  }, 1300);
}
function castSwordRain(){
  const p = currentSkillCaster || G.player; playSound('skillCast');
  const atkVal = skillAtkVal(p);
  if(G.isPvp){ const o = p===G.player?G.player2:G.player; if(o && !o.dead) p.facing = o.x>p.x?1:-1; }
  else if(!p.isPlayer){ const o = G.player; if(o && !o.dead) p.facing = o.x>p.x?1:-1; }
  const tgtR = skAim(p, 250);           /* 活坐标 */
  const cx = () => tgtR.x; const cy = 95;
  const swords = [], count = 24;
  for(let i=0;i<count;i++){
    const layer = i%3, rad = 150+layer*80+rand(-15,15);
    swords.push({ angle:i*(TAU/(count/3)), rad, yOffset:layer*40, state:'orbit', x:cx(), y:cy, rot:0, delay:0.8+i*0.025, target:null, hitSet:new Set(), prevX:cx(), prevY:cy });
  }
  addEffect('swordArray', cx(), cy, 4.0, {swords, cx: cx(), cy, timer:0, owner:p, ownerAtk:atkVal});
  spawnText(p.x, p.y, 200, '万 剑 归 宗', '#9fe6ff', 40);
  addEffect('skyGlow', cx(), cy, 1.5, {color:'#9fe6ff'});
  for(let i=0;i<12;i++){
    setTimeout(()=>{
      if(!G || gameState!=='playing') return;
      const frac = i/12, ex = lerp(p.x,cx(),frac), ey = lerp(p.y-60,cy,frac)-Math.sin(frac*Math.PI)*70;
      spawnParticles(ex, ey, 1, {color:i%2===0?'#a8c4d0':'#8fa8b4', angle:-Math.PI/2, spread:0.4, spMin:25, spMax:80, lifeMin:0.18, lifeMax:0.4, sizeMin:2, sizeMax:4, grav:-90});
    }, i*40);
  }
  G.shake = Math.max(G.shake, 16); G.flash = 0.18; G.hitFlashColor = '#cfe0e8';
}

function castBladeFire(){
  /* 修罗斩：锁定目标，蓄力后挥出巨大血红刀芒 */
  const p = currentSkillCaster || G.player; playSound('skillCast');
  const atkVal = skillAtkVal(p);
  
  /* ★ 智能锁定目标位置 */
  const tgt = skAim(p, 150);            /* 活坐标 */
  /* 起手甩出实体武器（纯视觉，伤害仍由本技能结算） */
  setTimeout(()=>{ if(G && gameState==='playing') fxWeaponVolley(p, p.x, p.y-60, tgt.x, tgt.y, 'realBlade', 8, {color:'#c96a3a', speed:1200, dmg:atkVal*4}); }, 110);
  const slashX = () => tgt.x, slashY = () => tgt.y;
  spawnText(p.x, p.y, 200, '修 罗 斩', '#ff2244', 40);
  p.action = {type:'bladeCharge', dur:0.5, t:0};
  
  /* 蓄力阶段：修罗之气汇聚 */
  for(let i=0;i<25;i++){
    setTimeout(()=>{
      if(!G || gameState!=='playing') return;
      const a = (i/25)*TAU, r = 70-i*1.5;
      const sx = p.x+p.facing*40+Math.cos(a)*r;
      const sy = p.y-60+Math.sin(a)*r*0.5;
      spawnParticles(sx, sy, 2, {color:i%4===0?'#dbe4e8':i%4===1?'#ff2244':i%4===2?'#cc0033':'#880022', angle:Math.atan2(p.y-60-sy, p.x+p.facing*40-sx), spread:0.4, spMin:60, spMax:180, lifeMin:0.3, lifeMax:0.6, sizeMin:4, sizeMax:9, grav:-80});
      if(i%5===0) addEffect('hitRing', sx, sy, 0.3, {color:'#ff2244', r:15+i});
    }, i*18);
  }
  
  /* 修罗幻影 - 背后浮现修罗虚影（★ 用刀客本体光影，替代几何体） */
  addEffect('asuraAvatar', p.x - p.facing*42, p.y, 0.8, {facing:p.facing, color:'#ff2244', spriteKey:'blade', anim:'skill', ghostH:126});
  
  /* 挥斩阶段：巨大血红刀芒 */
  setTimeout(()=>{
    if(!G || gameState!=='playing') return;
    if(p.action && p.action.type==='bladeCharge') p.action = null;
    playSound('bladeSwing');
    
    /* 主刀芒 - 一道与刀气命中范围等大的弧形斩击（原来叠了三层无意义弧光） */
    addEffect('slashArc', slashX(), slashY(), 0.5, {facing:p.facing, color:'#ff2244', size:1.9, typeStr:'blade'});
    
    /* 投射物 - 血红刀气（★ 改用格斗家刀模型 glowWeapon，避免纯光粒子，浏览器更轻松） */
    G.projectiles.push({ kind:'glowWeapon', weaponType:'blade', x:p.x+p.facing*80, y:p.y, h:50, vx:p.facing*1000, vy:0, life:0.7, w:160, hh:120, dmg:atkVal*10.0, pierce:3, hitSet:new Set(), color:'#ff2244', facing:p.facing, owner:p, trail:true, scale:1.7 });

    /* 血雾（★ 已从 40 颗压到 16 颗，刀模型本身已承担视觉） */
    for(let i=0;i<16;i++){
      const angle = p.facing>0?rand(-0.8,0.8):rand(Math.PI-0.8,Math.PI+0.8);
      const dist = rand(40, 200);
      setTimeout(()=>{
        if(!G || gameState!=='playing') return;
        spawnParticles(p.x+p.facing*rand(50,200), p.y-rand(10,120), 4, {color:['#ff2244','#cc0033','#ff4466','#880022'][i%4], angle, spread:1.0, spMin:100, spMax:400, lifeMin:0.3, lifeMax:0.8, sizeMin:4, sizeMax:10, grav:300});
      }, i*10);
    }
    
    /* 地面裂痕 - 刀气入地 */
    for(let i=0;i<10;i++){
      setTimeout(()=>{
        if(!G || gameState!=='playing') return;
        const fx = p.x+p.facing*(100+i*25);
        addEffect('groundCrack', fx, p.y, 1.0, {delay:i*0.03, angle:p.facing>0?0:Math.PI, color:'#ff2244'});
        spawnParticles(fx, p.y-5, 2, {color:'#ff2244', angle:-Math.PI/2, spread:1.2, spMin:50, spMax:150, lifeMin:0.3, lifeMax:0.6, sizeMin:3, sizeMax:7, grav:400});
      }, i*30);
    }
    
    /* 冲击波 */
    for(let r=0;r<4;r++){
      setTimeout(()=>{
        if(!G || gameState!=='playing') return;
        addEffect('hitRing', slashX(), slashY(), 0.4, {color:r%2===0?'#ff2244':'#ff4466', r:60+r*30});
      }, r*50);
    }
    
    G.shake = Math.max(G.shake, 22); G.flash = 0.22; G.hitFlashColor = '#ff2244'; fxHitstop(0.1);
  }, 500);
}
function castBladeArray(){
  /* 五龙御天刀（重做）：五柄本命刀腾空后依次俯冲劈下
     ★ 有实体刀模型飞出去，就只留刀，不再叠成片光粒子 */
  const p = currentSkillCaster || G.player; playSound('skillCast');
  const atkVal = skillAtkVal(p);
  const tgt = skAim(p, 220);                 /* 活坐标 */
  const tx = () => clamp(tgt.x, WORLD_L + 50, WORLD_R - 50);
  const ty = () => clamp(tgt.y, GY_TOP + 20, GY_BOTTOM);
  spawnText(p.x, p.y, 200, '五 龙 御 天 刀', '#ff8a4a', 38);
  p.action = {type:'bladeCharge', dur:0.8, t:0};
  /* 起手：刀身一亮（一个光爆，替代原来 30 帧汇聚粒子） */
  addEffect('lightBloom', p.x + p.facing * 52, p.y - 66, 0.35, {r:70, rays:10, color:'#ff8a4a'});

  const N = 5;
  for(let d = 0; d < N; d++){
    skAt(240 + d * 170, ()=>{
      if(!G || gameState !== 'playing') return;
      if(d === 0 && p.action && p.action.type === 'bladeCharge') p.action = null;
      playSound('bladeSwing');
      const isLast = (d === N - 1);
      /* 刀刃从头顶斜上方俯冲劈下（本命刀模型） */
      const sx = p.x + p.facing * (40 + d * 18);
      const sy = p.y - 210 - d * 26;
      const ang = Math.atan2((ty() - 26) - sy, tx() - sx);
      const spd = 1180 + d * 60;
      const dist = Math.max(80, Math.hypot(tx() - sx, (ty() - 26) - sy));
      G.projectiles.push({
        kind:'realBlade', x:sx, y:sy, h:1,
        vx:Math.cos(ang) * spd, vy:Math.sin(ang) * spd,
        life: Math.min(0.75, dist / spd + 0.08),
        w: isLast ? 150 : 105, hh: isLast ? 120 : 78,
        dmg: atkVal * (isLast ? 40 : 14), pierce: isLast ? 3 : 1,
        hitSet:new Set(), rot:ang, scale: isLast ? 2.3 : 1.5,
        color:'#ff8a4a', owner:p
      });
      /* 刀落一线刀痕（只留一道弧，不撒粒子） */
      addEffect('slashArc', tx(), ty(), 0.26, {facing:p.facing, color:'#ff8a4a', size: isLast ? 1.8 : 1.1, typeStr:'blade'});
      if(isLast){
        addEffect('lightBloom', tx(), ty() - 30, 0.55, {r:170, rays:16, color:'#ff8a4a'});
        addEffect('hitRing', tx(), ty(), 0.5, {color:'#ffd08a', r:160});
        meleeAoe(p, tx(), ty(), 160, atkVal * 20, {kb:420, launch:true});
        skShake(18, 0.26, '#ff8a4a');
        fxHitstop(0.07);
      } else {
        skShake(7, 0.03, '#ff8a4a');
      }
    });
  }
}
function castBladeStorm(){
  const p = currentSkillCaster || G.player; playSound('skillCast');
  const atkVal = skillAtkVal(p);
  const isEnemyCaster = !p.isPlayer;
  p.action = {type:'storm', dur:2.0, t:0};
  addEffect('stormAura', p.x, p.y, 2.0, {follow:p});
  spawnText(p.x, p.y, 200, '血 刃 风 暴', '#ff8a4a', 34);
  const blades = []; for(let i=0;i<8;i++) blades.push({angle:i*(TAU/8), rad:80});
  addEffect('bladeOrbit', p.x, p.y, 1.0, {blades, follow:p});
  for(let i=0;i<20;i++){
    setTimeout(()=>{
      if(!G || gameState!=='playing') return;
      const a = (i/20)*TAU*2, r = 60+i*3;
      spawnParticles(p.x+Math.cos(a)*r, p.y-50+Math.sin(a)*r*0.3, 1, {color:i%3===0?'#ff2200':i%3===1?'#ff6600':'#ffaa00', angle:a+Math.PI/2, spread:0.4, spMin:50, spMax:150, lifeMin:0.2, lifeMax:0.5, sizeMin:2, sizeMax:6, grav:-100});
    }, i*35);
  }
  setTimeout(()=>{
    if(!G || gameState!=='playing') return;
    playSound('explosion');
    const count = 28;
    for(let i=0;i<count;i++){
      setTimeout(()=>{
        if(!G || gameState!=='playing') return;
        let tx, ty;
        if(G.isPvp){
          const o = p===G.player?G.player2:G.player;
          if(o && !o.dead){ tx=o.x+rand(-40,40); ty=o.y+rand(-15,15); }
          else { const a=rand(0,TAU); tx=p.x+Math.cos(a)*300; ty=p.y+Math.sin(a)*100; }
        } else if(isEnemyCaster){
          const t = G.player;
          if(t && !t.dead){ tx=t.x+rand(-40,40); ty=t.y+rand(-15,15); }
          else { const a=rand(0,TAU); tx=p.x+Math.cos(a)*300; ty=p.y+Math.sin(a)*100; }
        } else {
          const alive = G.enemies.filter(e=>e.alive);
          if(alive.length>0){ const t = alive[i%alive.length]; tx=t.x+rand(-30,30); ty=t.y+rand(-10,10); }
          else { const a=rand(0,TAU); tx=p.x+Math.cos(a)*300; ty=p.y+Math.sin(a)*100; }
        }
        const startAng = rand(0,TAU), startR = 100+rand(0,60);
        let sx = p.x+Math.cos(startAng)*startR;
        let sy = p.y-50+Math.sin(startAng)*startR*0.5;
        let dx = tx-sx, dy = ty-sy, dist = Math.hypot(dx,dy);
        if(dist < 140){ const ang = dist>1?Math.atan2(dy,dx):rand(0,TAU); sx = tx-Math.cos(ang)*140; sy = ty-Math.sin(ang)*140; dx = tx-sx; dy = ty-sy; dist = 140; }
        const flightTime = 0.28;
        G.projectiles.push({ kind:'realBlade', x:sx, y:sy, h:60, vx:dx/flightTime, vy:dy/flightTime, life:flightTime, w:80, hh:40, dmg:atkVal*3.0, pierce:1, hitSet:new Set(), color:'#ff8a4a', rot:Math.atan2(dy,dx), owner:p });
        addEffect('slashArc', sx, sy, 0.2, {facing:Math.sign(dx)||1, color:'#ff8a4a', size:1.2, typeStr:'blade'});
        spawnParticles(sx, sy, 2, {color:i%2===0?'#ff6600':'#ffaa00', angle:Math.atan2(dy,dx), spread:0.5, spMin:80, spMax:200, lifeMin:0.2, lifeMax:0.5, sizeMin:3, sizeMax:7, grav:100});
      }, i*35);
    }
    for(let i=0;i<16;i++){
      setTimeout(()=>{
        if(!G || gameState!=='playing') return;
        const a = (i/16)*TAU;
        spawnParticles(p.x+Math.cos(a)*30, p.y-40, 1, {color:['#ff2200','#ff5500','#ff8800','#ffcc00'][i%4], angle:a, spread:0.3, spMin:100, spMax:350, lifeMin:0.2, lifeMax:0.6, sizeMin:3, sizeMax:7, grav:200});
      }, i*25);
    }
  }, 800);
}

function castSpearThrust(){
  /* 混元十三枪：锁定目标方向，连续刺出十三道枪影 */
  const p = currentSkillCaster || G.player; playSound('skillCast');
  const atkVal = skillAtkVal(p);
  
  /* ★ 智能锁定目标方向 */
  const tgt = skAim(p, 300);            /* 活坐标：全程跟随 */
  /* 起手甩出实体武器（纯视觉，伤害仍由本技能结算） */
  setTimeout(()=>{ if(G && gameState==='playing') fxWeaponVolley(p, p.x, p.y-60, tgt.x, tgt.y, 'realSpear', 7, {color:'#9fc4d8', speed:1250, dmg:atkVal*4}); }, 110);
  p.facing = tgt.x > p.x ? 1 : -1;
  spawnText(p.x, p.y, 200, '混 元 十 三 枪', '#ffd96a', 36);
  p.action = {type:'spearThrust', dur:1.3, t:0};
  
  /* 蓄力：混元之气汇聚枪尖 */
  for(let i=0;i<20;i++){
    setTimeout(()=>{
      if(!G || gameState!=='playing') return;
      const a = (i/20)*TAU, r = 50-i*1.5;
      const sx = p.x+p.facing*60+Math.cos(a)*r;
      const sy = p.y-60+Math.sin(a)*r*0.4;
      spawnParticles(sx, sy, 2, {color:i%3===0?'#dbe4e8':i%3===1?'#ffd96a':'#ffaa30', angle:Math.atan2(p.y-60-sy, p.x+p.facing*60-sx), spread:0.4, spMin:60, spMax:160, lifeMin:0.2, lifeMax:0.5, sizeMin:3, sizeMax:8, grav:-60});
    }, i*20);
  }
  
  /* 十三连刺 */
  for(let k=0;k<13;k++){
    setTimeout(()=>{
      if(!G || gameState!=='playing') return;
      playSound('spearThrust');
      
      /* 每枪略有角度偏移，形成扇形 */
      const angleOffset = (k-6)*0.08;
      const sy = p.y-10+Math.sin(k*0.5)*20;
      const vx = p.facing*1500*Math.cos(angleOffset);
      const vy = 1500*Math.sin(angleOffset)*0.3;
      
      /* 枪影投射物 */
      G.projectiles.push({ kind:'realSpear', x:p.x+p.facing*50, y:sy, h:60, vx:vx, vy:vy, life:0.7, w:90, hh:35, dmg:atkVal*1.15, pierce:1, hitSet:new Set(), color:k%3===0?'#dbe4e8':'#ffd96a', facing:p.facing, rot:Math.atan2(vy, vx), owner:p, hunyuan:true });
      
      /* 刺击特效 */
      addEffect('spearLine', p.x, p.y, 0.15, {facing:p.facing, color:'#ffd96a'});
      
      /* 枪尖粒子 */
      spawnParticles(p.x+p.facing*50, sy, 4, {color:k%4===0?'#dbe4e8':k%4===1?'#ffd96a':k%4===2?'#ffaa30':'#cc8820', angle:p.facing>0?0:Math.PI, spread:0.3, spMin:200, spMax:600, lifeMin:0.15, lifeMax:0.4, sizeMin:3, sizeMax:7, grav:0});
      
      /* 混元之气拖尾 */
      spawnParticles(p.x+p.facing*40, p.y-10, 2, {color:'#ffd96a', angle:-Math.PI/2, spread:0.8, spMin:40, spMax:120, lifeMin:0.2, lifeMax:0.5, sizeMin:3, sizeMax:6, grav:300});
      
      if(k%3===0) G.shake = Math.max(G.shake, 5);
    }, k*80+400);
  }
  
  /* 最终爆发 */
  setTimeout(()=>{
    if(!G || gameState!=='playing') return;
    if(p.action && p.action.type==='spearThrust') p.action = null;
    playSound('explosion');
    
    /* 混元爆发 */
    const burstX = skFall(p, tgt, 300, 900).x;
    const burstY = p.y;
    addEffect('explosion', burstX, burstY, 0.6, {r:144, color:'#ffd96a'});
    
    for(let i=0;i<40;i++){
      const a = rand(0, TAU);
      const spd = rand(100, 400);
      setTimeout(()=>{
        if(!G || gameState!=='playing') return;
        spawnParticles(burstX+rand(-30,30), burstY-20+rand(-30,30), 4, {color:i%3===0?'#dbe4e8':i%3===1?'#ffd96a':'#ffaa30', angle:a, spread:1.5, spMin:spd*0.4, spMax:spd, lifeMin:0.3, lifeMax:0.8, sizeMin:3, sizeMax:9, grav:500});
      }, i*10);
    }
    
    G.shake = Math.max(G.shake, 18); G.flash = 0.22; G.hitFlashColor = '#ffd96a'; fxHitstop(0.1);
  }, 1500);
}
function castSpearDragon(){
  /* 灭世枪法（长枪 1）：枪尖凝光蓄势，一枪贯穿到底，沿途撕裂空间。
     ★ 只有「枪」这一个模型 + 一道贯穿光，不再成片喷粒子 */
  const p = currentSkillCaster || G.player; playSound('skillCast');
  const atkVal = skillAtkVal(p);
  const tgt = skAim(p, 300);                  /* 活坐标 */
  p.facing = tgt.x > p.x ? 1 : -1;
  spawnText(p.x, p.y, 200, '灭 世 枪 法', '#ff4400', 44);
  p.action = { type:'spearCharge', dur:1.0, t:0 };

  /* 蓄势：枪尖聚起一团毁灭之光（三次脉冲，替代 35 帧汇聚粒子） */
  for(let i = 0; i < 3; i++){
    skAt(120 + i * 190, ()=>{
      if(!G || gameState!=='playing') return;
      const hx = p.x + p.facing * 62, hy = p.y - 70;
      addEffect('lightBloom', hx, hy, 0.34, {r:50 + i * 34, rays:10 + i * 3, color:'#ff4400'});
      addEffect('hitRing', hx, hy, 0.3, {color:'#ff6600', r:34 + i * 20});
    });
  }

  /* 灭世一刺 */
  skAt(780, ()=>{
    if(!G || gameState!=='playing') return;
    if(p.action && p.action.type === 'spearCharge') p.action = null;
    playSound('explosion');
    const dir = tgt.x >= p.x ? 1 : -1;
    p.facing = dir;
    const sx = p.x + dir * 60, sy = p.y - 40;
    /* 巨型枪气：本命枪模型，贯穿到底 */
    G.projectiles.push({ kind:'realSpear', x:sx, y:sy, h:34, vx:dir*1200, vy:0,
      life:1.2, w:220, hh:180, dmg:atkVal*6.0, pierce:99, hitSet:new Set(),
      color:'#ff4400', facing:dir, rot:Math.atan2(0, dir*1200), scale:2.5, owner:p, mieShi:true });
    /* 一道贯穿光束（视觉与枪道同轴） */
    addEffect('spearLine', sx, sy, 0.42, {endX:sx + dir*900, endY:sy, color:'#ff6a3a', width:18});
    addEffect('lightBloom', sx + dir*40, sy, 0.4, {r:110, rays:14, color:'#ff4400'});

    /* 沿途空间裂痕（只 5 道，不再 20 道 + 每道 3 颗粒子） */
    for(let i = 0; i < 5; i++){
      skAt(90 + i * 90, ()=>{
        if(!G || gameState!=='playing') return;
        const cx = clamp(sx + dir * (140 + i * 150), WORLD_L + 30, WORLD_R - 30);
        addEffect('spaceCrack', cx, sy + rand(-16, 16), 0.5, {width:rand(70,130), height:rand(34,64), color:'#ff4400'});
      });
    }
    /* 终点冲击：枪到之处一道光爆 */
    skAt(320, ()=>{
      if(!G || gameState!=='playing') return;
      const ex = clamp(sx + dir * 620, WORLD_L + 60, WORLD_R - 60);
      addEffect('lightBloom', ex, sy, 0.55, {r:190, rays:18, color:'#ff4400'});
      addEffect('hitRing', ex, sy, 0.5, {color:'#ffd08a', r:180});
      meleeAoe(p, ex, sy, 150, atkVal*20, {kb:420, launch:true});
      skShake(22, 0.3, '#ff4400');
      fxHitstop(0.1);
    });
  });
}
function castSpearRain(){
  const p = currentSkillCaster || G.player; playSound('skillCast');
  const atkVal = skillAtkVal(p);
  const tgt = skAim(p, 250);            /* 活坐标 */
  const cx = () => tgt.x, cy = () => tgt.y;
  spawnText(p.x, p.y, 200, '万 枪 归 宗', '#ffd96a', 36);
  const directions = 10, spearsPerDir = 5;
  for(let d=0;d<directions;d++){
    for(let s=0;s<spearsPerDir;s++){
      const i = d*spearsPerDir+s;
      setTimeout(()=>{
        if(!G || gameState!=='playing') return;
        playSound('spearThrust');
        const dirAngle = d*(TAU/directions), elevation = 0.3+s*0.2, dist = 600+s*100;
        const sx = cx()+Math.cos(dirAngle)*dist, sy = cy()-dist*elevation+Math.sin(dirAngle)*dist*0.3;
        const tx = cx()+rand(-25,25), ty = cy()-40+rand(-25,25);
        const flightTime = 0.25;
        const vx = (tx-sx)/flightTime, vy = (ty-sy)/flightTime;
        const rot = Math.atan2(ty-sy, tx-sx);
        G.projectiles.push({ kind:'realSpear', x:sx, y:sy, h:60, vx, vy, life:flightTime+0.05, w:120, hh:50, dmg:atkVal*1.2, pierce:1, hitSet:new Set(), color:'#ffd96a', facing:Math.cos(rot)>0?1:-1, rot, owner:p });
        setTimeout(()=>{
          if(!G || gameState!=='playing') return;
          meleeAoe(p, tx, ty, 80, atkVal*0.8, {kb:200});
          addEffect('hitRing', tx, ty, 0.2, {color:'#ffd96a', r:40});
          spawnParticles(tx, ty-20, 4, {color:'#ffd96a', angle:rot+Math.PI, spread:0.8, spMin:100, spMax:350, lifeMin:0.15, lifeMax:0.4, sizeMin:2, sizeMax:5, grav:600});
        }, flightTime*1000);
      }, i*40+d*25);
    }
  }
  G.shake = Math.max(G.shake, 20);
}

function castFistQi(){
  /* 真气弹：锁定目标方向，发射巨型能量弹 */
  const p = currentSkillCaster || G.player; playSound('skillCast');
  const atkVal = skillAtkVal(p);
  
  /* ★ 智能锁定目标方向 */
  const tgt = skAim(p, 250);            /* 活坐标：全程跟随 */
  /* 起手甩出实体武器（纯视觉，伤害仍由本技能结算） */
  setTimeout(()=>{ if(G && gameState==='playing') fxWeaponVolley(p, p.x, p.y-60, tgt.x, tgt.y, 'realFist', 9, {color:'#d8c48a', speed:1150, dmg:atkVal*3}); }, 110);
  p.facing = tgt.x > p.x ? 1 : -1;
  spawnText(p.x, p.y, 180, '真 气 弹', '#ffcc33', 34);
  p.action = {type:'fistCharge', dur:0.5, t:0};
  
  /* 蓄力阶段：能量漩涡聚集 */
  for(let i=0;i<40;i++){
    setTimeout(()=>{
      if(!G || gameState!=='playing') return;
      const a = i*0.5, r = 80-i*1.2;
      const cx = p.x+Math.cos(a)*r, cy = p.y-60+Math.sin(a)*r*0.6;
      spawnParticles(cx, cy, 2, {color:i%3===0?'#ff6600':i%3===1?'#ffcc33':'#ffe066', spMin:50, spMax:150, lifeMin:0.2, lifeMax:0.5, sizeMin:4, sizeMax:10, grav:-300});
      if(i%4===0) addEffect('hitRing', cx, cy, 0.3, {color:'#ffcc33', r:20+i});
    }, i*12);
  }
  
  /* 能量球形成 */
  addEffect('qiCharge', p.x, p.y, 0.5, {follow:p, color:'#ffcc33'});
  for(let i=0;i<15;i++){
    setTimeout(()=>{
      if(!G || gameState!=='playing') return;
      const a = i*(TAU/15), r = 40;
      spawnParticles(p.x+Math.cos(a)*r, p.y-60+Math.sin(a)*r*0.5, 1, {color:'#dbe4e8', angle:a+Math.PI, spread:0.3, spMin:100, spMax:250, lifeMin:0.15, lifeMax:0.35, sizeMin:3, sizeMax:7, grav:-200});
    }, i*25);
  }
  
  /* 发射阶段：爆炸性释放 */
  setTimeout(()=>{
    if(!G || gameState!=='playing') return;
    if(p.action && p.action.type==='fistCharge') p.action = null;
    playSound('explosion');
    
    /* 巨型能量弹 */
    G.projectiles.push({ kind:'qiBomb', x:p.x+p.facing*50, y:p.y, h:65, vx:p.facing*900, vy:0, life:1.8, w:150, hh:120, dmg:atkVal*7.5, pierce:8, hitSet:new Set(), color:'#ffcc33', facing:p.facing, owner:p });
    
    /* 爆炸冲击波 */
    for(let i=0;i<50;i++){
      const a = p.facing>0?Math.PI+rand(-1.2,1.2):rand(-1.2,1.2);
      const speed = rand(300, 900);
      spawnParticles(p.x+p.facing*40, p.y-60, 2, {color:['#ff3300','#ff6600','#ffcc33','#ffe066','#dbe4e8'][i%5], angle:a, spread:0.8, spMin:speed*0.5, spMax:speed, lifeMin:0.3, lifeMax:0.8, sizeMin:5, sizeMax:14, grav:150});
    }
    
    /* 环形冲击 */
    for(let i=0;i<24;i++){
      const a = i*(TAU/24);
      setTimeout(()=>{
        if(!G || gameState!=='playing') return;
        addEffect('hitRing', p.x+p.facing*50+Math.cos(a)*30, p.y-60+Math.sin(a)*20, 0.4, {color:i%2===0?'#ffcc33':'#ff6600', r:40+i*2});
        spawnParticles(p.x+p.facing*50+Math.cos(a)*30, p.y-60+Math.sin(a)*20, 2, {color:'#dbe4e8', angle:a, spread:0.5, spMin:200, spMax:500, lifeMin:0.2, lifeMax:0.5, sizeMin:3, sizeMax:8, grav:0});
      }, i*15);
    }
    
    /* 地面爆裂 */
    for(let i=0;i<8;i++){
      setTimeout(()=>{
        if(!G || gameState!=='playing') return;
        const fx = skFall(p, tgt, 60+i*40, 900).x;
        addEffect('groundFire', fx, p.y, 1.2, {size:50+i*8});
        spawnParticles(fx, p.y-10, 3, {color:['#ff3300','#ff6600','#ffcc33'][i%3], angle:-Math.PI/2, spread:1.5, spMin:150, spMax:400, lifeMin:0.4, lifeMax:0.9, sizeMin:4, sizeMax:10, grav:-200});
      }, i*40);
    }
    
    G.shake = Math.max(G.shake, 25); G.flash = 0.22; G.hitFlashColor = '#ffe066'; fxHitstop(0.12);
  }, 500);
}
function castFistRush(){
  const p = currentSkillCaster || G.player; playSound('skillCast');
  const atkVal = skillAtkVal(p);
  /* 锁定目标方向 */
  let tgt = null, best = 1e9;
  if(!p.isPlayer){
    const o = G.player; if(o && !o.dead){ tgt = {x:o.x, y:o.y}; p.facing = o.x>p.x?1:-1; }
  } else if(G.isPvp){
    const o = p===G.player?G.player2:G.player;
    if(o && !o.dead){ const dx = o.x-p.x; if(Math.sign(dx)===p.facing || Math.abs(dx)<30){ tgt = {x:o.x, y:o.y}; } }
    if(tgt) p.facing = tgt.x>p.x?1:-1;
  } else {
    for(const e of G.enemies){ if(!e.alive) continue; const dx = e.x-p.x; if(Math.sign(dx)!==p.facing && Math.abs(dx)>30) continue; const d=dx*dx; if(d<best){best=d;tgt=e;} }
  }
  /* ★ 前方没敌人时全向兜底锁定，避免冲拳打空 */
  const aim = skAim(p, 250);            /* ★ 活坐标：火莲飞行与绽放都追敌人实时位置 */
  spawnText(p.x, p.y, 200, '佛 怒 火 莲', '#ff6600', 38);

  /* ===== 佛怒火莲（重做）：掌心凝莲 → 火莲飞出 → 命中炸开成花 =====
     核心是「莲花本体模型」，不再用成片粒子堆出花瓣。 */
  const p2 = p;
  const lx = () => p2.x + p2.facing * 62;
  const ly = () => p2.y - 96;
  p2.action = { type:'fistMeditate', dur:0.95, t:0 };

  /* ① 凝莲：掌心一朵火莲生成并绽放（少量火星点缀） */
  addEffect('fireLotus', lx(), ly(), 0.9, {scale:0.95, spin:0.9, bloomDur:0.35});
  addEffect('lightBloom', lx(), ly(), 0.42, {r:70, rays:10, color:'#ff8a2a'});
  spawnParticles(lx(), ly() + 30, 4, {color:'#ffb04a', angle:-Math.PI/2, spread:0.8, spMin:60, spMax:170, lifeMin:0.3, lifeMax:0.7, sizeMin:2, sizeMax:5, grav:-40});

  /* ② 射出：火莲本体朝目标飞出去（同款莲花模型） */
  skAt(720, ()=>{
    if(!G || gameState !== 'playing') return;
    if(p2.action && p2.action.type === 'fistMeditate') p2.action = null;
    playSound('skillCast');
    const tx = aim.x, ty = aim.y - 46;
    const ang = Math.atan2(ty - ly(), tx - lx());
    const dist0 = Math.max(120, Math.hypot(tx - lx(), ty - ly()));
    const spd = 780;
    G.projectiles.push({
      kind:'fireLotusProj', x:lx(), y:ly(), h:1,
      vx:Math.cos(ang) * spd, vy:Math.sin(ang) * spd,
      life: Math.min(1.5, dist0 / spd + 0.25),
      w:110, hh:96, dmg:atkVal*28, pierce:1, hitSet:new Set(),
      rot:0, scale:1.15, color:'#ff7a2a', owner:p2
    });
    addEffect('lightBloom', lx(), ly(), 0.3, {r:80, rays:12, color:'#ffb04a'});
    skShake(6, 0.02, '#ff8a2a');

    /* ③ 命中：在目标处绽放成巨大火莲，火海爆发 */
    const travel = Math.min(900, Math.max(240, dist0 / spd * 1000));
    skAt(travel, ()=>{
      if(!G || gameState !== 'playing') return;
      const bx = clamp(aim.x, WORLD_L + 60, WORLD_R - 60), by = clamp(aim.y, GY_TOP + 20, GY_BOTTOM);
      playSound('explosion');
      addEffect('fireLotus', bx, by - 34, 1.15, {scale:2.3, spin:1.4, bloomDur:0.28});
      addEffect('lightBloom', bx, by - 30, 0.6, {r:210, rays:20, color:'#ff7a2a'});
      addEffect('hitRing', bx, by, 0.55, {color:'#ffd08a', r:200});
      meleeAoe(p2, bx, by, 210, atkVal*60, {kb:420, launch:true});
      /* 余火：地面持续燃烧（贴判定区，接触会持续掉血） */
      for(let i = 0; i < 3; i++){
        addEffect('groundFire', bx + (i-1)*96, by, 1.5 + i*0.15, {color:'#ff7a4a'});
      }
      skShake(20, 0.3, '#ff8a2a');
      fxHitstop(0.08);
    });
  });
}
function castFistPalm(){
  const p = currentSkillCaster || G.player; playSound('skillCast');
  const atkVal = skillAtkVal(p);
  const tgt = skAim(p, 250);            /* 活坐标 */
  const targetX = () => tgt.x, targetY = () => tgt.y;
  spawnText(p.x, p.y, 200, '九 霄 御 雷 诀', '#88ccff', 48);
  p.action = {type:'fistMeditate', dur:1.2, t:0};
  
  /* 天空雷云凝聚：改用光核+环，不再几十帧喷乌云粒子 */
  addEffect('skyGlow', targetX(), 130, 1.2, {color:'#5a7aa0'});
  addEffect('lightBloom', targetX(), targetY()-190, 0.9, {r:150, rays:12, color:'#88ccff'});
  
  /* 电弧预兆 - 从天空到目标 */
  for(let i=0;i<15;i++){
    setTimeout(()=>{
      if(!G || gameState!=='playing') return;
      const startX = targetX()+rand(-100,100), startY = -50;
      const endX = targetX()+rand(-30,30), endY = targetY();
      addEffect('lightning', startX, startY, 0.3, {endX, endY, color:'#aaddff'});   /* 雷电线本身够看，不再撒粒子 */
    }, i*80);
  }
  
  /* 能量聚集：三次雷光脉冲（替代 30 帧粒子漩涡） */
  for(let i=0;i<3;i++){
    skAt(120 + i*180, ()=>{
      if(!G || gameState!=='playing') return;
      addEffect('lightBloom', targetX(), targetY()-100, 0.4, {r:80 + i*40, rays:12+i*4, color:'#88ccff'});
    });
  }
  
  /* 主雷击 - 多道闪电劈下 */
  setTimeout(()=>{
    if(!G || gameState!=='playing') return;
    if(p.action && p.action.type==='fistMeditate') p.action = null;
    playSound('thunder');
    
    /* 第一道主闪电 */
    addEffect('lightning', targetX(), -50, 0.5, {endX:targetX(), endY:targetY(), color:'#dbe4e8', width:8});
    addEffect('lightning', targetX()-50, -50, 0.4, {endX:targetX()-30, endY:targetY(), color:'#aaddff', width:5});
    addEffect('lightning', targetX()+50, -50, 0.4, {endX:targetX()+30, endY:targetY(), color:'#aaddff', width:5});
    
    /* 范围伤害 */
    meleeAoe(p, targetX(), targetY(), 350, atkVal*12.5, {kb:500, launch:true});
    
    /* 爆炸光效 */
    addEffect('explosion', targetX(), targetY(), 0.8, {r:300, color:'#88ccff'});
    addEffect('explosion', targetX(), targetY(), 0.6, {r:200, color:'#dbe4e8'});
    
    /* 电弧扩散 */
    for(let i=0;i<12;i++){
      setTimeout(()=>{
        if(!G || gameState!=='playing') return;
        const a = i*(TAU/12), dist = rand(100, 250);
        const ex = targetX()+Math.cos(a)*dist, ey = targetY()+Math.sin(a)*dist*0.4;
        addEffect('lightning', targetX(), targetY(), 0.3, {endX:ex, endY:ey, color:'#88ccff', width:3});
        spawnParticles(ex, ey, 3, {color:'#aaddff', angle:-Math.PI/2, spread:1.5, spMin:100, spMax:400, lifeMin:0.3, lifeMax:0.8, sizeMin:4, sizeMax:10, grav:400});
      }, i*40);
    }
    
    /* 雷电粒子爆发 */
    for(let i=0;i<100;i++){
      const a = i*(TAU/100);
      const spd = rand(400, 1200);
      setTimeout(()=>{
        if(!G || gameState!=='playing') return;
        spawnParticles(targetX()+rand(-30,30), targetY()-20+rand(-30,30), 6, {color:['#dbe4e8','#88ccff','#aaddff','#6699cc','#4477aa'][i%5], angle:a, spread:1.8, spMin:spd*0.4, spMax:spd, lifeMin:0.4, lifeMax:1.2, sizeMin:4, sizeMax:14, grav:600});
      }, i*5);
    }
    
    /* 多重冲击波 */
    for(let r=0;r<6;r++){
      setTimeout(()=>{
        if(!G || gameState!=='playing') return;
        addEffect('hitRing', targetX(), targetY()-20, 0.5, {color:r%3===0?'#dbe4e8':r%3===1?'#88ccff':'#aaddff', r:50+r*35});
      }, r*70);
    }
    
    /* 持续电弧 - 地面电击 */
    for(let i=0;i<20;i++){
      setTimeout(()=>{
        if(!G || gameState!=='playing') return;
        const a = i*(TAU/20), dist = rand(60, 180);
        const fx = targetX()+Math.cos(a)*dist, fy = targetY()+Math.sin(a)*dist*0.4;
        addEffect('lightning', fx-20, fy-100, 0.4, {endX:fx, endY:fy, color:'#88ccff', width:2});
        spawnParticles(fx, fy, 2, {color:'#aaddff', angle:-Math.PI/2, spread:1.2, spMin:150, spMax:500, lifeMin:0.3, lifeMax:0.8, sizeMin:3, sizeMax:8, grav:500});
      }, i*50);
    }
    
    /* 屏幕震动和闪光 */
    G.shake = Math.max(G.shake, 50); G.flash = 0.22; G.hitFlashColor = '#88ccff'; fxHitstop(0.3);
    
    /* 文字特效 */
    spawnText(targetX(), targetY(), 250, '雷 霆 万 钧', '#88ccff', 52);
    
  }, 1200);
}

/* ============================================================
   ★★★ DNF 式觉醒技（4 / 5 / 6 号技能槽）★★★
   取材：热门小说与影视作品中的成名绝技
   设计原则：123 为基础技，456 为觉醒技 —— 伤害与特效逐级递增
   ============================================================ */
function skAt(ms, fn){ setTimeout(function(){ if(!G || gameState !== 'playing') return; fn(); }, ms); }
function skShake(v, f, color){
  if(!G) return;
  G.shake = Math.max(G.shake, v);
  if(f){ G.flash = Math.max(G.flash, f); G.hitFlashColor = color || '#dbe4e8'; }
}
function skBurst(x, y, color, n, extra){
  spawnParticles(x, y, n || 24, Object.assign({ color:color, spMin:120, spMax:520, lifeMin:0.25, lifeMax:0.75, sizeMin:3, sizeMax:8, grav:420 }, extra || {}));
}
function skRingBurst(cx, cy, r, color, n){
  const cnt = n || 10;
  for(let i=0;i<cnt;i++){
    const a = i/cnt*TAU;
    skBurst(cx+Math.cos(a)*r, cy+Math.sin(a)*r*0.5, color, 5, {angle:a, spread:0.7, spMin:90, spMax:300});
  }
}

/* ---------- 宝剑剑士 4：天雷剑诀（《仙剑奇侠传》蜀山御雷） ----------
   ★ 特色：以剑引雷、雷随剑走 —— 天雷先劈在剑尖上，把剑掷出后落点即雷击点，
     雷电再从落点沿附近敌人**连锁传导（雷链）**，每跳衰减，最后一节点雷爆收尾。
   与其余五招彻底区分：不落剑雨(万剑归宗)、不起剑阵(诛仙剑阵)、不是万剑齐发(剑来)、
   不走残剑(剑二十三)、也不是一道剑气冲天(剑开天门)——本招的核心是「电」的传导。 */
function castSwordImmortal(){
  const p = currentSkillCaster || G.player; playSound('skillCast');
  const A = skillAtkVal(p);
  const tg = skAim(p, 280);                 /* 活坐标：剑与雷都追着目标 */
  p.action = { type:'swordCharge', dur:0.6, t:0 };
  spawnText(p.x, p.y, 208, '天 雷 剑 诀', '#bfe0ff', 44);
  skCastAura(p, 0.6, '#bfe0ff', 3);

  const CX = () => clamp(tg.x, WORLD_L + 60, WORLD_R - 60);
  const CY = () => clamp(tg.y, GY_TOP + 20, GY_BOTTOM);

  /* ① 引雷入剑：一道天雷从天上劈在举起的剑尖上 */
  addEffect('lightning', p.x + p.facing*30, p.y - 60, 0.5, {color:'#eaf6ff', scale:1.1, fromY:-320});
  addEffect('hitRing', p.x + p.facing*30, p.y - 60, 0.4, {color:'#bfe0ff', r:80});

  skAt(420, ()=>{
    if(!G || gameState !== 'playing') return;
    playSound('thunder');
    /* ② 掷剑引雷：本命剑带电飞出（用手中这柄剑的模型），落点即雷击点 */
    const sx = p.x + p.facing*46, sy = p.y - 58;
    const dy = (CY() - 24) - sy;
    const ang = Math.atan2(dy, CX() - sx);
    const dist = Math.max(60, Math.hypot(CX() - sx, dy));
    const spd = 1700;
    G.projectiles.push({ kind:'realSword', x:sx, y:sy, h:1,
      vx:Math.cos(ang)*spd, vy:Math.sin(ang)*spd,
      life: Math.min(0.7, dist/spd + 0.06), w:120, hh:90,
      dmg:A*30, pierce:1, hitSet:new Set(), rot:ang, scale:1.6,
      color:'#bfe0ff', owner:p });
    addEffect('slashArc', sx + p.facing*40, sy, 0.18, {facing:p.facing, color:'#bfe0ff', size:0.9, typeStr:'stab'});

    /* ③ 雷落 + 雷链：★ 雷击总段数固定为 5 段（首段落雷 + 4 段续击）
       有别的敌人 → 雷电在怪之间跳；场上只有一个敌人 → 4 段续击全部劈在它身上 */
    skAt(150, ()=>{
      if(!G || gameState !== 'playing') return;
      let nodeX = CX(), nodeY = CY();
      addEffect('lightning', nodeX, nodeY, 0.55, {color:'#eaf6ff', scale:1.4, fromY:-360});
      addEffect('explosion', nodeX, nodeY - 20, 0.5, {color:'#bfe0ff', r:120});
      addEffect('hitRing', nodeX, nodeY, 0.45, {color:'#eaf6ff', r:120});
      meleeAoe(p, nodeX, nodeY, 120, A*15, {kb:180});
      /* 首段已命中的目标记下来，优先跳向「没被电过」的敌人 */
      const hitSet = new Set();
      for(const e of G.enemies){
        if(e.alive && Math.abs(e.x - nodeX) < 120 && Math.abs(e.y - nodeY) < 80) hitSet.add(e);
      }
      /* 先算好 4 段续击的落点（优先新目标，没有就重复劈当前目标） */
      const chainPath = [];
      let cx2 = nodeX, cy2 = nodeY, dmgMul = 1;
      for(let hop = 0; hop < 4; hop++){
        dmgMul *= 0.82;                     /* 每段衰减，首段最痛 */
        let best = null, bd = Infinity;
        for(const e of G.enemies){
          if(!e.alive || hitSet.has(e)) continue;
          const d = Math.hypot(e.x - cx2, e.y - cy2);
          if(d < 300 && d < bd){ bd = d; best = e; }
        }
        let repeat = false;
        if(!best){
          /* ★ 没有可跳的新目标：雷回到当前目标继续劈，保证总段数不变 */
          for(const e of G.enemies){
            if(!e.alive) continue;
            const d = Math.hypot(e.x - cx2, e.y - cy2);
            if(d < 360 && d < bd){ bd = d; best = e; }
          }
          repeat = !!best;
        }
        if(!best) break;
        chainPath.push({ tgt:best, mul:dmgMul, repeat:repeat, fromX:cx2, fromY:cy2 });
        if(!repeat) hitSet.add(best);
        cx2 = best.x; cy2 = best.y;
      }
      /* 按 90ms 一节依次落雷，雷链/续劈各有对应表现 */
      chainPath.forEach((nd, i)=>{
        skAt(90 * (i + 1), ()=>{
          if(!G || gameState !== 'playing') return;
          const tx = (nd.tgt && nd.tgt.alive) ? nd.tgt.x : nd.fromX;   /* 用实时位置，目标跑不掉 */
          const ty = (nd.tgt && nd.tgt.alive) ? nd.tgt.y : nd.fromY;
          if(nd.repeat){
            /* 同一目标续劈：竖直落雷 */
            addEffect('lightning', tx, ty, 0.34, {color:'#eaf6ff', scale:0.9, fromY:-300});
            addEffect('hitRing', tx, ty, 0.3, {color:'#bfe0ff', r:52});
          } else {
            /* 换目标：两道闪电之间的雷链 */
            addEffect('chainBolt', nd.fromX, nd.fromY - 40, 0.3, {endX:tx, endY:ty - 40, color:'#eaf6ff'});
            addEffect('hitRing', tx, ty, 0.3, {color:'#bfe0ff', r:64});
          }
          meleeAoe(p, tx, ty, 96, A*15*nd.mul, {kb:120});
        });
      });
      /* ④ 收雷：最后一段落点雷爆 */
      const lastN = chainPath.length ? chainPath[chainPath.length - 1] : null;
      skAt(90 * chainPath.length + 170, ()=>{
        if(!G || gameState !== 'playing') return;
        const lx = (lastN && lastN.tgt && lastN.tgt.alive) ? lastN.tgt.x : nodeX;
        const ly = (lastN && lastN.tgt && lastN.tgt.alive) ? lastN.tgt.y : nodeY;
        addEffect('explosion', lx, ly - 20, 0.6, {color:'#eaf6ff', r:150});
        addEffect('hitRing', lx, ly, 0.5, {color:'#ffffff', r:150});
        meleeAoe(p, lx, ly, 150, A*20, {kb:380, launch:true});
        skShake(16, 0.22, '#eaf6ff');
        fxHitstop(0.06);
        if(p.action && p.action.type === 'swordCharge') p.action = null;
      });
    });
  });
}

/* ---------- 宝剑剑士 5：诛仙剑阵（萧鼎《诛仙》） ---------- */
function castSwordTruthArray(){
  const p = currentSkillCaster || G.player; playSound('skillCast');
  const A = skillAtkVal(p);
  const tg = skAim(p, 240);                  /* 活坐标：剑阵中心全程跟着目标 */
  skCastPose(p, 2.4, '诛 仙 剑 阵', '#c4b0ff', 46);
  skCastAura(p, 2.4, '#c4b0ff', 3);
  const cxF = () => clamp(tg.x, WORLD_L + 220, WORLD_R - 220);
  const cyF = () => clamp(tg.y, GY_TOP + 20, GY_BOTTOM);

  /* ★ 四剑「圆环」围住敌人（不是一排）：
     上(远) / 右 / 下(近) / 左 四个方位绕成一圈；按纵深排序绘制，远的先画、近的盖在后面，
     这样读起来就是一圈插在地上的剑把敌人圈在阵中央。 */
  const RING_RX = 200, RING_RY = 88;
  const ring = [-Math.PI/2, 0, Math.PI/2, Math.PI]
    .map(a => ({ ox: Math.cos(a) * RING_RX, oy: Math.sin(a) * RING_RY }))
    .sort((a, b) => a.oy - b.oy);

  /* ① 四柄本命剑自天而降，剑尖插入地面（手中剑模型） */
  ring.forEach((sp, i)=>{
    skAt(120 + i * 95, ()=>{
      if(!G || gameState !== 'playing') return;
      playSound('swordSwing');
      addEffect('swordStake', cxF() + sp.ox, cyF() + sp.oy, 2.5, {color:'#c4b0ff', scale:1.65, fallDur:0.3, fromH:660});
      meleeAoe(p, cxF() + sp.ox, cyF() + sp.oy, 88, A*6, {kb:80});
      addEffect('hitRing', cxF() + sp.ox, cyF() + sp.oy, 0.4, {color:'#e8e0ff', r:70});
      skShake(6, 0.04, '#c4b0ff');
    });
  });

  /* ② 剑阵激活：地面剑气在圆环内横向贯穿扫射 */
  skAt(720, ()=>{
    if(!G || gameState !== 'playing') return;
    let wave = 0;
    const timer = setInterval(()=>{
      if(!G || gameState !== 'playing'){ clearInterval(timer); return; }
      wave++;
      const zL = cxF() - RING_RX * 1.08, zR = cxF() + RING_RX * 1.08;
      const zx = (zL + zR) / 2, zw = zR - zL;
      /* ★ 剑气横扫：整条阵线一次判定 —— 视觉（左右剑之间的光带）与命中范围一致 */
      meleeHitRect(p, zx, cyF(), zw, 240, A*12, {kb:120});
      addEffect('spearLine', zL, cyF() - 46, 0.26, {endX:zR, endY:cyF() - 46, color:'#e8e0ff', width:14});
      addEffect('spearLine', zR, cyF() - 26, 0.26, {endX:zL, endY:cyF() - 26, color:'#c4b0ff', width:10});
      addEffect('hitRing', zx, cyF(), 0.32, {color:'#d0c8ff', r:190});
      skShake(7, 0.03, '#c4b0ff');
      if(wave >= 6){
        clearInterval(timer);
        /* ③ 收阵：四剑齐鸣，阵心爆发 */
        skAt(150, ()=>{
          if(!G || gameState !== 'playing') return;
          meleeAoe(p, zx, cyF(), 320, A*60, {kb:520, launch:true});
          addEffect('explosion', zx, cyF() - 20, 0.9, {color:'#c4b0ff', r:260});
          addEffect('hitRing', zx, cyF(), 0.8, {color:'#ffffff', r:300});
          ring.forEach(sp=> addEffect('skyPillar', cxF() + sp.ox, cyF() + sp.oy, 0.7, {height:520, color:'#e8e0ff'}));
          skShake(26, 0.4, '#c4b0ff');
          fxHitstop(0.08);
        });
      }
    }, 200);
    skShake(10, 0.12, '#c4b0ff');
  });
}

/* ---------- 宝剑剑士 6：剑来（烽火戏诸侯《剑来》） ---------- */
function castSwordCome(){
  const p = currentSkillCaster || G.player; playSound('skillCast');
  const A = skillAtkVal(p);
  spawnText(p.x, p.y, 215, '剑 来', '#ffffff', 54);
  p.action = { type:'swordCharge', dur:0.9, t:0 };
  /* 天一黑：整片天空裂开 */
  for(let i=0;i<6;i++){
    skAt(i*85, ()=>{
      const cxx = clamp(p.x + (i-2.5)*190, WORLD_L, WORLD_R);
      addEffect('skyCrack', cxx, 120 + (i%2)*44, 1.5, {width:280, color:i%2?'#ffffff':'#cfeaff'});
      addEffect('skyGlow', cxx, 150, 1.25, {color:'#cfeaff'});
    });
  }
  skAt(300, ()=> skShake(15, 0.32, '#eaf6ff'));
  /* 万剑垂落 */
  let n = 0;
  const rain = setInterval(()=>{
    if(!G || gameState !== 'playing'){ clearInterval(rain); return; }
    n++;
    /* ★ 集火模式：敌人少时所有剑集中攻击目标 */
    const alive = G.enemies.filter(e=>e.alive);
    let focusX = null, focusY = null;
    if(alive.length > 0 && alive.length <= 3){
      /* 找最近的敌人作为集火中心 */
      let bestE = alive[0], bestD = Infinity;
      for(const e of alive){
        const d = (e.x-p.x)*(e.x-p.x)+(e.y-p.y)*(e.y-p.y);
        if(d < bestD){ bestD = d; bestE = e; }
      }
      focusX = bestE.x;
      focusY = bestE.y;
    }
    for(let k=0;k<2;k++){
      /* ★ 每一柄剑都从「敌人的正上方」生成、剑尖对准敌人刺下去
         （以前是满天随机洒，剑身还只按飞行方向歪斜，看起来根本不在刺人） */
      let ex, ey, aimRef = null;
      if(alive.length){
        const e2 = alive[(Math.random() * alive.length) | 0];
        aimRef = e2;
        ex = clamp(e2.x + rand(-55, 55), WORLD_L, WORLD_R);
        ey = clamp(e2.y + rand(-14, 14), GY_TOP + 20, GY_BOTTOM);
      } else {
        ex = clamp(p.x + p.facing * rand(120, 380), WORLD_L, WORLD_R);
        ey = rand(GY_TOP + 60, GY_BOTTOM);
      }
      const sx2 = ex + rand(-36, 36), sy2 = ey - 430;
      const aimA = Math.atan2(ey - sy2, ex - sx2);       /* 剑尖 → 敌人 */
      const spd2 = 1560;
      G.projectiles.push({ kind:'glowWeapon', weaponType:'sword', x:sx2, y:sy2, h:1,
        vx:Math.cos(aimA)*spd2, vy:Math.sin(aimA)*spd2, life:0.36, w:104, hh:150,
        dmg:A*12, pierce:2, hitSet:new Set(), color:'#cfeaff', rot:aimA, scale:1.7, owner:p, aimTip:true, aimRef:aimRef });
      /* ★ 判定加宽：剑速 1560px/s（每帧约 25px），原来 hh=76 的垂直窗口只有 ~26px，
         高速下会整帧跳过敌人（穿模）导致“剑扎下来了却没打中”；现放宽到 132 */
      spawnParticles(ex, ey, 2, {color:'#eaf6ff', angle:-Math.PI/2, spread:1.1, spMin:70, spMax:220, lifeMin:0.2, lifeMax:0.5, sizeMin:2, sizeMax:5, grav:320});
      if(k === 0 && n % 3 === 0) addEffect('hitRing', ex, ey, 0.32, {color:'#eaf6ff', r:52});
    }
    if(n >= 34){
      clearInterval(rain);
      skAt(230, ()=>{
        if(!G || gameState !== 'playing') return;
        const tg2 = skAim(p, 220);            /* 活坐标 */
        const tx = clamp(tg2 ? tg2.x : p.x + p.facing*220, WORLD_L, WORLD_R);
        /* 天地一剑 */
        addEffect('skyPillar', tx, GY_BOTTOM, 1.7, {height:920, color:'#ffffff'});
        addEffect('giganticSword', tx, GY_BOTTOM, 1.25, {color:'#eaf6ff'});
        addEffect('skyCrack', tx, 90, 1.3, {width:420, color:'#ffffff'});
        meleeAoe(p, tx, GY_BOTTOM - 40, 300, A*260, {kb:640, launch:true});
        meleeAoe(p, tx, GY_BOTTOM - 40, 520, A*60, {kb:220});
        addEffect('explosion', tx, GY_BOTTOM - 40, 0.9, {color:'#bcd8e4', r:230});
        addEffect('hitRing', tx, GY_BOTTOM - 40, 0.8, {color:'#cfe0e8', r:280});
        skShake(34, 0.55, '#ffffff');
        fxHitstop(0.16);
        skBurst(tx, GY_BOTTOM - 40, '#cfe0e8', 20, {spMin:200, spMax:760, lifeMin:0.28, lifeMax:0.8, sizeMin:2, sizeMax:7});
        skRingBurst(tx, GY_BOTTOM - 40, 200, '#eaf6ff', 12);
      });
    }
  }, 55);
}

/* ---------- 大刀剑客 4：阿鼻道三刀（《天下第一》· 归海一刀） ---------- */
function castBladeAbyss(){
  const p = currentSkillCaster || G.player; playSound('skillCast');
  const A = skillAtkVal(p);
  spawnText(p.x, p.y, 205, '阿 鼻 道 三 刀', '#ff2a4a', 40);
  p.action = { type:'bladeCharge', dur:0.42, t:0 };
  const MUL = [30, 36, 80];
  for(let i=0;i<3;i++){
    skAt(170 + i*235, ()=>{
      const tg = skAim(p, 200);             /* 活坐标 */
      if(tg){
        p.facing = tg.x > p.x ? 1 : -1;
        /* 交错瞬身：一刀一换位，形成十字斩 */
        const side = (i % 2 === 0) ? -1 : 1;
        p.x = clamp(tg.x + side * 130, WORLD_L + 30, WORLD_R - 30);
      }
      if(i === 0 && p.action && p.action.type === 'bladeCharge') p.action = null;
      playSound('bladeSwing');
      addEffect('afterImage', p.x, p.y, 0.44, {facing:p.facing, weaponIdx:p.weaponIdx, anim:'skill', alpha:0.62, color:'#ff2a4a'});
      const sx = p.x + p.facing*92;
      /* ★ 单道弧光，大小贴齐 350 宽命中矩形（原来两层 3.2/2.3 大弧纯属装饰） */
      addEffect('slashArc', sx, p.y, 0.4, {facing:p.facing, color:'#ff2a4a', size:1.4, typeStr:'blade'});
      addEffect('spaceCrack', p.x + p.facing*150, p.y - 50, 0.5, {width:270, height:96, color:'#ff2a4a'});
      addEffect('groundCrack', p.x + p.facing*100, p.y, 0.95, {angle:p.facing>0?0:Math.PI, color:'#ff2a4a'});
      meleeHitRect(p, skFall(p, tg, 150, 900).x, p.y, 350, 200, A*MUL[i], {kb:i===2?540:190, launch:i===2});
      skBurst(sx, p.y-60, '#ff2a4a', 9, {angle:p.facing>0?0:Math.PI, spread:0.65, spMin:180, spMax:640});
      addEffect('hitRing', sx, p.y, 0.42, {color:'#ff2a4a', r:69+i*34});
      skShake(9 + i*6, 0.1 + i*0.1, '#ff2a4a');
      if(i === 2){
        skShake(24, 0.36, '#ff4a5a');
        fxHitstop(0.1);
        for(let k=0;k<3;k++){
          skAt(k*70, ()=> addEffect('explosion', p.x + p.facing*150, p.y - 40, 0.55, {color:'#ff2a4a', r:97 + k*55}));
        }
      }
    });
  }
}

/* ---------- 大刀剑客 5：傲寒六诀（《风云》· 聂风） ---------- */
function castBladeFrostSix(){
  const p = currentSkillCaster || G.player; playSound('skillCast');
  const A = skillAtkVal(p);
  const tg0 = skAim(p, 290);            /* 活坐标 */
  if(tg0) p.facing = tg0.x > p.x ? 1 : -1;
  const dir = p.facing;
  spawnText(p.x, p.y, 205, '傲 寒 六 诀', '#bfe8ff', 40);
  p.action = { type:'bladeCharge', dur:0.55, t:0 };
  /* 结霜蓄势 */
  for(let i=0;i<18;i++){
    skAt(i*28, ()=>{
      const a = (i/18)*TAU, r = 82 - i*3;
      spawnParticles(p.x + Math.cos(a)*r, p.y - 55 + Math.sin(a)*r*0.5, 1,
        {color:i%2?'#dff4ff':'#8fd4ff', angle:a+Math.PI, spread:0.5, spMin:60, spMax:190, lifeMin:0.3, lifeMax:0.62, sizeMin:2, sizeMax:6, grav:-40});
    });
  }
  addEffect('hitRing', p.x, p.y, 0.6, {color:'#bfe8ff', r:84});
  skAt(520, ()=>{
    if(!G || gameState !== 'playing') return;
    if(p.action && p.action.type === 'bladeCharge') p.action = null;
    /* 六诀连斩：六道冰蓝刀气依次推进 */
    for(let i=0;i<6;i++){
      skAt(i*108, ()=>{
        playSound('bladeSwing');
        const ox = p.x + dir*(70 + i*68);
        G.projectiles.push({ kind:'glowWeapon', weaponType:'blade', x:ox, y:p.y, h:52, vx:dir*1180, vy:0, life:0.6, w:150, hh:96,
          dmg:A*22, pierce:99, hitSet:new Set(), color:i===5?'#dbe4e8':'#8fd4ff', rot:dir>0?0:Math.PI, scale:2.2, owner:p });
        addEffect('slashArc', ox, p.y, 0.3, {facing:dir, color:'#bfe8ff', size:1.8, typeStr:'blade'});
        addEffect('hitRing', ox, p.y, 0.42, {color:'#bfe8ff', r:56});
        addEffect('groundCrack', p.x + dir*(90 + i*80), p.y, 1.1, {angle:dir>0?0:Math.PI, color:'#8fd4ff'});
        skBurst(ox, p.y-50, '#bfe8ff', 6, {angle:dir>0?0:Math.PI, spread:0.7, spMin:150, spMax:470, grav:120});
        skShake(6, 0.05, '#bfe8ff');
      });
    }
    /* 第六诀 · 冰爆 */
    skAt(700, ()=>{
      if(!G || gameState !== 'playing') return;
      /* ★ 落点用目标的活坐标（含 Y）：以前固定用 p.y 判定，怪在别的纵深就砸空了 */
      const _fall = skFall(p, tg0, 290, 900);
      const tx = clamp(_fall.x, WORLD_L, WORLD_R);
      const ty = clamp(_fall.y, GY_TOP + 20, GY_BOTTOM);
      addEffect('explosion', tx, ty-40, 0.8, {color:'#bfe8ff', r:191});
      addEffect('hitRing', tx, ty, 0.78, {color:'#dbe4e8', r:214});
      addEffect('spearLine', p.x + dir*40, p.y-60, 0.5, {endX:tx + dir*170, endY:ty-60, color:'#bfe8ff', width:28});
      meleeAoe(p, tx, ty, 295, A*70, {kb:470, launch:true});
      skBurst(tx, ty-40, '#dff4ff', 16, {spMin:200, spMax:770, grav:160});
      addEffect('skyCrack', tx, ty-260, 0.9, {width:240, color:'#bfe8ff'});
      skShake(22, 0.3, '#dff4ff');
      fxHitstop(0.08);
    });
  });
}

/* ---------- 大刀剑客 6：焰分噬浪尺（天蚕土豆《斗破苍穹》· 药老） ---------- */
function castBladeRulerFlame(){
  const p = currentSkillCaster || G.player; playSound('skillCast');
  const A = skillAtkVal(p);
  const tg = skAim(p, 260);             /* 活坐标 */
  const tx = () => clamp(tg.x, WORLD_L + 70, WORLD_R - 70);
  const gy = () => clamp(tg.y, GY_TOP + 20, GY_BOTTOM);
  spawnText(p.x, p.y, 215, '焰 分 噬 浪 尺', '#ffa030', 42);
  p.action = { type:'bladeCharge', dur:1.0, t:0 };
  /* 天幕被灼开 */
  addEffect('skyCrack', tx(), 80, 1.4, {width:380, color:'#ffb040'});
  addEffect('skyGlow', tx(), 130, 1.4, {color:'#ff8a20'});
  for(let i=0;i<22;i++){
    skAt(i*32, ()=>{
      spawnParticles(tx() + rand(-150,150), rand(-40, 220), 3,
        {color:i%3===0?'#fff2c0':'#ff8a20', angle:Math.PI/2, spread:0.6, spMin:80, spMax:270, lifeMin:0.4, lifeMax:0.9, sizeMin:3, sizeMax:8, grav:200});
    });
  }
  skAt(900, ()=>{
    if(!G || gameState !== 'playing') return;
    if(p.action && p.action.type === 'bladeCharge') p.action = null;
    playSound('bladeSwing');
    /* 巨尺落下（★ f=施法者朝向：刀柄在自己头顶一侧，刀尖劈向敌人） */
    addEffect('giganticWeapon', tx(), gy(), 1.15, {weaponType:'blade', color:'#ff8a20', scale:5.2, rot:0.62, f:p.facing});
    addEffect('skyPillar', tx(), gy(), 1.25, {height:780, color:'#ff8a20'});
    meleeAoe(p, tx(), gy(), 265, A*180, {kb:640, launch:true});
    addEffect('explosion', tx(), gy(), 0.9, {color:'#ff8a20', r:345});
    addEffect('hitRing', tx(), gy(), 0.9, {color:'#fff2c0', r:365});
    skShake(30, 0.48, '#ffb040');
    fxHitstop(0.14);
    skBurst(tx(), gy(), '#ff8a20', 18, {spMin:220, spMax:880, grav:520});
    skRingBurst(tx(), gy(), 170, '#ffcc60', 10);
    /* 火焰裂谷持续灼烧 */
    let t = 0;
    const rift = setInterval(()=>{
      if(!G || gameState !== 'playing'){ clearInterval(rift); return; }
      t++;
      meleeAoe(p, tx(), gy(), 215, A*12, {kb:80});
      for(let i=0;i<4;i++){
        addEffect('groundFire', tx() + (i-1.5)*130 + rand(-20,20), gy() - rand(0,10), 0.55, {size:rand(38,72)});
      }
      addEffect('hitRing', tx(), gy(), 0.42, {color:'#ff8a20', r:205});
      skBurst(tx() + rand(-170,170), gy(), t%2 ? '#ffcc60' : '#ff5a10', 6, {angle:-Math.PI/2, spread:1.0, spMin:90, spMax:330, grav:-60});
      skShake(5, 0.04, '#ff8a20');
      if(t >= 12){
        clearInterval(rift);
        addEffect('explosion', tx(), gy(), 0.8, {color:'#ffcc60', r:285});
        meleeAoe(p, tx(), gy(), 305, A*40, {kb:320});
      }
    }, 260);
  });
}

/* ---------- 长枪枪手 4：百鸟朝凤枪（三国 · 童渊传赵云） ---------- */
function castSpearPhoenix(){
  const p = currentSkillCaster || G.player; playSound('skillCast');
  const A = skillAtkVal(p);
  const tg = skAim(p, 160);             /* 活坐标 */
  if(tg) p.facing = tg.x > p.x ? 1 : -1;
  spawnText(p.x, p.y, 205, '百 鸟 朝 凤 枪', '#ffd96a', 40);
  p.action = { type:'spearCharge', dur:0.5, t:0 };
  /* 百鸟绕身盘旋 */
  for(let i=0;i<28;i++){
    skAt(i*20, ()=>{
      const a = (i/28)*TAU*2, r = 72 + Math.sin(i*0.7)*30;
      spawnParticles(p.x + Math.cos(a)*r, p.y - 60 + Math.sin(a)*r*0.6, 1,
        {color:i%3===0?'#fff7c0':(i%3===1?'#ffd96a':'#ff9a3a'), angle:a+Math.PI/2, spread:0.4, spMin:70, spMax:230, lifeMin:0.25, lifeMax:0.56, sizeMin:2, sizeMax:6, grav:-90});
    });
  }
  addEffect('hitRing', p.x, p.y, 0.5, {color:'#ffd96a', r:78});
  skAt(500, ()=>{
    if(!G || gameState !== 'playing') return;
    if(p.action && p.action.type === 'spearCharge') p.action = null;
    playSound('spearThrust');
    const N = 12;
    for(let i=0;i<N;i++){
      skAt(i*46, ()=>{
        if(!G || gameState !== 'playing') return;
        const alive = G.enemies.filter(e=>e.alive);
        let ang;
        if(alive.length){
          const e2 = alive[(Math.random()*alive.length)|0];
          ang = Math.atan2((e2.y - p.y)*0.5, e2.x - p.x) + rand(-0.12, 0.12);
        } else {
          ang = -Math.PI*0.5 + (i/N - 0.5) * 2.2;
        }
        const sp = 1020;
        G.projectiles.push({ kind:'glowWeapon', weaponType:'spear', x:p.x + p.facing*40, y:p.y - 50, h:1,
          vx:Math.cos(ang)*sp, vy:Math.sin(ang)*sp*0.55, life:0.72, w:120, hh:58, dmg:A*9, pierce:1,
          hitSet:new Set(), color:i%3===0?'#fff7c0':'#ffd96a', rot:ang, scale:1.5, owner:p, phoenix:true });
        addEffect('slashArc', p.x + p.facing*70, p.y - 50, 0.24, {facing:p.facing, color:'#ffd96a', size:1.3, typeStr:'stab'});
        skBurst(p.x + p.facing*60, p.y - 55, '#ffd96a', 4, {angle:ang, spread:0.5, spMin:180, spMax:520, grav:60});
        skShake(4, 0, '#ffd96a');
      });
    }
    /* 凤鸣：最后一声 */
    skAt(N*46 + 40, ()=>{
      if(!G || gameState !== 'playing') return;
      addEffect('explosion', p.x + p.facing*120, p.y - 60, 0.7, {color:'#ffd96a', r:144});
      addEffect('hitRing', p.x, p.y, 0.6, {color:'#fff7c0', r:142});
      meleeAoe(p, skFall(p, tg, 130, 900).x, p.y, 250, A*26, {kb:320, launch:true});
      skShake(16, 0.24, '#ffd96a');
    });
  });
}

/* ---------- 长枪枪手 5：暴雨梨花枪（杨家枪法 · 《说唐》） ---------- */
function castSpearRainStorm(){
  const p = currentSkillCaster || G.player; playSound('skillCast');
  const A = skillAtkVal(p);
  const tg = skAim(p, 220);             /* 活坐标 */
  const dir = p.facing;
  const cx = () => clamp(tg.x, WORLD_L, WORLD_R);
  const gy = () => clamp(tg.y, GY_TOP + 20, GY_BOTTOM);
  spawnText(p.x, p.y, 205, '暴 雨 梨 花 枪', '#bfe0ff', 40);
  p.action = { type:'spearCharge', dur:0.8, t:0 };
  addEffect('skyGlow', cx(), 150, 1.2, {color:'#bfe0ff'});
  addEffect('hitRing', cx(), p.y, 0.7, {color:'#bfe0ff', r:180});
  skAt(320, ()=>{
    if(!G || gameState !== 'playing') return;
    if(p.action && p.action.type === 'spearCharge') p.action = null;
    let n = 0;
    const rain = setInterval(()=>{
      if(!G || gameState !== 'playing'){ clearInterval(rain); return; }
      n++;
      for(let k=0;k<2;k++){
        const ex = clamp(cx() + rand(-150, 150), WORLD_L, WORLD_R);
        const ey = rand(GY_TOP + 20, GY_BOTTOM);
        /* 落点收窄 + 判定窗口加宽：枪速 1420px/s 每帧约 23px，原来 hh=64 会穿模漏判 */
        G.projectiles.push({ kind:'glowWeapon', weaponType:'spear', x:ex + rand(-30,30), y:ey - 380, h:1,
          vx:0, vy:1420, life:0.30, w:96, hh:124, dmg:A*8, pierce:2, hitSet:new Set(),
          color:n%4===0?'#dbe4e8':'#bfe0ff', rot:Math.PI/2, scale:1.75, owner:p });
        spawnParticles(ex, ey, 2, {color:'#bfe0ff', angle:-Math.PI/2, spread:0.9, spMin:60, spMax:200, lifeMin:0.2, lifeMax:0.45, sizeMin:2, sizeMax:5, grav:340});
      }
      if(n % 3 === 0){
        addEffect('hitRing', cx() + rand(-220,220), gy(), 0.32, {color:'#bfe0ff', r:56});
        playSound('spearThrust');
      }
      skShake(3, 0.02, '#bfe0ff');
      if(n >= 18){
        clearInterval(rain);
        skAt(120, ()=>{
          if(!G || gameState !== 'playing') return;
          /* 梨花绽放 */
          for(let i=0;i<5;i++) addEffect('explosion', cx() + (i-2)*90, gy(), 0.6, {color:'#bfe0ff', r:150});
          addEffect('hitRing', cx(), gy(), 0.85, {color:'#dbe4e8', r:330});
          meleeAoe(p, cx(), gy(), 350, A*75, {kb:480, launch:true});
          skBurst(cx(), gy(), '#dff0ff', 19, {spMin:220, spMax:820, grav:400});
          skShake(24, 0.34, '#dff0ff');
          fxHitstop(0.09);
        });
      }
    }, 60);
  });
}

/* ---------- 长枪枪手 6：蓝银霸王枪（唐家三少《斗罗大陆》） ---------- */
function castSpearBlueSilver(){
  /* 蓝银霸王枪（唐家三少《斗罗大陆》· 唐三）：蓝银草缠身 → 霸王枪贯顶 → 蓝银之力光爆
     特色：先用蓝银藤把敌人**钉在原地**，再让巨枪从天上贯穿，最后蓝银皇之力炸开。 */
  const p = currentSkillCaster || G.player; playSound('skillCast');
  const A = skillAtkVal(p);
  const tg = skAim(p, 230);                   /* 活坐标 */
  const tx = () => clamp(tg.x, WORLD_L + 70, WORLD_R - 70);
  const gy = () => clamp(tg.y, GY_TOP + 20, GY_BOTTOM);
  spawnText(p.x, p.y, 215, '蓝 银 霸 王 枪', '#8fe8ff', 42);
  p.action = { type:'spearCharge', dur:1.0, t:0 };
  skCastAura(p, 1.0, '#4fd0c0', 3);

  /* ① 天开一线 + 蓝银草自地而生，缠住目标 */
  addEffect('skyCrack', tx(), 70, 1.2, {width:300, color:'#8fe8ff'});
  for(let i = 0; i < 5; i++){
    skAt(i * 90, ()=>{
      if(!G || gameState !== 'playing') return;
      const gx = tx() + (i - 2) * 62;
      addEffect('vine', gx, gy() + 6, 1.4, {color:i % 2 ? '#4fd0c0' : '#8fe8ff', h:150 + (i % 3) * 40, n:2});
      /* 蓝银缠身：定住目标一小段（藤蔓就是“缠人”的视觉） */
      for(const e of G.enemies){
        if(e.alive && Math.abs(e.x - tx()) < 120 && Math.abs(e.y - gy()) < 70){
          e.rootT = Math.max(e.rootT || 0, 0.9);
        }
      }
      meleeAoe(p, gx, gy(), 84, A * 8, {kb: 0});
      skShake(5, 0.02, '#4fd0c0');
    });
  }

  /* ② 霸王枪自天而降，剑尖/枪尖朝下贯穿目标 */
  skAt(760, ()=>{
    if(!G || gameState !== 'playing') return;
    if(p.action && p.action.type === 'spearCharge') p.action = null;
    playSound('spearThrust');
    /* 巨枪：giganticWeapon 旋转 90° 让枪尖朝下，从天砸落 */
    addEffect('giganticWeapon', tx(), gy(), 1.0, {weaponType:'spear', color:'#8fe8ff', scale:4.6, rot:Math.PI/2, f:1});
    addEffect('skyPillar', tx(), gy(), 1.2, {height:820, color:'#8fe8ff'});
    addEffect('lightBloom', tx(), gy() - 30, 0.65, {r:190, rays:18, color:'#4fd0c0'});
    addEffect('hitRing', tx(), gy(), 0.9, {color:'#dbe4e8', r:300});
    meleeAoe(p, tx(), gy(), 220, A*150, {kb:520, launch:true});
    skShake(28, 0.45, '#8fe8ff');
    fxHitstop(0.12);

    /* ③ 蓝银皇之力爆发：三环扩散，每环都带蓝银光爆 */
    for(let s2 = 0; s2 < 3; s2++){
      skAt(150 + s2 * 160, ()=>{
        if(!G || gameState !== 'playing') return;
        addEffect('lightBloom', tx(), gy() - 26, 0.42, {r:150 + s2 * 70, rays:14 + s2 * 4, color: s2 % 2 ? '#8fe8ff' : '#4fd0c0'});
        addEffect('hitRing', tx(), gy(), 0.5, {color:'#dbe4e8', r:260 + s2 * 90});
        meleeAoe(p, tx(), gy(), 300 + s2 * 80, A*35, {kb:220 + s2*100, launch: s2 === 2});
        skShake(12, 0.16, '#8fe8ff');
      });
    }
    /* 蓝银余韵：地面残留藤蔓（接触持续掉血） */
    for(let i = 0; i < 3; i++){
      addEffect('vine', tx() + (i-1)*90, gy() + 6, 1.6, {color:'#4fd0c0', h:120, n:2});
    }
  });
}

/* ---------- 格斗家 4：八极崩（天蚕土豆《斗破苍穹》· 萧炎） ---------- */
function castFistEightExtremes(){
  const p = currentSkillCaster || G.player; playSound('skillCast');
  const A = skillAtkVal(p);
  spawnText(p.x, p.y, 205, '八 极 崩', '#ffcc33', 42);
  p.action = { type:'fistCharge', dur:0.4, t:0 };
  /* 暗劲蓄势 */
  for(let i=0;i<16;i++){
    skAt(i*24, ()=>{
      const a = (i/16)*TAU, r = 64 - i*2.4;
      spawnParticles(p.x + Math.cos(a)*r, p.y - 58 + Math.sin(a)*r*0.5, 1,
        {color:i%2?'#ffe680':'#ffaa22', angle:a+Math.PI, spread:0.4, spMin:70, spMax:210, lifeMin:0.2, lifeMax:0.45, sizeMin:2, sizeMax:5, grav:-70});
    });
  }
  const N = 8;
  for(let i=0;i<N;i++){
    skAt(400 + i*108, ()=>{
      if(!G || gameState !== 'playing') return;
      if(i === 0 && p.action && p.action.type === 'fistCharge') p.action = null;
      const tg = skAim(p, 150);             /* 活坐标 */
      if(tg){
        p.facing = tg.x > p.x ? 1 : -1;
        p.x = clamp(lerp(p.x, tg.x - p.facing*70, 0.55), WORLD_L + 30, WORLD_R - 30);
      }
      const bx = p.x + p.facing*78, by = p.y - 58;
      const last = (i === N-1);
      playSound('fistPunch');
      /* 拳影 */
      addEffect('fistArc', bx, p.y, 0.26, {facing:p.facing, color:last?'#dbe4e8':'#ffcc33', scale:last?2.2:1.15, ring:last});
      addEffect('punchWave', bx, by, 0.3, {facing:p.facing, color:'#ffcc33', len:last?260:150});
      addEffect('hitRing', bx, p.y, 0.3, {color:'#ffcc33', r:last?150:70});
      meleeHitRect(p, bx + p.facing*30, p.y, 200, 200, A*(last?120:25), {kb:last?520:90, launch:last});
      skBurst(bx, by, '#ffcc33', last?40:12, {angle:p.facing>0?0:Math.PI, spread:0.7, spMin:160, spMax:last?760:440, grav:320});
      skShake(last?22:5, last?0.34:0.03, '#ffcc33');
      if(last){
        addEffect('explosion', bx + p.facing*60, by, 0.6, {color:'#ffcc33', r:166});
        addEffect('groundCrack', p.x + p.facing*120, p.y, 0.95, {angle:p.facing>0?0:Math.PI, color:'#ffcc33'});
        addEffect('groundCrack', p.x + p.facing*200, p.y, 0.95, {angle:p.facing>0?0:Math.PI, color:'#ffe680'});
        fxHitstop(0.08);
      }
    });
  }
}

/* ---------- 格斗家 5：大天造化掌（《斗破苍穹》· 天阶斗技） ---------- */
function castFistGreatPalm(){
  const p = currentSkillCaster || G.player; playSound('skillCast');
  const A = skillAtkVal(p);
  const tg = skAim(p, 200);             /* 活坐标 */
  const tx = () => clamp(tg.x, WORLD_L + 60, WORLD_R - 60);
  const gy = () => clamp(tg.y, GY_TOP + 20, GY_BOTTOM);
  spawnText(p.x, p.y, 215, '大 天 造 化 掌', '#ffd700', 44);
  p.action = { type:'fistMeditate', dur:0.9, t:0 };
  addEffect('skyCrack', tx(), 90, 1.3, {width:320, color:'#ffd700'});
  addEffect('skyGlow', tx(), 140, 1.3, {color:'#ffd700'});
  /* 佛光汇聚 */
  for(let i=0;i<20;i++){
    skAt(i*30, ()=>{
      const a = (i/20)*TAU;
      spawnParticles(tx() + Math.cos(a)*rand(60, 220), 200 + Math.sin(a)*80, 3,
        {color:i%3===0?'#fff6c0':'#ffd700', angle:Math.PI/2, spread:0.5, spMin:70, spMax:240, lifeMin:0.4, lifeMax:0.8, sizeMin:3, sizeMax:7, grav:180});
    });
  }
  skAt(880, ()=>{
    if(!G || gameState !== 'playing') return;
    if(p.action && p.action.type === 'fistMeditate') p.action = null;
    playSound('impact');
    /* 巨掌拍落 */
    addEffect('palmPrint', tx(), gy(), 1.5, {color:'#ffd700', scale:1.0});
    addEffect('skyPillar', tx(), gy(), 1.0, {height:640, color:'#ffd700'});
    meleeAoe(p, tx(), gy(), 320, A*280, {kb:560, launch:true});
    addEffect('explosion', tx(), gy(), 0.9, {color:'#ffd700', r:330});
    addEffect('hitRing', tx(), gy(), 0.95, {color:'#fff6c0', r:350});
    addEffect('lightBloom', tx(), gy() - 30, 0.6, {r:210, rays:18, color:'#ffd700'});   /* 光爆取代成片粒子 */
    skShake(28, 0.46, '#ffd700');
    fxHitstop(0.13);
    /* 掌印残留 · 持续碾压 */
    let t = 0;
    const crush = setInterval(()=>{
      if(!G || gameState !== 'playing'){ clearInterval(crush); return; }
      t++;
      meleeAoe(p, tx(), gy(), 260, A*32, {kb:60});
      addEffect('hitRing', tx(), gy(), 0.45, {color:'#ffd700', r:240});
      addEffect('goldenPillar', tx() + rand(-120,120), gy(), 0.35, {color:'#ffd700'});
      skShake(6, 0.04, '#ffd700');
      if(t >= 6){
        clearInterval(crush);
        addEffect('explosion', tx(), gy(), 0.75, {color:'#fff6c0', r:300});
        meleeAoe(p, tx(), gy(), 300, A*100, {kb:340});
      }
    }, 220);
  });
}

/* ---------- 格斗家 6：六道轮回拳（辰东《遮天》· 老疯子/叶凡） ---------- */
function castSixPathsFist(){
  const p = currentSkillCaster || G.player; playSound('skillCast');
  const A = skillAtkVal(p);
  spawnText(p.x, p.y, 200, '六 道 轮 回 拳', '#ff5a3c', 48);
  p.action = { type:'fistMeditate', dur:0.55, t:0 };

  /* 六道：天道(天神金光)/人道(帝王)/阿修罗道(修罗战神)/地狱道(炼狱)/饿鬼道(鬼气)/畜生道(妖气) */
  const PATHS = [
    { name:'天道',     col:'#ffd86b', anim:'skill', ft:0.0 },
    { name:'人道',     col:'#ff8a3c', anim:'atk1',  ft:0.5 },
    { name:'阿修罗道', col:'#ff2a4a', anim:'atk2',  ft:0.5 },
    { name:'地狱道',   col:'#9b5cff', anim:'atk3',  ft:0.5 },
    { name:'饿鬼道',   col:'#6bffb0', anim:'skill', ft:0.5 },
    { name:'畜生道',   col:'#4ab8ff', anim:'atk1',  ft:0.0 }
  ];

  /* 六道法相：身后六尊「角色本体光影」分身，环形排布、绕施法者缓缓轮转（各持不同出拳姿态） */
  for(let i=0;i<6;i++){
    const ang = i/6*TAU - Math.PI/2;
    addEffect('asuraAvatar', p.x + Math.cos(ang)*96, p.y - 78 + Math.sin(ang)*40, 2.4,
      { follow:p, orbit:ang, ringR:96, rotSpeed:0.7, spriteKey:'fist', anim:PATHS[i].anim, frameT:PATHS[i].ft, ghostH:88, color:PATHS[i].col, label:PATHS[i].name, facing:1 });
  }
  /* 起手 · 六色汇聚光 */
  addEffect('dharmaWheel', p.x, p.y, 1.6, { color:'#ff7a4a', r:150 });
  skShake(8, 0.18, '#ff7a4a');
  for(let i=0;i<30;i++){
    skAt(i*22, ()=>{
      const a = (i/30)*TAU*3, r = 110 + Math.sin(i*0.6)*38;
      spawnParticles(p.x + Math.cos(a)*r, p.y - 60 + Math.sin(a)*r*0.5, 1,
        { color:PATHS[i%6].col, angle:a+Math.PI/2, spread:0.4, spMin:80, spMax:240, lifeMin:0.3, lifeMax:0.7, sizeMin:2, sizeMax:6, grav:-120 });
    });
  }

  /* ★ 智能追踪：锁定最近敌人活坐标，全程跟随其移动 */
  const tg = skAim(p, 240);

  /* 0.55s：显化「轮回漩涡」笼罩战场，持续吞噬（每 0.25s 一记，六色轮转） */
  skAt(560, ()=>{
    if(!G || gameState !== 'playing') return;
    if(p.action && p.action.type === 'fistMeditate') p.action = null;
    if(tg && tg.has) addEffect('samsaraVortex', tg.x, tg.y, 1.7, { ref:tg.ref, color:'#ff5a3c' });
    for(let i=0;i<6;i++){
      skAt(i*250, ()=>{
        if(!G || gameState !== 'playing') return;
        const cx = tg ? tg.x : p.x + p.facing*220;
        const cy = tg ? tg.y : p.y;
        meleeAoe(p, cx, cy, 150, A*15, {kb:60});
        addEffect('hitRing', cx, cy, 0.45, { color:PATHS[i%6].col, r:96 });
        skBurst(cx, cy - 30, PATHS[i%6].col, 8, { spMin:120, spMax:420, grav:120 });
        skShake(6, 0.06, PATHS[i%6].col);
      });
    }
  });

  /* 0.9s 起 · 六拳合一：六记本尊重拳依次轰在追踪点上 */
  for(let i=0;i<6;i++){
    skAt(900 + i*160, ()=>{
      if(!G || gameState !== 'playing') return;
      const cx = tg ? tg.x : p.x + p.facing*200;
      const cy = tg ? tg.y : p.y;
      p.facing = cx >= p.x ? 1 : -1;
      playSound('fistPunch');
      addEffect('fistArc', cx, cy, 0.3, { facing:p.facing, color:PATHS[i%6].col, scale:2.0 + i*0.18, ring:true });
      addEffect('punchWave', p.x + p.facing*70, p.y, 0.3, { facing:p.facing, color:PATHS[i%6].col, len:150 });
      addEffect('hitRing', cx, cy, 0.4, { color:PATHS[i%6].col, r:80 + i*8 });
      meleeAoe(p, cx, cy, 165, A*24, { kb:160 + i*20 });
      skBurst(cx, cy - 40, PATHS[i%6].col, 10, { spMin:160, spMax:560, grav:120 });
      skShake(9 + i, 0.08, PATHS[i%6].col);
      if(i === 5){ skShake(20, 0.3, '#ff7a4a'); fxHitstop(0.08); }
    });
  }

  /* 1.95s · 六道归一·天帝拳：巨型金掌拍落 + 轮回黑洞爆发，万法破除（无视防御） */
  skAt(1950, ()=>{
    if(!G || gameState !== 'playing') return;
    const cx = tg ? tg.x : p.x + p.facing*220;
    const cy = tg ? tg.y : p.y;
    playSound('explosion');
    addEffect('palmPrint', cx, cy - 40, 0.9, { color:'#ffd86b', scale:1.4 });
    addEffect('samsaraVortex', cx, cy, 0.9, { color:'#ff5a3c', big:true });
    addEffect('explosion', cx, cy, 1.0, { color:'#ffce6b', r:300 });
    addEffect('hitRing', cx, cy, 0.8, { color:'#ffd86b', r:300 });
    addEffect('skyCrack', cx, cy - 220, 1.1, { width:420, color:'#ffd86b' });
    /* 万法破除：无视敌人防御（opt.ignoreDef） */
    meleeAoe(p, cx, cy, 320, A*200, { kb:640, launch:true, ignoreDef:true });
    meleeAoe(p, cx, cy, 540, A*46, { kb:240 });
    addEffect('lightBloom', cx, cy - 50, 0.7, {r:250, rays:22, color:'#ffd86b'});      /* 六道终结：光爆 */
    skRingBurst(cx, cy, 260, '#ffce6b', 16);
    skShake(36, 0.5, '#ffd86b');
    fxHitstop(0.14);
  });
}

/* ============================================================
   ★★★ 新增四职业技能（炼药师 / 撼山者 / 符咒师 / 丹道师）★★★
   取材：金庸、西游记、封神演义、山海经、聊斋、诛仙、宝莲灯
   ============================================================ */
/* ★ 活坐标：读 .x/.y 时实时取目标当前位置，技能延迟回调里也能跟住移动中的敌人 */
function skLive(p, ref, fallback){
  const fb = fallback || 220;
  const o = { has:true, ref:ref };
  Object.defineProperty(o, 'x', { get:function(){
    return skAlive(ref) ? ref.x : p.x + (p.facing || 1) * fb;
  }});
  Object.defineProperty(o, 'y', { get:function(){
    return skAlive(ref) ? ref.y : p.y;
  }});
  return o;
}
/* ★ 施法瞬间锁定（不是全程跟随）：
   锁定最近敌人「此刻」的位置作为落点，锁定后不再跟随目标移动 ——
   敌人可以靠走位躲开技能，保留操作空间。
   敌人在远距离时落点直接延伸到敌人身上（自动转为远距离攻击）。 */
function skAim(p, fallback){
  const ref = getSkillTarget(p, true);
  if(ref){
    p.facing = ref.x > p.x ? 1 : -1;
    /* ★ 智能追踪：返回“活坐标”——技能延迟执行时读到的是目标【当前】位置，
       不再用释放瞬间的快照（老版本可被走位躲开）。
       目标死亡/消失则回落到最后一帧坐标，避免落点乱飞。 */
    let snapX = ref.x, snapY = ref.y, live = true;
    const o = { has:true, ref:ref };
    Object.defineProperty(o, 'x', { configurable:true,
      get(){ return (live && skAlive(ref)) ? ref.x : snapX; },
      set(v){ live = false; snapX = v; } });
    Object.defineProperty(o, 'y', { configurable:true,
      get(){ return (live && skAlive(ref)) ? ref.y : snapY; },
      set(v){ live = false; snapY = v; } });
    return o;
  }
  const o2 = { x: p.x + p.facing * (fallback || 220), y: p.y, has:false };
  return o2;
}
/* ★ 近战落点智能化：目标在近战半径内 → 打身前（保留近战手感）；
   目标更远 → 技能直接落到目标身上（自动转为远距离攻击），
   超出 maxRange 则延伸到射程极限。同时把施法者转向目标。 */
function skSpot(p, tg, meleeR, maxRange){
  const R = meleeR || 100;
  if(tg && tg.has){
    const tx = tg.x;
    p.facing = tx >= p.x ? 1 : -1;
    const dx = Math.abs(tx - p.x);
    /* ★ 近战落点也「跟人」：以前这里返回 p.x + facing*R 的固定快照，
       敌人一走动技能就砸在原来那块地板上（这就是「打身前地板」的根源）。
       现在近身也绑定目标活坐标：落点=目标当前位置（最多不超过近战半径，至少身前 46px）。 */
    if(dx <= R){
      const ref = tg.ref;
      if(ref){
        const near = { far:false, ref:ref };
        Object.defineProperty(near, 'x', { configurable:true, get(){
          if(!skAlive(ref)) return p.x + p.facing * R;
          const d = ref.x - p.x;
          const dir = d >= 0 ? 1 : -1;
          return p.x + dir * Math.min(R, Math.max(46, Math.abs(d)));
        }, set(v){} });
        Object.defineProperty(near, 'y', { configurable:true, get(){
          return skAlive(ref) ? ref.y : tg.y;
        }, set(v){} });
        return near;
      }
      return { x: p.x + p.facing * R, y: tg.y, far:false };
    }
    if(maxRange && dx > maxRange) return { x: p.x + p.facing * maxRange, y: tg.y, far:true, clipped:true };
    /* ★ 远程落点也用“活坐标”：技能延迟落地时会读到目标当前位置。
       目标没了则回落到最后一帧坐标。 */
    const ref = tg.ref;
    if(ref){
      let sx = tx, sy = tg.y, live = true;
      const o = { far:true, ref:ref };
      Object.defineProperty(o, 'x', { configurable:true,
        get(){ return (live && skAlive(ref)) ? ref.x : sx; }, set(v){ live = false; sx = v; } });
      Object.defineProperty(o, 'y', { configurable:true,
        get(){ return (live && skAlive(ref)) ? ref.y : sy; }, set(v){ live = false; sy = v; } });
      return o;
    }
    return { x: tx, y: tg.y, far:true };
  }
  return { x: p.x + p.facing * R, y: p.y, far:false };
}
/* ★ 远距离打击的"飞过去"表现：从施法者拉一条粒子轨迹到落点 */
function skTravel(p, x, y, color, n){
  const dx = x - p.x, dy = (y - 46) - (p.y - 56);
  const steps = Math.min(8, Math.max(3, Math.round(Math.abs(dx) / 90)));
  const per = n || 5;
  for(let i = 1; i <= steps; i++){
    skAt((i - 1) * 20, ()=>{
      const t = i / steps;
      spawnParticles(p.x + dx * t, p.y - 56 + dy * t, per,
        {color:color, spMin:20, spMax:120, lifeMin:0.14, lifeMax:0.34, sizeMin:3, sizeMax:8, grav:0});
    });
  }
}
/* ★ 施法蓄力粒子流：四周光点向角色汇聚，让起手也有存在感 */
function skCastAura(p, dur, color, n){
  const steps = Math.max(4, Math.round((dur || 0.6) * 1000 / 55));
  const per = n || 4;
  for(let i = 0; i < steps; i++){
    skAt(i * 55, ()=>{
      for(let k = 0; k < per; k++){
        const a = rand(0, TAU);
        const rx = p.x + Math.cos(a) * 52, ry = p.y - 58 + Math.sin(a) * 44;
        spawnParticles(rx, ry, 1, {color:color, angle:Math.atan2((p.y - 58) - ry, p.x - rx),
          spread:0.35, spMin:70, spMax:190, lifeMin:0.28, lifeMax:0.62, sizeMin:2, sizeMax:6, grav:-90});
      }
    });
  }
}
/* ★ 吸取表现：绿色光流自对手流向施法者 */
function skDrain(p, foe, color){
  const dx = p.x - foe.x, dy = (p.y - 70) - (foe.y - 70);
  for(let i = 1; i <= 8; i++){
    skAt((i - 1) * 26, ()=>{
      const t = i / 8;
      spawnParticles(foe.x + dx * t, foe.y - 70 + dy * t, 1,
        {color:color, spMin:10, spMax:70, lifeMin:0.2, lifeMax:0.45, sizeMin:3, sizeMax:7, grav:-50});
    });
  }
}
/* ★ 远距离落点：先飞过去，再在落点炸开 —— 统一入口，让近战技能也能打到远处敌人 */
function skStrike(p, tg, meleeR, maxRange, color){
  const s = skSpot(p, tg, meleeR, maxRange);
  if(s.far) skTravel(p, s.x, s.y, color || '#ffd166', 5);
  return s;
}
/* ★ 落点助手：近了打身前，远了直接落到敌人身上（老职业的「身前固定距离」全部走这个） */
function skFall(p, tg, meleeR, maxRange){
  return skSpot(p, tg, meleeR || 150, maxRange || 720);
}
function skCastPose(p, dur, text, color, size){
  p.action = { type:'cast', dur: dur, t:0 };
  if(text) spawnText(p.x, p.y, 210, text, color || '#dbe4e8', size || 38);
}

/* ---------------- 炼药师 ---------------- */
/* 1 青囊一掷 */
function castHerbPouch(){
  const p = currentSkillCaster || G.player; playSound('skillCast');
  const A = skillAtkVal(p);
  const tg = skAim(p, 240);
  const dx = tg.x - p.x, dy = tg.y - (p.y - 60);
  skCastPose(p, 0.46, '青 囊 掷 露', '#7ed957', 34);
  skCastAura(p, 0.46, '#7ed957', 4);
  /* 药囊本体：飞行中一路滴落毒露 */
  for(let i = 0; i < 14; i++){
    skAt(i * 20, ()=>{
      const t = i / 13;
      const px = p.x + dx * t, py = p.y - 60 + dy * t - Math.sin(t * Math.PI) * 70;
      addEffect('hitRing', px, py, 0.22, {color:'#d8ff9a', r:16});
      spawnParticles(px, py, 2, {color:i % 2 ? '#7ed957' : '#d8ff9a', spMin:20, spMax:110, lifeMin:0.25, lifeMax:0.5, sizeMin:2, sizeMax:6, grav:160});
      spawnParticles(px, py, 2, {color:'#b6ff8a', angle:-Math.PI / 2, spread:1.0, spMin:30, spMax:120, lifeMin:0.3, lifeMax:0.6, sizeMin:2, sizeMax:5, grav:220});
    });
  }
  skAt(270, ()=>{
    const tx = clamp(tg.x, WORLD_L + 60, WORLD_R - 60);
    /* 药囊炸开：毒浆四溅 + 一圈绿色冲击 */
    addEffect('explosion', tx, tg.y, 0.5, {color:'#7ed957', r:79});
    addEffect('emberBurst', tx, tg.y - 22, 0.55, {color:'#7ed957', r:170, n:18, rot:rand(0, TAU)});
    addEffect('shockWave', tx, tg.y + 2, 0.5, {facing:p.facing, r:190, color:'#b6ff8a'});
    addEffect('poisonCloud', tx, tg.y, 1.6, {color:'#7ed957', r:86});
    addEffect('poisonCloud', tx + rand(-60, 60), tg.y, 1.1, {color:'#b6ff8a', r:62});
    addEffect('poisonCloud', tx + rand(-90, 90), tg.y, 0.9, {color:'#4aa03a', r:54});
    meleeAoe(p, tx, tg.y, 105, A * 30, {kb:80});
    skBurst(tx, tg.y - 30, '#7ed957', 12, {grav:180});
    skRingBurst(tx, tg.y, 150, '#b6ff8a', 12);
    skShake(7, 0.05, '#7ed957');
    /* 毒伤：3 段 */
    for(let t = 0; t < 3; t++) skAt(360 + t * 340, ()=>{
      meleeAoe(p, tg.x, tg.y, 96, A * 9, {kb:0});
      addEffect('poisonCloud', tg.x + rand(-40, 40), tg.y, 0.5, {color:'#b6ff8a', r:52});
      spawnParticles(tg.x + rand(-40, 40), tg.y - rand(10, 60), 6, {color:'#b6ff8a', angle:-Math.PI/2, spread:1.2, spMin:20, spMax:80, lifeMin:0.3, lifeMax:0.6, sizeMin:3, sizeMax:6, grav:-60});
    });
  });
}

/* 2 百草缠身 */
function castHerbVines(){
  const p = currentSkillCaster || G.player; playSound('skillCast');
  const A = skillAtkVal(p);
  /* ★ 藤蔓一路长到目标脚下，不再只长在身前 */
  const tg = skAim(p, 180);
  skCastPose(p, 0.62, '藤 缠 百 草', '#7ed957', 38);
  skCastAura(p, 0.62, '#7ed957', 4);
  for(let i = 0; i < 6; i++){
    skAt(80 + i * 62, ()=>{
      const s = skSpot(p, tg, 90 + i * 56, 640);
      const vx = clamp(s.x, WORLD_L + 40, WORLD_R - 40);
      if(s.far) skTravel(p, vx, s.y, '#7ed957', 3);
      addEffect('vine', vx, s.y + 4, 0.75, {color:'#7ed957', color2:'#d8ff9a', h:110 + i * 8, n:3});
      addEffect('hitRing', vx, s.y, 0.3, {color:'#d8ff9a', r:38});
      meleeHitRect(p, vx, s.y, 82, 150, A * 20, {kb:40});
      skBurst(vx, s.y - 40, '#7ed957', 6, {grav:120, spMin:60, spMax:200});
      /* 藤蔓破土带起的泥土与草屑 */
      spawnParticles(vx, s.y, 4, {color:i % 2 ? '#d8ff9a' : '#7ed957', angle:-Math.PI / 2, spread:1.1,
        spMin:80, spMax:260, lifeMin:0.25, lifeMax:0.55, sizeMin:2, sizeMax:6, grav:300});
      skShake(4, 0, '#7ed957');
    });
  }
  skAt(470, ()=>{
    /* ★ 缠绕判定以目标实时位置为准 */
    const cx = tg.x, cy = tg.y;
    for(let e of G.enemies){
      if(!e.alive) continue;
      if(Math.abs(e.x - cx) < 300 && Math.abs(e.y - cy) < 70){
        e.rootT = Math.max(e.rootT || 0, 1.4);
        spawnText(e.x, e.y, 130, '缠绕', '#7ed957', 18);
      }
    }
  });
}

/* 3 生死符 */
function castHerbLifeDeath(){
  const p = currentSkillCaster || G.player; playSound('skillCast');
  const A = skillAtkVal(p);
  const tg = skAim(p, 300);
  skCastPose(p, 0.8, '七 毒 噬 骨', '#b388ff', 40);
  skCastAura(p, 0.8, '#b388ff', 4);
  addEffect('hitRing', p.x, p.y, 0.7, {color:'#b388ff', r:68});
  /* ★ 七枚毒丹绕着目标盘旋（跟着目标走） */
  addEffect('pillOrbit', tg.x, tg.y, 1.2, {color:'#b388ff', color2:'#7ed957', n:7, r:112, h:74, size:12, speed:2.8});
  addEffect('pillOrbit', tg.x, tg.y, 1.2, {color:'#7ed957', color2:'#b388ff', n:7, r:74, h:40, size:9, speed:-3.6});
  /* ★ 七枚毒丹绕着目标盘旋，逐一炸开蚀骨（跟着目标移动） */
  for(let i = 0; i < 7; i++){
    skAt(180 + i * 120, ()=>{
      const ox = clamp(tg.x, WORLD_L + 60, WORLD_R - 60), oy = tg.y;
      const a = i / 7 * TAU + G.t * 1.4;
      const sx = ox + Math.cos(a) * 96, sy = oy - 46 + Math.sin(a) * 42;
      /* 毒丹本体：紫绿双色核心 */
      addEffect('hitRing', sx, sy, 0.34, {color:'#b388ff', r:30});
      addEffect('poisonCloud', sx, sy, 0.6, {color:'#8a5ad9', r:44});
      addEffect('emberBurst', sx, sy, 0.42, {color:'#b388ff', r:104, n:12, rot:rand(0, TAU)});
      /* 毒丹从施法者飞向目标 */
      skTravel(p, sx, sy, '#b388ff', 3);
      meleeAoe(p, sx, sy, 74, A * 26, {kb:30});
      spawnParticles(sx, sy, 4, {color:i % 2 ? '#b388ff' : '#7ed957', angle:rand(0, TAU), spread:0.7,
        spMin:70, spMax:230, lifeMin:0.22, lifeMax:0.5, sizeMin:2, sizeMax:6, grav:180});
      skShake(5, 0.02, '#b388ff');
    });
  }
  skAt(1000, ()=>{
    /* 七毒齐爆：毒雾化作骨蚀之环 */
    const cx = clamp(tg.x, WORLD_L + 60, WORLD_R - 60), cy = tg.y;
    meleeAoe(p, cx, cy, 130, A * 34, {kb:60});
    addEffect('emberBurst', cx, cy - 26, 0.9, {color:'#b388ff', r:270, n:24, rot:rand(0, TAU)});
    addEffect('shockWave', cx, cy + 2, 0.8, {facing:p.facing, r:340, color:'#8a5ad9'});
    addEffect('poisonCloud', cx, cy, 1.0, {color:'#8a5ad9', r:130});
    for(const e of G.enemies){
      if(e.alive && Math.abs(e.x - cx) < 160 && Math.abs(e.y - cy) < 70){
        e.rootT = Math.max(e.rootT || 0, 2.0);
        spawnText(e.x, e.y, 150, '蚀骨', '#b388ff', 20);
      }
    }
    skBurst(cx, cy - 40, '#b388ff', 9, {grav:80});
    skShake(13, 0.12, '#b388ff');
  });
}

/* 4 九花玉露 */
function castHerbDew(){
  const p = currentSkillCaster || G.player; playSound('heal');
  const A = skillAtkVal(p);
  skCastPose(p, 0.9, '九 花 玉 露 丸', '#ffe9a8', 40);
  skCastAura(p, 0.9, '#ffe9a8', 4);
  addEffect('lotusBurst', p.x, p.y, 1.2, {colors:['#ffe9a8','#7ed957','#d8ff9a','#fff6c8','#b6ff8a','#ffd166','#eaffd0'], r:170, rotateSpeed:2.2});
  addEffect('dharmaWheel', p.x, p.y, 1.3, {color:'#ffe9a8', r:160});
  /* ★ 九花玉露丸 = 九枚丹丸绕身旋转后化作甘霖 */
  addEffect('pillOrbit', p.x, p.y, 1.2, {color:'#ffe9a8', color2:'#7ed957', n:9, r:120, h:80, size:13, speed:2.4});
  addEffect('pillOrbit', p.x, p.y, 1.2, {color:'#7ed957', color2:'#fff6c8', n:9, r:82, h:48, size:10, speed:-3.2});
  for(let i = 0; i < 18; i++){
    skAt(i * 45, ()=>{
      const a = i / 18 * TAU;
      spawnParticles(p.x + Math.cos(a) * 60, p.y - 50 + Math.sin(a) * 26, 2, {color:i % 2 ? '#ffe9a8' : '#7ed957', angle:-Math.PI/2 - a * 0.2, spread:0.5, spMin:40, spMax:140, lifeMin:0.4, lifeMax:0.9, sizeMin:3, sizeMax:7, grav:-140});
    });
  }
  skAt(300, ()=>{
    if(G.isPvp){
      /* ★ PK：九花玉露转为「吸取」——自愈少量气血，同时抽走对手的气血 */
      const foe = (p === G.player) ? G.player2 : G.player;
      let healed = 0, drained = 0;
      if(foe && !foe.dead){
        drained = p.maxHp * 0.06 + A * 14;
        damagePvpPlayer(foe, drained, p, {kb:110});
        healed = Math.min(p.maxHp - p.hp, p.maxHp * 0.08 + A * 6);
        p.hp += Math.max(4, healed);
        skDrain(p, foe, '#7ed957');
        spawnText(foe.x, foe.y, 170, '吸取', '#b6ff8a', 22);
      } else {
        healed = Math.min(p.maxHp - p.hp, p.maxHp * 0.22);
        p.hp += healed;
      }
      p.mp = Math.min(p.maxMp, p.mp + 30);
      if(healed >= 1) spawnText(p.x, p.y, 190, '+' + Math.round(healed), '#7ed957', 28);
      addEffect('explosion', p.x, p.y, 0.6, {color:'#ffe9a8', r:144});
      addEffect('emberBurst', p.x, p.y - 26, 0.7, {color:'#ffe9a8', r:240, n:20, rot:rand(0, TAU)});
      skBurst(p.x, p.y - 50, '#ffe9a8', 9, {spMin:120, spMax:420, grav:-60});
      skShake(8, 0.08, '#ffe9a8');
      return;
    }
    meleeAoe(p, p.x, p.y, 220, A * 45, {kb:260, launch:true});
    p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.22);
    p.mp = Math.min(p.maxMp, p.mp + 30);
    /* ★ 组队：同一治疗光环也覆盖附近队友 */
    try{ if(window.ONLINE && ONLINE.healAllies) ONLINE.healAllies(0.22, 300); }catch(e){}
    spawnText(p.x, p.y, 190, '+' + Math.round(p.maxHp * 0.22), '#7ed957', 30);
    addEffect('explosion', p.x, p.y, 0.6, {color:'#ffe9a8', r:144});
    addEffect('emberBurst', p.x, p.y - 26, 0.7, {color:'#ffe9a8', r:240, n:20, rot:rand(0, TAU)});
    addEffect('shockWave', p.x, p.y + 2, 0.6, {facing:p.facing, r:280, color:'#b6ff8a'});
    skBurst(p.x, p.y - 50, '#ffe9a8', 10, {spMin:120, spMax:420, grav:-60});
    skShake(9, 0.1, '#ffe9a8');
  });
}

/* 5 千蛛万毒手 */
function castHerbSpider(){
  const p = currentSkillCaster || G.player; playSound('skillCast');
  const A = skillAtkVal(p);
  const tg = skAim(p, 260);
  skCastPose(p, 1.0, '千 蛛 万 毒', '#b388ff', 40);
  skCastAura(p, 1.0, '#b388ff', 4);
  const _cx = () => clamp(tg.x, WORLD_L + 80, WORLD_R - 80);
  addEffect('hitRing', _cx(), tg.y, 1.0, {color:'#b388ff', r:128});
  /* ★ 毒蛛自地底成群爬出，扑向目标 */
  addEffect('spiderSwarm', p.x, p.y, 1.0, {facing:p.facing, n:7, reach:300, size:17, color:'#b388ff', color2:'#7ed957'});
  addEffect('spiderSwarm', p.x + p.facing * 120, p.y, 0.9, {facing:p.facing, n:6, reach:240, size:14, color:'#7ed957', color2:'#b388ff'});
  for(let i = 0; i < 8; i++){
    skAt(120 + i * 95, ()=>{
      const a = i / 8 * TAU;
      /* ★ 毒点跟随目标，每处落毒都炸开一团紫雾 */
      const bx = clamp(skSpot(p, tg, 0, 620).x, WORLD_L + 80, WORLD_R - 80);
      const sx = bx + Math.cos(a) * 130, sy = tg.y + Math.sin(a) * 56;
      addEffect('poisonCloud', sx, sy, 0.7, {color:'#b388ff', r:54});
      addEffect('emberBurst', sx, sy - 18, 0.42, {color:'#b388ff', r:96, n:10, rot:rand(0, TAU)});
      for(let j = 0; j < 6; j++){
        const aa = j / 6 * TAU;
        spawnParticles(sx, sy, 1, {color:'#b388ff', angle:aa, spread:0.2, spMin:60, spMax:190, lifeMin:0.2, lifeMax:0.5, sizeMin:2, sizeMax:5, grav:200});
      }
      spawnText(sx, sy, 110, '毒', '#b388ff', 16);
      meleeAoe(p, sx, sy, 58, A * 14, {kb:0});
      skShake(5, 0, '#b388ff');
    });
  }
  for(let t = 0; t < 6; t++) skAt(1000 + t * 380, ()=>{
    const bx = clamp(skSpot(p, tg, 0, 620).x, WORLD_L + 80, WORLD_R - 80);
    meleeAoe(p, bx, tg.y, 175, A * 10, {kb:0});
    addEffect('poisonCloud', bx + rand(-70, 70), tg.y, 0.6, {color:'#b388ff', r:60});
    if(t === 0) addEffect('emberBurst', bx, tg.y - 24, 0.9, {color:'#b388ff', r:260, n:22, rot:rand(0, TAU)});
  });
}

/* 6 神农百草 */
function castHerbShennong(){
  const p = currentSkillCaster || G.player; playSound('skillCast');
  const A = skillAtkVal(p);
  skCastPose(p, 1.5, '万 物 归 毒', '#b6ff8a', 46);
  skCastAura(p, 1.5, '#b6ff8a', 4);
  addEffect('skyPillar', p.x, p.y, 1.8, {height:820, color:'#7ed957'});
  addEffect('dharmaWheel', p.x, p.y, 2.0, {color:'#d8ff9a', r:260});
  addEffect('lotusBurst', p.x, p.y, 2.0, {colors:['#7ed957','#d8ff9a','#fff6c8','#b6ff8a','#ffe9a8','#4aa03a','#eaffd0'], r:260, rotateSpeed:1.6});
  /* ★ 万物归毒：十二枚药丹绕身，一念生一念枯 */
  addEffect('pillOrbit', p.x, p.y, 1.8, {color:'#7ed957', color2:'#b388ff', n:12, r:190, h:120, size:15, speed:2.0});
  addEffect('pillOrbit', p.x, p.y, 1.8, {color:'#b388ff', color2:'#d8ff9a', n:12, r:130, h:70, size:11, speed:-2.8});
  /* 百草自地面疯长 */
  for(let i = 0; i < 14; i++){
    skAt(i * 70, ()=>{
      const bx = p.x + (i - 6.5) * 46;
      addEffect('vine', clamp(bx, WORLD_L + 30, WORLD_R - 30), p.y + 6, 1.0, {color:i % 3 ? '#7ed957' : '#d8ff9a', h:130 + (i % 4) * 30, n:2});
      meleeAoe(p, bx, p.y, 58, A * 16, {kb:20});
      skBurst(bx, p.y - 60, '#7ed957', 3, {grav:-80});
    });
  }
  skAt(900, ()=>{
    meleeAoe(p, p.x, p.y, 520, A * 200, {kb:420, launch:true});
    if(G.isPvp){
      /* ★ PK：神农百草同样走「吸取」——少量自愈 + 抽血 */
      const foe = (p === G.player) ? G.player2 : G.player;
      let healed = 0;
      if(foe && !foe.dead){
        damagePvpPlayer(foe, p.maxHp * 0.10 + A * 30, p, {kb:200});
        healed = Math.min(p.maxHp - p.hp, p.maxHp * 0.12 + A * 10);
        p.hp += Math.max(8, healed);
        skDrain(p, foe, '#b6ff8a');
        spawnText(foe.x, foe.y, 180, '百草噬命', '#b6ff8a', 24);
      } else {
        healed = Math.min(p.maxHp - p.hp, p.maxHp * 0.35);
        p.hp += healed;
      }
      p.mp = Math.min(p.maxMp, p.mp + 50);
      if(healed >= 1) spawnText(p.x, p.y, 210, '+' + Math.round(healed), '#7ed957', 30);
    } else {
      p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.35);
      p.mp = Math.min(p.maxMp, p.mp + 50);
      try{ if(window.ONLINE && ONLINE.healAllies) ONLINE.healAllies(0.35, 360); }catch(e){}
      spawnText(p.x, p.y, 220, '+' + Math.round(p.maxHp * 0.35), '#7ed957', 34);
    }
    addEffect('explosion', p.x, p.y, 1.1, {color:'#b6ff8a', r:302});
    addEffect('emberBurst', p.x, p.y - 30, 1.2, {color:'#b6ff8a', r:460, n:30, rot:rand(0, TAU)});
    addEffect('shockWave', p.x, p.y + 2, 1.0, {facing:p.facing, r:560, color:'#d8ff9a'});
    skRingBurst(p.x, p.y, 220, '#d8ff9a', 16);
    skShake(30, 0.4, '#b6ff8a');
    fxHitstop(0.12);
  });
}

/* ---------------- 撼山者 ---------------- */
/* 1 劈山式（重做）：抡斧砸地 → 裂地波沿地面推进，远处自动劈过去 */
/* ============================================================
   ★ 撼山者（斧）专用：瞬影贴身 + 手中这把斧挥击
   斧系是纯近战职业：以前的技能虽然把伤害算在敌人身上，
   但人还站在原地远远地“隔空砸”，看着就是打不到。
   现在放技能先「瞬影」闪到敌人身侧，再用手里的斧头抡过去，
   伤害同时绑敌人活坐标，斧落人倒。 */
function axeBlinkTo(p, tg, dist){
  if(!tg || !tg.has || !tg.ref) return false;
  const ref = tg.ref;
  if(!skAlive(ref)) return false;
  const D = dist || 92;
  const side = (p.x <= ref.x) ? -1 : 1;            /* 从哪边来就站哪边，不穿身 */
  const bx = clamp(ref.x + side * D, WORLD_L + 56, WORLD_R - 56);
  const by = clamp(ref.y, GY_TOP + 20, GY_BOTTOM);
  if(Math.abs(bx - p.x) < 34 && Math.abs(by - p.y) < 10) return false;   /* 已经贴脸 */
  /* 瞬身残影（撼山者本体） */
  for(let i = 1; i <= 3; i++){
    addEffect('afterImage', p.x + (bx - p.x) * i / 4, p.y + (by - p.y) * i / 4, 0.26,
      {facing:p.facing, weaponIdx:p.weaponIdx, spriteKey:'axe', anim:'run',
       alpha:0.5 - i * 0.09, color:'#ffb04a'});
  }
  addEffect('lightBloom', p.x, p.y - 70, 0.3, {r:80, rays:10, color:'#ffb04a'});
  p.x = bx; p.y = by; p.h = 0; p.vy = 0; p.kx = 0; p.launchT = 0;
  p.facing = (ref.x >= p.x) ? 1 : -1;
  addEffect('lightBloom', p.x, p.y - 66, 0.38, {r:110, rays:12, color:'#ffd08a'});
  addEffect('hitRing', p.x, p.y, 0.28, {color:'#ffd08a', r:70});
  return true;
}
/* 在施法者身前抡出「手中这把斧」：a0/a1 是起止角度 */
function axeSwingFx(p, scale, dur, a0, a1, color){
  const fc = p.facing || 1;
  addEffect('axeSwing', p.x + fc * 16, p.y, dur || 0.4,
    {facing:fc, scale:scale || 1.7, color:color || '#ffb04a',
     a0:(a0 === undefined ? -2.1 : a0), a1:(a1 === undefined ? 0.62 : a1)});
}

/* 1 劈山式 */
function castAxeSplit(){
  /* 劈山式：瞬影贴脸 → 举斧过顶 → 一斧竖劈，斧刃砸在敌人身上 */
  const p = currentSkillCaster || G.player; playSound('skillCast');
  const A = skillAtkVal(p);
  const tg = skAim(p, 180);
  const tx = () => clamp(tg.x, WORLD_L + 50, WORLD_R - 50);
  const ty = () => clamp(tg.y, GY_TOP + 20, GY_BOTTOM);
  spawnText(p.x, p.y, 205, '劈 山 式', '#ffb04a', 42);
  p.action = { type:'storm', dur:0.6, t:0 };

  /* ① 瞬影贴身 */
  skAt(70, ()=>{ if(!G || gameState !== 'playing') return; axeBlinkTo(p, tg, 88); });
  /* ② 举斧过顶（手中斧） */
  skAt(250, ()=>{
    if(!G || gameState !== 'playing') return;
    p.facing = tx() >= p.x ? 1 : -1;
    axeSwingFx(p, 1.3, 0.2, -2.65, -2.1);
  });
  /* ③ 落斧：判定就在敌人脚下 */
  skAt(540, ()=>{
    if(!G || gameState !== 'playing') return;
    playSound('bladeSwing');
    p.facing = tx() >= p.x ? 1 : -1;
    axeSwingFx(p, 2.0, 0.34, -2.15, 0.75);
    addEffect('groundCrack', tx(), ty(), 1.0, {angle:p.facing > 0 ? 0 : Math.PI, color:'#ffb04a'});
    addEffect('hitRing', tx(), ty(), 0.5, {color:'#ffd08a', r:150});
    meleeAoe(p, tx(), ty(), 170, A*70, {kb:520, launch:true});
    skShake(20, 0.28, '#ffb04a');
    fxHitstop(0.08);
  });
}

/* 2 三板斧 */
function castAxeThree(){
  /* 三板斧（《隋唐演义》程咬金）：劈脑门 → 鬼剔牙 → 掏耳朵。
     ★ 三斧全是「手中这把斧」连着抡，一斧比一斧狠，第四斧没有了 */
  const p = currentSkillCaster || G.player; playSound('skillCast');
  const A = skillAtkVal(p);
  const tg = skAim(p, 200);
  const tx = () => clamp(tg.x, WORLD_L + 50, WORLD_R - 50);
  const ty = () => clamp(tg.y, GY_TOP + 20, GY_BOTTOM);
  spawnText(p.x, p.y, 205, '三 板 斧', '#ffb04a', 40);
  p.action = { type:'storm', dur:0.95, t:0 };
  skAt(60, ()=>{ if(!G || gameState !== 'playing') return; axeBlinkTo(p, tg, 86); });

  const NAME = ['劈 脑 门', '鬼 剔 牙', '掏 耳 朵'];
  const DMG  = [24, 28, 46];
  const A0   = [-2.6, -1.45, -0.55];
  const A1   = [-0.35, 0.15, 0.6];
  for(let i = 0; i < 3; i++){
    skAt(300 + i * 230, ()=>{
      if(!G || gameState !== 'playing') return;
      if(i === 0 && p.action && p.action.type === 'storm') p.action = null;
      playSound('bladeSwing');
      p.facing = tx() >= p.x ? 1 : -1;
      spawnText(p.x, p.y - 130, 120, NAME[i], '#ffd08a', 26);
      /* 三斧：自上而下 / 横撩 / 斜下勾，都是手里那把斧 */
      axeSwingFx(p, 1.8 + i * 0.18, 0.28, A0[i], A1[i]);
      addEffect('slashArc', tx(), ty(), 0.22, {facing:p.facing, color:'#ffb04a', size:1.0 + i * 0.25, typeStr:'blade'});
      if(i === 2){
        addEffect('lightBloom', tx(), ty() - 26, 0.55, {r:190, rays:18, color:'#ffb04a'});
        meleeAoe(p, tx(), ty(), 180, A*DMG[i], {kb:480, launch:true});
        skShake(18, 0.24, '#ffb04a');
        fxHitstop(0.07);
      } else {
        meleeAoe(p, tx(), ty(), 150, A*DMG[i], {kb:160});
        skShake(8, 0.03, '#ffb04a');
      }
    });
  }
}

/* 3 旋风斧 */
function castAxeWhirl(){
  /* 旋风斧（《水浒》李逵）：瞬影冲进怪堆，原地旋身，手中斧绕着身子连抡成环 */
  const p = currentSkillCaster || G.player; playSound('skillCast');
  const A = skillAtkVal(p);
  const tg = skAim(p, 220);
  spawnText(p.x, p.y, 205, '旋 风 斧', '#ffb04a', 40);
  p.action = { type:'storm', dur:1.35, t:0 };
  /* ① 瞬影进场（贴着敌人再转，才转得到人） */
  skAt(60, ()=>{
    if(!G || gameState !== 'playing') return;
    axeBlinkTo(p, tg, 96);
    /* 斧影环绕（真斧模型，内外两圈反向） */
    addEffect('axeOrbit', p.x, p.y, 1.3, {r:118, n:4, spin:8.5, color:'#ffb04a', follow:p});
    addEffect('axeOrbit', p.x, p.y, 1.1, {r:74, n:3, spin:-11, color:'#ffd08a', follow:p});
  });
  let tick = 0;
  const tm = setInterval(()=>{
    if(!G || gameState !== 'playing'){ clearInterval(tm); return; }
    tick++;
    if(tick % 2 === 0){
      /* 旋斩：斧在脚下抡一圈，判定=斧影半径（始终朝着敌人，不左右乱翻） */
      p.facing = (tg.x >= p.x) ? 1 : -1;
      axeSwingFx(p, 1.6, 0.22, -2.5, 0.7);
      meleeAoe(p, p.x, p.y, 150, A*16, {kb:160});
      skShake(5, 0.02, '#ffb04a');
    }
    if(tick >= 10){
      clearInterval(tm);
      addEffect('lightBloom', p.x, p.y - 40, 0.5, {r:200, rays:16, color:'#ffb04a'});
      axeSwingFx(p, 2.2, 0.3, -2.1, 1.0);
      meleeAoe(p, p.x, p.y, 200, A*40, {kb:420, launch:true});
      skShake(14, 0.2, '#ffb04a');
    }
  }, 130);
}

/* 4 巨灵劈山 */
function castAxeMountain(){
  /* 巨灵劈山（《西游记》巨灵神）：瞬影贴脸，双手抡斧横扫，一斧扫平一整排 */
  const p = currentSkillCaster || G.player; playSound('skillCast');
  const A = skillAtkVal(p);
  const tg = skAim(p, 220);
  const tx = () => clamp(tg.x, WORLD_L + 90, WORLD_R - 90);
  const ty = () => clamp(tg.y, GY_TOP + 20, GY_BOTTOM);
  spawnText(p.x, p.y, 205, '巨 灵 劈 山', '#ffb04a', 42);
  p.action = { type:'storm', dur:0.75, t:0 };
  skAt(60, ()=>{ if(!G || gameState !== 'playing') return; axeBlinkTo(p, tg, 104); });
  skAt(660, ()=>{
    if(!G || gameState !== 'playing') return;
    playSound('bladeSwing');
    p.facing = tx() >= p.x ? 1 : -1;
    /* 巨斧横抡：手中斧放大抡过一整条线 */
    axeSwingFx(p, 2.9, 0.34, -1.6, 0.45);
    addEffect('shockWave', tx(), ty() + 2, 0.55, {facing:p.facing, r:300, color:'#ffd08a'});
    addEffect('lightBloom', tx(), ty() - 30, 0.5, {r:200, rays:14, color:'#ffb04a'});
    /* 横扫判定：与斧影同宽 */
    meleeHitRect(p, tx(), ty(), 420, 200, A*90, {kb:520, launch:true});
    meleeHitRect(p, tx(), ty(), 560, 240, A*30, {kb:260});
    skShake(22, 0.3, '#ffb04a');
    fxHitstop(0.08);
  });
}

/* 5 刑天舞干戚 */
function castAxeXingtian(){
  /* 刑天舞干戚（《山海经》）：无头亦舞干戚 —— 战神法相缠身，手中斧连斩不止 */
  const p = currentSkillCaster || G.player; playSound('skillCast');
  const A = skillAtkVal(p);
  const tg = skAim(p, 200);
  const tx = () => clamp(tg.x, WORLD_L + 70, WORLD_R - 70);
  const ty = () => clamp(tg.y, GY_TOP + 20, GY_BOTTOM);
  spawnText(p.x, p.y, 210, '刑 天 舞 干 戚', '#ff8a4a', 44);
  p.action = { type:'storm', dur:1.5, t:0 };
  /* ① 瞬影贴身 + 刑天法相（本体光影，跟着人走） */
  skAt(70, ()=>{
    if(!G || gameState !== 'playing') return;
    axeBlinkTo(p, tg, 92);
    addEffect('asuraAvatar', p.x, p.y, 1.5, {facing:p.facing, color:'#ff8a4a', spriteKey:'axe', anim:'skill', ghostH:140, follow:p});
  });
  /* ② 八段斧斩：手中斧左右交替连挥 */
  for(let i = 0; i < 8; i++){
    skAt(320 + i * 150, ()=>{
      if(!G || gameState !== 'playing') return;
      if(i === 0 && p.action && p.action.type === 'storm') p.action = null;
      p.facing = tx() >= p.x ? 1 : -1;
      playSound('bladeSwing');
      const up = i % 2 === 0;
      axeSwingFx(p, 1.75, 0.24, up ? -2.4 : -0.9, up ? 0.5 : 1.1, '#ff8a4a');
      meleeAoe(p, tx(), ty(), 150, A*14, {kb:120});
      skShake(6, 0.03, '#ff8a4a');
      if(i === 7){
        addEffect('lightBloom', tx(), ty() - 30, 0.6, {r:220, rays:20, color:'#ff8a4a'});
        axeSwingFx(p, 2.4, 0.32, -2.2, 0.95, '#ff8a4a');
        meleeAoe(p, tx(), ty(), 210, A*60, {kb:520, launch:true});
        skShake(20, 0.28, '#ff8a4a');
        fxHitstop(0.08);
      }
    });
  }
}

/* 6 盘古开天 */
function castAxePangu(){
  /* 盘古开天·混沌初判（《三五历纪》）：瞬影立于敌前，一斧劈开天地，清浊自此判 */
  const p = currentSkillCaster || G.player; playSound('skillCast');
  const A = skillAtkVal(p);
  const tg = skAim(p, 240);
  const tx = () => clamp(tg.x, WORLD_L + 120, WORLD_R - 120);
  const ty = () => clamp(tg.y, GY_TOP + 20, GY_BOTTOM);
  spawnText(p.x, p.y, 220, '盘 古 开 天', '#ffe9a8', 52);
  p.action = { type:'storm', dur:1.4, t:0 };
  /* ① 瞬影逼近 + 举斧蓄势 */
  skAt(60, ()=>{ if(!G || gameState !== 'playing') return; axeBlinkTo(p, tg, 112); });
  addEffect('skyCrack', tx(), 70, 1.2, {width:420, color:'#ffe9a8'});
  addEffect('lightBloom', tx(), 120, 0.8, {r:170, rays:16, color:'#ffe9a8'});
  skShake(14, 0.3, '#ffe9a8');
  skAt(700, ()=>{
    if(!G || gameState !== 'playing') return;
    p.facing = tx() >= p.x ? 1 : -1;
    axeSwingFx(p, 1.5, 0.24, -2.85, -2.35, '#ffe9a8');
  });

  skAt(1000, ()=>{
    if(!G || gameState !== 'playing') return;
    if(p.action && p.action.type === 'storm') p.action = null;
    playSound('explosion');
    p.facing = tx() >= p.x ? 1 : -1;
    /* 开天巨斧：手中斧放大成开天斧，竖劈入地 */
    axeSwingFx(p, 3.4, 0.42, -2.35, 0.95, '#ffe9a8');
    addEffect('giganticWeapon', tx(), ty(), 0.9, {weaponType:'axe', color:'#ffe9a8', scale:5.0, rot:Math.PI/2, f:p.facing});
    addEffect('skyPillar', tx(), ty(), 1.3, {height:900, color:'#ffe9a8'});
    addEffect('groundCrack', tx(), ty(), 1.2, {angle:p.facing > 0 ? 0 : Math.PI, color:'#ffe9a8'});
    addEffect('lightBloom', tx(), ty() - 30, 0.8, {r:280, rays:24, color:'#ffe9a8'});
    addEffect('hitRing', tx(), ty(), 0.9, {color:'#fff6c8', r:320});
    meleeAoe(p, tx(), ty(), 260, A*200, {kb:640, launch:true});
    meleeAoe(p, tx(), ty(), 460, A*60, {kb:260});
    skShake(34, 0.5, '#ffe9a8');
    fxHitstop(0.14);
    /* 天地余震 */
    for(let i = 0; i < 2; i++){
      skAt(180 + i * 200, ()=>{
        if(!G || gameState !== 'playing') return;
        addEffect('lightBloom', tx(), ty() - 20, 0.45, {r:220 + i*90, rays:16, color:'#fff6c8'});
        addEffect('shockWave', tx(), ty() + 2, 0.5, {facing:p.facing, r:340 + i*120, color:'#ffe9a8'});
      });
    }
  });
}

/* ---------------- 符咒师 ---------------- */
/* 1 定身符 */
function castTalismanBind(){
  const p = currentSkillCaster || G.player; playSound('skillCast');
  const A = skillAtkVal(p);
  const tg = skAim(p, 300);
  /* 起手甩出本命符纸（★ 不再是宝剑——符咒师用符不用剑） */
  setTimeout(()=>{ if(G && gameState==='playing') fxWeaponVolley(p, p.x, p.y-60, tg.x, tg.y, 'realTalisman', 7, {color:'#ffe066', speed:1200, dmg:atkVal*3}); }, 110);
  skCastPose(p, 0.6, '定 身 符', '#ffe066', 34);
  skCastAura(p, 0.6, '#ffe066', 4);
  /* 符纸出手：一路旋转飞向目标，身后洒下金粉 */
  for(let i = 0; i < 12; i++){
    skAt(i * 16, ()=>{
      const t = i / 11;
      const px = p.x + (tg.x - p.x) * t, py = p.y - 70 + (tg.y - (p.y)) * t;
      addEffect('talisman', px, py, 0.3, {color:i % 3 ? '#ffe066' : '#ff9a3a', n:1, r:0, rot:G.t * 3 + i});
      spawnParticles(px, py, 2, {color:i % 2 ? '#ffe066' : '#fff6b0', spMin:20, spMax:110, lifeMin:0.2, lifeMax:0.45, sizeMin:2, sizeMax:5, grav:120});
    });
  }
  skAt(200, ()=>{
    const tx = clamp(tg.x, WORLD_L + 60, WORLD_R - 60);
    /* ★ 定身符阵自地面展开，把敌人钉在原地 */
    addEffect('runeCircle', tx, tg.y, 1.6, {color:'#ffe066', color2:'#fff6b0', r:150, n:8, speed:2.4});
    addEffect('talisman', tx, tg.y - 70, 0.6, {color:'#ffe066', n:3, r:26, rise:20});
    addEffect('hitRing', tx, tg.y, 0.45, {color:'#fff6b0', r:60});
    addEffect('emberBurst', tx, tg.y - 24, 0.45, {color:'#ffe066', r:130, n:14, rot:rand(0, TAU)});
    spawnParticles(tx, tg.y - 40, 12, {color:'#ffe066', angle:-Math.PI / 2, spread:1.3, spMin:80, spMax:300, lifeMin:0.3, lifeMax:0.7, sizeMin:2, sizeMax:7, grav:260});
    /* 符阵持续洒落的定身金粉 */
    for(let d = 0; d < 5; d++) skAt(260 + d * 90, ()=>{
      spawnParticles(tx + rand(-70, 70), tg.y - rand(10, 90), 8, {color:d % 2 ? '#ffe066' : '#fff6b0',
        angle:-Math.PI / 2, spread:1.4, spMin:30, spMax:150, lifeMin:0.35, lifeMax:0.8, sizeMin:2, sizeMax:6, grav:200});
    });
    meleeAoe(p, tx, tg.y, 90, A * 25, {kb:0});
    for(const e of G.enemies){
      if(e.alive && Math.abs(e.x - tx) < 110 && Math.abs(e.y - tg.y) < 60){
        e.rootT = Math.max(e.rootT || 0, 1.6);
        spawnText(e.x, e.y, 150, '定', '#ffe066', 26);
      }
    }
    skShake(6, 0, '#ffe066');
  });
}

/* 2 五雷符 */
function castTalismanThunder(){
  const p = currentSkillCaster || G.player; playSound('thunder');
  const A = skillAtkVal(p);
  /* ★ 五道雷符沿地面推进，一路追到目标脚下 */
  const tg = skAim(p, 220);
  skCastPose(p, 0.9, '五 雷 符', '#ffe066', 38);
  skCastAura(p, 0.9, '#ffe066', 4);
  /* ★ 五雷符阵：脚下先起一圈雷纹 */
  addEffect('runeCircle', p.x, p.y, 0.9, {color:'#ffe066', color2:'#fff6b0', r:130, n:5, speed:3.0});
  for(let i = 0; i < 5; i++){
    skAt(150 + i * 110, ()=>{
      const s = skStrike(p, tg, 110 + i * 70, 620, '#ffe066');
      const cx = clamp(s.x, WORLD_L + 40, WORLD_R - 40), cy = s.y;
      addEffect('lightning', cx, cy - 20, 0.55, {color:'#ffe066', scale:1.2, fromY:-160});
      addEffect('hitRing', cx, cy, 0.4, {color:'#fff6b0', r:60});
      addEffect('emberBurst', cx, cy - 24, 0.4, {color:'#fff6b0', r:110, n:12, rot:rand(0, TAU)});
      spawnParticles(cx, cy - 30, 5, {color:i % 2 ? '#ffe066' : '#dbe4e8', angle:-Math.PI / 2, spread:1.1,
        spMin:120, spMax:380, lifeMin:0.22, lifeMax:0.5, sizeMin:2, sizeMax:6, grav:340});
      meleeAoe(p, cx, cy, 88, A * 30, {kb:100});
      skBurst(cx, cy - 40, '#ffe066', 6, {grav:260});
      skShake(8, 0.05, '#ffe066');
    });
  }
  skAt(900, ()=>{
    const s = skSpot(p, tg, 260, 680);
    const cx = clamp(s.x, WORLD_L + 40, WORLD_R - 40), cy = s.y;
    meleeAoe(p, cx, cy, 240, A * 45, {kb:200});
    addEffect('explosion', cx, cy, 0.6, {color:'#fff6b0', r:144});
    addEffect('emberBurst', cx, cy - 24, 0.7, {color:'#ffe066', r:240, n:18, rot:rand(0, TAU)});
    skShake(14, 0.15, '#ffe066');
  });
}

/* 3 万符朝宗 */
function castTalismanRain(){
  const p = currentSkillCaster || G.player; playSound('skillCast');
  const A = skillAtkVal(p);
  const tg = skAim(p, 220);
  skCastPose(p, 1.4, '万 符 朝 宗', '#ffe066', 42);
  skCastAura(p, 1.4, '#ffe066', 4);
  addEffect('skyGlow', tg.x, tg.y, 1.4, {color:'#ffe066', r:280});
  for(let i = 0; i < 18; i++){
    skAt(i * 66, ()=>{
      const cx = clamp(tg.x + rand(-250, 250), WORLD_L + 30, WORLD_R - 30);
      const cy = tg.y + rand(-40, 40);
      addEffect('talisman', cx, 80, 0.5, {color:i % 4 ? '#ffe066' : '#ff9a3a', n:1, r:0, rise:-320, rot:rand(0, TAU)});
      meleeAoe(p, cx, cy, 70, A * 12, {kb:30});
      /* ★ 每片符落地都有一小簇炸开的金光，不再只是几个小点 */
      addEffect('emberBurst', cx, cy - 20, 0.38, {color:i % 3 ? '#ffe066' : '#ff9a3a', r:76, n:9, rot:rand(0, TAU)});
      addEffect('hitRing', cx, cy, 0.3, {color:'#fff6b0', r:34});
      spawnParticles(cx, cy - 40, 3, {color:'#ffe066', angle:-Math.PI/2, spread:1.1, spMin:60, spMax:230, lifeMin:0.2, lifeMax:0.5, sizeMin:2, sizeMax:6, grav:240});
    });
  }
  skAt(1300, ()=>{
    meleeAoe(p, tg.x, tg.y, 290, A * 60, {kb:240, launch:true});
    addEffect('explosion', tg.x, tg.y, 0.8, {color:'#ffe066', r:202});
    addEffect('emberBurst', tg.x, tg.y - 26, 1.0, {color:'#ffe066', r:340, n:26, rot:rand(0, TAU)});
    addEffect('shockWave', tg.x, tg.y + 2, 0.8, {facing:p.facing, r:420, color:'#fff6b0'});
    skRingBurst(tg.x, tg.y, 220, '#ffe066', 16);
    skShake(18, 0.2, '#ffe066');
  });
}

/* 4 神剑御雷真诀 */
function castTalismanSword(){
  const p = currentSkillCaster || G.player; playSound('thunder');
  const A = skillAtkVal(p);
  const tg = skAim(p, 280);
  skCastPose(p, 1.1, '神 剑 御 雷 真 诀', '#b6cbd6', 40);
  skCastAura(p, 1.1, '#b6cbd6', 4);
  /* ★ 雷云在目标头顶汇聚（跟着目标走） */
  skAt(40, ()=>{
    addEffect('skyCrack', clamp(tg.x, WORLD_L + 60, WORLD_R - 60), 80, 1.0, {width:280, color:'#b6cbd6'});
  });
  for(let i = 0; i < 12; i++){
    skAt(i * 50, ()=>{
      const cx = clamp(tg.x, WORLD_L + 60, WORLD_R - 60);
      const a = i / 12 * TAU;
      spawnParticles(cx + Math.cos(a) * 90, tg.y - 210 + Math.sin(a) * 52, 1,
        {color:i % 2 ? '#b6cbd6' : '#dbe4e8', angle:a + Math.PI, spread:0.3, spMin:90, spMax:230, lifeMin:0.2, lifeMax:0.45, sizeMin:2, sizeMax:6, grav:0});
      if(i % 3 === 0) addEffect('hitRing', cx + Math.cos(a) * 60, tg.y - 210 + Math.sin(a) * 34, 0.3, {color:'#b6cbd6', r:22});
    });
  }
  skAt(620, ()=>{
    /* ★ 气剑落到目标身上，剑尖朝下 */
    const cx = clamp(tg.x, WORLD_L + 60, WORLD_R - 60), cy = tg.y;
    addEffect('giganticSword', cx, cy - 40, 0.9, {color:'#b6cbd6', scale:2.6, tipDown:true});
    addEffect('lightning', cx, cy - 40, 0.7, {color:'#cddde4', scale:1.8, fromY:-220});
    addEffect('spearLine', p.x, p.y - 60, 0.5, {endX:cx, endY:cy - 60, color:'#cddde4', width:14});
    addEffect('emberBurst', cx, cy - 40, 0.6, {color:'#b6cbd6', r:210, n:20, rot:rand(0, TAU)});
    addEffect('explosion', cx, cy, 0.7, {color:'#cddde4', r:122});
    meleeHitRect(p, cx, cy, 420, 260, A * 75, {kb:380, launch:true});
    skBurst(cx, cy - 60, '#b6cbd6', 15, {grav:120, spMin:200, spMax:640});
    skRingBurst(cx, cy, 180, '#cddde4', 18);
    skShake(24, 0.34, '#b6cbd6');
    fxHitstop(0.1);
    playSound('explosion');
  });
}

/* 5 急急如律令 */
function castTalismanCommand(){
  const p = currentSkillCaster || G.player; playSound('skillCast');
  const A = skillAtkVal(p);
  /* ★ 神将冲锋以目标为终点 */
  const tg = skAim(p, 260);
  skCastPose(p, 1.5, '急 急 如 律 令', '#ffe066', 44);
  skCastAura(p, 1.5, '#ffe066', 4);
  addEffect('dharmaWheel', p.x, p.y, 1.6, {color:'#ffe066', r:220});
  addEffect('gateSlash', p.x, p.y - 60, 0.8, {color:'#ffd166', scale:2.0});
  /* ★ 天兵借法：符阵在目标脚下铺开 */
  addEffect('runeCircle', clamp(tg.x, WORLD_L + 80, WORLD_R - 80), tg.y, 1.5, {color:'#ffd166', color2:'#fff6b0', r:220, n:12, speed:1.6});
  /* 两位神将虚影冲锋 */
  for(let s = 0; s < 2; s++){
    skAt(300 + s * 260, ()=>{
      const dir = s === 0 ? 1 : -1;
      const startX = clamp(skSpot(p, tg, 0, 560).x - dir * 60, WORLD_L + 60, WORLD_R - 60);
      for(let i = 0; i < 12; i++){
        skAt(i * 26, ()=>{
          const cx = startX + dir * (i * 46);
          addEffect('afterImage', cx, tg.y, 0.3, {facing:dir, weaponIdx:p.weaponIdx, anim:'skill', alpha:0.45 - i * 0.02, color:'#ffe066'});
          meleeAoe(p, cx, tg.y, 90, A * 12, {kb:80});
          addEffect('emberBurst', cx, tg.y - 24, 0.32, {color:'#ffe066', r:90, n:8, rot:rand(0, TAU)});
          spawnParticles(cx, tg.y - 50, 2, {color:'#ffe066', angle:dir > 0 ? 0 : Math.PI, spread:0.6, spMin:100, spMax:300, lifeMin:0.2, lifeMax:0.5, sizeMin:3, sizeMax:6, grav:120});
        });
      }
    });
  }
  skAt(1300, ()=>{
    const cx = clamp(skSpot(p, tg, 0, 560).x, WORLD_L + 60, WORLD_R - 60), cy = tg.y;
    meleeAoe(p, cx, cy, 340, A * 80, {kb:320, launch:true});
    addEffect('explosion', cx, cy, 0.9, {color:'#ffe066', r:230});
    addEffect('emberBurst', cx, cy - 26, 1.0, {color:'#ffe066', r:380, n:26, rot:rand(0, TAU)});
    addEffect('shockWave', cx, cy + 2, 0.9, {facing:p.facing, r:460, color:'#fff6b0'});
    skRingBurst(cx, cy, 240, '#ffe066', 16);
    skShake(24, 0.35, '#ffe066');
  });
}

/* 6 万鬼符阵 */
function castTalismanGhosts(){
  const p = currentSkillCaster || G.player; playSound('skillCast');
  const A = skillAtkVal(p);
  const tg = skAim(p, 200);
  skCastPose(p, 1.9, '九 幽 黄 泉', '#b388ff', 46);
  skCastAura(p, 1.9, '#b388ff', 4);
  const _cx = () => clamp(tg.x, WORLD_L + 200, WORLD_R - 200);
  addEffect('dharmaWheel', _cx(), tg.y, 2.0, {color:'#b388ff', r:300});
  addEffect('skyGlow', _cx(), tg.y, 1.8, {color:'#6a3a9a', r:340});
  /* ★ 九幽符阵铺开：双层逆向旋转 */
  addEffect('runeCircle', _cx(), tg.y, 1.9, {color:'#b388ff', color2:'#d0a8ff', r:320, n:12, speed:1.5});
  addEffect('runeCircle', _cx(), tg.y, 1.9, {color:'#6a3a9a', color2:'#cdd8e8', r:210, n:8, speed:-2.6, rot:1.2});
  /* 符阵：外圈符纸旋转 */
  for(let i = 0; i < 12; i++){
    skAt(i * 90, ()=>{
      const a = i / 12 * TAU;
      addEffect('talisman', _cx() + Math.cos(a) * 240, tg.y + Math.sin(a) * 90, 0.8, {color:'#d0a8ff', n:1, r:0, rise:20, rot:a});
      skBurst(_cx() + Math.cos(a) * 200, tg.y + Math.sin(a) * 80, '#b388ff', 3, {grav:-60});
    });
  }
  /* 鬼手分三批破土 */
  for(let wave = 0; wave < 3; wave++){
    skAt(500 + wave * 380, ()=>{
      addEffect('ghostHand', _cx(), tg.y + 18, 0.9, {color:'#cdd8e8', n:5, gap:56});
      addEffect('emberBurst', _cx(), tg.y - 26, 0.7, {color:'#b388ff', r:220, n:18, rot:rand(0, TAU)});
      /* 鬼气翻涌 */
      spawnParticles(_cx(), tg.y - 20, 8, {color:wave % 2 ? '#b388ff' : '#cdd8e8', angle:-Math.PI / 2, spread:1.2,
        spMin:70, spMax:280, lifeMin:0.35, lifeMax:0.85, sizeMin:3, sizeMax:8, grav:-90});
      meleeAoe(p, _cx(), tg.y, 210, A * 42, {kb:120});
      for(const e of G.enemies){
        if(e.alive && Math.abs(e.x - _cx()) < 240 && Math.abs(e.y - tg.y) < 80){
          e.rootT = Math.max(e.rootT || 0, 1.2);
        }
      }
      skShake(10, 0.06, '#b388ff');
      playSound('impact');
    });
  }
  skAt(1750, ()=>{
    meleeAoe(p, _cx(), tg.y, 330, A * 190, {kb:460, launch:true});
    addEffect('explosion', _cx(), tg.y, 1.1, {color:'#b388ff', r:259});
    addEffect('skyCrack', _cx(), 80, 1.2, {width:420, color:'#b388ff'});
    skBurst(_cx(), tg.y - 60, '#b388ff', 18, {spMin:200, spMax:760, grav:60});
    skShake(30, 0.45, '#b388ff');
    fxHitstop(0.12);
  });
}

/* ---------------- 丹道师 ---------------- */
/* 1 丹火 */
function castCauldronFire(){
  /* 掷鼎（丹道师根本功）：本命鼎脱手旋转飞出，砸中即炸开炉火。
     ★ 只有鼎这一个模型在飞，命中处一道光爆，不再撒火星 */
  const p = currentSkillCaster || G.player; playSound('skillCast');
  const A = skillAtkVal(p);
  const tg = skAim(p, 200);
  const tx = () => clamp(tg.x, WORLD_L + 60, WORLD_R - 60);
  const ty = () => clamp(tg.y, GY_TOP + 20, GY_BOTTOM);
  spawnText(p.x, p.y, 200, '掷 鼎', '#ff7a4a', 38);
  p.action = { type:'cast', dur:0.35, t:0 };
  skAt(180, ()=>{
    if(!G || gameState !== 'playing') return;
    playSound('skillCast');
    G.projectiles.push({ kind:'realCauldron', x:p.x + p.facing*46, y:p.y - 14, h:34, vx:p.facing*860, vy:0,
      life:1.0, w:130, hh:100, dmg:A*34, pierce:99, hitSet:new Set(), rot:0, scale:1.25,
      color:'#ff7a4a', owner:p });
    addEffect('lightBloom', p.x + p.facing*46, p.y - 48, 0.3, {r:70, rays:10, color:'#ffb04a'});
    skShake(5, 0.02, '#ff7a4a');
  });
  /* 落点余火：鼎砸到的地方留三堆火（接触会持续掉血） */
  for(let i = 0; i < 3; i++){
    skAt(520 + i*150, ()=>{
      if(!G || gameState !== 'playing') return;
      const cx = clamp(tg.x + (i-1)*80, WORLD_L + 40, WORLD_R - 40);
      addEffect('groundFire', cx, ty(), 0.6, {color:'#ff7a4a'});
      meleeAoe(p, cx, ty(), 90, A*8, {kb:40});
    });
  }
}

/* 2 鼎镇压 */
function castCauldronSlam(){
  /* 鼎镇山河：本命鼎腾空放大，当头压落，鼎口喷出一圈炉火。
     ★ 巨鼎下落 + 落地火环，判定与鼎口同宽 */
  const p = currentSkillCaster || G.player; playSound('skillCast');
  const A = skillAtkVal(p);
  const tg = skAim(p, 220);
  const tx = () => clamp(tg.x, WORLD_L + 90, WORLD_R - 90);
  const ty = () => clamp(tg.y, GY_TOP + 20, GY_BOTTOM);
  spawnText(p.x, p.y, 205, '鼎 镇 山 河', '#ffb04a', 42);
  p.action = { type:'cast', dur:0.6, t:0 };
  /* 鼎腾空 */
  addEffect('lightBloom', p.x, p.y - 90, 0.5, {r:90, rays:10, color:'#ffb04a'});

  skAt(560, ()=>{
    if(!G || gameState !== 'playing') return;
    if(p.action && p.action.type === 'cast') p.action = null;
    playSound('impact');
    /* 巨鼎砸落（鼎本体，三足朝下） */
    addEffect('cauldron', tx(), ty(), 0.85, {color:'#ff7a4a', scale:3.2});
    addEffect('hitRing', tx(), ty(), 0.7, {color:'#ffd08a', r:220});
    addEffect('lightBloom', tx(), ty() - 24, 0.5, {r:190, rays:16, color:'#ff7a4a'});
    addEffect('shockWave', tx(), ty() + 2, 0.6, {facing:p.facing, r:280, color:'#ffb04a'});
    meleeAoe(p, tx(), ty(), 210, A*80, {kb:480, launch:true});
    /* 鼎口喷火：四堆火围成一圈（接触持续掉血） */
    for(let d = 0; d < 4; d++){
      const off = (d - 1.5) * 96;
      addEffect('groundFire', tx() + off, ty(), 1.4, {color:'#ff7a4a'});
    }
    skShake(24, 0.34, '#ff7a4a');
    fxHitstop(0.08);
  });
}

/* 3 三昧金丹（真火凝丹） */
function castCauldronSamadhi(){
  /* 三昧金丹：三枚金丹依次飞出，命中处炸开成一朵火莲。
     ★ 金丹 → 火莲，全是模型，不用粒子堆火 */
  const p = currentSkillCaster || G.player; playSound('skillCast');
  const A = skillAtkVal(p);
  const tg = skAim(p, 210);
  const tx = () => clamp(tg.x, WORLD_L + 70, WORLD_R - 70);
  const ty = () => clamp(tg.y, GY_TOP + 20, GY_BOTTOM);
  spawnText(p.x, p.y, 205, '三 昧 金 丹', '#ff5a2a', 42);
  p.action = { type:'cast', dur:1.0, t:0 };
  skCastAura(p, 0.8, '#ff5a2a', 2);

  for(let i = 0; i < 3; i++){
    skAt(260 + i * 300, ()=>{
      if(!G || gameState !== 'playing') return;
      if(i === 0 && p.action && p.action.type === 'cast') p.action = null;
      playSound('skillCast');
      /* 金丹出手 */
      const sx = p.x + p.facing*38, sy = p.y - 70;
      const ang = Math.atan2((ty() - 30) - sy, tx() - sx);
      const spd = 900;
      G.projectiles.push({ kind:'realPill', x:sx, y:sy, h:1,
        vx:Math.cos(ang)*spd, vy:Math.sin(ang)*spd, life:1.0, w:90, hh:76,
        dmg:A*26, pierce:1, hitSet:new Set(), rot:ang, scale:1.6,
        color:'#ff5a2a', owner:p });
      /* 到点炸开火莲 */
      skAt(420, ()=>{
        if(!G || gameState !== 'playing') return;
        const bx = tx(), by = ty();
        addEffect('fireLotus', bx, by - 26, 0.8, {scale:1.5, spin:1.3, bloomDur:0.26});
        addEffect('lightBloom', bx, by - 24, 0.42, {r:120, rays:12, color:'#ff5a2a'});
        meleeAoe(p, bx, by, 120, A*12, {kb:140});
        addEffect('groundFire', bx, by, 0.9, {color:'#ff7a4a'});
        skShake(8, 0.05, '#ff5a2a');
      });
    });
  }
}

/* 4 九转金丹 */
function castCauldronPill(){
  /* 九转金丹：九枚金丹绕身轮转后入体 —— 疗伤、回蓝、短暂无敌，并炸开护体丹光。
     ★ 金丹绕身用 pillOrbit 模型，不用粒子描边 */
  const p = currentSkillCaster || G.player; playSound('heal');
  const A = skillAtkVal(p);
  spawnText(p.x, p.y, 210, '九 转 金 丹', '#ffd166', 44);
  p.action = { type:'cast', dur:1.0, t:0 };
  skCastAura(p, 0.8, '#ffd166', 2);
  /* 丹炉虚影 + 九丹绕身（内外两圈反向转） */
  addEffect('cauldron', p.x, p.y, 1.0, {color:'#ffb04a', scale:1.15});
  addEffect('pillOrbit', p.x, p.y, 1.0, {color:'#ffd166', color2:'#fff6c8', n:9, r:118, h:78, size:13, speed:2.6});
  addEffect('pillOrbit', p.x, p.y, 1.0, {color:'#ff7a4a', color2:'#ffd166', n:9, r:76, h:44, size:10, speed:-3.4});

  skAt(620, ()=>{
    if(!G || gameState !== 'playing') return;
    if(p.action && p.action.type === 'cast') p.action = null;
    /* 九丹入体 */
    p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.25);
    p.mp = Math.min(p.maxMp, p.mp + 40);
    try{ if(window.ONLINE && ONLINE.healAllies) ONLINE.healAllies(0.25, 280); }catch(e){}
    p.invuln = Math.max(p.invuln || 0, 0.9);
    spawnText(p.x, p.y - 40, 180, '+' + Math.round(p.maxHp * 0.25), '#ffd166', 30);
    /* 丹成：护体丹光炸开，近身敌人被震开 */
    addEffect('lightBloom', p.x, p.y - 40, 0.6, {r:230, rays:20, color:'#ffd166'});
    addEffect('hitRing', p.x, p.y, 0.55, {color:'#fff6c8', r:190});
    meleeAoe(p, p.x, p.y, 200, A*50, {kb:320, launch:true});
    skShake(12, 0.14, '#ffd166');
  });
}

/* 5 九丹神火罩（原九龙神火罩：丹道师以丹御火，不再借用飞剑/火龙） */
function castCauldronDragons(){
  /* 九丹神火罩：九枚金丹环罩敌阵，本命鼎倒扣成罩，罩内丹火焚烧。
     ★ 罩子=鼎模型，九丹=pillOrbit，全程无粒子雨 */
  const p = currentSkillCaster || G.player; playSound('skillCast');
  const A = skillAtkVal(p);
  const tg = skAim(p, 240);
  const tx = () => clamp(tg.x, WORLD_L + 170, WORLD_R - 170);
  const ty = () => clamp(tg.y, GY_TOP + 20, GY_BOTTOM);
  spawnText(p.x, p.y, 215, '九 丹 神 火 罩', '#ff5a2a', 44);
  p.action = { type:'cast', dur:1.6, t:0 };
  skCastAura(p, 1.0, '#ff5a2a', 2);
  /* 九丹环阵 */
  addEffect('pillOrbit', tx(), ty(), 1.5, {color:'#ff5a2a', color2:'#ffd166', n:9, r:230, h:120, size:14, speed:2.8});
  addEffect('hitRing', tx(), ty(), 0.5, {color:'#ffd08a', r:230});

  /* 罩成：巨鼎倒扣 + 罩内三段焚炼 */
  skAt(900, ()=>{
    if(!G || gameState !== 'playing') return;
    if(p.action && p.action.type === 'cast') p.action = null;
    playSound('explosion');
    addEffect('cauldron', tx(), ty(), 1.2, {color:'#ff5a2a', scale:3.4});
    addEffect('lightBloom', tx(), ty() - 26, 0.6, {r:230, rays:20, color:'#ff5a2a'});
    meleeAoe(p, tx(), ty(), 260, A*70, {kb:320, launch:true});
    skShake(22, 0.34, '#ff5a2a');
    fxHitstop(0.08);
  });
  /* 罩内焚烧：三波丹火（判定=罩内范围） */
  for(let i = 0; i < 3; i++){
    skAt(1150 + i * 260, ()=>{
      if(!G || gameState !== 'playing') return;
      addEffect('lightBloom', tx(), ty() - 24, 0.4, {r:150 + i*30, rays:12 + i*4, color: i % 2 ? '#ffd166' : '#ff5a2a'});
      meleeAoe(p, tx(), ty(), 240, A*26, {kb:80});
      addEffect('groundFire', tx() + (i-1)*90, ty(), 0.9, {color:'#ff7a4a'});
      skShake(9, 0.06, '#ff5a2a');
    });
  }
}

/* 6 八卦炉·炼天 */
function castCauldronBagua(){
  /* 八卦炉·炼天煮海：以天地为炉 —— 八卦阵纹铺开，本命鼎倒扣，炉火冲天，金丹如雨落下。
     ★ 鼎+金丹+阵纹，粒子只留少量 */
  const p = currentSkillCaster || G.player; playSound('skillCast');
  const A = skillAtkVal(p);
  const tg = skAim(p, 240);
  const tx = () => clamp(tg.x, WORLD_L + 140, WORLD_R - 140);
  const ty = () => clamp(tg.y, GY_TOP + 20, GY_BOTTOM);
  spawnText(p.x, p.y, 220, '炼 天 煮 海', '#ffd166', 48);
  p.action = { type:'cast', dur:2.2, t:0 };
  skCastAura(p, 1.4, '#ffd166', 3);
  /* 八卦阵纹铺地 */
  addEffect('dharmaWheel', tx(), ty(), 2.0, {color:'#ff7a4a', r:330});
  addEffect('pillOrbit', tx(), ty(), 1.8, {color:'#ffd166', color2:'#ff5a2a', n:8, r:240, h:150, size:15, speed:1.8});

  /* 炉盖落下：本命鼎倒扣 */
  skAt(800, ()=>{
    if(!G || gameState !== 'playing') return;
    addEffect('cauldron', tx(), ty(), 1.4, {color:'#ffd166', scale:3.6});
    addEffect('lightBloom', tx(), ty() - 26, 0.7, {r:260, rays:22, color:'#ff7a4a'});
    addEffect('shockWave', tx(), ty() + 2, 0.8, {facing:p.facing, r:420, color:'#ffd166'});
    meleeAoe(p, tx(), ty(), 300, A*110, {kb:420, launch:true});
    skShake(28, 0.44, '#ffd166');
    fxHitstop(0.12);
  });
  /* 炉火冲天 + 金丹雨 */
  for(let i = 0; i < 3; i++){
    skAt(1150 + i * 380, ()=>{
      if(!G || gameState !== 'playing') return;
      if(i === 2 && p.action && p.action.type === 'cast') p.action = null;
      /* 一道炉火柱 */
      addEffect('skyPillar', tx() + (i-1)*120, ty(), 0.6, {height:760, color:'#ff5a2a'});
      /* 金丹自炉中喷出，砸向周围 */
      for(let k = 0; k < 3; k++){
        const ox = (k - 1) * 130 + rand(-20, 20);
        G.projectiles.push({ kind:'realPill', x:tx() + ox, y:ty() - 320, h:1,
          vx:0, vy:1250, life:0.4, w:90, hh:120, dmg:A*18, pierce:1,
          hitSet:new Set(), rot:Math.PI/2, scale:1.5, color:'#ffd166', owner:p });
      }
      meleeAoe(p, tx(), ty(), 300, A*26, {kb:120});
      addEffect('groundFire', tx() + (i-1)*140, ty(), 1.0, {color:'#ff7a4a'});
      skShake(12, 0.1, '#ff7a4a');
    });
  }
}

const SKILL_FUNCS = {
  sword:[castSwordQi, castSwordSky, castSwordRain, castSwordImmortal, castSwordTruthArray, castSwordCome],
  blade:[castBladeFire, castBladeArray, castBladeStorm, castBladeAbyss, castBladeFrostSix, castBladeRulerFlame],
  spear:[castSpearDragon, castSpearThrust, castSpearRain, castSpearPhoenix, castSpearRainStorm, castSpearBlueSilver],
  fist:[castFistQi, castFistPalm, castFistRush, castFistEightExtremes, castFistGreatPalm, castSixPathsFist],
  herb:[castHerbPouch, castHerbVines, castHerbLifeDeath, castHerbDew, castHerbSpider, castHerbShennong],
  axe:[castAxeSplit, castAxeThree, castAxeWhirl, castAxeMountain, castAxeXingtian, castAxePangu],
  talisman:[castTalismanBind, castTalismanThunder, castTalismanRain, castTalismanSword, castTalismanCommand, castTalismanGhosts],
  cauldron:[castCauldronFire, castCauldronSlam, castCauldronSamadhi, castCauldronPill, castCauldronDragons, castCauldronBagua]
};

