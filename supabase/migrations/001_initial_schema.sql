create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.holdings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  symbol text not null,
  company_name text null,
  quantity numeric not null check (quantity >= 0),
  average_cost numeric not null check (average_cost >= 0),
  currency text not null default 'USD',
  account_name text null,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists holdings_user_id_idx on public.holdings(user_id);
create index if not exists holdings_user_symbol_idx on public.holdings(user_id, symbol);

create table if not exists public.watchlist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  symbol text not null,
  company_name text null,
  target_buy_price numeric null check (target_buy_price is null or target_buy_price >= 0),
  target_sell_price numeric null check (target_sell_price is null or target_sell_price >= 0),
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, symbol)
);

create table if not exists public.user_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create table if not exists public.alert_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  symbol text not null,
  rule_type text not null,
  operator text null,
  threshold numeric null,
  configuration jsonb not null default '{}'::jsonb,
  is_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.alert_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  alert_rule_id uuid null references public.alert_rules(id) on delete set null,
  symbol text not null,
  event_type text not null,
  message text not null,
  market_price numeric null,
  market_data_source text null,
  market_data_updated_at timestamptz null,
  is_stale boolean not null default false,
  triggered_at timestamptz not null default now(),
  acknowledged_at timestamptz null,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.daily_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  report_date date not null,
  report_content jsonb not null,
  summary_text text null,
  created_at timestamptz not null default now(),
  unique (user_id, report_date)
);

create table if not exists public.market_data_cache (
  symbol text primary key,
  data jsonb not null,
  original_source text null,
  updated_at timestamptz null,
  cached_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create table if not exists public.event_cache (
  cache_key text primary key,
  data jsonb not null,
  sources jsonb not null default '[]'::jsonb,
  cached_at timestamptz not null default now(),
  expires_at timestamptz not null
);

alter table public.profiles enable row level security;
alter table public.holdings enable row level security;
alter table public.watchlist enable row level security;
alter table public.user_settings enable row level security;
alter table public.alert_rules enable row level security;
alter table public.alert_events enable row level security;
alter table public.daily_reports enable row level security;
alter table public.market_data_cache enable row level security;
alter table public.event_cache enable row level security;

create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

create policy "holdings_select_own" on public.holdings for select using (auth.uid() = user_id);
create policy "holdings_insert_own" on public.holdings for insert with check (auth.uid() = user_id);
create policy "holdings_update_own" on public.holdings for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "holdings_delete_own" on public.holdings for delete using (auth.uid() = user_id);

create policy "watchlist_select_own" on public.watchlist for select using (auth.uid() = user_id);
create policy "watchlist_insert_own" on public.watchlist for insert with check (auth.uid() = user_id);
create policy "watchlist_update_own" on public.watchlist for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "watchlist_delete_own" on public.watchlist for delete using (auth.uid() = user_id);

create policy "user_settings_select_own" on public.user_settings for select using (auth.uid() = user_id);
create policy "user_settings_insert_own" on public.user_settings for insert with check (auth.uid() = user_id);
create policy "user_settings_update_own" on public.user_settings for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "user_settings_delete_own" on public.user_settings for delete using (auth.uid() = user_id);

create policy "alert_rules_select_own" on public.alert_rules for select using (auth.uid() = user_id);
create policy "alert_rules_insert_own" on public.alert_rules for insert with check (auth.uid() = user_id);
create policy "alert_rules_update_own" on public.alert_rules for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "alert_rules_delete_own" on public.alert_rules for delete using (auth.uid() = user_id);

create policy "alert_events_select_own" on public.alert_events for select using (auth.uid() = user_id);
create policy "alert_events_insert_own" on public.alert_events for insert with check (auth.uid() = user_id);
create policy "alert_events_update_own" on public.alert_events for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "alert_events_delete_own" on public.alert_events for delete using (auth.uid() = user_id);

create policy "daily_reports_select_own" on public.daily_reports for select using (auth.uid() = user_id);
create policy "daily_reports_insert_own" on public.daily_reports for insert with check (auth.uid() = user_id);
create policy "daily_reports_update_own" on public.daily_reports for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "daily_reports_delete_own" on public.daily_reports for delete using (auth.uid() = user_id);

revoke all on public.market_data_cache from anon, authenticated;
revoke all on public.event_cache from anon, authenticated;
