/* ===== 玩家更新 ===== */
function updatePlayer(p, dt){
  if(p.kx && Math.abs(p.kx) > 1){
    p.x += p.kx*dt; p.kx *= Math.pow(0.001, dt);
    p.x = clamp(p.x, WORLD_L + 120, WORLD_R);
  }
  if(p.launchT > 0 && p.landingT <= 0){ p.launchT -= dt; p.vy += 2200*dt; p.h += p.vy*dt; if(p.h<=0){ p.h=0; p.vy=0; p.launchT=0; } }
  else if(p.jumpT > 0){
    p.jumpT -= dt;
    const prog = 1-(p.jumpT/0.55);
    p.h = Math.sin(clamp(prog,0,1)*Math.PI)*150;
    if(p.jumpT <= 0){ p.h=0; p.jumpT=0; p.state='idle'; }
  }
  else if(p.landingT > 0){ p.vy = 0; }
  else if(p.h > 0 || p.vy < 0){ p.vy += 2200*dt; p.h += p.vy*dt; if(p.h<=0){ p.h=0; p.vy=0; if(p.state==='jump') p.state='idle'; } }

  let canMove = !p.action || p.action.type === 'storm';
  if(p.action && p.action.type === 'bladeDash' && p.action.phase === 'dash') canMove = true;
  if(p.action && p.action.type === 'attack') canMove = p.action.t > p.action.c.windup + p.action.c.strike;

  const moveSpeed = p.moveSpeed || 350;
  if(canMove){
    let mx=0, my=0;
    if(p.isAI && G && G.player){
      /* 守门人PK：AI自动走向玩家 */
      const dx = G.player.x - p.x;
      const dy = G.player.y - p.y;
      const dist = Math.hypot(dx, dy);
      if(dist > 60){
        mx = dx / dist;
        my = dy / dist;
      } else {
        /* 近距离：随机攻击 */
        if(!p.action && Math.random() < 0.02){
          tryPlayerAttack(p);
        }
      }
    } else if(p.playerNum === 2){
      if(keys['ArrowLeft']) mx--;
      if(keys['ArrowRight']) mx++;
      if(keys['ArrowUp']) my--;
      if(keys['ArrowDown']) my++;
    } else {
      if(keys['KeyA'] || (keys['ArrowLeft'] && !G.isPvp)) mx--;
      if(keys['KeyD'] || (keys['ArrowRight'] && !G.isPvp)) mx++;
      if(keys['KeyW'] || (keys['ArrowUp'] && !G.isPvp)) my--;
      if(keys['KeyS'] || (keys['ArrowDown'] && !G.isPvp)) my++;
    }
    const touch = getTouchInput(p.playerNum);
    if(touch.mx !== 0 || touch.my !== 0){ mx += touch.mx; my += touch.my; }
    if(mx || my){
      const len = Math.hypot(mx,my)||1;
      let sp = (keys['ShiftLeft']||keys['ShiftRight'])?1.5:1;
      p.x += (mx/len)*moveSpeed*sp*dt;
      p.y += (my/len)*(moveSpeed*0.75)*sp*dt;
      p.walkPhase += dt*(sp>1?16:11);
      if(mx !== 0) p.facing = mx>0?1:-1;
      p.state = 'run';
    } else p.state = 'idle';
  }

  const maxX = G.isPvp ? WORLD_R : (G.worldWidth || WORLD_R);
  p.x = clamp(p.x, WORLD_L + 120, maxX);
  p.y = clamp(p.y, GY_TOP+25, GY_BOTTOM-8);

  if(p.landingT > 0){
    p.landingT -= dt;
    const t = 1-(p.landingT/0.4);
    p.h = (p.landingStartH||100)*(1-easeOutQuad(clamp(t,0,1)));
    p.vy = 0;
    if(p.landingT <= 0){ p.h=0; p.landingT=0; p.state='idle'; spawnParticles(p.x, p.y, 10, {color:'#aaa', angle:-Math.PI/2, spread:1.0, spMin:40, spMax:120, lifeMin:0.2, lifeMax:0.5, sizeMin:2, sizeMax:5}); }
  } else {
    const jumpPressed = p.playerNum === 2 ? pressed['Numpad0'] : (pressed['Space'] || pressed['KeyK']);
    if(jumpPressed && p.h <= 0 && !p.jumpT && !p.action){
      p.jumpT = 0.55; p.state = 'jump';
      spawnParticles(p.x, p.y, 12, {color:'#fff', angle:-Math.PI/2, spread:0.8, spMin:80, spMax:200, lifeMin:0.3, lifeMax:0.6, sizeMin:3, sizeMax:6});
      playSound('jump');
    }
  }

  /* ★ 闪避翻滚机制 + 格挡窗口 */
  if(p.dodgeT > 0){
    p.dodgeT -= dt;
    /* ★ 格挡窗口：翻滚前0.15秒内可以格挡 */
    const inParryWindow = p.dodgeT > (0.4 - 0.15);
    p.parryActive = inParryWindow;
    p.invuln = Math.max(p.invuln, 0.1); /* 翻滚期间无敌 */
    const dodgeSpeed = 600;
    p.x += p.dodgeDir * dodgeSpeed * dt;
    p.x = clamp(p.x, WORLD_L + 120, G.isPvp ? WORLD_R : (G.worldWidth || WORLD_R));
    p.y = clamp(p.y, GY_TOP+25, GY_BOTTOM-8);
    /* 翻滚动画：身体蜷缩旋转 */
    const dodgeProg = 1 - (p.dodgeT / 0.4);
    p.bodyLean = Math.sin(dodgeProg * Math.PI) * 0.8 * p.dodgeDir;
    p.kneeBend = 15;
    p.upperArmAng = 1.8;
    p.foreArmAng = -1.5;
    p.backUpperArmAng = 1.9;
    p.backForeArmAng = -1.4;
    /* 格挡窗口特效：金色光环 */
    if(inParryWindow && Math.random() < 0.5){
      spawnParticles(p.x, p.y - 50, 2, {color:'#ffd700', angle:rand(0,TAU), spread:1.0, spMin:30, spMax:80, lifeMin:0.15, lifeMax:0.3, sizeMin:2, sizeMax:4, grav:-50});
    }
    /* 翻滚拖尾粒子 */
    if(Math.random() < 0.3){
      spawnParticles(p.x, p.y - 30, 2, {color:'#aaa', angle:Math.PI + p.dodgeDir * 0.5, spread:0.5, spMin:50, spMax:150, lifeMin:0.2, lifeMax:0.4, sizeMin:2, sizeMax:4, grav:200});
    }
    if(p.dodgeT <= 0){
      p.state = 'idle';
      p.bodyLean = 0.05;
      p.kneeBend = 3;
      p.parryActive = false;
    }
  } else {
    /* 闪避冷却恢复 */
    if(p.dodgeCd > 0) p.dodgeCd -= dt;
    /* 体力恢复 */
    p.stamina = Math.min(p.maxStamina, p.stamina + 20 * dt);
    /* 闪避输入 */
    const dodgeKey = p.playerNum === 1 ? (pressed['ShiftLeft'] || pressed['KeyL']) : (pressed['ShiftRight'] || pressed['Numpad3']);
    if(dodgeKey && p.dodgeCd <= 0 && p.stamina >= 20 && !p.action && p.h <= 0 && !p.jumpT){
      p.dodgeT = 0.4;
      /* ★ Roguelike: 闪避冷却缩减 */
      p.dodgeCd = 0.6 * (p.dodgeCdMul || 1);
      p.stamina -= 20;
      p.state = 'dodge';
      /* 翻滚方向：根据输入方向或面朝方向 */
      let dodgeDir = p.facing;
      if(p.playerNum === 2){
        if(keys['ArrowLeft']) dodgeDir = -1;
        else if(keys['ArrowRight']) dodgeDir = 1;
      } else {
        if(keys['KeyA'] || (keys['ArrowLeft'] && !G.isPvp)) dodgeDir = -1;
        else if(keys['KeyD'] || (keys['ArrowRight'] && !G.isPvp)) dodgeDir = 1;
      }
      p.dodgeDir = dodgeDir;
      p.facing = dodgeDir;
      playSound('jump');
      spawnParticles(p.x, p.y, 8, {color:'#fff', angle:-Math.PI/2, spread:1.0, spMin:100, spMax:250, lifeMin:0.2, lifeMax:0.5, sizeMin:2, sizeMax:5});
    }
  }

  if(p.action){
    p.action.t += dt;
    if(p.action.type === 'attack'){
      const c = p.action.c, t = p.action.t;
      const totalDur = c.windup+c.strike+c.recover;
      const wType = p.action.weaponType;
      if(t < c.windup){
        const k = t/c.windup;
        p.kneeBend = lerp(3,10,k);
        if(wType === 'fist'){
          /* 太极拳蓄力：双臂划弧后引，沉肘坐腕 */
          if(c.type === 'wardOff' || c.type === 'rollback'){
            p.upperArmAng = lerp(1.0, 1.9, k);
            p.foreArmAng = lerp(-1.1, -1.4, k);
            p.backUpperArmAng = lerp(1.5, 1.8, k);
            p.backForeArmAng = lerp(-1.5, -1.2, k);
            p.bodyLean = lerp(0.05, -0.08, k);
            p.legPose = lerp(0, 0.6, k);
          } else if(c.type === 'press' || c.type === 'push'){
            p.upperArmAng = lerp(1.0, 1.3, k);
            p.foreArmAng = lerp(-1.1, -1.6, k);
            p.backUpperArmAng = lerp(1.5, 1.2, k);
            p.backForeArmAng = lerp(-1.5, -1.5, k);
            p.bodyLean = lerp(0.05, -0.1, k);
            p.legPose = lerp(0, -0.3, k);
          } else {
            p.upperArmAng = lerp(1.0, 0.7 + Math.sin(k*Math.PI)*0.5, k);
            p.foreArmAng = lerp(-1.1, -1.3, k);
            p.backUpperArmAng = lerp(1.5, 2.0 - Math.sin(k*Math.PI)*0.5, k);
            p.backForeArmAng = lerp(-1.5, -1.0, k);
            p.bodyLean = lerp(0.05, Math.sin(k*Math.PI)*0.08, k);
            p.legPose = lerp(0, Math.sin(k*Math.PI*2)*0.4, k);
          }
        } else if(wType === 'sword' || wType === 'spear'){
          /* 剑/枪蓄力：手臂后引，肘部下沉，力从腰发 */
          p.upperArmAng = lerp(1.05, 2.0, k);
          p.foreArmAng = lerp(-1.1, -0.8, k);
          p.backUpperArmAng = lerp(1.5, 1.6, k);
          p.backForeArmAng = lerp(-1.5, -1.3, k);
          p.bodyLean = lerp(0.05, -0.12, k);
        } else if(wType === 'blade'){
          /* 刀蓄力：举刀过顶，腰身后仰 */
          p.upperArmAng = lerp(1.1, 0.4, k);
          p.foreArmAng = lerp(-1.15, -0.5, k);
          p.backUpperArmAng = lerp(1.45, 1.6, k);
          p.backForeArmAng = lerp(-1.4, -1.2, k);
          p.bodyLean = lerp(0.04, 0.1, k);
        }
      } else if(t < c.windup+c.strike){
        const k = (t-c.windup)/c.strike;
        p.kneeBend = 10;
        if(wType === 'fist'){
          /* 太极拳出击：力起于脚，发于腿，主宰于腰，形于手指 */
          if(c.type === 'wardOff'){
            p.upperArmAng = lerp(1.9, 0.4, easeOutQuad(k));
            p.foreArmAng = lerp(-1.4, -0.5, easeOutQuad(k));
            p.backUpperArmAng = lerp(1.8, 1.9, easeOutQuad(k));
            p.backForeArmAng = lerp(-1.2, -1.4, easeOutQuad(k));
            p.bodyLean = lerp(-0.08, 0.15, easeOutQuad(k));
            p.legPose = lerp(0.6, 1.0, easeOutQuad(k));
          } else if(c.type === 'rollback'){
            p.upperArmAng = lerp(1.9, 1.2, easeOutQuad(k));
            p.foreArmAng = lerp(-1.4, -1.0, easeOutQuad(k));
            p.backUpperArmAng = lerp(1.8, 1.5, easeOutQuad(k));
            p.backForeArmAng = lerp(-1.2, -1.3, easeOutQuad(k));
            p.bodyLean = lerp(-0.08, 0.1, easeOutQuad(k));
            p.legPose = lerp(0.6, 0.8, easeOutQuad(k));
          } else if(c.type === 'press'){
            p.upperArmAng = lerp(1.3, 0.3, easeOutQuad(k));
            p.foreArmAng = lerp(-1.6, -0.5, easeOutQuad(k));
            p.backUpperArmAng = lerp(1.2, 0.5, easeOutQuad(k));
            p.backForeArmAng = lerp(-1.5, -0.6, easeOutQuad(k));
            p.bodyLean = lerp(-0.1, 0.2, easeOutQuad(k));
            p.legPose = lerp(-0.3, 0.9, easeOutQuad(k));
          } else if(c.type === 'push'){
            p.upperArmAng = lerp(1.3, 0.5, easeOutQuad(k));
            p.foreArmAng = lerp(-1.6, -0.4, easeOutQuad(k));
            p.backUpperArmAng = lerp(1.2, 0.7, easeOutQuad(k));
            p.backForeArmAng = lerp(-1.5, -0.5, easeOutQuad(k));
            p.bodyLean = lerp(-0.1, 0.2, easeOutQuad(k));
            p.legPose = lerp(-0.3, 0.85, easeOutQuad(k));
          } else {
            p.upperArmAng = lerp(0.7, 0.1, easeOutQuad(k));
            p.foreArmAng = lerp(-1.3, -0.3, easeOutQuad(k));
            p.backUpperArmAng = lerp(2.0, 2.2, easeOutQuad(k));
            p.backForeArmAng = lerp(-1.0, -0.8, easeOutQuad(k));
            p.bodyLean = lerp(0.08, 0.25, easeOutQuad(k));
            p.legPose = lerp(0, 1.1, easeOutQuad(k));
          }
        } else if(wType === 'sword' || wType === 'spear'){
          /* 剑/枪刺出：手臂前伸，力达尖端 */
          p.upperArmAng = lerp(2.0, 0.3, easeOutQuad(k));
          p.foreArmAng = lerp(-0.8, -0.2, easeOutQuad(k));
          p.backUpperArmAng = lerp(1.6, 1.5, easeOutQuad(k));
          p.backForeArmAng = lerp(-1.3, -1.4, easeOutQuad(k));
          p.bodyLean = lerp(-0.12, 0.18, easeOutQuad(k));
        } else if(wType === 'blade'){
          /* 刀劈下：举高劈低，腰马合一 */
          p.upperArmAng = lerp(0.4, 1.5, easeOutQuad(k));
          p.foreArmAng = lerp(-0.5, -0.3, easeOutQuad(k));
          p.backUpperArmAng = lerp(1.6, 1.5, easeOutQuad(k));
          p.backForeArmAng = lerp(-1.2, -1.3, easeOutQuad(k));
          p.bodyLean = lerp(0.1, 0.22, easeOutQuad(k));
        }
      } else {
        const k = (t-c.windup-c.strike)/c.recover;
        /* 恢复阶段：回到格斗架势 */
        const recovUpper = wType==='sword'?1.05:wType==='blade'?1.1:wType==='spear'?0.95:1.0;
        const recovFore = wType==='sword'?-1.1:wType==='blade'?-1.15:wType==='spear'?-1.0:-1.1;
        const recovBackUpper = wType==='sword'?1.5:wType==='blade'?1.45:wType==='spear'?1.1:1.3;
        const recovBackFore = wType==='sword'?-1.5:wType==='blade'?-1.4:wType==='spear'?-1.15:-1.4;
        p.upperArmAng = lerp(p.upperArmAng,recovUpper,easeOutQuad(k));
        p.foreArmAng = lerp(p.foreArmAng,recovFore,easeOutQuad(k));
        p.backUpperArmAng = lerp(p.backUpperArmAng,recovBackUpper,easeOutQuad(k));
        p.backForeArmAng = lerp(p.backForeArmAng,recovBackFore,easeOutQuad(k));
        p.weaponAng = lerp(p.weaponAng,0,easeOutQuad(k));
        p.bodyLean = lerp(p.bodyLean,0.05,easeOutQuad(k));
        p.kneeBend = lerp(p.kneeBend,3,easeOutQuad(k));
        p.legPose = lerp(p.legPose,0,easeOutQuad(k));
      }
      if(p.landingT <= 0){
        if(p.action.weaponType === 'sword' || p.action.weaponType === 'spear'){
          if(c.type === 'thrust' && t > c.windup*0.5 && t < c.windup+c.strike+0.05) p.x += p.facing*650*dt;
        } else if(p.action.weaponType === 'blade' && c.type === 'chop'){
          if(t > c.windup && t < c.windup+c.strike) p.x += p.facing*350*dt;
        } else if(p.action.weaponType === 'fist'){
          if((c.type === 'push' || c.type === 'cloudHands') && t > c.windup && t < c.windup+c.strike) p.x += p.facing*(c.type==='cloudHands'?280:200)*dt;
        } else if(c.type === 'slam' && t > c.windup && t < c.windup+c.strike){
          p.x += p.facing*200*dt;
        }
      }
      if(!p.action.hitDone && t >= c.windup && t < c.windup+c.strike){
        p.action.hitDone = true;
        const w = WEAPONS[p.weaponIdx];
        if(RANGED_BASIC_WEAPONS[w.id]){
          /* 远程普攻：发射投射物，取代近身矩形判定 */
          fireBasicProjectile(p, c);
        } else {
          let hitCx = p.x + p.facing*(c.reach*0.6), hitCy = p.y, hitW = c.reach*1.1, hitH = 80;
          if(c.type === 'thrust'){ hitW = c.reach*1.3; hitH = 50; }
          if(c.type === 'slam'){ hitW = c.reach*1.2; hitH = 100; }
          if(c.type === 'cloudHands'){ hitW = c.reach*1.4; hitH = 110; }
          if(c.type === 'push' || c.type === 'press'){ hitW = c.reach*1.2; hitH = 90; }
          meleeHitRect(p, hitCx, hitCy, hitW, hitH, playerAtk()*c.dmg, {kb:c.kb, launch:c.launch});
        }
        /* ★ 普攻特效长度 = 实际命中前缘（命中矩形前缘 ≈ 0.6*reach + 0.5*判定宽），
           玩家一眼就能看出攻击够不够得着 */
        const extF = (c.type === 'thrust') ? 1.25 : (c.type === 'slam') ? 1.2
                   : (c.type === 'cloudHands') ? 1.3 : (c.type === 'push' || c.type === 'press') ? 1.2 : 1.15;
        const ext = extF * c.reach;
        if(w.id === 'sword'){
          const size = Math.max(0.6, (ext - 60) / 75);    /* slashArc 尖端恰好落在命中前缘 */
          if(c.type === 'thrust') addEffect('slashArc', p.x, p.y, 0.15, {facing:p.facing, color:'#9fe6ff', size, typeStr:'stab'});
          else if(c.type === 'upcut') addEffect('slashArc', p.x, p.y, 0.2, {facing:p.facing, color:'#9fe6ff', size, typeStr:'up'});
          else addEffect('slashArc', p.x, p.y, 0.2, {facing:p.facing, color:'#9fe6ff', size});
        } else if(w.id === 'blade'){
          const size = Math.max(0.7, (ext - 60) / 75);
          addEffect('slashArc', p.x, p.y, 0.3, {facing:p.facing, color:'#ff8a4a', size, typeStr:'blade'});
          if(c.type === 'slam') G.shake = Math.max(G.shake, 18);
        } else if(w.id === 'spear'){
          /* ★ 突刺光带直达命中前缘（原来没传 endX/endY，光带其实没画出来） */
          addEffect('spearLine', p.x, p.y - 55, 0.15, {facing:p.facing, color:'#ffd96a', endX:p.x + p.facing*ext, endY:p.y - 55, width:12});
        } else if(w.id === 'fist'){
          /* 太极拳气劲弧：半径随命中前缘走，弧形本身就是范围指示（粒子已精简） */
          const arcR = c.reach * ((c.type === 'cloudHands') ? 0.9 : ((c.type === 'push' || c.type === 'press') ? 0.8 : 0.75));
          const arcCx = p.x + p.facing*(c.reach*0.4);
          const arcCy = p.y - 50;
          addEffect('taiChiArc', arcCx, arcCy, 0.45, {facing:p.facing, color:'#ffcc33', radius:arcR, comboType:c.type});
          const particleCount = c.type === 'cloudHands' ? 16 : 10;
          for(let i=0;i<particleCount;i++){
            const angle = p.facing>0 ? (-Math.PI*0.4 + (i/particleCount)*Math.PI*0.8) : (Math.PI*0.6 + (i/particleCount)*Math.PI*0.8);
            const dist = arcR * (0.5 + Math.random()*0.5);
            const px = arcCx + Math.cos(angle)*dist;
            const py = arcCy + Math.sin(angle)*dist*0.6;
            setTimeout(()=>{
              if(!G || gameState!=='playing') return;
              spawnParticles(px, py, 2, {color: i%3===0?'#fff':i%3===1?'#ffcc33':'#ff9933', angle:angle+p.facing*0.5, spread:0.6, spMin:40, spMax:120, lifeMin:0.2, lifeMax:0.5, sizeMin:2, sizeMax:5, grav:200});
            }, i*8);
          }
          spawnParticles(arcCx, arcCy, 6, {color:'#ffcc33', angle:p.facing>0?0:Math.PI, spread:0.8, spMin:80, spMax:200, lifeMin:0.2, lifeMax:0.5, sizeMin:3, sizeMax:6, grav:100});
          if(c.type === 'cloudHands'){
            for(let i=0;i<12;i++){
              const a = i*(TAU/12);
              const r = arcR*0.7;
              spawnParticles(arcCx+Math.cos(a)*r, arcCy+Math.sin(a)*r*0.5, 3, {color:i%4===0?'#fff':i%4===1?'#ffcc33':i%4===2?'#ff9933':'#ffdd66', angle:a, spread:0.5, spMin:60, spMax:180, lifeMin:0.3, lifeMax:0.7, sizeMin:3, sizeMax:7, grav:0});
            }
            G.shake = Math.max(G.shake, 15);
          }
        } else if(w.id === 'herb'){
          /* ★ 炼药师：药囊挥出，绿色药屑与一小团毒雾 */
          const hx = p.x + p.facing * (c.reach * 0.55), hy = p.y - 52;
          addEffect('slashArc', hx, hy, 0.24, {facing:p.facing, color:'#7ed957', size:1.2});
          addEffect('poisonCloud', hx, hy + 12, 0.5, {color:'#7ed957', r:48});
          addEffect('hitRing', hx, hy, 0.28, {color:'#d8ff9a', r:44});
          for(let i = 0; i < 14; i++){
            const ang = p.facing > 0 ? (-0.6 + Math.random() * 1.2) : (Math.PI - 0.6 + Math.random() * 1.2);
            spawnParticles(hx, hy, 1, {color:i % 3 ? '#7ed957' : '#d8ff9a', angle:ang, spread:0.5,
              spMin:60, spMax:210, lifeMin:0.2, lifeMax:0.5, sizeMin:2, sizeMax:6, grav:220});
          }
        } else if(w.id === 'axe'){
          /* ★ 撼山者：斧气弧贴齐命中距离，碎石精简 */
          const size = Math.max(0.7, (ext - 60) / 75);
          addEffect('slashArc', p.x, p.y, 0.3, {facing:p.facing, color:'#ffb04a', size, typeStr:'blade'});
          const hx = p.x + p.facing * (c.reach * 0.55), hy = p.y - 54;
          addEffect('emberBurst', hx, hy, 0.36, {color:'#ffb04a', r:88, n:11, rot:rand(0, TAU)});
          addEffect('groundCrack', hx, p.y + 4, 0.5, {angle:p.facing > 0 ? 0 : Math.PI, color:'#ffb04a'});
          for(let i = 0; i < 10; i++){
            const ang = p.facing > 0 ? (-0.7 + Math.random() * 1.4) : (Math.PI - 0.7 + Math.random() * 1.4);
            spawnParticles(hx, hy, 1, {color:i % 4 === 0 ? '#c9a06a' : (i % 2 ? '#ffb04a' : '#ffd08a'), angle:ang, spread:0.6,
              spMin:100, spMax:300, lifeMin:0.2, lifeMax:0.5, sizeMin:2, sizeMax:7, grav:420});
          }
          G.shake = Math.max(G.shake, 12);
        } else if(w.id === 'talisman'){
          /* ★ 符咒师：符纸炸开，黄符碎片与电光 */
          const hx = p.x + p.facing * (c.reach * 0.55), hy = p.y - 54;
          addEffect('talisman', hx, hy, 0.42, {color:'#ffe066', n:2, r:22, rise:18});
          addEffect('hitRing', hx, hy, 0.3, {color:'#fff6b0', r:50});
          addEffect('lightning', hx, hy, 0.28, {color:'#fff6b0', scale:0.8, fromY:-90});
          for(let i = 0; i < 14; i++){
            const ang = p.facing > 0 ? (-0.6 + Math.random() * 1.2) : (Math.PI - 0.6 + Math.random() * 1.2);
            spawnParticles(hx, hy, 1, {color:i % 3 === 0 ? '#ffffff' : '#ffe066', angle:ang, spread:0.5,
              spMin:80, spMax:240, lifeMin:0.2, lifeMax:0.5, sizeMin:2, sizeMax:6, grav:160});
          }
        } else if(w.id === 'cauldron'){
          /* ★ 丹道师：鼎火喷发，火星与灰烬 */
          const hx = p.x + p.facing * (c.reach * 0.55), hy = p.y - 54;
          addEffect('groundFire', hx, p.y, 0.45, {color:'#ff7a4a'});
          addEffect('emberBurst', hx, hy, 0.4, {color:'#ff7a4a', r:96, n:13, rot:rand(0, TAU)});
          addEffect('hitRing', hx, hy, 0.3, {color:'#ffd08a', r:46});
          for(let i = 0; i < 16; i++){
            const ang = p.facing > 0 ? (-0.7 + Math.random() * 1.4) : (Math.PI - 0.7 + Math.random() * 1.4);
            spawnParticles(hx, hy, 1, {color:i % 3 === 0 ? '#fff6c8' : (i % 2 ? '#ff7a4a' : '#ffb04a'), angle:ang, spread:0.55,
              spMin:70, spMax:230, lifeMin:0.22, lifeMax:0.55, sizeMin:2, sizeMax:7, grav:-60});
          }
        }
        G.shake = Math.max(G.shake, c.dmg>1.5?10:5);
        G.hitstop = Math.max(G.hitstop, c.dmg>1.5?0.06:0.03);
      }
      /* 太极拳攻击过程中持续产生气劲粒子拖尾 */
      if(wType === 'fist' && t >= c.windup*0.3 && t < c.windup+c.strike){
        const handWorldX = p.x + p.facing*30;
        const handWorldY = p.y - 60;
        const trailPhase = (t - c.windup*0.3) / (c.strike + c.windup*0.7);
        /* 手部轨迹粒子 */
        if(Math.random() < 0.6){
          const arcAngle = p.facing>0 ? (-0.5+trailPhase*1.0) : (Math.PI+0.5-trailPhase*1.0);
          const arcR = c.reach * 0.5 * trailPhase;
          spawnParticles(handWorldX + Math.cos(arcAngle)*arcR, handWorldY + Math.sin(arcAngle)*arcR*0.5, 1, {color:Math.random()>0.5?'#ffcc33':'#ffe088', angle:arcAngle+Math.PI*0.5, spread:0.4, spMin:20, spMax:60, lifeMin:0.15, lifeMax:0.35, sizeMin:2, sizeMax:4, grav:100});
        }
      }
      /* ★ 新职业普攻：挥击过程中持续拖出本职业的专属光屑 */
      const TRAIL_COL = { herb:'#7ed957', axe:'#ffb04a', talisman:'#ffe066', cauldron:'#ff7a4a' };
      if(TRAIL_COL[wType] && t >= c.windup * 0.3 && t < c.windup + c.strike){
        if(Math.random() < 0.75){
          const tp = (t - c.windup * 0.3) / (c.strike + c.windup * 0.7);
          const ang = p.facing > 0 ? (-0.5 + tp * 1.0) : (Math.PI + 0.5 - tp * 1.0);
          const rr = c.reach * 0.5 * tp;
          spawnParticles(p.x + p.facing * 30 + Math.cos(ang) * rr, p.y - 60 + Math.sin(ang) * rr * 0.5, 1,
            {color:TRAIL_COL[wType], angle:ang + Math.PI * 0.5, spread:0.4, spMin:20, spMax:70,
             lifeMin:0.15, lifeMax:0.38, sizeMin:2, sizeMax:5, grav:100});
        }
      }
      const cancelTime = c.windup + c.strike;
      if(p.attackBuffer > 0 && t >= cancelTime && p.action.idx < 4){
        p.attackBuffer = 0; p.comboIdx = p.action.idx+1; p.action = null; tryPlayerAttack(p);
      } else if(t >= totalDur){
        p.action = null;
      }
    } else if(p.action.type === 'storm'){
      p.upperArmAng = 0; p.foreArmAng = 0; p.weaponAng = 0;
      if(p.action.t >= p.action.dur) p.action = null;
    } else if(p.action.type === 'cast'){
      /* ★ 新职业技能的通用施法姿态：到时间自动收招 */
      p.kneeBend = 6;
      if(p.action.t >= p.action.dur) p.action = null;
    } else if(p.action.type === 'bladeDash'){
      if(p.action.t >= p.action.dur) p.action = null;
    } else if(p.action.type === 'fistCharge'){
      const ck = clamp(p.action.t/p.action.dur, 0, 1);
      p.upperArmAng = lerp(1.0,2.0,ck);
      p.foreArmAng = lerp(-1.1,-1.5,ck);
      p.backUpperArmAng = lerp(1.5,1.7,ck);
      p.backForeArmAng = lerp(-1.5,-1.2,ck);
      p.weaponAng = 0;
      p.bodyLean = lerp(0.05,-0.12,ck);
      p.kneeBend = lerp(3,10,ck);
      if(p.action.t >= p.action.dur) p.action = null;
    } else if(p.action.type === 'fistMeditate'){
      const mk = clamp(p.action.t/p.action.dur, 0, 1);
      p.upperArmAng = lerp(1.0,1.6,mk);
      p.foreArmAng = lerp(-1.1,-1.2,mk);
      p.backUpperArmAng = lerp(1.5,1.6,mk);
      p.backForeArmAng = lerp(-1.5,-1.3,mk);
      p.weaponAng = 0;
      p.bodyLean = 0.03;
      p.kneeBend = lerp(3,12,mk);
      if(mk > 0.5) p.kneeBend = 12-(mk-0.5)*10;
      if(p.action.t >= p.action.dur) p.action = null;
    } else if(p.action.type === 'swordCharge'){
      /* 剑系蓄力：剑举于身前，蓄力待发 */
      const sk = clamp(p.action.t/p.action.dur, 0, 1);
      p.upperArmAng = lerp(1.05, 0.6, sk);
      p.foreArmAng = lerp(-1.1, -0.8, sk);
      p.backUpperArmAng = lerp(1.5, 1.6, sk);
      p.backForeArmAng = lerp(-1.5, -1.3, sk);
      p.weaponAng = 0;
      p.bodyLean = lerp(0.05, -0.08, sk);
      p.kneeBend = lerp(3, 8, sk);
      if(p.action.t >= p.action.dur) p.action = null;
    } else if(p.action.type === 'bladeCharge'){
      /* 刀系蓄力：刀举过顶 */
      const bk = clamp(p.action.t/p.action.dur, 0, 1);
      p.upperArmAng = lerp(1.1, 0.5, bk);
      p.foreArmAng = lerp(-1.15, -0.6, bk);
      p.backUpperArmAng = lerp(1.45, 1.6, bk);
      p.backForeArmAng = lerp(-1.4, -1.2, bk);
      p.weaponAng = 0;
      p.bodyLean = lerp(0.04, 0.1, bk);
      p.kneeBend = lerp(3, 10, bk);
      if(p.action.t >= p.action.dur) p.action = null;
    } else if(p.action.type === 'spearCharge' || p.action.type === 'spearThrust'){
      /* 枪系蓄力：枪身后拉，力从腰发 */
      const spk = clamp(p.action.t/p.action.dur, 0, 1);
      p.upperArmAng = lerp(0.95, 1.6, spk);
      p.foreArmAng = lerp(-1.0, -0.8, spk);
      p.backUpperArmAng = lerp(1.1, 1.3, spk);
      p.backForeArmAng = lerp(-1.15, -1.0, spk);
      p.weaponAng = 0;
      p.bodyLean = lerp(0.08, 0.15, spk);
      p.kneeBend = lerp(3, 6, spk);
      if(p.action.t >= p.action.dur) p.action = null;
    }
  } else {
    /* ★ 修复：待机姿态 - 真人格斗站姿，双手护于胸前，加入呼吸动画 */
    const idleBreathe = Math.sin(G.t * 2.2) * 0.03;
    const idleBreatheLean = Math.sin(G.t * 2.2) * 0.01;
    const wType = WEAPONS[p.weaponIdx].id;
    /* 格斗站姿：上臂前伸约45°，前臂弯曲约90°，双手抬至胸口高度 */
    let idleUpper = 1.15 + idleBreathe, idleFore = -1.25, idleWeapon = 0, idleLean = 0.05;
    let idleBackUpper = 1.35, idleBackFore = -1.35;
    if(wType === 'sword'){
      /* 剑客：侧身持剑，前手伸剑，后手护于胸前 */
      idleUpper = 1.05 + idleBreathe; idleFore = -1.1; idleLean = 0.06;
      idleBackUpper = 1.5; idleBackFore = -1.5;
    } else if(wType === 'blade'){
      /* 刀客：刀持于体侧，微微后仰 */
      idleUpper = 1.1 + idleBreathe; idleFore = -1.15; idleLean = 0.04;
      idleBackUpper = 1.45; idleBackFore = -1.4;
    } else if(wType === 'spear'){
      /* 枪手持枪前伸，双手握枪 */
      idleUpper = 0.95 + idleBreathe; idleFore = -1.0; idleLean = 0.08;
      idleBackUpper = 1.1; idleBackFore = -1.15;
    } else if(wType === 'fist'){
      /* 拳师：双拳抱于胸前，沉肩坠肘 */
      idleUpper = 1.0 + idleBreathe; idleFore = -1.4; idleLean = 0.03;
      idleBackUpper = 1.3; idleBackFore = -1.45;
    }
    p.upperArmAng = lerp(p.upperArmAng, idleUpper, Math.min(1, dt*10));
    p.foreArmAng = lerp(p.foreArmAng, idleFore, Math.min(1, dt*10));
    p.backUpperArmAng = lerp(p.backUpperArmAng, idleBackUpper, Math.min(1, dt*10));
    p.backForeArmAng = lerp(p.backForeArmAng, idleBackFore, Math.min(1, dt*10));
    p.weaponAng = lerp(p.weaponAng, idleWeapon, Math.min(1, dt*10));
    p.bodyLean = lerp(p.bodyLean, idleLean + idleBreatheLean, Math.min(1, dt*10));
    p.kneeBend = lerp(p.kneeBend, wType==='fist'?5:3, Math.min(1, dt*10));
    p.legPose = lerp(p.legPose, 0, Math.min(1, dt*10));
  }
}

function handleInput(){
  /* ★ 剧情对话优先：对话进行中，确认键/空格只用于翻页，不触发战斗操作 */
  if(DIALOGUE){
    if(pressed['Space'] || pressed['KeyJ'] || pressed['Enter'] || pressed['Escape'] || pressed['KeyK']){
      advanceDialogue();
      for(const k in pressed) delete pressed[k];
    }
    return;
  }
  if(gameState === 'menu'){
    if(pressed['KeyW'] || pressed['ArrowUp']) menuSelection = (menuSelection+2)%3;
    if(pressed['KeyS'] || pressed['ArrowDown']) menuSelection = (menuSelection+1)%3;
    if(pressed['Space'] || pressed['KeyJ'] || pressed['Enter']){
      if(menuSelection === 1){
        /* 双人PK：直接进入武器选择（1级平衡） */
        gameState = 'pvpSelect';
        pvpState = 'select1'; pvpSelect = [0,0]; pvpWinner = -1;
        pvpFromMenu = true;
      } else {
        /* 单人冒险 / 开始：进入职业选择 */
        charSelectState.phase = 'single';
        charSelectState.step = 0;
        charSelectState.selections = [0, 0];
        gameState = 'charSelect';
      }
    }
    for(const k in pressed) delete pressed[k]; return;
  }
  if(gameState === 'charSelect'){
    const step = charSelectState.step;
    const N = CHARACTERS.length, COLS = 4;
    let sel = charSelectState.selections[step];
    if(pressed['KeyA'] || pressed['ArrowLeft']) sel = (sel + N - 1) % N;
    if(pressed['KeyD'] || pressed['ArrowRight']) sel = (sel + 1) % N;
    if(pressed['KeyW'] || pressed['ArrowUp']) sel = (sel - COLS + N) % N;
    if(pressed['KeyS'] || pressed['ArrowDown']) sel = (sel + COLS) % N;
    charSelectState.selections[step] = sel;
    if(pressed['Space'] || pressed['KeyJ'] || pressed['Enter']){
      if(charSelectState.phase==='single'){
        startSingleWithChar(charSelectState.selections[0]);
      } else {
        /* PvP双人：玩家1选完，玩家2选 */
        if(charSelectState.step===0){
          charSelectState.step = 1;
        } else {
          startPvpWithChar(charSelectState.selections[0], charSelectState.selections[1]);
        }
      }
    }
    if(pressed['Escape'] || pressed['Backspace']){
      if(charSelectState.phase==='pvp' && charSelectState.step===1){
        charSelectState.step = 0;
      } else {
        gameState = 'menu';
      }
    }
    for(const k in pressed) delete pressed[k]; return;
  }
  if(gameState === 'pvpSelect'){
    const NW = WEAPONS.length;
    if(pvpState === 'select1'){
      if(pressed['KeyA'] || pressed['ArrowLeft']) pvpSelect[0] = (pvpSelect[0]+NW-1)%NW;
      if(pressed['KeyD'] || pressed['ArrowRight']) pvpSelect[0] = (pvpSelect[0]+1)%NW;
      if(pressed['KeyW'] || pressed['ArrowUp']) pvpSelect[0] = (pvpSelect[0]+NW-4)%NW;
      if(pressed['KeyS'] || pressed['ArrowDown']) pvpSelect[0] = (pvpSelect[0]+4)%NW;
      if(pressed['Space'] || pressed['KeyJ']) pvpState = 'select2';
    } else {
      if(pressed['ArrowLeft']) pvpSelect[1] = (pvpSelect[1]+NW-1)%NW;
      if(pressed['ArrowRight']) pvpSelect[1] = (pvpSelect[1]+1)%NW;
      if(pressed['ArrowUp']) pvpSelect[1] = (pvpSelect[1]+NW-4)%NW;
      if(pressed['ArrowDown']) pvpSelect[1] = (pvpSelect[1]+4)%NW;
      if(pressed['Enter'] || pressed['NumpadEnter'] || pressed['Numpad1']) startPvpFight();
    }
    for(const k in pressed) delete pressed[k]; return;
  }
  if(gameState === 'pvpEnd'){
    if(pressed['Space'] || pressed['Enter']){
      if(!pvpFromMenu){
        restoreSingleGIfNeeded();
        if(G && G.player) G.player.hp = G.player.maxHp;
        gameState = 'town';
        if(window.showTouchControls) window.showTouchControls(false);
      } else {
        gameState = 'menu';
        stopBGM();
        if(window.hideTouchControls) window.hideTouchControls();
      }
    }
    for(const k in pressed) delete pressed[k]; return;
  }
  if(!G || !G.player) return;
  const p = G.player;
  /* ★ 主线任务面板：Q / Tab 开关 */
  if(gameState === 'questMenu'){
    if(pressed['KeyQ'] || pressed['Escape'] || pressed['Tab'] || pressed['Space']){
      gameState = questReturnState || 'town';
    }
    for(const k in pressed) delete pressed[k]; return;
  }
  if((pressed['KeyQ'] || pressed['Tab']) && !G.isPvp && (gameState === 'town' || gameState === 'playing')){
    questReturnState = gameState;
    gameState = 'questMenu';
    for(const k in pressed) delete pressed[k]; return;
  }
  /* ★ 药水快捷键：H 喝血瓶，G 喝蓝瓶（城镇 / 战斗都能用） */
  if(pressed['KeyH'] && typeof drinkPotion === 'function'){ drinkPotion('hp'); delete pressed['KeyH']; }
  if(pressed['KeyG'] && typeof drinkPotion === 'function'){ drinkPotion('mp'); delete pressed['KeyG']; }
  if(pressed['KeyJ']) tryPlayerAttack(p);
  if(pressed['Digit1']) tryUseSkill(p, 0);
  if(pressed['Digit2']) tryUseSkill(p, 1);
  if(pressed['Digit3']) tryUseSkill(p, 2);
  if(pressed['Digit4']) tryUseSkill(p, 3);
  if(pressed['Digit5']) tryUseSkill(p, 4);
  if(pressed['Digit6']) tryUseSkill(p, 5);
  /* 御剑飞行已移除 */
  if(G.isPvp && G.player2 && !G.player2.dead){
    const p2 = G.player2;
    if(pressed['Numpad1'] || pressed['Period']) tryPlayerAttack(p2);
    if(pressed['Numpad4'] || pressed['Comma']) tryUseSkill(p2, 0);
    if(pressed['Numpad5'] || pressed['Slash']) tryUseSkill(p2, 1);
    if(pressed['Numpad6']) tryUseSkill(p2, 2);
    if(pressed['Numpad7']) tryUseSkill(p2, 3);
    if(pressed['Numpad8']) tryUseSkill(p2, 4);
    if(pressed['Numpad9']) tryUseSkill(p2, 5);
  }
  for(const k in pressed) delete pressed[k];
}

/* ===== 波次 ===== */
function startWave(){
  if(!G || G.isPvp) return;
  const lvlIdx = G.levelIdx || 0;
  const lvl = getLevelConfig(lvlIdx);
  const waveIdx = G.waveIdx || 0;
  /* ★ 波数由关卡配置决定：0..bossWaveIdx-1 是小怪房，bossWaveIdx 是 BOSS 房 */
  const bossWaveIdx = (lvl.bossWaveIdx != null) ? lvl.bossWaveIdx : Math.max(3, (lvl.waveCount || 4) - 1);
  const hpMul = lvl.enemyHpMul || (1.0 + lvlIdx * 0.18);
  const atkMul = lvl.enemyAtkMul || (1.0 + lvlIdx * 0.12);
  const spdMul = lvl.enemySpdMul || 1.0;
  G.currentHpMul = hpMul; G.currentAtkMul = atkMul; G.currentSpdMul = spdMul;
  G.currentLvlCfg = lvl;                 /* ★ 供 spawnWaveEnemies 读取每波增量 */
  G.roomTotal = bossWaveIdx + 1;
  preloadLevelMonsters(lvl);   /* ★ 本关所有怪兽贴图预载 */
  G.waveState = 'intro'; G.waveTimer = 1.8;
  G.roomIdx = waveIdx;
  G.portal = null;
  /* 进入新房间：回到房间左侧入口 */
  if(waveIdx > 0 && G.player){
    G.player.x = WORLD_L + 140;
    G.player.h = 0; G.player.vy = 0; G.player.kx = 0;
    G.player.y = 600;
    if(G.camera) G.camera.x = 0;
  }
  if(waveIdx < bossWaveIdx){
    /* 小怪房：波次超出模板长度时循环取用，靠 extraPerWave 继续加码 */
    const srcIdx = waveIdx % lvl.waves.length;
    G.currentWave = lvl.waves[srcIdx] || lvl.waves[0];
    G.currentIsBoss = false;
    G.bannerText = `第 ${waveIdx+1}/${bossWaveIdx} 房间 · 清空后前往右侧传送门`;
    G.bannerTimer = 2.2;
  } else {
    /* Boss波 */
    G.currentWave = [lvl.boss];
    G.currentIsBoss = true;
    G.currentBossName = lvl.bossName;
    G.currentBossHpMul = lvl.bossHpMul;
    G.currentBossAtkMul = lvl.bossAtkMul;
    G.currentBossScaleMul = lvl.bossScaleMul;
    G.bannerText = `${lvl.name} — BOSS: ${lvl.bossName}`;
    G.bannerTimer = 2.5;
  }
}
