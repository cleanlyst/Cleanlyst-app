-- ============================================================
-- Add 'released' to payment_status enum
--
-- The complete_booking RPC sets payment_status = 'released' when
-- a booking is completed and the payout is processed.  The init
-- schema's payment_status enum only has:
--   unpaid | authorized | captured | refunded | failed
-- 'released' was never added via ALTER TYPE, so complete_booking
-- fails on the live database with:
--   invalid input value for enum payment_status: "released"
-- ============================================================

alter type public.payment_status add value if not exists 'released';
