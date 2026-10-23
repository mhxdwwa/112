/* ============================================================
   手机端城镇功能栏（背包 / 技能 / 角色 / 任务 / 交易行）
   ------------------------------------------------------------
   手机竖屏时画布只是中间一条 16:9 的横带，摇杆和按键都在
   画布之外（贴在窗口底部）。所以图标不能用 canvas 画，
   否则会跑到画布里去、和摇杆完全对不上。
   这里改用 DOM 按钮，位置直接跟着「方向拨杆」的实测矩形走。
   ============================================================ */
(function(){
  'use strict';

  var ITEMS = [
    { id:'inventory',     label:'背包',   key:'I', color:'#5b9cff' },
    { id:'skillMenu',     label:'技能',   key:'U', color:'#ffc860' },
    { id:'characterInfo', label:'角色',   key:'C', color:'#5be08a' },
    { id:'questMenu',     label:'任务',   key:'Q', color:'#ffd166' },
    { id:'auction',       label:'交易行', key:'T', color:'#c39bff' }
  ];

  function svg(id){
    var c = 'stroke="currentColor" stroke-width="1.7" fill="none" stroke-linecap="round" stroke-linejoin="round"';
    if(id === 'inventory') return '<svg viewBox="0 0 24 24" '+c+'><path d="M4 9h16l-1.2 11H5.2L4 9Z"/><path d="M9 9V7a3 3 0 0 1 6 0v2"/></svg>';
    if(id === 'skillMenu') return '<svg viewBox="0 0 24 24" '+c+'><path d="M12 3l2.3 5.2L20 10l-5.7 1.8L12 17l-2.3-5.2L4 10l5.7-1.8L12 3Z"/><path d="M18 17l1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2Z"/></svg>';
    if(id === 'characterInfo') return '<svg viewBox="0 0 24 24" '+c+'><circle cx="12" cy="8" r="3.4"/><path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6"/></svg>';
    if(id === 'questMenu') return '<svg viewBox="0 0 24 24" '+c+'><rect x="5" y="3.5" width="14" height="17" rx="2"/><path d="M8.5 8h7M8.5 12h7M8.5 16h4"/></svg>';
    return '<svg viewBox="0 0 24 24" '+c+'><path d="M12 4v15M5 8h14M7.5 19h9"/><path d="M4 8l-1.5 4.5a3 3 0 0 0 6 0L7 8M20 8l-1.5 4.5a3 3 0 0 0 6 0L23 8"/><circle cx="12" cy="4" r="1.4" fill="currentColor"/></svg>';
  }

  var bar = null;

  function build(){
    if(bar) return bar;
    bar = document.createElement('div');
    bar.id = 'mTownBtns';
    var html = '';
    for(var i = 0; i < ITEMS.length; i++){
      var it = ITEMS[i];
      html += '<button type="button" class="mtb" data-id="' + it.id + '" style="--c:' + it.color + '">' +
                '<i>' + svg(it.id) + '</i><b>' + it.label + '</b><em>' + it.key + '</em>' +
              '</button>';
    }
    bar.innerHTML = html;
    document.body.appendChild(bar);

    bar.addEventListener('touchstart', function(e){ e.stopPropagation(); }, { passive:false });
    bar.addEventListener('click', function(e){
      var b = e.target.closest ? e.target.closest('.mtb') : null;
      if(!b) return;
      e.preventDefault(); e.stopPropagation();
      open(b.getAttribute('data-id'));
    }, true);
    return bar;
  }

  function open(id){
    try{
      if(id === 'inventory'){ G.inventoryReturnState = 'town'; gameState = 'inventory'; }
      else if(id === 'skillMenu') gameState = 'skillMenu';
      else if(id === 'characterInfo') gameState = 'characterInfo';
      else if(id === 'questMenu'){ questReturnState = 'town'; gameState = 'questMenu'; }
      else if(id === 'auction'){ if(window.AUCTION) AUCTION.open(); }
      if(typeof syncMobileBar === 'function') syncMobileBar();
    }catch(err){}
  }

  function mobileUI(){
    var tc = document.getElementById('touchControls');
    if(!tc) return false;
    if(!tc.classList.contains('mobile')) return false;
    if(tc.classList.contains('pvp')) return false;   /* 双人同屏让位，不占画面 */
    return true;
  }

  function place(){
    if(!bar) return;
    var joy = document.getElementById('joystick1');
    if(!joy){ bar.classList.remove('on'); return; }
    var r = joy.getBoundingClientRect();
    if(!r || r.width < 24){ bar.classList.remove('on'); return; }

    /* ★ 竖屏 / 横屏都横着排一排，贴在「摇杆正上方」——
       摇杆右边到右下角攻击键之间空间不够，竖排又和触屏按键挤在一起 */
    var gap = 6;
    var land = (window.innerWidth || 0) > (window.innerHeight || 0);
    var room = (window.innerWidth || 360) - 16;
    var size = Math.round(Math.max(34, Math.min(50, (room - gap * 4) / 5)));
    /* 摇杆上沿以上的可用高度也别超（横屏尤其紧） */
    var availH = (r.top || 0) - 26;
    if(land) availH = Math.min(availH, (window.innerHeight || 640) * 0.30);
    if(availH > 0 && size > availH) size = Math.max(30, Math.round(availH));
    if(!bar.classList.contains('hz')) bar.classList.add('hz');
    bar.style.setProperty('--gap', gap + 'px');
    bar.style.setProperty('--s', size + 'px');

    var rowW = size * ITEMS.length + gap * (ITEMS.length - 1);
    var bottom = Math.round(window.innerHeight - r.top + (land ? 14 : 22));
    var left = Math.max(8, Math.round(r.left));

    /* 「任务追踪」框可能压在这一排上：叠了就整体挪到它右边，
       右边放不下就挪到它上面 */
    try{
      var box = window.__questTrackerBox, cv = document.getElementById('c');
      if(box && cv){
        var cr = cv.getBoundingClientRect();
        var vw = (typeof VW !== 'undefined' && VW) ? VW : 1280;
        var vh = (typeof VH !== 'undefined' && VH) ? VH : 720;
        var kx = cr.width / vw, ky = cr.height / vh;
        var ql = cr.left + box.x * kx, qr = ql + box.w * kx;
        var qt = cr.top + box.y * ky, qb = qt + box.h * ky;
        var bt = window.innerHeight - bottom - size, bb = window.innerHeight - bottom + 20;
        if(left < qr && (left + rowW) > ql && bt < qb && bb > qt){
          var tryRight = Math.round(qr + 10);
          if(tryRight + rowW <= (window.innerWidth || 360) - 8) left = tryRight;
          else bottom = Math.round(window.innerHeight - qt + 8);
        }
      }
    }catch(e){}

    if(left + rowW > (window.innerWidth || 360) - 8){
      left = Math.max(8, (window.innerWidth || 360) - rowW - 8);
    }
    bar.style.left = left + 'px';
    bar.style.bottom = bottom + 'px';
  }

  function syncMobileBar(){
    var show = false;
    try{
      show = mobileUI() && typeof gameState !== 'undefined' && gameState === 'town';
    }catch(e){ show = false; }
    if(!show){
      if(bar) bar.classList.remove('on');
      return;
    }
    build();
    place();
    bar.classList.add('on');
  }
  window.syncMobileBar = function(){ try{ syncMobileBar(); }catch(e){} };

  function boot(){
    /* 状态每 300ms 校一次（gameState 没有变更事件，轮询最省事） */
    setInterval(syncMobileBar, 300);
    window.addEventListener('resize', function(){ setTimeout(function(){ place(); syncMobileBar(); }, 120); });
    window.addEventListener('orientationchange', function(){ setTimeout(function(){ place(); syncMobileBar(); }, 320); });
    if(window.visualViewport){
      window.visualViewport.addEventListener('resize', function(){ setTimeout(place, 120); });
      window.visualViewport.addEventListener('scroll', function(){ setTimeout(place, 60); });
    }
    setTimeout(syncMobileBar, 600);
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
