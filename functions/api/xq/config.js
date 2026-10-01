/**
 * POST /api/xq/config — 学勤管家学校配置
 * 
 * Actions:
 * - get: 获取所有配置（所有人可读取）
 * - set: 设置单个配置（仅管理员 吴胜闯）
 * - set_all: 批量设置所有配置（仅管理员 吴胜闯）
 * - delete: 删除配置（仅管理员 吴胜闯）
 * 
 * 权限控制: teacherName === '吴胜闯' 即为管理员，无需密钥
 */
import { jsonResponse, handleOptions, checkEnv, sbSelect, sbInsert, sbUpdate, sbDelete } from '../../_utils.js';

export const onRequestOptions = handleOptions;

const ADMIN_NAME = '吴胜闯';

function isAdmin(body) {
  return body.teacherName === ADMIN_NAME;
}

export const onRequestPost = async ({ request, env }) => {
  const envErr = checkEnv(env);
  if (envErr) return envErr;

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const { action, configKey, configData, teacherName } = body;

  // ===== GET: 获取所有配置（所有人可读取）=====
  if (action === 'get') {
    const result = await sbSelect(env, 'xq_school_config', 'config_key,config_data,updated_by_name,updated_at', 'order=updated_at.desc');
    if (result.error) {
      return jsonResponse({ error: 'Failed to fetch config', details: result.error }, 500);
    }
    
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

  // ===== SET: 设置单个配置（仅管理员）=====
  if (action === 'set') {
    if (!isAdmin(body)) {
      return jsonResponse({ error: 'Unauthorized: 只有管理员才能修改配置' }, 403);
    }
    
    if (!configKey || !configData) {
      return jsonResponse({ error: 'Missing configKey or configData' }, 400);
    }

    const updateResult = await sbUpdate(
      env, 
      'xq_school_config', 
      { 
        config_data: configData, 
        updated_by_name: teacherName,
        updated_at: new Date().toISOString()
      }, 
      `config_key=eq.${configKey}`
    );

    if (updateResult.error || !updateResult.data || updateResult.data.length === 0) {
      const insertResult = await sbInsert(env, 'xq_school_config', [{
        config_key: configKey,
        config_data: configData,
        updated_by_name: teacherName
      }]);
      
      if (insertResult.error) {
        return jsonResponse({ error: 'Failed to save config', details: insertResult.error }, 500);
      }
    }

    return jsonResponse({ ok: true });
  }

  // ===== SET_ALL: 批量设置所有配置（仅管理员）=====
  if (action === 'set_all') {
    if (!isAdmin(body)) {
      return jsonResponse({ error: 'Unauthorized: 只有管理员才能修改配置' }, 403);
    }

    const configs = body.configs;
    if (!configs || typeof configs !== 'object') {
      return jsonResponse({ error: 'Missing configs object' }, 400);
    }

    let successCount = 0;
    for (const [key, data] of Object.entries(configs)) {
      const updateResult = await sbUpdate(
        env,
        'xq_school_config',
        { 
          config_data: data, 
          updated_by_name: teacherName,
          updated_at: new Date().toISOString()
        },
        `config_key=eq.${key}`
      );

      if (updateResult.error || !updateResult.data || updateResult.data.length === 0) {
        await sbInsert(env, 'xq_school_config', [{
          config_key: key,
          config_data: data,
          updated_by_name: teacherName
        }]);
      }
      successCount++;
    }

    return jsonResponse({ ok: true, updated: successCount });
  }

  // ===== DELETE: 删除配置（仅管理员）=====
  if (action === 'delete') {
    if (!isAdmin(body)) {
      return jsonResponse({ error: 'Unauthorized: 只有管理员才能修改配置' }, 403);
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
