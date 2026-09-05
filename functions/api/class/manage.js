/**
 * POST /api/class/manage — 班级管理（创建、更新、删除）
 */
import { jsonResponse, handleOptions, checkEnv, sbSelectSingle, sbInsert, sbUpdate, sbDelete } from '../../_utils.js';

export const onRequestOptions = handleOptions;

export const onRequestPost = async ({ request, env }) => {
  const envErr = checkEnv(env);
  if (envErr) return envErr;

  const body = await request.json();
  const { action, teacherId, classId, name } = body;

  if (action === 'create') {
    if (!name || !teacherId) return jsonResponse({ error: 'Missing name or teacherId' }, 400);
    const insertR = await sbInsert(env, 'classes', [{ name, teacher_id: teacherId }]);
    if (insertR.error) return jsonResponse({ error: 'Failed to create class', details: insertR.error }, 500);
    return jsonResponse({ ok: true, classId: insertR.data[0].id, name });
  }

  if (action === 'update') {
    if (!classId || !name) return jsonResponse({ error: 'Missing classId or name' }, 400);
    const updateR = await sbUpdate(env, 'classes', { name }, `id=eq.${classId}`);
    if (updateR.error) return jsonResponse({ error: 'Failed to update class', details: updateR.error }, 500);
    return jsonResponse({ ok: true });
  }

  if (action === 'delete') {
    if (!classId) return jsonResponse({ error: 'Missing classId' }, 400);
    const stuR = await sbSelectSingle(env, 'students', `class_id=eq.${classId}&select=id`);
    const studentIds = (stuR.data || []).map(s => s.id);

    if (studentIds.length > 0) {
      const inFilter = `student_id=in.(${studentIds.join(',')})`;
      await sbDelete(env, 'operation_logs', inFilter);
      await sbDelete(env, 'pets', inFilter);
    }
    await sbDelete(env, 'students', `class_id=eq.${classId}`);
    await sbDelete(env, 'custom_actions', `class_id=eq.${classId}`);
    const classR = await sbDelete(env, 'classes', `id=eq.${classId}`);
    if (classR.error) return jsonResponse({ error: 'Failed to delete class', details: classR.error }, 500);
    return jsonResponse({ ok: true, deletedStudents: studentIds.length });
  }

  return jsonResponse({ error: 'Invalid action' }, 400);
};
