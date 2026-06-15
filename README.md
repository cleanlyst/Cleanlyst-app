# Cleanlyst

## The fastest way to book reliable home cleaners in your area.

Cleanlyst is a two-sided marketplace that connects customers looking for trusted home cleaning services with vetted independent cleaners seeking flexible work opportunities.

Customers can discover available cleaners, book and pay for services, manage upcoming appointments, and leave reviews. Cleaners can manage their availability, receive and respond to bookings, track earnings, and grow their business through the platform. Administrators oversee verification, bookings, platform finances, and operational support.

The platform is currently focused on launching in **Wigan, Greater Manchester**, with plans to expand into additional towns and cities after validating the initial market.

---

## Vision

To become the most trusted and convenient platform for booking home cleaning services by combining transparency, reliability, and operational simplicity.

Cleanlyst aims to remove the uncertainty often associated with hiring cleaners by providing:

* Vetted and approved professionals.
* Clear, upfront pricing.
* Secure payment handling.
* Structured booking workflows.
* Ongoing customer support.

---

## Current MVP Focus

### Geographic Launch

Initial launch market:

* Wigan, Greater Manchester, United Kingdom

Future expansion:

* Additional towns across Greater Manchester.
* Wider UK rollout.

---

### Core Services

Cleanlyst currently focuses exclusively on home cleaning services.

Supported services:

* Standard Cleaning
* Deep Cleaning
* Airbnb Turnover Cleaning
* End of Tenancy Cleaning

Optional add-ons:

* Oven Cleaning
* Fridge Cleaning
* Laundry

Services intentionally excluded from the MVP:

* Commercial cleaning
* Vehicle cleaning
* Industrial cleaning
* Biohazard cleaning
* Personal item cleaning

---

## Customer Experience

Customers can:

### Account Management

* Register using email and password.
* Sign in securely.
* Manage profile information.
* Update household preferences.

### Booking Journey

Book a cleaner through a guided multi-step experience:

1. Select cleaning service.
2. Choose optional add-ons.
3. Select date and preferred time.
4. Confirm property details.
5. View available cleaners.
6. Select cleaner.
7. Review pricing.
8. Confirm and pay.
9. Receive booking confirmation.

### Booking Management

Customers can:

* View all bookings.
* Filter bookings by status.
* Access booking details.
* View cleaner information.
* Monitor booking progress.

### Reviews

Following completed bookings, customers can:

* Rate cleaners.
* Leave written reviews.

### No-Show Protection

If a cleaner fails to attend, customers can:

* Request a refund.
* Request reassignment to another cleaner.

---

## Cleaner Experience

Cleaners use a dedicated dashboard designed to help manage work efficiently.

### Registration

Cleaners:

* Create an account.
* Submit verification details.
* Await approval before accepting work.

### Verification Process

Verification requires:

* Identity documentation.
* DBS verification.
* Insurance verification.

Applications are reviewed by administrators.

### Dashboard Features

Approved cleaners can:

* Manage weekly availability.
* Define services offered.
* Set service pricing.
* Receive booking requests.
* View booking details.
* Communicate with customers.
* Track completed work.
* Monitor earnings.

### Booking Actions

Depending on booking status, cleaners may:

Pending bookings:

* Accept booking.
* Decline booking.
* Propose revised estimates.

Accepted bookings:

* Await scheduled appointment.

Approximately one hour before service:

* Start Cleaning.

During service:

* Complete Cleaning.

No-show situations:

* Record attendance issues.

---

## Administrator Experience

Administrators oversee marketplace operations.

### Cleaner Management

Administrators can:

* Review applications.
* Approve cleaners.
* Reject applications.
* Request additional information.
* Review verification documents.

### Booking Management

Administrators can:

* View all bookings.
* Filter bookings by status.
* Search bookings.
* Reassign cleaners.
* Process refunds.
* Investigate disputes.

### Financial Oversight

Administrators can:

* Monitor platform revenue.
* Review cleaner earnings.
* Configure booking fees.
* Configure cleaner commission rates.

### User Oversight

Administrators can:

* View customer accounts.
* View cleaner accounts.
* Monitor marketplace activity.

---

## Booking Lifecycle

Cleanlyst uses a controlled booking state machine.

Typical flow:

Customer books and pays
↓

Booking request sent
↓

Cleaner accepts
↓

Booking scheduled
↓

Cleaner starts cleaning
↓

Cleaner completes cleaning
↓

Payment released
↓

Customer reviews cleaner

Alternative flows include:

* Declined bookings.
* Revised estimates.
* Customer cancellations.
* No-shows.
* Refunds.
* Cleaner reassignment.

---

## Pricing Model

### Customer Pricing

Customers pay:

Service Fee
+
Booking Fee

Example:

Cleaning Service: £60

Booking Fee: £5

Total: £65

---

### Cleaner Earnings

Cleaner earnings are calculated as:

Service Fee
− Cleaner Commission

Example:

Cleaning Service: £60

Cleaner Commission (15%): £9

Cleaner Receives: £51

---

### Platform Revenue

Platform revenue consists of:

* Customer booking fees.
* Cleaner commission.

The system does not use subscriptions.

---

## Payments

### Current Implementation

The platform currently uses a dummy payment workflow to validate operational processes.

Dummy payments simulate:

* Payment confirmation.
* Booking progression.
* Earnings calculations.
* Revenue reporting.

### Future Implementation

Stripe escrow will be introduced to support:

* Payment authorisation.
* Escrow holding.
* Payout releases.
* Refund processing.

---

## Technology Stack

### Frontend

* Vue 3
* TypeScript
* Vite
* Vue Router
* Pinia

### Backend

* Supabase
* PostgreSQL
* Supabase Auth
* Row Level Security
* Supabase Storage
* Supabase Realtime

### Testing

* Vitest
* Playwright

### Deployment

Development / Staging:

* Vercel Preview Deployments
* Supabase Staging

Production:

* Vercel Production
* Supabase Production

---

## Environment Strategy

### Staging

Purpose:

Development and testing.

Domains:

* localhost
* *.vercel.app

Supabase Project:

ThatBrendan's Project

---

### Production

Purpose:

Live customer usage.

Domains:

* cleanlyst.co.uk
* [www.cleanlyst.co.uk](http://www.cleanlyst.co.uk)
* cleanlyst.app
* [www.cleanlyst.app](http://www.cleanlyst.app)

Supabase Project:

Cleanlyst-Prod-app

---

## Development Workflow

Branching strategy:

Feature Branch
↓

dev
↓

Staging Validation
↓

main
↓

Production Release

Production changes must never bypass staging.

---

## Testing Strategy

Before release:

* TypeScript compilation passes.
* Application builds successfully.
* Unit tests pass.
* Critical Playwright journeys pass.
* Booking lifecycle validated.
* Financial calculations verified.

---

## Project Status

Current phase:

MVP Stabilisation and Internal Testing.

Immediate priorities:

* Complete end-to-end validation.
* Finalise booking lifecycle.
* Replace dummy payments with Stripe escrow.
* Launch within Wigan.
* Gather early customer and cleaner feedback.

---

## License

Private and proprietary.

All rights reserved.

This repository is intended solely for the development and operation of the Cleanlyst platform.
