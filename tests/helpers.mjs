/**
 * Extract pure functions from app.js for Node.js testing.
 * These are functions that don't depend on DOM or browser APIs.
 */

// ===== escapeHTML =====
export function escapeHTML(str) {
  if (str == null) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

// ===== generateStageCurve =====
export function generateStageCurve() {
  return [
    {stage:1,growthRequired:0,stageName:"神秘宠物蛋"},
    {stage:2,growthRequired:30,stageName:"可爱幼体"},
    {stage:3,growthRequired:90,stageName:"成长伙伴"},
    {stage:4,growthRequired:210,stageName:"成熟伙伴"},
    {stage:5,growthRequired:410,stageName:"完美精灵"},
    {stage:6,growthRequired:740,stageName:"传说神兽"},
    {stage:7,growthRequired:1200,stageName:"远古守护"},
    {stage:8,growthRequired:1800,stageName:"星辰之主"},
    {stage:9,growthRequired:2600,stageName:"万物之神"},
  ];
}

// ===== PET_CONFIG (simplified for testing) =====
export const PET_CONFIG = {
  '小猫': {
    id: 'cat',
    emoji: '🐱',
    stages: generateStageCurve(),
  },
  '小狗': {
    id: 'dog',
    emoji: '🐶',
    stages: generateStageCurve(),
  },
};

// ===== getActivePet =====
export function getActivePet(student) {
  if (!student.pets || student.pets.length === 0) return null;
  if (student.activePetId && student.pets.some(p => Number(p.id) === Number(student.activePetId)))
    return student.pets.find(p => Number(p.id) === Number(student.activePetId));
  return student.pets[0];
}

// ===== getGrowablePet =====
export function getGrowablePet(student) {
  if (!student.pets || student.pets.length === 0) return null;
  const active = getActivePet(student);
  if (active && !active.isDead && active.level < 9) return active;
  return student.pets.find(p => !p.isDead && p.level < 9) || null;
}

// ===== isPetStarved (1680 hours = 70 days) =====
export function isPetStarved(pet) {
  if (!pet.lastFeedDate) return false;
  const last = new Date(pet.lastFeedDate);
  const now = new Date();
  const diffHours = (now - last) / (1000 * 3600);
  return diffHours >= 1680;
}

// ===== updatePetLevel =====
export function updatePetLevel(student, petId, growthDelta = 0, silent = false) {
  const pet = student.pets.find(p => p.id === petId);
  if (!pet) return false;
  const cfg = PET_CONFIG[pet.name];
  if (!cfg) return false;
  let oldLevel = pet.level;
  let newLevel = 1;
  for (let i = cfg.stages.length - 1; i >= 0; i--) {
    if (pet.growth >= cfg.stages[i].growthRequired) {
      newLevel = cfg.stages[i].stage;
      break;
    }
  }
  if (pet.growth < 0) pet.growth = 0;
  const _maxGrowth = cfg.stages[cfg.stages.length - 1].growthRequired;
  if (newLevel >= 9 && pet.growth > _maxGrowth) {
    pet.growth = _maxGrowth;
  }
  if (newLevel !== oldLevel) {
    pet.level = newLevel;
    if (newLevel >= 9) {
      pet.growth = Math.min(pet.growth, _maxGrowth);
    }
    const stageName = cfg.stages[newLevel - 1]?.stageName || `阶段${newLevel}`;
    return {
      studentName: student.name,
      petName: pet.nickname || pet.name,
      newLevel,
      oldLevel,
      stageName,
      isUpgrade: newLevel > oldLevel,
    };
  }
  return false;
}

// ===== changeStudentCoins =====
export function changeStudentCoins(student, delta, actionType, details, expDelta, petId, extra) {
  const before = student.coins || 0;
  student.coins = before + delta;
  if (student.coins < 0) student.coins = 0;
  return { coins: student.coins, delta, before };
}

// ===== _hasFedToday =====
export function _hasFedToday(pet) {
  if (!pet.lastFeedDate) return false;
  const last = new Date(pet.lastFeedDate);
  const now = new Date();
  return last.toDateString() === now.toDateString();
}

// ===== Helper: create test student =====
export function createStudent(overrides = {}) {
  return {
    id: overrides.id || 's1',
    name: overrides.name || '测试学生',
    coins: overrides.coins ?? 100,
    pets: overrides.pets || [
      {
        id: 'p1',
        name: '小猫',
        nickname: '咪咪',
        level: 1,
        growth: 0,
        isDead: false,
        lastFeedDate: new Date().toISOString(),
        todayFeedCount: 0,
        todayPlayCount: 0,
        lastPlayDate: null,
        penaltyStreak: 0,
      }
    ],
    activePetId: overrides.activePetId || 'p1',
  };
}
