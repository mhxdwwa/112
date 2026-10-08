/**
 * POST /api/class/groups — 保存班级分组配置和学生分组
 * v238: 重写 — 批量更新 + 避免双重 Response 包装
 */
import { handleOptions, checkEnv, sbUpdate, CORS_HEADERS } from '../../_utils.js';

export const onRequestOptions = handleOptions;

function ok(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

export const onRequestPost = async ({ request, env }) => {
  try {
    const envErr = checkEnv(env);
    if (envErr) return envErr;

    const body = await request.json();
    const { classId, groupConfigs, studentGroups } = body;

    if (!classId) {
      return ok({ error: 'Missing classId' }, 400);
    }

    console.log('[groups] classId=' + classId +
      ' groups=' + (groupConfigs ? groupConfigs.length : 0) +
      ' students=' + (studentGroups ? studentGroups.length : 0));

    const errors = [];

    // 1. 更新班级分组配置
    if (groupConfigs !== undefined) {
      const r = await sbUpdate(env, 'classes',
        { group_configs: JSON.stringify(groupConfigs) },
        'id=eq.' + classId
      );
      if (r.error) {
        console.error('[groups] class err:', r.error.message || JSON.stringify(r.error));
        errors.push('class');
      }
    }

    // 2. 按 groupId 批量更新学生（大幅减少请求数）
    // 例: 55个学生分到4组+未分组 → 5个请求而非55个
    if (studentGroups && studentGroups.length > 0) {
      const batches = {};
      studentGroups.forEach(sg => {
        const key = sg.groupId || '_';
        if (!batches[key]) batches[key] = [];
        batches[key].push(sg.studentId);
      });

      for (const key of Object.keys(batches)) {
        const ids = batches[key];
        const gid = key === '_' ? null : key;
        const r = await sbUpdate(env, 'students',
          { group_id: gid },
          'id=in.(' + ids.join(',') + ')'
        );
        if (r.error) {
          console.error('[groups] batch err (gid=' + key + '):', r.error.message || JSON.stringify(r.error));
          errors.push('batch_' + key);
        }
      }
    }

    if (errors.length > 0) {
      return ok({ error: 'Updates failed', details: errors }, 500);
    }

    return ok({ ok: true });
  } catch (err) {
    console.error('[groups] exception:', err.message);
    return ok({ error: err.message || 'Internal error' }, 500);
  }
};
