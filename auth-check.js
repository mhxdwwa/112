// 登录检查脚本
// 必须在 app.js 之前加载

const SUPABASE_URL = 'https://xbygooadskfqllnhwmet.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhieWdvb2Fkc2tmcWxsbmh3bWV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5NjU0NDgsImV4cCI6MjA5ODU0MTQ0OH0.ryfpesmsFqBnaJurlMhjEJOWxZV4oFg3NBu7kQD8EKA';

// 全局变量：用户类型、用户信息
var currentUser = null;
var db;

// v89: QR 登录令牌签名/验证 — 防止通过篡改 localStorage 绕过认证
// 使用 HMAC-SHA256 签名，密钥由 Supabase 配置派生
const _QR_SECRET = 'qr_auth_' + SUPABASE_ANON_KEY.slice(20, 40);
async function _signQRToken(userId, email, timestamp) {
  var payload = userId + '|' + email + '|' + timestamp;
  var encoder = new TextEncoder();
  var keyData = encoder.encode(_QR_SECRET);
  var key = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  var signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  var sigHex = Array.from(new Uint8Array(signature)).map(function(b) { return b.toString(16).padStart(2, '0'); }).join('');
  return payload + '|' + sigHex;
}
async function _verifyQRToken(token) {
  if (!token || typeof token !== 'string') return null;
  var parts = token.split('|');
  if (parts.length !== 4) return null;
  var userId = parts[0], email = parts[1], timestamp = parseInt(parts[2]), sigHex = parts[3];
  // 检查时间是否在5分钟内
  if (isNaN(timestamp) || (Date.now() - timestamp > 5 * 60 * 1000)) return null;
  // 验证签名
  var expected = await _signQRToken(userId, email, timestamp);
  var expectedParts = expected.split('|');
  if (expectedParts[3] !== sigHex) return null;
  return { userId: userId, email: email, timestamp: timestamp };
}

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
    return; // Stop execution — no currentUser set, _onAuthReady won't fire
  }
  
  // 如果有 Supabase 连接，验证 session（仅老师需要，学生不走 Supabase Auth）
  if (db && userType === 'teacher') {
    try {
      // ★ v89: 扫码登录认证 — 使用签名令牌防止 localStorage 篡改
      // 扫码登录无法获取密码来创建 Supabase Auth session，因此使用签名令牌
      var qrToken = localStorage.getItem('qrLoginToken');
      var qrVerified = qrToken ? await _verifyQRToken(qrToken) : null;
      
      if (qrVerified && qrVerified.userId === userId) {
        console.log('[Auth] 扫码登录认证通过 (token时间=' + new Date(qrVerified.timestamp).toLocaleTimeString() + ')');
        currentUser = {
          type: userType,
          id: userId,
          email: qrVerified.email
        };
        return;
      }
      
      // 向后兼容：旧的 qrLoginTime 格式（将在未来版本移除）
      var qrLoginTime = parseInt(localStorage.getItem('qrLoginTime') || '0');
      if (qrLoginTime > 0) {
        console.warn('[Auth] 检测到旧版 qrLoginTime，请重新扫码登录');
        localStorage.removeItem('qrLoginTime');
      }
      
      const { data: { session }, error } = await db.auth.getSession();
      if (error || !session) {
        // Session 无效，清除本地存储并跳转
        localStorage.removeItem('userType');
        localStorage.removeItem('userId');
        localStorage.removeItem('userEmail');
        localStorage.removeItem('qrLoginTime');
        window.location.href = 'login.html';
        return;
      }
      
      // 设置全局用户信息
      currentUser = {
        type: userType,
        id: userId,
        email: localStorage.getItem('userEmail')
      };
      
      console.log('[Auth] Teacher logged in:', currentUser);
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
    // Supabase 未连接 或 学生登录（学生用班级+姓名+密码，不走 Supabase Auth）
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
      
      // v73: Student login hardening — verify student exists in DB
      // This prevents localStorage tampering (e.g., manually setting userType=student with fake IDs)
      if (db && currentUser.studentId && currentUser.classId) {
        try {
          var verifyResult = await db.from('students')
            .select('id, name, class_id')
            .eq('id', parseInt(currentUser.studentId))
            .eq('class_id', parseInt(currentUser.classId))
            .single();
          
          if (verifyResult.error || !verifyResult.data) {
            console.warn('[Auth] Student verification failed — invalid studentId/classId in localStorage');
            // Clear invalid data and redirect to login
            localStorage.removeItem('userType');
            localStorage.removeItem('userId');
            localStorage.removeItem('studentId');
            localStorage.removeItem('studentName');
            localStorage.removeItem('classId');
            localStorage.removeItem('className');
            window.location.href = 'login.html';
            return;
          }
          
          // Verify the student name matches
          if (verifyResult.data.name !== currentUser.studentName) {
            console.warn('[Auth] Student name mismatch in localStorage');
            localStorage.removeItem('userType');
            localStorage.removeItem('userId');
            localStorage.removeItem('studentId');
            localStorage.removeItem('studentName');
            localStorage.removeItem('classId');
            localStorage.removeItem('className');
            window.location.href = 'login.html';
            return;
          }
          
          console.log('[Auth] Student verified:', currentUser.studentName);
        } catch (e) {
          console.error('[Auth] Student verification error:', e);
          // On network error, allow login but log warning
          // This prevents locking out students when Supabase is temporarily unavailable
        }
      }
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
  localStorage.removeItem('qrLoginTime');
  localStorage.removeItem('qrLoginToken');
  // v47: Clear DAL cache on logout to prevent cross-account data leakage
  localStorage.removeItem('_dal_cache_v1');
  localStorage.removeItem('_dal_cache_v2');
  window.location.href = 'login.html';
}

// 页面加载时检查登录
checkLogin().then(function() {
  // v45: Notify dal.js that auth is ready (event-driven init, no polling)
  // Only fire if currentUser was actually set (not redirected to login)
  if (currentUser && typeof window._onAuthReady === 'function') {
    window._onAuthReady();
  }
});
