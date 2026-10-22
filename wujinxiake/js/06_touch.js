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

function setupTouchControls(){
  const touchControls = document.getElementById('touchControls');
  /* 手机浏览器才启用紧凑阵列；电脑触屏维持原有弧形排布
     （调试时可用 ?ui=mobile 强制预览手机排布） */
  const forceMobile = /[?&]ui=mobile\b/.test(location.search);
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

