/**
 * POST /api/snack/approve — 教师审批零食请求
 */
import { jsonResponse, handleOptions, checkEnv, sbSelectSingle, sbUpdate } from '../../_utils.js';

export const onRequestOptions = handleOptions;

export const onRequestPost = async ({ request, env }) => {
  const envErr = checkEnv(env);
  if (envErr) return envErr;

  const body = await request.json();
  const { studentId, approved, snackIndex, xiandanDelta = 0 } = body;

  if (!studentId) return jsonResponse({ error: 'Missing studentId' }, 400);

  const stuR = await sbSelectSingle(env, 'students', `id=eq.${studentId}&select=snack_requests,xiandan`);
  if (stuR.error || !stuR.data || stuR.data.length === 0) {
    return jsonResponse({ error: 'Student not found' }, 404);
  }

  const student = stuR.data[0];
  let snackRequests = [];
  try { snackRequests = JSON.parse(student.snack_requests || '[]'); } catch (e) {}

  if (snackIndex !== undefined && snackIndex >= 0 && snackIndex < snackRequests.length) {
    snackRequests[snackIndex].approved = approved;
    snackRequests[snackIndex].approvedAt = new Date().toISOString();
  }

  let newXiandan = student.xiandan || 0;
  if (xiandanDelta) {
    newXiandan = Math.max(0, newXiandan + xiandanDelta);
  }

  await sbUpdate(env, 'students', {
    snack_requests: JSON.stringify(snackRequests),
    xiandan: newXiandan,
  }, `id=eq.${studentId}`);

  return jsonResponse({ ok: true, xiandan: newXiandan });
};
