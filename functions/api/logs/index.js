/**
 * GET /api/logs?classId=xxx — 加载操作日志
 */
import { jsonResponse, handleOptions, checkEnv, sbSelectSingle } from '../../_utils.js';

export const onRequestOptions = handleOptions;

export const onRequestGet = async ({ request, env }) => {
  const envErr = checkEnv(env);
  if (envErr) return envErr;

  const url = new URL(request.url);
  const classId = url.searchParams.get('classId');
  if (!classId) return jsonResponse({ error: 'Missing classId' }, 400);

  const logsR = await sbSelectSingle(env, 'classes', `id=eq.${classId}&select=operation_logs_json`);
  let logs = [];
  if (logsR.data && logsR.data.length > 0 && logsR.data[0].operation_logs_json) {
    try { logs = JSON.parse(logsR.data[0].operation_logs_json); } catch (e) {}
  }
  return jsonResponse({ logs });
};
