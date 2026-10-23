/* ===== 掉落系统 ===== */
const DROP_TABLE = {
  normal: { equipRate:0.05, propRate:0.10, materialRate:0.15, gold: 10 },
  elite: { equipRate:0.25, propRate:0.50, materialRate:0.60, gold: 50 },
  boss: { equipRate:1.0, propRate:1.0, materialRate:1.0, gold: 200 }
};

/* ============================================================
   ★ 药水（2026-10-23 改）：删掉「永久加属性的属性丹」，
     改为模仿 DNF 的分级回血瓶 / 回蓝瓶：
       · 按等级分 6 档，等级越高掉落的档越高
       · 恢复量是「最大生命的百分比」，等级越高档位回复越多
       · 同类药水有使用冷却（战斗里不能无限灌）
   ============================================================ */
const POTION_GRADES = [
  { g:1, name:'新手', minLv:1,  maxLv:9,  hp:0.15, mp:0.20, color:'#9fd7ff' },
  { g:2, name:'下级', minLv:10, maxLv:19, hp:0.20, mp:0.25, color:'#5ee08a' },
  { g:3, name:'中级', minLv:20, maxLv:29, hp:0.25, mp:0.30, color:'#5aa9ff' },
  { g:4, name:'上级', minLv:30, maxLv:39, hp:0.30, mp:0.35, color:'#b57bff' },
  { g:5, name:'特级', minLv:40, maxLv:49, hp:0.35, mp:0.40, color:'#ff9f43' },
  { g:6, name:'大师', minLv:50, maxLv:999,hp:0.40, mp:0.45, color:'#ffd166' }
];
const POTION_CD = 10;            /* 同类药水冷却（秒） */
const POTION_MAX_STACK = 200;

/* id 规则：hp3 = 中级回血瓶，mp5 = 特级回蓝瓶 */
function potionId(kind, g){ return kind + g; }
function potionGradeOf(id){
  const g = parseInt(String(id || '').replace(/^(hp|mp)/, ''), 10);
  return (g >= 1 && g <= 6) ? g : 1;
}
function potionKindOf(id){ return String(id || '').indexOf('mp') === 0 ? 'mp' : 'hp'; }
function potionGradeInfo(g){ return POTION_GRADES[Math.max(0, Math.min(5, (g | 0) - 1))]; }
function potionMeta(id){
  const g = potionGradeOf(id), k = potionKindOf(id), gi = potionGradeInfo(g);
  return {
    id: id, kind: k, grade: g,
    name: gi.name + (k === 'hp' ? '生命药水' : '法力药水'),
    short: gi.name + (k === 'hp' ? '血瓶' : '蓝瓶'),
    color: k === 'hp' ? '#ff5f6d' : gi.color,
    pct: k === 'hp' ? gi.hp : gi.mp,
    desc: '立刻回复' + Math.round((k === 'hp' ? gi.hp : gi.mp) * 100) + '% 的' + (k === 'hp' ? '生命' : '法力')
  };
}
/* 按等级挑一档（向下取整，偶尔跳一档高等级的） */
function potionGradeForLevel(lv){
  let g = 1;
  for(let i = 0; i < POTION_GRADES.length; i++){
    if(lv >= POTION_GRADES[i].minLv) g = POTION_GRADES[i].g;
  }
  if(Math.random() < 0.12 && g < 6) g += 1;    /* 偶尔掉高一档 */
  return g;
}
function rollPotion(levelIdx){
  const g = potionGradeForLevel(levelIdx || 1);
  const kind = Math.random() < 0.58 ? 'hp' : 'mp';   /* 血瓶稍多一点 */
  return potionMeta(potionId(kind, g));
}
/* 兼容旧代码：DROP_PROPS 不再用于掉落（属性丹已删除），保留空数组防报错 */
const DROP_PROPS = [];

const DROP_MATERIALS = [
  { id:'enhance_stone_low', name:'下级强化石', desc:'用于+1~+7强化', tier:'low' },
  { id:'enhance_stone_mid', name:'中级强化石', desc:'用于+8~+12强化', tier:'mid' },
  { id:'enhance_stone_high', name:'高级强化石', desc:'用于+13~+15强化', tier:'high' },
  { id:'chaos_stone', name:'混沌魔石', desc:'用于洗练装备随机词条', tier:'chaos' }
];

/* 增幅石：分解装备获得，用于增幅系统 */
const AMPLIFY_STONES = {
  common:  { id:'amplify_stone_common',  name:'普通增幅石', color:'#ffffff', tier:0 },
  advanced:{ id:'amplify_stone_advanced', name:'高级增幅石', color:'#3498db', tier:1 },
  rare:    { id:'amplify_stone_rare',     name:'稀有增幅石', color:'#9b59b6', tier:2 },
  epic:    { id:'amplify_stone_epic',     name:'神器增幅石', color:'#e91e63', tier:3 },
  legend:  { id:'amplify_stone_legend',   name:'传说增幅石', color:'#e67e22', tier:4 },
  mythic:  { id:'amplify_stone_mythic',   name:'史诗增幅石', color:'#f39c12', tier:5 }
};

/* ============================================================
   ★ 稀有掉落公告（传说 / 史诗）
   —— DNF 里爆粉爆史诗会给一条全屏提示，这里做同样的仪式感
   ============================================================ */
const TIER_ORDER = ['common','advanced','rare','epic','legend','mythic'];
let dropAnnounce = null;

function announceDrop(eq){
  if(!eq || !G || G.isPvp) return;
  const r = TIER_ORDER.indexOf(eq.tier);
  if(r < 4) return;
  if(dropAnnounce && dropAnnounce.t < 1.0) return;   /* 防同帧连刷 */
  dropAnnounce = { eq: eq, t: 0, dur: 3.6 };
}
function updateDropAnnounce(dt){
  if(!dropAnnounce) return;
  dropAnnounce.t += dt;
  if(dropAnnounce.t >= dropAnnounce.dur) dropAnnounce = null;
}
function drawDropAnnounce(){
  if(!dropAnnounce || !dropAnnounce.eq) return;
  const eq = dropAnnounce.eq;
  const T = dropAnnounce;
  const col = eq.tierColor || '#ffd166';
  const a = T.t < 0.28 ? T.t / 0.28
          : (T.t > T.dur - 0.55 ? Math.max(0, (T.dur - T.t) / 0.55) : 1);
  const pop = T.t < 0.34 ? (0.82 + 0.18 * (T.t / 0.34)) : 1;
  const cx = VW / 2, cy = VH * 0.30;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.translate(cx, cy);
  ctx.scale(pop, pop);
  /* 横向展开的光带 */
  const W = 560, H = 78;
  const lg = ctx.createLinearGradient(-W/2, 0, W/2, 0);
  lg.addColorStop(0, hexA(col, 0));
  lg.addColorStop(0.18, hexA(col, 0.22));
  lg.addColorStop(0.5, hexA(col, 0.34));
  lg.addColorStop(0.82, hexA(col, 0.22));
  lg.addColorStop(1, hexA(col, 0));
  ctx.fillStyle = lg;
  ctx.fillRect(-W/2, -H/2, W, H);
  /* 上下亮线 */
  for(const yy of [-H/2, H/2 - 1.5]){
    const ln = ctx.createLinearGradient(-W/2, 0, W/2, 0);
    ln.addColorStop(0, hexA(col, 0));
    ln.addColorStop(0.5, hexA(col, 0.95));
    ln.addColorStop(1, hexA(col, 0));
    ctx.fillStyle = ln;
    ctx.fillRect(-W/2, yy, W, 1.5);
  }
  /* 流光扫过 */
  const sweep = ((T.t * 1.1) % 1) * W - W/2;
  const sw = ctx.createLinearGradient(sweep - 70, 0, sweep + 70, 0);
  sw.addColorStop(0, 'rgba(255,255,255,0)');
  sw.addColorStop(0.5, 'rgba(255,255,255,0.28)');
  sw.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sw;
  ctx.fillRect(-W/2, -H/2, W, H);
  /* 文案 */
  ctx.textAlign = 'center';
  ctx.font = 'bold 12px "Microsoft YaHei"';
  ctx.fillStyle = hexA(col, 0.92);
  ctx.fillText(eq.tier === 'mythic' ? '史 诗 装 备' : '传 说 装 备', 0, -16);
  ctx.font = 'bold 24px "Microsoft YaHei"';
  ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,0.75)';
  const nm = (eq.enhance > 0 ? '+' + eq.enhance + ' ' : '') + eq.name;
  ctx.strokeText(nm, 0, 13);
  ctx.fillStyle = '#fff';
  ctx.fillText(nm, 0, 13);
  /* 部位 / 等级 / 套装 */
  ctx.font = '12px "Microsoft YaHei"';
  ctx.fillStyle = hexA(col, 0.9);
  const sub = (SLOT_NAMES[eq.slot] || '') + ' · Lv.' + eq.level + (eq.setId ? '　【' + eq.setName + '】' : '');
  ctx.fillText(sub, 0, 33);
  ctx.restore();
}

/* 敌怪掉落 */
function rollEnemyDrops(enemy, levelIdx){
  const isBoss = enemy.def.boss;
  const isElite = enemy.def.elite || false;
  const dropType = isBoss ? 'boss' : (isElite ? 'elite' : 'normal');
  const drops = [];
  const table = DROP_TABLE[dropType];
  
  // 根据难度调整掉率（G.difficulty: normal=1, hard=2, hell=3）
  const diffMul = G && G.difficulty ? G.difficulty : 1;
  const diffBonus = diffMul - 1; // 普通=0, 困难=1, 地狱=2
  
  // ★ 深渊模式掉率加成
  const lvlConfig = G ? getLevelConfig(G.levelIdx || 0) : null;
  const abyssBonus = (lvlConfig && lvlConfig.isAbyss) ? (lvlConfig.abyssDropBonus || 2) : 0;
  
  // 金币
  drops.push({ type:'gold', amount: (table.gold + Math.round(levelIdx * 5)) * diffMul });
  
  // 装备掉落（难度越高掉率越高，深渊模式额外加成）
  const equipRate = Math.min(1.0, table.equipRate + diffBonus * 0.15 + abyssBonus * 0.1);
  if(Math.random() < equipRate){
    const slot = EQUIP_SLOTS[Math.floor(Math.random() * EQUIP_SLOTS.length)];
    // ★ 深渊模式：提高史诗装备掉率
    const abyssDiffBonus = diffBonus + abyssBonus;
    const _dropEq = generateEquipment(slot, dropLevelIdx(levelIdx), abyssDiffBonus);
    drops.push({ type:'equip', equip: _dropEq });
    announceDrop(_dropEq);            /* ★ 传说 / 史诗全屏公告 */
  }

  /* ★ 飞行道具：精英 / BOSS / 深渊才掉，品阶按掉落等级封顶 */
  if(window.MOUNT){
    const _mo = MOUNT.rollDrop(dropLevelIdx(levelIdx), {
      isBoss: isBoss, isElite: isElite, abyss: !!(lvlConfig && lvlConfig.isAbyss)
    });
    if(_mo){ drops.push({ type:'equip', equip: _mo }); announceDrop(_mo); }
  }
  
  /* ★ 药水：按地图等级掉对应档位的回血瓶 / 回蓝瓶 */
  const potCount = isBoss ? 2 + Math.floor(Math.random()*3) + diffBonus : (Math.random() < table.propRate ? 1 : 0);
  for(let i = 0; i < potCount; i++){
    drops.push({ type:'prop', prop: { id: rollPotion(dropLevelIdx(levelIdx)).id } });
  }
  
  // 强化材料掉落（只从三种强化石里抽）
  const matCount = isBoss ? 5 + Math.floor(Math.random()*6) + diffBonus * 3 : (Math.random() < table.materialRate ? 1 : 0);
  for(let i = 0; i < matCount; i++){
    const mat = DROP_MATERIALS[Math.floor(Math.random() * 3)];
    drops.push({ type:'material', material: mat });
  }
  /* ★ 混沌魔石：洗练材料，Boss 必掉，小怪小概率 */
  if(isBoss || Math.random() < 0.09 + diffBonus * 0.05){
    drops.push({ type:'material', material:{ id:'chaos_stone', name:'混沌魔石', desc:'用于洗练装备随机词条' } });
  }

  return drops;
}

