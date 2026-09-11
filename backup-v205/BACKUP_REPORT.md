# 数据库备份报告 - v205

**备份时间**: 2026-09-11  
**备份分支**: `backup-before-migration-v205`  
**备份原因**: 准备迁移操作日志从 JSON 字段到独立表

---

## 1. 代码备份

- **GitHub 分支**: `backup-before-migration-v205`
- **当前版本**: v205
- **提交**: 包含所有到 v205 的修复

---

## 2. 数据库备份

### 2.1 班级数据 (classes.json)

| 班级ID | 班级名称 | 教师ID | JSON日志数 |
|--------|----------|--------|------------|
| 126 | 258班 | - | 551 条 |
| 140 | 253班 | - | 113 条 |
| 143 | 111班 | - | 406 条 |

**总计**: 3 个班级，1070 条日志在 JSON 字段中

**文件大小**: 1.2 MB

### 2.2 学生数据 (students.json)

| 班级ID | 班级名称 | 学生数 |
|--------|----------|--------|
| 126 | 258班 | 55 |
| 140 | 253班 | 54 |
| 143 | 111班 | 5 |

**总计**: 114 个学生

**文件大小**: 206 KB

### 2.3 宠物数据 (pets.json)

- **宠物总数**: 39 只
- **多宠物学生**: 0 个（每个学生最多1只宠物）

**文件大小**: 11 KB

### 2.4 操作日志表 (operation_logs_full.json)

**注意**: `operation_logs` 独立表已存在！

| 班级ID | 班级名称 | 表记录数 |
|--------|----------|----------|
| 126 | 258班 | 1000 条 |

**总计**: 1000 条记录（Supabase 默认限制）

**文件大小**: 473 KB

### 2.5 自定义奖惩 (custom_actions.json)

- **记录数**: 少量（202 bytes）

**文件大小**: 202 bytes

---

## 3. 关键发现

### 3.1 operation_logs 表已存在

独立表 `operation_logs` 已经存在并有数据（1000条记录，全部属于 Class 126）。

这意味着：
- 表结构已经创建好了
- 部分数据已经在独立表中
- 迁移工作可能比预期简单

### 3.2 数据分布

- **JSON 字段**: 1070 条日志（3个班级）
- **独立表**: 1000 条日志（仅 Class 126）

可能存在数据重复或不同步的情况，迁移时需要去重。

---

## 4. Supabase 恢复点

**重要**: 请在 Supabase 后台手动创建数据库恢复点：

1. 登录 Supabase 后台
2. 进入项目: `xbygooadskfqllnhwmet`
3. Database → Backups
4. 点击 "Create recovery point"

这是最可靠的备份方式，可以恢复到任意时间点。

---

## 5. 恢复步骤

### 5.1 代码恢复

```bash
# 切换到备份分支
git checkout backup-before-migration-v205

# 或者回到 master 的 v205 版本
git checkout master
git reset --hard <v205的commit-hash>
```

### 5.2 数据库恢复

**方式1: Supabase 恢复点（推荐）**
- 从 Supabase 后台恢复到备份时间点

**方式2: 导入备份文件**
```bash
# 导入 classes 表
curl -X POST "https://xbygooadskfqllnhwmet.supabase.co/rest/v1/classes" \
  -H "apikey: <service-key>" \
  -H "Authorization: Bearer <service-key>" \
  -H "Content-Type: application/json" \
  -H "Prefer: resolution=merge-duplicates" \
  --data @classes.json

# 导入 students 表
# ... 类似方式
```

**注意**: 导入前需要清空现有数据，或使用 upsert 策略。

---

## 6. 下一步

1. ✅ 创建 GitHub 备份分支
2. ✅ 导出所有数据库表
3. ⏳ 在 Supabase 后台创建恢复点（需要手动操作）
4. ⏳ 确认 operation_logs 表结构
5. ⏳ 开始迁移开发

---

## 7. 文件清单

```
/workspace/backup-v205/
├── BACKUP_REPORT.md          # 本报告
├── classes.json              # 班级数据（含 operation_logs_json）
├── students.json             # 学生数据
├── pets.json                 # 宠物数据
├── custom_actions.json       # 自定义奖惩
├── operation_logs_full.json  # operation_logs 表完整数据
└── operation_logs_sample.json # operation_logs 表样本数据
```

**总备份大小**: 1.9 MB
