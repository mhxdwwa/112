// Supabase 配置
const SUPABASE_URL = 'https://xbygooadskfqllnhwmet.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhieWdvb2Fkc2tmcWxsbmh3bWV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5NjU0NDgsImV4cCI6MjA5ODU0MTQ0OH0.ryfpesmsFqBnaJurlMhjEJOWxZV4oFg3NBu7kQD8EKA';

// 使用 db 作为变量名，避免和 window.supabase 冲突
var db;
(function initSupabase() {
  try {
    if (window.supabase && window.supabase.createClient) {
      db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      console.log('Supabase connected');
    } else {
      console.error('Supabase SDK not loaded, retrying in 1s...');
      setTimeout(initSupabase, 1000);
    }
  } catch (e) {
    console.error('Supabase init error:', e);
  }
})();

// 切换标签页
function switchTab(type, evt) {
  document.querySelectorAll('.tab').forEach(function(t) { t.classList.remove('active'); });
  if (evt && evt.target) { evt.target.classList.add('active'); }
  
  if (type === 'teacher') {
    document.getElementById('teacherForm').classList.remove('hidden');
    document.getElementById('teacherRegisterForm').classList.add('hidden');
    document.getElementById('studentForm').classList.add('hidden');
    document.getElementById('studentRegisterForm').classList.add('hidden');
  } else {
    document.getElementById('teacherForm').classList.add('hidden');
    document.getElementById('teacherRegisterForm').classList.add('hidden');
    document.getElementById('studentForm').classList.remove('hidden');
    document.getElementById('studentRegisterForm').classList.add('hidden');
  }
}

// 显示注册表单
function showRegister(type) {
  if (type === 'teacher') {
    document.getElementById('teacherForm').classList.add('hidden');
    document.getElementById('teacherRegisterForm').classList.remove('hidden');
  } else {
    document.getElementById('studentForm').classList.add('hidden');
    document.getElementById('studentRegisterForm').classList.remove('hidden');
  }
}

// 显示登录表单
function showLogin(type) {
  if (type === 'teacher') {
    document.getElementById('teacherForm').classList.remove('hidden');
    document.getElementById('teacherRegisterForm').classList.add('hidden');
  } else {
    document.getElementById('studentForm').classList.remove('hidden');
    document.getElementById('studentRegisterForm').classList.add('hidden');
  }
}

// 加载可用班级列表（帮助学生选择正确班级）
async function loadAvailableClasses() {
  if (!db) return;
  try {
    // 按 ID 升序，确保同名班级优先返回最早创建的
    var result = await db.from('classes').select('id, name').order('id', { ascending: true });
    if (result.data && result.data.length > 0) {
      // 去重：同名班级只保留 ID 最小的那个
      var seen = {};
      var uniqueClasses = [];
      result.data.forEach(function(c) {
        if (!seen[c.name]) {
          seen[c.name] = true;
          uniqueClasses.push(c);
        }
      });
      window._availableClasses = uniqueClasses;
      updateClassDatalist(uniqueClasses);
    } else {
      window._availableClasses = [];
    }
  } catch (e) {
    console.warn('加载班级列表失败:', e.message);
    window._availableClasses = [];
  }
}

// 更新班级下拉提示
function updateClassDatalist(classes) {
  var datalist = document.getElementById('classSuggestions');
  if (!datalist) return;
  datalist.innerHTML = '';
  var seen = {};
  classes.forEach(function(c) {
    if (!seen[c.name]) {
      seen[c.name] = true;
      var opt = document.createElement('option');
      opt.value = c.name;
      datalist.appendChild(opt);
    }
  });
}

// 显示可用班级弹窗
function showClassListModal(targetInputId) {
  if (!window._availableClasses || window._availableClasses.length === 0) {
    alert('目前没有可用班级。请确认老师已经创建了班级并同步到云端。\n\n你可以：\n1. 确认班级名称是否拼写正确\n2. 请老师打开页面确认右上角显示"已同步"\n3. 请老师点击"手动同步"按钮');
    return;
  }
  var names = window._availableClasses.map(function(c) { return c.name; });
  var unique = [];
  var seen = {};
  names.forEach(function(n) { if (!seen[n]) { seen[n] = true; unique.push(n); } });
  var html = '<div style="max-height:300px;overflow-y:auto;">';
  unique.forEach(function(name) {
    html += '<div onclick="pickClass(\'' + name.replace(/'/g, "\\'") + '\', \'' + targetInputId + '\')" style="padding:12px 16px;margin:6px 0;background:#fff5f5;border:1px solid #ffd0d0;border-radius:12px;cursor:pointer;font-size:15px;transition:all 0.2s;" onmouseover="this.style.background=\'#ffe8e8\'" onmouseout="this.style.background=\'#fff5f5\'">' + name + '</div>';
  });
  html += '</div>';
  // 简单弹窗
  var overlay = document.createElement('div');
  overlay.id = 'classListOverlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.4);z-index:9999;display:flex;align-items:center;justify-content:center;';
  overlay.innerHTML = '<div style="background:#fff;border-radius:20px;padding:24px;max-width:360px;width:90%;max-height:80vh;overflow-y:auto;">' +
    '<div style="font-size:18px;font-weight:700;color:#c04058;margin-bottom:16px;text-align:center;">选择班级</div>' +
    html +
    '<div style="text-align:center;margin-top:16px;"><button onclick="document.getElementById(\'classListOverlay\').remove()" style="padding:8px 24px;border:none;border-radius:12px;background:#eee;color:#666;font-size:14px;cursor:pointer;">取消</button></div>' +
    '</div>';
  document.body.appendChild(overlay);
}

function pickClass(name, inputId) {
  document.getElementById(inputId).value = name;
  var overlay = document.getElementById('classListOverlay');
  if (overlay) overlay.remove();
}

// 显示错误信息
function showError(elementId, message) {
  const el = document.getElementById(elementId);
  el.textContent = message;
  el.classList.add('show');
}

// 隐藏错误信息
function hideError(elementId) {
  document.getElementById(elementId).classList.remove('show');
}

// 老师登录
async function handleTeacherLogin(e) {
  e.preventDefault();
  hideError('teacherError');
  
  const email = document.getElementById('teacherEmail').value.trim();
  const password = document.getElementById('teacherPassword').value;
  
  try {
    const { data, error } = await db.auth.signInWithPassword({
      email: email,
      password: password
    });
    
    if (error) {
      showError('teacherError', '登录失败：' + error.message);
      return;
    }
    
    // 检查是否是老师
    const { data: teacher, error: teacherError } = await db
      .from('teachers')
      .select('*')
      .eq('id', data.user.id)
      .single();
    
    if (teacherError || !teacher) {
      showError('teacherError', '该账号不是老师账号');
      await db.auth.signOut();
      return;
    }
    
    // 保存登录信息
    localStorage.setItem('userType', 'teacher');
    localStorage.setItem('userId', data.user.id);
    localStorage.setItem('userEmail', email);
    
    // 跳转到主页面
    window.location.href = 'index.html';
  } catch (err) {
    showError('teacherError', '登录失败：' + err.message);
  }
}

// 老师注册
async function handleTeacherRegister(e) {
  e.preventDefault();
  hideError('teacherRegError');
  
  const email = document.getElementById('regTeacherEmail').value.trim();
  const password = document.getElementById('regTeacherPassword').value;
  const password2 = document.getElementById('regTeacherPassword2').value;
  
  if (password !== password2) {
    showError('teacherRegError', '两次密码不一致');
    return;
  }
  
  try {
    // 注册账号
    const { data, error } = await db.auth.signUp({
      email: email,
      password: password
    });
    
    if (error) {
      showError('teacherRegError', '注册失败：' + error.message);
      return;
    }
    
    // 创建老师记录
    const { error: insertError } = await db
      .from('teachers')
      .insert([{ id: data.user.id, email: email }]);
    
    if (insertError) {
      showError('teacherRegError', '创建老师记录失败：' + insertError.message);
      return;
    }
    
    // 自动登录
    localStorage.setItem('userType', 'teacher');
    localStorage.setItem('userId', data.user.id);
    localStorage.setItem('userEmail', email);
    
    // 跳转到主页面
    window.location.href = 'index.html';
  } catch (err) {
    showError('teacherRegError', '注册失败：' + err.message);
  }
}

// 学生登录
async function handleStudentLogin(e) {
  e.preventDefault();
  hideError('studentError');
  
  const className = document.getElementById('studentClass').value.trim();
  const name = document.getElementById('studentName').value.trim();
  const password = document.getElementById('studentPassword').value;
  
  if (!className || !name || !password) {
    showError('studentError', '请填写所有字段');
    return;
  }
  
  try {
    // 优先使用缓存的班级列表，避免网络查询
    var matchedClass = null;
    if (window._availableClasses && window._availableClasses.length > 0) {
      matchedClass = window._availableClasses.find(function(c) { return c.name === className; });
    }
    
    // 如果缓存没有，再查询 Supabase
    if (!matchedClass) {
      const { data: classData, error: classError } = await db
        .from('classes')
        .select('id, name')
        .eq('name', className)
        .order('id', { ascending: true })
        .limit(1);
      
      if (classError) {
        console.error('[Login] class query error:', classError);
        showError('studentError', '网络连接失败，请检查网络后重试');
        return;
      }
      
      if (!classData || classData.length === 0) {
        // 班级不存在 - 提供具体帮助
        var availMsg = '';
        if (window._availableClasses && window._availableClasses.length > 0) {
          var names = [];
          var seen = {};
          window._availableClasses.forEach(function(c) {
            if (!seen[c.name]) { seen[c.name] = true; names.push('「' + c.name + '」'); }
          });
          availMsg = '\n\n当前可用班级：' + names.join('、') + '\n请检查班级名称是否完全一致。';
        } else {
          availMsg = '\n\n云端暂无班级。请联系老师：\n1. 打开宠物世界页面\n2. 确认班级已创建\n3. 确认右上角显示"☁️ 已同步"';
        }
        showError('studentError', '班级「' + className + '」不存在。' + availMsg);
        return;
      }
      
      matchedClass = classData[0];
    }
    
    // 查找学生
    const { data: student, error: studentError } = await db
      .from('students')
      .select('*')
      .eq('class_id', matchedClass.id)
      .eq('name', name)
      .single();
    
    if (studentError || !student) {
      showError('studentError', '学生「' + name + '」不在班级「' + matchedClass.name + '」中。请联系老师确认你的名字是否正确。');
      return;
    }
    
    // 验证密码
    if (!student.password || student.password !== password) {
      showError('studentError', '密码错误。如果你是第一次登录，请点击下方"设置密码"。');
      return;
    }
    
    // 保存登录信息
    localStorage.setItem('userType', 'student');
    localStorage.setItem('studentId', student.id);
    localStorage.setItem('studentName', name);
    localStorage.setItem('classId', matchedClass.id);
    localStorage.setItem('className', matchedClass.name);
    
    // 跳转到主页面
    window.location.href = 'index.html';
  } catch (err) {
    console.error('[Login] student login error:', err);
    showError('studentError', '登录失败：' + err.message);
  }
}

// 学生注册
async function handleStudentRegister(e) {
  e.preventDefault();
  hideError('studentRegError');
  
  const className = document.getElementById('regStudentClass').value.trim();
  const name = document.getElementById('regStudentName').value.trim();
  const password = document.getElementById('regStudentPassword').value;
  const password2 = document.getElementById('regStudentPassword2').value;
  
  if (!className || !name || !password || !password2) {
    showError('studentRegError', '请填写所有字段');
    return;
  }
  
  if (password !== password2) {
    showError('studentRegError', '两次密码不一致');
    return;
  }
  
  try {
    // 优先使用缓存的班级列表，避免网络查询
    var matchedClass = null;
    if (window._availableClasses && window._availableClasses.length > 0) {
      matchedClass = window._availableClasses.find(function(c) { return c.name === className; });
    }
    
    // 如果缓存没有，再查询 Supabase
    if (!matchedClass) {
      const { data: classData, error: classError } = await db
        .from('classes')
        .select('id, name')
        .eq('name', className)
        .order('id', { ascending: true })
        .limit(1);
      
      if (classError) {
        console.error('[Register] class query error:', classError);
        showError('studentRegError', '网络连接失败，请检查网络后重试');
        return;
      }
      
      if (!classData || classData.length === 0) {
        var availMsg = '';
        if (window._availableClasses && window._availableClasses.length > 0) {
          var names = [];
          var seen = {};
          window._availableClasses.forEach(function(c) {
            if (!seen[c.name]) { seen[c.name] = true; names.push('「' + c.name + '」'); }
          });
          availMsg = '\n\n当前可用班级：' + names.join('、');
        } else {
          availMsg = '\n\n云端暂无班级。请联系老师创建班级并确保已同步。';
        }
        showError('studentRegError', '班级「' + className + '」不存在。' + availMsg);
        return;
      }
      
      matchedClass = classData[0];
    }
    
    // 检查学生是否已在名单中
    const { data: existingStudent } = await db
      .from('students')
      .select('*')
      .eq('class_id', matchedClass.id)
      .eq('name', name)
      .single();
    
    if (!existingStudent) {
      showError('studentRegError', '你（' + name + '）不在班级「' + matchedClass.name + '」的学生名单中。请联系老师先添加你的姓名。');
      return;
    }
    
    // 检查是否已设置密码
    if (existingStudent.password) {
      showError('studentRegError', '该学生已设置过密码，请直接登录');
      return;
    }
    
    // 更新密码
    const { error: updateError } = await db
      .from('students')
      .update({ password: password })
      .eq('id', existingStudent.id);
    
    if (updateError) {
      showError('studentRegError', '设置密码失败：' + updateError.message);
      return;
    }
    
    // 自动登录
    localStorage.setItem('userType', 'student');
    localStorage.setItem('studentId', existingStudent.id);
    localStorage.setItem('studentName', name);
    localStorage.setItem('classId', matchedClass.id);
    localStorage.setItem('className', matchedClass.name);
    
    // 跳转到主页面
    window.location.href = 'index.html';
  } catch (err) {
    console.error('[Register] student register error:', err);
    showError('studentRegError', '注册失败：' + err.message);
  }
}

// 页面加载时自动获取可用班级列表
(function() {
  // 自动填充上次使用的教师邮箱
  var savedEmail = localStorage.getItem('userEmail');
  var savedType = localStorage.getItem('userType');
  if (savedEmail && savedType === 'teacher') {
    var emailInput = document.getElementById('teacherEmail');
    if (emailInput) emailInput.value = savedEmail;
  }

  // 等 Supabase 连接好后再加载
  function tryLoad() {
    if (db) {
      loadAvailableClasses();
    } else {
      setTimeout(tryLoad, 1000);
    }
  }
  // 延迟执行，等页面渲染完
  setTimeout(tryLoad, 500);
})();

// ===== 扫码登录功能 =====
var _qrToken = null;
var _qrPollTimer = null;
var _qrPollCount = 0;
var _qrRealtimeChannel = null;
var _qrVerified = false;

function showQRLogin() {
  var modal = document.getElementById('qrModal');
  if (modal) {
    modal.style.display = 'flex';
    generateQRCode();
  }
}

function closeQRModal() {
  var modal = document.getElementById('qrModal');
  if (modal) modal.style.display = 'none';
  stopQRDetection();
  _qrToken = null;
  _qrVerified = false;
}

function refreshQR() {
  stopQRDetection();
  generateQRCode();
}

function stopQRDetection() {
  if (_qrPollTimer) {
    clearInterval(_qrPollTimer);
    _qrPollTimer = null;
  }
  if (_qrRealtimeChannel && db) {
    try { db.removeChannel(_qrRealtimeChannel); } catch(e) {}
    _qrRealtimeChannel = null;
  }
  _qrPollCount = 0;
}

async function generateQRCode() {
  var qrWrap = document.getElementById('qrCodeWrap');
  var qrStatus = document.getElementById('qrStatus');
  if (!qrWrap || !qrStatus) return;

  qrWrap.innerHTML = '';
  qrStatus.textContent = '正在检查扫码功能...';
  qrStatus.style.color = '#d4a017';
  _qrVerified = false;

  if (!db) {
    qrStatus.textContent = '❌ 数据库未连接，请刷新页面';
    qrStatus.style.color = '#e74c3c';
    return;
  }

  // 先检查表是否存在
  var tableCheck = await db
    .from('qr_login_tokens')
    .select('id')
    .limit(1);
  
  if (tableCheck.error) {
    console.error('[扫码登录] 表检查失败:', tableCheck.error.message);
    if (tableCheck.error.message && tableCheck.error.message.indexOf('does not exist') !== -1) {
      qrStatus.innerHTML = '❌ 扫码功能未启用<br><span style="font-size:11px;color:#888;line-height:1.6;">需要在Supabase中创建qr_login_tokens表<br>请联系管理员执行建表SQL</span>';
      qrStatus.style.color = '#e74c3c';
      return;
    }
    qrStatus.textContent = '❌ 数据库错误: ' + tableCheck.error.message;
    qrStatus.style.color = '#e74c3c';
    return;
  }

  try {
    // 生成随机token
    _qrToken = 'qr_' + Date.now() + '_' + Math.random().toString(36).substr(2, 16);
    var expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    // 存储token到Supabase
    var insertResult = await db
      .from('qr_login_tokens')
      .insert([{
        token: _qrToken,
        email: '',
        status: 'pending',
        expires_at: expiresAt
      }]);

    if (insertResult.error) {
      console.error('[扫码登录] 插入token失败:', insertResult.error.message);
      qrStatus.innerHTML = '❌ 生成二维码失败<br><span style="font-size:11px;color:#888;">' + insertResult.error.message + '</span>';
      qrStatus.style.color = '#e74c3c';
      return;
    }

    // 验证插入成功（用 .limit(1) 代替 .single()，避免多行时报错）
    var verifyInsert = await db
      .from('qr_login_tokens')
      .select('token, status')
      .eq('token', _qrToken)
      .limit(1);
    
    if (verifyInsert.error || !verifyInsert.data || verifyInsert.data.length === 0) {
      console.error('[扫码登录] 插入验证失败:', verifyInsert.error ? verifyInsert.error.message : 'no data');
      qrStatus.innerHTML = '❌ 二维码写入失败，请刷新重试';
      qrStatus.style.color = '#e74c3c';
      return;
    }

    console.log('[扫码登录] Token已创建并验证:', _qrToken.substring(0, 20) + '...');

    // 生成二维码URL
    var baseUrl = window.location.href.substring(0, window.location.href.lastIndexOf('/') + 1);
    var scanUrl = baseUrl + 'qr-scan.html?token=' + encodeURIComponent(_qrToken);

    // 渲染二维码
    if (typeof QRCode !== 'undefined') {
      new QRCode(qrWrap, {
        text: scanUrl,
        width: 250,
        height: 250,
        colorDark: '#000000',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.H
      });
    } else {
      qrWrap.innerHTML = '<div style="font-size:12px;color:#666;word-break:break-all;padding:10px;">' + scanUrl + '</div>';
    }

    // 启动检测（Realtime + 轮询双保险）
    startQRDetection();

  } catch(e) {
    console.error('[扫码登录] 生成二维码失败:', e);
    qrStatus.textContent = '❌ 生成失败: ' + e.message;
    qrStatus.style.color = '#e74c3c';
  }
}

// === 双通道检测：Realtime实时推送 + 轮询备份 ===
function startQRDetection() {
  if (!_qrToken) return;
  stopQRDetection();
  _qrPollCount = 0;
  
  updateQRWaitingStatus();
  
  // 通道1：Supabase Realtime 实时推送（监听 UPDATE + INSERT 两种事件）
  // INSERT 事件用于处理手机端 DELETE+INSERT 降级策略
  try {
    _qrRealtimeChannel = db
      .channel('qr_' + _qrToken)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'qr_login_tokens',
        filter: 'token=eq.' + _qrToken
      }, function(payload) {
        console.log('[扫码登录] Realtime收到UPDATE:', payload.new);
        if (payload.new && payload.new.status === 'verified' && payload.new.email) {
          onQRVerified(payload.new.email);
        }
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'qr_login_tokens',
        filter: 'token=eq.' + _qrToken
      }, function(payload) {
        console.log('[扫码登录] Realtime收到INSERT:', payload.new);
        if (payload.new && payload.new.status === 'verified' && payload.new.email) {
          onQRVerified(payload.new.email);
        }
      })
      .subscribe(function(status) {
        console.log('[扫码登录] Realtime订阅状态:', status);
      });
  } catch(e) {
    console.warn('[扫码登录] Realtime初始化失败:', e.message);
  }
  
  // 通道2：轮询备份（每1.5秒一次）
  _qrPollTimer = setInterval(pollQRStatus, 1500);
  // 立即执行一次
  pollQRStatus();
  
  console.log('[扫码登录] 开始检测（Realtime UPDATE+INSERT + 轮询），token:', _qrToken.substring(0, 20) + '...');
}

function updateQRWaitingStatus() {
  var qrStatus = document.getElementById('qrStatus');
  if (qrStatus) {
    qrStatus.innerHTML = '<span style="display:inline-flex;align-items:center;gap:6px;">' +
      '<span style="width:8px;height:8px;background:#52c41a;border-radius:50%;animation:qrPulse 1.5s infinite;"></span>' +
      '等待手机扫码确认...' +
      '</span>' +
      '<div id="qrPollInfo" style="font-size:11px;color:#aaa;margin-top:4px;">检测中...</div>' +
      '<style>@keyframes qrPulse{0%,100%{opacity:0.3}50%{opacity:1}}</style>';
    qrStatus.style.color = '#d4a017';
  }
}

function updatePollInfo(statusText) {
  var info = document.getElementById('qrPollInfo');
  if (info) {
    info.textContent = '轮询#' + _qrPollCount + ' | ' + statusText;
  }
}

// 轮询检测
async function pollQRStatus() {
  if (_qrVerified || !_qrToken || !db) return;
  
  _qrPollCount++;
  
  try {
    // 使用 .limit(1) 代替 .single()，更健壮（single在无结果时报错）
    var result = await db
      .from('qr_login_tokens')
      .select('status, email, expires_at')
      .eq('token', _qrToken)
      .limit(1);

    if (result.error) {
      console.warn('[扫码登录] 轮询#' + _qrPollCount + ' 查询失败:', result.error.message);
      updatePollInfo('查询失败: ' + result.error.message.substring(0, 30));
      return;
    }

    if (!result.data || result.data.length === 0) {
      // token行不存在（可能被DELETE了但INSERT还没到）
      updatePollInfo('等待数据写入...');
      return;
    }

    var data = result.data[0];
    
    // 每5次轮询打印一次状态（避免日志太多）
    if (_qrPollCount % 5 === 1) {
      console.log('[扫码登录] 轮询#' + _qrPollCount + ' status=' + data.status + ' email=' + (data.email || '无'));
    }
    
    updatePollInfo('轮询#' + _qrPollCount + ' | status=' + data.status + (data.email ? ' | ' + data.email.substring(0, 10) + '...' : ''));

    // 检查过期
    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      stopQRDetection();
      var qrStatus = document.getElementById('qrStatus');
      if (qrStatus) {
        qrStatus.textContent = '❌ 二维码已过期，请点击刷新';
        qrStatus.style.color = '#e74c3c';
      }
      return;
    }

    // 检查是否已验证
    if (data.status === 'verified' && data.email) {
      console.log('[扫码登录] 轮询检测到verified! email=' + data.email);
      onQRVerified(data.email);
    }

  } catch(e) {
    console.warn('[扫码登录] 轮询#' + _qrPollCount + ' 异常:', e.message);
    updatePollInfo('异常: ' + e.message.substring(0, 20));
  }
}

// 统一处理验证成功
async function onQRVerified(email) {
  if (_qrVerified) return; // 防止重复触发
  _qrVerified = true;
  
  stopQRDetection();
  console.log('[扫码登录] 验证成功，开始自动登录:', email);
  
  var qrStatus = document.getElementById('qrStatus');
  if (qrStatus) {
    qrStatus.innerHTML = '✅ 验证成功！正在登录 ' + escapeHtml(email) + ' ...';
    qrStatus.style.color = '#389e0d';
  }
  
  await doAutoLogin(email);
}

async function doAutoLogin(email) {
  try {
    console.log('[扫码登录] 开始查询教师账号:', email);
    
    if (!db) {
      throw new Error('数据库未连接');
    }
    
    var teacherResult = await db
      .from('teachers')
      .select('*')
      .eq('email', email)
      .limit(1);

    if (teacherResult.error) {
      console.error('[扫码登录] 查询教师失败:', teacherResult.error.message);
      if (teacherResult.error.message && teacherResult.error.message.indexOf('does not exist') !== -1) {
        throw new Error('teachers表不存在');
      }
      throw teacherResult.error;
    }

    if (!teacherResult.data || teacherResult.data.length === 0) {
      console.error('[扫码登录] 未找到教师账号:', email);
      throw new Error('教师账号不存在: ' + email);
    }

    var teacherData = teacherResult.data[0];
    console.log('[扫码登录] 找到教师账号:', teacherData.id, teacherData.name || email);

    // 保存登录信息
    localStorage.setItem('userType', 'teacher');
    localStorage.setItem('userId', teacherData.id);
    localStorage.setItem('userEmail', email);
    localStorage.setItem('userName', teacherData.name || email);
    // ★ 标记为扫码登录，auth-check.js 会识别此标记跳过 session 检查
    localStorage.setItem('qrLoginTime', Date.now().toString());

    var qrStatus = document.getElementById('qrStatus');
    if (qrStatus) {
      qrStatus.innerHTML = '✅ 登录成功！正在跳转到 ' + escapeHtml(teacherData.name || email) + ' ...';
      qrStatus.style.color = '#389e0d';
    }

    // 跳转
    setTimeout(function() {
      console.log('[扫码登录] 跳转到主页');
      window.location.href = 'index.html';
    }, 800);

  } catch(e) {
    console.error('[扫码登录] 自动登录失败:', e);
    _qrVerified = false; // 允许重试
    var qrStatus = document.getElementById('qrStatus');
    if (qrStatus) {
      qrStatus.innerHTML = '❌ 登录失败: ' + escapeHtml(e.message) + '<br><span style="font-size:12px;color:#888;">请刷新页面重试</span>';
      qrStatus.style.color = '#e74c3c';
    }
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// 手动检测按钮（用于调试）
async function manualCheckQR() {
  var qrStatus = document.getElementById('qrStatus');
  if (!qrStatus) return;
  
  if (!_qrToken) {
    qrStatus.innerHTML = '❌ 没有活动的二维码，请刷新';
    qrStatus.style.color = '#e74c3c';
    return;
  }
  
  if (!db) {
    qrStatus.innerHTML = '❌ 数据库未连接';
    qrStatus.style.color = '#e74c3c';
    return;
  }
  
  qrStatus.innerHTML = '🔍 正在检测...';
  qrStatus.style.color = '#0066cc';
  
  try {
    var result = await db
      .from('qr_login_tokens')
      .select('*')
      .eq('token', _qrToken)
      .limit(1);
    
    if (result.error) {
      qrStatus.innerHTML = '❌ 查询失败: ' + escapeHtml(result.error.message) + '<br><span style="font-size:11px;color:#888;">Token: ' + escapeHtml(_qrToken.substring(0, 30)) + '</span>';
      qrStatus.style.color = '#e74c3c';
      return;
    }
    
    if (!result.data || result.data.length === 0) {
      qrStatus.innerHTML = '❌ 未找到token数据<br><span style="font-size:11px;color:#888;">Token: ' + escapeHtml(_qrToken.substring(0, 30)) + '<br>可能已被DELETE或从未成功INSERT</span>';
      qrStatus.style.color = '#e74c3c';
      return;
    }
    
    var data = result.data[0];
    var info = '<div style="text-align:left;font-size:13px;line-height:1.8;">';
    info += '<b>Token状态:</b> <span style="color:' + (data.status === 'verified' ? '#389e0d' : '#d4a017') + '">' + data.status + '</span><br>';
    info += '<b>Email:</b> ' + (data.email || '无') + '<br>';
    info += '<b>DB Row ID:</b> ' + (data.id || '无') + '<br>';
    info += '<b>过期时间:</b> ' + new Date(data.expires_at).toLocaleString() + '<br>';
    info += '<b>验证时间:</b> ' + (data.verified_at ? new Date(data.verified_at).toLocaleString() : '未验证') + '<br>';
    info += '<b>当前时间:</b> ' + new Date().toLocaleString() + '<br>';
    info += '<b>轮询次数:</b> ' + _qrPollCount;
    info += '</div>';
    
    if (data.status === 'verified' && data.email) {
      info += '<strong style="color:#389e0d;">✅ 已验证！正在登录...</strong>';
      qrStatus.innerHTML = info;
      qrStatus.style.color = '#389e0d';
      await onQRVerified(data.email);
    } else {
      info += '<br><span style="color:#888;">等待手机扫码确认...</span>';
      qrStatus.innerHTML = info;
      qrStatus.style.color = '#d4a017';
    }
    
  } catch(e) {
    qrStatus.innerHTML = '❌ 检测异常: ' + escapeHtml(e.message);
    qrStatus.style.color = '#e74c3c';
  }
}
window.manualCheckQR = manualCheckQR;
