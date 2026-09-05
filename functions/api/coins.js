/**
 * POST /api/coins — 原子修改金币 + 记录操作日志
 *
 * Body: {
 *   studentId: number,
 *   delta: number,
 *   actionType: string,
 *   details: string,
 *   classId: number,
 *   studentName: string,
 *   expDelta: number,
 *   petId: number,
 *   checkBalance: boolean,
 * }
 */
import { jsonResponse, handleOptions, checkEnv, sbSelectSingle, sbUpdate, genId } from '../_utils.js';

export const onRequestOptions = handleOptions;

export const onRequestPost = async ({ request, env }) => {
  const envErr = checkEnv(env);
  if (envErr) return envErr;

  const body = await request.json();
  const { studentId, delta, actionType, details, classId, studentName, expDelta = 0, petId = null, checkBalance = false } = body;

  if (!studentId || delta === undefined) {
    return jsonResponse({ error: 'Missing studentId or delta' }, 400);
  }

  // 1. 读取当前金币
  const stuR = await sbSelectSingle(env, 'students', `id=eq.${studentId}&select=id,coins,xiandan`);
  if (stuR.error || !stuR.data || stuR.data.length === 0) {
    return jsonResponse({ error: 'Student not found' }, 404);
  }

  const student = stuR.data[0];
  const beforeCoins = student.coins || 0;

  // 2. 检查余额
  if (checkBalance && delta < 0 && beforeCoins + delta < 0) {
    return jsonResponse({ error: 'Insufficient balance', currentCoins: beforeCoins, required: Math.abs(delta) }, 409);
  }

  // 3. 计算新值并写入
  const newCoins = Math.max(0, beforeCoins + delta);
  const updateR = await sbUpdate(env, 'students', { coins: newCoins }, `id=eq.${studentId}`);
  if (updateR.error) {
    return jsonResponse({ error: 'Failed to update coins', details: updateR.error }, 500);
  }

  // 4. 写操作日志
  let logId = null;
  if (classId) {
    const log = {
      id: genId(),
      timestamp: new Date().toISOString(),
      classId, studentId, studentName: studentName || '',
      actionType: actionType || '', details: details || '',
      coinDelta: delta, expDelta, petId,
      snapshot: { coinsBefore: beforeCoins, coinsAfter: newCoins },
      reverted: false,
    };

    const logsR = await sbSelectSingle(env, 'classes', `id=eq.${classId}&select=operation_logs_json`);
    let existingLogs = [];
    if (logsR.data && logsR.data.length > 0 && logsR.data[0].operation_logs_json) {
      try { existingLogs = JSON.parse(logsR.data[0].operation_logs_json); } catch (e) {}
    }
    existingLogs.unshift(log);
    if (existingLogs.length > 3000) existingLogs = existingLogs.slice(0, 3000);

    await sbUpdate(env, 'classes', { operation_logs_json: JSON.stringify(existingLogs) }, `id=eq.${classId}`);
    logId = log.id;
  }

  return jsonResponse({ ok: true, coinsBefore: beforeCoins, coinsAfter: newCoins, delta, logId });
};
