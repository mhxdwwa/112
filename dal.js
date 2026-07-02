// ========== 数据访问层 (DAL) ==========
// 在 app.js 之后加载
// 负责 Supabase 与 localStorage 之间的数据同步
// =====================================================

var _dalReady = false;
var _dalSyncing = false;
var _dalSyncQueued = false;

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

      // 加载学生
      var stuResult = await db.from('students')
        .select('id, name, coins')
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
          lastCheckinDate: null,
          activePetId: null,
          pkCountToday: 0,
          lastPkDate: null
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

        // 设置 activePetId：优先 is_active，否则第一只
        var activePet = studentObj.pets.find(function(p) { return p.is_active; });
        if (activePet) {
          studentObj.activePetId = activePet.id;
        } else if (studentObj.pets.length > 0) {
          studentObj.activePetId = studentObj.pets[0].id;
        }

        classObj.students.push(studentObj);
      }

      newClassesData.push(classObj);
    }

    // 3. 写入全局变量
    classesData = newClassesData;
    _idMap = newIdMap;
    _saveIdMap();
    safeLSSave('classPetData', classesData);

    // 4. 加载 customActions
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
      .select('id, name, coins')
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
      lastCheckinDate: null, activePetId: null, pkCountToday: 0, lastPkDate: null
    };
    var activePet = pets.find(function(p) { return p.is_active; });
    if (activePet) studentObj.activePetId = activePet.id;
    else if (pets.length > 0) studentObj.activePetId = pets[0].id;

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
    var upd = await db.from('classes').update({ name: classObj.name }).eq('id', supaClassId);
    if (upd.error) console.warn('[DAL] update class:', upd.error);
  } else {
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

  if (supaStuId && typeof supaStuId === 'number' && supaStuId % 1 === 0) {
    var upd = await db.from('students')
      .update({ coins: stu.coins || 0 })
      .eq('id', supaStuId);
    if (upd.error) console.warn('[DAL] update student:', upd.error);
    return supaStuId;
  } else {
    var ins = await db.from('students')
      .insert([{ class_id: supaClassId, name: stu.name, password: '', coins: stu.coins || 0 }])
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
        // 更新 coins
        await db.from('students').update({ coins: stu.coins || 0 }).eq('id', supaStuId);
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
  if (!currentUser || currentUser.type !== 'teacher') return;
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

// ===== 主同步函数（防抖） =====
async function _syncToSupabase() {
  if (!db || !currentUser || currentUser.type !== 'teacher') return;
  if (_dalSyncing) {
    _dalSyncQueued = true;
    return;
  }
  _dalSyncing = true;

  // 更新云端同步状态
  if (typeof _updateCloudStatus === 'function') _updateCloudStatus('syncing');

  try {
    for (var i = 0; i < classesData.length; i++) {
      await _pushClassToSupabase(classesData[i]);
    }

    // 删除 Supabase 中已不存在的班级
    var supaClassIds = classesData.map(function(c) { return _getSupaClassId(c.id); }).filter(Boolean);
    if (supaClassIds.length > 0) {
      // 找出 Supabase 中有但本地没有的班级
      var allResult = await db.from('classes')
        .select('id')
        .eq('teacher_id', currentUser.id);
      if (allResult.data) {
        for (var j = 0; j < allResult.data.length; j++) {
          var sid = allResult.data[j].id;
          if (supaClassIds.indexOf(sid) === -1) {
            // 这个班级在本地已删除
            await db.from('pets').in('student_id',
              db.from('students').select('id').eq('class_id', sid)
            ).delete();
            await db.from('students').eq('class_id', sid).delete();
            await db.from('classes').eq('id', sid).delete();
          }
        }
      }
    }

    await _pushCustomActionsToSupabase();
    await _pushLogsToSupabase();

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
  console.log('[DAL] Ready — data source: Supabase cloud');

  // 启动定时自动同步和关闭同步
  _startAutoSync();
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

// ===== 定时自动同步（每30秒） =====
var _dalAutoSyncTimer = null;
var _dalSyncInterval = 30000; // 30秒

function _startAutoSync() {
  if (_dalAutoSyncTimer) clearInterval(_dalAutoSyncTimer);
  _dalAutoSyncTimer = setInterval(function() {
    if (currentUser && currentUser.type === 'teacher' && !_dalSyncing) {
      console.log('[DAL] Auto-sync triggered');
      _syncToSupabase();
    }
  }, _dalSyncInterval);
  console.log('[DAL] Auto-sync started (every', _dalSyncInterval / 1000, 'seconds)');
}

// ===== 页面关闭/隐藏时立即同步 =====
function _setupCloseSync() {
  // 页面关闭前同步
  window.addEventListener('beforeunload', function() {
    if (currentUser && currentUser.type === 'teacher') {
      console.log('[DAL] Page closing, syncing...');
      // 使用 sendBeacon 或同步请求（但 Supabase 不支持，所以只能尽力而为）
      _syncToSupabase();
    }
  });

  // 页面隐藏时同步（切换标签页、最小化等）
  document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'hidden') {
      if (currentUser && currentUser.type === 'teacher') {
        console.log('[DAL] Page hidden, syncing...');
        _syncToSupabase();
      }
    }
  });

  console.log('[DAL] Close-sync handlers registered');
}

// 启动 DAL 初始化
initDAL();
