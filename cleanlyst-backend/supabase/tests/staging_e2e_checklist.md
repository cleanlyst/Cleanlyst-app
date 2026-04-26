# Staging MVP E2E Checklist

## Accounts
- Seed one `customer`, one `cleaner_pending`, one `cleaner_active`, one `admin`.
- Confirm `cleaner_pending` cannot access cleaner operational routes/data.

## Cleaner Onboarding
- `cleaner_pending` saves personal details and uploads ID/DBS/insurance docs.
- Logout/login and verify application resumes at last completed step.
- Submit application and verify status changes to `submitted`.
- Admin performs `needs_info`, cleaner updates, admin approves.
- Verify profile role transitions to `cleaner_active`.

## Booking Lifecycle
- Customer creates booking request against active cleaner.
- Cleaner proposes estimate or declines.
- If proposed, customer confirms and starts checkout.
- Stripe webhook marks payment as `authorized` and booking as `payment_authorized`.
- Cleaner marks in progress, then completion pending customer.
- Customer confirms completion; booking becomes `completed`.

## Dispute Path
- Repeat booking flow until `completion_pending_customer`.
- Customer raises dispute; booking becomes `disputed`.
- Admin resolves as refund then verify booking is `refunded`.
- Repeat and resolve in cleaner favor; verify booking ends in `completed`.

## Payout
- For completed undisputed booking, admin triggers payout release function.
- Confirm `payments.status = captured` and `payouts.status = released`.

## Security Regression
- Validate `rls_smoke_tests.sql` and `webhook_idempotency_checks.sql` pass.
