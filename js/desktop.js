// ========== U盘/文件存储 + 桌面模式 ==========
/* ========== U盘/本地文件存储系统（变量提前声明） ========== */
let _dirHandle = null;
let _dataDirHandle = null;
let _fileSaveTimer = null;
let _isSaving = false;
let _pendingSave = false;
/* ========== 桌面 EXE 模式变量（必须在 scheduleFileSave 之前声明） ========== */
let _desktopMode = false;
let _desktopSaveTimer = null;

const DATA_FOLDER_NAME = '数据';
const DATA_FILES = {
  classPetData: '班级宠物数据.json',
  customActions: '奖惩设置.json',
  operationLogs: '操作日志.json',
  logArchives: '操作日志归档.json',
  deletedClasses: '已删除班级.json'
};

/* --- IndexedDB 缓存文件夹句柄（同一台电脑下次打开免选文件夹） --- */
function openHandleDB(){
  return new Promise((resolve,reject)=>{
    const req = indexedDB.open('PetWorldHandles',1);
    req.onupgradeneeded = ()=>{ req.result.createObjectStore('handles'); };
    req.onsuccess = ()=> resolve(req.result);
    req.onerror = ()=> reject(req.error);
  });
}
async function saveDirHandle(handle){
  try{ const db=await openHandleDB(); const tx=db.transaction('handles','readwrite'); tx.objectStore('handles').put(handle,'dirHandle'); }catch(e){}
}
async function loadDirHandle(){
  try{ const db=await openHandleDB(); return new Promise((resolve)=>{ const tx=db.transaction('handles','readonly'); const req=tx.objectStore('handles').get('dirHandle'); req.onsuccess=()=>resolve(req.result||null); req.onerror=()=>resolve(null); }); }catch(e){ return null; }
}

function updateUSBStatus(connected) {
  const icon = document.getElementById('usbIcon');
  const text = document.getElementById('usbText');
  const btn = document.getElementById('usbConnectBtn');
  if (connected) {
    icon.textContent = '✅';
    text.textContent = '已授权保存';
    btn.style.background = 'linear-gradient(135deg, #a0ffb0, #70dd80)';
    btn.style.color = '#225522';
  } else {
    icon.textContent = '💾';
    text.textContent = '授权保存';
    btn.style.background = 'linear-gradient(135deg, #ffd6a0, #ffb870)';
    btn.style.color = '#553300';
  }
}

async function getOrCreateDataDir(parentDir) {
  try { return await parentDir.getDirectoryHandle(DATA_FOLDER_NAME, { create: true }); }
  catch(e) { console.error('创建数据文件夹失败:', e); return null; }
}

async function writeFileToDir(dirHandle, filename, data) {
  const fh = await dirHandle.getFileHandle(filename, { create: true });
  const writable = await fh.createWritable();
  await writable.write(JSON.stringify(data, null, 2));
  await writable.close();
}

async function readFileFromDir(dirHandle, filename) {
  try {
    const fh = await dirHandle.getFileHandle(filename, { create: false });
    const file = await fh.getFile();
    const text = await file.text();
    return text.trim() ? JSON.parse(text) : null;
  } catch(e) { return null; }
}

/* 尝试用缓存的句柄重新获取权限（不弹文件夹选择器，只弹"是否允许"） */
async function tryRestoreSavedHandle(){
  const saved = await loadDirHandle();
  if(!saved) return false;
  try {
    const perm = await saved.requestPermission({ mode: 'readwrite' });
    if(perm !== 'granted') return false;
    _dirHandle = saved;
    _dataDirHandle = await getOrCreateDataDir(_dirHandle);
    return !!_dataDirHandle;
  } catch(e) { return false; }
}

/* 首次：弹文件夹选择器 */
async function pickNewFolder(){
  _dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
  await saveDirHandle(_dirHandle);
  _dataDirHandle = await getOrCreateDataDir(_dirHandle);
  if(!_dataDirHandle) throw new Error('创建数据文件夹失败');
}

async function loadDataFromDir(){
  const savedClasses = await readFileFromDir(_dataDirHandle, DATA_FILES.classPetData);
  const savedActions = await readFileFromDir(_dataDirHandle, DATA_FILES.customActions);
  const savedLogs = await readFileFromDir(_dataDirHandle, DATA_FILES.operationLogs);
  const savedArchives = await readFileFromDir(_dataDirHandle, DATA_FILES.logArchives);
  const savedDeleted = await readFileFromDir(_dataDirHandle, DATA_FILES.deletedClasses);
  let loaded = false;
  if(savedClasses && savedClasses.length>0){ classesData=savedClasses; safeLSSave('classPetData',classesData); loaded=true; }
  if(savedActions && savedActions.length>0){ customActions=savedActions; neededPresets.forEach(p=>{if(!customActions.some(a=>a.id===p.id))customActions.push(p);}); safeLSSave('customActions',customActions); loaded=true; }
  if(savedLogs && savedLogs.length>0){ window.operationLogs=savedLogs; safeLSSave('operationLogs',window.operationLogs); loaded=true; }
  if(savedArchives && typeof savedArchives==='object' && !Array.isArray(savedArchives)){ logArchives=savedArchives; safeLSSave('logArchives',logArchives); loaded=true; }
  if(savedDeleted && savedDeleted.length>0){ deletedClasses=savedDeleted; safeLSSave('deletedClasses',deletedClasses); loaded=true; }
  if(loaded){ archiveOldLogs(); currentClassId=null; init(); }
  return loaded;
}

async function connectUSB() {
  /* 桌面 EXE 模式：直接用 Python 桥接，无需弹窗 */
  if(_desktopMode){
    try { await _desktopLoadData(); updateUSBStatus(true); showNotification('数据已加载','数据自动保存到同级「数据」文件夹','success'); } catch(e){ showNotification('加载失败',e.message,'error'); }
    return;
  }
  if(!window.showDirectoryPicker){
    showNotification('浏览器不支持','请使用 Chrome 或 Edge 浏览器','error'); return;
  }
  try {
    /* 先尝试用上次记住的文件夹（只弹"是否允许"小提示） */
    let restored = await tryRestoreSavedHandle();
    if(!restored){
      /* 没有缓存或权限被拒，才弹文件夹选择器 */
      await pickNewFolder();
    }
    const loaded = await loadDataFromDir();
    if(!loaded){ await saveAllToFiles(); }
    updateUSBStatus(true);
    showNotification(loaded?'数据已加载':'授权成功', loaded?'已从「数据」文件夹读取宠物数据':'数据将自动保存到「数据」文件夹','success');
  } catch(e) {
    if(e.name!=='AbortError') showNotification('授权失败',e.message,'error');
  }
}

async function saveAllToFiles() {
  if(!_dataDirHandle) return;
  if(_isSaving){ _pendingSave=true; return; }
  _isSaving = true;
  try {
    await Promise.all([
      writeFileToDir(_dataDirHandle, DATA_FILES.classPetData, classesData),
      writeFileToDir(_dataDirHandle, DATA_FILES.customActions, customActions),
      writeFileToDir(_dataDirHandle, DATA_FILES.operationLogs, window.operationLogs),
      writeFileToDir(_dataDirHandle, DATA_FILES.logArchives, logArchives),
      writeFileToDir(_dataDirHandle, DATA_FILES.deletedClasses, deletedClasses)
    ]);
  } catch(e) {
    console.error('保存失败:',e);
    /* 尝试重新验证权限后重试一次 */
    let retryOk = false;
    try {
      if(_dirHandle) {
        const perm = await _dirHandle.requestPermission({ mode: 'readwrite' });
        if(perm === 'granted') {
          _dataDirHandle = await getOrCreateDataDir(_dirHandle);
          if(_dataDirHandle) {
            await Promise.all([
              writeFileToDir(_dataDirHandle, DATA_FILES.classPetData, classesData),
              writeFileToDir(_dataDirHandle, DATA_FILES.customActions, customActions),
              writeFileToDir(_dataDirHandle, DATA_FILES.operationLogs, window.operationLogs),
              writeFileToDir(_dataDirHandle, DATA_FILES.deletedClasses, deletedClasses)
            ]);
            retryOk = true;
            updateUSBStatus(true);
          }
        }
      }
    } catch(retryErr) { console.error('重试保存失败:', retryErr); }
    if(!retryOk) {
      updateUSBStatus(false); _dirHandle=null; _dataDirHandle=null;
      showNotification('保存失败','请重新点击右上角「授权保存」','error');
    }
  }
  _isSaving = false;
  if(_pendingSave){ _pendingSave=false; saveAllToFiles(); }
}

function scheduleFileSave() {
  if(_desktopMode){ _scheduleDesktopSave(); return; }
  if(!_dataDirHandle) return;
  if(_fileSaveTimer) clearTimeout(_fileSaveTimer);
  _fileSaveTimer = setTimeout(()=>{ saveAllToFiles(); }, 200);
}

async function _desktopLoadData(){
  const api = window.pywebview.api;
  _desktopMode = true;
  let loaded = false;
  try {
    const r1 = await api.read_file('班级宠物数据.json');
    if(r1.ok && r1.data){ const d=JSON.parse(r1.data); if(d&&d.length>0){ classesData=d; safeLSSave('classPetData',classesData); loaded=true; }}
    const r2 = await api.read_file('奖惩设置.json');
    if(r2.ok && r2.data){ const d=JSON.parse(r2.data); if(d&&d.length>0){ customActions=d; neededPresets.forEach(p=>{if(!customActions.some(a=>a.id===p.id))customActions.push(p);}); safeLSSave('customActions',customActions); loaded=true; }}
    const r3 = await api.read_file('操作日志.json');
    if(r3.ok && r3.data){ const d=JSON.parse(r3.data); if(d&&d.length>0){ window.operationLogs=d; safeLSSave('operationLogs',window.operationLogs); loaded=true; }}
    const r3b = await api.read_file('操作日志归档.json');
    if(r3b.ok && r3b.data){ const d=JSON.parse(r3b.data); if(d&&typeof d==='object'&&!Array.isArray(d)){ logArchives=d; safeLSSave('logArchives',logArchives); loaded=true; }}
    const r4 = await api.read_file('已删除班级.json');
    if(r4.ok && r4.data){ const d=JSON.parse(r4.data); if(d&&d.length>0){ deletedClasses=d; safeLSSave('deletedClasses',deletedClasses); loaded=true; }}
  } catch(e){ console.error('桌面模式加载数据失败:', e); }
  if(loaded){ archiveOldLogs(); currentClassId=null; init(); }
  else { await _desktopSaveAll(); }  /* 首次运行，把 localStorage 数据写出去 */
}

async function _desktopSaveAll(){
  if(!_desktopMode) return;
  const api = window.pywebview.api;
  try {
    await api.write_file('班级宠物数据.json', JSON.stringify(classesData, null, 2));
    await api.write_file('奖惩设置.json', JSON.stringify(customActions, null, 2));
    await api.write_file('操作日志.json', JSON.stringify(window.operationLogs, null, 2));
    await api.write_file('操作日志归档.json', JSON.stringify(logArchives, null, 2));
    await api.write_file('已删除班级.json', JSON.stringify(deletedClasses, null, 2));
  } catch(e){ console.error('桌面模式保存数据失败:', e); }
}

function _scheduleDesktopSave(){
  if(_desktopSaveTimer) clearTimeout(_desktopSaveTimer);
  _desktopSaveTimer = setTimeout(()=>{ _desktopSaveAll(); }, 200);
}
/* ========== 桌面 EXE 模式结束 ========== */
