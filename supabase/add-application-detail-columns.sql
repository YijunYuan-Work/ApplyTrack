alter table public.applications
  add column if not exists cover_letter text default '',
  add column if not exists referral text default '',
  add column if not exists last_updated date;
