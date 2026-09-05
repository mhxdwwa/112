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

  // 3. 标记日志为已撤销/恢复
  const logsR = await sbSelectSingle(env, 'classes', `id=eq.${classId}&select=operation_logs_json`);
  let existingLogs = [];
  if (logsR.data && logsR.data.length > 0 && logsR.data[0].operation_logs_json) {
    try { existingLogs = JSON.parse(logsR.data[0].operation_logs_json); } catch (e) {}
  }
  const logEntry = existingLogs.find(l => l.id === logId);
  if (logEntry) {
    logEntry.reverted = reverted;
    await sbUpdate(env, 'classes', { operation_logs_json: JSON.stringify(existingLogs) }, `id=eq.${classId}`);
  }

  return jsonResponse({ ok: true });
};
