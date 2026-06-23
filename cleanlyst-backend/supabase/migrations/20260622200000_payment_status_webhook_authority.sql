-- =============================================================================
-- PAYMENT STATUS AUTHORITY — Stripe is the ONLY writer of bookings.payment_status
-- =============================================================================
-- bookings.payment_status must ONLY be mutated by the Stripe webhook layer.
-- No RPC, Edge Function, or authenticated client may directly set this field.
--
-- Allowed values (Stripe lifecycle states):
--   unpaid     — booking created, no payment initiated
--   authorized — Stripe PaymentIntent authorized (capture_method: manual, payment held)
--   captured   — Stripe payment captured, OR simulation path (dev-only)
--   refunded   — payment reversed via Stripe refund or PaymentIntent cancel
--
-- The value 'released' is DEPRECATED on bookings.payment_status.
-- Payout tracking moved to the payouts table.
--
-- Changes in this migration:
--   1. guard_booking_payment_status trigger — enforces allowed value set for ALL callers
--   2. complete_booking      — remove payment_status = 'released'; relax guard to allow 'authorized'
--   3. cancel_booking_customer — remove payment_status write (supersedes 20260622100000)
--   4. report_cleaner_no_show  — remove payment_status write (supersedes 20260621500000)

-- ── 1. VALUE GUARD TRIGGER ───────────────────────────────────────────────────
-- Fires ONLY when payment_status actually changes (WHEN clause on trigger).
-- Complements trg_prevent_booking_field_tampering (role-level guard).
-- This trigger is purely value-level — it runs for postgres, service_role, and
-- authenticated to ensure no caller (including SECURITY DEFINER RPCs) can write
-- an out-of-contract value.

create or replace function public.guard_booking_payment_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Stripe is the only system allowed to mutate bookings.payment_status.
  -- The webhook writes authorized, captured, or refunded depending on the
  -- Stripe event type. The initial 'unpaid' value is set at booking creation only.
  if new.payment_status not in ('unpaid', 'authorized', 'captured', 'refunded') then
    raise exception
      'bookings.payment_status: invalid value "%" — allowed: unpaid, authorized, captured, refunded. '
      'The value "released" is deprecated; payout state is tracked in the payouts table. '
      'bookings.payment_status is written exclusively by the Stripe webhook.',
      new.payment_status;
  end if;

  return new;
end;
$$;

create trigger trg_guard_booking_payment_status
before update on public.bookings
for each row
when (old.payment_status is distinct from new.payment_status)
execute function public.guard_booking_payment_status();

revoke execute on function public.guard_booking_payment_status() from public;
revoke execute on function public.guard_booking_payment_status() from anon;

-- ── 2. complete_booking — remove payment_status = 'released' ─────────────────
-- Booking completion no longer stamps payment_status because:
--   a) 'released' is not in the canonical value set above
--   b) bookings.payment_status is Stripe's domain — payout state lives in payouts
-- The existing payout row creation and payouts.status = 'released' are unchanged.
--
-- Additionally: relax the payment_status check to allow 'authorized' so that
-- cleaners can complete Stripe-path bookings where capture_method = 'manual' and
-- the hold is still authorized (not yet captured by admin).
--
-- Supersedes complete_booking as defined in 20260602400000.

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
  -- Allow 'authorized' (Stripe capture_method: manual — payment held but not yet captured)
  -- as well as 'captured' (Stripe captured or simulation).
  if v_booking.payment_status not in ('captured', 'authorized') then
    raise exception
      'Cannot complete booking: payment has not been received (current: %)', v_booking.payment_status;
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

  -- payment_status is intentionally NOT set here — Stripe webhook is the sole writer.
  update public.bookings
  set status                          = 'completed',
      completed_at                    = now(),
      customer_confirmed_completed_at = now(),
      updated_at                      = now()
  where id = p_booking_id
  returning * into v_booking;

  insert into public.payments (
    booking_id, status, amount_cents, platform_fee_cents, cleaner_payout_cents, currency, captured_at
  ) values (
    p_booking_id, 'released', coalesce(v_booking.quote_cents, 0),
    v_platform_fee_cents, v_cleaner_payout_cents, coalesce(v_booking.currency, 'GBP'), now()
  )
  on conflict (booking_id) do update
    set status               = 'released',
        platform_fee_cents   = excluded.platform_fee_cents,
        cleaner_payout_cents = excluded.cleaner_payout_cents,
        captured_at          = coalesce(public.payments.captured_at, now()),
        updated_at           = now()
  returning id into v_payment_id;

  insert into public.payouts (booking_id, cleaner_id, payment_id, amount_cents, currency, status, released_at)
  values (p_booking_id, v_booking.cleaner_id, v_payment_id, v_cleaner_payout_cents,
          coalesce(v_booking.currency, 'GBP'), 'released', now())
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

  insert into public.booking_status_events (booking_id, from_status, to_status, actor_id, actor_role)
  values (p_booking_id, 'in_progress', 'completed', auth.uid(),
          case when public.is_admin() then 'admin' else 'cleaner' end);

  insert into public.booking_status_events (booking_id, from_status, to_status, actor_id, notes, actor_role)
  values (p_booking_id, 'completed', 'payout_released', auth.uid(),
          'Cleaner payout: £' || (v_cleaner_payout_cents::numeric / 100)::text
          || ' | Platform: £' || (v_platform_fee_cents::numeric / 100)::text,
          'system');

  insert into public.notifications (user_id, type, title, body, booking_id, metadata)
  values (v_booking.customer_id, 'booking_completed', 'Cleaning complete',
          'Your cleaner has completed the job.',
          p_booking_id, jsonb_build_object('booking_id', p_booking_id));

  insert into public.notifications (user_id, type, title, body, booking_id, metadata)
  values (v_booking.cleaner_id, 'booking_payout_released', 'Payout released',
          'Your earnings for this booking have been released.',
          p_booking_id, jsonb_build_object('booking_id', p_booking_id, 'amount_cents', v_cleaner_payout_cents));

  return v_booking;
end;
$$;

-- ── 3. cancel_booking_customer — remove payment_status write ─────────────────
-- bookings.payment_status stays at its current value when a booking is cancelled.
-- If a Stripe refund is later processed, the webhook will update payment_status.
-- The payments table row IS still updated to 'refunded' for record-keeping.
--
-- Supersedes 20260622100000 (which superseded 20260621200000).
-- Preserves: payment_authorized in status allowlist, v_prev_status audit fix.

create or replace function public.cancel_booking_customer(
  p_booking_id uuid,
  p_reason     text default null
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking     public.bookings;
  v_prev_status public.booking_status;
  v_auto_refund boolean;
  v_admin_id    uuid;
begin
  select * into v_booking from public.bookings where id = p_booking_id;

  if v_booking.id is null then
    raise exception 'Booking not found';
  end if;
  if v_booking.customer_id != auth.uid() then
    raise exception 'Not authorised';
  end if;
  if v_booking.status not in ('pending_request', 'accepted', 'paid', 'estimate_proposed', 'awaiting_customer_payment', 'payment_authorized') then
    raise exception 'Booking cannot be cancelled in its current state (%)', v_booking.status;
  end if;

  v_prev_status := v_booking.status;

  -- 24-hour rule: auto-refund eligibility (DB record only — Stripe refund is separate).
  v_auto_refund := (v_booking.scheduled_start - now()) > interval '24 hours';

  -- payment_status is intentionally NOT set here — Stripe webhook is the sole writer.
  update public.bookings
  set status              = 'cancelled',
      cancellation_reason = coalesce(p_reason, 'Customer cancelled'),
      cancelled_at        = now(),
      updated_at          = now()
  where id = p_booking_id
  returning * into v_booking;

  if v_auto_refund then
    update public.payments
    set status      = 'refunded',
        refunded_at = now(),
        updated_at  = now()
    where booking_id = p_booking_id and status != 'refunded';
  end if;

  insert into public.booking_status_events (booking_id, from_status, to_status, actor_id, notes, actor_role)
  values (p_booking_id, v_prev_status, 'cancelled', auth.uid(),
          coalesce(p_reason, '') ||
          case when v_auto_refund then ' [auto-refund applied]' else ' [admin review required — within 24h]' end,
          'customer');

  insert into public.notifications (user_id, type, title, body, booking_id, metadata)
  values (v_booking.cleaner_id, 'booking_cancelled', 'Booking cancelled',
          'The customer has cancelled this booking.',
          p_booking_id, jsonb_build_object('booking_id', p_booking_id, 'reason', p_reason));

  if v_auto_refund then
    insert into public.notifications (user_id, type, title, body, booking_id, metadata)
    values (v_booking.customer_id, 'booking_refunded', 'Booking cancelled — refund issued',
            'Your booking has been cancelled and a full refund has been processed.',
            p_booking_id, jsonb_build_object('booking_id', p_booking_id));
  else
    insert into public.notifications (user_id, type, title, body, booking_id, metadata)
    values (v_booking.customer_id, 'booking_cancelled', 'Booking cancelled — awaiting review',
            'Your booking has been cancelled. As it was within 24 hours of the start time, a refund requires admin review.',
            p_booking_id, jsonb_build_object('booking_id', p_booking_id));

    for v_admin_id in select id from public.profiles where role = 'admin' loop
      insert into public.notifications (user_id, type, title, body, booking_id, metadata)
      values (v_admin_id, 'booking_cancelled_review', '⚠ Late cancellation — review required',
              'Customer cancelled within 24 hours of booking start. Refund decision needed.',
              p_booking_id, jsonb_build_object('booking_id', p_booking_id,
                'customer_id', v_booking.customer_id, 'reason', p_reason));
    end loop;
  end if;

  return v_booking;
end;
$$;

-- ── 4. report_cleaner_no_show — remove payment_status write ──────────────────
-- bookings.payment_status is not touched here; Stripe webhook handles it.
-- payments table IS still updated to 'refunded' for the refund-action path.
--
-- Supersedes 20260621500000 (v_prev_status audit fix).

create or replace function public.report_cleaner_no_show(
  p_booking_id uuid,
  p_action     text
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking        public.bookings;
  v_prev_status    public.booking_status;
  v_target_status  public.booking_status;
  v_no_show_action text;
  v_admin_id       uuid;
begin
  if p_action not in ('replacement', 'refund') then
    raise exception 'Invalid no-show action: %', p_action;
  end if;

  select * into v_booking from public.bookings where id = p_booking_id;

  if v_booking.id is null then
    raise exception 'Booking not found';
  end if;
  if v_booking.customer_id != auth.uid() and not public.is_admin() then
    raise exception 'Not authorised';
  end if;
  if v_booking.started_at is not null then
    raise exception 'This booking has already been started';
  end if;
  if v_booking.status = 'completed' then
    raise exception 'Completed bookings cannot be reported as no-show';
  end if;
  if v_booking.status::text not in ('accepted', 'paid', 'cleaner_no_show') then
    raise exception 'Only accepted or paid bookings can be reported as no-show (current: %)', v_booking.status;
  end if;
  if now() <= v_booking.scheduled_start + interval '30 minutes' then
    raise exception 'Cleaner no-show can be reported 30 minutes after the booking start time';
  end if;
  if v_booking.no_show_action is not null then
    return v_booking;
  end if;

  v_prev_status := v_booking.status;

  if p_action = 'replacement' then
    v_target_status  := 'cleaner_no_show';
    v_no_show_action := 'replacement_requested';
  else
    v_target_status  := 'cancelled';
    v_no_show_action := 'refund_requested';
  end if;

  -- payment_status is intentionally NOT set here — Stripe webhook is the sole writer.
  update public.bookings
  set status              = v_target_status,
      no_show_reported_at = now(),
      no_show_action      = v_no_show_action,
      cancellation_reason = case when p_action = 'refund' then 'cleaner_no_show' else cancellation_reason end,
      cancelled_at        = case when p_action = 'refund' then now() else cancelled_at end,
      updated_at          = now()
  where id = p_booking_id
  returning * into v_booking;

  if p_action = 'refund' then
    update public.payments
    set status      = 'refunded',
        refunded_at = now(),
        updated_at  = now()
    where booking_id = p_booking_id
      and status <> 'refunded';
  end if;

  insert into public.booking_status_events (booking_id, from_status, to_status, actor_id, actor_role)
  values (p_booking_id, v_prev_status, v_target_status, auth.uid(), 'customer');

  for v_admin_id in select id from public.profiles where role = 'admin' loop
    insert into public.notifications (user_id, type, title, body, booking_id, metadata)
    values (
      v_admin_id,
      'cleaner_no_show',
      'Cleaner did not attend booking',
      case
        when p_action = 'replacement' then 'Customer requested another cleaner.'
        else 'Customer requested a refund.'
      end,
      p_booking_id,
      jsonb_build_object(
        'booking_id', p_booking_id,
        'cleaner_id', v_booking.cleaner_id,
        'customer_id', v_booking.customer_id,
        'action', v_no_show_action
      )
    );
  end loop;

  return v_booking;
end;
$$;
