// 快乐跑一跑 - 集成到取金阁
// v1 - 框架占位，待后续添加游戏逻辑

(function() {
  'use strict';

  // === 渲染快乐跑一跑页面 ===
  function renderHappyRunPage() {
    var container = document.getElementById('happyRunContent');
    if (!container) return;

    var isStudentView = typeof currentUser !== 'undefined' && currentUser && currentUser.type === 'student';

    if (!isStudentView) {
      // 教师视图：显示开始和题库按钮
      container.innerHTML = (typeof renderTeacherPlaceholder === 'function')
        ? renderTeacherPlaceholder('happyrun')
        : '<div style="text-align:center;padding:40px;"><div style="font-size:60px;">🏃</div><div style="font-size:18px;font-weight:700;margin-top:12px;">快乐跑一跑</div><div style="font-size:14px;color:#888;margin-top:8px;">正在选取参赛学生...</div></div>';
      return;
    }

    // 学生视图：占位，待添加游戏逻辑
    container.innerHTML = '<div style="text-align:center;padding:40px;"><div style="font-size:60px;">🏃</div><div style="font-size:18px;font-weight:700;margin-top:12px;">快乐跑一跑</div><div style="font-size:14px;color:#888;margin-top:8px;">游戏即将上线，敬请期待...</div></div>';
  }
  window.renderHappyRunPage = renderHappyRunPage;

})();
