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
  let matchedIdx = -1;
  if (requestId !== undefined && requestId !== null) {
    for (let i = 0; i < snackRequests.length; i++) {
      // 兼容 id 为数字或字符串
      if (String(snackRequests[i].id) === String(requestId)) {
        matchedIdx = i;
        matched = true;
        break;
      }
    }
  }

  // 兜底：如果没有 requestId，尝试用数值 snackIndex（兼容旧客户端）
  if (!matched && snackIndex !== undefined && typeof snackIndex === 'number' && snackIndex >= 0 && snackIndex < snackRequests.length) {
    matchedIdx = snackIndex;
    matched = true;
  }

  // v184: 防重复处理 — 如果请求已经不是 pending 状态，直接返回，避免双击导致重复退款
  if (matched && matchedIdx >= 0) {
    const req = snackRequests[matchedIdx];
    if (req.status && req.status !== 'pending') {
      return jsonResponse({ ok: true, alreadyProcessed: true, status: req.status, xiandan: student.xiandan || 0 });
    }
    // 状态检查通过，执行审批/拒绝
    req.status = approved ? 'approved' : 'rejected';
    req.approvedAt = new Date().toISOString();
    if (!approved) req.rejectedAt = req.approvedAt;
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
