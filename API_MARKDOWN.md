# docs/API_SPEC.md

# API & Backend Specification

## Overview

Cleanlyst uses a Supabase-first architecture.

This means:

- most CRUD operations are handled directly through Supabase
- Row Level Security (RLS) controls access permissions
- Supabase Edge Functions handle sensitive business logic
- Stripe Webhooks handle payment event synchronization

The platform does NOT require a traditional REST backend for every feature.

---

# ARCHITECTURE PRINCIPLES

## Direct Frontend → Supabase Queries

The frontend should directly query Supabase for simple operations such as:

- cleaner search
- reviews
- bookings
- messaging
- availability
- notifications

These operations are protected using Supabase RLS policies.

---

## Edge Functions Only For Sensitive Logic

Supabase Edge Functions should be used for:

- Stripe payment intent creation
- payout processing
- refunds
- cleaner approval
- onboarding verification
- admin analytics
- Stripe Connect account creation

---

# AUTHENTICATION

Authentication handled entirely through Supabase Auth.

## Authentication Methods

- Email & Password
- Google OAuth

## Authenticated User

Use:

```ts
supabase.auth.getUser();
```

---

# DIRECT SUPABASE OPERATIONS

These are NOT traditional REST endpoints.

The frontend interacts directly with Supabase tables.

---

# PROFILES

## Tables Used

- profiles
- customer_profiles
- cleaner_profiles

## Operations

- fetch current user profile
- update profile
- upload avatar
- update preferences

---

# CLEANER SEARCH

## Tables Used

- cleaner_profiles
- cleaner_services
- services
- reviews

## Features

- search by location
- search by service
- rating filters
- pricing filters
- availability filters

---

# BOOKINGS

## Tables Used

- bookings

## Customer Operations

- create booking
- view own bookings
- cancel booking

## Cleaner Operations

- accept booking
- decline booking
- start booking
- complete booking

## Admin Operations

- view all bookings
- filter by status
- monitor platform activity

---

# REVIEWS

## Tables Used

- reviews

## Operations

- create review
- fetch cleaner reviews

## Restrictions

- only customers with completed bookings can review
- one review per booking

---

# AVAILABILITY

## Tables Used

- cleaner_availability

## Operations

- create availability slots
- update availability
- delete availability
- fetch cleaner availability

---

# MESSAGING

## Tables Used

- conversations
- messages

## Operations

- fetch conversations
- send messages
- receive realtime messages

## Realtime

Handled using Supabase Realtime subscriptions.

---

# NOTIFICATIONS

## Tables Used

- notifications

## Operations

- fetch notifications
- mark notification as read

---

# PAYMENTS & STRIPE

Sensitive payment operations handled using Edge Functions.

---

# EDGE FUNCTION: create-payment-intent

## Purpose

Creates Stripe payment intent securely.

## Responsibilities

- validate booking
- calculate totals
- calculate platform fee
- create Stripe payment intent
- return Stripe client secret

---

# EDGE FUNCTION: process-payout

## Purpose

Send payout to cleaner through Stripe Connect.

## Responsibilities

- validate booking completion
- calculate cleaner payout
- deduct platform fee
- transfer funds

---

# EDGE FUNCTION: refund-payment

## Purpose

Process customer refunds securely.

## Responsibilities

- validate refund eligibility
- trigger Stripe refund
- update booking/payment statuses

---

# EDGE FUNCTION: create-stripe-connect-account

## Purpose

Create and onboard cleaner Stripe accounts.

## Responsibilities

- create Stripe Connect account
- generate onboarding link
- sync Stripe account ID

---

# CLEANER ONBOARDING

Most onboarding data stored directly in Supabase.

Sensitive verification handled through Edge Functions.

---

# EDGE FUNCTION: verify-cleaner-onboarding

## Purpose

Validate onboarding submission.

## Responsibilities

- validate uploaded documents
- verify required onboarding fields
- move onboarding to review state

---

# ADMIN OPERATIONS

Most admin reads can use direct Supabase queries with admin RLS access.

Sensitive admin actions use Edge Functions.

---

# EDGE FUNCTION: approve-cleaner

## Purpose

Approve cleaner onboarding.

## Responsibilities

- activate cleaner account
- update user role
- update onboarding status
- notify cleaner

---

# EDGE FUNCTION: reject-cleaner

## Purpose

Reject cleaner onboarding.

## Responsibilities

- store rejection reason
- notify cleaner

---

# EDGE FUNCTION: admin-analytics

## Purpose

Generate dashboard analytics.

## Responsibilities

- revenue aggregation
- booking metrics
- cleaner performance metrics
- platform KPIs

---

# STRIPE WEBHOOKS

Stripe webhooks synchronize payment state with Supabase.

---

# WEBHOOK: payment_intent.succeeded

Actions:

- update payment_status
- confirm successful payment

---

# WEBHOOK: payment_intent.payment_failed

Actions:

- mark payment failed
- notify customer

---

# WEBHOOK: transfer.paid

Actions:

- mark payout completed

---

# WEBHOOK: charge.refunded

Actions:

- update refund status
- update booking state

---

# SECURITY REQUIREMENTS

## Supabase RLS Required On All Tables

Customers:

- can only access their own data

Cleaners:

- can only access assigned bookings and own data

Admins:

- full platform access

---

# REALTIME FEATURES

Supabase Realtime enabled for:

- booking updates
- messages
- notifications
- cleaner responses
- admin dashboard activity

---

# FILE STORAGE

## Supabase Storage Buckets

### cleaner-documents

Private bucket storing:

- ID verification
- DBS checks
- insurance documents

### avatars

Public bucket storing:

- user profile images

---

# FUTURE EDGE FUNCTIONS

Potential future additions:

- recurring bookings
- subscription automation
- referral rewards
- fraud detection
- AI cleaner recommendations
- dispute resolution

---

# IMPORTANT DEVELOPMENT NOTE

Avoid building unnecessary REST APIs early.

Preferred architecture:

```txt
Frontend
   ↓
Supabase Client
   ↓
Supabase Database + RLS

Sensitive Logic
   ↓
Supabase Edge Functions
   ↓
Stripe / Secure Operations
```

This architecture reduces:

- backend complexity
- infrastructure overhead
- duplicated CRUD APIs

while leveraging Supabase fully.
