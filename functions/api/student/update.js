/**
 * POST /api/student/update — 更新学生字段（不涉及金币）
 */
import { jsonResponse, handleOptions, checkEnv, sbUpdate } from '../../_utils.js';

export const onRequestOptions = handleOptions;

export const onRequestPost = async ({ request, env }) => {
  const envErr = checkEnv(env);
  if (envErr) return envErr;

  const body = await request.json();
  const { studentId, updates } = body;

  if (!studentId || !updates) {
    return jsonResponse({ error: 'Missing studentId or updates' }, 400);
  }

  const jsonFields = ['quiz_state', 'shop_items', 'equipped_items', 'snack_requests'];
  const allowedFields = [
    'quiz_state', 'shop_items', 'equipped_items', 'last_checkin_date',
    'last_jianghu_date', 'last_pk_date', 'pk_count_today', 'active_pet_id',
    'snack_requests', 'xiandan', 'password'
  ];
  const filteredUpdates = {};

  for (const key of allowedFields) {
    if (updates[key] !== undefined) {
      let val = updates[key];
      if (jsonFields.includes(key) && typeof val !== 'string') {
        val = JSON.stringify(val);
      }
      filteredUpdates[key] = val;
    }
  }

  if (Object.keys(filteredUpdates).length === 0) {
    return jsonResponse({ error: 'No valid fields to update' }, 400);
  }

  const updateR = await sbUpdate(env, 'students', filteredUpdates, `id=eq.${studentId}`);
  if (updateR.error) {
    return jsonResponse({ error: 'Failed to update student', details: updateR.error }, 500);
  }

  return jsonResponse({ ok: true, studentId, updates: filteredUpdates });
};
