-- ============================================================
-- 学勤管家 — Supabase 表结构
-- 创建时间: 2026-09-30
-- 说明: 学生在校情况管理系统的数据库表
-- ============================================================

-- 1. 学校配置表（只有管理员能写入）
CREATE TABLE IF NOT EXISTS xq_school_config (
  id SERIAL PRIMARY KEY,
  config_key TEXT UNIQUE NOT NULL,      -- 'classes', 'teaching', 'roles', 'students'
  config_data JSONB NOT NULL DEFAULT '{}',
  updated_by TEXT,                       -- 管理员 user id
  updated_by_name TEXT,                  -- 管理员姓名（方便显示）
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 学生记录表（班主任写入自己的，所有人可读）
CREATE TABLE IF NOT EXISTS xq_records (
  id SERIAL PRIMARY KEY,
  teacher_id TEXT NOT NULL,              -- 录入老师的标识（username 或 user id）
  teacher_name TEXT,                     -- 老师姓名
  class_name TEXT NOT NULL,              -- 班级名称
  student_name TEXT NOT NULL,            -- 学生姓名
  student_id TEXT,                       -- 学生编号（可选）
  record_date DATE NOT NULL DEFAULT CURRENT_DATE,
  record_type TEXT NOT NULL,             -- 'attendance'考勤 / 'behavior'行为 / 'grade'成绩 / 'leave'请假 / 'mark'标记
  subject TEXT,                          -- 科目（成绩类才有）
  details JSONB DEFAULT '{}',            -- 具体内容（灵活存储）
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 操作日志表（审计追踪）
CREATE TABLE IF NOT EXISTS xq_operation_logs (
  id SERIAL PRIMARY KEY,
  teacher_id TEXT NOT NULL,
  teacher_name TEXT,
  action_type TEXT NOT NULL,             -- 'import_config' / 'import_records' / 'clear_records' / 'edit_record' / 'delete_record'
  target_class TEXT,                     -- 操作的班级
  details TEXT,                          -- 操作描述
  record_count INT DEFAULT 0,            -- 影响的记录数
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 索引（优化查询性能）
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_xq_records_teacher ON xq_records(teacher_id);
CREATE INDEX IF NOT EXISTS idx_xq_records_class ON xq_records(class_name);
CREATE INDEX IF NOT EXISTS idx_xq_records_date ON xq_records(record_date);
CREATE INDEX IF NOT EXISTS idx_xq_records_type ON xq_records(record_type);
CREATE INDEX IF NOT EXISTS idx_xq_logs_created ON xq_operation_logs(created_at DESC);

-- ============================================================
-- RLS 权限策略
-- 注意: 需要将 'YOUR_SUPABASE_USER_ID' 替换为实际的管理员 Supabase Auth user ID
-- ============================================================

-- 启用 RLS
ALTER TABLE xq_school_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE xq_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE xq_operation_logs ENABLE ROW LEVEL SECURITY;

-- ===== 学校配置表权限 =====
-- 所有人能读配置
DROP POLICY IF EXISTS "xq_all_read_config" ON xq_school_config;
CREATE POLICY "xq_all_read_config" ON xq_school_config
  FOR SELECT USING (true);

-- 只有管理员能插入/更新/删除配置
-- 注意: 使用 service_role key 的 API 调用会绕过 RLS
-- 所以权限控制在 API 层实现，这里只设置基本策略
DROP POLICY IF EXISTS "xq_service_write_config" ON xq_school_config;
CREATE POLICY "xq_service_write_config" ON xq_school_config
  FOR ALL USING (true);

-- ===== 学生记录表权限 =====
-- 所有人能读记录
DROP POLICY IF EXISTS "xq_all_read_records" ON xq_records;
CREATE POLICY "xq_all_read_records" ON xq_records
  FOR SELECT USING (true);

-- 允许插入（API 层验证权限）
DROP POLICY IF EXISTS "xq_insert_records" ON xq_records;
CREATE POLICY "xq_insert_records" ON xq_records
  FOR INSERT WITH CHECK (true);

-- 允许更新（API 层验证权限）
DROP POLICY IF EXISTS "xq_update_records" ON xq_records;
CREATE POLICY "xq_update_records" ON xq_records
  FOR UPDATE USING (true);

-- 允许删除（API 层验证权限）
DROP POLICY IF EXISTS "xq_delete_records" ON xq_records;
CREATE POLICY "xq_delete_records" ON xq_records
  FOR DELETE USING (true);

-- ===== 操作日志表权限 =====
-- 所有人能读日志
DROP POLICY IF EXISTS "xq_all_read_logs" ON xq_operation_logs;
CREATE POLICY "xq_all_read_logs" ON xq_operation_logs
  FOR SELECT USING (true);

-- 允许插入日志
DROP POLICY IF EXISTS "xq_insert_logs" ON xq_operation_logs;
CREATE POLICY "xq_insert_logs" ON xq_operation_logs
  FOR INSERT WITH CHECK (true);

-- ============================================================
-- 说明:
-- 1. 由于项目使用 Cloudflare Workers + service_role key 调用 Supabase，
--    RLS 策略实际上不会限制 API 请求（service_role 绕过 RLS）
-- 2. 真正的权限控制在 API 层实现:
--    - 管理员: 可以写入 xq_school_config，可以清除所有 xq_records
--    - 班主任: 只能写入自己的 xq_records（通过 teacher_id 标识）
--    - 所有老师: 可以读取所有数据
-- 3. 管理员身份验证通过 API 层的 adminKey 实现
-- ============================================================
