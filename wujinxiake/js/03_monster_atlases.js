/* ===== 怪兽精灵表（单张立绘离线烘焙的 6x6 动作表） ===== */
const MON_ANIM_MAP = {
  idle:[0,1,2,3], run:[4,5,6,7,8,9,10,11],
  atk1:[12,13,14,15], atk2:[16,17,18,19], atk3:[20,21,22,23],
  skill:[24,25,26], jump:[27,28], dodge:[27,28],
  hurt:[29], death:[30,31,32], victory:[33]
};
const MONSTER_ATLASES = {};
function regMonsterAtlas(key, file, feetX, groundY, bodyH, bodyWorld){
  if(MONSTER_ATLASES[key]) return MONSTER_ATLASES[key];
  const anims = {};
  for(const k in MON_ANIM_MAP) anims[k] = { frames: MON_ANIM_MAP[k] };
  const at = {
    ready:false, loading:false, url:file, img:new Image(),
    cellW:224, cellH:224, cols:6, rows:6,
    feetX:feetX, groundY:groundY, bodyH:bodyH, bodyWorld:bodyWorld||104,
    anims:anims, flip:true
  };
  MONSTER_ATLASES[key] = at;
  return at;
}
/* 懒加载：首次出场才载入贴图，避免开局一次性解码 24 张大图 */
/* ★ 变体怪 → 基础精灵表 的别名（同一张图，靠 tint 换色做出不同物种） */
const MONSTER_ATLAS_ALIAS = {
  bandit_archer:'bandit', wolf_frost:'wolf', skeleton_mage:'skeleton',
  ghost_wraith:'ghost', spider_queen:'spider', tiger_thunder:'tiger',
  dragon_flame:'dragon', phoenix_dark:'phoenix', void_lord:'dark_lord'
};
/* 变体怪（tiger_thunder 等）渲染时也要能解析到基础精灵表 */
function monsterAtlasOf(typeKey){
  return MONSTER_ATLASES[typeKey] || MONSTER_ATLASES[MONSTER_ATLAS_ALIAS[typeKey]] || null;
}
function ensureMonsterAtlas(key){
  const at = MONSTER_ATLASES[key] || MONSTER_ATLASES[MONSTER_ATLAS_ALIAS[key]];
  if(!at || at.ready || at.loading) return at;
  at.loading = true;
  at.img.onload = ()=>{ at.ready = true; };
  at.img.onerror = ()=>{ at.ready = false; at.loading = false; };
  at.img.src = at.url;
  return at;
}
/* 进入关卡时，把本关会出现的怪全部预载 */
function preloadLevelMonsters(lvl){
  try{
    if(!lvl) return;
    const seen = {};
    for(const w of (lvl.waves || [])) for(const t of w) seen[t] = 1;
    if(lvl.boss) seen[lvl.boss] = 1;
    for(const k in seen) ensureMonsterAtlas(k);
  }catch(e){}
}

/* === MONSTER_ATLAS_BEGIN === */
regMonsterAtlas('abbull', 'assets/monsters/abbull_atlas.webp', 96.8, 193.8, 192.6, 146);
regMonsterAtlas('abdragon', 'assets/monsters/abdragon_atlas.webp', 100.8, 194.0, 192.6, 150);
regMonsterAtlas('abserpent', 'assets/monsters/abserpent_atlas.webp', 101.3, 195.6, 192.6, 142);
regMonsterAtlas('abthunder', 'assets/monsters/abthunder_atlas.webp', 100.1, 193.0, 192.6, 138);
regMonsterAtlas('abtiger', 'assets/monsters/abtiger_atlas.webp', 97.5, 195.2, 192.6, 128);
regMonsterAtlas('assassin', 'assets/monsters/assassin_atlas.webp', 122.0, 221.6, 192.6, 110);
regMonsterAtlas('bandit', 'assets/monsters/bandit_atlas.webp', 101.8, 201.0, 192.6, 110);
regMonsterAtlas('bat', 'assets/monsters/bat_atlas.webp', 94.4, 195.2, 192.6, 110);
regMonsterAtlas('bear', 'assets/monsters/bear_atlas.webp', 99.3, 202.2, 192.6, 110);
regMonsterAtlas('boss', 'assets/monsters/boss_atlas.webp', 93.5, 191.6, 192.6, 110);
regMonsterAtlas('brute', 'assets/monsters/brute_atlas.webp', 121.8, 222.3, 192.6, 110);
regMonsterAtlas('dark_lord', 'assets/monsters/dark_lord_atlas.webp', 100.1, 198.4, 192.6, 110);
regMonsterAtlas('demon_mage', 'assets/monsters/demon_mage_atlas.webp', 89.5, 197.3, 192.6, 110);
regMonsterAtlas('demon_soldier', 'assets/monsters/demon_soldier_atlas.webp', 87.9, 191.6, 192.6, 110);
regMonsterAtlas('dragon', 'assets/monsters/dragon_atlas.webp', 102.2, 189.6, 183.3, 110);
regMonsterAtlas('eagle', 'assets/monsters/eagle_atlas.webp', 124.5, 222.6, 182.2, 110);
regMonsterAtlas('fire_god', 'assets/monsters/fire_god_atlas.webp', 103.4, 200.4, 192.6, 110);
regMonsterAtlas('fox', 'assets/monsters/fox_atlas.webp', 93.1, 191.6, 192.6, 110);
regMonsterAtlas('ghost', 'assets/monsters/ghost_atlas.webp', 113.8, 209.5, 192.6, 110);
regMonsterAtlas('phoenix', 'assets/monsters/phoenix_atlas.webp', 101.0, 195.0, 192.6, 110);
regMonsterAtlas('qilin', 'assets/monsters/qilin_atlas.webp', 105.8, 191.6, 192.6, 110);
regMonsterAtlas('scorpion', 'assets/monsters/scorpion_atlas.webp', 91.7, 191.6, 192.6, 110);
regMonsterAtlas('skeleton', 'assets/monsters/skeleton_atlas.webp', 94.7, 191.6, 192.6, 110);
regMonsterAtlas('snake', 'assets/monsters/snake_atlas.webp', 106.2, 191.6, 192.6, 110);
regMonsterAtlas('spider', 'assets/monsters/spider_atlas.webp', 93.3, 191.6, 192.6, 110);
regMonsterAtlas('thunder_god', 'assets/monsters/thunder_god_atlas.webp', 94.4, 195.2, 192.6, 110);
regMonsterAtlas('tiger', 'assets/monsters/tiger_atlas.webp', 110.5, 208.7, 167.9, 110);
regMonsterAtlas('tree_demon', 'assets/monsters/tree_demon_atlas.webp', 114.0, 211.8, 192.6, 110);
regMonsterAtlas('wolf', 'assets/monsters/wolf_atlas.webp', 118.8, 179.4, 141.4, 72);
regMonsterAtlas('zboar', 'assets/monsters/zboar_atlas.webp', 110.5, 198.3, 191.6, 104);
regMonsterAtlas('zdog', 'assets/monsters/zdog_atlas.webp', 106.2, 180.8, 151.9, 98);
regMonsterAtlas('zgoat', 'assets/monsters/zgoat_atlas.webp', 101.9, 198.0, 192.6, 108);
regMonsterAtlas('zhorse', 'assets/monsters/zhorse_atlas.webp', 104.9, 197.0, 192.6, 112);
regMonsterAtlas('zmonkey', 'assets/monsters/zmonkey_atlas.webp', 96.4, 191.6, 192.6, 104);
regMonsterAtlas('zox', 'assets/monsters/zox_atlas.webp', 106.9, 196.2, 188.7, 118);
regMonsterAtlas('zrabbit', 'assets/monsters/zrabbit_atlas.webp', 97.4, 197.0, 192.6, 92);
regMonsterAtlas('zrat', 'assets/monsters/zrat_atlas.webp', 96.5, 191.6, 192.6, 96);
regMonsterAtlas('zrooster', 'assets/monsters/zrooster_atlas.webp', 104.2, 191.6, 192.6, 92);
/* === MONSTER_ATLAS_END === */

/* 敌人当前该播哪个动作 */
function monsterAnimFor(e){
  if(!e.alive) return { name:'death', t: clamp((e.deathT||0) / 0.62, 0, 0.999) };
  if(e.hurtT > 0) return { name:'hurt', t: 0.35 };
  const act = e.action;
  if(act && act.type && act.type !== 'enemySkill'){
    const dur = Math.max(0.15, act.dur || 0.6);
    const p = clamp((act.t||0) / dur, 0, 0.999);
    const nm = ((e.atkSeq||0) % 3 === 1) ? 'atk2' : (((e.atkSeq||0) % 3 === 2) ? 'atk3' : 'atk1');
    return { name: nm, t: p };
  }
  if(act && act.type === 'enemySkill') return { name:'skill', t: clamp((act.t||0)/Math.max(0.2, act.dur||1), 0, 0.999) };
  if((e.h||0) > 2 || (e.launchT||0) > 0) return { name:'jump', t: (e.vy||0) > 0 ? 0 : 1 };
  const far = G && G.player && Math.abs(e.x - G.player.x) > 76;
  if(far || e.state === 'run' || e.state === 'chase'){
    return { name:'run', t: ((G ? G.t : 0) * 1.75 + (e.walkPhase||0) * 0.13) % 1 };
  }
  return { name:'idle', t: ((G ? G.t : 0) * 0.45 + (e.walkPhase||0) * 0.05) % 1 };
}

/* 用精灵表绘制敌人 */
function drawMonsterSprite(e){
  const at = ensureMonsterAtlas(e.typeKey);
  if(!at || !at.ready) return false;
  const a = monsterAnimFor(e);
  const sc = depthScale(e.y) * (e.scale || 1);
  const bodyPx = at.bodyWorld * sc;
  const px = e.x, py = e.y - (e.h || 0);
  const face = e.facing || 1;
  ctx.save();
  if(!e.alive) ctx.globalAlpha = clamp(1 - (e.deathT||0) / 1.05, 0, 1);
  if(e.hurtT > 0){
    ctx.filter = 'brightness(1.85) saturate(0.5)';
    drawSpriteFrame(at, a.name, a.t, px, py, face, bodyPx, {color:'#ff5a3a', alpha:0.5, blur:16});
    ctx.filter = 'none';
  } else {
    /* 精英 / BOSS 描边光 */
    if(e.affix === 'elite' || (e.def && e.def.boss)){
      const glowCol = (e.def && e.def.boss) ? '#ffd166' : '#c56bff';
      drawSpriteFrame(at, a.name, a.t, px, py, face, bodyPx, {color:glowCol, alpha:0.30, blur:22});
    }
    /* ★ 变体怪换色：只作用于本体绘制，不影响描边光 */
    const tint = e.def && e.def.tint;
    if(tint) ctx.filter = tint;
    drawSpriteFrame(at, a.name, a.t, px, py, face, bodyPx);
    if(tint) ctx.filter = 'none';
  }
  ctx.restore();
  return true;
}

/* 职业 -> 精灵表（未就绪时顺手把这个职业的图集提到最前加载，避免角色迟迟不出） */
function atlasOf(weaponIdx){
  const w = WEAPONS[weaponIdx];
  if(!w) return null;
  const at = CHAR_ATLASES[w.id];
  if(at && !at.ready && !at._started && typeof ensureCharAtlas === 'function') ensureCharAtlas(w.id);
  return (at && at.ready) ? at : null;
}

/* 战斗状态 -> 动作名 + 进度(0~1) */
function fighterAnimFor(p){
  const a = p.action;
  if(a){
    if(a.type === 'attack'){
      const c = a.c || { windup:0.07, strike:0.07, recover:0.14 };
      const total = Math.max(0.06, c.windup + c.strike + c.recover);
      const map = ['atk1','atk2','atk1','atk3','atk3'];
      return { name: map[a.idx] || 'atk1', t: clamp(a.t/total, 0, 1) };
    }
    if(a.type === 'swordCharge' || a.type === 'storm' || a.type === 'bladeCharge' || a.type === 'spearThrust' || a.type === 'spearCharge' || a.type === 'fistCharge' || a.type === 'fistMeditate'){
      return { name:'skill', t: clamp(a.t/Math.max(0.25, a.dur||0.6), 0, 1) };
    }
    if(a.type === 'cast') return { name:'skill', t: clamp(a.t/Math.max(0.2, a.dur||0.8), 0, 1) };
    return { name:'skill', t:0.55 };
  }
  if(p.hurtT > 0) return { name:'hurt', t:0 };
  if(p.dodgeT > 0) return { name:'dodge', t: 1 - clamp(p.dodgeT/0.4, 0, 1) };
  if((p.h||0) > 0.5 || (p.jumpT||0) > 0 || (p.landingT||0) > 0){
    const rising = (p.jumpT||0) > 0.24 || (p.vy||0) < 0;
    return { name:'jump', t: rising ? 0 : 1 };
  }
  if(p.state === 'run'){
    /* ★ 踩着飞行道具：不用跑动帧，保持站立（移动靠整体平移 + 前倾） */
    if(window.MOUNT && MOUNT.riding(p)) return { name:'idle', t: ((G.t * 0.5) % 1) };
    const ph = ((p.walkPhase/(Math.PI*2)) % 1 + 1) % 1;
    return { name:'run', t: ph };
  }
  return { name:'idle', t: ((G.t * 0.5) % 1) };
}

/* 按精灵表绘制一帧；bodyPx = 角色身体在屏幕上的像素高度
   glow（可选）: {color, alpha, blur} 用同帧绘制发光轮廓 */
function drawSpriteFrame(at, animName, prog, x, y, facing, bodyPx, glow){
  /* ★ 角色图集还没下载完时退回 256px 预览图，画面不会出现空白等待（怪物图集无预览，行为不变） */
  if(typeof charAtlasDrawable === 'function') at = charAtlasDrawable(at);
  if(!at) return false;
  const def = at.anims[animName] || at.anims.idle;
  const frames = def.frames, n = frames.length;
  if(!n) return false;
  let fi;
  if(animName === 'idle' || animName === 'run') fi = Math.floor(prog*n) % n;
  else fi = Math.min(n-1, Math.floor(prog*n));
  const idx = frames[fi];
  const sx = (idx % at.cols) * at.cellW;
  const sy = Math.floor(idx / at.cols) * at.cellH;
  const k = bodyPx / at.bodyH;
  ctx.save();
  ctx.translate(x, y);
  /* ★ 部分精灵表烘焙出来是朝左的（herb/axe/cauldron），这里统一按 facing 翻转 */
  const f = at.faceLeft ? -facing : facing;
  if(f < 0) ctx.scale(-1, 1);
  if(glow){
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = glow.alpha;
    ctx.shadowColor = glow.color;
    ctx.shadowBlur = glow.blur;
  }
  ctx.drawImage(at.img, sx, sy, at.cellW, at.cellH,
    -at.feetX*k, -at.groundY*k, at.cellW*k, at.cellH*k);
  ctx.restore();
  return true;
}

/* 战斗中的玩家角色 */
