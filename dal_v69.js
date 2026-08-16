/**
 * dal.js v79 — Robust Data Access Layer with Smart Merge
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
 * 
 * Flow: loadFromSupabase() → classesData + snapshot → UI
 *       UI action → saveClassData() → _syncToSupabase() → Supabase → update snapshot
 *       Realtime event → debounced → _smartRefreshFromSupabase() → merge fresh vs snapshot
 *       Student action → _syncStudentToSupabase() → fetch fresh → delta merge → upsert
 */

/* ===== State ===== */
var _dalReady = false;
var _dalSyncing = false;
var _dalSyncQueued = false;
var _refreshTimer = null;
var _refreshInterval = 120000; // v94: Restored 2min fallback polling. Realtime now works via SQL (students/pets tables added to publication).
var _lastRefreshTime = 0;
var _realtimeActive = false; // v54: True when at least one Realtime channel is connected
var _realtimeChannels = [];
var _syncRetryCount = 0;
var _maxRetries = 3;
var _lastSyncFailed = false;
var _DAL_VERSION = '89.0';
var _pendingLocalSave = false; // True when local data has unsaved changes — prevents Realtime overwrite
var _petSyncResults = {}; // v91: Module-level so both _syncStudentToSupabase and _syncToSupabase can access
var _teacherBaseCoins = {}; // v91: Per-student baseline coins for teacher delta sync (studentId → coins)
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
var _REFRESH_DEBOUNCE_MS = 300; // v92: 300ms debounce for Realtime events (was 1.5s)
var _lastOwnWriteTime = 0;       // Timestamp of our last successful sync
var _OWN_WRITE_IGNORE_MS = 15000; // v86: Ignore Realtime events for 15s after our own write (was 10s — too short for mobile)
var _petSyncErrorShown = false;   // v87: Prevent spamming error notifications

// v87: Show user-visible notification when pet data fails to sync
function _showPetSyncError(petName) {
  if (_petSyncErrorShown) return;
  _petSyncErrorShown = true;
  setTimeout(function() { _petSyncErrorShown = false; }, 30000); // Reset after 30s
  var msg = '宠物「' + (petName || '') + '」数据同步失败，请检查网络后刷新页面。如持续出现请联系管理员。';
  if (typeof _showNotification === 'function') {
    _showNotification('数据同步异常', msg, 'error');
  } else if (typeof showNotification === 'function') {
    showNotification('数据同步异常', msg, 'error');
  }
  console.error('[DAL] v87 PET SYNC FAILURE: ' + msg);
}

/* ===== Realtime Channel Coalescing (v53) ===== */
// All 4 Realtime channels call this instead of _immediateRefreshFromSupabase directly.
// Coalesces multiple events within 500ms into a single refresh.
var _realtimeCoalesceTimer = null;
function _debouncedRealtimeRefresh(source) {
  console.log('[DAL] 🔔 Realtime event from [' + source + '] — coalesced (500ms)');
  if (_realtimeCoalesceTimer) return; // already scheduled, skip
  _realtimeCoalesceTimer = setTimeout(function() {
    _realtimeCoalesceTimer = null;
    _immediateRefreshFromSupabase();
  }, 500);
}

/* ===== v94: Removed Realtime Health Check ===== */
// Realtime now works correctly after adding students/pets tables to supabase_realtime publication via SQL.
// No need for health check or fast polling fallback.

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
  
  // v30: Use full _OWN_WRITE_IGNORE_MS protection (was 2s, too short for mobile).
  // On mobile, Realtime echo of our own write can arrive 3-5s after the upsert.
  // The old 2s protection expired before the echo arrived, causing stale data overwrite.
  if (Date.now() - _lastOwnWriteTime < _OWN_WRITE_IGNORE_MS) {
    console.log('[DAL] Smart refresh skipped — own write echo (' + 
      Math.round((_OWN_WRITE_IGNORE_MS - (Date.now() - _lastOwnWriteTime)) / 1000) + 's remaining)');
    return Promise.resolve();
  }

  console.log('[DAL] Smart refresh starting...');
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
      db.from('students').select('id, name, class_id, coins, last_checkin_date, last_jianghu_date, last_pk_date, active_pet_id, pk_count_today, shop_items, equipped_items, password, quiz_state').eq('class_id', classId),
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
        db.from('students').select('id, name, class_id, coins, last_checkin_date, last_jianghu_date, last_pk_date, active_pet_id, pk_count_today, shop_items, equipped_items, password, quiz_state').in('class_id', classIds),
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
              // v91: Update teacher baseline so next sync computes correct delta
              _teacherBaseCoins[localStu.id] = freshStu.coins;
              changesApplied++;
            }
            // If local changed too → keep local (we'll sync it soon)
          } else if (freshStu.coins !== localStu.coins) {
            // No snapshot — trust server value
            localStu.coins = freshStu.coins;
            // v91: Update teacher baseline
            _teacherBaseCoins[localStu.id] = freshStu.coins;
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
      quizState: (function() { try { return typeof s.quiz_state === 'string' ? JSON.parse(s.quiz_state) : (s.quiz_state || null); } catch(e) { return null; } })()
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
      db.from('students').select('id, name, class_id, coins, last_checkin_date, last_jianghu_date, last_pk_date, active_pet_id, pk_count_today, shop_items, equipped_items, password, quiz_state').in('class_id', classIds),
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

    // v91: Initialize _teacherBaseCoins for delta-based coin sync.
    // Records the server's coin values at load time so teacher sync can compute
    // deltas (teacher rewards) instead of blindly overwriting student spending.
    newClassesData.forEach(function(cls) {
      cls.students.forEach(function(stu) {
        _teacherBaseCoins[stu.id] = stu.coins || 0;
      });
    });

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
    db.from('students').select('id, name, class_id, coins, last_checkin_date, last_jianghu_date, last_pk_date, active_pet_id, pk_count_today, shop_items, equipped_items, password, quiz_state').eq('class_id', classId),
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
        quizState: (function() { try { return typeof s.quiz_state === 'string' ? JSON.parse(s.quiz_state) : (s.quiz_state || null); } catch(e) { return null; } })()
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
 * v68: Logs older than 7 days are automatically removed (keep max 5000).
 *
 * WRITE: UI action → saveLogs() → _writeUnsyncedLogsToSupabase() → classes.upsert
 * READ:  init/refresh → _loadOperationLogs() → classes.select → parse JSON
 */

var _OP_LOGS_MAX_PER_CLASS = 2000;
var _OP_LOGS_RETENTION_DAYS = 3; // v80: Keep only last 3 days (reduced from 7)

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
// v85: Also load from student_operation_logs table (student-written logs).
//      Merge both sources so teachers and students see the complete history.
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
    console.log('[DAL] v85 Loading operation logs from classes + student_operation_logs for class_ids:', classIds);

    // v85: Load from BOTH sources in parallel
    var teacherLogsPromise = db.from('classes').select('id, operation_logs_json').in('id', classIds);
    var studentLogsPromise = db.from('student_operation_logs').select('class_id, logs_json').in('class_id', classIds);

    return Promise.all([teacherLogsPromise, studentLogsPromise]);
  }).then(function(results) {
    if (!results) return;
    var teacherR = results[0];
    var studentR = results[1];

    // Parse teacher logs from classes.operation_logs_json
    var allLogs = [];
    if (teacherR && !teacherR.error) {
      (teacherR.data || []).forEach(function(cls) {
        if (!cls.operation_logs_json) return;
        try {
          var logs = JSON.parse(cls.operation_logs_json);
          if (Array.isArray(logs)) {
            logs = _filterLogsByRetention(logs);
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
    } else if (teacherR && teacherR.error) {
      console.error('[DAL] v85 Teacher logs query FAILED:', teacherR.error.message);
    }

    // v85: Parse student logs from student_operation_logs
    var studentLogsCount = 0;
    if (studentR && !studentR.error) {
      (studentR.data || []).forEach(function(row) {
        if (!row.logs_json) return;
        try {
          var logs = typeof row.logs_json === 'string' ? JSON.parse(row.logs_json) : row.logs_json;
          if (Array.isArray(logs)) {
            logs = _filterLogsByRetention(logs);
            logs.forEach(function(l) {
              l._synced = true;
              l._fromSupabase = true;
              l._writtenByStudent = true;
              if (!l.classId) l.classId = row.class_id;
              allLogs.push(l);
            });
            studentLogsCount += logs.length;
          }
        } catch(e) {
          console.warn('[DAL] v85 Failed to parse student_operation_logs for class', row.class_id, e);
        }
      });
    } else if (studentR && studentR.error) {
      // Table might not exist yet — log warning but don't fail
      console.warn('[DAL] v85 student_operation_logs query failed (table may not exist yet):', studentR.error.message);
    }

    // Deduplicate: if same log ID exists in both teacher and student sources, keep one
    var seenIds = {};
    var dedupedLogs = [];
    allLogs.forEach(function(l) {
      if (!seenIds[l.id]) {
        seenIds[l.id] = true;
        dedupedLogs.push(l);
      }
    });
    allLogs = dedupedLogs;

    // v78: PRESERVE local logs that aren't on server (prevents data loss from concurrent writes)
    var serverLogIds = {};
    allLogs.forEach(function(l) { serverLogIds[l.id] = true; });
    
    var localOnly = window.operationLogs.filter(function(l) {
      return !serverLogIds[l.id];
    });
    
    // v78: Re-mark local-only logs as unsynced so they get re-written to server
    localOnly.forEach(function(l) {
      if (l._synced) {
        console.log('[DAL] v78 Re-marking lost log as unsynced:', l.id, l.actionType);
        l._synced = false;
      }
    });
    
    // Merge: server logs + local-only logs
    window.operationLogs = allLogs.concat(localOnly);
    window.operationLogs.sort(function(a, b) {
      return (b.timestamp || '').localeCompare(a.timestamp || '');
    });

    // Backup to localStorage
    try { localStorage.setItem('operationLogs', JSON.stringify(window.operationLogs)); } catch(e) {}
    console.log('[DAL] v85 Loaded ' + (allLogs.length - studentLogsCount) + ' teacher logs + ' + studentLogsCount + ' student logs from Supabase, preserved ' + localOnly.length + ' local-only logs');
    
    // v78: If we have local-only logs that were lost from server, re-sync them
    if (localOnly.length > 0) {
      setTimeout(function() {
        console.log('[DAL] v78 Re-syncing ' + localOnly.length + ' lost logs to server...');
        _writeUnsyncedLogsToSupabase();
      }, 2000);
    }
  }).catch(function(e) {
    console.warn('[DAL] v85 _loadOperationLogs error:', e);
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
    // v80: Risk 2 fix — if verification gives up, mark logs as unsynced so they retry later
    if (writtenLogIds && writtenLogIds.length > 0) {
      console.warn('[DAL] v80 Verify gave up after ' + retryCount + ' retries for class', classId + ', marking logs unsynced for recovery');
      writtenLogIds.forEach(function(logId) {
        for (var i = 0; i < window.operationLogs.length; i++) {
          if (window.operationLogs[i].id === logId) {
            window.operationLogs[i]._synced = false;
            break;
          }
        }
      });
    }
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
      // v80: Mark missing logs as unsynced so they can be retried on next load
      console.warn('[DAL] v80 No missing logs found locally for class', classId + ', marking as unsynced for recovery');
      missingIds.forEach(function(missingId) {
        for (var i = 0; i < window.operationLogs.length; i++) {
          if (window.operationLogs[i].id === missingId) {
            window.operationLogs[i]._synced = false;
            break;
          }
        }
      });
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

// v29: Write unsynced logs to Supabase.
// v85: SPLIT write path — teacher logs → classes.operation_logs_json (UPDATE),
//      student logs → student_operation_logs (UPSERT).
//      Students cannot UPDATE the classes table due to RLS, which caused all
//      student operation logs to silently fail and never persist to the server.
//      The new student_operation_logs table has permissive RLS so students can write.
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

  console.log('[DAL] v85 Writing ' + unsynced.length + ' unsynced logs');

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

  // v85: Split unsynced logs into teacher-written and student-written.
  // If current user is student, ALL their unsynced logs go to student_operation_logs.
  // If current user is teacher, ALL their unsynced logs go to classes.operation_logs_json.
  // This avoids needing a _writtenByStudent flag on each log.
  var teacherUnsynced = [];
  var studentUnsynced = [];
  if (currentUser.type === 'student') {
    studentUnsynced = unsynced;
  } else {
    teacherUnsynced = unsynced;
  }

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

  // Helper: build merged log object for DB storage
  function _buildMergedLog(l, cid) {
    return {
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
  }

  // Helper: mark logs as synced after successful write
  function _markLogsSynced(cid, logsArr) {
    (logsArr || []).forEach(function(entry) {
      if (entry.index >= 0 && entry.index < window.operationLogs.length) {
        window.operationLogs[entry.index]._synced = true;
        window.operationLogs[entry.index]._fromSupabase = true;
      }
    });
  }

  // Helper: mark logs as unsynced after failed write
  function _markLogsUnsynced(cid, logsArr) {
    (logsArr || []).forEach(function(entry) {
      if (entry.index >= 0 && entry.index < window.operationLogs.length) {
        window.operationLogs[entry.index]._synced = false;
      }
    });
  }

  // === TEACHER PATH: Write to classes.operation_logs_json (existing logic) ===
  function _writeTeacherLogs() {
    if (teacherUnsynced.length === 0) return Promise.resolve();

    var teacherLogsByClass = {};
    teacherUnsynced.forEach(function(entry) {
      var cid = entry.log.classId || defaultClassId;
      if (typeof cid === 'string') cid = parseInt(cid);
      if (!teacherLogsByClass[cid]) teacherLogsByClass[cid] = [];
      teacherLogsByClass[cid].push(entry);
    });
    var teacherClassIds = Object.keys(teacherLogsByClass).map(Number);

    console.log('[DAL] v85 Writing ' + teacherUnsynced.length + ' teacher logs to classes table');

    return db.from('classes').select('id, operation_logs_json').in('id', teacherClassIds).then(function(r) {
      if (r.error) {
        console.error('[DAL] v85 Failed to read existing teacher logs:', r.error.message);
        _markLogsUnsynced(null, teacherUnsynced);
        return;
      }
      var existingByClass = {};
      (r.data || []).forEach(function(cls) {
        try {
          existingByClass[cls.id] = cls.operation_logs_json ? JSON.parse(cls.operation_logs_json) : [];
        } catch(e) { existingByClass[cls.id] = []; }
      });

      var validClassIds = teacherClassIds.filter(function(cid) { return existingByClass[cid] !== undefined; });
      if (validClassIds.length === 0) return;

      // Re-read right before write to prevent race conditions
      return db.from('classes').select('id, operation_logs_json').in('id', validClassIds).then(function(freshR) {
        if (freshR.error) freshR = { data: [] };
        var freshByClass = {};
        (freshR.data || []).forEach(function(cls) {
          try {
            freshByClass[cls.id] = cls.operation_logs_json ? JSON.parse(cls.operation_logs_json) : [];
          } catch(e) { freshByClass[cls.id] = []; }
        });

        var promises = validClassIds.map(function(cid) {
          var existing = freshByClass[cid] || [];
          var newLogs = teacherLogsByClass[cid] || [];
          var existingById = {};
          existing.forEach(function(l, idx) { existingById[l.id] = idx; });

          newLogs.forEach(function(entry) {
            var merged = _buildMergedLog(entry.log, cid);
            if (existingById[merged.id] !== undefined) {
              existing[existingById[merged.id]] = merged;
            } else {
              existing.push(merged);
              existingById[merged.id] = existing.length - 1;
            }
          });

          existing.sort(function(a, b) { return (b.timestamp || '').localeCompare(a.timestamp || ''); });
          if (existing.length > _OP_LOGS_MAX_PER_CLASS) existing = existing.slice(0, _OP_LOGS_MAX_PER_CLASS);

          var writtenLogIds = newLogs.map(function(entry) { return entry.log.id; });
          return db.from('classes').update({
            operation_logs_json: JSON.stringify(existing)
          }).eq('id', cid).then(function(ur) {
            if (ur.error) {
              console.error('[DAL] v85 Teacher log write FAILED for class', cid + ':', ur.error.message);
              _markLogsUnsynced(cid, newLogs);
            } else {
              console.log('[DAL] v85 Teacher logs written for class', cid, '(' + existing.length + ' total)');
              _markLogsSynced(cid, newLogs);
              _lastOwnWriteTime = Date.now();
              return _verifyLogWrite(cid, writtenLogIds, 0);
            }
          });
        });
        return Promise.all(promises);
      });
    });
  }

  // === STUDENT PATH (v85): Write to student_operation_logs table ===
  // Students cannot UPDATE the classes table (RLS blocks it).
  // Instead, we write to a separate student_operation_logs table that students have permission to write.
  function _writeStudentLogs() {
    if (studentUnsynced.length === 0) return Promise.resolve();

    var studentLogsByClass = {};
    studentUnsynced.forEach(function(entry) {
      var cid = entry.log.classId || defaultClassId;
      if (typeof cid === 'string') cid = parseInt(cid);
      if (!studentLogsByClass[cid]) studentLogsByClass[cid] = [];
      studentLogsByClass[cid].push(entry);
    });
    var studentClassIds = Object.keys(studentLogsByClass).map(Number);

    console.log('[DAL] v85 Writing ' + studentUnsynced.length + ' student logs to student_operation_logs table');

    // Read existing student logs from student_operation_logs
    return db.from('student_operation_logs').select('class_id, logs_json').in('class_id', studentClassIds).then(function(r) {
      if (r.error) {
        console.error('[DAL] v85 Failed to read student_operation_logs:', r.error.message);
        console.warn('[DAL] v85 Table may not exist yet. Please run the SQL setup in Supabase.');
        _markLogsUnsynced(null, studentUnsynced);
        return;
      }
      var existingByClass = {};
      (r.data || []).forEach(function(row) {
        try {
          existingByClass[row.class_id] = row.logs_json ? (typeof row.logs_json === 'string' ? JSON.parse(row.logs_json) : row.logs_json) : [];
        } catch(e) { existingByClass[row.class_id] = []; }
      });

      var promises = studentClassIds.map(function(cid) {
        var existing = existingByClass[cid] || [];
        var newLogs = studentLogsByClass[cid] || [];
        var existingById = {};
        existing.forEach(function(l, idx) { existingById[l.id] = idx; });

        newLogs.forEach(function(entry) {
          var merged = _buildMergedLog(entry.log, cid);
          merged._writtenByStudent = true;
          if (existingById[merged.id] !== undefined) {
            existing[existingById[merged.id]] = merged;
          } else {
            existing.push(merged);
            existingById[merged.id] = existing.length - 1;
          }
        });

        existing.sort(function(a, b) { return (b.timestamp || '').localeCompare(a.timestamp || ''); });
        if (existing.length > _OP_LOGS_MAX_PER_CLASS) existing = existing.slice(0, _OP_LOGS_MAX_PER_CLASS);

        // Upsert into student_operation_logs
        return db.from('student_operation_logs').upsert([{
          class_id: cid,
          logs_json: JSON.stringify(existing)
        }]).then(function(ur) {
          if (ur.error) {
            console.error('[DAL] v85 Student log write FAILED for class', cid + ':', ur.error.message);
            _markLogsUnsynced(cid, newLogs);
          } else {
            console.log('[DAL] v85 Student logs written for class', cid, '(' + existing.length + ' total)');
            _markLogsSynced(cid, newLogs);
            _lastOwnWriteTime = Date.now();
          }
        });
      });
      return Promise.all(promises);
    });
  }

  // Execute both write paths
  var allClassIds = classIds;
  // Step 1: Verify classes exist (for teacher path)
  return db.from('classes').select('id').in('id', allClassIds).then(function(r) {
    if (r.error) {
      console.error('[DAL] v85 Failed to verify classes:', r.error.message);
      _writingLogsToSupabase = false;
      setTimeout(function() { _writeUnsyncedLogsToSupabase(); }, 5000);
      return;
    }
    // Run both write paths in parallel
    return Promise.all([
      _writeTeacherLogs(),
      _writeStudentLogs()
    ]);
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

        if (stu.id && stu.id > 0 && stu.id === Math.floor(stu.id)) {
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
        // v91: Fetch fresh student coins from server BEFORE building update payload.
        // This enables delta-based coin sync for teachers, preventing the race condition
        // where the teacher's stale local coins overwrite student spending on the server.
        // The same delta approach used by _syncStudentToSupabase is now applied here.
        var studentIds = studentsToUpsert.map(function(s) { return s.id; });
        var freshCoinFetch = studentIds.length > 0
          ? db.from('students').select('id, coins').in('id', studentIds)
          : Promise.resolve({ data: [], error: null });
        return freshCoinFetch.then(function(freshR) {
          var freshCoinMap = {};
          if (freshR && freshR.data) {
            freshR.data.forEach(function(s) { freshCoinMap[s.id] = s.coins || 0; });
          }
          // v43: No need to fetch shop_items from DB — using .update() instead of .upsert()
          // means student-owned fields (shop_items, equipped_items) are never touched.
          var studentUpsertPromises = studentsToUpsert.map(function(stu) {
            // v93: Skip coin write when teacher hasn't changed coins locally.
            // This prevents the race condition where teacher's periodic sync
            // overwrites student spending on the server.
            var freshCoins = freshCoinMap[stu.id];
            var finalCoins;
            var teacherChangedCoins = false;
            if (freshCoins !== undefined && _teacherBaseCoins[stu.id] !== undefined) {
              var teacherCoinDelta = (stu.coins || 0) - _teacherBaseCoins[stu.id];
              if (teacherCoinDelta !== 0) {
                // Teacher actually changed coins (gave reward or penalty) — apply delta
                finalCoins = freshCoins + teacherCoinDelta;
                if (finalCoins < 0) finalCoins = 0;
                teacherChangedCoins = true;
              } else {
                // Teacher didn't change coins — skip coin write to avoid race condition
                finalCoins = undefined; // Signal to skip coin write
                teacherChangedCoins = false;
              }
            } else {
              // First sync or no baseline — use local value directly
              finalCoins = stu.coins || 0;
              teacherChangedCoins = true;
            }
            var payload = {
              id: stu.id,
              name: stu.name,
              class_id: (classesData.find(function(c) { return c.students.indexOf(stu) >= 0; }) || {}).id || null,
              last_checkin_date: stu.lastCheckinDate || null,
              last_jianghu_date: stu.lastJianghuDate || null,
              last_pk_date: stu.lastPkDate || null,
              active_pet_id: stu.activePetId || null,
              pk_count_today: stu.pkCountToday || 0,
              // v43: REMOVED shop_items and equipped_items — teacher NEVER writes these.
              // Using .update() (not .upsert()) so only specified fields are modified.
              // This eliminates ALL race conditions with student shop purchases.
              password: stu.password || ''
            };
            // v93: Only include coins in payload when teacher actually changed them
            if (teacherChangedCoins && finalCoins !== undefined) {
              payload.coins = finalCoins;
            }
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
                    // Ultimate fallback: save coins only (use delta-based value)
                    return db.from('students').update({ coins: finalCoins }).eq('id', stu.id).then(function(fr) {
                      if (fr.error) console.error('[DAL] teacher coins fallback error:', fr.error.message);
                    });
                  }
                  console.log('[DAL] Student "' + stu.name + '" inserted via fallback (ID: ' + stu.id + ')');
                });
              }
            }).then(function() {
              // v30: Save quiz_state separately after update
              // v75: Skip if quiz_state was recently saved directly (prevent race condition)
              if (stu.quizState && !window._quizStateLocallyModified) {
                var qs = typeof stu.quizState === 'string' ? stu.quizState : JSON.stringify(stu.quizState);
                return db.from('students').update({ quiz_state: qs }).eq('id', stu.id).then(function(qr) {
                  if (qr.error) console.warn('[DAL] teacher quiz_state save failed:', qr.error.message);
                });
              }
            });
          });
          return Promise.all(studentUpsertPromises).then(function() {
            // v93: After successful teacher sync, update _teacherBaseCoins for all synced students.
            // When teacher didn't change coins, use the fresh server value (not local),
            // so next sync correctly detects teacher changes and doesn't overwrite student spending.
            studentsToUpsert.forEach(function(stu) {
              var freshCoins = freshCoinMap[stu.id];
              if (freshCoins !== undefined && _teacherBaseCoins[stu.id] !== undefined) {
                var teacherCoinDelta = (stu.coins || 0) - _teacherBaseCoins[stu.id];
                if (teacherCoinDelta !== 0) {
                  // Teacher changed coins — use delta-based value
                  var finalCoins = freshCoins + teacherCoinDelta;
                  if (finalCoins < 0) finalCoins = 0;
                  _teacherBaseCoins[stu.id] = finalCoins;
                } else {
                  // Teacher didn't change coins — use fresh server value
                  // This ensures next sync detects teacher changes correctly
                  _teacherBaseCoins[stu.id] = freshCoins;
                }
              } else {
                _teacherBaseCoins[stu.id] = stu.coins || 0;
              }
            });
          });
        });
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
    // Build set of local student IDs (only positive/Supabase IDs)
    var localStudentIds = {};
    classesData.forEach(function(cls) {
      cls.students.forEach(function(stu) {
        if (stu.id && stu.id > 0 && stu.id === Math.floor(stu.id)) {
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
          // First delete their pets
          return db.from('pets').delete().in('student_id', toDelete).then(function(pr) {
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
            // Delete pets first
            chain = chain.then(function() {
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
  // v90: Track per-pet sync success — only update _myBasePets for confirmed pets.
  // Previously, _myBasePets was updated unconditionally after Promise.all resolved,
  // even if pet updates failed (promises always resolve due to internal error handling).
  // This caused growth to appear saved locally but not on server, leading to data loss on refresh.
  var petPromises = [];
  _petSyncResults = {}; // v91: Reset module-level var (declared at top of file)
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
        // v87: Existing pet — use .update() instead of .upsert() to avoid RLS/NOT NULL issues.
        // Added 3-tier retry: full payload → minimal payload → XHR fallback.
        // Added user-visible notification on total failure.
        // v90: Returns {petId, success} for tracking.
        var petId = pet.id;
        var petName = pet.name;
        var petGrowth = pet.growth || 0;
        console.log('[DAL] v87 Updating pet ' + petId + ' (' + petName + ', growth=' + petGrowth + ')');
        petPromises.push(
          db.from('pets').update(payload).eq('id', petId).then(function(r) {
            if (r.error) {
              console.error('[DAL] v87 pet update error:', r.error.message);
              // Retry 1: minimal payload (just growth + level)
              console.warn('[DAL] v87 Retrying pet ' + petId + ' with minimal payload...');
              return db.from('pets').update({
                growth: petGrowth,
                level: pet.level || 1,
                is_dead: !!pet.isDead
              }).eq('id', petId).then(function(retryR) {
                if (retryR.error) {
                  console.error('[DAL] v87 minimal retry FAILED:', retryR.error.message);
                  // Retry 2: XHR synchronous fallback (bypasses JS client RLS issues)
                  console.warn('[DAL] v87 Trying XHR fallback for pet ' + petId);
                  try {
                    var token = '';
                    try { token = JSON.parse(localStorage.getItem('sb-xbygooadskfqllnhwmet-auth-token') || '{}').access_token || ''; } catch(e) {}
                    if (token) {
                      var xhr = new XMLHttpRequest();
                      var baseUrl = 'https://xbygooadskfqllnhwmet.supabase.co/rest/v1';
                      xhr.open('PATCH', baseUrl + '/pets?id=eq.' + petId, false);
                      xhr.setRequestHeader('Authorization', 'Bearer ' + token);
                      xhr.setRequestHeader('apikey', token);
                      xhr.setRequestHeader('Content-Type', 'application/json');
                      xhr.setRequestHeader('Prefer', 'return=minimal');
                      xhr.send(JSON.stringify({ growth: petGrowth, level: pet.level || 1 }));
                      if (xhr.status >= 200 && xhr.status < 300) {
                        console.log('[DAL] v87 XHR fallback succeeded for pet ' + petId);
                        _petSyncResults[petId] = true;
                        return { petId: petId, success: true };
                      } else {
                        console.error('[DAL] v87 XHR fallback FAILED: HTTP ' + xhr.status);
                        _petSyncResults[petId] = false;
                        _showPetSyncError(petName);
                        return { petId: petId, success: false };
                      }
                    } else {
                      _petSyncResults[petId] = false;
                      _showPetSyncError(petName);
                      return { petId: petId, success: false };
                    }
                  } catch(xhrErr) {
                    console.error('[DAL] v87 XHR fallback exception:', xhrErr.message);
                    _petSyncResults[petId] = false;
                    _showPetSyncError(petName);
                    return { petId: petId, success: false };
                  }
                } else {
                  console.log('[DAL] v87 pet ' + petId + ' minimal retry succeeded (growth=' + petGrowth + ')');
                  _petSyncResults[petId] = true;
                  return { petId: petId, success: true };
                }
              });
            } else {
              console.log('[DAL] v87 pet ' + petId + ' updated OK (growth=' + petGrowth + ')');
              _petSyncResults[petId] = true;
              return { petId: petId, success: true };
            }
          })
        );
      } else {
        // New pet (local negative ID or no ID) — INSERT without id
        // v88: Added retry and better error handling.
        // If insert fails, the pet keeps its negative ID. The student update's
        // active_pet_id is sanitized to null (Fix 1), preventing cascading failure.
        // The pet will be retried on the next sync cycle.
        // v90: Returns {petId, success} for tracking.
        console.log('[DAL] Inserting new pet (' + pet.name + '), local id=' + pet.id);
        var oldLocalId = pet.id;
        var petNameForError = pet.name;
        petPromises.push(
          db.from('pets').insert([payload]).select().then(function(r) {
            if (r.error) {
              console.error('[DAL] v88 pet insert error:', r.error.message || r.error);
              // Retry once with minimal payload (no optional fields)
              console.warn('[DAL] v88 Retrying pet insert with minimal payload...');
              return db.from('pets').insert([{
                student_id: studentId,
                name: pet.name,
                level: 1,
                growth: 0
              }]).select().then(function(retryR) {
                if (retryR.error) {
                  console.error('[DAL] v88 pet insert retry FAILED:', retryR.error.message);
                  _showPetSyncError(petNameForError);
                  return { petId: oldLocalId, success: false };
                }
                if (retryR.data && retryR.data[0]) {
                  pet.id = retryR.data[0].id;
                  if (myStudent.activePetId === oldLocalId) {
                    myStudent.activePetId = pet.id;
                  }
                  console.log('[DAL] v88 New pet "' + pet.name + '" got Supabase ID on retry: ' + pet.id);
                  _petSyncResults[pet.id] = true;
                  return { petId: pet.id, success: true };
                }
                _petSyncResults[oldLocalId] = false;
                return { petId: oldLocalId, success: false };
              });
            }
            if (r.data && r.data[0]) {
              pet.id = r.data[0].id;
              // Update activePetId if it pointed to the old local ID
              if (myStudent.activePetId === oldLocalId) {
                myStudent.activePetId = pet.id;
              }
              console.log('[DAL] New pet "' + pet.name + '" got Supabase ID: ' + pet.id);
              _petSyncResults[pet.id] = true;
              return { petId: pet.id, success: true };
            } else {
              // v88: Insert succeeded but no data returned — try to find the pet
              console.warn('[DAL] v88 Pet insert returned no data, searching for pet...');
              return db.from('pets').select('id').eq('student_id', studentId)
                .order('id', { ascending: false }).limit(1).then(function(findR) {
                  if (findR.data && findR.data[0] && findR.data[0].id > 0) {
                    pet.id = findR.data[0].id;
                    if (myStudent.activePetId === oldLocalId) {
                      myStudent.activePetId = pet.id;
                    }
                    console.log('[DAL] v88 Found new pet ID via lookup: ' + pet.id);
                    _petSyncResults[pet.id] = true;
                    return { petId: pet.id, success: true };
                  }
                  _petSyncResults[oldLocalId] = false;
                  return { petId: oldLocalId, success: false };
                });
            }
          })
        );
      }
    });
  }

  // Step 2: Fetch fresh student data to avoid overwriting teacher changes (e.g., coins)
  return Promise.all(petPromises).then(function() {
    // v90: CRITICAL FIX — Only update _myBasePets for pets that were CONFIRMED synced.
    // Previously (v86), _myBasePets was updated unconditionally after Promise.all resolved,
    // even if pet updates failed. This caused the system to believe growth was saved when it wasn't.
    // On refresh, the server would have old growth values, and smart refresh would overwrite
    // local changes with stale server data, causing "操作回溯" (data reversion).
    // Now we only update _myBasePets for pets with _petSyncResults[petId] === true.
    var petSyncFailed = false;
    (myStudent.pets || []).forEach(function(p) {
      if (p.id && p.id > 0) {
        if (_petSyncResults[p.id] === true) {
          // Pet sync confirmed — update baseline
          _myBasePets[p.id] = p.growth || 0;
        } else if (_petSyncResults[p.id] === false) {
          // Pet sync explicitly failed — don't update baseline
          petSyncFailed = true;
          console.warn('[DAL] v90 Pet ' + p.id + ' sync FAILED — growth ' + (p.growth||0) + ' NOT saved to _myBasePets');
        } else {
          // Pet not in results (e.g., new pet with negative ID) — don't update baseline
          console.log('[DAL] v90 Pet ' + p.id + ' not in sync results — skipping _myBasePets update');
        }
      }
    });
    if (petSyncFailed) {
      console.warn('[DAL] v90 Some pet syncs failed — will retry on next sync cycle');
    }
    _lastOwnWriteTime = Date.now(); // v86: Protect pet writes from Realtime echo
    // v88: Added active_pet_id to select — needed to preserve server value when local activePetId is invalid
    return db.from('students').select('coins, last_checkin_date, last_jianghu_date, last_pk_date, active_pet_id, pk_count_today, quiz_state').eq('id', studentId).single();
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
    // v88: Ensure active_pet_id is a valid positive integer.
    // If the active pet still has a negative local ID (insert failed or hasn't completed),
    // setting active_pet_id to a negative value causes PostgreSQL to reject the ENTIRE
    // student UPDATE (INT4 constraint violation), cascading into coins-only fallback
    // which loses shopItems, equippedItems, and all other fields.
    // Instead of setting to null (which would deactivate the pet), preserve the server's
    // current value so the active_pet_id is restored on the next sync after pet insert succeeds.
    var safeActivePetId = myStudent.activePetId;
    if (safeActivePetId && (safeActivePetId <= 0 || safeActivePetId !== Math.floor(safeActivePetId))) {
      console.warn('[DAL] v88 active_pet_id is invalid (' + safeActivePetId + '), preserving server value');
      // Use the server's current value to avoid overwriting with null/negative
      safeActivePetId = (freshR && freshR.data && freshR.data.active_pet_id) || null;
    }
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
      active_pet_id: safeActivePetId || null,
      pk_count_today: finalPkCountToday
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
          // v90: Only update _myBasePets for confirmed pet syncs
          (myStudent.pets || []).forEach(function(p) {
            if (p.id && p.id > 0 && _petSyncResults[p.id] === true) _myBasePets[p.id] = p.growth || 0;
          });
          return true;
        });
      } else {
        _studentUpsertOk = true;
        _myBaseCoins = finalCoins;
        _lastOwnWriteTime = Date.now();
        // v90: Only update _myBasePets for confirmed pet syncs
        (myStudent.pets || []).forEach(function(p) {
          if (p.id && p.id > 0 && _petSyncResults[p.id] === true) _myBasePets[p.id] = p.growth || 0;
        });
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
      
      // v88: CRITICAL FIX — the shop_items separate save must NOT overwrite the `ok`
      // return value. Previously, the shop_items .then() returned the Supabase response
      // object instead of `ok`, causing _lastStudentSyncOk to be {data:...} instead of true.
      // This broke _myBaseCoins update (=== true check failed), causing delta calculation
      // errors on subsequent syncs, leading to coins reverting (操作回溯).
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
        // v75: Skip quiz_state save if it was recently saved directly by saveCoinsAndQuizState().
        // Without this check, the sync flow could overwrite fresh quiz_state with stale local data.
        // Race condition: saveCoinsAndQuizState() writes new state → sync fetches stale data →
        // sync overwrites new state with stale data → quiz progress lost (操作回溯).
        if (ok && myStudent.quizState && !window._quizStateLocallyModified) {
          var quizStateJson = typeof myStudent.quizState === 'string'
            ? myStudent.quizState
            : JSON.stringify(myStudent.quizState);
          return db.from('students').update({
            quiz_state: quizStateJson
          }).eq('id', studentId).then(function(qr) {
            if (qr.error) {
              console.warn('[DAL] quiz_state separate save failed:', qr.error.message);
            }
            return ok; // v88: Always return the original student update success flag
          });
        } else if (ok && window._quizStateLocallyModified) {
          console.log('[DAL] v75 Skipping quiz_state save — recently saved directly by quiz system');
        }
        return ok; // v88: Always return the original student update success flag
      }).then(function() {
        // v88: Ensure we ALWAYS return the student update success flag,
        // regardless of what the shop_items/quiz_state saves returned.
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
    // v89: Reset retry counter on success — previously it was never reset,
    // so after 3 cumulative failures the app would permanently stop syncing.
    _syncRetryCount = 0;
    _lastSyncFailed = false;
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
          _myBaseCoins = myStu.coins;
          // v90: Only track pets with valid DB IDs AND confirmed sync success in _myBasePets.
          // Previously (v88), all pets with valid IDs were tracked, even if their sync failed.
          // This caused growth to appear saved locally but not on server, leading to data loss.
          (myStu.pets || []).forEach(function(p) {
            if (p.id && p.id > 0 && _petSyncResults[p.id] === true) _myBasePets[p.id] = p.growth || 0;
          });
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

// Immediate refresh — called by Realtime events (no debounce, instant push)
var _immediateRefreshRetryCount = 0;
var _IMMEDIATE_REFRESH_MAX_RETRIES = 10;
function _immediateRefreshFromSupabase() {
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
  
  // Skip own writes (ignore our own changes for 30s)
  if (Date.now() - _lastOwnWriteTime < _OWN_WRITE_IGNORE_MS) {
    console.log('[DAL] Immediate refresh skipped — own write echo (' + 
      Math.round((_OWN_WRITE_IGNORE_MS - (Date.now() - _lastOwnWriteTime)) / 1000) + 's remaining)');
    return;
  }
  
  console.log('[DAL] ⚡ Realtime event → immediate refresh');
  _lastRefreshTime = Date.now();
  _doSmartRefresh();
}

function _doSmartRefresh() {
  console.log('[DAL] Starting smart refresh...');
  _smartRefreshFromSupabase().then(function() {
    // Also reload operation logs from Supabase to keep history up to date
    return _loadOperationLogs();
  }).then(function() {
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
  }).catch(function(e) {
    console.error('[DAL] Smart refresh error:', e);
  });
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
    return;
  }

  var channelsCreated = 0;
  var channelsConfirmed = 0;
  var totalChannels = 4; // v85: Added student_operation_logs channel
  var realtimeTimeout = null;

  function _onChannelConfirmed() {
    channelsConfirmed++;
    if (channelsConfirmed >= 1 && !_realtimeActive) {
      // At least one channel confirmed — Realtime is working
      _realtimeActive = true;
      console.log('[DAL] ⚡ Realtime confirmed active (' + channelsConfirmed + '/' + totalChannels + ' channels) — polling disabled');
      // Stop any fallback polling that may have started
      _stopFallbackPolling();
    }
  }

  try {
    // Subscribe to classes table — coalesced refresh on change
    // Note: operation_logs are stored in classes.operation_logs_json (v29),
    // so classes table changes include both class data and log updates
    var classChannel = db.channel('dal-classes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'classes' }, function(payload) {
        // 检查是否只有 operation_logs_json 变化（通过比较列）
        // 如果只有日志变化，使用轻量级刷新（不重建UI）
        if (payload.columns && payload.columns.length === 1 && payload.columns[0].name === 'operation_logs_json') {
          console.log('[DAL] Classes channel: logs-only change, using lightweight refresh');
          _refreshLogsOnly();
        } else {
          // 其他 classes 变化（班级名称等），触发完整刷新
          _debouncedRealtimeRefresh('classes');
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

    // Subscribe to students table — coalesced refresh on change
    var studentChannel = db.channel('dal-students')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'students' }, function() {
        _debouncedRealtimeRefresh('students');
      })
      .subscribe(function(status) {
        if (status === 'SUBSCRIBED') _onChannelConfirmed();
      });
    _realtimeChannels.push(studentChannel);
    channelsCreated++;

    // Subscribe to pets table — coalesced refresh on change
    var petChannel = db.channel('dal-pets')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pets' }, function(payload) {
        _debouncedRealtimeRefresh('pets:' + payload.eventType);
      })
      .subscribe(function(status) {
        if (status === 'SUBSCRIBED') _onChannelConfirmed();
      });
    _realtimeChannels.push(petChannel);
    channelsCreated++;

    // v85: Subscribe to student_operation_logs — lightweight log refresh when students write
    var studentLogsChannel = db.channel('dal-student-logs')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'student_operation_logs' }, function() {
        console.log('[DAL] v85 student_operation_logs changed, refreshing logs');
        _refreshLogsOnly();
      })
      .subscribe(function(status) {
        if (status === 'SUBSCRIBED') _onChannelConfirmed();
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          // Non-critical — don't affect Realtime health
          console.warn('[DAL] v85 student_operation_logs channel status:', status);
        }
      });
    _realtimeChannels.push(studentLogsChannel);
    channelsCreated++;

    console.log('[DAL] ⚡ Realtime subscriptions created (' + channelsCreated + ' channels) — waiting for confirmation...');

    // v54: If no channel confirms within 10s, start fallback polling
    realtimeTimeout = setTimeout(function() {
      if (!_realtimeActive) {
        console.warn('[DAL] Realtime not confirmed after 10s — starting fallback polling');
        _startFallbackPolling();
      }
    }, 10000);
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
}

/* ===== Lifecycle ===== */
function _setupPageLifecycle() {
  // v54: Robust beforeunload — actually save data synchronously instead of just pinging
  window.addEventListener('beforeunload', function() {
    // v75: Also check _quizStateLocallyModified — quiz answers may set this flag
    // even if _pendingLocalSave wasn't set (race condition protection)
    var hasUnsavedChanges = _pendingLocalSave || window._quizStateLocallyModified;
    if (hasUnsavedChanges && currentUser) {
      try {
        var token = '';
        try { token = JSON.parse(localStorage.getItem('sb-xbygooadskfqllnhwmet-auth-token') || '{}').access_token || ''; } catch(e) {}
        if (!token) return;

        var baseUrl = 'https://xbygooadskfqllnhwmet.supabase.co/rest/v1';

        if (currentUser.type === 'student') {
          // Student: synchronously save critical data (coins, pet growth, etc.)
          var studentId = parseInt(localStorage.getItem('studentId'));
          if (!studentId || !classesData || !classesData[0]) return;
          
          var myStudent = null;
          for (var i = 0; i < classesData[0].students.length; i++) {
            if (classesData[0].students[i].id === studentId) {
              myStudent = classesData[0].students[i];
              break;
            }
          }
          if (!myStudent) return;

          // Build the critical data payload
          // v75: Include quiz_state to prevent quiz progress loss on page close.
          // Previously, quiz_state was NOT in the synchronous beforeunload save,
          // so if the mobile browser killed the async save from saveCoinsAndQuizState(),
          // the quiz progress (questions answered, coins earned) was lost — causing
          // the "操作回溯" (operation rollback) where students could re-answer questions.
          // v88: Sanitize active_pet_id — never write negative IDs to DB
          var safeActivePetIdBeforeUnload = myStudent.activePetId;
          if (safeActivePetIdBeforeUnload && (safeActivePetIdBeforeUnload <= 0 || safeActivePetIdBeforeUnload !== Math.floor(safeActivePetIdBeforeUnload))) {
            safeActivePetIdBeforeUnload = null;
          }
          var payload = {
            coins: myStudent.coins || 0,
            last_checkin_date: myStudent.lastCheckinDate || null,
            last_jianghu_date: myStudent.lastJianghuDate || null,
            last_pk_date: myStudent.lastPkDate || null,
            active_pet_id: safeActivePetIdBeforeUnload || null,
            pk_count_today: myStudent.pkCountToday || 0,
            shop_items: JSON.stringify(myStudent.shopItems || []),
            equipped_items: JSON.stringify(myStudent.equippedItems || {}),
            quiz_state: myStudent.quizState ? JSON.stringify(myStudent.quizState) : null
          };

          // Synchronous PATCH to save student data
          var xhr = new XMLHttpRequest();
          xhr.open('PATCH', baseUrl + '/students?id=eq.' + studentId, false);
          xhr.setRequestHeader('Authorization', 'Bearer ' + token);
          xhr.setRequestHeader('apikey', token);
          xhr.setRequestHeader('Content-Type', 'application/json');
          xhr.setRequestHeader('Prefer', 'return=minimal');
          xhr.send(JSON.stringify(payload));
          console.log('[DAL] v54 beforeunload: student data saved synchronously (coins=' + payload.coins + ')');

          // Also save pets synchronously
          if (myStudent.pets && myStudent.pets.length > 0) {
            myStudent.pets.forEach(function(pet) {
              if (!pet.id || pet.id <= 0) {
                // v88: For new pets without real DB IDs, do a synchronous INSERT
                if (pet.id && pet.id < 0) {
                  try {
                    var newPetPayload = {
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
                    var petXhr = new XMLHttpRequest();
                    // Use Prefer=return=representation to get the inserted ID back
                    petXhr.open('POST', baseUrl + '/pets', false);
                    petXhr.setRequestHeader('Authorization', 'Bearer ' + token);
                    petXhr.setRequestHeader('apikey', token);
                    petXhr.setRequestHeader('Content-Type', 'application/json');
                    petXhr.setRequestHeader('Prefer', 'return=representation');
                    petXhr.send(JSON.stringify(newPetPayload));
                    if (petXhr.status >= 200 && petXhr.status < 300) {
                      try {
                        var inserted = JSON.parse(petXhr.responseText);
                        if (inserted && inserted[0] && inserted[0].id) {
                          pet.id = inserted[0].id;
                          // Update active_pet_id if this pet is the active one
                          if (myStudent.activePetId < 0) {
                            // Re-save student with the correct active_pet_id
                            var fixXhr = new XMLHttpRequest();
                            fixXhr.open('PATCH', baseUrl + '/students?id=eq.' + studentId, false);
                            fixXhr.setRequestHeader('Authorization', 'Bearer ' + token);
                            fixXhr.setRequestHeader('apikey', token);
                            fixXhr.setRequestHeader('Content-Type', 'application/json');
                            fixXhr.setRequestHeader('Prefer', 'return=minimal');
                            fixXhr.send(JSON.stringify({ active_pet_id: pet.id }));
                          }
                          console.log('[DAL] v88 beforeunload: new pet "' + pet.name + '" inserted with ID ' + pet.id);
                        }
                      } catch(parseErr) {
                        console.warn('[DAL] v88 beforeunload: pet insert response parse error');
                      }
                    } else {
                      console.error('[DAL] v88 beforeunload: pet insert failed HTTP ' + petXhr.status);
                    }
                  } catch(petErr) {
                    console.error('[DAL] v88 beforeunload: pet insert exception:', petErr.message);
                  }
                }
                return;
              }
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
              var petXhr = new XMLHttpRequest();
              petXhr.open('PATCH', baseUrl + '/pets?id=eq.' + pet.id, false);
              petXhr.setRequestHeader('Authorization', 'Bearer ' + token);
              petXhr.setRequestHeader('apikey', token);
              petXhr.setRequestHeader('Content-Type', 'application/json');
              petXhr.setRequestHeader('Prefer', 'return=minimal');
              petXhr.send(JSON.stringify(petPayload));
            });
            console.log('[DAL] v54 beforeunload: ' + myStudent.pets.length + ' pets saved synchronously');
          }
        } else {
          // Teacher: send sync_ping and attempt synchronous data save
          var xhr2 = new XMLHttpRequest();
          xhr2.open('POST', baseUrl + '/rpc/sync_ping', false);
          xhr2.setRequestHeader('Authorization', 'Bearer ' + token);
          xhr2.setRequestHeader('apikey', token);
          xhr2.send();
          console.log('[DAL] v54 beforeunload: teacher sync_ping sent');
          // v89: Teacher synchronous save — send class data via PUT to prevent data loss
          // when teacher closes tab immediately after making changes
          if (classesData && classesData.length > 0) {
            try {
              var teacherId = localStorage.getItem('userId');
              if (teacherId) {
                var classesPayload = JSON.stringify(classesData.map(function(c) {
                  return { id: c.id, name: c.name, students: c.students, deleted_students: c.deleted_students || [] };
                }));
                var xhr3 = new XMLHttpRequest();
                xhr3.open('PUT', baseUrl + '/classes?id=teacher_id=eq.' + teacherId, false);
                xhr3.setRequestHeader('Authorization', 'Bearer ' + token);
                xhr3.setRequestHeader('apikey', token);
                xhr3.setRequestHeader('Content-Type', 'application/json');
                xhr3.setRequestHeader('Prefer', 'return=minimal');
                xhr3.send(classesPayload);
                console.log('[DAL] v89 beforeunload: teacher class data saved synchronously');
              }
            } catch(e) {
              console.warn('[DAL] v89 beforeunload: teacher sync save failed:', e.message);
            }
          }
        }

        // v80: Risk 4 fix — backup unsynced operation logs to localStorage on page close
        if (window.operationLogs && window.operationLogs.length > 0) {
          var unsyncedLogs = window.operationLogs.filter(function(l) { return !l._synced; });
          if (unsyncedLogs.length > 0) {
            try {
              localStorage.setItem('_dal_v80_unsyncedLogs', JSON.stringify(unsyncedLogs));
              console.log('[DAL] v80 beforeunload: backed up ' + unsyncedLogs.length + ' unsynced logs');
            } catch(e) {
              console.warn('[DAL] v80 beforeunload: log backup failed:', e.message);
            }
          }
        }
      } catch(e) {
        console.warn('[DAL] v54 beforeunload sync failed:', e.message);
      }
    }
  });

  // Sync on visibility change — v54: also handle page hidden with proper wait
  document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
      // Page going hidden — sync if there are unsaved changes
      // v75: Also check _quizStateLocallyModified for quiz state protection
      var hasUnsavedChanges = _pendingLocalSave || window._quizStateLocallyModified;
      if (hasUnsavedChanges && !_dalSyncing) {
        _syncToSupabase();
      }
    } else {
      // Page becoming visible — wait a bit for any in-progress sync to finish,
      // then do a smart refresh. The 5s delay gives Supabase time to propagate writes.
      console.log('[DAL] Page visible — scheduling refresh after sync check');
      var doRefresh = function() {
        if (_dalSyncing) {
          // Sync still in progress, wait and retry
          setTimeout(doRefresh, 2000);
          return;
        }
        // If we synced very recently (< 10s ago), skip refresh — our data is already fresh
        if (Date.now() - _lastOwnWriteTime < 10000) {
          console.log('[DAL] Skipping refresh — recent own write (' + Math.round((Date.now() - _lastOwnWriteTime) / 1000) + 's ago)');
          return;
        }
        _refreshFromSupabase();
      };
      // Initial 3s delay to let any hidden-phase sync complete
      setTimeout(doRefresh, 3000);
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
  
  // v77: Show teacher-only elements for teachers by adding teacher-visible class
  if (currentUser.type === 'teacher') {
    console.log('[DAL] Showing teacher buttons for:', currentUser.email);
    // Add teacher-visible class to show elements (CSS handles the display)
    document.querySelectorAll('.data-mgmt-btn').forEach(function(el) {
      el.classList.add('teacher-visible');
    });
    document.querySelectorAll('.class-actions').forEach(function(el) {
      el.classList.add('teacher-visible');
    });
    // v81: Show teacher-only home stats (must set explicit display value to override CSS display:none)
    document.querySelectorAll('.teacher-only').forEach(function(el) {
      el.style.display = 'flex';
    });
    return;
  }
  
  if (currentUser.type !== 'student') return;
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

  // v80: Risk 4 fix — restore unsynced logs backed up by beforeunload
  try {
    var backedUpLogs = localStorage.getItem('_dal_v80_unsyncedLogs');
    if (backedUpLogs) {
      var parsed = JSON.parse(backedUpLogs);
      if (parsed && parsed.length > 0 && window.operationLogs) {
        var existingIds = {};
        window.operationLogs.forEach(function(l) { existingIds[l.id] = true; });
        var restored = 0;
        parsed.forEach(function(l) {
          if (!existingIds[l.id]) {
            l._synced = false;
            window.operationLogs.push(l);
            restored++;
          }
        });
        if (restored > 0) {
          console.log('[DAL] v80 Restored ' + restored + ' unsynced logs from beforeunload backup');
        }
      }
      localStorage.removeItem('_dal_v80_unsyncedLogs');
    }
  } catch(e) {
    console.warn('[DAL] v80 Log restore failed:', e.message);
  }

  // Full load from Supabase (single source of truth)
  loadFromSupabase().then(function() {
    // Re-render the app with fresh data
    if (typeof init === 'function') init();
    if (typeof renderClassList === 'function') renderClassList();
    if (typeof scheduleAllRenders === 'function') scheduleAllRenders();
    
    if (typeof _updatePKInviteBadge === 'function') {
      setTimeout(_updatePKInviteBadge, 500);
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
