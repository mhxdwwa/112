/* ===== 关卡配置：子地图系统 =====
   ★ 每个章节拆分为 2~3 个子地图，每个子地图有独立 Boss。
   ★ 等级跟着任务走：子地图的等级范围紧密衔接，玩家沿任务线自然升级。
   ★ 怪物投放原則：按"人形 → 野兽 → 阴兵 → 妖怪 → 魔兽 → 神兽 → 魔"的叙事递进。
   ★ bossPool：主 BOSS + 轮回轮换池，让每个有辨识度的角色都有机会当领主。

   索引总览：
   0~1   乱石岗（第一章·外围 / 匪寨）        Lv.1~7
   2~3   野狼谷（第二章·谷口 / 狼巢）        Lv.7~13
   4~6   阴兵道（第三章·前道 / 冥桥 / 幽室）  Lv.13~22
   7~9   妖魔岭（第四章·外岭 / 毒沼 / 妖窟）  Lv.22~31
   10~12 万兽谷（第五章·谷地 / 兽穴 / 麒麟崖）Lv.31~41
   13~15 幽冥殿（第六章·前殿 / 魔将殿 / 密库）Lv.41~51
   16~17 天雷峰（第七章·山脚 / 峰顶）        Lv.51~57
   18~19 魔尊殿（第八章·前厅 / 魔尊殿）      Lv.57~60
   20~23 终局四窟（落霞古渡 / 枯骨佛窟 / 焚天火窟 / 太墟剑冢）
   24~28 深渊五境
   ============================================================ */
const LEVEL_TEMPLATES = [
  /* ── 第一章 · 乱石岗（Lv.1~7）── 纯人形山贼，新手教学 ── */
  { name:'乱石岗·外围', desc:'山贼在外围设了哨卡，先拿他们练手', theme:0, minLevel:1, maxLevel:3,
    waves:[
      ['bandit','bandit','bandit','bandit','bandit'],
      ['bandit','bandit','bandit','bandit','brute','bandit'],
      ['bandit','bandit','brute','brute','assassin','bandit']
    ],
    boss:'bandit', bossName:'山贼哨兵', bossPool:['bandit','brute'],
    bossHpMul:6.0, bossAtkMul:1.6, bossScaleMul:1.6 },

  { name:'乱石岗·匪寨', desc:'山贼的老巢，寨主就在里面', theme:0, minLevel:4, maxLevel:7,
    waves:[
      ['bandit','bandit','brute','brute','assassin','bandit','assassin'],
      ['bandit','bandit','brute','brute','assassin','assassin','bandit','brute'],
      ['bandit','brute','brute','assassin','assassin','assassin','bandit','brute','brute']
    ],
    boss:'boss', bossName:'寨主·刀疤', bossPool:['boss'],
    bossHpMul:9.0, bossAtkMul:2.3, bossScaleMul:2.1 },

  /* ── 第二章 · 野狼谷（Lv.7~13）── 野兽登场 ── */
  { name:'野狼谷·谷口', desc:'狼群在谷口徘徊，注意它们的突进', theme:0, minLevel:7, maxLevel:9,
    waves:[
      ['wolf','wolf','wolf','wolf','wolf'],
      ['wolf','wolf','wolf','bandit','wolf','bandit','wolf'],
      ['wolf','wolf','bandit','brute','wolf','wolf','bandit']
    ],
    boss:'wolf', bossName:'灰狼头领', bossPool:['wolf','bear'],
    bossHpMul:8.0, bossAtkMul:2.0, bossScaleMul:1.8 },

  { name:'野狼谷·狼巢', desc:'狼巢深处，巨熊也在觊觎', theme:0, minLevel:10, maxLevel:13,
    waves:[
      ['wolf','wolf','wolf','brute','brute','wolf'],
      ['wolf','wolf','brute','brute','assassin','wolf','wolf','bandit'],
      ['wolf','wolf','wolf','brute','brute','assassin','wolf','wolf','bandit']
    ],
    boss:'bear', bossName:'巨熊王', bossPool:['bear'],
    bossHpMul:11.0, bossAtkMul:2.6, bossScaleMul:2.3 },

  /* ── 第三章 · 阴兵道（Lv.13~22）── 不死系，远程与幽灵 ── */
  { name:'阴兵道·前道', desc:'阴兵借道，鬼火引路', theme:0, minLevel:13, maxLevel:15,
    waves:[
      ['ghost','ghost','skeleton','skeleton','bat','ghost'],
      ['ghost','skeleton','skeleton','bat','bat','demon_soldier','ghost'],
      ['ghost','ghost','skeleton','skeleton','demon_soldier','bat','ghost']
    ],
    boss:'ghost', bossName:'鬼火引路者', bossPool:['ghost','bat'],
    bossHpMul:10.0, bossAtkMul:2.4, bossScaleMul:1.9 },

  { name:'阴兵道·冥桥', desc:'冥桥之上，骷髅将军镇守', theme:0, minLevel:16, maxLevel:18,
    waves:[
      ['ghost','ghost','skeleton','skeleton','demon_soldier','demon_soldier','bat','ghost'],
      ['skeleton','skeleton','demon_soldier','demon_soldier','ghost','ghost','bat','bat','skeleton'],
      ['skeleton','ghost','demon_soldier','demon_soldier','ghost','bat','skeleton','bat','ghost']
    ],
    boss:'skeleton', bossName:'骷髅将军', bossPool:['skeleton'],
    bossHpMul:12.5, bossAtkMul:2.9, bossScaleMul:2.4 },

  { name:'阴兵道·幽室', desc:'幽室深处，阴兵队长列阵以待', theme:0, minLevel:19, maxLevel:22,
    waves:[
      ['skeleton','skeleton','demon_soldier','demon_soldier','ghost','ghost','bat','bat'],
      ['demon_soldier','demon_soldier','skeleton','ghost','ghost','bat','skeleton','demon_soldier'],
      ['demon_soldier','demon_soldier','demon_soldier','skeleton','ghost','ghost','bat','bat','skeleton','demon_soldier']
    ],
    boss:'demon_soldier', bossName:'阴兵队长', bossPool:['demon_soldier','skeleton'],
    bossHpMul:13.5, bossAtkMul:3.0, bossScaleMul:2.3 },

  /* ── 第四章 · 妖魔岭（Lv.22~31）── 妖怪系，毒与幻术 ── */
  { name:'妖魔岭·外岭', desc:'妖气弥漫，狐妖出没', theme:1, minLevel:22, maxLevel:24,
    waves:[
      ['fox','fox','spider','spider','snake'],
      ['fox','fox','spider','snake','snake','scorpion','fox'],
      ['fox','spider','spider','snake','scorpion','fox','fox']
    ],
    boss:'fox', bossName:'狐妖', bossPool:['fox','snake'],
    bossHpMul:12.0, bossAtkMul:2.7, bossScaleMul:2.0 },

  { name:'妖魔岭·毒沼', desc:'毒沼深处，蛛母织网', theme:1, minLevel:25, maxLevel:27,
    waves:[
      ['fox','spider','spider','snake','scorpion','scorpion','tree_demon','fox'],
      ['fox','fox','snake','snake','scorpion','scorpion','tree_demon','tree_demon','spider'],
      ['spider','spider','snake','scorpion','scorpion','tree_demon','tree_demon','fox','fox']
    ],
    boss:'spider', bossName:'蛛母', bossPool:['spider','tree_demon'],
    bossHpMul:13.0, bossAtkMul:2.9, bossScaleMul:2.2 },

  { name:'妖魔岭·妖窟', desc:'妖窟最深处，九尾妖狐的真身', theme:1, minLevel:28, maxLevel:31,
    waves:[
      ['fox','fox','snake','snake','scorpion','scorpion','tree_demon','tree_demon'],
      ['fox','spider','spider','tree_demon','tree_demon','snake','scorpion','fox','fox'],
      ['fox','fox','spider','tree_demon','tree_demon','snake','snake','scorpion','scorpion','fox']
    ],
    boss:'fox', bossName:'九尾妖狐', bossPool:['fox','tree_demon'],
    bossHpMul:15.0, bossAtkMul:3.2, bossScaleMul:2.5 },

  /* ── 第五章 · 万兽谷（Lv.31~41）── 魔兽，高速与高伤 ── */
  { name:'万兽谷·谷地', desc:'魔兽聚集，兽吼震天', theme:0, minLevel:31, maxLevel:33,
    waves:[
      ['tiger','tiger','wolf','wolf','bear'],
      ['tiger','tiger','bear','bear','eagle','eagle','wolf'],
      ['tiger','bear','bear','snake','eagle','tiger','wolf']
    ],
    boss:'tiger', bossName:'猛虎王', bossPool:['tiger','bear'],
    bossHpMul:14.0, bossAtkMul:3.1, bossScaleMul:2.4 },

  { name:'万兽谷·兽穴', desc:'兽穴深处，远古青龙盘踞', theme:0, minLevel:34, maxLevel:37,
    waves:[
      ['tiger','tiger','bear','bear','eagle','eagle','dragon','tiger'],
      ['tiger','bear','bear','eagle','dragon','tiger','wolf','wolf','eagle'],
      ['tiger','tiger','dragon','bear','eagle','eagle','tiger','tiger','wolf']
    ],
    boss:'dragon', bossName:'远古青龙', bossPool:['dragon','qilin'],
    bossHpMul:16.0, bossAtkMul:3.4, bossScaleMul:2.7 },

  { name:'万兽谷·麒麟崖', desc:'麒麟崖上，火麒麟怒视来者', theme:0, minLevel:38, maxLevel:41,
    waves:[
      ['tiger','tiger','dragon','dragon','eagle','eagle','qilin','tiger'],
      ['dragon','dragon','qilin','tiger','eagle','tiger','bear','bear','eagle'],
      ['tiger','dragon','dragon','qilin','qilin','eagle','eagle','tiger','tiger','dragon']
    ],
    boss:'qilin', bossName:'火麒麟', bossPool:['qilin','dragon','phoenix'],
    bossHpMul:17.5, bossAtkMul:3.6, bossScaleMul:2.8 },

  /* ── 第六章 · 幽冥殿（Lv.41~51）── 阴兵精锐，法系压制 ── */
  { name:'幽冥殿·前殿', desc:'阴兵列阵，前殿守卫森严', theme:1, minLevel:41, maxLevel:43,
    waves:[
      ['demon_soldier','demon_soldier','demon_soldier','ghost','ghost','skeleton'],
      ['demon_soldier','demon_soldier','demon_mage','skeleton','skeleton','ghost','demon_mage'],
      ['demon_soldier','demon_soldier','demon_mage','ghost','ghost','skeleton','demon_mage']
    ],
    boss:'demon_soldier', bossName:'幽冥守卫', bossPool:['demon_soldier','skeleton'],
    bossHpMul:15.0, bossAtkMul:3.2, bossScaleMul:2.3 },

  { name:'幽冥殿·魔将殿', desc:'魔将殿中，阴兵魔将法力无边', theme:1, minLevel:44, maxLevel:47,
    waves:[
      ['demon_soldier','demon_mage','demon_mage','ghost','ghost','dragon'],
      ['demon_soldier','demon_mage','demon_mage','demon_mage','dragon','dragon','ghost','ghost'],
      ['demon_mage','demon_mage','demon_soldier','dragon','dragon','ghost','ghost','skeleton']
    ],
    boss:'demon_mage', bossName:'阴兵魔将', bossPool:['demon_mage','fire_god'],
    bossHpMul:16.5, bossAtkMul:3.5, bossScaleMul:2.5 },

  { name:'幽冥殿·密库', desc:'密库深处，幽冥殿主亲自出手', theme:1, minLevel:48, maxLevel:51,
    waves:[
      ['demon_mage','demon_mage','demon_mage','dragon','dragon','ghost','ghost'],
      ['demon_soldier','demon_mage','demon_mage','dragon','dragon','ghost','ghost','skeleton'],
      ['demon_mage','demon_mage','demon_mage','demon_mage','dragon','dragon','ghost','ghost','skeleton','demon_soldier']
    ],
    boss:'demon_mage', bossName:'幽冥殿主', bossPool:['demon_mage','fire_god'],
    bossHpMul:18.0, bossAtkMul:3.7, bossScaleMul:2.6 },

  /* ── 第七章 · 天雷峰（Lv.51~57）── 神兽，全屏技能 ── */
  { name:'天雷峰·山脚', desc:'神兽降世，天威难测', theme:2, minLevel:51, maxLevel:53,
    waves:[
      ['phoenix','phoenix','qilin','eagle','eagle','qilin'],
      ['phoenix','phoenix','qilin','qilin','dragon','eagle','dragon'],
      ['phoenix','qilin','qilin','dragon','eagle','eagle','dragon']
    ],
    boss:'phoenix', bossName:'雷兽·朱雀', bossPool:['phoenix','qilin'],
    bossHpMul:17.0, bossAtkMul:3.6, bossScaleMul:2.6 },

  { name:'天雷峰·峰顶', desc:'峰顶雷云翻滚，天神·雷神在此', theme:2, minLevel:54, maxLevel:57,
    waves:[
      ['phoenix','phoenix','qilin','qilin','dragon','dragon','eagle','eagle'],
      ['phoenix','qilin','dragon','dragon','qilin','eagle','phoenix','phoenix'],
      ['phoenix','phoenix','qilin','qilin','dragon','dragon','eagle','eagle','thunder_god']
    ],
    boss:'thunder_god', bossName:'天神·雷神', bossPool:['thunder_god','fire_god'],
    bossHpMul:19.0, bossAtkMul:3.9, bossScaleMul:2.8 },

  /* ── 第八章 · 魔尊殿（Lv.57~60）── 终极 ── */
  { name:'魔尊殿·前厅', desc:'魔尊殿前，护卫拦路', theme:1, minLevel:57, maxLevel:59,
    waves:[
      ['demon_mage','demon_mage','demon_soldier','demon_soldier','ghost'],
      ['demon_mage','demon_mage','demon_soldier','dragon','ghost','ghost','dragon'],
      ['demon_mage','demon_mage','demon_mage','dragon','dragon','tiger','tiger']
    ],
    boss:'dark_lord', bossName:'魔尊护卫', bossPool:['dark_lord','demon_mage'],
    bossHpMul:20.0, bossAtkMul:4.1, bossScaleMul:2.8 },

  { name:'魔尊殿·魔尊殿', desc:'魔尊降临，终极一战', theme:1, minLevel:60, maxLevel:60,
    waves:[
      ['dragon','dragon','dragon','demon_mage','demon_mage','qilin','qilin','phoenix'],
      ['demon_mage','demon_mage','dragon','dragon','phoenix','qilin','tiger','tiger'],
      ['dragon','dragon','dragon','demon_mage','demon_mage','qilin','qilin','phoenix','dark_lord']
    ],
    boss:'dark_lord', bossName:'魔尊', bossPool:['dark_lord'],
    bossHpMul:24.0, bossAtkMul:4.6, bossScaleMul:3.2 },

  /* ============================================================
     ★ 终局四窟（索引 20~23）：给满级玩家准备的挑战线
     世界观：九灯之外还有「灯外之地」，那里的东西不认灯。
     ============================================================ */
  { name:'落霞古渡', desc:'渡口无舟，只有撑船的影子', theme:3, minLevel:56, maxLevel:60,
    waves:[
      ['ghost_wraith','ghost_wraith','bandit_archer','bandit_archer','demon_soldier'],
      ['ghost_wraith','ghost_wraith','demon_soldier','demon_soldier','spider','bandit_archer'],
      ['ghost_wraith','ghost_wraith','ghost_wraith','spider','spider','demon_mage','bandit_archer'],
      ['ghost_wraith','ghost_wraith','spider','spider','demon_mage','demon_mage','demon_soldier','demon_soldier']
    ],
    boss:'spider_queen', bossName:'渡口·蛛后', bossPool:['spider_queen','fox'],
    bossHpMul:17.0, bossAtkMul:3.7, bossScaleMul:2.6 },

  { name:'枯骨佛窟', desc:'佛前无香，只有骨', theme:4, minLevel:57, maxLevel:60,
    waves:[
      ['skeleton_mage','skeleton','skeleton','ghost_wraith','tree_demon'],
      ['skeleton_mage','skeleton_mage','skeleton','ghost_wraith','ghost_wraith','tree_demon'],
      ['skeleton_mage','skeleton_mage','skeleton','skeleton','tree_demon','tree_demon','ghost_wraith'],
      ['skeleton_mage','skeleton_mage','skeleton_mage','tree_demon','tree_demon','ghost_wraith','ghost_wraith','skeleton']
    ],
    boss:'skeleton_mage', bossName:'佛窟·骨咒师', bossPool:['skeleton_mage','skeleton'],
    bossHpMul:16.0, bossAtkMul:3.6, bossScaleMul:2.5 },

  { name:'焚天火窟', desc:'岩在烧，气在烧，你也在烧', theme:5, minLevel:58, maxLevel:60,
    waves:[
      ['dragon_flame','dragon_flame','demon_mage','demon_mage','phoenix_dark'],
      ['dragon_flame','dragon_flame','phoenix_dark','phoenix_dark','demon_mage','demon_soldier'],
      ['dragon_flame','dragon_flame','dragon_flame','phoenix_dark','demon_mage','demon_mage','demon_soldier'],
      ['dragon_flame','dragon_flame','dragon_flame','phoenix_dark','phoenix_dark','demon_mage','demon_mage','demon_soldier']
    ],
    boss:'dragon_flame', bossName:'火窟·赤炎龙', bossPool:['dragon_flame','fire_god','phoenix_dark'],
    bossHpMul:18.0, bossAtkMul:3.9, bossScaleMul:2.7 },

  { name:'太墟剑冢', desc:'万剑插地，剑柄朝天，像一片没有叶子的林', theme:6, minLevel:59, maxLevel:60,
    waves:[
      ['tiger_thunder','tiger_thunder','phoenix_dark','demon_mage','demon_mage'],
      ['tiger_thunder','tiger_thunder','phoenix_dark','phoenix_dark','dragon_flame','demon_soldier'],
      ['tiger_thunder','tiger_thunder','dragon_flame','dragon_flame','phoenix_dark','demon_mage','demon_mage'],
      ['tiger_thunder','tiger_thunder','tiger_thunder','dragon_flame','dragon_flame','phoenix_dark','phoenix_dark','demon_mage']
    ],
    boss:'void_lord', bossName:'灯外之物·墟主', bossPool:['void_lord','dark_lord'],
    bossHpMul:24.0, bossAtkMul:4.8, bossScaleMul:3.3 },

  /* ============================================================
     ★ 深渊五境（索引 24~28）：50 级准入，Boss 难度约为对应
     等级普通 Boss 的 10 倍，小怪少而精，传说/史诗掉率大增。
     ============================================================ */
  { name:'深渊·子夜鬼门', desc:'子时已到，门后没有活人', theme:1, minLevel:50, maxLevel:60, isAbyss:true,
    waves:[
      ['zrat','zrat','ghost','ghost','bat'],
      ['zrat','zrat','skeleton','bat','bat','ghost']
    ],
    boss:'abthunder', bossName:'子帝·玄夜雷君', bossPool:['abthunder'],
    bossHpMul:117.0, bossAtkMul:7.05, bossScaleMul:3.4,
    enemyHpMul:2.7, enemyAtkMul:1.07, enemySpdMul:1.2 },

  { name:'深渊·丑牛铁壁', desc:'牛角撞碎过三次城门', theme:0, minLevel:52, maxLevel:60, isAbyss:true,
    waves:[
      ['zox','zox','zboar','zboar','brute'],
      ['zox','zboar','zboar','brute','brute','zgoat']
    ],
    boss:'abbull', bossName:'丑罡·铁壁牛魔', bossPool:['abbull'],
    bossHpMul:150.0, bossAtkMul:9.0, bossScaleMul:3.8,
    enemyHpMul:3.0, enemyAtkMul:1.17, enemySpdMul:1.1 },

  { name:'深渊·寅虎啸林', desc:'虎啸过处，连风都跪着走', theme:0, minLevel:54, maxLevel:60, isAbyss:true,
    waves:[
      ['zrabbit','zrabbit','zdog','zdog','tiger'],
      ['zrabbit','zdog','zdog','tiger','tiger','zrat']
    ],
    boss:'abtiger', bossName:'寅啸·风虎麒麟', bossPool:['abtiger'],
    bossHpMul:173.0, bossAtkMul:10.5, bossScaleMul:3.6,
    enemyHpMul:3.3, enemyAtkMul:1.27, enemySpdMul:1.35 },

  { name:'深渊·辰渊龙墟', desc:'龙骨为山，龙血为河', theme:2, minLevel:56, maxLevel:60, isAbyss:true,
    waves:[
      ['zhorse','zhorse','zrooster','zrooster','zgoat'],
      ['zhorse','zrooster','zrooster','zgoat','zgoat','dragon']
    ],
    boss:'abdragon', bossName:'辰帝·渊火龙皇', bossPool:['abdragon'],
    bossHpMul:207.0, bossAtkMul:12.45, bossScaleMul:3.9,
    enemyHpMul:3.7, enemyAtkMul:1.4, enemySpdMul:1.25 },

  { name:'深渊·巳狱毒渊', desc:'井底的东西比深渊更老', theme:1, minLevel:58, maxLevel:60, isAbyss:true,
    waves:[
      ['zmonkey','zmonkey','snake','snake','scorpion'],
      ['zmonkey','snake','snake','scorpion','scorpion','zdog']
    ],
    boss:'abserpent', bossName:'巳祖·万毒蛇渊', bossPool:['abserpent'],
    bossHpMul:253.0, bossAtkMul:15.0, bossScaleMul:4.0,
    enemyHpMul:4.0, enemyAtkMul:1.5, enemySpdMul:1.3 }
];

/* 无限关卡生成函数 */
function getLevelConfig(levelIdx){
  const TPL_N = LEVEL_TEMPLATES.length;
  const template = LEVEL_TEMPLATES[levelIdx % TPL_N];
  /* ★ 深渊五境：数值已按 ×10 难度写死在模板里，这里直通并给掉落加成 */
  if(template && template.isAbyss){
    return {
      name: template.name,
      desc: template.desc,
      theme: template.theme,
      waves: template.waves,
      boss: template.boss,
      bossName: template.bossName,
      bossHpMul: template.bossHpMul,
      bossAtkMul: template.bossAtkMul,
      bossScaleMul: template.bossScaleMul,
      enemyHpMul: template.enemyHpMul,
      enemyAtkMul: template.enemyAtkMul,
      enemySpdMul: template.enemySpdMul || 1.2,
      waveCount: template.waves.length,
      extraPerWave: 0,
      isAbyss: true,
      abyssDropBonus: 3   /* 深渊掉率加成：传说/史诗概率大增 */
    };
  }

  // ★ DNF式数值递增：HP每关+5%，ATK每关+4%（平滑的难度曲线，降低整体难度）
  const chapter = Math.floor(levelIdx / TPL_N); // 每 TPL_N 关一个轮回
  const hpMul = Math.pow(1.05, levelIdx);
  const atkMul = Math.pow(1.04, levelIdx);
  const spdMul = Math.min(Math.pow(1.015, levelIdx), 1.3);

  // 章节名称前缀（注意：chapter=0 时前缀就是空串，不能用 || 兜底，否则第 1 关会显示"轮回·"）
  const chapterNames = ['', '轮回·', '深渊·', '炼狱·', '混沌·', '无尽·'];
  const prefix = chapterNames[Math.min(chapter, chapterNames.length - 1)] ?? '轮回·';

  /* ★ BOSS 轮换：轮回后从 bossPool 里换一位领主，让每个特色角色都有登场机会 */
  const pool = template.bossPool || [template.boss];
  const bossKey = pool[chapter % pool.length];
  const bossLabel = (bossKey === template.boss)
    ? template.bossName
    : (ENEMY_TYPES[bossKey] ? ENEMY_TYPES[bossKey].name.replace(/^(怪物|魔兽|妖怪|神兽|阴兵|天神|鬼魂)·/, '') : template.bossName);

  /* ★ 波数：3 小怪房 + 1 BOSS 房为基准，每轮回多一波，最多 7 波 */
  const waveCount = Math.min(7, 4 + chapter);

  /* ★ 每波额外怪数：随关卡与轮回递增 */
  const extraPerWave = Math.min(8, Math.floor(levelIdx / 5) + chapter * 2);

  return {
    name: '第' + (levelIdx+1) + '关·' + prefix + template.name,
    desc: template.desc + (chapter > 0 ? '（第' + (chapter+1) + '轮回）' : ''),
    theme: template.theme,
    waves: template.waves,
    boss: bossKey,
    bossName: bossLabel + (chapter > 0 ? ' +' + chapter : ''),
    bossHpMul: template.bossHpMul * (1 + chapter * 0.15),
    bossAtkMul: template.bossAtkMul * (1 + chapter * 0.1),
    bossScaleMul: template.bossScaleMul,
    enemyHpMul: hpMul,
    enemyAtkMul: atkMul,
    enemySpdMul: spdMul,
    waveCount: waveCount,
    bossWaveIdx: waveCount - 1,
    extraPerWave: extraPerWave,
    isAbyss: false,
    abyssDropBonus: 0,
    minLevel: template.minLevel || 1
  };
}

const ENEMY_POOLS = {
  early:['bandit','wolf','bat','scorpion','assassin'],
  mid:['brute','bear','snake','spider','fox','ghost','skeleton'],
  late:['tiger','eagle','demon_soldier','tree_demon','dragon'],
  boss_pool:['phoenix','qilin','demon_mage','thunder_god','fire_god','dark_lord']
};
const PVP_BALANCE = {
  sword:{hp:3600,mp:180,atk:30,spd:340,atkMul:0.42,desc:'攻守兼备'},
  blade:{hp:3400,mp:170,atk:34,spd:300,atkMul:0.85,desc:'重击高伤'},
  spear:{hp:3450,mp:170,atk:33,spd:320,atkMul:1.13,desc:'长距控制'},
  fist:{hp:3800,mp:200,atk:26,spd:380,atkMul:1.40,desc:'迅捷连击'},
  herb:{hp:3300,mp:220,atk:28,spd:330,atkMul:0.98,desc:'毒愈双修'},
  axe:{hp:4000,mp:150,atk:40,spd:270,atkMul:1.42,desc:'一斧撼岳'},
  talisman:{hp:3250,mp:230,atk:32,spd:335,atkMul:1.02,desc:'符雷控场'},
  cauldron:{hp:3550,mp:210,atk:35,spd:300,atkMul:1.18,desc:'炉火焚天'}
};
/* ★ PK 技能伤害预算：一次技能合计打掉目标最大生命的百分比
   六招合计 5.0% + 6.5% + 7.5% + 9% + 10% + 12% = 50% */
/* ★ 练习模式（本地对战）技能伤害预算：每招占总生命的比例
   原来 6 招合计仅 50%，对战拖太久；现提高到合计约 85%，一套技能+普攻即可分胜负
   （单招最高 17%，仍不会一击秒杀） */
const PVP_SKILL_FRAC = [0.110, 0.125, 0.135, 0.145, 0.160, 0.175];

