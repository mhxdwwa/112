// 小猪快跑 - 集成到取金阁
// v1 - 小猪快跑游戏模块

(function() {
  'use strict';

  // === 取金阁标签切换 ===
  function switchQuizTab(tabName) {
    document.querySelectorAll('.quiz-tab').forEach(function(t) { t.classList.remove('active'); });
    document.querySelectorAll('.quiz-tab-content').forEach(function(c) { c.classList.remove('active'); });
    var tabs = document.querySelectorAll('.quiz-tab');
    var idx = tabName === 'daily' ? 0 : 1;
    if (tabs[idx]) tabs[idx].classList.add('active');
    var contentId = tabName === 'daily' ? 'quizDailyContent' : 'quizPigRunContent';
    var content = document.getElementById(contentId);
    if (content) content.classList.add('active');
    // Initialize pig run content when switching to it
    if (tabName === 'pigrun') {
      setTimeout(function() { renderPigRunPage(); }, 100);
    }
  }
  window.switchQuizTab = switchQuizTab;

  // === 获取当前学生 ===
  function getCurrentStudent() {
    var isStudentView = typeof currentUser !== 'undefined' && currentUser && currentUser.type === 'student';
    if (!isStudentView) return null;
    var myStudentId = parseInt(currentUser.studentId);
    var myClassId = parseInt(localStorage.getItem('classId') || currentUser.classId || 0);
    if (!myStudentId || !myClassId) return null;
    var cur = classesData.find(function(c) { return c.id === myClassId; });
    if (!cur) return null;
    return cur.students.find(function(s) { return s.id.toString() === myStudentId.toString(); });
  }

  // === 保存小猪快跑分数到 Supabase ===
  // pigRunScore 存储在 quiz_state JSON 中（复用已有字段，无需修改数据库结构）
  function savePigRunScore(student, newScore) {
    if (!student || !student.id) return;
    // Initialize quiz_state if needed
    if (!student.quizState || typeof student.quizState !== 'object') {
      student.quizState = {
        lastQuizDate: '',
        todayCoins: 0,
        questionsToday: [],
        totalQuestions: 0,
        started: false,
        pigRunScore: 0
      };
    }
    // Add to total pig run score stored in quiz_state
    student.quizState.pigRunScore = (student.quizState.pigRunScore || 0) + newScore;
    student.pigRunScore = student.quizState.pigRunScore; // cache on student object
    // Save to Supabase via existing quiz state save mechanism
    if (typeof saveCoinsAndQuizState === 'function') {
      saveCoinsAndQuizState(student);
    } else if (typeof db !== 'undefined' && db) {
      var quizStateJson = JSON.stringify(student.quizState);
      db.from('students').update({
        quiz_state: quizStateJson
      }).eq('id', student.id).then(function(r) {
        if (r.error) {
          console.error('[小猪快跑] 分数保存失败:', r.error.message);
        } else {
          console.log('[小猪快跑] 分数已保存: ' + student.quizState.pigRunScore);
        }
      });
    }
    // Record action log
    if (typeof recordAction === 'function') {
      var msg = '小猪快跑 +' + newScore + '分 (总分:' + student.quizState.pigRunScore + ')';
      recordAction(student.id, student.name, '小猪快跑', msg, 0, 0, null);
    }
    // Save log to Supabase
    if (typeof saveQuizLogDirect === 'function' && window.operationLogs) {
      for (var i = window.operationLogs.length - 1; i >= 0; i--) {
        if (window.operationLogs[i].studentId == student.id &&
            window.operationLogs[i].actionType === '小猪快跑' &&
            !window.operationLogs[i]._synced) {
          saveQuizLogDirect(window.operationLogs[i]);
          break;
        }
      }
    }
    // Trigger sync
    if (typeof triggerRealtimeSync === 'function') triggerRealtimeSync();
  }

  // === 渲染小猪快跑页面 ===
  function renderPigRunPage() {
    var container = document.getElementById('pigRunContent');
    if (!container) return;

    var isStudentView = typeof currentUser !== 'undefined' && currentUser && currentUser.type === 'student';

    if (!isStudentView) {
      // Teacher view
      container.innerHTML = '<div class="pig-run-teacher-view">' +
        '<div style="font-size:64px;margin-bottom:16px;">🐷</div>' +
        '<div style="font-size:20px;font-weight:700;margin-bottom:12px;">小猪快跑</div>' +
        '<div style="font-size:14px;color:#888;margin-bottom:20px;">学生通过点击小猪帮助它们逃脱，获得积分</div>' +
        '<div style="background:#f0fff0;border-radius:16px;padding:20px;margin-bottom:20px;border:1px solid #90ee90;">' +
        '<div style="font-size:14px;color:#555;line-height:2;">' +
        '🐷 点击小猪让它们按方向跑<br>' +
        '🏆 成功逃脱每只 +5分<br>' +
        '🎯 通关额外 +30分<br>' +
        '📝 答对题目可获取道具<br>' +
        '⚔️ 积分可用于小猪快跑排行榜' +
        '</div></div>' +
        '<div style="font-size:13px;color:#aaa;">学生登录后即可开始游戏</div>' +
        '</div>';
      return;
    }

    var student = getCurrentStudent();
    if (!student) {
      container.innerHTML = '<div style="text-align:center;padding:40px;">未找到你的学生信息</div>';
      return;
    }

    // Initialize pig run state
    if (!student.quizState || typeof student.quizState !== 'object') {
      student.quizState = {
        lastQuizDate: '',
        todayCoins: 0,
        questionsToday: [],
        totalQuestions: 0,
        started: false,
        pigRunScore: 0
      };
    }
    if (!student.quizState.pigRunScore) student.quizState.pigRunScore = 0;
    student.pigRunScore = student.quizState.pigRunScore;

    if (!student.pigRunState) {
      student.pigRunState = {
        lastPlayDate: '',
        todayScore: 0
      };
    }
    var today = new Date().toDateString();
    if (student.pigRunState.lastPlayDate !== today) {
      student.pigRunState.lastPlayDate = today;
      student.pigRunState.todayScore = 0;
    }

    // Render the game
    renderPigRunGame(container, student);
  }
  window.renderPigRunPage = renderPigRunPage;

  // === PLACEHOLDER: renderPigRunGame - 实际游戏渲染 ===
  function renderPigRunGame(container, student) {
    var html = '<div style="max-width:500px;margin:0 auto;padding:16px;text-align:center;">';
    // Score display
    html += '<div style="background:#f0fff0;border-radius:12px;padding:12px;margin-bottom:16px;border:1px solid #90ee90;">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;">';
    html += '<span style="font-size:13px;font-weight:600;color:#389e0d;">🐷 今日得分: ' + student.pigRunState.todayScore + '</span>';
    html += '<span style="font-size:13px;font-weight:600;color:#d4a017;">🏆 总分: ' + (student.quizState.pigRunScore || 0) + '</span>';
    html += '</div></div>';
    // Game area
    html += '<div id="pigRunGameArea" style="position:relative;width:100%;max-width:430px;margin:0 auto;aspect-ratio:9/16;background:linear-gradient(180deg,#d9ff8a 0%,#9be26b 30%,#76c543 70%,#4d8a28 100%);border-radius:16px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,0.15);">';
    html += '<div style="position:absolute;top:0;left:0;width:100%;height:100%;display:flex;align-items:center;justify-content:center;flex-direction:column;">';
    html += '<div style="font-size:80px;margin-bottom:20px;">🐷</div>';
    html += '<div style="font-size:20px;font-weight:700;color:#fff;text-shadow:0 2px 4px rgba(0,0,0,0.3);margin-bottom:16px;">小猪快跑</div>';
    html += '<button id="pigRunStartBtn" style="background:linear-gradient(135deg,#ffd700,#ffaa00);color:#fff;border:none;border-radius:25px;padding:14px 40px;font-size:18px;font-weight:700;cursor:pointer;box-shadow:0 4px 15px rgba(255,200,0,0.4);transition:all 0.3s;">';
    html += '🏁 开始游戏</button>';
    html += '</div>';
    html += '</div>';
    // Instructions
    html += '<div style="margin-top:16px;padding:12px;background:#fff;border-radius:12px;border:1px solid #e0e0e0;text-align:left;">';
    html += '<div style="font-size:13px;font-weight:600;color:#666;margin-bottom:6px;">📖 游戏规则</div>';
    html += '<div style="font-size:12px;color:#888;line-height:1.8;">';
    html += '1. 点击"开始游戏"后，棋盘上会出现许多小猪<br>';
    html += '2. 每只小猪面朝一个方向，点击它会沿该方向跑<br>';
    html += '3. 跑到棋盘边缘即可逃脱，每只 +5分<br>';
    html += '4. 如果被其他小猪挡住则无法逃脱<br>';
    html += '5. 全部逃脱后通关，额外 +30分<br>';
    html += '6. 道具用完后答对数学题可获得更多道具';
    html += '</div></div>';
    html += '</div>';
    container.innerHTML = html;

    // Bind start button
    var startBtn = document.getElementById('pigRunStartBtn');
    if (startBtn) {
      startBtn.addEventListener('click', function() {
        startPigRunGame(student);
      });
    }
  }

  // === PLACEHOLDER: startPigRunGame - 开始实际游戏 ===
  function startPigRunGame(student) {
    var gameArea = document.getElementById('pigRunGameArea');
    if (!gameArea) return;

    // Clear and build game board
    gameArea.innerHTML = '';
    gameArea.style.background = '';

    // Build game UI
    var gameHtml = '';
    // Top bar
    gameHtml += '<div style="position:absolute;top:0;left:0;width:100%;padding:12px 16px;display:flex;justify-content:space-between;align-items:center;z-index:100;gap:8px;">';
    gameHtml += '<div style="display:flex;align-items:center;gap:8px;">';
    gameHtml += '<button id="pigPauseBtn" style="width:40px;height:40px;border-radius:12px;background:#fff;border:2px solid #e8e8e8;font-size:18px;cursor:pointer;box-shadow:0 3px 0 #d0d0d0;display:flex;align-items:center;justify-content:center;">⏸</button>';
    gameHtml += '<div id="pigTimeDisplay" style="background:#fff;padding:6px 12px;border-radius:12px;font-weight:bold;color:#333;font-size:16px;border:2px solid #e8e8e8;box-shadow:0 3px 0 #d0d0d0;min-width:70px;text-align:center;">00:00</div>';
    gameHtml += '</div>';
    gameHtml += '<div style="display:flex;align-items:center;gap:6px;background:#fff;padding:6px 16px;border-radius:20px;font-weight:bold;color:#f5a623;font-size:18px;box-shadow:0 3px 0 #e0c080;">';
    gameHtml += '<span>🪙</span><span id="pigCoinCount">0</span>';
    gameHtml += '</div>';
    gameHtml += '<div style="font-size:24px;font-weight:900;color:#fff;text-shadow:0 2px 0 rgba(0,0,0,0.2);letter-spacing:2px;">第<span id="pigLevelNum">1</span>关</div>';
    gameHtml += '<button id="pigSoundBtn" style="width:40px;height:40px;border-radius:12px;background:#fff;border:2px solid #e8e8e8;font-size:18px;cursor:pointer;box-shadow:0 3px 0 #d0d0d0;display:flex;align-items:center;justify-content:center;">🔊</button>';
    gameHtml += '</div>';

    // Game board
    gameHtml += '<div id="pigGameBoard" style="position:absolute;top:65px;bottom:105px;left:10px;right:10px;width:calc(100% - 20px);height:calc(100% - 170px);z-index:10;"></div>';

    // Bottom bar with tools
    gameHtml += '<div style="position:absolute;bottom:0;left:0;width:100%;padding:12px 20px 20px;display:flex;justify-content:space-around;align-items:center;background:linear-gradient(0deg,rgba(90,184,58,0.6) 0%,transparent 100%);z-index:100;">';
    gameHtml += '<div class="pig-tool-btn" id="pigRemoveTool" style="position:relative;display:flex;flex-direction:column;align-items:center;gap:2px;background:#ffe066;border:3px solid #ffb800;border-radius:14px;padding:6px 12px;cursor:pointer;min-width:80px;box-shadow:0 4px 0 #e0a000;">';
    gameHtml += '<span style="font-size:28px;" id="pigRemoveIcon">🗑</span>';
    gameHtml += '<span style="font-size:15px;font-weight:900;color:#8b5a2b;">移除</span>';
    gameHtml += '<span id="pigRemoveCount" style="position:absolute;top:-8px;right:-8px;background:#ff4757;color:white;font-size:13px;width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:bold;border:2px solid #fff;">1</span>';
    gameHtml += '</div>';
    gameHtml += '<div class="pig-tool-btn" id="pigShuffleTool" style="position:relative;display:flex;flex-direction:column;align-items:center;gap:2px;background:#ffe066;border:3px solid #ffb800;border-radius:14px;padding:6px 12px;cursor:pointer;min-width:80px;box-shadow:0 4px 0 #e0a000;">';
    gameHtml += '<span style="font-size:28px;" id="pigShuffleIcon">🔀</span>';
    gameHtml += '<span style="font-size:15px;font-weight:900;color:#8b5a2b;">洗牌</span>';
    gameHtml += '<span id="pigShuffleCount" style="position:absolute;top:-8px;right:-8px;background:#ff4757;color:white;font-size:13px;width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:bold;border:2px solid #fff;">1</span>';
    gameHtml += '</div>';
    gameHtml += '<div class="pig-tool-btn" id="pigRotateTool" style="position:relative;display:flex;flex-direction:column;align-items:center;gap:2px;background:#ffe066;border:3px solid #ffb800;border-radius:14px;padding:6px 12px;cursor:pointer;min-width:80px;box-shadow:0 4px 0 #e0a000;">';
    gameHtml += '<span style="font-size:28px;" id="pigRotateIcon">🔄</span>';
    gameHtml += '<span style="font-size:15px;font-weight:900;color:#8b5a2b;">转向</span>';
    gameHtml += '<span id="pigRotateCount" style="position:absolute;top:-8px;right:-8px;background:#ff4757;color:white;font-size:13px;width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:bold;border:2px solid #fff;">1</span>';
    gameHtml += '</div>';
    gameHtml += '</div>';

    // Pause mask
    gameHtml += '<div id="pigPauseMask" style="position:absolute;inset:0;background:rgba(0,0,0,0.6);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:150;opacity:0;pointer-events:none;transition:opacity 0.3s ease;">';
    gameHtml += '<div style="font-size:36px;font-weight:900;color:#fff;margin-bottom:30px;letter-spacing:4px;">游戏暂停</div>';
    gameHtml += '<button id="pigResumeBtn" style="background:#52c41a;color:white;border:none;padding:14px 40px;border-radius:30px;font-size:20px;cursor:pointer;font-weight:bold;box-shadow:0 4px 0 #389e0d;margin-bottom:16px;">▶ 继续游戏</button>';
    gameHtml += '</div>';

    // Win modal
    gameHtml += '<div id="pigWinModal" style="position:absolute;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:200;opacity:0;pointer-events:none;transition:opacity 0.3s ease;">';
    gameHtml += '<div style="background:#fff;padding:32px 40px;border-radius:20px;text-align:center;box-shadow:0 12px 40px rgba(0,0,0,0.3);">';
    gameHtml += '<div style="font-size:28px;font-weight:900;color:#333;margin-bottom:20px;">🎉 全部逃脱成功！</div>';
    gameHtml += '<div id="pigWinScore" style="font-size:18px;color:#52c41a;font-weight:700;margin-bottom:16px;"></div>';
    gameHtml += '<button id="pigNextLevelBtn" style="background:#52c41a;color:white;border:none;padding:12px 32px;border-radius:26px;font-size:18px;cursor:pointer;font-weight:bold;box-shadow:0 4px 0 #389e0d;">下一关</button>';
    gameHtml += '</div></div>';

    gameArea.innerHTML = gameHtml;

    // Start the actual game
    initPigRunEngine(student);
  }

  // === PLACEHOLDER: initPigRunEngine - 游戏引擎 ===
  function initPigRunEngine(student) {
    var COLS = 7, ROWS = 10;
    var PIG_SCALE = 0.96;
    var CELL_W = 100 / COLS;
    var CELL_H = 100 / ROWS;
    var MOVE_SPEED = 85;

    var DIRS = {
      up:    { dx: 0, dy: -1 },
      down:  { dx: 0, dy: 1 },
      left:  { dx: -1, dy: 0 },
      right: { dx: 1, dy: 0 }
    };

    var gState = {
      level: 1,
      coins: 0,
      pigs: [],
      tools: { remove: 1, shuffle: 1, rotate: 1 },
      activeTool: null,
      animating: false,
      soundEnabled: true,
      paused: false,
      timeSeconds: 0,
      timer: null
    };

    var board = document.getElementById('pigGameBoard');
    var levelNumEl = document.getElementById('pigLevelNum');
    var coinCountEl = document.getElementById('pigCoinCount');
    var timeDisplayEl = document.getElementById('pigTimeDisplay');
    var winModal = document.getElementById('pigWinModal');
    var winScoreEl = document.getElementById('pigWinScore');
    var nextBtn = document.getElementById('pigNextLevelBtn');
    var removeBtn = document.getElementById('pigRemoveTool');
    var shuffleBtn = document.getElementById('pigShuffleTool');
    var rotateBtn = document.getElementById('pigRotateTool');
    var removeCnt = document.getElementById('pigRemoveCount');
    var shuffleCnt = document.getElementById('pigShuffleCount');
    var rotateCnt = document.getElementById('pigRotateCount');
    var removeIcon = document.getElementById('pigRemoveIcon');
    var shuffleIcon = document.getElementById('pigShuffleIcon');
    var rotateIcon = document.getElementById('pigRotateIcon');
    var pauseBtn = document.getElementById('pigPauseBtn');
    var pauseMask = document.getElementById('pigPauseMask');
    var resumeBtn = document.getElementById('pigResumeBtn');
    var soundBtn = document.getElementById('pigSoundBtn');

    if (!board) return;

    // Timer
    function formatTime(seconds) {
      var m = Math.floor(seconds / 60).toString().padStart(2, '0');
      var s = (seconds % 60).toString().padStart(2, '0');
      return m + ':' + s;
    }

    function startTimer() {
      if (gState.timer) clearInterval(gState.timer);
      gState.timer = setInterval(function() {
        if (!gState.paused) {
          gState.timeSeconds++;
          timeDisplayEl.textContent = formatTime(gState.timeSeconds);
        }
      }, 1000);
    }

    function stopTimer() {
      if (gState.timer) { clearInterval(gState.timer); gState.timer = null; }
    }

    function togglePause() {
      gState.paused = !gState.paused;
      if (gState.paused) {
        pauseBtn.textContent = '▶';
        pauseMask.style.opacity = '1';
        pauseMask.style.pointerEvents = 'all';
      } else {
        pauseBtn.textContent = '⏸';
        pauseMask.style.opacity = '0';
        pauseMask.style.pointerEvents = 'none';
      }
    }

    // Level generation
    function generateLevel(level) {
      var pigs = [];
      var fillRate = Math.min(0.92, 0.75 + level * 0.035);
      for (var y = 0; y < ROWS; y++) {
        for (var x = 0; x < COLS; x++) {
          if (Math.random() > fillRate) continue;
          var isHorizontal = Math.random() > 0.5;
          var dir = isHorizontal
            ? (y % 2 === 0 ? 'right' : 'left')
            : (x % 2 === 0 ? 'down' : 'up');
          pigs.push({ x: x, y: y, dir: dir });
        }
      }
      return pigs;
    }

    function loadLevel(level) {
      board.innerHTML = '';
      gState.pigs = [];
      gState.activeTool = null;
      gState.animating = false;

      var data = generateLevel(level);
      data.forEach(function(d, i) {
        var el = createPig(d.x, d.y, d.dir, i);
        gState.pigs.push({ id: i, x: d.x, y: d.y, dir: d.dir, el: el });
        placePig(el, d.x, d.y);
      });

      levelNumEl.textContent = level;
    }

    function createPig(x, y, dir, id) {
      var pig = document.createElement('div');
      pig.style.cssText = 'position:absolute;cursor:pointer;z-index:10;transition:left 0.085s linear,top 0.085s linear;will-change:left,top;';
      pig.dataset.id = id;
      pig.dataset.dir = dir;

      var inner = document.createElement('div');
      inner.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;background-image:url("images/小猪.png");background-size:contain;background-position:center;background-repeat:no-repeat;pointer-events:none;transform:scale(1.7);';
      pig.appendChild(inner);

      pig.addEventListener('click', function(e) {
        e.stopPropagation();
        if (gState.paused || gState.animating) return;
        onPigClick(id);
      });
      return pig;
    }

    function placePig(el, x, y) {
      var gapX = ((1 - PIG_SCALE) / 2) * CELL_W;
      var gapY = ((1 - PIG_SCALE) / 2) * CELL_H;
      el.style.left = 'calc(' + (x * CELL_W) + '% + ' + gapX + '%)';
      el.style.top = 'calc(' + (y * CELL_H) + '% + ' + gapY + '%)';
      el.style.width = 'calc(' + (CELL_W * PIG_SCALE) + '%)';
      el.style.height = 'calc(' + (CELL_H * PIG_SCALE) + '%)';
      board.appendChild(el);
    }

    function onPigClick(id) {
      if (gState.animating) return;
      var pig = gState.pigs.find(function(p) { return p.id === id; });
      if (!pig) return;

      if (gState.activeTool === 'remove') {
        doRemove(id);
        gState.activeTool = null;
        updateToolUI();
        return;
      }

      if (gState.activeTool === 'rotate') {
        doRotate(id);
        gState.activeTool = null;
        updateToolUI();
        return;
      }

      runPig(pig);
    }

    function runPig(pig) {
      gState.animating = true;
      var dx = DIRS[pig.dir].dx;
      var dy = DIRS[pig.dir].dy;
      var gapX = ((1 - PIG_SCALE) / 2) * CELL_W;
      var gapY = ((1 - PIG_SCALE) / 2) * CELL_H;

      function step() {
        if (gState.pigs.indexOf(pig) === -1) { gState.animating = false; return; }
        var nx = pig.x + dx;
        var ny = pig.y + dy;

        if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) {
          escapeOut(pig);
          return;
        }

        var hit = gState.pigs.some(function(p) { return p.id !== pig.id && p.x === nx && p.y === ny; });
        if (hit) {
          gState.animating = false;
          return;
        }

        pig.x = nx;
        pig.y = ny;
        pig.el.style.left = 'calc(' + (nx * CELL_W) + '% + ' + gapX + '%)';
        pig.el.style.top = 'calc(' + (ny * CELL_H) + '% + ' + gapY + '%)';

        setTimeout(step, MOVE_SPEED);
      }
      setTimeout(step, 40);
    }

    function escapeOut(pig) {
      pig.el.style.transition = 'left 0.35s ease-in, top 0.35s ease-in, opacity 0.35s ease-in';
      var dx = DIRS[pig.dir].dx;
      var dy = DIRS[pig.dir].dy;
      var boardW = board.offsetWidth;
      var boardH = board.offsetHeight;

      var finalLeft = parseFloat(pig.el.style.left);
      var finalTop = parseFloat(pig.el.style.top);

      if (dx > 0) finalLeft = boardW + 50;
      if (dx < 0) finalLeft = -100;
      if (dy > 0) finalTop = boardH + 50;
      if (dy < 0) finalTop = -100;

      pig.el.style.left = finalLeft + 'px';
      pig.el.style.top = finalTop + 'px';
      pig.el.style.opacity = '0';

      setTimeout(function() {
        gState.pigs = gState.pigs.filter(function(p) { return p.id !== pig.id; });
        pig.el.remove();
        gState.coins += 5;
        updateUI();
        gState.animating = false;
        checkWin();
      }, 350);
    }

    function doRemove(id) {
      var pig = gState.pigs.find(function(p) { return p.id === id; });
      if (!pig) return;
      gState.tools.remove--;
      pig.el.style.transition = 'transform 0.25s ease, opacity 0.25s ease';
      pig.el.style.transform = 'scale(0)';
      pig.el.style.opacity = '0';
      setTimeout(function() {
        gState.pigs = gState.pigs.filter(function(p) { return p.id !== id; });
        pig.el.remove();
        checkWin();
      }, 250);
    }

    function doRotate(id) {
      var pig = gState.pigs.find(function(p) { return p.id === id; });
      if (!pig) return;
      gState.tools.rotate--;
      var order = ['up', 'right', 'down', 'left'];
      var idx = order.indexOf(pig.dir);
      pig.dir = order[(idx + 1) % 4];
      var inner = pig.el.querySelector('div');
      if (inner) {
        var rot = pig.dir === 'up' ? 'rotate(180deg)' : pig.dir === 'left' ? 'rotate(90deg)' : pig.dir === 'right' ? 'rotate(-90deg)' : 'rotate(0deg)';
        inner.style.transform = rot + ' scale(1.7)';
      }
      updateUI();
    }

    function doShuffle() {
      if (gState.tools.shuffle <= 0 || gState.animating) return;
      gState.tools.shuffle--;
      var allPositions = [];
      for (var y = 0; y < ROWS; y++) {
        for (var x = 0; x < COLS; x++) {
          allPositions.push({ x: x, y: y });
        }
      }
      for (var i = allPositions.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var tmp = allPositions[i]; allPositions[i] = allPositions[j]; allPositions[j] = tmp;
      }
      var gapX = ((1 - PIG_SCALE) / 2) * CELL_W;
      var gapY = ((1 - PIG_SCALE) / 2) * CELL_H;
      gState.pigs.forEach(function(pig, index) {
        var pos = allPositions[index];
        pig.x = pos.x; pig.y = pos.y;
        pig.el.style.left = 'calc(' + (pos.x * CELL_W) + '% + ' + gapX + '%)';
        pig.el.style.top = 'calc(' + (pos.y * CELL_H) + '% + ' + gapY + '%)';
      });
      updateUI();
    }

    function checkWin() {
      if (gState.pigs.length === 0) {
        var levelScore = gState.coins + 30;
        gState.coins += 30;
        setTimeout(function() {
          winModal.style.opacity = '1';
          winModal.style.pointerEvents = 'all';
          winScoreEl.textContent = '本关得分: +' + levelScore + '分';
          stopTimer();
          // Save score to student
          savePigRunScore(student, levelScore);
          student.pigRunState.todayScore += levelScore;
          updateUI();
        }, 300);
      }
    }

    function nextLevel() {
      gState.level++;
      winModal.style.opacity = '0';
      winModal.style.pointerEvents = 'none';
      gState.tools.remove = Math.min(gState.tools.remove + 1, 5);
      gState.tools.shuffle = Math.min(gState.tools.shuffle + 1, 3);
      gState.tools.rotate = Math.min(gState.tools.rotate + 1, 3);
      gState.timeSeconds = 0;
      timeDisplayEl.textContent = '00:00';
      startTimer();
      loadLevel(gState.level);
      updateUI();
    }

    function updateUI() {
      coinCountEl.textContent = gState.coins;
      updateToolUI();
    }

    function updateToolUI() {
      removeCnt.textContent = gState.tools.remove;
      shuffleCnt.textContent = gState.tools.shuffle;
      rotateCnt.textContent = gState.tools.rotate;
      removeIcon.textContent = gState.tools.remove > 0 ? '🗑' : '📝';
      shuffleIcon.textContent = gState.tools.shuffle > 0 ? '🔀' : '📝';
      rotateIcon.textContent = gState.tools.rotate > 0 ? '🔄' : '📝';
    }

    // Bind events
    nextBtn.addEventListener('click', nextLevel);
    pauseBtn.addEventListener('click', togglePause);
    resumeBtn.addEventListener('click', togglePause);
    soundBtn.addEventListener('click', function() {
      gState.soundEnabled = !gState.soundEnabled;
      soundBtn.textContent = gState.soundEnabled ? '🔊' : '🔇';
    });

    removeBtn.addEventListener('click', function() {
      if (gState.paused) return;
      if (gState.tools.remove > 0) {
        gState.activeTool = gState.activeTool === 'remove' ? null : 'remove';
        removeBtn.style.borderColor = gState.activeTool === 'remove' ? '#ff4757' : '#ffb800';
        shuffleBtn.style.borderColor = '#ffb800';
        rotateBtn.style.borderColor = '#ffb800';
      }
    });
    shuffleBtn.addEventListener('click', function() {
      if (gState.paused) return;
      if (gState.tools.shuffle > 0) doShuffle();
    });
    rotateBtn.addEventListener('click', function() {
      if (gState.paused) return;
      if (gState.tools.rotate > 0) {
        gState.activeTool = gState.activeTool === 'rotate' ? null : 'rotate';
        rotateBtn.style.borderColor = gState.activeTool === 'rotate' ? '#ff4757' : '#ffb800';
        removeBtn.style.borderColor = '#ffb800';
        shuffleBtn.style.borderColor = '#ffb800';
      }
    });

    // Init first level
    loadLevel(gState.level);
    updateUI();
    startTimer();
  }

  console.log('[小猪快跑] v1 loaded');
})();
