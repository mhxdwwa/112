/**
 * POST /api/student/coins-and-pet — 原子操作：同时修改金币 + 宠物成长值
 * 用于喂食、玩耍、散步、逛街、旅游、复活等场景
 */
import { jsonResponse, handleOptions, checkEnv, sbSelectSingle, sbUpdate, genId } from '../../_utils.js';

// 阶段名称映射（与客户端 PET_CONFIG stages 保持一致）
const STAGE_NAMES = {
  1: '神秘宠物蛋', 2: '可爱幼体', 3: '成长伙伴', 4: '成熟伙伴',
  5: '完美精灵', 6: '传说神兽', 7: '远古守护', 8: '星辰之主', 9: '万物之神'
};

// 阶段升级所需成长值（与客户端 generateStageCurve 保持一致）
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

// v158: 服务端根据成长值计算等级（安全兜底，防止客户端发送错误的等级）
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
  const { studentId, coinDelta, petUpdates = [], checkBalance = false, actionType, details, classId, studentName, expDelta = 0, petId: logPetId } = body;

  if (!studentId || coinDelta === undefined) {
    return jsonResponse({ error: 'Missing studentId or coinDelta' }, 400);
  }

  // 1. 读金币
  const stuR = await sbSelectSingle(env, 'students', `id=eq.${studentId}&select=coins`);
  if (stuR.error || !stuR.data || stuR.data.length === 0) {
    return jsonResponse({ error: 'Student not found' }, 404);
  }
  const beforeCoins = stuR.data[0].coins || 0;

  // 2. 检查余额
  if (checkBalance && coinDelta < 0 && beforeCoins + coinDelta < 0) {
    return jsonResponse({ error: 'Insufficient balance', currentCoins: beforeCoins, required: Math.abs(coinDelta) }, 409);
  }

  // 3. 更新金币
  const newCoins = Math.max(0, beforeCoins + coinDelta);
  const coinUpdateR = await sbUpdate(env, 'students', { coins: newCoins }, `id=eq.${studentId}`);
  if (coinUpdateR.error) {
    return jsonResponse({ error: 'Failed to update coins' }, 500);
  }

  // 4. 读取宠物更新前的状态（用于日志快照）
  let beforePetSnapshot = null;
  if (logPetId) {
    const petBeforeR = await sbSelectSingle(env, 'pets', `id=eq.${logPetId}&select=id,name,nickname,level,growth,is_dead,penalty_streak`);
    if (petBeforeR.data && petBeforeR.data.length > 0) {
      const bp = petBeforeR.data[0];
      beforePetSnapshot = {
        petNick: bp.nickname || bp.name,
        petRealName: bp.name,
        petLevel: bp.level || 1,
        growthBefore: Math.max(0, bp.growth || 0),
        isDead: bp.is_dead || false,
        penaltyStreak: bp.penalty_streak || 0,
        stageName: STAGE_NAMES[bp.level || 1] || '阶段' + (bp.level || 1)
      };
    }
  }

  // 5. 更新宠物
  const petResults = [];
  const allowedFields = ['growth', 'level', 'is_dead', 'last_feed_date', 'last_play_date', 'today_feed_count', 'today_play_count', 'penalty_streak', 'is_active', 'nickname'];
  for (const pu of petUpdates) {
    const filtered = {};
    for (const key of allowedFields) {
      if (pu.updates && pu.updates[key] !== undefined) filtered[key] = pu.updates[key];
    }
    if (filtered.growth !== undefined && filtered.growth > 2600) filtered.growth = 2600;
    if (filtered.growth !== undefined && filtered.growth < 0) filtered.growth = 0;

    // v158: 服务端根据成长值重算等级（防止客户端发送旧等级导致刷新后等级回退）
    if (filtered.growth !== undefined) {
      filtered.level = calcLevelFromGrowth(filtered.growth);
    }

    if (pu.petId && Object.keys(filtered).length > 0) {
      const petR = await sbUpdate(env, 'pets', filtered, `id=eq.${pu.petId}`);
      petResults.push({ petId: pu.petId, ok: !petR.error });
    }
  }

  // 6. 写操作日志（包含完整宠物快照）
  let logId = null;
  if (classId) {
    const snapshot = { coinsBefore: beforeCoins, coinsAfter: newCoins };
    // 添加宠物快照信息
    if (beforePetSnapshot) {
      const afterGrowth = petUpdates.find(pu => pu.petId == logPetId)?.updates?.growth;
      const afterLevel = petUpdates.find(pu => pu.petId == logPetId)?.updates?.level;
      snapshot.petNick = beforePetSnapshot.petNick;
      snapshot.petRealName = beforePetSnapshot.petRealName;
      snapshot.petLevel = afterLevel !== undefined ? afterLevel : beforePetSnapshot.petLevel;
      snapshot.growthBefore = beforePetSnapshot.growthBefore;
      snapshot.growthAfter = afterGrowth !== undefined ? Math.min(2600, Math.max(0, afterGrowth)) : beforePetSnapshot.growthBefore;
      snapshot.isDead = petUpdates.find(pu => pu.petId == logPetId)?.updates?.is_dead ?? beforePetSnapshot.isDead;
      snapshot.penaltyStreak = petUpdates.find(pu => pu.petId == logPetId)?.updates?.penalty_streak ?? beforePetSnapshot.penaltyStreak;
      snapshot.stageName = STAGE_NAMES[snapshot.petLevel] || '阶段' + snapshot.petLevel;
    }
    const log = {
      id: genId(),
      timestamp: new Date().toISOString(),
      classId, studentId, studentName: studentName || '',
      actionType: actionType || '', details: details || '',
      coinDelta, expDelta, petId: logPetId || null,
      snapshot,
      reverted: false,
    };
    const logsR = await sbSelectSingle(env, 'classes', `id=eq.${classId}&select=operation_logs_json`);
    let existingLogs = [];
    if (logsR.data && logsR.data.length > 0 && logsR.data[0].operation_logs_json) {
      try { existingLogs = JSON.parse(logsR.data[0].operation_logs_json); } catch (e) {}
    }
    existingLogs.unshift(log);
    if (existingLogs.length > 3000) existingLogs = existingLogs.slice(0, 3000);
    await sbUpdate(env, 'classes', { operation_logs_json: JSON.stringify(existingLogs) }, `id=eq.${classId}`);
    logId = log.id;
  }

  return jsonResponse({ ok: true, coinsBefore: beforeCoins, coinsAfter: newCoins, petResults, logId });
};
