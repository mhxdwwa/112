/**
 * POST /api/logs/append — 追加操作日志
 */
import { jsonResponse, handleOptions, checkEnv, sbSelectSingle, sbUpdate, genId } from '../../_utils.js';

export const onRequestOptions = handleOptions;

export const onRequestPost = async ({ request, env }) => {
  const envErr = checkEnv(env);
  if (envErr) return envErr;

  const body = await request.json();
  const { classId, log } = body;

  if (!classId || !log) return jsonResponse({ error: 'Missing classId or log' }, 400);

  const logsR = await sbSelectSingle(env, 'classes', `id=eq.${classId}&select=operation_logs_json`);
  let existingLogs = [];
  if (logsR.data && logsR.data.length > 0 && logsR.data[0].operation_logs_json) {
    try { existingLogs = JSON.parse(logsR.data[0].operation_logs_json); } catch (e) {}
  }

  if (!log.id) log.id = genId();
  if (!log.timestamp) log.timestamp = new Date().toISOString();
  log.reverted = log.reverted || false;

  existingLogs.unshift(log);
  if (existingLogs.length > 3000) existingLogs = existingLogs.slice(0, 3000);

  await sbUpdate(env, 'classes', { operation_logs_json: JSON.stringify(existingLogs) }, `id=eq.${classId}`);

  return jsonResponse({ ok: true, logId: log.id });
};
