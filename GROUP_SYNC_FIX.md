# 分组数据云端同步修复说明

## 问题描述
之前分组数据（分组配置和学生的分组ID）只保存在本地 localStorage 中，没有同步到云端数据库。导致：
- 在其他设备上登录看不到分组信息
- 清除浏览器数据后分组丢失
- 分组数据无法在不同账户间同步

## 解决方案
已将分组数据添加到云端同步机制中。

### 修改内容

#### 1. 数据库字段（需要手动执行 SQL）
需要在 Supabase 数据库中执行以下 SQL：

```sql
-- 为学生表添加分组ID字段
ALTER TABLE students ADD COLUMN IF NOT EXISTS group_id TEXT;

-- 为班级表添加分组配置字段
ALTER TABLE classes ADD COLUMN IF NOT EXISTS group_configs TEXT;
```

**执行步骤：**
1. 登录 Supabase 控制台
2. 进入你的项目
3. 打开 SQL Editor
4. 执行上面的 SQL 语句
5. 或者运行项目中的 `group_sync_migration.sql` 文件

#### 2. 代码修改（已自动部署）

**dal.js (v229.0)**
- 学生更新时同步 `group_id` 到云端
- 班级创建/更新时同步 `group_configs` 到云端
- 从云端加载时读取 `group_id` 和 `group_configs`

**functions/api/classes.js**
- API 返回数据中包含 `group_configs`（班级分组配置）
- API 返回数据中包含 `group_id`（学生分组ID）

**functions/api/student/update.js**
- 允许通过 API 更新 `group_id` 字段

## 使用说明

### 第一步：执行数据库迁移
在 Supabase SQL Editor 中执行：
```sql
ALTER TABLE students ADD COLUMN IF NOT EXISTS group_id TEXT;
ALTER TABLE classes ADD COLUMN IF NOT EXISTS group_configs TEXT;
```

### 第二步：测试分组功能
1. 刷新页面（确保加载最新代码 v229）
2. 创建或编辑分组
3. 分配学生到分组
4. 在其他设备上登录，验证分组数据已同步

### 第三步：验证同步
- 在电脑 A 上创建分组并分配学生
- 在电脑 B 或手机上登录同一账户
- 应该能看到相同的分组信息

## 技术细节

### 数据结构
```javascript
// 班级对象
{
  id: 123,
  name: "三年级1班",
  groupConfigs: [  // 新增：同步到 classes.group_configs
    { id: "g1", name: "飞龙队", color: "#ff6b6b" },
    { id: "g2", name: "猛虎队", color: "#4ecdc4" }
  ],
  students: [
    { 
      id: 1, 
      name: "张三", 
      groupId: "g1",  // 新增：同步到 students.group_id
      coins: 50,
      // ...
    }
  ]
}
```

### 同步机制
- **保存时**：`saveClassData()` → `_syncToSupabase()` → 更新 `students.group_id` 和 `classes.group_configs`
- **加载时**：`_loadTeacherFromSupabase()` → `_buildTeacherClasses()` → 读取 `group_id` 和 `group_configs`

### API 端点
- `GET /api/classes` - 返回包含 `group_configs` 和 `group_id`
- `POST /api/student/update` - 允许更新 `group_id`

## 版本信息
- **版本**: v229.0
- **提交**: cf81014
- **日期**: 2026-01-08

## 注意事项
1. **必须先执行 SQL 迁移**，否则分组数据无法保存到数据库
2. 执行 SQL 后，现有班级的分组数据不会自动迁移（因为之前没有保存）
3. 需要重新创建分组或手动更新数据库
4. 新创建的分组会自动同步到云端

## 故障排查

### 分组仍然无法同步
1. 检查是否已执行 SQL 迁移
2. 检查浏览器控制台是否有错误
3. 确认使用的是 v229 或更高版本
4. 清除浏览器缓存后重试

### 数据库字段检查
```sql
-- 检查字段是否已添加
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'students' AND column_name = 'group_id';

SELECT column_name FROM information_schema.columns 
WHERE table_name = 'classes' AND column_name = 'group_configs';
```

## 相关文件
- `dal.js` - 数据访问层，处理云端同步
- `functions/api/classes.js` - 班级数据 API
- `functions/api/student/update.js` - 学生更新 API
- `group_sync_migration.sql` - 数据库迁移脚本
- `app.js` - 前端分组管理逻辑（v224-v228）
