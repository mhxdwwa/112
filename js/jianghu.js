// ========== 萌萌江湖行系统 ==========
let jhSelectedStudentId = null;

function getTodayCoinGain(studentId) {
  const today = new Date().toDateString();
  let total = 0;
  // v15: Always read from window.operationLogs for cross-script consistency
  const jhValidTypes = ['全班打卡', '批量奖惩', '奖惩', '每日打卡', '取金阁', '小猪快跑', '宠物消消乐'];
  var logs = getOpLogs();
  for (let i = logs.length - 1; i >= 0; i--) {
    const log = logs[i];
    if (log.reverted) continue;
    const logDate = new Date(log.timestamp).toDateString();
    if (logDate !== today) continue;
    if (log.studentId && log.studentId.toString() === studentId.toString() && log.coinDelta > 0 && jhValidTypes.includes(log.actionType)) {
      total += log.coinDelta;
    }
  }
  return total;
}

// v14: 判断学生今日是否有资格参加PK（今日通过奖惩/批量奖惩/打卡获得>=5金币）
function hasPKQualificationToday(studentId) {
  const today = new Date().toDateString();
  let total = 0;
  // v15: Always read from window.operationLogs for cross-script consistency
  const pkValidTypes = ['奖惩', '批量奖惩', '每日打卡', '全班打卡', '取金阁', '小猪快跑', '宠物消消乐'];
  var logs = getOpLogs();
  for (let i = logs.length - 1; i >= 0; i--) {
    const log = logs[i];
    if (log.reverted) continue;
    const logDate = new Date(log.timestamp).toDateString();
    if (logDate !== today) continue;
    if (log.studentId && log.studentId.toString() === studentId.toString() && log.coinDelta > 0 && pkValidTypes.includes(log.actionType)) {
      total += log.coinDelta;
    }
  }
  return total >= 5;
}

function renderJianghuColumn(cur, validStudents) {
  const isStudentView = typeof currentUser !== 'undefined' && currentUser && currentUser.type === 'student';
  const myStudentId = isStudentView ? parseInt(currentUser.studentId) : null;
  const qualifiedStudents = cur.students.filter(s => {
    const p = getActivePet(s);
    if (!p || p.isDead) return false;
    return getTodayCoinGain(s.id) >= 25;
  });
  let html = `<div class="jianghu-column">`;
  html += `<div class="jianghu-header"><h3>🗡️ 萌萌江湖行</h3><p>打卡+奖惩+取金阁获得≥25金币可参加（PK金币不算）</p></div>`;
  html += `<div class="jianghu-list">`;
  if (qualifiedStudents.length === 0) {
    html += `<div class="jianghu-empty" style="grid-column:1/-1;">🌙<br>今日尚无侠客<br>打卡+奖惩+取金阁达25金币即可闯荡江湖<br><span style="font-size:11px;color:#a08060;">（PK金币不计入资格）</span></div>`;
  } else {
    qualifiedStudents.forEach(s => {
      const p = getActivePet(s);
      const todayGain = getTodayCoinGain(s.id);
      const isSelected = jhSelectedStudentId && jhSelectedStudentId.toString() === s.id.toString();
      const alreadyDone = hasJianghuToday(s);
      // v16: Get Jianghu result for today (win/lose)
      const jhResult = getJianghuResultToday(s.id);
      const isMe = myStudentId && s.id.toString() === myStudentId.toString();
      // v16: For student view, only allow selecting self if qualified
      const canSelect = isStudentView ? (isMe && !alreadyDone) : !alreadyDone;
      html += `<div class="jianghu-item ${isSelected ? 'jh-selected' : ''} ${alreadyDone ? 'jh-done' : ''}" onclick="${canSelect ? "selectJianghuStudent('" + s.id + "')" : ''}" ${alreadyDone ? 'title="今日已闯荡"' : ''}>`;
      html += `<div class="jianghu-item-avatar">${getPetImage(p.name, p.level)}</div>`;
      html += `<div class="jianghu-item-info">`;
      html += `<div class="jh-name">${esc(s.name)}${isMe ? ' <span style="font-size:10px;color:#4a90d9;font-weight:400;">（我）</span>' : ''}${alreadyDone ? ' <span style="font-size:10px;color:rgba(180,140,80,0.5);font-weight:400;">（今日已闯）</span>' : ''}</div>`;
      html += `<div class="jh-pet">${esc(p.nickname || p.name)} Lv.${p.level}</div>`;
      html += `<div class="jh-coins">💰 ${s.coins}金币 · 今日+${todayGain}</div>`;
      html += `</div>`;
      // v16: Show win/lose badge for students who have done Jianghu today
      if (alreadyDone && jhResult) {
        const badgeStyle = jhResult === 'win' 
          ? 'background:linear-gradient(135deg,#ffd700,#ffaa00);color:#8b6914;' 
          : 'background:linear-gradient(135deg,#ccc,#999);color:#555;';
        const badgeText = jhResult === 'win' ? '胜' : '负';
        html += `<div class="jh-coin-badge" style="${badgeStyle}font-size:11px;font-weight:700;">${badgeText}</div>`;
      } else {
        html += `<div class="jh-coin-badge">${alreadyDone ? '✓' : '+' + todayGain}</div>`;
      }
      html += `</div>`;
    });
  }
  html += `</div>`;
  html += `</div>`;
  // v16: For student view, only show start button if student is qualified and hasn't done it yet
  // v17: Use toString() comparison to avoid type mismatch (number vs string)
  const myStudent = isStudentView ? cur.students.find(s => s.id.toString() === myStudentId.toString()) : null;
  const myQualified = myStudent && getTodayCoinGain(myStudentId) >= 25 && getActivePet(myStudent) && !getActivePet(myStudent).isDead;
  const myDone = myStudent && hasJianghuToday(myStudent);
  const showStartBtn = isStudentView ? (myQualified && !myDone && jhSelectedStudentId) : jhSelectedStudentId;
  html += `<div class="jianghu-start-area ${showStartBtn ? 'jh-btn-visible' : ''}">`;
  if (isStudentView && myDone) {
    html += `<div style="text-align:center;padding:10px;color:#a08060;font-size:13px;">今日已闯荡江湖，明日再来</div>`;
  } else if (isStudentView && !myQualified) {
    html += `<div style="text-align:center;padding:10px;color:#ccc;font-size:13px;">打卡+奖惩+取金阁获得≥25金币方可闯荡江湖</div>`;
  } else {
    html += `<button class="jianghu-start-btn" onclick="startJianghuAdventure()">⚔️ 闯荡江湖</button>`;
  }
  html += `</div>`;
  return html;
}

// v16: Get Jianghu result (win/lose) for a student today
function getJianghuResultToday(studentId) {
  const today = new Date().toDateString();
  var logs = getOpLogs();
  for (let i = logs.length - 1; i >= 0; i--) {
    const log = logs[i];
    if (log.reverted) continue;
    const logDate = new Date(log.timestamp).toDateString();
    if (logDate !== today) continue;
    if (log.studentId && log.studentId.toString() === studentId.toString()) {
      if (log.actionType === '江湖胜利' && log.extra && log.extra.jhType === 'win') return 'win';
      if (log.actionType === '江湖失败' && log.extra && log.extra.jhType === 'lose') return 'lose';
    }
  }
  return null;
}

function selectJianghuStudent(studentId) {
  if (jhSelectedStudentId && jhSelectedStudentId.toString() === studentId.toString()) {
    jhSelectedStudentId = null;
  } else {
    jhSelectedStudentId = studentId;
  }
  renderJianghuPage();
}

function hasJianghuToday(student) {
  const today = new Date().toDateString();
  // Primary check: student field
  if (student.lastJianghuDate === today) return true;
  // v34: Fallback — check operation logs in case lastJianghuDate was not synced
  var logs = getOpLogs();
  for (let i = logs.length - 1; i >= 0; i--) {
    const log = logs[i];
    if (log.reverted) continue;
    const logDate = new Date(log.timestamp).toDateString();
    if (logDate !== today) continue;
    if (log.studentId && log.studentId.toString() === student.id.toString()) {
      if (log.actionType === '江湖胜利' || log.actionType === '江湖失败') return true;
    }
  }
  return false;
}

function startJianghuAdventure() {
  if (!jhSelectedStudentId || !currentClassId) return;
  const cur = classesData.find(c => c.id === currentClassId);
  if (!cur) return;
  // v16: Student can only start adventure for themselves
  const isStudentView = typeof currentUser !== 'undefined' && currentUser && currentUser.type === 'student';
  if (isStudentView) {
    const myId = parseInt(currentUser.studentId);
    if (jhSelectedStudentId.toString() !== myId.toString()) {
      showNotification('权限不足', '只能操作自己的宠物参与江湖行', 'warning');
      return;
    }
  }
  const student = cur.students.find(s => s.id.toString() === jhSelectedStudentId.toString());
  if (!student) return;
  const pet = getActivePet(student);
  if (!pet || pet.isDead) { showNotification('无法出发', '宠物状态异常', 'error'); return; }
  if (hasJianghuToday(student)) { showNotification('今日已闯荡', '每位侠客每日仅可闯荡江湖一次，明日再来', 'warning'); return; }
  if (student.coins < 1) { showNotification('盘缠不足', '至少需要1金币', 'error'); return; }
  showJianghuInvestDialog(student, pet);
}

function showJianghuInvestDialog(student, pet) {
  const maxCoins = Math.min(student.coins, 333); // 最高投入333金币
  const overlay = document.createElement('div');
  overlay.className = 'jh-invest-overlay';
  overlay.innerHTML = `
    <div class="jh-invest-box">
      <h2>闯荡江湖 · 预备盘缠</h2>
      <p>${esc(student.name)} 携 ${esc(pet.nickname || pet.name)} 出征<br>胜利可获3倍盘缠，败则尽失</p>
      <div style="color:rgba(245,240,232,0.5);font-size:12px;margin-bottom:8px;">可投入: 1 ~ ${maxCoins} 金币（最高333）</div>
      <input type="range" min="1" max="${maxCoins}" value="${Math.min(10, maxCoins)}" id="jhInvestSlider" oninput="document.getElementById('jhInvestVal').textContent=this.value">
      <div class="jh-invest-val"><span id="jhInvestVal">${Math.min(10, maxCoins)}</span> 💰</div>
      <div class="jh-invest-btns">
        <button class="jh-invest-cancel" onclick="this.closest('.jh-invest-overlay').remove()">取消</button>
        <button class="jh-invest-confirm" onclick="confirmJianghuStart(${JSON.stringify(student.id).replace(/"/g, "'")})">出发！</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
}

function confirmJianghuStart(studentId) {
  const slider = document.getElementById('jhInvestSlider');
  const investCoins = parseInt(slider.value);
  document.querySelector('.jh-invest-overlay').remove();
  const cur = classesData.find(c => c.id === currentClassId);
  const student = cur.students.find(s => s.id.toString() === studentId.toString());
  const pet = getActivePet(student);
  if (investCoins > student.coins) { showNotification('金币不足', '金币不够', 'error'); return; }
  launchJianghuGame(student, pet, investCoins);
}

// ===== 江湖游戏主体 =====
// 江湖音效
function playJHFootstepSound(){
  initAudio();const now=audioCtx.currentTime;
  const o=audioCtx.createOscillator(),g=audioCtx.createGain(),f=audioCtx.createBiquadFilter();
  o.connect(f);f.connect(g);g.connect(masterSfxGain);
  o.type='triangle';f.type='lowpass';f.frequency.value=600;
  o.frequency.value=80+Math.random()*40;
  g.gain.setValueAtTime(0.12,now);g.gain.exponentialRampToValueAtTime(0.01,now+0.08);
  o.start(now);o.stop(now+0.08);
  // gravel noise
  const buf=audioCtx.createBuffer(1,audioCtx.sampleRate*0.06,audioCtx.sampleRate),d=buf.getChannelData(0);
  for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*Math.exp(-i/(d.length*0.3));
  const ns=audioCtx.createBufferSource(),ng=audioCtx.createGain(),nf=audioCtx.createBiquadFilter();
  ns.buffer=buf;ns.connect(nf);nf.connect(ng);ng.connect(masterSfxGain);
  nf.type='highpass';nf.frequency.value=1500;
  ng.gain.setValueAtTime(0.08,now);ng.gain.exponentialRampToValueAtTime(0.01,now+0.06);
  ns.start(now);
}
function playJHWindAmbient(){
  initAudio();const now=audioCtx.currentTime;
  const buf=audioCtx.createBuffer(1,audioCtx.sampleRate*2,audioCtx.sampleRate),d=buf.getChannelData(0);
  for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1);
  const ns=audioCtx.createBufferSource(),ng=audioCtx.createGain(),nf=audioCtx.createBiquadFilter();
  ns.buffer=buf;ns.connect(nf);nf.connect(ng);ng.connect(masterSfxGain);
  nf.type='bandpass';nf.frequency.value=400;nf.Q.value=0.5;
  ng.gain.setValueAtTime(0,now);ng.gain.linearRampToValueAtTime(0.04,now+0.5);
  ng.gain.linearRampToValueAtTime(0.06,now+1.5);ng.gain.linearRampToValueAtTime(0,now+2.5);
  ns.start(now);
}
function playJHSwordClash(){
  initAudio();const now=audioCtx.currentTime;
  // soft metallic ring - lower frequencies, sine waves, with lowpass filter
  [800,1200,1600].forEach((freq,i)=>{
    const o=audioCtx.createOscillator(),g=audioCtx.createGain(),f=audioCtx.createBiquadFilter();
    o.connect(f);f.connect(g);g.connect(masterSfxGain);
    o.type='sine';o.frequency.value=freq;
    f.type='lowpass';f.frequency.value=1800;
    o.frequency.exponentialRampToValueAtTime(freq*0.5,now+0.2);
    g.gain.setValueAtTime(0.08-i*0.02,now);
    g.gain.exponentialRampToValueAtTime(0.005,now+0.18+i*0.03);
    o.start(now);o.stop(now+0.2+i*0.03);
  });
  // gentle impact thud
  const b=audioCtx.createOscillator(),bg=audioCtx.createGain();
  b.connect(bg);bg.connect(masterSfxGain);
  b.type='sine';b.frequency.value=90;b.frequency.exponentialRampToValueAtTime(35,now+0.25);
  bg.gain.setValueAtTime(0.12,now);bg.gain.exponentialRampToValueAtTime(0.005,now+0.25);
  b.start(now);b.stop(now+0.25);
  // soft noise - lower volume, longer decay
  const buf=audioCtx.createBuffer(1,audioCtx.sampleRate*0.08,audioCtx.sampleRate),d=buf.getChannelData(0);
  for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*Math.exp(-i/(d.length*0.2));
  const ns=audioCtx.createBufferSource(),ng=audioCtx.createGain(),nf=audioCtx.createBiquadFilter();
  ns.buffer=buf;ns.connect(nf);nf.connect(ng);ng.connect(masterSfxGain);
  nf.type='lowpass';nf.frequency.value=2000;
  ng.gain.setValueAtTime(0.06,now);ng.gain.exponentialRampToValueAtTime(0.005,now+0.08);
  ns.start(now);
}
function playJHSlashSound(){
  initAudio();const now=audioCtx.currentTime;
  const o=audioCtx.createOscillator(),g=audioCtx.createGain(),f=audioCtx.createBiquadFilter();
  o.connect(f);f.connect(g);g.connect(masterSfxGain);
  o.type='sawtooth';f.type='bandpass';f.frequency.value=1200;f.Q.value=1.5;
  o.frequency.value=600;o.frequency.linearRampToValueAtTime(2500,now+0.08);o.frequency.linearRampToValueAtTime(400,now+0.25);
  g.gain.setValueAtTime(0.22,now);g.gain.exponentialRampToValueAtTime(0.01,now+0.25);
  o.start(now);o.stop(now+0.25);
}
function playJHBossRoar(){
  initAudio();const now=audioCtx.currentTime;
  const o=audioCtx.createOscillator(),g=audioCtx.createGain();
  o.connect(g);g.connect(masterSfxGain);
  o.type='sawtooth';o.frequency.value=80;
  o.frequency.linearRampToValueAtTime(150,now+0.3);o.frequency.linearRampToValueAtTime(50,now+0.8);
  g.gain.setValueAtTime(0.3,now);g.gain.linearRampToValueAtTime(0.4,now+0.3);g.gain.exponentialRampToValueAtTime(0.01,now+0.8);
  o.start(now);o.stop(now+0.8);
  // rumble
  const b=audioCtx.createOscillator(),bg=audioCtx.createGain();
  b.connect(bg);bg.connect(masterSfxGain);
  b.type='sine';b.frequency.value=40;
  bg.gain.setValueAtTime(0.2,now);bg.gain.exponentialRampToValueAtTime(0.01,now+0.6);
  b.start(now);b.stop(now+0.6);
}
function playJHVictorySound(){
  initAudio();const now=audioCtx.currentTime;
  const notes=[{f:523,d:0},{f:659,d:0.15},{f:784,d:0.3},{f:1047,d:0.5}];
  notes.forEach(n=>{
    const o=audioCtx.createOscillator(),g=audioCtx.createGain();
    o.connect(g);g.connect(masterSfxGain);
    o.type='sine';o.frequency.value=n.f;
    g.gain.setValueAtTime(0.25,now+n.d);g.gain.exponentialRampToValueAtTime(0.01,now+n.d+0.4);
    o.start(now+n.d);o.stop(now+n.d+0.5);
    const h=audioCtx.createOscillator(),hg=audioCtx.createGain();
    h.connect(hg);hg.connect(masterSfxGain);
    h.type='triangle';h.frequency.value=n.f*2;
    hg.gain.setValueAtTime(0.06,now+n.d);hg.gain.exponentialRampToValueAtTime(0.01,now+n.d+0.3);
    h.start(now+n.d);h.stop(now+n.d+0.3);
  });
}
function playJHDefeatSound(){
  initAudio();const now=audioCtx.currentTime;
  const notes=[{f:400,d:0},{f:350,d:0.2},{f:280,d:0.4},{f:200,d:0.6}];
  notes.forEach(n=>{
    const o=audioCtx.createOscillator(),g=audioCtx.createGain();
    o.connect(g);g.connect(masterSfxGain);
    o.type='sine';o.frequency.value=n.f;
    g.gain.setValueAtTime(0.2,now+n.d);g.gain.exponentialRampToValueAtTime(0.01,now+n.d+0.35);
    o.start(now+n.d);o.stop(now+n.d+0.4);
  });
}
// 终结一击专属音效：蓄力→爆发→余韵
function playJHFinalStrikeSound(){
  initAudio();const t=audioCtx.currentTime;

  // Phase 1: 低沉蓄力嗡鸣（0-0.8s），频率从低到高逐渐攀升
  const charge=audioCtx.createOscillator(),cGain=audioCtx.createGain(),cFilter=audioCtx.createBiquadFilter();
  charge.connect(cFilter);cFilter.connect(cGain);cGain.connect(masterSfxGain);
  charge.type='sawtooth';
  charge.frequency.setValueAtTime(40,t);
  charge.frequency.exponentialRampToValueAtTime(400,t+0.7);
  cFilter.type='bandpass';cFilter.frequency.setValueAtTime(200,t);
  cFilter.frequency.exponentialRampToValueAtTime(1200,t+0.7);cFilter.Q.value=3;
  cGain.gain.setValueAtTime(0.05,t);
  cGain.gain.linearRampToValueAtTime(0.25,t+0.6);
  cGain.gain.linearRampToValueAtTime(0,t+0.85);
  charge.start(t);charge.stop(t+0.9);

  // 蓄力层2：高频啸叫叠加（0.3-0.8s）
  const whine=audioCtx.createOscillator(),wGain=audioCtx.createGain();
  whine.connect(wGain);wGain.connect(masterSfxGain);
  whine.type='sine';
  whine.frequency.setValueAtTime(800,t+0.3);
  whine.frequency.exponentialRampToValueAtTime(3000,t+0.78);
  wGain.gain.setValueAtTime(0,t+0.3);
  wGain.gain.linearRampToValueAtTime(0.12,t+0.65);
  wGain.gain.linearRampToValueAtTime(0,t+0.82);
  whine.start(t+0.3);whine.stop(t+0.85);

  // Phase 2: 爆发冲击（0.8s），重低音boom
  const boom=audioCtx.createOscillator(),bGain=audioCtx.createGain();
  boom.connect(bGain);bGain.connect(masterSfxGain);
  boom.type='sine';
  boom.frequency.setValueAtTime(120,t+0.8);
  boom.frequency.exponentialRampToValueAtTime(25,t+1.6);
  bGain.gain.setValueAtTime(0.5,t+0.8);
  bGain.gain.exponentialRampToValueAtTime(0.01,t+1.8);
  boom.start(t+0.8);boom.stop(t+1.9);

  // 爆发层2：金属斩击音（0.8s）
  const slash=audioCtx.createOscillator(),sGain=audioCtx.createGain(),sFilter=audioCtx.createBiquadFilter();
  slash.connect(sFilter);sFilter.connect(sGain);sGain.connect(masterSfxGain);
  slash.type='square';
  slash.frequency.setValueAtTime(2000,t+0.8);
  slash.frequency.exponentialRampToValueAtTime(300,t+1.1);
  sFilter.type='highpass';sFilter.frequency.value=800;
  sGain.gain.setValueAtTime(0.18,t+0.8);
  sGain.gain.exponentialRampToValueAtTime(0.01,t+1.2);
  slash.start(t+0.8);slash.stop(t+1.3);

  // 爆发层3：噪声爆裂质感（0.8-1.1s）
  const bufSize=audioCtx.sampleRate*0.25;
  const noiseBuffer=audioCtx.createBuffer(1,bufSize,audioCtx.sampleRate);
  const noiseData=noiseBuffer.getChannelData(0);
  for(let i=0;i<bufSize;i++) noiseData[i]=(Math.random()*2-1)*Math.exp(-i/(bufSize*0.15));
  const noiseSrc=audioCtx.createBufferSource(),nGain=audioCtx.createGain(),nFilter=audioCtx.createBiquadFilter();
  noiseSrc.buffer=noiseBuffer;
  noiseSrc.connect(nFilter);nFilter.connect(nGain);nGain.connect(masterSfxGain);
  nFilter.type='bandpass';nFilter.frequency.value=3000;nFilter.Q.value=1;
  nGain.gain.setValueAtTime(0.3,t+0.8);
  nGain.gain.exponentialRampToValueAtTime(0.01,t+1.1);
  noiseSrc.start(t+0.8);noiseSrc.stop(t+1.2);

  // Phase 3: 余韵回响（1.0-2.0s），史诗感和弦
  const chord=[261.63,329.63,392.00,523.25]; // C大调主和弦
  chord.forEach((f,i)=>{
    const o=audioCtx.createOscillator(),g=audioCtx.createGain();
    o.connect(g);g.connect(masterSfxGain);
    o.type='sine';o.frequency.value=f;
    g.gain.setValueAtTime(0,t+1.0);
    g.gain.linearRampToValueAtTime(0.08,t+1.1);
    g.gain.exponentialRampToValueAtTime(0.001,t+2.2);
    o.start(t+1.0);o.stop(t+2.3);
  });
}
const jhBosses = [
  { name: '血刀老祖', color: '#cc2233', accent: '#ff4455' },
  { name: '毒手药王', color: '#2d6a4f', accent: '#40916c' },
  { name: '天山剑魔', color: '#4a3080', accent: '#7c5cbf' },
  { name: '铁面判官', color: '#8b6914', accent: '#c9a84c' },
  { name: '幽冥鬼母', color: '#5a1a5a', accent: '#b040b0' },
];

function jhGenMtnSVG(type) {
  const h = type === 'far' ? 55 : type === 'mid' ? 70 : 85;
  const color = type === 'far' ? '#101828' : type === 'mid' ? '#0e1e20' : '#0c1a14';
  const highlight = type === 'far' ? '#1a2840' : type === 'mid' ? '#162a2a' : '#142418';
  let path = 'M0 100 ';
  for (let i = 0; i <= 12; i++) {
    const x = (i / 12) * 100;
    const y = 100 - h + Math.random() * h * 0.55;
    path += `Q ${x - 4} ${y - Math.random() * 18} ${x} ${y} `;
  }
  path += 'L100 100 Z';
  let path2 = 'M0 100 ';
  for (let i = 0; i <= 12; i++) {
    const x = (i / 12) * 100;
    const y = 100 - h * 0.85 + Math.random() * h * 0.5;
    path2 += `Q ${x - 3} ${y - Math.random() * 12} ${x} ${y} `;
  }
  path2 += 'L100 100 Z';
  return `<svg viewBox="0 0 100 100" preserveAspectRatio="none" style="width:100%;height:100%"><defs><linearGradient id="mtn${type}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${highlight}"/><stop offset="100%" stop-color="${color}"/></linearGradient></defs><path d="${path2}" fill="${highlight}" opacity="0.5"/><path d="${path}" fill="url(#mtn${type})"/></svg>`;
}

function jhGenBossSVG(boss) {
  return `<img src="战斗兽宠文件夹/${esc(boss.name)}.webp" alt="${esc(boss.name)}" style="width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 0 20px ${boss.accent});"/>`;
}

/* Generate wuxia-style ancient building silhouettes SVG */
function jhGenBuildingsSVG(layer) {
  // layer: 'near' or 'far'
  const w = 2400, h = 300;
  const baseY = h;
  let paths = '';
  const bldgColor = layer === 'far' ? '#0a0e1a' : '#0c1218';
  const highlightColor = layer === 'far' ? 'rgba(80,100,140,0.08)' : 'rgba(60,80,100,0.06)';

  // Helper: draw a pagoda
  function pagoda(cx, groundY, floors, floorW, floorH) {
    let d = '';
    let y = groundY;
    for (let f = 0; f < floors; f++) {
      const fw = floorW * (1 - f * 0.15);
      const fh = floorH * (1 - f * 0.08);
      const roofOverhang = fw * 0.2;
      // floor body
      d += `M${cx - fw/2} ${y} L${cx - fw/2} ${y - fh * 0.6} L${cx + fw/2} ${y - fh * 0.6} L${cx + fw/2} ${y} Z `;
      // curved roof
      const roofY = y - fh * 0.6;
      const roofTop = roofY - fh * 0.4;
      d += `M${cx - fw/2 - roofOverhang} ${roofY + 2} Q${cx - fw/4} ${roofTop - 5} ${cx} ${roofTop} Q${cx + fw/4} ${roofTop - 5} ${cx + fw/2 + roofOverhang} ${roofY + 2} L${cx + fw/2} ${roofY} L${cx - fw/2} ${roofY} Z `;
      y = roofTop;
    }
    // spire on top
    d += `M${cx - 2} ${y} L${cx} ${y - 18} L${cx + 2} ${y} Z `;
    return d;
  }

  // Helper: draw a pavilion (亭)
  function pavilion(cx, groundY, w, h) {
    let d = '';
    const pillarW = 3;
    // left pillar
    d += `M${cx - w * 0.35} ${groundY} L${cx - w * 0.35} ${groundY - h * 0.55} L${cx - w * 0.35 + pillarW} ${groundY - h * 0.55} L${cx - w * 0.35 + pillarW} ${groundY} Z `;
    // right pillar
    d += `M${cx + w * 0.35 - pillarW} ${groundY} L${cx + w * 0.35 - pillarW} ${groundY - h * 0.55} L${cx + w * 0.35} ${groundY - h * 0.55} L${cx + w * 0.35} ${groundY} Z `;
    // platform/base
    d += `M${cx - w * 0.45} ${groundY} L${cx - w * 0.4} ${groundY - 5} L${cx + w * 0.4} ${groundY - 5} L${cx + w * 0.45} ${groundY} Z `;
    // curved roof
    const roofBase = groundY - h * 0.55;
    const roofTop = groundY - h;
    d += `M${cx - w * 0.55} ${roofBase + 3} Q${cx - w * 0.2} ${roofTop - 8} ${cx} ${roofTop} Q${cx + w * 0.2} ${roofTop - 8} ${cx + w * 0.55} ${roofBase + 3} L${cx + w * 0.4} ${roofBase} L${cx - w * 0.4} ${roofBase} Z `;
    // finial
    d += `M${cx - 1.5} ${roofTop} L${cx} ${roofTop - 12} L${cx + 1.5} ${roofTop} Z `;
    return d;
  }

  // Helper: draw a tower/watchtower (楼)
  function tower(cx, groundY, tw, th) {
    let d = '';
    // main body
    d += `M${cx - tw/2} ${groundY} L${cx - tw/2} ${groundY - th * 0.7} L${cx + tw/2} ${groundY - th * 0.7} L${cx + tw/2} ${groundY} Z `;
    // upper floor slightly narrower
    const uw = tw * 0.8;
    const upperBase = groundY - th * 0.7;
    d += `M${cx - uw/2} ${upperBase} L${cx - uw/2} ${upperBase - th * 0.15} L${cx + uw/2} ${upperBase - th * 0.15} L${cx + uw/2} ${upperBase} Z `;
    // roof
    const roofBase = upperBase - th * 0.15;
    const overhang = tw * 0.25;
    d += `M${cx - tw/2 - overhang} ${roofBase + 2} Q${cx} ${roofBase - th * 0.2} ${cx + tw/2 + overhang} ${roofBase + 2} L${cx + tw/2} ${roofBase} L${cx - tw/2} ${roofBase} Z `;
    // tip
    d += `M${cx - 1.5} ${roofBase - th * 0.12} L${cx} ${roofBase - th * 0.22} L${cx + 1.5} ${roofBase - th * 0.12} Z `;
    return d;
  }

  // Place buildings across the width
  const seed = layer === 'far' ? 7 : 3;
  const structures = [];

  if (layer === 'far') {
    structures.push({type:'pagoda', cx:180, floors:5, fw:28, fh:22});
    structures.push({type:'pavilion', cx:420, w:55, h:65});
    structures.push({type:'tower', cx:650, w:35, h:80});
    structures.push({type:'pagoda', cx:900, floors:4, fw:24, fh:20});
    structures.push({type:'pavilion', cx:1150, w:50, h:55});
    structures.push({type:'tower', cx:1380, w:30, h:70});
    structures.push({type:'pagoda', cx:1600, floors:3, fw:26, fh:22});
    structures.push({type:'pavilion', cx:1850, w:48, h:58});
    structures.push({type:'tower', cx:2100, w:32, h:75});
    structures.push({type:'pagoda', cx:2300, floors:4, fw:25, fh:21});
  } else {
    structures.push({type:'pagoda', cx:120, floors:4, fw:34, fh:26});
    structures.push({type:'tower', cx:380, w:42, h:95});
    structures.push({type:'pavilion', cx:620, w:65, h:75});
    structures.push({type:'pagoda', cx:880, floors:5, fw:30, fh:24});
    structures.push({type:'tower', cx:1100, w:38, h:88});
    structures.push({type:'pavilion', cx:1350, w:58, h:70});
    structures.push({type:'pagoda', cx:1580, floors:3, fw:32, fh:25});
    structures.push({type:'tower', cx:1800, w:40, h:90});
    structures.push({type:'pavilion', cx:2050, w:60, h:68});
    structures.push({type:'pagoda', cx:2280, floors:4, fw:28, fh:23});
  }

  structures.forEach(s => {
    if (s.type === 'pagoda') paths += pagoda(s.cx, baseY, s.floors, s.fw, s.fh);
    else if (s.type === 'pavilion') paths += pavilion(s.cx, baseY, s.w, s.h);
    else if (s.type === 'tower') paths += tower(s.cx, baseY, s.w, s.h);
  });

  // Add tree silhouettes between buildings
  for (let i = 0; i < 18; i++) {
    const tx = 50 + i * 135 + (layer === 'far' ? 40 : 0);
    const th = 30 + Math.random() * 40;
    const tw = 15 + Math.random() * 12;
    // Simple tree: trunk + canopy
    paths += `M${tx - 2} ${baseY} L${tx - 2} ${baseY - th * 0.4} L${tx + 2} ${baseY - th * 0.4} L${tx + 2} ${baseY} Z `;
    paths += `M${tx - tw/2} ${baseY - th * 0.35} Q${tx - tw/3} ${baseY - th} ${tx} ${baseY - th - 5} Q${tx + tw/3} ${baseY - th} ${tx + tw/2} ${baseY - th * 0.35} Z `;
  }

  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" style="width:100%;height:100%"><path d="${paths}" fill="${bldgColor}"/><path d="${paths}" fill="${highlightColor}" style="transform:translate(1px,-1px)"/></svg>`;
}

/* Generate wuxia-style battle scene buildings SVG */
function jhGenBattleBuildingsSVG() {
  const w = 1200, h = 400;
  const baseY = h;
  let paths = '';
  const bldgColor = '#08060c';

  // Pagoda left side
  let cx = 80, y = baseY;
  for (let f = 0; f < 6; f++) {
    const fw = 50 * (1 - f * 0.12);
    const fh = 28 * (1 - f * 0.06);
    const ov = fw * 0.2;
    paths += `M${cx-fw/2} ${y} L${cx-fw/2} ${y-fh*0.6} L${cx+fw/2} ${y-fh*0.6} L${cx+fw/2} ${y} Z `;
    const ry = y - fh*0.6, rt = ry - fh*0.4;
    paths += `M${cx-fw/2-ov} ${ry+2} Q${cx} ${rt-6} ${cx+fw/2+ov} ${ry+2} L${cx+fw/2} ${ry} L${cx-fw/2} ${ry} Z `;
    y = rt;
  }
  paths += `M${cx-2} ${y} L${cx} ${y-20} L${cx+2} ${y} Z `;

  // Large pavilion center-left
  cx = 300;
  paths += `M${cx-50} ${baseY} L${cx-45} ${baseY-8} L${cx+45} ${baseY-8} L${cx+50} ${baseY} Z `;
  paths += `M${cx-38} ${baseY-8} L${cx-38} ${baseY-85} L${cx-34} ${baseY-85} L${cx-34} ${baseY-8} Z `;
  paths += `M${cx+34} ${baseY-8} L${cx+34} ${baseY-85} L${cx+38} ${baseY-85} L${cx+38} ${baseY-8} Z `;
  paths += `M${cx-60} ${baseY-83} Q${cx} ${baseY-130} ${cx+60} ${baseY-83} L${cx+42} ${baseY-85} L${cx-42} ${baseY-85} Z `;
  paths += `M${cx-1.5} ${baseY-122} L${cx} ${baseY-140} L${cx+1.5} ${baseY-122} Z `;

  // Tower right side
  cx = 1050;
  const tw = 55, th = 150;
  paths += `M${cx-tw/2} ${baseY} L${cx-tw/2} ${baseY-th*0.65} L${cx+tw/2} ${baseY-th*0.65} L${cx+tw/2} ${baseY} Z `;
  const uw = tw*0.75, ub = baseY-th*0.65;
  paths += `M${cx-uw/2} ${ub} L${cx-uw/2} ${ub-th*0.15} L${cx+uw/2} ${ub-th*0.15} L${cx+uw/2} ${ub} Z `;
  const rb2 = ub-th*0.15;
  paths += `M${cx-tw/2-15} ${rb2+2} Q${cx} ${rb2-th*0.2} ${cx+tw/2+15} ${rb2+2} L${cx+tw/2} ${rb2} L${cx-tw/2} ${rb2} Z `;
  paths += `M${cx-2} ${rb2-th*0.13} L${cx} ${rb2-th*0.25} L${cx+2} ${rb2-th*0.13} Z `;

  // Pagoda far right
  cx = 1150; y = baseY;
  for (let f = 0; f < 4; f++) {
    const fw = 30*(1-f*0.14), fh = 22*(1-f*0.07), ov = fw*0.18;
    paths += `M${cx-fw/2} ${y} L${cx-fw/2} ${y-fh*0.6} L${cx+fw/2} ${y-fh*0.6} L${cx+fw/2} ${y} Z `;
    const ry = y-fh*0.6, rt = ry-fh*0.4;
    paths += `M${cx-fw/2-ov} ${ry+2} Q${cx} ${rt-5} ${cx+fw/2+ov} ${ry+2} L${cx+fw/2} ${ry} L${cx-fw/2} ${ry} Z `;
    y = rt;
  }
  paths += `M${cx-1.5} ${y} L${cx} ${y-15} L${cx+1.5} ${y} Z `;

  // Trees scattered
  const treePositions = [180, 250, 400, 500, 620, 750, 850, 950];
  treePositions.forEach(tx => {
    const tth = 40+Math.random()*35, ttw = 14+Math.random()*10;
    paths += `M${tx-2} ${baseY} L${tx-2} ${baseY-tth*0.4} L${tx+2} ${baseY-tth*0.4} L${tx+2} ${baseY} Z `;
    paths += `M${tx-ttw/2} ${baseY-tth*0.35} Q${tx} ${baseY-tth-5} ${tx+ttw/2} ${baseY-tth*0.35} Z `;
  });

  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" style="width:100%;height:100%"><path d="${paths}" fill="${bldgColor}"/></svg>`;
}

function launchJianghuGame(student, pet, investCoins) {
  // Start probing monster images early so they're ready for battle
  probeJhBossImages();
  const boss = jhBosses[Math.floor(Math.random() * jhBosses.length)];
  const petImgHTML = getPetImage(pet.name, pet.level);
  // Extract just the image src from getPetImage HTML
  const tmpDiv = document.createElement('div');
  tmpDiv.innerHTML = petImgHTML;
  const imgEl = tmpDiv.querySelector('img');
  const petVisual = imgEl ? `<img src="${imgEl.src}" alt="pet" onerror="this.onerror=null;this.parentNode.innerHTML='<span style=font-size:48px>${(function(){const c=PET_CONFIG[pet.name];return c?c.emoji:'🐾'})()}</span>'">` : petImgHTML;

  const overlay = document.createElement('div');
  overlay.className = 'jh-game-overlay';
  overlay.id = 'jhGameOverlay';
  overlay.style.opacity = '0';
  overlay.innerHTML = `
    <div class="jh-scene" id="jhScene">
      <div class="jh-moon"></div>
      <div class="jh-buildings-far" id="jhBldgFar">${jhGenBuildingsSVG('far')}</div>
      <div class="jh-mtn jh-mtn-far" id="jhMtnFar">${jhGenMtnSVG('far')}</div>
      <div class="jh-mtn jh-mtn-mid" id="jhMtnMid">${jhGenMtnSVG('mid')}</div>
      <div class="jh-buildings" id="jhBldgNear">${jhGenBuildingsSVG('near')}</div>
      <div class="jh-mtn jh-mtn-near" id="jhMtnNear">${jhGenMtnSVG('near')}</div>
      <div class="jh-ground" id="jhGround"></div>
      <div class="jh-mist"></div>
      <div class="jh-mist"></div>
      <div class="jh-pet jh-walking" id="jhPet" style="left:-100px">${petVisual}</div>
      <div class="jh-boss" id="jhBoss">
        <div style="width:110px;height:130px">${jhGenBossSVG(boss)}</div>
        <div class="jh-boss-name" style="color:${boss.accent}">${esc(boss.name)}</div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  // Create exit button on document.body to avoid stacking context issues
  // Use very high z-index to escape all stacking contexts
  const exitBtn = document.createElement('button');
  exitBtn.className = 'jh-exit-btn';
  exitBtn.id = 'jhExitBtn';
  exitBtn.textContent = '退出';
  exitBtn.onclick = function() { closeJianghuGame(); };
  document.body.appendChild(exitBtn);
  // Fade in the overlay (transition animation)
  requestAnimationFrame(() => {
    overlay.style.transition = 'opacity 0.6s ease';
    overlay.style.opacity = '1';
  });
  // Show exit button immediately with a delay (so user can exit during journey)
  // v152: 不在旅途阶段显示退出按钮，只在战斗结束后显示
  // setTimeout(() => {
  //   const btn = document.getElementById('jhExitBtn');
  //   if (btn) btn.classList.add('jh-visible');
  // }, 1500);

  // Add particles
  const scene = overlay.querySelector('#jhScene');
  for (let i = 0; i < 15; i++) {
    const p = document.createElement('div');
    p.className = 'jh-particle';
    p.style.left = Math.random() * 100 + '%';
    p.style.top = Math.random() * 100 + '%';
    p.style.animationDuration = (3 + Math.random() * 4) + 's';
    p.style.animationDelay = Math.random() * 5 + 's';
    scene.appendChild(p);
  }

  // Start journey animation
  playJHWindAmbient();
  setTimeout(() => runJianghuJourney(overlay, boss, student, pet, investCoins, petVisual), 300);
}

function runJianghuJourney(overlay, boss, student, pet, investCoins, petVisual) {
  const petEl = overlay.querySelector('#jhPet');
  const bossEl = overlay.querySelector('#jhBoss');
  const far = overlay.querySelector('#jhMtnFar');
  const mid = overlay.querySelector('#jhMtnMid');
  const near = overlay.querySelector('#jhMtnNear');
  const ground = overlay.querySelector('#jhGround');
  const bldgFar = overlay.querySelector('#jhBldgFar');
  const bldgNear = overlay.querySelector('#jhBldgNear');
  const journeyDuration = 3500;
  let startTime = null;
  let lastFootstep = 0;

  function animate(ts) {
    if (!startTime) startTime = ts;
    const elapsed = ts - startTime;
    const progress = Math.min(elapsed / journeyDuration, 1);
    far.style.transform = `translateX(${-progress * 5}%)`;
    mid.style.transform = `translateX(${-progress * 10}%)`;
    near.style.transform = `translateX(${-progress * 18}%)`;
    ground.style.transform = `translateX(${-progress * 20}%)`;
    if(bldgFar) bldgFar.style.transform = `translateX(${-progress * 7}%)`;
    if(bldgNear) bldgNear.style.transform = `translateX(${-progress * 14}%)`;
    petEl.style.left = (-100 + progress * (window.innerWidth * 0.45 + 100)) + 'px';
    // Footstep sounds every ~300ms
    if(elapsed - lastFootstep > 300 && progress < 0.6){ lastFootstep = elapsed; playJHFootstepSound(); }
    if (progress > 0.45) { bossEl.classList.add('jh-appear'); }
    if (progress >= 0.6) {
      petEl.classList.remove('jh-walking');
      setTimeout(() => startJianghuBattle(overlay, boss, student, pet, investCoins, petVisual), 600);
      return;
    }
    requestAnimationFrame(animate);
  }
  requestAnimationFrame(animate);
}

async function startJianghuBattle(overlay, boss, student, pet, investCoins, petVisual) {
  const scene = overlay.querySelector('#jhScene');

  // === 过渡画面：全屏渐黑 + 战斗开始文字 ===
  // Use document.body level overlay to escape all stacking contexts
  const transOverlay = document.createElement('div');
  transOverlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0);z-index:100001;display:flex;align-items:center;justify-content:center;flex-direction:column;transition:background 0.8s ease;pointer-events:none;';
  document.body.appendChild(transOverlay);
  await sleep(50);
  transOverlay.style.background = 'rgba(0,0,0,0.95)';
  await sleep(900);
  // 显示战斗开始文字
  const battleText = document.createElement('div');
  battleText.style.cssText = 'font-family:"Ma Shan Zheng",cursive;font-size:56px;color:#c9a84c;text-shadow:0 0 30px rgba(201,168,76,0.8),0 0 60px rgba(201,168,76,0.4),0 0 100px rgba(201,168,76,0.2);opacity:0;transition:opacity 0.5s ease, transform 0.5s ease;letter-spacing:12px;transform:scale(1.5);';
  battleText.textContent = '⚔ 战斗开始 ⚔';
  transOverlay.appendChild(battleText);
  await sleep(50);
  battleText.style.opacity = '1';
  battleText.style.transform = 'scale(1)';
  await sleep(1000);
  // 渐出
  battleText.style.opacity = '0';
  battleText.style.transform = 'scale(0.8)';
  await sleep(500);
  transOverlay.style.background = 'rgba(0,0,0,0)';
  await sleep(800);
  transOverlay.remove();

  // 等待江湖boss中文命名图片探测完成
  await probeJhBossImages();
  // 同时确保PK数字命名图片已探测（江湖行宠物变身用数字命名图片）
  await probePKMonsterImages();
  
  // 随机选取江湖boss战斗兽宠图片（中文命名）
  const monsterImg = getJhBossMonsterImg();
  // 江湖行宠物变身图片（数字命名：1.png, 2.png 等）
  const jhPetImg = getJhPetMonsterImg();
  
  // ===== 全新战斗系统：前4回合完全公平，第5回合起微调，终结一击慢动作 =====
  const willWin = Math.random() < 0.20; // 胜率20%
  const petMaxHP = Math.floor((100 + pet.level * 100 + (pet.growth || 0) / 30) * 10);
  const bossMaxHP = petMaxHP;

  // Transition to battle scene - 先显示宠物（未变身状态）
  scene.innerHTML = `
    <div class="jh-battle-hud">
      <div class="jh-fi jh-pet-info">
        <div class="jh-fi-name">${esc(student.name)} · ${esc(pet.nickname || pet.name)}</div>
        <div class="jh-hp-outer"><div class="jh-hp-inner jh-php" id="jhPetHp" style="width:100%"></div></div>
        <div class="jh-hp-num jh-php-num" id="jhPetHpNum">${petMaxHP} / ${petMaxHP}</div>
      </div>
      <div class="jh-vs">⚔</div>
      <div class="jh-fi jh-boss-info">
        <div class="jh-fi-name" style="color:${boss.accent}">${esc(boss.name)}</div>
        <div class="jh-hp-outer"><div class="jh-hp-inner jh-bhp" id="jhBossHp" style="width:100%"></div></div>
        <div class="jh-hp-num jh-bhp-num" id="jhBossHpNum">${bossMaxHP} / ${bossMaxHP}</div>
      </div>
    </div>
    <div class="jh-battle-pet" id="jhBPet">${petVisual}</div>
    <div class="jh-battle-boss" id="jhBBoss">${jhGenBossSVG(boss)}</div>
    <div class="jh-battle-buildings">${jhGenBattleBuildingsSVG()}</div>
    <div class="jh-battle-ground"></div>
  `;
  scene.style.background = `
    radial-gradient(ellipse 100% 50% at 50% 20%, rgba(30,15,40,0.6) 0%, transparent 60%),
    radial-gradient(ellipse 80% 40% at 30% 80%, rgba(80,20,0,0.15) 0%, transparent 50%),
    radial-gradient(ellipse 80% 40% at 70% 80%, rgba(80,20,0,0.15) 0%, transparent 50%),
    radial-gradient(circle at 50% 15%, rgba(80,60,100,0.2) 0%, transparent 40%),
    linear-gradient(180deg, #0a0610 0%, #12081a 20%, #1a1020 40%, #150c18 60%, #0d0810 100%)
  `;

  const petEl = overlay.querySelector('#jhBPet');
  const bossEl = overlay.querySelector('#jhBBoss');
  
  // ===== 变身序列：先抖动，再裂纹，再爆炸变身 =====
  await sleep(500);
  
  // 阶段1：宠物抖动
  petEl.style.animation = 'petShake 0.4s ease-in-out infinite';
  playTransformSound();
  await sleep(1500);
  
  // 阶段2：裂纹出现
  const crack = document.createElement('div');
  crack.className = 'crack-lines';
  petEl.appendChild(crack);
  petEl.style.animation = 'petShake 0.2s ease-in-out infinite';
  await sleep(1000);
  
  // 阶段3：爆裂变身
  playExplosionSound();
  const explode = document.createElement('div');
  explode.className = 'crack-overlay';
  petEl.appendChild(explode);
  createHitExplosion(petEl, true);
  // 屏幕震动
  scene.classList.add('jh-screen-shake');
  await sleep(600);
  scene.classList.remove('jh-screen-shake');
  
  // 阶段4：替换为战斗兽宠图片（宠物用数字命名图片）
  petEl.style.animation = '';
  if (jhPetImg) {
    petEl.innerHTML = `<img src="${jhPetImg}" alt="战斗兽宠" style="width:100%;height:100%;object-fit:contain;opacity:0;animation:monsterReveal 0.8s ease-out forwards;filter:drop-shadow(0 0 15px rgba(255,80,0,0.5)) drop-shadow(0 8px 20px rgba(0,0,0,0.7));">`;
  }
  playExplosionSound();
  await sleep(1000);
  
  // 进入战斗状态
  petEl.querySelectorAll('img').forEach(el => { 
    el.style.opacity = '1'; 
    el.style.filter = 'drop-shadow(0 0 15px rgba(255,80,0,0.5)) drop-shadow(0 8px 20px rgba(0,0,0,0.7))'; 
  });

  let petHp = petMaxHP;
  let bossHp = bossMaxHP;
  let turn = 0;
  const comboTexts = ['破！', '斩！', '杀！', '连击！', '绝杀！'];

  // HP条更新函数
  function jhUpdateHPBar(barId, current, max) {
    const bar = overlay.querySelector('#' + barId);
    if (!bar) return;
    const pct = Math.max(0, Math.min(100, (current / max) * 100));
    bar.style.width = pct + '%';
    if (pct > 50) bar.style.background = 'linear-gradient(90deg, #44cc44, #88ff88)';
    else if (pct > 25) bar.style.background = 'linear-gradient(90deg, #ffaa00, #ffcc44)';
    else bar.style.background = 'linear-gradient(90deg, #ff3333, #ff6666)';
    const numId = barId === 'jhPetHp' ? 'jhPetHpNum' : 'jhBossHpNum';
    const numEl = overlay.querySelector('#' + numId);
    if (numEl) {
      const displayCurrent = Math.max(0, Math.round(current));
      numEl.textContent = `${displayCurrent} / ${max}`;
      if (pct <= 25) numEl.classList.add('jh-hp-danger');
      else numEl.classList.remove('jh-hp-danger');
    }
  }

  // ===== 命运修正系统：前2回合完全公平，第3回合起微调 =====
  function getDestinyModifier(isPetAtk, turnNum, attackerHp, attackerMaxHp) {
    const isWinner = (isPetAtk === willWin);
    let mod = 1.0;
    
    // 前2回合完全公平，不做任何修正
    if (turnNum <= 2) {
      return mod;
    }
    
    // 第3回合起：根据血量差距调整胜方/败方伤害
    const petRatio = petHp / petMaxHP;
    const bossRatio = bossHp / bossMaxHP;
    const hpDiff = petRatio - bossRatio; // 正值=宠物领先，负值=Boss领先
    
    if (isWinner) {
      // 预设胜方：血量落后越多，修正越大（更早介入，力度更大）
      if (hpDiff < -0.05) {
        mod += Math.min(Math.abs(hpDiff) * 1.0, 0.50); // 最多+50%
      }
      // 额外：如果胜方血量很低（<25%），额外提升伤害以尽快结束战斗
      const winnerRatio = isPetAtk ? petRatio : bossRatio;
      if (winnerRatio < 0.25) {
        mod += 0.30;
      } else if (winnerRatio < 0.40) {
        mod += 0.15;
      }
    } else {
      // 预设败方：血量领先越多，修正越小（悄悄削弱）
      if (hpDiff > 0.05) {
        mod -= Math.min(hpDiff * 0.7, 0.35); // 最多-35%
      }
    }
    
    return mod;
  }

  // ===== 攻击函数（模仿PK对战风格）=====
  async function jhDoAttack(isPetAtk, isComboAttack = false, isFinalStrike = false) {
    const atkEl = isPetAtk ? petEl : bossEl;
    const defEl = isPetAtk ? bossEl : petEl;
    const atkHp = isPetAtk ? petHp : bossHp;
    const atkMaxHP = isPetAtk ? petMaxHP : bossMaxHP;
    const defHp = isPetAtk ? bossHp : petHp;
    const defMaxHP = isPetAtk ? bossMaxHP : petMaxHP;
    
    const skill = getRandomSkill();
    const skillName = skill.name || '普通攻击';
    
    // 终结一击：慢动作蓄力
    if (isFinalStrike) {
      playJHFinalStrikeSound(); // 终结一击专属音效
      await sleep(400);
      // 全屏暗化
      const tint = document.createElement('div');
      tint.className = 'screen-tint';
      tint.style.background = 'rgba(0,0,0,0.6)';
      scene.appendChild(tint);
      setTimeout(() => tint.remove(), 2000);
      
      // 蓄力文字
      jhShowFloatingText(scene, isPetAtk ? 'left' : 'right', '⚡ 蓄力...', '#ffaa00', 36);
      
      // 蓄力动画：角色发光+震动
      atkEl.style.transition = 'all 0.8s ease-in-out';
      atkEl.style.filter = 'brightness(2) drop-shadow(0 0 40px rgba(255,200,0,1)) drop-shadow(0 0 80px rgba(255,100,0,0.8))';
      atkEl.style.transform = 'scale(1.3)';
      scene.classList.add('jh-screen-shake');
      await sleep(1200);
      scene.classList.remove('jh-screen-shake');
      
      // 冲刺
      atkEl.style.transform = isPetAtk ? 'translateX(120px) scale(1.4)' : 'translateX(-120px) scale(1.4)';
      await sleep(300);
    } else {
      // 普通攻击：显示技能名称
      jhShowFloatingText(scene, isPetAtk ? 'left' : 'right', skillName, isPetAtk ? '#40916c' : boss.accent, 28);
      await sleep(350);
      
      // 蓄力动画
      atkEl.style.transition = 'transform 0.2s, filter 0.2s';
      atkEl.style.filter = 'brightness(1.5) drop-shadow(0 0 20px rgba(255,200,0,0.8))';
      await sleep(200);
      atkEl.style.filter = '';
      
      // 冲刺动画
      atkEl.style.transform = isPetAtk ? 'translateX(80px) scale(1.15)' : 'translateX(-80px) scale(1.15)';
    }
    
    // === 闪避判定：8%几率（连击不可闪避，终结一击不可闪避）===
    const dodged = !isComboAttack && !isFinalStrike && Math.random() < 0.08;
    if (dodged) {
      await sleep(200);
      atkEl.style.transform = '';
      jhShowFloatingText(scene, isPetAtk ? 'right' : 'left', '💨 闪避!', '#66ddff', 32);
      return { dmg: 0, dodged: true, isCrit: false };
    }
    
    // === 伤害计算 ===
    // 基础伤害：防守方maxHP的18-26%
    const minD = Math.floor(defMaxHP * 0.18);
    const maxD = Math.floor(defMaxHP * 0.26);
    let baseDmg = minD + Math.floor(Math.random() * (maxD - minD + 1));
    
    // 命运修正
    const destinyMod = getDestinyModifier(isPetAtk, turn, atkHp, atkMaxHP);
    baseDmg = Math.floor(baseDmg * destinyMod);
    
    // 连击伤害降低25%
    if (isComboAttack) {
      baseDmg = Math.floor(baseDmg * 0.75);
    }
    
    // 终结一击：伤害翻倍
    if (isFinalStrike) {
      baseDmg = Math.floor(baseDmg * 2.0);
    }
    
    // 绝地反击：血量越低伤害越高（觉醒状态下效果更强）
    const hpRatio = atkHp / atkMaxHP;
    const isAwakened = (isPetAtk && petAwakened) || (!isPetAtk && bossAwakened);
    if (hpRatio < 0.30) {
      baseDmg = Math.floor(baseDmg * (isAwakened ? 1.5 : 1.25));
    } else if (hpRatio < 0.50) {
      baseDmg = Math.floor(baseDmg * (isAwakened ? 1.3 : 1.10));
    }
    
    // 逆袭加成：血量落后对手越多，伤害越高（觉醒状态下效果更强）
    const defRatio = defHp / defMaxHP;
    const gap = defRatio - hpRatio;
    if (gap > 0.30) {
      baseDmg = Math.floor(baseDmg * (isAwakened ? 1.45 : 1.20));
    } else if (gap > 0.15) {
      baseDmg = Math.floor(baseDmg * (isAwakened ? 1.25 : 1.10));
    }
    
    // === 暴击：12%几率，1.5-1.8倍（连击不可暴击，终结一击必定暴击）===
    const isCrit = isFinalStrike || (!isComboAttack && Math.random() < 0.12);
    let finalDmg;
    if (isCrit) {
      const critMult = isFinalStrike ? 2.0 : (1.5 + Math.random() * 0.3);
      finalDmg = Math.floor(baseDmg * critMult);
    } else {
      finalDmg = baseDmg;
    }
    
    // 单次伤害封顶：不超过防守方maxHP的40%（终结一击可达50%）
    const dmgCap = Math.floor(defMaxHP * (isFinalStrike ? 0.50 : 0.40));
    finalDmg = Math.min(finalDmg, dmgCap);
    finalDmg = Math.max(finalDmg, Math.floor(defMaxHP * 0.05)); // 保底5%
    
    // 扣血
    if (isPetAtk) {
      const bossHpBefore = bossHp;
      bossHp = Math.max(0, bossHp - finalDmg);
      // 主角光环：预设胜方（boss胜时boss是胜方）非终结一击下HP不低于随机低值
      if (bossHp <= 0 && willWin === false && !isFinalStrike) {
        // 随机1~50，但不超过扣血前的值-1（确保不回血）
        bossHp = Math.min(Math.floor(Math.random() * 50) + 1, Math.max(1, bossHpBefore - 1));
      }
      jhUpdateHPBar('jhBossHp', bossHp, bossMaxHP);
    } else {
      const petHpBefore = petHp;
      petHp = Math.max(0, petHp - finalDmg);
      // 主角光环：预设胜方（宠物胜时宠物是胜方）非终结一击下HP不低于随机低值
      if (petHp <= 0 && willWin === true && !isFinalStrike) {
        // 随机1~50，但不超过扣血前的值-1（确保不回血）
        petHp = Math.min(Math.floor(Math.random() * 50) + 1, Math.max(1, petHpBefore - 1));
      }
      jhUpdateHPBar('jhPetHp', petHp, petMaxHP);
    }
    
    // 受击动画
    await sleep(150);
    atkEl.style.transform = '';
    atkEl.style.filter = '';
    
    defEl.style.transition = 'transform 0.1s';
    defEl.style.transform = (isPetAtk ? 'translateX(40px)' : 'translateX(-40px)') + ' scale(0.9)';
    defEl.style.filter = 'brightness(3) saturate(0)';
    
    // 显示伤害数字
    jhShowDamageNum(defEl, finalDmg, isCrit);
    jhShowAttackDmg(atkEl, finalDmg, isCrit, isFinalStrike);
    
    // 播放技能特效
    playSkillAttack(atkEl, defEl, isCrit, skill, null);
    
    // 暴击/终结一击画面震动
    if (isCrit || isFinalStrike) {
      scene.classList.add('jh-screen-shake');
      setTimeout(() => scene.classList.remove('jh-screen-shake'), isFinalStrike ? 800 : 500);
    }
    
    // 受击恢复
    setTimeout(() => {
      defEl.style.transform = '';
      defEl.style.filter = '';
    }, 300);
    
    return { dmg: finalDmg, dodged: false, isCrit };
  }

  // ===== 觉醒系统：觉醒后伤害真的会大幅提升 =====
  let petAwakened = false;
  let bossAwakened = false;
  const awakenThreshold = 0.35;
  const awakenTexts = ['绝地反击！', '觉醒！', '背水一战！', '破釜沉舟！', '怒火中烧！'];

  function jhTriggerAwakening(isPet) {
    const el = isPet ? petEl : bossEl;
    if (!el || (isPet ? petAwakened : bossAwakened)) return;
    if (isPet) petAwakened = true; else bossAwakened = true;
    el.classList.add('jh-awakening');
    const awakenText = awakenTexts[Math.floor(Math.random() * awakenTexts.length)];
    const textEl = document.createElement('div');
    textEl.className = 'jh-awaken-text';
    textEl.style.color = isPet ? '#40916c' : boss.accent;
    textEl.textContent = awakenText;
    scene.appendChild(textEl);
    setTimeout(() => textEl.remove(), 1800);
    const ringEl = document.createElement('div');
    ringEl.className = 'jh-awaken-ring';
    ringEl.style.borderColor = isPet ? 'rgba(64,145,108,0.8)' : `${boss.accent}cc`;
    scene.appendChild(ringEl);
    setTimeout(() => ringEl.remove(), 1200);
    scene.classList.add('jh-screen-shake');
    setTimeout(() => scene.classList.remove('jh-screen-shake'), 500);
  }

  function jhCheckAwakening() {
    if (!petAwakened && petHp > 0 && petHp <= petMaxHP * awakenThreshold) {
      jhTriggerAwakening(true);
    }
    if (!bossAwakened && bossHp > 0 && bossHp <= bossMaxHP * awakenThreshold) {
      jhTriggerAwakening(false);
    }
  }

  // ===== 主战斗循环（最多8回合）=====
  // v155: Safety timeout - force end battle after 60 seconds
  var _jhBattleTimeout = setTimeout(function() {
    console.warn('[江湖行] 战斗超时，强制结束');
    if (willWin) { bossHp = 0; } else { petHp = 0; }
  }, 60000);
  
  try {
  while (petHp > 0 && bossHp > 0 && turn < 8) {
    turn++;
    await sleep(500);
    
    // 每回合随机先手
    const petFirst = Math.random() < 0.5;
    
    // === 先手攻击 ===
    const r1 = await jhDoAttack(petFirst, false, false);
    if (turn % 3 === 0) {
      const side = petFirst ? 'right' : 'left';
      jhCreateCombo(scene, comboTexts[Math.floor(Math.random() * comboTexts.length)], side, boss);
    }
    if (petHp <= 0 || bossHp <= 0) break;
    
    // 检查觉醒
    jhCheckAwakening();
    
    // === 反击！先手攻击造成>22%伤害时，防守方40%几率反击 ===
    if (!r1.dodged && r1.dmg > (petFirst ? bossMaxHP : petMaxHP) * 0.22 && Math.random() < 0.40) {
      await sleep(500);
      jhShowFloatingText(scene, petFirst ? 'right' : 'left', '💥 反击!', '#ff55aa', 36);
      await sleep(350);
      const rc = await jhDoAttack(!petFirst, false, false);
      if (petHp <= 0 || bossHp <= 0) break;
    }
    
    // === 连击！15%几率触发额外攻击 ===
    if (!r1.isCrit && !r1.dodged && Math.random() < 0.15) {
      await sleep(400);
      jhShowFloatingText(scene, petFirst ? 'left' : 'right', '⚡ 连击!', '#ff9900', 34);
      await sleep(300);
      await jhDoAttack(petFirst, true, false);
      if (petHp <= 0 || bossHp <= 0) break;
    }
    
    await sleep(600);
    
    // === 后手攻击 ===
    const r2 = await jhDoAttack(!petFirst, false, false);
    if (turn % 3 === 0) {
      const side = !petFirst ? 'right' : 'left';
      jhCreateCombo(scene, comboTexts[Math.floor(Math.random() * comboTexts.length)], side, boss);
    }
    if (petHp <= 0 || bossHp <= 0) break;
    
    // 检查觉醒
    jhCheckAwakening();
    
    // === 反击！后手攻击造成大伤害时，防守方40%几率反击 ===
    if (!r2.dodged && r2.dmg > (!petFirst ? bossMaxHP : petMaxHP) * 0.22 && Math.random() < 0.40) {
      await sleep(500);
      jhShowFloatingText(scene, !petFirst ? 'right' : 'left', '💥 反击!', '#ff55aa', 36);
      await sleep(350);
      await jhDoAttack(petFirst, false, false);
      if (petHp <= 0 || bossHp <= 0) break;
    }
    
    // === 后手连击 ===
    if (!r2.isCrit && !r2.dodged && Math.random() < 0.15) {
      await sleep(400);
      jhShowFloatingText(scene, !petFirst ? 'left' : 'right', '⚡ 连击!', '#ff9900', 34);
      await sleep(300);
      await jhDoAttack(!petFirst, true, false);
      if (petHp <= 0 || bossHp <= 0) break;
    }
    
    // 败方血量过低时提前结束，为终结一击留机会
    const loserHp = willWin ? bossHp : petHp;
    const loserMaxHP = willWin ? bossMaxHP : petMaxHP;
    if (loserHp > 0 && loserHp < loserMaxHP * 0.20) break;
    
    await sleep(700);
  }
  
  // ===== 终结一击：败方还有血量时发起致命一击 =====
  const loserHpFinal = willWin ? bossHp : petHp;
  if (loserHpFinal > 0) {
    // 败方还有血量，预设胜方发起终结一击
    await sleep(800);
    jhShowFloatingText(scene, willWin ? 'left' : 'right', '⚡ 终极奥义!', willWin ? '#40916c' : boss.accent, 42);
    try {
      await jhDoAttack(willWin, false, true);
    } catch(e) {
      console.error('[江湖行] 终结一击出错:', e);
    }
  }
  
  // 确保败方血量精确归零，胜方血量随机保留1~50（看起来像险胜，不穿帮）
  const winnerRemainHp = Math.floor(Math.random() * 50) + 1; // 1-50随机
  if (willWin) {
    bossHp = 0;
    if (petHp <= 0) petHp = winnerRemainHp; // 胜方不能血量为0，随机剩余
  } else {
    petHp = 0;
    if (bossHp <= 0) bossHp = winnerRemainHp; // 胜方不能血量为0，随机剩余
  }
  jhUpdateHPBar('jhPetHp', petHp, petMaxHP);
  jhUpdateHPBar('jhBossHp', bossHp, bossMaxHP);

  await sleep(1200);
  // v153: 用try-catch包裹结算，防止特效出错导致卡死
  try {
    showJianghuResult(overlay, willWin, student, pet, investCoins, boss);
  } catch(e) {
    console.error('[江湖行] 结算出错:', e);
    // 出错时直接显示退出按钮
    const exitBtn = document.getElementById('jhExitBtn');
    if (exitBtn) exitBtn.classList.add('jh-visible');
  }
  } catch(battleErr) {
    console.error('[江湖行] 战斗循环出错:', battleErr);
    // 出错时强制设置HP并显示退出按钮
    if (willWin) { bossHp = 0; } else { petHp = 0; }
    jhUpdateHPBar('jhPetHp', petHp, petMaxHP);
    jhUpdateHPBar('jhBossHp', bossHp, bossMaxHP);
    try { showJianghuResult(overlay, willWin, student, pet, investCoins, boss); }
    catch(e2) {
      const exitBtn = document.getElementById('jhExitBtn');
      if (exitBtn) exitBtn.classList.add('jh-visible');
    }
  }
  // v155: Clear safety timeout
  clearTimeout(_jhBattleTimeout);
}



// ===== 战斗序列生成器：预计算完整战斗过程 =====
// 核心设计：
// 1. 预设胜方（25%胜率），败方血量精确归零，绝无平局
// 2. 胜方剩余血量随战斗长度自然变化（15%~55%），不会每次都是1滴血
// 3. 连击系统：随机选一个回合为连击回合，该方攻击两次
// 4. 败方最后一击为"终结一击"，戏剧性拉满
function jhGenBattleSequence(willWin, petMaxHP, bossMaxHP) {
  // 战斗长度：5~9回合（双方各攻一次=1回合）
  // 短战斗=碾压局，长战斗=苦战
  const minLength = 5;
  const maxLength = 9;
  const battleLength = minLength + Math.floor(Math.random() * (maxLength - minLength + 1));

  // 胜方剩余血量百分比（根据战斗长度动态调整）
  // 短战斗 → 胜方剩余多（碾压）；长战斗 → 胜方剩余少（苦战）
  let winnerHpPct;
  if (battleLength <= 5) {
    winnerHpPct = 0.38 + Math.random() * 0.17; // 38%~55%
  } else if (battleLength <= 7) {
    winnerHpPct = 0.22 + Math.random() * 0.20; // 22%~42%
  } else {
    winnerHpPct = 0.13 + Math.random() * 0.17; // 13%~30%
  }

  // 决定连击回合和连击方
  const comboTurnIdx = 1 + Math.floor(Math.random() * (battleLength - 2)); // 第2~倒数第2回合
  // 连击方：败方获得连击概率60%（增加悬念），胜方40%
  const comboIsLoser = Math.random() < 0.6;
  const comboIsPet = comboIsLoser ? !willWin : willWin;

  // 计算双方攻击次数
  // 每回合：先手攻+后手攻，连击回合连击方多攻一次
  let petTotalAttacks = battleLength;
  let bossTotalAttacks = battleLength;
  // 连击方多一次攻击
  if (comboIsPet) petTotalAttacks++; else bossTotalAttacks++;

  // 总伤害约束：
  // 胜方总输出 = loserMaxHP（胜方把败方血量打到0）
  // 败方总输出 = winnerMaxHP * (1 - winnerHpPct)（败方打掉胜方这么多血，胜方剩余 winnerHpPct）
  const loserMaxHP = willWin ? bossMaxHP : petMaxHP;
  const winnerMaxHP = willWin ? petMaxHP : bossMaxHP;
  const winnerTotalDmg = loserMaxHP;  // 胜方输出 = 败方满血（击败败方）
  const loserTotalDmg = Math.floor(winnerMaxHP * (1 - winnerHpPct)); // 败方输出 = 胜方损失的血量

  // 败方攻击次数 / 胜方攻击次数
  const loserAttacks = willWin ? bossTotalAttacks : petTotalAttacks;
  const winnerAttacks = willWin ? petTotalAttacks : bossTotalAttacks;

  // 生成原始伤害值（±25%随机波动，营造自然节奏）
  const loserRawDmg = [];
  const loserAvg = loserTotalDmg / loserAttacks;
  for (let i = 0; i < loserAttacks; i++) {
    const v = 0.75 + Math.random() * 0.5;
    loserRawDmg.push(Math.max(1, Math.floor(loserAvg * v)));
  }
  const winnerScaled = [];
  const winnerAvg = winnerTotalDmg / winnerAttacks;
  for (let i = 0; i < winnerAttacks; i++) {
    const v = 0.75 + Math.random() * 0.5;
    winnerScaled.push(Math.max(1, Math.floor(winnerAvg * v)));
  }

  // 缩放：使败方总伤害精确 = loserTotalDmg
  const loserRawSum = loserRawDmg.reduce((a, b) => a + b, 0);
  if (loserRawSum > 0) {
    const lScale = loserTotalDmg / loserRawSum;
    for (let i = 0; i < loserAttacks; i++) loserRawDmg[i] = Math.max(1, Math.round(loserRawDmg[i] * lScale));
    const lAdj = loserTotalDmg - loserRawDmg.reduce((a, b) => a + b, 0);
    loserRawDmg[loserRawDmg.length - 1] = Math.max(1, loserRawDmg[loserRawDmg.length - 1] + lAdj);
  }

  // 缩放：使胜方总伤害精确 = winnerTotalDmg
  const winnerRawSum = winnerScaled.reduce((a, b) => a + b, 0);
  if (winnerRawSum > 0) {
    const wScale = winnerTotalDmg / winnerRawSum;
    for (let i = 0; i < winnerAttacks; i++) winnerScaled[i] = Math.max(1, Math.round(winnerScaled[i] * wScale));
    const wAdj = winnerTotalDmg - winnerScaled.reduce((a, b) => a + b, 0);
    winnerScaled[winnerScaled.length - 1] = Math.max(1, winnerScaled[winnerScaled.length - 1] + wAdj);
  }

  // 单次伤害封顶：不超过loserMaxHP的15%，保底4%
  const dmgCap = Math.floor(loserMaxHP * 0.15);
  const dmgFloor = Math.floor(loserMaxHP * 0.04);

  function capAndFix(arr, target) {
    for (let i = 0; i < arr.length; i++) {
      arr[i] = Math.min(arr[i], dmgCap);
      arr[i] = Math.max(arr[i], dmgFloor);
    }
    let sum = arr.reduce((a, b) => a + b, 0);
    if (sum < target) {
      let deficit = target - sum;
      for (let i = 0; i < arr.length && deficit > 0; i++) {
        const canAdd = Math.min(dmgCap, arr[i] + Math.ceil(deficit / (arr.length - i))) - arr[i];
        if (canAdd > 0) { arr[i] += canAdd; deficit -= canAdd; }
      }
      if (arr.reduce((a, b) => a + b, 0) < target) {
        arr[arr.length - 1] += target - arr.reduce((a, b) => a + b, 0);
      }
    } else if (sum > target) {
      const ratio = target / sum;
      for (let i = 0; i < arr.length; i++) arr[i] = Math.max(dmgFloor, Math.round(arr[i] * ratio));
      const finalAdj = target - arr.reduce((a, b) => a + b, 0);
      arr[arr.length - 1] += finalAdj;
    }
  }

  capAndFix(loserRawDmg, loserTotalDmg);
  capAndFix(winnerScaled, winnerTotalDmg);

  // 败方伤害重分配：确保败方在前N-1次攻击后不会杀死胜方
  // 排序后递增分配，最后一击（终结一击）拿剩余全部
  loserRawDmg.sort((a, b) => a - b);
  const loserMaxBeforeLast = Math.floor(loserTotalDmg * 0.82);
  let cumul = 0;
  for (let i = 0; i < loserRawDmg.length - 1; i++) {
    const maxForThis = loserMaxBeforeLast - cumul;
    loserRawDmg[i] = Math.min(loserRawDmg[i], Math.max(dmgFloor, maxForThis));
    cumul += loserRawDmg[i];
  }
  // 最后一击 = 全部剩余（确保败方总伤害精确 = loserTotalDmg）
  loserRawDmg[loserRawDmg.length - 1] = Math.max(dmgFloor, loserTotalDmg - cumul);

  // 构建攻击序列：按回合组织
  // 每回合：先手方攻击 + 后手方攻击（连击回合连击方攻两次）
  let petIdx = 0, bossIdx = 0;
  const turns = [];

  for (let t = 0; t < battleLength; t++) {
    const playerFirst = Math.random() < 0.5;
    const turnAtks = [];
    const isCombo = (t === comboTurnIdx);

    function pushAtk(isPet) {
      // 确定当前攻击方是胜方还是败方
      const isLoser = (isPet && !willWin) || (!isPet && willWin);
      const idx = isPet ? petIdx++ : bossIdx++;
      const dmg = isLoser ? loserRawDmg[idx] : winnerScaled[idx];
      const isCrit = Math.random() < 0.12;
      turnAtks.push({
        isPet: isPet,
        dmg: dmg,
        isCrit: isCrit,
        isFinisher: false
      });
    }

    if (isCombo) {
      // 连击回合：连击方攻击两次
      if (playerFirst === comboIsPet) {
        // 连击方先手
        pushAtk(comboIsPet);
        pushAtk(comboIsPet); // 连击第二下
        pushAtk(!comboIsPet);
      } else {
        pushAtk(!comboIsPet);
        pushAtk(comboIsPet);
        pushAtk(comboIsPet); // 连击第二下
      }
    } else {
      if (playerFirst) {
        pushAtk(true);
        pushAtk(false);
      } else {
        pushAtk(false);
        pushAtk(true);
      }
    }

    turns.push({
      attacks: turnAtks,
      isCombo: isCombo,
      comboIsPet: isCombo ? comboIsPet : null
    });
  }

  // 标记败方的最后一次攻击为"终结一击"
  let loserLastAtk = null;
  for (let t = turns.length - 1; t >= 0; t--) {
    for (let a = turns[t].attacks.length - 1; a >= 0; a--) {
      const atk = turns[t].attacks[a];
      const atkIsLoser = (atk.isPet && !willWin) || (!atk.isPet && willWin);
      if (atkIsLoser) {
        atk.isFinisher = true;
        loserLastAtk = atk;
        break;
      }
    }
    if (loserLastAtk) break;
  }

  return { turns, willWin, petMaxHP, bossMaxHP };
}


// 在受击方头顶显示受击伤害数字（红色）
function jhShowDamageNum(container, damage, isCrit) {
  if (!container) return;
  const el = document.createElement('div');
  el.style.cssText = `
    position: absolute;
    top: -10px;
    left: 50%;
    transform: translateX(-50%);
    font-family: 'Ma Shan Zheng', cursive;
    font-size: ${isCrit ? '56px' : '42px'};
    font-weight: 900;
    color: ${isCrit ? '#ff2200' : '#ff6644'};
    text-shadow: ${isCrit
      ? '4px 4px 0 #880000, 0 0 30px #ff0000, 0 0 60px #ff4400'
      : '3px 3px 0 #550000, 0 0 15px rgba(255,50,0,0.7)'};
    pointer-events: none;
    z-index: 999;
    white-space: nowrap;
    animation: jhDmgFloat 1.3s ease-out forwards;
  `;
  el.innerHTML = isCrit ? `💥暴击! -${damage}` : `-${damage}`;
  container.appendChild(el);
  setTimeout(() => el.remove(), 1300);
}

// 在攻击方头顶显示造成伤害（金色）
function jhShowAttackDmg(container, damage, isCrit, isFinalStrike = false) {
  if (!container) return;
  const el = document.createElement('div');
  el.style.cssText = `
    position: absolute;
    top: -20px;
    left: 50%;
    transform: translateX(-50%);
    font-family: 'Ma Shan Zheng', cursive;
    font-size: ${isFinalStrike ? '48px' : isCrit ? '42px' : '32px'};
    font-weight: 800;
    color: ${isFinalStrike ? '#ff3300' : isCrit ? '#ffaa00' : '#ffdd66'};
    text-shadow: ${isFinalStrike
      ? '3px 3px 0 #660000, 0 0 30px rgba(255,50,0,1), 0 0 60px rgba(255,100,0,0.8)'
      : isCrit
        ? '3px 3px 0 #884400, 0 0 20px rgba(255,160,0,0.9)'
        : '2px 2px 0 #664400, 0 0 12px rgba(255,200,0,0.6)'};
    pointer-events: none;
    z-index: 999;
    white-space: nowrap;
    animation: jhDmgFloat 1.3s ease-out forwards;
  `;
  el.innerHTML = isFinalStrike ? `💥超级暴击! ${damage}伤害` : isCrit ? `💥暴击! ${damage}伤害` : `${damage}伤害`;
  container.appendChild(el);
  setTimeout(() => el.remove(), 1300);
}

// 在场景侧边显示闪避/暴击公告文字
function jhShowFloatingText(parent, side, text, color, fontSize) {
  const el = document.createElement('div');
  el.style.cssText = `
    position: absolute;
    top: 38%;
    ${side === 'right' ? 'right: 15%' : 'left: 15%'};
    font-family: 'Ma Shan Zheng', cursive;
    font-size: ${fontSize || 28}px;
    font-weight: 900;
    color: ${color || '#66ddff'};
    text-shadow: 0 0 15px ${color || 'rgba(100,200,255,0.8)'}, 2px 2px 0 #003344;
    pointer-events: none;
    z-index: 999;
    white-space: nowrap;
    animation: jhAnnounceFloat 1.2s ease-out forwards;
  `;
  el.textContent = text;
  parent.appendChild(el);
  setTimeout(() => el.remove(), 1200);
}

function jhCreateSlash(parent, side, boss) {
  const el = document.createElement('div');
  el.className = 'jh-slash';
  el.innerHTML = `<svg width="80" height="80" viewBox="0 0 100 100"><path d="M10 90 Q30 50 90 10" stroke="${side === 'right' ? '#c9a84c' : boss.accent}" stroke-width="3" fill="none" opacity="0.8"/><path d="M20 85 Q40 45 95 15" stroke="#fff" stroke-width="1" fill="none" opacity="0.4"/></svg>`;
  el.style.left = side === 'right' ? '62%' : '18%';
  el.style.top = '32%';
  parent.appendChild(el);
  el.classList.add('jh-active');
  setTimeout(() => el.remove(), 500);
}

function jhCreateSparks(parent, side) {
  const c = document.createElement('div');
  c.className = 'jh-spark';
  c.style.left = (side === 'right' ? 68 : 22) + '%';
  c.style.top = '38%';
  for (let i = 0; i < 6; i++) {
    const s = document.createElement('span');
    const a = Math.random() * Math.PI * 2;
    const d = 25 + Math.random() * 35;
    s.style.setProperty('--sx', Math.cos(a) * d + 'px');
    s.style.setProperty('--sy', Math.sin(a) * d + 'px');
    s.style.background = Math.random() > 0.5 ? '#c9a84c' : '#fff';
    c.appendChild(s);
  }
  parent.appendChild(c);
  setTimeout(() => c.remove(), 500);
}

function jhShakeEl(el) {
  if (!el) return;
  el.classList.remove('jh-shake');
  void el.offsetWidth;
  el.classList.add('jh-shake');
}
function jhApplyClass(el, cls, duration) {
  if (!el) return;
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
  setTimeout(() => el.classList.remove(cls), duration);
}
function jhAttackFeedback(attackerEl, targetEl, isPlayerAtk, scene) {
  if (!attackerEl || !targetEl) return;
  // 保存攻击前的原始 transform（如 monsterReveal 动画最终态的 scaleX(-1) 等）
  const attackerOrigTransform = attackerEl.style.transform || '';
  const targetOrigTransform = targetEl.style.transform || '';
  // 攻击方：冲刺 + 内部图片晃动
  attackerEl.style.transition = 'transform 0.15s cubic-bezier(0.2,1,0.3,1)';
  attackerEl.style.transform = isPlayerAtk ? 'translateX(70px) scale(1.1)' : 'translateX(-70px) scale(1.1)';
  const atkImg = attackerEl.querySelector('img');
  if (atkImg) { atkImg.style.transition = 'transform 0.1s'; atkImg.style.transform = 'rotate(' + (isPlayerAtk ? '8' : '-8') + 'deg)'; }
  // 200ms后攻击到达 → 攻击方回弹 + 被击方受击
  setTimeout(() => {
    attackerEl.style.transition = 'transform 0.25s cubic-bezier(0.34,1.56,0.64,1)';
    attackerEl.style.transform = attackerOrigTransform || 'translateX(0) scale(1)';
    if (atkImg) { atkImg.style.transition = 'transform 0.2s'; atkImg.style.transform = ''; }
    // 被击方：后退 + 闪白 + 图片剧烈晃动
    targetEl.style.transition = 'transform 0.1s ease-out';
    targetEl.style.transform = (isPlayerAtk ? 'translateX(30px)' : 'translateX(-30px)') + ' scale(0.9)';
    targetEl.style.filter = 'brightness(3) saturate(0)';
    const tgtImg = targetEl.querySelector('img');
    if (tgtImg) { tgtImg.style.transition = 'transform 0.05s'; tgtImg.style.transform = 'rotate(' + (isPlayerAtk ? '12' : '-12') + 'deg) scale(0.9)'; }
    // 50ms 闪白结束 → 开始剧烈抖动
    setTimeout(() => {
      targetEl.style.filter = 'brightness(0.7) hue-rotate(-15deg)';
      if (tgtImg) { tgtImg.style.transform = 'rotate(' + (isPlayerAtk ? '-10' : '10') + 'deg) scale(1.05)'; }
    }, 50);
    setTimeout(() => {
      targetEl.style.filter = 'brightness(1.5)';
      if (tgtImg) { tgtImg.style.transform = 'rotate(' + (isPlayerAtk ? '6' : '-6') + 'deg)'; }
    }, 100);
    setTimeout(() => {
      targetEl.style.filter = 'brightness(0.8)';
      if (tgtImg) { tgtImg.style.transform = 'rotate(' + (isPlayerAtk ? '-4' : '4') + 'deg) scale(0.95)'; }
    }, 150);
    // 200ms 被击方回正：恢复原始 transform（不清除动画最终态）
    setTimeout(() => {
      targetEl.style.transition = 'transform 0.3s cubic-bezier(0.34,1.56,0.64,1), filter 0.3s';
      targetEl.style.transform = targetOrigTransform || 'translateX(0) scale(1)';
      targetEl.style.filter = '';
      if (tgtImg) { tgtImg.style.transition = 'transform 0.25s cubic-bezier(0.34,1.56,0.64,1)'; tgtImg.style.transform = ''; }
    }, 220);
    // HP条闪光
    const hpId = isPlayerAtk ? '#jhBossHp' : '#jhPetHp';
    const hpBar = scene.closest('.jh-overlay')?.querySelector(hpId) || document.querySelector(hpId);
    if (hpBar) jhApplyClass(hpBar, 'jh-hp-hit', 400);
    // 画面微震
    if (scene) jhApplyClass(scene, 'jh-screen-shake', 300);
    // 火花
    jhCreateSparks(scene, isPlayerAtk ? 'right' : 'left');
  }, 200);
}

function jhCreateCombo(parent, text, side, boss) {
  const el = document.createElement('div');
  el.className = 'jh-combo';
  el.textContent = text;
  el.style.left = side === 'right' ? '60%' : '20%';
  el.style.top = '28%';
  el.style.fontSize = '2.2rem';
  el.style.color = side === 'right' ? '#c9a84c' : boss.accent;
  el.style.textShadow = `0 0 15px ${side === 'right' ? 'rgba(201,168,76,0.5)' : 'rgba(204,34,51,0.5)'}`;
  parent.appendChild(el);
  el.classList.add('jh-show');
  setTimeout(() => el.remove(), 800);
}

function jhCreateBurst(parent, side, boss) {
  const el = document.createElement('div');
  el.className = 'jh-burst';
  el.style.left = `calc(${side === 'right' ? 65 : 22}% - 90px)`;
  el.style.top = 'calc(33% - 90px)';
  el.innerHTML = `<svg viewBox="0 0 180 180"><circle cx="90" cy="90" r="50" fill="none" stroke="${side === 'right' ? '#c9a84c' : boss.accent}" stroke-width="2" opacity="0.5"/><circle cx="90" cy="90" r="25" fill="${side === 'right' ? 'rgba(201,168,76,0.12)' : 'rgba(204,34,51,0.12)'}"/></svg>`;
  parent.appendChild(el);
  el.classList.add('jh-active');
  setTimeout(() => el.remove(), 600);
}

function showJianghuResult(overlay, won, student, pet, investCoins, boss) {
  const scene = overlay.querySelector('#jhScene');
  let growthGain = 0;
  if (won) {
    // 胜利：投入的金币消失，获得三倍奖励（净赚两倍）
    var coinResult = investCoins * 3; // 获得三倍
    var coinDelta = coinResult - investCoins; // v123: Net change = +2x (not 3x)
    changeStudentCoins(student, coinDelta, '江湖胜利',
      `${student.name}携${pet.nickname || pet.name}闯荡江湖击败${boss.name}，投入${investCoins}金币`,
      0, pet.id, { jhType: 'win', bossName: boss.name, investCoins: investCoins });
    growthGain = 0; // 胜利不再获得成长值
  } else {
    // 失败：失去投入的金币，获得投入金币30%的成长值
    var coinDelta = -investCoins; // v123: Net change = -investCoins
    changeStudentCoins(student, coinDelta, '江湖失败',
      `${student.name}携${pet.nickname || pet.name}闯荡江湖不敌${boss.name}，投入${investCoins}金币`,
      0, pet.id, { jhType: 'lose', bossName: boss.name, investCoins: investCoins });
    growthGain = Math.floor(investCoins * 0.3); // 失败获得30%成长值
    pet.growth = (pet.growth || 0) + growthGain;
    _recalcPetLevel(pet);
  }

  // Mark student as having done jianghu today
  student.lastJianghuDate = new Date().toDateString();

  saveClassData();
  if(typeof renderHomePetGrid==='function') renderHomePetGrid();
  if(typeof renderClassTopThree==='function') renderClassTopThree();
  if(typeof renderPKPage==='function') renderPKPage();

  // ===== 战斗结果视觉特效 =====
  const petEl = overlay.querySelector('#jhBPet');
  const bossEl = overlay.querySelector('#jhBBoss');
  const loserEl = won ? bossEl : petEl;
  const winnerEl = won ? petEl : bossEl;

  // 失败方：碎裂特效
  if (loserEl) {
    jhApplyShatterEffect(loserEl);
  }
  // 胜利方：烟花特效 + 光芒
  if (winnerEl) {
    winnerEl.classList.add('jh-winner-glow');
    jhCreateFireworks(winnerEl);
  }

  const resultBox = document.createElement('div');
  resultBox.className = 'jh-result-box';
  const rewardDetail = won
    ? `🎉 获得 ${coinResult} 金币（投入${investCoins}消失，赢得${coinResult}）`
    : `💔 失去 ${investCoins} 金币`;
  const growthDetail = won
    ? ''
    : `&nbsp;·&nbsp;📈 成长值 +${growthGain}`;
  resultBox.innerHTML = `
    <div class="jh-result-text ${won ? 'jh-win' : 'jh-lose'}">${won ? '大获全胜' : '败走麦城'}</div>
    <div class="jh-result-sub">${won ? `击败 ${esc(boss.name)}，威震武林` : `不敌 ${esc(boss.name)}，来日再战`}</div>
    <div class="jh-result-detail">
      ${rewardDetail}${growthDetail}
    </div>
  `;
  scene.appendChild(resultBox);
  if(won) playJHVictorySound(); else playJHDefeatSound();

  // Show exit button (now on document.body)
  const exitBtn = document.getElementById('jhExitBtn');
  if (exitBtn) exitBtn.classList.add('jh-visible');

  // Also add a clickable exit button directly inside the result box (fallback)
  const resultExitBtn = document.createElement('button');
  resultExitBtn.textContent = '退出';
  resultExitBtn.style.cssText = 'margin-top:30px;padding:14px 40px;font-size:18px;font-weight:700;color:#c9a84c;background:rgba(139,26,26,0.9);border:1px solid rgba(201,168,76,0.5);border-radius:24px;cursor:pointer;pointer-events:auto;letter-spacing:2px;transition:all 0.3s;font-family:"Ma Shan Zheng",cursive;';
  resultExitBtn.onclick = function() { closeJianghuGame(); };
  resultExitBtn.onmouseover = function() { this.style.background = 'rgba(139,26,26,1)'; this.style.borderColor = '#c9a84c'; };
  resultExitBtn.onmouseout = function() { this.style.background = 'rgba(139,26,26,0.9)'; this.style.borderColor = 'rgba(201,168,76,0.5)'; };
  resultBox.appendChild(resultExitBtn);
  // Make result box accept pointer events for the button
  resultBox.style.pointerEvents = 'auto';

  // Auto-cleanup shatter fragments after 5 seconds so they don't block UI
  setTimeout(() => {
    const loserEl = won ? bossEl : petEl;
    if (loserEl) {
      loserEl.querySelectorAll('.jh-torn-piece-stay, .jh-torn-dust-stay').forEach(el => el.remove());
    }
  }, 5000);

  // Petals
  jhCreatePetals(won ? 'gold' : 'red');
}

// ===== 失败方照片撕碎特效（碎片停留空中不消失） =====
function jhApplyShatterEffect(el) {
  el.classList.add('jh-shatter-host');

  // 获取图片源
  const origImg = el.querySelector('img');
  const origSvg = el.querySelector('svg');
  let imgSrc = '';
  if (origImg) {
    imgSrc = origImg.src || origImg.getAttribute('src') || '';
  }

  // 如果是SVG(boss)，先转成图片再撕碎；如果没有图片也做降级处理
  if (!imgSrc && origSvg) {
    // 对SVG boss用序列化方式获取data URL
    const svgData = new XMLSerializer().serializeToString(origSvg);
    imgSrc = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgData);
  }
  if (!imgSrc) return;

  // 定义不规则碎片 clip-path（模拟撕碎的多边形区域）+ 飞散方向
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

  // 延迟后生成碎片（让裂纹先出现）
  setTimeout(() => {
    tornPieces.forEach((piece, i) => {
      const wrapper = document.createElement('div');
      wrapper.className = 'jh-torn-piece-stay'; // 使用停留空中版
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
      wrapper.style.setProperty('--torn-dur', (1.4 + Math.random() * 0.6) + 's');
      wrapper.style.setProperty('--torn-delay', (i * 0.04) + 's');

      el.appendChild(wrapper);
    });

    // 碎屑粉尘（停留空中版）
    for (let i = 0; i < 20; i++) {
      const dust = document.createElement('div');
      dust.className = 'jh-torn-dust-stay'; // 使用停留空中版
      const size = 2 + Math.random() * 5;
      dust.style.width = size + 'px';
      dust.style.height = size + 'px';
      dust.style.left = (20 + Math.random() * 60) + '%';
      dust.style.top = (20 + Math.random() * 60) + '%';
      dust.style.background = `rgba(${200+Math.random()*55},${180+Math.random()*50},${150+Math.random()*50},0.7)`;
      const ang = Math.random() * Math.PI * 2;
      const dist = 40 + Math.random() * 80;
      dust.style.setProperty('--dx', Math.cos(ang) * dist + 'px');
      dust.style.setProperty('--dy', Math.sin(ang) * dist + 'px');
      dust.style.setProperty('--ddur', (1 + Math.random() * 1.2) + 's');
      dust.style.setProperty('--ddelay', (Math.random() * 0.3) + 's');
      el.appendChild(dust);
    }
  }, 300);
}

// ===== 胜利方烟花特效 =====
function jhCreateFireworks(el) {
  const container = document.createElement('div');
  container.className = 'jh-fireworks-container';
  el.appendChild(container);

  const fwColors = [
    ['#FFD700','#FFA500','#FF6347','#FFE066'],
    ['#FF69B4','#FF1493','#FFB6C1','#FF85A2'],
    ['#00BFFF','#1E90FF','#87CEEB','#ADD8E6'],
    ['#7FFF00','#ADFF2F','#98FB98','#00FA9A'],
    ['#EE82EE','#DA70D6','#BA55D3','#9370DB'],
    ['#FF4500','#FF6347','#FF7F50','#FFA07A'],
  ];

  function launchFirework(delay) {
    setTimeout(() => {
      const palette = fwColors[Math.floor(Math.random() * fwColors.length)];
      const cx = 15 + Math.random() * 70;
      const cy = 5 + Math.random() * 35;

      // 上升拖尾
      const trail = document.createElement('div');
      trail.className = 'jh-fw-trail';
      trail.style.left = cx + '%';
      trail.style.bottom = '60%';
      trail.style.background = `linear-gradient(to top, transparent, ${palette[0]})`;
      trail.style.height = '0';
      trail.style.setProperty('--th', (40 + Math.random() * 50) + 'px');
      trail.style.setProperty('--ttop', (cy + 30) + '%');
      trail.style.setProperty('--tdur', '0.5s');
      trail.style.setProperty('--tdelay', '0s');
      container.appendChild(trail);
      setTimeout(() => trail.remove(), 1200);

      // 爆炸粒子
      const particleCount = 22 + Math.floor(Math.random() * 14);
      for (let i = 0; i < particleCount; i++) {
        const p = document.createElement('div');
        p.className = 'jh-fw-particle';
        const angle = (Math.PI * 2 * i) / particleCount + (Math.random() - 0.5) * 0.3;
        const dist = 35 + Math.random() * 55;
        p.style.left = cx + '%';
        p.style.top = cy + '%';
        p.style.width = (2 + Math.random() * 3) + 'px';
        p.style.height = p.style.width;
        p.style.background = palette[Math.floor(Math.random() * palette.length)];
        p.style.boxShadow = `0 0 ${3 + Math.random() * 4}px ${palette[0]}`;
        p.style.setProperty('--fx', Math.cos(angle) * dist + 'px');
        p.style.setProperty('--fy', Math.sin(angle) * dist + 'px');
        p.style.setProperty('--dur', (0.8 + Math.random() * 0.6) + 's');
        p.style.setProperty('--delay', (0.4 + Math.random() * 0.15) + 's');
        container.appendChild(p);
        setTimeout(() => p.remove(), 2500);
      }

      // 扩散光环
      const ring = document.createElement('div');
      ring.className = 'jh-fw-ring';
      const ringSize = 50 + Math.random() * 40;
      ring.style.left = `calc(${cx}% - ${ringSize/2}px)`;
      ring.style.top = `calc(${cy}% - ${ringSize/2}px)`;
      ring.style.width = ringSize + 'px';
      ring.style.height = ringSize + 'px';
      ring.style.borderColor = palette[0];
      ring.style.setProperty('--rdelay', '0.45s');
      container.appendChild(ring);
      setTimeout(() => ring.remove(), 2000);

    }, delay);
  }

  // 连续发射多波烟花
  const launchTimes = [0, 300, 700, 1100, 1600, 2100, 2700, 3300, 3900];
  launchTimes.forEach(t => launchFirework(t));

  // 清理容器
  setTimeout(() => container.remove(), 6000);
}

function jhCreatePetals(color) {
  for (let i = 0; i < 15; i++) {
    const p = document.createElement('div');
    p.className = 'jh-petal';
    p.style.left = Math.random() * 100 + '%';
    p.style.top = '-15px';
    p.style.width = '7px';
    p.style.height = '7px';
    p.style.borderRadius = Math.random() > 0.5 ? '50% 0' : '0 50%';
    p.style.background = color === 'gold'
      ? `rgba(201,168,76,${0.3 + Math.random() * 0.4})`
      : `rgba(204,34,51,${0.3 + Math.random() * 0.4})`;
    p.style.setProperty('--dx', (Math.random() - 0.5) * 180 + 'px');
    p.style.animationDuration = (3 + Math.random() * 3) + 's';
    p.style.animationDelay = Math.random() * 2.5 + 's';
    document.body.appendChild(p);
    p.classList.add('jh-fall');
    setTimeout(() => p.remove(), 7000);
  }
}

function closeJianghuGame() {
  const overlay = document.getElementById('jhGameOverlay');
  if (overlay) {
    overlay.style.transition = 'opacity 0.5s ease';
    overlay.style.opacity = '0';
    setTimeout(() => overlay.remove(), 500);
  }
  // Remove exit button from document.body
  const exitBtn = document.getElementById('jhExitBtn');
  if (exitBtn) exitBtn.remove();
  // Clean up any remaining transition overlays
  document.querySelectorAll('div[style*="z-index: 100001"], div[style*="z-index:100001"]').forEach(el => el.remove());
  jhSelectedStudentId = null;
  renderJianghuPage();
  if(typeof renderPKPage==='function') renderPKPage();
}
