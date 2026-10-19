import Schema from '@deepseek-ai/schemastery'
import { createHash, randomUUID } from 'node:crypto'
import { access, chmod, copyFile, lstat, mkdir, readFile, readdir, realpath, rename, rm, stat, unlink, writeFile } from 'node:fs/promises'
import { constants as fsConstants } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, extname, join, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { extractWithMineru, mineruCliPath } from './mineru.js'

export const name = 'ovarian-workbench-main'
export const inject = ['connection', 'webServer', 'credentials']
export const Config = Schema.object({ root: Schema.string().required() })

const API = '/api/ovarian-workbench/v1'
const MAX_STATE_BYTES = 8 * 1024 * 1024
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024
const MAX_JSON_BYTES = Math.ceil(MAX_UPLOAD_BYTES * 4 / 3) + 8192
const MAX_BACKUP_ENTRIES = 5000
const MAX_BACKUP_BYTES = 2 * 1024 * 1024 * 1024
const MAX_BACKUP_FILE_BYTES = 20 * 1024 * 1024
const MINERU_CREDENTIAL_REF = 'OVARIAN_WORKBENCH_MINERU_TOKEN'
const allowedTypes = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'text/plain'])

function emptyState() {
  return {
    schemaVersion: 2, revision: 0, subject: null, documents: [], claims: [], reviewDecisions: [], clinicalRecords: [], observations: [],
    treatmentEvents: [], supportEntries: [], questions: [], tasks: [], bookmarks: [], snapshots: [], agentResponses: [], commandReceipts: [], updatedAt: null, demoId: null, demoName: null,
  }
}

function safeId(value) {
  return typeof value === 'string' && /^[a-f\d-]{36}$/i.test(value)
}

function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

function cleanText(value, max = 1000) {
  if (typeof value !== 'string') return ''
  return value.trim().slice(0, max)
}

function normalizeSymptomDetails(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const oneOf = (key, allowed, fallback = '') => allowed.includes(value[key]) ? value[key] : fallback
  const ostomyPresent = oneOf('ostomyPresent', ['yes', 'no', 'unknown'], 'unknown')
  return {
    bowelChange: oneOf('bowelChange', ['not_recorded', 'frequency', 'constipation', 'diarrhea', 'urgency', 'incontinence', 'other'], 'not_recorded'),
    ostomyPresent,
    ostomyType: ostomyPresent === 'yes' ? oneOf('ostomyType', ['ileostomy', 'colostomy', 'other', 'unknown']) : '',
    ostomyConcern: ostomyPresent === 'yes' ? oneOf('ostomyConcern', ['leakage', 'skin', 'fit', 'self_care', 'return_discussion', 'other']) : '',
    dailyImpact: oneOf('dailyImpact', ['not_recorded', 'eating', 'sleep', 'outing', 'activity', 'self_care', 'none'], 'not_recorded'),
  }
}

function optionalNumber(value, label, minimum, maximum) {
  if (value === undefined || value === null || value === '') return null
  const number = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(number) || number < minimum || number > maximum) throw Object.assign(new Error(`${label}请填写${minimum}至${maximum}之间的数字，或留空`), { status: 400, code: 'INVALID_NUTRITION_VALUE' })
  return number
}

function sniffMime(bytes) {
  if (bytes.length >= 5 && bytes.subarray(0, 5).toString('ascii') === '%PDF-') return 'application/pdf'
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png'
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg'
  if (bytes.length >= 12 && bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp'
  if (bytes.length && !bytes.includes(0)) return 'text/plain'
  return null
}

function send(res, status, payload) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  })
  res.end(JSON.stringify(payload))
}

async function readBody(req, limit = MAX_JSON_BYTES) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > limit) throw Object.assign(new Error('请求内容过大'), { status: 413, code: 'PAYLOAD_TOO_LARGE' })
    chunks.push(chunk)
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) }
  catch { throw Object.assign(new Error('请求内容不是有效 JSON'), { status: 400, code: 'INVALID_JSON' }) }
}

function normalizeState(state) {
  if (!state || typeof state !== 'object' || !Number.isInteger(state.schemaVersion) || state.schemaVersion < 1 || state.schemaVersion > 2) throw Object.assign(new Error('工作区数据版本不兼容；原文件已保留，请先备份并按迁移流程恢复'), { status: 409, code: 'SCHEMA_VERSION_UNSUPPORTED' })
  let current = state
  if (current.schemaVersion === 1) current = { ...current, schemaVersion: 2, agentResponses: Array.isArray(current.agentResponses) ? current.agentResponses : [] }
  const base = emptyState()
  for (const key of Object.keys(base)) {
    if (key === 'schemaVersion' || key === 'revision' || key === 'subject' || key === 'updatedAt') continue
    if (Array.isArray(current[key])) base[key] = current[key]
  }
  base.schemaVersion = current.schemaVersion
  base.revision = Number.isInteger(current.revision) ? current.revision : 0
  base.subject = current.subject && typeof current.subject === 'object' ? current.subject : null
  base.updatedAt = typeof current.updatedAt === 'string' ? current.updatedAt : null
  base.demoId = typeof current.demoId === 'string' ? current.demoId : null
  base.demoName = typeof current.demoName === 'string' ? current.demoName : null
  return base
}

export function apply(ctx, config, adapters = {}) {
  const desktopFetch = ctx.connection?.fetch?.register
  const legacyHttp = ctx.webServer?.register && typeof ctx.connection?.requestRejection === 'function'
  if (!desktopFetch && !legacyHttp) throw new Error('DSH Desktop fetch registration capability unavailable')

  let root = null
  let rootLoaded = false
  let parseMode = 'mineru-cloud'
  const configRoot = resolve(config.root)
  const settingsFile = join(configRoot, 'settings-v1.json')
  let mutationQueue = Promise.resolve()
  let stateMigrationQueue = Promise.resolve()
  let settingsQueue = Promise.resolve()
  let trialsCache = null
  const trialsFile = new URL('../assets/reference-data/ovarian-cancer-trials-2026/trials-2026.jsonl', import.meta.url)
  const trialsManifestFile = new URL('../assets/reference-data/ovarian-cancer-trials-2026/manifest.json', import.meta.url)
  let guidanceCache = null
  const guidanceManifestFile = new URL('../assets/reference-data/ovarian-cancer-guidance/manifest.json', import.meta.url)
  const guidanceSourcesFile = new URL('../assets/reference-data/ovarian-cancer-guidance/sources.json', import.meta.url)

  async function guidancePackage() {
    if (guidanceCache) return guidanceCache
    try {
      const [manifestText, sourcesText] = await Promise.all([readFile(guidanceManifestFile, 'utf8'), readFile(guidanceSourcesFile, 'utf8')])
      const manifest = JSON.parse(manifestText)
      const sources = JSON.parse(sourcesText)
      if (manifest.package_id !== 'ovarian-cancer-guidance' || !Array.isArray(sources) || sources.length !== manifest.source_count) throw new Error('invalid guidance package')
      guidanceCache = { ...manifest, sources }
      return guidanceCache
    } catch { throw Object.assign(new Error('指南来源目录不可用；请检查工作台安装包'), { status: 503, code: 'REFERENCE_PACKAGE_UNAVAILABLE' }) }
  }

  async function ensureRootLoaded() {
    if (rootLoaded) return
    try {
      const settings = JSON.parse(await readFile(settingsFile, 'utf8'))
      if (settings.schemaVersion !== 1 || (settings.dataRoot !== null && settings.dataRoot !== undefined && typeof settings.dataRoot !== 'string')) throw Object.assign(new Error('工作区设置无法读取；请重新选择资料目录'), { status: 500, code: 'SETTINGS_CORRUPT' })
      root = typeof settings.dataRoot === 'string' ? resolve(settings.dataRoot) : null
      parseMode = settings.parseMode === 'local' ? 'local' : 'mineru-cloud'
      rootLoaded = true
    } catch (error) {
      if (error.code === 'ENOENT') { root = null; rootLoaded = true; return }
      throw error
    }
  }

  async function persistSettings(patch) {
    const run = settingsQueue.then(async () => {
      await mkdir(configRoot, { recursive: true, mode: 0o700 })
      let before = { schemaVersion: 1 }
      try { before = JSON.parse(await readFile(settingsFile, 'utf8')) } catch (error) { if (error.code !== 'ENOENT') throw error }
      const next = { ...before, ...patch, schemaVersion: 1 }
      const temp = join(configRoot, `.settings-${randomUUID()}.tmp`)
      try { await writeFile(temp, JSON.stringify(next), { mode: 0o600, flag: 'wx' }); await rename(temp, settingsFile) }
      catch (error) { await unlink(temp).catch(() => {}); throw error }
      root = typeof next.dataRoot === 'string' ? resolve(next.dataRoot) : null
      parseMode = next.parseMode === 'local' ? 'local' : 'mineru-cloud'
      rootLoaded = true
      return next
    })
    settingsQueue = run.catch(() => {})
    return run
  }

  async function sharedMineruCredential() {
    if (adapters.resolveCommunityMineruToken) return adapters.resolveCommunityMineruToken()
    try {
      const require = createRequire(import.meta.url)
      const entry = require.resolve('@xyb-openharness-dsh-plugins/xyb-workbench')
      const provider = await import(pathToFileURL(join(dirname(entry), 'settings.js')).href)
      return await provider.resolveMineruToken()
    } catch { return { token: '', source: 'unavailable' } }
  }

  async function mineruCredential() {
    try {
      const user = await ctx.credentials?.resolve?.(MINERU_CREDENTIAL_REF)
      if (user?.value) return { token: user.value, source: 'user' }
    } catch {}
    const shared = await sharedMineruCredential()
    return shared?.token ? { token: shared.token, source: shared.source || 'community' } : { token: '', source: shared?.source || 'unavailable' }
  }

  async function setParsedDocument(documentId, markdown, engine, consentAt = null) {
    const relativePath = join('extractions', `${documentId}-${randomUUID()}.md`)
    const absolutePath = resolve(await requireRoot(), relativePath)
    if (!absolutePath.startsWith(`${root}${sep}`)) throw Object.assign(new Error('解析结果路径无效'), { status: 400, code: 'INVALID_PATH' })
    await mkdir(dirname(absolutePath), { recursive: true, mode: 0o700 })
    await writeFile(absolutePath, markdown, { mode: 0o600 })
    try {
      const result = await mutate((state) => {
        const doc = state.documents.find((item) => item.id === documentId)
        if (!doc) throw Object.assign(new Error('原始资料已不存在'), { status: 404, code: 'SOURCE_MISSING' })
        doc.parseStatus = 'parsed'
        doc.parseEngine = engine
        doc.parsedAt = new Date().toISOString()
        doc.parseRelativePath = relativePath
        doc.cloudConsentAt = consentAt
        return { id: doc.id, parseStatus: doc.parseStatus, parseEngine: engine, parsedAt: doc.parsedAt }
      })
      return result.result
    } catch (error) {
      await unlink(absolutePath).catch(() => {})
      throw error
    }
  }

  async function requireRoot() {
    await ensureRootLoaded()
    if (!root) throw Object.assign(new Error('请先选择患者资料目录，再建立或读取病历资料'), { status: 409, code: 'DIRECTORY_REQUIRED' })
    try { if (!(await stat(root)).isDirectory()) throw new Error('not a directory') }
    catch { throw Object.assign(new Error('原资料目录当前不可访问；请重新选择目录。原目录中的资料不会自动删除或迁移'), { status: 503, code: 'DIRECTORY_UNAVAILABLE' }) }
    return root
  }

  async function loadState() {
    await ensureRootLoaded()
    if (!root) return emptyState()
    await requireRoot()
    const activeRoot = root
    const stateFile = join(activeRoot, 'workspace-v1.json')
    try {
      const buffer = await readFile(stateFile)
      if (buffer.length > MAX_STATE_BYTES) throw Object.assign(new Error('本机工作区数据超出读取上限'), { status: 507, code: 'STATE_TOO_LARGE' })
      const rawState = JSON.parse(buffer.toString('utf8'))
      const normalized = normalizeState(rawState)
      if (normalized.schemaVersion !== rawState.schemaVersion) {
        const run = stateMigrationQueue.then(async () => {
          const latestBuffer = await readFile(stateFile)
          const latestRaw = JSON.parse(latestBuffer.toString('utf8'))
          const latest = normalizeState(latestRaw)
          if (latest.schemaVersion === latestRaw.schemaVersion) return latest
          const backupName = `workspace-v${latestRaw.schemaVersion}-pre-migration-${Date.now()}-${randomUUID().slice(0, 8)}.json`
          await writeFile(join(activeRoot, backupName), latestBuffer, { mode: 0o600, flag: 'wx' })
          await saveState(latest, activeRoot)
          return latest
        })
        stateMigrationQueue = run.catch(() => {})
        return run
      }
      return normalized
    } catch (error) {
      if (error.code === 'ENOENT') return emptyState()
      if (error instanceof SyntaxError) throw Object.assign(new Error('工作区数据无法读取；原文件已保留，请先备份后恢复'), { status: 500, code: 'STATE_CORRUPT' })
      throw error
    }
  }

  async function saveState(state, requestedRoot) {
    const activeRoot = requestedRoot || await requireRoot()
    const stateFile = join(activeRoot, 'workspace-v1.json')
    const tempFile = join(activeRoot, `.workspace-${randomUUID()}.tmp`)
    const contents = JSON.stringify(state)
    if (Buffer.byteLength(contents) > MAX_STATE_BYTES) throw Object.assign(new Error('本机工作区数据达到容量上限；原资料已保留'), { status: 507, code: 'STATE_TOO_LARGE' })
    try {
      await writeFile(tempFile, contents, { mode: 0o600, flag: 'wx' })
      await rename(tempFile, stateFile)
    } catch (error) {
      await unlink(tempFile).catch(() => {})
      throw error
    }
  }

  function backupRelativePath(value) {
    if (typeof value !== 'string' || !value || value.includes('\0')) return null
    const normalized = value.replaceAll('\\', '/')
    if (normalized.startsWith('/') || /^[a-z]:/i.test(normalized)) return null
    const parts = normalized.split('/')
    if (parts.some((part) => !part || part === '.' || part === '..')) return null
    return parts.join(sep)
  }

  async function checkedDirectory(path, label) {
    if (typeof path !== 'string' || !resolve(path).startsWith(sep)) throw Object.assign(new Error(`${label}目录无效；请使用系统目录选择器`), { status: 400, code: 'INVALID_DIRECTORY' })
    let chosen
    try {
      chosen = await realpath(resolve(path))
      if (!(await stat(chosen)).isDirectory()) throw new Error('not a directory')
      await access(chosen, fsConstants.R_OK | fsConstants.W_OK)
    } catch { throw Object.assign(new Error(`${label}目录不可访问或不可写；原有资料未更改`), { status: 400, code: 'DIRECTORY_UNAVAILABLE' }) }
    return chosen
  }

  async function createBackup(destinationPath) {
    const run = mutationQueue.then(() => createBackupUnlocked(destinationPath))
    mutationQueue = run.catch(() => {})
    return run
  }

  async function createBackupUnlocked(destinationPath) {
    const sourceRoot = await requireRoot()
    const destinationRoot = await checkedDirectory(destinationPath, '备份目标')
    const state = await loadState()
    const statePath = join(sourceRoot, 'workspace-v1.json')
    let rawState
    try { rawState = await readFile(statePath) }
    catch (error) { if (error.code !== 'ENOENT') throw error; rawState = Buffer.from(JSON.stringify(state)) }
    const relativeFiles = new Set(['workspace-v1.json'])
    for (const name of await readdir(sourceRoot)) if (/^workspace-v\d+-pre-migration-[\w-]+\.json$/.test(name)) relativeFiles.add(name)
    for (const doc of state.documents) {
      for (const candidate of [doc.relativePath, doc.parseRelativePath]) {
        if (!candidate) continue
        const relative = backupRelativePath(candidate)
        if (!relative) throw Object.assign(new Error('资料包含无效文件引用，未创建备份'), { status: 409, code: 'BACKUP_REFERENCE_INVALID' })
        relativeFiles.add(relative)
      }
    }
    if (relativeFiles.size > MAX_BACKUP_ENTRIES) throw Object.assign(new Error('资料文件数量超过备份上限'), { status: 413, code: 'BACKUP_TOO_MANY_FILES' })
    const backupName = `ovarian-workbench-backup-${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`
    const backupRoot = join(destinationRoot, backupName)
    const manifest = { format: 'xyb-ovarian-workbench-backup', formatVersion: 1, schemaVersion: state.schemaVersion, createdAt: new Date().toISOString(), sourceRevision: state.revision, files: [] }
    let totalBytes = 0
    await mkdir(backupRoot, { mode: 0o700 })
    try {
      for (const relative of relativeFiles) {
        const source = resolve(sourceRoot, relative)
        if (!source.startsWith(`${sourceRoot}${sep}`) && source !== sourceRoot) throw Object.assign(new Error('资料文件引用越过工作区目录'), { status: 409, code: 'BACKUP_REFERENCE_INVALID' })
        const info = await lstat(source)
        if (info.isSymbolicLink() || !info.isFile()) throw Object.assign(new Error('备份包含不可读取的资料文件；原资料未更改'), { status: 409, code: 'BACKUP_SOURCE_MISSING' })
        if (info.size > MAX_BACKUP_FILE_BYTES) throw Object.assign(new Error('单个资料文件超过20MB备份上限；原资料未更改'), { status: 413, code: 'BACKUP_FILE_TOO_LARGE' })
        totalBytes += info.size
        if (totalBytes > MAX_BACKUP_BYTES) throw Object.assign(new Error('备份资料超过2GB上限；原资料未更改'), { status: 413, code: 'BACKUP_TOO_LARGE' })
        const bytes = relative === 'workspace-v1.json' ? rawState : await readFile(source)
        const target = resolve(backupRoot, relative)
        if (!target.startsWith(`${backupRoot}${sep}`)) throw Object.assign(new Error('备份目标路径无效'), { status: 400, code: 'INVALID_PATH' })
        await mkdir(dirname(target), { recursive: true, mode: 0o700 })
        await writeFile(target, bytes, { mode: 0o600, flag: 'wx' })
        manifest.files.push({ path: relative.replaceAll(sep, '/'), size: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') })
      }
      let currentState
      try { currentState = normalizeState(JSON.parse(await readFile(statePath, 'utf8'))) }
      catch (error) { if (error.code !== 'ENOENT') throw error; currentState = emptyState() }
      if (currentState.revision !== state.revision || currentState.updatedAt !== state.updatedAt) throw Object.assign(new Error('备份期间资料发生变化，请稍后重试；未创建备份'), { status: 409, code: 'BACKUP_SOURCE_CHANGED' })
      const manifestPath = join(backupRoot, 'backup-manifest.json')
      await writeFile(manifestPath, JSON.stringify(manifest, null, 2), { mode: 0o600, flag: 'wx' })
      return { name: backupName, path: backupRoot, fileCount: manifest.files.length, sourceRevision: state.revision, totalBytes }
    } catch (error) {
      await rm(backupRoot, { recursive: true, force: true }).catch(() => {})
      throw error
    }
  }

  async function restoreBackup(backupPath, destinationPath) {
    const run = mutationQueue.then(() => restoreBackupUnlocked(backupPath, destinationPath))
    mutationQueue = run.catch(() => {})
    return run
  }

  async function restoreBackupUnlocked(backupPath, destinationPath) {
    await ensureRootLoaded()
    const activeRoot = root
    const backupRoot = await checkedDirectory(backupPath, '备份来源')
    const destinationRoot = await checkedDirectory(destinationPath, '恢复目标')
    if (backupRoot === destinationRoot || activeRoot === destinationRoot) throw Object.assign(new Error('恢复目标必须是当前资料目录之外的位置；当前资料会保留不动'), { status: 409, code: 'RESTORE_TARGET_CONFLICT' })
    const manifestPath = join(backupRoot, 'backup-manifest.json')
    let manifest
    try {
      const raw = await readFile(manifestPath)
      if (raw.length > 1024 * 1024) throw new Error('manifest too large')
      manifest = JSON.parse(raw.toString('utf8'))
    } catch { throw Object.assign(new Error('未找到有效的工作台备份清单；当前资料未更改'), { status: 400, code: 'BACKUP_MANIFEST_INVALID' }) }
    if (manifest.format !== 'xyb-ovarian-workbench-backup' || manifest.formatVersion !== 1 || ![1, 2].includes(manifest.schemaVersion) || !Array.isArray(manifest.files) || !manifest.files.length || manifest.files.length > MAX_BACKUP_ENTRIES) throw Object.assign(new Error('备份格式或版本不受支持；当前资料未更改'), { status: 400, code: 'BACKUP_VERSION_UNSUPPORTED' })
    const seen = new Set()
    let totalBytes = 0
    const verified = []
    let stateBytes = null
    for (const item of manifest.files) {
      const relative = backupRelativePath(item.path)
      if (!relative || seen.has(relative) || !Number.isSafeInteger(item.size) || item.size < 0 || !/^[a-f\d]{64}$/i.test(item.sha256)) throw Object.assign(new Error('备份清单包含无效文件记录；当前资料未更改'), { status: 400, code: 'BACKUP_MANIFEST_INVALID' })
      if (item.size > MAX_BACKUP_FILE_BYTES) throw Object.assign(new Error('备份中的单个文件超过20MB恢复上限；当前资料未更改'), { status: 413, code: 'BACKUP_FILE_TOO_LARGE' })
      seen.add(relative)
      totalBytes += item.size
      if (totalBytes > MAX_BACKUP_BYTES) throw Object.assign(new Error('备份超过2GB恢复上限；当前资料未更改'), { status: 413, code: 'BACKUP_TOO_LARGE' })
      const source = resolve(backupRoot, relative)
      if (!source.startsWith(`${backupRoot}${sep}`)) throw Object.assign(new Error('备份清单路径无效；当前资料未更改'), { status: 400, code: 'BACKUP_PATH_INVALID' })
      let bytes
      try {
        const info = await lstat(source)
        if (info.isSymbolicLink() || !info.isFile()) throw new Error('not a regular file')
        bytes = await readFile(source)
      } catch { throw Object.assign(new Error(`备份文件缺失或不是普通文件：${item.path}；当前资料未更改`), { status: 400, code: 'BACKUP_FILE_MISSING' }) }
      if (bytes.length !== item.size || createHash('sha256').update(bytes).digest('hex') !== item.sha256) throw Object.assign(new Error(`备份文件校验失败：${item.path}；当前资料未更改`), { status: 400, code: 'BACKUP_CHECKSUM_MISMATCH' })
      if (relative === 'workspace-v1.json') stateBytes = bytes
      verified.push({ relative, size: item.size, sha256: item.sha256 })
    }
    if (!seen.has('workspace-v1.json') || !stateBytes) throw Object.assign(new Error('备份不包含工作台病历索引；当前资料未更改'), { status: 400, code: 'BACKUP_STATE_MISSING' })
    let restoredState
    try {
      const rawRestoredState = JSON.parse(stateBytes.toString('utf8'))
      if (rawRestoredState.schemaVersion !== manifest.schemaVersion) throw new Error('manifest state version mismatch')
      restoredState = normalizeState(rawRestoredState)
    }
    catch { throw Object.assign(new Error('备份中的工作台数据无法读取；当前资料未更改'), { status: 400, code: 'BACKUP_STATE_INVALID' }) }
    const listed = new Set(verified.map((item) => item.relative))
    for (const doc of restoredState.documents) for (const path of [doc.relativePath, doc.parseRelativePath]) {
      if (path && !listed.has(backupRelativePath(path))) throw Object.assign(new Error('备份缺少报告原件或转录文件；当前资料未更改'), { status: 400, code: 'BACKUP_DOCUMENT_MISSING' })
    }
    const stamp = `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`
    const stage = join(destinationRoot, `.ovarian-workbench-restore-${stamp}.tmp`)
    const finalRoot = join(destinationRoot, `ovarian-workbench-restored-${stamp}`)
    await mkdir(stage, { mode: 0o700 })
    try {
      for (const item of verified) {
        const target = resolve(stage, item.relative)
        if (!target.startsWith(`${stage}${sep}`)) throw Object.assign(new Error('备份文件路径无效；当前资料未更改'), { status: 400, code: 'BACKUP_PATH_INVALID' })
        await mkdir(dirname(target), { recursive: true, mode: 0o700 })
        const source = resolve(backupRoot, item.relative)
        await copyFile(source, target, fsConstants.COPYFILE_EXCL)
        await chmod(target, 0o600)
        const copied = await readFile(target)
        if (copied.length !== item.size || createHash('sha256').update(copied).digest('hex') !== item.sha256) throw Object.assign(new Error(`恢复副本校验失败：${item.relative}；当前资料未更改`), { status: 400, code: 'BACKUP_CHECKSUM_MISMATCH' })
      }
      await rename(stage, finalRoot)
      try { await persistSettings({ dataRoot: finalRoot }) }
      catch (error) { await rm(finalRoot, { recursive: true, force: true }).catch(() => {}); throw error }
      return { dataRoot: finalRoot, revision: restoredState.revision, fileCount: verified.length, totalBytes }
    } catch (error) {
      await rm(stage, { recursive: true, force: true }).catch(() => {})
      throw error
    }
  }

  async function mutate(action, request = {}) {
    const run = mutationQueue.then(async () => {
      const state = await loadState()
      if (request.idempotencyKey) {
        const receipt = state.commandReceipts.find((item) => item.key === request.idempotencyKey)
        if (receipt) return { state, result: receipt.result }
      }
      if (Number.isInteger(request.expectedRevision) && request.expectedRevision !== state.revision) {
        throw Object.assign(new Error('资料已在其他操作中更新，请刷新后重试'), { status: 409, code: 'REVISION_CONFLICT' })
      }
      const result = await action(state)
      state.revision += 1
      state.updatedAt = new Date().toISOString()
      if (request.idempotencyKey) {
        state.commandReceipts.unshift({ key: request.idempotencyKey, result, revision: state.revision })
        state.commandReceipts = state.commandReceipts.slice(0, 200)
      }
      try { await saveState(state) }
      catch (error) {
        if (result && typeof result.relativePath === 'string' && root) {
          const orphan = resolve(root, result.relativePath)
          if (orphan.startsWith(`${root}${sep}`)) await unlink(orphan).catch(() => {})
        }
        throw error
      }
      return { state, result }
    })
    mutationQueue = run.catch(() => {})
    return run
  }

  async function command(body) {
    if (!body || typeof body !== 'object' || typeof body.type !== 'string') throw Object.assign(new Error('缺少操作类型'), { status: 400, code: 'INVALID_INPUT' })
    const request = { expectedRevision: Number.isInteger(body.expectedRevision) ? body.expectedRevision : null, idempotencyKey: cleanText(body.idempotencyKey, 100) }
    if (body.type === 'create-subject') {
      return mutate((state) => {
        if (state.subject) throw Object.assign(new Error('当前工作区已经有一个患者资料主体'), { status: 409, code: 'SUBJECT_EXISTS' })
        state.subject = { id: randomUUID(), label: cleanText(body.label, 80) || '我的资料', createdAt: new Date().toISOString() }
        const initialQuestion = cleanText(body.initialQuestion, 1000)
        if (initialQuestion) state.questions.unshift({ id: randomUUID(), subjectId: state.subject.id, text: initialQuestion, refs: [], createdAt: new Date().toISOString(), revision: 1 })
        return state.subject
      }, request)
    }

    return mutate(async (state) => {
      if (!state.subject) throw Object.assign(new Error('请先建立本机资料主体'), { status: 409, code: 'SUBJECT_REQUIRED' })
      if (body.subjectId && body.subjectId !== state.subject.id) throw Object.assign(new Error('资料主体已变化，请刷新后重试'), { status: 409, code: 'SUBJECT_CHANGED' })
      const now = new Date().toISOString()

      if (body.type === 'import-document') {
        const name = cleanText(body.name, 180)
        const mime = cleanText(body.mime, 100).toLowerCase()
        const data = typeof body.dataBase64 === 'string' && /^[A-Za-z\d+/]*={0,2}$/.test(body.dataBase64) ? body.dataBase64 : ''
        const bytes = Buffer.from(data, 'base64')
        if (!name || !allowedTypes.has(mime) || bytes.length === 0 || bytes.length > MAX_UPLOAD_BYTES) throw Object.assign(new Error('请选择小于20 MB的 PDF、图片或文本资料'), { status: 400, code: 'INVALID_DOCUMENT' })
        const ext = extname(name).toLowerCase()
        const allowedExt = new Set(['.pdf', '.jpg', '.jpeg', '.png', '.webp', '.txt'])
        if (!allowedExt.has(ext)) throw Object.assign(new Error('文件扩展名与支持的资料类型不符'), { status: 400, code: 'INVALID_DOCUMENT_TYPE' })
        const detectedMime = sniffMime(bytes)
        const expectedMime = ext === '.pdf' ? 'application/pdf' : ['.jpg', '.jpeg'].includes(ext) ? 'image/jpeg' : ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'text/plain'
        if (detectedMime !== expectedMime || mime !== expectedMime) throw Object.assign(new Error('文件内容、类型与扩展名不一致，未保存'), { status: 400, code: 'DOCUMENT_TYPE_MISMATCH' })
            const documentsRoot = join(await requireRoot(), 'documents')
        await mkdir(documentsRoot, { recursive: true, mode: 0o700 })
        const id = randomUUID()
        const filename = `${id}${ext}`
        const filePath = join(documentsRoot, filename)
        const relativePath = `documents/${filename}`
        const safeRoot = `${root}${sep}`
        if (!resolve(filePath).startsWith(safeRoot)) throw Object.assign(new Error('资料保存位置无效'), { status: 400, code: 'INVALID_PATH' })
        await writeFile(filePath, bytes, { mode: 0o600, flag: 'wx' })
        const document = {
          id, versionId: randomUUID(), subjectId: state.subject.id, name, mime, size: bytes.length,
          sha256: createHash('sha256').update(bytes).digest('hex'), relativePath,
          status: 'stored_unreviewed', uploadedAt: now, sourceLabel: cleanText(body.sourceLabel, 160),
        }
        state.documents.unshift(document)
        return document
      }

      if (body.type === 'add-claim') {
        const documentId = safeId(body.documentId) ? body.documentId : null
        const document = state.documents.find((item) => item.id === documentId)
        if (!document) throw Object.assign(new Error('请先选择一份已保存的来源原件'), { status: 400, code: 'SOURCE_REQUIRED' })
        const kind = ['metric', 'diagnosis', 'treatment', 'other'].includes(body.kind) ? body.kind : 'other'
        const label = cleanText(body.label, 120)
        const value = cleanText(body.value, 180)
        const unit = cleanText(body.unit, 48)
        const method = cleanText(body.method, 120)
        const laboratory = cleanText(body.laboratory, 120)
        const date = cleanText(body.date, 32)
        if (!label || !value || (date && !validDate(date))) throw Object.assign(new Error('请填写候选项目与原文/数值；日期可留空'), { status: 400, code: 'INVALID_INPUT' })
        if (kind === 'metric' && !unit) throw Object.assign(new Error('指标候选需要保留报告中的原单位'), { status: 400, code: 'UNIT_REQUIRED' })
        const claim = { id: randomUUID(), subjectId: state.subject.id, documentId, documentVersionId: document.versionId, kind, label, value, unit: unit || null, method: method || null, laboratory: laboratory || null, date: date || null, locator: cleanText(body.locator, 180), status: 'candidate', createdAt: now, revision: 1 }
        state.claims.unshift(claim)
        return claim
      }

      if (body.type === 'decide-claim') {
        const claim = state.claims.find((item) => item.id === body.claimId && item.subjectId === state.subject.id)
        const decision = ['accepted', 'rejected', 'deferred'].includes(body.decision) ? body.decision : null
        if (!claim || !decision) throw Object.assign(new Error('核对候选或决定状态无效'), { status: 400, code: 'INVALID_INPUT' })
        if (claim.status !== 'candidate') throw Object.assign(new Error('此候选已处理；如需修正，请新增一条并保留历史'), { status: 409, code: 'CLAIM_ALREADY_REVIEWED' })
        claim.status = decision
        claim.revision += 1
        claim.reviewedAt = now
        const reviewDecision = { id: randomUUID(), subjectId: state.subject.id, claimId: claim.id, decision, note: cleanText(body.note, 500), actor: 'workspace-user', createdAt: now }
        state.reviewDecisions.unshift(reviewDecision)
        let observation = null
        if (decision === 'accepted' && claim.kind === 'metric') {
          observation = { id: randomUUID(), subjectId: state.subject.id, metric: claim.label, value: claim.value, unit: claim.unit, method: claim.method, laboratory: claim.laboratory, date: claim.date, sourceId: claim.documentId, claimId: claim.id, state: 'user_accepted_transcription', createdAt: now, revision: 1 }
          state.observations.unshift(observation)
        }
        return { claim, reviewDecision, observation }
      }

      if (body.type === 'add-clinical-record') {
        const category = ['diagnosis', 'pathology', 'molecular', 'treatment', 'other'].includes(body.category) ? body.category : null
        const field = cleanText(body.field, 120), value = cleanText(body.value, 1000)
        const status = ['recorded', 'not_tested', 'not_reported', 'pending', 'uncertain', 'unknown', 'not_applicable'].includes(body.status) ? body.status : null
        const date = cleanText(body.date, 32), sourceId = safeId(body.sourceId) ? body.sourceId : null
        if (!category || !field || !status || (status === 'recorded' && !value) || (date && !validDate(date))) throw Object.assign(new Error('请填写资料类别、字段、状态；日期按原资料填写'), { status: 400, code: 'INVALID_INPUT' })
        if (sourceId && !state.documents.some((doc) => doc.id === sourceId)) throw Object.assign(new Error('来源资料不存在'), { status: 404, code: 'SOURCE_MISSING' })
        const record = { id: randomUUID(), subjectId: state.subject.id, category, field, value: value || null, status, date: date || null, method: cleanText(body.method, 120) || null, specimen: cleanText(body.specimen, 120) || null, note: cleanText(body.note, 1000), sourceId, createdAt: now, revision: 1 }
        state.clinicalRecords.unshift(record)
        return record
      }

      if (body.type === 'add-observation') {
        const metric = cleanText(body.metric, 64).toUpperCase()
        const value = cleanText(body.value, 80)
        const unit = cleanText(body.unit, 48)
        const method = cleanText(body.method, 120)
        const laboratory = cleanText(body.laboratory, 120)
        const date = cleanText(body.date, 32)
        const sourceId = safeId(body.sourceId) ? body.sourceId : null
        if (!metric || !value || !unit || !validDate(date)) throw Object.assign(new Error('指标、数值、单位和日期均需填写'), { status: 400, code: 'INVALID_INPUT' })
        if (sourceId && !state.documents.some((doc) => doc.id === sourceId)) throw Object.assign(new Error('来源资料不存在'), { status: 404, code: 'SOURCE_MISSING' })
        const observation = { id: randomUUID(), subjectId: state.subject.id, metric, value, unit, method: method || null, laboratory: laboratory || null, date, sourceId, state: sourceId ? 'user_recorded' : 'user_recorded_no_source', createdAt: now, revision: 1 }
        state.observations.unshift(observation)
        return observation
      }

      if (body.type === 'add-treatment-event') {
        const title = cleanText(body.title, 180)
        const kind = cleanText(body.kind, 40)
        const status = ['planned', 'discussed', 'occurred', 'cancelled', 'unknown'].includes(body.status) ? body.status : 'unknown'
        const date = cleanText(body.date, 32)
        if (!title || !kind || (date && !validDate(date))) throw Object.assign(new Error('请补充事件名称、类型和有效日期'), { status: 400, code: 'INVALID_INPUT' })
        const sourceId = safeId(body.sourceId) ? body.sourceId : null
        if (sourceId && !state.documents.some((doc) => doc.id === sourceId)) throw Object.assign(new Error('来源资料不存在'), { status: 404, code: 'SOURCE_MISSING' })
        const event = { id: randomUUID(), subjectId: state.subject.id, title, kind, status, date: date || null, note: cleanText(body.note, 1000), sourceId, createdAt: now, revision: 1 }
        state.treatmentEvents.unshift(event)
        return event
      }

      if (body.type === 'add-support-entry') {
        const domain = ['nutrition', 'mind', 'symptom'].includes(body.domain) ? body.domain : null
        const text = cleanText(body.text, 1500)
        const subjectRole = ['patient', 'caregiver'].includes(body.subjectRole) ? body.subjectRole : 'patient'
        if (!domain || !text) throw Object.assign(new Error('请选择记录类别并填写内容'), { status: 400, code: 'INVALID_INPUT' })
        const isPrivate = domain === 'mind'
        if (body.sharingScope !== undefined && !['selectable', 'private'].includes(body.sharingScope)) throw Object.assign(new Error('记录分享范围无效'), { status: 400, code: 'INVALID_SHARING_SCOPE' })
        const sharingScope = isPrivate ? 'private' : (body.sharingScope || 'selectable')
        const date = cleanText(body.date, 32) || now.slice(0, 10)
        if (!validDate(date)) throw Object.assign(new Error('请选择有效日期'), { status: 400, code: 'INVALID_DATE' })
        const sourceId = safeId(body.sourceId) ? body.sourceId : null
        if (sourceId && !state.documents.some((doc) => doc.id === sourceId)) throw Object.assign(new Error('来源资料不存在'), { status: 404, code: 'SOURCE_MISSING' })
        let nutrition = null
        if (domain === 'nutrition' && body.nutrition !== undefined) {
          if (!body.nutrition || typeof body.nutrition !== 'object' || Array.isArray(body.nutrition)) throw Object.assign(new Error('营养记录字段格式无效'), { status: 400, code: 'INVALID_NUTRITION_VALUE' })
          const appetiteValue = cleanText(body.nutrition.appetite, 60)
          const appetite = ['和平常差不多', '比平常少一些', '吃一点就饱'].includes(appetiteValue) ? appetiteValue : null
          nutrition = {
            appetite,
            difficulty: cleanText(body.nutrition.difficulty, 100) || null,
            weightKg: optionalNumber(body.nutrition.weightKg, '体重', 1, 400),
            estimatedEnergyKcal: optionalNumber(body.nutrition.estimatedEnergyKcal, '能量估算', 0, 20000),
            estimatedProteinG: optionalNumber(body.nutrition.estimatedProteinG, '蛋白质估算', 0, 1000),
            context: cleanText(body.nutrition.context, 240) || null,
          }
        }
        const symptomDetails = domain === 'symptom' ? normalizeSymptomDetails(body.symptomDetails) : null
        const entry = { id: randomUUID(), subjectId: state.subject.id, domain, subjectRole, text, date, private: isPrivate, sharingScope, sourceId, createdAt: now, revision: 1, ...(nutrition ? { nutrition } : {}), ...(symptomDetails ? { symptomDetails } : {}) }
        state.supportEntries.unshift(entry)
        if (nutrition?.weightKg !== null && nutrition?.weightKg !== undefined) state.observations.unshift({ id: randomUUID(), subjectId: state.subject.id, metric: '体重', value: String(nutrition.weightKg), unit: 'kg', method: null, laboratory: null, date, sourceId: null, supportEntryId: entry.id, state: 'user_recorded_no_source', createdAt: now, revision: 1 })
        return entry
      }

      if (body.type === 'add-question') {
        const text = cleanText(body.text, 1000)
        if (!text) throw Object.assign(new Error('问题内容不能为空'), { status: 400, code: 'INVALID_INPUT' })
        const question = { id: randomUUID(), subjectId: state.subject.id, text, status: 'open', createdAt: now, revision: 1, refs: Array.isArray(body.refs) ? body.refs.filter(safeId).slice(0, 20) : [] }
        state.questions.unshift(question)
        return question
      }

      if (body.type === 'save-agent-response') {
        const title = cleanText(body.title, 120) || 'DSH 会话回答'
        const text = cleanText(body.text, 12000)
        if (!text) throw Object.assign(new Error('请粘贴要保留的回答内容'), { status: 400, code: 'INVALID_INPUT' })
        const allowedGroups = ['observations', 'treatmentEvents', 'supportEntries', 'questions']
        const requested = Array.isArray(body.sourceRefs) ? body.sourceRefs.slice(0, 40) : []
        const sourceRefs = []
        const seen = new Set()
        for (const ref of requested) {
          const group = allowedGroups.includes(ref?.group) ? ref.group : null
          const id = safeId(ref?.id) ? ref.id : null
          if (!group || !id) throw Object.assign(new Error('回答关联记录格式无效'), { status: 400, code: 'INVALID_SOURCE_REFERENCE' })
          const key = `${group}:${id}`
          if (seen.has(key)) continue
          seen.add(key)
          const record = state[group].find((item) => item.id === id && item.subjectId === state.subject.id)
          if (!record || (group === 'supportEntries' && (record.private || record.domain === 'mind' || record.sharingScope === 'private'))) throw Object.assign(new Error('所选来源不存在或被设为仅自己回顾'), { status: 404, code: 'SOURCE_MISSING' })
          const label = group === 'observations' ? `${record.metric} ${record.value} ${record.unit || ''}` : group === 'treatmentEvents' ? record.title : group === 'questions' ? record.text : record.domain === 'nutrition' ? `营养记录：${record.text}` : `身体变化自述：${record.text}`
          sourceRefs.push({ group, id, revision: record.revision || 1, label: cleanText(label, 240), date: record.date || null })
        }
        const response = { id: randomUUID(), subjectId: state.subject.id, title, text, sourceRefs, status: 'unreviewed', privacy: 'private-workspace', createdAt: now, revision: 1, previousVersions: [] }
        state.agentResponses.unshift(response)
        return response
      }

      if (body.type === 'review-agent-response') {
        const response = state.agentResponses.find((item) => item.id === body.id && item.subjectId === state.subject.id)
        if (!response) throw Object.assign(new Error('找不到这条会话回答'), { status: 404, code: 'RECORD_MISSING' })
        if (!Number.isInteger(body.recordRevision) || body.recordRevision !== response.revision) throw Object.assign(new Error('回答记录已更新，请刷新后再操作'), { status: 409, code: 'RECORD_REVISION_CONFLICT' })
        if (response.status === 'user_checked_references') return response
        response.previousVersions.unshift({ revision: response.revision, status: response.status, archivedAt: now })
        response.previousVersions = response.previousVersions.slice(0, 20)
        response.status = 'user_checked_references'
        response.checkedAt = now
        response.revision += 1
        return response
      }

      if (body.type === 'delete-record') {
        const id = safeId(body.id) ? body.id : null
        const group = ['clinicalRecords', 'supportEntries', 'questions', 'tasks', 'bookmarks', 'snapshots', 'agentResponses'].includes(body.group) ? body.group : null
        if (!id || !group) throw Object.assign(new Error('删除请求无效'), { status: 400, code: 'INVALID_INPUT' })
        const index = state[group].findIndex((row) => row.id === id && row.subjectId === state.subject.id)
        if (index < 0) throw Object.assign(new Error('找不到这条记录'), { status: 404, code: 'RECORD_MISSING' })
        if (group === 'snapshots') {
          const snapshot = state.snapshots[index]
          if (snapshot.status === 'archived') return { id, deleted: false, archived: true }
          snapshot.status = 'archived'
          snapshot.archivedAt = now
          snapshot.revision = (snapshot.revision || 1) + 1
        } else state[group].splice(index, 1)
        if (group === 'supportEntries') state.observations = state.observations.filter((item) => item.supportEntryId !== id)
        return group === 'snapshots' ? { id, deleted: false, archived: true } : { id, deleted: true }
      }

      if (body.type === 'restore-brief') {
        const snapshot = state.snapshots.find((item) => item.id === body.id && item.subjectId === state.subject.id)
        if (!snapshot) throw Object.assign(new Error('找不到这份摘要快照'), { status: 404, code: 'RECORD_MISSING' })
        if (!Number.isInteger(body.recordRevision) || body.recordRevision !== (snapshot.revision || 1)) throw Object.assign(new Error('摘要状态已更新，请刷新后重试'), { status: 409, code: 'RECORD_REVISION_CONFLICT' })
        if (snapshot.status !== 'archived') throw Object.assign(new Error('这份摘要已经在已保存列表中'), { status: 409, code: 'BRIEF_NOT_ARCHIVED' })
        snapshot.status = 'active'
        snapshot.archivedAt = null
        snapshot.revision = (snapshot.revision || 1) + 1
        return snapshot
      }

      if (body.type === 'edit-support-entry') {
        const entry = state.supportEntries.find((item) => item.id === body.id && item.subjectId === state.subject.id)
        if (!entry || !['symptom', 'nutrition'].includes(entry.domain) || entry.private) throw Object.assign(new Error('找不到可编辑的支持记录'), { status: 404, code: 'RECORD_MISSING' })
        if (!Number.isInteger(body.recordRevision) || body.recordRevision !== entry.revision) throw Object.assign(new Error('这条记录已更新，请刷新后再编辑'), { status: 409, code: 'RECORD_REVISION_CONFLICT' })
        const text = cleanText(body.text, 1500)
        const date = cleanText(body.date, 32)
        const subjectRole = ['patient', 'caregiver'].includes(body.subjectRole) ? body.subjectRole : null
        const sourceId = body.sourceId === undefined ? entry.sourceId || null : safeId(body.sourceId) ? body.sourceId : null
        if (!text || !validDate(date) || !subjectRole) throw Object.assign(new Error('请填写记录内容、有效日期和记录者'), { status: 400, code: 'INVALID_INPUT' })
        if (body.sharingScope !== undefined && !['selectable', 'private'].includes(body.sharingScope)) throw Object.assign(new Error('记录分享范围无效'), { status: 400, code: 'INVALID_SHARING_SCOPE' })
        const sharingScope = entry.domain === 'symptom' ? (body.sharingScope || entry.sharingScope || 'selectable') : (entry.sharingScope || 'selectable')
        if (sourceId && !state.documents.some((doc) => doc.id === sourceId)) throw Object.assign(new Error('来源资料不存在'), { status: 404, code: 'SOURCE_MISSING' })
        let nutrition = entry.nutrition || null
        if (entry.domain === 'nutrition' && body.nutrition !== undefined) {
          if (!body.nutrition || typeof body.nutrition !== 'object' || Array.isArray(body.nutrition)) throw Object.assign(new Error('营养记录字段格式无效'), { status: 400, code: 'INVALID_NUTRITION_VALUE' })
          const appetiteValue = cleanText(body.nutrition.appetite, 60)
          nutrition = {
            appetite: ['和平常差不多', '比平常少一些', '吃一点就饱'].includes(appetiteValue) ? appetiteValue : null,
            difficulty: cleanText(body.nutrition.difficulty, 100) || null,
            weightKg: optionalNumber(body.nutrition.weightKg, '体重', 1, 400),
            estimatedEnergyKcal: optionalNumber(body.nutrition.estimatedEnergyKcal, '能量估算', 0, 20000),
            estimatedProteinG: optionalNumber(body.nutrition.estimatedProteinG, '蛋白质估算', 0, 1000),
            context: cleanText(body.nutrition.context, 240) || null,
          }
        }
        entry.previousVersions = Array.isArray(entry.previousVersions) ? entry.previousVersions : []
        entry.previousVersions.unshift({ revision: entry.revision, date: entry.date, text: entry.text, subjectRole: entry.subjectRole, sourceId: entry.sourceId || null, sharingScope: entry.sharingScope || 'selectable', nutrition: entry.nutrition || null, symptomDetails: entry.symptomDetails || null, archivedAt: now })
        entry.previousVersions = entry.previousVersions.slice(0, 20)
        entry.date = date
        entry.text = text
        entry.subjectRole = subjectRole
        entry.sourceId = sourceId
        entry.sharingScope = sharingScope
        if (entry.domain === 'symptom' && body.symptomDetails !== undefined) entry.symptomDetails = normalizeSymptomDetails(body.symptomDetails)
        entry.revision += 1
        entry.updatedAt = now
        if (entry.domain === 'nutrition' && body.nutrition !== undefined) {
          entry.nutrition = nutrition
          const linkedWeights = state.observations.filter((item) => item.supportEntryId === entry.id)
          const weight = nutrition?.weightKg
          if (weight === null || weight === undefined) {
            state.observations = state.observations.filter((item) => item.supportEntryId !== entry.id)
          } else if (linkedWeights.length) {
            const observation = linkedWeights[0]
            observation.previousVersions = Array.isArray(observation.previousVersions) ? observation.previousVersions : []
            observation.previousVersions.unshift({ revision: observation.revision || 1, value: observation.value, date: observation.date, archivedAt: now })
            observation.previousVersions = observation.previousVersions.slice(0, 20)
            observation.value = String(weight)
            observation.date = date
            observation.revision = (observation.revision || 1) + 1
            observation.updatedAt = now
            if (linkedWeights.length > 1) state.observations = state.observations.filter((item) => item.supportEntryId !== entry.id || item.id === observation.id)
          } else {
            state.observations.unshift({ id: randomUUID(), subjectId: state.subject.id, metric: '体重', value: String(weight), unit: 'kg', method: null, laboratory: null, date, sourceId: null, supportEntryId: entry.id, state: 'user_recorded_no_source', createdAt: now, revision: 1 })
          }
        }
        return entry
      }

      if (body.type === 'complete-task') {
        const task = state.tasks.find((row) => row.id === body.id && row.subjectId === state.subject.id)
        if (!task) throw Object.assign(new Error('找不到这项安排'), { status: 404, code: 'RECORD_MISSING' })
        task.status = 'completed'
        task.completedAt = now
        task.revision += 1
        return task
      }

      if (body.type === 'add-task') {
        const title = cleanText(body.title, 180)
        if (!title) throw Object.assign(new Error('事项名称不能为空'), { status: 400, code: 'INVALID_INPUT' })
        const task = { id: randomUUID(), subjectId: state.subject.id, title, date: cleanText(body.date, 32) || null, status: 'open', createdAt: now, revision: 1 }
        state.tasks.unshift(task)
        return task
      }

      if (body.type === 'create-brief') {
        const basedOnSnapshotId = body.basedOnSnapshotId === undefined ? null : safeId(body.basedOnSnapshotId) ? body.basedOnSnapshotId : null
        const baseSnapshot = basedOnSnapshotId ? state.snapshots.find((item) => item.id === basedOnSnapshotId && item.subjectId === state.subject.id && item.status !== 'archived') : null
        if (basedOnSnapshotId && !baseSnapshot) throw Object.assign(new Error('作为修改基础的摘要不存在或已移入回收站；旧摘要仍保留'), { status: 404, code: 'BASE_BRIEF_MISSING' })
        const ids = (value) => Array.isArray(value) ? [...new Set(value.filter(safeId))].slice(0, 100) : []
        const documentIds = ids(body.documentIds), observationIds = ids(body.observationIds)
        const eventIds = ids(body.treatmentEventIds), clinicalIds = ids(body.clinicalRecordIds), supportIds = ids(body.supportEntryIds), questionIds = ids(body.questionIds)
        const documents = state.documents.filter((item) => documentIds.includes(item.id) && item.subjectId === state.subject.id)
        const observations = state.observations.filter((item) => observationIds.includes(item.id) && item.subjectId === state.subject.id)
        const treatmentEvents = state.treatmentEvents.filter((item) => eventIds.includes(item.id) && item.subjectId === state.subject.id)
        const clinicalRecords = state.clinicalRecords.filter((item) => clinicalIds.includes(item.id) && item.subjectId === state.subject.id)
        const supportEntries = state.supportEntries.filter((item) => supportIds.includes(item.id) && item.subjectId === state.subject.id && !item.private && item.domain !== 'mind' && item.sharingScope !== 'private').map((item) => {
          const source = item.sourceId ? state.documents.find((document) => document.id === item.sourceId) : null
          return { ...item, sourceReference: source ? { documentId: source.id, versionId: source.versionId, name: source.name } : null }
        })
        const questions = state.questions.filter((item) => questionIds.includes(item.id) && item.subjectId === state.subject.id)
        const selectedCount = documentIds.length + observationIds.length + eventIds.length + clinicalIds.length + supportIds.length + questionIds.length
        const includedCount = documents.length + observations.length + treatmentEvents.length + clinicalRecords.length + supportEntries.length + questions.length
        if (!cleanText(body.title, 120) || !selectedCount || selectedCount !== includedCount) throw Object.assign(new Error('摘要标题无效，或所选记录已不存在/不允许分享；私密心理记录不能加入摘要'), { status: 400, code: 'BRIEF_SELECTION_INVALID' })
        const snapshot = {
          id: randomUUID(), subjectId: state.subject.id, title: cleanText(body.title, 120), sourceRevision: state.revision,
          createdAt: now, status: 'active', revision: 1, versionNumber: baseSnapshot ? (baseSnapshot.versionNumber || 1) + 1 : 1,
          previousSnapshotId: baseSnapshot?.id || null, privacy: { privateMindExcluded: true, candidateClaimsExcluded: true },
          records: { documents, observations, treatmentEvents, clinicalRecords, supportEntries, questions },
        }
        state.snapshots.unshift(snapshot)
        return snapshot
      }

      if (body.type === 'save-bookmark') {
        const pageKey = cleanText(body.pageKey, 120)
        const title = cleanText(body.title, 180)
        if (!pageKey || !title) throw Object.assign(new Error('收藏页面信息不完整'), { status: 400, code: 'INVALID_INPUT' })
        let trialSnapshot = null
        if (body.trialSnapshot && typeof body.trialSnapshot === 'object') {
          const trial = body.trialSnapshot
          const registry = ['ClinicalTrials.gov', 'ChinaDrugTrials', 'ChiCTR'].includes(trial.registry) ? trial.registry : null
          const registryId = cleanText(trial.registryId, 80)
          let sourceUrl = ''
          try {
            const url = new URL(trial.sourceUrl)
            if (url.protocol === 'https:' && ['clinicaltrials.gov', 'www.chinadrugtrials.org.cn', 'www.chictr.org.cn', 'chictr.org.cn'].includes(url.hostname)) sourceUrl = url.toString()
          } catch {}
          if (!registry || !registryId || !sourceUrl) throw Object.assign(new Error('研究登记来源无效，无法收藏'), { status: 400, code: 'INVALID_TRIAL_BOOKMARK' })
          trialSnapshot = { registry, registryId, registrationDate: cleanText(trial.registrationDate, 32), lastUpdated: cleanText(trial.lastUpdated, 32), status: cleanText(trial.status, 100), phase: Array.isArray(trial.phase) ? trial.phase.filter((x) => typeof x === 'string').slice(0, 10) : [], interventions: Array.isArray(trial.interventions) ? trial.interventions.filter((x) => typeof x === 'string').slice(0, 20) : [], sourceUrl, retrievedAt: cleanText(trial.retrievedAt, 32) }
        }
        let bookmark = state.bookmarks.find((row) => row.subjectId === state.subject.id && row.pageKey === pageKey)
        if (!bookmark) {
          bookmark = { id: randomUUID(), subjectId: state.subject.id, pageKey, title, createdAt: now, snapshot: Boolean(trialSnapshot), trialSnapshot, revision: 1 }
          state.bookmarks.unshift(bookmark)
        }
        return bookmark
      }

      throw Object.assign(new Error('暂不支持此操作'), { status: 400, code: 'UNKNOWN_COMMAND' })
    }, request)
  }

  const routes = [
    {
      path: `${API}/health`, handler(req, res) {
        if (req.method !== 'GET') return send(res, 405, { code: 'METHOD_NOT_ALLOWED', message: '只支持读取' })
        send(res, 200, { ok: true, apiVersion: 'v1', capabilities: ['local-json-store', 'document-import', 'manual-records'] })
      },
    },
    {
      path: `${API}/trials`, async handler(req, res) {
        if (req.method !== 'GET') return send(res, 405, { code: 'METHOD_NOT_ALLOWED', message: '只支持读取' })
        if (!trialsCache) {
          try {
            const [raw, manifestText] = await Promise.all([readFile(trialsFile, 'utf8'), readFile(trialsManifestFile, 'utf8')])
            const manifest = JSON.parse(manifestText)
            if (!manifest.jsonl_sha256 || createHash('sha256').update(raw).digest('hex') !== manifest.jsonl_sha256) throw new Error('trial snapshot integrity check failed')
            const records = raw.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line))
            if (records.length !== manifest.record_count) throw new Error('trial snapshot record count mismatch')
            trialsCache = { records, manifest }
          } catch { throw Object.assign(new Error('临床研究本机资料包不可用'), { status: 503, code: 'CAPABILITY_UNAVAILABLE' }) }
        }
        const params = new URL(req.url, 'http://127.0.0.1').searchParams
        const query = cleanText(params.get('q'), 160).toLocaleLowerCase()
        const registry = cleanText(params.get('registry'), 40)
        const candidates = trialsCache.records.filter((item) => (!registry || item.registry === registry) && (!query || [item.registry_id, item.title, item.title_en, item.summary, item.status, item.sponsor, ...(item.conditions || []), ...(item.interventions || []), ...(item.countries || []), item.eligibility?.eligibilityCriteria].join(' ').toLocaleLowerCase().includes(query)))
        const total = candidates.length
        const offset = Math.min(Math.max(Number.parseInt(params.get('offset') || '0', 10) || 0, 0), total)
        const limit = Math.min(Math.max(Number.parseInt(params.get('limit') || '30', 10) || 30, 1), 50)
        const records = candidates.slice(offset, offset + limit).map((item) => ({ registry: item.registry, registryId: item.registry_id, title: item.title, titleEn: item.title_en, registrationDate: item.registration_date, lastUpdated: item.last_updated, status: item.status, studyType: item.study_type, phase: item.phase, sponsor: item.sponsor, conditions: item.conditions, interventions: item.interventions, countries: item.countries, summary: item.summary, eligibility: item.eligibility, sourceUrl: item.source_url }))
        send(res, 200, { source: { title: trialsCache.manifest.title, retrievedAt: trialsCache.manifest.retrieved_at, dateScope: trialsCache.manifest.date_scope, dataBoundary: trialsCache.manifest.data_boundary, coverage: trialsCache.manifest.source_coverage, registryCounts: trialsCache.manifest.registry_counts }, query, total, offset, limit, results: records })
      },
    },
    {
      path: `${API}/settings`, async handler(req, res) {
        if (req.method === 'GET') {
          await ensureRootLoaded()
          let available = false
          if (root) { try { available = (await stat(root)).isDirectory() } catch {} }
          const credential = await mineruCredential()
          const cliAvailable = adapters.hasMineruCli ? await adapters.hasMineruCli() : Boolean(await mineruCliPath())
          const guidance = await guidancePackage()
          return send(res, 200, { schemaVersion: 1, dataRoot: root, status: !root ? 'directory-required' : available ? 'configured' : 'directory-unavailable', parseMode, mineru: { configured: Boolean(credential.token), source: credential.source, cliAvailable, perFileConsentRequired: true }, referencePackage: 'bundled-2026-snapshot', guidance: { packageId: guidance.package_id, builtAt: guidance.built_at, clinicalUseStatus: guidance.clinical_use_status, defaultRegion: guidance.default_region, boundary: guidance.boundary, refreshPolicy: guidance.refresh_policy, sources: guidance.sources.map(({ id, title, display_title, publisher, region, source_type, publication_date, official_announcement_date, last_updated, last_content_verified, verification_status, content_included, applicability_note, limitations, url, additional_metadata_url, documentOutline }) => ({ id, title, displayTitle: display_title || title, publisher, region, sourceType: source_type, publicationDate: publication_date, officialAnnouncementDate: official_announcement_date || null, lastUpdated: last_updated, lastContentVerified: last_content_verified, verificationStatus: verification_status, contentIncluded: content_included, applicabilityNote: applicability_note, limitations, url, additionalMetadataUrl: additional_metadata_url || null, documentOutline: documentOutline || null })) } })
        }
        if (req.method !== 'POST') return send(res, 405, { code: 'METHOD_NOT_ALLOWED', message: '只支持读取或提交设置' })
        const body = await readBody(req, 16 * 1024)
        if (body.parseMode !== undefined && !['local', 'mineru-cloud'].includes(body.parseMode)) throw Object.assign(new Error('请选择有效的解析模式'), { status: 400, code: 'INVALID_PARSE_MODE' })
        if (body.token !== undefined) {
          const token = cleanText(body.token, 1025)
          if (token && (!/^[A-Za-z0-9._-]{8,1024}$/.test(token))) throw Object.assign(new Error('MinerU Token 格式不正确'), { status: 400, code: 'INVALID_TOKEN' })
          if (!ctx.credentials?.set || !ctx.credentials?.unset) throw Object.assign(new Error('此 Desktop 版本未提供安全凭据存储，无法保存自备 Token'), { status: 503, code: 'CREDENTIAL_STORE_UNAVAILABLE' })
          if (token) await ctx.credentials.set(MINERU_CREDENTIAL_REF, token)
          else await ctx.credentials.unset(MINERU_CREDENTIAL_REF)
        }
        if (body.parseMode !== undefined) await persistSettings({ parseMode: body.parseMode })
        const credential = await mineruCredential()
        const cliAvailable = adapters.hasMineruCli ? await adapters.hasMineruCli() : Boolean(await mineruCliPath())
        return send(res, 200, { saved: true, parseMode, mineru: { configured: Boolean(credential.token), source: credential.source, cliAvailable, perFileConsentRequired: true } })
      },
    },
    {
      path: `${API}/settings/data-root`, async handler(req, res) {
        if (req.method !== 'POST') return send(res, 405, { code: 'METHOD_NOT_ALLOWED', message: '只支持提交设置' })
        const body = await readBody(req, 16 * 1024)
        await ensureRootLoaded()
        const requested = cleanText(body.path, 2048)
        if (!requested || !resolve(requested).startsWith(sep)) throw Object.assign(new Error('请选择有效的本机资料目录'), { status: 400, code: 'INVALID_DIRECTORY' })
        let chosen
        try {
          chosen = await realpath(resolve(requested))
          if (!(await stat(chosen)).isDirectory()) throw new Error('not a directory')
          await access(chosen, fsConstants.R_OK | fsConstants.W_OK)
          const probe = join(chosen, `.ovarian-workbench-check-${randomUUID()}`)
          await writeFile(probe, 'ok', { flag: 'wx', mode: 0o600 }); await unlink(probe)
        } catch { throw Object.assign(new Error('所选位置不可访问或不可写；请在系统目录选择器中重新选择'), { status: 400, code: 'DIRECTORY_UNAVAILABLE' }) }
        if (root === chosen) return send(res, 200, { schemaVersion: 1, dataRoot: root, status: 'configured', changed: false })
        if (root) {
          let hasData = false
          try { await stat(join(root, 'workspace-v1.json')); hasData = true } catch {}
          if (hasData && body.confirmLeaveOldRoot !== true) throw Object.assign(new Error('切换目录不会迁移或删除旧目录资料；确认后继续'), { status: 409, code: 'DIRECTORY_SWITCH_CONFIRMATION_REQUIRED' })
        }
        await persistSettings({ dataRoot: chosen })
        send(res, 200, { schemaVersion: 1, dataRoot: root, status: 'configured', changed: true })
      },
    },
    {
      path: `${API}/settings/backup`, async handler(req, res) {
        if (req.method !== 'POST') return send(res, 405, { code: 'METHOD_NOT_ALLOWED', message: '只支持创建备份' })
        const body = await readBody(req, 16 * 1024)
        send(res, 200, { backup: await createBackup(body.destinationPath) })
      },
    },
    {
      path: `${API}/settings/restore`, async handler(req, res) {
        if (req.method !== 'POST') return send(res, 405, { code: 'METHOD_NOT_ALLOWED', message: '只支持恢复备份' })
        const body = await readBody(req, 16 * 1024)
        send(res, 200, { restored: await restoreBackup(body.backupPath, body.destinationPath) })
      },
    },
    {
      path: `${API}/document-parse`, async handler(req, res) {
        if (req.method !== 'POST') return send(res, 405, { code: 'METHOD_NOT_ALLOWED', message: '只支持提交解析任务' })
        const body = await readBody(req, 16 * 1024)
        const documentId = body.documentId
        if (!safeId(documentId)) throw Object.assign(new Error('资料编号无效'), { status: 400, code: 'INVALID_INPUT' })
        const state = await loadState()
        const doc = state.documents.find((item) => item.id === documentId)
        if (!doc) throw Object.assign(new Error('原始资料不存在'), { status: 404, code: 'SOURCE_MISSING' })
        const activeRoot = await requireRoot()
        const sourcePath = resolve(activeRoot, doc.relativePath)
        if (!sourcePath.startsWith(`${activeRoot}${sep}`)) throw Object.assign(new Error('资料路径无效'), { status: 400, code: 'INVALID_PATH' })
        const bytes = await readFile(sourcePath)
        let markdown = ''
        let engine = 'local-text'
        let consentAt = null
        if (parseMode === 'local') {
          if (doc.mime !== 'text/plain') throw Object.assign(new Error('仅本机模式暂支持 TXT 文本；PDF和图片需要逐份确认后使用MinerU云端识别'), { status: 409, code: 'LOCAL_PARSE_UNSUPPORTED' })
          markdown = bytes.toString('utf8')
        } else {
          if (body.confirmCloudUpload !== true) throw Object.assign(new Error('发送报告到 MinerU 云端前，请逐份确认原件将离开本机'), { status: 403, code: 'CLOUD_CONSENT_REQUIRED' })
          const credential = await mineruCredential()
          if (!credential.token) throw Object.assign(new Error('MinerU 凭据不可用。可在设置中替换个人 Token，或继续手工整理'), { status: 503, code: 'MINERU_UNAVAILABLE' })
          const parsed = await (adapters.extractWithMineru || extractWithMineru)(bytes, extname(doc.name).toLowerCase(), { token: credential.token, tokenConfigured: true, model: 'pipeline' })
          markdown = parsed.markdown
          engine = parsed.engine
          consentAt = new Date().toISOString()
        }
        if (!markdown || markdown.length > 2_000_000) throw Object.assign(new Error('解析结果为空或超过保存上限；原件未更改，可改用手工录入'), { status: 422, code: 'PARSE_RESULT_INVALID' })
        const result = await setParsedDocument(documentId, markdown, engine, consentAt)
        send(res, 200, { ...result, markdown, notice: '以下是机器转录草稿，不是诊断结论；请逐项对照原件，确认后再录入工作台。' })
      },
    },
    {
      path: `${API}/document-parsed`, async handler(req, res) {
        if (req.method !== 'GET') return send(res, 405, { code: 'METHOD_NOT_ALLOWED', message: '只支持读取' })
        const id = new URL(req.url, 'http://127.0.0.1').searchParams.get('id')
        if (!safeId(id)) return send(res, 400, { code: 'INVALID_INPUT', message: '资料编号无效' })
        const state = await loadState()
        const doc = state.documents.find((item) => item.id === id)
        if (!doc?.parseRelativePath) return send(res, 404, { code: 'PARSE_RESULT_MISSING', message: '尚无解析草稿' })
        const activeRoot = await requireRoot()
        const path = resolve(activeRoot, doc.parseRelativePath)
        if (!path.startsWith(`${activeRoot}${sep}`)) return send(res, 400, { code: 'INVALID_PATH', message: '解析结果路径无效' })
        const markdown = await readFile(path, 'utf8')
        send(res, 200, { markdown, engine: doc.parseEngine, parsedAt: doc.parsedAt, cloudConsentAt: doc.cloudConsentAt || null })
      },
    },
    {
      path: `${API}/demo/load`, async handler(req, res) {
        if (req.method !== 'POST') return send(res, 405, { code: 'METHOD_NOT_ALLOWED', message: '只支持载入模拟资料' })
        const body = await readBody(req, 16 * 1024)
        const demoId = cleanText(body.demoId, 64)
        const demoFiles = {
          'newly-diagnosed': new URL('../assets/demo-data/newly-diagnosed.json', import.meta.url),
          'recurrent-treatment': new URL('../assets/demo-data/recurrent-treatment.json', import.meta.url),
        }
        if (!demoFiles[demoId]) throw Object.assign(new Error('模拟资料编号无效'), { status: 404, code: 'DEMO_NOT_FOUND' })
        const readFixture = async (id) => {
          try { return JSON.parse(await readFile(demoFiles[id], 'utf8')) }
          catch { throw Object.assign(new Error('模拟资料包无法读取；现有工作区未更改'), { status: 503, code: 'DEMO_PACKAGE_UNAVAILABLE' }) }
        }
        const validateFixture = (fixture, id) => {
          if (fixture.demoId !== id || fixture.syntheticOnly !== true || !fixture.workspace || !Array.isArray(fixture.workspace.documents) || !fixture.files || typeof fixture.files !== 'object') throw Object.assign(new Error('模拟资料包结构不完整；现有工作区未更改'), { status: 503, code: 'DEMO_PACKAGE_INVALID' })
          const seeded = normalizeState(fixture.workspace)
          const subjectId = seeded.subject?.id
          if (!safeId(subjectId) || seeded.subject.demoId !== id || !seeded.documents.length || seeded.documents.some((doc) => doc.subjectId !== subjectId || !safeId(doc.id))) throw Object.assign(new Error('模拟资料主体或来源关联校验失败；现有工作区未更改'), { status: 503, code: 'DEMO_PACKAGE_INVALID' })
          return seeded
        }
        const fixture = await readFixture(demoId)
        const seeded = validateFixture(fixture, demoId)
        const activeRoot = await requireRoot()
        const existing = await loadState()
        const hasRecords = Object.keys(emptyState()).some((key) => Array.isArray(existing[key]) && existing[key].length > 0)
        const shellSubjectOnly = !existing.subject || (existing.revision <= 1 && ['本机资料', '我的资料', ''].includes(existing.subject.label) && Object.keys(existing.subject).every((key) => ['id', 'label', 'createdAt'].includes(key)))
        const emptyWorkspaceShell = shellSubjectOnly && existing.revision <= 1 && !hasRecords && !existing.demoId
        let previousFixture = null
        if (existing.demoId) {
          if (existing.demoId === demoId && existing.revision === 1) {
            const original = validateFixture(await readFixture(demoId), demoId)
            const arraysMatch = Object.keys(emptyState()).filter((key) => Array.isArray(emptyState()[key])).every((key) => JSON.stringify(existing[key] || []) === JSON.stringify(original[key] || []))
            if (arraysMatch && JSON.stringify(existing.subject) === JSON.stringify(original.subject)) return send(res, 200, { loaded: true, alreadyLoaded: true, demoId, name: cleanText(fixture.name, 100), revision: existing.revision })
          }
          if (existing.revision === 1 && existing.demoId !== demoId && demoFiles[existing.demoId]) {
            const originalFixture = await readFixture(existing.demoId)
            const original = validateFixture(originalFixture, existing.demoId)
            const arraysMatch = Object.keys(emptyState()).filter((key) => Array.isArray(emptyState()[key])).every((key) => JSON.stringify(existing[key] || []) === JSON.stringify(original[key] || []))
            const subjectMatches = JSON.stringify(existing.subject) === JSON.stringify(original.subject)
            if (arraysMatch && subjectMatches && existing.demoName === cleanText(originalFixture.name, 100)) previousFixture = originalFixture
          }
        }
        if (!emptyWorkspaceShell && !previousFixture) throw Object.assign(new Error('当前资料目录已有病历或已修改的模拟资料；未做任何更改。只有空白工作区或未编辑的示例档案可以直接载入/切换'), { status: 409, code: 'DEMO_REQUIRES_EMPTY_WORKSPACE' })
        const createdFiles = []
        try {
          for (const [relative, contents] of Object.entries(fixture.files)) {
            const safeRelative = backupRelativePath(relative)
            const bytes = Buffer.from(contents, 'utf8')
            if (!safeRelative || bytes.length > MAX_UPLOAD_BYTES || safeRelative === 'workspace-v1.json') throw Object.assign(new Error('模拟资料文件路径或大小无效'), { status: 503, code: 'DEMO_PACKAGE_INVALID' })
            const target = resolve(activeRoot, safeRelative)
            if (!target.startsWith(`${activeRoot}${sep}`)) throw Object.assign(new Error('模拟资料文件路径越界'), { status: 503, code: 'DEMO_PACKAGE_INVALID' })
            await mkdir(dirname(target), { recursive: true, mode: 0o700 })
            await writeFile(target, bytes, { flag: 'wx', mode: 0o600 })
            createdFiles.push(target)
          }
          seeded.demoId = demoId
          seeded.demoName = cleanText(fixture.name, 100)
          seeded.revision = 1
          seeded.updatedAt = new Date().toISOString()
          await saveState(seeded, activeRoot)
          if (previousFixture) {
            const newPaths = new Set(Object.keys(fixture.files))
            await Promise.all(Object.entries(previousFixture.files).filter(([relative]) => !newPaths.has(relative)).map(async ([relative, originalContents]) => {
              const safeRelative = backupRelativePath(relative)
              if (!safeRelative) return
              const target = resolve(activeRoot, safeRelative)
              if (!target.startsWith(`${activeRoot}${sep}`)) return
              try { if (await readFile(target, 'utf8') === originalContents) await unlink(target) } catch {}
            }))
          }
          send(res, 200, { loaded: true, demoId, name: seeded.demoName, revision: seeded.revision, switched: Boolean(previousFixture), recordCounts: { documents: seeded.documents.length, observations: seeded.observations.length, treatmentEvents: seeded.treatmentEvents.length, clinicalRecords: seeded.clinicalRecords.length, supportEntries: seeded.supportEntries.length, questions: seeded.questions.length } })
        } catch (error) {
          await Promise.all(createdFiles.map((path) => unlink(path).catch(() => {})))
          if (error.code === 'EEXIST') throw Object.assign(new Error('目标目录存在与示例同名的文件；未覆盖原文件或工作区，已有病历也不会更改'), { status: 409, code: 'DEMO_DIRECTORY_NOT_EMPTY' })
          throw error
        }
      },
    },
    {
      path: `${API}/state`, async handler(req, res) {
        if (req.method !== 'GET') return send(res, 405, { code: 'METHOD_NOT_ALLOWED', message: '只支持读取' })
        let state, storageStatus
        try { state = await loadState(); storageStatus = root ? 'configured' : 'directory-required' }
        catch (error) {
          if (error.code !== 'DIRECTORY_UNAVAILABLE') throw error
          state = emptyState(); storageStatus = 'directory-unavailable'
        }
        send(res, 200, { schemaVersion: state.schemaVersion, revision: state.revision, subject: state.subject, demoId: state.demoId, demoName: state.demoName, documents: state.documents, claims: state.claims, reviewDecisions: state.reviewDecisions, clinicalRecords: state.clinicalRecords, observations: state.observations, treatmentEvents: state.treatmentEvents, supportEntries: state.supportEntries, questions: state.questions, tasks: state.tasks, bookmarks: state.bookmarks, snapshots: state.snapshots, agentResponses: state.agentResponses, updatedAt: state.updatedAt, storage: { status: storageStatus, kind: 'user-selected-directory', path: root } })
      },
    },
    {
      path: `${API}/document`, async handler(req, res) {
        if (req.method !== 'GET') return send(res, 405, { code: 'METHOD_NOT_ALLOWED', message: '只支持读取' })
        const id = new URL(req.url, 'http://127.0.0.1').searchParams.get('id')
        if (!safeId(id)) return send(res, 400, { code: 'INVALID_INPUT', message: '资料编号无效' })
        const state = await loadState()
        const doc = state.documents.find((item) => item.id === id)
        if (!doc) return send(res, 404, { code: 'SOURCE_MISSING', message: '原始资料不存在' })
        const activeRoot = await requireRoot()
        const filePath = resolve(activeRoot, doc.relativePath)
        if (!filePath.startsWith(`${activeRoot}${sep}`)) return send(res, 400, { code: 'INVALID_PATH', message: '资料路径无效' })
        const bytes = await readFile(filePath)
        res.writeHead(200, {
          'content-type': doc.mime,
          'content-length': bytes.length,
          'content-disposition': `inline; filename*=UTF-8''${encodeURIComponent(doc.name)}`,
          'cache-control': 'no-store',
          'x-content-type-options': 'nosniff',
          'content-security-policy': "default-src 'none'; sandbox",
        })
        res.end(bytes)
      },
    },
    {
      path: `${API}/document-download`, async handler(req, res) {
        if (req.method !== 'GET') return send(res, 405, { code: 'METHOD_NOT_ALLOWED', message: '只支持读取' })
        const id = new URL(req.url, 'http://127.0.0.1').searchParams.get('id')
        if (!safeId(id)) return send(res, 400, { code: 'INVALID_INPUT', message: '资料编号无效' })
        const state = await loadState()
        const doc = state.documents.find((item) => item.id === id)
        if (!doc) return send(res, 404, { code: 'SOURCE_MISSING', message: '原始资料不存在' })
        const activeRoot = await requireRoot()
        const filePath = resolve(activeRoot, doc.relativePath)
        if (!filePath.startsWith(`${activeRoot}${sep}`)) return send(res, 400, { code: 'INVALID_PATH', message: '资料路径无效' })
        const bytes = await readFile(filePath)
        res.writeHead(200, {
          'content-type': doc.mime,
          'content-length': bytes.length,
          'content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(doc.name)}`,
          'cache-control': 'no-store',
          'x-content-type-options': 'nosniff',
        })
        res.end(bytes)
      },
    },
    {
      path: `${API}/command`, async handler(req, res) {
        if (req.method !== 'POST') return send(res, 405, { code: 'METHOD_NOT_ALLOWED', message: '只支持提交操作' })
        const body = await readBody(req)
        const result = await command(body)
        send(res, 200, { revision: result.state.revision, result: result.result })
      },
    },
  ]

  if (desktopFetch) {
    ctx.effect(() => {
      const disposers = routes.map(({ path, handler }) => ctx.connection.fetch.register({
        path,
        methods: ['GET', 'POST'],
        requestBody: 'buffered',
        async fetch(request) {
          try {
            const bytes = request.method === 'GET' || request.method === 'HEAD' ? Buffer.alloc(0) : Buffer.from(await request.arrayBuffer())
            const req = { method: request.method, url: request.url, async *[Symbol.asyncIterator]() { if (bytes.length) yield bytes } }
            const res = {
              status: 200, headers: {}, body: Buffer.alloc(0),
              writeHead(status, headers = {}) { this.status = status; this.headers = headers },
              end(value = '') { this.body = Buffer.isBuffer(value) ? value : Buffer.from(String(value)) },
            }
            await handler(req, res)
            return new Response(res.body, { status: res.status, headers: res.headers })
          } catch (error) {
            return Response.json({ code: error.code || 'INTERNAL_ERROR', message: error.status ? error.message : '本机工作区操作失败；已有资料已保留，可重试或联系维护者' }, { status: error.status || 500, headers: { 'cache-control': 'no-store' } })
          }
        },
      }))
      return () => disposers.forEach((dispose) => { if (typeof dispose === 'function') dispose() })
    }, 'ovarian-workbench DSH Desktop fetch API')
    return
  }

  ctx.effect(() => {
    const disposers = routes.map(({ path, handler }) => ctx.webServer.register({
      kind: 'exact', path,
      async handler(req, res) {
        try {
          const rejection = ctx.connection.requestRejection(req)
          if (rejection !== undefined) return send(res, rejection, { code: 'AUTH_REQUIRED', message: '需要通过 Desktop 会话验证后才能访问本机资料' })
          await handler(req, res)
        } catch (error) {
          send(res, error.status || 500, { code: error.code || 'INTERNAL_ERROR', message: error.status ? error.message : '本机工作区操作失败；已有资料已保留，可重试或联系维护者' })
        }
      },
    }))
    return () => disposers.forEach((dispose) => dispose?.())
  }, 'ovarian-workbench local data API')
}
