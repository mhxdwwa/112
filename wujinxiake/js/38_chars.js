/* ===== 角色系统：一个账号多个角色 + 角色名唯一 =====
   存储结构（和云存档同一个 data 字段，不额外建表）：
     { v:3, t, activeId, chars:[ {id,name,charIdx,level,t,p:{...存档字段}} ] }
   · 老存档（v:2 单角色）自动迁移成 chars[0]
   · 角色名唯一性：本机先查自己列表；登录后查云端表 wujinxiake_names
     （表没建也不报错，只是降级为「本机唯一」）
*/
(function(){
'use strict';

const LOCAL_KEY  = 'wjx_chars_v1';
const NAME_TABLE = 'wujinxiake_names';
const MAX_CHARS  = 6;

let bundle = { v: 3, t: 0, activeId: '', chars: [] };

function sb(){ return window.SB || null; }
function logged(){ return !!(window.AUTH && window.AUTH.loggedIn && window.AUTH.uid); }
function $(id){ return document.getElementById(id); }
function toast(t, c){ if(typeof showToast === 'function') showToast(t, c || '#ffcf6e'); }
function newId(){ return 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function norm(n){ return String(n || '').trim(); }
function lower(n){ return norm(n).toLowerCase(); }

function loadLocal(){
  try{
    const s = localStorage.getItem(LOCAL_KEY);
    if(!s) return;
    const d = JSON.parse(s);
    if(d && d.chars && d.chars.length) bundle = d;
  }catch(e){}
}
function persist(){
  try{ localStorage.setItem(LOCAL_KEY, JSON.stringify(bundle)); }catch(e){}
}

/* ---------- 查询 ---------- */
function all(){
  return bundle.chars.slice().sort(function(a, b){ return (b.t || 0) - (a.t || 0); });
}
function get(id){
  for(let i = 0; i < bundle.chars.length; i++) if(bundle.chars[i].id === id) return bundle.chars[i];
  return null;
}
function active(){
  return get(bundle.activeId) || all()[0] || null;
}
function count(){ return bundle.chars.length; }

function loadBundle(data, useActive){
  if(!data || !data.chars || !data.chars.length) return false;
  bundle = {
    v: 3, t: Number(data.t) || 0,
    activeId: (useActive !== false && data.activeId) ? data.activeId : (data.chars[0] && data.chars[0].id) || '',
    chars: data.chars.map(function(c){
      return {
        id: c.id || newId(), name: c.name || '无名侠客',
        charIdx: c.charIdx | 0, level: c.level | 0 || 1,
        t: Number(c.t) || 0, p: c.p || {}
      };
    })
  };
  if(!get(bundle.activeId)) bundle.activeId = bundle.chars[0].id;
  persist();
  return true;
}

/* 把「当前进度快照」写进当前角色，并返回整包（给云存档用） */
function pack(one){
  if(!one) return bundle;
  let c = active();
  if(!c){
    c = { id: newId(), name: (typeof playerName !== 'undefined' && playerName) || one.name || '无名侠客',
          charIdx: one.charIdx | 0, level: 1, t: Date.now(), p: {} };
    bundle.chars.push(c);
    bundle.activeId = c.id;
  }
  c.name = one.name || c.name;
  c.charIdx = (typeof one.charIdx === 'number') ? one.charIdx : c.charIdx;
  c.level = (one.p && one.p.level) | 0 || c.level || 1;
  c.p = one.p || c.p || {};
  c.t = Date.now();
  bundle.t = c.t;
  persist();
  return bundle;
}

/* 当前角色 → 可直接喂给 CloudSave.apply 的单角色存档 */
function activeSave(){
  const c = active();
  if(!c) return null;
  return { v: 2, t: c.t || Date.now(), name: c.name, charIdx: c.charIdx | 0, p: c.p || {} };
}

/* ---------- 名字查重 ---------- */
function localTaken(name){
  const n = lower(name);
  for(let i = 0; i < bundle.chars.length; i++){
    if(lower(bundle.chars[i].name) === n) return true;
  }
  return false;
}

async function remoteTaken(name){
  if(!logged() || !sb()) return false;
  try{
    const res = await sb().from(NAME_TABLE).select('name').eq('name', norm(name)).maybeSingle();
    if(res.error) return false;          /* 表不存在 / 无权限 → 不阻断 */
    return !!res.data;
  }catch(e){ return false; }
}

async function reserveName(name){
  if(!logged() || !sb()) return;
  try{ await sb().from(NAME_TABLE).insert({ name: norm(name), user_id: window.AUTH.uid }); }catch(e){}
}

function checkFormat(name){
  const n = norm(name);
  if(n.length < 2) return '名字至少 2 个字';
  if(n.length > 10) return '名字最多 10 个字';
  if(!/^[\u4e00-\u9fa5A-Za-z0-9_·]+$/.test(n)) return '名字只能用中文、字母、数字';
  return '';
}

/* 创建角色前的完整校验：格式 → 本机重复 → 云端重复 */
async function validate(name, ignoreId){
  const f = checkFormat(name);
  if(f) return f;
  const n = lower(name);
  for(let i = 0; i < bundle.chars.length; i++){
    const c = bundle.chars[i];
    if(c.id !== ignoreId && lower(c.name) === n) return '这个名字你已经用过了，换一个';
  }
  if(await remoteTaken(name)) return '这个名字已经被别人占了，换一个';
  return '';
}

/* ---------- 创建 / 进入 ---------- */
/* 从命名界面创建：snapshot 为当前 G.player 的快照（由 CloudSave 提供） */
async function createFromNaming(name, charIdx, done){
  const nm = norm(name) || '无名侠客';
  if(count() >= MAX_CHARS){ toast('最多创建 ' + MAX_CHARS + ' 个角色', '#ff8f6e'); return; }
  const err = await validate(nm, '');
  if(err){ toast(err, '#ff8f6e'); return; }

  let p = {};
  try{
    if(window.CloudSave && window.CloudSave.snapshotNow){
      const snap = window.CloudSave.snapshotNow();
      if(snap && snap.p) p = snap.p;
    }
  }catch(e){}

  if(typeof p.pills !== 'number') p.pills = 3;   /* ★ 新角色赠送 3 枚重生丸 */
  if(window.MOUNT) MOUNT.ensure(p);             /* ★ 新角色赠送 1 级白阶飞行道具并自动装备 */
  const c = { id: newId(), name: nm, charIdx: charIdx | 0, level: (p.level | 0) || 1, t: Date.now(), p: p };
  bundle.chars.push(c);
  bundle.activeId = c.id;
  bundle.t = c.t;
  persist();
  reserveName(nm);          /* 异步占名，失败也不拦 */
  /* ★ 新建角色＝正式进游戏了，允许写盘 */
  try{ if(window.CloudSave && window.CloudSave.arm) window.CloudSave.arm(); }catch(e){}
  toast('角色「' + nm + '」创建成功', '#7af0c8');
  if(typeof done === 'function') done();
}

function enter(id, done){
  const c = get(id);
  if(!c){ toast('角色不存在', '#ff8f6e'); return; }
  bundle.activeId = c.id;
  persist();
  closePanel();
  /* 在城镇/战斗里切换角色：先回到菜单态，apply 才会生效（会重新进城镇） */
  try{
    if(typeof gameState !== 'undefined' &&
       ['menu', 'charSelect', 'nameInput'].indexOf(gameState) < 0) gameState = 'menu';
  }catch(e){}
  if(window.CloudSave && window.CloudSave.applyData){
    const ok = window.CloudSave.applyData(activeSave());
    if(!ok){ toast('进入失败，请刷新重试', '#ff8f6e'); return; }
    if(typeof done === 'function') done();
  }
}

function remove(id){
  const c = get(id);
  if(!c) return;
  if(!confirm('删除角色「' + c.name + '」？\n\n该角色的等级、装备、金币会一起删除，无法恢复。')) return;
  bundle.chars = bundle.chars.filter(function(x){ return x.id !== id; });
  if(bundle.activeId === id) bundle.activeId = (bundle.chars[0] && bundle.chars[0].id) || '';
  persist();
  /* 释放名字，别人可以再用 */
  if(logged() && sb()){
    try{ sb().from(NAME_TABLE).delete().eq('name', c.name).then(function(){}); }catch(e){}
  }
  try{
    if(window.CloudSave && window.CloudSave.save) window.CloudSave.save();
  }catch(e){}
  renderPanel();
}

/* ---------- 面板 ---------- */
function openPanel(){ renderPanel(); const p = $('charPanel'); if(p) p.classList.add('open'); }
function closePanel(){ const p = $('charPanel'); if(p) p.classList.remove('open'); }

function jobName(idx){
  try{
    if(typeof CHARACTERS !== 'undefined' && CHARACTERS[idx]) return CHARACTERS[idx].name || ('门派' + (idx + 1));
  }catch(e){}
  return '门派' + ((idx | 0) + 1);
}

function renderPanel(){
  const box = $('cpList');
  if(!box) return;
  const list = all();
  if(!list.length){
    box.innerHTML = '<div class="cp-empty">还没有角色，点下面「创建新角色」开始</div>';
    return;
  }
  box.innerHTML = list.map(function(c){
    const cur = c.id === bundle.activeId;
    return '<div class="cp-item' + (cur ? ' cur' : '') + '" data-id="' + c.id + '">' +
      '<div class="cp-main"><b>' + escapeHtml(c.name) + '</b>' +
      '<em>' + jobName(c.charIdx) + ' · Lv.' + (c.level || 1) + '</em></div>' +
      '<button class="cp-go" data-go="' + c.id + '" type="button">进入</button>' +
      '<button class="cp-del" data-del="' + c.id + '" type="button">删除</button>' +
      '</div>';
  }).join('');
}

function escapeHtml(s){
  return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){
    return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c];
  });
}

function bindPanel(){
  const p = $('charPanel');
  if(!p) return;
  p.addEventListener('click', function(e){
    const t = e.target;
    if(!t) return;
    if(t.id === 'charPanel' || t.id === 'cpClose'){ closePanel(); return; }
    if(t.id === 'cpNew'){ closePanel(); startCreate(); return; }
    if(t.dataset && t.dataset.go){ enter(t.dataset.go); return; }
    if(t.dataset && t.dataset.del){ remove(t.dataset.del); return; }
  });
}

/* 进入职业选择（创建新角色） */
function startCreate(){
  if(count() >= MAX_CHARS){ toast('最多创建 ' + MAX_CHARS + ' 个角色', '#ff8f6e'); return; }
  if(typeof charSelectState !== 'undefined'){
    charSelectState.phase = 'single';
    charSelectState.step = 0;
    charSelectState.selections = [0, 0];
  }
  if(typeof gameState !== 'undefined') gameState = 'charSelect';
}

/* ---------- 启动 ---------- */
function boot(){
  loadLocal();
  bindPanel();
  /* 登录后云端整包会覆盖本机列表（见 CloudSave.apply） */
}

window.CHARS = {
  all: all, get: get, active: active, count: count,
  bundle: function(){ return bundle; },
  loadBundle: loadBundle, pack: pack, activeSave: activeSave,
  validate: validate, createFromNaming: createFromNaming,
  enter: enter, remove: remove,
  openPanel: openPanel, closePanel: closePanel, renderPanel: renderPanel,
  startCreate: startCreate
};

if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();

})();
