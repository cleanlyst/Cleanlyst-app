-- Webhook idempotency checks for `stripe-webhook` function.
-- Run after posting the same Stripe event payload twice.

-- 1) Event must be stored once.
select stripe_event_id, count(*) as seen
from public.payment_webhook_events
group by stripe_event_id
having count(*) > 1;

-- Expect: 0 rows.

-- 2) Payment row should have deterministic latest state.
-- Replace :payment_intent_id with a concrete id before running.
select stripe_payment_intent_id, status, last_webhook_event_id, updated_at
from public.payments
where stripe_payment_intent_id = ':payment_intent_id';

-- 3) Booking status should remain consistent after replay.
-- Replace :booking_id with a concrete id before running.
select id, status, updated_at
from public.bookings
where id = ':booking_id';
