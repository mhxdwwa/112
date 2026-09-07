/**
 * GET /api/snack/config?teacherId=xxx — 获取零食配置
 * POST /api/snack/config — 保存零食配置
 */
import { jsonResponse, handleOptions, checkEnv } from '../../_utils.js';

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
    const { data, error } = await env.SB_URL
      .from('snack_configs')
      .select('config_data')
      .eq('teacher_id', teacherId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // 记录不存在，返回空配置
        return jsonResponse({ config: null });
      }
      console.error('[snack/config] GET error:', error);
      return jsonResponse({ error: error.message }, 500);
    }

    return jsonResponse({ config: data.config_data });
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

    // 使用 upsert 确保只有一个配置记录
    const { data, error } = await env.SB_URL
      .from('snack_configs')
      .upsert({
        teacher_id: teacherId,
        config_data: config,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'teacher_id'
      })
      .select()
      .single();

    if (error) {
      console.error('[snack/config] POST error:', error);
      return jsonResponse({ error: error.message }, 500);
    }

    return jsonResponse({ ok: true, config: data.config_data });
  } catch (err) {
    console.error('[snack/config] POST exception:', err);
    return jsonResponse({ error: err.message }, 500);
  }
};
