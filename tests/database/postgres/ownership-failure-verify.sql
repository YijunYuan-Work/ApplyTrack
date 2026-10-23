do $$ begin
  if not exists(select 1 from pg_constraint
    where conrelid='public.job_leads'::regclass and conname='job_leads_application_id_fkey')
    or exists(select 1 from pg_constraint
      where conname in ('applications_user_id_id_key','job_leads_application_owner_fkey')) then
    raise exception 'FAIL: failed migration left partial DDL';
  end if;
  raise notice 'PASS: failed migration retains original FK and no partial DDL';
end $$;
