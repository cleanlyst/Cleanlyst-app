-- =============================================================================
-- PHASE L — closed beta launch readiness hardening
-- =============================================================================
-- Two independent gaps found while adversarially testing every workflow per
-- the Phase L brief ("attempt duplicate booking", storage bucket review).
-- Neither is a redesign — both are additive, minimal-risk fixes.
-- =============================================================================

-- ── 1. Duplicate booking prevention ──────────────────────────────────────────
-- prevent_cleaner_double_booking (20260511130000) deliberately excludes
-- pre-payment states ('pending_request', 'estimate_proposed') so that
-- DIFFERENT customers can request the same cleaner/slot simultaneously —
-- correct, documented behaviour. But nothing stopped the SAME customer from
-- creating multiple duplicate pending requests for the identical
-- cleaner+slot (e.g. two browser tabs, a network retry after an apparent
-- failure, or a double-click that raced past the client-side `paying` guard
-- since that guard is per-tab, in-memory state).
--
-- A partial unique index is the correct enforcement point: atomic (no
-- check-then-insert race, unlike a trigger doing a SELECT EXISTS check —
-- Postgres enforces uniqueness at the index level), and scoped only to
-- not-yet-paid statuses so it never blocks a legitimate new request once
-- the earlier one has moved on (paid, cancelled, declined, etc. all fall
-- outside the partial index's WHERE clause).
create unique index if not exists bookings_no_duplicate_pending_request
on public.bookings (customer_id, cleaner_id, scheduled_start)
where status in ('pending_request', 'estimate_proposed', 'awaiting_customer_payment');

-- ── 2. Storage: avatars bucket had no RLS policies at all ───────────────────
-- storage.objects has RLS enabled (Supabase default). Policies exist for
-- the cleaner-documents bucket (20260525100002) but none for `avatars`,
-- despite profileService.uploadAvatar() writing to
-- avatars/{auth.uid()}/avatar.{ext}. With RLS enabled and zero matching
-- policies, Postgres denies by default — so either uploads were silently
-- relying on bucket-level "public" dashboard configuration (unauditable
-- from migrations, and typically does not grant unauthenticated INSERT/
-- UPDATE even when it grants public read), or write access was
-- unintentionally wide open. This makes the intended behaviour explicit and
-- version-controlled rather than dependent on Dashboard configuration:
-- anyone can view avatars (they're public-facing profile images), but only
-- the owning user may write to their own folder.
create policy "Public reads avatars"
on storage.objects
for select
using (bucket_id = 'avatars');

create policy "Users upload own avatar"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users update own avatar"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users delete own avatar"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);
