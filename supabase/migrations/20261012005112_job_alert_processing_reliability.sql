begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

alter table public.job_alert_messages
  add column processing_token uuid,
  add column processing_started_at timestamptz;

-- One lease per Resend email; old workers are fenced by the token on completion.
create function public.claim_job_alert_message(
  p_inbox_id bigint, p_resend_email_id text, p_internet_message_id text,
  p_subject text, p_received_at timestamptz, p_parser_version text
) returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
  owner_id uuid;
  claimed public.job_alert_messages;
begin
  select user_id into strict owner_id from public.job_alert_inboxes
    where id = p_inbox_id and enabled;
  insert into public.job_alert_messages as m (
    user_id, resend_email_id, internet_message_id, subject, received_at,
    parser_version, status, processing_token, processing_started_at
  ) values (
    owner_id, p_resend_email_id, p_internet_message_id, p_subject, p_received_at,
    p_parser_version, 'processing', gen_random_uuid(), clock_timestamp()
  )
  on conflict (resend_email_id) do update set
    status = 'processing', processing_token = gen_random_uuid(),
    processing_started_at = clock_timestamp(), processed_at = null,
    safe_error_summary = '', parser_version = excluded.parser_version
  where m.user_id = owner_id and (
    m.status in ('received', 'failed') or
    (m.status = 'processing' and
      (m.processing_started_at is null or
       m.processing_started_at < clock_timestamp() - interval '5 minutes'))
  )
  returning * into claimed;
  if found then
    return jsonb_build_object('claimed', true, 'id', claimed.id,
      'token', claimed.processing_token, 'status', claimed.status);
  end if;
  select * into strict claimed from public.job_alert_messages
    where resend_email_id = p_resend_email_id and user_id = owner_id;
  return jsonb_build_object('claimed', false, 'id', claimed.id, 'status', claimed.status);
end;
$$;

create function public.finish_job_alert_message(
  p_message_id bigint, p_token uuid, p_inbox_id bigint,
  p_provider text, p_jobs jsonb
) returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
  message public.job_alert_messages;
  job jsonb;
  created_count integer := 0;
  inserted_count integer;
  found_count integer := jsonb_array_length(p_jobs);
begin
  select * into strict message from public.job_alert_messages
    where id = p_message_id for update;
  if p_token is null or message.processing_started_at is null
    or message.status <> 'processing' or message.processing_token is distinct from p_token
    or message.processing_started_at < clock_timestamp() - interval '5 minutes' then
    raise exception 'Job alert processing lease is no longer valid.';
  end if;
  if p_jobs is null or p_provider is null or p_provider not in ('linkedin', 'indeed', 'unknown')
    or (p_provider = 'unknown' and found_count <> 0) then
    raise exception 'Invalid job alert result.';
  end if;
  -- Sorted locks also keep overlapping alerts from acquiring Lead locks in opposite orders.
  for job in select value from jsonb_array_elements(p_jobs)
    order by value->>'external_id'
  loop
    if job->>'source' is distinct from p_provider then
      raise exception 'Invalid job alert source.';
    end if;
    insert into public.job_leads (
      user_id, source, external_id, company, title, source_message_id
    ) values (
      message.user_id, p_provider, job->>'external_id',
      job->>'company', job->>'title', message.id
    ) on conflict (user_id, source, external_id) do nothing;
    get diagnostics inserted_count = row_count;
    created_count := created_count + inserted_count;

    -- Refresh metadata only, never user state, application ownership or discovery time.
    update public.job_leads set
      apply_url = job->>'apply_url', canonical_url = job->>'canonical_url',
      company = job->>'company', title = job->>'title',
      location = job->>'location', description = job->>'description',
      category = job->>'category', contract_type = job->>'contract_type',
      salary_min = (job->>'salary_min')::numeric,
      salary_max = (job->>'salary_max')::numeric,
      posted_at = (job->>'posted_at')::timestamptz,
      source_message_id = message.id
    where user_id = message.user_id and source = p_provider
      and external_id = job->>'external_id';
  end loop;

  update public.job_alert_inboxes set last_received_at =
    greatest(last_received_at, message.received_at)
    where id = p_inbox_id and user_id = message.user_id;
  if not found then
    raise exception 'Job alert inbox no longer exists.';
  end if;
  update public.job_alert_messages set
    jobs_created = created_count, jobs_found = found_count,
    jobs_updated = found_count - created_count,
    provider = p_provider, processed_at = clock_timestamp(),
    processing_token = null, processing_started_at = null,
    status = case when p_provider = 'unknown' then 'ignored'
      when found_count > 0 then 'completed' else 'partial' end,
    safe_error_summary = case when p_provider = 'unknown'
      then 'This message was not a LinkedIn or Indeed job alert.'
      when found_count = 0 then 'The alert was received, but no supported job links were found.'
      else '' end
    where id = message.id;
  return jsonb_build_object('created', created_count, 'found', found_count);
end;
$$;

revoke all on function public.claim_job_alert_message(bigint,text,text,text,timestamptz,text)
  from public, anon, authenticated;
revoke all on function public.finish_job_alert_message(bigint,uuid,bigint,text,jsonb)
  from public, anon, authenticated;
grant execute on function public.claim_job_alert_message(bigint,text,text,text,timestamptz,text)
  to service_role;
grant execute on function public.finish_job_alert_message(bigint,uuid,bigint,text,jsonb)
  to service_role;

commit;
