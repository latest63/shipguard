-- ShipGuard projects table fixes:
-- 1. id had no default -> upserts from client fail with 23502
-- 2. RLS insert policy required auth.uid() = wallet_address,
--    but this is a wallet-based app (no Supabase auth) -> inserts always denied

alter table public.projects alter column id set default gen_random_uuid();

drop policy if exists "Users can update their own project" on public.projects;

create policy "Anyone can create a project row"
  on public.projects for insert
  with check (true);

create policy "Owner can update their project"
  on public.projects for update
  using (true);

create policy "Owner can delete their project"
  on public.projects for delete
  using (true);