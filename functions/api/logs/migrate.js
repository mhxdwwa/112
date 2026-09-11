/**
 * POST /api/logs/migrate — 将 classes.operation_logs_json 迁移到 operation_logs 独立表
 * v222: 优化为最少子请求数，避免 Cloudflare Workers 子请求限制
 * 
 * 使用方式：POST /api/logs/migrate
 * 可选参数：{ classId: 126 } — 只迁移指定班级（不传则迁移所有）
 */
import { jsonResponse, handleOptions, checkEnv, sbRequest } from '../../_utils.js';

export const onRequestOptions = handleOptions;

export const onRequestPost = async ({ request, env }) => {
  const envErr = checkEnv(env);
  if (envErr) return envErr;

  try {
    // 解析可选参数
    let targetClassId = null;
    try {
      const body = await request.json();
      targetClassId = body.classId || null;
    } catch (_) { /* no body, migrate all */ }

    // Step 1: 读取班级数据（1 个子请求）
    let classesQuery = 'select=id,name,operation_logs_json';
    if (targetClassId) {
      classesQuery += '&id=eq.' + targetClassId;
    }
    const classesR = await sbRequest(env, 'GET', 'classes', { query: classesQuery });
    if (classesR.error) {
      return jsonResponse({ error: 'Failed to read classes', details: classesR.error }, 500);
    }

    const results = [];
    let totalMigrated = 0;
    let totalSkipped = 0;

    for (const cls of (classesR.data || [])) {
      if (!cls.operation_logs_json) {
        results.push({ classId: cls.id, className: cls.name, total: 0, migrated: 0, skipped: 0 });
        continue;
      }

      let logs = [];
      try {
        var _raw = cls.operation_logs_json;
        logs = typeof _raw === 'string' ? JSON.parse(_raw) : (_raw || []);
      } catch (e) {
        results.push({ classId: cls.id, className: cls.name, error: 'JSON parse error: ' + e.message });
        continue;
      }

      if (!Array.isArray(logs) || logs.length === 0) {
        results.push({ classId: cls.id, className: cls.name, total: 0, migrated: 0, skipped: 0 });
        continue;
      }

      let classMigrated = 0;

      // 大批次插入（每批 100 条），减少子请求数
      const BATCH_SIZE = 100;
      for (let i = 0; i < logs.length; i += BATCH_SIZE) {
        const batch = logs.slice(i, i + BATCH_SIZE);
        const rows = batch.map(function(log) {
          return {
            id: log.id,
            class_id: cls.id,
            student_id: log.studentId || null,
            student_name: log.studentName || '',
            action_type: log.actionType || '',
            details: log.details || '',
            coin_delta: parseInt(log.coinDelta) || 0,
            exp_delta: parseInt(log.expDelta) || 0,
            pet_id: log.petId || null,
            snapshot: log.snapshot || null,
            extra: log.extra || null,
            full_snapshot: log.fullSnapshot || null,
            reverted: !!log.reverted,
            created_at: log.timestamp || new Date().toISOString()
          };
        });

        // on_conflict=id 自动跳过已存在的记录
        const insertR = await sbRequest(env, 'POST', 'operation_logs', {
          query: 'on_conflict=id',
          body: rows
        });

        if (insertR.error) {
          console.error('[migrate] Batch INSERT error for class', cls.id, ':', insertR.error);
          // 继续处理下一批
        } else {
          classMigrated += rows.length;
        }
      }

      totalMigrated += classMigrated;
      results.push({
        classId: cls.id,
        className: cls.name,
        total: logs.length,
        migrated: classMigrated
      });
    }

    return jsonResponse({
      ok: true,
      totalMigrated: totalMigrated,
      details: results
    });

  } catch (err) {
    console.error('[migrate] Error:', err);
    return jsonResponse({ error: err.message || 'Migration failed' }, 500);
  }
};
