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

  console.log('[API] /class/groups request:', {
    classId,
    groupConfigsCount: groupConfigs ? groupConfigs.length : 0,
    studentGroupsCount: studentGroups ? studentGroups.length : 0
  });

  const updates = [];

  // 1. 更新班级分组配置
  if (groupConfigs !== undefined) {
    updates.push(
      sbUpdate(env, 'classes', { group_configs: JSON.stringify(groupConfigs) }, `id=eq.${classId}`)
    );
  }

  // 2. 更新学生分组ID（逐个更新，支持 null 值清除）
  if (studentGroups && Array.isArray(studentGroups) && studentGroups.length > 0) {
    studentGroups.forEach(sg => {
      const groupIdValue = sg.groupId || null;
      updates.push(
        sbUpdate(env, 'students', { group_id: groupIdValue }, `id=eq.${sg.studentId}`)
      );
    });
  }

  const results = await Promise.all(updates);
  const errors = results.filter(r => r.error);

  if (errors.length > 0) {
    console.error('[API] /class/groups errors:', errors);
    return jsonResponse({ error: 'Some updates failed', details: errors.map(e => e.error?.message || e.error) }, 500);
  }

  console.log('[API] /class/groups success: classId=' + classId + ', groups=' + (groupConfigs ? groupConfigs.length : 0) + ', students=' + (studentGroups ? studentGroups.length : 0));

  return jsonResponse({ 
    ok: true, 
    classId,
    groupConfigsUpdated: groupConfigs !== undefined,
    studentGroupsUpdated: studentGroups ? studentGroups.length : 0
  });
};
