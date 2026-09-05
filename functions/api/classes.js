/**
 * GET /api/classes?teacherId=xxx — 加载教师所有班级
 */
import { jsonResponse, handleOptions, checkEnv, sbSelect } from './_utils.js';

export const onRequestOptions = handleOptions;

export const onRequestGet = async ({ request, env }) => {
  const envErr = checkEnv(env);
  if (envErr) return envErr;

  const url = new URL(request.url);
  const teacherId = url.searchParams.get('teacherId');
  if (!teacherId) return jsonResponse({ error: 'Missing teacherId' }, 400);

  const classesR = await sbSelect(env, 'classes', 'id,name,teacher_id,created_at', `teacher_id=eq.${teacherId}&order=id`);
  if (classesR.error) return jsonResponse({ error: 'Failed to load classes' }, 500);

  const classes = classesR.data || [];
  if (classes.length === 0) return jsonResponse({ classes: [], students: [], pets: [] });

  const classIds = classes.map(c => c.id);
  const [studentsR, petsR, actionsR] = await Promise.all([
    sbSelect(env, 'students', 'id,name,class_id,coins,xiandan,last_checkin_date,last_jianghu_date,last_pk_date,active_pet_id,pk_count_today,password,quiz_state,snack_requests,shop_items,equipped_items', `class_id=in.(${classIds.join(',')})`),
    sbSelect(env, 'pets', 'id,student_id,name,nickname,level,growth,coins,is_active,is_dead,last_feed_date,last_play_date,today_feed_count,today_play_count,penalty_streak', `student_id=in.(${classIds.join(',')})`),
    sbSelect(env, 'custom_actions', '*', `class_id=in.(${classIds.join(',')})`),
  ]);

  return jsonResponse({
    classes: classesR.data || [],
    students: studentsR.data || [],
    pets: petsR.data || [],
    customActions: actionsR.data || [],
  });
};
