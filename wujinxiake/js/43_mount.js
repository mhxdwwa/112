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
    { id:'mythic',   name:'史诗', color:'#f39c12', model:'star',     label:'星陨神翼', lv:80, moveSpd:15, dodge:6.5 }
  ];

  function tierById(id){
    for(var i = 0; i < TIERS.length; i++) if(TIERS[i].id === id) return TIERS[i];
    return TIERS[0];
  }

  function make(tierId, level){
    var t = tierById(tierId);
    return {
      slot: SLOT,
      tier: t.id,
      tierName: t.name,
      tierColor: t.color,
      name: t.label,
      model: t.model,
      level: level || t.lv,
      enhance: 0, amplify: 0,
      baseAtk: 0, baseDef: 0, baseHp: 0, baseSpd: 0, baseCrit: 0,
      affixes: [],
      /* 只走「移速 / 回避」两条 */
      dnf: { moveSpd: t.moveSpd, dodge: t.dodge }
    };
  }

  function off(p){ return (p && p.equipment) ? p.equipment.mount : null; }
  function modelOf(p){ var m = off(p); return m ? (m.model || 'board') : ''; }

  /* 新手 / 老存档兜底：没有就发一块 1 级白板并自动装备 */
  function ensure(p){
    if(!p) return null;
    if(!p.equipment) p.equipment = {};
    if(!p.equipment.mount){
      p.equipment.mount = make('common', 1);
      return p.equipment.mount;
    }
    var m = p.equipment.mount;
    /* 补字段：老数据可能只有 tier */
    if(!m.model){ var t = tierById(m.tier); m.model = t.model; m.tierName = m.tierName || t.name; m.tierColor = m.tierColor || t.color; }
    if(!m.dnf) m.dnf = { moveSpd: tierById(m.tier).moveSpd, dodge: tierById(m.tier).dodge };
    return m;
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

  /* t: 时间（秒），moving: 是否在移动，facing: 1 / -1 */
  function draw(c, x, y, sc, model, t, moving, facing){
    if(!c) return;
    var T = t || (performance.now() / 1000);
    var F = (facing >= 0) ? 1 : -1;
    sc = sc || 1;

    c.save();
    c.translate(x, y);

    if(model === 'windfire'){
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
    if(model === 'windfire' || model === 'hover' || model === 'wing' || model === 'flame' || model === 'star') return 'windfire';
    return 'board';
  }

  window.MOUNT = {
    SLOT: SLOT,
    TIERS: TIERS,
    tierById: tierById,
    make: make,
    of: off,
    ensure: ensure,
    modelOf: modelOf,
    visualModel: visualModel,
    draw: function(c, x, y, sc, model, t, moving, facing){
      draw(c, x, y, sc, visualModel(model), t, moving, facing);
    },
    /* 角色是否踩着道具（决定用站姿还是跑姿） */
    riding: function(p){ return !!off(p); }
  };
})();
