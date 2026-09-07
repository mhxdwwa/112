/**
 * GET /api/snack/config?teacherId=xxx — 获取零食配置
 * POST /api/snack/config — 保存零食配置
 */
import { jsonResponse, handleOptions, checkEnv, sbSelect, sbRequest } from '../../_utils.js';

export const onRequestOptions = handleOptions;

// GET: 获取零食配置
export const onRequestGet = async ({ request, env, params }) => {
  const envErr = checkEnv(env);
  if (envErr) return envErr;

  const url = new URL(request.url);
  const teacherId = url.searchParams.get('teacherId');

  if (!teacherId) {
    return jsonResponse({ error: 'Missing teacherId' }, 400);
  }

  try {
    const { data, error } = await sbSelect(env, 'snack_configs', 'config_data', `teacher_id=eq.${teacherId}`);

    if (error) {
      console.error('[snack/config] GET error:', error);
      return jsonResponse({ error: error.message }, 500);
    }

    // sbSelect 返回数组，取第一条
    const config = data && data.length > 0 ? data[0].config_data : null;
    return jsonResponse({ config });
  } catch (err) {
    console.error('[snack/config] GET exception:', err);
    return jsonResponse({ error: err.message }, 500);
  }
};

// POST: 保存零食配置
export const onRequestPost = async ({ request, env }) => {
  const envErr = checkEnv(env);
  if (envErr) return envErr;

  try {
    const body = await request.json();
    const { teacherId, config } = body;

    if (!teacherId) {
      return jsonResponse({ error: 'Missing teacherId' }, 400);
    }

    if (!config || !Array.isArray(config)) {
      return jsonResponse({ error: 'Invalid config data' }, 400);
    }

    // 先查询是否已存在
    const { data: existing, error: selectError } = await sbSelect(env, 'snack_configs', 'id', `teacher_id=eq.${teacherId}`);
    
    if (selectError) {
      console.error('[snack/config] POST select error:', selectError);
      return jsonResponse({ error: selectError.message }, 500);
    }

    let result;
    if (existing && existing.length > 0) {
      // 已存在，更新
      result = await sbRequest(env, 'PATCH', 'snack_configs', {
        query: `teacher_id=eq.${teacherId}`,
        body: {
          config_data: config,
          updated_at: new Date().toISOString()
        }
      });
    } else {
      // 不存在，插入
      result = await sbRequest(env, 'POST', 'snack_configs', {
        body: {
          teacher_id: teacherId,
          config_data: config,
          updated_at: new Date().toISOString()
        }
      });
    }

    if (result.error) {
      console.error('[snack/config] POST error:', result.error);
      return jsonResponse({ error: result.error.message }, 500);
    }

    return jsonResponse({ ok: true, config });
  } catch (err) {
    console.error('[snack/config] POST exception:', err);
    return jsonResponse({ error: err.message }, 500);
  }
};
