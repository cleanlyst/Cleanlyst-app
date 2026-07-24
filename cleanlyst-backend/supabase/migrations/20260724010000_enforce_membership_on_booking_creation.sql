-- =============================================================================
-- CRITICAL FIX (C2): enforce membership server-side on booking creation
-- =============================================================================
-- Production audit finding: is_member() existed but was never checked by any
-- RLS policy or RPC. The only gate on `insert into bookings` was
-- "Customers create bookings" (customer_id = auth.uid() and is_customer()) —
-- no membership check at all. A free-tier customer could create bookings by
-- calling the Supabase client directly, bypassing the Vue router guard
-- entirely, since that guard is client-side UX only.
--
-- Fix (defense in depth, per C2 spec):
--   Layer 1 — is_member() itself: was previously status-only and did not
--     account for a lapsed billing period. Now also checks
--     current_period_end, so "active but expired" is correctly NOT a member.
--   Layer 2 — RLS: "Customers create bookings" now also requires
--     is_member(). This is the primary gate — it runs on every insert
--     regardless of how it arrives (REST, RPC, direct API client).
--   Layer 3 — BEFORE INSERT trigger: an independent, inline membership
--     check (does not call is_member(), so a bug in that function can't
--     silently defeat both layers at once) that also produces a specific,
--     human-readable error per membership state (free / cancelled / paused
--     / expired) instead of RLS's generic "violates row-level security
--     policy" message. Because BEFORE ROW triggers run before RLS's WITH
--     CHECK is evaluated, this trigger's message is what callers actually
--     see when blocked.
--
-- Admins bypass both layers (existing "Admin manages bookings" RLS policy
-- already permits admin inserts independently — Postgres ORs multiple
-- permissive policies together — and the trigger explicitly allows
-- is_admin() and trusted internal callers). Nothing here touches cleaner
-- onboarding, cleaner dashboard, admin tooling, reviews, booking history,
-- or membership renewal — only the bookings INSERT path.
-- =============================================================================

-- ── Layer 1: is_member() — account for a lapsed billing period ──────────────
create or replace function public.is_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.customer_memberships cm
    where cm.customer_id = auth.uid()
      and cm.status in ('active', 'complimentary')
      and (cm.current_period_end is null or cm.current_period_end > now())
  );
$$;

grant execute on function public.is_member() to authenticated;

-- ── Layer 2: RLS — require membership on customer-initiated booking inserts ──
drop policy if exists "Customers create bookings" on public.bookings;

create policy "Customers create bookings"
on public.bookings
for insert
with check (
  customer_id = auth.uid()
  and public.is_customer()
  and public.is_member()
);

-- ── Layer 3: BEFORE INSERT trigger — independent check + helpful errors ─────
create or replace function public.guard_booking_creation_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_membership public.customer_memberships;
begin
  -- Trusted internal callers (service-role Edge Functions, SECURITY DEFINER
  -- RPCs running as postgres) bypass — mirrors guard_booking_status_write's
  -- exemption for the same categories of caller.
  if current_user in ('service_role', 'supabase_admin', 'postgres') then
    return new;
  end if;

  -- Admins may create/import bookings on behalf of any customer without
  -- holding a membership themselves.
  if public.is_admin() then
    return new;
  end if;

  -- Independent re-check against NEW.customer_id — deliberately does not
  -- call is_member() so this layer's correctness doesn't depend on that
  -- function's. Keyed to the row being inserted (not auth.uid()) so it is
  -- correct regardless of BEFORE-trigger vs RLS evaluation order.
  select * into v_membership
  from public.customer_memberships
  where customer_id = new.customer_id;

  if v_membership.id is null or v_membership.status = 'free' then
    raise exception
      'MEMBERSHIP_REQUIRED: Join Cleanlyst membership to book a cleaner.'
      using errcode = 'P0001';
  end if;

  if v_membership.status = 'cancelled' then
    raise exception
      'MEMBERSHIP_REQUIRED: Your membership has been cancelled. Rejoin to book a cleaner.'
      using errcode = 'P0001';
  end if;

  if v_membership.status = 'paused' then
    raise exception
      'MEMBERSHIP_REQUIRED: Your membership is paused. Reactivate it to book a cleaner.'
      using errcode = 'P0001';
  end if;

  -- status is 'active' or 'complimentary' here — check the billing period.
  if v_membership.current_period_end is not null
     and v_membership.current_period_end <= now()
  then
    raise exception
      'MEMBERSHIP_REQUIRED: Your membership has expired. Renew to book a cleaner.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_booking_creation_membership on public.bookings;

create trigger trg_guard_booking_creation_membership
before insert on public.bookings
for each row
execute function public.guard_booking_creation_membership();

revoke execute on function public.guard_booking_creation_membership() from public;
revoke execute on function public.guard_booking_creation_membership() from anon;
