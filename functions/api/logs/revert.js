/**
 * POST /api/logs/revert — 撤销/恢复操作日志
 * v221: UPDATE operation_logs 表（替代 read-modify-write classes.operation_logs_json）
 */
import { jsonResponse, handleOptions, checkEnv, sbSelectSingle, sbUpdate, sbRequest } from '../../_utils.js';

export const onRequestOptions = handleOptions;

export const onRequestPost = async ({ request, env }) => {
  const envErr = checkEnv(env);
  if (envErr) return envErr;

  const body = await request.json();
  const { classId, logId, reverted, coinDelta, studentId, petUpdates = [] } = body;

  if (!classId || !logId || studentId === undefined) {
    return jsonResponse({ error: 'Missing required fields' }, 400);
  }

  // v221: 从 operation_logs 表查找日志
  const logR = await sbRequest(env, 'GET', 'operation_logs', {
    query: 'select=id&class_id=eq.' + encodeURIComponent(classId) + '&id=eq.' + encodeURIComponent(logId) + '&limit=1'
  });
  if (logR.error || !logR.data || logR.data.length === 0) {
    return jsonResponse({ error: 'Log entry not found' }, 404);
  }

  // 1. 更新金币
  if (coinDelta) {
    const stuR = await sbSelectSingle(env, 'students', `id=eq.${studentId}&select=coins`);
    if (stuR.data && stuR.data.length > 0) {
      const newCoins = Math.max(0, (stuR.data[0].coins || 0) + coinDelta);
      await sbUpdate(env, 'students', { coins: newCoins }, `id=eq.${studentId}`);
    }
  }

  // 2. 更新宠物
  for (const pu of petUpdates) {
    if (pu.petId && pu.updates) {
      await sbUpdate(env, 'pets', pu.updates, `id=eq.${pu.petId}`);
    }
  }

  // 3. v221: 标记日志为已撤销/恢复（UPDATE operation_logs 表的 reverted 字段）
  const revertR = await sbRequest(env, 'PATCH', 'operation_logs', {
    query: 'id=eq.' + encodeURIComponent(logId),
    body: { reverted: reverted }
  });
  if (revertR.error) {
    console.error('[logs/revert] UPDATE failed:', revertR.error);
    return jsonResponse({ error: 'Failed to revert log', details: revertR.error }, 500);
  }

  return jsonResponse({ ok: true });
};
