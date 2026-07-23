alter function public.set_updated_at() set search_path = pg_catalog;

create index if not exists applications_user_id_idx
  on public.applications(user_id);

create index if not exists job_scan_runs_search_idx
  on public.job_scan_runs(job_search_id);
