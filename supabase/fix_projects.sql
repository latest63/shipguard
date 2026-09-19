drop table if exists public.projects cascade;

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  wallet_address text not null,
  name text,
  github_handle text,
  logo_url text,
  link text,
  profile_data jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint projects_wallet_address_key unique (wallet_address)
);

create index if not exists projects_wallet_address_idx on public.projects (wallet_address);
create index if not exists projects_github_handle_idx on public.projects (github_handle);

alter table public.projects enable row level security;

create policy projects_select_all on public.projects for select using (true);
create policy projects_insert_all on public.projects for insert with check (true);
create policy projects_update_all on public.projects for update using (true);
create policy projects_delete_all on public.projects for delete using (true);

grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on public.projects to anon, authenticated;
grant all on public.projects to service_role;
