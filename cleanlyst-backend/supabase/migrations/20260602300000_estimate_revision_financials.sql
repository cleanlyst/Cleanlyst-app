-- ============================================================
-- Estimate revision: keep booking_financials in sync
--
-- Root causes addressed:
--   1. propose_estimate updates quote/payout on bookings but
--      never updates booking_financials → breakdown shows stale values
--   2. record_additional_payment confirms the new total but also
--      never updates booking_financials
--   3. complete_booking marks payments as 'captured' even though
--      the funds are being released to the cleaner (wrong status)
-- ============================================================

-- ── 1. propose_estimate ──────────────────────────────────────────────────────
-- Re-derives breakdown whenever a cleaner submits a new quote and
-- unconditionally overwrites booking_financials (estimate supersedes
-- the original snapshot).

create or replace function public.propose_estimate(
  p_booking_id  uuid,
  p_quote_cents integer,
  p_note        text default null
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking              public.bookings;
  v_old_status           public.booking_status;
  v_fee_pct              numeric(5,2);
  v_commission_pct       numeric(5,2);
  v_cleaner_payout_cents bigint;
  v_already_paid_cents   integer;
  v_additional_cents     integer;
  v_service_price_cents  integer;
  v_booking_fee_cents    integer;
  v_commission_cents     integer;
  v_platform_revenue     integer;
begin
  select * into v_booking from public.bookings where id = p_booking_id;

  if v_booking.id is null then
    raise exception 'Booking not found';
  end if;
  if v_booking.cleaner_id != auth.uid() and not public.is_admin() then
    raise exception 'Not authorised to propose an estimate for this booking';
  end if;
  if v_booking.status not in ('pending_request', 'accepted') then
    raise exception 'Can only propose an estimate for pending or accepted bookings (current: %)', v_booking.status;
  end if;
  if p_quote_cents <= 0 then
    raise exception 'Quote must be greater than zero';
  end if;

  select
    coalesce(booking_fee_percent, 7.0),
    coalesce(cleaner_commission_percent, 15.0)
  into v_fee_pct, v_commission_pct
  from public.platform_settings
  limit 1;

  v_fee_pct        := coalesce(v_fee_pct, 7.0);
  v_commission_pct := coalesce(v_commission_pct, 15.0);

  v_old_status           := v_booking.status;
  v_cleaner_payout_cents := round(p_quote_cents::numeric * (1.0 - v_commission_pct / 100.0));

  v_already_paid_cents := coalesce(v_booking.initial_quote_cents, v_booking.quote_cents, 0);
  v_additional_cents   := p_quote_cents - v_already_paid_cents;

  update public.bookings
  set quote_cents                 = p_quote_cents,
      cleaner_payout_cents        = v_cleaner_payout_cents,
      booking_edit_note           = p_note,
      status                      = 'estimate_proposed',
      requires_additional_payment = (v_additional_cents > 0),
      additional_payment_cents    = case when v_additional_cents > 0 then v_additional_cents else null end,
      updated_at                  = now()
  where id = p_booking_id
  returning * into v_booking;

  insert into public.booking_status_events (booking_id, from_status, to_status, actor_id)
  values (p_booking_id, v_old_status, 'estimate_proposed', auth.uid());

  -- Derive financial breakdown from revised quote.
  -- service_price = cleaner_payout / (1 - commission_rate)
  -- booking_fee   = quote - service_price
  -- commission    = service_price - cleaner_payout
  -- platform_rev  = quote - cleaner_payout
  v_service_price_cents := round(
    v_cleaner_payout_cents::numeric / nullif(1.0 - v_commission_pct / 100.0, 0)
  )::integer;
  v_booking_fee_cents   := p_quote_cents - v_service_price_cents;
  v_commission_cents    := v_service_price_cents - v_cleaner_payout_cents::integer;
  v_platform_revenue    := p_quote_cents - v_cleaner_payout_cents::integer;

  insert into public.booking_financials (
    booking_id,
    service_price_cents,
    booking_fee_cents,
    booking_fee_percent,
    cleaner_commission_cents,
    cleaner_commission_percent,
    cleaner_payout_cents,
    platform_revenue_cents,
    quote_cents,
    platform_fee_cents,
    currency
  ) values (
    p_booking_id,
    v_service_price_cents,
    v_booking_fee_cents,
    v_fee_pct,
    v_commission_cents,
    v_commission_pct,
    v_cleaner_payout_cents::integer,
    v_platform_revenue,
    p_quote_cents,
    v_platform_revenue,
    coalesce(v_booking.currency, 'GBP')
  )
  on conflict (booking_id) do update set
    service_price_cents        = excluded.service_price_cents,
    booking_fee_cents          = excluded.booking_fee_cents,
    booking_fee_percent        = excluded.booking_fee_percent,
    cleaner_commission_cents   = excluded.cleaner_commission_cents,
    cleaner_commission_percent = excluded.cleaner_commission_percent,
    cleaner_payout_cents       = excluded.cleaner_payout_cents,
    platform_revenue_cents     = excluded.platform_revenue_cents,
    quote_cents                = excluded.quote_cents,
    platform_fee_cents         = excluded.platform_fee_cents;

  return v_booking;
end;
$$;

-- ── 2. record_additional_payment ─────────────────────────────────────────────
-- Customer pays the outstanding difference after an upward estimate revision.
-- After confirming payment we must also update booking_financials so the
-- snapshot reflects the final, customer-paid amount.

create or replace function public.record_additional_payment(p_booking_id uuid)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking             public.bookings;
  v_fee_pct             numeric(5,2);
  v_commission_pct      numeric(5,2);
  v_service_price_cents integer;
  v_booking_fee_cents   integer;
  v_commission_cents    integer;
  v_platform_revenue    integer;
begin
  select * into v_booking from public.bookings where id = p_booking_id;

  if v_booking.id is null then
    raise exception 'Booking not found';
  end if;
  if v_booking.customer_id != auth.uid() then
    raise exception 'Not authorised';
  end if;
  if not v_booking.requires_additional_payment then
    raise exception 'No additional payment is required for this booking';
  end if;

  update public.bookings
  set payment_status              = 'captured',
      requires_additional_payment = false,
      additional_payment_cents    = null,
      paid_at                     = now(),
      status                      = 'pending_request',
      updated_at                  = now()
  where id = p_booking_id
  returning * into v_booking;

  update public.payments
  set status       = 'captured',
      amount_cents = coalesce(v_booking.quote_cents, 0),
      captured_at  = now(),
      updated_at   = now()
  where booking_id = p_booking_id;

  insert into public.booking_status_events (booking_id, from_status, to_status, actor_id)
  values (p_booking_id, 'estimate_proposed', 'pending_request', auth.uid());

  -- Confirm booking_financials with the final paid amount.
  select
    coalesce(booking_fee_percent, 7.0),
    coalesce(cleaner_commission_percent, 15.0)
  into v_fee_pct, v_commission_pct
  from public.platform_settings
  limit 1;

  v_fee_pct        := coalesce(v_fee_pct, 7.0);
  v_commission_pct := coalesce(v_commission_pct, 15.0);

  v_service_price_cents := round(
    coalesce(v_booking.cleaner_payout_cents, 0)::numeric
    / nullif(1.0 - v_commission_pct / 100.0, 0)
  )::integer;
  v_booking_fee_cents   := coalesce(v_booking.quote_cents, 0) - v_service_price_cents;
  v_commission_cents    := v_service_price_cents - coalesce(v_booking.cleaner_payout_cents, 0)::integer;
  v_platform_revenue    := coalesce(v_booking.quote_cents, 0) - coalesce(v_booking.cleaner_payout_cents, 0)::integer;

  insert into public.booking_financials (
    booking_id,
    service_price_cents,
    booking_fee_cents,
    booking_fee_percent,
    cleaner_commission_cents,
    cleaner_commission_percent,
    cleaner_payout_cents,
    platform_revenue_cents,
    quote_cents,
    platform_fee_cents,
    currency
  ) values (
    p_booking_id,
    v_service_price_cents,
    v_booking_fee_cents,
    v_fee_pct,
    v_commission_cents,
    v_commission_pct,
    coalesce(v_booking.cleaner_payout_cents, 0)::integer,
    v_platform_revenue,
    coalesce(v_booking.quote_cents, 0),
    v_platform_revenue,
    coalesce(v_booking.currency, 'GBP')
  )
  on conflict (booking_id) do update set
    service_price_cents        = excluded.service_price_cents,
    booking_fee_cents          = excluded.booking_fee_cents,
    booking_fee_percent        = excluded.booking_fee_percent,
    cleaner_commission_cents   = excluded.cleaner_commission_cents,
    cleaner_commission_percent = excluded.cleaner_commission_percent,
    cleaner_payout_cents       = excluded.cleaner_payout_cents,
    platform_revenue_cents     = excluded.platform_revenue_cents,
    quote_cents                = excluded.quote_cents,
    platform_fee_cents         = excluded.platform_fee_cents;

  return v_booking;
end;
$$;

-- ── 3. complete_booking: release payment when job is done ────────────────────
-- Previously this set payments.status = 'captured' on completion, which is
-- wrong — the payment was already captured at booking creation. When the job
-- completes and the cleaner payout is processed, the correct status is
-- 'released'. This also adds a payment_status guard.

create or replace function public.complete_booking(p_booking_id uuid)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking              public.bookings;
  v_cleaner_payout_cents bigint;
  v_platform_fee_cents   bigint;
  v_payment_id           uuid;
begin
  select * into v_booking from public.bookings where id = p_booking_id;

  if v_booking.id is null then
    raise exception 'Booking not found';
  end if;
  if v_booking.cleaner_id != auth.uid() and not public.is_admin() then
    raise exception 'Not authorised';
  end if;
  if v_booking.status != 'in_progress' then
    raise exception 'Booking must be in_progress to complete (current: %)', v_booking.status;
  end if;
  if v_booking.payment_status != 'captured' then
    raise exception 'Cannot complete booking: payment not yet captured (current: %)', v_booking.payment_status;
  end if;

  select
    coalesce(bf.cleaner_payout_cents, v_booking.cleaner_payout_cents, 0),
    coalesce(bf.platform_revenue_cents, bf.platform_fee_cents,
             greatest(coalesce(v_booking.quote_cents, 0) - coalesce(v_booking.cleaner_payout_cents, 0), 0))
  into v_cleaner_payout_cents, v_platform_fee_cents
  from public.booking_financials bf
  where bf.booking_id = p_booking_id;

  if v_cleaner_payout_cents is null then
    v_cleaner_payout_cents := coalesce(v_booking.cleaner_payout_cents, 0);
  end if;
  if v_platform_fee_cents is null then
    v_platform_fee_cents := greatest(coalesce(v_booking.quote_cents, 0) - coalesce(v_booking.cleaner_payout_cents, 0), 0);
  end if;

  update public.bookings
  set status                          = 'completed',
      payment_status                  = 'released',
      completed_at                    = now(),
      customer_confirmed_completed_at = now(),
      updated_at                      = now()
  where id = p_booking_id
  returning * into v_booking;

  -- Mark the payment as released (funds transferred to cleaner)
  insert into public.payments (
    booking_id,
    status,
    amount_cents,
    platform_fee_cents,
    cleaner_payout_cents,
    currency,
    captured_at
  )
  values (
    p_booking_id,
    'released',
    coalesce(v_booking.quote_cents, 0),
    v_platform_fee_cents,
    v_cleaner_payout_cents,
    coalesce(v_booking.currency, 'GBP'),
    now()
  )
  on conflict (booking_id) do update
    set status               = 'released',
        platform_fee_cents   = excluded.platform_fee_cents,
        cleaner_payout_cents = excluded.cleaner_payout_cents,
        captured_at          = coalesce(public.payments.captured_at, now()),
        updated_at           = now()
  returning id into v_payment_id;

  insert into public.payouts (booking_id, cleaner_id, payment_id, amount_cents, currency, status, released_at)
  values (
    p_booking_id,
    v_booking.cleaner_id,
    v_payment_id,
    v_cleaner_payout_cents,
    coalesce(v_booking.currency, 'GBP'),
    'released',
    now()
  )
  on conflict (booking_id) do update
    set payment_id   = excluded.payment_id,
        amount_cents = excluded.amount_cents,
        currency     = excluded.currency,
        status       = 'released',
        released_at  = coalesce(public.payouts.released_at, now());

  update public.cleaner_profiles
  set total_earnings_cents = total_earnings_cents + v_cleaner_payout_cents
  where user_id = v_booking.cleaner_id;

  update public.admin_stats
  set total_revenue_cents = total_revenue_cents + v_platform_fee_cents,
      updated_at          = now()
  where id = 1;

  insert into public.booking_status_events (booking_id, from_status, to_status, actor_id)
  values (p_booking_id, 'in_progress', 'completed', auth.uid());

  return v_booking;
end;
$$;

-- ── 4. cleaner_earnings_ledger view (Task 7) ─────────────────────────────────
-- Joins payouts → booking_financials → bookings to provide a stable ledger
-- of all paid-out earnings. Historic records remain auditable regardless of
-- future platform_settings changes.

create or replace view public.cleaner_earnings_ledger as
select
  p.booking_id,
  p.cleaner_id,
  p.released_at,
  p.status                        as payout_status,
  bf.service_price_cents          as gross_amount_cents,
  bf.cleaner_commission_cents     as commission_amount_cents,
  bf.cleaner_payout_cents         as net_amount_cents,
  bf.quote_cents,
  bf.booking_fee_cents,
  bf.booking_fee_percent,
  bf.cleaner_commission_percent,
  b.service_title_snapshot,
  b.scheduled_start,
  b.completed_at,
  b.customer_id,
  b.currency
from public.payouts p
join public.booking_financials bf on bf.booking_id = p.booking_id
join public.bookings b            on b.id           = p.booking_id;

-- The view inherits RLS from the underlying payouts table.
-- payouts already has "Cleaner reads own payouts" and "Admin manages payouts"
-- policies (20260511120000_complete_rls_policies.sql) so no new policy needed.
alter view public.cleaner_earnings_ledger owner to postgres;
