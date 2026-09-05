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
    if (f & _RF_TOP3) { if(typeof renderClassTopThree==='function') renderClassTopThree(); }
    if (f & _RF_PK) { if(typeof renderPKPage==='function') renderPKPage(); }
    if (f & _RF_CLASSLIST) renderClassList();
    if (f & _RF_JH) { if(typeof renderJianghuPage==='function') renderJianghuPage(); }
  });
}
function scheduleAllRenders() {
  // 始终渲染当前可见页面 + 成长榜（数据共享）
  scheduleRender(_RF_GRID | _RF_TOP3);
  // v159: 始终调度 PK 和江湖行页面重渲染（资格判断依赖 operationLogs，任何金币变更都可能影响资格）
  scheduleRender(_RF_PK | _RF_JH);
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
function triggerRealtimeSync(changeType) {
  if (typeof _syncToSupabase !== 'function') return;
  if (_pauseSync) return; // v127: 关键操作期间暂停同步
  // v141: API 模式下，金币和宠物操作已通过 API 原子写入，跳过旧的全量同步避免覆盖
  if (window.USE_API && (changeType === 'coins' || changeType === 'pet')) return;
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
  // v141: API 模式 — 通过服务端 API 修改金币，避免并发冲突
  if (window.USE_API && window.ApiMigration) {
    // 异步调用 API，但先乐观更新本地数据（保持 UI 响应）
    var before = student.coins || 0;
    student.coins = before + delta;
    if (student.coins < 0) student.coins = 0;
    // v156: 不再调用 recordAction — 服务端 /api/coins 已写入日志
    // 之前客户端+服务端各写一条，合并后出现重复记录
    // v159: 写入乐观本地日志，使PK/江湖行资格立即生效（DAL合并时自动去重）
    _recordOptimisticLog(student.id, student.name, actionType, details, delta, expDelta || 0, petId);
    
    // 异步调用 API 更新数据库
    window.ApiMigration.changeStudentCoins(student, delta, actionType, details, expDelta, petId, extra)
      .then(function(result) {
        if (result.ok) {
          // API 成功，用服务端数据校正本地
          student.coins = result.coinsAfter;
          // v145: 更新基准值，防止智能刷新误判
          if (typeof _myBaseCoins !== 'undefined') _myBaseCoins = result.coinsAfter;
        } else if (result.error === 'Insufficient balance') {
          // 余额不足，回滚本地数据
          student.coins = before;
        } else if (result.error) {
          // API 失败，回滚到旧方式（直接写 Supabase）
          console.warn('[API] coins failed, falling back to direct Supabase:', result.error);
          // 本地数据已更新，触发同步
          if (typeof triggerRealtimeSync === 'function') triggerRealtimeSync();
        }
      });
    
    return student.coins;
  }
  
  // 旧方式：直接修改本地数据，通过 _syncToSupabase 同步
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
// v159: API模式下写入乐观本地日志，使PK/江湖行资格立即生效（不触发服务端同步）
// 标记 _apiOptimistic:true，DAL合并服务器日志时会自动去重
function _recordOptimisticLog(studentId, studentName, actionType, details, coinDelta, expDelta, petId) {
  if (coinDelta === 0 && expDelta === 0) return;
  var log = {
    id: _genLocalId(), timestamp: new Date().toISOString(),
    classId: currentClassId, studentId: studentId, studentName: studentName,
    actionType: actionType, details: details,
    coinDelta: coinDelta, expDelta: expDelta, petId: petId || null,
    extra: null, snapshot: null, reverted: false,
    _synced: true, _apiOptimistic: true
  };
  window.operationLogs.push(log);
  try { localStorage.setItem('operationLogs', JSON.stringify(window.operationLogs)); } catch(e) {}
}
function recordResetAction(classId, className, fullSnapshot){ const log = { id: _genLocalId(), timestamp: new Date().toISOString(), classId: classId, studentId: classId, studentName: className, actionType: "重置班级宠物", details: `重置班级【${className}】所有宠物数据（${fullSnapshot.length}名学生）`, fullSnapshot: JSON.parse(JSON.stringify(fullSnapshot)), coinDelta: 0, expDelta: 0, reverted: false, _synced: false }; window.operationLogs.push(log); saveLogs(); }
function _recalcPetLevel(pet){ const cfg = PET_CONFIG[pet.name]; if(cfg){ let newLevel = 1; for(let i=cfg.stages.length-1;i>=0;i--) if(pet.growth>=cfg.stages[i].growthRequired){ newLevel=cfg.stages[i].stage; break; } pet.level = newLevel; } }
function _revertStudentLog(curClass, log){ const student = curClass.students.find(s=>s.id.toString()===log.studentId.toString()); if(!student) return; let pet = null; if(log.petId && student.pets) pet = student.pets.find(p=>p.id===log.petId); if(!pet && student.pets.length>0) pet = getActivePet(student); if(log.coinDelta !== 0){ student.coins -= log.coinDelta; if(student.coins < 0) student.coins = 0; } if(log.expDelta !== 0 && pet){ pet.growth -= log.expDelta; if(pet.growth < 0) pet.growth = 0; _recalcPetLevel(pet); } if(log.extra && log.extra.causedDeath && pet){ pet.isDead = false; pet.deathGrowth = undefined; delete pet.deathDate; pet.penaltyStreak = 0; if(log.extra.starvation && log.extra.petSnapshot){ const snap=log.extra.petSnapshot; pet.level=snap.level; pet.growth=snap.growth; pet.lastFeedDate=snap.lastFeedDate; pet.todayFeedCount=snap.todayFeedCount||0; pet.todayPlayCount=snap.todayPlayCount||0; pet.lastPlayDate=snap.lastPlayDate; pet.penaltyStreak=snap.penaltyStreak||0; } else if(log.extra.prevGrowth !== undefined){ pet.growth = log.extra.prevGrowth; _recalcPetLevel(pet); } } if(log.extra && log.extra.shopItemId){ const itemId=log.extra.shopItemId; if(student.shopItems){ const idx=student.shopItems.indexOf(itemId); if(idx!==-1) student.shopItems.splice(idx,1); } if(typeof unequipItem==='function') unequipItem(student, itemId); } }
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
  // v151: API 模式下同步恢复的数据到服务器
  if(window.USE_API&&window.ApiMigration){
    if(window.ApiMigration.saveQuizState){
      window.ApiMigration.saveQuizState(student.id, student.coins, student.quizState ? JSON.stringify(student.quizState) : null);
    }
    if(pet && window.ApiMigration.updatePet){
      window.ApiMigration.updatePet(pet.id, {growth: pet.growth, level: pet.level, is_dead: pet.isDead||false});
    }
  }
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
    // v151: API 模式下通过 resetClass 恢复（重新加载数据即可，因为 fullSnapshot 是完整快照）
    // 更稳妥的做法是逐个学生同步，但 resetClass 会清空所有数据
    // 这里用 saveQuizState 同步每个学生的关键数据
    if(window.USE_API&&window.ApiMigration){
      curClass.students.forEach(function(stu){
        if(window.ApiMigration.saveQuizState){
          window.ApiMigration.saveQuizState(stu.id, stu.coins, stu.quizState ? JSON.stringify(stu.quizState) : null);
        }
      });
    }
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
    // v151: API 模式下同步 PK 撤销到服务器
    if(window.USE_API&&window.ApiMigration&&window.ApiMigration.revertLog){
      var pkReverseDelta = -(log.coinDelta || 0);
      var pkPetUpdates = [];
      if(log.petId && log.snapshot && log.snapshot.growthBefore !== undefined){
        pkPetUpdates.push({ petId: log.petId, updates: { growth: log.snapshot.growthBefore } });
      }
      window.ApiMigration.revertLog({
        classId: currentClassId, logId: log.id, reverted: true,
        coinDelta: pkReverseDelta, studentId: log.studentId, petUpdates: pkPetUpdates
      });
      // 对手方也需要撤销
      if(opponent){
        var oppReverseDelta = -(log.extra.opponentCoinDelta || 0);
        var oppPetUpdates = [];
        if(opponentPetId && log.extra.opponentGrowthDelta){
          oppPetUpdates.push({ petId: opponentPetId, updates: { growth: (opponent.pets||[]).find(function(p){return p.id===opponentPetId;}) ? (opponent.pets.find(function(p){return p.id===opponentPetId;}).growth + log.extra.opponentGrowthDelta) : 0 } });
        }
        window.ApiMigration.revertLog({
          classId: currentClassId, logId: pairLog ? pairLog.id : log.id, reverted: true,
          coinDelta: oppReverseDelta, studentId: opponentId, petUpdates: oppPetUpdates
        });
      }
    }
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
    // v149: API 模式下通过 API 恢复宠物
    if(window.USE_API&&window.ApiMigration&&window.ApiMigration.upsertPet){
      var petForApi = restoredPet;
      window.ApiMigration.upsertPet({
        id: petForApi.id, student_id: student.id, name: petForApi.name, nickname: petForApi.nickname,
        level: petForApi.level, growth: petForApi.growth||0, is_dead: petForApi.isDead||false,
        last_feed_date: petForApi.lastFeedDate, today_feed_count: petForApi.todayFeedCount||0,
        last_play_date: petForApi.lastPlayDate, today_play_count: petForApi.todayPlayCount||0,
        penalty_streak: petForApi.penaltyStreak||0, is_active: log.extra.wasActivePet||false
      }).then(function(r){
        if(!r.ok) console.warn('[v149] API restorePet error:', r.error);
        else console.log('[v149] API restorePet ok:', petForApi.id);
      });
    } else if(typeof db !== 'undefined' && db){
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
  // v149: API 模式下同步撤销操作到服务器
  if(window.USE_API&&window.ApiMigration&&window.ApiMigration.revertLog){
    var reverseDelta = -(log.coinDelta || 0);
    var petUpdates = [];
    if(log.petId && log.snapshot && log.snapshot.growthBefore !== undefined){
      petUpdates.push({ petId: log.petId, updates: { growth: log.snapshot.growthBefore } });
    }
    window.ApiMigration.revertLog({
      classId: currentClassId, logId: log.id, reverted: true,
      coinDelta: reverseDelta, studentId: log.studentId, petUpdates: petUpdates
    });
  }
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


function showModal(title,content,actions=[],large=false,extraClass=''){const c=document.getElementById('modalContainer'),m=document.createElement('div');m.className='modal-overlay';const modalClass=extraClass?extraClass:(large?'large':'');m.innerHTML=`<div class="modal ${modalClass}"><div class="modal-title">${esc(title)}</div><div class="modal-content">${content}</div><div class="modal-actions">${actions.map(a=>`<button class="btn ${a.class||'btn-primary'}" ${a.disabled?'disabled':''} onclick="playClickSound(); ${a.onclick}">${esc(a.text)}</button>`).join('')}</div></div>`;c.appendChild(m);m.addEventListener('click',(e)=>{if(e.target===m)closeModal();});return m;}
function closeModal(){const c=document.getElementById('modalContainer');while(c.firstChild)c.removeChild(c.firstChild);currentModalStudentId=null; if(typeof stopAllHeartEmitters==='function') stopAllHeartEmitters(); if(typeof cleanupPetModalEffects==='function') cleanupPetModalEffects(); }
function saveClassData(changeType, detail){safeLSSave('classPetData', classesData); scheduleFileSave(); triggerRealtimeSync(changeType); if(changeType && typeof _broadcastChange === 'function'){ _broadcastChange(changeType, detail); }}
function saveDeletedClasses(){safeLSSave('deletedClasses', deletedClasses); scheduleFileSave();}
function showDeletedClassesModal(){if(deletedClasses.length===0){showModal('🗑️ 已删除班级','<div style="text-align:center;padding:20px;">暂无已删除的班级</div>',[{text:'关闭',onclick:'closeModal()'}],false);return;}let html='<div style="max-height:400px;overflow:auto;">';[...deletedClasses].reverse().forEach((cls,i)=>{const time=new Date(cls.deletedAt).toLocaleString();const stuCount=cls.students?cls.students.length:0;const petCount=cls.students?cls.students.reduce((s,stu)=>s+(stu.pets?.length||0),0):0;html+=`<div class="history-log-item"><div><div class="history-log-time">${time} 删除</div><div><strong>${esc(cls.name)}</strong></div><div style="font-size:12px;">👨‍🎓 ${stuCount}名学生 · 🐕 ${petCount}只宠物</div></div><div style="display:flex;gap:6px;"><button class="btn btn-primary" style="padding:6px 12px;" onclick="restoreClass('${cls.id}');closeModal();">恢复</button><button class="btn btn-danger" style="padding:6px 12px;" onclick="permanentDeleteClass('${cls.id}');closeModal();">彻底删除</button></div></div>`;});html+='</div>';showModal('🗑️ 已删除班级',html,[{text:'关闭',onclick:'closeModal()'}],true);}
function restoreClass(id){var numId=parseInt(id);var idx=deletedClasses.findIndex(c=>c.id==numId||c.id==id);if(idx===-1){showNotification('恢复失败','未找到该班级数据','error');return;}const cls=deletedClasses[idx];const restored={id:_genLocalId(),name:cls.name,teacher_id:(typeof currentUser!=='undefined'&&currentUser)?currentUser.id:null,students:JSON.parse(JSON.stringify(cls.students)),createdAt:new Date().toISOString()};restored.students.forEach(function(stu){var oldStuId=stu.id;stu.id=_genLocalId();var petIdMap={};(stu.pets||[]).forEach(function(pet){var oldPetId=pet.id;pet.id=_genLocalId();petIdMap[oldPetId]=pet.id;});if(stu.activePetId&&petIdMap[stu.activePetId]){stu.activePetId=petIdMap[stu.activePetId];}else if(stu.activePetId){stu.activePetId=null;}});classesData.push(restored);deletedClasses.splice(idx,1);window._quizStateLocallyModified=true;setTimeout(function(){window._quizStateLocallyModified=false;},15000);saveClassData();saveDeletedClasses();currentClassId=restored.id;renderClassList();scheduleAllRenders();showNotification('恢复成功',`班级【${cls.name}】已恢复，含${restored.students.length}名学生`,'success');if(window.USE_API&&window.ApiMigration){window.ApiMigration.manageClass('create',{name:cls.name,teacherId:restored.teacher_id}).then(function(r){if(r.ok&&r.classId){restored.id=r.classId;renderClassList();restored.students.forEach(function(stu){window.ApiMigration.manageStudent('add',{classId:r.classId,name:stu.name,password:stu.password||'',coins:stu.coins!==undefined?stu.coins:50,xiandan:stu.xiandan||0}).then(function(sr){if(sr.ok&&sr.student&&sr.student.id){stu.id=sr.student.id;var updates={};if(stu.coins!==undefined)updates.coins=stu.coins;if(stu.xiandan)updates.xiandan=stu.xiandan;if(stu.shop_items&&stu.shop_items.length>0)updates.shop_items=stu.shop_items;if(stu.equipped_items&&Object.keys(stu.equipped_items).length>0)updates.equipped_items=stu.equipped_items;if(stu.quiz_state)updates.quiz_state=stu.quiz_state;if(stu.active_pet_id)updates.active_pet_id=stu.active_pet_id;if(Object.keys(updates).length>0){window.ApiMigration.updateStudent(stu.id,updates);}if(stu.pets&&stu.pets.length>0){stu.pets.forEach(function(pet){var petData={student_id:stu.id,name:pet.name,nickname:pet.nickname||'',level:pet.level||1,growth:pet.growth||0,is_active:pet.id===stu.activePetId,is_dead:pet.isDead||false,last_feed_date:pet.lastFeedDate||null,last_play_date:pet.lastPlayDate||null,today_feed_count:pet.todayFeedCount||0,today_play_count:pet.todayPlayCount||0,penalty_streak:pet.penaltyStreak||0};window.ApiMigration.insertPet(stu.id,petData).then(function(pr){if(pr.ok&&pr.pet&&pr.pet.id){var localPet=stu.pets.find(function(p){return p.name===pet.name&&p.level===pet.level;});if(localPet){localPet.id=pr.pet.id;if(pet.id===stu.activePetId){stu.activePetId=pr.pet.id;window.ApiMigration.updateStudent(stu.id,{active_pet_id:pr.pet.id});}saveClassData('pet');}}});});}}});});}else if(!r.ok)console.warn('[API] restoreClass create error:',r.error);});}}
function permanentDeleteClass(id){if(!confirm('彻底删除后将无法恢复，确定？'))return;var numId=parseInt(id);var idx=deletedClasses.findIndex(c=>c.id==numId||c.id==id);if(idx!==-1){const name=deletedClasses[idx].name;deletedClasses.splice(idx,1);saveDeletedClasses();showNotification('已彻底删除',`班级【${name}】已永久删除`,'info');showDeletedClassesModal();
  // v149: API 模式
  if(window.USE_API&&window.ApiMigration&&window.ApiMigration.manageClass){
    var _doApiDel=function(targetId){
      window.ApiMigration.manageClass('delete',{classId:targetId}).then(function(r){
        if(r.ok) console.log('[v149] API permanentDeleteClass ok:', targetId);
        else console.warn('[v149] API permanentDeleteClass error:', r.error);
      });
    };
    if(typeof _isValidInt4Id==='function'&&_isValidInt4Id(numId)){
      _doApiDel(numId);
    } else if(typeof currentUser!=='undefined'&&currentUser){
      window.ApiMigration.checkClassDuplicate(name).then(function(r){
        if(r.exists&&r.existingClass&&r.existingClass.teacher_id===currentUser.id){
          _doApiDel(r.existingClass.id);
        } else {
          console.warn('[v149] permanentDeleteClass: class not found by name:', name);
        }
      });
    }
    return;
  }
  // 非 API 模式
  if(typeof db!=='undefined'&&db&&typeof currentUser!=='undefined'&&currentUser){(async()=>{try{var targetId=null;if(typeof _isValidInt4Id==='function'&&_isValidInt4Id(numId)){targetId=numId;}else{var r=await db.from('classes').select('id').eq('teacher_id',currentUser.id).eq('name',name).limit(1);if(r.data&&r.data.length>0){targetId=r.data[0].id;}}if(targetId){const stuR=await db.from('students').select('id').eq('class_id',targetId);const studentIds=(stuR.data||[]).map(s=>s.id);if(studentIds.length>0){await db.from('pets').delete().in('student_id',studentIds);await db.from('students').delete().in('id',studentIds);}await db.from('custom_actions').delete().eq('class_id',targetId);await db.from('classes').delete().eq('id',targetId);}else{console.warn('[DAL] permanentDeleteClass: class not found');}}catch(e){console.warn('[DAL] permanentDeleteClass error:',e);}})();}}}
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
  html += '• <b>重置全部</b>：彻底清除该班级所有学生数据（宠物、金币、仙丹、装备特效、所有游戏进度），学生数据完全恢复到初始状态<br>';
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
      html += '<button onclick="closeModal();currentClassId=\'' + cls.id + '\';clearPetData();" style="flex:1;padding:10px;border:none;border-radius:10px;background:linear-gradient(135deg,#ff9800,#f57c00);color:#fff;font-size:13px;font-weight:600;cursor:pointer;box-shadow:0 2px 8px rgba(255,152,0,0.3);transition:transform 0.2s;" onmouseenter="this.style.transform=\'scale(1.02)\'" onmouseleave="this.style.transform=\'scale(1)\'">🔄 重置全部</button>';
      html += '<button onclick="closeModal();deleteClass(\'' + cls.id + '\');" style="flex:1;padding:10px;border:none;border-radius:10px;background:linear-gradient(135deg,#ef5350,#d32f2f);color:#fff;font-size:13px;font-weight:600;cursor:pointer;box-shadow:0 2px 8px rgba(239,83,80,0.3);transition:transform 0.2s;" onmouseenter="this.style.transform=\'scale(1.02)\'" onmouseleave="this.style.transform=\'scale(1)\'">🗑️ 删除班级</button>';
      html += '</div></div>';
    });
  }
  html += '</div>';
  showModal('⚙️ 班级数据管理', html, [{text:'关闭',onclick:'closeModal()'}], true);
}
function renderClassList(){ const c=document.getElementById('classListContainer'); if(!c){console.warn('[DAL] renderClassList: classListContainer not found');return;} const hiddenIds=getHiddenClassIds(); const visibleClasses=classesData.filter(cls=>!hiddenIds.includes(String(cls.id))); if(visibleClasses.length===0){c.innerHTML='<div style="text-align:center;padding:20px;">'+(classesData.length===0?'暂无班级，点击新建':'所有班级已隐藏<br><span style="font-size:12px;color:#999;">点击"隐藏班级"可显示</span>')+'</div>';return;} c.innerHTML=''; visibleClasses.forEach((cls,idx)=>{const card=document.createElement('div');card.className=`class-card ${currentClassId===cls.id?'active':''}`;card.draggable=true;card.dataset.classIdx=idx;card.innerHTML=`<button class="delete-class-btn" onclick="event.stopPropagation(); deleteClass('${cls.id}')">×</button><div class="class-name">${esc(cls.name)}</div><div style="display:flex;gap:15px;"><div>👨‍🎓 ${cls.students.length}</div><div>🐕 ${cls.students.reduce((s,stu)=>s+(stu.pets?.length||0),0)}</div></div>`;card.onclick=()=>{selectClass(cls.id);};card.addEventListener('dragstart',classDragStart);card.addEventListener('dragend',classDragEnd);card.addEventListener('dragover',classDragOver);card.addEventListener('dragleave',classDragLeave);card.addEventListener('drop',classDrop);c.appendChild(card);}); _updateSnackRequestBadge();}
function _updateSnackRequestBadge(){const badge=document.getElementById('snackRequestBadge');if(!badge)return;if(typeof getPendingSnackRequestCount!=='function')return;const count=getPendingSnackRequestCount();if(count>0){badge.style.display='inline-block';badge.textContent=count;}else{badge.style.display='none';}}
let classDragIdx=null;
function classDragStart(e){classDragIdx=+this.dataset.classIdx;this.classList.add('dragging');e.dataTransfer.effectAllowed='move';}
function classDragEnd(e){this.classList.remove('dragging');classDragIdx=null;document.querySelectorAll('.class-card.drag-over').forEach(el=>el.classList.remove('drag-over'));}
function classDragOver(e){e.preventDefault();e.dataTransfer.dropEffect='move';if(+this.dataset.classIdx!==classDragIdx)this.classList.add('drag-over');}
function classDragLeave(e){this.classList.remove('drag-over');}
function classDrop(e){e.preventDefault();this.classList.remove('drag-over');const toIdx=+this.dataset.classIdx;if(classDragIdx===null||classDragIdx===toIdx)return;const moved=classesData.splice(classDragIdx,1)[0];classesData.splice(toIdx,0,moved);saveClassData();renderClassList();}
function selectClass(id){currentClassId=id;renderClassList();scheduleAllRenders();showNotification('班级切换','已切换','info');/* v130: 按需加载 rank-announcement */if(typeof loadModule==='function'){loadModule('rank-announcement').then(function(){if(typeof showRankAnnouncement==='function'){setTimeout(function(){showRankAnnouncement(id);},800);}});}else{if(typeof showRankAnnouncement==='function'){setTimeout(function(){showRankAnnouncement(id);},800);}}if(typeof _updateSnackStatusBadge==='function'){setTimeout(_updateSnackStatusBadge,100);}}
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
  // v149: API 模式下通过 API 查重
  if(window.USE_API&&window.ApiMigration&&window.ApiMigration.checkClassDuplicate){
    window.ApiMigration.checkClassDuplicate(v.value).then(function(r){
      if(r.exists){
        var existingClass=r.existingClass;
        if(existingClass&&existingClass.teacher_id===currentUser.id){
          showNotification('创建失败','你已经有同名班级「'+v.value+'」，请使用不同的名称','error');
        }else{
          showNotification('创建失败','系统中已存在班级「'+v.value+'」，为避免数据混乱，请使用不同的班级名称','error');
        }
        return;
      }
      // 没有同名班级，通过 API 创建
      var teacherId=(typeof currentUser!=='undefined'&&currentUser)?currentUser.id:null;
      window.ApiMigration.manageClass('create',{name:v.value,teacherId:teacherId}).then(function(cr){
        if(cr.ok){
          var newId=cr.classId||Date.now().toString();
          classesData.push({id:newId,name:v.value,students:[]});
          saveClassData();renderClassList();selectClass(classesData[classesData.length-1].id);
        }else{
          showNotification('创建失败',cr.error||'未知错误','error');
        }
      });
    }).catch(function(){
      // API 失败时回退到本地创建
      classesData.push({id:Date.now().toString(),name:v.value,students:[]});
      saveClassData();renderClassList();selectClass(classesData[classesData.length-1].id);
    });
    return;
  }
  // 非 API 模式：直接查 Supabase
  if(typeof db!=='undefined'&&db){
    db.from('classes').select('id,name,teacher_id').eq('name',v.value).limit(1).then(function(r){
      if(r.error){console.error('[创建班级] 查询失败:',r.error.message);showNotification('创建失败','数据库查询错误，请重试','error');return;}
      if(r.data&&r.data.length>0){
        const existingClass=r.data[0];
        if(existingClass.teacher_id===currentUser.id){
          showNotification('创建失败','你已经有同名班级「'+v.value+'」，请使用不同的名称','error');
        }else{
          showNotification('创建失败','系统中已存在班级「'+v.value+'」，为避免数据混乱，请使用不同的班级名称','error');
        }
        return;
      }
      classesData.push({id:Date.now().toString(),name:v.value,students:[]});
      saveClassData();renderClassList();selectClass(classesData[classesData.length-1].id);
    });
  }else{
    if(classesData.some(c=>c.name===v.value)){showNotification('创建失败','本地已有同名班级','error');return;}
    classesData.push({id:Date.now().toString(),name:v.value,students:[]});
    saveClassData();renderClassList();selectClass(classesData[classesData.length-1].id);
  }
}
function deleteClass(id){if(_isOnCooldown('deleteClass')){showNotification('操作太快','请等待'+_cooldownRemaining('deleteClass')+'秒后再试','warning');return;}if(!confirm('确定删除该班级？删除后可在"已删除班级"中恢复'))return;_startCooldown('deleteClass',5);var cls=classesData.find(function(c){return c.id===id||c.id==id;});var _className=cls?cls.name:'';if(cls){var snapshot={id:cls.id,name:cls.name,students:JSON.parse(JSON.stringify(cls.students)),deletedAt:new Date().toISOString()};deletedClasses.push(snapshot);if(deletedClasses.length>20)deletedClasses.shift();saveDeletedClasses();}classesData=classesData.filter(function(c){return c.id!==id&&c.id!=id;});if(currentClassId===id||currentClassId==id)currentClassId=classesData[0]?.id||null;if(typeof customActions!=='undefined'){customActions=customActions.filter(function(a){return a.class_id!=id;});}renderClassList();scheduleAllRenders();showNotification('班级已删除','可在"已删除班级"中恢复','info');_pauseSync=true;var _waitAndDel=function(){if(typeof _dalSyncing!=='undefined'&&_dalSyncing){setTimeout(_waitAndDel,300);return;}safeLSSave('classPetData',classesData);scheduleFileSave();if(typeof _supabaseDeleteClass==='function'){_supabaseDeleteClass(id,_className).then(function(){_pauseSync=false;saveClassData();}).catch(function(e){console.warn('[DAL] deleteClass Supabase error:',e);_pauseSync=false;saveClassData();});return;}_pauseSync=false;saveClassData();};_waitAndDel();}
// v127: 从 Supabase 彻底删除班级及其所有关联数据
// v149: API 模式下通过 /api/class/manage 删除
function _supabaseDeleteClass(classId, className){
  // v149: API 模式
  if(window.USE_API&&window.ApiMigration&&window.ApiMigration.manageClass){
    // 尝试获取 Supabase 中的班级 ID
    var targetId = null;
    if(typeof _isValidInt4Id === 'function' && _isValidInt4Id(classId)){
      targetId = classId;
      return window.ApiMigration.manageClass('delete',{classId:targetId}).then(function(r){
        if(!r.ok) console.warn('[v149] API deleteClass error:', r.error);
        else console.log('[v149] API deleteClass ok:', targetId);
      });
    } else if(className && typeof currentUser !== 'undefined' && currentUser){
      // 需要通过名称查找 classId — 使用 checkDuplicate 接口间接查找
      return window.ApiMigration.checkClassDuplicate(className).then(function(r){
        if(r.exists && r.existingClass && r.existingClass.teacher_id === currentUser.id){
          targetId = r.existingClass.id;
          return window.ApiMigration.manageClass('delete',{classId:targetId}).then(function(r2){
            if(!r2.ok) console.warn('[v149] API deleteClass error:', r2.error);
            else console.log('[v149] API deleteClass ok:', targetId);
          });
        } else {
          console.log('[v149] API deleteClass: class not found by name:', className);
        }
      });
    }
    return Promise.resolve();
  }
  // 非 API 模式：直接操作 Supabase
  if(typeof db === 'undefined' || !db || typeof currentUser === 'undefined' || !currentUser){
    console.log('[v127] _supabaseDeleteClass: no Supabase connection, skipping');
    return Promise.resolve();
  }
  return (async function(){
    var targetId = null;
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
    var stuR = await db.from('students').select('id').eq('class_id', targetId);
    var studentIds = (stuR.data || []).map(function(s){ return s.id; });
    if(studentIds.length > 0){
      var petDel = await db.from('pets').delete().in('student_id', studentIds);
      if(petDel.error) console.warn('[v127] pets delete error:', petDel.error);
      var stuDel = await db.from('students').delete().in('id', studentIds);
      if(stuDel.error) console.warn('[v127] students delete error:', stuDel.error);
    }
    var caDel = await db.from('custom_actions').delete().eq('class_id', targetId);
    if(caDel.error) console.warn('[v127] custom_actions delete error:', caDel.error);
    var clsDel = await db.from('classes').delete().eq('id', targetId);
    if(clsDel.error) console.warn('[v127] classes delete error:', clsDel.error);
    console.log('[v127] _supabaseDeleteClass: done for class', targetId);
  })();
}
function importFromTxt(){document.getElementById('txtImport').click();}
document.getElementById('txtImport').addEventListener('change',function(e){if(!currentClassId){showNotification('请先选择班级','','error');return;}const file=e.target.files[0];if(!file)return;const reader=new FileReader();reader.onload=function(ev){const text=ev.target.result;const rawNames=text.split(/\r?\n/).filter(n=>n.trim());const cur=classesData.find(c=>c.id===currentClassId);var added=0,skipped=0;var newNames=[];rawNames.forEach(function(raw){var name=_validateStudentName(raw);if(!name){skipped++;return;}if(cur.students.find(function(s){return s.name===name;})){skipped++;return;}cur.students.push({id:_genLocalId(),name:name,coins:50,pets:[],lastCheckinDate:null,activePetId:null,pkCountToday:0,lastPkDate:null});added++;newNames.push(name);});saveClassData();if(window.USE_API&&window.ApiMigration&&newNames.length>0){newNames.forEach(function(nm){window.ApiMigration.manageStudent('add',{classId:currentClassId,name:nm}).then(function(r){if(!r.ok)console.warn('[API] importFromTxt addStudent error:',r.error);});});}scheduleAllRenders();var msg='添加'+added+'人';if(skipped>0)msg+='，跳过'+skipped+'人（重复或超长）';showNotification('导入完成',msg,'success');};reader.readAsText(file);this.value='';});
function classDailyCheckin(){ if(typeof currentUser!=='undefined'&&currentUser&&currentUser.type==='student'){showNotification('权限不足','此操作仅限教师','error');return;} if(!currentClassId){showNotification('请先选择班级','请在左侧选择一个班级后再打卡','warning');return;} if(checkPauseAndNotify())return; const cur=classesData.find(c=>c.id===currentClassId); if(!cur){showNotification('班级数据异常','未找到当前班级数据','error');return;} if(!cur.students||cur.students.length===0){showNotification('暂无学生','请先添加学生','warning');return;} let checkedCount=0; let skipNoPet=0; cur.students.forEach(s=>{if(!s.pets||s.pets.length===0){skipNoPet++;return;} if(_hasCheckedInToday(s)){return;} s.lastCheckinDate=new Date().toISOString();changeStudentCoins(s, 10, '全班打卡', '+10金币', 0, null);if(window.USE_API&&window.ApiMigration){window.ApiMigration.updateStudent(s.id,{last_checkin_date:s.lastCheckinDate});}checkedCount++;}); if(checkedCount===0){let reason='全班同学今天都已经打过卡了'; if(skipNoPet>0) reason+=`（${skipNoPet}人未领养宠物，不参与打卡）`; showNotification('今日已打卡',reason,'info');return;} saveClassData('coins'); renderHomePetGrid(); if(currentModalStudentId) refreshCurrentStudentModal(); let msg=`${checkedCount}人打卡成功，每人+10金币`; if(skipNoPet>0) msg+=`（${skipNoPet}人未领养宠物，已跳过）`; showNotification('全班打卡',msg,'success'); }
function classAllFeed(){ if(typeof currentUser!=='undefined'&&currentUser&&currentUser.type==='student'){showNotification('权限不足','此操作仅限教师','error');return;} if(!currentClassId){showNotification('请先选择班级','请在左侧选择一个班级后再喂食','warning');return;} if(checkPauseAndNotify())return; const cur=classesData.find(c=>c.id===currentClassId); if(!cur){showNotification('班级数据异常','未找到当前班级数据','error');return;} if(!cur.students||cur.students.length===0){showNotification('暂无学生','请先添加学生','warning');return;} let fedCount=0,skipDead=0,skipCoins=0,skipMax=0,skipNoPet=0,skipFed=0; const upgrades=[]; cur.students.forEach(s=>{const pet=getGrowablePet(s); if(!pet && (!s.pets||s.pets.length===0)){skipNoPet++;return;} if(!pet && s.pets.every(p=>p.level>=9)){skipMax++;return;} if(!pet && s.pets.every(p=>p.isDead)){skipDead++;return;} if(!pet){skipMax++;return;} if(_hasFedToday(pet)){skipFed++;return;} if(s.coins<5){skipCoins++;return;} let gain=2; pet.growth+=gain; pet.lastFeedDate=new Date().toISOString(); const upResult=updatePetLevel(s, pet.id, gain, true); if(upResult) upgrades.push(upResult); if(window.USE_API&&window.ApiMigration){s.coins -= 5; window.ApiMigration.coinsAndPet(s,-5,[{petId:pet.id,updates:{growth:pet.growth,last_feed_date:pet.lastFeedDate,level:pet.level}}],{actionType:'全班喂食',details:pet.nickname||pet.name+' +'+gain+'成长值',expDelta:gain,petId:pet.id}).then(function(r){if(r.ok)s.coins=r.coinsAfter;}); _recordOptimisticLog(s.id, s.name, '全班喂食', pet.nickname||pet.name+' +'+gain+'成长值', -5, gain, pet.id);}else{changeStudentCoins(s, -5, '全班喂食', `${pet.nickname||pet.name} +${gain}成长值`, gain, pet.id);} fedCount++;}); if(fedCount===0){let reason=''; if(skipFed>0)reason+=`${skipFed}人今天已喂食 `; if(skipDead>0)reason+=`${skipDead}人宠物已死亡 `; if(skipCoins>0)reason+=`${skipCoins}人金币不足 `; if(skipMax>0)reason+=`${skipMax}人全部满级 `; if(skipNoPet>0)reason+=`${skipNoPet}人未领养宠物`; showNotification('无法喂食',reason||'没有可喂食的宠物','info');return;} saveClassData('pet'); scheduleAllRenders(); if(currentModalStudentId) refreshCurrentStudentModal(); let msg=`${fedCount}只宠物喂食成功，每只+2成长值，-5金币`; if(skipFed+skipDead+skipCoins+skipMax+skipNoPet>0){let skips=[]; if(skipFed>0)skips.push(`${skipFed}人今天已喂食`); if(skipDead>0)skips.push(`${skipDead}人宠物已死亡`); if(skipCoins>0)skips.push(`${skipCoins}人金币不足`); if(skipMax>0)skips.push(`${skipMax}人全部满级`); if(skipNoPet>0)skips.push(`${skipNoPet}人未领养宠物`); msg+=`（跳过：${skips.join('、')}）`;} showNotification('全班喂食',msg,'success'); showBatchUpgradeNotice(upgrades); }
function showBatchUpgradeNotice(upgrades){ if(!upgrades||upgrades.length===0) return; const INTERVAL=4500; const MAX_INDIVIDUAL=3; function showOne(idx){ if(idx>=upgrades.length) return; const u=upgrades[idx]; showUpgradeEffect(u.petRealName, u.newLevel, u.cfgId, u.petName, u.oldLevel, u.studentName); setTimeout(()=>{ showNotification('🎉 宠物升级',`恭喜 ${u.studentName} 同学的 ${u.petName} 进化为${u.stageName}！`,'success'); },300); if(idx+1<upgrades.length){ setTimeout(()=>{ const container=document.getElementById('upgradeEffectContainer'); if(container){const overlays=container.querySelectorAll('.upgrade-overlay'); overlays.forEach(o=>o.remove());} showOne(idx+1); }, INTERVAL); } } if(upgrades.length<=MAX_INDIVIDUAL){ if(upgrades.length>1){ showNotification('🎉 升级预告',`本次共有 ${upgrades.length} 位同学的宠物升级，逐一展示！`,'success'); setTimeout(()=>showOne(0), 800); } else { showOne(0); } } else { showBatchUpgradeBoard(upgrades); } } function showBatchUpgradeBoard(upgrades){ const container=document.getElementById('upgradeEffectContainer'); const overlay=document.createElement('div'); overlay.className='upgrade-overlay'; overlay.style.cssText='position:fixed;top:0;left:0;right:0;bottom:0;z-index:100000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.7);backdrop-filter:blur(4px);animation:fadeIn 0.5s ease;'; const listHtml=upgrades.map((u,i)=>{ const cfg=PET_CONFIG[Object.keys(PET_CONFIG).find(k=>PET_CONFIG[k].id===u.cfgId)]; const emoji=cfg?cfg.emoji:'🐾'; const imgSrc=_img(`${u.cfgId}/${u.newLevel}.webp`); return `<div style="display:flex;align-items:center;gap:12px;padding:10px 18px;background:rgba(255,255,255,0.08);border-radius:14px;border:1px solid rgba(255,255,255,0.15);animation:fadeIn 0.5s ease ${i*0.08}s both;"><div style="width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg,#ffe0b2,#ffcc80);display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden;"><img src="${imgSrc}" style="width:40px;height:40px;object-fit:contain;" onerror="this.onerror=null;this.parentNode.innerHTML='<span style=\\'font-size:28px;\\'>${emoji}</span>';"></div><div style="flex:1;min-width:0;"><div style="font-size:16px;font-weight:700;color:#fff;">${esc(u.studentName)}</div><div style="font-size:13px;color:rgba(255,255,255,0.7);margin-top:2px;">${esc(u.petName)} → ${esc(u.stageName)}</div></div><div style="font-size:22px;">🎉</div></div>`; }).join(''); overlay.innerHTML=` <div style="background:linear-gradient(160deg,#1a1a2e 0%,#16213e 50%,#0f3460 100%);border-radius:28px;padding:35px 30px;max-width:520px;width:90%;max-height:80vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,0.5),inset 0 1px 0 rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.1);position:relative;overflow:hidden;"> <div style="position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,#e8637a,#f5a054,#ffd700,#e8637a);background-size:200% 100%;animation:shimmer 2s linear infinite;"></div> <div style="text-align:center;margin-bottom:20px;"> <div style="font-size:36px;margin-bottom:6px;">🏆✨🎊</div> <div style="font-size:24px;font-weight:800;color:#ffd700;text-shadow:0 0 20px rgba(255,215,0,0.4);">集体进化大成功！</div> <div style="font-size:15px;color:rgba(255,255,255,0.7);margin-top:6px;">恭喜以下 <strong style="color:#ff9800;font-size:18px;">${upgrades.length}</strong> 位同学的宠物升级</div> </div> <div style="flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:8px;padding-right:5px;min-height:0;"> ${listHtml} </div> <div style="text-align:center;margin-top:18px;padding-top:15px;border-top:1px solid rgba(255,255,255,0.1);"> <button onclick="this.closest('.upgrade-overlay').remove();" style="padding:10px 36px;border:none;border-radius:20px;background:linear-gradient(135deg,#e8637a,#f5a054);color:#fff;font-size:15px;font-weight:600;cursor:pointer;box-shadow:0 4px 15px rgba(232,99,122,0.4);transition:transform 0.2s;">太棒了！为他们鼓掌 👏</button> </div> </div>`; container.appendChild(overlay); overlay.addEventListener('click',(e)=>{if(e.target===overlay)overlay.remove();}); setTimeout(()=>{if(overlay.parentNode)overlay.remove();},15000); playUpgradeSound(); }
// v128: 重置班级宠物 — 先同步清除本地数据（让同步管道读到空数据），再异步清理 Supabase
function clearPetData(){
  if(!currentClassId){
    showNotification('请先选择班级', '', 'warning');
    return;
  }
  if(!confirm('确定重置当前班级所有学生数据？\n\n将清除以下内容：\n• 所有宠物、宠物特效、宠物姓名\n• 金币、仙丹货币\n• 已购买的装备特效\n• 所有游戏进度（取金阁、小猪快跑、消消乐、快乐跑一跑）\n• PK记录、打卡记录\n\n学生数据将完全恢复到初始状态。\n\n此操作不可撤销！')) return;
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
    // 步骤2: 同步已完成，清除本地数据（完全重置所有学生数据）
    cur.students.forEach(function(s){
      // 宠物相关
      s.pets = [];
      s.coins = 50;
      s.lastCheckinDate = null;
      s.activePetId = null;
      s.pkCountToday = 0;
      s.lastPkDate = null;
      
      // 仙丹货币
      s.xiandan = 0;
      
      // 装备特效
      s.equippedItems = {};
      
      // 已购买的道具特效（商店物品）
      s.shopItems = [];
      
      // 所有游戏进度（取金阁、小猪快跑、消消乐、快乐跑一跑等）
      s.quizState = {
        lastQuizDate: '',
        todayCoins: 0,
        questionsToday: [],
        totalQuestions: 0,
        started: false,
        totalQuizCoins: 0,
        
        // 小猪快跑
        pigRunLevels: {},
        pigRunTotalScore: 0,
        pigRunTools: { remove: 1, shuffle: 1, rotate: 1 },
        
        // 消消乐
        match3Levels: {},
        match3TotalScore: 0,
        match3Tools: { shuffle: 1, undo: 1 },
        
        // 快乐跑一跑
        happyRunMaxLevel: 1,
        happyRunLevels: {},
        happyRunLevelBestCoins: {},
        happyRunTotalSilver: 0,
        happyRunSilverBalance: 0,
        happyRunPetGold: 0,
        happyRunOwnedChars: [0],
        happyRunBossKillBonus: {},
        happyRunTotalScore: 0
      };
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
        showNotification('重置完成', '班级【' + className + '】所有学生数据已完全重置', 'success');
      }).catch(function(err){
        _pauseSync = false;
        saveClassData();
        console.warn('[v129] _supabaseClearPets error:', err);
        showNotification('重置完成', '本地已清空，云端清理失败请重试', 'warning');
      });
    } else {
      _pauseSync = false;
      saveClassData();
        showNotification('重置完成', '班级【' + className + '】所有学生数据已完全重置', 'success');
    }
  };
  _waitAndClear();
}
// v127: 从 Supabase 彻底删除班级所有宠物数据
// v149: API 模式下通过 /api/class/reset 重置
function _supabaseClearPets(cls){
  // v149: API 模式
  if(window.USE_API&&window.ApiMigration&&window.ApiMigration.resetClass){
    var classId = cls.id;
    if(typeof _isValidInt4Id === 'function' && _isValidInt4Id(classId)){
      return window.ApiMigration.resetClass(classId).then(function(r){
        if(!r.ok) throw new Error(r.error || 'API reset failed');
        console.log('[v149] API class reset ok:', classId);
      });
    }
    // classId 不是有效 INT4，需要查找 — 尝试通过 checkClassDuplicate
    if(typeof currentUser !== 'undefined' && currentUser){
      return window.ApiMigration.checkClassDuplicate(cls.name).then(function(r){
        if(r.exists && r.existingClass && r.existingClass.teacher_id === currentUser.id){
          return window.ApiMigration.resetClass(r.existingClass.id).then(function(r2){
            if(!r2.ok) throw new Error(r2.error || 'API reset failed');
          });
        }
        throw new Error('班级在云端未找到');
      });
    }
    return Promise.reject(new Error('无法确定班级 ID'));
  }
  // 非 API 模式：直接操作 Supabase
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
    var targetId = null;
    if(typeof _isValidInt4Id === 'function' && _isValidInt4Id(classId)){
      targetId = classId;
    } else {
      var r = await db.from('classes').select('id').eq('teacher_id', currentUser.id).eq('name', cls.name).limit(1);
      if(r.error) throw new Error('查询班级失败: ' + r.error.message);
      if(r.data && r.data.length > 0) targetId = r.data[0].id;
      else throw new Error('班级在云端未找到，可能尚未同步');
    }
    if(!targetId) throw new Error('无法确定班级 ID');
    var stuR = await db.from('students').select('id').eq('class_id', targetId);
    if(stuR.error) throw new Error('查询学生失败: ' + stuR.error.message);
    var studentIds = (stuR.data || []).map(function(s){ return s.id; });
    if(studentIds.length > 0){
      var petDel = await db.from('pets').delete().in('student_id', studentIds);
      if(petDel.error) throw new Error('删除宠物失败: ' + petDel.error.message);
      var stuUpdate = await db.from('students').update({ 
        coins: 50, xiandan: 0, equipped_items: {}, shop_items: [],
        quiz_state: {
          lastQuizDate: '', todayCoins: 0, questionsToday: [], totalQuestions: 0, started: false, totalQuizCoins: 0,
          pigRunLevels: {}, pigRunTotalScore: 0, pigRunTools: { remove: 1, shuffle: 1, rotate: 1 },
          match3Levels: {}, match3TotalScore: 0, match3Tools: { shuffle: 1, undo: 1 },
          happyRunMaxLevel: 1, happyRunLevels: {}, happyRunLevelBestCoins: {},
          happyRunTotalSilver: 0, happyRunSilverBalance: 0, happyRunPetGold: 0,
          happyRunOwnedChars: [0], happyRunBossKillBonus: {}, happyRunTotalScore: 0
        }
      }).eq('class_id', targetId);
      if(stuUpdate.error) throw new Error('重置学生数据失败: ' + stuUpdate.error.message);
    }
    var caDel = await db.from('custom_actions').delete().eq('class_id', targetId);
    if(caDel.error) throw new Error('删除操作记录失败: ' + caDel.error.message);
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
    // v147: API 模式 — 同步 active_pet_id 到服务器
    if (window.USE_API && window.ApiMigration) {
      window.ApiMigration.updateStudent(student.id, { active_pet_id: student.activePetId });
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
  // v147: API 模式 — 通过服务端 API 删除
  if (window.USE_API && window.ApiMigration) {
    window.ApiMigration.deletePet(petId).then(function(result) {
      if (result.ok) {
        console.log('[DAL] deletePet API OK: pet', petId, 'student', studentId);
      } else {
        console.warn('[DAL] deletePet API error:', result.error);
      }
    });
    return;
  }
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
  // v149: API 模式下通过 API 恢复宠物
  if(window.USE_API&&window.ApiMigration&&window.ApiMigration.upsertPet){
    window.ApiMigration.upsertPet({
      id: restoredPet.id, student_id: student.id, name: restoredPet.name, nickname: restoredPet.nickname,
      level: restoredPet.level, growth: restoredPet.growth||0, is_dead: restoredPet.isDead||false,
      last_feed_date: restoredPet.lastFeedDate, today_feed_count: restoredPet.todayFeedCount||0,
      last_play_date: restoredPet.lastPlayDate, today_play_count: restoredPet.todayPlayCount||0,
      penalty_streak: restoredPet.penaltyStreak||0, is_active: true
    }).then(function(r){
      if(!r.ok) console.warn('[v149] API restoreDeletedPet error:', r.error);
      else console.log('[v149] API restoreDeletedPet ok:', restoredPet.id);
    });
  } else if(typeof db !== 'undefined' && db){
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
    html += '<span style="font-size:12px;color:#999;">💰' + (stu.coins || 0) + ' 🟠' + (stu.xiandan || 0) + '</span>';
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

  // v149: API 模式
  if (window.USE_API && window.ApiMigration && window.ApiMigration.manageStudent) {
    window.ApiMigration.manageStudent('resetPassword', { studentIds: [stu.id], password: '' }).then(function(r) {
      if (r.ok) {
        saveClassData();
        showNotification('重置成功', '学生「' + stu.name + '」的密码已重置，下次登录时可设置新密码', 'success');
        closeResetPasswordModal();
      } else {
        console.error('[重置密码] API 失败:', r.error);
        showNotification('重置失败', r.error || '未知错误', 'error');
      }
    }).catch(function(err) {
      console.error('[重置密码] API 请求失败:', err);
      showNotification('重置失败', err.message || '网络错误', 'error');
    });
    return;
  }

  // 非 API 模式：直接写 Supabase
  if (typeof db !== 'undefined' && db) {
    db.from('students').update({ password: '' }).eq('id', stu.id).then(function(r) {
      if (r.error) {
        console.error('[重置密码] 保存失败:', r.error.message);
        showNotification('重置失败', r.error.message, 'error');
        return;
      }
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
function adoptNewPet(student, petName, nickname){ const cfg = PET_CONFIG[petName]; if(!cfg) return false; if(student.pets.length>0 && student.pets.some(p=>p.level<9 && !p.isDead)){showNotification('无法领养','还有未满级的存活宠物，需要全部满级后才能领养新宠物','warning');return false;} const localId = _genLocalId(); const newPet = { id: localId, name: petName, nickname, level: 1, growth: 0, lastFeedDate: new Date().toISOString(), todayFeedCount: 0, isDead: false, todayPlayCount: 0, lastPlayDate: null, penaltyStreak: 0 }; student.pets.push(newPet); student.activePetId = localId; saveClassData('pet');if(window.USE_API&&window.ApiMigration){window.ApiMigration.insertPet(student.id,{name:petName,nickname:nickname,level:1,growth:0,is_active:true}).then(function(result){if(result.ok&&result.pet&&result.pet.id){var localPet=student.pets.find(function(p){return p.id===localId;});if(localPet){localPet.id=result.pet.id;student.activePetId=result.pet.id;saveClassData('pet');scheduleAllRenders();}}});} scheduleAllRenders(); showNotification('领养成功',`${nickname} 加入宠物大家庭，现已激活！`,'success'); return true; }
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
  
  // v141: API 模式 — 同时更新金币和宠物
  if (window.USE_API && window.ApiMigration) {
    var prevGrowth = pet.growth;
    var prevCoins = student.coins;
    
    // 乐观更新本地数据
    pet.growth += gain;
    pet.lastFeedDate = new Date().toISOString();
    pet.isDead = false;
    updatePetLevel(student, pet.id, gain);
    student.coins = prevCoins - 5;
    if (student.coins < 0) student.coins = 0;
    // v156: 不再调用 recordAction — 服务端 coinsAndPet 已写入日志
    
    // 异步调用 API
    window.ApiMigration.coinsAndPet(student, -5, [{
      petId: pet.id,
      updates: {
        growth: pet.growth,
        level: pet.level,
        last_feed_date: pet.lastFeedDate,
        is_dead: false
      }
    }], {
      actionType: '喂食',
      details: `${pet.nickname||pet.name} +${gain}成长值`,
      expDelta: gain,
      petId: pet.id,
      checkBalance: true
    }).then(function(result) {
      if (result.ok) {
        student.coins = result.coinsAfter;
        console.log('[API] feedPet ok');
      } else {
        // 回滚
        pet.growth = prevGrowth;
        student.coins = prevCoins;
        console.warn('[API] feedPet failed:', result.error);
      }
    });
    
    showNotification('喂食成功',`${pet.nickname||pet.name} 获得 ${gain} 成长值！`,'success');
    return true;
  }
  
  // 旧方式
   pet.growth+=gain; pet.lastFeedDate=new Date().toISOString(); pet.isDead=false;
   updatePetLevel(student, pet.id, gain);
   changeStudentCoins(student, -5, '喂食', `${pet.nickname||pet.name} +${gain}成长值`, gain, pet.id);
  showNotification('喂食成功',`${pet.nickname||pet.name} 获得 ${gain} 成长值！`,'success');
  return true;
}
function updatePetLevel(student, petId, growthDelta=0, silent=false) { const pet = student.pets.find(p=>p.id===petId); if(!pet) return false; const cfg = PET_CONFIG[pet.name]; if(!cfg) return false; let oldLevel = pet.level; let newLevel = 1; for(let i=cfg.stages.length-1;i>=0;i--) if(pet.growth>=cfg.stages[i].growthRequired){ newLevel=cfg.stages[i].stage; break; } if(pet.growth < 0) pet.growth = 0; const _maxGrowth = cfg.stages[cfg.stages.length-1].growthRequired; if(newLevel >= 9 && pet.growth > _maxGrowth){ pet.growth = _maxGrowth; } if(newLevel !== oldLevel){ const wasUpgrade = newLevel > oldLevel; pet.level = newLevel; if(newLevel >= 9){ pet.growth = Math.min(pet.growth, _maxGrowth); } const stageName = cfg.stages[newLevel-1]?.stageName||`阶段${newLevel}`; if(wasUpgrade && !silent){ showUpgradeEffect(pet.name, newLevel, cfg.id, pet.nickname||pet.name, oldLevel, student.name); showNotification('宠物升级',`🎉 恭喜 ${student.name} 同学的 ${pet.nickname||pet.name} 升到${stageName}！`,'success'); } if(!silent){ scheduleAllRenders(); if(currentModalStudentId && student.id.toString()===currentModalStudentId.toString()) refreshCurrentStudentModal(); } return {studentName:student.name, petName:pet.nickname||pet.name, petRealName:pet.name, newLevel:newLevel, oldLevel:oldLevel, stageName:stageName, cfgId:cfg.id, isUpgrade:wasUpgrade}; } return false; }
function getStudentShopEffects(student){
  const owned=student.shopItems||[];if(owned.length===0)return{borderClasses:[],topHtml:'',baseHtml:'',particleHtml:'',titleHtml:'',sceneClass:''};
  if(typeof getEquippedItems!=='function'||typeof getShopItemById!=='function')return{borderClasses:[],topHtml:'',baseHtml:'',particleHtml:'',titleHtml:'',sceneClass:''};
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
  if (!p) return s.id + '_nopet_' + (s.coins||0) + '_' + (s.xiandan||0);
  return s.id + '_' + (s.coins||0) + '_' + (s.xiandan||0) + '_' + (p.id||'') + '_' + (p.growth||0) + '_' + (p.level||0) + '_' + (p.isDead?'d':'a') + '_' + (p.lastFeedDate||'') + '_' + (s.pets?s.pets.length:0);
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
  return `<div class="${cardClass}" data-sid="${s.id}" data-hash="${_studentDataHash(s)}" onclick="openStudentModal('${s.id}')">${fx.topHtml}<div class="${innerClass}">${fx.particleHtml}${p.level<2?`<button class="change-pet-btn" onclick="event.stopPropagation();showChangePetModal('${s.id}')">🔄</button>`:''}${s.pets.length>1?`<button class="switch-pet-btn" onclick="event.stopPropagation();showSwitchPetModal('${s.id}')">🔀 切换</button>`:''}<div class="home-pet-top${fx.sceneClass?' '+fx.sceneClass:''}"><div style="position:relative;width:100%;height:100%;display:flex;align-items:center;justify-content:center;">${fx.baseHtml}${getPetImage(p.name, p.level||1).replace('<img ', `<img style="${petImgStyle}" ${petImgAttr} `)}${p.isDead?'<div class="dead-pet-overlay">💀</div>':''}${escapeHint}</div></div><div class="home-pet-level-badge">${isPetMax?'👑 MAX':'Lv.'+(p.level||1)}</div>${multiBadge}${fx.titleHtml}<div class="home-pet-middle">${esc(s.name)}·${esc(p.nickname||p.name)}<span class="rename-pet-btn" onclick="event.stopPropagation();renamePet('${s.id}','${p.id}')" title="修改宠物名字">✏️</span></div><div class="home-pet-bottom"><div class="home-pet-bottom-row"><span class="pet-bottom-growth">成长:${p.level>=9?need:(p.growth||0)}/${need}</span><span class="pet-bottom-coins">💰${s.coins||0} 🟠${s.xiandan||0}</span></div><div class="feed-warning">${timeTip}</div>${growHint}</div></div></div>`;
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
  /* v135: 宠物增强模块已改为首屏加载，无需按需加载 */
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
function updatePetDeathStatus(student){if(!student.pets||student.pets.length===0)return; if(isPauseActive())return; student.pets.forEach(pet=>{if(pet.isDead)return; if(pet.level>=9)return; if(isPetStarved(pet)){const prevGrowth=pet.growth;const prevLevel=pet.level;pet.isDead=true; pet.deathGrowth=pet.growth; pet.deathDate=new Date().toISOString();recordAction(student.id, student.name, '饿死', `${pet.nickname||pet.name} 因超过70天未喂食而饿死（Lv.${prevLevel}，成长值${prevGrowth}）`, 0, 0, pet.id, {causedDeath:true, prevGrowth:prevGrowth, prevLevel:prevLevel, starvation:true, petSnapshot:{name:pet.name,nickname:pet.nickname,level:prevLevel,growth:prevGrowth,lastFeedDate:pet.lastFeedDate,todayFeedCount:pet.todayFeedCount||0,todayPlayCount:pet.todayPlayCount||0,lastPlayDate:pet.lastPlayDate,penaltyStreak:pet.penaltyStreak||0}}); if(window.USE_API&&window.ApiMigration){window.ApiMigration.updatePet(pet.id,{is_dead:true,death_date:pet.deathDate,death_growth:pet.deathGrowth});} }});}
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
      <div class="stat-item"><span class="stat-label">🟠 仙丹</span><span class="stat-value" style="color:#6a1b9a;">${student.xiandan||0}</span></div>
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
      <div class="stat-item"><span class="stat-label">🟠 仙丹</span><span class="stat-value" style="color:#6a1b9a;">${student.xiandan||0}</span></div>
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
    let content = '<div style="text-align:center;"><div style="font-size:60px;">🥚</div><p>尚未领养宠物</p><p>💰 '+student.coins+' 金币 🟠 '+(student.xiandan||0)+' 仙丹</p></div>';
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
    if(petImgEl) { if(typeof initPetModalEnhancements!=='function'){loadModule('pet-modal').then(function(){initPetModalEnhancements(petImgEl, activePet.name, activePet.level||1, activePet.growth||0, getExpNeeded(activePet));});}else{initPetModalEnhancements(petImgEl, activePet.name, activePet.level||1, activePet.growth||0, getExpNeeded(activePet));} }
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
  if(typeof cleanupPetModalEffects==='function') cleanupPetModalEffects();
  // v18: Robust check — is current user a student viewing ANOTHER student's pet?
  const isStudentView = typeof currentUser !== 'undefined' && currentUser && currentUser.type === 'student';
  const _mySid = isStudentView ? (currentUser.studentId || localStorage.getItem('studentId') || '') : '';
  const myStudentId = _mySid ? (isNaN(parseInt(_mySid)) ? _mySid : parseInt(_mySid)) : null;
  const isViewingOtherStudent = isStudentView && myStudentId !== null && String(student.id) !== String(myStudentId);
  const contentBuilder = isViewingOtherStudent ? buildReadOnlyStudentModalContent : buildStudentModalContent;
  modalDiv.querySelector('.modal-content').innerHTML = contentBuilder(student, activePet); 
  setTimeout(()=>{ startHeartForCurrentPet(currentModalStudentId);
    const petImgEl = document.querySelector('.modal-pet-img[data-pet-img-container]');
    if(petImgEl) { if(typeof initPetModalEnhancements!=='function'){loadModule('pet-modal').then(function(){initPetModalEnhancements(petImgEl, activePet.name, activePet.level||1, activePet.growth||0, getExpNeeded(activePet));});}else{initPetModalEnhancements(petImgEl, activePet.name, activePet.level||1, activePet.growth||0, getExpNeeded(activePet));} }
   }, 60);
}
function ensurePetPlayFields(pet){ if(pet.todayPlayCount===undefined) pet.todayPlayCount=0; if(pet.lastPlayDate===undefined) pet.lastPlayDate=null; if(pet.penaltyStreak===undefined) pet.penaltyStreak=0; return pet; }
function getCurrentStageName(petName,level){const cfg=PET_CONFIG[petName];if(!cfg)return"未知";const s=cfg.stages.find(s=>s.stage===level);return s?s.stageName:`阶段${level}`;}
function playWithPet(student,pet){
  if(pet.isDead){ showNotification('玩耍失败','宠物已经死亡，请先复活','error'); return false; }
  if(student.coins<20){ showNotification('金币不足','玩耍需要20金币','error'); return false; }
  if(pet.level >= 9){ showNotification('已达万物之神','无法继续成长，可以领养新宠物','warning'); return false; }
  ensurePetPlayFields(pet);
  let gain=Math.min(7+getStudentGrowthBonus(student), 13);
  
  // v141: API 模式
  if (window.USE_API && window.ApiMigration) {
    var prevGrowth = pet.growth;
    var prevCoins = student.coins;
    pet.growth+=gain; pet.lastPlayDate=new Date().toISOString();
    updatePetLevel(student, pet.id, gain);
    student.coins = prevCoins - 20;
    if (student.coins < 0) student.coins = 0;
    // v156: 不再调用 recordAction — 服务端 coinsAndPet 已写入日志
    
    window.ApiMigration.coinsAndPet(student, -20, [{
      petId: pet.id,
      updates: { growth: pet.growth, level: pet.level, last_play_date: pet.lastPlayDate }
    }], {
      actionType: '玩耍', details: `${pet.nickname||pet.name} +${gain}成长值`,
      expDelta: gain, petId: pet.id, checkBalance: true
    }).then(function(result) {
      if (result.ok) { student.coins = result.coinsAfter; }
      else { pet.growth = prevGrowth; student.coins = prevCoins; }
    });
    
    showNotification('玩耍快乐',`${pet.nickname||pet.name} 获得 ${gain} 成长值！`,'success');
    return true;
  }
  
  // 旧方式
  pet.growth+=gain; pet.lastPlayDate=new Date().toISOString();
  updatePetLevel(student, pet.id, gain);
  changeStudentCoins(student, -20, '玩耍', `${pet.nickname||pet.name} +${gain}成长值`, gain, pet.id);
  showNotification('玩耍快乐',`${pet.nickname||pet.name} 获得 ${gain} 成长值！`,'success');
  return true;
}
function walkPet(student,pet){
  if(pet.isDead){ showNotification('散步失败','宠物已经死亡，请先复活','error'); return false; }
  if(student.coins<30){ showNotification('金币不足','散步需要30金币','error'); return false; }
  if(pet.level >= 9){ showNotification('已达万物之神','无法继续成长，可以领养新宠物','warning'); return false; }
  ensurePetPlayFields(pet);
  let gain=Math.min(15+getStudentGrowthBonus(student), 24);
  
  // v141: API 模式
  if (window.USE_API && window.ApiMigration) {
    var prevGrowth = pet.growth;
    var prevCoins = student.coins;
    pet.growth+=gain;
    updatePetLevel(student, pet.id, gain);
    student.coins = prevCoins - 30;
    if (student.coins < 0) student.coins = 0;
    // v156: 不再调用 recordAction — 服务端 coinsAndPet 已写入日志
    
    window.ApiMigration.coinsAndPet(student, -30, [{
      petId: pet.id, updates: { growth: pet.growth, level: pet.level }
    }], {
      actionType: '散步', details: `${pet.nickname||pet.name} +${gain}成长值`,
      expDelta: gain, petId: pet.id, checkBalance: true
    }).then(function(result) {
      if (result.ok) { student.coins = result.coinsAfter; }
      else { pet.growth = prevGrowth; student.coins = prevCoins; }
    });
    
    showNotification('散步愉快',`${pet.nickname||pet.name} 获得 ${gain} 成长值！`,'success');
    return true;
  }
  
  // 旧方式
  pet.growth+=gain;
  updatePetLevel(student, pet.id, gain);
  changeStudentCoins(student, -30, '散步', `${pet.nickname||pet.name} +${gain}成长值`, gain, pet.id);
  showNotification('散步愉快',`${pet.nickname||pet.name} 获得 ${gain} 成长值！`,'success');
  return true;
}
function shoppingPet(student,pet){
  if(pet.isDead){ showNotification('逛街失败','宠物已经死亡，请先复活','error'); return false; }
  if(pet.level<3){ showNotification('等级不足','逛街需要Lv3以上','warning'); return false; }
  if(student.coins<50){ showNotification('金币不足','逛街需要50金币','error'); return false; }
  if(pet.level >= 9){ showNotification('已达万物之神','无法继续成长，可以领养新宠物','warning'); return false; }
  ensurePetPlayFields(pet);
  let gain=Math.min(35+getStudentGrowthBonus(student), 45);
  
  // v141: API 模式
  if (window.USE_API && window.ApiMigration) {
    var prevGrowth = pet.growth;
    var prevCoins = student.coins;
    pet.growth+=gain;
    updatePetLevel(student, pet.id, gain);
    student.coins = prevCoins - 50;
    if (student.coins < 0) student.coins = 0;
    // v156: 不再调用 recordAction — 服务端 coinsAndPet 已写入日志
    
    window.ApiMigration.coinsAndPet(student, -50, [{
      petId: pet.id, updates: { growth: pet.growth, level: pet.level }
    }], {
      actionType: '逛街', details: `${pet.nickname||pet.name} +${gain}成长值`,
      expDelta: gain, petId: pet.id, checkBalance: true
    }).then(function(result) {
      if (result.ok) { student.coins = result.coinsAfter; }
      else { pet.growth = prevGrowth; student.coins = prevCoins; }
    });
    
    showNotification('逛街开心',`${pet.nickname||pet.name} 获得 ${gain} 成长值！`,'success');
    return true;
  }
  
  // 旧方式
  pet.growth+=gain;
  updatePetLevel(student, pet.id, gain);
  changeStudentCoins(student, -50, '逛街', `${pet.nickname||pet.name} +${gain}成长值`, gain, pet.id);
  showNotification('逛街开心',`${pet.nickname||pet.name} 获得 ${gain} 成长值！`,'success');
  return true;
}
function travelPet(student,pet){
  if(pet.isDead){ showNotification('旅游失败','宠物已经死亡，请先复活','error'); return false; }
  if(pet.level<6){ showNotification('等级不足','旅游需要Lv6以上','warning'); return false; }
  if(student.coins<100){ showNotification('金币不足','旅游需要100金币','error'); return false; }
  if(pet.level >= 9){ showNotification('已达万物之神','无法继续成长，可以领养新宠物','warning'); return false; }
  ensurePetPlayFields(pet);
  let gain=Math.min(85+getStudentGrowthBonus(student), 100);
  
  // v141: API 模式
  if (window.USE_API && window.ApiMigration) {
    var prevGrowth = pet.growth;
    var prevCoins = student.coins;
    pet.growth+=gain;
    updatePetLevel(student, pet.id, gain);
    student.coins = prevCoins - 100;
    if (student.coins < 0) student.coins = 0;
    // v156: 不再调用 recordAction — 服务端 coinsAndPet 已写入日志
    
    window.ApiMigration.coinsAndPet(student, -100, [{
      petId: pet.id, updates: { growth: pet.growth, level: pet.level }
    }], {
      actionType: '旅游', details: `${pet.nickname||pet.name} +${gain}成长值`,
      expDelta: gain, petId: pet.id, checkBalance: true
    }).then(function(result) {
      if (result.ok) { student.coins = result.coinsAfter; }
      else { pet.growth = prevGrowth; student.coins = prevCoins; }
    });
    
    showNotification('旅游愉快',`${pet.nickname||pet.name} 获得 ${gain} 成长值！`,'success');
    return true;
  }
  
  // 旧方式
  pet.growth+=gain;
  updatePetLevel(student, pet.id, gain);
  changeStudentCoins(student, -100, '旅游', `${pet.nickname||pet.name} +${gain}成长值`, gain, pet.id);
  showNotification('旅游愉快',`${pet.nickname||pet.name} 获得 ${gain} 成长值！`,'success');
  return true;
}
function revivePet(student,pet){
  if(!pet.isDead) return false;
  if(student.coins<50){showNotification('金币不足','复活需要50金币','error');return false;}
  
  let deadGrowth = pet.deathGrowth !== undefined ? pet.deathGrowth : pet.growth;
  let newGrowth = Math.floor(deadGrowth * 0.5);
  let prevGrowth = pet.growth;
  let prevCoins = student.coins;
  let prevIsDead = pet.isDead;
  let prevDeathGrowth = pet.deathGrowth;
  
  // v141: API 模式
  if (window.USE_API && window.ApiMigration) {
    pet.isDead=false;
    pet.growth = newGrowth;
    pet.level = 1;
    const cfg = PET_CONFIG[pet.name];
    if(cfg){
      let newLevel = 1;
      for(let i=cfg.stages.length-1;i>=0;i--) if(pet.growth>=cfg.stages[i].growthRequired){ newLevel=cfg.stages[i].stage; break; }
      pet.level = newLevel;
    }
    pet.lastFeedDate=new Date().toISOString();
    pet.todayFeedCount=0;
    pet.todayPlayCount=0;
    pet.lastPlayDate=null;
    pet.penaltyStreak = 0;
    delete pet.deathGrowth;
    
    student.coins = prevCoins - 50;
    if (student.coins < 0) student.coins = 0;
    // v156: 不再调用 recordAction — 服务端 coinsAndPet 已写入日志
    
    window.ApiMigration.coinsAndPet(student, -50, [{
      petId: pet.id,
      updates: {
        growth: pet.growth,
        level: pet.level,
        is_dead: false,
        last_feed_date: pet.lastFeedDate,
        today_feed_count: 0,
        today_play_count: 0,
        penalty_streak: 0
      }
    }], {
      actionType: '复活', details: `${pet.nickname||pet.name} 复活`,
      expDelta: newGrowth - prevGrowth, petId: pet.id, checkBalance: true
    }).then(function(result) {
      if (result.ok) { student.coins = result.coinsAfter; }
      else {
        // 回滚
        pet.isDead = prevIsDead;
        pet.growth = prevGrowth;
        pet.deathGrowth = prevDeathGrowth;
        student.coins = prevCoins;
      }
    });
    
    showNotification('复活成功',`${pet.nickname||pet.name} 重获新生！经验保留50%`,'success');
    if(typeof renderPKPage==="function") renderPKPage();
    return true;
  }
  
  // 旧方式
  pet.isDead=false;
  pet.growth = newGrowth;
  pet.level = 1;
  const cfg = PET_CONFIG[pet.name];
  if(cfg){
    let newLevel = 1;
    for(let i=cfg.stages.length-1;i>=0;i--) if(pet.growth>=cfg.stages[i].growthRequired){ newLevel=cfg.stages[i].stage; break; }
    pet.level = newLevel;
  }
  pet.lastFeedDate=new Date().toISOString();
  pet.todayFeedCount=0;
  pet.todayPlayCount=0;
  pet.lastPlayDate=null;
  pet.penaltyStreak = 0;
  delete pet.deathGrowth;
  changeStudentCoins(student, -50, '复活', `${pet.nickname||pet.name} 复活`, newGrowth - prevGrowth, pet.id);
  showNotification('复活成功',`${pet.nickname||pet.name} 重获新生！经验保留50%`,'success');
  if(typeof renderPKPage==="function") renderPKPage();
  return true;
}
function applyAction(student, action, pet){ let coinsChange = action.coins; let isPenalty = coinsChange < 0; let expChange = 0; let prevGrowth = pet.growth; if(pet.isDead){ if(isPenalty){ showNotification('操作禁止','宠物已死亡，不能施加惩罚','error'); return false; } else { student.coins += coinsChange; if(student.coins < 0) student.coins = 0; if(pet.penaltyStreak !== undefined) pet.penaltyStreak = 0; if(!(window.USE_API&&window.ApiMigration)){recordAction(student.id, student.name, '奖惩', `${action.name} (宠物死亡)`, coinsChange, 0, pet.id);} showNotification(action.name, `+${coinsChange}金币 (宠物死亡无法获得经验)`, 'success'); if(window.USE_API&&window.ApiMigration){window.ApiMigration.coinsAndPet(student,coinsChange,[{petId:pet.id,updates:{penalty_streak:0}}],{actionType:'奖惩',details:action.name+' (宠物死亡)',expDelta:0,petId:pet.id}).then(function(r){if(r.ok)student.coins=r.coinsAfter;}); _recordOptimisticLog(student.id, student.name, '奖惩', action.name+' (宠物死亡)', coinsChange, 0, pet.id);} return true; } } if(isPenalty){ let absDeduct = Math.abs(coinsChange); let coinDeducted = Math.min(absDeduct, student.coins); let remaining = absDeduct - coinDeducted; student.coins -= coinDeducted; expChange = 0; if(remaining > 0){ expChange = -remaining; pet.growth += expChange; if(pet.growth <= 0){ pet.growth = 0; pet.isDead = true; pet.deathGrowth = prevGrowth; pet.deathDate = new Date().toISOString(); pet.penaltyStreak = 0; if(!(window.USE_API&&window.ApiMigration)){recordAction(student.id, student.name, '惩罚致死', `${action.name} 导致死亡（金币不足，经验扣至0）`, -absDeduct, -prevGrowth, pet.id, {causedDeath: true, prevGrowth: prevGrowth});} showNotification('惩罚致死',`${pet.nickname||pet.name} 金币不足，经验被扣至0，宠物死亡！`,'error'); saveClassData('coins');if(window.USE_API&&window.ApiMigration){window.ApiMigration.coinsAndPet(student,-coinDeducted,[{petId:pet.id,updates:{growth:0,is_dead:true,penalty_streak:0}}],{actionType:'惩罚致死',details:action.name,expDelta:expChange,petId:pet.id,checkBalance:true}).then(function(r){if(r.ok)student.coins=r.coinsAfter;}); _recordOptimisticLog(student.id, student.name, '惩罚致死', action.name+' 导致死亡', -coinDeducted, expChange, pet.id);} if(typeof renderPKPage==="function") renderPKPage(); return true; } updatePetLevel(student, pet.id, expChange); } let msg = `${action.name}：金币-${coinDeducted}`; if(expChange !== 0) msg += `，经验${expChange}`; if(!(window.USE_API&&window.ApiMigration)){recordAction(student.id, student.name, '奖惩', msg, -coinDeducted, expChange, pet.id);} showNotification(action.name, msg, 'warning'); } else { if(pet.penaltyStreak !== undefined) pet.penaltyStreak = 0; student.coins += coinsChange; if(student.coins < 0) student.coins = 0; let msg = `${action.name}：金币+${coinsChange}`; if(!(window.USE_API&&window.ApiMigration)){recordAction(student.id, student.name, '奖惩', msg, coinsChange, 0, pet.id);} showNotification(action.name, msg, 'success'); }
  // v141: API 模式 — 同步金币和宠物变更到 Supabase
  if (window.USE_API && window.ApiMigration) {
    var _apiPetUpdates = [{ petId: pet.id, updates: { growth: pet.growth, level: pet.level, penalty_streak: pet.penaltyStreak || 0 } }];
    if (pet.isDead && !prevGrowth) { _apiPetUpdates[0].updates.is_dead = true; }
    if (pet.isDead) { _apiPetUpdates[0].updates.growth = 0; }
    window.ApiMigration.coinsAndPet(student, coinsChange, _apiPetUpdates, {
      actionType: pet.isDead ? '惩罚致死' : '奖惩',
      details: action.name,
      expDelta: expChange,
      petId: pet.id,
      checkBalance: isPenalty
    }).then(function(r) {
      if (r.ok) { student.coins = r.coinsAfter; console.log('[API] applyAction ok'); }
      else { console.warn('[API] applyAction failed:', r.error); }
    });
    // v159: 乐观本地日志，使PK/江湖行资格立即生效（DAL合并时自动去重）
    _recordOptimisticLog(student.id, student.name, pet.isDead ? '惩罚致死' : '奖惩', action.name, coinsChange, expChange, pet.id);
  }
  return true; }
function modalFeed(){if(checkPauseAndNotify())return;if(!currentModalStudentId)return;const cur=classesData.find(c=>c.id===currentClassId);const student=cur.students.find(s=>s.id.toString()===currentModalStudentId.toString());if(!student)return;let pet=getActivePet(student);if(!pet)return;if(pet.isDead||pet.level>=9){const growable=getGrowablePet(student);if(growable){pet=growable;}else if(pet.isDead){showNotification('无法喂食','宠物已死亡，请先复活','error');return;}else{showNotification('全部满级','所有宠物都已满级，可以领养新宠物','info');return;}}feedPet(student,pet);saveClassData('pet');refreshCurrentStudentModal();scheduleAllRenders();}
function modalPlay(){if(checkPauseAndNotify())return;if(!currentModalStudentId)return;const cur=classesData.find(c=>c.id===currentClassId);const student=cur.students.find(s=>s.id.toString()===currentModalStudentId.toString());if(!student)return;let pet=getActivePet(student);if(!pet)return;if(pet.isDead||pet.level>=9){const growable=getGrowablePet(student);if(growable){pet=growable;}else if(pet.isDead){showNotification('无法玩耍','宠物已死亡，请先复活','error');return;}else{showNotification('全部满级','所有宠物都已满级，可以领养新宠物','info');return;}}playWithPet(student,pet);saveClassData('pet');refreshCurrentStudentModal();scheduleAllRenders();}
function modalWalk(){if(checkPauseAndNotify())return;if(!currentModalStudentId)return;const cur=classesData.find(c=>c.id===currentClassId);const student=cur.students.find(s=>s.id.toString()===currentModalStudentId.toString());if(!student)return;let pet=getActivePet(student);if(!pet)return;if(pet.isDead||pet.level>=9){const growable=getGrowablePet(student);if(growable){pet=growable;}else if(pet.isDead){showNotification('无法散步','宠物已死亡，请先复活','error');return;}else{showNotification('全部满级','所有宠物都已满级，可以领养新宠物','info');return;}}walkPet(student,pet);saveClassData('pet');refreshCurrentStudentModal();scheduleAllRenders();}
function modalShopping(){if(checkPauseAndNotify())return;if(!currentModalStudentId)return;const cur=classesData.find(c=>c.id===currentClassId);const student=cur.students.find(s=>s.id.toString()===currentModalStudentId.toString());if(!student)return;let pet=getActivePet(student);if(!pet)return;if(pet.isDead||pet.level>=9){const growable=getGrowablePet(student);if(growable){pet=growable;}else if(pet.isDead){showNotification('无法逛街','宠物已死亡，请先复活','error');return;}else{showNotification('全部满级','所有宠物都已满级，可以领养新宠物','info');return;}}if(pet.level<3){showNotification('等级不足','逛街需要Lv3以上','warning');return;}shoppingPet(student,pet);saveClassData('coins');refreshCurrentStudentModal();scheduleAllRenders();}
function modalTravel(){if(checkPauseAndNotify())return;if(!currentModalStudentId)return;const cur=classesData.find(c=>c.id===currentClassId);const student=cur.students.find(s=>s.id.toString()===currentModalStudentId.toString());if(!student)return;let pet=getActivePet(student);if(!pet)return;if(pet.isDead||pet.level>=9){const growable=getGrowablePet(student);if(growable){pet=growable;}else if(pet.isDead){showNotification('无法旅游','宠物已死亡，请先复活','error');return;}else{showNotification('全部满级','所有宠物都已满级，可以领养新宠物','info');return;}}if(pet.level<6){showNotification('等级不足','旅游需要Lv6以上','warning');return;}travelPet(student,pet);saveClassData('coins');refreshCurrentStudentModal();scheduleAllRenders();}
function modalRevive(){if(checkPauseAndNotify())return;if(!currentModalStudentId)return;const cur=classesData.find(c=>c.id===currentClassId);const student=cur.students.find(s=>s.id.toString()===currentModalStudentId.toString());if(!student)return;const pet=getActivePet(student);if(!pet)return;revivePet(student,pet);saveClassData('pet');refreshCurrentStudentModal();renderHomePetGrid();if(typeof renderClassTopThree==="function") renderClassTopThree();}
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
  // v156: Sync lastCheckinDate to server (was only saved locally)
  if(window.USE_API&&window.ApiMigration){
    window.ApiMigration.updateStudent(student.id, { last_checkin_date: student.lastCheckinDate });
  }
  saveClassData();
  refreshCurrentStudentModal();
  renderHomePetGrid();
  scheduleAllRenders();
  showNotification('打卡成功','每日打卡 +10金币！','success');
}
function modalApplyAction(actionId){if(checkPauseAndNotify())return;if(!currentModalStudentId)return;const cur=classesData.find(c=>c.id===currentClassId);const student=cur.students.find(s=>s.id.toString()===currentModalStudentId.toString());if(!student)return;const pet=getActivePet(student);if(!pet)return;const action=customActions.find(a=>String(a.id)===String(actionId));if(!action)return; const result = applyAction(student, action, pet); if(result){ saveClassData('coins'); refreshCurrentStudentModal(); scheduleAllRenders(); } }
function modalAdoptNew(){if(checkPauseAndNotify())return;if(!currentModalStudentId)return;const cur=classesData.find(c=>c.id===currentClassId);const student=cur.students.find(s=>s.id.toString()===currentModalStudentId.toString());if(!student)return;if(student.pets.some(p=>p.level<9 && !p.isDead)){showNotification('无法领养','还有未满级的存活宠物，需要全部满级后才能领养新宠物','warning');return;}closeModal();showAdoptModal(student.id, true);}
function showAdoptModal(studentId, fromModal=false){ if(checkPauseAndNotify())return; const cur=classesData.find(c=>c.id===currentClassId); const student=cur.students.find(s=>s.id.toString()===studentId.toString()); if(student.pets.length>0 && student.pets.some(p=>p.level<9 && !p.isDead)){showNotification('无法领养','还有未满级的存活宠物，需要全部满级后才能领养新宠物','warning');return;} let list=`<div class="pet-select-grid">`; Object.keys(PET_CONFIG).forEach(name=>{ list+=`<div class="pet-select-item" onclick="selectPetForAdopt('${name}','${studentId}')"><div class="pet-select-img">${getPetImage(name, 1)}</div><div>${name}</div></div>`; }); list+='</div>'; const modalOverlay = showModal('领养宠物', list, [{text:'取消',onclick: fromModal ? 'refreshCurrentStudentModal()' : 'closeModal()'}], true); if(modalOverlay){ const modalDiv = modalOverlay.querySelector('.modal'); if(modalDiv) modalDiv.classList.add('adopt-modal'); } }
function selectPetForAdopt(petName,studentId){selectedPetName=petName;showModal('起个昵称',`<input id="nicknameInput" value="${petName}" style="width:100%;padding:10px;border-radius:20px;">`,[{text:'取消',onclick:'showAdoptModal(\''+studentId+'\')'},{text:'确认领养',onclick:`confirmAdoptPet('${studentId}')`}]);}
function confirmAdoptPet(studentId){if(checkPauseAndNotify())return;var rawNick=document.getElementById('nicknameInput')?.value||selectedPetName;var nickname=_sanitizeInput(rawNick)||selectedPetName;if(nickname.length>15)nickname=nickname.slice(0,15);const cur=classesData.find(c=>c.id===currentClassId);const student=cur.students.find(s=>s.id.toString()===studentId.toString());if(!student)return;adoptNewPet(student, selectedPetName, nickname);closeModal();if(currentModalStudentId && currentModalStudentId===studentId) openStudentModal(studentId); else renderHomePetGrid();}

function showChangePetModal(studentId){ const cur=classesData.find(c=>c.id===currentClassId); const student=cur.students.find(s=>s.id.toString()===studentId.toString()); const activePet=getActivePet(student); if(!activePet||activePet.level>=2){showNotification('等级≥2无法更换','','error');return;} let list='<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;">'; Object.keys(PET_CONFIG).forEach(name=>{list+=`<div class="pet-select-item" style="padding:5px;" onclick="selectPetForChange('${name}','${studentId}')"><div class="pet-select-img" style="width:60px;height:60px;">${getPetImage(name,1)}</div><div>${name}</div></div>`;}); list+='</div>'; showModal('更换宠物(仅限Lv1)',list,[{text:'取消',onclick:'closeModal()'}],false); }
function selectPetForChange(petName,studentId){selectedPetName=petName;showModal('新昵称',`<input id="nicknameInput" value="${petName}">`,[{text:'取消',onclick:'showChangePetModal(\''+studentId+'\')'},{text:'确认',onclick:`confirmChangePet('${studentId}')`}]);}
function confirmChangePet(studentId){var rawNick=document.getElementById('nicknameInput')?.value||selectedPetName;var nickname=_sanitizeInput(rawNick)||selectedPetName;if(nickname.length>15)nickname=nickname.slice(0,15);const cur=classesData.find(c=>c.id===currentClassId);const student=cur.students.find(s=>s.id.toString()===studentId.toString());const activePet=getActivePet(student);if(!activePet||activePet.level>=2)return;const idx=student.pets.findIndex(p=>p.id===activePet.id);if(idx!==-1){student.pets[idx]={...activePet,name:selectedPetName,nickname:nickname,level:1,growth:activePet.growth,lastFeedDate:activePet.lastFeedDate||new Date().toISOString(),todayFeedCount:0,isDead:activePet.isDead, todayPlayCount:0, lastPlayDate:null, penaltyStreak:activePet.penaltyStreak||0};saveClassData('pet');if(window.USE_API&&window.ApiMigration){window.ApiMigration.updatePet(student.pets[idx].id,{name:selectedPetName,nickname:nickname,level:1,growth:activePet.growth,is_dead:activePet.isDead});}closeModal();scheduleAllRenders();showNotification('更换成功',`新宠物${nickname}`,'success');}}
function renamePet(studentId, petId){ const cur=classesData.find(c=>c.id===currentClassId); if(!cur) return; const student=cur.students.find(s=>s.id.toString()===studentId.toString()); if(!student) return; const pet=student.pets.find(p=>String(p.id)===String(petId)); if(!pet) return; const oldName=pet.nickname||pet.name; showModal('修改宠物名字',`<div style="text-align:center;margin-bottom:10px;font-size:14px;color:#888;">当前名字：<strong>${esc(oldName)}</strong></div><input id="renamePetInput" value="${escAttr(oldName)}" maxlength="20" style="width:100%;padding:10px 14px;border:2px solid #ffcfcf;border-radius:16px;font-size:16px;text-align:center;outline:none;box-sizing:border-box;" onfocus="this.select()" placeholder="请输入新名字">`,[{text:'取消',onclick:'closeModal()'},{text:'确认修改',onclick:`confirmRenamePet('${escJS(studentId)}','${escJS(petId)}')`}]); setTimeout(()=>{const inp=document.getElementById('renamePetInput');if(inp)inp.focus();},100); }
function confirmRenamePet(studentId, petId){ const inp=document.getElementById('renamePetInput'); if(!inp) return; var rawName=inp.value.trim(); if(!rawName){showNotification('名字不能为空','请输入一个宠物名字','warning');return;} var v=_validateInput(rawName,15,'宠物昵称'); if(!v.ok){showNotification('输入无效',v.error,'warning');return;} const cur=classesData.find(c=>c.id===currentClassId); if(!cur) return; const student=cur.students.find(s=>s.id.toString()===studentId.toString()); if(!student) return; const pet=student.pets.find(p=>String(p.id)===String(petId)); if(!pet) return; const oldName=pet.nickname||pet.name; pet.nickname=v.value; saveClassData('pet');if(window.USE_API&&window.ApiMigration){window.ApiMigration.updatePet(pet.id,{nickname:v.value});} closeModal(); scheduleAllRenders(); if(currentModalStudentId && student.id.toString()===currentModalStudentId.toString()) refreshCurrentStudentModal(); showNotification('改名成功',`${oldName} → ${v.value}`,'success'); }
function showSwitchPetModal(studentId){ const cur=classesData.find(c=>c.id===currentClassId); const student=cur.students.find(s=>s.id.toString()===studentId.toString()); if(!student||student.pets.length<=1)return; const maxed=countMaxedPets(student); let html=maxed>0?`<div style="text-align:center;margin-bottom:10px;padding:6px 16px;background:linear-gradient(135deg,#fff8e0,#fff0c0);border-radius:16px;font-size:14px;font-weight:700;color:#b8860b;">👑 ${maxed}只传说神兽 · 宠物大师</div>`:''; html+='<div style="display:flex;flex-direction:column;gap:8px;">'; student.pets.forEach(p=>{const isActive = Number(student.activePetId)===Number(p.id); const isMax=p.level>=9; const borderStyle=isMax?'2px solid #ffd700':isActive?'2px solid #ff8888':'1px solid #ffcfcf'; const bg=isMax?'linear-gradient(135deg,#fffbe6,#fff5d0)':'#fff'; const badge=isMax?'<span style="background:linear-gradient(135deg,#ffd700,#ff8c00);color:#fff;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:800;margin-left:6px;">👑 满级</span>':''; html+=`<div style="display:flex;align-items:center;gap:12px;padding:10px 14px;border:${borderStyle};border-radius:20px;cursor:pointer;background:${bg};transition:all 0.2s;" onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 4px 12px rgba(0,0,0,0.1)'" onmouseout="this.style.transform='none';this.style.boxShadow='none'" onclick="switchPet('${studentId}','${p.id}');closeModal();"><div style="width:55px;height:55px;flex-shrink:0;">${getPetImage(p.name, p.level)}</div><div style="flex:1;"><strong>${esc(p.nickname||p.name)}</strong>${badge} <span style="color:#aaa;font-size:12px;">${isActive?'⭐当前展示':''}</span><br><span style="font-size:13px;color:#888;">Lv.${p.level} · ${getCurrentStageName(p.name,p.level)} · 成长:${p.level>=9?getExpNeeded(p):p.growth}${p.isDead?' · 💀已死亡':''}</span></div></div>`;}); html+='</div><div style="margin-top:10px;text-align:center;color:#bbb;font-size:12px;">点击切换卡片展示的宠物，喂食自动作用于未满级宠物</div>'; showModal('切换展示宠物',html,[{text:'关闭',onclick:'closeModal()'}],false); }
function switchPet(studentId, petId){ const cur = classesData.find(c=>c.id===currentClassId); const student = cur.students.find(s=>s.id.toString()===studentId.toString()); if(student) setActivePet(student, Number(petId)); }
function setActivePet(student, petId){ petId = Number(petId); if(student.pets.some(p=>Number(p.id)===petId)){ student.activePetId = petId; saveClassData('pet');if(window.USE_API&&window.ApiMigration){window.ApiMigration.updatePet(petId,{is_active:true});student.pets.forEach(function(p){if(Number(p.id)!==petId){window.ApiMigration.updatePet(p.id,{is_active:false});}});} renderHomePetGrid(); if(typeof renderPKPage==="function") renderPKPage(); if(currentModalStudentId && student.id.toString()===currentModalStudentId.toString()) refreshCurrentStudentModal(); } }
function showBatchEditModal(){ if(typeof currentUser!=='undefined'&&currentUser&&currentUser.type==='student'){showNotification('权限不足','此操作仅限教师','error');return;} if(!currentClassId){ showNotification('请先选择班级','','error'); return; } const cur = classesData.find(c=>c.id===currentClassId); if(!cur || cur.students.length===0){ showNotification('班级无学生','请先添加学生','warning'); return; } let studentListHtml = '<div class="batch-checkbox-list"><div><label><input type="checkbox" id="selectAllBatch" onclick="toggleAllBatch(this.checked)"> 全选/取消全选</label></div>'; cur.students.forEach((s)=>{ studentListHtml += `<div class="batch-student-item"><input type="checkbox" class="batch-student-chk" value="${s.id}" id="stu_${s.id}"><label for="stu_${s.id}">${esc(s.name)} (💰${s.coins} 🟠${s.xiandan||0})</label></div>`; }); studentListHtml += '</div><div><label>奖惩项目: <select id="batchActionSelect">';
  customActions.forEach(act=>{ const sign = act.coins>0 ? `+${act.coins}` : `${act.coins}`; studentListHtml += `<option value="${act.id}">${esc(act.name)} (${sign}金币)</option>`; });
  studentListHtml += '</select></label><label style="margin-left:10px;"><input type="checkbox" id="batchCustomToggle" onchange="document.getElementById(\'batchCustomCoins\').style.display=this.checked?\'inline-block\':\'none\';var xt=document.getElementById(\'batchCustomXdToggle\');document.getElementById(\'batchActionSelect\').disabled=this.checked||(xt&&xt.checked);"> 自定义加金币</label><span id="batchCustomCoins" style="display:none;margin-left:8px;"><input type="number" id="batchCustomValue" style="width:70px;padding:4px 6px;border:1px solid #ccc;border-radius:8px;font-size:14px;" placeholder="金币数" value="10"> 金币</span><label style="margin-left:10px;"><input type="checkbox" id="batchCustomXdToggle" onchange="document.getElementById(\'batchCustomXd\').style.display=this.checked?\'inline-block\':\'none\';var ct=document.getElementById(\'batchCustomToggle\');document.getElementById(\'batchActionSelect\').disabled=this.checked||(ct&&ct.checked);"> 自定义添加仙丹</label><span id="batchCustomXd" style="display:none;margin-left:8px;"><input type="number" id="batchCustomXdValue" style="width:70px;padding:4px 6px;border:1px solid #ccc;border-radius:8px;font-size:14px;" placeholder="仙丹数" value="1"> 仙丹</span></div>'; showModal('批量奖惩', studentListHtml, [{text:'取消', class:'btn-secondary', onclick:'closeModal()'},{text:'执行', class:'btn-primary', onclick:'confirmBatchAction()'}], false); setTimeout(()=>{ const selectAll = document.getElementById('selectAllBatch'); if(selectAll) selectAll.onchange = (e) => toggleAllBatch(e.target.checked); }, 50); }
function toggleAllBatch(checked){ const chks = document.querySelectorAll('.batch-student-chk'); chks.forEach(chk => chk.checked = checked); }
function confirmBatchAction(){ if(typeof currentUser!=='undefined'&&currentUser&&currentUser.type==='student'){showNotification('权限不足','此操作仅限教师','error');return;} const cur = classesData.find(c=>c.id===currentClassId); if(!cur) return; const isCustom = document.getElementById('batchCustomToggle')?.checked; const isCustomXd = document.getElementById('batchCustomXdToggle')?.checked; let action; if(isCustom){ const val = parseInt(document.getElementById('batchCustomValue')?.value); if(isNaN(val)||val===0){ showNotification('请输入有效的金币数','不能为0','warning'); return; } action = {id:'_custom_', name:'自定义'+(val>0?'+':'')+val+'金币', coins: val}; } else if(!isCustomXd){ const actionId = document.getElementById('batchActionSelect')?.value; action = customActions.find(a=>String(a.id)===String(actionId)); if(!action){ showNotification('错误','未选择有效的奖惩项目','error'); return; } } let customXdVal = 0; if(isCustomXd){ customXdVal = parseInt(document.getElementById('batchCustomXdValue')?.value); if(isNaN(customXdVal)||customXdVal===0){ showNotification('请输入有效的仙丹数','不能为0','warning'); return; } } const selectedIds = Array.from(document.querySelectorAll('.batch-student-chk:checked')).map(cb=>cb.value); if(selectedIds.length===0){ showNotification('请至少选择一名学生','','warning'); return; } let updatedCount = 0; let xdUpdatedCount = 0; let _batchCoinDeltas = new Map(); cur.students.forEach(s=>{ if(selectedIds.includes(s.id.toString())){ if(isCustomXd && customXdVal !== 0){ const before = s.xiandan || 0; s.xiandan = Math.max(0, before + customXdVal); const actualDelta = (s.xiandan || 0) - before; if(actualDelta !== 0){ if(!(window.USE_API&&window.ApiMigration)){recordAction(s.id, s.name, '批量奖惩', `自定义${actualDelta>0?'+':''}${actualDelta}仙丹`, 0, 0, getActivePet(s)?.id||null);} xdUpdatedCount++;if(window.USE_API&&window.ApiMigration){window.ApiMigration.updateStudent(s.id,{xiandan:s.xiandan});} } } if(isCustomXd && !isCustom) return; if(!isCustom && !isCustomXd) return; let pet = getActivePet(s); if(pet){ let coinsChange = action.coins; let isPenalty = coinsChange < 0; let expChange = 0; if(pet.isDead){ if(isPenalty){ showNotification('操作跳过',`${s.name} 宠物已死亡，惩罚跳过`,'warning'); return; } else { s.coins += coinsChange; if(s.coins<0) s.coins=0; if(!(window.USE_API&&window.ApiMigration)){recordAction(s.id, s.name, '批量奖惩', `${action.name} (宠物死亡)`, coinsChange, 0, pet.id);} _batchCoinDeltas.set(s.id, coinsChange); updatedCount++; return; } } if(isPenalty){ let absDeduct = Math.abs(coinsChange); let coinDeducted = Math.min(absDeduct, s.coins); let remaining = absDeduct - coinDeducted; s.coins -= coinDeducted; _batchCoinDeltas.set(s.id, -coinDeducted); expChange = 0; if(remaining > 0){ expChange = -remaining; let prevGrowth = pet.growth; pet.growth += expChange; if(pet.growth <= 0){ pet.growth = 0; pet.isDead = true; pet.deathGrowth = prevGrowth; pet.deathDate = new Date().toISOString(); pet.penaltyStreak = 0; if(!(window.USE_API&&window.ApiMigration)){recordAction(s.id, s.name, '惩罚致死', `${action.name} 导致死亡（金币不足，经验扣至0）`, -absDeduct, -prevGrowth, pet.id, {causedDeath: true, prevGrowth: prevGrowth});} updatedCount++; return; } updatePetLevel(s, pet.id, expChange); } if(!(window.USE_API&&window.ApiMigration)){recordAction(s.id, s.name, '批量奖惩', `${action.name}`, -coinDeducted, expChange, pet.id);} updatedCount++; } else { if(pet.penaltyStreak !== undefined) pet.penaltyStreak = 0; s.coins += coinsChange; if(s.coins<0) s.coins=0; if(!(window.USE_API&&window.ApiMigration)){recordAction(s.id, s.name, '批量奖惩', `${action.name}`, coinsChange, 0, pet.id);} _batchCoinDeltas.set(s.id, coinsChange); updatedCount++; } } else { s.coins += action.coins; if(s.coins<0) s.coins=0; if(!(window.USE_API&&window.ApiMigration)){recordAction(s.id, s.name, '批量奖惩', `${action.name} (无宠物)`, action.coins, 0, null);} _batchCoinDeltas.set(s.id, action.coins); updatedCount++; } } }); if(updatedCount>0 || xdUpdatedCount>0){ saveClassData('coins'); scheduleAllRenders(); if(currentModalStudentId) refreshCurrentStudentModal(); let msg = ''; if(updatedCount>0) msg += `已对${updatedCount}名学生执行"${action.name}"`; if(xdUpdatedCount>0) msg += `${msg?'，':''}已对${xdUpdatedCount}名学生${customXdVal>0?'增加':'扣除'}仙丹`; showNotification('批量操作完成',msg,'success'); } else { showNotification('无变化','操作未生效','info'); }
  // v141: API 模式 — 同步金币和宠物变更到 Supabase
  if (window.USE_API && window.ApiMigration) {
    cur.students.forEach(function(s) {
      if (selectedIds.includes(s.id.toString())) {
        var _pet = getActivePet(s);
        var _actualDelta = _batchCoinDeltas.has(s.id) ? _batchCoinDeltas.get(s.id) : action.coins;
        if (_pet && (isCustom || (!isCustom && !isCustomXd))) {
          window.ApiMigration.coinsAndPet(s, _actualDelta, [{
            petId: _pet.id,
            updates: { growth: _pet.growth, level: _pet.level, is_dead: _pet.isDead, penalty_streak: _pet.penaltyStreak || 0 }
          }], {
            actionType: '批量奖惩', details: action.name,
            expDelta: 0, petId: _pet.id, checkBalance: _actualDelta < 0
          }).then(function(r) { if(r.ok) s.coins = r.coinsAfter; });
          // v159: 乐观本地日志，使PK/江湖行资格立即生效
          _recordOptimisticLog(s.id, s.name, '批量奖惩', action.name, _actualDelta, 0, _pet.id);
        } else if (!_pet && !isCustomXd) {
          // 无宠物时也要同步金币变更（自定义金币 或 预设奖惩）
          window.ApiMigration.changeStudentCoins(s, _actualDelta, '批量奖惩', action.name, 0, null)
            .then(function(r) { if(r.ok) s.coins = r.coinsAfter; });
        }
      }
    });
  }
  closeModal(); }
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
function addSingleStudent(){const name=prompt('学生姓名（最多20字）');if(!name)return;var v=_validateInput(name,20,'学生姓名');if(!v.ok){showNotification('输入无效',v.error,'warning');return;}const cur=classesData.find(c=>c.id===currentClassId);if(cur.students.find(s=>s.name===v.value)){showNotification('已存在','','error');return;}var newId=_genLocalId();cur.students.push({id:newId,name:v.value,coins:50,pets:[],lastCheckinDate:null,activePetId:null,pkCountToday:0,lastPkDate:null});saveClassData();if(window.USE_API&&window.ApiMigration){window.ApiMigration.manageStudent('add',{classId:currentClassId,name:v.value}).then(function(r){if(r.ok&&r.student){var localStu=cur.students.find(function(s){return s.id.toString()===newId.toString();});if(localStu&&r.student.id)localStu.id=r.student.id;}else if(!r.ok)console.warn('[API] addStudent error:',r.error);});}closeModal();showStudentListModal();scheduleAllRenders();}
function editStudentName(id){const cur=classesData.find(c=>c.id===currentClassId);const stu=cur.students.find(s=>s.id.toString()===id.toString());if(!stu)return;const newName=prompt('新名字（最多20字）',stu.name);if(!newName)return;var v=_validateInput(newName,20,'学生姓名');if(!v.ok){showNotification('输入无效',v.error,'warning');return;}stu.name=v.value;saveClassData();if(window.USE_API&&window.ApiMigration){window.ApiMigration.updateStudent(stu.id,{name:v.value}).then(function(r){if(!r.ok)console.warn('[API] editStudentName error:',r.error);});}closeModal();showStudentListModal();renderHomePetGrid();}
function deleteStudentById(id){if(!confirm('删除学生'))return;var cur=classesData.find(function(c){return c.id===currentClassId;});if(!cur)return;var deletedStu=cur.students.find(function(s){return s.id.toString()===id.toString();});cur.students=cur.students.filter(function(s){return s.id.toString()!==id.toString();});closeModal();showStudentListModal();scheduleAllRenders();if(currentModalStudentId&&currentModalStudentId===id)closeModal();_pauseSync=true;var _waitAndDel=function(){if(typeof _dalSyncing!=='undefined'&&_dalSyncing){setTimeout(_waitAndDel,300);return;}safeLSSave('classPetData',classesData);scheduleFileSave();
  // v149: API 模式
  if(window.USE_API&&window.ApiMigration&&window.ApiMigration.manageStudent&&deletedStu){
    var stuId=parseInt(deletedStu.id);
    if(!isNaN(stuId)&&stuId>0){
      window.ApiMigration.manageStudent('delete',{studentIds:[stuId]}).then(function(r){
        if(r.ok) console.log('[v149] API deleteStudent ok:', stuId);
        else console.warn('[v149] API deleteStudent error:', r.error);
        _pauseSync=false;saveClassData();
      }).catch(function(e){console.warn('[v149] API deleteStudent failed:',e);_pauseSync=false;saveClassData();});
      return;
    }
    _pauseSync=false;saveClassData();return;
  }
  // 非 API 模式
  if(typeof db!=='undefined'&&db&&deletedStu&&typeof _isValidInt4Id==='function'&&_isValidInt4Id(deletedStu.id)){var stuId=parseInt(deletedStu.id);if(!isNaN(stuId)&&stuId>0){db.from('pets').delete().in('student_id',[stuId]).then(function(){return db.from('students').delete().eq('id',stuId);}).then(function(r){if(r.error)console.warn('[DAL] deleteStudent Supabase error:',r.error);else console.log('[DAL] Deleted student',stuId,'from Supabase');}).catch(function(e){console.warn('[DAL] deleteStudent Supabase error:',e);}).finally(function(){_pauseSync=false;saveClassData();});return;}_pauseSync=false;saveClassData();}};_waitAndDel();}
function clearAllStudents(){if(confirm('清空所有学生？')){const cur=classesData.find(c=>c.id===currentClassId);var deletedIds=cur.students.map(function(s){return s.id;});cur.students=[];saveClassData();if(window.USE_API&&window.ApiMigration&&deletedIds.length>0){window.ApiMigration.manageStudent('delete',{studentIds:deletedIds}).then(function(r){if(!r.ok)console.warn('[API] clearAllStudents error:',r.error);});}closeModal();scheduleAllRenders();if(currentModalStudentId)closeModal();}}

/* v130: switchPage 增加按需加载 */
function switchPage(pageId){if(pageId!=='quiz-page'&&typeof window._stopPigRunBGM==='function'){window._stopPigRunBGM();}if(pageId!=='quiz-page'&&typeof window._stopMatch3BGM==='function'){window._stopMatch3BGM();}document.querySelectorAll('.nav-item').forEach(i=>i.classList.remove('active'));document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));document.getElementById(pageId).classList.add('active');var isStudentView=typeof currentUser!=='undefined'&&currentUser&&currentUser.type==='student';if(pageId!=='quiz-page'&&!isStudentView&&typeof window._resetQuizModalFlag==='function'){window._resetQuizModalFlag();}else if(pageId==='quiz-page'&&!isStudentView){if(typeof window._resetQuizModalFlag==='function')window._resetQuizModalFlag();window._pigRunModalShown=false;window._match3ModalShown=false;window._teacherPlayingAsStudent=null;}/* v130: 确定需要加载的模块 */var _moduleMap={'pk-page':'pk-battle','jianghu-page':'pk-battle','honor-board-page':'rankings','library-page':'library'};var _modId=_moduleMap[pageId];var _modIds=null;if(pageId==='quiz-page'){_modIds=['quiz','pig-run','match3','happy-run'];}else if(pageId==='pk-page'){_modIds=['pk-battle','class-pk'];_modId=null;}else if(pageId==='jianghu-page'){_modIds=['pk-battle','jianghu'];_modId=null;}var _doRender=function(){requestAnimationFrame(()=>{if(pageId==='honor-board-page'){if(typeof renderClassTopThree==='function')renderClassTopThree();var art=document.querySelector('.rank-tab.active');if(art&&art.textContent.includes('\u6bcf\u65e5')){if(typeof renderQuizRanking==='function')renderQuizRanking();}else if(art&&art.textContent.includes('\u5c0f\u732a')){if(typeof renderPigRunRanking==='function')renderPigRunRanking();}else if(art&&art.textContent.includes('\u6d88\u6d88\u4e50')){if(typeof renderMatch3Ranking==='function')renderMatch3Ranking();}else if(art&&art.textContent.includes('\u5feb\u4e50\u8dd1')){if(typeof renderHappyRunRanking==='function')renderHappyRunRanking();}}else if(pageId==='quiz-page'){if(typeof renderQuizPage==='function')renderQuizPage();var aqt=document.querySelector('.quiz-tab.active');if(aqt&&aqt.textContent.includes('\u5c0f\u732a')){if(typeof renderPigRunPage==='function')renderPigRunPage();}else if(aqt&&aqt.textContent.includes('\u6d88\u6d88\u4e50')){if(typeof renderMatch3Page==='function')renderMatch3Page();}else if(aqt&&aqt.textContent.includes('\u5feb\u4e50\u8dd1')){if(typeof renderHappyRunPage==='function')renderHappyRunPage();}}else if(pageId==='pk-page'){if(typeof renderPKPage==='function')renderPKPage();var sa=document.getElementById('classpk-start-area');if(sa)sa.classList.remove('visible');if(typeof probePKMonsterImages==='function')probePKMonsterImages();}else if(pageId==='jianghu-page'){if(typeof renderJianghuPage==='function')renderJianghuPage();if(typeof probeJhBossImages==='function')probeJhBossImages();}else if(pageId==='library-page'){if(typeof renderLibraryPage==='function')renderLibraryPage();}});};var needsLogReload=isStudentView&&(pageId==='pk-page'||pageId==='jianghu-page');var _afterModuleLoad=function(){if(needsLogReload&&typeof _loadOperationLogs==='function'){_loadOperationLogs().then(function(){if(typeof _syncOpLogsAlias==='function'){try{_syncOpLogsAlias();}catch(e){}}_doRender();}).catch(function(e){console.warn('[switchPage] Log reload failed:',e);_doRender();});}else{_doRender();}};if(_modIds&&typeof loadModules==='function'){loadModules(_modIds).then(_afterModuleLoad);}else if(_modId&&typeof loadModule==='function'){loadModule(_modId).then(_afterModuleLoad);}else{_afterModuleLoad();}}
/* v130: init 增加按需加载 */
function init(){renderClassList();if(classesData.length&&!currentClassId)currentClassId=classesData[0].id;scheduleAllRenders();/* v130: 按需加载 snack-system 后初始化审批状态按钮 */if(typeof loadModule==='function'){loadModule('snack-system').then(function(){if(typeof _initSnackStatusButton==='function')_initSnackStatusButton();_updateSnackRequestBadge();});}else{if(typeof _initSnackStatusButton==='function')_initSnackStatusButton();}/* 延迟非关键页面的初始渲染 */requestAnimationFrame(()=>{if(typeof loadModule==='function'){loadModules(['pk-battle','jianghu']).then(function(){renderJianghuPage();if(typeof probeClassPKRobotImages==="function") probeClassPKRobotImages();});}else{if(typeof renderJianghuPage==='function')renderJianghuPage();if(typeof probeClassPKRobotImages==="function") probeClassPKRobotImages();}});}
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


