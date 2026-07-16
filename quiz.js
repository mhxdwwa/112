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
  // v31: Set _quizStateLocallyModified flag to prevent _syncStudentToSupabase
  // and _smartRefreshFromSupabase from overwriting fresh local quiz_state with
  // stale Supabase data (race condition caused pig-run level data loss)
  function saveCoinsAndQuizState(student) {
    if (typeof db === 'undefined' || !db || !student || !student.id) return;
    var quizStateJson = student.quizState ? JSON.stringify(student.quizState) : null;
    var coinsToSave = student.coins;
    // v31: Mark quiz_state as locally modified BEFORE the async save.
    // This prevents _syncStudentToSupabase from fetching stale Supabase data
    // and overwriting the fresh local quiz_state while the save is in flight.
    window._quizStateLocallyModified = true;
    db.from('students').update({
      coins: coinsToSave,
      quiz_state: quizStateJson
    }).eq('id', student.id).then(function(r) {
      if (r.error) {
        console.error('[取金阁] 金币/状态保存失败:', r.error.message);
        // Don't clear the flag on error — let the next sync retry
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
        // v31: Update snapshot to reflect the new quiz_state, so smart refresh
        // comparison (freshQuizState !== snapQuizState) works correctly
        if (typeof _takeSnapshot === 'function') {
          _takeSnapshot();
        }
      }
    });
  }

  // === 直接保存操作日志到 Supabase ===
  // 参考 _writeUnsyncedLogsToSupabase 的模式，但学生可以直接写入
  function saveQuizLogDirect(log) {
    if (typeof db === 'undefined' || !db) return;
    var classId = (typeof currentClassId !== 'undefined') ? currentClassId : parseInt(localStorage.getItem('classId'));
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
      if (existing.length > 5000) existing = existing.slice(0, 5000);

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

    // 合并自定义题目（格式转换）
    if (_dailyCustomQuestions && _dailyCustomQuestions.length > 0) {
      var customFormatted = _dailyCustomQuestions.map(function(cq) {
        return {
          id: 'custom_' + cq.id,
          q: cq.question,
          opts: (cq.options || []).map(function(o, i) { return String.fromCharCode(65 + i) + '. ' + o; }),
          ans: cq.answer,
          exp: cq.explanation || ''
        };
      });
      allQ = allQ.concat(customFormatted);
    }

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
    // 先查自定义题目
    if (questionId.indexOf('custom_') === 0 && _dailyCustomQuestions && _dailyCustomQuestions.length > 0) {
      var customId = questionId.replace('custom_', '');
      for (var j = 0; j < _dailyCustomQuestions.length; j++) {
        var cq = _dailyCustomQuestions[j];
        if (cq.id.toString() === customId.toString()) {
          return {
            id: cq.id,
            q: cq.question,
            opts: (cq.options || []).map(function(o, i) { return String.fromCharCode(65 + i) + '. ' + o; }),
            ans: cq.answer,
            exp: cq.explanation || ''
          };
        }
      }
    }
    // 再查默认题库
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

  // === 获取学生对象（教师选中的学生 或 学生自己）===
  function getCurrentStudent() {
    return getActiveStudent();
  }

  // === 渲染取金阁页面 ===
  function renderQuizPage() {
    var container = document.getElementById('quizContent');
    if (!container) return;

    var isStudentView = typeof currentUser !== 'undefined' && currentUser && currentUser.type === 'student';
    
    if (!isStudentView) {
      // Teacher view
      if (_teacherPlayingAsStudent && _quizModalShown) {
        // Student already selected and modal was shown this visit, show the game
        var student = getActiveStudent();
        if (student) {
          resetQuizIfNeeded(student);
          var state = getQuizState(student);
          var chapter = getCurrentChapter();
          if (!state.started || state.questionsToday.length === 0) {
            renderQuizStart(container, chapter);
          } else if (isAllDone(state)) {
            renderQuizComplete(container, state, student, chapter);
          } else {
            var qIdx = getCurrentQuestionIndex(state);
            var qState = state.questionsToday[qIdx];
            var question = findQuestion(qState.questionId);
            if (question) renderQuizQuestion(container, question, qState, qIdx, state, chapter);
          }
        } else {
          // Student not found, reset
          _teacherPlayingAsStudent = null;
          window._teacherPlayingAsStudent = null;
          _quizModalShown = false;
          container.innerHTML = renderTeacherPlaceholder('dailyQuiz');
        }
      } else {
        // Just show placeholder, wait for tab click to trigger modal
        container.innerHTML = renderTeacherPlaceholder('dailyQuiz');
      }
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

  // === 教师选择学生参赛功能 ===
  // 教师从班级中选择一名学生，以该学生身份进行游戏
  // 成绩、金币、进度都记录在该学生名下
  var _teacherPlayingAsStudent = null; // 教师当前扮演的学生ID
  var _quizModalShown = false; // 标记本次进入是否已弹过选取名单弹窗

  function getActiveStudent() {
    var isStudentView = typeof currentUser !== 'undefined' && currentUser && currentUser.type === 'student';
    if (isStudentView) {
      // 学生自己登录，直接返回自己
      var myStudentId = parseInt(currentUser.studentId);
      var myClassId = parseInt(localStorage.getItem('classId') || currentUser.classId || 0);
      if (!myStudentId || !myClassId) return null;
      var cur = classesData.find(function(c) { return c.id === myClassId || c.id.toString() === myClassId.toString(); });
      if (!cur) return null;
      return cur.students.find(function(s) { return s.id.toString() === myStudentId.toString(); });
    } else {
      // 教师视图：返回教师选择的学生
      if (!_teacherPlayingAsStudent) return null;
      var cid = (typeof currentClassId !== 'undefined') ? currentClassId : parseInt(localStorage.getItem('classId'));
      if (!cid || !classesData) return null;
      var cls = classesData.find(function(c) { return c.id === cid || c.id.toString() === cid.toString(); });
      if (!cls) return null;
      return cls.students.find(function(s) { return s.id.toString() === _teacherPlayingAsStudent.toString(); });
    }
  }

  function getCurrentClassStudents() {
    var cid = (typeof currentClassId !== 'undefined') ? currentClassId : parseInt(localStorage.getItem('classId'));
    if (!cid || !classesData) return [];
    var cls = classesData.find(function(c) { return c.id === cid || c.id.toString() === cid.toString(); });
    return cls ? cls.students : [];
  }

  var _pendingStudentId = null; // 临时记录教师在弹窗中选中的学生ID（未确认开始）
  var _pendingActivityType = null; // 临时记录活动类型

  function showSelectStudentModal(activityType) {
    var students = getCurrentClassStudents();
    var activityName = activityType === 'dailyQuiz' ? '每日一练' : '小猪快跑';
    _pendingStudentId = null;
    _pendingActivityType = activityType;
    _renderStudentListModal(students, activityName, null);
  }

  // 渲染学生列表弹窗（支持两步：先选人，再确认开始）
  function _renderStudentListModal(students, activityName, selectedId) {
    var html = '<div style="position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;" id="selectStudentModal">';
    html += '<div style="background:#fff;border-radius:20px;padding:24px;width:1100px;max-width:95vw;height:650px;max-height:90vh;display:flex;flex-direction:column;box-shadow:0 12px 40px rgba(0,0,0,0.3);">';

    // Header
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">';
    html += '<div style="font-size:18px;font-weight:700;">📋 选取名单 - ' + activityName + '</div>';
    html += '<button onclick="closeSelectStudentModal()" style="background:none;border:none;font-size:24px;cursor:pointer;color:#999;">×</button>';
    html += '</div>';

    // Description
    html += '<div style="font-size:13px;color:#888;margin-bottom:14px;">点击学生姓名选中，然后点击「开始参加比赛」进入游戏。成绩和奖励记录在该学生名下。</div>';

    // Student list - 流式排列，类似批量奖惩（单选）
    html += '<div style="display:flex;flex-wrap:wrap;gap:6px;flex:1;min-height:0;overflow-y:auto;border:1.5px solid rgba(255,210,200,0.6);border-radius:18px;padding:12px;margin-bottom:14px;background:#fffaf5;align-content:flex-start;">';
    students.forEach(function(stu) {
      var isSelected = selectedId && selectedId.toString() === stu.id.toString();
      var bgColor = isSelected ? '#e8ffe8' : '#fff';
      var borderColor = isSelected ? '#52c41a' : '#ffe2d6';
      var checkMark = isSelected ? ' ✓' : '';
      html += '<div onclick="onStudentClickInModal(' + stu.id + ')" id="stuRow_' + stu.id + '" style="display:flex;align-items:center;padding:5px 10px;border:1.5px solid ' + borderColor + ';border-radius:12px;gap:6px;background:' + bgColor + ';font-size:14px;white-space:nowrap;cursor:pointer;transition:all 0.15s;">';
      if (isSelected) {
        html += '<span style="width:16px;height:16px;border-radius:50%;background:#52c41a;color:#fff;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:bold;flex-shrink:0;">✓</span>';
      } else {
        html += '<span style="width:16px;height:16px;border-radius:50%;border:1.5px solid #ddd;flex-shrink:0;"></span>';
      }
      html += '<span style="font-weight:600;">' + escHtml(stu.name || '未命名') + '</span>';
      html += '<span style="font-size:12px;color:#999;">💰' + (stu.coins || 0) + '</span>';
      html += '</div>';
    });
    html += '</div>';

    // 底部操作区：显示「开始参加比赛」按钮（仅当选中了学生后）
    html += '<div id="startCompetitionWrap" style="margin-bottom:10px;text-align:center;' + (selectedId ? '' : 'display:none;') + '">';
    var selStudent = selectedId ? students.find(function(s) { return s.id.toString() === selectedId.toString(); }) : null;
    if (selStudent) {
      html += '<div style="font-size:13px;color:#555;margin-bottom:8px;">已选中：<strong style="color:#389e0d;">' + escHtml(selStudent.name) + '</strong>（💰' + (selStudent.coins || 0) + '金币）</div>';
    }
    html += '<button onclick="startCompetition()" style="background:linear-gradient(135deg,#52c41a,#389e0d);color:#fff;border:none;border-radius:14px;padding:13px 36px;font-size:17px;font-weight:700;cursor:pointer;box-shadow:0 4px 14px rgba(82,196,26,0.4);transition:all 0.2s;width:100%;" onmouseenter="this.style.transform=\'scale(1.02)\'" onmouseleave="this.style.transform=\'scale(1)\'">🏁 开始参加比赛</button>';
    html += '</div>';

    // 取消按钮
    html += '<div style="text-align:center;">';
    html += '<button onclick="closeSelectStudentModal()" style="background:#f0f0f0;color:#666;border:none;border-radius:12px;padding:10px 28px;font-size:14px;font-weight:700;cursor:pointer;">取消</button>';
    html += '</div>';
    html += '</div></div>';

    var container = document.getElementById('modalContainer');
    if (container) container.innerHTML = html;
  }

  // 点击学生行：更新选中状态，显示「开始参加比赛」按钮
  window.onStudentClickInModal = function(studentId) {
    var students = getCurrentClassStudents();
    _pendingStudentId = parseInt(studentId);
    var activityName = _pendingActivityType === 'dailyQuiz' ? '每日一练' : '小猪快跑';
    // 重新渲染弹窗，高亮选中学生并显示开始按钮
    _renderStudentListModal(students, activityName, studentId);
  };

  // 点击「开始参加比赛」：确认选择，进入游戏
  window.startCompetition = function() {
    if (!_pendingStudentId) return;
    _teacherPlayingAsStudent = _pendingStudentId;
    window._teacherPlayingAsStudent = _teacherPlayingAsStudent;
    var activityType = _pendingActivityType;
    // Mark modal as shown so render functions show game instead of modal
    _quizModalShown = true;
    window._pigRunModalShown = true;
    // 关闭弹窗
    closeSelectStudentModal();
    // 显示提示
    var students = getCurrentClassStudents();
    var stu = students.find(function(s) { return s.id === _pendingStudentId; });
    if (stu && typeof showNotification === 'function') {
      showNotification('已选择 ' + stu.name, '正在以该学生身份进入游戏...', 'success');
    }
    // 刷新游戏界面
    if (activityType === 'dailyQuiz') {
      renderQuizPage();
    } else if (activityType === 'pigrun' && typeof renderPigRunPage === 'function') {
      renderPigRunPage();
    }
    _pendingStudentId = null;
    _pendingActivityType = null;
  };

  window.selectStudentForPlay = function(studentId, activityType) {
    // 兼容旧调用：改为走两步流程
    _pendingActivityType = activityType;
    window.onStudentClickInModal(studentId);
  };

  window.closeSelectStudentModal = function() {
    var container = document.getElementById('modalContainer');
    if (container) container.innerHTML = '';
    _pendingStudentId = null;
    _pendingActivityType = null;
  };

  window.showSelectStudentModal = showSelectStudentModal;
  window._teacherPlayingAsStudent = _teacherPlayingAsStudent;
  window.getCurrentClassStudents = getCurrentClassStudents;
  window.renderTeacherSelectView = renderTeacherSelectView;

  function renderTeacherPlaceholder(activityType) {
    var activityName = activityType === 'dailyQuiz' ? '每日一练' : '小猪快跑';
    var icon = activityType === 'dailyQuiz' ? '🏛️' : '🐷';
    var html = '<div style="max-width:500px;margin:0 auto;padding:40px;text-align:center;">';
    html += '<div style="font-size:60px;margin-bottom:16px;">' + icon + '</div>';
    html += '<div style="font-size:18px;font-weight:700;margin-bottom:20px;">' + activityName + '</div>';
    // 两个功能按钮
    html += '<div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;">';
    html += '<button onclick="showSelectStudentModal(\'' + activityType + '\')" style="background:linear-gradient(135deg,#ffd700,#ffaa00);color:#fff;border:none;border-radius:14px;padding:14px 36px;font-size:16px;font-weight:700;cursor:pointer;box-shadow:0 4px 12px rgba(255,200,0,0.3);min-width:140px;">▶ 开始</button>';
    html += '<button onclick="openQuizQuestionManager(\'' + activityType + '\')" style="background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;border:none;border-radius:14px;padding:14px 36px;font-size:16px;font-weight:700;cursor:pointer;box-shadow:0 4px 12px rgba(102,126,234,0.3);min-width:140px;">📚 题库管理</button>';
    html += '</div>';
    html += '</div>';
    return html;
  }

  window._resetQuizModalFlag = function() {
    _quizModalShown = false;
    _teacherPlayingAsStudent = null;
    window._teacherPlayingAsStudent = null;
  };

  window._setQuizModalShown = function(val) {
    _quizModalShown = !!val;
  };

  window.renderTeacherPlaceholder = renderTeacherPlaceholder;

  function renderTeacherSelectView(activityType) {
    var students = getCurrentClassStudents();
    var activityName = activityType === 'dailyQuiz' ? '每日一练' : '小猪快跑';
    var icon = activityType === 'dailyQuiz' ? '🏛️' : '🐷';
    var currentId = _teacherPlayingAsStudent;
    var currentStudent = null;
    if (currentId) {
      currentStudent = students.find(function(s) { return s.id.toString() === currentId.toString(); });
    }

    var html = '<div style="max-width:500px;margin:0 auto;padding:20px;">';
    html += '<div style="text-align:center;margin-bottom:20px;">';
    html += '<div style="font-size:48px;">' + icon + '</div>';
    html += '<div style="font-size:18px;font-weight:700;margin-top:8px;">' + activityName + '</div>';
    html += '</div>';

    // 当前选中学生
    if (currentStudent) {
      html += '<div style="background:#f0fff0;border-radius:12px;padding:14px;margin-bottom:14px;border:2px solid #90ee90;">';
      html += '<div style="font-size:13px;color:#888;margin-bottom:4px;">当前参赛学生：</div>';
      html += '<div style="font-size:18px;font-weight:700;color:#389e0d;">' + currentStudent.name + '</div>';
      html += '<div style="font-size:12px;color:#666;margin-top:4px;">💰 金币: ' + (currentStudent.coins || 0) + '</div>';
      // Show some progress info for pig run
      if (activityType === 'pigrun' && currentStudent.quizState && currentStudent.quizState.pigRunLevels) {
        var levels = currentStudent.quizState.pigRunLevels;
        var clearedCount = Object.keys(levels).filter(function(k) { return levels[k] && levels[k].cleared; }).length;
        var totalScore = currentStudent.quizState.pigRunTotalScore || 0;
        html += '<div style="font-size:12px;color:#666;">🐷 已通关: ' + clearedCount + '关 · 总分: ' + totalScore + '</div>';
      }
      html += '</div>';
    }

    // 选取名单按钮
    html += '<button onclick="showSelectStudentModal(\'' + activityType + '\')" style="width:100%;background:linear-gradient(135deg,#ffd700,#ffaa00);color:#fff;border:none;border-radius:12px;padding:13px;font-size:16px;font-weight:700;cursor:pointer;box-shadow:0 4px 12px rgba(255,200,0,0.3);margin-bottom:10px;">📋 选取名单</button>';

    // 说明
    html += '<div style="font-size:12px;color:#aaa;text-align:center;line-height:1.8;">';
    html += '点击「选取名单」从班级中选择一名学生参加' + activityName + '<br>';
    html += '选中学生后点击「开始参加比赛」进入游戏<br>';
    html += '成绩和奖励将正确记录在该学生名下</div>';
    html += '</div>';
    return html;
  }

  // === 暴露给外部 ===
  window.renderQuizPage = renderQuizPage;
  window.getQuizSummary = getQuizSummary;
  window.getQuizState = getQuizState;
  window.resetQuizIfNeeded = resetQuizIfNeeded;

  // === 题库管理入口 ===
  window.openQuizQuestionManager = function(activityType) {
    if (activityType === 'pigrun') {
      // 小猪快跑题库管理（在 pig-run.js 中定义）
      if (typeof openPigRunQuestionManager === 'function') openPigRunQuestionManager();
    } else {
      // 每日一练题库管理
      openDailyQuizQuestionManager();
    }
  };

  // === 每日一练自定义题库 ===
  var _dailyCustomQuestions = null; // null=未加载, []=已加载但空, [...]=有题目
  var _dailyCustomLoading = false;

  function loadDailyCustomQuestions(teacherId) {
    if (!teacherId || _dailyCustomLoading) return Promise.resolve();
    if (_dailyCustomQuestions !== null) return Promise.resolve();
    _dailyCustomLoading = true;
    if (typeof db === 'undefined' || !db) { _dailyCustomLoading = false; return Promise.resolve(); }
    return db.from('daily_quiz_questions').select('*').eq('teacher_id', teacherId).order('created_at', { ascending: false }).then(function(r) {
      _dailyCustomLoading = false;
      if (r.error) { console.warn('[每日一练] 加载自定义题库失败:', r.error.message); _dailyCustomQuestions = null; return; }
      if (r.data && r.data.length > 0) {
        _dailyCustomQuestions = r.data.map(function(q) {
          var opts = [];
          try { opts = typeof q.options === 'string' ? JSON.parse(q.options) : (q.options || []); } catch(e) { opts = []; }
          return { id: q.id, chapter: q.chapter || '默认', question: q.question || '', options: opts, answer: typeof q.answer === 'number' ? q.answer : 0, explanation: q.explanation || '' };
        });
        console.log('[每日一练] 加载了 ' + _dailyCustomQuestions.length + ' 道自定义题目');
      } else {
        _dailyCustomQuestions = [];
        console.log('[每日一练] 教师无自定义题目，使用默认题库');
      }
    }).catch(function(e) { _dailyCustomLoading = false; console.warn('[每日一练] 加载自定义题库异常:', e); });
  }

  // 教师进入取金阁时自动加载
  var _dailyQuizAutoLoad = function() {
    if (typeof currentUser !== 'undefined' && currentUser && currentUser.type === 'teacher') {
      var teacherId = currentUser.id;
      if (teacherId && _dailyCustomQuestions === null) loadDailyCustomQuestions(teacherId);
    }
  };

  function openDailyQuizQuestionManager() {
    var container = document.getElementById('quizContent');
    if (!container) return;
    var teacherId = (typeof currentUser !== 'undefined' && currentUser) ? currentUser.id : null;
    if (!teacherId) return;
    // 确保题库已加载
    if (_dailyCustomQuestions === null) {
      loadDailyCustomQuestions(teacherId).then(function() { renderDailyQuizManager(container, teacherId); });
    } else {
      renderDailyQuizManager(container, teacherId);
    }
  }

  function renderDailyQuizManager(container, teacherId) {
    var questions = (_dailyCustomQuestions && _dailyCustomQuestions.length > 0) ? _dailyCustomQuestions : [];
    var chapterStats = {};
    questions.forEach(function(q) { var ch = q.chapter || '默认'; chapterStats[ch] = (chapterStats[ch] || 0) + 1; });

    var html = '<div style="max-width:600px;margin:0 auto;padding:12px;">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">';
    html += '<h2 style="font-size:20px;font-weight:800;color:#d4a017;margin:0;">📚 每日一练题库管理</h2>';
    html += '<button onclick="backToDailyQuizLanding()" style="background:#fff;color:#666;border:2px solid #ddd;border-radius:10px;padding:8px 16px;font-size:13px;font-weight:600;cursor:pointer;">← 返回</button>';
    html += '</div>';

    // Stats
    html += '<div style="background:#fff8e6;border-radius:12px;padding:12px;border:1px solid #ffd080;margin-bottom:16px;">';
    html += '<div style="font-size:14px;font-weight:700;color:#b08040;margin-bottom:8px;">题库概况</div>';
    html += '<div style="font-size:13px;color:#555;">自定义题数：<strong>' + questions.length + '</strong>（默认题库 300 题）</div>';
    if (Object.keys(chapterStats).length > 0) {
      html += '<div style="font-size:12px;color:#888;margin-top:4px;">章节分布：';
      var chKeys = Object.keys(chapterStats);
      chKeys.forEach(function(ch, i) { html += ch + '(' + chapterStats[ch] + '题)'; if (i < chKeys.length - 1) html += '、'; });
      html += '</div>';
    }
    html += '<div style="font-size:11px;color:#aaa;margin-top:6px;">自定义题目会与默认题库合并，学生答题时随机抽取</div>';
    html += '</div>';

    // Action buttons
    html += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;">';
    html += '<button onclick="showDailyAddForm()" style="flex:1;min-width:120px;background:#d4a017;color:#fff;border:none;border-radius:10px;padding:10px;font-size:14px;font-weight:700;cursor:pointer;box-shadow:0 2px 8px rgba(212,160,23,0.3);">➕ 手动添加</button>';
    html += '<button onclick="showDailyExcelForm()" style="flex:1;min-width:120px;background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;border:none;border-radius:10px;padding:10px;font-size:14px;font-weight:700;cursor:pointer;box-shadow:0 2px 8px rgba(102,126,234,0.3);">📊 Excel导入</button>';
    html += '<button onclick="downloadDailyTemplate()" style="flex:1;min-width:120px;background:#fff;color:#666;border:2px solid #ddd;border-radius:10px;padding:10px;font-size:14px;font-weight:700;cursor:pointer;">📥 下载模板</button>';
    html += '</div>';

    // Add form (hidden)
    html += '<div id="dailyAddForm" style="display:none;background:#fff;border-radius:12px;padding:16px;border:1px solid #e0e0e0;margin-bottom:16px;">';
    html += '<div style="font-size:15px;font-weight:700;color:#333;margin-bottom:12px;">添加新题目</div>';
    html += '<div style="margin-bottom:8px;"><label style="font-size:12px;color:#888;">章节</label><input id="dailyNewChapter" type="text" placeholder="例：第13章 三角形" style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:8px;font-size:14px;box-sizing:border-box;"></div>';
    html += '<div style="margin-bottom:8px;"><label style="font-size:12px;color:#888;">题目</label><textarea id="dailyNewQuestion" rows="2" placeholder="输入题目内容" style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:8px;font-size:14px;box-sizing:border-box;resize:vertical;"></textarea></div>';
    html += '<div style="margin-bottom:8px;"><label style="font-size:12px;color:#888;">选项A</label><input id="dailyNewOptA" type="text" placeholder="选项A" style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:8px;font-size:14px;box-sizing:border-box;"></div>';
    html += '<div style="margin-bottom:8px;"><label style="font-size:12px;color:#888;">选项B</label><input id="dailyNewOptB" type="text" placeholder="选项B" style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:8px;font-size:14px;box-sizing:border-box;"></div>';
    html += '<div style="margin-bottom:8px;"><label style="font-size:12px;color:#888;">选项C</label><input id="dailyNewOptC" type="text" placeholder="选项C" style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:8px;font-size:14px;box-sizing:border-box;"></div>';
    html += '<div style="margin-bottom:8px;"><label style="font-size:12px;color:#888;">选项D</label><input id="dailyNewOptD" type="text" placeholder="选项D" style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:8px;font-size:14px;box-sizing:border-box;"></div>';
    html += '<div style="margin-bottom:8px;"><label style="font-size:12px;color:#888;">正确答案</label><select id="dailyNewAnswer" style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:8px;font-size:14px;box-sizing:border-box;"><option value="0">A</option><option value="1">B</option><option value="2">C</option><option value="3">D</option></select></div>';
    html += '<div style="margin-bottom:8px;"><label style="font-size:12px;color:#888;">解析（可选）</label><textarea id="dailyNewExp" rows="2" placeholder="题目解析" style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:8px;font-size:14px;box-sizing:border-box;resize:vertical;"></textarea></div>';
    html += '<div style="display:flex;gap:8px;">';
    html += '<button onclick="submitDailyNewQuestion()" style="flex:1;background:#d4a017;color:#fff;border:none;border-radius:10px;padding:10px;font-size:14px;font-weight:700;cursor:pointer;">确认添加</button>';
    html += '<button onclick="hideDailyAddForm()" style="flex:1;background:#fff;color:#666;border:2px solid #ddd;border-radius:10px;padding:10px;font-size:14px;font-weight:700;cursor:pointer;">取消</button>';
    html += '</div></div>';

    // Excel import form (hidden)
    html += '<div id="dailyExcelForm" style="display:none;background:#fff;border-radius:12px;padding:16px;border:1px solid #e0e0e0;margin-bottom:16px;">';
    html += '<div style="font-size:15px;font-weight:700;color:#333;margin-bottom:8px;">📊 Excel批量导入</div>';
    html += '<div style="font-size:12px;color:#888;margin-bottom:12px;line-height:1.6;">';
    html += 'Excel格式：第一行为表头，列顺序为：<br>';
    html += '<strong>章节 | 题目 | 选项A | 选项B | 选项C | 选项D | 正确答案 | 解析（可选）</strong><br>';
    html += '正确答案填字母 A/B/C/D，支持 .xlsx 和 .xls 格式';
    html += '</div>';
    html += '<input type="file" id="dailyExcelFileInput" accept=".xlsx,.xls" style="margin-bottom:12px;">';
    html += '<div id="dailyExcelStatus" style="font-size:13px;color:#666;margin-bottom:8px;min-height:20px;"></div>';
    html += '<div style="display:flex;gap:8px;">';
    html += '<button onclick="processDailyExcelImport()" style="flex:1;background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;border:none;border-radius:10px;padding:10px;font-size:14px;font-weight:700;cursor:pointer;">开始导入</button>';
    html += '<button onclick="hideDailyExcelForm()" style="flex:1;background:#fff;color:#666;border:2px solid #ddd;border-radius:10px;padding:10px;font-size:14px;font-weight:700;cursor:pointer;">取消</button>';
    html += '</div></div>';

    // Question list
    html += '<div style="font-size:14px;font-weight:700;color:#555;margin-bottom:8px;">自定义题目列表（' + questions.length + ' 题）</div>';
    if (questions.length === 0) {
      html += '<div style="text-align:center;padding:30px;background:#fff;border-radius:12px;border:1px solid #e0e0e0;">';
      html += '<div style="font-size:40px;margin-bottom:8px;">📭</div>';
      html += '<div style="font-size:14px;color:#888;">暂无自定义题目</div>';
      html += '<div style="font-size:12px;color:#aaa;margin-top:4px;">学生将使用默认题库（300 题）</div>';
      html += '</div>';
    } else {
      html += '<div style="max-height:400px;overflow-y:auto;">';
      questions.forEach(function(q, idx) {
        html += '<div style="background:#fff;border-radius:10px;padding:12px;border:1px solid #e8e8e8;margin-bottom:8px;">';
        html += '<div style="display:flex;justify-content:space-between;align-items:flex-start;">';
        html += '<div style="flex:1;">';
        html += '<div style="font-size:11px;color:#999;margin-bottom:4px;">' + (q.chapter || '默认') + '</div>';
        html += '<div style="font-size:13px;color:#333;font-weight:600;margin-bottom:6px;">' + (idx + 1) + '. ' + escapeHtmlSimple(q.question) + '</div>';
        var opts = q.options || [];
        var labels = ['A', 'B', 'C', 'D'];
        opts.forEach(function(opt, oi) {
          var isCorrect = oi === q.answer;
          html += '<div style="font-size:12px;color:' + (isCorrect ? '#389e0d' : '#666') + ';margin-left:8px;">' + labels[oi] + '. ' + escapeHtmlSimple(opt) + (isCorrect ? ' ✓' : '') + '</div>';
        });
        html += '</div>';
        html += '<button onclick="deleteDailyQuestion(\'' + q.id + '\')" style="background:#ff4757;color:#fff;border:none;border-radius:8px;padding:4px 10px;font-size:12px;cursor:pointer;flex-shrink:0;margin-left:8px;">删除</button>';
        html += '</div></div>';
      });
      html += '</div>';
      html += '<div style="margin-top:12px;text-align:center;">';
      html += '<button onclick="clearAllDailyQuestions()" style="background:#fff;color:#ff4757;border:2px solid #ff4757;border-radius:10px;padding:8px 20px;font-size:13px;font-weight:600;cursor:pointer;">🗑️ 清空所有题目</button>';
      html += '</div>';
    }
    html += '</div>';
    container.innerHTML = html;
  }

  function escapeHtmlSimple(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  window.backToDailyQuizLanding = function() {
    _quizModalShown = false;
    window._pigRunModalShown = false;
    _teacherPlayingAsStudent = null;
    window._teacherPlayingAsStudent = null;
    renderQuizPage();
  };

  window.showDailyAddForm = function() { var f = document.getElementById('dailyAddForm'); if (f) f.style.display = 'block'; };
  window.hideDailyAddForm = function() { var f = document.getElementById('dailyAddForm'); if (f) f.style.display = 'none'; };
  window.showDailyExcelForm = function() { var f = document.getElementById('dailyExcelForm'); if (f) f.style.display = 'block'; };
  window.hideDailyExcelForm = function() { var f = document.getElementById('dailyExcelForm'); if (f) f.style.display = 'none'; };

  window.submitDailyNewQuestion = function() {
    var teacherId = (typeof currentUser !== 'undefined' && currentUser) ? currentUser.id : null;
    if (!teacherId) return;
    var chapter = document.getElementById('dailyNewChapter').value.trim();
    var question = document.getElementById('dailyNewQuestion').value.trim();
    var optA = document.getElementById('dailyNewOptA').value.trim();
    var optB = document.getElementById('dailyNewOptB').value.trim();
    var optC = document.getElementById('dailyNewOptC').value.trim();
    var optD = document.getElementById('dailyNewOptD').value.trim();
    var answer = parseInt(document.getElementById('dailyNewAnswer').value);
    var explanation = document.getElementById('dailyNewExp').value.trim();
    if (!question) { alert('请输入题目内容'); return; }
    if (!optA || !optB) { alert('至少需要选项A和B'); return; }
    var options = [optA, optB, optC, optD].filter(Boolean);
    if (typeof db === 'undefined' || !db) { alert('数据库未连接'); return; }
    db.from('daily_quiz_questions').insert([{
      teacher_id: teacherId, chapter: chapter || '默认', question: question,
      options: JSON.stringify(options), answer: answer, explanation: explanation || ''
    }]).then(function(r) {
      if (r.error) { alert('添加失败: ' + r.error.message); return; }
      _dailyCustomQuestions = null;
      loadDailyCustomQuestions(teacherId).then(function() {
        var container = document.getElementById('quizContent');
        if (container) renderDailyQuizManager(container, teacherId);
        if (typeof showNotification === 'function') showNotification('成功', '题目已添加', 'success');
      });
    });
  };

  window.deleteDailyQuestion = function(qId) {
    if (!confirm('确定删除这道题目？')) return;
    var teacherId = (typeof currentUser !== 'undefined' && currentUser) ? currentUser.id : null;
    if (!teacherId || typeof db === 'undefined' || !db) return;
    db.from('daily_quiz_questions').delete().eq('id', qId).eq('teacher_id', teacherId).then(function(r) {
      if (r.error) { alert('删除失败: ' + r.error.message); return; }
      _dailyCustomQuestions = null;
      loadDailyCustomQuestions(teacherId).then(function() {
        var container = document.getElementById('quizContent');
        if (container) renderDailyQuizManager(container, teacherId);
      });
    });
  };

  window.clearAllDailyQuestions = function() {
    if (!confirm('确定清空所有自定义题目？此操作不可恢复！')) return;
    if (!confirm('再次确认：清空后学生将使用默认题库，确定继续？')) return;
    var teacherId = (typeof currentUser !== 'undefined' && currentUser) ? currentUser.id : null;
    if (!teacherId || typeof db === 'undefined' || !db) return;
    db.from('daily_quiz_questions').delete().eq('teacher_id', teacherId).then(function(r) {
      if (r.error) { alert('清空失败: ' + r.error.message); return; }
      _dailyCustomQuestions = null;
      loadDailyCustomQuestions(teacherId).then(function() {
        var container = document.getElementById('quizContent');
        if (container) renderDailyQuizManager(container, teacherId);
        if (typeof showNotification === 'function') showNotification('成功', '题库已清空', 'success');
      });
    });
  };

  window.downloadDailyTemplate = function() {
    if (typeof XLSX === 'undefined') {
      var script = document.createElement('script');
      script.src = 'https://cdn.sheetjs.com/xlsx-0.20.0/package/dist/xlsx.full.min.js';
      script.onload = function() { generateDailyTemplateExcel(); };
      script.onerror = function() { alert('Excel库加载失败，请检查网络'); };
      document.head.appendChild(script);
    } else { generateDailyTemplateExcel(); }
  };

  function generateDailyTemplateExcel() {
    var headers = ['章节', '题目', '选项A', '选项B', '选项C', '选项D', '正确答案', '解析'];
    var example = ['第13章 三角形', '下列各组线段中，能组成三角形的是（）', '1, 2, 3', '2, 3, 4', '1, 1, 2', '3, 3, 7', 'B', '三角形三边关系：任意两边之和大于第三边'];
    var ws = XLSX.utils.aoa_to_sheet([headers, example]);
    ws['!cols'] = [{wch:18},{wch:40},{wch:20},{wch:20},{wch:20},{wch:20},{wch:10},{wch:40}];
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '每日一练模板');
    XLSX.writeFile(wb, '每日一练题目模板.xlsx');
  }

  window.processDailyExcelImport = function() {
    var teacherId = (typeof currentUser !== 'undefined' && currentUser) ? currentUser.id : null;
    if (!teacherId) { alert('请先登录教师账号'); return; }
    var fileInput = document.getElementById('dailyExcelFileInput');
    var statusEl = document.getElementById('dailyExcelStatus');
    if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
      if (statusEl) statusEl.innerHTML = '<span style="color:#ff4757;">请先选择Excel文件</span>';
      return;
    }
    if (typeof XLSX === 'undefined') {
      var script = document.createElement('script');
      script.src = 'https://cdn.sheetjs.com/xlsx-0.20.0/package/dist/xlsx.full.min.js';
      script.onload = function() { doDailyExcelImport(teacherId, fileInput.files[0], statusEl); };
      script.onerror = function() { if (statusEl) statusEl.innerHTML = '<span style="color:#ff4757;">Excel库加载失败</span>'; };
      document.head.appendChild(script);
    } else { doDailyExcelImport(teacherId, fileInput.files[0], statusEl); }
  };

  function doDailyExcelImport(teacherId, file, statusEl) {
    if (statusEl) statusEl.innerHTML = '<span style="color:#666;">正在解析文件...</span>';
    var reader = new FileReader();
    reader.onload = function(e) {
      try {
        var data = new Uint8Array(e.target.result);
        var workbook = XLSX.read(data, { type: 'array' });
        var sheet = workbook.Sheets[workbook.SheetNames[0]];
        var jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        if (jsonData.length < 2) { if (statusEl) statusEl.innerHTML = '<span style="color:#ff4757;">文件中没有数据</span>'; return; }
        var questions = [];
        var answerMap = { 'A': 0, 'a': 0, 'B': 1, 'b': 1, 'C': 2, 'c': 2, 'D': 3, 'd': 3 };
        var errors = [];
        for (var i = 1; i < jsonData.length; i++) {
          var row = jsonData[i];
          if (!row || row.length < 3) continue;
          var chapter = (row[0] || '默认').toString().trim();
          var question = (row[1] || '').toString().trim();
          var optA = (row[2] || '').toString().trim();
          var optB = (row[3] || '').toString().trim();
          var optC = (row[4] || '').toString().trim();
          var optD = (row[5] || '').toString().trim();
          var answerRaw = (row[6] || 'A').toString().trim();
          var explanation = (row[7] || '').toString().trim();
          if (!question) { errors.push('第' + (i+1) + '行：题目为空'); continue; }
          if (!optA || !optB) { errors.push('第' + (i+1) + '行：至少需要选项A和B'); continue; }
          var answer = answerMap[answerRaw];
          if (answer === undefined) {
            answer = parseInt(answerRaw);
            if (isNaN(answer) || answer < 0 || answer > 3) { errors.push('第' + (i+1) + '行：正确答案格式错误'); continue; }
          }
          var options = [optA, optB, optC, optD].filter(Boolean);
          questions.push({ teacher_id: teacherId, chapter: chapter, question: question, options: JSON.stringify(options), answer: answer, explanation: explanation });
        }
        if (errors.length > 0 && questions.length === 0) {
          if (statusEl) statusEl.innerHTML = '<span style="color:#ff4757;">发现 ' + errors.length + ' 个错误：<br>' + errors.slice(0, 5).join('<br>') + '</span>';
          return;
        }
        if (questions.length === 0) { if (statusEl) statusEl.innerHTML = '<span style="color:#ff4757;">没有有效的题目可导入</span>'; return; }
        if (statusEl) statusEl.innerHTML = '<span style="color:#666;">正在导入 ' + questions.length + ' 道题目...</span>';
        db.from('daily_quiz_questions').select('question').eq('teacher_id', teacherId).then(function(existingR) {
          var existingQuestions = {};
          if (existingR.data) existingR.data.forEach(function(q) { existingQuestions[q.question] = true; });
          var newQuestions = questions.filter(function(q) { return !existingQuestions[q.question]; });
          var dupCount = questions.length - newQuestions.length;
          if (newQuestions.length === 0) {
            if (statusEl) statusEl.innerHTML = '<span style="color:#ff8800;">所有题目已存在（' + dupCount + ' 道重复）</span>';
            return;
          }
          db.from('daily_quiz_questions').insert(newQuestions).then(function(r) {
            if (r.error) { if (statusEl) statusEl.innerHTML = '<span style="color:#ff4757;">导入失败: ' + r.error.message + '</span>'; return; }
            _dailyCustomQuestions = null;
            loadDailyCustomQuestions(teacherId).then(function() {
              var msg = '成功导入 ' + newQuestions.length + ' 道题目';
              if (dupCount > 0) msg += '（跳过 ' + dupCount + ' 道重复）';
              if (statusEl) statusEl.innerHTML = '<span style="color:#389e0d;">' + msg + '</span>';
              setTimeout(function() {
                var container = document.getElementById('quizContent');
                if (container) renderDailyQuizManager(container, teacherId);
              }, 1000);
            });
          });
        });
      } catch(err) {
        if (statusEl) statusEl.innerHTML = '<span style="color:#ff4757;">文件解析失败: ' + err.message + '</span>';
      }
    };
    reader.readAsArrayBuffer(file);
  }

  console.log('[取金阁] v14 loaded (关卡数据丢失修复)');
})();
