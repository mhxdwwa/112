/**
 * POST /api/logs/revert — 撤销/恢复操作日志
 */
import { jsonResponse, handleOptions, checkEnv, sbSelectSingle, sbUpdate } from '../../_utils.js';

export const onRequestOptions = handleOptions;

export const onRequestPost = async ({ request, env }) => {
  const envErr = checkEnv(env);
  if (envErr) return envErr;

  const body = await request.json();
  const { classId, logId, reverted, coinDelta, studentId, petUpdates = [] } = body;

  if (!classId || !logId || studentId === undefined) {
    return jsonResponse({ error: 'Missing required fields' }, 400);
  }

  // v184: 先读取日志，检查是否已撤销，防止重复撤销导致金币/日志竞态丢失
  const logsR = await sbSelectSingle(env, 'classes', `id=eq.${classId}&select=operation_logs_json`);
  let existingLogs = [];
  if (logsR.data && logsR.data.length > 0 && logsR.data[0].operation_logs_json) {
    try { existingLogs = JSON.parse(logsR.data[0].operation_logs_json); } catch (e) {}
  }
  const logEntry = existingLogs.find(l => l.id === logId);
  if (!logEntry) {
    return jsonResponse({ error: 'Log entry not found' }, 404);
  }
  // 如果日志的撤销状态已经和目标状态一致，说明是重复请求，直接返回
  if (logEntry.reverted === reverted) {
    return jsonResponse({ ok: true, alreadyProcessed: true });
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

  // 3. 标记日志为已撤销/恢复（使用前面已读取的 existingLogs，避免再次读取产生竞态）
  logEntry.reverted = reverted;
  await sbUpdate(env, 'classes', { operation_logs_json: JSON.stringify(existingLogs) }, `id=eq.${classId}`);

  return jsonResponse({ ok: true });
};
