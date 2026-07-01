alter table public.applications
  add column if not exists cover_letter text default 'No',
  add column if not exists referral text default 'No',
  add column if not exists last_updated date,
  add column if not exists interview_count integer not null default 0;

alter table public.applications
  alter column cover_letter set default 'No',
  alter column referral set default 'No';

update public.applications
set cover_letter = 'No'
where cover_letter is null or cover_letter = '';

update public.applications
set referral = 'No'
where referral is null or referral = '';
