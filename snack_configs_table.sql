-- 创建零食配置表（v193）
-- 用于存储教师的零食配置，实现跨设备同步

CREATE TABLE IF NOT EXISTS snack_configs (
  id SERIAL PRIMARY KEY,
  teacher_id INTEGER NOT NULL UNIQUE,
  config_data JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引以加快查询速度
CREATE INDEX IF NOT EXISTS idx_snack_configs_teacher_id ON snack_configs(teacher_id);

-- 添加注释
COMMENT ON TABLE snack_configs IS '教师零食配置表 - 存储每个教师的自定义零食配置';
COMMENT ON COLUMN snack_configs.teacher_id IS '教师ID（唯一）';
COMMENT ON COLUMN snack_configs.config_data IS '零食配置JSON数据';
