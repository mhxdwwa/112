/**
 * POST /api/custom-actions/save — 保存自定义奖惩动作
 */
import { jsonResponse, handleOptions, checkEnv, sbDelete, sbInsert } from '../../_utils.js';

export const onRequestOptions = handleOptions;

export const onRequestPost = async ({ request, env }) => {
  const envErr = checkEnv(env);
  if (envErr) return envErr;

  const body = await request.json();
  const { classId, actions } = body;

  if (!classId) return jsonResponse({ error: 'Missing classId' }, 400);

  // v182: Check delete result before inserting to prevent data loss
  const delR = await sbDelete(env, 'custom_actions', `class_id=eq.${classId}`);
  if (delR.error) {
    return jsonResponse({ error: 'Failed to clear old actions', details: delR.error }, 500);
  }

  if (actions && actions.length > 0) {
    const payloads = actions.map(a => ({ class_id: classId, name: a.name, coins: a.coins || 0 }));
    const insertR = await sbInsert(env, 'custom_actions', payloads);
    if (insertR.error) return jsonResponse({ error: 'Failed to save actions', details: insertR.error }, 500);
  }

  return jsonResponse({ ok: true });
};
