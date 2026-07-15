// 小猪快跑 - 集成到取金阁
// v15 - 修复关卡数据丢失：配合quiz.js v14的竞态条件修复

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
    
    // Check if teacher view
    var isStudentView = typeof currentUser !== 'undefined' && currentUser && currentUser.type === 'student';
    
    // Reset selection state so modal shows again each tab switch
    window._teacherPlayingAsStudent = null;
    window._pigRunModalShown = false;
    if (typeof window._resetQuizModalFlag === 'function') window._resetQuizModalFlag();
    
    if (tabName === 'pigrun') {
      setTimeout(function() { 
        renderPigRunPage(); 
      }, 100);
    } else if (tabName === 'daily') {
      setTimeout(function() { 
        renderQuizPage(); 
        // 教师进入每日一练时自动加载自定义题库
        if (!isStudentView && typeof _dailyQuizAutoLoad === 'function') _dailyQuizAutoLoad();
      }, 100);
    }
  }
  window.switchQuizTab = switchQuizTab;

  // === 获取当前学生（教师选中的学生 或 学生自己）===
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
      // Teacher view: use the selected student
      if (!window._teacherPlayingAsStudent) return null;
      var cid = (typeof currentClassId !== 'undefined') ? currentClassId : parseInt(localStorage.getItem('classId'));
      if (!cid || !classesData) return null;
      var cls = classesData.find(function(c) { return c.id === cid || c.id.toString() === cid.toString(); });
      if (!cls) return null;
      return cls.students.find(function(s) { return s.id.toString() === window._teacherPlayingAsStudent.toString(); });
    }
  }

  // === 初始化学生的小猪快跑状态 ===
  function ensurePigRunState(student) {
    if (!student.quizState || typeof student.quizState !== 'object') {
      student.quizState = { lastQuizDate: '', todayCoins: 0, questionsToday: [], totalQuestions: 0, started: false, totalQuizCoins: 0 };
    }
    if (!student.quizState.pigRunLevels) student.quizState.pigRunLevels = {};
    // 兼容旧数据：迁移旧 pigRunScore
    if (!student.quizState.pigRunTotalScore && student.quizState.pigRunScore) {
      student.quizState.pigRunTotalScore = student.quizState.pigRunScore;
    }
    if (!student.quizState.pigRunTotalScore) student.quizState.pigRunTotalScore = 0;
    
    // 修复：重新计算总分，确保是各关卡最高分之和（防止旧数据累积错误）
    var calculatedTotal = 0;
    Object.keys(student.quizState.pigRunLevels).forEach(function(k) {
      calculatedTotal += student.quizState.pigRunLevels[k].bestScore || 0;
    });
    // 如果计算结果与存储值不同，使用计算结果（修复旧数据）
    if (calculatedTotal !== student.quizState.pigRunTotalScore) {
      student.quizState.pigRunTotalScore = calculatedTotal;
    }
    
    return student.quizState;
  }

  // === 计算关卡得分 ===
  // 基础分 = 小猪数量 * 5
  // 时间分 = max(10, 320 - floor((timeSeconds - pigCount) * 2))
  // 关卡总分 = 基础分 + 时间分
  function calcLevelScore(pigCount, timeSeconds) {
    var baseScore = pigCount * 5;
    var timeBonus = Math.max(10, 320 - Math.floor(Math.max(0, timeSeconds - pigCount) * 2));
    return baseScore + timeBonus;
  }

  // === 保存关卡成绩到 Supabase ===
  function saveLevelResult(student, level, pigCount, timeSeconds, isFirstClear) {
    var qs = ensurePigRunState(student);
    var levelScore = calcLevelScore(pigCount, timeSeconds);
    var levelKey = String(level);

    // 金币奖励（仅首次通关）
    // 双重检查：确保该关卡之前没有获得过金币
    var prevBest = qs.pigRunLevels[levelKey] || null;
    var alreadyEarnedCoins = prevBest && prevBest.coinsEarned > 0;
    
    var coinReward = 0;
    if (isFirstClear && !alreadyEarnedCoins) {
      // 金币奖励：80%概率得3-5金币，20%概率得6-9金币
      var rand = Math.random();
      if (rand < 0.2667) coinReward = 3;
      else if (rand < 0.5333) coinReward = 4;
      else if (rand < 0.80) coinReward = 5;
      else if (rand < 0.85) coinReward = 6;
      else if (rand < 0.90) coinReward = 7;
      else if (rand < 0.95) coinReward = 8;
      else coinReward = 9;
      
      student.coins += coinReward;
    }

    // 记录或更新该关卡最佳成绩
    var prevScore = prevBest ? prevBest.bestScore : 0;
    var scoreDiff = levelScore - prevScore;

    if (!prevBest || levelScore > prevBest.bestScore) {
      qs.pigRunLevels[levelKey] = {
        bestTime: (!prevBest || timeSeconds < prevBest.bestTime) ? timeSeconds : prevBest.bestTime,
        bestScore: Math.max(levelScore, prevScore),
        coinsEarned: alreadyEarnedCoins ? prevBest.coinsEarned : (isFirstClear ? coinReward : 0),
        cleared: true
      };
    }

    // 更新总分：各关卡最高分之和
    qs.pigRunTotalScore = 0;
    Object.keys(qs.pigRunLevels).forEach(function(k) {
      qs.pigRunTotalScore += qs.pigRunLevels[k].bestScore || 0;
    });
    student.quizState = qs;

    // 保存到 Supabase
    if (typeof saveCoinsAndQuizState === 'function') {
      saveCoinsAndQuizState(student);
    } else if (typeof db !== 'undefined' && db) {
      db.from('students').update({
        coins: student.coins,
        quiz_state: JSON.stringify(qs)
      }).eq('id', student.id).then(function(r) {
        if (r.error) console.error('[小猪快跑] 保存失败:', r.error.message);
      });
    }

    // 记录操作日志
    if (typeof recordAction === 'function') {
      var msg = '小猪快跑第' + level + '关：' + levelScore + '分(基础' + (pigCount * 5) + '+时间' + (levelScore - pigCount * 5) + ')';
      if (isFirstClear) msg += '，获' + coinReward + '金币';
      else if (scoreDiff > 0) msg += '，提高' + scoreDiff + '分';
      msg += '，总分:' + qs.pigRunTotalScore;
      recordAction(student.id, student.name, '小猪快跑', msg, coinReward, 0, null);
    }
    if (typeof saveQuizLogDirect === 'function' && window.operationLogs) {
      for (var i = window.operationLogs.length - 1; i >= 0; i--) {
        if (window.operationLogs[i].studentId == student.id && window.operationLogs[i].actionType === '小猪快跑' && !window.operationLogs[i]._synced) {
          saveQuizLogDirect(window.operationLogs[i]);
          break;
        }
      }
    }
    if (typeof triggerRealtimeSync === 'function') triggerRealtimeSync();

    return { levelScore: levelScore, coinReward: coinReward, isFirstClear: isFirstClear, totalScore: qs.pigRunTotalScore, prevScore: prevScore, scoreDiff: scoreDiff };
  }

  // === 注入 CSS 样式（忠实于原始小猪快跑.html）===
  function injectStyles() {
    if (document.getElementById('pigRunStyles')) return;
    var style = document.createElement('style');
    style.id = 'pigRunStyles';
    style.textContent = [
      '.pig-run-wrap{position:relative;width:100%;max-width:430px;margin:0 auto;background:linear-gradient(180deg,#7bc043 0%,#5ea832 30%,#4a8f26 70%,#3a7a1d 100%);border-radius:0;padding-bottom:10px;}',
      '#pigRunContent{background:linear-gradient(180deg,#7bc043 0%,#5ea832 30%,#4a8f26 70%,#3a7a1d 100%);margin:-20px -20px 0;padding:20px 20px 10px;border-radius:0 0 24px 24px;}',
      '.pig-run-wrap *{margin:0;padding:0;box-sizing:border-box;user-select:none;}',
      '.pig-game-container{position:relative;width:100%;aspect-ratio:9/16;background:radial-gradient(circle at 10% 10%,rgba(255,255,255,0.15) 0%,transparent 50%),radial-gradient(circle at 90% 18%,rgba(255,255,255,0.12) 0%,transparent 45%),radial-gradient(circle at 15% 85%,rgba(255,255,255,0.12) 0%,transparent 45%),linear-gradient(180deg,#6aaf35 0%,#5ea832 30%,#4a8f26 70%,#3a7a1d 100%);border-radius:0;overflow:hidden;box-shadow:none;}',
      '.pig-game-container::before{content:"";position:absolute;inset:0;background-image:radial-gradient(circle at 20% 30%,rgba(255,255,255,0.18) 0%,transparent 35%),radial-gradient(circle at 80% 20%,rgba(255,255,255,0.15) 0%,transparent 30%),radial-gradient(circle at 50% 90%,rgba(255,255,255,0.12) 0%,transparent 40%),repeating-linear-gradient(90deg,transparent,transparent 2px,rgba(255,255,255,0.06) 2px,rgba(255,255,255,0.06) 4px),repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(255,255,255,0.08) 3px,rgba(255,255,255,0.08) 6px);pointer-events:none;z-index:1;}',
      '.pig-game-container::after{content:"";position:absolute;inset:0;background-image:radial-gradient(circle at 12% 18%,rgba(255,255,255,0.22) 0%,transparent 25%),radial-gradient(circle at 85% 12%,rgba(255,255,255,0.18) 0%,transparent 22%),radial-gradient(circle at 8% 78%,rgba(255,255,255,0.16) 0%,transparent 28%),radial-gradient(circle at 92% 82%,rgba(255,255,255,0.14) 0%,transparent 24%);pointer-events:none;z-index:2;}',
      '.pig-top-bar{position:relative;width:100%;padding:6px 8px;display:flex;justify-content:space-between;align-items:center;gap:4px;margin-bottom:4px;background:rgba(58,122,29,0.3);border-radius:12px;}',
      '.pig-top-left-group{display:flex;align-items:center;gap:4px;}',
      '.pig-time-display{background:rgba(255,255,255,0.95);padding:4px 8px;border-radius:8px;font-weight:bold;color:#2d6b0f;font-size:14px;border:2px solid #5ea832;box-shadow:0 2px 0 #3a7a1d;min-width:50px;text-align:center;}',
      '.pig-btn-icon{width:32px;height:32px;border-radius:8px;background:rgba(255,255,255,0.95);border:2px solid #5ea832;font-size:14px;cursor:pointer;box-shadow:0 2px 0 #3a7a1d;display:flex;align-items:center;justify-content:center;flex-shrink:0;}',
      '.pig-btn-icon:active{transform:translateY(2px);box-shadow:0 1px 0 #3a7a1d;}',
      '.pig-coin-display{display:flex;align-items:center;gap:4px;background:rgba(255,255,255,0.95);padding:4px 10px;border-radius:12px;font-weight:bold;color:#d4760a;font-size:14px;border:2px solid #5ea832;box-shadow:0 2px 0 #3a7a1d;}',
      '.pig-level-title{font-size:18px;font-weight:900;color:#fff;text-shadow:0 2px 4px rgba(0,0,0,0.5),0 0 8px rgba(255,255,100,0.6);letter-spacing:1px;}',
      '.pig-game-board{position:absolute;top:0;bottom:130px;left:10px;right:10px;width:calc(100% - 20px);height:calc(100% - 130px);z-index:10;}',
      '.pig{position:absolute;cursor:pointer;z-index:10;transition:left 0.085s linear,top 0.085s linear;will-change:left,top;}',
      '.pig:active{transform:scale(0.96);}',
      '.pig-hit{position:absolute;inset:-12px;border-radius:50%;z-index:20;}',
      '.pig-inner{position:absolute;inset:0;width:100%;height:100%;background-image:url("'+PIG_IMG_URL+'");background-size:contain;background-position:center;background-repeat:no-repeat;pointer-events:none;}',
      '.pig[data-dir="down"] .pig-inner{transform:rotate(0deg) scale(1.7);}',
      '.pig[data-dir="up"] .pig-inner{transform:rotate(180deg) scale(1.7);}',
      '.pig[data-dir="left"] .pig-inner{transform:rotate(90deg) scale(1.7);}',
      '.pig[data-dir="right"] .pig-inner{transform:rotate(-90deg) scale(1.7);}',
      '.pig.running[data-dir="down"] .pig-inner{animation:pigBounce 0.1s ease-in-out infinite alternate;}',
      '.pig.running[data-dir="up"] .pig-inner{animation:pigBounceUp 0.1s ease-in-out infinite alternate;}',
      '.pig.running[data-dir="left"] .pig-inner{animation:pigBounceLeft 0.1s ease-in-out infinite alternate;}',
      '.pig.running[data-dir="right"] .pig-inner{animation:pigBounceRight 0.1s ease-in-out infinite alternate;}',
      '@keyframes pigBounce{0%{transform:rotate(0deg) translateY(-2px) scale(1.72);}100%{transform:rotate(0deg) translateY(2px) scale(1.68);}}',
      '@keyframes pigBounceUp{0%{transform:rotate(180deg) translateY(-2px) scale(1.72);}100%{transform:rotate(180deg) translateY(2px) scale(1.68);}}',
      '@keyframes pigBounceLeft{0%{transform:rotate(90deg) translateY(-2px) scale(1.72);}100%{transform:rotate(90deg) translateY(2px) scale(1.68);}}',
      '@keyframes pigBounceRight{0%{transform:rotate(-90deg) translateY(-2px) scale(1.72);}100%{transform:rotate(-90deg) translateY(2px) scale(1.68);}}',
      '.pig.escaping{z-index:100;pointer-events:none;transition:left 0.35s ease-in,top 0.35s ease-in,opacity 0.35s ease-in;}',
      '.pig-bottom-bar{position:absolute;bottom:0;left:0;width:100%;padding:8px 12px 10px;display:flex;justify-content:space-around;align-items:flex-end;background:linear-gradient(0deg,rgba(90,184,58,0.6) 0%,transparent 100%);z-index:100;}',
      '.pig-tool-btn{position:relative;display:flex;flex-direction:column;align-items:center;gap:2px;background:#ffe066;border:3px solid #ffb800;border-radius:14px;padding:6px 12px;cursor:pointer;transition:transform 0.1s;min-width:72px;box-shadow:0 4px 0 #e0a000;}',
      '.pig-tool-btn:active{transform:translateY(3px);box-shadow:0 1px 0 #e0a000;}',
      '.pig-tool-btn .icon{font-size:24px;line-height:1;}',
      '.pig-tool-btn .text{font-size:13px;font-weight:900;color:#8b5a2b;}',
      '.pig-tool-btn .count{position:absolute;top:-8px;right:-8px;background:#ff4757;color:white;font-size:13px;width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:bold;border:2px solid #fff;}',
      '.pig-tool-btn.disabled{opacity:0.6;background:#d0d0d0;border-color:#999;box-shadow:0 4px 0 #777;cursor:pointer;}',
      '.pig-tool-btn.active{border-color:#ff4757;box-shadow:0 0 0 3px rgba(255,71,87,0.3),0 4px 0 #e0a000;}',
      '.pig-pause-mask{position:absolute;inset:0;background:rgba(0,0,0,0.6);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:150;opacity:0;pointer-events:none;transition:opacity 0.3s ease;}',
      '.pig-pause-mask.show{opacity:1;pointer-events:all;}',
      '.pig-pause-title{font-size:36px;font-weight:900;color:#fff;margin-bottom:30px;letter-spacing:4px;}',
      '.pig-pause-btn{background:#52c41a;color:white;border:none;padding:14px 40px;border-radius:30px;font-size:20px;cursor:pointer;font-weight:bold;box-shadow:0 4px 0 #389e0d;margin-bottom:16px;transition:transform 0.1s;}',
      '.pig-pause-btn:active{transform:translateY(2px);box-shadow:0 2px 0 #389e0d;}',
      '.pig-pause-btn.secondary{background:#fff;color:#333;box-shadow:0 4px 0 #ccc;}',
      '.pig-quiz-modal{position:absolute;inset:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:200;opacity:0;pointer-events:none;transition:opacity 0.3s ease;padding:20px;}',
      '.pig-quiz-modal.show{opacity:1;pointer-events:all;}',
      '.pig-quiz-content{background:#fff;padding:24px;border-radius:20px;width:100%;max-width:380px;box-shadow:0 12px 40px rgba(0,0,0,0.3);animation:pigPopIn 0.4s cubic-bezier(0.34,1.56,0.64,1);}',
      '@keyframes pigPopIn{0%{transform:scale(0.5);opacity:0;}100%{transform:scale(1);opacity:1;}}',
      '.pig-quiz-chapter{font-size:13px;color:#888;margin-bottom:8px;}',
      '.pig-quiz-question{font-size:17px;font-weight:bold;color:#333;line-height:1.6;margin-bottom:16px;}',
      '.pig-quiz-options{display:flex;flex-direction:column;gap:10px;margin-bottom:16px;}',
      '.pig-quiz-option{padding:12px 16px;border:2px solid #e8e8e8;border-radius:12px;cursor:pointer;font-size:15px;color:#333;transition:all 0.2s;}',
      '.pig-quiz-option:hover{border-color:#52c41a;background:#f6ffed;}',
      '.pig-quiz-option.correct{border-color:#52c41a;background:#f6ffed;color:#389e0d;}',
      '.pig-quiz-option.wrong{border-color:#ff4757;background:#fff1f0;color:#cf1322;}',
      '.pig-quiz-option.disabled{pointer-events:none;}',
      '.pig-quiz-tip{text-align:center;font-size:14px;color:#666;margin-bottom:12px;min-height:20px;}',
      '.pig-quiz-close-btn{width:100%;background:#52c41a;color:white;border:none;padding:12px;border-radius:12px;font-size:16px;font-weight:bold;cursor:pointer;box-shadow:0 3px 0 #389e0d;}',
      '.pig-modal{position:absolute;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:200;opacity:0;pointer-events:none;transition:opacity 0.3s ease;}',
      '.pig-modal.show{opacity:1;pointer-events:all;}',
      '.pig-modal-content{background:#fff;padding:32px 40px;border-radius:20px;text-align:center;box-shadow:0 12px 40px rgba(0,0,0,0.3);animation:pigPopIn 0.4s cubic-bezier(0.34,1.56,0.64,1);max-width:340px;width:90%;}',
      '.pig-modal-title{font-size:24px;font-weight:900;color:#333;margin-bottom:12px;}',
      '.pig-modal-sub{font-size:15px;color:#666;margin-bottom:8px;line-height:1.6;}',
      '.pig-modal-score{font-size:20px;font-weight:800;color:#d4a017;margin-bottom:6px;}',
      '.pig-modal-coins{font-size:18px;font-weight:700;color:#f5a623;margin-bottom:16px;}',
      '.pig-modal-btn{background:#52c41a;color:white;border:none;padding:12px 32px;border-radius:26px;font-size:18px;cursor:pointer;font-weight:bold;box-shadow:0 4px 0 #389e0d;transition:transform 0.1s;margin:4px;}',
      '.pig-modal-btn:active{transform:translateY(2px);box-shadow:0 2px 0 #389e0d;}',
      '.pig-modal-btn.secondary{background:#fff;color:#333;box-shadow:0 4px 0 #ccc;}',
      '.pig-grass-dot{position:absolute;border-radius:50%;background:#5ab83a;opacity:0.35;pointer-events:none;z-index:3;}',
      '.pig-level-select{max-width:430px;margin:0 auto;padding:12px;}',
      '.pig-level-header{text-align:center;margin-bottom:16px;}',
      '.pig-level-header h2{font-size:22px;font-weight:800;color:#389e0d;margin-bottom:4px;}',
      '.pig-level-header p{font-size:13px;color:#888;}',
      '.pig-level-stats{display:flex;justify-content:space-around;margin-bottom:16px;background:#f0fff0;border-radius:12px;padding:10px;border:1px solid #90ee90;}',
      '.pig-level-stat{text-align:center;}',
      '.pig-level-stat .num{font-size:20px;font-weight:800;color:#389e0d;}',
      '.pig-level-stat .label{font-size:11px;color:#888;}',
      '.pig-level-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;max-height:400px;overflow-y:auto;padding:4px;}',
      '.pig-level-card{position:relative;background:#fff;border:2px solid #e0e0e0;border-radius:12px;padding:10px 6px;text-align:center;cursor:pointer;transition:all 0.2s;}',
      '.pig-level-card:hover{border-color:#52c41a;transform:translateY(-2px);box-shadow:0 4px 12px rgba(82,196,26,0.2);}',
      '.pig-level-card.cleared{background:#f0fff0;border-color:#90ee90;}',
      '.pig-level-card.current{border-color:#52c41a;box-shadow:0 0 0 3px rgba(82,196,26,0.3);}',
      '.pig-level-card.locked{opacity:0.4;cursor:not-allowed;background:#f5f5f5;}',
      '.pig-level-card .lv-num{font-size:18px;font-weight:800;color:#333;}',
      '.pig-level-card .lv-score{font-size:11px;color:#d4a017;font-weight:600;}',
      '.pig-level-card .lv-coins{font-size:10px;color:#f5a623;}',
      '.pig-level-card .lv-check{position:absolute;top:-4px;right:-4px;background:#52c41a;color:#fff;width:18px;height:18px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:bold;}'
    ].join('\n');
    document.head.appendChild(style);
  }

  // === 小猪图片 CDN 地址（webp 压缩版）===
  var PIG_IMG_URL = 'https://mhxdwwa.oss-cn-shenzhen.aliyuncs.com/images/%E5%B0%8F%E7%8C%AA.webp';

  // === 数学题库（完整60道，忠实于原始代码）===
  var questionBank = [
    {chapter:"第七章 相交线与平行线",question:"下列命题中是假命题的是（ ）",options:["对顶角相等","两条直线被第三条直线所截，同旁内角互补","在同一平面内，过一点有且只有一条直线与已知直线垂直","直线外一点到这条直线的垂线段的长度叫做点到直线的距离"],answer:1},
    {chapter:"第七章 相交线与平行线",question:"下列说法正确的是（ ）",options:["不相交的两条直线叫做平行线","在同一平面内，不相交的两条线段互相平行","在同一平面内，不重合的两条直线的位置关系只有相交和平行两种","以上说法都不对"],answer:2},
    {chapter:"第七章 相交线与平行线",question:"如图，下列条件中，不能判定AB∥CD的是（ ）",options:["∠3=∠4","∠1=∠2","∠B=∠DCE","∠D+∠BAD=180°"],answer:1},
    {chapter:"第七章 相交线与平行线",question:"两直线被第三条直线所截，下列说法正确的是（ ）",options:["同位角相等","内错角相等","同旁内角互补","以上都不对"],answer:3},
    {chapter:"第七章 相交线与平行线",question:"过一点画已知直线的垂线，可画（ ）",options:["0条","1条","无数条","1条或无数条"],answer:1},
    {chapter:"第七章 相交线与平行线",question:"下列图形中，由AB∥CD能得到∠1=∠2的是（ ）",options:["内错角位置图形","同位角位置图形","同旁内角位置图形","对顶角位置图形"],answer:0},
    {chapter:"第七章 相交线与平行线",question:"一个图形经过平移后，发生变化的是（ ）",options:["形状","大小","位置","角度"],answer:2},
    {chapter:"第七章 相交线与平行线",question:"若∠1与∠2是同旁内角，且∠1=50°，则∠2的度数是（ ）",options:["50°","130°","50°或130°","不能确定"],answer:3},
    {chapter:"第七章 相交线与平行线",question:"下列说法正确的是（ ）",options:["平移后对应点连线互相平行且相等","平移后图形的形状改变","平移后图形的大小改变","平移改变图形的方向"],answer:0},
    {chapter:"第七章 相交线与平行线",question:"两条直线相交形成的四个角中，下列条件能判定两条直线垂直的是（ ）",options:["有两个角相等","有两对角相等","有三个角相等","有四对邻补角"],answer:2},
    {chapter:"第八章 实数",question:"4的平方根是（ ）",options:["2","±2","-2","√2"],answer:1},
    {chapter:"第八章 实数",question:"下列各数中，是无理数的是（ ）",options:["3.14","22/7","√2","0.333…"],answer:2},
    {chapter:"第八章 实数",question:"-8的立方根是（ ）",options:["2","-2","±2","-4"],answer:1},
    {chapter:"第八章 实数",question:"√16的算术平方根是（ ）",options:["4","±4","2","±2"],answer:2},
    {chapter:"第八章 实数",question:"下列说法正确的是（ ）",options:["无限小数都是无理数","带根号的数都是无理数","无理数是无限不循环小数","实数包括正实数和负实数"],answer:2},
    {chapter:"第八章 实数",question:"估计√11的值在（ ）",options:["2和3之间","3和4之间","4和5之间","5和6之间"],answer:1},
    {chapter:"第八章 实数",question:"下列计算正确的是（ ）",options:["√9=±3","√(-3)²=-3","³√8=2","√2+√3=√5"],answer:2},
    {chapter:"第八章 实数",question:"和数轴上的点一一对应的是（ ）",options:["有理数","无理数","整数","实数"],answer:3},
    {chapter:"第八章 实数",question:"若√(a-2) + |b+3| = 0，则(a+b)²⁰²⁴的值是（ ）",options:["0","1","-1","2024"],answer:1},
    {chapter:"第八章 实数",question:"下列各组数中，互为相反数的是（ ）",options:["-2与√(-2)²","-2与³√-8","-2与-1/2","|2|与2"],answer:0},
    {chapter:"第九章 平面直角坐标系",question:"在平面直角坐标系中，点(-3, 4)所在的象限是（ ）",options:["第一象限","第二象限","第三象限","第四象限"],answer:1},
    {chapter:"第九章 平面直角坐标系",question:"在平面直角坐标系中，点P(2, -3)关于x轴对称的点的坐标是（ ）",options:["(2, 3)","(-2, 3)","(-2, -3)","(2, -3)"],answer:0},
    {chapter:"第九章 平面直角坐标系",question:"点A(m-4, 1-2m)在第四象限，则m的取值范围是（ ）",options:["m>1/2","m<4","m>4","1/2<m<4"],answer:2},
    {chapter:"第九章 平面直角坐标系",question:"将点P(-2, 1)向右平移3个单位长度，再向上平移2个单位长度，得到的点的坐标是（ ）",options:["(-5, 3)","(1, 3)","(1, -1)","(-5, -1)"],answer:1},
    {chapter:"第九章 平面直角坐标系",question:"在平面直角坐标系中，y轴上的点的坐标特点是（ ）",options:["横坐标为0","纵坐标为0","横纵坐标都为0","横纵坐标相等"],answer:0},
    {chapter:"第九章 平面直角坐标系",question:"点P到x轴的距离是2，到y轴的距离是3，则点P的坐标不可能是（ ）",options:["(3, 2)","(-3, 2)","(-3, -2)","(2, 3)"],answer:3},
    {chapter:"第九章 平面直角坐标系",question:"若点A(a, b)在第二象限，则点B(-a, b+1)在（ ）",options:["第一象限","第二象限","第三象限","第四象限"],answer:0},
    {chapter:"第九章 平面直角坐标系",question:"在平面直角坐标系中，已知点A(1, 2)，B(3, 4)，则线段AB的中点坐标是（ ）",options:["(2, 3)","(1, 2)","(3, 4)","(4, 6)"],answer:0},
    {chapter:"第九章 平面直角坐标系",question:"如果点M(a, b)在第三象限，那么点N(-a, -b)在（ ）",options:["第一象限","第二象限","第三象限","第四象限"],answer:0},
    {chapter:"第九章 平面直角坐标系",question:"平面直角坐标系中，将三角形各点的纵坐标都减去3，横坐标保持不变，图形发生的变化是（ ）",options:["向上平移3个单位","向下平移3个单位","向左平移3个单位","向右平移3个单位"],answer:1},
    {chapter:"第十章 二元一次方程组",question:"下列方程中，是二元一次方程的是（ ）",options:["x+y=1","x²+y=2","x+y+z=3","x+1/y=4"],answer:0},
    {chapter:"第十章 二元一次方程组",question:"方程组 { x+y=3, x-y=1 } 的解是（ ）",options:["{x=1, y=2}","{x=2, y=1}","{x=3, y=0}","{x=0, y=3}"],answer:1},
    {chapter:"第十章 二元一次方程组",question:"用代入法解方程组 { 2x-y=1, 3x+2y=5 } 时，最简便的变形是（ ）",options:["由①得x=(y+1)/2","由①得y=2x-1","由②得x=(5-2y)/3","由②得y=(5-3x)/2"],answer:1},
    {chapter:"第十章 二元一次方程组",question:"方程组 { 3x+2y=7, 4x-y=13 } 的解是（ ）",options:["{x=-1, y=5}","{x=3, y=-1}","{x=-3, y=-1}","{x=2, y=1/2}"],answer:1},
    {chapter:"第十章 二元一次方程组",question:"已知 { x=2, y=1 } 是方程2x+ay=5的解，则a的值为（ ）",options:["1","2","3","4"],answer:0},
    {chapter:"第十章 二元一次方程组",question:"某班共有学生49人，一天，该班某男生因事请假，当天的男生人数恰为女生人数的一半。若设该班男生人数为x，女生人数为y，则下列方程组正确的是（ ）",options:["{x-y=49, y=2(x+1)}","{x+y=49, y=2(x-1)}","{x+y=49, y=2x-1}","{x-y=49, y=2x-1}"],answer:1},
    {chapter:"第十章 二元一次方程组",question:"二元一次方程2x+y=7的正整数解有（ ）",options:["1组","2组","3组","4组"],answer:2},
    {chapter:"第十章 二元一次方程组",question:"若方程组 { x+y=3, x-y=1 } 与方程组 { mx+ny=8, mx-ny=4 } 的解相同，则m、n的值分别是（ ）",options:["3, 2","2, 3","2, 2","3, 3"],answer:0},
    {chapter:"第十章 二元一次方程组",question:"用加减法解方程组 { 2x+3y=3, 3x-2y=11 } 时，下列变形正确的是（ ）",options:["①×2+②×3消去y","①×2-②×3消去y","①×3+②×2消去x","①×3-②×2消去y"],answer:0},
    {chapter:"第十章 二元一次方程组",question:"今有鸡兔同笼，上有三十五头，下有九十四足，问鸡兔各几何。设鸡有x只，兔有y只，则可列方程组为（ ）",options:["{x+y=35, 2x+4y=94}","{x+y=35, 4x+2y=94}","{x+y=94, 2x+4y=35}","{x+y=94, 4x+2y=35}"],answer:0},
    {chapter:"第十一章 不等式与不等式组",question:"下列式子中，是一元一次不等式的是（ ）",options:["x+1>0","x²>0","x+y>0","1/x>0"],answer:0},
    {chapter:"第十一章 不等式与不等式组",question:"不等式2x-1>3的解集是（ ）",options:["x>1","x>2","x<1","x<2"],answer:1},
    {chapter:"第十一章 不等式与不等式组",question:"若a>b，则下列不等式一定成立的是（ ）",options:["a-3 < b-3","-2a > -2b","a/2 > b/2","a² > b²"],answer:2},
    {chapter:"第十一章 不等式与不等式组",question:"不等式组 { x>1, x>2 } 的解集是（ ）",options:["x>1","x>2","1<x<2","无解"],answer:1},
    {chapter:"第十一章 不等式与不等式组",question:"不等式3x-1 ≥ x+3的解集在数轴上表示正确的是（ ）",options:["x≥2向右实心","x>2向右空心","x≤2向左实心","x<2向左空心"],answer:0},
    {chapter:"第十一章 不等式与不等式组",question:"不等式组 { x+1>0, x-2≤0 } 的整数解有（ ）",options:["1个","2个","3个","4个"],answer:2},
    {chapter:"第十一章 不等式与不等式组",question:"若关于x的一元一次不等式组 { x-m>0, 2x+1>3 } 无解，则m的取值范围是（ ）",options:["m≥1","m>1","m≤1","m<1"],answer:0},
    {chapter:"第十一章 不等式与不等式组",question:"某商品的进价为800元，出售时标价为1200元，后来由于该商品积压，商店准备打折销售，但要保证利润率不低于5%，则至多可打（ ）",options:["6折","7折","8折","9折"],answer:1},
    {chapter:"第十一章 不等式与不等式组",question:"已知点P(a, 1-a)在第一象限，则a的取值范围是（ ）",options:["a<0","0<a<1","a>1","a<1"],answer:1},
    {chapter:"第十一章 不等式与不等式组",question:"若不等式(a-1)x > a-1的解集是x < 1，则a的取值范围是（ ）",options:["a>1","a<1","a≥1","a≤1"],answer:1},
    {chapter:"第十二章 数据的收集整理",question:"下列调查中，适合用全面调查方式的是（ ）",options:["了解一批灯泡的使用寿命","了解全国中学生的视力情况","了解某班学生的身高情况","了解长江中鱼的种类"],answer:2},
    {chapter:"第十二章 数据的收集整理",question:"为了解某校八年级1200名学生的体重情况，从中抽取了200名学生的体重进行统计，下列说法正确的是（ ）",options:["总体是1200名学生","样本是200名学生","个体是每个学生","样本容量是200"],answer:3},
    {chapter:"第十二章 数据的收集整理",question:"下列统计图中，能清楚地反映事物变化趋势的是（ ）",options:["条形统计图","折线统计图","扇形统计图","频数分布直方图"],answer:1},
    {chapter:"第十二章 数据的收集整理",question:"要反映某市一天内气温的变化情况，最好选用（ ）",options:["条形统计图","折线统计图","扇形统计图","频数分布表"],answer:1},
    {chapter:"第十二章 数据的收集整理",question:"扇形统计图中，某部分占总体的百分比为25%，则该部分对应的扇形圆心角是（ ）",options:["25°","90°","120°","180°"],answer:1},
    {chapter:"第十二章 数据的收集整理",question:"一组数据共50个，分成5组，若前4组的频数分别为8、12、15、10，则第5组的频率是（ ）",options:["0.1","0.2","0.3","0.4"],answer:0},
    {chapter:"第十二章 数据的收集整理",question:"下列调查中，调查方式选择正确的是（ ）",options:["为了了解100个灯泡的使用寿命，选择全面调查","为了了解某公园全年的游客流量，选择抽样调查","为了了解生产的一批炮弹的杀伤半径，选择全面调查","为了了解一批袋装食品是否含有防腐剂，选择全面调查"],answer:1},
    {chapter:"第十二章 数据的收集整理",question:"在频数分布直方图中，各小长方形的面积等于相应各组的（ ）",options:["组距","频数","频率","组数"],answer:1},
    {chapter:"第十二章 数据的收集整理",question:"某校有学生2000人，随机抽取了200名学生进行视力调查，发现有80名学生近视，则估计该校近视的学生人数约为（ ）",options:["600人","800人","1000人","1200人"],answer:1},
    {chapter:"第十二章 数据的收集整理",question:"绘制频数分布直方图时，若一组数据的最大值与最小值的差为21，组距为4，则组数为（ ）",options:["4组","5组","6组","7组"],answer:2}
  ];

  // === 自定义题库（从 Supabase 加载）===
  var customQuestionBank = null; // null = 未加载, [] = 已加载但为空, [...] = 有题目
  var customQuestionsLoading = false;

  // 从 Supabase 加载教师自定义题目
  function loadCustomQuestions(teacherId) {
    if (!teacherId || customQuestionsLoading) return Promise.resolve();
    if (customQuestionBank !== null) return Promise.resolve(); // 已加载
    customQuestionsLoading = true;
    
    if (typeof db === 'undefined' || !db) {
      customQuestionsLoading = false;
      return Promise.resolve();
    }
    
    return db.from('pig_run_questions').select('*').eq('teacher_id', teacherId).order('created_at', { ascending: false }).then(function(r) {
      customQuestionsLoading = false;
      if (r.error) {
        console.warn('[小猪快跑] 加载自定义题库失败:', r.error.message);
        customQuestionBank = null;
        return;
      }
      if (r.data && r.data.length > 0) {
        customQuestionBank = r.data.map(function(q) {
          var opts = [];
          try { opts = typeof q.options === 'string' ? JSON.parse(q.options) : (q.options || []); } catch(e) { opts = []; }
          return {
            chapter: q.chapter || '默认',
            question: q.question || '',
            options: opts,
            answer: typeof q.answer === 'number' ? q.answer : 0,
            id: q.id
          };
        });
        console.log('[小猪快跑] 加载了 ' + customQuestionBank.length + ' 道自定义题目');
      } else {
        customQuestionBank = [];
        console.log('[小猪快跑] 教师无自定义题目，使用默认题库');
      }
    }).catch(function(e) {
      customQuestionsLoading = false;
      console.warn('[小猪快跑] 加载自定义题库异常:', e);
    });
  }

  // 获取当前可用题库（优先自定义，降级默认）
  function getActiveQuestionBank() {
    if (customQuestionBank && customQuestionBank.length > 0) return customQuestionBank;
    return questionBank;
  }

  // 获取当前教师ID
  function getCurrentTeacherId() {
    if (typeof currentUser !== 'undefined' && currentUser && currentUser.type === 'teacher') {
      return currentUser.id;
    }
    return null;
  }

  // === 音效 ===
  var audioFiles = {};
  function initAudio() {
    audioFiles = {
      click: new Audio('https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3'),
      escape: new Audio('https://assets.mixkit.co/active_storage/sfx/1661/1661-preview.mp3'),
      blocked: new Audio('https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3'),
      win: new Audio('https://assets.mixkit.co/active_storage/sfx/1666/1666-preview.mp3'),
      pigEscaped: new Audio('https://mhxdwwa.oss-cn-shenzhen.aliyuncs.com/music/猪逃跑了.mp3'),
      pigCollision: new Audio('https://mhxdwwa.oss-cn-shenzhen.aliyuncs.com/music/撞到猪了.mp3')
    };
  }
  function playSound(name, soundEnabled) {
    if (!soundEnabled) return;
    var audio = audioFiles[name];
    if (!audio) return;
    audio.currentTime = 0;
    audio.volume = 0.35;
    audio.play().catch(function() {});
  }

  // === 渲染小猪快跑页面（关卡选择）===
  function renderPigRunPage() {
    var container = document.getElementById('pigRunContent');
    if (!container) return;
    var isStudentView = typeof currentUser !== 'undefined' && currentUser && currentUser.type === 'student';
    
    // 教师进入时自动加载自定义题库
    if (!isStudentView) {
      var teacherId = getCurrentTeacherId();
      if (teacherId && customQuestionBank === null) {
        loadCustomQuestions(teacherId);
      }
    }
    
    if (!isStudentView) {
      // Teacher view
      if (window._teacherPlayingAsStudent && window._pigRunModalShown) {
        // Student already selected and modal shown this visit, show game
        var student = getCurrentStudent();
        if (student) {
          var qs = ensurePigRunState(student);
          renderLevelSelect(container, student, qs);
        } else {
          // Student not found, reset
          window._teacherPlayingAsStudent = null;
          window._pigRunModalShown = false;
          container.innerHTML = (typeof renderTeacherPlaceholder === 'function')
            ? renderTeacherPlaceholder('pigrun')
            : '<div style="text-align:center;padding:40px;"><div style="font-size:60px;">🐷</div><div style="font-size:18px;font-weight:700;margin-top:12px;">小猪快跑</div><div style="font-size:14px;color:#888;margin-top:8px;">正在选取参赛学生...</div></div>';
        }
      } else {
        // Just show placeholder, wait for tab click to trigger modal
        container.innerHTML = (typeof renderTeacherPlaceholder === 'function')
          ? renderTeacherPlaceholder('pigrun')
          : '<div style="text-align:center;padding:40px;"><div style="font-size:60px;">🐷</div><div style="font-size:18px;font-weight:700;margin-top:12px;">小猪快跑</div><div style="font-size:14px;color:#888;margin-top:8px;">正在选取参赛学生...</div></div>';
      }
      return;
    }
    var student = getCurrentStudent();
    if (!student) {
      container.innerHTML = '<div style="text-align:center;padding:40px;">未找到你的学生信息</div>';
      return;
    }
    var qs = ensurePigRunState(student);
    renderLevelSelect(container, student, qs);
  }
  window.renderPigRunPage = renderPigRunPage;

  // === 关卡选择界面 ===
  function renderLevelSelect(container, student, qs) {
    injectStyles();
    initAudio();
    var levels = qs.pigRunLevels || {};
    var clearedLevels = Object.keys(levels).filter(function(k) { return levels[k] && levels[k].cleared; }).map(Number).sort(function(a,b){return a-b;});
    var maxCleared = clearedLevels.length > 0 ? Math.max.apply(null, clearedLevels) : 0;
    var totalScore = qs.pigRunTotalScore || 0;
    var totalCoins = 0;
    Object.keys(levels).forEach(function(k) { totalCoins += levels[k].coinsEarned || 0; });

    var html = '<div class="pig-level-select">';
    // Header
    html += '<div class="pig-level-header">';
    html += '<h2>🐷 小猪快跑</h2>';
    html += '<p>帮助小猪逃脱，越到后面难度越大！</p>';
    html += '</div>';
    // Stats
    html += '<div class="pig-level-stats">';
    html += '<div class="pig-level-stat"><div class="num">' + clearedLevels.length + '</div><div class="label">已通关</div></div>';
    html += '<div class="pig-level-stat"><div class="num" style="color:#d4a017;">' + totalScore + '</div><div class="label">总分</div></div>';
    html += '<div class="pig-level-stat"><div class="num" style="color:#f5a623;">' + totalCoins + '</div><div class="label">累计金币</div></div>';
    html += '</div>';
    // Level grid (show up to max(maxCleared+5, 20))
    var showCount = Math.max(20, maxCleared + 5);
    html += '<div style="font-size:14px;font-weight:700;color:#555;margin-bottom:8px;">选择关卡</div>';
    html += '<div class="pig-level-grid">';
    for (var i = 1; i <= showCount; i++) {
      var lvData = levels[String(i)];
      var isCleared = lvData && lvData.cleared;
      var isUnlocked = i === 1 || (levels[String(i-1)] && levels[String(i-1)].cleared) || isCleared;
      var isCurrent = i === maxCleared + 1 && !isCleared;
      var cardClass = 'pig-level-card';
      if (isCleared) cardClass += ' cleared';
      if (isCurrent) cardClass += ' current';
      if (!isUnlocked) cardClass += ' locked';
      var onclick = isUnlocked ? ' onclick="startLevelGame(' + i + ')"' : '';
      html += '<div class="' + cardClass + '"' + onclick + '>';
      html += '<div class="lv-num">' + i + '</div>';
      if (isCleared && lvData) {
        html += '<div class="lv-score">' + lvData.bestScore + '分</div>';
        html += '<div class="lv-coins">💰' + (lvData.coinsEarned || 0) + '</div>';
        html += '<div class="lv-check">✓</div>';
      } else if (isCurrent) {
        html += '<div style="font-size:10px;color:#52c41a;font-weight:600;">新关卡</div>';
      }
      html += '</div>';
    }
    html += '</div>';
    // Rules
    html += '<div style="margin-top:12px;padding:12px;background:#fff;border-radius:12px;border:1px solid #e0e0e0;text-align:left;">';
    html += '<div style="font-size:13px;font-weight:600;color:#666;margin-bottom:6px;">📖 游戏规则</div>';
    html += '<div style="font-size:12px;color:#888;line-height:1.8;">';
    html += '1. 点击小猪让它沿面朝方向跑<br>2. 跑到棋盘边缘逃脱，每只 +5分<br>3. 被其他小猪挡住则无法逃脱<br>4. 通关时间越短，时间分越高<br>5. 首次通关获得3-9金币奖励<br>6. 可重复挑战已通关关卡提高分数，但不再获得金币</div></div>';
    html += '</div>';
    container.innerHTML = html;
  }

  // 全局函数：从关卡选择开始游戏
  window.startLevelGame = function(level) {
    var student = getCurrentStudent();
    if (!student) return;
    var container = document.getElementById('pigRunContent');
    if (!container) return;
    var qs = ensurePigRunState(student);
    renderPigRunGame(container, student, qs, level);
  };

  // === 渲染游戏主体 ===
  function renderPigRunGame(container, student, qs, level) {
    var html = '<div class="pig-run-wrap">';
    // Top bar - OUTSIDE game container so it doesn't block game area
    html += '<div class="pig-top-bar">';
    html += '<div class="pig-top-left-group">';
    html += '<button class="pig-btn-icon" id="pigPauseBtn" style="width:32px;height:32px;border-radius:8px;font-size:14px;">⏸</button>';
    html += '<div class="pig-time-display" id="pigTimeDisplay" style="padding:4px 8px;font-size:14px;border-radius:8px;min-width:50px;">00:00</div>';
    html += '<div class="pig-coin-display" style="padding:4px 10px;font-size:14px;border-radius:12px;gap:4px;"><span>🪙</span><span id="pigCoinCount">0</span></div>';
    html += '<div style="display:flex;align-items:center;gap:3px;background:rgba(255,255,255,0.95);padding:4px 8px;border-radius:8px;font-weight:bold;color:#b8860b;font-size:13px;border:2px solid #5ea832;box-shadow:0 2px 0 #3a7a1d;"><span>🏆</span><span id="pigTotalScore">' + (qs.pigRunTotalScore || 0) + '</span></div>';
    html += '</div>';
    html += '<div class="pig-level-title" style="font-size:18px;">第<span id="pigLevelNum">' + level + '</span>关</div>';
    html += '<button class="pig-btn-icon" id="pigSoundBtn" style="width:32px;height:32px;border-radius:8px;font-size:14px;">🔊</button>';
    html += '</div>';
    // Game container
    html += '<div class="pig-game-container" id="pigGameContainer">';
    // Game board
    html += '<div class="pig-game-board" id="pigGameBoard"></div>';
    // Bottom bar
    html += '<div class="pig-bottom-bar">';
    html += '<div class="pig-tool-btn" id="pigRemoveTool"><span class="icon" id="pigRemoveIcon">🗑</span><span class="text">移除</span><span class="count" id="pigRemoveCount">1</span></div>';
    html += '<div class="pig-tool-btn" id="pigShuffleTool"><span class="icon" id="pigShuffleIcon">🔀</span><span class="text">洗牌</span><span class="count" id="pigShuffleCount">1</span></div>';
    html += '<div class="pig-tool-btn" id="pigRotateTool"><span class="icon" id="pigRotateIcon">🔄</span><span class="text">转向</span><span class="count" id="pigRotateCount">1</span></div>';
    html += '</div>';
    // Pause mask
    html += '<div class="pig-pause-mask" id="pigPauseMask">';
    html += '<div class="pig-pause-title">游戏暂停</div>';
    html += '<button class="pig-pause-btn" id="pigResumeBtn">▶ 继续游戏</button>';
    html += '<button class="pig-pause-btn secondary" id="pigQuitBtn">🏠 返回关卡选择</button>';
    html += '</div>';
    // Quiz modal
    html += '<div class="pig-quiz-modal" id="pigQuizModal">';
    html += '<div class="pig-quiz-content">';
    html += '<div class="pig-quiz-chapter" id="pigQuizChapter"></div>';
    html += '<div class="pig-quiz-question" id="pigQuizQuestion"></div>';
    html += '<div class="pig-quiz-options" id="pigQuizOptions"></div>';
    html += '<div class="pig-quiz-tip" id="pigQuizTip"></div>';
    html += '<button class="pig-quiz-close-btn" id="pigQuizCloseBtn" style="display:none;">关闭</button>';
    html += '</div></div>';
    // Win modal
    html += '<div class="pig-modal" id="pigWinModal">';
    html += '<div class="pig-modal-content" id="pigWinContent"></div>';
    html += '</div>';
    html += '</div>'; // close pig-game-container
    html += '</div>'; // close pig-run-wrap
    container.innerHTML = html;
    // Start game
    setTimeout(function() { startPigRunGame(container, student, qs, level); }, 100);
  }

  // === 游戏引擎 ===
  function startPigRunGame(container, student, qs, currentLevel) {
    var COLS = 7, ROWS = 10, PIG_SCALE = 0.96;
    var CELL_W = 100 / COLS, CELL_H = 100 / ROWS, MOVE_SPEED = 85;
    var DIRS = { up:{dx:0,dy:-1}, down:{dx:0,dy:1}, left:{dx:-1,dy:0}, right:{dx:1,dy:0} };

    var gState = {
      level: currentLevel,
      coins: 0,
      pigs: [],
      tools: {remove:1, shuffle:1, rotate:1},
      activeTool: null,
      animating: false,
      soundEnabled: true,
      paused: false,
      timeSeconds: 0,
      timer: null,
      currentQuizTool: null,
      currentQuiz: null,
      answerAttempts: 0,
      totalPigCount: 0
    };

    var board = document.getElementById('pigGameBoard');
    var gameContainer = document.getElementById('pigGameContainer');
    var levelNum = document.getElementById('pigLevelNum');
    var coinCountEl = document.getElementById('pigCoinCount');
    var timeDisplay = document.getElementById('pigTimeDisplay');
    var totalScoreEl = document.getElementById('pigTotalScore');
    var winModal = document.getElementById('pigWinModal');
    var winContent = document.getElementById('pigWinContent');
    var removeBtn = document.getElementById('pigRemoveTool');
    var shuffleBtn = document.getElementById('pigShuffleTool');
    var rotateBtn = document.getElementById('pigRotateTool');
    var removeCnt = document.getElementById('pigRemoveCount');
    var shuffleCnt = document.getElementById('pigShuffleCount');
    var rotateCnt = document.getElementById('pigRotateCount');
    var removeIcon = document.getElementById('pigRemoveIcon');
    var shuffleIcon = document.getElementById('pigShuffleIcon');
    var rotateIcon = document.getElementById('pigRotateIcon');
    var soundBtn = document.getElementById('pigSoundBtn');
    var pauseBtn = document.getElementById('pigPauseBtn');
    var pauseMask = document.getElementById('pigPauseMask');
    var resumeBtn = document.getElementById('pigResumeBtn');
    var quitBtn = document.getElementById('pigQuitBtn');
    var quizModal = document.getElementById('pigQuizModal');
    var quizChapter = document.getElementById('pigQuizChapter');
    var quizQuestion = document.getElementById('pigQuizQuestion');
    var quizOptions = document.getElementById('pigQuizOptions');
    var quizTip = document.getElementById('pigQuizTip');
    var quizCloseBtn = document.getElementById('pigQuizCloseBtn');

    if (!board || !gameContainer) return;

    // Timer
    function formatTime(s) {
      var m = Math.floor(s/60).toString().padStart(2,'0');
      var sec = (s%60).toString().padStart(2,'0');
      return m+':'+sec;
    }
    function startTimer() {
      if (gState.timer) clearInterval(gState.timer);
      gState.timer = setInterval(function(){
        if (!gState.paused) { gState.timeSeconds++; timeDisplay.textContent = formatTime(gState.timeSeconds); }
      }, 1000);
    }
    function stopTimer() { if (gState.timer) { clearInterval(gState.timer); gState.timer = null; } }
    function togglePause() {
      gState.paused = !gState.paused;
      if (gState.paused) { pauseBtn.textContent='▶'; pauseMask.classList.add('show'); }
      else { pauseBtn.textContent='⏸'; pauseMask.classList.remove('show'); }
    }

    // 关卡难度：根据关卡等级决定填充率和方向分布
    // 低关卡：填充率低，方向规律
    // 高关卡：填充率高，方向随机性强，更多堵死情况
    function generateLevel(level) {
      var pigs = [];
      // 填充率随关卡递增：Level 1=0.70, Level 10=0.85, Level 50=0.95, 最高0.97
      var fillRate = Math.min(0.97, 0.68 + level * 0.012);
      // 方向随机性随关卡递增：低关卡方向规律，高关卡更混乱
      var randomDirChance = Math.min(0.8, 0.1 + level * 0.02);

      for (var y = 0; y < ROWS; y++) {
        for (var x = 0; x < COLS; x++) {
          if (Math.random() > fillRate) continue;
          var dir;
          if (Math.random() < randomDirChance) {
            // 随机方向（高关卡主要用这个）
            var allDirs = ['up', 'down', 'left', 'right'];
            dir = allDirs[Math.floor(Math.random() * allDirs.length)];
          } else {
            // 规律方向（低关卡主要用这个）
            var isH = Math.random() > 0.5;
            dir = isH ? (y % 2 === 0 ? 'right' : 'left') : (x % 2 === 0 ? 'down' : 'up');
          }
          pigs.push({x: x, y: y, dir: dir});
        }
      }
      return pigs;
    }

    function loadLevel(level) {
      board.innerHTML = '';
      gState.pigs = [];
      gState.activeTool = null;
      gState.animating = false;
      gState.coins = 0;
      gState.timeSeconds = 0;
      timeDisplay.textContent = '00:00';
      var data = generateLevel(level);
      gState.totalPigCount = data.length;
      data.forEach(function(d, i) {
        var el = createPig(d.x, d.y, d.dir, i);
        gState.pigs.push({id:i, x:d.x, y:d.y, dir:d.dir, el:el});
        placePig(el, d.x, d.y);
      });
      levelNum.textContent = level;
      coinCountEl.textContent = '0';
    }

    function createPig(x, y, dir, id) {
      var pig = document.createElement('div');
      pig.className = 'pig';
      pig.dataset.id = id;
      pig.dataset.dir = dir;
      pig.innerHTML = '<div class="pig-hit"></div><div class="pig-inner"></div>';
      pig.addEventListener('click', function(e) {
        e.stopPropagation();
        if (gState.paused || gState.animating) return;
        onPigClick(id);
      });
      return pig;
    }

    function placePig(el, x, y) {
      var gapX = ((1-PIG_SCALE)/2)*CELL_W, gapY = ((1-PIG_SCALE)/2)*CELL_H;
      el.style.left = 'calc('+x*CELL_W+'% + '+gapX+'%)';
      el.style.top = 'calc('+y*CELL_H+'% + '+gapY+'%)';
      el.style.width = 'calc('+CELL_W*PIG_SCALE+'%)';
      el.style.height = 'calc('+CELL_H*PIG_SCALE+'%)';
      board.appendChild(el);
    }

    // Pig interaction
    function onPigClick(id) {
      if (gState.animating || gState.paused) return;
      var pig = gState.pigs.find(function(p){return p.id===id;});
      if (!pig) return;
      playSound('click', gState.soundEnabled);
      if (gState.activeTool === 'remove') { doRemove(id); gState.activeTool=null; updateToolUI(); return; }
      if (gState.activeTool === 'rotate') { doRotate(id); gState.activeTool=null; updateToolUI(); return; }
      runPig(pig);
    }

    function runPig(pig) {
      gState.animating = true;
      pig.el.classList.add('running');
      var dx=DIRS[pig.dir].dx, dy=DIRS[pig.dir].dy;
      var gapX=((1-PIG_SCALE)/2)*CELL_W, gapY=((1-PIG_SCALE)/2)*CELL_H;
      function step() {
        if (gState.pigs.indexOf(pig)===-1) { gState.animating=false; return; }
        var nx=pig.x+dx, ny=pig.y+dy;
        if (nx<0||nx>=COLS||ny<0||ny>=ROWS) { escapeOut(pig); return; }
        var hit = gState.pigs.some(function(p){return p.id!==pig.id && p.x===nx && p.y===ny;});
        if (hit) { pig.el.classList.remove('running'); gState.animating=false; playSound('blocked',gState.soundEnabled); if (Math.random() < 0.25) { playSound('pigCollision',gState.soundEnabled); } return; }
        pig.x=nx; pig.y=ny;
        pig.el.style.left='calc('+nx*CELL_W+'% + '+gapX+'%)';
        pig.el.style.top='calc('+ny*CELL_H+'% + '+gapY+'%)';
        setTimeout(step, MOVE_SPEED);
      }
      setTimeout(step, 40);
    }

    function escapeOut(pig) {
      pig.el.classList.remove('running');
      pig.el.classList.add('escaping');
      var dx=DIRS[pig.dir].dx, dy=DIRS[pig.dir].dy;
      var bW=board.offsetWidth, bH=board.offsetHeight;
      var fL=parseFloat(pig.el.style.left), fT=parseFloat(pig.el.style.top);
      if (dx>0) fL=bW+50; if (dx<0) fL=-100;
      if (dy>0) fT=bH+50; if (dy<0) fT=-100;
      pig.el.style.left=fL+'px'; pig.el.style.top=fT+'px'; pig.el.style.opacity='0';
      playSound('escape', gState.soundEnabled);
      // 25%几率播放小猪逃跑成功音效
      if (Math.random() < 0.25) {
        playSound('pigEscaped', gState.soundEnabled);
      }
      setTimeout(function(){
        gState.pigs = gState.pigs.filter(function(p){return p.id!==pig.id;});
        pig.el.remove();
        gState.coins += 5;
        updateUI();
        gState.animating = false;
        checkWin();
      }, 350);
    }

    // Tool system
    function doRemove(id) {
      var pig = gState.pigs.find(function(p){return p.id===id;});
      if (!pig) return;
      gState.tools.remove--;
      pig.el.style.transition='transform 0.25s ease, opacity 0.25s ease';
      pig.el.style.transform='scale(0)'; pig.el.style.opacity='0';
      setTimeout(function(){
        gState.pigs = gState.pigs.filter(function(p){return p.id!==id;});
        pig.el.remove();
        checkWin();
      }, 250);
    }

    function doRotate(id) {
      var pig = gState.pigs.find(function(p){return p.id===id;});
      if (!pig) return;
      gState.tools.rotate--;
      var order=['up','right','down','left'];
      var idx=order.indexOf(pig.dir);
      pig.dir = order[(idx+1)%4];
      pig.el.dataset.dir = pig.dir;
      updateUI();
    }

    function doShuffle() {
      if (gState.tools.shuffle<=0||gState.animating||gState.paused) return;
      gState.tools.shuffle--;
      var allPos=[];
      for (var y=0;y<ROWS;y++) for (var x=0;x<COLS;x++) allPos.push({x:x,y:y});
      for (var i=allPos.length-1;i>0;i--) { var j=Math.floor(Math.random()*(i+1)); var t=allPos[i];allPos[i]=allPos[j];allPos[j]=t; }
      var gapX=((1-PIG_SCALE)/2)*CELL_W, gapY=((1-PIG_SCALE)/2)*CELL_H;
      gState.pigs.forEach(function(pig,index){
        var pos=allPos[index]; pig.x=pos.x; pig.y=pos.y;
        pig.el.style.left='calc('+pos.x*CELL_W+'% + '+gapX+'%)';
        pig.el.style.top='calc('+pos.y*CELL_H+'% + '+gapY+'%)';
      });
      updateUI();
    }

    function onToolClick(toolName) {
      if (gState.paused) return;
      if (gState.tools[toolName] > 0) {
        if (toolName==='shuffle') { doShuffle(); updateUI(); return; }
        gState.activeTool = gState.activeTool===toolName ? null : toolName;
        updateToolUI();
      } else {
        openQuiz(toolName);
      }
    }

    // Quiz system
    function openQuiz(toolName) {
      gState.currentQuizTool = toolName;
      gState.answerAttempts = 0;
      var bank = getActiveQuestionBank();
      var ri = Math.floor(Math.random() * bank.length);
      gState.currentQuiz = bank[ri];
      quizChapter.textContent = gState.currentQuiz.chapter;
      quizQuestion.textContent = gState.currentQuiz.question;
      quizOptions.innerHTML = '';
      quizTip.textContent = '';
      quizCloseBtn.style.display = 'none';
      gState.currentQuiz.options.forEach(function(opt, idx) {
        var div = document.createElement('div');
        div.className = 'pig-quiz-option';
        div.textContent = String.fromCharCode(65+idx) + '. ' + opt;
        div.addEventListener('click', function(){ selectAnswer(idx); });
        quizOptions.appendChild(div);
      });
      quizModal.classList.add('show');
    }

    function selectAnswer(index) {
      gState.answerAttempts++;
      var opts = quizOptions.querySelectorAll('.pig-quiz-option');
      var correct = gState.currentQuiz.answer;
      opts.forEach(function(o){ o.classList.add('disabled'); });
      if (index === correct) {
        opts[index].classList.add('correct');
        var reward = 0;
        if (gState.answerAttempts === 1) { reward=2; quizTip.textContent='回答正确！获得 '+reward+' 次道具'; }
        else if (gState.answerAttempts === 2) { reward=1; quizTip.textContent='回答正确！获得 '+reward+' 次道具'; }
        else { reward=0; quizTip.textContent='回答正确，但超过2次作答，无法获得道具'; }
        gState.tools[gState.currentQuizTool] += reward;
        quizCloseBtn.style.display = 'block';
        updateToolUI();
      } else {
        opts[index].classList.add('wrong');
        if (gState.answerAttempts >= 4) {
          opts[correct].classList.add('correct');
          quizTip.textContent = '4次作答均错误，无法获得道具';
          quizCloseBtn.style.display = 'block';
        } else {
          quizTip.textContent = '回答错误，还剩 '+(4-gState.answerAttempts)+' 次机会';
          setTimeout(function(){
            opts.forEach(function(o){ o.classList.remove('disabled','wrong'); });
          }, 800);
        }
      }
    }

    function closeQuiz() {
      quizModal.classList.remove('show');
      gState.currentQuizTool = null;
      gState.currentQuiz = null;
    }

    // Win / Next Level / Back to select
    function checkWin() {
      if (gState.pigs.length === 0) {
        stopTimer();
        playSound('win', gState.soundEnabled);

        // 判断是否首次通关（双重检查：cleared状态 + coinsEarned）
        var levelKey = String(gState.level);
        var prevLevelData = qs.pigRunLevels[levelKey];
        var isFirstClear = !prevLevelData || !prevLevelData.cleared;
        // 额外保护：如果该关卡已经获得过金币，则不算首次通关
        if (prevLevelData && prevLevelData.coinsEarned > 0) {
          isFirstClear = false;
        }

        // 保存成绩
        var result = saveLevelResult(student, gState.level, gState.totalPigCount, gState.timeSeconds, isFirstClear);

        // 更新本地 qs 引用
        qs = ensurePigRunState(student);

        // 更新顶部总分显示
        if (totalScoreEl) totalScoreEl.textContent = qs.pigRunTotalScore || 0;

        // 计算基础分和时间分
        var baseScore = gState.totalPigCount * 5;
        var timeBonus = result.levelScore - baseScore;

        // 构建胜利弹窗
        var winHtml = '<div class="pig-modal-title">🎉 全部逃脱成功！</div>';
        winHtml += '<div class="pig-modal-sub">第' + gState.level + '关通关</div>';
        winHtml += '<div class="pig-modal-score">得分: ' + result.levelScore + '分</div>';
        winHtml += '<div class="pig-modal-sub" style="font-size:13px;color:#888;">';
        winHtml += '基础分: ' + baseScore + ' (' + gState.totalPigCount + '只×5) + 时间分: ' + timeBonus;
        winHtml += '</div>';
        if (isFirstClear && result.coinReward > 0) {
          winHtml += '<div class="pig-modal-coins">💰 首次通关奖励: +' + result.coinReward + '金币</div>';
        } else if (!isFirstClear && result.scoreDiff > 0) {
          winHtml += '<div class="pig-modal-sub" style="color:#389e0d;">分数提高 +' + result.scoreDiff + '！</div>';
        } else if (!isFirstClear && result.scoreDiff <= 0) {
          winHtml += '<div class="pig-modal-sub" style="color:#888;">本次未超过最佳成绩</div>';
        }
        winHtml += '<div style="margin-top:16px;">';
        winHtml += '<button class="pig-modal-btn" id="pigNextLevelBtn">▶ 下一关</button>';
        winHtml += '<button class="pig-modal-btn secondary" id="pigBackBtn">🏠 关卡选择</button>';
        winHtml += '</div>';
        winContent.innerHTML = winHtml;

        setTimeout(function(){
          winModal.classList.add('show');
          // Bind buttons
          var nextBtn = document.getElementById('pigNextLevelBtn');
          var backBtn = document.getElementById('pigBackBtn');
          if (nextBtn) nextBtn.addEventListener('click', nextLevel);
          if (backBtn) backBtn.addEventListener('click', backToSelect);
        }, 300);
      }
    }

    function nextLevel() {
      gState.level++;
      winModal.classList.remove('show');
      gState.tools = {remove:1, shuffle:1, rotate:1};
      gState.timeSeconds = 0;
      timeDisplay.textContent = '00:00';
      startTimer();
      loadLevel(gState.level);
      updateUI();
    }

    function backToSelect() {
      winModal.classList.remove('show');
      stopTimer();
      // 重新渲染关卡选择
      qs = ensurePigRunState(student);
      renderLevelSelect(container, student, qs);
    }

    function updateUI() {
      coinCountEl.textContent = gState.coins;
      updateToolUI();
    }

    function updateToolUI() {
      removeCnt.textContent = gState.tools.remove;
      shuffleCnt.textContent = gState.tools.shuffle;
      rotateCnt.textContent = gState.tools.rotate;
      removeIcon.textContent = gState.tools.remove>0 ? '🗑' : '📝';
      shuffleIcon.textContent = gState.tools.shuffle>0 ? '🔀' : '📝';
      rotateIcon.textContent = gState.tools.rotate>0 ? '🔄' : '📝';
      removeBtn.classList.toggle('disabled', gState.tools.remove<=0);
      shuffleBtn.classList.toggle('disabled', gState.tools.shuffle<=0);
      rotateBtn.classList.toggle('disabled', gState.tools.rotate<=0);
      removeBtn.classList.toggle('active', gState.activeTool==='remove');
      rotateBtn.classList.toggle('active', gState.activeTool==='rotate');
    }

    // Grass decoration
    function addGrassDeco() {
      for (var i=0; i<20; i++) {
        var dot = document.createElement('div');
        dot.className = 'pig-grass-dot';
        var size = Math.random()*15+5;
        dot.style.width = size+'px'; dot.style.height = size+'px';
        dot.style.left = Math.random()*100+'%'; dot.style.top = Math.random()*100+'%';
        gameContainer.appendChild(dot);
      }
    }

    // Bind events
    removeBtn.addEventListener('click', function(){ onToolClick('remove'); });
    shuffleBtn.addEventListener('click', function(){ onToolClick('shuffle'); });
    rotateBtn.addEventListener('click', function(){ onToolClick('rotate'); });
    soundBtn.addEventListener('click', function(){
      gState.soundEnabled = !gState.soundEnabled;
      soundBtn.textContent = gState.soundEnabled ? '🔊' : '🔇';
    });
    pauseBtn.addEventListener('click', togglePause);
    resumeBtn.addEventListener('click', togglePause);
    if (quitBtn) quitBtn.addEventListener('click', backToSelect);
    quizCloseBtn.addEventListener('click', closeQuiz);

    // Init
    addGrassDeco();
    loadLevel(gState.level);
    updateUI();
    startTimer();
  }

  // === 题库管理界面 ===
  function openPigRunQuestionManager() {
    var teacherId = getCurrentTeacherId();
    if (!teacherId) return;
    
    var container = document.getElementById('pigRunContent');
    if (!container) return;
    
    renderQuestionManager(container, teacherId);
  }
  window.openPigRunQuestionManager = openPigRunQuestionManager;

  function renderQuestionManager(container, teacherId) {
    injectStyles();
    var questions = (customQuestionBank && customQuestionBank.length > 0) ? customQuestionBank : [];
    
    // 统计章节分布
    var chapterStats = {};
    questions.forEach(function(q) {
      var ch = q.chapter || '默认';
      chapterStats[ch] = (chapterStats[ch] || 0) + 1;
    });
    
    var html = '<div style="max-width:600px;margin:0 auto;padding:12px;">';
    // Header
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">';
    html += '<h2 style="font-size:20px;font-weight:800;color:#389e0d;margin:0;">📚 小猪快跑题库管理</h2>';
    html += '<button onclick="backToPigRunLevels()" style="background:#fff;color:#666;border:2px solid #ddd;border-radius:10px;padding:8px 16px;font-size:13px;font-weight:600;cursor:pointer;">← 返回</button>';
    html += '</div>';
    
    // Stats
    html += '<div style="background:#f0fff0;border-radius:12px;padding:12px;border:1px solid #90ee90;margin-bottom:16px;">';
    html += '<div style="font-size:14px;font-weight:700;color:#389e0d;margin-bottom:8px;">题库概况</div>';
    html += '<div style="font-size:13px;color:#555;">总题数：<strong>' + questions.length + '</strong></div>';
    if (Object.keys(chapterStats).length > 0) {
      html += '<div style="font-size:12px;color:#888;margin-top:4px;">章节分布：';
      var chKeys = Object.keys(chapterStats);
      chKeys.forEach(function(ch, i) {
        html += ch + '(' + chapterStats[ch] + '题)';
        if (i < chKeys.length - 1) html += '、';
      });
      html += '</div>';
    }
    html += '</div>';
    
    // Action buttons
    html += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;">';
    html += '<button onclick="showAddQuestionForm()" style="flex:1;min-width:120px;background:#52c41a;color:#fff;border:none;border-radius:10px;padding:10px;font-size:14px;font-weight:700;cursor:pointer;box-shadow:0 2px 8px rgba(82,196,26,0.3);">➕ 手动添加</button>';
    html += '<button onclick="showExcelImportForm()" style="flex:1;min-width:120px;background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;border:none;border-radius:10px;padding:10px;font-size:14px;font-weight:700;cursor:pointer;box-shadow:0 2px 8px rgba(102,126,234,0.3);">📊 Excel导入</button>';
    html += '<button onclick="downloadQuestionTemplate()" style="flex:1;min-width:120px;background:#fff;color:#666;border:2px solid #ddd;border-radius:10px;padding:10px;font-size:14px;font-weight:700;cursor:pointer;">📥 下载模板</button>';
    html += '</div>';
    
    // Add question form (hidden by default)
    html += '<div id="addQuestionForm" style="display:none;background:#fff;border-radius:12px;padding:16px;border:1px solid #e0e0e0;margin-bottom:16px;">';
    html += '<div style="font-size:15px;font-weight:700;color:#333;margin-bottom:12px;">添加新题目</div>';
    html += '<div style="margin-bottom:8px;"><label style="font-size:12px;color:#888;">章节</label><input id="newQChapter" type="text" placeholder="例：第七章 相交线与平行线" style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:8px;font-size:14px;box-sizing:border-box;"></div>';
    html += '<div style="margin-bottom:8px;"><label style="font-size:12px;color:#888;">题目</label><textarea id="newQQuestion" rows="2" placeholder="输入题目内容" style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:8px;font-size:14px;box-sizing:border-box;resize:vertical;"></textarea></div>';
    html += '<div style="margin-bottom:8px;"><label style="font-size:12px;color:#888;">选项A</label><input id="newQOptA" type="text" placeholder="选项A" style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:8px;font-size:14px;box-sizing:border-box;"></div>';
    html += '<div style="margin-bottom:8px;"><label style="font-size:12px;color:#888;">选项B</label><input id="newQOptB" type="text" placeholder="选项B" style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:8px;font-size:14px;box-sizing:border-box;"></div>';
    html += '<div style="margin-bottom:8px;"><label style="font-size:12px;color:#888;">选项C</label><input id="newQOptC" type="text" placeholder="选项C" style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:8px;font-size:14px;box-sizing:border-box;"></div>';
    html += '<div style="margin-bottom:8px;"><label style="font-size:12px;color:#888;">选项D</label><input id="newQOptD" type="text" placeholder="选项D" style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:8px;font-size:14px;box-sizing:border-box;"></div>';
    html += '<div style="margin-bottom:12px;"><label style="font-size:12px;color:#888;">正确答案</label><select id="newQAnswer" style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:8px;font-size:14px;box-sizing:border-box;"><option value="0">A</option><option value="1">B</option><option value="2">C</option><option value="3">D</option></select></div>';
    html += '<div style="display:flex;gap:8px;">';
    html += '<button onclick="submitNewQuestion()" style="flex:1;background:#52c41a;color:#fff;border:none;border-radius:10px;padding:10px;font-size:14px;font-weight:700;cursor:pointer;">确认添加</button>';
    html += '<button onclick="hideAddQuestionForm()" style="flex:1;background:#fff;color:#666;border:2px solid #ddd;border-radius:10px;padding:10px;font-size:14px;font-weight:700;cursor:pointer;">取消</button>';
    html += '</div></div>';
    
    // Excel import form (hidden by default)
    html += '<div id="excelImportForm" style="display:none;background:#fff;border-radius:12px;padding:16px;border:1px solid #e0e0e0;margin-bottom:16px;">';
    html += '<div style="font-size:15px;font-weight:700;color:#333;margin-bottom:8px;">📊 Excel批量导入</div>';
    html += '<div style="font-size:12px;color:#888;margin-bottom:12px;line-height:1.6;">';
    html += 'Excel格式要求：第一行为表头，列顺序为：<br>';
    html += '<strong>章节 | 题目 | 选项A | 选项B | 选项C | 选项D | 正确答案</strong><br>';
    html += '正确答案填字母 A/B/C/D，支持 .xlsx 和 .xls 格式';
    html += '</div>';
    html += '<input type="file" id="excelFileInput" accept=".xlsx,.xls" style="margin-bottom:12px;">';
    html += '<div id="excelImportStatus" style="font-size:13px;color:#666;margin-bottom:8px;min-height:20px;"></div>';
    html += '<div style="display:flex;gap:8px;">';
    html += '<button onclick="processExcelImport()" style="flex:1;background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;border:none;border-radius:10px;padding:10px;font-size:14px;font-weight:700;cursor:pointer;">开始导入</button>';
    html += '<button onclick="hideExcelImportForm()" style="flex:1;background:#fff;color:#666;border:2px solid #ddd;border-radius:10px;padding:10px;font-size:14px;font-weight:700;cursor:pointer;">取消</button>';
    html += '</div></div>';
    
    // Question list
    html += '<div style="font-size:14px;font-weight:700;color:#555;margin-bottom:8px;">题目列表（' + questions.length + ' 题）</div>';
    if (questions.length === 0) {
      html += '<div style="text-align:center;padding:30px;background:#fff;border-radius:12px;border:1px solid #e0e0e0;">';
      html += '<div style="font-size:40px;margin-bottom:8px;">📭</div>';
      html += '<div style="font-size:14px;color:#888;">暂无自定义题目</div>';
      html += '<div style="font-size:12px;color:#aaa;margin-top:4px;">学生将使用默认题库（' + questionBank.length + ' 题）</div>';
      html += '</div>';
    } else {
      html += '<div style="max-height:400px;overflow-y:auto;">';
      questions.forEach(function(q, idx) {
        html += '<div style="background:#fff;border-radius:10px;padding:12px;border:1px solid #e8e8e8;margin-bottom:8px;">';
        html += '<div style="display:flex;justify-content:space-between;align-items:flex-start;">';
        html += '<div style="flex:1;">';
        html += '<div style="font-size:11px;color:#999;margin-bottom:4px;">' + (q.chapter || '默认') + '</div>';
        html += '<div style="font-size:13px;color:#333;font-weight:600;margin-bottom:6px;">' + (idx + 1) + '. ' + escapeHtml(q.question) + '</div>';
        var opts = q.options || [];
        var labels = ['A', 'B', 'C', 'D'];
        opts.forEach(function(opt, oi) {
          var isCorrect = oi === q.answer;
          html += '<div style="font-size:12px;color:' + (isCorrect ? '#389e0d' : '#666') + ';margin-left:8px;">' + labels[oi] + '. ' + escapeHtml(opt) + (isCorrect ? ' ✓' : '') + '</div>';
        });
        html += '</div>';
        html += '<button onclick="deletePigRunQuestion(\'' + q.id + '\')" style="background:#ff4757;color:#fff;border:none;border-radius:8px;padding:4px 10px;font-size:12px;cursor:pointer;flex-shrink:0;margin-left:8px;">删除</button>';
        html += '</div></div>';
      });
      html += '</div>';
      
      // Clear all button
      html += '<div style="margin-top:12px;text-align:center;">';
      html += '<button onclick="clearAllPigRunQuestions()" style="background:#fff;color:#ff4757;border:2px solid #ff4757;border-radius:10px;padding:8px 20px;font-size:13px;font-weight:600;cursor:pointer;">🗑️ 清空所有题目</button>';
      html += '</div>';
    }
    
    html += '</div>';
    container.innerHTML = html;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // 返回关卡选择
  window.backToPigRunLevels = function() {
    var container = document.getElementById('pigRunContent');
    if (!container) return;
    var student = getCurrentStudent();
    if (!student) { renderPigRunPage(); return; }
    var qs = ensurePigRunState(student);
    renderLevelSelect(container, student, qs);
  };

  // 显示/隐藏添加表单
  window.showAddQuestionForm = function() {
    var form = document.getElementById('addQuestionForm');
    if (form) form.style.display = 'block';
  };
  window.hideAddQuestionForm = function() {
    var form = document.getElementById('addQuestionForm');
    if (form) form.style.display = 'none';
  };
  window.showExcelImportForm = function() {
    var form = document.getElementById('excelImportForm');
    if (form) form.style.display = 'block';
  };
  window.hideExcelImportForm = function() {
    var form = document.getElementById('excelImportForm');
    if (form) form.style.display = 'none';
  };

  // 提交新题目
  window.submitNewQuestion = function() {
    var teacherId = getCurrentTeacherId();
    if (!teacherId) return;
    
    var chapter = document.getElementById('newQChapter').value.trim();
    var question = document.getElementById('newQQuestion').value.trim();
    var optA = document.getElementById('newQOptA').value.trim();
    var optB = document.getElementById('newQOptB').value.trim();
    var optC = document.getElementById('newQOptC').value.trim();
    var optD = document.getElementById('newQOptD').value.trim();
    var answer = parseInt(document.getElementById('newQAnswer').value);
    
    if (!question) { alert('请输入题目内容'); return; }
    if (!optA || !optB) { alert('至少需要选项A和B'); return; }
    
    var options = [optA, optB, optC, optD].filter(Boolean);
    
    if (typeof db === 'undefined' || !db) { alert('数据库未连接'); return; }
    
    db.from('pig_run_questions').insert([{
      teacher_id: teacherId,
      chapter: chapter || '默认',
      question: question,
      options: JSON.stringify(options),
      answer: answer
    }]).then(function(r) {
      if (r.error) { alert('添加失败: ' + r.error.message); return; }
      // 刷新题库
      customQuestionBank = null;
      loadCustomQuestions(teacherId).then(function() {
        var container = document.getElementById('pigRunContent');
        if (container) renderQuestionManager(container, teacherId);
        if (typeof showNotification === 'function') showNotification('成功', '题目已添加', 'success');
      });
    });
  };

  // 删除题目
  window.deletePigRunQuestion = function(qId) {
    if (!confirm('确定删除这道题目？')) return;
    var teacherId = getCurrentTeacherId();
    if (!teacherId || typeof db === 'undefined' || !db) return;
    
    db.from('pig_run_questions').delete().eq('id', qId).eq('teacher_id', teacherId).then(function(r) {
      if (r.error) { alert('删除失败: ' + r.error.message); return; }
      customQuestionBank = null;
      loadCustomQuestions(teacherId).then(function() {
        var container = document.getElementById('pigRunContent');
        if (container) renderQuestionManager(container, teacherId);
      });
    });
  };

  // 清空所有题目
  window.clearAllPigRunQuestions = function() {
    if (!confirm('确定清空所有自定义题目？此操作不可恢复！')) return;
    if (!confirm('再次确认：清空后学生将使用默认题库，确定继续？')) return;
    var teacherId = getCurrentTeacherId();
    if (!teacherId || typeof db === 'undefined' || !db) return;
    
    db.from('pig_run_questions').delete().eq('teacher_id', teacherId).then(function(r) {
      if (r.error) { alert('清空失败: ' + r.error.message); return; }
      customQuestionBank = null;
      loadCustomQuestions(teacherId).then(function() {
        var container = document.getElementById('pigRunContent');
        if (container) renderQuestionManager(container, teacherId);
        if (typeof showNotification === 'function') showNotification('成功', '题库已清空', 'success');
      });
    });
  };

  // 下载Excel模板
  window.downloadQuestionTemplate = function() {
    // 动态加载 SheetJS
    if (typeof XLSX === 'undefined') {
      var script = document.createElement('script');
      script.src = 'https://cdn.sheetjs.com/xlsx-0.20.0/package/dist/xlsx.full.min.js';
      script.onload = function() { generateTemplateExcel(); };
      script.onerror = function() { alert('Excel库加载失败，请检查网络'); };
      document.head.appendChild(script);
    } else {
      generateTemplateExcel();
    }
  };

  function generateTemplateExcel() {
    var headers = ['章节', '题目', '选项A', '选项B', '选项C', '选项D', '正确答案'];
    var example = ['第七章 相交线与平行线', '下列命题中是假命题的是（ ）', '对顶角相等', '两条直线被第三条直线所截，同旁内角互补', '在同一平面内，过一点有且只有一条直线与已知直线垂直', '直线外一点到这条直线的垂线段的长度叫做点到直线的距离', 'B'];
    
    var ws = XLSX.utils.aoa_to_sheet([headers, example]);
    // 设置列宽
    ws['!cols'] = [{wch:20},{wch:40},{wch:25},{wch:25},{wch:25},{wch:25},{wch:10}];
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '题目模板');
    XLSX.writeFile(wb, '小猪快跑题目模板.xlsx');
  }

  // Excel导入
  window.processExcelImport = function() {
    var teacherId = getCurrentTeacherId();
    if (!teacherId) { alert('请先登录教师账号'); return; }
    
    var fileInput = document.getElementById('excelFileInput');
    var statusEl = document.getElementById('excelImportStatus');
    if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
      if (statusEl) statusEl.innerHTML = '<span style="color:#ff4757;">请先选择Excel文件</span>';
      return;
    }
    
    if (typeof XLSX === 'undefined') {
      var script = document.createElement('script');
      script.src = 'https://cdn.sheetjs.com/xlsx-0.20.0/package/dist/xlsx.full.min.js';
      script.onload = function() { doExcelImport(teacherId, fileInput.files[0], statusEl); };
      script.onerror = function() { if (statusEl) statusEl.innerHTML = '<span style="color:#ff4757;">Excel库加载失败</span>'; };
      document.head.appendChild(script);
    } else {
      doExcelImport(teacherId, fileInput.files[0], statusEl);
    }
  };

  function doExcelImport(teacherId, file, statusEl) {
    if (statusEl) statusEl.innerHTML = '<span style="color:#666;">正在解析文件...</span>';
    
    var reader = new FileReader();
    reader.onload = function(e) {
      try {
        var data = new Uint8Array(e.target.result);
        var workbook = XLSX.read(data, { type: 'array' });
        var sheetName = workbook.SheetNames[0];
        var sheet = workbook.Sheets[sheetName];
        var jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        
        if (jsonData.length < 2) {
          if (statusEl) statusEl.innerHTML = '<span style="color:#ff4757;">文件中没有数据</span>';
          return;
        }
        
        // 跳过表头，解析数据行
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
          
          if (!question) { errors.push('第' + (i + 1) + '行：题目为空'); continue; }
          if (!optA || !optB) { errors.push('第' + (i + 1) + '行：至少需要选项A和B'); continue; }
          
          var answer = answerMap[answerRaw];
          if (answer === undefined) {
            // 尝试数字
            answer = parseInt(answerRaw);
            if (isNaN(answer) || answer < 0 || answer > 3) {
              errors.push('第' + (i + 1) + '行：正确答案格式错误（应为A/B/C/D）');
              continue;
            }
          }
          
          var options = [optA, optB, optC, optD].filter(Boolean);
          questions.push({
            teacher_id: teacherId,
            chapter: chapter,
            question: question,
            options: JSON.stringify(options),
            answer: answer
          });
        }
        
        if (errors.length > 0) {
          if (statusEl) statusEl.innerHTML = '<span style="color:#ff4757;">发现 ' + errors.length + ' 个错误：<br>' + errors.slice(0, 5).join('<br>') + (errors.length > 5 ? '<br>...' : '') + '</span>';
          if (questions.length === 0) return;
        }
        
        if (questions.length === 0) {
          if (statusEl) statusEl.innerHTML = '<span style="color:#ff4757;">没有有效的题目可导入</span>';
          return;
        }
        
        if (statusEl) statusEl.innerHTML = '<span style="color:#666;">正在导入 ' + questions.length + ' 道题目...</span>';
        
        // 批量插入（去重：同一教师、同一题目内容不重复插入）
        // 先获取已有题目
        db.from('pig_run_questions').select('question').eq('teacher_id', teacherId).then(function(existingR) {
          var existingQuestions = {};
          if (existingR.data) {
            existingR.data.forEach(function(q) { existingQuestions[q.question] = true; });
          }
          
          // 过滤掉重复题目
          var newQuestions = questions.filter(function(q) { return !existingQuestions[q.question]; });
          var dupCount = questions.length - newQuestions.length;
          
          if (newQuestions.length === 0) {
            if (statusEl) statusEl.innerHTML = '<span style="color:#ff8800;">所有题目已存在（' + dupCount + ' 道重复），无需导入</span>';
            return;
          }
          
          db.from('pig_run_questions').insert(newQuestions).then(function(r) {
            if (r.error) {
              if (statusEl) statusEl.innerHTML = '<span style="color:#ff4757;">导入失败: ' + r.error.message + '</span>';
              return;
            }
            // 刷新题库
            customQuestionBank = null;
            loadCustomQuestions(teacherId).then(function() {
              var msg = '成功导入 ' + newQuestions.length + ' 道题目';
              if (dupCount > 0) msg += '（跳过 ' + dupCount + ' 道重复）';
              if (statusEl) statusEl.innerHTML = '<span style="color:#389e0d;">' + msg + '</span>';
              setTimeout(function() {
                var container = document.getElementById('pigRunContent');
                if (container) renderQuestionManager(container, teacherId);
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

  console.log('[小猪快跑] v15 loaded (关卡数据丢失修复)');
})();
