// 快乐跑一跑 - 集成到取金阁
// v2 - 完整游戏集成，iframe + postMessage 架构

(function() {
  'use strict';

  var gameIframe = null;
  var gameLoaded = false;
  var pendingQuizRequest = false;
  var cachedQuizQuestion = null; // 缓存当前复活答题的题目，确保多次答同一道题
  var _actionLogTimer = null; // 操作日志防抖定时器
  var _pendingLogChanges = []; // 累积的日志变更
  var _lastLogSnapshot = null; // 上次记录日志时的状态快照
  var _gameWrapper = null; // 游戏容器引用
  var _isGameFullscreen = false; // 游戏是否处于全屏模式
  var _savedWrapperStyle = ''; // 保存wrapper原始样式
  var _savedBodyOverflow = ''; // 保存body原始overflow

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

    // 保存旧状态用于比较（生成操作日志）
    var oldMaxLevel = qs.happyRunMaxLevel || 1;
    var oldTotalSilver = qs.happyRunTotalSilver || 0;
    var oldPetGold = qs.happyRunPetGold || 0;
    var oldLevelScores = qs.happyRunLevels || {};
    var oldOwnedChars = qs.happyRunOwnedChars || [0];

    // 更新状态
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
      saveClassData('level', { level: gameData.maxLevel, silver: gameData.totalSilver });
    }

    // 保存到 Supabase
    if (typeof saveCoinsAndQuizState === 'function') {
      saveCoinsAndQuizState(student);
    } else if (window.USE_API && window.ApiMigration && window.ApiMigration.saveQuizState) {
      // v166: 只保存 quiz_state，不传 coins（快乐跑不直接修改学生金币，避免绝对值覆盖）
      window._quizStateLocallyModified = true;
      window.ApiMigration.saveQuizState(student.id, null, JSON.stringify(qs)).then(function(r) {
        if (r.ok) {
          try { _lastOwnWriteTime = Date.now(); } catch(e) {}
          if (typeof _takeSnapshot === 'function') _takeSnapshot();
        } else {
          console.error('[v166] API happy-run save error:', r.error);
        }
      });
    } else if (typeof db !== 'undefined' && db) {
      // 标记 quizState 为本地修改，防止 Realtime 事件覆盖
      window._quizStateLocallyModified = true;
      // v166: 只保存 quiz_state，不写 coins（快乐跑不修改学生金币，避免覆盖并发操作）
      db.from('students').update({
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

    // === 记录操作日志（防抖合并，每个关卡只记录一条） ===
    if (typeof recordAction === 'function') {
      var changes = [];
      var newMaxLevel = gameData.maxLevel || 1;
      var newTotalSilver = gameData.totalSilver || 0;
      var newPetGold = gameData.petGold || 0;
      var newLevelScores = gameData.levelScores || {};
      var newOwnedChars = gameData.ownedChars || [0];

      // Use the last logged snapshot as baseline (or old state if first time)
      var baselineMaxLevel = _lastLogSnapshot ? _lastLogSnapshot.maxLevel : oldMaxLevel;
      var baselineTotalSilver = _lastLogSnapshot ? _lastLogSnapshot.totalSilver : oldTotalSilver;
      var baselinePetGold = _lastLogSnapshot ? _lastLogSnapshot.petGold : oldPetGold;
      var baselineLevelScores = _lastLogSnapshot ? _lastLogSnapshot.levelScores : oldLevelScores;
      var baselineOwnedChars = _lastLogSnapshot ? _lastLogSnapshot.ownedChars : oldOwnedChars;

      // 检测新解锁的关卡
      if (newMaxLevel > baselineMaxLevel) {
        for (var lv = baselineMaxLevel + 1; lv <= newMaxLevel; lv++) {
          var score = newLevelScores[lv] || 0;
          changes.push('解锁第' + lv + '关(' + score + '分)');
        }
      }

      // 检测刷新的高分
      Object.keys(newLevelScores).forEach(function(lvKey) {
        var lv = parseInt(lvKey);
        var newScore = newLevelScores[lvKey] || 0;
        var oldScore = (baselineLevelScores[lvKey]) || 0;
        if (lv <= baselineMaxLevel && newScore > oldScore) {
          changes.push('第' + lv + '关提高' + (newScore - oldScore) + '分');
        }
      });

      // 检测银币变化
      var silverDiff = newTotalSilver - baselineTotalSilver;
      if (silverDiff > 0) {
        changes.push('+' + silverDiff + '银币');
      }

      // 检测宠物金币变化
      var goldDiff = newPetGold - baselinePetGold;
      if (goldDiff > 0) {
        changes.push('+' + goldDiff + '宠物金币');
      }

      // 检测新购买的角色
      if (newOwnedChars.length > baselineOwnedChars.length) {
        var newChars = newOwnedChars.filter(function(c) { return baselineOwnedChars.indexOf(c) === -1; });
        if (newChars.length > 0) {
          changes.push('解锁' + newChars.length + '个角色');
        }
      }

      // 如果有变化，累积到待记录队列并更新快照
      if (changes.length > 0) {
        _pendingLogChanges = _pendingLogChanges.concat(changes);
        // Update snapshot to current state
        _lastLogSnapshot = {
          maxLevel: newMaxLevel,
          totalSilver: newTotalSilver,
          petGold: newPetGold,
          levelScores: JSON.parse(JSON.stringify(newLevelScores)),
          ownedChars: newOwnedChars.slice()
        };
        
        // Debounce: wait 1 second before flushing to log
        // This merges multiple rapid saves into a single log entry
        if (_actionLogTimer) clearTimeout(_actionLogTimer);
        _actionLogTimer = setTimeout(function() {
          if (_pendingLogChanges.length > 0) {
            var student = getCurrentStudent();
            if (student) {
              var msg = '快乐跑一跑：' + _pendingLogChanges.join('，') + '，总分:' + (gameData.totalSilver || 0);
              recordAction(student.id, student.name, '快乐跑一跑', msg, 0, 0, null);
              if (typeof triggerRealtimeSync === 'function') {
                triggerRealtimeSync();
              }
            }
            _pendingLogChanges = [];
          }
        }, 1000);
      }
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

  // === 手机端全屏系统 ===
  function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || (window.innerWidth <= 768);
  }

  function isMobilePortrait() {
    return window.innerWidth <= 768 && window.innerHeight > window.innerWidth;
  }

  // 进入游戏全屏模式 - 不移动DOM，用position:fixed覆盖整个视口
  function enterGameFullscreen() {
    if (_isGameFullscreen) return;
    if (!_gameWrapper) return;
    _isGameFullscreen = true;

    // 1. 保存wrapper原始样式
    _savedWrapperStyle = _gameWrapper.style.cssText;

    // 2. 锁定body滚动
    _savedBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // 3. 让wrapper用position:fixed覆盖整个视口（不移DOM！）
    _gameWrapper.style.position = 'fixed';
    _gameWrapper.style.top = '0';
    _gameWrapper.style.left = '0';
    _gameWrapper.style.width = '100vw';
    _gameWrapper.style.height = '100vh';
    _gameWrapper.style.zIndex = '2147483647';
    _gameWrapper.style.background = '#000';
    _gameWrapper.style.margin = '0';
    _gameWrapper.style.padding = '0';
    _gameWrapper.style.borderRadius = '0';
    _gameWrapper.style.boxShadow = 'none';
    _gameWrapper.style.overflow = 'hidden';

    // 4. 如果是竖屏，旋转wrapper为横屏
    if (isMobilePortrait()) {
      var vw = window.innerWidth;
      var vh = window.innerHeight;
      _gameWrapper.style.width = vh + 'px';
      _gameWrapper.style.height = vw + 'px';
      _gameWrapper.style.transform = 'rotate(90deg)';
      _gameWrapper.style.transformOrigin = 'center center';
      _gameWrapper.style.left = ((vw - vh) / 2) + 'px';
      _gameWrapper.style.top = ((vh - vw) / 2) + 'px';
    }

    // 5. 确保iframe填满wrapper
    if (gameIframe) {
      gameIframe.style.width = '100%';
      gameIframe.style.height = '100%';
    }

    // 6. 通知iframe已进入全屏
    if (gameIframe && gameIframe.contentWindow) {
      gameIframe.contentWindow.postMessage({ type: 'happyrun-fullscreen-entered' }, '*');
    }

    // 7. 尝试使用 Fullscreen API（隐藏浏览器UI，更好的沉浸体验）
    try {
      var fsElem = document.documentElement;
      var fsPromise;
      if (fsElem.requestFullscreen) {
        fsPromise = fsElem.requestFullscreen();
      } else if (fsElem.webkitRequestFullscreen) {
        fsPromise = Promise.resolve(fsElem.webkitRequestFullscreen());
      } else if (fsElem.msRequestFullscreen) {
        fsPromise = Promise.resolve(fsElem.msRequestFullscreen());
      }
      if (fsPromise && fsPromise.then) {
        fsPromise.then(function() {
          // 锁定横屏方向
          if (screen.orientation && screen.orientation.lock) {
            screen.orientation.lock('landscape').catch(function() {});
          }
        }).catch(function() {});
      }
    } catch(e) {}

    // 8. 监听方向变化
    window.addEventListener('orientationchange', _onOrientationChange);
    window.addEventListener('resize', _onResizeCheck);
  }

  // 退出游戏全屏模式 - 恢复wrapper原始样式
  function exitGameFullscreen() {
    if (!_isGameFullscreen) return;
    _isGameFullscreen = false;

    // 1. 恢复wrapper原始样式
    if (_gameWrapper) {
      _gameWrapper.style.cssText = _savedWrapperStyle;
    }

    // 2. 恢复body滚动
    document.body.style.overflow = _savedBodyOverflow;

    // 3. 通知iframe已退出全屏
    if (gameIframe && gameIframe.contentWindow) {
      gameIframe.contentWindow.postMessage({ type: 'happyrun-fullscreen-exited' }, '*');
    }

    // 4. 移除监听器
    window.removeEventListener('orientationchange', _onOrientationChange);
    window.removeEventListener('resize', _onResizeCheck);
  }

  function _onOrientationChange() {
    setTimeout(function() {
      if (_isGameFullscreen && window.innerWidth > window.innerHeight) {
        // 切到横屏了，重新调整wrapper
        if (_gameWrapper) {
          _gameWrapper.style.transform = '';
          _gameWrapper.style.width = '100vw';
          _gameWrapper.style.height = '100vh';
          _gameWrapper.style.left = '0';
          _gameWrapper.style.top = '0';
        }
      } else if (_isGameFullscreen && window.innerWidth <= window.innerHeight) {
        // 切回竖屏，保持全屏但旋转为横屏显示
        if (_gameWrapper) {
          var vw = window.innerWidth;
          var vh = window.innerHeight;
          _gameWrapper.style.width = vh + 'px';
          _gameWrapper.style.height = vw + 'px';
          _gameWrapper.style.transform = 'rotate(90deg)';
          _gameWrapper.style.transformOrigin = 'center center';
          _gameWrapper.style.left = ((vw - vh) / 2) + 'px';
          _gameWrapper.style.top = ((vh - vw) / 2) + 'px';
        }
        // 再次尝试锁定横屏
        if (screen.orientation && screen.orientation.lock) {
          screen.orientation.lock('landscape').catch(function() {});
        }
      }
    }, 300);
  }

  function _onResizeCheck() {
    if (_isGameFullscreen && window.innerWidth > window.innerHeight) {
      // 横屏状态，确保wrapper正确
      if (_gameWrapper && !_gameWrapper.style.transform) {
        _gameWrapper.style.width = '100vw';
        _gameWrapper.style.height = '100vh';
      }
    }
  }

  // 监听Fullscreen API退出事件
  document.addEventListener('fullscreenchange', function() {
    if (!document.fullscreenElement && _isGameFullscreen) {
      // 用户通过系统手势退出了全屏
      exitGameFullscreen();
    }
  });
  document.addEventListener('webkitfullscreenchange', function() {
    if (!document.webkitFullscreenElement && _isGameFullscreen) {
      exitGameFullscreen();
    }
  });

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
    wrapper.id = 'happyRunGameWrapper';
    wrapper.style.cssText = 'width:' + maxGameWidth + 'px;height:' + gameHeight + 'px;margin:0 auto;position:relative;background:linear-gradient(135deg, #667eea 0%, #764ba2 100%);border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;';
    _gameWrapper = wrapper;
    
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

      // 游戏开始 - 进入全屏模式（所有设备）
      if (d.type === 'happyrun-start-game') {
        enterGameFullscreen();
      }

      // 游戏请求退出全屏
      if (d.type === 'happyrun-exit-fullscreen') {
        exitGameFullscreen();
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
