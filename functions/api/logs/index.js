/**
 * GET /api/logs?classId=xxx — 加载操作日志
 * v221: 从 operation_logs 独立表读取（替代 classes.operation_logs_json）
 */
import { jsonResponse, handleOptions, checkEnv, sbRequest } from '../../_utils.js';

export const onRequestOptions = handleOptions;

export const onRequestGet = async ({ request, env }) => {
  const envErr = checkEnv(env);
  if (envErr) return envErr;

  const url = new URL(request.url);
  const classId = url.searchParams.get('classId');
  if (!classId) return jsonResponse({ error: 'Missing classId' }, 400);

  // v221: 从 operation_logs 表查询，按时间倒序，最多 3000 条
  const logsR = await sbRequest(env, 'GET', 'operation_logs', {
    query: 'select=*&class_id=eq.' + encodeURIComponent(classId) + '&order=created_at.desc&limit=3000'
  });

  if (logsR.error) {
    console.error('[logs/index] Query failed:', logsR.error);
    return jsonResponse({ error: 'Failed to load logs', details: logsR.error }, 500);
  }

  // 将表行格式转换为客户端期望的日志格式
  var logs = (logsR.data || []).map(function(row) {
    return {
      id: row.id,
      timestamp: row.created_at,
      classId: row.class_id,
      studentId: row.student_id,
      studentName: row.student_name || '',
      actionType: row.action_type || '',
      details: row.details || '',
      coinDelta: row.coin_delta || 0,
      expDelta: row.exp_delta || 0,
      petId: row.pet_id || null,
      snapshot: row.snapshot || null,
      extra: row.extra || null,
      fullSnapshot: row.full_snapshot || null,
      reverted: !!row.reverted,
      _synced: true,
      _fromSupabase: true
    };
  });

  return jsonResponse({ logs: logs });
};
