// ========== 排行榜滚动公告系统 ==========
// 从 app.js 拆分 - v129
// ========== 排行榜滚动公告系统 ==========
(function() {
  'use strict';

  // 记录已播报的班级，使用localStorage持久化（每个账户每班级1小时冷却）
  var _announcementQueue = [];

  // 获取当前班级的排行榜前三名
  function getTopThree(type) {
    if (!classesData || !classesData.length) return [];

    // 仅取当前班级的学生
    var currentClass = null;
    for (var i = 0; i < classesData.length; i++) {
      if (classesData[i].id === currentClassId) { currentClass = classesData[i]; break; }
    }
    if (!currentClass || !currentClass.students) return [];

    var allStudents = [];
    currentClass.students.forEach(function(stu) {
      allStudents.push({ name: stu.name, student: stu });
    });
    if (allStudents.length === 0) return [];

    if (type === 'growth') {
      allStudents.forEach(function(item) {
        var totalGrowth = 0;
        if (item.student.pets && item.student.pets.length) {
          item.student.pets.forEach(function(p) { totalGrowth += (p.growth || 0); });
        }
        item.value = totalGrowth;
      });
    } else if (type === 'quiz') {
      allStudents.forEach(function(item) {
        var qs = item.student.quizState || {};
        item.value = qs.totalQuizCoins || 0;
      });
    } else if (type === 'pigrun') {
      allStudents.forEach(function(item) {
        var qs = item.student.quizState || {};
        item.value = qs.pigRunTotalScore || 0;
      });
    } else if (type === 'match3') {
      allStudents.forEach(function(item) {
        var qs = item.student.quizState || {};
        item.value = qs.match3TotalScore || 0;
      });
    } else if (type === 'happyrun') {
      allStudents.forEach(function(item) {
        var qs = item.student.quizState || {};
        item.value = qs.happyRunTotalSilver || qs.happyRunTotalScore || 0;
      });
    }

    allStudents.sort(function(a, b) { return b.value - a.value; });
    return allStudents.slice(0, 3);
  }

  // 滚动显示一条公告
  function showAnnouncement(text, callback) {
    var banner = document.getElementById('rankAnnouncementBanner');
    var textEl = document.getElementById('rankAnnouncementText');
    if (!banner || !textEl) { if (callback) callback(); return; }

    banner.classList.add('show');
    textEl.textContent = text;
    var duration = Math.max(8, text.length / 8);
    textEl.style.animationDuration = duration + 's';
    textEl.style.animation = 'none';
    textEl.offsetHeight;
    textEl.style.animation = '';
    setTimeout(function() { if (callback) callback(); }, duration * 1000 + 200);
  }

  // 显示下一条公告
  function showNextAnnouncement(announceClassId) {
    if (_announcementQueue.length === 0) {
      var banner = document.getElementById('rankAnnouncementBanner');
      if (banner) banner.classList.remove('show');
      // 记录播报时间到localStorage，1小时内不再重复
      try {
        var storageKey = _getAnnounceStorageKey(announceClassId);
        localStorage.setItem(storageKey, String(Date.now()));
      } catch(e) {}
      return;
    }
    var text = _announcementQueue.shift();
    showAnnouncement(text, function() {
      setTimeout(function() { showNextAnnouncement(announceClassId); }, 300);
    });
  }

  // 每个账户每个班级至少间隔1小时才滚动公告一次
  var ANNOUNCE_COOLDOWN_MS = 60 * 60 * 1000; // 1小时

  function _getAnnounceStorageKey(classId) {
    var userId = 'anon';
    try {
      if (typeof currentUser !== 'undefined' && currentUser) {
        userId = currentUser.id || currentUser.name || 'anon';
      }
    } catch(e) {}
    return 'm3_announce_' + userId + '_' + classId;
  }

  // 启动排行榜公告（指定班级）
  window.showRankAnnouncement = function(targetClassId) {
    var classId = targetClassId || currentClassId;

    // 检查localStorage中的上次播报时间，间隔不足1小时则跳过
    try {
      var storageKey = _getAnnounceStorageKey(classId);
      var lastTime = parseInt(localStorage.getItem(storageKey)) || 0;
      var now = Date.now();
      if (now - lastTime < ANNOUNCE_COOLDOWN_MS) return;
    } catch(e) {}

    if (!classesData || !classesData.length) return;

    _announcementQueue = [];

    var growthTop = getTopThree('growth');
    if (growthTop.length > 0) {
      var t = '🐾 宠物成长值前三名：';
      growthTop.forEach(function(item, idx) { t += (idx + 1) + '.' + item.name + ' '; });
      _announcementQueue.push(t);
    }

    var quizTop = getTopThree('quiz');
    if (quizTop.length > 0) {
      var t2 = '📝 每日一练前三名：';
      quizTop.forEach(function(item, idx) { t2 += (idx + 1) + '.' + item.name + ' '; });
      _announcementQueue.push(t2);
    }

    var pigrunTop = getTopThree('pigrun');
    if (pigrunTop.length > 0) {
      var t3 = '🐷 小猪快跑前三名：';
      pigrunTop.forEach(function(item, idx) { t3 += (idx + 1) + '.' + item.name + ' '; });
      _announcementQueue.push(t3);
    }

    var match3Top = getTopThree('match3');
    if (match3Top.length > 0) {
      var t4 = '🧩 宠物消消乐前三名：';
      match3Top.forEach(function(item, idx) { t4 += (idx + 1) + '.' + item.name + ' '; });
      _announcementQueue.push(t4);
    }

    var happyrunTop = getTopThree('happyrun');
    if (happyrunTop.length > 0) {
      var t5 = '🏃 快乐跑前三名：';
      happyrunTop.forEach(function(item, idx) { t5 += (idx + 1) + '.' + item.name + ' '; });
      _announcementQueue.push(t5);
    }

    if (_announcementQueue.length > 0) {
      showNextAnnouncement(classId);
    } else {
      // 没有数据也记录时间戳，避免重复触发
      try {
        var storageKey = _getAnnounceStorageKey(classId);
        localStorage.setItem(storageKey, String(Date.now()));
      } catch(e) {}
    }
  };

  // 重置公告状态（用于测试）
  window.resetRankAnnouncement = function() {
    _announcementQueue = [];
    var banner = document.getElementById('rankAnnouncementBanner');
    if (banner) banner.classList.remove('show');
  };
})();
// ========== 排行榜滚动公告系统结束 ==========
