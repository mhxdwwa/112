/**
 * POST /api/student/manage — 学生管理（添加、删除、重置密码）
 * v149: 兼容 { action, data:{...} } 和 { action, ...fields } 两种参数格式
 *        修复 operation_logs 表不存在的问题
 */
import { jsonResponse, handleOptions, checkEnv, sbInsert, sbDelete, sbUpdate, sbSelectSingle } from '../../_utils.js';

export const onRequestOptions = handleOptions;

export const onRequestPost = async ({ request, env }) => {
  const envErr = checkEnv(env);
  if (envErr) return envErr;

  const body = await request.json();
  // v149: 兼容两种参数格式
  const action = body.action || (body.data && body.data.action);
  const classId = body.classId || (body.data && body.data.classId);
  const name = body.name || (body.data && body.data.name);
  const password = body.password !== undefined ? body.password : (body.data && body.data.password);
  const studentIds = body.studentIds || (body.data && body.data.studentIds);

  if (action === 'add') {
    if (!classId || !name) return jsonResponse({ error: 'Missing classId or name' }, 400);
    const payload = { name, class_id: classId, coins: 0, xiandan: 0, password: password || '' };
    const insertR = await sbInsert(env, 'students', [payload]);
    if (insertR.error) return jsonResponse({ error: 'Failed to add student', details: insertR.error }, 500);
    return jsonResponse({ ok: true, student: insertR.data[0] });
  }

  if (action === 'delete') {
    if (!studentIds || studentIds.length === 0) return jsonResponse({ error: 'Missing studentIds' }, 400);
    const inFilter = `student_id=in.(${studentIds.join(',')})`;
    // v149: operation_logs 不是独立表，日志存在 classes.operation_logs_json 中
    // 删除学生时不需要单独清理日志
    await sbDelete(env, 'pets', inFilter);
    const delR = await sbDelete(env, 'students', `id=in.(${studentIds.join(',')})`);
    if (delR.error) return jsonResponse({ error: 'Failed to delete students', details: delR.error }, 500);
    return jsonResponse({ ok: true, deleted: studentIds.length });
  }

  if (action === 'resetPassword') {
    if (!studentIds || studentIds.length === 0) return jsonResponse({ error: 'Missing studentIds' }, 400);
    await Promise.all(studentIds.map(id =>
      sbUpdate(env, 'students', { password: password || '' }, `id=eq.${id}`)
    ));
    return jsonResponse({ ok: true });
  }

  return jsonResponse({ error: 'Invalid action' }, 400);
};
