import { mkdir, readFile, writeFile, cp, readdir } from 'node:fs/promises'
import path from 'node:path'
import { createServer } from 'node:net'
import { root, sandbox, projectId, assertSandboxOwnership } from './recovery-local.mjs'

const existingSandbox = assertSandboxOwnership()
const supabase = path.join(sandbox, 'supabase')
let basePort
try {
  const previous = JSON.parse(await readFile(path.join(sandbox, 'test-config.json'), 'utf8'))
  if (existingSandbox && Number.isInteger(previous.basePort) && previous.basePort >= 18320 && previous.basePort < 19320) {
    basePort = previous.basePort
  }
} catch (error) {
  if (error.code !== 'ENOENT') throw error
}
for (let candidate = 18320; !basePort && candidate < 19320; candidate += 20) {
  const listeners = []
  try {
    for (let offset = 0; offset <= 10; offset += 1) {
      const listener = createServer()
      await new Promise((resolve, reject) => {
        listener.once('error', reject)
        listener.listen(candidate + offset, '0.0.0.0', resolve)
      })
      listeners.push(listener)
    }
    basePort = candidate
    break
  } catch {
    // Occupied and Windows-reserved ports are both unsuitable for Docker.
  } finally {
    for (const listener of listeners) await new Promise((resolve) => listener.close(resolve))
  }
}
if (!basePort) throw new Error('No free port block found for the recovery Sandbox.')
await mkdir(path.join(supabase, 'migrations'), { recursive: true })

// The original applications schema predates this repository's migration history.
// Bootstrap that documented prerequisite only in the disposable local database.
const schema = await readFile(path.join(root, 'supabase/schema.sql'), 'utf8')
const marker = '-- Job Agent phases 1-4:'
if (!schema.includes(marker)) throw new Error('Legacy applications schema marker is missing.')
await writeFile(path.join(supabase, 'migrations/00000000000000_legacy_test_bootstrap.sql'),
  schema.slice(0, schema.indexOf(marker)))
for (const file of await readdir(path.join(root, 'supabase/migrations'))) {
  if (file.endsWith('.sql')) {
    await cp(path.join(root, 'supabase/migrations', file), path.join(supabase, 'migrations', file))
  }
}
for (const directory of ['_shared', 'request-password-reset']) {
  await cp(path.join(root, 'supabase/functions', directory), path.join(supabase, 'functions', directory), {
    recursive: true,
    filter: (source) => !path.basename(source).startsWith('.env') && !source.endsWith('.test.ts'),
  })
}
await mkdir(path.join(supabase, 'functions/recovery-integration'), { recursive: true })
const testEntrypoint = await readFile(path.join(root, 'tests/integration/recovery-edge-entrypoint.ts'), 'utf8')
await writeFile(path.join(supabase, 'functions/recovery-integration/index.ts'),
  testEntrypoint.replace('../../supabase/functions/request-password-reset/', '../request-password-reset/'))
await writeFile(path.join(supabase, 'config.toml'), `project_id = "${projectId}"

[api]
enabled = true
port = ${basePort + 1}
schemas = ["public", "graphql_public"]
extra_search_path = ["public", "extensions"]
max_rows = 1000

[db]
port = ${basePort + 2}
shadow_port = ${basePort}
major_version = 17

[db.seed]
enabled = false

[db.pooler]
enabled = false
port = ${basePort + 9}

[studio]
enabled = false
port = ${basePort + 3}

[local_smtp]
enabled = true
port = ${basePort + 4}

[analytics]
enabled = false
port = ${basePort + 7}

[auth]
enabled = true
site_url = "http://localhost:5173"
additional_redirect_urls = ["http://localhost:5173/?recovery=1", "http://127.0.0.1:5173/?recovery=1"]

[auth.email]
enable_confirmations = false

[edge_runtime]
enabled = true
inspector_port = ${basePort + 8}

[functions.request-password-reset]
verify_jwt = false

[functions.recovery-integration]
verify_jwt = false
`)
await writeFile(path.join(sandbox, 'test-config.json'), JSON.stringify({ basePort }))
console.log(`Prepared unlinked recovery Sandbox under .temp/recovery-sandbox (ports ${basePort}-${basePort + 10}).`)
