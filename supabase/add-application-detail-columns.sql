alter table public.applications
  add column if not exists cover_letter text default '',
  add column if not exists referral text default '',
  add column if not exists last_updated date,
  add column if not exists interview_count integer not null default 0;
