\set ON_ERROR_STOP on
create function public.audit_assert(ok boolean, label text) returns void language plpgsql as $$ begin if ok is not true then raise exception 'FAIL: %', label; end if; raise notice 'PASS: %', label; end $$;
grant execute on function public.audit_assert(boolean, text) to authenticated, anon;
insert into auth.users(id) values ('00000000-0000-4000-8000-000000000001'), ('00000000-0000-4000-8000-000000000002');
insert into public.applications(id,user_id,company,role,notes) values
 (101,'00000000-0000-4000-8000-000000000001','Owner A','Engineer',''),
 (102,'00000000-0000-4000-8000-000000000002','Owner B','Engineer','');
insert into public.job_leads(id,user_id,source,external_id,title,company) values
 (201,'00000000-0000-4000-8000-000000000001','linkedin','201','Engineer','Owner A'),
 (202,'00000000-0000-4000-8000-000000000002','indeed','202','Engineer','Owner B'),
 (203,'00000000-0000-4000-8000-000000000001','linkedin','203','Concurrency','Owner A');
select public.audit_assert(not has_function_privilege('anon','public.complete_job_lead_application(bigint,date)','EXECUTE'),'RPC denies anon');
select public.audit_assert(has_function_privilege('authenticated','public.complete_job_lead_application(bigint,date)','EXECUTE'),'RPC allows authenticated');
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);
select public.audit_assert((select count(*) from public.applications)=1,'applications SELECT RLS hides other owner');
select public.audit_assert((select count(*) from public.job_leads)=2,'leads SELECT RLS hides other owner');
do $$ begin
  begin
    insert into public.applications(user_id,company,role) values ('00000000-0000-4000-8000-000000000002','Forbidden','Forbidden');
    raise exception 'cross-owner INSERT was allowed';
  exception when insufficient_privilege then raise notice 'PASS: cross-owner INSERT denied'; end;
end $$;
do $$ begin
  begin
    perform public.complete_job_lead_application(202,'2026-12-31');
    raise exception 'cross-owner RPC was allowed';
  exception when others then if sqlerrm not like '%not found%' then raise; end if; raise notice 'PASS: cross-owner RPC denied'; end;
end $$;
do $$ begin
  begin
    update public.job_leads set title='Forbidden' where id=201;
    raise exception 'descriptive column UPDATE was allowed';
  exception when insufficient_privilege then raise notice 'PASS: lead descriptive column UPDATE denied'; end;
end $$;
select public.audit_assert((select id from public.complete_job_lead_application(201,'2026-12-31'))=(select id from public.complete_job_lead_application(201,'2027-01-01')),'RPC repeated conversion returns same application');
select public.audit_assert((select state from public.job_leads where id=201)='applied','RPC persists applied state');
select public.audit_assert((select applied_date from public.applications where company='Owner A' and id<>101)='2026-12-31','RPC preserves initial application date across retry');
-- F01 regression: referenced-row RLS is not a substitute for an owner-aware FK.
do $$ begin
  begin
    update public.job_leads set application_id=102 where id=203;
    raise exception 'cross-owner association was allowed';
  exception when foreign_key_violation then raise notice 'PASS: owned lead rejects cross-owner application_id'; end;
end $$;
update public.job_leads set application_id=101 where id=203;
select public.audit_assert((select application_id from public.job_leads where id=203)=101,'owned lead accepts same-owner application_id');
update public.job_leads set application_id=null where id=203;
select public.audit_assert((select application_id from public.job_leads where id=203) is null,'owned lead allows NULL application_id');
update public.job_leads set state='expired', application_id=101 where id=202;
reset role;
select public.audit_assert((select state='new' and application_id is null from public.job_leads where id=202),'other-owner lead UPDATE affects zero rows');
set role authenticated;
insert into public.applications(user_id,company,role,notes,status,interview_count) values ('00000000-0000-4000-8000-000000000001','  ','  ',null,'Unrecognized',-3);
select public.audit_assert(exists(select 1 from public.applications where notes is null and interview_count=-3),'schema permits null notes, whitespace names and negative counts');
insert into storage.objects(bucket_id,name) values ('resumes','00000000-0000-4000-8000-000000000001/synthetic.txt');
select public.audit_assert((select count(*) from storage.objects)=1,'Storage owner prefix insert/read works');
do $$ begin
  begin
    insert into storage.objects(bucket_id,name) values ('resumes','00000000-0000-4000-8000-000000000002/forbidden.txt');
    raise exception 'cross-owner Storage INSERT allowed';
  exception when insufficient_privilege then raise notice 'PASS: cross-owner Storage INSERT denied'; end;
end $$;
delete from public.applications where id=102;
select public.audit_assert(not exists(select 1 from public.applications where id=102),'other-owner DELETE affects zero visible rows');
reset role;
select public.audit_assert(exists(select 1 from public.applications where id=102),'other-owner DELETE preserves real row');
