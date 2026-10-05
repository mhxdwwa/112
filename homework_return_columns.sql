-- 添加作业退回相关字段到 homework_submissions 表
-- 执行时间: 2026-10-05

-- 添加 returned 字段（是否已退回）
ALTER TABLE homework_submissions 
ADD COLUMN IF NOT EXISTS returned BOOLEAN DEFAULT FALSE;

-- 添加 return_reason 字段（退回原因）
ALTER TABLE homework_submissions 
ADD COLUMN IF NOT EXISTS return_reason TEXT DEFAULT '';

-- 添加索引（可选，提高查询性能）
CREATE INDEX IF NOT EXISTS idx_homework_submissions_returned 
ON homework_submissions(returned);
