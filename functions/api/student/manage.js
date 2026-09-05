/**
 * POST /api/student/manage — 学生管理（添加、删除、重置密码）
 */
import { jsonResponse, handleOptions, checkEnv, sbInsert, sbDelete, sbUpdate } from '../../_utils.js';

export const onRequestOptions = handleOptions;

export const onRequestPost = async ({ request, env }) => {
  const envErr = checkEnv(env);
  if (envErr) return envErr;

  const body = await request.json();
  const { action, classId, name, password, studentIds } = body;

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
    await sbDelete(env, 'operation_logs', inFilter);
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
