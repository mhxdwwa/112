
let lastTime = performance.now();
function loop(now){
  /* ★ 单帧异常不能掐断整条动画链，否则游戏会彻底卡死 */
  try{ loopBody(now); }
  catch(err){
    window.__loopErrCount = (window.__loopErrCount || 0) + 1;
    if(window.__loopErrCount <= 5) console.error('[loop] 帧异常已拦截：', err);
    if(window.__loopErrCount > 900) return;   /* 连续崩 900 帧才真正停下，避免无意义刷屏 */
    requestAnimationFrame(loop);
  }
}
function loopBody(now){
  if(window.__dbgFreeze){ requestAnimationFrame(loop); return; }
  const dt = Math.min((now-lastTime)/1000, 0.05);
  lastTime = now;
  if((gameState === 'playing' || gameState === 'stageClear') && !(typeof G !== 'undefined' && G && G.awaitRevive)) update(dt);
  if(gameState === 'town') updateTown(dt);
  /* ★ 剧情对话与任务进度推进（任何状态下都保持生命） */
  updateDialogue(dt);
  updateQuestToast(dt);
  updateDropAnnounce(dt);
  if(pausedSafe()) updateQuests(dt);
  /* ★ 每帧重置为高清变换（逻辑坐标 1280×720 不变） */
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.clearRect(0,0,VW,VH);

  if(gameState === 'menu'){ drawMenu(); handleInput(); requestAnimationFrame(loop); return; }
  if(gameState === 'charSelect'){ drawCharSelect(); handleInput(); requestAnimationFrame(loop); return; }
  if(gameState === 'nameInput'){ drawNameInput(); handleInput(); requestAnimationFrame(loop); return; }
  if(gameState === 'pvpSelect'){ drawPvpSelect(); handleInput(); requestAnimationFrame(loop); return; }
  if(gameState === 'town'){ drawTown(); drawQuestToast(); drawDialogue(); handleInput(); requestAnimationFrame(loop); return; }
  if(gameState === 'dungeonSelect'){ drawDungeonSelect(); handleInput(); requestAnimationFrame(loop); return; }
  if(gameState === 'levelSelect'){ drawLevelSelect(); handleInput(); requestAnimationFrame(loop); return; }
  if(gameState === 'shopMenu'){ drawTown(); drawShop(); drawEquipTooltip(); handleInput(); requestAnimationFrame(loop); return; }
  if(gameState === 'enhanceMenu'){ drawTown(); drawEnhanceOverlay(); drawEquipTooltip(); handleInput(); requestAnimationFrame(loop); return; }
  if(gameState === 'characterInfo'){ drawTown(); drawCharacterInfo(); handleInput(); requestAnimationFrame(loop); return; }
  if(gameState === 'inventory'){ drawTown(); drawInventory(); drawEquipTooltip(); handleInput(); requestAnimationFrame(loop); return; }
  if(gameState === 'skillMenu'){ drawTown(); drawSkillMenu(); handleInput(); requestAnimationFrame(loop); return; }
  /* ★ ESC 系统菜单 + 装备图鉴 */
  if(gameState === 'gameMenu'){ drawTown(); drawGameMenu(); handleInput(); requestAnimationFrame(loop); return; }
  if(gameState === 'equipWiki'){ drawTown(); drawEquipWiki(); handleInput(); requestAnimationFrame(loop); return; }
  /* ★ 主线任务面板 */
  if(gameState === 'questMenu'){ drawQuestMenu(); handleInput(); drawQuestToast(); drawDialogue(); requestAnimationFrame(loop); return; }
  if(gameState === 'stageClear'){
    // 先绘制游戏世界（角色和地图可见）
    ctx.save();
    drawSky(); drawFarScenery(); drawGround();
    if(G){
      const camX = G.camera ? G.camera.x : 0;
      ctx.save(); ctx.translate(-camX, 0);
      /* ★ 通关结算：地面掉落物照常画（下面结算面板上还会再画一层） */
      drawGroundDrops();
      if(G.player && !G.player.dead){
        const sw = Math.max(5, 35-G.player.h*0.1);
        drawShadow(G.player.x, G.player.y, sw, Math.max(0, 0.4-G.player.h*0.001));
      }
      const drawables = [];
      if(G.player && !G.player.dead){
        const playerPal = getPlayerPalette(G.player);
        const p1UseSprite = !!atlasOf(G.player.weaponIdx);
        drawables.push({ y:G.player.y, fn: p1UseSprite ? ()=>drawFighterSprite(G.player, 1.1) : ()=>drawFighter({ x:G.player.x, y:G.player.y, h:G.player.h, facing:G.player.facing, scale:1.1, pose:G.player.state, upperArmAng:G.player.upperArmAng, foreArmAng:G.player.foreArmAng, backUpperArmAng:G.player.backUpperArmAng, backForeArmAng:G.player.backForeArmAng, weaponAng:G.player.weaponAng, bodyLean:G.player.bodyLean, kneeBend:G.player.kneeBend, legPose:G.player.legPose, weapon:WEAPONS[G.player.weaponIdx].id, walkPhase:G.player.walkPhase, pal:playerPal })});
      }
      drawables.sort((a,b)=>a.y-b.y);
      for(const d of drawables) d.fn();
      ctx.restore();
    }
    ctx.restore();
    // 再绘制半透明结算界面
    drawStageClear();

    /* ★ 掉落物再画一层，盖在半透明结算面板之上 —— 通关后地上装备/金币/材料看得见
       走过去 dist<48 自动拾取（21_combat.js 结算分支已放开） */
    if(G && G.drops && G.drops.length > 0 && !G.isPvp){
      ctx.save();
      ctx.translate(-((G.camera) ? G.camera.x : 0), 0);
      drawGroundDrops();
      ctx.restore();
    }
    /* ★ 结算界面也要画飘字：不然「地面有装备未拾取」「获得装备」这类提示全被吃掉 */
    drawTexts();
    handleInput();
    requestAnimationFrame(loop);
    return;
  }
  /* ★ 改进7: 暂停状态 */
  if(gameState === 'paused'){
    // 绘制游戏画面（冻结）
    ctx.save();
    drawSky(); drawFarScenery(); drawGround();
    if(G){
      if(G.player && !G.player.dead){
        const sw = Math.max(5, 35-G.player.h*0.1);
        drawShadow(G.player.x, G.player.y, sw, Math.max(0, 0.4-G.player.h*0.001));
      }
      const drawables = [];
      if(G.player && !G.player.dead){
        const playerPal = getPlayerPalette(G.player);
        const p1UseSprite = !!atlasOf(G.player.weaponIdx);
        drawables.push({ y:G.player.y, fn: p1UseSprite ? ()=>drawFighterSprite(G.player, 1.1) : ()=>drawFighter({ x:G.player.x, y:G.player.y, h:G.player.h, facing:G.player.facing, scale:1.1, pose:G.player.state, upperArmAng:G.player.upperArmAng, foreArmAng:G.player.foreArmAng, backUpperArmAng:G.player.backUpperArmAng, backForeArmAng:G.player.backForeArmAng, weaponAng:G.player.weaponAng, bodyLean:G.player.bodyLean, kneeBend:G.player.kneeBend, legPose:G.player.legPose, weapon:WEAPONS[G.player.weaponIdx].id, walkPhase:G.player.walkPhase, pal:playerPal })});
      }
      drawables.sort((a,b)=>a.y-b.y);
      for(const d of drawables) d.fn();
      drawEntityHealthBars();
      if(G.player) drawUI();
      drawBottomUI();
    }
    ctx.restore();
    // 绘制暂停遮罩
    drawPauseMenu();
    handleInput(); requestAnimationFrame(loop); return;
  }
  if(gameState === 'pvpEnd'){
    drawSky(); drawFarScenery(); drawGround();
    drawPvpEnd(); handleInput(); requestAnimationFrame(loop); return;
  }

  ctx.save();
  if(G && G.shake > 0.2) ctx.translate((Math.random()-0.5)*G.shake, (Math.random()-0.5)*G.shake);
  drawSky(); drawFarScenery(); drawGround();
  const camX = (G && G.camera) ? G.camera.x : 0;
  ctx.save(); ctx.translate(-camX, 0);

  if(G){
    if(G.player && !G.player.dead){
      const sw = Math.max(5, 35-G.player.h*0.1);
      drawShadow(G.player.x, G.player.y, sw, Math.max(0, 0.4-G.player.h*0.001));
    }
    if(G.isPvp && G.player2 && !G.player2.dead){
      const sw = Math.max(5, 35-G.player2.h*0.1);
      drawShadow(G.player2.x, G.player2.y, sw, Math.max(0, 0.4-G.player2.h*0.001));
    }
    for(const e of G.enemies) if(e.alive || e.deathT<0.5) drawShadow(e.x, e.y, 30*e.scale, 0.3);
    /* ★ 房间传送门 */
    drawRoomPortal();

    drawGroundDrops();

    const drawables = [];
    if(G.player && !G.player.dead){
      const playerPal = getPlayerPalette(G.player);
      const p1UseSprite = !!atlasOf(G.player.weaponIdx);
      drawables.push({ y:G.player.y, fn: p1UseSprite ? ()=>drawFighterSprite(G.player, 1.1) : ()=>drawFighter({ x:G.player.x, y:G.player.y, h:G.player.h, facing:G.player.facing, scale:1.1, pose:G.player.state, upperArmAng:G.player.upperArmAng, foreArmAng:G.player.foreArmAng, backUpperArmAng:G.player.backUpperArmAng, backForeArmAng:G.player.backForeArmAng, weaponAng:G.player.weaponAng, bodyLean:G.player.bodyLean, kneeBend:G.player.kneeBend, legPose:G.player.legPose, weapon:WEAPONS[G.player.weaponIdx].id, walkPhase:G.player.walkPhase, pal:playerPal })});
    }
    if(G.isPvp && G.player2 && !G.player2.dead){
      const player2Pal = getPlayerPalette(G.player2);
      const p2UseSprite = !!atlasOf(G.player2.weaponIdx);
      drawables.push({ y:G.player2.y, fn: p2UseSprite ? ()=>drawFighterSprite(G.player2, 1.1) : ()=>drawFighter({ x:G.player2.x, y:G.player2.y, h:G.player2.h, facing:G.player2.facing, scale:1.1, pose:G.player2.state, upperArmAng:G.player2.upperArmAng, foreArmAng:G.player2.foreArmAng, backUpperArmAng:G.player2.backUpperArmAng, backForeArmAng:G.player2.backForeArmAng, weaponAng:G.player2.weaponAng, bodyLean:G.player2.bodyLean, kneeBend:G.player2.kneeBend, legPose:G.player2.legPose, weapon:WEAPONS[G.player2.weaponIdx].id, walkPhase:G.player2.walkPhase, pal:player2Pal })});
    }
    for(const e of G.enemies){
      /* ★ 修复：敌人姿态根据状态动态计算，不再使用固定角度 */
      const ePose = e.action ? 'attack' : (e.hurtT > 0 ? 'hurt' : 'idle');
      let eUpperArm = 1.1, eForeArm = -1.1, eWeaponAng = 0, eBodyLean = 0.05, eKneeBend = 3;
      const breathe = Math.sin(G.t * 2.5 + e.walkPhase * 0.1) * 0.04;
      const breatheBob = Math.sin(G.t * 2.5 + e.walkPhase * 0.1) * 1.5;
      if(ePose === 'attack'){
        /* 攻击姿态：手臂前伸，武器水平指向目标 */
        eUpperArm = 0.3; eForeArm = -0.2; eWeaponAng = 0; eBodyLean = 0.15; eKneeBend = 6;
      } else if(ePose === 'hurt'){
        /* 受击姿态：身体后仰，手臂张开 */
        eUpperArm = 2.0; eForeArm = -0.5; eWeaponAng = 0; eBodyLean = -0.15; eKneeBend = 4;
      } else {
        /* 待机姿态：格斗架势，武器水平，根据武器类型微调 */
        const wType = e.def.weapon;
        if(wType === 'blade'){
          eUpperArm = 1.1 + breathe; eForeArm = -1.15; eBodyLean = 0.04 + breathe * 0.3;
        } else if(wType === 'spear'){
          eUpperArm = 0.95 + breathe; eForeArm = -1.0; eBodyLean = 0.08 + breathe * 0.3;
        } else if(wType === 'sword'){
          eUpperArm = 1.05 + breathe; eForeArm = -1.1; eBodyLean = 0.06 + breathe * 0.3;
        } else if(wType === 'fist'){
          eUpperArm = 1.0 + breathe; eForeArm = -1.4; eBodyLean = 0.03 + breathe * 0.3; eKneeBend = 5;
        } else if(wType === 'axe'){
          eUpperArm = 1.15 + breathe; eForeArm = -1.1; eBodyLean = 0.04 + breathe * 0.3;
        } else if(wType === 'dual'){
          eUpperArm = 1.05 + breathe; eForeArm = -1.1; eBodyLean = 0.05 + breathe * 0.3; eKneeBend = 3;
        } else {
          eUpperArm = 1.1 + breathe; eForeArm = -1.1; eBodyLean = 0.05 + breathe * 0.3;
        }
      }
      const _mat = monsterAtlasOf(e.typeKey);
      if(_mat && _mat.ready){
        drawables.push({ y:e.y, fn:()=>drawMonsterSprite(e) });
      } else {
        drawables.push({ y:e.y, fn:()=>drawFighter({ x:e.x, y:e.y - breatheBob, h:e.h, facing:e.facing, scale:e.def.scale, pose:ePose, upperArmAng:eUpperArm, foreArmAng:eForeArm, backUpperArmAng:eUpperArm - 0.15, backForeArmAng:eForeArm - 0.1, weaponAng:eWeaponAng, bodyLean:eBodyLean, kneeBend:eKneeBend, legPose:0, weapon:e.def.weapon, walkPhase:e.walkPhase, pal:e.def.pal })});
      }
    }
    /* ★ 组队刷图：副本里同样把队友画出来（按 y 排序，和怪互相遮挡） */
    if(window.ONLINE && window.ONLINE.collectDrawables) window.ONLINE.collectDrawables(drawables);
    drawables.sort((a,b)=>a.y-b.y);
    for(const d of drawables) d.fn();

    for(const pr of G.projectiles) drawProjectile(pr);

    /* 粒子不再用「加法发光」叠加：以前一屏几十上百个发光点叠在一起会爆白，
       既刺眼又极耗填充率（低端机放技能就掉帧）。
       改成普通混合后画面像飞溅的碎屑 / 剑气残渣，层次还在，但不炸眼。 */
    for(const pt of G.particles){
      ctx.globalAlpha = (pt.life/pt.maxLife) * 0.85;
      ctx.fillStyle = pt.color;
      ctx.beginPath(); ctx.arc(pt.x, pt.y-pt.h, pt.size*(pt.life/pt.maxLife+0.5), 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;

    drawEffects(dt);
    drawEntityHealthBars();
    /* ★ 改进9: 技能蓄力进度圈 */
    drawSkillChargeIndicator();
    drawTexts();

    ctx.restore();
    if(G.player) drawUI();
    /* ★ 组队刷图：左上角小队面板（名字 + 血条） */
    if(window.ONLINE && window.ONLINE.drawTeamHud) window.ONLINE.drawTeamHud();
    drawBottomUI();
    /* ★ 背包容量警告（战斗中也要显示） */
    if(typeof drawBagWarning === 'function') drawBagWarning();
    drawRoomMinimap();
    if(G.flash > 0.01){ ctx.fillStyle = G.hitFlashColor; ctx.globalAlpha = G.flash; ctx.fillRect(0,0,VW,VH); ctx.globalAlpha = 1; }
    /* ★ 房间转场黑幕 */
    if(G.roomFade > 0){
      ctx.fillStyle = 'rgba(0,0,0,' + (G.roomFade * 0.95).toFixed(3) + ')';
      ctx.fillRect(0, 0, VW, VH);
    }
  }
  ctx.restore();

  if(gameState === 'gameover'){
    ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(0,0,VW,VH);
    ctx.fillStyle = '#ff5a4a'; ctx.textAlign = 'center'; ctx.font = 'bold 60px "Microsoft YaHei"';
    ctx.fillText('侠途止步', VW/2, VH/2-60);
    const btnY = VH/2+30, btnW = 220, btnH = 55, btnX = VW/2-btnW/2;
    ctx.fillStyle = 'rgba(60,120,200,0.5)';
    ctx.beginPath(); ctx.roundRect(btnX,btnY,btnW,btnH,12); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 24px "Microsoft YaHei"';
    ctx.fillText('返回主菜单', VW/2, btnY+35);
    gameoverClickRegions = [{id:'back', x:btnX, y:btnY, w:btnW, h:btnH}];
    if(pressed['Space']){ gameState = 'menu'; stopBGM(); if(window.hideTouchControls) window.hideTouchControls(); delete pressed['Space']; }
  }

  if(gameState === 'win'){
    ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillRect(0,0,VW,VH);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd700'; ctx.font = 'bold 64px "Microsoft YaHei"';
    ctx.fillText('通关！', VW/2, VH/2-100);
    ctx.fillStyle = '#ffe066'; ctx.font = 'bold 32px "Microsoft YaHei"';
    ctx.fillText('七关全部通过，天下太平！', VW/2, VH/2-45);
    ctx.fillStyle = '#ccc'; ctx.font = '22px "Microsoft YaHei"';
    ctx.fillText(`总击杀: ${G?G.totalKills:0}`, VW/2, VH/2);
    const btnY = VH/2+60, btnW = 220, btnH = 55, btnX = VW/2-btnW/2;
    ctx.fillStyle = 'rgba(60,180,120,0.5)';
    ctx.beginPath(); ctx.roundRect(btnX,btnY,btnW,btnH,12); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 24px "Microsoft YaHei"';
    ctx.fillText('返回主菜单', VW/2, btnY+35);
    gameoverClickRegions = [{id:'back', x:btnX, y:btnY, w:btnW, h:btnH}];
    if(pressed['Space']){ gameState = 'menu'; stopBGM(); if(window.hideTouchControls) window.hideTouchControls(); delete pressed['Space']; }
  }

  /* ★ 剧情对话覆盖在最上层 */
  drawDropAnnounce();
  drawQuestToast();
  drawDialogue();
  handleInput();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);



/* ============================================================
   ★ 地面掉落物绘制（抽成函数：战斗中和「通关结算」界面都要画，
     结算界面里还要再画一次盖在半透明结算面板之上，保证看得见）
   ============================================================ */
function drawGroundDrops(){
  if(!G || !G.drops || G.drops.length === 0 || G.isPvp) return;
    const p0 = (G && G.player) ? G.player : null;
    if(G.drops && G.drops.length > 0 && !G.isPvp){
      for(const d of G.drops){
        const bobY = Math.sin(d.bobPhase) * 5;
        const drawX = d.x, drawY = d.y - 20 + bobY;
        /* ★ 吸附拖尾：从掉落物朝玩家方向拉出渐隐光带 */
        if(d.magnet && p0){
          const tdx = p0.x - d.x, tdy = (p0.y - 46) - d.y;
          const tl = Math.hypot(tdx, tdy) || 1;
          const tcolHex = d.type === 'gold' ? '#ffd750'
                        : (d.type === 'equip' ? (d.equip.tierColor || '#ffffff')
                        : (d.type === 'material' ? '#96c8ff' : '#50f0be'));
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          const tg = ctx.createLinearGradient(drawX, drawY, drawX - tdx/tl*70, drawY - tdy/tl*70);
          tg.addColorStop(0, hexA(tcolHex, 0.75));
          tg.addColorStop(1, hexA(tcolHex, 0));
          ctx.strokeStyle = tg;
          ctx.lineWidth = 5;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(drawX, drawY);
          ctx.lineTo(drawX - tdx/tl*70, drawY - tdy/tl*70);
          ctx.stroke();
          /* 光晕 */
          const hg = ctx.createRadialGradient(drawX, drawY, 0, drawX, drawY, 22);
          hg.addColorStop(0, hexA(tcolHex, 0.55));
          hg.addColorStop(1, hexA(tcolHex, 0));
          ctx.fillStyle = hg;
          ctx.beginPath(); ctx.arc(drawX, drawY, 22, 0, TAU); ctx.fill();
          ctx.restore();
        }
        // 闪烁效果（快消失时）
        const alpha = d.life < 3 ? (Math.sin(d.life * 10) > 0 ? 1 : 0.3) : 1;
        ctx.globalAlpha = alpha;
        if(d.type === 'gold'){
          // 金币：金色小圆点
          ctx.fillStyle = '#ffd700';
          ctx.beginPath(); ctx.arc(drawX, drawY, 8, 0, TAU); ctx.fill();
          ctx.strokeStyle = '#b8860b'; ctx.lineWidth = 2; ctx.stroke();
          // 金币数量
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 11px "Microsoft YaHei"';
          ctx.textAlign = 'center';
          ctx.fillText(`+${d.amount||10}`, drawX, drawY - 12);
        } else if(d.type === 'equip'){
          const eq = d.equip;
          const tierIdx = ['common','advanced','rare','epic','legend','mythic'].indexOf(eq.tier);
          const tcol = eq.tierColor || '#ffffff';
          const gt = (G ? G.t : performance.now() * 0.001);
          /* ---- 地面光斑 ---- */
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          const rg = ctx.createRadialGradient(drawX, drawY + 7, 1, drawX, drawY + 7, 36);
          rg.addColorStop(0, hexA(tcol, 0.55));
          rg.addColorStop(1, hexA(tcol, 0));
          ctx.fillStyle = rg;
          ctx.beginPath(); ctx.ellipse(drawX, drawY + 7, 36, 12, 0, 0, TAU); ctx.fill();
          /* ---- 品阶光柱（稀有以上） ---- */
          if(tierIdx >= 2){
            const isMythic = eq.tier === 'mythic';
            const ph = isMythic ? 180 : (72 + tierIdx * 24);
            const pulse = isMythic ? (0.50 + Math.sin(gt * 6 + d.bobPhase) * 0.15) : (0.26 + Math.sin(gt * 4 + d.bobPhase) * 0.10);
            const pg = ctx.createLinearGradient(drawX, drawY - ph, drawX, drawY + 7);
            pg.addColorStop(0, hexA(tcol, 0));
            pg.addColorStop(0.3, hexA(tcol, pulse * 0.6));
            pg.addColorStop(0.6, hexA(tcol, pulse));
            pg.addColorStop(1, hexA(tcol, isMythic ? 0.85 : 0.52));
            ctx.fillStyle = pg;
            const pillarW = isMythic ? 28 : 15;
            ctx.beginPath();
            ctx.moveTo(drawX - pillarW * 0.35, drawY + 7);
            ctx.lineTo(drawX - pillarW, drawY - ph);
            ctx.lineTo(drawX + pillarW, drawY - ph);
            ctx.lineTo(drawX + pillarW * 0.35, drawY + 7);
            ctx.closePath(); ctx.fill();
            /* 史诗光柱两侧额外辉光 */
            if(isMythic){
              const glowW = 60;
              const sideGlow = ctx.createLinearGradient(drawX - glowW, drawY, drawX + glowW, drawY);
              sideGlow.addColorStop(0, hexA(tcol, 0));
              sideGlow.addColorStop(0.5, hexA(tcol, 0.18));
              sideGlow.addColorStop(1, hexA(tcol, 0));
              ctx.fillStyle = sideGlow;
              ctx.fillRect(drawX - glowW, drawY - ph, glowW * 2, ph + 7);
            }
            /* 上升光尘 */
            const dustCount = isMythic ? 8 : 3;
            for(let k = 0; k < dustCount; k++){
              const u = ((gt * (isMythic ? 0.8 : 0.55) + k * (1 / dustCount)) % 1);
              const dustSize = isMythic ? 3.2 : 1.9;
              const dustAlpha = (1 - u) * (isMythic ? 0.95 : 0.75);
              ctx.fillStyle = hexA(tcol, dustAlpha);
              ctx.beginPath();
              const dustX = drawX + Math.sin(u * 9 + k * 2) * (isMythic ? 18 : 9);
              ctx.arc(dustX, drawY + 4 - u * ph, dustSize, 0, TAU);
              ctx.fill();
            }
            /* 史诗顶部扩散光环 */
            if(isMythic){
              const ringR = 22 + Math.sin(gt * 3) * 6;
              ctx.strokeStyle = hexA(tcol, 0.6);
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.ellipse(drawX, drawY - ph + 10, ringR, ringR * 0.35, 0, 0, TAU);
              ctx.stroke();
            }
          }
          ctx.restore();
          /* ---- 图标底框（品阶渐变） ---- */
          ctx.globalAlpha = alpha;
          const bgG = ctx.createLinearGradient(drawX, drawY - 16, drawX, drawY + 16);
          bgG.addColorStop(0, hexA(tcol, 0.30));
          bgG.addColorStop(1, 'rgba(6,8,14,0.92)');
          ctx.fillStyle = bgG;
          ctx.beginPath(); ctx.roundRect(drawX - 16, drawY - 16, 32, 32, 4); ctx.fill();
          ctx.strokeStyle = hexA(tcol, 0.9); ctx.lineWidth = 1.4;
          ctx.beginPath(); ctx.roundRect(drawX - 15.5, drawY - 15.5, 31, 31, 4); ctx.stroke();
          /* ---- 装备本体图标 ---- */
          drawEquipIcon(eq.slot, eq.weaponType, drawX - 12, drawY - 12, 24);
          /* ---- 名称（品阶色 + 描边，保证暗底可读） ---- */
          const label = eq.name || '';
          ctx.font = 'bold 10px "Microsoft YaHei"';
          ctx.textAlign = 'center';
          ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.85)';
          ctx.strokeText(label, drawX, drawY - 21);
          ctx.fillStyle = tcol;
          ctx.fillText(label, drawX, drawY - 21);
          /* 套装件额外标注 */
          if(eq.setId){
            ctx.font = 'bold 8px "Microsoft YaHei"';
            ctx.lineWidth = 2.5;
            ctx.strokeText('【套装】', drawX, drawY - 31);
            ctx.fillStyle = '#ffd166';
            ctx.fillText('【套装】', drawX, drawY - 31);
          }
        } else if(d.type === 'prop'){
          /* 药水：红瓶（回血）/ 蓝瓶（回蓝） */
          const pid = (d.prop && d.prop.id) || 'hp1';
          const pm = (typeof potionMeta === 'function') ? potionMeta(pid) : { kind:'hp', color:'#ff5f6d', name:'生命药水' };
          const isHp = pm.kind === 'hp';
          const bw2 = 13, bh2 = 17;
          ctx.save();
          ctx.translate(drawX, drawY);
          /* 瓶身 */
          ctx.fillStyle = isHp ? 'rgba(255,80,95,0.95)' : 'rgba(70,150,255,0.95)';
          ctx.beginPath(); ctx.roundRect(-bw2/2, -bh2/2 + 3, bw2, bh2 - 3, 3); ctx.fill();
          /* 瓶口 + 塞子 */
          ctx.fillStyle = 'rgba(230,240,255,0.9)';
          ctx.fillRect(-3, -bh2/2 - 1, 6, 5);
          ctx.fillStyle = '#c9a84c';
          ctx.fillRect(-4, -bh2/2 - 4, 8, 4);
          /* 高光 */
          ctx.fillStyle = 'rgba(255,255,255,0.45)';
          ctx.fillRect(-bw2/2 + 2, -bh2/2 + 6, 2.4, bh2 - 11);
          /* 十字 / 水滴 */
          ctx.fillStyle = 'rgba(255,255,255,0.92)';
          if(isHp){ ctx.fillRect(-4, -1.2, 8, 2.4); ctx.fillRect(-1.2, -4, 2.4, 8); }
          else { ctx.beginPath(); ctx.moveTo(0,-4); ctx.quadraticCurveTo(4,1,0,4); ctx.quadraticCurveTo(-4,1,0,-4); ctx.fill(); }
          ctx.restore();
          /* 名称 */
          ctx.fillStyle = pm.color;
          ctx.font = 'bold 10px "Microsoft YaHei"';
          ctx.textAlign = 'center';
          ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.8)';
          ctx.strokeText(pm.name, drawX, drawY - 14);
          ctx.fillText(pm.name, drawX, drawY - 14);
        } else if(d.type === 'material'){
          // 强化材料：灰色石头
          ctx.fillStyle = '#88ccff';
          ctx.beginPath(); ctx.moveTo(drawX, drawY-9); ctx.lineTo(drawX+8, drawY); ctx.lineTo(drawX, drawY+9); ctx.lineTo(drawX-8, drawY); ctx.closePath(); ctx.fill();
          ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
          // 材料名称
          const matNames = { enhance_stone_low: '下级强化石', enhance_stone_mid: '中级强化石', enhance_stone_high: '高级强化石' };
          ctx.fillStyle = '#88ccff';
          ctx.font = 'bold 10px "Microsoft YaHei"';
          ctx.textAlign = 'center';
          ctx.fillText(matNames[d.matType] || '强化石', drawX, drawY - 15);
        }
        ctx.globalAlpha = 1;
      }
}
}
