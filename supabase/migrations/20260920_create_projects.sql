create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  wallet_address text not null unique,
  name text,
  github_handle text,
  logo_url text,
  link text,
  profile_data jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

create index if not exists projects_wallet_address_idx on public.projects(wallet_address);
create index if not exists projects_github_handle_idx on public.projects(github_handle);

alter table public.projects enable row level security;

create policy "Projects are visible to everyone"
  on public.projects for select using (true);

create policy "Users can update their own project"
  on public.projects for all
  using (auth.uid()::text = wallet_address);