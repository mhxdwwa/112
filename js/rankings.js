function renderClassTopThree(){
  const container=document.getElementById('classTopThree');
  const fullListEl=document.getElementById('fullRankList');
  const statsBar=document.getElementById('rankStatsBar');
  if(!container||!currentClassId)return;
  const cur=classesData.find(c=>c.id===currentClassId);
  if(!cur)return;
  const allList=cur.students.map(s=>({
    name:s.name,
    totalGrowth:s.pets?.reduce((sum,p)=>sum+(p.growth||0),0)||0,
    pet:s.pets&&s.pets.length>0?s.pets[0]:null,
    petCount:s.pets?s.pets.length:0,
    maxLevel:s.pets?Math.max(0,...s.pets.map(p=>p.level||1)):0
  })).filter(x=>x.totalGrowth>0).sort((a,b)=>b.totalGrowth-a.totalGrowth);

  const emptyHint=document.getElementById('honorEmptyHint');
  if(allList.length===0){
    container.innerHTML='';
    if(fullListEl)fullListEl.innerHTML='';
    if(statsBar)statsBar.innerHTML='';
    if(emptyHint)emptyHint.style.display='block';
    return;
  }
  if(emptyHint)emptyHint.style.display='none';

  const maxGrowth=allList[0]?.totalGrowth||1;
  const totalStudents=cur.students.length;
  const hasPetCount=cur.students.filter(s=>s.pets&&s.pets.length>0).length;
  const totalGrowthAll=allList.reduce((s,x)=>s+x.totalGrowth,0);

  /* 统计横幅 */
  if(statsBar){
    statsBar.innerHTML=`<div class="rank-stats-banner">
      <div class="rank-stat-chip"><div class="chip-num">${totalStudents}</div><div class="chip-label">班级人数</div></div>
      <div class="rank-stat-chip"><div class="chip-num">${hasPetCount}</div><div class="chip-label">已养宠物</div></div>
      <div class="rank-stat-chip"><div class="chip-num">${allList.length}</div><div class="chip-label">上榜人数</div></div>
      <div class="rank-stat-chip"><div class="chip-num">${totalGrowthAll}</div><div class="chip-label">全班总成长</div></div>
    </div>`;
  }

  /* 称号系统 */
  function getRankTitle(idx,total){
    if(idx===0) return {text:'冠军驯兽师',cls:'champion'};
    if(idx===1) return {text:'精英驯兽师',cls:'elite'};
    if(idx===2) return {text:'勇者驯兽师',cls:'brave'};
    if(idx<Math.ceil(total*0.3)) return {text:'新星驯兽师',cls:'rising'};
    return {text:'见习驯兽师',cls:'starter'};
  }

  /* 领奖台 top3 */
  const top3=allList.slice(0,3);
  const podiumOrder=[1,0,2]; /* silver, gold, bronze */
  let podiumHtml='<div class="podium-section">';
  podiumOrder.forEach(pi=>{
    const item=top3[pi];
    if(!item)return;
    const cls=['gold','silver','bronze'][pi];
    const pet=item.pet;
    const petImg=pet?getPetImage(pet.name,pet.level||1):'<span style="font-size:36px;">🥚</span>';
    const crown=pi===0?'<div class="podium-crown">👑</div>':'';
    const medalNum=pi+1;
    podiumHtml+=`<div class="podium-slot ${cls}">
      <div class="podium-avatar-wrap">
        ${crown}
        <div class="podium-avatar">${petImg}<div class="podium-medal">${medalNum}</div></div>
      </div>
      <div class="podium-name">${esc(item.name)}</div>
      <div class="podium-pet-name">${pet?(esc(pet.nickname||pet.name)):'未领养'}</div>
      <div class="podium-pillar">
        <div class="podium-rank-num">${medalNum}</div>
        <div class="podium-growth-val">${item.totalGrowth} 成长</div>
      </div>
    </div>`;
  });
  podiumHtml+='</div><div class="podium-base"></div>';
  container.innerHTML=podiumHtml;

  /* 完整排名列表 */
  if(fullListEl){
    let listHtml='<div class="full-rank-section"><div class="full-rank-title">📊 全班排行</div><div class="rank-list">';
    allList.forEach((item,idx)=>{
      const topCls=idx===0?'top1':idx===1?'top2':idx===2?'top3':'';
      const pet=item.pet;
      const petImg=pet?getPetImage(pet.name,pet.level||1):'<span style="font-size:22px;">🥚</span>';
      const pct=Math.round((item.totalGrowth/maxGrowth)*100);
      const title=getRankTitle(idx,allList.length);
      listHtml+=`<div class="rank-row ${topCls}">
        <div class="rank-num">${idx+1}</div>
        <div class="rank-row-avatar">${petImg}</div>
        <div class="rank-row-info">
          <div class="rank-row-name">${esc(item.name)} <span class="rank-title-badge ${title.cls}">${title.text}</span></div>
          <div class="rank-row-pet">${pet?(esc(pet.nickname||pet.name)):'未领养'} ${pet?'Lv.'+pet.level:''} ${item.petCount>1?'(共'+item.petCount+'只)':''}</div>
          <div class="rank-progress-wrap">
            <div class="rank-progress-bar"><div class="rank-progress-fill" style="width:${pct}%"></div></div>
            <div class="rank-growth-num">${item.totalGrowth}</div>
          </div>
        </div>
      </div>`;
    });
    listHtml+='</div></div>';
    fullListEl.innerHTML=listHtml;
  }
}
// ========== 排行榜四分类标签切换 ==========
function switchRankTab(tabName) {
  document.querySelectorAll('.rank-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.rank-tab-content').forEach(c => c.classList.remove('active'));
  const tabs = document.querySelectorAll('.rank-tab');
  const idx = tabName === 'growth' ? 0 : tabName === 'quiz' ? 1 : tabName === 'pigrun' ? 2 : tabName === 'match3' ? 3 : 4;
  if (tabs[idx]) tabs[idx].classList.add('active');
  const contentId = tabName === 'growth' ? 'rankGrowthContent' : tabName === 'quiz' ? 'rankQuizContent' : tabName === 'pigrun' ? 'rankPigRunContent' : tabName === 'match3' ? 'rankMatch3Content' : 'rankHappyRunContent';
  const content = document.getElementById(contentId);
  if (content) content.classList.add('active');
  if (tabName === 'quiz') renderQuizRanking();
  if (tabName === 'pigrun') renderPigRunRanking();
  if (tabName === 'match3') renderMatch3Ranking();
  if (tabName === 'happyrun') renderHappyRunRanking();
}
window.switchRankTab = switchRankTab;

// ========== 每日一练排行榜 ==========
function renderQuizRanking() {
  const cur = classesData.find(c => c.id === currentClassId);
  if (!cur) return;
  const topThreeEl = document.getElementById('quizTopThree');
  const fullListEl = document.getElementById('fullQuizRankList');
  const emptyHint = document.getElementById('quizRankEmptyHint');
  const statsBar = document.getElementById('rankQuizStatsBar');

  // 仅统计每日一练答题获得的金币（quizState.totalQuizCoins），不含其他来源
  const allList = cur.students.map(s => {
    var quizCoins = (s.quizState && s.quizState.totalQuizCoins) || 0;
    return {
      name: s.name,
      totalCoins: quizCoins,
      student: s
    };
  }).filter(x => x.totalCoins > 0).sort((a, b) => b.totalCoins - a.totalCoins);

  if (allList.length === 0) {
    if (topThreeEl) topThreeEl.innerHTML = '';
    if (fullListEl) fullListEl.innerHTML = '';
    if (statsBar) statsBar.innerHTML = '';
    if (emptyHint) emptyHint.style.display = 'block';
    return;
  }
  if (emptyHint) emptyHint.style.display = 'none';

  const maxCoins = allList[0]?.totalCoins || 1;
  const totalStudents = cur.students.length;
  const totalCoinsAll = allList.reduce((s, x) => s + x.totalCoins, 0);

  // Stats bar
  if (statsBar) {
    statsBar.innerHTML = `<div class="rank-stats-banner">
      <div class="rank-stat-chip"><div class="chip-num">${totalStudents}</div><div class="chip-label">班级人数</div></div>
      <div class="rank-stat-chip"><div class="chip-num">${allList.length}</div><div class="chip-label">上榜人数</div></div>
      <div class="rank-stat-chip"><div class="chip-num">${totalCoinsAll}</div><div class="chip-label">全班总金币</div></div>
    </div>`;
  }

  function getQuizRankTitle(idx, total) {
    if (idx === 0) return { text: '答题王者', cls: 'champion' };
    if (idx === 1) return { text: '答题达人', cls: 'elite' };
    if (idx === 2) return { text: '答题能手', cls: 'brave' };
    if (idx < Math.ceil(total * 0.3)) return { text: '答题新星', cls: 'rising' };
    return { text: '答题学员', cls: 'starter' };
  }

  // Top 3 podium
  const top3 = allList.slice(0, 3);
  const podiumOrder = [1, 0, 2];
  let podiumHtml = '<div class="podium-section">';
  podiumOrder.forEach(pi => {
    const item = top3[pi];
    if (!item) return;
    const cls = ['gold', 'silver', 'bronze'][pi];
    const crown = pi === 0 ? '<div class="podium-crown">👑</div>' : '';
    const medalNum = pi + 1;
    // 获取学生宠物头像
    const activePet = getActivePet(item.student);
    const petAvatar = activePet ? getPetImage(activePet.name, activePet.level || 1) : '<span style="font-size:36px;">📝</span>';
    podiumHtml += `<div class="podium-slot ${cls}">
      <div class="podium-avatar-wrap">
        ${crown}
        <div class="podium-avatar">${petAvatar}<div class="podium-medal">${medalNum}</div></div>
      </div>
      <div class="podium-name">${esc(item.name)}</div>
      <div class="podium-pet-name">${item.totalCoins} 金币</div>
      <div class="podium-pillar">
        <div class="podium-rank-num">${medalNum}</div>
        <div class="podium-growth-val">${item.totalCoins} 金币</div>
      </div>
    </div>`;
  });
  podiumHtml += '</div><div class="podium-base"></div>';
  if (topThreeEl) topThreeEl.innerHTML = podiumHtml;

  // Full list
  if (fullListEl) {
    let listHtml = '<div class="full-rank-section"><div class="full-rank-title">📊 全班排行</div><div class="rank-list">';
    allList.forEach((item, idx) => {
      const topCls = idx === 0 ? 'top1' : idx === 1 ? 'top2' : idx === 2 ? 'top3' : '';
      const pct = Math.round((item.totalCoins / maxCoins) * 100);
      const title = getQuizRankTitle(idx, allList.length);
      // 获取学生宠物头像
      const activePet = getActivePet(item.student);
      const petAvatar = activePet ? getPetImage(activePet.name, activePet.level || 1) : '<span style="font-size:22px;">📝</span>';
      listHtml += `<div class="rank-row ${topCls}">
        <div class="rank-num">${idx + 1}</div>
        <div class="rank-row-avatar">${petAvatar}</div>
        <div class="rank-row-info">
          <div class="rank-row-name">${esc(item.name)} <span class="rank-title-badge ${title.cls}">${title.text}</span></div>
          <div class="rank-row-pet">累计获得 ${item.totalCoins} 金币</div>
          <div class="rank-progress-wrap">
            <div class="rank-progress-bar"><div class="rank-progress-fill" style="width:${pct}%;background:linear-gradient(90deg,#ffd700,#ffaa00);"></div></div>
            <div class="rank-growth-num">${item.totalCoins} 金币</div>
          </div>
        </div>
      </div>`;
    });
    listHtml += '</div></div>';
    fullListEl.innerHTML = listHtml;
  }
}
window.renderQuizRanking = renderQuizRanking;

// ========== 小猪快跑排行榜 ==========
function renderPigRunRanking() {
  const cur = classesData.find(c => c.id === currentClassId);
  if (!cur) return;
  const topThreeEl = document.getElementById('pigRunTopThree');
  const fullListEl = document.getElementById('fullPigRunRankList');
  const emptyHint = document.getElementById('pigRunRankEmptyHint');
  const statsBar = document.getElementById('rankPigRunStatsBar');

  // 新数据结构：quizState.pigRunLevels = { "1": {bestScore, bestTime, coinsEarned, cleared}, ... }
  // quizState.pigRunTotalScore = 所有关卡 bestScore 之和
  const allList = cur.students.map(s => {
    var qs = s.quizState || {};
    var pigRunLevels = qs.pigRunLevels || {};
    var totalScore = qs.pigRunTotalScore || 0;
    // 兼容旧数据
    if (totalScore === 0 && qs.pigRunScore) totalScore = qs.pigRunScore;
    var clearedCount = Object.keys(pigRunLevels).filter(k => pigRunLevels[k] && pigRunLevels[k].cleared).length;
    var maxLevel = 0;
    Object.keys(pigRunLevels).forEach(k => {
      var lv = parseInt(k);
      if (pigRunLevels[k] && pigRunLevels[k].cleared && lv > maxLevel) maxLevel = lv;
    });
    return {
      name: s.name,
      totalScore: totalScore,
      clearedLevels: clearedCount,
      maxLevel: maxLevel,
      student: s
    };
  }).filter(x => x.totalScore > 0 || x.clearedLevels > 0).sort((a, b) => b.totalScore - a.totalScore);

  if (allList.length === 0) {
    if (topThreeEl) topThreeEl.innerHTML = '';
    if (fullListEl) fullListEl.innerHTML = '';
    if (statsBar) statsBar.innerHTML = '';
    if (emptyHint) emptyHint.style.display = 'block';
    return;
  }
  if (emptyHint) emptyHint.style.display = 'none';

  const maxScore = allList[0]?.totalScore || 1;
  const totalStudents = cur.students.length;
  const totalScoreAll = allList.reduce((s, x) => s + x.totalScore, 0);

  if (statsBar) {
    statsBar.innerHTML = `<div class="rank-stats-banner">
      <div class="rank-stat-chip"><div class="chip-num">${totalStudents}</div><div class="chip-label">班级人数</div></div>
      <div class="rank-stat-chip"><div class="chip-num">${allList.length}</div><div class="chip-label">上榜人数</div></div>
      <div class="rank-stat-chip"><div class="chip-num">${totalScoreAll}</div><div class="chip-label">全班总分</div></div>
    </div>`;
  }

  function getPigRunRankTitle(idx, total) {
    if (idx === 0) return { text: '跑猪王者', cls: 'champion' };
    if (idx === 1) return { text: '跑猪达人', cls: 'elite' };
    if (idx === 2) return { text: '跑猪能手', cls: 'brave' };
    if (idx < Math.ceil(total * 0.3)) return { text: '跑猪新星', cls: 'rising' };
    return { text: '跑猪学员', cls: 'starter' };
  }

  const top3 = allList.slice(0, 3);
  const podiumOrder = [1, 0, 2];
  let podiumHtml = '<div class="podium-section">';
  podiumOrder.forEach(pi => {
    const item = top3[pi];
    if (!item) return;
    const cls = ['gold', 'silver', 'bronze'][pi];
    const crown = pi === 0 ? '<div class="podium-crown">👑</div>' : '';
    const medalNum = pi + 1;
    // 获取学生宠物头像
    const activePet = getActivePet(item.student);
    const petAvatar = activePet ? getPetImage(activePet.name, activePet.level || 1) : '<span style="font-size:36px;">🐷</span>';
    podiumHtml += `<div class="podium-slot ${cls}">
      <div class="podium-avatar-wrap">
        ${crown}
        <div class="podium-avatar">${petAvatar}<div class="podium-medal">${medalNum}</div></div>
      </div>
      <div class="podium-name">${esc(item.name)}</div>
      <div class="podium-pet-name">第${item.maxLevel}关 · ${item.totalScore}分</div>
      <div class="podium-pillar">
        <div class="podium-rank-num">${medalNum}</div>
        <div class="podium-growth-val">${item.totalScore}分 · ${item.clearedLevels}关</div>
      </div>
    </div>`;
  });
  podiumHtml += '</div><div class="podium-base"></div>';
  if (topThreeEl) topThreeEl.innerHTML = podiumHtml;

  if (fullListEl) {
    let listHtml = '<div class="full-rank-section"><div class="full-rank-title">📊 全班排行</div><div class="rank-list">';
    allList.forEach((item, idx) => {
      const topCls = idx === 0 ? 'top1' : idx === 1 ? 'top2' : idx === 2 ? 'top3' : '';
      const pct = Math.round((item.totalScore / maxScore) * 100);
      const title = getPigRunRankTitle(idx, allList.length);
      // 获取学生宠物头像
      const activePet = getActivePet(item.student);
      const petAvatar = activePet ? getPetImage(activePet.name, activePet.level || 1) : '<span style="font-size:22px;">🐷</span>';
      listHtml += `<div class="rank-row ${topCls}">
        <div class="rank-num">${idx + 1}</div>
        <div class="rank-row-avatar">${petAvatar}</div>
        <div class="rank-row-info">
          <div class="rank-row-name">${esc(item.name)} <span class="rank-title-badge ${title.cls}">${title.text}</span></div>
          <div class="rank-row-pet">第${item.maxLevel}关 · 通关${item.clearedLevels}关 · 总分 ${item.totalScore}分</div>
          <div class="rank-progress-wrap">
            <div class="rank-progress-bar"><div class="rank-progress-fill" style="width:${pct}%;background:linear-gradient(90deg,#52c41a,#389e0d);"></div></div>
            <div class="rank-growth-num">${item.totalScore}分</div>
          </div>
        </div>
      </div>`;
    });
    listHtml += '</div></div>';
    fullListEl.innerHTML = listHtml;
  }
}
window.renderPigRunRanking = renderPigRunRanking;

// ========== 宠物消消乐排行榜 ==========
function renderMatch3Ranking() {
  const cur = classesData.find(c => c.id === currentClassId);
  if (!cur) return;
  const topThreeEl = document.getElementById('match3TopThree');
  const fullListEl = document.getElementById('fullMatch3RankList');
  const emptyHint = document.getElementById('match3RankEmptyHint');
  const statsBar = document.getElementById('rankMatch3StatsBar');

  const allList = cur.students.map(s => {
    var qs = s.quizState || {};
    var match3Levels = qs.match3Levels || {};
    var totalScore = qs.match3TotalScore || 0;
    var clearedCount = Object.keys(match3Levels).filter(k => match3Levels[k] && match3Levels[k].cleared).length;
    var maxLevel = 0;
    Object.keys(match3Levels).forEach(k => {
      var lv = parseInt(k);
      if (match3Levels[k] && match3Levels[k].cleared && lv > maxLevel) maxLevel = lv;
    });
    return { name: s.name, totalScore: totalScore, clearedLevels: clearedCount, maxLevel: maxLevel, student: s };
  }).filter(x => x.totalScore > 0 || x.clearedLevels > 0).sort((a, b) => b.totalScore - a.totalScore);

  if (allList.length === 0) {
    if (topThreeEl) topThreeEl.innerHTML = '';
    if (fullListEl) fullListEl.innerHTML = '';
    if (statsBar) statsBar.innerHTML = '';
    if (emptyHint) emptyHint.style.display = 'block';
    return;
  }
  if (emptyHint) emptyHint.style.display = 'none';

  const maxScore = allList[0]?.totalScore || 1;
  const totalStudents = cur.students.length;
  const totalScoreAll = allList.reduce((s, x) => s + x.totalScore, 0);

  if (statsBar) {
    statsBar.innerHTML = '<div class="rank-stats-banner"><div class="rank-stat-chip"><div class="chip-num">' + totalStudents + '</div><div class="chip-label">班级人数</div></div><div class="rank-stat-chip"><div class="chip-num">' + allList.length + '</div><div class="chip-label">上榜人数</div></div><div class="rank-stat-chip"><div class="chip-num">' + totalScoreAll + '</div><div class="chip-label">全班总分</div></div></div>';
  }

  function getMatch3RankTitle(idx, total) {
    if (idx === 0) return { text: '消消乐王者', cls: 'champion' };
    if (idx === 1) return { text: '消消乐达人', cls: 'elite' };
    if (idx === 2) return { text: '消消乐能手', cls: 'brave' };
    if (idx < Math.ceil(total * 0.3)) return { text: '消消乐新星', cls: 'rising' };
    return { text: '消消乐学员', cls: 'starter' };
  }

  const top3 = allList.slice(0, 3);
  const podiumOrder = [1, 0, 2];
  let podiumHtml = '<div class="podium-section">';
  podiumOrder.forEach(pi => {
    const item = top3[pi];
    if (!item) return;
    const cls = ['gold', 'silver', 'bronze'][pi];
    const crown = pi === 0 ? '<div class="podium-crown">👑</div>' : '';
    const medalNum = pi + 1;
    const activePet = getActivePet(item.student);
    const petAvatar = activePet ? getPetImage(activePet.name, activePet.level || 1) : '<span style="font-size:36px;">🧩</span>';
    podiumHtml += '<div class="podium-slot ' + cls + '"><div class="podium-avatar-wrap">' + crown + '<div class="podium-avatar">' + petAvatar + '<div class="podium-medal">' + medalNum + '</div></div></div><div class="podium-name">' + esc(item.name) + '</div><div class="podium-pet-name">第' + item.maxLevel + '关 · ' + item.totalScore + '分</div><div class="podium-pillar"><div class="podium-rank-num">' + medalNum + '</div><div class="podium-growth-val">' + item.totalScore + '分 · ' + item.clearedLevels + '关</div></div></div>';
  });
  podiumHtml += '</div><div class="podium-base"></div>';
  if (topThreeEl) topThreeEl.innerHTML = podiumHtml;

  if (fullListEl) {
    let listHtml = '<div class="full-rank-section"><div class="full-rank-title">📊 全班排行</div><div class="rank-list">';
    allList.forEach((item, idx) => {
      const topCls = idx === 0 ? 'top1' : idx === 1 ? 'top2' : idx === 2 ? 'top3' : '';
      const pct = Math.round((item.totalScore / maxScore) * 100);
      const title = getMatch3RankTitle(idx, allList.length);
      const activePet = getActivePet(item.student);
      const petAvatar = activePet ? getPetImage(activePet.name, activePet.level || 1) : '<span style="font-size:22px;">🧩</span>';
      listHtml += '<div class="rank-row ' + topCls + '"><div class="rank-num">' + (idx + 1) + '</div><div class="rank-row-avatar">' + petAvatar + '</div><div class="rank-row-info"><div class="rank-row-name">' + esc(item.name) + ' <span class="rank-title-badge ' + title.cls + '">' + title.text + '</span></div><div class="rank-row-pet">第' + item.maxLevel + '关 · 通关' + item.clearedLevels + '关 · 总分 ' + item.totalScore + '分</div><div class="rank-progress-wrap"><div class="rank-progress-bar"><div class="rank-progress-fill" style="width:' + pct + '%;background:linear-gradient(90deg,#764ba2,#667eea);"></div></div><div class="rank-growth-num">' + item.totalScore + '分</div></div></div></div>';
    });
    listHtml += '</div></div>';
    fullListEl.innerHTML = listHtml;
  }
}
window.renderMatch3Ranking = renderMatch3Ranking;

function renderHappyRunRanking() {
  const cur = classesData.find(c => c.id === currentClassId);
  if (!cur) return;
  const topThreeEl = document.getElementById('happyRunTopThree');
  const fullListEl = document.getElementById('fullHappyRunRankList');
  const emptyHint = document.getElementById('happyRunRankEmptyHint');
  const statsBar = document.getElementById('rankHappyRunStatsBar');

    const allList = cur.students.map(s => {
    var qs = s.quizState || {};
    var happyRunLevels = qs.happyRunLevels || {};
    var totalSilver = qs.happyRunTotalSilver || qs.happyRunTotalScore || 0;
    var clearedCount = Object.keys(happyRunLevels).filter(k => happyRunLevels[k] && happyRunLevels[k].cleared).length;
    var maxLevel = qs.happyRunMaxLevel || 0;
    if (maxLevel === 0) {
      Object.keys(happyRunLevels).forEach(k => {
        var lv = parseInt(k);
        if (happyRunLevels[k] && happyRunLevels[k].cleared && lv > maxLevel) maxLevel = lv;
      });
    }
    return { name: s.name, totalScore: totalSilver, clearedLevels: clearedCount, maxLevel: maxLevel, student: s };
  }).filter(x => x.totalScore > 0 || x.clearedLevels > 0).sort((a, b) => b.totalScore - a.totalScore);

  if (allList.length === 0) {
    if (topThreeEl) topThreeEl.innerHTML = '';
    if (fullListEl) fullListEl.innerHTML = '';
    if (statsBar) statsBar.innerHTML = '';
    if (emptyHint) emptyHint.style.display = 'block';
    return;
  }
  if (emptyHint) emptyHint.style.display = 'none';

  const maxScore = allList[0]?.totalScore || 1;
  const totalStudents = cur.students.length;
  const totalScoreAll = allList.reduce((s, x) => s + x.totalScore, 0);

  if (statsBar) {
    statsBar.innerHTML = '<div class="rank-stats-banner"><div class="rank-stat-chip"><div class="chip-num">' + totalStudents + '</div><div class="chip-label">班级人数</div></div><div class="rank-stat-chip"><div class="chip-num">' + allList.length + '</div><div class="chip-label">上榜人数</div></div><div class="rank-stat-chip"><div class="chip-num">' + totalScoreAll + '</div><div class="chip-label">全班总分</div></div></div>';
  }

  function getHappyRunRankTitle(idx, total) {
    if (idx === 0) return { text: '快乐跑王者', cls: 'champion' };
    if (idx === 1) return { text: '快乐跑达人', cls: 'elite' };
    if (idx === 2) return { text: '快乐跑能手', cls: 'brave' };
    if (idx < Math.ceil(total * 0.3)) return { text: '快乐跑新星', cls: 'rising' };
    return { text: '快乐跑学员', cls: 'starter' };
  }

  const top3 = allList.slice(0, 3);
  const podiumOrder = [1, 0, 2];
  let podiumHtml = '<div class="podium-section">';
  podiumOrder.forEach(pi => {
    const item = top3[pi];
    if (!item) return;
    const cls = ['gold', 'silver', 'bronze'][pi];
    const crown = pi === 0 ? '<div class="podium-crown">👑</div>' : '';
    const medalNum = pi + 1;
    const activePet = getActivePet(item.student);
    const petAvatar = activePet ? getPetImage(activePet.name, activePet.level || 1) : '<span style="font-size:36px;">🏃</span>';
    podiumHtml += '<div class="podium-slot ' + cls + '"><div class="podium-avatar-wrap">' + crown + '<div class="podium-avatar">' + petAvatar + '<div class="podium-medal">' + medalNum + '</div></div></div><div class="podium-name">' + esc(item.name) + '</div><div class="podium-pet-name">第' + item.maxLevel + '关 · ' + item.totalScore + '银币</div><div class="podium-pillar"><div class="podium-rank-num">' + medalNum + '</div><div class="podium-growth-val">' + item.totalScore + '银币 · ' + item.clearedLevels + '关</div></div></div>';
  });
  podiumHtml += '</div><div class="podium-base"></div>';
  if (topThreeEl) topThreeEl.innerHTML = podiumHtml;

  if (fullListEl) {
    let listHtml = '<div class="full-rank-section"><div class="full-rank-title">📊 全班排行</div><div class="rank-list">';
    allList.forEach((item, idx) => {
      const topCls = idx === 0 ? 'top1' : idx === 1 ? 'top2' : idx === 2 ? 'top3' : '';
      const pct = Math.round((item.totalScore / maxScore) * 100);
      const title = getHappyRunRankTitle(idx, allList.length);
      const activePet = getActivePet(item.student);
      const petAvatar = activePet ? getPetImage(activePet.name, activePet.level || 1) : '<span style="font-size:22px;">🏃</span>';
      listHtml += '<div class="rank-row ' + topCls + '"><div class="rank-num">' + (idx + 1) + '</div><div class="rank-row-avatar">' + petAvatar + '</div><div class="rank-row-info"><div class="rank-row-name">' + esc(item.name) + ' <span class="rank-title-badge ' + title.cls + '">' + title.text + '</span></div><div class="rank-row-pet">第' + item.maxLevel + '关 · 通关' + item.clearedLevels + '关 · 总银币 ' + item.totalScore + '</div><div class="rank-progress-wrap"><div class="rank-progress-bar"><div class="rank-progress-fill" style="width:' + pct + '%;background:linear-gradient(90deg,#f093fb,#f5576c);"></div></div><div class="rank-growth-num">' + item.totalScore + '银币</div></div></div></div>';
    });
    listHtml += '</div></div>';
    fullListEl.innerHTML = listHtml;
  }
}
window.renderHappyRunRanking = renderHappyRunRanking;
