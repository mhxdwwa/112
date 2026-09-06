/* ========== 宠物商店系统 ========== */
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
  const pet=getActivePet(student);
  if(window.USE_API&&window.ApiMigration){
    // v151-fix: 乐观更新本地数据 + 立即刷新 UI，API 调用并行发出
    student.coins -= item.price;
    if(!student.shopItems) student.shopItems=[];
    student.shopItems.push(itemId);
    autoEquipOnBuy(student, itemId);
    if(!(window.USE_API&&window.ApiMigration)){
      recordAction(student.id, student.name, '商店购买', `购买「${item.name}」，成长加成+${item.growthBonus}/次`, -item.price, 0, pet?pet.id:null, {shopItemId:itemId});
    }
    saveClassData();
    refreshCurrentStudentModal();
    renderHomePetGrid();
    showNotification('购买成功',`获得「${item.name}」！已自动佩戴，每次互动额外+${item.growthBonus}成长值`,'success');
    // 两个 API 并行发出，不阻塞 UI
    window.ApiMigration.changeStudentCoins(student, -item.price, '商店购买', `购买「${item.name}」，成长加成+${item.growthBonus}/次`, 0, pet?pet.id:null).then(function(r){
      if(r.ok){
        student.coins=r.coinsAfter;
      } else if(r.error==='Insufficient balance'){
        // 回滚
        student.coins += item.price;
        var idx2=student.shopItems.indexOf(itemId); if(idx2!==-1) student.shopItems.splice(idx2,1);
        saveClassData(); refreshCurrentStudentModal(); renderHomePetGrid();
        showNotification('金币不足',`余额不足，无法购买${item.name}`,'error');
      } else {
        console.warn('[API] changeStudentCoins error:', r.error);
      }
    });
    window.ApiMigration.saveShopState(student.id, student.shopItems, student.equippedItems).then(function(r2){
      if(!r2.ok) console.warn('[API] saveShopState error:', r2.error);
    });
  } else {
    // 非 API 模式：本地扣金币 + 保存
    changeStudentCoins(student, -item.price, '商店购买', `购买「${item.name}」，成长加成+${item.growthBonus}/次`, 0, pet?pet.id:null, {shopItemId:itemId});
    if(!student.shopItems) student.shopItems=[];
    student.shopItems.push(itemId);
    autoEquipOnBuy(student, itemId);
    saveClassData();
    refreshCurrentStudentModal();
    renderHomePetGrid();
    showNotification('购买成功',`获得「${item.name}」！已自动佩戴，每次互动额外+${item.growthBonus}成长值`,'success');
  }
}
function modalEquipItem(itemId){
  if(!currentModalStudentId)return;
  const cur=classesData.find(c=>c.id===currentClassId);
  const student=cur.students.find(s=>s.id.toString()===currentModalStudentId.toString());
  if(!student)return;
  const item=getShopItemById(itemId);
  if(!item)return;
  equipItem(student, itemId);
  // v151: API 模式下同步装备状态到服务器
  if(window.USE_API&&window.ApiMigration&&window.ApiMigration.saveShopState){
    window.ApiMigration.saveShopState(student.id, student.shopItems, student.equippedItems).then(function(r){
      if(!r.ok) console.warn('[API] saveShopState equip error:', r.error);
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
  // v151: API 模式下同步装备状态到服务器
  if(window.USE_API&&window.ApiMigration&&window.ApiMigration.saveShopState){
    window.ApiMigration.saveShopState(student.id, student.shopItems, student.equippedItems).then(function(r){
      if(!r.ok) console.warn('[API] saveShopState unequip error:', r.error);
    });
  }
  saveClassData();
  refreshCurrentStudentModal();
  renderHomePetGrid();
  showNotification('已卸下',`已卸下「${item.name}」`,'info');
}
