import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))

test('peer ranges explicitly include both DSH Desktop RC compatibility branches', () => {
  for (const dependency of ['@deepseek-ai/dsh-client-connection', '@deepseek-ai/dsh-host-webserver', '@deepseek-ai/dsh-credentials']) {
    const range = pkg.peerDependencies[dependency]
    assert.ok(range, `${dependency} peer range exists`)
    assert.match(range, />=0\.1\.0-rc\.6\s+<0\.2\.0/)
    assert.match(range, />=0\.2\.0-rc\.2\s+<0\.3\.0-0/)
  }
})
