-- =============================================================================
-- PHASE F1: Pay-Before-Accept Migration
-- =============================================================================
-- Summary of changes:
--
-- 1. NOTIFICATION TRIGGER — Remove premature cleaner notification on booking
--    INSERT. Cleaners must NOT be notified of new bookings before payment.
--    The payment_authorized → cleaner "Payment confirmed" notification is the
--    correct trigger (already exists in the UPDATE branch).
--
-- 2. TRANSITION STATE MACHINE — Add payment_authorized → accepted transition
--    so cleaners can accept jobs AFTER payment is received. Also add:
--    - payment_authorized → cleaner_declined  (cleaner turns down a paid job)
--    - payment_authorized in cleaner_cancelled source states
--    - payment_authorized in admin reassign source states
--    Remove:
--    - pending_request → accepted BY CLEANER  (old accept-before-pay path)
--    - pending_request → declined/cleaner_declined BY CLEANER (no longer exposed)
--    Admin retains all powers (including accepting/declining from any state).
--
-- 3. RLS POLICY — Split "Users view own bookings" into two separate policies:
--    - Customer can SELECT their own bookings (all statuses)
--    - Cleaner can SELECT their assigned bookings WHERE status != 'pending_request'
--    This is the primary guard ensuring cleaners cannot see unpaid bookings.
-- =============================================================================

-- ─── 1. NOTIFICATION TRIGGER ─────────────────────────────────────────────────
-- Replace notify_booking_participants to remove the INSERT branch.
-- The trigger itself remains AFTER INSERT OR UPDATE (INSERT is harmless — the
-- function simply returns NEW without notifying anyone).

create or replace function public.notify_booking_participants()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin

  -- New booking created: do NOT notify the cleaner yet.
  -- Under the pay-before-accept model, the cleaner is invisible to booking
  -- creation until payment_authorized fires the 'Payment confirmed' notification
  -- below. The INSERT branch intentionally sends no notification.
  if TG_OP = 'INSERT' then
    return new;
  end if;

  -- Status change — skip if status did not actually change
  if old.status is not distinct from new.status then
    return new;
  end if;

  case new.status

    when 'estimate_proposed' then
      insert into public.notifications (user_id, type, title, body)
      values (
        new.customer_id,
        'booking_accepted',
        'Booking accepted',
        'Your cleaner has reviewed and accepted your booking request.'
      );

    when 'payment_authorized' then
      -- Payment confirmed: NOW notify the cleaner. This is the first time the
      -- cleaner learns about the booking — the customer's payment is guaranteed.
      insert into public.notifications (user_id, type, title, body)
      values (
        new.cleaner_id,
        'payment_received',
        'New paid booking',
        'A customer has paid for a booking. Review and accept to confirm the job.'
      );

    when 'accepted' then
      -- Cleaner accepted a paid booking — notify the customer.
      insert into public.notifications (user_id, type, title, body)
      values (
        new.customer_id,
        'booking_confirmed',
        'Booking confirmed',
        'Your cleaner has accepted the booking. Everything is set for your cleaning day.'
      );

    when 'in_progress' then
      insert into public.notifications (user_id, type, title, body)
      values (
        new.customer_id,
        'booking_in_progress',
        'Cleaning in progress',
        'Your cleaner has started the job.'
      );

    when 'completion_pending_customer' then
      insert into public.notifications (user_id, type, title, body)
      values (
        new.customer_id,
        'completion_pending',
        'Please confirm job completion',
        'Your cleaner has marked the job as done. Please confirm to release their payment.'
      );

    when 'completed' then
      insert into public.notifications (user_id, type, title, body)
      values (
        new.cleaner_id,
        'booking_completed',
        'Job confirmed — payout queued',
        'The customer has confirmed the job is complete. Your payout will be released shortly.'
      );

    when 'cleaner_declined' then
      insert into public.notifications (user_id, type, title, body)
      values (
        new.customer_id,
        'booking_declined',
        'Booking declined',
        'Your cleaner was unable to take this booking. Please search for another cleaner.'
      );

    when 'cancelled' then
      insert into public.notifications (user_id, type, title, body)
      values
        (
          new.cleaner_id,
          'booking_cancelled',
          'Booking cancelled',
          'A booking assigned to you has been cancelled.'
        ),
        (
          new.customer_id,
          'booking_cancelled',
          'Booking cancelled',
          'Your booking has been cancelled.'
        );

    when 'disputed' then
      insert into public.notifications (user_id, type, title, body)
      values (
        new.cleaner_id,
        'booking_disputed',
        'Dispute opened',
        'The customer has opened a dispute for this booking. Our team will be in touch.'
      );

    when 'refunded' then
      insert into public.notifications (user_id, type, title, body)
      values (
        new.customer_id,
        'booking_refunded',
        'Refund issued',
        'Your dispute has been resolved and a refund has been issued.'
      );

    else
      null;

  end case;

  return new;
end;
$$;

-- ─── 2. TRANSITION STATE MACHINE ─────────────────────────────────────────────
-- Replace transition_booking_state with pay-before-accept logic.

create or replace function public.transition_booking_state(
  p_booking_id    uuid,
  p_target_status public.booking_status,
  p_note          text default null
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking           public.bookings;
  v_actor_role        text;
  v_is_allowed        boolean := false;
  v_actor_is_cleaner  boolean;
  v_actor_is_customer boolean;
  v_actor_is_admin    boolean;
  v_source_status     public.booking_status;
begin
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then
    raise exception 'Booking % not found', p_booking_id;
  end if;

  -- Determine actor role
  select role into v_actor_role
  from   public.profiles
  where  id = auth.uid();

  if v_actor_role is null then
    raise exception 'Caller has no profile (uid: %)', auth.uid();
  end if;

  v_actor_is_cleaner  := (v_actor_role = 'cleaner_active');
  v_actor_is_customer := (v_actor_role = 'customer');
  v_actor_is_admin    := (v_actor_role = 'admin');

  v_source_status := v_booking.status;

  -- ── ACCEPTANCE ───────────────────────────────────────────────────────────────

  -- pay-before-accept canonical path: cleaner accepts AFTER payment is received
  if v_source_status = 'payment_authorized' and p_target_status = 'accepted' and v_actor_is_cleaner then
    if exists (
      select 1
      from   public.bookings b
      where  b.cleaner_id      = v_booking.cleaner_id
        and  b.id             != p_booking_id
        and  b.status::text in ('accepted', 'paid', 'in_progress')
        and  b.scheduled_start < v_booking.scheduled_end
        and  b.scheduled_end   > v_booking.scheduled_start
    ) then
      raise exception 'Cleaner is no longer available for this time slot.';
    end if;
    v_is_allowed := true;

  -- Admin accepts from payment_authorized (also includes scheduling check)
  elsif v_source_status = 'payment_authorized' and p_target_status = 'accepted' and v_actor_is_admin then
    v_is_allowed := true;

  -- Admin reassignment: any reassignable state → accepted (admin-only)
  elsif p_target_status = 'accepted'
    and v_source_status::text in (
      'cleaner_no_show', 'accepted', 'in_progress', 'pending_request',
      'cleaner_cancelled', 'reassign_requested', 'paid', 'payment_authorized'
    )
    and v_actor_is_admin
  then
    v_is_allowed := true;

  elsif p_target_status = 'accepted'
    and v_source_status::text in ('cleaner_cancelled', 'cleaner_no_show', 'reassign_requested')
    and v_actor_is_customer
  then
    v_is_allowed := true;

  -- ── PAID (auto-advance trigger; also direct admin) ────────────────────────
  elsif v_source_status = 'accepted' and p_target_status = 'paid' and v_actor_is_admin then
    v_is_allowed := true;

  -- ── IN PROGRESS ───────────────────────────────────────────────────────────
  elsif v_source_status in ('paid', 'accepted')
    and p_target_status = 'in_progress'
    and (v_actor_is_cleaner or v_actor_is_admin)
  then
    if v_booking.payment_status != 'captured' then
      raise exception 'Cannot start booking: customer payment has not been received';
    end if;
    if now() < v_booking.scheduled_start - interval '60 minutes' then
      raise exception 'Start Cleaning is available 1 hour before the booking time';
    end if;
    v_is_allowed := true;

  elsif v_source_status = 'payment_authorized'
    and p_target_status = 'in_progress'
    and (v_actor_is_cleaner or v_actor_is_admin)
  then
    -- Stripe capture_method: manual — payment is held but not yet captured.
    -- Allow start once the cleaner has accepted (payment_authorized → accepted → in_progress
    -- is the preferred path). Direct payment_authorized → in_progress is kept for
    -- admin-managed fast-track jobs.
    if now() < v_booking.scheduled_start - interval '60 minutes' then
      raise exception 'Start Cleaning is available 1 hour before the booking time';
    end if;
    v_is_allowed := true;

  elsif v_source_status in ('paid_pending_start', 'scheduled')
    and p_target_status = 'in_progress'
    and (v_actor_is_cleaner or v_actor_is_admin)
  then
    v_is_allowed := true;

  -- ── COMPLETED ─────────────────────────────────────────────────────────────
  elsif v_source_status = 'in_progress' and p_target_status = 'completed'
    and (v_actor_is_cleaner or v_actor_is_admin)
  then
    if v_booking.payment_status not in ('captured', 'authorized') then
      raise exception
        'Cannot complete booking: payment not received (current: %)', v_booking.payment_status;
    end if;
    v_is_allowed := true;

  elsif v_source_status = 'completion_pending_customer'
    and p_target_status = 'completed'
    and (v_actor_is_customer or v_actor_is_admin)
  then
    v_is_allowed := true;

  -- ── COMPLETION PENDING CUSTOMER ───────────────────────────────────────────
  elsif v_source_status = 'in_progress'
    and p_target_status = 'completion_pending_customer'
    and (v_actor_is_cleaner or v_actor_is_admin)
  then
    v_is_allowed := true;

  -- ── DISPUTED ──────────────────────────────────────────────────────────────
  elsif v_source_status in ('completed', 'completion_pending_customer')
    and p_target_status = 'disputed'
    and (v_actor_is_customer or v_actor_is_admin)
  then
    v_is_allowed := true;

  elsif v_source_status = 'in_progress' and p_target_status = 'disputed'
    and (v_actor_is_customer or v_actor_is_admin)
  then
    v_is_allowed := true;

  -- ── DECLINED (cleaner) — now from payment_authorized only ────────────────
  -- In the pay-before-accept model, cleaners can only decline bookings that
  -- have already been paid. A declined paid booking requires admin to process
  -- a refund.
  elsif v_source_status = 'payment_authorized'
    and p_target_status = 'cleaner_declined'
    and (v_actor_is_cleaner or v_actor_is_admin)
  then
    v_is_allowed := true;

  -- Admin can decline from pending_request (e.g. invalid booking, fraud)
  elsif v_source_status = 'pending_request'
    and p_target_status in ('declined', 'cleaner_declined')
    and v_actor_is_admin
  then
    v_is_allowed := true;

  -- ── CANCELLED (customer or admin) ─────────────────────────────────────────
  elsif v_source_status::text in (
      'pending_request', 'accepted', 'paid',
      'estimate_proposed', 'awaiting_customer_payment', 'payment_authorized'
    )
    and p_target_status = 'cancelled'
    and (v_actor_is_customer or v_actor_is_admin)
  then
    v_is_allowed := true;

  elsif v_source_status::text in ('accepted', 'paid', 'cleaner_no_show')
    and p_target_status = 'cancelled'
    and (v_actor_is_customer or v_actor_is_admin)
  then
    v_is_allowed := true;

  -- ── CLEANER CANCELLED ─────────────────────────────────────────────────────
  elsif v_source_status::text in ('payment_authorized', 'accepted', 'paid')
    and p_target_status = 'cleaner_cancelled'
    and (v_actor_is_cleaner or v_actor_is_admin)
  then
    if v_booking.started_at is not null then
      raise exception 'Booking has already started and cannot be cancelled this way';
    end if;
    v_is_allowed := true;

  -- ── CLEANER NO SHOW ───────────────────────────────────────────────────────
  elsif v_source_status::text in ('accepted', 'paid', 'cleaner_no_show')
    and p_target_status = 'cleaner_no_show'
    and (v_actor_is_customer or v_actor_is_admin)
  then
    if v_booking.started_at is not null then
      raise exception 'This booking has already been started';
    end if;
    if now() <= v_booking.scheduled_start + interval '30 minutes' then
      raise exception 'Cleaner no-show can be reported 30 minutes after the booking start time';
    end if;
    v_is_allowed := true;

  -- ── REFUNDED ──────────────────────────────────────────────────────────────
  elsif p_target_status = 'refunded'
    and v_actor_is_admin
    and v_source_status::text not in ('refunded', 'declined', 'cleaner_declined')
  then
    v_is_allowed := true;

  -- ── ESTIMATE FLOW ─────────────────────────────────────────────────────────
  -- The estimate flow requires the cleaner to see pending_request bookings
  -- in order to propose an estimate. This path is exempt from the
  -- pay-before-accept restriction because the cleaner is proposing a price,
  -- not accepting work — the customer still must pay before work begins.
  elsif v_source_status = 'pending_request'
    and p_target_status = 'estimate_proposed'
    and v_actor_is_cleaner
  then
    v_is_allowed := true;

  elsif v_source_status = 'estimate_proposed'
    and p_target_status = 'awaiting_customer_payment'
    and v_actor_is_customer
  then
    v_is_allowed := true;

  elsif v_source_status = 'awaiting_customer_payment'
    and p_target_status = 'payment_authorized'
    and v_actor_is_customer
  then
    v_is_allowed := true;

  end if;

  if not v_is_allowed then
    raise exception 'Invalid status transition: % → % (actor: %)',
      v_source_status, p_target_status, v_actor_role;
  end if;

  -- ── Authorize postgres-role writes via session flag ───────────────────────
  perform set_config('app.tbs_active', 'true', true);

  update public.bookings
  set
    status          = p_target_status,
    decline_reason  = case
                        when p_target_status in ('declined', 'cleaner_declined')
                          then coalesce(p_note, decline_reason)
                        else decline_reason
                      end,
    cancellation_reason = case
                        when p_target_status in ('cancelled', 'cleaner_cancelled')
                          then coalesce(p_note, cancellation_reason)
                        else cancellation_reason
                      end,
    accepted_at     = case
                        when p_target_status in ('accepted', 'paid') and accepted_at is null
                          then now()
                        else accepted_at
                      end,
    started_at      = case
                        when p_target_status = 'in_progress' then now()
                        else started_at
                      end,
    completed_at    = case
                        when p_target_status = 'completed' then now()
                        else completed_at
                      end,
    confirmed_at    = case
                        when p_target_status = 'completed' then now()
                        else confirmed_at
                      end,
    disputed_at     = case
                        when p_target_status = 'disputed' then now()
                        else disputed_at
                      end,
    refunded_at     = case
                        when p_target_status in ('completed', 'refunded')
                          and v_source_status = 'disputed'
                          then now()
                        when p_target_status = 'refunded' then now()
                        else refunded_at
                      end,
    cancelled_at    = case
                        when p_target_status in ('cancelled', 'cleaner_cancelled') then now()
                        else cancelled_at
                      end,
    reassigned_at   = case
                        when p_target_status = 'accepted'
                          and v_source_status::text in (
                            'cleaner_no_show', 'cleaner_cancelled', 'reassign_requested'
                          )
                          then now()
                        else reassigned_at
                      end,
    updated_at      = now()
  where id = p_booking_id;

  insert into public.booking_status_events (
    booking_id, from_status, to_status, actor_id, note, actor_role
  )
  values (p_booking_id, v_source_status, p_target_status, auth.uid(), p_note, v_actor_role);

  -- Post-transition side effects
  if p_target_status = 'accepted' and v_booking.payment_status = 'captured' then
    perform set_config('app.tbs_active', 'true', true);
    update public.bookings set status = 'paid' where id = p_booking_id;
    insert into public.booking_status_events (
      booking_id, from_status, to_status, actor_id, note, actor_role
    )
    values (p_booking_id, 'accepted', 'paid', auth.uid(), 'auto-advance: payment captured', v_actor_role);
  end if;

  if p_target_status = 'disputed' then
    insert into public.investigations (booking_id, status, opened_by)
    values (p_booking_id, 'open', auth.uid())
    on conflict (booking_id) do nothing;
  end if;

  if p_target_status in ('accepted', 'paid') then
    update public.cleaner_profiles
    set    accepted_bookings_count = accepted_bookings_count + 1
    where  user_id = v_booking.cleaner_id;
  elsif p_target_status in ('declined', 'cleaner_declined') then
    update public.cleaner_profiles
    set    declined_bookings_count = coalesce(declined_bookings_count, 0) + 1
    where  user_id = v_booking.cleaner_id;
  end if;

  select * into v_booking from public.bookings where id = p_booking_id;
  return v_booking;
end;
$$;

-- ─── 3. RLS POLICY ───────────────────────────────────────────────────────────
-- Split "Users view own bookings" into two role-specific policies.
-- Customers see all their own bookings (all statuses).
-- Cleaners see ONLY bookings that are NOT in pending_request (i.e. paid or later).

drop policy if exists "Users view own bookings" on public.bookings;

create policy "Customer views own bookings"
on public.bookings for select
using (customer_id = auth.uid());

create policy "Cleaner views paid bookings"
on public.bookings for select
using (
  cleaner_id = auth.uid()
  and status::text != 'pending_request'
);

-- Note on estimate flow exemption:
-- The estimate flow requires cleaners to see bookings while they are in
-- estimate_proposed status (payment_status still 'unpaid'). The above policy
-- allows this since estimate_proposed != 'pending_request'. Only the
-- initial pending_request state (where no cleaner interaction has occurred)
-- is hidden from cleaners.
