import { spawnSync } from 'node:child_process'
import { cli, root } from './recovery-local.mjs'

const prepared = spawnSync(process.execPath, ['scripts/prepare-recovery-sandbox.mjs'], {
  cwd: root, stdio: 'inherit',
})
if (prepared.status !== 0) process.exit(prepared.status || 1)

let exitCode
try {
  const started = cli(['start', '--exclude',
    'realtime,storage-api,imgproxy,postgres-meta,studio,logflare,vector,supavisor'])
  console.log(started.stderr.split('\n').filter((line) => /migration|schema|database|already running/i.test(line)).join('\n'))
  const reset = cli(['db', 'reset', '--local', '--no-seed'])
  console.log(reset.stderr.split('\n').filter((line) => /migration|schema|reset/i.test(line)).join('\n'))
  const test = spawnSync(process.execPath, ['--test', 'tests/integration/passwordRecovery.test.mjs'], {
    cwd: root, stdio: 'inherit', timeout: 240_000,
  })
  exitCode = test.status ?? 1
  if (exitCode === 0) {
    const lint = cli(['db', 'lint', '--local', '--schema', 'public', '--fail-on', 'error'])
    console.log(lint.stdout || lint.stderr)
  }
} finally {
  cli(['stop'])
  console.log('Stopped only the isolated recovery Sandbox; its local data remains in its own volumes.')
}
process.exitCode = exitCode
