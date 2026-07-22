// ========== 宠物PK对战系统 ==========
let pkState = {
  players: [],      // 存储选中的学生对象 { studentId, studentName, pet }
  isFighting: false
};

let _pkChallengeState = { pending: null, _lastShownChallengeId: null };

// v35: Fast poll timer for PK challenge acceptance (reduces delay from 30s to 2s)
let _pkChallengePollTimer = null;

let _handledPKChallengeIds = new Set();
// v34: Load persisted handled challenge IDs from localStorage
try {
  const saved = localStorage.getItem('_handledPKChallengeIds');
  if (saved) {
    const arr = JSON.parse(saved);
    if (Array.isArray(arr)) arr.forEach(id => _handledPKChallengeIds.add(id));
  }
} catch(e) {}

// v34: Helper to persist handled challenge IDs to localStorage
function _saveHandledPKChallengeIds() {
  try {
    localStorage.setItem('_handledPKChallengeIds', JSON.stringify(Array.from(_handledPKChallengeIds)));
  } catch(e) {}
}

// ========== Seeded PRNG for synchronized PK battles ==========
// Mulberry32: deterministic random from a seed
function _mulberry32(seed) {
  return function() {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
// Active seeded RNG for current PK battle (null = use Math.random)
let _pkBattleRng = null;
// Pre-determined monster image indices for synchronized visuals
let _pkBattleLeftMonsterIdx = -1;
let _pkBattleRightMonsterIdx = -1;

function _pkRng() {
  return _pkBattleRng ? _pkBattleRng() : Math.random();
}

// Helper: count pending challenges I sent today (not yet accepted/declined)

// PK 挑战/对战函数
function resetDailyPkCountIfNeeded(student) {
  const today = new Date().toDateString();
  if (student.lastPkDate !== today) {
    student.pkCountToday = 0;
    student.lastPkDate = today;
    // Clear handled challenge tracking on new day
    _handledPKChallengeIds.clear();
    _saveHandledPKChallengeIds();
  }
}

function renderPKPage() {
  const container = document.getElementById('pkContent');
  if(!currentClassId) {
    container.innerHTML = '<div style="text-align:center;padding:40px;">请先在【宠物管理】页面选择一个班级</div>';
    return;
  }
  const cur = classesData.find(c=>c.id===currentClassId);
  if(!cur || cur.students.length < 2) {
    container.innerHTML = '<div style="text-align:center;padding:40px;">班级至少需要2名有宠物的学生才能开始PK</div>';
    return;
  }
  
  // Check if current user is a student
  const isStudentView = typeof currentUser !== 'undefined' && currentUser && currentUser.type === 'student';
  const myStudentId = isStudentView ? parseInt(currentUser.studentId) : null;
  
  // 先筛选有存活宠物的学生
  const allAliveStudents = cur.students.filter(s => {
    const p = getActivePet(s);
    if(p && !p.isDead) {
      resetDailyPkCountIfNeeded(s);
      return true;
    }
    return false;
  });
  // 再筛选有PK资格的学生（今日奖惩获得>=5金币）
  const validStudents = allAliveStudents.filter(s => hasPKQualificationToday(s.id));
  
  // === Student view: render BEFORE the "not enough students" check ===
  if (isStudentView) {
    const myStudent = cur.students.find(s => s.id.toString() === myStudentId.toString());
    const myPet = myStudent ? getActivePet(myStudent) : null;
    const myValid = myStudent && hasPKQualificationToday(myStudent.id);
    
    // Check for pending challenges targeting me first
    const pendingChallenge = _getPendingPKChallengeForMe();
    if (pendingChallenge) {
      // Only show dialog if PK page is currently visible and we haven't shown it for this challenge
      const pkPageEl = document.getElementById('pk-page');
      if (pkPageEl && pkPageEl.classList.contains('active')) {
        if (_pkChallengeState._lastShownChallengeId !== pendingChallenge.id) {
          _pkChallengeState._lastShownChallengeId = pendingChallenge.id;
          _showPKChallengeDialog(pendingChallenge);
        }
        return;
      }
    } else {
      // Reset when no pending challenge
      _pkChallengeState._lastShownChallengeId = null;
    }
    
    if (!myValid) {
      let noQualHtml = `<div style="text-align:center;padding:40px;line-height:2;">
        <div style="font-size:48px;margin-bottom:16px;">🔒</div>
        <div style="font-size:18px;font-weight:700;color:#a06040;">你还没有PK资格</div>
        <div style="font-size:14px;color:#888;margin-top:8px;">今日通过【奖惩/批量奖惩/每日打卡/取金阁】获得≥5金币即可参加PK</div>
        <div style="font-size:12px;color:#aaa;margin-top:16px;">当前有资格的学生：${validStudents.length}人</div>`;
      // v14: Show list of qualified students even when current student doesn't qualify
      if (validStudents.length > 0) {
        noQualHtml += `<div style="margin-top:15px;text-align:left;max-width:400px;margin-left:auto;margin-right:auto;">`;
        noQualHtml += `<div style="font-size:13px;font-weight:600;color:#a06040;margin-bottom:8px;">当前有资格PK的同学：</div>`;
        validStudents.forEach(s => {
          const p = getActivePet(s);
          if (p) {
            noQualHtml += `<div style="display:flex;align-items:center;gap:8px;padding:6px 10px;background:#fff8f0;border-radius:10px;margin-bottom:4px;">
              <div style="width:30px;height:30px;">${getPetImage(p.name, p.level)}</div>
              <div style="font-size:13px;font-weight:600;color:#664;">${esc(s.name)}</div>
              <div style="font-size:11px;color:#aa8;">Lv.${p.level} ${esc(p.nickname||p.name)}</div>
            </div>`;
          }
        });
        noQualHtml += `</div>`;
      }
      noQualHtml += `</div>`;
      container.innerHTML = noQualHtml;
      return;
    }
    
    // v14: Student view - show PK info with list of qualified opponents
    let html = '';
    html += `<div style="margin-bottom:10px;padding:8px 16px;background:#fff8f0;border-radius:12px;border:1px solid #ffe0c0;font-size:13px;color:#a06040;">⚔️ PK资格：今日通过【奖惩/批量奖惩/每日打卡/取金阁】获得≥5金币方可参加 · 每人每日最多3次PK · 打卡也可获得资格</div>`;
    html += `<div style="text-align:center;padding:20px;line-height:2;">
      <div style="font-size:48px;margin-bottom:16px;">⚔️</div>
      <div style="font-size:18px;font-weight:700;color:#4a90d9;">PK挑战</div>
      <div style="font-size:14px;color:#888;margin-top:8px;">你有PK资格，可以通过发起挑战与其他学生进行对战</div>
      <div style="margin-top:20px;">
        <button class="btn btn-primary" onclick="showStudentPKChallengeModal()" style="padding:12px 30px;font-size:15px;">发起PK挑战</button>
      </div>
    </div>`;
    // v14: Show list of qualified opponents
    const opponents = validStudents.filter(s => s.id.toString() !== myStudentId.toString());
    if (opponents.length > 0) {
      html += `<div style="margin-top:10px;"><div style="font-size:13px;font-weight:600;color:#a06040;margin-bottom:8px;">可挑战的同学 (${opponents.length}人)：</div>`;
      html += `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px;">`;
      opponents.forEach(s => {
        const p = getActivePet(s);
        if (p) {
          html += `<div style="display:flex;align-items:center;gap:6px;padding:8px 10px;background:#f0f8ff;border-radius:10px;border:1px solid #d0e8ff;">
            <div style="width:28px;height:28px;">${getPetImage(p.name, p.level)}</div>
            <div>
              <div style="font-size:12px;font-weight:600;color:#446;">${esc(s.name)}</div>
              <div style="font-size:10px;color:#889;">Lv.${p.level} 💰${s.coins}</div>
            </div>
          </div>`;
        }
      });
      html += `</div></div>`;
    }
    container.innerHTML = html;
    return;
  }
  
  // === Teacher view ===
  if(validStudents.length < 2) {
    let hintMsg = '⚔️ 当前有资格PK的学生不足2人<br><br><span style="font-size:14px;color:#888;">PK资格：今日通过【奖惩/批量奖惩/打卡/取金阁】获得≥5金币</span>';
    if(allAliveStudents.length >= 2 && validStudents.length < 2) {
      hintMsg += '<br><span style="font-size:13px;color:#a06040;">请先给学生施加奖惩或批量奖惩，获得金币后才能参加PK</span>';
    }
    container.innerHTML = `<div style="text-align:center;padding:40px;line-height:2;">${hintMsg}</div>`;
    return;
  }
  
  let html = '';
  html += `<div style="margin-bottom:10px;padding:8px 16px;background:#fff8f0;border-radius:12px;border:1px solid #ffe0c0;font-size:13px;color:#a06040;">⚔️ PK资格：今日通过【奖惩/批量奖惩/打卡/取金阁】获得≥5金币方可参加</div>`;
  html += `<div style="margin-bottom:20px;"><h3>选择你的宠物</h3><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:15px;">`;
  validStudents.forEach(s => {
    const p = getActivePet(s);
    const isSelected = pkState.players.some(p => p.studentId.toString() === s.id.toString());
    html += `<div class="pk-opponent-item ${isSelected ? 'selected' : ''}" onclick="selectPKPlayer('${s.id}')">
      <div class="pk-opponent-avatar">${getPetImage(p.name, p.level)}</div>
      <div>
        <div style="font-weight:700;">${esc(s.name)}</div>
        <div style="font-size:14px;">${esc(p.nickname||p.name)} Lv.${p.level}</div>
        <div style="font-size:12px;color:#885555;">成长: ${p.level>=9?getExpNeeded(p):p.growth}</div>
        <div style="font-size:12px;color:#d4a017;margin-top:2px;">💰 金币: ${s.coins}</div>
        <div style="font-size:12px;color:#ff8844;margin-top:4px;">📊 今日PK: ${s.pkCountToday || 0}/3次</div>
      </div>
      ${isSelected?'<div style="font-size:24px;">✅</div>':''}
    </div>`;
  });
  html += `</div></div>`;
  html += `<div style="text-align:center;margin-top:20px;">
    <button class="btn btn-secondary" onclick="resetPKSelection()">重置选择</button>
    <button class="btn btn-primary" onclick="startPKBattle()" ${(pkState.players.length !== 2)?'disabled':''}>⚔️ 开始对战</button>
  </div>`;
  container.innerHTML = html;
}

// PK Challenge system for students

let _leftMonsterPool = [];
let _rightMonsterPool = [];
let _jhBossPool = [];
let _pkMonsterProbed = false;
let _jhBossProbed = false;

// 宠物PK对战：探测数字命名图片，分左右两个池
function probePKMonsterImages() {
  return new Promise((resolve) => {
    if(_pkMonsterProbed) { resolve(); return; }
    let pending = 0;
    let resolved = false;
    const finish = () => { if(!resolved) { resolved = true; _pkMonsterProbed = true; resolve(); } };
    const checkDone = () => { pending--; if(pending <= 0) finish(); };
    const seenL = new Set();
    const seenR = new Set();
    function tryLeft(path) {
      pending++;
      const img = new Image();
      img.onload = () => { if(!seenL.has(path)) { seenL.add(path); _leftMonsterPool.push(path); } checkDone(); };
      img.onerror = () => { checkDone(); };
      img.src = path;
    }
    function tryRight(path) {
      pending++;
      const img = new Image();
      img.onload = () => { if(!seenR.has(path)) { seenR.add(path); _rightMonsterPool.push(path); } checkDone(); };
      img.onerror = () => { checkDone(); };
      img.src = path;
    }
    // 左侧池：无补零格式 1.webp ~ 24.webp
    for(let i = 1; i <= 50; i++) {
      tryLeft(`战斗兽宠文件夹/${i}.webp`);
    }
    // 右侧池：所有以0开头的数字图片（01~09, 010~019, 020~024等）
    for(let i = 1; i <= 9; i++) {
      tryRight(`战斗兽宠文件夹/0${i}.webp`);
    }
    for(let i = 10; i <= 50; i++) {
      const padded3 = String(i).padStart(3, '0');
      tryRight(`战斗兽宠文件夹/${padded3}.webp`);
    }
    setTimeout(finish, 5000);
  });
}

// 萌萌江湖行：探测中文命名图片（天山剑魔.png 等）
function probeJhBossImages() {
  return new Promise((resolve) => {
    if(_jhBossProbed) { resolve(); return; }
    let pending = 0;
    let resolved = false;
    const finish = () => { if(!resolved) { resolved = true; _jhBossProbed = true; resolve(); } };
    const checkDone = () => { pending--; if(pending <= 0) finish(); };
    const seen = new Set();
    function tryPath(path) {
      pending++;
      const img = new Image();
      img.onload = () => { if(!seen.has(path)) { seen.add(path); _jhBossPool.push(path); } checkDone(); };
      img.onerror = () => { checkDone(); };
      img.src = path;
    }
    const jhBossNames = ['天山剑魔','幽冥鬼母','毒手药王','血刀老祖','铁面判官'];
    jhBossNames.forEach(name => tryPath(`战斗兽宠文件夹/${name}.webp`));
    setTimeout(finish, 5000);
  });
}

// 兼容旧调用：probeMonsterImages 同时探测两套
function probeMonsterImages() {
  return Promise.all([probePKMonsterImages(), probeJhBossImages()]);
}

// 宠物PK对战：左侧从 _leftMonsterPool 取图（数字.png）
function getLeftMonsterImg() {
  if(_leftMonsterPool.length > 0) {
    const idx = _pkBattleLeftMonsterIdx >= 0 ? _pkBattleLeftMonsterIdx : Math.floor(Math.random() * _leftMonsterPool.length);
    return _leftMonsterPool[idx];
  }
  return null;
}
// 宠物PK对战：右侧从 _rightMonsterPool 取图（0数字.png）
function getRightMonsterImg() {
  if(_rightMonsterPool.length > 0) {
    const idx = _pkBattleRightMonsterIdx >= 0 ? _pkBattleRightMonsterIdx : Math.floor(Math.random() * _rightMonsterPool.length);
    return _rightMonsterPool[idx];
  }
  return null;
}
// 萌萌江湖行：宠物变身从 _leftMonsterPool 取图（数字.png）
function getJhPetMonsterImg() {
  if(_leftMonsterPool.length > 0) {
    return _leftMonsterPool[Math.floor(Math.random() * _leftMonsterPool.length)];
  }
  return null;
}

// 萌萌江湖行：随机从中文命名池取图
function getJhBossMonsterImg() {
  if(_jhBossPool.length > 0) {
    return _jhBossPool[Math.floor(Math.random() * _jhBossPool.length)];
  }
  return null;
}

// 延迟到对应页面打开时再探测
// probePKMonsterImages() 将在 switchPage('pk-page') 时按需调用
// probeJhBossImages() 将在进入江湖行时按需调用

// 音效系统

// PK 技能系统
const PK_SKILLS = [
  {name:'烈焰风暴',icon:'🔥',color:'#ff4400',type:'fire',desc:'召唤灼热火焰吞噬对手'},
  {name:'冰霜新星',icon:'❄️',color:'#66ccff',type:'ice',desc:'极寒冰晶冻结一切'},
  {name:'雷神之怒',icon:'⚡',color:'#ffdd00',type:'thunder',desc:'天降雷霆万钧之力'},
  {name:'剧毒吐息',icon:'☠️',color:'#66ff33',type:'poison',desc:'致命毒雾侵蚀敌人'},
  {name:'暴风旋涡',icon:'🌪️',color:'#88ccff',type:'wind',desc:'狂暴旋风席卷战场'},
  {name:'暗影侵蚀',icon:'🌑',color:'#aa44ff',type:'shadow',desc:'黑暗力量吞噬灵魂'},
  {name:'陨石坠落',icon:'☄️',color:'#ff6633',type:'meteor',desc:'天外陨石毁灭降临'},
  {name:'圣光审判',icon:'✨',color:'#ffee77',type:'holy',desc:'神圣光芒净化邪恶'},
  {name:'岩浆喷发',icon:'🌋',color:'#ff5500',type:'lava',desc:'地底岩浆冲天而起'},
  {name:'星爆冲击',icon:'💫',color:'#ffcc00',type:'starburst',desc:'星光汇聚爆裂冲击'},
  {name:'龙息吐焰',icon:'🐲',color:'#ff3300',type:'dragonfire',desc:'巨龙怒吼烈焰焚天'},
  {name:'冰封裂地',icon:'🧊',color:'#aaddff',type:'iceground',desc:'冰柱破地冻裂苍穹'},
];
function getRandomSkill(){ return PK_SKILLS[Math.floor(_pkRng()*PK_SKILLS.length)]; }

function showSkillAnnounce(arena, skill, attackerName){
  // 不再显示技能名称
}

// 技能特效背景
let _bgThemeTimeout = null;
function applySkillThemeBackground(arena, skillType) {
  if(!arena) return;
  // 清除之前的定时器
  if(_bgThemeTimeout) { clearTimeout(_bgThemeTimeout); _bgThemeTimeout = null; }
  // 移除旧主题
  const themeClasses = ['fire-bg','ice-bg','thunder-bg','poison-bg','wind-bg','shadow-bg','meteor-bg','holy-bg','lava-bg','starburst-bg','dragonfire-bg','iceground-bg'];
  themeClasses.forEach(cls => arena.classList.remove(cls));
  // 添加竞技场主题类
  arena.classList.add('arena-themed-bg');
  // 添加新主题
  const bgClass = skillType + '-bg';
  arena.classList.add(bgClass);
  // 生成主题粒子
  spawnThemeParticles(arena, skillType);
  // 3秒后恢复默认背景
  _bgThemeTimeout = setTimeout(() => {
    themeClasses.forEach(cls => arena.classList.remove(cls));
  }, 3000);
}


// PK 战斗核心
// 命中爆炸粒子
function createHitExplosion(container, isCritical) {
  const particleCount = isCritical ? 30 : 15;
  const colors = isCritical
    ? ['#ff0000','#ff4400','#ffcc00','#ffffff','#ff6600','#ffaa00']
    : ['#ff6600','#ffaa33','#ffcc00','#ff9900'];
  const explosionDiv = document.createElement('div');
  explosionDiv.className = 'explosion-container';
  container.style.position = 'relative';
  container.appendChild(explosionDiv);
  for(let i = 0; i < particleCount; i++) {
    const p = document.createElement('div');
    p.className = 'explosion-particle';
    const angle = (Math.PI * 2 / particleCount) * i + Math.random() * 0.5;
    const dist = 40 + Math.random() * (isCritical ? 80 : 50);
    p.style.setProperty('--ex', Math.cos(angle) * dist + 'px');
    p.style.setProperty('--ey', Math.sin(angle) * dist + 'px');
    p.style.width = (4 + Math.random() * (isCritical ? 10 : 6)) + 'px';
    p.style.height = p.style.width;
    p.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    p.style.boxShadow = `0 0 6px ${p.style.backgroundColor}`;
    explosionDiv.appendChild(p);
  }
  // 能量环
  const ring = document.createElement('div');
  ring.className = 'energy-ring';
  if(isCritical) { ring.style.borderColor = 'rgba(255,50,0,0.9)'; ring.style.width = '120px'; ring.style.height = '120px'; ring.style.margin = '-60px 0 0 -60px'; }
  container.appendChild(ring);
  setTimeout(() => { explosionDiv.remove(); ring.remove(); }, 800);
}

// 显示伤害数字
function showDamageNumber(container, damage, isCritical, isCombo) {
  const rect = container.getBoundingClientRect();
  
  const dmgEl = document.createElement('div');
  dmgEl.style.cssText = `
    position: fixed;
    font-size: 32px;
    font-weight: 900;
    color: #ff5555;
    text-shadow: 2px 2px 0 #550000, 0 0 10px rgba(255,0,0,0.5);
    pointer-events: none;
    z-index: 9999;
    animation: floatUp 1.2s ease-out forwards;
    left: ${rect.left + rect.width/2 - 40 + Math.random()*30}px;
    top: ${rect.top + 10}px;
  `;
  
  if(isCritical) {
    dmgEl.style.fontSize = '48px';
    dmgEl.style.color = '#ff0000';
    dmgEl.innerHTML = `💥暴击! -${damage}`;
    dmgEl.style.textShadow = '3px 3px 0 #880000, 0 0 20px #ff0000, 0 0 40px #ff4400';
  } else if(isCombo) {
    dmgEl.style.fontSize = '36px';
    dmgEl.style.color = '#ff9900';
    dmgEl.innerHTML = `⚡连击! -${damage}`;
    dmgEl.style.textShadow = '2px 2px 0 #884400, 0 0 12px #ff8800';
  } else {
    dmgEl.innerHTML = `受到攻击! -${damage}`;
  }
  
  document.body.appendChild(dmgEl);
  setTimeout(() => dmgEl.remove(), 1200);
}

// 显示攻击方造成的伤害文本
function showAttackDamageText(container, damage, isCritical, isCombo) {
  const arena = container.closest('.pk-arena');
  const target = arena || document.body;
  const targetRect = target.getBoundingClientRect();
  const rect = container.getBoundingClientRect();
  
  const dmgEl = document.createElement('div');
  dmgEl.style.cssText = `
    position: absolute;
    font-size: 26px;
    font-weight: 900;
    color: #ffcc00;
    text-shadow: 2px 2px 0 #664400, 0 0 10px rgba(255,180,0,0.5);
    pointer-events: none;
    z-index: 9999;
    animation: floatUp 1.2s ease-out forwards;
    left: ${rect.left - targetRect.left + rect.width/2 - 50}px;
    top: ${rect.top - targetRect.top - 10}px;
  `;
  
  let text = `造成 ${damage} 伤害`;
  if(isCritical) {
    text = `💥暴击! 造成 ${damage} 伤害`;
    dmgEl.style.color = '#ffaa00';
    dmgEl.style.fontSize = '32px';
  } else if(isCombo) {
    text = `⚡连击! 造成 ${damage} 伤害`;
    dmgEl.style.color = '#ff8800';
  }
  
  dmgEl.innerHTML = text;
  target.style.position = 'relative';
  target.appendChild(dmgEl);
  setTimeout(() => dmgEl.remove(), 1200);
}

let currentBattleModalOverlay = null;

function startPKBattle() {
  if(pkState.players.length !== 2) return;
  if(pkState.isFighting) {
    return; // silently return - already fighting, no notification needed
  }
  // Prevent re-starting the same battle (infinite loop protection)
  if (pkState._battleCompleted) {
    return;
  }
  const cur = classesData.find(c=>c.id===currentClassId);
  const student1 = cur.students.find(s=>s.id.toString()===pkState.players[0].studentId.toString());
  const student2 = cur.students.find(s=>s.id.toString()===pkState.players[1].studentId.toString());
  if(student1.id === student2.id) {
    showNotification('对战错误', '不能与自己宠物对战，请重新选择', 'error');
    resetPKSelection();
    return;
  }
  const pet1 = getActivePet(student1);
  const pet2 = getActivePet(student2);
  if(!pet1 || !pet2 || pet1.isDead || pet2.isDead) {
    showNotification('PK失败', '宠物状态异常，无法对战', 'error');
    resetPKSelection();
    return;
  }
  if(student1.coins < 5 || student2.coins < 5) {
    showNotification('PK条件不满足', '双方金币必须≥5才能进行对战', 'error');
    return;
  }
  if(Math.abs(pet1.level - pet2.level) > 1) {
    showNotification('PK条件不满足', '只能与等级相差不超过1级的宠物对战', 'error');
    return;
  }
  resetDailyPkCountIfNeeded(student1);
  resetDailyPkCountIfNeeded(student2);
  if(student1.pkCountToday >= 3) {
    showNotification('PK次数已达上限', `${student1.name} 今日已PK ${student1.pkCountToday} 次，无法继续`, 'error');
    return;
  }
  if(student2.pkCountToday >= 3) {
    showNotification('PK次数已达上限', `${student2.name} 今日已PK ${student2.pkCountToday} 次，无法继续`, 'error');
    return;
  }
  pkState.isFighting = true;
  pkState._battleCompleted = false; // Reset for this battle
  const p1 = pkState.players[0];
  const p2 = pkState.players[1];
  
  // === 设置种子随机数（用于同步战斗结果）===
  // 如果 pkState 中有种子（来自 PK 挑战），使用它；否则生成新的
  if (pkState.battleSeed) {
    _pkBattleRng = _mulberry32(pkState.battleSeed);
  } else {
    // 教师发起或无种子的情况：生成随机种子
    pkState.battleSeed = Math.floor(Math.random() * 2147483647);
    _pkBattleRng = _mulberry32(pkState.battleSeed);
  }
  
  // 确保PK数字命名图片探测完成后再开始
  probePKMonsterImages().then(async () => {
    // 使用种子确定怪兽图片索引（双方一致）
    if (_leftMonsterPool.length > 0) {
      _pkBattleLeftMonsterIdx = Math.floor(_pkRng() * _leftMonsterPool.length);
    }
    if (_rightMonsterPool.length > 0) {
      _pkBattleRightMonsterIdx = Math.floor(_pkRng() * _rightMonsterPool.length);
    }
    
    let leftMonster = getLeftMonsterImg();
    let rightMonster = getRightMonsterImg();
    // 重试机制：如果图片池为空，重新探测一次
    if(!leftMonster || !rightMonster) {
      _pkMonsterProbed = false;
      _leftMonsterPool = [];
      _rightMonsterPool = [];
      await probePKMonsterImages();
      leftMonster = getLeftMonsterImg();
      rightMonster = getRightMonsterImg();
    }
    // 最终回退：如果仍然为空，使用空字符串避免 "null" 字符串
    if(!leftMonster) leftMonster = '';
    if(!rightMonster) rightMonster = '';
    const modalContent = `
      <div class="pk-arena" id="pk-arena">
        <div class="pk-arena-particles" id="pk-arena-particles"></div>
        <div class="pk-pet-side" id="pk-side-1">
          <div class="pk-pet-name">${p1.studentName} · ${p1.pet.nickname||p1.pet.name}</div>
          <div class="pk-pet-img-container" id="pk-img-1">${getPetImage(p1.pet.name, p1.pet.level)}</div>
          <div class="pk-hp-bar-container"><div class="pk-hp-bar" id="pk-hp-bar-1"></div></div>
          <div class="pk-hp-text" id="pk-hp-text-1">准备变身...</div>
        </div>
        <div class="pk-vs" id="pk-vs-text">VS</div>
        <div class="pk-pet-side" id="pk-side-2">
          <div class="pk-pet-name">${p2.studentName} · ${p2.pet.nickname||p2.pet.name}</div>
          <div class="pk-pet-img-container" id="pk-img-2">${getPetImage(p2.pet.name, p2.pet.level)}</div>
          <div class="pk-hp-bar-container"><div class="pk-hp-bar" id="pk-hp-bar-2"></div></div>
          <div class="pk-hp-text" id="pk-hp-text-2">准备变身...</div>
        </div>
      </div>
    `;
    const actions = [{text:'退出', class:'btn-secondary', onclick:'closePKModal()', disabled: true}];
    currentBattleModalOverlay = showModal('⚔️ 宠物PK对战 - 变身中...', modalContent, actions, false, 'pk-fullscreen');
    // Add floating ember particles to arena
    setTimeout(() => {
      const particlesDiv = document.getElementById('pk-arena-particles');
      if(particlesDiv) {
        for(let i = 0; i < 10; i++) {
          const ember = document.createElement('div');
          ember.style.cssText = `position:absolute;width:${2+Math.random()*4}px;height:${2+Math.random()*4}px;background:rgba(255,${80+Math.random()*120},0,${0.3+Math.random()*0.5});border-radius:50%;left:${Math.random()*100}%;bottom:0;animation:emberFloat ${3+Math.random()*4}s ease-in-out infinite;animation-delay:${Math.random()*3}s;will-change:transform,opacity;contain:strict;`;
          particlesDiv.appendChild(ember);
        }
      }
    }, 100);
    if(currentBattleModalOverlay){
      const exitBtn = currentBattleModalOverlay.querySelector('.modal-actions button');
      if(exitBtn) exitBtn.disabled = true;
    }
    // 开始变身序列
    setTimeout(() => runTransformSequence(student1, student2, p1, p2, leftMonster, rightMonster), 600);
  });
}

// 变身序列
async function runTransformSequence(student1, student2, p1, p2, leftMonster, rightMonster) {
  const img1 = document.getElementById('pk-img-1');
  const img2 = document.getElementById('pk-img-2');
  const vsText = document.getElementById('pk-vs-text');
  
  // Safety check: if elements not found, skip transform and go directly to battle
  if (!img1 || !img2) {
    console.warn('[PK] Transform elements not found, skipping transform sequence');
    startPKBattleLoop(student1, student2, p1, p2);
    return;
  }
  
  await sleep(500);

  // 阶段1：两只宠物抖动
  img1.style.animation = 'petShake 0.4s ease-in-out infinite';
  img2.style.animation = 'petShake 0.4s ease-in-out infinite';
  playTransformSound();
  await sleep(1500);

  // 阶段2：裂纹出现
  const crack1 = document.createElement('div');
  crack1.className = 'crack-lines';
  img1.appendChild(crack1);
  const crack2 = document.createElement('div');
  crack2.className = 'crack-lines';
  img2.appendChild(crack2);
  img1.style.animation = 'petShake 0.2s ease-in-out infinite';
  img2.style.animation = 'petShake 0.2s ease-in-out infinite';
  await sleep(1000);

  // 阶段3：爆裂变身
  playExplosionSound();
  // 左侧爆裂
  const explode1 = document.createElement('div');
  explode1.className = 'crack-overlay';
  img1.appendChild(explode1);
  createHitExplosion(img1, true);
  // 右侧爆裂
  const explode2 = document.createElement('div');
  explode2.className = 'crack-overlay';
  img2.appendChild(explode2);
  createHitExplosion(img2, true);
  // 屏幕震动
  const arena = document.getElementById('pk-arena');
  if(arena) arena.classList.add('screen-shake');
  await sleep(600);
  if(arena) arena.classList.remove('screen-shake');

  // 阶段4：替换为战斗兽宠图片（必须使用战斗兽宠文件夹中的数字命名图片）
  img1.style.animation = '';
  img2.style.animation = '';
  img1.innerHTML = `<img src="${leftMonster}" alt="战斗兽宠" style="max-width:100%;max-height:100%;object-fit:contain;opacity:0;animation:monsterReveal 0.8s ease-out forwards;filter:drop-shadow(0 0 20px rgba(255,80,0,0.6)) drop-shadow(0 10px 30px rgba(0,0,0,0.9));">`;
  img2.innerHTML = `<img src="${rightMonster}" alt="战斗兽宠" style="max-width:100%;max-height:100%;object-fit:contain;opacity:0;animation:monsterReveal 0.8s ease-out forwards;filter:drop-shadow(0 0 20px rgba(255,80,0,0.6)) drop-shadow(0 10px 30px rgba(0,0,0,0.9));">`;
  playExplosionSound();
  await sleep(1000);

  // 进入战斗状态 - 先锁定opacity防止怪兽消失，再添加浮动动画
  img1.querySelectorAll('img, span').forEach(el => { el.style.opacity = '1'; el.style.filter = 'drop-shadow(0 0 20px rgba(255,80,0,0.6)) drop-shadow(0 10px 30px rgba(0,0,0,0.9))'; });
  img2.querySelectorAll('img, span').forEach(el => { el.style.opacity = '1'; el.style.filter = 'drop-shadow(0 0 20px rgba(255,80,0,0.6)) drop-shadow(0 10px 30px rgba(0,0,0,0.9))'; });
  img1.classList.add('battle-idle');
  img2.classList.add('battle-idle-no-flip');
  if(vsText) { vsText.innerHTML = '⚔️'; vsText.style.color = '#ff3300'; vsText.style.textShadow = '0 0 20px #ff6600'; }
  await sleep(500);

  // 开始回合制战斗
  startPKBattleLoop(student1, student2, p1, p2);
}

function closePKModal() {
  if(pkState.isFighting) {
    showNotification('战斗中', '战斗尚未结束，无法退出战场', 'warning');
    return;
  }
  closeModal();
  resetPKSelection();
}

function addPKLog(msg, type='') {
  const logContainer = document.getElementById('pk-log-container');
  if(!logContainer) return;
  const logItem = document.createElement('div');
  logItem.className = `pk-log-item ${type}`;
  logItem.innerHTML = msg;
  logContainer.appendChild(logItem);
  logContainer.scrollTop = logContainer.scrollHeight;
}

function updateHPBar(side, current, max) {
  const bar = document.getElementById(`pk-hp-bar-${side}`);
  const text = document.getElementById(`pk-hp-text-${side}`);
  if(bar) {
    const clamped = Math.max(0, Math.min(max, Math.floor(current)));
    const pct = (clamped/max)*100;
    bar.style.transition = 'none';
    bar.style.width = pct + '%';
    bar.offsetHeight;
    bar.style.transition = 'width 0.4s ease';
    // 血条颜色随血量变化
    if(pct > 50) bar.style.background = 'linear-gradient(90deg, #44cc44, #88ff88)';
    else if(pct > 25) bar.style.background = 'linear-gradient(90deg, #ffaa00, #ffcc44)';
    else bar.style.background = 'linear-gradient(90deg, #ff3333, #ff6666)';
  }
  if(text) text.innerHTML = `HP: ${Math.max(0, Math.floor(current))}/${max}`;
}

async function startPKBattleLoop(student1, student2, p1, p2) {
  // HP公式：基础值 + 等级×100 + 成长值/30
  const p1MaxHP = Math.floor(100 + p1.pet.level * 100 + p1.pet.growth / 30);
  const p2MaxHP = Math.floor(100 + p2.pet.level * 100 + p2.pet.growth / 30);
  let p1HP = p1MaxHP;
  let p2HP = p2MaxHP;
  updateHPBar(1, p1HP, p1MaxHP);
  updateHPBar(2, p2HP, p2MaxHP);
  let turn = 0;
  const img1 = document.getElementById('pk-img-1');
  const img2 = document.getElementById('pk-img-2');
  const arena = document.getElementById('pk-arena');
  // 攻击函数：基础18-26%最大HP，暴击12%倍率1.5-1.8x，连击15%，闪避8%，绝地反击，反击，逆袭加成，伤害封顶
  async function doAttack(atkPlayer, atkImg, defImg, atkSide, defSide, defHP, defMaxHP, atkPet, atkName, dmgMult, isComboAttack, atkHP, atkMaxHP) {
    const skill = getRandomSkill();
    showSkillAnnounce(arena, skill, atkName);
    await sleep(400);
    atkImg.classList.add('charging');
    await sleep(250);
    atkImg.classList.remove('charging');
    atkImg.classList.add(atkSide === 1 ? 'attack-lunge-right' : 'attack-lunge-left');
    
    // === 闪避判定：8%几率完全闪避（连击不可闪避）===
    const dodged = !isComboAttack && _pkRng() < 0.08;
    if(dodged) {
      await sleep(200);
      if(arena){const a=document.createElement('div');a.className='skill-announce';a.innerHTML='💨闪避!';a.style.color='#66ddff';a.style.textShadow='0 0 20px rgba(100,200,255,0.9),0 0 60px rgba(50,150,255,0.6),2px 2px 0 #003355';arena.appendChild(a);setTimeout(()=>a.remove(),1200);}
      setTimeout(() => { atkImg.classList.remove(atkSide === 1 ? 'attack-lunge-right' : 'attack-lunge-left'); }, 400);
      return { hp: defHP, isCrit: false, dodged: true, dmgDealt: 0 };
    }
    
    // 伤害按最大HP百分比计算：基础18-26%，连击攻击75%伤害
    const minD = Math.floor(defMaxHP * 0.18);
    const maxD = Math.floor(defMaxHP * 0.26);
    let baseDmg = minD + Math.floor(_pkRng() * (maxD - minD + 1));
    baseDmg = Math.floor(baseDmg * (dmgMult || 1));
    // === 绝地反击：血量越低伤害越高（温和版）===
    if(atkHP !== undefined && atkMaxHP) {
      const hpRatio = atkHP / atkMaxHP;
      if(hpRatio < 0.30) baseDmg = Math.floor(baseDmg * 1.25);
      else if(hpRatio < 0.50) baseDmg = Math.floor(baseDmg * 1.10);
    }
    // === 逆袭加成：血量落后对手越多，伤害越高 ===
    if(atkHP !== undefined && atkMaxHP && defHP !== undefined && defMaxHP) {
      const myRatio = atkHP / atkMaxHP;
      const enemyRatio = defHP / defMaxHP;
      const gap = enemyRatio - myRatio;
      if(gap > 0.30) baseDmg = Math.floor(baseDmg * 1.20);
      else if(gap > 0.15) baseDmg = Math.floor(baseDmg * 1.10);
    }
    // === 暴击：12%几率，1.5-1.8倍（降低爆发）===
    const isCrit = !isComboAttack && _pkRng() < 0.12;
    let finalDmg;
    if(isCrit) {
      const critMult = 1.5 + _pkRng() * 0.3;
      finalDmg = Math.floor(baseDmg * critMult);
    } else if(isComboAttack) {
      finalDmg = Math.floor(baseDmg * 0.75);
    } else {
      finalDmg = baseDmg;
    }
    // === 单次伤害封顶：不超过防守方最大HP的32% ===
    const dmgCap = Math.floor(defMaxHP * 0.32);
    finalDmg = Math.min(finalDmg, dmgCap);
    defHP -= finalDmg;
    await new Promise(resolve => {
      let resolved = false;
      const safeResolve = () => { if(!resolved) { resolved = true; resolve(); } };
      playSkillAttack(atkImg, defImg, isCrit, skill, safeResolve);
      setTimeout(safeResolve, 3000); // 安全超时：3秒后强制继续
    });
    defImg.classList.add('hit-flash');
    showDamageNumber(defImg, finalDmg, isCrit, isComboAttack);
    showAttackDamageText(atkImg, finalDmg, isCrit, isComboAttack);
    updateHPBar(defSide, defHP, defMaxHP);
    if(isCrit && arena) { arena.classList.add('screen-shake'); setTimeout(() => arena.classList.remove('screen-shake'), 500); }
    setTimeout(() => { atkImg.classList.remove(atkSide === 1 ? 'attack-lunge-right' : 'attack-lunge-left'); defImg.classList.remove('hit-flash'); }, 400);
    return { hp: defHP, isCrit, dodged: false, dmgDealt: finalDmg };
  }
  // 主战斗循环（最多5回合，通常3-5回合结束）
  while(p1HP > 0 && p2HP > 0 && turn < 5) {
    turn++;
    await sleep(400);
    // 后期加速：turn2后伤害快速提升（每回合+18%，封顶+54%）
    const escalation = turn >= 2 ? 1.0 + Math.min((turn - 1) * 0.18, 0.54) : 1.0;
    // 每回合随机决定先手
    const p1First = _pkRng() < 0.5;
    const firstAtk = p1First ? {img:img1, defImg:img2, side:1, defSide:2, pet:p1.pet, name:p1.studentName}
                              : {img:img2, defImg:img1, side:2, defSide:1, pet:p2.pet, name:p2.studentName};
    const secondAtk = p1First ? {img:img2, defImg:img1, side:2, defSide:1, pet:p2.pet, name:p2.studentName}
                               : {img:img1, defImg:img2, side:1, defSide:2, pet:p1.pet, name:p1.studentName};
    const firstTargetHP = p1First ? p2HP : p1HP;
    const firstTargetMaxHP = p1First ? p2MaxHP : p1MaxHP;
    const secondTargetHP = p1First ? p1HP : p2HP;
    const secondTargetMaxHP = p1First ? p1MaxHP : p2MaxHP;
    const firstAtkHP = p1First ? p1HP : p2HP;
    const firstAtkMaxHP = p1First ? p1MaxHP : p2MaxHP;
    const secondAtkHP = p1First ? p2HP : p1HP;
    const secondAtkMaxHP = p1First ? p2MaxHP : p1MaxHP;
    // === 先手攻击 ===
    const r1 = await doAttack(1, firstAtk.img, firstAtk.defImg, firstAtk.side, firstAtk.defSide, firstTargetHP, firstTargetMaxHP, firstAtk.pet, firstAtk.name, escalation, false, firstAtkHP, firstAtkMaxHP);
    if(p1First) { p2HP = r1.hp; } else { p1HP = r1.hp; }
    if(p1HP <= 0 || p2HP <= 0) break;
    
    // === 反击！先手攻击造成>22%最大HP伤害时，防守方40%几率立即反击 ===
    if(!r1.dodged && r1.dmgDealt > firstTargetMaxHP * 0.22 && _pkRng() < 0.40) {
      await sleep(600);
      if(arena){const a=document.createElement('div');a.className='skill-announce';a.innerHTML='💥反击!';a.style.color='#ff55aa';a.style.textShadow='0 0 20px rgba(255,100,200,0.9),0 0 60px rgba(200,50,150,0.6),2px 2px 0 #550033';arena.appendChild(a);setTimeout(()=>a.remove(),1200);}
      await sleep(400);
      // 防守方反击（防守方=先手的对手发起反击）
      const counterPet1 = p1First ? p2.pet : p1.pet;
      const counterName1 = p1First ? p2.studentName : p1.studentName;
      if(p1First) {
        const rc = await doAttack(2, firstAtk.defImg, firstAtk.img, 2, 1, p1HP, p1MaxHP, counterPet1, counterName1, 0.8, false, p2HP, p2MaxHP);
        p1HP = rc.hp;
      } else {
        const rc = await doAttack(1, firstAtk.defImg, firstAtk.img, 1, 2, p2HP, p2MaxHP, counterPet1, counterName1, 0.8, false, p1HP, p1MaxHP);
        p2HP = rc.hp;
      }
      if(p1HP <= 0 || p2HP <= 0) break;
    }
    
    // 连击！15%几率触发额外攻击
    if(!r1.isCrit && !r1.dodged && _pkRng() < 0.15) {
      await sleep(500);
      if(arena){const a=document.createElement('div');a.className='skill-announce';a.textContent='⚡连击!';a.style.color='#ff9900';arena.appendChild(a);setTimeout(()=>a.remove(),1200);}
      if(p1First){
        const r=await doAttack(1,firstAtk.img,firstAtk.defImg,firstAtk.side,firstAtk.defSide,p2HP,p2MaxHP,firstAtk.pet,firstAtk.name,escalation,true,p1HP,p1MaxHP);
        p2HP=r.hp;
      } else {
        const r=await doAttack(2,firstAtk.img,firstAtk.defImg,firstAtk.side,firstAtk.defSide,p1HP,p1MaxHP,firstAtk.pet,firstAtk.name,escalation,true,p2HP,p2MaxHP);
        p1HP=r.hp;
      }
      if(p1HP <= 0 || p2HP <= 0) break;
    }
    await sleep(500);
    // === 后手攻击 ===
    const r2 = await doAttack(2, secondAtk.img, secondAtk.defImg, secondAtk.side, secondAtk.defSide, secondTargetHP, secondTargetMaxHP, secondAtk.pet, secondAtk.name, escalation, false, secondAtkHP, secondAtkMaxHP);
    if(p1First) { p1HP = r2.hp; } else { p2HP = r2.hp; }
    if(p1HP <= 0 || p2HP <= 0) break;
    
    // === 反击！后手攻击造成大伤害时，防守方40%几率反击 ===
    if(!r2.dodged && r2.dmgDealt > secondTargetMaxHP * 0.22 && _pkRng() < 0.40) {
      await sleep(600);
      if(arena){const a=document.createElement('div');a.className='skill-announce';a.innerHTML='💥反击!';a.style.color='#ff55aa';a.style.textShadow='0 0 20px rgba(255,100,200,0.9),0 0 60px rgba(200,50,150,0.6),2px 2px 0 #550033';arena.appendChild(a);setTimeout(()=>a.remove(),1200);}
      await sleep(400);
      // 防守方反击（后手防守方=后手的对手发起反击）
      const counterPet2 = p1First ? p1.pet : p2.pet;
      const counterName2 = p1First ? p1.studentName : p2.studentName;
      if(p1First) {
        const rc = await doAttack(1, secondAtk.defImg, secondAtk.img, 1, 2, p2HP, p2MaxHP, counterPet2, counterName2, 0.8, false, p1HP, p1MaxHP);
        p2HP = rc.hp;
      } else {
        const rc = await doAttack(2, secondAtk.defImg, secondAtk.img, 2, 1, p1HP, p1MaxHP, counterPet2, counterName2, 0.8, false, p2HP, p2MaxHP);
        p1HP = rc.hp;
      }
      if(p1HP <= 0 || p2HP <= 0) break;
    }
    
    // 后手连击
    if(!r2.isCrit && !r2.dodged && _pkRng() < 0.15) {
      await sleep(500);
      if(arena){const a=document.createElement('div');a.className='skill-announce';a.textContent='⚡连击!';a.style.color='#ff9900';arena.appendChild(a);setTimeout(()=>a.remove(),1200);}
      if(p1First){
        const r=await doAttack(2,secondAtk.img,secondAtk.defImg,secondAtk.side,secondAtk.defSide,p1HP,p1MaxHP,secondAtk.pet,secondAtk.name,escalation,true,p2HP,p2MaxHP);
        p1HP=r.hp;
      } else {
        const r=await doAttack(1,secondAtk.img,secondAtk.defImg,secondAtk.side,secondAtk.defSide,p2HP,p2MaxHP,secondAtk.pet,secondAtk.name,escalation,true,p1HP,p1MaxHP);
        p2HP=r.hp;
      }
      if(p1HP <= 0 || p2HP <= 0) break;
    }
  }
  // 若5回合仍未结束，HP少的一方直接败北（避免超持久战）
  if(p1HP > 0 && p2HP > 0) {
    if(p1HP/p1MaxHP < p2HP/p2MaxHP) { p1HP = 0; }
    else { p2HP = 0; }
  }
  await sleep(800);
  // === 战斗结果 ===
  const winnerStudent = (p2HP <= 0) ? student1 : student2;
  const loserStudent = (p2HP <= 0) ? student2 : student1;
  const winnerPet = (p2HP <= 0) ? p1.pet : p2.pet;
  const loserPet = (p2HP <= 0) ? p2.pet : p1.pet;
  const winnerSide = (p2HP <= 0) ? 1 : 2;
  let rewardCoin = 0;
  let penaltyCoin = 0;
  // 构建结果覆盖层
  const resultOverlay = document.createElement('div');
  resultOverlay.className = 'pk-result-overlay';
  if(p1HP <= 0 && p2HP <= 0) {
    resultOverlay.innerHTML = `<div class="pk-result-draw">平局</div><div class="pk-result-detail">双方势均力敌，无人获得金币奖励</div>`;
    showNotification('战斗平局', '双方都没有获得金币', 'info');
    // 记录平局（双方各一条）
    recordAction(student1.id, student1.name, 'PK平局', `${student1.name} vs ${student2.name} 平局`, 0, 0, p1.pet.id, {pkType:'draw', opponentId: student2.id, opponentName: student2.name});
    recordAction(student2.id, student2.name, 'PK平局', `${student2.name} vs ${student1.name} 平局`, 0, 0, p2.pet.id, {pkType:'draw', opponentId: student1.id, opponentName: student1.name});
  } else {
    rewardCoin = 15;
    penaltyCoin = -5;
    winnerStudent.coins += rewardCoin;
    loserStudent.coins += penaltyCoin;
    if(loserStudent.coins < 0) loserStudent.coins = 0;
    // 成长值奖惩：胜者+3，败者-1
    const winnerPrevGrowth = winnerPet.growth || 0;
    const loserPrevGrowth = loserPet.growth || 0;
    winnerPet.growth = winnerPrevGrowth + 3;
    loserPet.growth = Math.max(0, loserPrevGrowth - 1);
    const winnerGrowthDelta = 3;
    const loserGrowthDelta = loserPet.growth - loserPrevGrowth;
    const winnerImg = document.getElementById(`pk-img-${winnerSide}`);
    if(winnerImg) { winnerImg.style.filter = 'drop-shadow(0 0 40px rgba(255,215,0,0.9)) drop-shadow(0 0 80px rgba(255,200,0,0.6))'; winnerImg.style.transition = 'filter 0.6s ease'; }
    // 败方碎裂特效
    const loserImgEl = document.getElementById(`pk-img-${winnerSide === 1 ? 2 : 1}`);
    if(loserImgEl) applyClassPKShatterEffect(loserImgEl);
    resultOverlay.innerHTML = `
      <div class="pk-result-title">${esc(winnerStudent.name)} 胜利</div>
      <div class="pk-result-detail">${esc(winnerPet.nickname||winnerPet.name)} 击败了 ${esc(loserPet.nickname||loserPet.name)}</div>
      <div class="pk-result-detail" style="margin-top:16px;color:#55ff55;">+${rewardCoin} 金币 · +3 成长值 → ${esc(winnerStudent.name)}</div>
      <div class="pk-result-detail" style="color:#ff6666;">${penaltyCoin} 金币 · -1 成长值 → ${esc(loserStudent.name)}</div>
    `;
    showNotification('战斗胜利', `${winnerStudent.name} 获得 ${rewardCoin} 金币，成长值+3！`, 'success');
    showNotification('战斗失败', `${loserStudent.name} 损失 ${-penaltyCoin} 金币，成长值-1！`, 'error');
    // 记录胜方
    recordAction(winnerStudent.id, winnerStudent.name, 'PK胜利', `击败 ${loserStudent.name}（${loserPet.nickname||loserPet.name}）`, rewardCoin, winnerGrowthDelta, winnerPet.id, {pkType:'win', opponentId: loserStudent.id, opponentName: loserStudent.name, opponentPetId: loserPet.id, opponentCoinDelta: penaltyCoin, opponentGrowthDelta: loserGrowthDelta});
    // 记录败方
    recordAction(loserStudent.id, loserStudent.name, 'PK失败', `败给 ${winnerStudent.name}（${winnerPet.nickname||winnerPet.name}）`, penaltyCoin, loserGrowthDelta, loserPet.id, {pkType:'lose', opponentId: winnerStudent.id, opponentName: winnerStudent.name, opponentPetId: winnerPet.id, opponentCoinDelta: rewardCoin, opponentGrowthDelta: winnerGrowthDelta});
    playVictorySound();
  }
  if(arena) arena.appendChild(resultOverlay);
  const today = new Date().toDateString();
  student1.pkCountToday = (student1.lastPkDate === today) ? student1.pkCountToday + 1 : 1;
  student1.lastPkDate = today;
  student2.pkCountToday = (student2.lastPkDate === today) ? student2.pkCountToday + 1 : 1;
  student2.lastPkDate = today;
  saveClassData();
  renderHomePetGrid();
  renderClassTopThree();
  renderPKPage();
  if(currentBattleModalOverlay) {
    const exitBtn = currentBattleModalOverlay.querySelector('.modal-actions button');
    if(exitBtn) exitBtn.disabled = false;
  }
  pkState.isFighting = false;
  pkState._battleCompleted = true; // Mark this battle as completed to prevent re-start
  // Clean up seeded RNG
  _pkBattleRng = null;
  _pkBattleLeftMonsterIdx = -1;
  _pkBattleRightMonsterIdx = -1;
  pkState.battleSeed = null;
}

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

// ========== 课堂PK系统（图片导入+手写答题版）==========
let classPKState = {
  selectedStudents: [],
  isFighting: false,
  questions: [],       // 导入的题目图片 (dataURL array)
  currentRound: 0,
  totalRounds: 3,
  studentResults: {}   // { studentId: correctCount }
};

let _classPKRobotCache = [];
let _classPKRobotProbed = false;

function probeClassPKRobotImages() {
  return new Promise((resolve) => {
    if(_classPKRobotProbed) { resolve(); return; }
    let pending = 0;
    const done = () => { pending--; if(pending <= 0) { _classPKRobotProbed = true; resolve(); } };
    for(let i = 1; i <= 50; i++) {
      pending++;
      const img = new Image();
      const path = `战斗机器人/${i}.webp`;
      img.onload = () => { _classPKRobotCache.push(path); done(); };
      img.onerror = () => { done(); };
      img.src = path;
    }
    setTimeout(() => { _classPKRobotProbed = true; resolve(); }, 3000);
  });
}

function switchPKSubTab(tab) {
  document.querySelectorAll('.pk-sub-tab').forEach(t => t.classList.remove('active'));
  if(tab === 'petPK') {
    document.querySelectorAll('.pk-sub-tab')[0].classList.add('active');
    document.getElementById('pkPetBattleContent').style.display = '';
    document.getElementById('pkClassBattleContent').style.display = 'none';
    renderPKPage();
  } else {
    document.querySelectorAll('.pk-sub-tab')[1].classList.add('active');
    document.getElementById('pkPetBattleContent').style.display = 'none';
    document.getElementById('pkClassBattleContent').style.display = '';
    renderClassPKPage();
  }
}

// 绑定导入按钮
function bindClassPKImport() {
  const fileInput = document.getElementById('classpkQuestionImport');
  if(!fileInput || fileInput._bound) return;
  fileInput._bound = true;
  fileInput.addEventListener('change', function(e) {
    const files = Array.from(e.target.files);
    if(!files.length) return;
    let loaded = 0;
    files.forEach(file => {
      if(!file.type.startsWith('image/')) { loaded++; return; }
      const reader = new FileReader();
      reader.onload = (ev) => {
        classPKState.questions.push(ev.target.result);
        loaded++;
        if(loaded === files.length) {
          showNotification('导入成功', `已导入 ${classPKState.questions.length} 道题目图片`, 'success');
          renderClassPKPage();
        }
      };
      reader.onerror = () => { loaded++; };
      reader.readAsDataURL(file);
    });
    this.value = '';
  });
}

function clearClassPKQuestions() {
  if(!confirm('确定清空所有已导入的题目？')) return;
  classPKState.questions = [];
  renderClassPKPage();
}

// 中文TTS常见姓氏/多音字发音修正表（替换为同音正确字）
// 原理：将TTS常读错的姓氏字替换为TTS能正确朗读的同音字
const ttsPronFixMap = {
  '覃':'秦',   // qín 误读为 tán
  '仇':'求',   // qiú 误读为 chóu
  '区':'欧',   // ōu  误读为 qū
  '解':'谢',   // xiè 误读为 jiě
  '朴':'票',   // piáo 误读为 pǔ
  '单':'善',   // shàn 误读为 dān
  '曾':'增',   // zēng 误读为 céng
  '查':'渣',   // zhā 误读为 chá
  '盖':'葛',   // gě  误读为 gài
  '乐':'悦',   // yuè 误读为 lè
  '纪':'己',   // jǐ  误读为 jì
  '种':'崇',   // chóng 误读为 zhǒng
  '过':'锅',   // guō 误读为 guò
  '缪':'妙',   // miào 误读为 móu
  '谌':'陈',   // chén 误读为 shèn
  '燕':'烟',   // yān 误读为 yàn
  '任':'人',   // rén 误读为 rèn
  '繁':'婆',   // pó  误读为 fán
  '洗':'显',   // xiǎn 误读为 xǐ
  '翟':'宅',   // zhái 误读为 dí
  '秘':'闭',   // bì  误读为 mì
  '郗':'希',   // xī  误读为 xǐ
  '岑':'陈',   // cén 误读为 cén (部分TTS)
  '尉':'卫',   // wèi 误读为 yù
  '召':'照',   // zhào 误读为 zhāo
  '阚':'看',   // kàn 误读为 hǎn
  '黑':'贺',   // hè  误读为 hēi
  '员':'运',   // yùn 误读为 yuán
  '郇':'寻',   // xún 误读为 huán
  '阿':'额',   // ē  误读为 ā
  '沈':'沉',   // shěn 部分TTS误读为 chén
  '那':'拿'    // ná  误读为 nà
};
// 对播报文本做发音修正：将难读姓氏替换为同音常见字

// 课堂PK辅助
function fixTTSPronunciation(text) {
  let result = text;
  for(const [bad, good] of Object.entries(ttsPronFixMap)) {
    result = result.split(bad).join(good);
  }
  return result;
}


function randomSelectStudents() {
  if(checkPauseAndNotify()) return;
  const cur = classesData.find(c => c.id === currentClassId);
  if(!cur) return;
  
  const aliveStudents = cur.students.filter(s => {
    const p = getActivePet(s);
    return p && !p.isDead;
  });
  
  if(aliveStudents.length < 2) {
    showNotification('随机选人', '班级至少需要2名有存活宠物的学生', 'error');
    return;
  }
  
  // Shuffle and pick 2 random students
  const shuffled = [...aliveStudents].sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, 2);
  
  // Update state
  classPKState.selectedStudents = selected.map(s => s.id.toString());
  
  // Re-render UI
  renderClassPKPage();
  
  // Speech announcement（对姓名做发音修正后再播报）
  const rawAnnouncement = `请${selected[0].name}同学和${selected[1].name}同学携带你们的宠物登台对战`;
  const announcement = fixTTSPronunciation(rawAnnouncement);
  
  if('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(announcement);
    utterance.lang = 'zh-CN';
    utterance.rate = 0.9;
    utterance.pitch = 1.1;
    utterance.volume = 1;
    
    // 优先使用中文语音
    const voices = window.speechSynthesis.getVoices();
    const zhVoice = voices.find(v => v.lang.startsWith('zh')) || voices.find(v => v.lang.includes('zh'));
    if(zhVoice) {
      utterance.voice = zhVoice;
    }
    
    window.speechSynthesis.speak(utterance);
  }
  
  showNotification('随机选人成功', `已选择 ${selected[0].name} 和 ${selected[1].name}`, 'success');
}

function renderClassPKPage() {
  const container = document.getElementById('pkClassBattleContent');
  if(!currentClassId) {
    container.innerHTML = '<div style="text-align:center;padding:40px;">请先在【宠物管理】页面选择一个班级</div>';
    return;
  }
  const cur = classesData.find(c=>c.id===currentClassId);
  if(!cur || cur.students.length < 2) {
    container.innerHTML = '<div style="text-align:center;padding:40px;">班级至少需要2名学生才能开始课堂PK</div>';
    return;
  }

  // 如果没有导入题目，只显示导入区域
  if(classPKState.questions.length === 0) {
    let html = '';
    html += '<div class="classpk-import-zone">';
    html += '<label class="classpk-import-btn" for="classpkQuestionImport">📥 导入题目图片</label>';
    html += '<div class="classpk-import-count">已导入题目：<span>0</span> 道</div>';
    html += '<div style="font-size:13px;color:#888;margin-top:4px;width:100%;">支持批量导入多张图片作为题目，每张图片为一道题。导入后方可选择学生开始PK。</div>';
    html += '</div>';
    html += '<div style="text-align:center;padding:60px 20px;color:#bbb;font-size:16px;">📷 请先导入题目图片，然后才能选择学生开始PK</div>';
    container.innerHTML = html;
    bindClassPKImport();
    return;
  }

  const aliveStudents = cur.students.filter(s => {
    const p = getActivePet(s);
    return p && !p.isDead;
  });
  if(aliveStudents.length < 2) {
    container.innerHTML = '<div style="text-align:center;padding:40px;">班级至少需要2名有存活宠物的学生</div>';
    return;
  }

  let html = '';

  // 导入区（显示已导入数量，可继续导入或清空）
  html += '<div class="classpk-import-zone">';
  html += '<label class="classpk-import-btn" for="classpkQuestionImport">📥 继续导入</label>';
  html += '<div class="classpk-import-count">已导入题目：<span>' + classPKState.questions.length + '</span> 道</div>';
  html += '<button class="classpk-clear-btn" onclick="clearClassPKQuestions()">🗑️ 清空题目</button>';
  html += '<button class="classpk-random-btn" onclick="randomSelectStudents()">🎲 随机选人</button>';
  html += '</div>';

  html += '<h3 style="color:#4466aa;margin:16px 0 4px;font-size:18px;">👨‍🎓 选择参赛学生 <span style="font-size:13px;color:#888;font-weight:400;">（点击选择2人）</span></h3>';
  html += '<div class="classpk-student-grid">';
  aliveStudents.forEach(s => {
    const p = getActivePet(s);
    const isSelected = classPKState.selectedStudents.includes(s.id.toString());
    const petImg = getPetImage(p.name, p.level);
    html += `<div class="classpk-student-card ${isSelected?'selected':''}" onclick="selectClassPKStudent('${s.id}')">
      <div class="classpk-avatar">${petImg}</div>
      <div class="classpk-name">${esc(s.name)}</div>
      <div class="classpk-info">${esc(p.nickname||p.name)} Lv.${p.level}</div>
      <div class="classpk-info" style="color:#d4a017;">💰 ${s.coins}</div>
    </div>`;
  });
  html += '</div>';
  container.innerHTML = html;
  bindClassPKImport();

  // Start area button
  let startArea = document.getElementById('classpk-start-area');
  if(!startArea) {
    startArea = document.createElement('div');
    startArea.id = 'classpk-start-area';
    startArea.className = 'classpk-start-area';
    document.body.appendChild(startArea);
  }
  if(classPKState.selectedStudents.length === 2 && !classPKState.isFighting) {
    startArea.innerHTML = `<button class="classpk-start-btn" onclick="playClickSound();startClassPKBattle()">⚔️ 开始PK</button>`;
    startArea.classList.add('visible');
  } else {
    startArea.classList.remove('visible');
    startArea.innerHTML = '';
  }
}

function selectClassPKStudent(studentId) {
  if(checkPauseAndNotify()) return;
  if(classPKState.isFighting) return;
  const sid = studentId.toString();
  const idx = classPKState.selectedStudents.indexOf(sid);
  if(idx !== -1) {
    classPKState.selectedStudents.splice(idx, 1);
  } else {
    classPKState.selectedStudents.push(sid);
    if(classPKState.selectedStudents.length > 2) {
      classPKState.selectedStudents.shift();
    }
  }
  renderClassPKPage();
  
  // 当选中2名学生时，语音播报
  if(classPKState.selectedStudents.length === 2) {
    const cur = classesData.find(c => c.id === currentClassId);
    if(!cur) return;
    const s1 = cur.students.find(s => s.id.toString() === classPKState.selectedStudents[0]);
    const s2 = cur.students.find(s => s.id.toString() === classPKState.selectedStudents[1]);
    if(!s1 || !s2) return;
    
    const pet1 = getActivePet(s1);
    const pet2 = getActivePet(s2);
    if(!pet1 || !pet2) return;
    
    const rawAnnouncement = `请${s1.name}同学和${s2.name}同学携带你们的宠物登台对战`;
    const announcement = fixTTSPronunciation(rawAnnouncement);
    
    if('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      
      const utterance = new SpeechSynthesisUtterance(announcement);
      utterance.lang = 'zh-CN';
      utterance.rate = 0.9;
      utterance.pitch = 1.1;
      utterance.volume = 1;
      
      const voices = window.speechSynthesis.getVoices();
      const zhVoice = voices.find(v => v.lang.startsWith('zh')) || voices.find(v => v.lang.includes('zh'));
      if(zhVoice) {
        utterance.voice = zhVoice;
      }
      
      window.speechSynthesis.speak(utterance);
    }
  }
}

// ========== 双屏手写答题系统（Pointer Events 独立多点触控版）==========
let dualQuizState = {
  overlay: null,
  student1: null,
  student2: null,
  round: 0,
  totalRounds: 3,
  results: { s1: 0, s2: 0 },
  canvases: { left: null, right: null },
  contexts: { left: null, right: null },
  submitted: { left: false, right: false },
  judged: { left: false, right: false },
  activePointers: { left: new Map(), right: new Map() }, // pointerId -> lastPos
  strokeColor: { left: '#000000', right: '#000000' },
  isErasing: { left: false, right: false },
  resolve: null
};

function startDualQuiz(student1, student2) {
  return new Promise((resolve) => {
    dualQuizState.student1 = student1;
    dualQuizState.student2 = student2;
    dualQuizState.round = 0;
    dualQuizState.totalRounds = Math.min(3, classPKState.questions.length);
    dualQuizState.results = { s1: 0, s2: 0 };
    dualQuizState.judged = { left: false, right: false };
    dualQuizState.activePointers = { left: new Map(), right: new Map() };
    dualQuizState.resolve = resolve;

    // 创建全屏覆盖
    const overlay = document.createElement('div');
    overlay.className = 'classpk-dual-overlay';
    overlay.id = 'classpk-dual-overlay';
    overlay.innerHTML = `
      <div class="classpk-dual-header">
        📝 课堂PK 答题环节
        <span class="round-info" id="dual-round-info">第 1/${dualQuizState.totalRounds} 题</span>
      </div>
      <div class="classpk-dual-body">
        <div class="classpk-dual-side left" id="dual-side-left">
          <div class="classpk-dual-side-header">👤 ${student1.name}</div>
          <div class="classpk-dual-canvas-wrap" id="dual-canvas-wrap-left">
            <img class="q-img" id="dual-qimg-left" src="" alt="">
            <canvas id="dual-canvas-left" width="1200" height="700"></canvas>
          </div>
          <div class="classpk-dual-toolbar" id="dual-toolbar-left">
            <div class="classpk-dual-colors">
              <button style="background:#000" data-side="left" data-color="#000000" class="active" onclick="setDualColor('left','#000000',this)"></button>
              <button style="background:#ff0000" data-side="left" data-color="#ff0000" onclick="setDualColor('left','#ff0000',this)"></button>
              <button style="background:#0000ff" data-side="left" data-color="#0000ff" onclick="setDualColor('left','#0000ff',this)"></button>
              <button style="background:#2ecc71" data-side="left" data-color="#2ecc71" onclick="setDualColor('left','#2ecc71',this)"></button>
            </div>
            <button class="clr-btn" onclick="toggleDualErase('left')">🧹 擦除</button>
            <button class="cls-btn" onclick="clearDualCanvas('left')">🗑️ 清空</button>
            <button class="sub-btn" id="dual-submit-left" onclick="submitDualAnswer('left')">✍️ 提交</button>
          </div>
          <div class="classpk-dual-judge" id="dual-judge-left">
            <button class="judge-correct" onclick="judgeDualAnswer('left',true)">✔️ 正确</button>
            <button class="judge-wrong" onclick="judgeDualAnswer('left',false)">❌ 错误</button>
          </div>
        </div>
        <div class="classpk-dual-side right" id="dual-side-right">
          <div class="classpk-dual-side-header">👤 ${student2.name}</div>
          <div class="classpk-dual-canvas-wrap" id="dual-canvas-wrap-right">
            <img class="q-img" id="dual-qimg-right" src="" alt="">
            <canvas id="dual-canvas-right" width="1200" height="700"></canvas>
          </div>
          <div class="classpk-dual-toolbar" id="dual-toolbar-right">
            <div class="classpk-dual-colors">
              <button style="background:#000" data-side="right" data-color="#000000" class="active" onclick="setDualColor('right','#000000',this)"></button>
              <button style="background:#ff0000" data-side="right" data-color="#ff0000" onclick="setDualColor('right','#ff0000',this)"></button>
              <button style="background:#0000ff" data-side="right" data-color="#0000ff" onclick="setDualColor('right','#0000ff',this)"></button>
              <button style="background:#2ecc71" data-side="right" data-color="#2ecc71" onclick="setDualColor('right','#2ecc71',this)"></button>
            </div>
            <button class="clr-btn" onclick="toggleDualErase('right')">🧹 擦除</button>
            <button class="cls-btn" onclick="clearDualCanvas('right')">🗑️ 清空</button>
            <button class="sub-btn" id="dual-submit-right" onclick="submitDualAnswer('right')">✍️ 提交</button>
          </div>
          <div class="classpk-dual-judge" id="dual-judge-right">
            <button class="judge-correct" onclick="judgeDualAnswer('right',true)">✔️ 正确</button>
            <button class="judge-wrong" onclick="judgeDualAnswer('right',false)">❌ 错误</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    dualQuizState.overlay = overlay;

    // 初始化canvas
    ['left', 'right'].forEach(side => {
      const canvas = document.getElementById(`dual-canvas-${side}`);
      dualQuizState.canvases[side] = canvas;
      dualQuizState.contexts[side] = canvas.getContext('2d');
      resizeDualCanvas(side);
      bindDualCanvasEvents(side);
    });
    window.addEventListener('resize', () => {
      ['left','right'].forEach(resizeDualCanvas);
    });

    showDualRound();
  });
}

function resizeDualCanvas(side) {
  const wrap = document.getElementById(`dual-canvas-wrap-${side}`);
  const canvas = dualQuizState.canvases[side];
  if(!wrap || !canvas) return;
  const rect = wrap.getBoundingClientRect();
  canvas.width = rect.width;
  canvas.height = rect.height;
  canvas.style.width = rect.width + 'px';
  canvas.style.height = rect.height + 'px';
}

function bindDualCanvasEvents(side) {
  const canvas = dualQuizState.canvases[side];
  if(!canvas || canvas._bound) return;
  canvas._bound = true;

  function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    const sx = canvas.width / rect.width;
    const sy = canvas.height / rect.height;
    return { x: (e.clientX - rect.left) * sx, y: (e.clientY - rect.top) * sy };
  }

  function drawLine(side, from, to) {
    const ctx = dualQuizState.contexts[side];
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.strokeStyle = dualQuizState.isErasing[side] ? 'rgba(30,30,50,1)' : dualQuizState.strokeColor[side];
    ctx.lineWidth = dualQuizState.isErasing[side] ? 20 : 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalCompositeOperation = dualQuizState.isErasing[side] ? 'destination-out' : 'source-over';
    ctx.stroke();
  }

  // Pointer Down — 开始一个新的 pointer 追踪
  canvas.addEventListener('pointerdown', (e) => {
    if(dualQuizState.submitted[side]) return;
    e.preventDefault();
    const pos = getPos(e);
    dualQuizState.activePointers[side].set(e.pointerId, pos);
    // 设置 canvas 捕获该 pointer，确保后续 pointermove/pointerup 都发到此 canvas
    try { canvas.setPointerCapture(e.pointerId); } catch(ex) {}
  });

  // Pointer Move — 根据 pointerId 追踪每个独立指针
  canvas.addEventListener('pointermove', (e) => {
    if(dualQuizState.submitted[side]) return;
    e.preventDefault();
    const pointers = dualQuizState.activePointers[side];
    if(!pointers.has(e.pointerId)) return; // 不是本 canvas 上的活跃指针
    const prevPos = pointers.get(e.pointerId);
    const curPos = getPos(e);
    drawLine(side, prevPos, curPos);
    pointers.set(e.pointerId, curPos);
  });

  // Pointer Up / Cancel — 结束该 pointer 追踪
  function onPointerEnd(e) {
    e.preventDefault();
    dualQuizState.activePointers[side].delete(e.pointerId);
    try { canvas.releasePointerCapture(e.pointerId); } catch(ex) {}
  }
  canvas.addEventListener('pointerup', onPointerEnd);
  canvas.addEventListener('pointercancel', onPointerEnd);
  canvas.addEventListener('pointerleave', onPointerEnd);

  // 阻止默认触摸行为（防止浏览器缩放手势等干扰）
  canvas.addEventListener('touchstart', (e) => e.preventDefault(), {passive:false});
  canvas.addEventListener('touchmove', (e) => e.preventDefault(), {passive:false});
}

function setDualColor(side, color, btn) {
  dualQuizState.strokeColor[side] = color;
  dualQuizState.isErasing[side] = false;
  const toolbar = document.getElementById(`dual-toolbar-${side}`);
  if(toolbar) toolbar.querySelectorAll('.classpk-dual-colors button').forEach(b => b.classList.remove('active'));
  if(btn) btn.classList.add('active');
}

function toggleDualErase(side) {
  dualQuizState.isErasing[side] = !dualQuizState.isErasing[side];
}

function clearDualCanvas(side) {
  const ctx = dualQuizState.contexts[side];
  const canvas = dualQuizState.canvases[side];
  if(ctx && canvas) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = 'source-over';
  }
}

function submitDualAnswer(side) {
  dualQuizState.submitted[side] = true;
  const btn = document.getElementById(`dual-submit-${side}`);
  if(btn) { btn.disabled = true; btn.textContent = '已提交'; }
  const judge = document.getElementById(`dual-judge-${side}`);
  if(judge) judge.classList.add('show');
}

function judgeDualAnswer(side, correct) {
  const studentName = side === 'left' ? dualQuizState.student1.name : dualQuizState.student2.name;
  if(correct) {
    if(side === 'left') dualQuizState.results.s1++;
    else dualQuizState.results.s2++;
  }
  // 标记本方已判定
  dualQuizState.judged[side] = true;
  // 显示判定结果标记
  const wrap = document.getElementById(`dual-canvas-wrap-${side}`);
  if(wrap) {
    const tag = document.createElement('div');
    tag.className = 'classpk-dual-result-tag ' + (correct ? 'correct' : 'wrong');
    tag.textContent = correct ? '✔️' : '❌';
    wrap.appendChild(tag);
    setTimeout(() => tag.remove(), 1500);
  }
  // 隐藏判定按钮
  const judge = document.getElementById(`dual-judge-${side}`);
  if(judge) judge.classList.remove('show');

  // 如果双方都已判定（而非仅仅提交），进入下一题或结束
  if(dualQuizState.judged.left && dualQuizState.judged.right) {
    setTimeout(() => {
      dualQuizState.round++;
      if(dualQuizState.round >= dualQuizState.totalRounds) {
        endDualQuiz();
      } else {
        showDualRound();
      }
    }, 1000);
  }
}

function showDualRound() {
  const roundIdx = dualQuizState.round;
  const qImg = classPKState.questions[roundIdx % classPKState.questions.length];
  // 更新题目图片
  document.getElementById('dual-qimg-left').src = qImg;
  document.getElementById('dual-qimg-right').src = qImg;
  // 更新轮次信息
  const info = document.getElementById('dual-round-info');
  if(info) info.textContent = `第 ${roundIdx+1}/${dualQuizState.totalRounds} 题`;
  // 清空canvas和状态
  clearDualCanvas('left');
  clearDualCanvas('right');
  dualQuizState.submitted = { left: false, right: false };
  dualQuizState.judged = { left: false, right: false };
  dualQuizState.isErasing = { left: false, right: false };
  dualQuizState.activePointers = { left: new Map(), right: new Map() };
  ['left','right'].forEach(side => {
    const btn = document.getElementById(`dual-submit-${side}`);
    if(btn) { btn.disabled = false; btn.textContent = '✍️ 提交'; }
    const judge = document.getElementById(`dual-judge-${side}`);
    if(judge) judge.classList.remove('show');
  });
}

function endDualQuiz() {
  if(dualQuizState.overlay) {
    dualQuizState.overlay.remove();
    dualQuizState.overlay = null;
  }
  if(dualQuizState.resolve) {
    dualQuizState.resolve({
      s1Correct: dualQuizState.results.s1,
      s2Correct: dualQuizState.results.s2
    });
  }
}

// ========== 课堂PK对战流程 ==========
async function startClassPKBattle() {
  if(checkPauseAndNotify()) return;
  if(classPKState.selectedStudents.length !== 2) return;
  const cur = classesData.find(c=>c.id===currentClassId);
  const student1 = cur.students.find(s=>s.id.toString()===classPKState.selectedStudents[0]);
  const student2 = cur.students.find(s=>s.id.toString()===classPKState.selectedStudents[1]);
  if(!student1 || !student2 || student1.id === student2.id) {
    showNotification('选择错误','请选择两名不同的学生','error');
    return;
  }
  const pet1 = getActivePet(student1);
  const pet2 = getActivePet(student2);
  if(!pet1 || !pet2 || pet1.isDead || pet2.isDead) {
    showNotification('PK失败','宠物状态异常','error');
    return;
  }
  classPKState.isFighting = true;
  const startArea = document.getElementById('classpk-start-area');
  if(startArea) { startArea.classList.remove('visible'); }

  // Phase 1: 双屏同时答题
  showNotification('答题环节', `${student1.name} vs ${student2.name} 同时答题！`, 'info');
  await sleep(500);
  const quizResult = await startDualQuiz(student1, student2);
  const correct1 = quizResult.s1Correct;
  const correct2 = quizResult.s2Correct;

  showNotification('答题结束', `${student1.name}: ${correct1}题 | ${student2.name}: ${correct2}题`, 'info');
  await sleep(800);

  // Phase 2: Robot Battle
  await probeClassPKRobotImages();
  let robot1 = _classPKRobotCache.length > 0 ? _classPKRobotCache[Math.floor(Math.random() * _classPKRobotCache.length)] : null;
  let robot2 = robot1;
  if(_classPKRobotCache.length >= 2) {
    while(robot2 === robot1) {
      robot2 = _classPKRobotCache[Math.floor(Math.random() * _classPKRobotCache.length)];
    }
  }

  showClassPKRobotBattle(student1, student2, pet1, pet2, robot1, robot2, correct1, correct2);
}

let classPKBattleModal = null;

async function showClassPKRobotBattle(student1, student2, pet1, pet2, robot1, robot2, correct1, correct2) {
  const hpBonus1 = correct1 * 30;
  const hpBonus2 = correct2 * 30;
  const p1MaxHP = 160 + hpBonus1;
  const p2MaxHP = 160 + hpBonus2;
  let p1HP = p1MaxHP, p2HP = p2MaxHP;

  let p1WinProb = 0.5;
  if(correct1 > correct2) { p1WinProb = 0.6; }
  else if(correct2 > correct1) { p1WinProb = 0.4; }

  const pet1Img = getPetImageSrc(pet1.name, pet1.level);
  const pet2Img = getPetImageSrc(pet2.name, pet2.level);

  // 创建全屏对战界面
  const modalContent = `
    <div class="pk-arena" id="classpk-robot-arena" style="background:linear-gradient(180deg,#1a1a3a 0%,#0a0a20 100%);">
      <div class="pk-arena-particles" id="classpk-arena-particles"></div>
      <div class="pk-pet-side" id="classpk-side-1">
        <div class="pk-pet-name">${student1.name} · ${pet1.nickname||pet1.name}</div>
        <div class="pk-pet-img-container" id="classpk-img-1">
          <img src="${pet1Img}" style="max-width:100%;max-height:100%;object-fit:contain;" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2280%22>🐾</text></svg>'">
        </div>
        <div class="pk-hp-bar-container"><div class="pk-hp-bar" id="classpk-hp-bar-1"></div></div>
        <div class="pk-hp-text" id="classpk-hp-text-1">准备变身...</div>
      </div>
      <div class="pk-vs" id="classpk-vs-text">VS</div>
      <div class="pk-pet-side" id="classpk-side-2">
        <div class="pk-pet-name">${student2.name} · ${pet2.nickname||pet2.name}</div>
        <div class="pk-pet-img-container" id="classpk-img-2">
          <img src="${pet2Img}" style="max-width:100%;max-height:100%;object-fit:contain;" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2280%22>🐾</text></svg>'">
        </div>
        <div class="pk-hp-bar-container"><div class="pk-hp-bar" id="classpk-hp-bar-2"></div></div>
        <div class="pk-hp-text" id="classpk-hp-text-2">准备变身...</div>
      </div>
    </div>
  `;

  const actions = [{text:'退出', class:'btn-secondary', onclick:'closeClassPKModal()', disabled: true}];
  classPKBattleModal = showModal('🤖 课堂PK对战 - 宠物变身中...', modalContent, actions, false, 'pk-fullscreen');

  // 添加粒子效果
  setTimeout(() => {
    const particlesDiv = document.getElementById('classpk-arena-particles');
    if(particlesDiv) {
      for(let i = 0; i < 12; i++) {
        const ember = document.createElement('div');
        ember.style.cssText = `position:absolute;width:${2+Math.random()*4}px;height:${2+Math.random()*4}px;background:rgba(100,150,255,${0.3+Math.random()*0.5});border-radius:50%;left:${Math.random()*100}%;bottom:0;animation:emberFloat ${3+Math.random()*4}s ease-in-out infinite;animation-delay:${Math.random()*3}s;will-change:transform,opacity;contain:strict;`;
        particlesDiv.appendChild(ember);
      }
    }
  }, 100);

  // 禁用退出按钮
  if(classPKBattleModal){
    const exitBtn = classPKBattleModal.querySelector('.modal-actions button');
    if(exitBtn) exitBtn.disabled = true;
  }

  // 开始变身序列
  await sleep(600);
  await runClassPKTransformSequence(student1, student2, pet1, pet2, robot1, robot2, pet1Img, pet2Img);
  
  // 开始对战
  await startClassPKBattleLoop(student1, student2, pet1, pet2, p1HP, p2HP, p1MaxHP, p2MaxHP, p1WinProb);
}

async function runClassPKTransformSequence(student1, student2, pet1, pet2, robot1, robot2, pet1Img, pet2Img) {
  const img1 = document.getElementById('classpk-img-1');
  const img2 = document.getElementById('classpk-img-2');
  const vsText = document.getElementById('classpk-vs-text');
  
  await sleep(300);

  // 阶段1：机器人立即出现（无抖动碎裂）
  // 左侧宠物朝右（不翻转），右侧宠物朝左（翻转）
  // 驾驶舱位置先不设置top/left，等图片加载后用JS计算
  // 驾驶舱缩小到60px，位置微调：整体下移0.5cm，左宠物右移0.3cm，右宠物左移0.3cm
  const cockpitHtml1 = `<div style="position:absolute;transform:translate(-50%,-50%);width:90px;height:90px;border-radius:50%;overflow:hidden;z-index:5;display:none;" class="cockpit-pet" data-cx="0.513" data-cy="0.44"><img src="${pet1Img}" style="width:90%;height:90%;object-fit:contain;margin:5% auto;display:block;" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2280%22>🐾</text></svg>'"></div>`;
  const cockpitHtml2 = `<div style="position:absolute;transform:translate(-50%,-50%);width:90px;height:90px;border-radius:50%;overflow:hidden;z-index:5;display:none;" class="cockpit-pet" data-cx="0.487" data-cy="0.44"><img src="${pet2Img}" style="width:90%;height:90%;object-fit:contain;margin:5% auto;display:block;transform:scaleX(-1);" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2280%22>🐾</text></svg>'"></div>`;
  
  img1.innerHTML = `
    <div style="position:relative;width:100%;height:100%;display:flex;align-items:center;justify-content:center;">
      <img src="${robot1||''}" class="robot-mecha-img" style="max-width:100%;max-height:100%;object-fit:contain;opacity:0;animation:monsterReveal 0.8s ease-out forwards;filter:drop-shadow(0 10px 30px rgba(0,0,0,0.9));" onerror="this.style.display='none';this.parentNode.innerHTML='<span style=\\'font-size:120px;opacity:0;animation:monsterReveal 0.8s ease-out forwards;display:inline-block;filter:drop-shadow(0 0 20px rgba(100,150,255,0.6);\\'>🤖</span>'+this.parentNode.querySelector('.cockpit-pet')?.outerHTML;">
      ${cockpitHtml1}
    </div>
  `;
  
  img2.innerHTML = `
    <div style="position:relative;width:100%;height:100%;display:flex;align-items:center;justify-content:center;">
      <img src="${robot2||''}" class="robot-mecha-img" style="max-width:100%;max-height:100%;object-fit:contain;opacity:0;animation:monsterRevealRight 0.8s ease-out forwards;filter:drop-shadow(0 10px 30px rgba(0,0,0,0.9));" onerror="this.style.display='none';this.parentNode.innerHTML='<span style=\\'font-size:120px;opacity:0;animation:monsterRevealRight 0.8s ease-out forwards;display:inline-block;filter:drop-shadow(0 0 20px rgba(255,100,150,0.6);\\'>🤖</span>'+this.parentNode.querySelector('.cockpit-pet')?.outerHTML;">
      ${cockpitHtml2}
    </div>
  `;
  
  playTransformSound();
  await sleep(900);
  
  // 用JS精确计算驾驶舱位置：根据object-fit:contain的实际渲染位置
  function positionCockpit(containerEl) {
    const wrapper = containerEl.querySelector('div');
    if (!wrapper) return;
    const robotImg = wrapper.querySelector('img.robot-mecha-img');
    const cockpit = wrapper.querySelector('.cockpit-pet');
    if (!robotImg || !cockpit || !robotImg.naturalWidth) return;
    
    const wW = wrapper.clientWidth;
    const wH = wrapper.clientHeight;
    const iW = robotImg.naturalWidth;
    const iH = robotImg.naturalHeight;
    const scale = Math.min(wW / iW, wH / iH);
    const rW = iW * scale;
    const rH = iH * scale;
    const oX = (wW - rW) / 2;
    const oY = (wH - rH) / 2;
    
    const cx = parseFloat(cockpit.dataset.cx) || 0.50;
    const cy = parseFloat(cockpit.dataset.cy) || 0.46;
    
    // v47: 向上偏移57px（约1.5cm @96DPI）
    cockpit.style.left = (oX + rW * cx) + 'px';
    cockpit.style.top = (oY + rH * cy - 57) + 'px';
  }
  
  positionCockpit(img1);
  positionCockpit(img2);
  
  // 阶段2：宠物从大体型缩小飞入驾驶室
  // 获取宠物原始大尺寸位置（相对img容器）
  const img1Rect = img1.getBoundingClientRect();
  const img2Rect = img2.getBoundingClientRect();
  
  // 计算机甲图片实际渲染区域（object-fit:contain）
  function getMechaRenderBounds(containerEl) {
    const wrapper = containerEl.querySelector('div');
    if (!wrapper) return containerEl.getBoundingClientRect();
    const robotImg = wrapper.querySelector('img.robot-mecha-img');
    if (!robotImg || !robotImg.naturalWidth) return wrapper.getBoundingClientRect();
    
    const wRect = wrapper.getBoundingClientRect();
    const wW = wrapper.clientWidth;
    const wH = wrapper.clientHeight;
    const iW = robotImg.naturalWidth;
    const iH = robotImg.naturalHeight;
    const scale = Math.min(wW / iW, wH / iH);
    const rW = iW * scale;
    const rH = iH * scale;
    const oX = (wW - rW) / 2;
    const oY = (wH - rH) / 2;
    
    return {
      left: wRect.left + oX,
      top: wRect.top + oY,
      width: rW,
      height: rH,
      right: wRect.left + oX + rW,
      bottom: wRect.top + oY + rH
    };
  }
  
  const mecha1Bounds = getMechaRenderBounds(img1);
  const mecha2Bounds = getMechaRenderBounds(img2);
  
  // 左侧宠物：从中心大体型开始，缩小飞入驾驶室
  const petFly1 = document.createElement('div');
  petFly1.style.cssText = `position:fixed;z-index:1000;pointer-events:none;`;
  petFly1.innerHTML = `<img src="${pet1Img}" style="width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 0 15px rgba(100,150,255,0.8));" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2280%22>🐾</text></svg>'">`;
  document.body.appendChild(petFly1);
  
  // 起始位置：img1中心，大体型
  const startSize1 = Math.min(img1Rect.width * 0.7, img1Rect.height * 0.7);
  petFly1.style.width = startSize1 + 'px';
  petFly1.style.height = startSize1 + 'px';
  petFly1.style.left = (img1Rect.left + img1Rect.width/2 - startSize1/2) + 'px';
  petFly1.style.top = (img1Rect.top + img1Rect.height/2 - startSize1/2) + 'px';
  petFly1.style.transition = 'all 1.4s cubic-bezier(0.4, 0, 0.2, 1)';
  
  // 右侧宠物：同理，朝左（翻转）
  const petFly2 = document.createElement('div');
  petFly2.style.cssText = `position:fixed;z-index:1000;pointer-events:none;`;
  petFly2.innerHTML = `<img src="${pet2Img}" style="width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 0 15px rgba(255,100,150,0.8));transform:scaleX(-1);" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2280%22>🐾</text></svg>'">`;
  document.body.appendChild(petFly2);
  
  const startSize2 = Math.min(img2Rect.width * 0.7, img2Rect.height * 0.7);
  petFly2.style.width = startSize2 + 'px';
  petFly2.style.height = startSize2 + 'px';
  petFly2.style.left = (img2Rect.left + img2Rect.width/2 - startSize2/2) + 'px';
  petFly2.style.top = (img2Rect.top + img2Rect.height/2 - startSize2/2) + 'px';
  petFly2.style.transition = 'all 1.4s cubic-bezier(0.4, 0, 0.2, 1)';
  
  // 触发飞行动画 - 目标位置基于机甲图片实际渲染区域
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const targetSize = 90;
      // 左侧：飞向机甲胸口透明玻璃驾驶舱（cx=0.513, cy=0.44）
      // v47: 向上偏移57px（约1.5cm @96DPI）
      const targetX1 = mecha1Bounds.left + mecha1Bounds.width * 0.513 - targetSize/2;
      const targetY1 = mecha1Bounds.top + mecha1Bounds.height * 0.44 - targetSize/2 - 57;
      petFly1.style.width = targetSize + 'px';
      petFly1.style.height = targetSize + 'px';
      petFly1.style.left = targetX1 + 'px';
      petFly1.style.top = targetY1 + 'px';
      petFly1.style.opacity = '0.6';
      
      // 右侧：飞向机甲胸口透明玻璃驾驶舱（cx=0.487, cy=0.44）
      // v47: 向上偏移57px（约1.5cm @96DPI）
      const targetSize2 = 90;
      const targetX2 = mecha2Bounds.left + mecha2Bounds.width * 0.487 - targetSize2/2;
      const targetY2 = mecha2Bounds.top + mecha2Bounds.height * 0.44 - targetSize2/2 - 57;
      petFly2.style.width = targetSize2 + 'px';
      petFly2.style.height = targetSize2 + 'px';
      petFly2.style.left = targetX2 + 'px';
      petFly2.style.top = targetY2 + 'px';
      petFly2.style.opacity = '0.6';
    });
  });
  
  await sleep(1400);
  
  // 阶段3：宠物出现在驾驶室内（无光圈）
  const cockpit1 = img1.querySelector('.cockpit-pet');
  const cockpit2 = img2.querySelector('.cockpit-pet');
  if(cockpit1) cockpit1.style.display = 'block';
  if(cockpit2) cockpit2.style.display = 'block';
  
  // 移除飞行宠物元素
  petFly1.remove();
  petFly2.remove();
  
  await sleep(400);

  // 进入战斗状态 - 先锁定opacity防止机器人消失，再添加浮动动画
  img1.querySelectorAll('img, span').forEach(el => { el.style.opacity = '1'; el.style.filter = 'drop-shadow(0 10px 30px rgba(0,0,0,0.9))'; });
  img2.querySelectorAll('img, span').forEach(el => { el.style.opacity = '1'; el.style.filter = 'drop-shadow(0 10px 30px rgba(0,0,0,0.9))'; });
  img1.classList.add('battle-idle');
  img2.classList.add('battle-idle-right');
  if(vsText) { vsText.innerHTML = '⚔️'; vsText.style.color = '#88aaff'; vsText.style.textShadow = '0 0 20px rgba(100,150,255,0.8)'; }
  await sleep(500);
}

async function startClassPKBattleLoop(student1, student2, pet1, pet2, p1HP, p2HP, p1MaxHP, p2MaxHP, p1WinProb) {
  let turn = 0;
  const img1 = document.getElementById('classpk-img-1');
  const img2 = document.getElementById('classpk-img-2');
  const arena = document.getElementById('classpk-robot-arena');

  function updateHPBar(side, current, max) {
    const bar = document.getElementById(`classpk-hp-bar-${side}`);
    const text = document.getElementById(`classpk-hp-text-${side}`);
    if(bar) {
      const clamped = Math.max(0, Math.min(max, Math.floor(current)));
      const pct = (clamped/max)*100;
      bar.style.transition = 'none';
      bar.style.width = pct + '%';
      bar.offsetHeight; // force reflow
      bar.style.transition = 'width 0.4s ease';
      if(pct > 50) bar.style.background = 'linear-gradient(90deg, #44cc44, #88ff88)';
      else if(pct > 25) bar.style.background = 'linear-gradient(90deg, #ffaa00, #ffcc44)';
      else bar.style.background = 'linear-gradient(90deg, #ff3333, #ff6666)';
    }
    if(text) text.innerHTML = `HP: ${Math.max(0, Math.floor(current))}/${max}`;
  }

  updateHPBar(1, p1HP, p1MaxHP);
  updateHPBar(2, p2HP, p2MaxHP);

  // 攻击函数：基础18-26%最大HP，暴击12%倍率1.5-1.8x，连击15%，闪避8%，绝地反击，反击，逆袭加成，伤害封顶
  async function doAttack(atkSide, defSide, atkImg, defImg, defHP, defMaxHP, atkName, defName, atkPet, dmgMult, isComboAttack, atkHP, atkMaxHP) {
    const skill = getRandomSkill();
    showSkillAnnounce(arena, skill, atkName);
    await sleep(350);
    atkImg.classList.add(atkSide === 1 ? 'attack-lunge-right' : 'attack-lunge-left');

    // === 闪避判定：8%几率完全闪避（连击不可闪避）===
    const dodged = !isComboAttack && Math.random() < 0.08;
    if(dodged) {
      await sleep(200);
      if(arena){const a=document.createElement('div');a.className='skill-announce';a.innerHTML='💨闪避!';a.style.color='#66ddff';a.style.textShadow='0 0 20px rgba(100,200,255,0.9),0 0 60px rgba(50,150,255,0.6),2px 2px 0 #003355';arena.appendChild(a);setTimeout(()=>a.remove(),1200);}
      setTimeout(() => { atkImg.classList.remove('attack-lunge-right', 'attack-lunge-left'); }, 400);
      return { hp: defHP, isCrit: false, dodged: true, dmgDealt: 0 };
    }

    // 伤害按最大HP百分比：基础18-26%
    const minD = Math.floor(defMaxHP * 0.18);
    const maxD = Math.floor(defMaxHP * 0.26);
    let baseDmg = minD + Math.floor(Math.random() * (maxD - minD + 1));
    baseDmg = Math.floor(baseDmg * (dmgMult || 1));
    // === 绝地反击：血量越低伤害越高（温和版）===
    if(atkHP !== undefined && atkMaxHP) {
      const hpRatio = atkHP / atkMaxHP;
      if(hpRatio < 0.30) baseDmg = Math.floor(baseDmg * 1.25);
      else if(hpRatio < 0.50) baseDmg = Math.floor(baseDmg * 1.10);
    }
    // === 逆袭加成：血量落后对手越多，伤害越高 ===
    if(atkHP !== undefined && atkMaxHP && defHP !== undefined && defMaxHP) {
      const myRatio = atkHP / atkMaxHP;
      const enemyRatio = defHP / defMaxHP;
      const gap = enemyRatio - myRatio;
      if(gap > 0.30) baseDmg = Math.floor(baseDmg * 1.20);
      else if(gap > 0.15) baseDmg = Math.floor(baseDmg * 1.10);
    }
    // === 暴击：12%几率，1.5-1.8倍（降低爆发）===
    const isCrit = !isComboAttack && Math.random() < 0.12;
    let finalDmg;
    if(isCrit) {
      const critMult = 1.5 + Math.random() * 0.3;
      finalDmg = Math.floor(baseDmg * critMult);
    } else if(isComboAttack) {
      // 连击伤害提升到75%
      finalDmg = Math.floor(baseDmg * 0.75);
    } else {
      finalDmg = baseDmg;
    }
    // === 单次伤害封顶：不超过防守方最大HP的32% ===
    const dmgCap = Math.floor(defMaxHP * 0.32);
    finalDmg = Math.min(finalDmg, dmgCap);
    defHP -= finalDmg;

    await new Promise(resolve => {
      let resolved = false;
      const safeResolve = () => { if(!resolved) { resolved = true; resolve(); } };
      playSkillAttack(atkImg, defImg, isCrit, skill, safeResolve);
      setTimeout(safeResolve, 3000); // 安全超时：3秒后强制继续
    });
    defImg.classList.add('hit-flash');
    showDamageNumber(defImg, finalDmg, isCrit, isComboAttack);
    showAttackDamageText(atkImg, finalDmg, isCrit, isComboAttack);
    updateHPBar(defSide, defHP, defMaxHP);
    if(isCrit && arena){ arena.classList.add('screen-shake'); setTimeout(()=>arena.classList.remove('screen-shake'),500); }

    setTimeout(() => {
      atkImg.classList.remove('attack-lunge-right', 'attack-lunge-left');
      defImg.classList.remove('hit-flash');
    }, 400);

    return { hp: defHP, isCrit, dodged: false, dmgDealt: finalDmg };
  }

  // 主循环（最多5回合，通常3-5回合结束）
  while(p1HP > 0 && p2HP > 0 && turn < 5) {
    turn++;
    await sleep(500);
    // 后期加速：turn2后伤害快速提升（每回合+18%，封顶+54%）
    const escalation = turn >= 2 ? 1.0 + Math.min((turn - 1) * 0.18, 0.54) : 1.0;
    // 先手概率：答题优势方有60%几率先手（更平衡）
    const p1First = Math.random() < p1WinProb;

    // === 先手攻击 ===
    let r1;
    if(p1First) {
      r1 = await doAttack(1, 2, img1, img2, p2HP, p2MaxHP, student1.name, student2.name, pet1, escalation, false, p1HP, p1MaxHP);
      p2HP = r1.hp;
    } else {
      r1 = await doAttack(2, 1, img2, img1, p1HP, p1MaxHP, student2.name, student1.name, pet2, escalation, false, p2HP, p2MaxHP);
      p1HP = r1.hp;
    }
    if(p1HP <= 0 || p2HP <= 0) break;

    // === 反击！先手攻击造成>22%最大HP伤害时，防守方40%几率立即反击 ===
    if(!r1.dodged && r1.dmgDealt > (p1First ? p2MaxHP : p1MaxHP) * 0.22 && Math.random() < 0.40) {
      await sleep(600);
      if(arena){const a=document.createElement('div');a.className='skill-announce';a.innerHTML='💥反击!';a.style.color='#ff55aa';a.style.textShadow='0 0 20px rgba(255,100,200,0.9),0 0 60px rgba(200,50,150,0.6),2px 2px 0 #550033';arena.appendChild(a);setTimeout(()=>a.remove(),1200);}
      await sleep(400);
      const defHP_now = p1First ? p2HP : p1HP;
      const defMaxHP_local = p1First ? p2MaxHP : p1MaxHP;
      const atkHP_now = p1First ? p1HP : p2HP;
      const atkMaxHP_local = p1First ? p1MaxHP : p2MaxHP;
      if(p1First) {
        const rc = await doAttack(2, 1, img2, img1, p1HP, p1MaxHP, student2.name, student1.name, pet2, 0.8, false, p2HP, p2MaxHP);
        p1HP = rc.hp;
      } else {
        const rc = await doAttack(1, 2, img1, img2, p2HP, p2MaxHP, student1.name, student2.name, pet1, 0.8, false, p1HP, p1MaxHP);
        p2HP = rc.hp;
      }
      if(p1HP <= 0 || p2HP <= 0) break;
    }

    // 先手连击！15%几率触发
    if(!r1.isCrit && !r1.dodged && Math.random() < 0.15) {
      await sleep(500);
      if(arena){const a=document.createElement('div');a.className='skill-announce';a.textContent='⚡连击!';a.style.color='#ff9900';arena.appendChild(a);setTimeout(()=>a.remove(),1200);}
      if(p1First) {
        const rc = await doAttack(1, 2, img1, img2, p2HP, p2MaxHP, student1.name, student2.name, pet1, escalation, true, p1HP, p1MaxHP);
        p2HP = rc.hp;
      } else {
        const rc = await doAttack(2, 1, img2, img1, p1HP, p1MaxHP, student2.name, student1.name, pet2, escalation, true, p2HP, p2MaxHP);
        p1HP = rc.hp;
      }
      if(p1HP <= 0 || p2HP <= 0) break;
    }

    await sleep(500);

    // === 后手攻击 ===
    let r2;
    if(p1First) {
      r2 = await doAttack(2, 1, img2, img1, p1HP, p1MaxHP, student2.name, student1.name, pet2, escalation, false, p2HP, p2MaxHP);
      p1HP = r2.hp;
    } else {
      r2 = await doAttack(1, 2, img1, img2, p2HP, p2MaxHP, student1.name, student2.name, pet1, escalation, false, p1HP, p1MaxHP);
      p2HP = r2.hp;
    }
    if(p1HP <= 0 || p2HP <= 0) break;

    // === 反击！后手攻击造成大伤害时，防守方40%几率反击 ===
    if(!r2.dodged && r2.dmgDealt > (p1First ? p1MaxHP : p2MaxHP) * 0.22 && Math.random() < 0.40) {
      await sleep(600);
      if(arena){const a=document.createElement('div');a.className='skill-announce';a.innerHTML='💥反击!';a.style.color='#ff55aa';a.style.textShadow='0 0 20px rgba(255,100,200,0.9),0 0 60px rgba(200,50,150,0.6),2px 2px 0 #550033';arena.appendChild(a);setTimeout(()=>a.remove(),1200);}
      await sleep(400);
      if(p1First) {
        const rc = await doAttack(1, 2, img1, img2, p2HP, p2MaxHP, student1.name, student2.name, pet1, 0.8, false, p1HP, p1MaxHP);
        p2HP = rc.hp;
      } else {
        const rc = await doAttack(2, 1, img2, img1, p1HP, p1MaxHP, student2.name, student1.name, pet2, 0.8, false, p2HP, p2MaxHP);
        p1HP = rc.hp;
      }
      if(p1HP <= 0 || p2HP <= 0) break;
    }

    // 后手连击！15%几率触发
    if(!r2.isCrit && !r2.dodged && Math.random() < 0.15) {
      await sleep(500);
      if(arena){const a=document.createElement('div');a.className='skill-announce';a.textContent='⚡连击!';a.style.color='#ff9900';arena.appendChild(a);setTimeout(()=>a.remove(),1200);}
      if(p1First) {
        const rc = await doAttack(2, 1, img2, img1, p1HP, p1MaxHP, student2.name, student1.name, pet2, escalation, true, p2HP, p2MaxHP);
        p1HP = rc.hp;
      } else {
        const rc = await doAttack(1, 2, img1, img2, p2HP, p2MaxHP, student1.name, student2.name, pet1, escalation, true, p1HP, p1MaxHP);
        p2HP = rc.hp;
      }
      if(p1HP <= 0 || p2HP <= 0) break;
    }
  }

  // 超时裁决：HP少的一方败北
  if(p1HP > 0 && p2HP > 0) {
    if(p1HP/p1MaxHP < p2HP/p2MaxHP) { p1HP = 0; }
    else { p2HP = 0; }
  }

  await sleep(800);

  // 战斗结束 - 构建结果覆盖层
  const resultOverlay = document.createElement('div');
  resultOverlay.className = 'pk-result-overlay';

  if(p1HP <= 0 && p2HP <= 0) {
    // 平局
    resultOverlay.innerHTML = `
      <div class="pk-result-draw">平局</div>
      <div class="pk-result-detail">双方势均力敌！</div>
      <div class="pk-result-detail" style="margin-top:12px;color:#ffdd88;">各获得 5 金币 · 3 成长值</div>
    `;
    student1.coins += 5;
    student2.coins += 5;
    pet1.growth = (pet1.growth || 0) + 3;
    pet2.growth = (pet2.growth || 0) + 3;
    showNotification('课堂PK结果', '平局！双方各+5金币、+3成长值', 'info');
    recordAction(student1.id, student1.name, '课堂PK平局', `${student1.name} vs ${student2.name} 平局`, 5, 3, pet1.id, {pkType:'draw', opponentId: student2.id, opponentName: student2.name});
    recordAction(student2.id, student2.name, '课堂PK平局', `${student2.name} vs ${student1.name} 平局`, 5, 3, pet2.id, {pkType:'draw', opponentId: student1.id, opponentName: student1.name});
    playVictorySound();
  } else {
    const winnerSide = p2HP <= 0 ? 1 : 2;
    const winnerStudent = p2HP <= 0 ? student1 : student2;
    const loserStudent  = p2HP <= 0 ? student2 : student1;
    const winnerPet     = p2HP <= 0 ? pet1 : pet2;
    const loserPet      = p2HP <= 0 ? pet2 : pet1;
    const winnerImgEl   = document.getElementById(`classpk-img-${winnerSide}`);
    const loserImgEl    = document.getElementById(`classpk-img-${winnerSide === 1 ? 2 : 1}`);

    // 胜方光效 + 败方碎裂
    if(winnerImgEl) {
      winnerImgEl.style.filter = 'drop-shadow(0 0 40px rgba(255,215,0,0.9)) drop-shadow(0 0 80px rgba(255,200,0,0.5))';
      winnerImgEl.style.transition = 'filter 0.6s ease';
    }
    if(loserImgEl) applyClassPKShatterEffect(loserImgEl);

    // 发放奖励
    const winCoin = 20, winGrowth = 5;
    const loseCoin = 5,  loseGrowth = 3;
    winnerStudent.coins += winCoin;
    loserStudent.coins  += loseCoin;
    const prevWinnerGrowth = winnerPet.growth || 0;
    const prevLoserGrowth  = loserPet.growth  || 0;
    winnerPet.growth = prevWinnerGrowth + winGrowth;
    loserPet.growth  = prevLoserGrowth  + loseGrowth;

    resultOverlay.innerHTML = `
      <div class="pk-result-title">${esc(winnerStudent.name)} 胜利！</div>
      <div class="pk-result-detail">${esc(winnerPet.nickname||winnerPet.name)} 击败了 ${esc(loserPet.nickname||loserPet.name)}</div>
      <div class="pk-result-detail" style="margin-top:16px;color:#55ff55;">+${winCoin} 金币 · +${winGrowth} 成长值 → ${esc(winnerStudent.name)}</div>
      <div class="pk-result-detail" style="color:#ffcc66;">+${loseCoin} 金币 · +${loseGrowth} 成长值 → ${esc(loserStudent.name)}</div>
    `;
    showNotification('课堂PK胜利', `${winnerStudent.name} +${winCoin}金币、+${winGrowth}成长值！`, 'success');
    playVictorySound();

    recordAction(winnerStudent.id, winnerStudent.name, '课堂PK胜利', `击败 ${loserStudent.name}（${loserPet.nickname||loserPet.name}）`, winCoin, winGrowth, winnerPet.id, {pkType:'win', opponentId: loserStudent.id, opponentName: loserStudent.name});
    recordAction(loserStudent.id,  loserStudent.name,  '课堂PK失败', `败给 ${winnerStudent.name}（${winnerPet.nickname||winnerPet.name}）`, loseCoin, loseGrowth, loserPet.id,  {pkType:'lose', opponentId: winnerStudent.id, opponentName: winnerStudent.name});
  }

  if(arena) arena.appendChild(resultOverlay);

  saveClassData();
  renderHomePetGrid();
  renderClassTopThree();
  
  // 启用退出按钮
  if(classPKBattleModal) {
    const exitBtn = classPKBattleModal.querySelector('.modal-actions button');
    if(exitBtn) exitBtn.disabled = false;
  }
  
  classPKState.isFighting = false;
  classPKState.selectedStudents = [];
}

// 课堂PK败方碎裂特效（立即碎裂，碎片停留空中不消失）
function applyClassPKShatterEffect(el) {
  el.classList.add('jh-shatter-host');

  // 获取机器人图片源（第一个img就是机器人本体）
  const origImg = el.querySelector('img');
  let imgSrc = '';
  if (origImg) {
    imgSrc = origImg.src || origImg.getAttribute('src') || '';
  }
  if (!imgSrc) return;

  // 立即隐藏所有子元素
  // 课堂PK结构: div>div>img + div.cockpit-pet>img
  // 宠物PK结构: div>img (直接子元素结构)
  const innerDiv = el.querySelector('div');
  if (innerDiv) {
    innerDiv.style.opacity = '0';
    innerDiv.style.display = 'none';
  }

  // 同时直接隐藏所有 img 和 span 子元素（宠物PK的直接子元素结构）
  const directImgSpans = el.querySelectorAll(':scope > img, :scope > span');
  directImgSpans.forEach(child => {
    child.style.opacity = '0';
    child.style.display = 'none';
  });

  // 定义不规则碎片 clip-path + 飞散方向
  const tornPieces = [
    { clip:'polygon(0% 0%, 49% 0%, 48% 25%, 39% 31%, 33% 49%, 27% 54%,  0% 50%)', tx:-120, ty:-60, tr:-25 },
    { clip:'polygon(49% 0%, 100% 0%, 100% 26%, 76% 30%, 69% 46%, 60% 44%, 48% 25%)', tx:110, ty:-80, tr:20 },
    { clip:'polygon(100% 26%, 100% 53%, 78% 52%, 69% 46%, 76% 30%)', tx:140, ty:10, tr:30 },
    { clip:'polygon(0% 50%, 27% 54%, 33% 49%, 44% 51%, 34% 65%, 30% 79%, 0% 80%)', tx:-130, ty:40, tr:-18 },
    { clip:'polygon(33% 49%, 39% 31%, 48% 25%, 60% 44%, 69% 46%, 50% 65%, 44% 51%)', tx:20, ty:-50, tr:35 },
    { clip:'polygon(69% 46%, 78% 52%, 100% 53%, 100% 82%, 73% 80%, 63% 72%, 50% 65%)', tx:130, ty:50, tr:22 },
    { clip:'polygon(0% 80%, 30% 79%, 34% 65%, 50% 65%, 50% 83%, 40% 100%, 0% 100%)', tx:-100, ty:90, tr:-28 },
    { clip:'polygon(50% 65%, 63% 72%, 73% 80%, 70% 100%, 40% 100%, 50% 83%)', tx:30, ty:110, tr:15 },
    { clip:'polygon(73% 80%, 100% 82%, 100% 100%, 70% 100%)', tx:120, ty:100, tr:32 },
  ];

  // 立即生成碎片（无延迟，无闪光/裂纹前置特效）
  tornPieces.forEach((piece, i) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'jh-torn-piece-stay';
    const pieceImg = document.createElement('img');
    pieceImg.src = imgSrc;
    pieceImg.style.setProperty('--torn-clip', piece.clip);
    pieceImg.draggable = false;
    wrapper.appendChild(pieceImg);

    // 飞散方向加随机扰动
    const jx = piece.tx + (Math.random() - 0.5) * 40;
    const jy = piece.ty + (Math.random() - 0.5) * 30;
    const jr = piece.tr + (Math.random() - 0.5) * 20;
    wrapper.style.setProperty('--tx', jx + 'px');
    wrapper.style.setProperty('--ty', jy + 'px');
    wrapper.style.setProperty('--tr', jr + 'deg');
    wrapper.style.setProperty('--torn-dur', (1.0 + Math.random() * 0.4) + 's');
    wrapper.style.setProperty('--torn-delay', (i * 0.03) + 's');

    el.appendChild(wrapper);
  });

  // 碎屑粉尘（停留空中）
  for (let i = 0; i < 20; i++) {
    const dust = document.createElement('div');
    dust.className = 'jh-torn-dust-stay';
    const size = 2 + Math.random() * 5;
    dust.style.width = size + 'px';
    dust.style.height = size + 'px';
    dust.style.left = (20 + Math.random() * 60) + '%';
    dust.style.top = (20 + Math.random() * 60) + '%';
    dust.style.background = `rgba(${150+Math.random()*55},${180+Math.random()*50},${220+Math.random()*35},0.7)`;
    const ang = Math.random() * Math.PI * 2;
    const dist = 40 + Math.random() * 80;
    dust.style.setProperty('--dx', Math.cos(ang) * dist + 'px');
    dust.style.setProperty('--dy', Math.sin(ang) * dist + 'px');
    dust.style.setProperty('--ddur', (1 + Math.random() * 1.2) + 's');
    dust.style.setProperty('--ddelay', (Math.random() * 0.3) + 's');
    el.appendChild(dust);
  }
}

function closeClassPKModal() {
  if(classPKState.isFighting) {
    showNotification('战斗中', '战斗尚未结束，无法退出', 'warning');
    return;
  }
  closeModal();
  renderClassPKPage();
}

function getPetImageSrc(petName, level) {
  const cfg = PET_CONFIG[petName];
  if(!cfg) return '';
  return _img(`${cfg.id}/${level}.webp`);
}

function _startPKChallengePolling() {
  _stopPKChallengePolling();
  var pollStart = Date.now();
  _pkChallengePollTimer = setInterval(function() {
    // Stop after 5 minutes (timeout)
    if (Date.now() - pollStart > 5 * 60 * 1000 || pkState.isFighting) {
      _stopPKChallengePolling();
      return;
    }
    // Reload logs from Supabase and check for acceptance
    if (typeof _loadOperationLogs === 'function') {
      _loadOperationLogs().then(function() {
        if (typeof _syncOpLogsAlias === 'function') { try { _syncOpLogsAlias(); } catch(e) {} }
        _checkAcceptedPKChallenge();
      }).catch(function() {});
    }
  }, 5000); // v53: 5s interval (was 2s) — reduces 150 queries/challenge to 60
}

function _stopPKChallengePolling() {
  if (_pkChallengePollTimer) {
    clearInterval(_pkChallengePollTimer);
    _pkChallengePollTimer = null;
  }
}

// Helper: count pending challenges I sent today (not yet accepted/declined)
function _countMyPendingPKChallenges() {
  const isStudentView = typeof currentUser !== 'undefined' && currentUser && currentUser.type === 'student';
  if (!isStudentView) return { total: 0, targets: {} };
  const myStudentId = parseInt(currentUser.studentId);
  const today = new Date().toDateString();
  var _logs = getOpLogs();
  let total = 0;
  const targets = {}; // targetId -> count
  for (let i = 0; i < _logs.length; i++) {
    const log = _logs[i];
    if (log.actionType !== 'PK挑战') continue;
    if (log.reverted) continue;
    if (!log.extra || !log.extra.pkChallenge) continue;
    if (log.extra.challengerId !== myStudentId) continue;
    const logDate = new Date(log.timestamp).toDateString();
    if (logDate !== today) continue;
    if (log.extra.status !== 'pending') continue;
    // Check not expired (within 5 minutes)
    const challengeTime = new Date(log.timestamp).getTime();
    if (Date.now() - challengeTime > 5 * 60 * 1000) continue;
    total++;
    const tid = log.extra.targetId;
    targets[tid] = (targets[tid] || 0) + 1;
  }
  return { total, targets };
}

// Helper: check if I already have a pending/in-progress PK battle (only check isFighting flag)
function _hasActivePKBattle() {
  const isStudentView = typeof currentUser !== 'undefined' && currentUser && currentUser.type === 'student';
  if (!isStudentView) return false;
  // Only block if currently fighting - allow re-invite after battle completes
  return pkState.isFighting;
}

function selectPKOpponent(studentId) {
  if(pkState.isFighting) return;
  const isStudentView = typeof currentUser !== 'undefined' && currentUser && currentUser.type === 'student';
  if (!isStudentView) return selectPKPlayer(studentId); // Fall back to teacher behavior
  
  const myStudentId = parseInt(currentUser.studentId);
  const cur = classesData.find(c=>c.id===currentClassId);
  const myStudent = cur.students.find(s => s.id.toString() === myStudentId.toString());
  const opponent = cur.students.find(s=>s.id.toString()===studentId.toString());
  if (!myStudent || !opponent) return;
  
  const myPet = getActivePet(myStudent);
  const opponentPet = getActivePet(opponent);
  if (!myPet || !opponentPet) {
    showNotification('无法选择', '宠物未存活', 'warning');
    return;
  }
  
  // Always keep myself as first player, toggle opponent as second
  if (pkState.players.length === 2 && pkState.players[1].studentId.toString() === studentId.toString()) {
    // Deselect
    pkState.players = [{ studentId: myStudentId, studentName: myStudent.name, pet: {...myPet} }];
  } else {
    pkState.players = [
      { studentId: myStudentId, studentName: myStudent.name, pet: {...myPet} },
      { studentId: opponent.id, studentName: opponent.name, pet: {...opponentPet} }
    ];
  }
  renderPKPage();
}

function sendPKChallenge() {
  if (pkState.players.length !== 2) return;
  const isStudentView = typeof currentUser !== 'undefined' && currentUser && currentUser.type === 'student';
  if (!isStudentView) return;
  
  const myStudentId = parseInt(currentUser.studentId);
  const challenger = pkState.players.find(p => p.studentId === myStudentId);
  const target = pkState.players.find(p => p.studentId !== myStudentId);
  
  if (!challenger || !target) return;
  
  // === 邀请限制检查 ===
  // 1. 检查是否已经有活跃的战斗
  if (_hasActivePKBattle()) {
    showNotification('无法发起', '你已有一场进行中的PK，请等待结束', 'warning');
    pkState.players = [];
    renderPKPage();
    return;
  }
  
  // 2. 检查待处理邀请总数（最多3个）
  const pendingInfo = _countMyPendingPKChallenges();
  if (pendingInfo.total >= 3) {
    showNotification('邀请已满', '你最多同时向3位同学发出邀请，请等待对方回应', 'warning');
    pkState.players = [];
    renderPKPage();
    return;
  }
  
  // 3. 检查是否已经向同一学生发出过邀请（同一学生只能邀请一次）
  if (pendingInfo.targets[target.studentId] > 0) {
    showNotification('重复邀请', `你已经向 ${target.studentName} 发出过邀请，请等待对方回应`, 'warning');
    pkState.players = [];
    renderPKPage();
    return;
  }
  
  // Create challenge log entry
  const log = {
    id: _genLocalId(),
    timestamp: new Date().toISOString(),
    classId: currentClassId,
    studentId: target.studentId,
    studentName: target.studentName,
    actionType: 'PK挑战',
    details: `${challenger.studentName} 向 ${target.studentName} 发起PK挑战`,
    coinDelta: 0,
    expDelta: 0,
    petId: null,
    extra: {
      pkChallenge: true,
      challengerId: challenger.studentId,
      challengerName: challenger.studentName,
      targetId: target.studentId,
      targetName: target.studentName,
      status: 'pending',
      challengerPet: challenger.pet,
      targetPet: target.pet
    },
    reverted: false,
    _synced: false
  };
  
  window.operationLogs.push(log);
  saveLogs();
  
  // Show waiting message
  showNotification('挑战已发送', `等待 ${target.studentName} 接受挑战...`, 'info');
  
  // Store challenge state locally
  _pkChallengeState.pending = {
    challengerId: challenger.studentId,
    targetId: target.studentId,
    timestamp: Date.now()
  };
  
  // v35: Start fast polling to detect acceptance quickly (replaces 30s wait)
  _startPKChallengePolling();
  
  // Reset selection
  pkState.players = [];
  renderPKPage();
}

// v12: Show modal for student to select opponent and send challenge
function showStudentPKChallengeModal() {
  const isStudentView = typeof currentUser !== 'undefined' && currentUser && currentUser.type === 'student';
  if (!isStudentView) return;
  
  const myStudentId = parseInt(currentUser.studentId);
  const cur = classesData.find(c=>c.id===currentClassId);
  const myStudent = cur.students.find(s => s.id.toString() === myStudentId.toString());
  const myPet = myStudent ? getActivePet(myStudent) : null;
  
  if (!myStudent || !myPet) {
    showNotification('无法发起挑战', '你的宠物未存活', 'warning');
    return;
  }
  
  // Check if student has PK qualification
  if (!hasPKQualificationToday(myStudentId)) {
    showNotification('无PK资格', '今日需要通过奖惩/打卡/取金阁获得至少5金币', 'warning');
    return;
  }
  
  // Check daily PK limit
  if ((myStudent.pkCountToday || 0) >= 3) {
    showNotification('已达上限', '今日PK次数已用完（最多3次）', 'warning');
    return;
  }
  
  // Check pending invitations limit
  const pendingInfo = _countMyPendingPKChallenges();
  if (pendingInfo.total >= 3) {
    showNotification('邀请已满', '你最多同时向3位同学发出邀请，请等待对方回应', 'warning');
    return;
  }
  
  // Check for active battle
  if (_hasActivePKBattle()) {
    showNotification('无法发起', '你已有一场进行中的PK', 'warning');
    return;
  }
  
  // Get eligible opponents (exclude already-invited students)
  const opponents = cur.students.filter(s => {
    if (s.id.toString() === myStudentId.toString()) return false;
    const p = getActivePet(s);
    if (!p || p.isDead || !hasPKQualificationToday(s.id)) return false;
    // Exclude students I already have a pending invitation to
    if (pendingInfo.targets[s.id] > 0) return false;
    return true;
  });
  
  if (opponents.length === 0) {
    showNotification('无可挑战对象', '当前没有其他有资格的学生可挑战', 'info');
    return;
  }
  
  // Build opponent selection modal
  let html = `<div style="padding:12px;background:#f0f8ff;border-radius:12px;border:2px solid #4a90d9;margin-bottom:16px;">`;
  html += `<div style="font-size:13px;color:#4a90d9;margin-bottom:8px;">⚔️ 你的出战宠物</div>`;
  html += `<div style="display:flex;align-items:center;gap:12px;">
    <div style="font-size:36px;">${getPetImage(myPet.name, myPet.level)}</div>
    <div>
      <div style="font-weight:700;font-size:16px;">${esc(myStudent.name)}</div>
      <div style="font-size:14px;">${esc(myPet.nickname||myPet.name)} Lv.${myPet.level}</div>
      <div style="font-size:12px;color:#ff8844;">📊 今日PK: ${myStudent.pkCountToday || 0}/3次</div>
    </div>
  </div>`;
  html += `</div>`;
  
  html += `<div style="font-size:13px;color:#666;margin-bottom:8px;">选择一名对手发起挑战：</div>`;
  html += `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:15px;max-height:400px;overflow:auto;">`;
  opponents.forEach(s => {
    const p = getActivePet(s);
    html += `<div class="pk-opponent-item" onclick="selectStudentPKOpponentAndSend('${s.id}')" style="cursor:pointer;">
      <div class="pk-opponent-avatar">${getPetImage(p.name, p.level)}</div>
      <div>
        <div style="font-weight:700;">${esc(s.name)}</div>
        <div style="font-size:14px;">${esc(p.nickname||p.name)} Lv.${p.level}</div>
        <div style="font-size:12px;color:#885555;">成长: ${p.level>=9?getExpNeeded(p):p.growth}</div>
        <div style="font-size:12px;color:#d4a017;margin-top:2px;">💰 金币: ${s.coins}</div>
        <div style="font-size:12px;color:#ff8844;margin-top:4px;">📊 今日PK: ${s.pkCountToday || 0}/3次</div>
      </div>
    </div>`;
  });
  html += `</div>`;
  
  showModal('⚔️ 发起PK挑战', html, [{text:'取消', class:'btn-secondary', onclick:'closeModal()'}], true);
}

// v12: Select opponent and immediately send challenge
function selectStudentPKOpponentAndSend(opponentId) {
  const myStudentId = parseInt(currentUser.studentId);
  const cur = classesData.find(c=>c.id===currentClassId);
  const myStudent = cur.students.find(s => s.id.toString() === myStudentId.toString());
  const opponent = cur.students.find(s=>s.id.toString()===opponentId.toString());
  if (!myStudent || !opponent) return;
  
  const myPet = getActivePet(myStudent);
  const opponentPet = getActivePet(opponent);
  if (!myPet || !opponentPet) {
    showNotification('无法选择', '宠物未存活', 'warning');
    return;
  }
  
  // Check invitation limits before sending
  if (_hasActivePKBattle()) {
    showNotification('无法发起', '你已有一场进行中的PK', 'warning');
    return;
  }
  const pendingInfo = _countMyPendingPKChallenges();
  if (pendingInfo.total >= 3) {
    showNotification('邀请已满', '最多同时向3位同学发出邀请', 'warning');
    return;
  }
  if (pendingInfo.targets[opponent.id] > 0) {
    showNotification('重复邀请', `已向 ${opponent.name} 发出过邀请`, 'warning');
    return;
  }
  
  // Set up pkState for challenge
  pkState.players = [
    { studentId: myStudentId, studentName: myStudent.name, pet: {...myPet} },
    { studentId: opponent.id, studentName: opponent.name, pet: {...opponentPet} }
  ];
  
  closeModal();
  sendPKChallenge();
}

function _getPendingPKChallengeForMe() {
  const isStudentView = typeof currentUser !== 'undefined' && currentUser && currentUser.type === 'student';
  if (!isStudentView) return null;
  
  const myStudentId = parseInt(currentUser.studentId);
  const today = new Date().toDateString();
  
  // Look for pending challenges targeting me
  var _logs = getOpLogs();
  for (let i = _logs.length - 1; i >= 0; i--) {
    const log = _logs[i];
    if (log.actionType !== 'PK挑战') continue;
    if (log.reverted) continue;
    const logDate = new Date(log.timestamp).toDateString();
    if (logDate !== today) continue;
    if (!log.extra || !log.extra.pkChallenge) continue;
    if (log.extra.targetId !== myStudentId) continue;
    if (log.extra.status !== 'pending') continue;
    
    // Check if this challenge was already handled (accepted/declined)
    if (_handledPKChallengeIds.has(log.id)) continue;
    
    // Check if challenge is not too old (within 5 minutes)
    const challengeTime = new Date(log.timestamp).getTime();
    if (Date.now() - challengeTime > 5 * 60 * 1000) continue;
    
    return log;
  }
  return null;
}

function _checkPendingPKChallenge() {
  const challenge = _getPendingPKChallengeForMe();
  if (challenge) {
    _showPKChallengeDialog(challenge);
    return true;
  }
  return false;
}

// Check for pending PK challenges and update the badge on the PK tab
function _updatePKInviteBadge() {
  const isStudentView = typeof currentUser !== 'undefined' && currentUser && currentUser.type === 'student';
  const pkNavItem = document.getElementById('pk-nav-item');
  if (!pkNavItem) return;
  
  if (!isStudentView) {
    // Remove badge for teacher view
    const existingBadge = pkNavItem.querySelector('.pk-invite-badge');
    if (existingBadge) existingBadge.remove();
    return;
  }
  
  const challenge = _getPendingPKChallengeForMe();
  const existingBadge = pkNavItem.querySelector('.pk-invite-badge');
  
  if (challenge) {
    // Show badge if not already shown
    if (!existingBadge) {
      const badge = document.createElement('div');
      badge.className = 'pk-invite-badge';
      badge.innerHTML = '!';
      pkNavItem.appendChild(badge);
    }
  } else {
    // Remove badge if shown
    if (existingBadge) existingBadge.remove();
  }
}

// Handle PK tab click - show pending challenge if exists
function handlePKTabClick() {
  const isStudentView = typeof currentUser !== 'undefined' && currentUser && currentUser.type === 'student';
  
  if (isStudentView) {
    const challenge = _getPendingPKChallengeForMe();
    if (challenge) {
      if (_pkChallengeState._lastShownChallengeId !== challenge.id) {
        _pkChallengeState._lastShownChallengeId = challenge.id;
        _showPKChallengeDialog(challenge);
      }
      return;
    }
  }
  
  // No pending challenge, switch to PK page normally
  switchPage('pk-page');
}

function _showPKChallengeDialog(challenge) {
  const cur = classesData.find(c => c.id === currentClassId);
  if (!cur) return;
  
  const myStudentId = parseInt(currentUser.studentId);
  const myStudent = cur.students.find(s => s.id.toString() === myStudentId.toString());
  const myPet = myStudent ? getActivePet(myStudent) : null;
  
  const challengerName = challenge.extra.challengerName;
  const challengerPet = challenge.extra.challengerPet;
  
  const overlay = document.createElement('div');
  overlay.className = 'pk-challenge-overlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:10000;';
  
  overlay.innerHTML = `
    <div style="background:linear-gradient(135deg,#fff5e6,#ffe4b5);border-radius:20px;padding:30px;max-width:400px;text-align:center;box-shadow:0 10px 40px rgba(0,0,0,0.3);">
      <div style="font-size:48px;margin-bottom:16px;">⚔️</div>
      <h2 style="margin:0 0 8px 0;color:#a06040;">PK挑战！</h2>
      <p style="margin:0 0 20px 0;color:#666;">${esc(challengerName)} 向你发起PK挑战！</p>
      
      <div style="display:flex;justify-content:space-around;margin:20px 0;">
        <div style="text-align:center;">
          <div style="font-size:36px;margin-bottom:8px;">${challengerPet ? getPetImage(challengerPet.name, challengerPet.level) : '🐾'}</div>
          <div style="font-weight:700;">${esc(challengerName)}</div>
          <div style="font-size:12px;color:#888;">${challengerPet ? esc(challengerPet.nickname||challengerPet.name) + ' Lv.' + challengerPet.level : ''}</div>
        </div>
        <div style="font-size:36px;color:#a06040;align-self:center;">VS</div>
        <div style="text-align:center;">
          <div style="font-size:36px;margin-bottom:8px;">${myPet ? getPetImage(myPet.name, myPet.level) : '🐾'}</div>
          <div style="font-weight:700;">${esc(myStudent ? myStudent.name : '你')}</div>
          <div style="font-size:12px;color:#888;">${myPet ? esc(myPet.nickname||myPet.name) + ' Lv.' + myPet.level : ''}</div>
        </div>
      </div>
      
      <div style="display:flex;gap:12px;justify-content:center;margin-top:20px;">
        <button onclick="declinePKChallenge(${challenge.id})" style="padding:12px 24px;background:#ccc;color:#666;border:none;border-radius:20px;font-size:15px;font-weight:700;cursor:pointer;">拒绝</button>
        <button onclick="acceptPKChallenge(${challenge.id})" style="padding:12px 24px;background:linear-gradient(135deg,#ff6b6b,#ee5a24);color:white;border:none;border-radius:20px;font-size:15px;font-weight:700;cursor:pointer;">接受挑战！</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(overlay);
}

function acceptPKChallenge(challengeLogId) {
  // Remove overlay
  const overlay = document.querySelector('.pk-challenge-overlay');
  if (overlay) overlay.remove();
  
  // Prevent duplicate acceptance if already in a battle
  if (pkState.isFighting) {
    showNotification('战斗中', '你正在一场PK战斗中，无法接受新挑战', 'warning');
    return;
  }
  
  // Find the challenge log
  var _logs = getOpLogs();
  const log = _logs.find(l => l.id === challengeLogId);
  if (!log || !log.extra) return;
  
  // Check if already accepted or declined
  if (log.extra.status !== 'pending') {
    showNotification('已处理', '该挑战已被处理', 'info');
    return;
  }
  
  // Mark as accepted locally
  log.extra.status = 'accepted';
  // v34: Mark as unsynced so the status change is written back to Supabase
  log._synced = false;
  saveLogs();
  
  // Track this challenge as handled (prevents infinite loops on log reload)
  _handledPKChallengeIds.add(challengeLogId);
  _saveHandledPKChallengeIds();
  
  // Create a "PK接受" log entry to notify the challenger
  const myStudentId = parseInt(currentUser.studentId);
  const cur = classesData.find(c => c.id === currentClassId);
  const myStudent = cur.students.find(s => s.id.toString() === myStudentId.toString());
  const myPet = myStudent ? getActivePet(myStudent) : null;
  const challengerPet = log.extra.challengerPet;
  
  if (!myPet || !challengerPet) {
    showNotification('PK失败', '宠物状态异常', 'error');
    return;
  }
  
  // Generate battle seed for synchronized combat
  const battleSeed = Math.floor(Math.random() * 2147483647);
  
  // Create accept log entry for sync
  const acceptLog = {
    id: _genLocalId(),
    timestamp: new Date().toISOString(),
    classId: currentClassId,
    studentId: log.extra.challengerId,
    studentName: log.extra.challengerName,
    actionType: 'PK接受',
    details: `${myStudent.name} 接受了 ${log.extra.challengerName} 的PK挑战`,
    coinDelta: 0,
    expDelta: 0,
    petId: null,
    extra: {
      pkAccept: true,
      challengerId: log.extra.challengerId,
      challengerName: log.extra.challengerName,
      targetId: myStudentId,
      targetName: myStudent.name,
      challengerPet: challengerPet,
      targetPet: {...myPet},
      battleSeed: battleSeed
    },
    reverted: false,
    _synced: false
  };
  
  window.operationLogs.push(acceptLog);
  saveLogs();
  
  // Reset shown challenge tracking
  _pkChallengeState._lastShownChallengeId = null;
  
  // Set up PK state
  pkState.players = [
    { studentId: log.extra.challengerId, studentName: log.extra.challengerName, pet: {...challengerPet} },
    { studentId: myStudentId, studentName: myStudent.name, pet: {...myPet} }
  ];
  pkState.battleSeed = battleSeed;
  
  // Switch to PK page and start battle
  switchPage('pk-page');
  setTimeout(() => {
    startPKBattle();
  }, 500);
}

// Check for accepted PK challenges (for the challenger to start battle)
function _checkAcceptedPKChallenge() {
  const isStudentView = typeof currentUser !== 'undefined' && currentUser && currentUser.type === 'student';
  if (!isStudentView) return false;
  
  // Don't start a new battle if one is already in progress
  if (pkState.isFighting) return false;
  
  const myStudentId = parseInt(currentUser.studentId);
  const today = new Date().toDateString();
  
  // Look for accepted challenges where I am the challenger
  var _logs = getOpLogs();
  for (let i = _logs.length - 1; i >= 0; i--) {
    const log = _logs[i];
    if (log.actionType !== 'PK接受') continue;
    if (log.reverted) continue;
    const logDate = new Date(log.timestamp).toDateString();
    if (logDate !== today) continue;
    if (!log.extra || !log.extra.pkAccept) continue;
    if (log.extra.challengerId !== myStudentId) continue;
    
    // Check if this challenge was already handled (battle started)
    if (_handledPKChallengeIds.has(log.id)) continue;
    
    // Check if challenge is recent (within 10 minutes)
    const acceptTime = new Date(log.timestamp).getTime();
    if (Date.now() - acceptTime > 10 * 60 * 1000) continue;
    
    // Check if we haven't already started this battle
    if (log.extra._battleStarted) continue;
    
    // Mark as started to avoid duplicate starts
    log.extra._battleStarted = true;
    // v34: Mark as unsynced so the flag is written back to Supabase
    log._synced = false;
    // Persist the flag by saving logs
    saveLogs();
    
    // Track this challenge as handled (prevents infinite loops on log reload)
    _handledPKChallengeIds.add(log.id);
    _saveHandledPKChallengeIds();
    
    // Start the battle
    const challengerPet = log.extra.challengerPet;
    const targetPet = log.extra.targetPet;
    
    if (!challengerPet || !targetPet) return false;
    
    pkState.players = [
      { studentId: log.extra.challengerId, studentName: log.extra.challengerName, pet: {...challengerPet} },
      { studentId: log.extra.targetId, studentName: log.extra.targetName, pet: {...targetPet} }
    ];
    // Use the same battle seed generated by the accepting student
    pkState.battleSeed = log.extra.battleSeed || Math.floor(Math.random() * 2147483647);
    
    // Show notification and start battle
    showNotification('挑战被接受！', `${log.extra.targetName} 接受了你的挑战！`, 'success');
    // v35: Stop fast polling since we found the acceptance
    _stopPKChallengePolling();
    switchPage('pk-page');
    setTimeout(() => {
      startPKBattle();
    }, 500);
    
    return true;
  }
  return false;
}

function declinePKChallenge(challengeLogId) {
  // Remove overlay
  const overlay = document.querySelector('.pk-challenge-overlay');
  if (overlay) overlay.remove();
  
  // Find the challenge log and mark as declined
  var _logs = getOpLogs();
  const log = _logs.find(l => l.id === challengeLogId);
  if (log && log.extra) {
    log.extra.status = 'declined';
    // v34: Mark as unsynced so the status change is written back to Supabase
    log._synced = false;
    saveLogs();
    // Track this challenge as handled (prevents infinite loops on log reload)
    _handledPKChallengeIds.add(challengeLogId);
    _saveHandledPKChallengeIds();
  }
  
  // Reset shown challenge tracking
  _pkChallengeState._lastShownChallengeId = null;
  
  showNotification('已拒绝挑战', '你拒绝了PK挑战', 'info');
  renderPKPage();
}

function selectPKPlayer(studentId) {
  if(pkState.isFighting) return;
  const cur = classesData.find(c=>c.id===currentClassId);
  const student = cur.students.find(s=>s.id.toString()===studentId.toString());
  const pet = getActivePet(student);
  if(!pet || pet.isDead) {
    showNotification('无法选择', '宠物未存活', 'warning');
    return;
  }
  resetDailyPkCountIfNeeded(student);
  const existingIndex = pkState.players.findIndex(p => p.studentId === studentId);
  if(existingIndex !== -1) {
    pkState.players.splice(existingIndex, 1);
  } else {
    pkState.players.push({ studentId, studentName: student.name, pet: {...pet} });
    if(pkState.players.length > 2) {
      pkState.players.shift(); // 移除最早选中的
    }
  }
  renderPKPage();
}

function resetPKSelection() {
  pkState = { players: [], isFighting: false, _battleCompleted: false };
  renderPKPage();
}


function spawnThemeParticles(arena, skillType) {
  // 获取或创建粒子容器
  let particlesDiv = arena.querySelector('.pk-arena-particles');
  if(!particlesDiv) {
    particlesDiv = document.createElement('div');
    particlesDiv.className = 'pk-arena-particles';
    arena.appendChild(particlesDiv);
  }
  // 清空旧粒子
  particlesDiv.innerHTML = '';
  // 根据技能类型生成不同粒子
  const particleCount = 15;
  if(skillType === 'fire' || skillType === 'dragonfire') {
    // 火焰余烬
    for(let i = 0; i < particleCount; i++) {
      const ember = document.createElement('div');
      const size = 3 + Math.random() * 6;
      const colors = ['#ff6600','#ff9933','#ffcc00','#ff3300'];
      const color = colors[Math.floor(Math.random() * colors.length)];
      ember.style.cssText = `position:absolute;width:${size}px;height:${size}px;background:${color};border-radius:50%;left:${Math.random()*100}%;bottom:0;box-shadow:0 0 ${size*2}px ${color};animation:emberFloat ${3+Math.random()*4}s ease-in-out infinite;animation-delay:${Math.random()*2}s;opacity:0;`;
      particlesDiv.appendChild(ember);
      setTimeout(() => { ember.style.opacity = '0.8'; }, 100);
    }
  } else if(skillType === 'ice' || skillType === 'iceground') {
    // 冰晶
    for(let i = 0; i < particleCount; i++) {
      const crystal = document.createElement('div');
      const size = 8 + Math.random() * 15;
      const colors = ['#aaddff','#66ccff','#ffffff','#88eeff'];
      const color = colors[Math.floor(Math.random() * colors.length)];
      crystal.style.cssText = `position:absolute;width:${size}px;height:${size*1.5}px;background:${color};clip-path:polygon(50% 0%,100% 50%,50% 100%,0% 50%);left:${Math.random()*100}%;bottom:0;box-shadow:0 0 ${size}px ${color};animation:iceCrystalFloat ${4+Math.random()*3}s ease-in-out infinite;animation-delay:${Math.random()*2}s;opacity:0;`;
      particlesDiv.appendChild(crystal);
      setTimeout(() => { crystal.style.opacity = '0.9'; }, 100);
    }
  } else if(skillType === 'thunder') {
    // 雷电火花
    for(let i = 0; i < 20; i++) {
      const spark = document.createElement('div');
      const size = 4 + Math.random() * 8;
      spark.style.cssText = `position:absolute;width:${size}px;height:${size}px;background:#ffff88;border-radius:50%;left:${Math.random()*100}%;top:${Math.random()*100}%;box-shadow:0 0 ${size*3}px #ffff00,0 0 ${size*5}px #ffaa00;--lx:${(Math.random()-0.5)*100}px;--ly:${(Math.random()-0.5)*100}px;animation:lightningSpark ${0.5+Math.random()*0.5}s ease-out infinite;animation-delay:${Math.random()*1}s;opacity:0;`;
      particlesDiv.appendChild(spark);
    }
  } else if(skillType === 'poison') {
    // 毒雾泡泡
    for(let i = 0; i < particleCount; i++) {
      const bubble = document.createElement('div');
      const size = 10 + Math.random() * 20;
      const colors = ['#66ff33','#99ff66','#33cc00'];
      const color = colors[Math.floor(Math.random() * colors.length)];
      bubble.style.cssText = `position:absolute;width:${size}px;height:${size}px;background:radial-gradient(circle,${color},transparent);border-radius:50%;left:${Math.random()*100}%;bottom:0;box-shadow:0 0 ${size}px ${color};animation:poisonBubble ${3+Math.random()*4}s ease-out infinite;animation-delay:${Math.random()*2}s;opacity:0;`;
      particlesDiv.appendChild(bubble);
    }
  } else if(skillType === 'wind') {
    // 风之树叶
    for(let i = 0; i < 12; i++) {
      const leaf = document.createElement('div');
      const size = 12 + Math.random() * 18;
      const colors = ['#88ccff','#aaddff','#66bbee'];
      const color = colors[Math.floor(Math.random() * colors.length)];
      leaf.style.cssText = `position:absolute;width:${size}px;height:${size*0.6}px;background:${color};border-radius:50% 0 50% 0;left:${Math.random()*100}%;top:${Math.random()*100}%;box-shadow:0 0 ${size/2}px ${color};--wx:${200+Math.random()*300}px;--wy:${-50+Math.random()*100}px;animation:windLeaf ${2+Math.random()*2}s ease-out infinite;animation-delay:${Math.random()*2}s;opacity:0;`;
      particlesDiv.appendChild(leaf);
    }
  } else if(skillType === 'shadow') {
    // 暗影游魂
    for(let i = 0; i < 10; i++) {
      const wisp = document.createElement('div');
      const size = 20 + Math.random() * 30;
      wisp.style.cssText = `position:absolute;width:${size}px;height:${size}px;background:radial-gradient(circle,rgba(150,50,255,0.8),transparent);border-radius:50%;left:${Math.random()*100}%;top:${Math.random()*100}%;box-shadow:0 0 ${size}px rgba(150,50,255,0.6);--sx:${(Math.random()-0.5)*200}px;--sy:${(Math.random()-0.5)*200}px;animation:shadowWisp ${3+Math.random()*3}s ease-out infinite;animation-delay:${Math.random()*2}s;`;
      particlesDiv.appendChild(wisp);
    }
  } else if(skillType === 'meteor') {
    // 陨石轨迹
    for(let i = 0; i < 8; i++) {
      const trail = document.createElement('div');
      const size = 6 + Math.random() * 10;
      trail.style.cssText = `position:absolute;width:${size*3}px;height:${size}px;background:linear-gradient(90deg,transparent,#ff6600,#ffcc00);border-radius:50%;left:${Math.random()*50}%;top:${Math.random()*50}%;box-shadow:0 0 ${size*2}px #ff6600;--mx:${200+Math.random()*200}px;--my:${100+Math.random()*200}px;animation:meteorTrail ${1.5+Math.random()*1.5}s ease-out infinite;animation-delay:${Math.random()*2}s;opacity:0;`;
      particlesDiv.appendChild(trail);
    }
  } else if(skillType === 'holy') {
    // 圣光光球
    for(let i = 0; i < 15; i++) {
      const glow = document.createElement('div');
      const size = 8 + Math.random() * 16;
      glow.style.cssText = `position:absolute;width:${size}px;height:${size}px;background:radial-gradient(circle,#ffffff,#ffee77,transparent);border-radius:50%;left:${Math.random()*100}%;bottom:0;box-shadow:0 0 ${size*2}px #ffee77;animation:holyGlow ${3+Math.random()*3}s ease-out infinite;animation-delay:${Math.random()*2}s;`;
      particlesDiv.appendChild(glow);
    }
  } else if(skillType === 'lava') {
    // 岩浆气泡
    for(let i = 0; i < 18; i++) {
      const bubble = document.createElement('div');
      const size = 10 + Math.random() * 20;
      const colors = ['#ff3300','#ff6600','#ff0000'];
      const color = colors[Math.floor(Math.random() * colors.length)];
      bubble.style.cssText = `position:absolute;width:${size}px;height:${size}px;background:radial-gradient(circle,${color},#660000);border-radius:50%;left:${Math.random()*100}%;bottom:0;box-shadow:0 0 ${size}px ${color};animation:lavaBubble ${2.5+Math.random()*2.5}s ease-out infinite;animation-delay:${Math.random()*2}s;opacity:0;`;
      particlesDiv.appendChild(bubble);
    }
  } else if(skillType === 'starburst') {
    // 星光闪烁
    for(let i = 0; i < 20; i++) {
      const star = document.createElement('div');
      const size = 6 + Math.random() * 12;
      const colors = ['#ffcc00','#ffee77','#ffffff'];
      const color = colors[Math.floor(Math.random() * colors.length)];
      star.style.cssText = `position:absolute;width:${size}px;height:${size}px;background:${color};clip-path:polygon(50% 0%,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%);left:${Math.random()*100}%;top:${Math.random()*100}%;box-shadow:0 0 ${size}px ${color};animation:starTwinkle ${1.5+Math.random()*2}s ease-in-out infinite;animation-delay:${Math.random()*2}s;`;
      particlesDiv.appendChild(star);
    }
  }
}


// ========== 萌萌江湖行系统 ==========
