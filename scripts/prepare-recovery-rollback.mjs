import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = fileURLToPath(new URL('../', import.meta.url))
const baseline = '3216007b7b952a980099355ae25f46a55ab1d294'
const expectedHash = '63b7f1fc1df6bf7290ec3c3707700eb81f1153292c9d9ef051c56f924083e110'
const relative = 'supabase/functions/request-password-reset/index.ts'
const destination = path.join(root, '.temp/release-prep/v39')

// This command only reconstructs reviewed public source locally. It never deploys.
const source = execFileSync('git', ['show', `${baseline}:${relative}`], {cwd: root})
const hash = createHash('sha256').update(source).digest('hex')
if (hash !== expectedHash) throw new Error('Pinned v39 source hash mismatch. Stop; do not overwrite the rollback artifact.')
execFileSync('git', ['check-ignore', '--quiet', path.join(destination, relative)], {cwd: root})
const files = [
  [relative, source],
  ['supabase/config.toml', Buffer.from('[functions.request-password-reset]\nverify_jwt = false\n')],
  ['manifest.json', Buffer.from(`${JSON.stringify({ projectRef: 'qotipygmwlovxklkexjb',
    originalVersion: 39, verifyJwt: false, baselineCommit: baseline,
    sourceSha256: hash, originalBundleSha256: '46398f223482754999e1aef1f2a749d4a95267ee88500e665b6d2328aa82933c',
  }, null, 2)}\n`)],
]
for (const [relativePath, bytes] of files) {
  const file = path.join(destination, relativePath)
  try {
    const existing = await readFile(file)
    if (!existing.equals(bytes)) throw new Error('Existing rollback artifact differs; refusing to overwrite it.')
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
    await mkdir(path.dirname(file), {recursive: true})
    await writeFile(file, bytes, {flag: 'wx', mode: 0o600})
  }
}
console.log(`Prepared only the local v39 rollback source: ${destination}`)
console.log(`Source SHA-256: ${hash}; no production request or deployment performed.`)
