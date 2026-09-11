/**
 * POST /api/logs/clear — 清空班级操作日志
 * v221: DELETE FROM operation_logs（替代设置 operation_logs_json = '[]'）
 */
import { jsonResponse, handleOptions, checkEnv, sbRequest } from '../../_utils.js';

export const onRequestOptions = handleOptions;

export const onRequestPost = async ({ request, env }) => {
  const envErr = checkEnv(env);
  if (envErr) return envErr;

  const body = await request.json();
  const { classId } = body;

  if (!classId) {
    return jsonResponse({ error: 'Missing classId' }, 400);
  }

  // v221: 从 operation_logs 表删除该班级的所有日志
  const deleteR = await sbRequest(env, 'DELETE', 'operation_logs', {
    query: 'class_id=eq.' + encodeURIComponent(classId)
  });
  if (deleteR.error) {
    return jsonResponse({ error: 'Failed to clear logs', details: deleteR.error }, 500);
  }

  return jsonResponse({ ok: true, classId: classId });
};
