/* ===== 角色精灵表 =====
   剑士/剑客/枪士/格斗家：6x6 旧版图集（assets/<职业>/<职业>_atlas.webp）
   撼山者/符咒师/丹道师：8x8 旧版图集（assets/chars/*_atlas.webp）
   炼药师：8x8 新版图集（assets/chars/herb_atlas.webp）
*/
const CHAR_ATLASES = {
  sword: { url:'assets/swordsman/swordsman_atlas.webp', ready:false, img:new Image(),  /* 剑士 */
    cellW:353, cellH:414, cols:6, rows:6,
    feetX:178, groundY:328, bodyH:230.0, bodyWorld:110,
    anims:{ idle:{frames:[0,1,2,3]}, run:{frames:[4,5,6,7,8,9,10,11]}, atk1:{frames:[12,13,14,15]}, atk2:{frames:[16,17,18,19]}, atk3:{frames:[20,21,22,23]}, skill:{frames:[24,25,26]}, jump:{frames:[27,28]}, dodge:{frames:[29,30]}, hurt:{frames:[31]}, death:{frames:[32,33]}, victory:{frames:[34]} } },
  blade: { url:'assets/blade/blade_atlas.webp', ready:false, img:new Image(),  /* 剑客 */
    cellW:382, cellH:414, cols:6, rows:6,
    feetX:159, groundY:328, bodyH:230.0, bodyWorld:106,
    anims:{ idle:{frames:[0,1,2,3]}, run:{frames:[4,5,6,7,8,9,10,11]}, atk1:{frames:[12,13,14,15]}, atk2:{frames:[16,17,18]}, atk3:{frames:[19,20,21]}, skill:{frames:[22,23,24]}, jump:{frames:[25,26]}, dodge:{frames:[27,28]}, hurt:{frames:[29]}, death:{frames:[30,31]}, victory:{frames:[32]} } },
  spear: { url:'assets/spear/spear_atlas.webp', ready:false, img:new Image(),  /* 枪士 */
    cellW:441, cellH:414, cols:6, rows:6,
    feetX:186, groundY:328, bodyH:230.0, bodyWorld:120,
    anims:{ idle:{frames:[0,1,2,3]}, run:{frames:[4,5,6,7,8,9,10,11]}, atk1:{frames:[12,13,14,15]}, atk2:{frames:[16,17,18,19]}, atk3:{frames:[20,21,22,23]}, skill:{frames:[24,25,26]}, jump:{frames:[27,28]}, dodge:{frames:[29,30]}, hurt:{frames:[31]}, death:{frames:[32,33]}, victory:{frames:[34]} } },
  fist: { url:'assets/fist/fist_atlas.webp', ready:false, img:new Image(),  /* 格斗家 */
    cellW:365, cellH:414, cols:6, rows:6,
    feetX:149, groundY:328, bodyH:230.0, bodyWorld:100,
    anims:{ idle:{frames:[0,1,2,3]}, run:{frames:[4,5,6,7,8,9,10,11]}, atk1:{frames:[12,13,14,15]}, atk2:{frames:[16,17,18,19]}, atk3:{frames:[20,21,22,23]}, skill:{frames:[24,25,26,27]}, jump:{frames:[28,29]}, dodge:{frames:[30,31]}, hurt:{frames:[32]}, death:{frames:[33,34]}, victory:{frames:[35]} } },
  herb: { url:'assets/chars/herb_atlas.webp?v=5', ready:false, img:new Image(),  /* 炼药师（32帧动作版：待机4/走路8/攻击8/技能8/跳跃4） */
    cellW:256, cellH:256, cols:8, rows:8,
    feetX:128, groundY:244, bodyH:201.0, bodyWorld:112,
    anims:{ idle:{frames:[0,1,2,3]}, run:{frames:[4,5,6,7,8,9,10,11]}, atk1:{frames:[12,13,14,15]}, atk2:{frames:[16,17,18,19]}, atk3:{frames:[16,17,18,19]}, skill:{frames:[20,21,22,23,24,25,26,27]}, jump:{frames:[28,29,30,31]}, dodge:{frames:[28,29,30]}, hurt:{frames:[31]}, death:{frames:[30,31]}, victory:{frames:[0]} } },
  axe: { url:'assets/chars/mountaineer_atlas.webp', ready:false, img:new Image(),  /* 撼山者 */
    cellW:256, cellH:256, cols:8, rows:8,
    feetX:105.6, groundY:214.0, bodyH:215.0, bodyWorld:124, faceLeft:true,
    anims:{ idle:{frames:[0,1,2,3,4,5,6,7]}, run:{frames:[8,9,10,11,12,13,14,15,16,17,18,19]}, atk1:{frames:[20,21,22,23,24,25]}, atk2:{frames:[26,27,28,29,30,31]}, atk3:{frames:[32,33,34,35,36,37,38]}, skill:{frames:[39,40,41,42,43,44,45,46]}, jump:{frames:[47,48,49]}, dodge:{frames:[50,51,52]}, hurt:{frames:[53]}, death:{frames:[54,55,56,57]}, victory:{frames:[58,59]} } },
  talisman: { url:'assets/chars/talismanist_atlas.webp', ready:false, img:new Image(),  /* 符咒师 */
    cellW:256, cellH:256, cols:8, rows:8,
    feetX:110.0, groundY:216.6, bodyH:215.0, bodyWorld:110,
    anims:{ idle:{frames:[0,1,2,3,4,5,6,7]}, run:{frames:[8,9,10,11,12,13,14,15,16,17,18,19]}, atk1:{frames:[20,21,22,23,24,25]}, atk2:{frames:[26,27,28,29,30,31]}, atk3:{frames:[32,33,34,35,36,37,38]}, skill:{frames:[39,40,41,42,43,44,45,46]}, jump:{frames:[47,48,49]}, dodge:{frames:[50,51,52]}, hurt:{frames:[53]}, death:{frames:[54,55,56,57]}, victory:{frames:[58,59]} } },
  cauldron: { url:'assets/chars/danmaster_atlas.webp', ready:false, img:new Image(),  /* 丹道师 */
    cellW:256, cellH:256, cols:8, rows:8,
    feetX:109.5, groundY:214.0, bodyH:215.0, bodyWorld:116, faceLeft:true,
    anims:{ idle:{frames:[0,1,2,3,4,5,6,7]}, run:{frames:[8,9,10,11,12,13,14,15,16,17,18,19]}, atk1:{frames:[20,21,22,23,24,25]}, atk2:{frames:[26,27,28,29,30,31]}, atk3:{frames:[32,33,34,35,36,37,38]}, skill:{frames:[39,40,41,42,43,44,45,46]}, jump:{frames:[47,48,49]}, dodge:{frames:[50,51,52]}, hurt:{frames:[53]}, death:{frames:[54,55,56,57]}, victory:{frames:[58,59]} } },
};
/* ===== 图集加载策略（首屏提速）=====
   以前：开局同时请求 8 张 2048×2048 图集（合计约 5.9MB），选人界面要等很久才出人。
   现在：① 先加载 256px 的 idle 预览图（8 张合计约 80KB），标题/选人界面立即出人；
         ② 完整图集改为「空闲时逐张补齐」，不再和首屏抢带宽；
         ③ 真正要用到某职业时（进战斗）调用 ensureCharAtlas 立即优先加载。 */
const __charAtlasQueue = [];
for(const key in CHAR_ATLASES){
  const at = CHAR_ATLASES[key];
  at._started = false;
  /* 预览图 = 图集第 0 帧的缩小版，坐标比例与图集一致，可直接套用同一套绘制参数 */
  at.prevImg = new Image();
  at.prevReady = false;
  at.prevImg.onload = ()=>{ at.prevReady = true; };
  at.prevImg.onerror = ()=>{ at.prevReady = false; };
  at.prevImg.src = 'assets/previews/' + key + '.webp';
  at.prevK = 256 / at.cellH;
  at.prevAt = {
    ready:true, img:at.prevImg, cols:1, rows:1,
    cellW: at.cellW * at.prevK, cellH: at.cellH * at.prevK,
    feetX: at.feetX * at.prevK, groundY: at.groundY * at.prevK,
    bodyH: at.bodyH * at.prevK, bodyWorld: at.bodyWorld,
    faceLeft: !!at.faceLeft,
    anims:{ idle:{frames:[0]}, run:{frames:[0]}, atk1:{frames:[0]}, atk2:{frames:[0]},
            atk3:{frames:[0]}, skill:{frames:[0]}, jump:{frames:[0]}, dodge:{frames:[0]},
            hurt:{frames:[0]}, death:{frames:[0]}, victory:{frames:[0]} }
  };
  __charAtlasQueue.push(key);
}
/* 绘制时取可用图源：完整图集优先，未就绪则退回预览图 */
function charAtlasDrawable(at){
  if(!at) return null;
  if(at.ready && at.img && at.img.naturalWidth) return at;
  if(at.prevReady && at.prevImg && at.prevImg.naturalWidth) return at.prevAt;
  return null;
}
/* 立即加载某职业完整图集（进入战斗时调用，避免角色迟迟不出） */
function ensureCharAtlas(key){
  const at = CHAR_ATLASES[key];
  if(!at || at._started) return;
  at._started = true;
  at.img.onload = ()=>{ at.ready = true; };
  at.img.onerror = ()=>{ at.ready = false; };
  at.img.src = at.url;
}
/* 空闲时逐张补齐完整图集（单张串行，避免抢占首屏带宽与解码） */
let __atlasTimer = null;
function __pumpCharAtlasQueue(){
  const key = __charAtlasQueue.shift();
  if(!key){ __atlasTimer = null; return; }
  const at = CHAR_ATLASES[key];
  const next = ()=>{ __atlasTimer = setTimeout(__pumpCharAtlasQueue, 60); };
  if(at._started){ next(); return; }
  at._started = true;
  at.img.onload = ()=>{ at.ready = true; next(); };
  at.img.onerror = ()=>{ at.ready = false; next(); };
  at.img.src = at.url;
}
function startCharAtlasQueue(){
  if(__atlasTimer) return;
  __atlasTimer = setTimeout(__pumpCharAtlasQueue, 200);
}
if(document.readyState === 'complete') startCharAtlasQueue();
else window.addEventListener('load', startCharAtlasQueue, { once:true });
/* ★ 精灵朝向纠偏：部分烘焙表画出来是朝左的，faceLeft:true 会按 facing 反向翻转。
   可用 ?faceLeft=herb,axe 或 ?faceRight=axe 临时覆盖验证（正常游玩不受影响）。 */
(function(){
  let q = null;
  try{ q = new URLSearchParams(location.search); }catch(e){ return; }
  const setTo = function(param, val){
    const raw = q.get(param);
    if(!raw) return;
    for(const id of raw.split(',')){
      const at = CHAR_ATLASES[id.trim()];
      if(at) at.faceLeft = val;
    }
  };
  setTo('faceLeft', true);
  setTo('faceRight', false);
})();
