// ========== 爱心特效系统 ==========
// 从 app.js 拆分 - v129
// ========== 爱心特效核心函数 ==========
let activeHeartInterval = null;
let activeHeartContainer = null;
function stopAllHeartEmitters() { if(activeHeartInterval) { clearInterval(activeHeartInterval); activeHeartInterval = null; activeHeartContainer = null; } }
function isPetAlive(container) { if (container.querySelector('.dead-pet-overlay')) return false; const card = container.closest('.home-pet-card, .modal-pet-img, .rank-avatar-small'); if (card && card.querySelector('.dead-pet-overlay')) return false; return true; }
function getMouthPosition(container) { let targetImg = container.querySelector('img'); if (!targetImg) { const fallbackRect = container.getBoundingClientRect(); if (fallbackRect.width > 0) return { x: fallbackRect.left + fallbackRect.width * 0.5, y: fallbackRect.top + fallbackRect.height * 0.7 }; return null; } const rect = targetImg.getBoundingClientRect(); if (rect.width === 0 || rect.height === 0) return null; const x = rect.left + rect.width * 0.5; const y = rect.top + rect.height * 0.7; return { x, y }; }
function emitHeart(container) { if (!container.isConnected) { stopAllHeartEmitters(); return false; } if (!isPetAlive(container)) return false; const pos = getMouthPosition(container); if (!pos) return false; const heart = document.createElement('div'); heart.className = 'heart-float'; heart.innerHTML = '❤️'; heart.style.left = pos.x + 'px'; heart.style.top = pos.y + 'px'; heart.style.fontSize = (18 + Math.random() * 8) + 'px'; document.body.appendChild(heart); heart.addEventListener('animationend', () => heart.remove()); return true; }
function startHeartForContainer(container) { if (!container) return; stopAllHeartEmitters(); activeHeartContainer = container; var _isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches; var heartDelay = (_isReducedMotion || document.documentElement.classList.contains('low-end-device')) ? 1200 : 580; activeHeartInterval = setInterval(() => { if (!activeHeartContainer || !activeHeartContainer.isConnected) { stopAllHeartEmitters(); return; } emitHeart(activeHeartContainer); }, heartDelay); }
function findPetContainerByStudentId(studentId) { const modalImg = document.querySelector('#modalContainer .modal-pet-img'); if (modalImg && modalImg.isConnected) return modalImg; const cards = document.querySelectorAll('.home-pet-card'); for (let card of cards) { const onclickAttr = card.getAttribute('onclick'); if (onclickAttr && onclickAttr.includes(`openStudentModal('${studentId}')`)) { const topDiv = card.querySelector('.home-pet-top'); if (topDiv) return topDiv; } } return null; }
function startHeartForCurrentPet(studentId) { if (!studentId) { stopAllHeartEmitters(); return; } const cur = classesData?.find(c=>c.id===currentClassId); if(!cur) return; const student = cur.students.find(s=>s.id.toString()===studentId.toString()); if(!student) return; const activePet = getActivePet(student); if(!activePet || activePet.isDead) { stopAllHeartEmitters(); return; } const targetContainer = findPetContainerByStudentId(studentId); if(targetContainer) startHeartForContainer(targetContainer); else stopAllHeartEmitters(); }

// ========== 覆盖关键函数，确保爱心正确 ==========
const originalRenderHomePetGrid = renderHomePetGrid;
window.renderHomePetGrid = function() {
  originalRenderHomePetGrid();
  // 宠物卡片浮动延迟（替代 MutationObserver）
  document.querySelectorAll('.home-pet-card').forEach(function(card, i) {
    card.style.animationDelay = (i % 6) * 0.5 + 's';
    card.style.animationDuration = (2.5 + Math.random() * 1.5) + 's';
  });
  // 呼吸随机延迟（替代 petGrid MutationObserver）
  if (window.__initBreathingDelays) window.__initBreathingDelays();
  attachCardHeartListeners();
  if (currentModalStudentId) setTimeout(() => startHeartForCurrentPet(currentModalStudentId), 100);
  else stopAllHeartEmitters();
};
function attachCardHeartListeners() {
  document.querySelectorAll('.home-pet-card').forEach(card => {
    // v46: Prevent duplicate listeners (called from both _applyGridBatchPostProcess and wrapper)
    if (card.dataset.heartListenerAttached) return;
    card.dataset.heartListenerAttached = '1';
    
    const onclick = card.getAttribute('onclick');
    if (!onclick) return;
    const m = onclick.match(/openStudentModal\(['"]([^'"]+)['"]\)/);
    if (!m) return;
    const studentId = m[1];
    card.addEventListener('mouseenter', function() {
      if (currentModalStudentId) return;
      const cur = classesData?.find(c=>c.id===currentClassId);
      if(!cur) return;
      const student = cur.students.find(s=>s.id.toString()===studentId.toString());
      if(!student) return;
      const activePet = getActivePet(student);
      if(!activePet || activePet.isDead) return;
      const topDiv = card.querySelector('.home-pet-top');
      if(topDiv) startHeartForContainer(topDiv);
    });
    card.addEventListener('mouseleave', function() {
      if (currentModalStudentId) return;
      stopAllHeartEmitters();
    });
  });
}
const originalRefreshCurrentStudentModal = refreshCurrentStudentModal;
window.refreshCurrentStudentModal = function() { originalRefreshCurrentStudentModal(); if(currentModalStudentId) setTimeout(()=>startHeartForCurrentPet(currentModalStudentId), 80); else stopAllHeartEmitters(); };
const originalSwitchPage = switchPage;
window.switchPage = function(pageId) { originalSwitchPage(pageId); if(pageId !== 'class-pet-page') stopAllHeartEmitters(); else if(currentModalStudentId) setTimeout(()=>startHeartForCurrentPet(currentModalStudentId), 80); };
const originalCloseModal = closeModal;
window.closeModal = function() { originalCloseModal(); stopAllHeartEmitters(); };
const originalSwitchPet = switchPet;
window.switchPet = function(studentId, petId) { originalSwitchPet(studentId, petId); if(currentModalStudentId === studentId) setTimeout(()=>startHeartForCurrentPet(studentId), 100); };
const originalSetActivePet = setActivePet;
window.setActivePet = function(student, petId) { originalSetActivePet(student, petId); if(currentModalStudentId === student.id) setTimeout(()=>startHeartForCurrentPet(student.id), 100); };
const originalConfirmAdoptPet = confirmAdoptPet;
window.confirmAdoptPet = function(studentId) { originalConfirmAdoptPet(studentId); setTimeout(()=> { if(currentModalStudentId === studentId) startHeartForCurrentPet(studentId); }, 200); };
const originalConfirmChangePet = confirmChangePet;
window.confirmChangePet = function(studentId) { originalConfirmChangePet(studentId); setTimeout(()=> { if(currentModalStudentId === studentId) startHeartForCurrentPet(studentId); }, 200); };
setTimeout(()=> { if(currentModalStudentId) startHeartForCurrentPet(currentModalStudentId); }, 300);

