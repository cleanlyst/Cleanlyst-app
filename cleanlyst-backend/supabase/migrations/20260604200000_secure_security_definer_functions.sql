-- ============================================================
-- SECURITY: Lock down SECURITY DEFINER functions from anon
-- ============================================================
-- Supabase linter lint=0028_anon_security_definer_function_executable
--
-- Root cause: PostgreSQL defaults to granting EXECUTE on new functions
-- to PUBLIC, which includes the anon role. Every SECURITY DEFINER
-- function in the public schema is therefore callable unauthenticated
-- via the REST API (/rest/v1/rpc/<name>).
--
-- Strategy per function type:
--   A) RLS helpers (is_admin, is_customer, etc.)
--      SECURITY DEFINER is mandatory — prevents query-planner inlining
--      that causes profiles ↔ cleaner_profiles RLS recursion (see
--      20260517120000_fix_rls_role_function_recursion.sql).
--      → REVOKE from public + anon, GRANT to authenticated + service_role.
--
--   B) Booking / application lifecycle RPCs
--      SECURITY DEFINER is mandatory — these functions write to tables
--      whose RLS policies are scoped to the calling user and do not
--      allow cross-table writes that the function body requires.
--      All have internal auth.uid() / is_admin() checks, so anon
--      callers would always get "Not authorised" — but we block them
--      at the privilege layer instead.
--      → REVOKE from public + anon, GRANT to authenticated.
--      complete_booking and create_notification additionally need
--      service_role for Edge Function / payment webhook callers.
--
--   C) Trigger functions (returns trigger)
--      Called by PostgreSQL internally when the trigger fires — never
--      need to be callable via the REST API. SECURITY DEFINER is
--      required so the trigger body runs as the function owner and
--      can bypass RLS on target tables.
--      → REVOKE from public + anon only.  No user-facing GRANT needed.
-- ============================================================

-- ============================================================
-- A. RLS HELPER FUNCTIONS
-- ============================================================

-- is_admin
revoke execute on function public.is_admin() from public;
revoke execute on function public.is_admin() from anon;
grant  execute on function public.is_admin() to authenticated, service_role;

-- is_cleaner
revoke execute on function public.is_cleaner() from public;
revoke execute on function public.is_cleaner() from anon;
grant  execute on function public.is_cleaner() to authenticated, service_role;

-- is_cleaner_pending
revoke execute on function public.is_cleaner_pending() from public;
revoke execute on function public.is_cleaner_pending() from anon;
grant  execute on function public.is_cleaner_pending() to authenticated, service_role;

-- is_cleaner_active
revoke execute on function public.is_cleaner_active() from public;
revoke execute on function public.is_cleaner_active() from anon;
grant  execute on function public.is_cleaner_active() to authenticated, service_role;

-- is_customer
revoke execute on function public.is_customer() from public;
revoke execute on function public.is_customer() from anon;
grant  execute on function public.is_customer() to authenticated, service_role;

-- is_booking_participant — used in RLS policies; auth.uid() check inside
revoke execute on function public.is_booking_participant(uuid) from public;
revoke execute on function public.is_booking_participant(uuid) from anon;
grant  execute on function public.is_booking_participant(uuid) to authenticated, service_role;

-- ============================================================
-- B. BOOKING / APPLICATION LIFECYCLE RPCs
-- ============================================================

-- accept_booking — cleaner accepts a pending request; auth.uid() check inside
revoke execute on function public.accept_booking(uuid) from public;
revoke execute on function public.accept_booking(uuid) from anon;
grant  execute on function public.accept_booking(uuid) to authenticated;

-- admin_review_cleaner_application — is_admin() check inside
revoke execute on function public.admin_review_cleaner_application(uuid, public.application_status, text, text) from public;
revoke execute on function public.admin_review_cleaner_application(uuid, public.application_status, text, text) from anon;
grant  execute on function public.admin_review_cleaner_application(uuid, public.application_status, text, text) to authenticated;

-- cancel_booking_customer — customer_id = auth.uid() check inside
revoke execute on function public.cancel_booking_customer(uuid, text) from public;
revoke execute on function public.cancel_booking_customer(uuid, text) from anon;
grant  execute on function public.cancel_booking_customer(uuid, text) to authenticated;

-- cleaner_cannot_attend — cleaner_id = auth.uid() check inside
revoke execute on function public.cleaner_cannot_attend(uuid, text) from public;
revoke execute on function public.cleaner_cannot_attend(uuid, text) from anon;
grant  execute on function public.cleaner_cannot_attend(uuid, text) to authenticated;

-- complete_booking — cleaner_id = auth.uid() check; also called by payment webhooks
revoke execute on function public.complete_booking(uuid) from public;
revoke execute on function public.complete_booking(uuid) from anon;
grant  execute on function public.complete_booking(uuid) to authenticated, service_role;

-- cleaner_has_booking_conflict — no auth check; reads bookings bypassing RLS
-- (customers need this to verify slot availability before booking)
revoke execute on function public.cleaner_has_booking_conflict(uuid, timestamptz, timestamptz) from public;
revoke execute on function public.cleaner_has_booking_conflict(uuid, timestamptz, timestamptz) from anon;
grant  execute on function public.cleaner_has_booking_conflict(uuid, timestamptz, timestamptz) to authenticated;

-- get_cleaner_availability_for_day — no auth check; scoped to approved cleaners only
revoke execute on function public.get_cleaner_availability_for_day(uuid, smallint) from public;
revoke execute on function public.get_cleaner_availability_for_day(uuid, smallint) from anon;
grant  execute on function public.get_cleaner_availability_for_day(uuid, smallint) to authenticated;

-- create_notification — utility called from RPCs and Edge Functions
revoke execute on function public.create_notification(uuid, text, text, text) from public;
revoke execute on function public.create_notification(uuid, text, text, text) from anon;
grant  execute on function public.create_notification(uuid, text, text, text) to authenticated, service_role;

-- ============================================================
-- C. TRIGGER FUNCTIONS — revoke anon/public access only
--    PostgreSQL calls these internally; they must not be
--    reachable via the REST API.
-- ============================================================

-- handle_new_user — fires on auth.users INSERT
revoke execute on function public.handle_new_user() from public;
revoke execute on function public.handle_new_user() from anon;

-- create_conversation_for_booking — fires on bookings INSERT
revoke execute on function public.create_conversation_for_booking() from public;
revoke execute on function public.create_conversation_for_booking() from anon;

-- increment_cleaner_jobs_on_completion — fires on bookings UPDATE
revoke execute on function public.increment_cleaner_jobs_on_completion() from public;
revoke execute on function public.increment_cleaner_jobs_on_completion() from anon;

-- notify_booking_participants — fires on bookings INSERT/UPDATE
revoke execute on function public.notify_booking_participants() from public;
revoke execute on function public.notify_booking_participants() from anon;

-- notify_cleaner_on_application_status — fires on cleaner_applications UPDATE
revoke execute on function public.notify_cleaner_on_application_status() from public;
revoke execute on function public.notify_cleaner_on_application_status() from anon;

-- prevent_cleaner_double_booking — fires on bookings INSERT/UPDATE
revoke execute on function public.prevent_cleaner_double_booking() from public;
revoke execute on function public.prevent_cleaner_double_booking() from anon;
