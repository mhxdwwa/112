/**
 * POST /api/xq/config — 学勤管家学校配置
 * 
 * Actions:
 * - get: 获取所有配置（所有人可读取）
 * - set: 设置单个配置（管理员可设置任何配置，班主任/科任老师只能设置自己班级的 seating_XXX）
 * - set_all: 批量设置所有配置（管理员可设置任何配置，班主任/科任老师只能设置自己班级的 seating_XXX）
 * - delete: 删除配置（仅管理员 吴胜闯）
 * 
 * 权限控制: teacherName === '吴胜闯' 即为管理员
 * 班主任/科任老师只能保存自己班级的座位表数据（seating_XXX）
 */
import { jsonResponse, handleOptions, checkEnv, sbSelect, sbInsert, sbUpdate, sbDelete } from '../../_utils.js';

export const onRequestOptions = handleOptions;

const ADMIN_NAME = '吴胜闯';

function isAdmin(body) {
  return body.teacherName === ADMIN_NAME;
}

// 检查是否是教师可以保存的配置键（只允许 seating_XXX）
function isTeacherAllowedKey(key) {
  return key && key.startsWith('seating_');
}

// 检查教师是否有权限保存该配置
function canTeacherSave(body, key) {
  // 管理员可以保存任何配置
  if (isAdmin(body)) return true;
  // 非管理员只能保存自己班级的座位表数据
  if (body.teacherName && isTeacherAllowedKey(key)) return true;
  return false;
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

  // ===== SET: 设置单个配置（管理员可设置任何配置，教师只能设置自己班级的 seating_XXX）=====
  if (action === 'set') {
    if (!configKey || !configData) {
      return jsonResponse({ error: 'Missing configKey or configData' }, 400);
    }
    
    // 权限检查
    if (!isAdmin(body) && !canTeacherSave(body, configKey)) {
      return jsonResponse({ error: 'Unauthorized: 班主任/科任老师只能保存自己班级的座位表数据' }, 403);
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

  // ===== SET_ALL: 批量设置所有配置（管理员可设置任何配置，教师只能设置自己班级的 seating_XXX）=====
  if (action === 'set_all') {
    const configs = body.configs;
    if (!configs || typeof configs !== 'object') {
      return jsonResponse({ error: 'Missing configs object' }, 400);
    }

    // 权限检查：非管理员只能保存 seating_XXX 配置
    if (!isAdmin(body)) {
      const nonSeatingKeys = Object.keys(configs).filter(key => !key.startsWith('seating_'));
      if (nonSeatingKeys.length > 0) {
        return jsonResponse({ error: 'Unauthorized: 班主任/科任老师只能保存座位表数据（seating_XXX）' }, 403);
      }
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
