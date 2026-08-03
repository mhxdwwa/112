// match3.js v15 — 宠物消消乐
// CDN: https://mhxdwwa.oss-cn-shenzhen.aliyuncs.com/images/
(function() {
'use strict';

var CDN_BASE = 'https://mhxdwwa.oss-cn-shenzhen.aliyuncs.com/images/';
var TILE_TYPES = [
  { name: '小狗', path: CDN_BASE + '%E5%B0%8F%E7%8B%97.png' },
  { name: '兔子', path: CDN_BASE + '%E5%85%94%E5%AD%90.png' },
  { name: '小熊', path: CDN_BASE + '%E5%B0%8F%E7%86%8A.png' },
  { name: '熊猫', path: CDN_BASE + '%E7%86%8A%E7%8C%AB.png' },
  { name: '考拉', path: CDN_BASE + '%E8%80%83%E6%8B%89.png' },
  { name: '老虎', path: CDN_BASE + '%E8%80%81%E8%99%8E.png' },
  { name: '奶牛', path: CDN_BASE + '%E5%A5%B6%E7%89%9B.png' },
  { name: '狐狸', path: CDN_BASE + '%E7%8B%90%E7%8B%B8.png' }
];
var TILE_SIZE = 50;
var MAX_SLOTS = 5;

var _m3Tiles = [];
var _m3Selected = [];
var _m3Score = 0;
var _m3MoveHistory = [];
var _m3CurrentLevel = 1;
var _m3StartTime = 0;
var _m3BlocksCleared = 0;
var _m3AudioCtx = null;
var _m3Container = null;
var _m3CurrentStudent = null;
var _m3GameActive = false;

// 道具会话追踪（跨关卡累计，每局游戏会话限制）
var _m3SessionToolsUsed = { shuffle: 0, undo: 0 };

// 计时器与暂停
var _m3Timer = null;
var _m3TimeSeconds = 0;
var _m3Paused = false;

// ===== 背景音乐（BGM）=====
var M3_BGM_URLS = [
  'https://mhxdwwa.oss-cn-shenzhen.aliyuncs.com/music/1.mp3',
  'https://mhxdwwa.oss-cn-shenzhen.aliyuncs.com/music/2.mp3',
  'https://mhxdwwa.oss-cn-shenzhen.aliyuncs.com/music/3.mp3',
  'https://mhxdwwa.oss-cn-shenzhen.aliyuncs.com/music/4.mp3'
];
var _m3BgmAudio = null;
var _m3BgmIndex = 0;
var _m3BgmEnabled = false; // 初始静音，不加载音频

function _m3InitBGM() {
  if (_m3BgmAudio) {
    _m3BgmAudio.pause();
    _m3BgmAudio.removeEventListener('ended', _m3OnBGMEnded);
  }
  _m3BgmAudio = new Audio(M3_BGM_URLS[_m3BgmIndex]);
  _m3BgmAudio.volume = 0.4;
  _m3BgmAudio.addEventListener('ended', _m3OnBGMEnded);
}
function _m3OnBGMEnded() {
  _m3BgmIndex = (_m3BgmIndex + 1) % M3_BGM_URLS.length;
  setTimeout(function() {
    if (_m3BgmEnabled && _m3BgmAudio) {
      _m3BgmAudio.src = M3_BGM_URLS[_m3BgmIndex];
      _m3BgmAudio.play().catch(function() {});
    }
  }, 15000);
}
function _m3StartBGM() {
  if (!_m3BgmEnabled) return; // 初始静音状态，不加载音频
  if (!_m3BgmAudio) _m3InitBGM();
  _m3BgmAudio.play().catch(function() {});
}
function _m3StopBGM() {
  if (_m3BgmAudio) _m3BgmAudio.pause();
}
function _m3ToggleBGM() {
  _m3BgmEnabled = !_m3BgmEnabled;
  if (_m3BgmEnabled) {
    if (!_m3BgmAudio) _m3InitBGM();
    _m3BgmAudio.play().catch(function() {});
  } else {
    if (_m3BgmAudio) _m3BgmAudio.pause();
  }
  return _m3BgmEnabled;
}
window._stopMatch3BGM = _m3StopBGM;

// ===== 计时器 =====
function _m3FormatTime(s) {
  var m = Math.floor(s / 60).toString().padStart(2, '0');
  var sec = (s % 60).toString().padStart(2, '0');
  return m + ':' + sec;
}
function _m3StartTimer() {
  if (_m3Timer) clearInterval(_m3Timer);
  _m3TimeSeconds = 0;
  var timeEl = document.getElementById('m3TimeDisplay');
  if (timeEl) timeEl.textContent = '00:00';
  _m3Timer = setInterval(function() {
    if (!_m3Paused) {
      _m3TimeSeconds++;
      var timeEl = document.getElementById('m3TimeDisplay');
      if (timeEl) timeEl.textContent = _m3FormatTime(_m3TimeSeconds);
    }
  }, 1000);
}
function _m3StopTimer() {
  if (_m3Timer) { clearInterval(_m3Timer); _m3Timer = null; }
}
function _m3TogglePause() {
  _m3Paused = !_m3Paused;
  var pauseBtn = document.getElementById('m3PauseBtn');
  var pauseMask = document.getElementById('m3PauseMask');
  if (_m3Paused) {
    if (pauseBtn) pauseBtn.textContent = '▶';
    if (pauseMask) pauseMask.classList.add('show');
  } else {
    if (pauseBtn) pauseBtn.textContent = '⏸';
    if (pauseMask) pauseMask.classList.remove('show');
  }
}

// ===== 获取当前学生 =====
function getCurrentStudent() {
  var isStudentView = typeof currentUser !== 'undefined' && currentUser && currentUser.type === 'student';
  if (isStudentView) {
    var myStudentId = parseInt(currentUser.studentId);
    var myClassId = parseInt(localStorage.getItem('classId') || currentUser.classId || 0);
    if (!myStudentId || !myClassId) return null;
    var cur = classesData.find(function(c) { return c.id === myClassId || c.id.toString() === myClassId.toString(); });
    if (!cur) return null;
    return cur.students.find(function(s) { return s.id.toString() === myStudentId.toString(); });
  } else {
    if (!window._teacherPlayingAsStudent) return null;
    var cid = (typeof currentClassId !== 'undefined') ? currentClassId : parseInt(localStorage.getItem('classId'));
    if (!cid || !classesData) return null;
    var cls = classesData.find(function(c) { return c.id === cid || c.id.toString() === cid.toString(); });
    if (!cls) return null;
    return cls.students.find(function(s) { return s.id.toString() === window._teacherPlayingAsStudent.toString(); });
  }
}

// ===== 状态管理 =====
function ensureMatch3State(student) {
  if (!student.quizState) student.quizState = {};
  if (!student.quizState.match3Levels) student.quizState.match3Levels = {};
  if (!student.quizState.match3TotalScore) student.quizState.match3TotalScore = 0;
  if (!student.quizState.match3Tools) student.quizState.match3Tools = { shuffle: 1, undo: 1 };
  return student.quizState;
}

function recalcMatch3TotalScore(student) {
  var qs = student.quizState || {};
  var levels = qs.match3Levels || {};
  var total = 0;
  Object.keys(levels).forEach(function(k) {
    total += levels[k].bestScore || 0;
  });
  qs.match3TotalScore = total;
  return total;
}

// ===== 音频 =====
function _m3InitAudio() {
  if (!_m3AudioCtx) {
    try { _m3AudioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) {}
  }
}
function _m3PlayTone(freq, dur, type, vol) {
  _m3InitAudio();
  if (!_m3AudioCtx) return;
  var osc = _m3AudioCtx.createOscillator();
  var gain = _m3AudioCtx.createGain();
  osc.connect(gain); gain.connect(_m3AudioCtx.destination);
  osc.type = type || 'sine';
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(vol || 0.2, _m3AudioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, _m3AudioCtx.currentTime + dur);
  osc.start(_m3AudioCtx.currentTime);
  osc.stop(_m3AudioCtx.currentTime + dur);
}
function _m3SoundClick() { _m3PlayTone(800, 0.1, 'sine', 0.3); }
function _m3SoundMatch() { [523,659,784].forEach(function(f,i){ setTimeout(function(){_m3PlayTone(f,0.15,'triangle',0.25);},i*80); }); }
function _m3SoundWin() { [523,659,784,1047].forEach(function(f,i){ setTimeout(function(){_m3PlayTone(f,0.4,'sine',0.2);},i*100); }); }
function _m3SoundFail() { _m3PlayTone(200, 0.5, 'sawtooth', 0.15); }

// ===== 关卡配置（无限关卡）=====
function _m3GetLevelConfig(level) {
  var baseLayers = 7;
  var extraLayers = Math.min(Math.floor((level - 1) / 2), 6);
  var totalLayers = baseLayers + extraLayers;
  var layerSizes = [];
  for (var i = 0; i < totalLayers; i++) {
    layerSizes.push(4 + (i % 2));
  }
  var availableTypes = Math.min(4 + Math.floor((level - 1) / 8), 8);
  return { layers: totalLayers, layerSizes: layerSizes, typesToUse: TILE_TYPES.slice(0, availableTypes) };
}

// ===== 游戏模式：隐藏非游戏UI，聚焦游戏画面 =====
function _m3EnterGameMode() {
  var quizPage = document.getElementById('quiz-page');
  if (quizPage) quizPage.classList.add('m3-game-active');
}
function _m3ExitGameMode() {
  var quizPage = document.getElementById('quiz-page');
  if (quizPage) quizPage.classList.remove('m3-game-active');
}

// ===== 渲染关卡选择 =====
function renderMatch3Page() {
  var container = document.getElementById('match3Content');
  if (!container) return;
  _m3Container = container;
  _m3ExitGameMode();
  var isStudentView = typeof currentUser !== 'undefined' && currentUser && currentUser.type === 'student';

  if (!isStudentView) {
    if (window._teacherPlayingAsStudent && window._match3ModalShown) {
      var student = getCurrentStudent();
      if (student) {
        _m3CurrentStudent = student;
        renderMatch3LevelSelect(container, student);
      } else {
        window._teacherPlayingAsStudent = null;
        window._match3ModalShown = false;
        container.innerHTML = (typeof renderTeacherPlaceholder === 'function')
          ? renderTeacherPlaceholder('match3')
          : '<div style="text-align:center;padding:40px;"><div style="font-size:60px;">🧩</div><div style="font-size:18px;font-weight:700;margin-top:12px;">宠物消消乐</div><div style="font-size:14px;color:#888;margin-top:8px;">正在选取参赛学生...</div></div>';
      }
    } else {
      container.innerHTML = (typeof renderTeacherPlaceholder === 'function')
        ? renderTeacherPlaceholder('match3')
        : '<div style="text-align:center;padding:40px;"><div style="font-size:60px;">🧩</div><div style="font-size:18px;font-weight:700;margin-top:12px;">宠物消消乐</div><div style="font-size:14px;color:#888;margin-top:8px;">正在选取参赛学生...</div></div>';
    }
    return;
  }

  var student = getCurrentStudent();
  if (!student) {
    container.innerHTML = '<div style="text-align:center;padding:40px;">未找到你的学生信息</div>';
    return;
  }
  _m3CurrentStudent = student;
  renderMatch3LevelSelect(container, student);
}
window.renderMatch3Page = renderMatch3Page;

function renderMatch3LevelSelect(container, student) {
  var qs = ensureMatch3State(student);
  var levels = qs.match3Levels || {};
  var totalScore = qs.match3TotalScore || 0;

  // 计算已通关数和最高通关关卡
  var clearedCount = 0;
  var maxClearedLevel = 0;
  var totalCoins = 0;
  Object.keys(levels).forEach(function(k) {
    if (levels[k] && levels[k].cleared) {
      clearedCount++;
      if (parseInt(k) > maxClearedLevel) maxClearedLevel = parseInt(k);
    }
    totalCoins += (levels[k] && levels[k].coinsEarned) || 0;
  });

  // 下一关 = maxClearedLevel + 1（第一关始终可玩）
  var nextLevel = maxClearedLevel + 1;

  var html = '<div style="text-align:center;padding:15px;">';
  html += '<div style="font-size:36px;">🧩</div>';
  html += '<div style="font-size:18px;font-weight:700;margin:8px 0;">宠物消消乐</div>';
  html += '<div style="display:flex;justify-content:center;gap:20px;margin-top:8px;">';
  html += '<div style="text-align:center;"><div style="font-size:18px;font-weight:700;color:#667eea;">' + clearedCount + '</div><div style="font-size:11px;color:#888;">已通关</div></div>';
  html += '<div style="text-align:center;"><div style="font-size:18px;font-weight:700;color:#d4a017;">' + totalScore + '</div><div style="font-size:11px;color:#888;">总分</div></div>';
  html += '<div style="text-align:center;"><div style="font-size:18px;font-weight:700;color:#f5a623;">' + totalCoins + '</div><div style="font-size:11px;color:#888;">累计金币</div></div>';
  html += '</div>';
  html += '</div>';

  // 关卡网格（无限关卡，显示到 maxClearedLevel + 10）
  var showLevels = Math.max(nextLevel + 9, 20);
  html += '<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px;padding:10px;max-height:400px;overflow-y:auto;">';
  for (var i = 1; i <= showLevels; i++) {
    var lv = levels[String(i)];
    var cleared = lv && lv.cleared;
    var score = lv ? (lv.bestScore || 0) : 0;
    var unlocked = (i === 1) || (i <= nextLevel); // 第一关始终解锁，其他需前一关通关
    var isNext = (i === nextLevel);

    if (cleared) {
      // 已通关 - 绿色
      var lvCoins = (lv && lv.coinsEarned) || 0;
      html += '<div onclick="startMatch3Level(' + i + ')" style="background:linear-gradient(135deg,#52c41a,#389e0d);border:2px solid #389e0d;border-radius:10px;padding:8px 4px;text-align:center;cursor:pointer;transition:all 0.2s;">';
      html += '<div style="font-size:14px;font-weight:700;color:#fff;">第' + i + '关</div>';
      html += '<div style="font-size:10px;color:#fff;margin-top:2px;">' + score + '分</div>';
      html += '<div style="font-size:10px;color:#ffe082;margin-top:1px;">💰' + lvCoins + '</div>';
      html += '</div>';
    } else if (unlocked && isNext) {
      // 当前可玩关卡 - 高亮橙色
      html += '<div onclick="startMatch3Level(' + i + ')" style="background:linear-gradient(135deg,#ff9800,#f57c00);border:2px solid #e65100;border-radius:10px;padding:8px 4px;text-align:center;cursor:pointer;transition:all 0.2s;box-shadow:0 0 8px rgba(255,152,0,0.5);">';
      html += '<div style="font-size:14px;font-weight:700;color:#fff;">第' + i + '关</div>';
      html += '<div style="font-size:10px;color:#ffe0b2;margin-top:2px;">挑战</div>';
      html += '</div>';
    } else if (unlocked) {
      // 已解锁但未通关（重试）
      html += '<div onclick="startMatch3Level(' + i + ')" style="background:linear-gradient(135deg,#fff5f0,#ffe8e0);border:2px solid #f0d0c8;border-radius:10px;padding:8px 4px;text-align:center;cursor:pointer;transition:all 0.2s;">';
      html += '<div style="font-size:14px;font-weight:700;color:#886;">第' + i + '关</div>';
      html += '</div>';
    } else {
      // 未解锁 - 锁定状态
      html += '<div style="background:linear-gradient(135deg,#e0e0e0,#bdbdbd);border:2px solid #9e9e9e;border-radius:10px;padding:8px 4px;text-align:center;cursor:not-allowed;opacity:0.6;">';
      html += '<div style="font-size:14px;font-weight:700;color:#757575;">🔒</div>';
      html += '<div style="font-size:10px;color:#999;margin-top:2px;">第' + i + '关</div>';
      html += '</div>';
    }
  }
  html += '</div>';

  // 游戏规则
  html += '<div style="margin:12px 10px;padding:12px;background:#fff;border-radius:12px;border:1px solid #e0e0e0;text-align:left;">';
  html += '<div style="font-size:13px;font-weight:600;color:#666;margin-bottom:6px;">📖 游戏规则</div>';
  html += '<div style="font-size:12px;color:#888;line-height:1.8;">';
  html += '1. 选择三个相同图案的方块消除<br>2. 消除所有方块即可通关<br>3. 通关时间越短，得分越高<br>4. 首次通关获得2-5金币奖励<br>5. 可重复挑战已通关关卡提高分数，但不再获得金币</div></div>';

  container.innerHTML = html;
}

// ===== 开始关卡 =====
window.startMatch3Level = function(level) {
  // 检查关卡是否解锁
  if (!_m3CurrentStudent) return;
  var qs = ensureMatch3State(_m3CurrentStudent);
  var levels = qs.match3Levels || {};
  var maxClearedLevel = 0;
  Object.keys(levels).forEach(function(k) {
    if (levels[k] && levels[k].cleared && parseInt(k) > maxClearedLevel) maxClearedLevel = parseInt(k);
  });
  var nextLevel = maxClearedLevel + 1;
  if (level > nextLevel) return; // 关卡未解锁

  _m3CurrentLevel = level;
  _m3Score = 0;
  _m3BlocksCleared = 0;
  _m3StartTime = Date.now();
  _m3GameActive = true;
  // 重置会话道具使用计数（仅在新的一局开始时）
  _m3SessionToolsUsed = { shuffle: 0, undo: 0 };
  _m3InitLevel(level);
};

function _m3InitLevel(level) {
  if (!_m3Container) return;
  _m3EnterGameMode();
  _m3Tiles = [];
  _m3Selected = [];
  _m3MoveHistory = [];

  var config = _m3GetLevelConfig(level);

  // 计算总位置数
  var actualPositions = 0;
  config.layerSizes.forEach(function(size, layerIdx) {
    for (var row = 0; row < size; row++) {
      for (var col = 0; col < size; col++) {
        if ((row + col + layerIdx) % 2 !== 0) actualPositions++;
      }
    }
  });
  var adjustedTotal = Math.floor(actualPositions / 3) * 3;

  // 生成图案数组
  var tileTypes = [];
  var numTypes = config.typesToUse.length;
  var perTypeBase = Math.floor(adjustedTotal / numTypes / 3) * 3;
  config.typesToUse.forEach(function(typeObj) {
    for (var i = 0; i < perTypeBase; i++) tileTypes.push(typeObj);
  });
  var remainingSlots = adjustedTotal - tileTypes.length;
  var typeIdx = 0;
  while (remainingSlots >= 3 && typeIdx < numTypes) {
    for (var j = 0; j < 3; j++) tileTypes.push(config.typesToUse[typeIdx]);
    remainingSlots -= 3;
    typeIdx = (typeIdx + 1) % numTypes;
  }
  tileTypes.sort(function() { return Math.random() - 0.5; });

  // 创建多层方块 — 9:16 竖屏游戏框架
  var qs = ensureMatch3State(_m3CurrentStudent);
  var tools = qs.match3Tools || { shuffle: 1, undo: 1 };
  var contentHeight = (config.layers - 1) * 26 + TILE_SIZE + 40;

  var html = '<div class="m3-game-frame">';

  // 顶栏：极简一行
  html += '<div class="m3-top-bar">';
  html += '<button class="m3-btn-icon" id="m3PauseBtn" style="width:28px;height:28px;font-size:12px;">⏸</button>';
  html += '<div class="m3-level-label">第<span id="m3LevelNum">' + level + '</span>关</div>';
  html += '<div class="m3-time-display" id="m3TimeDisplay">00:00</div>';
  html += '<div class="m3-score-label">💰<span id="m3Score">0</span></div>';
  html += '<button class="m3-btn-icon" id="m3SoundBtn" style="width:28px;height:28px;font-size:12px;">🔇</button>';
  html += '</div>';

  // 游戏区：占主要空间，可滚动
  html += '<div id="m3GameArea" style="position:relative;width:100%;flex:1;margin:0 auto;background:linear-gradient(180deg,#f8f6ff,#ede8ff);border-radius:8px;overflow:auto;min-height:200px;"></div>';

  // 底部：槽位 + 道具 合为一行，紧凑
  html += '<div class="m3-bottom-bar">';
  html += '<div id="m3SlotBar" class="m3-slot-bar">';
  for (var s = 0; s < MAX_SLOTS; s++) {
    html += '<div class="m3-slot" style="width:38px;height:38px;border:2px dashed #ccc;border-radius:6px;display:flex;align-items:center;justify-content:center;"></div>';
  }
  html += '</div>';
  html += '<div class="m3-tools-col">';
  html += '<div class="m3-tool-btn" id="m3ShuffleTool" style="padding:3px 8px;min-width:50px;border-radius:8px;"><span class="icon" id="m3ShuffleIcon" style="font-size:16px;">' + (tools.shuffle > 0 ? '🔀' : '📝') + '</span><span class="count" id="m3ShuffleCount" style="top:-5px;right:-5px;width:16px;height:16px;font-size:10px;">' + tools.shuffle + '</span></div>';
  html += '<div class="m3-tool-btn" id="m3UndoTool" style="padding:3px 8px;min-width:50px;border-radius:8px;"><span class="icon" id="m3UndoIcon" style="font-size:16px;">' + (tools.undo > 0 ? '↩️' : '📝') + '</span><span class="count" id="m3UndoCount" style="top:-5px;right:-5px;width:16px;height:16px;font-size:10px;">' + tools.undo + '</span></div>';
  html += '</div>';
  html += '</div>';

  // 剩余提示
  html += '<div style="text-align:center;font-size:10px;color:rgba(255,255,255,0.5);margin-top:2px;">剩余: <span id="m3Remaining">' + tileTypes.length + '</span></div>';

  // 答题弹窗（道具用尽时获取道具）
  html += '<div class="m3-quiz-modal" id="m3QuizModal">';
  html += '<div class="m3-quiz-content">';
  html += '<div class="m3-quiz-chapter" id="m3QuizChapter"></div>';
  html += '<div class="m3-quiz-question" id="m3QuizQuestion"></div>';
  html += '<div class="m3-quiz-options" id="m3QuizOptions"></div>';
  html += '<div class="m3-quiz-tip" id="m3QuizTip"></div>';
  html += '<button class="m3-quiz-close-btn" id="m3QuizCloseBtn" style="display:none;">关闭</button>';
  html += '</div></div>';
  // Pause mask overlay
  html += '<div class="m3-pause-mask" id="m3PauseMask">';
  html += '<div class="m3-pause-title">游戏暂停</div>';
  html += '<button class="m3-pause-btn" id="m3ResumeBtn">▶ 继续游戏</button>';
  html += '<button class="m3-pause-btn secondary" onclick="startMatch3Level(' + level + ')" style="font-size:16px;padding:10px 30px;">🔄 重新开始</button>';
  html += '<button class="m3-pause-btn secondary" id="m3QuitBtn">🏠 返回关卡选择</button>';
  html += '</div>';
  html += '</div>'; // close m3-game-frame

  _m3Container.innerHTML = html;

  // 渲染方块到 DOM
  var gameArea = document.getElementById('m3GameArea');
  var startIndex = 0;
  for (var layer = 0; layer < config.layers; layer++) {
    var size = config.layerSizes[layer];
    var offsetX = (7 - size) * TILE_SIZE / 2;
    var offsetY = layer * 26;
    var created = 0;
    for (var r = 0; r < size; r++) {
      for (var c = 0; c < size; c++) {
        if ((r + c + layer) % 2 === 0) continue;
        if (startIndex + created >= tileTypes.length) break;
        var type = tileTypes[startIndex + created];
        var tile = {
          id: 'm3t-' + layer + '-' + r + '-' + c,
          type: type,
          layer: layer,
          x: offsetX + c * TILE_SIZE + 10,
          y: offsetY + r * TILE_SIZE + 10,
          blocked: false
        };
        _m3Tiles.push(tile);
        created++;
      }
      if (startIndex + created >= tileTypes.length) break;
    }
    startIndex += created;
  }

  _m3RenderTiles(gameArea);
  _m3UpdateBlocked();
  _m3InitToolSystem();
  _m3UpdateToolUI();
  _m3InitTopBarEvents();
  _m3StartTimer();
  _m3StartBGM();
}

function _m3RenderTiles(gameArea) {
  var html = '';
  var colors = ['#FFB6C1','#87CEEB','#98FB98','#DDA0DD','#F0E68C','#FFA07A','#98D8C8','#B0C4DE'];
  _m3Tiles.forEach(function(tile) {
    var bg = colors[Math.floor(Math.random() * colors.length)];
    html += '<div id="' + tile.id + '" onclick="m3SelectTile(\'' + tile.id + '\')" style="position:absolute;width:' + TILE_SIZE + 'px;height:' + TILE_SIZE + 'px;border-radius:8px;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all 0.2s;box-shadow:0 4px 6px rgba(0,0,0,0.2);user-select:none;left:' + tile.x + 'px;top:' + tile.y + 'px;background:' + bg + ';z-index:' + tile.layer + ';">';
    html += '<img src="' + tile.type.path + '" alt="' + tile.type.name + '" style="width:100%;height:100%;object-fit:contain;" draggable="false" onerror="this.style.display=\'none\';this.parentNode.textContent=\'' + tile.type.name + '\';">';
    html += '</div>';
  });
  gameArea.innerHTML = html;
}

function _m3UpdateBlocked() {
  _m3Tiles.forEach(function(tile) {
    tile.blocked = false;
    _m3Tiles.forEach(function(other) {
      if (other.layer > tile.layer) {
        var dx = Math.abs(other.x - tile.x);
        var dy = Math.abs(other.y - tile.y);
        if (dx < TILE_SIZE * 0.7 && dy < TILE_SIZE * 0.7) {
          tile.blocked = true;
        }
      }
    });
    var elem = document.getElementById(tile.id);
    if (elem) {
      if (tile.blocked) {
        elem.style.opacity = '0.5';
        elem.style.filter = 'grayscale(60%) brightness(0.7)';
        elem.style.boxShadow = 'none';
        elem.style.border = '2px solid rgba(0,0,0,0.2)';
      } else {
        elem.style.opacity = '1';
        elem.style.filter = 'none';
        elem.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3), 0 0 0 3px rgba(255,255,255,0.8)';
        elem.style.border = '3px solid #fff';
      }
    }
  });
}

// ===== 选择方块 =====
window.m3SelectTile = function(tileId) {
  if (!_m3GameActive) return;
  var tile = null;
  for (var i = 0; i < _m3Tiles.length; i++) {
    if (_m3Tiles[i].id === tileId) { tile = _m3Tiles[i]; break; }
  }
  if (!tile || tile.blocked) return;
  if (_m3Selected.length >= MAX_SLOTS) return;

  _m3SoundClick();
  _m3MoveHistory.push(_m3Selected.slice());

  _m3Selected.push(tile);
  _m3Tiles = _m3Tiles.filter(function(t) { return t.id !== tileId; });
  var elem = document.getElementById(tileId);
  if (elem) elem.remove();

  _m3UpdateBlocked();
  _m3CheckMatch();
  _m3UpdateDisplay();
};

function _m3CheckMatch() {
  var counts = {};
  _m3Selected.forEach(function(tile) {
    counts[tile.type.name] = (counts[tile.type.name] || 0) + 1;
  });

  var matched = false;
  for (var typeName in counts) {
    if (counts[typeName] >= 3) {
      var removed = 0;
      _m3Selected = _m3Selected.filter(function(tile) {
        if (tile.type.name === typeName && removed < 3) { removed++; return false; }
        return true;
      });
      _m3Score += 10;
      _m3BlocksCleared += 3;
      matched = true;
      _m3SoundMatch();
      break;
    }
  }

  // 检查失败
  if (!matched && _m3Tiles.length === 0 && _m3Selected.length > 0) {
    var finalCounts = {};
    _m3Selected.forEach(function(tile) {
      finalCounts[tile.type.name] = (finalCounts[tile.type.name] || 0) + 1;
    });
    var hasMatch = false;
    for (var k in finalCounts) { if (finalCounts[k] >= 3) { hasMatch = true; break; } }
    if (!hasMatch) {
      _m3SoundFail();
      _m3GameActive = false;
      setTimeout(function() { _m3ShowResult(false); }, 500);
      return;
    }
  }

  if (_m3Selected.length >= MAX_SLOTS) {
    _m3SoundFail();
    _m3GameActive = false;
    setTimeout(function() { _m3ShowResult(false); }, 500);
    return;
  }

  // 检查通关
  if (_m3Tiles.length === 0 && _m3Selected.length === 0) {
    _m3SoundWin();
    _m3GameActive = false;
    setTimeout(function() { _m3ShowResult(true); }, 500);
  }
}

function _m3UpdateDisplay() {
  var remEl = document.getElementById('m3Remaining');
  var scoreEl = document.getElementById('m3Score');
  if (remEl) remEl.textContent = _m3Tiles.length;
  if (scoreEl) scoreEl.textContent = _m3Score;

  var slots = document.querySelectorAll('.m3-slot');
  slots.forEach(function(slot, index) {
    if (_m3Selected[index]) {
      slot.innerHTML = '<img src="' + _m3Selected[index].type.path + '" alt="' + _m3Selected[index].type.name + '" style="width:100%;height:100%;object-fit:contain;">';
    } else {
      slot.innerHTML = '';
    }
  });
}

// ===== 道具系统（与小猪快跑一致）=====
function _m3InitTopBarEvents() {
  var pauseBtn = document.getElementById('m3PauseBtn');
  var soundBtn = document.getElementById('m3SoundBtn');
  var resumeBtn = document.getElementById('m3ResumeBtn');
  var quitBtn = document.getElementById('m3QuitBtn');
  if (pauseBtn) pauseBtn.addEventListener('click', _m3TogglePause);
  if (soundBtn) soundBtn.addEventListener('click', function() {
    var bgmOn = _m3ToggleBGM();
    soundBtn.textContent = bgmOn ? '🔊' : '🔇';
  });
  if (resumeBtn) resumeBtn.addEventListener('click', _m3TogglePause);
  if (quitBtn) quitBtn.addEventListener('click', function() {
    _m3StopTimer();
    _m3StopBGM();
    _m3Paused = false;
    renderMatch3Page();
  });
}

function _m3InitToolSystem() {
  var shuffleBtn = document.getElementById('m3ShuffleTool');
  var undoBtn = document.getElementById('m3UndoTool');
  if (shuffleBtn) {
    shuffleBtn.addEventListener('click', function() { _m3OnToolClick('shuffle'); });
  }
  if (undoBtn) {
    undoBtn.addEventListener('click', function() { _m3OnToolClick('undo'); });
  }
}

function _m3UpdateToolUI() {
  if (!_m3CurrentStudent) return;
  var qs = ensureMatch3State(_m3CurrentStudent);
  var tools = qs.match3Tools || { shuffle: 1, undo: 1 };

  var shuffleAvailable = tools.shuffle > 0;
  var undoAvailable = tools.undo > 0;

  var shuffleCnt = document.getElementById('m3ShuffleCount');
  var undoCnt = document.getElementById('m3UndoCount');
  var shuffleIcon = document.getElementById('m3ShuffleIcon');
  var undoIcon = document.getElementById('m3UndoIcon');
  var shuffleBtn = document.getElementById('m3ShuffleTool');
  var undoBtn = document.getElementById('m3UndoTool');

  if (shuffleCnt) shuffleCnt.textContent = tools.shuffle;
  if (undoCnt) undoCnt.textContent = tools.undo;
  if (shuffleIcon) shuffleIcon.textContent = tools.shuffle > 0 ? '🔀' : '📝';
  if (undoIcon) undoIcon.textContent = tools.undo > 0 ? '↩️' : '📝';
  if (shuffleBtn) shuffleBtn.classList.toggle('disabled', !shuffleAvailable);
  if (undoBtn) undoBtn.classList.toggle('disabled', !undoAvailable);
}

function _m3OnToolClick(toolName) {
  if (!_m3GameActive) return;
  if (!_m3CurrentStudent) return;
  var qs = ensureMatch3State(_m3CurrentStudent);
  var tools = qs.match3Tools;
  var toolValue = tools[toolName];

  if (toolValue > 0) {
    // 有道具可用，消耗1次并执行
    tools[toolName] -= 1;
    if (typeof saveClassData === 'function') saveClassData();
    if (toolName === 'shuffle') {
      _m3DoShuffle();
    } else if (toolName === 'undo') {
      _m3DoUndo();
    }
    _m3UpdateToolUI();
  } else {
    // 道具为0，需答题获取
    _m3OpenQuiz(toolName);
  }
}

function _m3DoShuffle() {
  if (!_m3GameActive || _m3Tiles.length === 0) return;
  _m3Tiles.forEach(function(tile) {
    tile.x = Math.random() * 280 + 10;
    tile.y = Math.random() * 340 + 10;
    var elem = document.getElementById(tile.id);
    if (elem) { elem.style.left = tile.x + 'px'; elem.style.top = tile.y + 'px'; }
  });
  _m3UpdateBlocked();
}

function _m3DoUndo() {
  if (!_m3GameActive || _m3MoveHistory.length === 0) return;
  _m3Selected = _m3MoveHistory.pop();
  var gameArea = document.getElementById('m3GameArea');
  if (gameArea) _m3RenderTiles(gameArea);
  _m3UpdateBlocked();
  _m3UpdateDisplay();
}

// 答题获取道具
var _m3QuizState = { tool: null, attempts: 0, question: null };

function _m3OpenQuiz(toolName) {
  _m3QuizState.tool = toolName;
  _m3QuizState.attempts = 0;
  var bank = (typeof window._getActiveQuestionBank === 'function') ? window._getActiveQuestionBank() : [];
  if (bank.length === 0) {
    alert('暂无题库，无法答题获取道具');
    return;
  }
  var ri = Math.floor(Math.random() * bank.length);
  _m3QuizState.question = bank[ri];

  var quizModal = document.getElementById('m3QuizModal');
  var quizChapter = document.getElementById('m3QuizChapter');
  var quizQuestion = document.getElementById('m3QuizQuestion');
  var quizOptions = document.getElementById('m3QuizOptions');
  var quizTip = document.getElementById('m3QuizTip');
  var quizCloseBtn = document.getElementById('m3QuizCloseBtn');

  if (!quizModal) return;

  quizChapter.textContent = _m3QuizState.question.chapter || '';
  quizQuestion.textContent = _m3QuizState.question.question || '';
  quizOptions.innerHTML = '';
  quizTip.textContent = '';
  quizCloseBtn.style.display = 'none';

  _m3QuizState.question.options.forEach(function(opt, idx) {
    var div = document.createElement('div');
    div.className = 'm3-quiz-option';
    div.textContent = String.fromCharCode(65 + idx) + '. ' + opt;
    div.addEventListener('click', function() { _m3SelectAnswer(idx); });
    quizOptions.appendChild(div);
  });

  quizModal.classList.add('show');
}

function _m3SelectAnswer(index) {
  _m3QuizState.attempts++;
  var quizOptions = document.getElementById('m3QuizOptions');
  var quizTip = document.getElementById('m3QuizTip');
  var quizCloseBtn = document.getElementById('m3QuizCloseBtn');
  var opts = quizOptions.querySelectorAll('.m3-quiz-option');
  var correct = _m3QuizState.question.answer;

  opts.forEach(function(o) { o.classList.add('disabled'); });

  if (index === correct) {
    opts[index].classList.add('correct');
    var reward = 0;
    if (_m3QuizState.attempts === 1) { reward = 2; quizTip.textContent = '回答正确！获得 ' + reward + ' 次道具'; }
    else if (_m3QuizState.attempts === 2) { reward = 1; quizTip.textContent = '回答正确！获得 ' + reward + ' 次道具'; }
    else { reward = 0; quizTip.textContent = '回答正确，但超过2次作答，无法获得道具'; }

    if (_m3CurrentStudent) {
      var qs = ensureMatch3State(_m3CurrentStudent);
      qs.match3Tools[_m3QuizState.tool] += reward;
      if (typeof saveClassData === 'function') saveClassData();
    }
    quizCloseBtn.style.display = 'block';
    _m3UpdateToolUI();
  } else {
    opts[index].classList.add('wrong');
    if (_m3QuizState.attempts >= 4) {
      quizTip.textContent = '4次作答均错误，无法获得道具';
      quizCloseBtn.style.display = 'block';
    } else {
      quizTip.textContent = '回答错误，再试一次（第' + _m3QuizState.attempts + '/4次）';
      opts.forEach(function(o) { o.classList.remove('disabled'); });
    }
  }
}

// ===== 通关/失败结果 =====
function _m3ShowResult(success) {
  _m3StopTimer();
  _m3StopBGM();
  if (!_m3CurrentStudent) return;
  var qs = ensureMatch3State(_m3CurrentStudent);
  var levelKey = String(_m3CurrentLevel);
  var prev = qs.match3Levels[levelKey] || null;
  var elapsed = _m3TimeSeconds;

  if (success) {
    var timeBonus = Math.max(0, 120 - elapsed);
    var levelScore = _m3BlocksCleared * 10 + timeBonus;

    var coinReward = 0;
    var alreadyEarnedCoins = prev && prev.coinsEarned > 0;
    var isFirstClear = !prev || !prev.cleared;
    if (isFirstClear) {
      var rand = Math.random();
      if (rand < 0.3) coinReward = 2;
      else if (rand < 0.6) coinReward = 3;
      else if (rand < 0.85) coinReward = 4;
      else coinReward = 5;
      _m3CurrentStudent.coins += coinReward;
    }

    var prevBest = prev ? (prev.bestScore || 0) : 0;
    if (levelScore > prevBest) {
      qs.match3Levels[levelKey] = {
        bestScore: levelScore,
        bestTime: elapsed,
        coinsEarned: alreadyEarnedCoins ? (prev.coinsEarned || 0) : coinReward,
        cleared: true
      };
    } else if (!prev || !prev.cleared) {
      qs.match3Levels[levelKey] = {
        bestScore: levelScore,
        bestTime: elapsed,
        coinsEarned: coinReward,
        cleared: true
      };
    }

    recalcMatch3TotalScore(_m3CurrentStudent);

    var msg = '消消乐第' + _m3CurrentLevel + '关通关，得分' + levelScore + '，用时' + elapsed + '秒';
    if (isFirstClear && coinReward > 0) msg += '，获' + coinReward + '金币';
    msg += '，总分:' + qs.match3TotalScore;
    if (typeof recordAction === 'function') {
      recordAction(_m3CurrentStudent.id, _m3CurrentStudent.name, '宠物消消乐', msg, isFirstClear ? coinReward : 0, 0, null);
    }

    var html = '<div style="text-align:center;padding:30px;">';
    html += '<div style="font-size:48px;">🎉</div>';
    html += '<div style="font-size:20px;font-weight:700;margin:12px 0;">第 ' + _m3CurrentLevel + ' 关通关！</div>';
    html += '<div style="font-size:14px;color:#666;">得分: ' + levelScore + ' · 用时: ' + elapsed + '秒</div>';
    if (isFirstClear && coinReward > 0) {
      html += '<div style="font-size:14px;color:#4a9e4a;font-weight:600;margin-top:6px;">获得 ' + coinReward + ' 金币</div>';
    }
    html += '<div style="display:flex;gap:10px;justify-content:center;margin-top:20px;">';
    html += '<button onclick="startMatch3Level(' + (_m3CurrentLevel + 1) + ')" style="padding:10px 20px;font-size:14px;border:none;border-radius:8px;background:linear-gradient(135deg,#52c41a,#389e0d);color:#fff;cursor:pointer;font-weight:600;">下一关 →</button>';
    html += '<button onclick="renderMatch3Page()" style="padding:10px 20px;font-size:14px;border:none;border-radius:8px;background:#fff;color:#888;cursor:pointer;font-weight:600;border:1px solid #ddd;">返回选关</button>';
    html += '</div></div>';
    _m3Container.innerHTML = html;

    if (typeof saveClassData === 'function') saveClassData();
  } else {
    var html2 = '<div style="text-align:center;padding:30px;">';
    html2 += '<div style="font-size:48px;">😢</div>';
    html2 += '<div style="font-size:20px;font-weight:700;margin:12px 0;">第 ' + _m3CurrentLevel + ' 关失败</div>';
    html2 += '<div style="font-size:14px;color:#666;">槽位已满，无法继续消除</div>';
    html2 += '<div style="display:flex;gap:10px;justify-content:center;margin-top:20px;">';
    html2 += '<button onclick="startMatch3Level(' + _m3CurrentLevel + ')" style="padding:10px 20px;font-size:14px;border:none;border-radius:8px;background:linear-gradient(135deg,#e8637a,#f5a054);color:#fff;cursor:pointer;font-weight:600;">再试一次</button>';
    html2 += '<button onclick="renderMatch3Page()" style="padding:10px 20px;font-size:14px;border:none;border-radius:8px;background:#fff;color:#888;cursor:pointer;font-weight:600;border:1px solid #ddd;">返回选关</button>';
    html2 += '</div></div>';
    _m3Container.innerHTML = html2;
  }
}

// 注入道具、弹窗、顶栏、暂停遮罩、9:16游戏框架样式
(function() {
  var style = document.createElement('style');
  style.textContent = [
    /* === 9:16 游戏框架 === */
    '.m3-game-frame{',
    '  position:relative;',
    '  display:flex;',
    '  flex-direction:column;',
    '  width:100%;',
    '  max-width:390px;',
    '  margin:0 auto;',
    '  min-height:calc(100vh - 160px);',
    '  max-height:calc(100vw * 16 / 9);',
    '  aspect-ratio:9/16;',
    '  background:linear-gradient(180deg,#2d1b69 0%,#1a0f3d 100%);',
    '  border-radius:16px;',
    '  overflow:hidden;',
    '  box-shadow:0 8px 32px rgba(45,27,105,0.4);',
    '  padding:6px;',
    '}',

    /* === 游戏模式激活时隐藏非游戏元素 === */
    '.m3-game-active>.quiz-tabs{display:none !important;}',
    '.m3-game-active>.paw-deco{display:none !important;}',
    '.m3-game-active>.page-title{display:none !important;}',
    '.m3-game-active>#quizDailyContent,',
    '.m3-game-active>#quizPigRunContent{display:none !important;}',
    '.m3-game-active>#quizMatch3Content{',
    '  position:fixed;',
    '  top:0;left:0;right:0;bottom:0;',
    '  z-index:999;',
    '  background:linear-gradient(180deg,#1a0a3e,#0d0520);',
    '  display:flex;',
    '  align-items:center;',
    '  justify-content:center;',
    '  padding:10px;',
    '  overflow:auto;',
    '}',

    /* === 顶栏 === */
    '.m3-top-bar{',
    '  display:flex;',
    '  align-items:center;',
    '  justify-content:space-between;',
    '  padding:5px 8px;',
    '  background:linear-gradient(135deg,#667eea,#764ba2);',
    '  border-radius:8px;',
    '  margin-bottom:5px;',
    '  flex-shrink:0;',
    '}',
    '.m3-level-label{color:#fff;font-weight:700;font-size:14px;}',
    '.m3-score-label{color:#ffe082;font-size:12px;font-weight:600;}',
    '.m3-time-display{',
    '  background:rgba(255,255,255,0.2);',
    '  padding:2px 7px;',
    '  border-radius:5px;',
    '  color:#fff;',
    '  font-weight:600;',
    '  font-size:13px;',
    '  min-width:44px;',
    '  text-align:center;',
    '}',

    /* === 底部栏 === */
    '.m3-bottom-bar{',
    '  display:flex;',
    '  align-items:center;',
    '  justify-content:space-between;',
    '  padding:6px 8px;',
    '  gap:6px;',
    '  margin-top:5px;',
    '  flex-shrink:0;',
    '}',
    '.m3-slot-bar{',
    '  display:flex;',
    '  gap:3px;',
    '  align-items:center;',
    '  justify-content:center;',
    '  background:rgba(255,255,255,0.95);',
    '  border-radius:8px;',
    '  padding:5px 6px;',
    '  min-height:48px;',
    '  flex:1;',
    '}',
    '.m3-tools-col{',
    '  display:flex;',
    '  flex-direction:column;',
    '  gap:4px;',
    '}',

    /* === 通用按钮 === */
    '.m3-btn-icon{',
    '  width:28px;height:28px;',
    '  border-radius:6px;',
    '  background:rgba(255,255,255,0.95);',
    '  border:2px solid #667eea;',
    '  font-size:12px;',
    '  cursor:pointer;',
    '  box-shadow:0 2px 0 #4a5dbd;',
    '  display:flex;align-items:center;justify-content:center;',
    '  flex-shrink:0;',
    '}',
    '.m3-btn-icon:active{transform:translateY(2px);box-shadow:0 1px 0 #4a5dbd;}',

    /* === 道具按钮 === */
    '.m3-tool-btn{',
    '  position:relative;',
    '  display:flex;flex-direction:column;align-items:center;gap:2px;',
    '  background:#ffe066;border:3px solid #ffb800;',
    '  border-radius:14px;padding:6px 12px;',
    '  cursor:pointer;transition:transform 0.1s;',
    '  min-width:72px;box-shadow:0 4px 0 #e0a000;',
    '}',
    '.m3-tool-btn:active{transform:translateY(3px);box-shadow:0 1px 0 #e0a000;}',
    '.m3-tool-btn .icon{font-size:24px;line-height:1;}',
    '.m3-tool-btn .text{font-size:13px;font-weight:900;color:#8b5a2b;}',
    '.m3-tool-btn .count{',
    '  position:absolute;top:-8px;right:-8px;',
    '  background:#ff4757;color:white;font-size:13px;',
    '  width:22px;height:22px;border-radius:50%;',
    '  display:flex;align-items:center;justify-content:center;',
    '  font-weight:bold;border:2px solid #fff;',
    '}',
    '.m3-tool-btn.disabled{opacity:0.6;background:#d0d0d0;border-color:#999;box-shadow:0 4px 0 #777;cursor:not-allowed;}',

    /* === 暂停遮罩 === */
    '.m3-pause-mask{',
    '  position:absolute;inset:0;',
    '  background:rgba(0,0,0,0.6);',
    '  display:flex;flex-direction:column;align-items:center;justify-content:center;',
    '  z-index:150;opacity:0;pointer-events:none;',
    '  transition:opacity 0.3s ease;',
    '}',
    '.m3-pause-mask.show{opacity:1;pointer-events:all;}',
    '.m3-pause-title{font-size:36px;font-weight:900;color:#fff;margin-bottom:30px;letter-spacing:4px;}',
    '.m3-pause-btn{',
    '  background:linear-gradient(135deg,#667eea,#764ba2);',
    '  color:white;border:none;padding:14px 40px;border-radius:30px;',
    '  font-size:20px;cursor:pointer;font-weight:bold;',
    '  box-shadow:0 4px 0 #4a3d8c;margin-bottom:16px;transition:transform 0.1s;',
    '}',
    '.m3-pause-btn:active{transform:translateY(2px);box-shadow:0 2px 0 #4a3d8c;}',
    '.m3-pause-btn.secondary{background:#fff;color:#333;box-shadow:0 4px 0 #ccc;}',

    /* === 答题弹窗 === */
    '.m3-quiz-modal{',
    '  position:absolute;inset:0;',
    '  background:rgba(0,0,0,0.6);',
    '  display:flex;align-items:center;justify-content:center;',
    '  z-index:200;opacity:0;pointer-events:none;',
    '  transition:opacity 0.3s ease;padding:20px;',
    '}',
    '.m3-quiz-modal.show{opacity:1;pointer-events:all;}',
    '.m3-quiz-content{',
    '  background:#fff;padding:24px;border-radius:20px;',
    '  width:100%;max-width:380px;',
    '  box-shadow:0 12px 40px rgba(0,0,0,0.3);',
    '}',
    '.m3-quiz-chapter{font-size:13px;color:#888;margin-bottom:8px;}',
    '.m3-quiz-question{font-size:17px;font-weight:bold;color:#333;line-height:1.6;margin-bottom:16px;}',
    '.m3-quiz-options{display:flex;flex-direction:column;gap:10px;margin-bottom:16px;}',
    '.m3-quiz-option{padding:12px 16px;border:2px solid #e8e8e8;border-radius:12px;cursor:pointer;font-size:15px;color:#333;transition:all 0.2s;}',
    '.m3-quiz-option:hover{border-color:#667eea;background:#f0f2ff;}',
    '.m3-quiz-option.correct{border-color:#52c41a;background:#f6ffed;color:#389e0d;}',
    '.m3-quiz-option.wrong{border-color:#ff4757;background:#fff1f0;color:#cf1322;}',
    '.m3-quiz-option.disabled{pointer-events:none;}',
    '.m3-quiz-tip{text-align:center;font-size:14px;color:#666;margin-bottom:12px;min-height:20px;}',
    '.m3-quiz-close-btn{width:100%;background:linear-gradient(135deg,#667eea,#764ba2);color:white;border:none;padding:12px;border-radius:12px;font-size:16px;font-weight:bold;cursor:pointer;box-shadow:0 3px 0 #4a3d8c;}',

    /* === 电脑端适配 === */
    '@media (min-width: 768px) {',
    '  .m3-game-frame {',
    '    max-width: 480px;',
    '    min-height: 600px;',
    '    max-height: 80vh;',
    '  }',
    '  .m3-top-bar {',
    '    padding: 8px 12px;',
    '  }',
    '  .m3-level-label {',
    '    font-size: 16px;',
    '  }',
    '  .m3-time-display {',
    '    font-size: 15px;',
    '    padding: 3px 10px;',
    '  }',
    '  .m3-score-label {',
    '    font-size: 14px;',
    '  }',
    '  .m3-btn-icon {',
    '    width: 36px;',
    '    height: 36px;',
    '    font-size: 14px;',
    '  }',
    '  .m3-slot {',
    '    width: 52px !important;',
    '    height: 52px !important;',
    '  }',
    '  .m3-tool-btn {',
    '    min-width: 60px;',
    '    padding: 6px 12px;',
    '  }',
    '  .m3-tool-btn .icon {',
    '    font-size: 20px;',
    '  }',
    '  .m3-tool-btn .count {',
    '    width: 20px !important;',
    '    height: 20px !important;',
    '    font-size: 12px !important;',
    '  }',
    '}'
  ].join('');
  document.head.appendChild(style);
})();

// 关闭弹窗按钮事件
document.addEventListener('click', function(e) {
  if (e.target.id === 'm3QuizCloseBtn') {
    var modal = document.getElementById('m3QuizModal');
    if (modal) modal.classList.remove('show');
  }
});

})();
