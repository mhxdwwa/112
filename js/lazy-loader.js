// ========== 按需加载器 v136 ==========
// 管理 JS 模块的延迟加载，减少首屏 JS 体积
(function() {
  'use strict';
  window.__lazyLoader = true;

  // 模块注册表：id → { src, deps, init }
  var _registry = {
    // --- 导航页模块 ---
    'pk-battle':       { src: 'js/pk-battle.js?v=171' },
    'class-pk':        { src: 'js/class-pk.js?v=157' },
    'jianghu':         { src: 'js/jianghu.js?v=171', deps: ['pk-battle'] },
    'rankings':        { src: 'js/rankings.js?v=136' },
    'library':         { src: 'js/library-system.js?v=136' },

    // --- 弹窗/按钮模块 ---
    'snack-system':    { src: 'js/snack-system.js?v=136' },
    'history-ui':      { src: 'js/history-ui.js?v=136' },
    'pet-modal':       { src: 'js/pet-modal.js?v=136' },
    'rank-announcement': { src: 'js/rank-announcement.js?v=136' },

    // --- 游戏模块 ---
    'quiz-bank':       { src: 'quiz-bank.js?v=2' },
    'quiz':            { src: 'quiz.js?v=166', deps: ['quiz-bank'] },
    'pig-run':         { src: 'pig-run.js?v=166' },
    'match3':          { src: 'match3.js?v=166' },
    'happy-run':       { src: 'happy-run.js?v=166' }
  };

  // 已加载/正在加载的模块
  var _loaded = {};
  var _loading = {};

  /**
   * 加载单个脚本，返回 Promise
   */
  function _loadScript(src) {
    return new Promise(function(resolve, reject) {
      var s = document.createElement('script');
      s.src = src;
      s.onload = function() { resolve(); };
      s.onerror = function() {
        console.warn('[lazy-loader] 加载失败:', src);
        resolve(); // 失败不阻塞，允许降级
      };
      document.head.appendChild(s);
    });
  }

  /**
   * 加载模块（含依赖），返回 Promise
   * @param {string} id - 模块 ID
   * @returns {Promise<void>}
   */
  window.loadModule = function(id) {
    // 已加载完成
    if (_loaded[id]) return Promise.resolve();
    // 正在加载中，复用同一个 Promise
    if (_loading[id]) return _loading[id];

    var mod = _registry[id];
    if (!mod) {
      console.warn('[lazy-loader] 未知模块:', id);
      return Promise.resolve();
    }

    var chain = Promise.resolve();

    // 先加载依赖
    if (mod.deps) {
      for (var i = 0; i < mod.deps.length; i++) {
        chain = chain.then((function(depId) {
          return function() { return window.loadModule(depId); };
        })(mod.deps[i]));
      }
    }

    // 加载自身
    var p = chain.then(function() {
      return _loadScript(mod.src);
    }).then(function() {
      // 如果有 init 函数，自动调用
      if (mod.init && typeof window[mod.init] === 'function') {
        try { window[mod.init](); } catch(e) { console.warn('[lazy-loader] init 错误:', id, e); }
      }
      _loaded[id] = true;
      _loading[id] = null;
    });

    _loading[id] = p;
    return p;
  };

  /**
   * 批量加载多个模块，返回 Promise
   * @param {string[]} ids - 模块 ID 数组
   * @returns {Promise<void>}
   */
  window.loadModules = function(ids) {
    return Promise.all(ids.map(function(id) { return window.loadModule(id); }));
  };

  /**
   * 预加载模块（空闲时静默加载，不阻塞交互）
   * @param {string[]} ids - 模块 ID 数组
   */
  window.preloadModules = function(ids) {
    if ('requestIdleCallback' in window) {
      requestIdleCallback(function() { window.loadModules(ids); });
    } else {
      setTimeout(function() { window.loadModules(ids); }, 2000);
    }
  };

  /**
   * 懒调用：加载模块后调用函数
   * 用于 onclick="lazyCall('module-id','funcName',args)"
   */
  window.lazyCall = function(moduleId, funcName, args) {
    return window.loadModule(moduleId).then(function() {
      if (typeof window[funcName] === 'function') {
        window[funcName].apply(null, args || []);
      } else {
        console.warn('[lazy-loader] 函数不存在:', funcName);
      }
    });
  };

  // 标记加载完成
  console.log('[lazy-loader] 按需加载器已就绪，首屏 JS 已精简');
})();
