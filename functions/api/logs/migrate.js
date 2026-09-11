/**
 * POST /api/logs/migrate — 将 classes.operation_logs_json 迁移到 operation_logs 独立表
 * 
 * 迁移步骤：
 * 1. 确保 operation_logs 表存在且结构正确
 * 2. 读取所有班级的 operation_logs_json
 * 3. 逐条 INSERT 到 operation_logs 表（跳过已存在的 id）
 * 4. 返回迁移结果
 * 
 * 注意：此端点仅在迁移时使用，迁移完成后可删除
 */
import { jsonResponse, handleOptions, checkEnv, sbRequest, sbSelectSingle } from '../../_utils.js';

export const onRequestOptions = handleOptions;

export const onRequestPost = async ({ request, env }) => {
  const envErr = checkEnv(env);
  if (envErr) return envErr;

  try {
    // Step 1: 确保 operation_logs 表存在
    // 使用 Supabase REST API 执行 SQL（通过 rpc 或直接查询表结构）
    // 先尝试查询表，如果失败说明表不存在
    const tableCheck = await sbRequest(env, 'GET', 'operation_logs', {
      query: 'select=id&limit=1'
    });

    if (tableCheck.error && tableCheck.error.message && tableCheck.error.message.includes('does not exist')) {
      // 表不存在，需要通过 SQL 创建
      // 使用 Supabase Management API 或返回错误让用户手动创建
      return jsonResponse({
        error: 'operation_logs table does not exist. Please create it first using the SQL in the migration guide.',
        sql: `CREATE TABLE IF NOT EXISTS operation_logs (
  id text PRIMARY KEY,
  class_id integer NOT NULL,
  student_id integer,
  student_name text DEFAULT '',
  action_type text DEFAULT '',
  details text DEFAULT '',
  coin_delta integer DEFAULT 0,
  exp_delta integer DEFAULT 0,
  pet_id integer,
  snapshot jsonb,
  extra jsonb,
  full_snapshot jsonb,
  reverted boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_operation_logs_class_id ON operation_logs(class_id);
CREATE INDEX IF NOT EXISTS idx_operation_logs_created_at ON operation_logs(created_at DESC);`
      }, 400);
    }

    // Step 2: 读取所有班级数据
    const classesR = await sbRequest(env, 'GET', 'classes', {
      query: 'select=id,name,operation_logs_json'
    });
    if (classesR.error) {
      return jsonResponse({ error: 'Failed to read classes', details: classesR.error }, 500);
    }

    const results = [];
    let totalMigrated = 0;
    let totalSkipped = 0;
    let totalFailed = 0;

    for (const cls of (classesR.data || [])) {
      if (!cls.operation_logs_json) {
        results.push({ classId: cls.id, className: cls.name, migrated: 0, skipped: 0, failed: 0 });
        continue;
      }

      let logs = [];
      try {
        var _raw = cls.operation_logs_json;
        logs = typeof _raw === 'string' ? JSON.parse(_raw) : (_raw || []);
      } catch (e) {
        results.push({ classId: cls.id, className: cls.name, error: 'Failed to parse JSON: ' + e.message });
        continue;
      }

      if (!Array.isArray(logs) || logs.length === 0) {
        results.push({ classId: cls.id, className: cls.name, migrated: 0, skipped: 0, failed: 0 });
        continue;
      }

      let classMigrated = 0;
      let classSkipped = 0;
      let classFailed = 0;

      // 分批插入（每批 50 条），避免请求过大
      const BATCH_SIZE = 50;
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

        // 使用 upsert（on_conflict do nothing）避免重复
        const insertR = await sbRequest(env, 'POST', 'operation_logs', {
          query: 'on_conflict=id',
          body: rows
        });

        if (insertR.error) {
          // 如果批量插入失败，尝试逐条插入
          for (const row of rows) {
            const singleR = await sbRequest(env, 'POST', 'operation_logs', {
              query: 'on_conflict=id',
              body: [row]
            });
            if (singleR.error) {
              if (singleR.error.message && singleR.error.message.includes('duplicate')) {
                classSkipped++;
              } else {
                classFailed++;
              }
            } else {
              classMigrated++;
            }
          }
        } else {
          classMigrated += rows.length;
        }
      }

      totalMigrated += classMigrated;
      totalSkipped += classSkipped;
      totalFailed += classFailed;
      results.push({
        classId: cls.id,
        className: cls.name,
        total: logs.length,
        migrated: classMigrated,
        skipped: classSkipped,
        failed: classFailed
      });
    }

    // Step 3: 验证迁移结果
    const verifyR = await sbRequest(env, 'GET', 'operation_logs', {
      query: 'select=class_id&id=gt.0'
    });
    let tableCount = 0;
    if (!verifyR.error && verifyR.data) {
      // 按 class_id 统计
      const countByClass = {};
      verifyR.data.forEach(function(r) {
        countByClass[r.class_id] = (countByClass[r.class_id] || 0) + 1;
      });
      tableCount = verifyR.data.length;
    }

    return jsonResponse({
      ok: true,
      summary: {
        totalMigrated: totalMigrated,
        totalSkipped: totalSkipped,
        totalFailed: totalFailed,
        totalInTable: tableCount
      },
      details: results
    });

  } catch (err) {
    console.error('[migrate] Error:', err);
    return jsonResponse({ error: err.message || 'Migration failed' }, 500);
  }
};
