/**
 * POST /api/snack/approve — 教师审批零食请求
 */
import { jsonResponse, handleOptions, checkEnv, sbSelectSingle, sbUpdate } from '../../_utils.js';

export const onRequestOptions = handleOptions;

export const onRequestPost = async ({ request, env }) => {
  const envErr = checkEnv(env);
  if (envErr) return envErr;

  const body = await request.json();
  const { studentId, requestId, approved, snackIndex, xiandanDelta = 0 } = body;

  if (!studentId) return jsonResponse({ error: 'Missing studentId' }, 400);

  const stuR = await sbSelectSingle(env, 'students', `id=eq.${studentId}&select=snack_requests,xiandan`);
  if (stuR.error || !stuR.data || stuR.data.length === 0) {
    return jsonResponse({ error: 'Student not found' }, 404);
  }

  const student = stuR.data[0];
  let snackRequests = [];
  try { snackRequests = JSON.parse(student.snack_requests || '[]'); } catch (e) {}

  // v183: 通过 requestId 匹配（客户端发送的是请求的唯一 id）
  // 旧代码用 snackIndex（字符串如 'milk_tea'）做数值比较，永远为 false，导致审批从未持久化
  let matched = false;
  if (requestId !== undefined && requestId !== null) {
    for (let i = 0; i < snackRequests.length; i++) {
      // 兼容 id 为数字或字符串
      if (String(snackRequests[i].id) === String(requestId)) {
        snackRequests[i].status = approved ? 'approved' : 'rejected';
        snackRequests[i].approvedAt = new Date().toISOString();
        if (!approved) snackRequests[i].rejectedAt = snackRequests[i].approvedAt;
        matched = true;
        break;
      }
    }
  }

  // 兜底：如果没有 requestId，尝试用数值 snackIndex（兼容旧客户端）
  if (!matched && snackIndex !== undefined && typeof snackIndex === 'number' && snackIndex >= 0 && snackIndex < snackRequests.length) {
    snackRequests[snackIndex].status = approved ? 'approved' : 'rejected';
    snackRequests[snackIndex].approvedAt = new Date().toISOString();
    if (!approved) snackRequests[snackIndex].rejectedAt = snackRequests[snackIndex].approvedAt;
    matched = true;
  }

  let newXiandan = student.xiandan || 0;
  if (xiandanDelta) {
    newXiandan = Math.max(0, newXiandan + xiandanDelta);
  }

  await sbUpdate(env, 'students', {
    snack_requests: JSON.stringify(snackRequests),
    xiandan: newXiandan,
  }, `id=eq.${studentId}`);

  return jsonResponse({ ok: true, xiandan: newXiandan, matched: matched });
};
