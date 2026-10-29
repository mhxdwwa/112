/* ===== 角色系统 ===== */
/* ===== 职业定义（对应武器类型） ===== */
const CHARACTERS = [
  {
    id:'fighter', name:'格斗家', title:'手套宗师', weaponIdx:3, weaponType:'fist',
    desc:'拳套近身，迅捷无双，近战爆发型',
    pal:{skin:'#f0d9b8', cloth:'#4a2a5f', cloth2:'#2e1a3e', belt:'#ffcc33', hat:'#2a1a3e', pants:'#2e1a3e'},
    hp:5000, mp:80, atk:8, spd:280, crit:5,
    color:'#ffcc33',
    skillDesc:['冲拳', '升龙拳', '连环腿']
  },
  {
    id:'swordsman', name:'剑士', title:'宝剑宗师', weaponIdx:0, weaponType:'sword',
    desc:'宝剑精通，攻守兼备，近战均衡型',
    pal:{skin:'#f0d9b8', cloth:'#1e3a5f', cloth2:'#122438', belt:'#ffd166', hat:'#0d1b2e', pants:'#122438'},
    hp:5000, mp:70, atk:10, spd:250, crit:3,
    color:'#9fe6ff',
    skillDesc:['拔刀斩', '月华斩', '翔空斩']
  },
  {
    id:'blademaster', name:'剑客', title:'大刀达人', weaponIdx:1, weaponType:'blade',
    desc:'大刀刚猛，一击必杀，高攻击型',
    pal:{skin:'#d8b48a', cloth:'#5f1e1e', cloth2:'#381212', belt:'#ffd166', hat:'#2e0d0d', pants:'#381212'},
    hp:5000, mp:60, atk:14, spd:220, crit:2,
    color:'#ff8a4a',
    skillDesc:['连斩', '烈焰斩', '瞬影斩']
  },
  {
    id:'spearman', name:'枪手', title:'长枪之王', weaponIdx:2, weaponType:'spear',
    desc:'长枪突进，范围攻击，中距离压制型',
    pal:{skin:'#e8c8a0', cloth:'#2a4a2a', cloth2:'#1a3a1a', belt:'#ffd96a', hat:'#1a2e1a', pants:'#1a3a1a'},
    hp:5000, mp:70, atk:11, spd:240, crit:4,
    color:'#ffd96a',
    skillDesc:['突刺', '旋风枪', '龙击炮', '百鸟朝凤枪', '暴雨梨花枪', '蓝银霸王枪']
  },
  {
    id:'alchemist', name:'炼药师', title:'百草行者', weaponIdx:4, weaponType:'herb',
    desc:'药草随身，毒愈两全，持续消耗型',
    pal:{skin:'#f0d9b8', cloth:'#2a4a2a', cloth2:'#16301a', belt:'#7ed957', hat:'#1e3a20', pants:'#16301a'},
    hp:5000, mp:95, atk:9, spd:258, crit:4,
    color:'#7ed957',
    skillDesc:['青囊一掷', '百草缠身', '生死符', '九花玉露', '千蛛万毒手', '神农百草']
  },
  {
    id:'mountaineer', name:'撼山者', title:'开山力士', weaponIdx:5, weaponType:'axe',
    desc:'巨斧开山，一击撼岳，超高爆发型',
    pal:{skin:'#d8b48a', cloth:'#5a3a1a', cloth2:'#3a2408', belt:'#ffb04a', hat:'#2e1e0a', pants:'#3a2408'},
    hp:5000, mp:55, atk:14, spd:205, crit:2,
    color:'#ffb04a',
    skillDesc:['劈山式', '三板斧', '旋风斧', '力劈华山', '刑天舞干戚', '盘古开天']
  },
  {
    id:'talismanist', name:'符咒师', title:'黄符道人', weaponIdx:6, weaponType:'talisman',
    desc:'符纸引雷，远程控场，爆发控场型',
    pal:{skin:'#e8c8a0', cloth:'#3a3a5a', cloth2:'#20203a', belt:'#ffe066', hat:'#1a1a2e', pants:'#20203a'},
    hp:5000, mp:100, atk:11, spd:262, crit:5,
    color:'#ffe066',
    skillDesc:['定身符', '五雷符', '万符朝宗', '神剑御雷真诀', '急急如律令', '万鬼符阵']
  },
  {
    id:'danmaster', name:'丹道师', title:'炉火真君', weaponIdx:7, weaponType:'cauldron',
    desc:'药鼎炼火，攻守自如，均衡破坏型',
    pal:{skin:'#f0d9b8', cloth:'#6a2a1a', cloth2:'#3a1208', belt:'#ff7a4a', hat:'#2e1208', pants:'#3a1208'},
    hp:5000, mp:88, atk:12, spd:230, crit:3,
    color:'#ff7a4a',
    skillDesc:['丹火', '鼎镇压', '三昧真火', '九转金丹', '九龙神火罩', '八卦炉·炼天']
  }
];

/* 属性上限 */
const STAT_CAPS = {
  maxAtk: 99999,
  maxMoveSpeed: 500,
  maxCrit: 50, // 暴击率上限50%
  maxHp: 999999,
  maxMp: 99999
};

/* gameState 已在 01_core.js 提前声明（避免加载期监听器报未定义） */
let G = null, gameMode = '', menuSelection = 0;
let pvpState = 'select1', pvpSelect = [0,0], pvpWinner = -1;
let pvpFromMenu = true; // true=主菜单双人PK(1级平衡)，false=守门人PK(用当前角色属性)
let savedSingleG = null; // 守门人PK前保存的单人冒险G状态

/* ★ 守门人试炼 / PK 结束后回到单人冒险：把存档的 G 还原回来
   —— 修复：试炼中途退出（暂停→返回城镇 / 战败 / 平局）后 G 残留对战状态，
      导致再进地图时 G.camera 等副本字段缺失而崩溃 */
function restoreSingleGIfNeeded(){
  if(!G) return false;
  if(!G.isPvp && !savedSingleG) return false;
  if(!savedSingleG) return false;
  const trialPlayer = G.player;
  G = savedSingleG;
  savedSingleG = null;
  if(G){
    G.isPvp = false;
    G.player2 = null;
    if(!G.camera) G.camera = { x:0, y:0 };
    if(!G.drops) G.drops = [];
    if(!G.traps) G.traps = [];
    if(G.player){
      G.player.hp = G.player.maxHp;
      G.player.mp = G.player.maxMp;
      G.player.dead = false;
      G.player.state = 'idle';
      G.player.action = null;
      G.player.invuln = 0.6;
    } else if(trialPlayer){
      G.player = trialPlayer;
    }
  }
  return true;
}
let currentSkillCaster = null;
let currentSkillIdx = -1;   // 当前正在释放的技能索引（用于技能等级加成）
let charSelectState = { phase:'single', selections:[0,0], step:0 };
let playerName = ''; // 玩家角色名字
let nameInputActive = false; // 命名输入框激活状态

/* 隐藏输入框：用于支持中文输入法 */
const nameInputBox = document.createElement('input');
nameInputBox.style.cssText = 'position:fixed;opacity:0;pointer-events:none;left:-9999px;top:-9999px;width:10px;height:10px;';
document.body.appendChild(nameInputBox);
nameInputBox.addEventListener('input', ()=>{
  if(gameState === 'nameInput' && nameInputActive){
    playerName = nameInputBox.value.slice(0, 12);
  }
});
nameInputBox.addEventListener('compositionend', ()=>{
  if(gameState === 'nameInput' && nameInputActive){
    playerName = nameInputBox.value.slice(0, 12);
  }
});

function getPlayerPalette(player){
  if(player.charId){
    const char = CHARACTERS.find(c => c.id === player.charId);
    if(char) return char.pal;
  }
  /* 默认调色板 */
  return {skin:'#f0d9b8', cloth:'#1e3a5f', cloth2:'#122438', belt:'#ffd166', hat:'#0d1b2e', pants:'#122438'};
}

function startSingleWithChar(charIdx){
  const char = CHARACTERS[charIdx];
  gameMode = 'single';
  G = { t:0, player: makePlayerWithChar(char), enemies:[], projectiles:[], particles:[], effects:[], texts:[],
    levelIdx:0, waveIdx:0, waveState:'idle', waveTimer:0, waveNum:0,
    combo:0, comboTimer:0, shake:0, hitstop:0, flash:0, hitFlashColor:'#fff', totalKills:0, bannerText:'', bannerTimer:0,
    currentIsBoss:false, camera:{x:0,y:0}, worldWidth:999999, traps:[], selectedChar:charIdx,
    drops: [], clearedLevels: [], skillDamageStats: {} };
  // 先进入命名界面，命名完成后再进城镇
  gameState = 'nameInput';
  nameInputActive = true;
  playerName = '';
  nameInputBox.value = '';
  /* ★ 新手装备与初始资源：保证铁匠铺/增幅系统开局可用 */
  const sp = G.player;
  sp.equipment.weapon = makeStarterEquip('weapon', char.weaponIdx);
  sp.equipment.head = makeStarterEquip('head', char.weaponIdx);
  sp.equipment.armor = makeStarterEquip('armor', char.weaponIdx);
  sp.equipment.shoes = makeStarterEquip('shoes', char.weaponIdx);
  sp.equipment.necklace = makeStarterEquip('necklace', char.weaponIdx);
  sp.equipment.ring = makeStarterEquip('ring', char.weaponIdx);
  sp.equipment.bracer = makeStarterEquip('bracer', char.weaponIdx);
  sp.materials.enhance_stone_low = 12;
  sp.materials.chaos_stone = 3;
  sp.gold = 800;
  sp.amplifyStones = { amplify_stone_common: 6 };
  /* ★ 开局送一组新手药水（回血瓶 / 回蓝瓶） */
  if(window.POTION){ POTION.starter(sp); }
  recalcPlayerStats();
  sp.hp = sp.maxHp;
  sp.mp = sp.maxMp;
  setTimeout(()=>nameInputBox.focus(), 100);
  if(window.showTouchControls) window.showTouchControls(false);
  updateSkillIcons(1, G.player.weaponIdx);
}

function startPvpWithChar(char1Idx, char2Idx){
  const char1 = CHARACTERS[char1Idx], char2 = CHARACTERS[char2Idx];
  const w1 = WEAPONS[char1.weaponIdx], w2 = WEAPONS[char2.weaponIdx];
  const bal1 = PVP_BALANCE[w1.id], bal2 = PVP_BALANCE[w2.id];
  G = { t:0, player:null, player2:null, enemies:[], projectiles:[], particles:[], effects:[], texts:[],
    levelIdx:0, waveIdx:0, waveState:'fight', waveTimer:0,
    combo:0, comboTimer:0, shake:0, hitstop:0, flash:0, hitFlashColor:'#fff', totalKills:0, bannerText:'', bannerTimer:0, isPvp:true };
  G.player = makePvpPlayerWithChar(1, char1, bal1);
  G.player2 = makePvpPlayerWithChar(2, char2, bal2);
  G.player.x = VW*0.25; G.player.y = 580; G.player.facing = 1;
  G.player2.x = VW*0.75; G.player2.y = 580; G.player2.facing = -1;
  gameState = 'playing';
  G.waveState = 'fight';
  G.bannerText = '对决开始！'; G.bannerTimer = 1.5;
  if(window.showTouchControls) window.showTouchControls(true);
  updateSkillIcons(1, char1.weaponIdx);
  updateSkillIcons(2, char2.weaponIdx);
  startBGM();
}

/* 守门人PK：用当前角色等级装备 vs AI对手 */
function startGatekeeperPvp(){
  if(!G || !G.player) return;
  /* 保存单人冒险状态 */
  savedSingleG = G;
  pvpFromMenu = false;

  const p = G.player;
  const char = CHARACTERS.find(c => c.id === p.charId) || CHARACTERS[p.weaponIdx] || CHARACTERS[0];

  /* 创建AI对手：根据玩家等级匹配 */
  const lv = p.level || 1;
  const growth = getLevelGrowth(lv);
  const aiHp = Math.round((p.maxHp || 200) * 0.95);
  const aiAtk = Math.round((p.atk || 10) * 0.9);
  const aiSpd = (p.moveSpeed || 300);

  G = { t:0, player:null, player2:null, enemies:[], projectiles:[], particles:[], effects:[], texts:[],
    levelIdx:0, waveIdx:0, waveState:'fight', waveTimer:0,
    combo:0, comboTimer:0, shake:0, hitstop:0, flash:0, hitFlashColor:'#fff', totalKills:0, bannerText:'', bannerTimer:0, isPvp:true };

  /* 玩家1 = 当前角色（保留等级装备） */
  G.player = p;
  G.player.x = VW*0.25; G.player.y = 580; G.player.facing = 1;
  G.player.hp = G.player.maxHp; // 满血进入PK
  G.player.dead = false;
  G.player.state = 'idle';
  G.player.action = null;
  G.player.invuln = 0;
  G.player.hitFlash = 0;

  /* 玩家2 = AI对手 */
  G.player2 = {
    isPlayer:true, playerNum:2, x:VW*0.75, y:580, h:0, vy:0, kx:0, facing:-1,
    hp:aiHp, maxHp:aiHp, mp:p.maxMp, maxMp:p.maxMp, level:lv, exp:0, expNext:80,
    atk:aiAtk, weaponIdx:p.weaponIdx, charId: char.id,
    state:'idle', walkPhase:0, action:null, attackBuffer:0, comboWindow:0, comboIdx:0,
    invuln:0, hitFlash:0, hurtT:0, dead:false, cds:[0,0,0,0,0,0], moveSpeed:aiSpd,
    launchT:0, jumpT:0, landingT:0, landingStartH:0,
    upperArmAng:1.05, foreArmAng:-1.1, weaponAng:0, bodyLean:0.05, kneeBend:3,
    backUpperArmAng:1.5, backForeArmAng:-1.5, legPose:0,
    dodgeT:0, dodgeCd:0, dodgeDir:0, stamina:100, maxStamina:100,
    skillLevels:[1,1,1,1,1,1], skillsUnlocked:[true,true,true,true,true,true], pvpAllSkills:true,
    isAI:true
  };

  gameState = 'playing';
  G.waveState = 'fight';
  G.bannerText = '守门人试炼！'; G.bannerTimer = 1.5;
  if(window.showTouchControls) window.showTouchControls(true);
  updateSkillIcons(1, p.weaponIdx);
  updateSkillIcons(2, p.weaponIdx);
  startBGM();
}

/* 主页双人PK：玩家选一个职业，AI自动匹配对手（1级平衡） */
function startPvpVsAI(charIdx){
  const char1 = CHARACTERS[charIdx];
  /* AI随机选一个不同的职业 */
  let aiIdx;
  do { aiIdx = Math.floor(Math.random()*4); } while(aiIdx === charIdx);
  const char2 = CHARACTERS[aiIdx];

  const w1 = WEAPONS[char1.weaponIdx], w2 = WEAPONS[char2.weaponIdx];
  const bal1 = PVP_BALANCE[w1.id], bal2 = PVP_BALANCE[w2.id];

  savedSingleG = null;
  pvpFromMenu = true;

  G = { t:0, player:null, player2:null, enemies:[], projectiles:[], particles:[], effects:[], texts:[],
    levelIdx:0, waveIdx:0, waveState:'fight', waveTimer:0,
    combo:0, comboTimer:0, shake:0, hitstop:0, flash:0, hitFlashColor:'#fff', totalKills:0, bannerText:'', bannerTimer:0, isPvp:true };

  G.player = makePvpPlayerWithChar(1, char1, bal1);
  G.player2 = makePvpPlayerWithChar(2, char2, bal2);
  G.player2.isAI = true; /* AI自动行动 */

  G.player.x = VW*0.25; G.player.y = 580; G.player.facing = 1;
  G.player2.x = VW*0.75; G.player2.y = 580; G.player2.facing = -1;

  gameState = 'playing';
  G.waveState = 'fight';
  G.bannerText = '对决开始！'; G.bannerTimer = 1.5;
  if(window.showTouchControls) window.showTouchControls(true);
  updateSkillIcons(1, char1.weaponIdx);
  updateSkillIcons(2, char2.weaponIdx);
  startBGM();
}

function newGame(mode){
  gameMode = mode || 'single';
  if(gameMode==='single'){
    G = { t:0, player: makePlayer(), enemies:[], projectiles:[], particles:[], effects:[], texts:[],
      levelIdx:0, waveIdx:0, waveState:'idle', waveTimer:0, waveNum:0,
      combo:0, comboTimer:0, shake:0, hitstop:0, flash:0, hitFlashColor:'#fff', totalKills:0, bannerText:'', bannerTimer:0,
      currentIsBoss:false, camera:{x:0,y:0}, worldWidth:999999, traps:[] };
    gameState = 'playing';
    if(window.showTouchControls) window.showTouchControls(false);
    updateSkillIcons(1, G.player.weaponIdx);
  } else {
    G = { t:0, player:null, player2:null, enemies:[], projectiles:[], particles:[], effects:[], texts:[],
      levelIdx:0, waveIdx:0, waveState:'fight', waveTimer:0,
      combo:0, comboTimer:0, shake:0, hitstop:0, flash:0, hitFlashColor:'#fff', totalKills:0, bannerText:'', bannerTimer:0, isPvp:true };
    gameState = 'pvpSelect';
    pvpState = 'select1'; pvpSelect = [0,0]; pvpWinner = -1;
  }
}
function startPvpFight(){
  const w1 = WEAPONS[pvpSelect[0]], w2 = WEAPONS[pvpSelect[1]];
  G.player = makePvpPlayer(1, pvpSelect[0], PVP_BALANCE[w1.id]);
  G.player2 = makePvpPlayer(2, pvpSelect[1], PVP_BALANCE[w2.id]);
  G.player.x = VW*0.25; G.player.y = 580; G.player.facing = 1;
  G.player2.x = VW*0.75; G.player2.y = 580; G.player2.facing = -1;
  gameState = 'playing';
  G.waveState = 'fight';
  G.bannerText = '对决开始！'; G.bannerTimer = 1.5;
  if(window.showTouchControls) window.showTouchControls(true);
  updateSkillIcons(1, pvpSelect[0]);
  updateSkillIcons(2, pvpSelect[1]);
}
function makePvpPlayer(num, weaponIdx, bal){
  return { isPlayer:true, playerNum:num, x:VW*0.35, y:600, h:0, vy:0, kx:0, facing:num===1?1:-1,
    hp:bal.hp, maxHp:bal.hp, mp:bal.mp, maxMp:bal.mp, level:60, exp:0, expNext:80,
    atk:bal.atk, weaponIdx, state:'idle', walkPhase:0, action:null, attackBuffer:0, comboWindow:0, comboIdx:0,
    invuln:0, hitFlash:0, hurtT:0, dead:false, cds:[0,0,0,0,0,0], moveSpeed:bal.spd, launchT:0, jumpT:0, landingT:0, landingStartH:0,
    upperArmAng:1.05, foreArmAng:-1.1, weaponAng:0, bodyLean:0.05, kneeBend:3,
    backUpperArmAng:1.5, backForeArmAng:-1.5, legPose:0,
    skillLevels:[1,1,1,1,1,1], skillsUnlocked:[true,true,true,true,true,true], pvpAllSkills:true,
    dodgeT:0, dodgeCd:0, dodgeDir:0, stamina:100, maxStamina:100 };
}
function makePlayer(){
  return { isPlayer:true, playerNum:1, x:VW*0.35, y:600, h:0, vy:0, kx:0, facing:1,
    hp:150, maxHp:150, mp:100, maxMp:100, level:1, exp:0, expNext:80, atk:15, weaponIdx:0,
    state:'idle', walkPhase:0, action:null, attackBuffer:0, comboWindow:0, comboIdx:0,
    invuln:0, hitFlash:0, hurtT:0, dead:false, cds:[0,0,0,0,0,0], moveSpeed:350,
    launchT:0, jumpT:0, landingT:0, landingStartH:0,
    upperArmAng:1.05, foreArmAng:-1.1, weaponAng:0, bodyLean:0.05, kneeBend:3,
    backUpperArmAng:1.5, backForeArmAng:-1.5, legPose:0,
    dodgeT:0, dodgeCd:0, dodgeDir:0, stamina:100, maxStamina:100 };
}
function makePlayerWithChar(char){
  return { isPlayer:true, playerNum:1, x:VW*0.35, y:600, h:0, vy:0, kx:0, facing:1,
    hp:char.hp, maxHp:char.hp, mp:char.mp, maxMp:char.mp, 
    /* ★ 改进2: 血条延迟效果 */
    displayHp:char.hp, damageHp:char.hp,
    level:1, exp:0, expNext: getExpNeed(1), 
    skillPoints: SP_START,
    skillLevels: [1, 1, 0, 0, 0, 0],
    skillsUnlocked: [true, true, false, false, false, false],
    atk:char.atk, weaponIdx:char.weaponIdx,
    baseStat: { atk:char.atk, maxHp:char.hp, maxMp:char.mp, moveSpeed:char.spd, critBonus:0, def:0 },
    state:'idle', walkPhase:0, action:null, attackBuffer:0, comboWindow:0, comboIdx:0,
    invuln:0, hitFlash:0, hurtT:0, dead:false, cds:[0,0,0,0,0,0], moveSpeed:char.spd,
    launchT:0, jumpT:0, landingT:0, landingStartH:0,
    upperArmAng:1.05, foreArmAng:-1.1, weaponAng:0, bodyLean:0.05, kneeBend:3,
    backUpperArmAng:1.5, backForeArmAng:-1.5, legPose:0,
    charId:char.id,
    dodgeT:0, dodgeCd:0, dodgeDir:0, stamina:100, maxStamina:100,
    /* 装备系统 */
    equipment: { weapon:null, head:null, armor:null, shoes:null, necklace:null, ring:null, bracer:null },
    inventory: [],
    gold: 0,
    materials: { enhance_stone_low:0, enhance_stone_mid:0, enhance_stone_high:0, chaos_stone:0 },
    amplifyStones: {},
    propBonuses: { atk:0, hp:0, mp:0, cdReduce:0, crit:0 },
    props: { atk_pill:0, hp_pill:0, mp_pill:0, cd_book:0, crit_gem:0 },
    clearedLevels: []
  };
}

/* 出生装备：保证铁匠铺一开局就能使用（DNF式新手白装） */
function makeStarterEquip(slot, weaponIdx){
  const wIdx = weaponIdx || 0;
  const tier = EQUIP_TIERS[0];
  const equip = {
    slot: slot, name: '', tier: tier.id, tierName: tier.name, tierColor: tier.color,
    grade: '中级', gradeMul: 1.0, level: 1, enhance: 0, amplify: 0,
    weaponType: slot === 'weapon' ? (WEAPONS[wIdx] ? WEAPONS[wIdx].id : 'sword') : null,
    baseAtk: 0, baseHp: 0, baseDef: 0, baseSpd: 0, baseCrit: 0, extraStats: []
  };
  if(slot === 'weapon'){ equip.name = (WEAPONS[wIdx] ? WEAPONS[wIdx].name : '青锋剑') + '·初'; equip.baseAtk = 11; }
  else if(slot === 'head'){ equip.name = '粗布头巾'; equip.baseHp = 33; }
  else if(slot === 'armor'){ equip.name = '粗布衣'; equip.baseHp = 33; equip.baseDef = 6; }
  else if(slot === 'shoes'){ equip.name = '布鞋'; equip.baseSpd = 11; }
  else if(slot === 'accessory' || slot === 'ring'){ equip.name = '木坠'; equip.baseCrit = 3; }
  else if(slot === 'necklace'){ equip.name = '铜链'; equip.baseCrit = 2; equip.baseHp = 10; }
  else if(slot === 'bracer'){ equip.name = '粗麻护腕'; equip.baseCrit = 1; equip.baseHp = 16; }
  rollEquipDnf(equip);
  return equip;
}

/* 升级所需经验曲线 */
function getExpNeed(level){
  // 等级越高，需要经验越多，60级封顶（前期升级快、后期平缓）
  return Math.round(260 * Math.pow(level, 1.6));
}

/* 获取升级后属性成长（优化版：每级成长更明显，60级裸装HP>20000） */
function getLevelGrowth(level){
  return {
    hp: Math.round(80 + 15 * level),
    mp: Math.round(40 + 8 * level),
    atk: Math.round(3 + 2 * level)
  };
}
/* ★ DNF式伤害计算：获取敌人防御力 */
function getEnemyDefense(enemy){
  const eLv = enemy.level || (G.levelIdx || 0) + 1;
  const baseDef = enemy.def.boss ? 80 : 50;
  return Math.round(baseDef * Math.pow(1.05, eLv));
}
/* ★ DNF式伤害公式：最终伤害 = 基础伤害 × 防御减伤 × 等级修正 */
function calcDnfDamage(baseDmg, src, target){
  const atkLv = src.level || 1;
  const defLv = target.level || (G.levelIdx || 0) + 1;
  /* ★ 强化/增幅带来的「无视防御攻击力」直接削减目标防御 */
  const srcPierce = (src && src.pierce) || 0;
  const eDef = Math.max(0, (target.defense || getEnemyDefense(target)) - srcPierce);
  /* 防御减伤率：def / (def + 200 + 100 × 攻击者等级) */
  const defDenom = eDef + 200 + 100 * atkLv;
  const defReduction = Math.max(0.1, 1 - eDef / defDenom);
  /* 等级修正：每差1级+4%伤害（最高+240% at Lv60） */
  const lvCorrection = 1 + 0.04 * Math.max(0, atkLv - 1);
  return Math.round(baseDmg * defReduction * lvCorrection);
}
function makePvpPlayerWithChar(num, char, bal){
  return { isPlayer:true, playerNum:num, x:VW*0.35, y:600, h:0, vy:0, kx:0, facing:num===1?1:-1,
    hp:bal.hp, maxHp:bal.hp, mp:bal.mp, maxMp:bal.mp, level:60, exp:0, expNext:80,
    atk:bal.atk, weaponIdx:char.weaponIdx, state:'idle', walkPhase:0, action:null, attackBuffer:0, comboWindow:0, comboIdx:0,
    invuln:0, hitFlash:0, hurtT:0, dead:false, cds:[0,0,0,0,0,0], moveSpeed:bal.spd, launchT:0, jumpT:0, landingT:0, landingStartH:0,
    upperArmAng:1.05, foreArmAng:-1.1, weaponAng:0, bodyLean:0.05, kneeBend:3,
    backUpperArmAng:1.5, backForeArmAng:-1.5, legPose:0,
    charId:char.id,
    skillLevels:[1,1,1,1,1,1], skillsUnlocked:[true,true,true,true,true,true], pvpAllSkills:true,
    dodgeT:0, dodgeCd:0, dodgeDir:0, stamina:100, maxStamina:100 };
}

function spawnParticles(x,y,n,o){
  /* 粒子预算：以前硬上限是 3000 个，48 个技能轮着放时整屏都是发光点，浏览器直接跪。
     现在按设备给总上限，低端机再缩减单次生成量 —— 画面仍有碎屑飞溅，但不再糊成一团光。 */
  const CAP = (typeof PERF_LOW !== 'undefined' && PERF_LOW) ? 420 : 900;
  if(G.particles.length >= CAP) return;
  o = o||{};
  let cnt = n;
  if(typeof PERF_LOW !== 'undefined' && PERF_LOW) cnt = Math.max(1, Math.round(n * 0.4));
  for(let i=0;i<cnt;i++){
    const a = o.angle!==undefined ? o.angle + rand(-(o.spread||0.9),(o.spread||0.9)) : rand(0,TAU);
    const sp = rand(o.spMin||80, o.spMax||450);
    const life = rand(o.lifeMin||0.2, o.lifeMax||0.6);
    G.particles.push({ x, y, h:o.h||0, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp, vh:o.vh!==undefined?o.vh:rand(-100,300), life, maxLife:life, size:rand(o.sizeMin||2,o.sizeMax||6), color:o.color||'#fff', grav:o.grav!==undefined?o.grav:800, isBlood:o.isBlood||false });
  }
}
function addEffect(type,x,y,dur,extra){ G.effects.push(Object.assign({type,x,y,t:0,dur}, extra||{})); }
function spawnText(x,y,h,text,color,size){ G.texts.push({x:x+rand(-20,20),y,h,text,color:color||'#fff',size:size||22,t:0,dur:0.8,vx:rand(-40,40),vy:-80}); }
function playerAtk(){ const p = currentSkillCaster || G.player; return p.atk * WEAPONS[p.weaponIdx].atkMul; }
function getAtk(src){ const p = src || currentSkillCaster || G.player; const w = WEAPONS[p.weaponIdx]; return p.atk * (w ? w.atkMul : 1.0); }

function meleeHitRect(src,cx,cy,w,h,dmg,opt){
  opt = opt||{};
  if(src.isPlayer){
    for(const e of G.enemies){ if(!e.alive) continue; if(Math.abs(e.x-cx) < w/2+e.radius && Math.abs((e.y-cy)*2.2) < h/2+e.radius*0.6) damageEnemy(e,dmg,src,opt); }
    if(G.isPvp){
      const t = src===G.player?G.player2:G.player;
      if(t && !t.dead && t.invuln<=0 && Math.abs(t.x-cx)<w/2+30 && Math.abs((t.y-cy)*2.2)<h/2+25) damagePvpPlayer(t,dmg,src,opt);
    }
  } else {
    const t = G.player;
    if(t && !t.dead && t.invuln<=0 && Math.abs(t.x-cx)<w/2+30 && Math.abs((t.y-cy)*2.2)<h/2+25){
      damagePlayer(dmg);
      if(opt.launch){ t.launchT = 0.4; t.vy = -400; t.h = Math.max(t.h,1); }
    }
  }
}
function meleeAoe(src,cx,cy,R,dmg,opt){
  opt = opt||{};
  if(src.isPlayer){
    for(const e of G.enemies){ if(!e.alive) continue; const dx=e.x-cx, dy=(e.y-cy)*2.2; if(dx*dx+dy*dy < (R+e.radius)*(R+e.radius)) damageEnemy(e,dmg,src,opt); }
    if(G.isPvp){
      const t = src===G.player?G.player2:G.player;
      if(t && !t.dead && t.invuln<=0){ const dx=t.x-cx, dy=(t.y-cy)*2.2; if(dx*dx+dy*dy < (R+30)*(R+30)) damagePvpPlayer(t,dmg,src,opt); }
    }
  } else {
    const t = G.player;
    if(t && !t.dead && t.invuln<=0){ const dx=t.x-cx, dy=(t.y-cy)*2.2; if(dx*dx+dy*dy < (R+30)*(R+30)){
      damagePlayer(dmg);
      if(opt.launch){ t.launchT=0.4; t.vy=-400; t.h=Math.max(t.h,1);}
    } }
  }
}
function damagePvpPlayer(target,dmg,src,opt){
  opt = opt||{};
  if(!target || target.dead || target.invuln>0) return;
  /* ★ PK 技能伤害预算：按最大生命百分比结算，超出预算的部分直接截断
     —— 这样无论技能有几段伤害，一招打完的总量都稳定 */
  let budgeted = false;
  if(src && src.pvpBudget && (G.t || 0) < (src.pvpBudget.until || 0)){
    if(src.pvpBudget.left <= 0) return;
    const cut = Math.min(dmg, src.pvpBudget.left);
    src.pvpBudget.left -= cut;
    dmg = cut;
    budgeted = true;
  }
  const isCrit = !budgeted && Math.random() < 0.12;
  const final = isCrit ? Math.round(dmg*1.5) : Math.round(dmg);
  target.hp -= final; target.hitFlash = 0.12; target.hurtT = 0.15; target.invuln = 0.3;
  spawnText(target.x, target.y, 100+target.h, (isCrit?'暴击 ':'')+final, isCrit?'#ff6a4a':'#ffe9a8', isCrit?28:22);
  playSound('impact');
  if(opt.kb){
    const kbForce = Math.min(opt.kb*0.3, 80);
    target.kx = (Math.sign(target.x-src.x)||1)*kbForce;
  }
  if(opt.launch){ target.launchT=0.4; target.vy=-400; target.h=Math.max(target.h,1); }
  spawnParticles(target.x, target.y-target.h-50, isCrit?20:12, {color:isCrit?'#ff1111':'#aa0000', spMin:100, spMax:isCrit?400:250, lifeMin:0.3, lifeMax:0.7, sizeMin:2, sizeMax:5, grav:1500, vh:rand(50,200), isBlood:true});
  addEffect('hitRing', target.x, target.y, 0.25, {color:isCrit?'#ffb066':'#fff', r:40});
  G.shake = Math.max(G.shake, isCrit?10:5); G.hitstop = Math.max(G.hitstop, isCrit?0.06:0.03);
  G.flash = Math.max(G.flash, isCrit?0.15:0.06); G.hitFlashColor = '#fff';
}
function damageEnemy(e,dmg,src,opt){
  opt = opt||{};
  if(!e.alive) return;
  /* ★ Boss伤害统计：追踪每个技能对Boss的伤害 */
  if(e.def && e.def.boss && src && src.isPlayer && G && G.skillDamageStats){
    const skillIdx = (typeof currentSkillIdx !== 'undefined') ? currentSkillIdx : -1;
    const key = skillIdx >= 0 ? 'skill' + skillIdx : 'attack';
    if(!G.skillDamageStats[key]) G.skillDamageStats[key] = { total: 0, count: 0 };
    G.skillDamageStats[key].total += dmg;
    G.skillDamageStats[key].count += 1;
  }
  /* ★ 敌人格挡机制 */
  let blocked = false;
  if(e.blocking && e.blocking > 0){
    blocked = true;
    dmg *= 0.2; /* 格挡减少80%伤害 */
    spawnText(e.x, e.y, 120+e.h, '格挡!', '#88ccff', 24);
    playSound('impact');
    addEffect('hitRing', e.x, e.y, 0.3, {color:'#88ccff', r:50});
  }
  /* ★ DNF式伤害计算：玩家攻击敌人时应用防御减伤+等级修正 */
  if(src && src.isPlayer && !blocked){
    dmg = calcDnfDamage(dmg, src, e);
  }
  /* ★ DNF 词条：伤害增加 + 属性强化 */
  if(src && src.isPlayer && !blocked){
    const db = (src.dmgBonusPct || 0) / 100;
    const eb = (src.elemBonusPct || 0) / 100;
    if(db > 0 || eb > 0) dmg *= (1 + db + eb);
  }
  const critChance = 0.15 + (src && src.critBonus ? src.critBonus : 0);
  const isCrit = !blocked && Math.random() < critChance;
  /* ★ DNF 词条：暴击伤害 */
  const critMul = 1.8 + ((src && src.critDmgPct) || 0) / 100;
  const final = isCrit ? Math.round(dmg*critMul) : Math.round(dmg);
  /* ★ DNF 词条：附加伤害（独立追加一段） */
  let addVal = 0;
  if(src && src.isPlayer && !blocked && (src.addDmgPct || 0) > 0){
    addVal = Math.max(1, Math.round(final * (src.addDmgPct || 0) / 100));
    e.hp -= addVal;
  }
  e.hp -= final; e.hitFlash = 0.12; e.hurtT = blocked ? 0.05 : 0.15;
  /* ★ 改进8: 伤害数字差异化 - 暴击更大更醒目 */
  const dmgText = (blocked?'':(isCrit?'暴击 ':''))+final+(isCrit?'!':'');
  const dmgSize = blocked?24:(isCrit?36:22);
  const dmgColor = blocked?'#88ccff':(isCrit?'#ff4444':'#ffe9a8');
  spawnText(e.x, e.y, 100+e.h, dmgText, dmgColor, dmgSize);
  if(addVal > 0) spawnText(e.x, e.y, 148+e.h, '附加 '+addVal, '#c98bff', 18);
  if(!blocked) playSound('impact');
  if(opt.kb && !blocked) e.kx = (Math.sign(e.x-src.x)||1)*opt.kb;
  if(opt.launch && !blocked){ e.launchT=0.5; e.vy=-500; e.h=Math.max(e.h,1); }
  if(!blocked){
    spawnParticles(e.x, e.y-e.h-50, isCrit?24:15, {color:isCrit?'#ff1111':'#aa0000', spMin:100, spMax:isCrit?500:300, lifeMin:0.3, lifeMax:0.8, sizeMin:2, sizeMax:6, grav:1500, vh:rand(50,200), isBlood:true});
    spawnParticles(e.x, e.y-e.h-50, 8, {color:'#fff', spMin:100, spMax:400, lifeMin:0.1, lifeMax:0.3, sizeMin:1, sizeMax:3, grav:600});
    addEffect('hitRing', e.x, e.y, 0.25, {color:isCrit?'#ffb066':'#fff', r:40});
    addEffect('bloodStain', e.x+rand(-10,10), e.y+rand(-5,5), 3.0, {size:rand(15,30)});
    G.shake = Math.max(G.shake, isCrit?12:6); G.hitstop = Math.max(G.hitstop, isCrit?0.08:0.035);
    G.flash = Math.max(G.flash, isCrit?0.2:0.08); G.hitFlashColor = '#fff';
  }
  /* ★ Roguelike: 生命汲取 */
  if(src && src.lifesteal && src.lifesteal > 0 && src.isPlayer && src.hp !== undefined){
    const heal = Math.round(final * src.lifesteal);
    if(heal > 0){ src.hp = Math.min(src.maxHp, src.hp + heal); }
  }
  if(e.hp <= 0) killEnemy(e);
}
function killEnemy(e){
  if(!e.alive) return;
  e.alive = false; e.deathT = 0;
  playSound('explosion');
  /* ★ 词条：剧毒——死亡时喷出毒雾，近身者受创 */
  if(e.affix === 'venom'){
    addEffect('hitRing', e.x, e.y, 0.55, { color:'#8adf5a', r:150 });
    spawnParticles(e.x, e.y-40, 26, { color:'#9be36b', spMin:80, spMax:320, lifeMin:0.5, lifeMax:1.1, sizeMin:3, sizeMax:7, grav:420 });
    const pl = G.player;
    if(pl && !pl.dead && !pl.isPvp && Math.hypot(pl.x - e.x, pl.y - e.y) < 150) damagePlayer(Math.round(e.atk * 0.6));
  }
  spawnParticles(e.x, e.y-50, 40, {color:'#cc0000', spMin:150, spMax:600, lifeMin:0.4, lifeMax:1.2, sizeMin:3, sizeMax:8, grav:1500, vh:rand(100,300), isBlood:true});
  addEffect('bloodStain', e.x, e.y, 5.0, {size:rand(30,60)});
  G.shake = Math.max(G.shake, e.def.boss?24:8); G.hitstop = Math.max(G.hitstop, e.def.boss?0.15:0.05);
  const p = G.player;
  G.combo += 1; G.comboTimer = 2.0 * (p.comboExtMul || 1); G.totalKills++;
  /* ★ 主线任务：击杀计数 */
  p.questKills = (p.questKills || 0) + 1;
  /* ★ Roguelike: 经验加成 */
  const expGain = Math.round(e.def.exp * 1.8 * (p.expMul || 1));
  p.exp += expGain; p.mp = Math.min(p.maxMp, p.mp+10);
  
  /* ★ 等级提升检测 */
  while(p.level < 60 && p.exp >= p.expNext){
    p.exp -= p.expNext;
    p.level++;
    p.expNext = getExpNeed(p.level);
    p.skillPoints = (p.skillPoints || 0) + SP_PER_LEVEL; // 每级获得固定技能点
    
    // ★ DNF式指数属性成长（写进本体快照，装备加成不参与成长滚雪球）
    const growth = getLevelGrowth(p.level);
    growBaseStat(p, 1.08, growth.hp, growth.mp);
    recalcPlayerStats();
    p.hp = p.maxHp;
    p.mp = p.maxMp;
    
    spawnText(p.x, p.y - 120, 80, `升级！Lv.${p.level}`, '#ffd700', 24);
    spawnText(p.x, p.y - 90, 80, `技能点 +${SP_PER_LEVEL} (按U分配)`, '#c9a2ff', 16);
    spawnText(p.x, p.y - 60, 80, `获得${growth.hp}HP ${growth.mp}MP ${growth.atk}攻击`, '#9fe6ff', 14);
  }
  
  /* ★ 掉落系统 */
  if(!G.isPvp){
    const drops = rollEnemyDrops(e, G.levelIdx || 0);
    if(!G.drops) G.drops = [];
    for(let i = 0; i < drops.length; i++){
      const drop = drops[i];
      const dx = e.x + rand(-40, 40);
      const dy = e.y + rand(-20, 20);
      G.drops.push({
        x: dx, y: dy,
        vy: rand(-150, -50),
        vx: rand(-30, 30),
        type: drop.type,
        equip: drop.equip,
        prop: drop.prop,
        material: drop.material,
        gold: drop.amount,
        life: 15.0,
        bobPhase: rand(0, TAU),
        age: 0, magnet: false, magnetSpd: 0, magnetT: 0
      });
      // 掉落特效
      if(drop.type === 'equip'){
        spawnText(dx, dy-30, 80, '获得装备!', drop.equip.tierColor, 20);
        spawnParticles(dx, dy-20, 15, {color:drop.equip.tierColor, spMin:50, spMax:200, lifeMin:0.3, lifeMax:0.8, sizeMin:2, sizeMax:5, grav:-100});
      }
    }
  }
}
function damagePlayer(dmg){
  const p = G.player;
  if(p.invuln > 0 || p.dead) return;
  /* ★ 格挡机制：在格挡窗口内受击触发格挡 */
  if(p.parryActive){
    /* 成功格挡！ */
    playSound('impact');
    spawnText(p.x, p.y, 150, '格挡！', '#ffd700', 32);
    spawnParticles(p.x, p.y-60, 25, {color:'#ffd700', spMin:100, spMax:350, lifeMin:0.3, lifeMax:0.7, sizeMin:3, sizeMax:7, grav:-100});
    addEffect('hitRing', p.x, p.y, 0.4, {color:'#ffd700', r:60});
    G.shake = Math.max(G.shake, 12); G.flash = 0.2; G.hitFlashColor = '#ffd700'; G.hitstop = Math.max(G.hitstop, 0.1);
    /* 格挡后反击：短暂无敌并回复少量生命 */
    p.invuln = 0.8;
    p.hp = Math.min(p.maxHp, p.hp + Math.round(p.maxHp * 0.05));
    /* 眩晕附近敌人 */
    for(const e of G.enemies){
      if(!e.alive) continue;
      const dx = e.x - p.x, dy = e.y - p.y;
      if(dx*dx + dy*dy < 150*150){
        e.hurtT = 0.8; /* 眩晕0.8秒 */
        e.kx = Math.sign(dx) * 200;
        spawnText(e.x, e.y, 100, '眩晕!', '#ffd700', 20);
      }
    }
    return; /* 不受到伤害 */
  }
  /* ★ Roguelike: 伤害减免 */
  const dmgReduction = p.damageReduction || 0;
  /* ★ 防御力减伤（装备强化/增幅提升防御后更耐打） */
  const pdef = Math.max(0, p.def || 0);
  const defRed = Math.min(0.7, pdef / (pdef + 400 + 30 * (p.level || 1)));
  const finalDmg = Math.max(1, Math.round(dmg * (1 - dmgReduction) * (1 - defRed)));
  p.hp -= finalDmg; p.invuln = 0.6; p.hitFlash = 0.15; p.hurtT = 0.2;
  playSound('impact');
  G.shake = Math.max(G.shake, 8); G.flash = 0.25; G.hitFlashColor = '#ff4444';
  spawnText(p.x, p.y, 120, '-'+finalDmg, '#ff6a5a', 24);
  spawnParticles(p.x, p.y-50, 15, {color:'#cc0000', spMin:100, spMax:300, lifeMin:0.3, lifeMax:0.8, sizeMin:2, sizeMax:5, grav:1500, vh:rand(50,150), isBlood:true});
  addEffect('bloodStain', p.x, p.y, 2.0, {size:rand(10,20)});
  if(p.hp <= 0){
    p.hp = 0; p.dead = true;
    if(!G.isPvp && !(window.REVIVE && REVIVE.ask())) gameState = 'gameover';
  }
}

