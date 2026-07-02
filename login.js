// Supabase 配置
const SUPABASE_URL = 'https://xbygoadskfqlnlnhwmet.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhieWdvb2Fkc2tmcWxsbmh3bWV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5NjU0NDgsImV4cCI6MjA5ODU0MTQ0OH0.ryfpesmsFqBnaJurlMhjEJOWxZV4oFg3NBu7kQD8EKA';

let supabase;
try {
  if (window.supabase && window.supabase.createClient) {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log('Supabase connected');
  } else {
    console.error('Supabase SDK not loaded');
    alert('Supabase SDK 加载失败，请刷新页面重试');
  }
} catch (e) {
  console.error('Supabase init error:', e);
  alert('Supabase 初始化失败：' + e.message);
}

// 切换标签页
function switchTab(type) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  event.target.classList.add('active');
  
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
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password
    });
    
    if (error) {
      showError('teacherError', '登录失败：' + error.message);
      return;
    }
    
    // 检查是否是老师
    const { data: teacher, error: teacherError } = await supabase
      .from('teachers')
      .select('*')
      .eq('id', data.user.id)
      .single();
    
    if (teacherError || !teacher) {
      showError('teacherError', '该账号不是老师账号');
      await supabase.auth.signOut();
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
    const { data, error } = await supabase.auth.signUp({
      email: email,
      password: password
    });
    
    if (error) {
      showError('teacherRegError', '注册失败：' + error.message);
      return;
    }
    
    // 创建老师记录
    const { error: insertError } = await supabase
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
  
  try {
    // 查找班级
    const { data: classData, error: classError } = await supabase
      .from('classes')
      .select('id')
      .eq('name', className)
      .single();
    
    if (classError || !classData) {
      showError('studentError', '班级不存在，请检查班级名称');
      return;
    }
    
    // 查找学生
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('*')
      .eq('class_id', classData.id)
      .eq('name', name)
      .single();
    
    if (studentError || !student) {
      showError('studentError', '学生不存在，请联系老师添加');
      return;
    }
    
    // 验证密码
    if (student.password !== password) {
      showError('studentError', '密码错误');
      return;
    }
    
    // 保存登录信息
    localStorage.setItem('userType', 'student');
    localStorage.setItem('studentId', student.id);
    localStorage.setItem('studentName', name);
    localStorage.setItem('classId', classData.id);
    localStorage.setItem('className', className);
    
    // 跳转到主页面
    window.location.href = 'index.html';
  } catch (err) {
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
  
  if (password !== password2) {
    showError('studentRegError', '两次密码不一致');
    return;
  }
  
  try {
    // 查找班级
    const { data: classData, error: classError } = await supabase
      .from('classes')
      .select('id')
      .eq('name', className)
      .single();
    
    if (classError || !classData) {
      showError('studentRegError', '班级不存在，请检查班级名称');
      return;
    }
    
    // 检查学生是否已在名单中
    const { data: existingStudent } = await supabase
      .from('students')
      .select('*')
      .eq('class_id', classData.id)
      .eq('name', name)
      .single();
    
    if (!existingStudent) {
      showError('studentRegError', '你不在该班级的学生名单中，请联系老师添加');
      return;
    }
    
    // 检查是否已设置密码
    if (existingStudent.password) {
      showError('studentRegError', '该学生已设置过密码，请直接登录');
      return;
    }
    
    // 更新密码
    const { error: updateError } = await supabase
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
    localStorage.setItem('classId', classData.id);
    localStorage.setItem('className', className);
    
    // 跳转到主页面
    window.location.href = 'index.html';
  } catch (err) {
    showError('studentRegError', '注册失败：' + err.message);
  }
}

// 检查是否已登录
async function checkAuth() {
  const userType = localStorage.getItem('userType');
  if (userType) {
    // 已登录，跳转到主页面
    window.location.href = 'index.html';
  }
}

// 页面加载时检查登录状态
checkAuth();
