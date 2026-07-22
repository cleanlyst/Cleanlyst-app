-- ── Phase B7 — Booking State Machine Canonicalisation ───────────────────────
--
-- ROOT CAUSE
-- ----------
-- Migration 20260622300000_unify_booking_status_transitions.sql correctly:
--   1. DROPs the legacy 3-param function:
--      transition_booking_state(uuid, booking_status, text)
--   2. Creates the canonical 5-param function:
--      transition_booking_state(uuid, booking_status, text, timestamptz, boolean)
--
-- Migration 20260701000002_pay_before_accept.sql then:
--   3. RE-CREATES the 3-param function via CREATE OR REPLACE — but since the
--      signature differs from the 5-param, PostgreSQL treats this as a NEW
--      overload rather than replacing the existing function.
--
-- Migration 20260701000003_estimate_adjustment.sql:
--   4. Replaces the 5-param function only (correct), leaving BOTH overloads live.
--
-- With two functions that both match a 3-argument call site, PostgreSQL raises:
--   "function public.transition_booking_state(uuid, booking_status, text) is not unique"
--
-- This error surfaces as HTTP 400 from report_cleaner_no_show, cancel_booking_customer,
-- and cleaner_cannot_attend — all of which call transition_booking_state with 3 args.
--
-- FIX
-- ---
-- Drop the stale 3-param overload introduced by 20260701000002.
-- The canonical 5-param function (from 20260701000003_estimate_adjustment.sql) is a
-- strict superset:
--   • Contains all pay-before-accept state transitions from 20260701000002
--   • Adds estimate_adjustment_requested transitions
--   • Uses derive_payment_state_from_ledger() (authoritative payment source)
--   • Uses is_admin() (robust role check)
--   • Exposes p_notify=false flag used by reassign_booking and admin_process_refund
--   • Exposes p_reassigned_at used by reassign_booking and customer_reassign_booking
--
-- Callers using 2 or 3 positional/named args resolve unambiguously to the 5-param
-- function because its last two params (p_reassigned_at, p_notify) have defaults.
--
-- NO caller changes are required — the calling RPCs are not modified.
-- NO trigger changes are required — no trigger calls transition_booking_state directly.

-- ── 1. Drop the stale 3-param overload ──────────────────────────────────────

drop function if exists public.transition_booking_state(
  uuid,
  public.booking_status,
  text
);

-- ── 2. Confirm canonical 5-param grant is in place ──────────────────────────
-- (already granted by 20260701000003; repeated here for idempotency and
--  to make this migration self-documenting)

grant execute on function public.transition_booking_state(
  uuid,
  public.booking_status,
  text,
  timestamptz,
  boolean
) to authenticated;

-- ── 3. Sanity check comment on canonical function ────────────────────────────
-- Documents the intended single canonical definition so future migrations
-- know which signature to use.

comment on function public.transition_booking_state(
  uuid,
  public.booking_status,
  text,
  timestamptz,
  boolean
) is
  'Canonical booking state machine. Single authoritative writer for bookings.status. '
  'All status changes MUST go through this function or through RPCs that call it. '
  'The 3-param overload (uuid, booking_status, text) was removed in migration '
  '20260702000001_canonicalise_transition_booking_state.sql to eliminate ambiguity.';
