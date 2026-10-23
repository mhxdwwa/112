/* ===== 敌人专属技能 ===== */
function enemySwordSlash(){
  /* 敌人剑技：快速三连斩 */
  const e = currentSkillCaster; if(!e) return;
  const p = G.player; if(!p || p.dead) return;
  const atkVal = e.atk;
  e.facing = p.x>e.x?1:-1;
  
  for(let i=0;i<3;i++){
    setTimeout(()=>{
      if(!G || gameState!=='playing' || !e.alive) return;
      playSound('swordSwing');
      const slashX = e.x+e.facing*(80+i*30);
      const slashY = e.y;
      addEffect('slashArc', slashX, slashY, 0.25, {facing:e.facing, color:'#ff4444', size:1.5, typeStr:'stab'});
      
      /* 伤害判定 */
      if(Math.abs(p.x-slashX)<80 && Math.abs((p.y-slashY)*2.2)<50 && p.invuln<=0){
        damagePlayer(atkVal*0.8);
      }
      spawnParticles(slashX, slashY-30, 8, {color:'#ff4444', angle:e.facing>0?0:Math.PI, spread:0.5, spMin:100, spMax:250, lifeMin:0.2, lifeMax:0.5, sizeMin:2, sizeMax:5, grav:300});
    }, i*150);
  }
}

function enemyBladeCharge(){
  /* 敌人刀技：冲锋斩击 */
  const e = currentSkillCaster; if(!e) return;
  const p = G.player; if(!p || p.dead) return;
  const atkVal = e.atk;
  e.facing = p.x>e.x?1:-1;
  
  /* 冲锋 */
  const chargeDist = 200;
  const startX = e.x;
  const targetX = Math.min(Math.max(e.x+e.facing*chargeDist, WORLD_L+120), WORLD_R);
  
  addEffect('slashArc', e.x+e.facing*60, e.y, 0.4, {facing:e.facing, color:'#ff6600', size:2.0, typeStr:'blade'});
  spawnText(e.x, e.y, 120, '冲锋!', '#ff6600', 20);
  
  /* 移动敌人 */
  const chargeSteps = 10;
  for(let i=0;i<chargeSteps;i++){
    setTimeout(()=>{
      if(!G || gameState!=='playing' || !e.alive) return;
      e.x = startX + (targetX-startX)*(i/chargeSteps);
      spawnParticles(e.x, e.y, 4, {color:'#ff6600', angle:-Math.PI/2, spread:0.8, spMin:50, spMax:150, lifeMin:0.2, lifeMax:0.4, sizeMin:3, sizeMax:6, grav:400});
    }, i*30);
  }
  
  /* 最终斩击 */
  setTimeout(()=>{
    if(!G || gameState!=='playing' || !e.alive) return;
    playSound('bladeSwing');
    addEffect('slashArc', e.x+e.facing*80, e.y, 0.35, {facing:e.facing, color:'#ff6600', size:2.5, typeStr:'blade'});
    
    if(Math.abs(p.x-e.x)<120 && Math.abs((p.y-e.y)*2.2)<60 && p.invuln<=0){
      damagePlayer(atkVal*1.5);
      p.launchT = 0.3; p.vy = -300; p.h = Math.max(p.h, 1);
    }
    
    spawnParticles(e.x+e.facing*80, e.y-30, 15, {color:'#ff6600', angle:e.facing>0?0:Math.PI, spread:0.8, spMin:150, spMax:350, lifeMin:0.3, lifeMax:0.6, sizeMin:3, sizeMax:7, grav:400});
    G.shake = Math.max(G.shake, 12);
  }, 350);
}

function enemySpearThrust(){
  /* 敌人枪技：远程枪刺 */
  const e = currentSkillCaster; if(!e) return;
  const p = G.player; if(!p || p.dead) return;
  const atkVal = e.atk;
  e.facing = p.x>e.x?1:-1;
  
  playSound('spearThrust');
  
  /* 发射枪气 */
  const projX = e.x+e.facing*50;
  const projY = e.y-30;
  G.projectiles.push({ kind:'realSpear', x:projX, y:projY, h:50, vx:e.facing*800, vy:0, life:1.0, w:90, hh:40, dmg:atkVal*1.2, pierce:1, hitSet:new Set(), color:'#ffaa00', facing:e.facing, rot:Math.atan2(0,e.facing*800), owner:e });
  
  addEffect('spearLine', e.x, e.y, 0.2, {facing:e.facing, color:'#ffaa00'});
  spawnParticles(projX, projY, 10, {color:'#ffaa00', angle:e.facing>0?0:Math.PI, spread:0.4, spMin:150, spMax:350, lifeMin:0.2, lifeMax:0.4, sizeMin:3, sizeMax:6, grav:0});
}

function enemyFistWave(){
  /* 敌人拳技：气功波 */
  const e = currentSkillCaster; if(!e) return;
  const p = G.player; if(!p || p.dead) return;
  const atkVal = e.atk;
  e.facing = p.x>e.x?1:-1;
  
  playSound('skillCast');
  spawnText(e.x, e.y, 120, '气功波!', '#ff3300', 18);
  
  /* 蓄力 */
  for(let i=0;i<10;i++){
    setTimeout(()=>{
      if(!G || gameState!=='playing' || !e.alive) return;
      const a = (i/10)*TAU;
      const r = 30-i*2;
      spawnParticles(e.x+e.facing*40+Math.cos(a)*r, e.y-50+Math.sin(a)*r*0.5, 3, {color:'#ff3300', angle:Math.atan2(e.y-50-(e.y-50+Math.sin(a)*r*0.5), e.x+e.facing*40-(e.x+e.facing*40+Math.cos(a)*r)), spread:0.3, spMin:50, spMax:120, lifeMin:0.2, lifeMax:0.4, sizeMin:3, sizeMax:6, grav:-50});
    }, i*30);
  }
  
  /* 发射气功波 */
  setTimeout(()=>{
    if(!G || gameState!=='playing' || !e.alive) return;
    playSound('explosion');
    G.projectiles.push({ kind:'qiBomb', x:e.x+e.facing*50, y:e.y-50, h:50, vx:e.facing*600, vy:0, life:1.5, w:100, hh:80, dmg:atkVal*1.8, pierce:2, hitSet:new Set(), color:'#ff3300', facing:e.facing, owner:e });
    
    spawnParticles(e.x+e.facing*50, e.y-50, 20, {color:'#ff3300', angle:e.facing>0?0:Math.PI, spread:0.6, spMin:150, spMax:400, lifeMin:0.3, lifeMax:0.6, sizeMin:4, sizeMax:8, grav:0});
    addEffect('hitRing', e.x+e.facing*50, e.y-50, 0.3, {color:'#ff3300', r:40});
  }, 350);
}

const ENEMY_SKILL_FUNCS = {
  sword:[enemySwordSlash, enemySwordSlash, enemySwordSlash],
  blade:[enemyBladeCharge, enemyBladeCharge, enemyBladeCharge],
  spear:[enemySpearThrust, enemySpearThrust, enemySpearThrust],
  fist:[enemyFistWave, enemyFistWave, enemyFistWave]
};

/* ============ BOSS专属技能系统 ============ */
/* 每个Boss有3个独特技能，带可见轨迹可躲避 */
function _bDmg(dmg){
  const p = G.player;
  if(p && !p.dead && p.invuln<=0) damagePlayer(dmg);
}
function _bDmgAoe(cx,cy,r,dmg,opt){
  const p = G.player;
  if(p && !p.dead && p.invuln<=0){
    if(Math.abs(p.x-cx)<r && Math.abs((p.y-cy)*2.2)<r*0.6){
      damagePlayer(dmg);
      if(opt&&opt.kb) p.kx = (Math.sign(p.x-cx)||1)*opt.kb;
      if(opt&&opt.launch){ p.launchT=0.4; p.vy=-400; p.h=Math.max(p.h,1); }
    }
  }
}

/* ---- 山贼头目(brute): 震地斩 / 旋风斩 / 冲锋斩 ---- */
function boss_brute_slam(){
  const e=currentSkillCaster; if(!e)return;
  e.facing=G.player.x>e.x?1:-1;
  spawnText(e.x,e.y,180,'震 地 斩','#ff6600',30);
  addEffect('enemyCastRing',e.x,e.y,0.6,{color:'#ff6600'});
  for(let i=0;i<15;i++) setTimeout(()=>{
    if(!G||gameState!=='playing'||!e.alive)return;
    spawnParticles(e.x+rand(-40,40),e.y-rand(10,60),4,{color:'#ff6600',angle:-Math.PI/2,spread:1,spMin:60,spMax:200,lifeMin:0.3,lifeMax:0.6,sizeMin:3,sizeMax:7,grav:400});
  },i*30);
  setTimeout(()=>{
    if(!G||gameState!=='playing'||!e.alive)return;
    playSound('explosion');
    const tx=e.x+e.facing*120;
    addEffect('hitRing',tx,e.y,0.5,{color:'#ff6600',r:100});
    addEffect('groundCrack',tx,e.y,1.0,{angle:e.facing>0?0:Math.PI,color:'#ff6600'});
    for(let i=0;i<20;i++) spawnParticles(tx+rand(-60,60),e.y-rand(0,30),5,{color:i%2?'#ff6600':'#ffaa00',angle:-Math.PI/2,spread:1.5,spMin:100,spMax:400,lifeMin:0.4,lifeMax:0.8,sizeMin:3,sizeMax:8,grav:600});
    _bDmgAoe(tx,e.y,130,e.atk*2.5,{kb:200,launch:true});
    G.shake=Math.max(G.shake,18);
  },500);
}
function boss_brute_spin(){
  const e=currentSkillCaster; if(!e)return;
  spawnText(e.x,e.y,180,'旋 风 斩','#ff4400',28);
  e.action={type:'enemySkill',t:0,dur:1.8,hitAt:0.99,hitDone:false};
  addEffect('enemyCastRing',e.x,e.y,0.4,{color:'#ff4400'});
  const hits=8, interval=120;
  for(let i=0;i<hits;i++){
    setTimeout(()=>{
      if(!G||gameState!=='playing'||!e.alive)return;
      const a=i*(TAU/hits);
      playSound('swordSwing');
      addEffect('slashArc',e.x+Math.cos(a)*60,e.y+Math.sin(a)*20,0.25,{facing:Math.cos(a)>0?1:-1,color:'#ff4400',size:2.0,typeStr:'blade'});
      _bDmgAoe(e.x+Math.cos(a)*80,e.y+Math.sin(a)*30,70,e.atk*1.2,{kb:100});
      spawnParticles(e.x+Math.cos(a)*70,e.y-30+Math.sin(a)*20,6,{color:'#ff4400',angle:a,spread:0.8,spMin:80,spMax:250,lifeMin:0.2,lifeMax:0.5,sizeMin:3,sizeMax:6,grav:300});
    },400+i*interval);
  }
}
function boss_brute_charge(){
  const e=currentSkillCaster; if(!e)return;
  e.facing=G.player.x>e.x?1:-1;
  spawnText(e.x,e.y,180,'冲 锋 斩','#ff2200',30);
  addEffect('enemyCastRing',e.x,e.y,0.4,{color:'#ff2200'});
  const startX=e.x, targetX=clamp(e.x+e.facing*350,WORLD_L+100,WORLD_R-100);
  for(let i=0;i<12;i++) setTimeout(()=>{
    if(!G||gameState!=='playing'||!e.alive)return;
    e.x=lerp(startX,targetX,i/12);
    spawnParticles(e.x,e.y,4,{color:'#ff2200',angle:e.facing>0?Math.PI:0,spread:0.6,spMin:60,spMax:180,lifeMin:0.2,lifeMax:0.4,sizeMin:3,sizeMax:6,grav:200});
    _bDmgAoe(e.x,e.y,60,e.atk*0.8,{kb:80});
  },i*40);
  setTimeout(()=>{
    if(!G||gameState!=='playing'||!e.alive)return;
    playSound('bladeSwing');
    addEffect('slashArc',e.x+e.facing*60,e.y,0.4,{facing:e.facing,color:'#ff2200',size:3.0,typeStr:'blade'});
    _bDmgAoe(e.x+e.facing*60,e.y,100,e.atk*3.0,{kb:250,launch:true});
    G.shake=Math.max(G.shake,15);
  },500);
}

/* ---- 巨熊王(bear): 熊掌拍地 / 野蛮冲锋 / 怒吼 ---- */
function boss_bear_slam(){
  const e=currentSkillCaster; if(!e)return;
  e.facing=G.player.x>e.x?1:-1;
  spawnText(e.x,e.y,200,'熊 掌 拍 地','#cc6600',32);
  addEffect('enemyCastRing',e.x,e.y,0.8,{color:'#cc6600'});
  for(let i=0;i<20;i++) setTimeout(()=>{
    if(!G||gameState!=='playing'||!e.alive)return;
    const a=i*0.6,r=50-i*2;
    spawnParticles(e.x+e.facing*40+Math.cos(a)*r,e.y-50+Math.sin(a)*r*0.4,4,{color:i%3===0?'#fff':i%3===1?'#cc6600':'#884400',spread:0.5,spMin:40,spMax:120,lifeMin:0.3,lifeMax:0.5,sizeMin:4,sizeMax:9,grav:-60});
  },i*25);
  setTimeout(()=>{
    if(!G||gameState!=='playing'||!e.alive)return;
    playSound('explosion');
    const tx=e.x+e.facing*100;
    for(let r=0;r<4;r++) setTimeout(()=>{
      if(!G||gameState!=='playing')return;
      addEffect('hitRing',tx,e.y,0.5,{color:r%2?'#cc6600':'#ffaa00',r:60+r*40});
    },r*80);
    addEffect('groundCrack',tx,e.y,1.2,{angle:e.facing>0?0:Math.PI,color:'#cc6600'});
    _bDmgAoe(tx,e.y,150,e.atk*3.0,{kb:250,launch:true});
    for(let i=0;i<30;i++) spawnParticles(tx+rand(-80,80),e.y-rand(0,40),5,{color:'#cc6600',angle:-Math.PI/2,spread:1.5,spMin:100,spMax:500,lifeMin:0.4,lifeMax:1.0,sizeMin:4,sizeMax:10,grav:700});
    G.shake=Math.max(G.shake,25);
  },600);
}
function boss_bear_charge(){
  const e=currentSkillCaster; if(!e)return;
  e.facing=G.player.x>e.x?1:-1;
  spawnText(e.x,e.y,200,'野 蛮 冲 锋','#ff4400',32);
  addEffect('enemyCastRing',e.x,e.y,0.5,{color:'#ff4400'});
  const startX=e.x, targetX=clamp(e.x+e.facing*450,WORLD_L+120,WORLD_R-120);
  for(let i=0;i<15;i++) setTimeout(()=>{
    if(!G||gameState!=='playing'||!e.alive)return;
    e.x=lerp(startX,targetX,i/15);
    spawnParticles(e.x,e.y,6,{color:i%2?'#ff4400':'#cc6600',angle:e.facing>0?Math.PI:0,spread:0.8,spMin:80,spMax:250,lifeMin:0.2,lifeMax:0.5,sizeMin:4,sizeMax:8,grav:300});
    _bDmgAoe(e.x,e.y,70,e.atk*1.0,{kb:120});
    G.shake=Math.max(G.shake,6);
  },i*35);
  setTimeout(()=>{
    if(!G||gameState!=='playing'||!e.alive)return;
    playSound('explosion');
    _bDmgAoe(e.x+e.facing*50,e.y,120,e.atk*3.5,{kb:300,launch:true});
    addEffect('slashArc',e.x+e.facing*50,e.y,0.4,{facing:e.facing,color:'#ff4400',size:3.5,typeStr:'blade'});
    G.shake=Math.max(G.shake,20);
  },550);
}
function boss_bear_roar(){
  const e=currentSkillCaster; if(!e)return;
  spawnText(e.x,e.y,200,'怒 吼','#ffaa00',34);
  addEffect('enemyCastRing',e.x,e.y,0.8,{color:'#ffaa00'});
  for(let i=0;i<30;i++) setTimeout(()=>{
    if(!G||gameState!=='playing'||!e.alive)return;
    const a=i*0.4,r=30+i*3;
    spawnParticles(e.x+Math.cos(a)*r,e.y-50+Math.sin(a)*r*0.3,4,{color:i%3===0?'#fff':i%3===1?'#ffaa00':'#ff6600',angle:a,spread:0.5,spMin:60,spMax:200,lifeMin:0.4,lifeMax:0.8,sizeMin:4,sizeMax:10,grav:-100});
  },i*25);
  setTimeout(()=>{
    if(!G||gameState!=='playing'||!e.alive)return;
    playSound('explosion');
    for(let r=0;r<5;r++) setTimeout(()=>{
      if(!G||gameState!=='playing')return;
      addEffect('hitRing',e.x,e.y,0.6,{color:r%2?'#ffaa00':'#ff6600',r:80+r*50});
    },r*60);
    _bDmgAoe(e.x,e.y,250,e.atk*2.0,{kb:350,launch:true});
    G.shake=Math.max(G.shake,20);
  },700);
}

/* ---- 骷髅将军(skeleton): 骨矛雨 / 死亡剑气 / 骨盾 ---- */
function boss_skeleton_spears(){
  const e=currentSkillCaster; if(!e)return;
  e.facing=G.player.x>e.x?1:-1;
  spawnText(e.x,e.y,180,'骨 矛 雨','#aacc88',30);
  addEffect('enemyCastRing',e.x,e.y,0.5,{color:'#aacc88'});
  const px=G.player.x;
  for(let i=0;i<8;i++){
    setTimeout(()=>{
      if(!G||gameState!=='playing'||!e.alive)return;
      playSound('spearThrust');
      const tx=px+rand(-120,120), sy=-50;
      const ty=G.player.y;
      const flightTime=0.4;
      G.projectiles.push({kind:'realSpear',x:tx,y:sy,h:60,vx:0,vy:(ty-sy)/flightTime,life:flightTime+0.1,w:80,hh:40,dmg:e.atk*1.5,pierce:1,hitSet:new Set(),color:'#aacc88',facing:1,rot:Math.PI/2,owner:e});
      spawnParticles(tx,sy,4,{color:'#aacc88',angle:Math.PI/2,spread:0.3,spMin:50,spMax:150,lifeMin:0.2,lifeMax:0.4,sizeMin:2,sizeMax:5,grav:200});
    },300+i*120);
  }
}
function boss_skeleton_slash(){
  const e=currentSkillCaster; if(!e)return;
  e.facing=G.player.x>e.x?1:-1;
  spawnText(e.x,e.y,180,'死 亡 剑 气','#88ff88',30);
  addEffect('enemyCastRing',e.x,e.y,0.5,{color:'#88ff88'});
  setTimeout(()=>{
    if(!G||gameState!=='playing'||!e.alive)return;
    playSound('bladeSwing');
    for(let i=0;i<3;i++){
      setTimeout(()=>{
        if(!G||gameState!=='playing'||!e.alive)return;
        const dist=100+i*80;
        G.projectiles.push({kind:'flameWave',x:e.x+e.facing*dist,y:e.y-20,h:50,vx:e.facing*600,vy:0,life:0.8,w:120,hh:100,dmg:e.atk*1.8,pierce:2,hitSet:new Set(),color:'#88ff88',facing:e.facing,owner:e,trail:true});
        addEffect('slashArc',e.x+e.facing*dist,e.y-20,0.3,{facing:e.facing,color:'#88ff88',size:2.5,typeStr:'blade'});
      },i*150);
    }
  },400);
}
function boss_skeleton_shield(){
  const e=currentSkillCaster; if(!e)return;
  spawnText(e.x,e.y,180,'骨 盾','#ccddaa',28);
  e.blocking=3.0;
  addEffect('enemyCastRing',e.x,e.y,0.8,{color:'#ccddaa'});
  addEffect('hitRing',e.x,e.y,1.5,{color:'#aacc88',r:80});
  for(let i=0;i<20;i++){
    const a=i*(TAU/20);
    setTimeout(()=>{
      if(!G||gameState!=='playing'||!e.alive)return;
      spawnParticles(e.x+Math.cos(a)*50,e.y-40+Math.sin(a)*20,3,{color:'#ccddaa',angle:a+Math.PI,spread:0.3,spMin:30,spMax:80,lifeMin:0.5,lifeMax:1.0,sizeMin:3,sizeMax:6,grav:-50});
    },i*30);
  }
  setTimeout(()=>{
    if(!G||gameState!=='playing'||!e.alive)return;
    playSound('explosion');
    for(let i=0;i<12;i++){
      const a=i*(TAU/12);
      G.projectiles.push({kind:'realSpear',x:e.x+Math.cos(a)*40,y:e.y-40+Math.sin(a)*15,h:40,vx:Math.cos(a)*500,vy:Math.sin(a)*200,life:0.8,w:60,hh:30,dmg:e.atk*1.2,pierce:1,hitSet:new Set(),color:'#aacc88',facing:Math.cos(a)>0?1:-1,rot:a,owner:e});
    }
    addEffect('hitRing',e.x,e.y,0.5,{color:'#88ff88',r:120});
  },2500);
}

/* ---- 千年树妖(tree_demon): 藤蔓缠绕 / 毒雾 / 树根突刺 ---- */
function boss_tree_vines(){
  const e=currentSkillCaster; if(!e)return;
  e.facing=G.player.x>e.x?1:-1;
  spawnText(e.x,e.y,180,'藤 蔓 缠 绕','#44aa22',30);
  addEffect('enemyCastRing',e.x,e.y,0.5,{color:'#44aa22'});
  const px=G.player.x, py=G.player.y;
  for(let i=0;i<6;i++){
    setTimeout(()=>{
      if(!G||gameState!=='playing'||!e.alive)return;
      const sx=e.x+rand(-30,30), sy=e.y;
      const tx=px+rand(-80,80), ty=py;
      addEffect('groundCrack',tx,ty,0.8,{angle:Math.atan2(ty-sy,tx-sx),color:'#44aa22'});
      for(let j=0;j<10;j++){
        const frac=j/10;
        setTimeout(()=>{
          if(!G||gameState!=='playing')return;
          const vx=lerp(sx,tx,frac), vy=lerp(sy,ty,frac);
          spawnParticles(vx,vy,3,{color:j%2?'#44aa22':'#66cc44',angle:-Math.PI/2,spread:0.5,spMin:20,spMax:60,lifeMin:0.3,lifeMax:0.6,sizeMin:3,sizeMax:6,grav:-80});
        },j*30);
      }
      setTimeout(()=>{
        if(!G||gameState!=='playing')return;
        _bDmgAoe(tx,ty,60,e.atk*1.5,{kb:60});
        addEffect('hitRing',tx,ty,0.3,{color:'#44aa22',r:40});
      },350);
    },300+i*200);
  }
}
function boss_tree_poison(){
  const e=currentSkillCaster; if(!e)return;
  spawnText(e.x,e.y,180,'毒 雾','#aa44ff',30);
  addEffect('enemyCastRing',e.x,e.y,0.6,{color:'#aa44ff'});
  const cx=e.x, cy=e.y;
  addEffect('groundFire',cx,cy,3.0,{size:180,color:'#aa44ff'});
  for(let t=0;t<6;t++){
    setTimeout(()=>{
      if(!G||gameState!=='playing'||!e.alive)return;
      _bDmgAoe(cx,cy,180,e.atk*0.8);
      for(let i=0;i<15;i++){
        const a=rand(0,TAU),r=rand(20,160);
        spawnParticles(cx+Math.cos(a)*r,cy-rand(10,80),3,{color:i%3===0?'#cc66ff':i%3===1?'#aa44ff':'#8822cc',angle:-Math.PI/2,spread:1,spMin:20,spMax:80,lifeMin:0.4,lifeMax:0.8,sizeMin:4,sizeMax:10,grav:-60});
      }
    },500+t*400);
  }
}
function boss_tree_roots(){
  const e=currentSkillCaster; if(!e)return;
  e.facing=G.player.x>e.x?1:-1;
  spawnText(e.x,e.y,180,'树 根 突 刺','#664422',30);
  addEffect('enemyCastRing',e.x,e.y,0.5,{color:'#664422'});
  const px=G.player.x;
  for(let i=0;i<5;i++){
    setTimeout(()=>{
      if(!G||gameState!=='playing'||!e.alive)return;
      const tx=px+rand(-150,150);
      addEffect('groundCrack',tx,e.y,0.6,{angle:-Math.PI/2,color:'#664422'});
      for(let j=0;j<8;j++){
        setTimeout(()=>{
          if(!G||gameState!=='playing')return;
          spawnParticles(tx+rand(-15,15),e.y-j*15,4,{color:j%2?'#664422':'#886644',angle:-Math.PI/2,spread:0.4,spMin:40,spMax:120,lifeMin:0.3,lifeMax:0.6,sizeMin:3,sizeMax:7,grav:-100});
        },j*25);
      }
      setTimeout(()=>{
        if(!G||gameState!=='playing')return;
        _bDmgAoe(tx,e.y,70,e.atk*2.0,{kb:100,launch:true});
        playSound('impact');
      },200);
    },300+i*250);
  }
}

/* ---- 远古青龙(dragon): 龙息 / 龙卷 / 天降雷 ---- */
function boss_dragon_breath(){
  const e=currentSkillCaster; if(!e)return;
  e.facing=G.player.x>e.x?1:-1;
  spawnText(e.x,e.y,200,'龙 息','#44ddff',34);
  addEffect('enemyCastRing',e.x,e.y,0.5,{color:'#44ddff'});
  setTimeout(()=>{
    if(!G||gameState!=='playing'||!e.alive)return;
    playSound('explosion');
    G.projectiles.push({kind:'flameWave',x:e.x+e.facing*60,y:e.y-20,h:60,vx:e.facing*700,vy:0,life:1.5,w:200,hh:150,dmg:e.atk*1.2,pierce:99,hitSet:new Set(),color:'#44ddff',facing:e.facing,owner:e,trail:true});
    for(let i=0;i<25;i++){
      setTimeout(()=>{
        if(!G||gameState!=='playing')return;
        spawnParticles(e.x+e.facing*(80+i*20),e.y-20+rand(-30,30),5,{color:i%3===0?'#fff':i%3===1?'#44ddff':'#2288cc',angle:e.facing>0?0:Math.PI,spread:0.6,spMin:60,spMax:200,lifeMin:0.3,lifeMax:0.6,sizeMin:4,sizeMax:10,grav:100});
      },i*30);
    }
  },400);
}
function boss_dragon_tornado(){
  const e=currentSkillCaster; if(!e)return;
  spawnText(e.x,e.y,200,'龙 卷','#22ccaa',32);
  e.action={type:'enemySkill',t:0,dur:2.5,hitAt:0.99,hitDone:false};
  addEffect('enemyCastRing',e.x,e.y,0.6,{color:'#22ccaa'});
  const cx=e.x, cy=e.y;
  for(let t=0;t<12;t++){
    setTimeout(()=>{
      if(!G||gameState!=='playing'||!e.alive)return;
      const a=t*1.2, r=80+t*10;
      for(let i=0;i<8;i++){
        const pa=a+i*(TAU/8);
        spawnParticles(cx+Math.cos(pa)*r,cy-40+Math.sin(pa)*r*0.3,3,{color:i%2?'#22ccaa':'#44eecc',angle:pa+Math.PI/2,spread:0.4,spMin:40,spMax:120,lifeMin:0.3,lifeMax:0.6,sizeMin:3,sizeMax:7,grav:-80});
      }
      _bDmgAoe(cx+Math.cos(a)*r,cy,80,e.atk*0.6,{kb:150});
      addEffect('hitRing',cx+Math.cos(a)*r,cy,0.2,{color:'#22ccaa',r:50});
    },400+t*150);
  }
}
function boss_dragon_thunder(){
  const e=currentSkillCaster; if(!e)return;
  spawnText(e.x,e.y,200,'天 降 雷','#ffff44',34);
  addEffect('enemyCastRing',e.x,e.y,0.6,{color:'#ffff44'});
  const px=G.player.x, py=G.player.y;
  for(let i=0;i<4;i++){
    setTimeout(()=>{
      if(!G||gameState!=='playing'||!e.alive)return;
      const tx=px+rand(-100,100), ty=py;
      addEffect('lightning',tx,-50,0.5,{endX:tx,endY:ty,color:'#ffff44',width:6});
      playSound('thunder');
      setTimeout(()=>{
        if(!G||gameState!=='playing')return;
        _bDmgAoe(tx,ty,100,e.atk*1.5,{kb:200,launch:true});
        addEffect('explosion',tx,ty,0.5,{r:100,color:'#ffff44'});
        for(let j=0;j<15;j++) spawnParticles(tx+rand(-40,40),ty-rand(0,30),4,{color:j%2?'#ffff44':'#fff',angle:-Math.PI/2,spread:1.5,spMin:80,spMax:300,lifeMin:0.3,lifeMax:0.6,sizeMin:3,sizeMax:7,grav:500});
        G.shake=Math.max(G.shake,12);
      },200);
    },400+i*350);
  }
}

/* ---- 魔将(demon_mage): 魔焰弹 / 暗影斩 / 魔气爆发 ---- */
function boss_demon_flame(){
  const e=currentSkillCaster; if(!e)return;
  e.facing=G.player.x>e.x?1:-1;
  spawnText(e.x,e.y,180,'魔 焰 弹','#cc44ff',30);
  addEffect('enemyCastRing',e.x,e.y,0.5,{color:'#cc44ff'});
  for(let i=0;i<15;i++) setTimeout(()=>{
    if(!G||gameState!=='playing'||!e.alive)return;
    const a=i*0.5,r=50-i*2.5;
    spawnParticles(e.x+e.facing*40+Math.cos(a)*r,e.y-50+Math.sin(a)*r*0.4,4,{color:i%3===0?'#fff':i%3===1?'#cc44ff':'#8800cc',spread:0.4,spMin:40,spMax:120,lifeMin:0.2,lifeMax:0.5,sizeMin:3,sizeMax:8,grav:-200});
  },i*20);
  setTimeout(()=>{
    if(!G||gameState!=='playing'||!e.alive)return;
    playSound('explosion');
    G.projectiles.push({kind:'qiBomb',x:e.x+e.facing*50,y:e.y-30,h:55,vx:e.facing*500,vy:0,life:2.5,w:120,hh:100,dmg:e.atk*1.5,pierce:3,hitSet:new Set(),color:'#cc44ff',facing:e.facing,owner:e});
    for(let i=0;i<20;i++) spawnParticles(e.x+e.facing*50,e.y-30,5,{color:['#cc44ff','#8800cc','#ff66ff'][i%3],angle:e.facing>0?0:Math.PI,spread:0.8,spMin:80,spMax:300,lifeMin:0.3,lifeMax:0.6,sizeMin:3,sizeMax:8,grav:100});
  },350);
}
function boss_demon_shadow(){
  const e=currentSkillCaster; if(!e)return;
  e.facing=G.player.x>e.x?1:-1;
  spawnText(e.x,e.y,180,'暗 影 斩','#aa00ff',30);
  addEffect('enemyCastRing',e.x,e.y,0.3,{color:'#aa00ff'});
  const tx=G.player.x, ty=G.player.y;
  setTimeout(()=>{
    if(!G||gameState!=='playing'||!e.alive)return;
    e.x=tx-e.facing*60;
    playSound('bladeSwing');
    addEffect('slashArc',e.x+e.facing*50,e.y,0.4,{facing:e.facing,color:'#aa00ff',size:3.0,typeStr:'blade'});
    _bDmgAoe(e.x+e.facing*50,e.y,100,e.atk*1.8,{kb:200,launch:true});
    for(let i=0;i<20;i++) spawnParticles(e.x+e.facing*rand(20,80),e.y-rand(10,80),4,{color:i%2?'#aa00ff':'#6600aa',angle:e.facing>0?0:Math.PI,spread:0.8,spMin:80,spMax:250,lifeMin:0.2,lifeMax:0.5,sizeMin:3,sizeMax:7,grav:300});
    G.shake=Math.max(G.shake,12);
  },300);
}
function boss_demon_burst(){
  const e=currentSkillCaster; if(!e)return;
  spawnText(e.x,e.y,200,'魔 气 爆 发','#ff00ff',34);
  addEffect('enemyCastRing',e.x,e.y,0.8,{color:'#ff00ff'});
  for(let i=0;i<25;i++) setTimeout(()=>{
    if(!G||gameState!=='playing'||!e.alive)return;
    const a=i*0.5,r=40+i*3;
    spawnParticles(e.x+Math.cos(a)*r,e.y-40+Math.sin(a)*r*0.3,4,{color:i%3===0?'#fff':i%3===1?'#ff00ff':'#cc00cc',angle:a,spread:0.6,spMin:40,spMax:150,lifeMin:0.4,lifeMax:0.8,sizeMin:4,sizeMax:10,grav:-80});
  },i*25);
  setTimeout(()=>{
    if(!G||gameState!=='playing'||!e.alive)return;
    playSound('explosion');
    for(let r=0;r<4;r++) setTimeout(()=>{
      if(!G||gameState!=='playing')return;
      addEffect('hitRing',e.x,e.y,0.5,{color:r%2?'#ff00ff':'#cc00cc',r:60+r*40});
    },r*60);
    _bDmgAoe(e.x,e.y,200,e.atk*1.5,{kb:300,launch:true});
    for(let i=0;i<16;i++){
      const a=i*(TAU/16);
      G.projectiles.push({kind:'qiBomb',x:e.x+Math.cos(a)*30,y:e.y-40+Math.sin(a)*10,h:40,vx:Math.cos(a)*400,vy:Math.sin(a)*150,life:1.0,w:60,hh:50,dmg:e.atk*0.6,pierce:1,hitSet:new Set(),color:'#cc44ff',facing:Math.cos(a)>0?1:-1,owner:e});
    }
    G.shake=Math.max(G.shake,20);
  },600);
}

/* ---- 雷神(thunder_god): 雷锤落 / 闪电链 / 雷暴领域 ---- */
function boss_thunder_hammer(){
  const e=currentSkillCaster; if(!e)return;
  e.facing=G.player.x>e.x?1:-1;
  spawnText(e.x,e.y,200,'雷 锤 落','#ffff00',34);
  addEffect('enemyCastRing',e.x,e.y,0.6,{color:'#ffff00'});
  const tx=e.x+e.facing*150;
  for(let i=0;i<10;i++) setTimeout(()=>{
    if(!G||gameState!=='playing'||!e.alive)return;
    addEffect('lightning',tx+rand(-30,30),-50,0.3,{endX:tx+rand(-20,20),endY:e.y,color:'#ffff00',width:3});
    spawnParticles(tx+rand(-30,30),e.y-rand(0,60),3,{color:'#ffff00',angle:-Math.PI/2,spread:0.5,spMin:40,spMax:120,lifeMin:0.2,lifeMax:0.4,sizeMin:2,sizeMax:5,grav:300});
  },i*40);
  setTimeout(()=>{
    if(!G||gameState!=='playing'||!e.alive)return;
    playSound('thunder'); playSound('explosion');
    addEffect('lightning',tx,-50,0.6,{endX:tx,endY:e.y,color:'#ffffff',width:10});
    _bDmgAoe(tx,e.y,140,e.atk*2.0,{kb:300,launch:true});
    for(let r=0;r<4;r++) setTimeout(()=>{
      if(!G||gameState!=='playing')return;
      addEffect('hitRing',tx,e.y,0.4,{color:r%2?'#ffff00':'#fff',r:50+r*35});
    },r*50);
    for(let i=0;i<25;i++) spawnParticles(tx+rand(-60,60),e.y-rand(0,40),5,{color:i%3===0?'#fff':i%3===1?'#ffff00':'#ffaa00',angle:-Math.PI/2,spread:1.5,spMin:100,spMax:400,lifeMin:0.3,lifeMax:0.8,sizeMin:3,sizeMax:8,grav:600});
    G.shake=Math.max(G.shake,25);
  },450);
}
function boss_thunder_chain(){
  const e=currentSkillCaster; if(!e)return;
  spawnText(e.x,e.y,200,'闪 电 链','#88ddff',32);
  addEffect('enemyCastRing',e.x,e.y,0.5,{color:'#88ddff'});
  const px=G.player.x, py=G.player.y;
  const bounces=5;
  let prevX=e.x, prevY=e.y-50;
  for(let i=0;i<bounces;i++){
    setTimeout(()=>{
      if(!G||gameState!=='playing'||!e.alive)return;
      const tx=i%2===0?px+rand(-80,80):prevX+rand(-150,150);
      const ty=i%2===0?py:prevY+rand(-40,40);
      addEffect('lightning',prevX,prevY,0.4,{endX:tx,endY:ty,color:'#88ddff',width:4});
      playSound('thunder');
      _bDmgAoe(tx,ty,80,e.atk*0.7,{kb:100});
      addEffect('hitRing',tx,ty,0.2,{color:'#88ddff',r:40});
      for(let j=0;j<8;j++) spawnParticles(tx+rand(-20,20),ty+rand(-20,20),3,{color:j%2?'#88ddff':'#fff',angle:-Math.PI/2,spread:1,spMin:60,spMax:200,lifeMin:0.2,lifeMax:0.4,sizeMin:2,sizeMax:5,grav:400});
      prevX=tx; prevY=ty;
    },300+i*250);
  }
}
function boss_thunder_domain(){
  const e=currentSkillCaster; if(!e)return;
  spawnText(e.x,e.y,200,'雷 暴 领 域','#ffdd00',34);
  e.action={type:'enemySkill',t:0,dur:3.0,hitAt:0.99,hitDone:false};
  addEffect('enemyCastRing',e.x,e.y,0.8,{color:'#ffdd00'});
  const cx=e.x, cy=e.y;
  for(let t=0;t<8;t++){
    setTimeout(()=>{
      if(!G||gameState!=='playing'||!e.alive)return;
      const tx=cx+rand(-200,200), ty=cy+rand(-40,40);
      addEffect('lightning',tx+rand(-20,20),-50,0.4,{endX:tx,endY:ty,color:t%2?'#ffdd00':'#ffff88',width:4});
      playSound('thunder');
      _bDmgAoe(tx,ty,90,e.atk*0.9,{kb:120});
      addEffect('explosion',tx,ty,0.3,{r:60,color:'#ffdd00'});
      for(let i=0;i<10;i++) spawnParticles(tx+rand(-30,30),ty-rand(0,20),3,{color:i%2?'#ffdd00':'#fff',angle:-Math.PI/2,spread:1.2,spMin:60,spMax:200,lifeMin:0.2,lifeMax:0.5,sizeMin:2,sizeMax:6,grav:500});
    },400+t*300);
  }
}

/* ---- 魔尊(dark_lord): 暗黑波 / 魔尊降临 / 灭世斩 ---- */
function boss_dark_wave(){
  const e=currentSkillCaster; if(!e)return;
  e.facing=G.player.x>e.x?1:-1;
  spawnText(e.x,e.y,200,'暗 黑 波','#ff0044',36);
  addEffect('enemyCastRing',e.x,e.y,0.6,{color:'#ff0044'});
  setTimeout(()=>{
    if(!G||gameState!=='playing'||!e.alive)return;
    playSound('explosion');
    for(let i=0;i<3;i++){
      setTimeout(()=>{
        if(!G||gameState!=='playing'||!e.alive)return;
        G.projectiles.push({kind:'flameWave',x:e.x+e.facing*(60+i*40),y:e.y-20,h:60,vx:e.facing*(500+i*100),vy:0,life:2.0,w:180,hh:130,dmg:e.atk*0.9,pierce:99,hitSet:new Set(),color:i===0?'#ff0044':i===1?'#cc0033':'#880022',facing:e.facing,owner:e,trail:true});
        addEffect('slashArc',e.x+e.facing*(60+i*40),e.y-20,0.3,{facing:e.facing,color:'#ff0044',size:2.5,typeStr:'blade'});
      },i*200);
    }
    for(let i=0;i<30;i++) spawnParticles(e.x+e.facing*rand(30,200),e.y-rand(10,80),5,{color:['#ff0044','#cc0033','#880022'][i%3],angle:e.facing>0?0:Math.PI,spread:0.8,spMin:60,spMax:250,lifeMin:0.3,lifeMax:0.7,sizeMin:3,sizeMax:9,grav:200});
  },400);
}
function boss_dark_summon(){
  const e=currentSkillCaster; if(!e)return;
  spawnText(e.x,e.y,200,'魔 尊 降 临','#aa0022',36);
  addEffect('enemyCastRing',e.x,e.y,1.0,{color:'#aa0022'});
  for(let i=0;i<30;i++) setTimeout(()=>{
    if(!G||gameState!=='playing'||!e.alive)return;
    const a=i*0.4,r=30+i*3;
    spawnParticles(e.x+Math.cos(a)*r,e.y-40+Math.sin(a)*r*0.3,4,{color:i%3===0?'#ff0044':i%3===1?'#aa0022':'#660011',angle:a+Math.PI,spread:0.5,spMin:30,spMax:100,lifeMin:0.5,lifeMax:1.0,sizeMin:4,sizeMax:10,grav:-80});
  },i*25);
  setTimeout(()=>{
    if(!G||gameState!=='playing'||!e.alive)return;
    playSound('explosion');
    for(let r=0;r<5;r++) setTimeout(()=>{
      if(!G||gameState!=='playing')return;
      addEffect('hitRing',e.x,e.y,0.6,{color:r%2?'#ff0044':'#aa0022',r:60+r*45});
    },r*70);
    _bDmgAoe(e.x,e.y,250,e.atk*1.8,{kb:350,launch:true});
    for(let i=0;i<12;i++){
      const a=i*(TAU/12);
      G.projectiles.push({kind:'qiBomb',x:e.x+Math.cos(a)*40,y:e.y-40+Math.sin(a)*15,h:45,vx:Math.cos(a)*350,vy:Math.sin(a)*120,life:1.5,w:70,hh:55,dmg:e.atk*0.7,pierce:2,hitSet:new Set(),color:'#ff0044',facing:Math.cos(a)>0?1:-1,owner:e});
    }
    G.shake=Math.max(G.shake,25); G.flash=0.4; G.hitFlashColor='#ff0044';
  },700);
}
function boss_dark_slash(){
  const e=currentSkillCaster; if(!e)return;
  e.facing=G.player.x>e.x?1:-1;
  spawnText(e.x,e.y,200,'灭 世 斩','#ff0000',40);
  addEffect('enemyCastRing',e.x,e.y,0.8,{color:'#ff0000'});
  for(let i=0;i<20;i++) setTimeout(()=>{
    if(!G||gameState!=='playing'||!e.alive)return;
    const a=i*0.6,r=60-i*2;
    spawnParticles(e.x+e.facing*50+Math.cos(a)*r,e.y-60+Math.sin(a)*r*0.4,5,{color:i%3===0?'#fff':i%3===1?'#ff0000':'#cc0000',spread:0.5,spMin:50,spMax:150,lifeMin:0.3,lifeMax:0.6,sizeMin:3,sizeMax:8,grav:-100});
  },i*30);
  setTimeout(()=>{
    if(!G||gameState!=='playing'||!e.alive)return;
    playSound('bladeSwing'); playSound('explosion');
    const slashX=e.x+e.facing*200;
    addEffect('slashArc',slashX,e.y,0.6,{facing:e.facing,color:'#ff0000',size:5.0,typeStr:'blade'});
    addEffect('slashArc',slashX,e.y,0.5,{facing:e.facing,color:'#ff4444',size:4.0,typeStr:'blade'});
    G.projectiles.push({kind:'flameWave',x:e.x+e.facing*80,y:e.y-20,h:70,vx:e.facing*900,vy:0,life:1.5,w:300,hh:200,dmg:e.atk*2.4,pierce:99,hitSet:new Set(),color:'#ff0000',facing:e.facing,owner:e,trail:true});
    for(let i=0;i<15;i++){
      setTimeout(()=>{
        if(!G||gameState!=='playing')return;
        const fx=e.x+e.facing*(100+i*40);
        addEffect('groundCrack',fx,e.y,1.0,{delay:i*0.03,angle:e.facing>0?0:Math.PI,color:'#ff0000'});
      },i*30);
    }
    for(let r=0;r<5;r++) setTimeout(()=>{
      if(!G||gameState!=='playing')return;
      addEffect('hitRing',slashX,e.y,0.5,{color:r%2?'#ff0000':'#fff',r:60+r*35});
    },r*50);
    G.shake=Math.max(G.shake,35); G.flash=0.5; G.hitFlashColor='#ff0000'; G.hitstop=Math.max(G.hitstop,0.2);
  },600);
}

/* ★ Boss技能映射表 */
/* ---- 通用：BOSS 召唤小兵 ---- */
function _bossSummon(e, typeKey, n){
  const bd = ENEMY_TYPES[typeKey];
  if(!bd || !G) return;
  const lv = (G.levelIdx || 0) + 1;
  for(let i=0;i<n;i++){
    const hp = Math.round(bd.hp * (G.currentHpMul || 1) * 0.75);
    G.enemies.push({
      isEnemy:true, alive:true, typeKey, def:Object.assign({}, bd),
      x: e.x + rand(-140,140), y: clamp(e.y + rand(-40,40), GY_TOP+50, GY_BOTTOM-30),
      h:0, vy:0, kx:0, hp, maxHp:hp, mp:bd.maxMp, maxMp:bd.maxMp,
      atk: bd.atk * (G.currentAtkMul || 1), level:lv,
      defense: Math.round(50 * Math.pow(1.05, lv)),
      facing:-1, radius:26*bd.scale, scale:bd.scale, spdMul:G.currentSpdMul||1,
      state:'idle', walkPhase:rand(0,TAU), atkCd:rand(0.5,1.0), skillCd:rand(4,8),
      hurtT:0, hitFlash:0, launchT:0, deathT:0, action:null
    });
    addEffect('enemyCastRing', e.x + rand(-140,140), e.y, 0.7, {color:'#cc44ff'});
  }
  spawnText(e.x, e.y, 210, '召唤！', '#cc44ff', 26);
}

/* ---- 寨主·刀疤(boss): 十字斩 / 号令群盗 / 疾风突进 ---- */
function boss_bandit_cross(){
  const e=currentSkillCaster; if(!e)return;
  e.facing=G.player.x>e.x?1:-1;
  spawnText(e.x,e.y,190,'十 字 斩','#ffd166',30);
  e.action={type:'enemySkill',t:0,dur:1.6,hitAt:0.99,hitDone:false};
  addEffect('enemyCastRing',e.x,e.y,0.5,{color:'#ffd166'});
  /* 第一段：横斩 */
  setTimeout(()=>{
    if(!G||gameState!=='playing'||!e.alive)return;
    playSound('bladeSwing');
    addEffect('slashArc',e.x+e.facing*90,e.y,0.4,{facing:e.facing,color:'#ffd166',size:3.2,typeStr:'blade'});
    _bDmgAoe(e.x+e.facing*110,e.y,120,e.atk*1.8,{kb:160});
    for(let i=0;i<12;i++) spawnParticles(e.x+e.facing*(60+i*14),e.y-40+rand(-20,20),3,{color:'#ffd166',angle:e.facing>0?0:Math.PI,spread:0.7,spMin:80,spMax:260,lifeMin:0.2,lifeMax:0.45,sizeMin:3,sizeMax:7,grav:300});
  },420);
  /* 第二段：竖劈 */
  setTimeout(()=>{
    if(!G||gameState!=='playing'||!e.alive)return;
    playSound('bladeSwing');
    addEffect('groundCrack',e.x+e.facing*150,e.y,0.8,{angle:e.facing>0?0:Math.PI,color:'#ffd166'});
    _bDmgAoe(e.x+e.facing*150,e.y,110,e.atk*2.2,{kb:220,launch:true});
    G.shake=Math.max(G.shake,10);
  },880);
}
function boss_bandit_call(){
  const e=currentSkillCaster; if(!e)return;
  spawnText(e.x,e.y,200,'号 令 群 盗','#ff8800',28);
  addEffect('enemyCastRing',e.x,e.y,0.8,{color:'#ff8800'});
  setTimeout(()=>{
    if(!G||gameState!=='playing'||!e.alive)return;
    _bossSummon(e,'bandit',2);
    /* 号令后自身攻速提升 */
    e.atkBoost = 1.0; e.atkCd = 0;
  },500);
}
function boss_bandit_dash(){
  const e=currentSkillCaster; if(!e)return;
  e.facing=G.player.x>e.x?1:-1;
  spawnText(e.x,e.y,190,'疾 风 突 进','#ffaa33',28);
  addEffect('enemyCastRing',e.x,e.y,0.35,{color:'#ffaa33'});
  const startX=e.x, targetX=clamp(e.x+e.facing*360,WORLD_L+80,WORLD_R-80);
  for(let i=0;i<10;i++) setTimeout(()=>{
    if(!G||gameState!=='playing'||!e.alive)return;
    e.x=lerp(startX,targetX,(i+1)/10);
    spawnParticles(e.x,e.y,3,{color:'#ffaa33',angle:e.facing>0?Math.PI:0,spread:0.5,spMin:60,spMax:180,lifeMin:0.15,lifeMax:0.35,sizeMin:3,sizeMax:6,grav:200});
    _bDmgAoe(e.x,e.y,70,e.atk*0.7,{kb:60});
  },i*45);
}

/* ---- 九尾妖狐(fox): 狐火追魂 / 幻影瞬杀 / 狐火结界 ---- */
function boss_fox_fire(){
  const e=currentSkillCaster; if(!e)return;
  spawnText(e.x,e.y,200,'狐 火 追 魂','#ff6a00',30);
  e.action={type:'enemySkill',t:0,dur:2.0,hitAt:0.99,hitDone:false};
  addEffect('enemyCastRing',e.x,e.y,0.6,{color:'#ff6a00'});
  for(let i=0;i<3;i++) setTimeout(()=>{
    if(!G||gameState!=='playing'||!e.alive)return;
    const p=G.player;
    const ang=Math.atan2((p.y-e.y)*2.0, p.x-e.x) + rand(-0.22,0.22);
    G.projectiles.push({kind:'foxfire',x:e.x,y:e.y-50,h:46,vx:Math.cos(ang)*430,vy:Math.sin(ang)*215,life:2.2,w:52,hh:52,dmg:e.atk*1.6,pierce:0,hitSet:new Set(),color:'#ff6a00',facing:e.facing,owner:e,enemy:true,trail:true,homing:true,homingStr:1.7});
    playSound('fireball');
    for(let j=0;j<8;j++) spawnParticles(e.x,e.y-50,3,{color:j%2?'#ff6a00':'#ffcc44',angle:ang,spread:0.5,spMin:80,spMax:220,lifeMin:0.2,lifeMax:0.5,sizeMin:3,sizeMax:7,grav:-60});
  },380+i*220);
}
function boss_fox_blink(){
  const e=currentSkillCaster; if(!e)return;
  const p=G.player;
  spawnText(e.x,e.y,200,'幻 影 瞬 杀','#cc66ff',30);
  /* 消失 */
  for(let i=0;i<14;i++) spawnParticles(e.x,e.y-50,4,{color:i%2?'#cc66ff':'#ff88ff',spread:1.4,spMin:60,spMax:200,lifeMin:0.3,lifeMax:0.6,sizeMin:3,sizeMax:8,grav:-40});
  addEffect('hitRing',e.x,e.y,0.4,{color:'#cc66ff',r:70});
  setTimeout(()=>{
    if(!G||gameState!=='playing'||!e.alive)return;
    /* 瞬移到玩家侧后方 */
    e.x = clamp(p.x + (p.facing>0?-110:110), WORLD_L+80, WORLD_R-80);
    e.y = p.y; e.facing = p.x>e.x?1:-1;
    addEffect('hitRing',e.x,e.y,0.35,{color:'#cc66ff',r:60});
    playSound('bladeSwing');
    addEffect('slashArc',e.x+e.facing*60,e.y,0.4,{facing:e.facing,color:'#cc66ff',size:3.4,typeStr:'blade'});
    _bDmgAoe(e.x+e.facing*70,e.y,110,e.atk*2.4,{kb:180});
    G.shake=Math.max(G.shake,8);
  },420);
}
function boss_fox_barrier(){
  const e=currentSkillCaster; if(!e)return;
  spawnText(e.x,e.y,200,'狐 火 结 界','#ff8844',30);
  e.action={type:'enemySkill',t:0,dur:2.2,hitAt:0.99,hitDone:false};
  addEffect('enemyCastRing',e.x,e.y,0.7,{color:'#ff8844'});
  const cx=e.x, cy=e.y, N=8;
  for(let i=0;i<N;i++) setTimeout(()=>{
    if(!G||gameState!=='playing'||!e.alive)return;
    const a=i*(TAU/N);
    G.projectiles.push({kind:'foxfire',x:cx,y:cy-50,h:40,vx:Math.cos(a)*330,vy:Math.sin(a)*165,life:1.6,w:44,hh:44,dmg:e.atk*1.2,pierce:1,hitSet:new Set(),color:'#ff8844',facing:1,owner:e,enemy:true,trail:true});
    spawnParticles(cx,cy-50,4,{color:'#ff8844',angle:a,spread:0.4,spMin:80,spMax:200,lifeMin:0.2,lifeMax:0.45,sizeMin:3,sizeMax:6,grav:-40});
  },360+i*60);
}

/* ---- 神兽·麒麟(qilin): 雷角冲撞 / 祥瑞庇佑 / 镇压踏地 ---- */
function boss_qilin_horn(){
  const e=currentSkillCaster; if(!e)return;
  e.facing=G.player.x>e.x?1:-1;
  spawnText(e.x,e.y,200,'雷 角 冲 撞','#ffe066',32);
  addEffect('enemyCastRing',e.x,e.y,0.5,{color:'#ffe066'});
  const startX=e.x, targetX=clamp(e.x+e.facing*420,WORLD_L+80,WORLD_R-80);
  for(let i=0;i<12;i++) setTimeout(()=>{
    if(!G||gameState!=='playing'||!e.alive)return;
    e.x=lerp(startX,targetX,(i+1)/12);
    addEffect('lightning',e.x,GY_TOP,e.x,{endX:e.x,endY:e.y,color:'#ffe066',width:3});
    spawnParticles(e.x,e.y,4,{color:i%2?'#ffe066':'#fff',angle:e.facing>0?Math.PI:0,spread:0.7,spMin:80,spMax:240,lifeMin:0.15,lifeMax:0.4,sizeMin:3,sizeMax:7,grav:200});
    _bDmgAoe(e.x,e.y,80,e.atk*0.9,{kb:80});
  },i*50);
  setTimeout(()=>{
    if(!G||gameState!=='playing'||!e.alive)return;
    playSound('thunder');
    _bDmgAoe(e.x,e.y,150,e.atk*2.6,{kb:260,launch:true});
    addEffect('explosion',e.x,e.y,0.4,{r:90,color:'#ffe066'});
    G.shake=Math.max(G.shake,14);
  },640);
}
function boss_qilin_heal(){
  const e=currentSkillCaster; if(!e)return;
  spawnText(e.x,e.y,210,'祥 瑞 庇 佑','#88ffcc',30);
  e.action={type:'enemySkill',t:0,dur:1.6,hitAt:0.99,hitDone:false};
  addEffect('enemyCastRing',e.x,e.y,1.0,{color:'#88ffcc'});
  for(let i=0;i<18;i++) spawnParticles(e.x+rand(-60,60),e.y,3,{color:i%2?'#88ffcc':'#ccffe0',angle:-Math.PI/2,spread:1,spMin:60,spMax:180,lifeMin:0.5,lifeMax:1.0,sizeMin:3,sizeMax:8,grav:-120});
  setTimeout(()=>{
    if(!G||gameState!=='playing'||!e.alive)return;
    const heal=Math.round(e.maxHp*0.07);
    e.hp=Math.min(e.maxHp,e.hp+heal);
    e.blocking=2.0;
    spawnText(e.x,e.y,230,'+'+heal,'#88ffcc',26);
    addEffect('hitRing',e.x,e.y,0.5,{color:'#88ffcc',r:110});
  },600);
}
function boss_qilin_stomp(){
  const e=currentSkillCaster; if(!e)return;
  spawnText(e.x,e.y,200,'镇 压 踏 地','#ffcc44',32);
  e.action={type:'enemySkill',t:0,dur:2.2,hitAt:0.99,hitDone:false};
  addEffect('enemyCastRing',e.x,e.y,0.6,{color:'#ffcc44'});
  const cx=e.x, cy=e.y;
  for(let ring=0;ring<3;ring++) setTimeout(()=>{
    if(!G||gameState!=='playing'||!e.alive)return;
    playSound('impact');
    const r=70+ring*60;
    addEffect('hitRing',cx,cy,0.4,{color:'#ffcc44',r:r});
    addEffect('groundCrack',cx+e.facing*r*0.6,cy,0.7,{angle:e.facing>0?0:Math.PI,color:'#ffcc44'});
    for(let i=0;i<14;i++){
      const a=i*(TAU/14);
      spawnParticles(cx+Math.cos(a)*r*0.7,cy+Math.sin(a)*r*0.22,3,{color:i%2?'#ffcc44':'#fff5cc',angle:a,spread:0.4,spMin:80,spMax:240,lifeMin:0.25,lifeMax:0.55,sizeMin:3,sizeMax:8,grav:400});
    }
    _bDmgAoe(cx,cy,r,e.atk*1.5,{kb:200});
    G.shake=Math.max(G.shake,10+ring*3);
  },420+ring*260);
}

/* ---- 神兽·朱雀(phoenix): 烈焰俯冲 / 火羽散射 / 涅槃 ---- */
function boss_phoenix_dive(){
  const e=currentSkillCaster; if(!e)return;
  const p=G.player;
  spawnText(e.x,e.y,210,'烈 焰 俯 冲','#ff4422',32);
  addEffect('enemyCastRing',e.x,e.y,0.5,{color:'#ff4422'});
  /* 升空 */
  for(let i=0;i<10;i++) setTimeout(()=>{
    if(!G||gameState!=='playing'||!e.alive)return;
    e.h=Math.min(220,(e.h||0)+26);
    spawnParticles(e.x+rand(-30,30),e.y-e.h,4,{color:i%2?'#ff4422':'#ffaa00',angle:-Math.PI/2,spread:1,spMin:60,spMax:180,lifeMin:0.2,lifeMax:0.5,sizeMin:3,sizeMax:7,grav:120});
  },i*40);
  /* 锁定玩家位置后俯冲 */
  setTimeout(()=>{
    if(!G||gameState!=='playing'||!e.alive)return;
    const tx=G.player.x, ty=G.player.y;
    e.x=tx; e.y=ty;
    e.h=220;
    for(let i=0;i<8;i++) setTimeout(()=>{
      if(!G||gameState!=='playing'||!e.alive)return;
      e.h=Math.max(0,220*(1-(i+1)/8));
      spawnParticles(e.x,e.y-e.h,6,{color:i%2?'#ff4422':'#ffcc00',angle:-Math.PI/2,spread:1.2,spMin:80,spMax:260,lifeMin:0.2,lifeMax:0.5,sizeMin:3,sizeMax:8,grav:300});
    },i*35);
    setTimeout(()=>{
      if(!G||gameState!=='playing'||!e.alive)return;
      playSound('explosion');
      addEffect('explosion',tx,ty,0.5,{r:110,color:'#ff4422'});
      _bDmgAoe(tx,ty,140,e.atk*1.8,{kb:280,launch:true});
      for(let i=0;i<24;i++) spawnParticles(tx+rand(-70,70),ty-rand(0,40),4,{color:i%2?'#ff4422':'#ffdd44',angle:-Math.PI/2,spread:1.6,spMin:120,spMax:420,lifeMin:0.3,lifeMax:0.7,sizeMin:3,sizeMax:9,grav:600});
      G.shake=Math.max(G.shake,18);
    },8*35+40);
  },460);
}
function boss_phoenix_feather(){
  const e=currentSkillCaster; if(!e)return;
  spawnText(e.x,e.y,200,'火 羽 散 射','#ffaa22',30);
  e.action={type:'enemySkill',t:0,dur:2.0,hitAt:0.99,hitDone:false};
  addEffect('enemyCastRing',e.x,e.y,0.6,{color:'#ffaa22'});
  const N=10;
  for(let i=0;i<N;i++) setTimeout(()=>{
    if(!G||gameState!=='playing'||!e.alive)return;
    const a=-Math.PI*0.85 + (i/(N-1))*Math.PI*0.7;
    G.projectiles.push({kind:'feather',x:e.x,y:e.y-70-Math.max(0,e.h||0),h:70+(e.h||0),vx:Math.cos(a)*380*e.facing,vy:Math.sin(a)*380,life:2.0,w:40,hh:40,dmg:e.atk*0.8,pierce:0,hitSet:new Set(),color:'#ffaa22',facing:e.facing,owner:e,enemy:true,trail:true,rot:a});
    playSound('arrow');
  },330+i*45);
}
function boss_phoenix_rebirth(){
  const e=currentSkillCaster; if(!e)return;
  spawnText(e.x,e.y,220,'涅 槃','#ffcc00',38);
  e.action={type:'enemySkill',t:0,dur:2.4,hitAt:0.99,hitDone:false};
  addEffect('enemyCastRing',e.x,e.y,1.0,{color:'#ffcc00'});
  const cx=e.x, cy=e.y;
  for(let i=0;i<26;i++) setTimeout(()=>{
    if(!G||gameState!=='playing'||!e.alive)return;
    const a=i*0.7,r=40+i*4;
    spawnParticles(cx+Math.cos(a)*r*0.6,cy-40+Math.sin(a)*r*0.25,3,{color:i%3===0?'#fff':i%3===1?'#ffcc00':'#ff6600',angle:-Math.PI/2,spread:0.6,spMin:60,spMax:200,lifeMin:0.4,lifeMax:0.8,sizeMin:3,sizeMax:8,grav:-140});
  },i*30);
  setTimeout(()=>{
    if(!G||gameState!=='playing'||!e.alive)return;
    const heal=Math.round(e.maxHp*0.10);
    e.hp=Math.min(e.maxHp,e.hp+heal);
    spawnText(e.x,e.y,240,'+'+heal,'#ffcc00',28);
    playSound('explosion');
    /* 全屏火环 */
    for(let ring=0;ring<3;ring++) setTimeout(()=>{
      if(!G||gameState!=='playing'||!e.alive)return;
      const r=120+ring*90;
      addEffect('hitRing',cx,cy,0.45,{color:'#ffcc00',r:r});
      _bDmgAoe(cx,cy,r*1.1,e.atk*0.8,{kb:200});
      G.shake=Math.max(G.shake,10+ring*4);
    },ring*200);
  },700);
}

/* ---- 天神·火神(fire_god): 陨石天降 / 火焰新星 / 熔岩地带 ---- */
function boss_fire_meteor(){
  const e=currentSkillCaster; if(!e)return;
  spawnText(e.x,e.y,220,'陨 石 天 降','#ff3311',34);
  e.action={type:'enemySkill',t:0,dur:2.6,hitAt:0.99,hitDone:false};
  addEffect('enemyCastRing',e.x,e.y,0.8,{color:'#ff3311'});
  const px=G.player.x, py=G.player.y;
  for(let i=0;i<5;i++) setTimeout(()=>{
    if(!G||gameState!=='playing'||!e.alive)return;
    /* 前 3 颗预判玩家位置，后 2 颗随机 */
    const tx = i<3 ? px+rand(-70,70) : e.x+rand(-260,260);
    const ty = py+rand(-30,30);
    addEffect('hitRing',tx,ty,0.6,{color:'#ff3311',r:70});
    setTimeout(()=>{
      if(!G||gameState!=='playing')return;
      playSound('explosion');
      addEffect('explosion',tx,ty,0.45,{r:90,color:'#ff3311'});
      _bDmgAoe(tx,ty,100,e.atk*2.4,{kb:220,launch:true});
      for(let j=0;j<18;j++) spawnParticles(tx+rand(-50,50),ty-rand(0,30),4,{color:j%2?'#ff3311':'#ffaa00',angle:-Math.PI/2,spread:1.5,spMin:100,spMax:380,lifeMin:0.3,lifeMax:0.7,sizeMin:3,sizeMax:9,grav:600});
      G.shake=Math.max(G.shake,14);
    },520);
  },360+i*230);
}
function boss_fire_nova(){
  const e=currentSkillCaster; if(!e)return;
  spawnText(e.x,e.y,210,'火 焰 新 星','#ff5500',32);
  e.action={type:'enemySkill',t:0,dur:2.2,hitAt:0.99,hitDone:false};
  addEffect('enemyCastRing',e.x,e.y,0.7,{color:'#ff5500'});
  const cx=e.x, cy=e.y;
  for(let ring=0;ring<3;ring++) setTimeout(()=>{
    if(!G||gameState!=='playing'||!e.alive)return;
    playSound('fireball');
    const r=90+ring*80;
    addEffect('hitRing',cx,cy,0.5,{color:'#ff5500',r:r});
    for(let i=0;i<18;i++){
      const a=i*(TAU/18);
      spawnParticles(cx+Math.cos(a)*r*0.5,cy+Math.sin(a)*r*0.16,3,{color:i%2?'#ff5500':'#ffbb00',angle:a,spread:0.3,spMin:100,spMax:300,lifeMin:0.3,lifeMax:0.6,sizeMin:4,sizeMax:9,grav:-60});
    }
    _bDmgAoe(cx,cy,r,e.atk*1.6,{kb:180});
    G.shake=Math.max(G.shake,8+ring*3);
  },420+ring*280);
}
function boss_fire_ground(){
  const e=currentSkillCaster; if(!e)return;
  spawnText(e.x,e.y,220,'熔 岩 地 带','#ff2200',34);
  e.action={type:'enemySkill',t:0,dur:3.0,hitAt:0.99,hitDone:false};
  addEffect('enemyCastRing',e.x,e.y,0.9,{color:'#ff2200'});
  const cx=e.x, cy=e.y;
  /* 4 处熔岩，持续燃烧 3 秒 */
  for(let z=0;z<4;z++) setTimeout(()=>{
    if(!G||gameState!=='playing'||!e.alive)return;
    const tx = cx + rand(-280,280), ty = cy + rand(-40,40);
    addEffect('groundFire',tx,ty,2.6,{color:'#ff2200'});
    for(let t=0;t<7;t++) setTimeout(()=>{
      if(!G||gameState!=='playing')return;
      _bDmgAoe(tx,ty,80,e.atk*0.55,{kb:0});
      for(let j=0;j<5;j++) spawnParticles(tx+rand(-45,45),ty-rand(0,15),3,{color:j%2?'#ff2200':'#ffaa00',angle:-Math.PI/2,spread:0.9,spMin:50,spMax:170,lifeMin:0.2,lifeMax:0.5,sizeMin:3,sizeMax:7,grav:-40});
    },t*370);
  },400+z*220);
}

/* ============================================================
   ★ 深渊神话五 Boss —— 专属技能（特效全加强：多段、大范围、狂震屏）
   ============================================================ */

/* ---- 子帝·玄夜雷君(abthunder): 九霄神雷 / 雷狱风暴 / 玄夜雷狱 ---- */
function boss_ab_thunder_nine(){
  const e=currentSkillCaster; if(!e)return;
  spawnText(e.x,e.y,220,'九 霄 神 雷','#c8a0ff',40);
  addEffect('enemyCastRing',e.x,e.y,1.0,{color:'#c8a0ff'});
  const px=G.player.x, py=G.player.y;
  for(let wv=0;wv<3;wv++){
    setTimeout(()=>{
      if(!G||gameState!=='playing'||!e.alive)return;
      for(let i=0;i<4;i++){
        const tx=(wv%2===0?px:e.x)+rand(-260,260), ty=(wv%2===0?py:e.y)+rand(-30,30);
        setTimeout(()=>{
          if(!G||gameState!=='playing'||!e.alive)return;
          addEffect('lightning',tx+rand(-20,20),-50,0.35,{endX:tx,endY:ty,color:wv===2?'#ffffff':'#c8a0ff',width:7});
          playSound('thunder');
          _bDmgAoe(tx,ty,120,e.atk*1.6,{kb:200});
          addEffect('hitRing',tx,ty,0.35,{color:'#c8a0ff',r:90});
          for(let j=0;j<12;j++) spawnParticles(tx+rand(-50,50),ty-rand(0,50),5,{color:j%2?'#c8a0ff':'#fff',angle:-Math.PI/2,spread:1.4,spMin:120,spMax:380,lifeMin:0.3,lifeMax:0.7,sizeMin:3,sizeMax:9,grav:600});
          G.shake=Math.max(G.shake,14);
        },i*110);
      }
    },300+wv*600);
  }
  setTimeout(()=>{
    if(!G||gameState!=='playing'||!e.alive)return;
    playSound('explosion');
    addEffect('lightning',px,-50,0.7,{endX:px,endY:py,color:'#ffffff',width:16});
    _bDmgAoe(px,py,220,e.atk*3.2,{kb:400,launch:true});
    for(let r=0;r<5;r++) setTimeout(()=>{ if(G&&gameState==='playing') addEffect('hitRing',px,py,0.5,{color:r%2?'#fff':'#c8a0ff',r:80+r*60}); },r*60);
    G.shake=Math.max(G.shake,32);
  },2200);
}
function boss_ab_thunder_storm(){
  const e=currentSkillCaster; if(!e)return;
  spawnText(e.x,e.y,220,'雷 狱 风 暴','#aa70ff',40);
  e.action={type:'enemySkill',t:0,dur:3.4,hitAt:0.99,hitDone:false};
  addEffect('enemyCastRing',e.x,e.y,0.9,{color:'#aa70ff'});
  const cx=e.x, cy=e.y;
  for(let t=0;t<12;t++){
    setTimeout(()=>{
      if(!G||gameState!=='playing'||!e.alive)return;
      const a=t*0.55, r=90+t*22;
      const tx=cx+Math.cos(a)*r, ty=cy+Math.sin(a)*r*0.4;
      addEffect('lightning',tx,-50,0.3,{endX:tx,endY:ty,color:t%2?'#aa70ff':'#e8d0ff',width:5});
      playSound('thunder');
      _bDmgAoe(tx,ty,100,e.atk*1.2,{kb:150});
      for(let j=0;j<8;j++) spawnParticles(tx+rand(-30,30),ty-rand(0,30),4,{color:j%2?'#aa70ff':'#fff',angle:-Math.PI/2,spread:1,spMin:80,spMax:260,lifeMin:0.2,lifeMax:0.5,sizeMin:3,sizeMax:7,grav:500});
    },350+t*200);
  }
  setTimeout(()=>{
    if(!G||gameState!=='playing'||!e.alive)return;
    playSound('explosion');
    for(let i=0;i<14;i++){
      const a=i*(TAU/14);
      G.projectiles.push({kind:'qiBomb',x:e.x+Math.cos(a)*40,y:e.y-40+Math.sin(a)*14,h:40,vx:Math.cos(a)*430,vy:Math.sin(a)*160,life:1.2,w:64,hh:52,dmg:e.atk*1.1,pierce:1,hitSet:new Set(),color:'#b080ff',facing:Math.cos(a)>0?1:-1,owner:e});
    }
    G.shake=Math.max(G.shake,24);
  },2000);
}
function boss_ab_thunder_descend(){
  const e=currentSkillCaster; if(!e)return;
  const px=G.player.x, py=G.player.y;
  spawnText(e.x,e.y,220,'玄 夜 雷 狱','#e0c0ff',42);
  addEffect('enemyCastRing',e.x,e.y,0.8,{color:'#e0c0ff'});
  e.action={type:'enemySkill',t:0,dur:1.6,hitAt:0.99,hitDone:false};
  setTimeout(()=>{
    if(!G||gameState!=='playing'||!e.alive)return;
    e.x=px+rand(-40,40); e.y=py;
    playSound('thunder'); playSound('explosion');
    addEffect('explosion',e.x,e.y,0.9,{r:240,color:'#c8a0ff'});
    addEffect('lightning',e.x,-50,0.8,{endX:e.x,endY:e.y,color:'#ffffff',width:22});
    _bDmgAoe(e.x,e.y,260,e.atk*3.8,{kb:450,launch:true});
    for(let i=0;i<40;i++){
      const a=rand(0,TAU), r=rand(30,240);
      spawnParticles(e.x+Math.cos(a)*r,e.y-Math.abs(Math.sin(a))*40,6,{color:i%3===0?'#fff':i%3===1?'#c8a0ff':'#8050ff',angle:-Math.PI/2,spread:1.6,spMin:150,spMax:520,lifeMin:0.4,lifeMax:0.9,sizeMin:4,sizeMax:12,grav:800});
    }
    G.shake=Math.max(G.shake,40);
  },800);
}

/* ---- 丑罡·铁壁牛魔(abbull): 崩城蛮冲 / 铁壁震荡 / 玄锤坠世 ---- */
function boss_ab_bull_charge(){
  const e=currentSkillCaster; if(!e)return;
  e.facing=G.player.x>e.x?1:-1;
  spawnText(e.x,e.y,220,'崩 城 蛮 冲','#d8a020',40);
  addEffect('enemyCastRing',e.x,e.y,0.5,{color:'#d8a020'});
  const x0=e.x, x1=clamp(G.player.x+e.facing*120, WORLD_L+80, WORLD_R-80);
  e.action={type:'enemySkill',t:0,dur:1.5,hitAt:0.99,hitDone:false};
  const steps=10;
  for(let i=1;i<=steps;i++){
    setTimeout(()=>{
      if(!G||gameState!=='playing'||!e.alive)return;
      e.x=x0+(x1-x0)*i/steps;
      playSound('explosion');
      _bDmgAoe(e.x,e.y,120,e.atk*1.3,{kb:420,launch:true});
      addEffect('hitRing',e.x,e.y,0.3,{color:'#d8a020',r:70});
      for(let j=0;j<8;j++) spawnParticles(e.x+rand(-40,40),e.y-rand(0,30),5,{color:j%2?'#d8a020':'#8a6a10',angle:-Math.PI/2,spread:1.2,spMin:100,spMax:300,lifeMin:0.3,lifeMax:0.6,sizeMin:4,sizeMax:9,grav:700});
      G.shake=Math.max(G.shake,16);
    },250+i*110);
  }
  setTimeout(()=>{
    if(!G||gameState!=='playing'||!e.alive)return;
    playSound('explosion');
    addEffect('explosion',x1,e.y,0.8,{r:200,color:'#d8a020'});
    _bDmgAoe(x1,e.y,220,e.atk*2.4,{kb:500,launch:true});
    G.shake=Math.max(G.shake,34);
  },250+steps*110+150);
}
function boss_ab_bull_wall(){
  const e=currentSkillCaster; if(!e)return;
  spawnText(e.x,e.y,220,'铁 壁 震 荡','#c89010',40);
  e.action={type:'enemySkill',t:0,dur:1.8,hitAt:0.99,hitDone:false};
  addEffect('enemyCastRing',e.x,e.y,0.7,{color:'#c89010'});
  setTimeout(()=>{
    if(!G||gameState!=='playing'||!e.alive)return;
    playSound('explosion');
    for(let r=0;r<4;r++) setTimeout(()=>{
      if(!G||gameState!=='playing'||!e.alive)return;
      addEffect('hitRing',e.x,e.y,0.6,{color:r%2?'#c89010':'#ffe080',r:90+r*90});
      _bDmgAoe(e.x,e.y,120+r*90,e.atk*(1.2-r*0.15),{kb:300});
      G.shake=Math.max(G.shake,22+r*4);
    },r*220);
    for(let i=0;i<45;i++){
      const a=rand(0,TAU);
      spawnParticles(e.x+Math.cos(a)*rand(40,160),e.y-rand(0,30),6,{color:i%3===0?'#ffe080':i%3===1?'#c89010':'#6a5010',angle:-Math.PI/2,spread:1.5,spMin:140,spMax:460,lifeMin:0.4,lifeMax:0.9,sizeMin:4,sizeMax:11,grav:800});
    }
  },600);
}
function boss_ab_bull_smash(){
  const e=currentSkillCaster; if(!e)return;
  e.facing=G.player.x>e.x?1:-1;
  spawnText(e.x,e.y,220,'玄 锤 坠 世','#ffb020',42);
  addEffect('enemyCastRing',e.x,e.y,0.8,{color:'#ffb020'});
  const tx=G.player.x, ty=G.player.y;
  for(let i=0;i<8;i++) setTimeout(()=>{
    if(!G||gameState!=='playing'||!e.alive)return;
    spawnParticles(tx+rand(-60,60),-rand(0,80),4,{color:i%2?'#ffb020':'#8a5a08',angle:Math.PI/2,spread:0.3,spMin:60,spMax:160,lifeMin:0.3,lifeMax:0.6,sizeMin:4,sizeMax:9,grav:400});
  },i*90);
  setTimeout(()=>{
    if(!G||gameState!=='playing'||!e.alive)return;
    playSound('explosion');
    addEffect('explosion',tx,ty,1.0,{r:250,color:'#ffb020'});
    addEffect('hitRing',tx,ty,0.6,{color:'#ffe0a0',r:200});
    _bDmgAoe(tx,ty,240,e.atk*3.6,{kb:480,launch:true});
    for(let i=0;i<35;i++) spawnParticles(tx+rand(-110,110),ty-rand(0,60),6,{color:i%3===0?'#fff':i%3===1?'#ffb020':'#8a5a08',angle:-Math.PI/2,spread:1.6,spMin:160,spMax:520,lifeMin:0.4,lifeMax:1.0,sizeMin:4,sizeMax:12,grav:850});
    G.shake=Math.max(G.shake,38);
  },900);
}

/* ---- 寅啸·风虎麒麟(abtiger): 风刃百斩 / 裂空虎啸 / 踏风连突 ---- */
function boss_ab_tiger_gale(){
  const e=currentSkillCaster; if(!e)return;
  e.facing=G.player.x>e.x?1:-1;
  spawnText(e.x,e.y,220,'风 刃 百 斩','#70e8d8',40);
  addEffect('enemyCastRing',e.x,e.y,0.5,{color:'#70e8d8'});
  for(let i=0;i<8;i++){
    setTimeout(()=>{
      if(!G||gameState!=='playing'||!e.alive)return;
      const f=G.player.x>e.x?1:-1; e.facing=f;
      addEffect('slashArc',e.x+f*(70+i*8),e.y-30,0.25,{facing:f,color:'#70e8d8',size:2.6,typeStr:'blade'});
      G.projectiles.push({kind:'qiBomb',x:e.x+f*60,y:e.y-30,h:30,vx:f*640,vy:0,life:1.1,w:70,hh:46,dmg:e.atk*0.9,pierce:1,hitSet:new Set(),color:'#70e8d8',facing:f,owner:e});
      playSound('bladeSwing');
    },i*140);
  }
}
function boss_ab_tiger_roar(){
  const e=currentSkillCaster; if(!e)return;
  spawnText(e.x,e.y,240,'裂 空 虎 啸','#50d8c0',42);
  e.action={type:'enemySkill',t:0,dur:1.6,hitAt:0.99,hitDone:false};
  addEffect('enemyCastRing',e.x,e.y,0.7,{color:'#50d8c0'});
  setTimeout(()=>{
    if(!G||gameState!=='playing'||!e.alive)return;
    playSound('explosion');
    const f=e.facing;
    for(let r=0;r<3;r++) setTimeout(()=>{
      if(!G||gameState!=='playing'||!e.alive)return;
      addEffect('hitRing',e.x+f*(100+r*70),e.y-20,0.4,{color:'#50d8c0',r:110+r*30});
      _bDmgAoe(e.x+f*(100+r*70),e.y,140,e.atk*1.5,{kb:380});
      G.shake=Math.max(G.shake,20+r*5);
    },r*160);
    for(let i=0;i<30;i++) spawnParticles(e.x+f*rand(40,320),e.y-rand(0,90),5,{color:i%2?'#50d8c0':'#c0fff4',angle:0,spread:0.9,spMin:180,spMax:480,lifeMin:0.3,lifeMax:0.7,sizeMin:3,sizeMax:9,grav:120});
  },550);
}
function boss_ab_tiger_dash(){
  const e=currentSkillCaster; if(!e)return;
  spawnText(e.x,e.y,220,'踏 风 连 突','#a0f0e0',40);
  addEffect('enemyCastRing',e.x,e.y,0.4,{color:'#a0f0e0'});
  for(let i=0;i<3;i++){
    setTimeout(()=>{
      if(!G||gameState!=='playing'||!e.alive)return;
      const px=G.player.x, py=G.player.y;
      e.x=px+(G.player.x>e.x?-1:1)*70+rand(-30,30); e.y=py;
      e.facing=G.player.x>e.x?1:-1;
      playSound('bladeSwing');
      addEffect('slashArc',e.x+e.facing*50,e.y-20,0.35,{facing:e.facing,color:'#a0f0e0',size:3.2,typeStr:'blade'});
      _bDmgAoe(e.x+e.facing*50,e.y,110,e.atk*1.7,{kb:280});
      for(let j=0;j<14;j++) spawnParticles(e.x+rand(-50,50),e.y-rand(0,70),4,{color:j%2?'#a0f0e0':'#fff',angle:-Math.PI/2,spread:1.3,spMin:100,spMax:320,lifeMin:0.2,lifeMax:0.5,sizeMin:3,sizeMax:8,grav:300});
      G.shake=Math.max(G.shake,18);
    },400+i*420);
  }
}

/* ---- 辰帝·渊火龙皇(abdragon): 龙炎燎世 / 龙皇灭世啸 / 业火流星 ---- */
function boss_ab_dragon_flame(){
  const e=currentSkillCaster; if(!e)return;
  e.facing=G.player.x>e.x?1:-1;
  spawnText(e.x,e.y,220,'龙 炎 燎 世','#ff8820',42);
  addEffect('enemyCastRing',e.x,e.y,0.7,{color:'#ff8820'});
  setTimeout(()=>{
    if(!G||gameState!=='playing'||!e.alive)return;
    playSound('explosion');
    for(let i=0;i<5;i++){
      setTimeout(()=>{
        if(!G||gameState!=='playing'||!e.alive)return;
        G.projectiles.push({kind:'flameWave',x:e.x+e.facing*(60+i*44),y:e.y-20,h:60,vx:e.facing*(520+i*90),vy:0,life:2.2,w:200,hh:140,dmg:e.atk*1.5,pierce:99,hitSet:new Set(),color:i%2?'#ff8820':'#ffcc33',facing:e.facing,owner:e,trail:true});
      },i*180);
    }
    for(let i=0;i<40;i++) spawnParticles(e.x+e.facing*rand(30,320),e.y-rand(10,90),6,{color:['#ff8820','#ffcc33','#ff4400'][i%3],angle:e.facing>0?0:Math.PI,spread:0.9,spMin:100,spMax:380,lifeMin:0.3,lifeMax:0.8,sizeMin:4,sizeMax:11,grav:150});
    G.shake=Math.max(G.shake,26);
  },500);
}
function boss_ab_dragon_roar(){
  const e=currentSkillCaster; if(!e)return;
  spawnText(e.x,e.y,240,'龙 皇 灭 世 啸','#ffb020',44);
  e.action={type:'enemySkill',t:0,dur:2.4,hitAt:0.99,hitDone:false};
  addEffect('enemyCastRing',e.x,e.y,1.0,{color:'#ffb020'});
  for(let i=0;i<30;i++) setTimeout(()=>{
    if(!G||gameState!=='playing'||!e.alive)return;
    const a=i*0.5,r=30+i*4;
    spawnParticles(e.x+Math.cos(a)*r,e.y-50+Math.sin(a)*r*0.3,5,{color:i%3===0?'#fff':i%3===1?'#ffb020':'#ff5500',angle:a,spread:0.6,spMin:50,spMax:180,lifeMin:0.4,lifeMax:0.9,sizeMin:4,sizeMax:10,grav:-100});
  },i*30);
  setTimeout(()=>{
    if(!G||gameState!=='playing'||!e.alive)return;
    playSound('explosion');
    for(let r=0;r<5;r++) setTimeout(()=>{
      if(!G||gameState!=='playing'||!e.alive)return;
      addEffect('hitRing',e.x,e.y,0.7,{color:r%2?'#ffb020':'#ff5500',r:110+r*80});
      _bDmgAoe(e.x,e.y,140+r*80,e.atk*(2.0-r*0.2),{kb:380,launch:true});
      G.shake=Math.max(G.shake,28+r*3);
    },r*200);
  },900);
}
function boss_ab_dragon_meteor(){
  const e=currentSkillCaster; if(!e)return;
  spawnText(e.x,e.y,220,'业 火 流 星','#ff6610',42);
  addEffect('enemyCastRing',e.x,e.y,0.9,{color:'#ff6610'});
  const px=G.player.x, py=G.player.y;
  for(let i=0;i<7;i++){
    const tx=px+rand(-240,240), ty=py+rand(-40,40), t=500+i*260;
    setTimeout(()=>{
      if(!G||gameState!=='playing'||!e.alive)return;
      spawnParticles(tx,-rand(0,60),6,{color:i%2?'#ff6610':'#ffcc33',angle:Math.PI/2,spread:0.25,spMin:120,spMax:260,lifeMin:0.4,lifeMax:0.8,sizeMin:6,sizeMax:13,grav:500});
    },t-260);
    setTimeout(()=>{
      if(!G||gameState!=='playing'||!e.alive)return;
      playSound('explosion');
      addEffect('explosion',tx,ty,0.7,{r:150,color:'#ff6610'});
      addEffect('hitRing',tx,ty,0.4,{color:'#ffcc33',r:130});
      _bDmgAoe(tx,ty,140,e.atk*1.8,{kb:260,launch:true});
      for(let j=0;j<16;j++) spawnParticles(tx+rand(-60,60),ty-rand(0,40),5,{color:j%3===0?'#fff':j%3===1?'#ff6610':'#882000',angle:-Math.PI/2,spread:1.5,spMin:120,spMax:420,lifeMin:0.3,lifeMax:0.8,sizeMin:4,sizeMax:10,grav:700});
      G.shake=Math.max(G.shake,20);
    },t);
  }
}

/* ---- 巳祖·万毒蛇渊(abserpent): 万毒蛇潮 / 九幽毒瘴 / 缠狱九头 ---- */
function boss_ab_serpent_spit(){
  const e=currentSkillCaster; if(!e)return;
  spawnText(e.x,e.y,220,'万 毒 蛇 潮','#90ff40',40);
  addEffect('enemyCastRing',e.x,e.y,0.6,{color:'#90ff40'});
  setTimeout(()=>{
    if(!G||gameState!=='playing'||!e.alive)return;
    playSound('explosion');
    for(let wv=0;wv<2;wv++){
      setTimeout(()=>{
        if(!G||gameState!=='playing'||!e.alive)return;
        const baseA=Math.atan2((G.player.y-e.y)*0.4,(G.player.x-e.x));
        for(let i=0;i<7;i++){
          const a=baseA+(i-3)*0.24+wv*0.12;
          G.projectiles.push({kind:'foxfire',x:e.x+Math.cos(a)*40,y:e.y-30+Math.sin(a)*14,h:34,vx:Math.cos(a)*430,vy:Math.sin(a)*180,life:2.0,w:46,hh:40,dmg:e.atk*1.1,pierce:1,hitSet:new Set(),color:wv?'#b0ff60':'#60ff40',facing:Math.cos(a)>0?1:-1,owner:e});
        }
      },wv*380);
    }
    G.shake=Math.max(G.shake,14);
  },450);
}
function boss_ab_serpent_venom(){
  const e=currentSkillCaster; if(!e)return;
  spawnText(e.x,e.y,240,'九 幽 毒 瘴','#60ff80',42);
  e.action={type:'enemySkill',t:0,dur:2.0,hitAt:0.99,hitDone:false};
  addEffect('enemyCastRing',e.x,e.y,0.9,{color:'#60ff80'});
  const px=G.player.x, py=G.player.y;
  setTimeout(()=>{
    if(!G||gameState!=='playing'||!e.alive)return;
    playSound('explosion');
    /* 五处毒瘴落点，持续 6 判 */
    for(let z=0;z<5;z++){
      const zx=px+rand(-220,220), zy=py+rand(-40,40);
      addEffect('explosion',zx,zy,1.2,{r:130,color:'#60ff80'});
      for(let t=0;t<6;t++) setTimeout(()=>{
        if(!G||gameState!=='playing'||!e.alive)return;
        _bDmgAoe(zx,zy,110,e.atk*0.55,{kb:0});
        for(let j=0;j<6;j++) spawnParticles(zx+rand(-80,80),zy-rand(0,30),3,{color:j%2?'#60ff80':'#3a8a30',angle:-Math.PI/2,spread:1,spMin:40,spMax:140,lifeMin:0.4,lifeMax:0.9,sizeMin:4,sizeMax:9,grav:-60});
      },t*450);
    }
    for(let r=0;r<3;r++) setTimeout(()=>{ if(G&&gameState==='playing') addEffect('hitRing',px,py,0.5,{color:'#60ff80',r:120+r*70}); },r*160);
    G.shake=Math.max(G.shake,26);
  },700);
}
function boss_ab_serpent_bind(){
  const e=currentSkillCaster; if(!e)return;
  spawnText(e.x,e.y,220,'缠 狱 九 头','#50ff90',44);
  e.action={type:'enemySkill',t:0,dur:2.6,hitAt:0.99,hitDone:false};
  addEffect('enemyCastRing',e.x,e.y,0.8,{color:'#50ff90'});
  for(let i=0;i<9;i++){
    setTimeout(()=>{
      if(!G||gameState!=='playing'||!e.alive)return;
      const tx=G.player.x+rand(-140,140), ty=G.player.y+rand(-24,24);
      addEffect('lightning',tx,-50,0.3,{endX:tx,endY:ty,color:i%2?'#50ff90':'#c0ffb0',width:8});
      playSound('thunder');
      _bDmgAoe(tx,ty,110,e.atk*1.25,{kb:160,launch:i===4});
      addEffect('hitRing',tx,ty,0.3,{color:'#50ff90',r:80});
      for(let j=0;j<10;j++) spawnParticles(tx+rand(-40,40),ty-rand(0,40),4,{color:j%2?'#50ff90':'#d0ffd0',angle:-Math.PI/2,spread:1.2,spMin:90,spMax:300,lifeMin:0.2,lifeMax:0.6,sizeMin:3,sizeMax:8,grav:550});
      G.shake=Math.max(G.shake,16);
    },350+i*240);
  }
}

const BOSS_SKILLS = {
  boss:    [boss_bandit_cross, boss_bandit_call, boss_bandit_dash],
  brute:   [boss_brute_slam, boss_brute_spin, boss_brute_charge],
  bear:    [boss_bear_slam, boss_bear_charge, boss_bear_roar],
  skeleton:[boss_skeleton_spears, boss_skeleton_slash, boss_skeleton_shield],
  fox:     [boss_fox_fire, boss_fox_blink, boss_fox_barrier],
  tree_demon:[boss_tree_vines, boss_tree_poison, boss_tree_roots],
  qilin:   [boss_qilin_horn, boss_qilin_heal, boss_qilin_stomp],
  phoenix: [boss_phoenix_dive, boss_phoenix_feather, boss_phoenix_rebirth],
  dragon:  [boss_dragon_breath, boss_dragon_tornado, boss_dragon_thunder],
  demon_mage:[boss_demon_flame, boss_demon_shadow, boss_demon_burst],
  fire_god:[boss_fire_meteor, boss_fire_nova, boss_fire_ground],
  thunder_god:[boss_thunder_hammer, boss_thunder_chain, boss_thunder_domain],
  dark_lord:[boss_dark_wave, boss_dark_summon, boss_dark_slash],
  /* 深渊神话五 Boss */
  abthunder:[boss_ab_thunder_nine, boss_ab_thunder_storm, boss_ab_thunder_descend],
  abbull:   [boss_ab_bull_charge, boss_ab_bull_wall, boss_ab_bull_smash],
  abtiger:  [boss_ab_tiger_gale, boss_ab_tiger_roar, boss_ab_tiger_dash],
  abdragon: [boss_ab_dragon_flame, boss_ab_dragon_roar, boss_ab_dragon_meteor],
  abserpent:[boss_ab_serpent_spit, boss_ab_serpent_venom, boss_ab_serpent_bind]
};

function tryUseSkill(p, idx){
  if(p.dead || p.action) return;
  const w = WEAPONS[p.weaponIdx], sk = w.skills[idx];
  if(!sk || !SKILL_FUNCS[w.id] || !SKILL_FUNCS[w.id][idx]) return;
  /* ★ PK 模式：六招全开，不受等级与任务限制 */
  if(!p.pvpAllSkills){
    if(p.skillsUnlocked && !p.skillsUnlocked[idx]){
      spawnText(p.x, p.y, 140, '尚未领悟此招', '#ff8a7a', 18);
      return;
    }
    if((p.level || 1) < (sk.unlock || 1)){
      spawnText(p.x, p.y, 140, '需 Lv.' + sk.unlock + ' 方可施展', '#ff8a7a', 18);
      return;
    }
  }
  if(p.cds[idx] > 0) return;
  if(p.mp < sk.cost){ spawnText(p.x, p.y, 140, '内力不足', '#7fd4ff', 20); return; }
  p.mp -= sk.cost;
  /* ★ 冷却缩减：Roguelike 倍率 × 装备词条百分比（上限 50%） */
  const cdr = Math.min(0.5, (p.cdReducePct || 0) / 100);
  const cdMul = (p.cdReduction || 1) * (1 - cdr);
  p.cds[idx] = sk.cd * cdMul;
  /* ★ PK 伤害预算：一招技能合计只打掉目标一定比例的最大生命，
     保证六招全放完约掉一半血，且不受技能段数影响 */
  if(G && G.isPvp){
    const tgt = (p === G.player) ? G.player2 : G.player;
    p.pvpBudget = {
      left: (tgt && tgt.maxHp ? tgt.maxHp : 3000) * (PVP_SKILL_FRAC[idx] || 0.08),
      until: (G.t || 0) + 4.5
    };
  }
  currentSkillCaster = p;
  currentSkillIdx = idx;
  SKILL_FUNCS[w.id][idx]();
  currentSkillCaster = null;
  currentSkillIdx = -1;
}
function tryPlayerAttack(p){
  if(p.dead) return;
  if(p.action){ p.attackBuffer = 0.25; return; }
  const w = WEAPONS[p.weaponIdx];
  let idx = p.comboWindow > 0 ? (p.comboIdx+1)%5 : 0;
  p.comboIdx = idx; p.comboWindow = 1.2;
  const c = w.combo[idx];
  p.action = {type:'attack', idx, t:0, c, hitDone:false, startX:p.x, weaponType:w.id};
  playSound(c.sound);
}

/* ★ 远程普攻：发射法术投射物（炼药师小草 / 符咒师符纸 / 丹道师仙丹）
   粒子会智能追着「发射瞬间敌人的初始位置」飞过去，碰到即结算伤害 */
function fireBasicProjectile(p, c){
  const w = WEAPONS[p.weaponIdx];
  const cfg = BASIC_SHOT[w.id] || BASIC_SHOT.herb;
  const atkVal = playerAtk() * (c.dmg || 1.0);
  const dir = p.facing || 1;
  /* 枪口贴近身体（远程角色贴脸也要能命中），并对齐敌方躯干高度带 */
  const sx = p.x + dir * 22, sy = p.y - 12;
  /* ★ 锁定目标初始位置：发射瞬间选取最近敌人（PvP 则选对手），记录其当前位置作为追踪点 */
  let lockX = p.x + dir * 620, lockY = sy, hasLock = false;
  if(G.isPvp){
    const opp = (p === G.player) ? G.player2 : G.player;
    if(opp && !opp.dead){ lockX = opp.x; lockY = opp.y - 6; hasLock = true; }
  } else {
    /* 优先锁定面朝方向最近的敌人（不往背后拐），前方没有才取全局最近 */
    let best = null, bd = Infinity;
    for(const e of G.enemies){
      if(!e.alive) continue;
      if((e.x - p.x) * dir < -30) continue;  /* 身后超过 30px 的不瞄 */
      const d = (e.x - p.x) * (e.x - p.x) + (e.y - p.y) * (e.y - p.y);
      if(d < bd){ bd = d; best = e; }
    }
    if(!best){
      for(const e of G.enemies){
        if(!e.alive) continue;
        const d = (e.x - p.x) * (e.x - p.x) + (e.y - p.y) * (e.y - p.y);
        if(d < bd){ bd = d; best = e; }
      }
    }
    if(best){ lockX = best.x; lockY = best.y - 6; hasLock = true; }
  }
  /* 初始飞行方向：有锁定目标时朝目标飞，否则按朝向直飞 */
  let vx = dir * cfg.speed, vy = 0;
  if(hasLock){
    const ddx = lockX - sx, ddy = lockY - sy;
    const dd = Math.hypot(ddx, ddy);
    if(dd > 1){ vx = (ddx / dd) * cfg.speed; vy = (ddy / dd) * cfg.speed; }
  }
  const pr = {
    kind:'spellShot', subKind:w.id,
    x:sx, y:sy, vx, vy,
    life:1.15, w:cfg.w, hh:cfg.hh,
    dmg:atkVal, pierce:cfg.pierce, hitSet:new Set(),
    color:cfg.color, glow:cfg.glow, core:cfg.core, rot:0, owner:p, trail:true,
    lockPos:hasLock, lockX, lockY, homingStr:7
  };
  G.projectiles.push(pr);
  /* ★ 贴脸补伤：敌人紧贴玩家（含侧后贴身）时，发射瞬间即对近身敌人结算一次伤害，
     避免“敌人很近反而粒子打不到”的问题（飞行弹也会继续命中更远的敌人） */
  for(const e of G.enemies){
    if(!e.alive) continue;
    const dx = e.x - p.x;
    if(Math.abs(dx) < pr.w*0.5 + e.radius + 16
       && Math.abs((e.y - sy)*2.2) < pr.hh*0.5 + e.radius*0.6 + 12){
      damageEnemy(e, atkVal, p, {kb:200});
      pr.hitSet.add(e);
      if(pr.pierce !== undefined){ pr.pierce--; if(pr.pierce < 0) break; }
    }
  }
  playSound('dart');
}

