// match3.js v2 — 宠物消消乐
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
var MAX_SLOTS = 6;

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

// ===== 关卡配置 =====
function _m3GetLevelConfig(level) {
  var baseLayers = 6;
  var extraLayers = Math.min(Math.floor((level - 1) / 2), 6);
  var totalLayers = baseLayers + extraLayers;
  var layerSizes = [];
  for (var i = 0; i < totalLayers; i++) {
    layerSizes.push(4 + (i % 2));
  }
  var availableTypes = Math.min(5 + Math.floor((level - 1) / 12), 7);
  return { layers: totalLayers, layerSizes: layerSizes, typesToUse: TILE_TYPES.slice(0, availableTypes) };
}

// ===== 渲染关卡选择 =====
function renderMatch3Page() {
  var container = document.getElementById('match3Content');
  if (!container) return;
  _m3Container = container;
  var isStudentView = typeof currentUser !== 'undefined' && currentUser && currentUser.type === 'student';

  if (!isStudentView) {
    // 教师视图
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

  // 计算已通关数和最高关
  var clearedCount = 0;
  var maxLevel = 0;
  Object.keys(levels).forEach(function(k) {
    if (levels[k] && levels[k].cleared) {
      clearedCount++;
      if (parseInt(k) > maxLevel) maxLevel = parseInt(k);
    }
  });

  var html = '<div style="text-align:center;padding:15px;">';
  html += '<div style="font-size:36px;">🧩</div>';
  html += '<div style="font-size:18px;font-weight:700;margin:8px 0;">宠物消消乐</div>';
  html += '<div style="font-size:13px;color:#888;">已通关 ' + clearedCount + ' 关 · 总分 ' + totalScore + '</div>';
  html += '</div>';

  // 关卡网格
  html += '<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px;padding:10px;max-height:400px;overflow-y:auto;">';
  var showLevels = Math.max(maxLevel + 5, 20);
  for (var i = 1; i <= showLevels; i++) {
    var lv = levels[String(i)];
    var cleared = lv && lv.cleared;
    var score = lv ? (lv.bestScore || 0) : 0;
    var bg = cleared ? 'linear-gradient(135deg,#52c41a,#389e0d)' : 'linear-gradient(135deg,#fff5f0,#ffe8e0)';
    var color = cleared ? '#fff' : '#886';
    var border = cleared ? '2px solid #389e0d' : '2px solid #f0d0c8';
    html += '<div onclick="startMatch3Level(' + i + ')" style="background:' + bg + ';border:' + border + ';border-radius:10px;padding:8px 4px;text-align:center;cursor:pointer;transition:all 0.2s;">';
    html += '<div style="font-size:14px;font-weight:700;color:' + color + ';">第' + i + '关</div>';
    if (cleared) {
      html += '<div style="font-size:10px;color:#fff;margin-top:2px;">' + score + '分</div>';
    }
    html += '</div>';
  }
  html += '</div>';

  container.innerHTML = html;
}

// ===== 开始关卡 =====
window.startMatch3Level = function(level) {
  _m3CurrentLevel = level;
  _m3Score = 0;
  _m3BlocksCleared = 0;
  _m3StartTime = Date.now();
  _m3GameActive = true;
  _m3InitLevel(level);
};

function _m3InitLevel(level) {
  if (!_m3Container) return;
  _m3Tiles = [];
  _m3Selected = [];
  _m3MoveHistory = [];

  var config = _m3GetLevelConfig(level);

  // 计算总位置数
  var actualPositions = 0;
  config.layerSizes.forEach(function(size, layerIdx) {
    for (var row = 0; row < size; row++) {
      for (var col = 0; col < size; col++) {
        if ((row + col + layerIdx) % 3 !== 0) actualPositions++;
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

  // 创建多层方块
  var html = '<div style="text-align:center;padding:8px;">';
  html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:0 10px;">';
  html += '<span style="font-size:14px;font-weight:700;">第 ' + level + ' 关</span>';
  html += '<span style="font-size:13px;">剩余: <span id="m3Remaining">' + tileTypes.length + '</span></span>';
  html += '<span style="font-size:13px;">得分: <span id="m3Score">0</span></span>';
  html += '</div></div>';

  // 游戏区
  html += '<div id="m3GameArea" style="position:relative;width:360px;height:420px;margin:0 auto;background:rgba(255,255,255,0.1);border-radius:12px;overflow:hidden;"></div>';

  // 槽位栏
  html += '<div id="m3SlotBar" style="display:flex;gap:6px;margin:10px auto;padding:10px;background:rgba(255,255,255,0.9);border-radius:10px;min-height:60px;align-items:center;justify-content:center;width:340px;">';
  for (var s = 0; s < MAX_SLOTS; s++) {
    html += '<div class="m3-slot" style="width:44px;height:44px;border:2px dashed #ccc;border-radius:8px;display:flex;align-items:center;justify-content:center;"></div>';
  }
  html += '</div>';

  // 控制按钮
  html += '<div style="display:flex;gap:8px;justify-content:center;margin-top:8px;">';
  html += '<button onclick="m3Shuffle()" style="padding:6px 14px;font-size:13px;border:none;border-radius:8px;background:#fff;color:#667eea;cursor:pointer;font-weight:600;">🔀 洗牌</button>';
  html += '<button onclick="m3Undo()" style="padding:6px 14px;font-size:13px;border:none;border-radius:8px;background:#fff;color:#667eea;cursor:pointer;font-weight:600;">↩️ 撤销</button>';
  html += '<button onclick="startMatch3Level(' + level + ')" style="padding:6px 14px;font-size:13px;border:none;border-radius:8px;background:#fff;color:#667eea;cursor:pointer;font-weight:600;">🔄 重来</button>';
  html += '<button onclick="renderMatch3Page()" style="padding:6px 14px;font-size:13px;border:none;border-radius:8px;background:#ff6b6b;color:#fff;cursor:pointer;font-weight:600;">← 返回</button>';
  html += '</div>';

  _m3Container.innerHTML = html;

  // 渲染方块到 DOM
  var gameArea = document.getElementById('m3GameArea');
  var startIndex = 0;
  for (var layer = 0; layer < config.layers; layer++) {
    var size = config.layerSizes[layer];
    var offsetX = (7 - size) * TILE_SIZE / 2;
    var offsetY = layer * 22;
    var created = 0;
    for (var r = 0; r < size; r++) {
      for (var c = 0; c < size; c++) {
        if ((r + c + layer) % 3 === 0) continue;
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

// ===== 通关/失败结果 =====
function _m3ShowResult(success) {
  if (!_m3CurrentStudent) return;
  var qs = ensureMatch3State(_m3CurrentStudent);
  var levelKey = String(_m3CurrentLevel);
  var prev = qs.match3Levels[levelKey] || null;
  var elapsed = Math.round((Date.now() - _m3StartTime) / 1000);

  if (success) {
    // 计算得分：消除块数 + 时间奖励
    var timeBonus = Math.max(0, 120 - elapsed);
    var levelScore = _m3BlocksCleared * 10 + timeBonus;

    // 金币奖励 2-5 随机
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

    // 更新最佳分数
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

    // 记录操作日志
    var msg = '消消乐第' + _m3CurrentLevel + '关通关，得分' + levelScore + '，用时' + elapsed + '秒';
    if (isFirstClear && coinReward > 0) msg += '，获' + coinReward + '金币';
    msg += '，总分:' + qs.match3TotalScore;
    if (typeof recordAction === 'function') {
      recordAction(_m3CurrentStudent.id, _m3CurrentStudent.name, '宠物消消乐', msg, isFirstClear ? coinReward : 0, 0, null);
    }

    // 显示结果
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

    // 保存数据
    if (typeof saveClassData === 'function') saveClassData();
  } else {
    // 失败
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

// ===== 工具函数 =====
window.m3Shuffle = function() {
  if (!_m3GameActive) return;
  _m3Tiles.forEach(function(tile) {
    tile.x = Math.random() * 280 + 10;
    tile.y = Math.random() * 340 + 10;
    var elem = document.getElementById(tile.id);
    if (elem) { elem.style.left = tile.x + 'px'; elem.style.top = tile.y + 'px'; }
  });
  _m3UpdateBlocked();
};

window.m3Undo = function() {
  if (!_m3GameActive || _m3MoveHistory.length === 0) return;
  _m3Selected = _m3MoveHistory.pop();
  // 重新渲染
  var gameArea = document.getElementById('m3GameArea');
  if (gameArea) _m3RenderTiles(gameArea);
  _m3UpdateBlocked();
  _m3UpdateDisplay();
};

})();
