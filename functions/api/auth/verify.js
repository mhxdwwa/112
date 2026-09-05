/**
 * POST /api/auth/verify — 验证登录身份
 * 
 * 替代前端直接调用 Supabase Auth / students 表验证。
 * 
 * 教师：验证 Supabase Auth session（通过 access_token）
 * 学生：验证学生 ID + class_id + name 是否匹配数据库记录
 */
import { jsonResponse, handleOptions, checkEnv, sbSelectSingle } from '../../_utils.js';

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

  const { type, accessToken, studentId, classId, studentName } = body;

  if (type === 'teacher') {
    // 教师验证：通过 Supabase Auth REST API 验证 access_token
    if (!accessToken) {
      return jsonResponse({ error: 'Missing accessToken' }, 400);
    }

    try {
      const userRes = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
        headers: {
          'apikey': env.SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!userRes.ok) {
        return jsonResponse({ ok: false, reason: 'Invalid session' });
      }

      const user = await userRes.json();
      return jsonResponse({
        ok: true,
        user: {
          id: user.id,
          email: user.email,
        },
      });
    } catch (e) {
      return jsonResponse({ ok: false, reason: e.message || 'Verification failed' });
    }

  } else if (type === 'student') {
    // 学生验证：检查学生记录是否存在且姓名匹配
    if (!studentId || !classId) {
      return jsonResponse({ error: 'Missing studentId or classId' }, 400);
    }

    const result = await sbSelectSingle(
      env,
      'students',
      `id=eq.${parseInt(studentId)}&select=id,name,class_id&class_id=eq.${parseInt(classId)}`
    );

    if (result.error || !result.data || result.data.length === 0) {
      return jsonResponse({ ok: false, reason: 'Student not found' });
    }

    const student = result.data[0];
    if (studentName && student.name !== studentName) {
      return jsonResponse({ ok: false, reason: 'Name mismatch' });
    }

    return jsonResponse({
      ok: true,
      student: {
        id: student.id,
        name: student.name,
        class_id: student.class_id,
      },
    });

  } else {
    return jsonResponse({ error: 'Invalid type, expected "teacher" or "student"' }, 400);
  }
};
