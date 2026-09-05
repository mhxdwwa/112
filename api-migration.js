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
  // v141: 使用完整 URL，因为 Pages 和 Workers 不在同域名
  var API_BASE = 'https://bjcw.444522621.workers.dev/api';

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
   * 通过 API 领养新宠物
   */
  function insertPetViaApi(studentId, petData) {
    if (!studentId || !petData) {
      return Promise.resolve({ error: 'Invalid data' });
    }

    return apiRequest('/pet/insert', {
      studentId: studentId,
      petData: petData
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
   */
  function manageClassViaApi(action, data) {
    return apiRequest('/class/manage', {
      action: action,
      data: data
    }).then(function(result) {
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
   */
  function manageStudentViaApi(action, data) {
    return apiRequest('/student/manage', {
      action: action,
      data: data
    }).then(function(result) {
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
   */
  function revertLogViaApi(logId) {
    return apiRequest('/logs/revert', {
      logId: logId
    }).then(function(result) {
      if (result.ok) {
        console.log('[API] log revert ok:', logId);
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
    
    // 班级
    loadClass: loadClassViaApi,
    manageClass: manageClassViaApi,
    
    // 学生
    updateStudent: updateStudentViaApi,
    manageStudent: manageStudentViaApi,
    
    // 日志
    appendLog: appendLogViaApi,
    revertLog: revertLogViaApi,
    
    // 零食铺
    approveSnack: approveSnackViaApi,
    
    // 自定义奖惩
    saveCustomAction: saveCustomActionViaApi,
    
    // 健康检查
    checkHealth: checkApiHealth
  };

  console.log('[API Migration] Loaded, USE_API =', window.USE_API);

})();
