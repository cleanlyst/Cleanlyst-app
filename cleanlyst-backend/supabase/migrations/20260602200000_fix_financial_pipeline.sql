-- ============================================================
-- Fix financial pipeline
--
-- Root causes addressed:
--   1. booking_financials RLS blocks customer INSERT → snapshot
--      never written → all breakdown values show £0.00
--   2. record_initial_payment does not write booking_financials
--      as server-side fallback (security definer bypasses RLS)
--   3. propose_estimate uses hardcoded 7% commission instead
--      of reading from platform_settings
--   4. Backfill: existing rows with service_price_cents = 0
--   5. Backfill: bookings with no booking_financials row at all
-- ============================================================

-- ── 1. Add RLS policies so customers can write their own ─────────────
--    booking_financials row during the booking creation flow.
--    The pricing engine derives values from platform_settings,
--    so the snapshot is accurate. The server-side fallback in
--    record_initial_payment provides a second layer of assurance.

drop policy if exists "Customer stores own booking financials"  on public.booking_financials;
drop policy if exists "Customer updates own booking financials" on public.booking_financials;

create policy "Customer stores own booking financials"
on public.booking_financials for insert
with check (
  exists (
    select 1 from public.bookings b
    where b.id = booking_id
      and b.customer_id = auth.uid()
  )
);

create policy "Customer updates own booking financials"
on public.booking_financials for update
using (
  exists (
    select 1 from public.bookings b
    where b.id = booking_id
      and b.customer_id = auth.uid()
  )
);

-- ── 2. record_initial_payment: also write booking_financials ─────────
--    If the client-side upsert failed (RLS) or was never called,
--    this security-definer function writes the snapshot using
--    current platform_settings. Only fills in zeroed-out columns
--    so a correctly-set client-side snapshot is never overwritten.

create or replace function public.record_initial_payment(p_booking_id uuid)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking                public.bookings;
  v_fee_pct                numeric(5,2);
  v_commission_pct         numeric(5,2);
  v_service_price_cents    integer;
  v_booking_fee_cents_calc integer;
  v_commission_cents_calc  integer;
  v_platform_revenue_calc  integer;
begin
  select * into v_booking from public.bookings where id = p_booking_id;

  if v_booking.id is null then
    raise exception 'Booking not found';
  end if;
  if v_booking.customer_id != auth.uid() then
    raise exception 'Not authorised';
  end if;
  -- Idempotent: if already paid, return as-is
  if v_booking.payment_status = 'captured' then
    return v_booking;
  end if;

  update public.bookings
  set payment_status      = 'captured',
      paid_at             = now(),
      initial_quote_cents = quote_cents,
      updated_at          = now()
  where id = p_booking_id
  returning * into v_booking;

  insert into public.payments (booking_id, status, amount_cents, currency, captured_at)
  values (
    p_booking_id,
    'captured',
    coalesce(v_booking.quote_cents, 0),
    coalesce(v_booking.currency, 'GBP'),
    now()
  )
  on conflict (booking_id) do update
    set status       = 'captured',
        captured_at  = now(),
        amount_cents = excluded.amount_cents,
        updated_at   = now();

  -- ── Server-side booking_financials snapshot ─────────────────────────
  -- Derive breakdown from quote_cents, cleaner_payout_cents + platform rates.
  -- Formula:
  --   service_price  = cleaner_payout / (1 - commission_rate)
  --   booking_fee    = quote - service_price
  --   commission     = service_price - cleaner_payout
  --   platform_rev   = quote - cleaner_payout

  select booking_fee_percent, cleaner_commission_percent
  into   v_fee_pct, v_commission_pct
  from   public.platform_settings
  limit  1;

  -- Fallback if platform_settings is empty
  v_fee_pct        := coalesce(v_fee_pct, 7.0);
  v_commission_pct := coalesce(v_commission_pct, 15.0);

  v_service_price_cents := round(
    coalesce(v_booking.cleaner_payout_cents, 0)::numeric
    / nullif(1.0 - v_commission_pct / 100.0, 0)
  )::integer;

  v_booking_fee_cents_calc := coalesce(v_booking.quote_cents, 0) - v_service_price_cents;
  v_commission_cents_calc  := v_service_price_cents - coalesce(v_booking.cleaner_payout_cents, 0);
  v_platform_revenue_calc  := coalesce(v_booking.quote_cents, 0) - coalesce(v_booking.cleaner_payout_cents, 0);

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
    v_booking_fee_cents_calc,
    v_fee_pct,
    v_commission_cents_calc,
    v_commission_pct,
    coalesce(v_booking.cleaner_payout_cents, 0),
    v_platform_revenue_calc,
    coalesce(v_booking.quote_cents, 0),
    v_platform_revenue_calc,
    coalesce(v_booking.currency, 'GBP')
  )
  on conflict (booking_id) do update set
    -- Only overwrite a column that still holds the zero default —
    -- a client-supplied value is preserved.
    service_price_cents = case
      when booking_financials.service_price_cents = 0 and excluded.service_price_cents > 0
      then excluded.service_price_cents
      else booking_financials.service_price_cents
    end,
    booking_fee_cents = case
      when coalesce(booking_financials.booking_fee_cents, 0) = 0 and excluded.booking_fee_cents > 0
      then excluded.booking_fee_cents
      else coalesce(booking_financials.booking_fee_cents, 0)
    end,
    booking_fee_percent = case
      when booking_financials.booking_fee_percent = 7.00
      then excluded.booking_fee_percent
      else booking_financials.booking_fee_percent
    end,
    cleaner_commission_cents = case
      when booking_financials.cleaner_commission_cents = 0 and excluded.cleaner_commission_cents > 0
      then excluded.cleaner_commission_cents
      else booking_financials.cleaner_commission_cents
    end,
    cleaner_commission_percent = case
      when booking_financials.cleaner_commission_percent = 15.00
      then excluded.cleaner_commission_percent
      else booking_financials.cleaner_commission_percent
    end,
    cleaner_payout_cents = coalesce(
      nullif(booking_financials.cleaner_payout_cents, 0),
      excluded.cleaner_payout_cents
    ),
    platform_revenue_cents = case
      when booking_financials.platform_revenue_cents = 0 and excluded.platform_revenue_cents > 0
      then excluded.platform_revenue_cents
      else booking_financials.platform_revenue_cents
    end,
    quote_cents       = coalesce(booking_financials.quote_cents, excluded.quote_cents),
    platform_fee_cents = coalesce(booking_financials.platform_fee_cents, excluded.platform_fee_cents),
    currency          = coalesce(booking_financials.currency, excluded.currency);

  return v_booking;
end;
$$;

-- ── 3. Fix propose_estimate: use platform commission, not hardcoded 7% ─
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
  v_commission_pct       numeric(5,2);
  v_cleaner_payout_cents bigint;
  v_already_paid_cents   integer;
  v_additional_cents     integer;
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

  -- Read commission rate from platform_settings (not hardcoded)
  select coalesce(cleaner_commission_percent, 15.0)
  into   v_commission_pct
  from   public.platform_settings
  limit  1;

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

  return v_booking;
end;
$$;

-- ── 4. Backfill: update existing rows where service_price_cents = 0 ──
-- Uses current platform_settings to derive the split.
-- Only updates rows that are still at the zero default.

update public.booking_financials bf
set
  service_price_cents =
    round(coalesce(b.cleaner_payout_cents, 0)::numeric
          / nullif(1.0 - coalesce(ps.cleaner_commission_percent, 15.0) / 100.0, 0)),

  booking_fee_cents = case
    when coalesce(bf.booking_fee_cents, 0) = 0
    then coalesce(b.quote_cents, 0)
       - round(coalesce(b.cleaner_payout_cents, 0)::numeric
               / nullif(1.0 - coalesce(ps.cleaner_commission_percent, 15.0) / 100.0, 0))
    else bf.booking_fee_cents
  end,

  booking_fee_percent = case
    when bf.booking_fee_percent = 7.00 then ps.booking_fee_percent
    else bf.booking_fee_percent
  end,

  cleaner_commission_cents =
    round(coalesce(b.cleaner_payout_cents, 0)::numeric
          / nullif(1.0 - coalesce(ps.cleaner_commission_percent, 15.0) / 100.0, 0))
    - coalesce(b.cleaner_payout_cents, 0),

  cleaner_commission_percent = case
    when bf.cleaner_commission_percent = 15.00 then ps.cleaner_commission_percent
    else bf.cleaner_commission_percent
  end,

  cleaner_payout_cents = coalesce(
    nullif(bf.cleaner_payout_cents, 0),
    coalesce(b.cleaner_payout_cents, 0)
  ),

  platform_revenue_cents = case
    when bf.platform_revenue_cents = 0
    then coalesce(b.quote_cents, 0) - coalesce(b.cleaner_payout_cents, 0)
    else bf.platform_revenue_cents
  end,

  quote_cents       = coalesce(bf.quote_cents, b.quote_cents),
  platform_fee_cents = coalesce(
    bf.platform_fee_cents,
    coalesce(b.quote_cents, 0) - coalesce(b.cleaner_payout_cents, 0)
  ),
  currency = coalesce(bf.currency, b.currency, 'GBP')

from public.bookings b,
     public.platform_settings ps
where bf.booking_id = b.id
  and bf.service_price_cents = 0
  and coalesce(b.cleaner_payout_cents, 0) > 0;

-- ── 5. Backfill: insert missing booking_financials rows entirely ──────
-- Covers bookings where the client-side upsert never ran at all.

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
)
select
  b.id,

  round(coalesce(b.cleaner_payout_cents, 0)::numeric
        / nullif(1.0 - coalesce(ps.cleaner_commission_percent, 15.0) / 100.0, 0))::integer,

  coalesce(b.quote_cents, 0)
  - round(coalesce(b.cleaner_payout_cents, 0)::numeric
          / nullif(1.0 - coalesce(ps.cleaner_commission_percent, 15.0) / 100.0, 0))::integer,

  ps.booking_fee_percent,

  (round(coalesce(b.cleaner_payout_cents, 0)::numeric
         / nullif(1.0 - coalesce(ps.cleaner_commission_percent, 15.0) / 100.0, 0))
   - coalesce(b.cleaner_payout_cents, 0))::integer,

  ps.cleaner_commission_percent,
  coalesce(b.cleaner_payout_cents, 0),
  coalesce(b.quote_cents, 0) - coalesce(b.cleaner_payout_cents, 0),
  coalesce(b.quote_cents, 0),
  coalesce(b.quote_cents, 0) - coalesce(b.cleaner_payout_cents, 0),
  coalesce(b.currency, 'GBP')

from public.bookings b,
     public.platform_settings ps
where not exists (
  select 1 from public.booking_financials bf where bf.booking_id = b.id
)
  and coalesce(b.quote_cents, 0) > 0
  and coalesce(b.cleaner_payout_cents, 0) > 0;
