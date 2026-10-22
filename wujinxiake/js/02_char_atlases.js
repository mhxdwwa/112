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
  herb: { url:'assets/chars/herb_atlas.webp', ready:false, img:new Image(),  /* 炼药师（新版模型） */
    cellW:256, cellH:256, cols:8, rows:8,
    feetX:74.3, groundY:218.7, bodyH:215.0, bodyWorld:112,
    anims:{ idle:{frames:[0,1,2,3,4,5,6,7]}, run:{frames:[8,9,10,11,12,13,14,15,16,17,18,19]}, atk1:{frames:[20,21,22,23,24,25]}, atk2:{frames:[26,27,28,29,30,31]}, atk3:{frames:[32,33,34,35,36,37,38]}, skill:{frames:[39,40,41,42,43,44,45,46]}, jump:{frames:[47,48,49]}, dodge:{frames:[50,51,52]}, hurt:{frames:[53]}, death:{frames:[54,55,56,57]}, victory:{frames:[58,59]} } },
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
for(const key in CHAR_ATLASES){
  const at = CHAR_ATLASES[key];
  at.img.onload = ()=>{ at.ready = true; };
  at.img.onerror = ()=>{ at.ready = false; };
  at.img.src = at.url;
}
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
