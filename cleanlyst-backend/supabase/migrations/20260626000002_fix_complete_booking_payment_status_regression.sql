-- =============================================================================
-- FIX: complete_booking — regression from 20260624000002
-- =============================================================================
-- Migration 20260624000002 (fix_complete_booking_status_guard) correctly added
-- the tbs_active flag before the bookings UPDATE so the guard_booking_status_write
-- trigger allows the status change. However, it also re-introduced:
--
--   update public.bookings
--   set payment_status = 'released', ...
--
-- This regresses the intentional removal in 20260622200000 (payment_status_webhook_authority)
-- which established that Stripe is the ONLY writer of bookings.payment_status.
-- The guard_booking_payment_status trigger (also from 20260622200000) enforces this
-- by only allowing: unpaid, authorized, captured, refunded — and explicitly rejects
-- 'released'. So every call to complete_booking fails with:
--
--   bookings.payment_status: invalid value "released" — allowed: unpaid, authorized,
--   captured, refunded.
--
-- Fix: combine both correct behaviours —
--   • tbs_active flag from 20260624000002 (allows guard_booking_status_write to pass)
--   • no payment_status write from 20260622200000 (Stripe webhook is sole authority)
--   • allow 'authorized' in the payment check from 20260622200000
--
-- Supersedes complete_booking from 20260624000002.

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
  -- as well as 'captured' (Stripe captured or simulation path).
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

  -- Authorize the postgres-role write to bookings.status through the
  -- guard_booking_status_write trigger (requires app.tbs_active = 'true').
  -- payment_status is intentionally NOT set here — Stripe webhook is the sole writer.
  perform set_config('app.tbs_active', 'true', true);

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

grant execute on function public.complete_booking(uuid) to authenticated;
