"use strict";

/* ===== 基础 ===== */
const cvs = document.getElementById('c');
const ctx = cvs.getContext('2d');
const VW = 1280, VH = 720;
/* ★ 高清渲染：按设备像素比放大画布，逻辑坐标不变（解决画面发糊） */
const DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
cvs.width = Math.round(VW * DPR); cvs.height = Math.round(VH * DPR);

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

