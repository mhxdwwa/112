function _historyActionIcon(type){
  const icons = {'喂食':'🍖','玩耍':'🎾','散步':'🚶','逛街':'🛍️','复活':'💖','奖惩':'🏅','惩罚致死':'💀','饿死':'💀','商店购买':'🏪','PK胜利':'⚔️🏆','PK失败':'⚔️💔','PK平局':'⚔️🤝','全班打卡':'📋','每日打卡':'📋','全班喂食':'🍖👥','批量奖惩':'📦','重置班级宠物':'🔄','删除宠物':'🐾🗑️','零食兑换':'🍭','小猪快跑':'🐷','取金阁':'📝','宠物消消乐':'🧩','快乐跑一跑':'🏃'};
  return icons[type]||'📝';
}
function _historyActionColor(type){
  if(type==='惩罚致死'||type==='饿死') return '#ff4444';
  if(type.includes('惩罚')||type==='PK失败') return '#e07050';
  if(type.includes('奖')||type==='PK胜利'||type==='全班打卡'||type==='每日打卡'||type==='小猪快跑'||type==='取金阁'||type==='宠物消消乐'||type==='快乐跑一跑') return '#4a9e4a';
  if(type==='PK平局') return '#8888aa';
  if(type==='复活') return '#9b59b6';
  if(type==='商店购买') return '#8e44ad';
  if(type==='重置班级宠物') return '#cc6633';
  if(type==='删除宠物') return '#c0392b';
  if(type==='零食兑换') return '#ff6b9d';
  return '#886655';
}
var _isStudentHistoryView = false; // true when a student is viewing history
var _historyExpandedDates = {}; // Track which date groups user has expanded: {dateKey: true}
 function showHistoryModal(){
  const curClass = classesData.find(c=>c.id===currentClassId);
  const className = curClass ? curClass.name : '未选择班级';
  // Detect if current user is a student
  _isStudentHistoryView = !!(typeof currentUser !== 'undefined' && currentUser && currentUser.type === 'student');

  // v104: Show modal IMMEDIATELY with cached/local data, then refresh in background
  // This eliminates the 2+ second wait for network calls before showing the modal
  _historyExpandedDates = {}; // Reset expand state on fresh open
  var showFn = function() {
    const months = getAvailableMonths();
    if(months.length===0){
      showModal(`📜 历史操作记录【${className}】`,
        '<div style="text-align:center;padding:30px;color:#bba;">该班级暂无操作记录</div>',
        [{text:'关闭',onclick:'closeModal()'}], false);
      return;
    }
    _currentHistoryMonth = months[0];
    let html = _buildHistoryHTML(curClass, className, months, _currentHistoryMonth);
    showModal(`📜 历史操作记录【${className}】`, html, [{text:'关闭',onclick:'closeModal()'}], true);
  };

  // v104: Show immediately with existing data (from window.operationLogs loaded at init)
  showFn();

  // v104: Then sync and refresh in background (non-blocking)
  // This ensures fresh data is loaded without blocking the UI
  // v182: Only refresh modal if there are remote logs newer than our local logs
  // This prevents unnecessary rebuild when user just performed an action locally
  var localLogTimeBefore = (typeof _lastLocalLogTime !== 'undefined') ? _lastLocalLogTime : '';
  
  var syncPromise = (typeof _writeUnsyncedLogsToSupabase === 'function')
    ? _writeUnsyncedLogsToSupabase()
    : Promise.resolve();

  syncPromise.then(function() {
    if (typeof _loadOperationLogs === 'function') {
      return _loadOperationLogs();
    }
  }).then(function() {
    // v182: Check if there are remote-only logs (from other devices)
    // If all logs are local (from this device), no need to refresh
    var logs = getOpLogs();
    var hasRemoteNewLog = false;
    for (var i = 0; i < logs.length; i++) {
      var l = logs[i];
      // Remote log: from Supabase, not optimistic, and newer than our last local log
      if (l._fromSupabase && !l._apiOptimistic && l.timestamp > localLogTimeBefore) {
        hasRemoteNewLog = true;
        break;
      }
    }
    
    if (hasRemoteNewLog) {
      // v104: Refresh the modal content with fresh data
      if (typeof _syncOpLogsAlias === 'function') { try { _syncOpLogsAlias(); } catch(e) {} }
      refreshHistoryModalIfOpen();
    }
  }).catch(function(e) {
    if (typeof _syncOpLogsAlias === 'function') { try { _syncOpLogsAlias(); } catch(e2) {} }
    console.warn('[History] Background refresh error:', e);
    refreshHistoryModalIfOpen();
  });
}
// v12: Refresh history modal content when it's open and new logs arrive (Realtime)
// v187: forceRebuild 参数 — 撤销操作时强制重建 HTML（日志数量不变但 reverted 状态变了）
function refreshHistoryModalIfOpen(forceRebuild){
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
    // === 增量更新优化：先检查日志数量是否变化，无变化则跳过 ===
    var newLogCount = getAllLogsForMonth(_currentHistoryMonth).filter(function(log) {
      if(log.classId) { if(log.classId.toString() !== (currentClassId || '').toString()) return false; }
      else if(curClass) { if(!curClass.students.some(function(s){return s.id.toString()===log.studentId.toString();})) return false; }
      else return false;
      if(_historyFilterEnabled && _historyFilterStudentId) {
        if(log.studentId.toString() !== _historyFilterStudentId.toString()) return false;
      }
      return true;
    }).length;
    var logList = contentEl.querySelector('#historyLogList');
    var existingCount = logList ? logList.children.length : -1;
    // v187: forceRebuild 时跳过数量检查，强制重建（撤销操作改变了按钮状态但数量不变）
    if (!forceRebuild && existingCount === newLogCount && newLogCount > 0) {
      // 只更新标题（月份/班级名可能变了）
      if(titleEl) titleEl.textContent = '\uD83D\uDCDC 历史操作记录【' + className + '】';
      return;
    }
    // 数量变了，需要重建（新增/撤销了日志）
    // 保存滚动位置
    var savedScrollTop = logList ? logList.scrollTop : 0;
    // 重建内容
    contentEl.innerHTML = _buildHistoryHTML(curClass, className, months, _currentHistoryMonth);
    // 恢复滚动位置（使用 requestAnimationFrame 确保 DOM 已更新）
    var newLogList = contentEl.querySelector('#historyLogList');
    if(newLogList) {
      requestAnimationFrame(function() {
        newLogList.scrollTop = savedScrollTop;
      });
    }
  }
  // Also update the title to reflect latest data
  if(titleEl) titleEl.textContent = '\uD83D\uDCDC 历史操作记录【' + className + '】';
}
function switchHistoryMonth(month){
  _currentHistoryMonth = month;
  _historyExpandedDates = {}; // Reset expand state when switching months
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
  html += '<div style="display:flex;align-items:center;gap:6px;margin-bottom:10px;">';
  html += '<input type="checkbox" id="historyFilterCheck" ' + (_historyFilterEnabled ? 'checked' : '') + ' onchange="toggleHistoryFilter(this.checked)" style="width:16px;height:16px;cursor:pointer;">';
  html += '<button onclick="showHistoryStudentFilter()" style="padding:4px 12px;border-radius:14px;border:1.5px solid ' + (_historyFilterEnabled && _historyFilterStudentId ? '#52c41a' : '#e0d0c8') + ';background:' + (_historyFilterEnabled && _historyFilterStudentId ? '#f0fff0' : '#fff8f5') + ';color:' + (_historyFilterEnabled && _historyFilterStudentId ? '#389e0d' : '#886') + ';font-size:12px;cursor:pointer;transition:all 0.2s;">筛选' + (_historyFilterStudentId ? '：' + esc(_getHistoryFilterStudentName()) : '') + '</button>';
  if (_historyFilterEnabled && _historyFilterStudentId) {
    html += '<button onclick="clearHistoryFilter()" style="padding:2px 8px;border-radius:10px;border:1px solid #ffcccc;background:#fff5f5;color:#cc5555;font-size:11px;cursor:pointer;">✕ 清除</button>';
  }
  // v156: 一键清空历史记录按钮
  if(!_isStudentHistoryView) {
    html += '<button onclick="clearAllHistoryLogs()" style="margin-left:auto;padding:4px 12px;border-radius:14px;border:1.5px solid #ffcccc;background:#fff5f5;color:#cc5555;font-size:12px;cursor:pointer;transition:all 0.2s;">🗑️ 一键清空</button>';
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
  
  // v68: Group logs by date for lazy loading
  const logsByDate = {};
  classLogs.forEach(log => {
    const dateKey = log.timestamp.slice(0, 10); // YYYY-MM-DD
    if (!logsByDate[dateKey]) logsByDate[dateKey] = [];
    logsByDate[dateKey].push(log);
  });
  
  // Sort dates descending
  const sortedDates = Object.keys(logsByDate).sort().reverse();
  
  html += '<div id="historyLogList" style="max-height:400px;overflow:auto;">';
  
  sortedDates.forEach((dateKey, idx) => {
    const dateLogs = logsByDate[dateKey];
    const date = new Date(dateKey);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    let dateLabel = date.toLocaleDateString('zh-CN', {month: 'long', day: 'numeric', weekday: 'long'});
    if (dateKey === today.toISOString().slice(0, 10)) dateLabel = '今天';
    else if (dateKey === yesterday.toISOString().slice(0, 10)) dateLabel = '昨天';
    
    // Only expand today by default, or respect user's previous expand state
    const isExpanded = _historyExpandedDates[dateKey] || (idx === 0 && !_historyExpandedDates.hasOwnProperty(dateKey));
    const logCount = dateLogs.length;
    
    html += `<div class="history-date-group" style="margin-bottom:12px;">`;
    html += `<div class="history-date-header" onclick="toggleDateGroup('${dateKey}')" style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:linear-gradient(135deg,#f8f4ff,#f0e8ff);border-radius:10px;cursor:pointer;user-select:none;border:1px solid #e8d8f0;">`;
    html += `<span class="history-date-arrow" id="arrow-${dateKey}" style="transition:transform 0.2s;${isExpanded ? 'transform:rotate(90deg);' : ''}">▶</span>`;
    html += `<strong style="color:#6b4db0;font-size:14px;">${dateLabel}</strong>`;
    html += `<span style="background:#e8d8f0;color:#6b4db0;padding:2px 8px;border-radius:8px;font-size:11px;font-weight:600;">${logCount} 条</span>`;
    html += `</div>`;
    
    html += `<div class="history-date-content" id="content-${dateKey}" style="display:${isExpanded ? 'block' : 'none'};margin-top:8px;">`;
    if (isExpanded) {
      dateLogs.forEach(log => {
        html += _buildHistoryLogItem(log, isCurrentMonth, isStudentView);
      });
    } else {
      html += `<div style="text-align:center;padding:12px;color:#aaa;font-size:12px;">点击展开查看 ${logCount} 条记录</div>`;
    }
    html += `</div>`;
    html += `</div>`;
  });
  
  html += '</div>';
  return html;
}

// v68: Toggle date group expansion
function toggleDateGroup(dateKey) {
  const content = document.getElementById('content-' + dateKey);
  const arrow = document.getElementById('arrow-' + dateKey);
  if (!content) return;
  
  const isHidden = content.style.display === 'none';
  if (isHidden) {
    content.style.display = 'block';
    if (arrow) arrow.style.transform = 'rotate(90deg)';
    _historyExpandedDates[dateKey] = true; // Track expanded state
    
    // Lazy load: if content is placeholder, render actual logs
    if (content.children.length === 1 && content.children[0].textContent.includes('点击展开')) {
      const curClass = classesData.find(c => c.id === currentClassId);
      const activeMonth = _currentHistoryMonth;
      const allLogs = getAllLogsForMonth(activeMonth);
      const dateLogs = allLogs.filter(log => {
        if (log.timestamp.slice(0, 10) !== dateKey) return false;
        if(log.classId) { if(log.classId.toString() !== (currentClassId || '').toString()) return false; }
        else if(curClass) { if(!curClass.students.some(s=>s.id.toString()===log.studentId.toString())) return false; }
        else return false;
        if(_historyFilterEnabled && _historyFilterStudentId) {
          if(log.studentId.toString() !== _historyFilterStudentId.toString()) return false;
        }
        return true;
      });
      
      const curMonth = _getCurrentMonth();
      const isCurrentMonth = (activeMonth === curMonth);
      const isStudentView = _isStudentHistoryView;
      
      let html = '';
      dateLogs.forEach(log => {
        html += _buildHistoryLogItem(log, isCurrentMonth, isStudentView);
      });
      content.innerHTML = html;
    }
  } else {
    content.style.display = 'none';
    if (arrow) arrow.style.transform = 'rotate(0deg)';
    delete _historyExpandedDates[dateKey]; // Track collapsed state
  }
}

// v68: Build single log item HTML (extracted for reuse)
function _buildHistoryLogItem(log, isCurrentMonth, isStudentView) {
  const time = new Date(log.timestamp);
  const timeStr = time.toLocaleDateString('zh-CN',{month:'2-digit',day:'2-digit'}) + ' ' + time.toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
  const icon = _historyActionIcon(log.actionType);
  const color = _historyActionColor(log.actionType);
  const isReverted = log.reverted;
  const snap = log.snapshot;
  let coinLine = '';
  if(log.coinDelta !== 0){
    const sign = log.coinDelta > 0 ? '+' : '';
    coinLine = `<span style="color:${log.coinDelta>0?'#4a9e4a':'#cc5544'};font-weight:600;">💰${sign}${log.coinDelta}</span>`;
    if(snap) coinLine += `<span style="color:#aaa;margin-left:4px;">(${snap.coinsBefore}→${snap.coinsAfter})</span>`;
  }
  let expLine = '';
  if(log.expDelta !== 0){
    const sign = log.expDelta > 0 ? '+' : '';
    expLine = `<span style="color:${log.expDelta>0?'#4a9e4a':'#cc5544'};font-weight:600;margin-left:8px;">🌱${sign}${log.expDelta}</span>`;
    if(snap) expLine += `<span style="color:#aaa;margin-left:4px;">(${snap.growthBefore}→${snap.growthAfter})</span>`;
  }
  let petInfo = '';
  if(snap && snap.petNick){
    petInfo = `<span style="background:#fff0e8;padding:1px 8px;border-radius:8px;font-size:11px;margin-left:6px;">🐾 ${esc(snap.petNick)} Lv.${snap.petLevel}${snap.stageName?' · '+esc(snap.stageName):''}</span>`;
  }
  let extraInfo = '';
  if(log.extra){
    if(log.extra.causedDeath) extraInfo += '<span style="color:#ff3333;font-weight:700;margin-left:6px;">⚠️ 宠物死亡！</span>';
    if(log.extra.pkType === 'win') extraInfo += `<span style="margin-left:6px;font-size:12px;">🎯 对手: ${esc(log.extra.opponentName)}（金币${log.extra.opponentCoinDelta}，成长${log.extra.opponentGrowthDelta>=0?'+':''}${log.extra.opponentGrowthDelta}）</span>`;
    if(log.extra.pkType === 'lose') extraInfo += `<span style="margin-left:6px;font-size:12px;">🎯 胜者: ${esc(log.extra.opponentName)}</span>`;
    if(log.extra.pkType === 'draw') extraInfo += `<span style="margin-left:6px;font-size:12px;">🤝 对手: ${esc(log.extra.opponentName)}</span>`;
  }
  if(snap && snap.isDead && !log.extra?.causedDeath) extraInfo += '<span style="color:#999;margin-left:6px;font-size:11px;">（宠物已死亡）</span>';
  if(snap && snap.penaltyStreak >= 2 && !log.extra?.causedDeath) extraInfo += `<span style="color:#ee6633;margin-left:6px;font-size:11px;">⚠ 连续惩罚${snap.penaltyStreak}次</span>`;
  const opacity = isReverted ? 'opacity:0.45;' : '';
  const revertedBadge = isReverted ? '<span style="background:#ffcc00;color:#665500;padding:1px 6px;border-radius:6px;font-size:10px;font-weight:700;margin-left:6px;">已撤销</span>' : (log.extra && log.extra._restored ? '<span style="background:#4caf50;color:#fff;padding:1px 6px;border-radius:6px;font-size:10px;font-weight:700;margin-left:6px;">已恢复</span>' : '');
  let btnHtml = '';
  // Only teachers can revoke operations; students cannot
  if(!isReverted && isCurrentMonth && !isStudentView){
    btnHtml = `<button class="btn btn-secondary" style="padding:5px 14px;font-size:13px;flex-shrink:0;" onclick="if(confirm('确定撤销「${esc(log.studentName)} · ${esc(log.actionType)}」？此操作将还原数据变更。')){revertToLog(${JSON.stringify(log.id)});closeModal();}">撤销</button>`;
    // v119: Show "恢复删除宠物" button for "删除宠物" logs (before "恢复到此")
    if(log.actionType === '删除宠物' && log.extra && log.extra.deletedPetSnapshot && !log.extra._restored){
      btnHtml = `<button class="btn btn-secondary" style="padding:5px 12px;font-size:12px;flex-shrink:0;background:#fff3e0;color:#e65100;border-color:#ffcc80;margin-right:6px;" onclick="if(confirm('确定恢复被删除的宠物「${esc(log.extra.deletedPetSnapshot.nickname||log.extra.deletedPetSnapshot.name)}」？将恢复到删除时的状态。')){restoreDeletedPet(${JSON.stringify(log.id)});}">恢复删除宠物</button>` + btnHtml;
    }
    // v46: Show "恢复到此" button for all logs with snapshot
    if(snap && (snap.coinsAfter !== undefined || snap.quizStateSnapshot)) btnHtml = `<button class="btn btn-secondary" style="padding:5px 12px;font-size:12px;flex-shrink:0;background:#e8f5e9;color:#2e7d32;border-color:#a5d6a7;margin-right:6px;" onclick="restoreToLogEntry(${JSON.stringify(log.id)})">恢复到此</button>` + btnHtml;
  }
  return `<div class="history-log-item ${isReverted?'history-reverted':''}" style="${opacity}border-left:3px solid ${color};padding-left:14px;margin-bottom:8px;">
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
    // 恢复滚动位置（使用 requestAnimationFrame 确保 DOM 已更新）
    var newLogList = container.querySelector('#historyLogList');
    if(newLogList) {
      requestAnimationFrame(function() {
        newLogList.scrollTop = savedScrollTop;
      });
    }
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
    html += '<span style="font-weight:600;">' + esc(stu.name || '未命名') + '</span>';
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

// v156: 一键清空历史记录
window.clearAllHistoryLogs = function() {
  if(!confirm('确定要清空所有历史记录吗？\n\n此操作将：\n1. 清空本地所有操作日志\n2. 清空服务器上的操作日志\n3. 从此刻起重新开始记录\n\n此操作不可恢复！')) {
    return;
  }
  
  // 清空本地日志
  window.operationLogs = [];
  if(typeof saveLogs === 'function') saveLogs();
  
  // v156: 清空服务器日志
  if(window.USE_API && window.ApiMigration && window.ApiMigration.clearLogs) {
    window.ApiMigration.clearLogs(currentClassId).then(function(result) {
      if(result.ok) {
        showNotification('清空成功', '所有历史记录已清空', 'success');
        refreshHistoryModalIfOpen();
      } else {
        showNotification('清空失败', result.error || '未知错误', 'error');
      }
    }).catch(function(err) {
      console.error('[History] Clear logs error:', err);
      showNotification('清空失败', '网络错误', 'error');
    });
  } else {
    showNotification('清空成功', '本地历史记录已清空', 'success');
    refreshHistoryModalIfOpen();
  }
};
