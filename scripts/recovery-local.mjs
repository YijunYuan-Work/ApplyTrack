import { spawnSync, spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { createHash } from 'node:crypto'

export const root = fileURLToPath(new URL('../', import.meta.url))
export const sandbox = path.join(root, '.temp/recovery-sandbox')
export const projectId = `applytrack-recovery-pr6-${createHash('sha256').update(path.resolve(root)).digest('hex').slice(0, 8)}`
export const dbContainer = `supabase_db_${projectId}`
const cliExecutable = process.platform === 'win32' ? 'npx.cmd' : 'npx'
const cliArgs = ['--yes', 'supabase@2.120.0']

function command(args) {
  const fullArgs = [...cliArgs, ...args, '--workdir', sandbox]
  if (process.platform !== 'win32') return [cliExecutable, fullArgs]
  // Quote each PowerShell literal; never pass unescaped args through cmd.exe.
  const quote = (value) => `'${value.replaceAll("'", "''")}'`
  return ['powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
    `& ${[cliExecutable, ...fullArgs].map(quote).join(' ')}; exit $LASTEXITCODE`]]
}

export function assertSandboxOwnership() {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const listed = spawnSync('docker', ['ps', '-aq', '--filter',
      `name=_${projectId}$`], { encoding: 'utf8' })
    if (listed.error || listed.status !== 0) throw new Error('Cannot inspect local Docker Sandbox ownership.')
    const ids = listed.stdout.trim().split(/\s+/).filter(Boolean)
    if (!ids.length) return false
    const inspection = spawnSync('docker', ['inspect', ...ids], { encoding: 'utf8' })
    if (inspection.status !== 0) {
      // CLI startup may replace a runtime container between listing and inspection.
      if (attempt < 2 && /No such (object|container)/i.test(inspection.stderr)) continue
      throw new Error(`Cannot inspect recovery Sandbox containers: ${inspection.error?.message || inspection.stderr}`)
    }
    for (const container of JSON.parse(inspection.stdout)) {
      const workdir = container.Config.Labels?.['com.supabase.cli.workdir']
      if (container.Config.Labels?.['com.supabase.cli.project'] !== projectId ||
        !workdir || path.resolve(workdir) !== path.resolve(sandbox)) {
        throw new Error('Refusing to operate a Supabase container owned by another working directory.')
      }
    }
    return true
  }
}

export function cli(args) {
  const operation = args.slice(0, 2).join(' ')
  if (!(args[0] === 'start' || args[0] === 'stop' || args[0] === 'status' ||
    ['db reset', 'db lint'].includes(operation)) ||
    args.some((arg) => /^--(all|linked|db-url|project-ref|project-id|no-backup)(=|$)/.test(arg)) ||
    (args[0] === 'db' && !args.includes('--local'))) {
    throw new Error('Only isolated local Supabase lifecycle commands are allowed.')
  }
  assertSandboxOwnership()
  const [executable, parameters] = command(args)
  const result = spawnSync(executable, parameters, {
    cwd: root,
    encoding: 'utf8',
    timeout: 300_000,
    maxBuffer: 8 * 1024 * 1024,
  })
  if (result.error || result.status !== 0) {
    throw new Error(`Local Supabase command failed (${args[0]}): ${result.error?.message || result.stderr}`)
  }
  return result
}

export function serveFunctions(envFile) {
  assertSandboxOwnership()
  const [executable, parameters] = command(['functions', 'serve', '--env-file', envFile])
  return spawn(executable, parameters, { cwd: root, stdio: 'pipe' })
}

export function sql(query) {
  assertSandboxOwnership()
  const result = spawnSync('docker', ['exec', '-i', dbContainer, 'psql', '-U', 'postgres',
    '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-Atq'], {
    cwd: root, input: query, encoding: 'utf8', timeout: 30_000,
  })
  if (result.error || result.status !== 0) throw new Error(result.error?.message || result.stderr)
  return result.stdout.trim()
}

export function localStatus() {
  const status = JSON.parse(cli(['status', '-o', 'json']).stdout)
  const url = new URL(status.API_URL)
  if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1') {
    throw new Error('Integration tests require the isolated loopback Supabase API.')
  }
  if (process.platform === 'linux') {
    const inspection = spawnSync('docker', ['inspect', dbContainer], { encoding: 'utf8' })
    if (inspection.status !== 0) throw new Error('Cannot inspect the isolated database network.')
    const networks = Object.values(JSON.parse(inspection.stdout)[0].NetworkSettings.Networks)
    status.MAIL_HOST = networks[0]?.Gateway
    if (!status.MAIL_HOST) throw new Error('Local Docker bridge gateway is unavailable.')
  } else {
    status.MAIL_HOST = 'host.docker.internal'
  }
  return status
}
