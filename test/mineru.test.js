/**
 * MinerU 客户端单测：**不联网**。
 *
 * 2026-10-22 起走 HTTP API v4（原先是 `mineru-open-api` CLI 包装）。这里用假 fetch 复现
 * 真实协议的四个环节（申请链接 → 上传 → 轮询 → 下载解包），重点看那些出错时容易糊弄过去的地方：
 * Token 泄漏、401 当成功、模型参数被拒、ZIP 里没有 full.md、页数从哪来。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { deflateRawSync } from 'node:zlib'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  extractWithMineru, resolveToken, maskToken, MineruClient, MineruError,
  MINERU_MODEL_DEFAULT, MINERU_MODEL_FALLBACK, modelFallbackWorthy,
} from '../dsh/mineru.js'
import { readZip } from '../lib/zip.js'

/* ---------------- 造一个真 ZIP（deflate，够真） ---------------- */

function buildZip(files) {
  const chunks = []
  const central = []
  let offset = 0
  for (const file of files) {
    const data = Buffer.from(file.data)
    const comp = deflateRawSync(data)
    const nameBuf = Buffer.from(file.name, 'utf8')
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(0x800, 6)
    local.writeUInt16LE(8, 8)
    local.writeUInt32LE(comp.length, 18)
    local.writeUInt32LE(data.length, 22)
    local.writeUInt16LE(nameBuf.length, 26)
    chunks.push(local, nameBuf, comp)
    central.push({ nameBuf, comp, data, offset })
    offset += 30 + nameBuf.length + comp.length
  }
  const cdStart = offset
  const cdChunks = []
  for (const c of central) {
    const h = Buffer.alloc(46)
    h.writeUInt32LE(0x02014b50, 0)
    h.writeUInt16LE(20, 4)
    h.writeUInt16LE(20, 6)
    h.writeUInt16LE(0x800, 8)
    h.writeUInt16LE(8, 10)
    h.writeUInt32LE(c.comp.length, 20)
    h.writeUInt32LE(c.data.length, 24)
    h.writeUInt16LE(c.nameBuf.length, 28)
    h.writeUInt32LE(c.offset, 42)
    cdChunks.push(h, c.nameBuf)
    offset += 46 + c.nameBuf.length
  }
  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0)
  eocd.writeUInt16LE(central.length, 8)
  eocd.writeUInt16LE(central.length, 10)
  eocd.writeUInt32LE(offset - cdStart, 12)
  eocd.writeUInt32LE(cdStart, 16)
  return Buffer.concat([...chunks, ...cdChunks, eocd])
}

const jsonResponse = (data, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => data,
  arrayBuffer: async () => Buffer.from(JSON.stringify(data)).buffer,
})
const bytesResponse = (buf, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => { throw new Error('not json') },
  arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
})

/** 假 MinerU：状态在第 N 次查询后变 done；`rejectModel` 可让首次申请报"模型参数不被接受"。 */
function fakeMineru({ zipBuffer, states = ['running', 'done'], failWith = null, rejectModel = false, withProgress = true } = {}) {
  let poll = 0
  let batchCalls = 0
  const calls = []
  const fetchImpl = async (url, init = {}) => {
    const method = init.method ?? 'GET'
    calls.push({ url, method, headers: init.headers ?? {}, body: init.body })
    if (url.endsWith('/file-urls/batch') && method === 'POST') {
      batchCalls += 1
      const sent = JSON.parse(init.body)
      if (rejectModel && batchCalls === 1) {
        return jsonResponse({ code: -10002, msg: `model_version '${sent.model_version}' is not supported` })
      }
      return jsonResponse({ code: 0, data: { batch_id: 'batch_1', file_urls: ['https://upload.example/put/1'] } })
    }
    if (url === 'https://upload.example/put/1') return { ok: true, status: 200 }
    if (url.includes('/extract-results/batch/batch_1')) {
      const state = states[Math.min(poll, states.length - 1)]
      poll += 1
      return jsonResponse({
        code: 0,
        data: {
          batch_id: 'batch_1',
          extract_result: [{
            file_name: 'ovary.pdf',
            state,
            full_zip_url: state === 'done' ? 'https://cdn.example/result.zip' : null,
            err_msg: failWith,
            ...(withProgress ? { extract_progress: { total_pages: 4 } } : {}),
          }],
        },
      })
    }
    if (url === 'https://cdn.example/result.zip') return bytesResponse(zipBuffer)
    throw new Error(`假 fetch 没实现这个地址：${method} ${url}`)
  }
  return { fetchImpl, calls }
}

const MD = ['# 病理报告', '| 项目 | 结果 |', '| --- | --- |', '| CA125 | 35 |'].join('\n')
const CONTENT_LIST = [
  { type: 'text', page_idx: 0, text: '病理报告' },
  { type: 'table', page_idx: 1, table_body: '<table><tr><td>CA125</td></tr></table>' },
]

/* ---------------- 主链路 ---------------- */

test('① 四步链路：默认 pipeline，PUT 不设 Content-Type，返回 markdown 与页数', async () => {
  const zip = buildZip([
    { name: 'full.md', data: MD },
    { name: 'ovary_content_list.json', data: JSON.stringify(CONTENT_LIST) },
  ])
  const { fetchImpl, calls } = fakeMineru({ zipBuffer: zip })

  const result = await extractWithMineru(Buffer.from('%PDF-1.4 synthetic'), '.pdf', {
    token: 'fixture-token', filename: 'ovary.pdf', fetchImpl, intervalMs: 1,
  })

  assert.equal(result.markdown, MD)
  assert.equal(result.engine, 'mineru-api-pipeline')
  assert.equal(result.modelVersion, MINERU_MODEL_DEFAULT)
  assert.equal(result.pages, 4)

  // ① 申请链接时确实带了 model_version=pipeline
  const batch = calls.find((c) => c.url.endsWith('/file-urls/batch'))
  assert.equal(JSON.parse(batch.body).model_version, 'pipeline')
  // ② 上传不带 Content-Type（MinerU 的上传端点了名不要它）
  const upload = calls.find((c) => c.method === 'PUT')
  assert.equal(upload.headers['Content-Type'], undefined)
  assert.match(upload.headers.Authorization, /^Bearer fixture-token$/)
})

test('② 批次没给 total_pages 时，页数从 content_list 的 page_idx 上限推', async () => {
  const zip = buildZip([
    { name: 'full.md', data: MD },
    { name: 'ovary_content_list.json', data: JSON.stringify(CONTENT_LIST) },
  ])
  const { fetchImpl } = fakeMineru({ zipBuffer: zip, withProgress: false })
  const result = await extractWithMineru(Buffer.from('%PDF-1.4'), '.pdf', { token: 't', fetchImpl, intervalMs: 1 })
  assert.equal(result.pages, 2) // page_idx 0/1 → 2 页
})

/* ---------------- Token ---------------- */

test('③ Token 优先级：显式 > .secrets/mineru.json > 环境变量；都没有就 NO_TOKEN', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ovarian-mineru-'))
  const secret = join(dir, 'mineru.json')
  writeFileSync(secret, JSON.stringify({ token: 'sk-from-file' }))

  assert.deepEqual(resolveToken({ token: 'sk-explicit', env: { MINERU_TOKEN: 'sk-env' }, secretFile: secret }), { token: 'sk-explicit', source: 'explicit' })
  // 文件优先（2026-10-22 统一口径）：两者都在时用文件里那把
  assert.deepEqual(resolveToken({ env: { MINERU_TOKEN: 'sk-env' }, secretFile: secret }), { token: 'sk-from-file', source: '.secrets/mineru.json' })
  // env 只在文件缺失时兜底
  assert.deepEqual(resolveToken({ env: { MINERU_TOKEN: 'sk-env' }, secretFile: join(dir, 'nope.json') }), { token: 'sk-env', source: 'env:MINERU_TOKEN' })

  assert.throws(() => resolveToken({ env: {}, secretFile: join(dir, 'nope.json') }), (error) => {
    assert.equal(error.code, 'NO_TOKEN')
    assert.match(error.message, /MINERU_TOKEN/)
    return true
  })
  rmSync(dir, { recursive: true, force: true })
})

test('④ 掩码：只露四位与两位，完整 key 不出现在错误里', async () => {
  assert.equal(maskToken('sk-1234567890abcdef'), 'sk-1****ef')
  const secret = 'sk-must-not-leak-9f8e7d'
  const { fetchImpl } = fakeMineru({ zipBuffer: Buffer.alloc(0), states: ['failed'], failWith: 'bad file' })
  const client = new MineruClient({ token: secret, fetchImpl })
  await assert.rejects(
    () => client.parse({ bytes: Buffer.from('x'), filename: 'a.pdf', intervalMs: 1 }),
    (error) => {
      assert.equal(error.code, 'TASK_FAILED')
      assert.equal(JSON.stringify(error.detail ?? {}).includes(secret), false)
      assert.equal(String(error.message).includes(secret), false)
      return true
    },
  )
})

/* ---------------- 出错：不糊弄 ---------------- */

test('⑤ 401 直接判 UNAUTHORIZED，错误里带申请链接、不带 token，且不降级到 Flash', async () => {
  const token = 'sk-expired-fixture'
  const fetchImpl = async () => ({ ok: false, status: 401, json: async () => ({ code: -10001, msg: 'user token expired' }) })
  const client = new MineruClient({ token, fetchImpl })
  await assert.rejects(
    () => client.parse({ bytes: Buffer.from('x'), filename: 'a.pdf' }),
    (error) => {
      assert.equal(error.code, 'UNAUTHORIZED')
      assert.match(error.message, /mineru\.net\/apiManage\/token/)
      assert.equal(error.message.includes(token), false)
      assert.equal(error.message.includes('Flash'), false)
      return true
    },
  )
})

test('⑥ 模型参数被拒才回退 vlm；文件本身失败不重试', async () => {
  const zip = buildZip([{ name: 'full.md', data: MD }])
  const { fetchImpl, calls } = fakeMineru({ zipBuffer: zip, rejectModel: true })
  const result = await extractWithMineru(Buffer.from('%PDF'), '.pdf', { token: 't', fetchImpl, intervalMs: 1 })

  assert.equal(result.modelVersion, MINERU_MODEL_FALLBACK)
  assert.equal(result.engine, 'mineru-api-vlm')
  assert.equal(calls.filter((c) => c.url.endsWith('/file-urls/batch')).length, 2)

  assert.equal(modelFallbackWorthy(new MineruError('TASK_FAILED', 'model 不支持')), false)
  assert.equal(modelFallbackWorthy(new MineruError('API_ERROR', 'model_version is not supported')), true)
})

test('⑦ ZIP 里没有 full.md 就是失败，不返回半份结果', async () => {
  const { fetchImpl } = fakeMineru({ zipBuffer: buildZip([{ name: 'other.md', data: 'x' }]) })
  await assert.rejects(
    () => extractWithMineru(Buffer.from('%PDF'), '.pdf', { token: 't', fetchImpl, intervalMs: 1 }),
    (error) => {
      assert.equal(error.code, 'NO_MARKDOWN')
      assert.equal(error.markdown, undefined)
      return true
    },
  )
})

test('⑧ 不支持的类型 / 超限：本地先挡，不花额度', async () => {
  let called = false
  const fetchImpl = async () => { called = true; throw new Error('不该发请求') }
  await assert.rejects(() => extractWithMineru(Buffer.from('x'), '.html', { token: 't', fetchImpl }), { code: 'BAD_INPUT' })
  const big = Buffer.alloc(200 * 1024 * 1024 + 1)
  await assert.rejects(() => extractWithMineru(big, '.pdf', { token: 't', fetchImpl }), { code: 'BAD_INPUT' })
  assert.equal(called, false)
})

test('⑨ ZIP 读取器能吃自己造的包（防 zip 实现与测试一起错）', () => {
  const zip = readZip(buildZip([{ name: 'full.md', data: MD }, { name: 'a/b.json', data: '{"a":1}' }]))
  assert.deepEqual(zip.names.sort(), ['a/b.json', 'full.md'])
  assert.equal(zip.text('full.md'), MD)
  assert.equal(zip.has('b.json'), true, '按后缀匹配，zip 里多一层目录也要能找到')
})
