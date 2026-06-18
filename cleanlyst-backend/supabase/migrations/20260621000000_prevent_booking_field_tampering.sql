-- =============================================================================
-- SECURITY: Prevent direct booking field manipulation from authenticated clients
-- =============================================================================
-- Problem: The "Cleaner updates own bookings" and "Customer updates own bookings"
-- RLS policies allow any UPDATE column on the bookings table, meaning a malicious
-- client could directly set status, payment_status, quote_cents, or cleaner_payout_cents
-- without going through the validated state-machine RPCs.
--
-- Fix: A BEFORE UPDATE trigger that blocks changes to protected fields when the
-- update comes from a direct authenticated session (current_user = 'authenticated'
-- or 'anon'). Security-definer RPCs run as the function owner ('postgres'), so
-- they bypass this guard transparently.
--
-- Fields protected from direct client mutation:
--   status              — must go through transition_booking_state / cancel_booking RPCs
--   payment_status      — set by record_initial_payment / admin RPCs only
--   quote_cents         — locked at booking creation
--   cleaner_payout_cents — set by record_initial_payment / admin RPCs only
--   customer_id         — immutable after creation
--   cleaner_id          — changed only via admin_reassign_booking RPC

create or replace function public.prevent_booking_field_tampering()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Allow mutations from security-definer RPCs (current_user = owner, i.e. 'postgres')
  -- and service role. Only block direct authenticated/anon client updates.
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if old.status is distinct from new.status then
    raise exception
      'Unauthorized: booking status changes must go through approved RPCs (attempted % → %)',
      old.status, new.status;
  end if;

  if old.payment_status is distinct from new.payment_status then
    raise exception
      'Unauthorized: payment_status changes must go through approved RPCs';
  end if;

  if old.quote_cents is distinct from new.quote_cents then
    raise exception
      'Unauthorized: quote_cents cannot be modified after booking creation';
  end if;

  if old.cleaner_payout_cents is distinct from new.cleaner_payout_cents then
    raise exception
      'Unauthorized: cleaner_payout_cents cannot be modified directly';
  end if;

  if old.customer_id is distinct from new.customer_id then
    raise exception
      'Unauthorized: customer_id is immutable';
  end if;

  if old.cleaner_id is distinct from new.cleaner_id then
    raise exception
      'Unauthorized: cleaner_id can only be changed via the reassignment RPC';
  end if;

  return new;
end;
$$;

create or replace trigger trg_prevent_booking_field_tampering
before update on public.bookings
for each row execute function public.prevent_booking_field_tampering();

-- Prevent direct invocation of the trigger function itself
revoke execute on function public.prevent_booking_field_tampering() from public;
revoke execute on function public.prevent_booking_field_tampering() from anon;
