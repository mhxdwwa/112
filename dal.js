/**
 * dal.js v122 — Fix student operation logs not recorded on mobile browsers
 * 
 * Architecture: Supabase as single source of truth + local change preservation
 * - Snapshot-based change detection: only applies changes from OTHER users
 * - Smart merge refresh: never overwrites local edits
 * - Debounced Realtime: prevents refresh flooding
 * - Self-write detection: ignores own writes for 30s
 * - Student delta merge: preserves both teacher rewards and student spending
 * - Operation logs synced to Supabase (both teacher and student)
 * - v54: Bandwidth optimization — Realtime-aware polling, exclude heavy fields
 *   from class queries, filter students/pets by class_id at DB level
 * - v59: Fix delete-class race condition — Phase 1 now checks current classesData
 *   (not captured forEach reference) to prevent re-upserting deleted classes.
 *   Phase 6 tracks deleted class IDs across syncs to ensure Supabase cleanup.
 *   Reverted v58 smartRefresh class list sync (caused conflicts with concurrent syncs).
 * - v60: Fix pet is_active sync — derive from student.activePetId instead of
 *   local pet.isActive to prevent sync loop that kept resetting is_active=false.
 * - v102: Stable realtime sync — distinguish own echoes from others' changes:
 *   Student side: skip Realtime events matching own student ID (exact, no time window)
 *   Teacher side: skip recently written rows via _recentlyWrittenRows (3s window)
 *   Concurrent conflicts: snapshot-based delta preservation for coins/growth
 *   Safety net: visibilitychange triggers immediate full refresh (no debounce)
 * 
 * Flow: loadFromSupabase() → classesData + snapshot → UI
 *       UI action → saveClassData() → _syncToSupabase() → Supabase → update snapshot
 *       Realtime event → _applyRealtimeUpdate() → delta merge → targeted render
 *       Student action → _syncStudentToSupabase() → fetch fresh → delta merge → upsert
 */

/* ===== State ===== */
var _dalReady = false;
var _dalInitialLoadComplete = false; // v103: Prevents refresh during initial load
var _dalSyncing = false;
var _dalSyncQueued = false;
var _refreshTimer = null;
var _refreshInterval = 120000; // v54: Fallback polling 2min (was 30s). Only active when Realtime is down.
var _lastRefreshTime = 0;
var _realtimeActive = false; // v54: True when at least one Realtime channel is connected
var _realtimeChannels = [];
var _realtimeLastEventTime = 0; // v95: Track last Realtime event arrival for liveness detection
var _safetyNetTimer = null; // v95: Safety-net poll that runs even when Realtime is "active"
var _SAFETY_NET_INTERVAL = 15000; // v95: 15s safety-net poll interval
var _REALTIME_LIVENESS_TIMEOUT = 45000; // v95: If no Realtime event for 45s, mark as dead
var _syncRetryCount = 0;
var _maxRetries = 3;
var _lastSyncFailed = false;
var _DAL_VERSION = '128.0';
var _pendingLocalSave = false; // True when local data has unsaved changes — prevents Realtime overwrite
var _REFRESH_PROTECTION_MS = 10000; // v14: 10s protection after sync (was 30s)
var _syncDeletedClassIds = []; // v59: Track class IDs deleted during sync to ensure Phase 6 cleanup

/* ===== v45: localStorage Cache for Instant First Paint ===== */
var _CACHE_KEY = '_dal_cache_v2';
var _CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours
var _loadedFromCache = false;

function _saveToCache() {
  try {
    if (!classesData || !Array.isArray(classesData) || classesData.length === 0) return;
    var userId = currentUser ? (currentUser.id || currentUser.studentId || 'anon') : 'anon';
    var payload = {
      v: 1,
      userId: userId,
      ts: Date.now(),
      classesData: classesData,
      currentClassId: (typeof currentClassId !== 'undefined') ? currentClassId : null,
      customActions: (typeof customActions !== 'undefined') ? customActions : [],
      operationLogs: (typeof window.operationLogs !== 'undefined') ? window.operationLogs.slice(0, 500) : []
    };
    localStorage.setItem(_CACHE_KEY, JSON.stringify(payload));
    console.log('[DAL] Cache saved (' + (JSON.stringify(payload).length / 1024).toFixed(1) + ' KB)');
  } catch(e) {
    console.warn('[DAL] Cache save failed:', e.message);
  }
}

function _loadFromCache() {
  try {
    var raw = localStorage.getItem(_CACHE_KEY);
    if (!raw) return null;
    var payload = JSON.parse(raw);
    if (!payload || payload.v !== 1) return null;
    // Check age
    if (Date.now() - payload.ts > _CACHE_MAX_AGE_MS) {
      console.log('[DAL] Cache expired, ignoring');
      return null;
    }
    // v47: Check user match — must have valid currentUser and matching userId
    if (!currentUser) {
      console.log('[DAL] Cache load skipped: currentUser not set');
      return null;
    }
    var userId = currentUser.id || currentUser.studentId || 'anon';
    if (userId === 'anon' || payload.userId === 'anon') {
      console.log('[DAL] Cache load skipped: anonymous user');
      return null;
    }
    if (payload.userId !== userId) {
      console.log('[DAL] Cache user mismatch (' + payload.userId + ' !== ' + userId + '), ignoring');
      return null;
    }
    if (!payload.classesData || !Array.isArray(payload.classesData) || payload.classesData.length === 0) return null;
    console.log('[DAL] Cache loaded: ' + payload.classesData.length + ' classes, age=' + 
      Math.round((Date.now() - payload.ts) / 1000) + 's');
    return payload;
  } catch(e) {
    console.warn('[DAL] Cache load failed:', e.message);
    return null;
  }
}

/* ===== v54: Bandwidth Optimization ===== */
// Classes table columns to select in load/refresh queries.
// Excludes operation_logs_json (2MB+) which is loaded separately by _loadOperationLogs().
// This single change saves ~2-5MB per refresh cycle.
var _CLASS_COLS = 'id, name, teacher_id, created_at';

/* ===== Snapshot System (v7.0) ===== */
// _snapshotClassesData: what Supabase looked like when we last loaded/synced
// Used to detect: "did this field change on the SERVER or did we change it LOCALLY?"
// If local[student].coins === snapshot[student].coins → no local change → safe to update from server
// If local[student].coins !== snapshot[student].coins → local change → KEEP local value
var _snapshotClassesData = null;

/* ===== Student Delta Tracking (v7.0) ===== */
var _myBaseCoins = null; // Student's coins at last known Supabase state
var _myBasePets = {};    // Student's pet growth at last known Supabase state

/* ===== v36: Growth cap enforcement ===== */
// Max growth for any pet is 2600 (万物之神 stage requirement)
var _PET_MAX_GROWTH = 2600;
function _capPetGrowth(pet) {
  if (pet && typeof pet.growth === 'number' && pet.growth > _PET_MAX_GROWTH) {
    pet.growth = _PET_MAX_GROWTH;
  }
  return pet;
}

/* ===== Debounce & Self-Write Protection (v7.0) ===== */
var _refreshDebounceTimer = null;
var _REFRESH_DEBOUNCE_MS = 1500; // v14: 1.5s debounce for Realtime events (was 3s)
var _lastOwnWriteTime = 0;       // Timestamp of our last successful sync
var _OWN_WRITE_IGNORE_MS = 10000; // v14: Ignore Realtime events for 10s after our own write (was 30s)

/* ===== v102: Recently Written Rows Tracking (Teacher-side echo protection) ===== */
// Tracks which student/pet rows the teacher recently wrote to Supabase.
// When Realtime echoes back these changes, we skip them to avoid overwriting
// local data that may have been modified further after the write started.
var _recentlyWrittenRows = {}; // { 'students:123': timestamp, 'pets:456': timestamp }
var _RECENT_WRITE_WINDOW_MS = 3000; // 3s window for teacher-side echo protection

function _markRowWritten(table, rowId) {
  _recentlyWrittenRows[table + ':' + rowId] = Date.now();
}

function _isRowRecentlyWritten(table, rowId) {
  var key = table + ':' + rowId;
  var ts = _recentlyWrittenRows[key];
  if (!ts) return false;
  if (Date.now() - ts > _RECENT_WRITE_WINDOW_MS) {
    delete _recentlyWrittenRows[key]; // Clean up expired entries
    return false;
  }
  return true;
}

// Periodic cleanup of expired entries (every 10s)
setInterval(function() {
  var now = Date.now();
  Object.keys(_recentlyWrittenRows).forEach(function(key) {
    if (now - _recentlyWrittenRows[key] > _RECENT_WRITE_WINDOW_MS) {
      delete _recentlyWrittenRows[key];
    }
  });
}, 10000);

/* ===== Realtime Channel Coalescing (v53) ===== */
// All 4 Realtime channels call this instead of _immediateRefreshFromSupabase directly.
// Coalesces multiple events within 3s into a single refresh.
var _realtimeCoalesceTimer = null;
function _debouncedRealtimeRefresh(source) {
  console.log('[DAL] 🔔 Realtime event from [' + source + '] — coalesced (3s)');
  if (_realtimeCoalesceTimer) return; // already scheduled, skip
  _realtimeCoalesceTimer = setTimeout(function() {
    _realtimeCoalesceTimer = null;
    _immediateRefreshFromSupabase();
  }, 3000);
}

/* ===== BroadcastChannel 定向增量刷新 (v96) ===== */
// 用于跨标签页即时通知数据变化，避免全量拉取
var _broadcastChannel = null;
var _broadcastDebounceTimer = null;
var _BROADCAST_DEBOUNCE_MS = 200; // 200ms 内多次广播合并为一次渲染

function _initBroadcastChannel() {
  try {
    if (typeof BroadcastChannel === 'undefined') {
      console.log('[DAL] BroadcastChannel not supported in this browser');
      return;
    }
    _broadcastChannel = new BroadcastChannel('pet-world-changes');
    _broadcastChannel.onmessage = function(event) {
      _handleBroadcastChange(event.data);
    };
    console.log('[DAL] v96 BroadcastChannel initialized');
  } catch(e) {
    console.warn('[DAL] BroadcastChannel init failed:', e.message);
  }
}

// 发送变更通知 —— 只发"改了什么类型"，不发完整数据
function _broadcastChange(changeType, detail) {
  if (!_broadcastChannel) return;
  try {
    var myId = null;
    if (typeof currentUser !== 'undefined' && currentUser) {
      myId = currentUser.studentId || currentUser.id;
    }
    _broadcastChannel.postMessage({
      type: changeType,
      studentId: myId,
      classId: (typeof currentClassId !== 'undefined') ? currentClassId : null,
      detail: detail || {},
      ts: Date.now()
    });
  } catch(e) {
    // 广播失败不影响主流程
  }
}

// 接收变更通知 —— 定向刷新对应UI区域，不拉全量数据
function _handleBroadcastChange(msg) {
  if (!msg || !msg.type) return;

  // 忽略自己发的消息（自己保存的数据本地已经是最新的）
  var myId = null;
  if (typeof currentUser !== 'undefined' && currentUser) {
    myId = currentUser.studentId || currentUser.id;
  }
  if (msg.studentId && myId && msg.studentId.toString() === myId.toString()) return;

  console.log('[DAL] v96 📡 Broadcast received:', msg.type, msg.detail);

  // 使用 debounce 合并短时间内的多次广播
  if (_broadcastDebounceTimer) clearTimeout(_broadcastDebounceTimer);
  _broadcastDebounceTimer = setTimeout(function() {
    _broadcastDebounceTimer = null;
    _dispatchBroadcastRender(msg);
  }, _BROADCAST_DEBOUNCE_MS);
}

// 根据变更类型决定刷新哪些UI区域
// v100: BroadcastChannel 数据已在内存中，直接定向渲染，不查询数据库
function _dispatchBroadcastRender(msg) {
  // 渲染标志位常量（与 app.js 中定义一致）
  var _RF_GRID = 1, _RF_TOP3 = 2, _RF_PK = 4, _RF_CLASSLIST = 8, _RF_JH = 16;
  var renderMask = 0;

  switch (msg.type) {
    case 'pet':
      // 宠物信息变化（喂食、玩耍、领养等）→ 刷新宠物网格 + 排行榜
      renderMask = _RF_GRID | _RF_TOP3;
      break;

    case 'coins':
      // 金币变化（奖励、惩罚、购物等）→ 刷新宠物网格（金币显示在卡片上）+ 排行榜
      renderMask = _RF_GRID | _RF_TOP3;
      break;

    case 'level':
    case 'quiz':
      // 关卡/答题数据变化（快乐跑、小猪快跑等游戏）→ 刷新排行榜
      renderMask = _RF_GRID | _RF_TOP3;
      break;

    case 'leaderboard':
      // 排行榜专用变化 → 只刷新排行榜
      renderMask = _RF_TOP3;
      break;

    case 'pk':
      // PK数据变化
      renderMask = _RF_PK;
      break;

    case 'jianghu':
      // 江湖行数据变化
      renderMask = _RF_JH;
      break;

    case 'class':
      // 班级结构变化（增删学生、改班级名等）
      renderMask = _RF_CLASSLIST | _RF_GRID | _RF_TOP3;
      break;

    default:
      // 未知类型 → 全量刷新（安全兜底）
      if (typeof scheduleAllRenders === 'function') scheduleAllRenders();
      return;
  }

  // v100: 直接定向渲染，数据已在内存中
  if (typeof scheduleRender === 'function') {
    scheduleRender(renderMask);
  } else if (typeof scheduleAllRenders === 'function') {
    scheduleAllRenders();
  }
  
  // 如果学生详情弹窗开着，刷新它
  if (typeof refreshCurrentStudentModal === 'function' && typeof currentModalStudentId !== 'undefined' && currentModalStudentId) {
    try { refreshCurrentStudentModal(); } catch(e) {}
  }
}

/* ===== Snapshot Helpers (v7.0) ===== */
function _takeSnapshot() {
  if (!classesData || !Array.isArray(classesData)) return;
  // v53: Use structuredClone (3-5x faster than JSON round-trip), fallback for older browsers
  _snapshotClassesData = (typeof structuredClone === 'function')
    ? structuredClone(classesData)
    : JSON.parse(JSON.stringify(classesData));
  // 预构建索引 Map，加速后续查找（O(1) 替代 O(n) 线性扫描）
  _snapshotStudentMap = {};
  _snapshotPetMap = {};
  _snapshotClassesData.forEach(function(cls) {
    (cls.students || []).forEach(function(stu) {
      _snapshotStudentMap[stu.id] = stu;
      (stu.pets || []).forEach(function(pet) {
        _snapshotPetMap[pet.id] = pet;
      });
    });
  });
  console.log('[DAL] Snapshot taken: ' + _snapshotClassesData.length + ' classes, ' +
    Object.keys(_snapshotStudentMap).length + ' students, ' +
    Object.keys(_snapshotPetMap).length + ' pets (indexed)');
}

var _snapshotStudentMap = {};
var _snapshotPetMap = {};

function _findStudentInSnapshot(studentId) {
  return _snapshotStudentMap[studentId] || null;
}

function _findPetInSnapshot(petId) {
  return _snapshotPetMap[petId] || null;
}

/* ===== Smart Merge Refresh (v7.0) ===== */
// This replaces the old approach of completely replacing classesData.
// Instead, we load fresh data from Supabase and intelligently merge:
// - If a field changed on the SERVER (different from snapshot) AND hasn't been changed locally → update
// - If a field was changed LOCALLY (different from snapshot) → keep local value
// - New students/pets from server → always added
function _smartRefreshFromSupabase() {
  if (!currentUser || !currentUser.id) return Promise.resolve();
  
  // v102: Removed global _OWN_WRITE_IGNORE_MS protection from here.
  // Echo protection is now handled per-row:
  // - Student side: student ID match in _applyRealtimeUpdate
  // - Teacher side: _recentlyWrittenRows in _applyRealtimeUpdate
  // This function is only called for full refresh (visibilitychange safety net
  // or fallback polling when Realtime is down), so it should NOT be blocked
  // by own-write protection.

  console.log('[DAL] v102 Smart refresh starting...');
  var isStudent = currentUser.type === 'student';
  var studentId = isStudent ? parseInt(localStorage.getItem('studentId')) : null;
  var classId = isStudent ? parseInt(localStorage.getItem('classId')) : null;
  
  if (isStudent && (!studentId || !classId)) return Promise.resolve();

  // Build queries based on user type
  // v54: Teacher queries are sequential — first get class IDs, then filter students/pets at DB level
  var queries;
  if (isStudent) {
    queries = Promise.all([
      db.from('classes').select(_CLASS_COLS).eq('id', classId).single(),
      db.from('students').select('id, name, class_id, coins, last_checkin_date, last_jianghu_date, last_pk_date, active_pet_id, pk_count_today, shop_items, equipped_items, password, quiz_state, snack_requests').eq('class_id', classId),
      db.from('pets').select('id, student_id, name, nickname, level, growth, coins, is_active, is_dead, last_feed_date, last_play_date, today_feed_count, today_play_count, penalty_streak')
    ]).then(function(results) {
      // Filter pets to class students client-side (already filtered by class)
      var classStudentIds = (results[1].data || []).map(function(s) { return s.id; });
      results[2].data = (results[2].data || []).filter(function(p) { return classStudentIds.indexOf(p.student_id) >= 0; });
      return results;
    });
  } else {
    // v54: Teacher — sequential: classes first, then filtered students/pets
    queries = db.from('classes').select(_CLASS_COLS).eq('teacher_id', currentUser.id).order('id')
    .then(function(classesR) {
      if (classesR.error) throw classesR.error;
      var classes = classesR.data || [];
      var classIds = classes.map(function(c) { return c.id; });
      if (classIds.length === 0) {
        // No classes — return empty results
        return [{ data: [], error: null }, { data: [], error: null }, { data: [], error: null }];
      }
      // v54: Filter students by class_id at DB level
      return Promise.all([
        Promise.resolve({ data: classes, error: null }),
        db.from('students').select('id, name, class_id, coins, last_checkin_date, last_jianghu_date, last_pk_date, active_pet_id, pk_count_today, shop_items, equipped_items, password, quiz_state, snack_requests').in('class_id', classIds),
        db.from('pets').select('id, student_id, name, nickname, level, growth, coins, is_active, is_dead, last_feed_date, last_play_date, today_feed_count, today_play_count, penalty_streak')
      ]).then(function(results) {
        // Filter pets to teacher's students client-side
        var studentIds = (results[1].data || []).map(function(s) { return s.id; });
        results[2].data = (results[2].data || []).filter(function(p) { return studentIds.indexOf(p.student_id) >= 0; });
        return results;
      });
    });
  }

  return queries.then(function(results) {
    var classesR = results[0], studentsR = results[1], petsR = results[2];
    if (isStudent && classesR.error) throw classesR.error;
    if (classesR.error && !isStudent) throw classesR.error;
    
    var classes = isStudent ? [classesR.data] : (classesR.data || []);
    var allStudents = studentsR.data || [];
    var allPets = petsR.data || [];

    // Filter to relevant students/pets
    if (!isStudent) {
      var classIds = classes.map(function(c) { return c.id; });
      allStudents = allStudents.filter(function(s) { return classIds.indexOf(s.class_id) >= 0; });
      var studentIds = allStudents.map(function(s) { return s.id; });
      allPets = allPets.filter(function(p) { return studentIds.indexOf(p.student_id) >= 0; });
    } else {
      var classStudentIds = allStudents.map(function(s) { return s.id; });
      allPets = allPets.filter(function(p) { return classStudentIds.indexOf(p.student_id) >= 0; });
    }

    // If no snapshot yet, just do a full load (first refresh after init)
    if (!_snapshotClassesData) {
      console.log('[DAL] No snapshot — doing full load');
      return loadFromSupabase();
    }

    // Build a map of fresh student data from Supabase
    var freshStudentMap = {};
    allStudents.forEach(function(s) {
      freshStudentMap[s.id] = {
        id: s.id,
        name: s.name || '',
        coins: s.coins || 0,
        lastCheckinDate: s.last_checkin_date || null,
        lastJianghuDate: s.last_jianghu_date || null,
        lastPkDate: s.last_pk_date || null,
        activePetId: s.active_pet_id || null,
        pkCountToday: s.pk_count_today || 0,
        shopItems: (function() { try { return typeof s.shop_items === 'string' ? JSON.parse(s.shop_items) : (s.shop_items || []); } catch(e) { return []; } })(),
        equippedItems: (function() { try { return typeof s.equipped_items === 'string' ? JSON.parse(s.equipped_items) : (s.equipped_items || {}); } catch(e) { return {}; } })(),
        password: s.password || '',
        quizState: (function() { try { return typeof s.quiz_state === 'string' ? JSON.parse(s.quiz_state) : (s.quiz_state || null); } catch(e) { return null; } })()
      };
    });

    // Build a map of fresh pet data from Supabase
    var freshPetMap = {}; // keyed by pet id
    var freshPetByStudent = {}; // keyed by student id
    allPets.forEach(function(p) {
      var pet = {
        id: p.id,
        name: p.name || '',
        nickname: p.nickname || '',
        level: p.level || 1,
        growth: p.growth || 0,
        coins: p.coins || 0,
        isActive: !!p.is_active,
        isDead: !!p.is_dead,
        lastFeedDate: p.last_feed_date || null,
        lastPlayDate: p.last_play_date || null,
        todayFeedCount: p.today_feed_count || 0,
        todayPlayCount: p.today_play_count || 0,
        penaltyStreak: p.penalty_streak || 0
      };
      _capPetGrowth(pet);
      freshPetMap[p.id] = pet;
      if (!freshPetByStudent[p.student_id]) freshPetByStudent[p.student_id] = [];
      freshPetByStudent[p.student_id].push(pet);
    });

    // Now merge into existing classesData
    var changesApplied = 0;
    classesData.forEach(function(cls) {
      cls.students.forEach(function(localStu) {
        var freshStu = freshStudentMap[localStu.id];
        if (!freshStu) return;
        
        var snapStu = _findStudentInSnapshot(localStu.id);
        
        // For each field, check: has it changed on server? Has it changed locally?
        // coins: special handling for student's own coins
        if (isStudent && localStu.id == studentId) {
          // v30: Use _myBaseCoins (only updated after confirmed server write) instead of
          // snapshot (which is taken right after local write, before server confirms).
          // The old snapshot comparison was broken: after sync, snapshot=local=95,
          // but if Realtime reads stale Supabase data (100), the condition
          // freshStu(100) !== snap(95) && local(95) === snap(95) was TRUE,
          // causing the stale server value to overwrite the student's spent coins.
          if (_myBaseCoins !== null) {
            if (freshStu.coins !== _myBaseCoins && localStu.coins === _myBaseCoins) {
              // Server changed (e.g., teacher reward) and local matches base → apply
              localStu.coins = freshStu.coins;
              _myBaseCoins = freshStu.coins;
              changesApplied++;
            }
            // If local changed (student spent coins), localStu.coins !== _myBaseCoins → keep local
          } else if (snapStu) {
            // Fallback: _myBaseCoins not yet set (first load), use snapshot
            var snapCoins = snapStu.coins;
            if (freshStu.coins !== snapCoins && localStu.coins === snapCoins) {
              localStu.coins = freshStu.coins;
              changesApplied++;
            }
          }
        } else {
          // For other students (teacher viewing, or student viewing classmates)
          var snapCoins = snapStu ? snapStu.coins : null;
          if (snapCoins !== null) {
            if (freshStu.coins !== snapCoins && localStu.coins === snapCoins) {
              // Server changed, local didn't → apply
              localStu.coins = freshStu.coins;
              changesApplied++;
            }
            // If local changed too → keep local (we'll sync it soon)
          } else if (freshStu.coins !== localStu.coins) {
            // No snapshot — trust server value
            localStu.coins = freshStu.coins;
            changesApplied++;
          }
        }

        // lastCheckinDate: apply from server if changed on server and not changed locally
        var snapCheckin = snapStu ? snapStu.lastCheckinDate : null;
        if (freshStu.lastCheckinDate !== snapCheckin && localStu.lastCheckinDate === snapCheckin) {
          localStu.lastCheckinDate = freshStu.lastCheckinDate;
          changesApplied++;
        }
        
        // lastPkDate
        var snapPk = snapStu ? snapStu.lastPkDate : null;
        if (freshStu.lastPkDate !== snapPk && localStu.lastPkDate === snapPk) {
          localStu.lastPkDate = freshStu.lastPkDate;
          changesApplied++;
        }
        
        // v34: lastJianghuDate — sync from server if changed on server and not changed locally
        var snapJianghu = snapStu ? snapStu.lastJianghuDate : null;
        if (freshStu.lastJianghuDate !== snapJianghu && localStu.lastJianghuDate === snapJianghu) {
          localStu.lastJianghuDate = freshStu.lastJianghuDate;
          changesApplied++;
        }
        
        // pkCountToday
        var snapPkToday = snapStu ? (snapStu.pkCountToday || 0) : 0;
        if ((freshStu.pkCountToday || 0) !== snapPkToday && (localStu.pkCountToday || 0) === snapPkToday) {
          localStu.pkCountToday = freshStu.pkCountToday || 0;
          changesApplied++;
        }

        // v39: shopItems — sync from server if changed on server and not changed locally
        var snapShopItems = snapStu ? JSON.stringify(snapStu.shopItems || []) : null;
        var freshShopItems = JSON.stringify(freshStu.shopItems || []);
        var localShopItems = JSON.stringify(localStu.shopItems || []);
        if (snapShopItems !== null) {
          if (freshShopItems !== snapShopItems && localShopItems === snapShopItems) {
            // Server changed, local didn't → apply
            localStu.shopItems = freshStu.shopItems || [];
            changesApplied++;
          }
          // If local changed too (student purchased), keep local
        } else if (freshShopItems !== localShopItems) {
          // No snapshot — trust server value
          localStu.shopItems = freshStu.shopItems || [];
          changesApplied++;
        }

        // v39: equippedItems — sync from server if changed on server and not changed locally
        var snapEquipped = snapStu ? JSON.stringify(snapStu.equippedItems || {}) : null;
        var freshEquipped = JSON.stringify(freshStu.equippedItems || {});
        var localEquipped = JSON.stringify(localStu.equippedItems || {});
        if (snapEquipped !== null) {
          if (freshEquipped !== snapEquipped && localEquipped === snapEquipped) {
            // Server changed, local didn't → apply
            localStu.equippedItems = freshStu.equippedItems || {};
            changesApplied++;
          }
          // If local changed too (student equipped/unequipped), keep local
        } else if (freshEquipped !== localEquipped) {
          // No snapshot — trust server value
          localStu.equippedItems = freshStu.equippedItems || {};
          changesApplied++;
        }

        // quizState: sync from server if changed on server and not changed locally
        // v31: Skip if quiz_state was recently saved directly (e.g., by pig-run saveLevelResult).
        // Without this check, a Realtime event can overwrite fresh local quiz_state with stale
        // Supabase data, causing pig-run level scores/coins to be lost.
        if (freshStu.quizState && !window._quizStateLocallyModified) {
          var snapQuizState = snapStu ? JSON.stringify(snapStu.quizState || null) : null;
          var freshQuizState = JSON.stringify(freshStu.quizState);
          var localQuizState = JSON.stringify(localStu.quizState || null);
          if (freshQuizState !== snapQuizState && localQuizState === snapQuizState) {
            localStu.quizState = freshStu.quizState;
            changesApplied++;
          }
        }

        // Merge pets for this student
        var freshPetsForStudent = freshPetByStudent[localStu.id] || [];
        if (!localStu.pets) localStu.pets = [];
        
        freshPetsForStudent.forEach(function(freshPet) {
          var localPet = null;
          for (var i = 0; i < localStu.pets.length; i++) {
            if (localStu.pets[i].id === freshPet.id) { localPet = localStu.pets[i]; break; }
          }
          
          if (localPet) {
            // Existing pet — merge
            var snapPet = _findPetInSnapshot(freshPet.id);
            
            // growth: v30 — for current student's own pets, use _myBasePets (confirmed server value)
            // instead of snapshot (which may reflect local-unconfirmed writes)
            if (isStudent && localStu.id == studentId && _myBasePets[freshPet.id] !== undefined) {
              var baseGrowth = _myBasePets[freshPet.id];
              if (freshPet.growth !== baseGrowth && localPet.growth === baseGrowth) {
                // Server changed and local matches base → apply
                localPet.growth = freshPet.growth;
                _myBasePets[freshPet.id] = freshPet.growth;
                changesApplied++;
              }
              // If local changed (student interaction), keep local
            } else {
              // For other students' pets or when _myBasePets not set, use snapshot
              var snapGrowth = snapPet ? (snapPet.growth || 0) : null;
              if (snapGrowth !== null) {
                if (freshPet.growth !== snapGrowth && localPet.growth === snapGrowth) {
                  localPet.growth = freshPet.growth;
                  changesApplied++;
                }
              } else if (freshPet.growth !== localPet.growth) {
                localPet.growth = freshPet.growth;
                changesApplied++;
              }
            }
            
            // isDead
            var snapDead = snapPet ? !!snapPet.isDead : null;
            if (snapDead !== null && freshPet.isDead !== snapDead && !!localPet.isDead === snapDead) {
              localPet.isDead = freshPet.isDead;
              changesApplied++;
            }
            
            // level
            var snapLevel = snapPet ? snapPet.level : null;
            if (snapLevel !== null && freshPet.level !== snapLevel && localPet.level === snapLevel) {
              localPet.level = freshPet.level;
              changesApplied++;
            }
            
            // lastFeedDate, lastPlayDate
            var snapFeed = snapPet ? snapPet.lastFeedDate : null;
            if (freshPet.lastFeedDate !== snapFeed && localPet.lastFeedDate === snapFeed) {
              localPet.lastFeedDate = freshPet.lastFeedDate;
              changesApplied++;
            }
            var snapPlay = snapPet ? snapPet.lastPlayDate : null;
            if (freshPet.lastPlayDate !== snapPlay && localPet.lastPlayDate === snapPlay) {
              localPet.lastPlayDate = freshPet.lastPlayDate;
              changesApplied++;
            }
            
            // todayFeedCount, todayPlayCount
            var snapFeedCount = snapPet ? (snapPet.todayFeedCount || 0) : 0;
            if ((freshPet.todayFeedCount || 0) !== snapFeedCount && (localPet.todayFeedCount || 0) === snapFeedCount) {
              localPet.todayFeedCount = freshPet.todayFeedCount || 0;
              changesApplied++;
            }
            var snapPlayCount = snapPet ? (snapPet.todayPlayCount || 0) : 0;
            if ((freshPet.todayPlayCount || 0) !== snapPlayCount && (localPet.todayPlayCount || 0) === snapPlayCount) {
              localPet.todayPlayCount = freshPet.todayPlayCount || 0;
              changesApplied++;
            }
          } else {
            // New pet from server — add it
            localStu.pets.push(Object.assign({}, freshPet));
            if (isStudent && localStu.id == studentId) _myBasePets[freshPet.id] = freshPet.growth || 0;
            changesApplied++;
          }
        });
      });
    });

    // For student: update _myBaseCoins after merge
    if (isStudent) {
      var myStu = null;
      if (classesData[0]) {
        for (var i = 0; i < classesData[0].students.length; i++) {
          if (classesData[0].students[i].id == studentId) { myStu = classesData[0].students[i]; break; }
        }
      }
      if (myStu && _myBaseCoins === null) {
        _myBaseCoins = myStu.coins;
      }
    }

    // Update snapshot to reflect current merged state
    _takeSnapshot();

    console.log('[DAL] Smart refresh complete — ' + changesApplied + ' changes applied from server');
    if (isStudent && changesApplied > 0) {
      console.log('[DAL] Student saw ' + changesApplied + ' updates from teacher/other students');
    }
    
    return Promise.resolve();
  });
}

/* ===== Load: Teacher ===== */
function _buildTeacherClasses(classes, students, pets) {
  var studentMap = {};
  students.forEach(function(s) {
    studentMap[s.id] = {
      id: s.id,
      name: s.name || '',
      coins: (s.coins != null ? s.coins : 50),
      pets: [],
      lastCheckinDate: s.last_checkin_date || null,
      lastJianghuDate: s.last_jianghu_date || null,
      lastPkDate: s.last_pk_date || null,
      activePetId: s.active_pet_id || null,
      pkCountToday: s.pk_count_today || 0,
      shopItems: (function() { try { return typeof s.shop_items === 'string' ? JSON.parse(s.shop_items) : (s.shop_items || []); } catch(e) { return []; } })(),
      equippedItems: (function() { try { return typeof s.equipped_items === 'string' ? JSON.parse(s.equipped_items) : (s.equipped_items || {}); } catch(e) { return {}; } })(),
        password: s.password || '',
        quizState: (function() { try { return typeof s.quiz_state === 'string' ? JSON.parse(s.quiz_state) : (s.quiz_state || null); } catch(e) { return null; } })(),
        snackRequests: (function() { try { return typeof s.snack_requests === 'string' ? JSON.parse(s.snack_requests) : (s.snack_requests || []); } catch(e) { return []; } })()
      };
  });

  var petByStudent = {};
  pets.forEach(function(p) {
    var sid = p.student_id;
    if (!petByStudent[sid]) petByStudent[sid] = [];
    var _pet = {
      id: p.id,
      name: p.name || '',
      nickname: p.nickname || '',
      level: p.level || 1,
      growth: p.growth || 0,
      coins: p.coins || 0,
      isActive: !!p.is_active,
      isDead: !!p.is_dead,
      lastFeedDate: p.last_feed_date || null,
      lastPlayDate: p.last_play_date || null,
      todayFeedCount: p.today_feed_count || 0,
      todayPlayCount: p.today_play_count || 0,
      penaltyStreak: p.penalty_streak || 0
    };
    _capPetGrowth(_pet);
    petByStudent[sid].push(_pet);
  });

  var classMap = {};
  classes.forEach(function(c) {
    classMap[c.id] = {
      id: c.id,
      name: c.name || '',
      teacher_id: c.teacher_id,
      students: [],
      createdAt: c.created_at || null
    };
  });

  students.forEach(function(s) {
    var cid = s.class_id;
    if (classMap[cid]) {
      var stu = studentMap[s.id];
      stu.pets = petByStudent[s.id] || [];
      classMap[cid].students.push(stu);
    }
  });

  // 应用保存的学生排序顺序（教师拖拽排序）
  Object.keys(classMap).forEach(function(cid) {
    var cls = classMap[cid];
    if (cls.students.length > 0 && typeof applyStudentOrder === 'function') {
      cls.students = applyStudentOrder(parseInt(cid), cls.students);
    }
  });

  return classes.map(function(c) { return classMap[c.id]; }).filter(Boolean);
}

function _loadTeacherFromSupabase() {
  // v54: Sequential queries — first get class IDs, then filter students/pets at DB level.
  // This avoids fetching ALL students/pets from the entire database.
  return db.from('classes').select(_CLASS_COLS).eq('teacher_id', currentUser.id).order('id')
  .then(function(classesR) {
    if (classesR.error) { console.error('[DAL] classes error:', classesR.error); throw classesR.error; }
    var classes = classesR.data || [];
    var classIds = classes.map(function(c) { return c.id; });

    if (classIds.length === 0) {
      // No classes — nothing to load
      classesData = [];
      _takeSnapshot();
      _saveToCache();
      // v61: Must return same shape as full-load path [classes, studentsResult, petsResult]
      // because the next .then() expects results[1].data and results[2].data.
      // Still load custom actions and operation logs in parallel.
      return Promise.all([_loadCustomActions(), _loadOperationLogs()]).then(function() {
        return [classes, { data: [], error: null }, { data: [], error: null }];
      });
    }

    // v54: Filter students by class_id at DB level (not client-side)
    return Promise.all([
      Promise.resolve(classes),
      db.from('students').select('id, name, class_id, coins, last_checkin_date, last_jianghu_date, last_pk_date, active_pet_id, pk_count_today, shop_items, equipped_items, password, quiz_state, snack_requests').in('class_id', classIds),
      db.from('pets').select('id, student_id, name, nickname, level, growth, coins, is_active, is_dead, last_feed_date, last_play_date, today_feed_count, today_play_count, penalty_streak')
    ]);
  }).then(function(results) {
    var classes = results[0];
    var students = (results[1].data || []);
    if (results[1].error) console.warn('[DAL] students error:', results[1].error);
    var pets = (results[2].data || []);
    if (results[2].error) console.warn('[DAL] pets error:', results[2].error);

    // v54: Filter pets by student_id at DB level would require another query round-trip.
    // Instead, filter client-side from the already-filtered student set (much smaller than full table).
    var classIds = classes.map(function(c) { return c.id; });
    var studentIds = students.map(function(s) { return s.id; });
    pets = pets.filter(function(p) { return studentIds.indexOf(p.student_id) >= 0; });

    var newClassesData = _buildTeacherClasses(classes, students, pets);
    classesData = newClassesData;

    console.log('[DAL] Loaded ' + classes.length + ' classes, ' + students.length + ' students, ' + pets.length + ' pets');
    newClassesData.forEach(function(c) {
      console.log('[DAL]   Class ' + c.id + ' "' + c.name + '": ' + c.students.length + ' students');
    });

    // Take snapshot after initial load
    _takeSnapshot();

    // v45: Save to localStorage cache for instant next-load
    _saveToCache();

    return Promise.all([
      _loadCustomActions(),
      _loadOperationLogs()
    ]);
  });
}

/* ===== Load: Student ===== */
function _loadStudentFromSupabase() {
  var studentId = parseInt(localStorage.getItem('studentId'));
  var classId = parseInt(localStorage.getItem('classId'));
  if (!studentId || !classId) {
    return Promise.reject(new Error('Missing studentId or classId'));
  }

  return Promise.all([
    db.from('classes').select(_CLASS_COLS).eq('id', classId).single(),
    db.from('students').select('id, name, class_id, coins, last_checkin_date, last_jianghu_date, last_pk_date, active_pet_id, pk_count_today, shop_items, equipped_items, password, quiz_state, snack_requests').eq('class_id', classId),
    db.from('pets').select('id, student_id, name, nickname, level, growth, coins, is_active, is_dead, last_feed_date, last_play_date, today_feed_count, today_play_count, penalty_streak')
  ]).then(function(results) {
    var classR = results[0], studentsR = results[1], petsR = results[2];
    if (classR.error) throw classR.error;

    var classInfo = classR.data;
    var allStudents = studentsR.data || [];
    var allPets = petsR.data || [];

    // Filter pets to students in this class
    var classStudentIds = allStudents.map(function(s) { return s.id; });
    var classPets = allPets.filter(function(p) { return classStudentIds.indexOf(p.student_id) >= 0; });

    // Build classesData with current student first
    var studentMap = {};
    allStudents.forEach(function(s) {
      studentMap[s.id] = {
        id: s.id,
        name: s.name || '',
        coins: (s.coins != null ? s.coins : 50),
        pets: [],
        lastCheckinDate: s.last_checkin_date || null,
        lastJianghuDate: s.last_jianghu_date || null,
        lastPkDate: s.last_pk_date || null,
        activePetId: s.active_pet_id || null,
        pkCountToday: s.pk_count_today || 0,
        shopItems: (function() { try { return typeof s.shop_items === 'string' ? JSON.parse(s.shop_items) : (s.shop_items || []); } catch(e) { return []; } })(),
        equippedItems: (function() { try { return typeof s.equipped_items === 'string' ? JSON.parse(s.equipped_items) : (s.equipped_items || {}); } catch(e) { return {}; } })(),
        password: s.password || '',
        quizState: (function() { try { return typeof s.quiz_state === 'string' ? JSON.parse(s.quiz_state) : (s.quiz_state || null); } catch(e) { return null; } })(),
        snackRequests: (function() { try { return typeof s.snack_requests === 'string' ? JSON.parse(s.snack_requests) : (s.snack_requests || []); } catch(e) { return []; } })()
      };
    });

    classPets.forEach(function(p) {
      var sid = p.student_id;
      if (studentMap[sid]) {
        var _pet3 = {
          id: p.id,
          name: p.name || '',
          nickname: p.nickname || '',
          level: p.level || 1,
          growth: p.growth || 0,
          coins: p.coins || 0,
          isActive: !!p.is_active,
          isDead: !!p.is_dead,
          lastFeedDate: p.last_feed_date || null,
          lastPlayDate: p.last_play_date || null,
          todayFeedCount: p.today_feed_count || 0,
          todayPlayCount: p.today_play_count || 0,
          penaltyStreak: p.penalty_streak || 0
        };
        _capPetGrowth(_pet3);
        studentMap[sid].pets.push(_pet3);
      }
    });

    // Put current student first
    var myStudent = studentMap[studentId];
    var classmates = [];
    if (myStudent) classmates.push(myStudent);
    Object.keys(studentMap).forEach(function(sid) {
      sid = parseInt(sid);
      if (sid !== studentId) classmates.push(studentMap[sid]);
    });

    // 应用保存的学生排序顺序（教师设置的排序）
    if (typeof applyStudentOrder === 'function') {
      classmates = applyStudentOrder(classId, classmates);
      // 确保当前学生仍然在第一位（学生视角）
      if (myStudent) {
        var myIdx = classmates.findIndex(function(s) { return s.id == studentId; });
        if (myIdx > 0) {
          classmates.splice(myIdx, 1);
          classmates.unshift(myStudent);
        }
      }
    }

    classesData = [{
      id: classInfo.id,
      name: classInfo.name || '',
      teacher_id: classInfo.teacher_id,
      students: classmates,
      createdAt: classInfo.created_at || null
    }];

    // Record base coins for this student — used in _syncStudentToSupabase to compute local delta
    if (myStudent) {
      _myBaseCoins = myStudent.coins;
      _myBasePets = {};
      (myStudent.pets || []).forEach(function(p) { _myBasePets[p.id] = p.growth || 0; });
    }

    // Take snapshot after initial load
    _takeSnapshot();

    console.log('[DAL] Student loaded: ' + classmates.length + ' classmates, ' + classPets.length + ' pets');

    // v45: Save to localStorage cache for instant next-load
    _saveToCache();

    return Promise.all([
      _loadCustomActions(),
      _loadOperationLogs()
    ]);
  });
}

/* ===== Load: Custom Actions & Logs ===== */
function _loadCustomActions() {
  if (!currentUser || !currentUser.id) return Promise.resolve();
  // Custom actions are per-class; load all classes for this teacher
  return db.from('classes').select('id').eq('teacher_id', currentUser.id).then(function(classR) {
    if (classR.error || !classR.data) return;
    var classIds = classR.data.map(function(c) { return c.id; });
    if (classIds.length === 0) return;
    return db.from('custom_actions').select('*').in('class_id', classIds);
  }).then(function(r) {
    if (r && r.data && typeof customActions !== 'undefined') {
      customActions = r.data.map(function(a) {
        return { id: a.id, class_id: a.class_id, name: a.name, coins: a.coins };
      });
    }
  }).catch(function(e) { console.warn('[DAL] custom_actions load error:', e); });
}

/* ===== Operation Logs: classes.operation_logs_json architecture (v29) =====
 *
 * v29: Logs are stored as JSON in the classes table — same sync channel as student data.
 * No more operation_logs table (had FK constraints that broke on mobile).
 * Uses upsert (same pattern as student coins) — proven reliable.
 * Max 5000 logs per class — oldest are trimmed automatically.
 * v104: Logs older than 3 days are automatically removed (keep max 5000).
 *
 * WRITE: UI action → saveLogs() → _writeUnsyncedLogsToSupabase() → classes.upsert
 * READ:  init/refresh → _loadOperationLogs() → classes.select → parse JSON
 */

var _OP_LOGS_MAX_PER_CLASS = 3000; // v105: Reduced from 5000 to 3000
var _OP_LOGS_RETENTION_DAYS = 3; // v104: Keep only last 3 days (reduced from 7 days)

// v68: Filter logs to keep only those within retention period
function _filterLogsByRetention(logs) {
  var cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - _OP_LOGS_RETENTION_DAYS);
  var cutoffTimestamp = cutoffDate.toISOString();
  
  return logs.filter(function(log) {
    return log.timestamp && log.timestamp >= cutoffTimestamp;
  });
}

// Get class IDs for this user
function _getOpLogClassIds() {
  if (currentUser.type === 'teacher') {
    return db.from('classes').select('id').eq('teacher_id', currentUser.id).then(function(r) {
      if (r.error || !r.data) return [];
      return r.data.map(function(c) { return c.id; });
    });
  } else {
    var classId = parseInt(localStorage.getItem('classId')) || (currentUser.classId ? parseInt(currentUser.classId) : 0);
    if (!classId) return Promise.resolve([]);
    return Promise.resolve([classId]);
  }
}

// v29: Load operation logs from classes.operation_logs_json
function _loadOperationLogs() {
  if (!currentUser || !currentUser.id) return Promise.resolve();
  if (!db) {
    console.warn('[DAL] _loadOperationLogs: db not initialized');
    return Promise.resolve();
  }
  if (typeof window.operationLogs === 'undefined') {
    try { window.operationLogs = JSON.parse(localStorage.getItem('operationLogs')) || []; } catch(e) { window.operationLogs = []; }
  }

  return _getOpLogClassIds().then(function(classIds) {
    if (!classIds || classIds.length === 0) {
      console.warn('[DAL] v29 _loadOperationLogs: no classIds');
      return;
    }
    console.log('[DAL] v29 Loading operation logs from classes table for class_ids:', classIds);

    // v29: Read from classes.operation_logs_json — same channel as student data
    return db.from('classes').select('id, operation_logs_json').in('id', classIds);
  }).then(function(r) {
    if (!r) return;
    if (r.error) {
      console.error('[DAL] v29 classes query FAILED:', r.error.message);
      return;
    }

    // Parse operation_logs_json from each class
    var allLogs = [];
    (r.data || []).forEach(function(cls) {
      if (!cls.operation_logs_json) return;
      try {
        var logs = JSON.parse(cls.operation_logs_json);
        if (Array.isArray(logs)) {
          // v104: Do NOT filter by retention at load time — old logs must stay
          // in window.operationLogs so they can be written back during merges.
          // Retention filtering is now only at display time (getAllLogsForMonth).
          logs.forEach(function(l) {
            l._synced = true;
            l._fromSupabase = true;
            if (!l.classId) l.classId = cls.id;
            allLogs.push(l);
          });
        }
      } catch(e) {
        console.warn('[DAL] v29 Failed to parse operation_logs_json for class', cls.id, e);
      }
    });

    // v105: Preserve ALL local logs that aren't on the server (fixes race condition)
    // Previously only kept logs with _synced=false, but logs marked _synced=true
    // before write confirmation could be lost if Realtime triggered a reload.
    var serverLogIds = {};
    allLogs.forEach(function(l) { serverLogIds[l.id] = true; });
    
    var localOnly = [];
    var localUnsynced = [];
    (window.operationLogs || []).forEach(function(l) {
      if (!serverLogIds[l.id]) {
        // Local log not on server — preserve it regardless of _synced status
        localOnly.push(l);
      }
      if (!l._synced) {
        localUnsynced.push(l);
      }
    });

    // v34: Deduplicate — if local unsynced log has same ID as a server log, local wins (it's newer)
    var dedupedServer = allLogs.filter(function(l) {
      // Remove server log if local has a newer unsynced version
      for (var i = 0; i < localUnsynced.length; i++) {
        if (localUnsynced[i].id === l.id) return false;
      }
      return true;
    });

    window.operationLogs = dedupedServer.concat(localOnly);
    window.operationLogs.sort(function(a, b) {
      return (b.timestamp || '').localeCompare(a.timestamp || '');
    });

    // Backup to localStorage
    try { localStorage.setItem('operationLogs', JSON.stringify(window.operationLogs)); } catch(e) {}
    console.log('[DAL] v105 Loaded ' + allLogs.length + ' logs from Supabase, ' + localOnly.length + ' local-only preserved (' + localUnsynced.length + ' unsynced)');

    // v114: For STUDENTS, also read their own pending_logs_json.
    // Students write to students.pending_logs_json (they CANNOT write to classes table — RLS blocks).
    // Without this, students can write logs but never see them in their history view.
    // The teacher merge moves pending logs into classes.operation_logs_json eventually,
    // but students need to see their own logs immediately.
    if (currentUser.type === 'student') {
      var studentId = parseInt(localStorage.getItem('studentId'));
      if (studentId) {
        return db.from('students').select('id, pending_logs_json').eq('id', studentId).then(function(stuR) {
          if (stuR.error) {
            if (stuR.error.message && stuR.error.message.indexOf('pending_logs_json') >= 0) {
              console.log('[DAL] v114 pending_logs_json column not found — skipping');
              return;
            }
            console.warn('[DAL] v114 Failed to read student pending logs:', stuR.error.message);
            return;
          }
          if (!stuR.data || stuR.data.length === 0) return;
          var stu = stuR.data[0];
          if (!stu.pending_logs_json || stu.pending_logs_json === '[]' || stu.pending_logs_json === 'null') return;
          
          try {
            var pendingLogs = JSON.parse(stu.pending_logs_json);
            if (!Array.isArray(pendingLogs) || pendingLogs.length === 0) return;
            
            console.log('[DAL] v114 Loaded ' + pendingLogs.length + ' pending logs from students table for student ' + studentId);
            
            // Merge pending logs into window.operationLogs (dedup by ID)
            var existingIds = {};
            window.operationLogs.forEach(function(l) { existingIds[l.id] = true; });
            
            pendingLogs.forEach(function(l) {
              if (!existingIds[l.id]) {
                l._synced = true; // They're "synced" to Supabase (in pending_logs_json)
                l._fromSupabase = true;
                if (!l.classId) l.classId = parseInt(localStorage.getItem('classId')) || 0;
                window.operationLogs.push(l);
                existingIds[l.id] = true;
              }
            });
            
            window.operationLogs.sort(function(a, b) {
              return (b.timestamp || '').localeCompare(a.timestamp || '');
            });
            
            try { localStorage.setItem('operationLogs', JSON.stringify(window.operationLogs)); } catch(e) {}
            console.log('[DAL] v114 Total logs after merge: ' + window.operationLogs.length);
          } catch(e) {
            console.warn('[DAL] v114 Failed to parse student pending logs:', e.message);
          }
        });
      }
    }

    // v111: For teachers, also merge student pending logs into classes.operation_logs_json.
    // Students write to students.pending_logs_json (they can't UPDATE classes due to RLS).
    // The teacher reads those pending logs, merges them into the class, and clears them.
    if (currentUser.type === 'teacher' && classIds.length > 0) {
      return _mergeStudentPendingLogs(classIds).then(function(mergedCount) {
        if (mergedCount > 0) {
          console.log('[DAL] v111 Merged ' + mergedCount + ' student pending logs');
          // Re-load after merge to include the newly merged logs
          return _loadOperationLogsAfterMerge(classIds);
        }
      });
    }
  }).catch(function(e) {
    console.warn('[DAL] v29 _loadOperationLogs error:', e);
  });
}

// v111: Read pending_logs_json from all students in the given classes,
// merge into classes.operation_logs_json, then clear students.pending_logs_json.
function _mergeStudentPendingLogs(classIds) {
  if (!classIds || classIds.length === 0) return Promise.resolve(0);

  // Step 1: Read all students with pending logs in these classes
  return db.from('students')
    .select('id, class_id, pending_logs_json')
    .in('class_id', classIds)
    .not('pending_logs_json', 'is', null)
    .then(function(stuR) {
      if (stuR.error) {
        // Column might not exist yet — silently skip
        if (stuR.error.message && stuR.error.message.indexOf('pending_logs_json') >= 0) {
          console.log('[DAL] v111 pending_logs_json column not found — skipping student log merge');
          return 0;
        }
        console.warn('[DAL] v111 Failed to read student pending logs:', stuR.error.message);
        return 0;
      }
      var studentsWithPending = (stuR.data || []).filter(function(s) {
        return s.pending_logs_json && s.pending_logs_json !== '[]' && s.pending_logs_json !== 'null';
      });
      if (studentsWithPending.length === 0) return 0;

      console.log('[DAL] v111 Found ' + studentsWithPending.length + ' students with pending logs');

      // Step 2: Group pending logs by class, and track merged log IDs per student
      var pendingByClass = {};
      var studentsToClear = [];
      var mergedLogIdsByStudent = {}; // v119: Track which log IDs to remove per student
      studentsWithPending.forEach(function(s) {
        try {
          var pending = JSON.parse(s.pending_logs_json);
          if (!Array.isArray(pending) || pending.length === 0) return;
          var cid = s.class_id;
          if (!pendingByClass[cid]) pendingByClass[cid] = [];
          pendingByClass[cid] = pendingByClass[cid].concat(pending);
          studentsToClear.push(s.id);
          // v119: Record which log IDs belong to this student
          mergedLogIdsByStudent[s.id] = pending.map(function(l) { return l.id; });
        } catch(e) {}
      });

      if (studentsToClear.length === 0) return 0;

      // Step 3: For each class, read existing logs, merge pending, write back
      var mergeClassIds = Object.keys(pendingByClass).map(Number);
      return db.from('classes').select('id, operation_logs_json').in('id', mergeClassIds).then(function(clsR) {
        if (clsR.error) {
          console.warn('[DAL] v111 Failed to read class logs for merge:', clsR.error.message);
          return 0;
        }
        var existingByClass = {};
        (clsR.data || []).forEach(function(c) {
          try {
            existingByClass[c.id] = c.operation_logs_json ? JSON.parse(c.operation_logs_json) : [];
          } catch(e) { existingByClass[c.id] = []; }
        });

        var updatePromises = mergeClassIds.map(function(cid) {
          var existing = existingByClass[cid] || [];
          var pending = pendingByClass[cid] || [];
          var existingById = {};
          existing.forEach(function(l, idx) { existingById[l.id] = idx; });

          var addedCount = 0;
          pending.forEach(function(l) {
            var merged = {
              id: l.id, timestamp: l.timestamp || new Date().toISOString(),
              classId: cid, studentId: l.studentId, studentName: l.studentName || '',
              actionType: l.actionType || '', details: l.details || '',
              coinDelta: parseInt(l.coinDelta) || 0, expDelta: parseInt(l.expDelta) || 0,
              petId: l.petId || null, extra: l.extra || null,
              snapshot: l.snapshot || null, fullSnapshot: l.fullSnapshot || null,
              reverted: !!l.reverted, _synced: true, _fromSupabase: true
            };
            if (existingById[l.id] !== undefined) {
              existing[existingById[l.id]] = merged;
            } else {
              existing.push(merged);
              existingById[l.id] = existing.length - 1;
              addedCount++;
            }
          });

          if (addedCount === 0) return Promise.resolve(0);

          existing.sort(function(a, b) { return (b.timestamp || '').localeCompare(a.timestamp || ''); });
          if (existing.length > 3000) existing = existing.slice(0, 3000);

          return db.from('classes').update({
            operation_logs_json: JSON.stringify(existing)
          }).eq('id', cid).then(function(ur) {
            if (ur.error) {
              console.warn('[DAL] v111 Failed to merge logs for class', cid + ':', ur.error.message);
              return 0;
            }
            console.log('[DAL] v111 Merged ' + addedCount + ' pending logs into class', cid);
            return addedCount;
          });
        });

        return Promise.all(updatePromises).then(function(results) {
          var totalMerged = results.reduce(function(sum, n) { return sum + (n || 0); }, 0);
          // v120: Step 4 — DO NOT clear students.pending_logs_json.
          //
          // Why: The student's _syncWriteStudentPendingLogs() REPLACES pending_logs_json
          // with only the current unsynced logs on every call. So after the student's next
          // action, the old pending logs are naturally overwritten with new content.
          //
          // Previous approaches (v111 set to null, v119 re-read-and-filter) had race conditions:
          // if a student wrote new logs between the teacher's read and write, the new logs
          // could be lost. By not touching pending_logs_json at all, we eliminate the race
          // condition completely.
          //
          // Trade-off: The teacher's periodic merge re-reads already-merged logs. This is
          // harmless because the merge function deduplicates by log ID (addedCount=0 → skip
          // DB update). The student's pending_logs_json is naturally bounded in size because
          // the student only sends unsynced logs (typically 0-2 per action).
          if (totalMerged > 0) {
            console.log('[DAL] v120 Merged ' + totalMerged + ' pending logs (not clearing — student will overwrite on next action)');
          }
          return totalMerged;
        });
      });
    });
}

// v111: Re-load operation logs after merging student pending logs.
// This ensures the teacher sees the freshly merged logs immediately.
function _loadOperationLogsAfterMerge(classIds) {
  return db.from('classes').select('id, operation_logs_json').in('id', classIds).then(function(r) {
    if (r.error) return;
    var allLogs = [];
    (r.data || []).forEach(function(cls) {
      if (!cls.operation_logs_json) return;
      try {
        var logs = JSON.parse(cls.operation_logs_json);
        if (Array.isArray(logs)) {
          logs.forEach(function(l) {
            l._synced = true;
            l._fromSupabase = true;
            if (!l.classId) l.classId = cls.id;
            allLogs.push(l);
          });
        }
      } catch(e) {}
    });
    // Preserve local-only logs
    var serverLogIds = {};
    allLogs.forEach(function(l) { serverLogIds[l.id] = true; });
    var localOnly = (window.operationLogs || []).filter(function(l) { return !serverLogIds[l.id]; });
    window.operationLogs = allLogs.concat(localOnly);
    window.operationLogs.sort(function(a, b) {
      return (b.timestamp || '').localeCompare(a.timestamp || '');
    });
    try { localStorage.setItem('operationLogs', JSON.stringify(window.operationLogs)); } catch(e) {}
    console.log('[DAL] v111 Re-loaded ' + allLogs.length + ' logs after merge');
  });
}

// Write unsynced logs to Supabase IMMEDIATELY.
// v26: Added write lock to prevent concurrent writes, comprehensive logging, and retry queue.
var _writingLogsToSupabase = false;
var _pendingLogWrites = 0;

// v65: Verify that our logs weren't overwritten by another device's concurrent write.
// If our logs are missing, re-read from Supabase, re-merge, and re-write.
// Retries up to 3 times with increasing delays.
function _verifyLogWrite(classId, writtenLogIds, retryCount) {
  if (retryCount >= 3 || !writtenLogIds || writtenLogIds.length === 0) {
    return Promise.resolve();
  }
  // Wait 500ms to let any concurrent writes settle
  return new Promise(function(resolve) {
    setTimeout(resolve, 500 + retryCount * 500);
  }).then(function() {
    return db.from('classes').select('id, operation_logs_json').eq('id', classId).single();
  }).then(function(r) {
    if (r.error || !r.data) {
      console.warn('[DAL] v65 Verify read failed for class', classId + ':', r.error ? r.error.message : 'no data');
      return;
    }
    var serverLogs = [];
    try {
      serverLogs = r.data.operation_logs_json ? JSON.parse(r.data.operation_logs_json) : [];
    } catch(e) { serverLogs = []; }
    
    // Check which of our logs are missing
    var serverLogIds = {};
    serverLogs.forEach(function(l) { serverLogIds[l.id] = true; });
    var missingIds = writtenLogIds.filter(function(id) { return !serverLogIds[id]; });
    
    if (missingIds.length === 0) {
      console.log('[DAL] v65 Verify OK: all', writtenLogIds.length, 'logs present for class', classId);
      return;
    }
    
    console.warn('[DAL] v65 CONFLICT DETECTED! ' + missingIds.length + '/' + writtenLogIds.length + 
      ' logs overwritten by another device for class', classId, '(retry ' + retryCount + ')');
    
    // Re-merge: take server logs + add our missing logs
    var merged = serverLogs.slice();
    var mergedById = {};
    merged.forEach(function(l, idx) { mergedById[l.id] = idx; });
    
    // Find our missing logs from window.operationLogs
    var addedCount = 0;
    missingIds.forEach(function(missingId) {
      for (var i = 0; i < window.operationLogs.length; i++) {
        if (window.operationLogs[i].id === missingId) {
          var l = window.operationLogs[i];
          var mergedLog = {
            id: l.id,
            timestamp: l.timestamp || new Date().toISOString(),
            classId: classId,
            studentId: l.studentId,
            studentName: l.studentName || '',
            actionType: l.actionType || '',
            details: l.details || '',
            coinDelta: parseInt(l.coinDelta) || 0,
            expDelta: parseInt(l.expDelta) || 0,
            petId: l.petId || null,
            extra: l.extra || null,
            snapshot: l.snapshot || null,
            fullSnapshot: l.fullSnapshot || null,
            reverted: !!l.reverted,
            _synced: true,
            _fromSupabase: true
          };
          if (mergedById[l.id] !== undefined) {
            merged[mergedById[l.id]] = mergedLog;
          } else {
            merged.push(mergedLog);
            mergedById[l.id] = merged.length - 1;
            addedCount++;
          }
          break;
        }
      }
    });
    
    if (addedCount === 0) {
      console.log('[DAL] v65 No missing logs found locally, skipping re-write');
      return;
    }
    
    // Sort and cap
    merged.sort(function(a, b) {
      return (b.timestamp || '').localeCompare(a.timestamp || '');
    });
    
    // v68: Retention filter removed from write path — filtering at write time
    // permanently deletes old logs from DB, causing data loss on concurrent writes.
    // Retention is now only applied at load/display time (line ~904).
    
    if (merged.length > _OP_LOGS_MAX_PER_CLASS) {
      merged = merged.slice(0, _OP_LOGS_MAX_PER_CLASS);
    }
    
    console.log('[DAL] v65 Re-merging: added', addedCount, 'missing logs, total:', merged.length);
    
    // Re-write
    return db.from('classes').update({
      operation_logs_json: JSON.stringify(merged)
    }).eq('id', classId).then(function(ur) {
      if (ur.error) {
        console.error('[DAL] v65 Re-write failed:', ur.error.message);
      } else {
        console.log('[DAL] v65 Re-write OK:', merged.length, 'logs for class', classId);
        _lastOwnWriteTime = Date.now();
        // Verify again to make sure our re-write wasn't overwritten
        return _verifyLogWrite(classId, writtenLogIds, retryCount + 1);
      }
    });
  });
}

// v29: Write unsynced logs to classes.operation_logs_json — same channel as student data.
// Uses upsert (proven reliable on mobile). Max 5000 logs per class, oldest trimmed.
function _writeUnsyncedLogsToSupabase() {
  if (_writingLogsToSupabase) {
    console.log('[DAL] v29 Write already in progress, queueing...');
    _pendingLogWrites++;
    return Promise.resolve();
  }

  if (!db || !currentUser) {
    console.warn('[DAL] v29 Cannot write logs: db or currentUser not ready');
    return Promise.resolve();
  }
  if (typeof window.operationLogs === 'undefined' || !Array.isArray(window.operationLogs)) {
    console.warn('[DAL] v29 Cannot write logs: window.operationLogs invalid');
    return Promise.resolve();
  }

  // Collect unsynced logs: new logs (negative ID) OR modified logs (marked _synced=false after being true)
  var unsynced = [];
  for (var i = 0; i < window.operationLogs.length; i++) {
    if (!window.operationLogs[i]._synced) {
      unsynced.push({ index: i, log: window.operationLogs[i] });
    }
  }

  if (unsynced.length === 0) {
    return Promise.resolve();
  }

  // v114: STUDENT PATH — Write to students.pending_logs_json using sync XHR.
  // CRITICAL: Students CANNOT UPDATE classes table (RLS blocks anon key — verified by direct API test).
  // Previous versions (v109-v113) tried writing to classes.operation_logs_json — ALL silently failed.
  // Students write to students.pending_logs_json (confirmed working with anon key).
  // Teacher-side merge moves these into classes.operation_logs_json.
  // Student-side _loadOperationLogs() also reads pending_logs_json so students see their own history.
  if (currentUser.type === 'student') {
    // v122: Use ASYNC XHR as primary path for student log writing.
    // Previously used sync XHR (_syncWriteStudentPendingLogs), but sync XHR is
    // frequently blocked on mobile browsers, especially with large payloads.
    // The coins were saved via _syncStudentDataImmediate() (small payload, proven working),
    // but logs were lost because _syncWriteStudentPendingLogs() (large payload) was blocked.
    //
    // Now: async XHR is the primary path. It's not blocked by mobile browsers.
    // v122 also added pending_logs_json to _syncStudentDataImmediate() so logs
    // ride along the proven working sync XHR path too.
    console.log('[DAL] v122 Writing ' + unsynced.length + ' unsynced logs via async XHR');
    _writeStudentPendingLogsAsync();
    return Promise.resolve();
  }

  // === TEACHER PATH (existing logic) ===
  console.log('[DAL] v29 Writing ' + unsynced.length + ' unsynced logs to classes table');

  // Determine fallback classId
  var defaultClassId = null;
  if (currentUser.type === 'teacher') {
    defaultClassId = (typeof currentClassId !== 'undefined' && currentClassId) ? currentClassId :
                     (classesData && classesData[0] ? classesData[0].id : null);
  } else {
    defaultClassId = parseInt(localStorage.getItem('classId')) ||
                     (classesData && classesData[0] ? classesData[0].id : null);
  }

  if (!defaultClassId) {
    console.error('[DAL] v29 Cannot write logs - classId is null!');
    return Promise.resolve();
  }

  _writingLogsToSupabase = true;

  // Group unsynced logs by classId
  var logsByClass = {};
  unsynced.forEach(function(entry) {
    var l = entry.log;
    var cid = l.classId || defaultClassId;
    if (typeof cid === 'string') cid = parseInt(cid);
    if (!logsByClass[cid]) logsByClass[cid] = [];
    logsByClass[cid].push(entry);
  });

  var classIds = Object.keys(logsByClass).map(Number);

  // Step 1: Read existing logs from Supabase for affected classes
  return db.from('classes').select('id, operation_logs_json').in('id', classIds).then(function(r) {
    if (r.error) {
      console.error('[DAL] v29 Failed to read existing logs:', r.error.message);
      _writingLogsToSupabase = false;
      setTimeout(function() { _writeUnsyncedLogsToSupabase(); }, 5000);
      return;
    }

    // Parse existing logs from Supabase
    var existingByClass = {};
    (r.data || []).forEach(function(cls) {
      try {
        existingByClass[cls.id] = cls.operation_logs_json ? JSON.parse(cls.operation_logs_json) : [];
      } catch(e) {
        existingByClass[cls.id] = [];
      }
    });

    // Step 2: Merge — add new logs to existing, UPDATE modified logs, mark as synced
    // v62: Filter out classes that don't exist in Supabase yet (e.g., new classes with string IDs)
    // These logs will be written after the class is synced and gets a valid ID
    var validClassIds = classIds.filter(function(cid) {
      return existingByClass[cid] !== undefined;
    });
    var skippedClassIds = classIds.filter(function(cid) {
      return existingByClass[cid] === undefined;
    });
    if (skippedClassIds.length > 0) {
      console.log('[DAL] v62 Skipping', skippedClassIds.length, 'classes not yet in Supabase:', skippedClassIds);
    }

    // v70: Release lock before early return to prevent permanent block.
    // Without this, _writingLogsToSupabase stays true and all future writes are skipped.
    if (validClassIds.length === 0) {
      console.log('[DAL] v70 No valid classes to write logs to, skipping');
      _writingLogsToSupabase = false;
      return Promise.resolve();
    }
    
    // v64: Re-read existing logs from Supabase RIGHT BEFORE writing.
    // This is critical to prevent the race condition where two devices read the same
    // data, each adds their new log, and the last writer overwrites the other's log.
    // By re-reading immediately before writing, we get the latest data from other devices.
    return db.from('classes').select('id, operation_logs_json').in('id', validClassIds).then(function(freshR) {
      if (freshR.error) {
        console.error('[DAL] v64 Failed to re-read logs before write:', freshR.error.message);
        // Fall back to initial read data
        freshR = { data: [] };
      }
      var freshByClass = {};
      (freshR.data || []).forEach(function(cls) {
        try {
          freshByClass[cls.id] = cls.operation_logs_json ? JSON.parse(cls.operation_logs_json) : [];
        } catch(e) { freshByClass[cls.id] = []; }
      });

      var upsertPromises = validClassIds.map(function(cid) {
        // v64: Use FRESH data from Supabase (not stale initial read)
        var existing = freshByClass[cid] || [];
        var newLogs = logsByClass[cid] || [];

        // Build index of existing logs by ID for deduplication
        var existingById = {};
        existing.forEach(function(l, idx) { existingById[l.id] = idx; });

        newLogs.forEach(function(entry) {
          var l = entry.log;
          var merged = {
            id: l.id,
            timestamp: l.timestamp || new Date().toISOString(),
            classId: cid,
            studentId: l.studentId,
            studentName: l.studentName || '',
            actionType: l.actionType || '',
            details: l.details || '',
            coinDelta: parseInt(l.coinDelta) || 0,
            expDelta: parseInt(l.expDelta) || 0,
            petId: l.petId || null,
            extra: l.extra || null,
            snapshot: l.snapshot || null,
            fullSnapshot: l.fullSnapshot || null,
            reverted: !!l.reverted,
            _synced: true,
            _fromSupabase: true
          };

          // v34: If log with same ID already exists (modified log), REPLACE it instead of duplicating
          if (existingById[l.id] !== undefined) {
            existing[existingById[l.id]] = merged;
          } else {
            existing.push(merged);
            existingById[l.id] = existing.length - 1;
          }

          // v109: Do NOT mark as synced here — wait until DB write succeeds.
          // On mobile, the page may be killed before the write completes,
          // leaving logs marked _synced=true but never actually in Supabase.
        });

        // Sort by timestamp descending, cap at max
        existing.sort(function(a, b) {
          return (b.timestamp || '').localeCompare(a.timestamp || '');
        });
        
        // v68: Retention filter removed from write path — filtering at write time
        // permanently deletes old logs from DB, causing data loss on concurrent writes.
        // Retention is now only applied at load/display time (line ~904).
        
        // Cap at max
        if (existing.length > _OP_LOGS_MAX_PER_CLASS) {
          existing = existing.slice(0, _OP_LOGS_MAX_PER_CLASS);
        }

        // v28: Use update (not upsert) to only modify operation_logs_json.
        // v65: Track the log IDs we wrote for verification
        var writtenLogIds = newLogs.map(function(entry) { return entry.log.id; });
        return db.from('classes').update({
          operation_logs_json: JSON.stringify(existing)
        }).eq('id', cid).then(function(ur) {
          if (ur.error) {
            console.error('[DAL] v29 Upsert FAILED for class', cid + ':', ur.error.message);
            // Mark logs as unsynced again so they retry
            (logsByClass[cid] || []).forEach(function(entry) {
              if (entry.index >= 0 && entry.index < window.operationLogs.length) {
                window.operationLogs[entry.index]._synced = false;
              }
            });
          } else {
            console.log('[DAL] v65 Upserted ' + existing.length + ' logs for class', cid);
            // v109: NOW mark local logs as synced (after DB write succeeded)
            (logsByClass[cid] || []).forEach(function(entry) {
              if (entry.index >= 0 && entry.index < window.operationLogs.length) {
                window.operationLogs[entry.index]._synced = true;
                window.operationLogs[entry.index]._fromSupabase = true;
              }
            });
            // v64: Update own write time to prevent unnecessary realtime refresh
            _lastOwnWriteTime = Date.now();
            // v65: Verify our logs weren't overwritten by another device
            return _verifyLogWrite(cid, writtenLogIds, 0);
          }
        });
      });

      return Promise.all(upsertPromises);
    });
  }).then(function() {
    _writingLogsToSupabase = false;

    // Persist to localStorage
    try { localStorage.setItem('operationLogs', JSON.stringify(window.operationLogs)); } catch(e) {}

    var syncedCount = unsynced.filter(function(entry) {
      return window.operationLogs[entry.index] && window.operationLogs[entry.index]._synced;
    }).length;
    console.log('[DAL] v29 Write complete: ' + syncedCount + '/' + unsynced.length + ' logs synced');

    // Retry if some failed
    if (syncedCount < unsynced.length) {
      console.warn('[DAL] v29 ' + (unsynced.length - syncedCount) + ' logs still unsynced, retry in 5s');
      setTimeout(function() { _writeUnsyncedLogsToSupabase(); }, 5000);
    }

    // Process queued writes
    if (_pendingLogWrites > 0) {
      _pendingLogWrites = 0;
      return _writeUnsyncedLogsToSupabase();
    }
  }).catch(function(err) {
    _writingLogsToSupabase = false;
    console.error('[DAL] v29 CRITICAL: write exception:', err.message);
    setTimeout(function() { _writeUnsyncedLogsToSupabase(); }, 5000);
  });
}

// Diagnostic function - call from browser console to check operation logs status
window._checkOpLogsStatus = function() {
  console.log('=== Operation Logs Status ===');
  console.log('Total logs in memory:', window.operationLogs ? window.operationLogs.length : 0);
  console.log('Synced logs:', window.operationLogs ? window.operationLogs.filter(function(l) { return l._synced; }).length : 0);
  console.log('Unsynced logs:', window.operationLogs ? window.operationLogs.filter(function(l) { return !l._synced; }).length : 0);
  console.log('From Supabase:', window.operationLogs ? window.operationLogs.filter(function(l) { return l._fromSupabase; }).length : 0);
  console.log('Current user:', currentUser);
  console.log('Current class ID:', typeof currentClassId !== 'undefined' ? currentClassId : 'undefined');
  console.log('Classes data:', classesData ? classesData.length + ' classes' : 'undefined');
  console.log('DB initialized:', !!db);
  console.log('Writing in progress:', _writingLogsToSupabase);
  console.log('Pending writes:', _pendingLogWrites);
  
  // v65: Show detailed info about unsynced logs
  if (window.operationLogs) {
    var unsynced = window.operationLogs.filter(function(l) { return !l._synced; });
    if (unsynced.length > 0) {
      console.log('\n=== Unsynced Logs Details ===');
      var classIdStats = {};
      unsynced.forEach(function(l) {
        var cid = l.classId || 'null';
        if (!classIdStats[cid]) classIdStats[cid] = 0;
        classIdStats[cid]++;
      });
      console.log('Unsynced logs by classId:', classIdStats);
      console.log('Sample unsynced logs:', unsynced.slice(0, 5).map(function(l) {
        return { id: l.id, classId: l.classId, actionType: l.actionType, timestamp: l.timestamp };
      }));
    }
  }
  
  if (db && currentUser) {
    var classIds = [];
    if (currentUser.type === 'teacher') {
      db.from('classes').select('id').eq('teacher_id', currentUser.id).then(function(r) {
        if (r.data) classIds = r.data.map(function(c) { return c.id; });
        console.log('Teacher class IDs:', classIds);
        return db.from('operation_logs').select('id, class_id, action_type, created_at').in('class_id', classIds).order('created_at', { ascending: false }).limit(10);
      }).then(function(r) {
        if (r.data) {
          console.log('Recent logs in Supabase:', r.data.length);
          console.table(r.data);
        } else {
          console.error('Query failed:', r.error);
        }
      });
    } else {
      var classId = parseInt(localStorage.getItem('classId'));
      console.log('Student class ID from localStorage:', classId);
      db.from('operation_logs').select('id, class_id, action_type, created_at').eq('class_id', classId).order('created_at', { ascending: false }).limit(10).then(function(r) {
        if (r.data) {
          console.log('Recent logs in Supabase for class', classId + ':', r.data.length);
          console.table(r.data);
        } else {
          console.error('Query failed:', r.error);
        }
      });
    }
  }
  return 'Check browser console for details';
};

// v65: Force sync unsynced logs - useful for debugging and fixing sync issues
window._forceSyncLogs = function() {
  if (!window.operationLogs) {
    console.log('No operation logs found');
    return 'No operation logs found';
  }
  
  var unsynced = window.operationLogs.filter(function(l) { return !l._synced; });
  console.log('Found', unsynced.length, 'unsynced logs');
  
  if (unsynced.length === 0) {
    console.log('All logs are already synced');
    return 'All logs are already synced';
  }
  
  // Show breakdown by classId
  var byClass = {};
  unsynced.forEach(function(l) {
    var cid = l.classId || 'null';
    if (!byClass[cid]) byClass[cid] = [];
    byClass[cid].push(l);
  });
  
  console.log('Unsynced logs by classId:');
  Object.keys(byClass).forEach(function(cid) {
    console.log('  classId', cid, ':', byClass[cid].length, 'logs');
    console.log('    Sample:', byClass[cid][0]);
  });
  
  // Trigger sync
  console.log('Triggering sync...');
  if (typeof _writeUnsyncedLogsToSupabase === 'function') {
    _writeUnsyncedLogsToSupabase();
    return 'Sync triggered. Check console for results.';
  } else {
    return 'Sync function not available';
  }
};

/* ===== Main Load Entry ===== */
function loadFromSupabase() {
  if (currentUser && currentUser.type === 'student') {
    return _loadStudentFromSupabase();
  } else {
    return _loadTeacherFromSupabase();
  }
}

/* ===== Save ===== */
// v48: INT4 max — class/student/pet IDs from Date.now() overflow PostgreSQL integer
// The classes table id column is INT4 (max 2147483647), but Date.now() returns ~1.78 trillion.
// This caused ALL syncs to fail silently for new teachers (HTTP 400 on class upsert).
var _INT4_MAX = 2147483647;
function _isValidInt4Id(id) {
  return typeof id === 'number' && id > 0 && id <= _INT4_MAX && id === Math.floor(id);
}

function _syncTeacherToSupabase() {
  // === Phase 1: Insert/Upsert classes FIRST (v48: resolve real IDs before processing students) ===
  var classPromises = [];
  var newStudents = [];   // { payload, stuRef }
  var existingStudents = []; // { payload, stuRef }
  // v48: Track ID mappings for new classes (string/overflow ID → real DB ID)
  var classIdMap = {}; // oldId → newId

  // v59: Build set of CURRENT class IDs to detect classes deleted during sync.
  // deleteClass() reassigns classesData to a new array, but the forEach below
  // captures the OLD array reference. Without this check, a deleted class would
  // be re-upserted by the running sync, causing the "delete doesn't persist" bug.
  var currentClassIdSet = {};
  classesData.forEach(function(c) { currentClassIdSet[c.id] = true; });

  classesData.forEach(function(cls) {
    // v59: Skip if this class was deleted from classesData during this sync
    // (deleteClass() reassigned the global classesData, removing this class)
    if (!currentClassIdSet[cls.id]) {
      console.log('[DAL] v59 Skipping deleted class ' + cls.id + ' in Phase 1');
      // Track for Phase 6 cleanup — ensure it gets deleted from Supabase
      if (_isValidInt4Id(cls.id) && _syncDeletedClassIds.indexOf(cls.id) === -1) {
        _syncDeletedClassIds.push(cls.id);
      }
      return;
    }
    var isNewClass = !_isValidInt4Id(cls.id);

    if (isNewClass) {
      // v48: New class — INSERT without id, let DB auto-generate INT4 ID
      var insertPayload = { name: cls.name, teacher_id: currentUser.id };
      classPromises.push(
        db.from('classes').insert([insertPayload]).select().then(function(r) {
          if (r.error) {
            console.error('[DAL] v48 class insert error:', r.error);
            return;
          }
          if (r.data && r.data[0]) {
            var oldId = cls.id;
            var newId = r.data[0].id;
            cls.id = newId;
            classIdMap[oldId] = newId;
            console.log('[DAL] v48 New class "' + cls.name + '" → DB ID ' + newId + ' (was ' + oldId + ')');
          }
        })
      );
    } else {
      // Existing class with valid INT4 ID — upsert
      classPromises.push(
        db.from('classes').upsert([{
          id: cls.id,
          name: cls.name,
          teacher_id: currentUser.id
        }]).then(function(r) {
          if (r.error) console.error('[DAL] class upsert error:', r.error);
        })
      );
    }
  });

  // === Phase 1b: Wait for class IDs, then categorize students (v48: class_id now uses real IDs) ===
  return Promise.all(classPromises).then(function() {
    // v48: Update currentClassId and other references BEFORE processing students
    var oldKeys = Object.keys(classIdMap);
    if (oldKeys.length > 0) {
      console.log('[DAL] v48 Resolved ' + oldKeys.length + ' new class IDs');

      // Update currentClassId if it points to a remapped class
      if (typeof currentClassId !== 'undefined' && classIdMap[currentClassId]) {
        var oldClassId = currentClassId;
        currentClassId = classIdMap[currentClassId];
        console.log('[DAL] v48 currentClassId: ' + oldClassId + ' → ' + currentClassId);
      }

      // Update customActions class_id references
      if (typeof customActions !== 'undefined') {
        customActions.forEach(function(a) {
          if (classIdMap[a.class_id]) {
            a.class_id = classIdMap[a.class_id];
          }
        });
      }

      // Update operationLogs classId references
      if (typeof window.operationLogs !== 'undefined') {
        window.operationLogs.forEach(function(l) {
          // v62: Handle both string and numeric classId to prevent type mismatch
          var oldId = l.classId;
          if (classIdMap[oldId]) {
            l.classId = classIdMap[oldId];
          } else if (classIdMap[String(oldId)]) {
            l.classId = classIdMap[String(oldId)];
          } else if (classIdMap[parseInt(oldId)]) {
            l.classId = classIdMap[parseInt(oldId)];
          }
        });
      }
    }

    // v48: NOW categorize students — cls.id is already the real DB ID
    classesData.forEach(function(cls) {
      cls.students.forEach(function(stu) {
        var payload = {
          name: stu.name,
          class_id: cls.id,
          coins: stu.coins || 0,
          last_checkin_date: stu.lastCheckinDate || null,
          last_jianghu_date: stu.lastJianghuDate || null,
          last_pk_date: stu.lastPkDate || null,
          active_pet_id: stu.activePetId || null,
          pk_count_today: stu.pkCountToday || 0,
          password: stu.password || ''
        };
        // v126: Include quiz_state in insert payload for new students to prevent
        // race condition where Realtime refresh overwrites local quizState with
        // empty server data before the separate quizState write completes.
        if (stu.quizState) {
          payload.quiz_state = typeof stu.quizState === 'string' ? stu.quizState : JSON.stringify(stu.quizState);
        }

        if (typeof _isValidInt4Id === 'function' && _isValidInt4Id(stu.id)) {
          existingStudents.push({ payload: Object.assign({ id: stu.id }, payload), stuRef: stu });
        } else {
          newStudents.push({ payload: payload, stuRef: stu });
        }
      });
    });

    // === Phase 2: Insert new students first to get real IDs ===
    if (newStudents.length === 0) return;
    var promises = newStudents.map(function(item) {
      return db.from('students').insert([item.payload]).select().then(function(r) {
        if (r.error) { console.error('[DAL] new student insert error:', r.error); return; }
        if (r.data && r.data[0]) {
          item.stuRef.id = r.data[0].id;
          console.log('[DAL] New student "' + item.stuRef.name + '" → ID ' + item.stuRef.id);
        }
      });
    });
    return Promise.all(promises);
  }).then(function() {
    // === Phase 3: Sync ALL pets (now all students have real IDs) ===
    // We build pet payloads HERE, after students have real IDs
    var allPetPromises = [];
    var studentsToUpsert = [];

    classesData.forEach(function(cls) {
      cls.students.forEach(function(stu) {
        if (!stu.id || stu.id <= 0) return;

        // Sync pets for this student
        if (stu.pets && stu.pets.length > 0) {
          stu.pets.forEach(function(pet) {
            // Build payload NOW with the correct (real) student_id
            var petPayload = {
              student_id: stu.id,
              name: pet.name,
              nickname: pet.nickname || '',
              level: pet.level || 1,
              growth: pet.growth || 0,
              coins: pet.coins || 0,
              is_active: (stu.activePetId === pet.id),
              is_dead: !!pet.isDead,
              last_feed_date: pet.lastFeedDate || null,
              last_play_date: pet.lastPlayDate || null,
              today_feed_count: pet.todayFeedCount || 0,
              today_play_count: pet.todayPlayCount || 0,
              penalty_streak: pet.penaltyStreak || 0
            };

            if (pet.id && pet.id > 0 && pet.id === Math.floor(pet.id)) {
              // Existing pet with valid Supabase ID
              petPayload.id = pet.id;
              // v102: Mark this pet row as recently written (teacher echo protection)
              _markRowWritten('pets', pet.id);
              allPetPromises.push(
                db.from('pets').upsert([petPayload]).then(function(r) {
                  if (r.error) console.error('[DAL] pet upsert error:', r.error);
                })
              );
            } else {
              // New pet — INSERT (without id field)
              var oldLocalId = pet.id;
              allPetPromises.push(
                db.from('pets').insert([petPayload]).select().then(function(r) {
                  if (r.error) { console.error('[DAL] pet insert error:', r.error); return; }
                  if (r.data && r.data[0]) {
                    pet.id = r.data[0].id;
                    // v102: Mark newly inserted pet row
                    _markRowWritten('pets', pet.id);
                    if (stu.activePetId === oldLocalId) {
                      stu.activePetId = pet.id;
                    }
                    console.log('[DAL] New pet "' + pet.name + '" → ID ' + pet.id);
                  }
                })
              );
            }
          });
        }

        // Collect all students to upsert AFTER pets are synced
        studentsToUpsert.push(stu);
      });
    });

    // Wait for all pets, then update ALL students with correct active_pet_id
    return Promise.all(allPetPromises).then(function() {
        // v43: No need to fetch shop_items from DB — using .update() instead of .upsert()
        // means student-owned fields (shop_items, equipped_items) are never touched.
        var studentUpsertPromises = studentsToUpsert.map(function(stu) {
          // v102: Mark this student row as recently written (teacher echo protection)
          _markRowWritten('students', stu.id);
          var payload = {
            id: stu.id,
            name: stu.name,
            class_id: (classesData.find(function(c) { return c.students.indexOf(stu) >= 0; }) || {}).id || null,
            coins: stu.coins || 0,
            last_checkin_date: stu.lastCheckinDate || null,
            last_jianghu_date: stu.lastJianghuDate || null,
            last_pk_date: stu.lastPkDate || null,
            active_pet_id: stu.activePetId || null,
            pk_count_today: stu.pkCountToday || 0,
            // v43: REMOVED shop_items and equipped_items — teacher NEVER writes these.
            // Using .update() (not .upsert()) so only specified fields are modified.
            // This eliminates ALL race conditions with student shop purchases.
            password: stu.password || '',
            snack_requests: JSON.stringify(stu.snackRequests || [])
          };
          // v43: Use .update() instead of .upsert() to avoid overwriting student-owned
          // fields (shop_items, equipped_items). .update() only touches listed fields.
          return db.from('students').update(payload).eq('id', stu.id).then(function(r) {
            if (r.error) {
              console.error('[DAL] student update error:', r.error);
              // v43 fallback: if update fails (e.g., student doesn't exist), try insert
              var insertPayload = Object.assign({}, payload);
              delete insertPayload.id;
              insertPayload.shop_items = '[]';
              insertPayload.equipped_items = '{}';
              return db.from('students').insert([Object.assign({ id: stu.id }, insertPayload)]).then(function(insR) {
                if (insR.error) {
                  console.error('[DAL] student insert fallback error:', insR.error.message);
                  // Ultimate fallback: save coins only
                  return db.from('students').update({ coins: stu.coins || 0 }).eq('id', stu.id).then(function(fr) {
                    if (fr.error) console.error('[DAL] teacher coins fallback error:', fr.error.message);
                  });
                }
                console.log('[DAL] Student "' + stu.name + '" inserted via fallback (ID: ' + stu.id + ')');
              });
            }
          }).then(function() {
            // v30: Save quiz_state separately after update
            if (stu.quizState) {
              var qs = typeof stu.quizState === 'string' ? stu.quizState : JSON.stringify(stu.quizState);
              return db.from('students').update({ quiz_state: qs }).eq('id', stu.id).then(function(qr) {
                if (qr.error) console.warn('[DAL] teacher quiz_state save failed:', qr.error.message);
              });
            }
          });
        });
        return Promise.all(studentUpsertPromises);
    }).then(function() {
        // === Phase 3b (v44): Save shop_items and equipped_items for ALL students ===
        // v43 removed these from the teacher update payload to prevent race conditions
        // with student purchases. But this also prevented TEACHER-INITIATED purchases
        // from being saved. Fix: fetch current DB values first, then merge (union) with
        // local values. This preserves BOTH teacher-initiated AND student-initiated purchases.
        var teacherClassIds = classesData.map(function(c) { return c.id; });
        if (teacherClassIds.length === 0) return;
        return db.from('students').select('id, shop_items, equipped_items').in('class_id', teacherClassIds).then(function(fetchR) {
          if (fetchR.error) {
            console.warn('[DAL] v44: failed to fetch student shop_items for merge:', fetchR.error.message);
            return;
          }
          var dbShopMap = {};
          (fetchR.data || []).forEach(function(s) {
            dbShopMap[s.id] = {
              shop_items: (function() { try { return typeof s.shop_items === 'string' ? JSON.parse(s.shop_items) : (s.shop_items || []); } catch(e) { return []; } })(),
              equipped_items: (function() { try { return typeof s.equipped_items === 'string' ? JSON.parse(s.equipped_items) : (s.equipped_items || {}); } catch(e) { return {}; } })()
            };
          });
          var shopSavePromises = [];
          classesData.forEach(function(cls) {
            cls.students.forEach(function(stu) {
              if (!stu.id || stu.id <= 0) return;
              var dbItems = dbShopMap[stu.id] || { shop_items: [], equipped_items: {} };
              var localItems = stu.shopItems || [];
              var localEquipped = stu.equippedItems || {};
              // Merge: union of DB items and local items (preserves both teacher and student purchases)
              var mergedItems = dbItems.shop_items.slice();
              localItems.forEach(function(itemId) {
                if (mergedItems.indexOf(itemId) === -1) mergedItems.push(itemId);
              });
              // Merge equipped: DB values + local values (local takes precedence for same category)
              var mergedEquipped = {};
              Object.keys(dbItems.equipped_items).forEach(function(k) { mergedEquipped[k] = dbItems.equipped_items[k]; });
              Object.keys(localEquipped).forEach(function(k) { mergedEquipped[k] = localEquipped[k]; });
              // Only save if something changed from DB
              var shopChanged = mergedItems.length !== dbItems.shop_items.length ||
                mergedItems.some(function(item) { return dbItems.shop_items.indexOf(item) === -1; });
              var equippedChanged = JSON.stringify(mergedEquipped) !== JSON.stringify(dbItems.equipped_items);
              if (shopChanged || equippedChanged) {
                var updatePayload = {};
                if (shopChanged) updatePayload.shop_items = JSON.stringify(mergedItems);
                if (equippedChanged) updatePayload.equipped_items = JSON.stringify(mergedEquipped);
                shopSavePromises.push(
                  db.from('students').update(updatePayload).eq('id', stu.id).then(function(r) {
                    if (r.error) {
                      console.warn('[DAL] v44: shop_items merge save failed for student ' + stu.id + ':', r.error.message);
                    } else {
                      console.log('[DAL] v44: shop_items merged for student ' + stu.id + ': ' + JSON.stringify(mergedItems));
                    }
                  })
                );
              }
            });
          });
          return Promise.all(shopSavePromises);
        });
    });
  }).then(function() {
    // === Phase 4: Delete students that were removed locally ===
    // Build set of local student IDs (only valid INT4 IDs)
    var localStudentIds = {};
    classesData.forEach(function(cls) {
      cls.students.forEach(function(stu) {
        if (typeof _isValidInt4Id === 'function' && _isValidInt4Id(stu.id)) {
          localStudentIds[stu.id] = true;
        }
      });
    });
    // Query Supabase for all students in teacher's classes
    var teacherClassIds = classesData.map(function(c) { return c.id; });
    if (teacherClassIds.length > 0) {
      return db.from('students').select('id').in('class_id', teacherClassIds).then(function(r) {
        if (r.error) { console.error('[DAL] student delete check error:', r.error); return; }
        var supabaseStudents = r.data || [];
        var toDelete = [];
        supabaseStudents.forEach(function(s) {
          if (!localStudentIds[s.id]) {
            toDelete.push(s.id);
          }
        });
        if (toDelete.length > 0) {
          console.log('[DAL] Deleting', toDelete.length, 'students from Supabase that were removed locally:', toDelete);
          // First delete their operation_logs (to avoid FK constraint errors)
          return db.from('operation_logs').delete().in('student_id', toDelete).then(function(lr) {
            if (lr.error) console.error('[DAL] operation_logs delete error:', lr.error);
            // Then delete their pets
            return db.from('pets').delete().in('student_id', toDelete);
          }).then(function(pr) {
            if (pr.error) console.error('[DAL] pet delete error:', pr.error);
            // Then delete the students
            return db.from('students').delete().in('id', toDelete);
          }).then(function(sr) {
            if (sr.error) console.error('[DAL] student delete error:', sr.error);
            else console.log('[DAL] Deleted', toDelete.length, 'students from Supabase');
          });
        }
      });
    }
  }).then(function() {
    // === Phase 5: Save custom actions ===
    if (typeof customActions !== 'undefined' && customActions.length > 0) {
      // v55: Build set of valid class IDs to filter out orphaned custom_actions
      var validClassIds = {};
      classesData.forEach(function(cls) {
        if (_isValidInt4Id(cls.id)) {
          validClassIds[cls.id] = true;
        }
      });
      var actionPayloads = customActions.map(function(a) {
        return {
          class_id: a.class_id || (classesData[0] ? classesData[0].id : null),
          name: a.name,
          coins: a.coins || 0
        };
      }).filter(function(a) { 
        // v55: Only include custom_actions with valid class_id (exists in classesData)
        return a.class_id && validClassIds[a.class_id]; 
      });
      if (actionPayloads.length > 0) {
        var classIds = Array.from(new Set(actionPayloads.map(function(a) { return a.class_id; })));
        return db.from('custom_actions').delete().in('class_id', classIds).then(function() {
          return db.from('custom_actions').insert(actionPayloads);
        }).then(function(r) {
          if (r.error) console.error('[DAL] custom_actions save error:', r.error);
        });
      }
    }
  }).then(function() {
    // === Phase 6 (v54): Delete classes from Supabase that were removed locally ===
    // This fixes the bug where deleted classes reappear after page reload.
    var localClassIds = {};
    classesData.forEach(function(cls) {
      if (_isValidInt4Id(cls.id)) {
        localClassIds[cls.id] = true;
      }
    });
    return db.from('classes').select('id').eq('teacher_id', currentUser.id).then(function(r) {
      if (r.error) { console.error('[DAL] v54 class delete check error:', r.error); return; }
      var supabaseClasses = r.data || [];
      var toDelete = [];
      supabaseClasses.forEach(function(c) {
        if (!localClassIds[c.id]) {
          toDelete.push(c.id);
        }
      });
      // v59: Also include classes tracked as deleted during sync (race condition fix)
      // These are classes that Phase 1 skipped because they were deleted mid-sync
      _syncDeletedClassIds.forEach(function(id) {
        if (toDelete.indexOf(id) === -1) {
          toDelete.push(id);
          console.log('[DAL] v59 Phase 6: also deleting tracked-deleted class', id);
        }
      });
      // Clear the tracking array after use
      _syncDeletedClassIds = [];
      if (toDelete.length > 0) {
        console.log('[DAL] v54 Deleting', toDelete.length, 'classes from Supabase that were removed locally:', toDelete);
        // First delete students and pets in those classes
        return db.from('students').select('id').in('class_id', toDelete).then(function(stuR) {
          var studentIds = (stuR.data || []).map(function(s) { return s.id; });
          var chain = Promise.resolve();
          if (studentIds.length > 0) {
            // Delete operation_logs first (to avoid FK constraint errors)
            chain = chain.then(function() {
              return db.from('operation_logs').delete().in('student_id', studentIds);
            }).then(function(lr) {
              if (lr.error) console.error('[DAL] v54 operation_logs delete error:', lr.error);
              // Delete pets
              return db.from('pets').delete().in('student_id', studentIds);
            }).then(function(pr) {
              if (pr.error) console.error('[DAL] v54 pet delete error:', pr.error);
              // Then delete students
              return db.from('students').delete().in('id', studentIds);
            }).then(function(sr) {
              if (sr.error) console.error('[DAL] v54 student delete error:', sr.error);
              else console.log('[DAL] v54 Deleted', studentIds.length, ' students from removed classes');
            });
          }
          // v55: Delete custom_actions referencing these classes (fixes 409 FK constraint error)
          return chain.then(function() {
            return db.from('custom_actions').delete().in('class_id', toDelete);
          }).then(function(caR) {
            if (caR.error) console.error('[DAL] v55 custom_actions delete error:', caR.error);
            else console.log('[DAL] v55 Deleted custom_actions for removed classes');
            // Then delete the classes
            return db.from('classes').delete().in('id', toDelete);
          }).then(function(cr) {
            if (cr.error) console.error('[DAL] v54 class delete error:', cr.error);
            else console.log('[DAL] v54 Deleted', toDelete.length, ' classes from Supabase');
          });
        });
      }
    });
  });
}

function _syncStudentToSupabase() {
  var studentId = parseInt(localStorage.getItem('studentId'));
  if (!studentId) return Promise.resolve();

  // Find my student data
  var myStudent = null;
  if (classesData && classesData[0]) {
    for (var i = 0; i < classesData[0].students.length; i++) {
      if (classesData[0].students[i].id === studentId) {
        myStudent = classesData[0].students[i];
        break;
      }
    }
  }
  if (!myStudent) return Promise.resolve();

  // Step 1: Sync pets FIRST (new pets need real IDs before student upsert)
  var petPromises = [];
  if (myStudent.pets && myStudent.pets.length > 0) {
    console.log('[DAL] Syncing ' + myStudent.pets.length + ' pets for student ' + studentId);
    myStudent.pets.forEach(function(pet) {
      var payload = {
        student_id: studentId,
        name: pet.name,
        nickname: pet.nickname || '',
        level: pet.level || 1,
        growth: pet.growth || 0,
        coins: pet.coins || 0,
        is_active: (myStudent.activePetId === pet.id),
        is_dead: !!pet.isDead,
        last_feed_date: pet.lastFeedDate || null,
        last_play_date: pet.lastPlayDate || null,
        today_feed_count: pet.todayFeedCount || 0,
        today_play_count: pet.todayPlayCount || 0,
        penalty_streak: pet.penaltyStreak || 0
      };
      if (pet.id && pet.id > 0 && pet.id === Math.floor(pet.id)) {
        // Existing pet with valid Supabase ID — upsert
        payload.id = pet.id;
        console.log('[DAL] Updating pet ' + pet.id + ' (' + pet.name + ')');
        petPromises.push(
          db.from('pets').upsert([payload]).then(function(r) {
            if (r.error) console.error('[DAL] pet upsert error:', r.error);
          })
        );
      } else {
        // New pet (local negative ID or no ID) — INSERT without id
        console.log('[DAL] Inserting new pet (' + pet.name + '), local id=' + pet.id);
        var oldLocalId = pet.id;
        petPromises.push(
          db.from('pets').insert([payload]).select().then(function(r) {
            if (r.error) {
              console.error('[DAL] pet insert error:', r.error);
              return;
            }
            if (r.data && r.data[0]) {
              pet.id = r.data[0].id;
              // Update activePetId if it pointed to the old local ID
              if (myStudent.activePetId === oldLocalId) {
                myStudent.activePetId = pet.id;
              }
              console.log('[DAL] New pet "' + pet.name + '" got Supabase ID: ' + pet.id);
            }
          })
        );
      }
    });
  }

  // Step 2: Fetch fresh student data to avoid overwriting teacher changes (e.g., coins)
  return Promise.all(petPromises).then(function() {
    return db.from('students').select('coins, last_checkin_date, last_jianghu_date, last_pk_date, pk_count_today, quiz_state').eq('id', studentId).single();
  }).then(function(freshR) {
    // Compute local delta: how much the student changed locally since last sync
    var localCoinDelta = 0;
    if (_myBaseCoins !== null && typeof myStudent.coins === 'number') {
      localCoinDelta = myStudent.coins - _myBaseCoins;
    }

    var finalCoins = myStudent.coins; // default: use local value
    if (freshR && !freshR.error && freshR.data) {
      // Apply local delta on top of fresh Supabase value
      // This preserves both teacher changes AND student spending
      var freshCoins = freshR.data.coins !== undefined ? freshR.data.coins : 0;
      finalCoins = freshCoins + localCoinDelta;
      if (finalCoins < 0) finalCoins = 0;

      // Merge other fresh fields (don't overwrite if local has been updated)
      if (freshR.data.last_checkin_date && !myStudent.lastCheckinDate) {
        myStudent.lastCheckinDate = freshR.data.last_checkin_date;
      }
      if (freshR.data.last_pk_date && !myStudent.lastPkDate) {
        myStudent.lastPkDate = freshR.data.last_pk_date;
      }
      // v34: Merge lastJianghuDate from server if local doesn't have it
      if (freshR.data.last_jianghu_date && !myStudent.lastJianghuDate) {
        myStudent.lastJianghuDate = freshR.data.last_jianghu_date;
      }
      if (freshR.data.pk_count_today !== undefined) {
        myStudent.pkCountToday = Math.max(myStudent.pkCountToday || 0, freshR.data.pk_count_today || 0);
      }
    }

    // Step 3: Upsert student with merged data
    // v30: REMOVED quiz_state from upsert payload.
    // The quiz_state field was added in v28 and may not exist in the Supabase schema,
    // or may have a type mismatch (JSONB vs TEXT). If the column doesn't exist or
    // the type is wrong, the ENTIRE upsert fails silently — coins are never saved.
    // This is why coins revert on refresh but pet data (upserted separately) persists.
    // quiz_state is now saved separately via .update() after the upsert succeeds.
    // v35: Use fresh server values for pk_count_today and last_pk_date to prevent
    // overwriting opponent's battle count with stale local data after PK battles.
    var finalLastPkDate = myStudent.lastPkDate || null;
    var finalPkCountToday = myStudent.pkCountToday || 0;
    if (freshR && !freshR.error && freshR.data) {
      // Use the max of local and server values — the server may have a newer count
      // from the opponent's device syncing after a PK battle
      if (freshR.data.last_pk_date) {
        finalLastPkDate = freshR.data.last_pk_date;
      }
      if (freshR.data.pk_count_today !== undefined) {
        finalPkCountToday = Math.max(myStudent.pkCountToday || 0, freshR.data.pk_count_today || 0);
      }
    }
    var _studentUpsertOk = false;
    // v43: Use .update() instead of .upsert().
    // .upsert() failed because the payload didn't include class_id (NOT NULL column),
    // causing the ENTIRE upsert to fail. The fallback only saved coins, losing shop_items.
    // .update() only touches specified fields — no NOT NULL constraint issues.
    // The student record ALWAYS exists (created by teacher), so .update() is safe.
    return db.from('students').update({
      coins: finalCoins,
      shop_items: JSON.stringify(myStudent.shopItems || []),
      equipped_items: JSON.stringify(myStudent.equippedItems || {}),
      last_checkin_date: myStudent.lastCheckinDate || null,
      last_jianghu_date: myStudent.lastJianghuDate || null,
      last_pk_date: finalLastPkDate,
      active_pet_id: myStudent.activePetId || null,
      pk_count_today: finalPkCountToday,
      snack_requests: JSON.stringify(myStudent.snackRequests || [])
    }).eq('id', studentId).then(function(r) {
      if (r.error) {
        console.error('[DAL] student update error:', r.error.message);
        // FALLBACK — try saving JUST coins
        console.warn('[DAL] Attempting coins-only fallback save...');
        return db.from('students').update({
          coins: finalCoins
        }).eq('id', studentId).then(function(fallbackR) {
          if (fallbackR.error) {
            console.error('[DAL] FALLBACK coins save also failed:', fallbackR.error.message);
            return false;
          }
          console.log('[DAL] FALLBACK: coins saved via .update() — ' + finalCoins);
          _myBaseCoins = finalCoins;
          _lastOwnWriteTime = Date.now();
          (myStudent.pets || []).forEach(function(p) { _myBasePets[p.id] = p.growth || 0; });
          return true;
        });
      } else {
        _studentUpsertOk = true;
        _myBaseCoins = finalCoins;
        _lastOwnWriteTime = Date.now();
        (myStudent.pets || []).forEach(function(p) { _myBasePets[p.id] = p.growth || 0; });
        myStudent.pkCountToday = finalPkCountToday;
        myStudent.lastPkDate = finalLastPkDate;
      }
      return _studentUpsertOk;
    }).then(function(ok) {
      // v40: ALWAYS save shop_items and equipped_items separately via .update()
      // This ensures purchases are NEVER lost even if the main upsert fails
      // or if there's a race condition with teacher sync
      var shopItemsJson = JSON.stringify(myStudent.shopItems || []);
      var equippedItemsJson = JSON.stringify(myStudent.equippedItems || {});
      
      return db.from('students').update({
        shop_items: shopItemsJson,
        equipped_items: equippedItemsJson
      }).eq('id', studentId).then(function(shopR) {
        if (shopR.error) {
          console.error('[DAL] shop_items/equipped_items separate save failed:', shopR.error.message);
        } else {
          console.log('[DAL] shop_items saved separately:', shopItemsJson);
        }
        
        // v30: Save quiz_state separately — if it fails, coins are still saved
        if (ok && myStudent.quizState) {
          var quizStateJson = typeof myStudent.quizState === 'string'
            ? myStudent.quizState
            : JSON.stringify(myStudent.quizState);
          return db.from('students').update({
            quiz_state: quizStateJson
          }).eq('id', studentId).then(function(qr) {
            if (qr.error) {
              console.warn('[DAL] quiz_state separate save failed:', qr.error.message);
            }
            return ok;
          });
        }
        return ok;
      });
    });
  });
}

function _syncToSupabase() {
  if (_dalSyncing) {
    _dalSyncQueued = true;
    return Promise.resolve();
  }
  _dalSyncing = true;

  var syncFn = (currentUser && currentUser.type === 'student')
    ? _syncStudentToSupabase
    : _syncTeacherToSupabase;

  // v27: ALWAYS write unsynced logs, even if teacher/student sync fails.
  // Previously, log writes were chained AFTER teacher sync, so if teacher sync
  // failed, logs would NEVER be written — causing the "records don't sync" bug.
  var _lastStudentSyncOk = null;
  var _syncSucceeded = false;
  return syncFn().then(function(result) {
    _lastStudentSyncOk = result;
    _syncSucceeded = true;
    _takeSnapshot();
    // v31: Clear quiz_state local modification flag after successful sync.
    // The sync has persisted the local quiz_state to Supabase, so smart refresh
    // can safely merge quiz_state changes from the server again.
    window._quizStateLocallyModified = false;
    _updateCloudStatus('synced');
    // v45: Update cache after successful sync
    _saveToCache();
    console.log('[DAL] Data sync complete');
  }).catch(function(err) {
    _lastSyncFailed = true;
    _syncRetryCount++;
    console.error('[DAL] Data sync error:', err);
    _updateCloudStatus('error');
    if (_syncRetryCount <= _maxRetries) {
      console.log('[DAL] Retrying data sync (' + _syncRetryCount + '/' + _maxRetries + ')...');
      setTimeout(function() { _syncToSupabase(); }, _syncRetryCount * 2000);
    } else {
      console.error('[DAL] Data sync failed after ' + _maxRetries + ' retries');
      _showNotification('数据同步失败，请检查网络后点击云朵图标重试', 'error');
    }
  }).then(function() {
    // v27: This runs regardless of whether data sync succeeded or failed.
    // Write unsynced operation logs independently.
    _dalSyncing = false;
    // v46: Only clear _pendingLocalSave if sync actually succeeded.
    // If sync failed, we must remember there are unsaved changes for retry.
    if (_syncSucceeded) {
      _pendingLocalSave = false;
      _lastOwnWriteTime = Date.now();
    } else {
      // Sync failed — keep _pendingLocalSave true so next sync attempt will retry
      console.warn('[DAL] Sync failed — keeping _pendingLocalSave=true for retry');
    }
    // For student: update base coins/pets ONLY if sync was confirmed successful
    // v28: Previously updated unconditionally, which caused coins to revert
    // if the student upsert had failed (delta was zeroed out).
    if (currentUser && currentUser.type === 'student') {
      // For students: _lastStudentSyncOk indicates if student upsert succeeded
      // For teachers: always update (teacher sync is reliable)
      var shouldUpdateBase = (_lastStudentSyncOk === true) || (currentUser.type !== 'student');
      if (shouldUpdateBase) {
        var myStu = null;
        var sid = parseInt(localStorage.getItem('studentId'));
        if (classesData && classesData[0]) {
          for (var i = 0; i < classesData[0].students.length; i++) {
            if (classesData[0].students[i].id === sid) { myStu = classesData[0].students[i]; break; }
          }
        }
        if (myStu) {
          // v95: REMOVED `_myBaseCoins = myStu.coins` — race condition fix (same as dal_v69.js).
          // _myBaseCoins is already correctly set to `finalCoins` inside _syncStudentToSupabase().
          // Overwriting it here with myStu.coins corrupts the delta calculation on consecutive purchases.
          (myStu.pets || []).forEach(function(p) { _myBasePets[p.id] = p.growth || 0; });
        }
      } else {
        console.warn('[DAL] Student sync did not confirm success — _myBaseCoins NOT updated (will retry)');
      }
    }
    return _writeUnsyncedLogsToSupabase();
  }).then(function() {
    if (_dalSyncQueued) {
      _dalSyncQueued = false;
      return _syncToSupabase();
    }
  }).catch(function(err) {
    // Catch any error from the log write phase
    _dalSyncing = false;
    console.error('[DAL] Log write phase error:', err);
  });
}

function _updateCloudStatus(status) {
  var el = document.getElementById('cloudSyncStatus');
  if (!el) return;
  if (status === 'synced') {
    el.textContent = '☁️ 已同步';
    el.style.color = '#4CAF50';
  } else if (status === 'syncing') {
    el.textContent = '☁️ 同步中...';
    el.style.color = '#FF9800';
  } else if (status === 'error') {
    el.textContent = '☁️ 同步失败';
    el.style.color = '#f44336';
  }
}

function _showNotification(msg, type) {
  if (typeof showNotification === 'function') {
    showNotification(msg, type);
  } else {
    console.log('[DAL] Notification:', msg);
  }
}

function forceManualSync() {
  _updateCloudStatus('syncing');
  _syncToSupabase().then(function() {
    // After sync, do a smart refresh to pick up any changes from OTHER users
    // Bypass debounce and own-write protection since user explicitly requested refresh
    return _doSmartRefresh();
  });
}

// v18: Teacher tool — check if students can read operation_logs (RLS diagnostic)
function checkStudentLogAccess() {
  if (!db || !currentUser || currentUser.type !== 'teacher') {
    console.warn('[DAL] checkStudentLogAccess: only teachers can run this diagnostic');
    return;
  }
  var classId = typeof currentClassId !== 'undefined' ? currentClassId : (classesData[0] ? classesData[0].id : null);
  if (!classId) { console.warn('[DAL] No class selected'); return; }
  
  console.log('[DAL] v18 Checking if operation_logs is readable with anon key...');
  db.from('operation_logs').select('id').eq('class_id', classId).limit(1).then(function(r) {
    if (r.error) {
      console.error('[DAL] v18 ❌ operation_logs RLS is blocking reads! Error:', r.error.message);
      console.error('[DAL] v18 FIX: Go to Supabase Dashboard → SQL Editor → paste and run:\n\n' +
        '-- 修复 operation_logs 表的 RLS 策略（允许学生读取操作记录）\n' +
        'CREATE POLICY IF NOT EXISTS "Students can read class operation logs"\n' +
        'ON operation_logs FOR SELECT USING (true);\n\n' +
        'CREATE POLICY IF NOT EXISTS "Anyone can insert operation logs"\n' +
        'ON operation_logs FOR INSERT WITH CHECK (true);\n\n' +
        'CREATE POLICY IF NOT EXISTS "Anyone can update operation logs"\n' +
        'ON operation_logs FOR UPDATE USING (true);\n');
      if (typeof showNotification === 'function') {
        showNotification('RLS 诊断结果', 'operation_logs 表策略阻止了学生读取！请打开浏览器控制台(F12)查看修复SQL', 'error');
      }
    } else {
      console.log('[DAL] v18 ✅ operation_logs is readable. Got', r.data ? r.data.length : 0, 'rows.');
      if (r.data && r.data.length > 0) {
        console.log('[DAL] v18 Students should be able to see operation logs.');
        if (typeof showNotification === 'function') {
          showNotification('RLS 诊断通过', 'operation_logs 表策略正常，学生应能读取操作记录', 'success');
        }
      } else {
        console.log('[DAL] v18 ⚠️ Table is readable but no logs found for this class. The teacher may not have synced any logs yet.');
        if (typeof showNotification === 'function') {
          showNotification('RLS 诊断', '表策略正常，但该班级暂无操作日志记录', 'info');
        }
      }
    }
  });
}

/* ===== Realtime ===== */
// Debounced smart refresh — called by polling fallback
function _refreshFromSupabase() {
  // v103: Don't refresh during initial load
  if (!_dalInitialLoadComplete) {
    console.log('[DAL] v103 Refresh skipped — initial load not complete');
    return;
  }
  // Don't refresh while syncing
  if (_dalSyncing) {
    console.log('[DAL] Refresh skipped - sync in progress');
    return;
  }
  
  // Debounce: wait 3s after last event before actually refreshing
  // This prevents rapid-fire refreshes when multiple changes happen at once
  if (_refreshDebounceTimer) clearTimeout(_refreshDebounceTimer);
  _refreshDebounceTimer = setTimeout(function() {
    _refreshDebounceTimer = null;
    // Re-check after debounce
    if (_dalSyncing) return;
    _lastRefreshTime = Date.now();
    _doSmartRefresh();
  }, _REFRESH_DEBOUNCE_MS);
}

// Immediate refresh — called by visibilitychange safety net (no debounce, instant push)
// v102: Removed global _OWN_WRITE_IGNORE_MS check. Echo protection is now handled
// per-row by _recentlyWrittenRows (teacher) and student ID match (student) in _applyRealtimeUpdate.
var _immediateRefreshRetryCount = 0;
var _IMMEDIATE_REFRESH_MAX_RETRIES = 10;
function _immediateRefreshFromSupabase() {
  // v103: Don't refresh during initial load
  if (!_dalInitialLoadComplete) {
    console.log('[DAL] v103 Immediate refresh skipped — initial load not complete');
    return;
  }
  // Don't refresh while syncing
  if (_dalSyncing) {
    // v46: Limit retries to prevent unbounded timer chain
    if (_immediateRefreshRetryCount >= _IMMEDIATE_REFRESH_MAX_RETRIES) {
      console.warn('[DAL] Immediate refresh retry limit reached, giving up');
      _immediateRefreshRetryCount = 0;
      return;
    }
    console.log('[DAL] Immediate refresh skipped - sync in progress, will retry (' + _immediateRefreshRetryCount + '/' + _IMMEDIATE_REFRESH_MAX_RETRIES + ')');
    _immediateRefreshRetryCount++;
    // Queue a refresh after current sync completes
    setTimeout(_immediateRefreshFromSupabase, 500);
    return;
  }
  
  // Reset retry count on successful attempt
  _immediateRefreshRetryCount = 0;
  
  // v102: No global own-write protection here. Echo protection is handled
  // in _applyRealtimeUpdate (student ID match / _recentlyWrittenRows).
  // This function is only called by visibilitychange safety net, which
  // needs to do a full refresh to catch any missed Realtime updates.
  
  console.log('[DAL] v102 ⚡ Immediate refresh (visibilitychange safety net)');
  _lastRefreshTime = Date.now();
  _doSmartRefresh();
}

// v103: Refresh lock — prevent concurrent smart refreshes that cause duplicate queries
var _smartRefreshInProgress = false;
var _smartRefreshPending = false;

function _doSmartRefresh() {
  // v103: If a refresh is already in progress, skip this one.
  // The in-progress refresh will pick up the latest data.
  if (_smartRefreshInProgress) {
    if (!_smartRefreshPending) {
      _smartRefreshPending = true;
      console.log('[DAL] v103 Smart refresh already in progress — queued one follow-up');
    }
    return;
  }
  _smartRefreshInProgress = true;
  console.log('[DAL] Starting smart refresh...');
  _smartRefreshFromSupabase().then(function() {
    // Also reload operation logs from Supabase to keep history up to date
    return _loadOperationLogs();
  }).then(function() {
    // v108: After loading logs, also write any unsynced ones.
    // This handles the mobile case where the page was killed before the
    // debounce timer fired, leaving unsynced logs in localStorage.
    if (typeof window.operationLogs !== 'undefined' && Array.isArray(window.operationLogs)) {
      var hasUnsynced = window.operationLogs.some(function(l) { return !l._synced; });
      if (hasUnsynced && typeof _writeUnsyncedLogsToSupabase === 'function') {
        console.log('[DAL] v108 Smart refresh: found unsynced logs, writing...');
        _writeUnsyncedLogsToSupabase();
      }
    }
    _smartRefreshInProgress = false;
    // v15: Ensure app.js alias is synced after loading logs
    if (typeof _syncOpLogsAlias === 'function') { try { _syncOpLogsAlias(); } catch(e) {} }
    
    // Re-render the UI with merged data
    if (typeof renderClassList === 'function') renderClassList();
    // scheduleAllRenders already includes PK + Jianghu renders, no need to call them again
    if (typeof scheduleAllRenders === 'function') scheduleAllRenders();
    // v53: Debounce history modal refresh to avoid flickering (max once per 3s)
    if (typeof refreshHistoryModalIfOpen === 'function') {
      clearTimeout(window._historyRefreshDebounce);
      window._historyRefreshDebounce = setTimeout(refreshHistoryModalIfOpen, 3000);
    }
    
    // For students: check for accepted PK challenges and update invite badge
    if (currentUser && currentUser.type === 'student') {
      console.log('[DAL] Student data refreshed from server');
      console.log('[DAL] Operation logs loaded:', (window.operationLogs || []).length);
      
      // Check for accepted PK challenge (for the challenger to start battle)
      if (typeof _checkAcceptedPKChallenge === 'function') {
        _checkAcceptedPKChallenge();
      }
      
      // Update the red exclamation badge on PK tab immediately
      if (typeof _updatePKInviteBadge === 'function') {
        _updatePKInviteBadge();
      }
    }
    
    console.log('[DAL] Smart refresh complete');
    
    // v103: If a refresh was queued while we were running, do one more
    if (_smartRefreshPending) {
      _smartRefreshPending = false;
      console.log('[DAL] v103 Running queued follow-up refresh');
      setTimeout(_doSmartRefresh, 500);
    }
  }).catch(function(e) {
    _smartRefreshInProgress = false;
    console.error('[DAL] Smart refresh error:', e);
    // v103: Still run queued refresh on error
    if (_smartRefreshPending) {
      _smartRefreshPending = false;
      setTimeout(_doSmartRefresh, 2000);
    }
  });
}

// v97: 定向刷新 —— 直接从 Supabase 拉取完整数据替换 classesData，再定向渲染
// v98: 不再使用 _smartRefreshFromSupabase()（它有多个静默跳过条件，导致数据不更新）
//      改为直接调用 loadFromSupabase() 拉取完整数据，确保数据一定是最新的
// v99: 添加 debounce，合并短时间内的多次 Realtime 事件，避免流量爆炸
// v100: 直接用 payload.new 更新内存数据，不查询数据库，立即更新变化的那个学生
function _doTargetedRefresh(renderMask) {
  // v100: 这个方法不再使用，改为 _applyRealtimeUpdate
  console.warn('[DAL] _doTargetedRefresh is deprecated, use _applyRealtimeUpdate instead');
}

// v100: 直接用 Realtime payload 更新内存数据，零数据库查询，立即生效
// v101: 加回数据保护机制，防止自己的写操作被 Realtime 回传覆盖
// v102: 核心改进 ——
//   学生端：按 student ID 精确跳过自己的回声（不再依赖 10s 时间窗口）
//   教师端：按 _recentlyWrittenRows 跳过刚写过的行（3s 窗口）
//   并发冲突：snapshot-based delta 保留 —— 如果本地有未同步的修改，
//             计算 localDelta = local - snapshot，应用到 payload.new 上
//   兜底：visibilitychange 时全量刷新
function _applyRealtimeUpdate(table, payload) {
  if (!payload || !payload.new) {
    console.log('[DAL] v102 Realtime payload missing, skipping');
    return;
  }
  
  var newData = payload.new;
  // v117: For pets table, newData.id is the PET id, not the student id.
  // We MUST use student_id to find the owning student in classesData.
  // Previously, newData.id was used first, which caused pet updates to be
  // silently dropped because no student matched the pet's ID.
  var studentId = (table === 'pets')
    ? newData.student_id
    : (newData.id || (newData.student_id && newData.student_id));
  
  if (!studentId) {
    console.log('[DAL] v117 No student ID in payload, skipping (table:', table, ')');
    return;
  }
  
  var isStudent = currentUser && currentUser.type === 'student';
  var myStudentId = isStudent ? parseInt(localStorage.getItem('studentId')) : null;
  
  // === v102: Echo detection ===
  
  if (isStudent && myStudentId && studentId == myStudentId) {
    // 学生端：这条 Realtime 是自己写操作的回声，本地内存已经是最新的
    // 不需要任何时间窗口检查，直接跳过
    console.log('[DAL] v102 Skipping own write echo (student ID match):', myStudentId);
    return;
  }
  
  // v117: For pets table, echo detection uses PET id (matching _markRowWritten('pets', pet.id))
  // For students table, echo detection uses student id
  var _echoRowId = (table === 'pets') ? newData.id : studentId;
  if (!isStudent && _isRowRecentlyWritten(table, _echoRowId)) {
    // 教师端：刚刚写过这个行的数据，Realtime 回传的是回声
    console.log('[DAL] v117 Skipping recently written row (teacher):', table, _echoRowId);
    return;
  }
  
  // 在 classesData 中找到对应的学生
  var targetStudent = null;
  var targetClass = null;
  for (var i = 0; i < classesData.length; i++) {
    var cls = classesData[i];
    for (var j = 0; j < cls.students.length; j++) {
      if (cls.students[j].id == studentId) {
        targetStudent = cls.students[j];
        targetClass = cls;
        break;
      }
    }
    if (targetStudent) break;
  }
  
  if (!targetStudent) {
    console.log('[DAL] v102 Student not found in classesData:', studentId);
    return;
  }
  
  console.log('[DAL] v102 Applying realtime update for student:', targetStudent.name, 'table:', table);
  
  // === v102: Snapshot-based helpers for concurrent conflict resolution ===
  // If local data has unsaved changes (local != snapshot), preserve the delta
  // when applying the server's new value.
  // Uses global _snapshotStudentMap and _snapshotPetMap (populated by _takeSnapshot)
  
  function _applyWithDelta(localVal, snapshotVal, serverVal) {
    if (typeof localVal !== 'number' || typeof serverVal !== 'number') return serverVal;
    if (typeof snapshotVal !== 'number') return serverVal; // No snapshot → trust server
    if (localVal === snapshotVal) return serverVal; // No local change → trust server
    // Local has unsaved change: preserve delta = (localVal - snapshotVal)
    var delta = localVal - snapshotVal;
    var result = serverVal + delta;
    console.log('[DAL] v102 Delta preserved:', delta, '(local:', localVal, 'snapshot:', snapshotVal, 'server:', serverVal, '→ result:', result, ')');
    return result;
  }
  
  // 根据表类型更新对应字段
  if (table === 'students') {
    // v102: coins — 用 snapshot-based delta 保留本地未同步的变化
    if (newData.coins !== undefined) {
      var snapStu = _snapshotStudentMap[studentId];
      var snapCoins = snapStu ? snapStu.coins : undefined;
      targetStudent.coins = _applyWithDelta(targetStudent.coins, snapCoins, newData.coins);
    }
    
    // 其他字段直接更新（这些字段通常只有本地修改，不会并发冲突）
    if (newData.last_checkin_date !== undefined) targetStudent.lastCheckinDate = newData.last_checkin_date;
    if (newData.last_jianghu_date !== undefined) targetStudent.lastJianghuDate = newData.last_jianghu_date;
    if (newData.last_pk_date !== undefined) targetStudent.lastPkDate = newData.last_pk_date;
    if (newData.active_pet_id !== undefined) targetStudent.activePetId = newData.active_pet_id;
    if (newData.pk_count_today !== undefined) targetStudent.pkCountToday = newData.pk_count_today;
    
    // v102: quiz_state 保护 — 如果本地正在玩游戏，跳过远程覆盖
    if (newData.quiz_state !== undefined && !window._quizStateLocallyModified) {
      try {
        targetStudent.quizState = typeof newData.quiz_state === 'string' ? JSON.parse(newData.quiz_state) : newData.quiz_state;
      } catch(e) {
        console.warn('[DAL] v102 Failed to parse quiz_state:', e);
      }
    }
    
    if (newData.shop_items !== undefined) {
      try {
        targetStudent.shopItems = typeof newData.shop_items === 'string' ? JSON.parse(newData.shop_items) : (newData.shop_items || []);
      } catch(e) {}
    }
    if (newData.equipped_items !== undefined) {
      try {
        targetStudent.equippedItems = typeof newData.equipped_items === 'string' ? JSON.parse(newData.equipped_items) : (newData.equipped_items || {});
      } catch(e) {}
    }
    
    // v124: snack_requests — 零食兑换请求实时更新
    if (newData.snack_requests !== undefined) {
      try {
        var oldRequests = targetStudent.snackRequests || [];
        var newRequests = typeof newData.snack_requests === 'string' ? JSON.parse(newData.snack_requests) : (newData.snack_requests || []);
        targetStudent.snackRequests = newRequests;
        
        // 教师端：更新零食审批徽章
        if (typeof _updateSnackRequestBadge === 'function') {
          setTimeout(_updateSnackRequestBadge, 100);
        }
        
        // 学生端：检查是否有新的审批结果，显示通知
        if (isStudent && myStudentId && studentId == myStudentId) {
          newRequests.forEach(function(req) {
            if (req.status === 'approved' || req.status === 'rejected') {
              // 检查这个请求在旧数据中是否是 pending 状态
              var oldReq = oldRequests.find(function(r) { return r.id === req.id; });
              if (oldReq && oldReq.status === 'pending') {
                // 状态从 pending 变为 approved/rejected，显示通知
                var msg = req.status === 'approved' 
                  ? '教师已同意你的 ' + req.snackEmoji + ' ' + req.snackName + ' 兑换！'
                  : '教师已拒绝你的 ' + req.snackEmoji + ' ' + req.snackName + ' 兑换';
                var type = req.status === 'approved' ? 'success' : 'info';
                if (typeof showNotification === 'function') {
                  setTimeout(function() { showNotification('零食兑换通知', msg, type); }, 200);
                }
              }
            }
          });
          
          // v125: 更新学生端审批状态按钮的红点
          if (typeof _updateSnackStatusBadge === 'function') {
            setTimeout(_updateSnackStatusBadge, 150);
          }
        }
      } catch(e) {
        console.warn('[DAL] v124 Failed to parse snack_requests:', e);
      }
    }
  } else if (table === 'pets') {
    // 更新宠物字段
    if (!targetStudent.pets) targetStudent.pets = [];
    var petId = newData.id;
    var targetPet = null;
    for (var k = 0; k < targetStudent.pets.length; k++) {
      if (targetStudent.pets[k].id == petId) {
        targetPet = targetStudent.pets[k];
        break;
      }
    }
    
    if (targetPet) {
      // v102: growth — 用 snapshot-based delta 保留本地未同步的变化
      if (newData.growth !== undefined) {
        var snapPet = _snapshotPetMap[petId];
        var snapGrowth = snapPet ? snapPet.growth : undefined;
        targetPet.growth = _applyWithDelta(targetPet.growth, snapGrowth, newData.growth);
      }
      // 其他字段直接更新
      if (newData.name !== undefined) targetPet.name = newData.name;
      if (newData.nickname !== undefined) targetPet.nickname = newData.nickname;
      if (newData.level !== undefined) targetPet.level = newData.level;
      if (newData.coins !== undefined) targetPet.coins = newData.coins;
      if (newData.is_active !== undefined) targetPet.isActive = !!newData.is_active;
      if (newData.is_dead !== undefined) targetPet.isDead = !!newData.is_dead;
      if (newData.last_feed_date !== undefined) targetPet.lastFeedDate = newData.last_feed_date;
      if (newData.last_play_date !== undefined) targetPet.lastPlayDate = newData.last_play_date;
      if (newData.today_feed_count !== undefined) targetPet.todayFeedCount = newData.today_feed_count;
      if (newData.today_play_count !== undefined) targetPet.todayPlayCount = newData.today_play_count;
      if (newData.penalty_streak !== undefined) targetPet.penaltyStreak = newData.penalty_streak;
    } else {
      // 新宠物，添加到列表
      targetStudent.pets.push({
        id: newData.id,
        name: newData.name || '',
        nickname: newData.nickname || '',
        level: newData.level || 1,
        growth: newData.growth || 0,
        coins: newData.coins || 0,
        isActive: !!newData.is_active,
        isDead: !!newData.is_dead,
        lastFeedDate: newData.last_feed_date || null,
        lastPlayDate: newData.last_play_date || null,
        todayFeedCount: newData.today_feed_count || 0,
        todayPlayCount: newData.today_play_count || 0,
        penaltyStreak: newData.penalty_streak || 0
      });
    }
  }
  
  // 更新 snapshot（反映最新数据，确保下次 delta 计算正确）
  _takeSnapshot();
  
  // 定向渲染：宠物网格 + 排行榜
  if (typeof scheduleRender === 'function') {
    scheduleRender(1 | 2); // _RF_GRID=1, _RF_TOP3=2
  } else if (typeof scheduleAllRenders === 'function') {
    scheduleAllRenders();
  }
  
  // 如果学生详情弹窗开着，刷新它
  if (typeof refreshCurrentStudentModal === 'function' && typeof currentModalStudentId !== 'undefined' && currentModalStudentId) {
    try { refreshCurrentStudentModal(); } catch(e) {}
  }
  
  console.log('[DAL] v102 Realtime update applied for student:', targetStudent.name);
}

// 仅刷新操作日志（不触发UI重建，避免频繁闪烁）
function _refreshLogsOnly() {
  console.log('[DAL] Refreshing logs only (no UI rebuild)...');
  _loadOperationLogs().then(function() {
    if (typeof _syncOpLogsAlias === 'function') { try { _syncOpLogsAlias(); } catch(e) {} }
    // 只在历史弹窗打开时刷新弹窗内容
    if (typeof refreshHistoryModalIfOpen === 'function') {
      clearTimeout(window._historyRefreshDebounce);
      window._historyRefreshDebounce = setTimeout(refreshHistoryModalIfOpen, 2000);
    }
    // 学生端：检查PK挑战（PK挑战记录在operation_logs中）
    if (currentUser && currentUser.type === 'student') {
      if (typeof _checkAcceptedPKChallenge === 'function') {
        _checkAcceptedPKChallenge();
      }
      if (typeof _updatePKInviteBadge === 'function') {
        _updatePKInviteBadge();
      }
    }
  }).catch(function(e) {
    console.warn('[DAL] Logs-only refresh error:', e);
  });
}

function _setupRealtimeSubscriptions() {
  if (!db || !db.channel) {
    // No Realtime support — start polling immediately
    _startFallbackPolling();
    // v96: 即使没有 Realtime，也初始化 BroadcastChannel（跨标签页通知仍然有效）
    _initBroadcastChannel();
    return;
  }

  // 生成唯一客户端ID，避免多客户端通道名称冲突
  var _clientId = 'c' + Math.random().toString(36).substr(2, 6);
  
  var channelsCreated = 0;
  var channelsConfirmed = 0;
  var totalChannels = 3;
  var realtimeTimeout = null;

  function _onChannelConfirmed() {
    channelsConfirmed++;
    if (channelsConfirmed >= 1 && !_realtimeActive) {
      // At least one channel confirmed — Realtime is working
      _realtimeActive = true;
      console.log('[DAL] ⚡ Realtime confirmed active (' + channelsConfirmed + '/' + totalChannels + ' channels) — polling disabled, client=' + _clientId);
      // Stop any fallback polling that may have started
      _stopFallbackPolling();
    }
  }

  try {
    // Subscribe to classes table — coalesced refresh on change
    // Note: operation_logs are stored in classes.operation_logs_json (v29),
    // so classes table changes include both class data and log updates
    var classChannel = db.channel('dal-classes-' + _clientId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'classes' }, function(payload) {
        _realtimeLastEventTime = Date.now(); // v95: Track liveness
        // 检查是否只有 operation_logs_json 变化（通过比较列）
        // 如果只有日志变化，使用轻量级刷新（不重建UI）
        if (payload.columns && payload.columns.length === 1 && payload.columns[0].name === 'operation_logs_json') {
          console.log('[DAL] v102 Classes channel: logs-only change, using lightweight refresh');
          _refreshLogsOnly();
        } else {
          // v102: classes 表变化（班级名称等）不影响学生/宠物数据
          // 只刷新班级列表 UI，不查询数据库
          console.log('[DAL] v102 Classes channel: class metadata change, refreshing class list UI only');
          if (typeof renderClassList === 'function') {
            renderClassList();
          }
        }
      })
      .subscribe(function(status) {
        if (status === 'SUBSCRIBED') _onChannelConfirmed();
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn('[DAL] Classes channel status:', status);
          _checkRealtimeHealth();
        }
      });
    _realtimeChannels.push(classChannel);
    channelsCreated++;

    // Subscribe to students table — v100: 直接用 payload.new 更新内存数据
    var studentChannel = db.channel('dal-students-' + _clientId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'students' }, function(payload) {
        _realtimeLastEventTime = Date.now(); // v95: Track liveness
        // v115: Teacher — if student's pending_logs_json changed, merge IMMEDIATELY.
        // This eliminates the 30s delay from _safetyNetTick periodic merge.
        if (currentUser && currentUser.type === 'teacher' && payload && payload.new) {
          var _plj = payload.new.pending_logs_json;
          if (_plj && _plj !== '[]' && _plj !== 'null' && _plj !== '') {
            console.log('[DAL] v115 ⚡ Student pending_logs_json changed via Realtime — immediate merge');
            var _mergeClassId = payload.new.class_id;
            if (_mergeClassId) {
              _mergeStudentPendingLogs([_mergeClassId]).then(function(mergedCount) {
                if (mergedCount > 0) {
                  console.log('[DAL] v115 ⚡ Immediate merge: ' + mergedCount + ' logs merged');
                  // Reload operation logs and refresh history UI
                  return _loadOperationLogsAfterMerge([_mergeClassId]).then(function() {
                    if (typeof refreshHistoryModalIfOpen === 'function') {
                      clearTimeout(window._historyRefreshDebounce);
                      window._historyRefreshDebounce = setTimeout(refreshHistoryModalIfOpen, 500);
                    }
                    if (typeof _syncOpLogsAlias === 'function') { try { _syncOpLogsAlias(); } catch(e) {} }
                  });
                }
              });
            }
          }
        }
        // v100: 直接用 payload.new 更新内存数据，零数据库查询，立即生效
        console.log('[DAL] v100 Students: realtime update, applying directly to memory');
        _applyRealtimeUpdate('students', payload);
      })
      .subscribe(function(status) {
        if (status === 'SUBSCRIBED') _onChannelConfirmed();
      });
    _realtimeChannels.push(studentChannel);
    channelsCreated++;

    // Subscribe to pets table — v100: 直接用 payload.new 更新内存数据
    var petChannel = db.channel('dal-pets-' + _clientId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pets' }, function(payload) {
        _realtimeLastEventTime = Date.now(); // v95: Track liveness
        // v100: 直接用 payload.new 更新内存数据，零数据库查询，立即生效
        console.log('[DAL] v100 Pets: realtime update (' + payload.eventType + '), applying directly to memory');
        _applyRealtimeUpdate('pets', payload);
      })
      .subscribe(function(status) {
        if (status === 'SUBSCRIBED') _onChannelConfirmed();
      });
    _realtimeChannels.push(petChannel);
    channelsCreated++;

    console.log('[DAL] ⚡ Realtime subscriptions created (' + channelsCreated + ' channels, client=' + _clientId + ') — waiting for confirmation...');

    // v54: If no channel confirms within 10s, start fallback polling
    realtimeTimeout = setTimeout(function() {
      if (!_realtimeActive) {
        console.warn('[DAL] Realtime not confirmed after 10s — starting fallback polling');
        _startFallbackPolling();
      }
    }, 10000);

    // v95: Always start safety-net polling — even when Realtime is active.
    _realtimeLastEventTime = Date.now();
    _startSafetyNetPolling();

    // v96: 初始化 BroadcastChannel 用于跨标签页即时通知
    _initBroadcastChannel();
  } catch (e) {
    console.warn('[DAL] Realtime setup failed, using polling fallback:', e);
    _startFallbackPolling();
  }
}

// v54: Start fallback polling only when Realtime is not working
function _startFallbackPolling() {
  if (_refreshTimer) return; // Already running
  console.log('[DAL] Fallback polling started (every ' + (_refreshInterval / 1000) + 's)');
  _refreshTimer = setInterval(function() {
    // Skip if Realtime has since become active
    if (_realtimeActive) {
      _stopFallbackPolling();
      return;
    }
    _refreshFromSupabase();
  }, _refreshInterval);
}

// v54: Stop fallback polling
function _stopFallbackPolling() {
  if (_refreshTimer) {
    clearInterval(_refreshTimer);
    _refreshTimer = null;
    console.log('[DAL] Fallback polling stopped (Realtime is active)');
  }
}

// v95: Safety-net polling — runs even when Realtime is "active" to catch silent failures.
function _startSafetyNetPolling() {
  if (_safetyNetTimer) return;
  console.log('[DAL] v95 Safety-net polling started (every ' + (_SAFETY_NET_INTERVAL / 1000) + 's)');
  _safetyNetTimer = setInterval(function() {
    _safetyNetTick();
  }, _SAFETY_NET_INTERVAL);
}

function _stopSafetyNetPolling() {
  if (_safetyNetTimer) {
    clearInterval(_safetyNetTimer);
    _safetyNetTimer = null;
  }
}

function _safetyNetTick() {
  var timeSinceLastEvent = Date.now() - _realtimeLastEventTime;
  if (_realtimeActive && timeSinceLastEvent > _REALTIME_LIVENESS_TIMEOUT) {
    console.warn('[DAL] v95 Realtime liveness FAILED — no events for ' + 
      Math.round(timeSinceLastEvent / 1000) + 's — marking Realtime as dead, forcing refresh');
    _realtimeActive = false;
    _startFallbackPolling();
    _refreshFromSupabase();
    return;
  }
  // v112: Periodically merge student pending logs (teacher only).
  // Students write to students.pending_logs_json; teacher merges them into classes.operation_logs_json.
  // This runs regardless of Realtime status — student logs need to be merged even when Realtime is healthy.
  if (currentUser && currentUser.type === 'teacher' && typeof _mergeStudentPendingLogs === 'function') {
    if (!_safetyNetTick._lastMergeTime || Date.now() - _safetyNetTick._lastMergeTime > 30000) {
      _safetyNetTick._lastMergeTime = Date.now();
      _getOpLogClassIds().then(function(classIds) {
        if (classIds && classIds.length > 0) {
          _mergeStudentPendingLogs(classIds).then(function(mergedCount) {
            if (mergedCount > 0) {
              console.log('[DAL] v112 Periodic merge: ' + mergedCount + ' student pending logs merged');
              // Re-load operation logs to include the newly merged ones
              return _loadOperationLogsAfterMerge(classIds);
            }
          });
        }
      });
    }
  }

  // v102: When Realtime is active and healthy, do NOT do full database queries.
  // Realtime handles all updates via _applyRealtimeUpdate (zero DB queries).
  // Only check liveness — the timeout above will catch silent failures.
  if (_realtimeActive) {
    // Realtime is working fine, no need to poll
    return;
  }
  // Fallback: Realtime is not active, do debounced refresh
  if (!_dalSyncing && !_pendingLocalSave) {
    _refreshFromSupabase();
  }
}

// v54: Check if any Realtime channel is still alive
function _checkRealtimeHealth() {
  // If all channels failed, mark Realtime as inactive and start polling
  if (_realtimeActive && _realtimeChannels.length === 0) {
    _realtimeActive = false;
    _startFallbackPolling();
  }
}

function _cleanupRealtime() {
  _realtimeChannels.forEach(function(ch) {
    try { if (db && db.removeChannel) db.removeChannel(ch); } catch(e) {}
  });
  _realtimeChannels = [];
  _realtimeActive = false;
  _stopFallbackPolling();
  _stopSafetyNetPolling(); // v95
  // v96: 关闭 BroadcastChannel
  if (_broadcastChannel) {
    try { _broadcastChannel.close(); } catch(e) {}
    _broadcastChannel = null;
  }
}

// v116: Immediate sync of student + pet data after EACH student action.
// This is the KEY fix for "pet cards don't update immediately on teacher's screen".
//
// Problem: Student action → saveClassData() → async _syncToSupabase() → 4-step async chain.
// On mobile, the async chain (pets upsert + fetch + student upsert + shop_items update)
// can take 3-5 seconds. If the page is suspended before completion, data never reaches
// Supabase → teacher's Realtime never fires → pet cards never update.
//
// Solution: After each student action, IMMEDIATELY push critical data (coins + pets)
// to Supabase via sync XHR. This ensures the data reaches Supabase within ~100ms,
// triggering teacher's Realtime almost instantly.
//
// Throttled to at most once every 2 seconds to avoid excessive blocking.
var _lastStudentSyncXhrTime = 0;
var _STUDENT_SYNC_XHR_INTERVAL = 2000; // 2 seconds

function _syncStudentDataImmediate() {
  if (!currentUser || currentUser.type !== 'student') return;

  var now = Date.now();
  if (now - _lastStudentSyncXhrTime < _STUDENT_SYNC_XHR_INTERVAL) return; // throttled
  _lastStudentSyncXhrTime = now;

  var studentId = parseInt(localStorage.getItem('studentId'));
  if (!studentId) return;

  var anonKey = (typeof SUPABASE_ANON_KEY !== 'undefined') ? SUPABASE_ANON_KEY : '';
  if (!anonKey) return;

  // Find my student data
  var myStudent = null;
  if (classesData && classesData[0]) {
    for (var i = 0; i < classesData[0].students.length; i++) {
      if (classesData[0].students[i].id === studentId) {
        myStudent = classesData[0].students[i];
        break;
      }
    }
  }
  if (!myStudent) return;

  try {
    var baseUrl = 'https://xbygooadskfqllnhwmet.supabase.co/rest/v1';

    // Sync student data (coins, checkin, etc.) — this triggers teacher's Realtime for students table
    var studentPayload = {
      coins: myStudent.coins || 0,
      last_checkin_date: myStudent.lastCheckinDate || null,
      last_jianghu_date: myStudent.lastJianghuDate || null,
      last_pk_date: myStudent.lastPkDate || null,
      active_pet_id: myStudent.activePetId || null,
      pk_count_today: myStudent.pkCountToday || 0,
      shop_items: JSON.stringify(myStudent.shopItems || []),
      equipped_items: JSON.stringify(myStudent.equippedItems || {})
    };

    // v122: ALSO include pending_logs_json in this sync XHR.
    // This is the PROVEN WORKING path on mobile (coins save correctly through this).
    // By including logs here, we ensure logs ride along the reliable path.
    // Previously, logs were ONLY sent via _syncWriteStudentPendingLogs() which uses
    // a much larger payload (all student data + logs) and is often blocked on mobile.
    var unsyncedLogs = (typeof window.operationLogs !== 'undefined' && Array.isArray(window.operationLogs))
      ? window.operationLogs.filter(function(l) { return !l._synced; })
      : [];
    if (unsyncedLogs.length > 0) {
      var pendingPayload = unsyncedLogs.map(function(l) {
        return {
          id: l.id,
          timestamp: l.timestamp || new Date().toISOString(),
          classId: l.classId || parseInt(localStorage.getItem('classId')) || 0,
          studentId: l.studentId,
          studentName: l.studentName || '',
          actionType: l.actionType || '',
          details: l.details || '',
          coinDelta: parseInt(l.coinDelta) || 0,
          expDelta: parseInt(l.expDelta) || 0,
          petId: l.petId || null,
          extra: l.extra || null,
          snapshot: l.snapshot || null,
          fullSnapshot: l.fullSnapshot || null,
          reverted: !!l.reverted
        };
      });
      studentPayload.pending_logs_json = JSON.stringify(pendingPayload);
    }

    var xhr = new XMLHttpRequest();
    xhr.open('PATCH', baseUrl + '/students?id=eq.' + studentId, false);
    xhr.setRequestHeader('Authorization', 'Bearer ' + anonKey);
    xhr.setRequestHeader('apikey', anonKey);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('Prefer', 'return=minimal');
    xhr.send(JSON.stringify(studentPayload));

    if (xhr.status >= 200 && xhr.status < 300) {
      _lastOwnWriteTime = now;
      // v118: Update _myBaseCoins immediately after sync XHR succeeds.
      _myBaseCoins = myStudent.coins;
      // v122: Mark logs as synced if they were included
      if (unsyncedLogs.length > 0) {
        unsyncedLogs.forEach(function(l) {
          l._synced = true;
          l._fromSupabase = true;
        });
        try { localStorage.setItem('operationLogs', JSON.stringify(window.operationLogs)); } catch(e) {}
        console.log('[DAL] v122 Sync XHR wrote ' + unsyncedLogs.length + ' logs (via _syncStudentDataImmediate)');
      }
    }

    // v118: Sync pets via async XHR (non-blocking) — student coins already synced above.
    // Also update _myBasePets to prevent async chain double-counting (same fix as coins).
    if (myStudent.pets && myStudent.pets.length > 0) {
      var validPets = myStudent.pets.filter(function(p) { return p.id && p.id > 0; });
      if (validPets.length > 0) {
        validPets.forEach(function(pet) {
          var petPayload = {
            growth: pet.growth || 0,
            level: pet.level || 1,
            coins: pet.coins || 0,
            is_active: (myStudent.activePetId === pet.id),
            is_dead: !!pet.isDead,
            last_feed_date: pet.lastFeedDate || null,
            last_play_date: pet.lastPlayDate || null,
            today_feed_count: pet.todayFeedCount || 0,
            today_play_count: pet.todayPlayCount || 0
          };
          try {
            var petXhr = new XMLHttpRequest();
            petXhr.open('PATCH', baseUrl + '/pets?id=eq.' + pet.id, true);
            petXhr.setRequestHeader('Authorization', 'Bearer ' + anonKey);
            petXhr.setRequestHeader('apikey', anonKey);
            petXhr.setRequestHeader('Content-Type', 'application/json');
            petXhr.setRequestHeader('Prefer', 'return=minimal');
            petXhr.send(JSON.stringify(petPayload));
          } catch(e) {}
        });
        // v118: Update _myBasePets immediately to prevent async chain double-counting
        validPets.forEach(function(p) { _myBasePets[p.id] = p.growth || 0; });
      }
    }
  } catch(e) {
    console.warn('[DAL] v118 Immediate sync failed:', e.message);
  }
}

// v115: Synchronous write of student data + pet data + operation logs.
// CRITICAL: Students CANNOT UPDATE classes table (RLS blocks anon key — verified).
// Students write to students table (confirmed working with anon key).
// Uses synchronous XHR to ensure the write completes before mobile browsers kill the page.
// v115: Now also syncs student data (coins, checkin, etc.) and pet data in the same call.
// Previously (v114) only synced pending_logs_json — student/pet data was only synced async,
// which could be killed on mobile before completing. This caused teacher's Realtime to never
// fire for student/pet updates, so pet cards and coins never auto-updated on teacher's screen.
function _syncWriteStudentPendingLogs() {
  if (!currentUser || currentUser.type !== 'student') return false;

  var studentId = parseInt(localStorage.getItem('studentId'));
  if (!studentId) {
    console.warn('[DAL] v115 No studentId for sync write');
    return false;
  }

  var anonKey = (typeof SUPABASE_ANON_KEY !== 'undefined') ? SUPABASE_ANON_KEY : '';
  if (!anonKey) {
    console.warn('[DAL] v115 No SUPABASE_ANON_KEY available');
    return false;
  }

  // Find my student data
  var myStudent = null;
  if (classesData && classesData[0]) {
    for (var i = 0; i < classesData[0].students.length; i++) {
      if (classesData[0].students[i].id === studentId) {
        myStudent = classesData[0].students[i];
        break;
      }
    }
  }
  if (!myStudent) {
    console.warn('[DAL] v115 Student data not found in classesData');
    return false;
  }

  var unsyncedLogs = (typeof window.operationLogs !== 'undefined' && Array.isArray(window.operationLogs))
    ? window.operationLogs.filter(function(l) { return !l._synced; })
    : [];

  try {
    var baseUrl = 'https://xbygooadskfqllnhwmet.supabase.co/rest/v1';

    // Build combined student payload — data + pending logs in ONE request
    var studentPayload = {
      coins: myStudent.coins || 0,
      last_checkin_date: myStudent.lastCheckinDate || null,
      last_jianghu_date: myStudent.lastJianghuDate || null,
      last_pk_date: myStudent.lastPkDate || null,
      active_pet_id: myStudent.activePetId || null,
      pk_count_today: myStudent.pkCountToday || 0,
      shop_items: JSON.stringify(myStudent.shopItems || []),
      equipped_items: JSON.stringify(myStudent.equippedItems || {})
    };

    // Add pending logs if any
    if (unsyncedLogs.length > 0) {
      var pendingPayload = unsyncedLogs.map(function(l) {
        return {
          id: l.id,
          timestamp: l.timestamp || new Date().toISOString(),
          classId: l.classId || parseInt(localStorage.getItem('classId')) || 0,
          studentId: l.studentId,
          studentName: l.studentName || '',
          actionType: l.actionType || '',
          details: l.details || '',
          coinDelta: parseInt(l.coinDelta) || 0,
          expDelta: parseInt(l.expDelta) || 0,
          petId: l.petId || null,
          extra: l.extra || null,
          snapshot: l.snapshot || null,
          fullSnapshot: l.fullSnapshot || null,
          reverted: !!l.reverted
        };
      });
      studentPayload.pending_logs_json = JSON.stringify(pendingPayload);
    }

    // Synchronous PATCH to students table — writes data + logs in ONE request
    var xhr = new XMLHttpRequest();
    xhr.open('PATCH', baseUrl + '/students?id=eq.' + studentId, false); // false = synchronous
    xhr.setRequestHeader('Authorization', 'Bearer ' + anonKey);
    xhr.setRequestHeader('apikey', anonKey);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('Prefer', 'return=minimal');
    xhr.send(JSON.stringify(studentPayload));

    var studentOk = (xhr.status >= 200 && xhr.status < 300);
    if (studentOk) {
      console.log('[DAL] v115 Sync wrote student data' + (unsyncedLogs.length > 0 ? ' + ' + unsyncedLogs.length + ' pending logs' : '') + ' for student ' + studentId);
      // Mark all unsynced logs as synced
      unsyncedLogs.forEach(function(l) {
        l._synced = true;
        l._fromSupabase = true;
      });
      try { localStorage.setItem('operationLogs', JSON.stringify(window.operationLogs)); } catch(e) {}
      _lastOwnWriteTime = Date.now();
      // v119: CRITICAL — Update _myBaseCoins and _myBasePets after sync XHR succeeds.
      // Without this, the async _syncStudentToSupabase() fetches the value we just wrote,
      // then applies localCoinDelta = (local - _myBaseCoins) on top of it, double-counting
      // the change. This caused coins to be incorrectly calculated after jianghu wins,
      // shop purchases, and other student-initiated coin changes.
      // Same fix as v118 for _syncStudentDataImmediate().
      _myBaseCoins = myStudent.coins;
      (myStudent.pets || []).forEach(function(p) { _myBasePets[p.id] = p.growth || 0; });
    } else {
      console.warn('[DAL] v115 Student sync write failed, status:', xhr.status, xhr.responseText);
    }

    // Also sync each pet synchronously
    var petsOk = 0;
    if (myStudent.pets && myStudent.pets.length > 0) {
      myStudent.pets.forEach(function(pet) {
        if (!pet.id || pet.id <= 0) return; // Skip pets without real DB IDs
        var petPayload = {
          growth: pet.growth || 0,
          level: pet.level || 1,
          coins: pet.coins || 0,
          is_active: (myStudent.activePetId === pet.id),
          is_dead: !!pet.isDead,
          last_feed_date: pet.lastFeedDate || null,
          last_play_date: pet.lastPlayDate || null,
          today_feed_count: pet.todayFeedCount || 0,
          today_play_count: pet.todayPlayCount || 0
        };
        try {
          var petXhr = new XMLHttpRequest();
          petXhr.open('PATCH', baseUrl + '/pets?id=eq.' + pet.id, false);
          petXhr.setRequestHeader('Authorization', 'Bearer ' + anonKey);
          petXhr.setRequestHeader('apikey', anonKey);
          petXhr.setRequestHeader('Content-Type', 'application/json');
          petXhr.setRequestHeader('Prefer', 'return=minimal');
          petXhr.send(JSON.stringify(petPayload));
          if (petXhr.status >= 200 && petXhr.status < 300) petsOk++;
        } catch(e) {}
      });
      if (petsOk > 0) {
        console.log('[DAL] v115 Sync wrote ' + petsOk + '/' + myStudent.pets.length + ' pets synchronously');
      }
    }

    return studentOk;
  } catch(e) {
    console.warn('[DAL] v115 Sync write failed:', e.message);
    return false;
  }
}

// v121: Async fallback for writing student pending logs.
// Called when sync XHR fails (common on mobile browsers that block sync XHR).
// Uses async XHR which is less reliable during page transitions but works
// during normal page operation.
function _writeStudentPendingLogsAsync() {
  if (!currentUser || currentUser.type !== 'student') return;

  var studentId = parseInt(localStorage.getItem('studentId'));
  if (!studentId) return;

  var anonKey = (typeof SUPABASE_ANON_KEY !== 'undefined') ? SUPABASE_ANON_KEY : '';
  if (!anonKey) return;

  var unsyncedLogs = (typeof window.operationLogs !== 'undefined' && Array.isArray(window.operationLogs))
    ? window.operationLogs.filter(function(l) { return !l._synced; })
    : [];

  if (unsyncedLogs.length === 0) return;

  console.log('[DAL] v121 Async fallback: writing ' + unsyncedLogs.length + ' pending logs...');

  try {
    var baseUrl = 'https://xbygooadskfqllnhwmet.supabase.co/rest/v1';
    var pendingPayload = unsyncedLogs.map(function(l) {
      return {
        id: l.id,
        timestamp: l.timestamp || new Date().toISOString(),
        classId: l.classId || parseInt(localStorage.getItem('classId')) || 0,
        studentId: l.studentId,
        studentName: l.studentName || '',
        actionType: l.actionType || '',
        details: l.details || '',
        coinDelta: parseInt(l.coinDelta) || 0,
        expDelta: parseInt(l.expDelta) || 0,
        petId: l.petId || null,
        extra: l.extra || null,
        snapshot: l.snapshot || null,
        fullSnapshot: l.fullSnapshot || null,
        reverted: !!l.reverted
      };
    });

    var xhr = new XMLHttpRequest();
    xhr.open('PATCH', baseUrl + '/students?id=eq.' + studentId, true); // async
    xhr.setRequestHeader('Authorization', 'Bearer ' + anonKey);
    xhr.setRequestHeader('apikey', anonKey);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('Prefer', 'return=minimal');
    xhr.onreadystatechange = function() {
      if (xhr.readyState === 4) {
        if (xhr.status >= 200 && xhr.status < 300) {
          console.log('[DAL] v121 Async fallback: wrote ' + unsyncedLogs.length + ' pending logs');
          unsyncedLogs.forEach(function(l) {
            l._synced = true;
            l._fromSupabase = true;
          });
          try { localStorage.setItem('operationLogs', JSON.stringify(window.operationLogs)); } catch(e) {}
        } else {
          console.warn('[DAL] v121 Async fallback failed, status:', xhr.status);
        }
      }
    };
    xhr.send(JSON.stringify({ pending_logs_json: JSON.stringify(pendingPayload) }));
  } catch(e) {
    console.warn('[DAL] v121 Async fallback error:', e.message);
  }
}

// v121: Verify that student logs were written to Supabase.
// Called 2 seconds after each action. If there are still unsynced logs,
// it means both sync and async XHR failed, so we retry.
function _verifyStudentLogsWritten() {
  if (!currentUser || currentUser.type !== 'student') return;

  var unsyncedLogs = (typeof window.operationLogs !== 'undefined' && Array.isArray(window.operationLogs))
    ? window.operationLogs.filter(function(l) { return !l._synced; })
    : [];

  if (unsyncedLogs.length === 0) return;

  console.log('[DAL] v121 Verification: found ' + unsyncedLogs.length + ' unsynced logs, retrying...');
  _writeStudentPendingLogsAsync();
}

/* ===== Lifecycle ===== */
function _setupPageLifecycle() {
  // v122: Use navigator.sendBeacon() for beforeunload — the modern, reliable way.
  // sendBeacon() is specifically designed for sending data when page is unloading.
  // It's NOT blocked by mobile browsers (unlike sync XHR which is frequently blocked).
  // The browser guarantees the request will complete even after the page is destroyed.
  window.addEventListener('beforeunload', function() {
    var hasUnsyncedLogs = false;
    if (typeof window.operationLogs !== 'undefined' && Array.isArray(window.operationLogs)) {
      hasUnsyncedLogs = window.operationLogs.some(function(l) { return !l._synced; });
    }
    if ((_pendingLocalSave || hasUnsyncedLogs) && currentUser) {
      try {
        var baseUrl = 'https://xbygooadskfqllnhwmet.supabase.co/rest/v1';

        if (currentUser.type === 'student') {
          // v122: Use sendBeacon for students — guaranteed delivery even when page is killed.
          var studentId = parseInt(localStorage.getItem('studentId'));
          var anonKey = (typeof SUPABASE_ANON_KEY !== 'undefined') ? SUPABASE_ANON_KEY : '';
          if (studentId && anonKey) {
            var myStudent = null;
            if (classesData && classesData[0]) {
              for (var i = 0; i < classesData[0].students.length; i++) {
                if (classesData[0].students[i].id === studentId) {
                  myStudent = classesData[0].students[i]; break;
                }
              }
            }
            if (myStudent) {
              var payload = {
                coins: myStudent.coins || 0,
                last_checkin_date: myStudent.lastCheckinDate || null,
                last_jianghu_date: myStudent.lastJianghuDate || null,
                last_pk_date: myStudent.lastPkDate || null,
                active_pet_id: myStudent.activePetId || null,
                pk_count_today: myStudent.pkCountToday || 0,
                shop_items: JSON.stringify(myStudent.shopItems || []),
                equipped_items: JSON.stringify(myStudent.equippedItems || {})
              };
              // Include unsynced logs
              if (hasUnsyncedLogs) {
                var unsyncedLogs = window.operationLogs.filter(function(l) { return !l._synced; });
                if (unsyncedLogs.length > 0) {
                  payload.pending_logs_json = JSON.stringify(unsyncedLogs.map(function(l) {
                    return {
                      id: l.id, timestamp: l.timestamp || new Date().toISOString(),
                      classId: l.classId || parseInt(localStorage.getItem('classId')) || 0,
                      studentId: l.studentId, studentName: l.studentName || '',
                      actionType: l.actionType || '', details: l.details || '',
                      coinDelta: parseInt(l.coinDelta) || 0, expDelta: parseInt(l.expDelta) || 0,
                      petId: l.petId || null, extra: l.extra || null,
                      snapshot: l.snapshot || null, fullSnapshot: l.fullSnapshot || null,
                      reverted: !!l.reverted
                    };
                  }));
                }
              }
              var blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
              var url = baseUrl + '/students?id=eq.' + studentId;
              if (navigator.sendBeacon(url, blob)) {
                console.log('[DAL] v122 sendBeacon: student data + logs sent via beforeunload');
              } else {
                console.warn('[DAL] v122 sendBeacon failed, falling back to sync XHR');
                _syncWriteStudentPendingLogs();
              }
            }
          }
        } else {
          // Teacher: needs Supabase Auth token
          var teacherToken = '';
          try { teacherToken = JSON.parse(localStorage.getItem('sb-xbygooadskfqllnhwmet-auth-token') || '{}').access_token || ''; } catch(e) {}
          if (!teacherToken) return;
          var xhr2 = new XMLHttpRequest();
          xhr2.open('POST', baseUrl + '/rpc/sync_ping', false);
          xhr2.setRequestHeader('Authorization', 'Bearer ' + teacherToken);
          xhr2.setRequestHeader('apikey', teacherToken);
          xhr2.send();
          console.log('[DAL] v54 beforeunload: teacher sync_ping sent');
        }
      } catch(e) {
        console.warn('[DAL] v122 beforeunload save failed:', e.message);
      }
    }
  });

  // Sync on visibility change — v122: Use sendBeacon for students when page hidden.
  // sendBeacon() is more reliable than sync XHR on mobile browsers.
  document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
      // v122: For students, use sendBeacon (or async XHR) when page hidden.
      if (currentUser && currentUser.type === 'student') {
        var _hasUnsyncedLogs = (typeof window.operationLogs !== 'undefined' && Array.isArray(window.operationLogs))
          ? window.operationLogs.some(function(l) { return !l._synced; })
          : false;
        if (_pendingLocalSave || _hasUnsyncedLogs) {
          console.log('[DAL] v122 Page hidden — syncing student data via sendBeacon...');
          // Try sendBeacon first (most reliable), fall back to sync XHR
          var studentId = parseInt(localStorage.getItem('studentId'));
          var anonKey = (typeof SUPABASE_ANON_KEY !== 'undefined') ? SUPABASE_ANON_KEY : '';
          var beaconSent = false;
          if (studentId && anonKey && navigator.sendBeacon) {
            var myStudent = null;
            if (classesData && classesData[0]) {
              for (var i = 0; i < classesData[0].students.length; i++) {
                if (classesData[0].students[i].id === studentId) {
                  myStudent = classesData[0].students[i]; break;
                }
              }
            }
            if (myStudent) {
              var payload = {
                coins: myStudent.coins || 0,
                last_checkin_date: myStudent.lastCheckinDate || null,
                last_jianghu_date: myStudent.lastJianghuDate || null,
                last_pk_date: myStudent.lastPkDate || null,
                active_pet_id: myStudent.activePetId || null,
                pk_count_today: myStudent.pkCountToday || 0,
                shop_items: JSON.stringify(myStudent.shopItems || []),
                equipped_items: JSON.stringify(myStudent.equippedItems || {})
              };
              if (_hasUnsyncedLogs) {
                var unsyncedLogs = window.operationLogs.filter(function(l) { return !l._synced; });
                if (unsyncedLogs.length > 0) {
                  payload.pending_logs_json = JSON.stringify(unsyncedLogs.map(function(l) {
                    return {
                      id: l.id, timestamp: l.timestamp || new Date().toISOString(),
                      classId: l.classId || parseInt(localStorage.getItem('classId')) || 0,
                      studentId: l.studentId, studentName: l.studentName || '',
                      actionType: l.actionType || '', details: l.details || '',
                      coinDelta: parseInt(l.coinDelta) || 0, expDelta: parseInt(l.expDelta) || 0,
                      petId: l.petId || null, extra: l.extra || null,
                      snapshot: l.snapshot || null, fullSnapshot: l.fullSnapshot || null,
                      reverted: !!l.reverted
                    };
                  }));
                }
              }
              var blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
              var baseUrl = 'https://xbygooadskfqllnhwmet.supabase.co/rest/v1';
              var url = baseUrl + '/students?id=eq.' + studentId;
              beaconSent = navigator.sendBeacon(url, blob);
              if (beaconSent) {
                console.log('[DAL] v122 sendBeacon: student data + logs sent via visibilitychange');
              }
            }
          }
          // Fallback to sync XHR if sendBeacon not available or failed
          if (!beaconSent) {
            console.log('[DAL] v122 sendBeacon unavailable, falling back to sync XHR');
            _syncWriteStudentPendingLogs();
          }
        }
      } else {
        // Teacher: async is OK (teacher pages rarely killed on mobile)
        if (_pendingLocalSave && !_dalSyncing) {
          _syncToSupabase();
        }
        if (typeof window.operationLogs !== 'undefined' && Array.isArray(window.operationLogs)) {
          var _hiddenUnsynced = window.operationLogs.some(function(l) { return !l._synced; });
          if (_hiddenUnsynced && typeof _writeUnsyncedLogsToSupabase === 'function') {
            console.log('[DAL] v109 Page hidden with unsynced logs, writing immediately...');
            _writeUnsyncedLogsToSupabase();
          }
        }
      }
    } else {
      // Page becoming visible — do a full refresh to catch any missed Realtime updates
      // v102: Use _immediateRefreshFromSupabase (no debounce) for immediate data consistency
      console.log('[DAL] v102 Page visible — scheduling full refresh (safety net)');
      var doRefresh = function() {
        if (_dalSyncing) {
          // Sync still in progress, wait and retry
          setTimeout(doRefresh, 2000);
          return;
        }
        // If we synced very recently (< 5s ago), skip refresh — our data is already fresh
        if (Date.now() - _lastOwnWriteTime < 5000) {
          console.log('[DAL] v102 Skipping refresh — recent own write (' + Math.round((Date.now() - _lastOwnWriteTime) / 1000) + 's ago)');
          return;
        }
        // v102: Use immediate refresh (bypasses debounce) for faster consistency
        _immediateRefreshFromSupabase();
      };
      // Initial 2s delay to let any hidden-phase sync complete
      setTimeout(doRefresh, 2000);
    }
  });
}

/* ===== Wrap Save Functions ===== */
function wrapSaveFunctions() {
  // Wrap saveClassData
  if (typeof saveClassData === 'function' && !saveClassData._dalWrapped) {
    var origSaveClassData = saveClassData;
    saveClassData = function() {
      _pendingLocalSave = true; // Mark that local data has unsaved changes
      origSaveClassData.apply(this, arguments);
      _updateCloudStatus('syncing');
      _syncToSupabase();
      // v116: For students, IMMEDIATELY push data to Supabase via sync XHR.
      // This ensures teacher's Realtime fires within ~100ms, updating pet cards instantly.
      // Without this, the async _syncToSupabase() chain (4 steps) can take 3-5s on mobile,
      // and may be interrupted if the page is suspended before completion.
      // Throttled to at most once every 2 seconds.
      if (currentUser && currentUser.type === 'student') {
        _syncStudentDataImmediate();
      }
    };
    saveClassData._dalWrapped = true;
  }

  // Wrap saveCustomActions
  if (typeof saveCustomActions === 'function' && !saveCustomActions._dalWrapped) {
    var origSaveCustomActions = saveCustomActions;
    saveCustomActions = function() {
      _pendingLocalSave = true;
      origSaveCustomActions.apply(this, arguments);
      _updateCloudStatus('syncing');
      _syncToSupabase();
    };
    saveCustomActions._dalWrapped = true;
  }

  // Wrap saveLogs — v26: simplified to avoid race conditions
  // The original saveLogs() calls triggerRealtimeSync() which debounces _syncToSupabase()
  // _syncToSupabase() already calls _writeUnsyncedLogsToSupabase(), so we don't need to call it here
  if (typeof saveLogs === 'function' && !saveLogs._dalWrapped) {
    var origSaveLogs = saveLogs;
    saveLogs = function() {
      origSaveLogs.apply(this, arguments);
      // Logs will be synced by _syncToSupabase() via triggerRealtimeSync()
      // No need to call _writeUnsyncedLogsToSupabase() here - it would cause race conditions
    };
    saveLogs._dalWrapped = true;
  }

  // Wrap saveDeletedClasses
  if (typeof saveDeletedClasses === 'function' && !saveDeletedClasses._dalWrapped) {
    var origSaveDeletedClasses = saveDeletedClasses;
    saveDeletedClasses = function() {
      origSaveDeletedClasses.apply(this, arguments);
      // Deleted classes are local-only for now
    };
    saveDeletedClasses._dalWrapped = true;
  }

  console.log('[DAL] Save functions wrapped');
}

/* ===== Student Restrictions ===== */
// Helper: check if student is operating on their own data
function _isMyStudent(studentId) {
  return currentUser && currentUser.type === 'student' && 
         currentUser.studentId && studentId.toString() === currentUser.studentId.toString();
}

// Helper: block operation if student tries to modify other student's data
function _blockIfNotMine(studentId, actionName) {
  if (currentUser && currentUser.type === 'student' && !_isMyStudent(studentId)) {
    if (typeof showNotification === 'function') {
      showNotification('权限不足', '只能操作自己的宠物', 'warning');
    }
    console.log('[DAL] Blocked student ' + currentUser.studentName + ' from ' + actionName + ' on student ' + studentId);
    return true;
  }
  return false;
}

function applyStudentRestrictions() {
  if (!currentUser) return;
  
  // v103: Show teacher-only elements for teachers by adding teacher-visible class
  // (This was missing — caused all teacher buttons to be hidden)
  if (currentUser.type === 'teacher') {
    console.log('[DAL] v103 Showing teacher buttons for:', currentUser.email);
    document.querySelectorAll('.data-mgmt-btn').forEach(function(el) {
      el.classList.add('teacher-visible');
    });
    document.querySelectorAll('.class-actions').forEach(function(el) {
      el.classList.add('teacher-visible');
    });
    document.querySelectorAll('.teacher-only').forEach(function(el) {
      el.style.display = 'flex';
    });
    return;
  }
  
  // Student: hide teacher-only UI elements
  console.log('[DAL] Applying student restrictions for:', currentUser.studentName);

  // Hide teacher-only UI elements
  var teacherOnlySelectors = [
    '.class-actions',
    '.data-mgmt-btn',
    '.delete-class-btn',
    '.home-stat',
  ];
  teacherOnlySelectors.forEach(function(sel) {
    document.querySelectorAll(sel).forEach(function(el) {
      el.style.display = 'none';
    });
  });

  // But show the history button for students
  document.querySelectorAll('.student-history-visible').forEach(function(el) {
    el.style.display = '';
  });

  // Hide pet shop buttons
  document.querySelectorAll('button[onclick*="showPetShopBrowse"]').forEach(function(el) {
    el.style.display = 'none';
  });

  // Hide deleted classes link
  document.querySelectorAll('[onclick*="showDeletedClassesModal"]').forEach(function(el) {
    el.style.display = 'none';
  });

  // ===== Function-level guards =====
  // Guard renamePet: only allow own pet
  if (typeof window._origRenamePet === 'undefined') {
    window._origRenamePet = window.renamePet;
  }
  window.renamePet = function(studentId, petId) {
    if (_blockIfNotMine(studentId, 'renamePet')) return;
    return window._origRenamePet(studentId, petId);
  };

  // Guard confirmRenamePet: only allow own pet
  if (typeof window._origConfirmRenamePet === 'undefined') {
    window._origConfirmRenamePet = window.confirmRenamePet;
  }
  window.confirmRenamePet = function(studentId, petId) {
    if (_blockIfNotMine(studentId, 'confirmRenamePet')) return;
    return window._origConfirmRenamePet(studentId, petId);
  };

  // Guard showChangePetModal: only allow own pet
  if (typeof window._origShowChangePetModal === 'undefined') {
    window._origShowChangePetModal = window.showChangePetModal;
  }
  window.showChangePetModal = function(studentId) {
    if (_blockIfNotMine(studentId, 'showChangePetModal')) return;
    return window._origShowChangePetModal(studentId);
  };

  // Guard showSwitchPetModal: only allow own pet
  if (typeof window._origShowSwitchPetModal === 'undefined') {
    window._origShowSwitchPetModal = window.showSwitchPetModal;
  }
  window.showSwitchPetModal = function(studentId) {
    if (_blockIfNotMine(studentId, 'showSwitchPetModal')) return;
    return window._origShowSwitchPetModal(studentId);
  };

  // Guard switchPet: only allow own pet
  if (typeof window._origSwitchPet === 'undefined') {
    window._origSwitchPet = window.switchPet;
  }
  window.switchPet = function(studentId, petId) {
    if (_blockIfNotMine(studentId, 'switchPet')) return;
    return window._origSwitchPet(studentId, petId);
  };

  // Guard feedPet: only allow own student
  if (typeof window._origFeedPet === 'undefined') {
    window._origFeedPet = window.feedPet;
  }
  window.feedPet = function(student, pet) {
    if (_blockIfNotMine(student.id, 'feedPet')) return false;
    return window._origFeedPet(student, pet);
  };

  // Guard playWithPet: only allow own student
  if (typeof window._origPlayWithPet === 'undefined') {
    window._origPlayWithPet = window.playWithPet;
  }
  window.playWithPet = function(student, pet) {
    if (_blockIfNotMine(student.id, 'playWithPet')) return false;
    return window._origPlayWithPet(student, pet);
  };

  // Guard showAdoptModal: only allow own student
  if (typeof window._origShowAdoptModal === 'undefined') {
    window._origShowAdoptModal = window.showAdoptModal;
  }
  window.showAdoptModal = function(studentId) {
    if (_blockIfNotMine(studentId, 'showAdoptModal')) return;
    return window._origShowAdoptModal(studentId);
  };

  // Guard revivePet: only allow own student
  if (typeof window._origRevivePet === 'undefined') {
    window._origRevivePet = window.revivePet;
  }
  window.revivePet = function(student, pet) {
    if (_blockIfNotMine(student.id, 'revivePet')) return false;
    return window._origRevivePet(student, pet);
  };

  // Guard walkPet (if exists)
  if (typeof window.walkPet === 'function' && typeof window._origWalkPet === 'undefined') {
    window._origWalkPet = window.walkPet;
    window.walkPet = function(student, pet) {
      if (_blockIfNotMine(student.id, 'walkPet')) return false;
      return window._origWalkPet(student, pet);
    };
  }

  // Guard buyShopItem (if exists)
  if (typeof window.buyShopItem === 'function' && typeof window._origBuyShopItem === 'undefined') {
    window._origBuyShopItem = window.buyShopItem;
    window.buyShopItem = function(studentId, itemId) {
      if (_blockIfNotMine(studentId, 'buyShopItem')) return;
      return window._origBuyShopItem(studentId, itemId);
    };
  }

  // v19: REMOVED openStudentModal override — students viewing other students' pets
  // now use the original openStudentModal from app.js which correctly shows
  // buildReadOnlyStudentModalContent (read-only view, no action buttons).
  // PK challenges can ONLY be initiated from the PK page via showStudentPKChallengeModal().

  // Override renderHomePetGrid to hide interaction buttons for other students' pets
  if (typeof window._origRenderHomePetGrid === 'undefined') {
    window._origRenderHomePetGrid = window.renderHomePetGrid;
  }
  window.renderHomePetGrid = function() {
    window._origRenderHomePetGrid();
    if (currentUser.type !== 'student') return;
    var myId = currentUser.studentId.toString();
    var cards = document.querySelectorAll('.home-pet-card');
    cards.forEach(function(card) {
      var onclick = card.getAttribute('onclick') || '';
      if (onclick.indexOf("'" + myId + "'") === -1 && onclick.indexOf('"' + myId + '"') === -1) {
        card.querySelectorAll('button').forEach(function(btn) {
          var btnOnclick = btn.getAttribute('onclick') || '';
          if (btnOnclick.indexOf('showChangePetModal') !== -1 ||
              btnOnclick.indexOf('showSwitchPetModal') !== -1 ||
              btnOnclick.indexOf('renamePet') !== -1) {
            btn.style.display = 'none';
          }
        });
        // Also hide rename span button
        card.querySelectorAll('.rename-pet-btn').forEach(function(el) {
          el.style.display = 'none';
        });
      }
    });
  };
}

// v19: REMOVED _studentChallengePK — PK challenges must go through the PK page
// via showStudentPKChallengeModal(), not from individual pet card modals.

/* ===== Export/Import ===== */
function exportAllDataToUSB() {
  var data = {
    classes: classesData,
    customActions: typeof customActions !== 'undefined' ? customActions : [],
    operationLogs: typeof window.operationLogs !== 'undefined' ? window.operationLogs : [],
    exportDate: new Date().toISOString()
  };
  var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'pet-backup-' + new Date().toISOString().slice(0, 10) + '.json';
  a.click();
  URL.revokeObjectURL(url);
  _showNotification('数据已导出');
}

function importDataFromUSB() {
  var input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = function(e) {
    var file = e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function(ev) {
      try {
        var data = JSON.parse(ev.target.result);
        if (data.classes) {
          classesData = data.classes;
          if (typeof saveClassData === 'function') saveClassData();
          _syncToSupabase();
          if (typeof init === 'function') init();
          _showNotification('数据已导入');
        }
      } catch (err) {
        _showNotification('导入失败: 文件格式错误', 'error');
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

/* ===== Init ===== */
// v45: Event-driven init — no more polling. Supabase/auth-check call window._onAuthReady() when ready.
var _authReady = false;
var _dbReady = false;
window._onAuthReady = function() {
  _authReady = true;
  console.log('[DAL] Auth ready (event-driven)');
  _tryInitDAL();
};
// Watch for db availability (Supabase client loaded via defer script)
var _dbCheckInterval = null;
function _watchForDb() {
  if (typeof db !== 'undefined' && db) {
    _dbReady = true;
    if (_dbCheckInterval) { clearInterval(_dbCheckInterval); _dbCheckInterval = null; }
    console.log('[DAL] DB ready (event-driven)');
    _tryInitDAL();
    return;
  }
  // Fallback: check every 200ms (max 5s)
  if (!_dbCheckInterval) {
    var _checks = 0;
    _dbCheckInterval = setInterval(function() {
      _checks++;
      if ((typeof db !== 'undefined' && db) || _checks > 25) {
        clearInterval(_dbCheckInterval);
        _dbCheckInterval = null;
        if (typeof db !== 'undefined' && db) {
          _dbReady = true;
          _tryInitDAL();
        }
      }
    }, 200);
  }
}
// Start watching immediately
_watchForDb();
// Also trigger auth check when auth-check.js finishes (it sets currentUser)
// auth-check.js runs as defer, so it executes before DOMContentLoaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() {
    if (typeof currentUser !== 'undefined' && currentUser) {
      _authReady = true;
      _tryInitDAL();
    }
  });
} else {
  // DOM already loaded (shouldn't happen with defer, but just in case)
  if (typeof currentUser !== 'undefined' && currentUser) {
    _authReady = true;
    _tryInitDAL();
  }
}

var _dalInitStarted = false;
function _tryInitDAL() {
  if (_dalInitStarted) return;
  if (!_dbReady || !_authReady) return;
  _dalInitStarted = true;
  _initDALCore();
}

function _initDALCore() {
  if (_dalReady) return;

  console.log('[DAL] Initializing v' + _DAL_VERSION + ' for ' + currentUser.type + ': ' + (currentUser.email || currentUser.studentName));

  // Clean up truly stale localStorage keys only.
  var staleKeys = ['classPetData', '_dalDeletedClassIds', '_dalIdMap', '_dal_unsyncedFlag', 'deletedClasses'];
  staleKeys.forEach(function(key) {
    try { localStorage.removeItem(key); } catch(e) {}
  });
  console.log('[DAL] Cleaned stale localStorage keys (preserved operationLogs & customActions)');

  // Show loading state
  _updateCloudStatus('syncing');

  // v45: Load cache into classesData for faster data availability.
  // We do NOT call init() here — the normal flow below handles all rendering.
  // The cache just ensures classesData is populated immediately so that when
  // the Supabase query returns, the merge/diff is faster and data is already warm.
  var cached = _loadFromCache();
  if (cached) {
    // Pre-populate classesData from cache (will be overwritten by fresh load below)
    classesData = cached.classesData;
    if (cached.currentClassId && typeof currentClassId !== 'undefined') {
      currentClassId = cached.currentClassId;
    }
    if (cached.customActions && typeof customActions !== 'undefined') {
      customActions = cached.customActions;
    }
    if (cached.operationLogs) {
      window.operationLogs = cached.operationLogs;
    }
    console.log('[DAL] Cache pre-loaded into memory');
  }

  // Full load from Supabase (single source of truth)
  loadFromSupabase().then(function() {
    // v103: Mark initial load complete — now allow refresh functions to run
    _dalInitialLoadComplete = true;
    
    // Re-render the app with fresh data
    if (typeof init === 'function') init();
    if (typeof renderClassList === 'function') renderClassList();
    if (typeof scheduleAllRenders === 'function') scheduleAllRenders();
    
    if (typeof _updatePKInviteBadge === 'function') {
      setTimeout(_updatePKInviteBadge, 500);
    }
    
    // v125: 初始化学生端零食审批状态按钮
    if (typeof _initSnackStatusButton === 'function') {
      setTimeout(_initSnackStatusButton, 300);
    }

    wrapSaveFunctions();
    _setupRealtimeSubscriptions();
    _setupPageLifecycle();
    applyStudentRestrictions();

    var cloudEl = document.getElementById('cloudSyncStatus');
    if (cloudEl) {
      cloudEl.style.cursor = 'pointer';
      cloudEl.onclick = function() { forceManualSync(); };
    }

    _dalReady = true;
    _updateCloudStatus('synced');
    if (typeof window._hideDalLoading === 'function') window._hideDalLoading();
    console.log('[DAL] Ready ✓');
    
    _postInitSetup();
  }).catch(function(err) {
    console.error('[DAL] Init load failed:', err);
    _updateCloudStatus('error');
    _showNotification('数据加载失败，请刷新页面重试', 'error');
    if (typeof window._hideDalLoading === 'function') window._hideDalLoading();

    // v45: If we have cache data, at least render that instead of nothing
    if (cached && cached.classesData && cached.classesData.length > 0) {
      console.log('[DAL] Falling back to cached data after load failure...');
      classesData = cached.classesData;
      if (cached.currentClassId) currentClassId = cached.currentClassId;
      if (typeof init === 'function') init();
      if (typeof renderClassList === 'function') renderClassList();
      if (typeof scheduleAllRenders === 'function') scheduleAllRenders();
      wrapSaveFunctions();
      applyStudentRestrictions();
      _dalReady = true;
    }

    setTimeout(function() {
      _dalReady = false;
      _dalInitStarted = false;
      _initDALCore();
    }, 5000);
  });
}

function _postInitSetup() {
  // v109: Retry writing any unsynced operation logs after init.
  // On mobile, the page may be killed before the debounce timer fires,
  // leaving logs in localStorage that were never written to Supabase.
  // Retry at 1s, 5s, 15s, then every 30s as a safety net.
  var _retryWriteUnsynced = function() {
    if (typeof window.operationLogs !== 'undefined' && Array.isArray(window.operationLogs)) {
      var unsynced = window.operationLogs.filter(function(l) { return !l._synced; });
      if (unsynced.length > 0) {
        console.log('[DAL] v109 Found ' + unsynced.length + ' unsynced logs, writing now...');
        if (typeof _writeUnsyncedLogsToSupabase === 'function') {
          _writeUnsyncedLogsToSupabase();
        }
      }
    }
  };
  setTimeout(_retryWriteUnsynced, 1000);
  setTimeout(_retryWriteUnsynced, 5000);
  setTimeout(_retryWriteUnsynced, 15000);
  // 持续安全网：每30秒检查一次未同步日志
  setInterval(_retryWriteUnsynced, 30000);

  // Periodic PK badge check for students (every 10 seconds)
  if (currentUser.type === 'student' && typeof _updatePKInviteBadge === 'function') {
    setInterval(_updatePKInviteBadge, 10000);
  }
  
  // v18: For teachers, auto-check if operation_logs RLS allows student reads
  if (currentUser.type === 'teacher') {
    setTimeout(function() {
      var classId = typeof currentClassId !== 'undefined' ? currentClassId : (classesData[0] ? classesData[0].id : null);
      if (!classId) return;
      db.from('operation_logs').select('id').eq('class_id', classId).limit(1).then(function(r) {
        if (r.error) {
          console.warn('[DAL] v18 AUTO-CHECK: operation_logs RLS is blocking reads!');
        }
      }).catch(function() {});
    }, 3000);
  }
  
  // 排行榜滚动公告：数据加载完成后显示
  setTimeout(function() {
    if (typeof showRankAnnouncement === 'function') {
      showRankAnnouncement();
    }
  }, 2000);
}

// Keep initDAL as an alias for backward compatibility
function initDAL() {
  // Legacy entry point — the event-driven system handles init now
  // But if called manually (e.g., from retry), try to init
  if (!_dalInitStarted) {
    if (typeof db !== 'undefined' && db) _dbReady = true;
    if (typeof currentUser !== 'undefined' && currentUser) _authReady = true;
    _tryInitDAL();
  }
}

/* ===== Auto-init ===== */
// v45: Event-driven init — no more setTimeout polling.
// The _watchForDb() and DOMContentLoaded listener above handle triggering init.
// auth-check.js should call window._onAuthReady() when currentUser is set.
// Fallback: if after 3s auth hasn't fired, check manually.
setTimeout(function() {
  if (!_dalInitStarted && typeof currentUser !== 'undefined' && currentUser) {
    _authReady = true;
    _tryInitDAL();
  }
}, 3000);
