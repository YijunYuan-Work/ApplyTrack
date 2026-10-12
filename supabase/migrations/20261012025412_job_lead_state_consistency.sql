begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

create or replace function public.complete_job_lead_application(
  p_job_lead_id bigint,
  p_applied_date date
)
returns public.applications
language plpgsql
security invoker
set search_path = ''
as $$
declare
  lead_row public.job_leads%rowtype;
  application_row public.applications%rowtype;
  salary_text text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  select *
  into lead_row
  from public.job_leads
  where id = p_job_lead_id
    and user_id = auth.uid()
  for update;

  if not found then
    raise exception 'Job lead not found.';
  end if;

  if lead_row.application_id is not null then
    select *
    into application_row
    from public.applications
    where id = lead_row.application_id
      and user_id = auth.uid();

    if found then
      if lead_row.state <> 'applied' then
        update public.job_leads
        set state = 'applied'
        where id = lead_row.id;
      end if;
      return application_row;
    end if;
  end if;

  salary_text := case
    when lead_row.salary_min is not null and lead_row.salary_max is not null
      then concat(lead_row.salary_min, ' - ', lead_row.salary_max)
    when lead_row.salary_min is not null then lead_row.salary_min::text
    when lead_row.salary_max is not null then lead_row.salary_max::text
    else ''
  end;

  insert into public.applications (
    user_id,
    company,
    role,
    location,
    status,
    applied_date,
    job_url,
    salary,
    cover_letter,
    referral,
    last_updated,
    interview_count,
    notes
  )
  values (
    auth.uid(),
    lead_row.company,
    lead_row.title,
    coalesce(nullif(lead_row.location, ''), 'Not specified'),
    'Applied',
    coalesce(p_applied_date, current_date),
    coalesce(nullif(lead_row.apply_url, ''), lead_row.canonical_url),
    salary_text,
    'No',
    'No',
    coalesce(p_applied_date, current_date),
    0,
    concat(
      'Added from ',
      case lead_row.source
        when 'linkedin' then 'LinkedIn'
        when 'indeed' then 'Indeed'
        else 'a job alert'
      end,
      ' after the application was confirmed as submitted.'
    )
  )
  returning * into application_row;

  update public.job_leads
  set
    application_id = application_row.id,
    state = 'applied'
  where id = lead_row.id;

  return application_row;
end;
$$;

commit;
