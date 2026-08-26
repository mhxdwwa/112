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
