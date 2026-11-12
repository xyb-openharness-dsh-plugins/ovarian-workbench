-- 001-subjects.sql — 档案主体登记表（迁移只增不改：已应用的迁移文件不再编辑）
--
-- 为什么要有这张表（2026-11-13 C 缺口）：
--   0.1.56 及之前，工作台只有一份 state.json 里的 `subject` 单主体，顶栏没有"新建档案"入口，
--   用户在 demo 之外没办法记录自己的事。多档案之后，"有哪些档案、哪个是演示"需要一个
--   可查询的登记表，而不是只埋在某个 JSON 字段里。
--
-- 约定：
--   profile_key = '<数据根指纹>:<档案 id>'。数据根指纹是数据目录绝对路径的 sha256 前 16 位，
--   所以换一个资料目录不会把另一个目录的档案混进来（真正的数据仍住在 workspace-v1.json）。
--   is_demo = 1 的两套模拟档案不可删除；用户自建档案写 0。
--   app_setting 存当前数据根等设置项，作为 settings-v1.json 的落库副本。
CREATE TABLE IF NOT EXISTS subjects (
  profile_key TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  meta TEXT NOT NULL DEFAULT '{}',
  is_demo INTEGER NOT NULL DEFAULT 0,
  created_on TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS app_setting (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_on TEXT NOT NULL
);
