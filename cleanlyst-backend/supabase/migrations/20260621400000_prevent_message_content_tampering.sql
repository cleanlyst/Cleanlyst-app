-- =============================================================================
-- FIX P1: messages — RLS UPDATE policy allows mutation of any column
-- =============================================================================
-- Root cause: The "Participants mark messages read" RLS policy
-- (20260511120000_complete_rls_policies.sql) uses only is_booking_participant()
-- as the guard, with no column restriction. A participant with a custom Supabase
-- client can update message, sender_id, booking_id, or any other field on any
-- message in a booking they are part of.
--
-- Fix: Add a BEFORE UPDATE trigger (mirroring prevent_booking_field_tampering)
-- that blocks direct authenticated/anon sessions from modifying any column
-- except read_at. Security-definer RPCs run as 'postgres' and are exempt.

create or replace function public.prevent_message_content_tampering()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only enforce for direct client sessions; SECURITY DEFINER RPCs bypass this.
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if old.message is distinct from new.message then
    raise exception 'Unauthorized: message content is immutable after sending';
  end if;

  if old.sender_id is distinct from new.sender_id then
    raise exception 'Unauthorized: sender_id cannot be changed';
  end if;

  if old.booking_id is distinct from new.booking_id then
    raise exception 'Unauthorized: booking_id is immutable';
  end if;

  if old.created_at is distinct from new.created_at then
    raise exception 'Unauthorized: created_at is immutable';
  end if;

  return new;
end;
$$;

create or replace trigger trg_prevent_message_content_tampering
before update on public.messages
for each row execute function public.prevent_message_content_tampering();

-- Prevent direct invocation of the trigger function
revoke execute on function public.prevent_message_content_tampering() from public;
revoke execute on function public.prevent_message_content_tampering() from anon;
