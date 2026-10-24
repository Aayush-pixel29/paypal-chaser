-- Chaser — Supabase RLS policies (hackathon-grade)
-- Run once in the Supabase SQL editor. Safe to re-run.
-- The backend uses the anon key, so anon needs read/insert/update.
-- For production: replace with a service-role key on the server and drop these.

alter table public.clients    enable row level security;
alter table public.invoices   enable row level security;
alter table public.agent_logs enable row level security;

drop policy if exists "chaser_anon_all_clients"    on public.clients;
drop policy if exists "chaser_anon_all_invoices"   on public.invoices;
drop policy if exists "chaser_anon_all_agent_logs" on public.agent_logs;

create policy "chaser_anon_all_clients" on public.clients
  for all to anon using (true) with check (true);

create policy "chaser_anon_all_invoices" on public.invoices
  for all to anon using (true) with check (true);

create policy "chaser_anon_all_agent_logs" on public.agent_logs
  for all to anon using (true) with check (true);
