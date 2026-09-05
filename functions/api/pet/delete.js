/**
 * POST /api/pet/delete — 删除宠物
 */
import { jsonResponse, handleOptions, checkEnv, sbDelete } from '../../_utils.js';

export const onRequestOptions = handleOptions;

export const onRequestPost = async ({ request, env }) => {
  const envErr = checkEnv(env);
  if (envErr) return envErr;

  const body = await request.json();
  const { petId } = body;

  if (!petId) {
    return jsonResponse({ error: 'Missing petId' }, 400);
  }

  const deleteR = await sbDelete(env, 'pets', `id=eq.${petId}`);
  if (deleteR.error) {
    return jsonResponse({ error: 'Failed to delete pet', details: deleteR.error }, 500);
  }

  return jsonResponse({ ok: true, petId });
};
