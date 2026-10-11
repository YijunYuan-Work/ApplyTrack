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
function MigrationMustFail([string]$text, [string]$database, [string]$expected = 'RF-04 blocked: 1 invalid Job Lead/Application associations; no data repaired') {
  $output = $text | docker exec -i $name psql -U supabase_admin -d $database -v ON_ERROR_STOP=1 2>&1
  if ($LASTEXITCODE -eq 0 -or "$output" -notmatch [regex]::Escape($expected)) {
    throw "Expected RF-04 legacy-integrity rejection, got: $output"
  }
  Write-Output "PASS: $database migration rejects invalid baseline without repair"
}
function ConcurrentConversion([string]$database) {
  $jobs = @()
  Sql 'create table public.audit_conversion_gate(released boolean not null); insert into public.audit_conversion_gate values(false);' $database
  $barrierSql = Get-Content -Raw (Join-Path $PSScriptRoot 'conversion-barrier.sql')
  $barrier = Start-Job -ArgumentList $name, $database, $barrierSql -ScriptBlock {
    param($container, $db, $statement)
    $statement | docker exec -i $container psql -U supabase_admin -d $db -v ON_ERROR_STOP=1
    if ($LASTEXITCODE -ne 0) { throw 'RPC overlap barrier failed.' }
  }
  try {
    $deadline = [datetime]::UtcNow.AddSeconds(25)
    do {
      $ready = docker exec $name psql -U supabase_admin -d $database -Atc "select exists(select 1 from pg_stat_activity where application_name='rf04-conversion-barrier' and datname=current_database() and wait_event='PgSleep');"
      if ($LASTEXITCODE -ne 0) { throw 'RPC barrier synchronization query failed.' }
      if ($ready -eq 't') { break }
      if ([datetime]::UtcNow -gt $deadline -or $barrier.State -ne 'Running') { throw 'RPC barrier did not acquire its lead lock.' }
      Start-Sleep -Milliseconds 100
    } while ($true)
    $jobs = 1..8 | ForEach-Object {
      Start-Job -ArgumentList $name, $database, $_ -ScriptBlock {
        param($container, $db, $session)
        docker exec $container psql -U supabase_admin -d $db -v ON_ERROR_STOP=1 -Atc "set statement_timeout='30s'; set application_name='rf04-convert-$session'; set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false); select id from public.complete_job_lead_application(203,'2026-12-31');"
        if ($LASTEXITCODE -ne 0) { throw 'Concurrent RPC failed.' }
      }
    }
    do {
      $waiting = docker exec $name psql -U supabase_admin -d $database -Atc "select count(*) from pg_stat_activity where application_name like 'rf04-convert-%' and datname=current_database() and wait_event_type='Lock';"
      if ($LASTEXITCODE -ne 0) { throw 'Concurrent RPC lock query failed.' }
      if ($waiting -eq '8') { break }
      if ([datetime]::UtcNow -gt $deadline -or $jobs.State -contains 'Failed') { throw 'Eight RPC sessions did not overlap at the lead lock.' }
      Start-Sleep -Milliseconds 100
    } while ($true)
    Write-Output 'PASS: eight independent conversion sessions overlap while waiting for the same lead'
    Sql 'update public.audit_conversion_gate set released=true;' $database
    $barrier | Wait-Job | Receive-Job
    if ($barrier.State -eq 'Failed') { throw 'RPC barrier session failed.' }
    $jobs | Wait-Job | Out-Null
    $jobs | Receive-Job
    if ($jobs.State -contains 'Failed') { throw 'Concurrent sessions failed.' }
    Sql "select public.audit_assert((select count(*) from public.applications where role='Concurrency')=1,'eight concurrent RPC calls create exactly one application'); select public.audit_assert((select l.state='applied' and l.user_id=a.user_id from public.job_leads l join public.applications a on a.id=l.application_id where l.id=203),'concurrent conversion persists same-owner link');" $database
    Sql "update public.job_leads set state='new' where id=203; set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false); select id from public.complete_job_lead_application(203,'2026-12-31'); select public.audit_assert((select state from public.job_leads where id=203)='new','BUG: RPC retry does not repair stale new state with existing application'); reset role;" $database
  } finally {
    Sql 'update public.audit_conversion_gate set released=true;' $database
    if ($jobs.Count) { $jobs | Stop-Job; $jobs | Remove-Job }
    $barrier | Stop-Job; $barrier | Remove-Job
  }
}
function OwnershipRace([string]$database, [string]$tag, [string]$first, [string]$second) {
  $job = Start-Job -ArgumentList $name, $database, $tag, $first -ScriptBlock {
    param($container, $db, $applicationName, $statement)
    docker exec $container psql -U supabase_admin -d $db -v ON_ERROR_STOP=1 -Atc "set statement_timeout='20s'; set application_name='$applicationName'; set role service_role; begin; $statement; select pg_sleep(4); commit;"
    if ($LASTEXITCODE -ne 0) { throw 'First ownership-race transaction failed.' }
  }
  try {
    $ready = $false
    for ($i=0; $i -lt 100; $i++) {
      $sleeping = docker exec $name psql -U supabase_admin -d $database -Atc "select exists(select 1 from pg_stat_activity where application_name='$tag' and wait_event='PgSleep');"
      if ($LASTEXITCODE -ne 0) { throw 'Race synchronization query failed.' }
      if ($sleeping -eq 't') { $ready=$true; break }
      if ($job.State -ne 'Running') { break }
      Start-Sleep -Milliseconds 100
    }
    if (-not $ready) { throw 'Ownership-race transaction did not reach its lock-holding barrier.' }
    Sql "set statement_timeout='20s'; set role service_role; $second; reset role;" $database
    $job | Wait-Job | Receive-Job
    if ($job.State -eq 'Failed') { throw 'Ownership-race session failed.' }
  } finally { $job | Stop-Job; $job | Remove-Job }
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
  Sql (Get-Content -Raw (Join-Path $PSScriptRoot 'ownership.sql'))
  ConcurrentConversion 'postgres'
  # Replay the nine historical migrations on a separate database with the documented application baseline.
  Sql 'create database replay;'
  Sql 'create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql as $$ select nullif(current_setting(''request.jwt.claim.sub'',true),'''')::uuid $$; create schema storage; create role audit_unused nologin;' 'replay'
  Sql (Get-Content -Raw (Join-Path $PSScriptRoot 'bootstrap.sql')) 'replay'
  $schema = Get-Content -Raw (Join-Path $root 'supabase/schema.sql')
  Sql ($schema.Substring(0,$schema.IndexOf('-- Job Agent phases'))) 'replay'
  # Restore the original application baseline before replaying historical migrations.
  Sql 'alter table public.applications drop constraint applications_user_id_id_key;' 'replay'
  $ownershipMigration = '20261011042500_job_lead_ownership_integrity.sql'
  foreach ($file in (Get-ChildItem -LiteralPath (Join-Path $root 'supabase/migrations') -Filter '*.sql' | Sort-Object Name)) {
    if ($file.Name -eq $ownershipMigration) { continue }
    Sql (Get-Content -Raw -LiteralPath $file.FullName) 'replay'
    Write-Output "PASS: migration $($file.Name)"
  }
  Sql (Get-Content -Raw (Join-Path $PSScriptRoot 'ownership-legacy.sql')) 'replay'
  Sql 'create database legacy_mismatch template replay; create database legacy_orphan template replay; create database legacy_nullable template replay;'
  $migration = Get-Content -Raw (Join-Path $root "supabase/migrations/$ownershipMigration")
  $snapshot = "truncate public.audit_legacy_snapshot; insert into public.audit_legacy_snapshot select 'application',id,to_jsonb(a) from public.applications a union all select 'lead',id,to_jsonb(l) from public.job_leads l;"
  Sql "insert into public.applications(id,user_id,company,role) values (603,'00000000-0000-4000-8000-000000000004','Mismatch','Mismatch'); update public.job_leads set application_id=603 where id=903; $snapshot" 'legacy_mismatch'
  MigrationMustFail $migration 'legacy_mismatch'
  Sql (Get-Content -Raw (Join-Path $PSScriptRoot 'ownership-legacy-verify.sql')) 'legacy_mismatch'
  Sql (Get-Content -Raw (Join-Path $PSScriptRoot 'ownership-failure-verify.sql')) 'legacy_mismatch'
  Sql "alter table public.job_leads drop constraint job_leads_application_id_fkey; update public.job_leads set application_id=999999 where id=903; $snapshot" 'legacy_orphan'
  MigrationMustFail $migration 'legacy_orphan'
  Sql (Get-Content -Raw (Join-Path $PSScriptRoot 'ownership-legacy-verify.sql')) 'legacy_orphan'
  Sql 'alter table public.job_leads alter column user_id drop not null;' 'legacy_nullable'
  MigrationMustFail $migration 'legacy_nullable' 'RF-04 blocked: both owner columns must retain NOT NULL; no schema repaired.'
  Sql (Get-Content -Raw (Join-Path $PSScriptRoot 'ownership-legacy-verify.sql')) 'legacy_nullable'
  Sql (Get-Content -Raw (Join-Path $PSScriptRoot 'ownership-failure-verify.sql')) 'legacy_nullable'
  Sql $migration 'replay'
  Write-Output "PASS: migration $ownershipMigration"
  Sql (Get-Content -Raw (Join-Path $PSScriptRoot 'ownership-legacy-verify.sql')) 'replay'
  Sql (Get-Content -Raw (Join-Path $PSScriptRoot 'assertions.sql')) 'replay'
  Sql (Get-Content -Raw (Join-Path $PSScriptRoot 'ownership.sql')) 'replay'
  ConcurrentConversion 'replay'
  $catalog = "select jsonb_agg(jsonb_build_object('name',conname,'definition',pg_get_constraintdef(oid),'validated',convalidated) order by conname) from pg_constraint where conname in ('applications_user_id_id_key','job_leads_application_owner_fkey','job_leads_application_id_key');"
  $fresh = Sql $catalog
  $incremental = Sql $catalog 'replay'
  if (($fresh -join "`n") -ne ($incremental -join "`n")) { throw 'Fresh/incremental ownership constraint definitions differ.' }
  Write-Output 'PASS: fresh schema and incremental migration ownership constraints are equivalent'
  foreach ($database in @('postgres','replay')) {
    Sql "insert into public.applications(id,user_id,company,role) values (980,'00000000-0000-4000-8000-000000000001','Race','Race parent first'),(981,'00000000-0000-4000-8000-000000000001','Race','Race lead first'); insert into public.job_leads(id,user_id,source,external_id,title,company) values (980,'00000000-0000-4000-8000-000000000001','linkedin','980','Race','Race'),(981,'00000000-0000-4000-8000-000000000001','linkedin','981','Race','Race');" $database
    OwnershipRace $database 'rf04-parent-first' "update public.applications set user_id='00000000-0000-4000-8000-000000000002' where id=980" "select public.audit_expect_owner_fk('update public.job_leads set application_id=980 where id=980','concurrent parent owner change rejects stale lead association')"
    OwnershipRace $database 'rf04-lead-first' 'update public.job_leads set application_id=981 where id=981' "select public.audit_expect_owner_fk('update public.applications set user_id=''00000000-0000-4000-8000-000000000002'' where id=981','concurrent lead association rejects parent owner change')"
    Sql "select public.audit_assert(not exists(select 1 from public.job_leads l left join public.applications a on a.id=l.application_id where l.application_id is not null and (a.id is null or a.user_id is distinct from l.user_id)),'same-owner invariant survives both concurrent owner-change schedules');" $database
  }
} finally {
  if ($created) {
    $label = docker inspect $name --format '{{index .Config.Labels "applytrack.audit"}}'
    if ($label -eq 'refinement02') { docker rm --force --volumes $name | Out-Null }
    else { throw 'Cleanup refused: unexpected container label.' }
  }
}
