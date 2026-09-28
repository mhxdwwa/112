/**
 * 作业岛 API — 分层管理
 * 
 * GET /api/homework/tiers?class_id=X  — 查询某班级的所有分层
 * POST /api/homework/tiers — 批量更新分层
 * DELETE /api/homework/tiers?class_id=X&student_id=Y — 删除某学生的分层
 * 
 * Body (POST): {
 *   class_id: number,
 *   updates: [
 *     { student_id: number, tier: 'A' | 'B' | 'C', action: 'add' | 'remove' }
 *   ]
 * }
 */
import { jsonResponse, handleOptions, checkEnv, sbRequest, sbDelete } from '../../_utils.js';

export const onRequestOptions = handleOptions;

// GET — 查询分层
export const onRequestGet = async ({ request, env }) => {
  const envErr = checkEnv(env);
  if (envErr) return envErr;

  const url = new URL(request.url);
  const classId = url.searchParams.get('class_id');

  if (!classId) {
    return jsonResponse({ error: 'Missing class_id' }, 400);
  }

  try {
    const cid = parseInt(classId);
    const result = await sbRequest(env, 'GET', 'homework_tiers', {
      query: `select=*&class_id=eq.${cid}`
    });

    if (result.error) {
      console.error('[tiers GET] Error:', result.error);
      return jsonResponse({ error: 'Query failed', details: result.error }, 500);
    }

    return jsonResponse({ ok: true, data: result.data || [] });
  } catch (err) {
    console.error('[tiers GET] Unexpected error:', err);
    return jsonResponse({ error: err.message || 'Unexpected error' }, 500);
  }
};

// POST — 批量更新分层
export const onRequestPost = async ({ request, env }) => {
  const envErr = checkEnv(env);
  if (envErr) return envErr;

  const body = await request.json();
  const { class_id, updates } = body;

  if (!class_id || !updates || !Array.isArray(updates)) {
    return jsonResponse({ error: 'Missing class_id or updates' }, 400);
  }

  try {
    const cid = parseInt(class_id);
    const results = { added: 0, removed: 0, errors: [] };

    for (const update of updates) {
      const { student_id, tier, action } = update;

      if (!student_id || !action) {
        results.errors.push({ student_id, error: 'Missing student_id or action' });
        continue;
      }

      const sid = parseInt(student_id);

      if (action === 'add') {
        if (!tier || !['A', 'B', 'C'].includes(tier)) {
          results.errors.push({ student_id, error: 'Invalid tier' });
          continue;
        }

        // 使用 upsert（先删后插）
        await sbDelete(env, 'homework_tiers', `class_id=eq.${cid}&student_id=eq.${sid}`);
        
        const insertResult = await sbRequest(env, 'POST', 'homework_tiers', {
          body: [{
            class_id: cid,
            student_id: sid,
            tier: tier,
            updated_at: new Date().toISOString()
          }]
        });

        if (insertResult.error) {
          console.warn('[tiers POST] Insert error for student', sid, insertResult.error);
          results.errors.push({ student_id, error: 'Insert failed' });
        } else {
          results.added++;
        }
      } else if (action === 'remove') {
        const delResult = await sbDelete(env, 'homework_tiers', `class_id=eq.${cid}&student_id=eq.${sid}`);
        if (delResult.error) {
          console.warn('[tiers POST] Delete error for student', sid, delResult.error);
          results.errors.push({ student_id, error: 'Delete failed' });
        } else {
          results.removed++;
        }
      } else {
        results.errors.push({ student_id, error: 'Invalid action: ' + action });
      }
    }

    return jsonResponse({
      ok: true,
      message: `分层更新完成：加入 ${results.added} 人，移除 ${results.removed} 人`,
      results: results
    });
  } catch (err) {
    console.error('[tiers POST] Unexpected error:', err);
    return jsonResponse({ error: err.message || 'Unexpected error' }, 500);
  }
};

// DELETE — 删除某学生的分层
export const onRequestDelete = async ({ request, env }) => {
  const envErr = checkEnv(env);
  if (envErr) return envErr;

  const url = new URL(request.url);
  const classId = url.searchParams.get('class_id');
  const studentId = url.searchParams.get('student_id');

  if (!classId || !studentId) {
    return jsonResponse({ error: 'Missing class_id or student_id' }, 400);
  }

  try {
    const result = await sbDelete(env, 'homework_tiers', 
      `class_id=eq.${parseInt(classId)}&student_id=eq.${parseInt(studentId)}`);
    
    if (result.error) {
      console.error('[tiers DELETE] Error:', result.error);
      return jsonResponse({ error: 'Delete failed', details: result.error }, 500);
    }

    return jsonResponse({ ok: true, message: '已移除分层' });
  } catch (err) {
    console.error('[tiers DELETE] Unexpected error:', err);
    return jsonResponse({ error: err.message || 'Unexpected error' }, 500);
  }
};
