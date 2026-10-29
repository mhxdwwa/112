/* ===== 城镇NPC系统 ===== */
/* ============================================================
   ★ 城镇三街区：云隐村（前街 / 市集 / 渡口）
   —— 走到画面左右边缘自动换街，NPC 按 area 归属，一座城当三座用
   ============================================================ */
/* ============================================================
   ★ 城镇 3.0 —— 五城镇世界（十字布局）
   中央主城（出生点）+ 东南西北四境城镇，每镇 3600×2160（与旧单镇同大小）
   镇内沿用主街格局，NPC 分散排布（每镇 3~4 位），镇间以传送门互通
   十字之外的四个角落为墟界荒野（可通行，无 NPC）
   ============================================================ */
const TOWN_ZONE_W = 3600, TOWN_ZONE_H = 2160;
const TOWN_W = TOWN_ZONE_W * 3, TOWN_H = TOWN_ZONE_H * 3;   /* 10800 × 6480 */
const TOWN_GROUND_TOP = GY_BOTTOM - 100;                    /* 地面起始于世界 y=565 */

/* 街道模板（镇内相对坐标）：主干道宽阔，次街收窄 */
const TOWN_STREET_TPL = [
  { axis:'h', c:240,  w:122, name:'观星长街', main:false },
  { axis:'h', c:500,  w:112, name:'铁匠巷',   main:false },
  { axis:'h', c:840,  w:230, name:'前街',     main:true  },  /* 主横街：贯穿全镇的东西轴线 */
  { axis:'h', c:1160, w:130, name:'市集大街', main:false },
  { axis:'h', c:1440, w:120, name:'灯市街',   main:false },
  { axis:'h', c:1700, w:112, name:'药人巷',   main:false },
  { axis:'h', c:2000, w:150, name:'渡口大道', main:false },
  { axis:'v', c:360,  w:112, name:'西巷',     main:false },
  { axis:'v', c:1500, w:230, name:'中央大道', main:true  },  /* 主竖街：连接主街与南端 */
  { axis:'v', c:2300, w:112, name:'灯柱巷',   main:false },
  { axis:'v', c:3160, w:132, name:'东环巷',   main:false }
];
/* 坊区几何模板（镇内相对坐标，6 块） */
const TOWN_REGION_GEO = [
  { x:0,    y:0,    w:1500, h:1050 },
  { x:1500, y:0,    w:1100, h:1050 },
  { x:2600, y:0,    w:1000, h:1050 },
  { x:0,    y:1050, w:1500, h:1110 },
  { x:1500, y:1050, w:1100, h:1110 },
  { x:2600, y:1050, w:1000, h:1110 }
];
/* 传送门方位（镇内相对坐标）：四缘各一座 */
const PORTAL_SPOTS = { n:{x:1500,y:330}, e:{x:3260,y:960}, s:{x:1500,y:1860}, w:{x:340,y:960} };
const TOWN_SHORT = { center:'中央主城', east:'东港·青鸾镇', south:'南岭·朱明镇', west:'西麓·白泽镇', north:'北境·玄冥镇' };
/* 传送门指向：该方向有邻居镇则去邻居，否则回中央主城 */
const DIR_NEIGHBOR = {
  center:{ n:'north', e:'east', s:'south', w:'west' },
  north: { s:'center', e:'east', w:'west', n:'center' },
  east:  { w:'center', n:'north', s:'south', e:'center' },
  south: { n:'center', e:'east', w:'west', s:'center' },
  west:  { e:'center', n:'north', s:'south', w:'center' }
};

/* ── 五城镇定义（坐标为镇内相对坐标，加载时偏移到世界坐标） ──
   regs: 6 坊区的后缀名与氛围文案；npcs: 分散的功能 NPC（home=店铺建筑）；
   deco: 无 NPC 的装饰建筑 */
const TOWN_DEFS = [
  { key:'center', name:'云隐 · 中央主城', ox:3600, oy:2160,
    sky:['#1a1a3e','#3a2a5e','#6a4a7e'], bld:'#2a2a4e', lamp:'rgba(255,196,96,0.42)', ground:'#565a54',
    spawn:{ x:4680, y:3020 },
    regs:[
      { suf:'前街', sub:'青石主街，引灯亭的灯一直亮到天明' },
      { suf:'市集', sub:'主城早市的吆喝混着药香' },
      { suf:'灯塔', sub:'主城灯塔高耸，望得见四境的路' },
      { suf:'坊市', sub:'说书人的醒木一响，茶楼便坐满了人' },
      { suf:'南坊', sub:'出城前最后一段路，灯火最稠' },
      { suf:'渡口', sub:'雾气从裂隙漫进渡口，橹声隐隐' }
    ],
    npcs:[
      { id:'questmaster', name:'引灯人·阿箬', x:1140, y:620, type:'quest', desc:'主线任务',
        home:{ x:1140, y:590, w:200, h:170, kind:'tower', name:'引灯亭', color:'#3a3a4e', roof:'#403c58', accent:'#7fd0ff' } },
      { id:'blacksmith', name:'铁匠·王大锤', x:420, y:900, type:'enhance', desc:'装备强化 / 增幅',
        home:{ x:420, y:860, w:250, h:150, kind:'shop', name:'铁匠铺', color:'#4a3a34', roof:'#3e3440', accent:'#c96a3a' } },
      { id:'merchant', name:'商人·李掌柜', x:2150, y:900, type:'shop', desc:'装备商店',
        home:{ x:2150, y:860, w:270, h:150, kind:'shop', name:'云隐商会', color:'#3a3a52', roof:'#333044', accent:'#c9a84c' } },
      { id:'healer', name:'药师·白婆婆', x:2760, y:1300, type:'heal', desc:'回复气血',
        home:{ x:2760, y:1260, w:230, h:140, kind:'shop', name:'百草堂', color:'#3a4a3a', roof:'#333f38', accent:'#5ee08a' } }
    ],
    deco:[
      { x:860,  y:680,  w:340, h:250, kind:'mansion', name:'云隐侯府', accent:'#ffd166' },
      { x:700,  y:1300, w:200, h:120, kind:'house', name:'', color:'#403a34', roof:'#3a343c', accent:'#b0a898' },
      { x:2600, y:1700, w:200, h:120, kind:'house', name:'', color:'#3e3a4a', roof:'#363244', accent:'#b0a898' },
      { x:1200, y:1750, w:70,  h:50,  kind:'well',  name:'', color:'#4a4238', roof:'#3d3630', accent:'#8fd0e0' },
      { x:1800, y:560,  w:120, h:70,  kind:'stall', name:'', color:'#4a3a30', roof:'#6a3a28', accent:'#ffb066' },
      { x:2400, y:380,  w:90,  h:230, kind:'tower', name:'主城灯塔', color:'#2a3a4e', roof:'#263a48', accent:'#7ff0ff' }
    ] },
  { key:'east', name:'青鸾 · 东港商镇', ox:7200, oy:2160,
    sky:['#0e2a30','#1e4a4e','#3e6a66'], bld:'#1e3a3e', lamp:'rgba(120,255,220,0.40)', ground:'#4e5852',
    spawn:{ x:8340, y:3020 },
    regs:[
      { suf:'鸾栖坊', sub:'青鸾使者的旗在海风里猎猎作响' },
      { suf:'早市', sub:'渔获与山货在这里交换' },
      { suf:'灯塔', sub:'东港灯塔为归船引路' },
      { suf:'渔巷', sub:'巷子里晒着渔网，咸腥而鲜活' },
      { suf:'海市', sub:'传闻深水里有会唱歌的东西' },
      { suf:'码头', sub:'去往深海的船在这里补给' }
    ],
    npcs:[
      { id:'gate_east', name:'传送使·青鸾', x:1500, y:900, type:'gate', gate:{from:0,to:6}, desc:'传送 1~22 级地图' },
      { id:'grocer', name:'杂货商·钱二', x:600, y:620, type:'shop', desc:'杂货铺子',
        home:{ x:600, y:580, w:230, h:140, kind:'shop', name:'杂货铺', color:'#4a4438', roof:'#3d3830', accent:'#ffd166' } },
      { id:'wanderer', name:'游方·说书人', x:2500, y:620, type:'lore', desc:'听一段墟界旧事',
        home:{ x:2500, y:580, w:210, h:90, kind:'stall', name:'说书摊', color:'#4a3a30', roof:'#6a3a28', accent:'#ffb066' } },
      { id:'urchin', name:'乞儿·豆子', x:1100, y:1560, type:'lore', desc:'小家伙有话说',
        home:{ x:1100, y:1520, w:220, h:120, kind:'house', name:'', color:'#423e36', roof:'#383430', accent:'#b0a898' } }
    ],
    deco:[
      { x:2000, y:700,  w:320, h:240, kind:'mansion', name:'潮生商府', accent:'#7fe0d0' },
      { x:300,  y:1500, w:200, h:120, kind:'house', name:'', color:'#3a4250', roof:'#333a44', accent:'#b0a898' },
      { x:2600, y:1300, w:200, h:120, kind:'house', name:'', color:'#3e3a4a', roof:'#363244', accent:'#b0a898' },
      { x:2200, y:400,  w:70,  h:50,  kind:'well',  name:'', color:'#4a4238', roof:'#3d3630', accent:'#8fd0e0' },
      { x:1900, y:1120, w:120, h:70,  kind:'stall', name:'', color:'#4a4038', roof:'#643a30', accent:'#ffb066' }
    ] },
  { key:'south', name:'朱明 · 南岭炎镇', ox:3600, oy:4320,
    sky:['#2e1410','#4e2418','#6e3a20'], bld:'#3a2018', lamp:'rgba(255,140,70,0.45)', ground:'#585550',
    spawn:{ x:4740, y:5180 },
    regs:[
      { suf:'焰门街', sub:'朱明使者的火把把街石映得发亮' },
      { suf:'炭市', sub:'炭火昼夜不熄，铁料在这里出炉' },
      { suf:'火坛', sub:'镇中央的长明火坛，百年未灭' },
      { suf:'窑坊', sub:'窑烟升起来，像一条条赤龙' },
      { suf:'铁市', sub:'兵刃与农具摆满了整条街' },
      { suf:'灰渡', sub:'火山灰落进河里，水都带着暖意' }
    ],
    npcs:[
      { id:'gate_south', name:'传送使·朱明', x:1500, y:900, type:'gate', gate:{from:7,to:12}, desc:'传送 22~41 级地图' },
      { id:'stash', name:'仓管·老陈', x:600, y:1300, type:'stash', desc:'整理行囊',
        home:{ x:600, y:1260, w:250, h:150, kind:'house', name:'聚宝仓', color:'#4a4238', roof:'#3d3630', accent:'#e0c98a' } },
      { id:'recycler', name:'分解师·铜锁', x:2400, y:1560, type:'decompose', desc:'装备分解',
        home:{ x:2400, y:1520, w:230, h:140, kind:'shop', name:'熔金铺', color:'#4a4038', roof:'#3d3630', accent:'#ff9a6b' } },
      { id:'watchman', name:'更夫·老周', x:2800, y:560, type:'lore', desc:'听更夫闲谈',
        home:{ x:2800, y:520, w:170, h:170, kind:'tower', name:'更楼', color:'#403a34', roof:'#3a3440', accent:'#ffd166' } }
    ],
    deco:[
      { x:1900, y:760,  w:330, h:250, kind:'mansion', name:'朱明武府', accent:'#ff9a6b' },
      { x:500,  y:500,  w:200, h:120, kind:'house', name:'', color:'#403a34', roof:'#3a343c', accent:'#b0a898' },
      { x:1100, y:1120, w:200, h:120, kind:'house', name:'', color:'#3e3a4a', roof:'#363244', accent:'#b0a898' },
      { x:3000, y:1700, w:70,  h:50,  kind:'well',  name:'', color:'#4a4238', roof:'#3d3630', accent:'#8fd0e0' },
      { x:1900, y:2000, w:120, h:70,  kind:'stall', name:'', color:'#44382e', roof:'#5e3628', accent:'#ffb066' }
    ] },
  { key:'west', name:'白泽 · 西麓古镇', ox:0, oy:2160,
    sky:['#1a2030','#343e54','#5a5a70'], bld:'#2e3448', lamp:'rgba(255,230,150,0.45)', ground:'#4e5654',
    spawn:{ x:1140, y:3020 },
    regs:[
      { suf:'松涛坊', sub:'白泽使者的书案上摊着古卷' },
      { suf:'药市', sub:'西山采来的药材在竹匾里晾晒' },
      { suf:'古钟', sub:'山寺古钟一响，群鸟掠过檐角' },
      { suf:'书坊', sub:'抄书人的笔声沙沙像春蚕' },
      { suf:'砚市', sub:'端砚湖笔，文人的行囊从这里上路' },
      { suf:'林渡', sub:'林深处的渡口，船夫是个哑巴' }
    ],
    npcs:[
      { id:'gate_west', name:'传送使·白泽', x:1500, y:900, type:'gate', gate:{from:13,to:23}, desc:'传送 41~60 级地图' },
      { id:'reforger', name:'洗练师·墨七', x:700, y:1620, type:'reforge', desc:'词条洗练',
        home:{ x:700, y:1580, w:250, h:150, kind:'shop', name:'洗练坊', color:'#403a4e', roof:'#363248', accent:'#b18bff' } },
      { id:'teaminer', name:'茶博士·温娘', x:2300, y:560, type:'heal', desc:'讨碗热茶回血',
        home:{ x:2300, y:520, w:250, h:150, kind:'shop', name:'清心茶楼', color:'#3e4238', roof:'#363c38', accent:'#a8e0a0' } },
      { id:'painter', name:'画师·沈青', x:2950, y:1300, type:'lore', desc:'看画听故事',
        home:{ x:2950, y:1260, w:230, h:140, kind:'shop', name:'丹青坊', color:'#3a4250', roof:'#333a44', accent:'#cfd8e8' } }
    ],
    deco:[
      { x:1000, y:700,  w:330, h:250, kind:'mansion', name:'白泽书院', accent:'#e8d9a0' },
      { x:400,  y:400,  w:200, h:120, kind:'house', name:'', color:'#403a34', roof:'#3a343c', accent:'#b0a898' },
      { x:1800, y:1500, w:200, h:120, kind:'house', name:'', color:'#3e3a4a', roof:'#363244', accent:'#b0a898' },
      { x:1200, y:1150, w:70,  h:50,  kind:'well',  name:'', color:'#4a4238', roof:'#3d3630', accent:'#8fd0e0' },
      { x:3100, y:600,  w:120, h:70,  kind:'stall', name:'', color:'#4a3a30', roof:'#6a3a28', accent:'#ffb066' }
    ] },
  { key:'north', name:'玄冥 · 北境冥镇', ox:3600, oy:0,
    sky:['#0e0a20','#241a3e','#3a2a56'], bld:'#201a36', lamp:'rgba(150,130,255,0.42)', ground:'#464c52',
    spawn:{ x:4740, y:860 },
    regs:[
      { suf:'霜街', sub:'玄冥使者的斗篷上落着化不掉的霜' },
      { suf:'冥市', sub:'这里交易的东西，一半见不得光' },
      { suf:'魂灯', sub:'九盏魂灯照着北去的路' },
      { suf:'雾坊', sub:'雾浓得能拧出水，也拧出低语' },
      { suf:'夜市', sub:'北境没有白天，夜市就是白昼' },
      { suf:'幽渡', sub:'渡船驶向的裂隙，是深渊的门廊' }
    ],
    npcs:[
      { id:'porter', name:'深渊传送使·玄冥', x:1500, y:900, type:'gate', gate:'abyss', desc:'传送深渊（50级准入）' },
      { id:'gatekeeper', name:'守门人', x:2900, y:500, type:'dungeon', desc:'守门人试炼',
        home:{ x:2900, y:460, w:300, h:200, kind:'gate', name:'北城门', color:'#3a3a46', roof:'#33333e', accent:'#b18bff' } },
      { id:'ferry', name:'船家·橹叔', x:600, y:1700, type:'lore', desc:'听渡口的传说',
        home:{ x:600, y:1660, w:270, h:100, kind:'pier', name:'幽渡', color:'#4a4038', roof:'#3d3630', accent:'#8fd0e0' } }
    ],
    deco:[
      { x:2050, y:700,  w:320, h:240, kind:'mansion', name:'玄冥古宅', accent:'#b18bff' },
      { x:400,  y:700,  w:200, h:120, kind:'house', name:'', color:'#3a4250', roof:'#333a44', accent:'#b0a898' },
      { x:2500, y:1500, w:200, h:120, kind:'house', name:'', color:'#3e3a4a', roof:'#363244', accent:'#b0a898' },
      { x:1800, y:400,  w:90,  h:230, kind:'tower', name:'第九灯柱', color:'#2a3a4e', roof:'#263a48', accent:'#7ff0ff' },
      { x:1000, y:1150, w:70,  h:50,  kind:'well',  name:'', color:'#4a4238', roof:'#3d3630', accent:'#8fd0e0' }
    ] }
];

/* ── 实例化：街道 / 坊区 / 建筑 / NPC（绝对坐标） ── */
const TOWN_STREETS = [];
const TOWN_REGIONS = [];
const TOWN_BUILDINGS = [];
const NPCS = [];
const TOWN_DEFS_BY_KEY = {};
for(const def of TOWN_DEFS){
  TOWN_DEFS_BY_KEY[def.key] = def;
  /* 街道：横街只在镇内横跨；竖街从地面线铺到镇南缘 */
  for(const st of TOWN_STREET_TPL){
    if(st.axis === 'h'){
      TOWN_STREETS.push({ axis:'h', c:def.oy + st.c, w:st.w, main:st.main,
        x0:def.ox, x1:def.ox + TOWN_ZONE_W, name:st.name });
    } else {
      TOWN_STREETS.push({ axis:'v', c:def.ox + st.c, w:st.w, main:st.main,
        y0:Math.max(TOWN_GROUND_TOP, def.oy + 80), y1:def.oy + TOWN_ZONE_H - 30, name:st.name });
    }
  }
  /* 坊区 */
  TOWN_REGION_GEO.forEach(function(g, i){
    TOWN_REGIONS.push({ x:def.ox + g.x, y:def.oy + g.y, w:g.w, h:g.h,
      name:def.name + ' · ' + def.regs[i].suf, sub:def.regs[i].sub,
      sky:def.sky, bld:def.bld, lamp:def.lamp, ground:def.ground });
  });
  /* 建筑：NPC 店铺 + 传送阵 + 装饰 */
  let bi = 0;
  for(const n of def.npcs){
    if(n.home) TOWN_BUILDINGS.push(Object.assign({}, n.home, {
      id:def.key + '_' + (n.home.name || ('h' + (bi++))), x:def.ox + n.home.x, y:def.oy + n.home.y }));
  }
  for(const dir in PORTAL_SPOTS){
    const p = PORTAL_SPOTS[dir];
    TOWN_BUILDINGS.push({ id:def.key + '_p_' + dir, x:def.ox + p.x, y:def.oy + p.y - 40,
      w:180, h:60, kind:'altar', name:'传送阵', color:'#2a3a4e', roof:'#263a48', accent:'#5ee0ff' });
  }
  for(const b of (def.deco || [])){
    TOWN_BUILDINGS.push(Object.assign({}, b, { id:def.key + '_d' + (bi++), x:def.ox + b.x, y:def.oy + b.y }));
  }
  /* ★ 市集摊位群：每镇市集大街（相对 y≈1250）一排热闹摊位 */
  [{ x:1700, y:1250, c:'#ffb066' }, { x:1950, y:1272, c:'#8fd0e0' }, { x:2200, y:1244, c:'#c9a2ff' }].forEach(function(ms, mi){
    TOWN_BUILDINGS.push({ id:def.key + '_mkt' + mi, x:def.ox + ms.x, y:def.oy + ms.y,
      w:130, h:72, kind:'stall', name:'', color:'#4a3a30', roof:'#6a3a28', accent:ms.c });
  });
  /* ★ 草木点缀：每镇程序化散布树木 / 桃树（确定性伪随机，避开街道/建筑/NPC/传送门/广场） */
  const peachy = def.key === 'east' ? 0.45 : (def.key === 'north' ? 0.12 : 0.3);
  let placed = 0, guard = 0;
  while(placed < 13 && guard < 500){
    guard++;
    const tx = def.ox + 90 + hash01(def.ox * 0.017 + guard * 3.1) * (TOWN_ZONE_W - 180);
    const ty = def.oy + 300 + hash01(def.oy * 0.019 + guard * 7.7) * (TOWN_ZONE_H - 380);
    if(ty < TOWN_GROUND_TOP + 30) continue;
    let bad = false;
    /* 避开街道 */
    for(const st of TOWN_STREETS){
      if(st.axis === 'h'){ if(tx >= st.x0 && tx <= st.x1 && Math.abs(ty - st.c) < st.w/2 + 34){ bad = true; break; } }
      else { if(ty >= st.y0 - 70 && ty <= st.y1 && Math.abs(tx - st.c) < st.w/2 + 34){ bad = true; break; } }
    }
    if(bad) continue;
    /* 避开广场与四角传送门 */
    if(Math.hypot(tx - (def.ox + 1500), ty - (def.oy + 840)) < 230){ continue; }
    for(const pd in PORTAL_SPOTS){
      if(Math.hypot(tx - (def.ox + PORTAL_SPOTS[pd].x), ty - (def.oy + PORTAL_SPOTS[pd].y)) < 150){ bad = true; break; }
    }
    if(bad) continue;
    /* 避开已有建筑（脚点距离）与 NPC */
    for(const b2 of TOWN_BUILDINGS){
      if(Math.abs(tx - b2.x) < b2.w/2 + 56 && Math.abs(ty - b2.y) < 70){ bad = true; break; }
    }
    if(bad) continue;
    for(const n2 of def.npcs){
      if(Math.hypot(tx - (def.ox + n2.x), ty - (def.oy + n2.y)) < 90){ bad = true; break; }
    }
    if(bad) continue;
    const isPeach = hash01(guard * 13.37 + def.ox * 0.11) < peachy;
    const tall = 120 + hash01(guard * 5.9 + def.oy * 0.07) * 60;
    TOWN_BUILDINGS.push({ id:def.key + '_t' + guard, x:tx, y:ty,
      w:isPeach ? 92 : 84, h:Math.round(tall), kind:isPeach ? 'peach' : 'tree', name:'' });
    placed++;
  }
  /* NPC 实例化 */
  for(const n of def.npcs){
    NPCS.push({ id:n.id, name:n.name, x:def.ox + n.x, y:def.oy + n.y, type:n.type, gate:n.gate, desc:n.desc });
  }
  /* 传送门 NPC：四缘各一座，指向对应城镇 */
  for(const dir in PORTAL_SPOTS){
    const target = DIR_NEIGHBOR[def.key][dir];
    const p = PORTAL_SPOTS[dir];
    NPCS.push({ id:'portal_' + def.key + '_' + dir, name:'传送门 · ' + TOWN_SHORT[target],
      type:'portal', target:target, x:def.ox + p.x, y:def.oy + p.y, desc:'传送到' + TOWN_SHORT[target] });
  }
}

/* 荒野（十字之外的角落）：可通行，无 NPC；四角补一片野生林木 */
(function(){
  const corners = [ [900,900], [9900,900], [900,5580], [9900,5580] ];
  for(let i = 0; i < 24; i++){
    const c = corners[i % 4];
    const tx = c[0] + (hash01(i * 3.7 + 1) - 0.5) * 1500;
    const ty = c[1] + (hash01(i * 9.1 + 5) - 0.5) * 900;
    if(ty < TOWN_GROUND_TOP + 40) continue;
    TOWN_BUILDINGS.push({ id:'wild_t' + i, x:Math.round(tx), y:Math.round(ty),
      w:88, h:Math.round(130 + hash01(i * 7.3) * 70), kind: 'tree', name:'' });
  }
})();

/* 荒野（十字之外的角落）：可通行，无 NPC */
const WILDER_REGION = { x:0, y:0, w:TOWN_W, h:TOWN_H, name:'墟界 · 荒野',
  sub:'野草没膝，风里有旧战场的回声',
  sky:['#12101e','#262238','#443e56'], bld:'#262436', lamp:'rgba(180,170,255,0.30)', ground:'#3e4438' };
function townRegionAt(x, y){
  for(const r of TOWN_REGIONS){
    if(x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) return r;
  }
  return WILDER_REGION;
}
let townCam = { x:0, y:0 };

/* 建筑碰撞：玩家不能穿墙（低矮物 stall/well/altar/pier/tree/peach 与拱门 gate 可穿过） */
const TOWN_SOLID_KINDS = { shop:1, house:1, tower:1, mansion:1 };
function townSolidRects(){
  return TOWN_BUILDINGS.filter(b => TOWN_SOLID_KINDS[b.kind]);
}

/* ★ 建筑配色（黄昏暖木 + 青瓦）：按类型取色，再按 id 做轻微色偏，避免整条街一个颜色 */
const TOWN_BUILDING_TONES = {
  shop:  { wall:'#6b5844', roof:'#3d4750' },
  house: { wall:'#5f5244', roof:'#39434b' },
  tower: { wall:'#556069', roof:'#3a464f' },
  gate:  { wall:'#4c525c', roof:'#39434b' },
  stall: { wall:'#6a5642', roof:'#6b3b28' },
  mansion:{ wall:'#6a5648', roof:'#39434b' }
};
function buildingTone(b){
  const base = TOWN_BUILDING_TONES[b.kind] || TOWN_BUILDING_TONES.house;
  let h = 0;
  const s = b.id || '';
  for(let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0xff;
  const warm = (h % 17) - 8;          /* -8 ~ +8 色温微调 */
  const plus = (warm > 0 ? warm * 2 : warm) ;
  return {
    wall: shadeColor(base.wall, plus),
    roof: shadeColor(base.roof, (h % 11) - 5)
  };
}

/* 画一栋 2.5D 建筑（世界坐标，脚底 y = b.y 用于遮挡排序） */
function drawBuilding(b){
  const x = b.x, y = b.y, w = b.w, h = b.h;
  const d = Math.max(22, Math.min(44, h * 0.28));  /* 屋顶斜切深度 */
  const tone = buildingTone(b);
  const wall = tone.wall, roof = tone.roof, dark = shadeColor(wall, -26);

  /* 阴影 */
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath();
  ctx.ellipse(x, y + 4, w * 0.62, 14, 0, 0, TAU);
  ctx.fill();

  if(b.kind === 'altar'){
    /* 传送阵：圆形石台 + 符文 + 光柱 */
    ctx.fillStyle = dark;
    ctx.beginPath(); ctx.ellipse(x, y, w/2, h*0.5, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = wall;
    ctx.beginPath(); ctx.ellipse(x, y - 8, w/2 - 8, h*0.5 - 6, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = b.accent; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(x, y - 8, w/2 - 16, h*0.5 - 12, 0, 0, TAU); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - w*0.2, y - 8); ctx.lineTo(x + w*0.2, y - 8);
    ctx.moveTo(x, y - 8 - h*0.25); ctx.lineTo(x, y - 8 + h*0.25);
    ctx.stroke();
    /* 光柱 */
    const pulse = 0.55 + 0.25 * Math.sin((G ? G.t : 0) * 2.2);
    const lg = ctx.createLinearGradient(x, y - h - 60, x, y - 6);
    lg.addColorStop(0, 'rgba(95,224,255,0)');
    lg.addColorStop(0.5, 'rgba(95,224,255,' + (0.30 * pulse) + ')');
    lg.addColorStop(1, 'rgba(95,224,255,0)');
    ctx.fillStyle = lg;
    ctx.fillRect(x - w*0.3, y - h - 60, w*0.6, h + 54);
    return;
  }

  if(b.kind === 'well'){
    /* 水井 */
    ctx.fillStyle = dark;
    ctx.beginPath(); ctx.ellipse(x, y, w/2, h*0.4, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = wall;
    ctx.beginPath(); ctx.ellipse(x, y - 10, w/2, h*0.4, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#1a2a3a';
    ctx.beginPath(); ctx.ellipse(x, y - 10, w/2 - 10, h*0.4 - 6, 0, 0, TAU); ctx.fill();
    /* 井架 */
    ctx.strokeStyle = roof; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(x - w/2, y - 16); ctx.lineTo(x, y - 16 - h*0.9); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + w/2, y - 16); ctx.lineTo(x, y - 16 - h*0.9); ctx.stroke();
    ctx.strokeStyle = '#2a2a38'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x, y - 16 - h*0.9); ctx.lineTo(x, y - 12); ctx.stroke();
    return;
  }

  if(b.kind === 'pier'){
    /* 渡口码头：木板 + 木桩 */
    ctx.fillStyle = roof;
    ctx.fillRect(x - w/2, y - h*0.35, w, h*0.35);
    ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1;
    for(let i = 1; i < 5; i++){ const sx = x - w/2 + w*i/5; ctx.beginPath(); ctx.moveTo(sx, y - h*0.35); ctx.lineTo(sx, y); ctx.stroke(); }
    ctx.fillStyle = '#3a2a1e';
    for(const px of [x - w*0.35, x - w*0.1, x + w*0.15, x + w*0.4]){
      ctx.fillRect(px - 4, y - 8, 8, 30);
    }
    /* 水面波光 */
    const wp = 0.4 + 0.2 * Math.sin((G ? G.t : 0) * 1.6);
    ctx.fillStyle = 'rgba(120,200,220,' + wp + ')';
    ctx.beginPath(); ctx.ellipse(x, y + 20, w*0.55, 10, 0, 0, TAU); ctx.fill();
    return;
  }

  if(b.kind === 'stall'){
    /* 摊位：遮阳棚 + 货台 */
    const topY = y - h;
    ctx.fillStyle = roof;
    ctx.beginPath();
    ctx.moveTo(x - w/2, y - h*0.5);
    ctx.lineTo(x - w/2 + d, topY);
    ctx.lineTo(x + w/2 + d, topY);
    ctx.lineTo(x + w/2, y - h*0.5);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1; ctx.stroke();
    /* 棚沿锯齿 */
    ctx.fillStyle = b.accent;
    for(let i = 0; i < 4; i++){
      const sx = x - w/2 + 6 + i * (w - 12) / 3;
      ctx.beginPath(); ctx.moveTo(sx, y - h*0.5); ctx.lineTo(sx + 10, y - h*0.5 - 8); ctx.lineTo(sx + 20, y - h*0.5); ctx.fill();
    }
    /* 货台 */
    ctx.fillStyle = wall;
    ctx.fillRect(x - w/2 + 6, y - h*0.5, w - 12, h*0.5);
    ctx.fillStyle = dark;
    ctx.fillRect(x - w/2 + 6, y - h*0.25, w - 12, 4);
    return;
  }

  if(b.kind === 'gate'){
    /* 城门：城墙体 + 拱形门洞 */
    ctx.fillStyle = dark;
    ctx.fillRect(x - w/2, y - h, w, h);
    /* 城垛 */
    ctx.fillStyle = roof;
    for(let i = 0; i < 5; i++){
      const cx = x - w/2 + w * (i + 0.5) / 5;
      ctx.fillRect(cx - 12, y - h - 18, 24, 18);
    }
    /* 砖缝 */
    ctx.strokeStyle = 'rgba(0,0,0,0.28)'; ctx.lineWidth = 1;
    for(let r = 1; r < 5; r++){ ctx.beginPath(); ctx.moveTo(x - w/2, y - h + r*h/5); ctx.lineTo(x + w/2, y - h + r*h/5); ctx.stroke(); }
    /* 门洞（拱形，深色，透出远处雾光） */
    const gw = w * 0.42, gh = h * 0.72, gy = y - gh;
    const hole = ctx.createLinearGradient(x, gy, x, y);
    hole.addColorStop(0, '#141e2e'); hole.addColorStop(1, '#0a0f1a');
    ctx.fillStyle = hole;
    ctx.beginPath();
    ctx.moveTo(x - gw/2, y);
    ctx.lineTo(x - gw/2, gy + gw*0.3);
    ctx.quadraticCurveTo(x - gw/2, gy, x, gy);
    ctx.quadraticCurveTo(x + gw/2, gy, x + gw/2, gy + gw*0.3);
    ctx.lineTo(x + gw/2, y);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = b.accent; ctx.lineWidth = 3;
    ctx.stroke();
    /* 门楣招牌 */
    if(b.name) drawSign(x, y - h - 8, b.name, b.accent);
    return;
  }

  if(b.kind === 'tower'){
    /* 塔楼：逐层收窄 + 尖顶 */
    const tiers = 3, tw = w, th = h / tiers;
    for(let t = 0; t < tiers; t++){
      const shrink = t * w * 0.14;
      const lx = x - tw/2 + shrink/2, rx = x + tw/2 - shrink/2;
      const ly = y - th*(t+1), ry = y - th*t;
      ctx.fillStyle = t % 2 ? wall : shadeColor(wall, -12);
      ctx.fillRect(lx, ly, rx - lx, ry - ly);
      ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1;
      ctx.strokeRect(lx, ly, rx - lx, ry - ly);
      /* 层间窗 */
      ctx.fillStyle = '#1a1a2a';
      ctx.fillRect(x - 8, ly + th*0.25, 16, 10);
    }
    /* 尖顶 */
    const apexY = y - h - 34;
    ctx.fillStyle = roof;
    ctx.beginPath();
    ctx.moveTo(x - w*0.28, y - h);
    ctx.lineTo(x, apexY);
    ctx.lineTo(x + w*0.28, y - h);
    ctx.closePath(); ctx.fill();
    /* 顶灯（发光） */
    const lg = ctx.createRadialGradient(x, apexY + 4, 1, x, apexY + 4, 22);
    lg.addColorStop(0, b.accent); lg.addColorStop(1, 'rgba(255,200,80,0)');
    ctx.fillStyle = lg;
    ctx.beginPath(); ctx.arc(x, apexY + 4, 22, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff2c0';
    ctx.beginPath(); ctx.arc(x, apexY + 4, 4, 0, TAU); ctx.fill();
    if(b.name) drawSign(x, y - h - 8, b.name, b.accent);
    return;
  }

  if(b.kind === 'mansion'){
    /* 高大古代宅院：一圈院墙 + 中央两层门楼（大屋顶/飞檐/匾额/门钉） + 墙头角灯笼 */
    const t = G ? G.t : 0;
    const wallH = Math.max(64, h * 0.42);
    /* 院墙（横贯全宽） */
    ctx.fillStyle = shadeColor(wall, -16);
    ctx.fillRect(x - w/2, y - wallH, w, wallH);
    /* 墙头青瓦压顶 */
    ctx.fillStyle = roof;
    ctx.fillRect(x - w/2 - 5, y - wallH - 9, w + 10, 11);
    /* 墙面砖缝 */
    ctx.strokeStyle = 'rgba(0,0,0,0.20)'; ctx.lineWidth = 1;
    for(let i = 1; i < Math.floor(w / 42); i++){
      const lx = x - w/2 + i * 42;
      ctx.beginPath(); ctx.moveTo(lx, y - wallH + 2); ctx.lineTo(lx, y); ctx.stroke();
    }
    for(let r2 = 1; r2 < 3; r2++){
      const ly2 = y - wallH + (wallH * r2) / 3;
      ctx.beginPath(); ctx.moveTo(x - w/2, ly2); ctx.lineTo(x + w/2, ly2); ctx.stroke();
    }
    /* 中央门楼：主楼体 + 上层阁楼 */
    const mw = w * 0.44, mh = h;
    ctx.fillStyle = wall;
    ctx.fillRect(x - mw/2, y - mh, mw, mh);
    ctx.fillStyle = shadeColor(wall, 8);
    ctx.fillRect(x - mw*0.36, y - mh, mw*0.72, mh*0.34);
    /* 上层木格窗（暖光） */
    ctx.fillStyle = 'rgba(255,196,96,0.75)';
    ctx.fillRect(x - mw*0.26, y - mh*0.92, mw*0.52, mh*0.15);
    ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 1;
    ctx.strokeRect(x - mw*0.26, y - mh*0.92, mw*0.52, mh*0.15);
    ctx.beginPath();
    ctx.moveTo(x, y - mh*0.92); ctx.lineTo(x, y - mh*0.77);
    ctx.moveTo(x - mw*0.26, y - mh*0.845); ctx.lineTo(x + mw*0.26, y - mh*0.845);
    ctx.stroke();
    /* 门楼大屋顶（双坡 + 正脊 + 飞檐翘角） */
    const ridge2 = y - mh - d * 0.9;
    ctx.fillStyle = roof;
    ctx.beginPath();
    ctx.moveTo(x - mw/2 - 10, y - mh + 2);
    ctx.lineTo(x, ridge2);
    ctx.lineTo(x + mw/2 + 10, y - mh + 2);
    ctx.lineTo(x + mw/2 + 10 + d, y - mh + 2 - d);
    ctx.lineTo(x + d, ridge2 - d);
    ctx.lineTo(x - mw/2 - 10 + d, y - mh + 2 - d);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = roof;
    ctx.beginPath();
    ctx.moveTo(x - mw/2 - 10, y - mh + 2);
    ctx.lineTo(x - mw/2 - 20, y - mh - 8);
    ctx.lineTo(x - mw/2 - 4, y - mh - 3);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + mw/2 + 10, y - mh + 2);
    ctx.lineTo(x + mw/2 + 20, y - mh - 8);
    ctx.lineTo(x + mw/2 + 4, y - mh - 3);
    ctx.closePath(); ctx.fill();
    /* 瓦楞 */
    ctx.strokeStyle = 'rgba(0,0,0,0.16)'; ctx.lineWidth = 1;
    for(let i = 1; i <= 3; i++){
      const ry2 = y - mh + 2 + (ridge2 - (y - mh + 2)) * (i / 4);
      ctx.beginPath(); ctx.moveTo(x - mw/2 - 6 + i*3, ry2); ctx.lineTo(x + mw/2 + 6 - i*3, ry2); ctx.stroke();
    }
    /* 朱漆大门（双扇 + 门钉 + 兽环） */
    const dw2 = mw * 0.42, dh2 = Math.min(wallH * 0.92, mh * 0.4);
    ctx.fillStyle = '#2a1c14';
    ctx.fillRect(x - dw2/2, y - dh2, dw2, dh2);
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1.5;
    ctx.strokeRect(x - dw2/2, y - dh2, dw2, dh2);
    ctx.beginPath(); ctx.moveTo(x, y - dh2); ctx.lineTo(x, y); ctx.stroke();
    ctx.fillStyle = 'rgba(255,214,120,0.6)';
    for(let r3 = 0; r3 < 3; r3++) for(let c3 = 0; c3 < 3; c3++){
      ctx.beginPath();
      ctx.arc(x - dw2*0.28 + c3 * dw2 * 0.28, y - dh2*0.82 + r3 * dh2 * 0.28, 1.8, 0, TAU);
      ctx.fill();
    }
    ctx.strokeStyle = b.accent || '#ffd166'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x - dw2*0.16, y - dh2*0.45, 5, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.arc(x + dw2*0.16, y - dh2*0.45, 5, 0, TAU); ctx.stroke();
    /* 匾额 */
    if(b.name) drawSign(x, y - mh + mh*0.44, b.name, b.accent || '#ffd166');
    /* 墙头角灯笼 */
    for(const sx of [x - w/2 + 18, x + w/2 - 18]){
      const glow2 = 0.5 + 0.4 * Math.sin(t * 2 + sx);
      const rg3 = ctx.createRadialGradient(sx, y - wallH, 1, sx, y - wallH, 20);
      rg3.addColorStop(0, 'rgba(255,190,110,' + (0.55 * glow2) + ')');
      rg3.addColorStop(1, 'rgba(255,150,60,0)');
      ctx.fillStyle = rg3;
      ctx.beginPath(); ctx.arc(sx, y - wallH, 20, 0, TAU); ctx.fill();
      ctx.fillStyle = '#d8552e';
      ctx.beginPath(); ctx.ellipse(sx, y - wallH - 6, 5, 7, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,224,160,0.9)';
      ctx.beginPath(); ctx.ellipse(sx, y - wallH - 7, 2.5, 4, 0, 0, TAU); ctx.fill();
    }
    /* 门口石阶 */
    ctx.fillStyle = 'rgba(60,56,50,0.95)';
    ctx.fillRect(x - dw2/2 - 12, y - 3, dw2 + 24, 6);
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(x - dw2/2 - 12, y + 3, dw2 + 24, 3);
    return;
  }

  if(b.kind === 'tree' || b.kind === 'peach'){
    /* 树木 / 桃树：随风摆动的树干 + 三团圆冠（桃树粉冠 + 落瓣） */
    const t = G ? G.t : 0;
    const th = h, cw = w;
    const sway = Math.sin(t * 1.1 + x * 0.021) * 3;
    /* 落影 */
    ctx.fillStyle = 'rgba(0,0,0,0.20)';
    ctx.beginPath(); ctx.ellipse(x, y + 3, cw * 0.42, 7, 0, 0, TAU); ctx.fill();
    /* 树干（微弯 + 摆动） */
    ctx.strokeStyle = '#4a3826';
    ctx.lineWidth = Math.max(5, cw * 0.10);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + sway * 0.5, y - th * 0.5, x + sway, y - th * 0.72);
    ctx.stroke();
    /* 树枝 */
    ctx.lineWidth = Math.max(2.5, cw * 0.05);
    ctx.beginPath();
    ctx.moveTo(x + sway * 0.5, y - th * 0.5);
    ctx.lineTo(x - cw * 0.22 + sway * 0.8, y - th * 0.74);
    ctx.moveTo(x + sway * 0.5, y - th * 0.55);
    ctx.lineTo(x + cw * 0.24 + sway * 0.9, y - th * 0.76);
    ctx.stroke();
    const isPeach = b.kind === 'peach';
    const c1 = isPeach ? '#d87ba0' : '#3a5540';
    const c2 = isPeach ? '#efa8c0' : '#4c6e4a';
    const c3 = isPeach ? '#f9cddc' : '#5c8156';
    ctx.fillStyle = c1;
    ctx.beginPath(); ctx.ellipse(x - cw*0.24 + sway*0.5, y - th*0.70, cw*0.32, th*0.17, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x + cw*0.26 + sway*0.7, y - th*0.68, cw*0.30, th*0.16, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = c2;
    ctx.beginPath(); ctx.ellipse(x + sway*0.7, y - th*0.90, cw*0.38, th*0.22, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = c3;
    ctx.beginPath(); ctx.ellipse(x - cw*0.10 + sway*0.9, y - th*1.00, cw*0.20, th*0.12, 0, 0, TAU); ctx.fill();
    if(isPeach){
      /* 飘落的花瓣 */
      for(let i = 0; i < 3; i++){
        const pt = (t * 0.3 + i * 0.37 + (x % 7) * 0.1) % 1;
        const ppx = x + Math.sin(pt * 6 + i * 2) * cw * 0.42;
        const ppy = y - th * 0.9 + pt * th * 0.88;
        ctx.fillStyle = 'rgba(246,186,206,' + (0.75 - pt * 0.4) + ')';
        ctx.beginPath(); ctx.ellipse(ppx, ppy, 2.6, 1.6, pt * 5, 0, TAU); ctx.fill();
      }
    }
    return;
  }

  /* ── 通用店铺 / 民居：2.5D 古风盒子（木墙 + 双坡青瓦顶 + 飞檐） ── */
  /* 侧面墙（右斜面，山墙） */
  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.moveTo(x + w/2, y - h);
  ctx.lineTo(x + w/2 + d, y - h - d);
  ctx.lineTo(x + w/2 + d, y - d);
  ctx.lineTo(x + w/2, y);
  ctx.closePath(); ctx.fill();
  /* 正面墙（木色渐变） */
  const wg = ctx.createLinearGradient(x, y - h, x, y);
  wg.addColorStop(0, wall);
  wg.addColorStop(1, shadeColor(wall, -10));
  ctx.fillStyle = wg;
  ctx.fillRect(x - w/2, y - h, w, h);
  /* 木柱分隔（古风店铺的立柱） */
  ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 3;
  for(const px of [x - w/2 + w*0.22, x + w/2 - w*0.22]){
    ctx.beginPath(); ctx.moveTo(px, y - h); ctx.lineTo(px, y); ctx.stroke();
  }
  /* 双坡青瓦顶：正脊 + 两侧下坡 + 飞檐翘角 */
  const ridgeY = y - h - d * 0.7;   /* 正脊高度 */
  ctx.fillStyle = roof;
  ctx.beginPath();
  ctx.moveTo(x - w/2 - 6, y - h + 2);          /* 左檐脚 */
  ctx.lineTo(x, ridgeY);                        /* 左坡到正脊 */
  ctx.lineTo(x + w/2 + 6, y - h + 2);           /* 右檐脚 */
  ctx.lineTo(x + w/2 + 6 + d, y - h + 2 - d);   /* 右侧后延（山墙顶） */
  ctx.lineTo(x + d, ridgeY - d);                /* 正脊后端 */
  ctx.lineTo(x - w/2 - 6 + d, y - h + 2 - d);   /* 左檐后延 */
  ctx.closePath(); ctx.fill();
  /* 正脊线（亮色压脊） */
  ctx.strokeStyle = shadeColor(roof, 16); ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(x - w/2 - 4, y - h); ctx.lineTo(x, ridgeY - 4); ctx.stroke();
  /* 飞檐翘角（左右两端上挑） */
  ctx.fillStyle = roof;
  ctx.beginPath();
  ctx.moveTo(x - w/2 - 6, y - h + 2);
  ctx.lineTo(x - w/2 - 14, y - h - 6);
  ctx.lineTo(x - w/2 - 2, y - h - 2);
  ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x + w/2 + 6, y - h + 2);
  ctx.lineTo(x + w/2 + 14, y - h - 6);
  ctx.lineTo(x + w/2 + 2, y - h - 2);
  ctx.closePath(); ctx.fill();
  /* 瓦楞（坡面横纹） */
  ctx.strokeStyle = 'rgba(0,0,0,0.16)'; ctx.lineWidth = 1;
  for(let i = 1; i <= 3; i++){
    const ry = y - h + 2 + (ridgeY - (y - h + 2)) * (i / 4);
    ctx.beginPath(); ctx.moveTo(x - w/2 - 4 + i*3, ry); ctx.lineTo(x + w/2 + 4 - i*3, ry); ctx.stroke();
  }

  /* 门（正面墙中央下方） */
  const dw = Math.min(46, w * 0.3), dh = Math.min(72, h * 0.5);
  ctx.fillStyle = '#1a1620';
  ctx.beginPath();
  ctx.roundRect(x - dw/2, y - dh, dw, dh, 4);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 1.5; ctx.stroke();
  /* 门环 */
  ctx.strokeStyle = b.accent; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(x + dw/2 - 8, y - dh/2, 4, 0, TAU); ctx.stroke();

  /* 两侧窗（暖光，贴木格窗棂） */
  for(const sx of [x - w*0.3, x + w*0.3]){
    ctx.fillStyle = '#1a1a28';
    ctx.fillRect(sx - 14, y - h*0.72, 28, 24);
    const warm = 0.5 + 0.15 * Math.sin((G ? G.t : 0) * 1.4 + sx);
    ctx.fillStyle = 'rgba(255,196,96,' + warm + ')';
    ctx.fillRect(sx - 11, y - h*0.72 + 3, 22, 18);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1;
    ctx.strokeRect(sx - 14, y - h*0.72, 28, 24);
    ctx.beginPath(); ctx.moveTo(sx, y - h*0.72); ctx.lineTo(sx, y - h*0.72 + 24); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(sx - 14, y - h*0.72 + 12); ctx.lineTo(sx + 14, y - h*0.72 + 12); ctx.stroke();
  }

  /* 质感细节（石基 / 檐影 / 灯火 / 灯笼 / 布幡） */
  drawBuildingDetails(b, wall, roof, dark);

  /* 店铺招牌 */
  if(b.kind === 'shop' && b.name) drawSign(x, y - h + 10, b.name, b.accent);
}

/* ★ 建筑质感细节：石基 / 檐下阴影 / 左缘暖光 / 门内灯火 / 门口灯笼 / 布幡 */
function drawBuildingDetails(b, wall, roof, dark){
  const x = b.x, y = b.y, w = b.w, h = b.h;
  const t = (G ? G.t : 0);
  /* 墙板木纹（竖向细线） */
  ctx.save();
  ctx.strokeStyle = 'rgba(0,0,0,0.055)'; ctx.lineWidth = 1;
  for(let i = 1; i < Math.floor(w / 26); i++){
    const lx = x - w/2 + i * 26;
    ctx.beginPath(); ctx.moveTo(lx, y - h + 4); ctx.lineTo(lx, y - 10); ctx.stroke();
  }
  ctx.restore();
  /* 石砌墙基 */
  const bg = ctx.createLinearGradient(0, y - 14, 0, y);
  bg.addColorStop(0, '#413c36'); bg.addColorStop(1, '#2a2724');
  ctx.fillStyle = bg;
  ctx.fillRect(x - w/2, y - 14, w, 14);
  ctx.strokeStyle = 'rgba(0,0,0,0.28)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x - w/2, y - 14); ctx.lineTo(x + w/2, y - 14); ctx.stroke();
  for(let i = 1; i < Math.floor(w / 34); i++){
    const lx = x - w/2 + i * 34;
    ctx.beginPath(); ctx.moveTo(lx, y - 14); ctx.lineTo(lx, y); ctx.stroke();
  }
  /* 檐下阴影（屋檐投影，让屋顶与墙分离出层次） */
  const eg = ctx.createLinearGradient(0, y - h, 0, y - h + 30);
  eg.addColorStop(0, 'rgba(0,0,0,0.42)');
  eg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = eg;
  ctx.fillRect(x - w/2, y - h, w, 30);
  /* 左缘暖光边（黄昏侧光） */
  const lg2 = ctx.createLinearGradient(x - w/2, 0, x - w/2 + 16, 0);
  lg2.addColorStop(0, 'rgba(255,214,150,0.22)');
  lg2.addColorStop(1, 'rgba(255,214,150,0)');
  ctx.fillStyle = lg2;
  ctx.fillRect(x - w/2, y - h, 16, h);
  /* 门内灯火 + 光溢出到地面 */
  const dw = Math.min(46, w * 0.3), dh = Math.min(72, h * 0.5);
  const dg = ctx.createLinearGradient(0, y - dh, 0, y);
  dg.addColorStop(0, 'rgba(255,196,110,0.30)');
  dg.addColorStop(1, 'rgba(255,170,80,0.10)');
  ctx.fillStyle = dg;
  ctx.fillRect(x - dw/2, y - dh, dw, dh);
  /* 门口两级石阶 */
  ctx.fillStyle = 'rgba(60,56,50,0.95)';
  ctx.fillRect(x - dw/2 - 8, y - 3, dw + 16, 6);
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.fillRect(x - dw/2 - 8, y + 3, dw + 16, 3);
  /* 灯笼（门口两侧，呼吸光） */
  const glow = 0.55 + 0.45 * Math.sin(t * 2.2 + b.x * 0.01);
  for(const sx of [x - dw/2 - 20, x + dw/2 + 20]){
    const ly = y - dh + 6;
    ctx.strokeStyle = 'rgba(20,16,12,0.8)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(sx, ly - 12); ctx.lineTo(sx, ly); ctx.stroke();
    const rg = ctx.createRadialGradient(sx, ly + 6, 1, sx, ly + 6, 26);
    rg.addColorStop(0, 'rgba(255,190,110,' + (0.55 * glow) + ')');
    rg.addColorStop(1, 'rgba(255,150,60,0)');
    ctx.fillStyle = rg;
    ctx.beginPath(); ctx.arc(sx, ly + 6, 26, 0, TAU); ctx.fill();
    ctx.fillStyle = '#d8552e';
    ctx.beginPath(); ctx.ellipse(sx, ly + 6, 6, 8, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,224,160,0.9)';
    ctx.beginPath(); ctx.ellipse(sx, ly + 5, 3, 4.5, 0, 0, TAU); ctx.fill();
  }
  /* 店铺布幡（挂在檐下，随风轻摆） */
  if(b.kind === 'shop'){
    const bx = x + w/2 - 26;
    const sway = Math.sin(t * 1.6 + b.x * 0.02) * 2.2;
    ctx.save();
    ctx.translate(bx, y - h + 14);
    ctx.fillStyle = hexA(b.accent || '#c9a84c', 0.85);
    ctx.beginPath();
    ctx.moveTo(-7, 0);
    ctx.lineTo(7, 0);
    ctx.lineTo(7 + sway, 52);
    ctx.lineTo(0 + sway, 44);
    ctx.lineTo(-7 + sway, 52);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = 'rgba(24,18,12,0.85)'; ctx.font = 'bold 11px "Microsoft YaHei"';
    ctx.textAlign = 'center';
    ctx.fillText((b.name || '店').slice(0, 1), 0 + sway * 0.6, 20);
    ctx.restore();
  }
}

/* 招牌：挂在门楣上方的横牌 */
function drawSign(x, y, text, accent){
  ctx.font = 'bold 15px "Microsoft YaHei"';
  const tw = ctx.measureText(text).width;
  const sw = tw + 30, sh = 26;
  ctx.fillStyle = 'rgba(16,12,8,0.92)';
  ctx.beginPath(); ctx.roundRect(x - sw/2, y - sh/2, sw, sh, 5); ctx.fill();
  ctx.strokeStyle = accent; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.roundRect(x - sw/2, y - sh/2, sw, sh, 5); ctx.stroke();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffe9b0';
  ctx.fillText(text, x, y + 5);
}

/* 颜色变暗/变亮辅助（十六进制 #rrggbb） */
function shadeColor(hex, amt){
  const c = hex.replace('#','');
  const n = parseInt(c.length === 3 ? c.split('').map(ch=>ch+ch).join('') : c, 16);
  const r = clamp((n >> 16) + amt, 0, 255);
  const g = clamp(((n >> 8) & 255) + amt, 0, 255);
  const b = clamp((n & 255) + amt, 0, 255);
  return 'rgb(' + r + ',' + g + ',' + b + ')';
}

/* ★ 城镇地面：分坊区铺装（草地/泥地/石板广场），带斑驳与碎石细节 */
function drawTownGround(t){
  const HORIZON = GY_BOTTOM - 100;
  /* 1. 草地基底：全图铺一层草色，向上渐亮 */
  const baseGrad = ctx.createLinearGradient(0, HORIZON, 0, TOWN_H);
  baseGrad.addColorStop(0, '#4e5a48');
  baseGrad.addColorStop(0.5, '#3e4a3a');
  baseGrad.addColorStop(1, '#2e382c');
  ctx.fillStyle = baseGrad;
  ctx.fillRect(0, HORIZON, TOWN_W, TOWN_H - HORIZON);

  /* 2. 坊区地块：每个坊区一片「青石地砖」色块（无边框，自然过渡） */
  for(const r of TOWN_REGIONS){
    const rg = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
    rg.addColorStop(0, r.ground || '#565a54');
    rg.addColorStop(1, shadeColor(r.ground || '#565a54', -12));
    ctx.fillStyle = rg;
    ctx.fillRect(r.x, r.y, r.w, r.h);
    /* ★ 青石地砖：错缝铺装（横缝 + 交错竖缝），跨帧稳定 */
    ctx.strokeStyle = 'rgba(20,26,24,0.32)'; ctx.lineWidth = 1;
    const tile = 74;
    for(let ry = r.y + tile; ry < r.y + r.h; ry += tile){
      ctx.beginPath(); ctx.moveTo(r.x, ry); ctx.lineTo(r.x + r.w, ry); ctx.stroke();
    }
    let row2 = 0;
    for(let ry = r.y; ry < r.y + r.h; ry += tile, row2++){
      const off = (row2 % 2) ? tile * 0.5 : 0;
      const ty0 = Math.max(r.y, ry), ty1 = Math.min(r.y + r.h, ry + tile);
      for(let rx = r.x + off; rx < r.x + r.w; rx += tile){
        ctx.beginPath(); ctx.moveTo(rx, ty0); ctx.lineTo(rx, ty1); ctx.stroke();
      }
    }
    /* 亮砖点缀（磨损发亮的走道感） */
    ctx.fillStyle = 'rgba(195,205,200,0.06)';
    for(let i = 0; i < 30; i++){
      const hx = r.x + hash01(r.x * 0.017 + i * 7.7) * r.w;
      const hy = r.y + hash01(r.y * 0.013 + i * 13.1) * r.h;
      ctx.fillRect(hx, hy, 62, 30);
    }
  }

  /* 3. 荒野草斑：只铺在五镇之外（镇内是青石地砖，不长草） */
  const inZone = (x, y) => {
    for(const def of TOWN_DEFS){
      if(x >= def.ox && x < def.ox + TOWN_ZONE_W && y >= def.oy && y < def.oy + TOWN_ZONE_H) return true;
    }
    return false;
  };
  ctx.fillStyle = 'rgba(122,150,96,0.35)';
  for(let i = 0; i < 220; i++){
    const hx = hash01(i * 13.7) * TOWN_W;
    const hy = HORIZON + hash01(i * 31.3 + 7) * (TOWN_H - HORIZON);
    if(inZone(hx, hy)) continue;
    /* 避开街道中心（留给石板） */
    let onStreet = false;
    for(const st of TOWN_STREETS){
      if(st.axis === 'h'){ if(Math.abs(hy - st.c) < st.w/2 - 4){ onStreet = true; break; } }
      else { if(Math.abs(hx - st.c) < st.w/2 - 4){ onStreet = true; break; } }
    }
    if(onStreet) continue;
    const s = 1 + hash01(i * 7.1) * 3;
    ctx.beginPath(); ctx.arc(hx, hy, s, 0, TAU); ctx.fill();
  }
  /* 碎石点（同样只落在荒野） */
  ctx.fillStyle = 'rgba(170,170,185,0.28)';
  for(let i = 0; i < 120; i++){
    const hx = hash01(i * 17.3 + 3) * TOWN_W;
    const hy = HORIZON + hash01(i * 41.7 + 11) * (TOWN_H - HORIZON);
    if(inZone(hx, hy)) continue;
    let onStreet = false;
    for(const st of TOWN_STREETS){
      if(st.axis === 'h'){ if(Math.abs(hy - st.c) < st.w/2){ onStreet = true; break; } }
      else { if(Math.abs(hx - st.c) < st.w/2){ onStreet = true; break; } }
    }
    if(onStreet) continue;
    ctx.fillRect(hx, hy, 2, 2);
  }

  /* 4. 中央广场：中央大道 × 前街 交汇处铺一块开阔地砖广场
        （由 drawTownPlaza 在街道之后调用，避免被路面盖住） */
}
function drawTownPlaza(){
  /* 每镇一座中央广场：主竖街 × 主横街 交叉口（镇内相对 1500,840） */
  for(const def of TOWN_DEFS){
    const px = def.ox + 1500, py = def.oy + 840;
    const sqX = px - 115, sqY = py - 115, sqW = 230, sqH = 230;
    const pg = ctx.createRadialGradient(px, py, 20, px, py, 170);
    pg.addColorStop(0, '#85877c'); pg.addColorStop(0.6, '#767970'); pg.addColorStop(1, '#656860');
    ctx.fillStyle = pg;
    ctx.fillRect(sqX, sqY, sqW, sqH);
    ctx.strokeStyle = 'rgba(255,214,120,0.35)'; ctx.lineWidth = 2;
    ctx.strokeRect(sqX, sqY, sqW, sqH);
    /* 广场地砖格 */
    ctx.strokeStyle = 'rgba(24,24,40,0.30)'; ctx.lineWidth = 1;
    for(let x = sqX; x <= sqX + sqW; x += 38){
      ctx.beginPath(); ctx.moveTo(x, sqY); ctx.lineTo(x, sqY + sqH); ctx.stroke();
    }
    for(let y = sqY; y <= sqY + sqH; y += 38){
      ctx.beginPath(); ctx.moveTo(sqX, y); ctx.lineTo(sqX + sqW, y); ctx.stroke();
    }
    /* 广场中心圆形地标纹 */
    ctx.strokeStyle = 'rgba(255,214,120,0.4)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(px, py, 54, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.arc(px, py, 36, 0, TAU); ctx.stroke();
  }
}

/* 确定性伪随机：返回 [0,1)，跨帧稳定 */
function hash01(n){
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/* NPC 交互动词：靠近时键位胶囊里显示的字，必须短 */
const NPC_VERB = {
  enhance: '强化', shop: '商店', quest: '任务', dungeon: '进本',
  heal: '疗伤', stash: '行囊', reforge: '洗练', decompose: '分解', lore: '听书',
  portal: '传送'
};

/* 统一的 NPC 交互入口：点击与 J 键都走这里，新增 NPC 只需加数据 */
function triggerNpc(npc){
  if(!npc) return;
  switch(npc.type){
    case 'enhance':
      autoSelectEquipSlots(); blacksmithTab = 'enhance'; gameState = 'enhanceMenu'; break;
    case 'shop':
      shopListScroll = 0; gameState = 'shopMenu'; break;
    case 'dungeon':
      gameState = 'dungeonSelect'; break;
    case 'gate':
      /* ★ 四方传送使：各自只传送自己管辖的等级段（或深渊） */
      levelSelectFilter = npc.gate;
      gameState = 'levelSelect'; break;
    case 'portal': {
      /* ★ 镇间传送门：传送到目标城镇的到达点 */
      const tdef = TOWN_DEFS_BY_KEY[npc.target];
      if(tdef && townPlayer){
        townPlayer.x = tdef.spawn.x; townPlayer.y = tdef.spawn.y;
        townCam.x = clamp(townPlayer.x - VW/2, 0, Math.max(0, TOWN_W - VW));
        townCam.y = clamp(townPlayer.y - VH/2, 0, Math.max(0, TOWN_H - VH));
        questToastMsg('传送门', '穿过传送门，抵达「' + tdef.name + '」', '#7fd0ff');
      }
      break;
    }
    case 'quest': {
      /* ★ 直接打开任务面板，可在面板中交付任务 */
      questReturnState = 'town'; gameState = 'questMenu';
      break;
    }
    case 'heal':
      if(G && G.player){
        G.player.hp = G.player.maxHp;
        G.player.mp = G.player.maxMp;
        spawnText(G.player.x, G.player.y - 130, 80, '气血内力已复原', '#5ee08a', 20);
      }
      break;
    case 'stash':
      G.inventoryReturnState = 'town';
      gameState = 'inventory'; break;
    case 'reforge':
      autoSelectEquipSlots(); blacksmithTab = 'reforge'; gameState = 'enhanceMenu'; break;
    case 'decompose':
      autoSelectEquipSlots(); blacksmithTab = 'decompose'; gameState = 'enhanceMenu'; break;
    case 'lore': {
      const p = G && G.player;
      const lit = p && p.quest ? Math.min(9, p.quest.idx) : 0;
      const LORE_LINES = {
        watchman: [
          '（更夫敲了三下梆子。）',
          '「天干物燥——灯柱小心。这词我喊了三十年。」',
          '「你问为什么夜里还要巡？灯灭过的街，走夜路的人就回不来咯。」'
        ],
        painter: [
          '（画师铺开一张空白的纸，迟迟没有落笔。）',
          '「我在画第九盏灯，可我没见过它亮。」',
          '「你替我去看一眼回来，我就有得画了。」'
        ],
        ferry: [
          '（船家用竹篙点了点水面。）',
          '「渡口的雾啊，是从裂隙里漏出来的。」',
          '「灯亮得多的年头，雾就薄。今年……你自己看。」'
        ],
        urchin: [
          '（乞儿蹲在墙角，手里攥着半块炊饼。）',
          '「大个子！守门人爷爷说，等灯全亮了，就不用再有人守夜了。」',
          '「是真的吗？骗人的话，我把饼分你一半也不信你。」'
        ]
      };
      const lines = LORE_LINES[npc.id];
      if(lines){ showDialogue(lines, null); break; }
      showDialogue([
        '（说书人敲了敲醒木，没抬头。）',
        '「客官要听哪段？九灯的故事，我讲了四十年。」',
        lit >= 5 ? '「你已经点亮 ' + lit + ' 盏了……比我讲的快。」' : '「灯亮一盏，人就少一个。这话你信不信？」',
        '「天穹碎的那年，第一代守灯人把自己的命点着了。」',
        '「后来每一代都这么干。他们说这叫传承。」',
        '（他抬起头，眼睛很亮。）「……客官，你手里那盏，冷么？」'
      ], null);
      break;
    }
    default: break;
  }
}


/* ============================================================
   ★ 悬浮岛改造（4.0）
   原「一整块大地图」拆成 5 座漂浮在云海上的岛：
     · 每座岛在所属区域内缩进 ISLAND_INSET，四角大圆角 + 边缘起伏
     · 岛外一律是云海（岛下方无尽的云与雾）
     · 岛与岛之间无法步行连通，只能走四缘的传送门
     · 出生点仍在中央主城（TOWN_DEFS.center.spawn）
   ============================================================ */
const ISLAND_INSET = 170;    /* 岛缘相对区域边界内缩（让相邻岛之间露出云海） */
const ISLAND_R     = 1600;   /* 圆角半径：大到接近椭圆，空隙呈弧形，像浮岛群 */

/* 岛形路径：圆角矩形 + 四边中点轻微外扩（避免看起来像方块） */
function addIslandPath(c, def, inset, r, keepPath){
  inset = inset === undefined ? ISLAND_INSET : inset;
  r = r || ISLAND_R;
  const x = def.ox + inset, y = def.oy + inset;
  const w = TOWN_ZONE_W - inset * 2, h = TOWN_ZONE_H - inset * 2;
  const rr = Math.min(r, w * 0.45, h * 0.45);
  const bump = Math.min(120, w * 0.035);    /* 边中点的外扩量：让轮廓不那么规整 */
  /* keepPath=true 时不重置路径 —— 多个岛要累积成一条路径再 clip()，
     否则 clip 只认最后一个岛（会裁成空区域，整个画面变黑） */
  if(!keepPath) c.beginPath();
  c.moveTo(x + rr, y);
  /* 上边：中点略微上凸 */
  c.quadraticCurveTo(x + w * 0.5, y - bump, x + w - rr, y);
  c.quadraticCurveTo(x + w, y, x + w, y + rr);
  /* 右边 */
  c.quadraticCurveTo(x + w + bump, y + h * 0.5, x + w, y + h - rr);
  c.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  /* 下边 */
  c.quadraticCurveTo(x + w * 0.5, y + h + bump, x + rr, y + h);
  c.quadraticCurveTo(x, y + h, x, y + h - rr);
  /* 左边 */
  c.quadraticCurveTo(x - bump, y + h * 0.5, x, y + rr);
  c.quadraticCurveTo(x, y, x + rr, y);
  c.closePath();
}

/* 云海：填满相机可见范围（地面高度以下），是所有岛之外的“底” */
function drawTownCloudSea(camX, camY){
  const t = (typeof G !== 'undefined' && G) ? G.t : performance.now() * 0.001;
  /* 铺满整个可见高度：岛与岛之间的空隙在屏幕上任何位置都要看到云，
     只铺地平线以下会在空隙上半部漏出天空底色 */
  const topY = camY - 140;
  const botY = camY + VH + 170;
  /* 1. 底色：由天际的暖紫过渡到深处的冷蓝，越往下越暗（无尽感） */
  const g = ctx.createLinearGradient(0, topY, 0, botY);
  g.addColorStop(0,    'rgba(96,84,150,1)');      /* 顶端：接近天空的紫，衔接自然 */
  g.addColorStop(0.30, 'rgba(124,116,176,1)');
  g.addColorStop(0.62, 'rgba(96,104,158,1)');
  g.addColorStop(1,    'rgba(58,64,112,1)');
  ctx.fillStyle = g;
  ctx.fillRect(camX - 40, topY, VW + 80, botY - topY);

  /* 2. 云团：多层错位椭圆，缓慢漂移，形成翻涌的云海 */
  const layer = [
    { n: 26, sp: 9,  ry: 0.30, col: 'rgba(232,236,255,0.30)', rw: 210, rh: 46 },
    { n: 18, sp: 16, ry: 0.55, col: 'rgba(210,220,250,0.24)', rw: 300, rh: 60 },
    { n: 12, sp: 26, ry: 0.80, col: 'rgba(180,196,236,0.18)', rw: 420, rh: 82 }
  ];
  for(let L = 0; L < layer.length; L++){
    const cf = layer[L];
    for(let i = 0; i < cf.n; i++){
      const seed = i * 7.31 + L * 41.7;
      const drift = (t * cf.sp + seed * 37) % (VW + 900);
      const cx = camX - 450 + drift;
      const cy = topY + (botY - topY) * cf.ry + Math.sin(t * 0.25 + seed) * 26 + hash01(seed) * 150;
      const rw = cf.rw * (0.7 + hash01(seed + 3) * 0.7);
      const rh = cf.rh * (0.7 + hash01(seed + 9) * 0.6);
      ctx.fillStyle = cf.col;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rw, rh, 0, 0, TAU);
      ctx.fill();
    }
  }

  /* 3. 深处迷雾：向下逐渐加浓，遮住“世界尽头”的硬边 */
  const mist = ctx.createLinearGradient(0, topY + (botY - topY) * 0.45, 0, botY);
  mist.addColorStop(0, 'rgba(130,132,180,0)');
  mist.addColorStop(1, 'rgba(104,110,160,0.45)');
  ctx.fillStyle = mist;
  ctx.fillRect(camX - 40, topY + (botY - topY) * 0.45, VW + 80, (botY - topY) * 0.55);
}

/* 岛缘：土层剖面（岛的“厚度”）+ 边缘云气，营造悬空感 */
function drawIslandEdges(t){
  t = t || 0;
  for(const def of TOWN_DEFS){
    /* 1. 厚度：同形状向下逐层偏移填充，越靠下越暗（模拟斜视角看到的岛壁） */
    for(let k = 5; k >= 1; k--){
      const depth = k * 9;
      ctx.save();
      ctx.translate(0, depth);
      addIslandPath(ctx, def, ISLAND_INSET, ISLAND_R);
      const a = 0.16 + 0.26 * (1 - k / 5);
      ctx.fillStyle = 'rgba(46,44,64,' + a.toFixed(3) + ')';
      ctx.fill();
      ctx.restore();
    }
    /* 2. 岛缘石线：一圈暗边，界定岛的轮廓 */
    addIslandPath(ctx, def, ISLAND_INSET, ISLAND_R);
    ctx.strokeStyle = 'rgba(44,40,62,0.92)';
    ctx.lineWidth = 12;
    ctx.stroke();
    /* 3. 岛缘云气：沿轮廓撒云絮，缓慢明灭 */
    const x0 = def.ox + ISLAND_INSET, y0 = def.oy + ISLAND_INSET;
    const w = TOWN_ZONE_W - ISLAND_INSET * 2, h = TOWN_ZONE_H - ISLAND_INSET * 2;
    for(let i = 0; i < 26; i++){
      const sd = i * 3.77 + def.ox * 0.013;
      const side = i % 4;
      let cx, cy;
      if(side === 0){ cx = x0 + hash01(sd) * w; cy = y0 - 6 + Math.sin(t * 0.6 + sd) * 8; }
      else if(side === 1){ cx = x0 + w + 6 + Math.sin(t * 0.5 + sd) * 8; cy = y0 + hash01(sd) * h; }
      else if(side === 2){ cx = x0 + hash01(sd) * w; cy = y0 + h + 6 + Math.sin(t * 0.6 + sd) * 8; }
      else { cx = x0 - 6 + Math.sin(t * 0.5 + sd) * 8; cy = y0 + hash01(sd) * h; }
      const pr = 0.55 + 0.45 * Math.sin(t * 1.2 + sd * 2);
      ctx.fillStyle = 'rgba(226,232,255,' + (0.10 + 0.10 * pr).toFixed(3) + ')';
      ctx.beginPath();
      ctx.ellipse(cx, cy, 44 + pr * 26, 16 + pr * 10, 0, 0, TAU);
      ctx.fill();
    }
  }
}

/* 玩家所在岛：返回椭圆参数 {cx,cy,rx,ry}
   岛是椭圆形的，所以边界也用椭圆判定 —— 否则玩家会走到四角被裁掉的“云”上，
   而且北/南传送门正好在椭圆边缘，矩形限制会让玩家够不到门。 */
function townIslandOf(x, y){
  for(const def of TOWN_DEFS){
    if(x >= def.ox - 300 && x < def.ox + TOWN_ZONE_W + 300 &&
       y >= def.oy - 300 && y < def.oy + TOWN_ZONE_H + 300){
      const rx = (TOWN_ZONE_W - ISLAND_INSET * 2) / 2 - 40;
      const ry = (TOWN_ZONE_H - ISLAND_INSET * 2) / 2 - 40;
      return { def: def, cx: def.ox + TOWN_ZONE_W / 2, cy: def.oy + TOWN_ZONE_H / 2, rx: rx, ry: ry };
    }
  }
  return null;
}

/* 把坐标夹进椭圆内（超出则沿半径方向缩回） */
function clampToIsland(isl, px, py){
  if(!isl) return { x: px, y: py };
  const ndx = (px - isl.cx) / isl.rx, ndy = (py - isl.cy) / isl.ry;
  const d = Math.sqrt(ndx * ndx + ndy * ndy);
  if(d <= 1) return { x: px, y: py };
  const k = 0.995 / d;
  return { x: isl.cx + ndx * k * isl.rx, y: isl.cy + ndy * k * isl.ry };
}

/* 前景云雾（屏幕层）：贴着屏幕下缘飘过，让整座城始终像浮在云上 */
function drawTownForeClouds(t){
  t = t || 0;
  const baseY = GY_BOTTOM + 52;         /* 屏幕最下缘 */
  for(let L = 0; L < 3; L++){
    const sp = 12 + L * 9;
    const alpha = 0.045 + L * 0.018;
    const rw = 190 + L * 70, rh = 22 + L * 8;
    const yOff = L * 18;
    for(let i = 0; i < 4; i++){
      const seed = i * 11.3 + L * 53.1;
      const drift = (t * sp + seed * 41) % (VW + 700);
      const cx = -350 + drift;
      const cy = baseY - yOff + Math.sin(t * 0.4 + seed) * 7;
      ctx.fillStyle = 'rgba(236,240,255,' + alpha.toFixed(3) + ')';
      ctx.beginPath();
      ctx.ellipse(cx, cy, rw, rh, 0, 0, TAU);
      ctx.fill();
    }
  }
}
