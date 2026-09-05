/**
 * GET /api/class/:id — 加载单个班级（学生用）
 */
import { jsonResponse, handleOptions, checkEnv, sbSelect, sbSelectSingle } from '../../_utils.js';

export const onRequestOptions = handleOptions;

export const onRequestGet = async ({ request, env, params }) => {
  const envErr = checkEnv(env);
  if (envErr) return envErr;

  const classId = params.id;
  if (!classId) return jsonResponse({ error: 'Missing classId' }, 400);

  // Step 1: Load class and students
  const [classR, studentsR] = await Promise.all([
    sbSelectSingle(env, 'classes', `id=eq.${classId}&select=id,name,teacher_id`),
    sbSelect(env, 'students', 'id,name,class_id,coins,xiandan,last_checkin_date,last_jianghu_date,last_pk_date,active_pet_id,pk_count_today,password,quiz_state,snack_requests,shop_items,equipped_items', `class_id=eq.${classId}`),
  ]);

  if (classR.error || !classR.data || classR.data.length === 0) {
    return jsonResponse({ error: 'Class not found' }, 404);
  }

  // Step 2: Load pets using explicit student IDs (PostgREST doesn't support subqueries in filters)
  const students = studentsR.data || [];
  const studentIds = students.map(s => s.id);
  let pets = [];
  if (studentIds.length > 0) {
    const petsR = await sbSelect(env, 'pets', 'id,student_id,name,nickname,level,growth,coins,is_active,is_dead,last_feed_date,last_play_date,today_feed_count,today_play_count,penalty_streak', `student_id=in.(${studentIds.join(',')})`);
    pets = petsR.data || [];
  }

  return jsonResponse({
    class: classR.data[0],
    students: students,
    pets: pets,
  });
};
