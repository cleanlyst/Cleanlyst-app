-- ── Security Audit — 2026-06-27 ──────────────────────────────────────────────
--
-- FINDINGS: All items below verified against source code and DB schema.
-- Status: ✅ OK  ⚠️ Remediated here  ℹ️ Note
--
-- 1. CLIENT-VISIBLE SECRETS
--    ✅ Only publishable Stripe keys (pk_*) in VITE_ env vars.
--    ✅ STRIPE_SECRET_KEY only in Edge Function secrets (Deno.env.get).
--    ✅ SUPABASE_SERVICE_ROLE_KEY only in Edge Function secrets.
--    ✅ Stripe webhook secret (STRIPE_WEBHOOK_SECRET) only in Edge Functions.
--    ✅ No database passwords in frontend codebase.
--
-- 2. ROW-LEVEL SECURITY
--    ✅ RLS enabled on: bookings, payments, payouts, profiles,
--       cleaner_profiles, cleaner_applications, notifications,
--       booking_status_events, reviews, ledger_entries,
--       error_events (new), analytics_events (new), cron_execution_log (new).
--    ✅ Anon users cannot read any table that requires auth.
--    ✅ Customers can only read/write their own rows.
--    ✅ Cleaners can only read bookings assigned to them.
--
-- 3. ADMIN ENDPOINTS
--    ✅ All admin Edge Functions call requireRole(req, admin, 'admin').
--    ✅ Admin Vue routes have requiresRole: 'admin' in router meta.
--    ✅ Router beforeEach guard enforces role check before rendering.
--    ✅ admin-analytics, refund-payment, release-payout, process-payout all
--       call requireRole or makeAdminClient with server-side auth check.
--
-- 4. SECURITY DEFINER FUNCTIONS
--    ✅ All SECURITY DEFINER functions either:
--       (a) validate caller ownership before mutating, or
--       (b) are service_role-only with REVOKE from public/anon/authenticated.
--    ✅ mark_overdue_bookings() — revoked from all non-service_role.
--    ✅ report_no_show_overdue(uuid) — validates auth.uid() = customer before transition.
--    ✅ complete_booking_and_record_payment() — validates status guard and ownership.
--    ✅ admin_process_refund() — validates admin role via SET ROLE check.
--
-- 5. STATUS WRITE GUARD
--    ✅ guard_booking_status_write trigger: enforces that booking.status can
--       only be updated when EITHER (a) current_role IN (service_role, postgres,
--       supabase_admin) AND app.tbs_active = 'true', OR (b) the transition is
--       allowed by the approved transition matrix for the calling role.
--    ✅ No client-side code can bypass this trigger.
--
-- 6. STRIPE WEBHOOK INTEGRITY
--    ✅ stripe-webhook Edge Function verifies Stripe-Signature header using
--       constructEventAsync before processing any payload.
--    ✅ Replays are idempotent: payment_webhook_events has a unique constraint
--       on stripe_event_id; duplicate webhooks are silently ignored.
--
-- 7. STORAGE
--    ℹ️ Avatar uploads go to Supabase Storage bucket.
--       Bucket-level policies should be verified in Supabase Dashboard:
--       authenticated users should only be able to upload to their own path.
--       Recommend: bucket policy 'user can only upload to avatars/{auth.uid()}/*'.
--
-- 8. REALTIME SUBSCRIPTIONS
--    ℹ️ Realtime inherits RLS — a subscribed customer cannot receive another
--       customer's booking events. Verified by Supabase RLS-aware Realtime.
--
-- REMEDIATION IN THIS MIGRATION:
-- ⚠️ Harden insert policy on error_events — users can insert but NOT update/delete.
-- ⚠️ Harden insert policy on analytics_events — same.
-- ⚠️ Explicitly deny update/delete on observability tables for all non-service_role.

-- Deny mutations on error_events for non-service-role
create policy "deny_update_error_events" on public.error_events
  as restrictive
  for update
  using (false);

create policy "deny_delete_error_events" on public.error_events
  as restrictive
  for delete
  using (false);

-- Deny mutations on analytics_events for non-service-role
create policy "deny_update_analytics_events" on public.analytics_events
  as restrictive
  for update
  using (false);

create policy "deny_delete_analytics_events" on public.analytics_events
  as restrictive
  for delete
  using (false);

-- cron_execution_log: no permissive INSERT policy exists (migration 000010),
-- so only service_role (which bypasses RLS) can insert — no extra policy needed.
-- Add restrictive update/delete guards for completeness.
create policy "deny_update_cron_log" on public.cron_execution_log
  as restrictive
  for update
  using (false);

create policy "deny_delete_cron_log" on public.cron_execution_log
  as restrictive
  for delete
  using (false);
