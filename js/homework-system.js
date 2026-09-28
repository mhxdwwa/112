// ========== 作业岛系统 v291 ==========
// 按钮式功能栏 + 分层管理 + 布置作业 + 手写批阅 + 评分金币 + 云端同步 + 智能压缩(题目600KB/答案400KB) + 接收端图片增强(锐化+对比度) + 实时推送(师生双端) + 学生隐私保护 + 双层画布(橡皮擦只擦手写内容) + 自定义金币 + 分层数据即时加载
(function() {
  'use strict';

  // ========== API 配置 ==========
  var API_BASE = '/api/homework';
  var _syncingToCloud = false;
  var _cloudDataLoaded = false;

  // ========== Supabase Realtime 配置 ==========
  var SUPABASE_URL = 'https://xbygooadskfqllnhwmet.supabase.co';
  var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhieWdvb2Fkc2tmcWxsbmh3bWV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5NjU0NDgsImV4cCI6MjA5ODU0MTQ0OH0.ryfpesmsFqBnaJurlMhjEJOWxZV4oFg3NBu7kQD8EKA';
  var _realtimeChannel = null;
  var _realtimeInitialized = false;
  var _realtimeRetryCount = 0;
  var _realtimeMaxRetries = 3;
  var _isStudentView = false;
  var _currentStudentId = null;

  // 确保 Supabase Realtime 已开启（通过 REST API 检查并提示）
  async function ensureRealtimeEnabled() {
    try {
      // 尝试订阅来测试 realtime 是否可用
      var testChannel = 'test-realtime-' + Date.now();
      var supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      
      // 如果订阅成功，说明 realtime 已开启
      var channel = supabase.channel(testChannel)
        .on('postgres_changes', 
          { event: '*', schema: 'public', table: 'homework_submissions' },
          function() {}
        )
        .subscribe(function(status, err) {
          if (status === 'SUBSCRIBED') {
            console.log('[homework realtime] ✓ Realtime 已启用');
            channel.unsubscribe();
          } else if (status === 'CHANNEL_ERROR') {
            console.warn('[homework realtime] ⚠ Realtime 可能未开启，请在 Supabase Dashboard 中启用 homework_submissions 表的 Realtime');
            console.warn('[homework realtime] 步骤: Dashboard → Database → Replication → 开启 homework_submissions');
            channel.unsubscribe();
          }
        });
      
      // 5秒后如果还没连接成功，取消测试
      setTimeout(function() {
        try { channel.unsubscribe(); } catch(e) {}
      }, 5000);
    } catch (err) {
      console.warn('[homework realtime] 检查失败:', err);
    }
  }

  // 初始化 Supabase Realtime 订阅
  function initRealtime(isStudent, studentId) {
    if (_realtimeInitialized) return;
    
    _isStudentView = isStudent || false;
    _currentStudentId = studentId || null;
    
    if (!window.supabase || !window.supabase.createClient) {
      console.warn('[homework realtime] Supabase client not available, will retry...');
      // 延迟重试
      if (_realtimeRetryCount < _realtimeMaxRetries) {
        _realtimeRetryCount++;
        setTimeout(function() { initRealtime(isStudent, studentId); }, 2000);
      }
      return;
    }
    
    try {
      var supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      
      // 创建频道
      var channelName = 'homework-changes-' + (isStudent ? 'student-' + studentId : 'teacher') + '-' + Date.now();
      _realtimeChannel = supabase.channel(channelName);
      
      if (isStudent) {
        // 学生端：只监听 UPDATE 事件（教师批改完成）
        _realtimeChannel = _realtimeChannel
          .on('postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'homework_submissions' },
            function(payload) {
              console.log('[homework realtime] 学生收到批改通知:', payload.new);
              handleStudentGradedNotification(payload.new);
            }
          );
      } else {
        // 教师端：监听 INSERT 和 UPDATE 事件
        _realtimeChannel = _realtimeChannel
          .on('postgres_changes', 
            { event: 'INSERT', schema: 'public', table: 'homework_submissions' },
            function(payload) {
              console.log('[homework realtime] 新提交:', payload.new);
              handleNewSubmission(payload.new);
            }
          )
          .on('postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'homework_submissions' },
            function(payload) {
              console.log('[homework realtime] 提交更新:', payload.new);
              handleSubmissionUpdate(payload.new);
            }
          );
      }
      
      _realtimeChannel.subscribe(function(status, err) {
        console.log('[homework realtime] 订阅状态:', status);
        if (status === 'SUBSCRIBED') {
          _realtimeInitialized = true;
          _realtimeRetryCount = 0;
          console.log('[homework realtime] ✓ 已连接，实时同步已启用 (' + (isStudent ? '学生端' : '教师端') + ')');
        } else if (status === 'CHANNEL_ERROR') {
          console.warn('[homework realtime] 连接失败:', err);
          // 断线重连
          if (_realtimeRetryCount < _realtimeMaxRetries) {
            _realtimeRetryCount++;
            console.log('[homework realtime] 尝试重连 (' + _realtimeRetryCount + '/' + _realtimeMaxRetries + ')...');
            setTimeout(function() {
              _realtimeInitialized = false;
              initRealtime(isStudent, studentId);
            }, 3000);
          }
        } else if (status === 'TIMED_OUT') {
          console.warn('[homework realtime] 连接超时');
          if (_realtimeRetryCount < _realtimeMaxRetries) {
            _realtimeRetryCount++;
            setTimeout(function() {
              _realtimeInitialized = false;
              initRealtime(isStudent, studentId);
            }, 3000);
          }
        }
      });
    } catch (err) {
      console.warn('[homework realtime] 初始化失败:', err);
    }
  }

  // 学生端：处理教师批改通知
  function handleStudentGradedNotification(updatedSub) {
    // 检查是否是我的提交
    if (_currentStudentId && updatedSub.student_id !== parseInt(_currentStudentId)) {
      return; // 不是我的提交，忽略
    }
    
    // 检查是否已批改
    if (!updatedSub.graded_at) return;
    
    // 更新本地数据
    var existing = homeworkSubmissions.find(function(s) { return s.id === updatedSub.id; });
    if (existing) {
      existing.graded = true;
      existing.grade = updatedSub.grade || '';
      existing.coins = updatedSub.coins_awarded || 0;
      existing.comment = updatedSub.comment || '';
      existing.gradedImage = updatedSub.graded_image;
      existing.gradedAt = updatedSub.graded_at;
    } else {
      // 如果本地没有这条记录，从云端数据创建
      var newSub = {
        id: updatedSub.id,
        homeworkId: updatedSub.homework_id,
        studentId: updatedSub.student_id,
        studentName: updatedSub.student_name || '',
        image: updatedSub.image,
        gradedImage: updatedSub.graded_image,
        graded: true,
        grade: updatedSub.grade || '',
        coins: updatedSub.coins_awarded || 0,
        comment: updatedSub.comment || '',
        submittedAt: updatedSub.submitted_at,
        gradedAt: updatedSub.graded_at
      };
      homeworkSubmissions.push(newSub);
    }
    
    saveData();
    
    // 显示通知并刷新视图
    var grade = updatedSub.grade || '';
    var coins = updatedSub.coins_awarded || 0;
    showNotification('🎉 作业已批改: ' + grade + '，获得 ' + coins + ' 金币！', 'success');
    
    // 刷新学生视图
    var container = document.getElementById('homeworkContent');
    if (container && _currentStudentId) {
      var myClassId = parseInt(currentUser.classId || localStorage.getItem('classId') || 0);
      renderStudentView(container, parseInt(_currentStudentId), myClassId);
    }
  }

  // 处理新提交（教师端）
  function handleNewSubmission(newSub) {
    // 检查是否已存在（避免重复）
    var exists = homeworkSubmissions.find(function(s) { return s.id === newSub.id; });
    if (exists) return;
    
    // 添加到本地数据
    var sub = {
      id: newSub.id,
      homeworkId: newSub.homework_id,
      studentId: newSub.student_id,
      studentName: newSub.student_name || '',
      image: newSub.image,
      gradedImage: newSub.graded_image,
      graded: !!newSub.graded_at,
      grade: newSub.grade || '',
      coins: newSub.coins_awarded || 0,
      comment: newSub.comment || '',
      submittedAt: newSub.submitted_at,
      gradedAt: newSub.graded_at
    };
    
    homeworkSubmissions.push(sub);
    saveData();
    
    // 如果当前在查看提交批改页面，刷新列表
    if (_currentTab === 'submissions') {
      showNotification('📬 新提交: ' + (sub.studentName || '学生') + ' 提交了作业', 'success');
      if (typeof loadHomeworkSubmissions === 'function') {
        loadHomeworkSubmissions();
      }
    }
  }

  // 处理提交更新（教师端）
  function handleSubmissionUpdate(updatedSub) {
    var existing = homeworkSubmissions.find(function(s) { return s.id === updatedSub.id; });
    if (!existing) return;
    
    // 更新本地数据
    existing.graded = !!updatedSub.graded_at;
    existing.grade = updatedSub.grade || '';
    existing.coins = updatedSub.coins_awarded || 0;
    existing.comment = updatedSub.comment || '';
    existing.gradedImage = updatedSub.graded_image;
    existing.gradedAt = updatedSub.graded_at;
    
    saveData();
    
    // 刷新视图
    if (_currentTab === 'submissions' && typeof loadHomeworkSubmissions === 'function') {
      loadHomeworkSubmissions();
    }
  }

  // ========== 数据存储 ==========
  // v294: 版本检查 - 如果 localStorage 数据来自旧版本，清空以避免显示过期数据
  var HW_DATA_VERSION = 'v305';
  if (localStorage.getItem('hwDataVersion') !== HW_DATA_VERSION) {
    console.log('[homework] Data version mismatch, clearing stale localStorage');
    localStorage.removeItem('homeworkList');
    localStorage.removeItem('homeworkSubmissions');
    localStorage.removeItem('homeworkTiers');
    localStorage.setItem('hwDataVersion', HW_DATA_VERSION);
  }
  
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
  var _gradeOverlayCanvas = null;
  var _gradeOverlayCtx = null;
  var _gradeImg = null;
  var _drawColor = '#ef4444';
  var _drawTool = 'pen'; // pen | eraser | text
  var _drawLineWidth = 3;
  var _isDrawing = false;
  var _lastX = 0;
  var _lastY = 0;
  var _canvasScale = 1;
  var _gradeZoom = 1;
  var _gradeBaseWidth = 0;
  var _gradeBaseHeight = 0;
  var _gradeTouches = [];
  var _gradeInitialPinchDistance = 0;
  var _gradeInitialZoom = 1;

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

  // ========== WebP 支持检测 ==========
  var _supportsWebP = null;
  function detectWebPSupport() {
    if (_supportsWebP !== null) return _supportsWebP;
    try {
      var c = document.createElement('canvas');
      c.width = 1;
      c.height = 1;
      var d = c.toDataURL('image/webp');
      _supportsWebP = d.indexOf('data:image/webp') === 0;
    } catch (e) {
      _supportsWebP = false;
    }
    console.log('[WebP] 浏览器支持:', _supportsWebP);
    return _supportsWebP;
  }

  // 获取图片 MIME 类型（WebP 优先，降级 JPEG）
  function getImageFormat() {
    return detectWebPSupport() ? 'image/webp' : 'image/jpeg';
  }

  // 获取图片文件扩展名
  function getImageExtension() {
    return detectWebPSupport() ? '.webp' : '.jpg';
  }

  // ========== 图片压缩函数 ==========
  // 压缩图片到目标大小，使用Canvas + WebP/JPEG质量调节
  // targetSizeKB: 目标大小(KB)，默认800KB（保证文字清晰可读）
  // maxDimension: 最大边长，默认2400px
  function compressImage(dataUrl, targetSizeKB, callback, maxDimension) {
    targetSizeKB = targetSizeKB || 800;
    maxDimension = maxDimension || 2400;
    var targetBytes = targetSizeKB * 1024;
    var format = getImageFormat();
    
    var img = new Image();
    img.onload = function() {
      // 计算缩放比例 - 保留足够分辨率以保证文字清晰
      var scale = 1;
      if (img.width > maxDimension || img.height > maxDimension) {
        scale = maxDimension / Math.max(img.width, img.height);
      }
      
      var canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      var ctx = canvas.getContext('2d');
      
      // 绘制图片（白色背景，避免透明区域变黑）
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      
      // 逐步降低质量直到满足目标大小
      var quality = 0.88; // 起始质量（较高，保证清晰度）
      var minQuality = 0.5; // 最低质量（不低于0.5，否则文字模糊）
      var step = 0.08;
      
      function tryCompress(q) {
        var result = canvas.toDataURL(format, q);
        var size = Math.round((result.length * 3) / 4); // 估算base64解码后大小
        
        if (size <= targetBytes || q <= minQuality) {
          // 满足要求或已到最低质量
          console.log('[compressImage] 压缩完成: 格式=' + format +
                      ', 质量=' + q.toFixed(2) + 
                      ', 大小=' + Math.round(size/1024) + 'KB' +
                      ', 尺寸=' + canvas.width + 'x' + canvas.height);
          callback(result);
        } else {
          // 降低质量重试
          tryCompress(Math.max(minQuality, q - step));
        }
      }
      
      tryCompress(quality);
    };
    img.onerror = function() {
      console.warn('[compressImage] 图片加载失败，使用原图');
      callback(dataUrl);
    };
    img.src = dataUrl;
  }

  // ========== 图片增强函数（接收端使用） ==========
  // 对压缩后的图片进行锐化和对比度增强，让文字更清晰
  function enhanceImageForDisplay(dataUrl, callback) {
    var img = new Image();
    // 跨域图片需要设置 crossOrigin（Storage URL）
    if (isImageUrl(dataUrl)) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = function() {
      var canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      var ctx = canvas.getContext('2d');
      
      // 绘制原图
      ctx.drawImage(img, 0, 0);
      
      // 获取图像数据
      var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      var data = imageData.data;
      
      // 1. 对比度增强（让文字更清晰）
      var contrast = 1.15; // 对比度系数
      var intercept = 128 * (1 - contrast);
      for (var i = 0; i < data.length; i += 4) {
        data[i] = data[i] * contrast + intercept;     // R
        data[i+1] = data[i+1] * contrast + intercept; // G
        data[i+2] = data[i+2] * contrast + intercept; // B
      }
      
      // 2. 简单锐化（增强边缘）
      var sharpened = new Uint8ClampedArray(data.length);
      var w = canvas.width;
      for (var y = 1; y < canvas.height - 1; y++) {
        for (var x = 1; x < w - 1; x++) {
          var idx = (y * w + x) * 4;
          for (var c = 0; c < 3; c++) {
            // 锐化卷积核：中心5，四周-1
            var val = 5 * data[idx + c]
              - data[((y-1) * w + x) * 4 + c]
              - data[((y+1) * w + x) * 4 + c]
              - data[(y * w + (x-1)) * 4 + c]
              - data[(y * w + (x+1)) * 4 + c];
            sharpened[idx + c] = Math.max(0, Math.min(255, val));
          }
          sharpened[idx + 3] = data[idx + 3]; // Alpha
        }
      }
      
      // 复制边缘像素
      for (var x = 0; x < w; x++) {
        var topIdx = x * 4;
        var botIdx = ((canvas.height - 1) * w + x) * 4;
        for (var c = 0; c < 4; c++) {
          sharpened[topIdx + c] = data[topIdx + c];
          sharpened[botIdx + c] = data[botIdx + c];
        }
      }
      for (var y = 0; y < canvas.height; y++) {
        var leftIdx = (y * w) * 4;
        var rightIdx = (y * w + w - 1) * 4;
        for (var c = 0; c < 4; c++) {
          sharpened[leftIdx + c] = data[leftIdx + c];
          sharpened[rightIdx + c] = data[rightIdx + c];
        }
      }
      
      // 应用增强后的数据
      var enhancedData = new ImageData(sharpened, canvas.width, canvas.height);
      ctx.putImageData(enhancedData, 0, 0);
      
      // 输出增强后的图片（WebP 优先）
      var fmt = getImageFormat();
      var result = canvas.toDataURL(fmt, 0.95);
      console.log('[enhanceImage] 图片增强完成，格式=' + fmt + '，尺寸=' + canvas.width + 'x' + canvas.height);
      callback(result);
    };
    img.onerror = function() {
      console.warn('[enhanceImage] 图片加载失败，使用原图');
      callback(dataUrl);
    };
    img.src = dataUrl;
  }

  // 同步版本的压缩（返回Promise）
  function compressImageAsync(dataUrl, targetSizeKB) {
    return new Promise(function(resolve) {
      compressImage(dataUrl, targetSizeKB, resolve);
    });
  }

  // ========== Supabase Storage 工具函数 ==========
  var STORAGE_BUCKET = 'homework-images';

  // 判断字符串是否为 URL（而非 base64）
  function isImageUrl(str) {
    return str && (str.indexOf('http://') === 0 || str.indexOf('https://') === 0);
  }

  // 判断字符串是否为 base64 数据
  function isBase64Image(str) {
    return str && str.indexOf('data:image') === 0;
  }

  // dataURL 转 Blob
  function dataURLtoBlob(dataURL) {
    var parts = dataURL.split(',');
    var mimeMatch = parts[0].match(/:(.*?);/);
    var mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    var bstr = atob(parts[1]);
    var n = bstr.length;
    var u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  }

  // 上传图片到 Supabase Storage，返回公开 URL
  // path: 存储路径，如 'hw/123/abc.webp'
  // 返回 Promise<string|null>，null 表示上传失败（回退到 base64）
  function uploadImageToStorage(dataURL, path) {
    return new Promise(function(resolve) {
      try {
        var blob = dataURLtoBlob(dataURL);
        var url = SUPABASE_URL + '/storage/v1/object/' + STORAGE_BUCKET + '/' + path;
        
        fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
            'Content-Type': blob.type || 'image/jpeg',
            'x-upsert': 'true'
          },
          body: blob
        }).then(function(res) {
          if (res.ok) {
            var publicUrl = SUPABASE_URL + '/storage/v1/object/public/' + STORAGE_BUCKET + '/' + path;
            console.log('[Storage] 上传成功:', publicUrl);
            resolve(publicUrl);
          } else {
            res.json().then(function(err) {
              console.warn('[Storage] 上传失败:', err);
              resolve(null);
            }).catch(function() {
              console.warn('[Storage] 上传失败: HTTP', res.status);
              resolve(null);
            });
          }
        }).catch(function(err) {
          console.warn('[Storage] 上传错误:', err.message);
          resolve(null);
        });
      } catch (err) {
        console.warn('[Storage] 转换错误:', err.message);
        resolve(null);
      }
    });
  }

  // 从 Supabase Storage 删除图片
  function deleteImageFromStorage(path) {
    return new Promise(function(resolve) {
      try {
        var url = SUPABASE_URL + '/storage/v1/object/' + STORAGE_BUCKET + '/' + path;
        fetch(url, {
          method: 'DELETE',
          headers: {
            'Authorization': 'Bearer ' + SUPABASE_ANON_KEY
          }
        }).then(function(res) {
          if (res.ok) {
            console.log('[Storage] 删除成功:', path);
          } else {
            console.warn('[Storage] 删除失败:', path, res.status);
          }
          resolve(res.ok);
        }).catch(function(err) {
          console.warn('[Storage] 删除错误:', err.message);
          resolve(false);
        });
      } catch (err) {
        console.warn('[Storage] 删除异常:', err.message);
        resolve(false);
      }
    });
  }

  // 从 URL 中提取 Storage 路径（用于删除）
  function getStoragePathFromUrl(url) {
    var prefix = SUPABASE_URL + '/storage/v1/object/public/' + STORAGE_BUCKET + '/';
    if (url && url.indexOf(prefix) === 0) {
      return url.substring(prefix.length);
    }
    return null;
  }

  // ========== API 调用函数 ==========
  async function apiRequest(method, endpoint, data) {
    try {
      var opts = {
        method: method,
        headers: { 'Content-Type': 'application/json' }
      };
      if (data && method !== 'GET') {
        opts.body = JSON.stringify(data);
      }
      var url = API_BASE + endpoint;
      var res = await fetch(url, opts);
      return await res.json();
    } catch (err) {
      console.warn('[homework API] Error:', err);
      return { ok: false, error: err.message };
    }
  }

  // 同步分层数据到云端
  async function syncTiersToCloud(updates) {
    if (!currentClassId || _syncingToCloud) return;
    _syncingToCloud = true;
    try {
      await apiRequest('POST', '/tiers', {
        class_id: parseInt(currentClassId),
        updates: updates
      });
    } catch (err) {
      console.warn('[homework] syncTiersToCloud error:', err);
    }
    _syncingToCloud = false;
  }

  // 同步作业到云端
  async function syncHomeworkToCloud(hw) {
    if (!currentClassId || _syncingToCloud) return;
    _syncingToCloud = true;
    try {
      await apiRequest('POST', '', {
        id: hw.id,
        class_id: parseInt(currentClassId),
        tier: hw.tier,
        title: hw.title,
        description: hw.description || '',
        image: hw.image
      });
    } catch (err) {
      console.warn('[homework] syncHomeworkToCloud error:', err);
    }
    _syncingToCloud = false;
  }

  // 删除云端作业（级联删除提交记录）
  async function deleteHomeworkFromCloud(hwId) {
    if (!currentClassId) return;
    try {
      // 先删除该作业的所有提交记录
      await apiRequest('DELETE', '/submissions?homework_id=' + hwId);
      // 再删除作业本身
      await apiRequest('DELETE', '?id=' + hwId);
    } catch (err) {
      console.warn('[homework] deleteHomeworkFromCloud error:', err);
    }
  }

  // 同步提交到云端
  async function syncSubmissionToCloud(sub) {
    if (_syncingToCloud) return;
    _syncingToCloud = true;
    try {
      await apiRequest('POST', '/submissions', {
        id: sub.id,
        homework_id: sub.homeworkId,
        student_id: parseInt(sub.studentId),
        student_name: sub.studentName || '',
        image: sub.image
      });
    } catch (err) {
      console.warn('[homework] syncSubmissionToCloud error:', err);
    }
    _syncingToCloud = false;
  }

  // 同步批改到云端
  async function syncGradeToCloud(subId, gradedImage, grade, coins, comment) {
    try {
      await apiRequest('PATCH', '/submissions?id=' + subId, {
        gradedImage: gradedImage,
        grade: grade,
        coins_awarded: coins,
        comment: comment || ''
      });
    } catch (err) {
      console.warn('[homework] syncGradeToCloud error:', err);
    }
  }

  // 从云端加载数据
  async function loadFromCloud(classIdOverride, forceReload) {
    var loadClassId = classIdOverride || currentClassId;
    if (!loadClassId) {
      console.warn('[homework] loadFromCloud: no classId available');
      return;
    }
    
    // 学生端或强制重载时，忽略 _cloudDataLoaded 标志
    if (_cloudDataLoaded && !forceReload && !_isStudentView) return;
    
    // 强制重载时，先清空本地缓存，避免显示过期数据
    if (forceReload) {
      console.log('[homework] forceReload: clearing stale local data');
      homeworkList = [];
      homeworkSubmissions = [];
      localStorage.removeItem('homeworkList');
      localStorage.removeItem('homeworkSubmissions');
    }
    
    console.log('[homework] Loading cloud data for classId:', loadClassId, 'isStudent:', _isStudentView);
    
    try {
      // 加载分层数据
      var tiersRes = await apiRequest('GET', '/tiers?class_id=' + parseInt(loadClassId));
      console.log('[homework] Tiers response:', tiersRes);
      if (tiersRes.ok && tiersRes.data) {
        homeworkTiers = {};
        tiersRes.data.forEach(function(t) {
          homeworkTiers[String(t.student_id)] = t.tier;
        });
        localStorage.setItem('homeworkTiers', JSON.stringify(homeworkTiers));
        console.log('[homework] Loaded tiers:', homeworkTiers);
      } else {
        console.warn('[homework] Failed to load tiers:', tiersRes);
      }

      // 加载作业列表
      var hwRes = await apiRequest('GET', '?class_id=' + parseInt(loadClassId));
      console.log('[homework] Homework response:', hwRes);
      if (hwRes.ok && hwRes.data) {
        homeworkList = hwRes.data.map(function(h) {
          return {
            id: h.id,
            title: h.title,
            tier: h.tier,
            description: h.description,
            image: h.image,
            createdAt: h.created_at
          };
        });
        localStorage.setItem('homeworkList', JSON.stringify(homeworkList));
        console.log('[homework] Loaded homework list:', homeworkList.length, 'items');
      } else {
        console.warn('[homework] Failed to load homework:', hwRes);
      }

      // 加载提交记录
      if (homeworkList.length > 0) {
        var allSubs = [];
        for (var i = 0; i < homeworkList.length; i++) {
          var subRes = await apiRequest('GET', '/submissions?homework_id=' + homeworkList[i].id);
          if (subRes.ok && subRes.data) {
            allSubs = allSubs.concat(subRes.data.map(function(s) {
              return {
                id: s.id,
                homeworkId: s.homework_id,
                studentId: s.student_id,
                studentName: s.student_name,
                image: s.image,
                gradedImage: s.graded_image,
                graded: !!s.graded_at,
                grade: s.grade || '',
                coins: s.coins_awarded || 0,
                comment: s.comment || '',
                submittedAt: s.submitted_at,
                gradedAt: s.graded_at
              };
            }));
          }
        }
        homeworkSubmissions = allSubs;
        localStorage.setItem('homeworkSubmissions', JSON.stringify(homeworkSubmissions));
        console.log('[homework] Loaded submissions:', homeworkSubmissions.length, 'items');
      } else {
        // 没有作业，清空提交记录
        homeworkSubmissions = [];
        localStorage.setItem('homeworkSubmissions', JSON.stringify(homeworkSubmissions));
        console.log('[homework] No homework, cleared submissions');
      }

      _cloudDataLoaded = true;
      console.log('[homework] Cloud data loaded successfully for classId:', loadClassId);
    } catch (err) {
      console.error('[homework] loadFromCloud error:', err);
    }
  }

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
    
    // 检查是否是学生视图（增强检测，兼容各种登录方式）
    var isStudentView = false;
    var studentUserType = null;
    
    // 优先检查 currentUser（auth-check.js 设置）
    if (typeof currentUser !== 'undefined' && currentUser) {
      studentUserType = currentUser.type;
    }
    
    // 如果 currentUser 未设置，从 localStorage 读取
    if (!studentUserType) {
      studentUserType = localStorage.getItem('userType');
    }
    
    isStudentView = (studentUserType === 'student');
    
    console.log('[homework] renderHomeworkPage - userType:', studentUserType, 'isStudent:', isStudentView);
    
    if (isStudentView) {
      // 学生视图 - 只显示"我的作业"，不显示教师管理按钮
      var myStudentId = null;
      var myClassId = null;
      
      // 获取学生ID和班级ID（优先 currentUser，其次 localStorage）
      if (typeof currentUser !== 'undefined' && currentUser) {
        myStudentId = parseInt(currentUser.studentId || localStorage.getItem('studentId') || 0);
        myClassId = parseInt(currentUser.classId || localStorage.getItem('classId') || 0);
      } else {
        myStudentId = parseInt(localStorage.getItem('studentId') || 0);
        myClassId = parseInt(localStorage.getItem('classId') || 0);
      }
      
      console.log('[homework] Student view - studentId:', myStudentId, 'classId:', myClassId);
      
      if (!myStudentId || !myClassId) {
        container.innerHTML = '<div style="text-align:center;padding:60px 20px;">' +
          '<div style="font-size:48px;margin-bottom:15px;">⚠️</div>' +
          '<div style="color:#666;font-size:14px;">登录信息不完整，请重新登录</div></div>';
        return;
      }
      
      // 初始化学生端 Realtime 订阅
      if (!_realtimeInitialized) {
        initRealtime(true, myStudentId);
      }
      
      // 显示加载中状态
      if (!_cloudDataLoaded) {
        container.innerHTML = '<div style="text-align:center;padding:60px 20px;">' +
          '<div style="font-size:48px;margin-bottom:15px;">⏳</div>' +
          '<div style="color:#666;font-size:14px;">正在加载作业数据...</div></div>';
      }
      
      // 从云端同步数据，确保分层数据加载完成后再渲染
      // 学生端每次进入都强制重新加载，确保看到最新作业
      loadFromCloud(myClassId, true).then(function() {
        renderStudentView(container, myStudentId, myClassId);
      });
      
      return; // 学生视图结束，不执行后面的教师视图代码
    }
    
    // ========== 教师视图 ==========
    console.log('[homework] Teacher view');
    
    var students = getCurrentStudents();
    if (students.length === 0) {
      container.innerHTML = '<div style="text-align:center;padding:60px 20px;color:#999;">' +
        '<div style="font-size:48px;margin-bottom:15px;">🏫</div>' +
        '<div style="font-size:16px;">请先在宠物管理中添加学生和班级</div></div>';
      return;
    }
    
    // 初始化教师端 Realtime 订阅
    if (!_realtimeInitialized) {
      initRealtime(false, null);
      // 检查 Realtime 是否已启用
      ensureRealtimeEnabled();
    }
    
    // 检查 currentClassId 是否已设置
    if (!currentClassId) {
      // currentClassId 还没设置，显示加载中并等待
      container.innerHTML = '<div style="text-align:center;padding:60px 20px;">' +
        '<div style="font-size:48px;margin-bottom:15px;">⏳</div>' +
        '<div style="color:#666;font-size:14px;">正在加载班级数据...</div></div>';
      // 等待 currentClassId 被设置（最多等 3 秒）
      var waitCount = 0;
      var waitInterval = setInterval(function() {
        waitCount++;
        if (currentClassId) {
          clearInterval(waitInterval);
          // currentClassId 已设置，重新加载数据
          _cloudDataLoaded = false; // 强制重新加载
          loadFromCloud().then(function() {
            renderHomeworkPageContent(container, students);
          });
        } else if (waitCount >= 30) {
          // 3秒后还没设置，停止等待
          clearInterval(waitInterval);
          console.warn('[homework] currentClassId not set after 3s, rendering without cloud data');
          renderHomeworkPageContent(container, students);
        }
      }, 100);
      return;
    }
    
    // currentClassId 已设置，从云端同步数据（每次进入都重新加载，确保分层数据最新）
    _cloudDataLoaded = false; // 强制重新加载
    container.innerHTML = '<div style="text-align:center;padding:60px 20px;">' +
      '<div style="font-size:48px;margin-bottom:15px;">⏳</div>' +
      '<div style="color:#666;font-size:14px;">正在同步作业数据...</div></div>';
    loadFromCloud().then(function() {
      renderHomeworkPageContent(container, students);
    });
  };

  // ========== 学生视图渲染 ==========
  function renderStudentView(container, studentId, classId) {
    // 获取学生所在层级（内部使用，不显示给学生）
    var myTier = homeworkTiers[String(studentId)];
    
    var html = '<div style="text-align:center;padding:20px;background:linear-gradient(135deg,#667eea,#764ba2);border-radius:16px;margin-bottom:20px;color:white;">';
    html += '<div style="font-size:24px;margin-bottom:8px;">📝 我的作业</div>';
    html += '<div style="font-size:14px;opacity:0.9;">' + esc(currentUser.studentName || '同学') + '</div>';
    // 不显示层级信息，保护学生自尊心
    html += '</div>';
    
    // 如果没有分层，尝试显示所有作业（降级模式）
    if (!myTier) {
      // 检查是否有任何作业
      if (homeworkList.length === 0) {
        html += '<div class="hw-card" style="text-align:center;padding:40px 20px;">';
        html += '<div style="font-size:48px;margin-bottom:15px;">📋</div>';
        html += '<div style="color:#666;">老师还没有布置作业</div>';
        html += '<div style="font-size:13px;color:#999;margin-top:8px;">请稍后再来查看</div>';
        html += '<button onclick="refreshStudentHomework()" style="margin-top:15px;padding:10px 20px;background:#667eea;color:white;border:none;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;">🔄 刷新</button>';
        html += '</div>';
      } else {
        // 有作业但没有分层，显示第一个作业（降级模式）
        html += '<div style="padding:10px;background:#fff3cd;border-radius:10px;margin-bottom:15px;font-size:12px;color:#856404;">';
        html += '⚠️ 数据同步中，显示最新作业';
        html += '</div>';
        
        var fallbackHomework = homeworkList[0]; // 显示最新的作业
        html += renderHomeworkCard(fallbackHomework, studentId);
      }
      container.innerHTML = html;
      return;
    }
    
    // 获取该层级的作业
    var myHomework = homeworkList.find(function(h) { return h.tier === myTier; });
    
    if (!myHomework) {
      html += '<div class="hw-card" style="text-align:center;padding:40px 20px;">';
      html += '<div style="font-size:48px;margin-bottom:15px;">📭</div>';
      html += '<div style="color:#666;">暂无作业</div>';
      html += '<div style="font-size:13px;color:#999;margin-top:8px;">老师还没有布置作业，请稍后再来</div>';
      html += '<button onclick="refreshStudentHomework()" style="margin-top:15px;padding:10px 20px;background:#667eea;color:white;border:none;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;">🔄 刷新</button>';
      html += '</div>';
      container.innerHTML = html;
      return;
    }
    
    // 显示作业（不显示层级标签）
    html += renderHomeworkCard(myHomework, studentId);
    container.innerHTML = html;
  }
  
  // 渲染作业卡片（包括提交状态）
  function renderHomeworkCard(myHomework, studentId) {
    var html = '<div class="hw-card">';
    html += '<div class="hw-card-title">📖 当前作业</div>';
    html += '<div style="font-size:18px;font-weight:700;color:#333;margin-bottom:10px;">' + esc(myHomework.title) + '</div>';
    html += '<div style="font-size:12px;color:#888;margin-bottom:15px;">发布于 ' + new Date(myHomework.createdAt).toLocaleDateString() + '</div>';
    if (myHomework.description) {
      html += '<div style="padding:12px;background:#f8f9fa;border-radius:10px;margin-bottom:15px;font-size:14px;color:#555;">' + esc(myHomework.description) + '</div>';
    }
    html += '</div>';
    
    // 检查是否已提交
    var mySubmission = homeworkSubmissions.find(function(s) { 
      return s.homeworkId === myHomework.id && String(s.studentId) === String(studentId); 
    });
    
    if (!mySubmission) {
      // 未提交 - 直接在老师题目上书写（画布即题目）
      html += '<div class="hw-card">';
      html += '<div class="hw-card-title">✏️ 在题目上书写答案</div>';
      html += '<div style="font-size:13px;color:#666;margin-bottom:10px;">直接在题目上作答或者作业本写好拍照作答</div>';
      // 画布容器（老师的题目图片作为底图 + 透明叠加层用于书写）
      // 移动端：突破卡片内边距，让图片占满屏幕宽度
      html += '<div id="studentCanvasContainer" style="width:calc(100% + 24px);margin-left:-12px;margin-right:-12px;overflow:auto;border-radius:0;border:none;background:#000;-webkit-overflow-scrolling:touch;position:relative;touch-action:none;">';
      if (myHomework.image) {
        html += '<canvas id="studentCanvas" style="display:block;cursor:crosshair;touch-action:none;pointer-events:none;" data-homework-image="' + myHomework.image + '"></canvas>';
        html += '<canvas id="studentOverlayCanvas" style="position:absolute;top:0;left:0;display:block;cursor:crosshair;touch-action:none;pointer-events:auto;z-index:2;background:transparent;"></canvas>';
      } else {
        html += '<canvas id="studentCanvas" style="display:block;cursor:crosshair;touch-action:none;"></canvas>';
        html += '<div style="padding:30px;text-align:center;color:#999;font-size:13px;">本题没有图片</div>';
      }
      html += '</div>';
      // 工具栏（替代原来的提示文字位置，紧凑设计）
      html += '<div id="studentCanvasToolbar" style="display:flex;align-items:center;justify-content:center;gap:3px;margin-top:8px;padding:5px 6px;background:rgba(30,30,30,0.85);border-radius:16px;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);">';
      html += '<button id="stuToolPen" onclick="setStudentDrawTool(\'pen\')" style="width:26px;height:26px;background:#667eea;color:white;border:none;border-radius:50%;font-size:12px;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;flex-shrink:0;">✏️</button>';
      html += '<button id="stuToolEraser" onclick="setStudentDrawTool(\'eraser\')" style="width:26px;height:26px;background:transparent;color:#ccc;border:none;border-radius:50%;font-size:12px;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;flex-shrink:0;">🧹</button>';
      html += '<button id="stuToolMove" onclick="setStudentDrawTool(\'move\')" title="移动图片" style="width:26px;height:26px;background:transparent;color:#ccc;border:none;border-radius:50%;font-size:12px;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;flex-shrink:0;">✋</button>';
      // 全屏按钮（仅移动端显示）
      if (window.innerWidth <= 768) {
        html += '<button id="stuToolFullscreen" onclick="enterStudentFullscreen()" style="width:26px;height:26px;background:transparent;color:white;border:none;border-radius:50%;font-size:12px;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;flex-shrink:0;">⛶</button>';
      }
      html += '<span style="width:1px;height:16px;background:rgba(255,255,255,0.2);margin:0 1px;"></span>';
      var stuColors = ['#000000','#3b82f6'];
      stuColors.forEach(function(c) {
        html += '<div onclick="setStudentDrawColor(\'' + c + '\')" class="stu-pen-color-btn" data-color="' + c + '" style="width:18px;height:18px;border-radius:50%;background:' + c + ';cursor:pointer;border:2px solid ' + (c === '#000000' ? '#667eea' : 'rgba(255,255,255,0.3)') + ';flex-shrink:0;"></div>';
      });
      html += '<span style="width:1px;height:16px;background:rgba(255,255,255,0.2);margin:0 1px;"></span>';
      html += '<input type="range" id="stuDrawLineWidth" min="1" max="10" value="3" oninput="setStudentDrawLineWidth(this.value)" style="width:60px;height:16px;cursor:pointer;accent-color:#667eea;">';
      html += '<span style="width:1px;height:16px;background:rgba(255,255,255,0.2);margin:0 1px;"></span>';
      html += '<button onclick="zoomStudentCanvas(1.3)" style="width:24px;height:24px;background:transparent;color:white;border:none;border-radius:50%;font-size:11px;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;flex-shrink:0;">🔍</button>';
      html += '<button onclick="zoomStudentCanvas(0.77)" style="width:24px;height:24px;background:transparent;color:white;border:none;border-radius:50%;font-size:10px;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;flex-shrink:0;">🔎</button>';
      html += '<button onclick="resetStudentCanvasZoom()" style="width:24px;height:24px;background:transparent;color:white;border:none;border-radius:50%;font-size:11px;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;flex-shrink:0;">↺</button>';
      html += '<button onclick="clearStudentCanvas()" style="width:24px;height:24px;background:#ef4444;color:white;border:none;border-radius:50%;font-size:10px;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;flex-shrink:0;">🗑</button>';
      html += '</div>';
      // 可选：额外上传照片（如答题纸）
      html += '<div style="margin-top:12px;">';
      html += '<div onclick="document.getElementById(\'studentImageInput\').click()" style="border:1px dashed #d1d5db;border-radius:8px;padding:10px;text-align:center;cursor:pointer;font-size:12px;color:#999;">';
      html += '📷 可选：额外拍照上传答题纸（附加在答案后面）';
      html += '</div>';
      html += '<input type="file" id="studentImageInput" accept="image/*" capture="environment" style="display:none;" onchange="handleStudentExtraUpload(event)">';
      html += '<div id="studentExtraUploadPreview" style="margin-top:8px;"></div>';
      html += '</div>';
      html += '<button onclick="studentSubmitHomework(\'' + myHomework.id + '\',' + studentId + ')" class="hw-btn hw-btn-primary" style="width:100%;padding:14px;font-size:15px;margin-top:15px;">📤 提交作业</button>';
      html += '</div>';
      // 延迟初始化画布（等 DOM 渲染完成）- 移动端需要更长时间
      setTimeout(function() {
        if (myHomework.image) {
          initStudentCanvasWithRetry(myHomework.image, 0);
        }
      }, 300);
    } else if (!mySubmission.graded) {
      // 已提交但未批改
      html += '<div class="hw-card" style="background:linear-gradient(135deg,#fff3cd,#ffe69c);border:2px solid #ffc107;">';
      html += '<div style="display:flex;align-items:center;gap:12px;">';
      html += '<div style="font-size:36px;">⏳</div>';
      html += '<div>';
      html += '<div style="font-weight:700;color:#856404;">已提交，等待批改</div>';
      html += '<div style="font-size:13px;color:#856404;margin-top:4px;">提交时间: ' + new Date(mySubmission.submittedAt).toLocaleString() + '</div>';
      html += '</div></div>';
      if (mySubmission.image) {
        html += '<div style="margin-top:15px;"><img src="' + mySubmission.image + '" style="width:100%;border-radius:10px;opacity:0.8;"></div>';
      }
      html += '</div>';
    } else {
      // 已批改
      html += '<div class="hw-card" style="background:linear-gradient(135deg,#d4edda,#c3e6cb);border:2px solid #28a745;">';
      html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:15px;">';
      html += '<div style="display:flex;align-items:center;gap:12px;">';
      html += '<div style="font-size:36px;">✅</div>';
      html += '<div>';
      html += '<div style="font-weight:700;color:#155724;">已批改</div>';
      html += '<div style="font-size:13px;color:#155724;margin-top:4px;">批改时间: ' + new Date(mySubmission.gradedAt).toLocaleString() + '</div>';
      html += '</div></div>';
      html += '<div style="text-align:right;">';
      html += '<div style="font-size:24px;font-weight:800;color:' + (GRADE_COLORS[mySubmission.grade] || '#666') + ';">' + mySubmission.grade + '</div>';
      html += '<div style="font-size:14px;color:#f59e0b;font-weight:700;">+' + mySubmission.coins + ' 金币</div>';
      html += '</div></div>';
      if (mySubmission.comment) {
        html += '<div style="padding:12px;background:rgba(255,255,255,0.7);border-radius:10px;margin-bottom:15px;font-size:14px;color:#333;">';
        html += '<div style="font-weight:600;margin-bottom:4px;">老师评语:</div>';
        html += esc(mySubmission.comment);
        html += '</div>';
      }
      if (mySubmission.gradedImage) {
        html += '<div style="margin-top:10px;"><div style="font-size:13px;font-weight:600;color:#155724;margin-bottom:8px;">批阅详情:</div>';
        html += '<img src="' + mySubmission.gradedImage + '" style="width:100%;border-radius:10px;box-shadow:0 2px 10px rgba(0,0,0,0.15);"></div>';
      }
      html += '</div>';
    }
    
    return html;
  }
  
  // 学生手动刷新作业数据
  window.refreshStudentHomework = function() {
    var container = document.getElementById('homeworkContent');
    if (!container) return;
    
    container.innerHTML = '<div style="text-align:center;padding:60px 20px;">' +
      '<div style="font-size:48px;margin-bottom:15px;">⏳</div>' +
      '<div style="color:#666;font-size:14px;">正在刷新...</div></div>';
    
    var myStudentId = parseInt(currentUser.studentId);
    var myClassId = parseInt(currentUser.classId || localStorage.getItem('classId') || 0);
    
    // 强制重新加载数据
    _cloudDataLoaded = false;
    loadFromCloud(myClassId, true).then(function() {
      renderStudentView(container, myStudentId, myClassId);
    });
  };

  // ========== 学生画布书写功能 ==========
  var _stuCanvas = null;
  var _stuCtx = null;
  var _stuOverlayCanvas = null; // 透明叠加层，用于书写
  var _stuOverlayCtx = null;
  var _stuImg = null;
  var _stuDrawColor = '#000000';
  var _stuDrawTool = 'pen';
  var _stuDrawLineWidth = 3;
  var _stuIsDrawing = false;
  var _stuLastX = 0;
  var _stuLastY = 0;
  var _stuZoom = 1;
  var _stuBaseWidth = 0;
  var _stuBaseHeight = 0;
  var _stuTouches = []; // 用于双指缩放
  var _stuInitialPinchDistance = 0;
  var _stuInitialZoom = 1;
  var _studentUploadedImage = null; // 兼容：保留旧变量

  // 带重试的画布初始化（移动端DOM渲染可能较慢）
  function initStudentCanvasWithRetry(imageDataUrl, retryCount) {
    var canvas = document.getElementById('studentCanvas');
    if (!canvas) {
      if (retryCount < 10) {
        // 最多重试10次，每次间隔200ms
        setTimeout(function() {
          initStudentCanvasWithRetry(imageDataUrl, retryCount + 1);
        }, 200);
      } else {
        console.warn('[homework] 画布初始化失败：找不到 studentCanvas 元素');
      }
      return;
    }
    // 找到画布，开始初始化
    initStudentCanvas(imageDataUrl);
  }

  // 初始化学生画布（双层：底图 + 透明叠加层）
  function initStudentCanvas(imageDataUrl) {
    var canvas = document.getElementById('studentCanvas');
    var overlayCanvas = document.getElementById('studentOverlayCanvas');
    if (!canvas || !overlayCanvas) return;
    _stuCanvas = canvas;
    _stuCtx = canvas.getContext('2d');
    _stuOverlayCanvas = overlayCanvas;
    _stuOverlayCtx = overlayCanvas.getContext('2d');

    // 先增强图片（锐化+对比度），让文字更清晰
    enhanceImageForDisplay(imageDataUrl, function(enhancedImageUrl) {
      var img = new Image();
      img.onload = function() {
        _stuImg = img;
        // 计算基础尺寸 - 移动端使用视口宽度，桌面端使用容器宽度
        var container = document.getElementById('studentCanvasContainer');
        var isMobile = window.innerWidth <= 768;
        var maxW;
        if (isMobile) {
          // 移动端：使用视口宽度，让图片占满屏幕
          maxW = window.innerWidth;
        } else {
          // 桌面端：使用容器宽度
          maxW = container ? container.clientWidth : Math.min(window.innerWidth - 60, 800);
        }
        var scale = maxW / img.width;
        if (scale > 1) scale = 1;
        _stuBaseWidth = Math.round(img.width * scale);
        _stuBaseHeight = Math.round(img.height * scale);
        _stuZoom = 1;
        
        // 设置底图画布尺寸并绘制增强后的底图
        canvas.width = _stuBaseWidth;
        canvas.height = _stuBaseHeight;
        canvas.style.width = _stuBaseWidth + 'px';
        canvas.style.height = _stuBaseHeight + 'px';
        _stuCtx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        // 设置叠加层画布尺寸（透明）- 确保与底图完全对齐
        overlayCanvas.width = _stuBaseWidth;
        overlayCanvas.height = _stuBaseHeight;
        overlayCanvas.style.width = _stuBaseWidth + 'px';
        overlayCanvas.style.height = _stuBaseHeight + 'px';
        // 清空叠加层（确保完全透明）
        _stuOverlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
        
        // 绑定绘制事件到叠加层（而不是底图）
        overlayCanvas.addEventListener('mousedown', onStuCanvasDown);
        overlayCanvas.addEventListener('mousemove', onStuCanvasMove);
        overlayCanvas.addEventListener('mouseup', onStuCanvasUp);
        overlayCanvas.addEventListener('mouseleave', onStuCanvasUp);
        overlayCanvas.addEventListener('touchstart', onStuCanvasTouchStart, { passive: false });
        overlayCanvas.addEventListener('touchmove', onStuCanvasTouchMove, { passive: false });
        overlayCanvas.addEventListener('touchend', onStuCanvasTouchEnd);
      };
      img.src = enhancedImageUrl;
    });
  }

  function getStuCanvasPos(e) {
    var rect = _stuOverlayCanvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (_stuOverlayCanvas.width / rect.width),
      y: (e.clientY - rect.top) * (_stuOverlayCanvas.height / rect.height)
    };
  }

  function onStuCanvasDown(e) {
    if (_stuDrawTool === 'move') return; // 移动模式：不拦截鼠标
    _stuIsDrawing = true;
    var pos = getStuCanvasPos(e);
    _stuLastX = pos.x;
    _stuLastY = pos.y;
  }

  function onStuCanvasMove(e) {
    if (_stuDrawTool === 'move' || !_stuIsDrawing) return; // 移动模式：不拦截鼠标
    var pos = getStuCanvasPos(e);
    drawStuLine(_stuLastX, _stuLastY, pos.x, pos.y);
    _stuLastX = pos.x;
    _stuLastY = pos.y;
  }

  function onStuCanvasUp() {
    _stuIsDrawing = false;
  }

  // 触摸开始 - 支持双指缩放
  function onStuCanvasTouchStart(e) {
    if (_stuDrawTool === 'move') return; // 移动模式：不拦截触摸
    e.preventDefault();
    _stuTouches = Array.from(e.touches);
    
    if (_stuTouches.length === 2) {
      // 双指 - 记录初始距离用于缩放
      _stuInitialPinchDistance = getTouchDistance(_stuTouches[0], _stuTouches[1]);
      _stuInitialZoom = _stuZoom;
      _stuIsDrawing = false; // 双指时不绘制
    } else if (_stuTouches.length === 1) {
      // 单指 - 开始绘制
      var touch = _stuTouches[0];
      var mouseEvent = new MouseEvent('mousedown', { clientX: touch.clientX, clientY: touch.clientY });
      onStuCanvasDown(mouseEvent);
    }
  }

  // 触摸移动 - 支持双指缩放
  function onStuCanvasTouchMove(e) {
    if (_stuDrawTool === 'move') return; // 移动模式：不拦截触摸
    e.preventDefault();
    var touches = Array.from(e.touches);
    
    if (touches.length === 2) {
      // 双指缩放
      var currentDistance = getTouchDistance(touches[0], touches[1]);
      var zoomRatio = currentDistance / _stuInitialPinchDistance;
      var newZoom = _stuInitialZoom * zoomRatio;
      
      // 限制缩放范围 0.5x - 6x
      if (newZoom >= 0.5 && newZoom <= 6) {
        applyStudentZoom(newZoom);
      }
    } else if (touches.length === 1 && _stuIsDrawing) {
      // 单指绘制
      var touch = touches[0];
      var mouseEvent = new MouseEvent('mousemove', { clientX: touch.clientX, clientY: touch.clientY });
      onStuCanvasMove(mouseEvent);
    }
  }

  function onStuCanvasTouchEnd(e) {
    if (_stuDrawTool === 'move') return; // 移动模式：不拦截触摸
    if (e.touches.length === 0) {
      _stuIsDrawing = false;
      _stuTouches = [];
    } else if (e.touches.length === 1) {
      // 从双指变为单指，重新开始绘制
      _stuIsDrawing = true;
      var touch = e.touches[0];
      var pos = getStuCanvasPos({ clientX: touch.clientX, clientY: touch.clientY });
      _stuLastX = pos.x;
      _stuLastY = pos.y;
    }
  }

  // 计算两个触摸点之间的距离
  function getTouchDistance(t1, t2) {
    var dx = t1.clientX - t2.clientX;
    var dy = t1.clientY - t2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  // 应用缩放（从原图重绘，避免模糊）
  function applyStudentZoom(newZoom) {
    if (!_stuCanvas || !_stuImg || !_stuCtx || !_stuOverlayCanvas) return;
    
    _stuZoom = newZoom;
    var newWidth = Math.round(_stuBaseWidth * _stuZoom);
    var newHeight = Math.round(_stuBaseHeight * _stuZoom);
    
    // 保存叠加层当前内容（手写内容）
    var tempOverlayCanvas = document.createElement('canvas');
    tempOverlayCanvas.width = _stuOverlayCanvas.width;
    tempOverlayCanvas.height = _stuOverlayCanvas.height;
    var tempOverlayCtx = tempOverlayCanvas.getContext('2d');
    tempOverlayCtx.drawImage(_stuOverlayCanvas, 0, 0);
    
    // 调整底图画布尺寸（buffer + CSS）
    _stuCanvas.width = newWidth;
    _stuCanvas.height = newHeight;
    _stuCanvas.style.width = newWidth + 'px';
    _stuCanvas.style.height = newHeight + 'px';
    
    // 从原始图片重绘底图（避免多次缩放导致的模糊）
    _stuCtx.drawImage(_stuImg, 0, 0, newWidth, newHeight);
    
    // 调整叠加层尺寸并重绘手写内容
    _stuOverlayCanvas.width = newWidth;
    _stuOverlayCanvas.height = newHeight;
    _stuOverlayCanvas.style.width = newWidth + 'px';
    _stuOverlayCanvas.style.height = newHeight + 'px';
    _stuOverlayCtx.drawImage(tempOverlayCanvas, 0, 0, newWidth, newHeight);
  }

  // 按钮缩放
  window.zoomStudentCanvas = function(factor) {
    var newZoom = _stuZoom * factor;
    if (newZoom >= 0.5 && newZoom <= 6) {
      applyStudentZoom(newZoom);
    }
  };

  // 重置缩放
  window.resetStudentCanvasZoom = function() {
    applyStudentZoom(1);
  };

  function drawStuLine(x1, y1, x2, y2) {
    if (!_stuOverlayCtx) return;
    
    if (_stuDrawTool === 'eraser') {
      // 橡皮擦：使用 destination-out 只擦除叠加层上的内容，不影响底图
      _stuOverlayCtx.globalCompositeOperation = 'destination-out';
      _stuOverlayCtx.beginPath();
      _stuOverlayCtx.moveTo(x1, y1);
      _stuOverlayCtx.lineTo(x2, y2);
      _stuOverlayCtx.strokeStyle = 'rgba(0,0,0,1)';
      _stuOverlayCtx.lineWidth = _stuDrawLineWidth * 4 * _stuZoom;
      _stuOverlayCtx.lineCap = 'round';
      _stuOverlayCtx.lineJoin = 'round';
      _stuOverlayCtx.stroke();
      _stuOverlayCtx.globalCompositeOperation = 'source-over'; // 恢复默认
    } else {
      // 画笔：正常绘制在叠加层上
      _stuOverlayCtx.globalCompositeOperation = 'source-over';
      _stuOverlayCtx.beginPath();
      _stuOverlayCtx.moveTo(x1, y1);
      _stuOverlayCtx.lineTo(x2, y2);
      _stuOverlayCtx.strokeStyle = _stuDrawColor;
      _stuOverlayCtx.lineWidth = _stuDrawLineWidth * _stuZoom;
      _stuOverlayCtx.lineCap = 'round';
      _stuOverlayCtx.lineJoin = 'round';
      _stuOverlayCtx.stroke();
    }
  }

  window.setStudentDrawTool = function(tool) {
    _stuDrawTool = tool;
    var penBtn = document.getElementById('stuToolPen');
    var eraserBtn = document.getElementById('stuToolEraser');
    var moveBtn = document.getElementById('stuToolMove');
    // Reset all tool buttons
    if (penBtn) { penBtn.style.background = 'transparent'; penBtn.style.color = '#ccc'; }
    if (eraserBtn) { eraserBtn.style.background = 'transparent'; eraserBtn.style.color = '#ccc'; }
    if (moveBtn) { moveBtn.style.background = 'transparent'; moveBtn.style.color = '#ccc'; }
    // Highlight active tool
    if (tool === 'pen' && penBtn) {
      penBtn.style.background = '#667eea';
      penBtn.style.color = 'white';
    } else if (tool === 'eraser' && eraserBtn) {
      eraserBtn.style.background = '#667eea';
      eraserBtn.style.color = 'white';
    } else if (tool === 'move' && moveBtn) {
      moveBtn.style.background = '#667eea';
      moveBtn.style.color = 'white';
    }
    // Move mode: disable overlay pointer-events so container handles scroll/pan
    if (_stuOverlayCanvas) {
      if (tool === 'move') {
        _stuOverlayCanvas.style.pointerEvents = 'none';
        _stuOverlayCanvas.style.touchAction = 'auto';
        _stuOverlayCanvas.style.cursor = 'default';
        var container = document.getElementById('studentCanvasContainer');
        if (container) { container.style.cursor = 'grab'; container.style.touchAction = 'pan-x pan-y'; }
      } else {
        _stuOverlayCanvas.style.pointerEvents = 'auto';
        _stuOverlayCanvas.style.touchAction = 'none';
        _stuOverlayCanvas.style.cursor = tool === 'eraser' ? 'cell' : 'crosshair';
        var container = document.getElementById('studentCanvasContainer');
        if (container) { container.style.cursor = 'default'; container.style.touchAction = 'none'; }
      }
    }
  };

  window.setStudentDrawColor = function(color) {
    _stuDrawColor = color;
    _stuDrawTool = 'pen';
    window.setStudentDrawTool('pen');
    var btns = document.querySelectorAll('.stu-pen-color-btn');
    btns.forEach(function(btn) {
      btn.style.border = '2px solid ' + (btn.getAttribute('data-color') === color ? '#667eea' : 'rgba(255,255,255,0.3)');
    });
  };

  window.setStudentDrawLineWidth = function(w) {
    _stuDrawLineWidth = parseInt(w) || 3;
  };

  window.clearStudentCanvas = function() {
    if (!_stuOverlayCanvas || !_stuImg) return;
    if (!confirm('确定清除所有书写内容？')) return;
    // 只清除叠加层（书写内容），底图保持不变
    _stuOverlayCtx.clearRect(0, 0, _stuOverlayCanvas.width, _stuOverlayCanvas.height);
  };

  // 全屏答题功能（仅移动端）
  var _stuFullscreenActive = false;
  var _stuFsOverlay = null;
  var _stuFsCanvas = null;
  var _stuFsOverlayCanvas = null;
  var _stuFsCtx = null;
  var _stuFsOverlayCtx = null;
  var _stuFsZoom = 1;
  var _stuFsBaseW = 0;
  var _stuFsBaseH = 0;
  var _stuFsDrawing = false;
  var _stuFsLastX = 0;
  var _stuFsLastY = 0;
  var _stuFsPinchDist = 0;
  var _stuFsPinchZoom = 1;
  var _stuFsDrawTool = 'pen';
  var _stuFsHomeworkId = '';
  var _stuFsStudentId = 0;
  var _stuFsRotated = false; // true = image rotated 90° CW to fill portrait screen

  window.enterStudentFullscreen = function() {
    if (_stuFullscreenActive || !_stuImg) return;
    _stuFullscreenActive = true;

    // 获取作业ID和学生ID
    var btns = document.querySelectorAll('button[onclick*="studentSubmitHomework"]');
    if (btns.length > 0) {
      var m = btns[0].getAttribute('onclick').match(/studentSubmitHomework\('([^']+)',(\d+)\)/);
      if (m) { _stuFsHomeworkId = m[1]; _stuFsStudentId = parseInt(m[2]); }
    }

    // 创建全屏层
    var el = document.createElement('div');
    el.id = 'stuFsLayer';
    el.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:#000;z-index:99999;';

    // 画布滚动容器（占满全屏，除了工具栏）
    var cc = document.createElement('div');
    cc.id = 'stuFsScrollContainer';
    cc.style.cssText = 'position:absolute;top:0;left:0;right:0;bottom:50px;overflow:auto;-webkit-overflow-scrolling:touch;touch-action:none;';

    // 内层容器（用于撑开滚动高度）
    var inner = document.createElement('div');
    inner.id = 'stuFsInner';
    inner.style.cssText = 'position:relative;';

    // 底图画布
    var baseC = document.createElement('canvas');
    baseC.style.cssText = 'display:block;';

    // 叠加层画布（覆盖在底图上）
    var overC = document.createElement('canvas');
    overC.style.cssText = 'position:absolute;top:0;left:0;display:block;';

    inner.appendChild(baseC);
    inner.appendChild(overC);
    cc.appendChild(inner);

    // 底部工具栏（固定）
    var tb = document.createElement('div');
    tb.style.cssText = 'position:absolute;bottom:0;left:0;right:0;height:50px;display:flex;align-items:center;justify-content:center;gap:4px;padding:0 8px;background:rgba(20,20,20,0.95);border-top:1px solid #333;';
    tb.innerHTML =
      '<button id="fsPen" onclick="fsSetTool(\'pen\')" style="width:32px;height:32px;background:#667eea;color:white;border:none;border-radius:50%;font-size:15px;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;flex-shrink:0;">✏️</button>' +
      '<button id="fsEra" onclick="fsSetTool(\'eraser\')" style="width:32px;height:32px;background:transparent;color:#ccc;border:none;border-radius:50%;font-size:15px;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;flex-shrink:0;">🧹</button>' +
      '<button id="fsMove" onclick="fsSetTool(\'move\')" title="移动" style="width:32px;height:32px;background:transparent;color:#ccc;border:none;border-radius:50%;font-size:15px;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;flex-shrink:0;">✋</button>' +
      '<span style="width:1px;height:22px;background:rgba(255,255,255,0.15);margin:0 3px;flex-shrink:0;"></span>' +
      '<div onclick="fsSetColor(\'#000000\')" class="fs-clr" data-color="#000000" style="width:22px;height:22px;border-radius:50%;background:#000;border:2px solid #667eea;cursor:pointer;flex-shrink:0;"></div>' +
      '<div onclick="fsSetColor(\'#3b82f6\')" class="fs-clr" data-color="#3b82f6" style="width:22px;height:22px;border-radius:50%;background:#3b82f6;border:2px solid rgba(255,255,255,0.3);cursor:pointer;flex-shrink:0;"></div>' +
      '<span style="width:1px;height:22px;background:rgba(255,255,255,0.15);margin:0 3px;flex-shrink:0;"></span>' +
      '<input type="range" id="fsLineWidth" min="1" max="10" value="' + _stuDrawLineWidth + '" oninput="fsSetWidth(this.value)" style="width:55px;height:18px;cursor:pointer;accent-color:#667eea;flex-shrink:0;">' +
      '<span style="width:1px;height:22px;background:rgba(255,255,255,0.15);margin:0 3px;flex-shrink:0;"></span>' +
      '<button onclick="fsZoom(1.4)" style="width:30px;height:30px;background:transparent;color:white;border:none;font-size:14px;cursor:pointer;flex-shrink:0;">🔍</button>' +
      '<button onclick="fsZoom(0.71)" style="width:30px;height:30px;background:transparent;color:white;border:none;font-size:12px;cursor:pointer;flex-shrink:0;">🔎</button>' +
      '<button onclick="fsResetZoom()" style="width:30px;height:30px;background:transparent;color:white;border:none;font-size:14px;cursor:pointer;flex-shrink:0;">↺</button>' +
      '<button onclick="fsClear()" style="width:30px;height:30px;background:#ef4444;color:white;border:none;border-radius:50%;font-size:12px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;">🗑</button>' +
      '<span style="width:1px;height:22px;background:rgba(255,255,255,0.15);margin:0 3px;flex-shrink:0;"></span>' +
      '<button onclick="exitStudentFullscreen()" style="padding:6px 10px;background:#6b7280;color:white;border:none;border-radius:6px;font-size:12px;font-weight:700;cursor:pointer;flex-shrink:0;white-space:nowrap;">退出</button>' +
      '<button onclick="fsSubmitAndExit()" style="padding:6px 10px;background:#22c55e;color:white;border:none;border-radius:6px;font-size:12px;font-weight:700;cursor:pointer;flex-shrink:0;white-space:nowrap;">提交</button>';

    el.appendChild(cc);
    el.appendChild(tb);
    document.body.appendChild(el);

    _stuFsOverlay = el;
    _stuFsCanvas = baseC;
    _stuFsOverlayCanvas = overC;
    _stuFsCtx = baseC.getContext('2d');
    _stuFsOverlayCtx = overC.getContext('2d');

    // 初始化全屏画布
    fsInitCanvas();

    // 同步普通画布已有的手写内容到全屏画布
    if (_stuOverlayCanvas && _stuOverlayCtx) {
      var hasContent = false;
      try {
        var data = _stuOverlayCtx.getImageData(0, 0, 1, 1).data;
        hasContent = data[0] !== 0 || data[1] !== 0 || data[2] !== 0 || data[3] !== 0;
      } catch(e) {}
      if (!hasContent) {
        // 检查更多像素
        try {
          var w = _stuOverlayCanvas.width, h = _stuOverlayCanvas.height;
          var sampleData = _stuOverlayCtx.getImageData(Math.floor(w/2), Math.floor(h/2), 1, 1).data;
          hasContent = sampleData[3] > 0;
        } catch(e) {}
      }
      if (hasContent) {
        if (_stuFsRotated) {
          // 旋转90° CW 同步到全屏画布
          var tmpC = document.createElement('canvas');
          tmpC.width = _stuFsCanvas.width;
          tmpC.height = _stuFsCanvas.height;
          var tmpCtx = tmpC.getContext('2d');
          tmpCtx.translate(tmpC.width / 2, tmpC.height / 2);
          tmpCtx.rotate(Math.PI / 2);
          tmpCtx.drawImage(_stuOverlayCanvas, -_stuOverlayCanvas.width / 2, -_stuOverlayCanvas.height / 2);
          _stuFsOverlayCtx.drawImage(tmpC, 0, 0, _stuFsCanvas.width, _stuFsCanvas.height);
        } else {
          _stuFsOverlayCtx.drawImage(_stuOverlayCanvas, 0, 0, _stuFsCanvas.width, _stuFsCanvas.height);
        }
      }
    }

    // 绑定事件到叠加层
    overC.addEventListener('mousedown', fsDown);
    overC.addEventListener('mousemove', fsMove);
    overC.addEventListener('mouseup', fsUp);
    overC.addEventListener('mouseleave', fsUp);
    overC.addEventListener('touchstart', fsTouchStart, { passive: false });
    overC.addEventListener('touchmove', fsTouchMove, { passive: false });
    overC.addEventListener('touchend', fsTouchEnd);
  };

  function fsInitCanvas() {
    var img = _stuImg;
    var screenW = window.innerWidth;
    var screenH = window.innerHeight - 50; // 减去工具栏高度

    // 判断是否需要旋转：横屏图片旋转90°铺满竖屏
    _stuFsRotated = (img.width > img.height);
    _stuFsZoom = 1;

    // 计算画布内部尺寸和显示尺寸
    var canvasW, canvasH, displayW, displayH;

    if (_stuFsRotated) {
      // 横屏图片：旋转90° CW，让图片长边沿屏幕长边
      // 画布内部尺寸 = 图片尺寸（不交换），绘制时旋转
      canvasW = img.width;
      canvasH = img.height;
      // 旋转后视觉尺寸：宽=img.height, 高=img.width
      // 按屏幕尺寸等比缩放，尽量铺满
      var scaleByW = screenW / img.height; // 视觉宽 = img.height
      var scaleByH = screenH / img.width;  // 视觉高 = img.width
      var scale = Math.min(scaleByW, scaleByH);
      displayW = Math.round(img.height * scale); // 视觉宽
      displayH = Math.round(img.width * scale);  // 视觉高
    } else {
      // 竖屏图片：正常放置，铺满屏幕宽度
      canvasW = img.width;
      canvasH = img.height;
      var scale = screenW / img.width;
      if (scale > 1) scale = 1;
      displayW = Math.round(img.width * scale);
      displayH = Math.round(img.height * scale);
    }

    _stuFsBaseW = canvasW;
    _stuFsBaseH = canvasH;

    // 设置 inner 容器尺寸
    var inner = document.getElementById('stuFsInner');
    if (inner) {
      inner.style.width = displayW + 'px';
      inner.style.height = displayH + 'px';
    }

    // 底图画布
    _stuFsCanvas.width = canvasW;
    _stuFsCanvas.height = canvasH;
    _stuFsCanvas.style.width = displayW + 'px';
    _stuFsCanvas.style.height = displayH + 'px';

    if (_stuFsRotated) {
      // 横屏图片：旋转90° CW 绘制
      _stuFsCtx.save();
      _stuFsCtx.translate(canvasW / 2, canvasH / 2);
      _stuFsCtx.rotate(Math.PI / 2);
      _stuFsCtx.drawImage(img, -canvasH / 2, -canvasW / 2, canvasH, canvasW);
      _stuFsCtx.restore();
    } else {
      _stuFsCtx.drawImage(img, 0, 0, canvasW, canvasH);
    }

    // 叠加层画布
    _stuFsOverlayCanvas.width = canvasW;
    _stuFsOverlayCanvas.height = canvasH;
    _stuFsOverlayCanvas.style.width = displayW + 'px';
    _stuFsOverlayCanvas.style.height = displayH + 'px';
    _stuFsOverlayCtx.clearRect(0, 0, canvasW, canvasH);
  }

  function fsGetPos(e) {
    var rect = _stuFsOverlayCanvas.getBoundingClientRect();
    var sx = e.clientX - rect.left; // screen X within displayed canvas
    var sy = e.clientY - rect.top;  // screen Y within displayed canvas

    if (_stuFsRotated) {
      // 90° CW rotation mapping:
      // canvas buffer is imgW x imgH, displayed as displayW x displayH
      // where displayW corresponds to imgH (rotated) and displayH to imgW
      var displayW = rect.width;
      var displayH = rect.height;
      var cw = _stuFsOverlayCanvas.width;  // = imgW
      var ch = _stuFsOverlayCanvas.height; // = imgH
      return {
        x: (cw / displayH) * sy,
        y: cw * (1 - sx / displayW)
      };
    } else {
      return {
        x: sx * (_stuFsOverlayCanvas.width / rect.width),
        y: sy * (_stuFsOverlayCanvas.height / rect.height)
      };
    }
  }

  function fsDown(e) {
    if (_stuFsDrawTool === 'move') return;
    _stuFsDrawing = true;
    var p = fsGetPos(e);
    _stuFsLastX = p.x; _stuFsLastY = p.y;
  }
  function fsMove(e) {
    if (_stuFsDrawTool === 'move' || !_stuFsDrawing) return;
    var p = fsGetPos(e);
    fsDrawLine(_stuFsLastX, _stuFsLastY, p.x, p.y);
    _stuFsLastX = p.x; _stuFsLastY = p.y;
  }
  function fsUp() { _stuFsDrawing = false; }

  function fsTouchStart(e) {
    if (_stuFsDrawTool === 'move') return; // 移动模式：不拦截触摸，让容器原生滚动
    e.preventDefault();
    var ts = Array.from(e.touches);
    if (ts.length === 2) {
      _stuFsPinchDist = Math.sqrt(Math.pow(ts[0].clientX-ts[1].clientX,2)+Math.pow(ts[0].clientY-ts[1].clientY,2));
      _stuFsPinchZoom = _stuFsZoom;
      _stuFsDrawing = false;
    } else if (ts.length === 1) {
      _stuFsDrawing = true;
      var p = fsGetPos({ clientX: ts[0].clientX, clientY: ts[0].clientY });
      _stuFsLastX = p.x; _stuFsLastY = p.y;
    }
  }
  function fsTouchMove(e) {
    if (_stuFsDrawTool === 'move') return; // 移动模式：不拦截触摸
    e.preventDefault();
    var ts = Array.from(e.touches);
    if (ts.length === 2) {
      var d = Math.sqrt(Math.pow(ts[0].clientX-ts[1].clientX,2)+Math.pow(ts[0].clientY-ts[1].clientY,2));
      var nz = _stuFsPinchZoom * (d / _stuFsPinchDist);
      if (nz >= 0.5 && nz <= 8) fsApplyZoom(nz);
    } else if (ts.length === 1 && _stuFsDrawing) {
      var p = fsGetPos({ clientX: ts[0].clientX, clientY: ts[0].clientY });
      fsDrawLine(_stuFsLastX, _stuFsLastY, p.x, p.y);
      _stuFsLastX = p.x; _stuFsLastY = p.y;
    }
  }
  function fsTouchEnd(e) {
    if (_stuFsDrawTool === 'move') return; // 移动模式：不拦截触摸
    if (e.touches.length === 0) { _stuFsDrawing = false; }
    else if (e.touches.length === 1) {
      _stuFsDrawing = true;
      var p = fsGetPos({ clientX: e.touches[0].clientX, clientY: e.touches[0].clientY });
      _stuFsLastX = p.x; _stuFsLastY = p.y;
    }
  }

  function fsDrawLine(x1, y1, x2, y2) {
    if (!_stuFsOverlayCtx) return;
    // 计算缩放比例（内部分辨率 / CSS显示尺寸）
    var scaleRatio = _stuFsOverlayCanvas.width / _stuFsOverlayCanvas.getBoundingClientRect().width;
    
    if (_stuFsDrawTool === 'eraser') {
      _stuFsOverlayCtx.globalCompositeOperation = 'destination-out';
      _stuFsOverlayCtx.beginPath();
      _stuFsOverlayCtx.moveTo(x1, y1);
      _stuFsOverlayCtx.lineTo(x2, y2);
      _stuFsOverlayCtx.strokeStyle = 'rgba(0,0,0,1)';
      _stuFsOverlayCtx.lineWidth = _stuDrawLineWidth * 5 * scaleRatio;
      _stuFsOverlayCtx.lineCap = 'round';
      _stuFsOverlayCtx.lineJoin = 'round';
      _stuFsOverlayCtx.stroke();
    } else {
      _stuFsOverlayCtx.globalCompositeOperation = 'source-over';
      _stuFsOverlayCtx.beginPath();
      _stuFsOverlayCtx.moveTo(x1, y1);
      _stuFsOverlayCtx.lineTo(x2, y2);
      _stuFsOverlayCtx.strokeStyle = _stuDrawColor;
      _stuFsOverlayCtx.lineWidth = _stuDrawLineWidth * 2 * scaleRatio;
      _stuFsOverlayCtx.lineCap = 'round';
      _stuFsOverlayCtx.lineJoin = 'round';
      _stuFsOverlayCtx.stroke();
    }
  }

  function fsApplyZoom(nz) {
    if (!_stuFsCanvas || !_stuFsOverlayCanvas || !_stuFsCtx || !_stuFsOverlayCtx || !_stuImg) return;
    _stuFsZoom = nz;

    // 计算新的CSS显示尺寸
    var displayW, displayH;
    if (_stuFsRotated) {
      // 旋转模式：从基准尺寸乘以新zoom
      var screenW = window.innerWidth;
      var screenH = window.innerHeight - 50;
      var scaleByW = screenW / _stuImg.height;
      var scaleByH = screenH / _stuImg.width;
      var baseScaleFactor = Math.min(scaleByW, scaleByH);
      displayW = Math.round(_stuImg.height * baseScaleFactor * nz);
      displayH = Math.round(_stuImg.width * baseScaleFactor * nz);
    } else {
      displayW = Math.round(window.innerWidth * nz);
      displayH = Math.round(_stuFsBaseH * (displayW / _stuFsBaseW));
    }

    var inner = document.getElementById('stuFsInner');
    if (inner) {
      inner.style.width = displayW + 'px';
      inner.style.height = displayH + 'px';
    }

    // 更新CSS显示尺寸（内部buffer不变，保证清晰度）
    _stuFsCanvas.style.width = displayW + 'px';
    _stuFsCanvas.style.height = displayH + 'px';
    _stuFsOverlayCanvas.style.width = displayW + 'px';
    _stuFsOverlayCanvas.style.height = displayH + 'px';
  }

  window.fsZoom = function(f) { var nz = _stuFsZoom * f; if (nz >= 0.5 && nz <= 8) fsApplyZoom(nz); };
  window.fsResetZoom = function() { fsApplyZoom(1); };
  window.fsClear = function() {
    if (!_stuFsOverlayCtx) return;
    _stuFsOverlayCtx.clearRect(0, 0, _stuFsOverlayCanvas.width, _stuFsOverlayCanvas.height);
  };
  window.fsSetTool = function(t) {
    _stuFsDrawTool = t;
    var pb = document.getElementById('fsPen'), eb = document.getElementById('fsEra'), mb = document.getElementById('fsMove');
    // Reset all
    if (pb) { pb.style.background='transparent'; pb.style.color='#ccc'; }
    if (eb) { eb.style.background='transparent'; eb.style.color='#ccc'; }
    if (mb) { mb.style.background='transparent'; mb.style.color='#ccc'; }
    // Highlight active
    if (t === 'pen' && pb) { pb.style.background='#667eea'; pb.style.color='white'; }
    else if (t === 'eraser' && eb) { eb.style.background='#667eea'; eb.style.color='white'; }
    else if (t === 'move' && mb) { mb.style.background='#667eea'; mb.style.color='white'; }
    // Move mode: disable overlay pointer-events so container handles scroll/pan
    if (_stuFsOverlayCanvas) {
      var sc = document.getElementById('stuFsScrollContainer');
      if (t === 'move') {
        _stuFsOverlayCanvas.style.pointerEvents = 'none';
        _stuFsOverlayCanvas.style.touchAction = 'auto';
        if (sc) { sc.style.touchAction = 'pan-x pan-y'; sc.style.cursor = 'grab'; }
      } else {
        _stuFsOverlayCanvas.style.pointerEvents = 'auto';
        _stuFsOverlayCanvas.style.touchAction = 'none';
        if (sc) { sc.style.touchAction = 'none'; sc.style.cursor = 'default'; }
      }
    }
  };
  window.fsSetColor = function(c) {
    _stuDrawColor = c;
    fsSetTool('pen');
    document.querySelectorAll('.fs-clr').forEach(function(b) {
      b.style.border = '2px solid ' + (b.getAttribute('data-color') === c ? '#667eea' : 'rgba(255,255,255,0.3)');
    });
  };
  window.fsSetWidth = function(w) { _stuDrawLineWidth = parseInt(w) || 3; };

  window.exitStudentFullscreen = function() {
    if (!_stuFullscreenActive) return;

    // 将全屏书写内容同步回普通画布
    if (_stuFsOverlayCanvas && _stuOverlayCanvas && _stuOverlayCtx && _stuImg) {
      _stuOverlayCtx.clearRect(0, 0, _stuOverlayCanvas.width, _stuOverlayCanvas.height);
      if (_stuFsRotated) {
        // 全屏画布内容是旋转过的，需要反向旋转90°（CCW）再缩放回普通画布尺寸
        var tempC = document.createElement('canvas');
        tempC.width = _stuOverlayCanvas.width;
        tempC.height = _stuOverlayCanvas.height;
        var tempCtx = tempC.getContext('2d');
        tempCtx.translate(tempC.width / 2, tempC.height / 2);
        tempCtx.rotate(-Math.PI / 2); // 反向旋转
        tempCtx.drawImage(_stuFsOverlayCanvas, -_stuFsOverlayCanvas.height / 2, -_stuFsOverlayCanvas.width / 2, _stuFsOverlayCanvas.height, _stuFsOverlayCanvas.width);
        _stuOverlayCtx.drawImage(tempC, 0, 0, _stuOverlayCanvas.width, _stuOverlayCanvas.height);
      } else {
        _stuOverlayCtx.drawImage(_stuFsOverlayCanvas, 0, 0, _stuOverlayCanvas.width, _stuOverlayCanvas.height);
      }
    }

    // 移除全屏层
    if (_stuFsOverlay && _stuFsOverlay.parentNode) {
      _stuFsOverlay.parentNode.removeChild(_stuFsOverlay);
    }
    _stuFullscreenActive = false;
    _stuFsOverlay = null; _stuFsCanvas = null; _stuFsOverlayCanvas = null;
    _stuFsCtx = null; _stuFsOverlayCtx = null;
    // 不自动提交，用户需要手动点击提交按钮
  };

  // 全屏提交并退出：先退出全屏（同步笔迹），然后提交
  window.fsSubmitAndExit = function() {
    var hwId = _stuFsHomeworkId;
    var stuId = _stuFsStudentId;
    // 先退出全屏（同步笔迹到普通画布）
    exitStudentFullscreen();
    // 然后提交
    if (hwId && stuId) {
      studentSubmitHomework(hwId, stuId);
    }
  };

  // 导出学生画布图像（包含底图+书写痕迹）- 导出原始尺寸
  function exportStudentCanvasImage() {
    if (!_stuCanvas || !_stuImg) return _studentUploadedImage || null;
    
    // 创建原始尺寸的画布
    var exportCanvas = document.createElement('canvas');
    exportCanvas.width = _stuImg.width;
    exportCanvas.height = _stuImg.height;
    var exportCtx = exportCanvas.getContext('2d');
    
    // 绘制原始底图（老师的题目图片）
    exportCtx.drawImage(_stuImg, 0, 0);
    
    // 将叠加层（书写痕迹）缩放到原始尺寸并叠加
    if (_stuOverlayCanvas) {
      exportCtx.drawImage(_stuOverlayCanvas, 0, 0, exportCanvas.width, exportCanvas.height);
    }
    
    var fmt = getImageFormat();
    return exportCanvas.toDataURL(fmt, 0.92);
  }

  // 从全屏画布导出图像（处理旋转情况）
  function exportFsCanvasImage() {
    if (!_stuFsCanvas || !_stuImg) return null;
    
    var exportCanvas = document.createElement('canvas');
    exportCanvas.width = _stuImg.width;
    exportCanvas.height = _stuImg.height;
    var exportCtx = exportCanvas.getContext('2d');
    
    // 绘制原始底图
    exportCtx.drawImage(_stuImg, 0, 0);
    
    // 叠加手写内容
    if (_stuFsOverlayCanvas) {
      if (_stuFsRotated) {
        // 反向旋转90°（CCW）还原到正常方向
        var tempC = document.createElement('canvas');
        tempC.width = _stuImg.width;
        tempC.height = _stuImg.height;
        var tempCtx = tempC.getContext('2d');
        tempCtx.translate(tempC.width / 2, tempC.height / 2);
        tempCtx.rotate(-Math.PI / 2);
        tempCtx.drawImage(_stuFsOverlayCanvas, -_stuFsOverlayCanvas.height / 2, -_stuFsOverlayCanvas.width / 2, _stuFsOverlayCanvas.height, _stuFsOverlayCanvas.width);
        exportCtx.drawImage(tempC, 0, 0);
      } else {
        exportCtx.drawImage(_stuFsOverlayCanvas, 0, 0, exportCanvas.width, exportCanvas.height);
      }
    }
    
    var fmt = getImageFormat();
    return exportCanvas.toDataURL(fmt, 0.92);
  }

  // 学生可选上传额外照片（答题纸）
  var _studentExtraImage = null;
  window.handleStudentExtraUpload = function(event) {
    var file = event.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function(e) {
      var preview = document.getElementById('studentExtraUploadPreview');
      if (preview) {
        preview.innerHTML = '<div style="font-size:12px;color:#6b7280;">⏳ 压缩中...</div>';
      }
      compressImage(e.target.result, 400, function(compressed) {
        _studentExtraImage = compressed;
        if (preview) {
          preview.innerHTML = '<img src="' + _studentExtraImage + '" style="max-width:100%;max-height:120px;border-radius:8px;">' +
            '<div style="font-size:11px;color:#22c55e;margin-top:3px;">✓ 已压缩 (~' + Math.round(compressed.length * 3 / 4 / 1024) + 'KB)</div>';
        }
      });
    };
    reader.readAsDataURL(file);
  };

  // 学生提交作业（直接在老师题目上书写后提交）
  window.studentSubmitHomework = function(homeworkId, studentId) {
    // 导出画布图像（老师题目+学生书写痕迹）
    var finalImage = exportStudentCanvasImage();
    
    // 如果没有画布内容（题目无图片），检查是否有额外上传的照片
    if (!finalImage && !_studentExtraImage) {
      showNotification('请在题目上书写答案或拍照上传', 'error');
      return;
    }
    
    // 如果有额外上传的照片，拼接在一起
    var submitImages = [finalImage];
    if (_studentExtraImage) {
      submitImages.push(_studentExtraImage);
    }
    
    // 合并所有图片（如果有额外的话）
    var imageToSubmit = submitImages.length === 1 ? submitImages[0] : null;
    
    function doSubmit(imageData) {
      // 检查图像大小，如果已经小于800KB则跳过压缩
      var estimatedSize = Math.round((imageData.length * 3) / 4);
      if (estimatedSize <= 800 * 1024) {
        // 已经足够小，直接使用
        submitToServer(imageData);
      } else {
        // 压缩最终图像到400KB（学生提交的答案，接收端会增强）
        compressImage(imageData, 400, function(compressedFinal) {
          submitToServer(compressedFinal);
        });
      }
    }
    
    async function submitToServer(imageData) {
      var subId = generateId();
      
      // 尝试上传到 Storage（失败则回退到 base64）
      showNotification('正在提交...', 'info');
      var ext = getImageExtension();
      var storagePath = 'sub/' + homeworkId + '/' + subId + ext;
      var imageUrl = await uploadImageToStorage(imageData, storagePath);
      var finalImageData = imageUrl || imageData;
      
      if (imageUrl) {
        console.log('[homework] 学生答案已上传到 Storage:', imageUrl);
      } else {
        console.log('[homework] Storage 上传失败，使用 base64 存储');
      }
      
      var student = getStudentById(studentId);
      var newSub = {
        id: subId,
        homeworkId: homeworkId,
        studentId: studentId,
        studentName: student ? student.name : (currentUser.studentName || ''),
        image: finalImageData,
        graded: false,
        grade: '',
        coins: 0,
        comment: '',
        gradedImage: null,
        submittedAt: new Date().toISOString()
      };
      
      homeworkSubmissions.push(newSub);
      saveData();
      _studentUploadedImage = null;
      _studentExtraImage = null;
      _stuCanvas = null;
      _stuCtx = null;
      _stuImg = null;
      
      // 同步到云端
      syncSubmissionToCloud(newSub);
      
      var msg = '作业已提交，等待老师批改';
      if (imageUrl) msg += ' (云端存储)';
      showNotification(msg, 'success');
      
      // 刷新页面
      setTimeout(function() {
        window.renderHomeworkPage();
      }, 500);
    }
    
    if (imageToSubmit) {
      doSubmit(imageToSubmit);
    } else {
      // 多张图片合并为一张（上下拼接）
      mergeImagesVertical(submitImages, function(merged) {
        doSubmit(merged);
      });
    }
  };
  
  // 垂直合并多张图片
  function mergeImagesVertical(imageUrls, callback) {
    var images = [];
    var loaded = 0;
    imageUrls.forEach(function(url, i) {
      var img = new Image();
      // 跨域图片需要设置 crossOrigin（Storage URL）
      if (isImageUrl(url)) {
        img.crossOrigin = 'anonymous';
      }
      img.onload = function() {
        images[i] = img;
        loaded++;
        if (loaded === imageUrls.length) {
          // 计算合并尺寸
          var maxW = 0;
          var totalH = 0;
          images.forEach(function(im) {
            if (im.width > maxW) maxW = im.width;
            totalH += im.height;
          });
          var mergeCanvas = document.createElement('canvas');
          mergeCanvas.width = maxW;
          mergeCanvas.height = totalH;
          var mergeCtx = mergeCanvas.getContext('2d');
          mergeCtx.fillStyle = '#ffffff';
          mergeCtx.fillRect(0, 0, maxW, totalH);
          var y = 0;
          images.forEach(function(im) {
            mergeCtx.drawImage(im, 0, y, im.width, im.height);
            y += im.height;
          });
          var fmt = getImageFormat();
          callback(mergeCanvas.toDataURL(fmt, 0.85));
        }
      };
      img.src = url;
    });
  }

  function renderHomeworkPageContent(container, students) {
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
  }

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
    var updates = [];
    var addCount = 0, removeCount = 0;
    Object.keys(_tierEditSelections).forEach(function(sid) {
      var action = _tierEditSelections[sid];
      if (action === 'add') {
        homeworkTiers[sid] = tier;
        updates.push({ student_id: parseInt(sid), tier: tier, action: 'add' });
        addCount++;
      } else if (action === 'remove') {
        delete homeworkTiers[sid];
        updates.push({ student_id: parseInt(sid), action: 'remove' });
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
    
    // 同步到云端
    if (updates.length > 0) {
      syncTiersToCloud(updates);
    }
    
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
      var upload = document.getElementById('hwImageUpload');
      if (upload) {
        upload.innerHTML = '<div style="color:#667eea;font-size:13px;">⏳ 压缩图片中...</div>';
      }
      // 压缩图片到600KB（题目图片，接收端会增强）
      compressImage(e.target.result, 600, function(compressed) {
        _currentHomeworkImage = compressed;
        if (upload) {
          upload.innerHTML = '<img src="' + _currentHomeworkImage + '" style="max-width:100%;max-height:200px;border-radius:8px;">' +
            '<div style="font-size:11px;color:#22c55e;margin-top:5px;">✓ 已压缩 (~' + Math.round(compressed.length * 3 / 4 / 1024) + 'KB)</div>';
          upload.style.borderStyle = 'solid';
          upload.style.padding = '10px';
        }
      });
    };
    reader.readAsDataURL(file);
  };

  window.publishHomework = async function() {
    var title = document.getElementById('hwTitle').value.trim();
    var tier = document.getElementById('hwTier').value;
    var desc = document.getElementById('hwDesc').value.trim();
    if (!title) { showNotification('请输入作业标题', 'error'); return; }
    if (!_currentHomeworkImage) { showNotification('请上传作业图片', 'error'); return; }
    
    // 查找该层级是否已有作业
    var existingHw = homeworkList.find(function(h) { return h.tier === tier; });
    if (existingHw) {
      var oldHwId = existingHw.id;
      showNotification('正在清理旧作业...', 'info');
      
      // 1. 删除旧作业的所有提交图片（Storage）
      var oldSubs = homeworkSubmissions.filter(function(s) { return s.homeworkId === oldHwId; });
      for (var i = 0; i < oldSubs.length; i++) {
        var sub = oldSubs[i];
        // 删除学生提交图片
        if (sub.image && isImageUrl(sub.image)) {
          var subPath = getStoragePathFromUrl(sub.image);
          if (subPath) await deleteImageFromStorage(subPath);
        }
        // 删除教师批阅图片
        if (sub.gradedImage && isImageUrl(sub.gradedImage)) {
          var gradedPath = getStoragePathFromUrl(sub.gradedImage);
          if (gradedPath) await deleteImageFromStorage(gradedPath);
        }
      }
      
      // 2. 删除旧作业图片（Storage）
      if (existingHw.image && isImageUrl(existingHw.image)) {
        var oldPath = getStoragePathFromUrl(existingHw.image);
        if (oldPath) await deleteImageFromStorage(oldPath);
      }
      
      // 3. 从云端删除旧作业及其提交记录
      await deleteHomeworkFromCloud(oldHwId);
      
      // 4. 本地清理
      homeworkList = homeworkList.filter(function(h) { return h.id !== oldHwId; });
      homeworkSubmissions = homeworkSubmissions.filter(function(s) { return s.homeworkId !== oldHwId; });
    }
    
    // 生成新作业 ID
    var newHwId = generateId();
    
    // 尝试上传到 Storage（失败则回退到 base64）
    showNotification('正在保存图片...', 'info');
    var ext = getImageExtension();
    var storagePath = 'hw/' + currentClassId + '/' + newHwId + ext;
    var imageUrl = await uploadImageToStorage(_currentHomeworkImage, storagePath);
    var finalImage = imageUrl || _currentHomeworkImage;
    
    if (imageUrl) {
      console.log('[homework] 题目图片已上传到 Storage:', imageUrl);
    } else {
      console.log('[homework] Storage 上传失败，使用 base64 存储');
    }
    
    // 发布新作业
    var newHw = {
      id: newHwId, title: title, tier: tier, description: desc,
      image: finalImage, createdAt: new Date().toISOString()
    };
    homeworkList.push(newHw);
    saveData();
    _currentHomeworkImage = null;
    
    var msg = '作业已发布';
    if (existingHw) {
      msg += '（已替换该层级的旧作业）';
    }
    if (imageUrl) {
      msg += ' (云端存储)';
    }
    showNotification(msg, 'success');
    
    // 同步到云端
    await syncHomeworkToCloud(newHw);
    
    renderHomeworkPage();
  };

  window.deleteHomework = async function(id) {
    if (!confirm('确定删除该作业？相关提交也会被删除。')) return;
    
    // 删除该作业的所有提交图片（Storage）
    var subs = homeworkSubmissions.filter(function(s) { return s.homeworkId === id; });
    for (var i = 0; i < subs.length; i++) {
      var sub = subs[i];
      if (sub.image && isImageUrl(sub.image)) {
        var subPath = getStoragePathFromUrl(sub.image);
        if (subPath) await deleteImageFromStorage(subPath);
      }
      if (sub.gradedImage && isImageUrl(sub.gradedImage)) {
        var gradedPath = getStoragePathFromUrl(sub.gradedImage);
        if (gradedPath) await deleteImageFromStorage(gradedPath);
      }
    }
    
    // 删除作业图片（Storage）
    var hw = homeworkList.find(function(h) { return h.id === id; });
    if (hw && hw.image && isImageUrl(hw.image)) {
      var hwPath = getStoragePathFromUrl(hw.image);
      if (hwPath) await deleteImageFromStorage(hwPath);
    }
    
    homeworkList = homeworkList.filter(function(h) { return h.id !== id; });
    homeworkSubmissions = homeworkSubmissions.filter(function(s) { return s.homeworkId !== id; });
    saveData();
    showNotification('已删除作业', 'info');
    
    // 删除云端作业（级联删除提交记录）
    await deleteHomeworkFromCloud(id);
    
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
      var upload = document.getElementById('submitImageUpload');
      if (upload) {
        upload.innerHTML = '<div style="color:#667eea;font-size:13px;">⏳ 压缩图片中...</div>';
      }
      // 压缩图片到400KB（教师代提交，接收端会增强）
      compressImage(e.target.result, 400, function(compressed) {
        _currentSubmitImage = compressed;
        if (upload) {
          upload.innerHTML = '<img src="' + _currentSubmitImage + '" style="max-width:100%;max-height:200px;border-radius:8px;">' +
            '<div style="font-size:11px;color:#22c55e;margin-top:5px;">✓ 已压缩 (~' + Math.round(compressed.length * 3 / 4 / 1024) + 'KB)</div>';
          upload.style.borderStyle = 'solid';
          upload.style.padding = '10px';
        }
      });
    };
    reader.readAsDataURL(file);
  };

  window.submitHomework = function() {
    if (!_currentSubmitImage) { showNotification('请先上传作业图片', 'error'); return; }
    var student = getStudentById(_currentSubmitStudentId);
    var newSub = {
      id: generateId(), homeworkId: _currentSubmitHomeworkId, studentId: _currentSubmitStudentId,
      studentName: student ? student.name : '',
      image: _currentSubmitImage, graded: false, grade: '', coins: 0, comment: '',
      gradedImage: null, submittedAt: new Date().toISOString()
    };
    homeworkSubmissions.push(newSub);
    saveData();
    closeModal();
    showNotification('作业已提交', 'success');
    
    // 同步到云端
    syncSubmissionToCloud(newSub);
    
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
    html += '<button id="toolMove" onclick="setDrawTool(\'move\')" title="移动图片" style="padding:6px 12px;background:#444;color:#ccc;border:none;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;">✋ 移动</button>';
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
    // 缩放按钮
    html += '<button onclick="zoomGradingCanvas(1.3)" style="padding:6px 10px;background:#3b82f6;color:white;border:none;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;">🔍+</button>';
    html += '<button onclick="zoomGradingCanvas(0.7)" style="padding:6px 10px;background:#3b82f6;color:white;border:none;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;">🔍-</button>';
    html += '<button onclick="resetGradingCanvasZoom()" style="padding:6px 10px;background:#6b7280;color:white;border:none;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;">↺</button>';
    html += '<span style="width:1px;height:24px;background:#444;margin:0 4px;"></span>';
    // 清除 & 撤销
    html += '<button onclick="clearCanvas()" style="padding:6px 12px;background:#ef4444;color:white;border:none;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;">🗑 清除</button>';
    html += '</div>';

    // 画布区域（双层：底图 + 透明叠加层用于批注）
    html += '<div id="canvasContainer" style="flex:1;overflow:auto;display:flex;align-items:center;justify-content:center;padding:10px;background:#2a2a3a;position:relative;-webkit-overflow-scrolling:touch;touch-action:none;">';
    html += '<div id="canvasZoomWrapper" style="position:relative;display:inline-block;">';
    html += '<canvas id="gradingCanvas" style="display:block;border-radius:8px;box-shadow:0 4px 20px rgba(0,0,0,0.5);cursor:crosshair;touch-action:none;pointer-events:none;"></canvas>';
    html += '<canvas id="gradingOverlayCanvas" style="position:absolute;top:0;left:0;display:block;border-radius:8px;cursor:crosshair;touch-action:none;pointer-events:auto;z-index:2;background:transparent;"></canvas>';
    html += '</div></div>';

    // 底部评分栏
    html += '<div id="gradingBottom" style="padding:10px 15px;background:#1a1a2e;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;flex-shrink:0;">';
    html += '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">';
    html += '<span style="color:#aaa;font-size:12px;font-weight:600;">评分:</span>';
    GRADE_OPTIONS.forEach(function(g) {
      var isCurrentGrade = sub.graded && sub.grade === g;
      html += '<button onclick="selectGradeAndSave(\'' + g + '\')" class="grade-btn" data-grade="' + g + '" style="padding:8px 14px;border:2px solid ' + (isCurrentGrade ? GRADE_COLORS[g] : '#444') + ';background:' + (isCurrentGrade ? GRADE_COLORS[g] : '#2a2a3a') + ';color:' + (isCurrentGrade ? 'white' : '#aaa') + ';border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;transition:all 0.15s;">' + g;
      html += '<span style="font-size:10px;display:block;color:' + (isCurrentGrade ? 'rgba(255,255,255,0.8)' : '#666') + ';">+' + GRADE_COINS[g] + '币</span></button>';
    });
    // 自定义金币输入
    html += '<span style="width:1px;height:24px;background:#444;margin:0 6px;"></span>';
    html += '<div style="display:flex;align-items:center;gap:4px;">';
    html += '<span style="color:#aaa;font-size:11px;">额外金币:</span>';
    html += '<input type="number" id="customCoinsInput" placeholder="0" value="0" style="width:60px;padding:6px 8px;background:#2a2a3a;border:1px solid #444;border-radius:6px;color:white;font-size:12px;text-align:center;" title="正数奖励，负数扣除">';
    html += '<span style="color:#666;font-size:10px;">(可负)</span>';
    html += '</div>';
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
    var overlayCanvas = document.getElementById('gradingOverlayCanvas');
    if (!canvas || !overlayCanvas) return;
    _gradeCanvas = canvas;
    _gradeCtx = canvas.getContext('2d');
    _gradeOverlayCanvas = overlayCanvas;
    _gradeOverlayCtx = overlayCanvas.getContext('2d');
    _gradeZoom = 1;

    // 先增强图片（锐化+对比度），让文字更清晰
    enhanceImageForDisplay(sub.image, function(enhancedImageUrl) {
      var img = new Image();
      img.onload = function() {
        _gradeImg = img;
        // 计算画布尺寸 - 限制最大宽度
        var maxW = Math.min(window.innerWidth - 40, 800);
        var scale = maxW / img.width;
        if (scale > 1) scale = 1;
        _canvasScale = scale;
        _gradeBaseWidth = Math.round(img.width * scale);
        _gradeBaseHeight = Math.round(img.height * scale);
        
        canvas.width = _gradeBaseWidth;
        canvas.height = _gradeBaseHeight;
        canvas.style.width = _gradeBaseWidth + 'px';
        canvas.style.height = _gradeBaseHeight + 'px';
        // 绘制增强后的底图
        _gradeCtx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        // 设置叠加层画布尺寸（透明）
        overlayCanvas.width = _gradeBaseWidth;
        overlayCanvas.height = _gradeBaseHeight;
        overlayCanvas.style.width = _gradeBaseWidth + 'px';
        overlayCanvas.style.height = _gradeBaseHeight + 'px';
        _gradeOverlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
        
        // 如果有已保存的批阅图层，叠加到叠加层
        if (sub.gradedImage) {
          var overlay2 = new Image();
          // 跨域图片需要设置 crossOrigin（Storage URL）
          if (isImageUrl(sub.gradedImage)) {
            overlay2.crossOrigin = 'anonymous';
          }
          overlay2.onload = function() {
            _gradeOverlayCtx.drawImage(overlay2, 0, 0, overlayCanvas.width, overlayCanvas.height);
            _markClean = false;
          };
          overlay2.src = sub.gradedImage;
        }
      };
      img.src = enhancedImageUrl;
    });

    // 绑定绘制事件到叠加层（而不是底图）
    overlayCanvas.addEventListener('mousedown', onCanvasDown);
    overlayCanvas.addEventListener('mousemove', onCanvasMove);
    overlayCanvas.addEventListener('mouseup', onCanvasUp);
    overlayCanvas.addEventListener('mouseleave', onCanvasUp);
    // 触摸事件（绑定到叠加层，支持双指缩放）
    overlayCanvas.addEventListener('touchstart', onGradingTouchStart, { passive: false });
    overlayCanvas.addEventListener('touchmove', onGradingTouchMove, { passive: false });
    overlayCanvas.addEventListener('touchend', onGradingTouchEnd);
  }

  var _markClean = true;
  var _undoStack = [];

  function saveCanvasState() {
    if (!_gradeOverlayCanvas) return;
    _undoStack.push(_gradeOverlayCanvas.toDataURL());
    if (_undoStack.length > 20) _undoStack.shift();
  }

  function getCanvasPos(e) {
    var rect = _gradeOverlayCanvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (_gradeOverlayCanvas.width / rect.width),
      y: (e.clientY - rect.top) * (_gradeOverlayCanvas.height / rect.height)
    };
  }

  function onCanvasDown(e) {
    if (_drawTool === 'move') return; // 移动模式：不拦截鼠标
    if (_drawTool === 'text') {
      var pos = getCanvasPos(e);
      var text = prompt('输入批注文字:');
      if (text && text.trim()) {
        saveCanvasState();
        _gradeOverlayCtx.font = 'bold ' + Math.max(16, _drawLineWidth * 5) + 'px sans-serif';
        _gradeOverlayCtx.fillStyle = _drawColor;
        _gradeOverlayCtx.fillText(text, pos.x, pos.y);
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
    if (_drawTool === 'move' || !_isDrawing) return; // 移动模式：不拦截鼠标
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
    onCanvasDown(mouseEvent);
  }

  function onCanvasTouchMove(e) {
    e.preventDefault();
    var touch = e.touches[0];
    var mouseEvent = new MouseEvent('mousemove', { clientX: touch.clientX, clientY: touch.clientY });
    onCanvasMove(mouseEvent);
  }

  // 批阅画布触摸事件 - 支持双指缩放
  function onGradingTouchStart(e) {
    if (_drawTool === 'move') return; // 移动模式：不拦截触摸
    e.preventDefault();
    _gradeTouches = Array.from(e.touches);
    
    if (_gradeTouches.length === 2) {
      // 双指 - 记录初始距离用于缩放
      _gradeInitialPinchDistance = getGradingTouchDistance(_gradeTouches[0], _gradeTouches[1]);
      _gradeInitialZoom = _gradeZoom;
      _isDrawing = false; // 双指时不绘制
    } else if (_gradeTouches.length === 1) {
      // 单指 - 开始绘制
      var touch = _gradeTouches[0];
      var mouseEvent = new MouseEvent('mousedown', { clientX: touch.clientX, clientY: touch.clientY });
      onCanvasDown(mouseEvent);
    }
  }

  function onGradingTouchMove(e) {
    if (_drawTool === 'move') return; // 移动模式：不拦截触摸
    e.preventDefault();
    var touches = Array.from(e.touches);
    
    if (touches.length === 2) {
      // 双指缩放
      var currentDistance = getGradingTouchDistance(touches[0], touches[1]);
      var zoomRatio = currentDistance / _gradeInitialPinchDistance;
      var newZoom = _gradeInitialZoom * zoomRatio;
      
      // 限制缩放范围 0.5x - 5x
      if (newZoom >= 0.5 && newZoom <= 5) {
        applyGradingZoom(newZoom);
      }
    } else if (touches.length === 1 && _isDrawing) {
      // 单指绘制
      var touch = touches[0];
      var mouseEvent = new MouseEvent('mousemove', { clientX: touch.clientX, clientY: touch.clientY });
      onCanvasMove(mouseEvent);
    }
  }

  function onGradingTouchEnd(e) {
    if (_drawTool === 'move') return; // 移动模式：不拦截触摸
    if (e.touches.length === 0) {
      _isDrawing = false;
      _gradeTouches = [];
    } else if (e.touches.length === 1) {
      // 从双指变为单指，重新开始绘制
      _isDrawing = true;
      var touch = e.touches[0];
      var pos = getCanvasPos({ clientX: touch.clientX, clientY: touch.clientY });
      _lastX = pos.x;
      _lastY = pos.y;
    }
  }

  function getGradingTouchDistance(t1, t2) {
    var dx = t1.clientX - t2.clientX;
    var dy = t1.clientY - t2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  // 应用批阅画布缩放
  function applyGradingZoom(newZoom) {
    if (!_gradeCanvas || !_gradeImg || !_gradeCtx || !_gradeOverlayCanvas) return;
    
    _gradeZoom = newZoom;
    var newWidth = Math.round(_gradeBaseWidth * _gradeZoom);
    var newHeight = Math.round(_gradeBaseHeight * _gradeZoom);
    
    // 保存底图当前内容
    var tempBaseCanvas = document.createElement('canvas');
    tempBaseCanvas.width = _gradeCanvas.width;
    tempBaseCanvas.height = _gradeCanvas.height;
    var tempBaseCtx = tempBaseCanvas.getContext('2d');
    tempBaseCtx.drawImage(_gradeCanvas, 0, 0);
    
    // 保存叠加层当前内容
    var tempOverlayCanvas = document.createElement('canvas');
    tempOverlayCanvas.width = _gradeOverlayCanvas.width;
    tempOverlayCanvas.height = _gradeOverlayCanvas.height;
    var tempOverlayCtx = tempOverlayCanvas.getContext('2d');
    tempOverlayCtx.drawImage(_gradeOverlayCanvas, 0, 0);
    
    // 调整两个画布尺寸（buffer + CSS）
    _gradeCanvas.width = newWidth;
    _gradeCanvas.height = newHeight;
    _gradeCanvas.style.width = newWidth + 'px';
    _gradeCanvas.style.height = newHeight + 'px';
    _gradeOverlayCanvas.width = newWidth;
    _gradeOverlayCanvas.height = newHeight;
    _gradeOverlayCanvas.style.width = newWidth + 'px';
    _gradeOverlayCanvas.style.height = newHeight + 'px';
    
    // 重新绘制（缩放图像）
    _gradeCtx.drawImage(tempBaseCanvas, 0, 0, newWidth, newHeight);
    _gradeOverlayCtx.drawImage(tempOverlayCanvas, 0, 0, newWidth, newHeight);
  }

  // 按钮缩放
  window.zoomGradingCanvas = function(factor) {
    var newZoom = _gradeZoom * factor;
    if (newZoom >= 0.5 && newZoom <= 5) {
      applyGradingZoom(newZoom);
    }
  };

  // 重置缩放
  window.resetGradingCanvasZoom = function() {
    applyGradingZoom(1);
  };

  function drawLine(x1, y1, x2, y2) {
    if (!_gradeOverlayCtx) return;
    
    if (_drawTool === 'eraser') {
      // 橡皮擦：使用 destination-out 只擦除叠加层上的内容，不影响底图
      _gradeOverlayCtx.globalCompositeOperation = 'destination-out';
      _gradeOverlayCtx.beginPath();
      _gradeOverlayCtx.moveTo(x1, y1);
      _gradeOverlayCtx.lineTo(x2, y2);
      _gradeOverlayCtx.strokeStyle = 'rgba(0,0,0,1)';
      _gradeOverlayCtx.lineWidth = _drawLineWidth * 4;
      _gradeOverlayCtx.lineCap = 'round';
      _gradeOverlayCtx.lineJoin = 'round';
      _gradeOverlayCtx.stroke();
      _gradeOverlayCtx.globalCompositeOperation = 'source-over'; // 恢复默认
    } else {
      // 画笔：正常绘制在叠加层上
      _gradeOverlayCtx.globalCompositeOperation = 'source-over';
      _gradeOverlayCtx.beginPath();
      _gradeOverlayCtx.moveTo(x1, y1);
      _gradeOverlayCtx.lineTo(x2, y2);
      _gradeOverlayCtx.strokeStyle = _drawColor;
      _gradeOverlayCtx.lineWidth = _drawLineWidth;
      _gradeOverlayCtx.lineCap = 'round';
      _gradeOverlayCtx.lineJoin = 'round';
      _gradeOverlayCtx.stroke();
    }
    _markClean = false;
  }

  window.setDrawTool = function(tool) {
    _drawTool = tool;
    var tools = ['Pen', 'Eraser', 'Text', 'Move'];
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
    // Move mode: disable overlay pointer-events so container handles scroll/pan
    if (_gradeOverlayCanvas) {
      if (tool === 'move') {
        _gradeOverlayCanvas.style.pointerEvents = 'none';
        _gradeOverlayCanvas.style.touchAction = 'auto';
        _gradeOverlayCanvas.style.cursor = 'default';
        var container = document.getElementById('canvasContainer');
        if (container) { container.style.cursor = 'grab'; container.style.touchAction = 'pan-x pan-y'; }
      } else {
        _gradeOverlayCanvas.style.pointerEvents = 'auto';
        _gradeOverlayCanvas.style.touchAction = 'none';
        _gradeOverlayCanvas.style.cursor = tool === 'text' ? 'text' : (tool === 'eraser' ? 'cell' : 'crosshair');
        var container = document.getElementById('canvasContainer');
        if (container) { container.style.cursor = 'default'; container.style.touchAction = 'none'; }
      }
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
    if (!_gradeOverlayCanvas) return;
    if (!confirm('确定清除所有批注？')) return;
    saveCanvasState();
    // 只清除叠加层（批注内容），底图保持不变
    _gradeOverlayCtx.clearRect(0, 0, _gradeOverlayCanvas.width, _gradeOverlayCanvas.height);
    _markClean = true;
  };

  window.closeGradingCanvas = function() {
    var overlay = document.getElementById('gradingOverlay');
    if (overlay) overlay.remove();
    _gradingSubId = null;
    _gradeCanvas = null;
    _gradeCtx = null;
    _gradeOverlayCanvas = null;
    _gradeOverlayCtx = null;
    _gradeImg = null;
    _gradeZoom = 1;
    _gradeBaseWidth = 0;
    _gradeBaseHeight = 0;
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
    // 在叠加层上打上等级标记
    if (_gradeOverlayCanvas && _gradeOverlayCtx) {
      var w = _gradeOverlayCanvas.width;
      var h = _gradeOverlayCanvas.height;
      // 画等级标签
      _gradeOverlayCtx.save();
      var tagW = 80 * _canvasScale, tagH = 36 * _canvasScale;
      var tagX = w - tagW - 10, tagY = 10;
      _gradeOverlayCtx.fillStyle = GRADE_COLORS[grade] || '#666';
      _gradeOverlayCtx.beginPath();
      _gradeOverlayCtx.roundRect(tagX, tagY, tagW, tagH, 8 * _canvasScale);
      _gradeOverlayCtx.fill();
      _gradeOverlayCtx.fillStyle = 'white';
      _gradeOverlayCtx.font = 'bold ' + (18 * _canvasScale) + 'px sans-serif';
      _gradeOverlayCtx.textAlign = 'center';
      _gradeOverlayCtx.textBaseline = 'middle';
      _gradeOverlayCtx.fillText(grade, tagX + tagW / 2, tagY + tagH / 2);
      _gradeOverlayCtx.restore();
    }
    // 自动保存
    _pendingGrade = grade;
  };

  var _pendingGrade = null;

  window.saveGradingImage = function() {
    if (!_gradingSubId || !_gradeCanvas || !_gradeOverlayCanvas) return;
    var sub = homeworkSubmissions.find(function(s) { return s.id === _gradingSubId; });
    if (!sub) return;

    // 创建完整画布：底图 + 批注层
    var annotCanvas = document.createElement('canvas');
    annotCanvas.width = _gradeCanvas.width;
    annotCanvas.height = _gradeCanvas.height;
    var annotCtx = annotCanvas.getContext('2d');
    
    // 绘制底图
    if (_gradeImg) {
      annotCtx.drawImage(_gradeImg, 0, 0, annotCanvas.width, annotCanvas.height);
    }
    
    // 在上面叠加批注层（透明叠加层的内容）
    annotCtx.drawImage(_gradeOverlayCanvas, 0, 0);
    
    var annotatedImage = annotCanvas.toDataURL('image/png');

    // 评分
    var grade = _pendingGrade || sub.grade || 'C';
    var baseCoins = GRADE_COINS[grade] || 10;
    
    // 读取自定义金币输入
    var customCoinsInput = document.getElementById('customCoinsInput');
    var customCoins = customCoinsInput ? parseInt(customCoinsInput.value) || 0 : 0;
    var coins = baseCoins + customCoins;
    
    // 确保金币不为负数（最少为0）
    if (coins < 0) coins = 0;
    
    var student = getStudentById(sub.studentId);

    // 压缩批阅后的图片到400KB（接收端会增强）
    compressImage(annotatedImage, 400, async function(compressedImage) {
      // 尝试上传到 Storage（失败则回退到 base64）
      var ext = getImageExtension();
      var storagePath = 'graded/' + sub.id + ext;
      var imageUrl = await uploadImageToStorage(compressedImage, storagePath);
      var finalGraded = imageUrl || compressedImage;
      
      if (imageUrl) {
        console.log('[homework] 批阅图片已上传到 Storage:', imageUrl);
      } else {
        console.log('[homework] Storage 上传失败，使用 base64 存储');
      }
      
      // 如果旧批阅图片是 Storage URL，删除它
      if (sub.gradedImage && isImageUrl(sub.gradedImage)) {
        var oldPath = getStoragePathFromUrl(sub.gradedImage);
        if (oldPath) deleteImageFromStorage(oldPath);
      }
      
      // 更新提交记录
      sub.graded = true;
      sub.grade = grade;
      sub.coins = coins;
      sub.customCoins = customCoins; // 保存自定义金币记录
      sub.gradedImage = finalGraded;
      sub.gradedAt = new Date().toISOString();

      // 发放金币
      if (student && typeof changeStudentCoins === 'function') {
        var oldCoins = sub._prevCoins || 0;
        var delta = coins - oldCoins;
        if (delta !== 0) {
          var reason = '评分' + grade;
          if (customCoins !== 0) {
            reason += (customCoins > 0 ? ' +奖励' + customCoins : ' -扣减' + Math.abs(customCoins));
          }
          changeStudentCoins(student, delta, '作业批改', reason, 0, null, {
            type: 'homework_grade', homeworkId: sub.homeworkId, grade: grade, customCoins: customCoins
          });
        }
        sub._prevCoins = coins;
      }

      saveData();
      _pendingGrade = null;

      // 同步到云端
      syncGradeToCloud(sub.id, finalGraded, grade, coins, sub.comment || '');

      // 关闭画布
      window.closeGradingCanvas();
      var coinMsg = coins >= 0 ? '+' + coins : coins;
      var customMsg = customCoins !== 0 ? ' (含自定义' + (customCoins > 0 ? '+' : '') + customCoins + ')' : '';
      var storageMsg = imageUrl ? ' (云端存储)' : '';
      showNotification('已批改: ' + grade + '，' + coinMsg + ' 金币' + customMsg + storageMsg, 'success');
      // 刷新列表
      if (typeof loadHomeworkSubmissions === 'function') {
        setTimeout(loadHomeworkSubmissions, 300);
      }
    });
  };

  // ========== 样式注入 ==========
  var style = document.createElement('style');
  style.textContent = '.hw-card{background:white;border-radius:16px;padding:20px;margin-bottom:15px;box-shadow:0 4px 20px rgba(0,0,0,0.1);}.hw-card-title{font-size:18px;font-weight:700;color:#333;margin-bottom:15px;display:flex;align-items:center;gap:8px;}.hw-form-group{margin-bottom:15px;}.hw-form-label{display:block;font-size:13px;font-weight:600;color:#555;margin-bottom:6px;}.hw-student-chip{display:inline-flex;align-items:center;gap:5px;padding:6px 12px;border-radius:20px;font-size:12px;font-weight:600;cursor:pointer;transition:all 0.2s;border:2px solid transparent;margin:3px;}.hw-student-chip.selected{border-color:#667eea;background:#e0e7ff;color:#4338ca;}.hw-student-chip.assigned{opacity:0.4;cursor:not-allowed;}.hw-btn{padding:10px 20px;border:none;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;transition:all 0.2s;}.hw-btn-primary{background:linear-gradient(135deg,#667eea,#764ba2);color:white;}.hw-btn-success{background:linear-gradient(135deg,#11998e,#38ef7d);color:white;}.hw-btn-danger{background:linear-gradient(135deg,#ef4444,#dc2626);color:white;}.hw-btn-secondary{background:#f1f3f5;color:#555;}';
  document.head.appendChild(style);

  console.log('[homework-system] 作业岛系统已加载 v294 - 强制刷新缓存 + 版本检查 + 级联删除');
})();
