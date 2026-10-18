import test from 'node:test'
import assert from 'node:assert/strict'
import { access, readFile, stat } from 'node:fs/promises'
import { extractWithMineru } from '../dsh/mineru.js'

test('MinerU adapter writes a private temporary source and cleans it after OCR', async () => {
  let sourcePath
  let sourceMode
  let command
  const result = await extractWithMineru(Buffer.from('%PDF-1.4 synthetic'), '.pdf', {
    token: 'not-a-real-token-fixture',
    runner: async (args, token) => {
      command = args
      assert.equal(token, 'not-a-real-token-fixture')
      sourcePath = args[1]
      sourceMode = (await stat(sourcePath)).mode & 0o777
      assert.equal((await readFile(sourcePath)).toString(), '%PDF-1.4 synthetic')
      return { stdout: '# 转录草稿' }
    },
  })
  assert.equal(sourceMode, 0o600)
  assert.ok(command.includes('--ocr'))
  assert.equal(result.engine, 'mineru-api-pipeline')
  assert.equal(result.markdown, '# 转录草稿')
  await assert.rejects(access(sourcePath), { code: 'ENOENT' })
})

test('MinerU falls back to anonymous Flash extraction after shared-token rejection', async () => {
  const secret = 'fixture-token-that-must-not-appear'
  const calls = []
  const result = await extractWithMineru(Buffer.from('synthetic scan'), '.png', {
    token: secret,
    runner: async (args, token) => {
      calls.push({ args, token })
      if (calls.length === 1) throw new Error(`401 invalid token=${secret}`)
      return { stdout: 'OCR text' }
    },
  })
  assert.equal(calls.length, 2)
  assert.equal(calls[1].args[0], 'flash-extract')
  assert.equal(calls[1].token, undefined)
  assert.equal(result.engine, 'mineru-flash-fallback')
  assert.equal(JSON.stringify(result).includes(secret), false)
})
