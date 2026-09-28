/**
 * 作业岛 API — 作业管理
 * 
 * GET /api/homework?class_id=X&tier=Y  — 查询作业（可选按层级）
 * POST /api/homework — 发布作业（同层级自动替换旧作业）
 * DELETE /api/homework?id=X — 删除作业
 * 
 * Body (POST): {
 *   id: string,
 *   class_id: number,
 *   tier: 'A' | 'B' | 'C',
 *   title: string,
 *   description: string,
 *   image: string (base64)
 * }
 */
import { jsonResponse, handleOptions, checkEnv, sbRequest, sbSelect, sbDelete, genId } from '../../_utils.js';

export const onRequestOptions = handleOptions;

// GET — 查询作业
export const onRequestGet = async ({ request, env }) => {
  const envErr = checkEnv(env);
  if (envErr) return envErr;

  const url = new URL(request.url);
  const classId = url.searchParams.get('class_id');
  const tier = url.searchParams.get('tier');

  if (!classId) {
    return jsonResponse({ error: 'Missing class_id' }, 400);
  }

  try {
    let query = `select=*&class_id=eq.${parseInt(classId)}`;
    if (tier && ['A', 'B', 'C'].includes(tier)) {
      query += `&tier=eq.${tier}`;
    }
    query += '&order=created_at.desc';

    const result = await sbRequest(env, 'GET', 'homework', { query });
    if (result.error) {
      console.error('[homework GET] Error:', result.error);
      return jsonResponse({ error: 'Query failed', details: result.error }, 500);
    }

    return jsonResponse({ ok: true, data: result.data || [] });
  } catch (err) {
    console.error('[homework GET] Unexpected error:', err);
    return jsonResponse({ error: err.message || 'Unexpected error' }, 500);
  }
};

// POST — 发布作业（同层级自动替换）
export const onRequestPost = async ({ request, env }) => {
  const envErr = checkEnv(env);
  if (envErr) return envErr;

  const body = await request.json();
  const { id, class_id, tier, title, description, image } = body;

  if (!class_id || !tier || !title || !image) {
    return jsonResponse({ error: 'Missing required parameters' }, 400);
  }

  if (!['A', 'B', 'C'].includes(tier)) {
    return jsonResponse({ error: 'Invalid tier' }, 400);
  }

  try {
    const cid = parseInt(class_id);
    const hwId = id || genId();

    // 1. 查找该层级的旧作业
    const oldHwResult = await sbRequest(env, 'GET', 'homework', {
      query: `select=id&class_id=eq.${cid}&tier=eq.${tier}`
    });

    if (oldHwResult.data && oldHwResult.data.length > 0) {
      const oldHwIds = oldHwResult.data.map(h => h.id);

      // 2. 删除旧作业的所有提交记录
      for (const oldId of oldHwIds) {
        await sbDelete(env, 'homework_submissions', `homework_id=eq.${oldId}`);
      }

      // 3. 删除旧作业
      const delResult = await sbDelete(env, 'homework', `class_id=eq.${cid}&tier=eq.${tier}`);
      if (delResult.error) {
        console.warn('[homework POST] Delete old homework warning:', delResult.error);
      }
    }

    // 4. 插入新作业
    const insertResult = await sbRequest(env, 'POST', 'homework', {
      body: [{
        id: hwId,
        class_id: cid,
        tier: tier,
        title: title,
        description: description || '',
        image: image,
        created_at: new Date().toISOString()
      }]
    });

    if (insertResult.error) {
      console.error('[homework POST] Insert failed:', insertResult.error);
      return jsonResponse({ error: 'Insert failed', details: insertResult.error }, 500);
    }

    return jsonResponse({
      ok: true,
      id: hwId,
      message: '作业已发布（旧作业及提交已清理）'
    });
  } catch (err) {
    console.error('[homework POST] Unexpected error:', err);
    return jsonResponse({ error: err.message || 'Unexpected error' }, 500);
  }
};

// DELETE — 删除作业（级联删除提交记录）
export const onRequestDelete = async ({ request, env }) => {
  const envErr = checkEnv(env);
  if (envErr) return envErr;

  const url = new URL(request.url);
  const id = url.searchParams.get('id');

  if (!id) {
    return jsonResponse({ error: 'Missing id' }, 400);
  }

  try {
    // 1. 先删除该作业的所有提交记录
    const subsResult = await sbRequest(env, 'GET', 'homework_submissions', {
      query: `select=id&homework_id=eq.${id}`
    });
    if (subsResult.data && subsResult.data.length > 0) {
      await sbDelete(env, 'homework_submissions', `homework_id=eq.${id}`);
      console.log(`[homework DELETE] Deleted ${subsResult.data.length} submissions for homework ${id}`);
    }

    // 2. 删除作业
    const result = await sbDelete(env, 'homework', `id=eq.${id}`);
    if (result.error) {
      console.error('[homework DELETE] Error:', result.error);
      return jsonResponse({ error: 'Delete failed', details: result.error }, 500);
    }

    return jsonResponse({ ok: true, message: '作业及提交已删除' });
  } catch (err) {
    console.error('[homework DELETE] Unexpected error:', err);
    return jsonResponse({ error: err.message || 'Unexpected error' }, 500);
  }
};
