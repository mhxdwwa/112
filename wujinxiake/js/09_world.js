/* ===== 世界配置 ===== */
const GY_TOP = 470, GY_BOTTOM = 665;
const GY_DEPTH = GY_BOTTOM - GY_TOP;
const WORLD_L = 70, WORLD_R = VW - 70;
/* ★ DNF 式房间：每个房间是一段独立的世界宽度，清空后走到右侧传送门进入下一房间 */
const ROOM_WIDTH = 1800;
const ROOM_TOTAL = 4;          /* 3 个普通房间 + 1 个 BOSS 房间 */
function depthScale(y){ return 0.78 + clamp((y-GY_TOP)/GY_DEPTH, 0, 1) * 0.42; }

const WEAPON_ID_BY_IDX = ['sword','blade','spear','fist','herb','axe','talisman','cauldron'];
const WEAPONS = [
  { id:'sword', name:'青锋剑', color:'#9fe6ff', atkMul:1.0, dmgType:'phys',
    combo:[ {type:'thrust',dmg:0.8,reach:115,windup:0.05,strike:0.05,recover:0.10,kb:120,sound:'swordSwing'},{type:'upcut',dmg:0.9,reach:110,windup:0.06,strike:0.06,recover:0.12,kb:150,sound:'swordSwing'},{type:'sweep',dmg:1.0,reach:120,windup:0.08,strike:0.06,recover:0.14,kb:180,sound:'swordSwing'},{type:'chop',dmg:1.2,reach:125,windup:0.10,strike:0.08,recover:0.18,kb:250,sound:'swordSwing'},{type:'slam',dmg:2.5,reach:140,windup:0.15,strike:0.10,recover:0.30,kb:450,launch:true,sound:'swordSwing'} ],
    skills:[
      {name:'剑开天门',key:'1',cost:12,cd:2.5,unlock:1,plannedUnlock:1,maxLv:20,spCost:3,spStep:1,power:1.0,src:'基础剑技',desc:'裂空召唤飞剑，自九天坠落重击目标'},
      {name:'剑二十三',key:'2',cost:22,cd:5.5,unlock:1,plannedUnlock:1,maxLv:15,spCost:5,spStep:1,power:1.4,src:'基础剑技',desc:'剑意化形，二十三道剑影连续斩击'},
      {name:'万剑归宗',key:'3',cost:38,cd:13.0,unlock:8,plannedUnlock:8,maxLv:12,spCost:8,spStep:1,power:2.6,src:'基础剑技',desc:'万剑齐发覆盖战场，大招级范围伤害'},
      {name:'天雷剑诀',key:'4',cost:26,cd:9.0,unlock:14,plannedUnlock:14,maxLv:15,spCost:10,spStep:2,power:4.2,src:'《仙剑奇侠传》· 蜀山御雷',desc:'以剑引雷，雷随剑走；剑落之处雷电沿敌连锁，一雷传一雷'},
      {name:'诛仙剑阵',key:'5',cost:45,cd:16.0,unlock:22,plannedUnlock:22,maxLv:12,spCost:14,spStep:2,power:8.5,src:'萧鼎《诛仙》· 诛仙剑阵',desc:'四剑镇四方，剑阵绞杀，诛仙灭神'},
      {name:'剑来',key:'6',cost:70,cd:26.0,unlock:30,plannedUnlock:30,maxLv:10,spCost:18,spStep:2,power:18.0,src:'烽火戏诸侯《剑来》',desc:'天开一线，万剑垂落——天地皆为我剑'}
    ] },
  { id:'blade', name:'斩马刀', color:'#ff8a4a', atkMul:1.35, dmgType:'phys',
    combo:[ {type:'chop',dmg:1.1,reach:110,windup:0.10,strike:0.08,recover:0.15,kb:180,sound:'bladeSwing'},{type:'sweep',dmg:1.2,reach:120,windup:0.10,strike:0.08,recover:0.15,kb:220,sound:'bladeSwing'},{type:'upcut',dmg:1.3,reach:115,windup:0.12,strike:0.08,recover:0.18,kb:260,sound:'bladeSwing'},{type:'chop',dmg:1.5,reach:130,windup:0.15,strike:0.10,recover:0.20,kb:350,sound:'bladeSwing'},{type:'slam',dmg:3.2,reach:150,windup:0.20,strike:0.10,recover:0.40,kb:600,launch:true,sound:'bladeSwing'} ],
    skills:[
      {name:'修罗斩',key:'1',cost:14,cd:3.0,unlock:1,plannedUnlock:1,maxLv:20,spCost:3,spStep:1,power:1.0,src:'基础刀技',desc:'修罗一刀，向前方斩出炽烈刀气'},
      {name:'五龙御天刀',key:'2',cost:25,cd:6.0,unlock:1,plannedUnlock:1,maxLv:15,spCost:5,spStep:1,power:1.5,src:'基础刀技',desc:'五条刀龙腾空，轮番轰击敌阵'},
      {name:'血刃风暴',key:'3',cost:40,cd:14.5,unlock:8,plannedUnlock:8,maxLv:12,spCost:8,spStep:1,power:2.8,src:'基础刀技',desc:'化身血色风暴，持续撕裂周围一切'},
      {name:'阿鼻道三刀',key:'4',cost:28,cd:10.0,unlock:14,plannedUnlock:14,maxLv:15,spCost:10,spStep:2,power:4.5,src:'《天下第一》· 归海一刀',desc:'一刀断魂，二刀绝命，三刀直堕阿鼻地狱'},
      {name:'傲寒六诀',key:'5',cost:48,cd:17.0,unlock:22,plannedUnlock:22,maxLv:12,spCost:14,spStep:2,power:9.0,src:'《风云》· 聂风',desc:'六诀连斩，刀意冰封——寒彻天地'},
      {name:'焰分噬浪尺',key:'6',cost:75,cd:28.0,unlock:30,plannedUnlock:30,maxLv:10,spCost:18,spStep:2,power:20.0,src:'天蚕土豆《斗破苍穹》· 药老',desc:'巨尺劈落，焰分噬浪——天地为之一分'}
    ] },
  { id:'spear', name:'破军枪', color:'#ffd96a', atkMul:1.15, dmgType:'phys',
    combo:[ {type:'thrust',dmg:0.9,reach:150,windup:0.05,strike:0.04,recover:0.08,kb:140,sound:'spearThrust'},{type:'upcut',dmg:0.9,reach:145,windup:0.06,strike:0.05,recover:0.10,kb:160,sound:'spearThrust'},{type:'chop',dmg:1.1,reach:155,windup:0.08,strike:0.06,recover:0.12,kb:180,sound:'spearThrust'},{type:'sweep',dmg:1.3,reach:170,windup:0.10,strike:0.08,recover:0.16,kb:280,sound:'spearThrust'},{type:'thrust',dmg:2.6,reach:190,windup:0.15,strike:0.08,recover:0.30,kb:480,launch:true,sound:'spearThrust'} ],
    skills:[
      {name:'灭世枪法',key:'1',cost:15,cd:3.8,unlock:1,plannedUnlock:1,maxLv:20,spCost:3,spStep:1,power:1.0,src:'基础枪技',desc:'枪出如龙，一往无前的贯穿突刺'},
      {name:'混元十三枪',key:'2',cost:25,cd:5.8,unlock:1,plannedUnlock:1,maxLv:15,spCost:5,spStep:1,power:1.4,src:'基础枪技',desc:'十三连枪封死退路，枪枪致命'},
      {name:'万枪归宗',key:'3',cost:40,cd:13.5,unlock:8,plannedUnlock:8,maxLv:12,spCost:8,spStep:1,power:2.7,src:'基础枪技',desc:'万枪自天而降，覆盖整片战场'},
      {name:'百鸟朝凤枪',key:'4',cost:26,cd:9.5,unlock:14,plannedUnlock:14,maxLv:15,spCost:10,spStep:2,power:4.0,src:'三国 · 童渊传赵云',desc:'枪尖化百鸟，朝凤而鸣——百鸟绕身，一枪穿心'},
      {name:'暴雨梨花枪',key:'5',cost:46,cd:16.0,unlock:22,plannedUnlock:22,maxLv:12,spCost:14,spStep:2,power:8.0,src:'杨家枪法 · 《说唐》',desc:'枪影如暴雨梨花，密不透风，无处可避'},
      {name:'蓝银霸王枪',key:'6',cost:72,cd:27.0,unlock:30,plannedUnlock:30,maxLv:10,spCost:18,spStep:2,power:17.0,src:'唐家三少《斗罗大陆》',desc:'蓝银化枪，霸王降世——一枪镇山河'}
    ] },
  { id:'fist', name:'龙拳', color:'#ffcc33', atkMul:0.95, dmgType:'phys',
    combo:[ {type:'wardOff',dmg:0.8,reach:115,windup:0.12,strike:0.05,recover:0.07,kb:100,sound:'fistPunch'},{type:'rollback',dmg:0.8,reach:110,windup:0.11,strike:0.05,recover:0.06,kb:110,sound:'fistPunch'},{type:'press',dmg:1.0,reach:120,windup:0.13,strike:0.06,recover:0.08,kb:150,sound:'fistPunch'},{type:'push',dmg:1.3,reach:125,windup:0.15,strike:0.07,recover:0.10,kb:220,sound:'fistPunch'},{type:'cloudHands',dmg:2.4,reach:135,windup:0.20,strike:0.10,recover:0.18,kb:400,launch:true,sound:'fistPunch'} ],
    skills:[
      {name:'真气弹',key:'1',cost:12,cd:2.0,unlock:1,plannedUnlock:1,maxLv:20,spCost:3,spStep:1,power:1.0,src:'基础拳技',desc:'凝聚真气轰出，快速灵活的基础技能'},
      {name:'九霄御雷诀',key:'2',cost:22,cd:5.0,unlock:1,plannedUnlock:1,maxLv:15,spCost:5,spStep:1,power:1.5,src:'基础拳技',desc:'引九霄天雷贯穿目标，附带麻痹'},
      {name:'佛怒火莲',key:'3',cost:36,cd:12.0,unlock:8,plannedUnlock:8,maxLv:12,spCost:8,spStep:1,power:2.9,src:'天蚕土豆《斗破苍穹》',desc:'凝聚怒莲引爆，大范围持续燃烧'},
      {name:'八极崩',key:'4',cost:25,cd:9.0,unlock:14,plannedUnlock:14,maxLv:15,spCost:10,spStep:2,power:4.4,src:'天蚕土豆《斗破苍穹》· 萧炎',desc:'八段暗劲层层叠加，最后一崩山石俱裂'},
      {name:'大天造化掌',key:'5',cost:50,cd:18.0,unlock:22,plannedUnlock:22,maxLv:12,spCost:14,spStep:2,power:9.5,src:'《斗破苍穹》· 天阶斗技',desc:'一掌造化，覆压天地——掌落之处皆成焦土'},
      {name:'炁体源流',key:'6',cost:80,cd:30.0,unlock:30,plannedUnlock:30,maxLv:10,spCost:18,spStep:2,power:19.0,src:'米二《一人之下》· 八奇技',desc:'炁之极致，万法之源——炁柱冲天，荡尽群敌'}
    ] }
,{ id:'herb', name:'百草药囊', color:'#7ed957', atkMul:0.98, dmgType:'magic',
    combo:[ {type:'sweep',dmg:0.80,reach:112,windup:0.05,strike:0.05,recover:0.09,kb:110,sound:'swordSwing'},{type:'thrust',dmg:0.85,reach:118,windup:0.06,strike:0.05,recover:0.10,kb:120,sound:'swordSwing'},{type:'sweep',dmg:0.95,reach:122,windup:0.07,strike:0.06,recover:0.12,kb:150,sound:'swordSwing'},{type:'chop',dmg:1.15,reach:128,windup:0.09,strike:0.07,recover:0.15,kb:200,sound:'swordSwing'},{type:'slam',dmg:2.40,reach:142,windup:0.14,strike:0.10,recover:0.26,kb:380,launch:true,sound:'swordSwing'} ],
    skills:[
      {name:'青囊掷露',key:'1',cost:12,cd:2.4,unlock:1,plannedUnlock:1,maxLv:20,spCost:3,spStep:1,power:1.0,src:'基础药技',desc:'掷出青囊药露，落地炸开一滩腐蚀毒浆'},
      {name:'藤缠百草',key:'2',cost:22,cd:5.2,unlock:1,plannedUnlock:1,maxLv:15,spCost:5,spStep:1,power:1.5,src:'基础药技',desc:'藤蔓破土而出，一路缠绕到目标脚下'},
      {name:'七毒噬骨',key:'3',cost:36,cd:12.0,unlock:8,plannedUnlock:8,maxLv:12,spCost:8,spStep:1,power:2.9,src:'药毒双修 · 七毒经',desc:'七枚毒丹绕敌盘旋，逐一炸开，蚀骨钻心'},
      {name:'九花玉露丸',key:'4',cost:26,cd:10.0,unlock:14,plannedUnlock:14,maxLv:15,spCost:10,spStep:2,power:3.8,src:'金庸《射雕英雄传》· 黄药师',desc:'九花玉露丸化雨，回复自身并震退四周敌人'},
      {name:'千蛛万毒手',key:'5',cost:46,cd:16.0,unlock:22,plannedUnlock:22,maxLv:12,spCost:14,spStep:2,power:8.4,src:'金庸《倚天屠龙记》· 蛛儿',desc:'万毒随掌而出，毒蛛噬体，持续溃烂'},
      {name:'神农百草·万物归毒',key:'6',cost:70,cd:26.0,unlock:30,plannedUnlock:30,maxLv:10,spCost:18,spStep:2,power:17.5,src:'《神农本草经》· 神农氏',desc:'尝尽百草，通世间药性——一念生，一念枯，万物尽归毒'}
    ] },
  { id:'axe', name:'开山斧', color:'#ffb04a', atkMul:1.42, dmgType:'phys',
    combo:[ {type:'chop',dmg:1.20,reach:120,windup:0.12,strike:0.08,recover:0.16,kb:200,sound:'bladeSwing'},{type:'chop',dmg:1.25,reach:126,windup:0.12,strike:0.09,recover:0.17,kb:220,sound:'bladeSwing'},{type:'sweep',dmg:1.35,reach:136,windup:0.14,strike:0.09,recover:0.19,kb:260,sound:'bladeSwing'},{type:'upcut',dmg:1.50,reach:130,windup:0.15,strike:0.10,recover:0.22,kb:320,sound:'bladeSwing'},{type:'slam',dmg:3.60,reach:156,windup:0.22,strike:0.12,recover:0.40,kb:640,launch:true,sound:'bladeSwing'} ],
    skills:[
      {name:'劈山式',key:'1',cost:14,cd:3.0,unlock:1,plannedUnlock:1,maxLv:20,spCost:3,spStep:1,power:1.05,src:'基础斧技',desc:'抡斧下劈，斧气裂地成沟'},
      {name:'三板斧',key:'2',cost:24,cd:5.6,unlock:1,plannedUnlock:1,maxLv:15,spCost:5,spStep:1,power:1.55,src:'《隋唐演义》· 程咬金',desc:'劈脑门、剔牙、掏耳朵——三斧过后再无第四斧'},
      {name:'旋风斧',key:'3',cost:38,cd:12.5,unlock:8,plannedUnlock:8,maxLv:12,spCost:8,spStep:1,power:2.95,src:'基础斧技',desc:'原地旋身，巨斧扫出一圈斧气'},
      {name:'力劈华山',key:'4',cost:26,cd:9.5,unlock:14,plannedUnlock:14,maxLv:15,spCost:10,spStep:2,power:4.30,src:'《宝莲灯》· 沉香',desc:'一斧劈开华山，山石俱裂'},
      {name:'刑天舞干戚',key:'5',cost:48,cd:17.0,unlock:22,plannedUnlock:22,maxLv:12,spCost:14,spStep:2,power:8.8,src:'《山海经》· 刑天',desc:'无头亦舞干戚，战意不灭，越战越勇'},
      {name:'盘古开天·混沌初判',key:'6',cost:75,cd:28.0,unlock:30,plannedUnlock:30,maxLv:10,spCost:18,spStep:2,power:18.5,src:'《三五历纪》· 盘古',desc:'一斧分天地，清浊自此判——混沌初开，万物始生'}
    ] },
  { id:'talisman', name:'黄符', color:'#ffe066', atkMul:1.02, dmgType:'magic',
    combo:[ {type:'thrust',dmg:0.80,reach:122,windup:0.05,strike:0.04,recover:0.09,kb:110,sound:'swordSwing'},{type:'sweep',dmg:0.85,reach:128,windup:0.06,strike:0.05,recover:0.10,kb:130,sound:'swordSwing'},{type:'thrust',dmg:0.95,reach:132,windup:0.07,strike:0.05,recover:0.12,kb:160,sound:'swordSwing'},{type:'sweep',dmg:1.20,reach:138,windup:0.09,strike:0.07,recover:0.16,kb:220,sound:'swordSwing'},{type:'slam',dmg:2.50,reach:148,windup:0.15,strike:0.10,recover:0.28,kb:420,launch:true,sound:'swordSwing'} ],
    skills:[
      {name:'定身符',key:'1',cost:12,cd:2.6,unlock:1,plannedUnlock:1,maxLv:20,spCost:3,spStep:1,power:0.95,src:'基础符法',desc:'一符贴上，敌人定在原地动弹不得'},
      {name:'五雷符',key:'2',cost:22,cd:5.4,unlock:1,plannedUnlock:1,maxLv:15,spCost:5,spStep:1,power:1.5,src:'基础符法',desc:'五道雷符同时引爆，电光穿身'},
      {name:'万符朝宗',key:'3',cost:38,cd:13.0,unlock:8,plannedUnlock:8,maxLv:12,spCost:8,spStep:1,power:2.9,src:'基础符法',desc:'万张符纸如雪落下，覆盖整片战场'},
      {name:'神剑御雷真诀',key:'4',cost:28,cd:10.0,unlock:14,plannedUnlock:14,maxLv:15,spCost:10,spStep:2,power:4.4,src:'萧鼎《诛仙》· 青云门',desc:'以符引雷，雷化神剑，一剑破空'},
      {name:'急急如律令',key:'5',cost:46,cd:16.5,unlock:22,plannedUnlock:22,maxLv:12,spCost:14,spStep:2,power:8.6,src:'《西游记》· 道门真言',desc:'太上老君急急如律令——天兵借法，神将现身'},
      {name:'万鬼符阵·九幽黄泉',key:'6',cost:72,cd:27.0,unlock:30,plannedUnlock:30,maxLv:10,spCost:18,spStep:2,power:18.0,src:'《聊斋志异》· 燕赤霞',desc:'九幽黄泉开，万鬼听符令，自地底爬出'}
    ] },
  { id:'cauldron', name:'青铜药鼎', color:'#ff7a4a', atkMul:1.18, dmgType:'magic',
    combo:[ {type:'chop',dmg:1.00,reach:118,windup:0.09,strike:0.07,recover:0.14,kb:170,sound:'bladeSwing'},{type:'sweep',dmg:1.05,reach:124,windup:0.10,strike:0.07,recover:0.15,kb:190,sound:'bladeSwing'},{type:'chop',dmg:1.15,reach:128,windup:0.11,strike:0.08,recover:0.17,kb:220,sound:'bladeSwing'},{type:'upcut',dmg:1.35,reach:132,windup:0.13,strike:0.09,recover:0.20,kb:280,sound:'bladeSwing'},{type:'slam',dmg:2.90,reach:148,windup:0.18,strike:0.11,recover:0.32,kb:520,launch:true,sound:'bladeSwing'} ],
    skills:[
      {name:'丹火',key:'1',cost:13,cd:2.8,unlock:1,plannedUnlock:1,maxLv:20,spCost:3,spStep:1,power:1.0,src:'基础丹术',desc:'炉中丹火外放，灼烧前方一线'},
      {name:'鼎镇压',key:'2',cost:24,cd:5.8,unlock:1,plannedUnlock:1,maxLv:15,spCost:5,spStep:1,power:1.5,src:'基础丹术',desc:'药鼎腾空放大，当头镇压而下'},
      {name:'三昧真火',key:'3',cost:38,cd:13.0,unlock:8,plannedUnlock:8,maxLv:12,spCost:8,spStep:1,power:3.0,src:'《西游记》· 红孩儿',desc:'三昧真火焚身，水浇不灭，越扑越旺'},
      {name:'九转金丹',key:'4',cost:27,cd:10.0,unlock:14,plannedUnlock:14,maxLv:15,spCost:10,spStep:2,power:4.2,src:'《西游记》· 太上老君',desc:'九转金丹出炉，丹香四溢，服之伤势尽复'},
      {name:'九龙神火罩',key:'5',cost:48,cd:17.0,unlock:22,plannedUnlock:22,maxLv:12,spCost:14,spStep:2,power:8.8,src:'《封神演义》· 太乙真人',desc:'九龙化火，罩住敌阵，烧尽一切'},
      {name:'八卦炉·炼天煮海',key:'6',cost:76,cd:28.0,unlock:30,plannedUnlock:30,maxLv:10,spCost:18,spStep:2,power:18.5,src:'《西游记》· 太上老君',desc:'八卦炉倒扣天地，以众生为药，以天地为炉'}
    ] }
];

/* ★ 远程普攻武器：这些法系角色的普通攻击是发射投射物，而非近身挥击 */
const RANGED_BASIC_WEAPONS = { herb:1, talisman:1, cauldron:1 };
/* 各远程武器普攻投射物的外观与参数（按角色设定主题化，并缩小体积） */
const BASIC_SHOT = {
  /* 炼药师：发射一株株散发绿色灵气的小草 */
  herb:     { color:'#7ed957', glow:'#b6ff7a', core:'#e8ffc8', w:22, hh:26, speed:760, pierce:0 },
  /* 符咒师：发射一枚较小的黄符纸 */
  talisman: { color:'#ffe066', glow:'#fff2a8', core:'#fff7d0', w:20, hh:26, speed:900, pierce:0 },
  /* 丹道师：发射一枚枚发光的仙丹 */
  cauldron: { color:'#ffd76a', glow:'#fff0c0', core:'#fffbe8', w:22, hh:24, speed:700, pierce:1 }
};

