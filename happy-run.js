// 快乐跑一跑 - 集成到取金阁
// v2 - 完整游戏集成，iframe + postMessage 架构

(function() {
  'use strict';

  var gameIframe = null;
  var gameLoaded = false;
  var pendingQuizRequest = false;
  var cachedQuizQuestion = null; // 缓存当前复活答题的题目，确保多次答同一道题

  // === 获取当前学生对象（支持教师扮演学生） ===
  function getCurrentStudent() {
    var isStudentView = typeof currentUser !== 'undefined' && currentUser && currentUser.type === 'student';
    if (isStudentView) {
      var myStudentId = parseInt(currentUser.studentId);
      var myClassId = parseInt(localStorage.getItem('classId') || currentUser.classId || 0);
      if (!myStudentId || !myClassId) return null;
      if (typeof classesData === 'undefined' || !classesData) return null;
      var cur = classesData.find(function(c) { return c.id === myClassId || c.id.toString() === myClassId.toString(); });
      if (!cur) return null;
      return cur.students.find(function(s) { return s.id.toString() === myStudentId.toString(); });
    } else {
      // 教师视图：使用选中的学生
      if (!window._teacherPlayingAsStudent) return null;
      var cid = (typeof currentClassId !== 'undefined') ? currentClassId : parseInt(localStorage.getItem('classId'));
      if (!cid || typeof classesData === 'undefined' || !classesData) return null;
      var cls = classesData.find(function(c) { return c.id === cid || c.id.toString() === cid.toString(); });
      if (!cls) return null;
      return cls.students.find(function(s) { return s.id.toString() === window._teacherPlayingAsStudent.toString(); });
    }
  }

  // === 从学生数据中读取快乐跑存档 ===
  function loadHappyRunData() {
    var student = getCurrentStudent();
    if (!student || !student.quizState) return getDefaultData();
    var qs = student.quizState;
    return {
      maxLevel: qs.happyRunMaxLevel || 1,
      levelScores: qs.happyRunLevels || {},
      levelBestCoins: qs.happyRunLevelBestCoins || {},
      totalSilver: qs.happyRunTotalSilver || 0,
      silverBalance: qs.happyRunSilverBalance || 0,
      petGold: qs.happyRunPetGold || 0,
      ownedChars: qs.happyRunOwnedChars || [0],
      bossKillBonus: qs.happyRunBossKillBonus || {}
    };
  }

  function getDefaultData() {
    return {
      maxLevel: 1,
      levelScores: {},
      levelBestCoins: {},
      totalSilver: 0,
      silverBalance: 0,
      petGold: 0,
      ownedChars: [0],
      bossKillBonus: {}
    };
  }

  // === 保存快乐跑数据到学生记录 ===
  function saveHappyRunData(gameData) {
    var student = getCurrentStudent();
    if (!student) return;
    if (!student.quizState) student.quizState = {};
    var qs = student.quizState;

    qs.happyRunMaxLevel = gameData.maxLevel || 1;
    qs.happyRunLevels = gameData.levelScores || {};
    qs.happyRunLevelBestCoins = gameData.levelBestCoins || {};
    qs.happyRunTotalSilver = gameData.totalSilver || 0;
    qs.happyRunSilverBalance = gameData.silverBalance || 0;
    qs.happyRunPetGold = gameData.petGold || 0;
    qs.happyRunOwnedChars = gameData.ownedChars || [0];
    qs.happyRunBossKillBonus = gameData.bossKillBonus || {};

    // 更新排行榜用的总分（总银币数）
    qs.happyRunTotalScore = gameData.totalSilver || 0;

    // 保存到本地存储（确保 classesData 变更被持久化到 localStorage）
    if (typeof saveClassData === 'function') {
      saveClassData();
    }

    // 保存到 Supabase
    if (typeof saveCoinsAndQuizState === 'function') {
      saveCoinsAndQuizState(student);
    } else if (typeof db !== 'undefined' && db) {
      // 标记 quizState 为本地修改，防止 Realtime 事件覆盖
      window._quizStateLocallyModified = true;
      db.from('students').update({
        coins: student.coins,
        quiz_state: JSON.stringify(qs)
      }).eq('id', student.id).then(function(r) {
        if (r.error) {
          console.error('[快乐跑] 保存失败:', r.error.message);
        } else {
          // 保存成功后更新快照，防止 Realtime echo 覆盖
          if (typeof _lastOwnWriteTime !== 'undefined') {
            window._lastOwnWriteTime = Date.now();
          }
          if (typeof _takeSnapshot === 'function') {
            _takeSnapshot();
          }
        }
      });
    }
  }

  // === 从题库中随机获取一道题 ===
  function getRandomQuestion() {
    if (typeof QUIZ_BANK === 'undefined') return null;
    try {
      var allQuestions = [];
      var chapters = QUIZ_BANK.getChapters ? QUIZ_BANK.getChapters() : null;
      if (!chapters) {
        // Try alternative access
        if (typeof QUIZ_BANK.getAllQuestions === 'function') {
          allQuestions = QUIZ_BANK.getAllQuestions();
        }
      } else {
        for (var i = 0; i < chapters.length; i++) {
          if (chapters[i].questions) {
            allQuestions = allQuestions.concat(chapters[i].questions);
          }
        }
      }
      if (allQuestions.length === 0) return null;
      var idx = Math.floor(Math.random() * allQuestions.length);
      var q = allQuestions[idx];
      return {
        question: q.q,
        options: q.opts,
        correctIndex: q.ans,
        explanation: q.exp || ''
      };
    } catch(e) {
      console.error('[快乐跑] 获取题目失败:', e);
      return null;
    }
  }

  // === 渲染快乐跑一跑页面 ===
  function renderHappyRunPage() {
    var container = document.getElementById('happyRunContent');
    if (!container) return;

    var isStudentView = typeof currentUser !== 'undefined' && currentUser && currentUser.type === 'student';

    if (!isStudentView) {
      // 教师视图
      if (window._teacherPlayingAsStudent && (window._pigRunModalShown || window._happyRunModalShown)) {
        // 教师已选择学生并确认开始 → 进入游戏（继续往下创建 iframe）
        var student = getCurrentStudent();
        if (!student) {
          // 学生数据找不到，重置状态
          window._teacherPlayingAsStudent = null;
          window._happyRunModalShown = false;
          container.innerHTML = (typeof renderTeacherPlaceholder === 'function')
            ? renderTeacherPlaceholder('happyrun')
            : '<div style="text-align:center;padding:40px;"><div style="font-size:60px;">🏃</div><div style="font-size:18px;font-weight:700;margin-top:12px;">快乐跑一跑</div><div style="font-size:14px;color:#888;margin-top:8px;">正在选取参赛学生...</div></div>';
          return;
        }
      } else {
        // 未选择学生，显示占位符（等待点击"开始"触发弹窗）
        container.innerHTML = (typeof renderTeacherPlaceholder === 'function')
          ? renderTeacherPlaceholder('happyrun')
          : '<div style="text-align:center;padding:40px;"><div style="font-size:60px;">🏃</div><div style="font-size:18px;font-weight:700;margin-top:12px;">快乐跑一跑</div><div style="font-size:14px;color:#888;margin-top:8px;">正在选取参赛学生...</div></div>';
        return;
      }
    }

    // 学生视图 / 教师已确认 → 创建游戏 iframe
    container.innerHTML = '';
    
    // 计算最佳尺寸：游戏需要横向 185:90 比例，适配容器宽度
    var containerWidth = container.offsetWidth || window.innerWidth * 0.9;
    var maxGameWidth = Math.min(containerWidth, 1200); // 限制最大宽度
    var gameHeight = Math.round(maxGameWidth * 90 / 185); // 按比例计算高度
    
    var wrapper = document.createElement('div');
    wrapper.style.cssText = 'width:' + maxGameWidth + 'px;height:' + gameHeight + 'px;margin:0 auto;position:relative;background:linear-gradient(135deg, #667eea 0%, #764ba2 100%);border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;';
    
    // 添加加载提示
    var loadingDiv = document.createElement('div');
    loadingDiv.style.cssText = 'text-align:center;color:#fff;';
    loadingDiv.innerHTML = '<div style="font-size:48px;margin-bottom:16px;">🎮</div><div style="font-size:18px;font-weight:bold;">游戏加载中...</div>';
    wrapper.appendChild(loadingDiv);

    gameIframe = document.createElement('iframe');
    gameIframe.style.cssText = 'width:100%;height:100%;border:none;opacity:0;transition:opacity 0.3s;';
    gameIframe.setAttribute('allow', 'autoplay; fullscreen');
    gameIframe.setAttribute('scrolling', 'no');

    wrapper.appendChild(gameIframe);
    container.appendChild(wrapper);

    // 加载游戏 HTML
    gameIframe.src = 'happy-run-game.html';

    // 监听游戏加载完成
    gameIframe.onload = function() {
      gameLoaded = true;
      // 隐藏加载提示，显示游戏
      if(loadingDiv) loadingDiv.style.display = 'none';
      gameIframe.style.opacity = '1';
      // 发送初始化数据
      var data = loadHappyRunData();
      gameIframe.contentWindow.postMessage({
        type: 'happyrun-init',
        data: data
      }, '*');
    };

    // 监听来自游戏的消息
    setupMessageListener();
    
    // 窗口大小变化时重新计算游戏尺寸
    var resizeTimer;
    window.addEventListener('resize', function() {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function() {
        if (wrapper && wrapper.parentNode) {
          var newWidth = Math.min(container.offsetWidth || window.innerWidth * 0.9, 1200);
          var newHeight = Math.round(newWidth * 90 / 185);
          wrapper.style.width = newWidth + 'px';
          wrapper.style.height = newHeight + 'px';
        }
      }, 150);
    });
  }

  // === 设置 postMessage 监听器 ===
  var messageListenerSetup = false;
  function setupMessageListener() {
    if (messageListenerSetup) return;
    messageListenerSetup = true;

    window.addEventListener('message', function(e) {
      var d = e.data;
      if (!d || !d.type) return;

      // 游戏请求保存数据
      if (d.type === 'happyrun-save') {
        saveHappyRunData(d.data);
      }

      // 游戏请求答题
      if (d.type === 'happyrun-quiz-request') {
        pendingQuizRequest = true;
        // 如果是第一次答题（attempts=0），获取新题目；否则使用缓存的同一道题
        var attempts = (d.data && d.data.attempts) || 0;
        if (attempts === 0) {
          cachedQuizQuestion = getRandomQuestion();
        }
        var question = cachedQuizQuestion;
        if (question && gameIframe && gameIframe.contentWindow) {
          gameIframe.contentWindow.postMessage({
            type: 'happyrun-quiz-question',
            data: question
          }, '*');
        } else {
          // 没有题库，直接判对
          if (gameIframe && gameIframe.contentWindow) {
            gameIframe.contentWindow.postMessage({
              type: 'happyrun-quiz-answer',
              data: { correct: true }
            }, '*');
          }
        }
      }

      // 游戏提交答案
      if (d.type === 'happyrun-quiz-select') {
        // 答案验证已在游戏端处理（通过 correctIndex 对比）
        // 这里只需要告诉游戏是否正确
        // 但由于答案在游戏端有 correctIndex，游戏可以自行判断
        // 所以我们不需要在这里做任何事
        // 游戏端会在收到 quiz-question 时保存 correctIndex，
        // 然后在玩家选择时自行判断并调用 handleQuizAnswer
      }
    });
  }

  window.renderHappyRunPage = renderHappyRunPage;

})();
