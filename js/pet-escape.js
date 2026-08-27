// ========== 宠物逃跑系统 ==========
// ========== 闲置宠物出逃系统 ==========
// v130: 改为按需加载，IIFE 包装为命名函数
// 全局跟踪当前出逃中的宠物ID（用于DOM重建时保持出逃状态）
window._escapedPetIds = window._escapedPetIds || new Set();
window.__initPetEscape = function(){
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
};
// 如果非按需加载模式（script tag 直接引入），自动初始化
if (!window.__lazyLoader) { window.__initPetEscape(); }
// ========== 闲置宠物出逃系统结束 ==========
