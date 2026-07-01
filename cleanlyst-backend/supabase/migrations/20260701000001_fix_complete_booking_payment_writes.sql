-- =============================================================================
-- FIX: complete_booking — premature payments/payouts writes block Stripe payout
-- =============================================================================
-- Root cause (discovered in Phase T3 Stripe certification audit):
--
-- Migration 20260626000002 correctly removed "payment_status = 'released'" from
-- the bookings UPDATE (honouring Stripe-webhook authority). However it still:
--
--   1. Upserts public.payments with status = 'released'
--   2. Inserts public.payouts with status = 'released' (no stripe_transfer_id)
--
-- These premature writes break the Stripe payout pipeline because:
--
--   A. process-payout EF guards on payout.status IN ('released','paid').
--      After complete_booking, payout.status = 'released' → process-payout
--      returns HTTP 409 "Payout already processed" for every completed booking.
--      No Stripe capture is ever performed. No cleaner is ever paid.
--
--   B. release-payout EF skips PaymentIntent capture when payment.status != 'authorized'.
--      After complete_booking sets payments.status = 'released', release-payout
--      skips capture → creates Stripe Transfer from platform balance instead of
--      from the customer's held authorization → money double-counted.
--
-- Fix:
--   • payments upsert: update ONLY the financial split columns (platform_fee_cents,
--     cleaner_payout_cents). Do NOT change status or captured_at — those are
--     written exclusively by the Stripe webhook → ledger trigger pipeline.
--   • Remove the payouts insert. process-payout creates the payout record after
--     capture + transfer, with the real stripe_transfer_id.
--   • Remove the premature 'payout_released' booking_status_events row (payout
--     hasn't happened yet at this point).
--   • Remove the premature 'booking_payout_released' cleaner notification.
--
-- Supersedes complete_booking from 20260626000002.

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
  -- as well as 'captured' (payment already captured by process-payout before completion).
  if v_booking.payment_status not in ('captured', 'authorized') then
    raise exception
      'Cannot complete booking: payment has not been received (current: %)', v_booking.payment_status;
  end if;

  -- Resolve financial split from booking_financials (immutable snapshot) or booking row.
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

  -- Allow postgres-role write to bookings.status through guard_booking_status_write.
  -- payment_status is intentionally NOT touched — Stripe webhook is the sole writer.
  perform set_config('app.tbs_active', 'true', true);

  update public.bookings
  set status                          = 'completed',
      completed_at                    = now(),
      customer_confirmed_completed_at = now(),
      updated_at                      = now()
  where id = p_booking_id
  returning * into v_booking;

  -- Update ONLY the financial split metadata on the existing payments row.
  -- status and captured_at are managed exclusively by the Stripe webhook pipeline.
  -- We do NOT insert a new payments row here — create-checkout-session already created it.
  update public.payments
  set platform_fee_cents   = v_platform_fee_cents,
      cleaner_payout_cents = v_cleaner_payout_cents,
      updated_at           = now()
  where booking_id = p_booking_id;

  -- NOTE: payouts row is intentionally NOT created here.
  -- process-payout (or release-payout) EF creates it after:
  --   1. Capturing the held Stripe PaymentIntent
  --   2. Creating the Stripe Transfer to the cleaner's Connect account
  -- This ensures payouts.stripe_transfer_id is always set to a real transfer ID.

  -- Update earnings counter and platform stats (best-effort reporting; not financial source of truth).
  update public.cleaner_profiles
  set total_earnings_cents = total_earnings_cents + v_cleaner_payout_cents
  where user_id = v_booking.cleaner_id;

  update public.admin_stats
  set total_revenue_cents = total_revenue_cents + v_platform_fee_cents,
      updated_at          = now()
  where id = 1;

  -- Audit trail: record completion only. Payout event is written by process-payout EF.
  insert into public.booking_status_events (booking_id, from_status, to_status, actor_id, actor_role)
  values (p_booking_id, 'in_progress', 'completed', auth.uid(),
          case when public.is_admin() then 'admin' else 'cleaner' end);

  -- Notify customer that cleaning is complete.
  insert into public.notifications (user_id, type, title, body, booking_id, metadata)
  values (v_booking.customer_id, 'booking_completed', 'Cleaning complete',
          'Your cleaner has completed the job.',
          p_booking_id, jsonb_build_object('booking_id', p_booking_id));

  return v_booking;
end;
$$;

grant execute on function public.complete_booking(uuid) to authenticated;
