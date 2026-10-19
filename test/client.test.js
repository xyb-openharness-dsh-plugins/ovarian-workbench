import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { JSDOM } from 'jsdom'
import { createCanvas } from '@napi-rs/canvas'

const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const clientSourcePath = process.env.OVARIAN_WORKBENCH_CLIENT_PATH || new URL('../lib/client.js', import.meta.url)

test('workbench renders, compares independent metrics, searches and bookmarks trials, and freezes a share-safe brief', async (t) => {
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://127.0.0.1:43129/', pretendToBeVisual: true, runScripts: 'outside-only' })
  t.after(() => dom.window.close())
  const nativeCanvases = new WeakMap()
  dom.window.HTMLCanvasElement.prototype.getContext = function (kind) { const native = createCanvas(this.width, this.height); nativeCanvases.set(this, native); const context = native.getContext(kind); const drawImage = context.drawImage.bind(context); context.drawImage = (source, ...args) => drawImage(nativeCanvases.get(source) || source, ...args); return context }
  dom.window.HTMLCanvasElement.prototype.toBlob = function (callback, type = 'image/png', quality) { const native = nativeCanvases.get(this) || createCanvas(this.width, this.height); const format = type === 'image/jpeg' ? 'image/jpeg' : 'image/png'; callback(new Blob([native.toBuffer(format, quality === undefined ? undefined : { quality })], { type: format })) }
  Object.defineProperty(globalThis, 'window', { configurable: true, value: dom.window })
  Object.defineProperty(globalThis, 'document', { configurable: true, value: dom.window.document })
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator })
  Object.defineProperty(globalThis, 'HTMLElement', { configurable: true, value: dom.window.HTMLElement })
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { configurable: true, value: true })

  const state = {
    schemaVersion: 1, revision: 1, subject: { id: uuid(1), label: '测试资料' }, storage: { status: 'configured', kind: 'user-selected-directory', path: '/tmp/old-patient-folder' },
    clinicalRecords: [], documents: [{ id: uuid(2), subjectId: uuid(1), name: '病理报告.pdf', mime: 'application/pdf', size: 30, sha256: 'abc', uploadedAt: '2026-06-01', status: 'stored_unreviewed' }],
    claims: [{ id: uuid(3), documentId: uuid(2), label: '待核CA125', value: '35', unit: 'U/mL', status: 'candidate' }], reviewDecisions: [],
    observations: [
      { id: uuid(4), subjectId: uuid(1), metric: 'CA125', value: '35', unit: 'U/mL', date: '2026-06-01', method: 'assay-A', laboratory: 'lab-A', sourceId: uuid(2), state: 'user_accepted_transcription' },
      { id: uuid(5), subjectId: uuid(1), metric: 'CA125', value: '28', unit: 'U/mL', date: '2026-09-01', method: 'assay-A', laboratory: 'lab-A', sourceId: uuid(2), state: 'user_recorded' },
      { id: uuid(6), subjectId: uuid(1), metric: 'HGB', value: '109', unit: 'g/L', date: '2026-09-01', method: 'CBC', laboratory: 'lab-A', sourceId: uuid(2), state: 'user_recorded' },
    ],
    treatmentEvents: [{ id: uuid(7), subjectId: uuid(1), title: '手术沟通', kind: 'surgery', status: 'discussed', date: '2026-08-01', note: '准备手术问题' }],
    supportEntries: [{ id: uuid(8), subjectId: uuid(1), domain: 'mind', private: true, subjectRole: 'patient', text: '不应进入摘要', date: '2026-09-01' }, { id: uuid(9), subjectId: uuid(1), domain: 'nutrition', private: false, subjectRole: 'patient', text: '胃口一般', date: '2026-09-02' }],
    questions: [{ id: uuid(10), subjectId: uuid(1), text: '我还需要核对什么？' }], tasks: [], bookmarks: [], snapshots: [], agentResponses: [], updatedAt: null,
  }
  const trial = { registry: 'ClinicalTrials.gov', registryId: 'NCT-test', title: 'Ovarian Cancer Trial Fixture', titleEn: '', registrationDate: '2026-05-01', lastUpdated: '2026-08-01', status: 'RECRUITING', studyType: 'INTERVENTIONAL', phase: ['PHASE2'], sponsor: 'Fixture', conditions: ['Ovarian Cancer'], interventions: ['Study drug'], countries: ['United States'], summary: 'Test fixture, not a real study.', eligibility: { eligibilityCriteria: 'Adults with confirmed diagnosis.' }, sourceUrl: 'https://clinicaltrials.gov/study/NCT-test' }
  let sequence = 20
  const callLog = []
  const downloads = []
  dom.window.URL.createObjectURL = (blob) => { downloads.push({ blob, file: null }); return `blob:test/${downloads.length}` }
  dom.window.URL.revokeObjectURL = () => {}
  dom.window.HTMLAnchorElement.prototype.click = function () { if (downloads.length) downloads.at(-1).file = this.download }
  let selectedDirectoryRequest = null
  let nativeSessionDraft = ''
  let nativeSubmitCalls = 0
  let nativeSessionFolder = null
  let nativeCurrentSession = null
  let nativeInputSnapshot = { draft: '', phase: 'plain', occurrences: [] }
  let directoryPickerCalls = 0
  let ownershipUnavailable = false
  let settingsFixture = { parseMode: 'mineru-cloud', mineru: { configured: true, source: 'community', perFileConsentRequired: true }, guidance: { defaultRegion: 'CN', builtAt: '2026-10-18', boundary: '仅列来源，不决定治疗', refreshPolicy: '使用前核对版本', sources: [ { id: 'nhc-ovarian-2022', title: '卵巢癌诊疗指南（2022年版）', publisher: '国家卫生健康委', region: 'CN', sourceType: 'national_guideline', publicationDate: '2022', lastContentVerified: '2026-10-18', verificationStatus: 'official_2022_guideline_scope_verified_superseded_by_newer_professional_guidance', applicabilityNote: '输卵管癌和原发性腹膜癌的诊治原则可参照卵巢上皮性癌指南', limitations: '官方旧版；本机仅提供章节目录，不提供当前治疗建议', url: 'https://www.nhc.gov.cn/yzygj/c100068/202204/0c1f7d3aca0545abbeb02030ce255930/files/1732863054558_17204.pdf', documentOutline: [{ title: '治疗：手术治疗', page: 20 }, { title: '治疗：化疗', page: 25 }, { title: '治疗：靶向治疗', page: 30 }, { title: '治疗：免疫治疗、放疗', page: 32 }] }, { id: 'csco-ovarian-2026', title: '2026版CSCO妇科肿瘤指南（含卵巢癌诊疗指南）', publisher: 'CSCO', region: 'CN', sourceType: 'professional_guideline', publicationDate: null, officialAnnouncementDate: '2026-03-12', lastContentVerified: '2026-10-18', verificationStatus: 'official_2026_distribution_verified_full_text_and_recommendations_unverified', applicabilityNote: '官方活动报道确认指南发放与解读活动，日期不是指南出版日期', limitations: '未取得指南正文，正文和推荐未核验', url: 'https://www.csco.org.cn/cn/ncontent.aspx?oid=9268', additionalMetadataUrl: 'https://www.csco.org.cn/cn/ncontent.aspx?oid=9339' }, { id: 'nci-pdq-patient-2024', title: 'Ovarian Epithelial Treatment PDQ', displayTitle: 'NCI患者资料：卵巢上皮性癌、输卵管癌及原发性腹膜癌治疗（英文）', publisher: 'NCI', region: 'US', sourceType: 'patient_information_not_china_guideline', publicationDate: null, lastUpdated: '2024-11-22', verificationStatus: 'scope_and_update_date_verified', applicabilityNote: '患者教育资料', limitations: '美国资料，不是中国指南', url: 'https://www.cancer.gov/types/ovarian/patient/ovarian-epithelial-treatment-pdq' } ] } }
  let parsedFixture = null
  const fileReaderControl = { failName: 'read-error.txt' }
  class FixtureFileReader {
    readAsDataURL(file) {
      if (file.name === fileReaderControl.failName) { setTimeout(() => this.onerror?.(), 0); return }
      this.result = 'data:text/plain;base64,dGVzdA=='
      setTimeout(() => this.onload?.(), 0)
    }
  }
  dom.window.confirm = () => true
  dom.window.fetch = async (input, options = {}) => {
    const url = new URL(String(input), dom.window.location.href)
    if (url.pathname.endsWith('/state')) return { ok: true, status: 200, json: async () => structuredClone(state) }
    if (url.pathname.endsWith('/settings')) {
      if (options.method === 'POST') { const body = JSON.parse(options.body); if (body.parseMode) settingsFixture.parseMode = body.parseMode; if (body.token !== undefined) settingsFixture.mineru.source = body.token ? 'user' : 'community'; return { ok: true, status: 200, json: async () => ({ ...structuredClone(settingsFixture), saved: true }) } }
      return { ok: true, status: 200, json: async () => structuredClone(settingsFixture) }
    }
    if (url.pathname.endsWith('/document-parsed')) return parsedFixture ? { ok: true, status: 200, json: async () => structuredClone(parsedFixture) } : { ok: false, status: 404, json: async () => ({ code: 'PARSE_RESULT_MISSING' }) }
    if (url.pathname.endsWith('/document-parse')) { const body = JSON.parse(options.body); if (!body.confirmCloudUpload) return { ok: false, status: 403, json: async () => ({ message: '逐份授权后再试' }) }; parsedFixture = { id: body.documentId, parseStatus: 'parsed', parseEngine: 'mineru-api-pipeline', markdown: '# 转录草稿\nCA125: 35 U/mL\nHE4 | 48 pmol/L\nCA19-9: 16 U/mL\n癌胚抗原（CEA）: 2.1 ng/mL\nCA72-4: 3.2 U/mL\n血红蛋白 | 102 | g/L\n谷丙转氨酶 | 30 | U/L\n血清钾 | 4.0 | mmol/L\n镁 | 0.78 | mmol/L\n血小板 | 180 | ×10⁹/L\n平均红细胞体积 | 88 | fL\nC反应蛋白 | <5 | mg/L\nCA125 | 62 | 0-35 | U/mL | 2026年10月18日\n血红蛋白 | 108 | 115-150 | g/L\n未知指标 | 2.5 | 1.0-3.0 | mmol/L\nCA125参考范围: 35 U/mL\nCA125: 低于参考值（0-35）', notice: '机器转录草稿' }; state.documents[0].parseStatus = 'parsed'; state.documents[0].parseEngine = parsedFixture.parseEngine; state.revision++; return { ok: true, status: 200, json: async () => structuredClone(parsedFixture) } }
    if (url.pathname.endsWith('/settings/data-root')) { selectedDirectoryRequest = JSON.parse(options.body); state.storage.path = selectedDirectoryRequest.path; return { ok: true, status: 200, json: async () => ({ status: 'configured' }) } }
    if (url.pathname.endsWith('/trials')) return { ok: true, status: 200, json: async () => ({ source: { title: '测试快照', retrievedAt: '2026-10-17', registryCounts: {}, coverage: '测试数据，不是实时登记' }, query: url.searchParams.get('q'), total: 1, offset: 0, limit: 30, results: [trial] }) }
    if (url.pathname.endsWith('/command')) {
      const body = JSON.parse(options.body); callLog.push(body)
      if (body.type === 'import-document') {
        if (body.name === 'api-error.txt') return { ok: false, status: 500, json: async () => ({ message: '本机目录写入失败' }) }
        const row = { id: uuid(sequence++), subjectId: uuid(1), status: 'stored_unreviewed', uploadedAt: new Date().toISOString(), ...body }; state.documents.push(row); state.revision++
        return { ok: true, status: 201, json: async () => ({ revision: state.revision, result: row }) }
      }
      if (body.type === 'add-claim') { const row = { id: uuid(sequence++), subjectId: uuid(1), status: 'candidate', ...body }; state.claims.unshift(row); state.revision++; return { ok: true, status: 200, json: async () => ({ revision: state.revision, result: row }) } }
      if (body.type === 'add-support-entry') { const row = { id: uuid(sequence++), subjectId: uuid(1), status: 'recorded', ...body }; state.supportEntries.unshift(row); if (body.nutrition?.weightKg) state.observations.unshift({ id: uuid(sequence++), subjectId: uuid(1), metric: '体重', value: body.nutrition.weightKg, unit: 'kg', date: body.date, supportEntryId: row.id, state: 'user_recorded_no_source' }); state.revision++; return { ok: true, status: 200, json: async () => ({ revision: state.revision, result: row }) } }
      if (body.type === 'edit-support-entry') { const row = state.supportEntries.find((item) => item.id === body.id); row.previousVersions = [{ revision: row.revision || 1, text: row.text, nutrition: row.nutrition || null }]; Object.assign(row, body, { revision: (row.revision || 1) + 1 }); if (body.nutrition) { row.nutrition = body.nutrition; const weight = state.observations.find((item) => item.supportEntryId === row.id); if (weight && body.nutrition.weightKg) { weight.previousVersions = [{ value: weight.value, date: weight.date }]; weight.value = String(body.nutrition.weightKg); weight.date = body.date; weight.revision = (weight.revision || 1) + 1 } else if (weight) state.observations = state.observations.filter((item) => item.supportEntryId !== row.id) } state.revision++; return { ok: true, status: 200, json: async () => ({ revision: state.revision, result: row }) } }
      if (body.type === 'add-clinical-record') { const row = { id: uuid(sequence++), subjectId: uuid(1), createdAt: new Date().toISOString(), ...body }; state.clinicalRecords.unshift(row); state.revision++; return { ok: true, status: 200, json: async () => ({ revision: state.revision, result: row }) } }
      if (body.type === 'save-bookmark') {
        const row = { id: uuid(sequence++), subjectId: uuid(1), ...body, snapshot: Boolean(body.trialSnapshot), createdAt: new Date().toISOString() }
        state.bookmarks.unshift(row); state.revision++
        return { ok: true, status: 200, json: async () => ({ revision: state.revision, result: row }) }
      }
      if (body.type === 'save-agent-response') {
        const row = { id: uuid(sequence++), subjectId: uuid(1), status: 'unreviewed', privacy: 'private-workspace', revision: 1, previousVersions: [], ...body, sourceRefs: body.sourceRefs.map((ref) => ({ ...ref, revision: state.observations.find((item) => item.id === ref.id)?.revision || 1, label: state.observations.find((item) => item.id === ref.id)?.metric || ref.group })) }
        state.agentResponses.unshift(row); state.revision++
        return { ok: true, status: 200, json: async () => ({ revision: state.revision, result: row }) }
      }
      if (body.type === 'review-agent-response') {
        const row = state.agentResponses.find((item) => item.id === body.id); row.status = 'user_checked_references'; row.revision++
        state.revision++
        return { ok: true, status: 200, json: async () => ({ revision: state.revision, result: row }) }
      }
      if (body.type === 'create-brief') {
        const selected = (group, ids) => state[group].filter((item) => ids.includes(item.id) && !item.private && item.domain !== 'mind')
        const base = state.snapshots.find((item) => item.id === body.basedOnSnapshotId)
        const snapshot = { id: uuid(sequence++), subjectId: uuid(1), title: body.title, sourceRevision: state.revision, createdAt: new Date().toISOString(), status: 'active', revision: 1, versionNumber: base ? (base.versionNumber || 1) + 1 : 1, previousSnapshotId: base?.id || null, privacy: { privateMindExcluded: true, candidateClaimsExcluded: true }, records: { documents: selected('documents', body.documentIds), observations: selected('observations', body.observationIds), treatmentEvents: selected('treatmentEvents', body.treatmentEventIds), clinicalRecords: selected('clinicalRecords', body.clinicalRecordIds || []), supportEntries: selected('supportEntries', body.supportEntryIds), questions: selected('questions', body.questionIds) } }
        state.snapshots.unshift(snapshot); state.revision++
        return { ok: true, status: 200, json: async () => ({ revision: state.revision, result: snapshot }) }
      }
      if (body.type === 'delete-record' && body.group === 'snapshots') { const row = state.snapshots.find((item) => item.id === body.id); row.status = 'archived'; row.revision++; state.revision++; return { ok: true, status: 200, json: async () => ({ revision: state.revision, result: { archived: true } }) } }
      if (body.type === 'restore-brief') { const row = state.snapshots.find((item) => item.id === body.id); row.status = 'active'; row.revision++; state.revision++; return { ok: true, status: 200, json: async () => ({ revision: state.revision, result: row }) } }
      return { ok: false, status: 400, json: async () => ({ message: 'unsupported test command' }) }
    }
    throw new Error(`Unexpected fetch: ${url}`)
  }

  let registeredPanel
  let registrationDescriptor
  let clientModule
  Object.defineProperty(dom.window.navigator, 'clipboard', { configurable: true, value: { async writeText(value) { dom.window.__copiedText = value } } })
  dom.window.__ModuleLoader__ = { load(descriptor) { clientModule = descriptor.factory((name) => { if (name === 'react') return React; throw new Error(`Unexpected module ${name}`) }); clientModule?.apply({ effect(run) { run() }, uiWorkspace: { async pickDirectory() { directoryPickerCalls++; return directoryPickerCalls === 1 ? '/tmp/new-patient-folder' : '/tmp/dsh-workbench-session' } }, sessions: { list: { getSnapshot() { return { byId: {} } } }, scope() { return { get(key) { return key === 'conversation' ? { input: { for() { return { state: { getSnapshot() { return nativeInputSnapshot } }, setDraft(value) { nativeSessionDraft = value }, submit() { nativeSubmitCalls++; nativeInputSnapshot = { draft: '', phase: 'plain', occurrences: [] } } } } } } : null } } } }, desktopWorkbenches: { register(descriptor, Panel) { registrationDescriptor = descriptor; registeredPanel = Panel; return () => {} }, isActive() { return true }, currentSession() { return nativeCurrentSession }, ownsSession(id) { if (ownershipUnavailable) throw new Error('mock service caller context unavailable'); return id === 'owned-session' && nativeCurrentSession === id }, async ensureSession({ folder }) { nativeSessionFolder = folder; nativeCurrentSession = 'owned-session'; return 'owned-session' } } }) } }
  const source = await readFile(clientSourcePath, 'utf8')
  vm.runInNewContext(source, { window: dom.window, document: dom.window.document, navigator: dom.window.navigator, URL: dom.window.URL, URLSearchParams: dom.window.URLSearchParams, Blob, FileReader: FixtureFileReader, FormData: dom.window.FormData, TextEncoder, setTimeout, clearTimeout, fetch: dom.window.fetch, AbortController, console, globalThis: dom.window })
  assert.equal(typeof registeredPanel, 'function')
  assert.equal(registrationDescriptor.layout, undefined, 'patient-first full workbench uses on-demand native conversation')
  assert.equal(registrationDescriptor.customFrame, true)
  assert.ok(clientModule.inject.includes('sessions') && clientModule.inject.includes('conversation'), 'DSH native conversation services are explicitly injected')
  const root = createRoot(dom.window.document.getElementById('root'))
  await act(async () => { root.render(React.createElement(registeredPanel, { conversation: React.createElement('div', null, 'mock DSH 原生对话') })); await new Promise((resolve) => setTimeout(resolve, 10)) })
  const clickText = async (text) => {
    const button = [...dom.window.document.querySelectorAll('button')].find((item) => item.textContent.trim().includes(text))
    assert.ok(button, `button not found: ${text}`)
    await act(async () => { button.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); await new Promise((resolve) => setTimeout(resolve, 10)) })
  }

  assert.match(dom.window.document.body.textContent, /测试资料/)
  const packageVersion = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')).version
  assert.ok(dom.window.document.body.textContent.includes(`v${packageVersion}`), `workbench header reflects package version ${packageVersion}`)
  await clickText('病情整理')
  const importInput = dom.window.document.querySelector('input[type="file"][multiple]')
  const batchFiles = [
    { name: '血液指标.txt', type: 'text/plain', size: 10 },
    { name: 'read-error.txt', type: 'text/plain', size: 10 },
    { name: 'api-error.txt', type: 'text/plain', size: 10 },
    { name: '超大影像.pdf', type: 'application/pdf', size: 20 * 1024 * 1024 + 1 },
    { name: '治疗记录.txt', type: 'text/plain', size: 10 },
  ]
  Object.defineProperty(importInput, 'files', { configurable: true, value: batchFiles })
  await act(async () => { importInput.dispatchEvent(new dom.window.Event('change', { bubbles: true })); await new Promise((resolve) => setTimeout(resolve, 180)) })
  assert.equal(state.documents.filter((item) => ['血液指标.txt', '治疗记录.txt'].includes(item.name)).length, 2, 'successful files before and after failures are retained')
  assert.match(dom.window.document.body.textContent, /批量导入完成：成功 2 份，失败 3 份/, 'batch import reports consolidated success and failure counts')
  for (const name of ['read-error.txt', 'api-error.txt', '超大影像.pdf']) assert.ok(dom.window.document.body.textContent.includes(name), `batch summary names the failed file: ${name}`)
  assert.deepEqual(callLog.filter((item) => item.type === 'import-document').map((item) => item.name), ['血液指标.txt', 'api-error.txt', '治疗记录.txt'], 'oversize files are skipped while later eligible files continue')
  await clickText('⚙ 设置')
  assert.match(dom.window.document.body.textContent, new RegExp(`v${packageVersion} · 本机开发预览`), 'settings page version follows the installed package')
  assert.match(dom.window.document.body.textContent, /社区共享凭据可用/)
  assert.match(dom.window.document.body.textContent, /官方指南发放\/解读活动已核实/)
  assert.match(dom.window.document.body.textContent, /每份报告单独确认/)
  assert.match(dom.window.document.body.textContent, /官方活动信息日期（非指南出版日期）：2026-03-12/)
  assert.match(dom.window.document.body.textContent, /备份包含工作台记录、已导入报告原件和转录文件/)
  assert.ok([...dom.window.document.querySelectorAll('button')].some((item) => item.textContent === '创建本机备份'))
  assert.ok([...dom.window.document.querySelectorAll('button')].some((item) => item.textContent === '从备份恢复到新目录'))
  await clickText('选择或更换资料目录')
  assert.equal(selectedDirectoryRequest?.path, '/tmp/new-patient-folder')
  assert.equal(selectedDirectoryRequest?.confirmLeaveOldRoot, true)
  await clickText('关闭')
  await clickText('病情一图秀')
  assert.match(dom.window.document.body.textContent, /全部指标 · 点击卡片可翻转/)
  assert.ok(dom.window.document.querySelectorAll('.owb-flip').length >= 2, 'all recorded metric cards remain browsable independently of the 3-series chart selection')
  const timelineZoom = dom.window.document.querySelector('input[aria-label="调整一图秀时间轴缩放"]')
  assert.ok(timelineZoom, 'one-page trend view exposes a zoom slider like the confirmed prototype')
  const dotsBeforeZoom = dom.window.document.querySelectorAll('.owb-chart .dot').length
  await act(async () => { timelineZoom.value = '25'; timelineZoom.dispatchEvent(new dom.window.Event('input', { bubbles: true })); timelineZoom.dispatchEvent(new dom.window.Event('change', { bubbles: true })); await new Promise((resolve) => setTimeout(resolve, 10)) })
  assert.ok(dom.window.document.querySelectorAll('.owb-chart .dot').length <= dotsBeforeZoom, 'zoom narrows the shared date window and re-renders the actual chart')
  const observationDot = dom.window.document.querySelector('.owb-chart .dot')
  assert.ok(observationDot)
  await act(async () => { observationDot.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); await new Promise((resolve) => setTimeout(resolve, 10)) })
  assert.match(dom.window.document.body.textContent, /患者接受转录；不代表临床审核或医学验证/)
  assert.match(dom.window.document.body.textContent, /病理报告.pdf/)
  await clickText('关闭')
  await clickText('病情整理')
  await clickText('查看来源：病理报告.pdf')
  assert.match(dom.window.document.body.textContent, /同意发送到 MinerU 云端处理/)
  const parseButton = [...dom.window.document.querySelectorAll('button')].find((item) => item.textContent === '生成转录草稿')
  assert.ok(parseButton.disabled)
  const consent = dom.window.document.querySelector('.owb-checkrow input[type="checkbox"]')
  await act(async () => { consent.click(); await new Promise((resolve) => setTimeout(resolve, 5)) })
  await clickText('生成转录草稿')
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)) })
  assert.match(dom.window.document.body.textContent, /机器转录草稿已保存/)
  assert.match(dom.window.document.body.textContent, /CA125: 35 U\/mL/)
  assert.match(dom.window.document.body.textContent, /HE4 · 48 pmol\/L/)
  assert.match(dom.window.document.body.textContent, /CA19-9 · 16 U\/mL/)
  assert.match(dom.window.document.body.textContent, /CEA · 2.1 ng\/mL/)
  assert.match(dom.window.document.body.textContent, /CA72-4 · 3.2 U\/mL/)
  assert.match(dom.window.document.body.textContent, /谷丙转氨酶 · 30 U\/L/)
  assert.match(dom.window.document.body.textContent, /钾 · 4.0 mmol\/L/)
  assert.match(dom.window.document.body.textContent, /低于参考值（0-35）/)
  const extractedCandidateButton = [...dom.window.document.querySelectorAll('button')].find((item) => item.textContent === '加入待核候选')
  assert.ok(extractedCandidateButton, 'explicit CA125 result should be offered as a candidate')
  assert.equal([...dom.window.document.querySelectorAll('button')].filter((item) => item.textContent === '加入待核候选').length, 15, 'named ovarian markers, common CBC/chemistry units, compact rows, and clearly formatted unlisted results may be suggested for review')
  assert.match(dom.window.document.body.textContent, /镁 · 0\.78 mmol\/L/)
  assert.match(dom.window.document.body.textContent, /血小板 · 180 ×10⁹\/L/)
  assert.match(dom.window.document.body.textContent, /平均红细胞体积 · 88 fL/)
  assert.match(dom.window.document.body.textContent, /C反应蛋白 · <5 mg\/L/)
  assert.match(dom.window.document.body.textContent, /CA125 · 62 U\/mL/)
  assert.match(dom.window.document.body.textContent, /血红蛋白 · 108 g\/L/)
  assert.match(dom.window.document.body.textContent, /未知指标 · 2\.5 mmol\/L/)
  assert.match(dom.window.document.body.textContent, /未归类 · 请确认项目含义/)
  assert.equal(state.observations.some((item) => item.metric === '镁'), false, 'an unlisted result remains a candidate and is never silently promoted to the formal trend')
  assert.equal(state.claims.length, 1, 'machine extraction must not add a claim automatically')
  await act(async () => { extractedCandidateButton.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); await new Promise((resolve) => setTimeout(resolve, 20)) })
  const extractedClaim = state.claims.find((item) => item.label === 'CA125' && item.value === '35')
  assert.equal(extractedClaim?.unit, 'U/mL')
  assert.match(extractedClaim?.locator || '', /机器转录第2行/)
  const datedTableCandidate = [...dom.window.document.querySelectorAll('button')].find((item) => item.textContent === '加入待核候选' && item.parentElement?.textContent.includes('CA125 · 62 U/mL'))
  await act(async () => { datedTableCandidate.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); await new Promise((resolve) => setTimeout(resolve, 20)) })
  const datedTableClaim = state.claims.find((item) => item.label === 'CA125' && item.value === '62')
  assert.equal(datedTableClaim?.date, '2026-10-18', 'Chinese report date in the same table row is normalized for the review candidate')
  await clickText('关闭')
  await clickText('病情一图秀')
  await clickText('手术沟通')
  assert.match(dom.window.document.body.textContent, /仅按本人记录回顾，不推断疗效/)
  await clickText('关闭')
  const metricCards = dom.window.document.querySelectorAll('.owb-flip')
  assert.equal(metricCards.length, 2)
  await act(async () => { metricCards[0].dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })) })
  assert.equal(metricCards[0].getAttribute('aria-pressed'), 'true')
  assert.equal(metricCards[1].getAttribute('aria-pressed'), 'false')
  const workbenchStyles = dom.window.document.querySelector('style').textContent
  assert.match(workbenchStyles, /@media\(prefers-reduced-motion:reduce\)/, 'metric-card animation honors the operating system reduced-motion preference')
  assert.match(workbenchStyles, /\.owb-flip-inner\{transform:none!important\}\.owb-face\{display:none\}/, 'reduced-motion mode switches the flip card to one visible static face')
  assert.match(workbenchStyles, /@container\(max-width:760px\)[\s\S]*?\.owb-flip\{height:176px\}/, 'metric cards retain their compact layout at narrow workbench widths')
  assert.match(workbenchStyles, /@container\(max-width:620px\)[\s\S]*?\.owb-top\{[^}]*flex-direction:column[^}]*\}[\s\S]*?\.owb-top>\.owb-actions button\{min-height:32px/, 'narrow workbench header gives its three actions a dedicated second row')
  assert.match(workbenchStyles, /@container\(max-width:760px\)\{\.owb-top\{[^}]*flex-direction:column[^}]*\}[\s\S]*?\.owb-top>\.owb-actions button\{min-height:32px/, 'mid-width workbench stacks its header controls before navigation collapses')

  await clickText('临床')
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 250)) })
  assert.ok([...dom.window.document.querySelectorAll('[role="tab"]')].some((item) => item.textContent === '试验检索'), 'clinical page exposes the v3 secondary task navigation')
  await clickText('数据来源')
  assert.match(dom.window.document.body.textContent, /指南与患者资料 · 看来源，再准备问题/)
  assert.match(dom.window.document.body.textContent, /官方指南发放\/解读活动已核实 · 正文和推荐未核验/)
  assert.match(dom.window.document.body.textContent, /患者教育资料 · 美国来源/)
  assert.match(dom.window.document.body.textContent, /NCI患者资料：卵巢上皮性癌、输卵管癌及原发性腹膜癌治疗（英文）/)
  const nhcSourceRow = [...dom.window.document.querySelectorAll('.owb-row')].find((row) => row.textContent.includes('卵巢癌诊疗指南（2022年版）'))
  assert.ok(nhcSourceRow?.querySelector('details summary'), 'the official 2022 NHC source exposes a collapsed original-PDF chapter map')
  assert.match(nhcSourceRow.textContent, /仅目录，不含治疗建议/)
  await act(async () => { nhcSourceRow.querySelector('details summary').click() })
  assert.match(nhcSourceRow.textContent, /治疗：手术治疗 · PDF第20页/)
  assert.match(nhcSourceRow.textContent, /治疗：化疗 · PDF第25页/)
  assert.match(nhcSourceRow.textContent, /治疗：靶向治疗 · PDF第30页/)
  assert.match(nhcSourceRow.textContent, /治疗：免疫治疗、放疗 · PDF第32页/)
  const guidanceRow = [...dom.window.document.querySelectorAll('.owb-row')].find((row) => row.textContent.includes('CSCO妇科肿瘤指南'))
  await act(async () => { guidanceRow.querySelector('button[title="把来源范围和需要专业团队核对的内容存入复诊问题"]').click(); await new Promise((resolve) => setTimeout(resolve, 30)) })
  const guidanceQuestion = callLog.filter((item) => item.type === 'add-question').at(-1)
  assert.match(guidanceQuestion.text, /未取得可逐条核对的正文|正文和推荐未核验/)
  assert.match(guidanceQuestion.text, /oid=9268/)
  await clickText('治疗历程')
  const topicScenarios = [
    ['手术评估 / 术后报告', /手术的目标和预计范围/],
    ['化疗周期', /治疗安排和我手头的医嘱/],
    ['维持 / 靶向治疗', /病理、分子结果和既往治疗/],
    ['复发后讨论', /本次影像和既往报告的比较依据/],
    ['放疗被提及时', /放疗的具体目的和照射部位/],
  ]
  for (const [topic, patientQuestion] of topicScenarios) {
    const scenarioButton = [...dom.window.document.querySelectorAll('.owb-task')].find((item) => item.textContent.includes(topic))
    assert.ok(scenarioButton, `patient workbench should offer the ${topic} conversation scenario`)
    await act(async () => { scenarioButton.click(); await new Promise((resolve) => setTimeout(resolve, 5)) })
    const scenarioDialog = dom.window.document.querySelector('[role="dialog"]')
    assert.ok(scenarioDialog)
    assert.match(scenarioDialog.textContent, patientQuestion)
    assert.match(scenarioDialog.textContent, /这是患者沟通准备问题/)
    assert.match(scenarioDialog.textContent, /不判断手术可行性、复发或药物适用/)
    await clickText('把这个问题保留到复诊')
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 15)) })
    assert.match(callLog.filter((item) => item.type === 'add-question').at(-1).text, /讨论依据、目标/)
  }
  await clickText('临床档案')
  const clinicalForm = dom.window.document.querySelector('input[name="field"]').closest('form')
  clinicalForm.querySelector('select[name="category"]').value = 'diagnosis'
  clinicalForm.querySelector('input[name="field"]').value = '原发部位（报告原文）'
  clinicalForm.querySelector('select[name="status"]').value = 'recorded'
  clinicalForm.querySelector('textarea[name="value"]').value = '原发性腹膜'
  await act(async () => { clinicalForm.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })); await new Promise((resolve) => setTimeout(resolve, 40)) })
  assert.equal(state.clinicalRecords[0].value, '原发性腹膜')
  assert.match(dom.window.document.body.textContent, /原发性腹膜癌保留各自名称/)
  await clickText('试验检索')
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 260)) })
  assert.match(dom.window.document.body.textContent, /Ovarian Cancer Trial Fixture/)
  await clickText('收藏快照')
  assert.ok(callLog.some((item) => item.type === 'save-bookmark' && item.trialSnapshot.registryId === 'NCT-test'))

  await clickText('收藏与回顾')
  await clickText('已保留结果')
  assert.match(dom.window.document.body.textContent, /收藏时更新/)
  await clickText('复诊摘要与导出')
  const ca125Label = [...dom.window.document.querySelectorAll('label')].find((label) => label.textContent.includes('CA125 35'))
  assert.ok(ca125Label)
  const checkbox = ca125Label.querySelector('input[type="checkbox"]')
  await act(async () => { checkbox.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); await new Promise((resolve) => setTimeout(resolve, 5)) })
  await clickText('保存摘要 (1项)')
  assert.equal(state.snapshots.length, 1)
  assert.equal(state.snapshots[0].records.observations.length, 1)
  assert.ok(!JSON.stringify(state.snapshots[0]).includes('不应进入摘要'))
  assert.match(dom.window.document.body.textContent, /来源修订/)
  await clickText('Markdown')
  await clickText('HTML')
  await clickText('DOCX')
  await clickText('JPEG')
  await clickText('PDF')
  assert.deepEqual(downloads.map((item) => item.file.split('.').at(-1)), ['md', 'html', 'docx', 'jpg', 'pdf'])
  assert.equal(downloads[0].blob.type, 'text/markdown;charset=utf-8')
  assert.match(await downloads[0].blob.text(), /CA125：35/)
  assert.doesNotMatch(await downloads[0].blob.text(), /不应进入摘要/)
  assert.equal(downloads[2].blob.type, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
  const docx = Buffer.from(await downloads[2].blob.arrayBuffer())
  assert.equal(docx.subarray(0, 2).toString('ascii'), 'PK')
  const docxEntries = new Map(); let zipOffset = 0
  while (docx.readUInt32LE(zipOffset) === 0x04034b50) { const size = docx.readUInt32LE(zipOffset + 18); const nameLength = docx.readUInt16LE(zipOffset + 26); const extraLength = docx.readUInt16LE(zipOffset + 28); const name = docx.subarray(zipOffset + 30, zipOffset + 30 + nameLength).toString('utf8'); const start = zipOffset + 30 + nameLength + extraLength; docxEntries.set(name, docx.subarray(start, start + size).toString('utf8')); zipOffset = start + size }
  assert.match(docxEntries.get('word/document.xml'), /CA125/)
  assert.deepEqual([...Buffer.from(await downloads[3].blob.arrayBuffer()).subarray(0, 2)], [0xff, 0xd8])
  const pdfBytes = Buffer.from(await downloads[4].blob.arrayBuffer())
  assert.match(pdfBytes.subarray(0, 8).toString('ascii'), /^%PDF-1\.4/)
  assert.match(pdfBytes.subarray(-80).toString('ascii'), /startxref[\s\S]*%%EOF/)
  await clickText('以此摘要修改')
  assert.match(dom.window.document.body.textContent, /保存新版本/)
  await clickText('保存新版本')
  assert.equal(state.snapshots.length, 2)
  assert.equal(state.snapshots[0].versionNumber, 2)
  assert.equal(state.snapshots[0].previousSnapshotId, state.snapshots[1].id)
  await clickText('移入回收站')
  assert.equal(state.snapshots[0].status, 'archived')
  assert.match(dom.window.document.body.textContent, /回收站 · 可恢复的摘要/)
  await clickText('恢复摘要')
  assert.equal(state.snapshots[0].status, 'active')
  await clickText('收藏与回顾')
  await clickText('已保留结果')
  const metricChoice = [...dom.window.document.querySelectorAll('label.owb-row')].find((item) => item.textContent.includes('CA125 28'))?.querySelector('input[type="checkbox"]')
  assert.ok(metricChoice, 'patient must be able to choose a personal metric record')
  await act(async () => { metricChoice.click(); await new Promise((resolve) => setTimeout(resolve, 5)) })
  const questionInput = dom.window.document.querySelector('textarea[placeholder^="例如：这些已记录"]')
  assert.ok(questionInput)
  await act(async () => { Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype, 'value').set.call(questionInput, '这项指标和我的治疗日期，我可以问团队什么？'); questionInput.dispatchEvent(new dom.window.InputEvent('input', { bubbles: true, inputType: 'insertText', data: '这项指标和我的治疗日期，我可以问团队什么？' })); await new Promise((resolve) => setTimeout(resolve, 5)) })
  await clickText('在本地生成解释草稿')
  const agentDraftPreview = dom.window.document.querySelector('pre[aria-label="AI解释请求草稿"]')
  assert.ok(agentDraftPreview, 'question should be converted into a local-only draft preview')
  assert.match(agentDraftPreview.textContent, /这项指标和我的治疗日期/)
  assert.match(agentDraftPreview.textContent, /CA125/)
  assert.match(agentDraftPreview.textContent, new RegExp(uuid(5)), 'agent draft should retain the selected record reference')
  assert.doesNotMatch(agentDraftPreview.textContent, /不应进入摘要/)
  const shareConsent = [...dom.window.document.querySelectorAll('.owb-checkrow input[type="checkbox"]')].at(-1)
  const placeDraftButton = [...dom.window.document.querySelectorAll('button')].find((item) => item.textContent.includes('一键发送到 DSH Agent'))
  const copyDraftButton = [...dom.window.document.querySelectorAll('button')].find((item) => item.textContent.includes('复制内容到对话框'))
  assert.ok(placeDraftButton?.disabled, 'placing personal records into a native session requires explicit consent')
  assert.ok(copyDraftButton?.disabled, 'copying personal records to the system clipboard also requires explicit consent')
  await act(async () => { shareConsent.click(); await new Promise((resolve) => setTimeout(resolve, 5)) })
  await clickText('一键发送到 DSH Agent')
  assert.equal(nativeSessionFolder, '/tmp/dsh-workbench-session')
  assert.match(nativeSessionDraft, /这项指标和我的治疗日期/)
  assert.match(nativeSessionDraft, /引用可核对的指南\/权威来源/)
  assert.equal(nativeSubmitCalls, 1, 'explicit user click submits the draft through the native DSH input action')
  assert.match(dom.window.document.body.textContent, /DSH 原生 AI 对话/)
  assert.match(dom.window.document.body.textContent, /mock DSH 原生对话/)
  const pickerCallsBeforeOwnershipFailure = directoryPickerCalls
  ownershipUnavailable = true
  await clickText('隐藏 AI 对话')
  await clickText('打开 AI 对话')
  assert.match(dom.window.document.body.textContent, /暂时无法确认此会话是否归属小巢宝工作台/)
  assert.equal(directoryPickerCalls, pickerCallsBeforeOwnershipFailure, 'unavailable ownership must fail closed without opening the picker or creating another session')
  assert.equal(nativeSubmitCalls, 1, 'unavailable ownership must not send any native draft')
  ownershipUnavailable = false
  await clickText('打开 AI 对话')
  assert.match(dom.window.document.body.textContent, /mock DSH 原生对话/, 'retry with available ownership restores the same conversation')
  assert.equal(dom.window.document.querySelector('.owb-native-conversation').style.flexBasis, '35%', 'default agent width leaves enough room for the workbench navigation at desktop widths')
  assert.match(dom.window.document.querySelector('style').textContent, /\.owb-frame\{[^}]*flex-direction:row-reverse/, 'the DSH native conversation is laid out to the right of the centered workbench')
  const conversationSplitter = dom.window.document.querySelector('[role="separator"][aria-label="调整 AI 对话区域宽度"]')
  assert.ok(conversationSplitter, 'on-demand native conversation includes an adjustable splitter')
  assert.match(conversationSplitter.title, /拖动调整 AI 对话宽度/)
  assert.equal(dom.window.document.querySelector('.owb-native-tools'), null, 'native conversation no longer duplicates width controls in its header')
  assert.equal(dom.window.document.querySelector('.owb-top .owb-agent-controls'), null, 'workbench top bar no longer duplicates width controls')
  assert.ok(dom.window.document.querySelector('button[aria-label="隐藏 DSH AI 对话"]'), 'native conversation exposes a dedicated hide button')
  assert.equal(dom.window.document.querySelector('button[aria-label="隐藏 DSH AI 对话"]').textContent, '隐藏 ×', 'hide action is a plainly labeled control in the conversation header')
  assert.match(dom.window.document.querySelector('style').textContent, /\.owb-native-toolbar-head\{min-height:28px;display:flex/, 'title and hide action share a dedicated toolbar row')
  assert.doesNotMatch(dom.window.document.querySelector('style').textContent, /\.owb-native-toolbar \.owb-native-hide\{position:absolute/, 'hide action stays in normal layout flow' )
  assert.match(dom.window.document.querySelector('style').textContent, /\.owb-splitter\{position:relative;z-index:22;flex:0 0 20px/, 'resize handle has a wider pointer target')
  const workbenchFrame = dom.window.document.querySelector('.owb-frame')
  workbenchFrame.getBoundingClientRect = () => ({ left: 100, right: 1100, width: 1000, top: 0, bottom: 700, height: 700 })
  const pointer = (type, clientX) => { const event = new dom.window.Event(type, { bubbles: true }); Object.defineProperties(event, { clientX: { value: clientX }, pointerId: { value: 1 } }); return event }
  await act(async () => { conversationSplitter.dispatchEvent(pointer('pointerdown', 500)); conversationSplitter.dispatchEvent(pointer('pointermove', 620)); conversationSplitter.dispatchEvent(pointer('pointerup', 620)); await new Promise((resolve) => setTimeout(resolve, 5)) })
  assert.equal(dom.window.document.querySelector('.owb-native-conversation').style.flexBasis, '45%', 'pointer dragging adjusts the right-side conversation and respects its maximum width')
  assert.match(dom.window.document.querySelector('style').textContent, /@container\(max-width:760px\)\{\.owb-native-conversation\{min-width:0\}/, 'compact workbench keeps the conversation panel in the resizable layout')
  assert.doesNotMatch(dom.window.document.querySelector('style').textContent, /\.owb-splitter\{display:none\}/, 'compact workbench must not hide the resize handle')
  assert.equal(dom.window.document.querySelector('.owb-top .owb-btn.primary').textContent, '隐藏 AI 对话 ×', 'workbench header exposes an explicit hide button while the conversation is open')
  assert.equal(dom.window.document.querySelector('.owb-top button[aria-label="缩窄 AI 对话栏"]'), null)
  assert.equal(dom.window.document.querySelector('.owb-top button[aria-label="加宽 AI 对话栏"]'), null)
  await act(async () => { conversationSplitter.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })); await new Promise((resolve) => setTimeout(resolve, 5)) })
  assert.equal(dom.window.document.querySelector('[role="separator"]').getAttribute('aria-valuenow'), '43', 'splitter supports keyboard width adjustment after pointer dragging')
  await clickText('隐藏 AI 对话')
  assert.equal(dom.window.document.querySelector('.owb-native-conversation'), null, 'native conversation can be hidden without leaving the workbench')
  await clickText('打开 AI 对话')
  assert.ok(dom.window.document.querySelector('.owb-native-conversation'), 'owned native session can be reopened on demand')
  nativeInputSnapshot = { draft: '我自己写的一段原生草稿', phase: 'plain', occurrences: [] }
  const existingDraftBefore = nativeSessionDraft
  await clickText('一键发送到 DSH Agent')
  assert.equal(nativeSessionDraft, existingDraftBefore, 'a user-written native draft is never overwritten or merged into a one-click send')
  nativeInputSnapshot = { draft: '含附件的原生草稿', phase: 'plain', occurrences: [{ kind: 'file' }] }
  await clickText('一键发送到 DSH Agent')
  assert.equal(nativeSessionDraft, existingDraftBefore, 'a draft with native attachment references must not be overwritten')
  assert.match(dom.window.document.body.textContent, /已有草稿、图片\/附件引用或正在提交/)
  nativeInputSnapshot = { draft: '', phase: 'plain', occurrences: [], imageIds: ['draft-image-1'] }
  await clickText('一键发送到 DSH Agent')
  assert.equal(nativeSubmitCalls, 1, 'one-click send refuses to submit a draft image that the user has not reviewed')
  assert.match(dom.window.document.body.textContent, /图片\/附件引用/)
  nativeInputSnapshot = { draft: '', phase: 'plain', occurrences: [] }
  await clickText('复制内容到对话框')
  assert.match(dom.window.__copiedText, /这项指标和我的治疗日期/)
  await clickText('营养支持')
  await clickText('进食与体重')
  const weightInput = dom.window.document.querySelector('input[name="weight"]')
  Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set.call(weightInput, '52.4')
  weightInput.dispatchEvent(new dom.window.InputEvent('input', { bubbles: true, inputType: 'insertText', data: '52.4' }))
  const nutritionForm = weightInput.closest('form')
  await act(async () => { nutritionForm.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })); await new Promise((resolve) => setTimeout(resolve, 20)) })
  const nutritionCall = callLog.find((item) => item.type === 'add-support-entry' && item.domain === 'nutrition')
  assert.equal(nutritionCall.nutrition.weightKg, '52.4')
  assert.equal(nutritionCall.nutrition.appetite, '暂不记录')
  assert.equal(state.observations.some((item) => item.metric === '体重' && item.supportEntryId), true, 'structured patient-entered weight should flow into the shared indicator timeline')
  await clickText('编辑营养记录')
  const nutritionEditForm = [...dom.window.document.querySelectorAll('form')].find((form) => form.querySelector('input[name="weightKg"]'))
  assert.ok(nutritionEditForm, 'structured nutrition entry can be edited')
  nutritionEditForm.querySelector('input[name="weightKg"]').value = '50.8'
  nutritionEditForm.querySelector('input[name="date"]').value = '2026-10-16'
  nutritionEditForm.querySelector('textarea[name="text"]').value = '胃口少；体重已更正为50.8 kg'
  await act(async () => { nutritionEditForm.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })); await new Promise((resolve) => setTimeout(resolve, 20)) })
  const nutritionEditCall = callLog.find((item) => item.type === 'edit-support-entry' && item.nutrition)
  assert.equal(nutritionEditCall.recordRevision, 1)
  assert.equal(nutritionEditCall.nutrition.weightKg, '50.8')
  const nutritionRecord = state.supportEntries.find((item) => item.domain === 'nutrition' && item.nutrition)
  const editedWeight = state.observations.find((item) => item.supportEntryId === nutritionRecord.id)
  assert.equal(editedWeight.value, '50.8')
  assert.equal(editedWeight.date, '2026-10-16')
  assert.equal(editedWeight.previousVersions[0].value, '52.4')
  await clickText('全程管理')
  assert.match(dom.window.document.body.textContent, /不会根据腹胀、体重或穿刺记录推断腹水、复发或营养状况/)
  const symptomForm = [...dom.window.document.querySelectorAll('form')].find((form) => form.querySelector('[name="changeType"]'))
  assert.ok(symptomForm)
  const ostomyFields = symptomForm.querySelector('[data-ostomy-fields]')
  assert.equal(ostomyFields.hidden, true, 'ostomy-specific fields stay hidden until the person says an ostomy is present')
  symptomForm.querySelector('[name="ostomyPresent"]').value = 'yes'
  symptomForm.querySelector('[name="ostomyPresent"]').dispatchEvent(new dom.window.Event('change', { bubbles: true }))
  assert.equal(ostomyFields.hidden, false, 'ostomy fields appear only after the patient selects yes')
  symptomForm.querySelector('[name="ostomyType"]').value = 'ileostomy'
  symptomForm.querySelector('[name="ostomyConcern"]').value = 'leakage'
  symptomForm.querySelector('[name="bowelChange"]').value = 'urgency'
  symptomForm.querySelector('[name="dailyImpact"]').value = 'outing'
  symptomForm.querySelector('[name="changeType"]').value = '腹胀 / 早饱'
  symptomForm.querySelector('[name="details"]').value = '进食时容易早饱，患者自述'
  symptomForm.querySelector('[name="sourceId"]').value = uuid(2)
  assert.equal(symptomForm.querySelector('[name="sharingScope"]').value, 'selectable', 'each symptom defaults to per-action explicit selection, not automatic sharing')
  await act(async () => { symptomForm.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })); await new Promise((resolve) => setTimeout(resolve, 20)) })
  const symptomCall = callLog.find((item) => item.type === 'add-support-entry' && item.domain === 'symptom')
  assert.equal(symptomCall.text, '腹胀 / 早饱：进食时容易早饱，患者自述；便意急迫；回肠造口（本人确认）；本人记录造口渗漏困扰；影响外出')
  assert.deepEqual(symptomCall.symptomDetails, { bowelChange: 'urgency', ostomyPresent: 'yes', ostomyType: 'ileostomy', ostomyConcern: 'leakage', dailyImpact: 'outing' })
  assert.equal(symptomCall.sourceId, uuid(2))
  assert.equal(state.supportEntries.some((item) => item.domain === 'symptom' && item.sourceId === uuid(2)), true)
  assert.equal(state.supportEntries.find((item) => item.domain === 'symptom').symptomDetails.ostomyPresent, 'yes')
  const ostomyQuestionButton = dom.window.document.querySelector('button[title="保存为复诊问题"]')
  assert.ok(ostomyQuestionButton)
  await act(async () => { ostomyQuestionButton.click(); await new Promise((resolve) => setTimeout(resolve, 30)) })
  const ostomyQuestion = callLog.filter((item) => item.type === 'add-question').at(-1)
  assert.match(ostomyQuestion.text, /医生或造口治疗师/)
  assert.deepEqual(ostomyQuestion.refs, [uuid(2)], 'the ostomy discussion question retains the linked care source')
  await clickText('编辑')
  const symptomEditForm = [...dom.window.document.querySelectorAll('form')].find((form) => form.querySelector('textarea[name="text"]'))
  assert.ok(symptomEditForm, 'saved body-change entry should be editable')
  symptomEditForm.querySelector('textarea[name="text"]').value = '腹胀 / 早饱：更正后的患者自述'
  symptomEditForm.querySelector('[name="sharingScope"]').value = 'private'
  await act(async () => { symptomEditForm.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })); await new Promise((resolve) => setTimeout(resolve, 20)) })
  const symptomEntry = state.supportEntries.find((item) => item.domain === 'symptom')
  const symptomEditCall = callLog.find((item) => item.type === 'edit-support-entry' && item.id === symptomEntry.id)
  assert.equal(symptomEditCall.recordRevision, 1)
  assert.equal(symptomEditCall.text, '腹胀 / 早饱：更正后的患者自述')
  assert.equal(symptomEntry.text, symptomEditCall.text)
  assert.equal(symptomEditCall.sharingScope, 'private')
  assert.equal(symptomEntry.sharingScope, 'private', 'the body-change record can be restricted to personal review')
  assert.match(dom.window.document.body.textContent, /仅自己回顾/)
  await clickText('收藏与回顾')
  await clickText('复诊摘要与导出')
  assert.doesNotMatch(dom.window.document.body.textContent, /腹胀 \/ 早饱：更正后的患者自述/, 'private symptom records do not appear in summary selection')
  await clickText('已保留结果')
  assert.doesNotMatch(dom.window.document.body.textContent, /腹胀 \/ 早饱：更正后的患者自述/, 'private symptom records do not appear in agent context selection')
  const answerText = dom.window.document.querySelector('textarea[placeholder^="复制你已在 DSH 会话"]')
  assert.ok(answerText, 'users can manually keep an answer without claiming the app reads native conversation')
  const answerForm = answerText.closest('form')
  await act(async () => { Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype, 'value').set.call(answerText, '回答说可以讨论治疗选择。'); answerText.dispatchEvent(new dom.window.Event('input', { bubbles: true })); answerText.dispatchEvent(new dom.window.Event('change', { bubbles: true })); await new Promise((resolve) => setTimeout(resolve, 5)) })
  await act(async () => { answerForm.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })); await new Promise((resolve) => setTimeout(resolve, 20)) })
  assert.equal(state.agentResponses[0].text, '回答说可以讨论治疗选择。')
  assert.equal(state.agentResponses[0].privacy, 'private-workspace')
  assert.equal(state.agentResponses[0].status, 'unreviewed')
  assert.ok(state.agentResponses[0].sourceRefs.some((ref) => ref.id === uuid(5)))
  assert.equal(state.observations.length, 4, 'an AI answer is kept separately from patient metric records')
  await clickText('我已查看来源对应关系')
  assert.equal(state.agentResponses[0].status, 'user_checked_references')
  await act(async () => root.unmount())
})

test('newly diagnosed patient can read first, then create local records and retain one question in the same flow', async (t) => {
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://127.0.0.1:43130/', pretendToBeVisual: true, runScripts: 'outside-only' })
  t.after(() => dom.window.close())
  Object.defineProperty(globalThis, 'window', { configurable: true, value: dom.window })
  Object.defineProperty(globalThis, 'document', { configurable: true, value: dom.window.document })
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator })
  Object.defineProperty(globalThis, 'HTMLElement', { configurable: true, value: dom.window.HTMLElement })
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { configurable: true, value: true })

  const state = { schemaVersion: 2, revision: 0, subject: null, storage: { status: 'configured', kind: 'user-selected-directory', path: '/tmp/patient-records' }, documents: [], claims: [], reviewDecisions: [], clinicalRecords: [], observations: [], treatmentEvents: [], supportEntries: [], questions: [], tasks: [], bookmarks: [], snapshots: [], agentResponses: [] }
  dom.window.fetch = async (url, options = {}) => {
    if (String(url).endsWith('/state')) return { ok: true, status: 200, json: async () => structuredClone(state) }
    if (String(url).endsWith('/command')) {
      const body = JSON.parse(options.body)
      if (body.type === 'create-subject') {
        state.subject = { id: uuid(51), label: body.label || '我的资料' }
        if (body.initialQuestion) state.questions.unshift({ id: uuid(52), subjectId: state.subject.id, text: body.initialQuestion })
        state.revision++
        return { ok: true, status: 200, json: async () => ({ revision: state.revision, result: state.subject }) }
      }
      if (body.type === 'add-question') {
        const question = { id: uuid(52), subjectId: state.subject.id, text: body.text }
        state.questions.unshift(question)
        state.revision++
        return { ok: true, status: 200, json: async () => ({ revision: state.revision, result: question }) }
      }
    }
    throw new Error(`Unexpected request: ${url}`)
  }

  let Panel
  dom.window.__ModuleLoader__ = { load(descriptor) {
    const module = descriptor.factory((name) => name === 'react' ? React : (() => { throw new Error(`Unexpected module ${name}`) })())
    module.apply({ effect(run) { run() }, uiWorkspace: { async pickDirectory() { return '/tmp/patient-records' } }, sessions: {}, desktopWorkbenches: { register(_descriptor, component) { Panel = component; return () => {} }, isActive() { return true } } })
  } }
  const source = await readFile(clientSourcePath, 'utf8')
  vm.runInNewContext(source, { window: dom.window, document: dom.window.document, navigator: dom.window.navigator, URL: dom.window.URL, URLSearchParams: dom.window.URLSearchParams, Blob, FormData: dom.window.FormData, TextEncoder, setTimeout, clearTimeout, fetch: dom.window.fetch, AbortController, console, globalThis: dom.window })
  assert.equal(typeof Panel, 'function')
  const root = createRoot(dom.window.document.getElementById('root'))
  await act(async () => { root.render(React.createElement(Panel, { conversation: null })); await new Promise((resolve) => setTimeout(resolve, 10)) })
  assert.match(dom.window.document.body.textContent, /载入模拟档案 A/)
  assert.match(dom.window.document.body.textContent, /载入模拟档案 B/)
  assert.match(dom.window.document.body.textContent, /有病历时系统会拒绝载入/)
  const clickText = async (text) => {
    const button = [...dom.window.document.querySelectorAll('button')].find((item) => item.textContent.includes(text))
    assert.ok(button, `button not found: ${text}`)
    await act(async () => { button.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); await new Promise((resolve) => setTimeout(resolve, 5)) })
  }
  await clickText('先只读查看确诊后的第一步')
  assert.match(dom.window.document.body.textContent, /可以先阅读这些内容，不必建立资料/)
  assert.equal(state.subject, null, 'reading the first-step guidance does not create a patient record')
  await clickText('现在先暂停')
  assert.match(dom.window.document.body.textContent, /先从眼前最需要的一步开始/)
  assert.equal(state.subject, null, 'pausing keeps the workspace unconfigured and does not create a record')
  await clickText('先只读查看确诊后的第一步')
  const questionInput = dom.window.document.querySelector('textarea[name="firstQuestion"]')
  assert.ok(questionInput, 'first-step path offers an optional question before creating a local record')
  await act(async () => {
    Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype, 'value').set.call(questionInput, '确诊之后我接下来要做哪些事？')
    questionInput.dispatchEvent(new dom.window.InputEvent('input', { bubbles: true, inputType: 'insertText', data: '确诊之后我接下来要做哪些事？' }))
    questionInput.dispatchEvent(new dom.window.Event('change', { bubbles: true }))
    await new Promise((resolve) => setTimeout(resolve, 5))
  })
  assert.equal(questionInput.value, '确诊之后我接下来要做哪些事？', 'the optional question stays in the form before submission')
  const form = questionInput.closest('form')
  await act(async () => { form.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })); await new Promise((resolve) => setTimeout(resolve, 30)) })
  assert.equal(state.subject.label, '我的资料', 'the optional patient label can remain blank')
  assert.equal(state.questions[0]?.text, '确诊之后我接下来要做哪些事？', 'the question is saved immediately after record creation')
  assert.match(dom.window.document.body.textContent, /确诊之后我接下来要做哪些事？/)
  await act(async () => root.unmount())
})

test('demo loader selects an isolated folder and renders the synthetic profile across dashboard, one-page trends, and clinical history', async (t) => {
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://127.0.0.1:43131/', pretendToBeVisual: true, runScripts: 'outside-only' })
  t.after(() => dom.window.close())
  Object.defineProperty(globalThis, 'window', { configurable: true, value: dom.window })
  Object.defineProperty(globalThis, 'document', { configurable: true, value: dom.window.document })
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator })
  Object.defineProperty(globalThis, 'HTMLElement', { configurable: true, value: dom.window.HTMLElement })
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { configurable: true, value: true })
  let state = { schemaVersion: 2, revision: 1, subject: { id: uuid(991), label: '本机资料' }, storage: { status: 'configured', kind: 'user-selected-directory', path: '/tmp/current-empty-workspace' }, documents: [], claims: [], clinicalRecords: [], observations: [], treatmentEvents: [], supportEntries: [], questions: [], tasks: [], bookmarks: [], snapshots: [], agentResponses: [] }
  const fixture = JSON.parse(await readFile(new URL('../assets/demo-data/newly-diagnosed.json', import.meta.url), 'utf8'))
  dom.window.confirm = () => { throw new Error('direct demo loading should not open a confirmation dialog') }
  dom.window.fetch = async (input, options = {}) => {
    const url = new URL(String(input), dom.window.location.href)
    if (url.pathname.endsWith('/state')) return { ok: true, status: 200, json: async () => structuredClone(state) }
    if (url.pathname.endsWith('/settings/data-root')) { state.storage = { status: 'configured', kind: 'user-selected-directory', path: '/tmp/isolated-demo' }; return { ok: true, status: 200, json: async () => ({ status: 'configured' }) } }
    if (url.pathname.endsWith('/demo/load')) { state = { ...structuredClone(fixture.workspace), demoId: fixture.demoId, demoName: fixture.name, storage: { status: 'configured', kind: 'user-selected-directory', path: '/tmp/isolated-demo' } }; return { ok: true, status: 200, json: async () => ({ loaded: true, name: fixture.name }) } }
    if (url.pathname.endsWith('/settings')) return { ok: true, status: 200, json: async () => ({ parseMode: 'local', mineru: { configured: false }, guidance: { sources: [] } }) }
    if (url.pathname.endsWith('/trials')) return { ok: true, status: 200, json: async () => ({ total: 0, results: [], source: { registryCounts: {} } }) }
    throw new Error(`Unexpected request: ${url}`)
  }
  let Panel
  dom.window.__ModuleLoader__ = { load(descriptor) { const module = descriptor.factory((name) => name === 'react' ? React : (() => { throw new Error(`Unexpected module ${name}`) })()); module.apply({ effect(run) { run() }, uiWorkspace: { async pickDirectory() { throw new Error('an already selected workspace must load its demo directly without reopening the directory picker') } }, sessions: {}, desktopWorkbenches: { register(_descriptor, component) { Panel = component; return () => {} }, isActive() { return true } } }) } }
  const source = await readFile(clientSourcePath, 'utf8')
  vm.runInNewContext(source, { window: dom.window, document: dom.window.document, navigator: dom.window.navigator, URL: dom.window.URL, URLSearchParams: dom.window.URLSearchParams, Blob, FormData: dom.window.FormData, TextEncoder, setTimeout, clearTimeout, fetch: dom.window.fetch, AbortController, console, globalThis: dom.window })
  const root = createRoot(dom.window.document.getElementById('root'))
  await act(async () => { root.render(React.createElement(Panel, { conversation: null })); await new Promise((resolve) => setTimeout(resolve, 10)) })
  const clickText = async (text) => { const button = [...dom.window.document.querySelectorAll('button')].find((item) => item.textContent.includes(text)); assert.ok(button, `button not found: ${text}`); await act(async () => { button.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); await new Promise((resolve) => setTimeout(resolve, 15)) }) }
  assert.match(dom.window.document.body.textContent, /当前工作区没有模拟资料，所以一图秀暂时没有曲线/)
  assert.match(dom.window.document.body.textContent, /本机资料/)
  await clickText('载入新确诊示例')
  assert.equal(state.demoId, 'newly-diagnosed')
  assert.match(dom.window.document.body.textContent, /模拟资料 · 初次治疗与治疗沟通/)
  assert.match(dom.window.document.body.textContent, /模拟档案 A · 初次治疗/)
  await clickText('病情一图秀')
  assert.match(dom.window.document.body.textContent, /CA125/)
  assert.match(dom.window.document.body.textContent, /HE4/)
  assert.match(dom.window.document.body.textContent, /最近6次|6次记录/)
  const demoMetricDots = dom.window.document.querySelectorAll('.owb-chart .dot')
  assert.ok(demoMetricDots.length >= 20, 'synthetic accepted observations draw multiple dated metric points in the shared chart')
  assert.equal(dom.window.document.querySelectorAll('.owb-combined-chart').length, 1, 'all selected metrics share one date axis and plot')
  assert.ok(dom.window.document.querySelectorAll('.owb-combined-chart path.line').length >= 2, 'multiple comparable series render smooth colored curves together')
  assert.ok(dom.window.document.querySelectorAll('.owb-timeline-event').length >= 5, 'treatment and examination events align to the same date axis')
  assert.ok(dom.window.document.querySelectorAll('.owb-chart-legend [role="listitem"]').length >= 3, 'legend retains each metric unit and observed range')
  await clickText('重播趋势动画')
  assert.match(dom.window.document.body.textContent, /全部指标 · 点击卡片可翻转/)
  await clickText('临床')
  assert.match(dom.window.document.body.textContent, /手术记录（演示）/)
  assert.match(dom.window.document.body.textContent, /维持治疗选择与团队讨论/)
  await act(async () => root.unmount())
})
