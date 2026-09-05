/**
 * POST /api/logs/clear — 清空班级操作日志
 * v156: 一键清空历史记录功能
 */
import { jsonResponse, handleOptions, checkEnv, sbUpdate } from '../../_utils.js';

export const onRequestOptions = handleOptions;

export const onRequestPost = async ({ request, env }) => {
  const envErr = checkEnv(env);
  if (envErr) return envErr;

  const body = await request.json();
  const { classId } = body;

  if (!classId) {
    return jsonResponse({ error: 'Missing classId' }, 400);
  }

  // 将 operation_logs_json 设置为空数组
  const updateR = await sbUpdate(env, 'classes', { operation_logs_json: '[]' }, `id=eq.${classId}`);
  if (updateR.error) {
    return jsonResponse({ error: 'Failed to clear logs', details: updateR.error }, 500);
  }

  return jsonResponse({ ok: true, classId });
};
