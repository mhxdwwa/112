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
  stopQRPolling();
  _qrToken = null;
}

function refreshQR() {
  stopQRPolling();
  generateQRCode();
}

function stopQRPolling() {
  if (_qrPollTimer) {
    clearInterval(_qrPollTimer);
    _qrPollTimer = null;
  }
}

async function generateQRCode() {
  var qrWrap = document.getElementById('qrCodeWrap');
  var qrStatus = document.getElementById('qrStatus');
  if (!qrWrap || !qrStatus) return;

  // 获取教师邮箱
  var emailInput = document.getElementById('teacherEmail');
  var email = emailInput ? emailInput.value.trim() : '';
  if (!email) {
    qrWrap.innerHTML = '';
    qrStatus.innerHTML = '❌ 请先输入邮箱地址';
    qrStatus.style.color = '#e74c3c';
    return;
  }

  qrWrap.innerHTML = '';
  qrStatus.textContent = '正在生成二维码...';
  qrStatus.style.color = '#d4a017';

  if (!db) {
    qrStatus.textContent = '❌ 网络连接失败';
    qrStatus.style.color = '#e74c3c';
    return;
  }

  try {
    // 生成随机token
    _qrToken = 'qr_' + Date.now() + '_' + Math.random().toString(36).substr(2, 16);
    var expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5分钟后过期

    // 存储token到Supabase
    var insertResult = await db
      .from('qr_login_tokens')
      .insert([{
        token: _qrToken,
        email: email,
        status: 'pending',
        expires_at: expiresAt
      }]);

    if (insertResult.error) {
      // 表可能不存在，给出创建提示
      console.error('二维码表不存在:', insertResult.error.message);
      qrStatus.innerHTML = '❌ 扫码功能未启用<br><span style="font-size:11px;color:#888;line-height:1.6;">需要在Supabase中创建qr_login_tokens表<br>请联系管理员或查看控制台获取SQL</span>';
      qrStatus.style.color = '#e74c3c';
      console.log('%c[扫码登录] 需要在Supabase中执行以下SQL创建数据表:', 'color:#c04058;font-weight:bold;');
      console.log('%cCREATE TABLE IF NOT EXISTS qr_login_tokens (\n  id BIGSERIAL PRIMARY KEY,\n  token TEXT NOT NULL UNIQUE,\n  email TEXT,\n  status TEXT NOT NULL DEFAULT \'pending\',\n  expires_at TIMESTAMPTZ NOT NULL,\n  verified_at TIMESTAMPTZ,\n  created_at TIMESTAMPTZ DEFAULT NOW()\n);\n\n-- 启用RLS\nALTER TABLE qr_login_tokens ENABLE ROW LEVEL SECURITY;\n\n-- 允许匿名插入（用于生成token）\nCREATE POLICY "Allow anonymous insert" ON qr_login_tokens FOR INSERT TO anon WITH CHECK (true);\n\n-- 允许匿名读取（用于轮询状态）\nCREATE POLICY "Allow anonymous select" ON qr_login_tokens FOR SELECT TO anon USING (true);\n\n-- 允许匿名更新（用于验证确认）\nCREATE POLICY "Allow anonymous update" ON qr_login_tokens FOR UPDATE TO anon USING (true);', 'color:#333;font-family:monospace;font-size:11px;');
      return;
    }

    // 生成二维码URL
    var baseUrl = window.location.href.substring(0, window.location.href.lastIndexOf('/') + 1);
    var verifyUrl = baseUrl + 'qr-verify.html?token=' + encodeURIComponent(_qrToken);

    // 渲染二维码
    if (typeof QRCode !== 'undefined') {
      new QRCode(qrWrap, {
        text: verifyUrl,
        width: 200,
        height: 200,
        colorDark: '#333333',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.M
      });
    } else {
      // Fallback: 显示URL
      qrWrap.innerHTML = '<div style="font-size:12px;color:#666;word-break:break-all;padding:10px;">' + verifyUrl + '</div>';
    }

    qrStatus.textContent = '等待扫码...';
    qrStatus.style.color = '#d4a017';

    // 开始轮询检查token状态
    startQRPolling();

  } catch(e) {
    console.error('生成二维码失败:', e);
    qrStatus.textContent = '❌ 生成失败: ' + e.message;
    qrStatus.style.color = '#e74c3c';
  }
}

function startQRPolling() {
  if (!_qrToken) return;
  
  stopQRPolling();
  _qrPollTimer = setInterval(checkQRStatus, 2000);
}

async function checkQRStatus() {
  if (!_qrToken || !db) return;

  try {
    var result = await db
      .from('qr_login_tokens')
      .select('*')
      .eq('token', _qrToken)
      .single();

    if (result.error || !result.data) {
      stopQRPolling();
      var qrStatus = document.getElementById('qrStatus');
      if (qrStatus) {
        qrStatus.textContent = '❌ 二维码已失效';
        qrStatus.style.color = '#e74c3c';
      }
      return;
    }

    var tokenData = result.data;

    // 检查是否过期
    if (new Date(tokenData.expires_at) < new Date()) {
      stopQRPolling();
      var qrStatus = document.getElementById('qrStatus');
      if (qrStatus) {
        qrStatus.textContent = '❌ 二维码已过期，请点击刷新';
        qrStatus.style.color = '#e74c3c';
      }
      return;
    }

    // 检查是否已验证
    if (tokenData.status === 'verified') {
      stopQRPolling();
      var qrStatus = document.getElementById('qrStatus');
      if (qrStatus) {
        qrStatus.textContent = '✅ 验证成功，正在登录...';
        qrStatus.style.color = '#389e0d';
      }

      // 使用token中的email自动登录
      if (tokenData.email) {
        await autoLoginWithToken(tokenData.email);
      } else {
        // token中没有email，需要查询teachers表
        var qrStatus = document.getElementById('qrStatus');
        if (qrStatus) {
          qrStatus.textContent = '❌ 登录信息缺失';
          qrStatus.style.color = '#e74c3c';
        }
      }
    }

  } catch(e) {
    console.warn('检查二维码状态失败:', e);
  }
}

async function autoLoginWithToken(email) {
  try {
    // 查找教师信息
    var teacherResult = await db
      .from('teachers')
      .select('*')
      .eq('email', email)
      .single();

    if (teacherResult.error || !teacherResult.data) {
      var qrStatus = document.getElementById('qrStatus');
      if (qrStatus) {
        qrStatus.textContent = '❌ 教师账号不存在';
        qrStatus.style.color = '#e74c3c';
      }
      return;
    }

    // 保存登录信息
    localStorage.setItem('userType', 'teacher');
    localStorage.setItem('userId', teacherResult.data.id);
    localStorage.setItem('userEmail', email);

    var qrStatus = document.getElementById('qrStatus');
    if (qrStatus) {
      qrStatus.textContent = '✅ 登录成功！正在跳转...';
      qrStatus.style.color = '#389e0d';
    }

    // 延迟跳转
    setTimeout(function() {
      window.location.href = 'index.html';
    }, 1000);

  } catch(e) {
    console.error('自动登录失败:', e);
    var qrStatus = document.getElementById('qrStatus');
    if (qrStatus) {
      qrStatus.textContent = '❌ 登录失败: ' + e.message;
      qrStatus.style.color = '#e74c3c';
    }
  }
}
