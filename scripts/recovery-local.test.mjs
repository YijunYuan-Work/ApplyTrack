import assert from 'node:assert/strict'
import test from 'node:test'
import path from 'node:path'
import { cli, root, sandbox, projectId } from './recovery-local.mjs'

test('recovery Sandbox stays in this checkout with a path-specific project identity', () => {
  assert.equal(sandbox, path.join(root, '.temp/recovery-sandbox'))
  assert.match(projectId, /^applytrack-recovery-pr6-[a-f0-9]{8}$/)
})

test('local recovery runner rejects deployment, remote DBs and broad cleanup before invoking Docker', () => {
  for (const args of [
    ['functions', 'deploy', 'request-password-reset'], ['db', 'push'],
    ['db', 'reset'], ['db', 'reset', '--local', '--linked'],
    ['db', 'reset', '--local', '--db-url=postgres://remote.example/db'],
    ['stop', '--all'], ['stop', '--project-id', 'another-project'],
    ['stop', '--project-id=another-project'], ['stop', '--no-backup'],
  ]) {
    assert.throws(() => cli(args), /Only isolated local Supabase lifecycle commands are allowed/)
  }
})
