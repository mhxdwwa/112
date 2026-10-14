/**
 * POST /api/xq/exams — 学勤管家成绩管理
 * 
 * Actions:
 * - list: 获取考试列表（可按 teacher/class 筛选）
 * - get: 获取单个考试的详细成绩
 * - create: 创建考试并录入成绩
 * - delete: 删除考试及其成绩
 * - class_summary: 获取某班级所有科目的成绩概览（班主任用）
 */
import { jsonResponse, handleOptions, checkEnv, sbSelect, sbInsert, sbDelete } from '../../_utils.js';

export const onRequestOptions = handleOptions;

export const onRequestPost = async ({ request, env }) => {
  const envErr = checkEnv(env);
  if (envErr) return envErr;

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const { action } = body;

  // ===== LIST: 获取考试列表 =====
  if (action === 'list') {
    const { teacher, class: className } = body;
    let filter = 'order=exam_date.desc';
    if (teacher) filter += `&teacher=eq.${encodeURIComponent(teacher)}`;
    if (className) filter += `&class=eq.${encodeURIComponent(className)}`;
    
    const result = await sbSelect(env, 'xq_exams', 'id,teacher,class,subject,exam_name,exam_date,created_at', filter);
    if (result.error) {
      return jsonResponse({ error: 'Failed to fetch exams', details: result.error }, 500);
    }
    return jsonResponse({ ok: true, exams: result.data || [] });
  }

  // ===== GET: 获取单个考试的详细成绩 =====
  if (action === 'get') {
    const { examId } = body;
    if (!examId) {
      return jsonResponse({ error: 'Missing examId' }, 400);
    }

    // 获取考试信息
    const examResult = await sbSelect(env, 'xq_exams', 'id,teacher,class,subject,exam_name,exam_date', `id=eq.${examId}`);
    if (examResult.error || !examResult.data || examResult.data.length === 0) {
      return jsonResponse({ error: 'Exam not found' }, 404);
    }
    const exam = examResult.data[0];

    // 获取成绩
    const scoresResult = await sbSelect(env, 'xq_exam_scores', 'id,student,score', `exam_id=eq.${examId}&order=score.desc`);
    if (scoresResult.error) {
      return jsonResponse({ error: 'Failed to fetch scores', details: scoresResult.error }, 500);
    }

    return jsonResponse({ ok: true, exam, scores: scoresResult.data || [] });
  }

  // ===== CREATE: 创建考试并录入成绩 =====
  if (action === 'create') {
    const { teacher, class: className, subject, exam_name, exam_date, scores } = body;
    
    if (!teacher || !className || !subject || !exam_name || !exam_date) {
      return jsonResponse({ error: 'Missing required fields' }, 400);
    }
    if (!scores || !Array.isArray(scores) || scores.length === 0) {
      return jsonResponse({ error: 'No scores provided' }, 400);
    }

    // 插入考试
    const examInsert = await sbInsert(env, 'xq_exams', [{
      teacher,
      class: className,
      subject,
      exam_name,
      exam_date
    }]);

    if (examInsert.error || !examInsert.data || examInsert.data.length === 0) {
      return jsonResponse({ error: 'Failed to create exam', details: examInsert.error }, 500);
    }

    const examId = examInsert.data[0].id;

    // 批量插入成绩
    const scoreRecords = scores.map(s => ({
      exam_id: examId,
      student: s.student,
      score: parseFloat(s.score)
    }));

    const scoresInsert = await sbInsert(env, 'xq_exam_scores', scoreRecords);
    if (scoresInsert.error) {
      // 回滚：删除刚创建的考试
      await sbDelete(env, 'xq_exams', `id=eq.${examId}`);
      return jsonResponse({ error: 'Failed to save scores', details: scoresInsert.error }, 500);
    }

    return jsonResponse({ ok: true, examId, count: scores.length });
  }

  // ===== DELETE: 删除考试及其成绩 =====
  if (action === 'delete') {
    const { examId, teacher } = body;
    if (!examId) {
      return jsonResponse({ error: 'Missing examId' }, 400);
    }

    // 验证权限：只能删除自己的考试
    if (teacher) {
      const examResult = await sbSelect(env, 'xq_exams', 'teacher', `id=eq.${examId}`);
      if (examResult.error || !examResult.data || examResult.data.length === 0) {
        return jsonResponse({ error: 'Exam not found' }, 404);
      }
      if (examResult.data[0].teacher !== teacher) {
        return jsonResponse({ error: 'Unauthorized: cannot delete other teacher\'s exam' }, 403);
      }
    }

    // 删除成绩（级联删除会自动处理）
    const deleteResult = await sbDelete(env, 'xq_exams', `id=eq.${examId}`);
    if (deleteResult.error) {
      return jsonResponse({ error: 'Failed to delete exam', details: deleteResult.error }, 500);
    }

    return jsonResponse({ ok: true });
  }

  // ===== CLASS_SUMMARY: 获取某班级所有科目的成绩概览（班主任用）=====
  if (action === 'class_summary') {
    const { class: className } = body;
    if (!className) {
      return jsonResponse({ error: 'Missing class name' }, 400);
    }

    // 获取该班级所有考试
    const examsResult = await sbSelect(env, 'xq_exams', 'id,teacher,class,subject,exam_name,exam_date', `class=eq.${encodeURIComponent(className)}&order=exam_date.desc`);
    if (examsResult.error) {
      return jsonResponse({ error: 'Failed to fetch exams', details: examsResult.error }, 500);
    }

    const exams = examsResult.data || [];
    if (exams.length === 0) {
      return jsonResponse({ ok: true, summary: {} });
    }

    // 按科目分组
    const summary = {};
    for (const exam of exams) {
      const key = `${exam.subject}_${exam.teacher}`;
      if (!summary[key]) {
        summary[key] = {
          subject: exam.subject,
          teacher: exam.teacher,
          exams: []
        };
      }

      // 获取该考试的成绩统计
      const scoresResult = await sbSelect(env, 'xq_exam_scores', 'score', `exam_id=eq.${exam.id}`);
      const scores = (scoresResult.data || []).map(s => parseFloat(s.score));
      
      if (scores.length > 0) {
        const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
        const max = Math.max(...scores);
        const min = Math.min(...scores);

        summary[key].exams.push({
          id: exam.id,
          name: exam.exam_name,
          date: exam.exam_date,
          count: scores.length,
          avg: Math.round(avg * 10) / 10,
          max,
          min
        });
      }
    }

    return jsonResponse({ ok: true, summary });
  }

  // ===== STUDENT_HISTORY: 获取某学生某科目的成绩历史 =====
  if (action === 'student_history') {
    const { student, subject, class: className } = body;
    if (!student || !subject) {
      return jsonResponse({ error: 'Missing student or subject' }, 400);
    }

    // 获取该学生该科目的所有考试
    let examFilter = `subject=eq.${encodeURIComponent(subject)}`;
    if (className) examFilter += `&class=eq.${encodeURIComponent(className)}`;
    examFilter += '&order=exam_date.desc';

    const examsResult = await sbSelect(env, 'xq_exams', 'id,exam_name,exam_date,teacher', examFilter);
    if (examsResult.error) {
      return jsonResponse({ error: 'Failed to fetch exams', details: examsResult.error }, 500);
    }

    const exams = examsResult.data || [];
    const history = [];

    for (const exam of exams) {
      // 查询该学生在此考试的成绩
      const scoreResult = await sbSelect(env, 'xq_exam_scores', 'score', `exam_id=eq.${exam.id}&student=eq.${encodeURIComponent(student)}`);
      if (scoreResult.data && scoreResult.data.length > 0) {
        history.push({
          exam_id: exam.id,
          exam_name: exam.exam_name,
          exam_date: exam.exam_date,
          teacher: exam.teacher,
          score: parseFloat(scoreResult.data[0].score)
        });
      }
    }

    return jsonResponse({ ok: true, history });
  }

  return jsonResponse({ error: 'Invalid action' }, 400);
};
