-- =========================
-- COMPLETE RLS POLICY RESET
-- =========================
-- Drops every existing policy on every table and recreates the full
-- authoritative set. Run this once; all future policy changes go here.
--
-- Access model summary:
--   customer      → own records, own bookings, public cleaner data
--   cleaner       → own records, assigned bookings, own availability/services
--   admin         → full read/write on all tables
--   service role  → bypasses RLS entirely (Edge Functions, webhooks)
--   anon          → waitlist signup RPC only; no direct table access

-- =========================
-- HELPER: BOOKING PARTICIPANT CHECK
-- =========================
-- Used in policies for tables linked to a booking. The security definer
-- ensures the check succeeds even on tables whose own RLS would otherwise
-- block the read; it leaks no data because it only returns a boolean.
create or replace function public.is_booking_participant(p_booking_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.bookings
    where id = p_booking_id
      and (customer_id = auth.uid() or cleaner_id = auth.uid())
  );
$$;

-- =========================
-- TABLE: profiles
-- =========================
drop policy if exists "Users view own profile"                   on public.profiles;
drop policy if exists "Users update own profile"                 on public.profiles;
drop policy if exists "Admin reads all profiles"                 on public.profiles;
drop policy if exists "Admin updates any profile"                on public.profiles;
drop policy if exists "Booking participants read each other"     on public.profiles;

-- Own record
create policy "Users view own profile"
on public.profiles for select
using (id = auth.uid());

-- Booking counterpart visibility: customer sees cleaner name/avatar and vice versa.
-- Exposes phone/email to booking participants intentionally (needed for coordination).
create policy "Booking participants read each other"
on public.profiles for select
using (
  exists (
    select 1 from public.bookings b
    where (b.customer_id = auth.uid() or b.cleaner_id = auth.uid())
      and (b.customer_id = profiles.id  or b.cleaner_id  = profiles.id)
  )
);

-- Admin full read
create policy "Admin reads all profiles"
on public.profiles for select
using (public.is_admin());

-- Own update (profile edits); role changes go through admin_review RPC only
create policy "Users update own profile"
on public.profiles for update
using (id = auth.uid())
with check (id = auth.uid());

-- Admin can update any profile (role promotion, suspension etc.)
create policy "Admin updates any profile"
on public.profiles for update
using (public.is_admin())
with check (public.is_admin());

-- INSERT: handle_new_user trigger is security definer; no direct insert needed.
-- DELETE: cascades from auth.users; no direct delete needed.

-- =========================
-- TABLE: cleaner_profiles
-- =========================
drop policy if exists "Public read approved cleaner profiles"    on public.cleaner_profiles;
drop policy if exists "Cleaner manages own cleaner profile"      on public.cleaner_profiles;
drop policy if exists "Cleaner reads own cleaner profile"        on public.cleaner_profiles;
drop policy if exists "Cleaner inserts own cleaner profile"      on public.cleaner_profiles;
drop policy if exists "Cleaner updates own cleaner profile"      on public.cleaner_profiles;
drop policy if exists "Admin reads all cleaner profiles"         on public.cleaner_profiles;
drop policy if exists "Admin updates any cleaner profile"        on public.cleaner_profiles;

-- Any visitor can browse approved cleaner profiles (marketplace listing)
create policy "Public read approved cleaner profiles"
on public.cleaner_profiles for select
using (status = 'approved');

-- Cleaner sees own profile regardless of status (e.g. while pending)
create policy "Cleaner reads own cleaner profile"
on public.cleaner_profiles for select
using (user_id = auth.uid());

-- Admin reads all cleaner profiles (review queue, support)
create policy "Admin reads all cleaner profiles"
on public.cleaner_profiles for select
using (public.is_admin());

-- Cleaner profile is created by handle_new_user trigger.
-- Allow direct insert as fallback if trigger was missed.
create policy "Cleaner inserts own cleaner profile"
on public.cleaner_profiles for insert
with check (user_id = auth.uid() and public.is_cleaner());

-- Cleaner updates own profile (bio, rate, radius, etc.)
create policy "Cleaner updates own cleaner profile"
on public.cleaner_profiles for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- Admin can update any cleaner profile (approval, suspension)
create policy "Admin updates any cleaner profile"
on public.cleaner_profiles for update
using (public.is_admin())
with check (public.is_admin());

-- No direct DELETE; cascades from profiles → auth.users.

-- =========================
-- TABLE: customer_preferences
-- =========================
drop policy if exists "Customer reads own preferences"           on public.customer_preferences;
drop policy if exists "Customer inserts own preferences"         on public.customer_preferences;
drop policy if exists "Customer updates own preferences"         on public.customer_preferences;
drop policy if exists "Admin reads customer preferences"         on public.customer_preferences;
drop policy if exists "Admin updates any customer preferences"   on public.customer_preferences;

create policy "Customer reads own preferences"
on public.customer_preferences for select
using (customer_id = auth.uid() and public.is_customer());

create policy "Customer inserts own preferences"
on public.customer_preferences for insert
with check (customer_id = auth.uid() and public.is_customer());

create policy "Customer updates own preferences"
on public.customer_preferences for update
using (customer_id = auth.uid() and public.is_customer())
with check (customer_id = auth.uid());

create policy "Admin reads customer preferences"
on public.customer_preferences for select
using (public.is_admin());

create policy "Admin updates any customer preferences"
on public.customer_preferences for update
using (public.is_admin())
with check (public.is_admin());

-- =========================
-- TABLE: cleaner_applications
-- =========================
drop policy if exists "Cleaner reads own application"            on public.cleaner_applications;
drop policy if exists "Cleaner inserts own application"          on public.cleaner_applications;
drop policy if exists "Cleaner updates own draft application"    on public.cleaner_applications;
drop policy if exists "Admin reads all applications"             on public.cleaner_applications;
drop policy if exists "Admin updates applications"               on public.cleaner_applications;

create policy "Cleaner reads own application"
on public.cleaner_applications for select
using (cleaner_id = auth.uid());

-- is_cleaner() covers both cleaner_pending and cleaner_active
create policy "Cleaner inserts own application"
on public.cleaner_applications for insert
with check (cleaner_id = auth.uid() and public.is_cleaner());

-- Cleaner may only edit while in draft or needs_info state
create policy "Cleaner updates own draft application"
on public.cleaner_applications for update
using (cleaner_id = auth.uid() and status in ('draft', 'needs_info'))
with check (cleaner_id = auth.uid());

create policy "Admin reads all applications"
on public.cleaner_applications for select
using (public.is_admin());

-- Admin approves/rejects/requests info via admin_review_cleaner_application RPC,
-- which is security definer. This policy covers any direct admin update as well.
create policy "Admin updates applications"
on public.cleaner_applications for update
using (public.is_admin())
with check (public.is_admin());

-- =========================
-- TABLE: cleaner_application_documents
-- =========================
drop policy if exists "Cleaner reads own docs"                   on public.cleaner_application_documents;
drop policy if exists "Cleaner upserts own docs"                 on public.cleaner_application_documents;
drop policy if exists "Cleaner edits own docs before approval"   on public.cleaner_application_documents;
drop policy if exists "Admin reads cleaner docs"                 on public.cleaner_application_documents;
drop policy if exists "Admin reviews cleaner docs"               on public.cleaner_application_documents;

create policy "Cleaner reads own docs"
on public.cleaner_application_documents for select
using (cleaner_id = auth.uid());

create policy "Cleaner inserts own docs"
on public.cleaner_application_documents for insert
with check (cleaner_id = auth.uid() and public.is_cleaner());

-- Cleaner may replace a document only while the application is still editable
create policy "Cleaner edits own docs before approval"
on public.cleaner_application_documents for update
using (
  cleaner_id = auth.uid()
  and exists (
    select 1 from public.cleaner_applications a
    where a.id = cleaner_application_documents.application_id
      and a.cleaner_id = auth.uid()
      and a.status in ('draft', 'needs_info')
  )
)
with check (cleaner_id = auth.uid());

create policy "Admin reads cleaner docs"
on public.cleaner_application_documents for select
using (public.is_admin());

-- Admin verifies documents as part of the review flow
create policy "Admin reviews cleaner docs"
on public.cleaner_application_documents for update
using (public.is_admin())
with check (public.is_admin());

-- =========================
-- TABLE: admin_application_reviews
-- =========================
-- Append-only audit log; UPDATE and DELETE are blocked by the immutability
-- trigger added in 20260511100500 regardless of RLS.
drop policy if exists "Admin creates review log"                 on public.admin_application_reviews;
drop policy if exists "Admin reads review log"                   on public.admin_application_reviews;
drop policy if exists "Cleaner reads own review log"             on public.admin_application_reviews;

create policy "Admin reads review log"
on public.admin_application_reviews for select
using (public.is_admin());

-- admin_id must match the acting admin
create policy "Admin inserts review log"
on public.admin_application_reviews for insert
with check (public.is_admin() and admin_id = auth.uid());

-- Cleaners may read decisions made about them
create policy "Cleaner reads own review log"
on public.admin_application_reviews for select
using (cleaner_id = auth.uid());

-- =========================
-- TABLE: services
-- =========================
drop policy if exists "Public can view active services"          on public.services;
drop policy if exists "Cleaner inserts own services"             on public.services;
drop policy if exists "Cleaner updates own services"             on public.services;
drop policy if exists "Cleaner deletes own services"             on public.services;
drop policy if exists "Admin reads all services"                 on public.services;
drop policy if exists "Admin manages services"                   on public.services;

-- Public browse: unauthenticated or authenticated can see active services
create policy "Public can view active services"
on public.services for select
using (active = true);

-- Cleaner sees own services regardless of active flag (to manage them)
create policy "Cleaner reads own services"
on public.services for select
using (cleaner_id = auth.uid());

-- Only fully approved cleaners can publish services
create policy "Cleaner inserts own services"
on public.services for insert
with check (cleaner_id = auth.uid() and public.is_cleaner_active());

create policy "Cleaner updates own services"
on public.services for update
using (cleaner_id = auth.uid())
with check (cleaner_id = auth.uid());

-- Soft delete preferred (active = false), but allow hard delete for own services
create policy "Cleaner deletes own services"
on public.services for delete
using (cleaner_id = auth.uid());

-- Admin reads all services including inactive (for moderation)
create policy "Admin reads all services"
on public.services for select
using (public.is_admin());

create policy "Admin manages services"
on public.services for all
using (public.is_admin())
with check (public.is_admin());

-- =========================
-- TABLE: availability_slots
-- =========================
drop policy if exists "Cleaner manages availability"             on public.availability_slots;
drop policy if exists "Cleaner inserts own availability"         on public.availability_slots;
drop policy if exists "Cleaner updates own availability"         on public.availability_slots;
drop policy if exists "Cleaner deletes own availability"         on public.availability_slots;
drop policy if exists "Cleaner reads own availability"           on public.availability_slots;
drop policy if exists "Authenticated users view cleaner availability" on public.availability_slots;
drop policy if exists "Admin reads all availability"             on public.availability_slots;

-- Customers need to browse availability when searching/booking
create policy "Authenticated users view cleaner availability"
on public.availability_slots for select
to authenticated
using (
  exists (
    select 1 from public.cleaner_profiles cp
    where cp.user_id = availability_slots.cleaner_id
      and cp.status = 'approved'
  )
  or cleaner_id = auth.uid()
  or public.is_admin()
);

-- Only active cleaners can set their own availability
create policy "Cleaner inserts own availability"
on public.availability_slots for insert
with check (cleaner_id = auth.uid() and public.is_cleaner_active());

create policy "Cleaner updates own availability"
on public.availability_slots for update
using (cleaner_id = auth.uid())
with check (cleaner_id = auth.uid());

create policy "Cleaner deletes own availability"
on public.availability_slots for delete
using (cleaner_id = auth.uid());

create policy "Admin reads all availability"
on public.availability_slots for select
using (public.is_admin());

-- =========================
-- TABLE: booking_requests
-- =========================
-- Policies "Customer manages own booking requests" was already dropped in
-- 20260511100500. The three replacement policies may already exist; drop
-- and recreate for a clean canonical state.
drop policy if exists "Customer reads own booking requests"      on public.booking_requests;
drop policy if exists "Customer creates own booking requests"    on public.booking_requests;
drop policy if exists "Customer updates own booking requests"    on public.booking_requests;
drop policy if exists "Cleaner reads assigned booking requests"  on public.booking_requests;
drop policy if exists "Cleaner updates assigned booking requests" on public.booking_requests;
drop policy if exists "Admin reads all booking requests"         on public.booking_requests;
drop policy if exists "Admin manages booking requests"           on public.booking_requests;

create policy "Customer reads own booking requests"
on public.booking_requests for select
using (customer_id = auth.uid() and public.is_customer());

create policy "Customer creates own booking requests"
on public.booking_requests for insert
with check (customer_id = auth.uid() and public.is_customer());

-- Customer can update (e.g. add note) while request is still unresponded
create policy "Customer updates own booking requests"
on public.booking_requests for update
using (customer_id = auth.uid() and public.is_customer())
with check (customer_id = auth.uid());

-- Active cleaners see requests assigned to them
create policy "Cleaner reads assigned booking requests"
on public.booking_requests for select
using (cleaner_id = auth.uid() and public.is_cleaner_active());

-- Cleaner responds (accept/decline, sets response note and responded_at)
create policy "Cleaner updates assigned booking requests"
on public.booking_requests for update
using (cleaner_id = auth.uid() and public.is_cleaner_active())
with check (cleaner_id = auth.uid());

create policy "Admin reads all booking requests"
on public.booking_requests for select
using (public.is_admin());

create policy "Admin manages booking requests"
on public.booking_requests for all
using (public.is_admin())
with check (public.is_admin());

-- No DELETE for anyone: once a cleaner has seen a request it must remain.

-- =========================
-- TABLE: bookings
-- =========================
drop policy if exists "Users view own bookings"                  on public.bookings;
drop policy if exists "Customers create bookings"                on public.bookings;
drop policy if exists "Cleaner updates own bookings"             on public.bookings;
drop policy if exists "Customer updates own bookings"            on public.bookings;
drop policy if exists "Admin reads all bookings"                 on public.bookings;
drop policy if exists "Admin manages bookings"                   on public.bookings;

-- Both parties see their own bookings
create policy "Users view own bookings"
on public.bookings for select
using (customer_id = auth.uid() or cleaner_id = auth.uid());

create policy "Admin reads all bookings"
on public.bookings for select
using (public.is_admin());

-- Customer initiates a booking
create policy "Customers create bookings"
on public.bookings for insert
with check (customer_id = auth.uid() and public.is_customer());

-- Cleaner updates: accept, mark in_progress, request completion.
-- State machine validation is enforced by the transition_booking_state RPC.
create policy "Cleaner updates own bookings"
on public.bookings for update
using (cleaner_id = auth.uid() and public.is_cleaner_active())
with check (cleaner_id = auth.uid());

-- Customer updates: cancel, confirm completion, open dispute.
create policy "Customer updates own bookings"
on public.bookings for update
using (customer_id = auth.uid() and public.is_customer())
with check (customer_id = auth.uid());

create policy "Admin manages bookings"
on public.bookings for all
using (public.is_admin())
with check (public.is_admin());

-- No DELETE on bookings; financial records must persist.

-- =========================
-- TABLE: booking_status_events
-- =========================
drop policy if exists "Participants can view booking events"     on public.booking_status_events;
drop policy if exists "Admin reads all booking events"           on public.booking_status_events;
drop policy if exists "Admin inserts booking events"             on public.booking_status_events;

-- Audit trail visible to both parties
create policy "Participants can view booking events"
on public.booking_status_events for select
using (public.is_booking_participant(booking_id));

create policy "Admin reads all booking events"
on public.booking_status_events for select
using (public.is_admin());

-- Direct inserts are normally done by security definer RPCs.
-- Admin insert covers manual corrections.
create policy "Admin inserts booking events"
on public.booking_status_events for insert
with check (public.is_admin());

-- No UPDATE or DELETE: audit log is immutable by design.

-- =========================
-- TABLE: booking_financials
-- =========================
drop policy if exists "Participants read booking financials"     on public.booking_financials;
drop policy if exists "Admin manages booking financials"         on public.booking_financials;

-- Customer sees what they were charged; cleaner sees their payout breakdown
create policy "Participants read booking financials"
on public.booking_financials for select
using (public.is_booking_participant(booking_id));

create policy "Admin manages booking financials"
on public.booking_financials for all
using (public.is_admin())
with check (public.is_admin());

-- INSERT for non-admin: service role handles automated creation; no policy needed.

-- =========================
-- TABLE: disputes
-- =========================
drop policy if exists "Participants read dispute"                on public.disputes;
drop policy if exists "Customer creates dispute for own booking" on public.disputes;
drop policy if exists "Admin updates disputes"                   on public.disputes;
drop policy if exists "Admin reads all disputes"                 on public.disputes;
drop policy if exists "Admin manages disputes"                   on public.disputes;

-- Both parties and admin see the dispute record
create policy "Participants read dispute"
on public.disputes for select
using (
  customer_id = auth.uid()
  or cleaner_id = auth.uid()
  or public.is_admin()
);

-- Only the customer can open a dispute for their own booking.
-- Dispute reason is required; the transition_booking_state RPC inserts this
-- record automatically, but allow direct insert as well for flexibility.
create policy "Customer opens dispute"
on public.disputes for insert
with check (
  customer_id = auth.uid()
  and opened_by = auth.uid()
  and public.is_customer()
);

-- Only admin resolves disputes
create policy "Admin manages disputes"
on public.disputes for all
using (public.is_admin())
with check (public.is_admin());

-- =========================
-- TABLE: dispute_messages
-- =========================
drop policy if exists "Participants read dispute messages"       on public.dispute_messages;
drop policy if exists "Participants send dispute messages"       on public.dispute_messages;
drop policy if exists "Admin reads all dispute messages"         on public.dispute_messages;

create policy "Participants read dispute messages"
on public.dispute_messages for select
using (
  exists (
    select 1 from public.disputes d
    where d.id = dispute_messages.dispute_id
      and (d.customer_id = auth.uid() or d.cleaner_id = auth.uid() or public.is_admin())
  )
);

create policy "Participants send dispute messages"
on public.dispute_messages for insert
with check (
  sender_id = auth.uid()
  and exists (
    select 1 from public.disputes d
    where d.id = dispute_messages.dispute_id
      and (d.customer_id = auth.uid() or d.cleaner_id = auth.uid())
  )
);

create policy "Admin manages dispute messages"
on public.dispute_messages for all
using (
  exists (
    select 1 from public.disputes d
    where d.id = dispute_messages.dispute_id
      and public.is_admin()
  )
)
with check (public.is_admin());

-- No UPDATE or DELETE: messaging history must persist for dispute resolution.

-- =========================
-- TABLE: messages
-- =========================
drop policy if exists "Participants can view messages"           on public.messages;
drop policy if exists "Participants send messages"               on public.messages;
drop policy if exists "Participants mark messages read"          on public.messages;
drop policy if exists "Admin manages messages"                   on public.messages;

create policy "Participants can view messages"
on public.messages for select
using (public.is_booking_participant(booking_id));

create policy "Participants send messages"
on public.messages for insert
with check (
  sender_id = auth.uid()
  and public.is_booking_participant(booking_id)
);

-- Participants mark messages as read (updates read_at column only).
-- The application must only send the read_at field in the update payload.
create policy "Participants mark messages read"
on public.messages for update
using (public.is_booking_participant(booking_id))
with check (public.is_booking_participant(booking_id));

create policy "Admin manages messages"
on public.messages for all
using (public.is_admin())
with check (public.is_admin());

-- =========================
-- TABLE: reviews
-- =========================
drop policy if exists "Public read reviews"                      on public.reviews;
drop policy if exists "Participants create reviews"              on public.reviews;
drop policy if exists "Admin manages reviews"                    on public.reviews;

-- Reviews are public to build marketplace trust
create policy "Public read reviews"
on public.reviews for select
using (true);

-- Reviewer must be a booking participant; booking must be completed;
-- reviewer and reviewee must be the two parties (enforced by check).
-- One review per booking is enforced by the UNIQUE constraint on booking_id.
create policy "Participants create reviews"
on public.reviews for insert
with check (
  reviewer_id = auth.uid()
  and exists (
    select 1 from public.bookings b
    where b.id = reviews.booking_id
      and b.status = 'completed'
      and (
        (b.customer_id = auth.uid() and reviews.reviewee_id = b.cleaner_id)
        or (b.cleaner_id = auth.uid() and reviews.reviewee_id = b.customer_id)
      )
  )
);

-- Admin can manage reviews (moderation, removal of abusive content)
create policy "Admin manages reviews"
on public.reviews for all
using (public.is_admin())
with check (public.is_admin());

-- No UPDATE for participants: reviews are immutable once submitted.

-- =========================
-- TABLE: payments
-- =========================
drop policy if exists "Participants read payments"               on public.payments;
drop policy if exists "Admin manages payments"                   on public.payments;

-- Customer sees what they paid; cleaner confirms payment captured before payout
create policy "Participants read payments"
on public.payments for select
using (public.is_booking_participant(booking_id));

-- Admin full access for reconciliation and support
create policy "Admin manages payments"
on public.payments for all
using (public.is_admin())
with check (public.is_admin());

-- INSERT/UPDATE for non-admin: service role (Edge Functions/webhooks) bypasses RLS.

-- =========================
-- TABLE: payouts
-- =========================
drop policy if exists "Cleaner and admin read payouts"           on public.payouts;
drop policy if exists "Admin manages payouts"                    on public.payouts;
drop policy if exists "Cleaner reads own payouts"                on public.payouts;

-- Cleaner sees their own payout history (earnings dashboard)
create policy "Cleaner reads own payouts"
on public.payouts for select
using (cleaner_id = auth.uid());

-- Admin full access for reconciliation and manual corrections
create policy "Admin manages payouts"
on public.payouts for all
using (public.is_admin())
with check (public.is_admin());

-- INSERT/UPDATE for non-admin: release-payout Edge Function uses service role.

-- =========================
-- TABLE: payment_webhook_events
-- =========================
drop policy if exists "Admin reads webhook events"               on public.payment_webhook_events;
drop policy if exists "Admin inserts webhook events"             on public.payment_webhook_events;
drop policy if exists "Admin updates webhook events"             on public.payment_webhook_events;
drop policy if exists "Admin manages webhook events"             on public.payment_webhook_events;

-- Stripe webhook events are internal infrastructure; admin-only visibility
create policy "Admin manages webhook events"
on public.payment_webhook_events for all
using (public.is_admin())
with check (public.is_admin());

-- stripe-webhook Edge Function uses service role and bypasses RLS.

-- =========================
-- TABLE: cleaner_subscriptions
-- =========================
drop policy if exists "Cleaner reads own subscription"           on public.cleaner_subscriptions;
drop policy if exists "Admin manages subscriptions"              on public.cleaner_subscriptions;

create policy "Cleaner reads own subscription"
on public.cleaner_subscriptions for select
using (cleaner_id = auth.uid() and public.is_cleaner());

create policy "Admin manages subscriptions"
on public.cleaner_subscriptions for all
using (public.is_admin())
with check (public.is_admin());

-- INSERT/UPDATE: subscription webhooks via service role bypass RLS.

-- =========================
-- TABLE: notifications
-- =========================
drop policy if exists "Users read own notifications"             on public.notifications;
drop policy if exists "Users update own notifications"           on public.notifications;
drop policy if exists "Admin manages notifications"              on public.notifications;

create policy "Users read own notifications"
on public.notifications for select
using (user_id = auth.uid());

-- Users mark their own notifications as read; no other field changes allowed.
-- Application must only send read_at in update payloads.
create policy "Users mark own notifications read"
on public.notifications for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- Admin can create manual notifications and manage existing ones
create policy "Admin manages notifications"
on public.notifications for all
using (public.is_admin())
with check (public.is_admin());

-- Automated inserts: Edge Functions / DB triggers use service role; bypass RLS.

-- =========================
-- TABLE: platform_settings
-- =========================
drop policy if exists "Admin reads platform settings"            on public.platform_settings;
drop policy if exists "Admin manages platform settings"          on public.platform_settings;

-- Singleton admin-only table; no other role needs access
create policy "Admin manages platform settings"
on public.platform_settings for all
using (public.is_admin())
with check (public.is_admin());

-- =========================
-- TABLE: city_rollout
-- =========================
drop policy if exists "Public reads enabled rollout cities"      on public.city_rollout;
drop policy if exists "Admin manages city rollout"               on public.city_rollout;

-- Any visitor can see which cities are live (used on marketing/landing pages)
create policy "Public reads enabled cities"
on public.city_rollout for select
using (enabled = true);

-- Admin sees and manages all cities including unreleased ones
create policy "Admin manages city rollout"
on public.city_rollout for all
using (public.is_admin())
with check (public.is_admin());

-- =========================
-- TABLE: waitlist_signups
-- =========================
-- No authenticated-user policies; all writes go through submit_waitlist_signup()
-- which is a security definer RPC with GRANT EXECUTE to anon + authenticated.
-- The table itself has REVOKE ALL from public, anon, authenticated.
-- Admin access is via service role in the admin dashboard.
-- Add an explicit admin policy to cover admin dashboard authenticated queries.

alter table public.waitlist_signups enable row level security;

drop policy if exists "Admin manages waitlist"                   on public.waitlist_signups;

create policy "Admin manages waitlist"
on public.waitlist_signups for all
using (public.is_admin())
with check (public.is_admin());

-- submit_waitlist_signup() is security definer and handles anon/auth inserts.
-- No additional INSERT policy needed for authenticated users.
