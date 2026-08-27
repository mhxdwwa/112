// ========== 宠物PK 核心逻辑（始终保留最后两个选中，圆形子弹攻击特效，保留原音效）==========
let pkState = {
  players: [],      // 存储选中的学生对象 { studentId, studentName, pet }
  isFighting: false
};

function resetDailyPkCountIfNeeded(student) {
  const today = new Date().toDateString();
  if (student.lastPkDate !== today) {
    student.pkCountToday = 0;
    student.lastPkDate = today;
    // Clear handled challenge tracking on new day
    _handledPKChallengeIds.clear();
    _saveHandledPKChallengeIds();
  }
}

function renderPKPage() {
  const container = document.getElementById('pkContent');
  if(!currentClassId) {
    container.innerHTML = '<div style="text-align:center;padding:40px;">请先在【宠物管理】页面选择一个班级</div>';
    return;
  }
  const cur = classesData.find(c=>c.id===currentClassId);
  if(!cur || cur.students.length < 2) {
    container.innerHTML = '<div style="text-align:center;padding:40px;">班级至少需要2名有宠物的学生才能开始PK</div>';
    return;
  }
  
  // Check if current user is a student
  const isStudentView = typeof currentUser !== 'undefined' && currentUser && currentUser.type === 'student';
  const myStudentId = isStudentView ? parseInt(currentUser.studentId) : null;
  
  // 先筛选有存活宠物的学生
  const allAliveStudents = cur.students.filter(s => {
    const p = getActivePet(s);
    if(p && !p.isDead) {
      resetDailyPkCountIfNeeded(s);
      return true;
    }
    return false;
  });
  // 再筛选有PK资格的学生（今日奖惩获得>=5金币）
  const validStudents = allAliveStudents.filter(s => hasPKQualificationToday(s.id));
  
  // === Student view: render BEFORE the "not enough students" check ===
  if (isStudentView) {
    const myStudent = cur.students.find(s => s.id.toString() === myStudentId.toString());
    const myPet = myStudent ? getActivePet(myStudent) : null;
    const myValid = myStudent && hasPKQualificationToday(myStudent.id);
    
    // Check for pending challenges targeting me first
    const pendingChallenge = _getPendingPKChallengeForMe();
    if (pendingChallenge) {
      // Only show dialog if PK page is currently visible and we haven't shown it for this challenge
      const pkPageEl = document.getElementById('pk-page');
      if (pkPageEl && pkPageEl.classList.contains('active')) {
        if (_pkChallengeState._lastShownChallengeId !== pendingChallenge.id) {
          _pkChallengeState._lastShownChallengeId = pendingChallenge.id;
          _showPKChallengeDialog(pendingChallenge);
        }
        return;
      }
    } else {
      // Reset when no pending challenge
      _pkChallengeState._lastShownChallengeId = null;
    }
    
    if (!myValid) {
      let noQualHtml = `<div style="text-align:center;padding:40px;line-height:2;">
        <div style="font-size:48px;margin-bottom:16px;">🔒</div>
        <div style="font-size:18px;font-weight:700;color:#a06040;">你还没有PK资格</div>
        <div style="font-size:14px;color:#888;margin-top:8px;">今日通过【奖惩/批量奖惩/每日打卡/取金阁】获得≥5金币即可参加PK</div>
        <div style="font-size:12px;color:#aaa;margin-top:16px;">当前有资格的学生：${validStudents.length}人</div>`;
      // v14: Show list of qualified students even when current student doesn't qualify
      if (validStudents.length > 0) {
        noQualHtml += `<div style="margin-top:15px;text-align:left;max-width:400px;margin-left:auto;margin-right:auto;">`;
        noQualHtml += `<div style="font-size:13px;font-weight:600;color:#a06040;margin-bottom:8px;">当前有资格PK的同学：</div>`;
        validStudents.forEach(s => {
          const p = getActivePet(s);
          if (p) {
            noQualHtml += `<div style="display:flex;align-items:center;gap:8px;padding:6px 10px;background:#fff8f0;border-radius:10px;margin-bottom:4px;">
              <div style="width:30px;height:30px;">${getPetImage(p.name, p.level)}</div>
              <div style="font-size:13px;font-weight:600;color:#664;">${esc(s.name)}</div>
              <div style="font-size:11px;color:#aa8;">Lv.${p.level} ${esc(p.nickname||p.name)}</div>
            </div>`;
          }
        });
        noQualHtml += `</div>`;
      }
      noQualHtml += `</div>`;
      container.innerHTML = noQualHtml;
      return;
    }
    
    // v14: Student view - show PK info with list of qualified opponents
    let html = '';
    html += `<div style="margin-bottom:10px;padding:8px 16px;background:#fff8f0;border-radius:12px;border:1px solid #ffe0c0;font-size:13px;color:#a06040;">⚔️ PK资格：今日通过【奖惩/批量奖惩/每日打卡/取金阁】获得≥5金币方可参加 · 每人每日最多3次PK · 打卡也可获得资格</div>`;
    html += `<div style="text-align:center;padding:20px;line-height:2;">
      <div style="font-size:48px;margin-bottom:16px;">⚔️</div>
      <div style="font-size:18px;font-weight:700;color:#4a90d9;">PK挑战</div>
      <div style="font-size:14px;color:#888;margin-top:8px;">你有PK资格，可以通过发起挑战与其他学生进行对战</div>
      <div style="margin-top:20px;">
        <button class="btn btn-primary" onclick="showStudentPKChallengeModal()" style="padding:12px 30px;font-size:15px;">发起PK挑战</button>
      </div>
    </div>`;
    // v14: Show list of qualified opponents
    const opponents = validStudents.filter(s => s.id.toString() !== myStudentId.toString());
    if (opponents.length > 0) {
      html += `<div style="margin-top:10px;"><div style="font-size:13px;font-weight:600;color:#a06040;margin-bottom:8px;">可挑战的同学 (${opponents.length}人)：</div>`;
      html += `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px;">`;
      opponents.forEach(s => {
        const p = getActivePet(s);
        if (p) {
          html += `<div style="display:flex;align-items:center;gap:6px;padding:8px 10px;background:#f0f8ff;border-radius:10px;border:1px solid #d0e8ff;">
            <div style="width:28px;height:28px;">${getPetImage(p.name, p.level)}</div>
            <div>
              <div style="font-size:12px;font-weight:600;color:#446;">${esc(s.name)}</div>
              <div style="font-size:10px;color:#889;">Lv.${p.level} 💰${s.coins}</div>
            </div>
          </div>`;
        }
      });
      html += `</div></div>`;
    }
    container.innerHTML = html;
    return;
  }
  
  // === Teacher view ===
  if(validStudents.length < 2) {
    let hintMsg = '⚔️ 当前有资格PK的学生不足2人<br><br><span style="font-size:14px;color:#888;">PK资格：今日通过【奖惩/批量奖惩/打卡/取金阁】获得≥5金币</span>';
    if(allAliveStudents.length >= 2 && validStudents.length < 2) {
      hintMsg += '<br><span style="font-size:13px;color:#a06040;">请先给学生施加奖惩或批量奖惩，获得金币后才能参加PK</span>';
    }
    container.innerHTML = `<div style="text-align:center;padding:40px;line-height:2;">${hintMsg}</div>`;
    return;
  }
  
  let html = '';
  html += `<div style="margin-bottom:10px;padding:8px 16px;background:#fff8f0;border-radius:12px;border:1px solid #ffe0c0;font-size:13px;color:#a06040;">⚔️ PK资格：今日通过【奖惩/批量奖惩/打卡/取金阁】获得≥5金币方可参加</div>`;
  html += `<div style="margin-bottom:20px;"><h3>选择你的宠物</h3><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:15px;">`;
  validStudents.forEach(s => {
    const p = getActivePet(s);
    const isSelected = pkState.players.some(p => p.studentId.toString() === s.id.toString());
    html += `<div class="pk-opponent-item ${isSelected ? 'selected' : ''}" onclick="selectPKPlayer('${s.id}')">
      <div class="pk-opponent-avatar">${getPetImage(p.name, p.level)}</div>
      <div>
        <div style="font-weight:700;">${esc(s.name)}</div>
        <div style="font-size:14px;">${esc(p.nickname||p.name)} Lv.${p.level}</div>
        <div style="font-size:12px;color:#885555;">成长: ${p.level>=9?getExpNeeded(p):p.growth}</div>
        <div style="font-size:12px;color:#d4a017;margin-top:2px;">💰 金币: ${s.coins}</div>
        <div style="font-size:12px;color:#ff8844;margin-top:4px;">📊 今日PK: ${s.pkCountToday || 0}/3次</div>
      </div>
      ${isSelected?'<div style="font-size:24px;">✅</div>':''}
    </div>`;
  });
  html += `</div></div>`;
  html += `<div style="text-align:center;margin-top:20px;">
    <button class="btn btn-secondary" onclick="resetPKSelection()">重置选择</button>
    <button class="btn btn-primary" onclick="startPKBattle()" ${(pkState.players.length !== 2)?'disabled':''}>⚔️ 开始对战</button>
  </div>`;
  container.innerHTML = html;
}

// PK Challenge system for students
let _pkChallengeState = { pending: null, _lastShownChallengeId: null };

// v35: Fast poll timer for PK challenge acceptance (reduces delay from 30s to 2s)
let _pkChallengePollTimer = null;

function _startPKChallengePolling() {
  _stopPKChallengePolling();
  var pollStart = Date.now();
  _pkChallengePollTimer = setInterval(function() {
    // Stop after 5 minutes (timeout)
    if (Date.now() - pollStart > 5 * 60 * 1000 || pkState.isFighting) {
      _stopPKChallengePolling();
      return;
    }
    // Reload logs from Supabase and check for acceptance
    if (typeof _loadOperationLogs === 'function') {
      _loadOperationLogs().then(function() {
        if (typeof _syncOpLogsAlias === 'function') { try { _syncOpLogsAlias(); } catch(e) {} }
        _checkAcceptedPKChallenge();
      }).catch(function() {});
    }
  }, 5000); // v53: 5s interval (was 2s) — reduces 150 queries/challenge to 60
}

function _stopPKChallengePolling() {
  if (_pkChallengePollTimer) {
    clearInterval(_pkChallengePollTimer);
    _pkChallengePollTimer = null;
  }
}

// Persistent set of handled challenge IDs (survives log reloads from Supabase)
// This prevents infinite battle loops when logs are re-synced
let _handledPKChallengeIds = new Set();
// v34: Load persisted handled challenge IDs from localStorage
try {
  const saved = localStorage.getItem('_handledPKChallengeIds');
  if (saved) {
    const arr = JSON.parse(saved);
    if (Array.isArray(arr)) arr.forEach(id => _handledPKChallengeIds.add(id));
  }
} catch(e) {}

// v34: Helper to persist handled challenge IDs to localStorage
function _saveHandledPKChallengeIds() {
  try {
    localStorage.setItem('_handledPKChallengeIds', JSON.stringify(Array.from(_handledPKChallengeIds)));
  } catch(e) {}
}

// ========== Seeded PRNG for synchronized PK battles ==========
// Mulberry32: deterministic random from a seed
function _mulberry32(seed) {
  return function() {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
// Active seeded RNG for current PK battle (null = use Math.random)
let _pkBattleRng = null;
// Pre-determined monster image indices for synchronized visuals
let _pkBattleLeftMonsterIdx = -1;
let _pkBattleRightMonsterIdx = -1;

function _pkRng() {
  return _pkBattleRng ? _pkBattleRng() : Math.random();
}

// Helper: count pending challenges I sent today (not yet accepted/declined)
function _countMyPendingPKChallenges() {
  const isStudentView = typeof currentUser !== 'undefined' && currentUser && currentUser.type === 'student';
  if (!isStudentView) return { total: 0, targets: {} };
  const myStudentId = parseInt(currentUser.studentId);
  const today = new Date().toDateString();
  var _logs = getOpLogs();
  let total = 0;
  const targets = {}; // targetId -> count
  for (let i = 0; i < _logs.length; i++) {
    const log = _logs[i];
    if (log.actionType !== 'PK挑战') continue;
    if (log.reverted) continue;
    if (!log.extra || !log.extra.pkChallenge) continue;
    if (log.extra.challengerId !== myStudentId) continue;
    const logDate = new Date(log.timestamp).toDateString();
    if (logDate !== today) continue;
    if (log.extra.status !== 'pending') continue;
    // Check not expired (within 5 minutes)
    const challengeTime = new Date(log.timestamp).getTime();
    if (Date.now() - challengeTime > 5 * 60 * 1000) continue;
    total++;
    const tid = log.extra.targetId;
    targets[tid] = (targets[tid] || 0) + 1;
  }
  return { total, targets };
}

// Helper: check if I already have a pending/in-progress PK battle (only check isFighting flag)
function _hasActivePKBattle() {
  const isStudentView = typeof currentUser !== 'undefined' && currentUser && currentUser.type === 'student';
  if (!isStudentView) return false;
  // Only block if currently fighting - allow re-invite after battle completes
  return pkState.isFighting;
}

function selectPKOpponent(studentId) {
  if(pkState.isFighting) return;
  const isStudentView = typeof currentUser !== 'undefined' && currentUser && currentUser.type === 'student';
  if (!isStudentView) return selectPKPlayer(studentId); // Fall back to teacher behavior
  
  const myStudentId = parseInt(currentUser.studentId);
  const cur = classesData.find(c=>c.id===currentClassId);
  const myStudent = cur.students.find(s => s.id.toString() === myStudentId.toString());
  const opponent = cur.students.find(s=>s.id.toString()===studentId.toString());
  if (!myStudent || !opponent) return;
  
  const myPet = getActivePet(myStudent);
  const opponentPet = getActivePet(opponent);
  if (!myPet || !opponentPet) {
    showNotification('无法选择', '宠物未存活', 'warning');
    return;
  }
  
  // Always keep myself as first player, toggle opponent as second
  if (pkState.players.length === 2 && pkState.players[1].studentId.toString() === studentId.toString()) {
    // Deselect
    pkState.players = [{ studentId: myStudentId, studentName: myStudent.name, pet: {...myPet} }];
  } else {
    pkState.players = [
      { studentId: myStudentId, studentName: myStudent.name, pet: {...myPet} },
      { studentId: opponent.id, studentName: opponent.name, pet: {...opponentPet} }
    ];
  }
  renderPKPage();
}

function sendPKChallenge() {
  if (pkState.players.length !== 2) return;
  const isStudentView = typeof currentUser !== 'undefined' && currentUser && currentUser.type === 'student';
  if (!isStudentView) return;
  
  const myStudentId = parseInt(currentUser.studentId);
  const challenger = pkState.players.find(p => p.studentId === myStudentId);
  const target = pkState.players.find(p => p.studentId !== myStudentId);
  
  if (!challenger || !target) return;
  
  // === 邀请限制检查 ===
  // 1. 检查是否已经有活跃的战斗
  if (_hasActivePKBattle()) {
    showNotification('无法发起', '你已有一场进行中的PK，请等待结束', 'warning');
    pkState.players = [];
    renderPKPage();
    return;
  }
  
  // 2. 检查待处理邀请总数（最多3个）
  const pendingInfo = _countMyPendingPKChallenges();
  if (pendingInfo.total >= 3) {
    showNotification('邀请已满', '你最多同时向3位同学发出邀请，请等待对方回应', 'warning');
    pkState.players = [];
    renderPKPage();
    return;
  }
  
  // 3. 检查是否已经向同一学生发出过邀请（同一学生只能邀请一次）
  if (pendingInfo.targets[target.studentId] > 0) {
    showNotification('重复邀请', `你已经向 ${target.studentName} 发出过邀请，请等待对方回应`, 'warning');
    pkState.players = [];
    renderPKPage();
    return;
  }
  
  // Create challenge log entry
  const log = {
    id: _genLocalId(),
    timestamp: new Date().toISOString(),
    classId: currentClassId,
    studentId: target.studentId,
    studentName: target.studentName,
    actionType: 'PK挑战',
    details: `${challenger.studentName} 向 ${target.studentName} 发起PK挑战`,
    coinDelta: 0,
    expDelta: 0,
    petId: null,
    extra: {
      pkChallenge: true,
      challengerId: challenger.studentId,
      challengerName: challenger.studentName,
      targetId: target.studentId,
      targetName: target.studentName,
      status: 'pending',
      challengerPet: challenger.pet,
      targetPet: target.pet
    },
    reverted: false,
    _synced: false
  };
  
  window.operationLogs.push(log);
  saveLogs();
  
  // Show waiting message
  showNotification('挑战已发送', `等待 ${target.studentName} 接受挑战...`, 'info');
  
  // Store challenge state locally
  _pkChallengeState.pending = {
    challengerId: challenger.studentId,
    targetId: target.studentId,
    timestamp: Date.now()
  };
  
  // v35: Start fast polling to detect acceptance quickly (replaces 30s wait)
  _startPKChallengePolling();
  
  // Reset selection
  pkState.players = [];
  renderPKPage();
}

// v12: Show modal for student to select opponent and send challenge
function showStudentPKChallengeModal() {
  const isStudentView = typeof currentUser !== 'undefined' && currentUser && currentUser.type === 'student';
  if (!isStudentView) return;
  
  const myStudentId = parseInt(currentUser.studentId);
  const cur = classesData.find(c=>c.id===currentClassId);
  const myStudent = cur.students.find(s => s.id.toString() === myStudentId.toString());
  const myPet = myStudent ? getActivePet(myStudent) : null;
  
  if (!myStudent || !myPet) {
    showNotification('无法发起挑战', '你的宠物未存活', 'warning');
    return;
  }
  
  // Check if student has PK qualification
  if (!hasPKQualificationToday(myStudentId)) {
    showNotification('无PK资格', '今日需要通过奖惩/打卡/取金阁获得至少5金币', 'warning');
    return;
  }
  
  // Check daily PK limit
  if ((myStudent.pkCountToday || 0) >= 3) {
    showNotification('已达上限', '今日PK次数已用完（最多3次）', 'warning');
    return;
  }
  
  // Check pending invitations limit
  const pendingInfo = _countMyPendingPKChallenges();
  if (pendingInfo.total >= 3) {
    showNotification('邀请已满', '你最多同时向3位同学发出邀请，请等待对方回应', 'warning');
    return;
  }
  
  // Check for active battle
  if (_hasActivePKBattle()) {
    showNotification('无法发起', '你已有一场进行中的PK', 'warning');
    return;
  }
  
  // Get eligible opponents (exclude already-invited students)
  const opponents = cur.students.filter(s => {
    if (s.id.toString() === myStudentId.toString()) return false;
    const p = getActivePet(s);
    if (!p || p.isDead || !hasPKQualificationToday(s.id)) return false;
    // Exclude students I already have a pending invitation to
    if (pendingInfo.targets[s.id] > 0) return false;
    return true;
  });
  
  if (opponents.length === 0) {
    showNotification('无可挑战对象', '当前没有其他有资格的学生可挑战', 'info');
    return;
  }
  
  // Build opponent selection modal
  let html = `<div style="padding:12px;background:#f0f8ff;border-radius:12px;border:2px solid #4a90d9;margin-bottom:16px;">`;
  html += `<div style="font-size:13px;color:#4a90d9;margin-bottom:8px;">⚔️ 你的出战宠物</div>`;
  html += `<div style="display:flex;align-items:center;gap:12px;">
    <div style="font-size:36px;">${getPetImage(myPet.name, myPet.level)}</div>
    <div>
      <div style="font-weight:700;font-size:16px;">${esc(myStudent.name)}</div>
      <div style="font-size:14px;">${esc(myPet.nickname||myPet.name)} Lv.${myPet.level}</div>
      <div style="font-size:12px;color:#ff8844;">📊 今日PK: ${myStudent.pkCountToday || 0}/3次</div>
    </div>
  </div>`;
  html += `</div>`;
  
  html += `<div style="font-size:13px;color:#666;margin-bottom:8px;">选择一名对手发起挑战：</div>`;
  html += `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:15px;max-height:400px;overflow:auto;">`;
  opponents.forEach(s => {
    const p = getActivePet(s);
    html += `<div class="pk-opponent-item" onclick="selectStudentPKOpponentAndSend('${s.id}')" style="cursor:pointer;">
      <div class="pk-opponent-avatar">${getPetImage(p.name, p.level)}</div>
      <div>
        <div style="font-weight:700;">${esc(s.name)}</div>
        <div style="font-size:14px;">${esc(p.nickname||p.name)} Lv.${p.level}</div>
        <div style="font-size:12px;color:#885555;">成长: ${p.level>=9?getExpNeeded(p):p.growth}</div>
        <div style="font-size:12px;color:#d4a017;margin-top:2px;">💰 金币: ${s.coins}</div>
        <div style="font-size:12px;color:#ff8844;margin-top:4px;">📊 今日PK: ${s.pkCountToday || 0}/3次</div>
      </div>
    </div>`;
  });
  html += `</div>`;
  
  showModal('⚔️ 发起PK挑战', html, [{text:'取消', class:'btn-secondary', onclick:'closeModal()'}], true);
}

// v12: Select opponent and immediately send challenge
function selectStudentPKOpponentAndSend(opponentId) {
  const myStudentId = parseInt(currentUser.studentId);
  const cur = classesData.find(c=>c.id===currentClassId);
  const myStudent = cur.students.find(s => s.id.toString() === myStudentId.toString());
  const opponent = cur.students.find(s=>s.id.toString()===opponentId.toString());
  if (!myStudent || !opponent) return;
  
  const myPet = getActivePet(myStudent);
  const opponentPet = getActivePet(opponent);
  if (!myPet || !opponentPet) {
    showNotification('无法选择', '宠物未存活', 'warning');
    return;
  }
  
  // Check invitation limits before sending
  if (_hasActivePKBattle()) {
    showNotification('无法发起', '你已有一场进行中的PK', 'warning');
    return;
  }
  const pendingInfo = _countMyPendingPKChallenges();
  if (pendingInfo.total >= 3) {
    showNotification('邀请已满', '最多同时向3位同学发出邀请', 'warning');
    return;
  }
  if (pendingInfo.targets[opponent.id] > 0) {
    showNotification('重复邀请', `已向 ${opponent.name} 发出过邀请`, 'warning');
    return;
  }
  
  // Set up pkState for challenge
  pkState.players = [
    { studentId: myStudentId, studentName: myStudent.name, pet: {...myPet} },
    { studentId: opponent.id, studentName: opponent.name, pet: {...opponentPet} }
  ];
  
  closeModal();
  sendPKChallenge();
}

function _getPendingPKChallengeForMe() {
  const isStudentView = typeof currentUser !== 'undefined' && currentUser && currentUser.type === 'student';
  if (!isStudentView) return null;
  
  const myStudentId = parseInt(currentUser.studentId);
  const today = new Date().toDateString();
  
  // Look for pending challenges targeting me
  var _logs = getOpLogs();
  for (let i = _logs.length - 1; i >= 0; i--) {
    const log = _logs[i];
    if (log.actionType !== 'PK挑战') continue;
    if (log.reverted) continue;
    const logDate = new Date(log.timestamp).toDateString();
    if (logDate !== today) continue;
    if (!log.extra || !log.extra.pkChallenge) continue;
    if (log.extra.targetId !== myStudentId) continue;
    if (log.extra.status !== 'pending') continue;
    
    // Check if this challenge was already handled (accepted/declined)
    if (_handledPKChallengeIds.has(log.id)) continue;
    
    // Check if challenge is not too old (within 5 minutes)
    const challengeTime = new Date(log.timestamp).getTime();
    if (Date.now() - challengeTime > 5 * 60 * 1000) continue;
    
    return log;
  }
  return null;
}

function _checkPendingPKChallenge() {
  const challenge = _getPendingPKChallengeForMe();
  if (challenge) {
    _showPKChallengeDialog(challenge);
    return true;
  }
  return false;
}

// Check for pending PK challenges and update the badge on the PK tab
function _updatePKInviteBadge() {
  const isStudentView = typeof currentUser !== 'undefined' && currentUser && currentUser.type === 'student';
  const pkNavItem = document.getElementById('pk-nav-item');
  if (!pkNavItem) return;
  
  if (!isStudentView) {
    // Remove badge for teacher view
    const existingBadge = pkNavItem.querySelector('.pk-invite-badge');
    if (existingBadge) existingBadge.remove();
    return;
  }
  
  const challenge = _getPendingPKChallengeForMe();
  const existingBadge = pkNavItem.querySelector('.pk-invite-badge');
  
  if (challenge) {
    // Show badge if not already shown
    if (!existingBadge) {
      const badge = document.createElement('div');
      badge.className = 'pk-invite-badge';
      badge.innerHTML = '!';
      pkNavItem.appendChild(badge);
    }
  } else {
    // Remove badge if shown
    if (existingBadge) existingBadge.remove();
  }
}

// Handle PK tab click - show pending challenge if exists
function handlePKTabClick() {
  const isStudentView = typeof currentUser !== 'undefined' && currentUser && currentUser.type === 'student';
  
  if (isStudentView) {
    const challenge = _getPendingPKChallengeForMe();
    if (challenge) {
      if (_pkChallengeState._lastShownChallengeId !== challenge.id) {
        _pkChallengeState._lastShownChallengeId = challenge.id;
        _showPKChallengeDialog(challenge);
      }
      return;
    }
  }
  
  // No pending challenge, switch to PK page normally
  switchPage('pk-page');
}

function _showPKChallengeDialog(challenge) {
  const cur = classesData.find(c => c.id === currentClassId);
  if (!cur) return;
  
  const myStudentId = parseInt(currentUser.studentId);
  const myStudent = cur.students.find(s => s.id.toString() === myStudentId.toString());
  const myPet = myStudent ? getActivePet(myStudent) : null;
  
  const challengerName = challenge.extra.challengerName;
  const challengerPet = challenge.extra.challengerPet;
  
  const overlay = document.createElement('div');
  overlay.className = 'pk-challenge-overlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:10000;';
  
  overlay.innerHTML = `
    <div style="background:linear-gradient(135deg,#fff5e6,#ffe4b5);border-radius:20px;padding:30px;max-width:400px;text-align:center;box-shadow:0 10px 40px rgba(0,0,0,0.3);">
      <div style="font-size:48px;margin-bottom:16px;">⚔️</div>
      <h2 style="margin:0 0 8px 0;color:#a06040;">PK挑战！</h2>
      <p style="margin:0 0 20px 0;color:#666;">${esc(challengerName)} 向你发起PK挑战！</p>
      
      <div style="display:flex;justify-content:space-around;margin:20px 0;">
        <div style="text-align:center;">
          <div style="font-size:36px;margin-bottom:8px;">${challengerPet ? getPetImage(challengerPet.name, challengerPet.level) : '🐾'}</div>
          <div style="font-weight:700;">${esc(challengerName)}</div>
          <div style="font-size:12px;color:#888;">${challengerPet ? esc(challengerPet.nickname||challengerPet.name) + ' Lv.' + challengerPet.level : ''}</div>
        </div>
        <div style="font-size:36px;color:#a06040;align-self:center;">VS</div>
        <div style="text-align:center;">
          <div style="font-size:36px;margin-bottom:8px;">${myPet ? getPetImage(myPet.name, myPet.level) : '🐾'}</div>
          <div style="font-weight:700;">${esc(myStudent ? myStudent.name : '你')}</div>
          <div style="font-size:12px;color:#888;">${myPet ? esc(myPet.nickname||myPet.name) + ' Lv.' + myPet.level : ''}</div>
        </div>
      </div>
      
      <div style="display:flex;gap:12px;justify-content:center;margin-top:20px;">
        <button onclick="declinePKChallenge(${challenge.id})" style="padding:12px 24px;background:#ccc;color:#666;border:none;border-radius:20px;font-size:15px;font-weight:700;cursor:pointer;">拒绝</button>
        <button onclick="acceptPKChallenge(${challenge.id})" style="padding:12px 24px;background:linear-gradient(135deg,#ff6b6b,#ee5a24);color:white;border:none;border-radius:20px;font-size:15px;font-weight:700;cursor:pointer;">接受挑战！</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(overlay);
}

function acceptPKChallenge(challengeLogId) {
  // Remove overlay
  const overlay = document.querySelector('.pk-challenge-overlay');
  if (overlay) overlay.remove();
  
  // Prevent duplicate acceptance if already in a battle
  if (pkState.isFighting) {
    showNotification('战斗中', '你正在一场PK战斗中，无法接受新挑战', 'warning');
    return;
  }
  
  // Find the challenge log
  var _logs = getOpLogs();
  const log = _logs.find(l => l.id === challengeLogId);
  if (!log || !log.extra) return;
  
  // Check if already accepted or declined
  if (log.extra.status !== 'pending') {
    showNotification('已处理', '该挑战已被处理', 'info');
    return;
  }
  
  // Mark as accepted locally
  log.extra.status = 'accepted';
  // v34: Mark as unsynced so the status change is written back to Supabase
  log._synced = false;
  saveLogs();
  
  // Track this challenge as handled (prevents infinite loops on log reload)
  _handledPKChallengeIds.add(challengeLogId);
  _saveHandledPKChallengeIds();
  
  // Create a "PK接受" log entry to notify the challenger
  const myStudentId = parseInt(currentUser.studentId);
  const cur = classesData.find(c => c.id === currentClassId);
  const myStudent = cur.students.find(s => s.id.toString() === myStudentId.toString());
  const myPet = myStudent ? getActivePet(myStudent) : null;
  const challengerPet = log.extra.challengerPet;
  
  if (!myPet || !challengerPet) {
    showNotification('PK失败', '宠物状态异常', 'error');
    return;
  }
  
  // Generate battle seed for synchronized combat
  const battleSeed = Math.floor(Math.random() * 2147483647);
  
  // Create accept log entry for sync
  const acceptLog = {
    id: _genLocalId(),
    timestamp: new Date().toISOString(),
    classId: currentClassId,
    studentId: log.extra.challengerId,
    studentName: log.extra.challengerName,
    actionType: 'PK接受',
    details: `${myStudent.name} 接受了 ${log.extra.challengerName} 的PK挑战`,
    coinDelta: 0,
    expDelta: 0,
    petId: null,
    extra: {
      pkAccept: true,
      challengerId: log.extra.challengerId,
      challengerName: log.extra.challengerName,
      targetId: myStudentId,
      targetName: myStudent.name,
      challengerPet: challengerPet,
      targetPet: {...myPet},
      battleSeed: battleSeed
    },
    reverted: false,
    _synced: false
  };
  
  window.operationLogs.push(acceptLog);
  saveLogs();
  
  // Reset shown challenge tracking
  _pkChallengeState._lastShownChallengeId = null;
  
  // Set up PK state
  pkState.players = [
    { studentId: log.extra.challengerId, studentName: log.extra.challengerName, pet: {...challengerPet} },
    { studentId: myStudentId, studentName: myStudent.name, pet: {...myPet} }
  ];
  pkState.battleSeed = battleSeed;
  
  // Switch to PK page and start battle
  switchPage('pk-page');
  setTimeout(() => {
    startPKBattle();
  }, 500);
}

// Check for accepted PK challenges (for the challenger to start battle)
function _checkAcceptedPKChallenge() {
  const isStudentView = typeof currentUser !== 'undefined' && currentUser && currentUser.type === 'student';
  if (!isStudentView) return false;
  
  // Don't start a new battle if one is already in progress
  if (pkState.isFighting) return false;
  
  const myStudentId = parseInt(currentUser.studentId);
  const today = new Date().toDateString();
  
  // Look for accepted challenges where I am the challenger
  var _logs = getOpLogs();
  for (let i = _logs.length - 1; i >= 0; i--) {
    const log = _logs[i];
    if (log.actionType !== 'PK接受') continue;
    if (log.reverted) continue;
    const logDate = new Date(log.timestamp).toDateString();
    if (logDate !== today) continue;
    if (!log.extra || !log.extra.pkAccept) continue;
    if (log.extra.challengerId !== myStudentId) continue;
    
    // Check if this challenge was already handled (battle started)
    if (_handledPKChallengeIds.has(log.id)) continue;
    
    // Check if challenge is recent (within 10 minutes)
    const acceptTime = new Date(log.timestamp).getTime();
    if (Date.now() - acceptTime > 10 * 60 * 1000) continue;
    
    // Check if we haven't already started this battle
    if (log.extra._battleStarted) continue;
    
    // Mark as started to avoid duplicate starts
    log.extra._battleStarted = true;
    // v34: Mark as unsynced so the flag is written back to Supabase
    log._synced = false;
    // Persist the flag by saving logs
    saveLogs();
    
    // Track this challenge as handled (prevents infinite loops on log reload)
    _handledPKChallengeIds.add(log.id);
    _saveHandledPKChallengeIds();
    
    // Start the battle
    const challengerPet = log.extra.challengerPet;
    const targetPet = log.extra.targetPet;
    
    if (!challengerPet || !targetPet) return false;
    
    pkState.players = [
      { studentId: log.extra.challengerId, studentName: log.extra.challengerName, pet: {...challengerPet} },
      { studentId: log.extra.targetId, studentName: log.extra.targetName, pet: {...targetPet} }
    ];
    // Use the same battle seed generated by the accepting student
    pkState.battleSeed = log.extra.battleSeed || Math.floor(Math.random() * 2147483647);
    
    // Show notification and start battle
    showNotification('挑战被接受！', `${log.extra.targetName} 接受了你的挑战！`, 'success');
    // v35: Stop fast polling since we found the acceptance
    _stopPKChallengePolling();
    switchPage('pk-page');
    setTimeout(() => {
      startPKBattle();
    }, 500);
    
    return true;
  }
  return false;
}

function declinePKChallenge(challengeLogId) {
  // Remove overlay
  const overlay = document.querySelector('.pk-challenge-overlay');
  if (overlay) overlay.remove();
  
  // Find the challenge log and mark as declined
  var _logs = getOpLogs();
  const log = _logs.find(l => l.id === challengeLogId);
  if (log && log.extra) {
    log.extra.status = 'declined';
    // v34: Mark as unsynced so the status change is written back to Supabase
    log._synced = false;
    saveLogs();
    // Track this challenge as handled (prevents infinite loops on log reload)
    _handledPKChallengeIds.add(challengeLogId);
    _saveHandledPKChallengeIds();
  }
  
  // Reset shown challenge tracking
  _pkChallengeState._lastShownChallengeId = null;
  
  showNotification('已拒绝挑战', '你拒绝了PK挑战', 'info');
  renderPKPage();
}

function renderJianghuPage() {
  const container = document.getElementById('jhPageContent');
  if(!container) return;
  if(!currentClassId) {
    container.innerHTML = '<div style="text-align:center;padding:40px;">请先在【宠物管理】页面选择一个班级</div>';
    return;
  }
  const cur = classesData.find(c=>c.id===currentClassId);
  if(!cur || cur.students.length === 0) {
    container.innerHTML = '<div style="text-align:center;padding:40px;">班级中暂无学生</div>';
    return;
  }
  const validStudents = cur.students.filter(s => {
    const p = getActivePet(s);
    return p && !p.isDead;
  });
  let html = renderJianghuColumn(cur, validStudents);
  container.innerHTML = html;
}

function selectPKPlayer(studentId) {
  if(pkState.isFighting) return;
  const cur = classesData.find(c=>c.id===currentClassId);
  const student = cur.students.find(s=>s.id.toString()===studentId.toString());
  const pet = getActivePet(student);
  if(!pet || pet.isDead) {
    showNotification('无法选择', '宠物未存活', 'warning');
    return;
  }
  resetDailyPkCountIfNeeded(student);
  const existingIndex = pkState.players.findIndex(p => p.studentId === studentId);
  if(existingIndex !== -1) {
    pkState.players.splice(existingIndex, 1);
  } else {
    pkState.players.push({ studentId, studentName: student.name, pet: {...pet} });
    if(pkState.players.length > 2) {
      pkState.players.shift(); // 移除最早选中的
    }
  }
  renderPKPage();
}

function resetPKSelection() {
  pkState = { players: [], isFighting: false, _battleCompleted: false };
  renderPKPage();
}

// ========== 战斗兽宠系统 ==========
// 三套独立的图片池，严格区分用途：
// 1. _leftMonsterPool  — 无补零数字命名（1.webp~24.webp）→ 宠物PK左侧 + 江湖行宠物变身
// 2. _rightMonsterPool — 补零数字命名（01.webp~024.webp, 010.webp~019.webp）→ 宠物PK右侧
// 3. _jhBossPool       — 中文命名图片 → 萌萌江湖行Boss
let _leftMonsterPool = [];
let _rightMonsterPool = [];
let _jhBossPool = [];
let _pkMonsterProbed = false;
let _jhBossProbed = false;

// 宠物PK对战：探测数字命名图片，分左右两个池
function probePKMonsterImages() {
  return new Promise((resolve) => {
    if(_pkMonsterProbed) { resolve(); return; }
    let pending = 0;
    let resolved = false;
    const finish = () => { if(!resolved) { resolved = true; _pkMonsterProbed = true; resolve(); } };
    const checkDone = () => { pending--; if(pending <= 0) finish(); };
    const seenL = new Set();
    const seenR = new Set();
    function tryLeft(path) {
      pending++;
      const img = new Image();
      img.onload = () => { if(!seenL.has(path)) { seenL.add(path); _leftMonsterPool.push(path); } checkDone(); };
      img.onerror = () => { checkDone(); };
      img.src = path;
    }
    function tryRight(path) {
      pending++;
      const img = new Image();
      img.onload = () => { if(!seenR.has(path)) { seenR.add(path); _rightMonsterPool.push(path); } checkDone(); };
      img.onerror = () => { checkDone(); };
      img.src = path;
    }
    // 左侧池：无补零格式 1.webp ~ 25.webp
    for(let i = 1; i <= 25; i++) {
      tryLeft(`战斗兽宠文件夹/${i}.webp`);
    }
    // 右侧池：所有以0开头的数字图片（01~09, 010~025等）
    for(let i = 1; i <= 9; i++) {
      tryRight(`战斗兽宠文件夹/0${i}.webp`);
    }
    for(let i = 10; i <= 25; i++) {
      const padded3 = String(i).padStart(3, '0');
      tryRight(`战斗兽宠文件夹/${padded3}.webp`);
    }
    setTimeout(finish, 5000);
  });
}

// 萌萌江湖行：探测中文命名图片（天山剑魔.png 等）
function probeJhBossImages() {
  return new Promise((resolve) => {
    if(_jhBossProbed) { resolve(); return; }
    let pending = 0;
    let resolved = false;
    const finish = () => { if(!resolved) { resolved = true; _jhBossProbed = true; resolve(); } };
    const checkDone = () => { pending--; if(pending <= 0) finish(); };
    const seen = new Set();
    function tryPath(path) {
      pending++;
      const img = new Image();
      img.onload = () => { if(!seen.has(path)) { seen.add(path); _jhBossPool.push(path); } checkDone(); };
      img.onerror = () => { checkDone(); };
      img.src = path;
    }
    const jhBossNames = ['天山剑魔','幽冥鬼母','毒手药王','血刀老祖','铁面判官'];
    jhBossNames.forEach(name => tryPath(`战斗兽宠文件夹/${name}.webp`));
    setTimeout(finish, 5000);
  });
}

// 兼容旧调用：probeMonsterImages 同时探测两套
function probeMonsterImages() {
  return Promise.all([probePKMonsterImages(), probeJhBossImages()]);
}

// 宠物PK对战：左侧从 _leftMonsterPool 取图（数字.png）
function getLeftMonsterImg() {
  if(_leftMonsterPool.length > 0) {
    const idx = _pkBattleLeftMonsterIdx >= 0 ? _pkBattleLeftMonsterIdx : Math.floor(Math.random() * _leftMonsterPool.length);
    return _leftMonsterPool[idx];
  }
  return null;
}
// 宠物PK对战：右侧从 _rightMonsterPool 取图（0数字.png）
function getRightMonsterImg() {
  if(_rightMonsterPool.length > 0) {
    const idx = _pkBattleRightMonsterIdx >= 0 ? _pkBattleRightMonsterIdx : Math.floor(Math.random() * _rightMonsterPool.length);
    return _rightMonsterPool[idx];
  }
  return null;
}
// 萌萌江湖行：宠物变身从 _leftMonsterPool 取图（数字.png）
function getJhPetMonsterImg() {
  if(_leftMonsterPool.length > 0) {
    return _leftMonsterPool[Math.floor(Math.random() * _leftMonsterPool.length)];
  }
  return null;
}

// 萌萌江湖行：随机从中文命名池取图
function getJhBossMonsterImg() {
  if(_jhBossPool.length > 0) {
    return _jhBossPool[Math.floor(Math.random() * _jhBossPool.length)];
  }
  return null;
}

// 延迟到对应页面打开时再探测
// probePKMonsterImages() 将在 switchPage('pk-page') 时按需调用
// probeJhBossImages() 将在进入江湖行时按需调用

// 音效系统
function playTransformSound() {
  initAudio();
  // 低沉的震动 + 升调爆发
  const now = audioCtx.currentTime;
  // 低频震动
  const bass = audioCtx.createOscillator();
  const bassGain = audioCtx.createGain();
  bass.connect(bassGain); bassGain.connect(masterSfxGain);
  bass.type = 'sawtooth'; bass.frequency.value = 60;
  bass.frequency.linearRampToValueAtTime(200, now + 0.8);
  bassGain.gain.setValueAtTime(0.3, now);
  bassGain.gain.linearRampToValueAtTime(0.5, now + 0.5);
  bassGain.gain.exponentialRampToValueAtTime(0.01, now + 1.0);
  bass.start(now); bass.stop(now + 1.0);
  // 高频爆发
  const burst = audioCtx.createOscillator();
  const burstGain = audioCtx.createGain();
  burst.connect(burstGain); burstGain.connect(masterSfxGain);
  burst.type = 'square'; burst.frequency.value = 800;
  burst.frequency.linearRampToValueAtTime(2000, now + 0.3);
  burstGain.gain.setValueAtTime(0, now + 0.6);
  burstGain.gain.linearRampToValueAtTime(0.4, now + 0.7);
  burstGain.gain.exponentialRampToValueAtTime(0.01, now + 1.0);
  burst.start(now + 0.6); burst.stop(now + 1.0);
}

function playExplosionSound() {
  initAudio();
  const now = audioCtx.currentTime;
  // 噪音爆炸
  const bufferSize = audioCtx.sampleRate * 0.5;
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for(let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.1));
  const noise = audioCtx.createBufferSource();
  noise.buffer = buffer;
  const noiseGain = audioCtx.createGain();
  const noiseFilter = audioCtx.createBiquadFilter();
  noiseFilter.type = 'lowpass'; noiseFilter.frequency.value = 1000;
  noise.connect(noiseFilter); noiseFilter.connect(noiseGain); noiseGain.connect(masterSfxGain);
  noiseGain.gain.setValueAtTime(0.6, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
  noise.start(now);
  // 低频冲击
  const impact = audioCtx.createOscillator();
  const impactGain = audioCtx.createGain();
  impact.connect(impactGain); impactGain.connect(masterSfxGain);
  impact.type = 'sine'; impact.frequency.value = 150;
  impact.frequency.exponentialRampToValueAtTime(30, now + 0.3);
  impactGain.gain.setValueAtTime(0.5, now);
  impactGain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
  impact.start(now); impact.stop(now + 0.3);
}

function playFireballSound() {
  initAudio();
  const now = audioCtx.currentTime;
  // 风声 + 火焰
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain); gain.connect(masterSfxGain);
  osc.type = 'sawtooth'; osc.frequency.value = 300;
  osc.frequency.linearRampToValueAtTime(1500, now + 0.15);
  osc.frequency.linearRampToValueAtTime(200, now + 0.3);
  gain.gain.setValueAtTime(0.25, now);
  gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
  osc.start(now); osc.stop(now + 0.3);
}

function playCriticalSound() {
  initAudio();
  const now = audioCtx.currentTime;
  // 多层音效 - 金属碰撞 + 爆炸
  [1200, 1800, 2400].forEach((f, i) => {
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.connect(g); g.connect(masterSfxGain);
    o.type = 'square'; o.frequency.value = f;
    o.frequency.exponentialRampToValueAtTime(f * 0.3, now + 0.2);
    g.gain.setValueAtTime(0.2, now + i * 0.05);
    g.gain.exponentialRampToValueAtTime(0.01, now + 0.3 + i * 0.05);
    o.start(now + i * 0.05); o.stop(now + 0.3 + i * 0.05);
  });
  // 重低音
  const bass = audioCtx.createOscillator();
  const bassG = audioCtx.createGain();
  bass.connect(bassG); bassG.connect(masterSfxGain);
  bass.type = 'sine'; bass.frequency.value = 80;
  bassG.gain.setValueAtTime(0.4, now);
  bassG.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
  bass.start(now); bass.stop(now + 0.4);
}

function playHitSound() {
  initAudio();
  const now = audioCtx.currentTime;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.connect(g); g.connect(masterSfxGain);
  o.type = 'triangle'; o.frequency.value = 400;
  o.frequency.exponentialRampToValueAtTime(100, now + 0.15);
  g.gain.setValueAtTime(0.3, now);
  g.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
  o.start(now); o.stop(now + 0.15);
}

// ====== 技能池系统 ======
const PK_SKILLS = [
  {name:'烈焰风暴',icon:'🔥',color:'#ff4400',type:'fire',desc:'召唤灼热火焰吞噬对手'},
  {name:'冰霜新星',icon:'❄️',color:'#66ccff',type:'ice',desc:'极寒冰晶冻结一切'},
  {name:'雷神之怒',icon:'⚡',color:'#ffdd00',type:'thunder',desc:'天降雷霆万钧之力'},
  {name:'剧毒吐息',icon:'☠️',color:'#66ff33',type:'poison',desc:'致命毒雾侵蚀敌人'},
  {name:'暴风旋涡',icon:'🌪️',color:'#88ccff',type:'wind',desc:'狂暴旋风席卷战场'},
  {name:'暗影侵蚀',icon:'🌑',color:'#aa44ff',type:'shadow',desc:'黑暗力量吞噬灵魂'},
  {name:'陨石坠落',icon:'☄️',color:'#ff6633',type:'meteor',desc:'天外陨石毁灭降临'},
  {name:'圣光审判',icon:'✨',color:'#ffee77',type:'holy',desc:'神圣光芒净化邪恶'},
  {name:'岩浆喷发',icon:'🌋',color:'#ff5500',type:'lava',desc:'地底岩浆冲天而起'},
  {name:'星爆冲击',icon:'💫',color:'#ffcc00',type:'starburst',desc:'星光汇聚爆裂冲击'},
  {name:'龙息吐焰',icon:'🐲',color:'#ff3300',type:'dragonfire',desc:'巨龙怒吼烈焰焚天'},
  {name:'冰封裂地',icon:'🧊',color:'#aaddff',type:'iceground',desc:'冰柱破地冻裂苍穹'},
];
function getRandomSkill(){ return PK_SKILLS[Math.floor(_pkRng()*PK_SKILLS.length)]; }

function showSkillAnnounce(arena, skill, attackerName){
  // 不再显示技能名称
}

// 技能特效背景
let _bgThemeTimeout = null;
function applySkillThemeBackground(arena, skillType) {
  if(!arena) return;
  // 清除之前的定时器
  if(_bgThemeTimeout) { clearTimeout(_bgThemeTimeout); _bgThemeTimeout = null; }
  // 移除旧主题
  const themeClasses = ['fire-bg','ice-bg','thunder-bg','poison-bg','wind-bg','shadow-bg','meteor-bg','holy-bg','lava-bg','starburst-bg','dragonfire-bg','iceground-bg'];
  themeClasses.forEach(cls => arena.classList.remove(cls));
  // 添加竞技场主题类
  arena.classList.add('arena-themed-bg');
  // 添加新主题
  const bgClass = skillType + '-bg';
  arena.classList.add(bgClass);
  // 生成主题粒子
  spawnThemeParticles(arena, skillType);
  // 3秒后恢复默认背景
  _bgThemeTimeout = setTimeout(() => {
    themeClasses.forEach(cls => arena.classList.remove(cls));
  }, 3000);
}

function spawnThemeParticles(arena, skillType) {
  // 获取或创建粒子容器
  let particlesDiv = arena.querySelector('.pk-arena-particles');
  if(!particlesDiv) {
    particlesDiv = document.createElement('div');
    particlesDiv.className = 'pk-arena-particles';
    arena.appendChild(particlesDiv);
  }
  // 清空旧粒子
  particlesDiv.innerHTML = '';
  // 根据技能类型生成不同粒子
  const particleCount = 15;
  if(skillType === 'fire' || skillType === 'dragonfire') {
    // 火焰余烬
    for(let i = 0; i < particleCount; i++) {
      const ember = document.createElement('div');
      const size = 3 + Math.random() * 6;
      const colors = ['#ff6600','#ff9933','#ffcc00','#ff3300'];
      const color = colors[Math.floor(Math.random() * colors.length)];
      ember.style.cssText = `position:absolute;width:${size}px;height:${size}px;background:${color};border-radius:50%;left:${Math.random()*100}%;bottom:0;box-shadow:0 0 ${size*2}px ${color};animation:emberFloat ${3+Math.random()*4}s ease-in-out infinite;animation-delay:${Math.random()*2}s;opacity:0;`;
      particlesDiv.appendChild(ember);
      setTimeout(() => { ember.style.opacity = '0.8'; }, 100);
    }
  } else if(skillType === 'ice' || skillType === 'iceground') {
    // 冰晶
    for(let i = 0; i < particleCount; i++) {
      const crystal = document.createElement('div');
      const size = 8 + Math.random() * 15;
      const colors = ['#aaddff','#66ccff','#ffffff','#88eeff'];
      const color = colors[Math.floor(Math.random() * colors.length)];
      crystal.style.cssText = `position:absolute;width:${size}px;height:${size*1.5}px;background:${color};clip-path:polygon(50% 0%,100% 50%,50% 100%,0% 50%);left:${Math.random()*100}%;bottom:0;box-shadow:0 0 ${size}px ${color};animation:iceCrystalFloat ${4+Math.random()*3}s ease-in-out infinite;animation-delay:${Math.random()*2}s;opacity:0;`;
      particlesDiv.appendChild(crystal);
      setTimeout(() => { crystal.style.opacity = '0.9'; }, 100);
    }
  } else if(skillType === 'thunder') {
    // 雷电火花
    for(let i = 0; i < 20; i++) {
      const spark = document.createElement('div');
      const size = 4 + Math.random() * 8;
      spark.style.cssText = `position:absolute;width:${size}px;height:${size}px;background:#ffff88;border-radius:50%;left:${Math.random()*100}%;top:${Math.random()*100}%;box-shadow:0 0 ${size*3}px #ffff00,0 0 ${size*5}px #ffaa00;--lx:${(Math.random()-0.5)*100}px;--ly:${(Math.random()-0.5)*100}px;animation:lightningSpark ${0.5+Math.random()*0.5}s ease-out infinite;animation-delay:${Math.random()*1}s;opacity:0;`;
      particlesDiv.appendChild(spark);
    }
  } else if(skillType === 'poison') {
    // 毒雾泡泡
    for(let i = 0; i < particleCount; i++) {
      const bubble = document.createElement('div');
      const size = 10 + Math.random() * 20;
      const colors = ['#66ff33','#99ff66','#33cc00'];
      const color = colors[Math.floor(Math.random() * colors.length)];
      bubble.style.cssText = `position:absolute;width:${size}px;height:${size}px;background:radial-gradient(circle,${color},transparent);border-radius:50%;left:${Math.random()*100}%;bottom:0;box-shadow:0 0 ${size}px ${color};animation:poisonBubble ${3+Math.random()*4}s ease-out infinite;animation-delay:${Math.random()*2}s;opacity:0;`;
      particlesDiv.appendChild(bubble);
    }
  } else if(skillType === 'wind') {
    // 风之树叶
    for(let i = 0; i < 12; i++) {
      const leaf = document.createElement('div');
      const size = 12 + Math.random() * 18;
      const colors = ['#88ccff','#aaddff','#66bbee'];
      const color = colors[Math.floor(Math.random() * colors.length)];
      leaf.style.cssText = `position:absolute;width:${size}px;height:${size*0.6}px;background:${color};border-radius:50% 0 50% 0;left:${Math.random()*100}%;top:${Math.random()*100}%;box-shadow:0 0 ${size/2}px ${color};--wx:${200+Math.random()*300}px;--wy:${-50+Math.random()*100}px;animation:windLeaf ${2+Math.random()*2}s ease-out infinite;animation-delay:${Math.random()*2}s;opacity:0;`;
      particlesDiv.appendChild(leaf);
    }
  } else if(skillType === 'shadow') {
    // 暗影游魂
    for(let i = 0; i < 10; i++) {
      const wisp = document.createElement('div');
      const size = 20 + Math.random() * 30;
      wisp.style.cssText = `position:absolute;width:${size}px;height:${size}px;background:radial-gradient(circle,rgba(150,50,255,0.8),transparent);border-radius:50%;left:${Math.random()*100}%;top:${Math.random()*100}%;box-shadow:0 0 ${size}px rgba(150,50,255,0.6);--sx:${(Math.random()-0.5)*200}px;--sy:${(Math.random()-0.5)*200}px;animation:shadowWisp ${3+Math.random()*3}s ease-out infinite;animation-delay:${Math.random()*2}s;`;
      particlesDiv.appendChild(wisp);
    }
  } else if(skillType === 'meteor') {
    // 陨石轨迹
    for(let i = 0; i < 8; i++) {
      const trail = document.createElement('div');
      const size = 6 + Math.random() * 10;
      trail.style.cssText = `position:absolute;width:${size*3}px;height:${size}px;background:linear-gradient(90deg,transparent,#ff6600,#ffcc00);border-radius:50%;left:${Math.random()*50}%;top:${Math.random()*50}%;box-shadow:0 0 ${size*2}px #ff6600;--mx:${200+Math.random()*200}px;--my:${100+Math.random()*200}px;animation:meteorTrail ${1.5+Math.random()*1.5}s ease-out infinite;animation-delay:${Math.random()*2}s;opacity:0;`;
      particlesDiv.appendChild(trail);
    }
  } else if(skillType === 'holy') {
    // 圣光光球
    for(let i = 0; i < 15; i++) {
      const glow = document.createElement('div');
      const size = 8 + Math.random() * 16;
      glow.style.cssText = `position:absolute;width:${size}px;height:${size}px;background:radial-gradient(circle,#ffffff,#ffee77,transparent);border-radius:50%;left:${Math.random()*100}%;bottom:0;box-shadow:0 0 ${size*2}px #ffee77;animation:holyGlow ${3+Math.random()*3}s ease-out infinite;animation-delay:${Math.random()*2}s;`;
      particlesDiv.appendChild(glow);
    }
  } else if(skillType === 'lava') {
    // 岩浆气泡
    for(let i = 0; i < 18; i++) {
      const bubble = document.createElement('div');
      const size = 10 + Math.random() * 20;
      const colors = ['#ff3300','#ff6600','#ff0000'];
      const color = colors[Math.floor(Math.random() * colors.length)];
      bubble.style.cssText = `position:absolute;width:${size}px;height:${size}px;background:radial-gradient(circle,${color},#660000);border-radius:50%;left:${Math.random()*100}%;bottom:0;box-shadow:0 0 ${size}px ${color};animation:lavaBubble ${2.5+Math.random()*2.5}s ease-out infinite;animation-delay:${Math.random()*2}s;opacity:0;`;
      particlesDiv.appendChild(bubble);
    }
  } else if(skillType === 'starburst') {
    // 星光闪烁
    for(let i = 0; i < 20; i++) {
      const star = document.createElement('div');
      const size = 6 + Math.random() * 12;
      const colors = ['#ffcc00','#ffee77','#ffffff'];
      const color = colors[Math.floor(Math.random() * colors.length)];
      star.style.cssText = `position:absolute;width:${size}px;height:${size}px;background:${color};clip-path:polygon(50% 0%,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%);left:${Math.random()*100}%;top:${Math.random()*100}%;box-shadow:0 0 ${size}px ${color};animation:starTwinkle ${1.5+Math.random()*2}s ease-in-out infinite;animation-delay:${Math.random()*2}s;`;
      particlesDiv.appendChild(star);
    }
  }
}

// 技能音效
function playSkillSound(type){
  initAudio(); const now=audioCtx.currentTime;
  if(type==='ice'){const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.connect(g);g.connect(masterSfxGain);o.type='sine';o.frequency.value=2000;o.frequency.linearRampToValueAtTime(500,now+0.3);g.gain.setValueAtTime(0.2,now);g.gain.exponentialRampToValueAtTime(0.01,now+0.4);o.start(now);o.stop(now+0.4);}
  else if(type==='thunder'){const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.connect(g);g.connect(masterSfxGain);o.type='square';o.frequency.value=120;o.frequency.linearRampToValueAtTime(40,now+0.5);g.gain.setValueAtTime(0.5,now);g.gain.exponentialRampToValueAtTime(0.01,now+0.5);o.start(now);o.stop(now+0.5);const b=audioCtx.createBufferSource(),buf=audioCtx.createBuffer(1,audioCtx.sampleRate*0.3,audioCtx.sampleRate),d=buf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*Math.exp(-i/(d.length*0.05));b.buffer=buf;const bg=audioCtx.createGain();b.connect(bg);bg.connect(masterSfxGain);bg.gain.setValueAtTime(0.4,now);bg.gain.exponentialRampToValueAtTime(0.01,now+0.3);b.start(now);}
  else if(type==='poison'){const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.connect(g);g.connect(masterSfxGain);o.type='sawtooth';o.frequency.value=150;o.frequency.linearRampToValueAtTime(80,now+0.6);g.gain.setValueAtTime(0.15,now);g.gain.exponentialRampToValueAtTime(0.01,now+0.6);o.start(now);o.stop(now+0.6);}
  else if(type==='wind'){const o=audioCtx.createOscillator(),g=audioCtx.createGain(),f=audioCtx.createBiquadFilter();o.connect(f);f.connect(g);g.connect(masterSfxGain);o.type='sawtooth';f.type='bandpass';f.frequency.value=800;f.Q.value=2;o.frequency.value=300;o.frequency.linearRampToValueAtTime(1200,now+0.2);o.frequency.linearRampToValueAtTime(300,now+0.5);g.gain.setValueAtTime(0.2,now);g.gain.exponentialRampToValueAtTime(0.01,now+0.5);o.start(now);o.stop(now+0.5);}
  else if(type==='shadow'){const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.connect(g);g.connect(masterSfxGain);o.type='sine';o.frequency.value=80;o.frequency.linearRampToValueAtTime(30,now+0.6);g.gain.setValueAtTime(0.35,now);g.gain.exponentialRampToValueAtTime(0.01,now+0.6);o.start(now);o.stop(now+0.6);}
  else if(type==='holy'){[523,659,784].forEach((f,i)=>{const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.connect(g);g.connect(masterSfxGain);o.type='sine';o.frequency.value=f;g.gain.setValueAtTime(0.15,now+i*0.1);g.gain.exponentialRampToValueAtTime(0.01,now+i*0.1+0.5);o.start(now+i*0.1);o.stop(now+i*0.1+0.5);});}
  else{ playFireballSound(); }
}

// 技能特效调度器
function playSkillAttack(fromContainer, toContainer, isCritical, skill, callback){
  if(!fromContainer||!toContainer){if(callback) callback();return;}
  const type=skill.type;
  // 应用技能主题背景
  const arena = fromContainer.closest('.pk-arena') || document.getElementById('pk-arena') || document.getElementById('classpk-robot-arena');
  applySkillThemeBackground(arena, type);
  if(type==='ice') playIceAttack(fromContainer,toContainer,isCritical,callback);
  else if(type==='thunder') playThunderAttack(fromContainer,toContainer,isCritical,callback);
  else if(type==='poison') playPoisonAttack(fromContainer,toContainer,isCritical,callback);
  else if(type==='wind') playWindAttack(fromContainer,toContainer,isCritical,callback);
  else if(type==='shadow') playShadowAttack(fromContainer,toContainer,isCritical,callback);
  else if(type==='meteor') playMeteorAttack(fromContainer,toContainer,isCritical,callback);
  else if(type==='holy') playHolyAttack(fromContainer,toContainer,isCritical,callback);
  else if(type==='lava') playLavaAttack(fromContainer,toContainer,isCritical,callback);
  else if(type==='starburst') playStarburstAttack(fromContainer,toContainer,isCritical,callback);
  else if(type==='dragonfire') playDragonfireAttack(fromContainer,toContainer,isCritical,callback);
  else if(type==='iceground') playIceGroundAttack(fromContainer,toContainer,isCritical,callback);
  else playFireballAttack(fromContainer,toContainer,isCritical,callback);
}

// ==== 冰霜新星 ====
function playIceAttack(from,to,crit,cb){
  const fR=from.getBoundingClientRect(),tR=to.getBoundingClientRect();
  const sx=fR.left+fR.width/2-30,sy=fR.top+fR.height/2-30;
  const ex=tR.left+tR.width/2-30,ey=tR.top+tR.height/2-30;
  const proj=document.createElement('div');
  proj.className='skill-projectile';
  proj.style.cssText=`width:70px;height:70px;border-radius:12px;transform:rotate(45deg);background:radial-gradient(circle,#fff,#aaeeff,#55bbee,#2288cc);box-shadow:0 0 30px 12px rgba(100,200,255,0.9),0 0 60px 20px rgba(50,150,255,0.5),0 0 100px 30px rgba(100,200,255,0.3);left:${sx}px;top:${sy}px;`;
  document.body.appendChild(proj);
  playSkillSound('ice');
  // Snowstorm trail
  const dur=crit?350:260,st=performance.now();
  let tc=0;
  function anim(t){const el=t-st,p=Math.min(1,el/dur),e=p<0.5?2*p*p:1-Math.pow(-2*p+2,2)/2;
    const cx=sx+(ex-sx)*e,cy=sy+(ey-sy)*e-Math.sin(p*Math.PI)*35;
    proj.style.left=cx+'px';proj.style.top=cy+'px';
    tc++;if(tc%2===0){
      for(let k=0;k<3;k++){
        const tr=document.createElement('div');
        const offX=(Math.random()-0.5)*40,offY=(Math.random()-0.5)*40;
        tr.style.cssText=`position:fixed;pointer-events:none;z-index:10001;width:${8+Math.random()*12}px;height:${8+Math.random()*12}px;border-radius:50%;background:rgba(200,240,255,${0.5+Math.random()*0.4});box-shadow:0 0 12px rgba(100,200,255,0.7);left:${cx+25+offX}px;top:${cy+25+offY}px;animation:fireballTrail 0.7s ease-out forwards;`;
        document.body.appendChild(tr);setTimeout(()=>tr.remove(),700);
      }
    }
    if(p<1)requestAnimationFrame(anim);
    else{proj.remove();
      // Screen shake
      const arena=document.getElementById('pk-arena');if(arena){arena.classList.add('screen-shake-heavy');setTimeout(()=>arena.classList.remove('screen-shake-heavy'),500);}
      // Flash
      const flash=document.createElement('div');flash.className='screen-flash';flash.style.background='rgba(150,220,255,0.6)';document.body.appendChild(flash);setTimeout(()=>flash.remove(),300);
      to.classList.add('ice-freeze');createIceShatter(to,crit);playSkillSound('ice');
      // Ice block encase
      const iceBlock=document.createElement('div');iceBlock.className='ice-block-encase';to.style.position='relative';to.appendChild(iceBlock);setTimeout(()=>iceBlock.remove(),1300);
      if(crit){playCriticalSound();}else{playHitSound();}
      setTimeout(()=>{to.classList.remove('ice-freeze');},1400);if(cb)setTimeout(cb,300);}
  }requestAnimationFrame(anim);
}
function createIceShatter(container,crit){
  const n=crit?36:20;const colors=['#aaddff','#66ccff','#ffffff','#88eeff','#4499dd','#ccf0ff'];
  for(let i=0;i<n;i++){const s=document.createElement('div');s.className='ice-shard';
    const angle=(Math.PI*2/n)*i+Math.random()*0.5;const dist=60+Math.random()*(crit?130:80);
    s.style.setProperty('--ex',Math.cos(angle)*dist+'px');s.style.setProperty('--ey',Math.sin(angle)*dist+'px');
    s.style.setProperty('--rot',(Math.random()*540)+'deg');
    const sz=10+Math.random()*(crit?22:14);s.style.width=sz+'px';s.style.height=sz*1.8+'px';
    s.style.backgroundColor=colors[Math.floor(Math.random()*colors.length)];
    s.style.boxShadow=`0 0 12px ${s.style.backgroundColor},0 0 20px rgba(100,200,255,0.4)`;
    s.style.left='50%';s.style.top='50%';container.style.position='relative';container.appendChild(s);
    setTimeout(()=>s.remove(),1100);
  }
  // Double rings
  for(let r=0;r<2;r++){
    const ring=document.createElement('div');ring.className='energy-ring';ring.style.borderColor='rgba(100,200,255,0.9)';
    const sz=crit?160+r*40:100+r*30;ring.style.width=sz+'px';ring.style.height=sz+'px';ring.style.margin=`-${sz/2}px 0 0 -${sz/2}px`;
    ring.style.animationDelay=r*0.15+'s';
    container.appendChild(ring);setTimeout(()=>ring.remove(),900);
  }
}

// ==== 雷神之怒 ====
function playThunderAttack(from,to,crit,cb){
  const tR=to.getBoundingClientRect();
  const cx=tR.left+tR.width/2,cy=tR.top;
  playSkillSound('thunder');
  const arena=document.getElementById('pk-arena');
  // Full white screen flash
  const flash=document.createElement('div');flash.className='screen-flash';flash.style.background='rgba(255,255,255,0.95)';
  document.body.appendChild(flash);setTimeout(()=>flash.remove(),400);
  // Second flash wave
  setTimeout(()=>{const f2=document.createElement('div');f2.className='screen-flash';f2.style.background='rgba(200,230,255,0.7)';document.body.appendChild(f2);setTimeout(()=>f2.remove(),300);},150);
  // Multiple thick lightning bolts
  const boltCount=crit?8:5;
  for(let i=0;i<boltCount;i++){
    setTimeout(()=>{
      const bolt=document.createElement('div');bolt.className='lightning-bolt';
      const offsetX=(Math.random()-0.5)*100;
      bolt.style.left=(cx+offsetX)+'px';bolt.style.top='0px';bolt.style.height=(cy+tR.height/2)+'px';
      bolt.style.transform=`rotate(${(Math.random()-0.5)*12}deg)`;
      bolt.style.width=(6+Math.random()*6)+'px';
      document.body.appendChild(bolt);setTimeout(()=>bolt.remove(),500);
    },i*60);
  }
  // Electric orbs
  setTimeout(()=>{
    for(let i=0;i<(crit?6:3);i++){
      const orb=document.createElement('div');orb.className='electric-orb';
      const sz=15+Math.random()*20;orb.style.width=sz+'px';orb.style.height=sz+'px';
      orb.style.left=(20+Math.random()*60)+'%';orb.style.top=(20+Math.random()*60)+'%';
      to.style.position='relative';to.appendChild(orb);setTimeout(()=>orb.remove(),700);
    }
  },boltCount*60);
  setTimeout(()=>{
    if(arena){arena.classList.add('thunder-shake');setTimeout(()=>arena.classList.remove('thunder-shake'),800);}
    createHitExplosion(to,crit);
    const colors=crit?['#ffffff','#88ddff','#4488ff','#ffdd00','#aaeeff']:['#88ddff','#ffffff','#aaccff','#66bbff'];
    const expDiv=document.createElement('div');expDiv.className='explosion-container';to.style.position='relative';to.appendChild(expDiv);
    for(let i=0;i<(crit?30:18);i++){const p=document.createElement('div');p.className='explosion-particle';
      const a=(Math.PI*2/18)*i;const d=40+Math.random()*70;p.style.setProperty('--ex',Math.cos(a)*d+'px');p.style.setProperty('--ey',Math.sin(a)*d+'px');
      p.style.width=(4+Math.random()*8)+'px';p.style.height='3px';p.style.backgroundColor=colors[Math.floor(Math.random()*colors.length)];
      p.style.boxShadow=`0 0 12px ${p.style.backgroundColor}`;p.style.borderRadius='2px';expDiv.appendChild(p);}
    setTimeout(()=>expDiv.remove(),900);
    // Electric arcs dancing around pet AFTER hit
    for(let i=0;i<(crit?8:5);i++){
      const arc=document.createElement('div');arc.className='electric-arc';
      arc.style.setProperty('--arc-angle',(Math.random()*360)+'deg');
      arc.style.left=(15+Math.random()*70)+'%';arc.style.top=(15+Math.random()*70)+'%';
      arc.style.height=(12+Math.random()*18)+'px';
      to.appendChild(arc);setTimeout(()=>arc.remove(),800);
    }
    if(crit)playCriticalSound();else playHitSound();
    if(cb)setTimeout(cb,350);
  },boltCount*60+80);
}

// ==== 剧毒吐息 ====
function playPoisonAttack(from,to,crit,cb){
  const fR=from.getBoundingClientRect(),tR=to.getBoundingClientRect();
  const sx=fR.left+fR.width/2,sy=fR.top+fR.height/2;
  const ex=tR.left+tR.width/2,ey=tR.top+tR.height/2;
  playSkillSound('poison');
  // Green screen tint
  const tint=document.createElement('div');tint.className='screen-tint';tint.style.background='rgba(50,200,0,0.3)';document.body.appendChild(tint);setTimeout(()=>tint.remove(),1200);
  // Giant toxic tsunami wave
  const count=crit?14:9;
  for(let i=0;i<count;i++){
    setTimeout(()=>{
      const p=document.createElement('div');p.className='skill-projectile';
      const sz=14+Math.random()*20;
      p.style.cssText=`width:${sz}px;height:${sz}px;border-radius:50%;background:radial-gradient(circle,#eeff33,#ccff33,#66cc00,#338800);box-shadow:0 0 18px rgba(100,255,0,0.9),0 0 35px rgba(50,200,0,0.5);left:${sx}px;top:${sy}px;opacity:0.95;`;
      document.body.appendChild(p);
      const dur=220+Math.random()*150,st2=performance.now();
      const offX=(Math.random()-0.5)*60,offY=(Math.random()-0.5)*60;
      function anim(t){const el=t-st2,pr=Math.min(1,el/dur);
        p.style.left=(sx+(ex+offX-sx)*pr)+'px';p.style.top=(sy+(ey+offY-sy)*pr-Math.sin(pr*Math.PI)*20)+'px';
        if(pr<1)requestAnimationFrame(anim);else p.remove();
      }requestAnimationFrame(anim);
    },i*45);
  }
  setTimeout(()=>{
    // Screen shake
    const arena=document.getElementById('pk-arena');if(arena){arena.classList.add('screen-shake-heavy');setTimeout(()=>arena.classList.remove('screen-shake-heavy'),500);}
    to.classList.add('poison-hit');
    // Massive poison clouds
    for(let i=0;i<(crit?8:5);i++){
      const c=document.createElement('div');c.className='poison-cloud';
      const sz=80+Math.random()*60;c.style.width=sz+'px';c.style.height=sz+'px';
      c.style.left=(10+Math.random()*80)+'%';c.style.top=(10+Math.random()*80)+'%';
      to.style.position='relative';to.appendChild(c);setTimeout(()=>c.remove(),2000);
    }
    // Poison bubbles rising everywhere
    for(let i=0;i<(crit?12:7);i++){
      setTimeout(()=>{
        const b=document.createElement('div');b.className='poison-bubble';
        const sz=6+Math.random()*12;b.style.width=sz+'px';b.style.height=sz+'px';
        b.style.left=(Math.random()*100)+'%';b.style.bottom='0';
        to.appendChild(b);setTimeout(()=>b.remove(),1800);
      },Math.random()*500);
    }
    // Toxic skulls floating up
    for(let i=0;i<(crit?4:2);i++){
      setTimeout(()=>{
        const skull=document.createElement('div');skull.className='poison-skull';skull.textContent='☠';
        skull.style.left=(20+Math.random()*60)+'%';skull.style.top=(40+Math.random()*30)+'%';
        to.appendChild(skull);setTimeout(()=>skull.remove(),1500);
      },i*200);
    }
    if(crit)playCriticalSound();else playHitSound();
    setTimeout(()=>to.classList.remove('poison-hit'),1500);
    if(cb)setTimeout(cb,350);
  },count*45+240);
}

// ==== 暴风旋涡 ====
function playWindAttack(from,to,crit,cb){
  playSkillSound('wind');
  const tR=to.getBoundingClientRect();
  const arena=document.getElementById('pk-arena');
  // Screen shake
  if(arena){arena.classList.add('screen-shake-heavy');setTimeout(()=>arena.classList.remove('screen-shake-heavy'),600);}
  // Full tornado covering the pet - many rings
  const ringCount=crit?10:7;
  for(let i=0;i<ringCount;i++){
    setTimeout(()=>{
      const r=document.createElement('div');r.className='tornado-ring';
      const sz=30+i*18;r.style.width=sz+'px';r.style.height=sz*0.4+'px';
      r.style.left='50%';r.style.bottom=(5+i*10)+'%';r.style.marginLeft=(-sz/2)+'px';
      r.style.borderWidth='4px';
      to.style.position='relative';to.appendChild(r);setTimeout(()=>r.remove(),1100);
    },i*70);
  }
  // Massive horizontal wind lines across entire screen
  for(let i=0;i<(crit?10:6);i++){
    setTimeout(()=>{
      const wl=document.createElement('div');wl.className='wind-line';
      wl.style.top=(10+Math.random()*80)+'%';wl.style.left='0';wl.style.width=(60+Math.random()*40)+'%';
      document.body.appendChild(wl);setTimeout(()=>wl.remove(),600);
    },i*60);
  }
  // Debris flying everywhere
  for(let i=0;i<(crit?20:12);i++){
    setTimeout(()=>{
      const d=document.createElement('div');d.className='wind-debris';
      const sz=3+Math.random()*6;d.style.width=sz+'px';d.style.height=sz*0.6+'px';
      d.style.setProperty('--dx',(Math.random()>0.5?1:-1)*(60+Math.random()*80)+'px');
      d.style.setProperty('--dy',(-30+Math.random()*60)+'px');
      d.style.left=(Math.random()*100)+'%';d.style.top=(Math.random()*100)+'%';
      to.style.position='relative';to.appendChild(d);setTimeout(()=>d.remove(),1000);
    },Math.random()*500);
  }
  // Wind particles
  for(let i=0;i<(crit?25:15);i++){
    setTimeout(()=>{
      const p=document.createElement('div');
      p.style.cssText=`position:absolute;pointer-events:none;z-index:100;width:${4+Math.random()*7}px;height:${4+Math.random()*7}px;border-radius:50%;background:rgba(180,220,255,${0.6+Math.random()*0.4});box-shadow:0 0 10px rgba(150,200,255,0.7);left:${Math.random()*100}%;top:${Math.random()*100}%;animation:tornadoSpin ${0.4+Math.random()*0.6}s ease-out forwards;`;
      to.style.position='relative';to.appendChild(p);setTimeout(()=>p.remove(),1000);
    },Math.random()*500);
  }
  setTimeout(()=>{
    to.classList.add('wind-hit');if(crit)playCriticalSound();else playHitSound();
    setTimeout(()=>to.classList.remove('wind-hit'),1000);
    if(cb)setTimeout(cb,350);
  },400);
}

// ==== 暗影侵蚀 ====
function playShadowAttack(from,to,crit,cb){
  playSkillSound('shadow');
  const arena=document.getElementById('pk-arena');
  // Screen dims dramatically
  const tint=document.createElement('div');tint.className='screen-tint';tint.style.background='rgba(0,0,0,0.6)';tint.style.animationDuration='1.5s';document.body.appendChild(tint);setTimeout(()=>tint.remove(),1500);
  // Multiple giant dark slashes crossing the screen
  const slashCount=crit?5:3;
  for(let i=0;i<slashCount;i++){
    setTimeout(()=>{
      const s=document.createElement('div');s.className='shadow-slash-overlay';
      s.style.transform=`rotate(${-60+i*30+Math.random()*20}deg)`;
      to.style.position='relative';to.appendChild(s);setTimeout(()=>s.remove(),700);
    },i*120);
  }
  // Black hole vortex at center
  const vortex=document.createElement('div');vortex.className='dark-vortex';
  to.style.position='relative';to.appendChild(vortex);setTimeout(()=>vortex.remove(),1100);
  // Dark lightning bolts
  for(let i=0;i<(crit?5:3);i++){
    setTimeout(()=>{
      const dl=document.createElement('div');dl.className='dark-lightning';
      dl.style.left=(20+Math.random()*60)+'%';dl.style.top='0';dl.style.height=(40+Math.random()*50)+'%';
      dl.style.transform=`rotate(${(Math.random()-0.5)*30}deg)`;
      to.appendChild(dl);setTimeout(()=>dl.remove(),500);
    },200+i*100);
  }
  // Shadow particles pulled into vortex
  for(let i=0;i<(crit?35:20);i++){
    setTimeout(()=>{
      const p=document.createElement('div');
      const angle=Math.random()*Math.PI*2;const dist=100+Math.random()*60;
      const startX=50+Math.cos(angle)*dist;const startY=50+Math.sin(angle)*dist;
      p.style.cssText=`position:absolute;pointer-events:none;z-index:99;width:${5+Math.random()*10}px;height:${5+Math.random()*10}px;border-radius:50%;background:rgba(${Math.random()>0.5?'150,0,255':'60,0,120'},0.9);box-shadow:0 0 15px rgba(120,0,255,0.7);left:${startX}%;top:${startY}%;transition:all 0.5s ease-in;`;
      to.style.position='relative';to.appendChild(p);
      requestAnimationFrame(()=>{p.style.left='50%';p.style.top='50%';p.style.opacity='0';p.style.transform='scale(0)';});
      setTimeout(()=>p.remove(),600);
    },Math.random()*400);
  }
  setTimeout(()=>{
    if(arena){arena.classList.add('screen-shake-heavy');setTimeout(()=>arena.classList.remove('screen-shake-heavy'),500);}
    to.classList.add('dark-hit');
    if(crit){playCriticalSound();
      const slash=document.createElement('div');slash.className='critical-slash';slash.style.background='linear-gradient(90deg,transparent,rgba(150,0,255,1),#fff,rgba(150,0,255,1),transparent)';slash.style.width='250px';slash.style.marginLeft='-125px';to.appendChild(slash);setTimeout(()=>slash.remove(),500);
      const slash2=document.createElement('div');slash2.className='critical-slash';slash2.style.background='linear-gradient(90deg,transparent,rgba(100,0,200,1),transparent)';slash2.style.transform='rotate(90deg)';to.appendChild(slash2);setTimeout(()=>slash2.remove(),500);
    }else playHitSound();
    setTimeout(()=>to.classList.remove('dark-hit'),1000);
    if(cb)setTimeout(cb,350);
  },slashCount*120+150);
}

// ==== 陨石坠落 ====
function playMeteorAttack(from,to,crit,cb){
  const tR=to.getBoundingClientRect();
  const tx=tR.left+tR.width/2-50,ty=tR.top+tR.height/2-50;
  playSkillSound('fire');
  // Fire screen tint
  const tint=document.createElement('div');tint.className='screen-tint';tint.style.background='rgba(255,80,0,0.25)';document.body.appendChild(tint);setTimeout(()=>tint.remove(),1500);
  // 5-7 meteors raining down
  const meteorCount=crit?7:5;
  for(let i=0;i<meteorCount;i++){
    setTimeout(()=>{
      const m=document.createElement('div');m.className='meteor';
      const offX=(Math.random()-0.5)*120;
      m.style.left=(tx+offX)+'px';m.style.top=ty+'px';
      m.style.setProperty('--startX',(-80+offX*1.5)+'px');m.style.setProperty('--startY','-350px');
      document.body.appendChild(m);
      // Tail
      const tail=document.createElement('div');tail.className='meteor-tail';
      tail.style.left=(tx+offX+30)+'px';tail.style.top=(ty-80)+'px';
      document.body.appendChild(tail);
      setTimeout(()=>{m.remove();tail.remove();},800);
    },i*150);
  }
  // Fire rain continues after impact
  setTimeout(()=>{
    for(let i=0;i<(crit?20:12);i++){
      setTimeout(()=>{
        const fr=document.createElement('div');fr.className='fire-rain';
        fr.style.left=(tR.left+Math.random()*tR.width)+'px';fr.style.top='-20px';
        document.body.appendChild(fr);setTimeout(()=>fr.remove(),900);
      },Math.random()*600);
    }
  },meteorCount*150);
  setTimeout(()=>{
    const arena=document.getElementById('pk-arena');
    if(arena){arena.classList.add('screen-shake-heavy');setTimeout(()=>arena.classList.remove('screen-shake-heavy'),600);}
    // Flash
    const flash=document.createElement('div');flash.className='screen-flash';flash.style.background='rgba(255,150,0,0.7)';document.body.appendChild(flash);setTimeout(()=>flash.remove(),350);
    createHitExplosion(to,true);
    // Crater effect
    const crater=document.createElement('div');crater.className='meteor-crater';to.style.position='relative';to.appendChild(crater);setTimeout(()=>crater.remove(),900);
    playExplosionSound();
    if(crit)playCriticalSound();else playHitSound();
    if(cb)setTimeout(cb,350);
  },meteorCount*150+450);
}

// ==== 圣光审判 ====
function playHolyAttack(from,to,crit,cb){
  playSkillSound('holy');
  const arena=document.getElementById('pk-arena');
  // White-gold screen flash
  const flash=document.createElement('div');flash.className='screen-flash';flash.style.background='rgba(255,255,200,0.8)';document.body.appendChild(flash);setTimeout(()=>flash.remove(),400);
  // Massive golden light pillar covering the whole pet
  const beam=document.createElement('div');beam.className='holy-beam';
  beam.style.width='90%';beam.style.left='5%';
  if(crit){beam.style.width='110%';beam.style.left='-5%';beam.style.background='linear-gradient(180deg,transparent,rgba(255,255,150,0.6),rgba(255,215,0,1),rgba(255,255,100,1),rgba(255,215,0,1),rgba(255,255,150,0.6),transparent)';}
  to.style.position='relative';to.appendChild(beam);setTimeout(()=>beam.remove(),1100);
  // Cross-shaped light beams shooting in all directions
  setTimeout(()=>{
    const cross1=document.createElement('div');cross1.style.cssText=`position:absolute;left:50%;top:50%;width:200%;height:6px;margin-left:-100%;margin-top:-3px;background:linear-gradient(90deg,transparent,rgba(255,255,200,0.9),#fff,rgba(255,255,200,0.9),transparent);pointer-events:none;z-index:102;animation:lightningFlash 0.5s ease-out forwards;box-shadow:0 0 20px rgba(255,255,100,0.8);`;
    const cross2=document.createElement('div');cross2.style.cssText=`position:absolute;left:50%;top:50%;width:6px;height:200%;margin-left:-3px;margin-top:-100%;background:linear-gradient(180deg,transparent,rgba(255,255,200,0.9),#fff,rgba(255,255,200,0.9),transparent);pointer-events:none;z-index:102;animation:lightningFlash 0.5s ease-out forwards;box-shadow:0 0 20px rgba(255,255,100,0.8);`;
    const cross3=document.createElement('div');cross3.style.cssText=`position:absolute;left:50%;top:50%;width:150%;height:4px;margin-left:-75%;margin-top:-2px;background:linear-gradient(90deg,transparent,rgba(255,215,0,0.8),transparent);pointer-events:none;z-index:102;transform:rotate(45deg);animation:lightningFlash 0.5s ease-out forwards;`;
    const cross4=document.createElement('div');cross4.style.cssText=`position:absolute;left:50%;top:50%;width:150%;height:4px;margin-left:-75%;margin-top:-2px;background:linear-gradient(90deg,transparent,rgba(255,215,0,0.8),transparent);pointer-events:none;z-index:102;transform:rotate(-45deg);animation:lightningFlash 0.5s ease-out forwards;`;
    to.appendChild(cross1);to.appendChild(cross2);to.appendChild(cross3);to.appendChild(cross4);
    setTimeout(()=>{cross1.remove();cross2.remove();cross3.remove();cross4.remove();},600);
  },200);
  // Stars descending
  for(let i=0;i<(crit?8:5);i++){
    setTimeout(()=>{
      const star=document.createElement('div');star.className='holy-star';star.textContent='✦';
      star.style.left=(10+Math.random()*80)+'%';star.style.top=(Math.random()*40)+'%';
      star.style.color=Math.random()>0.5?'#ffd700':'#fff';
      to.appendChild(star);setTimeout(()=>star.remove(),1600);
    },Math.random()*600);
  }
  // Light particles rising
  for(let i=0;i<(crit?30:18);i++){
    setTimeout(()=>{
      const p=document.createElement('div');
      p.style.cssText=`position:absolute;pointer-events:none;z-index:101;width:${4+Math.random()*8}px;height:${4+Math.random()*8}px;border-radius:50%;background:rgba(255,255,${100+Math.random()*155},0.95);box-shadow:0 0 14px rgba(255,255,150,0.9),0 0 25px rgba(255,215,0,0.5);left:${10+Math.random()*80}%;bottom:0;animation:emberFloat ${0.8+Math.random()*1.5}s ease-out forwards;`;
      to.appendChild(p);setTimeout(()=>p.remove(),2500);
    },Math.random()*500);
  }
  setTimeout(()=>{
    if(arena){arena.classList.add('screen-shake-heavy');setTimeout(()=>arena.classList.remove('screen-shake-heavy'),500);}
    to.classList.add('holy-hit');
    if(crit)playCriticalSound();else playHitSound();
    setTimeout(()=>to.classList.remove('holy-hit'),1200);
    if(cb)setTimeout(cb,400);
  },450);
}

// ==== 岩浆喷发 ====
function playLavaAttack(from,to,crit,cb){
  playSkillSound('fire');
  const arena=document.getElementById('pk-arena');
  to.style.position='relative';
  // Red-orange screen tint
  const tint=document.createElement('div');tint.className='screen-tint';tint.style.background='rgba(255,60,0,0.3)';document.body.appendChild(tint);setTimeout(()=>tint.remove(),1200);
  // Ground splits open with lava underneath
  const crack=document.createElement('div');crack.className='lava-crack';to.appendChild(crack);setTimeout(()=>crack.remove(),1100);
  // Massive lava geysers erupting through the pet
  const geyserCount=crit?5:3;
  for(let i=0;i<geyserCount;i++){
    setTimeout(()=>{
      const g=document.createElement('div');g.className='lava-geyser';
      g.style.left=(15+i*(70/geyserCount)+Math.random()*10)+'%';
      g.style.setProperty('--geyser-h',(80+Math.random()*100)+'px');
      g.style.width=(14+Math.random()*12)+'px';
      to.appendChild(g);setTimeout(()=>g.remove(),900);
    },i*100);
  }
  // Molten rocks everywhere
  const n=crit?45:28;
  for(let i=0;i<n;i++){
    setTimeout(()=>{
      const s=document.createElement('div');s.className='lava-splash';
      const angle=Math.random()*Math.PI*2;const dist=40+Math.random()*(crit?110:70);
      s.style.setProperty('--ex',Math.cos(angle)*dist+'px');
      s.style.setProperty('--ey',(Math.sin(angle)*dist-40-Math.random()*60)+'px');
      s.style.setProperty('--rot',(Math.random()*900)+'deg');
      s.style.left='50%';s.style.bottom='10%';
      to.appendChild(s);setTimeout(()=>s.remove(),1200);
    },Math.random()*400);
  }
  // Bottom lava glow - bigger
  const glow=document.createElement('div');
  glow.style.cssText=`position:absolute;bottom:0;left:0;width:100%;height:60%;pointer-events:none;z-index:99;background:linear-gradient(to top,rgba(255,50,0,0.8),rgba(255,120,0,0.5),rgba(255,200,0,0.2),transparent);border-radius:0 0 20px 20px;animation:lavaCrackGlow 1.2s ease-out forwards;`;
  to.appendChild(glow);setTimeout(()=>glow.remove(),1300);
  setTimeout(()=>{
    to.classList.add('lava-hit');
    if(arena){arena.classList.add('screen-shake-heavy');setTimeout(()=>arena.classList.remove('screen-shake-heavy'),600);}
    // Flash
    const flash=document.createElement('div');flash.className='screen-flash';flash.style.background='rgba(255,100,0,0.5)';document.body.appendChild(flash);setTimeout(()=>flash.remove(),300);
    playExplosionSound();
    if(crit)playCriticalSound();else playHitSound();
    setTimeout(()=>{to.classList.remove('lava-hit');},1000);
    if(cb)setTimeout(cb,350);
  },400);
}

// ==== 星爆冲击 ====
function playStarburstAttack(from,to,crit,cb){
  playSkillSound('holy');
  const arena=document.getElementById('pk-arena');
  to.style.position='relative';
  // Galaxy swirl effect
  const galaxy=document.createElement('div');galaxy.className='galaxy-swirl';
  to.appendChild(galaxy);setTimeout(()=>galaxy.remove(),1300);
  // Rainbow screen flash
  const flash=document.createElement('div');flash.className='screen-flash';flash.style.background='linear-gradient(135deg,rgba(255,100,200,0.4),rgba(100,100,255,0.4),rgba(100,255,200,0.4))';document.body.appendChild(flash);setTimeout(()=>flash.remove(),350);
  // Massive starburst rays - nova explosion
  const n=crit?24:16;
  setTimeout(()=>{
    for(let i=0;i<n;i++){
      const s=document.createElement('div');s.className='starburst';
      s.style.setProperty('--angle',(360/n*i)+'deg');
      s.style.left='50%';s.style.top='50%';s.style.marginLeft='-4px';
      const colors=['#fff,#ffdd44,#ff8800,transparent','#fff,#ff66aa,#cc00ff,transparent','#fff,#66ffaa,#0088ff,transparent','#fff,#ffaa00,#ff4400,transparent'];
      s.style.background=`linear-gradient(to bottom,${colors[i%colors.length]})`;
      s.style.height=crit?'60px':'45px';
      to.appendChild(s);setTimeout(()=>s.remove(),1000);
    }
    // Cosmic rays - second ring
    for(let i=0;i<(crit?12:8);i++){
      const s=document.createElement('div');s.className='starburst';
      s.style.setProperty('--angle',(360/(crit?12:8)*i+15)+'deg');
      s.style.left='50%';s.style.top='50%';s.style.marginLeft='-3px';s.style.width='5px';
      s.style.background='linear-gradient(to bottom,#fff,#aaddff,transparent)';
      s.style.height=crit?'80px':'55px';s.style.animationDelay='0.1s';
      to.appendChild(s);setTimeout(()=>s.remove(),1100);
    }
  },200);
  // Center flash - bigger
  const center=document.createElement('div');
  center.style.cssText=`position:absolute;left:50%;top:50%;width:40px;height:40px;margin:-20px 0 0 -20px;border-radius:50%;background:#fff;box-shadow:0 0 60px 30px rgba(255,220,100,1),0 0 120px 60px rgba(255,150,0,0.7),0 0 180px 80px rgba(255,100,200,0.4);pointer-events:none;z-index:101;animation:energyCharge 0.8s ease-out forwards;`;
  to.appendChild(center);setTimeout(()=>center.remove(),900);
  setTimeout(()=>{
    if(arena){arena.classList.add('screen-shake-heavy');setTimeout(()=>arena.classList.remove('screen-shake-heavy'),500);}
    createHitExplosion(to,crit);
    if(crit)playCriticalSound();else playHitSound();
    if(cb)setTimeout(cb,300);
  },400);
}

// ==== 龙息吐焰 ====
function playDragonfireAttack(from,to,crit,cb){
  const fR=from.getBoundingClientRect(),tR=to.getBoundingClientRect();
  const sx=fR.left+fR.width/2,sy=fR.top+fR.height/2;
  const ex=tR.left+tR.width/2,ey=tR.top+tR.height/2;
  playSkillSound('fire');
  const arena=document.getElementById('pk-arena');
  // Fire screen tint
  const tint=document.createElement('div');tint.className='screen-tint';tint.style.background='rgba(255,80,0,0.2)';document.body.appendChild(tint);setTimeout(()=>tint.remove(),1500);
  // Massive sustained flame beam - more particles, wider spread covering half the screen
  const count=crit?55:35;let spawned=0;
  const interval=setInterval(()=>{
    if(spawned>=count){clearInterval(interval);return;}
    // Spawn 2-3 particles per tick for density
    for(let k=0;k<(crit?3:2);k++){
      const p=document.createElement('div');
      const sz=10+Math.random()*18;const colors=['#ff1100','#ff3300','#ff6600','#ffaa00','#ffcc33','#ffee88','#fff'];
      p.style.cssText=`position:fixed;pointer-events:none;z-index:10002;width:${sz}px;height:${sz}px;border-radius:50%;background:${colors[Math.floor(Math.random()*colors.length)]};box-shadow:0 0 ${sz+5}px rgba(255,100,0,0.9),0 0 ${sz+15}px rgba(255,50,0,0.4);left:${sx}px;top:${sy}px;opacity:0.95;`;
      document.body.appendChild(p);
      const dur=200+Math.random()*120,st2=performance.now();
      const offX=(Math.random()-0.5)*80,offY=(Math.random()-0.5)*80;
      function anim(t){const el=t-st2,pr=Math.min(1,el/dur);
        p.style.left=(sx+(ex+offX-sx)*pr)+'px';p.style.top=(sy+(ey+offY-sy)*pr)+'px';
        p.style.opacity=(1-pr*0.7);p.style.transform=`scale(${1+pr*0.5})`;
        if(pr<1)requestAnimationFrame(anim);else p.remove();
      }requestAnimationFrame(anim);
    }
    spawned++;
  },15);
  // Target completely engulfed in fire + flame vortex
  setTimeout(()=>{
    to.style.position='relative';
    // Flame engulf overlay
    const engulf=document.createElement('div');
    engulf.style.cssText=`position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:101;background:radial-gradient(ellipse,rgba(255,200,0,0.6),rgba(255,100,0,0.5),rgba(255,50,0,0.3),transparent);border-radius:20px;animation:lavaCrackGlow 1s ease-in-out forwards;`;
    to.appendChild(engulf);setTimeout(()=>engulf.remove(),1100);
    // Flame vortex rings
    for(let i=0;i<(crit?6:4);i++){
      setTimeout(()=>{
        const r=document.createElement('div');r.className='tornado-ring';
        r.style.borderColor='rgba(255,150,0,0.8)';r.style.boxShadow='0 0 15px rgba(255,100,0,0.6)';
        const sz=30+i*15;r.style.width=sz+'px';r.style.height=sz*0.4+'px';
        r.style.left='50%';r.style.bottom=(10+i*12)+'%';r.style.marginLeft=(-sz/2)+'px';
        to.appendChild(r);setTimeout(()=>r.remove(),900);
      },i*80);
    }
  },count*10);
  setTimeout(()=>{
    createHitExplosion(to,crit);
    if(arena){arena.classList.add('screen-shake-heavy');setTimeout(()=>arena.classList.remove('screen-shake-heavy'),600);}
    const flash=document.createElement('div');flash.className='screen-flash';flash.style.background='rgba(255,100,0,0.5)';document.body.appendChild(flash);setTimeout(()=>flash.remove(),300);
    playExplosionSound();
    if(crit)playCriticalSound();else playHitSound();
    if(cb)setTimeout(cb,350);
  },count*15+250);
}

// ==== 冰封裂地 ====
function playIceGroundAttack(from,to,crit,cb){
  playSkillSound('ice');
  const arena=document.getElementById('pk-arena');
  to.style.position='relative';
  // Ice blue screen tint
  const tint=document.createElement('div');tint.className='screen-tint';tint.style.background='rgba(100,200,255,0.25)';document.body.appendChild(tint);setTimeout(()=>tint.remove(),1200);
  // Freezing wave expanding outward
  const wave=document.createElement('div');wave.className='energy-ring';wave.style.borderColor='rgba(100,200,255,0.9)';wave.style.width='200px';wave.style.height='200px';wave.style.margin='-100px 0 0 -100px';wave.style.boxShadow='0 0 30px rgba(100,200,255,0.6)';
  to.appendChild(wave);setTimeout(()=>wave.remove(),800);
  // Giant ice pillars (10+) that PIERCE THROUGH the pet body, semi-transparent
  const pillarCount=crit?14:10;
  for(let i=0;i<pillarCount;i++){
    setTimeout(()=>{
      const pillar=document.createElement('div');
      const w=10+Math.random()*14,h=150+Math.random()*100;
      pillar.style.cssText=`position:absolute;pointer-events:none;z-index:102;width:${w}px;height:0;bottom:0;left:${5+i*(90/pillarCount)+Math.random()*5}%;background:linear-gradient(to top,rgba(100,180,255,0.7),rgba(150,220,255,0.6),rgba(200,240,255,0.5),rgba(255,255,255,0.8));border-radius:${w/2}px ${w/2}px 3px 3px;box-shadow:0 0 15px rgba(100,200,255,0.7),0 0 30px rgba(100,200,255,0.4),inset 0 0 10px rgba(255,255,255,0.3);transition:height 0.35s cubic-bezier(0.2,1.2,0.3,1);opacity:0.85;clip-path:polygon(15% 100%,50% 0%,85% 100%);`;
      to.appendChild(pillar);
      requestAnimationFrame(()=>{pillar.style.height=h+'px';});
      setTimeout(()=>{pillar.style.opacity='0';pillar.style.transition='opacity 0.4s';},700);
      setTimeout(()=>pillar.remove(),1200);
    },i*60);
  }
  // Ice shards flying out on impact
  setTimeout(()=>{
    if(arena){arena.classList.add('screen-shake-heavy');setTimeout(()=>arena.classList.remove('screen-shake-heavy'),600);}
    // Flash
    const flash=document.createElement('div');flash.className='screen-flash';flash.style.background='rgba(180,230,255,0.6)';document.body.appendChild(flash);setTimeout(()=>flash.remove(),300);
    to.classList.add('ice-freeze');createIceShatter(to,crit);
    if(crit)playCriticalSound();else playHitSound();
    setTimeout(()=>{to.classList.remove('ice-freeze');},1200);
    if(cb)setTimeout(cb,350);
  },pillarCount*60+250);
}

// 火球攻击特效(原始技能保留) - 3x bigger fireball
function playFireballAttack(fromContainer, toContainer, isCritical, callback) {
  if(!fromContainer || !toContainer) { if(callback) callback(); return; }
  const fromRect = fromContainer.getBoundingClientRect();
  const toRect = toContainer.getBoundingClientRect();
  const startX = fromRect.left + fromRect.width / 2 - 40;
  const startY = fromRect.top + fromRect.height / 2 - 40;
  const endX = toRect.left + toRect.width / 2 - 40;
  const endY = toRect.top + toRect.height / 2 - 40;

  const fireball = document.createElement('div');
  fireball.className = 'fireball-effect';
  // Giant fireball 3x size
  fireball.style.width = '120px'; fireball.style.height = '120px';
  if(isCritical) {
    fireball.style.width = '150px'; fireball.style.height = '150px';
    fireball.style.boxShadow = '0 0 60px 30px rgba(255,50,0,1), 0 0 120px 60px rgba(255,0,0,0.7), 0 0 180px 80px rgba(200,0,0,0.3)';
  }
  fireball.style.left = startX + 'px';
  fireball.style.top = startY + 'px';
  document.body.appendChild(fireball);

  playFireballSound();

  const duration = isCritical ? 300 : 220;
  const startTime = performance.now();
  let trailCount = 0;

  function animate(currentTime) {
    const elapsed = currentTime - startTime;
    const t = Math.min(1, elapsed / duration);
    const easeT = t < 0.5 ? 2*t*t : 1 - Math.pow(-2*t+2,2)/2;
    const currentX = startX + (endX - startX) * easeT;
    const currentY = startY + (endY - startY) * easeT - Math.sin(t * Math.PI) * 40;
    fireball.style.left = currentX + 'px';
    fireball.style.top = currentY + 'px';

    // Dense trail
    trailCount++;
    if(trailCount % 2 === 0) {
      for(let k=0;k<3;k++){
        const trail = document.createElement('div');
        trail.className = 'fireball-trail';
        trail.style.left = (currentX + 30 + (Math.random()-0.5)*30) + 'px';
        trail.style.top = (currentY + 30 + (Math.random()-0.5)*30) + 'px';
        document.body.appendChild(trail);
        setTimeout(() => trail.remove(), 500);
      }
    }

    if(t < 1) {
      requestAnimationFrame(animate);
    } else {
      fireball.remove();
      // Screen shake on every hit
      const arena = document.getElementById('pk-arena');
      if(arena){arena.classList.add('screen-shake-heavy');setTimeout(()=>arena.classList.remove('screen-shake-heavy'),500);}
      // Flash
      const flash=document.createElement('div');flash.className='screen-flash';flash.style.background='rgba(255,120,0,0.5)';document.body.appendChild(flash);setTimeout(()=>flash.remove(),300);
      // Massive explosion on impact
      createHitExplosion(toContainer, isCritical);
      // Fire particles lingering
      for(let i=0;i<(isCritical?15:8);i++){
        setTimeout(()=>{
          const p=document.createElement('div');
          p.style.cssText=`position:absolute;pointer-events:none;z-index:101;width:${5+Math.random()*10}px;height:${5+Math.random()*10}px;border-radius:50%;background:rgba(255,${100+Math.random()*100},0,0.8);box-shadow:0 0 10px rgba(255,100,0,0.7);left:${20+Math.random()*60}%;top:${20+Math.random()*60}%;animation:emberFloat ${0.8+Math.random()*1.2}s ease-out forwards;`;
          toContainer.style.position='relative';toContainer.appendChild(p);setTimeout(()=>p.remove(),2000);
        },Math.random()*400);
      }
      if(isCritical) {
        playCriticalSound();
        const slash = document.createElement('div');
        slash.className = 'critical-slash';
        toContainer.style.position = 'relative';
        toContainer.appendChild(slash);
        setTimeout(() => slash.remove(), 400);
        const slash2 = document.createElement('div');
        slash2.className = 'critical-slash';
        slash2.style.animationDelay = '0.1s';
        slash2.style.transform = 'rotate(45deg)';
        toContainer.appendChild(slash2);
        setTimeout(() => slash2.remove(), 500);
      } else {
        playHitSound();
      }
      if(callback) setTimeout(callback, 250);
    }
  }
  requestAnimationFrame(animate);
}

// 命中爆炸粒子
function createHitExplosion(container, isCritical) {
  const particleCount = isCritical ? 30 : 15;
  const colors = isCritical
    ? ['#ff0000','#ff4400','#ffcc00','#ffffff','#ff6600','#ffaa00']
    : ['#ff6600','#ffaa33','#ffcc00','#ff9900'];
  const explosionDiv = document.createElement('div');
  explosionDiv.className = 'explosion-container';
  container.style.position = 'relative';
  container.appendChild(explosionDiv);
  for(let i = 0; i < particleCount; i++) {
    const p = document.createElement('div');
    p.className = 'explosion-particle';
    const angle = (Math.PI * 2 / particleCount) * i + Math.random() * 0.5;
    const dist = 40 + Math.random() * (isCritical ? 80 : 50);
    p.style.setProperty('--ex', Math.cos(angle) * dist + 'px');
    p.style.setProperty('--ey', Math.sin(angle) * dist + 'px');
    p.style.width = (4 + Math.random() * (isCritical ? 10 : 6)) + 'px';
    p.style.height = p.style.width;
    p.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    p.style.boxShadow = `0 0 6px ${p.style.backgroundColor}`;
    explosionDiv.appendChild(p);
  }
  // 能量环
  const ring = document.createElement('div');
  ring.className = 'energy-ring';
  if(isCritical) { ring.style.borderColor = 'rgba(255,50,0,0.9)'; ring.style.width = '120px'; ring.style.height = '120px'; ring.style.margin = '-60px 0 0 -60px'; }
  container.appendChild(ring);
  setTimeout(() => { explosionDiv.remove(); ring.remove(); }, 800);
}

// 显示伤害数字
function showDamageNumber(container, damage, isCritical, isCombo) {
  const rect = container.getBoundingClientRect();
  
  const dmgEl = document.createElement('div');
  dmgEl.style.cssText = `
    position: fixed;
    font-size: 32px;
    font-weight: 900;
    color: #ff5555;
    text-shadow: 2px 2px 0 #550000, 0 0 10px rgba(255,0,0,0.5);
    pointer-events: none;
    z-index: 9999;
    animation: floatUp 1.2s ease-out forwards;
    left: ${rect.left + rect.width/2 - 40 + Math.random()*30}px;
    top: ${rect.top + 10}px;
  `;
  
  if(isCritical) {
    dmgEl.style.fontSize = '48px';
    dmgEl.style.color = '#ff0000';
    dmgEl.innerHTML = `💥暴击! -${damage}`;
    dmgEl.style.textShadow = '3px 3px 0 #880000, 0 0 20px #ff0000, 0 0 40px #ff4400';
  } else if(isCombo) {
    dmgEl.style.fontSize = '36px';
    dmgEl.style.color = '#ff9900';
    dmgEl.innerHTML = `⚡连击! -${damage}`;
    dmgEl.style.textShadow = '2px 2px 0 #884400, 0 0 12px #ff8800';
  } else {
    dmgEl.innerHTML = `受到攻击! -${damage}`;
  }
  
  document.body.appendChild(dmgEl);
  setTimeout(() => dmgEl.remove(), 1200);
}

// 显示攻击方造成的伤害文本
function showAttackDamageText(container, damage, isCritical, isCombo) {
  const arena = container.closest('.pk-arena');
  const target = arena || document.body;
  const targetRect = target.getBoundingClientRect();
  const rect = container.getBoundingClientRect();
  
  const dmgEl = document.createElement('div');
  dmgEl.style.cssText = `
    position: absolute;
    font-size: 26px;
    font-weight: 900;
    color: #ffcc00;
    text-shadow: 2px 2px 0 #664400, 0 0 10px rgba(255,180,0,0.5);
    pointer-events: none;
    z-index: 9999;
    animation: floatUp 1.2s ease-out forwards;
    left: ${rect.left - targetRect.left + rect.width/2 - 50}px;
    top: ${rect.top - targetRect.top - 10}px;
  `;
  
  let text = `造成 ${damage} 伤害`;
  if(isCritical) {
    text = `💥暴击! 造成 ${damage} 伤害`;
    dmgEl.style.color = '#ffaa00';
    dmgEl.style.fontSize = '32px';
  } else if(isCombo) {
    text = `⚡连击! 造成 ${damage} 伤害`;
    dmgEl.style.color = '#ff8800';
  }
  
  dmgEl.innerHTML = text;
  target.style.position = 'relative';
  target.appendChild(dmgEl);
  setTimeout(() => dmgEl.remove(), 1200);
}

let currentBattleModalOverlay = null;
let _pkExitBtn = null;

// Create exit button on document.body to escape all stacking contexts
function _createPKExitButton() {
  if (_pkExitBtn) _pkExitBtn.remove();
  _pkExitBtn = document.createElement('button');
  _pkExitBtn.id = 'pkExitBtn';
  _pkExitBtn.textContent = '退出';
  _pkExitBtn.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:100000;padding:14px 40px;font-size:18px;font-weight:700;color:#fff;background:linear-gradient(135deg,#ff6b6b,#ee5a24);border:none;border-radius:30px;cursor:pointer;box-shadow:0 4px 20px rgba(238,90,36,0.5);transition:all 0.3s;opacity:0;pointer-events:none;letter-spacing:1px;';
  _pkExitBtn.onclick = function() { closePKModal(); };
  document.body.appendChild(_pkExitBtn);
}

function _showPKExitButton() {
  if (_pkExitBtn) {
    _pkExitBtn.style.opacity = '1';
    _pkExitBtn.style.pointerEvents = 'auto';
  }
}

function _removePKExitButton() {
  if (_pkExitBtn) {
    _pkExitBtn.remove();
    _pkExitBtn = null;
  }
}

function startPKBattle() {
  if(pkState.players.length !== 2) return;
  if(pkState.isFighting) {
    return; // silently return - already fighting, no notification needed
  }
  // Prevent re-starting the same battle (infinite loop protection)
  if (pkState._battleCompleted) {
    return;
  }
  const cur = classesData.find(c=>c.id===currentClassId);
  const student1 = cur.students.find(s=>s.id.toString()===pkState.players[0].studentId.toString());
  const student2 = cur.students.find(s=>s.id.toString()===pkState.players[1].studentId.toString());
  if(student1.id === student2.id) {
    showNotification('对战错误', '不能与自己宠物对战，请重新选择', 'error');
    resetPKSelection();
    return;
  }
  const pet1 = getActivePet(student1);
  const pet2 = getActivePet(student2);
  if(!pet1 || !pet2 || pet1.isDead || pet2.isDead) {
    showNotification('PK失败', '宠物状态异常，无法对战', 'error');
    resetPKSelection();
    return;
  }
  if(student1.coins < 5 || student2.coins < 5) {
    showNotification('PK条件不满足', '双方金币必须≥5才能进行对战', 'error');
    return;
  }
  if(Math.abs(pet1.level - pet2.level) > 1) {
    showNotification('PK条件不满足', '只能与等级相差不超过1级的宠物对战', 'error');
    return;
  }
  resetDailyPkCountIfNeeded(student1);
  resetDailyPkCountIfNeeded(student2);
  if(student1.pkCountToday >= 3) {
    showNotification('PK次数已达上限', `${student1.name} 今日已PK ${student1.pkCountToday} 次，无法继续`, 'error');
    return;
  }
  if(student2.pkCountToday >= 3) {
    showNotification('PK次数已达上限', `${student2.name} 今日已PK ${student2.pkCountToday} 次，无法继续`, 'error');
    return;
  }
  pkState.isFighting = true;
  pkState._battleCompleted = false; // Reset for this battle
  // Create exit button on document.body (escapes all stacking contexts)
  _createPKExitButton();
  const p1 = pkState.players[0];
  const p2 = pkState.players[1];
  
  // === 设置种子随机数（用于同步战斗结果）===
  // 如果 pkState 中有种子（来自 PK 挑战），使用它；否则生成新的
  if (pkState.battleSeed) {
    _pkBattleRng = _mulberry32(pkState.battleSeed);
  } else {
    // 教师发起或无种子的情况：生成随机种子
    pkState.battleSeed = Math.floor(Math.random() * 2147483647);
    _pkBattleRng = _mulberry32(pkState.battleSeed);
  }
  
  // 确保PK数字命名图片探测完成后再开始
  probePKMonsterImages().then(async () => {
    // 使用种子确定怪兽图片索引（双方一致）
    if (_leftMonsterPool.length > 0) {
      _pkBattleLeftMonsterIdx = Math.floor(_pkRng() * _leftMonsterPool.length);
    }
    if (_rightMonsterPool.length > 0) {
      _pkBattleRightMonsterIdx = Math.floor(_pkRng() * _rightMonsterPool.length);
    }
    
    let leftMonster = getLeftMonsterImg();
    let rightMonster = getRightMonsterImg();
    // 重试机制：如果图片池为空，重新探测一次
    if(!leftMonster || !rightMonster) {
      _pkMonsterProbed = false;
      _leftMonsterPool = [];
      _rightMonsterPool = [];
      await probePKMonsterImages();
      leftMonster = getLeftMonsterImg();
      rightMonster = getRightMonsterImg();
    }
    // 最终回退：如果仍然为空，使用空字符串避免 "null" 字符串
    if(!leftMonster) leftMonster = '';
    if(!rightMonster) rightMonster = '';
    const modalContent = `
      <div class="pk-arena" id="pk-arena">
        <div class="pk-arena-particles" id="pk-arena-particles"></div>
        <div class="pk-pet-side" id="pk-side-1">
          <div class="pk-pet-name">${p1.studentName} · ${p1.pet.nickname||p1.pet.name}</div>
          <div class="pk-pet-img-container" id="pk-img-1">${getPetImage(p1.pet.name, p1.pet.level)}</div>
          <div class="pk-hp-bar-container"><div class="pk-hp-bar" id="pk-hp-bar-1"></div></div>
          <div class="pk-hp-text" id="pk-hp-text-1">准备变身...</div>
        </div>
        <div class="pk-vs" id="pk-vs-text">VS</div>
        <div class="pk-pet-side" id="pk-side-2">
          <div class="pk-pet-name">${p2.studentName} · ${p2.pet.nickname||p2.pet.name}</div>
          <div class="pk-pet-img-container" id="pk-img-2">${getPetImage(p2.pet.name, p2.pet.level)}</div>
          <div class="pk-hp-bar-container"><div class="pk-hp-bar" id="pk-hp-bar-2"></div></div>
          <div class="pk-hp-text" id="pk-hp-text-2">准备变身...</div>
        </div>
      </div>
    `;
    const actions = [{text:'退出', class:'btn-secondary', onclick:'closePKModal()', disabled: true}];
    currentBattleModalOverlay = showModal('⚔️ 宠物PK对战 - 变身中...', modalContent, actions, false, 'pk-fullscreen');
    // Add floating ember particles to arena
    setTimeout(() => {
      const particlesDiv = document.getElementById('pk-arena-particles');
      if(particlesDiv) {
        for(let i = 0; i < 10; i++) {
          const ember = document.createElement('div');
          ember.style.cssText = `position:absolute;width:${2+Math.random()*4}px;height:${2+Math.random()*4}px;background:rgba(255,${80+Math.random()*120},0,${0.3+Math.random()*0.5});border-radius:50%;left:${Math.random()*100}%;bottom:0;animation:emberFloat ${3+Math.random()*4}s ease-in-out infinite;animation-delay:${Math.random()*3}s;will-change:transform,opacity;contain:strict;`;
          particlesDiv.appendChild(ember);
        }
      }
    }, 100);
    if(currentBattleModalOverlay){
      const exitBtn = currentBattleModalOverlay.querySelector('.modal-actions button');
      if(exitBtn) exitBtn.disabled = true;
    }
    // 开始变身序列
    setTimeout(() => runTransformSequence(student1, student2, p1, p2, leftMonster, rightMonster), 600);
  });
}

// 变身序列
async function runTransformSequence(student1, student2, p1, p2, leftMonster, rightMonster) {
  const img1 = document.getElementById('pk-img-1');
  const img2 = document.getElementById('pk-img-2');
  const vsText = document.getElementById('pk-vs-text');
  
  // Safety check: if elements not found, skip transform and go directly to battle
  if (!img1 || !img2) {
    console.warn('[PK] Transform elements not found, skipping transform sequence');
    startPKBattleLoop(student1, student2, p1, p2);
    return;
  }
  
  await sleep(500);

  // 阶段1：两只宠物抖动
  img1.style.animation = 'petShake 0.4s ease-in-out infinite';
  img2.style.animation = 'petShake 0.4s ease-in-out infinite';
  playTransformSound();
  await sleep(1500);

  // 阶段2：裂纹出现
  const crack1 = document.createElement('div');
  crack1.className = 'crack-lines';
  img1.appendChild(crack1);
  const crack2 = document.createElement('div');
  crack2.className = 'crack-lines';
  img2.appendChild(crack2);
  img1.style.animation = 'petShake 0.2s ease-in-out infinite';
  img2.style.animation = 'petShake 0.2s ease-in-out infinite';
  await sleep(1000);

  // 阶段3：爆裂变身
  playExplosionSound();
  // 左侧爆裂
  const explode1 = document.createElement('div');
  explode1.className = 'crack-overlay';
  img1.appendChild(explode1);
  createHitExplosion(img1, true);
  // 右侧爆裂
  const explode2 = document.createElement('div');
  explode2.className = 'crack-overlay';
  img2.appendChild(explode2);
  createHitExplosion(img2, true);
  // 屏幕震动
  const arena = document.getElementById('pk-arena');
  if(arena) arena.classList.add('screen-shake');
  await sleep(600);
  if(arena) arena.classList.remove('screen-shake');

  // 阶段4：替换为战斗兽宠图片（必须使用战斗兽宠文件夹中的数字命名图片）
  img1.style.animation = '';
  img2.style.animation = '';
  img1.innerHTML = `<img src="${leftMonster}" alt="战斗兽宠" style="max-width:100%;max-height:100%;object-fit:contain;opacity:0;animation:monsterReveal 0.8s ease-out forwards;filter:drop-shadow(0 0 20px rgba(255,80,0,0.6)) drop-shadow(0 10px 30px rgba(0,0,0,0.9));">`;
  img2.innerHTML = `<img src="${rightMonster}" alt="战斗兽宠" style="max-width:100%;max-height:100%;object-fit:contain;opacity:0;animation:monsterReveal 0.8s ease-out forwards;filter:drop-shadow(0 0 20px rgba(255,80,0,0.6)) drop-shadow(0 10px 30px rgba(0,0,0,0.9));">`;
  playExplosionSound();
  await sleep(1000);

  // 进入战斗状态 - 先锁定opacity防止怪兽消失，再添加浮动动画
  img1.querySelectorAll('img, span').forEach(el => { el.style.opacity = '1'; el.style.filter = 'drop-shadow(0 0 20px rgba(255,80,0,0.6)) drop-shadow(0 10px 30px rgba(0,0,0,0.9))'; });
  img2.querySelectorAll('img, span').forEach(el => { el.style.opacity = '1'; el.style.filter = 'drop-shadow(0 0 20px rgba(255,80,0,0.6)) drop-shadow(0 10px 30px rgba(0,0,0,0.9))'; });
  img1.classList.add('battle-idle');
  img2.classList.add('battle-idle-no-flip');
  if(vsText) { vsText.innerHTML = '⚔️'; vsText.style.color = '#ff3300'; vsText.style.textShadow = '0 0 20px #ff6600'; }
  await sleep(500);

  // 开始回合制战斗
  startPKBattleLoop(student1, student2, p1, p2);
}

function closePKModal() {
  if(pkState.isFighting) {
    showNotification('战斗中', '战斗尚未结束，无法退出战场', 'warning');
    return;
  }
  _removePKExitButton();
  closeModal();
  resetPKSelection();
}

function addPKLog(msg, type='') {
  const logContainer = document.getElementById('pk-log-container');
  if(!logContainer) return;
  const logItem = document.createElement('div');
  logItem.className = `pk-log-item ${type}`;
  logItem.innerHTML = msg;
  logContainer.appendChild(logItem);
  logContainer.scrollTop = logContainer.scrollHeight;
}

function updateHPBar(side, current, max) {
  const bar = document.getElementById(`pk-hp-bar-${side}`);
  const text = document.getElementById(`pk-hp-text-${side}`);
  if(bar) {
    const clamped = Math.max(0, Math.min(max, Math.floor(current)));
    const pct = (clamped/max)*100;
    bar.style.transition = 'none';
    bar.style.width = pct + '%';
    bar.offsetHeight;
    bar.style.transition = 'width 0.4s ease';
    // 血条颜色随血量变化
    if(pct > 50) bar.style.background = 'linear-gradient(90deg, #44cc44, #88ff88)';
    else if(pct > 25) bar.style.background = 'linear-gradient(90deg, #ffaa00, #ffcc44)';
    else bar.style.background = 'linear-gradient(90deg, #ff3333, #ff6666)';
  }
  if(text) text.innerHTML = `HP: ${Math.max(0, Math.floor(current))}/${max}`;
}

async function startPKBattleLoop(student1, student2, p1, p2) {
  // HP公式：基础值 + 等级×100 + 成长值/30
  const p1MaxHP = Math.floor(100 + p1.pet.level * 100 + p1.pet.growth / 30);
  const p2MaxHP = Math.floor(100 + p2.pet.level * 100 + p2.pet.growth / 30);
  let p1HP = p1MaxHP;
  let p2HP = p2MaxHP;
  updateHPBar(1, p1HP, p1MaxHP);
  updateHPBar(2, p2HP, p2MaxHP);
  let turn = 0;
  const img1 = document.getElementById('pk-img-1');
  const img2 = document.getElementById('pk-img-2');
  const arena = document.getElementById('pk-arena');
  // 攻击函数：基础18-26%最大HP，暴击12%倍率1.5-1.8x，连击15%，闪避8%，绝地反击，反击，逆袭加成，伤害封顶
  async function doAttack(atkPlayer, atkImg, defImg, atkSide, defSide, defHP, defMaxHP, atkPet, atkName, dmgMult, isComboAttack, atkHP, atkMaxHP) {
    const skill = getRandomSkill();
    showSkillAnnounce(arena, skill, atkName);
    await sleep(400);
    atkImg.classList.add('charging');
    await sleep(250);
    atkImg.classList.remove('charging');
    atkImg.classList.add(atkSide === 1 ? 'attack-lunge-right' : 'attack-lunge-left');
    
    // === 闪避判定：8%几率完全闪避（连击不可闪避）===
    const dodged = !isComboAttack && _pkRng() < 0.08;
    if(dodged) {
      await sleep(200);
      if(arena){const a=document.createElement('div');a.className='skill-announce';a.innerHTML='💨闪避!';a.style.color='#66ddff';a.style.textShadow='0 0 20px rgba(100,200,255,0.9),0 0 60px rgba(50,150,255,0.6),2px 2px 0 #003355';arena.appendChild(a);setTimeout(()=>a.remove(),1200);}
      setTimeout(() => { atkImg.classList.remove(atkSide === 1 ? 'attack-lunge-right' : 'attack-lunge-left'); }, 400);
      return { hp: defHP, isCrit: false, dodged: true, dmgDealt: 0 };
    }
    
    // 伤害按最大HP百分比计算：基础18-26%，连击攻击75%伤害
    const minD = Math.floor(defMaxHP * 0.18);
    const maxD = Math.floor(defMaxHP * 0.26);
    let baseDmg = minD + Math.floor(_pkRng() * (maxD - minD + 1));
    baseDmg = Math.floor(baseDmg * (dmgMult || 1));
    // === 绝地反击：血量越低伤害越高（温和版）===
    if(atkHP !== undefined && atkMaxHP) {
      const hpRatio = atkHP / atkMaxHP;
      if(hpRatio < 0.30) baseDmg = Math.floor(baseDmg * 1.25);
      else if(hpRatio < 0.50) baseDmg = Math.floor(baseDmg * 1.10);
    }
    // === 逆袭加成：血量落后对手越多，伤害越高 ===
    if(atkHP !== undefined && atkMaxHP && defHP !== undefined && defMaxHP) {
      const myRatio = atkHP / atkMaxHP;
      const enemyRatio = defHP / defMaxHP;
      const gap = enemyRatio - myRatio;
      if(gap > 0.30) baseDmg = Math.floor(baseDmg * 1.20);
      else if(gap > 0.15) baseDmg = Math.floor(baseDmg * 1.10);
    }
    // === 暴击：12%几率，1.5-1.8倍（降低爆发）===
    const isCrit = !isComboAttack && _pkRng() < 0.12;
    let finalDmg;
    if(isCrit) {
      const critMult = 1.5 + _pkRng() * 0.3;
      finalDmg = Math.floor(baseDmg * critMult);
    } else if(isComboAttack) {
      finalDmg = Math.floor(baseDmg * 0.75);
    } else {
      finalDmg = baseDmg;
    }
    // === 单次伤害封顶：不超过防守方最大HP的32% ===
    const dmgCap = Math.floor(defMaxHP * 0.32);
    finalDmg = Math.min(finalDmg, dmgCap);
    defHP -= finalDmg;
    await new Promise(resolve => {
      let resolved = false;
      const safeResolve = () => { if(!resolved) { resolved = true; resolve(); } };
      playSkillAttack(atkImg, defImg, isCrit, skill, safeResolve);
      setTimeout(safeResolve, 3000); // 安全超时：3秒后强制继续
    });
    defImg.classList.add('hit-flash');
    showDamageNumber(defImg, finalDmg, isCrit, isComboAttack);
    showAttackDamageText(atkImg, finalDmg, isCrit, isComboAttack);
    updateHPBar(defSide, defHP, defMaxHP);
    if(isCrit && arena) { arena.classList.add('screen-shake'); setTimeout(() => arena.classList.remove('screen-shake'), 500); }
    setTimeout(() => { atkImg.classList.remove(atkSide === 1 ? 'attack-lunge-right' : 'attack-lunge-left'); defImg.classList.remove('hit-flash'); }, 400);
    return { hp: defHP, isCrit, dodged: false, dmgDealt: finalDmg };
  }
  // 主战斗循环（最多5回合，通常3-5回合结束）
  while(p1HP > 0 && p2HP > 0 && turn < 5) {
    turn++;
    await sleep(400);
    // 后期加速：turn2后伤害快速提升（每回合+18%，封顶+54%）
    const escalation = turn >= 2 ? 1.0 + Math.min((turn - 1) * 0.18, 0.54) : 1.0;
    // 每回合随机决定先手
    const p1First = _pkRng() < 0.5;
    const firstAtk = p1First ? {img:img1, defImg:img2, side:1, defSide:2, pet:p1.pet, name:p1.studentName}
                              : {img:img2, defImg:img1, side:2, defSide:1, pet:p2.pet, name:p2.studentName};
    const secondAtk = p1First ? {img:img2, defImg:img1, side:2, defSide:1, pet:p2.pet, name:p2.studentName}
                               : {img:img1, defImg:img2, side:1, defSide:2, pet:p1.pet, name:p1.studentName};
    const firstTargetHP = p1First ? p2HP : p1HP;
    const firstTargetMaxHP = p1First ? p2MaxHP : p1MaxHP;
    const secondTargetHP = p1First ? p1HP : p2HP;
    const secondTargetMaxHP = p1First ? p1MaxHP : p2MaxHP;
    const firstAtkHP = p1First ? p1HP : p2HP;
    const firstAtkMaxHP = p1First ? p1MaxHP : p2MaxHP;
    const secondAtkHP = p1First ? p2HP : p1HP;
    const secondAtkMaxHP = p1First ? p2MaxHP : p1MaxHP;
    // === 先手攻击 ===
    const r1 = await doAttack(1, firstAtk.img, firstAtk.defImg, firstAtk.side, firstAtk.defSide, firstTargetHP, firstTargetMaxHP, firstAtk.pet, firstAtk.name, escalation, false, firstAtkHP, firstAtkMaxHP);
    if(p1First) { p2HP = r1.hp; } else { p1HP = r1.hp; }
    if(p1HP <= 0 || p2HP <= 0) break;
    
    // === 反击！先手攻击造成>22%最大HP伤害时，防守方40%几率立即反击 ===
    if(!r1.dodged && r1.dmgDealt > firstTargetMaxHP * 0.22 && _pkRng() < 0.40) {
      await sleep(600);
      if(arena){const a=document.createElement('div');a.className='skill-announce';a.innerHTML='💥反击!';a.style.color='#ff55aa';a.style.textShadow='0 0 20px rgba(255,100,200,0.9),0 0 60px rgba(200,50,150,0.6),2px 2px 0 #550033';arena.appendChild(a);setTimeout(()=>a.remove(),1200);}
      await sleep(400);
      // 防守方反击（防守方=先手的对手发起反击）
      const counterPet1 = p1First ? p2.pet : p1.pet;
      const counterName1 = p1First ? p2.studentName : p1.studentName;
      if(p1First) {
        const rc = await doAttack(2, firstAtk.defImg, firstAtk.img, 2, 1, p1HP, p1MaxHP, counterPet1, counterName1, 0.8, false, p2HP, p2MaxHP);
        p1HP = rc.hp;
      } else {
        const rc = await doAttack(1, firstAtk.defImg, firstAtk.img, 1, 2, p2HP, p2MaxHP, counterPet1, counterName1, 0.8, false, p1HP, p1MaxHP);
        p2HP = rc.hp;
      }
      if(p1HP <= 0 || p2HP <= 0) break;
    }
    
    // 连击！15%几率触发额外攻击
    if(!r1.isCrit && !r1.dodged && _pkRng() < 0.15) {
      await sleep(500);
      if(arena){const a=document.createElement('div');a.className='skill-announce';a.textContent='⚡连击!';a.style.color='#ff9900';arena.appendChild(a);setTimeout(()=>a.remove(),1200);}
      if(p1First){
        const r=await doAttack(1,firstAtk.img,firstAtk.defImg,firstAtk.side,firstAtk.defSide,p2HP,p2MaxHP,firstAtk.pet,firstAtk.name,escalation,true,p1HP,p1MaxHP);
        p2HP=r.hp;
      } else {
        const r=await doAttack(2,firstAtk.img,firstAtk.defImg,firstAtk.side,firstAtk.defSide,p1HP,p1MaxHP,firstAtk.pet,firstAtk.name,escalation,true,p2HP,p2MaxHP);
        p1HP=r.hp;
      }
      if(p1HP <= 0 || p2HP <= 0) break;
    }
    await sleep(500);
    // === 后手攻击 ===
    const r2 = await doAttack(2, secondAtk.img, secondAtk.defImg, secondAtk.side, secondAtk.defSide, secondTargetHP, secondTargetMaxHP, secondAtk.pet, secondAtk.name, escalation, false, secondAtkHP, secondAtkMaxHP);
    if(p1First) { p1HP = r2.hp; } else { p2HP = r2.hp; }
    if(p1HP <= 0 || p2HP <= 0) break;
    
    // === 反击！后手攻击造成大伤害时，防守方40%几率反击 ===
    if(!r2.dodged && r2.dmgDealt > secondTargetMaxHP * 0.22 && _pkRng() < 0.40) {
      await sleep(600);
      if(arena){const a=document.createElement('div');a.className='skill-announce';a.innerHTML='💥反击!';a.style.color='#ff55aa';a.style.textShadow='0 0 20px rgba(255,100,200,0.9),0 0 60px rgba(200,50,150,0.6),2px 2px 0 #550033';arena.appendChild(a);setTimeout(()=>a.remove(),1200);}
      await sleep(400);
      // 防守方反击（后手防守方=后手的对手发起反击）
      const counterPet2 = p1First ? p1.pet : p2.pet;
      const counterName2 = p1First ? p1.studentName : p2.studentName;
      if(p1First) {
        const rc = await doAttack(1, secondAtk.defImg, secondAtk.img, 1, 2, p2HP, p2MaxHP, counterPet2, counterName2, 0.8, false, p1HP, p1MaxHP);
        p2HP = rc.hp;
      } else {
        const rc = await doAttack(2, secondAtk.defImg, secondAtk.img, 2, 1, p1HP, p1MaxHP, counterPet2, counterName2, 0.8, false, p2HP, p2MaxHP);
        p1HP = rc.hp;
      }
      if(p1HP <= 0 || p2HP <= 0) break;
    }
    
    // 后手连击
    if(!r2.isCrit && !r2.dodged && _pkRng() < 0.15) {
      await sleep(500);
      if(arena){const a=document.createElement('div');a.className='skill-announce';a.textContent='⚡连击!';a.style.color='#ff9900';arena.appendChild(a);setTimeout(()=>a.remove(),1200);}
      if(p1First){
        const r=await doAttack(2,secondAtk.img,secondAtk.defImg,secondAtk.side,secondAtk.defSide,p1HP,p1MaxHP,secondAtk.pet,secondAtk.name,escalation,true,p2HP,p2MaxHP);
        p1HP=r.hp;
      } else {
        const r=await doAttack(1,secondAtk.img,secondAtk.defImg,secondAtk.side,secondAtk.defSide,p2HP,p2MaxHP,secondAtk.pet,secondAtk.name,escalation,true,p1HP,p1MaxHP);
        p2HP=r.hp;
      }
      if(p1HP <= 0 || p2HP <= 0) break;
    }
  }
  // 若5回合仍未结束，HP少的一方直接败北（避免超持久战）
  if(p1HP > 0 && p2HP > 0) {
    if(p1HP/p1MaxHP < p2HP/p2MaxHP) { p1HP = 0; }
    else { p2HP = 0; }
  }
  await sleep(800);
  // === 战斗结果 ===
  const winnerStudent = (p2HP <= 0) ? student1 : student2;
  const loserStudent = (p2HP <= 0) ? student2 : student1;
  const winnerPet = (p2HP <= 0) ? p1.pet : p2.pet;
  const loserPet = (p2HP <= 0) ? p2.pet : p1.pet;
  const winnerSide = (p2HP <= 0) ? 1 : 2;
  let rewardCoin = 0;
  let penaltyCoin = 0;
  // 构建结果覆盖层
  const resultOverlay = document.createElement('div');
  resultOverlay.className = 'pk-result-overlay';
  if(p1HP <= 0 && p2HP <= 0) {
    resultOverlay.innerHTML = `<div class="pk-result-draw">平局</div><div class="pk-result-detail">双方势均力敌，无人获得金币奖励</div>`;
    showNotification('战斗平局', '双方都没有获得金币', 'info');
    // 记录平局（双方各一条）
    recordAction(student1.id, student1.name, 'PK平局', `${student1.name} vs ${student2.name} 平局`, 0, 0, p1.pet.id, {pkType:'draw', opponentId: student2.id, opponentName: student2.name});
    recordAction(student2.id, student2.name, 'PK平局', `${student2.name} vs ${student1.name} 平局`, 0, 0, p2.pet.id, {pkType:'draw', opponentId: student1.id, opponentName: student1.name});
  } else {
    rewardCoin = 15;
    penaltyCoin = -5;
    winnerStudent.coins += rewardCoin;
    loserStudent.coins += penaltyCoin;
    if(loserStudent.coins < 0) loserStudent.coins = 0;
    // 成长值奖惩：胜者+3，败者-1
    const winnerPrevGrowth = winnerPet.growth || 0;
    const loserPrevGrowth = loserPet.growth || 0;
    winnerPet.growth = winnerPrevGrowth + 3;
    loserPet.growth = Math.max(0, loserPrevGrowth - 1);
    const winnerGrowthDelta = 3;
    const loserGrowthDelta = loserPet.growth - loserPrevGrowth;
    const winnerImg = document.getElementById(`pk-img-${winnerSide}`);
    if(winnerImg) { winnerImg.style.filter = 'drop-shadow(0 0 40px rgba(255,215,0,0.9)) drop-shadow(0 0 80px rgba(255,200,0,0.6))'; winnerImg.style.transition = 'filter 0.6s ease'; }
    // 败方碎裂特效
    const loserImgEl = document.getElementById(`pk-img-${winnerSide === 1 ? 2 : 1}`);
    if(loserImgEl) applyClassPKShatterEffect(loserImgEl);
    resultOverlay.innerHTML = `
      <div class="pk-result-title">${esc(winnerStudent.name)} 胜利</div>
      <div class="pk-result-detail">${esc(winnerPet.nickname||winnerPet.name)} 击败了 ${esc(loserPet.nickname||loserPet.name)}</div>
      <div class="pk-result-detail" style="margin-top:16px;color:#55ff55;">+${rewardCoin} 金币 · +3 成长值 → ${esc(winnerStudent.name)}</div>
      <div class="pk-result-detail" style="color:#ff6666;">${penaltyCoin} 金币 · -1 成长值 → ${esc(loserStudent.name)}</div>
    `;
    showNotification('战斗胜利', `${winnerStudent.name} 获得 ${rewardCoin} 金币，成长值+3！`, 'success');
    showNotification('战斗失败', `${loserStudent.name} 损失 ${-penaltyCoin} 金币，成长值-1！`, 'error');
    // 记录胜方
    recordAction(winnerStudent.id, winnerStudent.name, 'PK胜利', `击败 ${loserStudent.name}（${loserPet.nickname||loserPet.name}）`, rewardCoin, winnerGrowthDelta, winnerPet.id, {pkType:'win', opponentId: loserStudent.id, opponentName: loserStudent.name, opponentPetId: loserPet.id, opponentCoinDelta: penaltyCoin, opponentGrowthDelta: loserGrowthDelta});
    // 记录败方
    recordAction(loserStudent.id, loserStudent.name, 'PK失败', `败给 ${winnerStudent.name}（${winnerPet.nickname||winnerPet.name}）`, penaltyCoin, loserGrowthDelta, loserPet.id, {pkType:'lose', opponentId: winnerStudent.id, opponentName: winnerStudent.name, opponentPetId: winnerPet.id, opponentCoinDelta: rewardCoin, opponentGrowthDelta: winnerGrowthDelta});
    playVictorySound();
  }
  if(arena) arena.appendChild(resultOverlay);
  const today = new Date().toDateString();
  student1.pkCountToday = (student1.lastPkDate === today) ? student1.pkCountToday + 1 : 1;
  student1.lastPkDate = today;
  student2.pkCountToday = (student2.lastPkDate === today) ? student2.pkCountToday + 1 : 1;
  student2.lastPkDate = today;
  saveClassData();
  renderHomePetGrid();
  renderClassTopThree();
  renderPKPage();
  // Add a direct exit button inside the result overlay (pointer-events: auto)
  const resultExitBtn = document.createElement('button');
  resultExitBtn.className = 'pk-result-exit-btn';
  resultExitBtn.textContent = '退出';
  resultExitBtn.onclick = function() { closePKModal(); };
  resultOverlay.appendChild(resultExitBtn);
  // Show the body-level exit button (escapes all stacking contexts)
  _showPKExitButton();
  if(currentBattleModalOverlay) {
    const exitBtn = currentBattleModalOverlay.querySelector('.modal-actions button');
    if(exitBtn) exitBtn.disabled = false;
  }
  pkState.isFighting = false;
  pkState._battleCompleted = true; // Mark this battle as completed to prevent re-start
  // Clean up seeded RNG
  _pkBattleRng = null;
  _pkBattleLeftMonsterIdx = -1;
  _pkBattleRightMonsterIdx = -1;
  pkState.battleSeed = null;
}

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
