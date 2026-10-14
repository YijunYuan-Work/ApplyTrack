-- Existing rows remain unknown; general record dates are not rejection history.
alter table public.applications add column rejected_date date;
