/* ===== 触屏控制 ===== */
const touchState = { p1: { x: 0, y: 0, active: false }, p2: { x: 0, y: 0, active: false } };

function setupTouchControls(){
  const touchControls = document.getElementById('touchControls');
  function setupJoystick(joystickId, stickId, playerKey){
    const joystick = document.getElementById(joystickId);
    const stick = document.getElementById(stickId);
    const base = joystick.querySelector('.joystick-base');
    let activeTouch = null, isMouseDown = false;
    const updateStick = (cx, cy) => {
      const rect = base.getBoundingClientRect();
      const ccx = rect.left + rect.width / 2, ccy = rect.top + rect.height / 2;
      const dx = cx - ccx, dy = cy - ccy;
      const dist = Math.min(Math.hypot(dx, dy), 50);
      const ang = Math.atan2(dy, dx);
      stick.style.transform = `translate(calc(-50% + ${Math.cos(ang)*dist}px), calc(-50% + ${Math.sin(ang)*dist}px))`;
      touchState[playerKey].x = Math.cos(ang)*dist/50;
      touchState[playerKey].y = Math.sin(ang)*dist/50;
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
  };
  window.hideTouchControls = ()=>{
    touchControls.classList.remove('active');
    document.querySelectorAll('.skill-btn').forEach(btn=>{
      btn.classList.remove('on-cd'); btn.style.opacity='1';
      const o = btn.querySelector('.cd-overlay'); if(o) o.remove();
    });
  };
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

