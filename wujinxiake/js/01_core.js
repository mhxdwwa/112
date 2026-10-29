"use strict";

/* ===== 基础 ===== */
const cvs = document.getElementById('c');
const ctx = cvs.getContext('2d');
/* ★ 动态计算画布尺寸：铺满整个窗口，高度固定720，宽度按实际屏幕比例扩展 */
let VW = 1280, VH = 720;
function updateCanvasSize(){
  const winW = window.innerWidth;
  const winH = window.innerHeight;
  /* 高度始终为720，宽度按屏幕实际比例计算 */
  VH = 720;
  VW = Math.round(720 * (winW / winH));
  /* 确保最小宽度 */
  if(VW < 1280) VW = 1280;
  cvs.width = Math.round(VW * DPR);
  cvs.height = Math.round(VH * DPR);
  cvs.style.width = '100vw';
  cvs.style.height = '100vh';
}
/* ★ 高清渲染：按设备像素比放大画布，逻辑坐标不变（解决画面发糊）
   低端设备（CPU 核心少 / 内存小）自动降一档到 0.75：特效、玩法、布局全不变，
   只是少画像素，放技能时明显更流畅；好设备完全不受影响（仍是原来的 1~2 倍）。
   也可手动指定：网址加 ?perf=low 强制流畅模式，?perf=high 强制原画质。 */
const PERF_LOW = (function () {
  var q = '';
  try { q = String((new URLSearchParams(location.search).get('perf') || '')).toLowerCase(); } catch (e) {}
  if (q === 'high') return false;
  if (q === 'low') return true;
  var cores = navigator.hardwareConcurrency || 8;
  var mem = navigator.deviceMemory || 8;
  return (cores <= 4 || mem <= 4);
})();
const DPR = (function () {
  var base = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  var q = '';
  try { q = String((new URLSearchParams(location.search).get('perf') || '')).toLowerCase(); } catch (e) {}
  if (q === 'high') return base;
  if (q === 'low') return 0.75;
  var cores = navigator.hardwareConcurrency || 8;
  var mem = navigator.deviceMemory || 8;
  if (cores <= 4 || mem <= 4) return 0.75;
  return base;
})();
updateCanvasSize();
window.addEventListener('resize', updateCanvasSize);

/* ★ 游戏状态提前声明：菜单/音频等脚本里的监听器可能在后续文件加载完成前就被触发，
   若声明写在 18_jobs.js 里会报 "gameState is not defined" */
let gameState = 'menu';

/* NPC图片加载 */
const npcImages = {
  blacksmith: new Image(),
  merchant: new Image(),
  gatekeeper: new Image(),
  questmaster: new Image(),
  healer: new Image(),
  wanderer: new Image(),
  stash: new Image(),
  reforger: new Image()
};
npcImages.blacksmith.src = '铁匠王大锤.webp';
npcImages.merchant.src = '商人李掌柜.webp';
npcImages.gatekeeper.src = '守门人.webp';
npcImages.questmaster.src = '引灯人阿箬.webp';
npcImages.healer.src = '药师白婆婆.webp';
npcImages.wanderer.src = '说书人.webp';
/* 仓管 / 洗练师沿用已有立绘，换上不同站位即可，不再重复消耗素材 */
npcImages.stash.src = '商人李掌柜.webp';
npcImages.reforger.src = '铁匠王大锤.webp';
/* ★ 四方传送使专属立绘 */
npcImages.gate_east  = new Image();
npcImages.gate_south = new Image();
npcImages.gate_west  = new Image();
npcImages.gate_east.src  = '使者_青鸾.webp';
npcImages.gate_south.src = '使者_朱明.webp';
npcImages.gate_west.src  = '使者_白泽.webp';
npcImages.porter = new Image();
npcImages.porter.src = '使者_玄冥.webp';

/* 角色职业图片加载 */
const charImages = [
  new Image(), // 0: 宝剑剑士
  new Image(), // 1: 大刀剑客
  new Image(), // 2: 长枪枪手
  new Image()  // 3: 手套格斗家
];
charImages[0].src = '职业_宝剑剑士.webp';
charImages[1].src = '职业_大刀剑客.webp';
charImages[2].src = '职业_长枪枪手.webp';
charImages[3].src = '职业_格斗家.webp';

