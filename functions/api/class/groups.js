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
  console.log('[API] /class/groups 收到请求');
  const envErr = checkEnv(env);
  if (envErr) {
    console.error('[API] /class/groups 环境检查失败:', envErr);
    return envErr;
  }

  const body = await request.json();
  const { classId, groupConfigs, studentGroups } = body;

  console.log('[API] /class/groups 请求数据:', {
    classId,
    groupConfigsCount: groupConfigs ? groupConfigs.length : 0,
    studentGroupsCount: studentGroups ? studentGroups.length : 0,
    groupConfigs: groupConfigs,
    studentGroupsSample: studentGroups ? studentGroups.slice(0, 3) : []
  });

  if (!classId) {
    console.error('[API] /class/groups 缺少 classId');
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
    console.log('[API] /class/groups 更新班级分组配置, classId:', classId, 'groupConfigs:', JSON.stringify(groupConfigs));
    updates.push(
      sbUpdate(env, 'classes', { group_configs: JSON.stringify(groupConfigs) }, `id=eq.${classId}`)
    );
  }

  // 2. 更新学生分组ID（逐个更新，支持 null 值清除）
  if (studentGroups && Array.isArray(studentGroups) && studentGroups.length > 0) {
    console.log('[API] /class/groups 更新学生分组, 数量:', studentGroups.length);
    studentGroups.forEach(sg => {
      const groupIdValue = sg.groupId || null;
      console.log('[API] /class/groups 更新学生:', sg.studentId, 'groupId:', groupIdValue);
      updates.push(
        sbUpdate(env, 'students', { group_id: groupIdValue }, `id=eq.${sg.studentId}`)
      );
    });
  }

  console.log('[API] /class/groups 执行', updates.length, '个更新操作');
  const results = await Promise.all(updates);
  const errors = results.filter(r => r.error);

  if (errors.length > 0) {
    console.error('[API] /class/groups 更新失败:', errors);
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
