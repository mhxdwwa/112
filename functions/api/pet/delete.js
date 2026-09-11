/**
 * POST /api/pet/delete — 删除宠物
 */
import { jsonResponse, handleOptions, checkEnv, sbDelete, sbSelectSingle, sbUpdate } from '../../_utils.js';

export const onRequestOptions = handleOptions;

export const onRequestPost = async ({ request, env }) => {
  const envErr = checkEnv(env);
  if (envErr) return envErr;

  const body = await request.json();
  const { petId, studentId } = body;

  if (!petId) {
    return jsonResponse({ error: 'Missing petId' }, 400);
  }

  // v223: 删除前查找该宠物所属的学生，用于清理 active_pet_id
  let ownerId = studentId;
  if (!ownerId) {
    const petR = await sbSelectSingle(env, 'pets', `id=eq.${petId}&select=student_id`);
    if (petR.data && petR.data.length > 0) {
      ownerId = petR.data[0].student_id;
    }
  }

  const deleteR = await sbDelete(env, 'pets', `id=eq.${petId}`);
  if (deleteR.error) {
    return jsonResponse({ error: 'Failed to delete pet', details: deleteR.error }, 500);
  }

  // v223: 如果被删除的宠物是学生的活跃宠物，清空 active_pet_id
  if (ownerId) {
    const stuR = await sbSelectSingle(env, 'students', `id=eq.${ownerId}&select=active_pet_id`);
    if (stuR.data && stuR.data.length > 0 && String(stuR.data[0].active_pet_id) === String(petId)) {
      await sbUpdate(env, 'students', { active_pet_id: null }, `id=eq.${ownerId}`);
    }
  }

  return jsonResponse({ ok: true, petId });
};
