/* ===== DNF式技能成长规则 =====
   · 每个技能有独立的「学习等级 / 最高等级 / 每级SP消耗」
   · 角色每升1级获得固定SP（有限），技能点不足时无法升级
   · 技能等级每+1，技能伤害 +6%（线性叠加）
*/
const SP_PER_LEVEL = 4;          // 每级获得技能点
const SP_START = 4;              // 初始技能点
const SKILL_DMG_PER_LV = 0.06;   // 每级技能伤害成长

function skillMaxLv(sk){ return (sk && sk.maxLv) ? sk.maxLv : 20; }

/* ★ DNF 式「等级门槛」：技能能升到几级，跟着角色等级走
     · 基础技能（SP 阶梯 1）：角色每升 2 级，技能上限 +1
     · 高阶技能（SP 阶梯 ≥2）：角色每升 3 级，技能上限 +1
     · 上限不超过技能自身的 maxLv
   例：学习等级 1、最高 20 的基础技 → 角色 Lv.39 才能点满
       学习等级 30、最高 10 的觉醒技 → 角色 Lv.57 才能点满 */
function skillLvCap(p, sk){
  if(!sk) return 0;
  const maxLv = skillMaxLv(sk);
  const learn = sk.unlock || 1;
  const lv = (p && p.level) || 1;
  if(lv < learn) return 0;                 /* 还没学到 */
  const step = (sk.spStep || 0) >= 2 ? 3 : 2;
  return Math.max(1, Math.min(maxLv, 1 + Math.floor((lv - learn) / step)));
}
/* 再升 1 级技能还差多少角色等级（已经到技能上限时返回 0） */
function skillNextLvNeed(p, sk){
  if(!sk) return 0;
  const cap = skillLvCap(p, sk);
  if(cap >= skillMaxLv(sk)) return 0;
  const step = (sk.spStep || 0) >= 2 ? 3 : 2;
  return (sk.unlock || 1) + cap * step;
}
/* 从 curLv 升到 curLv+1 所需SP（每5级涨一次价，DNF式阶梯） */
function skillSpCost(sk, curLv){
  if(!sk) return 3;
  const base = sk.spCost || 3;
  const step = sk.spStep || 0;
  return base + Math.floor(Math.max(1, curLv) / 5) * step;
}
/* 已经投入在该技能上的SP总量 */
function skillSpent(sk, curLv){
  let total = 0;
  for(let lv = 1; lv < (curLv || 0); lv++) total += skillSpCost(sk, lv);
  return total;
}
function skillDmgMul(p, idx){
  const lv = (p && p.skillLevels && p.skillLevels[idx]) || 1;
  return 1 + (lv - 1) * SKILL_DMG_PER_LV;
}
/* 技能伤害基数：基础攻击 × 武器倍率 × 技能等级加成 */
function skillAtkVal(p){
  const w = WEAPONS[p.weaponIdx];
  let v = p.atk * (w ? w.atkMul : 1.0);
  if(currentSkillIdx >= 0) v *= skillDmgMul(p, currentSkillIdx);
  /* 魔法系职业：智力转化为技能伤害加成 */
  if(p.skillIntBonus) v *= (1 + p.skillIntBonus);
  return v;
}

const ENEMY_TYPES = {
  bandit:{name:'怪物·山贼',hp:65,atk:9,spd:78,reach:90,exp:12,weapon:'blade',scale:1.0,maxMp:30,pal:{skin:'#f0d9b8',cloth:'#a8332a',cloth2:'#6a1610',belt:'#2a1a10',hat:'#4a1f14',pants:'#2a1a10'}},
  brute:{name:'怪物·力士',hp:150,atk:16,spd:52,reach:105,exp:28,weapon:'axe',scale:1.25,maxMp:50,pal:{skin:'#d8b48a',cloth:'#7a4a8a',cloth2:'#42264a',belt:'#20142a',hat:'#d8b040',pants:'#341f42'}},
  assassin:{name:'怪物·刺客',hp:100,atk:22,spd:110,reach:85,exp:35,weapon:'blade',scale:1.0,maxMp:40,pal:{skin:'#f0d9b8',cloth:'#2a2a2a',cloth2:'#111',belt:'#cc0000',hat:'#111',pants:'#2a2a2a'}},
  boss:{name:'寨主',hp:800,atk:32,spd:92,reach:130,exp:300,boss:true,weapon:'dual',scale:1.45,maxMp:100,pal:{skin:'#e8c8a0',cloth:'#1a1a22',cloth2:'#0c0c12',belt:'#e0b040',hat:'#d8b040',pants:'#15151c'}},
  wolf:{name:'怪物·苍狼',hp:80,atk:14,spd:130,reach:80,exp:18,weapon:'fist',scale:0.9,maxMp:20,animal:true,pal:{skin:'#8a8a8a',cloth:'#666',cloth2:'#444',belt:'#555',hat:'#777',pants:'#555'}},
  bear:{name:'怪物·黑熊精',hp:220,atk:24,spd:45,reach:110,exp:40,weapon:'fist',scale:1.4,maxMp:30,animal:true,pal:{skin:'#3a2a1a',cloth:'#2a1a0a',cloth2:'#1a0a00',belt:'#4a3a2a',hat:'#3a2a1a',pants:'#2a1a0a'}},
  snake:{name:'怪物·巨蟒',hp:120,atk:18,spd:95,reach:120,exp:25,weapon:'spear',scale:1.1,maxMp:25,animal:true,pal:{skin:'#2a5a2a',cloth:'#1a4a1a',cloth2:'#0a3a0a',belt:'#3a6a3a',hat:'#2a5a2a',pants:'#1a4a1a'}},
  scorpion:{name:'怪物·毒蝎',hp:90,atk:20,spd:85,reach:95,exp:22,weapon:'fist',scale:0.85,maxMp:35,animal:true,pal:{skin:'#5a3a1a',cloth:'#4a2a0a',cloth2:'#3a1a00',belt:'#6a4a2a',hat:'#5a3a1a',pants:'#4a2a0a'}},
  eagle:{name:'怪物·铁翼鹰',hp:70,atk:16,spd:160,reach:90,exp:20,weapon:'fist',scale:0.95,maxMp:20,animal:true,pal:{skin:'#6a5a3a',cloth:'#5a4a2a',cloth2:'#4a3a1a',belt:'#7a6a4a',hat:'#6a5a3a',pants:'#5a4a2a'}},
  fox:{name:'妖怪·妖狐',hp:110,atk:26,spd:120,reach:90,exp:38,weapon:'sword',scale:1.0,maxMp:60,monster:true,pal:{skin:'#f5c8a0',cloth:'#ff6a00',cloth2:'#cc4400',belt:'#ffaa00',hat:'#ff8800',pants:'#cc4400'}},
  spider:{name:'妖怪·蛛母',hp:160,atk:20,spd:70,reach:130,exp:32,weapon:'spear',scale:1.2,maxMp:45,monster:true,pal:{skin:'#2a1a2a',cloth:'#1a0a1a',cloth2:'#0a000a',belt:'#3a2a3a',hat:'#2a1a2a',pants:'#1a0a1a'}},
  bat:{name:'鬼魂·血蝠',hp:55,atk:12,spd:150,reach:75,exp:15,weapon:'fist',scale:0.75,maxMp:20,ghost:true,pal:{skin:'#3a1a3a',cloth:'#2a0a2a',cloth2:'#1a001a',belt:'#4a2a4a',hat:'#3a1a3a',pants:'#2a0a2a'}},
  tiger:{name:'魔兽·白虎',hp:200,atk:28,spd:100,reach:105,exp:45,weapon:'fist',scale:1.3,maxMp:35,beast:true,pal:{skin:'#e8e0d0',cloth:'#d0c8b0',cloth2:'#b0a890',belt:'#f0e8d8',hat:'#e8e0d0',pants:'#d0c8b0'}},
  dragon:{name:'魔兽·青龙',hp:300,atk:35,spd:90,reach:140,exp:60,weapon:'spear',scale:1.4,maxMp:70,beast:true,pal:{skin:'#2a6a4a',cloth:'#1a5a3a',cloth2:'#0a4a2a',belt:'#3a7a5a',hat:'#2a6a4a',pants:'#1a5a3a'}},
  phoenix:{name:'神兽·朱雀',hp:250,atk:32,spd:110,reach:120,exp:55,weapon:'blade',scale:1.35,maxMp:65,beast:true,pal:{skin:'#cc2200',cloth:'#aa1100',cloth2:'#880000',belt:'#ff4400',hat:'#cc2200',pants:'#aa1100'}},
  qilin:{name:'神兽·麒麟',hp:400,atk:38,spd:80,reach:135,exp:70,weapon:'sword',scale:1.5,maxMp:80,beast:true,pal:{skin:'#c8a040',cloth:'#b08830',cloth2:'#987020',belt:'#d8b050',hat:'#c8a040',pants:'#b08830'}},
  demon_soldier:{name:'阴兵·魔兵',hp:180,atk:25,spd:85,reach:100,exp:35,weapon:'blade',scale:1.15,maxMp:30,undead:true,pal:{skin:'#4a1a2a',cloth:'#3a0a1a',cloth2:'#2a000a',belt:'#5a2a3a',hat:'#4a1a2a',pants:'#3a0a1a'}},
  demon_mage:{name:'阴兵·魔将',hp:250,atk:30,spd:75,reach:115,exp:50,weapon:'sword',scale:1.3,maxMp:80,undead:true,pal:{skin:'#3a0a3a',cloth:'#2a002a',cloth2:'#1a001a',belt:'#4a1a4a',hat:'#3a0a3a',pants:'#2a002a'}},
  ghost:{name:'鬼魂·幽灵',hp:80,atk:22,spd:140,reach:85,exp:30,weapon:'fist',scale:1.0,maxMp:50,ghost:true,pal:{skin:'#a0c0e0',cloth:'#80a0c0',cloth2:'#6080a0',belt:'#b0d0f0',hat:'#a0c0e0',pants:'#80a0c0'}},
  skeleton:{name:'阴兵·骷髅将军',hp:200,atk:28,spd:70,reach:120,exp:42,weapon:'sword',scale:1.25,maxMp:35,undead:true,pal:{skin:'#e0d8c0',cloth:'#8a8070',cloth2:'#6a6050',belt:'#a09880',hat:'#e0d8c0',pants:'#8a8070'}},
  tree_demon:{name:'妖怪·树妖',hp:280,atk:22,spd:40,reach:140,exp:45,weapon:'spear',scale:1.45,maxMp:40,monster:true,pal:{skin:'#3a5a2a',cloth:'#2a4a1a',cloth2:'#1a3a0a',belt:'#4a6a3a',hat:'#3a5a2a',pants:'#2a4a1a'}},
  thunder_god:{name:'天神·雷神',hp:500,atk:42,spd:95,reach:140,exp:100,boss:true,weapon:'dual',scale:1.55,maxMp:120,god:true,pal:{skin:'#d0c0ff',cloth:'#4030aa',cloth2:'#302088',belt:'#e0d0ff',hat:'#8070cc',pants:'#4030aa'}},
  fire_god:{name:'天神·火神',hp:550,atk:45,spd:85,reach:145,exp:110,boss:true,weapon:'blade',scale:1.6,maxMp:130,god:true,pal:{skin:'#ff8040',cloth:'#cc3300',cloth2:'#aa2200',belt:'#ffaa60',hat:'#ff6020',pants:'#cc3300'}},
  dark_lord:{name:'魔尊',hp:800,atk:50,spd:100,reach:150,exp:200,boss:true,weapon:'dual',scale:1.7,maxMp:150,god:true,pal:{skin:'#2a0a2a',cloth:'#1a001a',cloth2:'#0a000a',belt:'#4a1a4a',hat:'#3a0a3a',pants:'#1a001a'}},

  /* ============================================================
     ★ 变体怪：复用同一套精灵图，用 tint 换色 + 新数值 / 新定位，
       把「一个模型」变成「多个物种」。既省美术成本，又不重复。
     ============================================================ */
  bandit_archer:{name:'怪物·山贼弓手',hp:72,atk:13,spd:92,reach:155,exp:16,weapon:'spear',scale:0.95,maxMp:30,
    tint:'hue-rotate(200deg) saturate(1.15)',pal:{skin:'#f0d9b8',cloth:'#2a5a7a',cloth2:'#1a3a5a',belt:'#2a1a10',hat:'#1a3a4a',pants:'#2a1a10'}},
  wolf_frost:{name:'怪物·霜狼',hp:115,atk:21,spd:142,reach:85,exp:26,weapon:'fist',scale:1.0,maxMp:25,animal:true,
    tint:'hue-rotate(160deg) brightness(1.18) saturate(0.8)',pal:{skin:'#cfe4f0',cloth:'#a8c8dc'}},
  skeleton_mage:{name:'阴兵·骨咒师',hp:195,atk:31,spd:78,reach:125,exp:48,weapon:'sword',scale:1.2,maxMp:85,undead:true,
    tint:'hue-rotate(260deg) saturate(1.2)',pal:{skin:'#e0d8c0',cloth:'#5a4a7a'}},
  ghost_wraith:{name:'鬼魂·怨魄',hp:155,atk:35,spd:152,reach:95,exp:44,weapon:'fist',scale:1.05,maxMp:60,ghost:true,
    tint:'hue-rotate(300deg) saturate(1.35)',pal:{skin:'#c0a0e0',cloth:'#8060b0'}},
  spider_queen:{name:'妖怪·蛛后',hp:430,atk:38,spd:80,reach:145,exp:92,weapon:'spear',scale:1.5,maxMp:60,monster:true,
    tint:'hue-rotate(40deg) saturate(1.25)',pal:{skin:'#3a1a2a',cloth:'#5a1a2a'}},
  tiger_thunder:{name:'魔兽·雷纹白虎',hp:490,atk:46,spd:122,reach:110,exp:112,weapon:'fist',scale:1.45,maxMp:50,beast:true,
    tint:'hue-rotate(190deg) brightness(1.22)',pal:{skin:'#e8f0ff',cloth:'#c0d0e8'}},
  dragon_flame:{name:'魔兽·赤炎龙',hp:640,atk:52,spd:100,reach:148,exp:132,weapon:'spear',scale:1.55,maxMp:95,beast:true,
    tint:'hue-rotate(-70deg) saturate(1.45)',pal:{skin:'#7a2a1a',cloth:'#cc4422'}},
  phoenix_dark:{name:'神兽·玄冥鸟',hp:580,atk:50,spd:132,reach:122,exp:145,weapon:'blade',scale:1.45,maxMp:85,beast:true,
    tint:'hue-rotate(180deg) brightness(0.92) saturate(1.2)',pal:{skin:'#202a3a',cloth:'#3a4a6a'}},
  void_lord:{name:'墟界·灯魔',hp:1400,atk:62,spd:112,reach:158,exp:450,boss:true,weapon:'dual',scale:1.85,maxMp:200,god:true,
    tint:'hue-rotate(280deg) saturate(1.35)',pal:{skin:'#1a0a2a',cloth:'#2a0a3a'}},

  /* ============================================================
     ★ 十二生肖小怪（深渊五境专属，专属精灵图 + 专属数值）
       子鼠/丑牛/寅虎(虎)/卯兔/辰龙(龙)/巳蛇(蛇)/午马/未羊/申猴/酉鸡/戌狗/亥猪
     ============================================================ */
  zrat:{name:'生肖·鬼门鼠妖',hp:260,atk:38,spd:150,reach:95,exp:120,weapon:'blade',scale:1.0,maxMp:45,ghost:true,
    pal:{skin:'#5a6a5a',cloth:'#3a4a3a',cloth2:'#2a3a2a',belt:'#6a7a5a',hat:'#5a6a5a',pants:'#3a4a3a'}},
  zox:{name:'生肖·铁壁蛮牛',hp:480,atk:52,spd:60,reach:115,exp:140,weapon:'fist',scale:1.35,maxMp:40,animal:true,
    pal:{skin:'#2a2a2a',cloth:'#3a3a3a',cloth2:'#222',belt:'#8a7a4a',hat:'#3a3a3a',pants:'#2a2a2a'}},
  zrabbit:{name:'生肖·月刃玉兔',hp:230,atk:46,spd:175,reach:90,exp:130,weapon:'dual',scale:1.0,maxMp:55,monster:true,
    pal:{skin:'#e8e8f0',cloth:'#c8d0e8',cloth2:'#a8b0d0',belt:'#e8f0ff',hat:'#e8e8f0',pants:'#c8d0e8'}},
  zhorse:{name:'生肖·烈焰天马',hp:340,atk:48,spd:165,reach:110,exp:135,weapon:'fist',scale:1.3,maxMp:50,beast:true,
    pal:{skin:'#cc4418',cloth:'#aa2a00',cloth2:'#881a00',belt:'#ff8830',hat:'#cc4418',pants:'#aa2a00'}},
  zgoat:{name:'生肖·石皮羝羊',hp:520,atk:44,spd:55,reach:105,exp:140,weapon:'fist',scale:1.3,maxMp:40,animal:true,
    pal:{skin:'#8a8a8a',cloth:'#6a6a6a',cloth2:'#4a4a4a',belt:'#b08830',hat:'#8a8a8a',pants:'#6a6a6a'}},
  zmonkey:{name:'生肖·夜叉毒猴',hp:300,atk:50,spd:140,reach:130,exp:135,weapon:'spear',scale:1.1,maxMp:60,monster:true,
    pal:{skin:'#2a1a1a',cloth:'#4a2a5a',cloth2:'#2a0a3a',belt:'#6a4a7a',hat:'#2a1a1a',pants:'#4a2a5a'}},
  zrooster:{name:'生肖·赤冠金鸡',hp:280,atk:45,spd:155,reach:95,exp:130,weapon:'fist',scale:1.15,maxMp:45,animal:true,
    pal:{skin:'#d04010',cloth:'#b08010',cloth2:'#906008',belt:'#ff6020',hat:'#d04010',pants:'#b08010'}},
  zdog:{name:'生肖·冥狱犬',hp:320,atk:49,spd:170,reach:95,exp:135,weapon:'fist',scale:1.1,maxMp:55,ghost:true,
    pal:{skin:'#1a1a24',cloth:'#14141e',cloth2:'#0a0a12',belt:'#4a3a6a',hat:'#1a1a24',pants:'#14141e'}},
  zboar:{name:'生肖·崩山豪猪',hp:460,atk:54,spd:75,reach:110,exp:145,weapon:'fist',scale:1.3,maxMp:40,animal:true,
    pal:{skin:'#2a201a',cloth:'#1a1410',cloth2:'#0a0806',belt:'#6a3a2a',hat:'#2a201a',pants:'#1a1410'}},

  /* ============================================================
     ★ 深渊神话五 Boss（专属模型，对应深渊一~五）
     ============================================================ */
  abthunder:{name:'子帝·玄夜雷君',hp:850,atk:60,spd:105,reach:150,exp:600,boss:true,weapon:'dual',scale:1.8,maxMp:170,god:true,
    pal:{skin:'#d0c0ff',cloth:'#302066',cloth2:'#201048',belt:'#c0b0ff',hat:'#6050aa',pants:'#302066'}},
  abbull:{name:'丑罡·铁壁牛魔',hp:950,atk:66,spd:75,reach:155,exp:650,boss:true,weapon:'axe',scale:1.9,maxMp:150,boss2:true,
    pal:{skin:'#4a3020',cloth:'#6a5220',cloth2:'#40300a',belt:'#b08830',hat:'#6a5220',pants:'#40300a'}},
  abtiger:{name:'寅啸·风虎麒麟',hp:900,atk:62,spd:150,reach:140,exp:620,boss:true,weapon:'fist',scale:1.75,maxMp:160,beast:true,
    pal:{skin:'#e8f0f0',cloth:'#88c8c8',cloth2:'#50a0a0',belt:'#c0f0f0',hat:'#e8f0f0',pants:'#88c8c8'}},
  abdragon:{name:'辰帝·渊火龙皇',hp:1000,atk:70,spd:110,reach:160,exp:700,boss:true,weapon:'spear',scale:1.85,maxMp:180,god:true,
    pal:{skin:'#cc6618',cloth:'#aa3a08',cloth2:'#801a00',belt:'#ffcc44',hat:'#cc6618',pants:'#aa3a08'}},
  abserpent:{name:'巳祖·万毒蛇渊',hp:1100,atk:74,spd:85,reach:165,exp:750,boss:true,weapon:'spear',scale:1.9,maxMp:190,monster:true,
    pal:{skin:'#2a5a2a',cloth:'#1a3a1a',cloth2:'#0a2a0a',belt:'#8a4a9a',hat:'#2a5a2a',pants:'#1a3a1a'}}
};
