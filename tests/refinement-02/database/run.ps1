$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '../../..')).Path
if ($root -ne 'C:\Work\SideProject\ApplyTrack') { throw 'Run only inside the authorized ApplyTrack workspace.' }
$name = 'applytrack-audit-' + [guid]::NewGuid().ToString('N').Substring(0, 12)
$image = 'public.ecr.aws/supabase/postgres:17.6.1.166'
$created = $false
function Sql([string]$text, [string]$database = 'postgres') {
  $text | docker exec -i $name psql -U supabase_admin -d $database -v ON_ERROR_STOP=1
  if ($LASTEXITCODE -ne 0) { throw 'Isolated SQL audit failed.' }
}
try {
  docker info --format '{{.ServerVersion}}' *> $null
  if ($LASTEXITCODE -ne 0) { throw 'Docker daemon unavailable. Start Docker Desktop manually before running.' }
  docker image inspect $image *> $null
  if ($LASTEXITCODE -ne 0) { throw "Cached image missing. Explicitly pull $image before running." }
  docker run --detach --name $name --label applytrack.audit=refinement02 --network none --tmpfs /var/lib/postgresql/data --env POSTGRES_PASSWORD=synthetic-local-only $image postgres -D /var/lib/postgresql/data -c config_file=/etc/postgresql/postgresql.conf
  if ($LASTEXITCODE -ne 0) { throw 'Container creation failed.' }
  $created = $true
  $ready = $false
  for ($i=0; $i -lt 60; $i++) {
    docker exec $name pg_isready -U postgres *> $null
    if ($LASTEXITCODE -eq 0) { $ready=$true; break }
    Start-Sleep -Seconds 1
  }
  if (-not $ready) { throw 'Database readiness timed out.' }
  Sql (Get-Content -Raw (Join-Path $PSScriptRoot 'bootstrap.sql'))
  Sql (Get-Content -Raw (Join-Path $root 'supabase/schema.sql'))
  Sql (Get-Content -Raw (Join-Path $PSScriptRoot 'assertions.sql'))
  # Real concurrent sessions against one row-locking RPC; no host files/ports/volumes.
  $jobs = 1..8 | ForEach-Object {
    Start-Job -ArgumentList $name -ScriptBlock {
      param($container)
      docker exec $container psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -Atc "set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false); select id from public.complete_job_lead_application(203,'2026-12-31');"
      if ($LASTEXITCODE -ne 0) { throw 'Concurrent RPC failed.' }
    }
  }
  $jobs | Wait-Job | Out-Null
  $jobs | Receive-Job
  if ($jobs.State -contains 'Failed') { throw 'Concurrent sessions failed.' }
  $jobs | Remove-Job
  Sql "select public.audit_assert((select count(*) from public.applications where role='Concurrency')=1,'eight concurrent RPC calls create exactly one application');"
  Sql "update public.job_leads set state='new' where id=203; set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false); select id from public.complete_job_lead_application(203,'2026-12-31'); select public.audit_assert((select state from public.job_leads where id=203)='new','BUG: RPC retry does not repair stale new state with existing application'); reset role;"
  # Replay the nine historical migrations on a separate database with the documented application baseline.
  Sql 'create database replay;'
  Sql 'create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql as $$ select nullif(current_setting(''request.jwt.claim.sub'',true),'''')::uuid $$; create schema storage; create role audit_unused nologin;' 'replay'
  Sql (Get-Content -Raw (Join-Path $PSScriptRoot 'bootstrap.sql')) 'replay'
  $schema = Get-Content -Raw (Join-Path $root 'supabase/schema.sql')
  Sql ($schema.Substring(0,$schema.IndexOf('-- Job Agent phases'))) 'replay'
  foreach ($file in (Get-ChildItem -LiteralPath (Join-Path $root 'supabase/migrations') -Filter '*.sql' | Sort-Object Name)) {
    Sql (Get-Content -Raw -LiteralPath $file.FullName) 'replay'
    Write-Output "PASS: migration $($file.Name)"
  }
  Sql "select public.audit_assert((select count(*) from public.job_leads)=3,'synthetic row count unchanged by replay database');"
} finally {
  if ($created) {
    $label = docker inspect $name --format '{{index .Config.Labels "applytrack.audit"}}'
    if ($label -eq 'refinement02') { docker rm --force --volumes $name | Out-Null }
    else { throw 'Cleanup refused: unexpected container label.' }
  }
}
