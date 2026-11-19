
create table if not exists public.nextdoor_connection (
  id text primary key check (id = 'moreys-primary'),
  encrypted_token_data text not null,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.nextdoor_connection enable row level security;

