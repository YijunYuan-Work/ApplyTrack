alter table public.job_agent_profiles
  add column if not exists first_name text not null default '',
  add column if not exists last_name text not null default '',
  add column if not exists preferred_name text not null default '',
  add column if not exists address_line_1 text not null default '',
  add column if not exists address_line_2 text not null default '',
  add column if not exists city text not null default '',
  add column if not exists region text not null default '',
  add column if not exists postal_code text not null default '',
  add column if not exists address_country_code text not null default 'ca',
  add column if not exists formatted_address text not null default '',
  add column if not exists address_latitude numeric,
  add column if not exists address_longitude numeric,
  add column if not exists work_authorization_country text not null default 'ca',
  add column if not exists work_authorization_status text not null default '',
  add column if not exists work_authorization_details text not null default '',
  add column if not exists future_sponsorship_required boolean,
  add column if not exists notice_period_days integer;

alter table public.job_agent_profiles
  add constraint job_agent_profiles_address_country_code_check
    check (address_country_code ~ '^[a-z]{2}$'),
  add constraint job_agent_profiles_work_authorization_country_check
    check (work_authorization_country ~ '^[a-z]{2}$'),
  add constraint job_agent_profiles_work_authorization_status_check
    check (work_authorization_status in (
      '', 'citizen', 'permanent_resident', 'open_work_permit',
      'employer_specific_permit', 'student_work_authorization',
      'temporary_work_authorization', 'not_authorized', 'other',
      'prefer_not_to_say'
    )),
  add constraint job_agent_profiles_notice_period_days_check
    check (notice_period_days is null or notice_period_days between 0 and 365),
  add constraint job_agent_profiles_address_latitude_check
    check (address_latitude is null or address_latitude between -90 and 90),
  add constraint job_agent_profiles_address_longitude_check
    check (address_longitude is null or address_longitude between -180 and 180);

update public.job_agent_profiles
set
  preferred_name = case when preferred_name = '' then display_name else preferred_name end,
  formatted_address = case when formatted_address = '' then location else formatted_address end,
  work_authorization_status = case
    when work_authorization_status = '' and work_authorization <> '' then 'other'
    else work_authorization_status
  end,
  work_authorization_details = case
    when work_authorization_details = '' then work_authorization
    else work_authorization_details
  end,
  notice_period_days = case
    when notice_period_days is not null then notice_period_days
    when reusable_answers->>'noticePeriod' ~ '^\s*\d+\s*$'
      then least(365, (trim(reusable_answers->>'noticePeriod'))::integer)
    when lower(reusable_answers->>'noticePeriod') in ('available now', 'immediately') then 0
    when lower(reusable_answers->>'noticePeriod') in ('one week', '1 week') then 7
    when lower(reusable_answers->>'noticePeriod') in ('two weeks', '2 weeks') then 14
    when lower(reusable_answers->>'noticePeriod') in ('one month', '1 month') then 30
    else null
  end;

alter table public.job_searches
  add column if not exists work_arrangements text[] not null default array['remote', 'hybrid', 'onsite']::text[],
  add column if not exists seniority_levels text[] not null default '{}',
  add column if not exists salary_max integer,
  add column if not exists salary_currency text not null default 'CAD';

alter table public.job_searches
  add constraint job_searches_work_arrangements_check
    check (work_arrangements <@ array['remote', 'hybrid', 'onsite']::text[]),
  add constraint job_searches_seniority_levels_check
    check (seniority_levels <@ array['entry', 'mid', 'senior', 'staff', 'principal']::text[]),
  add constraint job_searches_salary_max_check
    check (salary_max is null or salary_max >= 0),
  add constraint job_searches_salary_range_check
    check (salary_min is null or salary_max is null or salary_max >= salary_min),
  add constraint job_searches_salary_currency_check
    check (salary_currency ~ '^[A-Z]{3}$');

update public.job_searches
set work_arrangements = case remote_preference
  when 'remote' then array['remote']::text[]
  when 'hybrid' then array['hybrid']::text[]
  when 'onsite' then array['onsite']::text[]
  else array['remote', 'hybrid', 'onsite']::text[]
end;
