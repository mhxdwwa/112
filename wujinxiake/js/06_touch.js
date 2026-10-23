/* ===== 触屏控制 ===== */
const touchState = { p1: { x: 0, y: 0, active: false }, p2: { x: 0, y: 0, active: false } };

/* ★ 区分「手机浏览器」和「电脑/大屏浏览器」
   核心判据：屏幕物理尺寸。
   ─ 屏幕短边 < 600px → 手机/小平板（7寸以下），用触屏摇杆 + 按键
   ─ 屏幕短边 ≥ 600px → 电脑 / 教室大屏 / 大平板，用键盘操作
   手机最大也就 ~4.3 寸（短边 ~750px 但 DPR 高，CSS 像素短边 ~380-430），
   教室大屏最小也 21 寸（CSS 短边 ≥ 700px），600px 阈值不会混淆。
   有鼠标时无论屏幕大小一律当电脑。 */
function isMobileBrowser(){
  /* 第一判据：有物理鼠标 → 一定是电脑 */
  if(window.matchMedia && window.matchMedia('(pointer: fine)').matches) return false;

  /* 第二判据：屏幕物理尺寸（CSS 像素，已除 DPR）
     手机竖屏短边 ~320-430，横屏短边 ~320-430
     教室大屏短边 ≥ 700，600px 阈值留足余量 */
  var minSide = Math.min(screen.width || 9999, screen.height || 9999);
  if(minSide >= 600) return false;

  /* 到这里：没鼠标 + 小屏，需要确认是移动设备 */
  var touch = (navigator.maxTouchPoints || 0) > 0 || ('ontouchstart' in window);
  if(!touch) return false;

  /* 移动端 UA 确认 */
  var ua = navigator.userAgent || '';
  var mobileUA = /Android|iPhone|iPod|iPad|Windows Phone|HarmonyOS|OpenHarmony|Mobile Safari|MicroMessenger/i.test(ua);
  if(mobileUA) return true;

  /* 兜底：没鼠标 + 小屏 + 有触摸 → 当手机处理 */
  return true;
}
const IS_MOBILE_BROWSER = isMobileBrowser();
window.IS_MOBILE_BROWSER = IS_MOBILE_BROWSER;

/* ★ 这台机器到底有没有触摸屏
   鼠标电脑（没有触摸）不显示虚拟按键，只留键盘操作与画面里的快捷键提示；
   电脑触屏 / 手机才显示。万一真的想在鼠标电脑上看，加 ?touch=1。 */
const IS_TOUCH = (navigator.maxTouchPoints || 0) > 0 || ('ontouchstart' in window);
window.IS_TOUCH = IS_TOUCH;
function shouldShowTouch(){
  if(/[?&](ui=mobile|touch=1)\b/.test(location.search)) return true;
  if(!IS_TOUCH) return false;
  if(IS_MOBILE_BROWSER) return true;
  /* 电脑触屏：小窗口（笔记本）才显示，大屏桌面键鼠更顺手 */
  const short = Math.min(window.innerWidth || 0, window.innerHeight || 0);
  return short > 0 && short < 900;
}

/* ★ 按键位置一律由 JS 写死成像素（inline style），不依赖 CSS 层叠
   原因：浏览器/Cloudflare 可能缓存到旧版 touch.css，出现「摇杆在左下、按键却叠在旁边」
   这种只在部分机器上复现的错位。坐标与原来 CSS 里的数值完全一致，视觉不变。 */
const ARC_BTN = {
  attack:[124,6,70,70], jump:[196,20,50,50], glide:[230,132,50,50],
  skill1:[196,76,52,52], skill2:[148,114,52,52], skill3:[72,124,52,52],
  skill4:[20,108,46,46], skill5:[68,202,46,46], skill6:[138,218,46,46]
};

function placeBtn(el, o){
  if(!el) return;
  const s = el.style;
  s.position = 'absolute';
  s.left = s.right = s.top = s.bottom = 'auto';
  if(o.left != null) s.left = o.left + 'px';
  if(o.right != null) s.right = o.right + 'px';
  if(o.bottom != null) s.bottom = o.bottom + 'px';
  if(o.top != null) s.top = o.top + 'px';
  if(o.width != null){ s.width = o.width + 'px'; s.height = o.height + 'px'; }
}
function clearBtnPos(el){
  if(!el) return;
  const s = el.style;
  s.left = s.right = s.top = s.bottom = s.width = s.height = '';
}

/* 电脑排布：原弧形坐标（与历史版本一致，一名一数都没改） */
function layoutArc(){
  [1, 2].forEach(function(n){
    const area = document.querySelector('.p' + n + '-area');
    if(!area) return;
    area.style.position = 'fixed';
    area.style.top = 'auto'; area.style.bottom = '10px';
    area.style.width = '260px'; area.style.height = '260px';
    if(n === 1){ area.style.left = '10px'; area.style.right = 'auto'; }
    else { area.style.right = '10px'; area.style.left = 'auto'; }

    const joy = area.querySelector('.joystick-container');
    if(joy){
      joy.style.position = 'absolute';
      joy.style.top = 'auto'; joy.style.bottom = '0px';
      joy.style.width = '110px'; joy.style.height = '110px';
      if(n === 1){ joy.style.left = '0px'; joy.style.right = 'auto'; }
      else { joy.style.right = '0px'; joy.style.left = 'auto'; }
    }
    const pad = area.querySelector('.action-pad');
    if(pad){ pad.style.position = 'absolute'; pad.style.inset = '0'; pad.style.display = 'block'; pad.style.width = 'auto'; pad.style.height = 'auto'; }

    area.querySelectorAll('.skill-btn').forEach(function(btn){
      const a = ARC_BTN[btn.dataset.action];
      if(!a) return;
      const o = { bottom: a[1], width: a[2], height: a[3] };
      if(n === 1) o.left = a[0]; else o.right = a[0];
      placeBtn(btn, o);
    });
  });
  updateHudIconAnchor();
}

/* 手机排布：摇杆贴左下、8 键贴右下（4 列 × 2 行，普攻落最角上） */
function layoutPhone(){
  const f = window.__uiFrame || {};
  const W = f.w || window.innerWidth || 360;
  const H = f.h || window.innerHeight || 640;
  const tb = f.tb || 44;
  const joy = f.joy || 90;
  const gap = Math.max(4, Math.round(H * 0.012));
  const edge = Math.max(6, Math.round(Math.min(H, W) * 0.022));
  const tk = Math.round(tb * 1.30), tj = Math.round(tb * 1.06);

  const area = document.querySelector('.p1-area');
  if(!area) return;
  area.style.position = 'absolute';
  area.style.left = '0px'; area.style.top = '0px'; area.style.right = 'auto'; area.style.bottom = 'auto';
  area.style.width = W + 'px'; area.style.height = H + 'px';

  const joyEl = area.querySelector('.joystick-container');
  if(joyEl){
    joyEl.style.position = 'absolute';
    joyEl.style.width = joy + 'px'; joyEl.style.height = joy + 'px';
    joyEl.style.left = edge + 'px'; joyEl.style.right = 'auto';
    joyEl.style.bottom = edge + 'px'; joyEl.style.top = 'auto';
  }
  const pad = area.querySelector('.action-pad');
  if(pad){ pad.style.position = 'absolute'; pad.style.inset = '0'; pad.style.display = 'block'; pad.style.width = 'auto'; pad.style.height = 'auto'; }

  const rowH2 = Math.max(tk, tj);
  const cols = [
    [['skill3', tb], ['attack', tk], [null, 0]],
    [['skill4', tb], ['jump', tj], ['glide', tj]],
    [['skill5', tb], ['skill1', tb], [null, 0]],
    [['skill6', tb], ['skill2', tb], [null, 0]]
  ];
  let x = W - edge;
  cols.forEach(function(col){
    const sizes = col.filter(c => c[1] > 0).map(c => c[1]);
    const w = Math.max(...sizes);
    const cx = x - w / 2;
    col.forEach(function(item, i){
      const action = item[0], size = item[1];
      if(!action || size === 0) return;
      const btn = area.querySelector('.skill-btn[data-action="' + action + '"]');
      const bottom = i === 0 ? (edge + rowH2 * 2 + gap * 2) : (i === 1 ? (edge + rowH2 + gap) : edge);
      placeBtn(btn, { left: Math.round(cx - size / 2), bottom: bottom, width: size, height: size });
    });
    x -= (w + gap);
  });
}

/* ESC 圆钮：贴左边，位置放在摇杆正上方（不压左侧图标列 / 任务追踪框） */
function positionEsc(){
  const b = document.getElementById('btnEsc');
  if(!b) return;
  const h = b.offsetHeight || 46;
  const w = b.offsetWidth || 46;
  const cv = document.getElementById('c');
  /* 城镇左侧按钮列（26_hud.js）：x=84, y0=158, gap=62, 尺寸 52
     第 3 个是「角色」→ 中心 y = 158 + 2*62 + 26 = 308（画布坐标）
     左侧留出 84px 的独立竖条放 ESC，所以 ESC 与图标列不重叠 */
  const LEFT = 8, cy = 308, iconX = 84, iconY = 282;
  let top = 8;
  b.style.left = LEFT + 'px';
  if(cv){
    const r = cv.getBoundingClientRect();
    const vw = (typeof VW !== 'undefined' && VW) ? VW : 1280;
    const vh = (typeof VH !== 'undefined' && VH) ? VH : 720;
    if(r.height > 0){
      const sx = r.width / vw, sy = r.height / vh;
      const iconLeft = r.left + iconX * sx;
      if(LEFT + w + 6 > iconLeft){
        /* 屏幕太窄（手机）：横向塞不下，就挪到图标列正上方，仍然不压图标 */
        top = Math.round(r.top + 158 * sy - h - 8);   /* 158 = 图标列顶端 */
      } else {
        top = Math.round(r.top + cy * sy - h / 2);
      }
    }
  }
  b.style.top = (top > 8 ? top : 8) + 'px';
}


/* ---------- 给 HUD 图标用的锚点：↑（跳跃）键的右侧 ----------
   四个功能图标画在 canvas 上，位置需要跟着 DOM 里的跳跃键走，
   所以按画布缩放换算成「虚拟坐标」交给 26_hud.js 使用。 */
function updateHudIconAnchor(){
  try{
    const cv = document.getElementById('c');
    const tc = document.getElementById('touchControls');
    const jb = document.querySelector('#touchControls .p1-area .jump-btn');
    if(!cv || !tc || !jb || !tc.classList.contains('active') || tc.classList.contains('mobile')){
      window.__hudIconAnchor = null;
      return;
    }
    const r = cv.getBoundingClientRect();
    const b = jb.getBoundingClientRect();
    if(!r.width || !b.width){ window.__hudIconAnchor = null; return; }
    const vw = (typeof VW !== 'undefined' && VW) ? VW : 1280;
    const vh = (typeof VH !== 'undefined' && VH) ? VH : 720;
    const sx = vw / r.width, sy = vh / r.height;
    window.__hudIconAnchor = {
      x: (b.right - r.left) * sx + 14,                 /* 紧贴 ↑ 键右侧 */
      y: (b.top - r.top) * sy + (b.height * sy) / 2    /* 与 ↑ 键垂直居中 */
    };
  }catch(e){ window.__hudIconAnchor = null; }
}

function layoutTouch(){
  const tc = document.getElementById('touchControls');
  if(!tc) return;
  if(!tc.classList.contains('active')) return;
  if(!tc.classList.contains('mobile')){ layoutArc(); positionEsc(); return; }
  /* 双人同屏交给 CSS 网格（左右各占一侧）：把之前写进去的 inline 坐标全部清掉 */
  if(tc.classList.contains('pvp')){
    document.querySelectorAll('#touchControls .p1-area, #touchControls .p2-area, #touchControls .action-pad, #touchControls .joystick-container, #touchControls .skill-btn')
      .forEach(function(el){ el.style.cssText = ''; });
    positionEsc();
    return;
  }
  layoutPhone();
  positionEsc();
}
window.layoutTouch = layoutTouch;

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
    /* 只在「画布基本铺满屏幕」（横屏正常游玩）时对齐画布；
       竖屏时画布很小、上下留白多，仍按窗口贴边，免得按键飘到屏幕中间 */
    if(r.width >= 240 && r.height >= 160 && r.height >= (window.innerHeight || 0) * 0.6){
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
  /* 量完尺寸立刻按像素摆键，避免任何 CSS 层叠/缓存导致的错位 */
  if(typeof layoutTouch === 'function') layoutTouch();
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
      else if(action==='glide'){ if(player==='1') pressed['ShiftLeft']=true; else pressed['ShiftRight']=true; }
    };
    btn.addEventListener('touchstart', trigger);
    btn.addEventListener('mousedown', trigger);
  });
  window.showTouchControls = (isPvp)=>{
    /* 触屏控件常驻（电脑也显示：不少人是触屏本/也习惯点按钮），
       位置由 layoutTouch() 按像素写死，电脑仍是原来的弧形排布 */
    touchControls.classList.add('active');
    const p2Area = document.getElementById('p2Controls');
    if(p2Area) p2Area.style.display = isPvp ? 'block' : 'none';
    /* 双人同屏时按键改为各贴自己那一侧的摇杆内侧，单人时 8 键全在右下角 */
    touchControls.classList.toggle('pvp', !!isPvp);
    applyMobileFrame();
    layoutTouch();
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


/* ---------- 触屏 ESC 键：左侧正中间 ----------
   手机/触屏电脑没有键盘，给一个等效于 Esc 的圆钮：
   战斗中暂停、城镇里开关系统菜单、弹窗里关掉回到上一层。 */
(function(){
  function escAction(){
    if(typeof gameState === 'undefined') return;
    /* 城镇里的玩家资料卡优先关掉 */
    try{
      const oc = document.getElementById('opCard');
      if(oc && oc.classList.contains('open')){
        if(window.__wjxCard && window.__wjxCard.hide) window.__wjxCard.hide();
        else oc.classList.remove('open');
        return;
      }
    }catch(e){}
    try{
      if(typeof DIALOGUE !== 'undefined' && DIALOGUE){
        if(typeof advanceDialogue === 'function') advanceDialogue();
        return;
      }
    }catch(e){}
    if(gameState === 'playing') gameState = 'paused';
    else if(gameState === 'paused') gameState = 'playing';
    else if(gameState === 'equipWiki') gameState = 'gameMenu';
    else if(gameState === 'gameMenu') gameState = 'town';
    else if(gameState === 'town') gameState = 'gameMenu';
    else if(gameState === 'inventory' || gameState === 'skillMenu' || gameState === 'characterInfo' ||
            gameState === 'questMenu' || gameState === 'enhanceMenu' || gameState === 'shopMenu' ||
            gameState === 'levelSelect' || gameState === 'dungeonSelect') gameState = 'town';
  }
  function boot(){
    const b = document.getElementById('btnEsc');
    if(!b) return;
    /* 电脑浏览器也显示（用户要求：手机/电脑都要有 ESC） */
    b.classList.add('show');
    let lock = 0;
    const fire = function(e){
      if(e){ e.preventDefault(); e.stopPropagation(); }
      const now = Date.now();
      if(now - lock < 260) return;   /* 防止 click + touchstart 触发两次 */
      lock = now;
      escAction();
    };
    b.addEventListener('touchstart', fire, { passive: false });
    b.addEventListener('mousedown', fire);
    window.addEventListener('resize', function(){ positionEsc(); setTimeout(updateHudIconAnchor, 60); });
    window.addEventListener('orientationchange', function(){ setTimeout(updateHudIconAnchor, 320); });
    setTimeout(updateHudIconAnchor, 400);
    setTimeout(updateHudIconAnchor, 1500);
    window.addEventListener('orientationchange', function(){ setTimeout(positionEsc, 260); });
    setTimeout(positionEsc, 300);
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
