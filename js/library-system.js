// ========== 图书馆系统 ==========
// 从 app.js 拆分 - v129
// ========== 图书馆系统 ==========
(function() {
  'use strict';

  // 书籍列表配置 - 从阿里云OSS加载PDF
  var BOOKS_REPO = 'https://mhxdwwa.oss-cn-shenzhen.aliyuncs.com/books';
  
  // 书籍列表（直接配置，无需API）
  var BOOKS_LIST = [
    { name: '七年级上册数学课本', file: '七年级上册数学课本.pdf', size: '5.1MB' },
    { name: '七年级下册数学课本', file: '七年级下册数学课本.pdf', size: '13MB' },
    { name: '八年级上册数学课本', file: '八年级上册数学课本.pdf', size: '4.0MB' },
    { name: '八年级下册数学课本', file: '八年级下册数学课本.pdf', size: '4.4MB' }
  ];
  
  // 渲染图书馆页面
  window.renderLibraryPage = function() {
    var container = document.getElementById('libraryContent');
    if (!container) return;
    
    if (BOOKS_LIST.length === 0) {
      showEmptyLibrary();
      return;
    }
    
    renderBookGrid(BOOKS_LIST);
  };
  
  function showEmptyLibrary() {
    var container = document.getElementById('libraryContent');
    if (!container) return;
    
    container.innerHTML = '<div style="text-align:center;padding:60px 20px;">' +
      '<div style="font-size:64px;margin-bottom:20px;">📖</div>' +
      '<div style="color:#999;font-size:18px;margin-bottom:10px;">图书馆暂时空置</div>' +
      '<div style="color:#bbb;font-size:14px;">请稍后再来，或者联系老师添加书籍</div>' +
      '</div>';
  }
  
  function renderBookGrid(books) {
    var container = document.getElementById('libraryContent');
    if (!container) return;
    
    var html = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:20px;padding:10px;">';
    
    books.forEach(function(book) {
      var bookUrl = BOOKS_REPO + '/' + encodeURIComponent(book.file);
      var coverUrl = BOOKS_REPO + '/covers/' + encodeURIComponent(book.name) + '.jpg';
      // PDF查看器链接 - 点击书籍在线查看而非下载
      var viewerUrl = 'pdf-viewer.html?url=' + encodeURIComponent(bookUrl) + '&name=' + encodeURIComponent(book.name);
      
      html += '<div style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.08);transition:transform 0.2s,box-shadow 0.2s;">' +
        '<div style="width:100%;height:240px;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden;cursor:pointer;" ' +
        'onclick="window.location.href=\'' + viewerUrl + '\'">' +
        '<img src="' + coverUrl + '" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'">' +
        '<div style="display:none;flex-direction:column;align-items:center;justify-content:center;color:#fff;text-align:center;padding:20px;">' +
        '<div style="font-size:48px;margin-bottom:10px;">📕</div>' +
        '<div style="font-size:14px;font-weight:600;line-height:1.4;">' + book.name + '</div>' +
        '</div>' +
        '</div>' +
        '<div style="padding:12px;text-align:center;">' +
        '<div style="font-size:14px;font-weight:600;color:#333;line-height:1.3;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + book.name + '</div>' +
        '<div style="font-size:11px;color:#999;margin-top:4px;">' + book.size + '</div>' +
        '<div style="display:flex;gap:8px;margin-top:8px;justify-content:center;">' +
        '<a href="' + viewerUrl + '" style="font-size:12px;color:#667eea;text-decoration:none;padding:4px 10px;background:#f0f4ff;border-radius:12px;">查看</a>' +
        '<a href="' + bookUrl + '" download style="font-size:12px;color:#764ba2;text-decoration:none;padding:4px 10px;background:#f8f0ff;border-radius:12px;">下载</a>' +
        '</div>' +
        '</div>' +
        '</div>';
    });
    
    html += '</div>';
    container.innerHTML = html;
  }
})();
// ========== 图书馆系统结束 ==========
