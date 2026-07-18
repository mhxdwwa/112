// ========== CDN 图片加速 ==========
// 阿里云 CDN 域名（配好后填入，留空则使用本地 images/）
// 示例: 'https://cdn.yourdomain.com/images'
const IMG_CDN_BASE = 'https://mhxdwwa.oss-cn-shenzhen.aliyuncs.com/images';
function _img(path) { return (IMG_CDN_BASE || 'images') + '/' + path; }

// ========== 安全工具函数 ==========
function escapeHTML(str) {
  if (str == null) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
}
const esc = escapeHTML; // 快捷别名
// 转义 HTML 属性值（用于 onclick、value、src 等属性上下文）
function escapeAttr(str) {
  if (str == null) return '';
  return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
const escAttr = escapeAttr;
// 转义 JavaScript 字符串值（用于 onclick="func('${val}')" 等内联 JS 上下文）
function escapeJS(str) {
  if (str == null) return '';
  return String(str).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/</g, '\\x3c').replace(/>/g, '\\x3e');
}
const escJS = escapeJS;

// ========== 渲染批处理系统 — 合并多次同步渲染为单次 rAF，解决点击延迟 ==========
let _renderBatchPending = false;
let _renderBatchFlags = 0;
const _RF_GRID = 1, _RF_TOP3 = 2, _RF_PK = 4, _RF_CLASSLIST = 8, _RF_JH = 16;
function scheduleRender(flags) {
  _renderBatchFlags |= flags;
  if (_renderBatchPending) return;
  _renderBatchPending = true;
  requestAnimationFrame(() => {
    _renderBatchPending = false;
    const f = _renderBatchFlags;
    _renderBatchFlags = 0;
    if (f & _RF_GRID) renderHomePetGrid();
    if (f & _RF_TOP3) renderClassTopThree();
    if (f & _RF_PK) renderPKPage();
    if (f & _RF_CLASSLIST) renderClassList();
    if (f & _RF_JH) renderJianghuPage();
  });
}
function scheduleAllRenders() {
  // 始终渲染当前可见页面 + 成长榜（数据共享）
  scheduleRender(_RF_GRID | _RF_TOP3);
  // 只在页面可见时渲染 PK 和江湖行页面
  var pkPage = document.getElementById('pk-page');
  var jhPage = document.getElementById('jianghu-page');
  if (pkPage && pkPage.classList.contains('active')) scheduleRender(_RF_PK);
  if (jhPage && jhPage.classList.contains('active')) scheduleRender(_RF_JH);
}

// ========== 性能优化：低端设备检测与降级 ==========
(function(){
  var isLowEnd = false;
  // 检测低端设备：内存少、CPU核心少、或触屏旧设备
  if(navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) isLowEnd = true;
  if(navigator.deviceMemory && navigator.deviceMemory <= 4) isLowEnd = true;
  // 帧率检测：如果前30帧平均低于45fps，启用降级
  var _perfFrames = [], _perfStart = 0, _perfChecked = false;
  function _perfCheck(ts){
    if(_perfChecked) return;
    if(!_perfStart){ _perfStart = ts; requestAnimationFrame(_perfCheck); return; }
    _perfFrames.push(ts);
    if(_perfFrames.length < 30){ requestAnimationFrame(_perfCheck); return; }
    _perfChecked = true;
    var elapsed = _perfFrames[_perfFrames.length-1] - _perfFrames[0];
    var avgFps = (_perfFrames.length - 1) / (elapsed / 1000);
    if(avgFps < 30) isLowEnd = true;
    if(isLowEnd) document.documentElement.classList.add('low-end-device');
  }
  requestAnimationFrame(_perfCheck);
  // 标记已知低端设备
  if(isLowEnd) document.documentElement.classList.add('low-end-device');
  // 低端设备降级CSS已移至静态<style>中，无需运行时注入
})();

// ========== 首次交互预热 AudioContext，避免首次点击音效延迟 ==========
function _prewarmAudio() {
  if(!audioCtx) initAudio();
  if(audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  document.removeEventListener('click', _prewarmAudio);
  document.removeEventListener('touchstart', _prewarmAudio);
  document.removeEventListener('keydown', _prewarmAudio);
}
document.addEventListener('click', _prewarmAudio, {once:true, passive:true});
document.addEventListener('touchstart', _prewarmAudio, {once:true, passive:true});
document.addEventListener('keydown', _prewarmAudio, {once:true, passive:true});

// ========== 爱心特效核心函数 ==========
let activeHeartInterval = null;
let activeHeartContainer = null;
function stopAllHeartEmitters() { if(activeHeartInterval) { clearInterval(activeHeartInterval); activeHeartInterval = null; activeHeartContainer = null; } }
function isPetAlive(container) { if (container.querySelector('.dead-pet-overlay')) return false; const card = container.closest('.home-pet-card, .modal-pet-img, .rank-avatar-small'); if (card && card.querySelector('.dead-pet-overlay')) return false; return true; }
function getMouthPosition(container) { let targetImg = container.querySelector('img'); if (!targetImg) { const fallbackRect = container.getBoundingClientRect(); if (fallbackRect.width > 0) return { x: fallbackRect.left + fallbackRect.width * 0.5, y: fallbackRect.top + fallbackRect.height * 0.7 }; return null; } const rect = targetImg.getBoundingClientRect(); if (rect.width === 0 || rect.height === 0) return null; const x = rect.left + rect.width * 0.5; const y = rect.top + rect.height * 0.7; return { x, y }; }
function emitHeart(container) { if (!container.isConnected) { stopAllHeartEmitters(); return false; } if (!isPetAlive(container)) return false; const pos = getMouthPosition(container); if (!pos) return false; const heart = document.createElement('div'); heart.className = 'heart-float'; heart.innerHTML = '❤️'; heart.style.left = pos.x + 'px'; heart.style.top = pos.y + 'px'; heart.style.fontSize = (18 + Math.random() * 8) + 'px'; document.body.appendChild(heart); heart.addEventListener('animationend', () => heart.remove()); return true; }
function startHeartForContainer(container) { if (!container) return; stopAllHeartEmitters(); activeHeartContainer = container; var _isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches; var heartDelay = (_isReducedMotion || document.documentElement.classList.contains('low-end-device')) ? 1200 : 580; activeHeartInterval = setInterval(() => { if (!activeHeartContainer || !activeHeartContainer.isConnected) { stopAllHeartEmitters(); return; } emitHeart(activeHeartContainer); }, heartDelay); }
function findPetContainerByStudentId(studentId) { const modalImg = document.querySelector('#modalContainer .modal-pet-img'); if (modalImg && modalImg.isConnected) return modalImg; const cards = document.querySelectorAll('.home-pet-card'); for (let card of cards) { const onclickAttr = card.getAttribute('onclick'); if (onclickAttr && onclickAttr.includes(`openStudentModal('${studentId}')`)) { const topDiv = card.querySelector('.home-pet-top'); if (topDiv) return topDiv; } } return null; }
function startHeartForCurrentPet(studentId) { if (!studentId) { stopAllHeartEmitters(); return; } const cur = classesData?.find(c=>c.id===currentClassId); if(!cur) return; const student = cur.students.find(s=>s.id.toString()===studentId.toString()); if(!student) return; const activePet = getActivePet(student); if(!activePet || activePet.isDead) { stopAllHeartEmitters(); return; } const targetContainer = findPetContainerByStudentId(studentId); if(targetContainer) startHeartForContainer(targetContainer); else stopAllHeartEmitters(); }

// ========== 原有核心逻辑（宠物系统、班级管理等）==========
let audioCtx = null;
let masterSfxGain = null; // 音效主增益节点，受音量滑块控制
let sfxVol = 0.4; // 音效音量（默认40%）
let sfxMuted = false; // 音效静音状态
function initAudio(){
  if(!audioCtx){
    audioCtx=new (window.AudioContext||window.webkitAudioContext)();
    masterSfxGain=audioCtx.createGain();
    masterSfxGain.gain.value=sfxMuted?0:sfxVol;
    masterSfxGain.connect(audioCtx.destination);
  }
}
// 更新音效音量（供音量滑块调用）
window.updateSfxVolume=function(vol, muted){
  sfxVol=vol/100;
  sfxMuted=muted;
  if(masterSfxGain){
    masterSfxGain.gain.value=sfxMuted?0:sfxVol;
  }
}
function playClickSound(){initAudio();const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.connect(g);g.connect(masterSfxGain);o.frequency.value=800;o.type='sine';g.gain.setValueAtTime(0.3,audioCtx.currentTime);g.gain.exponentialRampToValueAtTime(0.01,audioCtx.currentTime+0.1);o.start(audioCtx.currentTime);o.stop(audioCtx.currentTime+0.1);}
function playLaserSound(){initAudio();const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.connect(g);g.connect(masterSfxGain);o.frequency.value=1200;o.type='sawtooth';g.gain.setValueAtTime(0.15,audioCtx.currentTime);g.gain.exponentialRampToValueAtTime(0.01,audioCtx.currentTime+0.2);o.start(audioCtx.currentTime);o.stop(audioCtx.currentTime+0.2);}
function playVictorySound(){initAudio();[880, 1046.5, 1318.5].forEach((f,i)=>{const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.connect(g);g.connect(masterSfxGain);o.frequency.value=f;o.type='sine';g.gain.setValueAtTime(0.2,audioCtx.currentTime+i*0.2);g.gain.exponentialRampToValueAtTime(0.01,audioCtx.currentTime+i*0.2+0.5);o.start(audioCtx.currentTime+i*0.2);o.stop(audioCtx.currentTime+i*0.2+0.5);});}
function playUpgradeSound(){initAudio();const t=audioCtx.currentTime;
/* Phase 1: Tension rumble (0-1.3s) */
const rumble=audioCtx.createOscillator(),rGain=audioCtx.createGain();rumble.connect(rGain);rGain.connect(masterSfxGain);rumble.type='sawtooth';rumble.frequency.setValueAtTime(60,t);rumble.frequency.linearRampToValueAtTime(200,t+1.0);rGain.gain.setValueAtTime(0.08,t);rGain.gain.linearRampToValueAtTime(0.25,t+1.0);rGain.gain.linearRampToValueAtTime(0,t+1.4);rumble.start(t);rumble.stop(t+1.5);
/* Rising whoosh */
const whoosh=audioCtx.createOscillator(),wGain=audioCtx.createGain(),wFilter=audioCtx.createBiquadFilter();whoosh.connect(wFilter);wFilter.connect(wGain);wGain.connect(masterSfxGain);whoosh.type='sawtooth';whoosh.frequency.setValueAtTime(200,t+0.3);whoosh.frequency.exponentialRampToValueAtTime(2000,t+1.3);wFilter.type='bandpass';wFilter.frequency.setValueAtTime(400,t+0.3);wFilter.frequency.exponentialRampToValueAtTime(3000,t+1.3);wFilter.Q.value=2;wGain.gain.setValueAtTime(0.01,t+0.3);wGain.gain.linearRampToValueAtTime(0.15,t+1.1);wGain.gain.linearRampToValueAtTime(0,t+1.4);whoosh.start(t+0.3);whoosh.stop(t+1.5);
/* Phase 2: Impact boom (1.3s) */
const boom=audioCtx.createOscillator(),bGain=audioCtx.createGain();boom.connect(bGain);bGain.connect(masterSfxGain);boom.type='sine';boom.frequency.setValueAtTime(80,t+1.3);boom.frequency.exponentialRampToValueAtTime(30,t+2.0);bGain.gain.setValueAtTime(0.5,t+1.3);bGain.gain.exponentialRampToValueAtTime(0.01,t+2.2);boom.start(t+1.3);boom.stop(t+2.3);
/* Noise burst for impact texture */
const bufSize=audioCtx.sampleRate*0.3,noiseBuffer=audioCtx.createBuffer(1,bufSize,audioCtx.sampleRate),noiseData=noiseBuffer.getChannelData(0);for(let i=0;i<bufSize;i++)noiseData[i]=(Math.random()*2-1);const noiseSrc=audioCtx.createBufferSource(),nGain=audioCtx.createGain(),nFilter=audioCtx.createBiquadFilter();noiseSrc.buffer=noiseBuffer;noiseSrc.connect(nFilter);nFilter.connect(nGain);nGain.connect(masterSfxGain);nFilter.type='highpass';nFilter.frequency.value=2000;nGain.gain.setValueAtTime(0.25,t+1.3);nGain.gain.exponentialRampToValueAtTime(0.01,t+1.6);noiseSrc.start(t+1.3);noiseSrc.stop(t+1.7);
/* Phase 3: Victory fanfare (1.5s+) */
const fanfare=[{f:523.25,d:0},{f:659.25,d:0.15},{f:783.99,d:0.3},{f:1046.50,d:0.5},{f:1318.51,d:0.7},{f:1567.98,d:0.85}];
fanfare.forEach(n=>{const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.connect(g);g.connect(masterSfxGain);o.type='sine';o.frequency.value=n.f;g.gain.setValueAtTime(0.3,t+1.5+n.d);g.gain.exponentialRampToValueAtTime(0.01,t+1.5+n.d+0.6);o.start(t+1.5+n.d);o.stop(t+1.5+n.d+0.7);
const h=audioCtx.createOscillator(),hg=audioCtx.createGain();h.connect(hg);hg.connect(masterSfxGain);h.type='triangle';h.frequency.value=n.f*2;hg.gain.setValueAtTime(0.08,t+1.5+n.d);hg.gain.exponentialRampToValueAtTime(0.01,t+1.5+n.d+0.4);h.start(t+1.5+n.d);h.stop(t+1.5+n.d+0.5);});
/* Sustained shimmer chord */
[523.25,659.25,783.99,1046.50].forEach(f=>{const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.connect(g);g.connect(masterSfxGain);o.type='sine';o.frequency.value=f;g.gain.setValueAtTime(0.06,t+2.4);g.gain.linearRampToValueAtTime(0.1,t+2.8);g.gain.exponentialRampToValueAtTime(0.001,t+4.5);o.start(t+2.4);o.stop(t+4.6);});
}
function playTransformChargeSound(){initAudio();const t=audioCtx.currentTime;
const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.connect(g);g.connect(masterSfxGain);o.type='sawtooth';o.frequency.setValueAtTime(100,t);o.frequency.exponentialRampToValueAtTime(800,t+1.2);g.gain.setValueAtTime(0.05,t);g.gain.linearRampToValueAtTime(0.2,t+1.0);g.gain.linearRampToValueAtTime(0,t+1.3);o.start(t);o.stop(t+1.4);
}
function showUpgradeEffect(petName, level, petConfigId, petNickname, oldLevel, studentName) {
  const cfg = PET_CONFIG[Object.keys(PET_CONFIG).find(k=>PET_CONFIG[k].id===petConfigId)];
  if(!cfg) return;
  if(!oldLevel) oldLevel = Math.max(1, level - 1);
  const container = document.getElementById('upgradeEffectContainer');
  const overlay = document.createElement('div');
  overlay.className = 'upgrade-overlay';
  const oldImgSrc = _img(`${petConfigId}/${oldLevel}.webp`);
  const newImgSrc = _img(`${petConfigId}/${level}.webp`);
  const oldStageName = cfg.stages[oldLevel-1]?.stageName || '宠物蛋';
  const newStageName = cfg.stages[level-1]?.stageName || '万物之神';
  /* Build light rays */
  let raysHtml = '';
  for(let i=0;i<16;i++) raysHtml += `<div class="upgrade-ray" style="transform:rotate(${i*22.5}deg)"></div>`;
  overlay.innerHTML = `
    <div class="upgrade-flash"></div>
    <div class="upgrade-box">
      <div class="upgrade-energy-ring"></div>
      <div class="upgrade-energy-ring"></div>
      <div class="upgrade-energy-ring"></div>
      <div class="upgrade-old-pet">
        <img src="${oldImgSrc}" alt="${petName}" onerror="this.onerror=null; this.parentNode.innerHTML='<span style=\\'font-size:100px;\\'>${cfg.emoji}</span>';">
      </div>
      <div class="upgrade-arrow">⬇</div>
      <div class="upgrade-new-pet" style="display:none;">
        <img src="${newImgSrc}" alt="${petName}" onerror="this.onerror=null; this.parentNode.innerHTML='<span style=\\'font-size:140px;\\'>${cfg.emoji}</span>';">
      </div>
      <div class="upgrade-rays" style="display:none;">${raysHtml}</div>
      <div class="upgrade-title">✦ 进化成功 ✦</div>
      <div class="upgrade-student-name" style="font-size:20px;color:#e8637a;font-weight:700;margin-bottom:4px;text-shadow:0 0 10px rgba(232,99,122,0.3);">${studentName ? '🎊 恭喜 '+esc(studentName)+' 同学 🎊' : ''}</div>
      <div class="upgrade-subtitle">${esc(petNickname)} 晋升为<br><strong>${newStageName}</strong></div>
      <div class="upgrade-stage-badge">${oldStageName} → ${newStageName}</div>
      <div class="upgrade-dismiss">点击任意处关闭</div>
    </div>`;
  container.appendChild(overlay);

  /* Phase 1: Show old pet + charge sound */
  playTransformChargeSound();
  createSparklesAround(overlay, 15, 'warm');

  /* Phase 2: Transform after 0.8s */
  setTimeout(() => {
    const box = overlay.querySelector('.upgrade-box');
    if(!box) return;
    box.classList.add('upgrade-transform-active');
    /* Screen shake */
    overlay.classList.add('upgrade-screen-shake');
    setTimeout(()=>overlay.classList.remove('upgrade-screen-shake'), 500);
  }, 800);

  /* Phase 3: Flash + reveal new pet at 2.1s */
  setTimeout(() => {
    const box = overlay.querySelector('.upgrade-box');
    if(!box) return;
    const oldPet = box.querySelector('.upgrade-old-pet');
    const arrow = box.querySelector('.upgrade-arrow');
    if(oldPet) oldPet.style.display='none';
    if(arrow) arrow.style.display='none';
    const newPet = box.querySelector('.upgrade-new-pet');
    const rays = box.querySelector('.upgrade-rays');
    if(newPet) newPet.style.display='flex';
    if(rays) rays.style.display='block';
    box.classList.remove('upgrade-transform-active');
    box.classList.add('upgrade-reveal');
    /* Play epic sound */
    playUpgradeSound();
    /* Screen shake on reveal */
    overlay.classList.add('upgrade-screen-shake');
    setTimeout(()=>overlay.classList.remove('upgrade-screen-shake'), 500);
    /* Burst sparkles */
    for(let i=0;i<8;i++) setTimeout(()=>createSparklesAround(overlay, 12, 'gold'), i*100);
    /* Fireworks */
    for(let i=0;i<30;i++) setTimeout(()=>createFirework(overlay), i*80);
  }, 2100);

  /* Close handler */
  const closeHandler = () => { if(overlay.parentNode) overlay.remove(); };
  overlay.addEventListener('click', (e) => { if(e.target===overlay || overlay.querySelector('.upgrade-reveal')) closeHandler(); });
  setTimeout(closeHandler, 8000);
}

function createSparklesAround(parent, count, palette) {
  const colors = palette==='gold' ? ['#ffd700','#ffaa00','#fff5c0','#ffcc33','#ffe066'] : ['#ffb088','#ff8866','#ffc090','#ffd700','#fff'];
  for(let i=0;i<count;i++){
    const s=document.createElement('div'); s.className='upgrade-sparkle';
    const size=Math.random()*8+3; const angle=Math.random()*Math.PI*2; const dist=120+Math.random()*200;
    const cx=parent.offsetWidth/2||window.innerWidth/2; const cy=parent.offsetHeight/2||window.innerHeight/2;
    s.style.cssText=`left:${cx}px;top:${cy}px;width:${size}px;height:${size}px;background:${colors[Math.floor(Math.random()*colors.length)]};box-shadow:0 0 ${size*2}px ${colors[Math.floor(Math.random()*colors.length)]};--sx:${Math.cos(angle)*dist}px;--sy:${Math.sin(angle)*dist}px;animation:sparkleFloat ${0.6+Math.random()*0.8}s ease-out forwards;`;
    parent.appendChild(s); setTimeout(()=>s.remove(), 1500);
  }
}

function createFirework(parent){
  const colors=['#ffd700','#ffaa44','#ff6b6b','#4ade80','#3a86ff','#f472b6','#fff','#ff44aa','#44ffaa'];
  const cx=Math.random()*window.innerWidth; const cy=Math.random()*window.innerHeight*0.6+window.innerHeight*0.1;
  for(let i=0;i<12;i++){
    const p=document.createElement('div'); p.className='firework';
    const angle=(i/12)*Math.PI*2; const dist=30+Math.random()*50;
    const dx=Math.cos(angle)*dist; const dy=Math.sin(angle)*dist;
    const color=colors[Math.floor(Math.random()*colors.length)];
    const size=3+Math.random()*5;
    p.style.cssText=`left:${cx}px;top:${cy}px;width:${size}px;height:${size}px;background:${color};box-shadow:0 0 ${size+4}px ${color};position:absolute;border-radius:50%;transition:all 0.6s cubic-bezier(0,.7,.3,1);opacity:1;`;
    parent.appendChild(p);
    requestAnimationFrame(()=>{p.style.transform=`translate(${dx}px,${dy}px)`;p.style.opacity='0';});
    setTimeout(()=>p.remove(), 700);
  }
}
function generateStageCurve() { return [{stage:1,growthRequired:0,stageName:"神秘宠物蛋"},{stage:2,growthRequired:30,stageName:"可爱幼体"},{stage:3,growthRequired:90,stageName:"成长伙伴"},{stage:4,growthRequired:210,stageName:"成熟伙伴"},{stage:5,growthRequired:410,stageName:"完美精灵"},{stage:6,growthRequired:740,stageName:"传说神兽"},{stage:7,growthRequired:1200,stageName:"远古守护"},{stage:8,growthRequired:1800,stageName:"星辰之主"},{stage:9,growthRequired:2600,stageName:"万物之神"}]; }
// 动态宠物配置：支持 images 目录下任意数字文件夹作为宠物
// 基础配置保留原有55只作为默认/回退，但可通过动态加载扩展
const PET_CONFIG_BASE = { "雪貂":{id:1,emoji:"🐕"},"六角恐龙":{id:2,emoji:"🐺"},"吉祥神兽":{id:3,emoji:"🦮"},"海马":{id:4,emoji:"🐶"},"荷兰兔":{id:5,emoji:"🐩"},"胖仓鼠":{id:6,emoji:"🐕‍🦺"},"小老鼠":{id:7,emoji:"🐕"},"七彩貂":{id:8,emoji:"🦮"},"比尔鸭":{id:9,emoji:"🐶"},"大白兔":{id:10,emoji:"🐕"},"北美浣熊":{id:11,emoji:"🐱"},"萌萌羊":{id:12,emoji:"🐈"},"泰迪":{id:13,emoji:"🐈"},"花斑虎":{id:14,emoji:"🐱"},"送财龙":{id:15,emoji:"🐈"},"青云龙":{id:16,emoji:"🐠"},"苍狮":{id:17,emoji:"🐟"},"七彩鸟":{id:18,emoji:"🦜"},"考拉":{id:19,emoji:"🐹"},"萌蝙蝠":{id:20,emoji:"🐰"},"淡火狐":{id:21,emoji:"🐢"},"长毛汪":{id:22,emoji:"🦔"},"呆呆熊":{id:23,emoji:"🐭"},"熊猫大侠":{id:24,emoji:"🐿️"},"荷兰猪":{id:25,emoji:"🐹"},"白白东":{id:26,emoji:"🦄"},"大神龟":{id:27,emoji:"🔥"},"不萌鼠":{id:28,emoji:"🐲"},"柯基犬":{id:29,emoji:"🐧"},"咩咩咩":{id:30,emoji:"🦉"},"白眉汪":{id:31,emoji:"🦅"},"哮天犬":{id:32,emoji:"🦚"},"芦丁鸡":{id:33,emoji:"🕊️"},"大萌星":{id:34,emoji:"🐤"},"小白":{id:35,emoji:"🐬"},"多萌肉":{id:36,emoji:"🐙"},"踏天马":{id:37,emoji:"🦈"},"刺猬":{id:38,emoji:"🐋"},"黑白犬":{id:39,emoji:"🦑"},"羊驼":{id:40,emoji:"🪼"},"黄牛":{id:41,emoji:"🦋"},"美杜莎":{id:42,emoji:"🐞"},"六耳猕狗":{id:43,emoji:"🐝"},"猫猫虎":{id:44,emoji:"🐌"},"黑白猪":{id:45,emoji:"🕷️"},"非洲象":{id:46,emoji:"🐜"},"幸运猫":{id:47,emoji:"🐻"},"孔雀":{id:48,emoji:"🐼"},"蜥蜴":{id:49,emoji:"🐨"},"恐龙":{id:50,emoji:"🦁"},"梅花鹿":{id:51,emoji:"🐯"},"火凤凰":{id:52,emoji:"🐘"},"寄居蟹":{id:53,emoji:"🦒"},"九尾天狐":{id:54,emoji:"🦓"},"果冻蝾螈":{id:55,emoji:"🦛"} };
const PET_CONFIG = {};
Object.keys(PET_CONFIG_BASE).forEach(name=>{ PET_CONFIG[name] = {...PET_CONFIG_BASE[name], stages: generateStageCurve(), adoptCoins:0}; });

// ========== 全自动新宠物发现机制 ==========
// 无需手动配置！系统会自动尝试加载 images/数字/1.webp
// 只要文件夹存在，就会自动以 "宠物+数字" 命名并注册，数量不限！
function autoDiscoverPets() {
  let startId = 56; // 从 56 开始探测（1-55 已内置）
  let consecutiveFailures = 0;
  const maxFailures = 3; // 连续 3 个找不到图片就停止探测
  const maxCheck = 100; // 绝对上限（实际只需到 58 左右）

  function checkNext(id) {
    if (id > maxCheck || consecutiveFailures >= maxFailures) {
      const newCount = Object.keys(PET_CONFIG).length - 55;
      if (newCount > 0) console.log(`[宠物系统] 自动探测完成，成功发现并注册了 ${newCount} 只新宠物！`);
      return;
    }

    const img = new Image();
    img.onload = function() {
      // 成功加载！自动注册该数字宠物
      const petName = `宠物${id}`;
      PET_CONFIG[petName] = {
        id: id,
        emoji: '🐾',
        stages: generateStageCurve(),
        adoptCoins: 0
      };
      console.log(`[宠物系统] 自动发现新宠物: ${petName} (ID: ${id})`);
      consecutiveFailures = 0; // 找到后重置失败计数
      checkNext(id + 1); // 继续探测下一个
    };
    img.onerror = function() {
      // 找不到图片，失败计数+1，继续探测下一个
      consecutiveFailures++;
      checkNext(id + 1);
    };
    // 尝试加载该宠物的 1 级图片
    img.src = _img(`${id}/1.webp`);
  }

  // 启动自动探测
  checkNext(startId);
}

// 页面加载时立即开始自动探测
autoDiscoverPets();
/* ========== U盘/本地文件存储系统（变量提前声明） ========== */
let _dirHandle = null;
let _dataDirHandle = null;
let _fileSaveTimer = null;
let _isSaving = false;
let _pendingSave = false;
/* ========== 桌面 EXE 模式变量（必须在 scheduleFileSave 之前声明） ========== */
let _desktopMode = false;
let _desktopSaveTimer = null;

// 安全读取 localStorage，防止数据损坏导致白屏
let classesData = [], currentClassId = null, selectedPetName = null, currentModalStudentId = null;
try { classesData = JSON.parse(localStorage.getItem('classPetData')) || []; } catch(e) { console.warn('classPetData读取失败，已重置:', e.message); localStorage.removeItem('classPetData'); }
let deletedClasses = [];
try { deletedClasses = JSON.parse(localStorage.getItem('deletedClasses')) || []; } catch(e) { console.warn('deletedClasses读取失败，已重置:', e.message); localStorage.removeItem('deletedClasses'); }
let customActions = [];
try { customActions = JSON.parse(localStorage.getItem('customActions')) || []; } catch(e) { console.warn('customActions读取失败，已重置:', e.message); localStorage.removeItem('customActions'); }
const neededPresets = [{id: 'sys_reward_1', name: '完成作业', coins: 10},{id: 'sys_reward_2', name: '课堂发言', coins: 10}];
neededPresets.forEach(preset => { if (!customActions.some(a => a.id === preset.id)) customActions.push(preset); });
function safeLSSave(key, data){ try{ localStorage.setItem(key, JSON.stringify(data)); }catch(e){ console.warn('localStorage写入失败('+key+'):', e.message); try{ localStorage.removeItem('logArchives'); localStorage.removeItem('operationLogs'); localStorage.setItem(key, JSON.stringify(data)); }catch(e2){ console.warn('localStorage清理后仍失败，跳过本地缓存'); } } }
// ===== 安全整数ID生成器 =====
// 生成负整数ID，明确区分本地临时ID与Supabase自增ID（正整数）
// 负数ID永远不会被误认为有效的Supabase ID
var _idCounter = 0;
function _genLocalId(){ return -(Date.now() * 1000 + ((_idCounter = (_idCounter + 1) % 1000))); }
function saveCustomActions(){safeLSSave('customActions', customActions); scheduleFileSave();}
saveCustomActions();
// v16: SINGLE SOURCE OF TRUTH — operationLogs lives on window only.
// All reads/writes go through window.operationLogs to eliminate cross-script scope bugs.
window.operationLogs = [];
try { window.operationLogs = JSON.parse(localStorage.getItem('operationLogs')) || []; } catch(e) { console.warn('operationLogs读取失败，已重置:', e.message); localStorage.removeItem('operationLogs'); }
// v16: Helper to get operation logs — always reads from window.operationLogs
function getOpLogs() { return window.operationLogs || []; }
// v16: Helper to sync the alias after any reassignment (kept for backward compat)
function _syncOpLogsAlias() { /* no-op: we always use window.operationLogs now */ }
// v16: Helper to push window.operationLogs after local reassignment (kept for backward compat)
function _pushOpLogsToWindow() { /* no-op: we always use window.operationLogs now */ }
let logArchives = {};
try { logArchives = JSON.parse(localStorage.getItem('logArchives')) || {}; } catch(e) { console.warn('logArchives读取失败，已重置:', e.message); localStorage.removeItem('logArchives'); }
function _getLogMonth(log){return log.timestamp?log.timestamp.slice(0,7):'';}
function _getCurrentMonth(){return new Date().toISOString().slice(0,7);}
function archiveOldLogs(){
  const curMonth=_getCurrentMonth();
  const keepLogs=[];
  let changed=false;
  // v15: Use window.operationLogs for cross-script consistency
  var logs = getOpLogs();
  logs.forEach(log=>{
    const m=_getLogMonth(log);
    if(m && m<curMonth){
      if(!logArchives[m]) logArchives[m]=[];
      logArchives[m].push(log);
      changed=true;
    } else {
      keepLogs.push(log);
    }
  });
  if(changed){
    window.operationLogs=keepLogs;
    safeLSSave('operationLogs', window.operationLogs);
    safeLSSave('logArchives', logArchives);
  }
}
// v25: Removed archiveOldLogs() from init — it was archiving logs before Supabase
// data was loaded, causing data loss on page refresh. The function is kept for
// backward compatibility but should not be called automatically.
// v13: Debounced real-time sync — trigger immediate sync after any data change
let _syncDebounceTimer = null;
function triggerRealtimeSync() {
  if (typeof _syncToSupabase !== 'function') return;
  if (_syncDebounceTimer) clearTimeout(_syncDebounceTimer);
  _syncDebounceTimer = setTimeout(function() {
    _syncDebounceTimer = null;
    _syncToSupabase();
  }, 50); // v15: 50ms debounce — near-instant real-time sync
}
// v25: Removed archiveOldLogs() from save flow — it was silently moving logs
// out of window.operationLogs into logArchives on every save, causing the visible
// log count to decrease. Archiving is no longer needed since _loadOperationLogs()
// loads ALL logs from Supabase and getAllLogsForMonth() includes archived logs.
function saveLogs(){safeLSSave('operationLogs', window.operationLogs); scheduleFileSave(); triggerRealtimeSync();}
function saveArchives(){safeLSSave('logArchives', logArchives); scheduleFileSave();}
function getAllLogsForMonth(month){
  var logs = getOpLogs();
  var matched = logs.filter(function(l) { return _getLogMonth(l) === month; });
  // v25: Also include archived logs — archiveOldLogs() moves old logs to logArchives
  // but the history modal must still show them when the user selects that month
  if (logArchives && logArchives[month]) {
    matched = matched.concat(logArchives[month]);
    matched.sort(function(a, b) { return (b.timestamp || '').localeCompare(a.timestamp || ''); });
  }
  return matched;
}
function getAvailableMonths(){
  const months=new Set();
  var logs = getOpLogs();
  logs.forEach(l=>{const m=_getLogMonth(l);if(m)months.add(m);});
  Object.keys(logArchives).forEach(m=>months.add(m));
  return [...months].sort().reverse();
}
let _currentHistoryMonth = null;
let _historyFilterStudentId = null; // 历史操作筛选：选中的学生ID（null表示不筛选）
let _historyFilterEnabled = false;  // 历史操作筛选：是否启用筛选
const DATA_FOLDER_NAME = '数据';
const DATA_FILES = {
  classPetData: '班级宠物数据.json',
  customActions: '奖惩设置.json',
  operationLogs: '操作日志.json',
  logArchives: '操作日志归档.json',
  deletedClasses: '已删除班级.json'
};

/* --- IndexedDB 缓存文件夹句柄（同一台电脑下次打开免选文件夹） --- */
function openHandleDB(){
  return new Promise((resolve,reject)=>{
    const req = indexedDB.open('PetWorldHandles',1);
    req.onupgradeneeded = ()=>{ req.result.createObjectStore('handles'); };
    req.onsuccess = ()=> resolve(req.result);
    req.onerror = ()=> reject(req.error);
  });
}
async function saveDirHandle(handle){
  try{ const db=await openHandleDB(); const tx=db.transaction('handles','readwrite'); tx.objectStore('handles').put(handle,'dirHandle'); }catch(e){}
}
async function loadDirHandle(){
  try{ const db=await openHandleDB(); return new Promise((resolve)=>{ const tx=db.transaction('handles','readonly'); const req=tx.objectStore('handles').get('dirHandle'); req.onsuccess=()=>resolve(req.result||null); req.onerror=()=>resolve(null); }); }catch(e){ return null; }
}

function updateUSBStatus(connected) {
  const icon = document.getElementById('usbIcon');
  const text = document.getElementById('usbText');
  const btn = document.getElementById('usbConnectBtn');
  if (connected) {
    icon.textContent = '✅';
    text.textContent = '已授权保存';
    btn.style.background = 'linear-gradient(135deg, #a0ffb0, #70dd80)';
    btn.style.color = '#225522';
  } else {
    icon.textContent = '💾';
    text.textContent = '授权保存';
    btn.style.background = 'linear-gradient(135deg, #ffd6a0, #ffb870)';
    btn.style.color = '#553300';
  }
}

async function getOrCreateDataDir(parentDir) {
  try { return await parentDir.getDirectoryHandle(DATA_FOLDER_NAME, { create: true }); }
  catch(e) { console.error('创建数据文件夹失败:', e); return null; }
}

async function writeFileToDir(dirHandle, filename, data) {
  const fh = await dirHandle.getFileHandle(filename, { create: true });
  const writable = await fh.createWritable();
  await writable.write(JSON.stringify(data, null, 2));
  await writable.close();
}

async function readFileFromDir(dirHandle, filename) {
  try {
    const fh = await dirHandle.getFileHandle(filename, { create: false });
    const file = await fh.getFile();
    const text = await file.text();
    return text.trim() ? JSON.parse(text) : null;
  } catch(e) { return null; }
}

/* 尝试用缓存的句柄重新获取权限（不弹文件夹选择器，只弹"是否允许"） */
async function tryRestoreSavedHandle(){
  const saved = await loadDirHandle();
  if(!saved) return false;
  try {
    const perm = await saved.requestPermission({ mode: 'readwrite' });
    if(perm !== 'granted') return false;
    _dirHandle = saved;
    _dataDirHandle = await getOrCreateDataDir(_dirHandle);
    return !!_dataDirHandle;
  } catch(e) { return false; }
}

/* 首次：弹文件夹选择器 */
async function pickNewFolder(){
  _dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
  await saveDirHandle(_dirHandle);
  _dataDirHandle = await getOrCreateDataDir(_dirHandle);
  if(!_dataDirHandle) throw new Error('创建数据文件夹失败');
}

async function loadDataFromDir(){
  const savedClasses = await readFileFromDir(_dataDirHandle, DATA_FILES.classPetData);
  const savedActions = await readFileFromDir(_dataDirHandle, DATA_FILES.customActions);
  const savedLogs = await readFileFromDir(_dataDirHandle, DATA_FILES.operationLogs);
  const savedArchives = await readFileFromDir(_dataDirHandle, DATA_FILES.logArchives);
  const savedDeleted = await readFileFromDir(_dataDirHandle, DATA_FILES.deletedClasses);
  let loaded = false;
  if(savedClasses && savedClasses.length>0){ classesData=savedClasses; safeLSSave('classPetData',classesData); loaded=true; }
  if(savedActions && savedActions.length>0){ customActions=savedActions; neededPresets.forEach(p=>{if(!customActions.some(a=>a.id===p.id))customActions.push(p);}); safeLSSave('customActions',customActions); loaded=true; }
  if(savedLogs && savedLogs.length>0){ window.operationLogs=savedLogs; safeLSSave('operationLogs',window.operationLogs); loaded=true; }
  if(savedArchives && typeof savedArchives==='object' && !Array.isArray(savedArchives)){ logArchives=savedArchives; safeLSSave('logArchives',logArchives); loaded=true; }
  if(savedDeleted && savedDeleted.length>0){ deletedClasses=savedDeleted; safeLSSave('deletedClasses',deletedClasses); loaded=true; }
  if(loaded){ archiveOldLogs(); currentClassId=null; init(); }
  return loaded;
}

async function connectUSB() {
  /* 桌面 EXE 模式：直接用 Python 桥接，无需弹窗 */
  if(_desktopMode){
    try { await _desktopLoadData(); updateUSBStatus(true); showNotification('数据已加载','数据自动保存到同级「数据」文件夹','success'); } catch(e){ showNotification('加载失败',e.message,'error'); }
    return;
  }
  if(!window.showDirectoryPicker){
    showNotification('浏览器不支持','请使用 Chrome 或 Edge 浏览器','error'); return;
  }
  try {
    /* 先尝试用上次记住的文件夹（只弹"是否允许"小提示） */
    let restored = await tryRestoreSavedHandle();
    if(!restored){
      /* 没有缓存或权限被拒，才弹文件夹选择器 */
      await pickNewFolder();
    }
    const loaded = await loadDataFromDir();
    if(!loaded){ await saveAllToFiles(); }
    updateUSBStatus(true);
    showNotification(loaded?'数据已加载':'授权成功', loaded?'已从「数据」文件夹读取宠物数据':'数据将自动保存到「数据」文件夹','success');
  } catch(e) {
    if(e.name!=='AbortError') showNotification('授权失败',e.message,'error');
  }
}

async function saveAllToFiles() {
  if(!_dataDirHandle) return;
  if(_isSaving){ _pendingSave=true; return; }
  _isSaving = true;
  try {
    await Promise.all([
      writeFileToDir(_dataDirHandle, DATA_FILES.classPetData, classesData),
      writeFileToDir(_dataDirHandle, DATA_FILES.customActions, customActions),
      writeFileToDir(_dataDirHandle, DATA_FILES.operationLogs, window.operationLogs),
      writeFileToDir(_dataDirHandle, DATA_FILES.logArchives, logArchives),
      writeFileToDir(_dataDirHandle, DATA_FILES.deletedClasses, deletedClasses)
    ]);
  } catch(e) {
    console.error('保存失败:',e);
    /* 尝试重新验证权限后重试一次 */
    let retryOk = false;
    try {
      if(_dirHandle) {
        const perm = await _dirHandle.requestPermission({ mode: 'readwrite' });
        if(perm === 'granted') {
          _dataDirHandle = await getOrCreateDataDir(_dirHandle);
          if(_dataDirHandle) {
            await Promise.all([
              writeFileToDir(_dataDirHandle, DATA_FILES.classPetData, classesData),
              writeFileToDir(_dataDirHandle, DATA_FILES.customActions, customActions),
              writeFileToDir(_dataDirHandle, DATA_FILES.operationLogs, window.operationLogs),
              writeFileToDir(_dataDirHandle, DATA_FILES.deletedClasses, deletedClasses)
            ]);
            retryOk = true;
            updateUSBStatus(true);
          }
        }
      }
    } catch(retryErr) { console.error('重试保存失败:', retryErr); }
    if(!retryOk) {
      updateUSBStatus(false); _dirHandle=null; _dataDirHandle=null;
      showNotification('保存失败','请重新点击右上角「授权保存」','error');
    }
  }
  _isSaving = false;
  if(_pendingSave){ _pendingSave=false; saveAllToFiles(); }
}

function scheduleFileSave() {
  if(_desktopMode){ _scheduleDesktopSave(); return; }
  if(!_dataDirHandle) return;
  if(_fileSaveTimer) clearTimeout(_fileSaveTimer);
  _fileSaveTimer = setTimeout(()=>{ saveAllToFiles(); }, 200);
}

/* ========== 桌面 EXE 模式：通过 pywebview Python 桥接读写文件 ========== */

async function _desktopLoadData(){
  const api = window.pywebview.api;
  _desktopMode = true;
  let loaded = false;
  try {
    const r1 = await api.read_file('班级宠物数据.json');
    if(r1.ok && r1.data){ const d=JSON.parse(r1.data); if(d&&d.length>0){ classesData=d; safeLSSave('classPetData',classesData); loaded=true; }}
    const r2 = await api.read_file('奖惩设置.json');
    if(r2.ok && r2.data){ const d=JSON.parse(r2.data); if(d&&d.length>0){ customActions=d; neededPresets.forEach(p=>{if(!customActions.some(a=>a.id===p.id))customActions.push(p);}); safeLSSave('customActions',customActions); loaded=true; }}
    const r3 = await api.read_file('操作日志.json');
    if(r3.ok && r3.data){ const d=JSON.parse(r3.data); if(d&&d.length>0){ window.operationLogs=d; safeLSSave('operationLogs',window.operationLogs); loaded=true; }}
    const r3b = await api.read_file('操作日志归档.json');
    if(r3b.ok && r3b.data){ const d=JSON.parse(r3b.data); if(d&&typeof d==='object'&&!Array.isArray(d)){ logArchives=d; safeLSSave('logArchives',logArchives); loaded=true; }}
    const r4 = await api.read_file('已删除班级.json');
    if(r4.ok && r4.data){ const d=JSON.parse(r4.data); if(d&&d.length>0){ deletedClasses=d; safeLSSave('deletedClasses',deletedClasses); loaded=true; }}
  } catch(e){ console.error('桌面模式加载数据失败:', e); }
  if(loaded){ archiveOldLogs(); currentClassId=null; init(); }
  else { await _desktopSaveAll(); }  /* 首次运行，把 localStorage 数据写出去 */
}

async function _desktopSaveAll(){
  if(!_desktopMode) return;
  const api = window.pywebview.api;
  try {
    await api.write_file('班级宠物数据.json', JSON.stringify(classesData, null, 2));
    await api.write_file('奖惩设置.json', JSON.stringify(customActions, null, 2));
    await api.write_file('操作日志.json', JSON.stringify(window.operationLogs, null, 2));
    await api.write_file('操作日志归档.json', JSON.stringify(logArchives, null, 2));
    await api.write_file('已删除班级.json', JSON.stringify(deletedClasses, null, 2));
  } catch(e){ console.error('桌面模式保存数据失败:', e); }
}

function _scheduleDesktopSave(){
  if(_desktopSaveTimer) clearTimeout(_desktopSaveTimer);
  _desktopSaveTimer = setTimeout(()=>{ _desktopSaveAll(); }, 200);
}
/* ========== 桌面 EXE 模式结束 ========== */
function recordAction(studentId, studentName, actionType, details, coinDelta, expDelta, petId, extra = null){
  if(coinDelta === 0 && expDelta === 0 && !extra) return;
  const cur = classesData.find(c=>c.id===currentClassId);
  let snapshot = null;
  if(cur){
    const stu = cur.students.find(s=>s.id.toString()===studentId.toString());
    if(stu){
      const pet = petId ? (stu.pets||[]).find(p=>p.id===petId) : getActivePet(stu);
      snapshot = { coinsBefore: stu.coins - (coinDelta||0), coinsAfter: stu.coins };
      if(pet){
        snapshot.petNick = pet.nickname||pet.name;
        snapshot.petRealName = pet.name;
        snapshot.petLevel = pet.level;
        snapshot.growthBefore = Math.max(0, (pet.growth||0) - (expDelta||0));
        snapshot.growthAfter = pet.growth||0;
        snapshot.isDead = pet.isDead||false;
        snapshot.penaltyStreak = pet.penaltyStreak||0;
        const cfg = PET_CONFIG[pet.name];
        if(cfg){ const stg = cfg.stages.find(s=>s.stage===pet.level); snapshot.stageName = stg ? stg.stageName : '阶段'+pet.level; }
      }
      // v45: Expand snapshot with complete quizState for point-in-time recovery
      // Stores full pigRunLevels dict so "恢复到此" can restore all levels at once
      if(stu.quizState){
        const qs = stu.quizState;
        snapshot.quizStateSnapshot = {
          pigRunLevels: qs.pigRunLevels ? JSON.parse(JSON.stringify(qs.pigRunLevels)) : {},
          pigRunTotalScore: qs.pigRunTotalScore || 0,
          pigRunTools: qs.pigRunTools ? JSON.parse(JSON.stringify(qs.pigRunTools)) : {},
          totalQuizCoins: qs.totalQuizCoins || 0,
          todayCoins: qs.todayCoins || 0
        };
      }
    }
  }
  const log = {
    id: _genLocalId(), timestamp: new Date().toISOString(),
    classId: currentClassId, studentId, studentName, actionType, details,
    coinDelta, expDelta, petId, extra, snapshot, reverted: false, _synced: false
  };
  // v16: Push to window.operationLogs — the single source of truth
  window.operationLogs.push(log);
  saveLogs();
}
function recordResetAction(classId, className, fullSnapshot){ const log = { id: _genLocalId(), timestamp: new Date().toISOString(), classId: classId, studentId: classId, studentName: className, actionType: "重置班级宠物", details: `重置班级【${className}】所有宠物数据（${fullSnapshot.length}名学生）`, fullSnapshot: JSON.parse(JSON.stringify(fullSnapshot)), coinDelta: 0, expDelta: 0, reverted: false, _synced: false }; window.operationLogs.push(log); saveLogs(); }
function _recalcPetLevel(pet){ const cfg = PET_CONFIG[pet.name]; if(cfg){ let newLevel = 1; for(let i=cfg.stages.length-1;i>=0;i--) if(pet.growth>=cfg.stages[i].growthRequired){ newLevel=cfg.stages[i].stage; break; } pet.level = newLevel; } }
function _revertStudentLog(curClass, log){ const student = curClass.students.find(s=>s.id.toString()===log.studentId.toString()); if(!student) return; let pet = null; if(log.petId && student.pets) pet = student.pets.find(p=>p.id===log.petId); if(!pet && student.pets.length>0) pet = getActivePet(student); if(log.coinDelta !== 0){ student.coins -= log.coinDelta; if(student.coins < 0) student.coins = 0; } if(log.expDelta !== 0 && pet){ pet.growth -= log.expDelta; if(pet.growth < 0) pet.growth = 0; _recalcPetLevel(pet); } if(log.extra && log.extra.causedDeath && pet){ pet.isDead = false; pet.deathGrowth = undefined; delete pet.deathDate; pet.penaltyStreak = 0; if(log.extra.starvation && log.extra.petSnapshot){ const snap=log.extra.petSnapshot; pet.level=snap.level; pet.growth=snap.growth; pet.lastFeedDate=snap.lastFeedDate; pet.todayFeedCount=snap.todayFeedCount||0; pet.todayPlayCount=snap.todayPlayCount||0; pet.lastPlayDate=snap.lastPlayDate; pet.penaltyStreak=snap.penaltyStreak||0; } else if(log.extra.prevGrowth !== undefined){ pet.growth = log.extra.prevGrowth; _recalcPetLevel(pet); } } if(log.extra && log.extra.shopItemId){ const itemId=log.extra.shopItemId; if(student.shopItems){ const idx=student.shopItems.indexOf(itemId); if(idx!==-1) student.shopItems.splice(idx,1); } unequipItem(student, itemId); } }
function restoreToLogEntry(logId){
  var _logs = getOpLogs();
  const log = _logs.find(l => l.id === logId);
  if(!log) return;
  const curClass = classesData.find(c=>c.id===currentClassId);
  if(!curClass) return;
  const student = curClass.students.find(s=>s.id.toString()===log.studentId.toString());
  if(!student){ showNotification('恢复失败','未找到该学生', 'error'); return; }
  const snap = log.snapshot;
  if(!snap){ showNotification('恢复失败','该日志没有快照数据', 'error'); return; }
  if(!confirm(`确定将「${log.studentName}」的数据恢复到 ${log.timestamp} 的状态？\n这将覆盖当前的金币、成长值和小猪快跑数据。`)) return;
  // 1. Restore coins and pet growth
  if(snap.coinsAfter !== undefined) student.coins = snap.coinsAfter;
  const pet = (student.pets||[]).find(p=>p.id===log.petId) || getActivePet(student);
  if(pet && snap.growthAfter !== undefined){
    pet.growth = snap.growthAfter;
    if(snap.petLevel) pet.level = snap.petLevel;
    pet.isDead = snap.isDead||false;
    pet.penaltyStreak = snap.penaltyStreak||0;
    _recalcPetLevel(pet);
  }
  // 2. Restore quizState from snapshot
  if(snap.quizStateSnapshot){
    if(!student.quizState) student.quizState = {};
    const qsSnap = snap.quizStateSnapshot;
    student.quizState.pigRunLevels = JSON.parse(JSON.stringify(qsSnap.pigRunLevels || {}));
    student.quizState.pigRunTotalScore = qsSnap.pigRunTotalScore || 0;
    student.quizState.pigRunTools = JSON.parse(JSON.stringify(qsSnap.pigRunTools || {}));
    student.quizState.totalQuizCoins = qsSnap.totalQuizCoins || 0;
    student.quizState.todayCoins = qsSnap.todayCoins || 0;
  }
  // 3. Save to Supabase
  saveClassData();
  if(typeof _takeSnapshot === 'function') _takeSnapshot();
  scheduleAllRenders();
  if(currentModalStudentId && currentModalStudentId.toString()===log.studentId.toString()) refreshCurrentStudentModal();
  let detail = `已恢复「${log.studentName}」的数据到 ${new Date(log.timestamp).toLocaleString('zh-CN')}`;
  if(snap.quizStateSnapshot){
    const qsSnap = snap.quizStateSnapshot;
    const levelCount = Object.keys(qsSnap.pigRunLevels||{}).length;
    if(levelCount > 0) detail += `\n小猪快跑: ${levelCount}关 / ${qsSnap.pigRunTotalScore}分`;
  }
  showNotification('恢复成功', detail, 'success');
}
function revertToLog(logId){
  var _logs = getOpLogs();
  const log = _logs.find(l => l.id === logId);
  if(!log) return;
  if(log.reverted){ showNotification('无法撤销','该操作已被撤销过', 'warning'); return; }
  const curClass = classesData.find(c=>c.id===currentClassId);
  if(!curClass) return;
  // 重置班级宠物：恢复完整快照
  if(log.fullSnapshot){
    curClass.students = JSON.parse(JSON.stringify(log.fullSnapshot));
    log.reverted = true;
    saveClassData(); saveLogs();
    scheduleAllRenders();
    if(currentModalStudentId) refreshCurrentStudentModal();
    showNotification('撤销成功', `已撤销「重置班级宠物」，${log.fullSnapshot.length}名学生数据已恢复`, 'success');
    return;
  }
  // PK胜负记录：同时回溯双方
  if(log.extra && log.extra.pkType && log.extra.pkType !== 'draw'){
    _revertStudentLog(curClass, log);
    const opponentId = log.extra.opponentId;
    const opponentPetId = log.extra.opponentPetId;
    const opponent = curClass.students.find(s=>s.id.toString()===opponentId.toString());
    if(opponent){
      opponent.coins -= log.extra.opponentCoinDelta;
      if(opponent.coins < 0) opponent.coins = 0;
      let opPet = null;
      if(opponentPetId && opponent.pets) opPet = opponent.pets.find(p=>p.id===opponentPetId);
      if(!opPet && opponent.pets.length>0) opPet = getActivePet(opponent);
      if(opPet && log.extra.opponentGrowthDelta !== 0){
        opPet.growth -= log.extra.opponentGrowthDelta;
        if(opPet.growth < 0) opPet.growth = 0;
        _recalcPetLevel(opPet);
      }
    }
    log.reverted = true;
    const pairLog = _logs.find(l => l.id !== logId && l.extra && l.extra.pkType && l.extra.opponentId && l.extra.opponentId.toString() === log.studentId.toString() && Math.abs(l.id - log.id) < 5);
    if(pairLog) pairLog.reverted = true;
    saveLogs(); saveClassData();
    scheduleAllRenders();
    if(currentModalStudentId) refreshCurrentStudentModal();
    showNotification('撤销成功', `已撤销 ${log.studentName} vs ${log.extra.opponentName} 的PK结果`, 'success');
    return;
  }
  // PK平局回溯：标记双方为已撤销
  if(log.extra && log.extra.pkType === 'draw'){
    log.reverted = true;
    const pairLog = _logs.find(l => l.id !== logId && l.extra && l.extra.pkType === 'draw' && l.extra.opponentId && l.extra.opponentId.toString() === log.studentId.toString() && Math.abs(l.id - log.id) < 5);
    if(pairLog) pairLog.reverted = true;
    saveLogs();
    showNotification('撤销成功', `已撤销 ${log.studentName} 的PK平局记录`, 'success');
    return;
  }
  // 普通记录：仅撤销该条操作，不影响其他记录
  _revertStudentLog(curClass, log);
  log.reverted = true;
  saveClassData(); saveLogs();
  scheduleAllRenders();
  if(currentModalStudentId && currentModalStudentId.toString()===log.studentId.toString()) refreshCurrentStudentModal();
  const snap = log.snapshot;
  let revertDetail = `已撤销 ${log.studentName} 的「${log.actionType}」`;
  if(snap){
    revertDetail += `\n金币: ${snap.coinsAfter} → ${snap.coinsBefore}`;
    if(snap.petNick && log.expDelta) revertDetail += `，${snap.petNick}成长: ${snap.growthAfter} → ${snap.growthBefore}`;
  }
  showNotification('撤销成功', revertDetail, 'success');
}
function _historyActionIcon(type){
  const icons = {'喂食':'🍖','玩耍':'🎾','散步':'🚶','逛街':'🛍️','复活':'💖','奖惩':'🏅','惩罚致死':'💀','饿死':'💀','商店购买':'🏪','PK胜利':'⚔️🏆','PK失败':'⚔️💔','PK平局':'⚔️🤝','全班打卡':'📋','每日打卡':'📋','全班喂食':'🍖👥','批量奖惩':'📦','重置班级宠物':'🔄','小猪快跑':'🐷','取金阁':'📝'};
  return icons[type]||'📝';
}
function _historyActionColor(type){
  if(type==='惩罚致死'||type==='饿死') return '#ff4444';
  if(type.includes('惩罚')||type==='PK失败') return '#e07050';
  if(type.includes('奖')||type==='PK胜利'||type==='全班打卡'||type==='每日打卡'||type==='小猪快跑'||type==='取金阁') return '#4a9e4a';
  if(type==='PK平局') return '#8888aa';
  if(type==='复活') return '#9b59b6';
  if(type==='商店购买') return '#8e44ad';
  if(type==='重置班级宠物') return '#cc6633';
  return '#886655';
}
var _isStudentHistoryView = false; // true when a student is viewing history
function showHistoryModal(){
  const curClass = classesData.find(c=>c.id===currentClassId);
  const className = curClass ? curClass.name : '未选择班级';
  // Detect if current user is a student
  _isStudentHistoryView = !!(typeof currentUser !== 'undefined' && currentUser && currentUser.type === 'student');

  // v11: First sync local logs to Supabase, then load, then show
  // This ensures all recent operations (from any account) are visible
  var showFn = function() {
    const months = getAvailableMonths();
    if(months.length===0){
      showModal(`📜 历史操作记录【${className}】`,
        '<div style="text-align:center;padding:30px;color:#bba;">该班级暂无操作记录</div>',
        [{text:'关闭',onclick:'closeModal()'}], false);
      return;
    }
    _currentHistoryMonth = months[0];
    let html = _buildHistoryHTML(curClass, className, months, _currentHistoryMonth);
    showModal(`📜 历史操作记录【${className}】`, html, [{text:'关闭',onclick:'closeModal()'}], true);
  };

  // v25: Step 1: Sync local unsynced logs to Supabase first
  // Use _writeUnsyncedLogsToSupabase (v24 function) instead of deleted _syncOperationLogsToSupabase
  var syncPromise = (typeof _writeUnsyncedLogsToSupabase === 'function')
    ? _writeUnsyncedLogsToSupabase()
    : Promise.resolve();

  // Step 2: Then load fresh logs from Supabase (merges with local)
  syncPromise.then(function() {
    if (typeof _loadOperationLogs === 'function') {
      return _loadOperationLogs();
    }
  }).then(function() {
    // v15: Ensure alias is synced after loading
    if (typeof _syncOpLogsAlias === 'function') { try { _syncOpLogsAlias(); } catch(e) {} }
    showFn();
  }).catch(function(e) {
    // v15: Sync alias even on error
    if (typeof _syncOpLogsAlias === 'function') { try { _syncOpLogsAlias(); } catch(e2) {} }
    console.warn('[History] Load error, showing with local data:', e);
    showFn(); // Always show modal, even if Supabase fails
  });
}
// v12: Refresh history modal content when it's open and new logs arrive (Realtime)
function refreshHistoryModalIfOpen(){
  var modalOverlay = document.querySelector('#modalContainer .modal-overlay');
  if(!modalOverlay) return;
  var titleEl = modalOverlay.querySelector('.modal-title');
  if(!titleEl || !titleEl.textContent.includes('历史操作记录')) return;
  // History modal is open — refresh its content
  var curClass = classesData.find(c=>c.id===currentClassId);
  var className = curClass ? curClass.name : '未选择班级';
  var months = getAvailableMonths();
  if(months.length===0) return;
  if(!_currentHistoryMonth || months.indexOf(_currentHistoryMonth)===-1) _currentHistoryMonth = months[0];
  var contentEl = modalOverlay.querySelector('.modal-content');
  if(contentEl) {
    // === 增量更新优化：先检查日志数量是否变化，无变化则跳过 ===
    var newLogCount = getAllLogsForMonth(_currentHistoryMonth).filter(function(log) {
      if(log.classId) { if(log.classId.toString() !== (currentClassId || '').toString()) return false; }
      else if(curClass) { if(!curClass.students.some(function(s){return s.id.toString()===log.studentId.toString();})) return false; }
      else return false;
      if(_historyFilterEnabled && _historyFilterStudentId) {
        if(log.studentId.toString() !== _historyFilterStudentId.toString()) return false;
      }
      return true;
    }).length;
    var logList = contentEl.querySelector('#historyLogList');
    var existingCount = logList ? logList.children.length : -1;
    // 如果日志数量没变，大概率内容没变，跳过重建（避免闪烁）
    if (existingCount === newLogCount && newLogCount > 0) {
      // 只更新标题（月份/班级名可能变了）
      if(titleEl) titleEl.textContent = '\uD83D\uDCDC 历史操作记录【' + className + '】';
      return;
    }
    // 数量变了，需要重建（新增/撤销了日志）
    // 保存滚动位置
    var savedScrollTop = logList ? logList.scrollTop : 0;
    // 重建内容
    contentEl.innerHTML = _buildHistoryHTML(curClass, className, months, _currentHistoryMonth);
    // 恢复滚动位置
    var newLogList = contentEl.querySelector('#historyLogList');
    if(newLogList) newLogList.scrollTop = savedScrollTop;
  }
  // Also update the title to reflect latest data
  if(titleEl) titleEl.textContent = '\uD83D\uDCDC 历史操作记录【' + className + '】';
}
function switchHistoryMonth(month){
  _currentHistoryMonth = month;
  const curClass = classesData.find(c=>c.id===currentClassId);
  const className = curClass ? curClass.name : '未选择班级';
  const months = getAvailableMonths();
  const container = document.querySelector('.modal-content');
  if(container) container.innerHTML = _buildHistoryHTML(curClass, className, months, month);
}
function _buildHistoryHTML(curClass, className, months, activeMonth){
  const curMonth = _getCurrentMonth();
  const isCurrentMonth = (activeMonth === curMonth);
  const allLogs = getAllLogsForMonth(activeMonth);
  // v11: All accounts (teacher + student) see ALL merged logs for the class
  // Only difference: students cannot revoke (handled below in button logic)
  const isStudentView = _isStudentHistoryView;
  const classLogs = allLogs.filter(log => {
    // v12: Use toString() comparison to avoid type mismatch (number vs string)
    if(log.classId) { if(log.classId.toString() !== (currentClassId || '').toString()) return false; }
    else if(curClass) { if(!curClass.students.some(s=>s.id.toString()===log.studentId.toString())) return false; }
    else return false;
    // 筛选：如果启用筛选且选中了学生，只显示该学生的记录
    if(_historyFilterEnabled && _historyFilterStudentId) {
      if(log.studentId.toString() !== _historyFilterStudentId.toString()) return false;
    }
    return true;
  });
  let html = '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px;align-items:center;">';
  html += '<span style="font-size:13px;color:#886;margin-right:4px;">月份：</span>';
  months.forEach(m=>{
    const label = m.replace('-','年') + '月';
    const isActive = m === activeMonth;
    html += `<button onclick="switchHistoryMonth('${m}')" style="padding:4px 12px;border-radius:14px;border:1.5px solid ${isActive?'#e8637a':'#e0d0c8'};background:${isActive?'linear-gradient(135deg,#e8637a,#f5a054)':'#fff8f5'};color:${isActive?'#fff':'#886'};font-size:12px;font-weight:${isActive?'700':'400'};cursor:pointer;transition:all 0.2s;">${label}${m===curMonth?' (本月)':''}</button>`;
  });
  html += '</div>';
  // 筛选功能：在月份按钮行后面添加
  html += '<div style="display:flex;align-items:center;gap:6px;margin-bottom:10px;">';
  html += '<input type="checkbox" id="historyFilterCheck" ' + (_historyFilterEnabled ? 'checked' : '') + ' onchange="toggleHistoryFilter(this.checked)" style="width:16px;height:16px;cursor:pointer;">';
  html += '<button onclick="showHistoryStudentFilter()" style="padding:4px 12px;border-radius:14px;border:1.5px solid ' + (_historyFilterEnabled && _historyFilterStudentId ? '#52c41a' : '#e0d0c8') + ';background:' + (_historyFilterEnabled && _historyFilterStudentId ? '#f0fff0' : '#fff8f5') + ';color:' + (_historyFilterEnabled && _historyFilterStudentId ? '#389e0d' : '#886') + ';font-size:12px;cursor:pointer;transition:all 0.2s;">筛选' + (_historyFilterStudentId ? '：' + _getHistoryFilterStudentName() : '') + '</button>';
  if (_historyFilterEnabled && _historyFilterStudentId) {
    html += '<button onclick="clearHistoryFilter()" style="padding:2px 8px;border-radius:10px;border:1px solid #ffcccc;background:#fff5f5;color:#cc5555;font-size:11px;cursor:pointer;">✕ 清除</button>';
  }
  html += '</div>';
  if(classLogs.length===0){
    html += '<div style="text-align:center;padding:25px;color:#bba;">该月无操作记录</div>';
    return html;
  }
  const total = classLogs.length;
  const revertedCount = classLogs.filter(l=>l.reverted).length;
  html += `<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 12px;margin-bottom:8px;background:#fff5f0;border-radius:12px;font-size:13px;color:#886;">
    <span>共 <strong>${total}</strong> 条记录${revertedCount>0?`，<span style="color:#cc8800;">${revertedCount} 条已撤销</span>`:''}${!isCurrentMonth?' · <span style="color:#aaa;">归档记录</span>':''}</span>
    <label style="cursor:pointer;"><input type="checkbox" id="historyShowReverted" onchange="toggleRevertedVisibility(this.checked)" checked> 显示已撤销</label>
  </div>`;
  html += '<div id="historyLogList" style="max-height:400px;overflow:auto;">';
  // v12: Show newest logs first (remove .reverse())
  classLogs.forEach(log=>{
    const time = new Date(log.timestamp);
    const timeStr = time.toLocaleDateString('zh-CN',{month:'2-digit',day:'2-digit'}) + ' ' + time.toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
    const icon = _historyActionIcon(log.actionType);
    const color = _historyActionColor(log.actionType);
    const isReverted = log.reverted;
    const snap = log.snapshot;
    let coinLine = '';
    if(log.coinDelta !== 0){
      const sign = log.coinDelta > 0 ? '+' : '';
      coinLine = `<span style="color:${log.coinDelta>0?'#4a9e4a':'#cc5544'};font-weight:600;">💰${sign}${log.coinDelta}</span>`;
      if(snap) coinLine += `<span style="color:#aaa;margin-left:4px;">(${snap.coinsBefore}→${snap.coinsAfter})</span>`;
    }
    let expLine = '';
    if(log.expDelta !== 0){
      const sign = log.expDelta > 0 ? '+' : '';
      expLine = `<span style="color:${log.expDelta>0?'#4a9e4a':'#cc5544'};font-weight:600;margin-left:8px;">🌱${sign}${log.expDelta}</span>`;
      if(snap) expLine += `<span style="color:#aaa;margin-left:4px;">(${snap.growthBefore}→${snap.growthAfter})</span>`;
    }
    let petInfo = '';
    if(snap && snap.petNick){
      petInfo = `<span style="background:#fff0e8;padding:1px 8px;border-radius:8px;font-size:11px;margin-left:6px;">🐾 ${esc(snap.petNick)} Lv.${snap.petLevel}${snap.stageName?' · '+esc(snap.stageName):''}</span>`;
    }
    let extraInfo = '';
    if(log.extra){
      if(log.extra.causedDeath) extraInfo += '<span style="color:#ff3333;font-weight:700;margin-left:6px;">⚠️ 宠物死亡！</span>';
      if(log.extra.pkType === 'win') extraInfo += `<span style="margin-left:6px;font-size:12px;">🎯 对手: ${esc(log.extra.opponentName)}（金币${log.extra.opponentCoinDelta}，成长${log.extra.opponentGrowthDelta>=0?'+':''}${log.extra.opponentGrowthDelta}）</span>`;
      if(log.extra.pkType === 'lose') extraInfo += `<span style="margin-left:6px;font-size:12px;">🎯 胜者: ${esc(log.extra.opponentName)}</span>`;
      if(log.extra.pkType === 'draw') extraInfo += `<span style="margin-left:6px;font-size:12px;">🤝 对手: ${esc(log.extra.opponentName)}</span>`;
    }
    if(snap && snap.isDead && !log.extra?.causedDeath) extraInfo += '<span style="color:#999;margin-left:6px;font-size:11px;">（宠物已死亡）</span>';
    if(snap && snap.penaltyStreak >= 2 && !log.extra?.causedDeath) extraInfo += `<span style="color:#ee6633;margin-left:6px;font-size:11px;">⚠ 连续惩罚${snap.penaltyStreak}次</span>`;
    const opacity = isReverted ? 'opacity:0.45;' : '';
    const revertedBadge = isReverted ? '<span style="background:#ffcc00;color:#665500;padding:1px 6px;border-radius:6px;font-size:10px;font-weight:700;margin-left:6px;">已撤销</span>' : '';
    let btnHtml = '';
    // Only teachers can revoke operations; students cannot
    if(!isReverted && isCurrentMonth && !isStudentView){
      btnHtml = `<button class="btn btn-secondary" style="padding:5px 14px;font-size:13px;flex-shrink:0;" onclick="if(confirm('确定撤销「${esc(log.studentName)} · ${esc(log.actionType)}」？此操作将还原数据变更。')){revertToLog(${log.id});closeModal();}">撤销</button>`;
      // v46: Show "恢复到此" button for all logs with snapshot
      if(snap && (snap.coinsAfter !== undefined || snap.quizStateSnapshot)) btnHtml = `<button class="btn btn-secondary" style="padding:5px 12px;font-size:12px;flex-shrink:0;background:#e8f5e9;color:#2e7d32;border-color:#a5d6a7;margin-right:6px;" onclick="restoreToLogEntry(${log.id})">恢复到此</button>` + btnHtml;
    }
    html += `<div class="history-log-item ${isReverted?'history-reverted':''}" style="${opacity}border-left:3px solid ${color};padding-left:14px;">
      <div style="flex:1;min-width:0;">
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
          <span class="history-log-time">${timeStr}</span>
          <span style="font-size:14px;">${icon}</span>
          <strong style="color:${color};">${esc(log.studentName)}</strong>
          <span style="color:#998;font-size:13px;">· ${esc(log.actionType)}</span>
          ${revertedBadge}${petInfo}
        </div>
        <div style="font-size:13px;margin-top:3px;color:#665;">${esc(log.details)}</div>
        <div style="font-size:12px;margin-top:2px;">${coinLine}${expLine}${extraInfo}</div>
      </div>
      ${btnHtml}
    </div>`;
  });
  html += '</div>';
  return html;
}
function toggleRevertedVisibility(show){
  document.querySelectorAll('.history-reverted').forEach(el=>{
    el.style.display = show ? '' : 'none';
  });
}
// === 历史操作筛选功能 ===
function _getHistoryFilterStudentName() {
  if (!_historyFilterStudentId) return '';
  var curClass = classesData.find(c => c.id === currentClassId);
  if (!curClass) return '未知';
  var stu = curClass.students.find(s => s.id.toString() === _historyFilterStudentId.toString());
  return stu ? stu.name : '未知';
}
function toggleHistoryFilter(enabled) {
  _historyFilterEnabled = enabled;
  if (!enabled) _historyFilterStudentId = null;
  _refreshHistoryContent();
}
function clearHistoryFilter() {
  _historyFilterStudentId = null;
  _historyFilterEnabled = false;
  _refreshHistoryContent();
}
function _refreshHistoryContent() {
  var curClass = classesData.find(c => c.id === currentClassId);
  var className = curClass ? curClass.name : '未选择班级';
  var months = getAvailableMonths();
  if (months.length === 0) return;
  if (!_currentHistoryMonth || months.indexOf(_currentHistoryMonth) === -1) _currentHistoryMonth = months[0];
  var container = document.querySelector('.modal-content');
  if (container) {
    // 保存滚动位置
    var logList = container.querySelector('#historyLogList');
    var savedScrollTop = logList ? logList.scrollTop : 0;
    container.innerHTML = _buildHistoryHTML(curClass, className, months, _currentHistoryMonth);
    // 恢复滚动位置
    var newLogList = container.querySelector('#historyLogList');
    if(newLogList) newLogList.scrollTop = savedScrollTop;
  }
}
function showHistoryStudentFilter() {
  var curClass = classesData.find(c => c.id === currentClassId);
  if (!curClass || !curClass.students || curClass.students.length === 0) {
    alert('当前班级没有学生');
    return;
  }
  var students = curClass.students;
  _renderHistoryFilterStudentList(students, _historyFilterStudentId);
}
function _renderHistoryFilterStudentList(students, selectedId) {
  var html = '<div style="position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;" id="historyFilterModal">';
  html += '<div style="background:#fff;border-radius:20px;padding:24px;width:900px;max-width:95vw;max-height:80vh;display:flex;flex-direction:column;box-shadow:0 12px 40px rgba(0,0,0,0.3);">';
  // Header
  html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">';
  html += '<div style="font-size:18px;font-weight:700;">📋 选择学生 - 历史操作筛选</div>';
  html += '<button onclick="closeHistoryFilterModal()" style="background:none;border:none;font-size:24px;cursor:pointer;color:#999;">×</button>';
  html += '</div>';
  // Description
  html += '<div style="font-size:13px;color:#888;margin-bottom:14px;">点击学生姓名进行筛选，筛选后只显示该学生的操作记录。</div>';
  // Student list
  html += '<div style="display:flex;flex-wrap:wrap;gap:6px;overflow-y:auto;border:1.5px solid rgba(255,210,200,0.6);border-radius:18px;padding:12px;background:#fffaf5;align-content:flex-start;max-height:400px;">';
  students.forEach(function(stu) {
    var isSelected = selectedId && selectedId.toString() === stu.id.toString();
    var bgColor = isSelected ? '#e8ffe8' : '#fff';
    var borderColor = isSelected ? '#52c41a' : '#ffe2d6';
    html += '<div onclick="onHistoryFilterStudentClick(' + stu.id + ')" style="display:flex;align-items:center;padding:5px 10px;border:1.5px solid ' + borderColor + ';border-radius:12px;gap:6px;background:' + bgColor + ';font-size:14px;white-space:nowrap;cursor:pointer;transition:all 0.15s;">';
    if (isSelected) {
      html += '<span style="width:16px;height:16px;border-radius:50%;background:#52c41a;color:#fff;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:bold;flex-shrink:0;">✓</span>';
    } else {
      html += '<span style="width:16px;height:16px;border-radius:50%;border:1.5px solid #ddd;flex-shrink:0;"></span>';
    }
    html += '<span style="font-weight:600;">' + (stu.name || '未命名') + '</span>';
    html += '<span style="font-size:12px;color:#999;">💰' + (stu.coins || 0) + '</span>';
    html += '</div>';
  });
  html += '</div>';
  // Bottom buttons
  html += '<div style="text-align:center;margin-top:14px;">';
  html += '<button onclick="closeHistoryFilterModal()" style="background:#f0f0f0;color:#666;border:none;border-radius:12px;padding:10px 28px;font-size:14px;font-weight:700;cursor:pointer;">取消</button>';
  html += '</div>';
  html += '</div></div>';
  var container = document.getElementById('modalContainer');
  if (container) {
    // 先移除已有的筛选弹窗（如有）
    var old = document.getElementById('historyFilterModal');
    if (old) old.remove();
    container.insertAdjacentHTML('beforeend', html);
  }
}
window.onHistoryFilterStudentClick = function(studentId) {
  _historyFilterStudentId = parseInt(studentId);
  _historyFilterEnabled = true;
  closeHistoryFilterModal();
  _refreshHistoryContent();
  // Also update the checkbox
  var check = document.getElementById('historyFilterCheck');
  if (check) check.checked = true;
};
window.closeHistoryFilterModal = function() {
  var modal = document.getElementById('historyFilterModal');
  if (modal) modal.remove();
};
function getPetImage(petName, level=1) { const cfg = PET_CONFIG[petName]; if (!cfg) return '<span>🐾</span>'; return `<img src="${_img(`${cfg.id}/${level}.webp`)}" alt="${petName}" loading="lazy" decoding="async" style="max-width:100%; max-height:100%; object-fit: contain;" onerror="this.onerror=null; this.parentNode.innerHTML='<span style=\'font-size:48px;\'>${cfg.emoji}</span>';">`; }
function getEggImage() { return `<img src="${_img('蛋.webp')}" alt="宠物蛋" class="egg-img" loading="lazy" decoding="async" style="max-width:100%; max-height:100%; object-fit: contain;" onerror="this.onerror=null; this.parentNode.innerHTML='<span style=\'font-size:60px;\'>🥚</span>';">`; }

/* ===== ENHANCED PET MODAL SYSTEM - JS ===== */
let _petModalTiltCleanup = null;
let _petModalLongPressTimer = null;

function _getPetElement(petName) {
  const firePets = ['火凤凰','送财龙','大神龟','淡火狐','不萌鼠','哮天犬','九尾天狐','恐龙'];
  const waterPets = ['海马','青云龙','苍狮','小白','踏天马','刺猬','寄居蟹','果冻蝾螈'];
  const naturePets = ['荷兰兔','大白兔','萌萌羊','考拉','长毛汪','呆呆熊','荷兰猪','梅花鹿','羊驼','黄牛','芦丁鸡','大萌星'];
  const lightningPets = ['七彩鸟','白眉汪','六耳猕狗','猫猫虎','孔雀'];
  const shadowPets = ['萌蝙蝠','美杜莎','黑白犬','黑白猪','蜥蜴','花斑虎'];
  const lightPets = ['吉祥神兽','泰迪','熊猫大侠','白白东','幸运猫','比尔鸭','柯基犬','咩咩咩'];
  if(firePets.includes(petName)) return 'fire';
  if(waterPets.includes(petName)) return 'water';
  if(naturePets.includes(petName)) return 'nature';
  if(lightningPets.includes(petName)) return 'lightning';
  if(shadowPets.includes(petName)) return 'shadow';
  if(lightPets.includes(petName)) return 'light';
  return 'sparkle';
}

function _getLevelAuraTier(level) {
  if(level >= 9) return 'aura-tier5';
  if(level >= 7) return 'aura-tier4';
  if(level >= 5) return 'aura-tier3';
  if(level >= 3) return 'aura-tier2';
  return 'aura-tier1';
}

function initPetModalEnhancements(petImgEl, petName, petLevel, petGrowth, expNeeded) {
  if(!petImgEl) return;
  // Add classes
  petImgEl.classList.add('idle-breathing', 'enhanced-hover', 'tilt-active');
  // Level aura
  const tier = _getLevelAuraTier(petLevel);
  const auraDiv = document.createElement('div');
  auraDiv.className = 'level-aura ' + tier;
  petImgEl.insertBefore(auraDiv, petImgEl.firstChild);
  // Add orbiting spark dots for higher tiers
  if(petLevel >= 5) {
    const dotCount = petLevel >= 9 ? 6 : (petLevel >= 7 ? 4 : 2);
    const dotColors = petLevel >= 9 ? ['#ffd700','#ff4500','#ff00ff','#00bfff','#00ff88','#ffaa00'] : (petLevel >= 7 ? ['#ffd700','#ff6600','#ffaa00','#ff3300'] : ['#aa88ff','#8866ff']);
    const containerW = petImgEl.offsetWidth || 450;
    const orbitR = Math.round(containerW * (petLevel >= 9 ? 0.58 : petLevel >= 7 ? 0.55 : 0.52));
    for(let i = 0; i < dotCount; i++) {
      const dot = document.createElement('div');
      dot.className = 'aura-orbit-dot';
      const dur = 3 + Math.random() * 2;
      const color = dotColors[i % dotColors.length];
      const size = petLevel >= 9 ? 8 : 6;
      dot.style.cssText = `position:absolute;top:50%;left:50%;width:${size}px;height:${size}px;margin:-${size/2}px 0 0 -${size/2}px;border-radius:50%;background:${color};box-shadow:0 0 8px ${color},0 0 16px ${color};pointer-events:none;z-index:2;animation:orbitDot ${dur}s linear infinite;animation-delay:${-(dur/dotCount)*i}s;--orbit-r:${orbitR}px;`;
      auraDiv.appendChild(dot);
    }
  }
  // Entrance animation
  const entranceClass = petLevel >= 7 ? 'entrance-high' : (petLevel >= 4 ? 'entrance-mid' : 'entrance-low');
  petImgEl.classList.add(entranceClass);
  // Entrance effects
  if(petLevel >= 4) {
    const ringCount = petLevel >= 7 ? 3 : 1;
    for(let i = 0; i < ringCount; i++) {
      const ring = document.createElement('div');
      ring.className = 'entrance-flash-ring' + (i > 0 ? ' ring-' + (i+1) : '');
      petImgEl.appendChild(ring);
      setTimeout(() => ring.remove(), 1500);
    }
  }
  // Stardust
  const dustCount = petLevel >= 7 ? 20 : (petLevel >= 4 ? 12 : 6);
  const dustColors = petLevel >= 7 ? ['#ffd700','#ffaa00','#fff5c0','#ff8800'] : (petLevel >= 4 ? ['#ffb088','#ffd700','#fff'] : ['#ffe0d0','#fff','#ffd0b0']);
  for(let i = 0; i < dustCount; i++) {
    setTimeout(() => {
      const d = document.createElement('div');
      d.className = 'entrance-stardust';
      const angle = Math.random() * Math.PI * 2;
      const dist = 60 + Math.random() * 120;
      const cx = petImgEl.offsetWidth / 2;
      const cy = petImgEl.offsetHeight / 2;
      d.style.cssText = `left:${cx}px;top:${cy}px;background:${dustColors[Math.floor(Math.random()*dustColors.length)]};box-shadow:0 0 6px currentColor;--dx:${Math.cos(angle)*dist}px;--dy:${Math.sin(angle)*dist}px;--dur:${0.5+Math.random()*0.7}s;`;
      petImgEl.appendChild(d);
      setTimeout(() => d.remove(), 1500);
    }, i * 50);
  }
  // Remove entrance class after animation
  setTimeout(() => {
    petImgEl.classList.remove(entranceClass);
  }, 1500);
  // Element particles
  const element = _getPetElement(petName);
  spawnAuraParticles(petImgEl, element, petLevel);
  // 3D tilt
  initTiltEffect(petImgEl);
  // Click interaction
  initPetClickInteraction(petImgEl);
  // Animate stats
  setTimeout(() => animatePetStats(petGrowth, expNeeded, petLevel), 300);
}

function spawnAuraParticles(container, element, level) {
  const count = level >= 7 ? 14 : (level >= 4 ? 10 : 6);
  for(let i = 0; i < count; i++) {
    const p = document.createElement('div');
    p.className = 'aura-particle ' + element;
    const dur = 2 + Math.random() * 3;
    const delay = Math.random() * 3;
    let extra = '';
    if(element === 'nature') {
      const leaves = ['🍃','🌿','🍂','🌸','✨'];
      p.textContent = leaves[Math.floor(Math.random() * leaves.length)];
    }
    if(element === 'fire' || element === 'sparkle') {
      const dx = (Math.random() - 0.5) * 60;
      const dy = -(20 + Math.random() * 40);
      extra = `--dx:${dx}px;--dy:${dy}px;`;
    }
    // Position around edges
    const angle = (i / count) * Math.PI * 2;
    const rx = 40 + Math.random() * 15;
    const ry = 40 + Math.random() * 15;
    const x = 50 + rx * Math.cos(angle);
    const y = 50 + ry * Math.sin(angle);
    p.style.cssText += `left:${x}%;top:${y}%;--dur:${dur}s;--delay:${delay}s;${extra}`;
    container.appendChild(p);
  }
}

function initTiltEffect(el) {
  if(_petModalTiltCleanup) _petModalTiltCleanup();
  const glow = document.createElement('div');
  glow.className = 'tilt-glow';
  el.appendChild(glow);

  function onMove(e) {
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const tiltX = (y - 0.5) * -12;
    const tiltY = (x - 0.5) * 12;
    el.style.transform = `perspective(600px) rotateX(${tiltX}deg) rotateY(${tiltY}deg)`;
    const img = el.querySelector('img');
    if(img) img.style.transform = `translateX(${(x-0.5)*-8}px) translateY(${(y-0.5)*-8}px)`;
    glow.style.setProperty('--glow-x', (x*100)+'%');
    glow.style.setProperty('--glow-y', (y*100)+'%');
  }
  function onLeave() {
    el.style.transform = 'perspective(600px) rotateX(0) rotateY(0)';
    const img = el.querySelector('img');
    if(img) img.style.transform = '';
  }
  el.addEventListener('mousemove', onMove);
  el.addEventListener('mouseleave', onLeave);
  _petModalTiltCleanup = () => {
    el.removeEventListener('mousemove', onMove);
    el.removeEventListener('mouseleave', onLeave);
  };
}

function initPetClickInteraction(el) {
  let longPressTimer = null;
  let isLongPress = false;

  el.style.cursor = 'pointer';
  el.addEventListener('mousedown', (e) => {
    isLongPress = false;
    longPressTimer = setTimeout(() => {
      isLongPress = true;
      // Spin reveal
      el.classList.remove('pet-click-bounce');
      void el.offsetWidth;
      el.classList.add('pet-spin-show');
      // Sparkle burst
      for(let i = 0; i < 16; i++) {
        const s = document.createElement('div');
        s.className = 'click-sparkle-burst';
        const angle = (i / 16) * Math.PI * 2;
        const dist = 40 + Math.random() * 60;
        const colors = ['#ffd700','#ff6b6b','#aa88ff','#66ddff','#88ff88'];
        s.style.cssText = `left:50%;top:50%;background:${colors[i%colors.length]};box-shadow:0 0 6px ${colors[i%colors.length]};--sx:${Math.cos(angle)*dist}px;--sy:${Math.sin(angle)*dist}px;`;
        el.appendChild(s);
        setTimeout(() => s.remove(), 800);
      }
      setTimeout(() => el.classList.remove('pet-spin-show'), 1100);
    }, 500);
  });
  el.addEventListener('mouseup', () => {
    clearTimeout(longPressTimer);
    if(!isLongPress) {
      // Short click: bounce + hearts
      el.classList.remove('pet-spin-show');
      el.classList.remove('pet-click-bounce');
      void el.offsetWidth;
      el.classList.add('pet-click-bounce');
      const hearts = ['❤️','💖','💕','🧡','💛','💚','💙','💜'];
      for(let i = 0; i < 5; i++) {
        const h = document.createElement('div');
        h.className = 'click-heart-float';
        h.textContent = hearts[Math.floor(Math.random() * hearts.length)];
        h.style.cssText = `left:${20+Math.random()*60}%;top:${30+Math.random()*40}%;animation-delay:${i*0.08}s;`;
        el.appendChild(h);
        setTimeout(() => h.remove(), 1200);
      }
      setTimeout(() => el.classList.remove('pet-click-bounce'), 600);
    }
  });
  el.addEventListener('mouseleave', () => clearTimeout(longPressTimer));
}

function animatePetStats(growth, expNeeded, level) {
  // Growth progress bar
  const progBar = document.querySelector('.modal-growth-progress');
  if(progBar) {
    const fill = progBar.querySelector('.stat-progress-fill');
    if(fill) {
      const pct = expNeeded > 0 ? Math.min(100, (growth / expNeeded) * 100) : 100;
      setTimeout(() => { fill.style.width = pct + '%'; }, 100);
    }
  }
  // Number bounce on level
  const lvNum = document.querySelector('.modal-level-num');
  if(lvNum) {
    setTimeout(() => lvNum.classList.add('num-bounce'), 400);
  }
  // Coin shake
  const coinEl = document.querySelector('.modal-coin-val');
  if(coinEl) {
    coinEl.classList.add('coin-shake');
  }
  // Crown spin for max level
  if(level >= 9) {
    const crown = document.querySelector('.modal-crown-icon');
    if(crown) crown.classList.add('crown-spin');
  }
  // Hunger pulse
  const hungerEl = document.querySelector('.modal-hunger-warn');
  if(hungerEl) {
    const txt = hungerEl.textContent;
    if(txt.includes('🔴') || txt.includes('🟠')) {
      hungerEl.classList.add('hunger-pulse');
    }
  }
}

function cleanupPetModalEffects() {
  if(_petModalTiltCleanup) { _petModalTiltCleanup(); _petModalTiltCleanup = null; }
}
/* ===== END ENHANCED PET MODAL JS ===== */

function showModal(title,content,actions=[],large=false,extraClass=''){const c=document.getElementById('modalContainer'),m=document.createElement('div');m.className='modal-overlay';const modalClass=extraClass?extraClass:(large?'large':'');m.innerHTML=`<div class="modal ${modalClass}"><div class="modal-title">${esc(title)}</div><div class="modal-content">${content}</div><div class="modal-actions">${actions.map(a=>`<button class="btn ${a.class||'btn-primary'}" onclick="playClickSound(); ${a.onclick}">${esc(a.text)}</button>`).join('')}</div></div>`;c.appendChild(m);m.addEventListener('click',(e)=>{if(e.target===m)closeModal();});return m;}
function closeModal(){const c=document.getElementById('modalContainer');while(c.firstChild)c.removeChild(c.firstChild);currentModalStudentId=null; stopAllHeartEmitters(); cleanupPetModalEffects(); }
function saveClassData(){safeLSSave('classPetData', classesData); scheduleFileSave(); triggerRealtimeSync();}
function saveDeletedClasses(){safeLSSave('deletedClasses', deletedClasses); scheduleFileSave();}
function showDeletedClassesModal(){if(deletedClasses.length===0){showModal('🗑️ 已删除班级','<div style="text-align:center;padding:20px;">暂无已删除的班级</div>',[{text:'关闭',onclick:'closeModal()'}],false);return;}let html='<div style="max-height:400px;overflow:auto;">';[...deletedClasses].reverse().forEach((cls,i)=>{const time=new Date(cls.deletedAt).toLocaleString();const stuCount=cls.students?cls.students.length:0;const petCount=cls.students?cls.students.reduce((s,stu)=>s+(stu.pets?.length||0),0):0;html+=`<div class="history-log-item"><div><div class="history-log-time">${time} 删除</div><div><strong>${esc(cls.name)}</strong></div><div style="font-size:12px;">👨‍🎓 ${stuCount}名学生 · 🐕 ${petCount}只宠物</div></div><div style="display:flex;gap:6px;"><button class="btn btn-primary" style="padding:6px 12px;" onclick="restoreClass('${cls.id}');closeModal();">恢复</button><button class="btn btn-danger" style="padding:6px 12px;" onclick="permanentDeleteClass('${cls.id}');closeModal();">彻底删除</button></div></div>`;});html+='</div>';showModal('🗑️ 已删除班级',html,[{text:'关闭',onclick:'closeModal()'}],true);}
function restoreClass(id){const idx=deletedClasses.findIndex(c=>c.id===id);if(idx===-1){showNotification('恢复失败','未找到该班级数据','error');return;}const cls=deletedClasses[idx];const restored={id:cls.id,name:cls.name,students:JSON.parse(JSON.stringify(cls.students))};if(classesData.find(c=>c.id===restored.id)){restored.id=Date.now().toString();}classesData.push(restored);deletedClasses.splice(idx,1);saveClassData();saveDeletedClasses();currentClassId=restored.id;renderClassList();scheduleAllRenders();showNotification('恢复成功',`班级【${cls.name}】已恢复`,'success');}
function permanentDeleteClass(id){if(!confirm('彻底删除后将无法恢复，确定？'))return;const idx=deletedClasses.findIndex(c=>c.id===id);if(idx!==-1){const name=deletedClasses[idx].name;deletedClasses.splice(idx,1);saveDeletedClasses();showNotification('已彻底删除',`班级【${name}】已永久删除`,'info');showDeletedClassesModal();}}
function renderClassList(){ const c=document.getElementById('classListContainer'); if(!c){console.warn('[DAL] renderClassList: classListContainer not found');return;} if(classesData.length===0){c.innerHTML='<div style="text-align:center;padding:20px;">暂无班级，点击新建</div>';return;} c.innerHTML=''; classesData.forEach((cls,idx)=>{const card=document.createElement('div');card.className=`class-card ${currentClassId===cls.id?'active':''}`;card.draggable=true;card.dataset.classIdx=idx;card.innerHTML=`<button class="delete-class-btn" onclick="event.stopPropagation(); deleteClass('${cls.id}')">×</button><div class="class-name">${esc(cls.name)}</div><div style="display:flex;gap:15px;"><div>👨‍🎓 ${cls.students.length}</div><div>🐕 ${cls.students.reduce((s,stu)=>s+(stu.pets?.length||0),0)}</div></div>`;card.onclick=()=>{selectClass(cls.id);};card.addEventListener('dragstart',classDragStart);card.addEventListener('dragend',classDragEnd);card.addEventListener('dragover',classDragOver);card.addEventListener('dragleave',classDragLeave);card.addEventListener('drop',classDrop);c.appendChild(card);});}
let classDragIdx=null;
function classDragStart(e){classDragIdx=+this.dataset.classIdx;this.classList.add('dragging');e.dataTransfer.effectAllowed='move';}
function classDragEnd(e){this.classList.remove('dragging');classDragIdx=null;document.querySelectorAll('.class-card.drag-over').forEach(el=>el.classList.remove('drag-over'));}
function classDragOver(e){e.preventDefault();e.dataTransfer.dropEffect='move';if(+this.dataset.classIdx!==classDragIdx)this.classList.add('drag-over');}
function classDragLeave(e){this.classList.remove('drag-over');}
function classDrop(e){e.preventDefault();this.classList.remove('drag-over');const toIdx=+this.dataset.classIdx;if(classDragIdx===null||classDragIdx===toIdx)return;const moved=classesData.splice(classDragIdx,1)[0];classesData.splice(toIdx,0,moved);saveClassData();renderClassList();}
function selectClass(id){currentClassId=id;renderClassList();scheduleAllRenders();showNotification('班级切换','已切换','info');}
function createClass(){const n=prompt('班级名称');if(!n)return;
  // 检查数据库是否已存在同名班级（跨所有教师）
  if(typeof db!=='undefined'&&db){
    db.from('classes').select('id,name,teacher_id').eq('name',n.trim()).limit(1).then(function(r){
      if(r.error){console.error('[创建班级] 查询失败:',r.error.message);showNotification('创建失败','数据库查询错误，请重试','error');return;}
      if(r.data&&r.data.length>0){
        // 找到同名班级，检查是否是当前教师自己的
        const existingClass=r.data[0];
        if(existingClass.teacher_id===currentUser.id){
          showNotification('创建失败','你已经有同名班级「'+n.trim()+'」，请使用不同的名称','error');
        }else{
          showNotification('创建失败','系统中已存在班级「'+n.trim()+'」，为避免数据混乱，请使用不同的班级名称','error');
        }
        return;
      }
      // 没有同名班级，可以创建
      classesData.push({id:Date.now().toString(),name:n.trim(),students:[]});
      saveClassData();renderClassList();selectClass(classesData[classesData.length-1].id);
    });
  }else{
    // 离线模式：只检查本地
    if(classesData.some(c=>c.name===n.trim())){showNotification('创建失败','本地已有同名班级','error');return;}
    classesData.push({id:Date.now().toString(),name:n.trim(),students:[]});
    saveClassData();renderClassList();selectClass(classesData[classesData.length-1].id);
  }
}
function deleteClass(id){if(confirm('确定删除该班级？删除后可在"已删除班级"中恢复')){const cls=classesData.find(c=>c.id===id);if(cls){const snapshot={id:cls.id,name:cls.name,students:JSON.parse(JSON.stringify(cls.students)),deletedAt:new Date().toISOString()};deletedClasses.push(snapshot);if(deletedClasses.length>20)deletedClasses.shift();saveDeletedClasses();}classesData=classesData.filter(c=>c.id!==id);if(currentClassId===id)currentClassId=classesData[0]?.id||null;saveClassData();renderClassList();scheduleAllRenders();showNotification('班级已删除','可在"已删除班级"中恢复','info');}}
function importFromTxt(){document.getElementById('txtImport').click();}
document.getElementById('txtImport').addEventListener('change',function(e){if(!currentClassId){showNotification('请先选择班级','','error');return;}const file=e.target.files[0];if(!file)return;const reader=new FileReader();reader.onload=function(ev){const text=ev.target.result;const names=text.split(/\r?\n/).filter(n=>n.trim());const cur=classesData.find(c=>c.id===currentClassId);names.forEach(name=>{if(!cur.students.find(s=>s.name===name.trim()))cur.students.push({id:_genLocalId(),name:name.trim(),coins:50,pets:[],lastCheckinDate:null,activePetId:null,pkCountToday:0,lastPkDate:null});});saveClassData();scheduleAllRenders();showNotification('导入成功',`添加${names.length}人`,'success');};reader.readAsText(file);this.value='';});
function classDailyCheckin(){ if(!currentClassId){showNotification('请先选择班级','请在左侧选择一个班级后再打卡','warning');return;} if(checkPauseAndNotify())return; const cur=classesData.find(c=>c.id===currentClassId); if(!cur){showNotification('班级数据异常','未找到当前班级数据','error');return;} if(!cur.students||cur.students.length===0){showNotification('暂无学生','请先添加学生','warning');return;} let checkedCount=0; let skipNoPet=0; cur.students.forEach(s=>{if(!s.pets||s.pets.length===0){skipNoPet++;return;} if(_hasCheckedInToday(s)){return;} s.coins+=10;s.lastCheckinDate=new Date().toISOString();recordAction(s.id, s.name, '全班打卡', '+10金币', 10, 0, null);checkedCount++;}); if(checkedCount===0){let reason='全班同学今天都已经打过卡了'; if(skipNoPet>0) reason+=`（${skipNoPet}人未领养宠物，不参与打卡）`; showNotification('今日已打卡',reason,'info');return;} saveClassData(); renderHomePetGrid(); if(currentModalStudentId) refreshCurrentStudentModal(); let msg=`${checkedCount}人打卡成功，每人+10金币`; if(skipNoPet>0) msg+=`（${skipNoPet}人未领养宠物，已跳过）`; showNotification('全班打卡',msg,'success'); }
function classAllFeed(){ if(!currentClassId){showNotification('请先选择班级','请在左侧选择一个班级后再喂食','warning');return;} if(checkPauseAndNotify())return; const cur=classesData.find(c=>c.id===currentClassId); if(!cur){showNotification('班级数据异常','未找到当前班级数据','error');return;} if(!cur.students||cur.students.length===0){showNotification('暂无学生','请先添加学生','warning');return;} let fedCount=0,skipDead=0,skipCoins=0,skipMax=0,skipNoPet=0,skipFed=0; const upgrades=[]; cur.students.forEach(s=>{const pet=getGrowablePet(s); if(!pet && (!s.pets||s.pets.length===0)){skipNoPet++;return;} if(!pet && s.pets.every(p=>p.level>=9)){skipMax++;return;} if(!pet && s.pets.every(p=>p.isDead)){skipDead++;return;} if(!pet){skipMax++;return;} if(_hasFedToday(pet)){skipFed++;return;} if(s.coins<5){skipCoins++;return;} let gain=2; pet.growth+=gain; s.coins-=5; pet.lastFeedDate=new Date().toISOString(); const upResult=updatePetLevel(s, pet.id, gain, true); if(upResult) upgrades.push(upResult); recordAction(s.id, s.name, '全班喂食', `${pet.nickname||pet.name} +${gain}成长值`, -5, gain, pet.id); fedCount++;}); if(fedCount===0){let reason=''; if(skipFed>0)reason+=`${skipFed}人今天已喂食 `; if(skipDead>0)reason+=`${skipDead}人宠物已死亡 `; if(skipCoins>0)reason+=`${skipCoins}人金币不足 `; if(skipMax>0)reason+=`${skipMax}人全部满级 `; if(skipNoPet>0)reason+=`${skipNoPet}人未领养宠物`; showNotification('无法喂食',reason||'没有可喂食的宠物','info');return;} saveClassData(); scheduleAllRenders(); if(currentModalStudentId) refreshCurrentStudentModal(); let msg=`${fedCount}只宠物喂食成功，每只+2成长值，-5金币`; if(skipFed+skipDead+skipCoins+skipMax+skipNoPet>0){let skips=[]; if(skipFed>0)skips.push(`${skipFed}人今天已喂食`); if(skipDead>0)skips.push(`${skipDead}人宠物已死亡`); if(skipCoins>0)skips.push(`${skipCoins}人金币不足`); if(skipMax>0)skips.push(`${skipMax}人全部满级`); if(skipNoPet>0)skips.push(`${skipNoPet}人未领养宠物`); msg+=`（跳过：${skips.join('、')}）`;} showNotification('全班喂食',msg,'success'); showBatchUpgradeNotice(upgrades); }
function showBatchUpgradeNotice(upgrades){ if(!upgrades||upgrades.length===0) return; const INTERVAL=4500; const MAX_INDIVIDUAL=3; function showOne(idx){ if(idx>=upgrades.length) return; const u=upgrades[idx]; showUpgradeEffect(u.petRealName, u.newLevel, u.cfgId, u.petName, u.oldLevel, u.studentName); setTimeout(()=>{ showNotification('🎉 宠物升级',`恭喜 ${u.studentName} 同学的 ${u.petName} 进化为${u.stageName}！`,'success'); },300); if(idx+1<upgrades.length){ setTimeout(()=>{ const container=document.getElementById('upgradeEffectContainer'); if(container){const overlays=container.querySelectorAll('.upgrade-overlay'); overlays.forEach(o=>o.remove());} showOne(idx+1); }, INTERVAL); } } if(upgrades.length<=MAX_INDIVIDUAL){ if(upgrades.length>1){ showNotification('🎉 升级预告',`本次共有 ${upgrades.length} 位同学的宠物升级，逐一展示！`,'success'); setTimeout(()=>showOne(0), 800); } else { showOne(0); } } else { showBatchUpgradeBoard(upgrades); } } function showBatchUpgradeBoard(upgrades){ const container=document.getElementById('upgradeEffectContainer'); const overlay=document.createElement('div'); overlay.className='upgrade-overlay'; overlay.style.cssText='position:fixed;top:0;left:0;right:0;bottom:0;z-index:100000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.7);backdrop-filter:blur(4px);animation:fadeIn 0.5s ease;'; const listHtml=upgrades.map((u,i)=>{ const cfg=PET_CONFIG[Object.keys(PET_CONFIG).find(k=>PET_CONFIG[k].id===u.cfgId)]; const emoji=cfg?cfg.emoji:'🐾'; const imgSrc=_img(`${u.cfgId}/${u.newLevel}.webp`); return `<div style="display:flex;align-items:center;gap:12px;padding:10px 18px;background:rgba(255,255,255,0.08);border-radius:14px;border:1px solid rgba(255,255,255,0.15);animation:fadeIn 0.5s ease ${i*0.08}s both;"><div style="width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg,#ffe0b2,#ffcc80);display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden;"><img src="${imgSrc}" style="width:40px;height:40px;object-fit:contain;" onerror="this.onerror=null;this.parentNode.innerHTML='<span style=\\'font-size:28px;\\'>${emoji}</span>';"></div><div style="flex:1;min-width:0;"><div style="font-size:16px;font-weight:700;color:#fff;">${esc(u.studentName)}</div><div style="font-size:13px;color:rgba(255,255,255,0.7);margin-top:2px;">${esc(u.petName)} → ${esc(u.stageName)}</div></div><div style="font-size:22px;">🎉</div></div>`; }).join(''); overlay.innerHTML=` <div style="background:linear-gradient(160deg,#1a1a2e 0%,#16213e 50%,#0f3460 100%);border-radius:28px;padding:35px 30px;max-width:520px;width:90%;max-height:80vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,0.5),inset 0 1px 0 rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.1);position:relative;overflow:hidden;"> <div style="position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,#e8637a,#f5a054,#ffd700,#e8637a);background-size:200% 100%;animation:shimmer 2s linear infinite;"></div> <div style="text-align:center;margin-bottom:20px;"> <div style="font-size:36px;margin-bottom:6px;">🏆✨🎊</div> <div style="font-size:24px;font-weight:800;color:#ffd700;text-shadow:0 0 20px rgba(255,215,0,0.4);">集体进化大成功！</div> <div style="font-size:15px;color:rgba(255,255,255,0.7);margin-top:6px;">恭喜以下 <strong style="color:#ff9800;font-size:18px;">${upgrades.length}</strong> 位同学的宠物升级</div> </div> <div style="flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:8px;padding-right:5px;min-height:0;"> ${listHtml} </div> <div style="text-align:center;margin-top:18px;padding-top:15px;border-top:1px solid rgba(255,255,255,0.1);"> <button onclick="this.closest('.upgrade-overlay').remove();" style="padding:10px 36px;border:none;border-radius:20px;background:linear-gradient(135deg,#e8637a,#f5a054);color:#fff;font-size:15px;font-weight:600;cursor:pointer;box-shadow:0 4px 15px rgba(232,99,122,0.4);transition:transform 0.2s;">太棒了！为他们鼓掌 👏</button> </div> </div>`; container.appendChild(overlay); overlay.addEventListener('click',(e)=>{if(e.target===overlay)overlay.remove();}); setTimeout(()=>{if(overlay.parentNode)overlay.remove();},15000); playUpgradeSound(); }
function clearPetData(){ if(!currentClassId) return; if(!confirm('重置所有宠物数据？')) return; const cur = classesData.find(c=>c.id===currentClassId); if(!cur) return; const snapshot = JSON.parse(JSON.stringify(cur.students)); cur.students.forEach(s=>{ s.pets = []; s.coins = 50; s.lastCheckinDate = null; s.activePetId = null; s.pkCountToday = 0; s.lastPkDate = null; }); saveClassData(); recordResetAction(cur.id, cur.name, snapshot); scheduleAllRenders(); if(currentModalStudentId) closeModal(); showNotification('重置完成','宠物数据已清空','success'); }

// === 重置学生密码弹窗（教师专用）===
var _resetPwdSelectedStudentId = null;
function showResetPasswordModal() {
  const cur = classesData.find(c => c.id === currentClassId);
  if (!cur || cur.students.length === 0) {
    showNotification('无法重置', '当前班级没有学生', 'warning');
    return;
  }
  _resetPwdSelectedStudentId = null;
  _renderResetPasswordModal(cur.students, null);
}

function _renderResetPasswordModal(students, selectedId) {
  var html = '<div style="position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;" id="resetPasswordModal">';
  html += '<div style="background:#fff;border-radius:20px;padding:24px;width:1100px;max-width:95vw;height:650px;max-height:90vh;display:flex;flex-direction:column;box-shadow:0 12px 40px rgba(0,0,0,0.3);">';

  // Header
  html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">';
  html += '<div style="font-size:18px;font-weight:700;">🔑 重置学生密码</div>';
  html += '<button onclick="closeResetPasswordModal()" style="background:none;border:none;font-size:24px;cursor:pointer;color:#999;">×</button>';
  html += '</div>';

  // Description
  html += '<div style="font-size:13px;color:#888;margin-bottom:14px;">点击学生姓名选中，然后点击「重置密码」按钮。重置后该学生下次登录时可重新设置新密码，所有游戏记录不会丢失。</div>';

  // Student list
  html += '<div style="display:flex;flex-wrap:wrap;gap:6px;flex:1;min-height:0;overflow-y:auto;border:1.5px solid rgba(255,210,200,0.6);border-radius:18px;padding:12px;margin-bottom:14px;background:#fffaf5;align-content:flex-start;">';
  students.forEach(function(stu) {
    var isSelected = selectedId && selectedId.toString() === stu.id.toString();
    var bgColor = isSelected ? '#e8ffe8' : '#fff';
    var borderColor = isSelected ? '#52c41a' : '#ffe2d6';
    html += '<div onclick="onResetPwdStudentClick(' + stu.id + ')" id="resetPwdStu_' + stu.id + '" style="display:flex;align-items:center;padding:5px 10px;border:1.5px solid ' + borderColor + ';border-radius:12px;gap:6px;background:' + bgColor + ';font-size:14px;white-space:nowrap;cursor:pointer;transition:all 0.15s;">';
    if (isSelected) {
      html += '<span style="width:16px;height:16px;border-radius:50%;background:#52c41a;color:#fff;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:bold;flex-shrink:0;">✓</span>';
    } else {
      html += '<span style="width:16px;height:16px;border-radius:50%;border:1.5px solid #ddd;flex-shrink:0;"></span>';
    }
    html += '<span style="font-weight:600;">' + esc(stu.name || '未命名') + '</span>';
    html += '<span style="font-size:12px;color:#999;">💰' + (stu.coins || 0) + '</span>';
    html += '</div>';
  });
  html += '</div>';

  // Bottom action area
  html += '<div id="resetPwdActionWrap" style="margin-bottom:10px;text-align:center;' + (selectedId ? '' : 'display:none;') + '">';
  if (selectedId) {
    var selStudent = students.find(function(s) { return s.id.toString() === selectedId.toString(); });
    if (selStudent) {
      html += '<div style="font-size:13px;color:#555;margin-bottom:8px;">已选中：<strong style="color:#d4760a;">' + esc(selStudent.name) + '</strong></div>';
    }
    html += '<div style="display:flex;gap:10px;justify-content:center;">';
    html += '<button onclick="confirmResetPassword()" style="background:linear-gradient(135deg,#ff9800,#f57c00);color:#fff;border:none;border-radius:14px;padding:13px 36px;font-size:17px;font-weight:700;cursor:pointer;box-shadow:0 4px 14px rgba(255,152,0,0.4);transition:all 0.2s;flex:1;max-width:200px;" onmouseenter="this.style.transform=\'scale(1.02)\'" onmouseleave="this.style.transform=\'scale(1)\'">🔑 重置密码</button>';
    html += '<button onclick="cancelResetPwdSelection()" style="background:#f0f0f0;color:#666;border:none;border-radius:14px;padding:13px 36px;font-size:17px;font-weight:700;cursor:pointer;flex:1;max-width:200px;">取消</button>';
    html += '</div>';
  }
  html += '</div>';

  // Close button
  html += '<div style="text-align:center;">';
  html += '<button onclick="closeResetPasswordModal()" style="background:#f0f0f0;color:#666;border:none;border-radius:12px;padding:10px 28px;font-size:14px;font-weight:700;cursor:pointer;">关闭</button>';
  html += '</div>';
  html += '</div></div>';

  var container = document.getElementById('modalContainer');
  if (container) container.innerHTML = html;
}

window.onResetPwdStudentClick = function(studentId) {
  _resetPwdSelectedStudentId = parseInt(studentId);
  const cur = classesData.find(c => c.id === currentClassId);
  if (cur) _renderResetPasswordModal(cur.students, studentId);
};

window.cancelResetPwdSelection = function() {
  _resetPwdSelectedStudentId = null;
  const cur = classesData.find(c => c.id === currentClassId);
  if (cur) _renderResetPasswordModal(cur.students, null);
};

window.closeResetPasswordModal = function() {
  var container = document.getElementById('modalContainer');
  if (container) container.innerHTML = '';
  _resetPwdSelectedStudentId = null;
};

window.confirmResetPassword = function() {
  if (!_resetPwdSelectedStudentId) return;
  const cur = classesData.find(c => c.id === currentClassId);
  if (!cur) return;
  const stu = cur.students.find(s => s.id.toString() === _resetPwdSelectedStudentId.toString());
  if (!stu) return;

  if (!confirm('确定要重置学生「' + stu.name + '」的密码吗？\n重置后该学生下次登录时可重新设置新密码，所有游戏记录不会丢失。')) return;

  // Clear the password in local data
  stu.password = '';

  // Save to Supabase directly for immediate effect
  if (typeof db !== 'undefined' && db) {
    db.from('students').update({ password: '' }).eq('id', stu.id).then(function(r) {
      if (r.error) {
        console.error('[重置密码] 保存失败:', r.error.message);
        showNotification('重置失败', r.error.message, 'error');
        return;
      }
      // Also save via normal sync to keep local and remote in sync
      saveClassData();
      showNotification('重置成功', '学生「' + stu.name + '」的密码已重置，下次登录时可设置新密码', 'success');
      closeResetPasswordModal();
    });
  } else {
    saveClassData();
    showNotification('重置成功', '学生「' + stu.name + '」的密码已重置', 'success');
    closeResetPasswordModal();
  }
};
function getActivePet(student){ if(!student.pets || student.pets.length===0) return null; if(student.activePetId && student.pets.some(p=>Number(p.id)===Number(student.activePetId))) return student.pets.find(p=>Number(p.id)===Number(student.activePetId)); return student.pets[0]; }
function getGrowablePet(student){ if(!student.pets || student.pets.length===0) return null; const active=getActivePet(student); if(active && !active.isDead && active.level<9) return active; return student.pets.find(p=>!p.isDead && p.level<9) || null; }
function countMaxedPets(student){ if(!student.pets) return 0; return student.pets.filter(p=>p.level>=9).length; }
function adoptNewPet(student, petName, nickname){ const cfg = PET_CONFIG[petName]; if(!cfg) return false; if(student.pets.length>0 && student.pets.some(p=>p.level<9)){showNotification('无法领养','还有未满级的宠物，需要全部满级后才能领养新宠物','warning');return false;} const newPet = { id: _genLocalId(), name: petName, nickname, level: 1, growth: 0, lastFeedDate: new Date().toISOString(), todayFeedCount: 0, isDead: false, todayPlayCount: 0, lastPlayDate: null, penaltyStreak: 0 }; student.pets.push(newPet); student.activePetId = newPet.id; saveClassData(); scheduleAllRenders(); showNotification('领养成功',`${nickname} 加入宠物大家庭，现已激活！`,'success'); return true; }
function _hasFedToday(pet){
  if(!pet||!pet.lastFeedDate) return false;
  const last=new Date(pet.lastFeedDate);
  const now=new Date();
  return last.getFullYear()===now.getFullYear()&&last.getMonth()===now.getMonth()&&last.getDate()===now.getDate();
}
// v37: Check if student has already checked in today (via lastCheckinDate or operation logs)
function _hasCheckedInToday(student){
  const today = new Date().toDateString();
  
  // Check lastCheckinDate first
  if(student.lastCheckinDate && new Date(student.lastCheckinDate).toDateString() === today){
    return true;
  }
  
  // Also check operation logs as a safety net
  const logs = getOpLogs();
  return logs.some(log => 
    log.studentId == student.id && 
    (log.actionType === '每日打卡' || log.actionType === '全班打卡') && 
    new Date(log.timestamp).toDateString() === today &&
    !log.reverted
  );
}
function feedPet(student, pet){
  if(pet.isDead){showNotification('喂食失败','宠物已经死亡，请先复活','error');return false;}
  if(student.coins<5){showNotification('金币不足','喂食需要5金币','error');return false;}
  if(pet.level >= 9){ showNotification('已达万物之神',`${pet.nickname||pet.name}已满级，快去领养新宠物吧！`,'warning'); return false; }
  if(_hasFedToday(pet)){ showNotification('今日已喂食',`${pet.nickname||pet.name}今天已经喂食过了，每天只能喂食一次哦！`,'info'); return false; }
  let gain=2; // 固定2点成长，不受商店道具影响
  pet.growth+=gain; student.coins-=5; pet.lastFeedDate=new Date().toISOString(); pet.isDead=false;
  updatePetLevel(student, pet.id, gain);
  recordAction(student.id, student.name, '喂食', `${pet.nickname||pet.name} +${gain}成长值`, -5, gain, pet.id);
  showNotification('喂食成功',`${pet.nickname||pet.name} 获得 ${gain} 成长值！`,'success');
  return true;
}
function updatePetLevel(student, petId, growthDelta=0, silent=false) { const pet = student.pets.find(p=>p.id===petId); if(!pet) return false; const cfg = PET_CONFIG[pet.name]; if(!cfg) return false; let oldLevel = pet.level; let newLevel = 1; for(let i=cfg.stages.length-1;i>=0;i--) if(pet.growth>=cfg.stages[i].growthRequired){ newLevel=cfg.stages[i].stage; break; } if(pet.growth < 0) pet.growth = 0; const _maxGrowth = cfg.stages[cfg.stages.length-1].growthRequired; if(newLevel >= 9 && pet.growth > _maxGrowth){ pet.growth = _maxGrowth; } if(newLevel !== oldLevel){ const wasUpgrade = newLevel > oldLevel; pet.level = newLevel; if(newLevel >= 9){ pet.growth = Math.min(pet.growth, _maxGrowth); } const stageName = cfg.stages[newLevel-1]?.stageName||`阶段${newLevel}`; if(wasUpgrade && !silent){ showUpgradeEffect(pet.name, newLevel, cfg.id, pet.nickname||pet.name, oldLevel, student.name); showNotification('宠物升级',`🎉 恭喜 ${student.name} 同学的 ${pet.nickname||pet.name} 升到${stageName}！`,'success'); } if(!silent){ scheduleAllRenders(); if(currentModalStudentId && student.id.toString()===currentModalStudentId.toString()) refreshCurrentStudentModal(); } return {studentName:student.name, petName:pet.nickname||pet.name, petRealName:pet.name, newLevel:newLevel, oldLevel:oldLevel, stageName:stageName, cfgId:cfg.id, isUpgrade:wasUpgrade}; } return false; }
function getStudentShopEffects(student){
  const owned=student.shopItems||[];if(owned.length===0)return{borderClasses:[],topHtml:'',baseHtml:'',particleHtml:'',titleHtml:'',sceneClass:''};
  const eq=getEquippedItems(student);
  const borderClasses=[];let topHtml='',baseHtml='',particleHtml='',titleHtml='',sceneClass='';
  const topEmojis={'pet-top-halo':'😇','pet-top-crown':'👑','pet-top-bow':'🎀','pet-top-horns':'😈','pet-top-flower':'🌸'};
  const ptclEmojis={'pet-ptcl-hearts':'💕','pet-ptcl-stars':'⭐','pet-ptcl-snow':'❄️','pet-ptcl-sakura':'🌸','pet-ptcl-firefly':'','pet-ptcl-thunder':''};
  const titleNames={'pet-title-xueba':'学霸','pet-title-juanwang':'卷王','pet-title-wulin':'武林盟主','pet-title-dragon':'真龙天子','pet-title-legend':'不朽传说'};
  // Only render effects for equipped items
  const equippedIds=Object.values(eq).filter(id=>owned.includes(id));
  equippedIds.forEach(id=>{const item=getShopItemById(id);if(!item||!item.css)return;const css=item.css;
    if(css.startsWith('pet-border-'))borderClasses.push(css);
    else if(css.startsWith('pet-top-'))topHtml=`<div class="shop-top-accessory ${css}">${topEmojis[css]||'✨'}</div>`;
    else if(css.startsWith('pet-base-'))baseHtml=`<div class="shop-base-effect ${css}"></div>`;
    else if(css.startsWith('pet-ptcl-')){const e=ptclEmojis[css];const dots=Array.from({length:6},()=>`<span class="sp">${e}</span>`).join('');particleHtml=`<div class="shop-particles ${css}">${dots}</div>`;}
    else if(css.startsWith('pet-title-'))titleHtml=`<div class="shop-title-badge ${css}">${titleNames[css]||''}</div>`;
    else if(css.startsWith('pet-scene-'))sceneClass=css;
  });return{borderClasses,topHtml,baseHtml,particleHtml,titleHtml,sceneClass};
}
/* ===== 一键排序功能 ===== */
// 每个班级独立的排序模式: { classId: mode } mode: 0=默认(不排序), 1=按特效数量, 2=按成长值, 3=按金币
const _SORT_LABELS = ['🔀 一键排序', '🔀 按特效数↓', '🔀 按成长值↓', '🔀 按金币↓'];
const _SORT_STORAGE_KEY = 'petSortModes';

function _loadSortModes() {
  try {
    var saved = localStorage.getItem(_SORT_STORAGE_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch(e) { return {}; }
}

function _saveSortModes() {
  try { localStorage.setItem(_SORT_STORAGE_KEY, JSON.stringify(_petSortModes)); } catch(e) {}
}

let _petSortModes = _loadSortModes();

function _countEquippedEffects(student) {
  const eq = student.equippedItems || {};
  const owned = student.shopItems || [];
  return Object.values(eq).filter(id => owned.includes(id)).length;
}

function _getPetGrowth(student) {
  const pet = getActivePet(student);
  return pet ? (pet.growth || 0) : 0;
}

function _hasPet(student) {
  return student.pets && student.pets.length > 0;
}

function _isTeacher() {
  return typeof currentUser !== 'undefined' && currentUser && currentUser.type === 'teacher';
}

function cycleSortPets() {
  if (!currentClassId || !_isTeacher()) return;
  var currentMode = _petSortModes[currentClassId] || 0;
  var newMode = (currentMode % 3) + 1; // cycle: 1→2→3→1
  _petSortModes[currentClassId] = newMode;
  _saveSortModes();
  var btn = document.getElementById('sortPetsBtn');
  if (btn) btn.innerHTML = '<span>' + _SORT_LABELS[newMode].split(' ')[0] + '</span> ' + _SORT_LABELS[newMode].split(' ').slice(1).join(' ');
  renderHomePetGrid();
  const modeNames = ['', '特效数量', '成长值', '金币'];
  showNotification('排序已切换', '当前按' + modeNames[newMode] + '从多到少排序', 'info');
}
window.cycleSortPets = cycleSortPets;

function _getSortedStudents(students, mode) {
  var arr = students.slice(); // shallow copy, don't mutate original
  if (mode === 1) {
    // 按特效数量从多到少，未领养宠物的学生排最后
    var withPets = arr.filter(_hasPet);
    var noPets = arr.filter(function(s) { return !_hasPet(s); });
    withPets.sort(function(a, b) { return _countEquippedEffects(b) - _countEquippedEffects(a); });
    arr = withPets.concat(noPets);
  } else if (mode === 2) {
    // 按成长值从多到少，未领养宠物的学生排最后
    var withPets = arr.filter(_hasPet);
    var noPets = arr.filter(function(s) { return !_hasPet(s); });
    withPets.sort(function(a, b) { return _getPetGrowth(b) - _getPetGrowth(a); });
    arr = withPets.concat(noPets);
  } else if (mode === 3) {
    // 按金币持有量从多到少，未领养宠物的学生排最后
    var withPets = arr.filter(_hasPet);
    var noPets = arr.filter(function(s) { return !_hasPet(s); });
    withPets.sort(function(a, b) { return (b.coins || 0) - (a.coins || 0); });
    arr = withPets.concat(noPets);
  }
  return arr;
}

/* ===== 无限滚动：分批渲染宠物卡片 ===== */
let _gridStudents=[], _gridRenderedCount=0;
const _GRID_BATCH_SIZE=12;
let _gridObserver=null, _gridBatchBusy=false;

/* 快速计算学生数据哈希，用于 DOM diff 判断卡片是否需要更新 */
function _studentDataHash(s) {
  var p = getActivePet(s);
  if (!p) return s.id + '_nopet_' + (s.coins||0);
  return s.id + '_' + (s.coins||0) + '_' + (p.id||'') + '_' + (p.growth||0) + '_' + (p.level||0) + '_' + (p.isDead?'d':'a') + '_' + (p.lastFeedDate||'') + '_' + (s.pets?s.pets.length:0);
}

function _generateStudentCardHTML(s){
  updatePetDeathStatus(s);const activePet = getActivePet(s);
  if(activePet){const p=activePet; const need=getExpNeeded(p); const lastDate=p.lastFeedDate?new Date(p.lastFeedDate):null; let timeTip=''; if(p.level>=9){timeTip='👑 已满级';}else if(isPauseActive()){timeTip='🛡️ 假期保护中';}else if(!p.isDead&&lastDate){if(_hasFedToday(p)){timeTip='✅ 今日已喂食';}else{const hours=getEffectiveUnfedHours(p); timeTip=hours<24?`⏰ ${Math.floor(hours)}小时前喂`:hours>=1440?`🔴 ${Math.floor(hours/24)}天未喂`:`⚠️ ${Math.floor(hours/24)}天未喂`;}}else if(p.isDead)timeTip='💀 已饿死';
  const maxed=countMaxedPets(s); const totalPets=s.pets.length; const hasLegend=maxed>0; const isPetMax=p.level>=9; const fx=getStudentShopEffects(s); const cardClass='home-pet-card'; const innerClass='home-pet-inner'+(hasLegend?' has-legend':'')+(isPetMax?' pet-maxed':'')+(fx.borderClasses.length?' '+fx.borderClasses.join(' '):'');
  let multiBadge=''; if(totalPets>1) multiBadge=`<div class="multi-pet-badge multi">🐾×${totalPets}</div>`;
  const growable=getGrowablePet(s); const growHint=(p.level>=9 && growable && growable.id!==p.id)?`<div class="growable-pet-hint">🌱 ${esc(growable.nickname||growable.name)} 培养中</div>`:(p.level>=9 && !growable)?`<div class="growable-pet-hint">⭐ 全部满级</div>`:'';
  // 检查宠物是否正在出逃（用于DOM重建时保持出逃状态）
  const isEscaped = window._escapedPetIds && window._escapedPetIds.has(String(p.id));
  const petImgStyle = isEscaped ? 'opacity:0;transition:opacity 0.3s;' : '';
  const petImgAttr = isEscaped ? 'data-escape-hidden="1"' : '';
  const escapeHint = isEscaped ? '<div class="escape-empty-hint" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:13px;color:#cba090;font-weight:700;pointer-events:none;text-align:center;line-height:1.6;">🐾<br>出逃中…</div>' : '';
  return `<div class="${cardClass}" data-sid="${s.id}" data-hash="${_studentDataHash(s)}" onclick="openStudentModal('${s.id}')">${fx.topHtml}<div class="${innerClass}">${fx.particleHtml}${p.level<2?`<button class="change-pet-btn" onclick="event.stopPropagation();showChangePetModal('${s.id}')">🔄</button>`:''}${s.pets.length>1?`<button class="switch-pet-btn" onclick="event.stopPropagation();showSwitchPetModal('${s.id}')">🔀 切换</button>`:''}<div class="home-pet-top${fx.sceneClass?' '+fx.sceneClass:''}"><div style="position:relative;width:100%;height:100%;display:flex;align-items:center;justify-content:center;">${fx.baseHtml}${getPetImage(p.name, p.level||1).replace('<img ', `<img style="${petImgStyle}" ${petImgAttr} `)}${p.isDead?'<div class="dead-pet-overlay">💀</div>':''}${escapeHint}</div></div><div class="home-pet-level-badge">${isPetMax?'👑 MAX':'Lv.'+(p.level||1)}</div>${multiBadge}${fx.titleHtml}<div class="home-pet-middle">${esc(s.name)}·${esc(p.nickname||p.name)}<span class="rename-pet-btn" onclick="event.stopPropagation();renamePet('${s.id}','${p.id}')" title="修改宠物名字">✏️</span></div><div class="home-pet-bottom"><div class="home-pet-bottom-row"><span class="pet-bottom-growth">成长:${p.level>=9?need:(p.growth||0)}/${need}</span><span class="pet-bottom-coins">💰${s.coins||0}</span></div><div class="feed-warning">${timeTip}</div>${growHint}</div></div></div>`;
  }else{return `<div class="home-pet-card" data-sid="${s.id}" data-hash="${_studentDataHash(s)}" onclick="showAdoptModal('${s.id}')"><div class="home-pet-inner"><div class="home-pet-top"><div style="position:relative;width:100%;height:100%;display:flex;align-items:center;justify-content:center;">${getEggImage()}</div></div><div class="home-pet-middle">${esc(s.name)}</div><div class="home-pet-bottom"><button class="btn btn-primary btn-small">领养宠物</button></div></div></div>`;}}

function _renderGridBatch(grid){
  if(_gridBatchBusy) return;
  _gridBatchBusy=true;
  const end=Math.min(_gridRenderedCount+_GRID_BATCH_SIZE, _gridStudents.length);
  let html='';
  for(let i=_gridRenderedCount;i<end;i++){html+=_generateStudentCardHTML(_gridStudents[i]);}
  _gridRenderedCount=end;
  grid.insertAdjacentHTML('beforeend',html);
  _applyGridBatchPostProcess();
  _gridBatchBusy=false;
}

function _applyGridBatchPostProcess(){
  document.querySelectorAll('.home-pet-card').forEach(function(card,i){
    card.style.animationDelay=(i%6)*0.5+'s';
    card.style.animationDuration=(2.5+Math.random()*1.5)+'s';
  });
  if(window.__initBreathingDelays) window.__initBreathingDelays();
  if(typeof attachCardHeartListeners==='function') attachCardHeartListeners();
  if(typeof bindPetCardDrag==='function') bindPetCardDrag();
  if(typeof currentUser!=='undefined' && currentUser && currentUser.type==='student'){
    var myId=currentUser.studentId.toString();
    document.querySelectorAll('.home-pet-card').forEach(function(card){
      var onclick=card.getAttribute('onclick')||'';
      if(onclick.indexOf("'"+myId+"'")===-1 && onclick.indexOf('"'+myId+'"')===-1){
        card.querySelectorAll('button').forEach(function(btn){
          var btnOnclick=btn.getAttribute('onclick')||'';
          if(btnOnclick.indexOf('showChangePetModal')!==-1||btnOnclick.indexOf('showSwitchPetModal')!==-1||btnOnclick.indexOf('renamePet')!==-1){btn.style.display='none';}
        });
      }
    });
  }
}

function renderHomePetGrid(){ const grid=document.getElementById('homePetGrid');
  if(_gridObserver){_gridObserver.disconnect();_gridObserver=null;}
  const oldSentinel=document.getElementById('grid-scroll-sentinel');if(oldSentinel)oldSentinel.remove();
  // 控制排序按钮可见性（仅教师可见，包括移动端）
  var _sortBtn = document.getElementById('sortPetsBtn');
  if (_sortBtn) {
    _sortBtn.style.display = _isTeacher() ? '' : 'none';
  }
  // 控制重置密码按钮可见性（仅教师可见，包括移动端）
  var _resetPwdBtn = document.querySelector('.teacher-only');
  if (_resetPwdBtn) {
    _resetPwdBtn.style.display = _isTeacher() ? '' : 'none';
  }
  if(!currentClassId||!classesData.some(c=>c.id===currentClassId)){grid.innerHTML='<div class="empty-deco" style="width:100%;"><div class="empty-deco-img">🏫</div><div class="empty-deco-text">请先选择或创建一个班级</div><div class="empty-deco-sub">点击上方「新建班级」开始你的宠物之旅~</div></div>';return;}
  const cur=classesData.find(c=>c.id===currentClassId);
  if(cur.students.length===0){grid.innerHTML='<div class="empty-deco" style="width:100%;cursor:pointer;" onclick="addSingleStudent()"><div class="empty-deco-img">🐣</div><div class="empty-deco-text">还没有小伙伴呢</div><div class="empty-deco-sub">点击这里添加第一个学生吧~</div></div>';return;}
  // 使用排序模式（仅教师账户下生效）
  var _sortMode = _isTeacher() ? (_petSortModes[currentClassId] || 0) : 0;
  _gridStudents = _sortMode > 0 ? _getSortedStudents(cur.students, _sortMode) : cur.students;
  // 更新排序按钮显示（切换班级时保持正确状态）
  if (_sortBtn && _isTeacher()) {
    var _curMode = _petSortModes[currentClassId] || 0;
    _sortBtn.innerHTML = '<span>' + _SORT_LABELS[_curMode].split(' ')[0] + '</span> ' + _SORT_LABELS[_curMode].split(' ').slice(1).join(' ');
  }
  // === DOM diff: 增量更新卡片，避免全量重建导致闪烁 ===
  var existingCards = {};
  grid.querySelectorAll('.home-pet-card[data-sid]').forEach(function(card) {
    existingCards[card.dataset.sid] = card;
  });
  var newSids = {};
  _gridStudents.forEach(function(s) { newSids[s.id] = true; });
  // 移除不再存在的学生卡片
  Object.keys(existingCards).forEach(function(sid) {
    if (!newSids[sid]) existingCards[sid].remove();
  });
  // 检查是否有需要更新或新增的卡片
  var needsFullRebuild = false;
  var changedSids = [];
  _gridStudents.forEach(function(s) {
    var existing = existingCards[s.id];
    var newHash = _studentDataHash(s);
    if (!existing) {
      needsFullRebuild = true; // 新学生，需要创建卡片
    } else if (existing.dataset.hash !== newHash) {
      changedSids.push(s.id); // 数据变了，需要更新
    }
    // else: hash 相同，跳过
  });
  // 如果没有新增也没有变化，直接返回（最快路径）
  if (!needsFullRebuild && changedSids.length === 0 && Object.keys(existingCards).length === _gridStudents.length) {
    return;
  }
  // 如果有新增卡片或排序变了，做全量重建（保持排序正确）
  if (needsFullRebuild || changedSids.length > 2) {
    _gridRenderedCount = 0; grid.innerHTML = '';
    _renderGridBatch(grid);
    if(_gridRenderedCount<_gridStudents.length){
      const sentinel=document.createElement('div');sentinel.id='grid-scroll-sentinel';sentinel.style.cssText='height:1px;width:100%;';
      grid.parentNode.insertBefore(sentinel,grid.nextSibling);
      if(_gridObserver) _gridObserver.disconnect();
      _gridObserver=new IntersectionObserver((entries)=>{
        if(entries[0].isIntersecting && _gridRenderedCount<_gridStudents.length){
          _renderGridBatch(grid);
          if(_gridRenderedCount>=_gridStudents.length){_gridObserver.disconnect();sentinel.remove();}
        }
      },{rootMargin:'300px'});
      _gridObserver.observe(sentinel);
      requestAnimationFrame(()=>_gridCheckSentinel(grid,sentinel));
    }
  } else {
    // 只更新变化的卡片（少量变化，1-2张卡片）
    changedSids.forEach(function(sid) {
      var oldCard = existingCards[sid];
      if (!oldCard) return;
      var s = _gridStudents.find(function(st) { return st.id == sid; });
      if (!s) return;
      var temp = document.createElement('div');
      temp.innerHTML = _generateStudentCardHTML(s);
      var newCard = temp.firstElementChild;
      if (newCard) oldCard.replaceWith(newCard);
    });
    _gridRenderedCount = _gridStudents.length; // 标记全部已渲染
    _applyGridBatchPostProcess();
  }
}
function _gridCheckSentinel(grid,sentinel){
  if(!sentinel.parentNode||_gridRenderedCount>=_gridStudents.length) return;
  const r=sentinel.getBoundingClientRect();
  if(r.top<window.innerHeight+100){
    _renderGridBatch(grid);
    if(_gridRenderedCount>=_gridStudents.length){if(_gridObserver)_gridObserver.disconnect();sentinel.remove();return;}
    requestAnimationFrame(()=>_gridCheckSentinel(grid,sentinel));
  }
}
/* 满级卡片粒子特效 - 已禁用(防止抖动) */
let _maxedSparkleTimer=null;
function startMaxedSparkles(){
  /* disabled to prevent jittering */
}
const _origRenderHomePetGrid=renderHomePetGrid;
renderHomePetGrid=function(){_origRenderHomePetGrid();startMaxedSparkles();};
startMaxedSparkles();

function getExpNeeded(pet){const cfg=PET_CONFIG[pet.name];if(!cfg)return 0;const nextStage=cfg.stages.find(s=>s.stage===pet.level+1);return nextStage?nextStage.growthRequired:cfg.stages[cfg.stages.length-1].growthRequired;}
function updatePetDeathStatus(student){if(!student.pets||student.pets.length===0)return; if(isPauseActive())return; student.pets.forEach(pet=>{if(pet.isDead)return; if(pet.level>=9)return; if(isPetStarved(pet)){const prevGrowth=pet.growth;const prevLevel=pet.level;pet.isDead=true; pet.deathGrowth=pet.growth; pet.deathDate=new Date().toISOString();recordAction(student.id, student.name, '饿死', `${pet.nickname||pet.name} 因超过70天未喂食而饿死（Lv.${prevLevel}，成长值${prevGrowth}）`, 0, 0, pet.id, {causedDeath:true, prevGrowth:prevGrowth, prevLevel:prevLevel, starvation:true, petSnapshot:{name:pet.name,nickname:pet.nickname,level:prevLevel,growth:prevGrowth,lastFeedDate:pet.lastFeedDate,todayFeedCount:pet.todayFeedCount||0,todayPlayCount:pet.todayPlayCount||0,lastPlayDate:pet.lastPlayDate,penaltyStreak:pet.penaltyStreak||0}});}});}
function isPetStarved(pet){if(!pet.lastFeedDate) return false; const last=new Date(pet.lastFeedDate); const now=new Date(); let pauseMs=calcPauseOverlap(last,now); const realMs=(now-last)-pauseMs; const diffHours=realMs/(1000*3600); return diffHours>=1680;}
function calcPauseOverlap(feedDate,nowDate){if(!currentClassId)return 0;const cur=classesData.find(c=>c.id===currentClassId);if(!cur||!cur.pauseGrowth||!cur.pauseGrowth.start||!cur.pauseGrowth.end)return 0;const ps=new Date(cur.pauseGrowth.start+'T00:00:00');const pe=new Date(cur.pauseGrowth.end+'T23:59:59');const overlapStart=feedDate>ps?feedDate:ps;const overlapEnd=nowDate<pe?nowDate:pe;if(overlapStart>=overlapEnd)return 0;return overlapEnd-overlapStart;}
function getEffectiveUnfedHours(pet){if(!pet.lastFeedDate)return 0;const last=new Date(pet.lastFeedDate);const now=new Date();let pauseMs=calcPauseOverlap(last,now);const realMs=(now-last)-pauseMs;return Math.max(0,realMs/(1000*3600));}
function checkPauseAndNotify(){if(isPauseActive()){showNotification('操作暂停','假期暂停期间无法操作','warning');return true;}return false;}
function isPauseActive(){if(!currentClassId)return false;const cur=classesData.find(c=>c.id===currentClassId);if(!cur||!cur.pauseGrowth)return false;const today=new Date().toISOString().slice(0,10);return (today>=cur.pauseGrowth.start && today<=cur.pauseGrowth.end);}
function showNotification(title,message,type="info"){const c=document.getElementById('notificationContainer');/* 限制最多同时显示3个通知，防止DOM堆积 */while(c.children.length>=3)c.firstChild.remove();const icons={"info":"ℹ️","success":"✅","warning":"⚠️","error":"❌"},n=document.createElement('div');n.className='notification';n.innerHTML=`<div>${icons[type]}</div><div><strong>${esc(title)}</strong><br>${esc(message)}</div>`;c.appendChild(n);setTimeout(()=>{if(n.parentNode)n.remove();},3000);}
function buildStudentModalContent(student, pet){
  // v18: SAFETY NET — If a student is viewing another student's pet, ALWAYS show read-only
  // This prevents action buttons from appearing even if isViewingOtherStudent was wrong
  var _isStudent = typeof currentUser !== 'undefined' && currentUser && currentUser.type === 'student';
  if (_isStudent) {
    var _myId = currentUser.studentId || localStorage.getItem('studentId') || '';
    if (_myId && String(student.id) !== String(_myId)) {
      return buildReadOnlyStudentModalContent(student, pet);
    }
  }
  const stageName = getCurrentStageName(pet.name, pet.level||1);
  const lastDate = pet.lastFeedDate?new Date(pet.lastFeedDate):null;
  let hungerMsg='';
  if(pet.level>=9){hungerMsg='👑 传说神兽，无需喂食';}
  else if(isPauseActive()){hungerMsg='🛡️ 假期保护中，暂停饥饿计时';}
  else if(!pet.isDead&&lastDate){const hours=getEffectiveUnfedHours(pet); if(hours>=1440)hungerMsg='🔴 超过60天未喂，即将饿死！'; else if(hours>=720)hungerMsg='🟠 超过30天未喂，请尽快喂食'; else if(hours>=24)hungerMsg='🟡 超过1天未喂'; else hungerMsg=`🕒 ${Math.floor(hours)}小时前喂食`;} else if(pet.isDead)hungerMsg='💀 已饿死，请复活';
  const growable=getGrowablePet(student);
  const hasGrowable=growable && growable.id!==pet.id;
  const allMaxed=student.pets.every(p=>p.level>=9);
  const feedTarget=hasGrowable?growable:pet;
  const alreadyFed = _hasFedToday(feedTarget);
  const feedDisabled = alreadyFed || (pet.isDead && !hasGrowable) || student.coins<5 || (pet.level>=9 && !hasGrowable && !allMaxed) || allMaxed ? 'disabled' : '';
  const playDisabled=(pet.isDead && !hasGrowable)||student.coins<20||(pet.level>=9 && !hasGrowable && !allMaxed)?'disabled':(allMaxed?'disabled':'');
  const walkDisabled=(pet.isDead && !hasGrowable)||student.coins<30||(pet.level>=9 && !hasGrowable && !allMaxed)?'disabled':(allMaxed?'disabled':'');
  const shoppingDisabled=(pet.isDead && !hasGrowable)||student.coins<50||feedTarget.level<3||(pet.level>=9 && !hasGrowable && !allMaxed)?'disabled':(allMaxed?'disabled':'');
  const shoppingLevelHint = feedTarget.level<3 ? '<span style="font-size:11px;display:block;color:#e74c3c;">需要Lv3以上</span>' : '';
  const reviveDisabled=!pet.isDead||student.coins<50?'disabled':'';
  const canAdopt=student.pets.every(p=>p.level>=9);
  const adoptBtn = canAdopt ? `<button class="modal-btn" style="background:#9b59b6;" onclick="modalAdoptNew()">🌟 领养新宠物 (免费)</button>` : '';
  const feedHint = alreadyFed ? '<span style="font-size:11px;display:block;color:#27ae60;">✅ 今日已喂食</span>' : (hasGrowable ? `<span style="font-size:11px;display:block;opacity:0.8;">→ 自动喂 ${esc(feedTarget.nickname||feedTarget.name)}</span>` : '');
  /* Build pet gallery for multi-pet students */
  let petGallery='';
  if(student.pets.length>1){
    petGallery='<div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin:10px 0 5px;">';
    student.pets.forEach(pp=>{
      const isActive=pp.id===pet.id;
      const isMax=pp.level>=9;
      const border=isActive?'3px solid #ff8888':isMax?'2px solid #ffd700':'2px solid #e8d8d0';
      const bg=isMax?'linear-gradient(135deg,#fff8e8,#fff0d0)':'#fff5f0';
      const opacity=pp.isDead?'0.5':'1';
      petGallery+=`<div onclick="event.stopPropagation();switchPet('${student.id}','${pp.id}');refreshCurrentStudentModal();" style="cursor:pointer;text-align:center;padding:6px 10px;border-radius:16px;border:${border};background:${bg};opacity:${opacity};min-width:70px;transition:all 0.2s;" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='none'">
        <div style="width:45px;height:45px;margin:0 auto;">${getPetImage(pp.name,pp.level||1)}</div>
        <div style="font-size:11px;font-weight:700;color:#886;margin-top:2px;">${esc(pp.nickname||pp.name)}</div>
        <div style="font-size:10px;color:#aa8888;">${isMax?'👑满级':'Lv.'+pp.level}${pp.isDead?' 💀':''}${isActive?' ⭐':''}</div>
      </div>`;
    });
    petGallery+='</div>';
  }
  const maxedCount=countMaxedPets(student);
  const titleExtra='';
  const shopBonus=getStudentGrowthBonus(student);
  const bonusTag=shopBonus>0?`<span style="color:#27ae60;font-size:10px;"> (+${shopBonus})</span>`:'';
  const mfx=getStudentShopEffects(student);
  const modalBorderStyle=mfx.borderClasses.length?mfx.borderClasses.map(bc=>{
    if(bc==='pet-border-rainbow')return'border:3px solid transparent;background-clip:padding-box;box-shadow:0 0 0 3px #ff0000,0 0 0 3px #ff8800,0 0 12px rgba(255,100,0,0.3);animation:modalRainbow 3s linear infinite;';
    if(bc==='pet-border-flame')return'border:3px solid transparent;background-clip:padding-box;box-shadow:0 0 0 3px #ff4500,0 0 15px rgba(255,69,0,0.5),0 0 30px rgba(255,140,0,0.3),0 0 45px rgba(255,69,0,0.15);animation:flameBorderFlow 2s linear infinite;';
    if(bc==='pet-border-ice')return'border:3px solid transparent;background-clip:padding-box;box-shadow:0 0 0 3px #7dd3fc,0 0 15px rgba(125,211,252,0.5),0 0 35px rgba(56,189,248,0.2);animation:iceBorderShimmer 3s ease-in-out infinite;';
    if(bc==='pet-border-starry')return'border:3px solid transparent;background-clip:padding-box;box-shadow:0 0 0 3px #3d1a78,0 0 18px rgba(99,102,241,0.5),0 0 40px rgba(139,92,246,0.3),0 0 60px rgba(100,50,200,0.15);animation:starryBorderDrift 8s ease-in-out infinite;';
    if(bc==='pet-border-gold')return'border:3px solid transparent;background-clip:padding-box;box-shadow:0 0 0 3px #ffd700,0 0 18px rgba(255,215,0,0.6),0 0 40px rgba(255,183,0,0.3),0 0 60px rgba(255,215,0,0.15);animation:goldBorderShine 4s ease-in-out infinite;';
    return '';
  }).join(''):'';
  const modalSceneBg=mfx.sceneClass?(() => {
    const sceneMap={'pet-scene-meadow':'linear-gradient(180deg,#d4f5d4 0%,#a8e6a0 50%,#7bc97b 100%)','pet-scene-beach':'linear-gradient(180deg,#87CEEB 0%,#87CEEB 40%,#ffe4a0 70%,#f5d080 100%)','pet-scene-space':'linear-gradient(180deg,#0c0c2e 0%,#1a1a4e 50%,#2d1b69 100%)','pet-scene-sakura':'linear-gradient(180deg,#fce4ec 0%,#f8bbd0 50%,#f48fb1 100%)','pet-scene-volcano':'linear-gradient(180deg,#2c1810 0%,#5c2e1a 40%,#c0392b 70%,#e74c3c 90%,#ff6b35 100%)','pet-scene-aurora':'linear-gradient(180deg,#0a1628 0%,#1a3a5c 30%,#2ecc71 55%,#3498db 70%,#9b59b6 85%,#1a1a40 100%)'};
    return sceneMap[mfx.sceneClass]||'';
  })():'';
  const modalSceneClass=mfx.sceneClass||'';
  const modalTopAccessory=mfx.topHtml?mfx.topHtml.replace('shop-top-accessory','shop-top-accessory modal-top-accessory'):'';
  const modalBaseEffect=mfx.baseHtml?mfx.baseHtml.replace('shop-base-effect','shop-base-effect modal-base-effect'):'';
  const modalParticles=mfx.particleHtml?mfx.particleHtml.replace('shop-particles','shop-particles modal-particles'):'';
  const modalTitleBadge=mfx.titleHtml?mfx.titleHtml.replace('shop-title-badge','shop-title-badge modal-title-badge'):'';
  return `<div class="modal-student-title">${esc(student.name)} 的宠物${titleExtra}</div>
  ${petGallery}
  <div class="pet-stats-row">
    <div class="pet-stats-col left">
      <div class="stat-item"><span class="stat-label">🐾 宠物</span><span class="stat-value">${esc(pet.nickname||pet.name)}</span></div>
      <div class="stat-item"><span class="stat-label">✨ 等级</span><span class="stat-value modal-level-num">${stageName} Lv.${pet.level}${pet.level>=9?' <span class="modal-crown-icon">👑</span>':''}</span></div>
      <div class="stat-item"><span class="stat-label">📈 成长值</span><span class="stat-value">${pet.level>=9?getExpNeeded(pet):(pet.growth||0)} / ${getExpNeeded(pet)}</span></div>
      <div class="modal-growth-progress"><div class="stat-progress-bar"><div class="stat-progress-fill${pet.level>=9?' fill-gold':''}"></div></div></div>
      <div class="stat-item"><span class="stat-label">🍽️ 今日喂食</span><span class="stat-value">${pet.todayFeedCount||0} 次</span></div>
      <div class="stat-item"><span class="stat-label">🎮 今日玩耍</span><span class="stat-value">${pet.todayPlayCount||0} 次</span></div>
    </div>
    <div class="modal-pet-img ${modalSceneClass}" data-pet-img-container data-pet-name="${esc(pet.name)}" data-pet-level="${pet.level||1}" style="position:relative;overflow:visible;${modalBorderStyle}${modalSceneBg?'background:'+modalSceneBg+';':''}">
      ${modalTopAccessory}
      ${modalParticles}
      ${getPetImage(pet.name, pet.level||1)}${pet.isDead?'<div class="dead-pet-overlay">💀</div>':''}
      ${modalTitleBadge}
      ${modalBaseEffect}
    </div>
    <div class="pet-stats-col right">
      <div class="stat-item"><span class="stat-label"><span class="coin-shake">💰</span> 金币</span><span class="stat-value modal-coin-val">${student.coins}</span></div>
      <div class="stat-item"><span class="stat-label">⏱️ 上次喂食</span><span class="stat-value">${pet.lastFeedDate?new Date(pet.lastFeedDate).toLocaleString():'无'}</span></div>
      <div class="stat-item"><span class="stat-label">💀 状态</span><span class="stat-value">${pet.isDead?'已饿死':'🐣 存活'}</span></div>
      <div class="stat-item"><span class="stat-label">⚠️ 饥饿警告</span><span class="stat-value modal-hunger-warn">${hungerMsg}</span></div>
      ${student.pets.length>1?`<div class="stat-item"><span class="stat-label">📦 宠物数</span><span class="stat-value">${student.pets.length}只 (${maxedCount}满级)</span></div>`:''}
      ${shopBonus>0?`<div class="stat-item"><span class="stat-label">🏪 商店加成</span><span class="stat-value" style="color:#27ae60;">+${shopBonus}/次</span></div>`:''}
    </div>
  </div>
  <h4>🐾 主要互动</h4><div class="modal-action-grid">
    <button class="modal-btn" style="background:#f9a86c;" onclick="modalFeed()" ${feedDisabled}>🍗 喂食 (5金币)<span>成长+2</span>${feedHint}</button>
    <button class="modal-btn" style="background:#7ec8a0;" onclick="modalPlay()" ${playDisabled}>🎾 玩耍 (20金币)<span>成长+${Math.min(7+shopBonus, 13)}${bonusTag}</span>${feedHint}</button>
    <button class="modal-btn" style="background:#e8a87c;" onclick="modalWalk()" ${walkDisabled}>🚶 散步 (30金币)<span>成长+${Math.min(15+shopBonus, 24)}${bonusTag}</span>${feedHint}</button>
    <button class="modal-btn" style="background:#c39bd3;" onclick="modalShopping()" ${shoppingDisabled}>🛍️ 逛街 (50金币 Lv3+)<span>成长+${Math.min(35+shopBonus, 45)}${bonusTag}</span>${shoppingLevelHint}${feedHint}</button>
    <button class="modal-btn" style="background:#5dade2;" onclick="modalTravel()" ${pet.level<6?'disabled':''}>✈️ 旅游 (100金币 Lv6+)<span>成长+${Math.min(85+shopBonus, 100)}${bonusTag}</span>${pet.level<6?'<span style="color:#ffcc00;">Lv6解锁</span>':feedHint}</button>
    ${pet.isDead?`<button class="modal-btn" style="background:#dc6b6b;" onclick="modalRevive()" ${reviveDisabled}>💖 复活宠物 (50金币)</button>`:''}
    ${adoptBtn}
    ${(function(){const checkedIn=_hasCheckedInToday(student);return checkedIn?'<button class="modal-btn" style="background:#b0b0b0;" disabled>📋 每日打卡<span>✅ 今日已打卡</span></button>':'<button class="modal-btn" style="background:#48c774;" onclick="modalDailyCheckin()">📋 每日打卡<span>+10金币</span></button>';})()}
  </div>
  ${_buildModalShopSection(student, pet)}`;
}
// v13: Read-only view for students viewing other students' pets
function buildReadOnlyStudentModalContent(student, pet){
  const stageName = getCurrentStageName(pet.name, pet.level||1);
  const lastDate = pet.lastFeedDate?new Date(pet.lastFeedDate):null;
  let hungerMsg='';
  if(pet.level>=9){hungerMsg='👑 传说神兽，无需喂食';}
  else if(!pet.isDead&&lastDate){const hours=getEffectiveUnfedHours(pet); if(hours>=1440)hungerMsg='🔴 超过60天未喂'; else if(hours>=720)hungerMsg='🟠 超过30天未喂'; else if(hours>=24)hungerMsg='🟡 超过1天未喂'; else hungerMsg=`🕒 ${Math.floor(hours)}小时前喂食`;} else if(pet.isDead)hungerMsg='💀 已饿死'; else hungerMsg='🐣 存活';
  
  let petGallery='';
  if(student.pets.length>1){
    petGallery='<div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin:10px 0 5px;">';
    student.pets.forEach(pp=>{
      const isActive=pp.id===pet.id;
      const isMax=pp.level>=9;
      const border=isActive?'3px solid #ff8888':isMax?'2px solid #ffd700':'2px solid #e8d8d0';
      const bg=isMax?'linear-gradient(135deg,#fff8e8,#fff0d0)':'#fff5f0';
      const opacity=pp.isDead?'0.5':'1';
      petGallery+=`<div style="text-align:center;padding:6px 10px;border-radius:16px;border:${border};background:${bg};opacity:${opacity};min-width:70px;">
        <div style="width:45px;height:45px;margin:0 auto;">${getPetImage(pp.name,pp.level||1)}</div>
        <div style="font-size:11px;font-weight:700;color:#886;margin-top:2px;">${esc(pp.nickname||pp.name)}</div>
        <div style="font-size:10px;color:#aa8888;">${isMax?'👑满级':'Lv.'+pp.level}${pp.isDead?' 💀':''}${isActive?' ⭐':''}</div>
      </div>`;
    });
    petGallery+='</div>';
  }
  
  return `<div class="modal-student-title">${esc(student.name)} 的宠物</div>
  ${petGallery}
  <div class="pet-stats-row">
    <div class="pet-stats-col left">
      <div class="stat-item"><span class="stat-label">🐾 宠物</span><span class="stat-value">${esc(pet.nickname||pet.name)}</span></div>
      <div class="stat-item"><span class="stat-label">✨ 等级</span><span class="stat-value modal-level-num">${stageName} Lv.${pet.level}${pet.level>=9?' <span class="modal-crown-icon">👑</span>':''}</span></div>
      <div class="stat-item"><span class="stat-label">📈 成长值</span><span class="stat-value">${pet.level>=9?getExpNeeded(pet):(pet.growth||0)} / ${getExpNeeded(pet)}</span></div>
      <div class="modal-growth-progress"><div class="stat-progress-bar"><div class="stat-progress-fill${pet.level>=9?' fill-gold':''}"></div></div></div>
      <div class="stat-item"><span class="stat-label">🍽️ 今日喂食</span><span class="stat-value">${pet.todayFeedCount||0} 次</span></div>
      <div class="stat-item"><span class="stat-label">🎮 今日玩耍</span><span class="stat-value">${pet.todayPlayCount||0} 次</span></div>
    </div>
    <div class="pet-stats-col right">
      <div class="stat-item"><span class="stat-label"><span class="coin-shake">💰</span> 金币</span><span class="stat-value modal-coin-val">${student.coins}</span></div>
      <div class="stat-item"><span class="stat-label">⏱️ 上次喂食</span><span class="stat-value">${pet.lastFeedDate?new Date(pet.lastFeedDate).toLocaleString():'无'}</span></div>
      <div class="stat-item"><span class="stat-label">💀 状态</span><span class="stat-value">${pet.isDead?'已饿死':'🐣 存活'}</span></div>
      <div class="stat-item"><span class="stat-label">⚠️ 状态</span><span class="stat-value modal-hunger-warn">${hungerMsg}</span></div>
      ${student.pets.length>1?`<div class="stat-item"><span class="stat-label">📦 宠物数</span><span class="stat-value">${student.pets.length}只</span></div>`:''}
      ${(function(){const bonus=getStudentGrowthBonus(student);return bonus>0?`<div class="stat-item"><span class="stat-label">🏪 商店加成</span><span class="stat-value" style="color:#27ae60;">+${bonus}/次</span></div>`:'';})()}
    </div>
  </div>
  ${_buildReadOnlyShopSection(student, pet)}
  <div style="text-align:center;padding:20px;background:#f0f8ff;border-radius:12px;margin-top:16px;border:2px solid #4a90d9;">
    <div style="font-size:48px;margin-bottom:12px;">👀</div>
    <div style="font-size:16px;font-weight:700;color:#4a90d9;">正在查看 ${esc(student.name)} 的宠物</div>
    <div style="font-size:14px;color:#666;margin-top:8px;">你只能查看，不能操作其他同学的宠物</div>
  </div>`;
}
function openStudentModal(studentId){ if(!currentClassId)return; const cur=classesData.find(c=>c.id===currentClassId); const student=cur.students.find(s=>s.id.toString()===studentId.toString()); if(!student)return; currentModalStudentId=studentId;
  // v18: Robust check — is current user a student viewing ANOTHER student's pet?
  const isStudentView = typeof currentUser !== 'undefined' && currentUser && currentUser.type === 'student';
  const _mySid = isStudentView ? (currentUser.studentId || localStorage.getItem('studentId') || '') : '';
  const myStudentId = _mySid ? (isNaN(parseInt(_mySid)) ? _mySid : parseInt(_mySid)) : null;
  const isViewingOtherStudent = isStudentView && myStudentId !== null && String(student.id) !== String(myStudentId);
  
  if(!student.pets||student.pets.length===0){ 
    let content = '<div style="text-align:center;"><div style="font-size:60px;">🥚</div><p>尚未领养宠物</p><p>💰 '+student.coins+' 金币</p></div>';
    let actions = [{text:'关闭',onclick:'closeModal()'}];
    if(!isViewingOtherStudent) {
      actions.push({text:'去领养',onclick:`closeModal();showAdoptModal('${studentId}')`});
    }
    showModal(`${student.name} 的操作`, content, actions); 
    return; 
  } 
  const activePet=getActivePet(student);
  if(!activePet){showNotification('错误','无可用宠物','error');return;}
  ensurePetPlayFields(activePet); 
  const modalContent = isViewingOtherStudent ? buildReadOnlyStudentModalContent(student, activePet) : buildStudentModalContent(student, activePet);
  showModal('', modalContent, [{text:'关闭',class:'btn-secondary',onclick:'closeModal()'}], true); 
  setTimeout(()=>{ startHeartForCurrentPet(studentId);
    const petImgEl = document.querySelector('.modal-pet-img[data-pet-img-container]');
    if(petImgEl) initPetModalEnhancements(petImgEl, activePet.name, activePet.level||1, activePet.growth||0, getExpNeeded(activePet));
  }, 50);
}
function refreshCurrentStudentModal(){
  if(!currentModalStudentId) return;
  const cur=classesData.find(c=>c.id===currentClassId);
  if(!cur) return;
  const student=cur.students.find(s=>s.id.toString()===currentModalStudentId.toString());
  if(!student) return;
  const modalOverlay = document.querySelector('#modalContainer .modal-overlay');
  if(!modalOverlay) return;
  const modalDiv = modalOverlay.querySelector('.modal');
  if(!modalDiv) return;
  const activePet = getActivePet(student);
  if(!activePet){ closeModal(); return; }
  ensurePetPlayFields(activePet);
  cleanupPetModalEffects();
  // v18: Robust check — is current user a student viewing ANOTHER student's pet?
  const isStudentView = typeof currentUser !== 'undefined' && currentUser && currentUser.type === 'student';
  const _mySid = isStudentView ? (currentUser.studentId || localStorage.getItem('studentId') || '') : '';
  const myStudentId = _mySid ? (isNaN(parseInt(_mySid)) ? _mySid : parseInt(_mySid)) : null;
  const isViewingOtherStudent = isStudentView && myStudentId !== null && String(student.id) !== String(myStudentId);
  const contentBuilder = isViewingOtherStudent ? buildReadOnlyStudentModalContent : buildStudentModalContent;
  modalDiv.querySelector('.modal-content').innerHTML = contentBuilder(student, activePet); 
  setTimeout(()=>{ startHeartForCurrentPet(currentModalStudentId);
    const petImgEl = document.querySelector('.modal-pet-img[data-pet-img-container]');
    if(petImgEl) initPetModalEnhancements(petImgEl, activePet.name, activePet.level||1, activePet.growth||0, getExpNeeded(activePet));
  }, 60);
}
function ensurePetPlayFields(pet){ if(pet.todayPlayCount===undefined) pet.todayPlayCount=0; if(pet.lastPlayDate===undefined) pet.lastPlayDate=null; if(pet.penaltyStreak===undefined) pet.penaltyStreak=0; return pet; }
function getCurrentStageName(petName,level){const cfg=PET_CONFIG[petName];if(!cfg)return"未知";const s=cfg.stages.find(s=>s.stage===level);return s?s.stageName:`阶段${level}`;}
function playWithPet(student,pet){ if(pet.isDead){ showNotification('玩耍失败','宠物已经死亡，请先复活','error'); return false; } if(student.coins<20){ showNotification('金币不足','玩耍需要20金币','error'); return false; } if(pet.level >= 9){ showNotification('已达万物之神','无法继续成长，可以领养新宠物','warning'); return false; } ensurePetPlayFields(pet); let gain=Math.min(7+getStudentGrowthBonus(student), 13); pet.growth+=gain; student.coins-=20; pet.lastPlayDate=new Date().toISOString(); updatePetLevel(student, pet.id, gain); recordAction(student.id, student.name, '玩耍', `${pet.nickname||pet.name} +${gain}成长值`, -20, gain, pet.id); showNotification('玩耍快乐',`${pet.nickname||pet.name} 获得 ${gain} 成长值！`,'success'); return true; }
function walkPet(student,pet){ if(pet.isDead){ showNotification('散步失败','宠物已经死亡，请先复活','error'); return false; } if(student.coins<30){ showNotification('金币不足','散步需要30金币','error'); return false; } if(pet.level >= 9){ showNotification('已达万物之神','无法继续成长，可以领养新宠物','warning'); return false; } ensurePetPlayFields(pet); let gain=Math.min(15+getStudentGrowthBonus(student), 24); pet.growth+=gain; student.coins-=30; updatePetLevel(student, pet.id, gain); recordAction(student.id, student.name, '散步', `${pet.nickname||pet.name} +${gain}成长值`, -30, gain, pet.id); showNotification('散步愉快',`${pet.nickname||pet.name} 获得 ${gain} 成长值！`,'success'); return true; }
function shoppingPet(student,pet){ if(pet.isDead){ showNotification('逛街失败','宠物已经死亡，请先复活','error'); return false; } if(pet.level<3){ showNotification('等级不足','逛街需要Lv3以上','warning'); return false; } if(student.coins<50){ showNotification('金币不足','逛街需要50金币','error'); return false; } if(pet.level >= 9){ showNotification('已达万物之神','无法继续成长，可以领养新宠物','warning'); return false; } ensurePetPlayFields(pet); let gain=Math.min(35+getStudentGrowthBonus(student), 45); pet.growth+=gain; student.coins-=50; updatePetLevel(student, pet.id, gain); recordAction(student.id, student.name, '逛街', `${pet.nickname||pet.name} +${gain}成长值`, -50, gain, pet.id); showNotification('逛街开心',`${pet.nickname||pet.name} 获得 ${gain} 成长值！`,'success'); return true; }
function travelPet(student,pet){ if(pet.isDead){ showNotification('旅游失败','宠物已经死亡，请先复活','error'); return false; } if(pet.level<6){ showNotification('等级不足','旅游需要Lv6以上','warning'); return false; } if(student.coins<100){ showNotification('金币不足','旅游需要100金币','error'); return false; } if(pet.level >= 9){ showNotification('已达万物之神','无法继续成长，可以领养新宠物','warning'); return false; } ensurePetPlayFields(pet); let gain=Math.min(85+getStudentGrowthBonus(student), 100); pet.growth+=gain; student.coins-=100; updatePetLevel(student, pet.id, gain); recordAction(student.id, student.name, '旅游', `${pet.nickname||pet.name} +${gain}成长值`, -100, gain, pet.id); showNotification('旅游愉快',`${pet.nickname||pet.name} 获得 ${gain} 成长值！`,'success'); return true; }
function revivePet(student,pet){ if(!pet.isDead) return false; if(student.coins<50){showNotification('金币不足','复活需要50金币','error');return false;} student.coins-=50; pet.isDead=false; let deadGrowth = pet.deathGrowth !== undefined ? pet.deathGrowth : pet.growth; let newGrowth = Math.floor(deadGrowth * 0.5); let prevGrowth = pet.growth; pet.growth = newGrowth; pet.level = 1; const cfg = PET_CONFIG[pet.name]; if(cfg){ let newLevel = 1; for(let i=cfg.stages.length-1;i>=0;i--) if(pet.growth>=cfg.stages[i].growthRequired){ newLevel=cfg.stages[i].stage; break; } pet.level = newLevel; } pet.lastFeedDate=new Date().toISOString(); pet.todayFeedCount=0; pet.todayPlayCount=0; pet.lastPlayDate=null; pet.penaltyStreak = 0; delete pet.deathGrowth; recordAction(student.id, student.name, '复活', `${pet.nickname||pet.name} 复活`, -50, newGrowth - prevGrowth, pet.id); showNotification('复活成功',`${pet.nickname||pet.name} 重获新生！经验保留50%`,'success'); renderPKPage(); return true; }
function applyAction(student, action, pet){ let coinsChange = action.coins; let isPenalty = coinsChange < 0; let expChange = 0; let prevGrowth = pet.growth; if(pet.isDead){ if(isPenalty){ showNotification('操作禁止','宠物已死亡，不能施加惩罚','error'); return false; } else { student.coins += coinsChange; if(student.coins < 0) student.coins = 0; if(pet.penaltyStreak !== undefined) pet.penaltyStreak = 0; recordAction(student.id, student.name, '奖惩', `${action.name} (宠物死亡)`, coinsChange, 0, pet.id); showNotification(action.name, `+${coinsChange}金币 (宠物死亡无法获得经验)`, 'success'); return true; } } if(isPenalty){ let absDeduct = Math.abs(coinsChange); let coinDeducted = Math.min(absDeduct, student.coins); let remaining = absDeduct - coinDeducted; student.coins -= coinDeducted; expChange = 0; if(remaining > 0){ expChange = -remaining; pet.growth += expChange; if(pet.growth <= 0){ pet.growth = 0; pet.isDead = true; pet.deathGrowth = prevGrowth; pet.deathDate = new Date().toISOString(); pet.penaltyStreak = 0; recordAction(student.id, student.name, '惩罚致死', `${action.name} 导致死亡（金币不足，经验扣至0）`, -absDeduct, -prevGrowth, pet.id, {causedDeath: true, prevGrowth: prevGrowth}); showNotification('惩罚致死',`${pet.nickname||pet.name} 金币不足，经验被扣至0，宠物死亡！`,'error'); saveClassData(); renderPKPage(); return true; } updatePetLevel(student, pet.id, expChange); } let msg = `${action.name}：金币-${coinDeducted}`; if(expChange !== 0) msg += `，经验${expChange}`; recordAction(student.id, student.name, '奖惩', msg, -coinDeducted, expChange, pet.id); showNotification(action.name, msg, 'warning'); } else { if(pet.penaltyStreak !== undefined) pet.penaltyStreak = 0; student.coins += coinsChange; if(student.coins < 0) student.coins = 0; let msg = `${action.name}：金币+${coinsChange}`; recordAction(student.id, student.name, '奖惩', msg, coinsChange, 0, pet.id); showNotification(action.name, msg, 'success'); } return true; }
function modalFeed(){if(checkPauseAndNotify())return;if(!currentModalStudentId)return;const cur=classesData.find(c=>c.id===currentClassId);const student=cur.students.find(s=>s.id.toString()===currentModalStudentId.toString());if(!student)return;let pet=getActivePet(student);if(!pet)return;if(pet.isDead||pet.level>=9){const growable=getGrowablePet(student);if(growable){pet=growable;}else if(pet.isDead){showNotification('无法喂食','宠物已死亡，请先复活','error');return;}else{showNotification('全部满级','所有宠物都已满级，可以领养新宠物','info');return;}}feedPet(student,pet);saveClassData();refreshCurrentStudentModal();scheduleAllRenders();}
function modalPlay(){if(checkPauseAndNotify())return;if(!currentModalStudentId)return;const cur=classesData.find(c=>c.id===currentClassId);const student=cur.students.find(s=>s.id.toString()===currentModalStudentId.toString());if(!student)return;let pet=getActivePet(student);if(!pet)return;if(pet.isDead||pet.level>=9){const growable=getGrowablePet(student);if(growable){pet=growable;}else if(pet.isDead){showNotification('无法玩耍','宠物已死亡，请先复活','error');return;}else{showNotification('全部满级','所有宠物都已满级，可以领养新宠物','info');return;}}playWithPet(student,pet);saveClassData();refreshCurrentStudentModal();scheduleAllRenders();}
function modalWalk(){if(checkPauseAndNotify())return;if(!currentModalStudentId)return;const cur=classesData.find(c=>c.id===currentClassId);const student=cur.students.find(s=>s.id.toString()===currentModalStudentId.toString());if(!student)return;let pet=getActivePet(student);if(!pet)return;if(pet.isDead||pet.level>=9){const growable=getGrowablePet(student);if(growable){pet=growable;}else if(pet.isDead){showNotification('无法散步','宠物已死亡，请先复活','error');return;}else{showNotification('全部满级','所有宠物都已满级，可以领养新宠物','info');return;}}walkPet(student,pet);saveClassData();refreshCurrentStudentModal();scheduleAllRenders();}
function modalShopping(){if(checkPauseAndNotify())return;if(!currentModalStudentId)return;const cur=classesData.find(c=>c.id===currentClassId);const student=cur.students.find(s=>s.id.toString()===currentModalStudentId.toString());if(!student)return;let pet=getActivePet(student);if(!pet)return;if(pet.isDead||pet.level>=9){const growable=getGrowablePet(student);if(growable){pet=growable;}else if(pet.isDead){showNotification('无法逛街','宠物已死亡，请先复活','error');return;}else{showNotification('全部满级','所有宠物都已满级，可以领养新宠物','info');return;}}if(pet.level<3){showNotification('等级不足','逛街需要Lv3以上','warning');return;}shoppingPet(student,pet);saveClassData();refreshCurrentStudentModal();scheduleAllRenders();}
function modalTravel(){if(checkPauseAndNotify())return;if(!currentModalStudentId)return;const cur=classesData.find(c=>c.id===currentClassId);const student=cur.students.find(s=>s.id.toString()===currentModalStudentId.toString());if(!student)return;let pet=getActivePet(student);if(!pet)return;if(pet.isDead||pet.level>=9){const growable=getGrowablePet(student);if(growable){pet=growable;}else if(pet.isDead){showNotification('无法旅游','宠物已死亡，请先复活','error');return;}else{showNotification('全部满级','所有宠物都已满级，可以领养新宠物','info');return;}}if(pet.level<6){showNotification('等级不足','旅游需要Lv6以上','warning');return;}travelPet(student,pet);saveClassData();refreshCurrentStudentModal();scheduleAllRenders();}
function modalRevive(){if(checkPauseAndNotify())return;if(!currentModalStudentId)return;const cur=classesData.find(c=>c.id===currentClassId);const student=cur.students.find(s=>s.id.toString()===currentModalStudentId.toString());if(!student)return;const pet=getActivePet(student);if(!pet)return;revivePet(student,pet);saveClassData();refreshCurrentStudentModal();renderHomePetGrid();renderClassTopThree();}
// v14: Student daily check-in — 10 coins per day, once per day
function modalDailyCheckin(){
  if(checkPauseAndNotify())return;
  if(!currentModalStudentId)return;
  const cur=classesData.find(c=>c.id===currentClassId);
  const student=cur.students.find(s=>s.id.toString()===currentModalStudentId.toString());
  if(!student)return;
  
  // v37: Check if already checked in today (via lastCheckinDate or operation logs)
  if(_hasCheckedInToday(student)){
    showNotification('今日已打卡','每天只能打卡一次，明天再来吧','info');
    return;
  }
  
  // Perform check-in: +10 coins
  student.coins += 10;
  student.lastCheckinDate = new Date().toISOString();
  recordAction(student.id, student.name, '每日打卡', '+10金币', 10, 0, null);
  saveClassData();
  refreshCurrentStudentModal();
  renderHomePetGrid();
  scheduleAllRenders();
  showNotification('打卡成功','每日打卡 +10金币！','success');
}
function modalApplyAction(actionId){if(checkPauseAndNotify())return;if(!currentModalStudentId)return;const cur=classesData.find(c=>c.id===currentClassId);const student=cur.students.find(s=>s.id.toString()===currentModalStudentId.toString());if(!student)return;const pet=getActivePet(student);if(!pet)return;const action=customActions.find(a=>String(a.id)===String(actionId));if(!action)return; const result = applyAction(student, action, pet); if(result){ saveClassData(); refreshCurrentStudentModal(); scheduleAllRenders(); } }
function modalAdoptNew(){if(checkPauseAndNotify())return;if(!currentModalStudentId)return;const cur=classesData.find(c=>c.id===currentClassId);const student=cur.students.find(s=>s.id.toString()===currentModalStudentId.toString());if(!student)return;if(student.pets.some(p=>p.level<9)){showNotification('无法领养','还有未满级的宠物，需要全部满级后才能领养新宠物','warning');return;}closeModal();showAdoptModal(student.id, true);}
function showAdoptModal(studentId, fromModal=false){ if(checkPauseAndNotify())return; const cur=classesData.find(c=>c.id===currentClassId); const student=cur.students.find(s=>s.id.toString()===studentId.toString()); if(student.pets.length>0 && student.pets.some(p=>p.level<9)){showNotification('无法领养','还有未满级的宠物，需要全部满级后才能领养新宠物','warning');return;} let list=`<div class="pet-select-grid">`; Object.keys(PET_CONFIG).forEach(name=>{ list+=`<div class="pet-select-item" onclick="selectPetForAdopt('${name}','${studentId}')"><div class="pet-select-img">${getPetImage(name, 1)}</div><div>${name}</div></div>`; }); list+='</div>'; const modalOverlay = showModal('领养宠物', list, [{text:'取消',onclick: fromModal ? 'refreshCurrentStudentModal()' : 'closeModal()'}], true); if(modalOverlay){ const modalDiv = modalOverlay.querySelector('.modal'); if(modalDiv) modalDiv.classList.add('adopt-modal'); } }
function selectPetForAdopt(petName,studentId){selectedPetName=petName;showModal('起个昵称',`<input id="nicknameInput" value="${petName}" style="width:100%;padding:10px;border-radius:20px;">`,[{text:'取消',onclick:'closeModal()'},{text:'确认领养',onclick:`confirmAdoptPet('${studentId}')`}]);}
function confirmAdoptPet(studentId){if(checkPauseAndNotify())return;const nickname=document.getElementById('nicknameInput')?.value.trim()||selectedPetName;const cur=classesData.find(c=>c.id===currentClassId);const student=cur.students.find(s=>s.id.toString()===studentId.toString());if(!student)return;adoptNewPet(student, selectedPetName, nickname);closeModal();if(currentModalStudentId && currentModalStudentId===studentId) openStudentModal(studentId); else renderHomePetGrid();}

/* ========== 宠物商店系统 ========== */
const PET_SHOP_ITEMS = {
  borders: {
    name:'边框特效', icon:'🖼️', items:[
      {id:'border_rainbow',name:'彩虹流光',desc:'卡片边缘流动彩虹光效',price:80,growthBonus:1,css:'pet-border-rainbow'},
      {id:'border_flame',name:'烈焰之框',desc:'燃烧的火焰边框',price:120,growthBonus:2,css:'pet-border-flame'},
      {id:'border_ice',name:'冰晶之框',desc:'闪烁的冰蓝水晶边框',price:120,growthBonus:2,css:'pet-border-ice'},
      {id:'border_starry',name:'星空幻境',desc:'银河星辰环绕边框',price:200,growthBonus:3,css:'pet-border-starry'},
      {id:'border_gold',name:'皇家金框',desc:'尊贵的金色浮雕边框',price:300,growthBonus:4,css:'pet-border-gold'},
    ]
  },
  topAccessory: {
    name:'头顶挂件', icon:'👑', items:[
      {id:'top_halo',name:'天使光环',desc:'头顶金色神圣光环',price:60,growthBonus:1,css:'pet-top-halo'},
      {id:'top_crown',name:'小皇冠',desc:'可爱的迷你皇冠',price:100,growthBonus:2,css:'pet-top-crown'},
      {id:'top_bow',name:'蝴蝶结',desc:'粉色蝴蝶结发饰',price:60,growthBonus:1,css:'pet-top-bow'},
      {id:'top_horns',name:'恶魔角',desc:'酷炫的小恶魔角',price:100,growthBonus:2,css:'pet-top-horns'},
      {id:'top_flower',name:'花之冠',desc:'鲜花编织的花冠',price:150,growthBonus:3,css:'pet-top-flower'},
    ]
  },
  baseEffect: {
    name:'底部光圈', icon:'💫', items:[
      {id:'base_cloud',name:'祥云缭绕',desc:'脚踏七彩祥云',price:80,growthBonus:1,css:'pet-base-cloud'},
      {id:'base_rainbow',name:'彩虹台座',desc:'绚丽彩虹圆形台座',price:100,growthBonus:2,css:'pet-base-rainbow'},
      {id:'base_magic',name:'魔法阵',desc:'神秘旋转魔法阵',price:150,growthBonus:2,css:'pet-base-magic'},
      {id:'base_lava',name:'熔岩地面',desc:'脚下涌动炽热岩浆',price:200,growthBonus:3,css:'pet-base-lava'},
      {id:'base_galaxy',name:'星河足迹',desc:'踩在缩微银河之上',price:300,growthBonus:4,css:'pet-base-galaxy'},
    ]
  },
  particles: {
    name:'粒子特效', icon:'✨', items:[
      {id:'ptcl_hearts',name:'爱心飘飘',desc:'粉色爱心缓缓漂浮',price:60,growthBonus:1,css:'pet-ptcl-hearts'},
      {id:'ptcl_stars',name:'星光闪烁',desc:'金色小星星环绕闪烁',price:80,growthBonus:1,css:'pet-ptcl-stars'},
      {id:'ptcl_snow',name:'雪花纷飞',desc:'晶莹雪花飘落',price:80,growthBonus:1,css:'pet-ptcl-snow'},
      {id:'ptcl_firefly',name:'萤火虫',desc:'温暖的黄绿萤光飞舞',price:120,growthBonus:2,css:'pet-ptcl-firefly'},
      {id:'ptcl_sakura',name:'樱花雨',desc:'粉白花瓣纷纷飘落',price:150,growthBonus:2,css:'pet-ptcl-sakura'},
      {id:'ptcl_thunder',name:'雷电缠身',desc:'电弧在周身噼啪作响',price:250,growthBonus:3,css:'pet-ptcl-thunder'},
    ]
  },
  titles: {
    name:'称号铭牌', icon:'🏷️', items:[
      {id:'title_xueba',name:'学霸',desc:'学识渊博的象征',price:50,growthBonus:1,css:'pet-title-xueba'},
      {id:'title_juanwang',name:'卷王',desc:'卷到极致就是艺术',price:50,growthBonus:1,css:'pet-title-juanwang'},
      {id:'title_wulin',name:'武林盟主',desc:'号令天下莫敢不从',price:150,growthBonus:2,css:'pet-title-wulin'},
      {id:'title_dragon',name:'真龙天子',desc:'金鳞岂非池中物',price:200,growthBonus:3,css:'pet-title-dragon'},
      {id:'title_legend',name:'不朽传说',desc:'名留青史的传奇称号',price:350,growthBonus:4,css:'pet-title-legend'},
    ]
  },
  scenes: {
    name:'场景背景', icon:'🎨', items:[
      {id:'scene_meadow',name:'青青草地',desc:'绿草如茵鲜花点缀',price:80,growthBonus:1,css:'pet-scene-meadow'},
      {id:'scene_beach',name:'阳光沙滩',desc:'碧海蓝天金色沙滩',price:100,growthBonus:2,css:'pet-scene-beach'},
      {id:'scene_space',name:'浩瀚星空',desc:'深邃星空银河环绕',price:150,growthBonus:2,css:'pet-scene-space'},
      {id:'scene_sakura',name:'樱花小径',desc:'落英缤纷的浪漫樱道',price:150,growthBonus:2,css:'pet-scene-sakura'},
      {id:'scene_volcano',name:'火山熔岩',desc:'炽热岩浆火光冲天',price:200,growthBonus:3,css:'pet-scene-volcano'},
      {id:'scene_aurora',name:'极光幻境',desc:'绚丽极光照耀冰原',price:300,growthBonus:4,css:'pet-scene-aurora'},
    ]
  }
};
let _shopActiveCategory = 'borders';

function getAllShopItems(){
  const items=[];
  Object.values(PET_SHOP_ITEMS).forEach(cat=>cat.items.forEach(it=>items.push(it)));
  return items;
}
function getShopItemById(id){
  for(const cat of Object.values(PET_SHOP_ITEMS)){
    const found=cat.items.find(it=>it.id===id);
    if(found) return found;
  }
  return null;
}
function getStudentOwnedItems(student){
  return student.shopItems||[];
}
function studentOwnsItem(student,itemId){
  return (student.shopItems||[]).includes(itemId);
}
function getStudentGrowthBonus(student){
  // Only count bonuses from EQUIPPED items, not all purchased items
  const eq=getEquippedItems(student);
  const owned=student.shopItems||[];
  const equippedIds=Object.values(eq).filter(id=>owned.includes(id));
  if(equippedIds.length===0) return 0;
  let bonus=0;
  equippedIds.forEach(id=>{
    const item=getShopItemById(id);
    if(item) bonus+=item.growthBonus;
  });
  return bonus;
}
/* ===== 道具佩戴系统 ===== */
function getItemCategory(itemId){
  for(const[catKey,cat] of Object.entries(PET_SHOP_ITEMS)){
    if(cat.items.some(it=>it.id===itemId)) return catKey;
  }
  return null;
}
function getEquippedItems(student){
  if(!student.equippedItems) student.equippedItems={};
  return student.equippedItems;
}
function isItemEquipped(student, itemId){
  const eq=getEquippedItems(student);
  const cat=getItemCategory(itemId);
  return cat && eq[cat]===itemId;
}
function equipItem(student, itemId){
  if(!studentOwnsItem(student,itemId)) return false;
  const cat=getItemCategory(itemId);
  if(!cat) return false;
  if(!student.equippedItems) student.equippedItems={};
  student.equippedItems[cat]=itemId;
  return true;
}
function unequipItem(student, itemId){
  const cat=getItemCategory(itemId);
  if(!cat) return false;
  if(!student.equippedItems) return false;
  if(student.equippedItems[cat]===itemId){
    delete student.equippedItems[cat];
    return true;
  }
  return false;
}
function autoEquipOnBuy(student, itemId){
  const cat=getItemCategory(itemId);
  if(!cat) return;
  if(!student.equippedItems) student.equippedItems={};
  if(!student.equippedItems[cat]){
    student.equippedItems[cat]=itemId;
  }
}

function showPetShopBrowse(){
  if(!currentClassId){showNotification('请先选择班级','','warning');return;}
  _shopActiveCategory='borders';
  const html=_buildShopBrowseHTML();
  showModal('🏪 宠物商店', html, [{text:'关闭',onclick:'closeModal()'}], true);
}
function switchShopCategory(catKey){
  _shopActiveCategory=catKey;
  const container=document.querySelector('.modal-content');
  if(container) container.innerHTML=_buildShopBrowseHTML();
}
function _buildShopBrowseHTML(){
  let html='<div style="margin-bottom:14px;text-align:center;color:#886;font-size:13px;">浏览商品分类，进入学生卡片可购买商品</div>';
  html+='<div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-bottom:16px;">';
  Object.entries(PET_SHOP_ITEMS).forEach(([key,cat])=>{
    const isActive=key===_shopActiveCategory;
    html+=`<button onclick="switchShopCategory('${key}')" style="padding:8px 16px;border-radius:18px;border:2px solid ${isActive?'#9b59b6':'#e0d0c8'};background:${isActive?'linear-gradient(135deg,#9b59b6,#8e44ad)':'#fff8f5'};color:${isActive?'#fff':'#665'};font-size:14px;font-weight:${isActive?'700':'500'};cursor:pointer;transition:all 0.2s;display:flex;align-items:center;gap:5px;">${cat.icon} ${cat.name}<span style="font-size:11px;opacity:0.7;">(${cat.items.length})</span></button>`;
  });
  html+='</div>';
  const cat=PET_SHOP_ITEMS[_shopActiveCategory];
  html+=`<div style="background:linear-gradient(135deg,#faf5ff,#f5f0ff);border-radius:18px;padding:16px;border:1.5px solid #e8d8f0;">`;
  html+=`<h4 style="margin:0 0 12px;color:#7b2d8e;font-size:16px;">${cat.icon} ${cat.name}</h4>`;
  html+='<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px;">';
  cat.items.forEach(item=>{
    html+=`<div style="background:#fff;border-radius:14px;padding:12px;border:1.5px solid #ecdff5;transition:all 0.2s;cursor:default;" onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 4px 12px rgba(155,89,182,0.15)'" onmouseout="this.style.transform='none';this.style.boxShadow='none'">
      <div style="font-weight:700;font-size:14px;color:#5b2d6e;margin-bottom:4px;">${item.name}</div>
      <div style="font-size:11px;color:#998;margin-bottom:6px;line-height:1.4;">${item.desc}</div>
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <span style="font-size:13px;font-weight:600;color:#e67e22;">💰 ${item.price}</span>
        <span style="font-size:11px;color:#27ae60;font-weight:600;">📈 +${item.growthBonus}/次</span>
      </div>
    </div>`;
  });
  html+='</div></div>';
  html+='<div style="margin-top:12px;padding:10px 14px;background:#fff8f0;border-radius:12px;font-size:12px;color:#886;line-height:1.6;">';
  html+='<strong>成长加成说明：</strong>只有佩戴的商品才会产生成长值加成。同类道具只能佩戴一个，佩戴后每次互动额外获得对应的成长加成。可在商店中点击「佩戴/取下」切换生效道具。';
  html+='</div>';
  return html;
}
let _modalShopCategory = 'borders';
function _buildModalShopSection(student, pet){
  const owned=getStudentOwnedItems(student);
  const totalBonus=getStudentGrowthBonus(student);
  let html=`<div style="margin-top:14px;"><h4>🏪 宠物商店${totalBonus>0?` <span style="font-size:12px;font-weight:400;color:#27ae60;background:#e8faf0;padding:2px 10px;border-radius:10px;">当前加成: +${totalBonus}/次</span>`:''}</h4>`;
  html+='<div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:10px;">';
  Object.entries(PET_SHOP_ITEMS).forEach(([key,cat])=>{
    const isActive=key===_modalShopCategory;
    const ownedInCat=cat.items.filter(it=>owned.includes(it.id)).length;
    html+=`<button onclick="_modalShopCategory='${key}';refreshCurrentStudentModal();" style="padding:4px 10px;border-radius:12px;border:1.5px solid ${isActive?'#9b59b6':'#ddd'};background:${isActive?'#9b59b6':'#faf5ff'};color:${isActive?'#fff':'#665'};font-size:12px;font-weight:${isActive?'700':'400'};cursor:pointer;">${cat.icon} ${cat.name}${ownedInCat>0?` ✓${ownedInCat}`:''}</button>`;
  });
  html+='</div>';
  const cat=PET_SHOP_ITEMS[_modalShopCategory];
  html+='<div class="modal-action-grid" style="grid-template-columns:repeat(auto-fill,minmax(155px,1fr));">';
  cat.items.forEach(item=>{
    const isOwned=owned.includes(item.id);
    const canAfford=student.coins>=item.price;
    const equipped=isItemEquipped(student, item.id);
    if(isOwned){
      const eqBtnStyle=equipped
        ?'background:linear-gradient(135deg,#27ae60,#219a52);color:#fff;border:2px solid #1e8449;'
        :'background:linear-gradient(135deg,#f0e6ff,#e8d8f5);color:#7b2d8e;border:2px solid #c9a0dc;';
      const eqLabel=equipped?'✅ 已佩戴':'🔲 未佩戴';
      const eqAction=equipped?`modalUnequipItem('${item.id}')`:`modalEquipItem('${item.id}')`;
      html+=`<div style="background:${equipped?'linear-gradient(135deg,#e0ffe8,#c8f8d4)':'linear-gradient(135deg,#f5f0ff,#ece4f8)'};border:2px solid ${equipped?'#27ae60':'#d0c0e0'};border-radius:14px;padding:10px;text-align:center;transition:all 0.3s;${equipped?'box-shadow:0 2px 12px rgba(39,174,96,0.25);':''}">
        <div style="font-weight:700;font-size:13px;color:${equipped?'#27ae60':'#7b2d8e'};">${equipped?'🌟':'📦'} ${item.name}</div>
        <div style="font-size:10px;color:#888;margin:3px 0;">+${item.growthBonus}/次</div>
        <button onclick="${eqAction}" style="${eqBtnStyle}padding:4px 14px;border-radius:16px;font-size:12px;font-weight:700;cursor:pointer;transition:all 0.2s;display:inline-block;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='none'">${eqLabel}</button>
      </div>`;
    } else {
      const btnColor=canAfford?'#9b59b6':'#bbb';
      const btnBg=canAfford?'linear-gradient(135deg,#9b59b6,#8e44ad)':'#e0d0d0';
      html+=`<button onclick="modalBuyItem('${item.id}')" ${canAfford?'':'disabled'} style="background:${btnBg};color:#fff;border:1.5px solid ${canAfford?'rgba(255,255,255,0.2)':'#ccc'};border-radius:14px;padding:10px;text-align:center;cursor:${canAfford?'pointer':'not-allowed'};transition:all 0.2s;display:block;width:100%;font-size:13px;" ${canAfford?`onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='none'"`:''}>
        <div style="font-weight:700;">${item.name}</div>
        <div style="font-size:10px;opacity:0.85;margin-top:2px;">💰${item.price}金币 · 📈+${item.growthBonus}/次</div>
      </button>`;
    }
  });
  html+='</div>';
  if(owned.length>0){
    html+=`<div style="margin-top:8px;padding:6px 10px;background:#f8f5ff;border-radius:10px;font-size:11px;color:#886;">已购 ${owned.length} 件 · 总成长加成: <strong style="color:#27ae60;">+${totalBonus}</strong>/次（每次互动额外获得）</div>`;
  }
  html+='</div>';
  return html;
}
// v39: Read-only shop section for viewing other students' items
function _buildReadOnlyShopSection(student, pet){
  const owned=getStudentOwnedItems(student);
  if(owned.length===0) return '';
  const totalBonus=getStudentGrowthBonus(student);
  let html=`<div style="margin-top:14px;"><h4>🏪 已购特效${totalBonus>0?` <span style="font-size:12px;font-weight:400;color:#27ae60;background:#e8faf0;padding:2px 10px;border-radius:10px;">加成: +${totalBonus}/次</span>`:''}</h4>`;
  html+='<div style="display:flex;flex-wrap:wrap;gap:8px;">';
  owned.forEach(itemId=>{
    const item=getShopItemById(itemId);
    if(!item) return;
    const equipped=isItemEquipped(student, itemId);
    html+=`<div style="background:${equipped?'linear-gradient(135deg,#e0ffe8,#c8f8d4)':'linear-gradient(135deg,#f5f0ff,#ece4f8)'};border:2px solid ${equipped?'#27ae60':'#d0c0e0'};border-radius:14px;padding:10px;text-align:center;min-width:120px;${equipped?'box-shadow:0 2px 12px rgba(39,174,96,0.25);':''}">
      <div style="font-weight:700;font-size:13px;color:${equipped?'#27ae60':'#7b2d8e'};">${equipped?'🌟':'📦'} ${item.name}</div>
      <div style="font-size:10px;color:#888;margin-top:3px;">+${item.growthBonus}/次</div>
      <div style="font-size:11px;color:${equipped?'#27ae60':'#999'};margin-top:4px;font-weight:${equipped?'700':'400'};">${equipped?'✅ 佩戴中':'未佩戴'}</div>
    </div>`;
  });
  html+='</div>';
  html+=`<div style="margin-top:8px;padding:6px 10px;background:#f8f5ff;border-radius:10px;font-size:11px;color:#886;">共 ${owned.length} 件特效 · 总成长加成: <strong style="color:#27ae60;">+${totalBonus}</strong>/次</div>`;
  html+='</div>';
  return html;
}
function modalBuyItem(itemId){
  if(checkPauseAndNotify())return;
  if(!currentModalStudentId)return;
  const cur=classesData.find(c=>c.id===currentClassId);
  const student=cur.students.find(s=>s.id.toString()===currentModalStudentId.toString());
  if(!student)return;
  const item=getShopItemById(itemId);
  if(!item){showNotification('商品不存在','','error');return;}
  if(studentOwnsItem(student,itemId)){showNotification('已拥有','你已经拥有该商品','warning');return;}
  if(student.coins<item.price){showNotification('金币不足',`购买${item.name}需要${item.price}金币，当前${student.coins}金币`,'error');return;}
  student.coins-=item.price;
  if(!student.shopItems) student.shopItems=[];
  student.shopItems.push(itemId);
  autoEquipOnBuy(student, itemId);
  const pet=getActivePet(student);
  recordAction(student.id, student.name, '商店购买', `购买「${item.name}」，成长加成+${item.growthBonus}/次`, -item.price, 0, pet?pet.id:null, {shopItemId:itemId});
  saveClassData();
  refreshCurrentStudentModal();
  renderHomePetGrid();
  showNotification('购买成功',`获得「${item.name}」！已自动佩戴，每次互动额外+${item.growthBonus}成长值`,'success');
}
function modalEquipItem(itemId){
  if(!currentModalStudentId)return;
  const cur=classesData.find(c=>c.id===currentClassId);
  const student=cur.students.find(s=>s.id.toString()===currentModalStudentId.toString());
  if(!student)return;
  const item=getShopItemById(itemId);
  if(!item)return;
  equipItem(student, itemId);
  saveClassData();
  refreshCurrentStudentModal();
  renderHomePetGrid();
  showNotification('佩戴成功',`已佩戴「${item.name}」，特效已生效！`,'success');
}
function modalUnequipItem(itemId){
  if(!currentModalStudentId)return;
  const cur=classesData.find(c=>c.id===currentClassId);
  const student=cur.students.find(s=>s.id.toString()===currentModalStudentId.toString());
  if(!student)return;
  const item=getShopItemById(itemId);
  if(!item)return;
  unequipItem(student, itemId);
  saveClassData();
  refreshCurrentStudentModal();
  renderHomePetGrid();
  showNotification('已卸下',`已卸下「${item.name}」`,'info');
}
function showChangePetModal(studentId){ const cur=classesData.find(c=>c.id===currentClassId); const student=cur.students.find(s=>s.id.toString()===studentId.toString()); const activePet=getActivePet(student); if(!activePet||activePet.level>=2){showNotification('等级≥2无法更换','','error');return;} let list='<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;">'; Object.keys(PET_CONFIG).forEach(name=>{list+=`<div class="pet-select-item" style="padding:5px;" onclick="selectPetForChange('${name}','${studentId}')"><div class="pet-select-img" style="width:60px;height:60px;">${getPetImage(name,1)}</div><div>${name}</div></div>`;}); list+='</div>'; showModal('更换宠物(仅限Lv1)',list,[{text:'取消',onclick:'closeModal()'}],false); }
function selectPetForChange(petName,studentId){selectedPetName=petName;showModal('新昵称',`<input id="nicknameInput" value="${petName}">`,[{text:'取消',onclick:'closeModal()'},{text:'确认',onclick:`confirmChangePet('${studentId}')`}]);}
function confirmChangePet(studentId){const nickname=document.getElementById('nicknameInput')?.value.trim()||selectedPetName;const cur=classesData.find(c=>c.id===currentClassId);const student=cur.students.find(s=>s.id.toString()===studentId.toString());const activePet=getActivePet(student);if(!activePet||activePet.level>=2)return;const idx=student.pets.findIndex(p=>p.id===activePet.id);if(idx!==-1){student.pets[idx]={...activePet,name:selectedPetName,nickname:nickname,level:1,growth:activePet.growth,lastFeedDate:activePet.lastFeedDate||new Date().toISOString(),todayFeedCount:0,isDead:activePet.isDead, todayPlayCount:0, lastPlayDate:null, penaltyStreak:activePet.penaltyStreak||0};saveClassData();closeModal();scheduleAllRenders();showNotification('更换成功',`新宠物${nickname}`,'success');}}
function renamePet(studentId, petId){ const cur=classesData.find(c=>c.id===currentClassId); if(!cur) return; const student=cur.students.find(s=>s.id.toString()===studentId.toString()); if(!student) return; const pet=student.pets.find(p=>String(p.id)===String(petId)); if(!pet) return; const oldName=pet.nickname||pet.name; showModal('修改宠物名字',`<div style="text-align:center;margin-bottom:10px;font-size:14px;color:#888;">当前名字：<strong>${esc(oldName)}</strong></div><input id="renamePetInput" value="${escAttr(oldName)}" maxlength="20" style="width:100%;padding:10px 14px;border:2px solid #ffcfcf;border-radius:16px;font-size:16px;text-align:center;outline:none;box-sizing:border-box;" onfocus="this.select()" placeholder="请输入新名字">`,[{text:'取消',onclick:'closeModal()'},{text:'确认修改',onclick:`confirmRenamePet('${escJS(studentId)}','${escJS(petId)}')`}]); setTimeout(()=>{const inp=document.getElementById('renamePetInput');if(inp)inp.focus();},100); }
function confirmRenamePet(studentId, petId){ const inp=document.getElementById('renamePetInput'); if(!inp) return; const newName=inp.value.trim(); if(!newName){showNotification('名字不能为空','请输入一个宠物名字','warning');return;} const cur=classesData.find(c=>c.id===currentClassId); if(!cur) return; const student=cur.students.find(s=>s.id.toString()===studentId.toString()); if(!student) return; const pet=student.pets.find(p=>String(p.id)===String(petId)); if(!pet) return; const oldName=pet.nickname||pet.name; pet.nickname=newName; saveClassData(); closeModal(); scheduleAllRenders(); if(currentModalStudentId && student.id.toString()===currentModalStudentId.toString()) refreshCurrentStudentModal(); showNotification('改名成功',`${oldName} → ${newName}`,'success'); }
function showSwitchPetModal(studentId){ const cur=classesData.find(c=>c.id===currentClassId); const student=cur.students.find(s=>s.id.toString()===studentId.toString()); if(!student||student.pets.length<=1)return; const maxed=countMaxedPets(student); let html=maxed>0?`<div style="text-align:center;margin-bottom:10px;padding:6px 16px;background:linear-gradient(135deg,#fff8e0,#fff0c0);border-radius:16px;font-size:14px;font-weight:700;color:#b8860b;">👑 ${maxed}只传说神兽 · 宠物大师</div>`:''; html+='<div style="display:flex;flex-direction:column;gap:8px;">'; student.pets.forEach(p=>{const isActive = Number(student.activePetId)===Number(p.id); const isMax=p.level>=9; const borderStyle=isMax?'2px solid #ffd700':isActive?'2px solid #ff8888':'1px solid #ffcfcf'; const bg=isMax?'linear-gradient(135deg,#fffbe6,#fff5d0)':'#fff'; const badge=isMax?'<span style="background:linear-gradient(135deg,#ffd700,#ff8c00);color:#fff;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:800;margin-left:6px;">👑 满级</span>':''; html+=`<div style="display:flex;align-items:center;gap:12px;padding:10px 14px;border:${borderStyle};border-radius:20px;cursor:pointer;background:${bg};transition:all 0.2s;" onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 4px 12px rgba(0,0,0,0.1)'" onmouseout="this.style.transform='none';this.style.boxShadow='none'" onclick="switchPet('${studentId}','${p.id}');closeModal();"><div style="width:55px;height:55px;flex-shrink:0;">${getPetImage(p.name, p.level)}</div><div style="flex:1;"><strong>${esc(p.nickname||p.name)}</strong>${badge} <span style="color:#aaa;font-size:12px;">${isActive?'⭐当前展示':''}</span><br><span style="font-size:13px;color:#888;">Lv.${p.level} · ${getCurrentStageName(p.name,p.level)} · 成长:${p.level>=9?getExpNeeded(p):p.growth}${p.isDead?' · 💀已死亡':''}</span></div></div>`;}); html+='</div><div style="margin-top:10px;text-align:center;color:#bbb;font-size:12px;">点击切换卡片展示的宠物，喂食自动作用于未满级宠物</div>'; showModal('切换展示宠物',html,[{text:'关闭',onclick:'closeModal()'}],false); }
function switchPet(studentId, petId){ const cur = classesData.find(c=>c.id===currentClassId); const student = cur.students.find(s=>s.id.toString()===studentId.toString()); if(student) setActivePet(student, Number(petId)); }
function setActivePet(student, petId){ petId = Number(petId); if(student.pets.some(p=>Number(p.id)===petId)){ student.activePetId = petId; saveClassData(); renderHomePetGrid(); renderPKPage(); if(currentModalStudentId && student.id.toString()===currentModalStudentId.toString()) refreshCurrentStudentModal(); } }
function showBatchEditModal(){ if(!currentClassId){ showNotification('请先选择班级','','error'); return; } const cur = classesData.find(c=>c.id===currentClassId); if(!cur || cur.students.length===0){ showNotification('班级无学生','请先添加学生','warning'); return; } let studentListHtml = '<div class="batch-checkbox-list"><div><label><input type="checkbox" id="selectAllBatch" onclick="toggleAllBatch(this.checked)"> 全选/取消全选</label></div>'; cur.students.forEach((s)=>{ studentListHtml += `<div class="batch-student-item"><input type="checkbox" class="batch-student-chk" value="${s.id}" id="stu_${s.id}"><label for="stu_${s.id}">${esc(s.name)} (💰${s.coins})</label></div>`; }); studentListHtml += '</div><div><label>奖惩项目: <select id="batchActionSelect">'; customActions.forEach(act=>{ const sign = act.coins>0 ? `+${act.coins}` : `${act.coins}`; studentListHtml += `<option value="${act.id}">${esc(act.name)} (${sign}金币)</option>`; }); studentListHtml += '</select></label><label style="margin-left:10px;"><input type="checkbox" id="batchCustomToggle" onchange="document.getElementById(\'batchCustomCoins\').style.display=this.checked?\'inline-block\':\'none\';document.getElementById(\'batchActionSelect\').disabled=this.checked;"> 自定义加金币</label><span id="batchCustomCoins" style="display:none;margin-left:8px;"><input type="number" id="batchCustomValue" style="width:70px;padding:4px 6px;border:1px solid #ccc;border-radius:8px;font-size:14px;" placeholder="金币数" value="10"> 金币</span></div>'; showModal('批量奖惩', studentListHtml, [{text:'取消', class:'btn-secondary', onclick:'closeModal()'},{text:'执行', class:'btn-primary', onclick:'confirmBatchAction()'}], false); setTimeout(()=>{ const selectAll = document.getElementById('selectAllBatch'); if(selectAll) selectAll.onchange = (e) => toggleAllBatch(e.target.checked); }, 50); }
function toggleAllBatch(checked){ const chks = document.querySelectorAll('.batch-student-chk'); chks.forEach(chk => chk.checked = checked); }
function confirmBatchAction(){ const cur = classesData.find(c=>c.id===currentClassId); if(!cur) return; const isCustom = document.getElementById('batchCustomToggle')?.checked; let action; if(isCustom){ const val = parseInt(document.getElementById('batchCustomValue')?.value); if(isNaN(val)||val===0){ showNotification('请输入有效的金币数','不能为0','warning'); return; } action = {id:'_custom_', name:'自定义'+(val>0?'+':'')+val+'金币', coins: val}; } else { const actionId = document.getElementById('batchActionSelect')?.value; action = customActions.find(a=>String(a.id)===String(actionId)); if(!action){ showNotification('错误','未选择有效的奖惩项目','error'); return; } } const selectedIds = Array.from(document.querySelectorAll('.batch-student-chk:checked')).map(cb=>cb.value); if(selectedIds.length===0){ showNotification('请至少选择一名学生','','warning'); return; } let updatedCount = 0; cur.students.forEach(s=>{ if(selectedIds.includes(s.id.toString())){ let pet = getActivePet(s); if(pet){ let coinsChange = action.coins; let isPenalty = coinsChange < 0; let expChange = 0; if(pet.isDead){ if(isPenalty){ showNotification('操作跳过',`${s.name} 宠物已死亡，惩罚跳过`,'warning'); return; } else { s.coins += coinsChange; if(s.coins<0) s.coins=0; recordAction(s.id, s.name, '批量奖惩', `${action.name} (宠物死亡)`, coinsChange, 0, pet.id); updatedCount++; return; } } if(isPenalty){ let absDeduct = Math.abs(coinsChange); let coinDeducted = Math.min(absDeduct, s.coins); let remaining = absDeduct - coinDeducted; s.coins -= coinDeducted; expChange = 0; if(remaining > 0){ expChange = -remaining; let prevGrowth = pet.growth; pet.growth += expChange; if(pet.growth <= 0){ pet.growth = 0; pet.isDead = true; pet.deathGrowth = prevGrowth; pet.deathDate = new Date().toISOString(); pet.penaltyStreak = 0; recordAction(s.id, s.name, '惩罚致死', `${action.name} 导致死亡（金币不足，经验扣至0）`, -absDeduct, -prevGrowth, pet.id, {causedDeath: true, prevGrowth: prevGrowth}); updatedCount++; return; } updatePetLevel(s, pet.id, expChange); } recordAction(s.id, s.name, '批量奖惩', `${action.name}`, -coinDeducted, expChange, pet.id); updatedCount++; } else { if(pet.penaltyStreak !== undefined) pet.penaltyStreak = 0; s.coins += coinsChange; if(s.coins<0) s.coins=0; recordAction(s.id, s.name, '批量奖惩', `${action.name}`, coinsChange, 0, pet.id); updatedCount++; } } else { s.coins += action.coins; if(s.coins<0) s.coins=0; recordAction(s.id, s.name, '批量奖惩', `${action.name} (无宠物)`, action.coins, 0, null); updatedCount++; } } }); if(updatedCount>0){ saveClassData(); scheduleAllRenders(); if(currentModalStudentId) refreshCurrentStudentModal(); showNotification('批量操作完成',`已对${updatedCount}名学生执行“${action.name}”`,'success'); } else { showNotification('无变化','操作未生效','info'); } closeModal(); }
function showPauseGrowthModal(){ if(!currentClassId)return; const cur=classesData.find(c=>c.id===currentClassId); const p=cur.pauseGrowth||{start:'',end:''}; const content=`<div><label>开始: <input type="date" id="ps" value="${p.start}"></label><br><label>结束: <input type="date" id="pe" value="${p.end}"></label><p>假期内停止饿死计时</p></div>`; showModal('假期保护',content,[{text:'清除',onclick:'clearPause()'},{text:'保存',onclick:'savePause()'},{text:'关闭',onclick:'closeModal()'}]); }
function savePause(){const s=document.getElementById('ps').value,e=document.getElementById('pe').value;if(s&&e){const cur=classesData.find(c=>c.id===currentClassId);cur.pauseGrowth={start:s,end:e};saveClassData();closeModal();showNotification('已设置','','success');}}
function clearPause(){const cur=classesData.find(c=>c.id===currentClassId);delete cur.pauseGrowth;saveClassData();closeModal();showNotification('已清除假期','','info');}
function showCustomActionsModal(){ let items='';customActions.forEach(a=>{const sign=a.coins>0?`+${a.coins}`:`${a.coins}`;items+=`<div class="custom-action-item"><span>${esc(a.name)} ${sign}金币</span><span><span onclick="editCustomAction('${a.id}')">✏️</span> ${!String(a.id).startsWith('sys_')?`<span onclick="deleteCustomAction('${a.id}')">🗑️</span>`:''}</span></div>`;});const content=`<div style="max-height:300px;overflow:auto;">${items}</div><button class="btn btn-success" onclick="showAddCustomActionModal()">➕ 新增奖惩</button>`;showModal('学习奖惩管理',content,[{text:'关闭',onclick:'closeModal()'}],false);}
function showAddCustomActionModal(){closeModal();showModal('新增奖惩','<input id="newActName" placeholder="名称"><input id="newCoins" type="number" placeholder="金币数量" value="10">',[{text:'取消',onclick:'showCustomActionsModal()'},{text:'保存',onclick:'saveNewReward()'}]);}
function saveNewReward(){const name=document.getElementById('newActName')?.value.trim();const coins=parseInt(document.getElementById('newCoins')?.value);if(!name||isNaN(coins)){showNotification('错误','请填写有效名称和金币数','error');return;}customActions.push({id:Date.now().toString(),name,coins});saveCustomActions();closeModal();showCustomActionsModal();}
function editCustomAction(id){const act=customActions.find(a=>String(a.id)===String(id));if(!act)return;closeModal();showModal('编辑奖惩',`<input id="editName" value="${esc(act.name)}"><input id="editCoins" value="${act.coins}" type="number">`,[{text:'取消',onclick:'showCustomActionsModal()'},{text:'保存',onclick:`updateReward('${id}')`}]);}
function updateReward(id){const name=document.getElementById('editName')?.value.trim();const coins=parseInt(document.getElementById('editCoins')?.value);if(name&&!isNaN(coins)){const idx=customActions.findIndex(a=>String(a.id)===String(id));if(idx!==-1){customActions[idx]={...customActions[idx],name,coins};saveCustomActions();}closeModal();showCustomActionsModal();}}
function deleteCustomAction(id){if(confirm('删除操作')){customActions=customActions.filter(a=>String(a.id)!==String(id));saveCustomActions();showCustomActionsModal();}}
function showStudentListModal(){if(!currentClassId)return;const cur=classesData.find(c=>c.id===currentClassId);let html='<div style="max-height:400px;overflow:auto;">';cur.students.forEach(s=>{html+=`<div class="student-list-item"><span>${esc(s.name)}</span><div><span class="edit-icon" style="cursor:pointer;" onclick="editStudentName('${s.id}')">✏️</span><span class="delete-icon" style="cursor:pointer;margin-left:10px;" onclick="deleteStudentById('${s.id}')">🗑️</span></div></div>`;});html+='</div>';showModal('学生列表',html,[{text:'增加学生',class:'btn-primary',onclick:'addSingleStudent()'},{text:'关闭',class:'btn-secondary',onclick:'closeModal()'},{text:'清空所有',class:'btn-danger',onclick:'clearAllStudents()'}]);}
function addSingleStudent(){const name=prompt('学生姓名');if(!name)return;const cur=classesData.find(c=>c.id===currentClassId);if(cur.students.find(s=>s.name===name.trim())){showNotification('已存在','','error');return;}cur.students.push({id:_genLocalId(),name:name.trim(),coins:50,pets:[],lastCheckinDate:null,activePetId:null,pkCountToday:0,lastPkDate:null});saveClassData();closeModal();showStudentListModal();scheduleAllRenders();}
function editStudentName(id){const cur=classesData.find(c=>c.id===currentClassId);const stu=cur.students.find(s=>s.id.toString()===id.toString());if(!stu)return;const newName=prompt('新名字',stu.name);if(newName)stu.name=newName.trim();saveClassData();closeModal();showStudentListModal();renderHomePetGrid();}
function deleteStudentById(id){if(confirm('删除学生')){const cur=classesData.find(c=>c.id===currentClassId);cur.students=cur.students.filter(s=>s.id.toString()!==id.toString());saveClassData();closeModal();showStudentListModal();scheduleAllRenders();if(currentModalStudentId && currentModalStudentId===id) closeModal();}}
function clearAllStudents(){if(confirm('清空所有学生？')){const cur=classesData.find(c=>c.id===currentClassId);cur.students=[];saveClassData();closeModal();scheduleAllRenders();if(currentModalStudentId) closeModal();}}
function renderClassTopThree(){
  const container=document.getElementById('classTopThree');
  const fullListEl=document.getElementById('fullRankList');
  const statsBar=document.getElementById('rankStatsBar');
  if(!container||!currentClassId)return;
  const cur=classesData.find(c=>c.id===currentClassId);
  if(!cur)return;
  const allList=cur.students.map(s=>({
    name:s.name,
    totalGrowth:s.pets?.reduce((sum,p)=>sum+(p.growth||0),0)||0,
    pet:s.pets&&s.pets.length>0?s.pets[0]:null,
    petCount:s.pets?s.pets.length:0,
    maxLevel:s.pets?Math.max(0,...s.pets.map(p=>p.level||1)):0
  })).filter(x=>x.totalGrowth>0).sort((a,b)=>b.totalGrowth-a.totalGrowth);

  const emptyHint=document.getElementById('honorEmptyHint');
  if(allList.length===0){
    container.innerHTML='';
    if(fullListEl)fullListEl.innerHTML='';
    if(statsBar)statsBar.innerHTML='';
    if(emptyHint)emptyHint.style.display='block';
    return;
  }
  if(emptyHint)emptyHint.style.display='none';

  const maxGrowth=allList[0]?.totalGrowth||1;
  const totalStudents=cur.students.length;
  const hasPetCount=cur.students.filter(s=>s.pets&&s.pets.length>0).length;
  const totalGrowthAll=allList.reduce((s,x)=>s+x.totalGrowth,0);

  /* 统计横幅 */
  if(statsBar){
    statsBar.innerHTML=`<div class="rank-stats-banner">
      <div class="rank-stat-chip"><div class="chip-num">${totalStudents}</div><div class="chip-label">班级人数</div></div>
      <div class="rank-stat-chip"><div class="chip-num">${hasPetCount}</div><div class="chip-label">已养宠物</div></div>
      <div class="rank-stat-chip"><div class="chip-num">${allList.length}</div><div class="chip-label">上榜人数</div></div>
      <div class="rank-stat-chip"><div class="chip-num">${totalGrowthAll}</div><div class="chip-label">全班总成长</div></div>
    </div>`;
  }

  /* 称号系统 */
  function getRankTitle(idx,total){
    if(idx===0) return {text:'冠军驯兽师',cls:'champion'};
    if(idx===1) return {text:'精英驯兽师',cls:'elite'};
    if(idx===2) return {text:'勇者驯兽师',cls:'brave'};
    if(idx<Math.ceil(total*0.3)) return {text:'新星驯兽师',cls:'rising'};
    return {text:'见习驯兽师',cls:'starter'};
  }

  /* 领奖台 top3 */
  const top3=allList.slice(0,3);
  const podiumOrder=[1,0,2]; /* silver, gold, bronze */
  let podiumHtml='<div class="podium-section">';
  podiumOrder.forEach(pi=>{
    const item=top3[pi];
    if(!item)return;
    const cls=['gold','silver','bronze'][pi];
    const pet=item.pet;
    const petImg=pet?getPetImage(pet.name,pet.level||1):'<span style="font-size:36px;">🥚</span>';
    const crown=pi===0?'<div class="podium-crown">👑</div>':'';
    const medalNum=pi+1;
    podiumHtml+=`<div class="podium-slot ${cls}">
      <div class="podium-avatar-wrap">
        ${crown}
        <div class="podium-avatar">${petImg}<div class="podium-medal">${medalNum}</div></div>
      </div>
      <div class="podium-name">${esc(item.name)}</div>
      <div class="podium-pet-name">${pet?(esc(pet.nickname||pet.name)):'未领养'}</div>
      <div class="podium-pillar">
        <div class="podium-rank-num">${medalNum}</div>
        <div class="podium-growth-val">${item.totalGrowth} 成长</div>
      </div>
    </div>`;
  });
  podiumHtml+='</div><div class="podium-base"></div>';
  container.innerHTML=podiumHtml;

  /* 完整排名列表 */
  if(fullListEl){
    let listHtml='<div class="full-rank-section"><div class="full-rank-title">📊 全班排行</div><div class="rank-list">';
    allList.forEach((item,idx)=>{
      const topCls=idx===0?'top1':idx===1?'top2':idx===2?'top3':'';
      const pet=item.pet;
      const petImg=pet?getPetImage(pet.name,pet.level||1):'<span style="font-size:22px;">🥚</span>';
      const pct=Math.round((item.totalGrowth/maxGrowth)*100);
      const title=getRankTitle(idx,allList.length);
      listHtml+=`<div class="rank-row ${topCls}">
        <div class="rank-num">${idx+1}</div>
        <div class="rank-row-avatar">${petImg}</div>
        <div class="rank-row-info">
          <div class="rank-row-name">${esc(item.name)} <span class="rank-title-badge ${title.cls}">${title.text}</span></div>
          <div class="rank-row-pet">${pet?(esc(pet.nickname||pet.name)):'未领养'} ${pet?'Lv.'+pet.level:''} ${item.petCount>1?'(共'+item.petCount+'只)':''}</div>
          <div class="rank-progress-wrap">
            <div class="rank-progress-bar"><div class="rank-progress-fill" style="width:${pct}%"></div></div>
            <div class="rank-growth-num">${item.totalGrowth}</div>
          </div>
        </div>
      </div>`;
    });
    listHtml+='</div></div>';
    fullListEl.innerHTML=listHtml;
  }
}
// ========== 排行榜三分类标签切换 ==========
function switchRankTab(tabName) {
  document.querySelectorAll('.rank-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.rank-tab-content').forEach(c => c.classList.remove('active'));
  const tabs = document.querySelectorAll('.rank-tab');
  const idx = tabName === 'growth' ? 0 : tabName === 'quiz' ? 1 : 2;
  if (tabs[idx]) tabs[idx].classList.add('active');
  const contentId = tabName === 'growth' ? 'rankGrowthContent' : tabName === 'quiz' ? 'rankQuizContent' : 'rankPigRunContent';
  const content = document.getElementById(contentId);
  if (content) content.classList.add('active');
  if (tabName === 'quiz') renderQuizRanking();
  if (tabName === 'pigrun') renderPigRunRanking();
}
window.switchRankTab = switchRankTab;

// ========== 每日一练排行榜 ==========
function renderQuizRanking() {
  const cur = classesData.find(c => c.id === currentClassId);
  if (!cur) return;
  const topThreeEl = document.getElementById('quizTopThree');
  const fullListEl = document.getElementById('fullQuizRankList');
  const emptyHint = document.getElementById('quizRankEmptyHint');
  const statsBar = document.getElementById('rankQuizStatsBar');

  // 仅统计每日一练答题获得的金币（quizState.totalQuizCoins），不含其他来源
  const allList = cur.students.map(s => {
    var quizCoins = (s.quizState && s.quizState.totalQuizCoins) || 0;
    return {
      name: s.name,
      totalCoins: quizCoins,
      student: s
    };
  }).filter(x => x.totalCoins > 0).sort((a, b) => b.totalCoins - a.totalCoins);

  if (allList.length === 0) {
    if (topThreeEl) topThreeEl.innerHTML = '';
    if (fullListEl) fullListEl.innerHTML = '';
    if (statsBar) statsBar.innerHTML = '';
    if (emptyHint) emptyHint.style.display = 'block';
    return;
  }
  if (emptyHint) emptyHint.style.display = 'none';

  const maxCoins = allList[0]?.totalCoins || 1;
  const totalStudents = cur.students.length;
  const totalCoinsAll = allList.reduce((s, x) => s + x.totalCoins, 0);

  // Stats bar
  if (statsBar) {
    statsBar.innerHTML = `<div class="rank-stats-banner">
      <div class="rank-stat-chip"><div class="chip-num">${totalStudents}</div><div class="chip-label">班级人数</div></div>
      <div class="rank-stat-chip"><div class="chip-num">${allList.length}</div><div class="chip-label">上榜人数</div></div>
      <div class="rank-stat-chip"><div class="chip-num">${totalCoinsAll}</div><div class="chip-label">全班总金币</div></div>
    </div>`;
  }

  function getQuizRankTitle(idx, total) {
    if (idx === 0) return { text: '答题王者', cls: 'champion' };
    if (idx === 1) return { text: '答题达人', cls: 'elite' };
    if (idx === 2) return { text: '答题能手', cls: 'brave' };
    if (idx < Math.ceil(total * 0.3)) return { text: '答题新星', cls: 'rising' };
    return { text: '答题学员', cls: 'starter' };
  }

  // Top 3 podium
  const top3 = allList.slice(0, 3);
  const podiumOrder = [1, 0, 2];
  let podiumHtml = '<div class="podium-section">';
  podiumOrder.forEach(pi => {
    const item = top3[pi];
    if (!item) return;
    const cls = ['gold', 'silver', 'bronze'][pi];
    const crown = pi === 0 ? '<div class="podium-crown">👑</div>' : '';
    const medalNum = pi + 1;
    // 获取学生宠物头像
    const activePet = getActivePet(item.student);
    const petAvatar = activePet ? getPetImage(activePet.name, activePet.level || 1) : '<span style="font-size:36px;">📝</span>';
    podiumHtml += `<div class="podium-slot ${cls}">
      <div class="podium-avatar-wrap">
        ${crown}
        <div class="podium-avatar">${petAvatar}<div class="podium-medal">${medalNum}</div></div>
      </div>
      <div class="podium-name">${esc(item.name)}</div>
      <div class="podium-pet-name">${item.totalCoins} 金币</div>
      <div class="podium-pillar">
        <div class="podium-rank-num">${medalNum}</div>
        <div class="podium-growth-val">${item.totalCoins} 金币</div>
      </div>
    </div>`;
  });
  podiumHtml += '</div><div class="podium-base"></div>';
  if (topThreeEl) topThreeEl.innerHTML = podiumHtml;

  // Full list
  if (fullListEl) {
    let listHtml = '<div class="full-rank-section"><div class="full-rank-title">📊 全班排行</div><div class="rank-list">';
    allList.forEach((item, idx) => {
      const topCls = idx === 0 ? 'top1' : idx === 1 ? 'top2' : idx === 2 ? 'top3' : '';
      const pct = Math.round((item.totalCoins / maxCoins) * 100);
      const title = getQuizRankTitle(idx, allList.length);
      // 获取学生宠物头像
      const activePet = getActivePet(item.student);
      const petAvatar = activePet ? getPetImage(activePet.name, activePet.level || 1) : '<span style="font-size:22px;">📝</span>';
      listHtml += `<div class="rank-row ${topCls}">
        <div class="rank-num">${idx + 1}</div>
        <div class="rank-row-avatar">${petAvatar}</div>
        <div class="rank-row-info">
          <div class="rank-row-name">${esc(item.name)} <span class="rank-title-badge ${title.cls}">${title.text}</span></div>
          <div class="rank-row-pet">累计获得 ${item.totalCoins} 金币</div>
          <div class="rank-progress-wrap">
            <div class="rank-progress-bar"><div class="rank-progress-fill" style="width:${pct}%;background:linear-gradient(90deg,#ffd700,#ffaa00);"></div></div>
            <div class="rank-growth-num">${item.totalCoins} 金币</div>
          </div>
        </div>
      </div>`;
    });
    listHtml += '</div></div>';
    fullListEl.innerHTML = listHtml;
  }
}
window.renderQuizRanking = renderQuizRanking;

// ========== 小猪快跑排行榜 ==========
function renderPigRunRanking() {
  const cur = classesData.find(c => c.id === currentClassId);
  if (!cur) return;
  const topThreeEl = document.getElementById('pigRunTopThree');
  const fullListEl = document.getElementById('fullPigRunRankList');
  const emptyHint = document.getElementById('pigRunRankEmptyHint');
  const statsBar = document.getElementById('rankPigRunStatsBar');

  // 新数据结构：quizState.pigRunLevels = { "1": {bestScore, bestTime, coinsEarned, cleared}, ... }
  // quizState.pigRunTotalScore = 所有关卡 bestScore 之和
  const allList = cur.students.map(s => {
    var qs = s.quizState || {};
    var pigRunLevels = qs.pigRunLevels || {};
    var totalScore = qs.pigRunTotalScore || 0;
    // 兼容旧数据
    if (totalScore === 0 && qs.pigRunScore) totalScore = qs.pigRunScore;
    var clearedCount = Object.keys(pigRunLevels).filter(k => pigRunLevels[k] && pigRunLevels[k].cleared).length;
    var maxLevel = 0;
    Object.keys(pigRunLevels).forEach(k => {
      var lv = parseInt(k);
      if (pigRunLevels[k] && pigRunLevels[k].cleared && lv > maxLevel) maxLevel = lv;
    });
    return {
      name: s.name,
      totalScore: totalScore,
      clearedLevels: clearedCount,
      maxLevel: maxLevel,
      student: s
    };
  }).filter(x => x.totalScore > 0 || x.clearedLevels > 0).sort((a, b) => b.totalScore - a.totalScore);

  if (allList.length === 0) {
    if (topThreeEl) topThreeEl.innerHTML = '';
    if (fullListEl) fullListEl.innerHTML = '';
    if (statsBar) statsBar.innerHTML = '';
    if (emptyHint) emptyHint.style.display = 'block';
    return;
  }
  if (emptyHint) emptyHint.style.display = 'none';

  const maxScore = allList[0]?.totalScore || 1;
  const totalStudents = cur.students.length;
  const totalScoreAll = allList.reduce((s, x) => s + x.totalScore, 0);

  if (statsBar) {
    statsBar.innerHTML = `<div class="rank-stats-banner">
      <div class="rank-stat-chip"><div class="chip-num">${totalStudents}</div><div class="chip-label">班级人数</div></div>
      <div class="rank-stat-chip"><div class="chip-num">${allList.length}</div><div class="chip-label">上榜人数</div></div>
      <div class="rank-stat-chip"><div class="chip-num">${totalScoreAll}</div><div class="chip-label">全班总分</div></div>
    </div>`;
  }

  function getPigRunRankTitle(idx, total) {
    if (idx === 0) return { text: '跑猪王者', cls: 'champion' };
    if (idx === 1) return { text: '跑猪达人', cls: 'elite' };
    if (idx === 2) return { text: '跑猪能手', cls: 'brave' };
    if (idx < Math.ceil(total * 0.3)) return { text: '跑猪新星', cls: 'rising' };
    return { text: '跑猪学员', cls: 'starter' };
  }

  const top3 = allList.slice(0, 3);
  const podiumOrder = [1, 0, 2];
  let podiumHtml = '<div class="podium-section">';
  podiumOrder.forEach(pi => {
    const item = top3[pi];
    if (!item) return;
    const cls = ['gold', 'silver', 'bronze'][pi];
    const crown = pi === 0 ? '<div class="podium-crown">👑</div>' : '';
    const medalNum = pi + 1;
    // 获取学生宠物头像
    const activePet = getActivePet(item.student);
    const petAvatar = activePet ? getPetImage(activePet.name, activePet.level || 1) : '<span style="font-size:36px;">🐷</span>';
    podiumHtml += `<div class="podium-slot ${cls}">
      <div class="podium-avatar-wrap">
        ${crown}
        <div class="podium-avatar">${petAvatar}<div class="podium-medal">${medalNum}</div></div>
      </div>
      <div class="podium-name">${esc(item.name)}</div>
      <div class="podium-pet-name">第${item.maxLevel}关 · ${item.totalScore}分</div>
      <div class="podium-pillar">
        <div class="podium-rank-num">${medalNum}</div>
        <div class="podium-growth-val">${item.totalScore}分 · ${item.clearedLevels}关</div>
      </div>
    </div>`;
  });
  podiumHtml += '</div><div class="podium-base"></div>';
  if (topThreeEl) topThreeEl.innerHTML = podiumHtml;

  if (fullListEl) {
    let listHtml = '<div class="full-rank-section"><div class="full-rank-title">📊 全班排行</div><div class="rank-list">';
    allList.forEach((item, idx) => {
      const topCls = idx === 0 ? 'top1' : idx === 1 ? 'top2' : idx === 2 ? 'top3' : '';
      const pct = Math.round((item.totalScore / maxScore) * 100);
      const title = getPigRunRankTitle(idx, allList.length);
      // 获取学生宠物头像
      const activePet = getActivePet(item.student);
      const petAvatar = activePet ? getPetImage(activePet.name, activePet.level || 1) : '<span style="font-size:22px;">🐷</span>';
      listHtml += `<div class="rank-row ${topCls}">
        <div class="rank-num">${idx + 1}</div>
        <div class="rank-row-avatar">${petAvatar}</div>
        <div class="rank-row-info">
          <div class="rank-row-name">${esc(item.name)} <span class="rank-title-badge ${title.cls}">${title.text}</span></div>
          <div class="rank-row-pet">第${item.maxLevel}关 · 通关${item.clearedLevels}关 · 总分 ${item.totalScore}分</div>
          <div class="rank-progress-wrap">
            <div class="rank-progress-bar"><div class="rank-progress-fill" style="width:${pct}%;background:linear-gradient(90deg,#52c41a,#389e0d);"></div></div>
            <div class="rank-growth-num">${item.totalScore}分</div>
          </div>
        </div>
      </div>`;
    });
    listHtml += '</div></div>';
    fullListEl.innerHTML = listHtml;
  }
}
window.renderPigRunRanking = renderPigRunRanking;

function switchPage(pageId){if(pageId!=='quiz-page'&&typeof window._stopPigRunBGM==='function'){window._stopPigRunBGM();}document.querySelectorAll('.nav-item').forEach(i=>i.classList.remove('active'));document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));document.getElementById(pageId).classList.add('active');var isStudentView=typeof currentUser!=='undefined'&&currentUser&&currentUser.type==='student';if(pageId!=='quiz-page'&&!isStudentView&&typeof window._resetQuizModalFlag==='function'){window._resetQuizModalFlag();}else if(pageId==='quiz-page'&&!isStudentView){if(typeof window._resetQuizModalFlag==='function')window._resetQuizModalFlag();window._pigRunModalShown=false;window._teacherPlayingAsStudent=null;}var needsLogReload=isStudentView&&(pageId==='pk-page'||pageId==='jianghu-page');if(needsLogReload&&typeof _loadOperationLogs==='function'){_loadOperationLogs().then(function(){if(typeof _syncOpLogsAlias==='function'){try{_syncOpLogsAlias();}catch(e){}}requestAnimationFrame(()=>{if(pageId==='pk-page'){renderPKPage();var sa=document.getElementById('classpk-start-area');if(sa)sa.classList.remove('visible');probePKMonsterImages();}else if(pageId==='jianghu-page'){renderJianghuPage();probeJhBossImages();}});}).catch(function(e){console.warn('[switchPage] Log reload failed:',e);requestAnimationFrame(()=>{if(pageId==='pk-page')renderPKPage();else if(pageId==='jianghu-page')renderJianghuPage();});});}else{requestAnimationFrame(()=>{if(pageId==='honor-board-page'){renderClassTopThree();var art=document.querySelector('.rank-tab.active');if(art&&art.textContent.includes('\u6bcf\u65e5'))renderQuizRanking();else if(art&&art.textContent.includes('\u5c0f\u732a'))renderPigRunRanking();}else if(pageId==='quiz-page'){if(typeof renderQuizPage==='function')renderQuizPage();var aqt=document.querySelector('.quiz-tab.active');if(aqt&&aqt.textContent.includes('\u5c0f\u732a')){if(typeof renderPigRunPage==='function')renderPigRunPage();}}else if(pageId==='pk-page'){renderPKPage();var sa=document.getElementById('classpk-start-area');if(sa)sa.classList.remove('visible');probePKMonsterImages();}else if(pageId==='jianghu-page'){renderJianghuPage();probeJhBossImages();}});}}
function init(){renderClassList();if(classesData.length&&!currentClassId)currentClassId=classesData[0].id;scheduleAllRenders();/* 延迟非关键页面的初始渲染 */requestAnimationFrame(()=>{renderJianghuPage();probeClassPKRobotImages();});}
window.onload=async function(){
  /* ---- 云端模式：不渲染，等 dal.js 加载数据后调用 init() ---- */
  if(window._cloudMode){
    return;
  }
  init();
  /* ---- EXE 桌面模式：通过 URL #desktop 标记立即判断 ---- */
  if(window.location.hash === '#desktop'){
    /* 等待 pywebview API 就绪 */
    if(!(window.pywebview && window.pywebview.api)){
      await new Promise(resolve => {
        window.addEventListener('pywebviewready', resolve, {once:true});
      });
    }
    try {
      await _desktopLoadData();
      updateUSBStatus(true);
    } catch(e){ console.error('桌面模式初始化失败:', e); }
    return;
  }
  /* ---- 浏览器模式：和原来完全一样 ---- */
  if(window.showDirectoryPicker){
    const hasSaved = await loadDirHandle();
    showStartOverlay(!hasSaved);
  }
};
function showStartOverlay(isFirstTime){
  const ov = document.createElement('div');
  ov.id = 'startOverlay';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(255,230,220,0.97);z-index:9999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(2px);-webkit-backdrop-filter:blur(2px);';
  const tip = isFirstTime
    ? '首次使用，请选择本文件所在的文件夹<br>之后每次打开只需点击「授权」即可'
    : '点击授权后，数据自动保存到同级「数据」文件夹';
  const btnText = isFirstTime ? '📂 选择文件夹并授权' : '🔓 点击授权';
  ov.innerHTML = '<div style="text-align:center;background:white;border-radius:30px;padding:40px 50px;box-shadow:0 20px 60px rgba(255,150,120,0.3);max-width:420px;border:3px solid #ffe0d0;">'
    + '<div style="font-size:60px;margin-bottom:15px;">🍡</div>'
    + '<div style="font-size:24px;font-weight:700;color:#dd7a7a;margin-bottom:10px;">宠物世界</div>'
    + '<div style="color:#886060;margin-bottom:25px;font-size:15px;line-height:1.8;">' + tip + '</div>'
    + '<button id="startAuthBtn" onclick="startWithAuth()" style="background:linear-gradient(135deg,#ffb7b7,#ffc8b0);color:#442222;border:none;border-radius:25px;padding:16px 40px;font-size:18px;font-weight:700;cursor:pointer;box-shadow:0 8px 20px rgba(255,150,120,0.3);transition:all 0.3s;">' + btnText + '</button>'
    + '<div style="margin-top:18px;"><a href="javascript:skipAuth()" style="color:#bbaaaa;font-size:13px;text-decoration:underline;">跳过（数据仅保存在本机浏览器）</a></div>'
    + '</div>';
  document.body.appendChild(ov);
}
async function startWithAuth(){
  const btn = document.getElementById('startAuthBtn');
  if(btn){ btn.disabled=true; btn.textContent='授权中...'; }
  try {
    await connectUSB();
    const ov = document.getElementById('startOverlay');
    if(ov && _dataDirHandle) ov.remove();
    else if(btn){ btn.disabled=false; btn.textContent='🔓 重试授权'; }
  } catch(e) {
    if(btn){ btn.disabled=false; btn.textContent='🔓 重试授权'; }
  }
}
function skipAuth(){
  const ov = document.getElementById('startOverlay');
  if(ov) ov.remove();
  showNotification('提示', '数据仅保存在本机浏览器，换电脑会丢失', 'warning');
}

// ========== 覆盖关键函数，确保爱心正确 ==========
const originalRenderHomePetGrid = renderHomePetGrid;
window.renderHomePetGrid = function() {
  originalRenderHomePetGrid();
  // 宠物卡片浮动延迟（替代 MutationObserver）
  document.querySelectorAll('.home-pet-card').forEach(function(card, i) {
    card.style.animationDelay = (i % 6) * 0.5 + 's';
    card.style.animationDuration = (2.5 + Math.random() * 1.5) + 's';
  });
  // 呼吸随机延迟（替代 petGrid MutationObserver）
  if (window.__initBreathingDelays) window.__initBreathingDelays();
  attachCardHeartListeners();
  if (currentModalStudentId) setTimeout(() => startHeartForCurrentPet(currentModalStudentId), 100);
  else stopAllHeartEmitters();
};
function attachCardHeartListeners() {
  document.querySelectorAll('.home-pet-card').forEach(card => {
    // v46: Prevent duplicate listeners (called from both _applyGridBatchPostProcess and wrapper)
    if (card.dataset.heartListenerAttached) return;
    card.dataset.heartListenerAttached = '1';
    
    const onclick = card.getAttribute('onclick');
    if (!onclick) return;
    const m = onclick.match(/openStudentModal\(['"]([^'"]+)['"]\)/);
    if (!m) return;
    const studentId = m[1];
    card.addEventListener('mouseenter', function() {
      if (currentModalStudentId) return;
      const cur = classesData?.find(c=>c.id===currentClassId);
      if(!cur) return;
      const student = cur.students.find(s=>s.id.toString()===studentId.toString());
      if(!student) return;
      const activePet = getActivePet(student);
      if(!activePet || activePet.isDead) return;
      const topDiv = card.querySelector('.home-pet-top');
      if(topDiv) startHeartForContainer(topDiv);
    });
    card.addEventListener('mouseleave', function() {
      if (currentModalStudentId) return;
      stopAllHeartEmitters();
    });
  });
}
const originalRefreshCurrentStudentModal = refreshCurrentStudentModal;
window.refreshCurrentStudentModal = function() { originalRefreshCurrentStudentModal(); if(currentModalStudentId) setTimeout(()=>startHeartForCurrentPet(currentModalStudentId), 80); else stopAllHeartEmitters(); };
const originalSwitchPage = switchPage;
window.switchPage = function(pageId) { originalSwitchPage(pageId); if(pageId !== 'class-pet-page') stopAllHeartEmitters(); else if(currentModalStudentId) setTimeout(()=>startHeartForCurrentPet(currentModalStudentId), 80); };
const originalCloseModal = closeModal;
window.closeModal = function() { originalCloseModal(); stopAllHeartEmitters(); };
const originalSwitchPet = switchPet;
window.switchPet = function(studentId, petId) { originalSwitchPet(studentId, petId); if(currentModalStudentId === studentId) setTimeout(()=>startHeartForCurrentPet(studentId), 100); };
const originalSetActivePet = setActivePet;
window.setActivePet = function(student, petId) { originalSetActivePet(student, petId); if(currentModalStudentId === student.id) setTimeout(()=>startHeartForCurrentPet(student.id), 100); };
const originalConfirmAdoptPet = confirmAdoptPet;
window.confirmAdoptPet = function(studentId) { originalConfirmAdoptPet(studentId); setTimeout(()=> { if(currentModalStudentId === studentId) startHeartForCurrentPet(studentId); }, 200); };
const originalConfirmChangePet = confirmChangePet;
window.confirmChangePet = function(studentId) { originalConfirmChangePet(studentId); setTimeout(()=> { if(currentModalStudentId === studentId) startHeartForCurrentPet(studentId); }, 200); };
setTimeout(()=> { if(currentModalStudentId) startHeartForCurrentPet(currentModalStudentId); }, 300);

// ========== 宠物PK 核心逻辑（始终保留最后两个选中，圆形子弹攻击特效，保留原音效）==========
let pkState = {
  players: [],      // 存储选中的学生对象 { studentId, studentName, pet }
  isFighting: false
};

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
let _pkChallengeState = { pending: null, _lastShownChallengeId: null };

// v35: Fast poll timer for PK challenge acceptance (reduces delay from 30s to 2s)
let _pkChallengePollTimer = null;

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

// Persistent set of handled challenge IDs (survives log reloads from Supabase)
// This prevents infinite battle loops when logs are re-synced
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

function renderJianghuPage() {
  const container = document.getElementById('jhPageContent');
  if(!container) return;
  if(!currentClassId) {
    container.innerHTML = '<div style="text-align:center;padding:40px;">请先在【宠物管理】页面选择一个班级</div>';
    return;
  }
  const cur = classesData.find(c=>c.id===currentClassId);
  if(!cur || cur.students.length === 0) {
    container.innerHTML = '<div style="text-align:center;padding:40px;">班级中暂无学生</div>';
    return;
  }
  const validStudents = cur.students.filter(s => {
    const p = getActivePet(s);
    return p && !p.isDead;
  });
  let html = renderJianghuColumn(cur, validStudents);
  container.innerHTML = html;
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

// ========== 战斗兽宠系统 ==========
// 三套独立的图片池，严格区分用途：
// 1. _leftMonsterPool  — 无补零数字命名（1.webp~24.webp）→ 宠物PK左侧 + 江湖行宠物变身
// 2. _rightMonsterPool — 补零数字命名（01.webp~024.webp, 010.webp~019.webp）→ 宠物PK右侧
// 3. _jhBossPool       — 中文命名图片 → 萌萌江湖行Boss
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
function playTransformSound() {
  initAudio();
  // 低沉的震动 + 升调爆发
  const now = audioCtx.currentTime;
  // 低频震动
  const bass = audioCtx.createOscillator();
  const bassGain = audioCtx.createGain();
  bass.connect(bassGain); bassGain.connect(masterSfxGain);
  bass.type = 'sawtooth'; bass.frequency.value = 60;
  bass.frequency.linearRampToValueAtTime(200, now + 0.8);
  bassGain.gain.setValueAtTime(0.3, now);
  bassGain.gain.linearRampToValueAtTime(0.5, now + 0.5);
  bassGain.gain.exponentialRampToValueAtTime(0.01, now + 1.0);
  bass.start(now); bass.stop(now + 1.0);
  // 高频爆发
  const burst = audioCtx.createOscillator();
  const burstGain = audioCtx.createGain();
  burst.connect(burstGain); burstGain.connect(masterSfxGain);
  burst.type = 'square'; burst.frequency.value = 800;
  burst.frequency.linearRampToValueAtTime(2000, now + 0.3);
  burstGain.gain.setValueAtTime(0, now + 0.6);
  burstGain.gain.linearRampToValueAtTime(0.4, now + 0.7);
  burstGain.gain.exponentialRampToValueAtTime(0.01, now + 1.0);
  burst.start(now + 0.6); burst.stop(now + 1.0);
}

function playExplosionSound() {
  initAudio();
  const now = audioCtx.currentTime;
  // 噪音爆炸
  const bufferSize = audioCtx.sampleRate * 0.5;
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for(let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.1));
  const noise = audioCtx.createBufferSource();
  noise.buffer = buffer;
  const noiseGain = audioCtx.createGain();
  const noiseFilter = audioCtx.createBiquadFilter();
  noiseFilter.type = 'lowpass'; noiseFilter.frequency.value = 1000;
  noise.connect(noiseFilter); noiseFilter.connect(noiseGain); noiseGain.connect(masterSfxGain);
  noiseGain.gain.setValueAtTime(0.6, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
  noise.start(now);
  // 低频冲击
  const impact = audioCtx.createOscillator();
  const impactGain = audioCtx.createGain();
  impact.connect(impactGain); impactGain.connect(masterSfxGain);
  impact.type = 'sine'; impact.frequency.value = 150;
  impact.frequency.exponentialRampToValueAtTime(30, now + 0.3);
  impactGain.gain.setValueAtTime(0.5, now);
  impactGain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
  impact.start(now); impact.stop(now + 0.3);
}

function playFireballSound() {
  initAudio();
  const now = audioCtx.currentTime;
  // 风声 + 火焰
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain); gain.connect(masterSfxGain);
  osc.type = 'sawtooth'; osc.frequency.value = 300;
  osc.frequency.linearRampToValueAtTime(1500, now + 0.15);
  osc.frequency.linearRampToValueAtTime(200, now + 0.3);
  gain.gain.setValueAtTime(0.25, now);
  gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
  osc.start(now); osc.stop(now + 0.3);
}

function playCriticalSound() {
  initAudio();
  const now = audioCtx.currentTime;
  // 多层音效 - 金属碰撞 + 爆炸
  [1200, 1800, 2400].forEach((f, i) => {
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.connect(g); g.connect(masterSfxGain);
    o.type = 'square'; o.frequency.value = f;
    o.frequency.exponentialRampToValueAtTime(f * 0.3, now + 0.2);
    g.gain.setValueAtTime(0.2, now + i * 0.05);
    g.gain.exponentialRampToValueAtTime(0.01, now + 0.3 + i * 0.05);
    o.start(now + i * 0.05); o.stop(now + 0.3 + i * 0.05);
  });
  // 重低音
  const bass = audioCtx.createOscillator();
  const bassG = audioCtx.createGain();
  bass.connect(bassG); bassG.connect(masterSfxGain);
  bass.type = 'sine'; bass.frequency.value = 80;
  bassG.gain.setValueAtTime(0.4, now);
  bassG.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
  bass.start(now); bass.stop(now + 0.4);
}

function playHitSound() {
  initAudio();
  const now = audioCtx.currentTime;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.connect(g); g.connect(masterSfxGain);
  o.type = 'triangle'; o.frequency.value = 400;
  o.frequency.exponentialRampToValueAtTime(100, now + 0.15);
  g.gain.setValueAtTime(0.3, now);
  g.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
  o.start(now); o.stop(now + 0.15);
}

// ====== 技能池系统 ======
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

// 技能音效
function playSkillSound(type){
  initAudio(); const now=audioCtx.currentTime;
  if(type==='ice'){const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.connect(g);g.connect(masterSfxGain);o.type='sine';o.frequency.value=2000;o.frequency.linearRampToValueAtTime(500,now+0.3);g.gain.setValueAtTime(0.2,now);g.gain.exponentialRampToValueAtTime(0.01,now+0.4);o.start(now);o.stop(now+0.4);}
  else if(type==='thunder'){const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.connect(g);g.connect(masterSfxGain);o.type='square';o.frequency.value=120;o.frequency.linearRampToValueAtTime(40,now+0.5);g.gain.setValueAtTime(0.5,now);g.gain.exponentialRampToValueAtTime(0.01,now+0.5);o.start(now);o.stop(now+0.5);const b=audioCtx.createBufferSource(),buf=audioCtx.createBuffer(1,audioCtx.sampleRate*0.3,audioCtx.sampleRate),d=buf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*Math.exp(-i/(d.length*0.05));b.buffer=buf;const bg=audioCtx.createGain();b.connect(bg);bg.connect(masterSfxGain);bg.gain.setValueAtTime(0.4,now);bg.gain.exponentialRampToValueAtTime(0.01,now+0.3);b.start(now);}
  else if(type==='poison'){const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.connect(g);g.connect(masterSfxGain);o.type='sawtooth';o.frequency.value=150;o.frequency.linearRampToValueAtTime(80,now+0.6);g.gain.setValueAtTime(0.15,now);g.gain.exponentialRampToValueAtTime(0.01,now+0.6);o.start(now);o.stop(now+0.6);}
  else if(type==='wind'){const o=audioCtx.createOscillator(),g=audioCtx.createGain(),f=audioCtx.createBiquadFilter();o.connect(f);f.connect(g);g.connect(masterSfxGain);o.type='sawtooth';f.type='bandpass';f.frequency.value=800;f.Q.value=2;o.frequency.value=300;o.frequency.linearRampToValueAtTime(1200,now+0.2);o.frequency.linearRampToValueAtTime(300,now+0.5);g.gain.setValueAtTime(0.2,now);g.gain.exponentialRampToValueAtTime(0.01,now+0.5);o.start(now);o.stop(now+0.5);}
  else if(type==='shadow'){const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.connect(g);g.connect(masterSfxGain);o.type='sine';o.frequency.value=80;o.frequency.linearRampToValueAtTime(30,now+0.6);g.gain.setValueAtTime(0.35,now);g.gain.exponentialRampToValueAtTime(0.01,now+0.6);o.start(now);o.stop(now+0.6);}
  else if(type==='holy'){[523,659,784].forEach((f,i)=>{const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.connect(g);g.connect(masterSfxGain);o.type='sine';o.frequency.value=f;g.gain.setValueAtTime(0.15,now+i*0.1);g.gain.exponentialRampToValueAtTime(0.01,now+i*0.1+0.5);o.start(now+i*0.1);o.stop(now+i*0.1+0.5);});}
  else{ playFireballSound(); }
}

// 技能特效调度器
function playSkillAttack(fromContainer, toContainer, isCritical, skill, callback){
  if(!fromContainer||!toContainer){if(callback) callback();return;}
  const type=skill.type;
  // 应用技能主题背景
  const arena = fromContainer.closest('.pk-arena') || document.getElementById('pk-arena') || document.getElementById('classpk-robot-arena');
  applySkillThemeBackground(arena, type);
  if(type==='ice') playIceAttack(fromContainer,toContainer,isCritical,callback);
  else if(type==='thunder') playThunderAttack(fromContainer,toContainer,isCritical,callback);
  else if(type==='poison') playPoisonAttack(fromContainer,toContainer,isCritical,callback);
  else if(type==='wind') playWindAttack(fromContainer,toContainer,isCritical,callback);
  else if(type==='shadow') playShadowAttack(fromContainer,toContainer,isCritical,callback);
  else if(type==='meteor') playMeteorAttack(fromContainer,toContainer,isCritical,callback);
  else if(type==='holy') playHolyAttack(fromContainer,toContainer,isCritical,callback);
  else if(type==='lava') playLavaAttack(fromContainer,toContainer,isCritical,callback);
  else if(type==='starburst') playStarburstAttack(fromContainer,toContainer,isCritical,callback);
  else if(type==='dragonfire') playDragonfireAttack(fromContainer,toContainer,isCritical,callback);
  else if(type==='iceground') playIceGroundAttack(fromContainer,toContainer,isCritical,callback);
  else playFireballAttack(fromContainer,toContainer,isCritical,callback);
}

// ==== 冰霜新星 ====
function playIceAttack(from,to,crit,cb){
  const fR=from.getBoundingClientRect(),tR=to.getBoundingClientRect();
  const sx=fR.left+fR.width/2-30,sy=fR.top+fR.height/2-30;
  const ex=tR.left+tR.width/2-30,ey=tR.top+tR.height/2-30;
  const proj=document.createElement('div');
  proj.className='skill-projectile';
  proj.style.cssText=`width:70px;height:70px;border-radius:12px;transform:rotate(45deg);background:radial-gradient(circle,#fff,#aaeeff,#55bbee,#2288cc);box-shadow:0 0 30px 12px rgba(100,200,255,0.9),0 0 60px 20px rgba(50,150,255,0.5),0 0 100px 30px rgba(100,200,255,0.3);left:${sx}px;top:${sy}px;`;
  document.body.appendChild(proj);
  playSkillSound('ice');
  // Snowstorm trail
  const dur=crit?350:260,st=performance.now();
  let tc=0;
  function anim(t){const el=t-st,p=Math.min(1,el/dur),e=p<0.5?2*p*p:1-Math.pow(-2*p+2,2)/2;
    const cx=sx+(ex-sx)*e,cy=sy+(ey-sy)*e-Math.sin(p*Math.PI)*35;
    proj.style.left=cx+'px';proj.style.top=cy+'px';
    tc++;if(tc%2===0){
      for(let k=0;k<3;k++){
        const tr=document.createElement('div');
        const offX=(Math.random()-0.5)*40,offY=(Math.random()-0.5)*40;
        tr.style.cssText=`position:fixed;pointer-events:none;z-index:10001;width:${8+Math.random()*12}px;height:${8+Math.random()*12}px;border-radius:50%;background:rgba(200,240,255,${0.5+Math.random()*0.4});box-shadow:0 0 12px rgba(100,200,255,0.7);left:${cx+25+offX}px;top:${cy+25+offY}px;animation:fireballTrail 0.7s ease-out forwards;`;
        document.body.appendChild(tr);setTimeout(()=>tr.remove(),700);
      }
    }
    if(p<1)requestAnimationFrame(anim);
    else{proj.remove();
      // Screen shake
      const arena=document.getElementById('pk-arena');if(arena){arena.classList.add('screen-shake-heavy');setTimeout(()=>arena.classList.remove('screen-shake-heavy'),500);}
      // Flash
      const flash=document.createElement('div');flash.className='screen-flash';flash.style.background='rgba(150,220,255,0.6)';document.body.appendChild(flash);setTimeout(()=>flash.remove(),300);
      to.classList.add('ice-freeze');createIceShatter(to,crit);playSkillSound('ice');
      // Ice block encase
      const iceBlock=document.createElement('div');iceBlock.className='ice-block-encase';to.style.position='relative';to.appendChild(iceBlock);setTimeout(()=>iceBlock.remove(),1300);
      if(crit){playCriticalSound();}else{playHitSound();}
      setTimeout(()=>{to.classList.remove('ice-freeze');},1400);if(cb)setTimeout(cb,300);}
  }requestAnimationFrame(anim);
}
function createIceShatter(container,crit){
  const n=crit?36:20;const colors=['#aaddff','#66ccff','#ffffff','#88eeff','#4499dd','#ccf0ff'];
  for(let i=0;i<n;i++){const s=document.createElement('div');s.className='ice-shard';
    const angle=(Math.PI*2/n)*i+Math.random()*0.5;const dist=60+Math.random()*(crit?130:80);
    s.style.setProperty('--ex',Math.cos(angle)*dist+'px');s.style.setProperty('--ey',Math.sin(angle)*dist+'px');
    s.style.setProperty('--rot',(Math.random()*540)+'deg');
    const sz=10+Math.random()*(crit?22:14);s.style.width=sz+'px';s.style.height=sz*1.8+'px';
    s.style.backgroundColor=colors[Math.floor(Math.random()*colors.length)];
    s.style.boxShadow=`0 0 12px ${s.style.backgroundColor},0 0 20px rgba(100,200,255,0.4)`;
    s.style.left='50%';s.style.top='50%';container.style.position='relative';container.appendChild(s);
    setTimeout(()=>s.remove(),1100);
  }
  // Double rings
  for(let r=0;r<2;r++){
    const ring=document.createElement('div');ring.className='energy-ring';ring.style.borderColor='rgba(100,200,255,0.9)';
    const sz=crit?160+r*40:100+r*30;ring.style.width=sz+'px';ring.style.height=sz+'px';ring.style.margin=`-${sz/2}px 0 0 -${sz/2}px`;
    ring.style.animationDelay=r*0.15+'s';
    container.appendChild(ring);setTimeout(()=>ring.remove(),900);
  }
}

// ==== 雷神之怒 ====
function playThunderAttack(from,to,crit,cb){
  const tR=to.getBoundingClientRect();
  const cx=tR.left+tR.width/2,cy=tR.top;
  playSkillSound('thunder');
  const arena=document.getElementById('pk-arena');
  // Full white screen flash
  const flash=document.createElement('div');flash.className='screen-flash';flash.style.background='rgba(255,255,255,0.95)';
  document.body.appendChild(flash);setTimeout(()=>flash.remove(),400);
  // Second flash wave
  setTimeout(()=>{const f2=document.createElement('div');f2.className='screen-flash';f2.style.background='rgba(200,230,255,0.7)';document.body.appendChild(f2);setTimeout(()=>f2.remove(),300);},150);
  // Multiple thick lightning bolts
  const boltCount=crit?8:5;
  for(let i=0;i<boltCount;i++){
    setTimeout(()=>{
      const bolt=document.createElement('div');bolt.className='lightning-bolt';
      const offsetX=(Math.random()-0.5)*100;
      bolt.style.left=(cx+offsetX)+'px';bolt.style.top='0px';bolt.style.height=(cy+tR.height/2)+'px';
      bolt.style.transform=`rotate(${(Math.random()-0.5)*12}deg)`;
      bolt.style.width=(6+Math.random()*6)+'px';
      document.body.appendChild(bolt);setTimeout(()=>bolt.remove(),500);
    },i*60);
  }
  // Electric orbs
  setTimeout(()=>{
    for(let i=0;i<(crit?6:3);i++){
      const orb=document.createElement('div');orb.className='electric-orb';
      const sz=15+Math.random()*20;orb.style.width=sz+'px';orb.style.height=sz+'px';
      orb.style.left=(20+Math.random()*60)+'%';orb.style.top=(20+Math.random()*60)+'%';
      to.style.position='relative';to.appendChild(orb);setTimeout(()=>orb.remove(),700);
    }
  },boltCount*60);
  setTimeout(()=>{
    if(arena){arena.classList.add('thunder-shake');setTimeout(()=>arena.classList.remove('thunder-shake'),800);}
    createHitExplosion(to,crit);
    const colors=crit?['#ffffff','#88ddff','#4488ff','#ffdd00','#aaeeff']:['#88ddff','#ffffff','#aaccff','#66bbff'];
    const expDiv=document.createElement('div');expDiv.className='explosion-container';to.style.position='relative';to.appendChild(expDiv);
    for(let i=0;i<(crit?30:18);i++){const p=document.createElement('div');p.className='explosion-particle';
      const a=(Math.PI*2/18)*i;const d=40+Math.random()*70;p.style.setProperty('--ex',Math.cos(a)*d+'px');p.style.setProperty('--ey',Math.sin(a)*d+'px');
      p.style.width=(4+Math.random()*8)+'px';p.style.height='3px';p.style.backgroundColor=colors[Math.floor(Math.random()*colors.length)];
      p.style.boxShadow=`0 0 12px ${p.style.backgroundColor}`;p.style.borderRadius='2px';expDiv.appendChild(p);}
    setTimeout(()=>expDiv.remove(),900);
    // Electric arcs dancing around pet AFTER hit
    for(let i=0;i<(crit?8:5);i++){
      const arc=document.createElement('div');arc.className='electric-arc';
      arc.style.setProperty('--arc-angle',(Math.random()*360)+'deg');
      arc.style.left=(15+Math.random()*70)+'%';arc.style.top=(15+Math.random()*70)+'%';
      arc.style.height=(12+Math.random()*18)+'px';
      to.appendChild(arc);setTimeout(()=>arc.remove(),800);
    }
    if(crit)playCriticalSound();else playHitSound();
    if(cb)setTimeout(cb,350);
  },boltCount*60+80);
}

// ==== 剧毒吐息 ====
function playPoisonAttack(from,to,crit,cb){
  const fR=from.getBoundingClientRect(),tR=to.getBoundingClientRect();
  const sx=fR.left+fR.width/2,sy=fR.top+fR.height/2;
  const ex=tR.left+tR.width/2,ey=tR.top+tR.height/2;
  playSkillSound('poison');
  // Green screen tint
  const tint=document.createElement('div');tint.className='screen-tint';tint.style.background='rgba(50,200,0,0.3)';document.body.appendChild(tint);setTimeout(()=>tint.remove(),1200);
  // Giant toxic tsunami wave
  const count=crit?14:9;
  for(let i=0;i<count;i++){
    setTimeout(()=>{
      const p=document.createElement('div');p.className='skill-projectile';
      const sz=14+Math.random()*20;
      p.style.cssText=`width:${sz}px;height:${sz}px;border-radius:50%;background:radial-gradient(circle,#eeff33,#ccff33,#66cc00,#338800);box-shadow:0 0 18px rgba(100,255,0,0.9),0 0 35px rgba(50,200,0,0.5);left:${sx}px;top:${sy}px;opacity:0.95;`;
      document.body.appendChild(p);
      const dur=220+Math.random()*150,st2=performance.now();
      const offX=(Math.random()-0.5)*60,offY=(Math.random()-0.5)*60;
      function anim(t){const el=t-st2,pr=Math.min(1,el/dur);
        p.style.left=(sx+(ex+offX-sx)*pr)+'px';p.style.top=(sy+(ey+offY-sy)*pr-Math.sin(pr*Math.PI)*20)+'px';
        if(pr<1)requestAnimationFrame(anim);else p.remove();
      }requestAnimationFrame(anim);
    },i*45);
  }
  setTimeout(()=>{
    // Screen shake
    const arena=document.getElementById('pk-arena');if(arena){arena.classList.add('screen-shake-heavy');setTimeout(()=>arena.classList.remove('screen-shake-heavy'),500);}
    to.classList.add('poison-hit');
    // Massive poison clouds
    for(let i=0;i<(crit?8:5);i++){
      const c=document.createElement('div');c.className='poison-cloud';
      const sz=80+Math.random()*60;c.style.width=sz+'px';c.style.height=sz+'px';
      c.style.left=(10+Math.random()*80)+'%';c.style.top=(10+Math.random()*80)+'%';
      to.style.position='relative';to.appendChild(c);setTimeout(()=>c.remove(),2000);
    }
    // Poison bubbles rising everywhere
    for(let i=0;i<(crit?12:7);i++){
      setTimeout(()=>{
        const b=document.createElement('div');b.className='poison-bubble';
        const sz=6+Math.random()*12;b.style.width=sz+'px';b.style.height=sz+'px';
        b.style.left=(Math.random()*100)+'%';b.style.bottom='0';
        to.appendChild(b);setTimeout(()=>b.remove(),1800);
      },Math.random()*500);
    }
    // Toxic skulls floating up
    for(let i=0;i<(crit?4:2);i++){
      setTimeout(()=>{
        const skull=document.createElement('div');skull.className='poison-skull';skull.textContent='☠';
        skull.style.left=(20+Math.random()*60)+'%';skull.style.top=(40+Math.random()*30)+'%';
        to.appendChild(skull);setTimeout(()=>skull.remove(),1500);
      },i*200);
    }
    if(crit)playCriticalSound();else playHitSound();
    setTimeout(()=>to.classList.remove('poison-hit'),1500);
    if(cb)setTimeout(cb,350);
  },count*45+240);
}

// ==== 暴风旋涡 ====
function playWindAttack(from,to,crit,cb){
  playSkillSound('wind');
  const tR=to.getBoundingClientRect();
  const arena=document.getElementById('pk-arena');
  // Screen shake
  if(arena){arena.classList.add('screen-shake-heavy');setTimeout(()=>arena.classList.remove('screen-shake-heavy'),600);}
  // Full tornado covering the pet - many rings
  const ringCount=crit?10:7;
  for(let i=0;i<ringCount;i++){
    setTimeout(()=>{
      const r=document.createElement('div');r.className='tornado-ring';
      const sz=30+i*18;r.style.width=sz+'px';r.style.height=sz*0.4+'px';
      r.style.left='50%';r.style.bottom=(5+i*10)+'%';r.style.marginLeft=(-sz/2)+'px';
      r.style.borderWidth='4px';
      to.style.position='relative';to.appendChild(r);setTimeout(()=>r.remove(),1100);
    },i*70);
  }
  // Massive horizontal wind lines across entire screen
  for(let i=0;i<(crit?10:6);i++){
    setTimeout(()=>{
      const wl=document.createElement('div');wl.className='wind-line';
      wl.style.top=(10+Math.random()*80)+'%';wl.style.left='0';wl.style.width=(60+Math.random()*40)+'%';
      document.body.appendChild(wl);setTimeout(()=>wl.remove(),600);
    },i*60);
  }
  // Debris flying everywhere
  for(let i=0;i<(crit?20:12);i++){
    setTimeout(()=>{
      const d=document.createElement('div');d.className='wind-debris';
      const sz=3+Math.random()*6;d.style.width=sz+'px';d.style.height=sz*0.6+'px';
      d.style.setProperty('--dx',(Math.random()>0.5?1:-1)*(60+Math.random()*80)+'px');
      d.style.setProperty('--dy',(-30+Math.random()*60)+'px');
      d.style.left=(Math.random()*100)+'%';d.style.top=(Math.random()*100)+'%';
      to.style.position='relative';to.appendChild(d);setTimeout(()=>d.remove(),1000);
    },Math.random()*500);
  }
  // Wind particles
  for(let i=0;i<(crit?25:15);i++){
    setTimeout(()=>{
      const p=document.createElement('div');
      p.style.cssText=`position:absolute;pointer-events:none;z-index:100;width:${4+Math.random()*7}px;height:${4+Math.random()*7}px;border-radius:50%;background:rgba(180,220,255,${0.6+Math.random()*0.4});box-shadow:0 0 10px rgba(150,200,255,0.7);left:${Math.random()*100}%;top:${Math.random()*100}%;animation:tornadoSpin ${0.4+Math.random()*0.6}s ease-out forwards;`;
      to.style.position='relative';to.appendChild(p);setTimeout(()=>p.remove(),1000);
    },Math.random()*500);
  }
  setTimeout(()=>{
    to.classList.add('wind-hit');if(crit)playCriticalSound();else playHitSound();
    setTimeout(()=>to.classList.remove('wind-hit'),1000);
    if(cb)setTimeout(cb,350);
  },400);
}

// ==== 暗影侵蚀 ====
function playShadowAttack(from,to,crit,cb){
  playSkillSound('shadow');
  const arena=document.getElementById('pk-arena');
  // Screen dims dramatically
  const tint=document.createElement('div');tint.className='screen-tint';tint.style.background='rgba(0,0,0,0.6)';tint.style.animationDuration='1.5s';document.body.appendChild(tint);setTimeout(()=>tint.remove(),1500);
  // Multiple giant dark slashes crossing the screen
  const slashCount=crit?5:3;
  for(let i=0;i<slashCount;i++){
    setTimeout(()=>{
      const s=document.createElement('div');s.className='shadow-slash-overlay';
      s.style.transform=`rotate(${-60+i*30+Math.random()*20}deg)`;
      to.style.position='relative';to.appendChild(s);setTimeout(()=>s.remove(),700);
    },i*120);
  }
  // Black hole vortex at center
  const vortex=document.createElement('div');vortex.className='dark-vortex';
  to.style.position='relative';to.appendChild(vortex);setTimeout(()=>vortex.remove(),1100);
  // Dark lightning bolts
  for(let i=0;i<(crit?5:3);i++){
    setTimeout(()=>{
      const dl=document.createElement('div');dl.className='dark-lightning';
      dl.style.left=(20+Math.random()*60)+'%';dl.style.top='0';dl.style.height=(40+Math.random()*50)+'%';
      dl.style.transform=`rotate(${(Math.random()-0.5)*30}deg)`;
      to.appendChild(dl);setTimeout(()=>dl.remove(),500);
    },200+i*100);
  }
  // Shadow particles pulled into vortex
  for(let i=0;i<(crit?35:20);i++){
    setTimeout(()=>{
      const p=document.createElement('div');
      const angle=Math.random()*Math.PI*2;const dist=100+Math.random()*60;
      const startX=50+Math.cos(angle)*dist;const startY=50+Math.sin(angle)*dist;
      p.style.cssText=`position:absolute;pointer-events:none;z-index:99;width:${5+Math.random()*10}px;height:${5+Math.random()*10}px;border-radius:50%;background:rgba(${Math.random()>0.5?'150,0,255':'60,0,120'},0.9);box-shadow:0 0 15px rgba(120,0,255,0.7);left:${startX}%;top:${startY}%;transition:all 0.5s ease-in;`;
      to.style.position='relative';to.appendChild(p);
      requestAnimationFrame(()=>{p.style.left='50%';p.style.top='50%';p.style.opacity='0';p.style.transform='scale(0)';});
      setTimeout(()=>p.remove(),600);
    },Math.random()*400);
  }
  setTimeout(()=>{
    if(arena){arena.classList.add('screen-shake-heavy');setTimeout(()=>arena.classList.remove('screen-shake-heavy'),500);}
    to.classList.add('dark-hit');
    if(crit){playCriticalSound();
      const slash=document.createElement('div');slash.className='critical-slash';slash.style.background='linear-gradient(90deg,transparent,rgba(150,0,255,1),#fff,rgba(150,0,255,1),transparent)';slash.style.width='250px';slash.style.marginLeft='-125px';to.appendChild(slash);setTimeout(()=>slash.remove(),500);
      const slash2=document.createElement('div');slash2.className='critical-slash';slash2.style.background='linear-gradient(90deg,transparent,rgba(100,0,200,1),transparent)';slash2.style.transform='rotate(90deg)';to.appendChild(slash2);setTimeout(()=>slash2.remove(),500);
    }else playHitSound();
    setTimeout(()=>to.classList.remove('dark-hit'),1000);
    if(cb)setTimeout(cb,350);
  },slashCount*120+150);
}

// ==== 陨石坠落 ====
function playMeteorAttack(from,to,crit,cb){
  const tR=to.getBoundingClientRect();
  const tx=tR.left+tR.width/2-50,ty=tR.top+tR.height/2-50;
  playSkillSound('fire');
  // Fire screen tint
  const tint=document.createElement('div');tint.className='screen-tint';tint.style.background='rgba(255,80,0,0.25)';document.body.appendChild(tint);setTimeout(()=>tint.remove(),1500);
  // 5-7 meteors raining down
  const meteorCount=crit?7:5;
  for(let i=0;i<meteorCount;i++){
    setTimeout(()=>{
      const m=document.createElement('div');m.className='meteor';
      const offX=(Math.random()-0.5)*120;
      m.style.left=(tx+offX)+'px';m.style.top=ty+'px';
      m.style.setProperty('--startX',(-80+offX*1.5)+'px');m.style.setProperty('--startY','-350px');
      document.body.appendChild(m);
      // Tail
      const tail=document.createElement('div');tail.className='meteor-tail';
      tail.style.left=(tx+offX+30)+'px';tail.style.top=(ty-80)+'px';
      document.body.appendChild(tail);
      setTimeout(()=>{m.remove();tail.remove();},800);
    },i*150);
  }
  // Fire rain continues after impact
  setTimeout(()=>{
    for(let i=0;i<(crit?20:12);i++){
      setTimeout(()=>{
        const fr=document.createElement('div');fr.className='fire-rain';
        fr.style.left=(tR.left+Math.random()*tR.width)+'px';fr.style.top='-20px';
        document.body.appendChild(fr);setTimeout(()=>fr.remove(),900);
      },Math.random()*600);
    }
  },meteorCount*150);
  setTimeout(()=>{
    const arena=document.getElementById('pk-arena');
    if(arena){arena.classList.add('screen-shake-heavy');setTimeout(()=>arena.classList.remove('screen-shake-heavy'),600);}
    // Flash
    const flash=document.createElement('div');flash.className='screen-flash';flash.style.background='rgba(255,150,0,0.7)';document.body.appendChild(flash);setTimeout(()=>flash.remove(),350);
    createHitExplosion(to,true);
    // Crater effect
    const crater=document.createElement('div');crater.className='meteor-crater';to.style.position='relative';to.appendChild(crater);setTimeout(()=>crater.remove(),900);
    playExplosionSound();
    if(crit)playCriticalSound();else playHitSound();
    if(cb)setTimeout(cb,350);
  },meteorCount*150+450);
}

// ==== 圣光审判 ====
function playHolyAttack(from,to,crit,cb){
  playSkillSound('holy');
  const arena=document.getElementById('pk-arena');
  // White-gold screen flash
  const flash=document.createElement('div');flash.className='screen-flash';flash.style.background='rgba(255,255,200,0.8)';document.body.appendChild(flash);setTimeout(()=>flash.remove(),400);
  // Massive golden light pillar covering the whole pet
  const beam=document.createElement('div');beam.className='holy-beam';
  beam.style.width='90%';beam.style.left='5%';
  if(crit){beam.style.width='110%';beam.style.left='-5%';beam.style.background='linear-gradient(180deg,transparent,rgba(255,255,150,0.6),rgba(255,215,0,1),rgba(255,255,100,1),rgba(255,215,0,1),rgba(255,255,150,0.6),transparent)';}
  to.style.position='relative';to.appendChild(beam);setTimeout(()=>beam.remove(),1100);
  // Cross-shaped light beams shooting in all directions
  setTimeout(()=>{
    const cross1=document.createElement('div');cross1.style.cssText=`position:absolute;left:50%;top:50%;width:200%;height:6px;margin-left:-100%;margin-top:-3px;background:linear-gradient(90deg,transparent,rgba(255,255,200,0.9),#fff,rgba(255,255,200,0.9),transparent);pointer-events:none;z-index:102;animation:lightningFlash 0.5s ease-out forwards;box-shadow:0 0 20px rgba(255,255,100,0.8);`;
    const cross2=document.createElement('div');cross2.style.cssText=`position:absolute;left:50%;top:50%;width:6px;height:200%;margin-left:-3px;margin-top:-100%;background:linear-gradient(180deg,transparent,rgba(255,255,200,0.9),#fff,rgba(255,255,200,0.9),transparent);pointer-events:none;z-index:102;animation:lightningFlash 0.5s ease-out forwards;box-shadow:0 0 20px rgba(255,255,100,0.8);`;
    const cross3=document.createElement('div');cross3.style.cssText=`position:absolute;left:50%;top:50%;width:150%;height:4px;margin-left:-75%;margin-top:-2px;background:linear-gradient(90deg,transparent,rgba(255,215,0,0.8),transparent);pointer-events:none;z-index:102;transform:rotate(45deg);animation:lightningFlash 0.5s ease-out forwards;`;
    const cross4=document.createElement('div');cross4.style.cssText=`position:absolute;left:50%;top:50%;width:150%;height:4px;margin-left:-75%;margin-top:-2px;background:linear-gradient(90deg,transparent,rgba(255,215,0,0.8),transparent);pointer-events:none;z-index:102;transform:rotate(-45deg);animation:lightningFlash 0.5s ease-out forwards;`;
    to.appendChild(cross1);to.appendChild(cross2);to.appendChild(cross3);to.appendChild(cross4);
    setTimeout(()=>{cross1.remove();cross2.remove();cross3.remove();cross4.remove();},600);
  },200);
  // Stars descending
  for(let i=0;i<(crit?8:5);i++){
    setTimeout(()=>{
      const star=document.createElement('div');star.className='holy-star';star.textContent='✦';
      star.style.left=(10+Math.random()*80)+'%';star.style.top=(Math.random()*40)+'%';
      star.style.color=Math.random()>0.5?'#ffd700':'#fff';
      to.appendChild(star);setTimeout(()=>star.remove(),1600);
    },Math.random()*600);
  }
  // Light particles rising
  for(let i=0;i<(crit?30:18);i++){
    setTimeout(()=>{
      const p=document.createElement('div');
      p.style.cssText=`position:absolute;pointer-events:none;z-index:101;width:${4+Math.random()*8}px;height:${4+Math.random()*8}px;border-radius:50%;background:rgba(255,255,${100+Math.random()*155},0.95);box-shadow:0 0 14px rgba(255,255,150,0.9),0 0 25px rgba(255,215,0,0.5);left:${10+Math.random()*80}%;bottom:0;animation:emberFloat ${0.8+Math.random()*1.5}s ease-out forwards;`;
      to.appendChild(p);setTimeout(()=>p.remove(),2500);
    },Math.random()*500);
  }
  setTimeout(()=>{
    if(arena){arena.classList.add('screen-shake-heavy');setTimeout(()=>arena.classList.remove('screen-shake-heavy'),500);}
    to.classList.add('holy-hit');
    if(crit)playCriticalSound();else playHitSound();
    setTimeout(()=>to.classList.remove('holy-hit'),1200);
    if(cb)setTimeout(cb,400);
  },450);
}

// ==== 岩浆喷发 ====
function playLavaAttack(from,to,crit,cb){
  playSkillSound('fire');
  const arena=document.getElementById('pk-arena');
  to.style.position='relative';
  // Red-orange screen tint
  const tint=document.createElement('div');tint.className='screen-tint';tint.style.background='rgba(255,60,0,0.3)';document.body.appendChild(tint);setTimeout(()=>tint.remove(),1200);
  // Ground splits open with lava underneath
  const crack=document.createElement('div');crack.className='lava-crack';to.appendChild(crack);setTimeout(()=>crack.remove(),1100);
  // Massive lava geysers erupting through the pet
  const geyserCount=crit?5:3;
  for(let i=0;i<geyserCount;i++){
    setTimeout(()=>{
      const g=document.createElement('div');g.className='lava-geyser';
      g.style.left=(15+i*(70/geyserCount)+Math.random()*10)+'%';
      g.style.setProperty('--geyser-h',(80+Math.random()*100)+'px');
      g.style.width=(14+Math.random()*12)+'px';
      to.appendChild(g);setTimeout(()=>g.remove(),900);
    },i*100);
  }
  // Molten rocks everywhere
  const n=crit?45:28;
  for(let i=0;i<n;i++){
    setTimeout(()=>{
      const s=document.createElement('div');s.className='lava-splash';
      const angle=Math.random()*Math.PI*2;const dist=40+Math.random()*(crit?110:70);
      s.style.setProperty('--ex',Math.cos(angle)*dist+'px');
      s.style.setProperty('--ey',(Math.sin(angle)*dist-40-Math.random()*60)+'px');
      s.style.setProperty('--rot',(Math.random()*900)+'deg');
      s.style.left='50%';s.style.bottom='10%';
      to.appendChild(s);setTimeout(()=>s.remove(),1200);
    },Math.random()*400);
  }
  // Bottom lava glow - bigger
  const glow=document.createElement('div');
  glow.style.cssText=`position:absolute;bottom:0;left:0;width:100%;height:60%;pointer-events:none;z-index:99;background:linear-gradient(to top,rgba(255,50,0,0.8),rgba(255,120,0,0.5),rgba(255,200,0,0.2),transparent);border-radius:0 0 20px 20px;animation:lavaCrackGlow 1.2s ease-out forwards;`;
  to.appendChild(glow);setTimeout(()=>glow.remove(),1300);
  setTimeout(()=>{
    to.classList.add('lava-hit');
    if(arena){arena.classList.add('screen-shake-heavy');setTimeout(()=>arena.classList.remove('screen-shake-heavy'),600);}
    // Flash
    const flash=document.createElement('div');flash.className='screen-flash';flash.style.background='rgba(255,100,0,0.5)';document.body.appendChild(flash);setTimeout(()=>flash.remove(),300);
    playExplosionSound();
    if(crit)playCriticalSound();else playHitSound();
    setTimeout(()=>{to.classList.remove('lava-hit');},1000);
    if(cb)setTimeout(cb,350);
  },400);
}

// ==== 星爆冲击 ====
function playStarburstAttack(from,to,crit,cb){
  playSkillSound('holy');
  const arena=document.getElementById('pk-arena');
  to.style.position='relative';
  // Galaxy swirl effect
  const galaxy=document.createElement('div');galaxy.className='galaxy-swirl';
  to.appendChild(galaxy);setTimeout(()=>galaxy.remove(),1300);
  // Rainbow screen flash
  const flash=document.createElement('div');flash.className='screen-flash';flash.style.background='linear-gradient(135deg,rgba(255,100,200,0.4),rgba(100,100,255,0.4),rgba(100,255,200,0.4))';document.body.appendChild(flash);setTimeout(()=>flash.remove(),350);
  // Massive starburst rays - nova explosion
  const n=crit?24:16;
  setTimeout(()=>{
    for(let i=0;i<n;i++){
      const s=document.createElement('div');s.className='starburst';
      s.style.setProperty('--angle',(360/n*i)+'deg');
      s.style.left='50%';s.style.top='50%';s.style.marginLeft='-4px';
      const colors=['#fff,#ffdd44,#ff8800,transparent','#fff,#ff66aa,#cc00ff,transparent','#fff,#66ffaa,#0088ff,transparent','#fff,#ffaa00,#ff4400,transparent'];
      s.style.background=`linear-gradient(to bottom,${colors[i%colors.length]})`;
      s.style.height=crit?'60px':'45px';
      to.appendChild(s);setTimeout(()=>s.remove(),1000);
    }
    // Cosmic rays - second ring
    for(let i=0;i<(crit?12:8);i++){
      const s=document.createElement('div');s.className='starburst';
      s.style.setProperty('--angle',(360/(crit?12:8)*i+15)+'deg');
      s.style.left='50%';s.style.top='50%';s.style.marginLeft='-3px';s.style.width='5px';
      s.style.background='linear-gradient(to bottom,#fff,#aaddff,transparent)';
      s.style.height=crit?'80px':'55px';s.style.animationDelay='0.1s';
      to.appendChild(s);setTimeout(()=>s.remove(),1100);
    }
  },200);
  // Center flash - bigger
  const center=document.createElement('div');
  center.style.cssText=`position:absolute;left:50%;top:50%;width:40px;height:40px;margin:-20px 0 0 -20px;border-radius:50%;background:#fff;box-shadow:0 0 60px 30px rgba(255,220,100,1),0 0 120px 60px rgba(255,150,0,0.7),0 0 180px 80px rgba(255,100,200,0.4);pointer-events:none;z-index:101;animation:energyCharge 0.8s ease-out forwards;`;
  to.appendChild(center);setTimeout(()=>center.remove(),900);
  setTimeout(()=>{
    if(arena){arena.classList.add('screen-shake-heavy');setTimeout(()=>arena.classList.remove('screen-shake-heavy'),500);}
    createHitExplosion(to,crit);
    if(crit)playCriticalSound();else playHitSound();
    if(cb)setTimeout(cb,300);
  },400);
}

// ==== 龙息吐焰 ====
function playDragonfireAttack(from,to,crit,cb){
  const fR=from.getBoundingClientRect(),tR=to.getBoundingClientRect();
  const sx=fR.left+fR.width/2,sy=fR.top+fR.height/2;
  const ex=tR.left+tR.width/2,ey=tR.top+tR.height/2;
  playSkillSound('fire');
  const arena=document.getElementById('pk-arena');
  // Fire screen tint
  const tint=document.createElement('div');tint.className='screen-tint';tint.style.background='rgba(255,80,0,0.2)';document.body.appendChild(tint);setTimeout(()=>tint.remove(),1500);
  // Massive sustained flame beam - more particles, wider spread covering half the screen
  const count=crit?55:35;let spawned=0;
  const interval=setInterval(()=>{
    if(spawned>=count){clearInterval(interval);return;}
    // Spawn 2-3 particles per tick for density
    for(let k=0;k<(crit?3:2);k++){
      const p=document.createElement('div');
      const sz=10+Math.random()*18;const colors=['#ff1100','#ff3300','#ff6600','#ffaa00','#ffcc33','#ffee88','#fff'];
      p.style.cssText=`position:fixed;pointer-events:none;z-index:10002;width:${sz}px;height:${sz}px;border-radius:50%;background:${colors[Math.floor(Math.random()*colors.length)]};box-shadow:0 0 ${sz+5}px rgba(255,100,0,0.9),0 0 ${sz+15}px rgba(255,50,0,0.4);left:${sx}px;top:${sy}px;opacity:0.95;`;
      document.body.appendChild(p);
      const dur=200+Math.random()*120,st2=performance.now();
      const offX=(Math.random()-0.5)*80,offY=(Math.random()-0.5)*80;
      function anim(t){const el=t-st2,pr=Math.min(1,el/dur);
        p.style.left=(sx+(ex+offX-sx)*pr)+'px';p.style.top=(sy+(ey+offY-sy)*pr)+'px';
        p.style.opacity=(1-pr*0.7);p.style.transform=`scale(${1+pr*0.5})`;
        if(pr<1)requestAnimationFrame(anim);else p.remove();
      }requestAnimationFrame(anim);
    }
    spawned++;
  },15);
  // Target completely engulfed in fire + flame vortex
  setTimeout(()=>{
    to.style.position='relative';
    // Flame engulf overlay
    const engulf=document.createElement('div');
    engulf.style.cssText=`position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:101;background:radial-gradient(ellipse,rgba(255,200,0,0.6),rgba(255,100,0,0.5),rgba(255,50,0,0.3),transparent);border-radius:20px;animation:lavaCrackGlow 1s ease-in-out forwards;`;
    to.appendChild(engulf);setTimeout(()=>engulf.remove(),1100);
    // Flame vortex rings
    for(let i=0;i<(crit?6:4);i++){
      setTimeout(()=>{
        const r=document.createElement('div');r.className='tornado-ring';
        r.style.borderColor='rgba(255,150,0,0.8)';r.style.boxShadow='0 0 15px rgba(255,100,0,0.6)';
        const sz=30+i*15;r.style.width=sz+'px';r.style.height=sz*0.4+'px';
        r.style.left='50%';r.style.bottom=(10+i*12)+'%';r.style.marginLeft=(-sz/2)+'px';
        to.appendChild(r);setTimeout(()=>r.remove(),900);
      },i*80);
    }
  },count*10);
  setTimeout(()=>{
    createHitExplosion(to,crit);
    if(arena){arena.classList.add('screen-shake-heavy');setTimeout(()=>arena.classList.remove('screen-shake-heavy'),600);}
    const flash=document.createElement('div');flash.className='screen-flash';flash.style.background='rgba(255,100,0,0.5)';document.body.appendChild(flash);setTimeout(()=>flash.remove(),300);
    playExplosionSound();
    if(crit)playCriticalSound();else playHitSound();
    if(cb)setTimeout(cb,350);
  },count*15+250);
}

// ==== 冰封裂地 ====
function playIceGroundAttack(from,to,crit,cb){
  playSkillSound('ice');
  const arena=document.getElementById('pk-arena');
  to.style.position='relative';
  // Ice blue screen tint
  const tint=document.createElement('div');tint.className='screen-tint';tint.style.background='rgba(100,200,255,0.25)';document.body.appendChild(tint);setTimeout(()=>tint.remove(),1200);
  // Freezing wave expanding outward
  const wave=document.createElement('div');wave.className='energy-ring';wave.style.borderColor='rgba(100,200,255,0.9)';wave.style.width='200px';wave.style.height='200px';wave.style.margin='-100px 0 0 -100px';wave.style.boxShadow='0 0 30px rgba(100,200,255,0.6)';
  to.appendChild(wave);setTimeout(()=>wave.remove(),800);
  // Giant ice pillars (10+) that PIERCE THROUGH the pet body, semi-transparent
  const pillarCount=crit?14:10;
  for(let i=0;i<pillarCount;i++){
    setTimeout(()=>{
      const pillar=document.createElement('div');
      const w=10+Math.random()*14,h=150+Math.random()*100;
      pillar.style.cssText=`position:absolute;pointer-events:none;z-index:102;width:${w}px;height:0;bottom:0;left:${5+i*(90/pillarCount)+Math.random()*5}%;background:linear-gradient(to top,rgba(100,180,255,0.7),rgba(150,220,255,0.6),rgba(200,240,255,0.5),rgba(255,255,255,0.8));border-radius:${w/2}px ${w/2}px 3px 3px;box-shadow:0 0 15px rgba(100,200,255,0.7),0 0 30px rgba(100,200,255,0.4),inset 0 0 10px rgba(255,255,255,0.3);transition:height 0.35s cubic-bezier(0.2,1.2,0.3,1);opacity:0.85;clip-path:polygon(15% 100%,50% 0%,85% 100%);`;
      to.appendChild(pillar);
      requestAnimationFrame(()=>{pillar.style.height=h+'px';});
      setTimeout(()=>{pillar.style.opacity='0';pillar.style.transition='opacity 0.4s';},700);
      setTimeout(()=>pillar.remove(),1200);
    },i*60);
  }
  // Ice shards flying out on impact
  setTimeout(()=>{
    if(arena){arena.classList.add('screen-shake-heavy');setTimeout(()=>arena.classList.remove('screen-shake-heavy'),600);}
    // Flash
    const flash=document.createElement('div');flash.className='screen-flash';flash.style.background='rgba(180,230,255,0.6)';document.body.appendChild(flash);setTimeout(()=>flash.remove(),300);
    to.classList.add('ice-freeze');createIceShatter(to,crit);
    if(crit)playCriticalSound();else playHitSound();
    setTimeout(()=>{to.classList.remove('ice-freeze');},1200);
    if(cb)setTimeout(cb,350);
  },pillarCount*60+250);
}

// 火球攻击特效(原始技能保留) - 3x bigger fireball
function playFireballAttack(fromContainer, toContainer, isCritical, callback) {
  if(!fromContainer || !toContainer) { if(callback) callback(); return; }
  const fromRect = fromContainer.getBoundingClientRect();
  const toRect = toContainer.getBoundingClientRect();
  const startX = fromRect.left + fromRect.width / 2 - 40;
  const startY = fromRect.top + fromRect.height / 2 - 40;
  const endX = toRect.left + toRect.width / 2 - 40;
  const endY = toRect.top + toRect.height / 2 - 40;

  const fireball = document.createElement('div');
  fireball.className = 'fireball-effect';
  // Giant fireball 3x size
  fireball.style.width = '120px'; fireball.style.height = '120px';
  if(isCritical) {
    fireball.style.width = '150px'; fireball.style.height = '150px';
    fireball.style.boxShadow = '0 0 60px 30px rgba(255,50,0,1), 0 0 120px 60px rgba(255,0,0,0.7), 0 0 180px 80px rgba(200,0,0,0.3)';
  }
  fireball.style.left = startX + 'px';
  fireball.style.top = startY + 'px';
  document.body.appendChild(fireball);

  playFireballSound();

  const duration = isCritical ? 300 : 220;
  const startTime = performance.now();
  let trailCount = 0;

  function animate(currentTime) {
    const elapsed = currentTime - startTime;
    const t = Math.min(1, elapsed / duration);
    const easeT = t < 0.5 ? 2*t*t : 1 - Math.pow(-2*t+2,2)/2;
    const currentX = startX + (endX - startX) * easeT;
    const currentY = startY + (endY - startY) * easeT - Math.sin(t * Math.PI) * 40;
    fireball.style.left = currentX + 'px';
    fireball.style.top = currentY + 'px';

    // Dense trail
    trailCount++;
    if(trailCount % 2 === 0) {
      for(let k=0;k<3;k++){
        const trail = document.createElement('div');
        trail.className = 'fireball-trail';
        trail.style.left = (currentX + 30 + (Math.random()-0.5)*30) + 'px';
        trail.style.top = (currentY + 30 + (Math.random()-0.5)*30) + 'px';
        document.body.appendChild(trail);
        setTimeout(() => trail.remove(), 500);
      }
    }

    if(t < 1) {
      requestAnimationFrame(animate);
    } else {
      fireball.remove();
      // Screen shake on every hit
      const arena = document.getElementById('pk-arena');
      if(arena){arena.classList.add('screen-shake-heavy');setTimeout(()=>arena.classList.remove('screen-shake-heavy'),500);}
      // Flash
      const flash=document.createElement('div');flash.className='screen-flash';flash.style.background='rgba(255,120,0,0.5)';document.body.appendChild(flash);setTimeout(()=>flash.remove(),300);
      // Massive explosion on impact
      createHitExplosion(toContainer, isCritical);
      // Fire particles lingering
      for(let i=0;i<(isCritical?15:8);i++){
        setTimeout(()=>{
          const p=document.createElement('div');
          p.style.cssText=`position:absolute;pointer-events:none;z-index:101;width:${5+Math.random()*10}px;height:${5+Math.random()*10}px;border-radius:50%;background:rgba(255,${100+Math.random()*100},0,0.8);box-shadow:0 0 10px rgba(255,100,0,0.7);left:${20+Math.random()*60}%;top:${20+Math.random()*60}%;animation:emberFloat ${0.8+Math.random()*1.2}s ease-out forwards;`;
          toContainer.style.position='relative';toContainer.appendChild(p);setTimeout(()=>p.remove(),2000);
        },Math.random()*400);
      }
      if(isCritical) {
        playCriticalSound();
        const slash = document.createElement('div');
        slash.className = 'critical-slash';
        toContainer.style.position = 'relative';
        toContainer.appendChild(slash);
        setTimeout(() => slash.remove(), 400);
        const slash2 = document.createElement('div');
        slash2.className = 'critical-slash';
        slash2.style.animationDelay = '0.1s';
        slash2.style.transform = 'rotate(45deg)';
        toContainer.appendChild(slash2);
        setTimeout(() => slash2.remove(), 500);
      } else {
        playHitSound();
      }
      if(callback) setTimeout(callback, 250);
    }
  }
  requestAnimationFrame(animate);
}

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
    
    cockpit.style.left = (oX + rW * cx) + 'px';
    cockpit.style.top = (oY + rH * cy) + 'px';
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
      const targetX1 = mecha1Bounds.left + mecha1Bounds.width * 0.513 - targetSize/2;
      const targetY1 = mecha1Bounds.top + mecha1Bounds.height * 0.44 - targetSize/2;
      petFly1.style.width = targetSize + 'px';
      petFly1.style.height = targetSize + 'px';
      petFly1.style.left = targetX1 + 'px';
      petFly1.style.top = targetY1 + 'px';
      petFly1.style.opacity = '0.6';
      
      // 右侧：飞向机甲胸口透明玻璃驾驶舱（cx=0.487, cy=0.44）
      const targetSize2 = 90;
      const targetX2 = mecha2Bounds.left + mecha2Bounds.width * 0.487 - targetSize2/2;
      const targetY2 = mecha2Bounds.top + mecha2Bounds.height * 0.44 - targetSize2/2;
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

// ========== 萌萌江湖行系统 ==========
let jhSelectedStudentId = null;

function getTodayCoinGain(studentId) {
  const today = new Date().toDateString();
  let total = 0;
  // v15: Always read from window.operationLogs for cross-script consistency
  const jhValidTypes = ['全班打卡', '批量奖惩', '奖惩', '每日打卡', '取金阁'];
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
  const pkValidTypes = ['奖惩', '批量奖惩', '每日打卡', '全班打卡', '取金阁'];
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
    <button class="jh-exit-btn" id="jhExitBtn" onclick="closeJianghuGame()">退出</button>
  `;
  document.body.appendChild(overlay);

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
    await jhDoAttack(willWin, false, true);
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
  showJianghuResult(overlay, willWin, student, pet, investCoins, boss);
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
  let coinResult = 0;
  let growthGain = 0;
  if (won) {
    // 胜利：投入的金币消失，获得三倍奖励（净赚两倍）
    student.coins -= investCoins; // 投入的金币消失
    coinResult = investCoins * 3; // 获得三倍
    student.coins += coinResult;  // 净收益 = +2倍
    growthGain = 0; // 胜利不再获得成长值
  } else {
    // 失败：失去投入的金币，获得投入金币30%的成长值
    coinResult = -investCoins;
    student.coins -= investCoins;
    if (student.coins < 0) student.coins = 0;
    growthGain = Math.floor(investCoins * 0.3); // 失败获得30%成长值
    pet.growth = (pet.growth || 0) + growthGain;
    _recalcPetLevel(pet);
  }

  // Mark student as having done jianghu today
  student.lastJianghuDate = new Date().toDateString();

  // Record action
  recordAction(student.id, student.name, won ? '江湖胜利' : '江湖失败',
    `${student.name}携${pet.nickname || pet.name}闯荡江湖${won ? '击败' : '不敌'}${boss.name}，投入${investCoins}金币`,
    won ? coinResult : coinResult, growthGain, pet.id,
    { jhType: won ? 'win' : 'lose', bossName: boss.name, investCoins: investCoins });

  saveClassData();
  renderHomePetGrid();
  renderClassTopThree();
  renderPKPage();

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

  // Show exit button
  const exitBtn = overlay.querySelector('#jhExitBtn');
  if (exitBtn) exitBtn.classList.add('jh-visible');

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
  jhSelectedStudentId = null;
  renderJianghuPage();
  renderPKPage();
}

// ========== 背景音乐系统（自定义MP3版） ==========
(function(){
  let bgPlaying=false, bgMuted=false, bgVol=0.4;
  let curPage='class-pet-page';
  let customAudioEl=null;
  const names={'class-pet-page':'宠物乐园','honor-board-page':'荣耀殿堂','pk-page':'欢乐竞技','jianghu-page':'萌萌江湖行'};
  const customMusicFiles={'class-pet-page':'https://mhxdwwa.oss-cn-shenzhen.aliyuncs.com/music/宠物管理.mp3','honor-board-page':'https://mhxdwwa.oss-cn-shenzhen.aliyuncs.com/music/排行榜.mp3','pk-page':'https://mhxdwwa.oss-cn-shenzhen.aliyuncs.com/music/宠物PK.mp3','jianghu-page':'https://mhxdwwa.oss-cn-shenzhen.aliyuncs.com/music/萌萌江湖行.mp3'};

  function stopAudio(){
    if(customAudioEl){
      customAudioEl.pause();
      customAudioEl.currentTime=0;
      customAudioEl.removeAttribute('src');
      customAudioEl.load();
      customAudioEl=null;
    }
  }

  function playAudio(pageId){
    stopAudio();
    const src=customMusicFiles[pageId];
    if(!src)return;
    const el=new Audio(src);
    el.loop=true;
    el.volume=bgMuted?0:bgVol;
    customAudioEl=el;
    el.play().catch(()=>{});
  }

  function startMusic(pageId){
    curPage=pageId;
    const el=document.getElementById('musicName');
    if(el)el.textContent=names[pageId]||'背景音乐';
    if(!bgPlaying)return;
    stopAudio();
    playAudio(pageId);
  }

  window.toggleMusicPanel=function(e){
    e.stopPropagation();
    const panel=document.getElementById('musicPanel');
    const btn=document.getElementById('musicExpandBtn');
    const isOpen=panel.classList.toggle('expanded');
    btn.textContent=isOpen?'◀':'▶';
    btn.classList.toggle('open',isOpen);
    if(isOpen){
      const closePanel=function(ev){if(!panel.contains(ev.target)){panel.classList.remove('expanded');btn.textContent='▶';btn.classList.remove('open');document.removeEventListener('click',closePanel);}};
      setTimeout(()=>document.addEventListener('click',closePanel),0);
    }
  };
  window.toggleBgMusic=function(){
    bgPlaying=!bgPlaying;
    const btn=document.getElementById('musicToggleBtn');
    if(bgPlaying){btn.textContent='🎶';btn.classList.add('playing');startMusic(curPage);}
    else{btn.textContent='🎵';btn.classList.remove('playing');stopAudio();}
  };
  window.setBgMusicVol=function(v){
    bgVol=v/100;
    if(customAudioEl)customAudioEl.volume=bgVol;
    // 同步更新音效音量
    window.updateSfxVolume(v, v==0);
    const ic=document.getElementById('musicVolIcon');
    if(v==0){ic.textContent='🔇';bgMuted=true;}
    else if(v<40){ic.textContent='🔉';bgMuted=false;}
    else{ic.textContent='🔊';bgMuted=false;}
  };
  window.toggleMute=function(){
    const s=document.getElementById('musicVolSlider'),ic=document.getElementById('musicVolIcon');
    if(!bgMuted){bgMuted=true;s.dataset.prevVol=s.value;s.value=0;if(customAudioEl)customAudioEl.volume=0;ic.textContent='🔇';window.updateSfxVolume(0,true);}
    else{bgMuted=false;const p=s.dataset.prevVol||40;s.value=p;bgVol=p/100;if(customAudioEl)customAudioEl.volume=bgVol;ic.textContent=p<40?'🔉':'🔊';window.updateSfxVolume(p,false);}
  };

  const origSP=window.switchPage;
  window.switchPage=function(pid){origSP(pid);if(bgPlaying)startMusic(pid);else curPage=pid;};

  // 首次点击提示已移除，改为手动点击箭头展开
})();


/* ===== 简化拖拽：始终可直接拖拽交换卡片位置 ===== */
// v12: Swap two students' positions instead of reorder
function reorderStudent(fromIdx, toIdx){
  if(!currentClassId) return;
  // 只有教师才能拖拽排序
  if(!currentUser || currentUser.type !== 'teacher') return;
  const cur = classesData.find(c=>c.id===currentClassId);
  if(!cur || !cur.students) return;
  if(fromIdx < 0 || fromIdx >= cur.students.length) return;
  if(toIdx < 0 || toIdx >= cur.students.length) return;
  if(fromIdx === toIdx) return;
  // 交换两个学生卡片的位置
  const temp = cur.students[fromIdx];
  cur.students[fromIdx] = cur.students[toIdx];
  cur.students[toIdx] = temp;
  // 保存排序到 localStorage（按班级）
  saveStudentOrder(currentClassId, cur.students);
  saveClassData();
  renderHomePetGrid();
}

// 保存学生排序顺序到 localStorage
function saveStudentOrder(classId, students){
  if(!classId || !students) return;
  const order = students.map(s => s.id);
  try {
    localStorage.setItem('studentOrder_' + classId, JSON.stringify(order));
  } catch(e) {
    console.warn('[DAL] Failed to save student order:', e);
  }
}

// 从 localStorage 加载学生排序
function loadStudentOrder(classId){
  if(!classId) return null;
  try {
    const orderStr = localStorage.getItem('studentOrder_' + classId);
    if(orderStr) return JSON.parse(orderStr);
  } catch(e) {
    console.warn('[DAL] Failed to load student order:', e);
  }
  return null;
}

// 应用排序到学生数组
function applyStudentOrder(classId, students){
  if(!classId || !students || students.length === 0) return students;
  const order = loadStudentOrder(classId);
  if(!order || order.length === 0) return students;
  // 创建 ID 到学生的映射
  const studentMap = {};
  students.forEach(s => { studentMap[s.id] = s; });
  // 按排序顺序重建数组
  const ordered = [];
  order.forEach(id => {
    if(studentMap[id]) {
      ordered.push(studentMap[id]);
      delete studentMap[id];
    }
  });
  // 添加新增的学生（不在排序中的）
  Object.values(studentMap).forEach(s => ordered.push(s));
  return ordered;
}

/* renderHomePetGrid后自动重绑拖拽 */
{
  const _prevRender = renderHomePetGrid;
  renderHomePetGrid = function(){
    _prevRender();
    bindPetCardDrag();
  };
}

/* ===== 宠物卡片直接拖拽排序（仅教师可用） ===== */
let petDragIdx = null;
function bindPetCardDrag(){
  const grid = document.getElementById('homePetGrid');
  if(!grid) return;
  // 只有教师账户才能拖拽排序
  if(!currentUser || currentUser.type !== 'teacher') return;
  const cards = grid.querySelectorAll('.home-pet-card');
  cards.forEach((card, idx) => {
    card.draggable = true;
    card.dataset.petIdx = idx;
    card.addEventListener('dragstart', petCardDragStart);
    card.addEventListener('dragend', petCardDragEnd);
    card.addEventListener('dragover', petCardDragOver);
    card.addEventListener('dragleave', petCardDragLeave);
    card.addEventListener('drop', petCardDrop);
  });
}
function petCardDragStart(e){
  petDragIdx = +this.dataset.petIdx;
  this.classList.add('dragging');
  this.style.opacity = '0.4';
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', petDragIdx);
}
function petCardDragEnd(e){
  this.classList.remove('dragging');
  this.style.opacity = '';
  petDragIdx = null;
  document.querySelectorAll('.home-pet-card.drag-over').forEach(el => el.classList.remove('drag-over'));
}
function petCardDragOver(e){
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  if(+this.dataset.petIdx !== petDragIdx) this.classList.add('drag-over');
}
function petCardDragLeave(e){
  this.classList.remove('drag-over');
}
function petCardDrop(e){
  e.preventDefault();
  this.classList.remove('drag-over');
  const toIdx = +this.dataset.petIdx;
  if(petDragIdx === null || petDragIdx === toIdx) return;
  reorderStudent(petDragIdx, toIdx);
}

// ========== 宠物生机系统 ==========
(function(){
  // — 配置 —
  const ACTION_MIN_INTERVAL = 4000;   // 最短间隔 ms
  const ACTION_MAX_INTERVAL = 12000;  // 最长间隔 ms
  const SOUND_VOLUME = 0.15;

  const ACTIONS = ['wiggle','bounce','stretch','tilt','doze','tailwag'];
  const EMOTES_HAPPY = ['❤️','✨','🎵','😊','🌟','💕','🎶','😻','💖'];
  const EMOTES_SLEEPY = ['💤','😴','💭'];
  const EMOTES_FOOD = ['🍖','🍗','🐟','🥩','🍰'];

  // — 可爱音效合成 —
  function playCuteSound(type) {
    try {
      if (!audioCtx) initAudio();
      if (audioCtx.state === 'suspended') return;
      const now = audioCtx.currentTime;
      const g = audioCtx.createGain();
      g.connect(masterSfxGain);
      g.gain.setValueAtTime(SOUND_VOLUME, now);

      if (type === 'chirp') {
        // 小鸟叫 / 可爱叫声
        const o = audioCtx.createOscillator();
        o.type = 'sine';
        o.connect(g);
        o.frequency.setValueAtTime(900, now);
        o.frequency.linearRampToValueAtTime(1300, now + 0.06);
        o.frequency.linearRampToValueAtTime(1100, now + 0.1);
        o.frequency.linearRampToValueAtTime(1400, now + 0.16);
        g.gain.exponentialRampToValueAtTime(0.01, now + 0.22);
        o.start(now); o.stop(now + 0.22);
      } else if (type === 'purr') {
        // 呼噜声
        const o = audioCtx.createOscillator();
        o.type = 'sine';
        o.connect(g);
        o.frequency.setValueAtTime(180, now);
        o.frequency.linearRampToValueAtTime(160, now + 0.15);
        o.frequency.linearRampToValueAtTime(190, now + 0.3);
        g.gain.setValueAtTime(SOUND_VOLUME * 0.6, now);
        g.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
        o.start(now); o.stop(now + 0.4);
      } else if (type === 'meow') {
        // 喵~
        const o = audioCtx.createOscillator();
        o.type = 'sine';
        o.connect(g);
        o.frequency.setValueAtTime(500, now);
        o.frequency.linearRampToValueAtTime(700, now + 0.08);
        o.frequency.linearRampToValueAtTime(550, now + 0.2);
        o.frequency.linearRampToValueAtTime(400, now + 0.35);
        g.gain.exponentialRampToValueAtTime(0.01, now + 0.38);
        o.start(now); o.stop(now + 0.38);
      } else if (type === 'yip') {
        // 汪！短促
        const o = audioCtx.createOscillator();
        o.type = 'triangle';
        o.connect(g);
        o.frequency.setValueAtTime(600, now);
        o.frequency.linearRampToValueAtTime(900, now + 0.04);
        o.frequency.linearRampToValueAtTime(500, now + 0.1);
        g.gain.exponentialRampToValueAtTime(0.01, now + 0.13);
        o.start(now); o.stop(now + 0.13);
      } else if (type === 'squeak') {
        // 吱吱
        const o = audioCtx.createOscillator();
        o.type = 'sine';
        o.connect(g);
        o.frequency.setValueAtTime(1600, now);
        o.frequency.linearRampToValueAtTime(2000, now + 0.04);
        o.frequency.linearRampToValueAtTime(1800, now + 0.08);
        g.gain.setValueAtTime(SOUND_VOLUME * 0.5, now);
        g.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
        o.start(now); o.stop(now + 0.12);
      } else if (type === 'snore') {
        // 轻微打鼾
        const o = audioCtx.createOscillator();
        o.type = 'sine';
        o.connect(g);
        o.frequency.setValueAtTime(120, now);
        o.frequency.linearRampToValueAtTime(100, now + 0.3);
        o.frequency.linearRampToValueAtTime(130, now + 0.5);
        g.gain.setValueAtTime(SOUND_VOLUME * 0.3, now);
        g.gain.linearRampToValueAtTime(SOUND_VOLUME * 0.5, now + 0.25);
        g.gain.exponentialRampToValueAtTime(0.01, now + 0.55);
        o.start(now); o.stop(now + 0.55);
      } else if (type === 'boing') {
        // 弹跳
        const o = audioCtx.createOscillator();
        o.type = 'sine';
        o.connect(g);
        o.frequency.setValueAtTime(400, now);
        o.frequency.exponentialRampToValueAtTime(800, now + 0.05);
        o.frequency.exponentialRampToValueAtTime(300, now + 0.15);
        g.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        o.start(now); o.stop(now + 0.2);
      }
    } catch(e) {}
  }

  const SOUND_MAP = {
    wiggle:  ['meow','yip','squeak'],
    bounce:  ['boing','chirp','yip'],
    stretch: ['purr','meow'],
    tilt:    ['chirp','squeak','meow'],
    doze:    ['snore','purr'],
    tailwag: ['yip','chirp','boing']
  };

  // — 显示表情气泡 —
  function showEmote(card, action) {
    const top = card.querySelector('.home-pet-top');
    if (!top) return;
    let emotes;
    if (action === 'doze') emotes = EMOTES_SLEEPY;
    else if (action === 'stretch') emotes = EMOTES_FOOD;
    else emotes = EMOTES_HAPPY;
    const emoji = emotes[Math.floor(Math.random() * emotes.length)];
    const bubble = document.createElement('div');
    bubble.className = 'pet-emote-bubble';
    bubble.textContent = emoji;
    bubble.style.top = '8px';
    bubble.style.left = (40 + Math.random() * 20) + '%';
    top.style.position = 'relative';
    top.appendChild(bubble);
    bubble.addEventListener('animationend', () => bubble.remove());
  }

  // — 打瞌睡时显示 zzz —
  function showZzz(card) {
    const top = card.querySelector('.home-pet-top');
    if (!top) return;
    top.style.position = 'relative';
    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        const z = document.createElement('div');
        z.className = 'pet-zzz';
        z.textContent = 'z';
        z.style.right = (10 + i * 8) + 'px';
        z.style.top = (20 + i * 5) + 'px';
        z.style.fontSize = (12 + i * 3) + 'px';
        z.style.animationDelay = (i * 0.3) + 's';
        top.appendChild(z);
        z.addEventListener('animationend', () => z.remove());
      }, i * 300);
    }
  }

  // — 卡片微光 —
  function triggerShimmer(card) {
    card.classList.add('pet-card-shimmer');
    setTimeout(() => card.classList.remove('pet-card-shimmer'), 1500);
  }

  // — 检查卡片是否在视口内可见 —
  function isCardVisible(card) {
    const rect = card.getBoundingClientRect();
    return (
      rect.top < window.innerHeight &&
      rect.bottom > 0 &&
      rect.left < window.innerWidth &&
      rect.right > 0
    );
  }

  // — 检查当前是否在宠物管理页面 —
  function isOnPetManagementPage() {
    const petPage = document.getElementById('class-pet-page');
    return petPage && petPage.classList.contains('active');
  }

  // — 对单个卡片触发动作（只在可见且页面激活时）—
  function triggerPetAction(card) {
    // 检查是否在宠物管理页面
    if (!isOnPetManagementPage()) return;
    
    // 检查卡片是否可见
    if (!isCardVisible(card)) return;
    
    if (card.querySelector('.dead-pet-overlay')) return;
    if (card.classList.contains('no-pet-card')) return;
    const img = card.querySelector('.home-pet-top img');
    if (!img) return;

    const action = ACTIONS[Math.floor(Math.random() * ACTIONS.length)];
    const cls = 'pet-action-' + action;

    // 播放动作
    img.classList.add(cls);
    img.addEventListener('animationend', function handler() {
      img.classList.remove(cls);
      img.removeEventListener('animationend', handler);
    });

    // 表情气泡（70% 概率）
    if (Math.random() < 0.7) {
      setTimeout(() => showEmote(card, action), 200);
    }

    // ZZZ（打瞌睡专属）
    if (action === 'doze') {
      showZzz(card);
    }

    // 微光扫过（30% 概率）
    if (Math.random() < 0.3) {
      triggerShimmer(card);
    }

    // 可爱声音（50% 概率 — 只在页面可见时播放）
    if (Math.random() < 0.5) {
      const sounds = SOUND_MAP[action];
      const s = sounds[Math.floor(Math.random() * sounds.length)];
      setTimeout(() => playCuteSound(s), 100 + Math.random() * 200);
    }
  }

  // — 主调度器：随机挑选卡片触发（只在宠物管理页面激活时）—
  let lifeTimer = null;

  function scheduleNextAction() {
    const delay = ACTION_MIN_INTERVAL + Math.random() * (ACTION_MAX_INTERVAL - ACTION_MIN_INTERVAL);
    lifeTimer = setTimeout(() => {
      // 只在宠物管理页面激活时才触发动作
      if (!isOnPetManagementPage()) {
        scheduleNextAction();
        return;
      }
      
      const cards = document.querySelectorAll('#homePetGrid .home-pet-card');
      if (cards.length > 0) {
        // 只选择可见的卡片
        const visibleCards = Array.from(cards).filter(card => isCardVisible(card));
        if (visibleCards.length > 0) {
          // 随机挑 1~2 只可见宠物同时行动
          const count = Math.random() < 0.3 ? 2 : 1;
          const selectedCount = Math.min(count, visibleCards.length);
          for (let i = 0; i < selectedCount; i++) {
            const idx = Math.floor(Math.random() * visibleCards.length);
            triggerPetAction(visibleCards[idx]);
            visibleCards.splice(idx, 1); // 避免重复选择
          }
        }
      }
      scheduleNextAction();
    }, delay);
  }

  // — 初始化：给每张卡片设置随机呼吸延迟 —
  function initBreathingDelays() {
    const cards = document.querySelectorAll('#homePetGrid .home-pet-card');
    cards.forEach(card => {
      card.style.setProperty('--card-float-delay', (Math.random() * 4).toFixed(1) + 's');
    });
  }
  // 暴露给外部调用（替代 MutationObserver）
  window.__initBreathingDelays = initBreathingDelays;

  // — 呼吸延迟初始化已移至 renderHomePetGrid 包装函数中手动调用 —

  // — 启动 —
  setTimeout(() => {
    initBreathingDelays();
    scheduleNextAction();
  }, 2000);
})();
// ========== 宠物生机系统结束 ==========

// ========== 闲置宠物出逃系统 ==========
// 全局跟踪当前出逃中的宠物ID（用于DOM重建时保持出逃状态）
window._escapedPetIds = new Set();
(function(){
  const IDLE_THRESHOLD = 15000;       // 15秒无操作触发
  const ESCAPE_DURATION = 12000;      // 出逃持续12秒
  const ESCAPE_COOLDOWN = 30000;      // 两次出逃间最少间隔30秒
  const MAX_ESCAPED = 3;              // 最多同时3只
  const SIDE_MARGIN = 60;             // 侧栏跑动区域宽度
  const GUARANTEED_ESCAPE_MAX = 120000; // 最长2分钟必出逃一次

  let idleTimer = null;
  let guaranteedTimer = null;         // 保底出逃计时器
  let lastActivity = Date.now();
  let escapeActive = false;
  let lastEscapeEnd = 0;
  let escapedPets = [];
  let lastEscapeStart = Date.now();   // 上次出逃开始时间（含初始）

  // 温馨台词
  const SPEECHES = [
    '主人快回来嘛~','好无聊呀~','想你了！','陪我玩嘛~',
    '嘿嘿，偷跑出来啦！','我在这里哦~','别走开太久嘛~',
    '出来透透气~','主人在不在呀？','好想被摸摸头~',
    '给我加餐嘛~','我最乖啦！','哼，被冷落了！',
    '等你回来哦~','主人最好了！','我要撒娇！',
    '快看我快看我~','一起玩吧！','摸摸我嘛~',
    '别忘了喂我哦~','我超可爱的！','有点饿饿了~',
    '这里好大呀！','哇~好好玩！','嗯？那是什么？',
    '我发现宝藏了！','嘻嘻，抓不到我~','转圈圈~',
    '打个滚~','伸个懒腰~','好困呀…zzZ',
    '喵呜~','汪！','叽叽~','呱呱~'
  ];

  // 表情符号
  const EMOTES = ['❤️','💕','✨','🌟','💤','❓','❗','🎵','🎶','💢','💦','🌸','🍖','🐟','🦴','😊','😆','🥺','😴','🤩','💖','⭐'];

  // 可爱动作序列（震撼升级版 - 只保留最可爱震撼的动作）
  const CUTE_ACTIONS = [
    { name: 'roll',       anim: 'escapeRollCrazy 1.2s ease-in-out 2',       dur: 2500, fx: 'stars' },
    { name: 'spin',       anim: 'escapeSpinBurst 1s ease-in-out 1',         dur: 1100, fx: 'sparkle' },
    { name: 'bounce',     anim: 'escapeSuperBounce 1.2s ease-in-out 1',     dur: 1300, fx: 'hearts' },
    { name: 'backflip',   anim: 'escapeBackflip 0.9s ease-in-out 1',        dur: 1000, fx: 'sparkle' },
    { name: 'wiggle',     anim: 'escapeWiggleDance 1s ease-in-out 2',       dur: 2100, fx: 'music' },
    { name: 'faceplant',  anim: 'escapeFaceplant 1.5s ease-in-out 1',       dur: 1600, fx: 'stars' },
    { name: 'trampoline', anim: 'escapeTrampoline 1.8s ease-in-out 1',      dur: 1900, fx: 'sparkle' },
    { name: 'belly',      anim: 'escapeBellyFlop 1.2s ease-in-out 1',       dur: 1300, fx: 'hearts' },
    { name: 'tornado',    anim: 'escapeTornado 1.5s ease-in-out 1',         dur: 1600, fx: 'wind' },
    { name: 'moonwalk',   anim: 'escapeMoonwalk 2s ease-in-out 1',          dur: 2100, fx: 'sparkle' }
  ];

  // 食物卡片系统
  const FOOD_CARDS = [
    { emoji: '🍖', name: '烤肉', color: '#e74c3c' },
    { emoji: '🐟', name: '小鱼干', color: '#3498db' },
    { emoji: '🦴', name: '骨头', color: '#f39c12' },
    { emoji: '🍰', name: '蛋糕', color: '#e91e63' },
    { emoji: '🧀', name: '奶酪', color: '#ffc107' },
    { emoji: '🍪', name: '饼干', color: '#795548' },
    { emoji: '🍎', name: '苹果', color: '#4caf50' },
    { emoji: '🍩', name: '甜甜圈', color: '#ff9800' },
    { emoji: '🥕', name: '胡萝卜', color: '#ff5722' },
    { emoji: '🍓', name: '草莓', color: '#e91e63' },
    { emoji: '🌽', name: '玉米', color: '#fdd835' },
    { emoji: '🍕', name: '披萨', color: '#ff7043' }
  ];

  // 温馨声音（利用已有的 audioCtx）
  function playEscapeSound(type) {
    try {
      initAudio();
      const now = audioCtx.currentTime;
      const g = audioCtx.createGain();
      g.connect(masterSfxGain);
      g.gain.setValueAtTime(0.12, now);

      if (type === 'appear') {
        // 可爱出现音 - 上升的叮咚
        [600, 800, 1000].forEach((f, i) => {
          const o = audioCtx.createOscillator();
          o.type = 'sine'; o.connect(g);
          o.frequency.setValueAtTime(f, now + i * 0.1);
          const og = audioCtx.createGain();
          o.disconnect(); o.connect(og); og.connect(masterSfxGain);
          og.gain.setValueAtTime(0.1, now + i * 0.1);
          og.gain.exponentialRampToValueAtTime(0.01, now + i * 0.1 + 0.2);
          o.start(now + i * 0.1);
          o.stop(now + i * 0.1 + 0.2);
        });
      } else if (type === 'step') {
        // 轻柔脚步声
        const o = audioCtx.createOscillator();
        o.type = 'triangle'; o.connect(g);
        o.frequency.setValueAtTime(300 + Math.random() * 200, now);
        g.gain.setValueAtTime(0.04, now);
        g.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
        o.start(now); o.stop(now + 0.08);
      } else if (type === 'cute') {
        // 撒娇声
        const o = audioCtx.createOscillator();
        o.type = 'sine'; o.connect(g);
        o.frequency.setValueAtTime(700, now);
        o.frequency.linearRampToValueAtTime(900, now + 0.08);
        o.frequency.linearRampToValueAtTime(650, now + 0.2);
        g.gain.setValueAtTime(0.08, now);
        g.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
        o.start(now); o.stop(now + 0.25);
      } else if (type === 'bye') {
        // 回去的音效 - 下降音
        [800, 600, 400].forEach((f, i) => {
          const o = audioCtx.createOscillator();
          o.type = 'sine';
          const og = audioCtx.createGain();
          o.connect(og); og.connect(masterSfxGain);
          og.gain.setValueAtTime(0.08, now + i * 0.12);
          og.gain.exponentialRampToValueAtTime(0.01, now + i * 0.12 + 0.18);
          o.start(now + i * 0.12);
          o.stop(now + i * 0.12 + 0.18);
        });
      } else if (type === 'bell') {
        // 温馨铃铛声
        const o = audioCtx.createOscillator();
        o.type = 'sine'; o.connect(g);
        o.frequency.setValueAtTime(1200, now);
        o.frequency.exponentialRampToValueAtTime(1500, now + 0.05);
        o.frequency.exponentialRampToValueAtTime(1100, now + 0.15);
        g.gain.setValueAtTime(0.06, now);
        g.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        o.start(now); o.stop(now + 0.3);
      } else if (type === 'meow') {
        // 猫叫 - 带颤音的柔和升降音，更像真实猫咪
        const o = audioCtx.createOscillator();
        const o2 = audioCtx.createOscillator(); // 轻微谐波层
        const vibrato = audioCtx.createOscillator(); // 颤音LFO
        const vibratoGain = audioCtx.createGain();
        const g2 = audioCtx.createGain();
        // 主音
        o.type = 'sine'; o.connect(g);
        o.frequency.setValueAtTime(520, now);
        o.frequency.linearRampToValueAtTime(850, now + 0.12);
        o.frequency.linearRampToValueAtTime(700, now + 0.25);
        o.frequency.linearRampToValueAtTime(550, now + 0.4);
        o.frequency.linearRampToValueAtTime(380, now + 0.55);
        // 颤音（模拟猫咪声带颤动）
        vibrato.type = 'sine';
        vibrato.frequency.setValueAtTime(5.5, now);
        vibrato.frequency.linearRampToValueAtTime(7, now + 0.3);
        vibrato.connect(vibratoGain);
        vibratoGain.gain.setValueAtTime(12, now);
        vibratoGain.gain.linearRampToValueAtTime(25, now + 0.2);
        vibratoGain.gain.linearRampToValueAtTime(8, now + 0.5);
        vibratoGain.connect(o.frequency);
        // 轻微鼻音谐波
        o2.type = 'triangle'; o2.connect(g2); g2.connect(masterSfxGain);
        o2.frequency.setValueAtTime(1050, now);
        o2.frequency.linearRampToValueAtTime(1700, now + 0.12);
        o2.frequency.linearRampToValueAtTime(1100, now + 0.4);
        g2.gain.setValueAtTime(0.025, now);
        g2.gain.exponentialRampToValueAtTime(0.003, now + 0.5);
        g.gain.setValueAtTime(0.10, now);
        g.gain.linearRampToValueAtTime(0.13, now + 0.12);
        g.gain.exponentialRampToValueAtTime(0.008, now + 0.55);
        o.start(now); o.stop(now + 0.6);
        o2.start(now); o2.stop(now + 0.55);
        vibrato.start(now); vibrato.stop(now + 0.6);
      } else if (type === 'bark') {
        // 小狗叫 - 带谐波的短促有力叫声，更有层次感
        [0, 0.2].forEach(t => {
          const o = audioCtx.createOscillator();
          const o2 = audioCtx.createOscillator(); // 第2谐波
          const o3 = audioCtx.createOscillator(); // 噪声谐波
          const bg = audioCtx.createGain();
          const bg2 = audioCtx.createGain();
          const bg3 = audioCtx.createGain();
          // 主音 - sawtooth带丰富泛音
          o.type = 'sawtooth'; o.connect(bg); bg.connect(masterSfxGain);
          o.frequency.setValueAtTime(450, now + t);
          o.frequency.linearRampToValueAtTime(320, now + t + 0.06);
          o.frequency.linearRampToValueAtTime(280, now + t + 0.12);
          bg.gain.setValueAtTime(0.065, now + t);
          bg.gain.exponentialRampToValueAtTime(0.004, now + t + 0.14);
          // 第2谐波 - 增加厚度
          o2.type = 'square'; o2.connect(bg2); bg2.connect(masterSfxGain);
          o2.frequency.setValueAtTime(900, now + t);
          o2.frequency.linearRampToValueAtTime(640, now + t + 0.08);
          bg2.gain.setValueAtTime(0.02, now + t);
          bg2.gain.exponentialRampToValueAtTime(0.002, now + t + 0.10);
          // 第3谐波 - 喉音质感
          o3.type = 'triangle'; o3.connect(bg3); bg3.connect(masterSfxGain);
          o3.frequency.setValueAtTime(180, now + t);
          o3.frequency.linearRampToValueAtTime(140, now + t + 0.08);
          bg3.gain.setValueAtTime(0.035, now + t);
          bg3.gain.exponentialRampToValueAtTime(0.003, now + t + 0.12);
          o.start(now + t); o.stop(now + t + 0.16);
          o2.start(now + t); o2.stop(now + t + 0.12);
          o3.start(now + t); o3.stop(now + t + 0.14);
        });
      } else if (type === 'chirp') {
        // 小鸟叫 - 更丰富的啾啾声，带快速频率振荡
        [0, 0.12, 0.26].forEach((t, idx) => {
          const o = audioCtx.createOscillator();
          const o2 = audioCtx.createOscillator(); // 泛音
          const bg = audioCtx.createGain();
          const bg2 = audioCtx.createGain();
          o.connect(bg); bg.connect(masterSfxGain);
          o2.connect(bg2); bg2.connect(masterSfxGain);
          const baseF = 2000 + idx * 200 + Math.random() * 400;
          o.type = 'sine';
          o.frequency.setValueAtTime(baseF, now + t);
          o.frequency.linearRampToValueAtTime(baseF + 600, now + t + 0.03);
          o.frequency.linearRampToValueAtTime(baseF + 200, now + t + 0.05);
          o.frequency.linearRampToValueAtTime(baseF - 100, now + t + 0.08);
          // 轻微泛音
          o2.type = 'sine';
          o2.frequency.setValueAtTime(baseF * 1.5, now + t);
          o2.frequency.linearRampToValueAtTime(baseF * 1.5 + 300, now + t + 0.03);
          bg.gain.setValueAtTime(0.055, now + t);
          bg.gain.exponentialRampToValueAtTime(0.004, now + t + 0.09);
          bg2.gain.setValueAtTime(0.015, now + t);
          bg2.gain.exponentialRampToValueAtTime(0.002, now + t + 0.07);
          o.start(now + t); o.stop(now + t + 0.10);
          o2.start(now + t); o2.stop(now + t + 0.08);
        });
      } else if (type === 'squeak') {
        // 仓鼠/小动物吱吱声
        const o = audioCtx.createOscillator();
        o.type = 'sine'; o.connect(g);
        o.frequency.setValueAtTime(1600, now);
        o.frequency.linearRampToValueAtTime(2200, now + 0.06);
        o.frequency.linearRampToValueAtTime(1400, now + 0.15);
        g.gain.setValueAtTime(0.07, now);
        g.gain.exponentialRampToValueAtTime(0.01, now + 0.18);
        o.start(now); o.stop(now + 0.2);
      } else if (type === 'purr') {
        // 猫咪呼噜声 - 更丰富的低频颤音+谐波
        const o = audioCtx.createOscillator();
        const o2 = audioCtx.createOscillator();
        const g2 = audioCtx.createGain();
        o.type = 'triangle'; o.connect(g);
        o.frequency.setValueAtTime(80, now);
        o2.type = 'sine'; o2.connect(g2); g2.connect(masterSfxGain);
        o2.frequency.setValueAtTime(160, now);
        g2.gain.setValueAtTime(0.03, now);
        g2.gain.exponentialRampToValueAtTime(0.003, now + 0.7);
        const lfo = audioCtx.createOscillator();
        const lfoG = audioCtx.createGain();
        lfo.connect(lfoG); lfoG.connect(o.frequency);
        lfo.frequency.setValueAtTime(28, now);
        lfoG.gain.setValueAtTime(25, now);
        // 音量起伏模拟呼噜节奏
        g.gain.setValueAtTime(0.06, now);
        g.gain.linearRampToValueAtTime(0.10, now + 0.15);
        g.gain.linearRampToValueAtTime(0.06, now + 0.3);
        g.gain.linearRampToValueAtTime(0.09, now + 0.45);
        g.gain.exponentialRampToValueAtTime(0.008, now + 0.7);
        lfo.start(now); o.start(now); o2.start(now);
        lfo.stop(now + 0.7); o.stop(now + 0.7); o2.stop(now + 0.7);
      } else if (type === 'ribbit') {
        // 青蛙呱呱声
        const o = audioCtx.createOscillator();
        o.type = 'square'; o.connect(g);
        o.frequency.setValueAtTime(180, now);
        o.frequency.linearRampToValueAtTime(120, now + 0.15);
        g.gain.setValueAtTime(0.05, now);
        g.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        o.start(now); o.stop(now + 0.22);
      }
    } catch(e) {}
  }

  // 判断是否在第一个页面
  function isOnFirstPage() {
    const page = document.getElementById('class-pet-page');
    return page && page.classList.contains('active');
  }

  // 是否有弹窗打开
  function hasModalOpen() {
    return !!document.querySelector('.modal-overlay');
  }

  // 判断元素是否在当前视口可见区域内
  function isCardVisible(card) {
    const rect = card.getBoundingClientRect();
    const vw = window.innerWidth || document.documentElement.clientWidth;
    const vh = window.innerHeight || document.documentElement.clientHeight;
    // 卡片至少一半面积在视口内才算可见
    const visibleTop = Math.max(rect.top, 0);
    const visibleBottom = Math.min(rect.bottom, vh);
    const visibleLeft = Math.max(rect.left, 0);
    const visibleRight = Math.min(rect.right, vw);
    if (visibleBottom <= visibleTop || visibleRight <= visibleLeft) return false;
    const visibleArea = (visibleBottom - visibleTop) * (visibleRight - visibleLeft);
    const totalArea = rect.width * rect.height;
    return totalArea > 0 && (visibleArea / totalArea) > 0.5;
  }

  // 隐藏卡片上的宠物图片（出逃时）
  function hideCardPet(card) {
    const top = card.querySelector('.home-pet-top');
    if (top) {
      const img = top.querySelector('img');
      const span = top.querySelector('span');
      if (img) { img.dataset.escapeHidden = '1'; img.style.opacity = '0'; img.style.transition = 'opacity 0.3s'; }
      if (span) { span.dataset.escapeHidden = '1'; span.style.opacity = '0'; span.style.transition = 'opacity 0.3s'; }
      // 显示一个"出逃中"的提示
      if (!top.querySelector('.escape-empty-hint')) {
        const hint = document.createElement('div');
        hint.className = 'escape-empty-hint';
        hint.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:13px;color:#cba090;font-weight:700;pointer-events:none;text-align:center;line-height:1.6;opacity:0;animation:fadeIn 0.5s ease forwards;';
        hint.innerHTML = '🐾<br>出逃中…';
        top.style.position = 'relative';
        top.appendChild(hint);
      }
    }
  }

  // 恢复卡片上的宠物图片（回来时）
  function showCardPet(card) {
    const top = card.querySelector('.home-pet-top');
    if (top) {
      // v46: Handle both data-escape-hidden attribute AND inline opacity:0 style
      // (rebuilt cards from renderHomePetGrid use inline style, not data attribute)
      const img = top.querySelector('img[data-escape-hidden]') || top.querySelector('img[style*="opacity: 0"]') || top.querySelector('img[style*="opacity:0"]');
      const span = top.querySelector('span[data-escape-hidden]') || top.querySelector('span[style*="opacity: 0"]') || top.querySelector('span[style*="opacity:0"]');
      // 先移除提示
      const hint = top.querySelector('.escape-empty-hint');
      if (hint) { hint.style.opacity = '0'; setTimeout(() => hint.remove(), 300); }
      // 延迟一点再显示，配合回来动画
      setTimeout(() => {
        if (img) { img.style.opacity = '1'; delete img.dataset.escapeHidden; }
        if (span) { span.style.opacity = '1'; delete span.dataset.escapeHidden; }
      }, 100);
    }
  }

  // 获取可出逃的宠物卡片信息（只选当前视口可见的，排除宠物蛋）
  function getEscapablePets() {
    const cards = document.querySelectorAll('#homePetGrid .home-pet-card');
    const result = [];
    cards.forEach(card => {
      if (card.querySelector('.dead-pet-overlay')) return;
      if (card.classList.contains('no-pet-card')) return;
      // 排除未领取宠物蛋的卡片（卡片上有"领养宠物"按钮的）
      if (card.querySelector('.btn-small')) return;
      if (!isCardVisible(card)) return;
      const img = card.querySelector('.home-pet-top img');
      const emoji = card.querySelector('.home-pet-top span');
      // 排除宠物蛋（span显示蛋emoji且没有img）
      if (!img && emoji) {
        const eggEmojis = ['🥚','🪺'];
        if (eggEmojis.includes(emoji.textContent.trim())) return;
      }
      if (!img && !emoji) return;
      const nameEl = card.querySelector('.home-pet-middle');
      const name = nameEl ? nameEl.textContent.trim().split('✏')[0].trim() : '宠物';
      // 提取学生ID和宠物ID（从onclick属性）
      const onclick = card.getAttribute('onclick') || '';
      const studentIdMatch = onclick.match(/openStudentModal\('([^']+)'\)/);
      const studentId = studentIdMatch ? studentIdMatch[1] : null;
      // 从学生数据中获取活跃宠物ID
      let petId = null;
      if (studentId && typeof classesData !== 'undefined') {
        for (const cls of classesData) {
          const stu = cls.students.find(s => String(s.id) === String(studentId));
          if (stu && stu.pets && stu.pets.length > 0) {
            const activePet = stu.pets.find(p => String(p.id) === String(stu.activePetId)) || stu.pets[0];
            if (activePet) petId = activePet.id;
            break;
          }
        }
      }
      result.push({
        card,
        imgSrc: img ? img.src : null,
        emoji: emoji ? emoji.textContent : null,
        name,
        studentId,
        petId
      });
    });
    return result;
  }

  // 留下脚印
  function dropPawprint(x, y) {
    const paw = document.createElement('div');
    paw.className = 'escape-pawprint';
    paw.textContent = '🐾';
    paw.style.left = x + 'px';
    paw.style.top = y + 'px';
    paw.style.transform = `rotate(${Math.random() * 30 - 15}deg)`;
    document.body.appendChild(paw);
    setTimeout(() => paw.remove(), 2200);
  }

  // 留下轨迹粒子
  function dropTrail(x, y) {
    const t = document.createElement('div');
    t.className = 'escaped-pet-trail';
    t.style.left = (x + Math.random() * 20 - 10) + 'px';
    t.style.top = (y + Math.random() * 20 - 10) + 'px';
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 900);
  }

  // 捕获粒子爆发
  function burstCatchParticles(x, y) {
    const emojis = ['❤️','💕','✨','🌟','💖','⭐','🎉','🎊'];
    for (let i = 0; i < 10; i++) {
      const p = document.createElement('div');
      p.className = 'escape-catch-particle';
      p.textContent = emojis[Math.floor(Math.random() * emojis.length)];
      p.style.left = x + 'px';
      p.style.top = y + 'px';
      const angle = (Math.PI * 2 / 10) * i + Math.random() * 0.5;
      const dist = 40 + Math.random() * 60;
      p.style.setProperty('--px', Math.cos(angle) * dist + 'px');
      p.style.setProperty('--py', Math.sin(angle) * dist + 'px');
      p.style.setProperty('--pr', (Math.random() * 360) + 'deg');
      document.body.appendChild(p);
      setTimeout(() => p.remove(), 1000);
    }
  }

  // 跳出瞬间粒子爆炸（星星/爱心）
  function burstEscapeParticles(x, y) {
    const emojis = ['⭐','✨','🌟','💫','❤️','💖','💕','🎀','🌸','✿'];
    for (let i = 0; i < 14; i++) {
      const p = document.createElement('div');
      p.className = 'escape-burst-particle';
      p.textContent = emojis[Math.floor(Math.random() * emojis.length)];
      p.style.left = x + 'px';
      p.style.top = y + 'px';
      const angle = (Math.PI * 2 / 14) * i + Math.random() * 0.4;
      const dist = 50 + Math.random() * 80;
      p.style.setProperty('--bx', Math.cos(angle) * dist + 'px');
      p.style.setProperty('--by', Math.sin(angle) * dist + 'px');
      p.style.setProperty('--br', (Math.random() * 540 - 270) + 'deg');
      p.style.fontSize = (14 + Math.random() * 12) + 'px';
      document.body.appendChild(p);
      setTimeout(() => p.remove(), 900);
    }
    // 闪光环
    const ring = document.createElement('div');
    ring.className = 'escape-burst-ring';
    ring.style.left = (x - 10) + 'px';
    ring.style.top = (y - 10) + 'px';
    document.body.appendChild(ring);
    setTimeout(() => ring.remove(), 700);
  }

  // "刚回来"气喘吁吁状态
  function showJustReturnedState(card) {
    card.classList.add('just-returned');
    const top = card.querySelector('.home-pet-top');
    if (!top) return;
    top.style.position = 'relative';
    // 汗滴动画（循环3次）
    let sweatCount = 0;
    const sweatInterval = setInterval(() => {
      if (sweatCount >= 4) { clearInterval(sweatInterval); return; }
      const sweat = document.createElement('div');
      sweat.className = 'just-returned-sweat';
      sweat.textContent = '💦';
      sweat.style.top = (20 + Math.random() * 30) + 'px';
      sweat.style.right = (5 + Math.random() * 25) + 'px';
      top.appendChild(sweat);
      setTimeout(() => sweat.remove(), 1300);
      sweatCount++;
    }, 1000);
    // "刚回来"标签
    const badge = document.createElement('div');
    badge.className = 'just-returned-badge';
    badge.textContent = '😮‍💨 刚回来~';
    card.appendChild(badge);
    // 5秒后清除状态
    setTimeout(() => {
      card.classList.remove('just-returned');
      clearInterval(sweatInterval);
      if (badge.isConnected) {
        badge.style.opacity = '0';
        badge.style.transition = 'opacity 0.4s';
        setTimeout(() => badge.remove(), 500);
      }
      card.querySelectorAll('.just-returned-sweat').forEach(e => e.remove());
    }, 5000);
  }

  // 出逃前预告动画（卡片上宠物不安分）
  function showPreEscapePreview(card) {
    return new Promise(resolve => {
      card.classList.add('pre-escape');
      // 添加问号/感叹号气泡
      const bubble = document.createElement('div');
      bubble.className = 'pre-escape-bubble';
      bubble.textContent = '❓';
      const top = card.querySelector('.home-pet-top');
      if (top) { top.style.position = 'relative'; top.appendChild(bubble); }
      // 1.5秒后换成感叹号
      setTimeout(() => { if (bubble.isConnected) bubble.textContent = '❗'; }, 1500);
      // 2.5秒后清除预告，开始跳出
      setTimeout(() => {
        card.classList.remove('pre-escape');
        if (bubble.isConnected) bubble.remove();
        resolve();
      }, 2500);
    });
  }

  // 显示捕获奖励
  function showCatchReward(x, y, petName) {
    const rewards = [
      '💰 +5 金币！','❤️ 好感度+1！','✨ 捉到了！','🎁 获得小礼物！',
      '🌟 真棒！','🍖 获得零食！','💎 幸运奖励！','🏆 捕获大师！'
    ];
    const el = document.createElement('div');
    el.className = 'escape-reward';
    el.textContent = petName + '：' + rewards[Math.floor(Math.random() * rewards.length)];
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2000);
  }

  // 捕获单只宠物（点击触发）
  function catchPet(petData) {
    const { el, petInfo } = petData;
    if (!el || !el.isConnected || petData.caught) return;
    petData.caught = true;

    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    // 惊慌台词
    const catchWords = ['啊！被发现了！','呜呜，抓到我了~','不要嘛~','好吧，回去啦！','主人好厉害！','哼，下次不会被抓到的！'];
    const bubble = document.createElement('div');
    bubble.className = 'escape-speech';
    bubble.textContent = catchWords[Math.floor(Math.random() * catchWords.length)];
    el.appendChild(bubble);

    // 播放捕获音效
    playEscapeSound('cute');
    setTimeout(() => playRandomAnimalSound(), 200);

    // 粒子爆发
    burstCatchParticles(cx, cy);

    // 捕获动画
    const inner = el.querySelector('img') || el.querySelector('span');
    if (inner) inner.style.animation = 'escapeCaught 0.8s ease-out forwards';

    // 奖励提示
    setTimeout(() => showCatchReward(cx - 60, cy - 50, petInfo.name), 300);

    // 飞回卡片
    setTimeout(() => {
      if (!el.isConnected) return;
      // v47: 动态查找当前有效的卡片元素（可能被 renderHomePetGrid 重建过）
      let currentCard = petInfo.card;
      if (petInfo.studentId) {
        const newCard = document.querySelector(`#homePetGrid .home-pet-card[data-sid="${petInfo.studentId}"]`);
        if (newCard && newCard.isConnected) currentCard = newCard;
      }
      if (!currentCard || !currentCard.isConnected) { el.remove(); return; }
      const endRect = currentCard.getBoundingClientRect();
      // v47: 强制reflow确保移动端CSS transition生效
      el.style.transition = 'none';
      void el.offsetWidth;
      el.style.transition = 'left 0.6s ease-in, top 0.6s ease-in, opacity 0.6s';
      el.style.left = (endRect.left + endRect.width / 2 - 65) + 'px';
      el.style.top = (endRect.top + endRect.height / 2 - 65) + 'px';
      el.style.opacity = '0';
    }, 800);

    // 恢复卡片
    setTimeout(() => {
      // v47: 动态查找当前有效的卡片元素
      let currentCard = petInfo.card;
      if (petInfo.studentId) {
        const newCard = document.querySelector(`#homePetGrid .home-pet-card[data-sid="${petInfo.studentId}"]`);
        if (newCard && newCard.isConnected) currentCard = newCard;
      }
      if (currentCard && currentCard.isConnected) {
        showCardPet(currentCard);
        currentCard.style.transition = 'transform 0.3s';
        currentCard.style.transform = 'scale(1.08)';
        setTimeout(() => {
          currentCard.style.transform = '';
          setTimeout(() => { currentCard.style.transition = ''; }, 300);
        }, 300);
        // === "刚回来"气喘吁吁状态（被捕获后也有）===
        setTimeout(() => showJustReturnedState(currentCard), 400);
      }
      el.remove();
      // 从列表中移除
      escapedPets = escapedPets.filter(p => p !== petData);
      // 从全局出逃集合中移除
      if (petInfo.petId) window._escapedPetIds.delete(String(petInfo.petId));
      // 如果所有宠物都被捕获了，结束出逃状态
      if (escapedPets.length === 0) {
        escapeActive = false;
        lastEscapeEnd = Date.now();
        document.querySelectorAll('.escape-pawprint, .escaped-pet-trail, .escape-food-card, .escape-action-particle').forEach(e => e.remove());
      }
    }, 1500);
  }

  // 创建出逃宠物元素
  function createEscapedPetEl(petInfo) {
    const el = document.createElement('div');
    el.className = 'escaped-pet';
    if (petInfo.imgSrc) {
      el.innerHTML = `<img src="${petInfo.imgSrc}" alt="${petInfo.name}">`;
    } else {
      el.innerHTML = `<span style="font-size:70px">${petInfo.emoji || '🐾'}</span>`;
    }
    document.body.appendChild(el);
    return el;
  }

  // 显示台词气泡
  function showSpeechBubble(el) {
    // 移除旧气泡
    const old = el.querySelector('.escape-speech');
    if (old) old.remove();
    const bubble = document.createElement('div');
    bubble.className = 'escape-speech';
    bubble.textContent = SPEECHES[Math.floor(Math.random() * SPEECHES.length)];
    el.appendChild(bubble);
    setTimeout(() => bubble.remove(), 3600);
  }

  // 显示表情气泡
  function showEmote(el) {
    const old = el.querySelector('.escape-emote');
    if (old) old.remove();
    const emote = document.createElement('div');
    emote.className = 'escape-emote';
    emote.textContent = EMOTES[Math.floor(Math.random() * EMOTES.length)];
    el.appendChild(emote);
    setTimeout(() => emote.remove(), 2000);
  }

  // 随机播放动物叫声
  const ANIMAL_SOUNDS = ['meow','bark','chirp','squeak','purr','ribbit'];
  function playRandomAnimalSound() {
    playEscapeSound(ANIMAL_SOUNDS[Math.floor(Math.random() * ANIMAL_SOUNDS.length)]);
  }

  // ===== 宠物个性系统 =====
  // 根据宠物名字/emoji推测类型，赋予不同性格
  const PET_PERSONALITIES = {
    cat:    { speed: 2.8, pauseChance: 0.30, sounds: ['meow','purr'], preferActions: ['sit','sniff','stretch','sleep','peek'],
              speeches: ['喵~','好高的地方~','我要躲起来~','不要碰我的尾巴！','哼，懒得理你~','给我小鱼干！'], emotes: ['🐟','💤','😼','🐾','✨'] },
    dog:    { speed: 4.8, pauseChance: 0.15, sounds: ['bark'], preferActions: ['bounce','roll','shake','hop','wave'],
              speeches: ['汪汪！','好开心！','一起跑步！','接飞盘！','我最忠诚了！','尾巴摇摇~'], emotes: ['🦴','❤️','🎾','💕','😆'] },
    bird:   { speed: 4.2, pauseChance: 0.18, sounds: ['chirp'], preferActions: ['hop','bounce','wave','peek'],
              speeches: ['叽叽！','我会飞哦~','好高好高~','种子在哪？','唧唧喳喳~','翅膀好累~'], emotes: ['🌸','🎵','🎶','✨','☁️'] },
    hamster:{ speed: 2.3, pauseChance: 0.32, sounds: ['squeak'], preferActions: ['spin','roll','sniff','nuzzle','sleep'],
              speeches: ['吱吱！','转圈圈~','我的瓜子呢？','好小好可爱~','仓鼠球！','让我存粮~'], emotes: ['🌻','🥜','😊','💦','⭐'] },
    rabbit: { speed: 3.6, pauseChance: 0.22, sounds: ['squeak','cute'], preferActions: ['hop','bounce','nuzzle','sniff','peek'],
              speeches: ['蹦蹦跳~','胡萝卜！','耳朵痒痒~','我最软了~','抱抱我~','跳跳跳！'], emotes: ['🥕','💕','🌟','🐾','😊'] },
    frog:   { speed: 3.0, pauseChance: 0.28, sounds: ['ribbit'], preferActions: ['hop','bounce','sit','sniff'],
              speeches: ['呱呱~','好湿润~','跳远冠军！','池塘在哪？','我是王子哦~','虫子！'], emotes: ['🌿','💧','👑','🪷','⭐'] },
    fish:   { speed: 1.8, pauseChance: 0.35, sounds: ['cute','squeak'], preferActions: ['wave','nuzzle','spin','sit'],
              speeches: ['咕噜噜~','水在哪呀~','我会游泳！','泡泡~','鱼缸太小了！','自由啦~'], emotes: ['💧','🫧','🌊','✨','💦'] },
    default:{ speed: 3.3, pauseChance: 0.22, sounds: ['cute','squeak','meow'], preferActions: ['sit','wave','spin','hop','bounce','nuzzle'],
              speeches: null, emotes: null }
  };

  // 根据宠物信息推断性格
  function detectPersonality(petInfo) {
    const name = (petInfo.name || '').toLowerCase();
    const emoji = petInfo.emoji || '';
    // 按emoji判断
    if (/🐱|🐈|😺|😸|😻|😽|🙀|😿|😾|猫/.test(emoji + name)) return PET_PERSONALITIES.cat;
    if (/🐶|🐕|🦮|🐩|🐾|狗|犬/.test(emoji + name)) return PET_PERSONALITIES.dog;
    if (/🐦|🐧|🐤|🐣|🐥|🦅|🦆|🦉|🦜|🕊|鸟|鹦/.test(emoji + name)) return PET_PERSONALITIES.bird;
    if (/🐹|🐭|🐀|鼠|仓/.test(emoji + name)) return PET_PERSONALITIES.hamster;
    if (/🐰|🐇|兔/.test(emoji + name)) return PET_PERSONALITIES.rabbit;
    if (/🐸|🐊|蛙|青/.test(emoji + name)) return PET_PERSONALITIES.frog;
    if (/🐟|🐠|🐡|🦈|鱼/.test(emoji + name)) return PET_PERSONALITIES.fish;
    if (/🐍|🦎|蛇|蜥/.test(emoji + name)) return PET_PERSONALITIES.hamster; // 类似仓鼠行为
    if (/🦊|🐺|狐|狼/.test(emoji + name)) return PET_PERSONALITIES.dog; // 类似狗行为
    if (/🐻|🐼|熊|猫熊/.test(emoji + name)) return PET_PERSONALITIES.cat; // 类似猫行为
    return PET_PERSONALITIES.default;
  }

  // 根据性格选动作
  function getPersonalityAction(personality) {
    if (personality.preferActions && Math.random() < 0.7) {
      const pref = personality.preferActions;
      const actionName = pref[Math.floor(Math.random() * pref.length)];
      const found = CUTE_ACTIONS.find(a => a.name === actionName);
      if (found) return found;
    }
    return CUTE_ACTIONS[1 + Math.floor(Math.random() * (CUTE_ACTIONS.length - 1))];
  }

  // 根据性格播放叫声
  function playPersonalitySound(personality) {
    if (personality.sounds && personality.sounds.length > 0) {
      playEscapeSound(personality.sounds[Math.floor(Math.random() * personality.sounds.length)]);
    } else {
      playRandomAnimalSound();
    }
  }

  // 根据性格选台词
  function getPersonalitySpeech(personality) {
    if (personality.speeches && Math.random() < 0.6) {
      return personality.speeches[Math.floor(Math.random() * personality.speeches.length)];
    }
    return SPEECHES[Math.floor(Math.random() * SPEECHES.length)];
  }

  // 根据性格选表情
  function getPersonalityEmote(personality) {
    if (personality.emotes && Math.random() < 0.6) {
      return personality.emotes[Math.floor(Math.random() * personality.emotes.length)];
    }
    return EMOTES[Math.floor(Math.random() * EMOTES.length)];
  }

  // 执行可爱动作（个性化）
  // 特效粒子系统
  function spawnActionFX(el, fxType) {
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const fxMap = {
      stars: ['⭐','🌟','✨','💫'],
      sparkle: ['✨','💖','🌈','⚡'],
      hearts: ['❤️','💕','💗','💝','💖'],
      music: ['🎵','🎶','🎤','🎸','💃'],
      wind: ['🌀','💨','🍃','🌊']
    };
    const emojis = fxMap[fxType] || fxMap.sparkle;
    const count = 6 + Math.floor(Math.random() * 5);
    for (let i = 0; i < count; i++) {
      const p = document.createElement('div');
      p.className = 'escape-action-particle';
      p.textContent = emojis[Math.floor(Math.random() * emojis.length)];
      const angle = (Math.PI * 2 / count) * i + Math.random() * 0.5;
      const dist = 40 + Math.random() * 60;
      p.style.cssText = `position:fixed;z-index:9999;pointer-events:none;font-size:${14+Math.random()*12}px;left:${cx}px;top:${cy}px;`;
      p.style.setProperty('--tx', Math.cos(angle) * dist + 'px');
      p.style.setProperty('--ty', Math.sin(angle) * dist - 20 + 'px');
      p.style.animation = `actionParticleFly ${0.6 + Math.random() * 0.6}s ease-out forwards`;
      p.style.animationDelay = (i * 0.04) + 's';
      document.body.appendChild(p);
      setTimeout(() => p.remove(), 1500);
    }
  }

  // 地面震动效果
  function screenShake(intensity) {
    const body = document.body;
    const dur = 300;
    const start = Date.now();
    function shake() {
      const elapsed = Date.now() - start;
      if (elapsed > dur) { body.style.transform = ''; return; }
      const progress = 1 - elapsed / dur;
      const x = (Math.random() - 0.5) * intensity * progress;
      const y = (Math.random() - 0.5) * intensity * progress;
      body.style.transform = `translate(${x}px, ${y}px)`;
      requestAnimationFrame(shake);
    }
    requestAnimationFrame(shake);
  }

  // 食物卡片生成与追逐
  function spawnFoodCard(petEl, petData) {
    if (!escapeActive || !petEl.isConnected) return;
    const food = FOOD_CARDS[Math.floor(Math.random() * FOOD_CARDS.length)];
    const card = document.createElement('div');
    card.className = 'escape-food-card';
    const fx = Math.random() * (window.innerWidth - 120) + 60;
    const fy = Math.random() * (window.innerHeight - 160) + 80;
    card.style.left = fx + 'px';
    card.style.top = fy + 'px';
    card.innerHTML = `<span class="food-emoji">${food.emoji}</span><span class="food-name">${food.name}</span>`;
    card.style.setProperty('--food-color', food.color);
    document.body.appendChild(card);

    // 检测宠物靠近食物
    let eaten = false;
    const checkEat = setInterval(() => {
      if (eaten || !petEl.isConnected || !card.isConnected || petData.caught) {
        clearInterval(checkEat);
        if (card.isConnected) card.remove();
        return;
      }
      const px = parseFloat(petEl.style.left) || 0;
      const py = parseFloat(petEl.style.top) || 0;
      const dist = Math.sqrt((px + 65 - fx) ** 2 + (py + 65 - fy) ** 2);
      if (dist < 80) {
        eaten = true;
        clearInterval(checkEat);
        // 吃掉动画
        card.style.animation = 'foodEaten 0.5s ease forwards';
        // 宠物开心反应
        const inner = petEl.querySelector('img') || petEl.querySelector('span');
        if (inner) inner.style.animation = 'escapeSuperBounce 0.8s ease-in-out 1';
        // 满足表情
        const yumBubble = document.createElement('div');
        yumBubble.className = 'escape-speech';
        const yumTexts = ['好好吃！','太美味了~','还想要！','嗝~','幸福~','好满足！','再来一个嘛~','吃饱啦！'];
        yumBubble.textContent = yumTexts[Math.floor(Math.random() * yumTexts.length)];
        petEl.appendChild(yumBubble);
        setTimeout(() => yumBubble.remove(), 3000);
        // 吃掉特效
        spawnActionFX(card, 'hearts');
        playEscapeSound('cute');
        // 满足心形喷射
        for (let i = 0; i < 5; i++) {
          setTimeout(() => {
            const h = document.createElement('div');
            h.className = 'escape-emote';
            h.textContent = ['😋','🤤','💕','⭐','🥰'][i % 5];
            h.style.right = (-15 + Math.random() * 30) + 'px';
            h.style.top = (-20 - Math.random() * 20) + 'px';
            petEl.appendChild(h);
            setTimeout(() => h.remove(), 2000);
          }, i * 200);
        }
        setTimeout(() => {
          if (inner) inner.style.animation = 'escapeRun 0.5s linear infinite';
          card.remove();
        }, 800);
      }
    }, 100);

    // 食物自动消失
    setTimeout(() => {
      if (!eaten && card.isConnected) {
        card.style.animation = 'foodFade 0.5s ease forwards';
        setTimeout(() => card.remove(), 500);
      }
    }, 8000);
  }

  function doCuteAction(el, personality) {
    const p = personality || PET_PERSONALITIES.default;
    const action = getPersonalityAction(p);
    const inner = el.querySelector('img') || el.querySelector('span');
    if (!inner) return;
    inner.style.animation = action.anim;
    // 播放个性化叫声
    if (Math.random() < 0.45) playPersonalitySound(p);
    else if (Math.random() < 0.3) playEscapeSound('cute');
    // 震撼特效
    if (action.fx) spawnActionFX(el, action.fx);
    // 打滚和翻跟头时加屏幕微震
    if (action.name === 'roll' || action.name === 'faceplant' || action.name === 'belly') {
      screenShake(3);
    }
    // 70%概率显示个性化表情
    if (Math.random() < 0.7) {
      const old = el.querySelector('.escape-emote');
      if (old) old.remove();
      const emote = document.createElement('div');
      emote.className = 'escape-emote';
      emote.textContent = getPersonalityEmote(p);
      el.appendChild(emote);
      setTimeout(() => emote.remove(), 2000);
    }
    setTimeout(() => {
      inner.style.animation = 'escapeRun 0.5s linear infinite';
    }, action.dur || 1000);
  }

  // 宠物出逃主逻辑（forced=true 时跳过冷却检查，用于保底触发）
  function startEscape(forced) {
    if (escapeActive) return;
    if (!isOnFirstPage()) return;
    if (hasModalOpen()) return;
    if (!forced && Date.now() - lastEscapeEnd < ESCAPE_COOLDOWN) return;

    const pets = getEscapablePets();
    if (pets.length === 0) return;

    escapeActive = true;
    lastEscapeStart = Date.now();
    scheduleGuaranteedEscape();

    // 随机选1~3只
    const count = Math.min(1 + Math.floor(Math.random() * MAX_ESCAPED), pets.length);
    const shuffled = pets.sort(() => Math.random() - 0.5).slice(0, count);
    const W = window.innerWidth;
    const H = window.innerHeight;

    shuffled.forEach((petInfo, petIdx) => {
      const delay = petIdx * 800; // 错开出场

      setTimeout(() => {
        if (!escapeActive) return;

        // === 出逃前预告阶段 ===
        showPreEscapePreview(petInfo.card).then(() => {
          if (!escapeActive) return;

        // 从卡片位置跳出
        const cardRect = petInfo.card.getBoundingClientRect();
        const el = createEscapedPetEl(petInfo);
        el.style.left = (cardRect.left + cardRect.width / 2 - 65) + 'px';
        el.style.top = (cardRect.top + cardRect.height / 2 - 65) + 'px';

        // 跳出动画
        const inner = el.querySelector('img') || el.querySelector('span');
        if (inner) inner.style.animation = 'escapeJumpOut 0.6s ease-out 1';

        playEscapeSound('appear');

        // === 跳出瞬间粒子爆炸 ===
        const burstX = cardRect.left + cardRect.width / 2;
        const burstY = cardRect.top + cardRect.height / 2;
        burstEscapeParticles(burstX, burstY);

        // 卡片上宠物消失（出逃了）
        hideCardPet(petInfo.card);

        // 卡片原位抖动提示
        petInfo.card.style.transition = 'transform 0.15s';
        petInfo.card.style.transform = 'scale(0.95)';
        setTimeout(() => {
          petInfo.card.style.transform = '';
          setTimeout(() => petInfo.card.style.transition = '', 200);
        }, 200);

        const personality = detectPersonality(petInfo);
        const petData = { el, petInfo, phase: 'jumpOut', caught: false, personality };
        escapedPets.push(petData);
        // 记录出逃宠物ID（用于DOM重建时保持出逃状态）
        if (petInfo.petId) window._escapedPetIds.add(String(petInfo.petId));

        // 点击捕获
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          catchPet(petData);
        });
        el.addEventListener('touchstart', (e) => {
          e.stopPropagation();
          catchPet(petData);
        }, { passive: true });

        // 0.7秒后开始自由漫步（全屏可去，避开卡片区域，各宠物分散）
        setTimeout(() => {
          if (!escapeActive || !el.isConnected) return;

          const inner = el.querySelector('img') || el.querySelector('span');

          // 出逃宠物尺寸
          const PET_SIZE = 130;
          const HALF = PET_SIZE / 2;

          // 收集未出逃的宠物卡片图片中心点作为禁区（扩大半径）
          function getCardCenters() {
            const centers = [];
            document.querySelectorAll('#homePetGrid .home-pet-card').forEach(c => {
              // 跳过已出逃的卡片（图片被隐藏的）
              const img = c.querySelector('.home-pet-top img, .home-pet-top span');
              if (img && img.style.display === 'none') return;
              const r = c.querySelector('.home-pet-top');
              if (!r) return;
              const rect = r.getBoundingClientRect();
              if (rect.width > 0 && rect.height > 0) {
                centers.push({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, w: rect.width, h: rect.height });
              }
            });
            return centers;
          }

          // 检查宠物中心是否落在某个卡片图片中心的禁区内（半径扩大到80px）
          function hitsCardCenter(px, py, centers) {
            const cx = px + HALF, cy = py + HALF;
            for (const c of centers) {
              if (Math.abs(cx - c.x) < 80 && Math.abs(cy - c.y) < 80) return true;
            }
            return false;
          }

          // 检查是否与其他出逃宠物重叠（中心距至少PET_SIZE，避免叠加）
          function overlapsOtherPets(px, py, selfEl) {
            const cx = px + HALF, cy = py + HALF;
            for (const p of escapedPets) {
              if (p.el === selfEl || !p.el.isConnected) continue;
              const ox = (parseFloat(p.el.style.left) || 0) + HALF;
              const oy = (parseFloat(p.el.style.top) || 0) + HALF;
              const dist = Math.sqrt((cx - ox) ** 2 + (cy - oy) ** 2);
              if (dist < PET_SIZE) return true;
            }
            return false;
          }

          // 计算一个位置的"空旷度"分数：离所有卡片和其他出逃宠物越远越好
          function emptinessScore(px, py, centers) {
            const cx = px + HALF, cy = py + HALF;
            let minCardDist = Infinity;
            for (const c of centers) {
              const d = Math.sqrt((cx - c.x) ** 2 + (cy - c.y) ** 2);
              if (d < minCardDist) minCardDist = d;
            }
            let minPetDist = Infinity;
            for (const p of escapedPets) {
              if (p.el === el || !p.el.isConnected) continue;
              const ox = (parseFloat(p.el.style.left) || 0) + HALF;
              const oy = (parseFloat(p.el.style.top) || 0) + HALF;
              const d = Math.sqrt((cx - ox) ** 2 + (cy - oy) ** 2);
              if (d < minPetDist) minPetDist = d;
            }
            // 综合得分：离卡片和其他宠物都越远越好
            const cardScore = Math.min(minCardDist, 500) / 500; // 归一化到0~1
            const petScore = minPetDist === Infinity ? 1 : Math.min(minPetDist, 400) / 400;
            return cardScore * 0.6 + petScore * 0.4;
          }

          // 随机漫游系统：宠物沿随机曲线路径移动，每次路径都不同
          let wanderAngle = Math.random() * Math.PI * 2; // 初始随机方向
          let wanderTimer = 0;
          const WANDER_CHANGE_INTERVAL = 1500 + Math.random() * 2000; // 1.5~3.5秒换一次大方向
          let lastWanderChange = Date.now();

          // 更新漫游方向（每帧调用）
          function updateWander() {
            const now = Date.now();
            // 每帧小幅随机偏转（自然曲线）
            wanderAngle += (Math.random() - 0.5) * 0.15;

            // 定期大转向
            if (now - lastWanderChange > WANDER_CHANGE_INTERVAL) {
              wanderAngle += (Math.random() - 0.5) * Math.PI * 0.8; // 大幅转向
              lastWanderChange = now;
            }

            // 边界回避：接近边缘时转向中心
            const cx = currentX + HALF;
            const cy = currentY + HALF;
            const margin = 80;
            if (cx < margin) wanderAngle = Math.abs(wanderAngle) < Math.PI / 2 ? wanderAngle : 0;
            if (cx > W - margin) wanderAngle = Math.abs(wanderAngle) > Math.PI / 2 ? wanderAngle : Math.PI;
            if (cy < margin) wanderAngle = wanderAngle > 0 ? wanderAngle : -wanderAngle;
            if (cy > H - margin) wanderAngle = wanderAngle < 0 ? wanderAngle : -wanderAngle;

            // 卡片回避：检测前方是否有卡片，有则转向
            const centers = getCardCenters();
            const lookAhead = 120;
            const futureX = cx + Math.cos(wanderAngle) * lookAhead;
            const futureY = cy + Math.sin(wanderAngle) * lookAhead;
            for (const c of centers) {
              const dx = futureX - c.x;
              const dy = futureY - c.y;
              if (Math.sqrt(dx * dx + dy * dy) < 100) {
                wanderAngle += (Math.random() > 0.5 ? 1 : -1) * Math.PI * 0.5;
                break;
              }
            }
          }

          // 全屏智能选目标点：优先远处、空旷的位置（用于首次目标和动作后重新出发）
          function pickSafeTarget() {
            const padX = 30, padY = 10;
            const centers = getCardCenters();
            // 最小跑动距离：视口对角线的35%，至少200px，确保宠物跑得更远
            const diag = Math.sqrt(W * W + H * H);
            const minRunDist = Math.max(200, diag * 0.35);

            let bestTarget = null;
            let bestScore = -1;

            // 第一轮：严格模式（避开卡片+避开其他宠物+满足最小距离+空旷度评分）
            for (let i = 0; i < 60; i++) {
              const tx = padX + Math.random() * (W - 2 * padX - PET_SIZE);
              const ty = padY + Math.random() * (H - 2 * padY - PET_SIZE);
              if (!hitsCardCenter(tx, ty, centers) && !overlapsOtherPets(tx, ty, el)) {
                // 检查最小距离（从当前位置出发）
                const dx = (tx + HALF) - (currentX + HALF);
                const dy = (ty + HALF) - (currentY + HALF);
                const distFromHere = Math.sqrt(dx * dx + dy * dy);
                if (distFromHere >= minRunDist) {
                  const score = emptinessScore(tx, ty, centers);
                  if (score > bestScore) {
                    bestScore = score;
                    bestTarget = { x: tx, y: ty };
                  }
                }
              }
            }
            if (bestTarget) return bestTarget;

            // 第二轮：放宽最小距离到50%，仍然选最空旷的
            for (let i = 0; i < 40; i++) {
              const tx = padX + Math.random() * (W - 2 * padX - PET_SIZE);
              const ty = padY + Math.random() * (H - 2 * padY - PET_SIZE);
              if (!hitsCardCenter(tx, ty, centers) && !overlapsOtherPets(tx, ty, el)) {
                const dx = (tx + HALF) - (currentX + HALF);
                const dy = (ty + HALF) - (currentY + HALF);
                const distFromHere = Math.sqrt(dx * dx + dy * dy);
                if (distFromHere >= minRunDist * 0.5) {
                  const score = emptinessScore(tx, ty, centers);
                  if (score > bestScore) {
                    bestScore = score;
                    bestTarget = { x: tx, y: ty };
                  }
                }
              }
            }
            if (bestTarget) return bestTarget;

            // 第三轮：只避免宠物叠加，选最空旷的
            for (let i = 0; i < 30; i++) {
              const tx = padX + Math.random() * (W - 2 * padX - PET_SIZE);
              const ty = padY + Math.random() * (H - 2 * padY - PET_SIZE);
              if (!overlapsOtherPets(tx, ty, el)) {
                const score = emptinessScore(tx, ty, centers);
                if (score > bestScore) {
                  bestScore = score;
                  bestTarget = { x: tx, y: ty };
                }
              }
            }
            if (bestTarget) return bestTarget;

            // 退路
            return { x: padX + Math.random() * (W - 2 * padX - PET_SIZE), y: padY + Math.random() * (H - 2 * padY - PET_SIZE) };
          }

          // 跑动动画
          if (inner) inner.style.animation = 'escapeRun 0.5s linear infinite';

          let currentX = parseFloat(el.style.left) || W / 2;
          let currentY = parseFloat(el.style.top) || H / 2;
          const totalRunTime = ESCAPE_DURATION - 2000;
          let runFrame = null;
          let actionTimeout = null;
          let stepSoundInterval = null;
          let speechTimeout = null;
          let pawprintInterval = null;
          let animalSoundInterval = null;
          let paused = false;
          let target = pickSafeTarget(); // 首次目标（远处空旷位置）
          let speed = personality.speed + Math.random() * 1.0; // 基础速度+随机浮动
          let useWanderMode = false; // 到达首个目标后切换为漫游模式

          el.style.transition = 'none';

          // 脚步声
          stepSoundInterval = setInterval(() => {
            if (!paused && Math.random() < 0.25) playEscapeSound('step');
          }, 600);

          // 脚印
          pawprintInterval = setInterval(() => {
            if (!paused) dropPawprint(currentX + 40 + Math.random() * 40, currentY + 100);
            if (!paused && Math.random() < 0.3) dropTrail(currentX + 65, currentY + 65);
          }, 900);

          // 个性化叫声
          animalSoundInterval = setInterval(() => {
            if (!paused && Math.random() < 0.35) playPersonalitySound(personality);
          }, 3500);

          // 第一句个性化台词
          setTimeout(() => {
            const old = el.querySelector('.escape-speech');
            if (old) old.remove();
            const bubble = document.createElement('div');
            bubble.className = 'escape-speech';
            bubble.textContent = getPersonalitySpeech(personality);
            el.appendChild(bubble);
            setTimeout(() => bubble.remove(), 3600);
          }, 300);
          // 铃铛声
          setTimeout(() => playEscapeSound('bell'), 500);
          // 出场叫声（个性化）
          setTimeout(() => playPersonalitySound(personality), 800);

          // 跑动帧 - 混合模式：先跑到远处目标，然后切换为随机漫游
          function runStep() {
            if (!escapeActive || !el.isConnected || petData.caught) { cleanup(); return; }
            if (!paused) {
              if (!useWanderMode) {
                // 阶段1：跑到首个远处目标
                const dx = target.x - currentX;
                const dy = target.y - currentY;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 10) {
                  // 到达目标，切换为漫游模式
                  useWanderMode = true;
                  wanderAngle = Math.atan2(dy, dx) + (Math.random() - 0.5) * Math.PI; // 从到达方向继续偏转
                } else {
                  currentX += (dx / dist) * speed;
                  currentY += (dy / dist) * speed;
                  el.style.left = currentX + 'px';
                  el.style.top = currentY + 'px';
                  if (inner) {
                    inner.style.transform = dx < 0 ? 'scaleX(-1)' : '';
                  }
                }
              } else {
                // 阶段2：随机漫游模式
                updateWander();
                const moveX = Math.cos(wanderAngle) * speed;
                const moveY = Math.sin(wanderAngle) * speed;
                currentX += moveX;
                currentY += moveY;
                el.style.left = currentX + 'px';
                el.style.top = currentY + 'px';
                if (inner) {
                  inner.style.transform = moveX < 0 ? 'scaleX(-1)' : '';
                }
              }
            }
            runFrame = requestAnimationFrame(runStep);
          }
          runFrame = requestAnimationFrame(runStep);

          // 随机停下做动作 + 说话 + 表情（个性化频率）
          function scheduleCuteAction() {
            const wait = 2200 + Math.random() * 2800;
            actionTimeout = setTimeout(() => {
              if (!escapeActive || !el.isConnected || petData.caught) return;
              // 根据性格决定是否停下（活泼的宠物停的少）
              if (Math.random() > personality.pauseChance) { scheduleCuteAction(); return; }
              paused = true;
              doCuteAction(el, personality);
              // 40%概率生成食物卡片
              if (Math.random() < 0.4) {
                setTimeout(() => spawnFoodCard(el, petData), 500);
              }
              // 个性化台词
              if (Math.random() < 0.6) {
                speechTimeout = setTimeout(() => {
                  const old = el.querySelector('.escape-speech');
                  if (old) old.remove();
                  const bubble = document.createElement('div');
                  bubble.className = 'escape-speech';
                  bubble.textContent = getPersonalitySpeech(personality);
                  el.appendChild(bubble);
                  setTimeout(() => bubble.remove(), 3600);
                }, 300);
              }
              // 随机表情
              if (Math.random() < 0.5) {
                setTimeout(() => showEmote(el), 600);
              }
              // 恢复跑动
              setTimeout(() => {
                paused = false;
                // 切换到漫游模式，随机新方向
                useWanderMode = true;
                wanderAngle = Math.random() * Math.PI * 2;
                lastWanderChange = Date.now();
                if (inner) inner.style.animation = 'escapeRun 0.5s linear infinite';
                scheduleCuteAction();
              }, 1500 + Math.random() * 1500);
            }, wait);
          }
          scheduleCuteAction();

          // 宠物间互动检测
          let lastInteraction = 0;
          petData.interactionInterval = setInterval(() => {
            if (paused || petData.caught || !el.isConnected) return;
            if (Date.now() - lastInteraction < 5000) return;
            for (const other of escapedPets) {
              if (other === petData || other.caught || !other.el.isConnected) continue;
              const ox = parseFloat(other.el.style.left) || 0;
              const oy = parseFloat(other.el.style.top) || 0;
              const dist = Math.sqrt((currentX - ox) ** 2 + (currentY - oy) ** 2);
              if (dist < 150 && dist > 30) {
                lastInteraction = Date.now();
                paused = true;
                const greetWords = ['你好呀~','一起玩吧！','嗨嗨~','来这边！','你也跑出来啦？','我们做朋友！'];
                const b1 = document.createElement('div');
                b1.className = 'escape-speech';
                b1.textContent = greetWords[Math.floor(Math.random() * greetWords.length)];
                el.appendChild(b1);
                setTimeout(() => b1.remove(), 3000);
                setTimeout(() => {
                  if (!other.el.isConnected || other.caught) return;
                  const replyWords = ['好呀好呀！','嘻嘻~','一起一起！','太好了~','开心！'];
                  const b2 = document.createElement('div');
                  b2.className = 'escape-speech';
                  b2.textContent = replyWords[Math.floor(Math.random() * replyWords.length)];
                  other.el.appendChild(b2);
                  setTimeout(() => b2.remove(), 3000);
                  showEmote(el);
                  showEmote(other.el);
                  playEscapeSound('cute');
                }, 800);
                setTimeout(() => { paused = false; }, 3000);
                break;
              }
            }
          }, 1500);

          function cleanup() {
            if (runFrame) cancelAnimationFrame(runFrame);
            if (actionTimeout) clearTimeout(actionTimeout);
            if (stepSoundInterval) clearInterval(stepSoundInterval);
            if (pawprintInterval) clearInterval(pawprintInterval);
            if (speechTimeout) clearTimeout(speechTimeout);
            if (animalSoundInterval) clearInterval(animalSoundInterval);
            if (petData.interactionInterval) clearInterval(petData.interactionInterval);
          }

          // 时间到：跑回卡片
          setTimeout(() => {
            cleanup();
            if (!el.isConnected) return;

            // 回去的台词
            const byeWords = ['回去啦~','下次见！','要乖乖的哦~','拜拜~','我回窝啦！','再见主人~'];
            const byeBubble = document.createElement('div');
            byeBubble.className = 'escape-speech';
            byeBubble.textContent = byeWords[Math.floor(Math.random() * byeWords.length)];
            el.appendChild(byeBubble);

            playEscapeSound('bye');

            // 查找当前有效的卡片元素（可能被 renderHomePetGrid 重建过）
            let currentCard = petInfo.card;
            if (petInfo.studentId) {
              const newCard = document.querySelector(`#homePetGrid .home-pet-card[data-sid="${petInfo.studentId}"]`);
              if (newCard && newCard.isConnected) {
                currentCard = newCard;
              }
            }

            // 飞回卡片位置
            if (!currentCard || !currentCard.isConnected) { el.remove(); return; }
            const endRect = currentCard.getBoundingClientRect();
            // v47: 先清除旧transition，强制reflow，再设置新transition（修复移动端CSS transition不生效）
            el.style.transition = 'none';
            void el.offsetWidth; // 强制reflow
            el.style.transition = 'left 0.8s ease-in, top 0.8s ease-in, opacity 0.8s';
            el.style.left = (endRect.left + endRect.width / 2 - 65) + 'px';
            el.style.top = (endRect.top + endRect.height / 2 - 65) + 'px';

            setTimeout(() => {
              if (inner) inner.style.animation = 'escapeReturnToCard 0.5s ease forwards';
              el.style.opacity = '0';
            }, 600);

            // 卡片恢复弹跳 + 宠物图片恢复显示
            setTimeout(() => {
              // 从全局出逃集合中移除（必须在 showCardPet 之前，否则卡片仍显示"出逃中"）
              if (petInfo.petId) window._escapedPetIds.delete(String(petInfo.petId));
              escapedPets = escapedPets.filter(p => p !== petData);

              // 恢复卡片宠物显示
              showCardPet(currentCard);
              currentCard.style.transition = 'transform 0.3s';
              currentCard.style.transform = 'scale(1.05)';
              setTimeout(() => {
                currentCard.style.transform = '';
                setTimeout(() => currentCard.style.transition = '', 300);
              }, 300);
              // === "刚回来"气喘吁吁状态 ===
              setTimeout(() => showJustReturnedState(currentCard), 400);

              // 如果所有宠物都回来了，结束出逃状态
              if (escapedPets.length === 0) {
                escapeActive = false;
                lastEscapeEnd = Date.now();
                document.querySelectorAll('.escape-pawprint, .escaped-pet-trail, .escape-food-card, .escape-action-particle').forEach(e => e.remove());
              }
            }, 1000);

            setTimeout(() => el.remove(), 1500);
          }, totalRunTime);

        }, 700);
        }); // end showPreEscapePreview.then
      }, delay);
    });

    // 整体超时清理
    setTimeout(() => {
      escapeActive = false;
      lastEscapeEnd = Date.now();
      escapedPets.forEach(p => {
        if (p.el && p.el.isConnected) p.el.remove();
        // 查找当前有效的卡片元素（可能被 renderHomePetGrid 重建过）
        let currentCard = p.petInfo ? p.petInfo.card : null;
        if (p.petInfo && p.petInfo.studentId) {
          const newCard = document.querySelector(`#homePetGrid .home-pet-card[data-sid="${p.petInfo.studentId}"]`);
          if (newCard && newCard.isConnected) {
            currentCard = newCard;
          }
        }
        if (currentCard) showCardPet(currentCard);
        // 从全局出逃集合中移除
        if (p.petInfo && p.petInfo.petId) window._escapedPetIds.delete(String(p.petInfo.petId));
      });
      escapedPets = [];
      // 清理残留脚印和轨迹
      document.querySelectorAll('.escape-pawprint, .escaped-pet-trail, .escape-food-card, .escape-action-particle').forEach(e => e.remove());
    }, ESCAPE_DURATION + shuffled.length * 800 + 2000 + 3000); // +3000 for pre-escape preview
  }

  // 用户活动时立即收回所有出逃宠物
  function cancelEscape() {
    if (!escapeActive) return;
    escapeActive = false;
    lastEscapeEnd = Date.now();
    
    // v46: Clear timers to prevent immediate re-escape
    clearTimeout(guaranteedTimer);
    clearTimeout(idleTimer);
    
    escapedPets.forEach(p => {
      // v46: Clear interaction interval to prevent leak
      if (p.interactionInterval) clearInterval(p.interactionInterval);
      
      // 查找当前有效的卡片元素（可能被 renderHomePetGrid 重建过）
      let currentCard = p.petInfo ? p.petInfo.card : null;
      if (p.petInfo && p.petInfo.studentId) {
        const newCard = document.querySelector(`#homePetGrid .home-pet-card[data-sid="${p.petInfo.studentId}"]`);
        if (newCard && newCard.isConnected) {
          currentCard = newCard;
        }
      }
      // 恢复卡片上的宠物图片
      if (currentCard) showCardPet(currentCard);
      // 从全局出逃集合中移除
      if (p.petInfo && p.petInfo.petId) window._escapedPetIds.delete(String(p.petInfo.petId));
      if (p.el && p.el.isConnected) {
        p.el.style.transition = 'opacity 0.4s';
        p.el.style.opacity = '0';
        setTimeout(() => p.el.remove(), 500);
      }
    });
    escapedPets = [];
    document.querySelectorAll('.escape-pawprint, .escaped-pet-trail, .escape-food-card, .escape-action-particle').forEach(e => e.remove());
  }

  // 保底出逃调度：确保两分钟内至少出逃一次
  function scheduleGuaranteedEscape() {
    clearTimeout(guaranteedTimer);
    const elapsed = Date.now() - lastEscapeStart;
    // 在 [30秒, 2分钟] 之间随机选一个时间触发下次出逃
    const minDelay = Math.max(ESCAPE_COOLDOWN, ESCAPE_COOLDOWN - elapsed);
    const maxDelay = GUARANTEED_ESCAPE_MAX;
    const delay = minDelay + Math.random() * (maxDelay - minDelay);
    guaranteedTimer = setTimeout(() => {
      if (document.visibilityState === 'visible' && isOnFirstPage() && !hasModalOpen()) {
        startEscape(true);
      } else {
        // 条件不满足，再等一会儿重试
        scheduleGuaranteedEscape();
      }
    }, delay);
  }

  // 闲置检测（用户操作不再取消出逃，只重置闲置计时）
  function resetIdleTimer() {
    lastActivity = Date.now();
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      if (isOnFirstPage() && !hasModalOpen() && document.visibilityState === 'visible') {
        startEscape();
      }
    }, IDLE_THRESHOLD);
  }

  // 监听用户活动（仅用于触发下一次出逃的闲置检测，不取消当前出逃）
  const ACTIVITY_EVENTS = ['mousedown','keydown','touchstart','scroll','wheel','click'];
  ACTIVITY_EVENTS.forEach(evt => {
    document.addEventListener(evt, resetIdleTimer, { passive: true });
  });

  // 鼠标靠近时宠物害羞反应（使用 requestAnimationFrame 节流）
  let _mouseRAF = null;
  let _lastMouseX = 0, _lastMouseY = 0;
  document.addEventListener('mousemove', (e) => {
    lastActivity = Date.now();
    _lastMouseX = e.clientX;
    _lastMouseY = e.clientY;
    if (_mouseRAF) return; // 上一帧还未处理，跳过
    _mouseRAF = requestAnimationFrame(() => {
      _mouseRAF = null;
      const mx = _lastMouseX, my = _lastMouseY;
      escapedPets.forEach(p => {
        if (!p.el || !p.el.isConnected || p.caught) return;
        const rect = p.el.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dist = Math.sqrt((mx - cx) ** 2 + (my - cy) ** 2);
        if (dist < 100) {
          p.el.style.animation = 'escapeShyShake 0.3s ease-in-out';
          setTimeout(() => { if (p.el) p.el.style.animation = ''; }, 300);
          if (!p.fleeing) {
            p.fleeing = true;
            const dx = cx - mx;
            const dy = cy - my;
            const angle = Math.atan2(dy, dx);
            const flee = 30;
            const nx = parseFloat(p.el.style.left) + Math.cos(angle) * flee;
            const ny = parseFloat(p.el.style.top) + Math.sin(angle) * flee;
            const W = window.innerWidth, H = window.innerHeight;
            p.el.style.left = Math.max(10, Math.min(W - 140, nx)) + 'px';
            p.el.style.top = Math.max(10, Math.min(H - 140, ny)) + 'px';
            setTimeout(() => { p.fleeing = false; }, 500);
          }
        }
      });
    });
  }, { passive: true });

  // 页面切换时取消出逃
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) cancelEscape();
    else resetIdleTimer();
  });

  // 初始启动闲置计时 + 保底计时
  resetIdleTimer();
  scheduleGuaranteedEscape();
})();
// ========== 闲置宠物出逃系统结束 ==========
