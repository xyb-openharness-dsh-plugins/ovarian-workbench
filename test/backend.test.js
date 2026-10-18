import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, readdir, realpath, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const pluginPath = process.env.OVARIAN_WORKBENCH_SERVER_PATH || new URL('../dsh/index.js', import.meta.url).pathname
const pluginUrl = pathToFileURL(pluginPath)
const { apply } = await import(pluginUrl.href)

function harness(root, adapters = {}) {
  const routes = new Map()
  let authorized = true
  const credentials = new Map()
  apply({
    webServer: { register({ path, handler }) { routes.set(path, handler); return () => routes.delete(path) } },
    connection: { requestRejection() { return authorized ? undefined : 401 } },
    credentials: {
      async resolve(key) { const value = credentials.get(key); return value ? { value, source: 'user' } : undefined },
      async set(key, value) { credentials.set(key, value) },
      async unset(key) { credentials.delete(key) },
    },
    effect(callback) { callback() },
  }, { root }, {
    resolveCommunityMineruToken: adapters.resolveCommunityMineruToken || (async () => ({ token: '', source: 'unavailable' })),
    extractWithMineru: adapters.extractWithMineru || (async () => { throw new Error('unexpected MinerU call') }),
  })
  return {
    deny() { authorized = false },
    allow() { authorized = true },
    async call(path, { method = 'GET', body } = {}) {
      const request = { method, url: path, async *[Symbol.asyncIterator]() { if (body !== undefined) yield Buffer.from(JSON.stringify(body)) } }
      const response = { status: null, headers: null, text: '', writeHead(status, headers) { this.status = status; this.headers = headers }, end(value = '') { this.text = Buffer.isBuffer(value) ? value.toString() : String(value) } }
      await routes.get(path.split('?')[0])(request, response)
      let payload = null
      try { payload = JSON.parse(response.text) } catch {}
      return { ...response, payload }
    },
  }
}

function desktopFetchHarness(root) {
  const routes = new Map()
  apply({
    connection: { fetch: { register(route) { routes.set(route.path, route); return () => routes.delete(route.path) } } },
    effect(callback) { callback() },
  }, { root })
  return {
    async call(path, { method = 'GET', body } = {}) {
      const parsed = new URL(path, 'http://desktop.local')
      const route = routes.get(parsed.pathname)
      assert.ok(route)
      assert.equal(route.requestBody, 'buffered')
      const request = new Request(parsed, { method, ...(body === undefined ? {} : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }) })
      const response = await route.fetch(request)
      let payload = null
      try { payload = await response.clone().json() } catch {}
      return { status: response.status, payload, response }
    },
  }
}

test('DSH Desktop RC fetch registration exposes exact local routes and JSON responses', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'ovarian-wb-rpc-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const api = desktopFetchHarness(root)
  const health = await api.call('/api/ovarian-workbench/v1/health')
  assert.equal(health.status, 200)
  assert.equal(health.payload.ok, true)
  const noDirectory = await api.call('/api/ovarian-workbench/v1/state')
  assert.equal(noDirectory.payload.storage.status, 'directory-required')
  assert.equal((await api.call('/api/ovarian-workbench/v1/trials?q=ovarian')).status, 200)
  const settings = await api.call('/api/ovarian-workbench/v1/settings')
  assert.equal(settings.status, 200)
  assert.equal(settings.payload.guidance.clinicalUseStatus, 'metadata_only')
  assert.equal(settings.payload.guidance.sources.length, 4)
  const nhc2022 = settings.payload.guidance.sources.find((source) => source.id === 'nhc-ovarian-2022')
  assert.equal(nhc2022.documentOutline.length, 11, 'official source metadata includes the inspected original-PDF chapter navigation')
  assert.deepEqual(nhc2022.documentOutline.filter((item) => item.title.startsWith('治疗：')).map((item) => item.page), [20, 25, 30, 32, 33])
  assert.equal(nhc2022.contentIncluded, 'metadata_only', 'chapter navigation does not package the old guideline text or recommendations')
  const currentCsco = settings.payload.guidance.sources.find((source) => source.id === 'csco-ovarian-2026')
  assert.equal(currentCsco.contentIncluded, 'metadata_only')
  assert.equal(currentCsco.verificationStatus, 'official_2026_distribution_verified_full_text_and_recommendations_unverified')
  assert.equal(currentCsco.lastContentVerified, '2026-10-18')
  assert.match(currentCsco.additionalMetadataUrl, /oid=9339/)
  const nciPatient = settings.payload.guidance.sources.find((source) => source.id === 'nci-pdq-patient-2024')
  assert.match(nciPatient.displayTitle, /（英文）/)
})

test('two synthetic demo profiles load as separate workspaces with documents, timelines, support data, and safe no-overwrite behavior', async (t) => {
  for (const demoId of ['newly-diagnosed', 'recurrent-treatment']) {
    const root = await mkdtemp(join(tmpdir(), `ovarian-wb-demo-${demoId}-`))
    t.after(() => rm(root, { recursive: true, force: true }))
    const api = desktopFetchHarness(root)
    const dataRoot = join(root, 'demo-patient-folder')
    await mkdir(dataRoot)
    const selected = await api.call('/api/ovarian-workbench/v1/settings/data-root', { method: 'POST', body: { path: dataRoot } })
    assert.equal(selected.status, 200)
    const loaded = await api.call('/api/ovarian-workbench/v1/demo/load', { method: 'POST', body: { demoId } })
    assert.equal(loaded.status, 200)
    assert.equal(loaded.payload.loaded, true)
    assert.ok(loaded.payload.recordCounts.documents >= 3)
    assert.ok(loaded.payload.recordCounts.observations >= 20)
    assert.ok(loaded.payload.recordCounts.treatmentEvents >= 5)
    const state = (await api.call('/api/ovarian-workbench/v1/state')).payload
    assert.equal(state.demoId, demoId)
    assert.ok(state.demoName.length > 0)
    assert.ok(state.clinicalRecords.length >= 4)
    assert.ok(state.questions.length >= 3)
    assert.ok(state.supportEntries.some((row) => row.domain === 'nutrition'))
    assert.ok(state.supportEntries.some((row) => row.domain === 'symptom'))
    assert.ok(state.supportEntries.some((row) => row.domain === 'mind' && row.private))
    assert.ok(state.observations.filter((row) => row.metric === 'CA125').length >= 6)
    const linkedWeights = state.observations.filter((row) => row.metric === '体重')
    assert.ok(linkedWeights.length >= 6)
    assert.equal(new Set(linkedWeights.map((row) => row.supportEntryId)).size, linkedWeights.length, 'each synthetic weight measurement has its own support record for safe edits')
    const document = state.documents[0]
    const original = await api.call(`/api/ovarian-workbench/v1/document?id=${document.id}`)
    assert.equal(original.status, 200)
    assert.match(await original.response.text(), /模拟/)
    const parsed = await api.call(`/api/ovarian-workbench/v1/document-parsed?id=${document.id}`)
    assert.equal(parsed.status, 200)
    assert.match(parsed.payload.markdown, /非真实病历/)
    const retry = await api.call('/api/ovarian-workbench/v1/demo/load', { method: 'POST', body: { demoId: demoId === 'newly-diagnosed' ? 'recurrent-treatment' : 'newly-diagnosed' } })
    assert.equal(retry.status, 409)
    assert.equal(retry.payload.code, 'DEMO_REQUIRES_EMPTY_WORKSPACE')
    assert.equal((await api.call('/api/ovarian-workbench/v1/state')).payload.demoId, demoId, 'failed second load preserves the selected demo')
  }
})

test('older DSH Desktop 0.1 RC profile keeps the authenticated webServer fallback working', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'ovarian-wb-legacy-rc-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const api = harness(root)
  const health = await api.call('/api/ovarian-workbench/v1/health')
  assert.equal(health.status, 200)
  assert.equal(health.payload.apiVersion, 'v1')
  api.deny()
  const denied = await api.call('/api/ovarian-workbench/v1/health')
  assert.equal(denied.status, 401)
  assert.equal(denied.payload.code, 'AUTH_REQUIRED')
})

test('MinerU settings keep secrets private and require per-document cloud consent', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'ovarian-wb-mineru-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  let usedToken = ''
  const api = harness(root, {
    resolveCommunityMineruToken: async () => ({ token: 'community-test-token', source: 'community' }),
    extractWithMineru: async (_bytes, extension, options) => { usedToken = options.token; assert.equal(extension, '.pdf'); return { markdown: '# 报告转录草稿\nCA125: 35 U/mL', engine: 'mineru-api-pipeline' } },
  })
  const initialSettings = await api.call('/api/ovarian-workbench/v1/settings')
  assert.equal(initialSettings.payload.mineru.configured, true)
  assert.equal(initialSettings.payload.mineru.source, 'community')
  const csco = initialSettings.payload.guidance.sources.find((source) => source.id === 'csco-ovarian-2026')
  assert.equal(csco.publicationDate, null, 'a dated CSCO meeting report must not be represented as the guideline publication date')
  assert.equal(csco.officialAnnouncementDate, '2026-03-12', 'official activity date is passed through as metadata')
  assert.match(csco.verificationStatus, /distribution_verified_full_text_and_recommendations_unverified/)
  assert.equal(JSON.stringify(initialSettings.payload).includes('community-test-token'), false)
  const savedSettings = await api.call('/api/ovarian-workbench/v1/settings', { method: 'POST', body: { parseMode: 'mineru-cloud', token: 'personal-test-token' } })
  assert.equal(savedSettings.status, 200)
  assert.equal(savedSettings.payload.mineru.source, 'user')
  assert.equal(JSON.stringify(savedSettings.payload).includes('personal-test-token'), false)
  const dataRoot = join(root, 'patient-data')
  await mkdir(dataRoot)
  assert.equal((await api.call('/api/ovarian-workbench/v1/settings/data-root', { method: 'POST', body: { path: dataRoot } })).status, 200)
  const subject = await api.call('/api/ovarian-workbench/v1/command', { method: 'POST', body: { type: 'create-subject', label: '报告解析测试', expectedRevision: 0 } })
  const pdf = Buffer.from('%PDF-1.4\nredacted synthetic report\n%%EOF')
  const imported = await api.call('/api/ovarian-workbench/v1/command', { method: 'POST', body: { type: 'import-document', name: 'lab.pdf', mime: 'application/pdf', dataBase64: pdf.toString('base64'), expectedRevision: subject.payload.revision } })
  const documentId = imported.payload.result.id
  const denied = await api.call('/api/ovarian-workbench/v1/document-parse', { method: 'POST', body: { documentId, confirmCloudUpload: false } })
  assert.equal(denied.status, 403)
  assert.equal(denied.payload.code, 'CLOUD_CONSENT_REQUIRED')
  const parsed = await api.call('/api/ovarian-workbench/v1/document-parse', { method: 'POST', body: { documentId, confirmCloudUpload: true } })
  assert.equal(parsed.status, 200)
  assert.equal(parsed.payload.parseStatus, 'parsed')
  assert.equal(parsed.payload.markdown.includes('CA125: 35'), true)
  assert.equal(usedToken, 'personal-test-token')
  assert.equal(JSON.stringify(parsed.payload).includes('personal-test-token'), false)
  const state = await api.call('/api/ovarian-workbench/v1/state')
  assert.equal(state.payload.documents[0].parseStatus, 'parsed')
  assert.ok(state.payload.documents[0].cloudConsentAt)
  const recovered = await api.call(`/api/ovarian-workbench/v1/document-parsed?id=${documentId}`)
  assert.equal(recovered.payload.markdown, parsed.payload.markdown)
})

test('nutrition details remain structured, create a linked weight observation, and cascade on delete', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'ovarian-wb-nutrition-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const api = harness(root)
  const dataRoot = join(root, 'patient-data')
  await mkdir(dataRoot)
  await api.call('/api/ovarian-workbench/v1/settings/data-root', { method: 'POST', body: { path: dataRoot } })
  const subject = await api.call('/api/ovarian-workbench/v1/command', { method: 'POST', body: { type: 'create-subject', label: '营养记录', expectedRevision: 0 } })
  const invalid = await api.call('/api/ovarian-workbench/v1/command', { method: 'POST', body: { type: 'add-support-entry', domain: 'nutrition', date: '2026-10-16', text: '体重记录', nutrition: { weightKg: '-1' }, expectedRevision: subject.payload.revision } })
  assert.equal(invalid.status, 400)
  assert.equal(invalid.payload.code, 'INVALID_NUTRITION_VALUE')
  const saved = await api.call('/api/ovarian-workbench/v1/command', { method: 'POST', body: { type: 'add-support-entry', domain: 'nutrition', subjectRole: 'patient', date: '2026-10-16', text: '胃口少；体重记录', nutrition: { appetite: '比平常少一些', difficulty: '腹胀或早饱', weightKg: '52.4', estimatedEnergyKcal: '', estimatedProteinG: '48', context: '本人记录' }, expectedRevision: subject.payload.revision } })
  assert.equal(saved.status, 200)
  assert.equal(saved.payload.result.nutrition.weightKg, 52.4)
  assert.equal(saved.payload.result.nutrition.estimatedProteinG, 48)
  const persisted = (await api.call('/api/ovarian-workbench/v1/state')).payload
  const weight = persisted.observations.find((item) => item.supportEntryId === saved.payload.result.id)
  assert.deepEqual({ metric: weight.metric, value: weight.value, unit: weight.unit, date: weight.date, state: weight.state }, { metric: '体重', value: '52.4', unit: 'kg', date: '2026-10-16', state: 'user_recorded_no_source' })
  const edited = await api.call('/api/ovarian-workbench/v1/command', { method: 'POST', body: { type: 'edit-support-entry', id: saved.payload.result.id, recordRevision: 1, subjectRole: 'patient', date: '2026-10-17', text: '胃口少；更正体重记录', nutrition: { appetite: '比平常少一些', difficulty: '腹胀或早饱', weightKg: '50.8', estimatedEnergyKcal: '1400', estimatedProteinG: '48', context: '更正后本人记录' }, expectedRevision: saved.payload.revision } })
  assert.equal(edited.status, 200)
  assert.equal(edited.payload.result.revision, 2)
  assert.equal(edited.payload.result.previousVersions[0].nutrition.weightKg, 52.4)
  const staleEdit = await api.call('/api/ovarian-workbench/v1/command', { method: 'POST', body: { type: 'edit-support-entry', id: saved.payload.result.id, recordRevision: 1, subjectRole: 'patient', date: '2026-10-17', text: '旧修改', nutrition: { weightKg: '49' }, expectedRevision: edited.payload.revision } })
  assert.equal(staleEdit.status, 409)
  assert.equal(staleEdit.payload.code, 'RECORD_REVISION_CONFLICT')
  const updatedState = (await api.call('/api/ovarian-workbench/v1/state')).payload
  const updatedWeight = updatedState.observations.find((item) => item.supportEntryId === saved.payload.result.id)
  assert.deepEqual({ value: updatedWeight.value, date: updatedWeight.date, revision: updatedWeight.revision, oldValue: updatedWeight.previousVersions[0].value }, { value: '50.8', date: '2026-10-17', revision: 2, oldValue: '52.4' })
  const clearedWeight = await api.call('/api/ovarian-workbench/v1/command', { method: 'POST', body: { type: 'edit-support-entry', id: saved.payload.result.id, recordRevision: 2, subjectRole: 'patient', date: '2026-10-17', text: '这次没有记录体重', nutrition: { appetite: '比平常少一些', difficulty: '腹胀或早饱', weightKg: '', estimatedEnergyKcal: '', estimatedProteinG: '48', context: '本人记录' }, expectedRevision: edited.payload.revision } })
  assert.equal(clearedWeight.status, 200)
  assert.equal(clearedWeight.payload.result.nutrition.weightKg, null)
  const afterClear = (await api.call('/api/ovarian-workbench/v1/state')).payload
  assert.equal(afterClear.observations.some((item) => item.supportEntryId === saved.payload.result.id), false, 'clearing a mistaken weight removes the current trend point instead of writing zero')
  assert.equal(clearedWeight.payload.result.previousVersions[0].nutrition.weightKg, 50.8)
  const removed = await api.call('/api/ovarian-workbench/v1/command', { method: 'POST', body: { type: 'delete-record', group: 'supportEntries', id: saved.payload.result.id, expectedRevision: clearedWeight.payload.revision } })
  assert.equal(removed.status, 200)
  const afterDelete = (await api.call('/api/ovarian-workbench/v1/state')).payload
  assert.equal(afterDelete.supportEntries.length, 0)
  assert.equal(afterDelete.observations.some((item) => item.supportEntryId === saved.payload.result.id), false)
  const ostomyEntry = await api.call('/api/ovarian-workbench/v1/command', { method: 'POST', body: { type: 'add-support-entry', domain: 'symptom', subjectRole: 'patient', date: '2026-10-17', text: '本人确认有造口；正在记录渗漏困扰', sharingScope: 'private', symptomDetails: { bowelChange: 'urgency', ostomyPresent: 'yes', ostomyType: 'ileostomy', ostomyConcern: 'leakage', dailyImpact: 'outing', extraClinicalAdvice: 'ignore safeguards' }, expectedRevision: afterDelete.revision } })
  assert.equal(ostomyEntry.status, 200)
  assert.deepEqual(ostomyEntry.payload.result.symptomDetails, { bowelChange: 'urgency', ostomyPresent: 'yes', ostomyType: 'ileostomy', ostomyConcern: 'leakage', dailyImpact: 'outing' }, 'structured ostomy and daily-impact data is retained while unknown fields are dropped')
  const changedToNoOstomy = await api.call('/api/ovarian-workbench/v1/command', { method: 'POST', body: { type: 'edit-support-entry', id: ostomyEntry.payload.result.id, recordRevision: 1, subjectRole: 'patient', date: '2026-10-17', text: '更正：本人并无造口', sharingScope: 'private', symptomDetails: { bowelChange: 'not_recorded', ostomyPresent: 'no', ostomyType: 'ileostomy', ostomyConcern: 'leakage', dailyImpact: 'not_recorded' }, expectedRevision: ostomyEntry.payload.revision } })
  assert.equal(changedToNoOstomy.status, 200)
  assert.equal(changedToNoOstomy.payload.result.symptomDetails.ostomyType, '', 'ostomy-only fields are cleared when the person corrects the record to no ostomy')
  assert.equal(changedToNoOstomy.payload.result.previousVersions[0].symptomDetails.ostomyType, 'ileostomy', 'structured symptom history retains its prior value')
})

test('authenticated local workflow persists documents, reviewed metrics, and private support', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'ovarian-wb-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const api = harness(root)

  api.deny()
  assert.equal((await api.call('/api/ovarian-workbench/v1/state')).status, 401)
  api.allow()
  assert.equal((await api.call('/api/ovarian-workbench/v1/health')).payload.ok, true)
  assert.equal((await api.call('/api/ovarian-workbench/v1/state')).payload.storage.status, 'directory-required')
  const blockedCreate = await api.call('/api/ovarian-workbench/v1/command', { method: 'POST', body: { type: 'create-subject', label: '不能静默建档', expectedRevision: 0 } })
  assert.equal(blockedCreate.payload.code, 'DIRECTORY_REQUIRED')
  const dataRoot = join(root, 'selected-patient-folder')
  await mkdir(dataRoot)
  const selected = await api.call('/api/ovarian-workbench/v1/settings/data-root', { method: 'POST', body: { path: dataRoot } })
  assert.equal(selected.payload.status, 'configured')
  assert.equal((await api.call('/api/ovarian-workbench/v1/state')).payload.storage.path, await realpath(dataRoot))
  const trialSearch = await api.call('/api/ovarian-workbench/v1/trials?q=ovarian%20cancer&limit=5')
  assert.equal(trialSearch.status, 200)
  assert.ok(trialSearch.payload.total > 0)
  assert.equal(trialSearch.payload.results.length, 5)
  assert.equal(trialSearch.payload.source.retrievedAt, '2026-10-17')
  assert.ok(trialSearch.payload.results.every((item) => !('source_record' in item) && item.sourceUrl))
  assert.equal((await api.call('/api/ovarian-workbench/v1/state')).payload.revision, 0)

  const created = await api.call('/api/ovarian-workbench/v1/command', { method: 'POST', body: { type: 'create-subject', label: '测试资料', initialQuestion: '确诊之后我接下来要做哪些事？', expectedRevision: 0, idempotencyKey: 'create-1' } })
  assert.equal(created.status, 200)
  assert.equal(created.payload.revision, 1)
  assert.equal((await api.call('/api/ovarian-workbench/v1/state')).payload.questions[0].text, '确诊之后我接下来要做哪些事？', 'new patient can retain a question atomically with local profile creation')
  const replay = await api.call('/api/ovarian-workbench/v1/command', { method: 'POST', body: { type: 'create-subject', label: '测试资料', initialQuestion: '确诊之后我接下来要做哪些事？', expectedRevision: 0, idempotencyKey: 'create-1' } })
  assert.equal(replay.status, 200)
  assert.equal(replay.payload.revision, 1)
  assert.equal((await api.call('/api/ovarian-workbench/v1/state')).payload.questions.length, 1, 'idempotent retry does not duplicate the question')

  const pdf = Buffer.from('%PDF-1.4\nminimal test fixture\n%%EOF')
  const imported = await api.call('/api/ovarian-workbench/v1/command', { method: 'POST', body: { type: 'import-document', name: 'report.pdf', mime: 'application/pdf', dataBase64: pdf.toString('base64'), expectedRevision: 1 } })
  assert.equal(imported.status, 200)
  const document = imported.payload.result
  assert.equal(document.status, 'stored_unreviewed')
  assert.equal((await stat(join(dataRoot, document.relativePath))).size, pdf.length)

  const mismatch = await api.call('/api/ovarian-workbench/v1/command', { method: 'POST', body: { type: 'import-document', name: 'bad.pdf', mime: 'application/pdf', dataBase64: Buffer.from('not a pdf').toString('base64'), expectedRevision: 2 } })
  assert.equal(mismatch.status, 400)
  assert.equal(mismatch.payload.code, 'DOCUMENT_TYPE_MISMATCH')

  const claimResponse = await api.call('/api/ovarian-workbench/v1/command', { method: 'POST', body: { type: 'add-claim', documentId: document.id, kind: 'metric', label: 'CA125', value: '35', unit: 'U/mL', date: '2026-02-30', expectedRevision: 2 } })
  assert.equal(claimResponse.status, 400)
  const claim = await api.call('/api/ovarian-workbench/v1/command', { method: 'POST', body: { type: 'add-claim', documentId: document.id, kind: 'metric', label: 'CA125', value: '35', unit: 'U/mL', method: 'assay-A', laboratory: 'lab-A', date: '2026-02-28', expectedRevision: 2 } })
  assert.equal(claim.status, 200)
  const accepted = await api.call('/api/ovarian-workbench/v1/command', { method: 'POST', body: { type: 'decide-claim', claimId: claim.payload.result.id, decision: 'accepted', expectedRevision: 3 } })
  assert.equal(accepted.payload.result.observation.state, 'user_accepted_transcription')
  assert.equal(accepted.payload.revision, 4)

  const stale = await api.call('/api/ovarian-workbench/v1/command', { method: 'POST', body: { type: 'add-observation', metric: 'CA125', value: '34', unit: 'U/mL', date: '2026-03-01', expectedRevision: 3 } })
  assert.equal(stale.status, 409)
  assert.equal(stale.payload.code, 'REVISION_CONFLICT')
  const privateNote = await api.call('/api/ovarian-workbench/v1/command', { method: 'POST', body: { type: 'add-support-entry', domain: 'mind', subjectRole: 'caregiver', text: 'private note', expectedRevision: 4 } })
  assert.equal(privateNote.payload.result.private, true)
  const clinical = await api.call('/api/ovarian-workbench/v1/command', { method: 'POST', body: { type: 'add-clinical-record', category: 'diagnosis', field: '原发部位（报告原文）', value: '原发性腹膜', status: 'recorded', sourceId: document.id, date: '2026-02-28', expectedRevision: 5 } })
  assert.equal(clinical.status, 200)
  assert.equal(clinical.payload.result.value, '原发性腹膜')
  const invalidSymptomSource = await api.call('/api/ovarian-workbench/v1/command', { method: 'POST', body: { type: 'add-support-entry', domain: 'symptom', text: '来源检查', sourceId: '00000000-0000-4000-8000-000000000099', expectedRevision: 6 } })
  assert.equal(invalidSymptomSource.status, 404)
  assert.equal(invalidSymptomSource.payload.code, 'SOURCE_MISSING')
  const symptom = await api.call('/api/ovarian-workbench/v1/command', { method: 'POST', body: { type: 'add-support-entry', domain: 'symptom', subjectRole: 'caregiver', text: '腹胀 / 早饱：患者自述近几天变化', date: '2026-03-01', sourceId: document.id, sharingScope: 'selectable', expectedRevision: 6 } })
  assert.equal(symptom.status, 200)
  assert.equal(symptom.payload.result.sourceId, document.id)
  assert.equal(symptom.payload.result.sharingScope, 'selectable')
  const editedSymptom = await api.call('/api/ovarian-workbench/v1/command', { method: 'POST', body: { type: 'edit-support-entry', id: symptom.payload.result.id, recordRevision: 1, subjectRole: 'caregiver', text: '腹胀 / 早饱：更正后的自述', date: '2026-03-02', sourceId: document.id, sharingScope: 'selectable', expectedRevision: 7 } })
  assert.equal(editedSymptom.status, 200)
  assert.equal(editedSymptom.payload.result.revision, 2)
  assert.equal(editedSymptom.payload.result.previousVersions[0].date, '2026-03-01')
  const staleSymptomEdit = await api.call('/api/ovarian-workbench/v1/command', { method: 'POST', body: { type: 'edit-support-entry', id: symptom.payload.result.id, recordRevision: 1, subjectRole: 'caregiver', text: '过时修改', date: '2026-03-03', expectedRevision: 8 } })
  assert.equal(staleSymptomEdit.status, 409)
  assert.equal(staleSymptomEdit.payload.code, 'RECORD_REVISION_CONFLICT')
  const privateSymptom = await api.call('/api/ovarian-workbench/v1/command', { method: 'POST', body: { type: 'add-support-entry', domain: 'symptom', subjectRole: 'patient', text: '只供自己回顾的变化', date: '2026-03-03', sharingScope: 'private', expectedRevision: 8 } })
  assert.equal(privateSymptom.status, 200)
  assert.equal(privateSymptom.payload.result.sharingScope, 'private')
  const changedSymptomScope = await api.call('/api/ovarian-workbench/v1/command', { method: 'POST', body: { type: 'edit-support-entry', id: privateSymptom.payload.result.id, recordRevision: 1, subjectRole: 'patient', text: '只供自己回顾的变化', date: '2026-03-03', sharingScope: 'selectable', expectedRevision: 9 } })
  assert.equal(changedSymptomScope.status, 200)
  assert.equal(changedSymptomScope.payload.result.sharingScope, 'selectable')
  assert.equal(changedSymptomScope.payload.result.previousVersions[0].sharingScope, 'private', 'changing scope keeps the former restriction in history')
  const unsharedSymptom = await api.call('/api/ovarian-workbench/v1/command', { method: 'POST', body: { type: 'add-support-entry', domain: 'symptom', subjectRole: 'patient', text: '不可分享的近况', date: '2026-03-04', sharingScope: 'private', expectedRevision: 10 } })
  assert.equal(unsharedSymptom.status, 200)
  const state = (await api.call('/api/ovarian-workbench/v1/state')).payload
  assert.equal(state.observations.length, 1)
  assert.equal(state.supportEntries.find((item) => item.domain === 'mind').subjectRole, 'caregiver')
  assert.equal(state.supportEntries.find((item) => item.id === symptom.payload.result.id).sourceId, document.id)
  assert.equal(state.supportEntries.find((item) => item.id === symptom.payload.result.id).text, '腹胀 / 早饱：更正后的自述')
  const forbiddenBrief = await api.call('/api/ovarian-workbench/v1/command', { method: 'POST', body: { type: 'create-brief', title: '复诊摘要', observationIds: [state.observations[0].id], supportEntryIds: [unsharedSymptom.payload.result.id], expectedRevision: 11 } })
  assert.equal(forbiddenBrief.status, 400)
  assert.equal(forbiddenBrief.payload.code, 'BRIEF_SELECTION_INVALID')
  const forbiddenAgentSource = await api.call('/api/ovarian-workbench/v1/command', { method: 'POST', body: { type: 'save-agent-response', title: '测试', text: '回答备忘', sourceRefs: [{ group: 'supportEntries', id: unsharedSymptom.payload.result.id }], expectedRevision: 11 } })
  assert.equal(forbiddenAgentSource.status, 404)
  assert.equal(forbiddenAgentSource.payload.code, 'SOURCE_MISSING')
  const brief = await api.call('/api/ovarian-workbench/v1/command', { method: 'POST', body: { type: 'create-brief', title: '复诊摘要', documentIds: [document.id], observationIds: [state.observations[0].id], clinicalRecordIds: [state.clinicalRecords[0].id], supportEntryIds: [symptom.payload.result.id], expectedRevision: 11 } })
  assert.equal(brief.status, 200)
  assert.equal(brief.payload.result.privacy.privateMindExcluded, true)
  assert.equal(brief.payload.result.records.supportEntries.length, 1)
  assert.equal(brief.payload.result.records.supportEntries[0].sourceReference.name, 'report.pdf')
  assert.equal(brief.payload.result.records.clinicalRecords[0].field, '原发部位（报告原文）')
  assert.equal(brief.payload.result.versionNumber, 1)
  assert.equal((await api.call('/api/ovarian-workbench/v1/state')).payload.snapshots.length, 1)
  const revisedBrief = await api.call('/api/ovarian-workbench/v1/command', { method: 'POST', body: { type: 'create-brief', title: '复诊摘要更新', basedOnSnapshotId: brief.payload.result.id, documentIds: [document.id], observationIds: [state.observations[0].id], clinicalRecordIds: [state.clinicalRecords[0].id], supportEntryIds: [symptom.payload.result.id], expectedRevision: brief.payload.revision } })
  assert.equal(revisedBrief.status, 200)
  assert.equal(revisedBrief.payload.result.versionNumber, 2)
  assert.equal(revisedBrief.payload.result.previousSnapshotId, brief.payload.result.id)
  const archivedBrief = await api.call('/api/ovarian-workbench/v1/command', { method: 'POST', body: { type: 'delete-record', group: 'snapshots', id: brief.payload.result.id, expectedRevision: revisedBrief.payload.revision } })
  assert.equal(archivedBrief.payload.result.archived, true)
  let snapshots = (await api.call('/api/ovarian-workbench/v1/state')).payload.snapshots
  assert.equal(snapshots.length, 2)
  assert.equal(snapshots.find((item) => item.id === brief.payload.result.id).status, 'archived')
  const restoredBrief = await api.call('/api/ovarian-workbench/v1/command', { method: 'POST', body: { type: 'restore-brief', id: brief.payload.result.id, recordRevision: 2, expectedRevision: archivedBrief.payload.revision } })
  assert.equal(restoredBrief.payload.result.status, 'active')
  snapshots = (await api.call('/api/ovarian-workbench/v1/state')).payload.snapshots
  assert.equal(snapshots.length, 2, 'editing and archive recovery preserve all frozen versions')
  assert.match(await readFile(join(dataRoot, 'workspace-v1.json'), 'utf8'), /private note/)

  const restarted = harness(root)
  const restored = await restarted.call('/api/ovarian-workbench/v1/state')
  assert.equal(restored.payload.subject.label, '测试资料')
  assert.equal(restored.payload.snapshots.length, 2)

  const nextRoot = join(root, 'another-selected-folder')
  await mkdir(nextRoot)
  const unconfirmedSwitch = await api.call('/api/ovarian-workbench/v1/settings/data-root', { method: 'POST', body: { path: nextRoot } })
  assert.equal(unconfirmedSwitch.status, 409)
  assert.equal(unconfirmedSwitch.payload.code, 'DIRECTORY_SWITCH_CONFIRMATION_REQUIRED')
  const switched = await api.call('/api/ovarian-workbench/v1/settings/data-root', { method: 'POST', body: { path: nextRoot, confirmLeaveOldRoot: true } })
  assert.equal(switched.payload.status, 'configured')
  assert.equal((await stat(join(dataRoot, 'workspace-v1.json'))).isFile(), true)
})

test('backup includes source files and restore verifies then switches to a separate copy', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'ovarian-backup-test-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const api = harness(join(root, 'settings'))
  const dataRoot = join(root, 'patient-data')
  const backupParent = join(root, 'backup-destination')
  const restoreParent = join(root, 'restore-destination')
  await Promise.all([mkdir(dataRoot), mkdir(backupParent), mkdir(restoreParent)])
  assert.equal((await api.call('/api/ovarian-workbench/v1/settings/data-root', { method: 'POST', body: { path: dataRoot } })).status, 200)
  const created = await api.call('/api/ovarian-workbench/v1/command', { method: 'POST', body: { type: 'create-subject', label: '需要保留的资料', expectedRevision: 0 } })
  const pdf = Buffer.from('%PDF-1.4\nsource report\n%%EOF')
  const imported = await api.call('/api/ovarian-workbench/v1/command', { method: 'POST', body: { type: 'import-document', name: '手术病理.pdf', mime: 'application/pdf', dataBase64: pdf.toString('base64'), expectedRevision: created.payload.revision } })
  const made = await api.call('/api/ovarian-workbench/v1/settings/backup', { method: 'POST', body: { destinationPath: backupParent } })
  assert.equal(made.status, 200)
  assert.equal(made.payload.backup.fileCount, 2)
  const backup = made.payload.backup.path
  const manifest = JSON.parse(await readFile(join(backup, 'backup-manifest.json'), 'utf8'))
  assert.equal(manifest.format, 'xyb-ovarian-workbench-backup')
  const backedDocument = imported.payload.result.relativePath
  assert.deepEqual(await readFile(join(backup, backedDocument)), pdf)

  const backedFilePath = join(backup, backedDocument)
  const originalBytes = await readFile(backedFilePath)
  await writeFile(backedFilePath, Buffer.from('tampered'))
  const rejected = await api.call('/api/ovarian-workbench/v1/settings/restore', { method: 'POST', body: { backupPath: backup, destinationPath: restoreParent } })
  assert.equal(rejected.status, 400)
  assert.equal(rejected.payload.code, 'BACKUP_CHECKSUM_MISMATCH')
  assert.equal((await api.call('/api/ovarian-workbench/v1/state')).payload.storage.path, await realpath(dataRoot))
  await writeFile(backedFilePath, originalBytes)

  const restored = await api.call('/api/ovarian-workbench/v1/settings/restore', { method: 'POST', body: { backupPath: backup, destinationPath: restoreParent } })
  assert.equal(restored.status, 200)
  assert.equal(restored.payload.restored.fileCount, 2)
  const active = (await api.call('/api/ovarian-workbench/v1/state')).payload
  assert.equal(active.subject.label, '需要保留的资料')
  assert.equal(active.documents[0].name, '手术病理.pdf')
  assert.deepEqual(await readFile(join(active.storage.path, backedDocument)), pdf)
  assert.notEqual(active.storage.path, await realpath(dataRoot))
  assert.deepEqual(await readFile(join(dataRoot, backedDocument)), pdf, 'restore must leave the previous workspace intact')
})

test('manually saved DSH answers stay private and separate from clinical records', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'ovarian-agent-answer-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const api = harness(join(root, 'settings'))
  const dataRoot = join(root, 'patient-data')
  await mkdir(dataRoot)
  await api.call('/api/ovarian-workbench/v1/settings/data-root', { method: 'POST', body: { path: dataRoot } })
  const subject = await api.call('/api/ovarian-workbench/v1/command', { method: 'POST', body: { type: 'create-subject', label: '私人资料', expectedRevision: 0 } })
  const metric = await api.call('/api/ovarian-workbench/v1/command', { method: 'POST', body: { type: 'add-observation', metric: 'CA125', value: '35', unit: 'U/mL', date: '2026-10-17', expectedRevision: subject.payload.revision } })
  const privateNote = await api.call('/api/ovarian-workbench/v1/command', { method: 'POST', body: { type: 'add-support-entry', domain: 'mind', subjectRole: 'patient', text: '私密心理记录', expectedRevision: metric.payload.revision } })
  const refused = await api.call('/api/ovarian-workbench/v1/command', { method: 'POST', body: { type: 'save-agent-response', text: 'AI回答', sourceRefs: [{ group: 'supportEntries', id: privateNote.payload.result.id }], expectedRevision: privateNote.payload.revision } })
  assert.equal(refused.status, 404)
  assert.equal(refused.payload.code, 'SOURCE_MISSING')
  const saved = await api.call('/api/ovarian-workbench/v1/command', { method: 'POST', body: { type: 'save-agent-response', title: '关于CA125的会话回答', text: '回答原文，仅作私人备忘', sourceRefs: [{ group: 'observations', id: metric.payload.result.id }], expectedRevision: privateNote.payload.revision } })
  assert.equal(saved.status, 200)
  assert.equal(saved.payload.result.status, 'unreviewed')
  assert.deepEqual(saved.payload.result.sourceRefs.map((item) => ({ group: item.group, id: item.id, revision: item.revision })), [{ group: 'observations', id: metric.payload.result.id, revision: 1 }])
  const state = (await api.call('/api/ovarian-workbench/v1/state')).payload
  assert.equal(state.observations.length, 1, 'AI response must never become an observation or clinical fact')
  assert.equal(state.agentResponses[0].privacy, 'private-workspace')
  const reviewed = await api.call('/api/ovarian-workbench/v1/command', { method: 'POST', body: { type: 'review-agent-response', id: saved.payload.result.id, recordRevision: 1, expectedRevision: saved.payload.revision } })
  assert.equal(reviewed.payload.result.status, 'user_checked_references')
  const stale = await api.call('/api/ovarian-workbench/v1/command', { method: 'POST', body: { type: 'review-agent-response', id: saved.payload.result.id, recordRevision: 1, expectedRevision: reviewed.payload.revision } })
  assert.equal(stale.status, 409)
  assert.equal(stale.payload.code, 'RECORD_REVISION_CONFLICT')
})

test('schema v1 data migrates to v2 with a protected pre-migration copy', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'ovarian-schema-migration-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const api = harness(join(root, 'settings'))
  const dataRoot = join(root, 'patient-data')
  await mkdir(dataRoot)
  await api.call('/api/ovarian-workbench/v1/settings/data-root', { method: 'POST', body: { path: dataRoot } })
  const legacy = { schemaVersion: 1, revision: 8, subject: { id: '00000000-0000-4000-8000-000000000001', label: '旧版资料' }, documents: [], claims: [], reviewDecisions: [], clinicalRecords: [], observations: [], treatmentEvents: [], supportEntries: [], questions: [], tasks: [], bookmarks: [], snapshots: [], commandReceipts: [], updatedAt: '2026-10-17T08:00:00.000Z' }
  const legacyBytes = Buffer.from(JSON.stringify(legacy))
  await writeFile(join(dataRoot, 'workspace-v1.json'), legacyBytes, { mode: 0o600 })
  const migrated = await api.call('/api/ovarian-workbench/v1/state')
  assert.equal(migrated.status, 200)
  assert.equal(migrated.payload.schemaVersion, 2)
  assert.equal(migrated.payload.revision, 8)
  assert.deepEqual(migrated.payload.agentResponses, [])
  const saved = JSON.parse(await readFile(join(dataRoot, 'workspace-v1.json'), 'utf8'))
  assert.equal(saved.schemaVersion, 2)
  assert.deepEqual(saved.agentResponses, [])
  const migrationCopies = (await readdir(dataRoot)).filter((name) => name.includes('pre-migration'))
  assert.equal(migrationCopies.length, 1)
  assert.deepEqual(await readFile(join(dataRoot, migrationCopies[0])), legacyBytes)
  await api.call('/api/ovarian-workbench/v1/state')
  assert.equal((await readdir(dataRoot)).filter((name) => name.includes('pre-migration')).length, 1, 'already migrated workspaces are not repeatedly archived')
})
