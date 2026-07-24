revoke all on public.job_agent_profiles from anon, authenticated;
revoke all on public.resumes from anon, authenticated;
revoke all on public.job_searches from anon, authenticated;
revoke all on public.job_scan_runs from anon, authenticated;
revoke all on public.job_leads from anon, authenticated;

revoke all on sequence public.job_agent_profiles_id_seq from anon, authenticated;
revoke all on sequence public.resumes_id_seq from anon, authenticated;
revoke all on sequence public.job_searches_id_seq from anon, authenticated;
revoke all on sequence public.job_scan_runs_id_seq from anon, authenticated;
revoke all on sequence public.job_leads_id_seq from anon, authenticated;

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.job_agent_profiles to authenticated;
grant select, insert, update, delete on public.resumes to authenticated;
grant select, insert, update, delete on public.job_searches to authenticated;
grant select on public.job_scan_runs to authenticated;
grant select on public.job_leads to authenticated;
grant update (state) on public.job_leads to authenticated;
grant usage, select on sequence public.job_agent_profiles_id_seq to authenticated;
grant usage, select on sequence public.resumes_id_seq to authenticated;
grant usage, select on sequence public.job_searches_id_seq to authenticated;
