/**
 * POST /api/xq/clear — 学勤管家清除学期数据
 * 
 * Actions:
 * - clear_records: 清除所有学生记录（仅管理员）
 * - clear_config: 清除所有配置（仅管理员）
 * - clear_all: 清除所有数据（仅管理员）
 * 
 * 权限控制:
 * - 只有管理员（吴胜闯）可以清除数据
 */
import { jsonResponse, handleOptions, checkEnv, sbDelete, sbInsert } from '../../_utils.js';

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

  const { action, teacherName, confirmText } = body;

  // 验证管理员权限（直接检查用户名）
  const isAdmin = teacherName === ADMIN_NAME;
  
  if (!isAdmin) {
    return jsonResponse({ error: 'Unauthorized: 只有管理员才能清除数据' }, 403);
  }

  // 二次确认
  if (confirmText !== 'CONFIRM_DELETE') {
    return jsonResponse({ error: 'Please confirm by sending confirmText: "CONFIRM_DELETE"' }, 400);
  }

  // ===== CLEAR_RECORDS: 清除所有学生记录 =====
  if (action === 'clear_records') {
    // 先统计记录数（用于日志）
    const countResult = await fetch(`${env.SUPABASE_URL}/rest/v1/xq_records?select=count`, {
      headers: {
        'apikey': env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      }
    }).then(r => r.json()).catch(() => ({ count: 0 }));
    
    const recordCount = countResult.count || 0;

    // 删除所有记录
    const deleteResult = await sbDelete(env, 'xq_records', 'id=gt.0');
    
    if (deleteResult.error) {
      return jsonResponse({ error: 'Failed to clear records', details: deleteResult.error }, 500);
    }

    // 记录操作日志
    await sbInsert(env, 'xq_operation_logs', [{
      teacher_id: 'admin',
      teacher_name: teacherName || 'admin',
      action_type: 'clear_records',
      details: `清除学期数据: ${recordCount}条记录`,
      record_count: recordCount
    }]);

    return jsonResponse({ ok: true, deletedRecords: recordCount });
  }

  // ===== CLEAR_CONFIG: 清除所有配置 =====
  if (action === 'clear_config') {
    const deleteResult = await sbDelete(env, 'xq_school_config', 'id=gt.0');
    
    if (deleteResult.error) {
      return jsonResponse({ error: 'Failed to clear config', details: deleteResult.error }, 500);
    }

    // 记录操作日志
    await sbInsert(env, 'xq_operation_logs', [{
      teacher_id: 'admin',
      teacher_name: teacherName || 'admin',
      action_type: 'clear_config',
      details: '清除所有学校配置',
      record_count: 0
    }]);

    return jsonResponse({ ok: true });
  }

  // ===== CLEAR_ALL: 清除所有数据 =====
  if (action === 'clear_all') {
    // 删除记录
    const deleteRecordsResult = await sbDelete(env, 'xq_records', 'id=gt.0');
    if (deleteRecordsResult.error) {
      return jsonResponse({ error: 'Failed to clear records', details: deleteRecordsResult.error }, 500);
    }

    // 删除配置
    const deleteConfigResult = await sbDelete(env, 'xq_school_config', 'id=gt.0');
    if (deleteConfigResult.error) {
      return jsonResponse({ error: 'Failed to clear config', details: deleteConfigResult.error }, 500);
    }

    // 记录操作日志
    await sbInsert(env, 'xq_operation_logs', [{
      teacher_id: 'admin',
      teacher_name: teacherName || 'admin',
      action_type: 'clear_all',
      details: '清除所有数据（记录+配置）',
      record_count: 0
    }]);

    return jsonResponse({ ok: true });
  }

  // ===== CLEAR_CLASS: 删除单个班级的所有数据 =====
  if (action === 'clear_class') {
    const { className } = body;
    if (!className) {
      return jsonResponse({ error: 'Missing className' }, 400);
    }

    // 删除该班级的学生记录
    const deleteRecordsResult = await sbDelete(env, 'xq_records', `class_name=eq.${className}`);
    if (deleteRecordsResult.error) {
      return jsonResponse({ error: 'Failed to clear class records', details: deleteRecordsResult.error }, 500);
    }

    // 删除该班级的配置（students_xxx）
    const deleteConfigResult = await sbDelete(env, 'xq_school_config', `config_key=eq.students_${className}`);
    if (deleteConfigResult.error) {
      return jsonResponse({ error: 'Failed to clear class config', details: deleteConfigResult.error }, 500);
    }

    // 记录操作日志
    await sbInsert(env, 'xq_operation_logs', [{
      teacher_id: 'admin',
      teacher_name: teacherName || 'admin',
      action_type: 'clear_class',
      details: `删除班级 ${className}`,
      record_count: 0
    }]);

    return jsonResponse({ ok: true, deletedClass: className });
  }

  return jsonResponse({ error: 'Invalid action' }, 400);
};
