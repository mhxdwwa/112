/* ===== 命名界面 ===== */
let nameInputClickRegions = [];

function drawNameInput(){
  ctx.fillStyle = 'rgba(0,0,0,0.9)';
  ctx.fillRect(0, 0, VW, VH);
  
  nameInputClickRegions = [];
  
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd166';
  ctx.font = 'bold 36px "Microsoft YaHei"';
  ctx.fillText('创建角色', VW/2, 150);
  
  ctx.fillStyle = '#aaa';
  ctx.font = '18px "Microsoft YaHei"';
  ctx.fillText('请输入你的角色名字', VW/2, 200);
  
  // 输入框
  const inputW = 400, inputH = 50;
  const inputX = VW/2 - inputW/2;
  const inputY = 250;
  
  ctx.fillStyle = 'rgba(40,40,60,0.8)';
  ctx.beginPath();
  ctx.roundRect(inputX, inputY, inputW, inputH, 8);
  ctx.fill();
  ctx.strokeStyle = nameInputActive ? '#ffd166' : '#666';
  ctx.lineWidth = 2;
  ctx.stroke();
  
  ctx.fillStyle = '#fff';
  ctx.font = '20px "Microsoft YaHei"';
  ctx.textAlign = 'left';
  ctx.fillText(playerName || '请输入名字...', inputX + 20, inputY + 32);
  
  // 确认按钮
  const btnW = 200, btnH = 50;
  const btnX = VW/2 - btnW/2;
  const btnY = 350;
  
  ctx.fillStyle = 'rgba(60,120,60,0.8)';
  ctx.beginPath();
  ctx.roundRect(btnX, btnY, btnW, btnH, 8);
  ctx.fill();
  ctx.strokeStyle = '#2ecc71';
  ctx.lineWidth = 2;
  ctx.stroke();
  
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 20px "Microsoft YaHei"';
  ctx.textAlign = 'center';
  ctx.fillText('开始游戏', btnX + btnW/2, btnY + 33);
  
  nameInputClickRegions.push({ x: btnX, y: btnY, w: btnW, h: btnH, confirm: true });
  
  // 提示
  ctx.fillStyle = '#888';
  ctx.font = '14px "Microsoft YaHei"';
  ctx.fillText('点击输入框后用键盘输入名字，按回车或点击开始游戏', VW/2, 450);
}

function drawCharPreview(char, weapon){
  /* 简化的角色预览图 */
  const pal = char.pal;
  /* 身体 */
  ctx.fillStyle = pal.cloth;
  ctx.fillRect(-12, -15, 24, 30);
  /* 头部 */
  ctx.fillStyle = pal.skin;
  ctx.beginPath(); ctx.arc(0, -25, 10, 0, Math.PI*2); ctx.fill();
  /* 帽子 */
  ctx.fillStyle = pal.hat;
  ctx.fillRect(-11, -35, 22, 8);
  /* 腰带 */
  ctx.fillStyle = pal.belt;
  ctx.fillRect(-13, 0, 26, 4);
  /* 武器简略 */
  ctx.strokeStyle = weapon.color;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  if(weapon.id==='sword' || weapon.id==='spear'){
    ctx.beginPath(); ctx.moveTo(15, -10); ctx.lineTo(15, -45); ctx.stroke();
  } else if(weapon.id==='blade'){
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(15, -10); ctx.lineTo(18, -40); ctx.stroke();
  } else if(weapon.id==='fist'){
    ctx.fillStyle = weapon.color;
    ctx.beginPath(); ctx.arc(15, -15, 5, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(-15, -15, 5, 0, Math.PI*2); ctx.fill();
  }
}

function drawPvpEnd(){
  ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillRect(0,0,VW,VH);
  pvpEndClickRegions = [];
  ctx.textAlign = 'center';
  const gateKeeper = !pvpFromMenu;
  if(pvpWinner === 0){
    ctx.fillStyle = '#aaa'; ctx.font = 'bold 56px "Microsoft YaHei"';
    ctx.fillText('平局！', VW/2, VH/2-20);
  } else if(gateKeeper){
    /* 守门人PK：显示胜负 */
    const win = pvpWinner === 1;
    ctx.fillStyle = win ? '#ffd700' : '#ff6a4a';
    ctx.font = 'bold 56px "Microsoft YaHei"';
    ctx.fillText(win ? '挑战成功！' : '挑战失败...', VW/2, VH/2-20);
  } else {
    const w = WEAPONS[pvpSelect[pvpWinner-1]];
    ctx.fillStyle = w.color; ctx.font = 'bold 56px "Microsoft YaHei"';
    ctx.fillText(`玩家${pvpWinner} 获胜！`, VW/2, VH/2-20);
  }
  const btnY = VH/2+70, btnW = 220, btnH = 55, btnX = VW/2-btnW/2;
  ctx.fillStyle = 'rgba(60,120,200,0.5)';
  ctx.beginPath(); ctx.roundRect(btnX,btnY,btnW,btnH,12); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 24px "Microsoft YaHei"';
  ctx.fillText(gateKeeper ? '返回城镇' : '返回主菜单', VW/2, btnY+35);
  pvpEndClickRegions.push({id:'back', x:btnX, y:btnY, w:btnW, h:btnH});
}

/* ★ 改进7: 暂停菜单 */
function drawPauseMenu(){
  // 半透明遮罩
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(0, 0, VW, VH);
  
  // 暂停面板（加大以容纳按钮）
  const panelW = 400, panelH = 420;
  const panelX = (VW - panelW) / 2, panelY = (VH - panelH) / 2;
  
  ctx.fillStyle = 'rgba(30,30,50,0.95)';
  ctx.beginPath();
  ctx.roundRect(panelX, panelY, panelW, panelH, 15);
  ctx.fill();
  ctx.strokeStyle = '#ffd166';
  ctx.lineWidth = 2;
  ctx.stroke();
  
  // 标题
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd166';
  ctx.font = 'bold 32px "Microsoft YaHei"';
  ctx.fillText('游戏暂停', VW/2, panelY + 50);
  
  // 提示文字
  ctx.fillStyle = '#aaa';
  ctx.font = '16px "Microsoft YaHei"';
  ctx.fillText('按 ESC 继续游戏', VW/2, panelY + 100);
  
  // 操作说明
  ctx.fillStyle = '#88ccff';
  ctx.font = '14px "Microsoft YaHei"';
  ctx.fillText('操作说明:', VW/2, panelY + 140);
  
  ctx.fillStyle = '#ccc';
  ctx.font = '13px "Microsoft YaHei"';
  ctx.textAlign = 'left';
  const instructions = [
    'WASD / 方向键 - 移动',
    'J - 攻击 / 交互',
    '1/2/3 - 释放技能',
    '空格 - 跳跃',
    'I - 背包  U - 技能  C - 角色',
    'B - 强化  ESC - 暂停'
  ];
  let iy = panelY + 165;
  for(const line of instructions){
    ctx.fillText(line, panelX + 60, iy);
    iy += 20;
  }
  
  // ★ 按钮区域
  pauseClickRegions = [];
  const btnW = 160, btnH = 44, btnGap = 20;
  const btnY = panelY + panelH - 70;
  
  // 继续游戏按钮
  const resumeX = VW/2 - btnW - btnGap/2;
  ctx.fillStyle = 'rgba(60,160,100,0.7)';
  ctx.beginPath(); ctx.roundRect(resumeX, btnY, btnW, btnH, 10); ctx.fill();
  ctx.strokeStyle = '#5ee6a0'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 18px "Microsoft YaHei"';
  ctx.textAlign = 'center';
  ctx.fillText('继续游戏', resumeX + btnW/2, btnY + 29);
  pauseClickRegions.push({ action:'resume', x:resumeX, y:btnY, w:btnW, h:btnH });
  
  // 返回城镇按钮
  const townX = VW/2 + btnGap/2;
  ctx.fillStyle = 'rgba(200,80,60,0.7)';
  ctx.beginPath(); ctx.roundRect(townX, btnY, btnW, btnH, 10); ctx.fill();
  ctx.strokeStyle = '#ff8a6a'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 18px "Microsoft YaHei"';
  ctx.textAlign = 'center';
  ctx.fillText('返回城镇', townX + btnW/2, btnY + 29);
  pauseClickRegions.push({ action:'backToTown', x:townX, y:btnY, w:btnW, h:btnH });
}
