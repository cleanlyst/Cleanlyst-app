# CLEANLYST STRIPE PAYMENT FLOW

# CORE PRINCIPLE

Customer pays Cleanlyst first.
Cleanlyst then pays the cleaner.

This is a marketplace escrow-style workflow using:

- Stripe Payment Intents
- Stripe Connect

---

# FULL PAYMENT FLOW

┌────────────────────┐
│ Customer Creates │
│ Booking Request │
└─────────┬──────────┘
│
▼

┌────────────────────┐
│ Booking Created │
│ status=pending │
└─────────┬──────────┘
│
▼

┌────────────────────┐
│ Cleaner Accepts │
│ Booking │
└─────────┬──────────┘
│
▼

┌─────────────────────────────────┐
│ Edge Function: │
│ create-payment-intent │
│ │
│ - calculate totals │
│ - add platform fee │
│ - create Stripe PaymentIntent │
└─────────┬───────────────────────┘
│
▼

┌────────────────────┐
│ Customer Pays │
│ via Stripe Checkout│
└─────────┬──────────┘
│
▼

┌──────────────────────────────┐
│ Stripe Webhook │
│ payment_intent.succeeded │
└─────────┬────────────────────┘
│
▼

┌────────────────────┐
│ booking.payment │
│ status = paid │
└─────────┬──────────┘
│
▼

┌────────────────────┐
│ Cleaner Performs │
│ Cleaning Job │
└─────────┬──────────┘
│
▼

┌────────────────────┐
│ Cleaner Marks │
│ Job Completed │
└─────────┬──────────┘
│
▼

┌─────────────────────────────┐
│ Edge Function: │
│ process-payout │
│ │
│ - calculate cleaner share │
│ - deduct platform fee │
│ - send Stripe transfer │
└─────────┬───────────────────┘
│
▼

┌────────────────────┐
│ Cleaner Receives │
│ Payout │
└────────────────────┘
