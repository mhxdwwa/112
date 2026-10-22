/* ===== 音效 ===== */
let audioCtx = null;
function initAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
}

/* ===== 全局轻提示 ===== */
let _uiToastTimer = null;
function showToast(msg, color){
  const el = document.getElementById('uiToast');
  if(!el) return;
  el.textContent = msg;
  el.style.borderColor = color || 'rgba(255,209,102,0.65)';
  el.style.color = color || '#ffe9a8';
  el.classList.add('show');
  clearTimeout(_uiToastTimer);
  _uiToastTimer = setTimeout(()=>el.classList.remove('show'), 1800);
}
let lastSoundTime = 0;
function playSound(type) {
  if (!audioCtx || audioCtx.state === 'suspended') return;
  const now = performance.now();
  if (now - lastSoundTime < 30 && type !== 'skillCast') return;
  lastSoundTime = now;
  const t = audioCtx.currentTime;
  const playNoise = (dur, freq, q, vol) => {
    const len = audioCtx.sampleRate * dur;
    const buf = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = audioCtx.createBufferSource(); src.buffer = buf;
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(freq, t);
    filter.frequency.exponentialRampToValueAtTime(freq/2, t + dur);
    filter.Q.value = q;
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + dur);
    src.connect(filter); filter.connect(gain); gain.connect(audioCtx.destination);
    src.start(t);
  };
  const playTone = (dur, startFreq, endFreq, vol) => {
    const osc = audioCtx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(startFreq, t);
    osc.frequency.exponentialRampToValueAtTime(endFreq, t + dur);
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + dur);
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.start(t); osc.stop(t + dur);
  };
  if (type === 'swordSwing') playNoise(0.12, 3000, 3, 0.15);
  else if (type === 'bladeSwing') playNoise(0.2, 1200, 1.5, 0.25);
  else if (type === 'spearThrust') playNoise(0.1, 2500, 5, 0.15);
  else if (type === 'fistPunch') playNoise(0.08, 800, 2, 0.1);
  else if (type === 'impact') { playTone(0.15, 150, 40, 0.3); playNoise(0.15, 600, 1, 0.2); }
  else if (type === 'explosion') { playTone(0.4, 100, 20, 0.5); playNoise(0.4, 400, 0.5, 0.4); }
  else if (type === 'thunder') { playTone(0.6, 80, 15, 0.6); playNoise(0.5, 300, 0.8, 0.5); playTone(0.3, 200, 50, 0.4); }
  else if (type === 'skillCast') { playTone(0.3, 300, 600, 0.2); playNoise(0.3, 1500, 2, 0.2); }
  else if (type === 'enemySkill') { playTone(0.2, 200, 100, 0.4); }
  else if (type === 'jump') { playTone(0.15, 200, 400, 0.15); }
  else if (type === 'levelup') { playTone(0.16, 440, 880, 0.22); playTone(0.3, 660, 1320, 0.16); }
  else if (type === 'portal') { playTone(0.5, 180, 900, 0.2); playNoise(0.4, 2000, 3, 0.12); }
}

/* ===== 程序化背景音乐 ===== */
let bgmPlaying = false, bgmNodes = [], bgmInterval = null;
function startBGM(){
  if(!audioCtx || bgmPlaying) return;
  bgmPlaying = true;
  
  /* 五声音阶: C D E G A (宫商角徵羽) */
  const pentatonic = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25];
  const bassNotes = [130.81, 146.83, 164.81, 196.00, 220.00];
  
  /* 环境音层 - 持续低音 */
  const droneOsc = audioCtx.createOscillator();
  droneOsc.type = 'sine';
  droneOsc.frequency.value = 65;
  const droneGain = audioCtx.createGain();
  droneGain.gain.value = 0.04;
  const droneFilter = audioCtx.createBiquadFilter();
  droneFilter.type = 'lowpass';
  droneFilter.frequency.value = 200;
  droneOsc.connect(droneFilter);
  droneFilter.connect(droneGain);
  droneGain.connect(audioCtx.destination);
  droneOsc.start();
  bgmNodes.push(droneOsc, droneGain, droneFilter);
  
  /* 旋律层 - 随机五声音符 */
  function playMelodyNote(){
    if(!bgmPlaying || !audioCtx) return;
    const t = audioCtx.currentTime;
    const freq = pentatonic[Math.floor(Math.random() * pentatonic.length)];
    const osc = audioCtx.createOscillator();
    osc.type = Math.random() > 0.5 ? 'sine' : 'triangle';
    osc.frequency.value = freq;
    const gain = audioCtx.createGain();
    const vol = 0.03 + Math.random() * 0.03;
    const dur = 0.8 + Math.random() * 1.5;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(vol, t + 0.1);
    gain.gain.linearRampToValueAtTime(vol * 0.6, t + dur * 0.5);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1500 + Math.random() * 1000;
    filter.Q.value = 2;
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + dur);
  }
  
  /* 低音层 - 偶尔的低音 */
  function playBassNote(){
    if(!bgmPlaying || !audioCtx) return;
    const t = audioCtx.currentTime;
    const freq = bassNotes[Math.floor(Math.random() * bassNotes.length)];
    const osc = audioCtx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const gain = audioCtx.createGain();
    const dur = 2 + Math.random() * 2;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.05, t + 0.3);
    gain.gain.linearRampToValueAtTime(0.03, t + dur * 0.7);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + dur);
  }
  
  /* 泛音层 - 高频点缀 */
  function playHarmonic(){
    if(!bgmPlaying || !audioCtx) return;
    const t = audioCtx.currentTime;
    const freq = pentatonic[Math.floor(Math.random() * pentatonic.length)] * 2;
    const osc = audioCtx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const gain = audioCtx.createGain();
    const dur = 0.3 + Math.random() * 0.5;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.015, t + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + dur);
  }
  
  /* 定时播放旋律 */
  bgmInterval = setInterval(()=>{
    if(!bgmPlaying) return;
    if(Math.random() < 0.6) playMelodyNote();
    if(Math.random() < 0.3) playBassNote();
    if(Math.random() < 0.2) playHarmonic();
  }, 800);
}

function stopBGM(){
  bgmPlaying = false;
  if(bgmInterval){ clearInterval(bgmInterval); bgmInterval = null; }
  for(const node of bgmNodes){
    try{ if(node.stop) node.stop(); } catch(e){}
    try{ node.disconnect(); } catch(e){}
  }
  bgmNodes = [];
}

const keys = {};
const pressed = {};
addEventListener('keydown', e=>{
  initAudio();
  
  /* ★ 命名界面键盘输入 */
  if(gameState === 'nameInput' && nameInputActive){
    if(e.code === 'Enter'){
      if(!playerName) playerName = '无名侠客';
      G.playerName = playerName;
      initTown();
      gameState = 'town';
      startBGM();
      nameInputBox.blur();
      maybeShowPrologue();
      e.preventDefault();
      return;
    }
    if(e.code === 'Backspace'){
      playerName = playerName.slice(0, -1);
      nameInputBox.value = playerName;
      e.preventDefault();
      return;
    }
    /* 字符输入由隐藏input框处理（支持中文输入法） */
    return;
  }
  
  if(!keys[e.code]) pressed[e.code] = true;
  keys[e.code] = true;
  /* ★ B键打开/关闭装备强化菜单 */
  if(e.code === 'KeyB' && !e.repeat){
    if(gameState === 'playing' && G && !G.isPvp){
      autoSelectEquipSlots();
      gameState = 'enhanceMenu';
    } else if(gameState === 'enhanceMenu'){
      gameState = 'playing';
    } else if(gameState === 'town'){
      autoSelectEquipSlots();
      gameState = 'enhanceMenu';
    } else if(gameState === 'inventory'){
      gameState = 'town';
    }
  }
  /* ★ I键打开/关闭背包 */
  if(e.code === 'KeyI' && !e.repeat){
    if(gameState === 'town'){
      gameState = 'inventory';
    } else if(gameState === 'inventory'){
      gameState = 'town';
    }
  }
  /* ★ U键打开/关闭技能界面 */
  if(e.code === 'KeyU' && !e.repeat){
    if(gameState === 'town'){
      gameState = 'skillMenu';
    } else if(gameState === 'skillMenu'){
      gameState = 'town';
    }
  }
  /* ★ 改进3: C键打开/关闭角色界面 */
  if(e.code === 'KeyC' && !e.repeat){
    if(gameState === 'town'){
      gameState = 'characterInfo';
    } else if(gameState === 'characterInfo'){
      gameState = 'town';
    }
  }
  /* ★ ESC：游戏中暂停；城镇中打开/关闭系统菜单；图鉴返回系统菜单 */
  if(e.code === 'Escape' && !e.repeat){
    if(gameState === 'playing'){
      gameState = 'paused';
    } else if(gameState === 'paused'){
      gameState = 'playing';
    } else if(gameState === 'equipWiki'){
      gameState = 'gameMenu';
    } else if(gameState === 'gameMenu'){
      gameState = 'town';
    } else if(gameState === 'town'){
      gameState = 'gameMenu';
    }
  }
  if(['Space','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','KeyJ','KeyW','KeyA','KeyS','KeyD','Period','Comma','Slash','Numpad0','Numpad1','Numpad4','Numpad5','Numpad6','Numpad7','Numpad8','Numpad9','ShiftLeft','ShiftRight'].includes(e.code)) e.preventDefault();
});
addEventListener('keyup', e=>{ keys[e.code] = false; });
addEventListener('blur', ()=>{ for(const k in keys) keys[k]=false; });
addEventListener('pointerdown', initAudio);

