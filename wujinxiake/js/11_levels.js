/* ===== 关卡配置：无限递进系统 =====
   ★ 怪物投放原则：按"人形 → 野兽 → 阴兵 → 妖怪 → 魔兽 → 神兽 → 魔"的叙事递进，
     前期只出山贼人形（新手看得懂、打得动），越往后越奇诡。
   ★ bossPool：主 BOSS + 轮回轮换池，让每个有辨识度的角色都有机会当领主。 */
const LEVEL_TEMPLATES = [
  /* 第 1 章：乱石岗 —— 纯人形山贼，新手教学关 */
  { name:'乱石岗', desc:'山贼盘踞，先拿他们练手', theme:0, minLevel:1, maxLevel:5,
    waves:[
      ['bandit','bandit','bandit','bandit','bandit'],
      ['bandit','bandit','bandit','bandit','brute','bandit'],
      ['bandit','bandit','brute','brute','assassin','bandit','assassin'],
      ['bandit','bandit','brute','brute','assassin','assassin','bandit','brute']
    ],
    boss:'boss', bossName:'寨主·刀疤', bossPool:['boss'],
    bossHpMul:18.0, bossAtkMul:4.6, bossScaleMul:2.1 },

  /* 第 2 章：野狼谷 —— 野兽登场 */
  { name:'野狼谷', desc:'狼群环伺，注意它们的突进', theme:0, minLevel:6, maxLevel:10,
    waves:[
      ['wolf','wolf','wolf','wolf','wolf'],
      ['wolf','wolf','wolf','bandit','wolf','bandit','wolf'],
      ['wolf','wolf','bandit','brute','wolf','wolf','bandit','brute'],
      ['wolf','wolf','wolf','brute','brute','assassin','wolf','wolf','bandit']
    ],
    boss:'bear', bossName:'巨熊王', bossPool:['bear'],
    bossHpMul:22.0, bossAtkMul:5.2, bossScaleMul:2.3 },

  /* 第 3 章：阴兵道 —— 不死系，开始有远程与幽灵 */
  { name:'阴兵道', desc:'阴兵借道，百鬼夜行', theme:0, minLevel:11, maxLevel:20,
    waves:[
      ['ghost','ghost','skeleton','skeleton','bat','ghost'],
      ['ghost','skeleton','skeleton','bat','bat','demon_soldier','ghost'],
      ['ghost','ghost','skeleton','skeleton','demon_soldier','demon_soldier','bat','ghost'],
      ['skeleton','skeleton','demon_soldier','demon_soldier','ghost','ghost','bat','bat','skeleton']
    ],
    boss:'skeleton', bossName:'骷髅将军', bossPool:['skeleton'],
    bossHpMul:25.0, bossAtkMul:5.8, bossScaleMul:2.4 },

  /* 第 4 章：妖魔岭 —— 妖怪系，毒与束缚 */
  { name:'妖魔岭', desc:'妖气弥漫，毒物与幻术', theme:1, minLevel:21, maxLevel:30,
    waves:[
      ['fox','fox','spider','spider','snake'],
      ['fox','fox','spider','snake','snake','scorpion','fox'],
      ['fox','spider','spider','snake','scorpion','scorpion','tree_demon','fox'],
      ['fox','fox','snake','snake','scorpion','scorpion','tree_demon','tree_demon','spider']
    ],
    boss:'fox', bossName:'九尾妖狐', bossPool:['fox','tree_demon'],
    bossHpMul:26.0, bossAtkMul:6.0, bossScaleMul:2.3 },

  /* 第 5 章：万兽谷 —— 魔兽，高速与高伤 */
  { name:'万兽谷', desc:'魔兽聚集，兽吼震天', theme:0, minLevel:31, maxLevel:40,
    waves:[
      ['tiger','tiger','wolf','wolf','bear'],
      ['tiger','tiger','bear','bear','eagle','eagle','wolf'],
      ['tiger','bear','bear','snake','eagle','tiger','wolf','wolf'],
      ['tiger','tiger','bear','bear','eagle','eagle','dragon','tiger']
    ],
    boss:'dragon', bossName:'远古青龙', bossPool:['dragon','qilin','phoenix'],
    bossHpMul:30.0, bossAtkMul:6.6, bossScaleMul:2.7 },

  /* 第 6 章：幽冥殿 —— 阴兵精锐，法系压制 */
  { name:'幽冥殿', desc:'阴兵列阵，法术如雨', theme:1, minLevel:41, maxLevel:50,
    waves:[
      ['demon_soldier','demon_soldier','demon_soldier','ghost','ghost','skeleton'],
      ['demon_soldier','demon_soldier','demon_mage','skeleton','skeleton','ghost','demon_mage'],
      ['demon_soldier','demon_soldier','demon_mage','demon_mage','ghost','ghost','dragon'],
      ['demon_soldier','demon_mage','demon_mage','demon_mage','dragon','dragon','ghost','ghost']
    ],
    boss:'demon_mage', bossName:'阴兵统帅·魔将', bossPool:['demon_mage','fire_god'],
    bossHpMul:31.0, bossAtkMul:6.8, bossScaleMul:2.4 },

  /* 第 7 章：天雷峰 —— 神兽，全屏技能 */
  { name:'天雷峰', desc:'神兽降世，天威难测', theme:2, minLevel:51, maxLevel:60,
    waves:[
      ['phoenix','phoenix','qilin','eagle','eagle','qilin'],
      ['phoenix','phoenix','qilin','qilin','dragon','eagle','dragon'],
      ['phoenix','qilin','qilin','dragon','dragon','demon_mage','demon_mage'],
      ['phoenix','phoenix','qilin','qilin','dragon','dragon','eagle','eagle']
    ],
    boss:'thunder_god', bossName:'天神·雷神', bossPool:['thunder_god','fire_god'],
    bossHpMul:35.0, bossAtkMul:7.6, bossScaleMul:2.8 },

  /* 第 8 章：魔尊殿 —— 终极 */
  { name:'魔尊殿', desc:'魔尊降临，终极一战', theme:1, minLevel:60, maxLevel:60,
    waves:[
      ['demon_mage','demon_mage','demon_soldier','demon_soldier','ghost'],
      ['demon_mage','demon_mage','demon_soldier','dragon','ghost','ghost','dragon'],
      ['demon_mage','demon_mage','demon_mage','dragon','dragon','tiger','tiger','phoenix'],
      ['dragon','dragon','dragon','demon_mage','demon_mage','qilin','qilin','phoenix']
    ],
    boss:'dark_lord', bossName:'魔尊', bossPool:['dark_lord'],
    bossHpMul:45.0, bossAtkMul:9.0, bossScaleMul:3.2 },

  /* ============================================================
     ★ 终局四窟（第 9 ~ 12 关）：给满级玩家准备的挑战线
     世界观：九灯之外还有「灯外之地」，那里的东西不认灯。
     ============================================================ */

  /* 第 9 章：落霞古渡 —— 水乡，阴兵借道，怨魄成群 */
  { name:'落霞古渡', desc:'渡口无舟，只有撑船的影子', theme:3, minLevel:56, maxLevel:60,
    waves:[
      ['ghost_wraith','ghost_wraith','bandit_archer','bandit_archer','demon_soldier'],
      ['ghost_wraith','ghost_wraith','demon_soldier','demon_soldier','spider','bandit_archer'],
      ['ghost_wraith','ghost_wraith','ghost_wraith','spider','spider','demon_mage','bandit_archer'],
      ['ghost_wraith','ghost_wraith','spider','spider','demon_mage','demon_mage','demon_soldier','demon_soldier']
    ],
    boss:'spider_queen', bossName:'渡口·蛛后', bossPool:['spider_queen','fox'],
    bossHpMul:34.0, bossAtkMul:7.4, bossScaleMul:2.6 },

  /* 第 10 章：枯骨佛窟 —— 佛前的骨头也会站起来 */
  { name:'枯骨佛窟', desc:'佛前无香，只有骨', theme:4, minLevel:57, maxLevel:60,
    waves:[
      ['skeleton_mage','skeleton','skeleton','ghost_wraith','tree_demon'],
      ['skeleton_mage','skeleton_mage','skeleton','ghost_wraith','ghost_wraith','tree_demon'],
      ['skeleton_mage','skeleton_mage','skeleton','skeleton','tree_demon','tree_demon','ghost_wraith'],
      ['skeleton_mage','skeleton_mage','skeleton_mage','tree_demon','tree_demon','ghost_wraith','ghost_wraith','skeleton']
    ],
    boss:'skeleton_mage', bossName:'佛窟·骨咒师', bossPool:['skeleton_mage','skeleton'],
    bossHpMul:32.0, bossAtkMul:7.2, bossScaleMul:2.5 },

  /* 第 11 章：焚天火窟 —— 火里的东西从不需要灯 */
  { name:'焚天火窟', desc:'岩在烧，气在烧，你也在烧', theme:5, minLevel:58, maxLevel:60,
    waves:[
      ['dragon_flame','dragon_flame','demon_mage','demon_mage','phoenix_dark'],
      ['dragon_flame','dragon_flame','phoenix_dark','phoenix_dark','demon_mage','demon_soldier'],
      ['dragon_flame','dragon_flame','dragon_flame','phoenix_dark','demon_mage','demon_mage','demon_soldier'],
      ['dragon_flame','dragon_flame','dragon_flame','phoenix_dark','phoenix_dark','demon_mage','demon_mage','demon_soldier']
    ],
    boss:'dragon_flame', bossName:'火窟·赤炎龙', bossPool:['dragon_flame','fire_god','phoenix_dark'],
    bossHpMul:36.0, bossAtkMul:7.8, bossScaleMul:2.7 },

  /* ============================================================
     ★ 深渊五境（第 13 ~ 17 关）：50 级准入，Boss 难度约为对应
     等级普通 Boss 的 10 倍（血量×10 / 攻击×2 / 体型+0.6），
     小怪少而精，传说/史诗掉率大增。小怪按十二生肖取材，
     Boss 取自神话谱系。
     ============================================================ */

  /* 深渊一：子夜鬼门 —— 子鼠当值，鬼门鼠妖昼伏夜出 */
  { name:'深渊·子夜鬼门', desc:'子时已到，门后没有活人', theme:1, minLevel:50, maxLevel:60, isAbyss:true,
    waves:[
      ['zrat','zrat','ghost','ghost','bat'],
      ['zrat','zrat','skeleton','bat','bat','ghost']
    ],
    boss:'abthunder', bossName:'子帝·玄夜雷君', bossPool:['abthunder'],
    bossHpMul:350.0, bossAtkMul:14.0, bossScaleMul:3.4,
    enemyHpMul:8.0, enemyAtkMul:3.2, enemySpdMul:1.2 },

  /* 深渊二：丑牛铁壁 —— 丑牛当值，蛮牛豪猪如墙推进 */
  { name:'深渊·丑牛铁壁', desc:'牛角撞碎过三次城门', theme:0, minLevel:52, maxLevel:60, isAbyss:true,
    waves:[
      ['zox','zox','zboar','zboar','brute'],
      ['zox','zboar','zboar','brute','brute','zgoat']
    ],
    boss:'abbull', bossName:'丑罡·铁壁牛魔', bossPool:['abbull'],
    bossHpMul:450.0, bossAtkMul:18.0, bossScaleMul:3.8,
    enemyHpMul:9.0, enemyAtkMul:3.5, enemySpdMul:1.1 },

  /* 深渊三：寅虎啸林 —— 寅虎当值，玉兔斥候与冥犬让路 */
  { name:'深渊·寅虎啸林', desc:'虎啸过处，连风都跪着走', theme:0, minLevel:54, maxLevel:60, isAbyss:true,
    waves:[
      ['zrabbit','zrabbit','zdog','zdog','tiger'],
      ['zrabbit','zdog','zdog','tiger','tiger','zrat']
    ],
    boss:'abtiger', bossName:'寅啸·风虎麒麟', bossPool:['abtiger'],
    bossHpMul:520.0, bossAtkMul:21.0, bossScaleMul:3.6,
    enemyHpMul:10.0, enemyAtkMul:3.8, enemySpdMul:1.35 },

  /* 深渊四：辰渊龙墟 —— 辰龙当值，天马金鸡巡狩龙骨之原 */
  { name:'深渊·辰渊龙墟', desc:'龙骨为山，龙血为河', theme:2, minLevel:56, maxLevel:60, isAbyss:true,
    waves:[
      ['zhorse','zhorse','zrooster','zrooster','zgoat'],
      ['zhorse','zrooster','zrooster','zgoat','zgoat','dragon']
    ],
    boss:'abdragon', bossName:'辰帝·渊火龙皇', bossPool:['abdragon'],
    bossHpMul:620.0, bossAtkMul:25.0, bossScaleMul:3.9,
    enemyHpMul:11.0, enemyAtkMul:4.2, enemySpdMul:1.25 },

  /* 深渊五：巳狱毒渊 —— 巳蛇当值，毒猴蛇蝎汇成一口井 */
  { name:'深渊·巳狱毒渊', desc:'井底的东西比深渊更老', theme:1, minLevel:58, maxLevel:60, isAbyss:true,
    waves:[
      ['zmonkey','zmonkey','snake','snake','scorpion'],
      ['zmonkey','snake','snake','scorpion','scorpion','zdog']
    ],
    boss:'abserpent', bossName:'巳祖·万毒蛇渊', bossPool:['abserpent'],
    bossHpMul:760.0, bossAtkMul:30.0, bossScaleMul:4.0,
    enemyHpMul:12.0, enemyAtkMul:4.5, enemySpdMul:1.3 },

  /* 第 12 章：太墟剑冢 —— 九灯之外的第一道门 */
  { name:'太墟剑冢', desc:'万剑插地，剑柄朝天，像一片没有叶子的林', theme:6, minLevel:59, maxLevel:60,
    waves:[
      ['tiger_thunder','tiger_thunder','phoenix_dark','demon_mage','demon_mage'],
      ['tiger_thunder','tiger_thunder','phoenix_dark','phoenix_dark','dragon_flame','demon_soldier'],
      ['tiger_thunder','tiger_thunder','dragon_flame','dragon_flame','phoenix_dark','demon_mage','demon_mage'],
      ['tiger_thunder','tiger_thunder','tiger_thunder','dragon_flame','dragon_flame','phoenix_dark','phoenix_dark','demon_mage']
    ],
    boss:'void_lord', bossName:'灯外之物·墟主', bossPool:['void_lord','dark_lord'],
    bossHpMul:48.0, bossAtkMul:9.6, bossScaleMul:3.3 }
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

  // ★ DNF式数值递增：HP每关+10%，ATK每关+8%（更平滑的难度曲线）
  const chapter = Math.floor(levelIdx / TPL_N); // 每 TPL_N 关一个轮回
  const hpMul = Math.pow(1.10, levelIdx);
  const atkMul = Math.pow(1.08, levelIdx);
  const spdMul = Math.min(Math.pow(1.03, levelIdx), 1.5);

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
    bossHpMul: template.bossHpMul * (1 + chapter * 0.3),
    bossAtkMul: template.bossAtkMul * (1 + chapter * 0.2),
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
const PVP_SKILL_FRAC = [0.050, 0.065, 0.075, 0.090, 0.100, 0.120];

