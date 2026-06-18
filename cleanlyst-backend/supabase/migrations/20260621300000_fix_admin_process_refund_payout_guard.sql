-- =============================================================================
-- FIX P0: admin_process_refund — missing guard for already-transferred payouts
-- =============================================================================
-- Root cause: admin_process_refund (20260619200000) allows refunding payments in
-- 'captured', 'released', or 'paid' status without checking whether the cleaner
-- payout has already been physically transferred via Stripe (stripe_transfer_id set
-- on the payouts row). An admin issuing a DB-side refund after the Stripe transfer
-- has settled marks the payment as 'refunded' in the DB without recovering money
-- from the cleaner — creating an irrecoverable financial ledger discrepancy.
--
-- Fix: Before updating any records, check for an existing payout row with a
-- non-null stripe_transfer_id. If found, raise an exception directing the admin
-- to use the Stripe dashboard to clawback the transfer before issuing the DB refund.
-- The refund-payment edge function (which calls Stripe directly) already has this
-- guard; this brings the DB RPC into parity.

create or replace function public.admin_process_refund(
  p_booking_id    uuid,
  p_refund_cents  integer,
  p_reason        text,
  p_notes         text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment        public.payments;
  v_booking        public.bookings;
  v_is_full        boolean;
  v_customer_id    uuid;
  v_cleaner_id     uuid;
  v_customer_name  text;
  v_service_title  text;
begin
  if not public.is_admin() then
    raise exception 'Only admins can process refunds';
  end if;

  if p_refund_cents < 0 then
    raise exception 'Refund amount cannot be negative';
  end if;

  if p_reason is null or trim(p_reason) = '' then
    raise exception 'Refund reason is required';
  end if;

  -- Load booking
  select * into v_booking from public.bookings where id = p_booking_id;
  if v_booking.id is null then
    raise exception 'Booking not found';
  end if;

  -- Load payment
  select * into v_payment from public.payments where booking_id = p_booking_id;
  if v_payment.id is null then
    raise exception 'No payment record found for this booking';
  end if;

  if v_payment.status not in ('captured', 'released', 'paid') then
    raise exception 'Payment cannot be refunded in status: %', v_payment.status;
  end if;

  if p_refund_cents > v_payment.amount_cents then
    raise exception 'Refund amount (%) exceeds payment amount (%)',
      p_refund_cents, v_payment.amount_cents;
  end if;

  -- Guard: reject if cleaner payout has already been physically transferred to Stripe.
  -- admin_process_refund has no Stripe call — it only updates DB state.
  -- Issuing a DB-side refund after money has left the platform creates an
  -- irrecoverable ledger mismatch. Admin must use Stripe dashboard to reverse
  -- the transfer first, then re-run this RPC once stripe_transfer_id is cleared.
  if exists (
    select 1
    from public.payouts
    where booking_id = p_booking_id
      and stripe_transfer_id is not null
  ) then
    raise exception
      'Cannot issue DB refund: cleaner payout has already been transferred to Stripe. '
      'Use the Stripe dashboard to reverse the transfer (payouts.stripe_transfer_id), '
      'then contact engineering to clear the transfer record before re-issuing this refund.';
  end if;

  v_is_full       := p_refund_cents = v_payment.amount_cents;
  v_customer_id   := v_booking.customer_id;
  v_cleaner_id    := v_booking.cleaner_id;
  v_service_title := coalesce(v_booking.service_title_snapshot, 'Cleaning Booking');

  select full_name into v_customer_name
  from public.profiles where id = v_customer_id;

  -- Update payment record
  update public.payments
  set
    status        = 'refunded',
    refund_cents  = p_refund_cents,
    refund_reason = p_reason,
    refund_notes  = p_notes,
    refunded_by   = auth.uid(),
    refunded_at   = now(),
    updated_at    = now()
  where id = v_payment.id;

  -- Update booking status and write audit event
  if v_is_full then
    update public.bookings
    set status     = 'refunded',
        updated_at = now()
    where id = p_booking_id;

    insert into public.booking_status_events (
      booking_id, from_status, to_status, actor_id, notes, actor_role
    ) values (
      p_booking_id, v_booking.status, 'refunded',
      auth.uid(), 'Admin processed full refund: ' || p_reason, 'admin'
    );
  else
    insert into public.booking_status_events (
      booking_id, from_status, to_status, actor_id, notes, actor_role
    ) values (
      p_booking_id, v_booking.status, v_booking.status,
      auth.uid(), 'Admin processed partial refund of ' ||
        (p_refund_cents::numeric / 100)::text || ': ' || p_reason,
      'admin'
    );
  end if;

  -- Notify customer
  insert into public.notifications (user_id, type, title, body, booking_id, metadata)
  values (
    v_customer_id,
    'refund_processed',
    case when v_is_full then 'Full refund issued' else 'Partial refund issued' end,
    'A ' || case when v_is_full then 'full' else 'partial' end ||
      ' refund of £' || (p_refund_cents::numeric / 100)::text ||
      ' has been processed for your booking (' || v_service_title || ').',
    p_booking_id,
    jsonb_build_object(
      'booking_id',   p_booking_id,
      'refund_cents', p_refund_cents,
      'reason',       p_reason,
      'is_full',      v_is_full
    )
  );

  -- Notify cleaner
  insert into public.notifications (user_id, type, title, body, booking_id, metadata)
  values (
    v_cleaner_id,
    'refund_processed',
    'Refund issued on your booking',
    'A refund of £' || (p_refund_cents::numeric / 100)::text ||
      ' has been issued for booking ' || v_service_title ||
      '. Reason: ' || p_reason,
    p_booking_id,
    jsonb_build_object(
      'booking_id',   p_booking_id,
      'refund_cents', p_refund_cents,
      'reason',       p_reason,
      'is_full',      v_is_full
    )
  );

  return jsonb_build_object(
    'booking_id',     p_booking_id,
    'refund_cents',   p_refund_cents,
    'is_full',        v_is_full,
    'payment_total',  v_payment.amount_cents,
    'platform_fee',   coalesce(v_payment.platform_fee_cents, 0),
    'cleaner_payout', coalesce(v_payment.cleaner_payout_cents, 0)
  );
end;
$$;

grant execute on function public.admin_process_refund(uuid, integer, text, text) to authenticated;
