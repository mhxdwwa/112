/**
 * POST /api/student/batch-coins — 批量原子修改金币 + 记录操作日志
 *
 * 解决并发竞态条件：多个 /api/coins 或 /api/coins-and-pet 并行调用时，
 * 每个调用都 read-modify-write operation_logs_json，导致只有最后一个写入的日志存活。
 *
 * 本端点在服务端顺序处理所有学生，确保日志不丢失。
 *
 * Body: {
 *   classId: number,
 *   items: [{
 *     studentId: number,
 *     studentName: string,
 *     coinDelta: number,
 *     actionType: string,
 *     details: string,
 *     expDelta: number,
 *     petId: number|null,
 *     petUpdates: [{ petId, updates: { growth, level, is_dead, penalty_streak, ... } }],
 *     checkBalance: boolean,
 *   }],
 * }
 */
import { jsonResponse, handleOptions, checkEnv, sbSelectSingle, sbUpdate, genId } from '../../_utils.js';

const STAGE_NAMES = {
  1: '神秘宠物蛋', 2: '可爱幼体', 3: '成长伙伴', 4: '成熟伙伴',
  5: '完美精灵', 6: '传说神兽', 7: '远古守护', 8: '星辰之主', 9: '万物之神'
};

const STAGE_GROWTH = [
  { stage: 1, growthRequired: 0 },
  { stage: 2, growthRequired: 30 },
  { stage: 3, growthRequired: 90 },
  { stage: 4, growthRequired: 210 },
  { stage: 5, growthRequired: 410 },
  { stage: 6, growthRequired: 740 },
  { stage: 7, growthRequired: 1200 },
  { stage: 8, growthRequired: 1800 },
  { stage: 9, growthRequired: 2600 },
];

function calcLevelFromGrowth(growth) {
  let level = 1;
  for (let i = STAGE_GROWTH.length - 1; i >= 0; i--) {
    if (growth >= STAGE_GROWTH[i].growthRequired) {
      level = STAGE_GROWTH[i].stage;
      break;
    }
  }
  return level;
}

export const onRequestOptions = handleOptions;

export const onRequestPost = async ({ request, env }) => {
  const envErr = checkEnv(env);
  if (envErr) return envErr;

  const body = await request.json();
  const { classId, items } = body;

  if (!classId || !Array.isArray(items) || items.length === 0) {
    return jsonResponse({ error: 'Missing classId or empty items array' }, 400);
  }

  // 1. 一次性读取所有相关学生数据
  const studentIds = items.map(it => it.studentId).filter(Boolean);
  if (studentIds.length === 0) {
    return jsonResponse({ error: 'No valid studentIds' }, 400);
  }

  const stuR = await sbSelectSingle(
    env, 'students',
    `id=in.(${studentIds.join(',')})&select=id,coins,xiandan`
  );
  if (stuR.error || !stuR.data) {
    return jsonResponse({ error: 'Failed to read students', details: stuR.error }, 500);
  }
  const studentMap = {};
  stuR.data.forEach(s => { studentMap[s.id] = s; });

  // 2. 一次性读取所有相关宠物快照（用于日志）
  const allPetIds = [];
  items.forEach(it => {
    if (it.petId) allPetIds.push(it.petId);
    if (it.petUpdates) it.petUpdates.forEach(pu => { if (pu.petId) allPetIds.push(pu.petId); });
  });
  const uniquePetIds = [...new Set(allPetIds)];

  let petSnapMap = {};
  if (uniquePetIds.length > 0) {
    const petR = await sbSelectSingle(
      env, 'pets',
      `id=in.(${uniquePetIds.join(',')})&select=id,name,nickname,level,growth,is_dead,penalty_streak`
    );
    if (petR.data) {
      petR.data.forEach(p => { petSnapMap[p.id] = p; });
    }
  }

  // 3. 顺序处理每个学生的金币和宠物变更，收集日志
  const results = [];
  const newLogs = [];

  for (const item of items) {
    const { studentId, studentName, coinDelta, actionType, details, expDelta = 0, petId = null, petUpdates = [], checkBalance = false } = item;

    const student = studentMap[studentId];
    if (!student) {
      results.push({ studentId, ok: false, error: 'Student not found' });
      continue;
    }

    const beforeCoins = student.coins || 0;

    // 检查余额
    if (checkBalance && coinDelta < 0 && beforeCoins + coinDelta < 0) {
      results.push({ studentId, ok: false, error: 'Insufficient balance', currentCoins: beforeCoins });
      continue;
    }

    // 计算新金币
    const newCoins = Math.max(0, beforeCoins + coinDelta);

    // 写入金币
    const coinUpdateR = await sbUpdate(env, 'students', { coins: newCoins }, `id=eq.${studentId}`);
    if (coinUpdateR.error) {
      results.push({ studentId, ok: false, error: 'Failed to update coins' });
      continue;
    }

    // 更新宠物
    const petResults = [];
    const allowedFields = ['growth', 'level', 'is_dead', 'last_feed_date', 'last_play_date', 'today_feed_count', 'today_play_count', 'penalty_streak', 'is_active', 'nickname'];
    for (const pu of petUpdates) {
      const filtered = {};
      for (const key of allowedFields) {
        if (pu.updates && pu.updates[key] !== undefined) filtered[key] = pu.updates[key];
      }
      if (filtered.growth !== undefined && filtered.growth > 2600) filtered.growth = 2600;
      if (filtered.growth !== undefined && filtered.growth < 0) filtered.growth = 0;
      if (filtered.growth !== undefined) {
        filtered.level = calcLevelFromGrowth(filtered.growth);
      }
      if (pu.petId && Object.keys(filtered).length > 0) {
        const petR = await sbUpdate(env, 'pets', filtered, `id=eq.${pu.petId}`);
        petResults.push({ petId: pu.petId, ok: !petR.error });
      }
    }

    // 构建日志
    const snapshot = { coinsBefore: beforeCoins, coinsAfter: newCoins };
    if (petId && petSnapMap[petId]) {
      const bp = petSnapMap[petId];
      snapshot.petNick = bp.nickname || bp.name;
      snapshot.petRealName = bp.name;
      const afterGrowth = petUpdates.find(pu => pu.petId == petId)?.updates?.growth;
      const afterLevel = petUpdates.find(pu => pu.petId == petId)?.updates?.level;
      snapshot.petLevel = afterLevel !== undefined ? afterLevel : (bp.level || 1);
      snapshot.growthBefore = Math.max(0, (bp.growth || 0));
      snapshot.growthAfter = afterGrowth !== undefined ? Math.min(2600, Math.max(0, afterGrowth)) : (bp.growth || 0);
      snapshot.isDead = petUpdates.find(pu => pu.petId == petId)?.updates?.is_dead ?? (bp.is_dead || false);
      snapshot.penaltyStreak = petUpdates.find(pu => pu.petId == petId)?.updates?.penalty_streak ?? (bp.penalty_streak || 0);
      snapshot.stageName = STAGE_NAMES[snapshot.petLevel] || '阶段' + snapshot.petLevel;
    }

    const log = {
      id: genId(),
      timestamp: new Date().toISOString(),
      classId, studentId, studentName: studentName || '',
      actionType: actionType || '', details: details || '',
      coinDelta, expDelta, petId: petId || null,
      snapshot,
      reverted: false,
    };
    newLogs.push(log);

    results.push({ studentId, ok: true, coinsBefore: beforeCoins, coinsAfter: newCoins, petResults, logId: log.id });
  }

  // 4. 一次性写入所有日志（单次 read-modify-write，无竞态）
  if (newLogs.length > 0) {
    const logsR = await sbSelectSingle(env, 'classes', `id=eq.${classId}&select=operation_logs_json`);
    let existingLogs = [];
    if (logsR.data && logsR.data.length > 0 && logsR.data[0].operation_logs_json) {
      try { existingLogs = JSON.parse(logsR.data[0].operation_logs_json); } catch (e) {}
    }
    // 新日志插入头部
    const merged = [...newLogs, ...existingLogs].slice(0, 3000);
    await sbUpdate(env, 'classes', { operation_logs_json: JSON.stringify(merged) }, `id=eq.${classId}`);
  }

  return jsonResponse({ ok: true, results, logCount: newLogs.length });
};
