// ========== 数据访问层 (DAL) ==========
// 在 app.js 之后加载
// 负责 Supabase 与 localStorage 之间的数据同步
// =====================================================

var _dalReady = false;
var _dalSyncing = false;
var _dalSyncQueued = false;

// ===== 已删除班级追踪 =====
// 记录已从 Supabase 删除（或应在 Supabase 中删除）的班级 Supabase ID
// 防止 loadFromSupabase 把已删除的班级重新拉回来
var _deletedSupaClassIds = {};

function _loadDeletedClassIds() {
  try {
    var saved = localStorage.getItem('_dalDeletedClassIds');
    if (saved) _deletedSupaClassIds = JSON.parse(saved);
  } catch (e) {}
}

function _saveDeletedClassIds() {
  try { localStorage.setItem('_dalDeletedClassIds', JSON.stringify(_deletedSupaClassIds)); } catch (e) {}
}

function _markClassDeleted(supaId) {
  _deletedSupaClassIds[String(supaId)] = Date.now();
  _saveDeletedClassIds();
}

function _unmarkClassDeleted(supaId) {
  delete _deletedSupaClassIds[String(supaId)];
  _saveDeletedClassIds();
}

// ===== ID 映射：本地浮点ID ↔ Supabase整数ID =====
var _idMap = { students: {}, pets: {}, classes: {} };

function _loadIdMap() {
  try {
    var saved = localStorage.getItem('_dalIdMap');
    if (saved) _idMap = JSON.parse(saved);
  } catch (e) {}
  if (!_idMap.students) _idMap.students = {};
  if (!_idMap.pets) _idMap.pets = {};
  if (!_idMap.classes) _idMap.classes = {};
}

function _saveIdMap() {
  try { localStorage.setItem('_dalIdMap', JSON.stringify(_idMap)); } catch (e) {}
}

function _isLocalId(id) {
  return typeof id === 'number' && id % 1 !== 0;
}

function _stuKey(localClassId, localStuId) {
  return localClassId + '|' + localStuId;
}

function _petKey(localClassId, localStuId, localPetId) {
  return localClassId + '|' + localStuId + '|' + localPetId;
}

function _getSupaStuId(localClassId, localStuId) {
  return _idMap.students[_stuKey(localClassId, localStuId)] || null;
}

function _getSupaPetId(localClassId, localStuId, localPetId) {
  return _idMap.pets[_petKey(localClassId, localStuId, localPetId)] || null;
}

function _getSupaClassId(localClassId) {
  return _idMap.classes[String(localClassId)] || null;
}

// 解析 Supabase jsonb 字段（可能是字符串、对象、或 null）
function _parseJsonb(val, fallback) {
  if (val === null || val === undefined) return fallback;
  if (typeof val === 'string') {
    try { return JSON.parse(val); } catch (e) { return fallback; }
  }
  if (typeof val === 'object') return val;
  return fallback;
}

// ===== 智能合并学生数据（防止覆盖） =====
// 合并策略：
// - shopItems: 取并集（两边都保留）
// - equippedItems: 合并对象，本地优先
// - coins: 取最大值
// - pkCountToday: 取最大值
// - dates: 取非空值
// - activePetId: 本地优先，否则用云端
function _mergeStudentData(local, supabase) {
  if (!supabase) return local;
  
  var merged = {};
  
  // shopItems: 并集
  var localShop = local.shopItems || [];
  var supaShop = _parseJsonb(supabase.shop_items, []);
  var shopSet = {};
  localShop.forEach(function(item) { shopSet[item] = true; });
  supaShop.forEach(function(item) { shopSet[item] = true; });
  merged.shopItems = Object.keys(shopSet);
  
  // equippedItems: 合并，本地优先
  var localEq = local.equippedItems || {};
  var supaEq = _parseJsonb(supabase.equipped_items, {});
  merged.equippedItems = Object.assign({}, supaEq, localEq);
  
  // coins: 取最大值
  merged.coins = Math.max(local.coins || 0, supabase.coins || 0);
  
  // pkCountToday: 取最大值
  merged.pkCountToday = Math.max(local.pkCountToday || 0, supabase.pk_count_today || 0);
  
  // dates: 取非空值
  merged.lastCheckinDate = local.lastCheckinDate || supabase.last_checkin_date || null;
  merged.lastJianghuDate = local.lastJianghuDate || supabase.last_jianghu_date || null;
  merged.lastPkDate = local.lastPkDate || supabase.last_pk_date || null;
  
  // activePetId: 本地优先
  merged.activePetId = local.activePetId || supabase.active_pet_id || null;
  
  return merged;
}

// ===== 从 Supabase 加载数据到 classesData =====
async function loadFromSupabase() {
  if (!db || !currentUser) return false;

  if (currentUser.type === 'student') {
    return await _loadStudentFromSupabase();
  }

  // ---- 老师模式：加载全部班级数据 ----
  try {
    // 1. 加载该老师的所有班级
    var classResult = await db.from('classes')
      .select('id, name')
      .eq('teacher_id', currentUser.id)
      .order('id', { ascending: true });

    if (classResult.error) {
      console.error('[DAL] load classes error:', classResult.error);
      return false;
    }

    var supaClasses = classResult.data || [];
    if (supaClasses.length === 0) {
      console.log('[DAL] No classes in Supabase yet');
      return false;
    }

    // 过滤掉已标记删除的班级（防止删除后重新出现）
    var filteredClasses = supaClasses.filter(function(sc) {
      if (_deletedSupaClassIds[String(sc.id)]) {
        console.log('[DAL] Skipping deleted Supabase class:', sc.id);
        return false;
      }
      return true;
    });
    if (filteredClasses.length === 0) {
      console.log('[DAL] All Supabase classes are marked as deleted');
      return false;
    }
    supaClasses = filteredClasses;

    var newClassesData = [];
    var newIdMap = { students: {}, pets: {}, classes: {} };

    // 2. 逐班级加载学生和宠物
    for (var i = 0; i < supaClasses.length; i++) {
      var sc = supaClasses[i];
      var classObj = {
        id: String(sc.id),
        name: sc.name,
        students: [],
        pauseGrowth: null
      };
      newIdMap.classes[String(sc.id)] = sc.id;

      // 加载学生（包含特效、打卡、PK等字段）
      var stuResult = await db.from('students')
        .select('id, name, coins, shop_items, equipped_items, last_checkin_date, last_jianghu_date, active_pet_id, pk_count_today, last_pk_date')
        .eq('class_id', sc.id)
        .order('id', { ascending: true });

      if (stuResult.error) {
        console.error('[DAL] load students error for class', sc.id, stuResult.error);
        continue;
      }

      var supaStudents = stuResult.data || [];
      for (var j = 0; j < supaStudents.length; j++) {
        var ss = supaStudents[j];
        var studentObj = {
          id: ss.id,
          name: ss.name,
          coins: ss.coins || 0,
          pets: [],
          shopItems: _parseJsonb(ss.shop_items, []),
          equippedItems: _parseJsonb(ss.equipped_items, {}),
          lastCheckinDate: ss.last_checkin_date || null,
          lastJianghuDate: ss.last_jianghu_date || null,
          activePetId: ss.active_pet_id || null,
          pkCountToday: ss.pk_count_today || 0,
          lastPkDate: ss.last_pk_date || null
        };
        newIdMap.students[_stuKey(classObj.id, ss.id)] = ss.id;

        // 加载宠物
        var petResult = await db.from('pets')
          .select('*')
          .eq('student_id', ss.id)
          .order('id', { ascending: true });

        if (petResult.error) {
          console.error('[DAL] load pets error for student', ss.id, petResult.error);
        } else {
          var supaPets = petResult.data || [];
          for (var k = 0; k < supaPets.length; k++) {
            var sp = supaPets[k];
            var petObj = {
              id: sp.id,
              name: sp.name,
              nickname: sp.nickname || sp.name,
              level: sp.level || 1,
              growth: sp.growth || 0,
              coins: sp.coins || 0,
              is_active: sp.is_active !== false,
              isDead: sp.is_dead || false,
              lastFeedDate: sp.last_feed_date,
              lastPlayDate: sp.last_play_date,
              todayFeedCount: sp.today_feed_count || 0,
              todayPlayCount: sp.today_play_count || 0,
              penaltyStreak: sp.penalty_streak || 0
            };
            studentObj.pets.push(petObj);
            newIdMap.pets[_petKey(classObj.id, ss.id, sp.id)] = sp.id;
          }
        }

        // 设置 activePetId：优先 Supabase 值，然后 is_active，否则第一只
        if (studentObj.activePetId && studentObj.pets.some(function(p) { return Number(p.id) === Number(studentObj.activePetId); })) {
          // activePetId already set from Supabase
        } else {
          var activePet = studentObj.pets.find(function(p) { return p.is_active; });
          if (activePet) {
            studentObj.activePetId = activePet.id;
          } else if (studentObj.pets.length > 0) {
            studentObj.activePetId = studentObj.pets[0].id;
          }
        }

        classObj.students.push(studentObj);
      }

      newClassesData.push(classObj);
    }

    // 3. 与 localStorage 数据合并（防止 Supabase 空数据覆盖本地好数据）
    var localData = null;
    try {
      var saved = localStorage.getItem('classPetData');
      if (saved) localData = JSON.parse(saved);
    } catch (e) {}

    if (localData && Array.isArray(localData)) {
      // 构建本地数据查找表：classId -> studentName -> student
      var localLookup = {};
      localData.forEach(function(lc) {
        localLookup[lc.name] = {};
        (lc.students || []).forEach(function(ls) {
          localLookup[lc.name][ls.name] = ls;
        });
      });

      // 合并每个学生的数据
      newClassesData.forEach(function(nc) {
        var localClass = localLookup[nc.name];
        if (!localClass) return;
        
        nc.students.forEach(function(ns) {
          var localStudent = localClass[ns.name];
          if (!localStudent) return;
          
          // 合并 shopItems（并集）
          var localShop = localStudent.shopItems || [];
          var supaShop = ns.shopItems || [];
          var shopSet = {};
          localShop.forEach(function(item) { shopSet[item] = true; });
          supaShop.forEach(function(item) { shopSet[item] = true; });
          ns.shopItems = Object.keys(shopSet);
          
          // 合并 equippedItems（本地优先）
          var localEq = localStudent.equippedItems || {};
          var supaEq = ns.equippedItems || {};
          ns.equippedItems = Object.assign({}, supaEq, localEq);
          
          // coins: 取最大值
          ns.coins = Math.max(localStudent.coins || 0, ns.coins || 0);
          
          // pkCountToday: 取最大值
          ns.pkCountToday = Math.max(localStudent.pkCountToday || 0, ns.pkCountToday || 0);
          
          // dates: 取非空值
          ns.lastCheckinDate = localStudent.lastCheckinDate || ns.lastCheckinDate || null;
          ns.lastJianghuDate = localStudent.lastJianghuDate || ns.lastJianghuDate || null;
          ns.lastPkDate = localStudent.lastPkDate || ns.lastPkDate || null;
          
          // activePetId: 本地优先
          if (!ns.activePetId && localStudent.activePetId) {
            ns.activePetId = localStudent.activePetId;
          }
        });
      });
      
      console.log('[DAL] Merged with localStorage data');
    }

    // 4. 写入全局变量
    classesData = newClassesData;
    _idMap = newIdMap;
    _saveIdMap();
    safeLSSave('classPetData', classesData);

    // 5. 加载 customActions
    await _loadCustomActionsFromSupabase();

    console.log('[DAL] Loaded from Supabase:', newClassesData.length, 'classes');
    return true;
  } catch (e) {
    console.error('[DAL] loadFromSupabase error:', e);
    return false;
  }
}

// 学生模式加载
async function _loadStudentFromSupabase() {
  try {
    var studentId = parseInt(localStorage.getItem('studentId'));
    var classId = parseInt(localStorage.getItem('classId'));
    if (!studentId || !classId) return false;

    var classResult = await db.from('classes')
      .select('id, name')
      .eq('id', classId)
      .single();

    if (classResult.error || !classResult.data) return false;

    var stuResult = await db.from('students')
      .select('id, name, coins, shop_items, equipped_items, last_checkin_date, last_jianghu_date, active_pet_id, pk_count_today, last_pk_date')
      .eq('id', studentId)
      .single();

    if (stuResult.error || !stuResult.data) return false;

    var ss = stuResult.data;
    var petResult = await db.from('pets')
      .select('*')
      .eq('student_id', ss.id)
      .order('id', { ascending: true });

    var pets = [];
    if (petResult.data) {
      petResult.data.forEach(function(sp) {
        pets.push({
          id: sp.id, name: sp.name, nickname: sp.nickname || sp.name,
          level: sp.level || 1, growth: sp.growth || 0, coins: sp.coins || 0,
          is_active: sp.is_active !== false, isDead: sp.is_dead || false,
          lastFeedDate: sp.last_feed_date, lastPlayDate: sp.last_play_date,
          todayFeedCount: sp.today_feed_count || 0, todayPlayCount: sp.today_play_count || 0,
          penaltyStreak: sp.penalty_streak || 0
        });
      });
    }

    var studentObj = {
      id: ss.id, name: ss.name, coins: ss.coins || 0, pets: pets,
      shopItems: _parseJsonb(ss.shop_items, []),
      equippedItems: _parseJsonb(ss.equipped_items, {}),
      lastCheckinDate: ss.last_checkin_date || null,
      lastJianghuDate: ss.last_jianghu_date || null,
      activePetId: ss.active_pet_id || null,
      pkCountToday: ss.pk_count_today || 0,
      lastPkDate: ss.last_pk_date || null
    };
    
    // 与 localStorage 数据合并（防止 Supabase 空数据覆盖本地好数据）
    try {
      var localData = localStorage.getItem('classPetData');
      if (localData) {
        var parsed = JSON.parse(localData);
        if (parsed && parsed[0] && parsed[0].students) {
          var localStudent = parsed[0].students.find(function(s) {
            return s.name === studentObj.name;
          });
          if (localStudent) {
            // 合并 shopItems（并集）
            var localShop = localStudent.shopItems || [];
            var shopSet = {};
            localShop.forEach(function(item) { shopSet[item] = true; });
            studentObj.shopItems.forEach(function(item) { shopSet[item] = true; });
            studentObj.shopItems = Object.keys(shopSet);
            
            // 合并 equippedItems（本地优先）
            var localEq = localStudent.equippedItems || {};
            studentObj.equippedItems = Object.assign({}, studentObj.equippedItems, localEq);
            
            // coins: 取最大值
            studentObj.coins = Math.max(localStudent.coins || 0, studentObj.coins || 0);
            
            // pkCountToday: 取最大值
            studentObj.pkCountToday = Math.max(localStudent.pkCountToday || 0, studentObj.pkCountToday || 0);
            
            // dates: 取非空值
            studentObj.lastCheckinDate = localStudent.lastCheckinDate || studentObj.lastCheckinDate || null;
            studentObj.lastJianghuDate = localStudent.lastJianghuDate || studentObj.lastJianghuDate || null;
            studentObj.lastPkDate = localStudent.lastPkDate || studentObj.lastPkDate || null;
            
            // activePetId: 本地优先
            if (!studentObj.activePetId && localStudent.activePetId) {
              studentObj.activePetId = localStudent.activePetId;
            }
            
            console.log('[DAL] Merged student data with localStorage');
          }
        }
      }
    } catch (e) {
      console.warn('[DAL] Error merging with localStorage:', e);
    }
    
    // activePetId：优先 Supabase 值
    if (studentObj.activePetId && pets.some(function(p) { return Number(p.id) === Number(studentObj.activePetId); })) {
      // already set
    } else {
      var activePet = pets.find(function(p) { return p.is_active; });
      if (activePet) studentObj.activePetId = activePet.id;
      else if (pets.length > 0) studentObj.activePetId = pets[0].id;
    }

    // 构建 classesData，学生只看到自己
    classesData = [{
      id: String(classResult.data.id),
      name: classResult.data.name,
      students: [studentObj],
      pauseGrowth: null
    }];

    // 设置 ID 映射
    _idMap.classes[String(classResult.data.id)] = classResult.data.id;
    _idMap.students[_stuKey(String(classResult.data.id), ss.id)] = ss.id;
    pets.forEach(function(p) {
      _idMap.pets[_petKey(String(classResult.data.id), ss.id, p.id)] = p.id;
    });
    _saveIdMap();
    safeLSSave('classPetData', classesData);

    console.log('[DAL] Student loaded from Supabase');
    return true;
  } catch (e) {
    console.error('[DAL] loadStudent error:', e);
    return false;
  }
}

// 加载 customActions
async function _loadCustomActionsFromSupabase() {
  try {
    // customActions 是全局的，从第一个班级关联加载
    if (classesData.length === 0) return;
    var firstClassSupaId = _getSupaClassId(classesData[0].id);
    if (!firstClassSupaId) return;

    var result = await db.from('custom_actions')
      .select('*')
      .eq('class_id', firstClassSupaId);

    if (result.error || !result.data) return;

    if (result.data.length > 0) {
      customActions = result.data.map(function(a) {
        _idMap['custom_' + a.id] = a.id;
        return { id: String(a.id), name: a.name, coins: a.coins || 0 };
      });
      // 确保系统预设存在
      var neededPresets = [
        {id: 'sys_reward_1', name: '完成作业', coins: 10},
        {id: 'sys_reward_2', name: '课堂发言', coins: 10}
      ];
      neededPresets.forEach(function(preset) {
        if (!customActions.some(function(a) { return a.id === preset.id; })) {
          customActions.push(preset);
        }
      });
      safeLSSave('customActions', customActions);
    }
  } catch (e) {
    console.error('[DAL] loadCustomActions error:', e);
  }
}

// ===== 推送数据到 Supabase =====

// 推送单个班级完整数据
async function _pushClassToSupabase(classObj) {
  var teacherId = currentUser.id;
  var supaClassId = _getSupaClassId(classObj.id);
  console.log('[DAL] _pushClass: teacherId=', teacherId, 'supaClassId=', supaClassId);

  // 1. Upsert 班级
  if (supaClassId) {
    // 先确认 Supabase 中该班级是否真的存在（可能被删除后 ID 映射还残留）
    var checkResult = await db.from('classes').select('id').eq('id', supaClassId).eq('teacher_id', teacherId).maybeSingle();
    if (checkResult.data) {
      var upd = await db.from('classes').update({ name: classObj.name }).eq('id', supaClassId);
      if (upd.error) console.warn('[DAL] update class:', upd.error);
    } else {
      // Supabase 中已不存在，清除旧映射，走插入逻辑
      console.log('[DAL] Supabase class', supaClassId, 'no longer exists, re-inserting');
      delete _idMap.classes[String(classObj.id)];
      supaClassId = null;
    }
  }
  if (!supaClassId) {
    console.log('[DAL] Inserting class:', classObj.name);
    var ins = await db.from('classes')
      .insert([{ teacher_id: teacherId, name: classObj.name }])
      .select('id')
      .single();
    if (ins.error) {
      console.error('[DAL] insert class:', ins.error);
      return;
    }
    console.log('[DAL] Class inserted, id=', ins.data.id);
    supaClassId = ins.data.id;
    _idMap.classes[String(classObj.id)] = supaClassId;
  }

  // 2. 同步学生
  console.log('[DAL] Syncing', classObj.students.length, 'students for class', classObj.name);
  var currentLocalStuIds = [];
  for (var j = 0; j < classObj.students.length; j++) {
    var stu = classObj.students[j];
    currentLocalStuIds.push(stu.id);
    var supaStuId = await _upsertStudent(supaClassId, classObj.id, stu);
    if (supaStuId) {
      // 3. 同步宠物：先删后插（简化处理，避免复杂 diff）
      await db.from('pets').eq('student_id', supaStuId).delete();
      // 清除该学生宠物的旧 ID 映射
      Object.keys(_idMap.pets).forEach(function(key) {
        if (key.indexOf(classObj.id + '|' + stu.id + '|') === 0) {
          delete _idMap.pets[key];
        }
      });
      // 重新插入所有宠物
      for (var k = 0; k < (stu.pets || []).length; k++) {
        await _insertPet(supaStuId, classObj.id, stu.id, stu.pets[k]);
      }
    }
  }
  console.log('[DAL] Students synced for class', classObj.name);

  // 4. 删除 Supabase 中已不存在的学生（及其宠物）
  var allStuResult = await db.from('students').select('id').eq('class_id', supaClassId);
  if (allStuResult.data) {
    for (var m = 0; m < allStuResult.data.length; m++) {
      var supaId = allStuResult.data[m].id;
      // 检查这个 Supabase ID 是否还在映射中
      var stillExists = false;
      Object.keys(_idMap.students).forEach(function(key) {
        if (key.indexOf(classObj.id + '|') === 0 && _idMap.students[key] === supaId) {
          stillExists = true;
        }
      });
      if (!stillExists) {
        await db.from('pets').eq('student_id', supaId).delete();
        await db.from('students').eq('id', supaId).delete();
      }
    }
  }

  _saveIdMap();
  console.log('[DAL] _pushClass complete for', classObj.name);
}

async function _upsertStudent(supaClassId, localClassId, stu) {
  var key = _stuKey(localClassId, stu.id);
  var supaStuId = _idMap.students[key];

  // 先获取 Supabase 当前数据，然后合并（防止覆盖）
  var supaStudent = null;
  if (supaStuId && typeof supaStuId === 'number' && supaStuId % 1 === 0) {
    var fetchResult = await db.from('students')
      .select('id, coins, shop_items, equipped_items, last_checkin_date, last_jianghu_date, active_pet_id, pk_count_today, last_pk_date')
      .eq('id', supaStuId)
      .single();
    if (fetchResult.data) {
      supaStudent = fetchResult.data;
    }
  }

  // 智能合并数据
  var merged = _mergeStudentData(stu, supaStudent);

  // 构建完整学生数据（包含特效、打卡、PK等）
  var studentData = {
    coins: merged.coins,
    shop_items: JSON.stringify(merged.shopItems || []),
    equipped_items: JSON.stringify(merged.equippedItems || {}),
    last_checkin_date: merged.lastCheckinDate || null,
    last_jianghu_date: merged.lastJianghuDate || null,
    active_pet_id: merged.activePetId || null,
    pk_count_today: merged.pkCountToday || 0,
    last_pk_date: merged.lastPkDate || null
  };

  if (supaStuId && typeof supaStuId === 'number' && supaStuId % 1 === 0) {
    var upd = await db.from('students')
      .update(studentData)
      .eq('id', supaStuId);
    if (upd.error) console.warn('[DAL] update student:', upd.error);
    return supaStuId;
  } else {
    studentData.class_id = supaClassId;
    studentData.name = stu.name;
    studentData.password = '';
    var ins = await db.from('students')
      .insert([studentData])
      .select('id')
      .single();
    if (ins.error) {
      // 可能同名学生已存在，尝试查找
      var find = await db.from('students')
        .select('id')
        .eq('class_id', supaClassId)
        .eq('name', stu.name)
        .single();
      if (find.data) {
        supaStuId = find.data.id;
        _idMap.students[key] = supaStuId;
        // 更新所有字段（也需要合并）
        var fetchResult2 = await db.from('students')
          .select('id, coins, shop_items, equipped_items, last_checkin_date, last_jianghu_date, active_pet_id, pk_count_today, last_pk_date')
          .eq('id', supaStuId)
          .single();
        var merged2 = _mergeStudentData(stu, fetchResult2.data);
        var updateData2 = {
          coins: merged2.coins,
          shop_items: JSON.stringify(merged2.shopItems || []),
          equipped_items: JSON.stringify(merged2.equippedItems || {}),
          last_checkin_date: merged2.lastCheckinDate || null,
          last_jianghu_date: merged2.lastJianghuDate || null,
          active_pet_id: merged2.activePetId || null,
          pk_count_today: merged2.pkCountToday || 0,
          last_pk_date: merged2.lastPkDate || null
        };
        await db.from('students').update(updateData2).eq('id', supaStuId);
        return supaStuId;
      }
      console.error('[DAL] insert student:', ins.error);
      return null;
    }
    supaStuId = ins.data.id;
    _idMap.students[key] = supaStuId;
    return supaStuId;
  }
}

async function _upsertPet(supaStuId, localClassId, localStuId, pet) {
  var key = _petKey(localClassId, localStuId, pet.id);
  var supaPetId = _idMap.pets[key];

  var petData = {
    student_id: supaStuId,
    name: pet.name,
    nickname: pet.nickname || pet.name,
    level: pet.level || 1,
    growth: pet.growth || 0,
    coins: pet.coins || 0,
    is_active: pet.is_active !== false,
    is_dead: pet.isDead || false,
    last_feed_date: pet.lastFeedDate || null,
    last_play_date: pet.lastPlayDate || null,
    today_feed_count: pet.todayFeedCount || 0,
    today_play_count: pet.todayPlayCount || 0,
    penalty_streak: pet.penaltyStreak || 0
  };

  if (supaPetId && typeof supaPetId === 'number' && supaPetId % 1 === 0) {
    var upd = await db.from('pets').update(petData).eq('id', supaPetId);
    if (upd.error) console.warn('[DAL] update pet:', upd.error);
    return supaPetId;
  } else {
    return await _insertPet(supaStuId, localClassId, localStuId, pet);
  }
}

async function _insertPet(supaStuId, localClassId, localStuId, pet) {
  var petData = {
    student_id: supaStuId,
    name: pet.name,
    nickname: pet.nickname || pet.name,
    level: pet.level || 1,
    growth: pet.growth || 0,
    coins: pet.coins || 0,
    is_active: pet.is_active !== false,
    is_dead: pet.isDead || false,
    last_feed_date: pet.lastFeedDate || null,
    last_play_date: pet.lastPlayDate || null,
    today_feed_count: pet.todayFeedCount || 0,
    today_play_count: pet.todayPlayCount || 0,
    penalty_streak: pet.penaltyStreak || 0
  };

  var ins = await db.from('pets').insert([petData]).select('id').single();
  if (ins.error) {
    console.error('[DAL] insert pet:', ins.error);
    return null;
  }
  var key = _petKey(localClassId, localStuId, pet.id);
  _idMap.pets[key] = ins.data.id;
  return ins.data.id;
}

// 推送 customActions
async function _pushCustomActionsToSupabase() {
  if (!classesData.length || !currentUser || currentUser.type !== 'teacher') return;
  var firstClassSupaId = _getSupaClassId(classesData[0].id);
  if (!firstClassSupaId) return;

  for (var i = 0; i < customActions.length; i++) {
    var a = customActions[i];
    var idNum = parseInt(a.id);
    if (idNum && idNum.toString() === a.id && _idMap['custom_' + idNum]) {
      // 已有映射，更新
      await db.from('custom_actions')
        .update({ name: a.name, coins: a.coins })
        .eq('id', _idMap['custom_' + idNum]);
    } else if (a.id.indexOf('sys_') !== 0) {
      // 非系统预设，插入
      var ins = await db.from('custom_actions')
        .insert([{ class_id: firstClassSupaId, name: a.name, coins: a.coins }])
        .select('id')
        .single();
      if (ins.data) {
        _idMap['custom_' + ins.data.id] = ins.data.id;
        a.id = String(ins.data.id);
      }
    }
    // 系统预设 (sys_reward_1 等) 不推送到 Supabase
  }
  _saveIdMap();
}

// 推送新增的操作日志
async function _pushLogsToSupabase() {
  if (!currentUser) return;  // 学生和老师都要推送日志
  try {
    var unsyncedLogs = operationLogs.filter(function(log) {
      return typeof log.id === 'number' && log.id % 1 !== 0;
    });

    for (var i = 0; i < unsyncedLogs.length; i++) {
      var log = unsyncedLogs[i];
      var supaClassId = log.classId ? _getSupaClassId(log.classId) : null;
      var supaStudentId = log.studentId ? _getSupaStuId(log.classId, log.studentId) : null;

      // 如果映射不到，跳过
      if (!supaClassId) continue;

      var logData = {
        class_id: supaClassId,
        student_id: supaStudentId,
        student_name: log.studentName || '',
        action_type: log.actionType || '',
        details: log.details || '',
        coin_delta: log.coinDelta || 0,
        exp_delta: log.expDelta || 0,
        extra: log.extra || null,
        snapshot: log.snapshot || null
      };

      var ins = await db.from('operation_logs').insert([logData]).select('id').single();
      if (ins.data) {
        // 标记已同步（把本地 float id 改成 Supabase int id）
        var idx = operationLogs.indexOf(log);
        if (idx !== -1) {
          operationLogs[idx].id = ins.data.id;
        }
      }
    }

    if (unsyncedLogs.length > 0) {
      safeLSSave('operationLogs', operationLogs);
    }
  } catch (e) {
    console.warn('[DAL] pushLogs error:', e);
  }
}

// 推送操作日志归档
async function _pushArchiveToSupabase() {
  if (!currentUser) return;  // 学生和老师都要推送归档
  try {
    var archive = typeof operationLogArchive !== 'undefined' ? operationLogArchive : {};
    for (var month in archive) {
      var logs = archive[month];
      if (!logs || !Array.isArray(logs) || logs.length === 0) continue;
      
      // 按班级分组
      var byClass = {};
      logs.forEach(function(log) {
        var classId = log.classId || 'unknown';
        if (!byClass[classId]) byClass[classId] = [];
        byClass[classId].push(log);
      });
      
      for (var localClassId in byClass) {
        var supaClassId = _getSupaClassId(localClassId);
        if (!supaClassId) continue;
        
        var data = {
          month: month,
          class_id: supaClassId,
          teacher_id: currentUser.id,
          data: JSON.stringify(byClass[localClassId])
        };
        
        // upsert
        await db.from('operation_log_archive')
          .upsert(data, { onConflict: 'month,class_id,teacher_id' });
      }
    }
    console.log('[DAL] Archive synced');
  } catch (e) {
    console.warn('[DAL] pushArchive error:', e);
  }
}

// 推送已删除班级
async function _pushDeletedClassesToSupabase() {
  if (!currentUser || currentUser.type !== 'teacher') return;
  try {
    var deleted = typeof deletedClasses !== 'undefined' ? deletedClasses : [];
    for (var i = 0; i < deleted.length; i++) {
      var cls = deleted[i];
      var data = {
        teacher_id: currentUser.id,
        class_name: cls.name || 'Unknown',
        data: JSON.stringify(cls)
      };
      
      await db.from('deleted_classes').insert([data]);
    }
    console.log('[DAL] Deleted classes synced:', deleted.length);
  } catch (e) {
    console.warn('[DAL] pushDeletedClasses error:', e);
  }
}

// ===== 导出所有数据到本地（U盘同步） =====
async function exportAllDataToUSB() {
  if (!currentUser || currentUser.type !== 'teacher') {
    alert('只有老师账号可以导出数据');
    return;
  }
  
  try {
    showNotification('正在导出数据...', '请稍候', 'info');
    
    // 1. 班级宠物数据
    var classPetData = classesData.map(function(cls) {
      return {
        id: cls.id,
        name: cls.name,
        students: cls.students.map(function(s) {
          return {
            id: s.id,
            name: s.name,
            coins: s.coins,
            shopItems: s.shopItems || [],
            equippedItems: s.equippedItems || {},
            lastCheckinDate: s.lastCheckinDate || null,
            lastJianghuDate: s.lastJianghuDate || null,
            activePetId: s.activePetId || null,
            pkCountToday: s.pkCountToday || 0,
            lastPkDate: s.lastPkDate || null,
            pets: (s.pets || []).map(function(p) {
              return {
                id: p.id,
                name: p.name,
                nickname: p.nickname,
                level: p.level,
                growth: p.growth,
                coins: p.coins,
                is_active: p.is_active,
                isDead: p.isDead,
                lastFeedDate: p.lastFeedDate,
                lastPlayDate: p.lastPlayDate,
                todayFeedCount: p.todayFeedCount,
                todayPlayCount: p.todayPlayCount,
                penaltyStreak: p.penaltyStreak
              };
            })
          };
        }),
        pauseGrowth: cls.pauseGrowth || null
      };
    });
    
    // 2. 奖惩设置
    var customActionsData = customActions.map(function(a) {
      return { id: a.id, name: a.name, coins: a.coins };
    });
    
    // 3. 操作日志
    var logsData = operationLogs.map(function(log) {
      return {
        id: log.id,
        timestamp: log.timestamp,
        classId: log.classId,
        studentId: log.studentId,
        studentName: log.studentName,
        actionType: log.actionType,
        details: log.details,
        coinDelta: log.coinDelta,
        expDelta: log.expDelta,
        petId: log.petId,
        extra: log.extra,
        snapshot: log.snapshot
      };
    });
    
    // 4. 操作日志归档
    var archiveData = typeof operationLogArchive !== 'undefined' ? operationLogArchive : {};
    
    // 5. 已删除班级
    var deletedData = typeof deletedClasses !== 'undefined' ? deletedClasses : [];
    
    // 创建下载
    var timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
    var folderName = '班级宠物数据备份_' + timestamp;
    
    // 下载每个文件
    _downloadJSON(folderName + '/班级宠物数据.json', classPetData);
    _downloadJSON(folderName + '/奖惩设置.json', customActionsData);
    _downloadJSON(folderName + '/操作日志.json', logsData);
    _downloadJSON(folderName + '/操作日志归档.json', archiveData);
    _downloadJSON(folderName + '/已删除班级.json', deletedData);
    
    // 6. 导出打包的完整备份文件（用于导入）
    var fullBackup = {
      version: 1,
      exportTime: new Date().toISOString(),
      teacherName: currentUser.name || 'unknown',
      classPetData: classPetData,
      customActions: customActionsData,
      operationLogs: logsData,
      operationLogArchive: archiveData,
      deletedClasses: deletedData
    };
    _downloadJSON('班级宠物完整备份_' + timestamp + '.json', fullBackup);
    
    // 下载说明
    var readme = '班级宠物数据备份\n';
    readme += '导出时间: ' + new Date().toLocaleString() + '\n';
    readme += '班级数量: ' + classPetData.length + '\n';
    readme += '操作日志: ' + logsData.length + ' 条\n';
    readme += '\n【导入方法】\n';
    readme += '只需选择 "班级宠物完整备份_' + timestamp + '.json" 文件即可恢复所有数据。\n';
    readme += '\n【手动恢复】\n';
    readme += '将此文件夹中的 5 个 JSON 文件复制到项目根目录的 数据/ 文件夹下。\n';
    _downloadJSON(folderName + '/README.txt', readme);
    
    showNotification('导出成功', '数据已保存到下载文件夹', 'success');
  } catch (e) {
    console.error('[DAL] export error:', e);
    showNotification('导出失败', e.message, 'error');
  }
}

// ===== 从本地文件导入数据（支持多文件） =====
function importDataFromUSB() {
  if (!currentUser || currentUser.type !== 'teacher') {
    alert('只有老师账号可以导入数据');
    return;
  }
  
  // 创建文件选择器（支持多选）
  var input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.multiple = true;  // 允许多选
  input.onchange = function(e) {
    var files = e.target.files;
    if (!files || files.length === 0) return;
    
    // 读取所有文件
    var fileReaders = [];
    var loadedFiles = [];
    var loadCount = 0;
    var totalCount = files.length;
    
    for (var i = 0; i < totalCount; i++) {
      (function(file) {
        var reader = new FileReader();
        reader.onload = function(evt) {
          try {
            var data = JSON.parse(evt.target.result);
            loadedFiles.push({
              name: file.name,
              data: data
            });
          } catch (err) {
            console.warn('[DAL] Failed to parse file:', file.name, err);
            loadedFiles.push({
              name: file.name,
              data: null,
              error: err.message
            });
          }
          loadCount++;
          if (loadCount === totalCount) {
            _processImportedFiles(loadedFiles);
          }
        };
        reader.readAsText(file);
      })(files[i]);
    }
  };
  input.click();
}

// 处理导入的多个文件
function _processImportedFiles(loadedFiles) {
  // 检查是否有完整备份文件
  var fullBackup = null;
  for (var i = 0; i < loadedFiles.length; i++) {
    var file = loadedFiles[i];
    if (file.data && file.data.version === 1 && file.data.classPetData) {
      fullBackup = file;
      break;
    }
  }
  
  // 如果有完整备份文件，直接使用它
  if (fullBackup) {
    _confirmImportFullBackup(fullBackup.data);
    return;
  }
  
  // 否则，尝试从多个独立文件组合数据
  var combinedData = {
    classPetData: null,
    customActions: null,
    operationLogs: null,
    operationLogArchive: null,
    deletedClasses: null
  };
  
  var successFiles = [];
  var errorFiles = [];
  
  loadedFiles.forEach(function(file) {
    if (!file.data) {
      errorFiles.push(file.name);
      return;
    }
    
    var name = file.name.toLowerCase();
    
    // 根据文件名识别数据类型
    if (name.indexOf('班级宠物数据') !== -1 && Array.isArray(file.data)) {
      combinedData.classPetData = file.data;
      successFiles.push(file.name);
    } else if (name.indexOf('奖惩设置') !== -1 && Array.isArray(file.data)) {
      combinedData.customActions = file.data;
      successFiles.push(file.name);
    } else if (name.indexOf('操作日志归档') !== -1 && typeof file.data === 'object') {
      combinedData.operationLogArchive = file.data;
      successFiles.push(file.name);
    } else if (name.indexOf('操作日志') !== -1 && Array.isArray(file.data)) {
      combinedData.operationLogs = file.data;
      successFiles.push(file.name);
    } else if (name.indexOf('已删除班级') !== -1 && Array.isArray(file.data)) {
      combinedData.deletedClasses = file.data;
      successFiles.push(file.name);
    } else if (Array.isArray(file.data)) {
      // 未知格式的数组，尝试作为班级数据处理
      combinedData.classPetData = file.data;
      successFiles.push(file.name);
    } else {
      errorFiles.push(file.name);
    }
  });
  
  // 如果有任何错误文件，提示用户
  if (errorFiles.length > 0) {
    console.warn('[DAL] Some files could not be parsed:', errorFiles);
  }
  
  // 检查是否有有效数据
  if (!combinedData.classPetData && !combinedData.customActions && 
      !combinedData.operationLogs && !combinedData.operationLogArchive) {
    alert('没有识别到有效的数据文件。\n\n支持的格式：\n• 班级宠物完整备份_xxx.json\n• 班级宠物数据.json\n• 奖惩设置.json\n• 操作日志.json\n• 操作日志归档.json\n• 已删除班级.json');
    return;
  }
  
  // 确认导入
  _confirmImportCombinedData(combinedData, successFiles);
}

// 确认导入组合数据
function _confirmImportCombinedData(data, fileNames) {
  var classCount = data.classPetData ? data.classPetData.length : 0;
  var studentCount = 0;
  if (data.classPetData) {
    data.classPetData.forEach(function(cls) {
      studentCount += (cls.students || []).length;
    });
  }
  var logCount = data.operationLogs ? data.operationLogs.length : 0;
  
  var msg = '即将导入以下文件的数据：\n\n';
  fileNames.forEach(function(name) {
    msg += '• ' + name + '\n';
  });
  msg += '\n数据概要：\n';
  if (classCount > 0) {
    msg += '• 班级数量: ' + classCount + '\n';
    msg += '• 学生数量: ' + studentCount + '\n';
  }
  if (logCount > 0) {
    msg += '• 操作日志: ' + logCount + ' 条\n';
  }
  if (data.customActions) {
    msg += '• 奖惩设置: ' + data.customActions.length + ' 项\n';
  }
  msg += '\n⚠️ 导入后对应数据将被完全替换。\n';
  msg += '确认导入吗？';
  
  if (confirm(msg)) {
    _executeImportCombinedData(data);
  }
}

// 执行导入组合数据
async function _executeImportCombinedData(data) {
  try {
    showNotification('正在导入数据...', '请稍候', 'info');
    
    // 清空已删除班级追踪（导入数据为最新标准）
    _deletedSupaClassIds = {};
    _saveDeletedClassIds();
    
    // 替换各类数据
    if (data.classPetData && Array.isArray(data.classPetData)) {
      classesData = data.classPetData;
    }
    if (data.customActions && Array.isArray(data.customActions)) {
      customActions = data.customActions;
    }
    if (data.operationLogs && Array.isArray(data.operationLogs)) {
      operationLogs = data.operationLogs;
    }
    if (data.operationLogArchive) {
      if (typeof operationLogArchive !== 'undefined') {
        Object.keys(operationLogArchive).forEach(function(k) { delete operationLogArchive[k]; });
        Object.assign(operationLogArchive, data.operationLogArchive);
      }
    }
    if (data.deletedClasses && Array.isArray(data.deletedClasses)) {
      if (typeof deletedClasses !== 'undefined') {
        deletedClasses.length = 0;
        data.deletedClasses.forEach(function(c) { deletedClasses.push(c); });
      }
    }
    
    // 保存到 localStorage
    safeLSSave('classPetData', classesData);
    safeLSSave('customActions', customActions);
    safeLSSave('operationLogs', operationLogs);
    if (typeof operationLogArchive !== 'undefined') {
      safeLSSave('operationLogArchive', operationLogArchive);
    }
    if (typeof deletedClasses !== 'undefined') {
      safeLSSave('deletedClasses', deletedClasses);
    }
    
    // 清空 ID 映射，让后续同步重新建立
    _idMap = { students: {}, pets: {}, classes: {} };
    _saveIdMap();
    
    // 同步到 Supabase
    await _syncToSupabase();
    
    // 重新渲染页面
    if (typeof init === 'function') {
      currentClassId = classesData.length > 0 ? classesData[0].id : null;
      init();
    }
    
    showNotification('导入成功', '数据已恢复并同步到云端', 'success');
  } catch (e) {
    console.error('[DAL] import error:', e);
    showNotification('导入失败', e.message, 'error');
  }
}

// 确认导入完整备份
function _confirmImportFullBackup(data) {
  var classCount = data.classPetData ? data.classPetData.length : 0;
  var studentCount = 0;
  if (data.classPetData) {
    data.classPetData.forEach(function(cls) {
      studentCount += (cls.students || []).length;
    });
  }
  var logCount = data.operationLogs ? data.operationLogs.length : 0;
  
  var msg = '即将导入数据：\n\n';
  msg += '• 班级数量: ' + classCount + '\n';
  msg += '• 学生数量: ' + studentCount + '\n';
  msg += '• 操作日志: ' + logCount + ' 条\n';
  if (data.exportTime) {
    msg += '• 导出时间: ' + new Date(data.exportTime).toLocaleString() + '\n';
  }
  msg += '\n⚠️ 导入后当前数据将被完全替换为导入的数据。\n';
  msg += '确认导入吗？';
  
  if (confirm(msg)) {
    _executeImportFullBackup(data);
  }
}

// 执行导入完整备份（直接替换所有数据）
async function _executeImportFullBackup(data) {
  try {
    showNotification('正在导入数据...', '请稍候', 'info');
    
    // 清空已删除班级追踪（导入数据为最新标准）
    _deletedSupaClassIds = {};
    _saveDeletedClassIds();
    
    // 直接用导入数据替换所有现有数据
    if (data.classPetData && Array.isArray(data.classPetData)) {
      classesData = data.classPetData;
    }
    if (data.customActions && Array.isArray(data.customActions)) {
      customActions = data.customActions;
    }
    if (data.operationLogs && Array.isArray(data.operationLogs)) {
      operationLogs = data.operationLogs;
    }
    if (data.operationLogArchive) {
      if (typeof operationLogArchive !== 'undefined') {
        // 清空后赋值
        Object.keys(operationLogArchive).forEach(function(k) { delete operationLogArchive[k]; });
        Object.assign(operationLogArchive, data.operationLogArchive);
      }
    }
    if (data.deletedClasses && Array.isArray(data.deletedClasses)) {
      if (typeof deletedClasses !== 'undefined') {
        deletedClasses.length = 0;
        data.deletedClasses.forEach(function(c) { deletedClasses.push(c); });
      }
    }
    
    // 保存到 localStorage
    safeLSSave('classPetData', classesData);
    safeLSSave('customActions', customActions);
    safeLSSave('operationLogs', operationLogs);
    if (typeof operationLogArchive !== 'undefined') {
      safeLSSave('operationLogArchive', operationLogArchive);
    }
    if (typeof deletedClasses !== 'undefined') {
      safeLSSave('deletedClasses', deletedClasses);
    }
    
    // 清空 ID 映射，让后续同步重新建立
    _idMap = { students: {}, pets: {}, classes: {} };
    _saveIdMap();
    
    // 同步到 Supabase
    await _syncToSupabase();
    
    // 重新渲染页面
    if (typeof init === 'function') {
      currentClassId = classesData.length > 0 ? classesData[0].id : null;
      init();
    }
    
    showNotification('导入成功', '数据已恢复并同步到云端', 'success');
  } catch (e) {
    console.error('[DAL] import error:', e);
    showNotification('导入失败', e.message, 'error');
  }
}

// 确认导入纯班级数据格式（兼容旧格式）
function _confirmImportClassData(data) {
  var classCount = data.length;
  var studentCount = 0;
  data.forEach(function(cls) {
    studentCount += (cls.students || []).length;
  });
  
  var msg = '检测到旧格式备份文件\n\n';
  msg += '即将导入数据：\n';
  msg += '• 班级数量: ' + classCount + '\n';
  msg += '• 学生数量: ' + studentCount + '\n';
  msg += '\n⚠️ 导入后当前班级数据将被完全替换。\n';
  msg += '确认导入吗？';
  
  if (confirm(msg)) {
    _executeImportClassData(data);
  }
}

// 执行导入纯班级数据（直接替换）
async function _executeImportClassData(data) {
  try {
    showNotification('正在导入数据...', '请稍候', 'info');
    
    // 清空已删除班级追踪（导入数据为最新标准）
    _deletedSupaClassIds = {};
    _saveDeletedClassIds();
    
    // 直接替换
    classesData = data;
    
    safeLSSave('classPetData', classesData);
    
    // 清空 ID 映射
    _idMap = { students: {}, pets: {}, classes: {} };
    _saveIdMap();
    
    await _syncToSupabase();
    
    if (typeof init === 'function') {
      currentClassId = classesData.length > 0 ? classesData[0].id : null;
      init();
    }
    
    showNotification('导入成功', '数据已恢复并同步到云端', 'success');
  } catch (e) {
    console.error('[DAL] import error:', e);
    showNotification('导入失败', e.message, 'error');
  }
}

function _downloadJSON(filename, data) {
  var content = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  var blob = new Blob([content], { type: 'application/json' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = filename.split('/').pop();
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ===== 主同步函数（防抖） =====
async function _syncToSupabase() {
  if (!db || !currentUser) return;
  if (_dalSyncing) {
    _dalSyncQueued = true;
    return;
  }
  _dalSyncing = true;

  // 更新云端同步状态
  if (typeof _updateCloudStatus === 'function') _updateCloudStatus('syncing');

  try {
    if (currentUser.type === 'student') {
      // 学生模式：只同步自己的宠物数据和操作日志
      await _syncStudentToSupabase();
    } else {
      // 老师模式：同步全部班级数据
      for (var i = 0; i < classesData.length; i++) {
        await _pushClassToSupabase(classesData[i]);
      }

      // 删除 Supabase 中已不存在的班级
      // 直接查 Supabase 全部班级，与本地 classesData 对比
      var allResult = await db.from('classes')
        .select('id')
        .eq('teacher_id', currentUser.id);
      if (allResult.data) {
        // 本地保留的 Supabase 班级 ID 集合
        var keptSupaIds = {};
        classesData.forEach(function(c) {
          var sid = _getSupaClassId(c.id);
          if (sid) keptSupaIds[sid] = true;
        });
        for (var j = 0; j < allResult.data.length; j++) {
          var sid = allResult.data[j].id;
          if (!keptSupaIds[sid]) {
            // 这个班级在本地已删除，从 Supabase 彻底删除
            console.log('[DAL] Deleting orphaned Supabase class:', sid);

            // 先查出该班级下所有学生 ID（避免用子查询删除，那个会静默失败）
            var orphanStus = await db.from('students')
              .select('id')
              .eq('class_id', sid);
            if (orphanStus.data && orphanStus.data.length > 0) {
              var orphanStuIds = orphanStus.data.map(function(s) { return s.id; });
              // 分批删除宠物（in 查询有长度限制）
              for (var b = 0; b < orphanStuIds.length; b += 50) {
                var batch = orphanStuIds.slice(b, b + 50);
                var petDel = await db.from('pets').in('student_id', batch).delete();
                if (petDel.error) console.warn('[DAL] delete orphan pets:', petDel.error);
              }
            }
            var stuDel = await db.from('students').eq('class_id', sid).delete();
            if (stuDel.error) console.warn('[DAL] delete orphan students:', stuDel.error);
            var clsDel = await db.from('classes').eq('id', sid).delete();
            if (clsDel.error) console.warn('[DAL] delete orphan class:', clsDel.error);

            // 无论删除是否成功，都记录到已删除列表
            // 这样下次 loadFromSupabase 不会把它拉回来
            _markClassDeleted(sid);

            // 清理对应的 ID 映射
            Object.keys(_idMap.classes).forEach(function(key) {
              if (_idMap.classes[key] === sid) delete _idMap.classes[key];
            });
            _saveIdMap();
          }
        }
      }

      await _pushCustomActionsToSupabase();
      await _pushLogsToSupabase();
      await _pushArchiveToSupabase();
      await _pushDeletedClassesToSupabase();
    }

    console.log('[DAL] Synced to Supabase');
    if (typeof _updateCloudStatus === 'function') _updateCloudStatus('synced');
  } catch (e) {
    console.error('[DAL] sync error:', e);
    if (typeof _updateCloudStatus === 'function') _updateCloudStatus('error');
  } finally {
    _dalSyncing = false;
    if (_dalSyncQueued) {
      _dalSyncQueued = false;
      _syncToSupabase();
    }
  }
}

// ===== 学生模式：同步自己的宠物数据到 Supabase =====
async function _syncStudentToSupabase() {
  var studentId = parseInt(localStorage.getItem('studentId'));
  if (!studentId) {
    console.warn('[DAL] Student sync: no studentId in localStorage');
    return;
  }

  // 在 classesData 中找到自己
  var classObj = classesData[0];
  if (!classObj) return;
  var student = classObj.students.find(function(s) {
    return s.id.toString() === studentId.toString();
  });
  if (!student) return;

  console.log('[DAL] Student syncing data for:', student.name);

  // 1. 先获取 Supabase 当前数据，然后合并（防止覆盖）
  var fetchResult = await db.from('students')
    .select('id, coins, shop_items, equipped_items, last_checkin_date, last_jianghu_date, active_pet_id, pk_count_today, last_pk_date')
    .eq('id', studentId)
    .single();
  
  var merged = _mergeStudentData(student, fetchResult.data);

  // 2. 同步学生数据（包含特效、打卡、PK等）
  var stuUpd = await db.from('students')
    .update({
      coins: merged.coins,
      shop_items: JSON.stringify(merged.shopItems || []),
      equipped_items: JSON.stringify(merged.equippedItems || {}),
      last_checkin_date: merged.lastCheckinDate || null,
      last_jianghu_date: merged.lastJianghuDate || null,
      active_pet_id: merged.activePetId || null,
      pk_count_today: merged.pkCountToday || 0,
      last_pk_date: merged.lastPkDate || null
    })
    .eq('id', studentId);
  if (stuUpd.error) console.warn('[DAL] Student sync: update error:', stuUpd.error);

  // 2. 同步每只宠物
  for (var k = 0; k < (student.pets || []).length; k++) {
    var pet = student.pets[k];
    var petData = {
      name: pet.name,
      nickname: pet.nickname || pet.name,
      level: pet.level || 1,
      growth: pet.growth || 0,
      coins: pet.coins || 0,
      is_active: pet.is_active !== false,
      is_dead: pet.isDead || false,
      last_feed_date: pet.lastFeedDate || null,
      last_play_date: pet.lastPlayDate || null,
      today_feed_count: pet.todayFeedCount || 0,
      today_play_count: pet.todayPlayCount || 0,
      penalty_streak: pet.penaltyStreak || 0
    };

    // 宠物 ID 映射：从 Supabase 加载时用的是真实整数 ID
    var supaPetId = pet.id;
    if (supaPetId && typeof supaPetId === 'number' && supaPetId % 1 === 0) {
      var petUpd = await db.from('pets').update(petData).eq('id', supaPetId);
      if (petUpd.error) console.warn('[DAL] Student sync: update pet error:', petUpd.error);
      else console.log('[DAL] Student sync: pet', pet.name, 'synced');
    } else {
      console.warn('[DAL] Student sync: pet', pet.name, 'has no valid Supabase ID, skipping');
    }
  }

  // 推送操作日志（学生操作也要记录）
  await _pushLogsToSupabase();
  await _pushArchiveToSupabase();

  console.log('[DAL] Student sync complete');
}

// ===== 包装 app.js 的保存函数 =====
// 原来的 saveClassData/saveCustomActions/saveLogs 保存到 localStorage + 调用 scheduleFileSave（已禁用）
// 包装后：每次保存自动同步到 Supabase 云端
function wrapSaveFunctions() {
  if (typeof saveClassData === 'function' && !saveClassData._dalWrapped) {
    var _origSaveClass = saveClassData;
    saveClassData = function() {
      _origSaveClass();  // localStorage 缓存
      if (typeof _updateCloudStatus === 'function') _updateCloudStatus('syncing');
      _syncToSupabase();  // 云端同步
    };
    saveClassData._dalWrapped = true;
  }

  if (typeof saveCustomActions === 'function' && !saveCustomActions._dalWrapped) {
    var _origSaveActions = saveCustomActions;
    saveCustomActions = function() {
      _origSaveActions();
      if (typeof _updateCloudStatus === 'function') _updateCloudStatus('syncing');
      _syncToSupabase();
    };
    saveCustomActions._dalWrapped = true;
  }

  if (typeof saveLogs === 'function' && !saveLogs._dalWrapped) {
    var _origSaveLogs = saveLogs;
    saveLogs = function() {
      _origSaveLogs();
      if (typeof _updateCloudStatus === 'function') _updateCloudStatus('syncing');
      _syncToSupabase();
    };
    saveLogs._dalWrapped = true;
  }

  if (typeof saveDeletedClasses === 'function' && !saveDeletedClasses._dalWrapped) {
    var _origSaveDel = saveDeletedClasses;
    saveDeletedClasses = function() {
      _origSaveDel();
      // deletedClasses 暂不同步到 Supabase（无对应表）
    };
    saveDeletedClasses._dalWrapped = true;
  }

  console.log('[DAL] Save functions wrapped — all changes sync to Supabase cloud');
}

// ===== DAL 初始化入口 =====
async function initDAL() {
  if (_dalReady) return;
  if (!db || !currentUser) {
    console.warn('[DAL] No db or currentUser, retrying...');
    setTimeout(initDAL, 1000);
    return;
  }

  _loadIdMap();
  _loadDeletedClassIds();

  // 清理30天前的已删除记录（防止无限增长）
  var thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  var cleaned = false;
  Object.keys(_deletedSupaClassIds).forEach(function(id) {
    if (_deletedSupaClassIds[id] < thirtyDaysAgo) {
      delete _deletedSupaClassIds[id];
      cleaned = true;
    }
  });
  if (cleaned) _saveDeletedClassIds();

  console.log('[DAL] Initializing for', currentUser.type, currentUser.id);

  // 从 Supabase 加载数据（云端优先）
  if (typeof _updateCloudStatus === 'function') _updateCloudStatus('syncing');
  var loaded = await loadFromSupabase();

  if (loaded) {
    console.log('[DAL] Data loaded from Supabase, re-rendering...');
    if (typeof _updateCloudStatus === 'function') _updateCloudStatus('synced');
    // 重新初始化 app 渲染
    if (typeof init === 'function') {
      currentClassId = classesData.length > 0 ? classesData[0].id : null;
      init();
    }
  } else {
    console.log('[DAL] No data in Supabase, checking localStorage for initial sync...');
    if (typeof _updateCloudStatus === 'function') _updateCloudStatus('syncing');

    // 如果 Supabase 为空但 localStorage 有旧数据，立即推送到云端
    if (currentUser.type === 'teacher' && classesData.length > 0) {
      console.log('[DAL] Found', classesData.length, 'classes in localStorage, pushing to Supabase...');
      try {
        // 先测试 Supabase 连接是否正常
        var testResult = await db.from('classes').select('id').limit(1);
        if (testResult.error) {
          console.error('[DAL] Supabase connection test failed:', testResult.error);
          showNotification('云端同步失败', '请检查 Supabase 表是否已创建', 'error');
          if (typeof _updateCloudStatus === 'function') _updateCloudStatus('error');
        } else {
          for (var i = 0; i < classesData.length; i++) {
            console.log('[DAL] Pushing class', i + 1, '/', classesData.length, ':', classesData[i].name);
            await _pushClassToSupabase(classesData[i]);
          }
          await _pushCustomActionsToSupabase();
          await _pushLogsToSupabase();
          console.log('[DAL] Initial sync complete — localStorage data pushed to Supabase');
          if (typeof _updateCloudStatus === 'function') _updateCloudStatus('synced');
        }
      } catch (e) {
        console.error('[DAL] Initial sync failed:', e);
        if (typeof _updateCloudStatus === 'function') _updateCloudStatus('error');
      }
    } else {
      if (typeof _updateCloudStatus === 'function') _updateCloudStatus('');
    }
  }

  // 包装保存函数（使每次保存自动同步到 Supabase）
  wrapSaveFunctions();

  // 学生模式限制
  applyStudentRestrictions();

  _dalReady = true;
  console.log('[DAL] Ready — data source: Supabase cloud (即时同步模式)');

  // 仅注册页面关闭/隐藏时的同步（不再使用定时同步）
  _setupCloseSync();
}

// ===== 学生模式：隐藏老师专属 UI =====
function applyStudentRestrictions() {
  if (!currentUser || currentUser.type !== 'student') return;
  console.log('[DAL] Applying student restrictions for:', currentUser.studentName);

  // 隐藏老师专属按钮
  var teacherOnlySelectors = [
    '.class-actions',           // 新建班级、导入名单、学生列表
    '.data-mgmt-btn',           // 全班喂食、全班打卡、批量奖惩、停喂保护、奖惩管理、宠物商店
    '.delete-class-btn',        // 删除班级按钮
    '.home-stat',               // 重置班级宠物、历史操作
  ];

  teacherOnlySelectors.forEach(function(sel) {
    document.querySelectorAll(sel).forEach(function(el) {
      el.style.display = 'none';
    });
  });

  // 隐藏宠物商店按钮（特殊样式）
  document.querySelectorAll('button[onclick*="showPetShopBrowse"]').forEach(function(el) {
    el.style.display = 'none';
  });

  // 隐藏"已删除班级"链接
  document.querySelectorAll('[onclick*="showDeletedClassesModal"]').forEach(function(el) {
    el.style.display = 'none';
  });

  // 限制学生只能操作自己的宠物（在 openStudentModal 中检查）
  var _origOpenStudentModal = window.openStudentModal;
  window.openStudentModal = function(studentId) {
    if (currentUser.type === 'student' && studentId.toString() !== currentUser.studentId.toString()) {
      // 学生查看其他同学 — 只展示信息，不给操作
      var cur = classesData.find(function(c){ return c.id === currentClassId; });
      if (!cur) return;
      var student = cur.students.find(function(s){ return s.id.toString() === studentId.toString(); });
      if (!student) return;
      var activePet = typeof getActivePet === 'function' ? getActivePet(student) : null;
      var content = '<div style="text-align:center;">';
      content += '<div style="font-size:18px;font-weight:700;margin-bottom:10px;">' + escapeHTML(student.name) + '</div>';
      content += '<div>💰 ' + student.coins + ' 金币</div>';
      if (activePet) {
        content += '<div style="margin-top:10px;">🐾 ' + escapeHTML(activePet.nickname || activePet.name) + ' Lv.' + activePet.level + '</div>';
      }
      content += '</div>';
      if (typeof showModal === 'function') {
        showModal(student.name + ' 的信息', content, [{text:'关闭', onclick:'closeModal()'}]);
      }
      return;
    }
    return _origOpenStudentModal(studentId);
  };
}

// ===== 移除定时同步，改为每次操作立即同步 =====
// 不再使用30秒定时器，所有操作都会立即触发同步
// 保存函数已被包装（wrapSaveFunctions），每次保存都会同步到 Supabase

// ===== 页面关闭/隐藏时立即同步 =====
function _setupCloseSync() {
  // 页面关闭前同步
  window.addEventListener('beforeunload', function() {
    if (currentUser) {
      console.log('[DAL] Page closing, syncing...');
      _syncToSupabase();
    }
  });

  // 页面隐藏时同步（切换标签页、最小化等）
  document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'hidden') {
      if (currentUser) {
        console.log('[DAL] Page hidden, syncing...');
        _syncToSupabase();
      }
    }
  });

  console.log('[DAL] Close-sync handlers registered');
}

// 启动 DAL 初始化
initDAL();
