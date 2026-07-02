// 登录检查脚本
// 必须在 app.js 之前加载

const SUPABASE_URL = 'https://xbygooadskfqllnhwmet.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhieWdvb2Fkc2tmcWxsbmh3bWV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5NjU0NDgsImV4cCI6MjA5ODU0MTQ0OH0.ryfpesmsFqBnaJurlMhjEJOWxZV4oFg3NBu7kQD8EKA';

// 全局变量：用户类型、用户信息
var currentUser = null;
var db;

// 初始化 Supabase 客户端
(function initSupabase() {
  try {
    if (window.supabase && window.supabase.createClient) {
      db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      console.log('[Auth] Supabase connected');
    } else {
      console.error('[Auth] Supabase SDK not loaded, retrying in 1s...');
      setTimeout(initSupabase, 1000);
    }
  } catch (e) {
    console.error('[Auth] Supabase init error:', e);
  }
})();

// 检查登录状态
async function checkLogin() {
  // 先检查 localStorage 中是否有登录信息
  const userType = localStorage.getItem('userType');
  const userId = localStorage.getItem('userId') || localStorage.getItem('studentId');
  
  if (!userType || !userId) {
    // 没有登录信息，跳转到登录页
    window.location.href = 'login.html';
    return;
  }
  
  // 如果有 Supabase 连接，验证 session
  if (db) {
    try {
      const { data: { session }, error } = await db.auth.getSession();
      if (error || !session) {
        // Session 无效，清除本地存储并跳转
        localStorage.removeItem('userType');
        localStorage.removeItem('userId');
        localStorage.removeItem('userEmail');
        localStorage.removeItem('studentId');
        localStorage.removeItem('studentName');
        localStorage.removeItem('classId');
        localStorage.removeItem('className');
        window.location.href = 'login.html';
        return;
      }
      
      // 设置全局用户信息
      currentUser = {
        type: userType,
        id: userId,
        email: localStorage.getItem('userEmail')
      };
      
      // 如果是学生，额外设置学生信息
      if (userType === 'student') {
        currentUser.studentId = localStorage.getItem('studentId');
        currentUser.studentName = localStorage.getItem('studentName');
        currentUser.classId = localStorage.getItem('classId');
        currentUser.className = localStorage.getItem('className');
      }
      
      console.log('[Auth] User logged in:', currentUser);
    } catch (e) {
      console.error('[Auth] Session check error:', e);
      // 出错时允许继续使用（降级模式）
      currentUser = {
        type: userType,
        id: userId,
        email: localStorage.getItem('userEmail')
      };
    }
  } else {
    // Supabase 未连接，使用 localStorage 中的信息（降级模式）
    currentUser = {
      type: userType,
      id: userId,
      email: localStorage.getItem('userEmail')
    };
    if (userType === 'student') {
      currentUser.studentId = localStorage.getItem('studentId');
      currentUser.studentName = localStorage.getItem('studentName');
      currentUser.classId = localStorage.getItem('classId');
      currentUser.className = localStorage.getItem('className');
    }
  }
}

// 检查是否是老师
function isTeacher() {
  return currentUser && currentUser.type === 'teacher';
}

// 检查是否是学生
function isStudent() {
  return currentUser && currentUser.type === 'student';
}

// 登出
async function logout() {
  if (db) {
    await db.auth.signOut();
  }
  localStorage.removeItem('userType');
  localStorage.removeItem('userId');
  localStorage.removeItem('userEmail');
  localStorage.removeItem('studentId');
  localStorage.removeItem('studentName');
  localStorage.removeItem('classId');
  localStorage.removeItem('className');
  window.location.href = 'login.html';
}

// 页面加载时检查登录
checkLogin();
