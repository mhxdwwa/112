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
    for(let i = 1; i <= 13; i++) {
      pending++;
      const img = new Image();
      const path = encodeURI('/战斗机器人/' + i + '.webp');
      img.onload = () => { _classPKRobotCache.push(path); done(); };
      img.onerror = () => {
        // 回退：尝试不带前导斜杠的相对路径
        const fallback = new Image();
        const fallbackPath = encodeURI('战斗机器人/' + i + '.webp');
        fallback.onload = () => { _classPKRobotCache.push(fallbackPath); done(); };
        fallback.onerror = () => { done(); };
        fallback.src = fallbackPath;
      };
      img.src = path;
    }
    setTimeout(() => { _classPKRobotProbed = true; resolve(); }, 5000);
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
let _classPKExitBtn = null;

function _createClassPKExitButton() {
  if (_classPKExitBtn) _classPKExitBtn.remove();
  _classPKExitBtn = document.createElement('button');
  _classPKExitBtn.id = 'classPKExitBtn';
  _classPKExitBtn.textContent = '退出';
  _classPKExitBtn.setAttribute('type', 'button');
  _classPKExitBtn.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:999999;padding:14px 40px;font-size:18px;font-weight:700;color:#fff;background:linear-gradient(135deg,#ff6b6b,#ee5a24);border:none;border-radius:30px;cursor:pointer;box-shadow:0 4px 20px rgba(238,90,36,0.5);transition:all 0.3s;opacity:0;pointer-events:none;letter-spacing:1px;display:block;';
  _classPKExitBtn.onclick = function(e) { e.preventDefault(); e.stopPropagation(); closeClassPKModal(); };
  document.body.appendChild(_classPKExitBtn);
}

function _showClassPKExitButton() {
  if (_classPKExitBtn) {
    _classPKExitBtn.style.opacity = '1';
    _classPKExitBtn.style.pointerEvents = 'auto';
    _classPKExitBtn.style.display = 'block';
    _classPKExitBtn.disabled = false;
    _classPKExitBtn.removeAttribute('disabled');
  }
}

function _removeClassPKExitButton() {
  if (_classPKExitBtn) {
    _classPKExitBtn.remove();
    _classPKExitBtn = null;
  }
}

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

  // 创建body级别退出按钮（绕过所有层叠上下文）
  _createClassPKExitButton();

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

  // v155: Mark battle as finished BEFORE showing exit buttons
  classPKState.isFighting = false;
  classPKState.selectedStudents = [];

  saveClassData();
  if(typeof renderHomePetGrid==='function') renderHomePetGrid();
  if(typeof renderClassTopThree==='function') renderClassTopThree();
  
  // v155: Force-enable ALL buttons in the modal
  if(classPKBattleModal) {
    classPKBattleModal.querySelectorAll('.modal-actions button').forEach(function(btn) {
      btn.removeAttribute('disabled');
      btn.disabled = false;
      btn.style.cssText = 'opacity:1;pointer-events:auto;filter:none;cursor:pointer;display:inline-flex;';
    });
  }
  
  // Show body-level exit button (escapes all stacking contexts)
  _showClassPKExitButton();
  
  // v156: Sync class PK results to API (coins + growth + history)
  if(window.USE_API && window.ApiMigration) {
    if(p1HP <= 0 && p2HP <= 0) {
      // Draw — sync coins + growth for both
      window.ApiMigration.coinsAndPet(student1, 0, [{
        petId: pet1.id, updates: { growth: pet1.growth, level: pet1.level }
      }], { actionType: '课堂PK平局', details: student1.name + ' vs ' + student2.name + ' 平局', expDelta: 3, petId: pet1.id });
      window.ApiMigration.coinsAndPet(student2, 0, [{
        petId: pet2.id, updates: { growth: pet2.growth, level: pet2.level }
      }], { actionType: '课堂PK平局', details: student2.name + ' vs ' + student1.name + ' 平局', expDelta: 3, petId: pet2.id });
    } else {
      const w = p2HP <= 0 ? student1 : student2;
      const l = p2HP <= 0 ? student2 : student1;
      const wPet = p2HP <= 0 ? pet1 : pet2;
      const lPet = p2HP <= 0 ? pet2 : pet1;
      const wCoin = 20, wGrowth = 5;
      const lCoin = 5, lGrowth = 3;
      window.ApiMigration.coinsAndPet(w, wCoin, [{
        petId: wPet.id, updates: { growth: wPet.growth, level: wPet.level }
      }], { actionType: '课堂PK胜利', details: '击败 ' + l.name + '（' + (lPet.nickname||lPet.name) + '）', expDelta: wGrowth, petId: wPet.id });
      window.ApiMigration.coinsAndPet(l, lCoin, [{
        petId: lPet.id, updates: { growth: lPet.growth, level: lPet.level }
      }], { actionType: '课堂PK失败', details: '败给 ' + w.name + '（' + (wPet.nickname||wPet.name) + '）', expDelta: lGrowth, petId: lPet.id });
    }
  }
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
  _removeClassPKExitButton();
  closeModal();
  renderClassPKPage();
}

function getPetImageSrc(petName, level) {
  const cfg = PET_CONFIG[petName];
  if(!cfg) return '';
  return _img(`${cfg.id}/${level}.webp`);
}
