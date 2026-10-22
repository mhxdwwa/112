/* ============================================================
   ★ 深渊准入：完成前置任务链才会解锁
     返回可进入的深渊数量：0=全锁 / 1=仅「子夜鬼门」/ 5=全部解锁
   - qa1「深渊的邀请」完成 → 解锁第一境
   - qa2「子夜鬼门」完成   → 解锁全部五境
   - 兼容旧存档：深渊通关记录达到对应数量也视为已解锁
     ============================================================ */
const ABYSS_LEVEL_IDXS = [];
for(let _i = 0; _i < LEVEL_TEMPLATES.length; _i++) if(LEVEL_TEMPLATES[_i] && LEVEL_TEMPLATES[_i].isAbyss) ABYSS_LEVEL_IDXS.push(_i);

function abyssUnlockCount(p){
  if(!p) return 0;
  const q = questOf(p);
  let n = 0;
  if(q.done.indexOf('qa1') >= 0) n = 1;
  if(q.done.indexOf('qa2') >= 0) n = 5;
  /* 任务链索引已越过对应任务（自愈推进过的旧存档）也算解锁 */
  const iqa1 = MAIN_QUESTS.findIndex(m => m.id === 'qa1');
  const iqa2 = MAIN_QUESTS.findIndex(m => m.id === 'qa2');
  if(q.idx > iqa1) n = Math.max(n, 1);
  if(q.idx > iqa2) n = Math.max(n, 5);
  /* 旧存档兜底：深渊通关记录达到几境就开几境 */
  let clearedAbyss = 0;
  for(const li of ABYSS_LEVEL_IDXS) if((p.clearedLevels || []).indexOf(li) >= 0) clearedAbyss++;
  if(clearedAbyss >= 1) n = Math.max(n, 1);
  if(clearedAbyss >= 2) n = Math.max(n, 5);
  return n;
}
function questStepProgress(p, st){
  if(!st) return { cur:0, max:1, txt:'' };
  if(st.type === 'kills'){
    const base = (p.quest && p.quest.killsBase) || 0;
    const kc = Math.max(0, (p.questKills || 0) - base);
    return { cur: Math.min(st.count, kc), max: st.count, txt: kc + ' / ' + st.count };
  }
  if(st.type === 'level') return { cur: Math.min(st.level, p.level || 1), max: st.level, txt:'Lv.' + (p.level || 1) + ' / ' + st.level };
  if(st.type === 'enhance') return { cur: Math.min(st.lv, maxEnhanceLv(p)), max: st.lv, txt:'+' + maxEnhanceLv(p) + ' / +' + st.lv };
  if(st.type === 'clear') return { cur: questStepDone(p, st) ? 1 : 0, max: 1, txt: questStepDone(p, st) ? '已完成' : '未通关' };
  return { cur: questStepDone(p, st) ? 1 : 0, max: 1, txt: questStepDone(p, st) ? '已完成' : '进行中' };
}
function questToastMsg(title, sub, color){
  questToast = { title: title, sub: sub || '', color: color || '#ffd166', t: 0, dur: 4.2 };
}
function unlockPlayerSkill(p, idx){
  if(!p) return;
  if(!p.skillsUnlocked) p.skillsUnlocked = [false,false,false,false,false,false];
  if(p.skillsUnlocked[idx]) return;
  p.skillsUnlocked[idx] = true;
  if(p.skillLevels) p.skillLevels[idx] = Math.max(1, p.skillLevels[idx] || 0);
  const w = WEAPONS[p.weaponIdx];
  const nm = (w && w.skills[idx]) ? w.skills[idx].name : ('技能' + (idx + 1));
  questToastMsg('领悟新技 · ' + nm, (w && w.skills[idx]) ? w.skills[idx].desc : '', '#7dffd4');
  refreshSkillLockUI();
}
function grantQuestReward(p, q){
  const r = q.reward || {};
  if(r.gold) p.gold = (p.gold || 0) + r.gold;
  if(r.sp) p.skillPoints = (p.skillPoints || 0) + r.sp;
  /* ★ 任务经验：大量经验，让前期升级更快 */
  if(r.exp){
    p.exp = (p.exp || 0) + r.exp;
    spawnText(p.x, p.y - 90, 90, `经验 +${r.exp}`, '#c9ffa2', 20);
    /* 经验可能跨多级，统一走升级检测 */
    while(p.level < 60 && p.exp >= p.expNext){
      p.exp -= p.expNext;
      p.level++;
      p.expNext = getExpNeed(p.level);
      p.skillPoints = (p.skillPoints || 0) + SP_PER_LEVEL;
      const growth = getLevelGrowth(p.level);
      growBaseStat(p, 1.08, growth.hp, growth.mp);
      recalcPlayerStats();
      p.hp = p.maxHp;
      p.mp = p.maxMp;
      spawnText(p.x, p.y - 120, 80, `升级！Lv.${p.level}`, '#ffd700', 24);
      spawnText(p.x, p.y - 90, 80, `技能点 +${SP_PER_LEVEL} (按U分配)`, '#c9a2ff', 16);
    }
  }
  if(r.mats){
    if(!p.materials) p.materials = {};
    for(const k in r.mats) p.materials[k] = (p.materials[k] || 0) + r.mats[k];
  }
  if(r.equip){
    const slots = ['weapon','head','armor','shoes','necklace','ring','bracer'];
    for(let i = 0; i < r.equip; i++){
      const slot = slots[Math.floor(Math.random() * slots.length)];
      const eq = generateEquipment(slot, Math.max(0, (G && G.levelIdx) || 0), 1);
      addToInventory(eq);
    }
  }
  if(q.unlock) for(const idx of q.unlock) unlockPlayerSkill(p, idx);
}
function updateQuests(dt){
  if(!G || !G.player || G.isPvp || !pausedSafe()) return;
  const p = G.player;
  const q = questOf(p);
  if(!q) return;
  if(q.killsBase === undefined){
    const c0 = MAIN_QUESTS[q.idx], s0 = c0 && c0.steps[q.step];
    q.killsBase = (s0 && s0.type === 'kills') ? (p.questKills || 0) : 0;
  }
  const setKillBase = () => {
    const c = MAIN_QUESTS[q.idx];
    const s = c && c.steps[q.step];
    if(s && s.type === 'kills') q.killsBase = p.questKills || 0;
  };
  /* 防御：奖励发放异常也不能卡死任务链（先推进，奖励 try/catch） */
  let guard = 0;
  while(guard++ < 30){
    const cq = MAIN_QUESTS[q.idx];
    if(!cq){ return; }
    /* ★ 已完成目标、等待回城交付：停在这里，等玩家找引灯人对话 */
    if(q.readyTurnIn) return;
    const st = cq.steps[q.step];
    if(!st){
      /* 步骤越界（旧存档卡在“任务完成”状态）：补完整章并自愈 */
      if(q.done.indexOf(cq.id) < 0) q.done.push(cq.id);
      try { grantQuestReward(p, cq); } catch(e){ if(window.__dbgErr !== undefined) window.__dbgErr++; }
      const nx = MAIN_QUESTS[q.idx + 1];
      questToastMsg('任务完成 · ' + cq.chapter + '「' + cq.title + '」',
        (nx ? '已接取新任务：' + nx.chapter + '「' + nx.title + '」 — 跟着金色箭头走' : cq.outro || ''), '#ffd166');
      q.idx++; q.step = 0; setKillBase();
      continue;
    }
    if(!questStepDone(p, st)) return;
    /* 当前步骤完成 */
    q.step++;
    if(q.step < cq.steps.length){
      setKillBase();
      /* ★ 明确引导：告诉玩家下一步做什么 + 跟着箭头走 */
      questToastMsg('任务推进 · ' + cq.title, '下一步：' + cq.steps[q.step].text + '（跟着金色箭头走）', '#9fe6ff');
      return;
    }
    /* ★ 整章目标完成：不自动发奖，回城找引灯人交付（DNF 式任务交付） */
    if(!q.readyTurnIn){
      q.readyTurnIn = true;
      questToastMsg('任务目标完成 · ' + cq.title,
        '回城找「引灯人」交付任务领取奖励（跟着金色箭头走，靠近后按 J 对话）', '#ffd166');
    }
    return;
  }
}
function pausedSafe(){
  return gameState === 'playing' || gameState === 'town' || gameState === 'stageClear' ||
         gameState === 'levelSelect' || gameState === 'dungeonSelect' ||
         gameState === 'inventory' || gameState === 'skillMenu' || gameState === 'characterInfo' ||
         gameState === 'enhanceMenu' || gameState === 'shopMenu' || gameState === 'questMenu' ||
         gameState === 'gameMenu' || gameState === 'equipWiki';
}

