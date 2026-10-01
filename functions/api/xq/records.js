/**
 * POST /api/xq/records — 学勤管家学生记录
 * 
 * Actions:
 * - get: 获取记录（支持筛选）
 * - add: 添加单条记录
 * - batch_add: 批量添加记录
 * - update: 更新记录
 * - delete: 删除记录
 * 
 * 权限控制:
 * - 所有老师可以读取所有记录
 * - 班主任只能写入/修改自己班级的记录
 * - 管理员（吴胜闯）可以修改/删除任何记录
 */
import { jsonResponse, handleOptions, checkEnv, sbSelect, sbInsert, sbUpdate, sbDelete } from '../../_utils.js';

export const onRequestOptions = handleOptions;

const ADMIN_NAME = '吴胜闯';

export const onRequestPost = async ({ request, env }) => {
  const envErr = checkEnv(env);
  if (envErr) return envErr;

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const { action, teacherId, teacherName } = body;

  // 验证管理员权限（直接检查用户名）
  const isAdmin = teacherName === ADMIN_NAME;

  // ===== GET: 获取记录 =====
  if (action === 'get') {
    const { className, studentName, recordType, startDate, endDate, limit } = body;
    
    let filter = '';
    const filters = [];
    
    if (className) filters.push(`class_name=eq.${encodeURIComponent(className)}`);
    if (studentName) filters.push(`student_name=eq.${encodeURIComponent(studentName)}`);
    if (recordType) filters.push(`record_type=eq.${recordType}`);
    if (startDate) filters.push(`record_date=gte.${startDate}`);
    if (endDate) filters.push(`record_date=lte.${endDate}`);
    
    filter = filters.join('&');
    if (!filter) filter = 'limit=1000';
    else filter += `&limit=${limit || 1000}`;
    filter += '&order=record_date.desc,created_at.desc';
    
    const result = await sbSelect(
      env, 
      'xq_records', 
      'id,teacher_id,teacher_name,class_name,student_name,student_id,record_date,record_type,subject,details,created_at,updated_at',
      filter
    );
    
    if (result.error) {
      return jsonResponse({ error: 'Failed to fetch records', details: result.error }, 500);
    }
    
    return jsonResponse({ ok: true, records: result.data || [] });
  }

  // ===== ADD: 添加单条记录 =====
  if (action === 'add') {
    if (!teacherId) {
      return jsonResponse({ error: 'Missing teacherId' }, 400);
    }

    const { className, studentName, studentId, recordDate, recordType, subject, details } = body;
    
    if (!className || !studentName || !recordType) {
      return jsonResponse({ error: 'Missing required fields: className, studentName, recordType' }, 400);
    }

    const insertResult = await sbInsert(env, 'xq_records', [{
      teacher_id: teacherId,
      teacher_name: teacherName || '',
      class_name: className,
      student_name: studentName,
      student_id: studentId || null,
      record_date: recordDate || new Date().toISOString().split('T')[0],
      record_type: recordType,
      subject: subject || null,
      details: details || {}
    }]);

    if (insertResult.error) {
      return jsonResponse({ error: 'Failed to add record', details: insertResult.error }, 500);
    }

    // 记录操作日志
    await sbInsert(env, 'xq_operation_logs', [{
      teacher_id: teacherId,
      teacher_name: teacherName || '',
      action_type: 'add_record',
      target_class: className,
      details: `添加${recordType}记录: ${studentName}`,
      record_count: 1
    }]);

    return jsonResponse({ ok: true, record: insertResult.data[0] });
  }

  // ===== BATCH_ADD: 批量添加记录 =====
  if (action === 'batch_add') {
    if (!teacherId) {
      return jsonResponse({ error: 'Missing teacherId' }, 400);
    }

    const { records } = body; // [{className, studentName, recordDate, recordType, subject, details}]
    
    if (!Array.isArray(records) || records.length === 0) {
      return jsonResponse({ error: 'Missing or empty records array' }, 400);
    }

    // 批量插入（Supabase 支持一次插入多条）
    const rowsToInsert = records.map(r => ({
      teacher_id: teacherId,
      teacher_name: teacherName || '',
      class_name: r.className,
      student_name: r.studentName,
      student_id: r.studentId || null,
      record_date: r.recordDate || new Date().toISOString().split('T')[0],
      record_type: r.recordType,
      subject: r.subject || null,
      details: r.details || {}
    }));

    const insertResult = await sbInsert(env, 'xq_records', rowsToInsert);

    if (insertResult.error) {
      return jsonResponse({ error: 'Failed to batch add records', details: insertResult.error }, 500);
    }

    // 记录操作日志
    const classSet = new Set(records.map(r => r.className));
    await sbInsert(env, 'xq_operation_logs', [{
      teacher_id: teacherId,
      teacher_name: teacherName || '',
      action_type: 'import_records',
      target_class: Array.from(classSet).join(','),
      details: `批量导入${records.length}条记录`,
      record_count: records.length
    }]);

    return jsonResponse({ ok: true, count: insertResult.data.length });
  }

  // ===== UPDATE: 更新记录 =====
  if (action === 'update') {
    const { recordId, updates } = body;
    
    if (!recordId || !updates) {
      return jsonResponse({ error: 'Missing recordId or updates' }, 400);
    }

    // 检查权限：只能更新自己的记录（除非是管理员）
    if (!isAdmin && teacherId) {
      const checkResult = await sbSelect(
        env, 
        'xq_records', 
        'teacher_id', 
        `id=eq.${recordId}&limit=1`
      );
      
      if (checkResult.error || !checkResult.data || checkResult.data.length === 0) {
        return jsonResponse({ error: 'Record not found' }, 404);
      }
      
      if (checkResult.data[0].teacher_id !== teacherId) {
        return jsonResponse({ error: 'Unauthorized: can only update own records' }, 403);
      }
    }

    updates.updated_at = new Date().toISOString();
    const updateResult = await sbUpdate(env, 'xq_records', updates, `id=eq.${recordId}`);

    if (updateResult.error) {
      return jsonResponse({ error: 'Failed to update record', details: updateResult.error }, 500);
    }

    return jsonResponse({ ok: true });
  }

  // ===== DELETE: 删除记录 =====
  if (action === 'delete') {
    const { recordId } = body;
    
    if (!recordId) {
      return jsonResponse({ error: 'Missing recordId' }, 400);
    }

    // 检查权限：只能删除自己的记录（除非是管理员）
    if (!isAdmin && teacherId) {
      const checkResult = await sbSelect(
        env, 
        'xq_records', 
        'teacher_id', 
        `id=eq.${recordId}&limit=1`
      );
      
      if (checkResult.error || !checkResult.data || checkResult.data.length === 0) {
        return jsonResponse({ error: 'Record not found' }, 404);
      }
      
      if (checkResult.data[0].teacher_id !== teacherId) {
        return jsonResponse({ error: 'Unauthorized: can only delete own records' }, 403);
      }
    }

    const deleteResult = await sbDelete(env, 'xq_records', `id=eq.${recordId}`);

    if (deleteResult.error) {
      return jsonResponse({ error: 'Failed to delete record', details: deleteResult.error }, 500);
    }

    return jsonResponse({ ok: true });
  }

  // ===== DELETE_BATCH: 批量删除记录 =====
  if (action === 'delete_batch') {
    const { recordIds } = body;
    
    if (!Array.isArray(recordIds) || recordIds.length === 0) {
      return jsonResponse({ error: 'Missing or empty recordIds array' }, 400);
    }

    // 检查权限：只能删除自己的记录（除非是管理员）
    if (!isAdmin && teacherId) {
      const checkResult = await sbSelect(
        env, 
        'xq_records', 
        'id,teacher_id', 
        `id=in.(${recordIds.join(',')})`
      );
      
      if (checkResult.error) {
        return jsonResponse({ error: 'Failed to check records' }, 500);
      }
      
      const unauthorized = (checkResult.data || []).filter(r => r.teacher_id !== teacherId);
      if (unauthorized.length > 0) {
        return jsonResponse({ error: 'Unauthorized: some records belong to other teachers' }, 403);
      }
    }

    const deleteResult = await sbDelete(env, 'xq_records', `id=in.(${recordIds.join(',')})`);

    if (deleteResult.error) {
      return jsonResponse({ error: 'Failed to delete records', details: deleteResult.error }, 500);
    }

    return jsonResponse({ ok: true, deleted: recordIds.length });
  }

  return jsonResponse({ error: 'Invalid action' }, 400);
};
