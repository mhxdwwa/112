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
  const playTone = (dur, startFreq, endFreq, vol, delay) => {
    const t0 = t + (delay || 0);
    const osc = audioCtx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(startFreq, t0);
    osc.frequency.exponentialRampToValueAtTime(endFreq, t0 + dur);
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.01, t0 + dur);
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.start(t0); osc.stop(t0 + dur);
  };
  /* ★ 三角波音色（史诗掉落琶音用，更「剔透」） */
  const playChime = (dur, freq, vol, delay) => {
    const t0 = t + (delay || 0);
    const osc = audioCtx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, t0);
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.01, t0 + dur);
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.start(t0); osc.stop(t0 + dur);
  };
  if (type === 'swordSwing') playNoise(0.12, 3000, 3, 0.15);
  else if (type === 'bladeSwing') playNoise(0.2, 1200, 1.5, 0.25);
  else if (type === 'spearThrust') playNoise(0.1, 2500, 5, 0.15);
  else if (type === 'fistPunch') playNoise(0.08, 800, 2, 0.1);
  else if (type === 'impact') { playTone(0.15, 150, 40, 0.3); playNoise(0.15, 600, 1, 0.2); }
  else if (type === 'explosion') { playTone(0.4, 100, 20, 0.5); playNoise(0.4, 400, 0.5, 0.4); }
  else if (type === 'thunder') { playTone(0.6, 80, 15, 0.6); playNoise(0.5, 300, 0.8, 0.5); playTone(0.3, 200, 50, 0.4); }
  else if (type === 'skillCast') {
    /* ============================================================
       ★ v46 各职业 · 各档位技能专属施法音
       —— 以前全职业共用一个 "300→600Hz 上滑 + 1500Hz 噪声"，
          三十六招听起来一模一样，放技能完全没有「这招很重」的体感。
       现在按「武器职业 × 技能档位」现场合成：
         剑＝清亮金属铮鸣　刀＝厚重劈风　枪＝锐利贯穿　拳＝低频闷击
         药＝柔和气泡　　　斧＝低沉重压　符＝纸符翻飞　鼎＝钟鼎鸣响
       档位 1→6 逐级抬音高、加长、加厚；第 6 式（觉醒）再叠一层地鸣与长尾。
       ============================================================ */
    const caster = (typeof currentSkillCaster !== 'undefined' && currentSkillCaster) ? currentSkillCaster : null;
    let wid = 'sword';
    try {
      if (caster && typeof WEAPONS !== 'undefined') {
        const _w = WEAPONS[caster.weaponIdx];
        if (_w && _w.id) wid = _w.id;
      }
    } catch (e) { /* 极端情况下退回剑士音色 */ }
    const tier = Math.max(0, Math.min(5, (typeof currentSkillIdx !== 'undefined' && currentSkillIdx >= 0) ? currentSkillIdx : 0));
    const pMul = 1 + tier * 0.11;        /* 档位越高音高越抬，听感「一层比一层强」 */
    const vMul = 0.80 + tier * 0.06;     /* 音量同步递增 */
    const dMul = 1 + tier * 0.14;        /* 尾音越长 */
    /* [时长, 频率, Q, 音量] */
    const V = {
      sword:    { n:[[0.18,4200,4,0.13]],  t:[[0.22,520,1180,0.16,0]] },
      blade:    { n:[[0.26,1400,1.6,0.22]],t:[[0.28,300,130,0.20,0]] },
      spear:    { n:[[0.10,5200,6,0.15]],  t:[[0.12,900,420,0.14,0]] },
      fist:     { n:[[0.09,700,2,0.17]],   t:[[0.16,180,70,0.24,0]] },
      herb:     { n:[[0.30,1000,1.0,0.10]],t:[[0.26,420,640,0.12,0],[0.30,640,520,0.09,0.07]] },
      axe:      { n:[[0.30,900,1.2,0.24]], t:[[0.34,150,50,0.26,0]] },
      talisman: { n:[[0.20,3200,2.0,0.10]],t:[], c:[[0.50,880,0.14,0],[0.60,1320,0.09,0.08]] },
      cauldron: { n:[[0.18,2200,3,0.10]],  t:[], c:[[0.50,440,0.16,0],[0.70,660,0.11,0.06],[0.90,880,0.07,0.14]] }
    };
    const v = V[wid] || V.sword;
    for (const q of (v.n || [])) playNoise(q[0] * dMul, q[1] * pMul, q[2], q[3] * vMul);
    for (const q of (v.t || [])) playTone(q[0] * dMul, q[1] * pMul, q[2] * pMul, q[3] * vMul, q[4]);
    for (const q of (v.c || [])) playChime(q[0] * dMul, q[1] * pMul, q[2] * vMul, q[3]);
    /* 觉醒技：加一层地鸣 + 长尾，把「终极」和其它档位彻底区分开 */
    if (tier >= 5) {
      playTone(0.85, 95 * pMul, 38, 0.30);
      playNoise(0.65, 480, 0.7, 0.16);
      playChime(0.90, 1760, 0.07, 0.12);
    }
  }
  else if (type === 'enemySkill') { playTone(0.2, 200, 100, 0.4); }
  else if (type === 'jump') { playTone(0.15, 200, 400, 0.15); }
  else if (type === 'levelup') { playTone(0.16, 440, 880, 0.22); playTone(0.3, 660, 1320, 0.16); }
  else if (type === 'portal') { playTone(0.5, 180, 900, 0.2); playNoise(0.4, 2000, 3, 0.12); }
  else if (type === 'epicDrop') {
    /* ★ 史诗/传说掉落：上行琶音（C-E-G-C）+ 高八度剔透回响 + 微光噪声 */
    playChime(0.35, 523.25, 0.24, 0);      /* C5 */
    playChime(0.35, 659.25, 0.24, 0.10);   /* E5 */
    playChime(0.35, 783.99, 0.26, 0.20);   /* G5 */
    playChime(0.55, 1046.50, 0.30, 0.30);  /* C6 */
    playChime(0.70, 2093.00, 0.12, 0.42);  /* C7 闪烁尾音 */
    playTone(0.5, 261.63, 523.25, 0.10, 0.05);
  }
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
  /* ★ B键打开/关闭装备强化菜单（★ v42：只有城镇能开，刷图途中拒绝） */
  if(e.code === 'KeyB' && !e.repeat){
    if(gameState === 'town'){
      autoSelectEquipSlots();
      if(typeof blacksmithTab !== 'undefined' && !blacksmithTab) blacksmithTab = 'enhance';
      gameState = 'enhanceMenu';
    } else if(gameState === 'enhanceMenu'){
      gameState = 'town';     /* v42：铁匠铺只从城镇开，关掉必然回城镇 */
    } else if(gameState === 'playing' || gameState === 'paused'){
      if(typeof blacksmithRefuse === 'function') blacksmithRefuse();
    } else if(gameState === 'inventory'){
      gameState = 'town';
    }
  }
  /* ★ I键打开/关闭背包 */
  if(e.code === 'KeyI' && !e.repeat){
    if(gameState === 'town'){
      G.inventoryReturnState = 'town';
      gameState = 'inventory';
    } else if(gameState === 'inventory'){
      /* ★ v42：从战斗里开的背包，按 I 关掉要回战斗，不能直接飘回城镇 */
      const back = (G && G.inventoryReturnState) ? G.inventoryReturnState : 'town';
      gameState = back;
      if(G) G.inventoryReturnState = null;
      if(typeof decomposeMode !== 'undefined'){
        decomposeMode = false;
        if(typeof decomposeResetSelection === 'function') decomposeResetSelection();
      }
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
    } else if(gameState === 'keyBindMenu'){
      gameState = 'gameMenu';
    } else if(gameState === 'gameMenu'){
      gameState = 'town';
    } else if(gameState === 'town'){
      gameState = 'gameMenu';
    }
  }
  if(['Space','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','KeyJ','KeyW','KeyA','KeyS','KeyD','Period','Comma','Slash','Numpad0','Numpad1','Numpad4','Numpad5','Numpad6','Numpad7','Numpad8','Numpad9','ShiftLeft','ShiftRight'].includes(e.code)
     || (typeof kbAllCodes === 'function' && kbAllCodes().indexOf(e.code) >= 0)) e.preventDefault();
});
addEventListener('keyup', e=>{ keys[e.code] = false; });
addEventListener('blur', ()=>{ for(const k in keys) keys[k]=false; });
addEventListener('pointerdown', initAudio);

