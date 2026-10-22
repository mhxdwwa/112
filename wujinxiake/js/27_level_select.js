/* ===== 关卡选择界面 ===== */
let levelSelectClickRegions = [];
/* ★ 四方传送使的管辖过滤：null=全部（游戏菜单入口）| {from,to}=地图段 | 'abyss'=深渊五境 */
let levelSelectFilter = null;

function drawLevelSelect(){
  /* 背景 */
  const bg = ctx.createLinearGradient(0, 0, 0, VH);
  bg.addColorStop(0, 'rgba(5,9,14,0.97)');
  bg.addColorStop(1, 'rgba(9,14,21,0.99)');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, VW, VH);

  const halo = ctx.createRadialGradient(VW/2, -120, 30, VW/2, -120, 640);
  halo.addColorStop(0, 'rgba(120,190,255,0.16)');
  halo.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = halo; ctx.fillRect(0, 0, VW, 460);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd166';
  ctx.font = 'bold 34px "Microsoft YaHei"';
  ctx.fillText('选择关卡', VW/2, 58);
  /* ★ 过滤器标题：显示当前传送使与其管辖段 */
  let filterSub = '守门人 · 轮回塔';
  if(levelSelectFilter === 'abyss'){
    const _ac = abyssUnlockCount(G ? G.player : null);
    filterSub = _ac >= 5 ? '深渊传送使·玄冥 —— 深渊五境已全部开启 · 传说/史诗掉率大增'
      : _ac >= 1 ? '深渊传送使·玄冥 —— 已开启「子夜鬼门」，通关后解锁其余四境'
      : '深渊传送使·玄冥 —— 🔒 完成前置任务「深渊的邀请」（50 级后自动接取）方可开启深渊';
  } else if(levelSelectFilter){
    const GNAMES = { 0:'传送使·青鸾 —— 初阶 1~20 级地图', 3:'传送使·朱明 —— 进阶 21~40 级地图', 5:'传送使·白泽 —— 高阶 41~60 级地图' };
    filterSub = GNAMES[levelSelectFilter.from] || '传送使 · 专区地图';
  }
  ctx.fillStyle = '#6f8b9e';
  ctx.font = '14px "Microsoft YaHei"';
  ctx.fillText(filterSub, VW/2, 84);

  levelSelectClickRegions = [];

  /* 难度选择 */
  const difficulties = [
    { id: 'normal', name: '普通', color: '#8fd3a0', mul: 1.0 },
    { id: 'hard',   name: '困难', color: '#ff9a5a', mul: 2.0 },
    { id: 'hell',   name: '地狱', color: '#ff5a5a', mul: 3.5 }
  ];
  const curDiff = G.currentDifficulty || 'normal';
  const diffW = 96, diffH = 30, diffGap = 12;
  const diffTotalW = diffW * 3 + diffGap * 2;
  const diffStartX = VW/2 - diffTotalW/2;
  const diffY = 108;

  ctx.textAlign = 'right';
  ctx.fillStyle = '#5f7f93';
  ctx.font = '13px "Microsoft YaHei"';
  ctx.fillText('难度', diffStartX - 14, diffY + 20);

  for(let i = 0; i < difficulties.length; i++){
    const d = difficulties[i];
    const dx = diffStartX + i * (diffW + diffGap);
    const on = curDiff === d.id;
    ctx.fillStyle = on ? d.color : 'rgba(28,38,50,0.9)';
    ctx.beginPath(); ctx.roundRect(dx, diffY, diffW, diffH, 8); ctx.fill();
    if(!on){ ctx.strokeStyle = '#26384a'; ctx.lineWidth = 1; ctx.stroke(); }
    ctx.textAlign = 'center';
    ctx.fillStyle = on ? '#0b1219' : '#7f9bb0';
    ctx.font = 'bold 14px "Microsoft YaHei"';
    ctx.fillText(d.name, dx + diffW/2, diffY + 20);
    ctx.font = '10px "Microsoft YaHei"';
    ctx.fillText('×' + d.mul.toFixed(1), dx + diffW/2 + 26, diffY + 12);
    levelSelectClickRegions.push({ x: dx, y: diffY, w: diffW, h: diffH, difficulty: d.id });
  }

  /* 关卡卡片 3 列（★ 只显示当前传送使管辖段内的地图） */
  const cardW = 292, cardH = 80, gapX = 14, gapY = 10, COLS = 3;
  const totalW = cardW * COLS + gapX * (COLS - 1);
  const startX = VW/2 - totalW/2;
  const startY = 172;
  const playerLevel = G.player ? (G.player.level || 1) : 1;
  const THEME_COL = ['#7fe0b0','#ff6a6a','#7fc8ff','#c9a2ff','#ffe066','#ff8a4a','#7de6ff'];
  const ABYSS_COL = '#9b59b6';

  /* 组装可见关卡列表 */
  const showIdxs = [];
  for(let i = 0; i < LEVEL_TEMPLATES.length; i++){
    const t = LEVEL_TEMPLATES[i];
    if(levelSelectFilter === 'abyss'){
      if(t.isAbyss) showIdxs.push(i);
    } else if(levelSelectFilter){
      if(i >= levelSelectFilter.from && i <= levelSelectFilter.to) showIdxs.push(i);
    } else {
      showIdxs.push(i);
    }
  }

  for(let pos = 0; pos < showIdxs.length; pos++){
    const i = showIdxs[pos];
    const lvl = getLevelConfig(i);
    const tpl = LEVEL_TEMPLATES[i];
    const isAbyss = !!(tpl && tpl.isAbyss);
    /* ★ 深渊准入：未完成前置任务链的深渊图锁定（0=全锁/1=仅第一境/5=全开） */
    let abyssLocked = false, abyssLockTip = '';
    if(isAbyss){
      const aSeq = ABYSS_LEVEL_IDXS.indexOf(i);
      const acnt = abyssUnlockCount(G ? G.player : null);
      if(acnt >= 5){ /* 全开 */ }
      else if(acnt >= 1 && aSeq === 0){ /* 仅第一境可进 */ }
      else {
        abyssLocked = true;
        const q = (G && G.player) ? questOf(G.player) : null;
        abyssLockTip = (q && (q.done.indexOf('qa1') >= 0 || q.idx > MAIN_QUESTS.findIndex(m => m.id === 'qa1')))
          ? '通关「子夜鬼门」后开启' : '完成「深渊的邀请」后开启';
      }
    }
    const col = pos % COLS, row = Math.floor(pos / COLS);
    const cx = startX + col * (cardW + gapX);
    const cy = startY + row * (cardH + gapY);

    const cleared = G.player && G.player.clearedLevels && G.player.clearedLevels.includes(i);
    const levelLocked = playerLevel < (lvl.minLevel || 1);

    /* 主题配色（深渊关用紫色） */
    const themeCol = isAbyss ? ABYSS_COL : (THEME_COL[lvl.theme] || '#7fe0b0');

    /* 卡片底 */
    const cbg = ctx.createLinearGradient(cx, cy, cx + cardW, cy + cardH);
    if(cleared){ cbg.addColorStop(0, 'rgba(26,58,44,0.95)'); cbg.addColorStop(1, 'rgba(16,34,28,0.95)'); }
    else { cbg.addColorStop(0, 'rgba(24,32,44,0.95)'); cbg.addColorStop(1, 'rgba(15,21,30,0.95)'); }
    ctx.fillStyle = cbg;
    ctx.beginPath(); ctx.roundRect(cx, cy, cardW, cardH, 8); ctx.fill();
    ctx.strokeStyle = cleared ? 'rgba(58,160,110,0.9)' : 'rgba(44,62,80,0.9)';
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.roundRect(cx, cy, cardW, cardH, 8); ctx.stroke();

    /* 左侧主题色条 */
    ctx.save();
    ctx.beginPath(); ctx.roundRect(cx, cy, cardW, cardH, 8); ctx.clip();
    const bar = ctx.createLinearGradient(cx, cy, cx, cy + cardH);
    bar.addColorStop(0, themeCol); bar.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = cleared ? 0.9 : 0.5;
    ctx.fillStyle = bar; ctx.fillRect(cx, cy, 3, cardH);
    ctx.restore();

    /* 关卡序号 */
    const badgeW = 36, badgeH = 36;
    const bx = cx + 12, by = cy + (cardH - badgeH)/2;
    const bgrd = ctx.createLinearGradient(bx, by, bx, by + badgeH);
    bgrd.addColorStop(0, cleared ? 'rgba(60,180,120,0.35)' : 'rgba(60,90,120,0.35)');
    bgrd.addColorStop(1, 'rgba(10,16,22,0.6)');
    ctx.fillStyle = bgrd;
    ctx.beginPath(); ctx.roundRect(bx, by, badgeW, badgeH, 7); ctx.fill();
    ctx.strokeStyle = cleared ? 'rgba(80,220,150,0.7)' : hexA(themeCol, 0.45);
    ctx.lineWidth = 1; ctx.stroke();
    ctx.textAlign = 'center';
    ctx.fillStyle = cleared ? '#8affc0' : '#a9c6dc';
    ctx.font = 'bold 17px "Microsoft YaHei"';
    ctx.fillText(String(i + 1), bx + badgeW/2, by + 21);
    ctx.font = '8px "Microsoft YaHei"';
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillText('关', bx + badgeW/2, by + 31);

    /* 标题 */
    const titleText = (lvl.name || '').replace(/^第\d+关·/, '');
    ctx.textAlign = 'left';
    ctx.fillStyle = levelLocked ? '#556' : '#e8f4ff';
    ctx.font = 'bold 14px "Microsoft YaHei"';
    ctx.fillText(titleText, bx + badgeW + 10, cy + 31);

    /* 副行：Boss + 推荐等级（只留这两条，波数等信息不再显示） */
    ctx.fillStyle = 'rgba(255,255,255,0.38)';
    ctx.font = '10px "Microsoft YaHei"';
    const template = LEVEL_TEMPLATES[i];
    const recLv = template ? template.minLevel : (i * 3 + 1);
    let bossLabel = lvl.bossName || '未知';
    if(bossLabel.length > 9) bossLabel = bossLabel.slice(0, 9) + '…';
    if(isAbyss) bossLabel = '🐍 ' + bossLabel;
    ctx.fillText('Boss：' + bossLabel, bx + badgeW + 10, cy + 50);
    ctx.fillStyle = isAbyss ? 'rgba(232,208,255,0.9)' : 'rgba(127,155,176,0.8)';
    ctx.fillText('推荐 Lv.' + recLv + (isAbyss ? ' · Boss难度×10 · 史诗掉率大增' : ''), bx + badgeW + 10, cy + 66);

    /* 右侧状态：未解锁显示锁，已通关显示勾，未通关不显示（减少噪音） */
    ctx.textAlign = 'right';
    if(levelLocked){
      ctx.fillStyle = '#ff6a5a';
      ctx.font = 'bold 11px "Microsoft YaHei"';
      ctx.fillText('未解锁', cx + cardW - 12, cy + 24);
    } else if(abyssLocked){
      /* ★ 深渊未做任务：卡片压暗 + 锁标 + 提示文案 */
      ctx.fillStyle = 'rgba(6,8,14,0.55)';
      ctx.beginPath(); ctx.roundRect(cx, cy, cardW, cardH, 8); ctx.fill();
      ctx.textAlign = 'left';
      ctx.fillStyle = '#c9a2ff';
      ctx.font = 'bold 12px "Microsoft YaHei"';
      ctx.fillText('🔒 ' + abyssLockTip, bx + badgeW + 10, cy + 66);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#8a6ab0';
      ctx.font = 'bold 14px "Microsoft YaHei"';
      ctx.fillText('🔒 未开启', cx + cardW - 12, cy + 24);
    } else if(cleared){
      ctx.fillStyle = '#6fe3a3';
      ctx.font = 'bold 14px "Microsoft YaHei"';
      ctx.fillText('✓', cx + cardW - 14, cy + 26);
    }

    if(!levelLocked && !abyssLocked){
      levelSelectClickRegions.push({ x: cx, y: cy, w: cardW, h: cardH, levelIdx: i });
    }
  }

  /* 返回按钮（左上角，DNF 惯例，把底部空间全部留给关卡） */
  const bw = 96, bh = 34, bx2 = 24, by2 = 22;
  ctx.fillStyle = 'rgba(40,52,66,0.9)';
  ctx.beginPath(); ctx.roundRect(bx2, by2, bw, bh, 8); ctx.fill();
  ctx.strokeStyle = 'rgba(90,120,150,0.6)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.roundRect(bx2, by2, bw, bh, 8); ctx.stroke();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#cfe4f5';
  ctx.font = 'bold 14px "Microsoft YaHei"';
  ctx.fillText('← 返回', bx2 + bw/2, by2 + 22);
  levelSelectClickRegions.push({ x: bx2, y: by2, w: bw, h: bh, levelIdx: -1 });
}

