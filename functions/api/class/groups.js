/**
 * POST /api/class/groups — 保存班级分组配置和学生分组
 * 
 * Body: {
 *   classId: number,
 *   groupConfigs: [{ id, name, color }],
 *   studentGroups: [{ studentId, groupId }]
 * }
 */
import { jsonResponse, handleOptions, checkEnv, sbUpdate } from '../../_utils.js';

export const onRequestOptions = handleOptions;

export const onRequestPost = async ({ request, env }) => {
  const envErr = checkEnv(env);
  if (envErr) return envErr;

  const body = await request.json();
  const { classId, groupConfigs, studentGroups } = body;

  if (!classId) {
    return jsonResponse({ error: 'Missing classId' }, 400);
  }

  const updates = [];

  // 1. 更新班级分组配置
  if (groupConfigs !== undefined) {
    updates.push(
      sbUpdate(env, 'classes', { group_configs: JSON.stringify(groupConfigs) }, `id=eq.${classId}`)
    );
  }

  // 2. 更新学生分组ID
  if (studentGroups && Array.isArray(studentGroups) && studentGroups.length > 0) {
    studentGroups.forEach(sg => {
      updates.push(
        sbUpdate(env, 'students', { group_id: sg.groupId || null }, `id=eq.${sg.studentId}`)
      );
    });
  }

  const results = await Promise.all(updates);
  const errors = results.filter(r => r.error);

  if (errors.length > 0) {
    console.error('[API] /class/groups errors:', errors);
    return jsonResponse({ error: 'Some updates failed', details: errors }, 500);
  }

  return jsonResponse({ 
    ok: true, 
    classId,
    groupConfigsUpdated: groupConfigs !== undefined,
    studentGroupsUpdated: studentGroups ? studentGroups.length : 0
  });
};
