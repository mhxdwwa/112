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
// 宠物配置：共84只（如需新增，手动添加并上传对应图片即可）
const PET_CONFIG_BASE = { "雪貂":{id:1,emoji:"🐕"},"六角恐龙":{id:2,emoji:"🐺"},"吉祥神兽":{id:3,emoji:"🦮"},"海马":{id:4,emoji:"🐶"},"荷兰兔":{id:5,emoji:"🐩"},"胖仓鼠":{id:6,emoji:"🐕‍🦺"},"小老鼠":{id:7,emoji:"🐕"},"七彩貂":{id:8,emoji:"🦮"},"比尔鸭":{id:9,emoji:"🐶"},"大白兔":{id:10,emoji:"🐕"},"北美浣熊":{id:11,emoji:"🐱"},"萌萌羊":{id:12,emoji:"🐈"},"泰迪":{id:13,emoji:"🐈"},"花斑虎":{id:14,emoji:"🐱"},"送财龙":{id:15,emoji:"🐈"},"青云龙":{id:16,emoji:"🐠"},"苍狮":{id:17,emoji:"🐟"},"七彩鸟":{id:18,emoji:"🦜"},"考拉":{id:19,emoji:"🐹"},"萌蝙蝠":{id:20,emoji:"🐰"},"淡火狐":{id:21,emoji:"🐢"},"长毛汪":{id:22,emoji:"🦔"},"呆呆熊":{id:23,emoji:"🐭"},"熊猫大侠":{id:24,emoji:"🐿️"},"荷兰猪":{id:25,emoji:"🐹"},"白白东":{id:26,emoji:"🦄"},"大神龟":{id:27,emoji:"🔥"},"不萌鼠":{id:28,emoji:"🐲"},"柯基犬":{id:29,emoji:"🐧"},"咩咩咩":{id:30,emoji:"🦉"},"白眉汪":{id:31,emoji:"🦅"},"哮天犬":{id:32,emoji:"🦚"},"芦丁鸡":{id:33,emoji:"🕊️"},"大萌星":{id:34,emoji:"🐤"},"小白":{id:35,emoji:"🐬"},"多萌肉":{id:36,emoji:"🐙"},"踏天马":{id:37,emoji:"🦈"},"刺猬":{id:38,emoji:"🐋"},"黑白犬":{id:39,emoji:"🦑"},"羊驼":{id:40,emoji:"🪼"},"黄牛":{id:41,emoji:"🦋"},"美杜莎":{id:42,emoji:"🐞"},"六耳猕狗":{id:43,emoji:"🐝"},"猫猫虎":{id:44,emoji:"🐌"},"黑白猪":{id:45,emoji:"🕷️"},"非洲象":{id:46,emoji:"🐜"},"幸运猫":{id:47,emoji:"🐻"},"孔雀":{id:48,emoji:"🐼"},"蜥蜴":{id:49,emoji:"🐨"},"恐龙":{id:50,emoji:"🦁"},"梅花鹿":{id:51,emoji:"🐯"},"火凤凰":{id:52,emoji:"🐘"},"寄居蟹":{id:53,emoji:"🦒"},"九尾天狐":{id:54,emoji:"🦓"},"果冻蝾螈":{id:55,emoji:"🦛"},"宠物56":{id:56,emoji:"🐾"},"宠物57":{id:57,emoji:"🐾"},"宠物58":{id:58,emoji:"🐾"},"宠物59":{id:59,emoji:"🐾"},"宠物60":{id:60,emoji:"🐾"},"宠物61":{id:61,emoji:"🐾"},"宠物62":{id:62,emoji:"🐾"},"宠物63":{id:63,emoji:"🐾"},"宠物64":{id:64,emoji:"🐾"},"宠物65":{id:65,emoji:"🐾"},"宠物66":{id:66,emoji:"🐾"},"宠物67":{id:67,emoji:"🐾"},"宠物68":{id:68,emoji:"🐾"},"宠物69":{id:69,emoji:"🐾"},"宠物70":{id:70,emoji:"🐾"},"宠物71":{id:71,emoji:"🐾"},"宠物72":{id:72,emoji:"🐾"},"宠物73":{id:73,emoji:"🐾"},"宠物74":{id:74,emoji:"🐾"},"宠物75":{id:75,emoji:"🐾"},"宠物76":{id:76,emoji:"🐾"},"宠物77":{id:77,emoji:"🐾"},"宠物78":{id:78,emoji:"🐾"},"宠物79":{id:79,emoji:"🐾"},"宠物80":{id:80,emoji:"🐾"},"宠物81":{id:81,emoji:"🐾"},"宠物82":{id:82,emoji:"🐾"},"宠物83":{id:83,emoji:"🐾"},"宠物84":{id:84,emoji:"🐾"} };
const PET_CONFIG = {};
Object.keys(PET_CONFIG_BASE).forEach(name=>{ PET_CONFIG[name] = {...PET_CONFIG_BASE[name], stages: generateStageCurve(), adoptCoins:0}; });

// ========== 宠物配置已固定为84只 ==========
// 如需新增宠物，在上方 PET_CONFIG_BASE 中添加对应条目，并上传 images/数字/1.webp 图片
console.log('[宠物系统] 已加载 ' + Object.keys(PET_CONFIG).length + ' 只宠物配置（固定）');


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
function safeLSSave(key, data) {
  // v-mid1: 优先写入 IndexedDB（容量 50MB+，无 5MB 限制）
  if (typeof StorageDB !== 'undefined' && StorageDB.isReady()) {
    StorageDB.save(key, data);
  }
  // 同时保留 localStorage 作为降级备份（迁移完成后 storage.js 会清理）
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch(e) {
    console.warn('localStorage写入失败('+key+'):', e.message);
    // v70: 安全降级策略 — 优先保留操作日志（operationLogs）
    // 操作日志是历史操作记录的核心数据，绝不能删除
    // 降级顺序：先删除低优先级缓存，最后才考虑截断日志
    try {
      // 1. 先删除低优先级数据
      localStorage.removeItem('logArchives');
      localStorage.setItem(key, JSON.stringify(data));
    } catch(e2) {
      try {
        // 2. 如果还不够，尝试截断最旧的操作日志（保留最近100条）
        // 而不是全部删除
        if (key !== 'operationLogs' && window.operationLogs && window.operationLogs.length > 100) {
          var truncatedLogs = window.operationLogs.slice(-100);
          localStorage.setItem('operationLogs', JSON.stringify(truncatedLogs));
          window.operationLogs = truncatedLogs;
          console.warn('localStorage容量不足，已截断操作日志至最近100条');
          localStorage.setItem(key, JSON.stringify(data));
        } else {
          console.warn('localStorage清理后仍失败，跳过本地缓存:', key);
        }
      } catch(e3) {
        console.warn('localStorage完全满溢，无法保存:', key);
      }
    }
  }
}
// ===== v-mid2: 输入验证工具函数 =====
// 过滤危险字符，防止 XSS 和数据异常
function _sanitizeInput(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/<[^>]*>/g, '')        // 移除 HTML 标签
            .replace(/javascript:/gi, '')    // 移除 javascript: 协议
            .replace(/on\w+\s*=/gi, '')      // 移除 on* 事件处理器
            .replace(/[\r\n\t]/g, '')        // 移除换行和制表符
            .trim();
}
// 验证并截断输入，返回 { ok, value, error }
function _validateInput(value, maxLen, label) {
  var cleaned = _sanitizeInput(value);
  if (!cleaned) return { ok: false, value: '', error: label + '不能为空' };
  if (cleaned.length > maxLen) return { ok: false, value: '', error: label + '不能超过' + maxLen + '个字' };
  return { ok: true, value: cleaned, error: null };
}
// 验证学生姓名（TXT导入批量验证）
function _validateStudentName(name) {
  var cleaned = _sanitizeInput(name);
  if (!cleaned) return null; // 空行跳过
  if (cleaned.length > 20) return null; // 超长跳过
  return cleaned;
}

// ===== v-mid3: 关键操作冷却时间 =====
// 防止误触或快速重复操作（如连续删除班级）
var _cooldowns = {};
function _startCooldown(action, seconds) {
  _cooldowns[action] = Date.now() + (seconds * 1000);
}
function _isOnCooldown(action) {
  if (!_cooldowns[action]) return false;
  if (Date.now() > _cooldowns[action]) {
    delete _cooldowns[action];
    return false;
  }
  return true;
}
function _cooldownRemaining(action) {
  if (!_cooldowns[action]) return 0;
  var remaining = Math.ceil((_cooldowns[action] - Date.now()) / 1000);
  return remaining > 0 ? remaining : 0;
}

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
// v127: 同步暂停标志 — 用于重置宠物/删除班级等关键操作期间防止竞态
var _pauseSync = false;
function triggerRealtimeSync() {
  if (typeof _syncToSupabase !== 'function') return;
  if (_pauseSync) return; // v127: 关键操作期间暂停同步
  if (_syncDebounceTimer) clearTimeout(_syncDebounceTimer);
    _syncDebounceTimer = setTimeout(function() {
      _syncDebounceTimer = null;
      if (_pauseSync) return; // v127: double-check
      _syncToSupabase();
    }, 500); // v-mid3: 500ms debounce — 平衡实时性和 Supabase 配额保护
}
// v25: Removed archiveOldLogs() from save flow — it was silently moving logs
// out of window.operationLogs into logArchives on every save, causing the visible
// log count to decrease. Archiving is no longer needed since _loadOperationLogs()
// loads ALL logs from Supabase and getAllLogsForMonth() includes archived logs.
function saveLogs(){
  safeLSSave('operationLogs', window.operationLogs);
  scheduleFileSave();
  triggerRealtimeSync();
  // v109: 写入策略优化 — 移动端页面随时可能被杀，必须尽快写入
  // 第一次操作立即写入（无防抖），后续操作50ms防抖（合并快速连续操作）
  if (typeof _writeUnsyncedLogsToSupabase === 'function') {
    if (!window._hasWrittenLogsThisSession) {
      // 第一次：立即写入，不等防抖
      window._hasWrittenLogsThisSession = true;
      if (window._logWriteTimer) clearTimeout(window._logWriteTimer);
      window._logWriteTimer = null;
      _writeUnsyncedLogsToSupabase();
    } else {
      // 后续：50ms 防抖（合并快速连续操作如批量奖惩）
      if (window._logWriteTimer) clearTimeout(window._logWriteTimer);
      window._logWriteTimer = setTimeout(function() {
        window._logWriteTimer = null;
        _writeUnsyncedLogsToSupabase();
      }, 50);
    }
  }
}
function saveArchives(){safeLSSave('logArchives', logArchives); scheduleFileSave();}
function getAllLogsForMonth(month){
  var logs = getOpLogs();
  // v104: Apply retention filter at display time (not load time)
  // This keeps data intact in window.operationLogs while only showing recent logs
  var retentionDays = (typeof _OP_LOGS_RETENTION_DAYS !== 'undefined') ? _OP_LOGS_RETENTION_DAYS : 3;
  var cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
  var cutoffTimestamp = cutoffDate.toISOString();
  
  var matched = logs.filter(function(l) { 
    return _getLogMonth(l) === month && l.timestamp && l.timestamp >= cutoffTimestamp;
  });
  // v25: Also include archived logs — archiveOldLogs() moves old logs to logArchives
  // but the history modal must still show them when the user selects that month
  if (logArchives && logArchives[month]) {
    var archivedFiltered = logArchives[month].filter(function(l) {
      return l.timestamp && l.timestamp >= cutoffTimestamp;
    });
    matched = matched.concat(archivedFiltered);
    matched.sort(function(a, b) { return (b.timestamp || '').localeCompare(a.timestamp || ''); });
  }
  return matched;
}
function getAvailableMonths(){
  const months=new Set();
  // v104: Only show months within retention period
  var retentionDays = (typeof _OP_LOGS_RETENTION_DAYS !== 'undefined') ? _OP_LOGS_RETENTION_DAYS : 3;
  var cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
  var cutoffTimestamp = cutoffDate.toISOString();
  
  var logs = getOpLogs();
  logs.forEach(l=>{
    if(l.timestamp && l.timestamp >= cutoffTimestamp){
      const m=_getLogMonth(l);if(m)months.add(m);
    }
  });
  Object.keys(logArchives).forEach(m=>{
    if(logArchives[m] && logArchives[m].some(function(l){ return l.timestamp && l.timestamp >= cutoffTimestamp; })){
      months.add(m);
    }
  });
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
/**
 * v124: 统一金币写入入口
 * 所有金币变化都应通过此函数，确保 coinDelta 与日志一致
 * @param {object} student - 学生对象
 * @param {number} delta - 金币变化量（正=增加，负=扣除）
 * @param {string} actionType - 操作类型（传给 recordAction）
 * @param {string} details - 操作详情
 * @param {number} expDelta - 经验变化量
 * @param {string|null} petId - 宠物ID
 * @param {object|null} extra - 额外数据
 * @returns {number} 修改后的金币数
 */
function changeStudentCoins(student, delta, actionType, details, expDelta, petId, extra) {
  var before = student.coins || 0;
  student.coins = before + delta;
  if (student.coins < 0) student.coins = 0;
  recordAction(student.id, student.name, actionType, details, delta, expDelta || 0, petId || null, extra || null);
  return student.coins;
}
function recordAction(studentId, studentName, actionType, details, coinDelta, expDelta, petId, extra = null){
  // v107: 所有操作（教师+学生）都记录到历史操作
  // v70: 允许特定类型的操作即使没有金币/经验变化也记录日志
  // 这些类型的操作本身就值得记录（如游戏进度、签到等）
  var alwaysLogTypes = ['快乐跑一跑', '小猪快跑', '宠物消消乐', '取金阁', '每日打卡', '全班打卡'];
  if(coinDelta === 0 && expDelta === 0 && !extra && alwaysLogTypes.indexOf(actionType) === -1) return;
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
          todayCoins: qs.todayCoins || 0,
          // v70: 加入快乐跑数据，支持完整恢复
          happyRunMaxLevel: qs.happyRunMaxLevel || 1,
          happyRunLevels: qs.happyRunLevels ? JSON.parse(JSON.stringify(qs.happyRunLevels)) : {},
          happyRunLevelBestCoins: qs.happyRunLevelBestCoins ? JSON.parse(JSON.stringify(qs.happyRunLevelBestCoins)) : {},
          happyRunTotalSilver: qs.happyRunTotalSilver || 0,
          happyRunSilverBalance: qs.happyRunSilverBalance || 0,
          happyRunPetGold: qs.happyRunPetGold || 0,
          happyRunOwnedChars: qs.happyRunOwnedChars ? JSON.parse(JSON.stringify(qs.happyRunOwnedChars)) : [0],
          happyRunBossKillBonus: qs.happyRunBossKillBonus ? JSON.parse(JSON.stringify(qs.happyRunBossKillBonus)) : {}
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
  if(!confirm(`确定将「${log.studentName}」的数据恢复到 ${log.timestamp} 的状态？\n这将覆盖当前的金币、成长值、小猪快跑和快乐跑数据。`)) return;
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
    // v70: 恢复快乐跑数据
    if(qsSnap.happyRunMaxLevel !== undefined) {
      student.quizState.happyRunMaxLevel = qsSnap.happyRunMaxLevel;
      student.quizState.happyRunLevels = JSON.parse(JSON.stringify(qsSnap.happyRunLevels || {}));
      student.quizState.happyRunLevelBestCoins = JSON.parse(JSON.stringify(qsSnap.happyRunLevelBestCoins || {}));
      student.quizState.happyRunTotalSilver = qsSnap.happyRunTotalSilver || 0;
      student.quizState.happyRunSilverBalance = qsSnap.happyRunSilverBalance || 0;
      student.quizState.happyRunPetGold = qsSnap.happyRunPetGold || 0;
      student.quizState.happyRunOwnedChars = JSON.parse(JSON.stringify(qsSnap.happyRunOwnedChars || [0]));
      student.quizState.happyRunBossKillBonus = JSON.parse(JSON.stringify(qsSnap.happyRunBossKillBonus || {}));
      student.quizState.happyRunTotalScore = qsSnap.happyRunTotalSilver || 0;
    }
  }
  // 3. Save to Supabase
  saveClassData();
  if(typeof _takeSnapshot === 'function') _takeSnapshot();
  scheduleAllRenders();
  if(currentModalStudentId && currentModalStudentId.toString()===log.studentId.toString()) refreshCurrentStudentModal();
  let detail = `已恢复「${log.studentName}」的数据到 ${new Date(log.timestamp).toLocaleString('zh-CN')}`;
  if(snap.quizStateSnapshot){
    const qsSnap = snap.quizStateSnapshot;
    const pigLevelCount = Object.keys(qsSnap.pigRunLevels||{}).length;
    if(pigLevelCount > 0) detail += `\n小猪快跑: ${pigLevelCount}关 / ${qsSnap.pigRunTotalScore}分`;
    // v70: 显示快乐跑恢复信息
    if(qsSnap.happyRunMaxLevel !== undefined && qsSnap.happyRunMaxLevel > 1) {
      const happyLevelCount = Object.keys(qsSnap.happyRunLevels||{}).length;
      detail += `\n快乐跑一跑: 最高第${qsSnap.happyRunMaxLevel}关 / ${qsSnap.happyRunTotalSilver}银币`;
    }
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
  // v119: 删除宠物撤销 — 恢复被删除的宠物
  if(log.actionType === '删除宠物' && log.extra && log.extra.deletedPetSnapshot){
    const student = curClass.students.find(s=>s.id.toString()===log.studentId.toString());
    if(!student){ showNotification('撤销失败','未找到该学生','error'); return; }
    const restoredPet = JSON.parse(JSON.stringify(log.extra.deletedPetSnapshot));
    // Check if pet already exists (shouldn't, but safety check)
    if(student.pets.some(p=>p.id.toString()===restoredPet.id.toString())){
      showNotification('撤销失败','该宠物已存在','warning'); return;
    }
    student.pets.push(restoredPet);
    // Restore activePetId if it was the active pet
    if(log.extra.wasActivePet){
      student.activePetId = restoredPet.id;
    }
    log.reverted = true;
    saveClassData('pet'); saveLogs();
    // Re-sync pet to Supabase
    if(typeof db !== 'undefined' && db){
      var petForSync = restoredPet;
      var petData = { id: petForSync.id, student_id: student.id, name: petForSync.name, nickname: petForSync.nickname, level: petForSync.level, growth: petForSync.growth||0, is_dead: petForSync.isDead||false, last_feed_date: petForSync.lastFeedDate, today_feed_count: petForSync.todayFeedCount||0, last_play_date: petForSync.lastPlayDate, today_play_count: petForSync.todayPlayCount||0, penalty_streak: petForSync.penaltyStreak||0 };
      if(typeof _markRowWritten === 'function') _markRowWritten('pets', petForSync.id);
      db.from('pets').upsert(petData).then(function(r){ if(r.error) console.warn('[DAL] restorePet Supabase error:', r.error); });
    }
    scheduleAllRenders();
    if(currentModalStudentId && currentModalStudentId.toString()===log.studentId.toString()) refreshCurrentStudentModal();
    showNotification('撤销成功', `已恢复 ${log.studentName} 的宠物「${restoredPet.nickname||restoredPet.name}」`, 'success');
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
function getPetImage(petName, level=1) { const cfg = PET_CONFIG[petName]; if (!cfg) return '<span>🐾</span>'; return `<img src="${_img(`${cfg.id}/${level}.webp`)}" alt="${petName}" loading="lazy" decoding="async" style="max-width:100%; max-height:100%; object-fit: contain;" onerror="this.onerror=null; this.parentNode.innerHTML='<span style=\'font-size:48px;\'>${cfg.emoji}</span>';">`; }
function getEggImage() { return `<img src="${_img('蛋.webp')}" alt="宠物蛋" class="egg-img" loading="lazy" decoding="async" style="max-width:100%; max-height:100%; object-fit: contain;" onerror="this.onerror=null; this.parentNode.innerHTML='<span style=\'font-size:60px;\'>🥚</span>';">`; }


function showModal(title,content,actions=[],large=false,extraClass=''){const c=document.getElementById('modalContainer'),m=document.createElement('div');m.className='modal-overlay';const modalClass=extraClass?extraClass:(large?'large':'');m.innerHTML=`<div class="modal ${modalClass}"><div class="modal-title">${esc(title)}</div><div class="modal-content">${content}</div><div class="modal-actions">${actions.map(a=>`<button class="btn ${a.class||'btn-primary'}" onclick="playClickSound(); ${a.onclick}">${esc(a.text)}</button>`).join('')}</div></div>`;c.appendChild(m);m.addEventListener('click',(e)=>{if(e.target===m)closeModal();});return m;}
function closeModal(){const c=document.getElementById('modalContainer');while(c.firstChild)c.removeChild(c.firstChild);currentModalStudentId=null; stopAllHeartEmitters(); cleanupPetModalEffects(); }
function saveClassData(changeType, detail){safeLSSave('classPetData', classesData); scheduleFileSave(); triggerRealtimeSync(); if(changeType && typeof _broadcastChange === 'function'){ _broadcastChange(changeType, detail); }}
function saveDeletedClasses(){safeLSSave('deletedClasses', deletedClasses); scheduleFileSave();}
function showDeletedClassesModal(){if(deletedClasses.length===0){showModal('🗑️ 已删除班级','<div style="text-align:center;padding:20px;">暂无已删除的班级</div>',[{text:'关闭',onclick:'closeModal()'}],false);return;}let html='<div style="max-height:400px;overflow:auto;">';[...deletedClasses].reverse().forEach((cls,i)=>{const time=new Date(cls.deletedAt).toLocaleString();const stuCount=cls.students?cls.students.length:0;const petCount=cls.students?cls.students.reduce((s,stu)=>s+(stu.pets?.length||0),0):0;html+=`<div class="history-log-item"><div><div class="history-log-time">${time} 删除</div><div><strong>${esc(cls.name)}</strong></div><div style="font-size:12px;">👨‍🎓 ${stuCount}名学生 · 🐕 ${petCount}只宠物</div></div><div style="display:flex;gap:6px;"><button class="btn btn-primary" style="padding:6px 12px;" onclick="restoreClass('${cls.id}');closeModal();">恢复</button><button class="btn btn-danger" style="padding:6px 12px;" onclick="permanentDeleteClass('${cls.id}');closeModal();">彻底删除</button></div></div>`;});html+='</div>';showModal('🗑️ 已删除班级',html,[{text:'关闭',onclick:'closeModal()'}],true);}
function restoreClass(id){var numId=parseInt(id);var idx=deletedClasses.findIndex(c=>c.id==numId||c.id==id);if(idx===-1){showNotification('恢复失败','未找到该班级数据','error');return;}const cls=deletedClasses[idx];const restored={id:_genLocalId(),name:cls.name,teacher_id:(typeof currentUser!=='undefined'&&currentUser)?currentUser.id:null,students:JSON.parse(JSON.stringify(cls.students)),createdAt:new Date().toISOString()};restored.students.forEach(function(stu){var oldStuId=stu.id;stu.id=_genLocalId();var petIdMap={};(stu.pets||[]).forEach(function(pet){var oldPetId=pet.id;pet.id=_genLocalId();petIdMap[oldPetId]=pet.id;});if(stu.activePetId&&petIdMap[stu.activePetId]){stu.activePetId=petIdMap[stu.activePetId];}else if(stu.activePetId){stu.activePetId=null;}});classesData.push(restored);deletedClasses.splice(idx,1);window._quizStateLocallyModified=true;setTimeout(function(){window._quizStateLocallyModified=false;},15000);saveClassData();saveDeletedClasses();currentClassId=restored.id;renderClassList();scheduleAllRenders();showNotification('恢复成功',`班级【${cls.name}】已恢复，含${restored.students.length}名学生`,'success');}
function permanentDeleteClass(id){if(!confirm('彻底删除后将无法恢复，确定？'))return;var numId=parseInt(id);var idx=deletedClasses.findIndex(c=>c.id==numId||c.id==id);if(idx!==-1){const name=deletedClasses[idx].name;deletedClasses.splice(idx,1);saveDeletedClasses();showNotification('已彻底删除',`班级【${name}】已永久删除`,'info');showDeletedClassesModal();if(typeof db!=='undefined'&&db&&typeof currentUser!=='undefined'&&currentUser){(async()=>{try{var targetId=null;if(typeof _isValidInt4Id==='function'&&_isValidInt4Id(numId)){targetId=numId;}else{var r=await db.from('classes').select('id').eq('teacher_id',currentUser.id).eq('name',name).limit(1);if(r.data&&r.data.length>0){targetId=r.data[0].id;}}if(targetId){const stuR=await db.from('students').select('id').eq('class_id',targetId);const studentIds=(stuR.data||[]).map(s=>s.id);if(studentIds.length>0){await db.from('pets').delete().in('student_id',studentIds);await db.from('students').delete().in('id',studentIds);}await db.from('custom_actions').delete().eq('class_id',targetId);await db.from('classes').delete().eq('id',targetId);console.log('[DAL] permanentDeleteClass: Supabase cleanup complete for class',targetId,'(requested id:',id,')');}else{console.warn('[DAL] permanentDeleteClass: class not found in Supabase by id or name:',id,name);}}catch(e){console.warn('[DAL] permanentDeleteClass: Supabase cleanup failed:',e);}})();}}}
// v127: 班级数据管理面板 — 独立的删除班级/重置宠物操作区
function showClassDataManagerModal(){
  if(typeof currentUser==='undefined'||!currentUser||currentUser.type!=='teacher'){
    showNotification('权限不足','仅教师可使用此功能','error'); return;
  }
  var hiddenIds = getHiddenClassIds();
  var visibleClasses = classesData.filter(function(cls){return !hiddenIds.includes(String(cls.id));});
  var html = '<div style="padding:8px 0;">';
  html += '<div style="background:linear-gradient(135deg,#fff3e0,#ffe0b2);border-radius:14px;padding:14px;margin-bottom:16px;border:1px solid #ffcc80;">';
  html += '<div style="font-size:14px;font-weight:700;color:#e65100;margin-bottom:6px;">⚠️ 操作说明</div>';
  html += '<div style="font-size:12px;color:#795548;line-height:1.6;">';
  html += '• <b>重置宠物</b>：彻底清除该班级所有宠物数据（宠物卡、特效、姓名），学生金币恢复为50<br>';
  html += '• <b>删除班级</b>：删除班级及所有学生、宠物数据，可在"已删除班级"中恢复<br>';
  html += '• 所有操作会先从云端数据库彻底删除，再更新本地，防止刷新后数据复活';
  html += '</div></div>';
  if(visibleClasses.length === 0){
    html += '<div style="text-align:center;padding:20px;color:#999;">暂无班级</div>';
  } else {
    visibleClasses.forEach(function(cls){
      var petCount = cls.students.reduce(function(s,stu){return s+(stu.pets?.length||0);},0);
      html += '<div style="background:#fff;border-radius:14px;padding:14px;margin-bottom:12px;box-shadow:0 2px 8px rgba(0,0,0,0.06);border:1px solid #f0f0f0;">';
      html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">';
      html += '<div style="font-size:16px;font-weight:700;color:#333;">🏫 ' + esc(cls.name) + '</div>';
      html += '<div style="font-size:12px;color:#888;">👨‍🎓 ' + cls.students.length + ' · 🐕 ' + petCount + '</div>';
      html += '</div>';
      html += '<div style="display:flex;gap:8px;">';
      html += '<button onclick="closeModal();currentClassId=\'' + cls.id + '\';clearPetData();" style="flex:1;padding:10px;border:none;border-radius:10px;background:linear-gradient(135deg,#ff9800,#f57c00);color:#fff;font-size:13px;font-weight:600;cursor:pointer;box-shadow:0 2px 8px rgba(255,152,0,0.3);transition:transform 0.2s;" onmouseenter="this.style.transform=\'scale(1.02)\'" onmouseleave="this.style.transform=\'scale(1)\'">🔄 重置宠物</button>';
      html += '<button onclick="closeModal();deleteClass(\'' + cls.id + '\');" style="flex:1;padding:10px;border:none;border-radius:10px;background:linear-gradient(135deg,#ef5350,#d32f2f);color:#fff;font-size:13px;font-weight:600;cursor:pointer;box-shadow:0 2px 8px rgba(239,83,80,0.3);transition:transform 0.2s;" onmouseenter="this.style.transform=\'scale(1.02)\'" onmouseleave="this.style.transform=\'scale(1)\'">🗑️ 删除班级</button>';
      html += '</div></div>';
    });
  }
  html += '</div>';
  showModal('⚙️ 班级数据管理', html, [{text:'关闭',onclick:'closeModal()'}], true);
}
function renderClassList(){ const c=document.getElementById('classListContainer'); if(!c){console.warn('[DAL] renderClassList: classListContainer not found');return;} const hiddenIds=getHiddenClassIds(); const visibleClasses=classesData.filter(cls=>!hiddenIds.includes(String(cls.id))); if(visibleClasses.length===0){c.innerHTML='<div style="text-align:center;padding:20px;">'+(classesData.length===0?'暂无班级，点击新建':'所有班级已隐藏<br><span style="font-size:12px;color:#999;">点击"隐藏班级"可显示</span>')+'</div>';return;} c.innerHTML=''; visibleClasses.forEach((cls,idx)=>{const card=document.createElement('div');card.className=`class-card ${currentClassId===cls.id?'active':''}`;card.draggable=true;card.dataset.classIdx=idx;card.innerHTML=`<button class="delete-class-btn" onclick="event.stopPropagation(); deleteClass('${cls.id}')">×</button><div class="class-name">${esc(cls.name)}</div><div style="display:flex;gap:15px;"><div>👨‍🎓 ${cls.students.length}</div><div>🐕 ${cls.students.reduce((s,stu)=>s+(stu.pets?.length||0),0)}</div></div>`;card.onclick=()=>{selectClass(cls.id);};card.addEventListener('dragstart',classDragStart);card.addEventListener('dragend',classDragEnd);card.addEventListener('dragover',classDragOver);card.addEventListener('dragleave',classDragLeave);card.addEventListener('drop',classDrop);c.appendChild(card);}); _updateSnackRequestBadge();}
function _updateSnackRequestBadge(){const badge=document.getElementById('snackRequestBadge');if(!badge)return;const count=getPendingSnackRequestCount();if(count>0){badge.style.display='inline-block';badge.textContent=count;}else{badge.style.display='none';}}
let classDragIdx=null;
function classDragStart(e){classDragIdx=+this.dataset.classIdx;this.classList.add('dragging');e.dataTransfer.effectAllowed='move';}
function classDragEnd(e){this.classList.remove('dragging');classDragIdx=null;document.querySelectorAll('.class-card.drag-over').forEach(el=>el.classList.remove('drag-over'));}
function classDragOver(e){e.preventDefault();e.dataTransfer.dropEffect='move';if(+this.dataset.classIdx!==classDragIdx)this.classList.add('drag-over');}
function classDragLeave(e){this.classList.remove('drag-over');}
function classDrop(e){e.preventDefault();this.classList.remove('drag-over');const toIdx=+this.dataset.classIdx;if(classDragIdx===null||classDragIdx===toIdx)return;const moved=classesData.splice(classDragIdx,1)[0];classesData.splice(toIdx,0,moved);saveClassData();renderClassList();}
function selectClass(id){currentClassId=id;renderClassList();scheduleAllRenders();showNotification('班级切换','已切换','info');if(typeof showRankAnnouncement==='function'){setTimeout(function(){showRankAnnouncement(id);},800);}if(typeof _updateSnackStatusBadge==='function'){setTimeout(_updateSnackStatusBadge,100);}}
// === v81: 隐藏/显示班级功能（教师专用）===
function getHiddenClassIds(){
  try { return JSON.parse(localStorage.getItem('hiddenClassIds')) || []; } catch(e) { return []; }
}
function saveHiddenClassIds(ids){
  try { localStorage.setItem('hiddenClassIds', JSON.stringify(ids)); } catch(e) {}
}
function showHideClassModal(){
  if(!currentUser || currentUser.type !== 'teacher'){ showNotification('无权限','仅教师可操作','warning'); return; }
  if(!classesData || classesData.length === 0){ showNotification('暂无班级','请先创建班级','info'); return; }
  const hiddenIds = getHiddenClassIds();
  let html = '<div style="max-height:400px;overflow-y:auto;padding:10px 0;">';
  classesData.forEach(cls => {
    const isHidden = hiddenIds.includes(String(cls.id));
    const statusText = isHidden ? '<span style="color:#999;font-size:12px;margin-left:8px;">(已隐藏)</span>' : '<span style="color:#4a9e4a;font-size:12px;margin-left:8px;">(可见)</span>';
    html += `<label style="display:flex;align-items:center;gap:12px;padding:12px 16px;margin:6px 0;background:${isHidden?'#f5f5f5':'#fff'};border-radius:10px;cursor:pointer;transition:background 0.2s;border:1px solid ${isHidden?'#ddd':'#e8e8e8'};">
      <input type="checkbox" class="hide-class-checkbox" data-class-id="${cls.id}" ${isHidden?'checked':''} style="width:20px;height:20px;cursor:pointer;">
      <span style="flex:1;font-size:15px;font-weight:500;">${esc(cls.name)}</span>
      ${statusText}
    </label>`;
  });
  html += '</div>';
  html += '<div style="display:flex;gap:10px;margin-top:16px;justify-content:center;">';
  html += '<button class="btn btn-secondary" onclick="hideSelectedClasses()" style="background:linear-gradient(135deg,#95a5a6,#7f8c8d);">👁️ 隐藏选中</button>';
  html += '<button class="btn btn-success" onclick="showSelectedClasses()">✅ 显示选中</button>';
  html += '<button class="btn btn-secondary" onclick="closeModal()">取消</button>';
  html += '</div>';
  showModal('👁️ 隐藏/显示班级', html, [], false);
}
function hideSelectedClasses(){
  const checkboxes = document.querySelectorAll('.hide-class-checkbox:checked');
  if(checkboxes.length === 0){ showNotification('未选择','请先选择要隐藏的班级','info'); return; }
  const hiddenIds = getHiddenClassIds();
  let hideCount = 0;
  checkboxes.forEach(cb => {
    const classId = String(cb.dataset.classId);
    if(!hiddenIds.includes(classId)){
      hiddenIds.push(classId);
      hideCount++;
    }
  });
  saveHiddenClassIds(hiddenIds);
  if(hiddenIds.includes(String(currentClassId))){
    const visibleClass = classesData.find(c => !hiddenIds.includes(String(c.id)));
    if(visibleClass) currentClassId = visibleClass.id;
    else currentClassId = null;
  }
  renderClassList();
  scheduleAllRenders();
  closeModal();
  showNotification('隐藏成功', `已隐藏 ${hideCount} 个班级`, 'success');
}
function showSelectedClasses(){
  const checkboxes = document.querySelectorAll('.hide-class-checkbox:checked');
  if(checkboxes.length === 0){ showNotification('未选择','请先选择要显示的班级','info'); return; }
  const hiddenIds = getHiddenClassIds();
  let showCount = 0;
  checkboxes.forEach(cb => {
    const classId = String(cb.dataset.classId);
    const idx = hiddenIds.indexOf(classId);
    if(idx !== -1){
      hiddenIds.splice(idx, 1);
      showCount++;
    }
  });
  saveHiddenClassIds(hiddenIds);
  renderClassList();
  scheduleAllRenders();
  closeModal();
  showNotification('显示成功', `已显示 ${showCount} 个班级`, 'success');
}
function createClass(){const n=prompt('班级名称（最多20字）');if(!n)return;
  // v-mid2: 输入验证
  var v=_validateInput(n,20,'班级名称');if(!v.ok){showNotification('输入无效',v.error,'warning');return;}
  // 检查数据库是否已存在同名班级（跨所有教师）
  if(typeof db!=='undefined'&&db){
    db.from('classes').select('id,name,teacher_id').eq('name',v.value).limit(1).then(function(r){
      if(r.error){console.error('[创建班级] 查询失败:',r.error.message);showNotification('创建失败','数据库查询错误，请重试','error');return;}
      if(r.data&&r.data.length>0){
        // 找到同名班级，检查是否是当前教师自己的
        const existingClass=r.data[0];
        if(existingClass.teacher_id===currentUser.id){
          showNotification('创建失败','你已经有同名班级「'+v.value+'」，请使用不同的名称','error');
        }else{
          showNotification('创建失败','系统中已存在班级「'+v.value+'」，为避免数据混乱，请使用不同的班级名称','error');
        }
        return;
      }
      // 没有同名班级，可以创建
      classesData.push({id:Date.now().toString(),name:v.value,students:[]});
      saveClassData();renderClassList();selectClass(classesData[classesData.length-1].id);
    });
  }else{
    // 离线模式：只检查本地
    if(classesData.some(c=>c.name===v.value)){showNotification('创建失败','本地已有同名班级','error');return;}
    classesData.push({id:Date.now().toString(),name:v.value,students:[]});
    saveClassData();renderClassList();selectClass(classesData[classesData.length-1].id);
  }
}
function deleteClass(id){if(_isOnCooldown('deleteClass')){showNotification('操作太快','请等待'+_cooldownRemaining('deleteClass')+'秒后再试','warning');return;}if(!confirm('确定删除该班级？删除后可在"已删除班级"中恢复'))return;_startCooldown('deleteClass',5);var cls=classesData.find(function(c){return c.id===id||c.id==id;});var _className=cls?cls.name:'';if(cls){var snapshot={id:cls.id,name:cls.name,students:JSON.parse(JSON.stringify(cls.students)),deletedAt:new Date().toISOString()};deletedClasses.push(snapshot);if(deletedClasses.length>20)deletedClasses.shift();saveDeletedClasses();}classesData=classesData.filter(function(c){return c.id!==id&&c.id!=id;});if(currentClassId===id||currentClassId==id)currentClassId=classesData[0]?.id||null;if(typeof customActions!=='undefined'){customActions=customActions.filter(function(a){return a.class_id!=id;});}renderClassList();scheduleAllRenders();showNotification('班级已删除','可在"已删除班级"中恢复','info');_pauseSync=true;var _waitAndDel=function(){if(typeof _dalSyncing!=='undefined'&&_dalSyncing){setTimeout(_waitAndDel,300);return;}safeLSSave('classPetData',classesData);scheduleFileSave();if(typeof _supabaseDeleteClass==='function'){_supabaseDeleteClass(id,_className).then(function(){_pauseSync=false;saveClassData();}).catch(function(e){console.warn('[DAL] deleteClass Supabase error:',e);_pauseSync=false;saveClassData();});return;}_pauseSync=false;saveClassData();};_waitAndDel();}
// v127: 从 Supabase 彻底删除班级及其所有关联数据
function _supabaseDeleteClass(classId, className){
  if(typeof db === 'undefined' || !db || typeof currentUser === 'undefined' || !currentUser){
    console.log('[v127] _supabaseDeleteClass: no Supabase connection, skipping');
    return Promise.resolve();
  }
  return (async function(){
    var targetId = null;
    // 尝试获取 Supabase 中的班级 ID
    if(typeof _isValidInt4Id === 'function' && _isValidInt4Id(classId)){
      targetId = classId;
    } else if(className){
      var r = await db.from('classes').select('id').eq('teacher_id', currentUser.id).eq('name', className).limit(1);
      if(r.data && r.data.length > 0) targetId = r.data[0].id;
      else console.log('[v127] _supabaseDeleteClass: class not found by name:', className);
    }
    if(!targetId){
      console.log('[v127] _supabaseDeleteClass: no targetId, skipping Supabase delete');
      return;
    }
    console.log('[v127] _supabaseDeleteClass: deleting class', targetId);
    // 获取学生 ID 列表
    var stuR = await db.from('students').select('id').eq('class_id', targetId);
    var studentIds = (stuR.data || []).map(function(s){ return s.id; });
    console.log('[v127] _supabaseDeleteClass: found', studentIds.length, 'students');
    // 按顺序删除：operation_logs → pets → students → custom_actions → classes
    if(studentIds.length > 0){
      // 先删除操作日志（避免外键约束冲突）
      var logDel = await db.from('operation_logs').delete().in('student_id', studentIds);
      if(logDel.error) console.warn('[v127] operation_logs delete error:', logDel.error);
      else console.log('[v127] deleted operation_logs for', studentIds.length, 'students');
      
      var petDel = await db.from('pets').delete().in('student_id', studentIds);
      if(petDel.error) console.warn('[v127] pets delete error:', petDel.error);
      else console.log('[v127] deleted', studentIds.length, 'students\' pets');
      
      var stuDel = await db.from('students').delete().in('id', studentIds);
      if(stuDel.error) console.warn('[v127] students delete error:', stuDel.error);
      else console.log('[v127] deleted', studentIds.length, 'students');
    }
    var caDel = await db.from('custom_actions').delete().eq('class_id', targetId);
    if(caDel.error) console.warn('[v127] custom_actions delete error:', caDel.error);
    else console.log('[v127] deleted custom_actions');
    
    var clsDel = await db.from('classes').delete().eq('id', targetId);
    if(clsDel.error) console.warn('[v127] classes delete error:', clsDel.error);
    else console.log('[v127] deleted class');
    
    console.log('[v127] _supabaseDeleteClass: done for class', targetId);
  })();
}
function importFromTxt(){document.getElementById('txtImport').click();}
document.getElementById('txtImport').addEventListener('change',function(e){if(!currentClassId){showNotification('请先选择班级','','error');return;}const file=e.target.files[0];if(!file)return;const reader=new FileReader();reader.onload=function(ev){const text=ev.target.result;const rawNames=text.split(/\r?\n/).filter(n=>n.trim());const cur=classesData.find(c=>c.id===currentClassId);var added=0,skipped=0;rawNames.forEach(function(raw){var name=_validateStudentName(raw);if(!name){skipped++;return;}if(cur.students.find(function(s){return s.name===name;})){skipped++;return;}cur.students.push({id:_genLocalId(),name:name,coins:50,pets:[],lastCheckinDate:null,activePetId:null,pkCountToday:0,lastPkDate:null});added++;});saveClassData();scheduleAllRenders();var msg='添加'+added+'人';if(skipped>0)msg+='，跳过'+skipped+'人（重复或超长）';showNotification('导入完成',msg,'success');};reader.readAsText(file);this.value='';});
function classDailyCheckin(){ if(typeof currentUser!=='undefined'&&currentUser&&currentUser.type==='student'){showNotification('权限不足','此操作仅限教师','error');return;} if(!currentClassId){showNotification('请先选择班级','请在左侧选择一个班级后再打卡','warning');return;} if(checkPauseAndNotify())return; const cur=classesData.find(c=>c.id===currentClassId); if(!cur){showNotification('班级数据异常','未找到当前班级数据','error');return;} if(!cur.students||cur.students.length===0){showNotification('暂无学生','请先添加学生','warning');return;} let checkedCount=0; let skipNoPet=0; cur.students.forEach(s=>{if(!s.pets||s.pets.length===0){skipNoPet++;return;} if(_hasCheckedInToday(s)){return;} s.lastCheckinDate=new Date().toISOString();changeStudentCoins(s, 10, '全班打卡', '+10金币', 0, null);checkedCount++;}); if(checkedCount===0){let reason='全班同学今天都已经打过卡了'; if(skipNoPet>0) reason+=`（${skipNoPet}人未领养宠物，不参与打卡）`; showNotification('今日已打卡',reason,'info');return;} saveClassData('coins'); renderHomePetGrid(); if(currentModalStudentId) refreshCurrentStudentModal(); let msg=`${checkedCount}人打卡成功，每人+10金币`; if(skipNoPet>0) msg+=`（${skipNoPet}人未领养宠物，已跳过）`; showNotification('全班打卡',msg,'success'); }
function classAllFeed(){ if(typeof currentUser!=='undefined'&&currentUser&&currentUser.type==='student'){showNotification('权限不足','此操作仅限教师','error');return;} if(!currentClassId){showNotification('请先选择班级','请在左侧选择一个班级后再喂食','warning');return;} if(checkPauseAndNotify())return; const cur=classesData.find(c=>c.id===currentClassId); if(!cur){showNotification('班级数据异常','未找到当前班级数据','error');return;} if(!cur.students||cur.students.length===0){showNotification('暂无学生','请先添加学生','warning');return;} let fedCount=0,skipDead=0,skipCoins=0,skipMax=0,skipNoPet=0,skipFed=0; const upgrades=[]; cur.students.forEach(s=>{const pet=getGrowablePet(s); if(!pet && (!s.pets||s.pets.length===0)){skipNoPet++;return;} if(!pet && s.pets.every(p=>p.level>=9)){skipMax++;return;} if(!pet && s.pets.every(p=>p.isDead)){skipDead++;return;} if(!pet){skipMax++;return;} if(_hasFedToday(pet)){skipFed++;return;} if(s.coins<5){skipCoins++;return;} let gain=2; pet.growth+=gain; pet.lastFeedDate=new Date().toISOString(); const upResult=updatePetLevel(s, pet.id, gain, true); if(upResult) upgrades.push(upResult); changeStudentCoins(s, -5, '全班喂食', `${pet.nickname||pet.name} +${gain}成长值`, gain, pet.id); fedCount++;}); if(fedCount===0){let reason=''; if(skipFed>0)reason+=`${skipFed}人今天已喂食 `; if(skipDead>0)reason+=`${skipDead}人宠物已死亡 `; if(skipCoins>0)reason+=`${skipCoins}人金币不足 `; if(skipMax>0)reason+=`${skipMax}人全部满级 `; if(skipNoPet>0)reason+=`${skipNoPet}人未领养宠物`; showNotification('无法喂食',reason||'没有可喂食的宠物','info');return;} saveClassData('pet'); scheduleAllRenders(); if(currentModalStudentId) refreshCurrentStudentModal(); let msg=`${fedCount}只宠物喂食成功，每只+2成长值，-5金币`; if(skipFed+skipDead+skipCoins+skipMax+skipNoPet>0){let skips=[]; if(skipFed>0)skips.push(`${skipFed}人今天已喂食`); if(skipDead>0)skips.push(`${skipDead}人宠物已死亡`); if(skipCoins>0)skips.push(`${skipCoins}人金币不足`); if(skipMax>0)skips.push(`${skipMax}人全部满级`); if(skipNoPet>0)skips.push(`${skipNoPet}人未领养宠物`); msg+=`（跳过：${skips.join('、')}）`;} showNotification('全班喂食',msg,'success'); showBatchUpgradeNotice(upgrades); }
function showBatchUpgradeNotice(upgrades){ if(!upgrades||upgrades.length===0) return; const INTERVAL=4500; const MAX_INDIVIDUAL=3; function showOne(idx){ if(idx>=upgrades.length) return; const u=upgrades[idx]; showUpgradeEffect(u.petRealName, u.newLevel, u.cfgId, u.petName, u.oldLevel, u.studentName); setTimeout(()=>{ showNotification('🎉 宠物升级',`恭喜 ${u.studentName} 同学的 ${u.petName} 进化为${u.stageName}！`,'success'); },300); if(idx+1<upgrades.length){ setTimeout(()=>{ const container=document.getElementById('upgradeEffectContainer'); if(container){const overlays=container.querySelectorAll('.upgrade-overlay'); overlays.forEach(o=>o.remove());} showOne(idx+1); }, INTERVAL); } } if(upgrades.length<=MAX_INDIVIDUAL){ if(upgrades.length>1){ showNotification('🎉 升级预告',`本次共有 ${upgrades.length} 位同学的宠物升级，逐一展示！`,'success'); setTimeout(()=>showOne(0), 800); } else { showOne(0); } } else { showBatchUpgradeBoard(upgrades); } } function showBatchUpgradeBoard(upgrades){ const container=document.getElementById('upgradeEffectContainer'); const overlay=document.createElement('div'); overlay.className='upgrade-overlay'; overlay.style.cssText='position:fixed;top:0;left:0;right:0;bottom:0;z-index:100000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.7);backdrop-filter:blur(4px);animation:fadeIn 0.5s ease;'; const listHtml=upgrades.map((u,i)=>{ const cfg=PET_CONFIG[Object.keys(PET_CONFIG).find(k=>PET_CONFIG[k].id===u.cfgId)]; const emoji=cfg?cfg.emoji:'🐾'; const imgSrc=_img(`${u.cfgId}/${u.newLevel}.webp`); return `<div style="display:flex;align-items:center;gap:12px;padding:10px 18px;background:rgba(255,255,255,0.08);border-radius:14px;border:1px solid rgba(255,255,255,0.15);animation:fadeIn 0.5s ease ${i*0.08}s both;"><div style="width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg,#ffe0b2,#ffcc80);display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden;"><img src="${imgSrc}" style="width:40px;height:40px;object-fit:contain;" onerror="this.onerror=null;this.parentNode.innerHTML='<span style=\\'font-size:28px;\\'>${emoji}</span>';"></div><div style="flex:1;min-width:0;"><div style="font-size:16px;font-weight:700;color:#fff;">${esc(u.studentName)}</div><div style="font-size:13px;color:rgba(255,255,255,0.7);margin-top:2px;">${esc(u.petName)} → ${esc(u.stageName)}</div></div><div style="font-size:22px;">🎉</div></div>`; }).join(''); overlay.innerHTML=` <div style="background:linear-gradient(160deg,#1a1a2e 0%,#16213e 50%,#0f3460 100%);border-radius:28px;padding:35px 30px;max-width:520px;width:90%;max-height:80vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,0.5),inset 0 1px 0 rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.1);position:relative;overflow:hidden;"> <div style="position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,#e8637a,#f5a054,#ffd700,#e8637a);background-size:200% 100%;animation:shimmer 2s linear infinite;"></div> <div style="text-align:center;margin-bottom:20px;"> <div style="font-size:36px;margin-bottom:6px;">🏆✨🎊</div> <div style="font-size:24px;font-weight:800;color:#ffd700;text-shadow:0 0 20px rgba(255,215,0,0.4);">集体进化大成功！</div> <div style="font-size:15px;color:rgba(255,255,255,0.7);margin-top:6px;">恭喜以下 <strong style="color:#ff9800;font-size:18px;">${upgrades.length}</strong> 位同学的宠物升级</div> </div> <div style="flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:8px;padding-right:5px;min-height:0;"> ${listHtml} </div> <div style="text-align:center;margin-top:18px;padding-top:15px;border-top:1px solid rgba(255,255,255,0.1);"> <button onclick="this.closest('.upgrade-overlay').remove();" style="padding:10px 36px;border:none;border-radius:20px;background:linear-gradient(135deg,#e8637a,#f5a054);color:#fff;font-size:15px;font-weight:600;cursor:pointer;box-shadow:0 4px 15px rgba(232,99,122,0.4);transition:transform 0.2s;">太棒了！为他们鼓掌 👏</button> </div> </div>`; container.appendChild(overlay); overlay.addEventListener('click',(e)=>{if(e.target===overlay)overlay.remove();}); setTimeout(()=>{if(overlay.parentNode)overlay.remove();},15000); playUpgradeSound(); }
// v128: 重置班级宠物 — 先同步清除本地数据（让同步管道读到空数据），再异步清理 Supabase
function clearPetData(){
  if(!currentClassId){
    showNotification('请先选择班级', '', 'warning');
    return;
  }
  if(!confirm('确定重置当前班级所有宠物数据？\n所有宠物、宠物特效、宠物姓名都将被彻底清除，学生金币恢复为50。\n\n此操作不可撤销！')) return;
  var cur = classesData.find(function(c){return c.id===currentClassId||c.id==currentClassId;});
  if(!cur){
    showNotification('班级不存在', '', 'error');
    return;
  }
  var snapshot = JSON.parse(JSON.stringify(cur.students));
  var className = cur.name;
  showNotification('正在重置...', '等待数据同步完成', 'info');
  // v129: 正确顺序 — 必须等同步跑完再操作，否则同步会把旧数据重新上传回去
  // 步骤1: 暂停新同步 + 等待正在进行的同步完成
  _pauseSync = true;
  var _waitAndClear = function(){
    if(typeof _dalSyncing !== 'undefined' && _dalSyncing){
      setTimeout(_waitAndClear, 300);
      return;
    }
    // 步骤2: 同步已完成，清除本地数据
    cur.students.forEach(function(s){
      s.pets = [];
      s.coins = 50;
      s.lastCheckinDate = null;
      s.activePetId = null;
      s.pkCountToday = 0;
      s.lastPkDate = null;
    });
    // 步骤3: 保存干净数据（_pauseSync=true 期间不会触发同步）
    safeLSSave('classPetData', classesData);
    scheduleFileSave();
    recordResetAction(cur.id, cur.name, snapshot);
    scheduleAllRenders();
    if(currentModalStudentId) closeModal();
    // 步骤4: 删除 Supabase 旧宠物行（此时没有同步在跑，不会把旧数据传回去）
    if(typeof db !== 'undefined' && db && typeof currentUser !== 'undefined' && currentUser){
      _supabaseClearPets(cur).then(function(){
        // 步骤5: 恢复同步，触发上传干净状态
        _pauseSync = false;
        saveClassData();
        showNotification('重置完成', '班级【' + className + '】宠物数据已彻底清空', 'success');
      }).catch(function(err){
        _pauseSync = false;
        saveClassData();
        console.warn('[v129] _supabaseClearPets error:', err);
        showNotification('重置完成', '本地已清空，云端清理失败请重试', 'warning');
      });
    } else {
      _pauseSync = false;
      saveClassData();
      showNotification('重置完成', '班级【' + className + '】宠物数据已清空', 'success');
    }
  };
  _waitAndClear();
}
// v127: 从 Supabase 彻底删除班级所有宠物数据
function _supabaseClearPets(cls){
  if(typeof db === 'undefined' || !db){
    console.warn('[v127] _supabaseClearPets: db not available');
    return Promise.resolve();
  }
  if(typeof currentUser === 'undefined' || !currentUser){
    console.warn('[v127] _supabaseClearPets: currentUser not available');
    return Promise.resolve();
  }
  return (async function(){
    var classId = cls.id;
    console.log('[v127] _supabaseClearPets: classId=', classId, 'className=', cls.name);
    // 获取 Supabase 中的班级 ID
    var targetId = null;
    if(typeof _isValidInt4Id === 'function' && _isValidInt4Id(classId)){
      targetId = classId;
      console.log('[v127] _supabaseClearPets: using direct classId', targetId);
    } else {
      console.log('[v127] _supabaseClearPets: classId is not valid INT4, searching by name...');
      var r = await db.from('classes').select('id').eq('teacher_id', currentUser.id).eq('name', cls.name).limit(1);
      if(r.error){
        console.error('[v127] _supabaseClearPets: classes query error:', r.error);
        throw new Error('查询班级失败: ' + r.error.message);
      }
      if(r.data && r.data.length > 0){
        targetId = r.data[0].id;
        console.log('[v127] _supabaseClearPets: found class in Supabase with id', targetId);
      } else {
        console.warn('[v127] _supabaseClearPets: class not found in Supabase by name:', cls.name);
        throw new Error('班级在云端未找到，可能尚未同步');
      }
    }
    if(!targetId){
      console.warn('[v127] _supabaseClearPets: no targetId resolved');
      throw new Error('无法确定班级 ID');
    }
    console.log('[v127] _supabaseClearPets: clearing pets for class', targetId);
    // 获取该班级所有学生 ID
    var stuR = await db.from('students').select('id').eq('class_id', targetId);
    if(stuR.error){
      console.error('[v127] _supabaseClearPets: students query error:', stuR.error);
      throw new Error('查询学生失败: ' + stuR.error.message);
    }
    var studentIds = (stuR.data || []).map(function(s){ return s.id; });
    console.log('[v127] _supabaseClearPets: found', studentIds.length, 'students');
    if(studentIds.length > 0){
      // 删除所有宠物
      var petDel = await db.from('pets').delete().in('student_id', studentIds);
      if(petDel.error){
        console.error('[v127] _supabaseClearPets: pets delete error:', petDel.error);
        throw new Error('删除宠物失败: ' + petDel.error.message);
      }
      console.log('[v127] _supabaseClearPets: deleted', studentIds.length, 'students\' pets');
      // 重置学生金币为 50
      var stuUpdate = await db.from('students').update({ coins: 50 }).eq('class_id', targetId);
      if(stuUpdate.error){
        console.error('[v127] _supabaseClearPets: students update error:', stuUpdate.error);
        throw new Error('重置金币失败: ' + stuUpdate.error.message);
      }
      console.log('[v127] _supabaseClearPets: reset students coins to 50');
    }
    // 清除该班级的 custom_actions
    var caDel = await db.from('custom_actions').delete().eq('class_id', targetId);
    if(caDel.error){
      console.error('[v127] _supabaseClearPets: custom_actions delete error:', caDel.error);
      throw new Error('删除操作记录失败: ' + caDel.error.message);
    }
    console.log('[v127] _supabaseClearPets: deleted custom_actions');
    console.log('[v127] _supabaseClearPets: done for class', targetId);
  })();
}

// === v119: 删除宠物功能（教师专用）===
var _deletePetSelectedStudentId = null;
function showDeletePetModal(){
  if(!currentUser || currentUser.type !== 'teacher'){ showNotification('无权限','仅教师可操作','warning'); return; }
  if(!currentClassId){ showNotification('请先选择班级','','info'); return; }
  const curClass = classesData.find(c=>c.id===currentClassId);
  if(!curClass){ showNotification('班级不存在','','error'); return; }
  // Filter students who have pets
  const studentsWithPets = curClass.students.filter(s => s.pets && s.pets.length > 0);
  if(studentsWithPets.length === 0){ showNotification('暂无宠物','当前班级没有学生拥有宠物','info'); return; }
  _deletePetSelectedStudentId = null;
  _renderDeletePetStudentList(studentsWithPets, curClass.name);
}
function _renderDeletePetStudentList(studentsWithPets, className){
  let html = '<div style="margin-bottom:12px;text-align:center;color:#888;font-size:13px;">第一步：选择学生</div>';
  html += '<div style="max-height:350px;overflow-y:auto;padding:5px 0;">';
  studentsWithPets.forEach(s => {
    const aliveCount = s.pets.filter(p => !p.isDead).length;
    const deadCount = s.pets.filter(p => p.isDead).length;
    let petSummary = s.pets.map(p => {
      const cfg = PET_CONFIG[p.name];
      const emoji = cfg ? cfg.emoji : '🐾';
      return `${emoji}${p.nickname||p.name}(Lv${p.level}${p.isDead?' 💀':''})`;
    }).join('、');
    html += `<div onclick="_deletePetSelectStudent('${s.id}')" style="display:flex;align-items:center;gap:10px;padding:12px 14px;margin:6px 0;background:#fff;border-radius:12px;cursor:pointer;transition:all 0.2s;border:2px solid #f0f0f0;" onmouseenter="this.style.borderColor='#e8637a';this.style.background='#fff8f8'" onmouseleave="this.style.borderColor='#f0f0f0';this.style.background='#fff'">
      <div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#b5d8ff,#8ec5fc);display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;color:#fff;flex-shrink:0;">${esc(s.name.charAt(0))}</div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:15px;font-weight:600;color:#333;">${esc(s.name)}</div>
        <div style="font-size:12px;color:#999;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${petSummary}</div>
      </div>
      <div style="font-size:12px;color:#aaa;flex-shrink:0;">${s.pets.length}只宠物</div>
    </div>`;
  });
  html += '</div>';
  showModal('🐾 删除宠物 — ' + esc(className), html, [{text:'取消',onclick:'closeModal()'}], false);
}
function _deletePetSelectStudent(studentId){
  _deletePetSelectedStudentId = studentId;
  const curClass = classesData.find(c=>c.id===currentClassId);
  if(!curClass) return;
  const student = curClass.students.find(s=>s.id.toString()===studentId.toString());
  if(!student || !student.pets || student.pets.length===0) return;
  _renderDeletePetPetList(student, curClass.name);
}
function _renderDeletePetPetList(student, className){
  let html = '<div style="margin-bottom:8px;text-align:center;">';
  html += `<div style="font-size:14px;color:#666;">学生：<strong>${esc(student.name)}</strong></div>`;
  html += '<div style="margin-top:8px;font-size:13px;color:#888;">第二步：选择要删除的宠物</div>';
  html += '</div>';
  html += '<div style="max-height:300px;overflow-y:auto;padding:5px 0;">';
  student.pets.forEach(p => {
    const cfg = PET_CONFIG[p.name];
    const emoji = cfg ? cfg.emoji : '🐾';
    const stageName = cfg ? (cfg.stages.find(s=>s.stage===p.level)?.stageName || '阶段'+p.level) : 'Lv'+p.level;
    const isActive = student.activePetId && Number(student.activePetId) === Number(p.id);
    const statusBadge = p.isDead ? '<span style="background:#ffcccc;color:#c00;padding:1px 6px;border-radius:8px;font-size:11px;margin-left:4px;">已死亡</span>' : '';
    const activeBadge = isActive ? '<span style="background:#d4edda;color:#155724;padding:1px 6px;border-radius:8px;font-size:11px;margin-left:4px;">活跃中</span>' : '';
    html += `<div onclick="confirmDeletePet('${student.id}','${p.id}')" style="display:flex;align-items:center;gap:12px;padding:12px 14px;margin:6px 0;background:#fff;border-radius:12px;cursor:pointer;transition:all 0.2s;border:2px solid #f0f0f0;" onmouseenter="this.style.borderColor='#e8637a';this.style.background='#fff5f5'" onmouseleave="this.style.borderColor='#f0f0f0';this.style.background='#fff'">
      <div style="width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,#ffe0b2,#ffcc80);display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;overflow:hidden;">${getPetImage(p.name, p.level)}</div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:15px;font-weight:600;color:#333;">${esc(p.nickname||p.name)}${statusBadge}${activeBadge}</div>
        <div style="font-size:12px;color:#999;margin-top:2px;">${esc(p.name)} · ${stageName} · 成长值 ${p.growth||0}</div>
      </div>
      <div style="font-size:18px;color:#e8637a;flex-shrink:0;">🗑️</div>
    </div>`;
  });
  html += '</div>';
  html += '<div style="text-align:center;margin-top:10px;"><button class="btn btn-secondary" onclick="_deletePetSelectStudent(\''+student.id+'\')" style="font-size:13px;">← 返回选择学生</button></div>';
  showModal('🐾 删除宠物 — ' + esc(className), html, [{text:'取消',onclick:'closeModal()'}], false);
}
function confirmDeletePet(studentId, petId){
  const curClass = classesData.find(c=>c.id===currentClassId);
  if(!curClass) return;
  const student = curClass.students.find(s=>s.id.toString()===studentId.toString());
  if(!student) return;
  const pet = student.pets.find(p=>p.id.toString()===petId.toString());
  if(!pet) return;
  const petDisplayName = pet.nickname ? `${pet.nickname}(${pet.name})` : pet.name;
  if(!confirm(`确定删除 ${student.name} 的宠物「${petDisplayName}」吗？\n\n此操作可通过历史操作撤销。`)) return;
  // Record the action before deletion (for undo)
  const petSnapshot = JSON.parse(JSON.stringify(pet));
  const wasActive = student.activePetId && Number(student.activePetId) === Number(pet.id);
  const log = {
    id: _genLocalId(),
    timestamp: new Date().toISOString(),
    classId: currentClassId,
    studentId: student.id,
    studentName: student.name,
    actionType: '删除宠物',
    details: `删除 ${student.name} 的宠物「${petDisplayName}」(Lv${pet.level}, 成长值${pet.growth||0})`,
    coinDelta: 0,
    expDelta: 0,
    petId: pet.id,
    extra: {
      deletedPetSnapshot: petSnapshot,
      wasActivePet: wasActive,
      prevActivePetId: student.activePetId
    },
    snapshot: {
      coinsBefore: student.coins,
      coinsAfter: student.coins
    },
    reverted: false,
    _synced: false
  };
  // Remove the pet from student's pets array
  student.pets = student.pets.filter(p => p.id.toString() !== petId.toString());
  // Update activePetId if needed
  if(wasActive){
    if(student.pets.length > 0){
      student.activePetId = student.pets[0].id;
    } else {
      student.activePetId = null;
    }
  }
  // Save data
  saveClassData('pet');
  // Record to history
  window.operationLogs.push(log);
  saveLogs();
  // Delete from Supabase
  _deletePetFromSupabase(pet.id, student.id);
  // Refresh UI
  scheduleAllRenders();
  if(currentModalStudentId && currentModalStudentId.toString()===studentId.toString()) refreshCurrentStudentModal();
  // Go back to pet list or student list if no pets remain
  if(student.pets.length > 0){
    _renderDeletePetPetList(student, curClass.name);
  } else {
    const studentsWithPets = curClass.students.filter(s => s.pets && s.pets.length > 0);
    if(studentsWithPets.length > 0){
      _renderDeletePetStudentList(studentsWithPets, curClass.name);
    } else {
      closeModal();
      showNotification('删除成功', `已删除 ${student.name} 的宠物「${petDisplayName}」，当前班级已无宠物`, 'success');
      return;
    }
  }
  showNotification('删除成功', `已删除 ${student.name} 的宠物「${petDisplayName}」`, 'success');
}
function _deletePetFromSupabase(petId, studentId){
  if(typeof db === 'undefined' || !db) return;
  // Mark as echo to avoid realtime re-adding
  if(typeof _markRowWritten === 'function') _markRowWritten('pets', petId);
  db.from('pets').delete().eq('id', petId).then(function(result){
    if(result.error){
      console.warn('[DAL] deletePet Supabase error:', result.error);
    } else {
      console.log('[DAL] deletePet Supabase OK: pet', petId, 'student', studentId);
    }
  });
}

// v119: 恢复被删除的宠物（从历史记录中恢复，不标记为撤销）
function restoreDeletedPet(logId){
  var _logs = getOpLogs();
  const log = _logs.find(l => l.id === logId);
  if(!log){ showNotification('恢复失败','未找到该操作记录','error'); return; }
  if(log.actionType !== '删除宠物'){ showNotification('恢复失败','该操作不是删除宠物','error'); return; }
  if(!log.extra || !log.extra.deletedPetSnapshot){ showNotification('恢复失败','该记录没有宠物快照数据','error'); return; }
  const curClass = classesData.find(c=>c.id===currentClassId);
  if(!curClass) return;
  const student = curClass.students.find(s=>s.id.toString()===log.studentId.toString());
  if(!student){ showNotification('恢复失败','未找到该学生','error'); return; }
  const petSnap = log.extra.deletedPetSnapshot;
  // Check if pet already exists (shouldn't, but safety check)
  if(student.pets.some(p=>p.id.toString()===petSnap.id.toString())){
    showNotification('恢复失败','该宠物已存在，无需恢复','warning'); return;
  }
  // Restore the pet with its exact state at deletion time
  const restoredPet = JSON.parse(JSON.stringify(petSnap));
  student.pets.push(restoredPet);
  // Restore activePetId if it was the active pet at deletion
  if(log.extra.wasActivePet){
    student.activePetId = restoredPet.id;
  }
  // Mark the log as restored (but not "reverted" - this is a separate restore action)
  log.extra._restored = true;
  // Save data
  saveClassData('pet');
  // Re-sync pet to Supabase
  if(typeof db !== 'undefined' && db){
    var petData = {
      id: restoredPet.id,
      student_id: student.id,
      name: restoredPet.name,
      nickname: restoredPet.nickname,
      level: restoredPet.level,
      growth: restoredPet.growth||0,
      is_dead: restoredPet.isDead||false,
      last_feed_date: restoredPet.lastFeedDate,
      today_feed_count: restoredPet.todayFeedCount||0,
      last_play_date: restoredPet.lastPlayDate,
      today_play_count: restoredPet.todayPlayCount||0,
      penalty_streak: restoredPet.penaltyStreak||0
    };
    if(typeof _markRowWritten === 'function') _markRowWritten('pets', restoredPet.id);
    db.from('pets').upsert(petData).then(function(r){
      if(r.error) console.warn('[DAL] restoreDeletedPet Supabase error:', r.error);
      else console.log('[DAL] restoreDeletedPet Supabase OK: pet', restoredPet.id);
    });
  }
  // Refresh UI
  scheduleAllRenders();
  if(currentModalStudentId && currentModalStudentId.toString()===log.studentId.toString()) refreshCurrentStudentModal();
  // Refresh history modal if open
  refreshHistoryModalIfOpen();
  const petName = restoredPet.nickname ? `${restoredPet.nickname}(${restoredPet.name})` : restoredPet.name;
  showNotification('恢复成功', `已恢复 ${student.name} 的宠物「${petName}」(Lv${restoredPet.level}, 成长值${restoredPet.growth||0})`, 'success');
}

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
function adoptNewPet(student, petName, nickname){ const cfg = PET_CONFIG[petName]; if(!cfg) return false; if(student.pets.length>0 && student.pets.some(p=>p.level<9 && !p.isDead)){showNotification('无法领养','还有未满级的存活宠物，需要全部满级后才能领养新宠物','warning');return false;} const newPet = { id: _genLocalId(), name: petName, nickname, level: 1, growth: 0, lastFeedDate: new Date().toISOString(), todayFeedCount: 0, isDead: false, todayPlayCount: 0, lastPlayDate: null, penaltyStreak: 0 }; student.pets.push(newPet); student.activePetId = newPet.id; saveClassData('pet'); scheduleAllRenders(); showNotification('领养成功',`${nickname} 加入宠物大家庭，现已激活！`,'success'); return true; }
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
   pet.growth+=gain; pet.lastFeedDate=new Date().toISOString(); pet.isDead=false;
   updatePetLevel(student, pet.id, gain);
   changeStudentCoins(student, -5, '喂食', `${pet.nickname||pet.name} +${gain}成长值`, gain, pet.id);
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
  // v81: 按总成长值排序（所有宠物成长值之和），而不是仅看当前激活宠物
  if (!student.pets || student.pets.length === 0) return 0;
  var total = 0;
  student.pets.forEach(function(p) { total += (p.growth || 0); });
  return total;
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
  // v81: 必须设置明确的display值，否则CSS .teacher-only { display:none } 会覆盖
  var _resetPwdBtn = document.querySelector('.teacher-only');
  if (_resetPwdBtn) {
    _resetPwdBtn.style.display = _isTeacher() ? 'flex' : 'none';
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
function playWithPet(student,pet){ if(pet.isDead){ showNotification('玩耍失败','宠物已经死亡，请先复活','error'); return false; } if(student.coins<20){ showNotification('金币不足','玩耍需要20金币','error'); return false; } if(pet.level >= 9){ showNotification('已达万物之神','无法继续成长，可以领养新宠物','warning'); return false; } ensurePetPlayFields(pet); let gain=Math.min(7+getStudentGrowthBonus(student), 13); pet.growth+=gain; pet.lastPlayDate=new Date().toISOString(); updatePetLevel(student, pet.id, gain); changeStudentCoins(student, -20, '玩耍', `${pet.nickname||pet.name} +${gain}成长值`, gain, pet.id); showNotification('玩耍快乐',`${pet.nickname||pet.name} 获得 ${gain} 成长值！`,'success'); return true; }
function walkPet(student,pet){ if(pet.isDead){ showNotification('散步失败','宠物已经死亡，请先复活','error'); return false; } if(student.coins<30){ showNotification('金币不足','散步需要30金币','error'); return false; } if(pet.level >= 9){ showNotification('已达万物之神','无法继续成长，可以领养新宠物','warning'); return false; } ensurePetPlayFields(pet); let gain=Math.min(15+getStudentGrowthBonus(student), 24); pet.growth+=gain; updatePetLevel(student, pet.id, gain); changeStudentCoins(student, -30, '散步', `${pet.nickname||pet.name} +${gain}成长值`, gain, pet.id); showNotification('散步愉快',`${pet.nickname||pet.name} 获得 ${gain} 成长值！`,'success'); return true; }
function shoppingPet(student,pet){ if(pet.isDead){ showNotification('逛街失败','宠物已经死亡，请先复活','error'); return false; } if(pet.level<3){ showNotification('等级不足','逛街需要Lv3以上','warning'); return false; } if(student.coins<50){ showNotification('金币不足','逛街需要50金币','error'); return false; } if(pet.level >= 9){ showNotification('已达万物之神','无法继续成长，可以领养新宠物','warning'); return false; } ensurePetPlayFields(pet); let gain=Math.min(35+getStudentGrowthBonus(student), 45); pet.growth+=gain; updatePetLevel(student, pet.id, gain); changeStudentCoins(student, -50, '逛街', `${pet.nickname||pet.name} +${gain}成长值`, gain, pet.id); showNotification('逛街开心',`${pet.nickname||pet.name} 获得 ${gain} 成长值！`,'success'); return true; }
function travelPet(student,pet){ if(pet.isDead){ showNotification('旅游失败','宠物已经死亡，请先复活','error'); return false; } if(pet.level<6){ showNotification('等级不足','旅游需要Lv6以上','warning'); return false; } if(student.coins<100){ showNotification('金币不足','旅游需要100金币','error'); return false; } if(pet.level >= 9){ showNotification('已达万物之神','无法继续成长，可以领养新宠物','warning'); return false; } ensurePetPlayFields(pet); let gain=Math.min(85+getStudentGrowthBonus(student), 100); pet.growth+=gain; updatePetLevel(student, pet.id, gain); changeStudentCoins(student, -100, '旅游', `${pet.nickname||pet.name} +${gain}成长值`, gain, pet.id); showNotification('旅游愉快',`${pet.nickname||pet.name} 获得 ${gain} 成长值！`,'success'); return true; }
function revivePet(student,pet){ if(!pet.isDead) return false; if(student.coins<50){showNotification('金币不足','复活需要50金币','error');return false;} pet.isDead=false; let deadGrowth = pet.deathGrowth !== undefined ? pet.deathGrowth : pet.growth; let newGrowth = Math.floor(deadGrowth * 0.5); let prevGrowth = pet.growth; pet.growth = newGrowth; pet.level = 1; const cfg = PET_CONFIG[pet.name]; if(cfg){ let newLevel = 1; for(let i=cfg.stages.length-1;i>=0;i--) if(pet.growth>=cfg.stages[i].growthRequired){ newLevel=cfg.stages[i].stage; break; } pet.level = newLevel; } pet.lastFeedDate=new Date().toISOString(); pet.todayFeedCount=0; pet.todayPlayCount=0; pet.lastPlayDate=null; pet.penaltyStreak = 0; delete pet.deathGrowth; changeStudentCoins(student, -50, '复活', `${pet.nickname||pet.name} 复活`, newGrowth - prevGrowth, pet.id); showNotification('复活成功',`${pet.nickname||pet.name} 重获新生！经验保留50%`,'success'); renderPKPage(); return true; }
function applyAction(student, action, pet){ let coinsChange = action.coins; let isPenalty = coinsChange < 0; let expChange = 0; let prevGrowth = pet.growth; if(pet.isDead){ if(isPenalty){ showNotification('操作禁止','宠物已死亡，不能施加惩罚','error'); return false; } else { student.coins += coinsChange; if(student.coins < 0) student.coins = 0; if(pet.penaltyStreak !== undefined) pet.penaltyStreak = 0; recordAction(student.id, student.name, '奖惩', `${action.name} (宠物死亡)`, coinsChange, 0, pet.id); showNotification(action.name, `+${coinsChange}金币 (宠物死亡无法获得经验)`, 'success'); return true; } } if(isPenalty){ let absDeduct = Math.abs(coinsChange); let coinDeducted = Math.min(absDeduct, student.coins); let remaining = absDeduct - coinDeducted; student.coins -= coinDeducted; expChange = 0; if(remaining > 0){ expChange = -remaining; pet.growth += expChange; if(pet.growth <= 0){ pet.growth = 0; pet.isDead = true; pet.deathGrowth = prevGrowth; pet.deathDate = new Date().toISOString(); pet.penaltyStreak = 0; recordAction(student.id, student.name, '惩罚致死', `${action.name} 导致死亡（金币不足，经验扣至0）`, -absDeduct, -prevGrowth, pet.id, {causedDeath: true, prevGrowth: prevGrowth}); showNotification('惩罚致死',`${pet.nickname||pet.name} 金币不足，经验被扣至0，宠物死亡！`,'error'); saveClassData(); renderPKPage(); return true; } updatePetLevel(student, pet.id, expChange); } let msg = `${action.name}：金币-${coinDeducted}`; if(expChange !== 0) msg += `，经验${expChange}`; recordAction(student.id, student.name, '奖惩', msg, -coinDeducted, expChange, pet.id); showNotification(action.name, msg, 'warning'); } else { if(pet.penaltyStreak !== undefined) pet.penaltyStreak = 0; student.coins += coinsChange; if(student.coins < 0) student.coins = 0; let msg = `${action.name}：金币+${coinsChange}`; recordAction(student.id, student.name, '奖惩', msg, coinsChange, 0, pet.id); showNotification(action.name, msg, 'success'); } return true; }
function modalFeed(){if(checkPauseAndNotify())return;if(!currentModalStudentId)return;const cur=classesData.find(c=>c.id===currentClassId);const student=cur.students.find(s=>s.id.toString()===currentModalStudentId.toString());if(!student)return;let pet=getActivePet(student);if(!pet)return;if(pet.isDead||pet.level>=9){const growable=getGrowablePet(student);if(growable){pet=growable;}else if(pet.isDead){showNotification('无法喂食','宠物已死亡，请先复活','error');return;}else{showNotification('全部满级','所有宠物都已满级，可以领养新宠物','info');return;}}feedPet(student,pet);saveClassData('pet');refreshCurrentStudentModal();scheduleAllRenders();}
function modalPlay(){if(checkPauseAndNotify())return;if(!currentModalStudentId)return;const cur=classesData.find(c=>c.id===currentClassId);const student=cur.students.find(s=>s.id.toString()===currentModalStudentId.toString());if(!student)return;let pet=getActivePet(student);if(!pet)return;if(pet.isDead||pet.level>=9){const growable=getGrowablePet(student);if(growable){pet=growable;}else if(pet.isDead){showNotification('无法玩耍','宠物已死亡，请先复活','error');return;}else{showNotification('全部满级','所有宠物都已满级，可以领养新宠物','info');return;}}playWithPet(student,pet);saveClassData('pet');refreshCurrentStudentModal();scheduleAllRenders();}
function modalWalk(){if(checkPauseAndNotify())return;if(!currentModalStudentId)return;const cur=classesData.find(c=>c.id===currentClassId);const student=cur.students.find(s=>s.id.toString()===currentModalStudentId.toString());if(!student)return;let pet=getActivePet(student);if(!pet)return;if(pet.isDead||pet.level>=9){const growable=getGrowablePet(student);if(growable){pet=growable;}else if(pet.isDead){showNotification('无法散步','宠物已死亡，请先复活','error');return;}else{showNotification('全部满级','所有宠物都已满级，可以领养新宠物','info');return;}}walkPet(student,pet);saveClassData('pet');refreshCurrentStudentModal();scheduleAllRenders();}
function modalShopping(){if(checkPauseAndNotify())return;if(!currentModalStudentId)return;const cur=classesData.find(c=>c.id===currentClassId);const student=cur.students.find(s=>s.id.toString()===currentModalStudentId.toString());if(!student)return;let pet=getActivePet(student);if(!pet)return;if(pet.isDead||pet.level>=9){const growable=getGrowablePet(student);if(growable){pet=growable;}else if(pet.isDead){showNotification('无法逛街','宠物已死亡，请先复活','error');return;}else{showNotification('全部满级','所有宠物都已满级，可以领养新宠物','info');return;}}if(pet.level<3){showNotification('等级不足','逛街需要Lv3以上','warning');return;}shoppingPet(student,pet);saveClassData('coins');refreshCurrentStudentModal();scheduleAllRenders();}
function modalTravel(){if(checkPauseAndNotify())return;if(!currentModalStudentId)return;const cur=classesData.find(c=>c.id===currentClassId);const student=cur.students.find(s=>s.id.toString()===currentModalStudentId.toString());if(!student)return;let pet=getActivePet(student);if(!pet)return;if(pet.isDead||pet.level>=9){const growable=getGrowablePet(student);if(growable){pet=growable;}else if(pet.isDead){showNotification('无法旅游','宠物已死亡，请先复活','error');return;}else{showNotification('全部满级','所有宠物都已满级，可以领养新宠物','info');return;}}if(pet.level<6){showNotification('等级不足','旅游需要Lv6以上','warning');return;}travelPet(student,pet);saveClassData('coins');refreshCurrentStudentModal();scheduleAllRenders();}
function modalRevive(){if(checkPauseAndNotify())return;if(!currentModalStudentId)return;const cur=classesData.find(c=>c.id===currentClassId);const student=cur.students.find(s=>s.id.toString()===currentModalStudentId.toString());if(!student)return;const pet=getActivePet(student);if(!pet)return;revivePet(student,pet);saveClassData('pet');refreshCurrentStudentModal();renderHomePetGrid();renderClassTopThree();}
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
  student.lastCheckinDate = new Date().toISOString();
  changeStudentCoins(student, 10, '每日打卡', '+10金币', 0, null);
  saveClassData();
  refreshCurrentStudentModal();
  renderHomePetGrid();
  scheduleAllRenders();
  showNotification('打卡成功','每日打卡 +10金币！','success');
}
function modalApplyAction(actionId){if(checkPauseAndNotify())return;if(!currentModalStudentId)return;const cur=classesData.find(c=>c.id===currentClassId);const student=cur.students.find(s=>s.id.toString()===currentModalStudentId.toString());if(!student)return;const pet=getActivePet(student);if(!pet)return;const action=customActions.find(a=>String(a.id)===String(actionId));if(!action)return; const result = applyAction(student, action, pet); if(result){ saveClassData('coins'); refreshCurrentStudentModal(); scheduleAllRenders(); } }
function modalAdoptNew(){if(checkPauseAndNotify())return;if(!currentModalStudentId)return;const cur=classesData.find(c=>c.id===currentClassId);const student=cur.students.find(s=>s.id.toString()===currentModalStudentId.toString());if(!student)return;if(student.pets.some(p=>p.level<9 && !p.isDead)){showNotification('无法领养','还有未满级的存活宠物，需要全部满级后才能领养新宠物','warning');return;}closeModal();showAdoptModal(student.id, true);}
function showAdoptModal(studentId, fromModal=false){ if(checkPauseAndNotify())return; const cur=classesData.find(c=>c.id===currentClassId); const student=cur.students.find(s=>s.id.toString()===studentId.toString()); if(student.pets.length>0 && student.pets.some(p=>p.level<9 && !p.isDead)){showNotification('无法领养','还有未满级的存活宠物，需要全部满级后才能领养新宠物','warning');return;} let list=`<div class="pet-select-grid">`; Object.keys(PET_CONFIG).forEach(name=>{ list+=`<div class="pet-select-item" onclick="selectPetForAdopt('${name}','${studentId}')"><div class="pet-select-img">${getPetImage(name, 1)}</div><div>${name}</div></div>`; }); list+='</div>'; const modalOverlay = showModal('领养宠物', list, [{text:'取消',onclick: fromModal ? 'refreshCurrentStudentModal()' : 'closeModal()'}], true); if(modalOverlay){ const modalDiv = modalOverlay.querySelector('.modal'); if(modalDiv) modalDiv.classList.add('adopt-modal'); } }
function selectPetForAdopt(petName,studentId){selectedPetName=petName;showModal('起个昵称',`<input id="nicknameInput" value="${petName}" style="width:100%;padding:10px;border-radius:20px;">`,[{text:'取消',onclick:'closeModal()'},{text:'确认领养',onclick:`confirmAdoptPet('${studentId}')`}]);}
function confirmAdoptPet(studentId){if(checkPauseAndNotify())return;var rawNick=document.getElementById('nicknameInput')?.value||selectedPetName;var nickname=_sanitizeInput(rawNick)||selectedPetName;if(nickname.length>15)nickname=nickname.slice(0,15);const cur=classesData.find(c=>c.id===currentClassId);const student=cur.students.find(s=>s.id.toString()===studentId.toString());if(!student)return;adoptNewPet(student, selectedPetName, nickname);closeModal();if(currentModalStudentId && currentModalStudentId===studentId) openStudentModal(studentId); else renderHomePetGrid();}

function showChangePetModal(studentId){ const cur=classesData.find(c=>c.id===currentClassId); const student=cur.students.find(s=>s.id.toString()===studentId.toString()); const activePet=getActivePet(student); if(!activePet||activePet.level>=2){showNotification('等级≥2无法更换','','error');return;} let list='<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;">'; Object.keys(PET_CONFIG).forEach(name=>{list+=`<div class="pet-select-item" style="padding:5px;" onclick="selectPetForChange('${name}','${studentId}')"><div class="pet-select-img" style="width:60px;height:60px;">${getPetImage(name,1)}</div><div>${name}</div></div>`;}); list+='</div>'; showModal('更换宠物(仅限Lv1)',list,[{text:'取消',onclick:'closeModal()'}],false); }
function selectPetForChange(petName,studentId){selectedPetName=petName;showModal('新昵称',`<input id="nicknameInput" value="${petName}">`,[{text:'取消',onclick:'closeModal()'},{text:'确认',onclick:`confirmChangePet('${studentId}')`}]);}
function confirmChangePet(studentId){var rawNick=document.getElementById('nicknameInput')?.value||selectedPetName;var nickname=_sanitizeInput(rawNick)||selectedPetName;if(nickname.length>15)nickname=nickname.slice(0,15);const cur=classesData.find(c=>c.id===currentClassId);const student=cur.students.find(s=>s.id.toString()===studentId.toString());const activePet=getActivePet(student);if(!activePet||activePet.level>=2)return;const idx=student.pets.findIndex(p=>p.id===activePet.id);if(idx!==-1){student.pets[idx]={...activePet,name:selectedPetName,nickname:nickname,level:1,growth:activePet.growth,lastFeedDate:activePet.lastFeedDate||new Date().toISOString(),todayFeedCount:0,isDead:activePet.isDead, todayPlayCount:0, lastPlayDate:null, penaltyStreak:activePet.penaltyStreak||0};saveClassData();closeModal();scheduleAllRenders();showNotification('更换成功',`新宠物${nickname}`,'success');}}
function renamePet(studentId, petId){ const cur=classesData.find(c=>c.id===currentClassId); if(!cur) return; const student=cur.students.find(s=>s.id.toString()===studentId.toString()); if(!student) return; const pet=student.pets.find(p=>String(p.id)===String(petId)); if(!pet) return; const oldName=pet.nickname||pet.name; showModal('修改宠物名字',`<div style="text-align:center;margin-bottom:10px;font-size:14px;color:#888;">当前名字：<strong>${esc(oldName)}</strong></div><input id="renamePetInput" value="${escAttr(oldName)}" maxlength="20" style="width:100%;padding:10px 14px;border:2px solid #ffcfcf;border-radius:16px;font-size:16px;text-align:center;outline:none;box-sizing:border-box;" onfocus="this.select()" placeholder="请输入新名字">`,[{text:'取消',onclick:'closeModal()'},{text:'确认修改',onclick:`confirmRenamePet('${escJS(studentId)}','${escJS(petId)}')`}]); setTimeout(()=>{const inp=document.getElementById('renamePetInput');if(inp)inp.focus();},100); }
function confirmRenamePet(studentId, petId){ const inp=document.getElementById('renamePetInput'); if(!inp) return; var rawName=inp.value.trim(); if(!rawName){showNotification('名字不能为空','请输入一个宠物名字','warning');return;} var v=_validateInput(rawName,15,'宠物昵称'); if(!v.ok){showNotification('输入无效',v.error,'warning');return;} const cur=classesData.find(c=>c.id===currentClassId); if(!cur) return; const student=cur.students.find(s=>s.id.toString()===studentId.toString()); if(!student) return; const pet=student.pets.find(p=>String(p.id)===String(petId)); if(!pet) return; const oldName=pet.nickname||pet.name; pet.nickname=v.value; saveClassData(); closeModal(); scheduleAllRenders(); if(currentModalStudentId && student.id.toString()===currentModalStudentId.toString()) refreshCurrentStudentModal(); showNotification('改名成功',`${oldName} → ${v.value}`,'success'); }
function showSwitchPetModal(studentId){ const cur=classesData.find(c=>c.id===currentClassId); const student=cur.students.find(s=>s.id.toString()===studentId.toString()); if(!student||student.pets.length<=1)return; const maxed=countMaxedPets(student); let html=maxed>0?`<div style="text-align:center;margin-bottom:10px;padding:6px 16px;background:linear-gradient(135deg,#fff8e0,#fff0c0);border-radius:16px;font-size:14px;font-weight:700;color:#b8860b;">👑 ${maxed}只传说神兽 · 宠物大师</div>`:''; html+='<div style="display:flex;flex-direction:column;gap:8px;">'; student.pets.forEach(p=>{const isActive = Number(student.activePetId)===Number(p.id); const isMax=p.level>=9; const borderStyle=isMax?'2px solid #ffd700':isActive?'2px solid #ff8888':'1px solid #ffcfcf'; const bg=isMax?'linear-gradient(135deg,#fffbe6,#fff5d0)':'#fff'; const badge=isMax?'<span style="background:linear-gradient(135deg,#ffd700,#ff8c00);color:#fff;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:800;margin-left:6px;">👑 满级</span>':''; html+=`<div style="display:flex;align-items:center;gap:12px;padding:10px 14px;border:${borderStyle};border-radius:20px;cursor:pointer;background:${bg};transition:all 0.2s;" onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 4px 12px rgba(0,0,0,0.1)'" onmouseout="this.style.transform='none';this.style.boxShadow='none'" onclick="switchPet('${studentId}','${p.id}');closeModal();"><div style="width:55px;height:55px;flex-shrink:0;">${getPetImage(p.name, p.level)}</div><div style="flex:1;"><strong>${esc(p.nickname||p.name)}</strong>${badge} <span style="color:#aaa;font-size:12px;">${isActive?'⭐当前展示':''}</span><br><span style="font-size:13px;color:#888;">Lv.${p.level} · ${getCurrentStageName(p.name,p.level)} · 成长:${p.level>=9?getExpNeeded(p):p.growth}${p.isDead?' · 💀已死亡':''}</span></div></div>`;}); html+='</div><div style="margin-top:10px;text-align:center;color:#bbb;font-size:12px;">点击切换卡片展示的宠物，喂食自动作用于未满级宠物</div>'; showModal('切换展示宠物',html,[{text:'关闭',onclick:'closeModal()'}],false); }
function switchPet(studentId, petId){ const cur = classesData.find(c=>c.id===currentClassId); const student = cur.students.find(s=>s.id.toString()===studentId.toString()); if(student) setActivePet(student, Number(petId)); }
function setActivePet(student, petId){ petId = Number(petId); if(student.pets.some(p=>Number(p.id)===petId)){ student.activePetId = petId; saveClassData(); renderHomePetGrid(); renderPKPage(); if(currentModalStudentId && student.id.toString()===currentModalStudentId.toString()) refreshCurrentStudentModal(); } }
function showBatchEditModal(){ if(typeof currentUser!=='undefined'&&currentUser&&currentUser.type==='student'){showNotification('权限不足','此操作仅限教师','error');return;} if(!currentClassId){ showNotification('请先选择班级','','error'); return; } const cur = classesData.find(c=>c.id===currentClassId); if(!cur || cur.students.length===0){ showNotification('班级无学生','请先添加学生','warning'); return; } let studentListHtml = '<div class="batch-checkbox-list"><div><label><input type="checkbox" id="selectAllBatch" onclick="toggleAllBatch(this.checked)"> 全选/取消全选</label></div>'; cur.students.forEach((s)=>{ studentListHtml += `<div class="batch-student-item"><input type="checkbox" class="batch-student-chk" value="${s.id}" id="stu_${s.id}"><label for="stu_${s.id}">${esc(s.name)} (💰${s.coins})</label></div>`; }); studentListHtml += '</div><div><label>奖惩项目: <select id="batchActionSelect">'; customActions.forEach(act=>{ const sign = act.coins>0 ? `+${act.coins}` : `${act.coins}`; studentListHtml += `<option value="${act.id}">${esc(act.name)} (${sign}金币)</option>`; }); studentListHtml += '</select></label><label style="margin-left:10px;"><input type="checkbox" id="batchCustomToggle" onchange="document.getElementById(\'batchCustomCoins\').style.display=this.checked?\'inline-block\':\'none\';document.getElementById(\'batchActionSelect\').disabled=this.checked;"> 自定义加金币</label><span id="batchCustomCoins" style="display:none;margin-left:8px;"><input type="number" id="batchCustomValue" style="width:70px;padding:4px 6px;border:1px solid #ccc;border-radius:8px;font-size:14px;" placeholder="金币数" value="10"> 金币</span></div>'; showModal('批量奖惩', studentListHtml, [{text:'取消', class:'btn-secondary', onclick:'closeModal()'},{text:'执行', class:'btn-primary', onclick:'confirmBatchAction()'}], false); setTimeout(()=>{ const selectAll = document.getElementById('selectAllBatch'); if(selectAll) selectAll.onchange = (e) => toggleAllBatch(e.target.checked); }, 50); }
function toggleAllBatch(checked){ const chks = document.querySelectorAll('.batch-student-chk'); chks.forEach(chk => chk.checked = checked); }
function confirmBatchAction(){ if(typeof currentUser!=='undefined'&&currentUser&&currentUser.type==='student'){showNotification('权限不足','此操作仅限教师','error');return;} const cur = classesData.find(c=>c.id===currentClassId); if(!cur) return; const isCustom = document.getElementById('batchCustomToggle')?.checked; let action; if(isCustom){ const val = parseInt(document.getElementById('batchCustomValue')?.value); if(isNaN(val)||val===0){ showNotification('请输入有效的金币数','不能为0','warning'); return; } action = {id:'_custom_', name:'自定义'+(val>0?'+':'')+val+'金币', coins: val}; } else { const actionId = document.getElementById('batchActionSelect')?.value; action = customActions.find(a=>String(a.id)===String(actionId)); if(!action){ showNotification('错误','未选择有效的奖惩项目','error'); return; } } const selectedIds = Array.from(document.querySelectorAll('.batch-student-chk:checked')).map(cb=>cb.value); if(selectedIds.length===0){ showNotification('请至少选择一名学生','','warning'); return; } let updatedCount = 0; cur.students.forEach(s=>{ if(selectedIds.includes(s.id.toString())){ let pet = getActivePet(s); if(pet){ let coinsChange = action.coins; let isPenalty = coinsChange < 0; let expChange = 0; if(pet.isDead){ if(isPenalty){ showNotification('操作跳过',`${s.name} 宠物已死亡，惩罚跳过`,'warning'); return; } else { s.coins += coinsChange; if(s.coins<0) s.coins=0; recordAction(s.id, s.name, '批量奖惩', `${action.name} (宠物死亡)`, coinsChange, 0, pet.id); updatedCount++; return; } } if(isPenalty){ let absDeduct = Math.abs(coinsChange); let coinDeducted = Math.min(absDeduct, s.coins); let remaining = absDeduct - coinDeducted; s.coins -= coinDeducted; expChange = 0; if(remaining > 0){ expChange = -remaining; let prevGrowth = pet.growth; pet.growth += expChange; if(pet.growth <= 0){ pet.growth = 0; pet.isDead = true; pet.deathGrowth = prevGrowth; pet.deathDate = new Date().toISOString(); pet.penaltyStreak = 0; recordAction(s.id, s.name, '惩罚致死', `${action.name} 导致死亡（金币不足，经验扣至0）`, -absDeduct, -prevGrowth, pet.id, {causedDeath: true, prevGrowth: prevGrowth}); updatedCount++; return; } updatePetLevel(s, pet.id, expChange); } recordAction(s.id, s.name, '批量奖惩', `${action.name}`, -coinDeducted, expChange, pet.id); updatedCount++; } else { if(pet.penaltyStreak !== undefined) pet.penaltyStreak = 0; s.coins += coinsChange; if(s.coins<0) s.coins=0; recordAction(s.id, s.name, '批量奖惩', `${action.name}`, coinsChange, 0, pet.id); updatedCount++; } } else { s.coins += action.coins; if(s.coins<0) s.coins=0; recordAction(s.id, s.name, '批量奖惩', `${action.name} (无宠物)`, action.coins, 0, null); updatedCount++; } } }); if(updatedCount>0){ saveClassData('coins'); scheduleAllRenders(); if(currentModalStudentId) refreshCurrentStudentModal(); showNotification('批量操作完成',`已对${updatedCount}名学生执行“${action.name}”`,'success'); } else { showNotification('无变化','操作未生效','info'); } closeModal(); }
function showPauseGrowthModal(){ if(typeof currentUser!=='undefined'&&currentUser&&currentUser.type==='student'){showNotification('权限不足','此操作仅限教师','error');return;} if(!currentClassId)return; const cur=classesData.find(c=>c.id===currentClassId); const p=cur.pauseGrowth||{start:'',end:''}; const content=`<div><label>开始: <input type="date" id="ps" value="${p.start}"></label><br><label>结束: <input type="date" id="pe" value="${p.end}"></label><p>假期内停止饿死计时</p></div>`; showModal('假期保护',content,[{text:'清除',onclick:'clearPause()'},{text:'保存',onclick:'savePause()'},{text:'关闭',onclick:'closeModal()'}]); }
function savePause(){if(typeof currentUser!=='undefined'&&currentUser&&currentUser.type==='student'){showNotification('权限不足','此操作仅限教师','error');return;}const s=document.getElementById('ps').value,e=document.getElementById('pe').value;if(s&&e){const cur=classesData.find(c=>c.id===currentClassId);cur.pauseGrowth={start:s,end:e};saveClassData();closeModal();showNotification('已设置','','success');}}
function clearPause(){if(typeof currentUser!=='undefined'&&currentUser&&currentUser.type==='student'){showNotification('权限不足','此操作仅限教师','error');return;}const cur=classesData.find(c=>c.id===currentClassId);delete cur.pauseGrowth;saveClassData();closeModal();showNotification('已清除假期','','info');}
function showCustomActionsModal(){ if(typeof currentUser!=='undefined'&&currentUser&&currentUser.type==='student'){showNotification('权限不足','此操作仅限教师','error');return;} let items='';customActions.forEach(a=>{const sign=a.coins>0?`+${a.coins}`:`${a.coins}`;items+=`<div class="custom-action-item"><span>${esc(a.name)} ${sign}金币</span><span><span onclick="editCustomAction('${a.id}')">✏️</span> ${!String(a.id).startsWith('sys_')?`<span onclick="deleteCustomAction('${a.id}')">🗑️</span>`:''}</span></div>`;});const content=`<div style="max-height:300px;overflow:auto;">${items}</div><button class="btn btn-success" onclick="showAddCustomActionModal()">➕ 新增奖惩</button>`;showModal('学习奖惩管理',content,[{text:'关闭',onclick:'closeModal()'}],false);}
function showAddCustomActionModal(){closeModal();showModal('新增奖惩','<input id="newActName" placeholder="名称"><input id="newCoins" type="number" placeholder="金币数量" value="10">',[{text:'取消',onclick:'showCustomActionsModal()'},{text:'保存',onclick:'saveNewReward()'}]);}
function saveNewReward(){var rawName=document.getElementById('newActName')?.value;const coins=parseInt(document.getElementById('newCoins')?.value);if(!rawName||isNaN(coins)){showNotification('错误','请填写有效名称和金币数','error');return;}var v=_validateInput(rawName,20,'动作名称');if(!v.ok){showNotification('输入无效',v.error,'warning');return;}customActions.push({id:Date.now().toString(),name:v.value,coins});saveCustomActions();closeModal();showCustomActionsModal();}
function editCustomAction(id){const act=customActions.find(a=>String(a.id)===String(id));if(!act)return;closeModal();showModal('编辑奖惩',`<input id="editName" value="${esc(act.name)}"><input id="editCoins" value="${act.coins}" type="number">`,[{text:'取消',onclick:'showCustomActionsModal()'},{text:'保存',onclick:`updateReward('${id}')`}]);}
function updateReward(id){var rawName=document.getElementById('editName')?.value;const coins=parseInt(document.getElementById('editCoins')?.value);if(rawName&&!isNaN(coins)){var v=_validateInput(rawName,20,'动作名称');if(!v.ok){showNotification('输入无效',v.error,'warning');return;}const idx=customActions.findIndex(a=>String(a.id)===String(id));if(idx!==-1){customActions[idx]={...customActions[idx],name:v.value,coins};saveCustomActions();}closeModal();showCustomActionsModal();}}
function deleteCustomAction(id){if(confirm('删除操作')){customActions=customActions.filter(a=>String(a.id)!==String(id));saveCustomActions();showCustomActionsModal();}}
function showStudentListModal(){if(!currentClassId)return;const cur=classesData.find(c=>c.id===currentClassId);let html='<div style="max-height:400px;overflow:auto;">';cur.students.forEach(s=>{html+=`<div class="student-list-item"><span>${esc(s.name)}</span><div><span class="edit-icon" style="cursor:pointer;" onclick="editStudentName('${s.id}')">✏️</span><span class="delete-icon" style="cursor:pointer;margin-left:10px;" onclick="deleteStudentById('${s.id}')">🗑️</span></div></div>`;});html+='</div>';showModal('学生列表',html,[{text:'增加学生',class:'btn-primary',onclick:'addSingleStudent()'},{text:'关闭',class:'btn-secondary',onclick:'closeModal()'},{text:'清空所有',class:'btn-danger',onclick:'clearAllStudents()'}]);}
function addSingleStudent(){const name=prompt('学生姓名（最多20字）');if(!name)return;var v=_validateInput(name,20,'学生姓名');if(!v.ok){showNotification('输入无效',v.error,'warning');return;}const cur=classesData.find(c=>c.id===currentClassId);if(cur.students.find(s=>s.name===v.value)){showNotification('已存在','','error');return;}cur.students.push({id:_genLocalId(),name:v.value,coins:50,pets:[],lastCheckinDate:null,activePetId:null,pkCountToday:0,lastPkDate:null});saveClassData();closeModal();showStudentListModal();scheduleAllRenders();}
function editStudentName(id){const cur=classesData.find(c=>c.id===currentClassId);const stu=cur.students.find(s=>s.id.toString()===id.toString());if(!stu)return;const newName=prompt('新名字（最多20字）',stu.name);if(!newName)return;var v=_validateInput(newName,20,'学生姓名');if(!v.ok){showNotification('输入无效',v.error,'warning');return;}stu.name=v.value;saveClassData();closeModal();showStudentListModal();renderHomePetGrid();}
function deleteStudentById(id){if(!confirm('删除学生'))return;var cur=classesData.find(function(c){return c.id===currentClassId;});if(!cur)return;var deletedStu=cur.students.find(function(s){return s.id.toString()===id.toString();});cur.students=cur.students.filter(function(s){return s.id.toString()!==id.toString();});closeModal();showStudentListModal();scheduleAllRenders();if(currentModalStudentId&&currentModalStudentId===id)closeModal();_pauseSync=true;var _waitAndDel=function(){if(typeof _dalSyncing!=='undefined'&&_dalSyncing){setTimeout(_waitAndDel,300);return;}safeLSSave('classPetData',classesData);scheduleFileSave();if(typeof db!=='undefined'&&db&&deletedStu&&typeof _isValidInt4Id==='function'&&_isValidInt4Id(deletedStu.id)){var stuId=parseInt(deletedStu.id);if(!isNaN(stuId)&&stuId>0){db.from('operation_logs').delete().eq('student_id',stuId).then(function(){return db.from('pets').delete().in('student_id',[stuId]);}).then(function(){return db.from('students').delete().eq('id',stuId);}).then(function(r){if(r.error)console.warn('[DAL] deleteStudent Supabase error:',r.error);else console.log('[DAL] Deleted student',stuId,'from Supabase');}).catch(function(e){console.warn('[DAL] deleteStudent Supabase error:',e);}).finally(function(){_pauseSync=false;saveClassData();});return;}_pauseSync=false;saveClassData();}};_waitAndDel();}
function clearAllStudents(){if(confirm('清空所有学生？')){const cur=classesData.find(c=>c.id===currentClassId);cur.students=[];saveClassData();closeModal();scheduleAllRenders();if(currentModalStudentId)closeModal();}}

function switchPage(pageId){if(pageId!=='quiz-page'&&typeof window._stopPigRunBGM==='function'){window._stopPigRunBGM();}if(pageId!=='quiz-page'&&typeof window._stopMatch3BGM==='function'){window._stopMatch3BGM();}document.querySelectorAll('.nav-item').forEach(i=>i.classList.remove('active'));document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));document.getElementById(pageId).classList.add('active');var isStudentView=typeof currentUser!=='undefined'&&currentUser&&currentUser.type==='student';if(pageId!=='quiz-page'&&!isStudentView&&typeof window._resetQuizModalFlag==='function'){window._resetQuizModalFlag();}else if(pageId==='quiz-page'&&!isStudentView){if(typeof window._resetQuizModalFlag==='function')window._resetQuizModalFlag();window._pigRunModalShown=false;window._match3ModalShown=false;window._teacherPlayingAsStudent=null;}var needsLogReload=isStudentView&&(pageId==='pk-page'||pageId==='jianghu-page');if(needsLogReload&&typeof _loadOperationLogs==='function'){_loadOperationLogs().then(function(){if(typeof _syncOpLogsAlias==='function'){try{_syncOpLogsAlias();}catch(e){}}requestAnimationFrame(()=>{if(pageId==='pk-page'){renderPKPage();var sa=document.getElementById('classpk-start-area');if(sa)sa.classList.remove('visible');probePKMonsterImages();}else if(pageId==='jianghu-page'){renderJianghuPage();probeJhBossImages();}});}).catch(function(e){console.warn('[switchPage] Log reload failed:',e);requestAnimationFrame(()=>{if(pageId==='pk-page')renderPKPage();else if(pageId==='jianghu-page')renderJianghuPage();});});}else{requestAnimationFrame(()=>{if(pageId==='honor-board-page'){renderClassTopThree();var art=document.querySelector('.rank-tab.active');if(art&&art.textContent.includes('\u6bcf\u65e5'))renderQuizRanking();else if(art&&art.textContent.includes('\u5c0f\u732a'))renderPigRunRanking();else if(art&&art.textContent.includes('\u6d88\u6d88\u4e50'))renderMatch3Ranking();else if(art&&art.textContent.includes('\u5feb\u4e50\u8dd1'))renderHappyRunRanking();}else if(pageId==='quiz-page'){if(typeof renderQuizPage==='function')renderQuizPage();var aqt=document.querySelector('.quiz-tab.active');if(aqt&&aqt.textContent.includes('\u5c0f\u732a')){if(typeof renderPigRunPage==='function')renderPigRunPage();}else if(aqt&&aqt.textContent.includes('\u6d88\u6d88\u4e50')){if(typeof renderMatch3Page==='function')renderMatch3Page();}else if(aqt&&aqt.textContent.includes('\u5feb\u4e50\u8dd1')){if(typeof renderHappyRunPage==='function')renderHappyRunPage();}}else if(pageId==='pk-page'){renderPKPage();var sa=document.getElementById('classpk-start-area');if(sa)sa.classList.remove('visible');probePKMonsterImages();}else if(pageId==='jianghu-page'){renderJianghuPage();probeJhBossImages();}else if(pageId==='library-page'){if(typeof renderLibraryPage==='function')renderLibraryPage();}});}}
function init(){renderClassList();if(classesData.length&&!currentClassId)currentClassId=classesData[0].id;scheduleAllRenders();/* v127: 初始化审批状态按钮（仅学生可见） */if(typeof _initSnackStatusButton==='function')_initSnackStatusButton();/* 延迟非关键页面的初始渲染 */requestAnimationFrame(()=>{renderJianghuPage();probeClassPKRobotImages();});}
window.onload=async function(){
  /* ---- v127: 立即隐藏教师端的审批状态按钮 ---- */
  if(typeof currentUser!=='undefined'&&currentUser&&currentUser.type!=='student'){
    var btn=document.getElementById('snackStatusBtn');
    if(btn)btn.style.display='none';
  }
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

// ========== 排行榜滚动公告系统 ==========
(function() {
  'use strict';

  // 记录已播报的班级，使用localStorage持久化（每个账户每班级1小时冷却）
  var _announcementQueue = [];

  // 获取当前班级的排行榜前三名
  function getTopThree(type) {
    if (!classesData || !classesData.length) return [];

    // 仅取当前班级的学生
    var currentClass = null;
    for (var i = 0; i < classesData.length; i++) {
      if (classesData[i].id === currentClassId) { currentClass = classesData[i]; break; }
    }
    if (!currentClass || !currentClass.students) return [];

    var allStudents = [];
    currentClass.students.forEach(function(stu) {
      allStudents.push({ name: stu.name, student: stu });
    });
    if (allStudents.length === 0) return [];

    if (type === 'growth') {
      allStudents.forEach(function(item) {
        var totalGrowth = 0;
        if (item.student.pets && item.student.pets.length) {
          item.student.pets.forEach(function(p) { totalGrowth += (p.growth || 0); });
        }
        item.value = totalGrowth;
      });
    } else if (type === 'quiz') {
      allStudents.forEach(function(item) {
        var qs = item.student.quizState || {};
        item.value = qs.totalQuizCoins || 0;
      });
    } else if (type === 'pigrun') {
      allStudents.forEach(function(item) {
        var qs = item.student.quizState || {};
        item.value = qs.pigRunTotalScore || 0;
      });
    } else if (type === 'match3') {
      allStudents.forEach(function(item) {
        var qs = item.student.quizState || {};
        item.value = qs.match3TotalScore || 0;
      });
    } else if (type === 'happyrun') {
      allStudents.forEach(function(item) {
        var qs = item.student.quizState || {};
        item.value = qs.happyRunTotalSilver || qs.happyRunTotalScore || 0;
      });
    }

    allStudents.sort(function(a, b) { return b.value - a.value; });
    return allStudents.slice(0, 3);
  }

  // 滚动显示一条公告
  function showAnnouncement(text, callback) {
    var banner = document.getElementById('rankAnnouncementBanner');
    var textEl = document.getElementById('rankAnnouncementText');
    if (!banner || !textEl) { if (callback) callback(); return; }

    banner.classList.add('show');
    textEl.textContent = text;
    var duration = Math.max(8, text.length / 8);
    textEl.style.animationDuration = duration + 's';
    textEl.style.animation = 'none';
    textEl.offsetHeight;
    textEl.style.animation = '';
    setTimeout(function() { if (callback) callback(); }, duration * 1000 + 200);
  }

  // 显示下一条公告
  function showNextAnnouncement(announceClassId) {
    if (_announcementQueue.length === 0) {
      var banner = document.getElementById('rankAnnouncementBanner');
      if (banner) banner.classList.remove('show');
      // 记录播报时间到localStorage，1小时内不再重复
      try {
        var storageKey = _getAnnounceStorageKey(announceClassId);
        localStorage.setItem(storageKey, String(Date.now()));
      } catch(e) {}
      return;
    }
    var text = _announcementQueue.shift();
    showAnnouncement(text, function() {
      setTimeout(function() { showNextAnnouncement(announceClassId); }, 300);
    });
  }

  // 每个账户每个班级至少间隔1小时才滚动公告一次
  var ANNOUNCE_COOLDOWN_MS = 60 * 60 * 1000; // 1小时

  function _getAnnounceStorageKey(classId) {
    var userId = 'anon';
    try {
      if (typeof currentUser !== 'undefined' && currentUser) {
        userId = currentUser.id || currentUser.name || 'anon';
      }
    } catch(e) {}
    return 'm3_announce_' + userId + '_' + classId;
  }

  // 启动排行榜公告（指定班级）
  window.showRankAnnouncement = function(targetClassId) {
    var classId = targetClassId || currentClassId;

    // 检查localStorage中的上次播报时间，间隔不足1小时则跳过
    try {
      var storageKey = _getAnnounceStorageKey(classId);
      var lastTime = parseInt(localStorage.getItem(storageKey)) || 0;
      var now = Date.now();
      if (now - lastTime < ANNOUNCE_COOLDOWN_MS) return;
    } catch(e) {}

    if (!classesData || !classesData.length) return;

    _announcementQueue = [];

    var growthTop = getTopThree('growth');
    if (growthTop.length > 0) {
      var t = '🐾 宠物成长值前三名：';
      growthTop.forEach(function(item, idx) { t += (idx + 1) + '.' + item.name + ' '; });
      _announcementQueue.push(t);
    }

    var quizTop = getTopThree('quiz');
    if (quizTop.length > 0) {
      var t2 = '📝 每日一练前三名：';
      quizTop.forEach(function(item, idx) { t2 += (idx + 1) + '.' + item.name + ' '; });
      _announcementQueue.push(t2);
    }

    var pigrunTop = getTopThree('pigrun');
    if (pigrunTop.length > 0) {
      var t3 = '🐷 小猪快跑前三名：';
      pigrunTop.forEach(function(item, idx) { t3 += (idx + 1) + '.' + item.name + ' '; });
      _announcementQueue.push(t3);
    }

    var match3Top = getTopThree('match3');
    if (match3Top.length > 0) {
      var t4 = '🧩 宠物消消乐前三名：';
      match3Top.forEach(function(item, idx) { t4 += (idx + 1) + '.' + item.name + ' '; });
      _announcementQueue.push(t4);
    }

    var happyrunTop = getTopThree('happyrun');
    if (happyrunTop.length > 0) {
      var t5 = '🏃 快乐跑前三名：';
      happyrunTop.forEach(function(item, idx) { t5 += (idx + 1) + '.' + item.name + ' '; });
      _announcementQueue.push(t5);
    }

    if (_announcementQueue.length > 0) {
      showNextAnnouncement(classId);
    } else {
      // 没有数据也记录时间戳，避免重复触发
      try {
        var storageKey = _getAnnounceStorageKey(classId);
        localStorage.setItem(storageKey, String(Date.now()));
      } catch(e) {}
    }
  };

  // 重置公告状态（用于测试）
  window.resetRankAnnouncement = function() {
    _announcementQueue = [];
    var banner = document.getElementById('rankAnnouncementBanner');
    if (banner) banner.classList.remove('show');
  };
})();
// ========== 排行榜滚动公告系统结束 ==========

// ========== 图书馆系统 ==========
(function() {
  'use strict';

  // 书籍列表配置 - 从阿里云OSS加载PDF
  var BOOKS_REPO = 'https://mhxdwwa.oss-cn-shenzhen.aliyuncs.com/books';
  
  // 书籍列表（直接配置，无需API）
  var BOOKS_LIST = [
    { name: '七年级上册数学课本', file: '七年级上册数学课本.pdf', size: '5.1MB' },
    { name: '七年级下册数学课本', file: '七年级下册数学课本.pdf', size: '13MB' },
    { name: '八年级上册数学课本', file: '八年级上册数学课本.pdf', size: '4.0MB' },
    { name: '八年级下册数学课本', file: '八年级下册数学课本.pdf', size: '4.4MB' }
  ];
  
  // 渲染图书馆页面
  window.renderLibraryPage = function() {
    var container = document.getElementById('libraryContent');
    if (!container) return;
    
    if (BOOKS_LIST.length === 0) {
      showEmptyLibrary();
      return;
    }
    
    renderBookGrid(BOOKS_LIST);
  };
  
  function showEmptyLibrary() {
    var container = document.getElementById('libraryContent');
    if (!container) return;
    
    container.innerHTML = '<div style="text-align:center;padding:60px 20px;">' +
      '<div style="font-size:64px;margin-bottom:20px;">📖</div>' +
      '<div style="color:#999;font-size:18px;margin-bottom:10px;">图书馆暂时空置</div>' +
      '<div style="color:#bbb;font-size:14px;">请稍后再来，或者联系老师添加书籍</div>' +
      '</div>';
  }
  
  function renderBookGrid(books) {
    var container = document.getElementById('libraryContent');
    if (!container) return;
    
    var html = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:20px;padding:10px;">';
    
    books.forEach(function(book) {
      var bookUrl = BOOKS_REPO + '/' + encodeURIComponent(book.file);
      var coverUrl = BOOKS_REPO + '/covers/' + encodeURIComponent(book.name) + '.jpg';
      // PDF查看器链接 - 点击书籍在线查看而非下载
      var viewerUrl = 'pdf-viewer.html?url=' + encodeURIComponent(bookUrl) + '&name=' + encodeURIComponent(book.name);
      
      html += '<div style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.08);transition:transform 0.2s,box-shadow 0.2s;">' +
        '<div style="width:100%;height:240px;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden;cursor:pointer;" ' +
        'onclick="window.location.href=\'' + viewerUrl + '\'">' +
        '<img src="' + coverUrl + '" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'">' +
        '<div style="display:none;flex-direction:column;align-items:center;justify-content:center;color:#fff;text-align:center;padding:20px;">' +
        '<div style="font-size:48px;margin-bottom:10px;">📕</div>' +
        '<div style="font-size:14px;font-weight:600;line-height:1.4;">' + book.name + '</div>' +
        '</div>' +
        '</div>' +
        '<div style="padding:12px;text-align:center;">' +
        '<div style="font-size:14px;font-weight:600;color:#333;line-height:1.3;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + book.name + '</div>' +
        '<div style="font-size:11px;color:#999;margin-top:4px;">' + book.size + '</div>' +
        '<div style="display:flex;gap:8px;margin-top:8px;justify-content:center;">' +
        '<a href="' + viewerUrl + '" style="font-size:12px;color:#667eea;text-decoration:none;padding:4px 10px;background:#f0f4ff;border-radius:12px;">查看</a>' +
        '<a href="' + bookUrl + '" download style="font-size:12px;color:#764ba2;text-decoration:none;padding:4px 10px;background:#f8f0ff;border-radius:12px;">下载</a>' +
        '</div>' +
        '</div>' +
        '</div>';
    });
    
    html += '</div>';
    container.innerHTML = html;
  }
})();
// ========== 图书馆系统结束 ==========

