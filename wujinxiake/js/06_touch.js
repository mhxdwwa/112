/* ===== 触屏控制 ===== */
const touchState = { p1: { x: 0, y: 0, active: false }, p2: { x: 0, y: 0, active: false } };

/* ★ 区分「手机浏览器」和「电脑浏览器/电脑触屏」
   只有手机才切到左下角紧凑阵列（#touchControls.mobile），电脑一律保持原排布。
   判据：移动端 UA + 有触摸；UA 认不出来时用「粗指针 + 小屏」兜底，
   电脑显示器即便支持触摸，主指针仍是鼠标（fine），不会被误判。 */
function isMobileBrowser(){
  const ua = navigator.userAgent || '';
  const touch = (navigator.maxTouchPoints || 0) > 0 || ('ontouchstart' in window);
  if(!touch) return false;
  const mobileUA = /Android|iPhone|iPod|iPad|Windows Phone|HarmonyOS|OpenHarmony|Mobile Safari|MicroMessenger/i.test(ua);
  if(mobileUA) return true;
  const coarse = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  const minSide = Math.min(screen.width || 9999, screen.height || 9999);
  return coarse && minSide < 820;
}
const IS_MOBILE_BROWSER = isMobileBrowser();
window.IS_MOBILE_BROWSER = IS_MOBILE_BROWSER;

/* ★ 手机端按键：整块控制层对齐到「画布」而不是窗口
   画布按 16:9 居中留边，控制层跟着它走，按键就不会跑到黑边上；
   尺寸全部算成像素写进 CSS 变量，不用 vh / % / env()——
   各家手机浏览器（尤其带浮动地址栏、支持手势缩放的那种）对这些单位
   解释不一致，会出现「摇杆悬在半空、按键叠在一起」。
   画布还没插入/尺寸异常时退回 visualViewport。 */
let _frameKey = '';
function applyMobileFrame(){
  const tc = document.getElementById('touchControls');
  if(!tc || !tc.classList.contains('mobile')) return;

  let x = 0, y = 0, w = 0, h = 0, src = 'vv';
  const cv = document.getElementById('c');
  if(cv){
    const r = cv.getBoundingClientRect();
    if(r.width >= 240 && r.height >= 160){
      x = r.left; y = r.top; w = Math.round(r.width); h = Math.round(r.height); src = 'canvas';
    }
  }
  if(!w || !h){
    const vv = window.visualViewport;
    w = Math.round((vv && vv.width) || window.innerWidth || 360);
    h = Math.round((vv && vv.height) || window.innerHeight || 640);
    if(!(h > 200)) h = Math.round(window.innerHeight || 640);
    if(!(w > 240)) w = Math.round(window.innerWidth || 360);
  }

  const tb  = Math.max(36, Math.min(54, Math.round(h * 0.112)));
  const joy = Math.max(72, Math.min(108, Math.round(h * 0.225)));
  const gap = Math.max(4, Math.min(8, Math.round(h * 0.012)));
  const edge = Math.max(6, Math.round(Math.min(h, w) * 0.022));

  const key = [x, y, w, h, tb, joy, src].join('|');
  if(key === _frameKey) return;
  _frameKey = key;

  tc.style.left = x + 'px'; tc.style.top = y + 'px';
  tc.style.right = 'auto'; tc.style.bottom = 'auto';
  tc.style.width = w + 'px'; tc.style.height = h + 'px';
  tc.style.setProperty('--tb', tb + 'px');
  tc.style.setProperty('--tk', Math.round(tb * 1.30) + 'px');
  tc.style.setProperty('--tj', Math.round(tb * 1.06) + 'px');
  tc.style.setProperty('--joy', joy + 'px');
  tc.style.setProperty('--gap', gap + 'px');
  tc.style.setProperty('--edge', edge + 'px');
  window.__uiFrame = { x: Math.round(x), y: Math.round(y), w: w, h: h, tb: tb, joy: joy, src: src, dpr: window.devicePixelRatio || 1 };
}
window.applyMobileFrame = applyMobileFrame;

/* ?ui=dbg —— 排布异常时把窗口/画布实测值显示在左上角，截一张图就能定位 */
function mountUiDebug(){
  if(!/[?&]ui=dbg\b/.test(location.search)) return;
  const d = document.createElement('div');
  d.style.cssText = 'position:fixed;left:0;top:0;z-index:10001;background:rgba(0,0,0,.78);color:#7fffa0;' +
    'font:11px/1.5 monospace;padding:5px 7px;white-space:pre;pointer-events:none;border-radius:0 0 6px 0';
  document.body.appendChild(d);
  setInterval(function(){
    const cv = document.getElementById('c');
    const r = cv ? cv.getBoundingClientRect() : null;
    const vv = window.visualViewport;
    d.textContent =
      'win  ' + window.innerWidth + 'x' + window.innerHeight + '  dpr ' + (window.devicePixelRatio || 1) +
      '\nvv   ' + (vv ? Math.round(vv.width) + 'x' + Math.round(vv.height) + ' @' + Math.round(vv.offsetLeft) + ',' + Math.round(vv.offsetTop) + ' s' + vv.scale.toFixed(2) : '-') +
      '\ncvs  ' + (r ? Math.round(r.left) + ',' + Math.round(r.top) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height) : '-') +
      '\nframe ' + JSON.stringify(window.__uiFrame) +
      '\nmobileUI ' + !!window.IS_MOBILE_UI;
  }, 700);
}

function bindMobileFrame(){
  if(!(IS_MOBILE_BROWSER || /[?&]ui=mobile\b/.test(location.search))) return;
  applyMobileFrame();
  window.addEventListener('resize', applyMobileFrame);
  window.addEventListener('orientationchange', function(){ setTimeout(applyMobileFrame, 260); });
  if(window.visualViewport){
    window.visualViewport.addEventListener('resize', applyMobileFrame);
    window.visualViewport.addEventListener('scroll', applyMobileFrame);
  }
  /* 兜底：地址栏收放、旋转后个别浏览器不发事件 */
  setInterval(applyMobileFrame, 1200);
  mountUiDebug();
}

function setupTouchControls(){
  const touchControls = document.getElementById('touchControls');
  /* 手机浏览器才启用紧凑阵列；电脑触屏维持原有弧形排布
     （调试时可用 ?ui=mobile 强制预览手机排布） */
  const forceMobile = /[?&]ui=mobile\b/.test(location.search);
  window.IS_MOBILE_UI = !!(IS_MOBILE_BROWSER || forceMobile);
  if(touchControls && (IS_MOBILE_BROWSER || forceMobile)) touchControls.classList.add('mobile');
  function setupJoystick(joystickId, stickId, playerKey){
    const joystick = document.getElementById(joystickId);
    const stick = document.getElementById(stickId);
    const base = joystick.querySelector('.joystick-base');
    let activeTouch = null, isMouseDown = false;
    const updateStick = (cx, cy) => {
      const rect = base.getBoundingClientRect();
      const ccx = rect.left + rect.width / 2, ccy = rect.top + rect.height / 2;
      /* 摇杆半径随控件尺寸走（手机横屏下摇杆会缩到 ~90px） */
      const maxR = Math.max(28, rect.width * 0.42);
      const dx = cx - ccx, dy = cy - ccy;
      const dist = Math.min(Math.hypot(dx, dy), maxR);
      const ang = Math.atan2(dy, dx);
      stick.style.transform = `translate(calc(-50% + ${Math.cos(ang)*dist}px), calc(-50% + ${Math.sin(ang)*dist}px))`;
      touchState[playerKey].x = Math.cos(ang)*dist/maxR;
      touchState[playerKey].y = Math.sin(ang)*dist/maxR;
      touchState[playerKey].active = true;
    };
    const resetStick = () => { stick.style.transform='translate(-50%,-50%)'; touchState[playerKey]={x:0,y:0,active:false}; };
    joystick.addEventListener('touchstart', e=>{e.preventDefault();initAudio();if(activeTouch===null){activeTouch=e.changedTouches[0].identifier;updateStick(e.changedTouches[0].clientX,e.changedTouches[0].clientY);}});
    joystick.addEventListener('touchmove', e=>{e.preventDefault();for(let t of e.changedTouches)if(t.identifier===activeTouch){updateStick(t.clientX,t.clientY);break;}});
    const endT = e=>{for(let t of e.changedTouches)if(t.identifier===activeTouch){activeTouch=null;resetStick();break;}};
    joystick.addEventListener('touchend', endT);
    joystick.addEventListener('touchcancel', endT);
    joystick.addEventListener('mousedown', e=>{e.preventDefault();initAudio();isMouseDown=true;updateStick(e.clientX,e.clientY);});
    document.addEventListener('mousemove', e=>{if(isMouseDown)updateStick(e.clientX,e.clientY);});
    document.addEventListener('mouseup', ()=>{if(isMouseDown){isMouseDown=false;resetStick();}});
  }
  setupJoystick('joystick1', 'stick1', 'p1');
  setupJoystick('joystick2', 'stick2', 'p2');
  document.querySelectorAll('.skill-btn').forEach(btn=>{
    const player = btn.dataset.player, action = btn.dataset.action;
    const trigger = e=>{
      e.preventDefault(); initAudio();
      if(/^skill[1-6]$/.test(action)){
        const p = parseInt(player)===1 ? (G && G.player) : (G && G.player2);
        if(p){
          const idx = parseInt(action.replace('skill','')) - 1;
          const sk = WEAPONS[p.weaponIdx].skills[idx];
          if(!sk) return;
          if((p.cds[idx]||0) > 0){
            showToast(sk.name + ' 冷却中…', '#9fb6cc');
            return;
          }
          if(p.mp < sk.cost){
            showToast('内力不足（需要 ' + sk.cost + '）', '#7fd4ff');
            return;
          }
        }
      }
      if(action==='attack'){ if(player==='1') pressed['KeyJ']=true; else pressed['Period']=true; }
      else if(action==='skill1'){ if(player==='1') pressed['Digit1']=true; else pressed['Comma']=true; }
      else if(action==='skill2'){ if(player==='1') pressed['Digit2']=true; else pressed['Slash']=true; }
      else if(action==='skill3'){ if(player==='1') pressed['Digit3']=true; else pressed['Numpad6']=true; }
      else if(action==='skill4'){ if(player==='1') pressed['Digit4']=true; else pressed['Numpad7']=true; }
      else if(action==='skill5'){ if(player==='1') pressed['Digit5']=true; else pressed['Numpad8']=true; }
      else if(action==='skill6'){ if(player==='1') pressed['Digit6']=true; else pressed['Numpad9']=true; }
      else if(action==='jump'){ if(player==='1') pressed['Space']=true; else pressed['Numpad0']=true; }
    };
    btn.addEventListener('touchstart', trigger);
    btn.addEventListener('mousedown', trigger);
  });
  window.showTouchControls = (isPvp)=>{
    /* 触屏控件常驻：方向拨杆 + 基本攻击 + 跳跃始终存在，技能槽按学习情况显隐 */
    touchControls.classList.add('active');
    const p2Area = document.getElementById('p2Controls');
    if(p2Area) p2Area.style.display = isPvp ? 'block' : 'none';
    /* 双人同屏时按键改为各贴自己那一侧的摇杆内侧，单人时 8 键全在右下角 */
    touchControls.classList.toggle('pvp', !!isPvp);
    applyMobileFrame();
    if(window.syncTouchSkillIcons) window.syncTouchSkillIcons();
    if(window.refreshSkillLockUI) window.refreshSkillLockUI();
    syncTouchMode();
  };
  window.hideTouchControls = ()=>{
    touchControls.classList.remove('active');
    document.querySelectorAll('.skill-btn').forEach(btn=>{
      btn.classList.remove('on-cd'); btn.style.opacity='1';
      const o = btn.querySelector('.cd-overlay'); if(o) o.remove();
    });
  };
  /* ★ 城镇里收起 6 个技能键，进关卡后再出现（普攻键在城镇是「交互」，必须保留） */
  window.syncTouchMode = syncTouchMode;
  setInterval(syncTouchMode, 260);
}

/* 当前应显示哪套按键：town = 只留摇杆/普攻/跳跃，battle = 8 键全开 */
let lastTouchMode = '';
function syncTouchMode(){
  const tc = document.getElementById('touchControls');
  if(!tc) return;
  const mode = (typeof gameState !== 'undefined' && gameState === 'town') ? 'town' : 'battle';
  if(mode === lastTouchMode) return;
  lastTouchMode = mode;
  tc.classList.toggle('town-mode', mode === 'town');
}

function getTouchInput(n){ const k=n===1?'p1':'p2'; const s=touchState[k]; return s.active?{mx:s.x,my:s.y}:{mx:0,my:0}; }

function updateSkillButtonCD(){
  if(!G || gameState !== 'playing') return;
  const upd = (num, p)=>{
    if(!p || p.dead) return;
    const prefix = num===1?'p1':'p2';
    const w = WEAPONS[p.weaponIdx];
    for(let i=0;i<6;i++){
      const btn = document.getElementById(prefix+'skill'+(i+1));
      if(!btn || !w.skills[i]) continue;
      const cd = p.cds[i] || 0, mpCost = w.skills[i].cost;
      const old = btn.querySelector('.cd-overlay'); if(old) old.remove();
      if(cd>0){
        btn.classList.add('on-cd');
        const ov = document.createElement('div');
        ov.className = 'cd-overlay'; ov.textContent = cd.toFixed(1);
        btn.appendChild(ov);
      } else if(p.mp < mpCost){ 
        btn.classList.add('on-cd'); 
        btn.style.opacity='0.6';
      }
      else { btn.classList.remove('on-cd'); btn.style.opacity='1'; }
    }
  };
  upd(1, G.player);
  if(G.isPvp && G.player2) upd(2, G.player2);
}
setupTouchControls();
bindMobileFrame();

