/* ============================================================
   ★ 开发调试入口（仅在 URL 带 ?dev=xxx 时触发，正常游玩完全不受影响）
   dev=town / inv / quest / char / skill / select / pvpselect
   ============================================================ */
setTimeout(function(){
  try{
    const q = new URLSearchParams(location.search);
    if(q.get('cal')) window.DBG_CAL = true;
    /* ?dbg=icon 诊断技能图标解码情况，结果写进 title 供无头浏览器抓取 */
    if(q.get('dbg') === 'icon'){
      window.__dbgFreeze = true;
      setTimeout(function(){
        const w = WEAPONS[0];
        const e = getSkillIconImage(w.id, 0);
        document.title = 'DBG usable=' + skillIconReady(e) +
          ' complete=' + e.img.complete + ' nw=' + e.img.naturalWidth +
          ' cacheKeys=' + Object.keys(skillIconCache).length;
      }, 1500);
      return;
    }
    const dev = q.get('dev');
    if(!dev) return;
    if(!G || !G.player){
      startSingleWithChar(Number(q.get('job') || 0));
      playerName = '拾灯人';
      if(G) G.playerName = playerName;
      initTown();
    }
    /* ?gear=0..5 一键穿满指定品阶（含套装），用于核对装备外观 */
    const gq = q.get('gear');
    if(gq !== null && G && G.player){
      const ti = Math.max(0, Math.min(5, Number(gq) || 0));
      const tt = EQUIP_TIERS[ti];
      const slots = ['weapon','head','armor','shoes','necklace','ring','bracer'];
      for(let i = 0; i < slots.length; i++){
        const slot = slots[i];
        const eq = generateEquipment(slot, 58, 2);
        eq.tier = tt.id; eq.tierName = tt.name; eq.tierColor = tt.color;
        eq.level = 58;
        if(slot !== 'weapon' && SET_SLOTS.indexOf(slot) >= 0){
          const st = EQUIP_SETS[Number(q.get('set') || 0) % EQUIP_SETS.length];
          const partKey = (slot === 'necklace' || slot === 'ring' || slot === 'bracer') ? 'accessory' : slot;
          eq.setId = st.id; eq.setName = st.name; eq.setColor = st.color; eq.name = st.parts[partKey];
        }
        if(q.get('enh')) eq.enhance = Number(q.get('enh')) || 0;
        if(q.get('amp')) eq.amplify = Number(q.get('amp')) || 0;
        G.player.equipment[slot] = eq;
      }
      if(typeof recalcPlayerStats === 'function') recalcPlayerStats(G.player);
      else if(typeof applyEquipment === 'function') applyEquipment(G.player);
    }
    if(dev === 'town'){
      gameState = 'town';
      /* ?px=X&py=Y 把玩家摆到指定世界坐标；?npc=id 直接触发某类 NPC */
      const pxq = q.get('px'), pyq = q.get('py');
      if(pxq !== null || pyq !== null){
        if(!townPlayer) initTown();
        if(townPlayer){
          if(pxq !== null) townPlayer.x = Number(pxq) || 0;
          if(pyq !== null) townPlayer.y = Number(pyq) || 0;
          /* 调试传送：镜头瞬间对齐，避免平滑跟随慢半拍 */
          townCam.x = clamp(townPlayer.x - VW/2, 0, Math.max(0, TOWN_W - VW));
          townCam.y = clamp(townPlayer.y - VH/2, 0, Math.max(0, TOWN_H - VH));
        }
      }
      const nq2 = q.get('npc');
      if(nq2){
        const npc = NPCS.find(n => n.id === nq2 || n.type === nq2);
        if(npc) setTimeout(function(){ triggerNpc(npc); }, 900);
      }
    }
    else if(dev === 'inv'){ G.inventoryReturnState = 'town'; gameState = 'inventory'; }
    else if(dev === 'quest'){ questReturnState = 'town'; gameState = 'questMenu'; }
    else if(dev === 'char'){ gameState = 'characterInfo'; }
    else if(dev === 'skill'){ gameState = 'skillMenu'; }
    else if(dev === 'select'){ gameState = 'charSelect'; charSelectState.phase = 'single'; charSelectState.step = 0; }
    else if(dev === 'pvpselect'){ gameState = 'pvpSelect'; pvpState = 'select1'; pvpSelect = [0, 0]; }
    else if(dev === 'levels'){ gameState = 'levelSelect'; }
    else if(dev === 'gates'){ levelSelectFilter = {from:0,to:2}; gameState = 'levelSelect'; }
    else if(dev === 'abyss'){ levelSelectFilter = 'abyss'; gameState = 'levelSelect'; }
    else if(dev === 'escmenu'){ gameState = 'gameMenu'; }
    else if(dev === 'wiki'){ openEquipWiki(); }
    else if(dev === 'dungeon'){ gameState = 'dungeonSelect'; }
    /* ?dev=town&npc=shop 直接触发某类 NPC，用于回归测试全部交互入口 */
    if(q.get('npc')){
      const target = NPCS.filter(n => n.type === q.get('npc'))[0];
      if(target) triggerNpc(target);
    }
    /* ?dev=cast&job=4&skill=0 进第一关并自动放指定技能，用于回归测试技能不报错 */
    if(dev === 'cast'){
      const job = Number(q.get('job') || 0);
      startSingleWithChar(job);
      playerName = '测试'; G.playerName = playerName;
      /* ?lvl=N 可进任意关卡（深渊五境 = 12~16），用于 Boss/小怪回归测试 */
      startLevel(Number(q.get('lvl') || 0));
      const sk = Number(q.get('skill') || 0);
      /* 放完技能后把帧异常计数写进 title */
      setTimeout(function(){
        try{
          const p = G.player;
          p.pvpAllSkills = true;
          for(let i = 0; i < 6; i++) p.skillsUnlocked[i] = true;
          p.level = 60;
          p.action = null;                        /* 清掉残留姿态，否则普攻会被缓冲掉 */
          /* skill=-1 表示测普通攻击 */
          if(sk < 0) tryPlayerAttack(p); else tryUseSkill(p, sk);
        }catch(e){ window.__castErr = String(e); }
      }, 900);
      /* 峰值采样：特效寿命短，只看结束时的数量会全是 0 */
      window.__peakEff = 0; window.__peakPart = 0;
      window.__enemyHp0 = null; window.__enemyHpMin = null; window.__projSeen = 0;
      /* headless 虚拟时间下 rAF 驱动的 intro 计时不稳定，直接手动刷一波敌人供命中验证 */
      setTimeout(function(){
        try{
          if(G && !G.isPvp){
            G.waveState = 'active'; G.waveTimer = 999;
            spawnWaveEnemies();
            if(G.enemies && G.enemies.length){
              /* 把第一只敌人放到玩家正前方 240px，方便直线投射物命中 */
              const e0 = G.enemies[0];
              e0.x = G.player.x + 150; e0.y = G.player.y;
            }
          }
        }catch(e){ window.__castErr = String(e); }
      }, 500);
      let _sn = 0;
      (function tick(){
        if(G){
          if(G.effects.length > window.__peakEff) window.__peakEff = G.effects.length;
          if(G.particles.length > window.__peakPart) window.__peakPart = G.particles.length;
          /* 采样最近存活敌人的 HP 与投射物数量（用于验证远程普攻命中伤害） */
          if(G.enemies && G.enemies.length){
            let ne = null, nd = 1e9;
            for(const e of G.enemies){ if(e.alive){ const d=Math.abs(e.x-(G.player?G.player.x:0)); if(d<nd){nd=d;ne=e;} } }
            if(ne){
              if(window.__enemyHp0 === null) window.__enemyHp0 = ne.hp;
              if(window.__enemyHpMin === null || ne.hp < window.__enemyHpMin) window.__enemyHpMin = ne.hp;
            }
          }
          let pc = 0; for(const pr of G.projectiles){ if(pr.kind==='spellShot') pc++; }
          if(pc > window.__projSeen) window.__projSeen = pc;
        }
        if(++_sn < 70) setTimeout(tick, 35);
      })();
      setTimeout(function(){
        document.title = 'CAST job=' + job + ' sk=' + sk +
          ' err=' + (window.__loopErrCount || 0) +
          ' peakEff=' + window.__peakEff + ' peakPart=' + window.__peakPart +
          ' hp0=' + (window.__enemyHp0===null?'?':Math.round(window.__enemyHp0)) +
          ' hpMin=' + (window.__enemyHpMin===null?'?':Math.round(window.__enemyHpMin)) +
          ' proj=' + window.__projSeen +
          ' en=' + (G && G.enemies ? G.enemies.length : -1) +
          ' state=' + gameState +
          (window.__castErr ? (' CAST_ERR=' + window.__castErr) : '');
      }, 3000);
      return;
    }
    /* ?dev=clear 直接进入结算翻牌界面（测试翻牌与奖励发放） */
    if(dev === 'clear'){
      startLevel(Number(q.get('lv') || 0));
      setTimeout(function(){
        try{
          const p = G.player;
          const slots2 = ['weapon','head','armor','shoes','necklace','ring','bracer'];
          const cards = [];
          /* 第 1 张：保底（白/蓝/金币），第 2、3 张：强制高阶 */
          for(let i = 0; i < 3; i++){
            let roll = (i === 0) ? Math.random() : (Math.random() < 0.5 ? 0.15 : 0.01);
            let card;
            if(roll < 0.03){
              const eq = generateEquipment(slots2[Math.floor(Math.random()*7)], G.levelIdx, 2);
              eq.tier='epic'; eq.tierName='神器'; eq.tierColor='#e91e63';
              card = { type:'equip', equip:eq, label:eq.name, sublabel:'神器 Lv.'+eq.level, color:'#e91e63' };
            } else if(roll < 0.20){
              const eq = generateEquipment(slots2[Math.floor(Math.random()*7)], G.levelIdx, 1);
              eq.tier='rare'; eq.tierName='稀有'; eq.tierColor='#9b59b6';
              card = { type:'equip', equip:eq, label:eq.name, sublabel:'稀有 Lv.'+eq.level, color:'#9b59b6' };
            } else if(roll < 0.50){
              const eq = generateEquipment(slots2[Math.floor(Math.random()*7)], G.levelIdx, 0);
              eq.tier='advanced'; eq.tierName='高级'; eq.tierColor='#3498db';
              card = { type:'equip', equip:eq, label:eq.name, sublabel:'高级 Lv.'+eq.level, color:'#3498db' };
            } else if(roll < 0.75){
              const eq = generateEquipment(slots2[Math.floor(Math.random()*7)], G.levelIdx, 0);
              eq.tier='common'; eq.tierName='普通'; eq.tierColor='#ffffff';
              card = { type:'equip', equip:eq, label:eq.name, sublabel:'普通 Lv.'+eq.level, color:'#aaaaaa' };
            } else {
              const g2 = 66 + G.levelIdx * 30;
              card = { type:'gold', amount:g2, label:g2+' 金币', sublabel:'金币奖励', color:'#ffd700' };
            }
            cards.push(card);
          }
          stageClearData = {
            levelIdx: G.levelIdx, kills: 8, gold: 500,
            equipmentCount: 1, materialCount: 2, exp: 300, rating: 'A',
            rewardEquips: [], rewardMats: [],
            cards: cards, cardsFlipped: [false,false,false], allCardsFlipped: false
          };
          gameState = 'stageClear';
          window.__clearErr = 'ok';
        }catch(e){ window.__clearErr = String(e); }
      }, 900);
      setTimeout(function(){
        document.title = 'CLEAR err=' + (window.__loopErrCount||0) + ' st=' + (window.__clearErr||'?') + ' state=' + gameState;
      }, 3000);
      return;
    }
    /* ?dev=town&dbg=err 把帧异常计数与当前状态写进 title */
    if(q.get('dbg') === 'err'){
      setTimeout(function(){
        document.title = 'ERR ' + (window.__loopErrCount || 0) + ' state=' + gameState;
      }, 1800);
    }
  }catch(e){ console.warn('[dev]', e); }
}, 700);
