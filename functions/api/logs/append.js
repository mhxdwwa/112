/**
 * POST /api/logs/append — 追加操作日志
 * v221: INSERT 到 operation_logs 独立表（替代 read-modify-write classes.operation_logs_json）
 */
import { jsonResponse, handleOptions, checkEnv, sbRequest, genId } from '../../_utils.js';

export const onRequestOptions = handleOptions;

export const onRequestPost = async ({ request, env }) => {
  const envErr = checkEnv(env);
  if (envErr) return envErr;

  const body = await request.json();
  const { classId, log } = body;

  if (!classId || !log) return jsonResponse({ error: 'Missing classId or log' }, 400);

  if (!log.id) log.id = genId();
  if (!log.timestamp) log.timestamp = new Date().toISOString();
  log.reverted = log.reverted || false;

  // v221: INSERT 到 operation_logs 表
  const row = {
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
    created_at: log.timestamp
  };

  const insertR = await sbRequest(env, 'POST', 'operation_logs', { body: [row] });
  if (insertR.error) {
    console.error('[logs/append] INSERT failed:', insertR.error);
    return jsonResponse({ error: 'Failed to append log', details: insertR.error }, 500);
  }

  return jsonResponse({ ok: true, logId: log.id });
};
