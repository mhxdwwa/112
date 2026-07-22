// ========== 渲染批处理系统 — 合并多次同步渲染为单次 rAF，解决点击延迟 ==========
let _renderBatchPending = false;
let _renderBatchFlags = 0;
const _RF_GRID = 1, _RF_TOP3 = 2, _RF_PK = 4, _RF_CLASSLIST = 8, _RF_JH = 16;
function scheduleRender(flags) {
  _renderBatchFlags |= flags;
  if (_renderBatchPending) return;
  _renderBatchPending = true;
  requestAnimationFrame(() => {
    _renderBatchPending = false;
    const f = _renderBatchFlags;
    _renderBatchFlags = 0;
    if (f & _RF_GRID) renderHomePetGrid();
    if (f & _RF_TOP3) renderClassTopThree();
    if (f & _RF_PK) renderPKPage();
    if (f & _RF_CLASSLIST) renderClassList();
    if (f & _RF_JH) renderJianghuPage();
  });
}
function scheduleAllRenders() {
  // 始终渲染当前可见页面 + 成长榜（数据共享）
  scheduleRender(_RF_GRID | _RF_TOP3);
  // 只在页面可见时渲染 PK 和江湖行页面
  var pkPage = document.getElementById('pk-page');
  var jhPage = document.getElementById('jianghu-page');
  if (pkPage && pkPage.classList.contains('active')) scheduleRender(_RF_PK);
  if (jhPage && jhPage.classList.contains('active')) scheduleRender(_RF_JH);
}

// ========== 性能优化：低端设备检测与降级 ==========
(function(){
  var isLowEnd = false;
  // 检测低端设备：内存少、CPU核心少、或触屏旧设备
  if(navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) isLowEnd = true;
  if(navigator.deviceMemory && navigator.deviceMemory <= 4) isLowEnd = true;
  // 帧率检测：如果前30帧平均低于45fps，启用降级
  var _perfFrames = [], _perfStart = 0, _perfChecked = false;
  function _perfCheck(ts){
    if(_perfChecked) return;
    if(!_perfStart){ _perfStart = ts; requestAnimationFrame(_perfCheck); return; }
    _perfFrames.push(ts);
    if(_perfFrames.length < 30){ requestAnimationFrame(_perfCheck); return; }
    _perfChecked = true;
    var elapsed = _perfFrames[_perfFrames.length-1] - _perfFrames[0];
    var avgFps = (_perfFrames.length - 1) / (elapsed / 1000);
    if(avgFps < 30) isLowEnd = true;
    if(isLowEnd) document.documentElement.classList.add('low-end-device');
  }
  requestAnimationFrame(_perfCheck);
  // 标记已知低端设备
  if(isLowEnd) document.documentElement.classList.add('low-end-device');
  // 低端设备降级CSS已移至静态<style>中，无需运行时注入
})();

// ========== 首次交互预热 AudioContext，避免首次点击音效延迟 ==========
function _prewarmAudio() {
  if(!audioCtx) initAudio();
  if(audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  document.removeEventListener('click', _prewarmAudio);
  document.removeEventListener('touchstart', _prewarmAudio);
  document.removeEventListener('keydown', _prewarmAudio);
}
document.addEventListener('click', _prewarmAudio, {once:true, passive:true});
document.addEventListener('touchstart', _prewarmAudio, {once:true, passive:true});
document.addEventListener('keydown', _prewarmAudio, {once:true, passive:true});

// ========== 爱心特效核心函数 ==========
let activeHeartInterval = null;
let activeHeartContainer = null;
function stopAllHeartEmitters() { if(activeHeartInterval) { clearInterval(activeHeartInterval); activeHeartInterval = null; activeHeartContainer = null; } }
function isPetAlive(container) { if (container.querySelector('.dead-pet-overlay')) return false; const card = container.closest('.home-pet-card, .modal-pet-img, .rank-avatar-small'); if (card && card.querySelector('.dead-pet-overlay')) return false; return true; }
function getMouthPosition(container) { let targetImg = container.querySelector('img'); if (!targetImg) { const fallbackRect = container.getBoundingClientRect(); if (fallbackRect.width > 0) return { x: fallbackRect.left + fallbackRect.width * 0.5, y: fallbackRect.top + fallbackRect.height * 0.7 }; return null; } const rect = targetImg.getBoundingClientRect(); if (rect.width === 0 || rect.height === 0) return null; const x = rect.left + rect.width * 0.5; const y = rect.top + rect.height * 0.7; return { x, y }; }
function emitHeart(container) { if (!container.isConnected) { stopAllHeartEmitters(); return false; } if (!isPetAlive(container)) return false; const pos = getMouthPosition(container); if (!pos) return false; const heart = document.createElement('div'); heart.className = 'heart-float'; heart.innerHTML = '❤️'; heart.style.left = pos.x + 'px'; heart.style.top = pos.y + 'px'; heart.style.fontSize = (18 + Math.random() * 8) + 'px'; document.body.appendChild(heart); heart.addEventListener('animationend', () => heart.remove()); return true; }
function startHeartForContainer(container) { if (!container) return; stopAllHeartEmitters(); activeHeartContainer = container; var _isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches; var heartDelay = (_isReducedMotion || document.documentElement.classList.contains('low-end-device')) ? 1200 : 580; activeHeartInterval = setInterval(() => { if (!activeHeartContainer || !activeHeartContainer.isConnected) { stopAllHeartEmitters(); return; } emitHeart(activeHeartContainer); }, heartDelay); }
function findPetContainerByStudentId(studentId) { const modalImg = document.querySelector('#modalContainer .modal-pet-img'); if (modalImg && modalImg.isConnected) return modalImg; const cards = document.querySelectorAll('.home-pet-card'); for (let card of cards) { const onclickAttr = card.getAttribute('onclick'); if (onclickAttr && onclickAttr.includes(`openStudentModal('${studentId}')`)) { const topDiv = card.querySelector('.home-pet-top'); if (topDiv) return topDiv; } } return null; }
function startHeartForCurrentPet(studentId) { if (!studentId) { stopAllHeartEmitters(); return; } const cur = classesData?.find(c=>c.id===currentClassId); if(!cur) return; const student = cur.students.find(s=>s.id.toString()===studentId.toString()); if(!student) return; const activePet = getActivePet(student); if(!activePet || activePet.isDead) { stopAllHeartEmitters(); return; } const targetContainer = findPetContainerByStudentId(studentId); if(targetContainer) startHeartForContainer(targetContainer); else stopAllHeartEmitters(); }

// ========== 原有核心逻辑（宠物系统、班级管理等）==========

// 安全读取 localStorage，防止数据损坏导致白屏
let classesData = [], currentClassId = null, selectedPetName = null, currentModalStudentId = null;
try { classesData = JSON.parse(localStorage.getItem('classPetData')) || []; } catch(e) { console.warn('classPetData读取失败，已重置:', e.message); localStorage.removeItem('classPetData'); }
let deletedClasses = [];
try { deletedClasses = JSON.parse(localStorage.getItem('deletedClasses')) || []; } catch(e) { console.warn('deletedClasses读取失败，已重置:', e.message); localStorage.removeItem('deletedClasses'); }
let customActions = [];
try { customActions = JSON.parse(localStorage.getItem('customActions')) || []; } catch(e) { console.warn('customActions读取失败，已重置:', e.message); localStorage.removeItem('customActions'); }
const neededPresets = [{id: 'sys_reward_1', name: '完成作业', coins: 10},{id: 'sys_reward_2', name: '课堂发言', coins: 10}];
neededPresets.forEach(preset => { if (!customActions.some(a => a.id === preset.id)) customActions.push(preset); });
function safeLSSave(key, data){ try{ localStorage.setItem(key, JSON.stringify(data)); }catch(e){ console.warn('localStorage写入失败('+key+'):', e.message); try{ localStorage.removeItem('logArchives'); localStorage.removeItem('operationLogs'); localStorage.setItem(key, JSON.stringify(data)); }catch(e2){ console.warn('localStorage清理后仍失败，跳过本地缓存'); } } }
// ===== 安全整数ID生成器 =====
// 生成负整数ID，明确区分本地临时ID与Supabase自增ID（正整数）
// 负数ID永远不会被误认为有效的Supabase ID
var _idCounter = 0;
function _genLocalId(){ return -(Date.now() * 1000 + ((_idCounter = (_idCounter + 1) % 1000))); }
function saveCustomActions(){safeLSSave('customActions', customActions); scheduleFileSave();}
saveCustomActions();
// v16: SINGLE SOURCE OF TRUTH — operationLogs lives on window only.
// All reads/writes go through window.operationLogs to eliminate cross-script scope bugs.
window.operationLogs = [];
try { window.operationLogs = JSON.parse(localStorage.getItem('operationLogs')) || []; } catch(e) { console.warn('operationLogs读取失败，已重置:', e.message); localStorage.removeItem('operationLogs'); }
// v16: Helper to get operation logs — always reads from window.operationLogs
function getOpLogs() { return window.operationLogs || []; }
// v16: Helper to sync the alias after any reassignment (kept for backward compat)
function _syncOpLogsAlias() { /* no-op: we always use window.operationLogs now */ }
// v16: Helper to push window.operationLogs after local reassignment (kept for backward compat)
function _pushOpLogsToWindow() { /* no-op: we always use window.operationLogs now */ }
let logArchives = {};
try { logArchives = JSON.parse(localStorage.getItem('logArchives')) || {}; } catch(e) { console.warn('logArchives读取失败，已重置:', e.message); localStorage.removeItem('logArchives'); }
function _getLogMonth(log){return log.timestamp?log.timestamp.slice(0,7):'';}
function _getCurrentMonth(){return new Date().toISOString().slice(0,7);}
function archiveOldLogs(){
  const curMonth=_getCurrentMonth();
  const keepLogs=[];
  let changed=false;
  // v15: Use window.operationLogs for cross-script consistency
  var logs = getOpLogs();
  logs.forEach(log=>{
    const m=_getLogMonth(log);
    if(m && m<curMonth){
      if(!logArchives[m]) logArchives[m]=[];
      logArchives[m].push(log);
      changed=true;
    } else {
      keepLogs.push(log);
    }
  });
  if(changed){
    window.operationLogs=keepLogs;
    safeLSSave('operationLogs', window.operationLogs);
    safeLSSave('logArchives', logArchives);
  }
}
// v25: Removed archiveOldLogs() from init — it was archiving logs before Supabase
// data was loaded, causing data loss on page refresh. The function is kept for
// backward compatibility but should not be called automatically.
// v13: Debounced real-time sync — trigger immediate sync after any data change
let _syncDebounceTimer = null;
function triggerRealtimeSync() {
  if (typeof _syncToSupabase !== 'function') return;
  if (_syncDebounceTimer) clearTimeout(_syncDebounceTimer);
  _syncDebounceTimer = setTimeout(function() {
    _syncDebounceTimer = null;
    _syncToSupabase();
  }, 50); // v15: 50ms debounce — near-instant real-time sync
}
// v25: Removed archiveOldLogs() from save flow — it was silently moving logs
// out of window.operationLogs into logArchives on every save, causing the visible
// log count to decrease. Archiving is no longer needed since _loadOperationLogs()
// loads ALL logs from Supabase and getAllLogsForMonth() includes archived logs.
function saveLogs(){
  safeLSSave('operationLogs', window.operationLogs);
  scheduleFileSave();
  triggerRealtimeSync();
  // v70: ALSO write unsynced logs to Supabase IMMEDIATELY (independent of data sync).
  // Previously, logs were only written AFTER the data sync completed. If the data sync
  // was slow or already in progress, logs were delayed — causing "history doesn't update" bugs.
  if (typeof _writeUnsyncedLogsToSupabase === 'function') {
    try { _writeUnsyncedLogsToSupabase(); } catch(e) { console.warn('[v70] immediate log write failed:', e); }
  }
}
function saveArchives(){safeLSSave('logArchives', logArchives); scheduleFileSave();}
function getAllLogsForMonth(month){
  var logs = getOpLogs();
  var matched = logs.filter(function(l) { return _getLogMonth(l) === month; });
  // v25: Also include archived logs — archiveOldLogs() moves old logs to logArchives
  // but the history modal must still show them when the user selects that month
  if (logArchives && logArchives[month]) {
    matched = matched.concat(logArchives[month]);
    matched.sort(function(a, b) { return (b.timestamp || '').localeCompare(a.timestamp || ''); });
  }
  return matched;
}
function getAvailableMonths(){
  const months=new Set();
  var logs = getOpLogs();
  logs.forEach(l=>{const m=_getLogMonth(l);if(m)months.add(m);});
  Object.keys(logArchives).forEach(m=>months.add(m));
  return [...months].sort().reverse();
}
let _currentHistoryMonth = null;
let _historyFilterStudentId = null; // 历史操作筛选：选中的学生ID（null表示不筛选）
let _historyFilterEnabled = false;  // 历史操作筛选：是否启用筛选

/* ========== 桌面 EXE 模式：通过 pywebview Python 桥接读写文件 ========== */

function recordAction(studentId, studentName, actionType, details, coinDelta, expDelta, petId, extra = null){
  if(coinDelta === 0 && expDelta === 0 && !extra) return;
  const cur = classesData.find(c=>c.id===currentClassId);
  let snapshot = null;
  // v80: Build summary for extra field (for history display without loading snapshot)
  let summary = {};
  if(cur){
    const stu = cur.students.find(s=>s.id.toString()===studentId.toString());
    if(stu){
      const pet = petId ? (stu.pets||[]).find(p=>p.id===petId) : getActivePet(stu);
      snapshot = { coinsBefore: stu.coins - (coinDelta||0), coinsAfter: stu.coins };
      // v80: Store summary in extra for history display
      summary.coinsBefore = snapshot.coinsBefore;
      summary.coinsAfter = snapshot.coinsAfter;
      if(pet){
        snapshot.petNick = pet.nickname||pet.name;
        snapshot.petRealName = pet.name;
        snapshot.petLevel = pet.level;
        snapshot.growthBefore = Math.max(0, (pet.growth||0) - (expDelta||0));
        snapshot.growthAfter = pet.growth||0;
        snapshot.isDead = pet.isDead||false;
        snapshot.penaltyStreak = pet.penaltyStreak||0;
        const cfg = PET_CONFIG[pet.name];
        if(cfg){ const stg = cfg.stages.find(s=>s.stage===pet.level); snapshot.stageName = stg ? stg.stageName : '阶段'+pet.level; }
        // v80: Store pet summary in extra
        summary.petNick = snapshot.petNick;
        summary.petLevel = snapshot.petLevel;
        summary.stageName = snapshot.stageName;
        summary.growthBefore = snapshot.growthBefore;
        summary.growthAfter = snapshot.growthAfter;
        summary.isDead = snapshot.isDead;
        summary.penaltyStreak = snapshot.penaltyStreak;
      }
      // v45: Expand snapshot with complete quizState for point-in-time recovery
      // Stores full pigRunLevels dict so "恢复到此" can restore all levels at once
      if(stu.quizState){
        const qs = stu.quizState;
        snapshot.quizStateSnapshot = {
          pigRunLevels: qs.pigRunLevels ? JSON.parse(JSON.stringify(qs.pigRunLevels)) : {},
          pigRunTotalScore: qs.pigRunTotalScore || 0,
          pigRunTools: qs.pigRunTools ? JSON.parse(JSON.stringify(qs.pigRunTools)) : {},
          totalQuizCoins: qs.totalQuizCoins || 0,
          todayCoins: qs.todayCoins || 0
        };
      }
    }
  }
  // v80: Merge summary into extra (preserve existing extra fields like shopItemId, pkType, etc.)
  if(Object.keys(summary).length > 0){
    extra = Object.assign({}, extra || {}, summary);
  }
  // v79: Store timestamp in UTC format (ISO string) to match Supabase's created_at format.
  // This fixes deduplication issues where local time vs UTC caused duplicate log entries.
  // Display code uses toLocaleString with timeZone:'Asia/Shanghai' to convert UTC to Beijing time.
  const log = {
    id: _genLocalId(), timestamp: new Date().toISOString(),
    classId: currentClassId, studentId, studentName, actionType, details,
    coinDelta, expDelta, petId, extra, snapshot, reverted: false, _synced: false
  };
  // v16: Push to window.operationLogs — the single source of truth
  window.operationLogs.push(log);
  saveLogs();
}
function recordResetAction(classId, className, fullSnapshot){ 
  // v80: Add summary to extra for history display
  const extra = { resetStudentCount: fullSnapshot.length };
  const log = { 
    id: _genLocalId(), 
    timestamp: new Date().toISOString(), 
    classId: classId, 
    studentId: classId, 
    studentName: className, 
    actionType: "重置班级宠物", 
    details: `重置班级【${className}】所有宠物数据（${fullSnapshot.length}名学生）`, 
    fullSnapshot: JSON.parse(JSON.stringify(fullSnapshot)), 
    coinDelta: 0, 
    expDelta: 0, 
    extra: extra,
    reverted: false, 
    _synced: false 
  }; 
  window.operationLogs.push(log); 
  saveLogs(); 
}
function _recalcPetLevel(pet){ const cfg = PET_CONFIG[pet.name]; if(cfg){ let newLevel = 1; for(let i=cfg.stages.length-1;i>=0;i--) if(pet.growth>=cfg.stages[i].growthRequired){ newLevel=cfg.stages[i].stage; break; } pet.level = newLevel; } }
function _revertStudentLog(curClass, log){ const student = curClass.students.find(s=>s.id.toString()===log.studentId.toString()); if(!student) return; let pet = null; if(log.petId && student.pets) pet = student.pets.find(p=>p.id===log.petId); if(!pet && student.pets.length>0) pet = getActivePet(student); if(log.coinDelta !== 0){ student.coins -= log.coinDelta; if(student.coins < 0) student.coins = 0; } if(log.expDelta !== 0 && pet){ pet.growth -= log.expDelta; if(pet.growth < 0) pet.growth = 0; _recalcPetLevel(pet); } if(log.extra && log.extra.causedDeath && pet){ pet.isDead = false; pet.deathGrowth = undefined; delete pet.deathDate; pet.penaltyStreak = 0; if(log.extra.starvation && log.extra.petSnapshot){ const snap=log.extra.petSnapshot; pet.level=snap.level; pet.growth=snap.growth; pet.lastFeedDate=snap.lastFeedDate; pet.todayFeedCount=snap.todayFeedCount||0; pet.todayPlayCount=snap.todayPlayCount||0; pet.lastPlayDate=snap.lastPlayDate; pet.penaltyStreak=snap.penaltyStreak||0; } else if(log.extra.prevGrowth !== undefined){ pet.growth = log.extra.prevGrowth; _recalcPetLevel(pet); } } if(log.extra && log.extra.shopItemId){ const itemId=log.extra.shopItemId; if(student.shopItems){ const idx=student.shopItems.indexOf(itemId); if(idx!==-1) student.shopItems.splice(idx,1); } unequipItem(student, itemId); } }
async function restoreToLogEntry(logId){
  var _logs = getOpLogs();
  const log = _logs.find(l => l.id === logId);
  if(!log) return;
  const curClass = classesData.find(c=>c.id===currentClassId);
  if(!curClass) return;
  const student = curClass.students.find(s=>s.id.toString()===log.studentId.toString());
  if(!student){ showNotification('恢复失败','未找到该学生', 'error'); return; }
  // v75: Fetch snapshot on demand if not already loaded
  let snap = log.snapshot;
  if(!snap && typeof _fetchLogSnapshot === 'function'){
    showNotification('加载中','正在获取快照数据...','info');
    snap = await _fetchLogSnapshot(logId);
    if(snap) log.snapshot = snap; // cache it in memory for subsequent clicks
  }
  if(!snap){ showNotification('恢复失败','该日志没有快照数据', 'error'); return; }
  if(!confirm(`确定将「${log.studentName}」的数据恢复到 ${log.timestamp} 的状态？\n这将覆盖当前的金币、成长值和小猪快跑数据。`)) return;
  // 1. Restore coins and pet growth
  if(snap.coinsAfter !== undefined) student.coins = snap.coinsAfter;
  const pet = (student.pets||[]).find(p=>p.id===log.petId) || getActivePet(student);
  if(pet && snap.growthAfter !== undefined){
    pet.growth = snap.growthAfter;
    if(snap.petLevel) pet.level = snap.petLevel;
    pet.isDead = snap.isDead||false;
    pet.penaltyStreak = snap.penaltyStreak||0;
    _recalcPetLevel(pet);
  }
  // 2. Restore quizState from snapshot
  if(snap.quizStateSnapshot){
    if(!student.quizState) student.quizState = {};
    const qsSnap = snap.quizStateSnapshot;
    student.quizState.pigRunLevels = JSON.parse(JSON.stringify(qsSnap.pigRunLevels || {}));
    student.quizState.pigRunTotalScore = qsSnap.pigRunTotalScore || 0;
    student.quizState.pigRunTools = JSON.parse(JSON.stringify(qsSnap.pigRunTools || {}));
    student.quizState.totalQuizCoins = qsSnap.totalQuizCoins || 0;
    student.quizState.todayCoins = qsSnap.todayCoins || 0;
  }
  // 3. Save to Supabase
  saveClassData();
  if(typeof _takeSnapshot === 'function') _takeSnapshot();
  scheduleAllRenders();
  if(currentModalStudentId && currentModalStudentId.toString()===log.studentId.toString()) refreshCurrentStudentModal();
  let detail = `已恢复「${log.studentName}」的数据到 ${new Date(log.timestamp).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai'})}`;
  if(snap.quizStateSnapshot){
    const qsSnap = snap.quizStateSnapshot;
    const levelCount = Object.keys(qsSnap.pigRunLevels||{}).length;
    if(levelCount > 0) detail += `\n小猪快跑: ${levelCount}关 / ${qsSnap.pigRunTotalScore}分`;
  }
  showNotification('恢复成功', detail, 'success');
}
async function revertToLog(logId){
  var _logs = getOpLogs();
  const log = _logs.find(l => l.id === logId);
  if(!log) return;
  if(log.reverted){ showNotification('无法撤销','该操作已被撤销过', 'warning'); return; }
  const curClass = classesData.find(c=>c.id===currentClassId);
  if(!curClass) return;
  // v75: Fetch snapshot on demand for display purposes (before/after values in notification)
  if(!log.snapshot && typeof _fetchLogSnapshot === 'function'){
    log.snapshot = await _fetchLogSnapshot(logId);
  }
  // 重置班级宠物：恢复完整快照
  if(log.fullSnapshot){
    curClass.students = JSON.parse(JSON.stringify(log.fullSnapshot));
    log.reverted = true;
    saveClassData(); saveLogs();
    scheduleAllRenders();
    if(currentModalStudentId) refreshCurrentStudentModal();
    showNotification('撤销成功', `已撤销「重置班级宠物」，${log.fullSnapshot.length}名学生数据已恢复`, 'success');
    return;
  }
  // PK胜负记录：同时回溯双方
  if(log.extra && log.extra.pkType && log.extra.pkType !== 'draw'){
    _revertStudentLog(curClass, log);
    const opponentId = log.extra.opponentId;
    const opponentPetId = log.extra.opponentPetId;
    const opponent = curClass.students.find(s=>s.id.toString()===opponentId.toString());
    if(opponent){
      opponent.coins -= log.extra.opponentCoinDelta;
      if(opponent.coins < 0) opponent.coins = 0;
      let opPet = null;
      if(opponentPetId && opponent.pets) opPet = opponent.pets.find(p=>p.id===opponentPetId);
      if(!opPet && opponent.pets.length>0) opPet = getActivePet(opponent);
      if(opPet && log.extra.opponentGrowthDelta !== 0){
        opPet.growth -= log.extra.opponentGrowthDelta;
        if(opPet.growth < 0) opPet.growth = 0;
        _recalcPetLevel(opPet);
      }
    }
    log.reverted = true;
    const pairLog = _logs.find(l => l.id !== logId && l.extra && l.extra.pkType && l.extra.opponentId && l.extra.opponentId.toString() === log.studentId.toString() && Math.abs(l.id - log.id) < 5);
    if(pairLog) pairLog.reverted = true;
    saveLogs(); saveClassData();
    scheduleAllRenders();
    if(currentModalStudentId) refreshCurrentStudentModal();
    showNotification('撤销成功', `已撤销 ${log.studentName} vs ${log.extra.opponentName} 的PK结果`, 'success');
    return;
  }
  // PK平局回溯：标记双方为已撤销
  if(log.extra && log.extra.pkType === 'draw'){
    log.reverted = true;
    const pairLog = _logs.find(l => l.id !== logId && l.extra && l.extra.pkType === 'draw' && l.extra.opponentId && l.extra.opponentId.toString() === log.studentId.toString() && Math.abs(l.id - log.id) < 5);
    if(pairLog) pairLog.reverted = true;
    saveLogs();
    showNotification('撤销成功', `已撤销 ${log.studentName} 的PK平局记录`, 'success');
    return;
  }
  // 普通记录：仅撤销该条操作，不影响其他记录
  _revertStudentLog(curClass, log);
  log.reverted = true;
  saveClassData(); saveLogs();
  scheduleAllRenders();
  if(currentModalStudentId && currentModalStudentId.toString()===log.studentId.toString()) refreshCurrentStudentModal();
  const snap = log.snapshot;
  let revertDetail = `已撤销 ${log.studentName} 的「${log.actionType}」`;
  if(snap){
    revertDetail += `\n金币: ${snap.coinsAfter} → ${snap.coinsBefore}`;
    if(snap.petNick && log.expDelta) revertDetail += `，${snap.petNick}成长: ${snap.growthAfter} → ${snap.growthBefore}`;
  }
  showNotification('撤销成功', revertDetail, 'success');
}
function _historyActionIcon(type){
  const icons = {'喂食':'🍖','玩耍':'🎾','散步':'🚶','逛街':'🛍️','复活':'💖','奖惩':'🏅','惩罚致死':'💀','饿死':'💀','商店购买':'🏪','PK胜利':'⚔️🏆','PK失败':'⚔️💔','PK平局':'⚔️🤝','全班打卡':'📋','每日打卡':'📋','全班喂食':'🍖👥','批量奖惩':'📦','重置班级宠物':'🔄','小猪快跑':'🐷','取金阁':'📝'};
  return icons[type]||'📝';
}
function _historyActionColor(type){
  if(type==='惩罚致死'||type==='饿死') return '#ff4444';
  if(type.includes('惩罚')||type==='PK失败') return '#e07050';
  if(type.includes('奖')||type==='PK胜利'||type==='全班打卡'||type==='每日打卡'||type==='小猪快跑'||type==='取金阁') return '#4a9e4a';
  if(type==='PK平局') return '#8888aa';
  if(type==='复活') return '#9b59b6';
  if(type==='商店购买') return '#8e44ad';
  if(type==='重置班级宠物') return '#cc6633';
  return '#886655';
}
var _isStudentHistoryView = false; // true when a student is viewing history
function showHistoryModal(){
  const curClass = classesData.find(c=>c.id===currentClassId);
  const className = curClass ? curClass.name : '未选择班级';
  // Detect if current user is a student
  _isStudentHistoryView = !!(typeof currentUser !== 'undefined' && currentUser && currentUser.type === 'student');

  // v11: First sync local logs to Supabase, then load, then show
  // This ensures all recent operations (from any account) are visible
  var showFn = function() {
    const months = getAvailableMonths();
    if(months.length===0){
      showModal(`📜 历史操作记录【${className}】`,
        '<div style="text-align:center;padding:30px;color:#bba;">该班级暂无操作记录</div>',
        [{text:'关闭',onclick:'closeModal()'}], false);
      return;
    }
    _currentHistoryMonth = months[0];
    // v74: Refresh backup count from Supabase before rendering
    _refreshBackupCountCache().then(function() {
      let html = _buildHistoryHTML(curClass, className, months, _currentHistoryMonth);
      showModal(`📜 历史操作记录【${className}】`, html, [{text:'关闭',onclick:'closeModal()'}], true);
    });
  };

  // v25: Step 1: Sync local unsynced logs to Supabase first
  // Use _writeUnsyncedLogsToSupabase (v24 function) instead of deleted _syncOperationLogsToSupabase
  var syncPromise = (typeof _writeUnsyncedLogsToSupabase === 'function')
    ? _writeUnsyncedLogsToSupabase()
    : Promise.resolve();

  // Step 2: Then load fresh logs from Supabase (merges with local)
  syncPromise.then(function() {
    if (typeof _loadOperationLogs === 'function') {
      return _loadOperationLogs();
    }
  }).then(function() {
    // v15: Ensure alias is synced after loading
    if (typeof _syncOpLogsAlias === 'function') { try { _syncOpLogsAlias(); } catch(e) {} }
    showFn();
  }).catch(function(e) {
    // v15: Sync alias even on error
    if (typeof _syncOpLogsAlias === 'function') { try { _syncOpLogsAlias(); } catch(e2) {} }
    console.warn('[History] Load error, showing with local data:', e);
    showFn(); // Always show modal, even if Supabase fails
  });
}
// v12: Refresh history modal content when it's open and new logs arrive (Realtime)
function refreshHistoryModalIfOpen(){
  var modalOverlay = document.querySelector('#modalContainer .modal-overlay');
  if(!modalOverlay) return;
  var titleEl = modalOverlay.querySelector('.modal-title');
  if(!titleEl || !titleEl.textContent.includes('历史操作记录')) return;
  // History modal is open — refresh its content
  var curClass = classesData.find(c=>c.id===currentClassId);
  var className = curClass ? curClass.name : '未选择班级';
  var months = getAvailableMonths();
  if(months.length===0) return;
  if(!_currentHistoryMonth || months.indexOf(_currentHistoryMonth)===-1) _currentHistoryMonth = months[0];
  var contentEl = modalOverlay.querySelector('.modal-content');
  if(contentEl) {
    // v70: 使用内容指纹（数量+首尾日志ID）代替纯数量比较，避免内容变化但数量不变时跳过更新
    var filteredLogs = getAllLogsForMonth(_currentHistoryMonth).filter(function(log) {
      if(log.classId) { if(log.classId.toString() !== (currentClassId || '').toString()) return false; }
      else if(curClass) { if(!curClass.students.some(function(s){return s.id.toString()===log.studentId.toString();})) return false; }
      else return false;
      if(_historyFilterEnabled && _historyFilterStudentId) {
        if(log.studentId.toString() !== _historyFilterStudentId.toString()) return false;
      }
      return true;
    });
    var newLogCount = filteredLogs.length;
    var newFingerprint = newLogCount + '_' + (filteredLogs[0] ? filteredLogs[0].id : '') + '_' + (filteredLogs[newLogCount-1] ? filteredLogs[newLogCount-1].id : '');
    var logList = contentEl.querySelector('#historyLogList');
    var existingCount = logList ? logList.children.length : -1;
    // v70: 比较指纹（数量+首尾ID），如果没变则跳过重建
    if (existingCount === newLogCount && newLogCount > 0 && window._lastHistoryFingerprint === newFingerprint) {
      // 只更新标题（月份/班级名可能变了）
      if(titleEl) titleEl.textContent = '\uD83D\uDCDC 历史操作记录【' + className + '】';
      return;
    }
    window._lastHistoryFingerprint = newFingerprint;
    // 指纹变了，需要重建（新增/撤销了日志）
    // 保存滚动位置
    var savedScrollTop = logList ? logList.scrollTop : 0;
    // 重建内容
    contentEl.innerHTML = _buildHistoryHTML(curClass, className, months, _currentHistoryMonth);
    // 恢复滚动位置
    var newLogList = contentEl.querySelector('#historyLogList');
    if(newLogList) newLogList.scrollTop = savedScrollTop;
  }
  // Also update the title to reflect latest data
  if(titleEl) titleEl.textContent = '\uD83D\uDCDC 历史操作记录【' + className + '】';
}
function switchHistoryMonth(month){
  _currentHistoryMonth = month;
  const curClass = classesData.find(c=>c.id===currentClassId);
  const className = curClass ? curClass.name : '未选择班级';
  const months = getAvailableMonths();
  const container = document.querySelector('.modal-content');
  if(container) container.innerHTML = _buildHistoryHTML(curClass, className, months, month);
}
function _buildHistoryHTML(curClass, className, months, activeMonth){
  const curMonth = _getCurrentMonth();
  const isCurrentMonth = (activeMonth === curMonth);
  const allLogs = getAllLogsForMonth(activeMonth);
  // v11: All accounts (teacher + student) see ALL merged logs for the class
  // Only difference: students cannot revoke (handled below in button logic)
  const isStudentView = _isStudentHistoryView;
  const classLogs = allLogs.filter(log => {
    // v12: Use toString() comparison to avoid type mismatch (number vs string)
    if(log.classId) { if(log.classId.toString() !== (currentClassId || '').toString()) return false; }
    else if(curClass) { if(!curClass.students.some(s=>s.id.toString()===log.studentId.toString())) return false; }
    else return false;
    // 筛选：如果启用筛选且选中了学生，只显示该学生的记录
    if(_historyFilterEnabled && _historyFilterStudentId) {
      if(log.studentId.toString() !== _historyFilterStudentId.toString()) return false;
    }
    return true;
  });
  let html = '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px;align-items:center;">';
  html += '<span style="font-size:13px;color:#886;margin-right:4px;">月份：</span>';
  months.forEach(m=>{
    const label = m.replace('-','年') + '月';
    const isActive = m === activeMonth;
    html += `<button onclick="switchHistoryMonth('${m}')" style="padding:4px 12px;border-radius:14px;border:1.5px solid ${isActive?'#e8637a':'#e0d0c8'};background:${isActive?'linear-gradient(135deg,#e8637a,#f5a054)':'#fff8f5'};color:${isActive?'#fff':'#886'};font-size:12px;font-weight:${isActive?'700':'400'};cursor:pointer;transition:all 0.2s;">${label}${m===curMonth?' (本月)':''}</button>`;
  });
  html += '</div>';
  // 筛选功能：在月份按钮行后面添加
  html += '<div style="display:flex;align-items:center;gap:6px;margin-bottom:10px;flex-wrap:wrap;">';
  html += '<input type="checkbox" id="historyFilterCheck" ' + (_historyFilterEnabled ? 'checked' : '') + ' onchange="toggleHistoryFilter(this.checked)" style="width:16px;height:16px;cursor:pointer;">';
  html += '<button onclick="showHistoryStudentFilter()" style="padding:4px 12px;border-radius:14px;border:1.5px solid ' + (_historyFilterEnabled && _historyFilterStudentId ? '#52c41a' : '#e0d0c8') + ';background:' + (_historyFilterEnabled && _historyFilterStudentId ? '#f0fff0' : '#fff8f5') + ';color:' + (_historyFilterEnabled && _historyFilterStudentId ? '#389e0d' : '#886') + ';font-size:12px;cursor:pointer;transition:all 0.2s;">筛选' + (_historyFilterStudentId ? '：' + _getHistoryFilterStudentName() : '') + '</button>';
  if (_historyFilterEnabled && _historyFilterStudentId) {
    html += '<button onclick="clearHistoryFilter()" style="padding:2px 8px;border-radius:10px;border:1px solid #ffcccc;background:#fff5f5;color:#cc5555;font-size:11px;cursor:pointer;">✕ 清除</button>';
  }
  // 备份/还原/一键清空按钮（仅教师可见）
  if (!isStudentView && curClass) {
    var backupCount = _getClassBackupCount();
    html += '<span style="margin-left:auto;display:flex;gap:6px;">';
    html += '<button onclick="createClassBackup()" style="padding:4px 12px;border-radius:14px;border:1.5px solid #4a9e9e;background:#f0fafb;color:#2a7a7a;font-size:12px;cursor:pointer;">💾 备份' + (backupCount > 0 ? '(' + backupCount + ')' : '') + '</button>';
    html += '<button onclick="showRestoreModal()" style="padding:4px 12px;border-radius:14px;border:1.5px solid #9e7a4a;background:#fbfaf0;color:#7a6a2a;font-size:12px;cursor:pointer;">🔄 还原</button>';
    html += '<button onclick="clearClassOperationLogs()" style="padding:4px 12px;border-radius:14px;border:1.5px solid #cc5555;background:#fff5f5;color:#cc5555;font-size:12px;cursor:pointer;">🗑️ 清空</button>';
    html += '</span>';
  }
  html += '</div>';
  if(classLogs.length===0){
    html += '<div style="text-align:center;padding:25px;color:#bba;">该月无操作记录</div>';
    return html;
  }
  const total = classLogs.length;
  const revertedCount = classLogs.filter(l=>l.reverted).length;
  html += `<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 12px;margin-bottom:8px;background:#fff5f0;border-radius:12px;font-size:13px;color:#886;">
    <span>共 <strong>${total}</strong> 条记录${revertedCount>0?`，<span style="color:#cc8800;">${revertedCount} 条已撤销</span>`:''}${!isCurrentMonth?' · <span style="color:#aaa;">归档记录</span>':''}</span>
    <label style="cursor:pointer;"><input type="checkbox" id="historyShowReverted" onchange="toggleRevertedVisibility(this.checked)" checked> 显示已撤销</label>
  </div>`;
  html += '<div id="historyLogList" style="max-height:400px;overflow:auto;">';
  // v12: Show newest logs first (remove .reverse())
  classLogs.forEach(log=>{
    const time = new Date(log.timestamp);
    const timeStr = time.toLocaleDateString('zh-CN',{month:'2-digit',day:'2-digit',timeZone:'Asia/Shanghai'}) + ' ' + time.toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',second:'2-digit',timeZone:'Asia/Shanghai'});
    const icon = _historyActionIcon(log.actionType);
    const color = _historyActionColor(log.actionType);
    const isReverted = log.reverted;
    // v80: Read summary from extra first, fall back to snapshot for backward compatibility
    const snap = log.snapshot;
    const extra = log.extra || {};
    // v80: Use extra for display (with snapshot fallback for old logs)
    const coinsBefore = extra.coinsBefore !== undefined ? extra.coinsBefore : (snap && snap.coinsBefore);
    const coinsAfter = extra.coinsAfter !== undefined ? extra.coinsAfter : (snap && snap.coinsAfter);
    const growthBefore = extra.growthBefore !== undefined ? extra.growthBefore : (snap && snap.growthBefore);
    const growthAfter = extra.growthAfter !== undefined ? extra.growthAfter : (snap && snap.growthAfter);
    const petNick = extra.petNick || (snap && snap.petNick);
    const petLevel = extra.petLevel || (snap && snap.petLevel);
    const stageName = extra.stageName || (snap && snap.stageName);
    const isDead = extra.isDead !== undefined ? extra.isDead : (snap && snap.isDead);
    const penaltyStreak = extra.penaltyStreak !== undefined ? extra.penaltyStreak : (snap && snap.penaltyStreak);
    let coinLine = '';
    if(log.coinDelta !== 0){
      const sign = log.coinDelta > 0 ? '+' : '';
      coinLine = `<span style="color:${log.coinDelta>0?'#4a9e4a':'#cc5544'};font-weight:600;">💰${sign}${log.coinDelta}</span>`;
      if(coinsBefore !== undefined && coinsAfter !== undefined) coinLine += `<span style="color:#aaa;margin-left:4px;">(${coinsBefore}→${coinsAfter})</span>`;
    }
    let expLine = '';
    if(log.expDelta !== 0){
      const sign = log.expDelta > 0 ? '+' : '';
      expLine = `<span style="color:${log.expDelta>0?'#4a9e4a':'#cc5544'};font-weight:600;margin-left:8px;">🌱${sign}${log.expDelta}</span>`;
      if(growthBefore !== undefined && growthAfter !== undefined) expLine += `<span style="color:#aaa;margin-left:4px;">(${growthBefore}→${growthAfter})</span>`;
    }
    let petInfo = '';
    if(petNick){
      petInfo = `<span style="background:#fff0e8;padding:1px 8px;border-radius:8px;font-size:11px;margin-left:6px;">🐾 ${esc(petNick)} Lv.${petLevel}${stageName?' · '+esc(stageName):''}</span>`;
    }
    let extraInfo = '';
    if(log.extra){
      if(log.extra.causedDeath) extraInfo += '<span style="color:#ff3333;font-weight:700;margin-left:6px;">⚠️ 宠物死亡！</span>';
      if(log.extra.pkType === 'win') extraInfo += `<span style="margin-left:6px;font-size:12px;">🎯 对手: ${esc(log.extra.opponentName)}（金币${log.extra.opponentCoinDelta}，成长${log.extra.opponentGrowthDelta>=0?'+':''}${log.extra.opponentGrowthDelta}）</span>`;
      if(log.extra.pkType === 'lose') extraInfo += `<span style="margin-left:6px;font-size:12px;">🎯 胜者: ${esc(log.extra.opponentName)}</span>`;
      if(log.extra.pkType === 'draw') extraInfo += `<span style="margin-left:6px;font-size:12px;">🤝 对手: ${esc(log.extra.opponentName)}</span>`;
    }
    if(isDead && !log.extra?.causedDeath) extraInfo += '<span style="color:#999;margin-left:6px;font-size:11px;">（宠物已死亡）</span>';
    if(penaltyStreak >= 2 && !log.extra?.causedDeath) extraInfo += `<span style="color:#ee6633;margin-left:6px;font-size:11px;">⚠ 连续惩罚${penaltyStreak}次</span>`;
    const opacity = isReverted ? 'opacity:0.45;' : '';
    const revertedBadge = isReverted ? '<span style="background:#ffcc00;color:#665500;padding:1px 6px;border-radius:6px;font-size:10px;font-weight:700;margin-left:6px;">已撤销</span>' : '';
    let btnHtml = '';
    // Only teachers can revoke operations; students cannot
    if(!isReverted && isCurrentMonth && !isStudentView){
      btnHtml = `<button class="btn btn-secondary" style="padding:5px 14px;font-size:13px;flex-shrink:0;" onclick="if(confirm('确定撤销「${esc(log.studentName)} · ${esc(log.actionType)}」？此操作将还原数据变更。')){revertToLog(${log.id});closeModal();}">撤销</button>`;
      // v75: Show "恢复到此" button for logs that likely have snapshot (coin/exp changes or quiz actions)
      // Snapshot is fetched on demand in restoreToLogEntry
      const hasSnapshotData = snap ? (snap.coinsAfter !== undefined || snap.quizStateSnapshot) : (log.coinDelta !== 0 || log.expDelta !== 0 || log.actionType === '小猪快跑');
      if(hasSnapshotData) btnHtml = `<button class="btn btn-secondary" style="padding:5px 12px;font-size:12px;flex-shrink:0;background:#e8f5e9;color:#2e7d32;border-color:#a5d6a7;margin-right:6px;" onclick="restoreToLogEntry(${log.id})">恢复到此</button>` + btnHtml;
    }
    html += `<div class="history-log-item ${isReverted?'history-reverted':''}" style="${opacity}border-left:3px solid ${color};padding-left:14px;">
      <div style="flex:1;min-width:0;">
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
          <span class="history-log-time">${timeStr}</span>
          <span style="font-size:14px;">${icon}</span>
          <strong style="color:${color};">${esc(log.studentName)}</strong>
          <span style="color:#998;font-size:13px;">· ${esc(log.actionType)}</span>
          ${revertedBadge}${petInfo}
        </div>
        <div style="font-size:13px;margin-top:3px;color:#665;">${esc(log.details)}</div>
        <div style="font-size:12px;margin-top:2px;">${coinLine}${expLine}${extraInfo}</div>
      </div>
      ${btnHtml}
    </div>`;
  });
  html += '</div>';
  return html;
}
function toggleRevertedVisibility(show){
  document.querySelectorAll('.history-reverted').forEach(el=>{
    el.style.display = show ? '' : 'none';
  });
}
// === 历史操作筛选功能 ===
function _getHistoryFilterStudentName() {
  if (!_historyFilterStudentId) return '';
  var curClass = classesData.find(c => c.id === currentClassId);
  if (!curClass) return '未知';
  var stu = curClass.students.find(s => s.id.toString() === _historyFilterStudentId.toString());
  return stu ? stu.name : '未知';
}
function toggleHistoryFilter(enabled) {
  _historyFilterEnabled = enabled;
  if (!enabled) _historyFilterStudentId = null;
  _refreshHistoryContent();
}
function clearHistoryFilter() {
  _historyFilterStudentId = null;
  _historyFilterEnabled = false;
  _refreshHistoryContent();
}
function _refreshHistoryContent() {
  var curClass = classesData.find(c => c.id === currentClassId);
  var className = curClass ? curClass.name : '未选择班级';
  var months = getAvailableMonths();
  if (months.length === 0) return;
  if (!_currentHistoryMonth || months.indexOf(_currentHistoryMonth) === -1) _currentHistoryMonth = months[0];
  var container = document.querySelector('.modal-content');
  if (container) {
    // 保存滚动位置
    var logList = container.querySelector('#historyLogList');
    var savedScrollTop = logList ? logList.scrollTop : 0;
    container.innerHTML = _buildHistoryHTML(curClass, className, months, _currentHistoryMonth);
    // 恢复滚动位置
    var newLogList = container.querySelector('#historyLogList');
    if(newLogList) newLogList.scrollTop = savedScrollTop;
  }
}
function showHistoryStudentFilter() {
  var curClass = classesData.find(c => c.id === currentClassId);
  if (!curClass || !curClass.students || curClass.students.length === 0) {
    alert('当前班级没有学生');
    return;
  }
  var students = curClass.students;
  _renderHistoryFilterStudentList(students, _historyFilterStudentId);
}
function _renderHistoryFilterStudentList(students, selectedId) {
  var html = '<div style="position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;" id="historyFilterModal">';
  html += '<div style="background:#fff;border-radius:20px;padding:24px;width:900px;max-width:95vw;max-height:80vh;display:flex;flex-direction:column;box-shadow:0 12px 40px rgba(0,0,0,0.3);">';
  // Header
  html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">';
  html += '<div style="font-size:18px;font-weight:700;">📋 选择学生 - 历史操作筛选</div>';
  html += '<button onclick="closeHistoryFilterModal()" style="background:none;border:none;font-size:24px;cursor:pointer;color:#999;">×</button>';
  html += '</div>';
  // Description
  html += '<div style="font-size:13px;color:#888;margin-bottom:14px;">点击学生姓名进行筛选，筛选后只显示该学生的操作记录。</div>';
  // Student list
  html += '<div style="display:flex;flex-wrap:wrap;gap:6px;overflow-y:auto;border:1.5px solid rgba(255,210,200,0.6);border-radius:18px;padding:12px;background:#fffaf5;align-content:flex-start;max-height:400px;">';
  students.forEach(function(stu) {
    var isSelected = selectedId && selectedId.toString() === stu.id.toString();
    var bgColor = isSelected ? '#e8ffe8' : '#fff';
    var borderColor = isSelected ? '#52c41a' : '#ffe2d6';
    html += '<div onclick="onHistoryFilterStudentClick(' + stu.id + ')" style="display:flex;align-items:center;padding:5px 10px;border:1.5px solid ' + borderColor + ';border-radius:12px;gap:6px;background:' + bgColor + ';font-size:14px;white-space:nowrap;cursor:pointer;transition:all 0.15s;">';
    if (isSelected) {
      html += '<span style="width:16px;height:16px;border-radius:50%;background:#52c41a;color:#fff;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:bold;flex-shrink:0;">✓</span>';
    } else {
      html += '<span style="width:16px;height:16px;border-radius:50%;border:1.5px solid #ddd;flex-shrink:0;"></span>';
    }
    html += '<span style="font-weight:600;">' + (stu.name || '未命名') + '</span>';
    html += '<span style="font-size:12px;color:#999;">💰' + (stu.coins || 0) + '</span>';
    html += '</div>';
  });
  html += '</div>';
  // Bottom buttons
  html += '<div style="text-align:center;margin-top:14px;">';
  html += '<button onclick="closeHistoryFilterModal()" style="background:#f0f0f0;color:#666;border:none;border-radius:12px;padding:10px 28px;font-size:14px;font-weight:700;cursor:pointer;">取消</button>';
  html += '</div>';
  html += '</div></div>';
  var container = document.getElementById('modalContainer');
  if (container) {
    // 先移除已有的筛选弹窗（如有）
    var old = document.getElementById('historyFilterModal');
    if (old) old.remove();
    container.insertAdjacentHTML('beforeend', html);
  }
}
window.onHistoryFilterStudentClick = function(studentId) {
  _historyFilterStudentId = parseInt(studentId);
  _historyFilterEnabled = true;
  closeHistoryFilterModal();
  _refreshHistoryContent();
  // Also update the checkbox
  var check = document.getElementById('historyFilterCheck');
  if (check) check.checked = true;
};
window.closeHistoryFilterModal = function() {
  var modal = document.getElementById('historyFilterModal');
  if (modal) modal.remove();
};

// === 班级数据备份/还原/清空功能 (v74: Supabase-backed) ===
// Cache for backup count (updated async from Supabase)
var _cachedBackupCount = 0;
var _cachedBackupCountClassId = null;

// 获取当前班级的备份数量（返回缓存值，异步更新）
function _getClassBackupCount() {
  if (!currentClassId) return 0;
  if (_cachedBackupCountClassId === currentClassId) return _cachedBackupCount;
  // Trigger async refresh if cache is stale
  _refreshBackupCountCache();
  return _cachedBackupCount;
}

// 异步刷新备份数量缓存
function _refreshBackupCountCache() {
  if (!currentClassId || typeof fetchClassBackups !== 'function') return Promise.resolve(0);
  return fetchClassBackups(currentClassId).then(function(backups) {
    _cachedBackupCount = backups.length;
    _cachedBackupCountClassId = currentClassId;
    // Update button text if visible
    var btn = document.querySelector('button[onclick="createClassBackup()"]');
    if (btn) {
      btn.textContent = '💾 备份' + (_cachedBackupCount > 0 ? '(' + _cachedBackupCount + ')' : '');
    }
    return _cachedBackupCount;
  });
}

// 异步获取当前班级的所有备份（从 Supabase）
function _fetchClassBackupsAsync() {
  if (!currentClassId || typeof fetchClassBackups !== 'function') return Promise.resolve([]);
  return fetchClassBackups(currentClassId).then(function(rows) {
    // Transform Supabase rows to match the format expected by UI
    return rows.map(function(row) {
      return {
        id: row.id,
        name: row.name,
        time: row.created_at,
        timeDisplay: _formatBackupTime(row.created_at),
        data: row.snapshot_data
      };
    });
  });
}

// 格式化备份时间显示
function _formatBackupTime(isoStr) {
  if (!isoStr) return '';
  var d = new Date(isoStr);
  if (isNaN(d.getTime())) return isoStr;
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0') + ' ' +
    String(d.getHours()).padStart(2, '0') + ':' +
    String(d.getMinutes()).padStart(2, '0') + ':' +
    String(d.getSeconds()).padStart(2, '0');
}

// 创建班级备份（保存到 Supabase）
function createClassBackup() {
  var curClass = classesData.find(c => c.id === currentClassId);
  if (!curClass) { showNotification('备份失败', '未找到当前班级', 'error'); return; }
  
  var now = new Date();
  var timeStr = now.getFullYear() + '-' + 
    String(now.getMonth() + 1).padStart(2, '0') + '-' + 
    String(now.getDate()).padStart(2, '0') + ' ' +
    String(now.getHours()).padStart(2, '0') + ':' + 
    String(now.getMinutes()).padStart(2, '0') + ':' +
    String(now.getSeconds()).padStart(2, '0');
  
  var backupName = '备份 ' + timeStr;
  var snapshotData = JSON.parse(JSON.stringify(curClass));
  
  if (typeof insertClassBackup !== 'function') {
    showNotification('备份失败', '数据层未就绪，请稍后重试', 'error');
    return;
  }
  
  insertClassBackup(currentClassId, backupName, snapshotData).then(function(row) {
    if (row) {
      showNotification('备份成功', '已创建备份：' + backupName, 'success');
      _cachedBackupCount++;
      _cachedBackupCountClassId = currentClassId;
      _refreshHistoryContent();
    } else {
      showNotification('备份失败', '保存到云端失败，请重试', 'error');
    }
  });
}

// 显示还原弹窗（异步从 Supabase 加载备份列表）
function showRestoreModal() {
  // Show loading state first
  showModal('🔄 选择备份点', '<div style="text-align:center;padding:30px;color:#888;">加载中...</div>', [{text: '关闭', onclick: 'closeModal()'}], true);
  
  _fetchClassBackupsAsync().then(function(backups) {
    if (backups.length === 0) {
      closeModal();
      showNotification('还原失败', '暂无备份点', 'warning');
      return;
    }
    
    var curClass = classesData.find(c => c.id === currentClassId);
    var className = curClass ? curClass.name : '未选择班级';
    
    var html = '<div style="max-height:400px;overflow:auto;">';
    html += '<div style="padding:8px 12px;background:#fff8f0;border-radius:10px;margin-bottom:10px;font-size:13px;color:#886;">';
    html += '💡 点击"还原"按钮将把班级数据恢复到备份时间点的状态';
    html += '</div>';
    
    // 倒序显示（最新的在前）— already sorted DESC from Supabase
    backups.forEach(function(backup, idx) {
      var studentCount = backup.data.students ? backup.data.students.length : 0;
      var petCount = backup.data.students ? backup.data.students.reduce(function(sum, s) { return sum + (s.pets ? s.pets.length : 0); }, 0) : 0;
      
      html += '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;margin-bottom:6px;background:#f8f8f5;border-radius:10px;border:1px solid #e8e8e0;">';
      html += '<div style="flex:1;min-width:0;">';
      html += '<div style="font-size:13px;font-weight:600;color:#445;">' + esc(backup.name) + '</div>';
      html += '<div style="font-size:11px;color:#888;margin-top:2px;">';
      html += '👨‍🎓 ' + studentCount + '名学生 · 🐕 ' + petCount + '只宠物';
      html += '</div>';
      html += '</div>';
      html += '<div style="display:flex;gap:6px;flex-shrink:0;margin-left:10px;">';
      html += '<button onclick="renameBackup(' + backup.id + ')" style="padding:4px 8px;font-size:11px;border:1px solid #ccc;background:#fff;border-radius:6px;cursor:pointer;">✏️</button>';
      html += '<button onclick="deleteBackup(' + backup.id + ')" style="padding:4px 8px;font-size:11px;border:1px solid #faa;background:#fff5f5;color:#c55;border-radius:6px;cursor:pointer;">🗑️</button>';
      html += '<button onclick="confirmRestoreBackup(' + backup.id + ')" style="padding:4px 12px;font-size:12px;border:1px solid #5a5;background:#f0fff0;color:#3a3;border-radius:6px;cursor:pointer;font-weight:600;">还原</button>';
      html += '</div>';
      html += '</div>';
    });
    
    html += '</div>';
    
    showModal('🔄 选择备份点 - ' + className, html, [{text: '关闭', onclick: 'closeModal()'}], true);
  });
}

// 重命名备份（Supabase）
window.renameBackup = function(backupId) {
  if (typeof updateClassBackupName !== 'function') {
    showNotification('操作失败', '数据层未就绪', 'error');
    return;
  }
  var newName = prompt('请输入新的备份名称：');
  if (!newName || !newName.trim()) return;
  
  updateClassBackupName(backupId, newName.trim()).then(function(ok) {
    if (ok) {
      showNotification('重命名成功', '备份已更名为：' + newName.trim(), 'success');
      showRestoreModal();
    } else {
      showNotification('重命名失败', '请重试', 'error');
    }
  });
};

// 删除备份（Supabase）
window.deleteBackup = function(backupId) {
  if (!confirm('确定要删除这个备份点吗？')) return;
  if (typeof deleteClassBackup !== 'function') {
    showNotification('操作失败', '数据层未就绪', 'error');
    return;
  }
  
  deleteClassBackup(backupId).then(function(ok) {
    if (ok) {
      showNotification('删除成功', '备份点已删除', 'success');
      _cachedBackupCount = Math.max(0, _cachedBackupCount - 1);
      _refreshHistoryContent();
      showRestoreModal();
    } else {
      showNotification('删除失败', '请重试', 'error');
    }
  });
};

// 确认还原备份（从 Supabase 获取备份数据）
window.confirmRestoreBackup = function(backupId) {
  if (typeof fetchClassBackupById !== 'function') {
    showNotification('还原失败', '数据层未就绪', 'error');
    return;
  }
  
  fetchClassBackupById(backupId).then(function(row) {
    if (!row) {
      showNotification('还原失败', '未找到备份点', 'error');
      return;
    }
    
    var backup = {
      id: row.id,
      name: row.name,
      time: row.created_at,
      data: row.snapshot_data
    };
    
    var curClass = classesData.find(c => c.id === currentClassId);
    var className = curClass ? curClass.name : '未选择班级';
    
    var studentCount = backup.data.students ? backup.data.students.length : 0;
    var petCount = backup.data.students ? backup.data.students.reduce(function(sum, s) { return sum + (s.pets ? s.pets.length : 0); }, 0) : 0;
    
    var html = '<div style="padding:16px;text-align:center;">';
    html += '<div style="font-size:48px;margin-bottom:16px;">⚠️</div>';
    html += '<div style="font-size:15px;font-weight:600;color:#c33;margin-bottom:12px;">确定要还原到以下备份点吗？</div>';
    html += '<div style="background:#fff8f0;padding:12px;border-radius:10px;margin-bottom:16px;text-align:left;">';
    html += '<div style="font-size:14px;font-weight:600;color:#445;">' + esc(backup.name) + '</div>';
    html += '<div style="font-size:12px;color:#888;margin-top:4px;">👨‍🎓 ' + studentCount + '名学生 · 🐕 ' + petCount + '只宠物</div>';
    html += '</div>';
    html += '<div style="font-size:13px;color:#666;line-height:1.6;">';
    html += '还原后，所有学生的宠物数据、金币、道具、闯关进度等都将恢复到备份时间点的状态。';
    html += '<br><strong style="color:#c33;">此操作不可撤销！</strong>';
    html += '</div>';
    html += '</div>';
    
    showModal('⚠️ 确认还原 - ' + className, html, [
      {text: '取消', onclick: 'closeModal()'},
      {text: '确定还原', onclick: 'executeRestoreBackup(' + backupId + ')', style: 'background:linear-gradient(135deg,#e8637a,#f5a054);color:#fff;border:none;font-weight:700;'}
    ], false);
  });
};

// 执行还原备份（从 Supabase 获取并还原）
window.executeRestoreBackup = function(backupId) {
  if (typeof fetchClassBackupById !== 'function') {
    showNotification('还原失败', '数据层未就绪', 'error');
    return;
  }
  
  fetchClassBackupById(backupId).then(function(row) {
    if (!row) {
      showNotification('还原失败', '未找到备份点', 'error');
      return;
    }
    
    var classIdx = classesData.findIndex(c => c.id === currentClassId);
    if (classIdx === -1) { showNotification('还原失败', '未找到当前班级', 'error'); return; }
    
    // 还原数据（深拷贝备份数据）
    classesData[classIdx] = JSON.parse(JSON.stringify(row.snapshot_data));
    saveClassData();
    
    closeModal();
    showNotification('还原成功', '已还原到：' + row.name, 'success');
    scheduleAllRenders();
    _refreshHistoryContent();
  });
};

// 清空当前班级的操作日志和备份
function clearClassOperationLogs() {
  var curClass = classesData.find(c => c.id === currentClassId);
  if (!curClass) { showNotification('清空失败', '未找到当前班级', 'error'); return; }
  
  // 统计日志数量
  var classLogs = window.operationLogs.filter(function(log) {
    if (log.classId) return log.classId.toString() === currentClassId.toString();
    return curClass.students.some(function(s) { return s.id.toString() === log.studentId.toString(); });
  });
  
  var backupInfo = '';
  if (_cachedBackupCountClassId === currentClassId && _cachedBackupCount > 0) {
    backupInfo = '，以及 <strong style="color:#c33;">' + _cachedBackupCount + '</strong> 个备份点';
  }
  
  if (classLogs.length === 0 && _cachedBackupCount === 0) {
    showNotification('无需清空', '当前班级暂无操作记录和备份', 'info');
    return;
  }
  
  var html = '<div style="padding:16px;text-align:center;">';
  html += '<div style="font-size:48px;margin-bottom:16px;">🗑️</div>';
  html += '<div style="font-size:15px;font-weight:600;color:#c33;margin-bottom:12px;">确定要清空所有数据吗？</div>';
  html += '<div style="background:#fff5f5;padding:12px;border-radius:10px;margin-bottom:16px;">';
  html += '<div style="font-size:14px;color:#665;">当前班级共有 <strong style="color:#c33;">' + classLogs.length + '</strong> 条操作记录' + backupInfo + '</div>';
  html += '</div>';
  html += '<div style="font-size:13px;color:#666;line-height:1.6;">';
  html += '清空后，所有操作历史和备份数据将被删除，从当前时间开始重新记录。';
  html += '<br><strong style="color:#c33;">此操作不可撤销！</strong>';
  html += '</div>';
  html += '</div>';
  
  showModal('🗑️ 清空操作记录 - ' + curClass.name, html, [
    {text: '取消', onclick: 'closeModal()'},
    {text: '确定清空', onclick: 'executeClearOperationLogs()', style: 'background:#c33;color:#fff;border:none;font-weight:700;'}
  ], false);
}

// 执行清空操作日志和备份
window.executeClearOperationLogs = function() {
  var curClass = classesData.find(c => c.id === currentClassId);
  if (!curClass) return;
  
  // 1. 从 window.operationLogs 中移除当前班级的记录
  window.operationLogs = window.operationLogs.filter(function(log) {
    var isThisClass = false;
    if (log.classId) {
      isThisClass = log.classId.toString() === currentClassId.toString();
    } else {
      isThisClass = curClass.students.some(function(s) { return s.id.toString() === log.studentId.toString(); });
    }
    return !isThisClass;
  });
  saveLogs();
  
  // 2. 从 Supabase 删除当前班级的操作日志和备份
  if (typeof db !== 'undefined' && db && typeof currentUser !== 'undefined' && currentUser) {
    // 获取当前班级的学生 ID 列表
    var studentIds = curClass.students.map(function(s) { return s.id; });
    
    // 先删除与学生相关的日志
    if (studentIds.length > 0) {
      db.from('operation_logs').delete().in('student_id', studentIds).then(function(r) {
        if (r.error) console.warn('[清空日志] 学生日志删除失败:', r.error.message);
        else console.log('[清空日志] 学生日志已删除:', r.data ? r.data.length : 0, '条');
      });
    }
    
    // 再删除与班级相关的日志（如 reset）
    db.from('operation_logs').delete().eq('class_id', currentClassId).then(function(r) {
      if (r.error) console.warn('[清空日志] 班级日志删除失败:', r.error.message);
      else console.log('[清空日志] 班级日志已删除:', r.data ? r.data.length : 0, '条');
    });
    
    // 删除该班级的所有备份（v74）
    if (typeof deleteAllClassBackups === 'function') {
      deleteAllClassBackups(currentClassId).then(function(ok) {
        if (ok) {
          console.log('[清空] 班级备份已全部删除');
          _cachedBackupCount = 0;
        }
      });
    }
  }
  
  closeModal();
  showNotification('清空成功', '所有操作记录和备份已清空', 'success');
  _refreshHistoryContent();
};

function getPetImage(petName, level=1) { const cfg = PET_CONFIG[petName]; if (!cfg) return '<span>🐾</span>'; return `<img src="${_img(`${cfg.id}/${level}.webp`)}" alt="${petName}" loading="lazy" decoding="async" style="max-width:100%; max-height:100%; object-fit: contain;" onerror="this.onerror=null; this.parentNode.innerHTML='<span style=\'font-size:48px;\'>${cfg.emoji}</span>';">`; }
function getEggImage() { return `<img src="${_img('蛋.webp')}" alt="宠物蛋" class="egg-img" loading="lazy" decoding="async" style="max-width:100%; max-height:100%; object-fit: contain;" onerror="this.onerror=null; this.parentNode.innerHTML='<span style=\'font-size:60px;\'>🥚</span>';">`; }

/* ===== ENHANCED PET MODAL SYSTEM - JS ===== */
let _petModalTiltCleanup = null;
let _petModalLongPressTimer = null;

function _getPetElement(petName) {
  const firePets = ['火凤凰','送财龙','大神龟','淡火狐','不萌鼠','哮天犬','九尾天狐','恐龙'];
  const waterPets = ['海马','青云龙','苍狮','小白','踏天马','刺猬','寄居蟹','果冻蝾螈'];
  const naturePets = ['荷兰兔','大白兔','萌萌羊','考拉','长毛汪','呆呆熊','荷兰猪','梅花鹿','羊驼','黄牛','芦丁鸡','大萌星'];
  const lightningPets = ['七彩鸟','白眉汪','六耳猕狗','猫猫虎','孔雀'];
  const shadowPets = ['萌蝙蝠','美杜莎','黑白犬','黑白猪','蜥蜴','花斑虎'];
  const lightPets = ['吉祥神兽','泰迪','熊猫大侠','白白东','幸运猫','比尔鸭','柯基犬','咩咩咩'];
  if(firePets.includes(petName)) return 'fire';
  if(waterPets.includes(petName)) return 'water';
  if(naturePets.includes(petName)) return 'nature';
  if(lightningPets.includes(petName)) return 'lightning';
  if(shadowPets.includes(petName)) return 'shadow';
  if(lightPets.includes(petName)) return 'light';
  return 'sparkle';
}

function _getLevelAuraTier(level) {
  if(level >= 9) return 'aura-tier5';
  if(level >= 7) return 'aura-tier4';
  if(level >= 5) return 'aura-tier3';
  if(level >= 3) return 'aura-tier2';
  return 'aura-tier1';
}

function initPetModalEnhancements(petImgEl, petName, petLevel, petGrowth, expNeeded) {
  if(!petImgEl) return;
  // Add classes
  petImgEl.classList.add('idle-breathing', 'enhanced-hover', 'tilt-active');
  // Level aura
  const tier = _getLevelAuraTier(petLevel);
  const auraDiv = document.createElement('div');
  auraDiv.className = 'level-aura ' + tier;
  petImgEl.insertBefore(auraDiv, petImgEl.firstChild);
  // Add orbiting spark dots for higher tiers
  if(petLevel >= 5) {
    const dotCount = petLevel >= 9 ? 6 : (petLevel >= 7 ? 4 : 2);
    const dotColors = petLevel >= 9 ? ['#ffd700','#ff4500','#ff00ff','#00bfff','#00ff88','#ffaa00'] : (petLevel >= 7 ? ['#ffd700','#ff6600','#ffaa00','#ff3300'] : ['#aa88ff','#8866ff']);
    const containerW = petImgEl.offsetWidth || 450;
    const orbitR = Math.round(containerW * (petLevel >= 9 ? 0.58 : petLevel >= 7 ? 0.55 : 0.52));
    for(let i = 0; i < dotCount; i++) {
      const dot = document.createElement('div');
      dot.className = 'aura-orbit-dot';
      const dur = 3 + Math.random() * 2;
      const color = dotColors[i % dotColors.length];
      const size = petLevel >= 9 ? 8 : 6;
      dot.style.cssText = `position:absolute;top:50%;left:50%;width:${size}px;height:${size}px;margin:-${size/2}px 0 0 -${size/2}px;border-radius:50%;background:${color};box-shadow:0 0 8px ${color},0 0 16px ${color};pointer-events:none;z-index:2;animation:orbitDot ${dur}s linear infinite;animation-delay:${-(dur/dotCount)*i}s;--orbit-r:${orbitR}px;`;
      auraDiv.appendChild(dot);
    }
  }
  // Entrance animation
  const entranceClass = petLevel >= 7 ? 'entrance-high' : (petLevel >= 4 ? 'entrance-mid' : 'entrance-low');
  petImgEl.classList.add(entranceClass);
  // Entrance effects
  if(petLevel >= 4) {
    const ringCount = petLevel >= 7 ? 3 : 1;
    for(let i = 0; i < ringCount; i++) {
      const ring = document.createElement('div');
      ring.className = 'entrance-flash-ring' + (i > 0 ? ' ring-' + (i+1) : '');
      petImgEl.appendChild(ring);
      setTimeout(() => ring.remove(), 1500);
    }
  }
  // Stardust
  const dustCount = petLevel >= 7 ? 20 : (petLevel >= 4 ? 12 : 6);
  const dustColors = petLevel >= 7 ? ['#ffd700','#ffaa00','#fff5c0','#ff8800'] : (petLevel >= 4 ? ['#ffb088','#ffd700','#fff'] : ['#ffe0d0','#fff','#ffd0b0']);
  for(let i = 0; i < dustCount; i++) {
    setTimeout(() => {
      const d = document.createElement('div');
      d.className = 'entrance-stardust';
      const angle = Math.random() * Math.PI * 2;
      const dist = 60 + Math.random() * 120;
      const cx = petImgEl.offsetWidth / 2;
      const cy = petImgEl.offsetHeight / 2;
      d.style.cssText = `left:${cx}px;top:${cy}px;background:${dustColors[Math.floor(Math.random()*dustColors.length)]};box-shadow:0 0 6px currentColor;--dx:${Math.cos(angle)*dist}px;--dy:${Math.sin(angle)*dist}px;--dur:${0.5+Math.random()*0.7}s;`;
      petImgEl.appendChild(d);
      setTimeout(() => d.remove(), 1500);
    }, i * 50);
  }
  // Remove entrance class after animation
  setTimeout(() => {
    petImgEl.classList.remove(entranceClass);
  }, 1500);
  // Element particles
  const element = _getPetElement(petName);
  spawnAuraParticles(petImgEl, element, petLevel);
  // 3D tilt
  initTiltEffect(petImgEl);
  // Click interaction
  initPetClickInteraction(petImgEl);
  // Animate stats
  setTimeout(() => animatePetStats(petGrowth, expNeeded, petLevel), 300);
}

function spawnAuraParticles(container, element, level) {
  const count = level >= 7 ? 14 : (level >= 4 ? 10 : 6);
  for(let i = 0; i < count; i++) {
    const p = document.createElement('div');
    p.className = 'aura-particle ' + element;
    const dur = 2 + Math.random() * 3;
    const delay = Math.random() * 3;
    let extra = '';
    if(element === 'nature') {
      const leaves = ['🍃','🌿','🍂','🌸','✨'];
      p.textContent = leaves[Math.floor(Math.random() * leaves.length)];
    }
    if(element === 'fire' || element === 'sparkle') {
      const dx = (Math.random() - 0.5) * 60;
      const dy = -(20 + Math.random() * 40);
      extra = `--dx:${dx}px;--dy:${dy}px;`;
    }
    // Position around edges
    const angle = (i / count) * Math.PI * 2;
    const rx = 40 + Math.random() * 15;
    const ry = 40 + Math.random() * 15;
    const x = 50 + rx * Math.cos(angle);
    const y = 50 + ry * Math.sin(angle);
    p.style.cssText += `left:${x}%;top:${y}%;--dur:${dur}s;--delay:${delay}s;${extra}`;
    container.appendChild(p);
  }
}

function initTiltEffect(el) {
  if(_petModalTiltCleanup) _petModalTiltCleanup();
  const glow = document.createElement('div');
  glow.className = 'tilt-glow';
  el.appendChild(glow);

  function onMove(e) {
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const tiltX = (y - 0.5) * -12;
    const tiltY = (x - 0.5) * 12;
    el.style.transform = `perspective(600px) rotateX(${tiltX}deg) rotateY(${tiltY}deg)`;
    const img = el.querySelector('img');
    if(img) img.style.transform = `translateX(${(x-0.5)*-8}px) translateY(${(y-0.5)*-8}px)`;
    glow.style.setProperty('--glow-x', (x*100)+'%');
    glow.style.setProperty('--glow-y', (y*100)+'%');
  }
  function onLeave() {
    el.style.transform = 'perspective(600px) rotateX(0) rotateY(0)';
    const img = el.querySelector('img');
    if(img) img.style.transform = '';
  }
  el.addEventListener('mousemove', onMove);
  el.addEventListener('mouseleave', onLeave);
  _petModalTiltCleanup = () => {
    el.removeEventListener('mousemove', onMove);
    el.removeEventListener('mouseleave', onLeave);
  };
}

function initPetClickInteraction(el) {
  let longPressTimer = null;
  let isLongPress = false;

  el.style.cursor = 'pointer';
  el.addEventListener('mousedown', (e) => {
    isLongPress = false;
    longPressTimer = setTimeout(() => {
      isLongPress = true;
      // Spin reveal
      el.classList.remove('pet-click-bounce');
      void el.offsetWidth;
      el.classList.add('pet-spin-show');
      // Sparkle burst
      for(let i = 0; i < 16; i++) {
        const s = document.createElement('div');
        s.className = 'click-sparkle-burst';
        const angle = (i / 16) * Math.PI * 2;
        const dist = 40 + Math.random() * 60;
        const colors = ['#ffd700','#ff6b6b','#aa88ff','#66ddff','#88ff88'];
        s.style.cssText = `left:50%;top:50%;background:${colors[i%colors.length]};box-shadow:0 0 6px ${colors[i%colors.length]};--sx:${Math.cos(angle)*dist}px;--sy:${Math.sin(angle)*dist}px;`;
        el.appendChild(s);
        setTimeout(() => s.remove(), 800);
      }
      setTimeout(() => el.classList.remove('pet-spin-show'), 1100);
    }, 500);
  });
  el.addEventListener('mouseup', () => {
    clearTimeout(longPressTimer);
    if(!isLongPress) {
      // Short click: bounce + hearts
      el.classList.remove('pet-spin-show');
      el.classList.remove('pet-click-bounce');
      void el.offsetWidth;
      el.classList.add('pet-click-bounce');
      const hearts = ['❤️','💖','💕','🧡','💛','💚','💙','💜'];
      for(let i = 0; i < 5; i++) {
        const h = document.createElement('div');
        h.className = 'click-heart-float';
        h.textContent = hearts[Math.floor(Math.random() * hearts.length)];
        h.style.cssText = `left:${20+Math.random()*60}%;top:${30+Math.random()*40}%;animation-delay:${i*0.08}s;`;
        el.appendChild(h);
        setTimeout(() => h.remove(), 1200);
      }
      setTimeout(() => el.classList.remove('pet-click-bounce'), 600);
    }
  });
  el.addEventListener('mouseleave', () => clearTimeout(longPressTimer));
}

function animatePetStats(growth, expNeeded, level) {
  // Growth progress bar
  const progBar = document.querySelector('.modal-growth-progress');
  if(progBar) {
    const fill = progBar.querySelector('.stat-progress-fill');
    if(fill) {
      const pct = expNeeded > 0 ? Math.min(100, (growth / expNeeded) * 100) : 100;
      setTimeout(() => { fill.style.width = pct + '%'; }, 100);
    }
  }
  // Number bounce on level
  const lvNum = document.querySelector('.modal-level-num');
  if(lvNum) {
    setTimeout(() => lvNum.classList.add('num-bounce'), 400);
  }
  // Coin shake
  const coinEl = document.querySelector('.modal-coin-val');
  if(coinEl) {
    coinEl.classList.add('coin-shake');
  }
  // Crown spin for max level
  if(level >= 9) {
    const crown = document.querySelector('.modal-crown-icon');
    if(crown) crown.classList.add('crown-spin');
  }
  // Hunger pulse
  const hungerEl = document.querySelector('.modal-hunger-warn');
  if(hungerEl) {
    const txt = hungerEl.textContent;
    if(txt.includes('🔴') || txt.includes('🟠')) {
      hungerEl.classList.add('hunger-pulse');
    }
  }
}

function cleanupPetModalEffects() {
  if(_petModalTiltCleanup) { _petModalTiltCleanup(); _petModalTiltCleanup = null; }
}
/* ===== END ENHANCED PET MODAL JS ===== */

function showModal(title,content,actions=[],large=false,extraClass=''){const c=document.getElementById('modalContainer'),m=document.createElement('div');m.className='modal-overlay';const modalClass=extraClass?extraClass:(large?'large':'');m.innerHTML=`<div class="modal ${modalClass}"><div class="modal-title">${esc(title)}</div><div class="modal-content">${content}</div><div class="modal-actions">${actions.map(a=>`<button class="btn ${a.class||'btn-primary'}" onclick="playClickSound(); ${a.onclick}">${esc(a.text)}</button>`).join('')}</div></div>`;c.appendChild(m);m.addEventListener('click',(e)=>{if(e.target===m)closeModal();});return m;}
function closeModal(){const c=document.getElementById('modalContainer');while(c.firstChild)c.removeChild(c.firstChild);currentModalStudentId=null; stopAllHeartEmitters(); cleanupPetModalEffects(); }
function saveClassData(){safeLSSave('classPetData', classesData); scheduleFileSave(); triggerRealtimeSync();}
function saveDeletedClasses(){safeLSSave('deletedClasses', deletedClasses); scheduleFileSave();}
function showDeletedClassesModal(){if(deletedClasses.length===0){showModal('🗑️ 已删除班级','<div style="text-align:center;padding:20px;">暂无已删除的班级</div>',[{text:'关闭',onclick:'closeModal()'}],false);return;}let html='<div style="max-height:400px;overflow:auto;">';[...deletedClasses].reverse().forEach((cls,i)=>{const time=new Date(cls.deletedAt).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai'});const stuCount=cls.students?cls.students.length:0;const petCount=cls.students?cls.students.reduce((s,stu)=>s+(stu.pets?.length||0),0):0;html+=`<div class="history-log-item"><div><div class="history-log-time">${time} 删除</div><div><strong>${esc(cls.name)}</strong></div><div style="font-size:12px;">👨‍🎓 ${stuCount}名学生 · 🐕 ${petCount}只宠物</div></div><div style="display:flex;gap:6px;"><button class="btn btn-primary" style="padding:6px 12px;" onclick="restoreClass('${cls.id}');closeModal();">恢复</button><button class="btn btn-danger" style="padding:6px 12px;" onclick="permanentDeleteClass('${cls.id}');closeModal();">彻底删除</button></div></div>`;});html+='</div>';showModal('🗑️ 已删除班级',html,[{text:'关闭',onclick:'closeModal()'}],true);}
function restoreClass(id){const idx=deletedClasses.findIndex(c=>c.id==id);if(idx===-1){showNotification('恢复失败','未找到该班级数据','error');return;}const cls=deletedClasses[idx];const restored={id:Date.now().toString(),name:cls.name,students:JSON.parse(JSON.stringify(cls.students))};classesData.push(restored);deletedClasses.splice(idx,1);if(typeof _userDeletedClassIds!=='undefined'){_userDeletedClassIds=_userDeletedClassIds.filter(function(did){return did!=id;});}saveClassData();saveDeletedClasses();currentClassId=restored.id;renderClassList();scheduleAllRenders();showNotification('恢复成功',`班级【${cls.name}】已恢复`,'success');}
function permanentDeleteClass(id){if(!confirm('彻底删除后将无法恢复，确定？'))return;const idx=deletedClasses.findIndex(c=>c.id==id);if(idx!==-1){const name=deletedClasses[idx].name;deletedClasses.splice(idx,1);saveDeletedClasses();if(typeof _userDeletedClassIds!=='undefined'){_userDeletedClassIds=_userDeletedClassIds.filter(function(did){return did!=id;});}showNotification('已彻底删除',`班级【${name}】已永久删除`,'info');showDeletedClassesModal();if(typeof db!=='undefined'&&db&&typeof currentUser!=='undefined'&&currentUser){(async()=>{try{var r=await db.from('classes').select('id').eq('teacher_id',currentUser.id).eq('name',name).limit(1);if(r.data&&r.data.length>0){var targetId=r.data[0].id;const stuR=await db.from('students').select('id').eq('class_id',targetId);const studentIds=(stuR.data||[]).map(s=>s.id);if(studentIds.length>0){await db.from('pets').delete().in('student_id',studentIds);await db.from('students').delete().in('id',studentIds);}await db.from('custom_actions').delete().eq('class_id',targetId);await db.from('classes').delete().eq('id',targetId);console.log('[DAL] permanentDeleteClass: Supabase cleanup complete for class',targetId,'(requested id:',id,')');}else{console.warn('[DAL] permanentDeleteClass: class not found in Supabase by name:',name);}}catch(e){console.warn('[DAL] permanentDeleteClass: Supabase cleanup failed:',e);}})();}}}
function renderClassList(){ const c=document.getElementById('classListContainer'); if(!c){console.warn('[DAL] renderClassList: classListContainer not found');return;} const hiddenIds=getHiddenClassIds(); const visibleClasses=classesData.filter(cls=>!hiddenIds.includes(String(cls.id))); if(visibleClasses.length===0){c.innerHTML='<div style="text-align:center;padding:20px;">'+(classesData.length===0?'暂无班级，点击新建':'所有班级已隐藏<br><span style="font-size:12px;color:#999;">点击"隐藏班级"可显示</span>')+'</div>';return;} c.innerHTML=''; visibleClasses.forEach((cls,idx)=>{const card=document.createElement('div');card.className=`class-card ${currentClassId===cls.id?'active':''}`;card.draggable=true;card.dataset.classIdx=idx;card.innerHTML=`<button class="delete-class-btn" onclick="event.stopPropagation(); deleteClass('${cls.id}')">×</button><div class="class-name">${esc(cls.name)}</div><div style="display:flex;gap:15px;"><div>👨‍🎓 ${cls.students.length}</div><div>🐕 ${cls.students.reduce((s,stu)=>s+(stu.pets?.length||0),0)}</div></div>`;card.onclick=()=>{selectClass(cls.id);};card.addEventListener('dragstart',classDragStart);card.addEventListener('dragend',classDragEnd);card.addEventListener('dragover',classDragOver);card.addEventListener('dragleave',classDragLeave);card.addEventListener('drop',classDrop);c.appendChild(card);});}
let classDragIdx=null;
function classDragStart(e){classDragIdx=+this.dataset.classIdx;this.classList.add('dragging');e.dataTransfer.effectAllowed='move';}
function classDragEnd(e){this.classList.remove('dragging');classDragIdx=null;document.querySelectorAll('.class-card.drag-over').forEach(el=>el.classList.remove('drag-over'));}
function classDragOver(e){e.preventDefault();e.dataTransfer.dropEffect='move';if(+this.dataset.classIdx!==classDragIdx)this.classList.add('drag-over');}
function classDragLeave(e){this.classList.remove('drag-over');}
function classDrop(e){e.preventDefault();this.classList.remove('drag-over');const toIdx=+this.dataset.classIdx;if(classDragIdx===null||classDragIdx===toIdx)return;const moved=classesData.splice(classDragIdx,1)[0];classesData.splice(toIdx,0,moved);saveClassData();renderClassList();}
function selectClass(id){currentClassId=id;renderClassList();scheduleAllRenders();showNotification('班级切换','已切换','info');}
function createClass(){const n=prompt('班级名称');if(!n)return;
  // 检查数据库是否已存在同名班级（跨所有教师）
  if(typeof db!=='undefined'&&db){
    db.from('classes').select('id,name,teacher_id').eq('name',n.trim()).limit(1).then(function(r){
      if(r.error){console.error('[创建班级] 查询失败:',r.error.message);showNotification('创建失败','数据库查询错误，请重试','error');return;}
      if(r.data&&r.data.length>0){
        // 找到同名班级，检查是否是当前教师自己的
        const existingClass=r.data[0];
        if(existingClass.teacher_id===currentUser.id){
          showNotification('创建失败','你已经有同名班级「'+n.trim()+'」，请使用不同的名称','error');
        }else{
          showNotification('创建失败','系统中已存在班级「'+n.trim()+'」，为避免数据混乱，请使用不同的班级名称','error');
        }
        return;
      }
      // 没有同名班级，可以创建
      classesData.push({id:Date.now().toString(),name:n.trim(),students:[]});
      saveClassData();renderClassList();selectClass(classesData[classesData.length-1].id);
    });
  }else{
    // 离线模式：只检查本地
    if(classesData.some(c=>c.name===n.trim())){showNotification('创建失败','本地已有同名班级','error');return;}
    classesData.push({id:Date.now().toString(),name:n.trim(),students:[]});
    saveClassData();renderClassList();selectClass(classesData[classesData.length-1].id);
  }
}
function deleteClass(id){if(confirm('确定删除该班级？删除后可在"已删除班级"中恢复')){var cls=classesData.find(function(c){return c.id===id||c.id==id;});if(!cls){cls=classesData.find(function(c){return String(c.id)===String(id);});}var clsName=cls?cls.name:'';var clsIdForSync=cls?cls.id:id;if(cls){var snapshot={id:cls.id,name:cls.name,students:JSON.parse(JSON.stringify(cls.students)),deletedAt:new Date().toISOString()};deletedClasses.push(snapshot);if(deletedClasses.length>20)deletedClasses.shift();saveDeletedClasses();}classesData=classesData.filter(function(c){return String(c.id)!==String(id)&&(cls?String(c.id)!==String(cls.id):true);});if(currentClassId===id||currentClassId==id||(cls&&currentClassId==cls.id))currentClassId=classesData[0]?classesData[0].id:null;if(typeof customActions!=='undefined'){customActions=customActions.filter(function(a){return String(a.class_id)!==String(id);});}if(typeof _userDeletedClassIds!=='undefined'){if(_userDeletedClassIds.indexOf(clsIdForSync)===-1)_userDeletedClassIds.push(clsIdForSync);if(cls&&String(cls.id)!==String(clsIdForSync)&&_userDeletedClassIds.indexOf(cls.id)===-1){_userDeletedClassIds.push(cls.id);}}saveClassData();renderClassList();scheduleAllRenders();showNotification('班级已删除','可在"已删除班级"中恢复','info');if(typeof db!=='undefined'&&db&&typeof currentUser!=='undefined'&&currentUser){(async()=>{try{if(clsName){var r=await db.from('classes').select('id').eq('teacher_id',currentUser.id).eq('name',clsName).limit(1);if(r.data&&r.data.length>0){var sid=r.data[0].id;if(typeof _userDeletedClassIds!=='undefined'&&_userDeletedClassIds.indexOf(sid)===-1){_userDeletedClassIds.push(sid);}var stuR=await db.from('students').select('id').eq('class_id',sid);var sids=(stuR.data||[]).map(function(s){return s.id;});if(sids.length>0){await db.from('pets').delete().in('student_id',sids);await db.from('students').delete().in('id',sids);}await db.from('custom_actions').delete().eq('class_id',sid);await db.from('classes').delete().eq('id',sid);}else if(typeof _isValidInt4Id==='function'&&_isValidInt4Id(clsIdForSync)){await db.from('classes').delete().eq('id',clsIdForSync).eq('teacher_id',currentUser.id);}}console.log('[DAL] deleteClass: Supabase cleanup OK for',clsName||id);}catch(e){console.warn('[DAL] deleteClass: Supabase cleanup failed:',e.message);}})();}}}
function importFromTxt(){document.getElementById('txtImport').click();}
document.getElementById('txtImport').addEventListener('change',function(e){if(!currentClassId){showNotification('请先选择班级','','error');return;}const file=e.target.files[0];if(!file)return;const reader=new FileReader();reader.onload=function(ev){const text=ev.target.result;const names=text.split(/\r?\n/).filter(n=>n.trim());const cur=classesData.find(c=>c.id===currentClassId);names.forEach(name=>{if(!cur.students.find(s=>s.name===name.trim()))cur.students.push({id:_genLocalId(),name:name.trim(),coins:50,pets:[],lastCheckinDate:null,activePetId:null,pkCountToday:0,lastPkDate:null});});saveClassData();scheduleAllRenders();showNotification('导入成功',`添加${names.length}人`,'success');};reader.readAsText(file);this.value='';});
function classDailyCheckin(){ if(!currentClassId){showNotification('请先选择班级','请在左侧选择一个班级后再打卡','warning');return;} if(checkPauseAndNotify())return; const cur=classesData.find(c=>c.id===currentClassId); if(!cur){showNotification('班级数据异常','未找到当前班级数据','error');return;} if(!cur.students||cur.students.length===0){showNotification('暂无学生','请先添加学生','warning');return;} let checkedCount=0; let skipNoPet=0; cur.students.forEach(s=>{if(!s.pets||s.pets.length===0){skipNoPet++;return;} if(_hasCheckedInToday(s)){return;} s.coins+=10;s.lastCheckinDate=new Date().toISOString();recordAction(s.id, s.name, '全班打卡', '+10金币', 10, 0, null);checkedCount++;}); if(checkedCount===0){let reason='全班同学今天都已经打过卡了'; if(skipNoPet>0) reason+=`（${skipNoPet}人未领养宠物，不参与打卡）`; showNotification('今日已打卡',reason,'info');return;} saveClassData(); renderHomePetGrid(); if(currentModalStudentId) refreshCurrentStudentModal(); let msg=`${checkedCount}人打卡成功，每人+10金币`; if(skipNoPet>0) msg+=`（${skipNoPet}人未领养宠物，已跳过）`; showNotification('全班打卡',msg,'success'); }
function classAllFeed(){ if(!currentClassId){showNotification('请先选择班级','请在左侧选择一个班级后再喂食','warning');return;} if(checkPauseAndNotify())return; const cur=classesData.find(c=>c.id===currentClassId); if(!cur){showNotification('班级数据异常','未找到当前班级数据','error');return;} if(!cur.students||cur.students.length===0){showNotification('暂无学生','请先添加学生','warning');return;} let fedCount=0,skipDead=0,skipCoins=0,skipMax=0,skipNoPet=0,skipFed=0; const upgrades=[]; cur.students.forEach(s=>{const pet=getGrowablePet(s); if(!pet && (!s.pets||s.pets.length===0)){skipNoPet++;return;} if(!pet && s.pets.every(p=>p.level>=9)){skipMax++;return;} if(!pet && s.pets.every(p=>p.isDead)){skipDead++;return;} if(!pet){skipMax++;return;} if(_hasFedToday(pet)){skipFed++;return;} if(s.coins<5){skipCoins++;return;} let gain=2; pet.growth+=gain; s.coins-=5; pet.lastFeedDate=new Date().toISOString(); const upResult=updatePetLevel(s, pet.id, gain, true); if(upResult) upgrades.push(upResult); recordAction(s.id, s.name, '全班喂食', `${pet.nickname||pet.name} +${gain}成长值`, -5, gain, pet.id); fedCount++;}); if(fedCount===0){let reason=''; if(skipFed>0)reason+=`${skipFed}人今天已喂食 `; if(skipDead>0)reason+=`${skipDead}人宠物已死亡 `; if(skipCoins>0)reason+=`${skipCoins}人金币不足 `; if(skipMax>0)reason+=`${skipMax}人全部满级 `; if(skipNoPet>0)reason+=`${skipNoPet}人未领养宠物`; showNotification('无法喂食',reason||'没有可喂食的宠物','info');return;} saveClassData(); scheduleAllRenders(); if(currentModalStudentId) refreshCurrentStudentModal(); let msg=`${fedCount}只宠物喂食成功，每只+2成长值，-5金币`; if(skipFed+skipDead+skipCoins+skipMax+skipNoPet>0){let skips=[]; if(skipFed>0)skips.push(`${skipFed}人今天已喂食`); if(skipDead>0)skips.push(`${skipDead}人宠物已死亡`); if(skipCoins>0)skips.push(`${skipCoins}人金币不足`); if(skipMax>0)skips.push(`${skipMax}人全部满级`); if(skipNoPet>0)skips.push(`${skipNoPet}人未领养宠物`); msg+=`（跳过：${skips.join('、')}）`;} showNotification('全班喂食',msg,'success'); showBatchUpgradeNotice(upgrades); }
function showBatchUpgradeNotice(upgrades){ if(!upgrades||upgrades.length===0) return; const INTERVAL=4500; const MAX_INDIVIDUAL=3; function showOne(idx){ if(idx>=upgrades.length) return; const u=upgrades[idx]; showUpgradeEffect(u.petRealName, u.newLevel, u.cfgId, u.petName, u.oldLevel, u.studentName); setTimeout(()=>{ showNotification('🎉 宠物升级',`恭喜 ${u.studentName} 同学的 ${u.petName} 进化为${u.stageName}！`,'success'); },300); if(idx+1<upgrades.length){ setTimeout(()=>{ const container=document.getElementById('upgradeEffectContainer'); if(container){const overlays=container.querySelectorAll('.upgrade-overlay'); overlays.forEach(o=>o.remove());} showOne(idx+1); }, INTERVAL); } } if(upgrades.length<=MAX_INDIVIDUAL){ if(upgrades.length>1){ showNotification('🎉 升级预告',`本次共有 ${upgrades.length} 位同学的宠物升级，逐一展示！`,'success'); setTimeout(()=>showOne(0), 800); } else { showOne(0); } } else { showBatchUpgradeBoard(upgrades); } } function showBatchUpgradeBoard(upgrades){ const container=document.getElementById('upgradeEffectContainer'); const overlay=document.createElement('div'); overlay.className='upgrade-overlay'; overlay.style.cssText='position:fixed;top:0;left:0;right:0;bottom:0;z-index:100000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.7);backdrop-filter:blur(4px);animation:fadeIn 0.5s ease;'; const listHtml=upgrades.map((u,i)=>{ const cfg=PET_CONFIG[Object.keys(PET_CONFIG).find(k=>PET_CONFIG[k].id===u.cfgId)]; const emoji=cfg?cfg.emoji:'🐾'; const imgSrc=_img(`${u.cfgId}/${u.newLevel}.webp`); return `<div style="display:flex;align-items:center;gap:12px;padding:10px 18px;background:rgba(255,255,255,0.08);border-radius:14px;border:1px solid rgba(255,255,255,0.15);animation:fadeIn 0.5s ease ${i*0.08}s both;"><div style="width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg,#ffe0b2,#ffcc80);display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden;"><img src="${imgSrc}" style="width:40px;height:40px;object-fit:contain;" onerror="this.onerror=null;this.parentNode.innerHTML='<span style=\\'font-size:28px;\\'>${emoji}</span>';"></div><div style="flex:1;min-width:0;"><div style="font-size:16px;font-weight:700;color:#fff;">${esc(u.studentName)}</div><div style="font-size:13px;color:rgba(255,255,255,0.7);margin-top:2px;">${esc(u.petName)} → ${esc(u.stageName)}</div></div><div style="font-size:22px;">🎉</div></div>`; }).join(''); overlay.innerHTML=` <div style="background:linear-gradient(160deg,#1a1a2e 0%,#16213e 50%,#0f3460 100%);border-radius:28px;padding:35px 30px;max-width:520px;width:90%;max-height:80vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,0.5),inset 0 1px 0 rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.1);position:relative;overflow:hidden;"> <div style="position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,#e8637a,#f5a054,#ffd700,#e8637a);background-size:200% 100%;animation:shimmer 2s linear infinite;"></div> <div style="text-align:center;margin-bottom:20px;"> <div style="font-size:36px;margin-bottom:6px;">🏆✨🎊</div> <div style="font-size:24px;font-weight:800;color:#ffd700;text-shadow:0 0 20px rgba(255,215,0,0.4);">集体进化大成功！</div> <div style="font-size:15px;color:rgba(255,255,255,0.7);margin-top:6px;">恭喜以下 <strong style="color:#ff9800;font-size:18px;">${upgrades.length}</strong> 位同学的宠物升级</div> </div> <div style="flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:8px;padding-right:5px;min-height:0;"> ${listHtml} </div> <div style="text-align:center;margin-top:18px;padding-top:15px;border-top:1px solid rgba(255,255,255,0.1);"> <button onclick="this.closest('.upgrade-overlay').remove();" style="padding:10px 36px;border:none;border-radius:20px;background:linear-gradient(135deg,#e8637a,#f5a054);color:#fff;font-size:15px;font-weight:600;cursor:pointer;box-shadow:0 4px 15px rgba(232,99,122,0.4);transition:transform 0.2s;">太棒了！为他们鼓掌 👏</button> </div> </div>`; container.appendChild(overlay); overlay.addEventListener('click',(e)=>{if(e.target===overlay)overlay.remove();}); setTimeout(()=>{if(overlay.parentNode)overlay.remove();},15000); playUpgradeSound(); }
function clearPetData(){ if(!currentClassId) return; if(!confirm('重置所有宠物数据？')) return; const cur = classesData.find(c=>c.id===currentClassId); if(!cur) return; const snapshot = JSON.parse(JSON.stringify(cur.students)); cur.students.forEach(s=>{ s.pets = []; s.coins = 50; s.lastCheckinDate = null; s.activePetId = null; s.pkCountToday = 0; s.lastPkDate = null; }); saveClassData(); recordResetAction(cur.id, cur.name, snapshot); scheduleAllRenders(); if(currentModalStudentId) closeModal(); showNotification('重置完成','宠物数据已清空','success'); }

// === 隐藏/显示班级功能（教师专用）===
function getHiddenClassIds(){
  try { return JSON.parse(localStorage.getItem('hiddenClassIds')) || []; } catch(e) { return []; }
}
function saveHiddenClassIds(ids){
  try { localStorage.setItem('hiddenClassIds', JSON.stringify(ids)); } catch(e) {}
}
function showHideClassModal(){
  if(!currentUser || currentUser.type !== 'teacher'){ showNotification('无权限','仅教师可操作','warning'); return; }
  if(!classesData || classesData.length === 0){ showNotification('暂无班级','请先创建班级','info'); return; }
  const hiddenIds = getHiddenClassIds();
  let html = '<div style="max-height:400px;overflow-y:auto;padding:10px 0;">';
  classesData.forEach(cls => {
    const isHidden = hiddenIds.includes(String(cls.id));
    const statusText = isHidden ? '<span style="color:#999;font-size:12px;margin-left:8px;">(已隐藏)</span>' : '<span style="color:#4a9e4a;font-size:12px;margin-left:8px;">(可见)</span>';
    html += `<label style="display:flex;align-items:center;gap:12px;padding:12px 16px;margin:6px 0;background:${isHidden?'#f5f5f5':'#fff'};border-radius:10px;cursor:pointer;transition:background 0.2s;border:1px solid ${isHidden?'#ddd':'#e8e8e8'};">
      <input type="checkbox" class="hide-class-checkbox" data-class-id="${cls.id}" ${isHidden?'checked':''} style="width:20px;height:20px;cursor:pointer;">
      <span style="flex:1;font-size:15px;font-weight:500;">${esc(cls.name)}</span>
      ${statusText}
    </label>`;
  });
  html += '</div>';
  html += '<div style="display:flex;gap:10px;margin-top:16px;justify-content:center;">';
  html += '<button class="btn btn-secondary" onclick="hideSelectedClasses()" style="background:linear-gradient(135deg,#95a5a6,#7f8c8d);">👁️ 隐藏选中</button>';
  html += '<button class="btn btn-success" onclick="showSelectedClasses()">✅ 显示选中</button>';
  html += '<button class="btn btn-secondary" onclick="closeModal()">取消</button>';
  html += '</div>';
  showModal('👁️ 隐藏/显示班级', html, [], false);
}
function hideSelectedClasses(){
  const checkboxes = document.querySelectorAll('.hide-class-checkbox:checked');
  if(checkboxes.length === 0){ showNotification('未选择','请先选择要隐藏的班级','info'); return; }
  const hiddenIds = getHiddenClassIds();
  let hideCount = 0;
  checkboxes.forEach(cb => {
    const classId = String(cb.dataset.classId);
    if(!hiddenIds.includes(classId)){
      hiddenIds.push(classId);
      hideCount++;
    }
  });
  saveHiddenClassIds(hiddenIds);
  // 如果当前选中的班级被隐藏了，切换到第一个可见的班级
  if(hiddenIds.includes(String(currentClassId))){
    const visibleClass = classesData.find(c => !hiddenIds.includes(String(c.id)));
    if(visibleClass) currentClassId = visibleClass.id;
    else currentClassId = null;
  }
  renderClassList();
  scheduleAllRenders();
  closeModal();
  showNotification('隐藏成功', `已隐藏 ${hideCount} 个班级`, 'success');
}
function showSelectedClasses(){
  const checkboxes = document.querySelectorAll('.hide-class-checkbox:checked');
  if(checkboxes.length === 0){ showNotification('未选择','请先选择要显示的班级','info'); return; }
  const hiddenIds = getHiddenClassIds();
  let showCount = 0;
  checkboxes.forEach(cb => {
    const classId = String(cb.dataset.classId);
    const idx = hiddenIds.indexOf(classId);
    if(idx !== -1){
      hiddenIds.splice(idx, 1);
      showCount++;
    }
  });
  saveHiddenClassIds(hiddenIds);
  renderClassList();
  scheduleAllRenders();
  closeModal();
  showNotification('显示成功', `已显示 ${showCount} 个班级`, 'success');
}

// === 重置学生密码弹窗（教师专用）===
var _resetPwdSelectedStudentId = null;
function showResetPasswordModal() {
  const cur = classesData.find(c => c.id === currentClassId);
  if (!cur || cur.students.length === 0) {
    showNotification('无法重置', '当前班级没有学生', 'warning');
    return;
  }
  _resetPwdSelectedStudentId = null;
  _renderResetPasswordModal(cur.students, null);
}

function _renderResetPasswordModal(students, selectedId) {
  var html = '<div style="position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;" id="resetPasswordModal">';
  html += '<div style="background:#fff;border-radius:20px;padding:24px;width:1100px;max-width:95vw;height:650px;max-height:90vh;display:flex;flex-direction:column;box-shadow:0 12px 40px rgba(0,0,0,0.3);">';

  // Header
  html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">';
  html += '<div style="font-size:18px;font-weight:700;">🔑 重置学生密码</div>';
  html += '<button onclick="closeResetPasswordModal()" style="background:none;border:none;font-size:24px;cursor:pointer;color:#999;">×</button>';
  html += '</div>';

  // Description
  html += '<div style="font-size:13px;color:#888;margin-bottom:14px;">点击学生姓名选中，然后点击「重置密码」按钮。重置后该学生下次登录时可重新设置新密码，所有游戏记录不会丢失。</div>';

  // Student list
  html += '<div style="display:flex;flex-wrap:wrap;gap:6px;flex:1;min-height:0;overflow-y:auto;border:1.5px solid rgba(255,210,200,0.6);border-radius:18px;padding:12px;margin-bottom:14px;background:#fffaf5;align-content:flex-start;">';
  students.forEach(function(stu) {
    var isSelected = selectedId && selectedId.toString() === stu.id.toString();
    var bgColor = isSelected ? '#e8ffe8' : '#fff';
    var borderColor = isSelected ? '#52c41a' : '#ffe2d6';
    html += '<div onclick="onResetPwdStudentClick(' + stu.id + ')" id="resetPwdStu_' + stu.id + '" style="display:flex;align-items:center;padding:5px 10px;border:1.5px solid ' + borderColor + ';border-radius:12px;gap:6px;background:' + bgColor + ';font-size:14px;white-space:nowrap;cursor:pointer;transition:all 0.15s;">';
    if (isSelected) {
      html += '<span style="width:16px;height:16px;border-radius:50%;background:#52c41a;color:#fff;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:bold;flex-shrink:0;">✓</span>';
    } else {
      html += '<span style="width:16px;height:16px;border-radius:50%;border:1.5px solid #ddd;flex-shrink:0;"></span>';
    }
    html += '<span style="font-weight:600;">' + esc(stu.name || '未命名') + '</span>';
    html += '<span style="font-size:12px;color:#999;">💰' + (stu.coins || 0) + '</span>';
    html += '</div>';
  });
  html += '</div>';

  // Bottom action area
  html += '<div id="resetPwdActionWrap" style="margin-bottom:10px;text-align:center;' + (selectedId ? '' : 'display:none;') + '">';
  if (selectedId) {
    var selStudent = students.find(function(s) { return s.id.toString() === selectedId.toString(); });
    if (selStudent) {
      html += '<div style="font-size:13px;color:#555;margin-bottom:8px;">已选中：<strong style="color:#d4760a;">' + esc(selStudent.name) + '</strong></div>';
    }
    html += '<div style="display:flex;gap:10px;justify-content:center;">';
    html += '<button onclick="confirmResetPassword()" style="background:linear-gradient(135deg,#ff9800,#f57c00);color:#fff;border:none;border-radius:14px;padding:13px 36px;font-size:17px;font-weight:700;cursor:pointer;box-shadow:0 4px 14px rgba(255,152,0,0.4);transition:all 0.2s;flex:1;max-width:200px;" onmouseenter="this.style.transform=\'scale(1.02)\'" onmouseleave="this.style.transform=\'scale(1)\'">🔑 重置密码</button>';
    html += '<button onclick="cancelResetPwdSelection()" style="background:#f0f0f0;color:#666;border:none;border-radius:14px;padding:13px 36px;font-size:17px;font-weight:700;cursor:pointer;flex:1;max-width:200px;">取消</button>';
    html += '</div>';
  }
  html += '</div>';

  // Close button
  html += '<div style="text-align:center;">';
  html += '<button onclick="closeResetPasswordModal()" style="background:#f0f0f0;color:#666;border:none;border-radius:12px;padding:10px 28px;font-size:14px;font-weight:700;cursor:pointer;">关闭</button>';
  html += '</div>';
  html += '</div></div>';

  var container = document.getElementById('modalContainer');
  if (container) container.innerHTML = html;
}

window.onResetPwdStudentClick = function(studentId) {
  _resetPwdSelectedStudentId = parseInt(studentId);
  const cur = classesData.find(c => c.id === currentClassId);
  if (cur) _renderResetPasswordModal(cur.students, studentId);
};

window.cancelResetPwdSelection = function() {
  _resetPwdSelectedStudentId = null;
  const cur = classesData.find(c => c.id === currentClassId);
  if (cur) _renderResetPasswordModal(cur.students, null);
};

window.closeResetPasswordModal = function() {
  var container = document.getElementById('modalContainer');
  if (container) container.innerHTML = '';
  _resetPwdSelectedStudentId = null;
};

window.confirmResetPassword = function() {
  if (!_resetPwdSelectedStudentId) return;
  const cur = classesData.find(c => c.id === currentClassId);
  if (!cur) return;
  const stu = cur.students.find(s => s.id.toString() === _resetPwdSelectedStudentId.toString());
  if (!stu) return;

  if (!confirm('确定要重置学生「' + stu.name + '」的密码吗？\n重置后该学生下次登录时可重新设置新密码，所有游戏记录不会丢失。')) return;

  // Clear the password in local data
  stu.password = '';

  // Save to Supabase directly for immediate effect
  if (typeof db !== 'undefined' && db) {
    db.from('students').update({ password: '' }).eq('id', stu.id).then(function(r) {
      if (r.error) {
        console.error('[重置密码] 保存失败:', r.error.message);
        showNotification('重置失败', r.error.message, 'error');
        return;
      }
      // Also save via normal sync to keep local and remote in sync
      saveClassData();
      showNotification('重置成功', '学生「' + stu.name + '」的密码已重置，下次登录时可设置新密码', 'success');
      closeResetPasswordModal();
    });
  } else {
    saveClassData();
    showNotification('重置成功', '学生「' + stu.name + '」的密码已重置', 'success');
    closeResetPasswordModal();
  }
};
function getActivePet(student){ if(!student.pets || student.pets.length===0) return null; if(student.activePetId && student.pets.some(p=>Number(p.id)===Number(student.activePetId))) return student.pets.find(p=>Number(p.id)===Number(student.activePetId)); return student.pets[0]; }
function getGrowablePet(student){ if(!student.pets || student.pets.length===0) return null; const active=getActivePet(student); if(active && !active.isDead && active.level<9) return active; return student.pets.find(p=>!p.isDead && p.level<9) || null; }
function countMaxedPets(student){ if(!student.pets) return 0; return student.pets.filter(p=>p.level>=9).length; }
function adoptNewPet(student, petName, nickname){ const cfg = PET_CONFIG[petName]; if(!cfg) return false; if(student.pets.length>0 && student.pets.some(p=>p.level<9)){showNotification('无法领养','还有未满级的宠物，需要全部满级后才能领养新宠物','warning');return false;} const newPet = { id: _genLocalId(), name: petName, nickname, level: 1, growth: 0, lastFeedDate: new Date().toISOString(), todayFeedCount: 0, isDead: false, todayPlayCount: 0, lastPlayDate: null, penaltyStreak: 0 }; student.pets.push(newPet); student.activePetId = newPet.id; saveClassData(); scheduleAllRenders(); showNotification('领养成功',`${nickname} 加入宠物大家庭，现已激活！`,'success'); return true; }
function _hasFedToday(pet){
  if(!pet||!pet.lastFeedDate) return false;
  const last=new Date(pet.lastFeedDate);
  const now=new Date();
  return last.getFullYear()===now.getFullYear()&&last.getMonth()===now.getMonth()&&last.getDate()===now.getDate();
}
// v37: Check if student has already checked in today (via lastCheckinDate or operation logs)
function _hasCheckedInToday(student){
  const today = new Date().toDateString();
  
  // Check lastCheckinDate first
  if(student.lastCheckinDate && new Date(student.lastCheckinDate).toDateString() === today){
    return true;
  }
  
  // Also check operation logs as a safety net
  const logs = getOpLogs();
  return logs.some(log => 
    log.studentId == student.id && 
    (log.actionType === '每日打卡' || log.actionType === '全班打卡') && 
    new Date(log.timestamp).toDateString() === today &&
    !log.reverted
  );
}
function feedPet(student, pet){
  if(pet.isDead){showNotification('喂食失败','宠物已经死亡，请先复活','error');return false;}
  if(student.coins<5){showNotification('金币不足','喂食需要5金币','error');return false;}
  if(pet.level >= 9){ showNotification('已达万物之神',`${pet.nickname||pet.name}已满级，快去领养新宠物吧！`,'warning'); return false; }
  if(_hasFedToday(pet)){ showNotification('今日已喂食',`${pet.nickname||pet.name}今天已经喂食过了，每天只能喂食一次哦！`,'info'); return false; }
  let gain=2; // 固定2点成长，不受商店道具影响
  pet.growth+=gain; student.coins-=5; pet.lastFeedDate=new Date().toISOString(); pet.isDead=false;
  updatePetLevel(student, pet.id, gain);
  recordAction(student.id, student.name, '喂食', `${pet.nickname||pet.name} +${gain}成长值`, -5, gain, pet.id);
  showNotification('喂食成功',`${pet.nickname||pet.name} 获得 ${gain} 成长值！`,'success');
  return true;
}
function updatePetLevel(student, petId, growthDelta=0, silent=false) { const pet = student.pets.find(p=>p.id===petId); if(!pet) return false; const cfg = PET_CONFIG[pet.name]; if(!cfg) return false; let oldLevel = pet.level; let newLevel = 1; for(let i=cfg.stages.length-1;i>=0;i--) if(pet.growth>=cfg.stages[i].growthRequired){ newLevel=cfg.stages[i].stage; break; } if(pet.growth < 0) pet.growth = 0; const _maxGrowth = cfg.stages[cfg.stages.length-1].growthRequired; if(newLevel >= 9 && pet.growth > _maxGrowth){ pet.growth = _maxGrowth; } if(newLevel !== oldLevel){ const wasUpgrade = newLevel > oldLevel; pet.level = newLevel; if(newLevel >= 9){ pet.growth = Math.min(pet.growth, _maxGrowth); } const stageName = cfg.stages[newLevel-1]?.stageName||`阶段${newLevel}`; if(wasUpgrade && !silent){ showUpgradeEffect(pet.name, newLevel, cfg.id, pet.nickname||pet.name, oldLevel, student.name); showNotification('宠物升级',`🎉 恭喜 ${student.name} 同学的 ${pet.nickname||pet.name} 升到${stageName}！`,'success'); } if(!silent){ scheduleAllRenders(); if(currentModalStudentId && student.id.toString()===currentModalStudentId.toString()) refreshCurrentStudentModal(); } return {studentName:student.name, petName:pet.nickname||pet.name, petRealName:pet.name, newLevel:newLevel, oldLevel:oldLevel, stageName:stageName, cfgId:cfg.id, isUpgrade:wasUpgrade}; } return false; }
function getStudentShopEffects(student){
  const owned=student.shopItems||[];if(owned.length===0)return{borderClasses:[],topHtml:'',baseHtml:'',particleHtml:'',titleHtml:'',sceneClass:''};
  const eq=getEquippedItems(student);
  const borderClasses=[];let topHtml='',baseHtml='',particleHtml='',titleHtml='',sceneClass='';
  const topEmojis={'pet-top-halo':'😇','pet-top-crown':'👑','pet-top-bow':'🎀','pet-top-horns':'😈','pet-top-flower':'🌸'};
  const ptclEmojis={'pet-ptcl-hearts':'💕','pet-ptcl-stars':'⭐','pet-ptcl-snow':'❄️','pet-ptcl-sakura':'🌸','pet-ptcl-firefly':'','pet-ptcl-thunder':''};
  const titleNames={'pet-title-xueba':'学霸','pet-title-juanwang':'卷王','pet-title-wulin':'武林盟主','pet-title-dragon':'真龙天子','pet-title-legend':'不朽传说'};
  // Only render effects for equipped items
  const equippedIds=Object.values(eq).filter(id=>owned.includes(id));
  equippedIds.forEach(id=>{const item=getShopItemById(id);if(!item||!item.css)return;const css=item.css;
    if(css.startsWith('pet-border-'))borderClasses.push(css);
    else if(css.startsWith('pet-top-'))topHtml=`<div class="shop-top-accessory ${css}">${topEmojis[css]||'✨'}</div>`;
    else if(css.startsWith('pet-base-'))baseHtml=`<div class="shop-base-effect ${css}"></div>`;
    else if(css.startsWith('pet-ptcl-')){const e=ptclEmojis[css];const dots=Array.from({length:6},()=>`<span class="sp">${e}</span>`).join('');particleHtml=`<div class="shop-particles ${css}">${dots}</div>`;}
    else if(css.startsWith('pet-title-'))titleHtml=`<div class="shop-title-badge ${css}">${titleNames[css]||''}</div>`;
    else if(css.startsWith('pet-scene-'))sceneClass=css;
  });return{borderClasses,topHtml,baseHtml,particleHtml,titleHtml,sceneClass};
}
/* ===== 一键排序功能 ===== */
// 每个班级独立的排序模式: { classId: mode } mode: 0=默认(不排序), 1=按特效数量, 2=按成长值, 3=按金币
const _SORT_LABELS = ['🔀 一键排序', '🔀 按特效数↓', '🔀 按成长值↓', '🔀 按金币↓'];
const _SORT_STORAGE_KEY = 'petSortModes';

function _loadSortModes() {
  try {
    var saved = localStorage.getItem(_SORT_STORAGE_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch(e) { return {}; }
}

function _saveSortModes() {
  try { localStorage.setItem(_SORT_STORAGE_KEY, JSON.stringify(_petSortModes)); } catch(e) {}
}

let _petSortModes = _loadSortModes();

function _countEquippedEffects(student) {
  const eq = student.equippedItems || {};
  const owned = student.shopItems || [];
  return Object.values(eq).filter(id => owned.includes(id)).length;
}

function _getPetGrowth(student) {
  const pet = getActivePet(student);
  return pet ? (pet.growth || 0) : 0;
}

function _hasPet(student) {
  return student.pets && student.pets.length > 0;
}

function _isTeacher() {
  return typeof currentUser !== 'undefined' && currentUser && currentUser.type === 'teacher';
}

function cycleSortPets() {
  if (!currentClassId || !_isTeacher()) return;
  var currentMode = _petSortModes[currentClassId] || 0;
  var newMode = (currentMode % 3) + 1; // cycle: 1→2→3→1
  _petSortModes[currentClassId] = newMode;
  _saveSortModes();
  var btn = document.getElementById('sortPetsBtn');
  if (btn) btn.innerHTML = '<span>' + _SORT_LABELS[newMode].split(' ')[0] + '</span> ' + _SORT_LABELS[newMode].split(' ').slice(1).join(' ');
  renderHomePetGrid();
  const modeNames = ['', '特效数量', '成长值', '金币'];
  showNotification('排序已切换', '当前按' + modeNames[newMode] + '从多到少排序', 'info');
}
window.cycleSortPets = cycleSortPets;

function _getSortedStudents(students, mode) {
  var arr = students.slice(); // shallow copy, don't mutate original
  if (mode === 1) {
    // 按特效数量从多到少，未领养宠物的学生排最后
    var withPets = arr.filter(_hasPet);
    var noPets = arr.filter(function(s) { return !_hasPet(s); });
    withPets.sort(function(a, b) { return _countEquippedEffects(b) - _countEquippedEffects(a); });
    arr = withPets.concat(noPets);
  } else if (mode === 2) {
    // 按成长值从多到少，未领养宠物的学生排最后
    var withPets = arr.filter(_hasPet);
    var noPets = arr.filter(function(s) { return !_hasPet(s); });
    withPets.sort(function(a, b) { return _getPetGrowth(b) - _getPetGrowth(a); });
    arr = withPets.concat(noPets);
  } else if (mode === 3) {
    // 按金币持有量从多到少，未领养宠物的学生排最后
    var withPets = arr.filter(_hasPet);
    var noPets = arr.filter(function(s) { return !_hasPet(s); });
    withPets.sort(function(a, b) { return (b.coins || 0) - (a.coins || 0); });
    arr = withPets.concat(noPets);
  }
  return arr;
}

/* ===== 无限滚动：分批渲染宠物卡片 ===== */
let _gridStudents=[], _gridRenderedCount=0;
const _GRID_BATCH_SIZE=12;
let _gridObserver=null, _gridBatchBusy=false;

/* 快速计算学生数据哈希，用于 DOM diff 判断卡片是否需要更新 */
function _studentDataHash(s) {
  var p = getActivePet(s);
  // v71: Include shopItems and equippedItems in hash so card re-renders when items change
  // (e.g., purchasing an effect that doesn't change coins enough to notice)
  var itemsHash = '';
  try {
    itemsHash = '_' + JSON.stringify(s.shopItems || []) + '_' + JSON.stringify(s.equippedItems || {});
  } catch(e) { itemsHash = ''; }
  if (!p) return s.id + '_nopet_' + (s.coins||0) + itemsHash;
  return s.id + '_' + (s.coins||0) + '_' + (p.id||'') + '_' + (p.growth||0) + '_' + (p.level||0) + '_' + (p.isDead?'d':'a') + '_' + (p.lastFeedDate||'') + '_' + (s.pets?s.pets.length:0) + itemsHash;
}

function _generateStudentCardHTML(s){
  updatePetDeathStatus(s);const activePet = getActivePet(s);
  if(activePet){const p=activePet; const need=getExpNeeded(p); const lastDate=p.lastFeedDate?new Date(p.lastFeedDate):null; let timeTip=''; if(p.level>=9){timeTip='👑 已满级';}else if(isPauseActive()){timeTip='🛡️ 假期保护中';}else if(!p.isDead&&lastDate){if(_hasFedToday(p)){timeTip='✅ 今日已喂食';}else{const hours=getEffectiveUnfedHours(p); timeTip=hours<24?`⏰ ${Math.floor(hours)}小时前喂`:hours>=1440?`🔴 ${Math.floor(hours/24)}天未喂`:`⚠️ ${Math.floor(hours/24)}天未喂`;}}else if(p.isDead)timeTip='💀 已饿死';
  const maxed=countMaxedPets(s); const totalPets=s.pets.length; const hasLegend=maxed>0; const isPetMax=p.level>=9; const fx=getStudentShopEffects(s); const cardClass='home-pet-card'; const innerClass='home-pet-inner'+(hasLegend?' has-legend':'')+(isPetMax?' pet-maxed':'')+(fx.borderClasses.length?' '+fx.borderClasses.join(' '):'');
  let multiBadge=''; if(totalPets>1) multiBadge=`<div class="multi-pet-badge multi">🐾×${totalPets}</div>`;
  const growable=getGrowablePet(s); const growHint=(p.level>=9 && growable && growable.id!==p.id)?`<div class="growable-pet-hint">🌱 ${esc(growable.nickname||growable.name)} 培养中</div>`:(p.level>=9 && !growable)?`<div class="growable-pet-hint">⭐ 全部满级</div>`:'';
  // 检查宠物是否正在出逃（用于DOM重建时保持出逃状态）
  const isEscaped = window._escapedPetIds && window._escapedPetIds.has(String(p.id));
  const petImgStyle = isEscaped ? 'opacity:0;transition:opacity 0.3s;' : '';
  const petImgAttr = isEscaped ? 'data-escape-hidden="1"' : '';
  const escapeHint = isEscaped ? '<div class="escape-empty-hint" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:13px;color:#cba090;font-weight:700;pointer-events:none;text-align:center;line-height:1.6;">🐾<br>出逃中…</div>' : '';
  return `<div class="${cardClass}" data-sid="${s.id}" data-hash="${_studentDataHash(s)}" onclick="openStudentModal('${s.id}')">${fx.topHtml}<div class="${innerClass}">${fx.particleHtml}${p.level<2?`<button class="change-pet-btn" onclick="event.stopPropagation();showChangePetModal('${s.id}')">🔄</button>`:''}${s.pets.length>1?`<button class="switch-pet-btn" onclick="event.stopPropagation();showSwitchPetModal('${s.id}')">🔀 切换</button>`:''}<div class="home-pet-top${fx.sceneClass?' '+fx.sceneClass:''}"><div style="position:relative;width:100%;height:100%;display:flex;align-items:center;justify-content:center;">${fx.baseHtml}${getPetImage(p.name, p.level||1).replace('<img ', `<img style="${petImgStyle}" ${petImgAttr} `)}${p.isDead?'<div class="dead-pet-overlay">💀</div>':''}${escapeHint}</div></div><div class="home-pet-level-badge">${isPetMax?'👑 MAX':'Lv.'+(p.level||1)}</div>${multiBadge}${fx.titleHtml}<div class="home-pet-middle">${esc(s.name)}·${esc(p.nickname||p.name)}<span class="rename-pet-btn" onclick="event.stopPropagation();renamePet('${s.id}','${p.id}')" title="修改宠物名字">✏️</span></div><div class="home-pet-bottom"><div class="home-pet-bottom-row"><span class="pet-bottom-growth">成长:${p.level>=9?need:(p.growth||0)}/${need}</span><span class="pet-bottom-coins">💰${s.coins||0}</span></div><div class="feed-warning">${timeTip}</div>${growHint}</div></div></div>`;
  }else{return `<div class="home-pet-card" data-sid="${s.id}" data-hash="${_studentDataHash(s)}" onclick="showAdoptModal('${s.id}')"><div class="home-pet-inner"><div class="home-pet-top"><div style="position:relative;width:100%;height:100%;display:flex;align-items:center;justify-content:center;">${getEggImage()}</div></div><div class="home-pet-middle">${esc(s.name)}</div><div class="home-pet-bottom"><button class="btn btn-primary btn-small">领养宠物</button></div></div></div>`;}}

function _renderGridBatch(grid){
  if(_gridBatchBusy) return;
  _gridBatchBusy=true;
  const end=Math.min(_gridRenderedCount+_GRID_BATCH_SIZE, _gridStudents.length);
  let html='';
  for(let i=_gridRenderedCount;i<end;i++){html+=_generateStudentCardHTML(_gridStudents[i]);}
  _gridRenderedCount=end;
  grid.insertAdjacentHTML('beforeend',html);
  _applyGridBatchPostProcess();
  _gridBatchBusy=false;
}

function _applyGridBatchPostProcess(){
  document.querySelectorAll('.home-pet-card').forEach(function(card,i){
    card.style.animationDelay=(i%6)*0.5+'s';
    card.style.animationDuration=(2.5+Math.random()*1.5)+'s';
  });
  if(window.__initBreathingDelays) window.__initBreathingDelays();
  if(typeof attachCardHeartListeners==='function') attachCardHeartListeners();
  if(typeof bindPetCardDrag==='function') bindPetCardDrag();
  if(typeof currentUser!=='undefined' && currentUser && currentUser.type==='student'){
    var myId=currentUser.studentId.toString();
    document.querySelectorAll('.home-pet-card').forEach(function(card){
      var onclick=card.getAttribute('onclick')||'';
      if(onclick.indexOf("'"+myId+"'")===-1 && onclick.indexOf('"'+myId+'"')===-1){
        card.querySelectorAll('button').forEach(function(btn){
          var btnOnclick=btn.getAttribute('onclick')||'';
          if(btnOnclick.indexOf('showChangePetModal')!==-1||btnOnclick.indexOf('showSwitchPetModal')!==-1||btnOnclick.indexOf('renamePet')!==-1){btn.style.display='none';}
        });
      }
    });
  }
}

function renderHomePetGrid(){ const grid=document.getElementById('homePetGrid');
  if(_gridObserver){_gridObserver.disconnect();_gridObserver=null;}
  const oldSentinel=document.getElementById('grid-scroll-sentinel');if(oldSentinel)oldSentinel.remove();
  // 控制排序按钮可见性（仅教师可见，包括移动端）
  var _sortBtn = document.getElementById('sortPetsBtn');
  if (_sortBtn) {
    _sortBtn.style.display = _isTeacher() ? '' : 'none';
  }
  // 控制重置密码按钮可见性（仅教师可见，包括移动端）
  var _resetPwdBtn = document.querySelector('.teacher-only');
  if (_resetPwdBtn) {
    _resetPwdBtn.style.display = _isTeacher() ? '' : 'none';
  }
  if(!currentClassId||!classesData.some(c=>c.id===currentClassId)){grid.innerHTML='<div class="empty-deco" style="width:100%;"><div class="empty-deco-img">🏫</div><div class="empty-deco-text">请先选择或创建一个班级</div><div class="empty-deco-sub">点击上方「新建班级」开始你的宠物之旅~</div></div>';return;}
  const cur=classesData.find(c=>c.id===currentClassId);
  if(cur.students.length===0){grid.innerHTML='<div class="empty-deco" style="width:100%;cursor:pointer;" onclick="addSingleStudent()"><div class="empty-deco-img">🐣</div><div class="empty-deco-text">还没有小伙伴呢</div><div class="empty-deco-sub">点击这里添加第一个学生吧~</div></div>';return;}
  // 使用排序模式（仅教师账户下生效）
  var _sortMode = _isTeacher() ? (_petSortModes[currentClassId] || 0) : 0;
  _gridStudents = _sortMode > 0 ? _getSortedStudents(cur.students, _sortMode) : cur.students;
  // 更新排序按钮显示（切换班级时保持正确状态）
  if (_sortBtn && _isTeacher()) {
    var _curMode = _petSortModes[currentClassId] || 0;
    _sortBtn.innerHTML = '<span>' + _SORT_LABELS[_curMode].split(' ')[0] + '</span> ' + _SORT_LABELS[_curMode].split(' ').slice(1).join(' ');
  }
  // === DOM diff: 增量更新卡片，避免全量重建导致闪烁 ===
  var existingCards = {};
  grid.querySelectorAll('.home-pet-card[data-sid]').forEach(function(card) {
    existingCards[card.dataset.sid] = card;
  });
  var newSids = {};
  _gridStudents.forEach(function(s) { newSids[s.id] = true; });
  // 移除不再存在的学生卡片
  Object.keys(existingCards).forEach(function(sid) {
    if (!newSids[sid]) existingCards[sid].remove();
  });
  // 检查是否有需要更新或新增的卡片
  var needsFullRebuild = false;
  var changedSids = [];
  _gridStudents.forEach(function(s) {
    var existing = existingCards[s.id];
    var newHash = _studentDataHash(s);
    if (!existing) {
      needsFullRebuild = true; // 新学生，需要创建卡片
    } else if (existing.dataset.hash !== newHash) {
      changedSids.push(s.id); // 数据变了，需要更新
    }
    // else: hash 相同，跳过
  });
  // 如果没有新增也没有变化，直接返回（最快路径）
  if (!needsFullRebuild && changedSids.length === 0 && Object.keys(existingCards).length === _gridStudents.length) {
    return;
  }
  // 如果有新增卡片或排序变了，做全量重建（保持排序正确）
  if (needsFullRebuild || changedSids.length > 2) {
    _gridRenderedCount = 0; grid.innerHTML = '';
    _renderGridBatch(grid);
    if(_gridRenderedCount<_gridStudents.length){
      const sentinel=document.createElement('div');sentinel.id='grid-scroll-sentinel';sentinel.style.cssText='height:1px;width:100%;';
      grid.parentNode.insertBefore(sentinel,grid.nextSibling);
      if(_gridObserver) _gridObserver.disconnect();
      _gridObserver=new IntersectionObserver((entries)=>{
        if(entries[0].isIntersecting && _gridRenderedCount<_gridStudents.length){
          _renderGridBatch(grid);
          if(_gridRenderedCount>=_gridStudents.length){_gridObserver.disconnect();sentinel.remove();}
        }
      },{rootMargin:'300px'});
      _gridObserver.observe(sentinel);
      requestAnimationFrame(()=>_gridCheckSentinel(grid,sentinel));
    }
  } else {
    // 只更新变化的卡片（少量变化，1-2张卡片）
    changedSids.forEach(function(sid) {
      var oldCard = existingCards[sid];
      if (!oldCard) return;
      var s = _gridStudents.find(function(st) { return st.id == sid; });
      if (!s) return;
      var temp = document.createElement('div');
      temp.innerHTML = _generateStudentCardHTML(s);
      var newCard = temp.firstElementChild;
      if (newCard) oldCard.replaceWith(newCard);
    });
    _gridRenderedCount = _gridStudents.length; // 标记全部已渲染
    _applyGridBatchPostProcess();
  }
}
function _gridCheckSentinel(grid,sentinel){
  if(!sentinel.parentNode||_gridRenderedCount>=_gridStudents.length) return;
  const r=sentinel.getBoundingClientRect();
  if(r.top<window.innerHeight+100){
    _renderGridBatch(grid);
    if(_gridRenderedCount>=_gridStudents.length){if(_gridObserver)_gridObserver.disconnect();sentinel.remove();return;}
    requestAnimationFrame(()=>_gridCheckSentinel(grid,sentinel));
  }
}
/* 满级卡片粒子特效 - 已禁用(防止抖动) */
let _maxedSparkleTimer=null;
function startMaxedSparkles(){
  /* disabled to prevent jittering */
}
const _origRenderHomePetGrid=renderHomePetGrid;
renderHomePetGrid=function(){_origRenderHomePetGrid();startMaxedSparkles();};
startMaxedSparkles();

function getExpNeeded(pet){const cfg=PET_CONFIG[pet.name];if(!cfg)return 0;const nextStage=cfg.stages.find(s=>s.stage===pet.level+1);return nextStage?nextStage.growthRequired:cfg.stages[cfg.stages.length-1].growthRequired;}
function updatePetDeathStatus(student){if(!student.pets||student.pets.length===0)return; if(isPauseActive())return; student.pets.forEach(pet=>{if(pet.isDead)return; if(pet.level>=9)return; if(isPetStarved(pet)){const prevGrowth=pet.growth;const prevLevel=pet.level;pet.isDead=true; pet.deathGrowth=pet.growth; pet.deathDate=new Date().toISOString();recordAction(student.id, student.name, '饿死', `${pet.nickname||pet.name} 因超过70天未喂食而饿死（Lv.${prevLevel}，成长值${prevGrowth}）`, 0, 0, pet.id, {causedDeath:true, prevGrowth:prevGrowth, prevLevel:prevLevel, starvation:true, petSnapshot:{name:pet.name,nickname:pet.nickname,level:prevLevel,growth:prevGrowth,lastFeedDate:pet.lastFeedDate,todayFeedCount:pet.todayFeedCount||0,todayPlayCount:pet.todayPlayCount||0,lastPlayDate:pet.lastPlayDate,penaltyStreak:pet.penaltyStreak||0}});}});}
function isPetStarved(pet){if(!pet.lastFeedDate) return false; const last=new Date(pet.lastFeedDate); const now=new Date(); let pauseMs=calcPauseOverlap(last,now); const realMs=(now-last)-pauseMs; const diffHours=realMs/(1000*3600); return diffHours>=1680;}
function calcPauseOverlap(feedDate,nowDate){if(!currentClassId)return 0;const cur=classesData.find(c=>c.id===currentClassId);if(!cur||!cur.pauseGrowth||!cur.pauseGrowth.start||!cur.pauseGrowth.end)return 0;const ps=new Date(cur.pauseGrowth.start+'T00:00:00');const pe=new Date(cur.pauseGrowth.end+'T23:59:59');const overlapStart=feedDate>ps?feedDate:ps;const overlapEnd=nowDate<pe?nowDate:pe;if(overlapStart>=overlapEnd)return 0;return overlapEnd-overlapStart;}
function getEffectiveUnfedHours(pet){if(!pet.lastFeedDate)return 0;const last=new Date(pet.lastFeedDate);const now=new Date();let pauseMs=calcPauseOverlap(last,now);const realMs=(now-last)-pauseMs;return Math.max(0,realMs/(1000*3600));}
function checkPauseAndNotify(){if(isPauseActive()){showNotification('操作暂停','假期暂停期间无法操作','warning');return true;}return false;}
function isPauseActive(){if(!currentClassId)return false;const cur=classesData.find(c=>c.id===currentClassId);if(!cur||!cur.pauseGrowth)return false;const today=new Date().toISOString().slice(0,10);return (today>=cur.pauseGrowth.start && today<=cur.pauseGrowth.end);}
function showNotification(title,message,type="info"){const c=document.getElementById('notificationContainer');/* 限制最多同时显示3个通知，防止DOM堆积 */while(c.children.length>=3)c.firstChild.remove();const icons={"info":"ℹ️","success":"✅","warning":"⚠️","error":"❌"},n=document.createElement('div');n.className='notification';n.innerHTML=`<div>${icons[type]}</div><div><strong>${esc(title)}</strong><br>${esc(message)}</div>`;c.appendChild(n);setTimeout(()=>{if(n.parentNode)n.remove();},3000);}
function buildStudentModalContent(student, pet){
  // v18: SAFETY NET — If a student is viewing another student's pet, ALWAYS show read-only
  // This prevents action buttons from appearing even if isViewingOtherStudent was wrong
  var _isStudent = typeof currentUser !== 'undefined' && currentUser && currentUser.type === 'student';
  if (_isStudent) {
    var _myId = currentUser.studentId || localStorage.getItem('studentId') || '';
    if (_myId && String(student.id) !== String(_myId)) {
      return buildReadOnlyStudentModalContent(student, pet);
    }
  }
  const stageName = getCurrentStageName(pet.name, pet.level||1);
  const lastDate = pet.lastFeedDate?new Date(pet.lastFeedDate):null;
  let hungerMsg='';
  if(pet.level>=9){hungerMsg='👑 传说神兽，无需喂食';}
  else if(isPauseActive()){hungerMsg='🛡️ 假期保护中，暂停饥饿计时';}
  else if(!pet.isDead&&lastDate){const hours=getEffectiveUnfedHours(pet); if(hours>=1440)hungerMsg='🔴 超过60天未喂，即将饿死！'; else if(hours>=720)hungerMsg='🟠 超过30天未喂，请尽快喂食'; else if(hours>=24)hungerMsg='🟡 超过1天未喂'; else hungerMsg=`🕒 ${Math.floor(hours)}小时前喂食`;} else if(pet.isDead)hungerMsg='💀 已饿死，请复活';
  const growable=getGrowablePet(student);
  const hasGrowable=growable && growable.id!==pet.id;
  const allMaxed=student.pets.every(p=>p.level>=9);
  const feedTarget=hasGrowable?growable:pet;
  const alreadyFed = _hasFedToday(feedTarget);
  const feedDisabled = alreadyFed || (pet.isDead && !hasGrowable) || student.coins<5 || (pet.level>=9 && !hasGrowable && !allMaxed) || allMaxed ? 'disabled' : '';
  const playDisabled=(pet.isDead && !hasGrowable)||student.coins<20||(pet.level>=9 && !hasGrowable && !allMaxed)?'disabled':(allMaxed?'disabled':'');
  const walkDisabled=(pet.isDead && !hasGrowable)||student.coins<30||(pet.level>=9 && !hasGrowable && !allMaxed)?'disabled':(allMaxed?'disabled':'');
  const shoppingDisabled=(pet.isDead && !hasGrowable)||student.coins<50||feedTarget.level<3||(pet.level>=9 && !hasGrowable && !allMaxed)?'disabled':(allMaxed?'disabled':'');
  const shoppingLevelHint = feedTarget.level<3 ? '<span style="font-size:11px;display:block;color:#e74c3c;">需要Lv3以上</span>' : '';
  const reviveDisabled=!pet.isDead||student.coins<50?'disabled':'';
  const canAdopt=student.pets.every(p=>p.level>=9);
  const adoptBtn = canAdopt ? `<button class="modal-btn" style="background:#9b59b6;" onclick="modalAdoptNew()">🌟 领养新宠物 (免费)</button>` : '';
  const feedHint = alreadyFed ? '<span style="font-size:11px;display:block;color:#27ae60;">✅ 今日已喂食</span>' : (hasGrowable ? `<span style="font-size:11px;display:block;opacity:0.8;">→ 自动喂 ${esc(feedTarget.nickname||feedTarget.name)}</span>` : '');
  /* Build pet gallery for multi-pet students */
  let petGallery='';
  if(student.pets.length>1){
    petGallery='<div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin:10px 0 5px;">';
    student.pets.forEach(pp=>{
      const isActive=pp.id===pet.id;
      const isMax=pp.level>=9;
      const border=isActive?'3px solid #ff8888':isMax?'2px solid #ffd700':'2px solid #e8d8d0';
      const bg=isMax?'linear-gradient(135deg,#fff8e8,#fff0d0)':'#fff5f0';
      const opacity=pp.isDead?'0.5':'1';
      petGallery+=`<div onclick="event.stopPropagation();switchPet('${student.id}','${pp.id}');refreshCurrentStudentModal();" style="cursor:pointer;text-align:center;padding:6px 10px;border-radius:16px;border:${border};background:${bg};opacity:${opacity};min-width:70px;transition:all 0.2s;" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='none'">
        <div style="width:45px;height:45px;margin:0 auto;">${getPetImage(pp.name,pp.level||1)}</div>
        <div style="font-size:11px;font-weight:700;color:#886;margin-top:2px;">${esc(pp.nickname||pp.name)}</div>
        <div style="font-size:10px;color:#aa8888;">${isMax?'👑满级':'Lv.'+pp.level}${pp.isDead?' 💀':''}${isActive?' ⭐':''}</div>
      </div>`;
    });
    petGallery+='</div>';
  }
  const maxedCount=countMaxedPets(student);
  const titleExtra='';
  const shopBonus=getStudentGrowthBonus(student);
  const bonusTag=shopBonus>0?`<span style="color:#27ae60;font-size:10px;"> (+${shopBonus})</span>`:'';
  const mfx=getStudentShopEffects(student);
  const modalBorderStyle=mfx.borderClasses.length?mfx.borderClasses.map(bc=>{
    if(bc==='pet-border-rainbow')return'border:3px solid transparent;background-clip:padding-box;box-shadow:0 0 0 3px #ff0000,0 0 0 3px #ff8800,0 0 12px rgba(255,100,0,0.3);animation:modalRainbow 3s linear infinite;';
    if(bc==='pet-border-flame')return'border:3px solid transparent;background-clip:padding-box;box-shadow:0 0 0 3px #ff4500,0 0 15px rgba(255,69,0,0.5),0 0 30px rgba(255,140,0,0.3),0 0 45px rgba(255,69,0,0.15);animation:flameBorderFlow 2s linear infinite;';
    if(bc==='pet-border-ice')return'border:3px solid transparent;background-clip:padding-box;box-shadow:0 0 0 3px #7dd3fc,0 0 15px rgba(125,211,252,0.5),0 0 35px rgba(56,189,248,0.2);animation:iceBorderShimmer 3s ease-in-out infinite;';
    if(bc==='pet-border-starry')return'border:3px solid transparent;background-clip:padding-box;box-shadow:0 0 0 3px #3d1a78,0 0 18px rgba(99,102,241,0.5),0 0 40px rgba(139,92,246,0.3),0 0 60px rgba(100,50,200,0.15);animation:starryBorderDrift 8s ease-in-out infinite;';
    if(bc==='pet-border-gold')return'border:3px solid transparent;background-clip:padding-box;box-shadow:0 0 0 3px #ffd700,0 0 18px rgba(255,215,0,0.6),0 0 40px rgba(255,183,0,0.3),0 0 60px rgba(255,215,0,0.15);animation:goldBorderShine 4s ease-in-out infinite;';
    return '';
  }).join(''):'';
  const modalSceneBg=mfx.sceneClass?(() => {
    const sceneMap={'pet-scene-meadow':'linear-gradient(180deg,#d4f5d4 0%,#a8e6a0 50%,#7bc97b 100%)','pet-scene-beach':'linear-gradient(180deg,#87CEEB 0%,#87CEEB 40%,#ffe4a0 70%,#f5d080 100%)','pet-scene-space':'linear-gradient(180deg,#0c0c2e 0%,#1a1a4e 50%,#2d1b69 100%)','pet-scene-sakura':'linear-gradient(180deg,#fce4ec 0%,#f8bbd0 50%,#f48fb1 100%)','pet-scene-volcano':'linear-gradient(180deg,#2c1810 0%,#5c2e1a 40%,#c0392b 70%,#e74c3c 90%,#ff6b35 100%)','pet-scene-aurora':'linear-gradient(180deg,#0a1628 0%,#1a3a5c 30%,#2ecc71 55%,#3498db 70%,#9b59b6 85%,#1a1a40 100%)'};
    return sceneMap[mfx.sceneClass]||'';
  })():'';
  const modalSceneClass=mfx.sceneClass||'';
  const modalTopAccessory=mfx.topHtml?mfx.topHtml.replace('shop-top-accessory','shop-top-accessory modal-top-accessory'):'';
  const modalBaseEffect=mfx.baseHtml?mfx.baseHtml.replace('shop-base-effect','shop-base-effect modal-base-effect'):'';
  const modalParticles=mfx.particleHtml?mfx.particleHtml.replace('shop-particles','shop-particles modal-particles'):'';
  const modalTitleBadge=mfx.titleHtml?mfx.titleHtml.replace('shop-title-badge','shop-title-badge modal-title-badge'):'';
  return `<div class="modal-student-title">${esc(student.name)} 的宠物${titleExtra}</div>
  ${petGallery}
  <div class="pet-stats-row">
    <div class="pet-stats-col left">
      <div class="stat-item"><span class="stat-label">🐾 宠物</span><span class="stat-value">${esc(pet.nickname||pet.name)}</span></div>
      <div class="stat-item"><span class="stat-label">✨ 等级</span><span class="stat-value modal-level-num">${stageName} Lv.${pet.level}${pet.level>=9?' <span class="modal-crown-icon">👑</span>':''}</span></div>
      <div class="stat-item"><span class="stat-label">📈 成长值</span><span class="stat-value">${pet.level>=9?getExpNeeded(pet):(pet.growth||0)} / ${getExpNeeded(pet)}</span></div>
      <div class="modal-growth-progress"><div class="stat-progress-bar"><div class="stat-progress-fill${pet.level>=9?' fill-gold':''}"></div></div></div>
      <div class="stat-item"><span class="stat-label">🍽️ 今日喂食</span><span class="stat-value">${pet.todayFeedCount||0} 次</span></div>
      <div class="stat-item"><span class="stat-label">🎮 今日玩耍</span><span class="stat-value">${pet.todayPlayCount||0} 次</span></div>
    </div>
    <div class="modal-pet-img ${modalSceneClass}" data-pet-img-container data-pet-name="${esc(pet.name)}" data-pet-level="${pet.level||1}" style="position:relative;overflow:visible;${modalBorderStyle}${modalSceneBg?'background:'+modalSceneBg+';':''}">
      ${modalTopAccessory}
      ${modalParticles}
      ${getPetImage(pet.name, pet.level||1)}${pet.isDead?'<div class="dead-pet-overlay">💀</div>':''}
      ${modalTitleBadge}
      ${modalBaseEffect}
    </div>
    <div class="pet-stats-col right">
      <div class="stat-item"><span class="stat-label"><span class="coin-shake">💰</span> 金币</span><span class="stat-value modal-coin-val">${student.coins}</span></div>
      <div class="stat-item"><span class="stat-label">⏱️ 上次喂食</span><span class="stat-value">${pet.lastFeedDate?new Date(pet.lastFeedDate).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai'}):'无'}</span></div>
      <div class="stat-item"><span class="stat-label">💀 状态</span><span class="stat-value">${pet.isDead?'已饿死':'🐣 存活'}</span></div>
      <div class="stat-item"><span class="stat-label">⚠️ 饥饿警告</span><span class="stat-value modal-hunger-warn">${hungerMsg}</span></div>
      ${student.pets.length>1?`<div class="stat-item"><span class="stat-label">📦 宠物数</span><span class="stat-value">${student.pets.length}只 (${maxedCount}满级)</span></div>`:''}
      ${shopBonus>0?`<div class="stat-item"><span class="stat-label">🏪 商店加成</span><span class="stat-value" style="color:#27ae60;">+${shopBonus}/次</span></div>`:''}
    </div>
  </div>
  <h4>🐾 主要互动</h4><div class="modal-action-grid">
    <button class="modal-btn" style="background:#f9a86c;" onclick="modalFeed()" ${feedDisabled}>🍗 喂食 (5金币)<span>成长+2</span>${feedHint}</button>
    <button class="modal-btn" style="background:#7ec8a0;" onclick="modalPlay()" ${playDisabled}>🎾 玩耍 (20金币)<span>成长+${Math.min(7+shopBonus, 13)}${bonusTag}</span>${feedHint}</button>
    <button class="modal-btn" style="background:#e8a87c;" onclick="modalWalk()" ${walkDisabled}>🚶 散步 (30金币)<span>成长+${Math.min(15+shopBonus, 24)}${bonusTag}</span>${feedHint}</button>
    <button class="modal-btn" style="background:#c39bd3;" onclick="modalShopping()" ${shoppingDisabled}>🛍️ 逛街 (50金币 Lv3+)<span>成长+${Math.min(35+shopBonus, 45)}${bonusTag}</span>${shoppingLevelHint}${feedHint}</button>
    <button class="modal-btn" style="background:#5dade2;" onclick="modalTravel()" ${pet.level<6?'disabled':''}>✈️ 旅游 (100金币 Lv6+)<span>成长+${Math.min(85+shopBonus, 100)}${bonusTag}</span>${pet.level<6?'<span style="color:#ffcc00;">Lv6解锁</span>':feedHint}</button>
    ${pet.isDead?`<button class="modal-btn" style="background:#dc6b6b;" onclick="modalRevive()" ${reviveDisabled}>💖 复活宠物 (50金币)</button>`:''}
    ${adoptBtn}
    ${(function(){const checkedIn=_hasCheckedInToday(student);return checkedIn?'<button class="modal-btn" style="background:#b0b0b0;" disabled>📋 每日打卡<span>✅ 今日已打卡</span></button>':'<button class="modal-btn" style="background:#48c774;" onclick="modalDailyCheckin()">📋 每日打卡<span>+10金币</span></button>';})()}
  </div>
  ${_buildModalShopSection(student, pet)}`;
}
// v13: Read-only view for students viewing other students' pets
function buildReadOnlyStudentModalContent(student, pet){
  const stageName = getCurrentStageName(pet.name, pet.level||1);
  const lastDate = pet.lastFeedDate?new Date(pet.lastFeedDate):null;
  let hungerMsg='';
  if(pet.level>=9){hungerMsg='👑 传说神兽，无需喂食';}
  else if(!pet.isDead&&lastDate){const hours=getEffectiveUnfedHours(pet); if(hours>=1440)hungerMsg='🔴 超过60天未喂'; else if(hours>=720)hungerMsg='🟠 超过30天未喂'; else if(hours>=24)hungerMsg='🟡 超过1天未喂'; else hungerMsg=`🕒 ${Math.floor(hours)}小时前喂食`;} else if(pet.isDead)hungerMsg='💀 已饿死'; else hungerMsg='🐣 存活';
  
  let petGallery='';
  if(student.pets.length>1){
    petGallery='<div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin:10px 0 5px;">';
    student.pets.forEach(pp=>{
      const isActive=pp.id===pet.id;
      const isMax=pp.level>=9;
      const border=isActive?'3px solid #ff8888':isMax?'2px solid #ffd700':'2px solid #e8d8d0';
      const bg=isMax?'linear-gradient(135deg,#fff8e8,#fff0d0)':'#fff5f0';
      const opacity=pp.isDead?'0.5':'1';
      petGallery+=`<div style="text-align:center;padding:6px 10px;border-radius:16px;border:${border};background:${bg};opacity:${opacity};min-width:70px;">
        <div style="width:45px;height:45px;margin:0 auto;">${getPetImage(pp.name,pp.level||1)}</div>
        <div style="font-size:11px;font-weight:700;color:#886;margin-top:2px;">${esc(pp.nickname||pp.name)}</div>
        <div style="font-size:10px;color:#aa8888;">${isMax?'👑满级':'Lv.'+pp.level}${pp.isDead?' 💀':''}${isActive?' ⭐':''}</div>
      </div>`;
    });
    petGallery+='</div>';
  }
  
  return `<div class="modal-student-title">${esc(student.name)} 的宠物</div>
  ${petGallery}
  <div class="pet-stats-row">
    <div class="pet-stats-col left">
      <div class="stat-item"><span class="stat-label">🐾 宠物</span><span class="stat-value">${esc(pet.nickname||pet.name)}</span></div>
      <div class="stat-item"><span class="stat-label">✨ 等级</span><span class="stat-value modal-level-num">${stageName} Lv.${pet.level}${pet.level>=9?' <span class="modal-crown-icon">👑</span>':''}</span></div>
      <div class="stat-item"><span class="stat-label">📈 成长值</span><span class="stat-value">${pet.level>=9?getExpNeeded(pet):(pet.growth||0)} / ${getExpNeeded(pet)}</span></div>
      <div class="modal-growth-progress"><div class="stat-progress-bar"><div class="stat-progress-fill${pet.level>=9?' fill-gold':''}"></div></div></div>
      <div class="stat-item"><span class="stat-label">🍽️ 今日喂食</span><span class="stat-value">${pet.todayFeedCount||0} 次</span></div>
      <div class="stat-item"><span class="stat-label">🎮 今日玩耍</span><span class="stat-value">${pet.todayPlayCount||0} 次</span></div>
    </div>
    <div class="pet-stats-col right">
      <div class="stat-item"><span class="stat-label"><span class="coin-shake">💰</span> 金币</span><span class="stat-value modal-coin-val">${student.coins}</span></div>
      <div class="stat-item"><span class="stat-label">⏱️ 上次喂食</span><span class="stat-value">${pet.lastFeedDate?new Date(pet.lastFeedDate).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai'}):'无'}</span></div>
      <div class="stat-item"><span class="stat-label">💀 状态</span><span class="stat-value">${pet.isDead?'已饿死':'🐣 存活'}</span></div>
      <div class="stat-item"><span class="stat-label">⚠️ 状态</span><span class="stat-value modal-hunger-warn">${hungerMsg}</span></div>
      ${student.pets.length>1?`<div class="stat-item"><span class="stat-label">📦 宠物数</span><span class="stat-value">${student.pets.length}只</span></div>`:''}
      ${(function(){const bonus=getStudentGrowthBonus(student);return bonus>0?`<div class="stat-item"><span class="stat-label">🏪 商店加成</span><span class="stat-value" style="color:#27ae60;">+${bonus}/次</span></div>`:'';})()}
    </div>
  </div>
  ${_buildReadOnlyShopSection(student, pet)}
  <div style="text-align:center;padding:20px;background:#f0f8ff;border-radius:12px;margin-top:16px;border:2px solid #4a90d9;">
    <div style="font-size:48px;margin-bottom:12px;">👀</div>
    <div style="font-size:16px;font-weight:700;color:#4a90d9;">正在查看 ${esc(student.name)} 的宠物</div>
    <div style="font-size:14px;color:#666;margin-top:8px;">你只能查看，不能操作其他同学的宠物</div>
  </div>`;
}
function openStudentModal(studentId){ if(!currentClassId)return; const cur=classesData.find(c=>c.id===currentClassId); const student=cur.students.find(s=>s.id.toString()===studentId.toString()); if(!student)return; currentModalStudentId=studentId;
  // v18: Robust check — is current user a student viewing ANOTHER student's pet?
  const isStudentView = typeof currentUser !== 'undefined' && currentUser && currentUser.type === 'student';
  const _mySid = isStudentView ? (currentUser.studentId || localStorage.getItem('studentId') || '') : '';
  const myStudentId = _mySid ? (isNaN(parseInt(_mySid)) ? _mySid : parseInt(_mySid)) : null;
  const isViewingOtherStudent = isStudentView && myStudentId !== null && String(student.id) !== String(myStudentId);
  
  if(!student.pets||student.pets.length===0){ 
    let content = '<div style="text-align:center;"><div style="font-size:60px;">🥚</div><p>尚未领养宠物</p><p>💰 '+student.coins+' 金币</p></div>';
    let actions = [{text:'关闭',onclick:'closeModal()'}];
    if(!isViewingOtherStudent) {
      actions.push({text:'去领养',onclick:`closeModal();showAdoptModal('${studentId}')`});
    }
    showModal(`${student.name} 的操作`, content, actions); 
    return; 
  } 
  const activePet=getActivePet(student);
  if(!activePet){showNotification('错误','无可用宠物','error');return;}
  ensurePetPlayFields(activePet); 
  const modalContent = isViewingOtherStudent ? buildReadOnlyStudentModalContent(student, activePet) : buildStudentModalContent(student, activePet);
  showModal('', modalContent, [{text:'关闭',class:'btn-secondary',onclick:'closeModal()'}], true); 
  setTimeout(()=>{ startHeartForCurrentPet(studentId);
    const petImgEl = document.querySelector('.modal-pet-img[data-pet-img-container]');
    if(petImgEl) initPetModalEnhancements(petImgEl, activePet.name, activePet.level||1, activePet.growth||0, getExpNeeded(activePet));
  }, 50);
}
function refreshCurrentStudentModal(){
  if(!currentModalStudentId) return;
  const cur=classesData.find(c=>c.id===currentClassId);
  if(!cur) return;
  const student=cur.students.find(s=>s.id.toString()===currentModalStudentId.toString());
  if(!student) return;
  const modalOverlay = document.querySelector('#modalContainer .modal-overlay');
  if(!modalOverlay) return;
  const modalDiv = modalOverlay.querySelector('.modal');
  if(!modalDiv) return;
  const activePet = getActivePet(student);
  if(!activePet){ closeModal(); return; }
  ensurePetPlayFields(activePet);
  cleanupPetModalEffects();
  // v18: Robust check — is current user a student viewing ANOTHER student's pet?
  const isStudentView = typeof currentUser !== 'undefined' && currentUser && currentUser.type === 'student';
  const _mySid = isStudentView ? (currentUser.studentId || localStorage.getItem('studentId') || '') : '';
  const myStudentId = _mySid ? (isNaN(parseInt(_mySid)) ? _mySid : parseInt(_mySid)) : null;
  const isViewingOtherStudent = isStudentView && myStudentId !== null && String(student.id) !== String(myStudentId);
  const contentBuilder = isViewingOtherStudent ? buildReadOnlyStudentModalContent : buildStudentModalContent;
  modalDiv.querySelector('.modal-content').innerHTML = contentBuilder(student, activePet);
  const actionsDiv = modalDiv.querySelector('.modal-actions');
  if(actionsDiv) actionsDiv.innerHTML = `<button class="btn btn-secondary" onclick="playClickSound(); closeModal()">关闭</button>`;
  setTimeout(()=>{ startHeartForCurrentPet(currentModalStudentId);
    const petImgEl = document.querySelector('.modal-pet-img[data-pet-img-container]');
    if(petImgEl) initPetModalEnhancements(petImgEl, activePet.name, activePet.level||1, activePet.growth||0, getExpNeeded(activePet));
  }, 60);
}
function ensurePetPlayFields(pet){ if(pet.todayPlayCount===undefined) pet.todayPlayCount=0; if(pet.lastPlayDate===undefined) pet.lastPlayDate=null; if(pet.penaltyStreak===undefined) pet.penaltyStreak=0; return pet; }
function getCurrentStageName(petName,level){const cfg=PET_CONFIG[petName];if(!cfg)return"未知";const s=cfg.stages.find(s=>s.stage===level);return s?s.stageName:`阶段${level}`;}
function playWithPet(student,pet){ if(pet.isDead){ showNotification('玩耍失败','宠物已经死亡，请先复活','error'); return false; } if(student.coins<20){ showNotification('金币不足','玩耍需要20金币','error'); return false; } if(pet.level >= 9){ showNotification('已达万物之神','无法继续成长，可以领养新宠物','warning'); return false; } ensurePetPlayFields(pet); let gain=Math.min(7+getStudentGrowthBonus(student), 13); pet.growth+=gain; student.coins-=20; pet.lastPlayDate=new Date().toISOString(); updatePetLevel(student, pet.id, gain); recordAction(student.id, student.name, '玩耍', `${pet.nickname||pet.name} +${gain}成长值`, -20, gain, pet.id); showNotification('玩耍快乐',`${pet.nickname||pet.name} 获得 ${gain} 成长值！`,'success'); return true; }
function walkPet(student,pet){ if(pet.isDead){ showNotification('散步失败','宠物已经死亡，请先复活','error'); return false; } if(student.coins<30){ showNotification('金币不足','散步需要30金币','error'); return false; } if(pet.level >= 9){ showNotification('已达万物之神','无法继续成长，可以领养新宠物','warning'); return false; } ensurePetPlayFields(pet); let gain=Math.min(15+getStudentGrowthBonus(student), 24); pet.growth+=gain; student.coins-=30; updatePetLevel(student, pet.id, gain); recordAction(student.id, student.name, '散步', `${pet.nickname||pet.name} +${gain}成长值`, -30, gain, pet.id); showNotification('散步愉快',`${pet.nickname||pet.name} 获得 ${gain} 成长值！`,'success'); return true; }
function shoppingPet(student,pet){ if(pet.isDead){ showNotification('逛街失败','宠物已经死亡，请先复活','error'); return false; } if(pet.level<3){ showNotification('等级不足','逛街需要Lv3以上','warning'); return false; } if(student.coins<50){ showNotification('金币不足','逛街需要50金币','error'); return false; } if(pet.level >= 9){ showNotification('已达万物之神','无法继续成长，可以领养新宠物','warning'); return false; } ensurePetPlayFields(pet); let gain=Math.min(35+getStudentGrowthBonus(student), 45); pet.growth+=gain; student.coins-=50; updatePetLevel(student, pet.id, gain); recordAction(student.id, student.name, '逛街', `${pet.nickname||pet.name} +${gain}成长值`, -50, gain, pet.id); showNotification('逛街开心',`${pet.nickname||pet.name} 获得 ${gain} 成长值！`,'success'); return true; }
function travelPet(student,pet){ if(pet.isDead){ showNotification('旅游失败','宠物已经死亡，请先复活','error'); return false; } if(pet.level<6){ showNotification('等级不足','旅游需要Lv6以上','warning'); return false; } if(student.coins<100){ showNotification('金币不足','旅游需要100金币','error'); return false; } if(pet.level >= 9){ showNotification('已达万物之神','无法继续成长，可以领养新宠物','warning'); return false; } ensurePetPlayFields(pet); let gain=Math.min(85+getStudentGrowthBonus(student), 100); pet.growth+=gain; student.coins-=100; updatePetLevel(student, pet.id, gain); recordAction(student.id, student.name, '旅游', `${pet.nickname||pet.name} +${gain}成长值`, -100, gain, pet.id); showNotification('旅游愉快',`${pet.nickname||pet.name} 获得 ${gain} 成长值！`,'success'); return true; }
function revivePet(student,pet){ if(!pet.isDead) return false; if(student.coins<50){showNotification('金币不足','复活需要50金币','error');return false;} student.coins-=50; pet.isDead=false; let deadGrowth = pet.deathGrowth !== undefined ? pet.deathGrowth : pet.growth; let newGrowth = Math.floor(deadGrowth * 0.5); let prevGrowth = pet.growth; pet.growth = newGrowth; pet.level = 1; const cfg = PET_CONFIG[pet.name]; if(cfg){ let newLevel = 1; for(let i=cfg.stages.length-1;i>=0;i--) if(pet.growth>=cfg.stages[i].growthRequired){ newLevel=cfg.stages[i].stage; break; } pet.level = newLevel; } pet.lastFeedDate=new Date().toISOString(); pet.todayFeedCount=0; pet.todayPlayCount=0; pet.lastPlayDate=null; pet.penaltyStreak = 0; delete pet.deathGrowth; recordAction(student.id, student.name, '复活', `${pet.nickname||pet.name} 复活`, -50, newGrowth - prevGrowth, pet.id); showNotification('复活成功',`${pet.nickname||pet.name} 重获新生！经验保留50%`,'success'); renderPKPage(); return true; }
function applyAction(student, action, pet){ let coinsChange = action.coins; let isPenalty = coinsChange < 0; let expChange = 0; let prevGrowth = pet.growth; if(pet.isDead){ if(isPenalty){ showNotification('操作禁止','宠物已死亡，不能施加惩罚','error'); return false; } else { student.coins += coinsChange; if(student.coins < 0) student.coins = 0; if(pet.penaltyStreak !== undefined) pet.penaltyStreak = 0; recordAction(student.id, student.name, '奖惩', `${action.name} (宠物死亡)`, coinsChange, 0, pet.id); showNotification(action.name, `+${coinsChange}金币 (宠物死亡无法获得经验)`, 'success'); return true; } } if(isPenalty){ let absDeduct = Math.abs(coinsChange); let coinDeducted = Math.min(absDeduct, student.coins); let remaining = absDeduct - coinDeducted; student.coins -= coinDeducted; expChange = 0; if(remaining > 0){ expChange = -remaining; pet.growth += expChange; if(pet.growth <= 0){ pet.growth = 0; pet.isDead = true; pet.deathGrowth = prevGrowth; pet.deathDate = new Date().toISOString(); pet.penaltyStreak = 0; recordAction(student.id, student.name, '惩罚致死', `${action.name} 导致死亡（金币不足，经验扣至0）`, -absDeduct, -prevGrowth, pet.id, {causedDeath: true, prevGrowth: prevGrowth}); showNotification('惩罚致死',`${pet.nickname||pet.name} 金币不足，经验被扣至0，宠物死亡！`,'error'); saveClassData(); renderPKPage(); return true; } updatePetLevel(student, pet.id, expChange); } let msg = `${action.name}：金币-${coinDeducted}`; if(expChange !== 0) msg += `，经验${expChange}`; recordAction(student.id, student.name, '奖惩', msg, -coinDeducted, expChange, pet.id); showNotification(action.name, msg, 'warning'); } else { if(pet.penaltyStreak !== undefined) pet.penaltyStreak = 0; student.coins += coinsChange; if(student.coins < 0) student.coins = 0; let msg = `${action.name}：金币+${coinsChange}`; recordAction(student.id, student.name, '奖惩', msg, coinsChange, 0, pet.id); showNotification(action.name, msg, 'success'); } return true; }
function modalFeed(){if(checkPauseAndNotify())return;if(!currentModalStudentId)return;const cur=classesData.find(c=>c.id===currentClassId);const student=cur.students.find(s=>s.id.toString()===currentModalStudentId.toString());if(!student)return;let pet=getActivePet(student);if(!pet)return;if(pet.isDead||pet.level>=9){const growable=getGrowablePet(student);if(growable){pet=growable;}else if(pet.isDead){showNotification('无法喂食','宠物已死亡，请先复活','error');return;}else{showNotification('全部满级','所有宠物都已满级，可以领养新宠物','info');return;}}feedPet(student,pet);saveClassData();refreshCurrentStudentModal();scheduleAllRenders();}
function modalPlay(){if(checkPauseAndNotify())return;if(!currentModalStudentId)return;const cur=classesData.find(c=>c.id===currentClassId);const student=cur.students.find(s=>s.id.toString()===currentModalStudentId.toString());if(!student)return;let pet=getActivePet(student);if(!pet)return;if(pet.isDead||pet.level>=9){const growable=getGrowablePet(student);if(growable){pet=growable;}else if(pet.isDead){showNotification('无法玩耍','宠物已死亡，请先复活','error');return;}else{showNotification('全部满级','所有宠物都已满级，可以领养新宠物','info');return;}}playWithPet(student,pet);saveClassData();refreshCurrentStudentModal();scheduleAllRenders();}
function modalWalk(){if(checkPauseAndNotify())return;if(!currentModalStudentId)return;const cur=classesData.find(c=>c.id===currentClassId);const student=cur.students.find(s=>s.id.toString()===currentModalStudentId.toString());if(!student)return;let pet=getActivePet(student);if(!pet)return;if(pet.isDead||pet.level>=9){const growable=getGrowablePet(student);if(growable){pet=growable;}else if(pet.isDead){showNotification('无法散步','宠物已死亡，请先复活','error');return;}else{showNotification('全部满级','所有宠物都已满级，可以领养新宠物','info');return;}}walkPet(student,pet);saveClassData();refreshCurrentStudentModal();scheduleAllRenders();}
function modalShopping(){if(checkPauseAndNotify())return;if(!currentModalStudentId)return;const cur=classesData.find(c=>c.id===currentClassId);const student=cur.students.find(s=>s.id.toString()===currentModalStudentId.toString());if(!student)return;let pet=getActivePet(student);if(!pet)return;if(pet.isDead||pet.level>=9){const growable=getGrowablePet(student);if(growable){pet=growable;}else if(pet.isDead){showNotification('无法逛街','宠物已死亡，请先复活','error');return;}else{showNotification('全部满级','所有宠物都已满级，可以领养新宠物','info');return;}}if(pet.level<3){showNotification('等级不足','逛街需要Lv3以上','warning');return;}shoppingPet(student,pet);saveClassData();refreshCurrentStudentModal();scheduleAllRenders();}
function modalTravel(){if(checkPauseAndNotify())return;if(!currentModalStudentId)return;const cur=classesData.find(c=>c.id===currentClassId);const student=cur.students.find(s=>s.id.toString()===currentModalStudentId.toString());if(!student)return;let pet=getActivePet(student);if(!pet)return;if(pet.isDead||pet.level>=9){const growable=getGrowablePet(student);if(growable){pet=growable;}else if(pet.isDead){showNotification('无法旅游','宠物已死亡，请先复活','error');return;}else{showNotification('全部满级','所有宠物都已满级，可以领养新宠物','info');return;}}if(pet.level<6){showNotification('等级不足','旅游需要Lv6以上','warning');return;}travelPet(student,pet);saveClassData();refreshCurrentStudentModal();scheduleAllRenders();}
function modalRevive(){if(checkPauseAndNotify())return;if(!currentModalStudentId)return;const cur=classesData.find(c=>c.id===currentClassId);const student=cur.students.find(s=>s.id.toString()===currentModalStudentId.toString());if(!student)return;const pet=getActivePet(student);if(!pet)return;revivePet(student,pet);saveClassData();refreshCurrentStudentModal();renderHomePetGrid();renderClassTopThree();}
// v14: Student daily check-in — 10 coins per day, once per day
function modalDailyCheckin(){
  if(checkPauseAndNotify())return;
  if(!currentModalStudentId)return;
  const cur=classesData.find(c=>c.id===currentClassId);
  const student=cur.students.find(s=>s.id.toString()===currentModalStudentId.toString());
  if(!student)return;
  
  // v37: Check if already checked in today (via lastCheckinDate or operation logs)
  if(_hasCheckedInToday(student)){
    showNotification('今日已打卡','每天只能打卡一次，明天再来吧','info');
    return;
  }
  
  // Perform check-in: +10 coins
  student.coins += 10;
  student.lastCheckinDate = new Date().toISOString();
  recordAction(student.id, student.name, '每日打卡', '+10金币', 10, 0, null);
  saveClassData();
  refreshCurrentStudentModal();
  renderHomePetGrid();
  scheduleAllRenders();
  showNotification('打卡成功','每日打卡 +10金币！','success');
}
function modalApplyAction(actionId){if(checkPauseAndNotify())return;if(!currentModalStudentId)return;const cur=classesData.find(c=>c.id===currentClassId);const student=cur.students.find(s=>s.id.toString()===currentModalStudentId.toString());if(!student)return;const pet=getActivePet(student);if(!pet)return;const action=customActions.find(a=>String(a.id)===String(actionId));if(!action)return; const result = applyAction(student, action, pet); if(result){ saveClassData(); refreshCurrentStudentModal(); scheduleAllRenders(); } }
function modalAdoptNew(){if(checkPauseAndNotify())return;if(!currentModalStudentId)return;const cur=classesData.find(c=>c.id===currentClassId);const student=cur.students.find(s=>s.id.toString()===currentModalStudentId.toString());if(!student)return;if(student.pets.some(p=>p.level<9)){showNotification('无法领养','还有未满级的宠物，需要全部满级后才能领养新宠物','warning');return;}const _savedModalStudentId=currentModalStudentId;closeModal();currentModalStudentId=_savedModalStudentId;showAdoptModal(student.id, true);}
function showAdoptModal(studentId, fromModal=false){ if(checkPauseAndNotify())return; const cur=classesData.find(c=>c.id===currentClassId); const student=cur.students.find(s=>s.id.toString()===studentId.toString()); if(student.pets.length>0 && student.pets.some(p=>p.level<9)){showNotification('无法领养','还有未满级的宠物，需要全部满级后才能领养新宠物','warning');return;} let list=`<div class="pet-select-grid">`; Object.keys(PET_CONFIG).forEach(name=>{ list+=`<div class="pet-select-item" onclick="selectPetForAdopt('${name}','${studentId}',${fromModal})"><div class="pet-select-img">${getPetImage(name, 1)}</div><div>${name}</div></div>`; }); list+='</div>'; const cancelAction = fromModal ? `closeModal();openStudentModal('${studentId}')` : 'closeModal()'; const modalOverlay = showModal('领养宠物', list, [{text:'取消',onclick:cancelAction}], true); if(modalOverlay){ const modalDiv = modalOverlay.querySelector('.modal'); if(modalDiv) modalDiv.classList.add('adopt-modal'); } }
function selectPetForAdopt(petName,studentId,fromModal=false){selectedPetName=petName;const _cancelAction=fromModal?`closeModal();openStudentModal('${studentId}')`:'closeModal()';showModal('起个昵称',`<input id="nicknameInput" value="${petName}" style="width:100%;padding:10px;border-radius:20px;">`,[{text:'取消',onclick:_cancelAction},{text:'确认领养',onclick:`confirmAdoptPet('${studentId}')`}]);}
function confirmAdoptPet(studentId){if(checkPauseAndNotify())return;const nickname=document.getElementById('nicknameInput')?.value.trim()||selectedPetName;const cur=classesData.find(c=>c.id===currentClassId);const student=cur.students.find(s=>s.id.toString()===studentId.toString());if(!student)return;adoptNewPet(student, selectedPetName, nickname);const _savedModalStudentId=currentModalStudentId;closeModal();currentModalStudentId=_savedModalStudentId;if(currentModalStudentId && currentModalStudentId===studentId) openStudentModal(studentId); else renderHomePetGrid();}

/* ========== 宠物商店系统 ========== */
function showChangePetModal(studentId){ const cur=classesData.find(c=>c.id===currentClassId); const student=cur.students.find(s=>s.id.toString()===studentId.toString()); const activePet=getActivePet(student); if(!activePet||activePet.level>=2){showNotification('等级≥2无法更换','','error');return;} let list='<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;">'; Object.keys(PET_CONFIG).forEach(name=>{list+=`<div class="pet-select-item" style="padding:5px;" onclick="selectPetForChange('${name}','${studentId}')"><div class="pet-select-img" style="width:60px;height:60px;">${getPetImage(name,1)}</div><div>${name}</div></div>`;}); list+='</div>'; showModal('更换宠物(仅限Lv1)',list,[{text:'取消',onclick:'closeModal()'}],false); }
function selectPetForChange(petName,studentId){selectedPetName=petName;showModal('新昵称',`<input id="nicknameInput" value="${petName}">`,[{text:'取消',onclick:'closeModal()'},{text:'确认',onclick:`confirmChangePet('${studentId}')`}]);}
function confirmChangePet(studentId){const nickname=document.getElementById('nicknameInput')?.value.trim()||selectedPetName;const cur=classesData.find(c=>c.id===currentClassId);const student=cur.students.find(s=>s.id.toString()===studentId.toString());const activePet=getActivePet(student);if(!activePet||activePet.level>=2)return;const idx=student.pets.findIndex(p=>p.id===activePet.id);if(idx!==-1){student.pets[idx]={...activePet,name:selectedPetName,nickname:nickname,level:1,growth:activePet.growth,lastFeedDate:activePet.lastFeedDate||new Date().toISOString(),todayFeedCount:0,isDead:activePet.isDead, todayPlayCount:0, lastPlayDate:null, penaltyStreak:activePet.penaltyStreak||0};saveClassData();closeModal();scheduleAllRenders();showNotification('更换成功',`新宠物${nickname}`,'success');}}
function renamePet(studentId, petId){ const cur=classesData.find(c=>c.id===currentClassId); if(!cur) return; const student=cur.students.find(s=>s.id.toString()===studentId.toString()); if(!student) return; const pet=student.pets.find(p=>String(p.id)===String(petId)); if(!pet) return; const oldName=pet.nickname||pet.name; showModal('修改宠物名字',`<div style="text-align:center;margin-bottom:10px;font-size:14px;color:#888;">当前名字：<strong>${esc(oldName)}</strong></div><input id="renamePetInput" value="${escAttr(oldName)}" maxlength="20" style="width:100%;padding:10px 14px;border:2px solid #ffcfcf;border-radius:16px;font-size:16px;text-align:center;outline:none;box-sizing:border-box;" onfocus="this.select()" placeholder="请输入新名字">`,[{text:'取消',onclick:'closeModal()'},{text:'确认修改',onclick:`confirmRenamePet('${escJS(studentId)}','${escJS(petId)}')`}]); setTimeout(()=>{const inp=document.getElementById('renamePetInput');if(inp)inp.focus();},100); }
function confirmRenamePet(studentId, petId){ const inp=document.getElementById('renamePetInput'); if(!inp) return; const newName=inp.value.trim(); if(!newName){showNotification('名字不能为空','请输入一个宠物名字','warning');return;} const cur=classesData.find(c=>c.id===currentClassId); if(!cur) return; const student=cur.students.find(s=>s.id.toString()===studentId.toString()); if(!student) return; const pet=student.pets.find(p=>String(p.id)===String(petId)); if(!pet) return; const oldName=pet.nickname||pet.name; pet.nickname=newName; saveClassData(); closeModal(); scheduleAllRenders(); if(currentModalStudentId && student.id.toString()===currentModalStudentId.toString()) refreshCurrentStudentModal(); showNotification('改名成功',`${oldName} → ${newName}`,'success'); }
function showSwitchPetModal(studentId){ const cur=classesData.find(c=>c.id===currentClassId); const student=cur.students.find(s=>s.id.toString()===studentId.toString()); if(!student||student.pets.length<=1)return; const maxed=countMaxedPets(student); let html=maxed>0?`<div style="text-align:center;margin-bottom:10px;padding:6px 16px;background:linear-gradient(135deg,#fff8e0,#fff0c0);border-radius:16px;font-size:14px;font-weight:700;color:#b8860b;">👑 ${maxed}只传说神兽 · 宠物大师</div>`:''; html+='<div style="display:flex;flex-direction:column;gap:8px;">'; student.pets.forEach(p=>{const isActive = Number(student.activePetId)===Number(p.id); const isMax=p.level>=9; const borderStyle=isMax?'2px solid #ffd700':isActive?'2px solid #ff8888':'1px solid #ffcfcf'; const bg=isMax?'linear-gradient(135deg,#fffbe6,#fff5d0)':'#fff'; const badge=isMax?'<span style="background:linear-gradient(135deg,#ffd700,#ff8c00);color:#fff;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:800;margin-left:6px;">👑 满级</span>':''; html+=`<div style="display:flex;align-items:center;gap:12px;padding:10px 14px;border:${borderStyle};border-radius:20px;cursor:pointer;background:${bg};transition:all 0.2s;" onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 4px 12px rgba(0,0,0,0.1)'" onmouseout="this.style.transform='none';this.style.boxShadow='none'" onclick="switchPet('${studentId}','${p.id}');closeModal();"><div style="width:55px;height:55px;flex-shrink:0;">${getPetImage(p.name, p.level)}</div><div style="flex:1;"><strong>${esc(p.nickname||p.name)}</strong>${badge} <span style="color:#aaa;font-size:12px;">${isActive?'⭐当前展示':''}</span><br><span style="font-size:13px;color:#888;">Lv.${p.level} · ${getCurrentStageName(p.name,p.level)} · 成长:${p.level>=9?getExpNeeded(p):p.growth}${p.isDead?' · 💀已死亡':''}</span></div></div>`;}); html+='</div><div style="margin-top:10px;text-align:center;color:#bbb;font-size:12px;">点击切换卡片展示的宠物，喂食自动作用于未满级宠物</div>'; showModal('切换展示宠物',html,[{text:'关闭',onclick:'closeModal()'}],false); }
function switchPet(studentId, petId){ const cur = classesData.find(c=>c.id===currentClassId); const student = cur.students.find(s=>s.id.toString()===studentId.toString()); if(student) setActivePet(student, Number(petId)); }
function setActivePet(student, petId){ petId = Number(petId); if(student.pets.some(p=>Number(p.id)===petId)){ student.activePetId = petId; saveClassData(); renderHomePetGrid(); renderPKPage(); if(currentModalStudentId && student.id.toString()===currentModalStudentId.toString()) refreshCurrentStudentModal(); } }
function showBatchEditModal(){ if(!currentClassId){ showNotification('请先选择班级','','error'); return; } const cur = classesData.find(c=>c.id===currentClassId); if(!cur || cur.students.length===0){ showNotification('班级无学生','请先添加学生','warning'); return; } let studentListHtml = '<div class="batch-checkbox-list"><div><label><input type="checkbox" id="selectAllBatch" onclick="toggleAllBatch(this.checked)"> 全选/取消全选</label></div>'; cur.students.forEach((s)=>{ studentListHtml += `<div class="batch-student-item"><input type="checkbox" class="batch-student-chk" value="${s.id}" id="stu_${s.id}"><label for="stu_${s.id}">${esc(s.name)} (💰${s.coins})</label></div>`; }); studentListHtml += '</div><div><label>奖惩项目: <select id="batchActionSelect">'; customActions.forEach(act=>{ const sign = act.coins>0 ? `+${act.coins}` : `${act.coins}`; studentListHtml += `<option value="${act.id}">${esc(act.name)} (${sign}金币)</option>`; }); studentListHtml += '</select></label><label style="margin-left:10px;"><input type="checkbox" id="batchCustomToggle" onchange="document.getElementById(\'batchCustomCoins\').style.display=this.checked?\'inline-block\':\'none\';document.getElementById(\'batchActionSelect\').disabled=this.checked;"> 自定义加金币</label><span id="batchCustomCoins" style="display:none;margin-left:8px;"><input type="number" id="batchCustomValue" style="width:70px;padding:4px 6px;border:1px solid #ccc;border-radius:8px;font-size:14px;" placeholder="金币数" value="10"> 金币</span></div>'; showModal('批量奖惩', studentListHtml, [{text:'取消', class:'btn-secondary', onclick:'closeModal()'},{text:'执行', class:'btn-primary', onclick:'confirmBatchAction()'}], false); setTimeout(()=>{ const selectAll = document.getElementById('selectAllBatch'); if(selectAll) selectAll.onchange = (e) => toggleAllBatch(e.target.checked); }, 50); }
function toggleAllBatch(checked){ const chks = document.querySelectorAll('.batch-student-chk'); chks.forEach(chk => chk.checked = checked); }
function confirmBatchAction(){ const cur = classesData.find(c=>c.id===currentClassId); if(!cur) return; const isCustom = document.getElementById('batchCustomToggle')?.checked; let action; if(isCustom){ const val = parseInt(document.getElementById('batchCustomValue')?.value); if(isNaN(val)||val===0){ showNotification('请输入有效的金币数','不能为0','warning'); return; } action = {id:'_custom_', name:'自定义'+(val>0?'+':'')+val+'金币', coins: val}; } else { const actionId = document.getElementById('batchActionSelect')?.value; action = customActions.find(a=>String(a.id)===String(actionId)); if(!action){ showNotification('错误','未选择有效的奖惩项目','error'); return; } } const selectedIds = Array.from(document.querySelectorAll('.batch-student-chk:checked')).map(cb=>cb.value); if(selectedIds.length===0){ showNotification('请至少选择一名学生','','warning'); return; } let updatedCount = 0; cur.students.forEach(s=>{ if(selectedIds.includes(s.id.toString())){ let pet = getActivePet(s); if(pet){ let coinsChange = action.coins; let isPenalty = coinsChange < 0; let expChange = 0; if(pet.isDead){ if(isPenalty){ showNotification('操作跳过',`${s.name} 宠物已死亡，惩罚跳过`,'warning'); return; } else { s.coins += coinsChange; if(s.coins<0) s.coins=0; recordAction(s.id, s.name, '批量奖惩', `${action.name} (宠物死亡)`, coinsChange, 0, pet.id); updatedCount++; return; } } if(isPenalty){ let absDeduct = Math.abs(coinsChange); let coinDeducted = Math.min(absDeduct, s.coins); let remaining = absDeduct - coinDeducted; s.coins -= coinDeducted; expChange = 0; if(remaining > 0){ expChange = -remaining; let prevGrowth = pet.growth; pet.growth += expChange; if(pet.growth <= 0){ pet.growth = 0; pet.isDead = true; pet.deathGrowth = prevGrowth; pet.deathDate = new Date().toISOString(); pet.penaltyStreak = 0; recordAction(s.id, s.name, '惩罚致死', `${action.name} 导致死亡（金币不足，经验扣至0）`, -absDeduct, -prevGrowth, pet.id, {causedDeath: true, prevGrowth: prevGrowth}); updatedCount++; return; } updatePetLevel(s, pet.id, expChange); } recordAction(s.id, s.name, '批量奖惩', `${action.name}`, -coinDeducted, expChange, pet.id); updatedCount++; } else { if(pet.penaltyStreak !== undefined) pet.penaltyStreak = 0; s.coins += coinsChange; if(s.coins<0) s.coins=0; recordAction(s.id, s.name, '批量奖惩', `${action.name}`, coinsChange, 0, pet.id); updatedCount++; } } else { s.coins += action.coins; if(s.coins<0) s.coins=0; recordAction(s.id, s.name, '批量奖惩', `${action.name} (无宠物)`, action.coins, 0, null); updatedCount++; } } }); if(updatedCount>0){ saveClassData(); scheduleAllRenders(); if(currentModalStudentId) refreshCurrentStudentModal(); showNotification('批量操作完成',`已对${updatedCount}名学生执行“${action.name}”`,'success'); } else { showNotification('无变化','操作未生效','info'); } closeModal(); }
function showPauseGrowthModal(){ if(!currentClassId)return; const cur=classesData.find(c=>c.id===currentClassId); const p=cur.pauseGrowth||{start:'',end:''}; const content=`<div><label>开始: <input type="date" id="ps" value="${p.start}"></label><br><label>结束: <input type="date" id="pe" value="${p.end}"></label><p>假期内停止饿死计时</p></div>`; showModal('假期保护',content,[{text:'清除',onclick:'clearPause()'},{text:'保存',onclick:'savePause()'},{text:'关闭',onclick:'closeModal()'}]); }
function savePause(){const s=document.getElementById('ps').value,e=document.getElementById('pe').value;if(s&&e){const cur=classesData.find(c=>c.id===currentClassId);cur.pauseGrowth={start:s,end:e};saveClassData();closeModal();showNotification('已设置','','success');}}
function clearPause(){const cur=classesData.find(c=>c.id===currentClassId);delete cur.pauseGrowth;saveClassData();closeModal();showNotification('已清除假期','','info');}
function showCustomActionsModal(){ let items='';customActions.forEach(a=>{const sign=a.coins>0?`+${a.coins}`:`${a.coins}`;items+=`<div class="custom-action-item"><span>${esc(a.name)} ${sign}金币</span><span><span onclick="editCustomAction('${a.id}')">✏️</span> ${!String(a.id).startsWith('sys_')?`<span onclick="deleteCustomAction('${a.id}')">🗑️</span>`:''}</span></div>`;});const content=`<div style="max-height:300px;overflow:auto;">${items}</div><button class="btn btn-success" onclick="showAddCustomActionModal()">➕ 新增奖惩</button>`;showModal('学习奖惩管理',content,[{text:'关闭',onclick:'closeModal()'}],false);}
function showAddCustomActionModal(){closeModal();showModal('新增奖惩','<input id="newActName" placeholder="名称"><input id="newCoins" type="number" placeholder="金币数量" value="10">',[{text:'取消',onclick:'showCustomActionsModal()'},{text:'保存',onclick:'saveNewReward()'}]);}
function saveNewReward(){const name=document.getElementById('newActName')?.value.trim();const coins=parseInt(document.getElementById('newCoins')?.value);if(!name||isNaN(coins)){showNotification('错误','请填写有效名称和金币数','error');return;}customActions.push({id:Date.now().toString(),name,coins});saveCustomActions();closeModal();showCustomActionsModal();}
function editCustomAction(id){const act=customActions.find(a=>String(a.id)===String(id));if(!act)return;closeModal();showModal('编辑奖惩',`<input id="editName" value="${esc(act.name)}"><input id="editCoins" value="${act.coins}" type="number">`,[{text:'取消',onclick:'showCustomActionsModal()'},{text:'保存',onclick:`updateReward('${id}')`}]);}
function updateReward(id){const name=document.getElementById('editName')?.value.trim();const coins=parseInt(document.getElementById('editCoins')?.value);if(name&&!isNaN(coins)){const idx=customActions.findIndex(a=>String(a.id)===String(id));if(idx!==-1){customActions[idx]={...customActions[idx],name,coins};saveCustomActions();}closeModal();showCustomActionsModal();}}
function deleteCustomAction(id){if(confirm('删除操作')){customActions=customActions.filter(a=>String(a.id)!==String(id));saveCustomActions();showCustomActionsModal();}}
function showStudentListModal(){if(!currentClassId)return;const cur=classesData.find(c=>c.id===currentClassId);let html='<div style="max-height:400px;overflow:auto;">';cur.students.forEach(s=>{html+=`<div class="student-list-item"><span>${esc(s.name)}</span><div><span class="edit-icon" style="cursor:pointer;" onclick="editStudentName('${s.id}')">✏️</span><span class="delete-icon" style="cursor:pointer;margin-left:10px;" onclick="deleteStudentById('${s.id}')">🗑️</span></div></div>`;});html+='</div>';showModal('学生列表',html,[{text:'增加学生',class:'btn-primary',onclick:'addSingleStudent()'},{text:'关闭',class:'btn-secondary',onclick:'closeModal()'},{text:'清空所有',class:'btn-danger',onclick:'clearAllStudents()'}]);}
function addSingleStudent(){const name=prompt('学生姓名');if(!name)return;const cur=classesData.find(c=>c.id===currentClassId);if(cur.students.find(s=>s.name===name.trim())){showNotification('已存在','','error');return;}cur.students.push({id:_genLocalId(),name:name.trim(),coins:50,pets:[],lastCheckinDate:null,activePetId:null,pkCountToday:0,lastPkDate:null});saveClassData();closeModal();showStudentListModal();scheduleAllRenders();}
function editStudentName(id){const cur=classesData.find(c=>c.id===currentClassId);const stu=cur.students.find(s=>s.id.toString()===id.toString());if(!stu)return;const newName=prompt('新名字',stu.name);if(newName)stu.name=newName.trim();saveClassData();closeModal();showStudentListModal();renderHomePetGrid();}
function deleteStudentById(id){if(confirm('删除学生')){const cur=classesData.find(c=>c.id===currentClassId);cur.students=cur.students.filter(s=>s.id.toString()!==id.toString());saveClassData();closeModal();showStudentListModal();scheduleAllRenders();if(currentModalStudentId && currentModalStudentId===id) closeModal();}}
function clearAllStudents(){if(confirm('清空所有学生？')){const cur=classesData.find(c=>c.id===currentClassId);cur.students=[];saveClassData();closeModal();scheduleAllRenders();if(currentModalStudentId) closeModal();}}
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
// ========== 排行榜三分类标签切换 ==========
function switchRankTab(tabName) {
  document.querySelectorAll('.rank-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.rank-tab-content').forEach(c => c.classList.remove('active'));
  const tabs = document.querySelectorAll('.rank-tab');
  const idx = tabName === 'growth' ? 0 : tabName === 'quiz' ? 1 : 2;
  if (tabs[idx]) tabs[idx].classList.add('active');
  const contentId = tabName === 'growth' ? 'rankGrowthContent' : tabName === 'quiz' ? 'rankQuizContent' : 'rankPigRunContent';
  const content = document.getElementById(contentId);
  if (content) content.classList.add('active');
  if (tabName === 'quiz') renderQuizRanking();
  if (tabName === 'pigrun') renderPigRunRanking();
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

function switchPage(pageId){if(pageId!=='quiz-page'&&typeof window._stopPigRunBGM==='function'){window._stopPigRunBGM();}document.querySelectorAll('.nav-item').forEach(i=>i.classList.remove('active'));document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));document.getElementById(pageId).classList.add('active');var isStudentView=typeof currentUser!=='undefined'&&currentUser&&currentUser.type==='student';if(pageId!=='quiz-page'&&!isStudentView&&typeof window._resetQuizModalFlag==='function'){window._resetQuizModalFlag();}else if(pageId==='quiz-page'&&!isStudentView){if(typeof window._resetQuizModalFlag==='function')window._resetQuizModalFlag();window._pigRunModalShown=false;window._teacherPlayingAsStudent=null;}var needsLogReload=isStudentView&&(pageId==='pk-page'||pageId==='jianghu-page');if(needsLogReload&&typeof _loadOperationLogs==='function'){_loadOperationLogs().then(function(){if(typeof _syncOpLogsAlias==='function'){try{_syncOpLogsAlias();}catch(e){}}requestAnimationFrame(()=>{if(pageId==='pk-page'){renderPKPage();var sa=document.getElementById('classpk-start-area');if(sa)sa.classList.remove('visible');probePKMonsterImages();}else if(pageId==='jianghu-page'){renderJianghuPage();probeJhBossImages();}});}).catch(function(e){console.warn('[switchPage] Log reload failed:',e);requestAnimationFrame(()=>{if(pageId==='pk-page')renderPKPage();else if(pageId==='jianghu-page')renderJianghuPage();});});}else{requestAnimationFrame(()=>{if(pageId==='honor-board-page'){renderClassTopThree();var art=document.querySelector('.rank-tab.active');if(art&&art.textContent.includes('\u6bcf\u65e5'))renderQuizRanking();else if(art&&art.textContent.includes('\u5c0f\u732a'))renderPigRunRanking();}else if(pageId==='quiz-page'){if(typeof renderQuizPage==='function')renderQuizPage();var aqt=document.querySelector('.quiz-tab.active');if(aqt&&aqt.textContent.includes('\u5c0f\u732a')){if(typeof renderPigRunPage==='function')renderPigRunPage();}}else if(pageId==='pk-page'){renderPKPage();var sa=document.getElementById('classpk-start-area');if(sa)sa.classList.remove('visible');probePKMonsterImages();}else if(pageId==='jianghu-page'){renderJianghuPage();probeJhBossImages();}});}}
function init(){renderClassList();if(classesData.length&&!currentClassId)currentClassId=classesData[0].id;scheduleAllRenders();/* 延迟非关键页面的初始渲染 */requestAnimationFrame(()=>{renderJianghuPage();probeClassPKRobotImages();});}
window.onload=async function(){
  /* ---- 云端模式：不渲染，等 dal.js 加载数据后调用 init() ---- */
  if(window._cloudMode){
    return;
  }
  init();
  /* ---- EXE 桌面模式：通过 URL #desktop 标记立即判断 ---- */
  if(window.location.hash === '#desktop'){
    /* 等待 pywebview API 就绪 */
    if(!(window.pywebview && window.pywebview.api)){
      await new Promise(resolve => {
        window.addEventListener('pywebviewready', resolve, {once:true});
      });
    }
    try {
      await _desktopLoadData();
      updateUSBStatus(true);
    } catch(e){ console.error('桌面模式初始化失败:', e); }
    return;
  }
  /* ---- 浏览器模式：和原来完全一样 ---- */
  if(window.showDirectoryPicker){
    const hasSaved = await loadDirHandle();
    showStartOverlay(!hasSaved);
  }
};
function showStartOverlay(isFirstTime){
  const ov = document.createElement('div');
  ov.id = 'startOverlay';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(255,230,220,0.97);z-index:9999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(2px);-webkit-backdrop-filter:blur(2px);';
  const tip = isFirstTime
    ? '首次使用，请选择本文件所在的文件夹<br>之后每次打开只需点击「授权」即可'
    : '点击授权后，数据自动保存到同级「数据」文件夹';
  const btnText = isFirstTime ? '📂 选择文件夹并授权' : '🔓 点击授权';
  ov.innerHTML = '<div style="text-align:center;background:white;border-radius:30px;padding:40px 50px;box-shadow:0 20px 60px rgba(255,150,120,0.3);max-width:420px;border:3px solid #ffe0d0;">'
    + '<div style="font-size:60px;margin-bottom:15px;">🍡</div>'
    + '<div style="font-size:24px;font-weight:700;color:#dd7a7a;margin-bottom:10px;">宠物世界</div>'
    + '<div style="color:#886060;margin-bottom:25px;font-size:15px;line-height:1.8;">' + tip + '</div>'
    + '<button id="startAuthBtn" onclick="startWithAuth()" style="background:linear-gradient(135deg,#ffb7b7,#ffc8b0);color:#442222;border:none;border-radius:25px;padding:16px 40px;font-size:18px;font-weight:700;cursor:pointer;box-shadow:0 8px 20px rgba(255,150,120,0.3);transition:all 0.3s;">' + btnText + '</button>'
    + '<div style="margin-top:18px;"><a href="javascript:skipAuth()" style="color:#bbaaaa;font-size:13px;text-decoration:underline;">跳过（数据仅保存在本机浏览器）</a></div>'
    + '</div>';
  document.body.appendChild(ov);
}
async function startWithAuth(){
  const btn = document.getElementById('startAuthBtn');
  if(btn){ btn.disabled=true; btn.textContent='授权中...'; }
  try {
    await connectUSB();
    const ov = document.getElementById('startOverlay');
    if(ov && _dataDirHandle) ov.remove();
    else if(btn){ btn.disabled=false; btn.textContent='🔓 重试授权'; }
  } catch(e) {
    if(btn){ btn.disabled=false; btn.textContent='🔓 重试授权'; }
  }
}
function skipAuth(){
  const ov = document.getElementById('startOverlay');
  if(ov) ov.remove();
  showNotification('提示', '数据仅保存在本机浏览器，换电脑会丢失', 'warning');
}

// ========== 覆盖关键函数，确保爱心正确 ==========
const originalRenderHomePetGrid = renderHomePetGrid;
window.renderHomePetGrid = function() {
  originalRenderHomePetGrid();
  // 宠物卡片浮动延迟（替代 MutationObserver）
  document.querySelectorAll('.home-pet-card').forEach(function(card, i) {
    card.style.animationDelay = (i % 6) * 0.5 + 's';
    card.style.animationDuration = (2.5 + Math.random() * 1.5) + 's';
  });
  // 呼吸随机延迟（替代 petGrid MutationObserver）
  if (window.__initBreathingDelays) window.__initBreathingDelays();
  attachCardHeartListeners();
  if (currentModalStudentId) setTimeout(() => startHeartForCurrentPet(currentModalStudentId), 100);
  else stopAllHeartEmitters();
};
function attachCardHeartListeners() {
  document.querySelectorAll('.home-pet-card').forEach(card => {
    // v46: Prevent duplicate listeners (called from both _applyGridBatchPostProcess and wrapper)
    if (card.dataset.heartListenerAttached) return;
    card.dataset.heartListenerAttached = '1';
    
    const onclick = card.getAttribute('onclick');
    if (!onclick) return;
    const m = onclick.match(/openStudentModal\(['"]([^'"]+)['"]\)/);
    if (!m) return;
    const studentId = m[1];
    card.addEventListener('mouseenter', function() {
      if (currentModalStudentId) return;
      const cur = classesData?.find(c=>c.id===currentClassId);
      if(!cur) return;
      const student = cur.students.find(s=>s.id.toString()===studentId.toString());
      if(!student) return;
      const activePet = getActivePet(student);
      if(!activePet || activePet.isDead) return;
      const topDiv = card.querySelector('.home-pet-top');
      if(topDiv) startHeartForContainer(topDiv);
    });
    card.addEventListener('mouseleave', function() {
      if (currentModalStudentId) return;
      stopAllHeartEmitters();
    });
  });
}
const originalRefreshCurrentStudentModal = refreshCurrentStudentModal;
window.refreshCurrentStudentModal = function() { originalRefreshCurrentStudentModal(); if(currentModalStudentId) setTimeout(()=>startHeartForCurrentPet(currentModalStudentId), 80); else stopAllHeartEmitters(); };
const originalSwitchPage = switchPage;
window.switchPage = function(pageId) { originalSwitchPage(pageId); if(pageId !== 'class-pet-page') stopAllHeartEmitters(); else if(currentModalStudentId) setTimeout(()=>startHeartForCurrentPet(currentModalStudentId), 80); };
const originalCloseModal = closeModal;
window.closeModal = function() { originalCloseModal(); stopAllHeartEmitters(); };
const originalSwitchPet = switchPet;
window.switchPet = function(studentId, petId) { originalSwitchPet(studentId, petId); if(currentModalStudentId === studentId) setTimeout(()=>startHeartForCurrentPet(studentId), 100); };
const originalSetActivePet = setActivePet;
window.setActivePet = function(student, petId) { originalSetActivePet(student, petId); if(currentModalStudentId === student.id) setTimeout(()=>startHeartForCurrentPet(student.id), 100); };
const originalConfirmAdoptPet = confirmAdoptPet;
window.confirmAdoptPet = function(studentId) { originalConfirmAdoptPet(studentId); setTimeout(()=> { if(currentModalStudentId === studentId) startHeartForCurrentPet(studentId); }, 200); };
const originalConfirmChangePet = confirmChangePet;
window.confirmChangePet = function(studentId) { originalConfirmChangePet(studentId); setTimeout(()=> { if(currentModalStudentId === studentId) startHeartForCurrentPet(studentId); }, 200); };
setTimeout(()=> { if(currentModalStudentId) startHeartForCurrentPet(currentModalStudentId); }, 300);

// ========== 宠物PK 核心逻辑（始终保留最后两个选中，圆形子弹攻击特效，保留原音效）==========
// 技能特效调度器

// ========== 背景音乐系统（自定义MP3版） ==========


/* ===== 简化拖拽：始终可直接拖拽交换卡片位置 ===== */
// v12: Swap two students' positions instead of reorder
function reorderStudent(fromIdx, toIdx){
  if(!currentClassId) return;
  // 只有教师才能拖拽排序
  if(!currentUser || currentUser.type !== 'teacher') return;
  const cur = classesData.find(c=>c.id===currentClassId);
  if(!cur || !cur.students) return;
  if(fromIdx < 0 || fromIdx >= cur.students.length) return;
  if(toIdx < 0 || toIdx >= cur.students.length) return;
  if(fromIdx === toIdx) return;
  // 交换两个学生卡片的位置
  const temp = cur.students[fromIdx];
  cur.students[fromIdx] = cur.students[toIdx];
  cur.students[toIdx] = temp;
  // 保存排序到 localStorage（按班级）
  saveStudentOrder(currentClassId, cur.students);
  saveClassData();
  renderHomePetGrid();
}

// 保存学生排序顺序到 localStorage
function saveStudentOrder(classId, students){
  if(!classId || !students) return;
  const order = students.map(s => s.id);
  try {
    localStorage.setItem('studentOrder_' + classId, JSON.stringify(order));
  } catch(e) {
    console.warn('[DAL] Failed to save student order:', e);
  }
}

// 从 localStorage 加载学生排序
function loadStudentOrder(classId){
  if(!classId) return null;
  try {
    const orderStr = localStorage.getItem('studentOrder_' + classId);
    if(orderStr) return JSON.parse(orderStr);
  } catch(e) {
    console.warn('[DAL] Failed to load student order:', e);
  }
  return null;
}

// 应用排序到学生数组
function applyStudentOrder(classId, students){
  if(!classId || !students || students.length === 0) return students;
  const order = loadStudentOrder(classId);
  if(!order || order.length === 0) return students;
  // 创建 ID 到学生的映射
  const studentMap = {};
  students.forEach(s => { studentMap[s.id] = s; });
  // 按排序顺序重建数组
  const ordered = [];
  order.forEach(id => {
    if(studentMap[id]) {
      ordered.push(studentMap[id]);
      delete studentMap[id];
    }
  });
  // 添加新增的学生（不在排序中的）
  Object.values(studentMap).forEach(s => ordered.push(s));
  return ordered;
}

/* renderHomePetGrid后自动重绑拖拽 */
{
  const _prevRender = renderHomePetGrid;
  renderHomePetGrid = function(){
    _prevRender();
    bindPetCardDrag();
  };
}

/* ===== 宠物卡片直接拖拽排序（仅教师可用） ===== */
let petDragIdx = null;
function bindPetCardDrag(){
  const grid = document.getElementById('homePetGrid');
  if(!grid) return;
  // 只有教师账户才能拖拽排序
  if(!currentUser || currentUser.type !== 'teacher') return;
  const cards = grid.querySelectorAll('.home-pet-card');
  cards.forEach((card, idx) => {
    card.draggable = true;
    card.dataset.petIdx = idx;
    card.addEventListener('dragstart', petCardDragStart);
    card.addEventListener('dragend', petCardDragEnd);
    card.addEventListener('dragover', petCardDragOver);
    card.addEventListener('dragleave', petCardDragLeave);
    card.addEventListener('drop', petCardDrop);
  });
}
function petCardDragStart(e){
  petDragIdx = +this.dataset.petIdx;
  this.classList.add('dragging');
  this.style.opacity = '0.4';
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', petDragIdx);
}
function petCardDragEnd(e){
  this.classList.remove('dragging');
  this.style.opacity = '';
  petDragIdx = null;
  document.querySelectorAll('.home-pet-card.drag-over').forEach(el => el.classList.remove('drag-over'));
}
function petCardDragOver(e){
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  if(+this.dataset.petIdx !== petDragIdx) this.classList.add('drag-over');
}
function petCardDragLeave(e){
  this.classList.remove('drag-over');
}
function petCardDrop(e){
  e.preventDefault();
  this.classList.remove('drag-over');
  const toIdx = +this.dataset.petIdx;
  if(petDragIdx === null || petDragIdx === toIdx) return;
  reorderStudent(petDragIdx, toIdx);
}

