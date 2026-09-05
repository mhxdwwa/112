/**
 * POST /api/pet/update — 更新宠物数据
 */
import { jsonResponse, handleOptions, checkEnv, sbUpdate } from '../../_utils.js';

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

  const updateR = await sbUpdate(env, 'pets', filteredUpdates, `id=eq.${petId}`);
  if (updateR.error) {
    return jsonResponse({ error: 'Failed to update pet', details: updateR.error }, 500);
  }

  return jsonResponse({ ok: true, petId, updates: filteredUpdates });
};
