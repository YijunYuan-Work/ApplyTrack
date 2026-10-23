select public.audit_assert(exists(select 1 from pg_attribute a
  where a.attrelid='public.applications'::regclass and a.attname='rejected_date'
  and a.atttypid='date'::regtype and not a.attnotnull and not a.atthasdef),
  'F08: date column is nullable and has no default');
begin;
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);
insert into public.applications(id,user_id,company,role,status,applied_date,last_updated)
values (995,'00000000-0000-4000-8000-000000000001','Unknown','Engineer','Rejected','2020-01-01','2026-01-09');
select public.audit_assert((select rejected_date is null from public.applications where id=995), 'F08: inserting Rejected does not infer history');
update public.applications set notes='Edited',salary='100000',last_updated='2026-01-10' where id=995;
select public.audit_assert((select rejected_date is null from public.applications where id=995), 'F08: unrelated edits retain unknown history');
insert into public.applications(id,user_id,company,role,status,rejected_date)
values (996,'00000000-0000-4000-8000-000000000001','Known','Engineer','Rejected','2024-02-29');
update public.applications set status='Applied',last_updated='2026-01-09' where id=996;
select public.audit_assert((select rejected_date='2024-02-29' from public.applications where id=996), 'F08: explicit date survives reopening');
update public.applications set status='Rejected',rejected_date='2026-01-10',last_updated='2026-01-10' where id=996;
select public.audit_assert((select rejected_date='2026-01-10' from public.applications where id=996), 'F08: owner can write transition date atomically with status');
do $$ begin
  begin
    update public.applications set rejected_date='2024-02-30' where id=996;
    raise exception 'invalid rejection date accepted';
  exception when datetime_field_overflow then raise notice 'PASS: F08 invalid Gregorian date rejected'; end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',false);
update public.applications set rejected_date='2026-01-11' where id=996;
select public.audit_assert(not exists(select 1 from public.applications where id in(995,996)), 'F08: cross-user SELECT remains denied');
reset role;
select public.audit_assert((select rejected_date='2026-01-10' from public.applications where id=996), 'F08: cross-user update cannot change date');
rollback;
