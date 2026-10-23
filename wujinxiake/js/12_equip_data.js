/* ===== 装备系统（参考DNF） ===== */
const EQUIP_TIERS = [
  { id:'common', name:'普通', color:'#ffffff', baseMul:1.0, extraStats:0, dropRate:0.60 },
  { id:'advanced', name:'高级', color:'#3498db', baseMul:1.3, extraStats:1, dropRate:0.25 },
  { id:'rare', name:'稀有', color:'#9b59b6', baseMul:1.7, extraStats:2, dropRate:0.10 },
  { id:'epic', name:'神器', color:'#e91e63', baseMul:2.2, extraStats:3, dropRate:0.04 },
  { id:'legend', name:'传说', color:'#e67e22', baseMul:2.8, extraStats:4, dropRate:0.009 },
  { id:'mythic', name:'史诗', color:'#ff3030', baseMul:3.5, extraStats:5, dropRate:0.001 }
];

/* 7 个装备槽：武器 / 头部 / 上衣 / 鞋子 / 项链 / 戒指 / 护腕 */
const EQUIP_SLOTS = ['weapon', 'head', 'armor', 'shoes', 'necklace', 'ring', 'bracer'];
/* 旧存档里的 accessory 一律视作戒指（ring） */
const ACCESSORY_ALIAS = 'ring';

/* ============================================================
   ★ DNF 式装备属性体系（完整对标地下城与勇士）
   ── 四维：力量 / 智力 / 体力 / 精神
   ── 攻击：物理攻击 / 魔法攻击 / 独立攻击
   ── 防御：物理防御 / 魔法防御
   ── 战斗：物理暴击 / 命中 / 回避 / 攻速 / 施放 / 移速
   ── 词条：伤害增加 / 附加伤害 / 暴击伤害 / 属性强化 / 无视防御
   ── 每个部位有各自的属性权重，所以每件装备都不止一条属性
   ============================================================ */
const DNF_STAT_BASE = {
  weapon:   { patk:1.00, matk:0.25, pdef:0.05, mdef:0.05, str:0.90, int:0.15, vit:0.20, spr:0.10, pcrit:0.30, hit:0.25, dodge:0.00, atkSpd:0.15, castSpd:0.05, moveSpd:0.05 },
  head:     { patk:0.05, matk:0.15, pdef:0.55, mdef:0.60, str:0.15, int:0.45, vit:0.35, spr:0.55, pcrit:0.10, hit:0.35, dodge:0.10, atkSpd:0.00, castSpd:0.20, moveSpd:0.00 },
  armor:    { patk:0.03, matk:0.10, pdef:1.00, mdef:0.70, str:0.35, int:0.10, vit:0.90, spr:0.25, pcrit:0.00, hit:0.00, dodge:0.05, atkSpd:0.00, castSpd:0.05, moveSpd:0.00 },
  shoes:    { patk:0.05, matk:0.10, pdef:0.30, mdef:0.30, str:0.20, int:0.10, vit:0.30, spr:0.15, pcrit:0.05, hit:0.10, dodge:0.40, atkSpd:0.20, castSpd:0.15, moveSpd:0.70 },
  accessory:{ patk:0.25, matk:0.25, pdef:0.20, mdef:0.25, str:0.50, int:0.50, vit:0.50, spr:0.50, pcrit:0.45, hit:0.30, dodge:0.30, atkSpd:0.10, castSpd:0.15, moveSpd:0.15 },
  necklace:{ patk:0.15, matk:0.35, pdef:0.15, mdef:0.30, str:0.30, int:0.65, vit:0.35, spr:0.55, pcrit:0.25, hit:0.35, dodge:0.20, atkSpd:0.05, castSpd:0.25, moveSpd:0.10 },
  ring:    { patk:0.30, matk:0.20, pdef:0.20, mdef:0.20, str:0.55, int:0.35, vit:0.45, spr:0.35, pcrit:0.55, hit:0.25, dodge:0.25, atkSpd:0.15, castSpd:0.10, moveSpd:0.10 },
  bracer:  { patk:0.25, matk:0.20, pdef:0.30, mdef:0.25, str:0.50, int:0.30, vit:0.55, spr:0.40, pcrit:0.30, hit:0.30, dodge:0.35, atkSpd:0.20, castSpd:0.10, moveSpd:0.20 }
};

/* 四维 / 二级属性的换算系数（参考 DNF 面板逻辑，做等比例缩放） */
const DNF_COEF = {
  atkPerStr: 0.80,      // 1 力量 = 0.8 物理攻击
  matkPerInt: 0.60,     // 1 智力 = 0.6 魔法攻击（本作折算为技能伤害）
  hpPerVit: 6,          // 1 体力 = 6 生命
  defPerVit: 0.35,      // 1 体力 = 0.35 物防
  mpPerSpr: 3,          // 1 精神 = 3 内力
  mdefPerSpr: 0.30,
  skillPctPerInt: 0.15  // 1 智力 = 技能伤害 +0.15%
};

/* 词条池：品阶越高，随机词条越多、数值越大 */
const DNF_AFFIX_POOL = [
  { key:'dmgBonus', label:'伤害增加',   min:2, max:7,  suffix:'%', scale:0.045 },
  { key:'addDmg',   label:'附加伤害',   min:1, max:4,  suffix:'%', scale:0.030 },
  { key:'critDmg',  label:'暴击伤害',   min:5, max:16, suffix:'%', scale:0.060 },
  { key:'pierce',   label:'无视防御',   min:3, max:14, suffix:'',  scale:0.070 },
  { key:'elemFire', label:'火属性强化', min:4, max:14, suffix:'',  scale:0.060 },
  { key:'elemIce',  label:'冰属性强化', min:4, max:14, suffix:'',  scale:0.060 },
  { key:'elemLight',label:'光属性强化', min:4, max:14, suffix:'',  scale:0.060 },
  { key:'elemDark', label:'暗属性强化', min:4, max:14, suffix:'',  scale:0.060 },
  { key:'atkSpd',   label:'攻击速度',   min:1, max:5,  suffix:'%', scale:0.035 },
  { key:'moveSpd',  label:'移动速度',   min:1, max:5,  suffix:'%', scale:0.035 },
  { key:'hit',      label:'命中率',     min:1, max:4,  suffix:'%', scale:0.030 },
  { key:'dodge',    label:'回避率',     min:1, max:3,  suffix:'%', scale:0.025 },
  { key:'lifesteal',label:'生命汲取',   min:1, max:3,  suffix:'%', scale:0.020 },
  { key:'cdReduce', label:'冷却缩减',   min:2, max:6,  suffix:'%', scale:0.040 }
];

/* 根据部位 / 品阶 / 等级 / 品级，生成一整块 DNF 属性 */
function rollEquipDnf(eq){
  const slot = eq.slot || 'accessory';
  const w = DNF_STAT_BASE[slot] || DNF_STAT_BASE.accessory;
  const tier = EQUIP_TIERS.find(t => t.id === eq.tier) || EQUIP_TIERS[0];
  const lv = eq.level || 1;
  /* ★ 降低等级成长系数（0.085→0.05），让品阶差异更明显 */
  const s = (1 + lv * 0.05) * tier.baseMul * (eq.gradeMul || 1);
  const R = (v) => Math.round(v);
  const One = (v) => Math.round(v * 10) / 10;
  const d = {
    str: R(6 * w.str * s),
    int: R(6 * w.int * s),
    vit: R(6 * w.vit * s),
    spr: R(6 * w.spr * s),
    patk: R(9 * w.patk * s),
    matk: R(7 * w.matk * s),
    pdef: R(4 * w.pdef * s),
    mdef: R(4 * w.mdef * s),
    pcrit: One(w.pcrit * s * 1.2),
    hit: One(w.hit * s * 0.9),
    dodge: One(w.dodge * s * 0.9),
    atkSpd: One(w.atkSpd * s * 0.8),
    castSpd: One(w.castSpd * s * 0.8),
    moveSpd: One(w.moveSpd * s * 0.8),
    elemFire: 0, elemIce: 0, elemLight: 0, elemDark: 0,
    dmgBonus: 0, addDmg: 0, critDmg: 0, lifesteal: 0, cdReduce: 0, pierce: 0
  };
  /* 部位特色：饰品三件套必有属性强化 */
  if(slot === 'accessory' || slot === 'necklace' || slot === 'ring' || slot === 'bracer'){
    const elems = ['elemFire','elemIce','elemLight','elemDark'];
    d[elems[Math.floor(Math.random()*elems.length)]] += R(6 * s);
  }
  eq.dnf = d;
  /* 词条：按品阶数量随机抽取，不重复 */
  eq.affixes = rollEquipAffixes(eq);
  /* 部位的基础主属性同时写入 dnf，方便统一展示 */
  eq.dnf.hp  = eq.baseHp || 0;
  eq.dnf.spd = eq.baseSpd || 0;
  return d;
}

/* 按品阶重铸随机词条（洗练系统共用） */
function rollEquipAffixes(eq){
  const tier = EQUIP_TIERS.find(t => t.id === (eq && eq.tier)) || EQUIP_TIERS[0];
  const lv = (eq && eq.level) || 1;
  /* ★ 降低等级成长系数（0.085→0.05），让品阶差异更明显 */
  const s = (1 + lv * 0.05) * tier.baseMul * ((eq && eq.gradeMul) || 1);
  const count = tier.extraStats || 0;
  const pool = DNF_AFFIX_POOL.slice();
  const out = [];
  for(let i = 0; i < count && pool.length; i++){
    const idx = Math.floor(Math.random() * pool.length);
    const def = pool.splice(idx, 1)[0];
    const val = Math.max(1, Math.round(rand(def.min, def.max) * Math.min(2.2, 0.7 + def.scale * s)));
    out.push({ key: def.key, label: def.label, value: val, suffix: def.suffix });
  }
  return out;
}

/* 洗练消耗 */
function reforgeCostOf(eq){
  const lv = (eq && eq.level) || 1;
  const tierIdx = Math.max(0, EQUIP_TIERS.findIndex(t => t.id === (eq && eq.tier)));
  return {
    stone: 1 + Math.floor(lv / 25) + Math.floor(tierIdx / 3),
    gold: 260 + lv * 35 + tierIdx * 120
  };
}

/* 强化 / 增幅对 DNF 属性的额外成长（面板展示用） */
function equipDnfEnhance(eq){
  const out = { str:0, int:0, vit:0, spr:0, patk:0, pdef:0 };
  if(!eq) return out;
  const lv = eq.enhance || 0, amp = eq.amplify || 0;
  const g = ENHANCE_TIER_GAIN[equipTierKey(eq)] || ENHANCE_TIER_GAIN.common;
  out.patk = Math.round((eq.baseAtk || 0) * g.atkPct * lv);
  out.pdef = Math.round((eq.baseDef || 0) * g.defPct * lv);
  if(amp > 0){
    const ag = AMPLIFY_TIER_GAIN[equipTierKey(eq)] || AMPLIFY_TIER_GAIN.common;
    out.str = ag.str * amp;
    out.vit = ag.vit * amp;
    out.int = Math.round(ag.str * amp * 0.4);
    out.spr = Math.round(ag.vit * amp * 0.4);
  }
  return out;
}


/* ============================================================
   ★ 装备名称体系
   —— 白装 / 蓝装：用「前缀. 名字」复用低阶名池（如「白.死神之眼」「蓝.死神之眼」），
      省去大量低阶命名精力，同时保留辨识度。
   —— 紫装及以上：每件都有专属的、优美的名字，绝不重复。
   —— 饰品拆为 项链 / 戒指 / 护腕 三类，各有专属名池。
   ============================================================ */
const TIER_NAME_PREFIX = { common:'白', advanced:'蓝', rare:'紫', epic:'粉', legend:'橙', mythic:'史诗' };

/* ★ 白/蓝/紫 的简洁基础名（生成时加「白· / 蓝· / 紫·」前缀，一眼识别品阶与部位） */
const SIMPLE_EQUIP_NAMES = { head:'布巾', armor:'布衣', shoes:'布鞋', necklace:'木坠', ring:'铜戒', bracer:'护腕', accessory:'铜戒' };
const SIMPLE_WEAPON_NAMES = { sword:'铁剑', blade:'钢刀', spear:'长枪', fist:'拳套', herb:'药杖', axe:'战斧', talisman:'黄符', cauldron:'丹鼎' };

/* ★ 装备等级阶梯：全部装备只出这 7 档 */
const EQUIP_LV_LADDER = [1, 10, 20, 30, 40, 50, 60];

const EQUIP_NAMES = {
  weapon: [
    // 宝剑类（剑士）
    '秋叶刀', '虚祖国刀', '裂创心灵之刃', '妖刀村正', '青光震兽剑', '含光斩岩剑', '泰拉石大剑', '魔剑阿波菲斯',
    // 大刀类（剑客）
    '荧光剑', '蓝光剑', '朱星剑', '夺魂者', '万仞圣光剑', '双龙魔影剑', '泰拉石光剑', '逸龙剑抉择',
    // 长枪类（枪手）
    '铁骑步枪', '狂暴左轮', '和平捍卫者', '狩猎之王', '死亡舞步', '毁灭公爵', '泰拉石步枪', '爆裂者血鹰',
    // 手套类（格斗家）
    '粗布拳套', '裂地拳套', '狂野锤', '地狱浩劫', '海妖散月拳套', '落日鹰眼', '泰拉石拳套', '双龙吞云'
  ],
  head: [
    '粗布头巾', '皮盔', '铁盔', '精钢盔', '玄铁战盔', '神龙宝冠', '紫金头盔', '神圣守护', '暗影杀手', '死神意志'
  ],
  armor: [
    '粗布衣', '皮甲', '锁子甲', '精铁甲', '玄铁战甲', '神龙宝甲', '紫金战甲', '神圣光铠', '暗影杀手', '死神之衣'
  ],
  shoes: [
    '布鞋', '皮靴', '铁靴', '疾风靴', '踏雪无痕', '神龙战靴', '紫金战靴', '神圣守护', '暗影行者', '死神脚步'
  ],
  necklace: [
    '木坠', '铜链', '银项链', '珍珠链', '琥珀坠', '青玉长命锁', '月魄珠串', '星河流光链', '龙骨项环', '天阙引'
  ],
  ring: [
    '铜戒指', '铁指环', '银戒', '鎏金戒', '琉璃戒', '赤霄扳指', '血珀之誓', '寒星指环', '湮灭之环', '轮回之戒'
  ],
  bracer: [
    '粗麻护腕', '皮护腕', '铁护腕', '鎏金腕甲', '精钢护腕', '玄铁腕甲', '龙鳞护腕', '天工腕轮', '死神之眼', '九曜星镯'
  ],
  accessory: [
    '木坠', '铜戒指', '银项链', '玉佩', '龙珠', '神农鼎', '紫金戒指', '神圣项链', '暗影之心', '死神之眼'
  ]
};

/* 高阶专属名（紫 / 粉 / 橙 / 史诗）：每部位每品阶单独命名，绝不与低阶撞名 */
const ELITE_NAMES = {
  head: {
    rare:   ['紫云冠', '泣血盔', '幻影之冕', '玄冥王冠', '灵犀护额', '千仞战盔'],
    epic:   ['苍穹皇冠', '星陨之盔', '冥王额印', '天罚之冠', '寂灭神盔'],
    legend: ['不灭王冠', '弑神之盔', '永恒圣冠', '太初之冕'],
    mythic: ['创世神冠', '归墟之冕', '万古不灭盔']
  },
  armor: {
    rare:   ['紫岚战甲', '泣血魔铠', '幻影之胄', '玄冥玄甲', '灵犀战袍', '千仞重铠'],
    epic:   ['苍穹神甲', '星陨之铠', '冥王战衣', '天罚神胄', '寂灭战铠'],
    legend: ['不灭神甲', '弑神之铠', '永恒圣甲', '太初之胄'],
    mythic: ['创世神甲', '归墟之胄', '万古不灭铠']
  },
  shoes: {
    rare:   ['紫云履', '泣血战靴', '幻影之靴', '玄冥踏云履', '灵犀疾行靴', '千仞追风靴'],
    epic:   ['苍穹神靴', '星陨之履', '冥王疾步', '天罚之靴', '寂灭踏空履'],
    legend: ['不灭神靴', '弑神之履', '永恒圣靴', '太初之履'],
    mythic: ['创世神靴', '归墟之履', '万古不灭靴']
  },
  necklace: {
    rare:   ['紫烟坠', '泣血之链', '幻影吊坠', '玄冥锁魂链', '灵犀同心坠', '千仞流光链'],
    epic:   ['苍穹之坠', '星陨吊坠', '冥王魂链', '天罚项环', '寂灭长命锁'],
    legend: ['不灭神链', '弑神之坠', '永恒流光链', '太初项环'],
    mythic: ['创世神链', '归墟之坠', '万古不灭链']
  },
  ring: {
    rare:   ['紫电指环', '泣血之戒', '幻影之环', '玄冥锁魂戒', '灵犀同心戒', '千仞流光戒'],
    epic:   ['苍穹之戒', '星陨指环', '冥王魂戒', '天罚之环', '寂灭长命戒'],
    legend: ['不灭神戒', '弑神之戒', '永恒流光戒', '太初之环'],
    mythic: ['创世神戒', '归墟之戒', '万古不灭戒']
  },
  bracer: {
    rare:   ['紫电护腕', '泣血腕甲', '幻影之腕', '玄冥锁魂腕', '灵犀同心腕', '千仞流光腕'],
    epic:   ['苍穹腕轮', '星陨护腕', '冥王魂腕', '天罚之腕', '寂灭长命腕'],
    legend: ['不灭神腕', '弑神之腕', '永恒流光腕', '太初腕轮'],
    mythic: ['创世神腕', '归墟之腕', '万古不灭腕']
  }
};

/* 高阶武器名（紫及以上，按武器类型），低阶用 WEAPON_NAME_BY_TYPE 前几档 */
const ELITE_WEAPON_NAMES = {
  sword:   { rare:['紫电青锋','泣血魔剑','幻影之刃'], epic:['苍穹圣剑','星陨神锋','冥王魔剑','天罚之剑'], legend:['不灭神剑','弑神之剑','永恒圣锋'], mythic:['创世神剑','归墟之剑','万古不灭剑'] },
  blade:   { rare:['紫电弯刀','泣血魔刀','幻影之刃'], epic:['苍穹圣刀','星陨神刀','冥王魔刀','天罚之刀'], legend:['不灭神刀','弑神之刀','永恒圣锋'], mythic:['创世神刀','归墟之刀','万古不灭刀'] },
  spear:   { rare:['紫电长枪','泣血魔枪','幻影之矛'], epic:['苍穹神枪','星陨战矛','冥王魔枪','天罚之枪'], legend:['不灭神枪','弑神之枪','永恒圣枪'], mythic:['创世神枪','归墟之枪','万古不灭枪'] },
  fist:    { rare:['紫电拳套','泣血魔拳','幻影之拳'], epic:['苍穹神拳','星陨拳套','冥王魔拳','天罚之拳'], legend:['不灭神拳','弑神之拳','永恒圣拳'], mythic:['创世神拳','归墟之拳','万古不灭拳'] },
  herb:    { rare:['紫灵芝杖','泣血百草','幻影药囊'], epic:['苍穹神农杖','星陨百草','冥王毒杖','天罚药鼎'], legend:['不灭神农杖','弑神百草','永恒青囊'], mythic:['创世神农杖','归墟百草','万古岐黄'] },
  axe:     { rare:['紫雷开山斧','泣血战斧','幻影巨斧'], epic:['苍穹神斧','星陨战斧','冥王魔斧','天罚之斧'], legend:['不灭神斧','弑神之斧','永恒干戚'], mythic:['创世神斧','归墟之斧','万古开天斧'] },
  talisman:{ rare:['紫雷符箓','泣血符笔','幻影符阵'], epic:['苍穹御雷符','星陨符图','冥王符箓','天罚敕令'], legend:['不灭神符','弑神之符','永恒符箓'], mythic:['创世神符','归墟之符','万古敕令'] },
  cauldron: { rare:['紫金丹鼎','泣血药鼎','幻影丹炉'], epic:['苍穹神鼎','星陨丹炉','冥王毒鼎','天罚之鼎'], legend:['不灭神鼎','弑神之鼎','永恒丹炉'], mythic:['创世神鼎','归墟之鼎','万古炼天炉'] }
};

/* ============================================================
   ★ 职业专属武器名池（每个职业一条命名谱系，由凡铁到神兵）
   —— 保证炼药师不会掉出「妖刀村正」这种出戏的东西
   ============================================================ */
const WEAPON_NAME_BY_TYPE = {
  sword: ['青锋剑', '霜刃剑', '秋水长剑', '流云剑', '含光斩岩剑', '青光震兽剑', '泰拉石大剑', '魔剑阿波菲斯'],
  blade: ['柴刀', '斩马刀', '赤炼弯刀', '夺魂者', '万仞圣光刀', '双龙魔影刀', '泰拉石光刀', '逸龙剑·抉择'],
  spear: ['白蜡杆', '破甲枪', '游龙枪', '穿云枪', '碎星长枪', '苍梧神枪', '泰拉石战矛', '爆裂者·血鹰'],
  fist: ['粗布拳套', '裂地拳套', '狂野锤', '地狱浩劫', '海妖散月拳套', '落日鹰眼', '泰拉石拳套', '双龙吞云'],
  herb: ['青囊药杖', '百草枯荣', '九花玉露枝', '千蛛毒囊', '生死符囊', '神农百草杖', '太乙青囊', '岐黄之始'],
  axe: ['开山斧', '劈山斧', '三板斧', '旋风巨斧', '力劈华山斧', '刑天干戚', '盘古开天斧', '混元一气斧'],
  talisman: ['黄纸符', '朱砂符笔', '五雷符箓', '万符朝宗匣', '神剑御雷符', '急急如律令', '万鬼符阵图', '三清敕令'],
  cauldron: ['青铜药鼎', '丹火小鼎', '三昧真火鼎', '九转丹炉', '九龙神火罩', '八卦炉', '太乙救苦鼎', '鸿蒙炼天炉']
};

/* ============================================================
   ★ 套装系统（4 部位套：头 / 衣 / 鞋 / 饰）
   —— 武器不进套装（每个职业 8 种武器，混套会串味）
   —— 2 件套给小属性，4 件套给质变词条，是「毕业装」目标
   ============================================================ */
const EQUIP_SETS = [
  { id:'shoudeng', name:'守灯人', color:'#ffd166',
    parts:{ head:'守灯·焰心冠', armor:'守灯·不灭火衣', shoes:'守灯·踏烬靴', accessory:'守灯·九灯佩' },
    bonus2:{ vit:32, spr:22, hp:120 },
    bonus4:{ dmgBonus:9, elemFire:18, critDmg:12 },
    desc:'第一代守灯人的衣钵。灯不灭，人便不算死。' },

  { id:'youming', name:'幽冥行者', color:'#9b8cff',
    parts:{ head:'幽冥·白骨面', armor:'幽冥·阴兵甲', shoes:'幽冥·无声履', accessory:'幽冥·引魂铃' },
    bonus2:{ str:28, pcrit:4 },
    bonus4:{ addDmg:7, elemDark:20, atkSpd:6 },
    desc:'走过阴兵道的人，身上会沾一点不属于阳间的东西。' },

  { id:'yaowang', name:'药王谷', color:'#7ed957',
    parts:{ head:'药王·芝草冠', armor:'药王·青囊衣', shoes:'药王·踏云履', accessory:'药王·九花佩' },
    bonus2:{ int:34, spr:28, mp:80 },
    bonus4:{ cdReduce:10, lifesteal:3, elemLight:15 },
    desc:'药王谷不留名，只留方子。' },

  { id:'hanshan', name:'撼山宗', color:'#ffb04a',
    parts:{ head:'撼山·裂石盔', armor:'撼山·镇岳铠', shoes:'撼山·碾尘靴', accessory:'撼山·负重环' },
    bonus2:{ str:38, vit:30, pdef:60 },
    bonus4:{ dmgBonus:11, pierce:40, moveSpd:-3 },
    desc:'撼山宗的入门功课，是先把山搬走，再谈招式。' },

  { id:'jiuzhang', name:'九章天工', color:'#00e0ff',
    parts:{ head:'天工·星轨冠', armor:'天工·卦象袍', shoes:'天工·踏斗履', accessory:'天工·浑天仪' },
    bonus2:{ int:30, spr:30, castSpd:8 },
    bonus4:{ dmgBonus:8, critDmg:20, elemLight:12, elemIce:12 },
    desc:'九章算术推尽天机，剩下的一章，写的是人。' }
];
const SET_BY_ID = {};
for(const st of EQUIP_SETS) SET_BY_ID[st.id] = st;
const SET_SLOTS = ['head', 'armor', 'shoes', 'necklace', 'ring', 'bracer'];

/* ===== 强化 / 增幅 成长表（参考DNF） =====
   · 强化：按「装备基础属性 × 品阶百分比」线性成长；武器额外获得「无视防御攻击力」
   · 增幅：在强化之外追加异次元四维（力量/体力），力量转化攻击、体力转化生命
   · 白阶（普通）成长最低，粉阶（神器）成长最高 —— 越高品阶越值得打造
*/
const ENHANCE_TIER_GAIN = {
  common:  { label:'白阶', atkPct:0.060, defPct:0.08, hpPct:0.030, piercePct:0.030 },
  advanced:{ label:'蓝阶', atkPct:0.065, defPct:0.09, hpPct:0.035, piercePct:0.035 },
  rare:    { label:'紫阶', atkPct:0.070, defPct:0.10, hpPct:0.040, piercePct:0.040 },
  epic:    { label:'粉阶', atkPct:0.080, defPct:0.12, hpPct:0.050, piercePct:0.050 },
  legend:  { label:'橙阶', atkPct:0.085, defPct:0.13, hpPct:0.055, piercePct:0.055 },
  mythic:  { label:'史诗', atkPct:0.090, defPct:0.14, hpPct:0.060, piercePct:0.060 }
};

/* 增幅四维成长（每+1级） */
const AMPLIFY_TIER_GAIN = {
  common:  { str:2, vit:2 },
  advanced:{ str:3, vit:3 },
  rare:    { str:4, vit:4 },
  epic:    { str:6, vit:6 },
  legend:  { str:7, vit:7 },
  mythic:  { str:8, vit:8 }
};
const AMP_ATK_PER_STR = 1.5;   // 1点力量 = 1.5攻击
const AMP_HP_PER_VIT  = 8;     // 1点体力 = 8生命
const ENHANCE_MAX_LV = 15;
const AMPLIFY_MAX_LV = 15;

/* DNF式强化成功率与失败惩罚 */
const ENHANCE_TABLE = [
  { lv:0,  rate:1.00, penalty:'none' },
  { lv:1,  rate:1.00, penalty:'keep' },
  { lv:2,  rate:1.00, penalty:'keep' },
  { lv:3,  rate:0.95, penalty:'keep' },
  { lv:4,  rate:0.90, penalty:'keep' },
  { lv:5,  rate:0.80, penalty:'drop1' },
  { lv:6,  rate:0.70, penalty:'drop1' },
  { lv:7,  rate:0.60, penalty:'drop1' },
  { lv:8,  rate:0.50, penalty:'reset' },
  { lv:9,  rate:0.42, penalty:'reset' },
  { lv:10, rate:0.35, penalty:'reset' },
  { lv:11, rate:0.28, penalty:'reset' },
  { lv:12, rate:0.22, penalty:'reset' },
  { lv:13, rate:0.16, penalty:'reset' },
  { lv:14, rate:0.10, penalty:'reset' },
  { lv:15, rate:0.05, penalty:'reset' }
];

function equipTierKey(eq){
  return (eq && eq.tier && ENHANCE_TIER_GAIN[eq.tier]) ? eq.tier : 'common';
}
function equipTierGain(eq){ return ENHANCE_TIER_GAIN[equipTierKey(eq)]; }

/* 强化带来的实际属性（不修改基础值，可随时重算） */
function calcEnhanceStats(eq){
  const out = { atk:0, def:0, hp:0, pierce:0 };
  if(!eq) return out;
  const lv = eq.enhance || 0;
  if(lv <= 0) return out;
  const g = equipTierGain(eq);
  out.atk    = Math.round((eq.baseAtk || 0) * g.atkPct * lv);
  out.def    = Math.round((eq.baseDef || 0) * g.defPct * lv);
  out.hp     = Math.round((eq.baseHp  || 0) * g.hpPct  * lv);
  out.pierce = Math.round((eq.baseAtk || 0) * g.piercePct * lv);
  return out;
}

/* 增幅带来的实际属性（力量/体力 + 异次元攻击） */
function calcAmplifyStats(eq){
  const out = { str:0, vit:0, atk:0, hp:0, pierce:0 };
  if(!eq) return out;
  const lv = eq.amplify || 0;
  if(lv <= 0) return out;
  const g = AMPLIFY_TIER_GAIN[equipTierKey(eq)] || AMPLIFY_TIER_GAIN.common;
  out.str = g.str * lv;
  out.vit = g.vit * lv;
  out.atk = Math.round(out.str * AMP_ATK_PER_STR);
  out.hp  = Math.round(out.vit * AMP_HP_PER_VIT);
  out.pierce = Math.round((eq.baseAtk || 0) * 0.020 * lv);
  return out;
}

/* 强化所需材料（与品阶绑定，界面与逻辑共用同一套规则） */
function enhanceMaterialOf(eq){
  const key = equipTierKey(eq);
  if(key === 'common' || key === 'advanced') return { id:'enhance_stone_low',  name:'下级强化石' };
  if(key === 'rare' || key === 'epic')       return { id:'enhance_stone_mid',  name:'中级强化石' };
  return { id:'enhance_stone_high', name:'高级强化石' };
}
function enhanceCostOf(enhLv){
  const lv = Math.max(0, enhLv || 0);
  return {
    gold: (lv + 1) * 100,
    mat:  lv < 7 ? 3 : (lv < 12 ? 5 : 8)
  };
}
function amplifyCostOf(ampLv, eq){
  const lv = Math.max(0, ampLv || 0);
  const stoneKey = equipTierKey(eq);
  return {
    stone: AMPLIFY_STONES[stoneKey] || AMPLIFY_STONES.common,
    count: 1 + Math.floor(lv / 3),
    gold: (lv + 1) * 160
  };
}
/* 增幅成功率：粉阶以上更稳 */
function amplifyRateOf(ampLv, eq){
  const lv = Math.max(0, ampLv || 0);
  const tierIdx = Math.max(0, EQUIP_TIERS.findIndex(t => t.id === equipTierKey(eq)));
  return clamp(0.85 - lv * 0.045 + tierIdx * 0.01, 0.10, 0.95);
}

/* 生成随机装备 */
/* ★ 掉落等级窗口：每张图只掉「推荐等级所在档」与「相邻高档」
   例：第 1 图推荐 1 级 → 掉 1/10 级档；第 3 图推荐 11 级 → 掉 10/20 级档 */
function dropLevelIdx(mapIdx){
  const tpl = LEVEL_TEMPLATES[Math.max(0, Math.min(LEVEL_TEMPLATES.length - 1, Math.round(mapIdx)))];
  const minLv = tpl ? (tpl.minLevel || 1) : 1;
  let base = 0;
  for(let k = 0; k < EQUIP_LV_LADDER.length; k++){ if(EQUIP_LV_LADDER[k] <= minLv) base = k; }
  const next = Math.min(EQUIP_LV_LADDER.length - 1, base + 1);
  return Math.random() < 0.5 ? base : next;
}

function generateEquipment(slot, levelIdx, diffBonus){
  // 根据难度调整品阶概率
  // diffBonus: 普通=0, 困难=1, 地狱=2
  const diff = diffBonus || 0;
  
  /* ★ 品阶掉率（重调）：粉装不再是「每局都有」的廉价货
     普通：[白蓝为主]　困难：紫装多一点　地狱：才可能见粉/橙
     深渊（diff>=3）：粉/橙明显提升，史诗只在这里和地狱里出，且都极低 */
  let rates = [0.62, 0.26, 0.10, 0.018, 0, 0];
  if(diff >= 1){
    rates = [0.42, 0.30, 0.20, 0.050, 0.004, 0];
  }
  if(diff >= 2){
    rates = [0.30, 0.28, 0.25, 0.100, 0.030, 0.002];
  }
  if(diff >= 3){
    rates = [0.18, 0.26, 0.30, 0.170, 0.080, 0.020];
  }

  // 普通难度不出史诗（mythic）/ 传说
  if(diff < 2) rates[5] = 0;
  if(diff < 1) rates[4] = 0;
  /* ★ 品阶等级门槛：传说≥30级，史诗≥50级 */
  const _tierLv = EQUIP_LV_LADDER[clamp(Math.round(levelIdx), 0, EQUIP_LV_LADDER.length - 1)];
  if(_tierLv < 30){ rates[4] = 0; rates[5] = 0; }  // 30级以下不出传说和史诗
  else if(_tierLv < 50){ rates[5] = 0; }            // 50级以下不出史诗（但传说可以）
  /* 按剩余概率归一化后再掷点，防止清零后 roll 超出累计而错落到白装 */
  const _rollTotal = rates.reduce(function(a, b){ return a + b; }, 0);
  const tierRoll = Math.random() * _rollTotal;
  let tierIdx = 0, cumRate = 0;
  for(let i = 0; i < rates.length; i++){
    cumRate += rates[i];
    if(tierRoll <= cumRate){ tierIdx = i; break; }
  }
  const tier = EQUIP_TIERS[tierIdx];
  /* ★ 命名规则（DNF 式简洁谱系）：
     白/蓝/紫 → 「白·布鞋」式 前缀+基础名，简单直观
     粉/橙/史诗 → 独立个性名（ELITE 名池，绝不与低阶撞名） */
  let name;
  if(slot === 'weapon'){
    const wt = (G && G.player && WEAPONS[G.player.weaponIdx]) ? WEAPONS[G.player.weaponIdx].id : 'sword';
    if(tierIdx >= 3){
      const elite = ELITE_WEAPON_NAMES[wt] || ELITE_WEAPON_NAMES.sword;
      name = (elite[tier.id] && elite[tier.id].length)
        ? elite[tier.id][Math.floor(Math.random() * elite[tier.id].length)]
        : (SIMPLE_WEAPON_NAMES[wt] || '铁剑');
    } else {
      name = TIER_NAME_PREFIX[tier.id] + '·' + (SIMPLE_WEAPON_NAMES[wt] || '铁剑');
    }
  } else {
    if(tierIdx >= 3){
      const elite = ELITE_NAMES[slot] || (slot === 'accessory' ? ELITE_NAMES.ring : null);
      name = (elite && elite[tier.id] && elite[tier.id].length)
        ? elite[tier.id][Math.floor(Math.random() * elite[tier.id].length)]
        : (SIMPLE_EQUIP_NAMES[slot] || '布衣');
    } else {
      name = TIER_NAME_PREFIX[tier.id] + '·' + (SIMPLE_EQUIP_NAMES[slot] || '布衣');
    }
  }
  /* ★ 装备等级只出 7 档：1 / 10 / 20 / 30 / 40 / 50 / 60，按关卡段位取档 */
  const level = EQUIP_LV_LADDER[clamp(Math.round(levelIdx), 0, EQUIP_LV_LADDER.length - 1)];
  
  // 装备品级（最下/下/中/上/最上），影响属性倍率
  const gradeRoll = Math.random();
  let gradeIdx = 2, gradeMul = 1.0;
  const GRADES = [
    { name: '最下级', mul: 0.85 },
    { name: '下级', mul: 0.92 },
    { name: '中级', mul: 1.0 },
    { name: '上级', mul: 1.08 },
    { name: '最上级', mul: 1.15 }
  ];
  if(gradeRoll < 0.15) gradeIdx = 0;
  else if(gradeRoll < 0.35) gradeIdx = 1;
  else if(gradeRoll < 0.65) gradeIdx = 2;
  else if(gradeRoll < 0.88) gradeIdx = 3;
  else gradeIdx = 4;
  gradeMul = GRADES[gradeIdx].mul;
  
  const equip = {
    slot: slot,
    name: name,
    tier: tier.id,
    tierName: tier.name,
    tierColor: tier.color,
    grade: GRADES[gradeIdx].name,
    gradeMul: gradeMul,
    level: level,
    enhance: 0,
    amplify: 0,
    weaponType: slot === 'weapon' ? (G && G.player ? (WEAPONS[G.player.weaponIdx] ? WEAPONS[G.player.weaponIdx].id : 'sword') : 'sword') : null,
    baseAtk: Math.round((slot === 'weapon' ? 10 * tier.baseMul * (1 + level * 0.1) : 0) * gradeMul),
    baseHp: Math.round((slot === 'head' || slot === 'armor' ? 30 * tier.baseMul * (1 + level * 0.1) : 0) * gradeMul),
    baseDef: Math.round((slot === 'armor' ? 5 * tier.baseMul * (1 + level * 0.1) : 0) * gradeMul),
    baseSpd: Math.round((slot === 'shoes' ? 10 * tier.baseMul * (1 + level * 0.08) : 0) * gradeMul),
    baseCrit: Math.round((slot === 'accessory' || slot === 'necklace' || slot === 'ring' || slot === 'bracer' ? 3 * tier.baseMul * (1 + level * 0.1) : 0) * gradeMul),
    extraStats: []
  };
  
  /* ★ DNF 式属性生成：一件装备同时拥有 四维 / 三攻 / 双防 / 暴击命中回避三速 / 随机词条 */
  rollEquipDnf(equip);

  /* ★ 未开封（封装）：紫 / 粉 / 橙 掉出来是封着的，要先开封才能穿；
     史诗则是「已开封且不可交易」的成品 */
  if(tierIdx >= 2 && tierIdx <= 4) equip.sealed = true;
  if(tierIdx >= 5) equip.sealed = false;
  equip.tradeable = (tierIdx < 5);

  /* ★ 套装判定：只有 头/衣/鞋/饰 能成为套装件，稀有以上才出 */
  if(SET_SLOTS.indexOf(slot) >= 0 && tierIdx >= 2 && Math.random() < 0.26){
    const st = EQUIP_SETS[Math.floor(Math.random() * EQUIP_SETS.length)];
    /* 饰品三槽（项链/戒指/护腕）共享套装的 accessory 部件 */
    const partKey = (slot === 'necklace' || slot === 'ring' || slot === 'bracer') ? 'accessory' : slot;
    if(st && st.parts[partKey]){
      equip.setId = st.id;
      equip.setName = st.name;
      equip.setColor = st.color;
      equip.name = st.parts[partKey];
      /* 套装件作为「设计过的好货」，基础属性整体 +8% */
      equip.baseHp  = Math.round((equip.baseHp  || 0) * 1.08);
      equip.baseDef = Math.round((equip.baseDef || 0) * 1.08);
      equip.baseSpd = Math.round((equip.baseSpd || 0) * 1.08);
      equip.baseCrit= Math.round((equip.baseCrit|| 0) * 1.08);
      rollEquipDnf(equip);   /* 基础变了，重算一次 DNF 面板 */
    }
  }

  return equip;
}

/* ============================================================
   ★ 未开封 / 交易规则（模仿 DNF 的封装装备）
   · 紫 / 粉 / 橙 掉出来是「未开封」，开封后才能穿，开封后不能上架
   · 史诗（mythic）掉出来就是已开封的成品，且永远不可交易
   ============================================================ */
const SEAL_TIER_IDX = { rare:2, epic:3, legend:4, mythic:5 };
function equipTierIndex(t){
  const i = ['common','advanced','rare','epic','legend','mythic'].indexOf(String(t || 'common'));
  return i < 0 ? 0 : i;
}
function unsealCost(eq){
  if(!eq) return 0;
  const ti = equipTierIndex(eq.tier);
  return Math.round((eq.level || 1) * 120 + (ti + 1) * 600);
}
/* 能否上架交易行：史诗不行，已开封的不行 */
function eqTradeable(eq){
  if(!eq) return false;
  if(eq.tier === 'mythic') return false;
  /* 「开封后不可交易」只对紫 / 粉 / 橙生效，白蓝没有封装概念 */
  if(eq.sealed === false && equipTierIndex(eq.tier) >= 2) return false;
  return true;
}
function eqTradeReason(eq){
  if(!eq) return '';
  if(eq.tier === 'mythic') return '史诗装备不可交易';
  if(eq.sealed === false && equipTierIndex(eq.tier) >= 2) return '已开封，不能上架';
  return '';
}

/* ============================================================
   ★ 单件装备的完整面板（基础 + 强化 + 增幅 + 词条）
   —— 详情卡与属性计算共用同一份数据，保证「看到的 = 打出来的」
   ============================================================ */
function equipFullStats(eq){
  const o = {
    str:0, int:0, vit:0, spr:0,
    patk:0, matk:0, pdef:0, mdef:0,
    pcrit:0, hit:0, dodge:0, atkSpd:0, castSpd:0, moveSpd:0,
    hp:0, mp:0, spd:0, atk:0, def:0, crit:0,
    dmgBonus:0, addDmg:0, critDmg:0, pierce:0, lifesteal:0, cdReduce:0,
    elemFire:0, elemIce:0, elemLight:0, elemDark:0
  };
  if(!eq) return o;
  if(!eq.dnf) rollEquipDnf(eq);            /* 兼容旧存档：没有 dnf 就现场补一份 */
  const d = eq.dnf || {};
  const enh = calcEnhanceStats(eq);        /* 强化：攻击/防御/生命/无视防御 */
  const amp = calcAmplifyStats(eq);        /* 增幅：力量/体力 + 异次元攻击 */

  /* 四维 */
  o.str = (d.str || 0) + (amp.str || 0);
  o.int = (d.int || 0);
  o.vit = (d.vit || 0) + (amp.vit || 0);
  o.spr = (d.spr || 0);

  /* 三攻 / 双防（强化同时抬攻击与防御） */
  o.patk = (d.patk || 0) + (eq.baseAtk || 0) + (enh.atk || 0) + (amp.atk || 0);
  o.matk = (d.matk || 0);
  o.pdef = (d.pdef || 0) + (eq.baseDef || 0) + (enh.def || 0);
  o.mdef = (d.mdef || 0);

  /* 暴击 / 命中 / 回避 / 三速 */
  o.pcrit = (d.pcrit || 0) + (eq.baseCrit || 0);
  o.hit = d.hit || 0;
  o.dodge = d.dodge || 0;
  o.atkSpd = d.atkSpd || 0;
  o.castSpd = d.castSpd || 0;
  o.moveSpd = d.moveSpd || 0;

  /* 生命 / 移速（装备本体） */
  o.hp = (eq.baseHp || 0) + (enh.hp || 0) + (amp.hp || 0);
  o.spd = eq.baseSpd || 0;

  /* 无视防御 */
  o.pierce = (enh.pierce || 0) + (amp.pierce || 0);

  /* 随机词条 */
  for(const af of (eq.affixes || [])){
    if(typeof o[af.key] === 'number') o[af.key] += af.value;
    else o[af.key] = af.value;
  }
  return o;
}

/* 计算装备总属性加成（全身 5 件叠加） */
function calcEquipmentBonus(equipment){
  const bonus = {
    atk:0, hp:0, mp:0, def:0, spd:0, crit:0, lifesteal:0, cdReduce:0, pierce:0,
    str:0, int:0, vit:0, spr:0, patk:0, matk:0, pdef:0, mdef:0,
    pcrit:0, hit:0, dodge:0, atkSpd:0, castSpd:0, moveSpd:0,
    dmgBonus:0, addDmg:0, critDmg:0,
    elemFire:0, elemIce:0, elemLight:0, elemDark:0
  };
  if(!equipment) return bonus;
  /* 兼容旧存档：把 accessory 视作 ring */
  if(equipment.accessory && !equipment.ring) equipment.ring = equipment.accessory;
  for(const slot of EQUIP_SLOTS){
    const one = equipFullStats(equipment[slot]);
    if(!one) continue;
    for(const k in bonus){
      const v = one[k];
      if(typeof v === 'number') bonus[k] += v;
    }
  }
  /* ★ 飞行道具（独立第 8 槽）：只带移速 / 回避，单独结算，不参与套装 */
  if(equipment.mount){
    const mo = equipFullStats(equipment.mount);
    if(mo){ for(const k in bonus){ const v = mo[k]; if(typeof v === 'number') bonus[k] += v; } }
  }

  /* ★ 套装加成：按已穿戴件数叠加 2 件 / 4 件效果 */
  const setCount = {};
  for(const slot of EQUIP_SLOTS){
    const eq = equipment[slot];
    if(eq && eq.setId) setCount[eq.setId] = (setCount[eq.setId] || 0) + 1;
  }
  for(const id in setCount){
    const st = SET_BY_ID[id];
    if(!st) continue;
    const n = setCount[id];
    /* ★ 套装加成随件均等级成长（与详情卡展示一致） */
    const lvMul = setBonusMul(equipment, id);
    const apply = function(obj){
      if(!obj) return;
      for(const k in obj){ if(typeof bonus[k] === 'number') bonus[k] += Math.round(obj[k] * lvMul); }
    };
    if(n >= 2) apply(st.bonus2);
    if(n >= 4) apply(st.bonus4);
  }

  /* 面板统一：物理攻击 / 物理防御 / 物理暴击 由细分字段提供 */
  bonus.atk = bonus.patk;
  bonus.def = bonus.pdef;
  bonus.crit = bonus.pcrit;
  return bonus;
}

/* 某套装在身上的件数与激活状态（供详情卡展示） */
function setPieceInfo(equipment, setId){
  const out = { count:0, total:4, owned:[], active2:false, active4:false };
  if(!setId || !equipment) return out;
  for(const slot of SET_SLOTS){
    const eq = equipment[slot];
    if(eq && eq.setId === setId){ out.count++; out.owned.push(slot); }
  }
  out.active2 = out.count >= 2;
  out.active4 = out.count >= 4;
  return out;
}

/* ★ 套装加成随套装件平均等级成长：1 级 = 1.0x，60 级 ≈ 2.8x（生效与展示共用同一系数） */
function setBonusMul(equipment, setId){
  let sum = 0, cnt = 0;
  for(const slot of SET_SLOTS){
    const eq = equipment && equipment[slot];
    if(eq && eq.setId === setId){ sum += (eq.level || 1); cnt++; }
  }
  return 1 + (cnt ? sum / cnt : 1) * 0.03;
}
function scaleSetBonus(obj, mul){
  const out = {};
  if(obj) for(const k in obj) out[k] = Math.round(obj[k] * mul);
  return out;
}

/* ★ 装备评分（战力）：把不同量纲的属性折算成一个可比较的数字 */
function equipScore(eq){
  if(!eq) return 0;
  const s = equipFullStats(eq);
  const v =
      s.patk * 3.0 + s.matk * 1.6
    + s.hp * 0.22 + s.mp * 0.06
    + s.pdef * 1.1 + s.mdef * 0.9
    + (s.str + s.int + s.vit + s.spr) * 2.0
    + (s.pcrit + s.hit + s.dodge + s.atkSpd + s.castSpd + Math.max(0, s.moveSpd)) * 7
    + (s.dmgBonus + s.addDmg + s.critDmg) * 13
    + s.pierce * 4 + s.lifesteal * 18 + s.cdReduce * 6
    + (s.elemFire + s.elemIce + s.elemLight + s.elemDark) * 4.5
    + (s.spd || 0) * 1.5;
  return Math.round(v);
}
/* 全套总战力 */
function totalPower(p){
  if(!p || !p.equipment) return 0;
  let sum = 0;
  for(const slot of EQUIP_SLOTS) sum += equipScore(p.equipment[slot]);
  return sum;
}

