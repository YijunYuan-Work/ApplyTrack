do $$
declare
  scheduled_job_id bigint;
begin
  select jobid
  into scheduled_job_id
  from cron.job
  where jobname = 'applytrack-discover-jobs-every-three-hours';

  if scheduled_job_id is not null then
    perform cron.unschedule(scheduled_job_id);
  end if;
exception
  when undefined_table or invalid_schema_name then null;
end;
$$;

do $$
begin
  delete from vault.secrets
  where name in (
    'job_agent_project_url',
    'job_agent_publishable_key',
    'job_agent_cron_secret'
  );
exception
  when undefined_table or invalid_schema_name then null;
end;
$$;

delete from public.job_leads
where source = 'adzuna';

drop table if exists public.job_scan_runs;

alter table public.job_searches
  drop constraint if exists job_searches_source_check,
  drop column if exists source,
  drop column if exists last_scanned_at,
  drop column if exists next_scan_at;

alter table public.job_leads
  drop constraint if exists job_leads_source_check;
alter table public.job_leads
  add constraint job_leads_source_check
  check (source in ('linkedin', 'indeed'));
