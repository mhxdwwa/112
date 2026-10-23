/* ============ 关键修复：update 函数 ============ */
/* ===== 强化 / 分解 / 增幅 核心逻辑 ===== */
function enhanceMsg(text, color, ms){
  if(!G) return;
  G.enhanceMsg = { text: text, color: color || '#ffd700', until: performance.now() + (ms || 3200) };
}

/* ★ 强化装备 */
function doEnhance(){
  const p = G.player;
  if(!p || !p.equipment) return;
  const slot = enhanceSelectedSlot || 'weapon';
  const eq = p.equipment[slot];
  if(!eq){ enhanceMsg('该部位没有装备，无法强化', '#ff8a7a'); return; }

  const enhLv = eq.enhance || 0;
  if(enhLv >= ENHANCE_MAX_LV){ enhanceMsg('已达最高强化等级 +' + ENHANCE_MAX_LV, '#ffd166'); return; }

  const nextInfo = ENHANCE_TABLE[enhLv + 1];
  if(!nextInfo) return;

  const matInfo = enhanceMaterialOf(eq);
  const cost = enhanceCostOf(enhLv);
  if(!p.materials) p.materials = {};
  const have = p.materials[matInfo.id] || 0;

  if(have < cost.mat){
    enhanceMsg(matInfo.name + '不足：需要 ' + cost.mat + ' 个（当前 ' + have + ' 个）', '#ff8a7a');
    playSound('impact');
    return;
  }
  if((p.gold || 0) < cost.gold){
    enhanceMsg('金币不足：需要 ' + cost.gold + ' 金币（当前 ' + (p.gold || 0) + '）', '#ff8a7a');
    playSound('impact');
    return;
  }

  p.materials[matInfo.id] -= cost.mat;
  p.gold -= cost.gold;

  const before = calcEnhanceStats(eq);
  const success = Math.random() < nextInfo.rate;
  G.enhanceFxAt = performance.now();

  if(success){
    eq.enhance = enhLv + 1;
    const after = calcEnhanceStats(eq);
    const parts = [];
    const dAtk = after.atk - before.atk, dDef = after.def - before.def;
    const dHp = after.hp - before.hp, dPierce = after.pierce - before.pierce;
    if(dAtk) parts.push('攻击+' + dAtk);
    if(dDef) parts.push('防御+' + dDef);
    if(dHp) parts.push('生命+' + dHp);
    if(dPierce) parts.push('无视防御+' + dPierce);
    enhanceMsg('强化成功！+' + eq.enhance + (parts.length ? '　' + parts.join('　') : ''), '#ffd700', 4200);
    playSound('skillCast');
  } else if(nextInfo.penalty === 'drop1'){
    eq.enhance = Math.max(0, enhLv - 1);
    enhanceMsg('强化失败！强化等级 -1 → +' + eq.enhance, '#ff8a7a', 4000);
    playSound('impact');
  } else if(nextInfo.penalty === 'reset'){
    eq.enhance = 0;
    enhanceMsg('强化失败！强化等级归零（装备不会消失）', '#ff6a4a', 4200);
    playSound('impact');
  } else {
    enhanceMsg('强化失败，强化等级保持不变', '#9fb6cc', 3200);
    playSound('impact');
  }
  recalcPlayerStats();
}

/* 分解装备（支持多选） */
function doDecompose(){
  const p = G.player;
  if(!p || !p.inventory) return;

  // 使用多选列表，如果为空则回退到单选
  let indices = (typeof decomposeSelectedIndices !== 'undefined' && decomposeSelectedIndices.length > 0)
    ? decomposeSelectedIndices.slice()
    : (decomposeSelectedIndex >= 0 ? [decomposeSelectedIndex] : []);

  // 过滤有效索引并排序（从大到小，避免splice时索引错位）
  indices = indices.filter(function(i){ return i >= 0 && i < p.inventory.length && p.inventory[i]; });
  if(indices.length === 0){
    enhanceMsg('请先在左侧背包中点选要分解的装备', '#ff8a7a');
    return;
  }
  indices.sort(function(a,b){ return b - a; });

  if(!p.amplifyStones) p.amplifyStones = {};

  // 统计总奖励
  const stoneTotals = {};
  let totalItems = 0;
  for(let ii = 0; ii < indices.length; ii++){
    const eq = p.inventory[indices[ii]];
    if(!eq) continue;

    const stoneKey = equipTierKey(eq);
    const stoneInfo = AMPLIFY_STONES[stoneKey] || AMPLIFY_STONES.common;
    const stoneCount = 1 + (eq.enhance || 0) + Math.floor((eq.level || 1) / 10);

    if(!stoneTotals[stoneInfo.id]){
      stoneTotals[stoneInfo.id] = { info: stoneInfo, count: 0 };
    }
    stoneTotals[stoneInfo.id].count += stoneCount;
    totalItems++;
  }

  // 逐个移除装备（已从大到小排序）
  for(let ii = 0; ii < indices.length; ii++){
    p.inventory.splice(indices[ii], 1);
  }

  // 发放奖励
  for(const key in stoneTotals){
    const st = stoneTotals[key];
    p.amplifyStones[st.info.id] = (p.amplifyStones[st.info.id] || 0) + st.count;
  }

  // 清空选择
  decomposeSelectedIndex = -1;
  decomposeSelectedIndices = [];
  G.enhanceFxAt = performance.now();

  // 生成奖励描述
  const rewardParts = [];
  for(const key in stoneTotals){
    const st = stoneTotals[key];
    rewardParts.push(st.info.name + ' x' + st.count);
  }
  enhanceMsg('分解成功！' + totalItems + '件装备 → ' + rewardParts.join('，'), '#e67e22', 4200);
  playSound('skillCast');
}

/* 增幅装备 */
function doAmplify(){
  const p = G.player;
  if(!p || !p.equipment) return;
  const slot = amplifySelectedSlot || 'weapon';
  const eq = p.equipment[slot];
  if(!eq){ enhanceMsg('该部位没有装备，无法增幅', '#ff8a7a'); return; }

  const ampLv = eq.amplify || 0;
  if(ampLv >= AMPLIFY_MAX_LV){ enhanceMsg('已达最高增幅等级 +' + AMPLIFY_MAX_LV, '#ffd166'); return; }

  if(!p.amplifyStones) p.amplifyStones = {};
  const ac = amplifyCostOf(ampLv, eq);
  const have = p.amplifyStones[ac.stone.id] || 0;

  if(have < ac.count){
    enhanceMsg(ac.stone.name + '不足：需要 ' + ac.count + ' 个（当前 ' + have + ' 个），可分解装备获得', '#ff8a7a');
    playSound('impact');
    return;
  }
  if((p.gold || 0) < ac.gold){
    enhanceMsg('金币不足：需要 ' + ac.gold + ' 金币（当前 ' + (p.gold || 0) + '）', '#ff8a7a');
    playSound('impact');
    return;
  }

  p.amplifyStones[ac.stone.id] -= ac.count;
  p.gold -= ac.gold;

  const before = calcAmplifyStats(eq);
  const success = Math.random() < amplifyRateOf(ampLv, eq);
  G.enhanceFxAt = performance.now();

  if(success){
    eq.amplify = ampLv + 1;
    const after = calcAmplifyStats(eq);
    const parts = [];
    const dStr = after.str - before.str, dVit = after.vit - before.vit;
    const dAtk = after.atk - before.atk, dHp = after.hp - before.hp;
    if(dStr) parts.push('力量+' + dStr);
    if(dVit) parts.push('体力+' + dVit);
    if(dAtk) parts.push('攻击+' + dAtk);
    if(dHp) parts.push('生命+' + dHp);
    enhanceMsg('增幅成功！+' + eq.amplify + (parts.length ? '　' + parts.join('　') : ''), '#ff9ae0', 4200);
    playSound('skillCast');
  } else {
    enhanceMsg('增幅失败：材料已消耗，增幅等级保持 +' + ampLv, '#ff8a7a', 3800);
    playSound('impact');
  }
  recalcPlayerStats();
}

/* ★ 掉落物拾取 */
function pickupDrop(d){
  const p = G.player;
  if(!p) return;
  
  switch(d.type){
    case 'gold':
      p.gold += d.gold;
      spawnText(d.x, d.y-30, 60, '+'+d.gold+' 金币', '#ffd700', 18);
      break;
    case 'equip':
      // 自动装备：检查等级、职业匹配，且比当前装备更好才装备
      const slot = d.equip.slot;
      const oldEquip = p.equipment[slot];
      
      // 检查等级限制
      if(d.equip.level > (p.level || 1)){
        if(isBagFull()){
          spawnText(d.x, d.y-30, 60, '背包已满!', '#ff6a5a', 16);
        } else {
          p.inventory.push(d.equip);
          spawnText(d.x, d.y-30, 60, '获得装备(等级不足)', '#888', 14);
        }
        break;
      }
      
      // 检查武器职业匹配
      if(d.equip.slot === 'weapon'){
        const playerWeaponType = (WEAPONS[p.weaponIdx || 0] || WEAPONS[0]).id;
        if(d.equip.weaponType !== playerWeaponType){
          if(isBagFull()){
            spawnText(d.x, d.y-30, 60, '背包已满!', '#ff6a5a', 16);
          } else {
            p.inventory.push(d.equip);
            spawnText(d.x, d.y-30, 60, '获得装备(类型不符)', '#888', 14);
          }
          break;
        }
      }
      
      /* 比当前装备更好才自动穿戴：统一用「战力」比较，避免字符串比品阶 */
      const _newScore = equipScore(d.equip);
      const _oldScore = oldEquip ? equipScore(oldEquip) : -1;
      if(!oldEquip || _newScore > _oldScore){
        p.equipment[slot] = d.equip;
        spawnText(d.x, d.y-30, 80, '装备: '+d.equip.name, d.equip.tierColor, 20);
        spawnParticles(d.x, d.y-20, 20, {color:d.equip.tierColor, spMin:50, spMax:250, lifeMin:0.4, lifeMax:1.0, sizeMin:2, sizeMax:6, grav:-150});
        /* 重新计算属性 */
        recalcPlayerStats();
      } else {
        if(isBagFull()){
          spawnText(d.x, d.y-30, 60, '背包已满!', '#ff6a5a', 16);
        } else {
          p.inventory.push(d.equip);
          spawnText(d.x, d.y-30, 60, '获得装备(背包)', d.equip.tierColor, 16);
        }
      }
      break;
    case 'prop':
      /* 药水（回血瓶 / 回蓝瓶）：按 id 入药水袋 */
      const prop = d.prop;
      if(window.POTION && prop && prop.id){
        if(!p.potions) p.potions = {};
        p.potions[prop.id] = (p.potions[prop.id] || 0) + 1;
        const pm = potionMeta(prop.id);
        spawnText(d.x, d.y-30, 60, '获得: '+pm.name, pm.color, 18);
      } else {
        if(!p.props) p.props = {};
        p.props[prop.id] = (p.props[prop.id] || 0) + 1;
        spawnText(d.x, d.y-30, 60, '获得: '+prop.name, '#2ee6a8', 18);
      }
      break;
    case 'material':
      p.materials[d.material.id] = (p.materials[d.material.id]||0) + 1;
      spawnText(d.x, d.y-30, 50, d.material.name+' +1', '#aaaaff', 14);
      break;
  }
}

/* 重新计算玩家装备属性 */
/* ============================================================
   ★ 属性重算（DNF 面板模型）
   角色本体数值存进 baseStat 快照，每次重算都「快照 + 装备 + 丹药」重新拼，
   所以反复穿脱装备也不会越叠越高。
   ============================================================ */
function ensureBaseStat(p){
  if(!p) return null;
  if(!p.baseStat){
    p.baseStat = {
      atk: Math.max(1, p.atk || 1),
      maxHp: Math.max(1, p.maxHp || 1),
      maxMp: Math.max(0, p.maxMp || 0),
      moveSpeed: p.moveSpeed || 300,
      critBonus: p.critBonus || 0,
      def: p.def || 0
    };
  }
  return p.baseStat;
}
/* 等级成长直接写进快照，再由 recalcPlayerStats 统一铺开 */
function growBaseStat(p, atkMul, dHp, dMp){
  const bs = ensureBaseStat(p);
  if(!bs) return;
  if(atkMul) bs.atk = Math.round(bs.atk * atkMul);
  if(dHp) bs.maxHp += dHp;
  if(dMp) bs.maxMp += dMp;
}

function recalcPlayerStats(){
  const p = G.player;
  if(!p) return;
  /* ★ 兜底：任何玩家对象都先确保有飞行道具（新号 / 老存档 / 直接开战都覆盖） */
  if(window.MOUNT) MOUNT.ensure(p);
  const bs = ensureBaseStat(p);
  const b  = calcEquipmentBonus(p.equipment);
  const pb = p.propBonuses || { atk:0, hp:0, mp:0, cdReduce:0, crit:0 };

  /* ---- DNF 四维 ---- */
  p.statStr = b.str; p.statInt = b.int; p.statVit = b.vit; p.statSpr = b.spr;
  /* ---- 三攻 / 双防 ---- */
  p.statPatk = b.patk; p.statMatk = b.matk;
  p.statPdef = b.pdef; p.statMdef = b.mdef;
  /* ---- 战斗属性 ---- */
  p.statPcrit = b.pcrit; p.statHit = b.hit; p.statDodge = b.dodge;
  p.statAtkSpd = b.atkSpd; p.statCastSpd = b.castSpd; p.statMoveSpd = b.moveSpd;
  p.statDmgBonus = b.dmgBonus; p.statAddDmg = b.addDmg; p.statCritDmg = b.critDmg;
  p.statFire = b.elemFire; p.statIce = b.elemIce; p.statLight = b.elemLight; p.statDark = b.elemDark;
  p.statLifesteal = b.lifesteal; p.statCdReduce = b.cdReduce;

  /* ---- 换算成实际战斗数值（★ DNF 分系：物理系吃力量，魔法系吃智力） ---- */
  const wMain = WEAPONS[p.weaponIdx] || WEAPONS[0];
  const isMagic = wMain.dmgType === 'magic';
  p.dmgType   = wMain.dmgType || 'phys';       /* 物理 / 魔法 */
  p.mainStat  = isMagic ? 'int' : 'str';       /* 主属性 */
  p.atk      = bs.atk + (isMagic ? b.matk + b.int * DNF_COEF.atkPerStr
                                 : b.patk + b.str * DNF_COEF.atkPerStr) + (pb.atk || 0);
  /* 魔法系：智力额外加成技能伤害（1 智力 = +0.15%），物理系不加 */
  p.skillIntBonus = isMagic ? b.int * DNF_COEF.skillPctPerInt / 100 : 0;
  p.maxHp    = bs.maxHp + b.hp + b.vit * DNF_COEF.hpPerVit + (pb.hp || 0);
  p.maxMp    = bs.maxMp + b.mp + b.spr * DNF_COEF.mpPerSpr + (pb.mp || 0);
  p.def      = bs.def + b.pdef + b.vit * DNF_COEF.defPerVit;
  p.moveSpeed = (bs.moveSpeed + b.spd) * (1 + b.moveSpd / 100);
  p.critBonus = bs.critBonus + b.pcrit / 100 + (pb.crit || 0) / 100;
  p.pierce    = b.pierce;
  /* 词条结算用 */
  p.dmgBonusPct = b.dmgBonus;
  p.addDmgPct   = b.addDmg;
  p.critDmgPct  = b.critDmg;
  p.lifesteal   = (b.lifesteal || 0) / 100;
  p.cdReducePct = (b.cdReduce || 0) + (pb.cdReduce || 0);
  p.elemPowers  = { fire:b.elemFire, ice:b.elemIce, light:b.elemLight, dark:b.elemDark };
  const bestElem = Math.max(b.elemFire, b.elemIce, b.elemLight, b.elemDark);
  p.elemBonusPct = bestElem * 0.5;   /* 属性强化：每 1 点 = 0.5% 伤害 */

  /* ---- 上限 ---- */
  p.atk = Math.min(Math.round(p.atk), STAT_CAPS.maxAtk);
  p.maxHp = Math.min(Math.round(p.maxHp), STAT_CAPS.maxHp);
  p.maxMp = Math.min(Math.round(p.maxMp), STAT_CAPS.maxMp);
  p.moveSpeed = Math.min(p.moveSpeed, STAT_CAPS.maxMoveSpeed);
  p.critBonus = Math.min(p.critBonus, STAT_CAPS.maxCrit / 100);
  if(p.hp > p.maxHp) p.hp = p.maxHp;
  if(p.mp > p.maxMp) p.mp = p.maxMp;
}

function update(dt){
  if(!G || (gameState !== 'playing' && gameState !== 'stageClear')) return;
  const rawDt = dt;                              // ★ 修复B：保存原始 dt，投射物不受 hitstop 减速
  if(G.hitstop > 0){ G.hitstop -= dt; dt *= 0.1; }
  G.t += dt; G.shake *= Math.pow(0.0015, dt); G.flash *= Math.pow(0.001, dt);
  if(G.comboTimer > 0){ G.comboTimer -= dt; if(G.comboTimer <= 0) G.combo = 0; }
  if(G.bannerTimer > 0) G.bannerTimer -= dt;

  const p = G.player;

  /* ★ 改进2: 血条延迟效果更新 */
  if(p && !p.dead){
    // displayHp 快速跟随当前血量
    p.displayHp = lerp(p.displayHp, p.hp, Math.min(1, dt * 10));
    // damageHp 缓慢跟随（延迟条效果）
    p.damageHp = lerp(p.damageHp, p.hp, Math.min(1, dt * 2));
  }

  /* ★ 掉落物更新：落地后自动吸附到玩家身上 */
  if(G.drops && G.drops.length > 0 && !G.isPvp){
    const canPick = p && p.alive !== false && !p.dead;
    const MAGNET_DELAY = 0.40;   /* 落地散开 0.4 秒后开始吸附 */
    for(let i = G.drops.length - 1; i >= 0; i--){
      const d = G.drops[i];
      d.life -= dt;
      d.age = (d.age || 0) + dt;
      d.bobPhase += dt * 3;
      let dx = d.x - p.x, dy = d.y - p.y;
      let dist = Math.sqrt(dx*dx + dy*dy);

      if(d.magnet && canPick){
        /* —— 吸附阶段：加速追踪玩家胸口 —— */
        d.magnetSpd = Math.min(1700, (d.magnetSpd || 220) + 3400 * dt);
        const tgx = p.x, tgy = p.y - 46;
        const ux = tgx - d.x, uy = tgy - d.y;
        const ul = Math.sqrt(ux*ux + uy*uy) || 1;
        d.x += (ux/ul) * d.magnetSpd * dt;
        d.y += (uy/ul) * d.magnetSpd * dt;
        d.vx = 0; d.vy = 0;
        d.magnetT = (d.magnetT || 0) + dt;
        if(dist < 30 || d.magnetT > 0.85){
          pickupDrop(d);
          G.drops.splice(i, 1);
          continue;
        }
      } else {
        /* —— 自由下落 / 地面弹跳 —— */
        d.vy += 800 * dt;
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        if(d.y > GY_BOTTOM - 10){
          d.y = GY_BOTTOM - 10;
          d.vy *= -0.4;
          d.vx *= 0.7;
          if(Math.abs(d.vy) < 30){ d.vy = 0; d.vx *= 0.4; }
        }
        if(canPick){
          /* 散开时间到 → 自动吸附；玩家贴身 → 立即吸附 */
          if(d.age > MAGNET_DELAY && Math.abs(d.vy) < 30) d.magnet = true;
          else if(dist < 120) d.magnet = true;
        }
        if(canPick && dist < 48){
          pickupDrop(d);
          G.drops.splice(i, 1);
          continue;
        }
      }
      /* 过期消失（吸附中的不会过期） */
      if(d.life <= 0 && !d.magnet){
        G.drops.splice(i, 1);
      }
    }
  }

  if(!G.isPvp && G.camera){
    const targetCamX = p.x - VW*0.35;
    G.camera.x = lerp(G.camera.x, targetCamX, dt*5);
    G.camera.x = clamp(G.camera.x, 0, G.worldWidth - VW);
  }

  /* ★ DNF 式房间推进：走进传送门进入下一房间 */
  if(!G.isPvp && G.portal && G.waveState === 'cleared' && !G.currentIsBoss){
    G.portal.t += dt;
    if(G.portal.t > 0.5){
      const dist = Math.abs(p.x - G.portal.x);
      if(dist < 58){ G.portal.hold = (G.portal.hold || 0) + dt; }
      else { G.portal.hold = 0; }
      /* ★ 必须自己走到门口并停留片刻，绝不自动推进 */
      if(G.portal.hold > 0.45){
        G.portal = null;
        const _bossIdx = (G.currentLvlCfg && G.currentLvlCfg.bossWaveIdx != null)
          ? G.currentLvlCfg.bossWaveIdx : 3;
        G.waveIdx = Math.min(_bossIdx, (G.waveIdx || 0) + 1);
        G.waveState = 'idle';
        p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.12);
        p.mp = Math.min(p.maxMp, p.mp + 25);
        G.roomFade = 1.0;   /* 转场黑幕 */
        playSound('levelup');
      }
    }
  }
  if(G.roomFade > 0) G.roomFade = Math.max(0, G.roomFade - dt * 2.2);

  /* ★ 结算界面下暂停波次状态机，避免重复触发结算；只保留玩家移动 */
  if(!G.isPvp && gameState === 'playing'){
    if(G.waveState === 'idle'){
      startWave();
    } else if(G.waveState === 'intro'){
      G.waveTimer -= dt;
      if(G.waveTimer <= 0){ G.waveState = 'fight'; spawnWaveEnemies(); }
    } else if(G.waveState === 'fight'){
      if(G.enemies.filter(e=>e.alive).length === 0){
        G.waveState = 'cleared'; G.waveTimer = 1.5;
        const isBossWave = G.currentIsBoss;
        if(isBossWave){
          G.bannerText = `${getLevelConfig(G.levelIdx||0).name} 通关！`; G.bannerTimer = 2.0;
        } else {
          G.bannerText = `第 ${(G.waveIdx||0)+1} 房间已清空 — 前往右侧传送门`;
          G.bannerTimer = 2.2;
          /* ★ DNF 式：开启传送门，玩家需走到门口才能推进 */
          G.portal = { x: ROOM_WIDTH - 130, t: 0 };
        }
        p.hp = Math.min(p.maxHp, p.hp+p.maxHp*0.15);
        p.mp = Math.min(p.maxMp, p.mp+30);
      }
    } else if(G.waveState === 'cleared'){
      G.waveTimer -= dt;
      if(G.waveTimer <= 0){
        const wasBossWave = G.currentIsBoss;
        if(wasBossWave){
          /* 关卡通过，显示结算界面 */
          const p = G.player;
          const kills = G.totalKills || 0;
          const gold = Math.floor(500 + G.levelIdx * 300 + Math.random() * 200);
          p.gold = (p.gold || 0) + gold;          
          // 记录已通关
          if(!p.clearedLevels) p.clearedLevels = [];
          if(!p.clearedLevels.includes(G.levelIdx)){
            p.clearedLevels.push(G.levelIdx);
          }
          
          // 统计掉落
          const eqCount = p.droppedEquipmentCount || 0;
          const matCount = p.droppedMaterialCount || 0;
          
          // ★ 通关必定奖励：1-2件装备 + 材料
          const diffMul = G.diffMul || 1.0;
          const rewardEquipCount = diffMul >= 3.5 ? 2 : (diffMul >= 2.0 ? 2 : 1);
          const rewardMats = [];
          const rewardEquips = [];
          
          // 生成奖励装备
          const slots = ['weapon', 'head', 'armor', 'shoes', 'necklace', 'ring', 'bracer'];
          for(let i = 0; i < rewardEquipCount; i++){
            const slot = slots[Math.floor(Math.random() * slots.length)];
            const equip = generateEquipment(slot, dropLevelIdx(G.levelIdx));
            
            // 难度越高，高品质概率越大
            const qualityBonus = diffMul * 0.1;
            if(Math.random() < qualityBonus * 0.3){
              // 提高品阶（★ 50 级以下最高只到粉/神器，不越级出传说/史诗）
              const tierIdx = EQUIP_TIERS.findIndex(t => t.id === equip.tier);
              let betterTierIdx = Math.min(EQUIP_TIERS.length - 1, tierIdx + 1);
              if((equip.level || 1) < 50) betterTierIdx = Math.min(betterTierIdx, 3);
              equip.tier = EQUIP_TIERS[betterTierIdx].id;
              equip.tierName = EQUIP_TIERS[betterTierIdx].name;
              equip.tierColor = EQUIP_TIERS[betterTierIdx].color;
              /* 品阶被抬高后同步「未开封」状态 */
              equip.sealed = (betterTierIdx >= 2 && betterTierIdx <= 4) ? true : undefined;
              equip.tradeable = (betterTierIdx < 5);
            }
            
            rewardEquips.push(equip);
            if(!p.inventory) p.inventory = [];
            if(p.inventory.length < BAG_CAPACITY){
              p.inventory.push(equip);
            }
          }

          /* ★ 深渊保底：通关必给一件传说（未开封，可交易） */
          {
            const _lc = (typeof getLevelConfig === 'function') ? getLevelConfig(G.levelIdx) : null;
            if(_lc && _lc.isAbyss){
              const slot = slots[Math.floor(Math.random() * slots.length)];
              const eq = generateEquipment(slot, dropLevelIdx(G.levelIdx), 3);
              const li = EQUIP_TIERS.length - 2;      /* legend */
              eq.tier = EQUIP_TIERS[li].id;
              eq.tierName = EQUIP_TIERS[li].name;
              eq.tierColor = EQUIP_TIERS[li].color;
              eq.sealed = true;
              eq.tradeable = true;
              rewardEquips.push(eq);
              if(!p.inventory) p.inventory = [];
              if(p.inventory.length < BAG_CAPACITY){
                p.inventory.push(eq);
              }
              if(typeof announceDrop === 'function') announceDrop(eq);
            }
          }
          
          // 生成奖励材料
          const matTypes = ['enhance_stone_low', 'enhance_stone_mid', 'enhance_stone_high'];
          const rewardMatCount = diffMul >= 3.5 ? 5 : (diffMul >= 2.0 ? 3 : 2);
          for(let i = 0; i < rewardMatCount; i++){
            let matType = 'enhance_stone_low';
            if(diffMul >= 3.5 && Math.random() < 0.4) matType = 'enhance_stone_high';
            else if(diffMul >= 2.0 && Math.random() < 0.5) matType = 'enhance_stone_mid';
            
            if(!p.materials) p.materials = {};
            p.materials[matType] = (p.materials[matType] || 0) + 1;
            rewardMats.push(matType);
          }
          
          // 计算评价
          const rating = kills > 20 ? 'SSS' : (kills > 15 ? 'SS' : (kills > 10 ? 'S' : (kills > 5 ? 'A' : 'B')));
          
          // 生成3张翻牌奖励
          const cards = [];
          function mkCardEquip(tierIdx){
            const slot = slots[Math.floor(Math.random() * slots.length)];
            const eq = generateEquipment(slot, dropLevelIdx(G.levelIdx), 0);
            const t = EQUIP_TIERS[tierIdx];
            eq.tier = t.id; eq.tierName = t.name; eq.tierColor = t.color;
            eq.baseAtk = eq.slot === 'weapon' ? Math.round(10 * t.baseMul * (1 + eq.level * 0.1) * eq.gradeMul) : eq.baseAtk;
            eq.baseHp = (eq.slot === 'head' || eq.slot === 'armor') ? Math.round(30 * t.baseMul * (1 + eq.level * 0.1) * eq.gradeMul) : eq.baseHp;
            eq.baseDef = eq.slot === 'armor' ? Math.round(5 * t.baseMul * (1 + eq.level * 0.1) * eq.gradeMul) : eq.baseDef;
            eq.baseSpd = eq.slot === 'shoes' ? Math.round(10 * t.baseMul * (1 + eq.level * 0.08) * eq.gradeMul) : eq.baseSpd;
            eq.baseCrit = (eq.slot === 'accessory' || eq.slot === 'necklace' || eq.slot === 'ring' || eq.slot === 'bracer') ? Math.round(3 * t.baseMul * (1 + eq.level * 0.1) * eq.gradeMul) : eq.baseCrit;
            /* 未开封规则与野外掉落一致 */
            if(tierIdx >= 2 && tierIdx <= 4) eq.sealed = true;
            if(tierIdx >= 5) eq.sealed = false;
            eq.tradeable = (tierIdx < 5);
            return eq;
          }

          /* ★ 粉装（神器）改成「约 15 局才有 1 局」：
             整局只掷一次骰子，中了才在随机一张卡里放粉装，
             其它卡最高只到紫装 —— 不再是每局三张卡里必出一张粉 */
          const EPIC_RUN_CHANCE = 0.065;
          const epicRun = Math.random() < EPIC_RUN_CHANCE;
          const epicAt = Math.floor(Math.random() * 3);

          for(let i = 0; i < 3; i++){
            let card;
            if(epicRun && i === epicAt){
              const equip = mkCardEquip(3);
              card = { type:'equip', equip: equip, label: equip.name, sublabel: '神器 Lv.' + equip.level + ' · 未开封', color: '#e91e63' };
              cards.push(card);
              continue;
            }
            /* 第 1 张卡是保底（偏白蓝），第 2、3 张稍微好一点（偏蓝紫）——
               保留「翻到的可能不如旁边那张」的落差感，但不再强行塞粉装 */
            const roll = Math.random();
            const rareCut  = (i === 0) ? 0.10 : 0.26;
            const advCut   = (i === 0) ? 0.45 : 0.62;
            const commonCut= (i === 0) ? 0.78 : 0.90;
            if(roll < rareCut){
              const equip = mkCardEquip(2);
              card = { type:'equip', equip: equip, label: equip.name, sublabel: '稀有 Lv.' + equip.level + ' · 未开封', color: '#9b59b6' };
            } else if(roll < advCut){
              const equip = mkCardEquip(1);
              card = { type:'equip', equip: equip, label: equip.name, sublabel: '高级 Lv.' + equip.level, color: '#3498db' };
            } else if(roll < commonCut){
              const equip = mkCardEquip(0);
              card = { type:'equip', equip: equip, label: equip.name, sublabel: '普通 Lv.' + equip.level, color: '#aaaaaa' };
            } else {
              const goldAmt = Math.round((50 + G.levelIdx * 30) * (0.8 + Math.random() * 0.4));
              card = { type:'gold', amount: goldAmt, label: goldAmt + ' 金币', sublabel: '金币奖励', color: '#ffd700' };
            }
            cards.push(card);
          }
          
          stageClearData = {
            levelIdx: G.levelIdx,
            kills: kills,
            gold: gold,
            equipmentCount: eqCount + rewardEquipCount,
            materialCount: matCount + rewardMatCount,
            exp: Math.floor(100 + G.levelIdx * 50),
            rating: rating,
            rewardEquips: rewardEquips,
            rewardMats: rewardMats,
            cards: cards,
            cardsFlipped: [false, false, false],
            allCardsFlipped: false
          };
          
          // 重置掉落统计
          p.droppedEquipmentCount = 0;
          p.droppedMaterialCount = 0;
          
          // ★ 自动拾取所有掉落物
          if(G.drops && G.drops.length > 0){
            for(const drop of G.drops){
              if(drop.type === 'gold'){
                p.gold = (p.gold || 0) + (drop.value || 10);
              } else if(drop.type === 'equip' && drop.equip){
                if(!p.inventory) p.inventory = [];
                if(p.inventory.length < BAG_CAPACITY){
                  p.inventory.push(drop.equip);
                }
                /* 背包已满则丢弃该装备 */
              } else if(drop.type === 'material' && drop.material){
                if(!p.materials) p.materials = {};
                p.materials[drop.material] = (p.materials[drop.material] || 0) + 1;
              } else if(drop.type === 'prop' && drop.prop){
                if(window.POTION && drop.prop.id){
                  if(!p.potions) p.potions = {};
                  p.potions[drop.prop.id] = (p.potions[drop.prop.id] || 0) + 1;
                } else {
                  if(!p.props) p.props = {};
                  p.props[drop.prop.id] = (p.props[drop.prop.id] || 0) + 1;
                }
              }
            }
            G.drops = [];
          }
          
          gameState = 'stageClear';
          return;
        } else {
          /* ★ 非 Boss 波：不在此处自动推进。清空后已开启传送门，
             由上面的 portal 机制在玩家走到门口时再切下一房间。 */
        }
      }
    }
  }

  if(!p.dead) updatePlayer(p, dt);

  if(G.isPvp && G.player2 && !G.player2.dead){
    updatePlayer(G.player2, dt);
    if(p.dead && !G.player2.dead){ gameState = 'pvpEnd'; pvpWinner = 2; }
    else if(G.player2.dead && !p.dead){ gameState = 'pvpEnd'; pvpWinner = 1; }
    else if(p.dead && G.player2.dead){ gameState = 'pvpEnd'; pvpWinner = 0; }
  }

  const enemyMaxX = G.isPvp ? WORLD_R : (G.worldWidth||WORLD_R);

  for(const e of G.enemies){
    if(gameState === 'stageClear') continue; // 通关结算时敌人冻结
    if(!e.alive){ e.deathT += dt; continue; }
    if(Math.abs(e.kx) > 1){ const _camL = (G.camera) ? G.camera.x : 0; e.x += e.kx*dt; e.kx *= Math.pow(0.0015,dt); e.x = clamp(e.x, Math.max(WORLD_L, _camL - 60), enemyMaxX); }
    if(e.launchT > 0){ e.launchT -= dt; e.vy += 2200*dt; e.h += e.vy*dt; if(e.h<=0){ e.h=0; e.vy=0; e.launchT=0; } continue; }
    if(e.h > 0){ e.vy += 2200*dt; e.h += e.vy*dt; if(e.h<0){ e.h=0; e.vy=0; } continue; }
    /* ★ 受击硬直只锁动作，不锁冷却——否则玩家连击可以无限控，怪永远不还手 */
    if(e.hurtT > 0){ e.hurtT -= dt; e.atkCd -= dt*0.6; e.skillCd -= dt*0.6; continue; }
    if(e.blocking > 0){ e.blocking -= dt; }
    /* ★ 定身 / 缠绕：不能移动与出手，但冷却仍缓慢推进 */
    if(e.rootT > 0){
      e.rootT -= dt;
      e.atkCd -= dt * 0.5; e.skillCd -= dt * 0.5;
      e.action = null;
      if(e.mp < e.maxMp) e.mp = Math.min(e.maxMp, e.mp + 3 * dt);
      if(Math.random() < 0.08) spawnParticles(e.x, e.y - e.h - 40, 2, {color:'#b6ff8a', angle:-Math.PI/2, spread:0.9, spMin:20, spMax:70, lifeMin:0.2, lifeMax:0.5, sizeMin:2, sizeMax:4, grav:-40});
      continue;
    }

    const dx = p.x-e.x, dy = p.y-e.y, adx = Math.abs(dx), ady = Math.abs(dy);
    e.facing = dx>0?1:-1;
    e.atkCd -= dt; e.skillCd -= dt;
    /* ★ 敌人内力回复：之前完全没有回蓝，怪放四五次技能后永久哑火 */
    if(e.mp < e.maxMp){
      e.mp = Math.min(e.maxMp, e.mp + (e.def.boss ? 9 : 5) * dt);
    }
    /* ★ 词条：再生 */
    if(e.affix === 'regen' && e.hp < e.maxHp) e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.012 * dt);

    const maxDist = VW*0.4;
    let moveSpeed = e.def.spd;
    if(adx > maxDist){ const mul = 1+Math.min((adx-maxDist)/maxDist, 0.8); moveSpeed = e.def.spd*mul; }
    
    /* ★ Boss AI增强：更聪明的行为模式 */
    const isBoss = e.def.boss;
    
    /* ★ 敌人AI多样化：根据敌人类型采用不同行为模式 */
    const enemyType = e.def.weapon;
    const isRanged = e.def.ranged || enemyType === 'spear';
    const isAssassin = e.def.spd > 120 && enemyType === 'blade';
    const isTank = e.def.hp > 200;
    
    if(!e.action){
      if(isBoss){
        /* ★ Boss专属AI：更聪明、更 aggressive */
        const bossPhase = e.hp / e.maxHp; // 血量阶段：1.0=满血，0=死亡
        
        /* 移动策略：根据距离和血量阶段调整。
           ★ 关键：接近/后退的边界必须直接锚定 reach，否则 BOSS 会停在打不到人的距离上干瞪眼 */
        const _reach = e.def.reach;
        const idealDist = Math.max(60, _reach * (bossPhase > 0.5 ? 0.60 : 0.44));
        const _farLine = _reach * 0.86;      /* 超过这条线就压上去 */
        const _nearLine = Math.max(40, _reach * 0.30);  /* 比这条线还近就往后退 */

        if(adx > _farLine){
          /* 距离太远，快速接近 */
          e.x += Math.sign(dx)*moveSpeed*1.25*dt;
          if(ady > 8) e.y += Math.sign(dy)*moveSpeed*0.9*dt;
        } else if(adx < _nearLine){
          /* 距离太近，根据情况后退或绕圈 */
          if(Math.random() < 0.3){
            /* 绕圈移动 */
            const circleAngle = Math.atan2(dy, dx) + Math.PI/2;
            e.x += Math.cos(circleAngle)*moveSpeed*0.8*dt;
            e.y += Math.sin(circleAngle)*moveSpeed*0.6*dt;
          } else {
            /* 后退 */
            e.x -= Math.sign(dx)*moveSpeed*0.6*dt;
          }
        } else {
          /* 已经在攻击距离内：对齐纵向，别乱漂 */
          if(ady > 12) e.y += Math.sign(dy)*moveSpeed*0.8*dt;
        }
        
        /* Boss格挡：更频繁 */
        if(!e.blocking && Math.random() < 0.003 && adx < e.def.reach*1.5){
          e.blocking = 1.0;
        }
        
      } else if(isRanged){
        /* 远程敌人：保持距离，拉开后射击 */
        const idealDist = 240;
        if(adx < idealDist - 70){
          /* 太近，后退 */
          e.x -= Math.sign(dx)*moveSpeed*dt;
        } else if(adx > idealDist + 90){
          /* 太远，靠近 */
          e.x += Math.sign(dx)*moveSpeed*dt;
        }
        if(ady > 8) e.y += Math.sign(dy)*moveSpeed*0.7*dt;
        /* ★ 补上射击：原先这个分支只走位不开火，长兵器怪全程站着不动 */
        if(e.atkCd <= 0 && adx < 440 && ady < 90){
          e.atkCd = rand(1.05, 1.65);
          e.action = {type:'attack', t:0, dur:0.5, hitAt:0.4, hitDone:true};
          const _ang = Math.atan2((p.y-e.y)*2.0, p.x-e.x);
          setTimeout(()=>{
            if(!G || gameState!=='playing' || !e.alive || !G.player) return;
            G.projectiles.push({kind:'enemyShot', x:e.x, y:e.y-46, h:46,
              vx:Math.cos(_ang)*620, vy:Math.sin(_ang)*310, life:1.4, w:34, hh:34,
              dmg:e.atk*0.95, pierce:0, hitSet:new Set(), color:'#7fe0b0',
              facing:e.facing, owner:e, enemy:true, trail:true, rot:_ang});
            playSound('arrow');
          }, 170);
        }
      } else if(isAssassin){
        /* 刺客型：绕后偷袭 */
        const flankAngle = Math.atan2(dy, dx) + (e.facing > 0 ? -0.8 : 0.8);
        if(adx > e.def.reach * 0.8){
          /* 接近目标，但尝试绕到侧面或后方 */
          e.x += Math.sign(dx)*moveSpeed*dt;
          e.y += Math.sign(dy)*moveSpeed*0.9*dt;
        } else if(adx < e.def.reach * 0.5){
          /* 已接近，发动攻击 */
          if(e.atkCd <= 0 && ady < 50){
            e.atkCd = rand(0.8, 1.2);
            e.action = {type:'attack', t:0, dur:0.35, hitAt:0.4, hitDone:false};
          }
        }
      } else if(isTank){
        /* 坦克型：缓慢逼近，偶尔格挡 */
        if(adx > e.def.reach * 0.7){
          e.x += Math.sign(dx)*moveSpeed*0.8*dt;
          if(ady > 8) e.y += Math.sign(dy)*moveSpeed*0.6*dt;
        }
        /* 格挡机制：玩家攻击时有概率格挡 */
        if(!e.blocking && Math.random() < 0.001 && adx < e.def.reach){
          e.blocking = 0.8; /* 格挡持续0.8秒 */
        }
      } else {
        /* 普通近战：直接追击 */
        if(adx > e.def.reach*0.6) e.x += Math.sign(dx)*moveSpeed*dt;
        if(ady > 8) e.y += Math.sign(dy)*moveSpeed*0.7*dt;
      }
    }
    /* ★ 修复：敌人不能跑到画面左侧可见范围之外 */
    const camLeft = (G.camera) ? G.camera.x : 0;
    const enemyLeftBound = Math.max(WORLD_L, camLeft - 60);
    e.x = clamp(e.x, enemyLeftBound, enemyMaxX); e.y = clamp(e.y, GY_TOP+20, GY_BOTTOM-10); e.walkPhase += dt*9;

    /* ★ Boss技能释放：使用Boss专属技能 */
    if(e.skillCd <= 0 && !e.action && e.mp >= 20 && adx < 500 && ady < 120){
      /* ★ Boss专属技能系统 */
      if(isBoss && BOSS_SKILLS[e.typeKey]){
        const bossSkillList = BOSS_SKILLS[e.typeKey];
        const skIdx = Math.floor(Math.random()*bossSkillList.length);
        const skFunc = bossSkillList[skIdx];
        e.mp -= 25;
        e.action = {type:'enemySkill', t:0, dur:2.0, hitAt:0.99, hitDone:false, isBossSkill:true};
        e.skillCd = rand(2.2, 3.6);
        playSound('enemySkill');
        currentSkillCaster = e;
        try { skFunc(); } catch(err){}
        currentSkillCaster = null;
        /* Boss低血量连招 */
        if(e.hp / e.maxHp < 0.4 && Math.random() < 0.5){
          setTimeout(()=>{
            if(!G || gameState!=='playing' || !e.alive || e.action) return;
            const skIdx2 = Math.floor(Math.random()*bossSkillList.length);
            const skFunc2 = bossSkillList[skIdx2];
            e.mp -= 20;
            e.action = {type:'enemySkill', t:0, dur:1.8, hitAt:0.99, hitDone:false, isBossSkill:true};
            spawnText(e.x, e.y, 180, '连击！', '#ff4444', 28);
            addEffect('enemyCastRing', e.x, e.y, 0.8, {color:'#ff4444'});
            currentSkillCaster = e;
            try { skFunc2(); } catch(err){}
            currentSkillCaster = null;
          }, 900);
        }
      } else {
        /* 普通敌人：使用通用技能 */
        const _wid = (e.def.weapon==='blade'||e.def.weapon==='sword'||e.def.weapon==='spear'||e.def.weapon==='fist') ? e.def.weapon : null;
        if(_wid){
          const _widx = {sword:0, blade:1, spear:2, fist:3}[_wid];
          const _skIdx = Math.floor(Math.random()*3);
          const _sk = WEAPONS[_widx].skills[_skIdx];
          if(e.mp >= _sk.cost){
            e.mp -= _sk.cost;
            e.action = {type:'enemySkill', t:0, dur:1.5, hitAt:0.3, hitDone:false, isWeaponSkill:true, weaponId:_wid, skillIdx:_skIdx};
            e.skillCd = rand(4, 7.5);
            playSound('enemySkill');
            const _enemySkillNames = {sword:'三连斩', blade:'冲锋斩', spear:'远程刺', fist:'气功波'};
            spawnText(e.x, e.y, 160, _enemySkillNames[_wid]||'技能', WEAPONS[_widx].color, 22);
            addEffect('enemyCastRing', e.x, e.y, 1.0, {color:WEAPONS[_widx].color});
          } else { e.skillCd = rand(2, 4); }
        } else {
          e.skillCd = rand(4, 7); e.mp -= 20;
          e.action = {type:'enemySkill', t:0, dur:1.2, hitAt:0.6, hitDone:false};
          playSound('enemySkill');
          spawnText(e.x, e.y, 150, '释放技能!', '#ffaa00', 20);
          addEffect('enemyCastRing', e.x, e.y, 1.2, {color:'#ff3300'});
        }
      }
    }
    
    /* ★ 普攻：缩短冷却、放宽纵向判定，让怪真的会打人。
       ★ 攻击队形：同时出手的怪最多 3 只，避免一拥而上躲无可躲，也避免全员排队发呆。 */
    let _attackers = 0;
    for(const o of G.enemies){ if(o !== e && o.alive && o.action && o.action.type === 'attack') _attackers++; }
    const _canSwing = _attackers < 3 || isBoss;
    if(!e.action && _canSwing && e.atkCd <= 0 && adx < e.def.reach && ady < 62){
      e.atkCd = isBoss ? rand(0.45, 0.8) : (e.affix === 'elite' ? rand(0.6, 0.95) : rand(0.85, 1.35));
      e.action = {type:'attack', t:0, dur:isBoss ? 0.3 : 0.4, hitAt:0.5, hitDone:false};
      /* 出手瞬间转向玩家，避免因走位漂移打空 */
      e.facing = (p.x - e.x) >= 0 ? 1 : -1;

      /* Boss连击：低血量时普攻也可能连续多次 */
      if(isBoss && e.hp / e.maxHp < 0.3 && Math.random() < 0.4){
        setTimeout(()=>{
          if(!G || gameState!=='playing' || !e.alive || e.action) return;
          e.atkCd = 0;
        }, 400);
      }
    }
    if(e.action){
      e.action.t += dt;
      if(e.action.type === 'attack'){
        if(!e.action.hitDone && e.action.t >= e.action.dur*e.action.hitAt){
          e.action.hitDone = true;
          if(Math.abs(p.x-e.x) < e.def.reach+20 && Math.abs((p.y-e.y)*2.2) < 56 && (Math.sign(p.x-e.x)===e.facing || p.x===e.x)) damagePlayer(e.atk);
        }
      } else if(e.action.type === 'enemySkill'){
        if(!e.action.hitDone && e.action.t >= e.action.dur*e.action.hitAt){
          e.action.hitDone = true;
          if(e.action.isBossSkill){
            /* Boss专属技能已在触发时立即执行，这里只做清理 */
          } else if(e.action.isWeaponSkill){
            const _widx = {sword:0, blade:1, spear:2, fist:3}[e.action.weaponId];
            const origW = e.weaponIdx, origAtk = e.atk;
            e.weaponIdx = _widx;
            e.atk = e.def.atk * (G.currentAtkMul||1.0);
            currentSkillCaster = e;
            try { ENEMY_SKILL_FUNCS[e.action.weaponId][e.action.skillIdx](); } catch(err){}
            currentSkillCaster = null;
            e.weaponIdx = origW; e.atk = origAtk;
          }
        }
      }
      if(e.action.t >= e.action.dur) e.action = null;
    }
  }
  G.enemies = G.enemies.filter(e => e.alive || e.deathT < 1.2);

  if(G.traps){
    for(const trap of G.traps){
      if(!trap.active) continue;
      const dx = p.x-trap.x, dy = (p.y-trap.y)*2.2, dist = Math.sqrt(dx*dx+dy*dy);
      if(trap.type === 'spike' && dist < 40 && !trap.triggered){
        trap.triggered = true; trap.timer = 0.5;
        if(p.invuln <= 0){ damagePlayer(trap.dmg); spawnText(p.x, p.y, 100, '地刺！', '#ff4444', 20); }
      } else if(trap.type === 'pit' && dist < 50 && !trap.triggered){
        trap.triggered = true;
        if(p.invuln <= 0){ p.h = -30; p.vy = 0; damagePlayer(trap.dmg*0.5); spawnText(p.x, p.y, 100, '落坑！', '#8844ff', 20); setTimeout(()=>{ if(p) p.h = 0; }, 800); }
      } else if(trap.type === 'rollingStone' && dist < 200 && !trap.triggered){
        trap.triggered = true; trap.vx = (p.x>trap.x?1:-1)*400; trap.vy = 0;
      } else if(trap.type === 'dartTrap' && dist < 250 && !trap.triggered){
        trap.triggered = true; trap.timer = 0;
        for(let i=0;i<3;i++){
          setTimeout(()=>{
            if(!G || gameState!=='playing') return;
            const angle = Math.atan2(p.y-trap.y, p.x-trap.x);
            G.projectiles.push({ kind:'dart', x:trap.x, y:trap.y, h:30, vx:Math.cos(angle)*600, vy:Math.sin(angle)*300, life:1.5, w:20, hh:20, dmg:trap.dmg*0.8, pierce:0, hitSet:new Set(), color:'#888', facing:Math.cos(angle)>0?1:-1, rot:angle, owner:null, enemy:true });
          }, i*150);
        }
        spawnText(trap.x, trap.y, 50, '暗器！', '#ff8800', 18);
      } else if((trap.type==='box'||trap.type==='barrel') && dist < 45){
        if(p.action && p.action.type==='attack' && !trap.triggered){
          trap.hp -= p.atk*0.5; trap.triggered = true;
          setTimeout(()=>{ trap.triggered = false; }, 200);
          if(trap.hp <= 0){
            trap.active = false;
            spawnText(trap.x, trap.y, 50, '破坏！', '#ffaa00', 16);
            if(Math.random() < 0.3){ p.hp = Math.min(p.maxHp, p.hp+20); spawnText(p.x, p.y, 100, '+20HP', '#00ff00', 18); }
          }
        }
      }
      if(trap.type === 'rollingStone' && trap.triggered){
        trap.x += (trap.vx||0)*dt; trap.timer = (trap.timer||0)+dt;
        const rdx = p.x-trap.x, rdy = (p.y-trap.y)*2.2;
        if(Math.sqrt(rdx*rdx+rdy*rdy) < 50 && p.invuln <= 0){
          damagePlayer(trap.dmg*1.5); p.kx = Math.sign(p.x-trap.x)*80;
          spawnText(p.x, p.y, 100, '滚石！', '#aa6633', 24); trap.active = false;
        }
        if(trap.timer > 3) trap.active = false;
      }
      if(trap.type === 'spike' && trap.triggered){
        trap.timer -= dt; if(trap.timer <= 0) trap.triggered = false;
      }
    }
    G.traps = G.traps.filter(t => t.active || t.type === 'pit');
  }

  /* ★★★ 关键修复：投射物删除边界改世界坐标；移动/寿命用 rawDt（不受 hitstop 减速） ★★★ */
  const camX = (G.camera) ? G.camera.x : 0;
  const projLeftLimit  = G.isPvp ? -300 : (camX - 800);
  const projRightLimit = G.isPvp ? (VW + 300) : (camX + VW + 800);
  
  for(let i=G.projectiles.length-1; i>=0; i--){
    if(gameState === 'stageClear') break; // 通关结算时投射物冻结
    const pr = G.projectiles[i];
    
    /* ★ 佛怒火莲光球特殊逻辑：黏住敌人后爆炸 */
    if(pr.isFireOrb){
      if(pr.stuckToEnemy){
        /* 已黏住敌人：跟随敌人移动 */
        const stuckEnemy = pr.stuckToEnemy;
        /* ★ 修复: PvP玩家没有alive属性，用dead判断 */
        const isDead = stuckEnemy.isPlayer ? stuckEnemy.dead : !stuckEnemy.alive;
        if(isDead){
          /* 敌人死亡，光球消失 */
          G.projectiles.splice(i,1);
          continue;
        }
        /* 更新光球位置到敌人身上 */
        pr.x = stuckEnemy.x + Math.sin(G.t*10+pr.orbIndex)*15;
        pr.y = stuckEnemy.y - 60 + Math.cos(G.t*8+pr.orbIndex)*10;
        
        /* 爆炸计时器 */
        pr.explodeTimer -= rawDt;
        if(pr.explodeTimer <= 0){
          /* 触发爆炸！ */
          const flameColors = ['#3366ff','#ff3300','#33cc33','#ffcc00','#cc33ff','#ff6600'];
          const projSrc = pr.owner || p;
          const atkVal = projSrc.atk * WEAPONS[projSrc.weaponIdx].atkMul;
          const explodeX = stuckEnemy.x;
          const explodeY = stuckEnemy.y;
          
          playSound('explosion');
          
          /* 范围伤害 */
          const explosionRadius = 180 + pr.explodeCount * 40;
          const explosionDmg = atkVal * (3.0 + pr.explodeCount * 1.2);
          meleeAoe(projSrc, explodeX, explodeY, explosionRadius, explosionDmg, {kb:300+pr.explodeCount*100, launch:pr.explodeCount===2});
          
          /* 爆炸特效 - 优化版：减少敌人身上亮度，保留外部粒子 */
          const orbColor = pr.color || flameColors[pr.orbIndex % flameColors.length];
          const explodeScale = 1.0 + pr.explodeCount * 0.3;
          
          /* 大朵七彩莲花效果（在敌人身上） */
          addEffect('lotusBurst', explodeX, explodeY-40, 0.8+pr.explodeCount*0.2, {
            r: 60 + pr.explodeCount*15,
            colors: flameColors,
            rotateSpeed: 8 + pr.explodeCount*2
          });
          
          /* 外部冲击波（不在敌人身上） */
          for(let ring=0; ring<2+pr.explodeCount; ring++){
            setTimeout(()=>{
              if(!G || gameState!=='playing') return;
              addEffect('hitRing', explodeX, explodeY-20, 0.4+ring*0.08, {
                color: ring%2===0 ? orbColor : flameColors[(pr.orbIndex+ring)%flameColors.length],
                r: 80 + ring*40 + pr.explodeCount*20
              });
            }, ring*80);
          }
          
          /* 外部七色粒子（减少数量，向外扩散） */
          const particleCount = 20 + pr.explodeCount * 10;
          for(let j=0;j<particleCount;j++){
            const angle = rand(0, TAU);
            const speed = rand(150, 400 + pr.explodeCount*100);
            const pColor = flameColors[j % flameColors.length];
            /* 粒子从敌人外围开始，不在敌人身上 */
            const startDist = 40 + rand(10, 30);
            const startX = explodeX + Math.cos(angle) * startDist;
            const startY = explodeY - 30 + Math.sin(angle) * startDist * 0.5;
            setTimeout(()=>{
              if(!G || gameState!=='playing') return;
              spawnParticles(startX, startY, 2, {
                color: pColor,
                angle:angle, spread:0.8,
                spMin:speed*0.5, spMax:speed,
                lifeMin:0.4, lifeMax:0.9,
                sizeMin:3, sizeMax:6+pr.explodeCount*2,
                grav:200
              });
            }, j*12);
          }
          
          /* 外部火焰粒子（向上飘散，不在敌人身上） */
          for(let j=0;j<8+pr.explodeCount*4;j++){
            const colAngle = -Math.PI/2 + rand(-0.4, 0.4);
            const colSpeed = rand(200, 500 + pr.explodeCount*150);
            const startDist = 35 + rand(5, 20);
            const startAngle = rand(0, TAU);
            const startX = explodeX + Math.cos(startAngle) * startDist;
            const startY = explodeY - 25 + Math.sin(startAngle) * startDist * 0.4;
            setTimeout(()=>{
              if(!G || gameState!=='playing') return;
              spawnParticles(startX, startY, 2, {
                color: flameColors[j%flameColors.length],
                angle:colAngle, spread:0.3,
                spMin:colSpeed*0.5, spMax:colSpeed,
                lifeMin:0.4, lifeMax:1.0,
                sizeMin:3, sizeMax:7+pr.explodeCount*2,
                grav:-100
              });
            }, j*20);
          }
          
          /* 闪电弧光（第三次爆炸，在外围） */
          if(pr.explodeCount >= 1){
            for(let j=0;j<4+pr.explodeCount*2;j++){
              const arcAngle = j*(TAU/(4+pr.explodeCount*2));
              const arcStartDist = 50;
              const arcEndDist = rand(80, 140 + pr.explodeCount*30);
              const arcStartX = explodeX + Math.cos(arcAngle)*arcStartDist;
              const arcStartY = explodeY - 30 + Math.sin(arcAngle)*arcStartDist*0.4;
              const arcEndX = explodeX + Math.cos(arcAngle)*arcEndDist;
              const arcEndY = explodeY - 20 + Math.sin(arcAngle)*arcEndDist*0.3;
              setTimeout(()=>{
                if(!G || gameState!=='playing') return;
                addEffect('lightning', arcStartX, arcStartY, 0.3, {
                  endX:arcEndX, endY:arcEndY,
                  color: flameColors[(pr.orbIndex+j)%flameColors.length],
                  width: 2+pr.explodeCount
                });
              }, j*40);
            }
          }
          
          /* 屏幕震动 - 适度 */
          G.shake = Math.max(G.shake, 12+pr.explodeCount*8);
          G.flash = Math.max(G.flash, 0.15+pr.explodeCount*0.1);
          G.hitFlashColor = orbColor;
          G.hitstop = Math.max(G.hitstop, 0.1+pr.explodeCount*0.05);
          
          /* 第三次爆炸：莲花绽放 */
          if(pr.explodeCount === 2){
            playSound('thunder');
            setTimeout(()=>{
              if(!G || gameState!=='playing') return;
              /* 大型莲花绽放效果 */
              addEffect('lotusBurst', explodeX, explodeY-50, 1.2, {
                r: 100,
                colors: flameColors,
                rotateSpeed: 12
              });
              /* 外部粒子爆发（减少数量） */
              for(let j=0;j<30;j++){
                const a = j*(TAU/30);
                const spd = rand(300, 700);
                const startDist = 50;
                spawnParticles(
                  explodeX + Math.cos(a)*startDist,
                  explodeY - 30 + Math.sin(a)*startDist*0.4,
                  2, {
                    color: flameColors[j%flameColors.length],
                    angle:a, spread:0.4,
                    spMin:spd*0.5, spMax:spd,
                    lifeMin:0.5, lifeMax:1.0,
                    sizeMin:3, sizeMax:8,
                    grav:300
                  }
                );
              }
              /* 外部冲击波 */
              for(let ring=0;ring<3;ring++){
                setTimeout(()=>{
                  if(!G || gameState!=='playing') return;
                  addEffect('hitRing', explodeX, explodeY-20, 0.5, {
                    color: ring%3===0?'#fff':ring%3===1?orbColor:flameColors[(ring+2)%flameColors.length],
                    r: 100+ring*40
                  });
                }, ring*60);
              }
              G.shake = Math.max(G.shake, 30);
              G.flash = 0.4;
              G.hitFlashColor = orbColor;
              G.hitstop = Math.max(G.hitstop, 0.2);
            }, 100);
          }
          
          pr.explodeCount++;
          
          if(pr.explodeCount >= 3){
            /* 3次爆炸完成，移除光球 */
            G.projectiles.splice(i,1);
            continue;
          } else {
            /* 设置下一次爆炸的延迟 */
            pr.explodeTimer = 0.5 + pr.explodeCount * 0.2;
          }
        }
      } else {
        /* 未黏住敌人：检测碰撞 */
        const projSrc = pr.owner || p;
        let hitEnemy = null;
        
        if(projSrc.isPlayer){
          for(const e of G.enemies){
            if(!e.alive || (pr.hitSet && pr.hitSet.has(e))) continue;
            if(Math.abs(e.x-pr.x) < pr.w*0.5+e.radius && Math.abs((e.y-pr.y)*2.2) < pr.hh*0.5+e.radius*0.6){
              hitEnemy = e;
              break;
            }
          }
          if(G.isPvp && !hitEnemy){
            const t = projSrc===G.player?G.player2:G.player;
            if(t && !t.dead && t.invuln<=0 && Math.abs(t.x-pr.x) < pr.w*0.5+30 && Math.abs((t.y-pr.y)*2.2) < pr.hh*0.5+25){
              hitEnemy = t;
            }
          }
        }
        
        if(hitEnemy){
          /* 黏住敌人！ */
          pr.stuckToEnemy = hitEnemy;
          pr.explodeTimer = 0.6; /* 第一次爆炸延迟 */
          pr.explodeCount = 0;
          if(pr.hitSet) pr.hitSet.add(hitEnemy);
          
          /* 黏住特效 */
          spawnParticles(hitEnemy.x, hitEnemy.y-50, 12, {color:pr.color, spMin:50, spMax:150, lifeMin:0.2, lifeMax:0.5, sizeMin:3, sizeMax:7, grav:-100});
          addEffect('hitRing', hitEnemy.x, hitEnemy.y-50, 0.3, {color:pr.color, r:30});
          
          /* 停止移动 */
          pr.vx = 0;
          pr.vy = 0;
        }
      }
      /* 飞行中的莲花光球拖尾粒子 */
      if(!pr.stuckToEnemy && (Math.abs(pr.vx) > 10 || Math.abs(pr.vy) > 10)){
        const flameColors = ['#3366ff','#ff3300','#33cc33','#ffcc00','#cc33ff','#ff6600','#00ccff'];
        const trailColor = flameColors[(pr.orbIndex||0) % flameColors.length];
        spawnParticles(pr.x+rand(-8,8), pr.y+rand(-8,8), 2, {
          color: Math.random()>0.5 ? trailColor : '#fff',
          angle: Math.atan2(-pr.vy, -pr.vx)+rand(-0.5,0.5), spread:0.6,
          spMin:30, spMax:120,
          lifeMin:0.2, lifeMax:0.5,
          sizeMin:3, sizeMax:8,
          grav:-80
        });
      }
      
      /* ★ 修复: 佛怒火莲光球智能追踪 - PvP模式追踪对方玩家 */
      if(!pr.stuckToEnemy && pr.life > 0.1){
        const projSrc = pr.owner || p;
        let targetX = null, targetY = null;
        
        if(projSrc.isPlayer){
          /* 玩家的光球：追踪对方玩家或最近敌人 */
          if(G.isPvp){
            const opponent = projSrc===G.player ? G.player2 : G.player;
            if(opponent && !opponent.dead){
              targetX = opponent.x;
              targetY = opponent.y;
            }
          } else {
            /* 单人模式：追踪最近敌人 */
            let bestDist = Infinity;
            for(const e of G.enemies){
              if(!e.alive) continue;
              const d = (e.x-pr.x)*(e.x-pr.x) + (e.y-pr.y)*(e.y-pr.y);
              if(d < bestDist){ bestDist = d; targetX = e.x; targetY = e.y; }
            }
          }
        } else {
          /* 敌人的光球：追踪玩家 */
          const t = G.player;
          if(t && !t.dead){ targetX = t.x; targetY = t.y; }
        }
        
        /* 执行追踪 */
        if(targetX !== null){
          const speed = Math.hypot(pr.vx, pr.vy);
          if(speed > 10){
            const dx = targetX - pr.x, dy = targetY - pr.y;
            const dist = Math.hypot(dx, dy);
            if(dist > 5){
              const desiredVx = (dx/dist) * speed;
              const desiredVy = (dy/dist) * speed;
              const trackStr = 4.5; /* 追踪强度 */
              const trackFactor = Math.min(1, trackStr * rawDt);
              pr.vx = lerp(pr.vx, desiredVx, trackFactor);
              pr.vy = lerp(pr.vy, desiredVy, trackFactor);
            }
          }
        }
      }
    }
    
    /* ★ 智能追踪：技能投射物自动追踪最近敌人；远程普攻粒子追着发射瞬间锁定的敌人初始位置飞 */
    if((pr.lockPos || !pr.noHoming) && pr.life > 0.1 && !pr.isFireOrb){
      const projSrc = pr.owner || (pr.enemy ? { isPlayer:false } : p);
      let targetX = null, targetY = null;
      if(pr.lockPos){
        /* 远程普攻：追踪发射瞬间锁定的敌人初始位置（不随敌人移动而改道） */
        targetX = pr.lockX; targetY = pr.lockY;
      } else if(projSrc.isPlayer){
        /* 玩家投射物：追踪最近存活敌人 */
        let bestDist = Infinity;
        for(const e of G.enemies){
          if(!e.alive) continue;
          if(pr.hitSet && pr.hitSet.has(e)) continue;
          const d = (e.x-pr.x)*(e.x-pr.x) + (e.y-pr.y)*(e.y-pr.y);
          if(d < bestDist){ bestDist = d; targetX = e.x; targetY = e.y; }
        }
        /* PvP模式：也追踪对方玩家 */
        if(G.isPvp){
          const opponent = projSrc===G.player?G.player2:G.player;
          if(opponent && !opponent.dead){
            const d = (opponent.x-pr.x)*(opponent.x-pr.x) + (opponent.y-pr.y)*(opponent.y-pr.y);
            if(d < bestDist){ targetX = opponent.x; targetY = opponent.y; }
          }
        }
      } else {
        /* 敌人投射物：追踪玩家 */
        const t = G.player;
        if(t && !t.dead){ targetX = t.x; targetY = t.y; }
      }
      if(targetX !== null){
        const speed = Math.hypot(pr.vx, pr.vy);
        if(speed > 10){
          const dx = targetX - pr.x, dy = targetY - pr.y;
          const dist = Math.hypot(dx, dy);
          if(dist > 5){
            const desiredVx = (dx/dist) * speed;
            const desiredVy = (dy/dist) * speed;
            const trackStr = pr.homingStr || 3.5; /* 追踪强度 */
            const trackFactor = Math.min(1, trackStr * rawDt);
            pr.vx = lerp(pr.vx, desiredVx, trackFactor);
            pr.vy = lerp(pr.vy, desiredVy, trackFactor);
            /* 更新旋转角度以匹配新方向 */
            if(pr.rot !== undefined) pr.rot = Math.atan2(pr.vy, pr.vx);
            if(pr.facing !== undefined) pr.facing = pr.vx >= 0 ? 1 : -1;
          }
        }
      }
    }
    pr.x += pr.vx * rawDt;                      // ★ 用 rawDt，投射物不被 hitstop 减速
    pr.y += pr.vy * rawDt;
    pr.life -= rawDt;
    if(pr.life <= 0
       || pr.x < projLeftLimit || pr.x > projRightLimit
       || pr.y < GY_TOP-400 || pr.y > GY_BOTTOM+400){
      G.projectiles.splice(i,1); continue;
    }
    if(!pr.enemy && !pr.landed && !pr.isFireOrb){
      let removed = false;
      const projSrc = pr.owner || p;
      if(projSrc.isPlayer){
        for(const e of G.enemies){
          if(!e.alive || (pr.hitSet && pr.hitSet.has(e))) continue;
          if(Math.abs(e.x-pr.x) < pr.w*0.5+e.radius && Math.abs((e.y-pr.y)*2.2) < pr.hh*0.5+e.radius*0.6){
            damageEnemy(e, pr.dmg, projSrc, {kb: pr.kind==='realSpear'?550:200, launch: pr.kind==='realSpear'});
            if(pr.hitSet) pr.hitSet.add(e);
            if(pr.pierce !== undefined){ pr.pierce--; if(pr.pierce < 0) removed = true; } else removed = true;
            break;
          }
        }
        if(removed){ G.projectiles.splice(i,1); continue; }
        if(G.isPvp && !removed){
          const t = projSrc===G.player?G.player2:G.player;
          if(t && !t.dead && t.invuln<=0 && Math.abs(t.x-pr.x) < pr.w*0.5+30 && Math.abs((t.y-pr.y)*2.2) < pr.hh*0.5+25){
            damagePvpPlayer(t, pr.dmg, projSrc, {kb:200});
            if(pr.hitSet) pr.hitSet.add(t);
            if(pr.pierce !== undefined){ pr.pierce--; if(pr.pierce < 0) removed = true; } else removed = true;
          }
          if(removed){ G.projectiles.splice(i,1); continue; }
        }
      } else {
        const t = G.player;
        if(t && !t.dead && t.invuln<=0 && Math.abs(t.x-pr.x) < pr.w*0.5+30 && Math.abs((t.y-pr.y)*2.2) < pr.hh*0.5+25){
          damagePlayer(pr.dmg);
          spawnParticles(t.x, t.y-50, 8, {color:'#ff4444', spMin:80, spMax:200, lifeMin:0.2, lifeMax:0.5, sizeMin:2, sizeMax:4, grav:600});
          if(pr.hitSet) pr.hitSet.add(t);
          if(pr.pierce !== undefined){ pr.pierce--; if(pr.pierce < 0) removed = true; } else removed = true;
        }
        if(removed){ G.projectiles.splice(i,1); continue; }
      }
    }
  }

  for(let i=G.particles.length-1; i>=0; i--){
    const pt = G.particles[i]; pt.life -= dt; if(pt.life <= 0){ G.particles.splice(i,1); continue; }
    pt.vy += pt.grav*dt; pt.x += pt.vx*dt; pt.y += pt.vy*dt; pt.h += pt.vh*dt;
    if(pt.h < 0){ if(pt.isBlood){ pt.life = 0; continue; } pt.h = 0; pt.vh *= -0.3; pt.vx *= 0.5; pt.vy *= 0.5; }
  }
  for(let i=G.texts.length-1; i>=0; i--){
    const t = G.texts[i]; t.t += dt; t.h += 60*dt; t.x += t.vx*dt; t.vx *= 0.95;
    if(t.t >= t.dur) G.texts.splice(i,1);
  }
  for(let i=G.effects.length-1; i>=0; i--){
    const ef = G.effects[i]; ef.t += dt;
    if(ef.t >= ef.dur){ G.effects.splice(i,1); continue; }
    if(ef.follow){ ef.x = ef.follow.x; ef.y = ef.follow.y; }
  }

  for(let i=0;i<6;i++) p.cds[i] = Math.max(0, (p.cds[i]||0)-dt);
  /* ★ Roguelike: 内力回复加成 */
  const mpRegenMul = p.mpRegenMul || 1;
  const mpRate = (G.isPvp ? 1.5 : 5) * mpRegenMul;
  p.mp = Math.min(p.maxMp, p.mp+mpRate*dt);
  if(p.invuln > 0) p.invuln -= dt;
  if(p.hitFlash > 0) p.hitFlash -= dt;
  if(p.hurtT > 0) p.hurtT -= dt;
  if(p.comboWindow > 0) p.comboWindow -= dt;
  if(p.attackBuffer > 0) p.attackBuffer -= dt;

  if(G.isPvp && G.player2 && !G.player2.dead){
    const p2 = G.player2;
    for(let i=0;i<6;i++) p2.cds[i] = Math.max(0, (p2.cds[i]||0)-dt);
    p2.mp = Math.min(p2.maxMp, p2.mp+1.5*dt);
    if(p2.invuln > 0) p2.invuln -= dt;
    if(p2.hitFlash > 0) p2.hitFlash -= dt;
    if(p2.hurtT > 0) p2.hurtT -= dt;
    if(p2.comboWindow > 0) p2.comboWindow -= dt;
    if(p2.attackBuffer > 0) p2.attackBuffer -= dt;
  }

  if(!G.isPvp && p.hp <= 0 && !p.dead){
    p.dead = true;
    /* ★ 有重生丸就先问一句，没有才进结算 */
    if(!(window.REVIVE && REVIVE.ask())) gameState = 'gameover';
  }
  if(G.isPvp){
    if(p.hp <= 0 && !p.dead) p.dead = true;
    if(G.player2 && G.player2.hp <= 0 && !G.player2.dead) G.player2.dead = true;
    if(gameState === 'playing'){
      if(p.dead && G.player2 && G.player2.dead){ gameState = 'pvpEnd'; pvpWinner = 0; }
      else if(p.dead && G.player2 && !G.player2.dead){ gameState = 'pvpEnd'; pvpWinner = 2; }
      else if(!p.dead && G.player2 && G.player2.dead){ gameState = 'pvpEnd'; pvpWinner = 1; }
    }
  }

  updateSkillButtonCD();
  handleInput();
}

