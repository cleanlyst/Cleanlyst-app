-- =========================
-- MISSING INDEXES
-- =========================
-- All indexes use CREATE INDEX IF NOT EXISTS — safe to run repeatedly.

-- messages: chat history loaded by booking_id on every conversation open.
create index if not exists idx_messages_booking_id
  on public.messages (booking_id);

-- booking_status_events: audit trail queried per booking.
create index if not exists idx_booking_status_events_booking_id
  on public.booking_status_events (booking_id);

-- dispute_messages: dispute thread loaded by dispute_id.
create index if not exists idx_dispute_messages_dispute_id
  on public.dispute_messages (dispute_id);

-- payouts: cleaner earnings dashboard filters by cleaner_id.
create index if not exists idx_payouts_cleaner_id
  on public.payouts (cleaner_id);

-- payouts: webhook reconciliation looks up by stripe_transfer_id.
create index if not exists idx_payouts_stripe_transfer_id
  on public.payouts (stripe_transfer_id);

-- cleaner_subscriptions: Stripe subscription webhooks look up by stripe_subscription_id.
create index if not exists idx_cleaner_subscriptions_stripe_sub_id
  on public.cleaner_subscriptions (stripe_subscription_id);

-- bookings: admin dashboard filters by status; common query pattern.
create index if not exists idx_bookings_status
  on public.bookings (status);

-- bookings: recency ordering in customer and cleaner dashboards.
create index if not exists idx_bookings_created_at
  on public.bookings (created_at desc);

-- cleaner_applications: admin review queue filters by status.
create index if not exists idx_cleaner_applications_status
  on public.cleaner_applications (status);

-- payment_webhook_events: monitoring queries filter by event type.
create index if not exists idx_webhook_events_type
  on public.payment_webhook_events (stripe_event_type);

-- payment_webhook_events: recency ordering for webhook monitoring dashboards.
create index if not exists idx_webhook_events_received_at
  on public.payment_webhook_events (received_at desc);

-- profiles: role-filtered admin queries (e.g. list all cleaners, list all admins).
create index if not exists idx_profiles_role
  on public.profiles (role);

-- messages: unread messages per booking (partial index — only unread rows).
create index if not exists idx_messages_booking_unread
  on public.messages (booking_id, created_at desc)
  where read_at is null;
