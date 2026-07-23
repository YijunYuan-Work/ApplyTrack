create policy "Users can remove their job leads"
  on public.job_leads
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

grant delete on public.job_leads to authenticated;
