/**
 * 作业岛 API — 提交与批改
 * 
 * GET /api/homework/submissions?homework_id=X  — 查询某作业的所有提交
 * GET /api/homework/submissions?student_id=X   — 查询某学生的所有提交
 * POST /api/homework/submissions — 提交作业
 * PATCH /api/homework/submissions?id=X — 批改作业
 * 
 * Body (POST): {
 *   id: string,
 *   homework_id: string,
 *   student_id: number,
 *   student_name: string,
 *   image: string (base64)
 * }
 * 
 * Body (PATCH): {
 *   gradedImage: string (base64),
 *   grade: 'A+' | 'A' | 'B+' | 'B' | 'C',
 *   coins_awarded: number,
 *   comment: string
 * }
 */
import { jsonResponse, handleOptions, checkEnv, sbRequest, sbDelete, genId, deleteStorageFiles } from '../../_utils.js';

export const onRequestOptions = handleOptions;

// GET — 查询提交
export const onRequestGet = async ({ request, env }) => {
  const envErr = checkEnv(env);
  if (envErr) return envErr;

  const url = new URL(request.url);
  const homeworkId = url.searchParams.get('homework_id');
  const studentId = url.searchParams.get('student_id');

  if (!homeworkId && !studentId) {
    return jsonResponse({ error: 'Missing homework_id or student_id' }, 400);
  }

  try {
    let query = 'select=*';
    if (homeworkId) {
      query += `&homework_id=eq.${homeworkId}`;
    }
    if (studentId) {
      query += `&student_id=eq.${parseInt(studentId)}`;
    }
    query += '&order=submitted_at.desc';

    const result = await sbRequest(env, 'GET', 'homework_submissions', { query });
    if (result.error) {
      console.error('[submissions GET] Error:', result.error);
      return jsonResponse({ error: 'Query failed', details: result.error }, 500);
    }

    return jsonResponse({ ok: true, data: result.data || [] });
  } catch (err) {
    console.error('[submissions GET] Unexpected error:', err);
    return jsonResponse({ error: err.message || 'Unexpected error' }, 500);
  }
};

// POST — 提交作业
export const onRequestPost = async ({ request, env }) => {
  const envErr = checkEnv(env);
  if (envErr) return envErr;

  const body = await request.json();
  const { id, homework_id, student_id, student_name, image } = body;

  if (!homework_id || !student_id || !image) {
    return jsonResponse({ error: 'Missing required parameters' }, 400);
  }

  try {
    const subId = id || genId();
    const sid = parseInt(student_id);

    // 插入提交记录
    const result = await sbRequest(env, 'POST', 'homework_submissions', {
      body: [{
        id: subId,
        homework_id: homework_id,
        student_id: sid,
        student_name: student_name || '',
        image: image,
        submitted_at: new Date().toISOString()
      }]
    });

    if (result.error) {
      console.error('[submissions POST] Insert failed:', result.error);
      return jsonResponse({ error: 'Insert failed', details: result.error }, 500);
    }

    return jsonResponse({
      ok: true,
      id: subId,
      message: '作业已提交'
    });
  } catch (err) {
    console.error('[submissions POST] Unexpected error:', err);
    return jsonResponse({ error: err.message || 'Unexpected error' }, 500);
  }
};

// PATCH — 批改作业
export const onRequestPatch = async ({ request, env }) => {
  const envErr = checkEnv(env);
  if (envErr) return envErr;

  const url = new URL(request.url);
  const id = url.searchParams.get('id');

  if (!id) {
    return jsonResponse({ error: 'Missing id' }, 400);
  }

  const body = await request.json();
  const { gradedImage, grade, coins_awarded, comment } = body;

  if (!grade || !coins_awarded) {
    return jsonResponse({ error: 'Missing grade or coins_awarded' }, 400);
  }

  try {
    const updateData = {
      grade: grade,
      coins_awarded: parseInt(coins_awarded),
      comment: comment || '',
      graded_at: new Date().toISOString()
    };

    if (gradedImage) {
      updateData.graded_image = gradedImage;
    }

    const result = await sbRequest(env, 'PATCH', 'homework_submissions', {
      query: `id=eq.${id}`,
      body: updateData
    });

    if (result.error) {
      console.error('[submissions PATCH] Update failed:', result.error);
      return jsonResponse({ error: 'Update failed', details: result.error }, 500);
    }

    return jsonResponse({
      ok: true,
      message: '批改完成'
    });
  } catch (err) {
    console.error('[submissions PATCH] Unexpected error:', err);
    return jsonResponse({ error: err.message || 'Unexpected error' }, 500);
  }
};

// DELETE — 删除提交
export const onRequestDelete = async ({ request, env }) => {
  const envErr = checkEnv(env);
  if (envErr) return envErr;

  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  const homeworkId = url.searchParams.get('homework_id');

  if (!id && !homeworkId) {
    return jsonResponse({ error: 'Missing id or homework_id' }, 400);
  }

  try {
    let filter = '';
    if (id) {
      filter = `id=eq.${id}`;
    } else if (homeworkId) {
      filter = `homework_id=eq.${homeworkId}`;
    }

    // 1. 先查询要删除的提交记录，获取 Storage 文件路径
    const subsResult = await sbRequest(env, 'GET', 'homework_submissions', {
      query: `select=id,image,graded_image&${filter}`
    });
    const storageUrls = [];
    if (subsResult.data) {
      for (const sub of subsResult.data) {
        if (sub.image) storageUrls.push(sub.image);
        if (sub.graded_image) storageUrls.push(sub.graded_image);
      }
    }

    // 2. 删除 Storage 文件
    if (storageUrls.length > 0) {
      const deleted = await deleteStorageFiles(env, storageUrls);
      console.log(`[submissions DELETE] 已删除 ${deleted}/${storageUrls.length} 个 Storage 文件`);
    }

    // 3. 删除数据库记录
    const result = await sbDelete(env, 'homework_submissions', filter);
    if (result.error) {
      console.error('[submissions DELETE] Error:', result.error);
      return jsonResponse({ error: 'Delete failed', details: result.error }, 500);
    }

    return jsonResponse({ ok: true, message: '已删除（含 Storage 文件）' });
  } catch (err) {
    console.error('[submissions DELETE] Unexpected error:', err);
    return jsonResponse({ error: err.message || 'Unexpected error' }, 500);
  }
};
