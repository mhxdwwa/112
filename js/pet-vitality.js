// ========== 宠物活力系统 ==========
// ========== 宠物生机系统 ==========
// v130: 改为按需加载，IIFE 包装为命名函数
window.__initPetVitality = function(){
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
};
// 如果非按需加载模式（script tag 直接引入），自动初始化
if (!window.__lazyLoader) { window.__initPetVitality(); }
