/* ===== 掉落系统 ===== */
const DROP_TABLE = {
  normal: { equipRate:0.05, propRate:0.10, materialRate:0.15, gold: 10 },
  elite: { equipRate:0.25, propRate:0.50, materialRate:0.60, gold: 50 },
  boss: { equipRate:1.0, propRate:1.0, materialRate:1.0, gold: 200 }
};

const DROP_PROPS = [
  { id:'atk_pill', name:'攻击丹', desc:'攻击力+2', maxStack:50, effect:{atk:2} },
  { id:'hp_pill', name:'生命丹', desc:'生命+20', maxStack:50, effect:{hp:20} },
  { id:'mp_pill', name:'内力丹', desc:'内力+10', maxStack:30, effect:{mp:10} },
  { id:'cd_book', name:'CD缩减书', desc:'冷却-1%', maxStack:20, effect:{cdReduce:1} },
  { id:'crit_gem', name:'暴击宝石', desc:'暴击+1%', maxStack:15, effect:{crit:1} }
];

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
  
  // 属性道具掉落
  const propCount = isBoss ? 2 + Math.floor(Math.random()*2) + diffBonus : (Math.random() < table.propRate ? 1 : 0);
  for(let i = 0; i < propCount; i++){
    const prop = DROP_PROPS[Math.floor(Math.random() * DROP_PROPS.length)];
    drops.push({ type:'prop', prop: prop });
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

