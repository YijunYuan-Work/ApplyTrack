-- Hold the target lead until all eight RPC sessions are observed waiting on locks.
set statement_timeout = '40s';
set application_name = 'rf04-conversion-barrier';
begin;
select id from public.job_leads where id=203 for update;
do $$
declare deadline timestamptz := clock_timestamp() + interval '30s';
begin
  while not (select released from public.audit_conversion_gate) loop
    if clock_timestamp() > deadline then raise exception 'RPC overlap barrier timed out'; end if;
    perform pg_sleep(0.05);
  end loop;
end;
$$;
commit;
