\set ON_ERROR_STOP on
insert into public.job_leads(id,user_id,source,external_id,title,company,location,apply_url,salary_min,salary_max)
values (9400,'00000000-0000-4000-8000-000000000001','linkedin','9400','RF06 first conversion','Synthetic','Toronto','https://example.invalid/9400',90000,120000);
create temporary table rf06_snapshot(application jsonb, lead_updated_at timestamptz);
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);
select public.audit_assert((select applied_date='2026-10-01' and company='Synthetic' and role='RF06 first conversion'
  and location='Toronto' and status='Applied' and salary='90000 - 120000'
  from public.complete_job_lead_application(9400,'2026-10-01')),'RF-06: first conversion retains application mapping and date');
reset role;
insert into rf06_snapshot select to_jsonb(a),l.updated_at from public.job_leads l join public.applications a on a.id=l.application_id where l.id=9400;
grant select on rf06_snapshot to authenticated;
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);
select public.audit_assert(to_jsonb(public.complete_job_lead_application(9400,'2027-01-01'))=(select application from rf06_snapshot),'RF-06: repeated conversion returns unchanged application');
select public.audit_assert((select l.state='applied' and l.updated_at=s.lead_updated_at from public.job_leads l cross join rf06_snapshot s where l.id=9400),'RF-06: already Applied retry does not rewrite lead');
reset role;
-- User edits after submission must survive state repair, including notes and status.
update public.applications set notes='Personal notes',status='Interview',interview_count=2,applied_date='2026-09-30',last_updated='2026-10-02'
  where id=(select application_id from public.job_leads where id=9400);
truncate rf06_snapshot;
insert into rf06_snapshot select to_jsonb(a),l.updated_at from public.job_leads l join public.applications a on a.id=l.application_id where l.id=9400;
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);
do $$
declare stale_state text;
begin
  foreach stale_state in array array['new','expired'] loop
    update public.job_leads set state=stale_state where id=9400;
    perform public.audit_assert(to_jsonb(public.complete_job_lead_application(9400,'2027-05-01'))=(select application from rf06_snapshot),'RF-06: linked retry preserves entire edited application');
    perform public.audit_assert((select state='applied' and application_id=(s.application->>'id')::bigint from public.job_leads cross join rf06_snapshot s where id=9400),'RF-06: valid linked New/Expired lead is repaired to Applied');
  end loop;
end;
$$;
select public.audit_assert((select count(*) from public.applications where role='RF06 first conversion')=1,'RF-06: repair creates no duplicate application');
update public.job_leads set state='new' where id=9400;
reset role;
-- A failed repair cannot be acknowledged as a successful conversion.
create function public.audit_rf06_fail_repair() returns trigger language plpgsql as $$
begin if NEW.id=9400 and NEW.state='applied' then raise exception 'Synthetic RF06 repair failure'; end if; return NEW; end;
$$;
create trigger audit_rf06_fail_repair before update on public.job_leads for each row execute function public.audit_rf06_fail_repair();
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);
do $$ begin
  begin
    perform public.complete_job_lead_application(9400,'2027-05-01');
    raise exception 'Repair failure was acknowledged';
  exception when others then if sqlerrm <> 'Synthetic RF06 repair failure' then raise; end if; end;
end; $$;
select public.audit_assert((select state='new' from public.job_leads where id=9400),'RF-06: failed repair rolls back state');
select public.audit_assert((select to_jsonb(a)=s.application from public.applications a cross join rf06_snapshot s where a.id=(s.application->>'id')::bigint),'RF-06: failed repair preserves application data');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',false);
do $$ begin
  begin
    perform public.complete_job_lead_application(9400,'2027-05-01');
    raise exception 'Cross-user repair was allowed';
  exception when others then if sqlerrm <> 'Job lead not found.' then raise; end if; end;
end; $$;
reset role;
select public.audit_assert((select state='new' from public.job_leads where id=9400),'RF-06: cross-user retry cannot repair or read another owner lead');
drop trigger audit_rf06_fail_repair on public.job_leads;
drop function public.audit_rf06_fail_repair();
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);
select public.audit_assert(to_jsonb(public.complete_job_lead_application(9400,null))=(select application from rf06_snapshot),'RF-06: retry after failed repair succeeds without changing original date');
reset role;
drop table rf06_snapshot;
