import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = resolve(process.argv[2] || '.')
const dataRoot = resolve(root, 'assets/reference-data/ovarian-cancer-trials-2026')
const manifest = JSON.parse(await readFile(resolve(dataRoot, 'manifest.json'), 'utf8'))
const [jsonl, sqlite] = await Promise.all([
  readFile(resolve(dataRoot, 'trials-2026.jsonl')),
  readFile(resolve(dataRoot, 'ovarian_cancer_trials_2026.sqlite')),
])
const digest = (value) => createHash('sha256').update(value).digest('hex')
assert.equal(digest(jsonl), manifest.jsonl_sha256, 'JSONL snapshot hash must match manifest')
assert.equal(digest(sqlite), manifest.sha256, 'SQLite snapshot hash must match manifest')

const records = jsonl.toString('utf8').split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line))
assert.equal(records.length, manifest.record_count, 'manifest record count must match JSONL rows')
const sqliteFile = resolve(dataRoot, 'ovarian_cancer_trials_2026.sqlite')
const sqliteQuery = 'SELECT registry, registry_id, registration_date, source_record_json FROM trial_records ORDER BY registry, registry_id'
const sqliteCli = spawnSync('sqlite3', ['-json', sqliteFile, sqliteQuery], { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 })
let sqliteRecords
if (!sqliteCli.error && sqliteCli.status === 0) {
  sqliteRecords = JSON.parse(sqliteCli.stdout)
} else {
  try {
    const { DatabaseSync } = await import('node:sqlite')
    const db = new DatabaseSync(sqliteFile, { readOnly: true })
    try { sqliteRecords = db.prepare(sqliteQuery).all() }
    finally { db.close() }
  } catch (error) {
    throw new Error(`Cannot verify SQLite trial records; install sqlite3 CLI or use a Node version with node:sqlite: ${error.message}`)
  }
}
assert.equal(sqliteRecords.length, records.length, 'SQLite row count must match the validated JSONL snapshot')
const sqliteById = new Map(sqliteRecords.map((row) => [`${row.registry}\u0000${row.registry_id}`, row]))
assert.equal(sqliteById.size, sqliteRecords.length, 'SQLite snapshot must not contain duplicate registry IDs')
for (const jsonRecord of records) {
  const key = `${jsonRecord.registry}\u0000${jsonRecord.registry_id}`
  const sqliteRecord = sqliteById.get(key)
  assert.ok(sqliteRecord, `${jsonRecord.registry_id} must be present in SQLite`)
  assert.match(sqliteRecord.registration_date, /^2026-\d{2}-\d{2}$/u, `${sqliteRecord.registry_id} SQLite record must be registered in 2026`)
  assert.ok(sqliteRecord.registration_date <= manifest.retrieved_at, `${sqliteRecord.registry_id} SQLite record is later than the retrieval date`)
  assert.ok(['{}', '[]', 'null', null].includes(sqliteRecord.source_record_json), `${sqliteRecord.registry_id} SQLite snapshot must not ship raw registry details or contact data`)
  sqliteById.delete(key)
}
assert.equal(sqliteById.size, 0, 'SQLite snapshot must not contain records missing from JSONL')
const counts = Object.create(null)
const ids = new Set()
const sources = {
  'ClinicalTrials.gov': new Set(['clinicaltrials.gov']),
  ChinaDrugTrials: new Set(['www.chinadrugtrials.org.cn']),
  ChiCTR: new Set(['www.chictr.org.cn', 'chictr.org.cn']),
}
for (const item of records) {
  assert.ok(sources[item.registry], `unexpected registry: ${item.registry}`)
  assert.match(item.registration_date, /^2026-\d{2}-\d{2}$/u, `${item.registry_id} must be registered in 2026`)
  assert.ok(item.registration_date <= manifest.retrieved_at, `${item.registry_id} is later than the retrieval date`)
  assert.equal(typeof item.registry_id, 'string')
  assert.equal(typeof item.title, 'string')
  assert.equal(typeof item.source_url, 'string')
  assert.equal(item.source_record, undefined, `${item.registry_id} must not ship raw registry details or contact data`)
  assert.ok(['complete_for_query', 'partial_first_37_search_results', 'partial_official_web_search'].includes(item.coverage), `${item.registry_id} must declare its coverage boundary`)
  const source = new URL(item.source_url)
  assert.equal(source.protocol, 'https:')
  assert.ok(sources[item.registry].has(source.hostname), `${item.registry_id} source URL must use its official registry`)
  const id = `${item.registry}\u0000${item.registry_id}`
  assert.ok(!ids.has(id), `duplicate registry id: ${item.registry_id}`)
  ids.add(id)
  counts[item.registry] = (counts[item.registry] || 0) + 1
}
assert.deepEqual(Object.fromEntries(Object.entries(counts).sort()), Object.fromEntries(Object.entries(manifest.registry_counts).sort()), 'manifest registry counts must match JSONL rows')
console.log(JSON.stringify({ records: records.length, sqliteRows: sqliteRecords.length, dateScope: '2026-only', registryCounts: counts, piiSourceDetailsExcluded: true, hashesValid: true }))
