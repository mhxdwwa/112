/**
 * POST /api/pet/insert — 领养新宠物
 */
import { jsonResponse, handleOptions, checkEnv, sbInsert, sbUpdate } from '../../_utils.js';

export const onRequestOptions = handleOptions;

export const onRequestPost = async ({ request, env }) => {
  const envErr = checkEnv(env);
  if (envErr) return envErr;

  const body = await request.json();
  const payload = {
    student_id: body.student_id,
    name: body.name,
    nickname: body.nickname || '',
    level: body.level || 1,
    growth: body.growth || 0,
    coins: body.coins || 0,
    is_active: body.is_active || false,
    is_dead: false,
    last_feed_date: null,
    last_play_date: null,
    today_feed_count: 0,
    today_play_count: 0,
    penalty_streak: 0,
  };

  const insertR = await sbInsert(env, 'pets', [payload]);
  if (insertR.error) {
    return jsonResponse({ error: 'Failed to insert pet', details: insertR.error }, 500);
  }

  const newPet = insertR.data && insertR.data[0];
  if (newPet && body.is_active) {
    await sbUpdate(env, 'students', { active_pet_id: newPet.id }, `id=eq.${body.student_id}`);
  }

  return jsonResponse({ ok: true, pet: newPet });
};
