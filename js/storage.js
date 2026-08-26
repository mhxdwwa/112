/* ===== storage.js — IndexedDB 存储层 =====
 * v1: 从 localStorage 迁移到 IndexedDB
 * - IndexedDB 容量通常 50MB+，不再有 5MB 限制
 * - 异步写入，不阻塞 UI
 * - 首次加载自动迁移 localStorage 数据
 * - 保留 localStorage 作为快速首屏缓存（只存小数据）
 */

'use strict';

var StorageDB = (function() {
  var DB_NAME = 'mhxdwwa_storage';
  var DB_VERSION = 1;
  var STORE_NAME = 'kv';
  var _db = null;
  var _ready = false;
  var _readyPromise = null;

  // 需要迁移到 IndexedDB 的大数据 key
  var MIGRATION_KEYS = [
    'classPetData',
    'operationLogs',
    'logArchives',
    'deletedClasses',
    'customActions'
  ];

  // ===== IndexedDB 基础操作 =====

  function openDB() {
    if (_readyPromise) return _readyPromise;
    _readyPromise = new Promise(function(resolve, reject) {
      if (!window.indexedDB) {
        console.warn('[StorageDB] IndexedDB not supported, falling back to localStorage');
        reject(new Error('IndexedDB not supported'));
        return;
      }
      var req;
      try {
        req = indexedDB.open(DB_NAME, DB_VERSION);
      } catch(e) {
        console.warn('[StorageDB] indexedDB.open failed:', e.message);
        reject(e);
        return;
      }
      req.onupgradeneeded = function(e) {
        var db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      req.onsuccess = function(e) {
        _db = e.target.result;
        _ready = true;
        console.log('[StorageDB] IndexedDB opened');
        resolve(_db);
      };
      req.onerror = function(e) {
        console.warn('[StorageDB] IndexedDB open error:', e.target.error);
        reject(e.target.error);
      };
    });
    return _readyPromise;
  }

  function idbGet(key) {
    return openDB().then(function(db) {
      return new Promise(function(resolve, reject) {
        try {
          var tx = db.transaction(STORE_NAME, 'readonly');
          var store = tx.objectStore(STORE_NAME);
          var req = store.get(key);
          req.onsuccess = function() { resolve(req.result); };
          req.onerror = function() { reject(req.error); };
        } catch(e) {
          reject(e);
        }
      });
    });
  }

  function idbSet(key, value) {
    return openDB().then(function(db) {
      return new Promise(function(resolve, reject) {
        try {
          var tx = db.transaction(STORE_NAME, 'readwrite');
          var store = tx.objectStore(STORE_NAME);
          var req = store.put(value, key);
          req.onsuccess = function() { resolve(); };
          req.onerror = function() { reject(req.error); };
        } catch(e) {
          reject(e);
        }
      });
    });
  }

  function idbDelete(key) {
    return openDB().then(function(db) {
      return new Promise(function(resolve, reject) {
        try {
          var tx = db.transaction(STORE_NAME, 'readwrite');
          var store = tx.objectStore(STORE_NAME);
          var req = store.delete(key);
          req.onsuccess = function() { resolve(); };
          req.onerror = function() { reject(req.error); };
        } catch(e) {
          reject(e);
        }
      });
    });
  }

  function idbKeys() {
    return openDB().then(function(db) {
      return new Promise(function(resolve, reject) {
        try {
          var tx = db.transaction(STORE_NAME, 'readonly');
          var store = tx.objectStore(STORE_NAME);
          var req = store.getAllKeys();
          req.onsuccess = function() { resolve(req.result || []); };
          req.onerror = function() { reject(req.error); };
        } catch(e) {
          reject(e);
        }
      });
    });
  }

  // ===== 迁移逻辑 =====

  /**
   * 从 localStorage 迁移大数据到 IndexedDB
   * 只在 IndexedDB 中没有对应 key 时才迁移
   */
  function migrateFromLocalStorage() {
    return openDB().then(function() {
      return idbKeys();
    }).then(function(existingKeys) {
      var promises = [];
      var migrated = [];

      MIGRATION_KEYS.forEach(function(key) {
        // 如果 IndexedDB 中已有此 key，跳过（IndexedDB 优先）
        if (existingKeys.indexOf(key) !== -1) return;

        // 从 localStorage 读取
        var raw;
        try { raw = localStorage.getItem(key); } catch(e) { return; }
        if (!raw) return;

        try {
          var data = JSON.parse(raw);
          promises.push(
            idbSet(key, data).then(function() {
              migrated.push(key);
            })
          );
        } catch(e) {
          console.warn('[StorageDB] Failed to parse localStorage key for migration:', key);
        }
      });

      return Promise.all(promises).then(function() {
        if (migrated.length > 0) {
          console.log('[StorageDB] Migrated from localStorage:', migrated.join(', '));
        }
        // 标记迁移完成
        return idbSet('_migrated', { ts: Date.now(), keys: migrated });
      });
    });
  }

  /**
   * 从 IndexedDB 加载数据到全局变量
   * 在页面初始化时调用，优先使用 IndexedDB 中的数据
   */
  function loadIntoGlobals() {
    return openDB().then(function() {
      var promises = MIGRATION_KEYS.map(function(key) {
        return idbGet(key).then(function(data) {
          return { key: key, data: data };
        }).catch(function() {
          return { key: key, data: undefined };
        });
      });
      return Promise.all(promises);
    }).then(function(results) {
      var loaded = [];
      results.forEach(function(r) {
        if (r.data === undefined || r.data === null) return;
        switch(r.key) {
          case 'classPetData':
            if (Array.isArray(r.data) && r.data.length > 0) {
              classesData = r.data;
              loaded.push('classPetData');
            }
            break;
          case 'operationLogs':
            if (Array.isArray(r.data)) {
              window.operationLogs = r.data;
              loaded.push('operationLogs');
            }
            break;
          case 'logArchives':
            if (typeof r.data === 'object' && !Array.isArray(r.data)) {
              logArchives = r.data;
              loaded.push('logArchives');
            }
            break;
          case 'deletedClasses':
            if (Array.isArray(r.data)) {
              deletedClasses = r.data;
              loaded.push('deletedClasses');
            }
            break;
          case 'customActions':
            if (Array.isArray(r.data)) {
              // 保留预设
              var needed = [{id: 'sys_reward_1', name: '完成作业', coins: 10},{id: 'sys_reward_2', name: '课堂发言', coins: 10}];
              needed.forEach(function(preset) {
                if (!r.data.some(function(a) { return a.id === preset.id; })) r.data.push(preset);
              });
              customActions = r.data;
              loaded.push('customActions');
            }
            break;
        }
      });
      if (loaded.length > 0) {
        console.log('[StorageDB] Loaded from IndexedDB:', loaded.join(', '));
      }
      return loaded;
    });
  }

  /**
   * 清理 localStorage 中的大数据（迁移完成后调用）
   * 保留小数据 key（userType, userId 等）
   */
  function cleanupLocalStorage() {
    MIGRATION_KEYS.forEach(function(key) {
      try { localStorage.removeItem(key); } catch(e) {}
    });
    // 也清理 DAL 缓存（已迁移到 IndexedDB）
    try { localStorage.removeItem('_dal_cache_v2'); } catch(e) {}
    console.log('[StorageDB] Cleaned up localStorage large keys');
  }

  // ===== 公开 API =====

  return {
    /** 初始化：打开 IndexedDB，执行迁移，加载数据 */
    init: function() {
      return openDB()
        .then(function() { return migrateFromLocalStorage(); })
        .then(function() { return loadIntoGlobals(); })
        .then(function(loaded) {
          // 如果成功从 IndexedDB 加载了数据，清理 localStorage 中的冗余
          if (loaded && loaded.length > 0) {
            cleanupLocalStorage();
          }
          return loaded;
        })
        .catch(function(err) {
          console.warn('[StorageDB] Init failed, continuing with localStorage:', err.message);
          return [];
        });
    },

    /** 异步保存到 IndexedDB（fire-and-forget） */
    save: function(key, data) {
      idbSet(key, data).catch(function(err) {
        console.warn('[StorageDB] Save failed (' + key + '):', err.message);
      });
    },

    /** 异步保存到 IndexedDB（返回 Promise） */
    saveAsync: function(key, data) {
      return idbSet(key, data);
    },

    /** 从 IndexedDB 读取 */
    load: function(key) {
      return idbGet(key);
    },

    /** 删除 */
    remove: function(key) {
      return idbDelete(key);
    },

    /** 获取所有 key */
    keys: function() {
      return idbKeys();
    },

    /** 检查 IndexedDB 是否就绪 */
    isReady: function() {
      return _ready;
    },

    /** DAL 缓存专用：保存到 IndexedDB */
    saveCache: function(payload) {
      return idbSet('_dal_cache_v2', payload);
    },

    /** DAL 缓存专用：从 IndexedDB 读取 */
    loadCache: function() {
      return idbGet('_dal_cache_v2');
    }
  };
})();

// 页面加载时自动初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() {
    StorageDB.init();
  });
} else {
  StorageDB.init();
}
