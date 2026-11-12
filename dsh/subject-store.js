/**
 * 档案主体登记表（node:sqlite）。
 *
 * 落库位置：`<config.root>/subjects-v1.sqlite3`（DSH 分配的本机工作台配置目录），
 * 不是用户选的病历目录——用户目录里仍然只放原件、转录和 workspace-v1.json。
 *
 * 表结构与迁移在 `../schema/001-subjects.sql`；迁移只增不改：
 * 已应用的 id 记在 schema_migration 里，重装/重启不会重跑，也不会去改历史文件。
 *
 * 单条记录形状（对外）：
 *   { id, label, isDemo, createdAt, demoId, demoName }
 * profile_key = `<rootKey>:<id>`，rootKey 是数据根绝对路径的 sha256 前 16 位。
 */
import { mkdir, readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { dirname, isAbsolute, resolve } from 'node:path'

export const SCHEMA_MIGRATIONS = [
  { id: '001-subjects', file: new URL('../schema/001-subjects.sql', import.meta.url) },
]

export const DATA_ROOT_SETTING = 'data_root'

/** 数据根指纹：同一个病历目录换台机器/换个路径都是不同的档案空间。 */
export function rootKeyFor(dataRoot) {
  if (!dataRoot) return 'unbound'
  const absolute = isAbsolute(String(dataRoot)) ? resolve(String(dataRoot)) : resolve(String(dataRoot))
  return createHash('sha256').update(absolute).digest('hex').slice(0, 16)
}

function rowToSubject(row) {
  let meta = {}
  try { meta = JSON.parse(row.meta || '{}') } catch { meta = {} }
  return {
    id: String(row.profile_key).slice(String(row.profile_key).indexOf(':') + 1),
    label: String(row.name || ''),
    isDemo: Number(row.is_demo) === 1,
    createdAt: String(row.created_on || ''),
    demoId: typeof meta.demoId === 'string' ? meta.demoId : null,
    demoName: typeof meta.demoName === 'string' ? meta.demoName : null,
  }
}

/**
 * 打开（必要时创建并迁移）登记表。
 * 调用方负责处理"本机 Node 没有 node:sqlite"这类不可用情况，这里只抛原始错误。
 */
export async function openSubjectStore(file) {
  const { DatabaseSync } = await import('node:sqlite')
  await mkdir(dirname(file), { recursive: true, mode: 0o700 })
  const db = new DatabaseSync(file)
  db.exec('CREATE TABLE IF NOT EXISTS schema_migration (id TEXT PRIMARY KEY, applied_on TEXT NOT NULL)')
  const applied = new Set(db.prepare('SELECT id FROM schema_migration').all().map((row) => String(row.id)))
  for (const migration of SCHEMA_MIGRATIONS) {
    if (applied.has(migration.id)) continue
    const sql = await readFile(migration.file, 'utf8')
    db.exec(sql)
    db.prepare('INSERT INTO schema_migration (id, applied_on) VALUES (?, ?)').run(migration.id, new Date().toISOString())
  }
  const selectStmt = db.prepare('SELECT profile_key, name, meta, is_demo, created_on FROM subjects WHERE profile_key LIKE ? ORDER BY created_on ASC')
  const upsertStmt = db.prepare('INSERT INTO subjects (profile_key, name, meta, is_demo, created_on) VALUES (?, ?, ?, ?, ?) ON CONFLICT(profile_key) DO UPDATE SET name = excluded.name, meta = excluded.meta, is_demo = excluded.is_demo')
  const deleteStmt = db.prepare('DELETE FROM subjects WHERE profile_key = ?')
  const settingGetStmt = db.prepare('SELECT value FROM app_setting WHERE key = ?')
  const settingSetStmt = db.prepare('INSERT INTO app_setting (key, value, updated_on) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_on = excluded.updated_on')

  return {
    file,
    schemaVersion: SCHEMA_MIGRATIONS.at(-1)?.id || null,
    list(rootKey) {
      return selectStmt.all(`${rootKey}:%`).map(rowToSubject)
    },
    upsert(rootKey, subject, dataRoot) {
      if (!subject || typeof subject.id !== 'string') return
      const meta = JSON.stringify({ demoId: subject.demoId || null, demoName: subject.demoName || null, dataRoot: dataRoot || null })
      upsertStmt.run(`${rootKey}:${subject.id}`, String(subject.label || ''), meta, subject.isDemo ? 1 : 0, String(subject.createdAt || new Date().toISOString()))
    },
    upsertAll(rootKey, subjects, dataRoot) {
      for (const subject of subjects || []) this.upsert(rootKey, subject, dataRoot)
    },
    remove(rootKey, subjectId) {
      const result = deleteStmt.run(`${rootKey}:${subjectId}`)
      return Number(result.changes) > 0
    },
    getSetting(key) {
      const row = settingGetStmt.get(String(key))
      return row ? String(row.value) : null
    },
    setSetting(key, value) {
      settingSetStmt.run(String(key), String(value ?? ''), new Date().toISOString())
    },
    close() {
      try { db.close() } catch { /* 已关闭 */ }
    },
  }
}
