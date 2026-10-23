/* ===== 点击区 ===== */
let menuClickRegions = [], pvpSelectClickRegions = [], pvpEndClickRegions = [], gameoverClickRegions = [];
let charSelectClickRegions = [], pauseClickRegions = [];

function screenToCanvas(cx, cy){
  const r = cvs.getBoundingClientRect();
  return { x: (cx - r.left) * VW / r.width, y: (cy - r.top) * VH / r.height };
}
function hitTestRegion(x, y, regions){
  for(const r of regions) if(x>=r.x && x<=r.x+r.w && y>=r.y && y<=r.y+r.h) return r;
  return null;
}

/* ★ 指针位置（装备详情卡悬停用） */
const MOUSE = { x:-999, y:-999, in:false };
cvs.addEventListener('pointermove', function(e){
  const q = screenToCanvas(e.clientX, e.clientY);
  MOUSE.x = q.x; MOUSE.y = q.y; MOUSE.in = true;
});
cvs.addEventListener('pointerdown', function(e){
  const q = screenToCanvas(e.clientX, e.clientY);
  MOUSE.x = q.x; MOUSE.y = q.y; MOUSE.in = true;
});
cvs.addEventListener('pointerleave', function(){ MOUSE.in = false; MOUSE.x = -999; MOUSE.y = -999; });

/* ★ 每帧重建：可弹出详情卡的装备区域 */
let equipHoverRegions = [];
function handleCanvasClick(cx, cy){
  initAudio();
  const pos = screenToCanvas(cx, cy);
  /* ★ 剧情对话：点击任意位置继续 */
  if(DIALOGUE){ advanceDialogue(); return; }
  
  /* 战斗中点击背包按钮 / 药水按钮 */
  if(gameState === 'playing'){
    const bagBtnX = 40, bagBtnY = VH / 2;
    if(Math.hypot(pos.x - bagBtnX, pos.y - bagBtnY) < 25){
      G.inventoryReturnState = 'playing';
      gameState = 'inventory';
      return;
    }
    /* ★ 点红 / 蓝药水瓶 = 喝一瓶 */
    if(typeof hitPotionBtn === 'function'){
      const kind = hitPotionBtn(pos.x, pos.y);
      if(kind){ if(typeof drinkPotion === 'function') drinkPotion(kind); return; }
    }
  }
  
  /* 城镇中点击NPC交互 */
  if(gameState === 'town'){
    /* 任务追踪收起/展开按钮 */
    const qt = hitTestRegion(pos.x, pos.y, questTrackerClickRegions || []);
    if(qt && qt.id === 'toggle'){ questTrackerCollapsed = !questTrackerCollapsed; return; }
    /* 左侧功能按钮（与绘制共用同一份区域数据） */
    const b = hitTestRegion(pos.x, pos.y, townSideBtnRegions || []);
    if(b && b.id){
      if(b.id === 'inventory'){ G.inventoryReturnState = 'town'; gameState = 'inventory'; }
      else if(b.id === 'skillMenu') gameState = 'skillMenu';
      else if(b.id === 'characterInfo') gameState = 'characterInfo';
      else if(b.id === 'questMenu'){ questReturnState = 'town'; gameState = 'questMenu'; }
      else if(b.id === 'auction'){ if(window.AUCTION) AUCTION.open(); }
      return;
    }
    
    // NPC点击检测（大地图：点击坐标加镜头偏移，全地图生效）
    {
      const wx = pos.x + (townCam ? townCam.x : 0);
      const wy = pos.y + (townCam ? townCam.y : 0);
      for(const npc of NPCS){
        // 矩形点击区域：覆盖NPC整个身体（宽100px，高240px）
        if(wx > npc.x - 50 && wx < npc.x + 50 &&
           wy > npc.y - 230 && wy < npc.y + 16){
          // 走到NPC身旁并触发交互
          if(townPlayer){
            townPlayer.x = Math.max(60, npc.x - 90);
            townPlayer.y = Math.min(TOWN_H - 70, npc.y + 46);
            townPlayer.facing = 1;
          }
          triggerNpc(npc);
          return;
        }
      }
    }
  }
  
  if(gameState==='menu'){
    const r = hitTestRegion(pos.x, pos.y, menuClickRegions);
    if(r){
      if(r.id==='single' || r.id==='start'){
        /* 单人冒险：已有角色先弹「选择角色」，没有角色直接进职业选择 */
        if(window.CHARS && window.CHARS.count() > 0){
          window.CHARS.openPanel();
        } else {
          charSelectState.phase = 'single';
          charSelectState.step = 0;
          charSelectState.selections = [0, 0];
          gameState = 'charSelect';
        }
      } else if(r.id==='pvp'){
        /* 双人PK：进入职业选择，选完后打AI */
        charSelectState.phase = 'pvp';
        charSelectState.step = 0;
        charSelectState.selections = [0, 0];
        gameState = 'charSelect';
        pvpFromMenu = true;
      }
    }
  } else if(gameState==='charSelect'){
    const r = hitTestRegion(pos.x, pos.y, charSelectClickRegions);
    if(r){
      if(r.id==='char'){
        charSelectState.selections[charSelectState.step] = r.index;
      } else if(r.id==='confirm'){
        if(charSelectState.phase==='single'){
          /* 单人模式：开始游戏 */
          startSingleWithChar(charSelectState.selections[0]);
        } else {
          /* PvP双人：玩家1选完，玩家2选 */
          if(charSelectState.step===0){
            charSelectState.step = 1;
          } else {
            startPvpWithChar(charSelectState.selections[0], charSelectState.selections[1]);
          }
        }
      } else if(r.id==='back'){
        gameState = 'menu';
      }
    }
  } else if(gameState==='nameInput'){
    const r = hitTestRegion(pos.x, pos.y, nameInputClickRegions);
    if(r && r.confirm){
      // 确认按钮：先查角色名是否重复，再开始游戏
      const nm = (playerName || '').trim() || '无名侠客';
      const goOn = function(){
        if(!playerName) playerName = nm;
        G.playerName = playerName;
        try{ if(window.CloudSave && window.CloudSave.arm) window.CloudSave.arm(); }catch(e){}
        initTown();
        gameState = 'town';
        startBGM();
        nameInputBox.blur();
        maybeShowPrologue();
      };
      if(window.CHARS && window.CHARS.createFromNaming){
        window.CHARS.createFromNaming(nm, charSelectState.selections[0], goOn);
      } else {
        goOn();
      }
    } else {
      // 点击输入框区域时重新聚焦
      nameInputBox.focus();
    }
  } else if(gameState==='pvpSelect'){
    const r = hitTestRegion(pos.x, pos.y, pvpSelectClickRegions);
    if(r){
      if(pvpState==='select1'){
        if(r.id==='weapon') pvpSelect[0] = r.index;
        else if(r.id==='confirm') pvpState = 'select2';
      } else {
        if(r.id==='weapon') pvpSelect[1] = r.index;
        else if(r.id==='fight') startPvpFight();
      }
    }
  } else if(gameState==='pvpEnd'){
    const r = hitTestRegion(pos.x, pos.y, pvpEndClickRegions);
    if(r && r.id==='back'){
      if(!pvpFromMenu){
        /* 守门人试炼结束：无条件回到城镇，并清理对战残留状态 */
        restoreSingleGIfNeeded();
        if(G && G.player){ G.player.hp = G.player.maxHp; }
        gameState = 'town';
        if(window.showTouchControls) window.showTouchControls(false);
      } else {
        /* 主菜单双人PK结束：返回主菜单 */
        gameState = 'menu';
        stopBGM();
        if(window.hideTouchControls) window.hideTouchControls();
      }
    }
  } else if(gameState==='gameover' || gameState==='win'){
    const r = hitTestRegion(pos.x, pos.y, gameoverClickRegions);
    if(r && r.id==='back'){ restoreSingleGIfNeeded(); gameState = 'town'; }
  } else if(gameState==='levelSelect'){
    const r = hitTestRegion(pos.x, pos.y, levelSelectClickRegions);
    if(r){
      if(r.levelIdx === -1){
        gameState = 'town';
      } else if(r.difficulty){
        G.currentDifficulty = r.difficulty;
      } else if(typeof r.levelIdx === 'number'){
        startLevel(r.levelIdx);
      }
    }
  } else if(gameState==='dungeonSelect'){
    const r = hitTestRegion(pos.x, pos.y, dungeonSelectClickRegions);
    if(r){
      if(r.action === 'dungeon'){
        gameState = 'levelSelect';
      } else if(r.action === 'pvp'){
        /* 守门人PK：用当前角色等级装备 vs AI对手 */
        startGatekeeperPvp();
      } else if(r.action === 'back'){
        gameState = 'town';
      }
    }
  } else if(gameState==='shopMenu'){
    const r = hitTestRegion(pos.x, pos.y, shopClickRegions);
    if(r){
      if(r.switchTab){
        shopTab = r.switchTab;
        shopSelectedIndex = -1;
        shopListScroll = 0;
      } else if(typeof r.selectSellItem === 'number'){
        shopSelectedIndex = r.selectSellItem;
      } else if(typeof r.sellItem === 'number'){
        // 出售物品
        const p = G.player;
        if(p.inventory && p.inventory[r.sellItem]){
          const eq = p.inventory[r.sellItem];
          /* ★ 系统赠送的飞行道具不可出售 */
          if(eq.sysGift){
            shopSelectedIndex = -1;
            spawnText(townPlayer.x, townPlayer.y - 80, 60, '系统赠送物品不可出售', '#ff6a4a', 16);
          } else {
            const sellPrice = calcSellPrice(eq);
            p.gold = (p.gold || 0) + sellPrice;
            p.inventory.splice(r.sellItem, 1);
            shopSelectedIndex = -1;
            spawnText(townPlayer.x, townPlayer.y - 80, 60, `出售获得 ${sellPrice} 金币`, '#ffd700', 16);
          }
        }
      } else if(r.locked){ /* 等级不足的装备，无响应 */ }
      else if(!r.item){ gameState = 'town'; shopTab = 'buy'; shopSelectedIndex = -1; }
      else { buyItem(r.item); }
    }
  } else if(gameState==='stageClear'){
    const r = hitTestRegion(pos.x, pos.y, stageClearClickRegions);
    if(r){
      if(typeof r.flipCard === 'number' && stageClearData && stageClearData.cardsFlipped){
        // 翻开卡牌：只能翻 1 张（获得奖励），随后另外 2 张自动亮出
        if(!stageClearData.cardsFlipped[r.flipCard]){
          stageClearData.cardsFlipped[r.flipCard] = true;
          stageClearData.chosenCard = r.flipCard;
          /* ★ 发放选中卡牌的奖励（奖励延迟到翻牌时才给） */
          grantCardReward(stageClearData.cards[r.flipCard]);
          /* ★ 另外 2 张自动亮出，仅展示「你错过的奖励」，不发放 */
          for(let i = 0; i < 3; i++){
            if(i !== r.flipCard) stageClearData.cardsFlipped[i] = true;
          }
          stageClearData.allCardsFlipped = true;
          // 播放翻牌音效
          if(audioCtx && audioCtx.state === 'running'){
            const t = audioCtx.currentTime;
            const osc = audioCtx.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(400, t);
            osc.frequency.exponentialRampToValueAtTime(800, t + 0.15);
            const gain = audioCtx.createGain();
            gain.gain.setValueAtTime(0.2, t);
            gain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
            osc.connect(gain); gain.connect(audioCtx.destination);
            osc.start(t); osc.stop(t + 0.2);
          }
        }
      } else if(r.action === 'continueQuest'){
        // ★ 继续任务：不返回城镇，直接重新进入当前地图
        stageClearData = null;
        startLevel(G.levelIdx);
      } else if(!r.flipCard && r.flipCard !== 0){
        // 返回城镇（非翻牌按钮）：回到进本前的位置，不乱传送
        gameState = 'town';
        if(townPlayer){
          townCam.x = clamp(townPlayer.x - VW/2, 0, Math.max(0, TOWN_W - VW));
          townCam.y = clamp(townPlayer.y - VH/2, 0, Math.max(0, TOWN_H - VH));
        }
      }
    }
  } else if(gameState==='inventory'){
    const r = hitTestRegion(pos.x, pos.y, inventoryClickRegions);
    if(r){
      const p = G.player;
      if(r.close){
        // 从战斗或城镇打开的背包，返回到对应界面
        gameState = G && G.inventoryReturnState ? G.inventoryReturnState : 'town';
        G.inventoryReturnState = null;
      } else if(r.tab){
        inventoryTab = r.tab;
        inventorySelectedIndex = -1;
      } else if(typeof r.selectIndex === 'number'){
        // 点击选中装备
        inventorySelectedIndex = r.selectIndex;
      } else if(r.selectMaterial){
        // 点击选中材料
        selectedMaterial = r.selectMaterial;
      } else if(r.wearSelected && inventorySelectedIndex >= 0){
        // 穿戴选中的装备
        const eq = p.inventory[inventorySelectedIndex];
        if(eq){
          /* ★ 未开封：先花钱开封才能穿（DNF 的封装装备） */
          if(eq.sealed){
            const cost = unsealCost(eq);
            if(!confirm('「' + eq.name + '」还是未开封状态。\n\n开封后才能穿戴，开封后不可再上架交易行。\n开封费用：' + cost + ' 金币（当前 ' + (p.gold || 0) + '）')) return;
            if((p.gold || 0) < cost){
              inventoryMessage = '金币不足，开封需要 ' + cost + ' 金币';
              inventoryMessageTimer = 120;
              return;
            }
            p.gold -= cost;
            eq.sealed = false;
            if(typeof toast === 'function') toast('已开封：' + eq.name, '#7fe0a0');
          }
          // 检查装备等级限制
          if(eq.level > (p.level || 1)){
            inventoryMessage = `装备等级过高！需要Lv.${eq.level}，当前Lv.${p.level || 1}`;
            inventoryMessageTimer = 120;
            inventorySelectedIndex = -1;
            return;
          }
          // 检查武器职业限制
          if(eq.slot === 'weapon'){
            const playerWeaponType = WEAPONS[p.weaponIdx || 0] ? WEAPONS[p.weaponIdx || 0].id : 'sword';
            if(eq.weaponType !== playerWeaponType){
              inventoryMessage = '武器类型不匹配！';
              inventoryMessageTimer = 120;
              inventorySelectedIndex = -1;
              return;
            }
          }
          const slot = eq.slot;
          // 如果已有装备，放回背包
          if(p.equipment[slot]){
            p.inventory[inventorySelectedIndex] = p.equipment[slot];
          } else {
            p.inventory.splice(inventorySelectedIndex, 1);
          }
          p.equipment[slot] = eq;
          inventorySelectedIndex = -1;
          recalcPlayerStats();
          inventoryMessage = '穿戴成功！';
          inventoryMessageTimer = 60;
        }
      } else if(r.unequip){
        // 点击已装备的装备 → 卸下
        const slot = r.unequip;
        if(p.equipment[slot]){
          p.inventory.push(p.equipment[slot]);
          p.equipment[slot] = null;
          recalcPlayerStats();
        }
      } else if(r.usePotion){
        /* ★ 喝药水（回血瓶 / 回蓝瓶）- 只能在战斗/地图中使用，城镇中不可用 */
        if(window.POTION){
          // 检查是否在城镇状态
          const fromTown = G && G.inventoryReturnState === 'town';
          if(fromTown){
            inventoryMessage = '消耗品只能在战斗中使用';
            inventoryMessageTimer = 90;
          } else {
            const res = POTION.use(p, r.usePotion);
            inventoryMessage = res.msg;
            inventoryMessageTimer = 90;
            if(res.ok && typeof spawnText === 'function' && G && G.player){
              spawnText(G.player.x, G.player.y - 60, 70, res.msg, '#7af0c8', 16);
            }
          }
        }
      } else if(r.useProp){
        // 旧存档残留的属性丹：已经不能用了
        inventoryMessage = '属性丹已移除（永久加属性的设定不合理），现在掉的是回血瓶 / 回蓝瓶';
        inventoryMessageTimer = 120;
      }
    }
  } else if(gameState==='enhanceMenu'){
    const regions = G.enhanceClickRegions || [];
    const r = hitTestRegion(pos.x, pos.y, regions);
    if(r){
      if(r.action === 'back'){
        gameState = 'town';
        blacksmithTab = 'enhance';
      } else if(r.action === 'switchTab'){
        blacksmithTab = r.tab;
        decomposeSelectedIndex = -1;
        decomposeSelectedIndices = [];
      } else if(r.action === 'enhance'){
        doEnhance();
      } else if(r.action === 'selectSlot' && r.slot){
        if(blacksmithTab === 'enhance') enhanceSelectedSlot = r.slot;
        else if(blacksmithTab === 'amplify') amplifySelectedSlot = r.slot;
        else if(blacksmithTab === 'reforge') reforgeSelectedSlot = r.slot;
      } else if(r.action === 'selectDecompose'){
        // 多选切换：点击已选中的取消选中，点击未选中的加入
        const idx = r.index;
        const pos = decomposeSelectedIndices.indexOf(idx);
        if(pos >= 0){
          decomposeSelectedIndices.splice(pos, 1);
        } else {
          decomposeSelectedIndices.push(idx);
        }
        decomposeSelectedIndex = decomposeSelectedIndices.length > 0 ? decomposeSelectedIndices[decomposeSelectedIndices.length - 1] : -1;
      } else if(r.action === 'decompose'){
        doDecompose();
      } else if(r.action === 'clearDecompose'){
        decomposeSelectedIndices = [];
        decomposeSelectedIndex = -1;
      } else if(r.action === 'amplify'){
        doAmplify();
      } else if(r.action === 'reforge'){
        doReforge();
      }
    }
  } else if(gameState==='characterInfo'){
    const regions = G.charInfoClickRegions || [];
    const r = hitTestRegion(pos.x, pos.y, regions);
    if(r && r.action === 'back'){
      gameState = 'town';
    }
  } else if(gameState==='questMenu'){
    const r = hitTestRegion(pos.x, pos.y, questClickRegions);
    if(r && r.id === 'back') gameState = questReturnState || 'town';
    else if(r && r.id === 'view'){ questViewIdx = r.idx; }
    else if(r && r.id === 'skip'){
      /* ★ DNF式跳过任务：直接完成当前及之前的所有可跳过任务 */
      const pq = G && G.player;
      const qq = pq ? questOf(pq) : null;
      if(qq){
        /* 先检查目标任务是否可跳过 */
        const skipIdx = r.idx;
        if(skipIdx <= qq.idx && canSkipQuest(pq, skipIdx)){
          const skipped = skipAllEligibleQuests(pq);
          const nq = MAIN_QUESTS[qq.idx];
          const parts = [];
          if(skipped > 0){
            parts.push('跳过 ' + skipped + ' 个任务');
          }
          showDialogue([
            '「你的实力已经远超这些任务的要求，直接完成！」',
            '『' + (parts.join(' · ') || '任务已更新') + '』'
          ], function(){
            if(nq){
              questToastMsg('当前任务 · ' + nq.chapter + '「' + nq.title + '」',
                nq.brief || '跟着金色箭头继续冒险', '#9fe6ff');
            } else {
              questToastMsg('所有任务已完成', '你已成为传说中的守灯人！', '#ffd700');
            }
          });
        }
      }
    }
    else if(r && r.id === 'turnIn'){
      /* 直接交付任务，不需要走到NPC处 */
      const pq = G && G.player;
      const qq = pq ? questOf(pq) : null;
      const cq2 = qq ? MAIN_QUESTS[qq.idx] : null;
      if(qq && qq.readyTurnIn && cq2){
        const rew = cq2.reward || {};
        const parts = [];
        if(rew.exp) parts.push('经验 ' + rew.exp);
        if(rew.gold) parts.push('金币 ' + rew.gold);
        if(rew.sp) parts.push('技能点 ' + rew.sp);
        if(rew.equip) parts.push('装备 ×' + rew.equip);
        showDialogue([
          '「' + (cq2.outro || '做得好，灯又亮了一分。') + '」',
          '『获得任务奖励：' + (parts.join(' · ') || '无') + '』'
        ], function(){
          qq.done.push(cq2.id);
          try { grantQuestReward(pq, cq2); } catch(e){}
          qq.idx++; qq.step = 0; qq.readyTurnIn = false; qq.killsBase = undefined;
          const nq = MAIN_QUESTS[qq.idx];
          questToastMsg('任务完成 · ' + cq2.chapter + '「' + cq2.title + '」',
            '奖励已发放：' + (parts.join(' · ') || '无'), '#ffd166');
          if(nq){
            setTimeout(function(){
              questToastMsg('新任务 · ' + nq.chapter + '「' + nq.title + '」',
                nq.brief || '跟着金色箭头继续冒险', '#9fe6ff');
            }, 1200);
          }
        });
      }
    }
  } else if(gameState==='gameMenu'){
    const r = hitTestRegion(pos.x, pos.y, gameMenuClickRegions);
    if(r){
      if(r.id === 'close') gameState = 'town';
      else if(r.id === 'inventory'){ G.inventoryReturnState = 'town'; gameState = 'inventory'; }
      else if(r.id === 'skillMenu') gameState = 'skillMenu';
      else if(r.id === 'characterInfo') gameState = 'characterInfo';
      else if(r.id === 'questMenu'){ questReturnState = 'town'; gameState = 'questMenu'; }
      else if(r.id === 'enhanceMenu') gameState = 'enhanceMenu';
      else if(r.id === 'shop') gameState = 'shopMenu';
      else if(r.id === 'levelSelect'){ levelSelectFilter = null; gameState = 'levelSelect'; }
      else if(r.id === 'equipWiki') openEquipWiki();
      else if(r.id === 'menu'){ gameState = 'menu'; if(window.stopBGM) stopBGM(); }
    }
  } else if(gameState==='equipWiki'){
    const r = hitTestRegion(pos.x, pos.y, wikiClickRegions);
    if(r){
      if(r.id === 'close') gameState = 'gameMenu';
      else if(r.slot != null){ if(wikiSlot !== r.slot){ wikiSlot = r.slot; wikiSelIdx = 0; wikiScroll = 0; buildWikiList(); } }
      else if(r.lv != null){ if(wikiLvIdx !== r.lv){ wikiLvIdx = r.lv; wikiSelIdx = 0; wikiScroll = 0; buildWikiList(); } }
      else if(r.tier != null){ if(wikiTierIdx !== r.tier){ wikiTierIdx = r.tier; wikiSelIdx = 0; wikiScroll = 0; buildWikiList(); } }
      else if(r.selIdx != null) wikiSelIdx = r.selIdx;
    }
  } else if(gameState==='skillMenu'){
    const r = hitTestRegion(pos.x, pos.y, skillMenuClickRegions);
    if(r){
      const p = G.player;
      const w = WEAPONS[p.weaponIdx || 0];
      if(r.close){
        gameState = 'town';
      } else if(r.reset){
        const now = performance.now();
        if(now < skillResetArmUntil){
          let refund = 0;
          for(let i = 0; i < w.skills.length; i++){
            const lv = (p.skillLevels && p.skillLevels[i]) || 0;
            if(lv > 0){
              if(i < 3){
                /* 前3个技能初始1级（免费），返还从1级到当前等级的SP */
                refund += skillSpent(w.skills[i], lv);
              } else {
                /* 后3个技能初始0级，返还从0级到当前等级的SP（含学习费用） */
                refund += skillSpCost(w.skills[i], 1) + skillSpent(w.skills[i], lv);
              }
            }
            p.skillLevels[i] = i < 3 ? 1 : 0;
          }
          p.skillPoints = (p.skillPoints || 0) + refund;
          skillResetArmUntil = 0;
          skillMenuMsgShow('技能点已重置，返还 ' + refund + ' SP');
        } else {
          skillResetArmUntil = now + 3000;
          skillMenuMsgShow('再次点击「重置技能点」确认（3秒内有效）');
        }
      } else if(typeof r.skillIdx === 'number'){
        const i = r.skillIdx, sk = w.skills[i];
        if(!sk) return;
        const curLv = (p.skillLevels && p.skillLevels[i]) || 0;
        const maxLv = skillMaxLv(sk);
        if(sk.locked){
          skillMenuMsgShow('「' + sk.name + '」尚未设计开放，技能槽已预留');
        } else if((p.level || 1) < (sk.unlock || 1)){
          skillMenuMsgShow('角色等级不足：「' + sk.name + '」需要 Lv.' + sk.unlock);
        } else if(curLv >= maxLv){
          skillMenuMsgShow('「' + sk.name + '」已达最高等级 Lv.' + maxLv);
        } else if(curLv >= skillLvCap(p, sk)){
          /* ★ DNF 式：技能还有级，但角色等级不够 */
          skillMenuMsgShow('角色等级不足：「' + sk.name + '」升到 Lv.' + (curLv + 1) + ' 需要角色 Lv.' + skillNextLvNeed(p, sk));
        } else {
          const cost = skillSpCost(sk, Math.max(1, curLv));
          if((p.skillPoints || 0) < cost){
            skillMenuMsgShow('技能点不足：升级需要 ' + cost + ' SP，当前仅 ' + (p.skillPoints || 0) + ' SP');
          } else {
            p.skillPoints -= cost;
            p.skillLevels[i] = curLv + 1;
            /* ★ 学习技能时自动解锁 */
            if(!p.skillsUnlocked) p.skillsUnlocked = [true, true, false, false, false, false];
            p.skillsUnlocked[i] = true;
            skillMenuMsgShow('「' + sk.name + '」提升至 Lv.' + p.skillLevels[i] + '（消耗 ' + cost + ' SP）');
            playSound('skillCast');
            /* ★ 立即刷新技能栏UI */
            if(typeof refreshSkillLockUI === 'function') refreshSkillLockUI();
          }
        }
      }
    }
  } else if(gameState==='paused'){
    const r = hitTestRegion(pos.x, pos.y, pauseClickRegions);
    if(r){
      if(r.action === 'resume'){
        gameState = 'playing';
      } else if(r.action === 'backToTown'){
        /* ★ 试炼中直接返回城镇：恢复单人冒险状态，避免 G 残留对战字段 */
        restoreSingleGIfNeeded();
        gameState = 'town';
        /* 回到进本前的位置，不乱传送 */
        if(townPlayer){
          townCam.x = clamp(townPlayer.x - VW/2, 0, Math.max(0, TOWN_W - VW));
          townCam.y = clamp(townPlayer.y - VH/2, 0, Math.max(0, TOWN_H - VH));
        }
        if(window.showTouchControls) window.showTouchControls(false);
      }
    }
  }
}

/* 开始关卡 */
function startLevel(levelIdx){
  /* ★ 兜底：守门人试炼/PK 退出后 G 可能残留对战结构（无 camera / room 字段） */
  if(!G){
    G = { t:0, player:null, enemies:[], projectiles:[], particles:[], effects:[], texts:[],
      levelIdx:0, waveIdx:0, waveState:'idle', waveTimer:0, waveNum:0,
      combo:0, comboTimer:0, shake:0, hitstop:0, flash:0, hitFlashColor:'#fff',
      totalKills:0, bannerText:'', bannerTimer:0, currentIsBoss:false,
      camera:{x:0,y:0}, worldWidth:ROOM_WIDTH, traps:[], drops:[], clearedLevels:[] };
  }
  if(G.isPvp || !G.player) restoreSingleGIfNeeded();
  if(!G.camera) G.camera = { x:0, y:0 };
  if(!Array.isArray(G.enemies)) G.enemies = [];
  if(!Array.isArray(G.projectiles)) G.projectiles = [];
  if(!Array.isArray(G.particles)) G.particles = [];
  if(!Array.isArray(G.effects)) G.effects = [];
  if(!Array.isArray(G.texts)) G.texts = [];
  if(!Array.isArray(G.drops)) G.drops = [];
  if(!Array.isArray(G.traps)) G.traps = [];
  if(!G.player){ gameState = 'town'; return; }
  G.levelIdx = levelIdx;
  G.waveIdx = 0;
  G.enemies = [];
  G.projectiles = [];
  G.drops = [];
  /* ★ 修复: 清除PK状态，防止守门人PK后进入地下城看到AI对手 */
  G.isPvp = false;
  G.player2 = null;
  G.waveState = 'idle';
  G.waveTimer = 0;
  G.combo = 0;
  G.comboTimer = 0;
  G.totalKills = 0;
  const p = G.player;
  p.x = VW*0.2;
  p.y = 600;
  p.hp = p.maxHp;
  p.mp = p.maxMp;
  /* ★ 修复: 重置玩家状态，防止第二次进入地下城角色消失/无法动弹 */
  p.dead = false;
  p.state = 'idle';
  p.action = null;
  p.h = 0;
  p.vy = 0;
  p.kx = 0;
  p.invuln = 0;
  p.hitFlash = 0;
  p.hurtT = 0;
  p.launchT = 0;
  p.jumpT = 0;
  p.landingT = 0;
  p.dodgeT = 0;
  p.cds = [0, 0, 0, 0, 0, 0];
  p.comboWindow = 0;
  p.comboIdx = 0;
  p.attackBuffer = 0;
  /* 重置延迟血条 */
  p.displayHp = p.maxHp;
  p.damageHp = p.maxHp;
  
  // 根据难度设置系数
  const diff = G.currentDifficulty || 'normal';
  G.diffMul = diff === 'hell' ? 3.5 : (diff === 'hard' ? 2.0 : 1.0);

  /* ★ DNF 式房间初始化 */
  G.worldWidth = ROOM_WIDTH;
  G.roomTotal = ROOM_TOTAL;
  G.roomIdx = 0;
  G.portal = null;
  G.roomFade = 0;
  G.camera.x = 0;

  gameState = 'playing';
  startWave();
}

/* 购买物品 */
function buyItem(item){
  const p = G.player;
  if(p.gold < item.price){
    spawnText(p.x, p.y - 100, 60, '金币不足!', '#ff6a4a', 20);
    return;
  }
  if((p.level||1) < item.level){
    spawnText(p.x, p.y - 100, 60, `需要Lv.${item.level}!`, '#ff6a4a', 20);
    return;
  }
  p.gold -= item.price;

  // 用商店item的tier/level/name生成装备
  const tierInfo = EQUIP_TIERS[item.tierIdx];
  const lv = item.level;
  const wType = item.weaponType || 'sword';
  const equip = {
    slot: item.slot,
    name: item.name,
    tier: tierInfo.id,
    tierName: tierInfo.name,
    tierColor: tierInfo.color,
    grade: '中级', gradeMul: 1.0,
    level: lv,
    enhance: 0,
    weaponType: wType,
    baseAtk: item.slot === 'weapon' ? Math.round(10 * tierInfo.baseMul * (1 + lv * 0.1)) : 0,
    baseHp: Math.round((item.slot === 'head' || item.slot === 'armor' ? 30 * tierInfo.baseMul * (1 + lv * 0.1) : 0)),
    baseDef: Math.round(item.slot === 'armor' ? 5 * tierInfo.baseMul * (1 + lv * 0.1) : 0),
    baseSpd: Math.round(item.slot === 'shoes' ? 10 * tierInfo.baseMul * (1 + lv * 0.08) : 0),
    baseCrit: Math.round((item.slot === 'accessory' || item.slot === 'necklace' || item.slot === 'ring' || item.slot === 'bracer') ? 3 * tierInfo.baseMul * (1 + lv * 0.1) : 0),
    extraStats: []
  };

  // 放入背包
  if(!p.inventory) p.inventory = [];
  p.inventory.push(equip);

  spawnText(p.x, p.y - 100, 80, `购买成功: ${equip.name}!`, '#2ee6a8', 18);
}

cvs.addEventListener('click', e=>handleCanvasClick(e.clientX, e.clientY));
cvs.addEventListener('touchstart', e=>{
  e.preventDefault();
  if(e.changedTouches.length>0) handleCanvasClick(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
}, {passive:false});

/* ★ 商店列表滚轮滚动 + 触摸/鼠标拖拽滚动 */
cvs.addEventListener('wheel', function(e){
  if(gameState === 'shopMenu' && shopScrollMax > 0){
    shopListScroll = clamp(shopListScroll + e.deltaY, 0, shopScrollMax);
    e.preventDefault();
  }
  if(gameState === 'questMenu' && questScrollMax > 0){
    questListScroll = clamp(questListScroll + e.deltaY, 0, questScrollMax);
    e.preventDefault();
  }
  if(gameState === 'equipWiki' && wikiScrollMax > 0){
    wikiScroll = clamp(wikiScroll + e.deltaY, 0, wikiScrollMax);
    e.preventDefault();
  }
}, {passive:false});
let shopScrollDrag = null;
cvs.addEventListener('pointerdown', function(e){
  const r0 = cvs.getBoundingClientRect();
  const x0 = (e.clientX - r0.left) * (VW / r0.width);
  const y0 = (e.clientY - r0.top) * (VH / r0.height);
  if(gameState === 'questMenu' && questScrollBarRegion && questScrollMax > 0){
    const b = questScrollBarRegion;
    if(x0 >= b.x && x0 <= b.x + b.w && y0 >= b.y && y0 <= b.y + b.h){
      questScrollDrag = { y: y0, scroll: questListScroll };
      e.preventDefault();
      return;
    }
    if(questListRegion && x0 >= questListRegion.x && x0 <= questListRegion.x + questListRegion.w &&
       y0 >= questListRegion.y && y0 <= questListRegion.y + questListRegion.h){
      questScrollDrag = { y: y0, scroll: questListScroll, listDrag: true };
      e.preventDefault();
      return;
    }
  }
  if(gameState === 'equipWiki' && wikiScrollBarRegion && wikiScrollMax > 0){
    const b = wikiScrollBarRegion;
    if(x0 >= b.x && x0 <= b.x + b.w && y0 >= b.y && y0 <= b.y + b.h){
      wikiScrollDrag = { y: y0, scroll: wikiScroll };
      e.preventDefault();
      return;
    }
    if(wikiListRegion && x0 >= wikiListRegion.x && x0 <= wikiListRegion.x + wikiListRegion.w &&
       y0 >= wikiListRegion.y && y0 <= wikiListRegion.y + wikiListRegion.h){
      wikiScrollDrag = { y: y0, scroll: wikiScroll, listDrag: true };
      e.preventDefault();
      return;
    }
  }
  if(gameState !== 'shopMenu') return;
  const x = x0, y = y0;
  if(shopScrollBarRegion && x >= shopScrollBarRegion.x && x <= shopScrollBarRegion.x + shopScrollBarRegion.w &&
     y >= shopScrollBarRegion.y && y <= shopScrollBarRegion.y + shopScrollBarRegion.h){
    shopScrollDrag = { y: y, scroll: shopListScroll };
    e.preventDefault();
  } else if(shopListRegion && shopScrollMax > 0 &&
            x >= shopListRegion.x && x <= shopListRegion.x + shopListRegion.w &&
            y >= shopListRegion.y && y <= shopListRegion.y + shopListRegion.h){
    /* 列表区域内按住拖动 = 滚动（触屏友好） */
    shopScrollDrag = { y: y, scroll: shopListScroll, listDrag: true };
    e.preventDefault();
  }
});
window.addEventListener('pointermove', function(e){
  const r = cvs.getBoundingClientRect();
  const y = (e.clientY - r.top) * (VH / r.height);
  if(gameState === 'questMenu' && questScrollDrag && questScrollBarRegion){
    if(questScrollDrag.listDrag){
      questListScroll = clamp(questScrollDrag.scroll - (y - questScrollDrag.y), 0, questScrollMax);
    } else {
      const track = questScrollBarRegion.h - (questScrollBarRegion.thumbH || 30);
      const k = track > 0 ? (questScrollMax / track) : 0;
      questListScroll = clamp(questScrollDrag.scroll + (y - questScrollDrag.y) * k, 0, questScrollMax);
    }
    e.preventDefault();
    return;
  }
  if(gameState === 'equipWiki' && wikiScrollDrag && wikiScrollBarRegion){
    if(wikiScrollDrag.listDrag){
      wikiScroll = clamp(wikiScrollDrag.scroll - (y - wikiScrollDrag.y), 0, wikiScrollMax);
    } else {
      const track = wikiScrollBarRegion.h - (wikiScrollBarRegion.thumbH || 30);
      const k = track > 0 ? (wikiScrollMax / track) : 0;
      wikiScroll = clamp(wikiScrollDrag.scroll + (y - wikiScrollDrag.y) * k, 0, wikiScrollMax);
    }
    e.preventDefault();
    return;
  }
  if(gameState !== 'shopMenu' || !shopScrollDrag || !shopScrollBarRegion) return;
  if(shopScrollDrag.listDrag){
    shopListScroll = clamp(shopScrollDrag.scroll - (y - shopScrollDrag.y), 0, shopScrollMax);
  } else {
    const track = shopScrollBarRegion.h - (shopScrollBarRegion.thumbH || 30);
    const k = track > 0 ? (shopScrollMax / track) : 0;
    shopListScroll = clamp(shopScrollDrag.scroll + (y - shopScrollDrag.y) * k, 0, shopScrollMax);
  }
  e.preventDefault();
}, {passive:false});
window.addEventListener('pointerup', function(){ shopScrollDrag = null; questScrollDrag = null; wikiScrollDrag = null; });

