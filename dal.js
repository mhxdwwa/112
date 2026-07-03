/**
 * dal.js v4.0 — Clean Data Access Layer
 * 
 * Architecture: Supabase as single source of truth
 * - No localStorage for business data
 * - No complex merge logic
 * - Targeted save operations
 * - Realtime subscriptions for live sync
 * 
 * Flow: loadFromSupabase() → classesData → UI
 *       UI action → saveClassData() → _syncToSupabase() → Supabase
 */

/* ===== State ===== */
var _dalReady = false;
var _dalSyncing = false;
var _dalSyncQueued = false;
var _refreshTimer = null;
var _refreshInterval = 30000;
var _lastRefreshTime = 0;
var _realtimeChannels = [];
var _syncRetryCount = 0;
var _maxRetries = 3;
var _lastSyncFailed = false;
var _DAL_VERSION = '4.0';

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

function _loadOperationLogs() {
  if (!currentUser || !currentUser.id) return Promise.resolve();
  return db.from('classes').select('id').eq('teacher_id', currentUser.id).then(function(classR) {
    if (classR.error || !classR.data) return;
    var classIds = classR.data.map(function(c) { return c.id; });
    if (classIds.length === 0) return;
    return db.from('operation_logs').select('*').in('class_id', classIds).order('created_at', { ascending: false }).limit(500);
  }).then(function(r) {
    if (r && r.data && typeof operationLogs !== 'undefined') {
      operationLogs = r.data;
    }
  }).catch(function(e) { console.warn('[DAL] operation_logs load error:', e); });
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
  var promises = [];

  classesData.forEach(function(cls) {
    // Upsert class
    promises.push(
      db.from('classes').upsert([{
        id: cls.id,
        name: cls.name,
        teacher_id: currentUser.id
      }]).then(function(r) {
        if (r.error) console.error('[DAL] class upsert error:', r.error);
      })
    );

    // Process students
    cls.students.forEach(function(stu) {
      var studentPayload = {
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
        // Existing student with valid Supabase ID — update
        studentPayload.id = stu.id;
        promises.push(
          db.from('students').upsert([studentPayload]).then(function(r) {
            if (r.error) console.error('[DAL] student upsert error:', r.error);
          })
        );
      } else {
        // New student — insert without ID
        promises.push(
          db.from('students').insert([studentPayload]).select().then(function(r) {
            if (r.error) {
              console.error('[DAL] student insert error:', r.error);
              return;
            }
            if (r.data && r.data[0]) {
              var newId = r.data[0].id;
              // Update in-memory ID so subsequent saves use the real ID
              stu.id = newId;
              console.log('[DAL] New student "' + stu.name + '" got Supabase ID: ' + newId);
            }
          })
        );
      }

      // Process pets for this student
      if (stu.pets && stu.pets.length > 0) {
        stu.pets.forEach(function(pet) {
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
            petPayload.id = pet.id;
            promises.push(
              db.from('pets').upsert([petPayload]).then(function(r) {
                if (r.error) console.error('[DAL] pet upsert error:', r.error);
              })
            );
          } else {
            promises.push(
              db.from('pets').insert([petPayload]).select().then(function(r) {
                if (r.error) {
                  console.error('[DAL] pet insert error:', r.error);
                  return;
                }
                if (r.data && r.data[0]) {
                  pet.id = r.data[0].id;
                  console.log('[DAL] New pet "' + pet.name + '" got Supabase ID: ' + pet.id);
                }
              })
            );
          }
        });
      }
    });
  });

  // Save custom actions (per-class)
  if (typeof customActions !== 'undefined' && customActions.length > 0) {
    var actionPayloads = customActions.map(function(a) {
      return {
        class_id: a.class_id || (classesData[0] ? classesData[0].id : null),
        name: a.name,
        coins: a.coins || 0
      };
    }).filter(function(a) { return a.class_id; });
    if (actionPayloads.length > 0) {
      var classIds = [...new Set(actionPayloads.map(function(a) { return a.class_id; }))];
      promises.push(
        db.from('custom_actions').delete().in('class_id', classIds).then(function() {
          return db.from('custom_actions').insert(actionPayloads);
        }).then(function(r) {
          if (r.error) console.error('[DAL] custom_actions save error:', r.error);
        })
      );
    }
  }

  return Promise.all(promises);
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

  var promises = [];

  // Update own student record
  promises.push(
    db.from('students').upsert([{
      id: studentId,
      coins: myStudent.coins,
      shop_items: JSON.stringify(myStudent.shopItems || []),
      equipped_items: JSON.stringify(myStudent.equippedItems || {}),
      last_checkin_date: myStudent.lastCheckinDate || null,
      last_jianghu_date: myStudent.lastJianghuDate || null,
      last_pk_date: myStudent.lastPkDate || null,
      active_pet_id: myStudent.activePetId || null,
      pk_count_today: myStudent.pkCountToday || 0
    }]).then(function(r) {
      if (r.error) console.error('[DAL] student sync error:', r.error);
    })
  );

  // Upsert own pets
  if (myStudent.pets && myStudent.pets.length > 0) {
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
        payload.id = pet.id;
      }
      promises.push(
        db.from('pets').upsert([payload]).then(function(r) {
          if (r.error) console.error('[DAL] pet sync error:', r.error);
          if (r.data && r.data[0] && !pet.id) {
            pet.id = r.data[0].id;
          }
        })
      );
    });
  }

  return Promise.all(promises);
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
    _dalSyncing = false;
    _syncRetryCount = 0;
    _lastSyncFailed = false;
    _updateCloudStatus('synced');
    console.log('[DAL] Sync complete');

    if (_dalSyncQueued) {
      _dalSyncQueued = false;
      return _syncToSupabase();
    }
  }).catch(function(err) {
    _dalSyncing = false;
    _lastSyncFailed = true;
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
    return _refreshFromSupabase();
  });
}

/* ===== Realtime ===== */
function _refreshFromSupabase() {
  var now = Date.now();
  if (now - _lastRefreshTime < 2000) return; // debounce 2s
  _lastRefreshTime = now;

  console.log('[DAL] Refreshing from Supabase...');
  loadFromSupabase().then(function() {
    if (typeof init === 'function') init();
    if (typeof renderClassList === 'function') renderClassList();
    if (typeof scheduleAllRenders === 'function') scheduleAllRenders();
    console.log('[DAL] Refresh complete');
  }).catch(function(e) {
    console.error('[DAL] Refresh error:', e);
  });
}

function _setupRealtimeSubscriptions() {
  if (!db || !db.channel) return;

  try {
    // Subscribe to classes table
    var classChannel = db.channel('dal-classes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'classes' }, function() {
        _lastRefreshTime = 0;
        _refreshFromSupabase();
      })
      .subscribe();
    _realtimeChannels.push(classChannel);

    // Subscribe to students table
    var studentChannel = db.channel('dal-students')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'students' }, function() {
        _lastRefreshTime = 0;
        _refreshFromSupabase();
      })
      .subscribe();
    _realtimeChannels.push(studentChannel);

    // Subscribe to pets table
    var petChannel = db.channel('dal-pets')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pets' }, function() {
        _lastRefreshTime = 0;
        _refreshFromSupabase();
      })
      .subscribe();
    _realtimeChannels.push(petChannel);

    console.log('[DAL] Realtime subscriptions active');
  } catch (e) {
    console.warn('[DAL] Realtime setup failed, using polling fallback:', e);
  }

  // Fallback polling (30s interval)
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

  // Sync on visibility change
  document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
      // Page going hidden — sync if needed
      if (!_dalSyncing) _syncToSupabase();
    } else {
      // Page becoming visible — refresh data
      _refreshFromSupabase();
    }
  });
}

/* ===== Wrap Save Functions ===== */
function wrapSaveFunctions() {
  // Wrap saveClassData
  if (typeof saveClassData === 'function' && !saveClassData._dalWrapped) {
    var origSaveClassData = saveClassData;
    saveClassData = function() {
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
      origSaveCustomActions.apply(this, arguments);
      _updateCloudStatus('syncing');
      _syncToSupabase();
    };
    saveCustomActions._dalWrapped = true;
  }

  // Wrap saveLogs
  if (typeof saveLogs === 'function' && !saveLogs._dalWrapped) {
    var origSaveLogs = saveLogs;
    saveLogs = function() {
      origSaveLogs.apply(this, arguments);
      // Logs are saved but we don't sync them to Supabase for now
      // to reduce load. Can be added later if needed.
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

  // Hide pet shop buttons
  document.querySelectorAll('button[onclick*="showPetShopBrowse"]').forEach(function(el) {
    el.style.display = 'none';
  });

  // Hide deleted classes link
  document.querySelectorAll('[onclick*="showDeletedClassesModal"]').forEach(function(el) {
    el.style.display = 'none';
  });

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
    operationLogs: typeof operationLogs !== 'undefined' ? operationLogs : [],
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

  // Clean up stale localStorage business data (no longer used)
  var staleKeys = ['classPetData', '_dalDeletedClassIds', '_dalIdMap', '_dal_unsyncedFlag', 'deletedClasses', 'customActions', 'operationLogs', 'logArchives'];
  staleKeys.forEach(function(key) {
    try { localStorage.removeItem(key); } catch(e) {}
  });
  console.log('[DAL] Cleaned stale localStorage keys');

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
