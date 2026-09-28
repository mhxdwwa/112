// ========== 作业岛系统 v274 ==========
// 分层布置作业、学生提交、教师批改、自动加金币
(function() {
  'use strict';

  // ========== 数据存储 ==========
  // 学生分层: { studentId: tier } tier = 'A' | 'B' | 'C'
  var homeworkTiers = JSON.parse(localStorage.getItem('homeworkTiers') || '{}');
  // 作业列表: [{ id, title, tier, description, image, createdAt, createdBy }]
  var homeworkList = JSON.parse(localStorage.getItem('homeworkList') || '[]');
  // 提交列表: [{ id, homeworkId, studentId, image, graded, grade, coins, comment, submittedAt, gradedAt }]
  var homeworkSubmissions = JSON.parse(localStorage.getItem('homeworkSubmissions') || '[]');

  // 当前操作状态
  var _currentSubmitHomeworkId = null;
  var _currentSubmitStudentId = null;
  var _currentSubmitImage = null;
  var _currentGradeSubmissionId = null;
  var _currentGradeValue = null;
  var _currentHomeworkImage = null;
  var _currentTab = 'manage'; // manage | homework | submissions

  // 评分等级对应金币
  var GRADE_COINS = { 3: 10, 2: 6, 1: 3 };
  var GRADE_LABELS = { 3: '优秀', 2: '良好', 1: '完成' };
  var GRADE_STARS = { 3: '⭐⭐⭐', 2: '⭐⭐', 1: '⭐' };
  var TIER_NAMES = { 'A': 'A层-基础', 'B': 'B层-提高', 'C': 'C层-拓展' };
  var TIER_COLORS = { 'A': '#166534', 'B': '#92400e', 'C': '#991b1b' };
  var TIER_BG = { 'A': '#dcfce7', 'B': '#fef3c7', 'C': '#fee2e2' };

  // ========== 工具函数 ==========
  function generateId() { return Date.now().toString(36) + Math.random().toString(36).substr(2, 5); }

  function saveData() {
    localStorage.setItem('homeworkTiers', JSON.stringify(homeworkTiers));
    localStorage.setItem('homeworkList', JSON.stringify(homeworkList));
    localStorage.setItem('homeworkSubmissions', JSON.stringify(homeworkSubmissions));
  }

  function getCurrentClass() {
    if (typeof classesData === 'undefined' || !currentClassId) return null;
    return classesData.find(function(c) { return c.id === currentClassId; });
  }

  function getCurrentStudents() {
    var cls = getCurrentClass();
    return cls ? cls.students : [];
  }

  function getStudentById(id) {
    var students = getCurrentStudents();
    return students.find(function(s) { return String(s.id) === String(id); });
  }

  function getStudentTier(studentId) {
    return homeworkTiers[String(studentId)] || null;
  }

  function getStudentsByTier(tier) {
    return getCurrentStudents().filter(function(s) {
      return homeworkTiers[String(s.id)] === tier;
    });
  }

  function getUnassignedStudents() {
    return getCurrentStudents().filter(function(s) {
      return !homeworkTiers[String(s.id)];
    });
  }

  // ========== 主页面渲染 ==========
  window.renderHomeworkPage = function() {
    var container = document.getElementById('homeworkContent');
    if (!container) return;

    var students = getCurrentStudents();
    if (students.length === 0) {
      container.innerHTML = '<div style="text-align:center;padding:60px 20px;color:#999;">' +
        '<div style="font-size:48px;margin-bottom:15px;">🏫</div>' +
        '<div style="font-size:16px;">请先在宠物管理中添加学生和班级</div></div>';
      return;
    }

    var html = '';
    // 标签页
    html += '<div style="display:flex;gap:5px;margin-bottom:20px;background:#f1f3f5;padding:5px;border-radius:12px;">';
    html += '<button class="hw-tab' + (_currentTab === 'manage' ? ' active' : '') + '" onclick="switchHomeworkTab(\'manage\')">👥 分层管理</button>';
    html += '<button class="hw-tab' + (_currentTab === 'homework' ? ' active' : '') + '" onclick="switchHomeworkTab(\'homework\')">📝 布置作业</button>';
    html += '<button class="hw-tab' + (_currentTab === 'submissions' ? ' active' : '') + '" onclick="switchHomeworkTab(\'submissions\')">📤 提交批改</button>';
    html += '</div>';

    // 内容区
    html += '<div id="hwTabContent">';
    if (_currentTab === 'manage') {
      html += renderTierManagement();
    } else if (_currentTab === 'homework') {
      html += renderHomeworkManagement();
    } else if (_currentTab === 'submissions') {
      html += renderSubmissionsView();
    }
    html += '</div>';

    container.innerHTML = html;
  };

  window.switchHomeworkTab = function(tab) {
    _currentTab = tab;
    renderHomeworkPage();
  };

  // ========== 分层管理 ==========
  function renderTierManagement() {
    var students = getCurrentStudents();
    var html = '<div class="card">';
    html += '<div class="card-title">👥 学生分层管理</div>';
    html += '<div style="font-size:13px;color:#666;margin-bottom:15px;">将学生分配到不同层级，布置作业时按层级分发</div>';

    // 统计
    var tierCounts = { 'A': 0, 'B': 0, 'C': 0, 'none': 0 };
    students.forEach(function(s) {
      var t = homeworkTiers[String(s.id)];
      if (t && tierCounts[t] !== undefined) tierCounts[t]++;
      else tierCounts['none']++;
    });

    html += '<div style="display:flex;gap:10px;margin-bottom:20px;flex-wrap:wrap;">';
    ['A', 'B', 'C'].forEach(function(t) {
      html += '<div style="flex:1;min-width:100px;padding:12px;background:' + TIER_BG[t] + ';border-radius:10px;text-align:center;">';
      html += '<div style="font-weight:700;color:' + TIER_COLORS[t] + ';">' + TIER_NAMES[t] + '</div>';
      html += '<div style="font-size:20px;font-weight:700;margin-top:4px;">' + tierCounts[t] + '</div>';
      html += '</div>';
    });
    if (tierCounts['none'] > 0) {
      html += '<div style="flex:1;min-width:100px;padding:12px;background:#f1f3f5;border-radius:10px;text-align:center;">';
      html += '<div style="font-weight:700;color:#666;">未分层</div>';
      html += '<div style="font-size:20px;font-weight:700;margin-top:4px;">' + tierCounts['none'] + '</div>';
      html += '</div>';
    }
    html += '</div>';

    // 学生列表
    html += '<div style="display:flex;flex-direction:column;gap:8px;">';
    students.forEach(function(s) {
      var tier = homeworkTiers[String(s.id)];
      html += '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:#f8f9fa;border-radius:10px;">';
      html += '<div style="display:flex;align-items:center;gap:10px;">';
      html += '<div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#667eea,#764ba2);display:flex;align-items:center;justify-content:center;color:white;font-weight:700;">' + (s.name ? s.name[0] : '?') + '</div>';
      html += '<div><div style="font-weight:600;">' + esc(s.name) + '</div>';
      html += '<div style="font-size:12px;color:#f59e0b;">💰 ' + (s.coins || 0) + ' 金币</div></div>';
      html += '</div>';
      html += '<div style="display:flex;align-items:center;gap:8px;">';
      if (tier) {
        html += '<span style="padding:4px 10px;border-radius:20px;font-size:11px;font-weight:600;background:' + TIER_BG[tier] + ';color:' + TIER_COLORS[tier] + ';">' + TIER_NAMES[tier] + '</span>';
      }
      html += '<select onchange="setStudentTier(\'' + s.id + '\', this.value)" style="padding:6px 10px;border:2px solid #e9ecef;border-radius:8px;font-size:12px;">';
      html += '<option value=""' + (!tier ? ' selected' : '') + '>未分层</option>';
      html += '<option value="A"' + (tier === 'A' ? ' selected' : '') + '>A层-基础</option>';
      html += '<option value="B"' + (tier === 'B' ? ' selected' : '') + '>B层-提高</option>';
      html += '<option value="C"' + (tier === 'C' ? ' selected' : '') + '>C层-拓展</option>';
      html += '</select>';
      html += '</div></div>';
    });
    html += '</div></div>';

    return html;
  }

  window.setStudentTier = function(studentId, tier) {
    if (tier) {
      homeworkTiers[String(studentId)] = tier;
    } else {
      delete homeworkTiers[String(studentId)];
    }
    saveData();
    renderHomeworkPage();
    var student = getStudentById(studentId);
    if (tier) {
      showNotification('已将 ' + (student ? student.name : '') + ' 分到' + TIER_NAMES[tier], 'success');
    }
  };

  // ========== 布置作业 ==========
  function renderHomeworkManagement() {
    var html = '<div class="card">';
    html += '<div class="card-title">📝 发布新作业</div>';
    html += '<div class="form-group"><label class="form-label">作业标题</label>';
    html += '<input type="text" id="hwTitle" placeholder="如：第三单元练习" style="width:100%;padding:12px;border:2px solid #e9ecef;border-radius:10px;font-size:14px;"></div>';

    html += '<div class="form-group"><label class="form-label">分发层级</label>';
    html += '<select id="hwTier" style="width:100%;padding:12px;border:2px solid #e9ecef;border-radius:10px;font-size:14px;">';
    html += '<option value="A">A层 - 基础组</option>';
    html += '<option value="B">B层 - 提高组</option>';
    html += '<option value="C">C层 - 拓展组</option>';
    html += '</select></div>';

    html += '<div class="form-group"><label class="form-label">作业图片</label>';
    html += '<div id="hwImageUpload" onclick="document.getElementById(\'hwImageInput\').click()" style="border:2px dashed #d1d5db;border-radius:12px;padding:30px;text-align:center;cursor:pointer;transition:all 0.2s;">';
    html += '<div style="color:#6b7280;font-size:14px;">📷 点击上传作业图片</div></div>';
    html += '<input type="file" id="hwImageInput" accept="image/*" style="display:none;" onchange="handleHomeworkImage(event)"></div>';

    html += '<div class="form-group"><label class="form-label">作业说明（可选）</label>';
    html += '<textarea id="hwDesc" placeholder="补充说明..." style="width:100%;padding:12px;border:2px solid #e9ecef;border-radius:10px;font-size:14px;min-height:60px;resize:vertical;"></textarea></div>';

    html += '<button onclick="publishHomework()" style="width:100%;padding:12px;background:linear-gradient(135deg,#11998e,#38ef7d);color:white;border:none;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;">发布作业</button>';
    html += '</div>';

    // 已发布作业列表
    html += '<div class="card"><div class="card-title">📋 已发布作业</div>';
    if (homeworkList.length === 0) {
      html += '<div style="text-align:center;padding:30px;color:#999;">暂无作业</div>';
    } else {
      html += '<div style="display:flex;flex-direction:column;gap:12px;">';
      homeworkList.slice().reverse().forEach(function(hw) {
        var submissions = homeworkSubmissions.filter(function(s) { return s.homeworkId === hw.id; });
        var targetCount = getStudentsByTier(hw.tier).length;
        var gradedCount = submissions.filter(function(s) { return s.graded; }).length;

        html += '<div style="padding:15px;background:#f8f9fa;border-radius:12px;border-left:4px solid #667eea;">';
        html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">';
        html += '<div style="font-weight:700;">' + esc(hw.title) + '</div>';
        html += '<span style="padding:4px 10px;border-radius:20px;font-size:11px;font-weight:600;background:' + TIER_BG[hw.tier] + ';color:' + TIER_COLORS[hw.tier] + ';">' + TIER_NAMES[hw.tier] + '</span>';
        html += '</div>';
        html += '<div style="font-size:12px;color:#666;margin-bottom:8px;">提交: ' + submissions.length + '/' + targetCount + ' | 已批改: ' + gradedCount + ' | ' + new Date(hw.createdAt).toLocaleDateString() + '</div>';
        if (hw.description) {
          html += '<div style="font-size:13px;color:#666;margin-bottom:8px;">' + esc(hw.description) + '</div>';
        }
        if (hw.image) {
          html += '<img src="' + hw.image + '" style="width:100%;max-height:150px;object-fit:contain;border-radius:8px;background:#e9ecef;">';
        }
        html += '<div style="margin-top:10px;"><button onclick="deleteHomework(\'' + hw.id + '\')" style="padding:6px 12px;background:#ef4444;color:white;border:none;border-radius:8px;font-size:12px;cursor:pointer;">删除</button></div>';
        html += '</div>';
      });
      html += '</div>';
    }
    html += '</div>';

    return html;
  }

  window.handleHomeworkImage = function(event) {
    var file = event.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function(e) {
      _currentHomeworkImage = e.target.result;
      var upload = document.getElementById('hwImageUpload');
      if (upload) {
        upload.innerHTML = '<img src="' + _currentHomeworkImage + '" style="max-width:100%;max-height:200px;border-radius:8px;">';
        upload.style.borderStyle = 'solid';
        upload.style.padding = '10px';
      }
    };
    reader.readAsDataURL(file);
  };

  window.publishHomework = function() {
    var title = document.getElementById('hwTitle').value.trim();
    var tier = document.getElementById('hwTier').value;
    var desc = document.getElementById('hwDesc').value.trim();

    if (!title) { showNotification('请输入作业标题', 'error'); return; }
    if (!_currentHomeworkImage) { showNotification('请上传作业图片', 'error'); return; }

    homeworkList.push({
      id: generateId(),
      title: title,
      tier: tier,
      description: desc,
      image: _currentHomeworkImage,
      createdAt: new Date().toISOString()
    });

    saveData();
    _currentHomeworkImage = null;
    showNotification('作业已发布', 'success');
    renderHomeworkPage();
  };

  window.deleteHomework = function(id) {
    if (!confirm('确定删除该作业？相关提交也会被删除。')) return;
    homeworkList = homeworkList.filter(function(h) { return h.id !== id; });
    homeworkSubmissions = homeworkSubmissions.filter(function(s) { return s.homeworkId !== id; });
    saveData();
    showNotification('已删除作业', 'info');
    renderHomeworkPage();
  };

  // ========== 提交批改 ==========
  function renderSubmissionsView() {
    var html = '<div class="card">';
    html += '<div class="card-title">📝 选择作业查看提交</div>';
    html += '<select id="hwSelectHomework" onchange="loadHomeworkSubmissions()" style="width:100%;padding:12px;border:2px solid #e9ecef;border-radius:10px;font-size:14px;">';
    html += '<option value="">-- 选择作业 --</option>';
    homeworkList.forEach(function(hw) {
      html += '<option value="' + hw.id + '">' + esc(hw.title) + ' (' + TIER_NAMES[hw.tier] + ')</option>';
    });
    html += '</select></div>';
    html += '<div id="hwSubmissionList"></div>';
    return html;
  }

  window.loadHomeworkSubmissions = function() {
    var homeworkId = document.getElementById('hwSelectHomework').value;
    var container = document.getElementById('hwSubmissionList');
    if (!container) return;

    if (!homeworkId) {
      container.innerHTML = '';
      return;
    }

    var hw = homeworkList.find(function(h) { return h.id === homeworkId; });
    if (!hw) return;

    var tierStudents = getStudentsByTier(hw.tier);
    var html = '<div class="card"><div class="card-title">📤 学生提交情况</div>';

    if (tierStudents.length === 0) {
      html += '<div style="text-align:center;padding:30px;color:#999;">该层级暂无学生</div>';
    } else {
      html += '<div style="display:flex;flex-direction:column;gap:10px;">';
      tierStudents.forEach(function(s) {
        var sub = homeworkSubmissions.find(function(sub) { return sub.homeworkId === homeworkId && sub.studentId === s.id; });

        html += '<div style="display:flex;align-items:center;justify-content:space-between;padding:12px 15px;background:#f8f9fa;border-radius:12px;">';
        html += '<div style="display:flex;align-items:center;gap:10px;">';
        html += '<div style="width:35px;height:35px;border-radius:50%;background:linear-gradient(135deg,#667eea,#764ba2);display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:14px;">' + (s.name ? s.name[0] : '?') + '</div>';
        html += '<div><div style="font-weight:600;">' + esc(s.name) + '</div>';

        if (!sub) {
          html += '<div style="font-size:12px;color:#999;">未提交</div>';
        } else if (!sub.graded) {
          html += '<div style="font-size:12px;color:#3b82f6;">待批改</div>';
        } else {
          html += '<div style="font-size:12px;color:#166534;">' + GRADE_STARS[sub.grade] + ' +' + sub.coins + '金币</div>';
        }
        html += '</div></div>';

        html += '<div style="display:flex;align-items:center;gap:8px;">';
        if (!sub) {
          html += '<button onclick="openSubmitModal(\'' + s.id + '\', \'' + homeworkId + '\')" style="padding:6px 12px;background:linear-gradient(135deg,#667eea,#764ba2);color:white;border:none;border-radius:8px;font-size:12px;cursor:pointer;">代提交</button>';
        } else if (!sub.graded) {
          html += '<button onclick="openGradeModal(\'' + sub.id + '\')" style="padding:6px 12px;background:linear-gradient(135deg,#f093fb,#f5576c);color:white;border:none;border-radius:8px;font-size:12px;cursor:pointer;">批改</button>';
        }
        html += '</div></div>';
      });
      html += '</div>';
    }
    html += '</div>';
    container.innerHTML = html;
  };

  window.openSubmitModal = function(studentId, homeworkId) {
    _currentSubmitStudentId = studentId;
    _currentSubmitHomeworkId = homeworkId;
    _currentSubmitImage = null;

    var student = getStudentById(studentId);
    var hw = homeworkList.find(function(h) { return h.id === homeworkId; });
    if (!student || !hw) return;

    var content = '<div style="padding:12px;background:#f8f9fa;border-radius:10px;margin-bottom:15px;">';
    content += '<div style="font-weight:600;">' + esc(hw.title) + '</div>';
    content += '<div style="font-size:12px;color:#666;margin-top:4px;">学生: ' + esc(student.name) + ' | ' + TIER_NAMES[hw.tier] + '</div>';
    content += '</div>';
    content += '<div class="form-group"><label class="form-label">拍照上传作业</label>';
    content += '<div id="submitImageUpload" onclick="document.getElementById(\'submitImageInput\').click()" style="border:2px dashed #d1d5db;border-radius:12px;padding:30px;text-align:center;cursor:pointer;">';
    content += '<div style="color:#6b7280;font-size:14px;">📷 点击拍照或上传</div></div>';
    content += '<input type="file" id="submitImageInput" accept="image/*" capture="environment" style="display:none;" onchange="handleSubmitImage(event)"></div>';

    showModal('📤 提交作业 - ' + student.name, content, [
      { text: '取消', class: 'btn-secondary', onclick: 'closeModal()' },
      { text: '提交', class: 'btn-primary', onclick: 'submitHomework()' }
    ]);
  };

  window.handleSubmitImage = function(event) {
    var file = event.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function(e) {
      _currentSubmitImage = e.target.result;
      var upload = document.getElementById('submitImageUpload');
      if (upload) {
        upload.innerHTML = '<img src="' + _currentSubmitImage + '" style="max-width:100%;max-height:200px;border-radius:8px;">';
        upload.style.borderStyle = 'solid';
        upload.style.padding = '10px';
      }
    };
    reader.readAsDataURL(file);
  };

  window.submitHomework = function() {
    if (!_currentSubmitImage) { showNotification('请先上传作业图片', 'error'); return; }

    homeworkSubmissions.push({
      id: generateId(),
      homeworkId: _currentSubmitHomeworkId,
      studentId: _currentSubmitStudentId,
      image: _currentSubmitImage,
      graded: false,
      grade: 0,
      coins: 0,
      comment: '',
      submittedAt: new Date().toISOString()
    });

    saveData();
    closeModal();
    showNotification('作业已提交', 'success');
    loadHomeworkSubmissions();
  };

  window.openGradeModal = function(submissionId) {
    _currentGradeSubmissionId = submissionId;
    _currentGradeValue = null;

    var sub = homeworkSubmissions.find(function(s) { return s.id === submissionId; });
    if (!sub) return;
    var student = getStudentById(sub.studentId);
    var hw = homeworkList.find(function(h) { return h.id === sub.homeworkId; });
    if (!student || !hw) return;

    var content = '<div style="padding:12px;background:#f8f9fa;border-radius:10px;margin-bottom:15px;">';
    content += '<div style="font-weight:600;">' + esc(student.name) + '</div>';
    content += '<div style="font-size:12px;color:#666;margin-top:4px;">' + esc(hw.title) + ' | ' + TIER_NAMES[hw.tier] + '</div>';
    content += '</div>';
    content += '<div style="margin-bottom:15px;"><img src="' + sub.image + '" style="width:100%;border-radius:8px;"></div>';
    content += '<div class="form-group"><label class="form-label">选择评分等级</label>';
    content += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;">';
    [3, 2, 1].forEach(function(g) {
      content += '<div id="gradeBtn' + g + '" onclick="selectGrade(' + g + ')" style="padding:15px;border:2px solid #e9ecef;border-radius:12px;background:white;cursor:pointer;text-align:center;transition:all 0.2s;">';
      content += '<div style="font-size:20px;margin-bottom:5px;">' + GRADE_STARS[g] + '</div>';
      content += '<div style="font-size:12px;color:#666;">' + GRADE_LABELS[g] + '</div>';
      content += '<div style="font-size:14px;font-weight:700;color:#f59e0b;">+' + GRADE_COINS[g] + '金币</div>';
      content += '</div>';
    });
    content += '</div></div>';
    content += '<div class="form-group"><label class="form-label">评语（可选）</label>';
    content += '<textarea id="gradeComment" placeholder="写点鼓励的话..." style="width:100%;padding:12px;border:2px solid #e9ecef;border-radius:10px;font-size:14px;min-height:60px;resize:vertical;"></textarea></div>';

    showModal('✏️ 批改作业', content, [
      { text: '取消', class: 'btn-secondary', onclick: 'closeModal()' },
      { text: '确认批改', class: 'btn-success', onclick: 'saveGrade()' }
    ]);
  };

  window.selectGrade = function(grade) {
    _currentGradeValue = grade;
    [1, 2, 3].forEach(function(g) {
      var btn = document.getElementById('gradeBtn' + g);
      if (btn) {
        if (g === grade) {
          btn.style.borderColor = '#667eea';
          btn.style.background = '#e0e7ff';
        } else {
          btn.style.borderColor = '#e9ecef';
          btn.style.background = 'white';
        }
      }
    });
  };

  window.saveGrade = function() {
    if (_currentGradeValue === null) { showNotification('请选择评分等级', 'error'); return; }

    var sub = homeworkSubmissions.find(function(s) { return s.id === _currentGradeSubmissionId; });
    if (!sub) return;
    var student = getStudentById(sub.studentId);
    if (!student) return;

    var coins = GRADE_COINS[_currentGradeValue] || 0;
    var commentEl = document.getElementById('gradeComment');
    var comment = commentEl ? commentEl.value.trim() : '';

    sub.graded = true;
    sub.grade = _currentGradeValue;
    sub.coins = coins;
    sub.comment = comment;
    sub.gradedAt = new Date().toISOString();

    // TODO: 后期接入金币系统
    // 调用 changeStudentCoins(student, coins, '作业批改', ...) 发放金币

    saveData();
    closeModal();
    showNotification('已批改，评分: ' + GRADE_LABELS[_currentGradeValue], 'success');
    loadHomeworkSubmissions();
  };

  // ========== 辅助函数（复用主系统的） ==========
  function esc(str) {
    if (str == null) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // 添加样式
  var style = document.createElement('style');
  style.textContent = '.hw-tab{flex:1;padding:10px;border:none;background:transparent;border-radius:8px;font-size:13px;font-weight:600;color:#666;cursor:pointer;transition:all 0.2s;}.hw-tab.active{background:white;color:#333;box-shadow:0 2px 8px rgba(0,0,0,0.08);}.card{background:white;border-radius:16px;padding:20px;margin-bottom:15px;box-shadow:0 4px 20px rgba(0,0,0,0.1);}.card-title{font-size:18px;font-weight:700;color:#333;margin-bottom:15px;display:flex;align-items:center;gap:8px;}.form-group{margin-bottom:15px;}.form-label{display:block;font-size:13px;font-weight:600;color:#555;margin-bottom:6px;}';
  document.head.appendChild(style);

  console.log('[homework-system] 作业岛系统已加载 v274');
})();
