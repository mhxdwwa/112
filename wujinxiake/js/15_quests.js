/* ============================================================
   ★ 主线任务 —— 「墟界·九灯」
   ── 世界观 ──
   天穹碎了。九根「镇岳」灯柱撑住残破的天地，灯在，人就能活。
   守灯人以命为薪，一灯一命。灯灭之处，妖气自裂隙涌出。
   你是第九代守灯人捡回来的孩子，人称「拾灯人」。
   师父在魔尊殿失踪，只留下一盏灭了的灯，和一句话：
   「灯不是用来照路的，是用来记住人的。」
   九灯全亮那天，你才知道——魔尊不是魔，是第一代守灯人的影子。
   ============================================================ */
const PROLOGUE_LINES = [
  '（火光很暗。你醒来时，掌心攥着一盏冷透的灯。）',
  '师父的声音从灯芯里漏出来，很轻：「娃儿，灯灭了，人要接着走。」',
  '这里是墟界。天穹在一千年前碎了，九根镇岳灯柱撑着这片残破天地。',
  '守灯人以命为薪，一灯一命。灯灭一处，妖气便从裂隙里涌出来。',
  '你叫拾灯人。你的活计很简单——走到灯灭的地方，把灯重新点亮。',
  '九盏灯，九段路。第一盏，在乱石岗。',
  '（去找传送使吧。跟着金色箭头走。）'
];

const MAIN_QUESTS = [
  { id:'q0', chapter:'序章', title:'余烬',
    brief:'听完师父留在灯里的最后一段话，然后去和守门人谈谈。',
    steps:[ { type:'story', text:'听完灯中的留音' } ],
    reward:{ gold:200, sp:2, exp:250 },
    unlock:[0,1],
    outro:'守门人看着你手里的灯，沉默了很久：「你师父……把灯交给你了。」',
    tip:'一、二号技能已领悟。按 1 / 2 施展。' },

  /* ── 第一章 · 乱石岗（Lv.1~7）── */
  { id:'q1', chapter:'第一章', title:'外围哨卡',
    brief:'乱石岗外围有山贼设了哨卡，先去清理掉。',
    steps:[ { type:'clear', level:0, text:'通关「乱石岗·外围」' } ],
    reward:{ gold:250, exp:1000 },
    outro:'哨兵倒下时，你听见寨子里传来怒吼。',
    tip:'跟着金色箭头找传送使·青鸾，进入「乱石岗·外围」。' },

  { id:'q2', chapter:'第一章', title:'剿匪令',
    brief:'外围清了，寨子里的山贼还在。去匪寨找寨主算账。',
    steps:[ { type:'kills', count:15, text:'击败 15 名山贼（找传送使·青鸾进「乱石岗」）' } ],
    reward:{ gold:300, exp:1500 },
    outro:'山贼的血溅在灯罩上，灯芯却更亮了一分。',
    tip:'多刷几趟乱石岗攒击杀数。' },

  { id:'q3', chapter:'第一章', title:'乱石岗的灯',
    brief:'灯芯被埋在匪寨深处，取回它。',
    steps:[ { type:'clear', level:1, text:'通关「乱石岗·匪寨」' } ],
    reward:{ gold:400, sp:2, equip:1, exp:2500 },
    outro:'寨主倒下时，胸口浮出一缕火。它自己钻进了你的灯里。',
    tip:'灯亮了一分。北边的狼谷，该去看看了。' },

  { id:'q3b', chapter:'第一章', title:'斩草除根',
    brief:'寨主死了，小喽啰却还想给自家大王报仇。',
    steps:[ { type:'kills', count:40, text:'再击败 40 名敌人' } ],
    reward:{ gold:500, exp:3000 },
    outro:'乱石岗安静了。守门人说：北边的狼谷，该去看看了。',
    tip:'多刷几趟「乱石岗·匪寨」，等级练到 7 级。' },

  /* ── 第二章 · 野狼谷（Lv.7~13）── */
  { id:'q4', chapter:'第二章', title:'狼谷入口',
    brief:'野狼谷的谷口被狼群封锁了，先打通入口。',
    steps:[ { type:'clear', level:2, text:'通关「野狼谷·谷口」' } ],
    reward:{ gold:500, sp:2, exp:4000 },
    unlock:[2],
    outro:'灰狼头领倒下后，谷口的路通了。深处传来更沉的吼声。',
    tip:'三号技能「觉醒技」已解锁。' },

  { id:'q5', chapter:'第二章', title:'狼口拔牙',
    brief:'狼群没散，反而越聚越多。得一路杀到狼巢。',
    steps:[ { type:'kills', count:60, text:'击败 60 名敌人（推荐刷「野狼谷」）' } ],
    reward:{ gold:700, exp:8000 },
    outro:'狼谷的雾散了些。灯说：油还差一口，等你再强一点。',
    tip:'反复通关「野狼谷」攒击杀。' },

  { id:'q6', chapter:'第二章', title:'灯油添香',
    brief:'灯喝饱了油，才能照亮下一条路。深入狼巢，击败巨熊王。',
    steps:[ { type:'clear', level:3, text:'通关「野狼谷·狼巢」' } ],
    reward:{ gold:800, sp:3, equip:1, exp:10000 },
    outro:'巨熊王倒下时，灯芯「啪」地爆了个灯花。阴兵道，就在前面。',
    tip:'刷「野狼谷·狼巢」升到 13 级，强化装备再去阴兵道。' },

  /* ── 第三章 · 阴兵道（Lv.13~22）── */
  { id:'q7', chapter:'第三章', title:'阴兵不认灯',
    brief:'阴兵道的前道满是游魂，先打通前道。',
    steps:[ { type:'clear', level:4, text:'通关「阴兵道·前道」' } ],
    reward:{ gold:1000, sp:3, exp:15000 },
    outro:'鬼火引路者消散时，冥桥方向传来铠甲碰撞声。',
    tip:'阴兵开始有远程攻击了，注意走位。' },

  { id:'q7b', chapter:'第三章', title:'冥桥之战',
    brief:'冥桥之上，骷髅将军镇守。击败它，拿到灯牌。',
    steps:[ { type:'clear', level:5, text:'通关「阴兵道·冥桥」' } ],
    reward:{ gold:1200, sp:3, equip:1, exp:20000 },
    outro:'骷髅将军跪下时，铠甲里掉出一块灯牌。上面刻着你师父的名字。',
    tip:'你开始明白：九灯不是九处地方，是九个人的一生。' },

  { id:'q8', chapter:'第三章', title:'百鬼夜行',
    brief:'灯牌招鬼。一路上的阴兵，都得送回去。',
    steps:[ { type:'kills', count:100, text:'击败 100 名敌人（推荐刷「阴兵道」）' } ],
    reward:{ gold:1200, exp:30000 },
    outro:'夜行结束，晨光爬上灯柱。灯说：还差一点火候。',
    tip:'多刷「阴兵道」，攒击杀、攒经验。' },

  { id:'q9', chapter:'第三章', title:'强化军备',
    brief:'阴兵越来越硬，你的刀不能还像烧火棍。',
    steps:[ { type:'enhance', lv:5, text:'把任意装备强化到 +5（找铁匠·王大锤）' } ],
    reward:{ gold:1500, equip:1, exp:35000 },
    outro:'铁匠擦了擦手：「这回能砍动骷髅了。」',
    tip:'回城镇找铁匠强化装备，强化石副本和杂货铺都有。' },

  { id:'q10', chapter:'第三章', title:'幽室深处',
    brief:'阴兵道的最深处，幽室里藏着最后一盏灯。',
    steps:[ { type:'clear', level:6, text:'通关「阴兵道·幽室」' } ],
    reward:{ gold:1800, sp:3, equip:1, exp:40000 },
    outro:'阴兵队长倒下时，幽室深处的灯自己亮了。妖魔岭的妖气，已经能闻见了。',
    tip:'四号技能已解锁（需 14 级可学）。刷「阴兵道」到 22 级。' },

  /* ── 第四章 · 妖魔岭（Lv.22~31）── */
  { id:'q11', chapter:'第四章', title:'妖岭的狐火',
    brief:'妖魔岭外岭的狐火是假的灯。先清理外岭。',
    steps:[ { type:'clear', level:7, text:'通关「妖魔岭·外岭」' } ],
    reward:{ gold:2000, sp:3, exp:35000 },
    outro:'狐妖笑了：「你们守灯人，一辈子都在替别人熬夜。」然后化作一团真火。',
    tip:'妖物多毒，备好药再进本。' },

  { id:'q11b', chapter:'第四章', title:'毒沼蛛母',
    brief:'毒沼里的蛛母用幻术骗过往的行人。去击败它。',
    steps:[ { type:'clear', level:8, text:'通关「妖魔岭·毒沼」' } ],
    reward:{ gold:2200, sp:4, equip:1, exp:40000 },
    outro:'蛛母倒下时，毒沼的水清了。妖窟深处传来笑声。',
    tip:'蛛母的毒很猛，注意吃药。' },

  { id:'q12', chapter:'第四章', title:'狐火百盏',
    brief:'假灯灭了一盏，还有一百盏在岭子里晃。全灭了，才算干净。',
    steps:[ { type:'kills', count:150, text:'击败 150 名敌人（推荐刷「妖魔岭」）' } ],
    reward:{ gold:2500, exp:60000 },
    outro:'最后一盏狐火熄了。岭子里第一次有了真正的夜。',
    tip:'刷「妖魔岭」攒击杀和经验。' },

  { id:'q13', chapter:'第四章', title:'炉火纯青',
    brief:'狐火归了灯，灯要借你的手，把火再炼进铁里。',
    steps:[ { type:'enhance', lv:8, text:'把任意装备强化到 +8' } ],
    reward:{ gold:3000, exp:60000 },
    unlock:[4],
    outro:'淬火的一瞬，灯焰跳成了五瓣。五号技醒了。',
    tip:'五号技能已解锁（需 22 级可学）。找铁匠继续强化。' },

  { id:'q14', chapter:'第四章', title:'直面妖狐',
    brief:'九尾妖狐留了一缕真火在妖窟深处。灯说：等你够强，它自然会来。',
    steps:[ { type:'clear', level:9, text:'通关「妖魔岭·妖窟」' } ],
    reward:{ gold:3500, sp:4, equip:1, exp:70000 },
    outro:'真火入灯。北边传来兽吼——万兽谷的灯，等了很久了。',
    tip:'刷「妖魔岭·妖窟」到 31 级，向万兽谷进发。' },

  /* ── 第五章 · 万兽谷（Lv.31~41）── */
  { id:'q15', chapter:'第五章', title:'万兽谷地',
    brief:'万兽谷的谷地被兽群占据，先打通谷地。',
    steps:[ { type:'clear', level:10, text:'通关「万兽谷·谷地」' } ],
    reward:{ gold:4000, sp:4, exp:60000 },
    unlock:[],
    outro:'猛虎王倒下后，谷地的路通了。深处传来龙吟。',
    tip:'魔兽速度很快，注意闪避。' },

  { id:'q15b', chapter:'第五章', title:'兽穴青龙',
    brief:'兽穴深处的远古青龙，守了这盏灯三百年。',
    steps:[ { type:'clear', level:11, text:'通关「万兽谷·兽穴」' } ],
    reward:{ gold:4500, sp:5, equip:1, exp:70000 },
    outro:'青龙盘在灯柱上，看了你很久，让开了。它认得你师父的刀。',
    tip:'青龙的攻击范围很大，注意走位。' },

  { id:'q16', chapter:'第五章', title:'兽潮',
    brief:'青龙让了路，兽群却没散。潮水一样的兽，得一波波退。',
    steps:[ { type:'kills', count:250, text:'击败 250 名敌人（推荐刷「万兽谷」）' } ],
    reward:{ gold:5000, exp:100000 },
    outro:'兽潮退去，谷底的灯柱上抓痕累累，却还亮着。',
    tip:'刷「万兽谷」攒击杀和经验。' },

  { id:'q17', chapter:'第五章', title:'麒麟崖',
    brief:'麒麟崖上的火麒麟，是万兽谷最后的守护者。',
    steps:[ { type:'clear', level:12, text:'通关「万兽谷·麒麟崖」' } ],
    reward:{ gold:6000, sp:5, equip:1, exp:100000 },
    outro:'灯过半燃。幽冥殿的阴气，已经能感觉到了。',
    tip:'刷「万兽谷·麒麟崖」到 41 级。幽冥殿在等你。' },

  /* ── 第六章 · 幽冥殿（Lv.41~51）── */
  { id:'q18', chapter:'第六章', title:'幽冥前殿',
    brief:'幽冥殿的前殿守卫森严，先打通前殿。',
    steps:[ { type:'clear', level:13, text:'通关「幽冥殿·前殿」' } ],
    reward:{ gold:6000, sp:5, exp:100000 },
    outro:'幽冥守卫倒下后，魔将殿的门打开了。',
    tip:'阴兵精锐的法术很猛，注意吃药。' },

  { id:'q18b', chapter:'第六章', title:'魔将殿',
    brief:'魔将殿中的阴兵魔将，法力无边。',
    steps:[ { type:'clear', level:14, text:'通关「幽冥殿·魔将殿」' } ],
    reward:{ gold:7000, sp:5, equip:1, exp:120000 },
    outro:'魔将临死前说：「你以为你在点灯？你是在替他把命续下去。」',
    tip:'灯油失窃的事，还没完。' },

  { id:'q19', chapter:'第六章', title:'长夜',
    brief:'魔将偷的灯油流回了阴间，招来更多不该来的东西。',
    steps:[ { type:'kills', count:350, text:'击败 350 名敌人（推荐刷「幽冥殿」）' } ],
    reward:{ gold:8000, exp:160000 },
    outro:'长夜将尽。灯说：再撑一撑，天亮之前有一道雷。',
    tip:'刷「幽冥殿」攒击杀和经验。' },

  { id:'q20', chapter:'第六章', title:'密库殿主',
    brief:'密库深处，幽冥殿主亲自出手。击败它，夺回灯油。',
    steps:[ { type:'clear', level:15, text:'通关「幽冥殿·密库」' } ],
    reward:{ gold:10000, sp:6, equip:2, exp:180000 },
    outro:'殿主倒下时，灯油回到了灯里。天雷峰的云，压下来了。',
    tip:'六号技能已解锁（需 30 级可学）。刷「幽冥殿」到 51 级。' },

  /* ── 深渊 · 前置任务链（Lv.50 资格试炼）── */
  { id:'qa1', chapter:'深渊', title:'深渊的邀请',
    brief:'灯过半燃之夜，墟界天穹裂开一道紫缝。深渊传送使·玄冥说：深渊只邀请扛得住它的持灯人。先让它注意到你。',
    steps:[ { type:'kills', count:120, text:'击败 120 名敌人，让深渊注意到你（推荐刷「幽冥殿」，找传送使·白泽）' } ],
    reward:{ gold:12000, sp:7, exp:250000, mats:{ enhance_stone_high:3 } },
    outro:'深渊的气息缠上了灯芯。玄冥说：门，为你开了一道。',
    tip:'完成此任务后可进入「深渊·子夜鬼门」（找深渊传送使·玄冥）。' },

  { id:'qa2', chapter:'深渊', title:'子夜鬼门',
    brief:'子时已到。穿过鬼门，把深渊的第一次试探，原样还回去。',
    steps:[ { type:'clear', level:24, text:'通关「深渊·子夜鬼门」（找深渊传送使·玄冥）' } ],
    reward:{ gold:20000, sp:8, exp:400000, equip:2, mats:{ chaos_stone:5 } },
    outro:'鬼门在你身后合拢，另外四道门却依次亮起。深渊五境，从此对你敞开。',
    tip:'深渊五境全部解锁！Boss 难度×10，传说/史诗掉率大增。' },

  /* ── 第七章 · 天雷峰（Lv.51~57）── */
  { id:'q21', chapter:'第七章', title:'雷峰山脚',
    brief:'天雷峰的山脚有雷兽守护，先打通山脚。',
    steps:[ { type:'clear', level:16, text:'通关「天雷峰·山脚」' } ],
    reward:{ gold:12000, sp:6, equip:1, exp:250000 },
    outro:'雷兽倒下后，峰顶传来雷鸣。',
    tip:'神兽的攻击范围很大，注意闪避。' },

  { id:'q22', chapter:'第七章', title:'雷火淬灯',
    brief:'雷火是天给的最后一份淬火。先强化装备，再登顶。',
    steps:[ { type:'enhance', lv:10, text:'把任意装备强化到 +10' } ],
    reward:{ gold:12000, exp:250000 },
    outro:'淬火完成。你的影子在雷光里站得笔直。',
    tip:'找铁匠把装备强化到 +10，高级强化石在高阶副本出。' },

  { id:'q23', chapter:'第七章', title:'峰顶雷神',
    brief:'峰顶雷云翻滚，天神·雷神在此等候。',
    steps:[ { type:'clear', level:17, text:'通关「天雷峰·峰顶」' } ],
    reward:{ gold:15000, sp:7, equip:2, exp:300000 },
    outro:'雷神收了锤子：「你师父当年也是这样，被劈了七次还不肯放灯。」',
    tip:'最后一盏灯，在魔尊殿。刷「天雷峰」到 57 级。' },

  /* ── 第八章 · 魔尊殿（Lv.57~60）── */
  { id:'q24', chapter:'第八章', title:'魔尊前厅',
    brief:'魔尊殿的前厅有护卫拦路，先打通前厅。',
    steps:[ { type:'clear', level:18, text:'通关「魔尊殿·前厅」' } ],
    reward:{ gold:20000, sp:7, equip:2, exp:350000 },
    outro:'护卫倒下后，魔尊殿的大门缓缓打开。',
    tip:'这是最后的战斗，准备好一切。' },

  { id:'q25', chapter:'第八章', title:'魔尊是灯的影子',
    brief:'魔尊殿没有魔尊，只有第一代守灯人的影子。他点第九灯时，被灯火烧成了这样。',
    steps:[ { type:'clear', level:19, text:'通关「魔尊殿·魔尊殿」' } ],
    reward:{ gold:30000, sp:8, equip:2, exp:500000 },
    outro:'影子说：「我不是要灭灯。我是想让灯……照到我自己一次。」',
    tip:'最后一战。九灯将明。' },

  { id:'q26', chapter:'终章', title:'九灯归位',
    brief:'九灯将亮。墟界的天穹裂口正在合拢，而你还要走最后一段。',
    steps:[ { type:'clear', level:24, text:'通关「深渊·子夜鬼门」' } ],
    reward:{ gold:50000, sp:10, equip:3, exp:1000000, mats:{ enhance_stone_high:5, chaos_stone:8 } },
    outro:'第九盏灯亮起来的时候，你终于听清师父那句话的后半段——',
    tip:'「……记住人，人就不会真的死。」' }
];

let DIALOGUE = null;
let questToast = null;

function questOf(p){
  if(!p) return null;
  if(!p.quest) p.quest = { idx:0, step:0, done:[] };
  return p.quest;
}
function currentQuest(p){
  const q = questOf(p);
  if(!q) return null;
  return MAIN_QUESTS[q.idx] || null;
}
function maxEnhanceLv(p){
  let mx = 0;
  if(!p || !p.equipment) return 0;
  for(const k in p.equipment){ const eq = p.equipment[k]; if(eq) mx = Math.max(mx, eq.enhance || 0); }
  return mx;
}
function questStepDone(p, st){
  if(!st) return false;
  switch(st.type){
    case 'story': {
      /* 老存档里没有 prologueSeen：只要已经玩过（升级过 / 任务推进过）就算听完 */
      const played = (p.level | 0) > 1 || (p.quest && p.quest.idx > 0);
      return !!(p.prologueSeen || (p.quest && p.quest.storyDone) || played);
    }
    case 'level': return (p.level || 1) >= st.level;
    case 'clear': return (p.clearedLevels || []).indexOf(st.level) >= 0;
    case 'kills': { /* 击杀数按"接取该步之后"计数（DNF式委托），避免旧击杀直接完成任务 */
      const base = (p.quest && p.quest.killsBase) || 0;
      return ((p.questKills || 0) - base) >= st.count;
    }
    case 'enhance': return maxEnhanceLv(p) >= st.lv;
    case 'collect': return (((p.materials || {})[st.mat]) || 0) >= st.count;
    default: return false;
  }
}

/* ★ DNF式任务跳过：根据任务索引返回"解锁等级"，玩家等级达到后可跳过前置任务 */
function questUnlockLevel(idx){
  if(idx < 0 || idx >= MAIN_QUESTS.length) return 999;
  /* 章节对应的解锁等级 */
  const chapterLevels = {
    '序章': 1,
    '第一章': 7,   /* Lv.1~7 */
    '第二章': 13,  /* Lv.7~13 */
    '第三章': 22,  /* Lv.13~22 */
    '第四章': 31,  /* Lv.22~31 */
    '第五章': 41,  /* Lv.31~41 */
    '第六章': 51,  /* Lv.41~51 */
    '深渊': 50,    /* Lv.50+ */
    '第七章': 57,  /* Lv.51~57 */
    '第八章': 60,  /* Lv.57~60 */
    '终章': 60
  };
  const mq = MAIN_QUESTS[idx];
  return chapterLevels[mq.chapter] || 999;
}

/* ★ 检查任务是否可以跳过（玩家等级已达到该任务所在章节的解锁等级） */
function canSkipQuest(p, idx){
  if(!p || idx < 0) return false;
  const q = questOf(p);
  if(!q) return false;
  /* 只能跳过当前任务之前的任务 */
  if(idx >= q.idx) return false;
  /* 已经完成的不能跳过 */
  if(q.done.indexOf(MAIN_QUESTS[idx].id) >= 0) return false;
  /* 玩家等级达到该任务的解锁等级 */
  const unlockLv = questUnlockLevel(idx);
  return (p.level || 1) >= unlockLv;
}

