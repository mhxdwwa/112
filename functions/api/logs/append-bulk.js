/**
 * POST /api/logs/append-bulk — 批量追加操作日志
 * v221: 批量 INSERT 到 operation_logs 独立表（替代 read-modify-write classes.operation_logs_json）
 */
import { jsonResponse, handleOptions, checkEnv, sbRequest } from '../../_utils.js';

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

  // v221: 批量 INSERT 到 operation_logs 表
  const rows = logs.map(function(log) {
    return {
      id: log.id,
      class_id: classId,
      student_id: log.studentId || null,
      student_name: log.studentName || '',
      action_type: log.actionType || '',
      details: log.details || '',
      coin_delta: parseInt(log.coinDelta) || 0,
      exp_delta: parseInt(log.expDelta) || 0,
      pet_id: log.petId || null,
      snapshot: log.snapshot || null,
      extra: log.extra || null,
      full_snapshot: log.fullSnapshot || null,
      reverted: !!log.reverted,
      created_at: log.timestamp || new Date().toISOString()
    };
  });

  // 使用 on_conflict=id 去重（跳过已存在的日志）
  const insertR = await sbRequest(env, 'POST', 'operation_logs', {
    query: 'on_conflict=id',
    body: rows
  });

  if (insertR.error) {
    console.error('[logs/append-bulk] INSERT failed:', insertR.error);
    return jsonResponse({ error: 'Failed to append logs', details: insertR.error }, 500);
  }

  return jsonResponse({ ok: true, appended: rows.length, total: rows.length });
};
