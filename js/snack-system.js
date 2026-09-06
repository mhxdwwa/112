// ========== v120: 零食铺系统 ==========
const DEFAULT_SNACK_CONFIG = [
  { id: 'milk_tea', name: '奶茶', emoji: '🧋', price: 3, flavors: ['珍珠奶茶', '椰果奶茶', '红豆奶茶', '芋泥奶茶', '原味奶茶'] },
  { id: 'cola', name: '可乐', emoji: '🥤', price: 2, flavors: ['经典原味', '零度无糖', '香草味', '樱桃味'] },
  { id: 'chips', name: '薯片', emoji: '🍟', price: 2, flavors: ['原味', '番茄味', '烧烤味', '黄瓜味', '香辣味'] },
  { id: 'sprite', name: '雪碧', emoji: '🍋', price: 2, flavors: ['经典柠檬', '无糖雪碧', '薄荷味'] },
  { id: 'fanta', name: '芬达', emoji: '🍊', price: 2, flavors: ['橙味', '葡萄味', '苹果味', '草莓味'] },
  { id: 'candy', name: '糖果', emoji: '🍬', price: 1, flavors: ['水果糖', '牛奶糖', '薄荷糖', '棒棒糖'] },
  { id: 'chocolate', name: '巧克力', emoji: '🍫', price: 3, flavors: ['黑巧克力', '牛奶巧克力', '白巧克力', '榛子巧克力'] },
  { id: 'ice_cream', name: '冰淇淋', emoji: '🍦', price: 4, flavors: ['香草味', '巧克力味', '草莓味', '抹茶味', '芒果味'] },
  { id: 'cookie', name: '饼干', emoji: '🍪', price: 2, flavors: ['曲奇饼干', '巧克力饼干', '苏打饼干', '夹心饼干'] },
  { id: 'cake', name: '蛋糕', emoji: '🍰', price: 5, flavors: ['奶油蛋糕', '巧克力蛋糕', '草莓蛋糕', '芝士蛋糕'] },
  { id: 'donut', name: '甜甜圈', emoji: '🍩', price: 3, flavors: ['糖霜甜甜圈', '巧克力甜甜圈', '草莓甜甜圈'] },
  { id: 'popcorn', name: '爆米花', emoji: '🍿', price: 2, flavors: ['焦糖味', '奶油味', '巧克力味', '咸味'] },
  { id: 'juice', name: '果汁', emoji: '🧃', price: 2, flavors: ['橙汁', '苹果汁', '葡萄汁', '西瓜汁', '芒果汁'] },
  { id: 'bread', name: '面包', emoji: '🍞', price: 2, flavors: ['吐司面包', '菠萝包', '奶油面包', '肉松面包'] },
  { id: 'pizza', name: '披萨', emoji: '🍕', price: 5, flavors: ['芝士披萨', '培根披萨', '海鲜披萨', '蔬菜披萨'] },
  { id: 'hamburger', name: '汉堡', emoji: '🍔', price: 5, flavors: ['牛肉汉堡', '鸡腿汉堡', '鱼排汉堡', '素食汉堡'] },
  { id: 'hotdog', name: '热狗', emoji: '🌭', price: 3, flavors: ['经典热狗', '芝士热狗', '辣味热狗'] },
  { id: 'sandwich', name: '三明治', emoji: '🥪', price: 3, flavors: ['火腿三明治', '鸡蛋三明治', '金枪鱼三明治'] },
  { id: 'sushi', name: '寿司', emoji: '🍣', price: 5, flavors: ['三文鱼寿司', '金枪鱼寿司', '鳗鱼寿司', '卷寿司'] },
  { id: 'noodles', name: '方便面', emoji: '🍜', price: 2, flavors: ['红烧牛肉面', '酸菜牛肉面', '海鲜面', '炸酱面'] }
];
var _pendingSnackRequest = null;
var _snackShopSelectedStudentId = null;

// 获取当前班级的零食配置（支持自定义）
function getCurrentSnackConfig() {
  const curClass = classesData.find(c => c.id === currentClassId);
  if (curClass && curClass.customSnacks && curClass.customSnacks.length > 0) {
    return curClass.customSnacks;
  }
  return DEFAULT_SNACK_CONFIG;
}

// 保存自定义零食配置到当前班级
function saveCustomSnacks(snacks) {
  const curClass = classesData.find(c => c.id === currentClassId);
  if (!curClass) return;
  curClass.customSnacks = snacks;
  saveClassData();
}

function showSnackShopModal() {
  const curClass = classesData.find(c => c.id === currentClassId);
  if (!curClass) { showNotification('错误', '请先选择班级', 'error'); return; }
  
  // 教师账户：先选择学生
  if (typeof currentUser !== 'undefined' && currentUser && currentUser.type === 'teacher') {
    _snackShopSelectedStudentId = null;
    _renderSnackShopStudentSelect(curClass);
    return;
  }
  
  // 学生账户：直接显示零食
  _showSnackShopSnackGrid();
}

// 教师端：选择学生界面（类似重置密码）
function _renderSnackShopStudentSelect(curClass) {
  let html = '<div style="position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;" id="snackShopModal">';
  html += '<div style="background:#fff;border-radius:20px;padding:24px;width:1100px;max-width:95vw;height:650px;max-height:90vh;display:flex;flex-direction:column;box-shadow:0 12px 40px rgba(0,0,0,0.3);">';
  
  // Header
  html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">';
  html += '<div style="font-size:18px;font-weight:700;">🍭 零食铺 - 选择学生</div>';
  html += '<button onclick="closeSnackShopModal()" style="background:none;border:none;font-size:24px;cursor:pointer;color:#999;">×</button>';
  html += '</div>';
  
  // Description
  html += '<div style="font-size:13px;color:#888;margin-bottom:14px;">点击下方学生姓名选中后，即可点击「兑换零食」。点击「管理零食」可自定义零食种类。</div>';
  
  // Student list
  html += '<div style="display:flex;flex-wrap:wrap;gap:6px;flex:1;min-height:0;overflow-y:auto;border:1.5px solid rgba(255,210,200,0.6);border-radius:18px;padding:12px;margin-bottom:14px;background:#fffaf5;align-content:flex-start;">';
  curClass.students.forEach(function(stu) {
    var isSelected = _snackShopSelectedStudentId && _snackShopSelectedStudentId.toString() === stu.id.toString();
    var bgColor = isSelected ? '#e8ffe8' : '#fff';
    var borderColor = isSelected ? '#52c41a' : '#ffe2d6';
    html += '<div onclick="onSnackShopStudentClick(' + stu.id + ')" id="snackShopStu_' + stu.id + '" style="display:flex;align-items:center;padding:5px 10px;border:1.5px solid ' + borderColor + ';border-radius:12px;gap:6px;background:' + bgColor + ';font-size:14px;white-space:nowrap;cursor:pointer;transition:all 0.15s;">';
    if (isSelected) {
      html += '<span style="width:16px;height:16px;border-radius:50%;background:#52c41a;color:#fff;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:bold;flex-shrink:0;">✓</span>';
    } else {
      html += '<span style="width:16px;height:16px;border-radius:50%;border:1.5px solid #ddd;flex-shrink:0;"></span>';
    }
    html += '<span style="font-weight:600;">' + esc(stu.name || '未命名') + '</span>';
    html += '<span style="font-size:12px;color:#999;">💰' + (stu.coins || 0) + ' 🟠' + (stu.xiandan || 0) + '</span>';
    html += '</div>';
  });
  html += '</div>';
  
  // Bottom action area — always visible
  html += '<div id="snackShopActionWrap" style="margin-bottom:10px;text-align:center;">';
  if (_snackShopSelectedStudentId) {
    var selStudent = curClass.students.find(function(s) { return s.id.toString() === _snackShopSelectedStudentId.toString(); });
    if (selStudent) {
      html += '<div style="font-size:13px;color:#555;margin-bottom:8px;">已选中：<strong style="color:#d4760a;">' + esc(selStudent.name) + '</strong></div>';
    }
  } else {
    html += '<div style="font-size:13px;color:#999;margin-bottom:8px;">请先在上方点击选择一名学生，再进行兑换零食</div>';
  }
  html += '<div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">';
  if (_snackShopSelectedStudentId) {
    html += '<button onclick="confirmSnackShopStudent()" style="background:linear-gradient(135deg,#ff6b9d,#c06c84);color:#fff;border:none;border-radius:14px;padding:13px 36px;font-size:17px;font-weight:700;cursor:pointer;box-shadow:0 4px 14px rgba(255,107,157,0.4);transition:all 0.2s;flex:1;max-width:200px;" onmouseenter="this.style.transform=\'scale(1.02)\'" onmouseleave="this.style.transform=\'scale(1)\'">🍭 兑换零食</button>';
  } else {
    html += '<button disabled style="background:#ccc;color:#999;border:none;border-radius:14px;padding:13px 36px;font-size:17px;font-weight:700;cursor:not-allowed;flex:1;max-width:200px;opacity:0.7;">🍭 兑换零食</button>';
  }
  html += '<button onclick="showSnackManageModal()" style="background:linear-gradient(135deg,#9b59b6,#8e44ad);color:#fff;border:none;border-radius:14px;padding:13px 36px;font-size:17px;font-weight:700;cursor:pointer;flex:1;max-width:200px;">⚙️ 管理零食</button>';
  if (_snackShopSelectedStudentId) {
    html += '<button onclick="cancelSnackShopSelection()" style="background:#f0f0f0;color:#666;border:none;border-radius:14px;padding:13px 24px;font-size:15px;font-weight:700;cursor:pointer;flex:0;max-width:120px;">取消选择</button>';
  }
  html += '</div>';
  html += '</div>';
  
  // Close button
  html += '<div style="text-align:center;">';
  html += '<button onclick="closeSnackShopModal()" style="background:#f0f0f0;color:#666;border:none;border-radius:12px;padding:10px 28px;font-size:14px;font-weight:700;cursor:pointer;">关闭</button>';
  html += '</div>';
  html += '</div></div>';
  
  var container = document.getElementById('modalContainer');
  if (container) container.innerHTML = html;
}

window.onSnackShopStudentClick = function(studentId) {
  _snackShopSelectedStudentId = parseInt(studentId);
  const curClass = classesData.find(c => c.id === currentClassId);
  if (curClass) _renderSnackShopStudentSelect(curClass);
};

window.cancelSnackShopSelection = function() {
  _snackShopSelectedStudentId = null;
  const curClass = classesData.find(c => c.id === currentClassId);
  if (curClass) _renderSnackShopStudentSelect(curClass);
};

window.closeSnackShopModal = function() {
  var container = document.getElementById('modalContainer');
  if (container) container.innerHTML = '';
  _snackShopSelectedStudentId = null;
};

window.confirmSnackShopStudent = function() {
  if (!_snackShopSelectedStudentId) return;
  // Clear the custom student selection overlay before showing snack grid
  var container = document.getElementById('modalContainer');
  if (container) container.innerHTML = '';
  _showSnackShopSnackGrid();
};

// 显示零食选择网格
function _showSnackShopSnackGrid() {
  const snacks = getCurrentSnackConfig();
  let html = '<div style="max-height:60vh;overflow-y:auto;padding:10px 0;">';
  
  // 显示当前为哪个学生兑换（教师端）
  if (_snackShopSelectedStudentId) {
    const curClass = classesData.find(c => c.id === currentClassId);
    if (curClass) {
      const student = curClass.students.find(s => s.id.toString() === _snackShopSelectedStudentId.toString());
      if (student) {
        html += '<div style="text-align:center;margin-bottom:12px;padding:8px 16px;background:#e8f5e9;border-radius:10px;">';
        html += '<span style="font-size:13px;color:#2e7d32;">为 <strong>' + esc(student.name) + '</strong> 兑换零食</span>';
        html += '<span style="font-size:13px;color:#6a1b9a;margin-left:12px;">🟠 仙丹: <strong>' + (student.xiandan || 0) + '</strong></span>';
        html += '</div>';
      }
    }
  }
  
  html += '<div style="text-align:center;margin-bottom:15px;color:#666;font-size:14px;">选择你想要的零食吧！</div>';
  
  // Show student's own 仙丹 balance
  if (typeof currentUser !== 'undefined' && currentUser && currentUser.type === 'student') {
    const curClass = classesData.find(c => c.id === currentClassId);
    if (curClass) {
      const student = curClass.students.find(s => s.id.toString() === currentUser.studentId.toString());
      if (student) {
        html += '<div style="text-align:center;margin-bottom:12px;padding:6px 16px;background:#f3e5f5;border-radius:10px;">';
        html += '<span style="font-size:13px;color:#6a1b9a;">🟠 我的仙丹: <strong>' + (student.xiandan || 0) + '</strong></span>';
        html += '</div>';
      }
    }
  }
  
  html += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;">';
  snacks.forEach(snack => {
    const price = snack.price || 0;
    html += `<div onclick="selectSnack('${snack.id}')" style="display:flex;flex-direction:column;align-items:center;padding:12px 8px;background:linear-gradient(135deg,#fff5f8,#f0f8ff);border-radius:12px;cursor:pointer;transition:all 0.2s;border:2px solid transparent;" onmouseenter="this.style.borderColor='#ff6b9d';this.style.transform='translateY(-2px)'" onmouseleave="this.style.borderColor='transparent';this.style.transform='translateY(0)'">
      <div style="font-size:36px;margin-bottom:6px;">${snack.emoji}</div>
      <div style="font-size:13px;font-weight:600;color:#333;">${snack.name}</div>
      <div style="font-size:12px;color:#6a1b9a;margin-top:4px;font-weight:600;">🟠${price}</div>
    </div>`;
  });
  html += '</div></div>';
  
  const buttons = [{text:'关闭',onclick:'closeModal()'}];
  if (_snackShopSelectedStudentId) {
    buttons.unshift({text:'← 返回选择学生',onclick:'showSnackShopModal()'});
  }
  showModal('🍭 零食铺', html, buttons, false);
}

function selectSnack(snackId) {
  const snacks = getCurrentSnackConfig();
  const snack = snacks.find(s => s.id === snackId);
  if (!snack) return;
  _pendingSnackRequest = { snackId: snack.id, snackName: snack.name, snackEmoji: snack.emoji, snackPrice: snack.price || 0 };
  let html = '<div style="text-align:center;margin-bottom:15px;">';
  html += `<div style="font-size:48px;margin-bottom:8px;">${snack.emoji}</div>`;
  html += `<div style="font-size:18px;font-weight:700;color:#333;">${snack.name}</div>`;
  html += '<div style="margin-top:12px;color:#666;font-size:14px;">选择口味：</div>';
  html += '</div>';
  html += '<div style="display:flex;flex-direction:column;gap:10px;">';
  snack.flavors.forEach(flavor => {
    html += `<div onclick="selectSnackFlavor('${flavor}')" style="padding:14px 18px;background:#fff;border-radius:12px;cursor:pointer;transition:all 0.2s;border:2px solid #f0f0f0;text-align:center;font-size:15px;font-weight:600;color:#333;" onmouseenter="this.style.borderColor='#ff6b9d';this.style.background='#fff5f8'" onmouseleave="this.style.borderColor='#f0f0f0';this.style.background='#fff'">${flavor}</div>`;
  });
  html += '</div>';
  showModal(`🍭 ${snack.name} - 选择口味`, html, [
    {text:'返回',onclick:'_showSnackShopSnackGrid()'},
    {text:'取消',onclick:'closeModal()'}
  ], false);
}

function selectSnackFlavor(flavor) {
  if (!_pendingSnackRequest) return;
  _pendingSnackRequest.flavor = flavor;
  let html = '<div style="text-align:center;padding:20px 0;">';
  html += `<div style="font-size:56px;margin-bottom:12px;">${_pendingSnackRequest.snackEmoji}</div>`;
  html += `<div style="font-size:18px;font-weight:700;color:#333;margin-bottom:8px;">${_pendingSnackRequest.snackName}</div>`;
  html += `<div style="font-size:16px;color:#666;margin-bottom:8px;">口味：${flavor}</div>`;
  html += `<div style="font-size:15px;color:#6a1b9a;font-weight:700;margin-bottom:12px;">🟠 价格: ${_pendingSnackRequest.snackPrice} 仙丹</div>`;
  html += '<div style="background:#fff3e0;padding:12px;border-radius:10px;margin:15px 0;">';
  html += '<div style="font-size:13px;color:#e65100;font-weight:600;margin-bottom:6px;">📋 兑换说明</div>';
  html += '<div style="font-size:13px;color:#666;line-height:1.6;">提交后，教师将收到兑换请求通知。<br>教师同意后即可兑换成功。</div>';
  html += '</div>';
  html += '</div>';
  showModal('🍭 确认兑换', html, [
    {text:'返回',onclick:`selectSnack('${_pendingSnackRequest.snackId}')`},
    {text:'取消',onclick:'closeModal()'},
    {text:'提交兑换',onclick:'submitSnackRequest()',style:'background:linear-gradient(135deg,#ff6b9d,#c06c84);'}
  ], false);
}

function submitSnackRequest() {
  if (!_pendingSnackRequest) return;
  const curClass = classesData.find(c => c.id === currentClassId);
  if (!curClass) { showNotification('错误', '请先选择班级', 'error'); return; }
  
  // Get student
  let student = null;
  if (_snackShopSelectedStudentId) {
    // 教师端：使用选中的学生
    student = curClass.students.find(s => s.id.toString() === _snackShopSelectedStudentId.toString());
  } else if (typeof currentUser !== 'undefined' && currentUser && currentUser.type === 'student') {
    // 学生端：使用当前登录的学生
    student = curClass.students.find(s => s.id.toString() === currentUser.studentId.toString());
  }
  if (!student) { showNotification('错误', '未找到学生信息', 'error'); return; }
  
  // Check 仙丹 balance
  const snackPrice = _pendingSnackRequest.snackPrice || 0;
  const currentXd = student.xiandan || 0;
  if (snackPrice > 0 && currentXd < snackPrice) {
    showNotification('仙丹不足', `兑换需要 ${snackPrice} 仙丹，当前只有 ${currentXd} 仙丹`, 'error');
    return;
  }
  
  // Initialize snackRequests array if not exists
  if (!student.snackRequests) student.snackRequests = [];
  
  // Create request
  const request = {
    id: _genLocalId(),
    timestamp: new Date().toISOString(),
    snackId: _pendingSnackRequest.snackId,
    snackName: _pendingSnackRequest.snackName,
    snackEmoji: _pendingSnackRequest.snackEmoji,
    snackPrice: snackPrice,
    flavor: _pendingSnackRequest.flavor,
    studentId: student.id,
    studentName: student.name,
    status: 'pending', // pending, approved, rejected
    approvedAt: null,
    rejectedAt: null
  };
  
  // Deduct 仙丹
  if (snackPrice > 0) {
    student.xiandan = (student.xiandan || 0) - snackPrice;
    // v145: API 模式 — 同步仙丹变化到服务器
    if (window.USE_API && window.ApiMigration) {
      window.ApiMigration.updateStudent(student.id, { xiandan: student.xiandan });
      if (typeof _myBaseXiandan !== 'undefined') _myBaseXiandan = student.xiandan;
    }
  }
  
  student.snackRequests.push(request);
  saveClassData();
  if (typeof scheduleAllRenders === 'function') scheduleAllRenders();
  
  // v183: API 模式 — 同步 snackRequests 到服务器，确保教师在其他设备能看到兑换请求
  if (window.USE_API && window.ApiMigration) {
    window.ApiMigration.updateStudent(student.id, { snack_requests: student.snackRequests });
  }
  
  // Record to history
  const log = {
    id: _genLocalId(),
    timestamp: new Date().toISOString(),
    classId: currentClassId,
    studentId: student.id,
    studentName: student.name,
    actionType: '零食兑换',
    details: `申请兑换 ${_pendingSnackRequest.snackEmoji} ${_pendingSnackRequest.snackName}（${_pendingSnackRequest.flavor}）🟠-${snackPrice}`,
    coinDelta: 0,
    expDelta: 0,
    petId: null,
    extra: {
      snackRequestId: request.id,
      snackName: _pendingSnackRequest.snackName,
      snackEmoji: _pendingSnackRequest.snackEmoji,
      snackPrice: snackPrice,
      flavor: _pendingSnackRequest.flavor,
      status: 'pending'
    },
    snapshot: null,
    reverted: false,
    _synced: false
  };
  window.operationLogs.push(log);
  saveLogs();
  
  _pendingSnackRequest = null;
  closeModal();
  showNotification('提交成功', '兑换请求已提交，等待教师审批', 'success');
}

// 教师端：显示零食兑换请求
function showSnackRequestsModal() {
  if (!currentUser || currentUser.type !== 'teacher') {
    showNotification('无权限', '仅教师可查看', 'warning');
    return;
  }
  const curClass = classesData.find(c => c.id === currentClassId);
  if (!curClass) { showNotification('错误', '请先选择班级', 'error'); return; }
  
  // Collect all pending requests
  const allRequests = [];
  curClass.students.forEach(student => {
    if (student.snackRequests) {
      student.snackRequests.forEach(req => {
        allRequests.push({ ...req, studentName: student.name });
      });
    }
  });
  
  // Sort by timestamp (newest first)
  allRequests.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  
  const pendingRequests = allRequests.filter(r => r.status === 'pending');
  const processedRequests = allRequests.filter(r => r.status !== 'pending').slice(0, 20);
  
  let html = '<div style="max-height:60vh;overflow-y:auto;padding:10px 0;">';
  
  // Pending requests
  if (pendingRequests.length > 0) {
    html += '<div style="font-size:15px;font-weight:700;color:#e65100;margin-bottom:12px;padding:0 10px;">⏳ 待审批 (' + pendingRequests.length + ')</div>';
    pendingRequests.forEach(req => {
      const time = new Date(req.timestamp).toLocaleString('zh-CN', {month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});
      html += `<div style="display:flex;align-items:center;gap:12px;padding:14px;margin-bottom:10px;background:linear-gradient(135deg,#fff8e1,#fff3e0);border-radius:12px;border:2px solid #ffe0b2;">
        <div style="font-size:36px;">${req.snackEmoji}</div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:14px;font-weight:600;color:#333;">${esc(req.studentName)}</div>
          <div style="font-size:13px;color:#666;margin-top:2px;">${esc(req.snackName)} · ${esc(req.flavor)}</div>
          <div style="font-size:11px;color:#999;margin-top:2px;">${time}${req.snackPrice ? ' · 🟠' + req.snackPrice + '仙丹' : ''}</div>
        </div>
        <div style="display:flex;gap:8px;">
          <button onclick="approveSnackRequest(${req.id})" style="padding:8px 14px;background:#4caf50;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;">同意</button>
          <button onclick="rejectSnackRequest(${req.id})" style="padding:8px 14px;background:#f44336;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;">拒绝</button>
        </div>
      </div>`;
    });
  } else {
    html += '<div style="text-align:center;padding:30px;color:#999;">暂无待审批请求</div>';
  }
  
  // Processed requests (recent)
  if (processedRequests.length > 0) {
    html += '<div style="font-size:14px;font-weight:600;color:#666;margin:20px 10px 10px;padding-top:15px;border-top:1px solid #eee;">📋 最近处理</div>';
    processedRequests.forEach(req => {
      const time = new Date(req.approvedAt || req.rejectedAt).toLocaleString('zh-CN', {month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});
      const statusBadge = req.status === 'approved' 
        ? '<span style="background:#4caf50;color:#fff;padding:2px 8px;border-radius:6px;font-size:11px;">已同意</span>'
        : '<span style="background:#f44336;color:#fff;padding:2px 8px;border-radius:6px;font-size:11px;">已拒绝</span>';
      html += `<div style="display:flex;align-items:center;gap:10px;padding:10px;margin-bottom:6px;background:#f9f9f9;border-radius:10px;opacity:0.7;">
        <div style="font-size:24px;">${req.snackEmoji}</div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:13px;color:#333;">${esc(req.studentName)} · ${esc(req.snackName)} · ${esc(req.flavor)}</div>
          <div style="font-size:11px;color:#999;margin-top:2px;">${time}</div>
        </div>
        ${statusBadge}
      </div>`;
    });
  }
  
  html += '</div>';
  showModal('🍭 零食兑换审批', html, [{text:'关闭',onclick:'closeModal()'}], false);
}

function approveSnackRequest(requestId) {
  const curClass = classesData.find(c => c.id === currentClassId);
  if (!curClass) return;
  
  let request = null;
  let student = null;
  
  for (const s of curClass.students) {
    if (s.snackRequests) {
      const req = s.snackRequests.find(r => r.id === requestId);
      if (req) {
        request = req;
        student = s;
        break;
      }
    }
  }
  
  if (!request || !student) {
    showNotification('错误', '未找到该请求', 'error');
    return;
  }
  
  if (request.status !== 'pending') {
    showNotification('提示', '该请求已处理', 'info');
    return;
  }
  
  request.status = 'approved';
  request.approvedAt = new Date().toISOString();
  
  // Update history log
  const logs = window.operationLogs || [];
  const log = logs.find(l => l.extra && l.extra.snackRequestId === requestId);
  if (log) {
    log.extra.status = 'approved';
    log.extra.approvedAt = request.approvedAt;
    saveLogs();
  }
  
  // v145: API 模式 — 通过服务端 API 同步审批结果
  if (window.USE_API && window.ApiMigration) {
    window.ApiMigration.approveSnack({
      studentId: student.id,
      requestId: request.id,
      approved: true,
      snackIndex: request.snackId,
      xiandanDelta: 0  // 仙丹已在申请时扣除，审批不退还
    });
  }
  
  saveClassData();
  if (typeof scheduleAllRenders === 'function') scheduleAllRenders();
  _updateSnackRequestBadge(); // 立即更新徽章
  showSnackRequestsModal(); // Refresh modal
  showNotification('兑换成功', `已同意 ${student.name} 的 ${request.snackEmoji} ${request.snackName} 兑换`, 'success');
}

function rejectSnackRequest(requestId) {
  const curClass = classesData.find(c => c.id === currentClassId);
  if (!curClass) return;
  
  let request = null;
  let student = null;
  
  for (const s of curClass.students) {
    if (s.snackRequests) {
      const req = s.snackRequests.find(r => r.id === requestId);
      if (req) {
        request = req;
        student = s;
        break;
      }
    }
  }
  
  if (!request || !student) {
    showNotification('错误', '未找到该请求', 'error');
    return;
  }
  
  if (request.status !== 'pending') {
    showNotification('提示', '该请求已处理', 'info');
    return;
  }
  
  request.status = 'rejected';
  request.rejectedAt = new Date().toISOString();
  
  // Refund 仙丹
  if (request.snackPrice && request.snackPrice > 0) {
    student.xiandan = (student.xiandan || 0) + request.snackPrice;
  }
  
  // Update history log
  const logs = window.operationLogs || [];
  const log = logs.find(l => l.extra && l.extra.snackRequestId === requestId);
  if (log) {
    log.extra.status = 'rejected';
    log.extra.rejectedAt = request.rejectedAt;
    saveLogs();
  }
  
  // v145: API 模式 — 通过服务端 API 同步拒绝结果和仙丹退还
  if (window.USE_API && window.ApiMigration) {
    window.ApiMigration.approveSnack({
      studentId: student.id,
      requestId: request.id,
      approved: false,
      snackIndex: request.snackId,
      xiandanDelta: request.snackPrice || 0  // 退还仙丹
    });
  }
  
  saveClassData();
  if (typeof scheduleAllRenders === 'function') scheduleAllRenders();
  _updateSnackRequestBadge(); // 立即更新徽章
  showSnackRequestsModal(); // Refresh modal
  const refundMsg = (request.snackPrice && request.snackPrice > 0) ? `，已退还 ${request.snackPrice} 仙丹` : '';
  showNotification('已拒绝', `已拒绝 ${student.name} 的 ${request.snackEmoji} ${request.snackName} 兑换${refundMsg}`, 'info');
}

// 获取待审批零食请求数量（用于教师通知）
function getPendingSnackRequestCount() {
  const curClass = classesData.find(c => c.id === currentClassId);
  if (!curClass) return 0;
  let count = 0;
  curClass.students.forEach(student => {
    if (student.snackRequests) {
      count += student.snackRequests.filter(r => r.status === 'pending').length;
    }
  });
  return count;
}

// ========== v125: 学生端零食审批状态查询 ==========
// v136: 持久化到 localStorage，避免每次登录都显示未读
var _snackStatusLastReadTime = (function() {
  try {
    var saved = localStorage.getItem('snackStatusLastReadTime');
    return saved ? parseInt(saved) : 0;
  } catch(e) { return 0; }
})();

// 显示学生自己的零食审批状态
function showSnackStatusModal() {
  if (typeof currentUser === 'undefined' || !currentUser || currentUser.type !== 'student') {
    showNotification('提示', '仅学生可查看审批状态', 'info');
    return;
  }
  
  const curClass = classesData.find(c => c.id === currentClassId);
  if (!curClass) { showNotification('错误', '请先选择班级', 'error'); return; }
  
  // 找到当前学生
  const student = curClass.students.find(s => s.id.toString() === currentUser.studentId.toString());
  if (!student) { showNotification('错误', '未找到学生信息', 'error'); return; }
  
  // 标记为已读
  _snackStatusLastReadTime = Date.now();
  try { localStorage.setItem('snackStatusLastReadTime', _snackStatusLastReadTime.toString()); } catch(e) {}
  _updateSnackStatusBadge();
  
  const requests = student.snackRequests || [];
  
  let html = '<div style="max-height:60vh;overflow-y:auto;padding:10px 0;">';
  
  if (requests.length === 0) {
    html += '<div style="text-align:center;padding:40px;color:#999;">';
    html += '<div style="font-size:48px;margin-bottom:12px;">📋</div>';
    html += '<div>暂无零食兑换记录</div>';
    html += '</div>';
  } else {
    // 按时间倒序排列
    const sortedRequests = [...requests].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    sortedRequests.forEach(req => {
      const time = new Date(req.timestamp).toLocaleString('zh-CN', {month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});
      let statusHtml = '';
      let statusBg = '';
      
      if (req.status === 'pending') {
        statusHtml = '<span style="background:#ff9800;color:#fff;padding:4px 12px;border-radius:8px;font-size:12px;font-weight:600;">⏳ 未审核</span>';
        statusBg = 'linear-gradient(135deg,#fff8e1,#fff3e0)';
      } else if (req.status === 'approved') {
        const approvedTime = req.approvedAt ? new Date(req.approvedAt).toLocaleString('zh-CN', {month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}) : '';
        statusHtml = '<span style="background:#4caf50;color:#fff;padding:4px 12px;border-radius:8px;font-size:12px;font-weight:600;">✓ 已通过</span>';
        statusBg = 'linear-gradient(135deg,#e8f5e9,#c8e6c9)';
        if (approvedTime) {
          statusHtml += '<div style="font-size:11px;color:#666;margin-top:4px;">审批时间：' + approvedTime + '</div>';
        }
      } else if (req.status === 'rejected') {
        const rejectedTime = req.rejectedAt ? new Date(req.rejectedAt).toLocaleString('zh-CN', {month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}) : '';
        statusHtml = '<span style="background:#f44336;color:#fff;padding:4px 12px;border-radius:8px;font-size:12px;font-weight:600;">✗ 未通过</span>';
        statusBg = 'linear-gradient(135deg,#ffebee,#ffcdd2)';
        if (rejectedTime) {
          statusHtml += '<div style="font-size:11px;color:#666;margin-top:4px;">审批时间：' + rejectedTime + '</div>';
        }
      }
      
      html += `<div style="display:flex;align-items:center;gap:12px;padding:14px;margin-bottom:10px;background:${statusBg};border-radius:12px;border:2px solid rgba(0,0,0,0.05);">`;
      html += `<div style="font-size:36px;">${req.snackEmoji}</div>`;
      html += `<div style="flex:1;min-width:0;">`;
      html += `<div style="font-size:14px;font-weight:600;color:#333;">${esc(req.snackName)}${req.snackPrice ? ' <span style="font-size:12px;color:#6a1b9a;">🟠' + req.snackPrice + '</span>' : ''}</div>`;
      html += `<div style="font-size:13px;color:#666;margin-top:2px;">${esc(req.flavor)}</div>`;
      html += `<div style="font-size:11px;color:#999;margin-top:2px;">申请时间：${time}</div>`;
      html += `</div>`;
      html += `<div style="text-align:right;">${statusHtml}</div>`;
      html += `</div>`;
    });
  }
  
  html += '</div>';
  showModal('📋 零食审批状态', html, [{text:'关闭',onclick:'closeModal()'}], false);
}

// 更新学生端审批状态按钮的红点提示
function _updateSnackStatusBadge() {
  const badge = document.getElementById('snackStatusBadge');
  if (!badge) return;
  
  // 仅学生账户显示
  if (typeof currentUser === 'undefined' || !currentUser || currentUser.type !== 'student') {
    badge.style.display = 'none';
    return;
  }
  
  const curClass = classesData.find(c => c.id === currentClassId);
  if (!curClass) {
    badge.style.display = 'none';
    return;
  }
  
  const student = curClass.students.find(s => s.id.toString() === currentUser.studentId.toString());
  if (!student || !student.snackRequests) {
    badge.style.display = 'none';
    return;
  }
  
  // 统计未读的通知数量（状态从 pending 变为 approved/rejected 且时间晚于上次查看时间）
  let unreadCount = 0;
  student.snackRequests.forEach(req => {
    if (req.status === 'approved' || req.status === 'rejected') {
      const statusTime = req.status === 'approved' ? req.approvedAt : req.rejectedAt;
      if (statusTime) {
        const statusTimestamp = new Date(statusTime).getTime();
        if (statusTimestamp > _snackStatusLastReadTime) {
          unreadCount++;
        }
      }
    }
  });
  
  if (unreadCount > 0) {
    badge.style.display = 'inline-block';
    badge.textContent = unreadCount;
  } else {
    badge.style.display = 'none';
  }
}

// 初始化学生端审批状态按钮显示
function _initSnackStatusButton() {
  const btn = document.getElementById('snackStatusBtn');
  if (!btn) return;
  
  if (typeof currentUser !== 'undefined' && currentUser && currentUser.type === 'student') {
    btn.style.display = 'inline-flex';
    _updateSnackStatusBadge();
  } else {
    btn.style.display = 'none';
  }
}

// ========== 零食管理功能（教师端）==========
function showSnackManageModal() {
  if (!currentUser || currentUser.type !== 'teacher') {
    showNotification('无权限', '仅教师可管理零食', 'warning');
    return;
  }
  // Clear any custom overlay (e.g. student selection) before showing manage modal
  var container = document.getElementById('modalContainer');
  if (container) container.innerHTML = '';
  const snacks = getCurrentSnackConfig();
  let html = '<div style="max-height:60vh;overflow-y:auto;padding:10px 0;">';
  html += '<div style="text-align:center;margin-bottom:15px;color:#666;font-size:14px;">管理零食种类（仅对当前班级生效）</div>';
  
  // 零食列表
  html += '<div style="display:flex;flex-direction:column;gap:10px;margin-bottom:15px;">';
  snacks.forEach((snack, index) => {
    const price = snack.price || 0;
    html += `<div style="display:flex;align-items:center;gap:12px;padding:12px;background:#fff;border-radius:12px;border:1px solid #eee;">
      <div style="font-size:32px;">${snack.emoji}</div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:14px;font-weight:600;color:#333;">${esc(snack.name)} <span style="font-size:12px;color:#6a1b9a;font-weight:700;">🟠${price}仙丹</span></div>
        <div style="font-size:12px;color:#999;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(snack.flavors.join('、'))}</div>
      </div>
      <div style="display:flex;gap:6px;">
        <button onclick="editSnack(${index})" style="padding:6px 12px;background:#2196f3;color:#fff;border:none;border-radius:6px;font-size:12px;cursor:pointer;">编辑</button>
        <button onclick="deleteSnack(${index})" style="padding:6px 12px;background:#f44336;color:#fff;border:none;border-radius:6px;font-size:12px;cursor:pointer;">删除</button>
      </div>
    </div>`;
  });
  html += '</div>';
  
  // 添加按钮
  html += '<div style="text-align:center;">';
  html += '<button onclick="addNewSnack()" style="padding:12px 24px;background:linear-gradient(135deg,#4caf50,#45a049);color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;">+ 添加新零食</button>';
  html += '</div>';
  
  // 恢复默认按钮
  const curClass = classesData.find(c => c.id === currentClassId);
  if (curClass && curClass.customSnacks && curClass.customSnacks.length > 0) {
    html += '<div style="text-align:center;margin-top:10px;">';
    html += '<button onclick="resetToDefaultSnacks()" style="padding:8px 16px;background:#ff9800;color:#fff;border:none;border-radius:8px;font-size:12px;cursor:pointer;">恢复默认零食</button>';
    html += '</div>';
  }
  
  html += '</div>';
  showModal('⚙️ 零食管理', html, [
    {text:'返回',onclick:'showSnackShopModal()'},
    {text:'关闭',onclick:'closeModal()'}
  ], false);
}

function addNewSnack() {
  showSnackEditModal(null, -1);
}

function editSnack(index) {
  const snacks = getCurrentSnackConfig();
  if (index < 0 || index >= snacks.length) return;
  showSnackEditModal(snacks[index], index);
}

function deleteSnack(index) {
  const snacks = getCurrentSnackConfig();
  if (index < 0 || index >= snacks.length) return;
  const snack = snacks[index];
  if (!confirm(`确定删除零食「${snack.name}」吗？`)) return;
  snacks.splice(index, 1);
  saveCustomSnacks(snacks);
  showSnackManageModal();
  showNotification('删除成功', `已删除零食「${snack.name}」`, 'success');
}

function resetToDefaultSnacks() {
  if (!confirm('确定恢复默认零食吗？自定义零食将被清除。')) return;
  const curClass = classesData.find(c => c.id === currentClassId);
  if (curClass) {
    delete curClass.customSnacks;
    saveClassData();
  }
  showSnackManageModal();
  showNotification('恢复成功', '已恢复默认零食', 'success');
}

function showSnackEditModal(snack, index) {
  const isNew = index === -1;
  const name = snack ? snack.name : '';
  const emoji = snack ? snack.emoji : '🍬';
  const flavors = snack ? snack.flavors.join('、') : '';
  const price = snack ? (snack.price || 0) : 2;
  
  let html = '<div style="padding:10px 0;">';
  html += '<div style="margin-bottom:15px;">';
  html += '<label style="display:block;font-size:13px;color:#666;margin-bottom:6px;">零食名称</label>';
  html += `<input type="text" id="snackEditName" value="${esc(name)}" placeholder="例如：奶茶" style="width:100%;padding:10px 14px;border:1.5px solid #ddd;border-radius:10px;font-size:14px;box-sizing:border-box;">`;
  html += '</div>';
  
  html += '<div style="margin-bottom:15px;">';
  html += '<label style="display:block;font-size:13px;color:#666;margin-bottom:6px;">封面图标（Emoji）</label>';
  html += `<input type="text" id="snackEditEmoji" value="${esc(emoji)}" placeholder="例如：🧋" style="width:100%;padding:10px 14px;border:1.5px solid #ddd;border-radius:10px;font-size:24px;text-align:center;box-sizing:border-box;">`;
  html += '<div style="font-size:11px;color:#999;margin-top:4px;">常用：🧋🥤🍟🍫🍪🍦🍩🍿🍕🍔🌭🍣🍜</div>';
  html += '</div>';
  
  html += '<div style="margin-bottom:15px;">';
  html += '<label style="display:block;font-size:13px;color:#666;margin-bottom:6px;">🟠 仙丹价格</label>';
  html += `<input type="number" id="snackEditPrice" value="${price}" min="0" placeholder="例如：3" style="width:100%;padding:10px 14px;border:1.5px solid #ddd;border-radius:10px;font-size:14px;box-sizing:border-box;">`;
  html += '<div style="font-size:11px;color:#999;margin-top:4px;">学生兑换此零食需要消耗的仙丹数量</div>';
  html += '</div>';
  
  html += '<div style="margin-bottom:15px;">';
  html += '<label style="display:block;font-size:13px;color:#666;margin-bottom:6px;">口味（用中文顿号"、"分隔）</label>';
  html += `<textarea id="snackEditFlavors" rows="3" placeholder="例如：珍珠奶茶、椰果奶茶、红豆奶茶" style="width:100%;padding:10px 14px;border:1.5px solid #ddd;border-radius:10px;font-size:14px;resize:vertical;box-sizing:border-box;">${esc(flavors)}</textarea>`;
  html += '</div>';
  html += '</div>';
  
  showModal(isNew ? '➕ 添加新零食' : '✏️ 编辑零食', html, [
    {text:'取消',onclick:'showSnackManageModal()'},
    {text:'保存',onclick:`saveSnackEdit(${index})`,style:'background:linear-gradient(135deg,#4caf50,#45a049);'}
  ], false);
}

function saveSnackEdit(index) {
  const nameEl = document.getElementById('snackEditName');
  const emojiEl = document.getElementById('snackEditEmoji');
  const flavorsEl = document.getElementById('snackEditFlavors');
  const priceEl = document.getElementById('snackEditPrice');
  
  if (!nameEl || !emojiEl || !flavorsEl) return;
  
  const name = nameEl.value.trim();
  const emoji = emojiEl.value.trim();
  const flavorsText = flavorsEl.value.trim();
  const price = priceEl ? Math.max(0, parseInt(priceEl.value) || 0) : 0;
  
  if (!name) { showNotification('错误', '请输入零食名称', 'error'); return; }
  if (!emoji) { showNotification('错误', '请输入封面图标', 'error'); return; }
  if (!flavorsText) { showNotification('错误', '请至少输入一种口味', 'error'); return; }
  
  const flavors = flavorsText.split(/[、,，]/).map(f => f.trim()).filter(f => f.length > 0);
  if (flavors.length === 0) { showNotification('错误', '请至少输入一种口味', 'error'); return; }
  
  const snacks = getCurrentSnackConfig();
  const isNew = index === -1;
  
  if (isNew) {
    // 生成新ID
    const id = 'custom_' + Date.now();
    snacks.push({ id, name, emoji, flavors, price });
  } else {
    // 编辑现有
    if (index < 0 || index >= snacks.length) return;
    snacks[index].name = name;
    snacks[index].emoji = emoji;
    snacks[index].flavors = flavors;
    snacks[index].price = price;
  }
  
  saveCustomSnacks(snacks);
  showSnackManageModal();
  showNotification(isNew ? '添加成功' : '保存成功', `零食「${name}」已${isNew ? '添加' : '更新'}`, 'success');
}
