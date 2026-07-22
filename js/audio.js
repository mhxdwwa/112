// ========== 音效系统 ==========
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

// ========== 升级特效 ==========
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

// ========== PK 技能音效 ==========
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


// ========== PK 技能攻击动画 ==========
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


// ========== 背景音乐系统 ==========
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
