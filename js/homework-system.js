// ========== 作业岛系统 v275 ==========
// 按钮式功能栏 + 分层管理 + 布置作业 + 手写批阅 + 评分金币
(function() {
  'use strict';

  // ========== 数据存储 ==========
  var homeworkTiers = JSON.parse(localStorage.getItem('homeworkTiers') || '{}');
  var homeworkList = JSON.parse(localStorage.getItem('homeworkList') || '[]');
  var homeworkSubmissions = JSON.parse(localStorage.getItem('homeworkSubmissions') || '[]');

  // 状态
  var _currentTab = null; // null | 'manage' | 'homework' | 'submissions'
  var _currentHomeworkImage = null;
  var _activeTierEdit = null; // 当前正在编辑的层级 'A'|'B'|'C'|null
  var _tierEditSelections = {}; // { studentId: true } 临时多选
  // 批阅状态
  var _gradingSubId = null;
  var _gradeCanvas = null;
  var _gradeCtx = null;
  var _gradeImg = null;
  var _drawColor = '#ef4444';
  var _drawTool = 'pen'; // pen | eraser | text
  var _drawLineWidth = 3;
  var _isDrawing = false;
  var _lastX = 0;
  var _lastY = 0;
  var _canvasScale = 1;

  // 评分等级 → 金币 (新标准)
  var GRADE_COINS = { 'A+': 70, 'A': 50, 'B+': 30, 'B': 20, 'C': 10 };
  var GRADE_OPTIONS = ['A+', 'A', 'B+', 'B', 'C'];
  var GRADE_COLORS = { 'A+': '#f59e0b', 'A': '#22c55e', 'B+': '#3b82f6', 'B': '#8b5cf6', 'C': '#6b7280' };
  var TIER_NAMES = { 'A': 'A层-基础', 'B': 'B层-提高', 'C': 'C层-拓展' };
  var TIER_COLORS = { 'A': '#166534', 'B': '#92400e', 'C': '#991b1b' };
  var TIER_BG = { 'A': '#dcfce7', 'B': '#fef3c7', 'C': '#fee2e2' };
  var TIER_BTN_BG = { 'A': 'linear-gradient(135deg,#22c55e,#16a34a)', 'B': 'linear-gradient(135deg,#f59e0b,#d97706)', 'C': 'linear-gradient(135deg,#ef4444,#dc2626)' };
  var PEN_COLORS = ['#ef4444','#f97316','#eab308','#22c55e','#3b82f6','#8b5cf6','#ec4899','#000000'];

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

  function getStudentsByTier(tier) {
    return getCurrentStudents().filter(function(s) {
      return homeworkTiers[String(s.id)] === tier;
    });
  }

  function esc(str) {
    if (str == null) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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
    var html = renderButtonBar();
    html += '<div id="hwPanelContent">';
    if (_currentTab === 'manage') {
      html += renderTierManagement();
    } else if (_currentTab === 'homework') {
      html += renderHomeworkManagement();
    } else if (_currentTab === 'submissions') {
      html += renderSubmissionsView();
    } else {
      html += '<div style="text-align:center;padding:50px 20px;color:#aaa;"><div style="font-size:40px;margin-bottom:12px;">📝</div><div>请选择上方功能按钮</div></div>';
    }
    html += '</div>';
    container.innerHTML = html;
  };

  // ========== 按钮式功能栏 ==========
  function renderButtonBar() {
    var html = '<div style="display:flex;gap:10px;margin-bottom:20px;">';
    var buttons = [
      { key: 'manage', icon: '👥', label: '分层管理', gradient: 'linear-gradient(135deg,#667eea,#764ba2)' },
      { key: 'homework', icon: '📝', label: '布置作业', gradient: 'linear-gradient(135deg,#f093fb,#f5576c)' },
      { key: 'submissions', icon: '📤', label: '提交批改', gradient: 'linear-gradient(135deg,#4facfe,#00f2fe)' }
    ];
    buttons.forEach(function(b) {
      var active = _currentTab === b.key;
      html += '<button onclick="switchHomeworkTab(\'' + b.key + '\')" style="flex:1;padding:14px 10px;border:none;border-radius:14px;font-size:14px;font-weight:700;cursor:pointer;transition:all 0.25s;display:flex;align-items:center;justify-content:center;gap:6px;';
      if (active) {
        html += 'background:' + b.gradient + ';color:white;box-shadow:0 4px 15px rgba(0,0,0,0.2);transform:translateY(-2px);';
      } else {
        html += 'background:white;color:#555;box-shadow:0 2px 8px rgba(0,0,0,0.06);';
      }
      html += '">' + b.icon + ' ' + b.label + '</button>';
    });
    html += '</div>';
    return html;
  }

  window.switchHomeworkTab = function(tab) {
    _currentTab = (_currentTab === tab) ? null : tab;
    _activeTierEdit = null;
    _tierEditSelections = {};
    renderHomeworkPage();
  };

  // ========== 分层管理 ==========
  function renderTierManagement() {
    var students = getCurrentStudents();
    var html = '<div class="hw-card">';
    html += '<div class="hw-card-title">👥 学生分层管理</div>';
    html += '<div style="font-size:13px;color:#666;margin-bottom:15px;">点击层级按钮，为该层添加或移除学生</div>';

    // 统计
    var tierCounts = { 'A': 0, 'B': 0, 'C': 0, 'none': 0 };
    students.forEach(function(s) {
      var t = homeworkTiers[String(s.id)];
      if (t && tierCounts[t] !== undefined) tierCounts[t]++;
      else tierCounts['none']++;
    });

    // 三个层级按钮
    html += '<div style="display:flex;gap:10px;margin-bottom:20px;flex-wrap:wrap;">';
    ['A', 'B', 'C'].forEach(function(t) {
      var isActive = _activeTierEdit === t;
      html += '<button onclick="openTierEdit(\'' + t + '\')" style="flex:1;min-width:100px;padding:15px;border:3px solid ' + (isActive ? TIER_COLORS[t] : 'transparent') + ';border-radius:14px;cursor:pointer;text-align:center;transition:all 0.25s;';
      if (isActive) {
        html += 'background:' + TIER_BG[t] + ';box-shadow:0 4px 15px rgba(0,0,0,0.15);transform:translateY(-2px);';
      } else {
        html += 'background:' + TIER_BG[t] + ';opacity:0.85;';
      }
      html += '">';
      html += '<div style="font-weight:700;color:' + TIER_COLORS[t] + ';font-size:15px;">' + TIER_NAMES[t] + '</div>';
      html += '<div style="font-size:24px;font-weight:800;margin-top:4px;color:' + TIER_COLORS[t] + ';">' + tierCounts[t] + '</div>';
      html += '<div style="font-size:11px;color:#888;margin-top:2px;">' + (isActive ? '编辑中...' : '点击管理') + '</div>';
      html += '</button>';
    });
    if (tierCounts['none'] > 0) {
      html += '<div style="flex:1;min-width:100px;padding:15px;background:#f1f3f5;border-radius:14px;text-align:center;">';
      html += '<div style="font-weight:700;color:#666;">未分层</div>';
      html += '<div style="font-size:24px;font-weight:800;margin-top:4px;color:#666;">' + tierCounts['none'] + '</div>';
      html += '</div>';
    }
    html += '</div>';

    // 如果正在编辑某个层级
    if (_activeTierEdit) {
      html += renderTierEditPanel(_activeTierEdit);
    }

    // 已分层学生总览
    html += renderTierOverview();

    html += '</div>';
    return html;
  }

  window.openTierEdit = function(tier) {
    if (_activeTierEdit === tier) {
      _activeTierEdit = null;
      _tierEditSelections = {};
    } else {
      _activeTierEdit = tier;
      _tierEditSelections = {};
    }
    renderHomeworkPage();
  };

  function renderTierEditPanel(tier) {
    var students = getCurrentStudents();
    // 获取未参与任何其他分层的学生 + 已在当前层的学生
    var available = students.filter(function(s) {
      var t = homeworkTiers[String(s.id)];
      return !t || t === tier; // 未分层 或 已在当前层
    });

    var currentMembers = getStudentsByTier(tier);

    var html = '<div style="background:#f8f9fa;border-radius:14px;padding:18px;margin-bottom:15px;border:2px solid ' + TIER_BG[tier] + ';">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">';
    html += '<div style="font-weight:700;color:' + TIER_COLORS[tier] + ';">编辑 ' + TIER_NAMES[tier] + ' 名单</div>';
    var selCount = Object.keys(_tierEditSelections).filter(function(k) { return _tierEditSelections[k]; }).length;
    html += '<div style="font-size:12px;color:#888;">已选 ' + selCount + ' 人</div>';
    html += '</div>';

    // 当前层内成员
    if (currentMembers.length > 0) {
      html += '<div style="margin-bottom:12px;">';
      html += '<div style="font-size:12px;color:#888;margin-bottom:6px;font-weight:600;">当前层内成员（点击移除）</div>';
      html += '<div style="display:flex;flex-wrap:wrap;gap:4px;">';
      currentMembers.forEach(function(s) {
        html += '<div class="hw-student-chip selected" onclick="toggleTierStudent(\'' + s.id + '\')" style="background:#fee2e2;border-color:#ef4444;color:#991b1b;">';
        html += esc(s.name) + ' ✕</div>';
      });
      html += '</div></div>';
    }

    // 可选学生（未分层的）
    var unassigned = available.filter(function(s) { return !homeworkTiers[String(s.id)]; });
    if (unassigned.length > 0) {
      html += '<div style="margin-bottom:12px;">';
      html += '<div style="font-size:12px;color:#888;margin-bottom:6px;font-weight:600;">可加入的学生（点击选取）</div>';
      html += '<div style="display:flex;flex-wrap:wrap;gap:4px;">';
      unassigned.forEach(function(s) {
        var selected = _tierEditSelections[String(s.id)];
        html += '<div class="hw-student-chip' + (selected ? ' selected' : '') + '" onclick="toggleTierStudent(\'' + s.id + '\')" style="background:' + (selected ? '#e0e7ff' : 'white') + ';">';
        html += esc(s.name) + '</div>';
      });
      html += '</div></div>';
    } else if (currentMembers.length === 0) {
      html += '<div style="text-align:center;padding:20px;color:#aaa;font-size:13px;">所有学生都已分配到其他层级</div>';
    }

    // 操作按钮
    html += '<div style="display:flex;gap:10px;margin-top:12px;">';
    html += '<button onclick="saveTierEdit(\'' + tier + '\')" class="hw-btn hw-btn-success" style="flex:1;">💾 保存分层</button>';
    html += '<button onclick="openTierEdit(\'' + tier + '\')" class="hw-btn hw-btn-secondary" style="flex:1;">取消</button>';
    html += '</div>';
    html += '</div>';
    return html;
  }

  window.toggleTierStudent = function(studentId) {
    var sid = String(studentId);
    var currentTier = homeworkTiers[sid];
    // 如果是当前编辑层的已有成员 → 标记为移除
    if (currentTier === _activeTierEdit) {
      if (_tierEditSelections[sid]) {
        delete _tierEditSelections[sid]; // 取消移除标记
      } else {
        _tierEditSelections[sid] = 'remove'; // 标记移除
      }
    } else {
      // 未分层学生 → 切换选取
      if (_tierEditSelections[sid]) {
        delete _tierEditSelections[sid];
      } else {
        _tierEditSelections[sid] = 'add';
      }
    }
    renderHomeworkPage();
  };

  window.saveTierEdit = function(tier) {
    var addCount = 0, removeCount = 0;
    Object.keys(_tierEditSelections).forEach(function(sid) {
      var action = _tierEditSelections[sid];
      if (action === 'add') {
        homeworkTiers[sid] = tier;
        addCount++;
      } else if (action === 'remove') {
        delete homeworkTiers[sid];
        removeCount++;
      }
    });
    saveData();
    _tierEditSelections = {};
    _activeTierEdit = null;
    var msg = '已保存';
    var parts = [];
    if (addCount > 0) parts.push('加入 ' + addCount + ' 人');
    if (removeCount > 0) parts.push('移除 ' + removeCount + ' 人');
    if (parts.length > 0) msg += '：' + parts.join('，');
    showNotification(msg, 'success');
    renderHomeworkPage();
  };

  function renderTierOverview() {
    var html = '<div style="margin-top:10px;">';
    html += '<div style="font-size:14px;font-weight:700;color:#555;margin-bottom:10px;">分层总览</div>';
    ['A', 'B', 'C'].forEach(function(t) {
      var members = getStudentsByTier(t);
      if (members.length === 0) return;
      html += '<div style="margin-bottom:10px;padding:12px;background:' + TIER_BG[t] + ';border-radius:10px;">';
      html += '<div style="font-weight:600;color:' + TIER_COLORS[t] + ';font-size:13px;margin-bottom:6px;">' + TIER_NAMES[t] + ' (' + members.length + '人)</div>';
      html += '<div style="display:flex;flex-wrap:wrap;gap:4px;">';
      members.forEach(function(s) {
        html += '<span style="padding:3px 10px;background:white;border-radius:15px;font-size:12px;color:' + TIER_COLORS[t] + ';">' + esc(s.name) + '</span>';
      });
      html += '</div></div>';
    });
    html += '</div>';
    return html;
  }

  // ========== 布置作业 ==========
  function renderHomeworkManagement() {
    var html = '<div class="hw-card">';
    html += '<div class="hw-card-title">📝 发布新作业</div>';
    html += '<div class="hw-form-group"><label class="hw-form-label">作业标题</label>';
    html += '<input type="text" id="hwTitle" placeholder="如：第三单元练习" style="width:100%;padding:12px;border:2px solid #e9ecef;border-radius:10px;font-size:14px;box-sizing:border-box;"></div>';

    html += '<div class="hw-form-group"><label class="hw-form-label">分发层级</label>';
    html += '<select id="hwTier" style="width:100%;padding:12px;border:2px solid #e9ecef;border-radius:10px;font-size:14px;box-sizing:border-box;">';
    ['A', 'B', 'C'].forEach(function(t) {
      var existing = homeworkList.find(function(h) { return h.tier === t; });
      var label = TIER_NAMES[t];
      if (existing) label += ' (已有作业，发布将替换)';
      html += '<option value="' + t + '">' + label + '</option>';
    });
    html += '</select></div>';

    html += '<div class="hw-form-group"><label class="hw-form-label">作业图片</label>';
    html += '<div id="hwImageUpload" onclick="document.getElementById(\'hwImageInput\').click()" style="border:2px dashed #d1d5db;border-radius:12px;padding:30px;text-align:center;cursor:pointer;transition:all 0.2s;">';
    html += '<div style="color:#6b7280;font-size:14px;">📷 点击上传作业图片</div></div>';
    html += '<input type="file" id="hwImageInput" accept="image/*" style="display:none;" onchange="handleHomeworkImage(event)"></div>';

    html += '<div class="hw-form-group"><label class="hw-form-label">作业说明（可选）</label>';
    html += '<textarea id="hwDesc" placeholder="补充说明..." style="width:100%;padding:12px;border:2px solid #e9ecef;border-radius:10px;font-size:14px;min-height:60px;resize:vertical;box-sizing:border-box;"></textarea></div>';

    html += '<button onclick="publishHomework()" style="width:100%;padding:14px;background:linear-gradient(135deg,#11998e,#38ef7d);color:white;border:none;border-radius:12px;font-size:15px;font-weight:700;cursor:pointer;">发布作业</button>';
    html += '</div>';

    // 已发布作业列表
    html += '<div class="hw-card"><div class="hw-card-title">📋 已发布作业</div>';
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
        html += '<div style="margin-top:10px;"><button onclick="deleteHomework(\'' + hw.id + '\')" class="hw-btn hw-btn-danger" style="font-size:12px;padding:6px 14px;">删除</button></div>';
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
    
    // 查找该层级是否已有作业
    var existingHw = homeworkList.find(function(h) { return h.tier === tier; });
    if (existingHw) {
      // 删除旧作业及其所有提交记录
      var oldHwId = existingHw.id;
      homeworkList = homeworkList.filter(function(h) { return h.id !== oldHwId; });
      homeworkSubmissions = homeworkSubmissions.filter(function(s) { return s.homeworkId !== oldHwId; });
    }
    
    // 发布新作业
    homeworkList.push({
      id: generateId(), title: title, tier: tier, description: desc,
      image: _currentHomeworkImage, createdAt: new Date().toISOString()
    });
    saveData();
    _currentHomeworkImage = null;
    
    var msg = '作业已发布';
    if (existingHw) {
      msg += '（已替换该层级的旧作业）';
    }
    showNotification(msg, 'success');
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
    var html = '<div class="hw-card">';
    html += '<div class="hw-card-title">📤 提交批改</div>';
    html += '<div class="hw-form-group"><label class="hw-form-label">选择作业</label>';
    html += '<select id="hwSelectHomework" onchange="loadHomeworkSubmissions()" style="width:100%;padding:12px;border:2px solid #e9ecef;border-radius:10px;font-size:14px;box-sizing:border-box;">';
    html += '<option value="">-- 选择作业 --</option>';
    homeworkList.forEach(function(hw) {
      var subs = homeworkSubmissions.filter(function(s) { return s.homeworkId === hw.id; });
      var graded = subs.filter(function(s) { return s.graded; }).length;
      html += '<option value="' + hw.id + '">' + esc(hw.title) + ' (' + TIER_NAMES[hw.tier] + ') [' + graded + '/' + subs.length + '已批]</option>';
    });
    html += '</select></div>';
    html += '</div>';
    html += '<div id="hwSubmissionList"></div>';
    return html;
  }

  window.loadHomeworkSubmissions = function() {
    var homeworkId = document.getElementById('hwSelectHomework').value;
    var container = document.getElementById('hwSubmissionList');
    if (!container) return;
    if (!homeworkId) { container.innerHTML = ''; return; }

    var hw = homeworkList.find(function(h) { return h.id === homeworkId; });
    if (!hw) return;
    var tierStudents = getStudentsByTier(hw.tier);

    var html = '<div class="hw-card">';
    html += '<div class="hw-card-title">📋 学生作业一览</div>';
    html += '<div style="font-size:13px;color:#666;margin-bottom:15px;">共 ' + tierStudents.length + ' 名学生，点击「查看/批改」进行批阅</div>';

    if (tierStudents.length === 0) {
      html += '<div style="text-align:center;padding:30px;color:#999;">该层级暂无学生</div>';
    } else {
      html += '<div style="display:flex;flex-direction:column;gap:12px;">';
      tierStudents.forEach(function(s) {
        var sub = homeworkSubmissions.find(function(sub) { return sub.homeworkId === homeworkId && sub.studentId === s.id; });
        var borderColor = sub ? (sub.graded ? '#22c55e' : '#f59e0b') : '#e9ecef';
        html += '<div style="padding:15px;background:#f8f9fa;border-radius:14px;border-left:4px solid ' + borderColor + ';">';
        html += '<div style="display:flex;align-items:center;justify-content:space-between;">';
        html += '<div style="display:flex;align-items:center;gap:10px;">';
        html += '<div style="width:38px;height:38px;border-radius:50%;background:linear-gradient(135deg,#667eea,#764ba2);display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:14px;">' + (s.name ? s.name[0] : '?') + '</div>';
        html += '<div>';
        html += '<div style="font-weight:700;font-size:14px;">' + esc(s.name) + '</div>';
        if (!sub) {
          html += '<div style="font-size:12px;color:#999;">未提交</div>';
        } else if (!sub.graded) {
          html += '<div style="font-size:12px;color:#f59e0b;font-weight:600;">待批改</div>';
        } else {
          html += '<div style="font-size:12px;color:#166534;font-weight:600;">' + sub.grade + ' · +' + sub.coins + '金币</div>';
        }
        html += '</div></div>';
        html += '<div style="display:flex;gap:8px;">';
        if (!sub) {
          html += '<button onclick="openSubmitModal(\'' + s.id + '\', \'' + homeworkId + '\')" class="hw-btn hw-btn-primary" style="font-size:12px;padding:8px 14px;">代提交</button>';
        } else {
          html += '<button onclick="openGradingCanvas(\'' + sub.id + '\')" class="hw-btn ' + (sub.graded ? 'hw-btn-success' : 'hw-btn-primary') + '" style="font-size:12px;padding:8px 14px;">' + (sub.graded ? '查看/已批' : '批改') + '</button>';
        }
        html += '</div></div>';
        // 缩略图
        if (sub && sub.image) {
          html += '<div style="margin-top:10px;position:relative;">';
          html += '<img src="' + (sub.gradedImage || sub.image) + '" style="width:100%;max-height:120px;object-fit:contain;border-radius:8px;background:white;">';
          if (sub.graded && sub.grade) {
            html += '<div style="position:absolute;top:5px;right:5px;padding:3px 10px;border-radius:15px;font-size:12px;font-weight:800;color:white;background:' + (GRADE_COLORS[sub.grade] || '#666') + ';">' + sub.grade + '</div>';
          }
          html += '</div>';
        }
        html += '</div>';
      });
      html += '</div>';
    }
    html += '</div>';
    container.innerHTML = html;
  };

  // 代学生提交作业弹窗
  window.openSubmitModal = function(studentId, homeworkId) {
    var student = getStudentById(studentId);
    var hw = homeworkList.find(function(h) { return h.id === homeworkId; });
    if (!student || !hw) return;
    _currentSubmitStudentId = studentId;
    _currentSubmitHomeworkId = homeworkId;
    _currentSubmitImage = null;

    var content = '<div style="padding:12px;background:#f8f9fa;border-radius:10px;margin-bottom:15px;">';
    content += '<div style="font-weight:600;">' + esc(hw.title) + '</div>';
    content += '<div style="font-size:12px;color:#666;margin-top:4px;">学生: ' + esc(student.name) + ' | ' + TIER_NAMES[hw.tier] + '</div>';
    content += '</div>';
    content += '<div class="hw-form-group"><label class="hw-form-label">拍照上传作业</label>';
    content += '<div id="submitImageUpload" onclick="document.getElementById(\'submitImageInput\').click()" style="border:2px dashed #d1d5db;border-radius:12px;padding:30px;text-align:center;cursor:pointer;">';
    content += '<div style="color:#6b7280;font-size:14px;">📷 点击拍照或上传</div></div>';
    content += '<input type="file" id="submitImageInput" accept="image/*" capture="environment" style="display:none;" onchange="handleSubmitImage(event)"></div>';

    showModal('📤 提交作业 - ' + student.name, content, [
      { text: '取消', class: 'btn-secondary', onclick: 'closeModal()' },
      { text: '提交', class: 'btn-primary', onclick: 'submitHomework()' }
    ]);
  };

  var _currentSubmitStudentId = null;
  var _currentSubmitHomeworkId = null;
  var _currentSubmitImage = null;

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
      id: generateId(), homeworkId: _currentSubmitHomeworkId, studentId: _currentSubmitStudentId,
      image: _currentSubmitImage, graded: false, grade: '', coins: 0, comment: '',
      gradedImage: null, submittedAt: new Date().toISOString()
    });
    saveData();
    closeModal();
    showNotification('作业已提交', 'success');
    loadHomeworkSubmissions();
  };

  // ========== 批阅画布（手写批阅 + 颜色笔 + 橡皮擦 + 打字 + 清除 + 评分） ==========
  window.openGradingCanvas = function(submissionId) {
    var sub = homeworkSubmissions.find(function(s) { return s.id === submissionId; });
    if (!sub) return;
    var student = getStudentById(sub.studentId);
    var hw = homeworkList.find(function(h) { return h.id === sub.homeworkId; });
    if (!student || !hw) return;

    _gradingSubId = submissionId;
    _drawTool = 'pen';
    _drawColor = '#ef4444';
    _drawLineWidth = 3;

    // 构建全屏批阅界面
    var overlay = document.createElement('div');
    overlay.id = 'gradingOverlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.85);z-index:10000;display:flex;flex-direction:column;';

    var html = '';
    // 顶部栏
    html += '<div id="gradingTopBar" style="padding:10px 15px;background:#1a1a2e;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;">';
    html += '<div style="color:white;font-weight:700;font-size:14px;">✏️ ' + esc(student.name) + ' - ' + esc(hw.title) + '</div>';
    html += '<div style="display:flex;gap:8px;">';
    html += '<button onclick="closeGradingCanvas()" style="padding:6px 14px;background:#ef4444;color:white;border:none;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;">✕ 关闭</button>';
    html += '</div></div>';

    // 工具栏
    html += '<div id="gradingToolbar" style="padding:8px 12px;background:#16213e;display:flex;align-items:center;gap:8px;flex-wrap:wrap;flex-shrink:0;">';
    // 画笔工具
    html += '<button id="toolPen" onclick="setDrawTool(\'pen\')" style="padding:6px 12px;background:#667eea;color:white;border:none;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;">✏️ 画笔</button>';
    html += '<button id="toolEraser" onclick="setDrawTool(\'eraser\')" style="padding:6px 12px;background:#444;color:#ccc;border:none;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;">🧹 橡皮</button>';
    html += '<button id="toolText" onclick="setDrawTool(\'text\')" style="padding:6px 12px;background:#444;color:#ccc;border:none;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;">⌨️ 打字</button>';
    html += '<span style="width:1px;height:24px;background:#444;margin:0 4px;"></span>';
    // 颜色选择
    PEN_COLORS.forEach(function(c) {
      html += '<div onclick="setDrawColor(\'' + c + '\')" class="pen-color-btn" data-color="' + c + '" style="width:24px;height:24px;border-radius:50%;background:' + c + ';cursor:pointer;border:2px solid ' + (c === _drawColor ? 'white' : 'transparent') + ';transition:all 0.15s;"></div>';
    });
    html += '<span style="width:1px;height:24px;background:#444;margin:0 4px;"></span>';
    // 粗细
    html += '<select id="drawLineWidth" onchange="setDrawLineWidth(this.value)" style="padding:4px 8px;background:#333;color:white;border:1px solid #555;border-radius:6px;font-size:11px;">';
    html += '<option value="2">细</option><option value="3" selected>中</option><option value="5">粗</option><option value="8">特粗</option>';
    html += '</select>';
    html += '<span style="width:1px;height:24px;background:#444;margin:0 4px;"></span>';
    // 清除 & 撤销
    html += '<button onclick="clearCanvas()" style="padding:6px 12px;background:#ef4444;color:white;border:none;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;">🗑 清除</button>';
    html += '</div>';

    // 画布区域
    html += '<div id="canvasContainer" style="flex:1;overflow:auto;display:flex;align-items:center;justify-content:center;padding:10px;background:#2a2a3a;">';
    html += '<canvas id="gradingCanvas" style="max-width:100%;border-radius:8px;box-shadow:0 4px 20px rgba(0,0,0,0.5);cursor:crosshair;touch-action:none;"></canvas>';
    html += '</div>';

    // 底部评分栏
    html += '<div id="gradingBottom" style="padding:10px 15px;background:#1a1a2e;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;flex-shrink:0;">';
    html += '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">';
    html += '<span style="color:#aaa;font-size:12px;font-weight:600;">评分:</span>';
    GRADE_OPTIONS.forEach(function(g) {
      var isCurrentGrade = sub.graded && sub.grade === g;
      html += '<button onclick="selectGradeAndSave(\'' + g + '\')" class="grade-btn" data-grade="' + g + '" style="padding:8px 14px;border:2px solid ' + (isCurrentGrade ? GRADE_COLORS[g] : '#444') + ';background:' + (isCurrentGrade ? GRADE_COLORS[g] : '#2a2a3a') + ';color:' + (isCurrentGrade ? 'white' : '#aaa') + ';border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;transition:all 0.15s;">' + g;
      html += '<span style="font-size:10px;display:block;color:' + (isCurrentGrade ? 'rgba(255,255,255,0.8)' : '#666') + ';">+' + GRADE_COINS[g] + '币</span></button>';
    });
    html += '</div>';
    html += '<div style="display:flex;gap:8px;">';
    html += '<button onclick="saveGradingImage()" style="padding:10px 24px;background:linear-gradient(135deg,#11998e,#38ef7d);color:white;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;">💾 保存批阅</button>';
    html += '</div></div>';

    overlay.innerHTML = html;
    document.body.appendChild(overlay);

    // 初始化画布
    setTimeout(function() { initGradingCanvas(sub); }, 100);
  };

  function initGradingCanvas(sub) {
    var canvas = document.getElementById('gradingCanvas');
    if (!canvas) return;
    _gradeCanvas = canvas;
    _gradeCtx = canvas.getContext('2d');

    var img = new Image();
    img.onload = function() {
      _gradeImg = img;
      // 计算画布尺寸 - 限制最大宽度
      var maxW = Math.min(window.innerWidth - 40, 800);
      var scale = maxW / img.width;
      if (scale > 1) scale = 1;
      _canvasScale = scale;
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      // 绘制底图
      _gradeCtx.drawImage(img, 0, 0, canvas.width, canvas.height);
      // 如果有已保存的批阅图层，叠加
      if (sub.gradedImage) {
        var overlay2 = new Image();
        overlay2.onload = function() {
          _gradeCtx.drawImage(overlay2, 0, 0, canvas.width, canvas.height);
          _markClean = false;
        };
        overlay2.src = sub.gradedImage;
      }
    };
    img.src = sub.image;

    // 绑定绘制事件
    canvas.addEventListener('mousedown', onCanvasDown);
    canvas.addEventListener('mousemove', onCanvasMove);
    canvas.addEventListener('mouseup', onCanvasUp);
    canvas.addEventListener('mouseleave', onCanvasUp);
    // 触摸事件
    canvas.addEventListener('touchstart', onCanvasTouchDown, { passive: false });
    canvas.addEventListener('touchmove', onCanvasTouchMove, { passive: false });
    canvas.addEventListener('touchend', onCanvasUp);
  }

  var _markClean = true;
  var _undoStack = [];

  function saveCanvasState() {
    if (!_gradeCanvas) return;
    _undoStack.push(_gradeCanvas.toDataURL());
    if (_undoStack.length > 20) _undoStack.shift();
  }

  function getCanvasPos(e) {
    var rect = _gradeCanvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (_gradeCanvas.width / rect.width),
      y: (e.clientY - rect.top) * (_gradeCanvas.height / rect.height)
    };
  }

  function onCanvasDown(e) {
    if (_drawTool === 'text') {
      var pos = getCanvasPos(e);
      var text = prompt('输入批注文字:');
      if (text && text.trim()) {
        saveCanvasState();
        _gradeCtx.font = 'bold ' + Math.max(16, _drawLineWidth * 5) + 'px sans-serif';
        _gradeCtx.fillStyle = _drawColor;
        _gradeCtx.fillText(text, pos.x, pos.y);
        _markClean = false;
      }
      return;
    }
    _isDrawing = true;
    saveCanvasState();
    var pos = getCanvasPos(e);
    _lastX = pos.x;
    _lastY = pos.y;
  }

  function onCanvasMove(e) {
    if (!_isDrawing) return;
    var pos = getCanvasPos(e);
    drawLine(_lastX, _lastY, pos.x, pos.y);
    _lastX = pos.x;
    _lastY = pos.y;
  }

  function onCanvasUp() {
    _isDrawing = false;
  }

  function onCanvasTouchDown(e) {
    e.preventDefault();
    var touch = e.touches[0];
    var mouseEvent = new MouseEvent('mousedown', { clientX: touch.clientX, clientY: touch.clientY });
    if (_drawTool === 'text') {
      onCanvasDown(mouseEvent);
    } else {
      onCanvasDown(mouseEvent);
    }
  }

  function onCanvasTouchMove(e) {
    e.preventDefault();
    var touch = e.touches[0];
    var mouseEvent = new MouseEvent('mousemove', { clientX: touch.clientX, clientY: touch.clientY });
    onCanvasMove(mouseEvent);
  }

  function drawLine(x1, y1, x2, y2) {
    if (!_gradeCtx) return;
    _gradeCtx.beginPath();
    _gradeCtx.moveTo(x1, y1);
    _gradeCtx.lineTo(x2, y2);
    _gradeCtx.strokeStyle = _drawTool === 'eraser' ? '#ffffff' : _drawColor;
    _gradeCtx.lineWidth = _drawTool === 'eraser' ? _drawLineWidth * 4 : _drawLineWidth;
    _gradeCtx.lineCap = 'round';
    _gradeCtx.lineJoin = 'round';
    _gradeCtx.stroke();
    _markClean = false;
  }

  window.setDrawTool = function(tool) {
    _drawTool = tool;
    var tools = ['Pen', 'Eraser', 'Text'];
    tools.forEach(function(t) {
      var btn = document.getElementById('tool' + t);
      if (btn) {
        if (t.toLowerCase() === tool) {
          btn.style.background = '#667eea';
          btn.style.color = 'white';
        } else {
          btn.style.background = '#444';
          btn.style.color = '#ccc';
        }
      }
    });
    // 更新画布光标
    if (_gradeCanvas) {
      _gradeCanvas.style.cursor = tool === 'text' ? 'text' : (tool === 'eraser' ? 'cell' : 'crosshair');
    }
  };

  window.setDrawColor = function(color) {
    _drawColor = color;
    _drawTool = 'pen';
    window.setDrawTool('pen');
    // 更新颜色按钮边框
    var btns = document.querySelectorAll('.pen-color-btn');
    btns.forEach(function(btn) {
      btn.style.border = '2px solid ' + (btn.getAttribute('data-color') === color ? 'white' : 'transparent');
    });
  };

  window.setDrawLineWidth = function(w) {
    _drawLineWidth = parseInt(w) || 3;
  };

  window.clearCanvas = function() {
    if (!_gradeCanvas || !_gradeImg) return;
    if (!confirm('确定清除所有批注？')) return;
    saveCanvasState();
    _gradeCtx.clearRect(0, 0, _gradeCanvas.width, _gradeCanvas.height);
    _gradeCtx.drawImage(_gradeImg, 0, 0, _gradeCanvas.width, _gradeCanvas.height);
    _markClean = true;
  };

  window.closeGradingCanvas = function() {
    var overlay = document.getElementById('gradingOverlay');
    if (overlay) overlay.remove();
    _gradingSubId = null;
    _gradeCanvas = null;
    _gradeCtx = null;
    _gradeImg = null;
    _undoStack = [];
  };

  window.selectGradeAndSave = function(grade) {
    // 高亮选中的评分按钮
    var btns = document.querySelectorAll('.grade-btn');
    btns.forEach(function(btn) {
      var g = btn.getAttribute('data-grade');
      if (g === grade) {
        btn.style.background = GRADE_COLORS[g];
        btn.style.borderColor = GRADE_COLORS[g];
        btn.style.color = 'white';
        btn.querySelector('span').style.color = 'rgba(255,255,255,0.8)';
      } else {
        btn.style.background = '#2a2a3a';
        btn.style.borderColor = '#444';
        btn.style.color = '#aaa';
        btn.querySelector('span').style.color = '#666';
      }
    });
    // 在画布上打上等级标记
    if (_gradeCanvas && _gradeCtx) {
      var w = _gradeCanvas.width;
      var h = _gradeCanvas.height;
      // 画等级标签
      _gradeCtx.save();
      var tagW = 80 * _canvasScale, tagH = 36 * _canvasScale;
      var tagX = w - tagW - 10, tagY = 10;
      _gradeCtx.fillStyle = GRADE_COLORS[grade] || '#666';
      _gradeCtx.beginPath();
      _gradeCtx.roundRect(tagX, tagY, tagW, tagH, 8 * _canvasScale);
      _gradeCtx.fill();
      _gradeCtx.fillStyle = 'white';
      _gradeCtx.font = 'bold ' + (18 * _canvasScale) + 'px sans-serif';
      _gradeCtx.textAlign = 'center';
      _gradeCtx.textBaseline = 'middle';
      _gradeCtx.fillText(grade, tagX + tagW / 2, tagY + tagH / 2);
      _gradeCtx.restore();
    }
    // 自动保存
    _pendingGrade = grade;
  };

  var _pendingGrade = null;

  window.saveGradingImage = function() {
    if (!_gradingSubId || !_gradeCanvas) return;
    var sub = homeworkSubmissions.find(function(s) { return s.id === _gradingSubId; });
    if (!sub) return;

    // 导出画布为图片（只导出批注层 - 不含底图）
    // 先获取完整画布图像
    var fullDataUrl = _gradeCanvas.toDataURL('image/png');

    // 创建纯批注层
    var annotCanvas = document.createElement('canvas');
    annotCanvas.width = _gradeCanvas.width;
    annotCanvas.height = _gradeCanvas.height;
    var annotCtx = annotCanvas.getContext('2d');
    // 绘制底图
    if (_gradeImg) {
      annotCtx.drawImage(_gradeImg, 0, 0, annotCanvas.width, annotCanvas.height);
    }
    // 在上面叠加当前批注
    annotCtx.drawImage(_gradeCanvas, 0, 0);
    var annotatedImage = annotCanvas.toDataURL('image/png');

    // 评分
    var grade = _pendingGrade || sub.grade || 'C';
    var coins = GRADE_COINS[grade] || 10;
    var student = getStudentById(sub.studentId);

    // 更新提交记录
    sub.graded = true;
    sub.grade = grade;
    sub.coins = coins;
    sub.gradedImage = annotatedImage;
    sub.gradedAt = new Date().toISOString();

    // 发放金币
    if (student && typeof changeStudentCoins === 'function') {
      var oldCoins = sub._prevCoins || 0;
      var delta = coins - oldCoins;
      if (delta !== 0) {
        changeStudentCoins(student, delta, '作业批改-' + grade, {
          type: 'homework_grade', homeworkId: sub.homeworkId, grade: grade
        });
      }
      sub._prevCoins = coins;
    }

    saveData();
    _pendingGrade = null;

    // 关闭画布
    window.closeGradingCanvas();
    showNotification('已批改: ' + grade + '，+' + coins + ' 金币', 'success');
    // 刷新列表
    if (typeof loadHomeworkSubmissions === 'function') {
      setTimeout(loadHomeworkSubmissions, 300);
    }
  };

  // ========== 样式注入 ==========
  var style = document.createElement('style');
  style.textContent = '.hw-card{background:white;border-radius:16px;padding:20px;margin-bottom:15px;box-shadow:0 4px 20px rgba(0,0,0,0.1);}.hw-card-title{font-size:18px;font-weight:700;color:#333;margin-bottom:15px;display:flex;align-items:center;gap:8px;}.hw-form-group{margin-bottom:15px;}.hw-form-label{display:block;font-size:13px;font-weight:600;color:#555;margin-bottom:6px;}.hw-student-chip{display:inline-flex;align-items:center;gap:5px;padding:6px 12px;border-radius:20px;font-size:12px;font-weight:600;cursor:pointer;transition:all 0.2s;border:2px solid transparent;margin:3px;}.hw-student-chip.selected{border-color:#667eea;background:#e0e7ff;color:#4338ca;}.hw-student-chip.assigned{opacity:0.4;cursor:not-allowed;}.hw-btn{padding:10px 20px;border:none;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;transition:all 0.2s;}.hw-btn-primary{background:linear-gradient(135deg,#667eea,#764ba2);color:white;}.hw-btn-success{background:linear-gradient(135deg,#11998e,#38ef7d);color:white;}.hw-btn-danger{background:linear-gradient(135deg,#ef4444,#dc2626);color:white;}.hw-btn-secondary{background:#f1f3f5;color:#555;}';
  document.head.appendChild(style);

  console.log('[homework-system] 作业岛系统已加载 v275');
})();
