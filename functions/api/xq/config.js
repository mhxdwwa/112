/**
 * POST /api/xq/config — 学勤管家学校配置
 * 
 * Actions:
 * - get: 获取所有配置
 * - set: 设置配置（仅管理员）
 * 
 * 权限控制:
 * - 所有老师可以读取配置
 * - 只有管理员可以写入配置
 */
import { jsonResponse, handleOptions, checkEnv, sbSelect, sbInsert, sbUpdate, sbDelete } from '../../_utils.js';

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

  const { action, adminKey, configKey, configData, teacherName } = body;

  // 验证管理员密钥（用于写入操作）
  const isAdmin = adminKey && env.XQ_ADMIN_KEY && adminKey === env.XQ_ADMIN_KEY;

  // ===== GET: 获取所有配置 =====
  if (action === 'get') {
    const result = await sbSelect(env, 'xq_school_config', 'config_key,config_data,updated_by_name,updated_at', 'order=updated_at.desc');
    if (result.error) {
      return jsonResponse({ error: 'Failed to fetch config', details: result.error }, 500);
    }
    
    // 转换为 key-value 对象
    const config = {};
    (result.data || []).forEach(row => {
      config[row.config_key] = {
        data: row.config_data,
        updatedBy: row.updated_by_name,
        updatedAt: row.updated_at
      };
    });
    
    return jsonResponse({ ok: true, config });
  }

  // ===== SET: 设置配置（仅管理员）=====
  if (action === 'set') {
    if (!isAdmin) {
      return jsonResponse({ error: 'Unauthorized: admin access required' }, 403);
    }
    
    if (!configKey || !configData) {
      return jsonResponse({ error: 'Missing configKey or configData' }, 400);
    }

    // 尝试更新现有配置
    const updateResult = await sbUpdate(
      env, 
      'xq_school_config', 
      { 
        config_data: configData, 
        updated_by_name: teacherName || 'admin',
        updated_at: new Date().toISOString()
      }, 
      `config_key=eq.${configKey}`
    );

    // 如果更新失败（记录不存在），则插入新配置
    if (updateResult.error || !updateResult.data || updateResult.data.length === 0) {
      const insertResult = await sbInsert(env, 'xq_school_config', [{
        config_key: configKey,
        config_data: configData,
        updated_by_name: teacherName || 'admin'
      }]);
      
      if (insertResult.error) {
        return jsonResponse({ error: 'Failed to save config', details: insertResult.error }, 500);
      }
    }

    // 记录操作日志
    await sbInsert(env, 'xq_operation_logs', [{
      teacher_id: 'admin',
      teacher_name: teacherName || 'admin',
      action_type: 'import_config',
      details: `更新配置: ${configKey}`,
      record_count: 1
    }]);

    return jsonResponse({ ok: true });
  }

  // ===== SET_ALL: 批量设置所有配置（仅管理员）=====
  if (action === 'set_all') {
    if (!isAdmin) {
      return jsonResponse({ error: 'Unauthorized: admin access required' }, 403);
    }

    const configs = body.configs; // { classes: {...}, teaching: {...}, roles: {...}, students: {...} }
    if (!configs || typeof configs !== 'object') {
      return jsonResponse({ error: 'Missing configs object' }, 400);
    }

    let successCount = 0;
    for (const [key, data] of Object.entries(configs)) {
      // 尝试更新
      const updateResult = await sbUpdate(
        env,
        'xq_school_config',
        { 
          config_data: data, 
          updated_by_name: teacherName || 'admin',
          updated_at: new Date().toISOString()
        },
        `config_key=eq.${key}`
      );

      // 如果不存在则插入
      if (updateResult.error || !updateResult.data || updateResult.data.length === 0) {
        await sbInsert(env, 'xq_school_config', [{
          config_key: key,
          config_data: data,
          updated_by_name: teacherName || 'admin'
        }]);
      }
      successCount++;
    }

    // 记录操作日志
    await sbInsert(env, 'xq_operation_logs', [{
      teacher_id: 'admin',
      teacher_name: teacherName || 'admin',
      action_type: 'import_config',
      details: `批量更新配置: ${Object.keys(configs).join(', ')}`,
      record_count: successCount
    }]);

    return jsonResponse({ ok: true, updated: successCount });
  }

  // ===== DELETE: 删除配置（仅管理员）=====
  if (action === 'delete') {
    if (!isAdmin) {
      return jsonResponse({ error: 'Unauthorized: admin access required' }, 403);
    }

    if (!configKey) {
      return jsonResponse({ error: 'Missing configKey' }, 400);
    }

    const deleteResult = await sbDelete(env, 'xq_school_config', `config_key=eq.${configKey}`);
    if (deleteResult.error) {
      return jsonResponse({ error: 'Failed to delete config', details: deleteResult.error }, 500);
    }

    return jsonResponse({ ok: true });
  }

  return jsonResponse({ error: 'Invalid action' }, 400);
};
