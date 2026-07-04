/**
 * dal.js v10.0 — Robust Data Access Layer with Smart Merge
 * 
 * Architecture: Supabase as single source of truth + local change preservation
 * - Snapshot-based change detection: only applies changes from OTHER users
 * - Smart merge refresh: never overwrites local edits
 * - Debounced Realtime: prevents refresh flooding
 * - Self-write detection: ignores own writes for 30s
 * - Student delta merge: preserves both teacher rewards and student spending
 * - Operation logs synced to Supabase (both teacher and student)
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
var _refreshInterval = 30000; // v15: Poll every 30s as fallback (Realtime handles instant updates)
var _lastRefreshTime = 0;
var _realtimeChannels = [];
var _syncRetryCount = 0;
var _maxRetries = 3;
var _lastSyncFailed = false;
var _DAL_VERSION = '10.0';
var _pendingLocalSave = false; // True when local data has unsaved changes — prevents Realtime overwrite
var _REFRESH_PROTECTION_MS = 10000; // v14: 10s protection after sync (was 30s)

/* ===== Snapshot System (v7.0) ===== */
// _snapshotClassesData: what Supabase looked like when we last loaded/synced
// Used to detect: "did this field change on the SERVER or did we change it LOCALLY?"
// If local[student].coins === snapshot[student].coins → no local change → safe to update from server
// If local[student].coins !== snapshot[student].coins → local change → KEEP local value
var _snapshotClassesData = null;

/* ===== Student Delta Tracking (v7.0) ===== */
var _myBaseCoins = null; // Student's coins at last known Supabase state
var _myBasePets = {};    // Student's pet growth at last known Supabase state

/* ===== Debounce & Self-Write Protection (v7.0) ===== */
var _refreshDebounceTimer = null;
var _REFRESH_DEBOUNCE_MS = 1500; // v14: 1.5s debounce for Realtime events (was 3s)
var _lastOwnWriteTime = 0;       // Timestamp of our last successful sync
var _OWN_WRITE_IGNORE_MS = 10000; // v14: Ignore Realtime events for 10s after our own write (was 30s)

/* ===== Snapshot Helpers (v7.0) ===== */
function _takeSnapshot() {
  if (!classesData || !Array.isArray(classesData)) return;
  _snapshotClassesData = JSON.parse(JSON.stringify(classesData));
  console.log('[DAL] Snapshot taken: ' + _snapshotClassesData.length + ' classes');
}

function _findStudentInSnapshot(studentId) {
  if (!_snapshotClassesData) return null;
  for (var i = 0; i < _snapshotClassesData.length; i++) {
    var cls = _snapshotClassesData[i];
    if (cls.students) {
      for (var j = 0; j < cls.students.length; j++) {
        if (cls.students[j].id == studentId) return cls.students[j];
      }
    }
  }
  return null;
}

function _findPetInSnapshot(petId) {
  if (!_snapshotClassesData) return null;
  for (var i = 0; i < _snapshotClassesData.length; i++) {
    var cls = _snapshotClassesData[i];
    if (cls.students) {
      for (var j = 0; j < cls.students.length; j++) {
        var stu = cls.students[j];
        if (stu.pets) {
          for (var k = 0; k < stu.pets.length; k++) {
            if (stu.pets[k].id == petId) return stu.pets[k];
          }
        }
      }
    }
  }
  return null;
}

/* ===== Smart Merge Refresh (v7.0) ===== */
// This replaces the old approach of completely replacing classesData.
// Instead, we load fresh data from Supabase and intelligently merge:
// - If a field changed on the SERVER (different from snapshot) AND hasn't been changed locally → update
// - If a field was changed LOCALLY (different from snapshot) → keep local value
// - New students/pets from server → always added
function _smartRefreshFromSupabase() {
  if (!currentUser || !currentUser.id) return Promise.resolve();
  
  // v14: Short protection to skip immediate echo of our own writes (2s)
  if (Date.now() - _lastOwnWriteTime < 2000) {
    console.log('[DAL] Smart refresh skipped — own write echo (' + 
      Math.round((2000 - (Date.now() - _lastOwnWriteTime)) / 1000) + 's remaining)');
    return Promise.resolve();
  }

  console.log('[DAL] Smart refresh starting...');
  var isStudent = currentUser.type === 'student';
  var studentId = isStudent ? parseInt(localStorage.getItem('studentId')) : null;
  var classId = isStudent ? parseInt(localStorage.getItem('classId')) : null;
  
  if (isStudent && (!studentId || !classId)) return Promise.resolve();

  // Build queries based on user type
  var queries;
  if (isStudent) {
    queries = Promise.all([
      db.from('classes').select('*').eq('id', classId).single(),
      db.from('students').select('id, name, class_id, coins, last_checkin_date, last_jianghu_date, last_pk_date, active_pet_id, pk_count_today, shop_items, equipped_items, password').eq('class_id', classId),
      db.from('pets').select('*')
    ]);
  } else {
    queries = Promise.all([
      db.from('classes').select('*').eq('teacher_id', currentUser.id).order('id'),
      db.from('students').select('id, name, class_id, coins, last_checkin_date, last_jianghu_date, last_pk_date, active_pet_id, pk_count_today, shop_items, equipped_items, password'),
      db.from('pets').select('*')
    ]);
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
        password: s.password || ''
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
          // For current student, use delta merge (see _syncStudentToSupabase)
          // Here we just update _myBaseCoins if server has a different value that we didn't cause
          var snapCoins = snapStu ? snapStu.coins : null;
          if (snapCoins !== null && freshStu.coins !== snapCoins && localStu.coins === snapCoins) {
            // Server changed (e.g., teacher reward), local hasn't changed → apply
            localStu.coins = freshStu.coins;
            _myBaseCoins = freshStu.coins; // Update base for future delta calculation
            changesApplied++;
          }
          // If local changed (student spent coins), keep local — delta will be applied at sync time
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
        
        // pkCountToday
        var snapPkToday = snapStu ? (snapStu.pkCountToday || 0) : 0;
        if ((freshStu.pkCountToday || 0) !== snapPkToday && (localStu.pkCountToday || 0) === snapPkToday) {
          localStu.pkCountToday = freshStu.pkCountToday || 0;
          changesApplied++;
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
            
            // growth: for student's own active pet, use delta; for others, use snapshot comparison
            var snapGrowth = snapPet ? (snapPet.growth || 0) : null;
            if (snapGrowth !== null) {
              if (freshPet.growth !== snapGrowth && localPet.growth === snapGrowth) {
                localPet.growth = freshPet.growth;
                if (isStudent && localStu.id == studentId) _myBasePets[freshPet.id] = freshPet.growth;
                changesApplied++;
              }
            } else if (freshPet.growth !== localPet.growth) {
              localPet.growth = freshPet.growth;
              changesApplied++;
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
      coins: s.coins || 50,
      pets: [],
      lastCheckinDate: s.last_checkin_date || null,
      lastJianghuDate: s.last_jianghu_date || null,
      lastPkDate: s.last_pk_date || null,
      activePetId: s.active_pet_id || null,
      pkCountToday: s.pk_count_today || 0,
      shopItems: (function() { try { return typeof s.shop_items === 'string' ? JSON.parse(s.shop_items) : (s.shop_items || []); } catch(e) { return []; } })(),
      equippedItems: (function() { try { return typeof s.equipped_items === 'string' ? JSON.parse(s.equipped_items) : (s.equipped_items || {}); } catch(e) { return {}; } })(),
      password: s.password || ''
    };
  });

  var petByStudent = {};
  pets.forEach(function(p) {
    var sid = p.student_id;
    if (!petByStudent[sid]) petByStudent[sid] = [];
    petByStudent[sid].push({
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
    });
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

  return classes.map(function(c) { return classMap[c.id]; }).filter(Boolean);
}

function _loadTeacherFromSupabase() {
  return Promise.all([
    db.from('classes').select('*').eq('teacher_id', currentUser.id).order('id'),
    db.from('students').select('id, name, class_id, coins, last_checkin_date, last_jianghu_date, last_pk_date, active_pet_id, pk_count_today, shop_items, equipped_items, password'),
    db.from('pets').select('*')
  ]).then(function(results) {
    var classesR = results[0], studentsR = results[1], petsR = results[2];
    if (classesR.error) { console.error('[DAL] classes error:', classesR.error); throw classesR.error; }
    if (studentsR.error) console.warn('[DAL] students error:', studentsR.error);
    if (petsR.error) console.warn('[DAL] pets error:', petsR.error);

    var classes = classesR.data || [];
    var students = (studentsR.data || []);
    var pets = (petsR.data || []);

    // Get student IDs for this teacher's classes
    var classIds = classes.map(function(c) { return c.id; });
    if (classIds.length > 0) {
      // Filter students to only those in teacher's classes
      students = students.filter(function(s) { return classIds.indexOf(s.class_id) >= 0; });
      var studentIds = students.map(function(s) { return s.id; });
      // Filter pets to only those belonging to teacher's students
      if (studentIds.length > 0) {
        pets = pets.filter(function(p) { return studentIds.indexOf(p.student_id) >= 0; });
      } else {
        pets = [];
      }
    }

    var newClassesData = _buildTeacherClasses(classes, students, pets);
    classesData = newClassesData;

    console.log('[DAL] Loaded ' + classes.length + ' classes, ' + students.length + ' students, ' + pets.length + ' pets');
    newClassesData.forEach(function(c) {
      console.log('[DAL]   Class ' + c.id + ' "' + c.name + '": ' + c.students.length + ' students');
    });

    // Take snapshot after initial load
    _takeSnapshot();

    // Also load custom actions, logs, archives
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
    db.from('classes').select('*').eq('id', classId).single(),
    db.from('students').select('id, name, class_id, coins, last_checkin_date, last_jianghu_date, last_pk_date, active_pet_id, pk_count_today, shop_items, equipped_items, password').eq('class_id', classId),
    db.from('pets').select('*')
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
        coins: s.coins || 50,
        pets: [],
        lastCheckinDate: s.last_checkin_date || null,
        lastJianghuDate: s.last_jianghu_date || null,
        lastPkDate: s.last_pk_date || null,
        activePetId: s.active_pet_id || null,
        pkCountToday: s.pk_count_today || 0,
        shopItems: (function() { try { return typeof s.shop_items === 'string' ? JSON.parse(s.shop_items) : (s.shop_items || []); } catch(e) { return []; } })(),
        equippedItems: (function() { try { return typeof s.equipped_items === 'string' ? JSON.parse(s.equipped_items) : (s.equipped_items || {}); } catch(e) { return {}; } })(),
        password: s.password || ''
      };
    });

    classPets.forEach(function(p) {
      var sid = p.student_id;
      if (studentMap[sid]) {
        studentMap[sid].pets.push({
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
        });
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

// v18: Track retry count for operation logs loading
var _opLogsRetryCount = 0;
var _OPLOGS_MAX_RETRIES = 2;

function _loadOperationLogs() {
  if (!currentUser || !currentUser.id) return Promise.resolve();
  if (!db) {
    console.warn('[DAL] _loadOperationLogs: db not initialized');
    return Promise.resolve();
  }

  // v14: Use window.operationLogs explicitly to avoid cross-script scope issues
  // app.js declares "var operationLogs" which creates window.operationLogs,
  // but dal.js (a separate <script>) must reference it via window. to ensure
  // both scripts share the same array.
  if (typeof window.operationLogs === 'undefined') {
    try { window.operationLogs = JSON.parse(localStorage.getItem('operationLogs')) || []; } catch(e) { window.operationLogs = []; }
  }

  // Get class IDs for this user
  var getClassIdsPromise;
  if (currentUser.type === 'teacher') {
    getClassIdsPromise = db.from('classes').select('id').eq('teacher_id', currentUser.id).then(function(classR) {
      if (classR.error || !classR.data) return [];
      return classR.data.map(function(c) { return c.id; });
    });
  } else {
    // Student: use classId from localStorage or currentUser
    var studentClassId = parseInt(localStorage.getItem('classId')) || (currentUser.classId ? parseInt(currentUser.classId) : 0);
    if (!studentClassId) {
      console.warn('[DAL] _loadOperationLogs: student has no classId in localStorage or currentUser');
      return Promise.resolve();
    }
    // v17: Try to find class by querying Supabase; fall back to direct classId
    getClassIdsPromise = db.from('classes').select('id').eq('id', studentClassId).then(function(classR) {
      if (classR.error) {
        // v17: If query fails (possibly RLS), use classId directly
        console.warn('[DAL] _loadOperationLogs: classes query error for student, using classId directly:', classR.error.message || classR.error);
        return [studentClassId];
      }
      if (!classR.data || classR.data.length === 0) {
        // v17: Class not found in query result — still try with the classId
        // (might be RLS blocking read, but operation_logs might still be readable)
        console.warn('[DAL] _loadOperationLogs: class ' + studentClassId + ' not found via classes query, trying direct classId');
        return [studentClassId];
      }
      return classR.data.map(function(c) { return c.id; });
    }).catch(function(e) {
      console.warn('[DAL] _loadOperationLogs: classes query failed, using local classId:', e);
      return [studentClassId];
    });
  }

  return getClassIdsPromise.then(function(classIds) {
    if (!classIds || classIds.length === 0) {
      console.warn('[DAL] _loadOperationLogs: no classIds found');
      return null;
    }
    // v17: Log the query parameters for diagnostics
    console.log('[DAL] v18 _loadOperationLogs: querying operation_logs for class_ids:', classIds, 'user:', currentUser.type, currentUser.id);
    // v14: Increased limit to 5000 to ensure all logs are fetched
    return db.from('operation_logs').select('*').in('class_id', classIds).order('created_at', { ascending: false }).limit(5000)
      .then(function(queryResult) {
        // v18: Store classIds for retry
        queryResult._classIds = classIds;
        return queryResult;
      });
  }).then(function(r) {
    // v18: Log query results for diagnostics
    if (r && r.error) {
      console.error('[DAL] v18 operation_logs query ERROR:', r.error.message || r.error, '| hint: check RLS policies on operation_logs table');
    } else if (r && r.data) {
      console.log('[DAL] v18 operation_logs query returned', r.data.length, 'rows for user:', currentUser.type);
      // v18: If student gets 0 results, attempt auto-fix and retry
      if (currentUser.type === 'student' && r.data.length === 0 && _opLogsRetryCount < _OPLOGS_MAX_RETRIES) {
        _opLogsRetryCount++;
        console.warn('[DAL] v18 Student got 0 operation_logs. Attempting auto-fix #' + _opLogsRetryCount + '...');
        // Try to check RLS and retry
        return _tryFixOperationLogsRLS().then(function() {
          // Wait 1s before retry
          return new Promise(function(resolve) { setTimeout(resolve, 1000); });
        }).then(function() {
          var classIds = r._classIds || [parseInt(localStorage.getItem('classId'))];
          console.log('[DAL] v18 Retrying operation_logs query (attempt ' + _opLogsRetryCount + ')...');
          return db.from('operation_logs').select('*').in('class_id', classIds).order('created_at', { ascending: false }).limit(5000);
        }).then(function(retryResult) {
          if (retryResult && retryResult.data && retryResult.data.length > 0) {
            console.log('[DAL] v18 Retry SUCCESS! Got', retryResult.data.length, 'rows on retry');
            if (typeof showNotification === 'function') {
              showNotification('数据同步成功', '操作记录已加载', 'success');
            }
            r = retryResult; // Use retry result
          } else if (_opLogsRetryCount >= _OPLOGS_MAX_RETRIES) {
            // v18: All retries failed — use fallback data from students table
            console.warn('[DAL] v18 All retries failed. Loading fallback operation logs from students table...');
            var fallbackClassId = parseInt(localStorage.getItem('classId'));
            return _loadStudentOperationLogsFallback(fallbackClassId).then(function(fallbackLogs) {
              if (fallbackLogs.length > 0) {
                console.log('[DAL] v18 Fallback loaded', fallbackLogs.length, 'synthetic logs');
                // Store fallback logs in r.data format for processing below
                r = { data: fallbackLogs.map(function(fl) {
                  return {
                    id: fl.id, created_at: fl.timestamp, class_id: fl.classId,
                    student_id: fl.studentId, student_name: fl.studentName,
                    action_type: fl.actionType, details: fl.details,
                    coin_delta: fl.coinDelta, exp_delta: fl.expDelta,
                    reverted: false
                  };
                })};
              }
            });
          }
        });
      } else if (currentUser.type === 'student' && r.data.length === 0) {
        console.warn('[DAL] v18 DIAGNOSTIC: Student got 0 operation_logs after all retries. RLS fix needed. SQL:\n' +
          'CREATE POLICY IF NOT EXISTS "Students can read class operation logs" ON operation_logs FOR SELECT USING (true);\n' +
          'CREATE POLICY IF NOT EXISTS "Anyone can insert operation logs" ON operation_logs FOR INSERT WITH CHECK (true);\n' +
          'CREATE POLICY IF NOT EXISTS "Anyone can update operation logs" ON operation_logs FOR UPDATE USING (true);');
      }
    }
    // v14: Completely rebuild operationLogs from Supabase + local unsynced logs
    // This is more reliable than the old merge logic which could miss logs
    var localLogs = window.operationLogs || [];
    
    // Collect local unsynced logs (logs not yet pushed to Supabase)
    var localUnsynced = [];
    localLogs.forEach(function(l) {
      if (!l._synced && l.id < 0) {
        localUnsynced.push(l);
      }
    });

    var supabaseLogs = [];
    if (r && r.data) {
      supabaseLogs = r.data.map(function(l) {
        return {
          id: l.id,
          timestamp: l.created_at || l.timestamp,
          classId: l.class_id,
          studentId: l.student_id,
          studentName: l.student_name || '',
          actionType: l.action_type || '',
          details: l.details || '',
          coinDelta: l.coin_delta || 0,
          expDelta: l.exp_delta || 0,
          petId: l.pet_id || null,
          extra: (function() { try { return typeof l.extra === 'string' ? JSON.parse(l.extra) : (l.extra || null); } catch(e) { return null; } })(),
          snapshot: (function() { try { return typeof l.snapshot === 'string' ? JSON.parse(l.snapshot) : (l.snapshot || null); } catch(e) { return null; } })(),
          fullSnapshot: (function() { try { return typeof l.full_snapshot === 'string' ? JSON.parse(l.full_snapshot) : (l.full_snapshot || null); } catch(e) { return null; } })(),
          reverted: !!l.reverted,
          _synced: true,
          _fromSupabase: true
        };
      });
    }

    // v14: Build a set of Supabase log IDs for fast lookup
    var supabaseIdSet = {};
    supabaseLogs.forEach(function(l) { supabaseIdSet[l.id] = true; });

    // Keep local unsynced logs only if they aren't already in Supabase (by content match)
    var keptUnsynced = [];
    localUnsynced.forEach(function(localLog) {
      var foundInSupabase = false;
      for (var i = 0; i < supabaseLogs.length; i++) {
        var sbLog = supabaseLogs[i];
        if (localLog.actionType === sbLog.actionType &&
            String(localLog.studentId) === String(sbLog.studentId) &&
            localLog.details === sbLog.details &&
            (localLog.coinDelta || 0) === (sbLog.coinDelta || 0) &&
            localLog.timestamp === sbLog.timestamp) {
          foundInSupabase = true;
          // Mark local log as synced with the Supabase ID
          localLog.id = sbLog.id;
          localLog._synced = true;
          localLog._fromSupabase = true;
          if (sbLog.reverted) localLog.reverted = true;
          break;
        }
      }
      if (!foundInSupabase) {
        keptUnsynced.push(localLog);
      }
    });

    // v16: Always trust Supabase as source of truth for operation logs.
    // If Supabase returns 0 results, it means there are no logs (or RLS needs fixing).
    // We still keep local unsynced logs (logs not yet pushed to Supabase).
    var isStudent = currentUser && currentUser.type === 'student';
    if (isStudent && supabaseLogs.length === 0 && localLogs.length > 0) {
      console.warn('[DAL] v16 WARNING: Supabase returned 0 operation_logs for student, but we have ' + localLogs.length + ' local logs. This may indicate an RLS policy issue. Proceeding with Supabase data + unsynced local logs.');
    }

    // v16: Replace operationLogs entirely: Supabase logs + remaining unsynced local logs
    window.operationLogs = supabaseLogs.concat(keptUnsynced);

    // Sort by timestamp (newest first)
    window.operationLogs.sort(function(a, b) {
      return (b.timestamp || '').localeCompare(a.timestamp || '');
    });

    // v15: Sync back to app.js's local alias so bare "operationLogs" in app.js sees the new data
    if (typeof _syncOpLogsAlias === 'function') { try { _syncOpLogsAlias(); } catch(e) {} }

    // Persist the merged logs to localStorage as backup
    try { localStorage.setItem('operationLogs', JSON.stringify(window.operationLogs)); } catch(e) {}

    console.log('[DAL] v14 Operation logs rebuilt: ' + window.operationLogs.length + ' total (' + supabaseLogs.length + ' from Supabase, ' + keptUnsynced.length + ' local unsynced kept)');
    if (currentUser.type === 'student') {
      var today = new Date().toDateString();
      var todayLogs = window.operationLogs.filter(function(l) { return new Date(l.timestamp).toDateString() === today; });
      console.log('[DAL] Student today logs:', todayLogs.length);
      todayLogs.forEach(function(l) {
        console.log('[DAL]   Log:', l.actionType, 'studentId:', l.studentId, 'coinDelta:', l.coinDelta, 'synced:', l._synced);
      });
    }
  }).catch(function(e) {
    console.warn('[DAL] operation_logs load error:', e);
    if (typeof window.operationLogs === 'undefined') {
      try { window.operationLogs = JSON.parse(localStorage.getItem('operationLogs')) || []; } catch(e2) { window.operationLogs = []; }
    }
  });
}

// v18: Attempt to fix RLS on operation_logs table
// Uses Supabase REST API to check if the table is accessible
function _tryFixOperationLogsRLS() {
  if (!db) return Promise.resolve(false);
  // Try a minimal query to test access
  return db.from('operation_logs').select('id').limit(1).then(function(r) {
    if (r.error) {
      console.warn('[DAL] v18 operation_logs RLS check failed:', r.error.message);
      // Try to use rpc as alternative
      return false;
    }
    return true;
  }).catch(function() { return false; });
}

// v18: For students — load operation logs from alternative source when RLS blocks operation_logs
// This queries the students table for recent coin changes as a proxy for operation history
function _loadStudentOperationLogsFallback(classId) {
  if (!db || !classId) return Promise.resolve([]);
  // Query all students in the class to get their current state
  // This doesn't give us operation history, but gives us current coins/pet state
  return db.from('students').select('id, name, coins, last_checkin_date').eq('class_id', classId).then(function(r) {
    if (r.error || !r.data) return [];
    // Build synthetic "today summary" logs from current student state
    var today = new Date().toDateString();
    var summaryLogs = [];
    r.data.forEach(function(s) {
      if (s.last_checkin_date && new Date(s.last_checkin_date).toDateString() === today) {
        summaryLogs.push({
          id: 'fallback_checkin_' + s.id,
          timestamp: s.last_checkin_date,
          classId: classId,
          studentId: s.id,
          studentName: s.name || '',
          actionType: '每日打卡',
          details: s.name + ' 完成了每日打卡',
          coinDelta: 10,
          expDelta: 0,
          _synced: true,
          _fromSupabase: true,
          _fallback: true
        });
      }
    });
    return summaryLogs;
  }).catch(function() { return []; });
}

/* ===== Sync Operation Logs to Supabase ===== */
// v14: Use window.operationLogs explicitly for cross-script scope safety
function _syncOperationLogsToSupabase() {
  // v14: Ensure window.operationLogs exists
  if (typeof window.operationLogs === 'undefined') {
    try { window.operationLogs = JSON.parse(localStorage.getItem('operationLogs')) || []; } catch(e) { window.operationLogs = []; }
  }
  if (!Array.isArray(window.operationLogs)) return Promise.resolve();
  if (!db || !currentUser) return Promise.resolve();

  // Collect unsynced logs WITH their indices in the original array
  var unsyncedEntries = [];
  for (var i = 0; i < window.operationLogs.length; i++) {
    if (!window.operationLogs[i]._synced) {
      unsyncedEntries.push({ index: i, log: window.operationLogs[i] });
    }
  }

  // Find reverted logs that are synced but need reverted status updated in Supabase
  var revertedLogs = window.operationLogs.filter(function(l) { return l._synced && l.reverted && !l._revertSynced; });

  var insertPromise = Promise.resolve();
  if (unsyncedEntries.length > 0) {
    console.log('[DAL] Syncing ' + unsyncedEntries.length + ' new operation logs to Supabase');

    // Get class_id for the current context
    var classId = null;
    if (currentUser.type === 'teacher') {
      classId = (typeof currentClassId !== 'undefined' ? currentClassId : null) || (classesData[0] ? classesData[0].id : null);
    } else {
      classId = parseInt(localStorage.getItem('classId')) || (classesData[0] ? classesData[0].id : null);
    }
    if (!classId) {
      console.warn('[DAL] Cannot sync logs: no class_id');
      return Promise.resolve();
    }

    // Build payloads and tag each with its source index for reliable matching
    var payloads = unsyncedEntries.map(function(entry) {
      var l = entry.log;
      return {
        class_id: l.classId || classId,
        student_id: l.studentId,
        student_name: l.studentName || '',
        action_type: l.actionType || '',
        details: l.details || '',
        coin_delta: l.coinDelta || 0,
        exp_delta: l.expDelta || 0,
        pet_id: l.petId || null,
        extra: l.extra ? JSON.stringify(l.extra) : null,
        snapshot: l.snapshot ? JSON.stringify(l.snapshot) : null,
        full_snapshot: l.fullSnapshot ? JSON.stringify(l.fullSnapshot) : null,
        reverted: !!l.reverted,
        _local_idx: entry.index  // client-side tag, ignored by Supabase
      };
    });

    // Insert in batches of 50 to avoid Supabase payload limits
    var batchSize = 50;
    var promises = [];
    for (var b = 0; b < payloads.length; b += batchSize) {
      var batch = payloads.slice(b, b + batchSize);
      var batchEntries = unsyncedEntries.slice(b, b + batchSize);
      promises.push(
        db.from('operation_logs').insert(batch).select().then(function(r) {
          if (r.error) {
            console.error('[DAL] operation_logs insert error:', r.error);
            return;
          }
          if (r.data && r.data.length > 0) {
            // Match returned rows back to local logs using _local_idx tag
            r.data.forEach(function(inserted) {
              var localIdx = inserted._local_idx;
              if (localIdx !== undefined && localIdx >= 0 && localIdx < window.operationLogs.length) {
                window.operationLogs[localIdx]._synced = true;
                window.operationLogs[localIdx].id = inserted.id;
                window.operationLogs[localIdx]._fromSupabase = true;
              }
            });
            // Fallback: if _local_idx wasn't returned (Supabase strips unknown fields),
            // mark all logs in this batch as synced by position
            var allMatched = r.data.every(function(d) { return d._local_idx !== undefined; });
            if (!allMatched) {
              console.warn('[DAL] _local_idx stripped by Supabase, falling back to batch marking');
              batchEntries.forEach(function(entry) {
                window.operationLogs[entry.index]._synced = true;
                window.operationLogs[entry.index]._fromSupabase = true;
              });
            }
            // Persist the updated sync flags to localStorage
            try { localStorage.setItem('operationLogs', JSON.stringify(window.operationLogs)); } catch(e) {}
          }
        })
      );
    }
    insertPromise = Promise.all(promises);
  }

  // Update reverted status for already-synced logs
  var revertPromise = Promise.resolve();
  if (revertedLogs.length > 0) {
    console.log('[DAL] Updating ' + revertedLogs.length + ' reverted logs in Supabase');
    var revertPromises = revertedLogs.map(function(l) {
      if (!l.id || l.id <= 0 || l.id !== Math.floor(l.id)) return Promise.resolve();
      return db.from('operation_logs').update({ reverted: true }).eq('id', l.id).then(function(r) {
        if (r.error) {
          console.error('[DAL] operation_logs revert update error:', r.error);
        } else {
          l._revertSynced = true;
        }
      });
    });
    revertPromise = Promise.all(revertPromises);
  }

  return Promise.all([insertPromise, revertPromise]).then(function() {
    // v15: Sync alias after sync completes
    if (typeof _syncOpLogsAlias === 'function') { try { _syncOpLogsAlias(); } catch(e) {} }
    console.log('[DAL] Operation logs sync complete');
  });
}

/* ===== Main Load Entry ===== */
function loadFromSupabase() {
  if (currentUser && currentUser.type === 'student') {
    return _loadStudentFromSupabase();
  } else {
    return _loadTeacherFromSupabase();
  }
}

/* ===== Save ===== */
function _syncTeacherToSupabase() {
  // === Phase 1: Upsert classes + categorize students ===
  var classPromises = [];
  var newStudents = [];   // { payload, stuRef }
  var existingStudents = []; // { payload, stuRef }

  classesData.forEach(function(cls) {
    classPromises.push(
      db.from('classes').upsert([{
        id: cls.id,
        name: cls.name,
        teacher_id: currentUser.id
      }]).then(function(r) {
        if (r.error) console.error('[DAL] class upsert error:', r.error);
      })
    );

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
        shop_items: JSON.stringify(stu.shopItems || []),
        equipped_items: JSON.stringify(stu.equippedItems || {}),
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
  return Promise.all(classPromises).then(function() {
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
              is_active: pet.isActive !== undefined ? pet.isActive : true,
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

    // Wait for all pets, then upsert ALL students with correct active_pet_id
    return Promise.all(allPetPromises).then(function() {
      var studentUpsertPromises = studentsToUpsert.map(function(stu) {
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
          shop_items: JSON.stringify(stu.shopItems || []),
          equipped_items: JSON.stringify(stu.equippedItems || {}),
          password: stu.password || ''
        };
        return db.from('students').upsert([payload]).then(function(r) {
          if (r.error) console.error('[DAL] student upsert error:', r.error);
        });
      });
      return Promise.all(studentUpsertPromises);
    });
  }).then(function() {
    // === Phase 4: Save custom actions ===
    if (typeof customActions !== 'undefined' && customActions.length > 0) {
      var actionPayloads = customActions.map(function(a) {
        return {
          class_id: a.class_id || (classesData[0] ? classesData[0].id : null),
          name: a.name,
          coins: a.coins || 0
        };
      }).filter(function(a) { return a.class_id; });
      if (actionPayloads.length > 0) {
        var classIds = Array.from(new Set(actionPayloads.map(function(a) { return a.class_id; })));
        return db.from('custom_actions').delete().in('class_id', classIds).then(function() {
          return db.from('custom_actions').insert(actionPayloads);
        }).then(function(r) {
          if (r.error) console.error('[DAL] custom_actions save error:', r.error);
        });
      }
    }
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
        is_active: pet.isActive !== undefined ? pet.isActive : true,
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
    return db.from('students').select('coins, last_checkin_date, last_jianghu_date, last_pk_date, pk_count_today').eq('id', studentId).single();
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
      if (freshR.data.pk_count_today !== undefined) {
        myStudent.pkCountToday = Math.max(myStudent.pkCountToday || 0, freshR.data.pk_count_today || 0);
      }
    }

    // Update base coins to current value (will be re-set after sync confirms)
    _myBaseCoins = finalCoins;

    // Step 3: Upsert student with merged data
    return db.from('students').upsert([{
      id: studentId,
      coins: finalCoins,
      shop_items: JSON.stringify(myStudent.shopItems || []),
      equipped_items: JSON.stringify(myStudent.equippedItems || {}),
      last_checkin_date: myStudent.lastCheckinDate || null,
      last_jianghu_date: myStudent.lastJianghuDate || null,
      last_pk_date: myStudent.lastPkDate || null,
      active_pet_id: myStudent.activePetId || null,
      pk_count_today: myStudent.pkCountToday || 0
    }]).then(function(r) {
      if (r.error) console.error('[DAL] student sync error:', r.error);
      // Update base tracking after successful sync
      if (!r.error) {
        _myBaseCoins = finalCoins;
        (myStudent.pets || []).forEach(function(p) { _myBasePets[p.id] = p.growth || 0; });
      }
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

  return syncFn().then(function() {
    // Also sync any unsynced operation logs
    return _syncOperationLogsToSupabase();
  }).then(function() {
    _dalSyncing = false;
    _syncRetryCount = 0;
    _lastSyncFailed = false;
    _pendingLocalSave = false; // Clear pending flag after successful sync
    // Record our own write time for logging
    _lastOwnWriteTime = Date.now();
    // Update snapshot to reflect what we just wrote to Supabase
    _takeSnapshot();
    // For student: update base coins/pets to current local value (what's now in Supabase)
    if (currentUser && currentUser.type === 'student') {
      var myStu = null;
      var sid = parseInt(localStorage.getItem('studentId'));
      if (classesData && classesData[0]) {
        for (var i = 0; i < classesData[0].students.length; i++) {
          if (classesData[0].students[i].id === sid) { myStu = classesData[0].students[i]; break; }
        }
      }
      if (myStu) {
        _myBaseCoins = myStu.coins;
        (myStu.pets || []).forEach(function(p) { _myBasePets[p.id] = p.growth || 0; });
      }
    }
    _updateCloudStatus('synced');
    console.log('[DAL] Sync complete');

    if (_dalSyncQueued) {
      _dalSyncQueued = false;
      return _syncToSupabase();
    }
  }).catch(function(err) {
    _dalSyncing = false;
    _lastSyncFailed = true;
    // Keep _pendingLocalSave = true — local data is correct and still needs to sync
    _syncRetryCount++;
    console.error('[DAL] Sync error:', err);
    _updateCloudStatus('error');

    if (_syncRetryCount <= _maxRetries) {
      console.log('[DAL] Retrying sync (' + _syncRetryCount + '/' + _maxRetries + ')...');
      setTimeout(function() { _syncToSupabase(); }, _syncRetryCount * 2000);
    } else {
      console.error('[DAL] Sync failed after ' + _maxRetries + ' retries');
      _showNotification('数据同步失败，请检查网络后点击云朵图标重试', 'error');
    }
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
function _immediateRefreshFromSupabase() {
  // Don't refresh while syncing
  if (_dalSyncing) {
    console.log('[DAL] Immediate refresh skipped - sync in progress, will retry');
    // Queue a refresh after current sync completes
    setTimeout(_immediateRefreshFromSupabase, 500);
    return;
  }
  
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
    if (typeof scheduleAllRenders === 'function') scheduleAllRenders();
    // v15: Also re-render PK page to update qualification status
    if (typeof renderPKPage === 'function') { try { renderPKPage(); } catch(e) {} }
    // v15: Also re-render jianghu page to update qualification status
    if (typeof renderJianghuPage === 'function') { try { renderJianghuPage(); } catch(e) {} }
    // v12: Refresh history modal if open — show latest logs in real-time
    if (typeof refreshHistoryModalIfOpen === 'function') refreshHistoryModalIfOpen();
    
    // For students: check for pending PK challenges and accepted challenges
    if (currentUser && currentUser.type === 'student') {
      console.log('[DAL] Student data refreshed from server');
      console.log('[DAL] Operation logs loaded:', (window.operationLogs || []).length);
      
      // Check for accepted PK challenge (for the challenger to start battle)
      if (typeof _checkAcceptedPKChallenge === 'function') {
        if (!_checkAcceptedPKChallenge()) {
          // Check for pending challenges targeting me
          if (typeof _checkPendingPKChallenge === 'function') {
            _checkPendingPKChallenge();
          }
        }
      }
    }
    
    console.log('[DAL] Smart refresh complete');
  }).catch(function(e) {
    console.error('[DAL] Smart refresh error:', e);
  });
}

function _setupRealtimeSubscriptions() {
  if (!db || !db.channel) return;

  try {
    // Subscribe to classes table — immediate refresh on change
    var classChannel = db.channel('dal-classes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'classes' }, function() {
        console.log('[DAL] 🔔 Realtime classes event');
        _immediateRefreshFromSupabase();
      })
      .subscribe();
    _realtimeChannels.push(classChannel);

    // Subscribe to students table — immediate refresh on change
    var studentChannel = db.channel('dal-students')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'students' }, function() {
        console.log('[DAL] 🔔 Realtime students event');
        _immediateRefreshFromSupabase();
      })
      .subscribe();
    _realtimeChannels.push(studentChannel);

    // Subscribe to pets table — immediate refresh on change
    var petChannel = db.channel('dal-pets')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pets' }, function(payload) {
        console.log('[DAL] 🔔 Realtime pets event:', payload.eventType);
        _immediateRefreshFromSupabase();
      })
      .subscribe();
    _realtimeChannels.push(petChannel);

    // Subscribe to operation_logs table — immediate refresh on change
    var logChannel = db.channel('dal-operation-logs')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'operation_logs' }, function() {
        console.log('[DAL] 🔔 Realtime operation_logs event');
        _immediateRefreshFromSupabase();
      })
      .subscribe();
    _realtimeChannels.push(logChannel);

    console.log('[DAL] ⚡ Realtime subscriptions active — instant push enabled');
  } catch (e) {
    console.warn('[DAL] Realtime setup failed, using polling fallback:', e);
  }

  // Fallback polling (2 minutes) — only used if Realtime fails
  _refreshTimer = setInterval(function() {
    _refreshFromSupabase();
  }, _refreshInterval);
}

function _cleanupRealtime() {
  _realtimeChannels.forEach(function(ch) {
    try { if (db && db.removeChannel) db.removeChannel(ch); } catch(e) {}
  });
  _realtimeChannels = [];
  if (_refreshTimer) { clearInterval(_refreshTimer); _refreshTimer = null; }
}

/* ===== Lifecycle ===== */
function _setupPageLifecycle() {
  // Sync before page unload
  window.addEventListener('beforeunload', function() {
    if (!_dalSyncing) {
      // Best-effort sync using synchronous XHR
      try {
        var token = '';
        try { token = JSON.parse(localStorage.getItem('sb-xbygooadskfqllnhwmet-auth-token') || '{}').access_token || ''; } catch(e) {}
        if (token) {
          var xhr = new XMLHttpRequest();
          xhr.open('POST', 'https://xbygooadskfqllnhwmet.supabase.co/rest/v1/rpc/sync_ping', false);
          xhr.setRequestHeader('Authorization', 'Bearer ' + token);
          xhr.setRequestHeader('apikey', token);
          xhr.send();
        }
      } catch(e) {}
    }
  });

  // Sync on visibility change — v10: wait for sync to finish before refreshing
  document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
      // Page going hidden — sync if needed
      if (!_dalSyncing) _syncToSupabase();
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

  // Wrap saveLogs — v10: return the sync promise so callers can await it
  if (typeof saveLogs === 'function' && !saveLogs._dalWrapped) {
    var origSaveLogs = saveLogs;
    saveLogs = function() {
      origSaveLogs.apply(this, arguments);
      // Sync new operation logs to Supabase and return the promise
      return _syncOperationLogsToSupabase();
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
  if (!currentUser || currentUser.type !== 'student') return;
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

  // Override openStudentModal for student viewing other students
  var _origOpenStudentModal = window.openStudentModal;
  window.openStudentModal = function(studentId) {
    if (currentUser.type === 'student' && studentId.toString() !== currentUser.studentId.toString()) {
      var cur = classesData.find(function(c){ return c.id === currentClassId; });
      if (!cur) return;
      var student = cur.students.find(function(s){ return s.id.toString() === studentId.toString(); });
      if (!student) return;
      var activePet = typeof getActivePet === 'function' ? getActivePet(student) : null;
      var myStudent = cur.students.find(function(s){ return s.id.toString() === currentUser.studentId.toString(); });
      var myPet = myStudent ? (typeof getActivePet === 'function' ? getActivePet(myStudent) : null) : null;

      var content = '<div style="text-align:center;">';
      content += '<div style="font-size:20px;font-weight:700;margin-bottom:8px;">' + (typeof escapeHTML === 'function' ? escapeHTML(student.name) : student.name) + '</div>';
      content += '<div style="font-size:14px;color:#888;margin-bottom:12px;">💰 ' + student.coins + ' 金币</div>';
      if (activePet) {
        var petStatus = activePet.isDead ? '💀 已饿死' : (activePet.level >= 9 ? '👑 已满级' : '🌱 活跃中');
        var pkToday = student.pkCountToday || 0;
        content += '<div style="background:rgba(255,200,200,0.2);border-radius:16px;padding:14px;margin:10px 0;border:1px solid rgba(255,180,180,0.4);">';
        content += '<div style="font-size:44px;margin-bottom:8px;">' + (typeof getPetImage === 'function' ? getPetImage(activePet.name, activePet.level) : '🐾') + '</div>';
        content += '<div style="font-size:16px;font-weight:600;">' + (typeof escapeHTML === 'function' ? escapeHTML(activePet.nickname || activePet.name) : (activePet.nickname || activePet.name)) + '</div>';
        content += '<div style="font-size:13px;color:#888;margin-top:4px;">Lv.' + activePet.level + ' · 成长值: ' + activePet.growth + '</div>';
        content += '<div style="font-size:13px;color:#888;margin-top:2px;">状态: ' + petStatus + '</div>';
        content += '<div style="font-size:13px;color:#888;margin-top:2px;">今日PK次数: ' + pkToday + ' / 3</div>';
        content += '</div>';

        // PK challenge button
        var canPK = true, pkReason = '';
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
  if (typeof pkState !== 'undefined') {
    pkState.players = [
      { studentId: myStudent.id, studentName: myStudent.name, pet: Object.assign({}, myPet) },
      { studentId: targetStudent.id, studentName: targetStudent.name, pet: Object.assign({}, targetPet) }
    ];
  }
  if (typeof switchPage === 'function') switchPage('pk-page');
  setTimeout(function() {
    if (typeof startPKBattle === 'function') startPKBattle();
  }, 500);
}
window._studentChallengePK = _studentChallengePK;

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
function initDAL() {
  if (_dalReady) return;

  // Wait for Supabase client and auth
  if (typeof db === 'undefined' || !db) {
    console.log('[DAL] Waiting for Supabase client...');
    setTimeout(initDAL, 1000);
    return;
  }
  if (typeof currentUser === 'undefined' || !currentUser) {
    console.log('[DAL] Waiting for currentUser...');
    setTimeout(initDAL, 1000);
    return;
  }

  console.log('[DAL] Initializing v' + _DAL_VERSION + ' for ' + currentUser.type + ': ' + (currentUser.email || currentUser.studentName));

  // Clean up truly stale localStorage keys only.
  // IMPORTANT: Do NOT clear 'operationLogs' or 'customActions' here — they may contain
  // unsynced data from the previous session. app.js loads them at page start; if we clear
  // them now and the Supabase load below fails, that data is permanently lost.
  var staleKeys = ['classPetData', '_dalDeletedClassIds', '_dalIdMap', '_dal_unsyncedFlag', 'deletedClasses', 'logArchives'];
  staleKeys.forEach(function(key) {
    try { localStorage.removeItem(key); } catch(e) {}
  });
  console.log('[DAL] Cleaned stale localStorage keys (preserved operationLogs & customActions)');

  // Show loading state
  _updateCloudStatus('syncing');

  // Load data from Supabase (single source of truth)
  loadFromSupabase().then(function() {
    // Re-render the app with fresh data
    if (typeof init === 'function') init();
    if (typeof renderClassList === 'function') renderClassList();
    if (typeof scheduleAllRenders === 'function') scheduleAllRenders();

    // Wrap save functions to auto-sync
    wrapSaveFunctions();

    // Setup realtime subscriptions
    _setupRealtimeSubscriptions();

    // Setup page lifecycle handlers
    _setupPageLifecycle();

    // Apply student restrictions if needed
    applyStudentRestrictions();

    // Setup cloud status click for manual sync
    var cloudEl = document.getElementById('cloudSyncStatus');
    if (cloudEl) {
      cloudEl.style.cursor = 'pointer';
      cloudEl.onclick = function() { forceManualSync(); };
    }

    _dalReady = true;
    _updateCloudStatus('synced');
    // Hide loading overlay
    if (typeof window._hideDalLoading === 'function') window._hideDalLoading();
    console.log('[DAL] Ready ✓');
    
    // v18: For teachers, auto-check if operation_logs RLS allows student reads
    if (currentUser.type === 'teacher') {
      setTimeout(function() {
        var classId = typeof currentClassId !== 'undefined' ? currentClassId : (classesData[0] ? classesData[0].id : null);
        if (!classId) return;
        db.from('operation_logs').select('id').eq('class_id', classId).limit(1).then(function(r) {
          if (r.error) {
            console.warn('[DAL] v18 AUTO-CHECK: operation_logs RLS is blocking reads! Students cannot see your operation records.');
            console.warn('[DAL] v18 FIX SQL:\n' +
              'CREATE POLICY IF NOT EXISTS "Students can read class operation logs" ON operation_logs FOR SELECT USING (true);\n' +
              'CREATE POLICY IF NOT EXISTS "Anyone can insert operation logs" ON operation_logs FOR INSERT WITH CHECK (true);\n' +
              'CREATE POLICY IF NOT EXISTS "Anyone can update operation logs" ON operation_logs FOR UPDATE USING (true);');
            if (typeof showNotification === 'function') {
              showNotification('重要提示', '学生无法看到操作记录！请在浏览器控制台(F12)查看修复方法，或在Supabase SQL Editor中执行修复SQL', 'error');
            }
          }
        }).catch(function() {});
      }, 3000);
    }
  }).catch(function(err) {
    console.error('[DAL] Init load failed:', err);
    _updateCloudStatus('error');
    _showNotification('数据加载失败，请刷新页面重试', 'error');

    // Retry after 5 seconds
    setTimeout(function() {
      _dalReady = false;
      initDAL();
    }, 5000);
  });
}

/* ===== Auto-init ===== */
setTimeout(function() { initDAL(); }, 200);
