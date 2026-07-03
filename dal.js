// ========== 数据访问层 (DAL) ==========
// 在 app.js 之后加载
// 负责 Supabase 与 localStorage 之间的数据同步
// =====================================================

// DAL 版本号 — 修改代码时必须更新
// 版本变化时自动清除 localStorage 中的旧缓存，防止旧数据覆盖云端
var _DAL_VERSION = '3.0';

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
  // 本地生成的ID >= 1e15（Date.now()*1000+counter），Supabase自增ID远小于此
  // 同时兼容旧版浮点ID（id % 1 !== 0）
  return typeof id === 'number' && (id % 1 !== 0 || id >= 1e15);
}

// 安全整数转换：确保写入 Supabase 的值是有效整数
function _safeInt(val) {
  if (val === null || val === undefined) return null;
  var n = Number(val);
  if (isNaN(n) || !isFinite(n)) return null;
  return Math.floor(n);
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

// ===== 智能合并学生数据（本地数据永远优先） =====
// 合并策略：
// - shopItems: 取并集（两边都保留）
// - equippedItems: 合并对象，本地优先
// - coins: 本地优先（不用 Math.max，避免逆转购买）
// - pkCountToday: 本地优先
// - dates: 本地优先
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
  
  // coins: 本地数据永远优先（Math.max 会逆转购买操作）
  merged.coins = local.coins !== undefined ? local.coins : (supabase.coins || 0);
  
  // pkCountToday: 本地数据永远优先
  merged.pkCountToday = local.pkCountToday !== undefined ? local.pkCountToday : (supabase.pk_count_today || 0);
  
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
    console.log('[DAL] Supabase returned', supaClasses.length, 'classes for teacher', currentUser.id);
    if (supaClasses.length === 0) {
      console.log('[DAL] No classes in Supabase yet');
      return false;
    }
    // 打印所有班级名称（调试用）
    supaClasses.forEach(function(sc) {
      console.log('[DAL]   Class id=' + sc.id + ' name=' + sc.name);
    });

    // 不再使用 _deletedSupaClassIds 过滤 — 直接加载 Supabase 中所有班级
    // 已删除的班级由教师手动操作，不应被 localStorage 缓存误删
    // 清空历史遗留的错误标记（之前的 bug 导致有效班级被误标为已删除）
    if (Object.keys(_deletedSupaClassIds).length > 0) {
      console.log('[DAL] Clearing stale _deletedSupaClassIds:', Object.keys(_deletedSupaClassIds));
      _deletedSupaClassIds = {};
      _saveDeletedClassIds();
    }

    if (supaClasses.length === 0) {
      console.log('[DAL] No classes in Supabase for this teacher');
      return false;
    }

    // 去重：如果 Supabase 中有多个同名班级（之前 bug 创建的重复），只保留 ID 最小的
    var seenNames = {};
    var dedupedClasses = [];
    for (var di = 0; di < supaClasses.length; di++) {
      var dc = supaClasses[di];
      if (seenNames[dc.name]) {
        console.log('[DAL] Deduplicating same-name class in Supabase:', dc.id, dc.name, '- keeping lower ID');
        // 保留 ID 较小的，标记较大的为重复（但不删除，只是跳过）
      } else {
        seenNames[dc.name] = true;
        dedupedClasses.push(dc);
      }
    }
    supaClasses = dedupedClasses;

    var newClassesData = [];
    var newIdMap = { students: {}, pets: {}, classes: {} };

    // 2. 批量加载所有学生和宠物（避免 N+1 查询）
    var classIds = supaClasses.map(function(sc) { return sc.id; });
    classIds.forEach(function(id) { newIdMap.classes[String(id)] = id; });

    // 一次性加载所有班级学生
    // Supabase .in() 限制最多 30 个值，分批查询
    var allStudents = [];
    var BATCH_SIZE = 30;
    for (var bi = 0; bi < classIds.length; bi += BATCH_SIZE) {
      var batch = classIds.slice(bi, bi + BATCH_SIZE);
      var stuResult = await db.from('students')
        .select('id, class_id, name, coins, shop_items, equipped_items, last_checkin_date, last_jianghu_date, active_pet_id, pk_count_today, last_pk_date')
        .in('class_id', batch)
        .order('id', { ascending: true });
      if (stuResult.error) {
        console.error('[DAL] batch load students error:', stuResult.error);
      } else {
        allStudents = allStudents.concat(stuResult.data || []);
      }
    }

    // 按 class_id 分组学生
    var studentsByClass = {};
    allStudents.forEach(function(ss) {
      if (!studentsByClass[ss.class_id]) studentsByClass[ss.class_id] = [];
      studentsByClass[ss.class_id].push(ss);
    });

    // 一次性加载所有学生的宠物
    var allStudentIds = allStudents.map(function(s) { return s.id; });
    var allPets = [];
    if (allStudentIds.length > 0) {
      for (var bi2 = 0; bi2 < allStudentIds.length; bi2 += BATCH_SIZE) {
        var batch2 = allStudentIds.slice(bi2, bi2 + BATCH_SIZE);
        var petResult = await db.from('pets')
          .select('*')
          .in('student_id', batch2)
          .order('id', { ascending: true });
        if (petResult.error) {
          console.error('[DAL] batch load pets error:', petResult.error);
        } else {
          allPets = allPets.concat(petResult.data || []);
        }
      }
    }

    // 按 student_id 分组宠物
    var petsByStudent = {};
    allPets.forEach(function(sp) {
      if (!petsByStudent[sp.student_id]) petsByStudent[sp.student_id] = [];
      petsByStudent[sp.student_id].push(sp);
    });

    // 组装数据
    for (var i = 0; i < supaClasses.length; i++) {
      var sc = supaClasses[i];
      var classObj = {
        id: String(sc.id),
        name: sc.name,
        students: [],
        pauseGrowth: null
      };

      var classStudents = studentsByClass[sc.id] || [];
      for (var j = 0; j < classStudents.length; j++) {
        var ss = classStudents[j];
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

        var studentPets = petsByStudent[ss.id] || [];
        for (var k = 0; k < studentPets.length; k++) {
          var sp = studentPets[k];
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

    // 3. Supabase 是数据源（source of truth），不使用 localStorage 覆盖
    // localStorage 仅用于补充 Supabase 中尚未存在的新学生（还没同步上去的）
    if (localData && Array.isArray(localData)) {
      var localLookup = {};
      localData.forEach(function(lc) {
        localLookup[lc.name] = {};
        (lc.students || []).forEach(function(ls) {
          localLookup[lc.name][ls.name] = ls;
        });
      });

      // 仅补充 Supabase 中没有的学生（本地有、云端没有 → 尚未同步）
      newClassesData.forEach(function(nc) {
        var localClass = localLookup[nc.name];
        if (!localClass) return;
        
        var supaStudentNames = {};
        nc.students.forEach(function(ns) { supaStudentNames[ns.name] = true; });
        
        Object.keys(localClass).forEach(function(stuName) {
          if (supaStudentNames[stuName]) return;  // Supabase 已有，不覆盖
          
          var ls = localClass[stuName];
          var newStu = {
            id: ls.id,
            name: ls.name,
            coins: ls.coins || 0,
            pets: (ls.pets || []).map(function(p) { return Object.assign({}, p); }),
            shopItems: ls.shopItems || [],
            equippedItems: ls.equippedItems || {},
            lastCheckinDate: ls.lastCheckinDate || null,
            lastJianghuDate: ls.lastJianghuDate || null,
            activePetId: ls.activePetId || null,
            pkCountToday: ls.pkCountToday || 0,
            lastPkDate: ls.lastPkDate || null
          };
          nc.students.push(newStu);
          console.log('[DAL] Added local-only student (not yet in Supabase):', stuName, 'in class:', nc.name);
        });
      });
      
      console.log('[DAL] Using Supabase as source of truth (no localStorage override)');
    }

    // 4. 写入全局变量
    classesData = newClassesData;
    _idMap = newIdMap;
    _saveIdMap();
    safeLSSave('classPetData', classesData);

    // 5. 并行加载 customActions、操作日志和归档
    await Promise.all([
      _loadCustomActionsFromSupabase(),
      _loadLogsFromSupabase(),
      _loadArchiveFromSupabase()
    ]);

    console.log('[DAL] Loaded from Supabase:', newClassesData.length, 'classes');
    // 验证：打印最终 classesData 的班级信息
    console.log('[DAL] Final classesData has', classesData.length, 'classes:', classesData.map(function(c) { return c.name + '(' + c.students.length + '人)'; }).join(', '));
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

    // 并行查询班级和学生信息（减少串行等待）
    var results = await Promise.all([
      db.from('classes').select('id, name').eq('id', classId).single(),
      db.from('students')
        .select('id, name, coins, shop_items, equipped_items, last_checkin_date, last_jianghu_date, active_pet_id, pk_count_today, last_pk_date')
        .eq('id', studentId)
        .single()
    ]);

    var classResult = results[0];
    var stuResult = results[1];

    if (classResult.error || !classResult.data) return false;
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
    
    // 学生端：不使用 localStorage 覆盖 Supabase 数据
    // Supabase 是 source of truth，确保学生看到的数据是最新的
    // localStorage 仅在完全离线时作为后备
    console.log('[DAL] Student data loaded from Supabase (source of truth)');
    
    // activePetId：优先 Supabase 值
    if (studentObj.activePetId && pets.some(function(p) { return Number(p.id) === Number(studentObj.activePetId); })) {
      // already set
    } else {
      var activePet = pets.find(function(p) { return p.is_active; });
      if (activePet) studentObj.activePetId = activePet.id;
      else if (pets.length > 0) studentObj.activePetId = pets[0].id;
    }

    // === 加载全班学生（学生端也能看到同学） ===
    var allStudents = [studentObj];
    var otherStudentsResult = await db.from('students')
      .select('id, name, coins, shop_items, equipped_items, last_checkin_date, last_jianghu_date, active_pet_id, pk_count_today, last_pk_date')
      .eq('class_id', classId)
      .neq('id', studentId);

    if (otherStudentsResult.data && otherStudentsResult.data.length > 0) {
      // 批量加载其他同学的宠物
      var otherStudentIds = otherStudentsResult.data.map(function(s) { return s.id; });
      var allPetsResult = await db.from('pets')
        .select('*')
        .in('student_id', otherStudentIds)
        .order('id', { ascending: true });

      // 按 student_id 分组宠物
      var petsByStudent = {};
      if (allPetsResult.data) {
        allPetsResult.data.forEach(function(sp) {
          if (!petsByStudent[sp.student_id]) petsByStudent[sp.student_id] = [];
          petsByStudent[sp.student_id].push({
            id: sp.id, name: sp.name, nickname: sp.nickname || sp.name,
            level: sp.level || 1, growth: sp.growth || 0, coins: sp.coins || 0,
            is_active: sp.is_active !== false, isDead: sp.is_dead || false,
            lastFeedDate: sp.last_feed_date, lastPlayDate: sp.last_play_date,
            todayFeedCount: sp.today_feed_count || 0, todayPlayCount: sp.today_play_count || 0,
            penaltyStreak: sp.penalty_streak || 0
          });
        });
      }

      // 构建其他同学的 student 对象
      otherStudentsResult.data.forEach(function(os) {
        var otherPets = petsByStudent[os.id] || [];
        var otherObj = {
          id: os.id, name: os.name, coins: os.coins || 0, pets: otherPets,
          shopItems: _parseJsonb(os.shop_items, []),
          equippedItems: _parseJsonb(os.equipped_items, {}),
          lastCheckinDate: os.last_checkin_date || null,
          lastJianghuDate: os.last_jianghu_date || null,
          activePetId: os.active_pet_id || null,
          pkCountToday: os.pk_count_today || 0,
          lastPkDate: os.last_pk_date || null
        };
        // activePetId 回退逻辑
        if (otherObj.activePetId && otherPets.some(function(p) { return Number(p.id) === Number(otherObj.activePetId); })) {
          // keep
        } else if (otherPets.length > 0) {
          var ap = otherPets.find(function(p) { return p.is_active; });
          otherObj.activePetId = ap ? ap.id : otherPets[0].id;
        }
        allStudents.push(otherObj);
        // ID 映射
        _idMap.students[_stuKey(String(classResult.data.id), os.id)] = os.id;
        otherPets.forEach(function(p) {
          _idMap.pets[_petKey(String(classResult.data.id), os.id, p.id)] = p.id;
        });
      });
    }

    // 构建 classesData，包含全班学生
    classesData = [{
      id: String(classResult.data.id),
      name: classResult.data.name,
      students: allStudents,
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

    console.log('[DAL] Student loaded from Supabase, class has', allStudents.length, 'students');
    return true;
  } catch (e) {
    console.error('[DAL] loadStudent error:', e);
    return false;
  }
}

// ===== Supabase Realtime 订阅 + 定时轮询 =====
var _realtimeChannel = null;
var _refreshTimer = null;
var _lastRefreshTime = 0;
var _refreshInterval = 3000;  // 每3秒轮询一次（兜底 Realtime）

// 教师端：从 Supabase 重新加载最新数据（不覆盖 Supabase 数据）
async function _refreshFromSupabase() {
  if (!db || !currentUser) return;
  var now = Date.now();
  if (now - _lastRefreshTime < _refreshInterval) return;  // 防抖
  _lastRefreshTime = now;

  try {
    if (currentUser.type === 'student') {
      await _loadStudentFromSupabase();
    } else {
      // 教师端：直接重新查询 Supabase（复用 loadFromSupabase 逻辑）
      await loadFromSupabase();
    }
    // 重新渲染
    if (typeof init === 'function') {
      // 保持当前班级选择不变
      var savedClassId = currentClassId;
      init();
      // 恢复之前的班级选择
      if (savedClassId && classesData.some(function(c) { return c.id === savedClassId; })) {
        currentClassId = savedClassId;
      } else if (classesData.length > 0) {
        currentClassId = classesData[0].id;
      }
      // 重新渲染班级列表和宠物网格
      if (typeof renderClassList === 'function') renderClassList();
      if (typeof scheduleAllRenders === 'function') scheduleAllRenders();
    }
  } catch (e) {
    console.warn('[DAL] refresh error:', e);
  }
}

// 设置 Realtime 订阅（监听 classes、students 和 pets 表变更）
function _setupRealtimeSubscriptions() {
  if (!db || !currentUser) return;
  if (_realtimeChannel) return;  // 已设置

  try {
    // Supabase Realtime: 监听 classes、pets、students 表变更
    _realtimeChannel = db.channel('dal-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'classes'
      }, function(payload) {
        console.log('[DAL Realtime] classes changed:', payload.eventType, payload.new?.id || payload.old?.id);
        _lastRefreshTime = 0;  // 立即允许刷新
        _refreshFromSupabase();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'pets'
      }, function(payload) {
        console.log('[DAL Realtime] pets changed:', payload.eventType, payload.new?.id || payload.old?.id);
        _lastRefreshTime = 0;
        _refreshFromSupabase();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'students'
      }, function(payload) {
        console.log('[DAL Realtime] students changed:', payload.eventType, payload.new?.id || payload.old?.id);
        _lastRefreshTime = 0;
        _refreshFromSupabase();
      })
      .subscribe(function(status) {
        console.log('[DAL Realtime] subscription status:', status);
      });
  } catch (e) {
    console.warn('[DAL Realtime] setup failed (will use polling):', e);
  }

  // 定时轮询作为 Realtime 的后备方案
  if (_refreshTimer) clearInterval(_refreshTimer);
  _refreshTimer = setInterval(function() {
    _refreshFromSupabase();
  }, _refreshInterval);
  
  console.log('[DAL] Realtime + polling setup complete (interval:', _refreshInterval, 'ms)');
}

// 清理 Realtime 资源
function _cleanupRealtime() {
  if (_realtimeChannel) {
    try { db.removeChannel(_realtimeChannel); } catch (e) {}
    _realtimeChannel = null;
  }
  if (_refreshTimer) {
    clearInterval(_refreshTimer);
    _refreshTimer = null;
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

// 推送单个班级完整数据（批量优化版本）
async function _pushClassToSupabase(classObj) {
  var teacherId = currentUser.id;
  var supaClassId = _getSupaClassId(classObj.id);
  console.log('[DAL] _pushClass: teacherId=', teacherId, 'supaClassId=', supaClassId, 'students=', classObj.students.length);

  // 1. Upsert 班级（保持原有逻辑）
  if (supaClassId) {
    var checkResult = await db.from('classes').select('id').eq('id', supaClassId).eq('teacher_id', teacherId).maybeSingle();
    if (checkResult.data) {
      var upd = await db.from('classes').update({ name: classObj.name }).eq('id', supaClassId);
      if (upd.error) console.warn('[DAL] update class:', upd.error);
    } else {
      console.log('[DAL] Supabase class', supaClassId, 'no longer exists, re-inserting');
      delete _idMap.classes[String(classObj.id)];
      supaClassId = null;
    }
  }
  if (!supaClassId) {
    console.log('[DAL] No mapped supaClassId, checking for existing same-name class...');
    var findExisting = await db.from('classes')
      .select('id')
      .eq('teacher_id', teacherId)
      .eq('name', classObj.name)
      .maybeSingle();
    if (findExisting.data) {
      console.log('[DAL] Found existing class with same name, reusing id:', findExisting.data.id);
      supaClassId = findExisting.data.id;
      _idMap.classes[String(classObj.id)] = supaClassId;
      _saveIdMap();
      var upd = await db.from('classes').update({ name: classObj.name }).eq('id', supaClassId);
      if (upd.error) console.warn('[DAL] update reused class:', upd.error);
    } else {
      console.log('[DAL] No existing class found, inserting new:', classObj.name);
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
      _saveIdMap();
    }
  }

  // 2. 批量同步学生（替代逐个 upsert）
  console.log('[DAL] Batch syncing', classObj.students.length, 'students for class', classObj.name);
  
  // 2a. 一次性获取 Supabase 中该班级的所有现有学生
  var existingStusResult = await db.from('students')
    .select('id, name, coins, shop_items, equipped_items, last_checkin_date, last_jianghu_date, active_pet_id, pk_count_today, last_pk_date')
    .eq('class_id', supaClassId);
  var existingStusByName = {};
  if (existingStusResult.data) {
    existingStusResult.data.forEach(function(s) { existingStusByName[s.name] = s; });
  }
  
  // 2b. 分离需要插入和更新的学生
  var toInsert = [];
  var toUpdate = [];
  var supaStuIdMap = {}; // localStuId -> supaStuId
  
  for (var j = 0; j < classObj.students.length; j++) {
    var stu = classObj.students[j];
    var existingStu = existingStusByName[stu.name];
    
    if (existingStu) {
      // 已有记录，走更新
      var key = _stuKey(classObj.id, stu.id);
      _idMap.students[key] = existingStu.id;
      supaStuIdMap[stu.id] = existingStu.id;
      
      var merged = _mergeStudentData(stu, existingStu);
      toUpdate.push({
        id: existingStu.id,
        data: {
          coins: merged.coins,
          shop_items: JSON.stringify(merged.shopItems || []),
          equipped_items: JSON.stringify(merged.equippedItems || {}),
          last_checkin_date: merged.lastCheckinDate || null,
          last_jianghu_date: merged.lastJianghuDate || null,
          active_pet_id: merged.activePetId || null,
          pk_count_today: merged.pkCountToday || 0,
          last_pk_date: merged.lastPkDate || null
        }
      });
    } else {
      // 新学生，走插入
      toInsert.push({
        localId: stu.id,
        data: {
          class_id: supaClassId,
          name: stu.name,
          password: '',
          coins: stu.coins || 50,
          shop_items: JSON.stringify(stu.shopItems || []),
          equipped_items: JSON.stringify(stu.equippedItems || {}),
          last_checkin_date: stu.lastCheckinDate || null,
          last_jianghu_date: stu.lastJianghuDate || null,
          active_pet_id: stu.activePetId || null,
          pk_count_today: stu.pkCountToday || 0,
          last_pk_date: stu.lastPkDate || null
        }
      });
    }
  }
  
  // 2c. 批量插入新学生（一次 API 调用）
  if (toInsert.length > 0) {
    var insertData = toInsert.map(function(t) { return t.data; });
    var insResult = await db.from('students').insert(insertData).select('id, name');
    if (insResult.error) {
      console.error('[DAL] batch insert students error:', insResult.error);
      // 回退：逐个插入
      for (var fi = 0; fi < toInsert.length; fi++) {
        var singleIns = await db.from('students').insert([toInsert[fi].data]).select('id').single();
        if (singleIns.data) {
          supaStuIdMap[toInsert[fi].localId] = singleIns.data.id;
          var fkey = _stuKey(classObj.id, toInsert[fi].localId);
          _idMap.students[fkey] = singleIns.data.id;
        } else {
          // 可能同名已存在，尝试查找
          var findStu = await db.from('students').select('id').eq('class_id', supaClassId).eq('name', toInsert[fi].data.name).single();
          if (findStu.data) {
            supaStuIdMap[toInsert[fi].localId] = findStu.data.id;
            var fkey2 = _stuKey(classObj.id, toInsert[fi].localId);
            _idMap.students[fkey2] = findStu.data.id;
          }
        }
      }
    } else if (insResult.data) {
      insResult.data.forEach(function(inserted) {
        var match = toInsert.find(function(t) { return t.data.name === inserted.name; });
        if (match) {
          supaStuIdMap[match.localId] = inserted.id;
          var ikey = _stuKey(classObj.id, match.localId);
          _idMap.students[ikey] = inserted.id;
        }
      });
    }
  }
  
  // 2d. 逐个更新已有学生（Supabase 批量 update 不支持按 id 匹配不同数据）
  // 但可以用 upsert 批量处理
  if (toUpdate.length > 0) {
    // 分批更新，每批最多 20 个
    var batchSize = 20;
    for (var bi = 0; bi < toUpdate.length; bi += batchSize) {
      var batch = toUpdate.slice(bi, bi + batchSize);
      var upsertData = batch.map(function(u) {
        return Object.assign({ id: u.id }, u.data);
      });
      var updResult = await db.from('students').upsert(upsertData, { onConflict: 'id' });
      if (updResult.error) {
        console.warn('[DAL] batch update students error:', updResult.error);
        // 回退：逐个更新
        for (var ui = 0; ui < batch.length; ui++) {
          var singleUpd = await db.from('students').update(batch[ui].data).eq('id', batch[ui].id);
          if (singleUpd.error) console.warn('[DAL] single update student error:', singleUpd.error);
        }
      }
    }
  }
  
  console.log('[DAL] Students batch synced:', toInsert.length, 'inserted,', toUpdate.length, 'updated');

  // 3. 批量同步宠物（先批量删除，再批量插入）
  // 3a. 收集所有需要更新的 supaStuIds
  var allSupaStuIds = Object.values(supaStuIdMap);
  
  // 3b. 批量删除该班级所有学生的宠物
  if (allSupaStuIds.length > 0) {
    for (var delBatch = 0; delBatch < allSupaStuIds.length; delBatch += 50) {
      var delIds = allSupaStuIds.slice(delBatch, delBatch + 50);
      await db.from('pets').in('student_id', delIds).delete();
    }
  }
  
  // 3c. 清除该班级所有宠物的 ID 映射
  Object.keys(_idMap.pets).forEach(function(key) {
    if (key.indexOf(classObj.id + '|') === 0) {
      delete _idMap.pets[key];
    }
  });
  
  // 3d. 批量插入所有宠物的新记录
  var allPetsToInsert = [];
  for (var pi = 0; pi < classObj.students.length; pi++) {
    var pStu = classObj.students[pi];
    var pSupaStuId = supaStuIdMap[pStu.id];
    if (!pSupaStuId) continue;
    
    for (var pk = 0; pk < (pStu.pets || []).length; pk++) {
      var pet = pStu.pets[pk];
      allPetsToInsert.push({
        localClassId: classObj.id,
        localStuId: pStu.id,
        localPetId: pet.id,
        data: {
          student_id: pSupaStuId,
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
        }
      });
    }
  }
  
  // 分批插入宠物（每批 50 只）
  if (allPetsToInsert.length > 0) {
    for (var petBatch = 0; petBatch < allPetsToInsert.length; petBatch += 50) {
      var petBatchData = allPetsToInsert.slice(petBatch, petBatch + 50).map(function(p) { return p.data; });
      var petInsResult = await db.from('pets').insert(petBatchData).select('id, student_id, name');
      if (petInsResult.error) {
        console.warn('[DAL] batch insert pets error:', petInsResult.error);
        // 回退：逐个插入
        var petBatchItems = allPetsToInsert.slice(petBatch, petBatch + 50);
        for (var rpi = 0; rpi < petBatchItems.length; rpi++) {
          var singlePetIns = await db.from('pets').insert([petBatchItems[rpi].data]).select('id').single();
          if (singlePetIns.data) {
            var rp = petBatchItems[rpi];
            var rpKey = _petKey(rp.localClassId, rp.localStuId, rp.localPetId);
            _idMap.pets[rpKey] = singlePetIns.data.id;
          }
        }
      } else if (petInsResult.data) {
        var petBatchItems = allPetsToInsert.slice(petBatch, petBatch + 50);
        petInsResult.data.forEach(function(inserted) {
          var match = petBatchItems.find(function(p) {
            return p.data.student_id === inserted.student_id && p.data.name === inserted.name;
          });
          if (match) {
            var petKeyStr = _petKey(match.localClassId, match.localStuId, match.localPetId);
            _idMap.pets[petKeyStr] = inserted.id;
          }
        });
      }
    }
  }
  console.log('[DAL] Pets batch synced:', allPetsToInsert.length, 'pets');

  // 4. 批量删除 Supabase 中已不存在的学生（及其宠物）
  var currentSupaStuIdSet = {};
  Object.keys(_idMap.students).forEach(function(key) {
    if (key.indexOf(classObj.id + '|') === 0) {
      currentSupaStuIdSet[_idMap.students[key]] = true;
    }
  });
  
  var orphanStuIds = [];
  if (existingStusResult.data) {
    existingStusResult.data.forEach(function(s) {
      if (!currentSupaStuIdSet[s.id]) {
        orphanStuIds.push(s.id);
      }
    });
  }
  
  if (orphanStuIds.length > 0) {
    // 批量删除孤儿宠物的宠物
    for (var orphanBatch = 0; orphanBatch < orphanStuIds.length; orphanBatch += 50) {
      var orphanIds = orphanStuIds.slice(orphanBatch, orphanBatch + 50);
      await db.from('pets').in('student_id', orphanIds).delete();
      await db.from('students').in('id', orphanIds).delete();
    }
    console.log('[DAL] Deleted', orphanStuIds.length, 'orphan students');
  }

  _saveIdMap();
  console.log('[DAL] _pushClass complete for', classObj.name);
}

async function _upsertStudent(supaClassId, localClassId, stu) {
  var key = _stuKey(localClassId, stu.id);
  var supaStuId = _idMap.students[key];

  // 先获取 Supabase 当前数据，然后合并（防止覆盖）
  var supaStudent = null;
  if (supaStuId && _safeInt(supaStuId) !== null) {
    var fetchResult = await db.from('students')
      .select('id, coins, shop_items, equipped_items, last_checkin_date, last_jianghu_date, active_pet_id, pk_count_today, last_pk_date')
      .eq('id', _safeInt(supaStuId))
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

  if (supaStuId && _safeInt(supaStuId) !== null) {
    var upd = await db.from('students')
      .update(studentData)
      .eq('id', _safeInt(supaStuId));
    if (upd.error) console.warn('[DAL] update student:', upd.error);
    return _safeInt(supaStuId);
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

  if (supaPetId && _safeInt(supaPetId) !== null) {
    var upd = await db.from('pets').update(petData).eq('id', _safeInt(supaPetId));
    if (upd.error) console.warn('[DAL] update pet:', upd.error);
    return _safeInt(supaPetId);
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
    // 1. 推送新增的本地日志（ID >= 1e15 或旧版浮点ID）
    var unsyncedLogs = operationLogs.filter(function(log) {
      return _isLocalId(log.id);
    });

    for (var i = 0; i < unsyncedLogs.length; i++) {
      var log = unsyncedLogs[i];
      var supaClassId = log.classId ? _getSupaClassId(log.classId) : null;
      var supaStudentId = log.studentId ? _getSupaStuId(log.classId, log.studentId) : null;

      // 如果班级映射不到 Supabase ID，跳过（班级尚未同步）
      if (!supaClassId) {
        console.log('[DAL] pushLogs: classId', log.classId, 'not mapped yet, skipping log', log.id);
        continue;
      }

      var logData = {
        class_id: _safeInt(supaClassId),
        student_id: supaStudentId ? _safeInt(supaStudentId) : null,
        student_name: log.studentName || '',
        action_type: log.actionType || '',
        details: log.details || '',
        coin_delta: log.coinDelta || 0,
        exp_delta: log.expDelta || 0,
        extra: log.extra || null,
        snapshot: log.snapshot || null,
        reverted: log.reverted || false
      };

      var ins = await db.from('operation_logs').insert([logData]).select('id').single();
      if (ins.data) {
        // 标记已同步（把本地 ID 改成 Supabase int id）
        var idx = operationLogs.indexOf(log);
        if (idx !== -1) {
          operationLogs[idx].id = ins.data.id;
          // classId/studentId 保持原值不变（_isLocalId 只检查 log.id）
        }
      }
    }

    if (unsyncedLogs.length > 0) {
      safeLSSave('operationLogs', operationLogs);
    }

    // 2. 同步已撤销状态（本地标记了 reverted 但 Supabase 中还没有）
    var revertedLogs = operationLogs.filter(function(log) {
      return log.reverted && !_isLocalId(log.id) && !log._revertSynced;
    });
    for (var j = 0; j < revertedLogs.length; j++) {
      var rlog = revertedLogs[j];
      try {
        await db.from('operation_logs')
          .update({ reverted: true })
          .eq('id', _safeInt(rlog.id));
        rlog._revertSynced = true;
      } catch (revertErr) {
        console.warn('[DAL] sync reverted status error:', revertErr.message || revertErr);
      }
    }
    if (revertedLogs.length > 0) {
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
    var archive = typeof logArchives !== 'undefined' ? logArchives : {};
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

// 从 Supabase 加载操作日志
async function _loadLogsFromSupabase() {
  if (!currentUser) return;
  try {
    var result;
    if (currentUser.type === 'teacher') {
      // 老师：加载该老师所有班级的日志
      var classIds = [];
      classesData.forEach(function(c) {
        var sid = _getSupaClassId(c.id);
        if (sid) classIds.push(sid);
      });
      if (classIds.length === 0) return;
      result = await db.from('operation_logs')
        .select('*')
        .in('class_id', classIds)
        .order('id', { ascending: true });
    } else {
      // 学生：只加载自己的日志
      var studentId = parseInt(localStorage.getItem('studentId'));
      if (!studentId) return;
      result = await db.from('operation_logs')
        .select('*')
        .eq('student_id', studentId)
        .order('id', { ascending: true });
    }

    if (result.error) {
      console.warn('[DAL] loadLogs error:', result.error.message || result.error);
      return;
    }

    if (result.data && result.data.length > 0) {
      // 将 Supabase 日志转为本地格式
      var loadedLogs = result.data.map(function(log) {
        return {
          id: log.id,
          timestamp: log.created_at || new Date().toISOString(),
          classId: log.class_id,
          studentId: log.student_id,
          studentName: log.student_name || '',
          actionType: log.action_type || '',
          details: log.details || '',
          coinDelta: log.coin_delta || 0,
          expDelta: log.exp_delta || 0,
          extra: _parseJsonb(log.extra, null),
          snapshot: _parseJsonb(log.snapshot, null),
          reverted: log.reverted || false,
          _revertSynced: log.reverted || false  // 如果 Supabase 已标记撤销，本地也标记已同步
        };
      });

      // 合并：以 Supabase 为准，保留本地未同步的日志
      var localUnsynced = operationLogs.filter(function(l) {
        return _isLocalId(l.id);
      });
      operationLogs = loadedLogs.concat(localUnsynced);
      safeLSSave('operationLogs', operationLogs);
      console.log('[DAL] Loaded', loadedLogs.length, 'logs from Supabase');
    }
  } catch (e) {
    console.warn('[DAL] loadLogs error:', e.message || e);
  }
}

// 从 Supabase 加载操作日志归档
async function _loadArchiveFromSupabase() {
  if (!currentUser) return;
  try {
    var result;
    if (currentUser.type === 'teacher') {
      result = await db.from('operation_log_archive')
        .select('*')
        .eq('teacher_id', currentUser.id);
    } else {
      return; // 学生不加载归档
    }

    if (result.error) {
      console.warn('[DAL] loadArchive error:', result.error.message || result.error);
      return;
    }

    if (result.data && result.data.length > 0) {
      // 按月份合并
      var archive = {};
      result.data.forEach(function(row) {
        var month = row.month;
        var logs = _parseJsonb(row.data, []);
        if (!archive[month]) archive[month] = [];
        archive[month] = archive[month].concat(logs);
      });

      // 合并：以 Supabase 为准，保留本地未同步的归档
      if (typeof logArchives !== 'undefined') {
        Object.keys(logArchives).forEach(function(month) {
          if (!archive[month]) {
            archive[month] = logArchives[month];
          }
        });
        Object.keys(archive).forEach(function(k) { delete logArchives[k]; });
        Object.assign(logArchives, archive);
        safeLSSave('logArchives', logArchives);
      }
      console.log('[DAL] Loaded archive from Supabase, months:', Object.keys(archive).length);
    }
  } catch (e) {
    console.warn('[DAL] loadArchive error:', e.message || e);
  }
}

// 注意：_pushDeletedClassesToSupabase 已移除
// 原因：Supabase 中没有 deleted_classes 表，调用会导致整个同步崩溃
// 已删除班级的追踪通过 _deletedSupaClassIds（localStorage）管理
// 实际删除操作在 _syncToSupabase 的孤儿清理中完成

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
    var archiveData = typeof logArchives !== 'undefined' ? logArchives : {};
    
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
    
    // 先保存旧的已删除追踪（导入成功后再清空）
    var oldDeletedIds = JSON.parse(JSON.stringify(_deletedSupaClassIds));
    
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
      if (typeof logArchives !== 'undefined') {
        Object.keys(logArchives).forEach(function(k) { delete logArchives[k]; });
        Object.assign(logArchives, data.operationLogArchive);
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
    if (typeof logArchives !== 'undefined') {
      safeLSSave('logArchives', logArchives);
    }
    if (typeof deletedClasses !== 'undefined') {
      safeLSSave('deletedClasses', deletedClasses);
    }
    
    // 清空 ID 映射，让后续同步重新建立
    _idMap = { students: {}, pets: {}, classes: {} };
    _saveIdMap();
    
    // 彻底清空 Supabase 中该老师的所有旧数据（防止孤儿班级残留）
    await _nukeSupabaseData();
    
    // 重新同步导入的数据到 Supabase
    for (var i = 0; i < classesData.length; i++) {
      await _pushClassToSupabase(classesData[i]);
    }
    await _pushCustomActionsToSupabase();
    await _pushLogsToSupabase();
    await _pushArchiveToSupabase();
    
    // 全部成功后才清空已删除追踪（导入数据为最新标准）
    _deletedSupaClassIds = {};
    _saveDeletedClassIds();
    
    // 重新渲染页面
    if (typeof init === 'function') {
      currentClassId = classesData.length > 0 ? classesData[0].id : null;
      init();
    }
    
    showNotification('导入成功', '数据已恢复并同步到云端', 'success');
    if (typeof _updateCloudStatus === 'function') _updateCloudStatus('synced');
  } catch (e) {
    console.error('[DAL] import error:', e);
    showNotification('导入失败', e.message, 'error');
    if (typeof _updateCloudStatus === 'function') _updateCloudStatus('error');
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
      if (typeof logArchives !== 'undefined') {
        // 清空后赋值
        Object.keys(logArchives).forEach(function(k) { delete logArchives[k]; });
        Object.assign(logArchives, data.operationLogArchive);
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
    if (typeof logArchives !== 'undefined') {
      safeLSSave('logArchives', logArchives);
    }
    if (typeof deletedClasses !== 'undefined') {
      safeLSSave('deletedClasses', deletedClasses);
    }
    
    // 清空 ID 映射，让后续同步重新建立
    _idMap = { students: {}, pets: {}, classes: {} };
    _saveIdMap();
    
    // 彻底清空 Supabase 中该老师的所有旧数据（防止孤儿班级残留）
    await _nukeSupabaseData();
    
    // 重新同步导入的数据到 Supabase
    for (var i = 0; i < classesData.length; i++) {
      await _pushClassToSupabase(classesData[i]);
    }
    await _pushCustomActionsToSupabase();
    await _pushLogsToSupabase();
    await _pushArchiveToSupabase();
    
    // 全部成功后才清空已删除追踪
    _deletedSupaClassIds = {};
    _saveDeletedClassIds();
    
    // 重新渲染页面
    if (typeof init === 'function') {
      currentClassId = classesData.length > 0 ? classesData[0].id : null;
      init();
    }
    
    showNotification('导入成功', '数据已恢复并同步到云端', 'success');
    if (typeof _updateCloudStatus === 'function') _updateCloudStatus('synced');
  } catch (e) {
    console.error('[DAL] import error:', e);
    showNotification('导入失败', e.message, 'error');
    if (typeof _updateCloudStatus === 'function') _updateCloudStatus('error');
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
    
    // 直接替换
    classesData = data;
    
    safeLSSave('classPetData', classesData);
    
    // 清空 ID 映射
    _idMap = { students: {}, pets: {}, classes: {} };
    _saveIdMap();
    
    // 彻底清空 Supabase 中该老师的所有旧数据（防止孤儿班级残留）
    await _nukeSupabaseData();
    
    // 重新同步导入的数据到 Supabase
    for (var i = 0; i < classesData.length; i++) {
      await _pushClassToSupabase(classesData[i]);
    }
    await _pushCustomActionsToSupabase();
    await _pushLogsToSupabase();
    await _pushArchiveToSupabase();
    
    // 全部成功后才清空已删除追踪
    _deletedSupaClassIds = {};
    _saveDeletedClassIds();
    
    if (typeof init === 'function') {
      currentClassId = classesData.length > 0 ? classesData[0].id : null;
      init();
    }
    
    showNotification('导入成功', '数据已恢复并同步到云端', 'success');
    if (typeof _updateCloudStatus === 'function') _updateCloudStatus('synced');
  } catch (e) {
    console.error('[DAL] import error:', e);
    showNotification('导入失败', e.message, 'error');
    if (typeof _updateCloudStatus === 'function') _updateCloudStatus('error');
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

// ===== 导入专用：彻底清空 Supabase 中该老师的所有数据 =====
// 用于导入场景：先删除所有旧数据，再重新插入导入的数据
// 这样可以确保不会有孤儿班级残留
async function _nukeSupabaseData() {
  if (!currentUser || currentUser.type !== 'teacher') return;
  console.log('[DAL] Nuclear cleanup: deleting ALL Supabase data for teacher', currentUser.id);
  try {
    // 1. 查所有班级
    var classResult = await db.from('classes').select('id').eq('teacher_id', currentUser.id);
    if (classResult.error) {
      console.warn('[DAL] nuke: query classes error:', classResult.error.message || classResult.error);
      return;
    }
    var supaClasses = classResult.data || [];
    if (supaClasses.length === 0) {
      console.log('[DAL] nuke: no classes to delete');
      return;
    }
    var classIds = supaClasses.map(function(c) { return c.id; });

    // 2. 分批删除宠物（通过学生关联）
    for (var i = 0; i < classIds.length; i++) {
      try {
        var stuResult = await db.from('students').select('id').eq('class_id', classIds[i]);
        if (stuResult.data && stuResult.data.length > 0) {
          var stuIds = stuResult.data.map(function(s) { return s.id; });
          for (var b = 0; b < stuIds.length; b += 50) {
            var batch = stuIds.slice(b, b + 50);
            await db.from('pets').in('student_id', batch).delete();
          }
        }
      } catch (petErr) {
        console.warn('[DAL] nuke: delete pets error for class', classIds[i], ':', petErr.message || petErr);
      }
    }

    // 3. 删除所有学生
    try {
      await db.from('students').in('class_id', classIds).delete();
    } catch (stuErr) {
      console.warn('[DAL] nuke: delete students error:', stuErr.message || stuErr);
      // 逐个删除作为后备
      for (var j = 0; j < classIds.length; j++) {
        try { await db.from('students').eq('class_id', classIds[j]).delete(); } catch (e) {}
      }
    }

    // 4. 删除所有班级
    try {
      await db.from('classes').in('id', classIds).delete();
    } catch (clsErr) {
      console.warn('[DAL] nuke: delete classes batch error:', clsErr.message || clsErr);
      // 逐个删除作为后备
      for (var k = 0; k < classIds.length; k++) {
        try { await db.from('classes').eq('id', classIds[k]).delete(); } catch (e) {}
      }
    }

    // 5. 清理 custom_actions 和 operation_logs
    try { await db.from('custom_actions').in('class_id', classIds).delete(); } catch (e) {}
    try { await db.from('operation_logs').in('class_id', classIds).delete(); } catch (e) {}
    try { await db.from('operation_log_archive').eq('teacher_id', currentUser.id).delete(); } catch (e) {}

    console.log('[DAL] Nuclear cleanup complete: deleted', supaClasses.length, 'classes and associated data');
  } catch (e) {
    console.error('[DAL] Nuclear cleanup failed:', e.message || e);
  }
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

      // 不再自动删除 Supabase 中的"孤儿"班级
      // 原因：之前 _deletedSupaClassIds 被错误填充，导致有效班级被自动删除
      // 班级删除只在教师主动操作时执行（通过 _deleteClassFromSupabase）
      console.log('[DAL] Teacher sync: pushing', classesData.length, 'classes (orphan cleanup disabled for safety)');

      await _pushCustomActionsToSupabase();
      await _pushLogsToSupabase();
      await _pushArchiveToSupabase();
    }

    console.log('[DAL] Synced to Supabase');
    if (typeof _updateCloudStatus === 'function') _updateCloudStatus('synced');
    
    // 同步成功：清除未同步标记
    _clearDirty();
    _lastSyncFailed = false;
    _syncRetryCount = 0;
    try { localStorage.removeItem('_dal_unsyncedFlag'); } catch (e) {}
    
  } catch (e) {
    console.error('[DAL] sync error:', e);
    _lastSyncFailed = true;
    if (typeof _updateCloudStatus === 'function') _updateCloudStatus('error');
    
    // 自动重试（最多 3 次，间隔递增）
    _syncRetryCount++;
    if (_syncRetryCount <= 3) {
      var retryDelay = _syncRetryCount * 3000;  // 3s, 6s, 9s
      console.log('[DAL] Will retry sync in', retryDelay, 'ms (attempt', _syncRetryCount, '/3)');
      setTimeout(function() {
        if (_hasUnsyncedData()) {
          console.log('[DAL] Auto-retrying sync...');
          _syncToSupabase();
        }
      }, retryDelay);
    } else {
      // 重试耗尽，显示明确提示
      if (typeof showNotification === 'function') {
        showNotification('同步失败', '数据已保存到本地，但未能同步到云端。请检查网络后点击右上角「☁️ 同步失败」手动重试。', 'error');
      }
    }
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

  // 1. 直接推送本地学生数据到 Supabase（本地数据永远优先，不合并）
  // 映射 activePetId 到 Supabase ID
  var supaActivePetId = student.activePetId;
  if (supaActivePetId) {
    var mappedPetId = _idMap.pets[_petKey(String(classObj.id), studentId, supaActivePetId)];
    if (mappedPetId) {
      supaActivePetId = mappedPetId;
    }
  }
  
  var stuUpd = await db.from('students')
    .update({
      coins: student.coins || 0,
      shop_items: JSON.stringify(student.shopItems || []),
      equipped_items: JSON.stringify(student.equippedItems || {}),
      last_checkin_date: student.lastCheckinDate || null,
      last_jianghu_date: student.lastJianghuDate || null,
      active_pet_id: supaActivePetId || null,
      pk_count_today: student.pkCountToday || 0,
      last_pk_date: student.lastPkDate || null
    })
    .eq('id', studentId);
  if (stuUpd.error) {
    console.warn('[DAL] Student sync: update error:', stuUpd.error);
    throw new Error('学生数据同步失败: ' + stuUpd.error.message);
  }

  // 2. 同步每只宠物（批量处理）- 使用 _idMap 映射到 Supabase ID
  var petsToUpdate = [];
  for (var k = 0; k < (student.pets || []).length; k++) {
    var pet = student.pets[k];
    // 通过 _idMap 查找 Supabase 中的宠物 ID
    var supaPetId = _idMap.pets[_petKey(String(classObj.id), studentId, pet.id)];
    if (!supaPetId) {
      // 如果 _idMap 中没有，尝试直接使用 pet.id（可能是 Supabase ID）
      supaPetId = pet.id;
    }
    if (supaPetId && _safeInt(supaPetId) !== null) {
      petsToUpdate.push({
        id: _safeInt(supaPetId),
        data: {
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
        }
      });
    } else {
      console.warn('[DAL] Student sync: pet', pet.name, 'has no valid Supabase ID, skipping');
    }
  }
  
  // 批量更新宠物（upsert）
  if (petsToUpdate.length > 0) {
    var upsertData = petsToUpdate.map(function(p) {
      return Object.assign({ id: p.id }, p.data);
    });
    var petUpdResult = await db.from('pets').upsert(upsertData, { onConflict: 'id' });
    if (petUpdResult.error) {
      console.warn('[DAL] Student sync: batch pet update error:', petUpdResult.error);
      // 回退：逐个更新
      for (var ri = 0; ri < petsToUpdate.length; ri++) {
        var singlePetUpd = await db.from('pets').update(petsToUpdate[ri].data).eq('id', petsToUpdate[ri].id);
        if (singlePetUpd.error) console.warn('[DAL] Student sync: single pet update error:', singlePetUpd.error);
      }
    }
  }

  // 3. 推送操作日志（学生操作也要记录）
  await _pushLogsToSupabase();
  await _pushArchiveToSupabase();

  // 4. 清除未同步标记
  _clearDirty();
  try { localStorage.removeItem('_dal_unsyncedFlag'); } catch (e) {}
  
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
      _markDirty();  // 标记数据有变更
      if (typeof _updateCloudStatus === 'function') _updateCloudStatus('syncing');
      _syncToSupabase();  // 云端同步
    };
    saveClassData._dalWrapped = true;
  }

  if (typeof saveCustomActions === 'function' && !saveCustomActions._dalWrapped) {
    var _origSaveActions = saveCustomActions;
    saveCustomActions = function() {
      _origSaveActions();
      _dirtyActions = true;
      if (typeof _updateCloudStatus === 'function') _updateCloudStatus('syncing');
      _syncToSupabase();
    };
    saveCustomActions._dalWrapped = true;
  }

  if (typeof saveLogs === 'function' && !saveLogs._dalWrapped) {
    var _origSaveLogs = saveLogs;
    saveLogs = function() {
      _origSaveLogs();
      _dirtyLogs = true;
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

  // ===== 版本检查：清除旧版 localStorage 缓存 =====
  var storedVersion = localStorage.getItem('_dalVersion');
  if (storedVersion !== _DAL_VERSION) {
    console.log('[DAL] Version changed:', storedVersion, '→', _DAL_VERSION, '— clearing stale localStorage caches');
    // 清除可能导致问题的旧缓存
    try {
      localStorage.removeItem('_dalDeletedClassIds');
      _deletedSupaClassIds = {};
      // 清除旧的 classPetData（防止旧数据覆盖云端）
      localStorage.removeItem('classPetData');
      // 重置 classesData 为空，让 Supabase 成为唯一数据源
      if (typeof classesData !== 'undefined') {
        classesData = [];
      }
      _idMap = { students: {}, pets: {}, classes: {} };
      _saveIdMap();
    } catch (e) {
      console.warn('[DAL] Failed to clear caches:', e);
    }
    localStorage.setItem('_dalVersion', _DAL_VERSION);
  }

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

  // 检查上次关闭页面时是否有未同步的数据
  var hadUnsynced = _checkUnsyncedOnLoad();
  if (hadUnsynced) {
    console.log('[DAL] Detected unsynced data from last session, will force sync');
  }

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
    
    // 如果上次有未同步的数据，加载后立即再同步一次（确保数据完整）
    if (hadUnsynced && currentUser.type === 'teacher') {
      console.log('[DAL] Force syncing after load to ensure data integrity...');
      _markDirty();  // 标记所有数据需要重新同步
      setTimeout(function() { _syncToSupabase(); }, 2000);
    }
  } else {
    console.log('[DAL] No data in Supabase, checking localStorage for initial sync...');
    if (typeof _updateCloudStatus === 'function') _updateCloudStatus('syncing');

    // 如果 Supabase 为空但 localStorage 有旧数据，立即推送到云端
    if (currentUser.type === 'teacher' && classesData.length > 0) {
      console.log('[DAL] Found', classesData.length, 'classes in localStorage, pushing to Supabase...');
      try {
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

  // 设置 Supabase Realtime 订阅 + 定时轮询（实现实时同步）
  _setupRealtimeSubscriptions();

  _dalReady = true;
  console.log('[DAL] Ready — data source: Supabase cloud (即时同步模式 + Realtime)');

  // 注册页面关闭/隐藏时的同步
  _setupCloseSync();
  
  // 设置云端状态指示器的点击事件（支持学生和老师都点击重试）
  _setupCloudStatusClick();
}

// ===== 云端状态指示器点击事件 =====
function _setupCloudStatusClick() {
  var el = document.getElementById('cloudSyncStatus');
  if (el) {
    el.style.cursor = 'pointer';
    el.onclick = function() {
      if (_lastSyncFailed || _hasUnsyncedData()) {
        // 有未同步数据或上次失败，触发手动同步
        if (currentUser && currentUser.type === 'teacher') {
          forceManualSync();
        } else {
          // 学生也触发同步
          if (typeof _updateCloudStatus === 'function') _updateCloudStatus('syncing');
          _syncToSupabase();
        }
      } else {
        // 没有未同步数据，显示当前状态
        if (typeof showNotification === 'function') {
          showNotification('云端同步', '数据已同步到云端 ✓', 'success');
        }
      }
    };
  }
}

// ===== 手动同步（点击云端状态按钮触发，支持老师+学生） =====
async function forceManualSync() {
  if (!currentUser) return;
  if (!db) {
    if (typeof showNotification === 'function') {
      showNotification('同步失败', 'Supabase 未连接，请刷新页面', 'error');
    }
    return;
  }
  if (_dalSyncing) {
    if (typeof showNotification === 'function') {
      showNotification('同步中', '正在同步，请稍候...', 'info');
    }
    return;
  }

  if (typeof _updateCloudStatus === 'function') _updateCloudStatus('syncing');
  if (typeof showNotification === 'function') {
    showNotification('手动同步', '正在同步数据到云端...', 'info');
  }

  try {
    // 测试连接（检查 session 是否有效）
    var testResult = await db.from('classes').select('id').limit(1);
    if (testResult.error) {
      if (testResult.message && (testResult.message.indexOf('JWT') >= 0 || testResult.message.indexOf('expired') >= 0 || testResult.message.indexOf('auth') >= 0)) {
        if (typeof showNotification === 'function') {
          showNotification('登录已过期', '请退出后重新登录，然后再次同步', 'error');
        }
      } else {
        throw new Error('Supabase 连接失败: ' + testResult.error.message);
      }
      return;
    }

    // 推送所有班级（老师）或自己的数据（学生）
    if (currentUser.type === 'teacher') {
      for (var i = 0; i < classesData.length; i++) {
        await _pushClassToSupabase(classesData[i]);
      }
      await _pushCustomActionsToSupabase();
      
      // 验证同步结果
      var verifyResult = await db.from('classes').select('id, name').eq('teacher_id', currentUser.id);
      var supaClassCount = (verifyResult.data || []).length;
      var localClassCount = classesData.length;
      
      var msg = '同步完成！本地 ' + localClassCount + ' 个班级，云端 ' + supaClassCount + ' 个班级。';
      if (localClassCount === supaClassCount) {
        msg += ' ✅ 数据一致';
      } else {
        msg += ' ⚠️ 数量不一致，请检查';
      }
      
      if (typeof _updateCloudStatus === 'function') _updateCloudStatus('synced');
      if (typeof showNotification === 'function') {
        showNotification('同步成功', msg, 'success');
      }
    } else {
      // 学生同步
      await _syncStudentToSupabase();
      if (typeof _updateCloudStatus === 'function') _updateCloudStatus('synced');
      if (typeof showNotification === 'function') {
        showNotification('同步成功', '你的数据已同步到云端 ✓', 'success');
      }
    }
    
    _clearDirty();
    _lastSyncFailed = false;
    _syncRetryCount = 0;
    try { localStorage.removeItem('_dal_unsyncedFlag'); } catch (e) {}
    
    console.log('[DAL] Manual sync complete');
  } catch (e) {
    console.error('[DAL] Manual sync failed:', e);
    if (typeof _updateCloudStatus === 'function') _updateCloudStatus('error');
    if (typeof showNotification === 'function') {
      showNotification('同步失败', e.message || '请检查网络和 Supabase 配置', 'error');
    }
  }
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
  // 同时：对其他同学的卡片，隐藏互动按钮，展示更详细的信息面板，含 PK 挑战入口
  var _origOpenStudentModal = window.openStudentModal;
  window.openStudentModal = function(studentId) {
    if (currentUser.type === 'student' && studentId.toString() !== currentUser.studentId.toString()) {
      // 学生查看其他同学 — 展示只读信息面板，附带 PK 挑战入口
      var cur = classesData.find(function(c){ return c.id === currentClassId; });
      if (!cur) return;
      var student = cur.students.find(function(s){ return s.id.toString() === studentId.toString(); });
      if (!student) return;
      var activePet = typeof getActivePet === 'function' ? getActivePet(student) : null;
      var myStudent = cur.students.find(function(s){ return s.id.toString() === currentUser.studentId.toString(); });
      var myPet = myStudent ? (typeof getActivePet === 'function' ? getActivePet(myStudent) : null) : null;

      var content = '<div style="text-align:center;">';
      content += '<div style="font-size:20px;font-weight:700;margin-bottom:8px;">' + escapeHTML(student.name) + '</div>';
      content += '<div style="font-size:14px;color:#888;margin-bottom:12px;">💰 ' + student.coins + ' 金币</div>';
      if (activePet) {
        var petStatus = activePet.isDead ? '💀 已饿死' : (activePet.level >= 9 ? '👑 已满级' : '🌱 活跃中');
        var pkToday = student.pkCountToday || 0;
        content += '<div style="background:rgba(255,200,200,0.2);border-radius:16px;padding:14px;margin:10px 0;border:1px solid rgba(255,180,180,0.4);">';
        content += '<div style="font-size:44px;margin-bottom:8px;">' + getPetImage(activePet.name, activePet.level) + '</div>';
        content += '<div style="font-size:16px;font-weight:600;">' + escapeHTML(activePet.nickname || activePet.name) + '</div>';
        content += '<div style="font-size:13px;color:#888;margin-top:4px;">Lv.' + activePet.level + ' · 成长值: ' + activePet.growth + '</div>';
        content += '<div style="font-size:13px;color:#888;margin-top:2px;">状态: ' + petStatus + '</div>';
        content += '<div style="font-size:13px;color:#888;margin-top:2px;">今日PK次数: ' + pkToday + ' / 3</div>';
        content += '</div>';

        // PK 挑战按钮（满足条件时显示）
        var canPK = true;
        var pkReason = '';
        if (!myPet) { canPK = false; pkReason = '你还没有宠物'; }
        else if (myPet.isDead) { canPK = false; pkReason = '你的宠物已死亡'; }
        else if (activePet.isDead) { canPK = false; pkReason = '对方宠物已死亡'; }
        else if (Math.abs(myPet.level - activePet.level) > 1) { canPK = false; pkReason = '等级差超过1级，无法PK'; }
        else if (myStudent && myStudent.coins < 5) { canPK = false; pkReason = '你的金币不足（需≥5）'; }
        else if (student.coins < 5) { canPK = false; pkReason = '对方金币不足（需≥5）'; }
        else if (myStudent && myStudent.pkCountToday >= 3) { canPK = false; pkReason = '你今天PK次数已达上限'; }
        else if (pkToday >= 3) { canPK = false; pkReason = '对方今天PK次数已达上限'; }

        if (canPK) {
          content += '<button onclick="_studentChallengePK(\'' + student.id + '\')" style="margin-top:10px;padding:10px 20px;background:linear-gradient(135deg,#ff6b6b,#ee5a24);color:white;border:none;border-radius:20px;font-size:15px;font-weight:700;cursor:pointer;">⚔️ 向 TA 发起 PK</button>';
        } else {
          content += '<div style="margin-top:10px;padding:8px;background:rgba(200,200,200,0.2);border-radius:12px;font-size:12px;color:#999;">' + pkReason + '</div>';
        }
      } else {
        content += '<div style="margin-top:10px;color:#aaa;">暂无宠物</div>';
      }
      content += '</div>';
      if (typeof showModal === 'function') {
        showModal(student.name + ' 的信息', content, [{text:'关闭', onclick:'closeModal()'}]);
      }
      return;
    }
    return _origOpenStudentModal(studentId);
  };

  // 覆盖 renderHomePetGrid：学生模式下隐藏其他同学卡片上的互动按钮
  if (typeof window._origRenderHomePetGrid === 'undefined') {
    window._origRenderHomePetGrid = window.renderHomePetGrid;
  }
  window.renderHomePetGrid = function() {
    window._origRenderHomePetGrid();
    if (currentUser.type !== 'student') return;
    // 找到不是自己的宠物卡片，隐藏互动按钮
    var myId = currentUser.studentId.toString();
    var cards = document.querySelectorAll('.home-pet-card');
    cards.forEach(function(card) {
      var onclick = card.getAttribute('onclick') || '';
      // 判断是否是自己的卡片（onclick 中包含自己的 studentId）
      if (onclick.indexOf("'" + myId + "'") === -1 && onclick.indexOf('"' + myId + '"') === -1) {
        // 隐藏卡片上的互动按钮（换宠、切换、改名等）
        card.querySelectorAll('button').forEach(function(btn) {
          var txt = (btn.textContent || '').trim();
          var btnOnclick = btn.getAttribute('onclick') || '';
          if (
            btnOnclick.indexOf('showChangePetModal') !== -1 ||
            btnOnclick.indexOf('showSwitchPetModal') !== -1 ||
            btnOnclick.indexOf('renamePet') !== -1
          ) {
            btn.style.display = 'none';
          }
        });
      }
    });
  };
}

// ===== 学生 PK 挑战入口 =====
// 从同学信息面板点击「向 TA 发起 PK」后触发
// 自动选中双方宠物，切换到 PK 页面并开始对战
function _studentChallengePK(targetStudentId) {
  if (typeof closeModal === 'function') closeModal();
  var cur = classesData.find(function(c) { return c.id === currentClassId; });
  if (!cur) return;
  var myStudent = cur.students.find(function(s) { return s.id.toString() === currentUser.studentId.toString(); });
  var targetStudent = cur.students.find(function(s) { return s.id.toString() === targetStudentId.toString(); });
  if (!myStudent || !targetStudent) return;
  var myPet = typeof getActivePet === 'function' ? getActivePet(myStudent) : null;
  var targetPet = typeof getActivePet === 'function' ? getActivePet(targetStudent) : null;
  if (!myPet || !targetPet) {
    if (typeof showNotification === 'function') showNotification('PK失败', '宠物不存在', 'error');
    return;
  }
  // 复用现有 PK 逻辑：设置 pkState，切换到 PK 页面并自动开始
  if (typeof pkState !== 'undefined') {
    pkState.players = [
      { studentId: myStudent.id, studentName: myStudent.name, pet: Object.assign({}, myPet) },
      { studentId: targetStudent.id, studentName: targetStudent.name, pet: Object.assign({}, targetPet) }
    ];
  }
  // 切换到 PK 页面
  if (typeof switchPage === 'function') switchPage('pk-page');
  // 延迟一小段时间等待页面渲染，然后自动开始对战
  setTimeout(function() {
    if (typeof startPKBattle === 'function') startPKBattle();
  }, 500);
}
// 将函数挂到全局
window._studentChallengePK = _studentChallengePK;

// ===== 移除定时同步，改为每次操作立即同步 =====
// 不再使用30秒定时器，所有操作都会立即触发同步
// 保存函数已被包装（wrapSaveFunctions），每次保存都会同步到 Supabase

// ===== 未同步数据追踪 =====
// 记录哪些班级/数据有未同步的变更
var _dirtyClasses = {};  // { classId: true }
var _dirtyActions = false;
var _dirtyLogs = false;
var _lastSyncFailed = false;
var _syncRetryCount = 0;

// 标记数据有变更
function _markDirty() {
  if (classesData && Array.isArray(classesData)) {
    classesData.forEach(function(c) { _dirtyClasses[c.id] = true; });
  }
  _dirtyActions = true;
  _dirtyLogs = true;
}

// 清除变更标记
function _clearDirty() {
  _dirtyClasses = {};
  _dirtyActions = false;
  _dirtyLogs = false;
}

// 检查是否有未同步数据
function _hasUnsyncedData() {
  return Object.keys(_dirtyClasses).length > 0 || _dirtyActions || _dirtyLogs;
}

// ===== 页面关闭/隐藏时立即同步 =====
// 获取 Supabase 认证 token（从 localStorage 中读取 session）
function _getSupabaseAuthHeaders() {
  var headers = {
    'apikey': SUPABASE_ANON_KEY,
    'Content-Type': 'application/json',
    'Prefer': 'return=minimal'
  };
  try {
    // Supabase JS client 将 session 存在 localStorage 中
    var sessionKey = 'sb-' + SUPABASE_URL.split('//')[1].split('.')[0] + '-auth-token';
    var sessionStr = localStorage.getItem(sessionKey);
    if (sessionStr) {
      var session = JSON.parse(sessionStr);
      if (session && session.access_token) {
        headers['Authorization'] = 'Bearer ' + session.access_token;
      }
    }
  } catch (e) {
    // 使用 anon key 作为 fallback
    headers['Authorization'] = 'Bearer ' + SUPABASE_ANON_KEY;
  }
  return headers;
}

// 同步 XHR 请求到 Supabase REST API
function _syncXhr(method, path, body) {
  try {
    var xhr = new XMLHttpRequest();
    xhr.open(method, SUPABASE_URL + '/rest/v1/' + path, false);  // false = 同步
    var headers = _getSupabaseAuthHeaders();
    Object.keys(headers).forEach(function(key) {
      xhr.setRequestHeader(key, headers[key]);
    });
    xhr.timeout = 5000;  // 5秒超时
    if (body) {
      xhr.send(JSON.stringify(body));
    } else {
      xhr.send();
    }
    return xhr.status >= 200 && xhr.status < 300;
  } catch (e) {
    console.warn('[DAL] syncXhr failed:', method, path, e.message);
    return false;
  }
}

// 页面关闭前的同步推送 - 使用同步 XHR 确保数据写入 Supabase
function _syncPushBeforeClose() {
  if (!currentUser || !_hasUnsyncedData()) return;
  
  console.log('[DAL] Page closing with unsynced data — synchronous push...');
  
  try {
    localStorage.setItem('_dal_unsyncedFlag', JSON.stringify({
      time: Date.now(),
      userType: currentUser.type,
      userId: currentUser.id
    }));
  } catch (e) {}

  if (currentUser.type === 'student') {
    // 学生模式：同步推送学生数据和宠物数据
    var classObj = classesData[0];
    if (!classObj) return;
    var studentId = parseInt(localStorage.getItem('studentId'));
    if (!studentId) return;
    
    var student = classObj.students.find(function(s) {
      return s.id.toString() === studentId.toString();
    });
    if (!student) return;

    // 1. 同步推送学生数据
    _syncXhr('PATCH', 'students?id=eq.' + studentId, {
      coins: student.coins || 0,
      shop_items: JSON.stringify(student.shopItems || []),
      equipped_items: JSON.stringify(student.equippedItems || {}),
      last_checkin_date: student.lastCheckinDate || null,
      last_jianghu_date: student.lastJianghuDate || null,
      active_pet_id: student.activePetId || null,
      pk_count_today: student.pkCountToday || 0,
      last_pk_date: student.lastPkDate || null
    });

    // 2. 同步推送每只宠物数据
    (student.pets || []).forEach(function(pet) {
      var supaPetId = pet.id;
      if (supaPetId && _safeInt(supaPetId) !== null) {
        _syncXhr('PATCH', 'pets?id=eq.' + _safeInt(supaPetId), {
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
        });
      }
    });

    console.log('[DAL] Student synchronous push complete');
    
  } else {
    // 老师模式：同步推送所有班级数据
    classesData.forEach(function(classObj) {
      var supaClassId = _getSupaClassId(classObj.id);
      
      // 推送班级
      if (supaClassId) {
        _syncXhr('PATCH', 'classes?id=eq.' + supaClassId, {
          name: classObj.name
        });
      } else {
        var createResult = null;
        try {
          var xhr = new XMLHttpRequest();
          xhr.open('POST', SUPABASE_URL + '/rest/v1/classes', false);
          var headers = _getSupabaseAuthHeaders();
          headers['Prefer'] = 'return=representation';
          Object.keys(headers).forEach(function(key) { xhr.setRequestHeader(key, headers[key]); });
          xhr.send(JSON.stringify({ name: classObj.name, teacher_id: currentUser.id }));
          if (xhr.status >= 200 && xhr.status < 300) {
            var created = JSON.parse(xhr.responseText);
            if (created && created[0] && created[0].id) {
              supaClassId = created[0].id;
              _idMap.classes[String(classObj.id)] = supaClassId;
              _saveIdMap();
            }
          }
        } catch (e) {}
      }
      
      if (!supaClassId) return;
      
      // 推送每个学生
      (classObj.students || []).forEach(function(stu) {
        var supaStuId = _getSupaStuId(classObj.id, stu.id);
        var stuData = {
          name: stu.name,
          class_id: supaClassId,
          coins: stu.coins || 0,
          shop_items: JSON.stringify(stu.shopItems || []),
          equipped_items: JSON.stringify(stu.equippedItems || {}),
          last_checkin_date: stu.lastCheckinDate || null,
          last_jianghu_date: stu.lastJianghuDate || null,
          active_pet_id: stu.activePetId || null,
          pk_count_today: stu.pkCountToday || 0,
          last_pk_date: stu.lastPkDate || null
        };
        
        if (supaStuId) {
          _syncXhr('PATCH', 'students?id=eq.' + supaStuId, stuData);
        } else {
          try {
            var xhr = new XMLHttpRequest();
            xhr.open('POST', SUPABASE_URL + '/rest/v1/students', false);
            var headers = _getSupabaseAuthHeaders();
            headers['Prefer'] = 'return=representation';
            Object.keys(headers).forEach(function(key) { xhr.setRequestHeader(key, headers[key]); });
            xhr.send(JSON.stringify(stuData));
            if (xhr.status >= 200 && xhr.status < 300) {
              var created = JSON.parse(xhr.responseText);
              if (created && created[0] && created[0].id) {
                _idMap.students[_stuKey(classObj.id, stu.id)] = created[0].id;
                supaStuId = created[0].id;
                _saveIdMap();
              }
            }
          } catch (e) {}
        }
        
        // 推送宠物
        (stu.pets || []).forEach(function(pet) {
          var supaPetId = _getSupaPetId(classObj.id, stu.id, pet.id);
          if (supaPetId) {
            _syncXhr('PATCH', 'pets?id=eq.' + _safeInt(supaPetId), {
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
            });
          }
        });
      });
    });
    
    console.log('[DAL] Teacher synchronous push complete');
  }
  
  _clearDirty();
}

function _setupCloseSync() {
  // 页面关闭前同步 - 使用同步 XHR 直接推送数据到 Supabase
  window.addEventListener('beforeunload', function(e) {
    _syncPushBeforeClose();
  });

  // 页面隐藏时同步（切换标签页、最小化等）
  document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'hidden') {
      if (currentUser && _hasUnsyncedData()) {
        console.log('[DAL] Page hidden with unsynced data, syncing...');
        _syncToSupabase();
      }
    } else if (document.visibilityState === 'visible') {
      // 页面重新可见时，检查是否有未同步数据
      if (currentUser && _hasUnsyncedData()) {
        console.log('[DAL] Page visible again, has unsynced data, syncing...');
        _syncToSupabase();
      }
    }
  });

  console.log('[DAL] Close-sync handlers registered');
}

// ===== 页面加载时检查上次未同步的数据 =====
function _checkUnsyncedOnLoad() {
  try {
    var flag = localStorage.getItem('_dal_unsyncedFlag');
    if (flag) {
      var parsed = JSON.parse(flag);
      // 如果上次关闭时有未同步数据（在 24 小时内）
      if (parsed.time && Date.now() - parsed.time < 24 * 60 * 60 * 1000) {
        console.log('[DAL] Detected unsynced flag from last session, will force sync after load');
        return true;
      }
    }
  } catch (e) {}
  return false;
}

// 启动 DAL 初始化
initDAL();
