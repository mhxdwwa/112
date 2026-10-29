/* ============================================================
   飞 行 道 具（飞行器 / 坐骑）
   ------------------------------------------------------------
   用「站在飞行道具上滑行」替代走 / 跑的动画：
   · 角色永远保持 idle 站姿，移动时整体前倾 + 轻微浮动
   · 道具画在脚下，随角色一起平移、跳跃时一起升高
   · 数值只加「移动速度」「回避率」，走现有 DNF 属性管线

   槽位：equipment.mount（独立第 8 槽，不进 EQUIP_SLOTS 掉落池）
   ============================================================ */
(function(){
  'use strict';

  var SLOT = 'mount';

  /* 品阶表：移速 / 回避 都做在合理区间内（鞋子移速权重 0.70 作参照） */
  var TIERS = [
    { id:'common',   name:'普通', color:'#ffffff', model:'board',    label:'木滑板',   lv:1,  moveSpd:4,  dodge:1   },
    { id:'advanced', name:'高级', color:'#3498db', model:'windfire', label:'风火轮',   lv:15, moveSpd:6,  dodge:2   },
    { id:'rare',     name:'稀有', color:'#9b59b6', model:'hover',    label:'御风滑板', lv:30, moveSpd:8,  dodge:3   },
    { id:'epic',     name:'神器', color:'#e91e63', model:'wing',     label:'青鸾之翼', lv:45, moveSpd:10, dodge:4   },
    { id:'legend',   name:'传说', color:'#e67e22', model:'flame',    label:'炽焰双翼', lv:60, moveSpd:12, dodge:5   },
    { id:'mythic',   name:'史诗', color:'#ff3030', model:'star',     label:'星陨神翼', lv:60, moveSpd:14, dodge:6 }
  ];

  /* 道具池：同品阶可有多个命名道具，掉落时随机选一个 */
  var POOL = {
    common:   [{ name:'木滑板',   model:'board',        lv:1  }],
    advanced: [{ name:'风火轮',   model:'windfire',     lv:15 }],
    rare:     [{ name:'御风滑板', model:'hover',        lv:30 }],
    epic:     [
      { name:'青鸾之翼', model:'wing',        lv:45 },
      { name:'诛仙剑',   model:'flysword',    lv:50 }
    ],
    legend:   [
      { name:'炽焰双翼', model:'flame',       lv:60 },
      { name:'筋斗云',   model:'goldencloud', lv:50 }
    ],
    mythic:   [
      { name:'星陨神翼', model:'star',        lv:60 },
      { name:'九天莲座', model:'lotusthrone', lv:60 },
      { name:'瑶琴仙槎', model:'guqin',       lv:60 }
    ]
  };

  function tierById(id){
    for(var i = 0; i < TIERS.length; i++) if(TIERS[i].id === id) return TIERS[i];
    return TIERS[0];
  }

  function make(tierId, level){
    var t = tierById(tierId);
    /* 从道具池随机选一个命名道具，池中没有则用品阶默认 */
    var pool = POOL[tierId];
    var v = pool ? pool[Math.floor(Math.random() * pool.length)] : { name:t.label, model:t.model, lv:t.lv };
    return {
      slot: SLOT,
      tier: t.id,
      tierName: t.name,
      tierColor: t.color,
      name: v.name,
      model: v.model,
      level: level || v.lv,
      enhance: 0, amplify: 0,
      baseAtk: 0, baseDef: 0, baseHp: 0, baseSpd: 0, baseCrit: 0,
      affixes: [],
      /* 只走「移速 / 回避」两条 */
      dnf: { moveSpd: t.moveSpd, dodge: t.dodge }
    };
  }

  function off(p){ return (p && p.equipment) ? p.equipment.mount : null; }
  function modelOf(p){ var m = off(p); return m ? (m.model || 'board') : ''; }

  /* 新手 / 老存档兜底：没有就发一块 1 级白板并自动装备
     ★ 防刷 bug：系统赠送的 1 级飞行道具标记为 sysGift，不可分解/出售/交易。
     玩家只能获得一个系统赠送飞行道具（通过 p.mountSysGifted 标记），
     卸下后再触发 ensure 不会重复发放。 */
  function ensure(p){
    if(!p) return null;
    if(!p.equipment) p.equipment = {};

    /* 老存档迁移：已装备飞行道具但没有 mountSysGifted 标记的，
       如果是 common 1 级则补标记（说明是之前系统赠送的） */
    if(p.equipment.mount && !p.mountSysGifted){
      var om = p.equipment.mount;
      if(om.tier === 'common' && (om.level || 1) <= 1 && om.sysGift){
        p.mountSysGifted = true;
      }
    }

    if(!p.equipment.mount){
      /* 已经领过系统赠送的飞行道具，不再补发 */
      if(p.mountSysGifted) return null;
      var m = make('common', 1);
      m.sysGift = true;          /* 标记为系统赠送 */
      m.locked = true;           /* 锁定，不可交易 */
      m.noDecompose = true;      /* 不可分解 */
      m.noSell = true;           /* 不可出售 */
      p.equipment.mount = m;
      p.mountSysGifted = true;   /* 记录已领取 */
      return p.equipment.mount;
    }
    var m2 = p.equipment.mount;
    /* 补字段：老数据可能只有 tier */
    if(!m2.model){ var t = tierById(m2.tier); m2.model = t.model; m2.tierName = m2.tierName || t.name; m2.tierColor = m2.tierColor || t.color; }
    if(!m2.dnf) m2.dnf = { moveSpd: tierById(m2.tier).moveSpd, dodge: tierById(m2.tier).dodge };
    /* 老存档的系统赠送道具补标记 */
    if(m2.sysGift && !p.mountSysGifted) p.mountSysGifted = true;
    return m2;
  }

  /* ============================================================
     绘制：道具画在脚下（y 为角色脚底基线）
     ============================================================ */
  function roundRectPath(c, x, y, w, h, r){
    c.beginPath();
    c.moveTo(x + r, y);
    c.lineTo(x + w - r, y);
    c.quadraticCurveTo(x + w, y, x + w, y + r);
    c.lineTo(x + w, y + h - r);
    c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    c.lineTo(x + r, y + h);
    c.quadraticCurveTo(x, y + h, x, y + h - r);
    c.lineTo(x, y + r);
    c.quadraticCurveTo(x, y, x + r, y);
    c.closePath();
  }


  /* ---------- 翅膀（青鸾 / 炽焰 / 星陨 共用骨架，只换配色与粒子） ---------- */
  function drawWings(c, sc, T, moving, pal){
    const flap = Math.sin(T * (moving ? 7 : 2.6)) * (moving ? 0.12 : 0.06);
    for(let side = -1; side <= 1; side += 2){
      c.save();
      c.translate(0, -96 * sc);
      c.scale(side, 1);
      c.rotate(-0.34 + flap);
      for(let i = 0; i < 3; i++){
        const k = 1 - i * 0.22;
        const len = (96 - i * 16) * sc * k;
        const wid = (23 - i * 3) * sc;
        const g = c.createLinearGradient(0, 0, len, -len * 0.55);
        g.addColorStop(0, pal[0]);
        g.addColorStop(0.55, pal[1]);
        g.addColorStop(1, pal[2]);
        c.fillStyle = g;
        c.beginPath();
        c.moveTo(0, 0);
        c.quadraticCurveTo(len * 0.55, -wid * 1.9, len, -len * 0.42);
        c.quadraticCurveTo(len * 0.5, wid * 0.7, 0, wid * 0.5);
        c.closePath();
        c.fill();
        c.strokeStyle = pal[3] || 'rgba(255,255,255,0.22)';
        c.lineWidth = 0.9 * sc;
        c.stroke();
      }
      c.restore();
    }
    /* 粒子：往上飘，移动时更多 */
    c.globalCompositeOperation = 'lighter';
    const n = moving ? 7 : 4;
    for(let i = 0; i < n; i++){
      const ph = ((T * (0.7 + i * 0.09)) % 1);
      const dx = Math.sin(T * 1.7 + i) * 34 * sc;
      const dy = -ph * 76 * sc - 26 * sc;
      c.fillStyle = pal[4];
      c.beginPath(); c.arc(dx, dy, (2.4 - ph * 1.6) * sc, 0, Math.PI * 2); c.fill();
    }
  }

  /* t: 时间（秒），moving: 是否在移动，facing: 1 / -1 */
  function draw(c, x, y, sc, model, t, moving, facing){
    if(!c) return;
    var T = t || (performance.now() / 1000);
    var F = (facing >= 0) ? 1 : -1;
    sc = sc || 1;

    c.save();
    c.translate(x, y);

    if(model === 'hover'){
      /* ---- 御风滑板：无轮悬浮，底下三圈气流 ---- */
      var W2 = 80 * sc, H2 = 8 * sc;
      var bob2 = Math.sin(T * 2.4) * 1.2 * sc;
      c.fillStyle = 'rgba(0,0,0,0.26)';
      c.beginPath(); c.ellipse(0, bob2 + H2 + 6 * sc, W2 * 0.5, 5 * sc, 0, 0, Math.PI * 2); c.fill();
      var gh = c.createLinearGradient(0, bob2, 0, bob2 + H2);
      gh.addColorStop(0, '#cfe9ff');
      gh.addColorStop(0.5, '#6fb6e8');
      gh.addColorStop(1, '#2c5f86');
      c.fillStyle = gh;
      c.beginPath(); roundRectPath(c, -W2 / 2, bob2, W2, H2, 5 * sc); c.fill();
      c.globalCompositeOperation = 'lighter';
      for(var r2 = 0; r2 < 3; r2++){
        var pr = ((T * (0.8 + r2 * 0.12) + r2 * 0.33) % 1);
        c.strokeStyle = 'rgba(120,215,255,' + (0.42 * (1 - pr)).toFixed(3) + ')';
        c.lineWidth = 1.6 * sc;
        c.beginPath(); c.ellipse(0, bob2 + H2 + 2 * sc + pr * 10 * sc, (W2 * 0.34) * (0.6 + pr * 0.8), 4 * sc * (0.6 + pr), 0, 0, Math.PI * 2); c.stroke();
      }
      if(moving){
        for(var d2 = 0; d2 < 6; d2++){
          var pp = ((T * 2.4 + d2 * 0.17) % 1);
          c.fillStyle = 'rgba(160,225,255,' + (0.4 * (1 - pp)).toFixed(3) + ')';
          c.beginPath(); c.arc(-F * (16 + pp * 54) * sc, (2 - pp * 8) * sc, (2.4 - pp * 1.6) * sc, 0, Math.PI * 2); c.fill();
        }
      }
      c.globalCompositeOperation = 'source-over';
    } else if(model === 'wing' || model === 'flame' || model === 'star'){
      if(model === 'wing'){
        drawWings(c, sc, T, moving, ['rgba(210,250,255,0.95)', 'rgba(120,220,235,0.75)', 'rgba(70,150,200,0.15)', 'rgba(235,255,255,0.5)', 'rgba(180,245,255,0.75)']);
      } else if(model === 'flame'){
        drawWings(c, sc, T, moving, ['rgba(255,240,170,0.98)', 'rgba(255,150,50,0.8)', 'rgba(190,40,10,0.2)', 'rgba(255,215,140,0.55)', 'rgba(255,170,70,0.85)']);
      } else {
        drawWings(c, sc, T, moving, ['rgba(235,225,255,0.95)', 'rgba(140,120,255,0.78)', 'rgba(60,40,160,0.18)', 'rgba(220,215,255,0.5)', 'rgba(200,180,255,0.9)']);
      }
    } else if(model === 'goldencloud'){
      /* ---- 筋斗云：金色祥云，西游记灵感 ---- */
      var gBob = Math.sin(T * 1.8) * 2.5 * sc;
      var gScale = sc * 1.15;
      c.save();
      c.translate(0, gBob);
      /* 云团：多个重叠椭圆 */
      var gClouds = [
        {x:0, y:0, rx:44, ry:17},
        {x:-24, y:-5, rx:26, ry:14},
        {x:24, y:-3, rx:28, ry:15},
        {x:-10, y:-12, rx:20, ry:11},
        {x:14, y:-10, rx:22, ry:12}
      ];
      /* 底部阴影 */
      c.fillStyle = 'rgba(0,0,0,0.22)';
      c.beginPath(); c.ellipse(0, 22*gScale, 48*gScale, 6*gScale, 0, 0, Math.PI*2); c.fill();
      /* 外层辉光 */
      c.globalCompositeOperation = 'lighter';
      var gGlow = c.createRadialGradient(0, -4*gScale, 0, 0, -4*gScale, 58*gScale);
      gGlow.addColorStop(0, 'rgba(255,215,0,0.28)');
      gGlow.addColorStop(0.5, 'rgba(255,180,0,0.10)');
      gGlow.addColorStop(1, 'rgba(255,150,0,0)');
      c.fillStyle = gGlow;
      c.beginPath(); c.ellipse(0, -4*gScale, 58*gScale, 30*gScale, 0, 0, Math.PI*2); c.fill();
      c.globalCompositeOperation = 'source-over';
      /* 云团本体 */
      for(var ci = 0; ci < gClouds.length; ci++){
        var gc = gClouds[ci];
        var gGrad = c.createRadialGradient(gc.x*gScale, (gc.y-4)*gScale, 2, gc.x*gScale, gc.y*gScale, gc.rx*gScale);
        gGrad.addColorStop(0, 'rgba(255,245,200,0.96)');
        gGrad.addColorStop(0.35, 'rgba(255,215,80,0.85)');
        gGrad.addColorStop(0.7, 'rgba(230,170,40,0.60)');
        gGrad.addColorStop(1, 'rgba(200,140,20,0.15)');
        c.fillStyle = gGrad;
        c.beginPath(); c.ellipse(gc.x*gScale, gc.y*gScale, gc.rx*gScale, gc.ry*gScale, 0, 0, Math.PI*2); c.fill();
      }
      /* 顶部高光 */
      c.fillStyle = 'rgba(255,250,230,0.35)';
      c.beginPath(); c.ellipse(-4*gScale, -16*gScale, 18*gScale, 6*gScale, -0.2, 0, Math.PI*2); c.fill();
      /* 飘动金色粒子 */
      c.globalCompositeOperation = 'lighter';
      var gpn = moving ? 10 : 5;
      for(var gi = 0; gi < gpn; gi++){
        var gph = ((T * (0.5 + gi*0.1) + gi*0.2) % 1);
        var gdx = Math.sin(T*1.3 + gi*1.7) * 38*gScale;
        var gdy = -gph * 55*gScale - 8*gScale;
        c.fillStyle = 'rgba(255,230,100,' + (0.6*(1-gph)).toFixed(3) + ')';
        c.beginPath(); c.arc(gdx, gdy, (2.8 - gph*2)*gScale, 0, Math.PI*2); c.fill();
      }
      /* 移动时尾部云迹 */
      if(moving){
        for(var gt = 0; gt < 5; gt++){
          var ttp = ((T*2 + gt*0.2) % 1);
          var ttx = -F * (20 + ttp*50)*gScale;
          var tty = (4 - ttp*6)*gScale;
          c.fillStyle = 'rgba(255,220,120,' + (0.35*(1-ttp)).toFixed(3) + ')';
          c.beginPath(); c.ellipse(ttx, tty, (10-ttp*7)*gScale, (5-ttp*3)*gScale, 0, 0, Math.PI*2); c.fill();
        }
      }
      c.globalCompositeOperation = 'source-over';
      c.restore();
    } else if(model === 'flysword'){
      /* ---- 诛仙剑：脚踏飞剑，仙侠风格 ---- */
      var sBob = Math.sin(T * 2.2) * 1.8 * sc;
      var sSc = sc * 1.1;
      c.save();
      c.translate(0, sBob);
      /* ★ 剑尖跟随朝向：向右走剑尖朝右，向左走整把剑镜像（原来剑尖永远朝右） */
      c.scale(F, 1);
      /* 剑身阴影 */
      c.fillStyle = 'rgba(0,0,0,0.25)';
      c.beginPath(); c.ellipse(0, 18*sSc, 52*sSc, 5*sSc, 0, 0, Math.PI*2); c.fill();
      /* 剑身 */
      var sLen = 110*sSc, sWid = 8*sSc;
      var sGrad = c.createLinearGradient(-sLen/2, 0, sLen/2, 0);
      sGrad.addColorStop(0, 'rgba(180,220,255,0.6)');
      sGrad.addColorStop(0.15, 'rgba(200,235,255,0.95)');
      sGrad.addColorStop(0.5, 'rgba(140,200,240,0.85)');
      sGrad.addColorStop(0.85, 'rgba(200,235,255,0.95)');
      sGrad.addColorStop(1, 'rgba(100,180,255,0.5)');
      c.fillStyle = sGrad;
      c.beginPath();
      c.moveTo(-sLen/2, 0);
      c.lineTo(-sLen/2 + 12*sSc, -sWid);
      c.lineTo(sLen/2 - 6*sSc, -sWid*0.7);
      c.lineTo(sLen/2, 0);
      c.lineTo(sLen/2 - 6*sSc, sWid*0.7);
      c.lineTo(-sLen/2 + 12*sSc, sWid);
      c.closePath();
      c.fill();
      /* 剑身高光 */
      c.fillStyle = 'rgba(220,245,255,0.4)';
      c.beginPath();
      c.moveTo(-sLen/2 + 15*sSc, -sWid*0.3);
      c.lineTo(sLen/2 - 10*sSc, -sWid*0.2);
      c.lineTo(sLen/2 - 10*sSc, 0);
      c.lineTo(-sLen/2 + 15*sSc, 0);
      c.closePath();
      c.fill();
      /* 剑柄 */
      c.fillStyle = 'rgba(90,60,40,0.9)';
      c.fillRect(-sLen/2 - 14*sSc, -3*sSc, 16*sSc, 6*sSc);
      /* 剑格（护手） */
      var guardGrad = c.createLinearGradient(0, -10*sSc, 0, 10*sSc);
      guardGrad.addColorStop(0, 'rgba(255,215,100,0.9)');
      guardGrad.addColorStop(1, 'rgba(200,160,50,0.8)');
      c.fillStyle = guardGrad;
      c.beginPath(); c.ellipse(-sLen/2 + 2*sSc, 0, 4*sSc, 10*sSc, 0, 0, Math.PI*2); c.fill();
      /* 剑刃能量光晕 */
      c.globalCompositeOperation = 'lighter';
      var seGlow = c.createLinearGradient(-sLen/2, -14*sSc, sLen/2, 14*sSc);
      var sPulse = 0.5 + Math.sin(T*3)*0.2;
      seGlow.addColorStop(0, 'rgba(100,200,255,0)');
      seGlow.addColorStop(0.3, 'rgba(100,200,255,' + (0.15*sPulse).toFixed(3) + ')');
      seGlow.addColorStop(0.7, 'rgba(100,200,255,' + (0.15*sPulse).toFixed(3) + ')');
      seGlow.addColorStop(1, 'rgba(100,200,255,0)');
      c.fillStyle = seGlow;
      c.fillRect(-sLen/2, -14*sSc, sLen, 28*sSc);
      /* 旋转能量环 */
      c.strokeStyle = 'rgba(120,210,255,' + (0.35*sPulse).toFixed(3) + ')';
      c.lineWidth = 1.2*sSc;
      for(var ri = 0; ri < 2; ri++){
        var rPhase = T*2 + ri*Math.PI;
        var rx = Math.cos(rPhase)*30*sSc;
        c.beginPath();
        c.ellipse(rx, 0, 5*sSc, 12*sSc, 0, 0, Math.PI*2);
        c.stroke();
      }
      /* 剑气粒子 */
      var spn = moving ? 8 : 4;
      for(var si = 0; si < spn; si++){
        var sph = ((T*(0.8+si*0.12) + si*0.25) % 1);
        var sx = Math.sin(T*2 + si*2.1) * 40*sSc;
        var sy = -sph*40*sSc - 6*sSc;
        c.fillStyle = 'rgba(150,220,255,' + (0.5*(1-sph)).toFixed(3) + ')';
        c.beginPath(); c.arc(sx, sy, (2.2-sph*1.5)*sSc, 0, Math.PI*2); c.fill();
      }
      if(moving){
        for(var st = 0; st < 4; st++){
          var stp = ((T*2.5 + st*0.25) % 1);
          var stx = -F*(25+stp*45)*sSc;
          c.fillStyle = 'rgba(150,220,255,' + (0.3*(1-stp)).toFixed(3) + ')';
          c.beginPath(); c.arc(stx, (3-stp*5)*sSc, (2-stp*1.4)*sSc, 0, Math.PI*2); c.fill();
        }
      }
      c.globalCompositeOperation = 'source-over';
      c.restore();
    } else if(model === 'lotusthrone'){
      /* ---- 九天莲座：多层莲花瓣台座，佛门风格 ---- */
      var lBob = Math.sin(T * 1.5) * 2.2 * sc;
      var lSc = sc * 1.2;
      c.save();
      c.translate(0, lBob);
      /* 底部阴影 */
      c.fillStyle = 'rgba(0,0,0,0.25)';
      c.beginPath(); c.ellipse(0, 20*lSc, 42*lSc, 6*lSc, 0, 0, Math.PI*2); c.fill();
      /* 底部光晕 */
      c.globalCompositeOperation = 'lighter';
      var lGlow = c.createRadialGradient(0, 0, 0, 0, 0, 50*lSc);
      lGlow.addColorStop(0, 'rgba(255,200,100,0.25)');
      lGlow.addColorStop(0.5, 'rgba(255,150,80,0.08)');
      lGlow.addColorStop(1, 'rgba(255,100,50,0)');
      c.fillStyle = lGlow;
      c.beginPath(); c.ellipse(0, 0, 50*lSc, 28*lSc, 0, 0, Math.PI*2); c.fill();
      c.globalCompositeOperation = 'source-over';
      /* 外层花瓣（大，慢转） */
      var lPetals = 8;
      c.save();
      c.rotate(T * 0.3);
      for(var pi = 0; pi < lPetals; pi++){
        var pa = (pi / lPetals) * Math.PI * 2;
        c.save();
        c.rotate(pa);
        var pGrad = c.createLinearGradient(0, 0, 38*lSc, 0);
        pGrad.addColorStop(0, 'rgba(255,180,220,0.9)');
        pGrad.addColorStop(0.5, 'rgba(255,140,180,0.7)');
        pGrad.addColorStop(1, 'rgba(255,100,150,0.2)');
        c.fillStyle = pGrad;
        c.beginPath();
        c.moveTo(0, 0);
        c.quadraticCurveTo(20*lSc, -14*lSc, 38*lSc, -3*lSc);
        c.quadraticCurveTo(20*lSc, 10*lSc, 0, 0);
        c.fill();
        c.strokeStyle = 'rgba(255,200,230,0.4)';
        c.lineWidth = 0.8*lSc;
        c.stroke();
        c.restore();
      }
      c.restore();
      /* 内层花瓣（小，反方向转） */
      c.save();
      c.rotate(-T * 0.5);
      for(var qi = 0; qi < 6; qi++){
        var qa = (qi / 6) * Math.PI * 2;
        c.save();
        c.rotate(qa);
        var qGrad = c.createLinearGradient(0, 0, 24*lSc, 0);
        qGrad.addColorStop(0, 'rgba(255,220,240,0.95)');
        qGrad.addColorStop(0.6, 'rgba(255,180,210,0.6)');
        qGrad.addColorStop(1, 'rgba(255,150,190,0.15)');
        c.fillStyle = qGrad;
        c.beginPath();
        c.moveTo(0, 0);
        c.quadraticCurveTo(13*lSc, -9*lSc, 24*lSc, -2*lSc);
        c.quadraticCurveTo(13*lSc, 7*lSc, 0, 0);
        c.fill();
        c.restore();
      }
      c.restore();
      /* 中心莲蓬（金色球） */
      var cGrad = c.createRadialGradient(0, -2*lSc, 0, 0, 0, 10*lSc);
      cGrad.addColorStop(0, 'rgba(255,240,180,0.98)');
      cGrad.addColorStop(0.5, 'rgba(255,200,80,0.8)');
      cGrad.addColorStop(1, 'rgba(200,150,50,0.3)');
      c.fillStyle = cGrad;
      c.beginPath(); c.arc(0, -2*lSc, 10*lSc, 0, Math.PI*2); c.fill();
      /* 中心脉动光环 */
      c.globalCompositeOperation = 'lighter';
      var lPulse = 0.5 + Math.sin(T*2.5)*0.3;
      c.strokeStyle = 'rgba(255,220,120,' + (0.4*lPulse).toFixed(3) + ')';
      c.lineWidth = 1.5*lSc;
      c.beginPath(); c.arc(0, -2*lSc, 14*lSc, 0, Math.PI*2); c.stroke();
      /* 上升的光点粒子 */
      var lpn = moving ? 8 : 5;
      for(var li = 0; li < lpn; li++){
        var lph = ((T*(0.6+li*0.08) + li*0.2) % 1);
        var ldx = Math.sin(T*1.1 + li*1.9) * 28*lSc;
        var ldy = -lph*60*lSc - 10*lSc;
        c.fillStyle = 'rgba(255,230,150,' + (0.55*(1-lph)).toFixed(3) + ')';
        c.beginPath(); c.arc(ldx, ldy, (2.5-lph*1.8)*lSc, 0, Math.PI*2); c.fill();
      }
      c.globalCompositeOperation = 'source-over';
      c.restore();
    } else if(model === 'guqin'){
      /* ---- 瑶琴仙槎：古琴造型，音波飘动 ---- */
      var qBob = Math.sin(T * 1.9) * 1.6 * sc;
      var qSc = sc * 1.05;
      c.save();
      c.translate(0, qBob);
      /* 阴影 */
      c.fillStyle = 'rgba(0,0,0,0.22)';
      c.beginPath(); c.ellipse(0, 18*qSc, 50*qSc, 5*qSc, 0, 0, Math.PI*2); c.fill();
      /* 琴身 */
      var qLen = 100*qSc, qW = 14*qSc;
      var qGrad = c.createLinearGradient(0, -qW, 0, qW);
      qGrad.addColorStop(0, '#5a3a1e');
      qGrad.addColorStop(0.3, '#7a5030');
      qGrad.addColorStop(0.7, '#6a4528');
      qGrad.addColorStop(1, '#3a2210');
      c.fillStyle = qGrad;
      c.beginPath();
      c.moveTo(-qLen/2, -qW*0.3);
      c.quadraticCurveTo(-qLen/4, -qW, 0, -qW*0.8);
      c.quadraticCurveTo(qLen/4, -qW*0.6, qLen/2, -qW*0.15);
      c.lineTo(qLen/2, qW*0.15);
      c.quadraticCurveTo(qLen/4, qW*0.6, 0, qW*0.8);
      c.quadraticCurveTo(-qLen/4, qW, -qLen/2, qW*0.3);
      c.closePath();
      c.fill();
      /* 琴身高光 */
      c.fillStyle = 'rgba(200,170,120,0.2)';
      c.beginPath();
      c.moveTo(-qLen/2+5*qSc, -qW*0.2);
      c.quadraticCurveTo(0, -qW*0.7, qLen/2-5*qSc, -qW*0.1);
      c.lineTo(qLen/2-5*qSc, 0);
      c.quadraticCurveTo(0, -qW*0.3, -qLen/2+5*qSc, 0);
      c.closePath();
      c.fill();
      /* 琴弦 */
      c.strokeStyle = 'rgba(220,200,160,0.7)';
      c.lineWidth = 0.6*qSc;
      for(var qi = 0; qi < 7; qi++){
        var qy = -qW*0.5 + qi*(qW/3.5);
        c.beginPath();
        c.moveTo(-qLen/2+8*qSc, qy);
        c.lineTo(qLen/2-8*qSc, qy);
        c.stroke();
      }
      /* 琴徽（标记点） */
      c.fillStyle = 'rgba(255,240,200,0.6)';
      for(var mi = 0; mi < 5; mi++){
        var mx = -qLen/3 + mi*(qLen*2/3/4);
        c.beginPath(); c.arc(mx, 0, 1.5*qSc, 0, Math.PI*2); c.fill();
      }
      /* 音波涟漪 */
      c.globalCompositeOperation = 'lighter';
      var qPulse = 0.5 + Math.sin(T*3)*0.3;
      for(var wi = 0; wi < 3; wi++){
        var wPhase = ((T*0.8 + wi*0.33) % 1);
        var wRad = (15 + wPhase*35)*qSc;
        c.strokeStyle = 'rgba(180,220,255,' + (0.3*(1-wPhase)*qPulse).toFixed(3) + ')';
        c.lineWidth = (1.5 - wPhase)*qSc;
        c.beginPath();
        c.ellipse(0, -8*qSc, wRad, wRad*0.4, 0, 0, Math.PI*2);
        c.stroke();
      }
      /* 音符粒子 */
      var qpn = moving ? 7 : 4;
      for(var qpi = 0; qpi < qpn; qpi++){
        var qph = ((T*(0.5+qpi*0.1) + qpi*0.18) % 1);
        var qpx = Math.sin(T*1.5 + qpi*2.3) * 32*qSc;
        var qpy = -qph*50*qSc - 12*qSc;
        c.fillStyle = 'rgba(180,220,255,' + (0.5*(1-qph)).toFixed(3) + ')';
        c.beginPath(); c.arc(qpx, qpy, (2.4-qph*1.6)*qSc, 0, Math.PI*2); c.fill();
      }
      if(moving){
        for(var qt = 0; qt < 4; qt++){
          var qtp = ((T*2.2 + qt*0.25) % 1);
          var qtx = -F*(20+qtp*40)*qSc;
          c.fillStyle = 'rgba(180,220,255,' + (0.25*(1-qtp)).toFixed(3) + ')';
          c.beginPath(); c.arc(qtx, (2-qtp*4)*qSc, (2-qtp*1.3)*qSc, 0, Math.PI*2); c.fill();
        }
      }
      c.globalCompositeOperation = 'source-over';
      c.restore();
    } else if(model === 'windfire'){
      /* ---- 风火轮：脚下两只旋转火轮 ---- */
      for(var i = -1; i <= 1; i += 2){
        var cx = i * 17 * sc, cy = 4 * sc;
        var flick = 0.82 + Math.sin(T * 9 + i) * 0.14;
        var g = c.createRadialGradient(cx, cy, 1, cx, cy, 25 * sc * flick);
        g.addColorStop(0, 'rgba(255,240,170,0.95)');
        g.addColorStop(0.35, 'rgba(255,150,50,0.72)');
        g.addColorStop(0.7, 'rgba(255,70,20,0.24)');
        g.addColorStop(1, 'rgba(255,60,0,0)');
        c.fillStyle = g;
        c.beginPath(); c.ellipse(cx, cy, 24 * sc * flick, 15 * sc * flick, 0, 0, Math.PI * 2); c.fill();
        /* 轮毂 */
        c.strokeStyle = 'rgba(255,215,140,0.9)';
        c.lineWidth = 2 * sc;
        c.beginPath(); c.ellipse(cx, cy, 11 * sc, 5.5 * sc, 0, 0, Math.PI * 2); c.stroke();
        /* 旋转的辐条 */
        c.save();
        c.translate(cx, cy); c.rotate(T * (moving ? 9 : 3) * i);
        c.strokeStyle = 'rgba(255,236,180,0.75)';
        c.lineWidth = 1.6 * sc;
        for(var k = 0; k < 3; k++){
          var a = k * Math.PI * 2 / 3;
          c.beginPath();
          c.moveTo(0, 0);
          c.lineTo(Math.cos(a) * 11 * sc, Math.sin(a) * 5.5 * sc);
          c.stroke();
        }
        c.restore();
      }
      /* 拖尾火星 */
      if(moving){
        c.globalCompositeOperation = 'lighter';
        for(var s = 0; s < 5; s++){
          var ph = ((T * 2.6 + s * 0.2) % 1);
          var sx = -F * (10 + ph * 46) * sc;
          var sy = 2 * sc - ph * 10 * sc;
          c.fillStyle = 'rgba(255,' + Math.round(170 + 60 * (1 - ph)) + ',80,' + (0.55 * (1 - ph)).toFixed(3) + ')';
          c.beginPath(); c.arc(sx, sy, (2.6 - ph * 1.8) * sc, 0, Math.PI * 2); c.fill();
        }
      }
    } else {
      /* ---- 木滑板：一块板 + 两只发光的轮 ---- */
      var W = 76 * sc, H = 11 * sc, R = 5 * sc;
      var bob = moving ? Math.sin(T * 12) * 0.9 * sc : Math.sin(T * 2) * 0.7 * sc;
      /* 地面投影：让「悬浮一点」看得出来 */
      c.fillStyle = 'rgba(0,0,0,0.30)';
      c.beginPath(); c.ellipse(0, bob + H + 3 * sc, W * 0.5, 5 * sc, 0, 0, Math.PI * 2); c.fill();
      var gd = c.createLinearGradient(0, bob, 0, bob + H);
      gd.addColorStop(0, '#d8b06a');
      gd.addColorStop(0.45, '#8a6132');
      gd.addColorStop(1, '#4a3117');
      c.fillStyle = gd;
      c.beginPath(); roundRectPath(c, -W / 2, bob, W, H, R); c.fill();
      c.strokeStyle = 'rgba(255,226,170,0.55)';
      c.lineWidth = 1.1 * sc;
      c.beginPath(); roundRectPath(c, -W / 2, bob, W, H, R); c.stroke();
      /* 板面高光 */
      c.fillStyle = 'rgba(255,245,210,0.16)';
      c.beginPath(); roundRectPath(c, -W / 2 + 4 * sc, bob + 1.4 * sc, W - 8 * sc, 2.2 * sc, 1.4 * sc); c.fill();
      /* 轮子 */
      var wheelGlow = 0.55 + Math.sin(T * 3) * 0.12;
      for(var wi = -1; wi <= 1; wi += 2){
        var wx = wi * (W / 2 - 9 * sc), wy = bob + H - 1 * sc;
        var wg = c.createRadialGradient(wx, wy, 0, wx, wy, 9 * sc);
        wg.addColorStop(0, 'rgba(140,220,255,' + wheelGlow.toFixed(2) + ')');
        wg.addColorStop(0.5, 'rgba(90,170,255,0.32)');
        wg.addColorStop(1, 'rgba(60,120,255,0)');
        c.fillStyle = wg;
        c.beginPath(); c.arc(wx, wy, 9 * sc, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#cfeaff';
        c.beginPath(); c.arc(wx, wy, 2.6 * sc, 0, Math.PI * 2); c.fill();
      }
      /* 地面摩擦痕 / 尘土 */
      if(moving){
        c.globalCompositeOperation = 'lighter';
        for(var d = 0; d < 4; d++){
          var p2 = ((T * 2.2 + d * 0.25) % 1);
          var dx = -F * (14 + p2 * 40) * sc;
          c.fillStyle = 'rgba(210,235,255,' + (0.32 * (1 - p2)).toFixed(3) + ')';
          c.beginPath(); c.ellipse(dx, 3 * sc - p2 * 4 * sc, (7 - p2 * 5) * sc, (2.4 - p2 * 1.6) * sc, 0, 0, Math.PI * 2); c.fill();
        }
      }
    }
    c.restore();
  }

  /* 未实现模型的兜底：紫以上暂时也用高级外观，等美术补齐 */
  function visualModel(model){
    if(model === 'windfire' || model === 'hover' || model === 'wing' || model === 'flame' || model === 'star' || model === 'goldencloud' || model === 'flysword' || model === 'lotusthrone' || model === 'guqin') return model;
    return 'board';
  }

  /* ---------- 刷图掉落 ----------
     品阶上限跟着「掉落等级」走：
       1–20 级地图：最高粉（神器）
       21–40 级：最高传说
       50 级以上：才能出史诗
     小怪不掉，精英 1.5%、BOSS 6%（深渊更高） */
  function capTierForLevel(lv){
    if(lv <= 20) return 3;
    if(lv <= 40) return 4;
    return 5;
  }
  function rollDrop(level, opts){
    opts = opts || {};
    var abyss = !!opts.abyss;
    var p = opts.isBoss ? 0.06 : (opts.isElite ? 0.015 : 0);
    if(abyss) p = opts.isBoss ? 0.16 : 0.03;
    if(!(Math.random() < p)) return null;

    var cap = capTierForLevel(level || 1);
    var w = [0.50, 0.30, 0.14, 0.05, 0.008, 0.0018];
    var total = 0, i;
    for(i = 0; i <= cap; i++) total += w[i];
    var r = Math.random() * total, acc = 0, idx = 0;
    for(i = 0; i <= cap; i++){ acc += w[i]; if(r <= acc){ idx = i; break; } }
    var t = TIERS[idx];
    var eq = make(t.id, Math.max(1, Math.min(80, Math.round(level || 1))));
    eq.sealed = false;             /* 飞行道具不封装，捡到就能用 */
    eq.tradeable = idx < 5;
    return eq;
  }

  /* ---------- 小图标：给背包 / 装备栏用（画真正的模型，不是通用图标） ---------- */
  function drawIcon(c, cx, cy, size, model, t){
    if(!c) return;
    var m = visualModel(model || 'board');
    var sc, baseY;
    if(m === 'wing' || m === 'flame' || m === 'star'){
      sc = size / 200;                 /* 双翼横向跨度约 190*sc */
      baseY = cy + size * 0.42;
    } else if(m === 'goldencloud'){
      sc = size / 120;
      baseY = cy + size * 0.32;
    } else if(m === 'flysword'){
      sc = size / 130;
      baseY = cy + size * 0.30;
    } else if(m === 'lotusthrone'){
      sc = size / 130;
      baseY = cy + size * 0.34;
    } else if(m === 'guqin'){
      sc = size / 120;
      baseY = cy + size * 0.30;
    } else if(m === 'windfire'){
      sc = size / 92;                  /* 两只火轮跨度约 82*sc */
      baseY = cy + size * 0.32;
    } else if(m === 'hover'){
      sc = size / 100;
      baseY = cy + size * 0.30;
    } else {
      sc = size / 104;                 /* 板身 76*sc */
      baseY = cy + size * 0.28;
    }
    draw(c, cx, baseY, sc, m, t || (performance.now() / 1000), false, 1);
  }

  window.MOUNT = {
    SLOT: SLOT,
    TIERS: TIERS,
    POOL: POOL,
    tierById: tierById,
    make: make,
    of: off,
    ensure: ensure,
    modelOf: modelOf,
    rollDrop: rollDrop,
    capTierForLevel: capTierForLevel,
    visualModel: visualModel,
    draw: function(c, x, y, sc, model, t, moving, facing){
      draw(c, x, y, sc, visualModel(model), t, moving, facing);
    },
    /* 小图标（背包 / 装备栏 / 详情卡）：画真实模型 */
    drawIcon: drawIcon,
    /* 角色是否踩着道具（决定用站姿还是跑姿） */
    riding: function(p){ return !!off(p); }
  };
})();
