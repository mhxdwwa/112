/**
 * POST /api/xq/import — 学勤管家批量导入
 * 
 * Actions:
 * - students: 批量导入学生数据（班主任导入本班学生）
 * - attendance: 批量导入考勤数据
 * - records: 批量导入各类记录
 * 
 * 权限控制:
 * - 班主任只能导入自己班级的数据
 * - 管理员可以导入任何班级的数据
 */
import { jsonResponse, handleOptions, checkEnv, sbInsert, sbSelect } from '../../_utils.js';

export const onRequestOptions = handleOptions;

export const onRequestPost = async ({ request, env }) => {
  const envErr = checkEnv(env);
  if (envErr) return envErr;

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const { action, adminKey, teacherId, teacherName, teacherClasses } = body;

  // 验证管理员密钥
  const isAdmin = adminKey && env.XQ_ADMIN_KEY && adminKey === env.XQ_ADMIN_KEY;

  // 验证班主任班级权限
  function canAccessClass(className) {
    if (isAdmin) return true;
    if (!teacherClasses || !Array.isArray(teacherClasses)) return false;
    return teacherClasses.includes(className);
  }

  // ===== STUDENTS: 批量导入学生数据到配置表 =====
  if (action === 'students') {
    if (!teacherId) {
      return jsonResponse({ error: 'Missing teacherId' }, 400);
    }

    const { className, students } = body; // [{name, studentId, gender, ...}]
    
    if (!className) {
      return jsonResponse({ error: 'Missing className' }, 400);
    }

    if (!canAccessClass(className)) {
      return jsonResponse({ error: 'Unauthorized: cannot access this class' }, 403);
    }

    if (!Array.isArray(students) || students.length === 0) {
      return jsonResponse({ error: 'Missing or empty students array' }, 400);
    }

    // 将学生数据存储到 xq_school_config 表（作为配置的一部分）
    const configData = {
      className,
      students: students,
      importedBy: teacherName,
      importedAt: new Date().toISOString()
    };

    // 尝试更新现有配置
    const updateResult = await fetch(`${env.SUPABASE_URL}/rest/v1/xq_school_config?config_key=eq.students_${className}`, {
      method: 'PATCH',
      headers: {
        'apikey': env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        config_data: configData,
        updated_by_name: teacherName
      })
    }).then(r => r.json()).catch(() => null);

    // 如果不存在则插入
    if (!updateResult || updateResult.length === 0) {
      await sbInsert(env, 'xq_school_config', [{
        config_key: `students_${className}`,
        config_data: configData,
        updated_by_name: teacherName
      }]);
    }

    // 记录操作日志
    await sbInsert(env, 'xq_operation_logs', [{
      teacher_id: teacherId,
      teacher_name: teacherName || '',
      action_type: 'import_students',
      target_class: className,
      details: `导入${students.length}名学生数据`,
      record_count: students.length
    }]);

    return jsonResponse({ ok: true, count: students.length });
  }

  // ===== ATTENDANCE: 批量导入考勤数据 =====
  if (action === 'attendance') {
    if (!teacherId) {
      return jsonResponse({ error: 'Missing teacherId' }, 400);
    }

    const { records } = body; // [{className, studentName, recordDate, status, ...}]
    
    if (!Array.isArray(records) || records.length === 0) {
      return jsonResponse({ error: 'Missing or empty records array' }, 400);
    }

    // 验证所有班级权限
    const classes = new Set(records.map(r => r.className));
    for (const cls of classes) {
      if (!canAccessClass(cls)) {
        return jsonResponse({ error: `Unauthorized: cannot access class ${cls}` }, 403);
      }
    }

    // 转换为标准记录格式
    const rowsToInsert = records.map(r => ({
      teacher_id: teacherId,
      teacher_name: teacherName || '',
      class_name: r.className,
      student_name: r.studentName,
      student_id: r.studentId || null,
      record_date: r.recordDate || new Date().toISOString().split('T')[0],
      record_type: 'attendance',
      details: {
        status: r.status, // 'present', 'absent', 'leave', 'late'
        reason: r.reason || null,
        ...r.details
      }
    }));

    const insertResult = await sbInsert(env, 'xq_records', rowsToInsert);

    if (insertResult.error) {
      return jsonResponse({ error: 'Failed to import attendance', details: insertResult.error }, 500);
    }

    // 记录操作日志
    await sbInsert(env, 'xq_operation_logs', [{
      teacher_id: teacherId,
      teacher_name: teacherName || '',
      action_type: 'import_attendance',
      target_class: Array.from(classes).join(','),
      details: `批量导入${records.length}条考勤记录`,
      record_count: records.length
    }]);

    return jsonResponse({ ok: true, count: insertResult.data.length });
  }

  // ===== RECORDS: 批量导入各类记录 =====
  if (action === 'records') {
    if (!teacherId) {
      return jsonResponse({ error: 'Missing teacherId' }, 400);
    }

    const { records } = body; // [{className, studentName, recordDate, recordType, subject, details}]
    
    if (!Array.isArray(records) || records.length === 0) {
      return jsonResponse({ error: 'Missing or empty records array' }, 400);
    }

    // 验证所有班级权限
    const classes = new Set(records.map(r => r.className));
    for (const cls of classes) {
      if (!canAccessClass(cls)) {
        return jsonResponse({ error: `Unauthorized: cannot access class ${cls}` }, 403);
      }
    }

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
      return jsonResponse({ error: 'Failed to import records', details: insertResult.error }, 500);
    }

    // 记录操作日志
    await sbInsert(env, 'xq_operation_logs', [{
      teacher_id: teacherId,
      teacher_name: teacherName || '',
      action_type: 'import_records',
      target_class: Array.from(classes).join(','),
      details: `批量导入${records.length}条记录`,
      record_count: records.length
    }]);

    return jsonResponse({ ok: true, count: insertResult.data.length });
  }

  return jsonResponse({ error: 'Invalid action' }, 400);
};
