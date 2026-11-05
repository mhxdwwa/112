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
/* ============================================================
   ★ 画质治理系统（为教室大屏弱机设计，2026-11-05 重构）
   三档：0=流畅(极简) / 1=均衡 / 2=高画质
   - 启动时自动检测：WebGL 渲染器字符串识别软渲染（SwiftShader/llvmpipe，
     教室机旧驱动常见，软渲染下一切开销×10）+ shadowBlur 微基准 + 核心数/内存
   - 自动模式下游戏运行中还会按帧率升降档（见 33_main_loop）
   - 手动锁档：ESC 系统菜单「画质」栏切换，localStorage 持久化
   - 网址参数仍有效：?perf=low 强制流畅档，?perf=high 强制高画质
   ============================================================ */
window.PFX = window.PFX || { cap: 560, scale: 1, slow: 0, shadow: 1 };
const PERF_LOW = (function () {
  var q = '';
  try { q = String((new URLSearchParams(location.search).get('perf') || '')).toLowerCase(); } catch (e) {}
  return q === 'low';
})();
const __dprBase = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
let DPR = 1;

/* 各档位参数：弱机跑得动是第一优先级，特效浓度由档位兜底 */
const QUALITY_TIERS = [
  /* 0 流畅：零模糊零滤镜，画布 720p，粒子/特效大幅收紧 —— 软渲染教室机的目标档 */
  { name: '流畅', dpr: 1,            cap: 130, scale: 0.38, slow: 1, shadow: 0,   fxMax: 22, filter: false },
  /* 1 均衡：不超屏分辨率，中等特效 */
  { name: '均衡', dpr: 1,            cap: 340, scale: 0.72, slow: 0, shadow: 0.5, fxMax: 46, filter: true },
  /* 2 高画质：跟随设备像素比（最高2x），全特效 */
  { name: '高画质', dpr: __dprBase, cap: 560, scale: 1,    slow: 0, shadow: 1,   fxMax: 78, filter: true }
];
window.QUALITY = { mode: 'auto', tier: 2, autoBase: 2, softRender: false };

function applyQuality(){
  const t = QUALITY_TIERS[Math.max(0, Math.min(2, QUALITY.tier))];
  DPR = t.dpr;
  window.PFX.cap = t.cap;
  window.PFX.scale = t.scale;
  window.PFX.slow = t.slow;
  window.PFX.shadow = t.shadow;
  window.PFX.fxMax = t.fxMax;
  window.PFX.filter = t.filter;
  window.PFX.tier = QUALITY.tier;
  updateCanvasSize();
}
/* 档位显示名（菜单用） */
function qualityLabel(){
  const t = QUALITY_TIERS[Math.max(0, Math.min(2, QUALITY.tier))];
  return (QUALITY.mode === 'auto' ? '自动 · ' : '锁定 · ') + t.name;
}
function setQualityMode(mode, tier){
  QUALITY.mode = mode;
  if(mode === 'auto'){
    QUALITY.tier = QUALITY.autoBase;
    try { localStorage.removeItem('wjq_quality'); } catch(e){}
  } else {
    QUALITY.tier = Math.max(0, Math.min(2, tier|0));
    try { localStorage.setItem('wjq_quality', String(QUALITY.tier)); } catch(e){}
  }
  applyQuality();
}
function cycleQuality(dir){
  /* auto → 2 → 1 → 0 → auto 循环 */
  if(QUALITY.mode === 'auto') setQualityMode('manual', dir > 0 ? 2 : 1);
  else {
    const t = QUALITY.tier + dir;
    if(t > 2) setQualityMode('auto');
    else if(t < 0) setQualityMode('auto');
    else setQualityMode('manual', t);
  }
}
/* 启动检测：软渲染/弱核 → 直接从流畅或均衡档起步 */
(function __qualityInit(){
  let saved = null, q = '';
  try { saved = localStorage.getItem('wjq_quality'); } catch(e){}
  try { q = String((new URLSearchParams(location.search).get('perf') || '')).toLowerCase(); } catch(e){}
  if(q === 'low'){ QUALITY.mode = 'manual'; QUALITY.tier = 0; }
  else if(q === 'high'){ QUALITY.mode = 'manual'; QUALITY.tier = 2; }
  else if(saved !== null && saved !== ''){ QUALITY.mode = 'manual'; QUALITY.tier = Math.max(0, Math.min(2, saved|0)); }
  else {
    /* 自动档初判：先按硬件给个保守起点，几百毫秒后跑微基准再修正 */
    const cores = navigator.hardwareConcurrency || 8;
    const mem = navigator.deviceMemory || 8;
    QUALITY.tier = (cores <= 4 || mem <= 4) ? 0 : 2;
    QUALITY.autoBase = QUALITY.tier;
    setTimeout(function(){
      let soft = false, blurMs = 0;
      try {
        const gc = document.createElement('canvas');
        const gl = gc.getContext('webgl') || gc.getContext('experimental-webgl');
        if(!gl) soft = true;
        else {
          const ext = gl.getExtension('WEBGL_debug_renderer_info');
          const r = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER) || '');
          if(/swiftshader|llvmpipe|software|basic render|angle \(software\)/i.test(r)) soft = true;
        }
      } catch(e){}
      try {
        const bc = document.createElement('canvas'); bc.width = bc.height = 256;
        const b = bc.getContext('2d');
        b.shadowColor = '#fff'; b.shadowBlur = 20; b.fillStyle = '#fff';
        const t0 = performance.now();
        for(let i = 0; i < 60; i++) b.fillRect((i * 37) % 200, (i * 53) % 200, 40, 40);
        blurMs = performance.now() - t0;
      } catch(e){}
      QUALITY.softRender = soft;
      if(soft || blurMs > 140) QUALITY.autoBase = 0;        /* 软渲染/极弱核：锁定流畅档 */
      else if(blurMs > 45)     QUALITY.autoBase = 1;        /* 偏弱：均衡档 */
      else                     QUALITY.autoBase = 2;
      if(QUALITY.mode === 'auto'){ QUALITY.tier = QUALITY.autoBase; applyQuality(); }
    }, 300);
  }
  applyQuality();
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

