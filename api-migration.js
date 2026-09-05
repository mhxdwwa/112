/**
 * API Migration Layer - 服务端 API 调用层
 * 
 * 将前端数据操作从直接写 Supabase 迁移到通过 Cloudflare Worker API
 * 
 * 特性：
 * - 使用相对路径 /api/xxx 调用（前后端同域名）
 * - API 失败时自动回退到旧方式（直接写 Supabase）
 * - 保持本地日志系统正常工作
 * 
 * 开关：window.USE_API = true 启用 API 模式，false 使用旧方式
 */

(function() {
  'use strict';

  // ============================================================
  // 配置
  // ============================================================
  
  // API 模式开关（默认启用）
  if (typeof window.USE_API === 'undefined') {
    window.USE_API = true;
  }

  // API 基础 URL
  // v142: 使用相对路径，走 Cloudflare Pages Functions（同域名，无跨域问题）
  var API_BASE = '/api';

  // ============================================================
  // 辅助函数
  // ============================================================

  /**
   * 发送 API 请求
   */
  function apiRequest(endpoint, data) {
    return fetch(API_BASE + endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(function(res) {
      var ct = res.headers.get('content-type') || '';
      if (ct.indexOf('application/json') === -1) {
        // API returned HTML or other non-JSON (e.g. SPA fallback)
        console.error('[API] Non-JSON response from', endpoint, ':', ct);
        return { error: 'Server returned non-JSON response (status ' + res.status + ')' };
      }
      return res.json();
    });
  }

  /**
   * 获取当前班级 ID
   */
  function getCurrentClassId() {
    return typeof currentClassId !== 'undefined' ? currentClassId : null;
  }

  /**
   * 获取当前用户信息
   */
  function getCurrentUser() {
    return typeof currentUser !== 'undefined' ? currentUser : null;
  }

  // ============================================================
  // 金币操作 API
  // ============================================================

  /**
   * 通过 API 修改学生金币
   * 
   * @param {Object} student - 学生对象
   * @param {number} delta - 金币变化量（正数加，负数减）
   * @param {string} actionType - 操作类型（如 '奖励', '惩罚', '答题'）
   * @param {string} details - 操作详情
   * @param {number} expDelta - 经验变化量
   * @param {number} petId - 关联的宠物 ID
   * @param {Object} extra - 额外数据
   * @returns {Promise<Object>} - { ok, coinsBefore, coinsAfter, logId } 或 { error }
   */
  function changeStudentCoinsViaApi(student, delta, actionType, details, expDelta, petId, extra) {
    if (!student || !student.id) {
      return Promise.resolve({ error: 'Invalid student' });
    }

    var classId = getCurrentClassId();
    var user = getCurrentUser();

    return apiRequest('/coins', {
      studentId: student.id,
      delta: delta,
      actionType: actionType || '',
      details: details || '',
      classId: classId,
      studentName: student.name || '',
      expDelta: expDelta || 0,
      petId: petId || null,
      checkBalance: delta < 0  // 扣款时检查余额
    }).then(function(result) {
      if (result.ok) {
        // 更新本地数据
        student.coins = result.coinsAfter;
        
        // 记录本地日志（保持撤销/恢复功能）
        if (typeof recordAction === 'function') {
          recordAction(student.id, student.name, actionType, details, delta, expDelta || 0, petId || null, extra || null);
        }
        
        console.log('[API] coins ok:', student.name, delta, '->', result.coinsAfter);
      } else if (result.error === 'Insufficient balance') {
        console.warn('[API] coins insufficient balance:', student.name);
        if (typeof showNotification === 'function') {
          showNotification('金币不足', '余额不足，无法完成操作', 'error');
        }
      } else {
        console.error('[API] coins error:', result.error);
      }
      return result;
    }).catch(function(err) {
      console.error('[API] coins request failed:', err);
      return { error: err.message || 'Network error' };
    });
  }

  // ============================================================
  // 宠物操作 API
  // ============================================================

  /**
   * 通过 API 同时修改金币和宠物
   * 用于喂食、玩耍、散步、逛街、旅游、复活等
   * 
   * @param {Object} student - 学生对象
   * @param {number} coinDelta - 金币变化量
   * @param {Array} petUpdates - 宠物更新列表 [{ petId, updates: { growth, level, ... } }]
   * @param {Object} options - 选项 { actionType, details, expDelta, petId, extra, checkBalance }
   * @returns {Promise<Object>}
   */
  function coinsAndPetViaApi(student, coinDelta, petUpdates, options) {
    if (!student || !student.id) {
      return Promise.resolve({ error: 'Invalid student' });
    }

    var classId = getCurrentClassId();
    var opts = options || {};

    return apiRequest('/student/coins-and-pet', {
      studentId: student.id,
      coinDelta: coinDelta,
      petUpdates: petUpdates || [],
      checkBalance: opts.checkBalance !== false && coinDelta < 0,
      actionType: opts.actionType || '',
      details: opts.details || '',
      classId: classId,
      studentName: student.name || '',
      expDelta: opts.expDelta || 0,
      petId: opts.petId || null
    }).then(function(result) {
      if (result.ok) {
        // 更新本地数据
        student.coins = result.coinsAfter;
        
        // 更新宠物本地数据
        if (petUpdates && student.pets) {
          petUpdates.forEach(function(pu) {
            var pet = student.pets.find(function(p) { return p.id === pu.petId; });
            if (pet && pu.updates) {
              if (pu.updates.growth !== undefined) pet.growth = pu.updates.growth;
              if (pu.updates.level !== undefined) pet.level = pu.updates.level;
              if (pu.updates.is_dead !== undefined) pet.isDead = pu.updates.is_dead;
              if (pu.updates.last_feed_date) pet.lastFeedDate = pu.updates.last_feed_date;
              if (pu.updates.last_play_date) pet.lastPlayDate = pu.updates.last_play_date;
              if (pu.updates.nickname) pet.nickname = pu.updates.nickname;
            }
          });
        }
        
        // 记录本地日志
        if (typeof recordAction === 'function') {
          recordAction(student.id, student.name, opts.actionType, opts.details, 
                      coinDelta, opts.expDelta || 0, opts.petId || null, opts.extra || null);
        }
        
        console.log('[API] coins-and-pet ok:', student.name, 'coins:', coinDelta);
      } else if (result.error === 'Insufficient balance') {
        console.warn('[API] coins-and-pet insufficient balance');
        if (typeof showNotification === 'function') {
          showNotification('金币不足', '余额不足，无法完成操作', 'error');
        }
      } else {
        console.error('[API] coins-and-pet error:', result.error);
      }
      return result;
    }).catch(function(err) {
      console.error('[API] coins-and-pet request failed:', err);
      return { error: err.message || 'Network error' };
    });
  }

  /**
   * 通过 API 更新宠物字段
   */
  function updatePetViaApi(petId, updates) {
    if (!petId) {
      return Promise.resolve({ error: 'Invalid petId' });
    }

    return apiRequest('/pet/update', {
      petId: petId,
      updates: updates
    }).then(function(result) {
      if (result.ok) {
        console.log('[API] pet update ok:', petId);
      } else {
        console.error('[API] pet update error:', result.error);
      }
      return result;
    }).catch(function(err) {
      console.error('[API] pet update request failed:', err);
      return { error: err.message || 'Network error' };
    });
  }

  /**
   * 通过 API 删除宠物
   */
  function deletePetViaApi(petId) {
    if (!petId) {
      return Promise.resolve({ error: 'Invalid petId' });
    }

    return apiRequest('/pet/delete', {
      petId: petId
    }).then(function(result) {
      if (result.ok) {
        console.log('[API] pet delete ok:', petId);
      } else {
        console.error('[API] pet delete error:', result.error);
      }
      return result;
    }).catch(function(err) {
      console.error('[API] pet delete request failed:', err);
      return { error: err.message || 'Network error' };
    });
  }

  /**
   * 通过 API 领养新宠物
   */
  function insertPetViaApi(studentId, petData) {
    if (!studentId || !petData) {
      return Promise.resolve({ error: 'Invalid data' });
    }

    // v144: 修复参数映射 — 端点期望 student_id 和顶层字段
    return apiRequest('/pet/insert', {
      student_id: studentId,
      name: petData.name,
      nickname: petData.nickname || '',
      level: petData.level || 1,
      growth: petData.growth || 0,
      coins: petData.coins || 0,
      is_active: petData.is_active || false,
      is_dead: petData.is_dead || false
    }).then(function(result) {
      if (result.ok) {
        console.log('[API] pet insert ok:', studentId);
      } else {
        console.error('[API] pet insert error:', result.error);
      }
      return result;
    }).catch(function(err) {
      console.error('[API] pet insert request failed:', err);
      return { error: err.message || 'Network error' };
    });
  }

  // ============================================================
  // 班级管理 API
  // ============================================================

  /**
   * 通过 API 加载班级数据
   */
  function loadClassViaApi(classId) {
    return fetch(API_BASE + '/class/' + classId)
      .then(function(res) { return res.json(); })
      .then(function(result) {
        if (result.ok) {
          console.log('[API] load class ok:', classId);
          return result.data;
        } else {
          console.error('[API] load class error:', result.error);
          return null;
        }
      })
      .catch(function(err) {
        console.error('[API] load class request failed:', err);
        return null;
      });
  }

  /**
   * 通过 API 管理班级（增删改）
   * v149: 发送扁平参数，与服务端解构格式一致
   */
  function manageClassViaApi(action, data) {
    var payload = { action: action };
    if (data) {
      // 将 data 中的字段展开到顶层
      Object.keys(data).forEach(function(key) {
        payload[key] = data[key];
      });
    }
    return apiRequest('/class/manage', payload).then(function(result) {
      if (result.ok) {
        console.log('[API] class manage ok:', action);
      } else {
        console.error('[API] class manage error:', result.error);
      }
      return result;
    }).catch(function(err) {
      console.error('[API] class manage request failed:', err);
      return { error: err.message || 'Network error' };
    });
  }

  /**
   * 通过 API 检查班级名称是否重复
   */
  function checkClassDuplicateViaApi(name) {
    return apiRequest('/class/manage', {
      action: 'checkDuplicate',
      name: name
    }).then(function(result) {
      return result;
    }).catch(function(err) {
      console.error('[API] checkClassDuplicate failed:', err);
      return { error: err.message || 'Network error' };
    });
  }

  /**
   * 通过 API 重置班级所有学生数据
   */
  function resetClassViaApi(classId) {
    return apiRequest('/class/reset', {
      classId: classId
    }).then(function(result) {
      if (result.ok) {
        console.log('[API] class reset ok:', classId, 'reset', result.resetStudents, 'students');
      } else {
        console.error('[API] class reset error:', result.error);
      }
      return result;
    }).catch(function(err) {
      console.error('[API] class reset request failed:', err);
      return { error: err.message || 'Network error' };
    });
  }

  // ============================================================
  // 学生管理 API
  // ============================================================

  /**
   * 通过 API 更新学生字段
   */
  function updateStudentViaApi(studentId, updates) {
    if (!studentId) {
      return Promise.resolve({ error: 'Invalid studentId' });
    }

    return apiRequest('/student/update', {
      studentId: studentId,
      updates: updates
    }).then(function(result) {
      if (result.ok) {
        console.log('[API] student update ok:', studentId);
      } else {
        console.error('[API] student update error:', result.error);
      }
      return result;
    }).catch(function(err) {
      console.error('[API] student update request failed:', err);
      return { error: err.message || 'Network error' };
    });
  }

  /**
   * 通过 API 管理学生（增删改密码）
   * v149: 发送扁平参数，与服务端解构格式一致
   */
  function manageStudentViaApi(action, data) {
    var payload = { action: action };
    if (data) {
      Object.keys(data).forEach(function(key) {
        payload[key] = data[key];
      });
    }
    return apiRequest('/student/manage', payload).then(function(result) {
      if (result.ok) {
        console.log('[API] student manage ok:', action);
      } else {
        console.error('[API] student manage error:', result.error);
      }
      return result;
    }).catch(function(err) {
      console.error('[API] student manage request failed:', err);
      return { error: err.message || 'Network error' };
    });
  }

  // ============================================================
  // 操作日志 API
  // ============================================================

  /**
   * 通过 API 追加操作日志
   */
  function appendLogViaApi(log) {
    return apiRequest('/logs/append', {
      log: log
    }).then(function(result) {
      if (result.ok) {
        console.log('[API] log append ok');
      } else {
        console.error('[API] log append error:', result.error);
      }
      return result;
    }).catch(function(err) {
      console.error('[API] log append request failed:', err);
      return { error: err.message || 'Network error' };
    });
  }

  /**
   * 通过 API 撤销/恢复日志
   * v149: 发送服务端所需的全部字段
   */
  function revertLogViaApi(params) {
    // params: { classId, logId, reverted, coinDelta, studentId, petUpdates }
    return apiRequest('/logs/revert', {
      classId: params.classId,
      logId: params.logId,
      reverted: params.reverted !== undefined ? params.reverted : true,
      coinDelta: params.coinDelta || 0,
      studentId: params.studentId,
      petUpdates: params.petUpdates || []
    }).then(function(result) {
      if (result.ok) {
        console.log('[API] log revert ok:', params.logId);
      } else {
        console.error('[API] log revert error:', result.error);
      }
      return result;
    }).catch(function(err) {
      console.error('[API] log revert request failed:', err);
      return { error: err.message || 'Network error' };
    });
  }

  // ============================================================
  // 零食铺 API
  // ============================================================

  /**
   * 通过 API 审批零食申请
   */
  function approveSnackViaApi(data) {
    return apiRequest('/snack/approve', data)
      .then(function(result) {
        if (result.ok) {
          console.log('[API] snack approve ok');
        } else {
          console.error('[API] snack approve error:', result.error);
        }
        return result;
      })
      .catch(function(err) {
        console.error('[API] snack approve request failed:', err);
        return { error: err.message || 'Network error' };
      });
  }

  // ============================================================
  // 自定义奖惩 API
  // ============================================================

  /**
   * 通过 API 保存自定义奖惩动作
   */
  function saveCustomActionViaApi(data) {
    return apiRequest('/custom-actions/save', data)
      .then(function(result) {
        if (result.ok) {
          console.log('[API] custom action save ok');
        } else {
          console.error('[API] custom action save error:', result.error);
        }
        return result;
      })
      .catch(function(err) {
        console.error('[API] custom action save request failed:', err);
        return { error: err.message || 'Network error' };
      });
  }

  // ============================================================
  // 数据加载 API（替代 dal.js 直接连 Supabase）
  // ============================================================

  /**
   * 通过 API 加载教师所有班级（含学生、宠物、自定义奖惩）
   * 替代 _loadTeacherFromSupabase() 中的 db.from('classes/students/pets')
   */
  function loadAllClassesViaApi(teacherId) {
    if (!teacherId) {
      return Promise.resolve({ error: 'Missing teacherId' });
    }
    return fetch(API_BASE + '/classes?teacherId=' + encodeURIComponent(teacherId))
      .then(function(res) { return res.json(); })
      .then(function(data) {
        console.log('[API] loadAllClasses ok:', (data.classes || []).length, 'classes');
        return data;
      })
      .catch(function(err) {
        console.error('[API] loadAllClasses failed:', err);
        return { error: err.message || 'Network error' };
      });
  }

  /**
   * 通过 API 刷新单个班级数据（用于轮询替代 Realtime）
   * 替代 _smartRefreshFromSupabase() 中的 db.from() 调用
   */
  function refreshClassViaApi(classId) {
    if (!classId) {
      return Promise.resolve({ error: 'Missing classId' });
    }
    return fetch(API_BASE + '/class/' + classId)
      .then(function(res) { return res.json(); })
      .then(function(data) {
        console.log('[API] refreshClass ok:', classId);
        return data;
      })
      .catch(function(err) {
        console.error('[API] refreshClass failed:', err);
        return { error: err.message || 'Network error' };
      });
  }

  /**
   * 通过 API 加载操作日志
   * 替代 _loadOperationLogs() 中的 db.from('classes').select('operation_logs_json')
   */
  function loadLogsViaApi(classId) {
    if (!classId) {
      return Promise.resolve({ error: 'Missing classId' });
    }
    return fetch(API_BASE + '/logs?classId=' + encodeURIComponent(classId))
      .then(function(res) { return res.json(); })
      .then(function(data) {
        return data;
      })
      .catch(function(err) {
        console.error('[API] loadLogs failed:', err);
        return { error: err.message || 'Network error' };
      });
  }

  // ============================================================
  // 认证 API（替代 auth-check.js 直接连 Supabase Auth）
  // ============================================================

  /**
   * 通过 API 验证登录身份
   * 教师：验证 Supabase Auth session
   * 学生：验证学生记录是否存在
   */
  function authVerifyViaApi(data) {
    return apiRequest('/auth/verify', data)
      .then(function(result) {
        return result;
      })
      .catch(function(err) {
        console.error('[API] authVerify failed:', err);
        return { ok: false, reason: err.message || 'Network error' };
      });
  }

  // ============================================================
  // 批量日志 API
  // ============================================================

  /**
   * 通过 API 批量追加操作日志
   * 替代学生端直接 RPC 调用 append_pending_log
   */
  function appendLogsBulkViaApi(classId, logs) {
    if (!classId || !logs || logs.length === 0) {
      return Promise.resolve({ ok: true, appended: 0 });
    }
    return apiRequest('/logs/append-bulk', {
      classId: classId,
      logs: logs
    }).then(function(result) {
      if (result.ok) {
        console.log('[API] logs bulk append ok:', result.appended, 'logs');
      } else {
        console.error('[API] logs bulk append error:', result.error);
      }
      return result;
    }).catch(function(err) {
      console.error('[API] logs bulk append failed:', err);
      return { error: err.message || 'Network error' };
    });
  }

  // ============================================================
  // 健康检查
  // ============================================================

  /**
   * 检查 API 是否可用
   */
  function checkApiHealth() {
    return fetch(API_BASE + '/health')
      .then(function(res) { return res.json(); })
      .then(function(result) {
        return result.status === 'ok';
      })
      .catch(function() {
        return false;
      });
  }

  // ============================================================
  // 游戏状态保存 API（取金阁、小猪快跑、快乐跑等）
  // ============================================================

  /**
   * 通过 API 保存游戏状态 + 金币
   * 替代 quiz.js 中 saveCoinsAndQuizState() 的直接 Supabase 写入
   */
  function saveQuizStateViaApi(studentId, coins, quizState) {
    if (!studentId) {
      return Promise.resolve({ error: 'Invalid studentId' });
    }
    var updates = {};
    if (coins !== undefined && coins !== null) {
      updates.coins = coins;
    }
    if (quizState !== undefined && quizState !== null) {
      updates.quiz_state = typeof quizState === 'string' ? quizState : JSON.stringify(quizState);
    }
    return apiRequest('/student/update', {
      studentId: studentId,
      updates: updates
    }).then(function(result) {
      if (result.ok) {
        console.log('[API] quiz state save ok:', studentId);
      } else {
        console.error('[API] quiz state save error:', result.error);
      }
      return result;
    }).catch(function(err) {
      console.error('[API] quiz state save failed:', err);
      return { error: err.message || 'Network error' };
    });
  }

  // ============================================================
  // 商店状态保存 API
  // ============================================================

  /**
   * 通过 API 保存商店购买状态（shopItems + equippedItems）
   */
  function saveShopStateViaApi(studentId, shopItems, equippedItems) {
    if (!studentId) {
      return Promise.resolve({ error: 'Invalid studentId' });
    }
    var updates = {};
    if (shopItems !== undefined) {
      updates.shop_items = typeof shopItems === 'string' ? shopItems : JSON.stringify(shopItems);
    }
    if (equippedItems !== undefined) {
      updates.equipped_items = typeof equippedItems === 'string' ? equippedItems : JSON.stringify(equippedItems);
    }
    return apiRequest('/student/update', {
      studentId: studentId,
      updates: updates
    }).then(function(result) {
      if (result.ok) {
        console.log('[API] shop state save ok:', studentId);
      } else {
        console.error('[API] shop state save error:', result.error);
      }
      return result;
    }).catch(function(err) {
      console.error('[API] shop state save failed:', err);
      return { error: err.message || 'Network error' };
    });
  }

  // ============================================================
  // 恢复宠物 API（upsert，用于撤销删除宠物）
  // ============================================================

  /**
   * 通过 API 恢复被删除的宠物（upsert）
   * 与 insertPet 不同：接受完整的宠物数据（含 id），尝试恢复原始 ID
   */
  function upsertPetViaApi(petData) {
    if (!petData || !petData.student_id) {
      return Promise.resolve({ error: 'Invalid pet data' });
    }
    return apiRequest('/pet/insert', {
      id: petData.id,
      student_id: petData.student_id,
      name: petData.name,
      nickname: petData.nickname || '',
      level: petData.level || 1,
      growth: petData.growth || 0,
      coins: petData.coins || 0,
      is_active: petData.is_active || false,
      is_dead: petData.is_dead || false,
      last_feed_date: petData.last_feed_date || null,
      last_play_date: petData.last_play_date || null,
      today_feed_count: petData.today_feed_count || 0,
      today_play_count: petData.today_play_count || 0,
      penalty_streak: petData.penalty_streak || 0
    }).then(function(result) {
      if (result.ok) {
        console.log('[API] pet upsert ok:', petData.id);
      } else {
        console.error('[API] pet upsert error:', result.error);
      }
      return result;
    }).catch(function(err) {
      console.error('[API] pet upsert failed:', err);
      return { error: err.message || 'Network error' };
    });
  }

  // ============================================================
  // 导出到全局
  // ============================================================

  window.ApiMigration = {
    // 配置
    USE_API: window.USE_API,
    
    // 金币
    changeStudentCoins: changeStudentCoinsViaApi,
    
    // 宠物
    coinsAndPet: coinsAndPetViaApi,
    updatePet: updatePetViaApi,
    insertPet: insertPetViaApi,
    deletePet: deletePetViaApi,
    upsertPet: upsertPetViaApi,
    
    // 班级
    loadClass: loadClassViaApi,
    loadAllClasses: loadAllClassesViaApi,
    refreshClass: refreshClassViaApi,
    manageClass: manageClassViaApi,
    checkClassDuplicate: checkClassDuplicateViaApi,
    resetClass: resetClassViaApi,
    
    // 学生
    updateStudent: updateStudentViaApi,
    manageStudent: manageStudentViaApi,
    
    // 日志
    appendLog: appendLogViaApi,
    appendLogsBulk: appendLogsBulkViaApi,
    loadLogs: loadLogsViaApi,
    revertLog: revertLogViaApi,
    
    // 认证
    authVerify: authVerifyViaApi,
    
    // 零食铺
    approveSnack: approveSnackViaApi,
    
    // 自定义奖惩
    saveCustomAction: saveCustomActionViaApi,
    
    // 游戏状态
    saveQuizState: saveQuizStateViaApi,
    
    // 商店状态
    saveShopState: saveShopStateViaApi,
    
    // 健康检查
    checkHealth: checkApiHealth
  };

  console.log('[API Migration] Loaded, USE_API =', window.USE_API);

})();
