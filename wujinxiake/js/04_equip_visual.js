/* ===== 套装光环：穿上 2 件起有淡色地光，4 件满套为旋转符环 ===== */
function getSetAuraInfo(p){
  const out = { active:false, setId:null, color:'#ffffff', count:0, strong:false, name:'' };
  if(!p || !p.equipment) return out;
  const cnt = {};
  for(const slot of SET_SLOTS){
    const eq = p.equipment[slot];
    if(eq && eq.setId) cnt[eq.setId] = (cnt[eq.setId] || 0) + 1;
  }
  let best = null, bestN = 0;
  for(const id in cnt){ if(cnt[id] > bestN){ bestN = cnt[id]; best = id; } }
  if(!best || bestN < 2) return out;
  const st = SET_BY_ID[best];
  if(!st) return out;
  out.active = true; out.setId = best; out.color = st.color;
  out.count = bestN; out.strong = bestN >= 4; out.name = st.name;
  return out;
}
function drawSetAura(p, x, y, scaleMul){
  const a = getSetAuraInfo(p);
  if(!a.active) return;
  const t = (G ? G.t : performance.now() * 0.001);
  const R = (a.strong ? 48 : 34) * (scaleMul || 1);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(x, y, 1, x, y, R);
  g.addColorStop(0, hexA(a.color, a.strong ? 0.38 : 0.20));
  g.addColorStop(0.6, hexA(a.color, a.strong ? 0.13 : 0.06));
  g.addColorStop(1, hexA(a.color, 0));
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.ellipse(x, y, R, R * 0.32, 0, 0, TAU); ctx.fill();
  if(a.strong){
    ctx.strokeStyle = hexA(a.color, 0.55);
    ctx.lineWidth = 1.6;
    for(let k = 0; k < 2; k++){
      const rr = R * (0.56 + k * 0.24);
      const st = t * 1.1 + k * 2.1;
      ctx.beginPath();
      ctx.ellipse(x, y, rr, rr * 0.32, 0, st, st + Math.PI * 1.05);
      ctx.stroke();
    }
    /* 缓慢上升的套装光尘 */
    for(let k = 0; k < 3; k++){
      const u = ((t * 0.35 + k * 0.33) % 1);
      ctx.fillStyle = hexA(a.color, (1 - u) * 0.45);
      ctx.beginPath();
      ctx.arc(x + Math.sin(t * 2 + k * 2.4) * R * 0.6, y - u * R * 1.5, 1.6, 0, TAU);
      ctx.fill();
    }
  }
  ctx.restore();
}

/* ===== 装备外观系统 =====
   头 → 盔缨冠饰；衣 → 肩甲 / 披风 / 胸口甲光；鞋 → 脚下踏尘环；饰 → 环绕光点
   品阶越高越明显，套装件用套装色，强化 +10 以上叠加白光
*/
function equipLookColor(eq){
  if(!eq) return '#8fa6c0';
  if(eq.setColor) return eq.setColor;
  return eq.tierColor || '#8fa6c0';
}
function equipTierRank(eq){
  if(!eq) return -1;
  return TIER_ORDER.indexOf(eq.tier);
}
/* 弱化为若干“外观零件”，便于统一取色与强度 */
function equipLookParts(p){
  const out = { head:null, armor:null, shoes:null, acc:null };
  if(!p || !p.equipment) return out;
  for(const k in out){
    const eq = p.equipment[k];
    if(!eq) continue;
    out[k] = {
      eq: eq,
      rank: equipTierRank(eq),
      color: equipLookColor(eq),
      enh: eq.enhance || 0,
      amp: eq.amplify || 0
    };
  }
  /* 饰品外观取 项链/戒指/护腕 三槽中品阶最高的一件 */
  let bestAcc = null;
  for(const k of ['necklace', 'ring', 'bracer']){
    const eq = p.equipment[k];
    if(eq && (!bestAcc || equipTierRank(eq) > equipTierRank(bestAcc))){
      bestAcc = eq;
    }
  }
  if(bestAcc) out.acc = {
    eq: bestAcc, rank: equipTierRank(bestAcc), color: equipLookColor(bestAcc),
    enh: bestAcc.enhance || 0, amp: bestAcc.amplify || 0
  };
  return out;
}

/* ============================================================
   ★ 穿戴外观已关闭（2026-10-23 需求）
     头 / 衣 / 鞋 / 饰品 一律不再往角色身上贴外观零件，
     只保留「人物模型本身」；强化 / 增幅的光效改画在
     角色手中武器的位置（见 drawPlayerWeaponAuraFront）。
     函数保留（其它模块有调用），但直接空转。
   ============================================================ */
function drawEquipAppearanceBack(p, x, y, bodyPx, opts){
  return;
  if(!p || !p.isPlayer || !p.equipment) return;
  const L = equipLookParts(p);
  const sc = bodyPx / 150;
  const t = (G ? G.t : performance.now() * 0.001);
  const facing = (opts && opts.facing) || 1;
  const yShoulder = y - bodyPx * 0.735;
  const yTorso = y - bodyPx * 0.60;

  ctx.save();

  /* ---- 腰后飘带：暂时留空（2D 侧视下长带易显突兀，改由腰带+胸珠表达） ---- */

  /* ---- 胸口甲光（贴身在角色之后，向外溢一点） ---- */
  if(L.armor){
    const col = L.armor.color;
    const inten = 0.07 + Math.min(3, L.armor.rank) * 0.035 + (L.armor.enh >= 10 ? 0.10 : 0);
    const R = bodyPx * 0.26;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const cg = ctx.createRadialGradient(x + facing * bodyPx * 0.03, yTorso, 1, x + facing * bodyPx * 0.03, yTorso, R);
    cg.addColorStop(0, hexA(col, inten));
    cg.addColorStop(0.6, hexA(col, inten * 0.42));
    cg.addColorStop(1, hexA(col, 0));
    ctx.fillStyle = cg;
    ctx.beginPath(); ctx.arc(x + facing * bodyPx * 0.03, yTorso, R, 0, TAU); ctx.fill();
    ctx.restore();
  }

  ctx.restore();
}

function drawEquipAppearanceFront(p, x, y, bodyPx, opts){
  return;
  if(!p || !p.isPlayer || !p.equipment) return;
  const L = equipLookParts(p);
  const sc = bodyPx / 150;
  const t = (G ? G.t : performance.now() * 0.001);
  const facing = (opts && opts.facing) || 1;
  const yShoulder = y - bodyPx * 0.735;
  const yHead = y - bodyPx * 0.935;

  ctx.save();

  /* ---- 头盔冠饰：高级以上，浮在头顶（不压脸） ---- */
  if(L.head && L.head.rank >= 1){
    const col = L.head.color;
    const cw = bodyPx * 0.056;
    const ch = bodyPx * 0.068 + Math.min(3, L.head.rank) * bodyPx * 0.013;
    ctx.save();
    ctx.translate(x, yHead + bodyPx * 0.012);
    ctx.scale(facing, 1);
    /* 冠体 */
    ctx.beginPath();
    ctx.moveTo(-cw, 0);
    ctx.lineTo(-cw * 0.5, -ch * 0.62);
    ctx.lineTo(0, -ch);
    ctx.lineTo(cw * 0.5, -ch * 0.62);
    ctx.lineTo(cw, 0);
    ctx.closePath();
    const hg = ctx.createLinearGradient(0, -ch, 0, 0);
    hg.addColorStop(0, hexA(col, 0.95));
    hg.addColorStop(1, hexA(col, 0.35));
    ctx.fillStyle = hg;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 0.9 * sc;
    ctx.stroke();
    /* 两侧翼羽 */
    ctx.strokeStyle = hexA(col, 0.75);
    ctx.lineWidth = 1.2 * sc;
    ctx.beginPath();
    ctx.moveTo(-cw * 0.85, -ch * 0.15); ctx.quadraticCurveTo(-cw * 1.7, -ch * 0.45, -cw * 1.35, -ch * 1.05);
    ctx.moveTo(cw * 0.85, -ch * 0.15); ctx.quadraticCurveTo(cw * 1.7, -ch * 0.45, cw * 1.35, -ch * 1.05);
    ctx.stroke();
    /* 传说以上中央宝石 */
    if(L.head.rank >= 3){
      ctx.globalCompositeOperation = 'lighter';
      const pulse = 0.55 + 0.45 * Math.sin(t * 3.4);
      const gg = ctx.createRadialGradient(0, -ch * 0.5, 0.5, 0, -ch * 0.5, cw * 1.35);
      gg.addColorStop(0, hexA('#ffffff', 0.85 * pulse));
      gg.addColorStop(0.35, hexA(col, 0.62 * pulse));
      gg.addColorStop(1, hexA(col, 0));
      ctx.fillStyle = gg;
      ctx.beginPath(); ctx.arc(0, -ch * 0.5, cw * 1.35, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.restore();
  }

  /* 胸甲的贴身标识改由「体形辉光 + 胸口甲光」表达（贴片在侧视精灵上易落在四肢，反而像瑕疵） */

  /* ---- 饰品：环绕角色缓慢公转的光点 ---- */
  if(L.acc){
    const col = L.acc.color;
    const n = 2 + Math.min(2, Math.max(0, L.acc.rank));
    const rx = bodyPx * 0.30, ry = bodyPx * 0.11;
    const cy = y - bodyPx * 0.56;
    ctx.globalCompositeOperation = 'lighter';
    for(let i = 0; i < n; i++){
      const ang = t * 0.85 + i * (TAU / n);
      const ox = Math.cos(ang) * rx;
      const oy = Math.sin(ang) * ry;
      /* 后半个轨道压暗，制造前后遮挡 */
      const front = Math.sin(ang) > 0;
      const a = (front ? 0.9 : 0.35) * (0.75 + 0.25 * Math.sin(t * 4 + i));
      const rr = 1.9 * sc * (front ? 1.25 : 0.9);
      const og = ctx.createRadialGradient(x + ox, cy + oy, 0.2, x + ox, cy + oy, rr * 4.2);
      og.addColorStop(0, hexA('#ffffff', a));
      og.addColorStop(0.35, hexA(col, a * 0.75));
      og.addColorStop(1, hexA(col, 0));
      ctx.fillStyle = og;
      ctx.beginPath(); ctx.arc(x + ox, cy + oy, rr * 4.2, 0, TAU); ctx.fill();
      ctx.fillStyle = hexA('#ffffff', a);
      ctx.beginPath(); ctx.arc(x + ox, cy + oy, rr, 0, TAU); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  /* ---- 鞋：脚下踏尘光环（贴合脚掌的小环，不夸张） ---- */
  if(L.shoes){
    const col = L.shoes.color;
    const rw = bodyPx * (0.082 + Math.min(3, L.shoes.rank) * 0.013);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = hexA(col, 0.38 + 0.16 * Math.sin(t * 2.6));
    ctx.lineWidth = 1.4 * sc;
    ctx.beginPath();
    ctx.ellipse(x, y + 1.2 * sc, rw, rw * 0.30, 0, 0, TAU);
    ctx.stroke();
    /* 两粒上升尘点 */
    for(let k = 0; k < 2; k++){
      const u = ((t * 0.7 + k * 0.5) % 1);
      ctx.fillStyle = hexA(col, (1 - u) * 0.42);
      ctx.beginPath();
      ctx.arc(x + Math.sin(t * 3 + k * 2) * rw * 0.7, y - u * bodyPx * 0.16, 1.1 * sc, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  ctx.restore();
}

/* 护甲体形辉光：已关闭（不再按装备给角色染轮廓光） */
function drawEquipBodyGlow(at, anim, prog, x, y, facing, bodyPx, part){
  return;
  if(!at || !part || part.rank < 1) return;
  const r = part.rank;
  drawSpriteFrame(at, anim, prog, x, y, facing, bodyPx,
    {color: part.color, alpha: 0.18 + Math.min(4, r) * 0.055, blur: 16 + r * 3});
  if(r >= 3){
    drawSpriteFrame(at, anim, prog, x, y, facing, bodyPx,
      {color: part.color, alpha: 0.12 + (r - 3) * 0.05, blur: 36 + r * 4});
  }
}

function drawFighterSprite(p, scaleMul){
  const at = atlasOf(p.weaponIdx);
  if(!at) return false;
  const a = fighterAnimFor(p);
  const sc = depthScale(p.y) * (scaleMul || 1);
  const bodyPx = at.bodyWorld * sc;
  const showAura = !!(p.isPlayer && p.equipment && p.equipment.weapon);
  const auraScale = bodyPx / 150;
  const py = p.y - (p.h || 0);
  const mount = (p.equipment && p.equipment.mount) ? p.equipment.mount : null;
  const moving = (p.state === 'walk' || p.state === 'run');
  const facing = p.facing || 1;
  /* ★ 踩着飞行道具：移动时整体前倾 + 轻微浮动，代替跑动动画 */
  const ang = (mount && moving) ? 0.10 * facing : 0;
  const bob = mount ? Math.sin((G ? G.t : 0) * 2.2) * 1.6 * sc : 0;

  ctx.save();
  if(ang || bob){
    ctx.translate(p.x, py);
    ctx.rotate(ang);
    ctx.translate(-p.x, -py - bob);
  }

  /* ★ 飞行道具画在脚下（先画，角色盖在上面 = 站在上面）。
     刷图/PK 里放大 1.3 倍保证存在感；移动时在身后拖一道光痕。
     角色动作动画照常播放（attack/skill 姿态都显示在飞行道具上）。 */
  if(mount && window.MOUNT){
    MOUNT.draw(ctx, p.x, py + 2 * sc, bodyPx / 150 * 1.3, mount.model, (G ? G.t : 0), moving, facing);
    if(moving){
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const trY = py + 2 * sc;
      const tg2 = ctx.createLinearGradient(p.x - facing*30, trY, p.x - facing*130, trY);
      tg2.addColorStop(0, 'rgba(185,225,255,0.4)');
      tg2.addColorStop(1, 'rgba(185,225,255,0)');
      ctx.fillStyle = tg2;
      ctx.beginPath(); ctx.ellipse(p.x - facing*80, trY, 58, 8, 0, 0, TAU); ctx.fill();
      ctx.restore();
    }
  }

  /* ★ 套装光环（脚下法阵，先于角色绘制） */
  if(p.isPlayer) drawSetAura(p, p.x, p.y, sc);
  if(showAura) drawPlayerWeaponAura(p, p.x, py, auraScale, {strong:false});
  if(showAura){
    const gi = getEquipGlowInfo(p.equipment.weapon);
    if(gi.active){
      if(gi.enhOn) drawSpriteFrame(at, a.name, a.t, p.x, py, facing, bodyPx, {color:'#eaf6ff', alpha:0.6*gi.enhI, blur:26});
      if(gi.ampOn) drawSpriteFrame(at, a.name, a.t, p.x, py, facing, bodyPx, {color:'#ff7ad9', alpha:0.6*gi.ampI, blur:26});
    }
  }
  if(p.hitFlash > 0) ctx.filter = 'brightness(1.75) saturate(0.7)';
  /* ★ 装备外观（身后层：短披 / 胸口甲光） */
  drawEquipAppearanceBack(p, p.x, py, bodyPx, {facing:facing});
  /* ★ 护甲体形辉光：沿角色轮廓染色，比贴色块更贴身形 */
  if(p.isPlayer && p.equipment){
    const _gp = equipLookParts(p);
    drawEquipBodyGlow(at, a.name, a.t, p.x, py, facing, bodyPx, _gp.armor);
  }
  drawSpriteFrame(at, a.name, a.t, p.x, py, facing, bodyPx);
  ctx.filter = 'none';
  /* ★ 装备外观（身前层：前肩甲 / 头盔冠饰 / 饰品光点 / 踏尘环） */
  drawEquipAppearanceFront(p, p.x, py, bodyPx, {facing:facing});
  if(showAura) drawPlayerWeaponAuraFront(p, p.x, py, auraScale, {strong:false});
  ctx.restore();
  return true;
}

/* 城镇中行走的玩家角色 */
function drawTownPlayerSprite(p){
  if(!G || !G.player) return false;
  const at = atlasOf(G.player.weaponIdx);
  if(!at) return false;
  const mount = (G.player.equipment && G.player.equipment.mount) ? G.player.equipment.mount : null;
  const walking = p.state === 'walk';
  /* ★ 有飞行道具：永远站姿，移动感全靠前倾 + 浮动 + 拖尾 */
  const animName = (mount || !walking) ? 'idle' : 'run';
  const prog = (mount || !walking) ? ((performance.now() * 0.0006) % 1)
                                   : (((p.walkPhase/(Math.PI*2)) % 1 + 1) % 1);
  const bodyPx = 150 * (at.bodyWorld / 110);
  const facing = p.facing || 1;
  const moving = walking;
  const ang = (mount && moving) ? 0.11 * facing : 0;
  const bob = mount ? Math.sin(performance.now() * 0.0022) * 2.2 : 0;

  ctx.save();
  if(ang || bob){
    ctx.translate(p.x, p.y);
    ctx.rotate(ang);
    ctx.translate(-p.x, -p.y - bob);
  }

  /* ★ 飞行道具 */
  if(mount && window.MOUNT){
    MOUNT.draw(ctx, p.x, p.y + 2, 1, mount.model, performance.now() / 1000, moving, facing);
  }

  /* ★ 套装光环 */
  drawSetAura(G.player, p.x, p.y, bodyPx / 150);
  /* ★ 强化/增幅轮廓光（绘制在角色身后，形成明显外发光） */
  const gi = getEquipGlowInfo(G.player.equipment ? G.player.equipment.weapon : null);
  if(gi.active){
    if(gi.enhOn) drawSpriteFrame(at, animName, prog, p.x, p.y, facing, bodyPx, {color:'#eaf6ff', alpha:0.55*gi.enhI, blur:30});
    if(gi.ampOn) drawSpriteFrame(at, animName, prog, p.x, p.y, facing, bodyPx, {color:'#ff7ad9', alpha:0.55*gi.ampI, blur:30});
  }
  drawEquipAppearanceBack(G.player, p.x, p.y, bodyPx, {facing:facing});
  /* ★ 护甲体形辉光 */
  const tlp = equipLookParts(G.player);
  drawEquipBodyGlow(at, animName, prog, p.x, p.y, facing, bodyPx, tlp.armor);
  drawSpriteFrame(at, animName, prog, p.x, p.y, facing, bodyPx);
  /* ★ 城镇里也展示装备外观 */
  drawEquipAppearanceFront(G.player, p.x, p.y, bodyPx, {facing:facing});
  ctx.restore();
  return true;
}

/* ===== 武器强化 / 增幅 光效系统 =====
   · 强化 +10 起：淡淡白光，等级越高越亮
   · 增幅 +10 起：淡淡粉光，等级越高越亮
   · 两者同时 ≥10：白光与粉光叠加混色，站在城镇也极为醒目
*/
function getEquipGlowInfo(eq){
  const info = {
    active:false, enhOn:false, ampOn:false, mixed:false,
    enhI:0, ampI:0, enhLv:0, ampLv:0, label:'无光效',
    white:'#e8f4ff', pink:'#ff7ad9'
  };
  if(!eq) return info;
  const enh = eq.enhance || 0, amp = eq.amplify || 0;
  info.enhLv = enh; info.ampLv = amp;
  info.enhOn = enh >= 10;
  info.ampOn = amp >= 10;
  info.enhI = info.enhOn ? clamp(0.16 + (enh - 10) * 0.17, 0, 1) : 0;
  info.ampI = info.ampOn ? clamp(0.16 + (amp - 10) * 0.17, 0, 1) : 0;
  info.active = info.enhOn || info.ampOn;
  info.mixed = info.enhOn && info.ampOn;
  if(info.mixed) info.label = '白粉混合光（强化+' + enh + ' / 增幅+' + amp + '）';
  else if(info.enhOn) info.label = '白色光效（强化+' + enh + '）';
  else if(info.ampOn) info.label = '粉色光效（增幅+' + amp + '）';
  return info;
}

/* 装备图标背光（铁匠铺 / 背包预览用） */
function drawEquipGlowRing(cx, cy, size, eq, alpha){
  const glow = getEquipGlowInfo(eq);
  if(!glow.active) return;
  const a = (alpha === undefined ? 1 : alpha);
  const r = size * 0.95;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  if(glow.enhOn){
    const g = ctx.createRadialGradient(cx, cy, r*0.12, cx, cy, r);
    g.addColorStop(0, 'rgba(232,244,255,' + (0.34 * glow.enhI * a).toFixed(3) + ')');
    g.addColorStop(0.55, 'rgba(210,235,255,' + (0.14 * glow.enhI * a).toFixed(3) + ')');
    g.addColorStop(1, 'rgba(210,235,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill();
  }
  if(glow.ampOn){
    const g2 = ctx.createRadialGradient(cx, cy, r*0.12, cx, cy, r);
    g2.addColorStop(0, 'rgba(255,122,217,' + (0.36 * glow.ampI * a).toFixed(3) + ')');
    g2.addColorStop(0.55, 'rgba(255,122,217,' + (0.15 * glow.ampI * a).toFixed(3) + ')');
    g2.addColorStop(1, 'rgba(255,122,217,0)');
    ctx.fillStyle = g2;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

/* 光效颜色工具 */
function _glowWhite(glow, a){ return 'rgba(232,246,255,' + clamp(a * glow.enhI, 0, 1).toFixed(3) + ')'; }
function _glowPink(glow, a){ return 'rgba(255,118,214,' + clamp(a * glow.ampI, 0, 1).toFixed(3) + ')'; }
function _glowMain(glow, a){ return glow.enhOn ? _glowWhite(glow, a) : _glowPink(glow, a); }

/* 背后光晕：地面光环、身周光雾、光柱、飞散光点 */
function drawPlayerWeaponAura(p, x, y, scale, opts){
  opts = opts || {};
  const eq = p && p.equipment && p.equipment.weapon;
  const glow = getEquipGlowInfo(eq);
  if(!glow.active) return;
  const s = scale || 1;
  const t = performance.now() * 0.001;
  const I = Math.max(glow.enhI, glow.ampI);
  const inten = (opts.strong === false) ? 0.55 : 1;
  const pulse = 0.82 + 0.18 * Math.sin(t * 3.1);

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  /* 地面光环（双层椭圆） */
  const gr = (64 + 30*I) * s;
  const gyy = y + 3;
  const layers = [];
  if(glow.enhOn) layers.push('232,246,255');
  if(glow.ampOn) layers.push('255,118,214');
  for(let li = 0; li < layers.length; li++){
    ctx.save();
    ctx.translate(x, gyy);
    ctx.scale(1, 0.30);
    const gg = ctx.createRadialGradient(0, 0, gr*0.10, 0, 0, gr);
    gg.addColorStop(0, 'rgba(' + layers[li] + ',' + (0.55 * pulse * inten * (li?0.92:1)).toFixed(3) + ')');
    gg.addColorStop(0.55, 'rgba(' + layers[li] + ',' + (0.24 * pulse * inten).toFixed(3) + ')');
    gg.addColorStop(1, 'rgba(' + layers[li] + ',0)');
    ctx.fillStyle = gg;
    ctx.beginPath(); ctx.arc(0, 0, gr, 0, TAU); ctx.fill();
    ctx.restore();
  }

  /* 地面旋转符文环（更拉风） */
  if(I > 0.28){
    ctx.save();
    ctx.translate(x, gyy);
    ctx.scale(1, 0.30);
    for(let k = 0; k < 2; k++){
      ctx.save();
      ctx.rotate(t * (k ? -0.45 : 0.32));
      const col = glow.mixed ? '255,196,240' : (glow.enhOn ? '232,246,255' : '255,118,214');
      ctx.strokeStyle = 'rgba(' + col + ',' + (0.42 * inten).toFixed(3) + ')';
      ctx.lineWidth = (1.4 + 0.8*k);
      ctx.setLineDash(k ? [5, 9] : [11, 7]);
      ctx.beginPath(); ctx.arc(0, 0, (50 + k*17) * s, 0, TAU); ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
    ctx.setLineDash([]);
  }

  /* 身周光雾 */
  const hy = y - 78*s;
  const hr = (74 + 46*I) * s;
  if(glow.enhOn){
    const g1 = ctx.createRadialGradient(x, hy, 2, x, hy, hr);
    g1.addColorStop(0, 'rgba(232,246,255,' + (0.32 * glow.enhI * inten * pulse).toFixed(3) + ')');
    g1.addColorStop(1, 'rgba(200,230,255,0)');
    ctx.fillStyle = g1;
    ctx.beginPath(); ctx.arc(x, hy, hr, 0, TAU); ctx.fill();
  }
  if(glow.ampOn){
    const g2 = ctx.createRadialGradient(x, hy, 2, x, hy, hr);
    g2.addColorStop(0, 'rgba(255,118,214,' + (0.34 * glow.ampI * inten * pulse).toFixed(3) + ')');
    g2.addColorStop(1, 'rgba(255,118,214,0)');
    ctx.fillStyle = g2;
    ctx.beginPath(); ctx.arc(x, hy, hr, 0, TAU); ctx.fill();
  }

  /* 环绕光环（强化高阶更明显） */
  if(I > 0.35){
    const ringR = (58 + 26*I) * s;
    for(let k = 0; k < 2; k++){
      const rot = t * (k ? -0.7 : 0.6) + k * 1.3;
      ctx.save();
      ctx.translate(x, hy);
      ctx.rotate(rot);
      ctx.scale(1, 0.42);
      ctx.strokeStyle = glow.mixed ? 'rgba(255,196,240,' + (0.30*inten).toFixed(3) + ')'
                                   : (glow.enhOn ? 'rgba(232,246,255,' + (0.32*inten).toFixed(3) + ')'
                                                 : 'rgba(255,118,214,' + (0.34*inten).toFixed(3) + ')');
      ctx.lineWidth = (1.6 + 1.4*I) * s;
      ctx.beginPath();
      ctx.arc(0, 0, ringR + k * 12 * s, 0.25, Math.PI*1.45);
      ctx.stroke();
      ctx.restore();
    }
  }

  /* 高阶光柱：+13 以上出现 */
  if(I > 0.32){
    const ph = (170 + 120*I) * s;
    const pw = (34 + 24*I) * s;
    const pg = ctx.createLinearGradient(x, y - ph, x, y);
    const col = glow.mixed ? '255,196,240' : (glow.enhOn ? '225,242,255' : '255,118,214');
    pg.addColorStop(0, 'rgba(' + col + ',0)');
    pg.addColorStop(0.55, 'rgba(' + col + ',' + (0.20 * inten * pulse).toFixed(3) + ')');
    pg.addColorStop(1, 'rgba(' + col + ',' + (0.10 * inten).toFixed(3) + ')');
    ctx.fillStyle = pg;
    ctx.fillRect(x - pw/2, y - ph, pw, ph);
  }

  ctx.restore();
}

/* ★ 武器轮廓（内部按 100 长度设计：握把在 0，尖端在 100）
   画得细一点：护手 / 血槽 / 枪缨 / 斧刃弧度 / 拳套指节都有 */
function weaponOutlinePath(c, wtype){
  const parts = [];
  const add = function(fn){ parts.push(fn); };

  if(wtype === 'fist'){
    /* 龙拳：双手拳套 */
    add(function(){
      c.beginPath();
      c.roundRect(-16, -13, 34, 26, 8);
      c.roundRect(14, -15, 40, 30, 10);
    });
    add(function(){
      /* 指节 */
      c.beginPath();
      for(let i = 0; i < 3; i++){ c.moveTo(20 + i * 11, -11); c.lineTo(20 + i * 11, 11); }
      for(let i = 0; i < 3; i++){ c.moveTo(-11 + i * 11, -9); c.lineTo(-11 + i * 11, 9); }
    });
  } else if(wtype === 'blade'){
    /* ★ 长柄朴刀（与新 drawWeapon 刀型一致）：长杆 + 鎏金护手 + 弧形单刃 */
    add(function(){ c.beginPath(); c.roundRect(-62, -4.2, 78, 8.4, 3); });         /* 长杆 */
    add(function(){ c.beginPath(); c.ellipse(15, 0, 6, 10, 0, 0, TAU); });         /* 鎏金护手盘 */
    add(function(){
      c.beginPath();
      c.moveTo(19, -4);
      c.quadraticCurveTo(62, -17, 102, -5);
      c.lineTo(99, 5);
      c.quadraticCurveTo(60, 8, 19, 4.5);
      c.closePath();
    });
    add(function(){ c.beginPath(); c.moveTo(14, -2); c.quadraticCurveTo(58, -15, 92, -6); });  /* 刃线 */
  } else if(wtype === 'spear'){
    /* 破军枪：长杆 + 枪尖 + 红缨 */
    add(function(){ c.beginPath(); c.roundRect(-34, -2.6, 124, 5.2, 2.6); });
    add(function(){
      c.beginPath();
      c.moveTo(84, -8); c.lineTo(116, 0); c.lineTo(84, 8);
      c.quadraticCurveTo(92, 0, 84, -8);
      c.closePath();
    });
    add(function(){                                   /* 红缨 */
      c.beginPath();
      c.ellipse(78, 0, 9, 11, 0, 0, TAU);
      c.moveTo(74, -3); c.lineTo(60, -12);
      c.moveTo(74, 3);  c.lineTo(60, 12);
    });
  } else if(wtype === 'axe'){
    /* 开山斧：斧柄 + 弧刃 */
    add(function(){ c.beginPath(); c.roundRect(-24, -3.2, 116, 6.4, 3); });
    add(function(){
      c.beginPath();
      c.moveTo(70, -9);
      c.quadraticCurveTo(112, -34, 110, -4);
      c.lineTo(110, 4);
      c.quadraticCurveTo(112, 34, 70, 9);
      c.quadraticCurveTo(86, 0, 70, -9);
      c.closePath();
    });
  } else if(wtype === 'herb'){
    /* 百草药囊：药杖 + 葫芦 */
    add(function(){ c.beginPath(); c.roundRect(-30, -2.6, 116, 5.2, 2.6); });
    add(function(){ c.beginPath(); c.arc(94, -8, 9, 0, TAU); });
    add(function(){ c.beginPath(); c.arc(102, 5, 6.5, 0, TAU); });
    add(function(){ c.beginPath(); c.moveTo(86, -2); c.lineTo(96, -2); });
  } else if(wtype === 'talisman'){
    /* 黄符：符纸 + 符文 */
    add(function(){ c.beginPath(); c.roundRect(-22, -3, 30, 6, 2); });
    add(function(){ c.beginPath(); c.roundRect(6, -20, 42, 40, 4); });
    add(function(){
      c.beginPath();
      c.moveTo(27, -14); c.lineTo(27, 14);
      c.moveTo(17, -6);  c.lineTo(37, -6);
      c.moveTo(17, 4);   c.lineTo(37, 4);
    });
  } else if(wtype === 'cauldron'){
    /* 丹鼎：鼎身 + 三足 + 双耳 */
    add(function(){ c.beginPath(); c.roundRect(16, -18, 52, 34, 8); });
    add(function(){
      c.beginPath();
      c.moveTo(24, 16); c.lineTo(18, 30);
      c.moveTo(60, 16); c.lineTo(66, 30);
      c.moveTo(42, 16); c.lineTo(42, 30);
      c.moveTo(24, -18); c.lineTo(24, -28);
      c.moveTo(60, -18); c.lineTo(60, -28);
    });
  } else {
    /* 青锋剑（默认）：剑脊 + 护手 + 剑柄 */
    add(function(){ c.beginPath(); c.roundRect(-22, -4, 24, 8, 3); });            /* 柄 */
    add(function(){ c.beginPath(); c.roundRect(0, -14, 6, 28, 2.5); });           /* 护手 */
    add(function(){
      c.beginPath();
      c.moveTo(6, -6);
      c.lineTo(84, -5);
      c.lineTo(100, 0);
      c.lineTo(84, 5);
      c.lineTo(6, 6);
      c.closePath();
    });
    add(function(){ c.beginPath(); c.moveTo(12, 0); c.lineTo(88, 0); });          /* 血槽 */
  }
  return parts;
}

/* 沿武器轮廓画发光：外发光 + 渐变填充 + 亮边 */
function drawWeaponGlowShape(c, len, wtype, colFn, glow, alpha){
  const parts = weaponOutlinePath(c, wtype);
  const s = len / 100;
  c.save();
  c.globalCompositeOperation = 'lighter';
  c.scale(s, s);
  for(let pass = 0; pass < 2; pass++){
    const outer = (pass === 0);
    c.shadowColor = colFn(glow, (outer ? 0.85 : 0.35) * alpha);
    c.shadowBlur = outer ? 15 : 5;         /* px，不受缩放影响 */
    for(let i = 0; i < parts.length; i++){
      parts[i]();                          /* 闭包里自带 beginPath */
      if(outer){
        c.fillStyle = colFn(glow, 0.30 * alpha);
      } else {
        const g = c.createLinearGradient(-24, 0, 100, 0);
        g.addColorStop(0, colFn(glow, 0.85 * alpha));
        g.addColorStop(0.45, colFn(glow, 0.62 * alpha));
        g.addColorStop(1, colFn(glow, 0.16 * alpha));
        c.fillStyle = g;
      }
      c.fill();
      c.lineWidth = (outer ? 2.2 : 1.1);
      c.strokeStyle = colFn(glow, (outer ? 0.35 : 0.95) * alpha);
      c.stroke();
    }
  }
  c.restore();
}

/* 前景光效：手中武器高亮、光刃、环绕火花、上升光点 */
function drawPlayerWeaponAuraFront(p, x, y, scale, opts){
  opts = opts || {};
  const eq = p && p.equipment && p.equipment.weapon;
  const glow = getEquipGlowInfo(eq);
  if(!glow.active) return;
  const s = scale || 1;
  const t = performance.now() * 0.001;
  const I = Math.max(glow.enhI, glow.ampI);
  const inten = (opts.strong === false) ? 0.55 : 1;
  const pulse = 0.82 + 0.18 * Math.sin(t * 3.1);
  const facing = p.facing || 1;
  const wtype = (WEAPONS[p.weaponIdx] && WEAPONS[p.weaponIdx].id) || 'sword';

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  /* 手部/武器核心光 */
  const handX = x + facing * 26 * s;
  const handY = y - 86 * s;
  const coreR = (16 + 20*I) * s * pulse;
  if(glow.enhOn){
    const c1 = ctx.createRadialGradient(handX, handY, 0, handX, handY, coreR);
    c1.addColorStop(0, 'rgba(255,255,255,' + (0.68 * glow.enhI * inten).toFixed(3) + ')');
    c1.addColorStop(0.45, 'rgba(214,240,255,' + (0.40 * glow.enhI * inten).toFixed(3) + ')');
    c1.addColorStop(1, 'rgba(214,240,255,0)');
    ctx.fillStyle = c1;
    ctx.beginPath(); ctx.arc(handX, handY, coreR, 0, TAU); ctx.fill();
  }
  if(glow.ampOn){
    const c2 = ctx.createRadialGradient(handX, handY, 0, handX, handY, coreR*1.1);
    c2.addColorStop(0, 'rgba(255,190,240,' + (0.66 * glow.ampI * inten).toFixed(3) + ')');
    c2.addColorStop(0.45, 'rgba(255,118,214,' + (0.42 * glow.ampI * inten).toFixed(3) + ')');
    c2.addColorStop(1, 'rgba(255,118,214,0)');
    ctx.fillStyle = c2;
    ctx.beginPath(); ctx.arc(handX, handY, coreR*1.1, 0, TAU); ctx.fill();
  }

  /* 武器星芒（强化/增幅越强，星芒越大） */
  if(I > 0.3){
    const fl = (18 + 30*I) * s * pulse;
    ctx.save();
    ctx.translate(handX, handY);
    ctx.rotate(t * 0.5);
    for(let k = 0; k < 2; k++){
      ctx.rotate(Math.PI / 2 * k);
      const gg = ctx.createLinearGradient(-fl, 0, fl, 0);
      gg.addColorStop(0, 'rgba(255,255,255,0)');
      gg.addColorStop(0.5, _glowMain(glow, 0.75 * inten));
      gg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gg;
      ctx.beginPath();
      ctx.moveTo(-fl, 0); ctx.lineTo(0, -3.2*s); ctx.lineTo(fl, 0); ctx.lineTo(0, 3.2*s);
      ctx.closePath(); ctx.fill();
    }
    if(glow.mixed){
      const gp = ctx.createRadialGradient(0, 0, 0, 0, 0, fl*0.75);
      gp.addColorStop(0, _glowPink(glow, 0.45 * inten));
      gp.addColorStop(1, 'rgba(255,118,214,0)');
      ctx.fillStyle = gp;
      ctx.beginPath(); ctx.arc(0, 0, fl*0.75, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  /* 武器光刃（剑/刀/枪拖出光带，拳套则双手发光） */
  if(wtype === 'fist'){
    const fists = [ [x - 18*s, y - 84*s], [x + 20*s, y - 80*s] ];
    for(let i = 0; i < 2; i++){
      const fr = (10 + 10*I) * s * pulse;
      const g = ctx.createRadialGradient(fists[i][0], fists[i][1], 0, fists[i][0], fists[i][1], fr);
      g.addColorStop(0, _glowMain(glow, 0.55 * inten));
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(fists[i][0], fists[i][1], fr, 0, TAU); ctx.fill();
    }
  } else {
    /* ★ 不再画一条光带，改成「按武器真实形状的发光」：
       剑 / 刀 / 枪 / 拳套 / 斧 / 药杖 / 黄符 / 丹鼎 各有轮廓，
       沿轮廓外发光 + 亮边，强化出白光、增幅出粉光，两者叠加混色 */
    const len = (wtype === 'spear' ? 118 : (wtype === 'axe' ? 96 : 86)) * s * (0.92 + 0.16 * I);
    ctx.save();
    ctx.translate(handX, handY);
    ctx.rotate(facing > 0 ? -0.16 : 0.16);
    ctx.scale(facing, 1);
    if(glow.enhOn) drawWeaponGlowShape(ctx, len, wtype, _glowWhite, glow, 1.0 * inten * pulse);
    if(glow.ampOn) drawWeaponGlowShape(ctx, len, wtype, _glowPink, glow, (glow.mixed ? 0.8 : 1.0) * inten * pulse);
    ctx.restore();
  }

  /* 环绕火花 */
  const n = Math.round(7 + 10 * I);
  for(let i = 0; i < n; i++){
    const ang = t * (0.9 + (i % 3) * 0.16) + i * TAU / n;
    const rr = (32 + 20*I + (i % 4) * 5) * s;
    const px = x + Math.cos(ang) * rr;
    const py = y - 74*s + Math.sin(ang) * rr * 0.48;
    const sz = (1.6 + 1.9 * ((i % 3) / 2)) * s * (0.7 + 0.5 * pulse);
    ctx.fillStyle = (glow.enhOn && (i % 2 === 0 || !glow.ampOn)) ? _glowWhite(glow, 1.0) : _glowPink(glow, 1.0);
    ctx.beginPath(); ctx.arc(px, py, sz, 0, TAU); ctx.fill();
  }

  /* 上升光点 */
  for(let i = 0; i < 12; i++){
    const ph = ((t * 0.20 + i * 0.1) % 1);
    const px = x + Math.sin(i * 2.4 + t * 0.8) * 24 * s;
    const py = y - 8*s - ph * 150 * s;
    ctx.globalAlpha = (1 - ph) * 0.75 * inten;
    ctx.fillStyle = (glow.enhOn && (i % 2 === 0 || !glow.ampOn)) ? '#eaf6ff' : '#ff9ae0';
    ctx.beginPath(); ctx.arc(px, py, (1.8 + (i % 3) * 1.0) * s, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

/* 选人界面的立绘（待机）——图集未就绪时 drawSpriteFrame 会自动用预览图顶上 */
function drawCharCardSprite(weaponIdx, x, y, bodyPx, phase){
  const w = (typeof WEAPONS !== 'undefined') ? WEAPONS[weaponIdx] : null;
  const at = w ? CHAR_ATLASES[w.id] : null;
  if(!at) return false;
  return drawSpriteFrame(at, 'idle', (phase % 1), x, y, 1, bodyPx);
}

function fit(){
  const s = Math.min(innerWidth / VW, innerHeight / VH);
  cvs.style.width  = (VW * s) + 'px';
  cvs.style.height = (VH * s) + 'px';
}
addEventListener('resize', fit); fit();

const clamp = (v,a,b)=> v<a?a:(v>b?b:v);
const lerp  = (a,b,t)=> a+(b-a)*t;
const rand  = (a,b)=> a + Math.random()*(b-a);
const TAU   = Math.PI*2;
const easeOutQuad = t => t * (2 - t);
const easeInQuad = t => t * t;

if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    this.beginPath();
    this.moveTo(x + r, y);
    this.arcTo(x + w, y, x + w, y + h, r);
    this.arcTo(x + w, y + h, x, y + h, r);
    this.arcTo(x, y + h, x, y, r);
    this.arcTo(x, y, x + w, y, r);
    this.closePath();
    return this;
  };
}

