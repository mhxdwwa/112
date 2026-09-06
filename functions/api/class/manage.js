/**
 * POST /api/class/manage — 班级管理（创建、更新、删除、查重）
 * v149: 兼容 { action, data:{...} } 和 { action, ...fields } 两种参数格式
 *        修复 operation_logs 表不存在的问题（日志存在 classes.operation_logs_json 中）
 *        新增 action=checkDuplicate 用于创建班级前查重
 */
import { jsonResponse, handleOptions, checkEnv, sbSelectSingle, sbInsert, sbUpdate, sbDelete, sbSelect } from '../../_utils.js';

export const onRequestOptions = handleOptions;

export const onRequestPost = async ({ request, env }) => {
  const envErr = checkEnv(env);
  if (envErr) return envErr;

  const body = await request.json();
  // v149: 兼容两种参数格式
  const action = body.action || (body.data && body.data.action);
  const teacherId = body.teacherId || (body.data && body.data.teacherId);
  const classId = body.classId || (body.data && body.data.classId);
  const name = body.name || (body.data && body.data.name);

  if (action === 'checkDuplicate') {
    if (!name) return jsonResponse({ error: 'Missing name' }, 400);
    const dupR = await sbSelect(env, 'classes', 'id,name,teacher_id', `name=eq.${encodeURIComponent(name)}&limit=1`);
    if (dupR.error) return jsonResponse({ error: 'Query failed', details: dupR.error }, 500);
    const exists = dupR.data && dupR.data.length > 0;
    return jsonResponse({ ok: true, exists, existingClass: exists ? dupR.data[0] : null });
  }

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
    // v184: 检查读取学生列表是否成功
    if (stuR.error) return jsonResponse({ error: 'Failed to query students', details: stuR.error }, 500);
    const studentIds = (stuR.data || []).map(s => s.id);

    if (studentIds.length > 0) {
      const inFilter = `student_id=in.(${studentIds.join(',')})`;
      // v149: operation_logs 不是独立表，日志存在 classes.operation_logs_json 中
      // 删除班级时不需要单独清理日志，因为班级本身会被删除
      // v184: 检查每步删除结果，失败时立即中止，避免部分删除导致数据不一致
      const petsR = await sbDelete(env, 'pets', inFilter);
      if (petsR.error) return jsonResponse({ error: 'Failed to delete pets', details: petsR.error }, 500);
    }
    const stuDelR = await sbDelete(env, 'students', `class_id=eq.${classId}`);
    if (stuDelR.error) return jsonResponse({ error: 'Failed to delete students', details: stuDelR.error }, 500);
    const caR = await sbDelete(env, 'custom_actions', `class_id=eq.${classId}`);
    if (caR.error) return jsonResponse({ error: 'Failed to delete custom actions', details: caR.error }, 500);
    const classR = await sbDelete(env, 'classes', `id=eq.${classId}`);
    if (classR.error) return jsonResponse({ error: 'Failed to delete class', details: classR.error }, 500);
    return jsonResponse({ ok: true, deletedStudents: studentIds.length });
  }

  return jsonResponse({ error: 'Invalid action' }, 400);
};
