/* ===== 键位系统 v41 =====
   · 地下城 / 守门人(城镇)PK  → 「战斗键位」：↑↓←→ 移动、X 普攻、A S D F G H 技能、Q 血瓶 W 内力瓶
   · 练习模式（主菜单双人PK） → 保留原经典分键：P1 WASD + J + 1~6 + H/G；P2 方向键 + 小键盘
     原因：两个人挤一个键盘必须分键，新键位的 A/S/D 会和 P2 的 WASD 移动直接抢键。
   · ESC → 键位设置 可自定义，存 localStorage，可一键恢复默认。
   ============================================================ */

const KB_ACTIONS = [
  { id:'up',      name:'向上移动', group:'移动' },
  { id:'down',    name:'向下移动', group:'移动' },
  { id:'left',    name:'向左移动', group:'移动' },
  { id:'right',   name:'向右移动', group:'移动' },
  { id:'attack',  name:'普通攻击', group:'战斗' },
  { id:'skill1',  name:'技能 1',   group:'战斗' },
  { id:'skill2',  name:'技能 2',   group:'战斗' },
  { id:'skill3',  name:'技能 3',   group:'战斗' },
  { id:'skill4',  name:'技能 4',   group:'战斗' },
  { id:'skill5',  name:'技能 5',   group:'战斗' },
  { id:'skill6',  name:'技能 6',   group:'战斗' },
  { id:'potionHp',name:'血瓶',     group:'道具' },
  { id:'potionMp',name:'内力瓶',   group:'道具' }
];

/* 新键位（地下城 / 城镇PK）默认值 */
const KB_BATTLE_DEFAULT = {
  up:'ArrowUp', down:'ArrowDown', left:'ArrowLeft', right:'ArrowRight',
  attack:'KeyX',
  skill1:'KeyA', skill2:'KeyS', skill3:'KeyD', skill4:'KeyF', skill5:'KeyG', skill6:'KeyH',
  potionHp:'KeyQ', potionMp:'KeyW'
};
/* 练习模式 P1（原样保留） */
const KB_P1_CLASSIC = {
  up:'KeyW', down:'KeyS', left:'KeyA', right:'KeyD',
  attack:'KeyJ',
  skill1:'Digit1', skill2:'Digit2', skill3:'Digit3', skill4:'Digit4', skill5:'Digit5', skill6:'Digit6',
  potionHp:'KeyH', potionMp:'KeyG'
};
/* 练习模式 P2（原样保留） */
const KB_P2_CLASSIC = {
  up:'ArrowUp', down:'ArrowDown', left:'ArrowLeft', right:'ArrowRight',
  attack:'Period',
  skill1:'Comma', skill2:'Slash', skill3:'Numpad6', skill4:'Numpad7', skill5:'Numpad8', skill6:'Numpad9',
  potionHp:'Numpad1', potionMp:'Numpad2'
};

let KB_CUSTOM = null;         /* 玩家自定义（存 localStorage） */
let kbCapture = null;         /* 正在等待按键的 action id */
let kbClickRegions = [];
let kbMsg = '';

function kbLoad(){
  KB_CUSTOM = null;
  try{
    const raw = localStorage.getItem('wjx_keybind_v1');
    if(raw){
      const o = JSON.parse(raw);
      if(o && typeof o === 'object') KB_CUSTOM = Object.assign({}, KB_BATTLE_DEFAULT, o);
    }
  }catch(e){ KB_CUSTOM = null; }
  if(!KB_CUSTOM) KB_CUSTOM = Object.assign({}, KB_BATTLE_DEFAULT);
}
function kbSave(){
  try{ localStorage.setItem('wjx_keybind_v1', JSON.stringify(KB_CUSTOM)); }catch(e){}
}
function kbReset(){
  KB_CUSTOM = Object.assign({}, KB_BATTLE_DEFAULT);
  kbSave();
  kbMsg = '已恢复默认键位';
}
/* 取某个玩家的键位表（playerNum 2 只在练习模式双人局出现） */
function kbProfile(playerNum){
  const pvpLocal = !!(G && G.isPvp && pvpFromMenu);
  if(playerNum === 2) return KB_P2_CLASSIC;
  if(pvpLocal) return KB_P1_CLASSIC;
  return KB_CUSTOM || KB_BATTLE_DEFAULT;
}
function kbDown(action, playerNum){
  const b = kbProfile(playerNum);
  const c = b && b[action];
  return !!(c && keys[c]);
}
function kbPressed(action, playerNum){
  const b = kbProfile(playerNum);
  const c = b && b[action];
  return !!(c && pressed[c]);
}
/* 当前键位表里所有会被游戏消费的键（用于 preventDefault 白名单） */
function kbAllCodes(){
  const set = {};
  [KB_CUSTOM || KB_BATTLE_DEFAULT, KB_P1_CLASSIC, KB_BATTLE_DEFAULT].forEach(function(b){
    for(const k in b) set[b[k]] = 1;
  });
  return Object.keys(set);
}
function kbLabel(code){
  if(!code) return '—';
  const m = {
    'ArrowUp':'↑', 'ArrowDown':'↓', 'ArrowLeft':'←', 'ArrowRight':'→',
    'Space':'空格', 'ShiftLeft':'左Shift', 'ShiftRight':'右Shift', 'Escape':'Esc',
    'Period':'.', 'Comma':',', 'Slash':'/', 'Semicolon':';', 'Quote':"'",
    'BracketLeft':'[', 'BracketRight':']', 'Backslash':'\\', 'Minus':'-', 'Equal':'=',
    'Enter':'Enter', 'Backspace':'退格', 'Tab':'Tab', 'ControlLeft':'左Ctrl', 'AltLeft':'左Alt'
  };
  if(m[code]) return m[code];
  if(code.indexOf('Key') === 0) return code.slice(3);
  if(code.indexOf('Digit') === 0) return code.slice(5);
  if(code.indexOf('Numpad') === 0) return '小键盘' + code.slice(6);
  return code;
}

/* ---------- 键位设置界面 ---------- */
function drawKeyBindMenu(){
  const pw = 720, ph = 560;
  const px = (VW - pw) / 2, py = (VH - ph) / 2;
  ctx.fillStyle = 'rgba(4,6,10,0.62)';
  ctx.fillRect(0, 0, VW, VH);

  const bg = ctx.createLinearGradient(px, py, px, py + ph);
  bg.addColorStop(0, 'rgba(28,36,54,0.98)');
  bg.addColorStop(1, 'rgba(10,14,22,0.99)');
  ctx.fillStyle = bg;
  ctx.beginPath(); ctx.roundRect(px, py, pw, ph, 14); ctx.fill();
  ctx.strokeStyle = 'rgba(201,168,76,0.45)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.roundRect(px + 0.5, py + 0.5, pw - 1, ph - 1, 14); ctx.stroke();

  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffe9b0'; ctx.font = 'bold 20px "Microsoft YaHei"';
  ctx.fillText('键 位 设 置', px + 30, py + 40);
  ctx.fillStyle = 'rgba(150,170,190,0.85)'; ctx.font = '12px "Microsoft YaHei"';
  ctx.fillText('点击右侧按键框，再按下新键即可替换；重复的键会自动互换', px + 30, py + 64);

  kbClickRegions = [];

  /* 两列排布 */
  const colW = (pw - 60) / 2, rowH = 30;
  const startY = py + 92;
  for(let i = 0; i < KB_ACTIONS.length; i++){
    const act = KB_ACTIONS[i];
    const col = i < 7 ? 0 : 1;
    const row = i < 7 ? i : i - 7;
    const bx = px + 30 + col * colW;
    const by = startY + row * (rowH + 6);

    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(190,205,220,0.9)'; ctx.font = '13px "Microsoft YaHei"';
    ctx.fillText(act.name, bx + 8, by + 20);

    const code = KB_CUSTOM[act.id];
    const capturing = kbCapture === act.id;
    const kw = 168, kx = bx + colW - kw - 14;
    ctx.fillStyle = capturing ? 'rgba(201,168,76,0.32)' : 'rgba(255,255,255,0.06)';
    ctx.beginPath(); ctx.roundRect(kx, by, kw, rowH, 6); ctx.fill();
    ctx.strokeStyle = capturing ? '#ffd166' : 'rgba(255,255,255,0.18)';
    ctx.lineWidth = capturing ? 2 : 1;
    ctx.beginPath(); ctx.roundRect(kx + 0.5, by + 0.5, kw - 1, rowH - 1, 6); ctx.stroke();

    ctx.textAlign = 'center';
    ctx.fillStyle = capturing ? '#fff3c4' : '#dbe7f5';
    ctx.font = 'bold 13px "Microsoft YaHei"';
    ctx.fillText(capturing ? '请按下新键…' : kbLabel(code), kx + kw / 2, by + 20);

    kbClickRegions.push({ x: kx, y: by, w: kw, h: rowH, id: 'bind', action: act.id });
  }

  /* 底部按钮 */
  const by2 = py + ph - 62;
  const btns = [
    { id:'reset', label:'恢复默认', w:130, color:'rgba(90,90,100,0.75)', text:'#dcd6c8' },
    { id:'back',  label:'返 回',   w:130, color:'rgba(70,110,170,0.85)', text:'#eaf3ff' }
  ];
  let bx2 = px + pw - 30 - (btns[0].w + btns[1].w + 14);
  for(const b of btns){
    ctx.fillStyle = b.color;
    ctx.beginPath(); ctx.roundRect(bx2, by2, b.w, 40, 8); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(bx2 + 0.5, by2 + 0.5, b.w - 1, 39, 8); ctx.stroke();
    ctx.fillStyle = b.text; ctx.font = 'bold 14px "Microsoft YaHei"'; ctx.textAlign = 'center';
    ctx.fillText(b.label, bx2 + b.w / 2, by2 + 25);
    kbClickRegions.push({ x: bx2, y: by2, w: b.w, h: 40, id: b.id });
    bx2 += b.w + 14;
  }

  if(kbMsg){
    ctx.textAlign = 'left';
    ctx.fillStyle = '#9fe6ff'; ctx.font = '12.5px "Microsoft YaHei"';
    ctx.fillText(kbMsg, px + 30, by2 + 26);
  }

  /* 切换提示 */
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(140,160,180,0.7)'; ctx.font = '11.5px "Microsoft YaHei"';
  ctx.fillText('※ 本套键位作用于地下城与城镇PK；练习模式（双人同屏）仍使用方向键+小键盘分键', px + 30, py + ph - 92);
}

function kbClick(pos){
  const r = hitTestRegion(pos.x, pos.y, kbClickRegions);
  if(!r) return;
  if(r.id === 'back'){ kbCapture = null; gameState = 'gameMenu'; }
  else if(r.id === 'reset'){ kbCapture = null; kbReset(); }
  else if(r.id === 'bind'){ kbCapture = r.action; kbMsg = ''; }
}

/* 捕获新键：注册在 05_audio 的 keydown 之后，keys[] 已经写好 */
addEventListener('keydown', function(e){
  if(!kbCapture) return;
  if(gameState !== 'keyBindMenu'){ kbCapture = null; return; }
  e.preventDefault();
  if(e.code === 'Escape'){ kbCapture = null; kbMsg = '已取消'; return; }

  const act = kbCapture;
  const code = e.code;
  /* 冲突处理：这个键已被别的动作占用 → 两者互换 */
  for(const k in KB_CUSTOM){
    if(k !== act && KB_CUSTOM[k] === code){
      KB_CUSTOM[k] = KB_CUSTOM[act];
      break;
    }
  }
  KB_CUSTOM[act] = code;
  kbCapture = null;
  kbSave();
  kbMsg = '已设置为 ' + kbLabel(code);
}, false);

kbLoad();
