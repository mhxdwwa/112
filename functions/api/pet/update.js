/**
 * POST /api/pet/update — 更新宠物数据
 */
import { jsonResponse, handleOptions, checkEnv, sbUpdate } from '../../_utils.js';

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
  const { petId, updates } = body;

  if (!petId || !updates) {
    return jsonResponse({ error: 'Missing petId or updates' }, 400);
  }

  const allowedFields = [
    'growth', 'level', 'is_dead', 'last_feed_date', 'last_play_date',
    'today_feed_count', 'today_play_count', 'penalty_streak', 'is_active', 'nickname', 'coins'
  ];
  const filteredUpdates = {};
  for (const key of allowedFields) {
    if (updates[key] !== undefined) filteredUpdates[key] = updates[key];
  }

  if (filteredUpdates.growth !== undefined && filteredUpdates.growth > 2600) filteredUpdates.growth = 2600;

  // v158: 服务端根据成长值重算等级（防止客户端发送旧等级导致刷新后等级回退）
  if (filteredUpdates.growth !== undefined) {
    filteredUpdates.level = calcLevelFromGrowth(filteredUpdates.growth);
  }

  const updateR = await sbUpdate(env, 'pets', filteredUpdates, `id=eq.${petId}`);
  if (updateR.error) {
    return jsonResponse({ error: 'Failed to update pet', details: updateR.error }, 500);
  }

  return jsonResponse({ ok: true, petId, updates: filteredUpdates });
};
