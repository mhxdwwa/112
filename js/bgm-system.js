// ========== 背景音乐系统 ==========
// 从 app.js 拆分 - v129
// ========== 背景音乐系统（自定义MP3版） ==========
(function(){
  let bgPlaying=false, bgMuted=false, bgVol=0.4;
  let curPage='class-pet-page';
  let customAudioEl=null;
  const names={'class-pet-page':'宠物乐园','honor-board-page':'荣耀殿堂','pk-page':'欢乐竞技','jianghu-page':'萌萌江湖行'};
  const customMusicFiles={'class-pet-page':'https://mhxdwwa.oss-cn-shenzhen.aliyuncs.com/music/宠物管理.mp3','honor-board-page':'https://mhxdwwa.oss-cn-shenzhen.aliyuncs.com/music/排行榜.mp3','pk-page':'https://mhxdwwa.oss-cn-shenzhen.aliyuncs.com/music/宠物PK.mp3','jianghu-page':'https://mhxdwwa.oss-cn-shenzhen.aliyuncs.com/music/萌萌江湖行.mp3'};

  function stopAudio(){
    if(customAudioEl){
      customAudioEl.pause();
      customAudioEl.currentTime=0;
      customAudioEl.removeAttribute('src');
      customAudioEl.load();
      customAudioEl=null;
    }
  }

  function playAudio(pageId){
    stopAudio();
    const src=customMusicFiles[pageId];
    if(!src)return;
    const el=new Audio(src);
    el.loop=true;
    el.volume=bgMuted?0:bgVol;
    customAudioEl=el;
    el.play().catch(()=>{});
  }

  function startMusic(pageId){
    curPage=pageId;
    const el=document.getElementById('musicName');
    if(el)el.textContent=names[pageId]||'背景音乐';
    if(!bgPlaying)return;
    stopAudio();
    playAudio(pageId);
  }

  window.toggleMusicPanel=function(e){
    e.stopPropagation();
    const panel=document.getElementById('musicPanel');
    const btn=document.getElementById('musicExpandBtn');
    const isOpen=panel.classList.toggle('expanded');
    btn.textContent=isOpen?'◀':'▶';
    btn.classList.toggle('open',isOpen);
    if(isOpen){
      const closePanel=function(ev){if(!panel.contains(ev.target)){panel.classList.remove('expanded');btn.textContent='▶';btn.classList.remove('open');document.removeEventListener('click',closePanel);}};
      setTimeout(()=>document.addEventListener('click',closePanel),0);
    }
  };
  window.toggleBgMusic=function(){
    bgPlaying=!bgPlaying;
    const btn=document.getElementById('musicToggleBtn');
    if(bgPlaying){btn.textContent='🎶';btn.classList.add('playing');startMusic(curPage);}
    else{btn.textContent='🎵';btn.classList.remove('playing');stopAudio();}
  };
  window.setBgMusicVol=function(v){
    bgVol=v/100;
    if(customAudioEl)customAudioEl.volume=bgVol;
    // 同步更新音效音量
    window.updateSfxVolume(v, v==0);
    const ic=document.getElementById('musicVolIcon');
    if(v==0){ic.textContent='🔇';bgMuted=true;}
    else if(v<40){ic.textContent='🔉';bgMuted=false;}
    else{ic.textContent='🔊';bgMuted=false;}
  };
  window.toggleMute=function(){
    const s=document.getElementById('musicVolSlider'),ic=document.getElementById('musicVolIcon');
    if(!bgMuted){bgMuted=true;s.dataset.prevVol=s.value;s.value=0;if(customAudioEl)customAudioEl.volume=0;ic.textContent='🔇';window.updateSfxVolume(0,true);}
    else{bgMuted=false;const p=s.dataset.prevVol||40;s.value=p;bgVol=p/100;if(customAudioEl)customAudioEl.volume=bgVol;ic.textContent=p<40?'🔉':'🔊';window.updateSfxVolume(p,false);}
  };

  const origSP=window.switchPage;
  window.switchPage=function(pid){origSP(pid);if(bgPlaying)startMusic(pid);else curPage=pid;};

  // 首次点击提示已移除，改为手动点击箭头展开
})();


/* ===== 简化拖拽：始终可直接拖拽交换卡片位置 ===== */
// v12: Swap two students' positions instead of reorder
function reorderStudent(fromIdx, toIdx){
  if(!currentClassId) return;
  // 只有教师才能拖拽排序
  if(!currentUser || currentUser.type !== 'teacher') return;
  const cur = classesData.find(c=>c.id===currentClassId);
  if(!cur || !cur.students) return;
  if(fromIdx < 0 || fromIdx >= cur.students.length) return;
  if(toIdx < 0 || toIdx >= cur.students.length) return;
  if(fromIdx === toIdx) return;
  // 交换两个学生卡片的位置
  const temp = cur.students[fromIdx];
  cur.students[fromIdx] = cur.students[toIdx];
  cur.students[toIdx] = temp;
  // 保存排序到 localStorage（按班级）
  saveStudentOrder(currentClassId, cur.students);
  saveClassData();
  renderHomePetGrid();
}

// 保存学生排序顺序到 localStorage
function saveStudentOrder(classId, students){
  if(!classId || !students) return;
  const order = students.map(s => s.id);
  try {
    localStorage.setItem('studentOrder_' + classId, JSON.stringify(order));
  } catch(e) {
    console.warn('[DAL] Failed to save student order:', e);
  }
}

// 从 localStorage 加载学生排序
function loadStudentOrder(classId){
  if(!classId) return null;
  try {
    const orderStr = localStorage.getItem('studentOrder_' + classId);
    if(orderStr) return JSON.parse(orderStr);
  } catch(e) {
    console.warn('[DAL] Failed to load student order:', e);
  }
  return null;
}

// 应用排序到学生数组
function applyStudentOrder(classId, students){
  if(!classId || !students || students.length === 0) return students;
  const order = loadStudentOrder(classId);
  if(!order || order.length === 0) return students;
  // 创建 ID 到学生的映射
  const studentMap = {};
  students.forEach(s => { studentMap[s.id] = s; });
  // 按排序顺序重建数组
  const ordered = [];
  order.forEach(id => {
    if(studentMap[id]) {
      ordered.push(studentMap[id]);
      delete studentMap[id];
    }
  });
  // 添加新增的学生（不在排序中的）
  Object.values(studentMap).forEach(s => ordered.push(s));
  return ordered;
}

/* renderHomePetGrid后自动重绑拖拽 */
{
  const _prevRender = renderHomePetGrid;
  renderHomePetGrid = function(){
    _prevRender();
    bindPetCardDrag();
  };
}

/* ===== 宠物卡片直接拖拽排序（仅教师可用） ===== */
let petDragIdx = null;
function bindPetCardDrag(){
  const grid = document.getElementById('homePetGrid');
  if(!grid) return;
  // 只有教师账户才能拖拽排序
  if(!currentUser || currentUser.type !== 'teacher') return;
  const cards = grid.querySelectorAll('.home-pet-card');
  cards.forEach((card, idx) => {
    card.draggable = true;
    card.dataset.petIdx = idx;
    card.addEventListener('dragstart', petCardDragStart);
    card.addEventListener('dragend', petCardDragEnd);
    card.addEventListener('dragover', petCardDragOver);
    card.addEventListener('dragleave', petCardDragLeave);
    card.addEventListener('drop', petCardDrop);
  });
}
function petCardDragStart(e){
  petDragIdx = +this.dataset.petIdx;
  this.classList.add('dragging');
  this.style.opacity = '0.4';
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', petDragIdx);
}
function petCardDragEnd(e){
  this.classList.remove('dragging');
  this.style.opacity = '';
  petDragIdx = null;
  document.querySelectorAll('.home-pet-card.drag-over').forEach(el => el.classList.remove('drag-over'));
}
function petCardDragOver(e){
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  if(+this.dataset.petIdx !== petDragIdx) this.classList.add('drag-over');
}
function petCardDragLeave(e){
  this.classList.remove('drag-over');
}
function petCardDrop(e){
  e.preventDefault();
  this.classList.remove('drag-over');
  const toIdx = +this.dataset.petIdx;
  if(petDragIdx === null || petDragIdx === toIdx) return;
  reorderStudent(petDragIdx, toIdx);
}

