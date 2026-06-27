-- =============================================================================
-- Financial Close History — stores completed period closes
-- =============================================================================
-- Stores the output of each financial close run (daily, weekly, monthly, manual).
-- The report JSON contains the full FinancialCloseReport snapshot so closes
-- are immutable audit records that can be replayed or exported at any time.

create table if not exists public.financial_closes (
  id           uuid primary key default gen_random_uuid(),
  period_type  text not null check (period_type in ('daily', 'weekly', 'monthly', 'manual')),
  period_start timestamptz not null,
  period_end   timestamptz not null,
  status       text not null default 'open'
    check (status in ('open', 'running', 'complete', 'blocked', 'failed')),
  report       jsonb,
  created_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  completed_at timestamptz,
  is_rerun     boolean not null default false,

  constraint financial_closes_period_check check (period_end > period_start)
);

-- Speed up lookups by period and recency
create index if not exists idx_financial_closes_period
  on public.financial_closes (period_start, period_end);

create index if not exists idx_financial_closes_status
  on public.financial_closes (status, created_at desc);

-- RLS: admins only
alter table public.financial_closes enable row level security;

create policy "Admins can manage financial closes"
  on public.financial_closes
  for all
  to authenticated
  using  (public.is_admin())
  with check (public.is_admin());
