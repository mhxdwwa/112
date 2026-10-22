/* ===== 载入界面 =====
   点开游戏先显示「正在加载游戏… XX%」，核心图片全部就绪后再进入，
   避免进游戏后角色/立绘一张张慢慢冒出来。
   图片按体积计入进度；失败的文件按已完成处理，不会卡住。
   这里只是「预热」，游戏自身仍用原来的 Image 对象，命中浏览器缓存不会重复下载。 */
(function(){
  const OV = document.getElementById('bootOverlay');
  if(!OV) return;
  const barEl = document.getElementById('bootBar');
  const pctEl = document.getElementById('bootPct');
  const tipEl = document.getElementById('bootTip');

  /* [路径, 体积KB] —— 按体积加权，进度条才准 */
  const PREVIEWS = [
    ['assets/previews/sword.webp', 6],
    ['assets/previews/blade.webp', 7],
    ['assets/previews/spear.webp', 8],
    ['assets/previews/fist.webp', 7],
    ['assets/previews/herb.webp', 13],
    ['assets/previews/axe.webp', 14],
    ['assets/previews/talisman.webp', 14],
    ['assets/previews/cauldron.webp', 14]
  ];
  const PORTRAITS = [
    ['职业_宝剑剑士.webp', 101],
    ['职业_大刀剑客.webp', 95],
    ['职业_长枪枪手.webp', 112],
    ['职业_格斗家.webp', 67],
    ['铁匠王大锤.webp', 44],
    ['商人李掌柜.webp', 29],
    ['守门人.webp', 72],
    ['引灯人阿箬.webp', 39],
    ['药师白婆婆.webp', 83],
    ['说书人.webp', 61],
    ['使者_青鸾.webp', 85],
    ['使者_朱明.webp', 113],
    ['使者_白泽.webp', 80],
    ['使者_玄冥.webp', 87]
  ];
  const ATLASES = [
    ['assets/swordsman/swordsman_atlas.webp', 613],
    ['assets/blade/blade_atlas.webp', 449],
    ['assets/spear/spear_atlas.webp', 597],
    ['assets/fist/fist_atlas.webp', 474],
    ['assets/chars/herb_atlas.webp', 859],
    ['assets/chars/mountaineer_atlas.webp', 1001],
    ['assets/chars/talismanist_atlas.webp', 1029],
    ['assets/chars/danmaster_atlas.webp', 960]
  ];

  const QUEUE = PREVIEWS.concat(PORTRAITS, ATLASES);
  const TOTAL = QUEUE.reduce(function(s, it){ return s + it[1]; }, 0); /* 约 7133 KB */
  let loaded = 0, idx = 0, active = 0, finished = false;
  const MAX_PARALLEL = 4;
  const t0 = Date.now();

  function paint(){
    const pct = Math.min(100, Math.round(loaded / TOTAL * 100));
    if(barEl) barEl.style.width = pct + '%';
    if(pctEl) pctEl.textContent = pct + '%';
    if(pct < 100 && tipEl) tipEl.textContent = '正在加载游戏资源…';
  }

  function finish(){
    if(finished) return;
    finished = true;
    loaded = TOTAL; paint();
    if(tipEl) tipEl.textContent = '加载完成，正在进入…';
    const wait = Math.max(0, 420 - (Date.now() - t0));
    setTimeout(function(){
      OV.classList.add('boot-hide');
      setTimeout(function(){ OV.style.display = 'none'; }, 500);
    }, wait);
  }

  function pump(){
    if(finished) return;
    while(active < MAX_PARALLEL && idx < QUEUE.length){
      const it = QUEUE[idx++];
      active++;
      const img = new Image();
      let settled = false;
      const settle = function(){
        if(settled) return;
        settled = true;
        active--; loaded += it[1]; paint(); pump();
      };
      img.onload = settle;
      img.onerror = settle;
      img.src = it[0];
    }
    if(idx >= QUEUE.length && active === 0) finish();
  }

  /* 加载期间屏蔽游戏按键（不影响 F5/F12/Ctrl 系快捷键），避免误触背后的游戏 */
  document.addEventListener('keydown', function(e){
    if(finished) return;
    if(e.ctrlKey || e.metaKey || e.altKey || /^F\d+$/.test(e.key)) return;
    e.stopImmediatePropagation(); e.preventDefault();
  }, true);

  /* 加载慢时给个「先进入」的出口，不让玩家干等 */
  setTimeout(function(){
    if(finished) return;
    if(tipEl) tipEl.innerHTML = '资源较多，仍在加载… <button id="bootSkip">先进入游戏</button>';
    const sk = document.getElementById('bootSkip');
    if(sk) sk.onclick = function(){ if(tipEl) tipEl.textContent = '已跳过，剩余资源后台继续加载…'; finish(); };
  }, 8000);

  paint();
  pump();
})();
