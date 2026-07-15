// 取金阁 - 答题核心逻辑
// v5 - 金币/状态/日志全部直接保存到 Supabase，不依赖 DAL 异步同步

(function() {
  'use strict';

  // === 常量 ===
  var QUESTIONS_PER_DAY = 5;
  var MAX_COINS_PER_DAY = 50;
  var COINS_FIRST_TRY = 10;
  var COINS_SECOND_TRY = 5;
  var COINS_THIRD_PLUS = 0;
  var SEMESTER_START = new Date('2026-02-17');
  var CHAPTER_COUNT = 6;

  // === 获取当前周次和章节 ===
  function getCurrentWeek() {
    var now = new Date();
    var diff = now.getTime() - SEMESTER_START.getTime();
    var week = Math.floor(diff / (7 * 24 * 60 * 60 * 1000)) + 1;
    return Math.max(1, week);
  }

  function getCurrentChapterIndex() {
    var week = getCurrentWeek();
    return (week - 1) % CHAPTER_COUNT;
  }

  function getCurrentChapter() {
    if (typeof QUIZ_BANK === 'undefined') return null;
    return QUIZ_BANK.getChapterByIndex(getCurrentChapterIndex());
  }

  // === 直接保存金币+答题状态到 Supabase（核心修复）===
  // 之前只保存 quiz_state 不保存 coins，导致刷新后金币丢失
  // v30: Only update _myBaseCoins AFTER confirmed write, and set _lastOwnWriteTime
  // to prevent Realtime echo from overwriting with stale data
  function saveCoinsAndQuizState(student) {
    if (typeof db === 'undefined' || !db || !student || !student.id) return;
    var quizStateJson = student.quizState ? JSON.stringify(student.quizState) : null;
    var coinsToSave = student.coins;
    db.from('students').update({
      coins: coinsToSave,
      quiz_state: quizStateJson
    }).eq('id', student.id).then(function(r) {
      if (r.error) {
        console.error('[取金阁] 金币/状态保存失败:', r.error.message);
      } else {
        console.log('[取金阁] 金币(' + coinsToSave + ')+状态 已直接保存');
        // v30: Only update _myBaseCoins after CONFIRMED write
        if (typeof _myBaseCoins !== 'undefined') {
          window._myBaseCoins = coinsToSave;
        }
        // v30: Set _lastOwnWriteTime to protect against Realtime echo
        if (typeof _lastOwnWriteTime !== 'undefined') {
          window._lastOwnWriteTime = Date.now();
        }
      }
    });
  }

  // === 直接保存操作日志到 Supabase ===
  // 参考 _writeUnsyncedLogsToSupabase 的模式，但学生可以直接写入
  function saveQuizLogDirect(log) {
    if (typeof db === 'undefined' || !db) return;
    var classId = parseInt(localStorage.getItem('classId'));
    if (!classId) return;

    // 找到班级的 teacher_id 和 name（upsert classes 表需要这些字段）
    var teacherId = null;
    var className = '';
    if (typeof classesData !== 'undefined' && classesData && classesData.length > 0) {
      var cls = classesData.find(function(c) { return c.id === classId; });
      if (cls) {
        teacherId = cls.teacher_id || null;
        className = cls.name || '';
      }
    }

    // 读取现有日志 → 追加新日志 → 写回
    db.from('classes').select('id, operation_logs_json').eq('id', classId).single().then(function(r) {
      if (r.error) {
        console.error('[取金阁] 读取操作日志失败:', r.error.message);
        return;
      }
      var existing = [];
      try {
        existing = r.data && r.data.operation_logs_json ? JSON.parse(r.data.operation_logs_json) : [];
      } catch(e) { existing = []; }

      // 标记为已同步（直接写入 Supabase 的日志不需要再次同步）
      var syncedLog = Object.assign({}, log, { _synced: true, _fromSupabase: true });
      existing.push(syncedLog);

      // 按时间倒序，最多保留 1000 条
      existing.sort(function(a, b) { return (b.timestamp || '').localeCompare(a.timestamp || ''); });
      if (existing.length > 1000) existing = existing.slice(0, 1000);

      // 标记本地日志为已同步
      if (typeof window.operationLogs !== 'undefined') {
        for (var i = 0; i < window.operationLogs.length; i++) {
          if (window.operationLogs[i].id === log.id) {
            window.operationLogs[i]._synced = true;
            window.operationLogs[i]._fromSupabase = true;
            break;
          }
        }
      }

      // 写回 classes 表
      var upsertData = { id: classId, operation_logs_json: JSON.stringify(existing) };
      if (teacherId) upsertData.teacher_id = teacherId;
      if (className) upsertData.name = className;

      return db.from('classes').upsert([upsertData]).then(function(ur) {
        if (ur.error) {
          console.error('[取金阁] 操作日志保存失败:', ur.error.message);
        } else {
          console.log('[取金阁] 操作日志已直接保存');
        }
      });
    }).catch(function(e) {
      console.error('[取金阁] 操作日志保存异常:', e);
    });
  }

  // === 学生答题状态管理 ===
  function getQuizState(student) {
    if (!student.quizState || typeof student.quizState !== 'object') {
      student.quizState = {
        lastQuizDate: '',
        todayCoins: 0,
        questionsToday: [],
        totalQuestions: 0,
        started: false,
        totalQuizCoins: 0  // 累计答题获得的总金币（仅每日一练，不含其他来源）
      };
    }
    // 兼容旧数据：没有 totalQuizCoins 字段时初始化为 0
    if (typeof student.quizState.totalQuizCoins === 'undefined') {
      student.quizState.totalQuizCoins = 0;
    }
    return student.quizState;
  }

  function resetQuizIfNeeded(student) {
    var today = new Date().toDateString();
    var state = getQuizState(student);
    if (state.lastQuizDate !== today) {
      state.lastQuizDate = today;
      state.todayCoins = 0;
      state.questionsToday = [];
      state.totalQuestions = 0;
      state.started = false;
      // 注意：totalQuizCoins 不重置，它是累计值
    }
  }

  // === 获取今日5道题 ===
  function initTodayQuestions(student) {
    var chapter = getCurrentChapter();
    if (!chapter) return [];
    var state = getQuizState(student);
    var allQ = chapter.questions;

    if (state.questionsToday.length === 0) {
      var today = new Date().toDateString();
      var seed = hashCode(student.id + '_' + today);
      var indices = pickRandomIndices(allQ.length, QUESTIONS_PER_DAY, seed);
      state.questionsToday = indices.map(function(idx) {
        return {
          questionId: allQ[idx].id,
          attempts: 0,
          correct: false,
          coins: 0
        };
      });
    }
    state.started = true;
    return state.questionsToday;
  }

  function hashCode(str) {
    var hash = 0;
    for (var i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + c;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  function pickRandomIndices(max, count, seed) {
    var indices = [];
    var used = {};
    var s = seed;
    while (indices.length < count && indices.length < max) {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      var idx = s % max;
      if (!used[idx]) {
        used[idx] = true;
        indices.push(idx);
      }
    }
    return indices;
  }

  // === 查找题目 ===
  function findQuestion(questionId) {
    if (typeof QUIZ_BANK === 'undefined') return null;
    var all = QUIZ_BANK.getAllQuestions();
    for (var i = 0; i < all.length; i++) {
      if (all[i].id === questionId) return all[i];
    }
    return null;
  }

  // === 当前题目索引 ===
  function getCurrentQuestionIndex(state) {
    for (var i = 0; i < state.questionsToday.length; i++) {
      if (!state.questionsToday[i].correct) return i;
    }
    return -1;
  }

  // === 计算金币 ===
  function calculateCoins(attemptNumber) {
    if (attemptNumber === 1) return COINS_FIRST_TRY;
    if (attemptNumber === 2) return COINS_SECOND_TRY;
    return COINS_THIRD_PLUS;
  }

  // === 提交答案 ===
  function submitAnswer(student, questionIdx, selectedOption) {
    resetQuizIfNeeded(student);
    var state = getQuizState(student);
    var qState = state.questionsToday[questionIdx];
    if (!qState || qState.correct) return { error: '该题已完成' };

    var question = findQuestion(qState.questionId);
    if (!question) return { error: '题目未找到' };

    qState.attempts++;
    var isCorrect = (selectedOption === question.ans);

    if (isCorrect) {
      qState.correct = true;
      var coins = calculateCoins(qState.attempts);
      qState.coins = coins;
      state.todayCoins += coins;
      state.totalQuizCoins = (state.totalQuizCoins || 0) + coins;  // 累计答题金币
      student.coins += coins;

      // 记录操作日志
      var quizLog = null;
      if (typeof recordAction === 'function') {
        var msg = '取金阁答题：' + question.id + ' 第' + qState.attempts + '次答对 +' + coins + '金币';
        recordAction(student.id, student.name, '取金阁', msg, coins, 0, null);
        // 找到刚创建的日志
        if (typeof window.operationLogs !== 'undefined') {
          for (var i = window.operationLogs.length - 1; i >= 0; i--) {
            if (window.operationLogs[i].studentId == student.id &&
                window.operationLogs[i].actionType === '取金阁' &&
                !window.operationLogs[i]._synced) {
              quizLog = window.operationLogs[i];
              break;
            }
          }
        }
      }

      // 直接保存金币+状态+日志到 Supabase（不依赖 DAL 异步同步）
      saveCoinsAndQuizState(student);
      if (quizLog) saveQuizLogDirect(quizLog);

      return {
        correct: true,
        coins: coins,
        explanation: question.exp,
        todayCoins: state.todayCoins,
        allDone: isAllDone(state)
      };
    } else {
      // 答错也要保存状态（防止进度丢失）
      saveCoinsAndQuizState(student);
      return {
        correct: false,
        explanation: question.exp,
        attempts: qState.attempts
      };
    }
  }

  function isAllDone(state) {
    for (var i = 0; i < state.questionsToday.length; i++) {
      if (!state.questionsToday[i].correct) return false;
    }
    return true;
  }

  // === 获取状态摘要 ===
  function getQuizSummary(student) {
    resetQuizIfNeeded(student);
    var state = getQuizState(student);
    var done = 0;
    for (var i = 0; i < state.questionsToday.length; i++) {
      if (state.questionsToday[i].correct) done++;
    }
    return {
      done: done,
      total: QUESTIONS_PER_DAY,
      todayCoins: state.todayCoins,
      allDone: done >= QUESTIONS_PER_DAY,
      chapter: getCurrentChapter(),
      started: state.started
    };
  }

  // === 获取学生对象 ===
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

  // === 渲染取金阁页面 ===
  function renderQuizPage() {
    var container = document.getElementById('quizContent');
    if (!container) return;

    var isStudentView = typeof currentUser !== 'undefined' && currentUser && currentUser.type === 'student';
    
    if (!isStudentView) {
      container.innerHTML = '<div style="text-align:center;padding:40px;line-height:2;">' +
        '<div style="font-size:48px;margin-bottom:16px;">🏛️</div>' +
        '<div style="font-size:18px;font-weight:700;">取金阁 - 学生答题模块</div>' +
        '<div style="font-size:14px;color:#888;margin-top:8px;">学生端每日可答5道数学题获取金币</div>' +
        '<div style="font-size:13px;color:#aaa;margin-top:16px;">第1次答对 +10金币 · 第2次答对 +5金币 · 每日最高50金币</div>' +
        '</div>';
      return;
    }

    var student = getCurrentStudent();
    if (!student) {
      container.innerHTML = '<div style="text-align:center;padding:40px;">未找到你的学生信息</div>';
      return;
    }

    resetQuizIfNeeded(student);
    var state = getQuizState(student);
    var chapter = getCurrentChapter();

    if (!state.started || state.questionsToday.length === 0) {
      renderQuizStart(container, chapter);
      return;
    }

    if (isAllDone(state)) {
      renderQuizComplete(container, state, student, chapter);
      return;
    }

    var qIdx = getCurrentQuestionIndex(state);
    var qState = state.questionsToday[qIdx];
    var question = findQuestion(qState.questionId);

    if (question) {
      renderQuizQuestion(container, question, qState, qIdx, state, chapter);
    }
  }

  // === 开始界面 ===
  function renderQuizStart(container, chapter) {
    var html = '<div style="max-width:500px;margin:0 auto;padding:20px;text-align:center;">';
    html += '<div style="font-size:64px;margin-bottom:20px;">🏛️</div>';
    html += '<div style="font-size:24px;font-weight:700;margin-bottom:12px;">取金阁</div>';
    if (chapter) {
      html += '<div style="font-size:16px;color:#666;margin-bottom:24px;">本周章节：' + chapter.title + '</div>';
    }
    html += '<div style="background:#fff5e6;border-radius:16px;padding:20px;margin-bottom:24px;border:1px solid #ffd080;">';
    html += '<div style="font-size:14px;color:#b08040;line-height:1.8;">';
    html += '📅 每日5道数学题<br>';
    html += '💰 第1次答对 +10金币<br>';
    html += '💰 第2次答对 +5金币<br>';
    html += '🎯 每日最高可获得 50 金币<br>';
    html += '⚔️ 金币可用于宠物PK和萌萌江湖行';
    html += '</div></div>';
    html += '<button onclick="startQuiz()" style="background:linear-gradient(135deg,#ffd700,#ffaa00);color:#fff;border:none;border-radius:25px;padding:14px 40px;font-size:18px;font-weight:700;cursor:pointer;box-shadow:0 4px 15px rgba(255,200,0,0.4);transition:all 0.3s;">';
    html += '🏆 开始取金</button>';
    html += '</div>';
    container.innerHTML = html;
  }

  // === 答题界面 ===
  function renderQuizQuestion(container, question, qState, qIdx, state, chapter) {
    var html = '<div style="max-width:500px;margin:0 auto;padding:16px;">';
    html += '<div style="text-align:center;margin-bottom:16px;">';
    html += '<div style="font-size:28px;">🏛️</div>';
    html += '<div style="font-size:18px;font-weight:700;margin-top:4px;">取金阁</div>';
    if (chapter) {
      html += '<div style="font-size:13px;color:#888;margin-top:2px;">' + chapter.title + '</div>';
    }
    html += '</div>';

    var done = 0;
    for (var i = 0; i < state.questionsToday.length; i++) {
      if (state.questionsToday[i].correct) done++;
    }
    
    html += '<div style="background:#fff5e6;border-radius:12px;padding:12px;margin-bottom:16px;border:1px solid #ffd080;">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">';
    html += '<span style="font-size:13px;font-weight:600;color:#b08040;">📅 进度: ' + done + '/' + QUESTIONS_PER_DAY + '</span>';
    html += '<span style="font-size:13px;font-weight:600;color:#d4a017;">💰 今日: ' + state.todayCoins + ' 金币</span>';
    html += '</div>';
    var pct = Math.round((done / QUESTIONS_PER_DAY) * 100);
    html += '<div style="height:6px;background:#ffe8c0;border-radius:3px;overflow:hidden;">';
    html += '<div style="height:100%;width:' + pct + '%;background:linear-gradient(90deg,#ffd700,#ffaa00);border-radius:3px;transition:width 0.3s;"></div>';
    html += '</div></div>';

    var attemptText = qState.attempts > 0 ? ' (第' + (qState.attempts + 1) + '次尝试)' : '';
    html += '<div style="background:#fff;border-radius:16px;padding:20px;box-shadow:0 2px 12px rgba(0,0,0,0.08);border:1px solid #f0e8d8;">';
    html += '<div style="font-size:12px;color:#b08040;margin-bottom:10px;">第' + (qIdx + 1) + '题' + attemptText + '</div>';
    html += '<div style="font-size:16px;font-weight:600;color:#333;line-height:1.6;margin-bottom:16px;">' + escHtml(question.q) + '</div>';

    for (var i = 0; i < question.opts.length; i++) {
      var optLabel = String.fromCharCode(65 + i);
      html += '<div class="quiz-option" onclick="handleQuizAnswer(' + qIdx + ',' + i + ')" style="padding:12px 16px;margin-bottom:8px;border:2px solid #e8e0d0;border-radius:12px;cursor:pointer;transition:all 0.2s;font-size:15px;display:flex;align-items:center;gap:10px;" onmouseenter="this.style.borderColor=\'#ffd700\';this.style.background=\'#fffde8\'" onmouseleave="this.style.borderColor=\'#e8e0d0\';this.style.background=\'#fff\'">';
      html += '<span style="width:28px;height:28px;border-radius:50%;background:#f0e8d8;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;color:#b08040;flex-shrink:0;">' + optLabel + '</span>';
      html += '<span>' + escHtml(question.opts[i].substring(3)) + '</span>';
      html += '</div>';
    }

    if (qState.attempts > 0) {
      html += '<div style="font-size:13px;color:#e67e22;margin-top:10px;text-align:center;">💡 答错要继续答对这道题才能进入下一题哦！</div>';
    }
    html += '</div></div>';
    container.innerHTML = html;
  }

  // === 答题后结果界面 ===
  function renderQuizAnswerResult(container, question, qState, qIdx, result, state, chapter) {
    var html = '<div style="max-width:500px;margin:0 auto;padding:16px;">';

    var done = 0;
    for (var i = 0; i < state.questionsToday.length; i++) {
      if (state.questionsToday[i].correct) done++;
    }
    
    html += '<div style="background:#fff5e6;border-radius:12px;padding:12px;margin-bottom:16px;border:1px solid #ffd080;">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">';
    html += '<span style="font-size:13px;font-weight:600;color:#b08040;">📅 进度: ' + done + '/' + QUESTIONS_PER_DAY + '</span>';
    html += '<span style="font-size:13px;font-weight:600;color:#d4a017;">💰 今日: ' + state.todayCoins + ' 金币</span>';
    html += '</div>';
    var pct = Math.round((done / QUESTIONS_PER_DAY) * 100);
    html += '<div style="height:6px;background:#ffe8c0;border-radius:3px;overflow:hidden;">';
    html += '<div style="height:100%;width:' + pct + '%;background:linear-gradient(90deg,#ffd700,#ffaa00);border-radius:3px;transition:width 0.3s;"></div>';
    html += '</div></div>';

    if (result.correct) {
      html += '<div style="background:#f0fff0;border-radius:16px;padding:20px;text-align:center;border:2px solid #90ee90;margin-bottom:16px;">';
      html += '<div style="font-size:48px;margin-bottom:10px;">✅</div>';
      html += '<div style="font-size:20px;font-weight:700;color:#27ae60;margin-bottom:8px;">答对了！</div>';
      if (result.coins > 0) {
        html += '<div style="font-size:18px;font-weight:700;color:#d4a017;">+' + result.coins + ' 金币 💰</div>';
      }
      html += '</div>';
    } else {
      html += '<div style="background:#fff5f5;border-radius:16px;padding:20px;text-align:center;border:2px solid #ffb0b0;margin-bottom:16px;">';
      html += '<div style="font-size:48px;margin-bottom:10px;">❌</div>';
      html += '<div style="font-size:20px;font-weight:700;color:#e74c3c;margin-bottom:8px;">答错了</div>';
      html += '<div style="font-size:14px;color:#666;">再试一次吧！</div>';
      html += '</div>';
    }

    if (result.explanation) {
      html += '<div style="background:#fff;border-radius:12px;padding:16px;margin-bottom:16px;border:1px solid #e0e0e0;">';
      html += '<div style="font-size:14px;font-weight:600;color:#666;margin-bottom:8px;">📖 解析</div>';
      html += '<div style="font-size:14px;color:#333;line-height:1.6;">' + escHtml(result.explanation) + '</div>';
      html += '</div>';
    }

    html += '<div style="display:flex;gap:12px;justify-content:center;">';
    html += '<button onclick="continueQuiz()" style="background:linear-gradient(135deg,#ffd700,#ffaa00);color:#fff;border:none;border-radius:20px;padding:12px 28px;font-size:16px;font-weight:700;cursor:pointer;box-shadow:0 4px 12px rgba(255,200,0,0.3);">';
    html += '✨ 继续取金</button>';
    html += '<button onclick="stopQuiz()" style="background:#f0f0f0;color:#666;border:none;border-radius:20px;padding:12px 28px;font-size:16px;font-weight:700;cursor:pointer;">';
    html += '🏠 暂且作罢</button>';
    html += '</div></div>';
    container.innerHTML = html;
  }

  // === 全部完成界面 ===
  function renderQuizComplete(container, state, student, chapter) {
    var html = '<div style="max-width:500px;margin:0 auto;padding:20px;text-align:center;">';
    html += '<div style="font-size:64px;margin-bottom:16px;">🎉</div>';
    html += '<div style="font-size:22px;font-weight:700;color:#d4a017;margin-bottom:8px;">恭喜你获得今日全部宝藏！</div>';
    html += '<div style="font-size:14px;color:#888;margin-bottom:20px;">今日答题全部完成</div>';
    html += '<div style="background:#fff5e6;border-radius:16px;padding:20px;margin-bottom:20px;border:1px solid #ffd080;">';
    html += '<div style="font-size:16px;font-weight:600;color:#b08040;margin-bottom:12px;">📊 今日战绩</div>';
    for (var i = 0; i < state.questionsToday.length; i++) {
      var qs = state.questionsToday[i];
      html += '<div style="font-size:13px;color:#555;padding:4px 0;text-align:left;">第' + (i + 1) + '题: 第' + qs.attempts + '次答对 → +' + qs.coins + ' 金币</div>';
    }
    html += '<div style="border-top:1px solid #ffd080;margin-top:12px;padding-top:12px;font-size:18px;font-weight:700;color:#d4a017;">';
    html += '💰 今日获得: ' + state.todayCoins + ' 金币</div></div>';
    html += '<button onclick="stopQuiz()" style="background:#f0f0f0;color:#666;border:none;border-radius:20px;padding:12px 28px;font-size:16px;font-weight:700;cursor:pointer;">';
    html += '🏠 返回宠物界面</button></div>';
    container.innerHTML = html;
  }

  function escHtml(s) {
    if (!s) return '';
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // === 全局函数 ===
  
  window.startQuiz = function() {
    var student = getCurrentStudent();
    if (!student) {
      if (typeof showNotification === 'function') showNotification('错误', '未找到学生信息', 'error');
      return;
    }
    resetQuizIfNeeded(student);
    initTodayQuestions(student);
    // 直接保存状态到 Supabase
    saveCoinsAndQuizState(student);
    renderQuizPage();
  };

  window.continueQuiz = function() {
    renderQuizPage();
  };

  window.stopQuiz = function() {
    if (typeof switchPage === 'function') {
      switchPage('class-pet-page');
    }
  };

  window.handleQuizAnswer = function(qIdx, selectedOption) {
    var student = getCurrentStudent();
    if (!student) {
      if (typeof showNotification === 'function') showNotification('错误', '未找到学生信息', 'error');
      return;
    }

    var result = submitAnswer(student, qIdx, selectedOption);

    if (result.error) {
      if (typeof showNotification === 'function') showNotification('错误', result.error, 'error');
      return;
    }

    var container = document.getElementById('quizContent');
    if (!container) return;

    var state = getQuizState(student);
    var chapter = getCurrentChapter();
    var qState = state.questionsToday[qIdx];
    var question = findQuestion(qState.questionId);

    renderQuizAnswerResult(container, question, qState, qIdx, result, state, chapter);
  };

  // === 暴露给外部 ===
  window.renderQuizPage = renderQuizPage;
  window.getQuizSummary = getQuizSummary;
  window.getQuizState = getQuizState;
  window.resetQuizIfNeeded = resetQuizIfNeeded;

  console.log('[取金阁] v5 loaded (coins+state+logs 全部直接保存)');
})();
