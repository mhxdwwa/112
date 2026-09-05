/**
 * POST /api/logs/append-bulk — 批量追加操作日志
 * 
 * 学生端使用：一次请求追加多条日志到 classes.operation_logs_json
 * 替代直接 RPC 调用 append_pending_log
 */
import { jsonResponse, handleOptions, checkEnv, sbSelectSingle, sbUpdate } from '../../_utils.js';

export const onRequestOptions = handleOptions;

export const onRequestPost = async ({ request, env }) => {
  const envErr = checkEnv(env);
  if (envErr) return envErr;

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const { classId, logs } = body;
  if (!classId || !Array.isArray(logs) || logs.length === 0) {
    return jsonResponse({ error: 'Missing classId or empty logs array' }, 400);
  }

  // 读取当前日志
  const classR = await sbSelectSingle(env, 'classes', `id=eq.${classId}&select=operation_logs_json`);
  if (classR.error || !classR.data || classR.data.length === 0) {
    return jsonResponse({ error: 'Class not found' }, 404);
  }

  let existingLogs = [];
  try {
    const raw = classR.data[0].operation_logs_json;
    if (raw) existingLogs = JSON.parse(raw);
  } catch { /* ignore parse error */ }

  // 去重：以 id 为键，跳过已存在的日志
  const existingIds = {};
  existingLogs.forEach(l => { if (l.id) existingIds[l.id] = true; });
  const newLogs = logs.filter(l => l.id && !existingIds[l.id]);

  if (newLogs.length === 0) {
    return jsonResponse({ ok: true, appended: 0, total: existingLogs.length });
  }

  // 合并新日志到头部，限制总数
  const merged = [...newLogs, ...existingLogs].slice(0, 3000);

  // 写回
  const updateR = await sbUpdate(env, 'classes', { operation_logs_json: JSON.stringify(merged) }, `id=eq.${classId}`);
  if (updateR.error) {
    return jsonResponse({ error: 'Failed to write logs' }, 500);
  }

  return jsonResponse({ ok: true, appended: newLogs.length, total: merged.length });
};
