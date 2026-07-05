// 取金阁 - 答题核心逻辑
// v1

(function() {
  'use strict';

  // === 常量 ===
  var QUESTIONS_PER_DAY = 5;
  var MAX_COINS_PER_DAY = 50;
  var COINS_FIRST_TRY = 10;
  var COINS_SECOND_TRY = 5;
  var COINS_THIRD_PLUS = 0;
  var SEMESTER_START = new Date('2026-02-17'); // 学期开始日期
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

  // === 学生答题状态管理 ===
  function getQuizState(student) {
    if (!student.quizState) {
      student.quizState = {
        lastQuizDate: '',
        todayCoins: 0,
        questionsToday: [],
        totalQuestions: 0
      };
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
    }
  }

  // === 获取今日5道题 ===
  function getTodayQuestions(student) {
    var chapter = getCurrentChapter();
    if (!chapter) return [];
    var state = getQuizState(student);
    var allQ = chapter.questions;

    // 如果今天还没选题，按学生ID+日期随机选5道
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
    return state.questionsToday;
  }

  function hashCode(str) {
    var hash = 0;
    for (var i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + c;
      hash = hash & hash; // Convert to 32bit integer
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
    return -1; // 全部完成
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

      // 加金币
      student.coins += coins;

      // 记录操作日志
      if (typeof recordAction === 'function') {
        var msg = '取金阁答题：' + question.id + ' 第' + qState.attempts + '次答对 +' + coins + '金币';
        recordAction(student.id, student.name, '取金阁', msg, coins, 0, null);
      }

      if (typeof saveClassData === 'function') saveClassData();

      return {
        correct: true,
        coins: coins,
        explanation: question.exp,
        todayCoins: state.todayCoins,
        allDone: isAllDone(state)
      };
    } else {
      // 答错 - 给解析
      if (typeof saveClassData === 'function') saveClassData();
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
      chapter: getCurrentChapter()
    };
  }

  // === 渲染取金阁页面 ===
  function renderQuizPage() {
    var container = document.getElementById('quizContent');
    if (!container) return;

    if (typeof currentClassId === 'undefined' || !currentClassId) {
      container.innerHTML = '<div style="text-align:center;padding:40px;">请先在【宠物管理】页面选择一个班级</div>';
      return;
    }

    var isStudentView = typeof currentUser !== 'undefined' && currentUser && currentUser.type === 'student';
    var myStudentId = isStudentView ? parseInt(currentUser.studentId) : null;

    if (!isStudentView) {
      // 教师视图 - 显示说明
      container.innerHTML = '<div style="text-align:center;padding:40px;line-height:2;">' +
        '<div style="font-size:48px;margin-bottom:16px;">🏛️</div>' +
        '<div style="font-size:18px;font-weight:700;">取金阁 - 学生答题模块</div>' +
        '<div style="font-size:14px;color:#888;margin-top:8px;">学生端每日可答5道数学题获取金币</div>' +
        '<div style="font-size:13px;color:#aaa;margin-top:16px;">第1次答对 +10金币 · 第2次答对 +5金币 · 每日最高50金币</div>' +
        '</div>';
      return;
    }

    var cur = classesData.find(function(c) { return c.id === currentClassId; });
    if (!cur) {
      container.innerHTML = '<div style="text-align:center;padding:40px;">未找到班级数据</div>';
      return;
    }

    var student = cur.students.find(function(s) { return s.id.toString() === myStudentId.toString(); });
    if (!student) {
      container.innerHTML = '<div style="text-align:center;padding:40px;">未找到你的学生信息</div>';
      return;
    }

    resetQuizIfNeeded(student);
    var state = getQuizState(student);
    var summary = getQuizSummary(student);
    var chapter = summary.chapter;

    var html = '<div style="max-width:500px;margin:0 auto;padding:16px;">';

    // 标题和进度
    html += '<div style="text-align:center;margin-bottom:20px;">';
    html += '<div style="font-size:32px;">🏛️</div>';
    html += '<div style="font-size:20px;font-weight:700;margin-top:8px;">取金阁</div>';
    if (chapter) {
      html += '<div style="font-size:14px;color:#888;margin-top:4px;">每日答题 · ' + chapter.title + '</div>';
    }
    html += '</div>';

    // 进度条
    html += '<div style="background:#fff5e6;border-radius:16px;padding:16px;margin-bottom:20px;border:1px solid #ffd080;">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">';
    html += '<span style="font-size:14px;font-weight:600;color:#b08040;">📅 今日进度: ' + summary.done + '/' + summary.total + ' 题</span>';
    html += '<span style="font-size:14px;font-weight:600;color:#d4a017;">💰 今日已获: ' + summary.todayCoins + ' 金币</span>';
    html += '</div>';
    var pct = Math.round((summary.done / summary.total) * 100);
    html += '<div style="height:8px;background:#ffe8c0;border-radius:4px;overflow:hidden;">';
    html += '<div style="height:100%;width:' + pct + '%;background:linear-gradient(90deg,#ffd700,#ffaa00);border-radius:4px;transition:width 0.3s;"></div>';
    html += '</div>';
    html += '</div>';

    if (summary.allDone) {
      // 全部完成
      html += renderQuizDone(state, student);
    } else {
      // 显示当前题目
      var qIdx = getCurrentQuestionIndex(state);
      var qState = state.questionsToday[qIdx];
      var question = findQuestion(qState.questionId);

      if (question) {
        html += renderQuizQuestion(question, qState, qIdx, student);
      }
    }

    html += '</div>';
    container.innerHTML = html;
  }

  function renderQuizQuestion(question, qState, qIdx, student) {
    var html = '';
    var attemptText = qState.attempts > 0 ? ' (第' + (qState.attempts + 1) + '次尝试)' : '';

    html += '<div style="background:#fff;border-radius:16px;padding:20px;box-shadow:0 2px 12px rgba(0,0,0,0.08);border:1px solid #f0e8d8;">';

    // 题目编号
    html += '<div style="font-size:12px;color:#b08040;margin-bottom:12px;">第' + (qIdx + 1) + '题' + attemptText + '</div>';

    // 题目内容
    html += '<div style="font-size:16px;font-weight:600;color:#333;line-height:1.6;margin-bottom:16px;">' + escHtml(question.q) + '</div>';

    // 选项
    for (var i = 0; i < question.opts.length; i++) {
      var optLabel = String.fromCharCode(65 + i); // A, B, C, D
      html += '<div class="quiz-option" onclick="handleQuizAnswer(' + qIdx + ',' + i + ')" style="padding:12px 16px;margin-bottom:8px;border:2px solid #e8e0d0;border-radius:12px;cursor:pointer;transition:all 0.2s;font-size:15px;display:flex;align-items:center;gap:10px;" onmouseenter="this.style.borderColor=\'#ffd700\';this.style.background=\'#fffde8\'" onmouseleave="this.style.borderColor=\'#e8e0d0\';this.style.background=\'#fff\'">';
      html += '<span style="width:28px;height:28px;border-radius:50%;background:#f0e8d8;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;color:#b08040;flex-shrink:0;">' + optLabel + '</span>';
      html += '<span>' + escHtml(question.opts[i].substring(3)) + '</span>'; // 去掉 A. B. C. D. 前缀
      html += '</div>';
    }

    // 提示
    if (qState.attempts > 0) {
      html += '<div style="font-size:13px;color:#e67e22;margin-top:12px;text-align:center;">💡 答错要继续答对这道题才能进入下一题哦！</div>';
    }

    html += '</div>';
    return html;
  }

  function renderQuizDone(state, student) {
    var html = '<div style="background:#fff;border-radius:16px;padding:24px;text-align:center;box-shadow:0 2px 12px rgba(0,0,0,0.08);border:1px solid #e0f0e0;">';
    html += '<div style="font-size:48px;margin-bottom:12px;">✅</div>';
    html += '<div style="font-size:18px;font-weight:700;color:#27ae60;margin-bottom:16px;">今日答题完成！</div>';

    html += '<div style="background:#f8fff8;border-radius:12px;padding:16px;text-align:left;">';
    html += '<div style="font-size:14px;font-weight:600;margin-bottom:8px;">金币明细：</div>';
    var totalAttempts = 0;
    for (var i = 0; i < state.questionsToday.length; i++) {
      var qs = state.questionsToday[i];
      totalAttempts += qs.attempts;
      html += '<div style="font-size:13px;color:#555;padding:2px 0;">第' + (i + 1) + '题: 第' + qs.attempts + '次答对 → +' + qs.coins + ' 金币</div>';
    }
    html += '<div style="border-top:1px solid #e0e0e0;margin-top:8px;padding-top:8px;font-size:15px;font-weight:700;color:#d4a017;">今日获得: ' + state.todayCoins + ' 金币</div>';
    html += '</div>';

    html += '<div style="font-size:13px;color:#888;margin-top:12px;">明天继续来答题吧！</div>';
    html += '</div>';
    return html;
  }

  function escHtml(s) {
    if (!s) return '';
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // === 全局暴露 ===
  window.renderQuizPage = renderQuizPage;
  window.getQuizSummary = getQuizSummary;
  window.getQuizState = getQuizState;
  window.resetQuizIfNeeded = resetQuizIfNeeded;

  // 答题处理（全局）
  window.handleQuizAnswer = function(qIdx, selectedOption) {
    var isStudentView = typeof currentUser !== 'undefined' && currentUser && currentUser.type === 'student';
    if (!isStudentView) return;
    var myStudentId = parseInt(currentUser.studentId);
    var cur = classesData.find(function(c) { return c.id === currentClassId; });
    if (!cur) return;
    var student = cur.students.find(function(s) { return s.id.toString() === myStudentId.toString(); });
    if (!student) return;

    var result = submitAnswer(student, qIdx, selectedOption);

    if (result.error) {
      if (typeof showNotification === 'function') showNotification('错误', result.error, 'error');
      return;
    }

    if (result.correct) {
      // 正确 - 显示解析，延迟进入下一题
      if (typeof showNotification === 'function') {
        showNotification('答对了！', '+' + result.coins + '金币', 'success');
      }
      // 短暂显示解析后刷新
      setTimeout(function() { renderQuizPage(); }, 1200);
    } else {
      // 答错 - 显示解析
      if (typeof showNotification === 'function') {
        showNotification('答错了', '再试一次！' + (result.explanation ? ' ' + result.explanation : ''), 'warning');
      }
      renderQuizPage();
    }
  };

  // === 取金阁金币计入PK资格 ===
  // 在 hasPKQualificationToday 中加入取金阁金币
  var _origHasPK = typeof hasPKQualificationToday === 'function' ? hasPKQualificationToday : null;
  window._quizPKBonus = function(studentId) {
    var cur = classesData.find(function(c) { return c.id === currentClassId; });
    if (!cur) return 0;
    var student = cur.students.find(function(s) { return s.id.toString() === studentId.toString(); });
    if (!student || !student.quizState) return 0;
    var today = new Date().toDateString();
    if (student.quizState.lastQuizDate !== today) return 0;
    return student.quizState.todayCoins || 0;
  };

  console.log('[取金阁] v1 loaded');
})();
