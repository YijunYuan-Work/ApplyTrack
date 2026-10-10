import assert from 'node:assert/strict'
import test from 'node:test'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { cli, root, sandbox, projectId, stopFunctions } from './recovery-local.mjs'

test('recovery Sandbox stays in this checkout with a path-specific project identity', () => {
  assert.equal(sandbox, path.join(root, '.temp/recovery-sandbox'))
  assert.match(projectId, /^applytrack-recovery-pr6-[a-f0-9]{8}$/)
})

test('owned launcher and its child terminate without leaving output pipes open', { timeout: 10_000 }, async () => {
  const child = spawn(process.execPath, ['-e', `
    require('node:child_process').spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'inherit' });
    console.log('ready'); setInterval(() => {}, 1000);
  `], { stdio: 'pipe', detached: process.platform !== 'win32' })
  try {
    await new Promise((resolve, reject) => {
      child.once('error', reject)
      child.stdout.once('data', resolve)
    })
  } finally {
    await stopFunctions(child)
  }
  assert.equal(child.stdout.destroyed, true)
  assert.equal(child.stderr.destroyed, true)
  await stopFunctions(child)
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
