// ========== CDN 图片加速 + 安全工具 ==========
// ========== CDN 图片加速 ==========
// 阿里云 OSS 基础域名
const OSS_BASE = 'https://mhxdwwa.oss-cn-shenzhen.aliyuncs.com';
// 阿里云 CDN 域名（配好后填入，留空则使用本地 images/）
// 示例: 'https://cdn.yourdomain.com/images'
const IMG_CDN_BASE = OSS_BASE + '/images';
function _img(path) { return (IMG_CDN_BASE || 'images') + '/' + path; }
// 阿里云 OSS 资源路径辅助函数（战斗兽宠、战斗机器人等）
function _oss(path) { return OSS_BASE + '/' + path; }

// ========== 安全工具函数 ==========
function escapeHTML(str) {
  if (str == null) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
}
const esc = escapeHTML; // 快捷别名
// 转义 HTML 属性值（用于 onclick、value、src 等属性上下文）
function escapeAttr(str) {
  if (str == null) return '';
  return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
const escAttr = escapeAttr;
// 转义 JavaScript 字符串值（用于 onclick="func('${val}')" 等内联 JS 上下文）
function escapeJS(str) {
  if (str == null) return '';
  return String(str).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/</g, '\\x3c').replace(/>/g, '\\x3e');
}
const escJS = escapeJS;


// ========== 宠物配置 ==========
function generateStageCurve() { return [{stage:1,growthRequired:0,stageName:"神秘宠物蛋"},{stage:2,growthRequired:30,stageName:"可爱幼体"},{stage:3,growthRequired:90,stageName:"成长伙伴"},{stage:4,growthRequired:210,stageName:"成熟伙伴"},{stage:5,growthRequired:410,stageName:"完美精灵"},{stage:6,growthRequired:740,stageName:"传说神兽"},{stage:7,growthRequired:1200,stageName:"远古守护"},{stage:8,growthRequired:1800,stageName:"星辰之主"},{stage:9,growthRequired:2600,stageName:"万物之神"}]; }
// 动态宠物配置：支持 images 目录下任意数字文件夹作为宠物
// 基础配置保留原有55只作为默认/回退，但可通过动态加载扩展
const PET_CONFIG_BASE = { "雪貂":{id:1,emoji:"🐕"},"六角恐龙":{id:2,emoji:"🐺"},"吉祥神兽":{id:3,emoji:"🦮"},"海马":{id:4,emoji:"🐶"},"荷兰兔":{id:5,emoji:"🐩"},"胖仓鼠":{id:6,emoji:"🐕‍🦺"},"小老鼠":{id:7,emoji:"🐕"},"七彩貂":{id:8,emoji:"🦮"},"比尔鸭":{id:9,emoji:"🐶"},"大白兔":{id:10,emoji:"🐕"},"北美浣熊":{id:11,emoji:"🐱"},"萌萌羊":{id:12,emoji:"🐈"},"泰迪":{id:13,emoji:"🐈"},"花斑虎":{id:14,emoji:"🐱"},"送财龙":{id:15,emoji:"🐈"},"青云龙":{id:16,emoji:"🐠"},"苍狮":{id:17,emoji:"🐟"},"七彩鸟":{id:18,emoji:"🦜"},"考拉":{id:19,emoji:"🐹"},"萌蝙蝠":{id:20,emoji:"🐰"},"淡火狐":{id:21,emoji:"🐢"},"长毛汪":{id:22,emoji:"🦔"},"呆呆熊":{id:23,emoji:"🐭"},"熊猫大侠":{id:24,emoji:"🐿️"},"荷兰猪":{id:25,emoji:"🐹"},"白白东":{id:26,emoji:"🦄"},"大神龟":{id:27,emoji:"🔥"},"不萌鼠":{id:28,emoji:"🐲"},"柯基犬":{id:29,emoji:"🐧"},"咩咩咩":{id:30,emoji:"🦉"},"白眉汪":{id:31,emoji:"🦅"},"哮天犬":{id:32,emoji:"🦚"},"芦丁鸡":{id:33,emoji:"🕊️"},"大萌星":{id:34,emoji:"🐤"},"小白":{id:35,emoji:"🐬"},"多萌肉":{id:36,emoji:"🐙"},"踏天马":{id:37,emoji:"🦈"},"刺猬":{id:38,emoji:"🐋"},"黑白犬":{id:39,emoji:"🦑"},"羊驼":{id:40,emoji:"🪼"},"黄牛":{id:41,emoji:"🦋"},"美杜莎":{id:42,emoji:"🐞"},"六耳猕狗":{id:43,emoji:"🐝"},"猫猫虎":{id:44,emoji:"🐌"},"黑白猪":{id:45,emoji:"🕷️"},"非洲象":{id:46,emoji:"🐜"},"幸运猫":{id:47,emoji:"🐻"},"孔雀":{id:48,emoji:"🐼"},"蜥蜴":{id:49,emoji:"🐨"},"恐龙":{id:50,emoji:"🦁"},"梅花鹿":{id:51,emoji:"🐯"},"火凤凰":{id:52,emoji:"🐘"},"寄居蟹":{id:53,emoji:"🦒"},"九尾天狐":{id:54,emoji:"🦓"},"果冻蝾螈":{id:55,emoji:"🦛"} };
const PET_CONFIG = {};
Object.keys(PET_CONFIG_BASE).forEach(name=>{ PET_CONFIG[name] = {...PET_CONFIG_BASE[name], stages: generateStageCurve(), adoptCoins:0}; });

// ========== 全自动新宠物发现机制 ==========
// 无需手动配置！系统会自动尝试加载 images/数字/1.webp
// 只要文件夹存在，就会自动以 "宠物+数字" 命名并注册，数量不限！
function autoDiscoverPets() {
  let startId = 56; // 从 56 开始探测（1-55 已内置）
  let consecutiveFailures = 0;
  const maxFailures = 3; // 连续 3 个找不到图片就停止探测
  const maxCheck = 100; // 绝对上限（实际只需到 58 左右）

  function checkNext(id) {
    if (id > maxCheck || consecutiveFailures >= maxFailures) {
      const newCount = Object.keys(PET_CONFIG).length - 55;
      if (newCount > 0) console.log(`[宠物系统] 自动探测完成，成功发现并注册了 ${newCount} 只新宠物！`);
      return;
    }

    const img = new Image();
    img.onload = function() {
      // 成功加载！自动注册该数字宠物
      const petName = `宠物${id}`;
      PET_CONFIG[petName] = {
        id: id,
        emoji: '🐾',
        stages: generateStageCurve(),
        adoptCoins: 0
      };
      console.log(`[宠物系统] 自动发现新宠物: ${petName} (ID: ${id})`);
      consecutiveFailures = 0; // 找到后重置失败计数
      checkNext(id + 1); // 继续探测下一个
    };
    img.onerror = function() {
      // 找不到图片，失败计数+1，继续探测下一个
      consecutiveFailures++;
      checkNext(id + 1);
    };
    // 尝试加载该宠物的 1 级图片
    img.src = _img(`${id}/1.webp`);
  }

  // 启动自动探测
  checkNext(startId);
}

// 页面加载时立即开始自动探测
autoDiscoverPets();

// ========== 商店物品配置 ==========
const PET_SHOP_ITEMS = {
  borders: {
    name:'边框特效', icon:'🖼️', items:[
      {id:'border_rainbow',name:'彩虹流光',desc:'卡片边缘流动彩虹光效',price:80,growthBonus:1,css:'pet-border-rainbow'},
      {id:'border_flame',name:'烈焰之框',desc:'燃烧的火焰边框',price:120,growthBonus:2,css:'pet-border-flame'},
      {id:'border_ice',name:'冰晶之框',desc:'闪烁的冰蓝水晶边框',price:120,growthBonus:2,css:'pet-border-ice'},
      {id:'border_starry',name:'星空幻境',desc:'银河星辰环绕边框',price:200,growthBonus:3,css:'pet-border-starry'},
      {id:'border_gold',name:'皇家金框',desc:'尊贵的金色浮雕边框',price:300,growthBonus:4,css:'pet-border-gold'},
    ]
  },
  topAccessory: {
    name:'头顶挂件', icon:'👑', items:[
      {id:'top_halo',name:'天使光环',desc:'头顶金色神圣光环',price:60,growthBonus:1,css:'pet-top-halo'},
      {id:'top_crown',name:'小皇冠',desc:'可爱的迷你皇冠',price:100,growthBonus:2,css:'pet-top-crown'},
      {id:'top_bow',name:'蝴蝶结',desc:'粉色蝴蝶结发饰',price:60,growthBonus:1,css:'pet-top-bow'},
      {id:'top_horns',name:'恶魔角',desc:'酷炫的小恶魔角',price:100,growthBonus:2,css:'pet-top-horns'},
      {id:'top_flower',name:'花之冠',desc:'鲜花编织的花冠',price:150,growthBonus:3,css:'pet-top-flower'},
    ]
  },
  baseEffect: {
    name:'底部光圈', icon:'💫', items:[
      {id:'base_cloud',name:'祥云缭绕',desc:'脚踏七彩祥云',price:80,growthBonus:1,css:'pet-base-cloud'},
      {id:'base_rainbow',name:'彩虹台座',desc:'绚丽彩虹圆形台座',price:100,growthBonus:2,css:'pet-base-rainbow'},
      {id:'base_magic',name:'魔法阵',desc:'神秘旋转魔法阵',price:150,growthBonus:2,css:'pet-base-magic'},
      {id:'base_lava',name:'熔岩地面',desc:'脚下涌动炽热岩浆',price:200,growthBonus:3,css:'pet-base-lava'},
      {id:'base_galaxy',name:'星河足迹',desc:'踩在缩微银河之上',price:300,growthBonus:4,css:'pet-base-galaxy'},
    ]
  },
  particles: {
    name:'粒子特效', icon:'✨', items:[
      {id:'ptcl_hearts',name:'爱心飘飘',desc:'粉色爱心缓缓漂浮',price:60,growthBonus:1,css:'pet-ptcl-hearts'},
      {id:'ptcl_stars',name:'星光闪烁',desc:'金色小星星环绕闪烁',price:80,growthBonus:1,css:'pet-ptcl-stars'},
      {id:'ptcl_snow',name:'雪花纷飞',desc:'晶莹雪花飘落',price:80,growthBonus:1,css:'pet-ptcl-snow'},
      {id:'ptcl_firefly',name:'萤火虫',desc:'温暖的黄绿萤光飞舞',price:120,growthBonus:2,css:'pet-ptcl-firefly'},
      {id:'ptcl_sakura',name:'樱花雨',desc:'粉白花瓣纷纷飘落',price:150,growthBonus:2,css:'pet-ptcl-sakura'},
      {id:'ptcl_thunder',name:'雷电缠身',desc:'电弧在周身噼啪作响',price:250,growthBonus:3,css:'pet-ptcl-thunder'},
    ]
  },
  titles: {
    name:'称号铭牌', icon:'🏷️', items:[
      {id:'title_xueba',name:'学霸',desc:'学识渊博的象征',price:50,growthBonus:1,css:'pet-title-xueba'},
      {id:'title_juanwang',name:'卷王',desc:'卷到极致就是艺术',price:50,growthBonus:1,css:'pet-title-juanwang'},
      {id:'title_wulin',name:'武林盟主',desc:'号令天下莫敢不从',price:150,growthBonus:2,css:'pet-title-wulin'},
      {id:'title_dragon',name:'真龙天子',desc:'金鳞岂非池中物',price:200,growthBonus:3,css:'pet-title-dragon'},
      {id:'title_legend',name:'不朽传说',desc:'名留青史的传奇称号',price:350,growthBonus:4,css:'pet-title-legend'},
    ]
  },
  scenes: {
    name:'场景背景', icon:'🎨', items:[
      {id:'scene_meadow',name:'青青草地',desc:'绿草如茵鲜花点缀',price:80,growthBonus:1,css:'pet-scene-meadow'},
      {id:'scene_beach',name:'阳光沙滩',desc:'碧海蓝天金色沙滩',price:100,growthBonus:2,css:'pet-scene-beach'},
      {id:'scene_space',name:'浩瀚星空',desc:'深邃星空银河环绕',price:150,growthBonus:2,css:'pet-scene-space'},
      {id:'scene_sakura',name:'樱花小径',desc:'落英缤纷的浪漫樱道',price:150,growthBonus:2,css:'pet-scene-sakura'},
      {id:'scene_volcano',name:'火山熔岩',desc:'炽热岩浆火光冲天',price:200,growthBonus:3,css:'pet-scene-volcano'},
      {id:'scene_aurora',name:'极光幻境',desc:'绚丽极光照耀冰原',price:300,growthBonus:4,css:'pet-scene-aurora'},
    ]
  }
};
let _shopActiveCategory = 'borders';

function getAllShopItems(){
  const items=[];
  Object.values(PET_SHOP_ITEMS).forEach(cat=>cat.items.forEach(it=>items.push(it)));
  return items;
}
function getShopItemById(id){
  for(const cat of Object.values(PET_SHOP_ITEMS)){
    const found=cat.items.find(it=>it.id===id);
    if(found) return found;
  }
  return null;
}
function getStudentOwnedItems(student){
  return student.shopItems||[];
}
function studentOwnsItem(student,itemId){
  return (student.shopItems||[]).includes(itemId);
}
function getStudentGrowthBonus(student){
  // Only count bonuses from EQUIPPED items, not all purchased items
  const eq=getEquippedItems(student);
  const owned=student.shopItems||[];
  const equippedIds=Object.values(eq).filter(id=>owned.includes(id));
  if(equippedIds.length===0) return 0;
  let bonus=0;
  equippedIds.forEach(id=>{
    const item=getShopItemById(id);
    if(item) bonus+=item.growthBonus;
  });
  return bonus;
}
/* ===== 道具佩戴系统 ===== */
function getItemCategory(itemId){
  for(const[catKey,cat] of Object.entries(PET_SHOP_ITEMS)){
    if(cat.items.some(it=>it.id===itemId)) return catKey;
  }
  return null;
}
function getEquippedItems(student){
  if(!student.equippedItems) student.equippedItems={};
  return student.equippedItems;
}
function isItemEquipped(student, itemId){
  const eq=getEquippedItems(student);
  const cat=getItemCategory(itemId);
  return cat && eq[cat]===itemId;
}
function equipItem(student, itemId){
  if(!studentOwnsItem(student,itemId)) return false;
  const cat=getItemCategory(itemId);
  if(!cat) return false;
  if(!student.equippedItems) student.equippedItems={};
  student.equippedItems[cat]=itemId;
  return true;
}
function unequipItem(student, itemId){
  const cat=getItemCategory(itemId);
  if(!cat) return false;
  if(!student.equippedItems) return false;
  if(student.equippedItems[cat]===itemId){
    delete student.equippedItems[cat];
    return true;
  }
  return false;
}
function autoEquipOnBuy(student, itemId){
  const cat=getItemCategory(itemId);
  if(!cat) return;
  if(!student.equippedItems) student.equippedItems={};
  if(!student.equippedItems[cat]){
    student.equippedItems[cat]=itemId;
  }
}

function showPetShopBrowse(){
  if(!currentClassId){showNotification('请先选择班级','','warning');return;}
  _shopActiveCategory='borders';
  const html=_buildShopBrowseHTML();
  showModal('🏪 宠物商店', html, [{text:'关闭',onclick:'closeModal()'}], true);
}
function switchShopCategory(catKey){
  _shopActiveCategory=catKey;
  const container=document.querySelector('.modal-content');
  if(container) container.innerHTML=_buildShopBrowseHTML();
}
function _buildShopBrowseHTML(){
  let html='<div style="margin-bottom:14px;text-align:center;color:#886;font-size:13px;">浏览商品分类，进入学生卡片可购买商品</div>';
  html+='<div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-bottom:16px;">';
  Object.entries(PET_SHOP_ITEMS).forEach(([key,cat])=>{
    const isActive=key===_shopActiveCategory;
    html+=`<button onclick="switchShopCategory('${key}')" style="padding:8px 16px;border-radius:18px;border:2px solid ${isActive?'#9b59b6':'#e0d0c8'};background:${isActive?'linear-gradient(135deg,#9b59b6,#8e44ad)':'#fff8f5'};color:${isActive?'#fff':'#665'};font-size:14px;font-weight:${isActive?'700':'500'};cursor:pointer;transition:all 0.2s;display:flex;align-items:center;gap:5px;">${cat.icon} ${cat.name}<span style="font-size:11px;opacity:0.7;">(${cat.items.length})</span></button>`;
  });
  html+='</div>';
  const cat=PET_SHOP_ITEMS[_shopActiveCategory];
  html+=`<div style="background:linear-gradient(135deg,#faf5ff,#f5f0ff);border-radius:18px;padding:16px;border:1.5px solid #e8d8f0;">`;
  html+=`<h4 style="margin:0 0 12px;color:#7b2d8e;font-size:16px;">${cat.icon} ${cat.name}</h4>`;
  html+='<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px;">';
  cat.items.forEach(item=>{
    html+=`<div style="background:#fff;border-radius:14px;padding:12px;border:1.5px solid #ecdff5;transition:all 0.2s;cursor:default;" onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 4px 12px rgba(155,89,182,0.15)'" onmouseout="this.style.transform='none';this.style.boxShadow='none'">
      <div style="font-weight:700;font-size:14px;color:#5b2d6e;margin-bottom:4px;">${item.name}</div>
      <div style="font-size:11px;color:#998;margin-bottom:6px;line-height:1.4;">${item.desc}</div>
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <span style="font-size:13px;font-weight:600;color:#e67e22;">💰 ${item.price}</span>
        <span style="font-size:11px;color:#27ae60;font-weight:600;">📈 +${item.growthBonus}/次</span>
      </div>
    </div>`;
  });
  html+='</div></div>';
  html+='<div style="margin-top:12px;padding:10px 14px;background:#fff8f0;border-radius:12px;font-size:12px;color:#886;line-height:1.6;">';
  html+='<strong>成长加成说明：</strong>只有佩戴的商品才会产生成长值加成。同类道具只能佩戴一个，佩戴后每次互动额外获得对应的成长加成。可在商店中点击「佩戴/取下」切换生效道具。';
  html+='</div>';
  return html;
}
let _modalShopCategory = 'borders';
function _buildModalShopSection(student, pet){
  const owned=getStudentOwnedItems(student);
  const totalBonus=getStudentGrowthBonus(student);
  let html=`<div style="margin-top:14px;"><h4>🏪 宠物商店${totalBonus>0?` <span style="font-size:12px;font-weight:400;color:#27ae60;background:#e8faf0;padding:2px 10px;border-radius:10px;">当前加成: +${totalBonus}/次</span>`:''}</h4>`;
  html+='<div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:10px;">';
  Object.entries(PET_SHOP_ITEMS).forEach(([key,cat])=>{
    const isActive=key===_modalShopCategory;
    const ownedInCat=cat.items.filter(it=>owned.includes(it.id)).length;
    html+=`<button onclick="_modalShopCategory='${key}';refreshCurrentStudentModal();" style="padding:4px 10px;border-radius:12px;border:1.5px solid ${isActive?'#9b59b6':'#ddd'};background:${isActive?'#9b59b6':'#faf5ff'};color:${isActive?'#fff':'#665'};font-size:12px;font-weight:${isActive?'700':'400'};cursor:pointer;">${cat.icon} ${cat.name}${ownedInCat>0?` ✓${ownedInCat}`:''}</button>`;
  });
  html+='</div>';
  const cat=PET_SHOP_ITEMS[_modalShopCategory];
  html+='<div class="modal-action-grid" style="grid-template-columns:repeat(auto-fill,minmax(155px,1fr));">';
  cat.items.forEach(item=>{
    const isOwned=owned.includes(item.id);
    const canAfford=student.coins>=item.price;
    const equipped=isItemEquipped(student, item.id);
    if(isOwned){
      const eqBtnStyle=equipped
        ?'background:linear-gradient(135deg,#27ae60,#219a52);color:#fff;border:2px solid #1e8449;'
        :'background:linear-gradient(135deg,#f0e6ff,#e8d8f5);color:#7b2d8e;border:2px solid #c9a0dc;';
      const eqLabel=equipped?'✅ 已佩戴':'🔲 未佩戴';
      const eqAction=equipped?`modalUnequipItem('${item.id}')`:`modalEquipItem('${item.id}')`;
      html+=`<div style="background:${equipped?'linear-gradient(135deg,#e0ffe8,#c8f8d4)':'linear-gradient(135deg,#f5f0ff,#ece4f8)'};border:2px solid ${equipped?'#27ae60':'#d0c0e0'};border-radius:14px;padding:10px;text-align:center;transition:all 0.3s;${equipped?'box-shadow:0 2px 12px rgba(39,174,96,0.25);':''}">
        <div style="font-weight:700;font-size:13px;color:${equipped?'#27ae60':'#7b2d8e'};">${equipped?'🌟':'📦'} ${item.name}</div>
        <div style="font-size:10px;color:#888;margin:3px 0;">+${item.growthBonus}/次</div>
        <button onclick="${eqAction}" style="${eqBtnStyle}padding:4px 14px;border-radius:16px;font-size:12px;font-weight:700;cursor:pointer;transition:all 0.2s;display:inline-block;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='none'">${eqLabel}</button>
      </div>`;
    } else {
      const btnColor=canAfford?'#9b59b6':'#bbb';
      const btnBg=canAfford?'linear-gradient(135deg,#9b59b6,#8e44ad)':'#e0d0d0';
      html+=`<button onclick="modalBuyItem('${item.id}')" ${canAfford?'':'disabled'} style="background:${btnBg};color:#fff;border:1.5px solid ${canAfford?'rgba(255,255,255,0.2)':'#ccc'};border-radius:14px;padding:10px;text-align:center;cursor:${canAfford?'pointer':'not-allowed'};transition:all 0.2s;display:block;width:100%;font-size:13px;" ${canAfford?`onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='none'"`:''}>
        <div style="font-weight:700;">${item.name}</div>
        <div style="font-size:10px;opacity:0.85;margin-top:2px;">💰${item.price}金币 · 📈+${item.growthBonus}/次</div>
      </button>`;
    }
  });
  html+='</div>';
  if(owned.length>0){
    html+=`<div style="margin-top:8px;padding:6px 10px;background:#f8f5ff;border-radius:10px;font-size:11px;color:#886;">已购 ${owned.length} 件 · 总成长加成: <strong style="color:#27ae60;">+${totalBonus}</strong>/次（每次互动额外获得）</div>`;
  }
  html+='</div>';
  return html;
}
// v39: Read-only shop section for viewing other students' items
function _buildReadOnlyShopSection(student, pet){
  const owned=getStudentOwnedItems(student);
  if(owned.length===0) return '';
  const totalBonus=getStudentGrowthBonus(student);
  let html=`<div style="margin-top:14px;"><h4>🏪 已购特效${totalBonus>0?` <span style="font-size:12px;font-weight:400;color:#27ae60;background:#e8faf0;padding:2px 10px;border-radius:10px;">加成: +${totalBonus}/次</span>`:''}</h4>`;
  html+='<div style="display:flex;flex-wrap:wrap;gap:8px;">';
  owned.forEach(itemId=>{
    const item=getShopItemById(itemId);
    if(!item) return;
    const equipped=isItemEquipped(student, itemId);
    html+=`<div style="background:${equipped?'linear-gradient(135deg,#e0ffe8,#c8f8d4)':'linear-gradient(135deg,#f5f0ff,#ece4f8)'};border:2px solid ${equipped?'#27ae60':'#d0c0e0'};border-radius:14px;padding:10px;text-align:center;min-width:120px;${equipped?'box-shadow:0 2px 12px rgba(39,174,96,0.25);':''}">
      <div style="font-weight:700;font-size:13px;color:${equipped?'#27ae60':'#7b2d8e'};">${equipped?'🌟':'📦'} ${item.name}</div>
      <div style="font-size:10px;color:#888;margin-top:3px;">+${item.growthBonus}/次</div>
      <div style="font-size:11px;color:${equipped?'#27ae60':'#999'};margin-top:4px;font-weight:${equipped?'700':'400'};">${equipped?'✅ 佩戴中':'未佩戴'}</div>
    </div>`;
  });
  html+='</div>';
  html+=`<div style="margin-top:8px;padding:6px 10px;background:#f8f5ff;border-radius:10px;font-size:11px;color:#886;">共 ${owned.length} 件特效 · 总成长加成: <strong style="color:#27ae60;">+${totalBonus}</strong>/次</div>`;
  html+='</div>';
  return html;
}
function modalBuyItem(itemId){
  if(checkPauseAndNotify())return;
  if(!currentModalStudentId)return;
  const cur=classesData.find(c=>c.id===currentClassId);
  const student=cur.students.find(s=>s.id.toString()===currentModalStudentId.toString());
  if(!student)return;
  const item=getShopItemById(itemId);
  if(!item){showNotification('商品不存在','','error');return;}
  if(studentOwnsItem(student,itemId)){showNotification('已拥有','你已经拥有该商品','warning');return;}
  if(student.coins<item.price){showNotification('金币不足',`购买${item.name}需要${item.price}金币，当前${student.coins}金币`,'error');return;}
  student.coins-=item.price;
  if(!student.shopItems) student.shopItems=[];
  student.shopItems.push(itemId);
  autoEquipOnBuy(student, itemId);
  const pet=getActivePet(student);
  recordAction(student.id, student.name, '商店购买', `购买「${item.name}」，成长加成+${item.growthBonus}/次`, -item.price, 0, pet?pet.id:null, {shopItemId:itemId});
  // v149: API 模式下同步金币和商店状态到服务器
  if(window.USE_API&&window.ApiMigration){
    var _buySave=function(){
      window.ApiMigration.saveShopState(student.id, student.shopItems, student.equippedItems).then(function(r){
        if(!r.ok) console.warn('[v149] API saveShopState error:', r.error);
      });
    };
    window.ApiMigration.changeStudentCoins(student, -item.price, '商店购买', `购买「${item.name}」`, 0, pet?pet.id:null).then(function(r){
      if(r.ok){
        student.coins=r.coinsAfter;
        _buySave();
      } else {
        // 金币 API 失败，仍然尝试保存商店状态
        _buySave();
      }
    });
  }
  saveClassData();
  refreshCurrentStudentModal();
  renderHomePetGrid();
  showNotification('购买成功',`获得「${item.name}」！已自动佩戴，每次互动额外+${item.growthBonus}成长值`,'success');
}
function modalEquipItem(itemId){
  if(!currentModalStudentId)return;
  const cur=classesData.find(c=>c.id===currentClassId);
  const student=cur.students.find(s=>s.id.toString()===currentModalStudentId.toString());
  if(!student)return;
  const item=getShopItemById(itemId);
  if(!item)return;
  equipItem(student, itemId);
  // v149: API 模式下同步装备状态到服务器
  if(window.USE_API&&window.ApiMigration&&window.ApiMigration.saveShopState){
    window.ApiMigration.saveShopState(student.id, student.shopItems, student.equippedItems).then(function(r){
      if(!r.ok) console.warn('[v149] API saveShopState equip error:', r.error);
    });
  }
  saveClassData();
  refreshCurrentStudentModal();
  renderHomePetGrid();
  showNotification('佩戴成功',`已佩戴「${item.name}」，特效已生效！`,'success');
}
function modalUnequipItem(itemId){
  if(!currentModalStudentId)return;
  const cur=classesData.find(c=>c.id===currentClassId);
  const student=cur.students.find(s=>s.id.toString()===currentModalStudentId.toString());
  if(!student)return;
  const item=getShopItemById(itemId);
  if(!item)return;
  unequipItem(student, itemId);
  // v149: API 模式下同步装备状态到服务器
  if(window.USE_API&&window.ApiMigration&&window.ApiMigration.saveShopState){
    window.ApiMigration.saveShopState(student.id, student.shopItems, student.equippedItems).then(function(r){
      if(!r.ok) console.warn('[v149] API saveShopState unequip error:', r.error);
    });
  }
  saveClassData();
  refreshCurrentStudentModal();
  renderHomePetGrid();
  showNotification('已卸下',`已卸下「${item.name}」`,'info');
}
