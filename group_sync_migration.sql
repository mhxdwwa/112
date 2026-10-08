-- v228: 分组数据云端同步
-- 添加分组相关字段到数据库

-- 1. 为 students 表添加 group_id 字段
ALTER TABLE students ADD COLUMN IF NOT EXISTS group_id TEXT;

-- 2. 为 classes 表添加 group_configs 字段
ALTER TABLE classes ADD COLUMN IF NOT EXISTS group_configs TEXT;

-- 说明：
-- group_id: 学生所属分组的ID（TEXT类型，因为分组ID是生成的字符串）
-- group_configs: 班级分组配置（JSON字符串，存储分组名称、颜色等）
-- 
-- 使用示例：
-- 更新学生分组：UPDATE students SET group_id = 'g123' WHERE id = 456;
-- 更新班级分组配置：UPDATE classes SET group_configs = '[{"id":"g1","name":"飞龙队","color":"#ff6b6b"}]' WHERE id = 123;
