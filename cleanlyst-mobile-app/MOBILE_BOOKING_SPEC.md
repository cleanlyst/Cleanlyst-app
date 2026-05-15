# Cleanlyst Mobile Booking Flow — Product Specification
**Platform:** React Native (Expo)  
**Target market:** UK  
**Backend:** Supabase + Stripe Connect  
**Version:** 1.0  
**Date:** 2026-05-15  

---

## 1. Mobile Booking UX Overview

### Philosophy

The web flow treats booking as a form-filling exercise spread across multiple pages. The mobile flow treats it as a **guided conversation** — each step asks one thing, confirms it clearly, and moves on. The thumb never leaves the bottom half of the screen.

### What is simplified

| Web behaviour | Mobile change |
|---|---|
| Separate search page + filter page | Single unified discovery screen with inline filter sheet |
| Cleaner profile fills a full page | Compact card with expandable bio bottom sheet |
| Service selection is a separate edit flow | Inline on the profile screen before the wizard starts |
| Scheduling has a calendar grid + separate time field | Combined date/time picker in a single bottom sheet |
| Location confirmation is a text form | Pre-filled from saved customer address; one-tap confirm |
| Pricing shown in a table with small print | Single price card with one-tap fee breakdown |
| Confirmation is a page reload of data already seen | Persistent animated summary card that was built up across steps |

### What is merged

- **Steps 3 + 4** (service edit + rate view) → merged into **CleanerProfileScreen** with a sticky bottom CTA
- **Steps 5 + 6** (confirm booking + send to cleaner) → single tap from **BookingConfirmScreen**
- **Location + notes** → combined into one **JobDetailsScreen** step

### What is removed or deferred

- **Rebook flow** — deferred to v1.1; surface it from booking history, not the booking wizard
- **Multi-cleaner comparison** — deferred; mobile discovery list + ratings give enough signal
- **Custom extras selection** — deferred; notes field covers edge cases until data shows demand
- **Payment method management** — handled inline at payment step via Stripe SDK sheet; no separate settings screen required in v1.0

### Why mobile is different

1. **Screen real estate is ~5× smaller.** Every pixel must earn its place. Progress indicators replace page titles; sticky CTAs replace scroll-to-bottom submit buttons.
2. **Thumb zone physics.** All primary actions sit in the bottom 40% of screen. Destructive or secondary actions (back, cancel) sit top-left/top-right in the nav bar.
3. **Keyboard disrupts flow.** Typing steps are minimised. Pre-fill from `customer_preferences`, toggle selectors for known options (pets, cleaner gender pref), and address autocomplete replace free-text fields.
4. **Session context is fragile.** Users get interrupted by calls, notifications, and apps. Booking state is persisted to a local draft (AsyncStorage) at every step so the user returns to where they left off.
5. **Trust is harder to convey.** A web page can show a long bio and 20 reviews without scroll fatigue. Mobile must front-load the 3 highest-trust signals: verified badge, star rating, job count — visible before the CTA.

---

## 2. Screen-by-Screen Breakdown

### Navigation architecture

```
(Tab Bar)
├── HomeTab        → HomeScreen (entry point)
├── SearchTab      → CleanerDiscoveryScreen
├── BookingsTab    → BookingListScreen → BookingDetailScreen
└── ProfileTab     → CustomerProfileScreen

(Modal stack — launched from anywhere)
└── BookingWizardNavigator (Stack)
    ├── Step 0: CleanerProfileScreen        (entry — can also be reached from discovery)
    ├── Step 1: ServiceSelectScreen
    ├── Step 2: ScheduleScreen
    ├── Step 3: JobDetailsScreen
    ├── Step 4: PricingScreen
    └── Step 5: BookingConfirmScreen
        └── → BookingStatusScreen           (post-submit, not part of wizard)
```

---

### Screen 1 — HomeScreen

**Component name:** `HomeScreen`  
**Route:** `/home` (Tab 1)

**Purpose:**  
Entry point after login. Surfaces quick re-book suggestions, active booking status, and a primary search CTA. Converts returning users without requiring them to re-discover.

**UI components:**
- `SafeAreaView` with `ScrollView`
- `WelcomeHeader` — first name, avatar, notification bell icon with unread dot
- `ActiveBookingBanner` (conditional) — if a booking exists with status `accepted | in_progress | completion_pending_customer`, shows a persistent inline card with cleaner name, date, and status pill. Taps to `BookingDetailScreen`
- `SearchBarTrigger` — non-interactive tap target (looks like a search bar, opens `CleanerDiscoveryScreen` on tap). Shows last-searched postcode pre-filled
- `QuickServiceGrid` — horizontal 2×2 grid of service type buttons (Home Cleaning, Deep Cleaning, Office, Carpet). Each tap pre-seeds discovery filter and navigates to `CleanerDiscoveryScreen`
- `RecentCleanerRow` (conditional, if prior bookings exist) — horizontal scroll of `CleanerMiniCard` components for cleaners they have booked before

**User actions:**
- Tap `SearchBarTrigger` → navigate to `CleanerDiscoveryScreen` with no pre-filter
- Tap service type tile → navigate to `CleanerDiscoveryScreen` with `service` filter pre-applied
- Tap `ActiveBookingBanner` → navigate to `BookingDetailScreen`
- Tap recent cleaner → navigate to `CleanerProfileScreen`
- Tap notification bell → slide-over `NotificationDrawer` (bottom sheet)

**Data required from Supabase:**
- `profiles` — `full_name`, `avatar_url` for current user
- `bookings` — most recent booking where `customer_id = current_user` and `status IN ('accepted','in_progress','completion_pending_customer')`
- `bookings` — last 3 completed bookings with `cleaner_id` joins (for recent cleaners row)
- `notifications` — unread count

**Navigation:**
- Back: n/a (tab root)
- Next: `CleanerDiscoveryScreen` or `CleanerProfileScreen`

---

### Screen 2 — CleanerDiscoveryScreen

**Component name:** `CleanerDiscoveryScreen`  
**Route:** `/discover`

**Purpose:**  
Find available cleaners by postcode and service type. Replaces the web's separate search + filter pages. Defaults to a scrollable list with a map toggle in the header.

**UI components:**
- `SafeAreaView` sticky header:
  - Back/X button (top-left)
  - `PostcodeSearchBar` — inline text input with clear button. Triggers postcode validation + geocoding on submit
  - `FilterChipRow` — horizontal scroll of pills: `Service type`, `Price`, `Availability`, `Rating 4.5+`. Active filters show filled pill style. Tap opens `FilterBottomSheet`
  - `ListMapToggle` — segmented control top-right
- **List mode:**
  - `FlatList` of `CleanerCard` components
  - `SortRowBar` — "Nearest · Best rated · Price ↑" horizontal pill selector
  - Pull-to-refresh
- **Map mode (deferred to v1.1):**
  - `MapView` (expo-maps) with `CleanerMapPin` markers
  - Bottom `CleanerCardCarousel` — horizontal snap scroll of mini cards for visible pins
- `FilterBottomSheet` (modal overlay):
  - Service type multi-select checkboxes
  - Price range slider (£10–£50/hr)
  - Day of week availability chips
  - Minimum rating stepper
  - `Apply Filters` sticky CTA

**User actions:**
- Type postcode → list refreshes with cleaners within `service_radius_km` of that postcode
- Tap filter chip → opens `FilterBottomSheet`
- Tap `CleanerCard` → navigate to `CleanerProfileScreen`
- Toggle to map → switch to map view (v1.1)

**Data required from Supabase:**
- `cleaner_profiles` — `user_id`, `bio`, `hourly_rate`, `average_rating`, `total_reviews`, `total_jobs_completed`, `service_radius_km`, `status = 'approved'`
- `profiles` JOIN — `full_name`, `avatar_url`
- `cleaner_services` JOIN `services` — service names for filter matching
- `cleaner_availability` — for availability-day filtering

**Query logic:**  
Postcode → lat/lng via Expo Location or a free geocoding API (postcodes.io UK). Filter cleaners by haversine distance ≤ `service_radius_km`. Applied client-side on the returned dataset or via a Supabase RPC `get_nearby_cleaners(lat, lng, radius_km)`.

**Navigation:**
- Back: `HomeScreen`
- Next: `CleanerProfileScreen`

---

### Screen 3 — CleanerProfileScreen

**Component name:** `CleanerProfileScreen`  
**Route:** `/cleaner/:cleanerId`  
**Entry point to booking wizard** (Step 0)

**Purpose:**  
Compact trust-building screen that converts browsing into booking intent. Everything above the fold communicates trust. The sticky bottom CTA initiates the wizard.

**UI components:**
- `ScrollView` (no pagination — content is compact enough for one scroll)
- **Hero section** (top ~35% of screen):
  - Full-bleed avatar or placeholder gradient (rounded-xl)
  - Overlay gradient bottom-to-top for text legibility
  - `TrustBadgeRow` over hero: `✓ ID Verified`, `✓ DBS Checked`, `✓ Insured` — icon + label chips
- **Stat row** (below hero):
  - Star rating + review count
  - Jobs completed count
  - Response time (static "Usually within 1 hr" for v1.0)
- **Bio section:**
  - Cleaner name + `business_name` (if `cleaner_type = 'business'`)
  - 2-line truncated bio with "Show more" toggle (expands inline, not a new screen)
- **Services offered:**
  - `ServiceTagRow` — horizontal pill list of services this cleaner offers
  - Each pill shows service name only (no price here — that's on PricingScreen)
- **Reviews section:**
  - Top 3 `ReviewCard` components (rating stars, reviewer first name, date, comment truncated to 2 lines)
  - "See all X reviews" tap → `ReviewListBottomSheet`
- **Sticky bottom bar (`StickyBookingCTA`):**
  - Left: `£X/hr` in large weight
  - Right: `Book [FirstName]` primary button — full-width on tap (expands animation), navigates to Step 1

**User actions:**
- Scroll to read bio/reviews
- Tap "Show more" bio → expand inline
- Tap review "See all" → `ReviewListBottomSheet`
- Tap `Book [FirstName]` → navigate to `ServiceSelectScreen` with `cleanerId` in wizard context

**Data required from Supabase:**
- `cleaner_profiles` — all fields
- `profiles` JOIN — `full_name`, `avatar_url`
- `cleaner_services` JOIN `services` — service list for this cleaner
- `cleaner_documents` — check `status = 'approved'` for each of `id_document`, `dbs_document`, `insurance_document` to render trust badges
- `reviews` WHERE `reviewee_id = cleanerId` ORDER BY `created_at DESC` LIMIT 3

**Navigation:**
- Back: `CleanerDiscoveryScreen`
- Next: `ServiceSelectScreen` (Step 1 of wizard)

---

### Screen 4 — ServiceSelectScreen (Wizard Step 1)

**Component name:** `ServiceSelectScreen`  
**Route:** (within `BookingWizardNavigator`)

**Purpose:**  
Single-focus question: "What type of cleaning do you need?" Eliminates the web's edit-service confusion by making this step 1 of an explicit wizard, not a hidden edit mode.

**UI components:**
- `StepProgressIndicator` — 5-dot indicator, step 1 active
- `ScreenTitle` — "What needs cleaning?"
- `ServiceOptionList` — full-width tappable cards (not tiny checkboxes):
  - Each card: service icon + name + one-line description
  - Single-select for v1.0 (one service per booking)
  - Selected card gets teal border + checkmark
- Selected service animates into a confirmation chip below the list
- `StickyBookingCTA` — "Continue" disabled until selection made, then enabled

**User actions:**
- Tap service card → select (deselects others)
- Tap "Continue" → navigate to `ScheduleScreen`

**Data required from Supabase:**
- `cleaner_services` WHERE `cleaner_id = cleanerId` JOIN `services` — filtered to services this specific cleaner offers

**Navigation:**
- Back: `CleanerProfileScreen`
- Next: `ScheduleScreen`

---

### Screen 5 — ScheduleScreen (Wizard Step 2)

**Component name:** `ScheduleScreen`  
**Route:** (within `BookingWizardNavigator`)

**Purpose:**  
Pick a date and time. Constraints: only show dates/times that intersect with the cleaner's `cleaner_availability` slots. No cross-cleaner comparison at this point — user has committed to this cleaner.

**UI components:**
- `StepProgressIndicator` — step 2 active
- `ScreenTitle` — "When would you like [FirstName]?"
- `WeekStrip` — horizontal 7-day pill row showing the next 7 available days (greyed-out days with no availability). Tapping a day selects it + shows time slots
- `TimeSlotGrid` — 2-column grid of `TimeSlotChip` buttons (e.g., "9:00 AM", "10:00 AM") derived from the cleaner's availability for the selected day. Slots already booked are greyed out (query `bookings` table)
- `DurationStepper` — below slot grid. "+/- hour" stepper. Min 1 hr, max 8 hrs. Updates `estimated_hours` in wizard state
- `StickyBookingCTA` — "Continue" enabled only when date + time selected

**User actions:**
- Tap day chip → updates time slot grid
- Tap time slot → selects start time
- Adjust duration stepper → sets `estimated_hours`
- Tap "Continue" → navigate to `JobDetailsScreen`

**Data required from Supabase:**
- `cleaner_availability` WHERE `cleaner_id = cleanerId AND active = true` — to build available day/time matrix
- `bookings` WHERE `cleaner_id = cleanerId AND status NOT IN ('cancelled','cleaner_declined')` — to block already-booked slots

**Wizard state written:**
```
selectedDate: string (ISO date)
selectedStartTime: string (HH:MM)
estimatedHours: number
```

**Navigation:**
- Back: `ServiceSelectScreen`
- Next: `JobDetailsScreen`

---

### Screen 6 — JobDetailsScreen (Wizard Step 3)

**Component name:** `JobDetailsScreen`  
**Route:** (within `BookingWizardNavigator`)

**Purpose:**  
Confirm location and add any special notes. This is the highest-friction step (typing) so it is placed after commitment (cleaner + service + time already chosen) and pre-filled where possible.

**UI components:**
- `StepProgressIndicator` — step 3 active
- `ScreenTitle` — "Where and any details?"
- **Location section:**
  - `AddressConfirmCard` — shows pre-filled address from `customer_preferences` (address, city, postcode)
  - `ChangeAddressLink` — tapping opens `AddressBottomSheet` with an address autocomplete input (using `postcodes.io` for UK postcode lookup + manual line entry). Does NOT navigate away
  - Address autocomplete uses a `TextInput` with debounced lookup, shows dropdown of matched addresses below
- **Property details section (pre-filled from `customer_preferences`):**
  - `PropertyChip` row: number of rooms (stepper), has pets (toggle)
  - These are editable but pre-filled — user just confirms with a glance
- **Notes section:**
  - `MultilineTextInput` — "Anything the cleaner should know? (optional)" placeholder
  - Max 300 chars, char counter shown at 250+
- `StickyBookingCTA` — "Continue" enabled as soon as address is confirmed (notes optional)

**User actions:**
- Review pre-filled address — most users just continue
- Tap "Change" → opens `AddressBottomSheet`
- Adjust room count / pet toggle
- Optionally add notes
- Tap "Continue" → navigate to `PricingScreen`

**Data required from Supabase:**
- `customer_preferences` WHERE `customer_id = currentUser` — pre-fill address, `room_count`, `has_pets`

**Wizard state written:**
```
locationText: string
latitude: number | null
longitude: number | null
notes: string
```

**Navigation:**
- Back: `ScheduleScreen`
- Next: `PricingScreen`

---

### Screen 7 — PricingScreen (Wizard Step 4)

**Component name:** `PricingScreen`  
**Route:** (within `BookingWizardNavigator`)

**Purpose:**  
Show the full cost before commitment. No surprises. This screen exists to build confidence, not to introduce new questions. Everything is read-only.

**UI components:**
- `StepProgressIndicator` — step 4 active
- `ScreenTitle` — "Here's your total"
- `PriceBreakdownCard`:
  - `CleanerRateRow` — "£X/hr × Y hrs = £Z"
  - `PlatformFeeRow` — "Booking fee: £X" (expandable with ? icon that shows "This covers secure payments and platform support")
  - Divider line
  - `TotalRow` — large bold total in GBP
- `BookingSummaryCard` — compact recap of all prior steps:
  - Cleaner avatar + name
  - Service name
  - Date + time formatted as "Mon 19 May · 10:00 AM"
  - Address first line + postcode
- `PaymentNoteText` — "You won't be charged now. Payment is only taken once [FirstName] accepts your booking."
- `StickyBookingCTA` — "Request booking →" (primary, full-width)

**Pricing calculation (client-side):**
```
quote_cents = hourly_rate_cents × estimated_hours
platform_fee_cents = from platform_settings.booking_fee_flat (fetched once on app start)
total_cents = quote_cents + platform_fee_cents
cleaner_payout_cents = quote_cents (platform fee is additive, not deducted from cleaner)
```

**User actions:**
- Read summary (passive)
- Tap ? icon → `FeeExplainerBottomSheet`
- Tap "Request booking →" → navigate to `BookingConfirmScreen`

**Data required from Supabase:**
- `platform_settings` — `booking_fee_flat`
- (All other data is already in wizard state)

**Navigation:**
- Back: `JobDetailsScreen`
- Next: `BookingConfirmScreen`

---

### Screen 8 — BookingConfirmScreen (Wizard Step 5)

**Component name:** `BookingConfirmScreen`  
**Route:** (within `BookingWizardNavigator`)  
**This is the point of no return.**

**Purpose:**  
Final review + one-tap submit. The booking record is created on confirm. This screen is the shortest in the wizard — it should feel like a formality, not a second decision.

**UI components:**
- `StepProgressIndicator` — step 5 active (all dots filled)
- `ScreenTitle` — "Confirm booking"
- `FinalSummaryCard` — full recap (same as `PricingScreen` summary card but larger)
- `TermsNote` — small grey text: "By confirming you agree to our Booking Terms. Payment will be requested once [FirstName] accepts."
- `StickyBookingCTA`:
  - "Confirm request" primary button — triggers booking creation
  - Loading spinner in button while Supabase insert is in flight
  - On error: inline error toast, button re-enables

**On confirm tap — operations (sequential):**
1. `INSERT INTO bookings` with `status = 'pending_request'`, `payment_status = 'unpaid'`, all wizard state fields
2. `INSERT INTO notifications` for the cleaner: type `booking_request`, body includes customer name + date
3. Navigate to `BookingStatusScreen` (replaces wizard stack)
4. Clear wizard state from AsyncStorage

**User actions:**
- Tap "Confirm request" → creates booking, navigates away
- Tap back arrow → return to `PricingScreen` (booking not yet created)

**Data written to Supabase:**
```
bookings:
  customer_id, cleaner_id, service_id, service_title_snapshot,
  location_text, latitude, longitude, notes,
  scheduled_start, scheduled_end, estimated_hours,
  quote_cents, cleaner_payout_cents, currency ('gbp'),
  status = 'pending_request', payment_status = 'unpaid'

notifications:
  user_id = cleaner_id, type = 'booking_request',
  title = 'New booking request', body = '...'
```

**Navigation:**
- Back: `PricingScreen`
- Next: `BookingStatusScreen` (replaces entire wizard stack)

---

### Screen 9 — BookingStatusScreen

**Component name:** `BookingStatusScreen`  
**Route:** `/booking/:bookingId/status`

**Purpose:**  
Post-submission home for this booking. Shows real-time status. Replaces the wizard. Accessible from `BookingListScreen` and the `ActiveBookingBanner` on `HomeScreen`.

**UI components:**
- `StatusHeroSection`:
  - Large animated status icon (hourglass → tick → in-progress → complete)
  - Status label: "Waiting for [FirstName] to respond", "Booking accepted!", "Cleaning in progress", "Complete — leave a review"
  - Expected response time note under pending state: "Most cleaners respond within 2 hours"
- `BookingSummaryCard` (read-only)
- **Contextual action area (changes by status):**

| Status | Actions shown |
|---|---|
| `pending_request` | "Cancel request" (destructive, secondary) |
| `awaiting_customer_payment` | `PayNowButton` (calls `create-payment-intent` edge function, opens Stripe sheet) |
| `payment_authorized` | "Payment confirmed" badge, no action |
| `in_progress` | Message cleaner button |
| `completion_pending_customer` | "Confirm job complete" primary CTA |
| `completed` | "Leave a review" CTA (if no review yet) |
| `cleaner_declined` | "Find another cleaner" CTA → `CleanerDiscoveryScreen` |
| `cancelled` | Static cancelled state |

- **Messaging section:**
  - `MessageThread` component using Supabase Realtime subscription on `messages` WHERE `booking_id`
  - `MessageInput` pinned above keyboard

**Data required from Supabase:**
- `bookings` WHERE `id = bookingId` — real-time subscription via `supabase.channel()`
- `messages` WHERE `booking_id = bookingId` — real-time subscription
- `profiles` JOIN for cleaner name/avatar
- `reviews` WHERE `booking_id = bookingId` — to show/hide review CTA

**Navigation:**
- Back: `BookingListScreen` or `HomeScreen` (back stack depends on entry point)
- Review CTA → `ReviewSubmitBottomSheet`

---

### Screen 10 — BookingListScreen

**Component name:** `BookingListScreen`  
**Route:** `/bookings` (Tab 3)

**Purpose:**  
History + active bookings overview.

**UI components:**
- `SegmentedControl` — "Active" / "Past" tabs
- `FlatList` of `BookingHistoryCard`:
  - Cleaner avatar + name
  - Service + date
  - Status pill (colour-coded)
  - Tap → `BookingStatusScreen`
- Empty state with "Book your first clean" CTA

**Data required:**
- `bookings` WHERE `customer_id = currentUser` ORDER BY `created_at DESC`
- JOIN `profiles` (cleaner names)
- JOIN `services` (service title snapshot fallback)

---

### Screen 11 — ReviewSubmitBottomSheet

**Component name:** `ReviewSubmitBottomSheet`  
**Presented as:** `BottomSheet` (modal, not full screen)

**Purpose:**  
Collect a star rating and optional comment. Shown after booking reaches `completed` status. Deferred until the user taps the CTA — not forced on status change.

**UI components:**
- `StarRatingSelector` — 5 large tappable stars
- `TextArea` — "Tell others about [FirstName]" (optional, 200 char max)
- `SubmitButton` — "Submit review" primary

**Data written:**
```
reviews:
  booking_id, reviewer_id = currentUser, reviewee_id = cleaner_id,
  rating, comment
```
After submit: updates `cleaner_profiles.average_rating` and `total_reviews` via a Supabase DB trigger (already implied by the schema).

---

## 3. UX Improvements

### Reduction in screens vs web

The web flow requires navigating across ~6 distinct pages (search → filter → profile → edit service → confirm → receipt). The mobile wizard completes the same journey in a **5-step wizard** launched from a single profile screen — 3 fewer page transitions, no back-and-forth between service editing and rate checking.

### Bottom sheet usage

| Use case | Why bottom sheet instead of full screen |
|---|---|
| Filter controls | User remains anchored to results list behind it |
| Address change | User can see their current address above the sheet |
| Fee explainer | Tiny informational content doesn't warrant a full screen |
| Review submission | Brief form, keeps context of completed booking visible |
| Bio expansion | Avoids navigation penalty for curiosity-driven reads |
| Notification drawer | Transient content, easy to dismiss |

### Sticky CTAs

Every wizard screen has a `StickyBookingCTA` component sitting above the safe-area bottom inset (accounts for home indicator on iOS and navigation bar on Android). This component:
- Has a fixed `position: absolute, bottom: 0` container
- Respects `useSafeAreaInsets().bottom`
- Animates `opacity` and `translateY` from disabled → enabled state
- Button label is dynamic per screen to describe the next action, not just "Next"

### Progressive disclosure

- Bio is truncated on profile screen — expanded only on tap
- Platform fee is collapsed on pricing screen — expanded on tap
- Property details on `JobDetailsScreen` are pre-filled and visually compact — the user only sees them if they want to edit
- Trust badge detail (what DBS means) available via long-press on badge chip

### Reducing typing

| Web input | Mobile replacement |
|---|---|
| Full address form (4 fields) | Pre-filled from saved preferences, confirm with 1 tap |
| Service type dropdown | Tappable icon cards |
| Time input field | Pre-generated time slot chips from availability data |
| Duration input | +/- stepper |
| Room count field | +/- stepper (pre-filled) |
| Pets field | Toggle switch (pre-filled) |

### Pre-fill from customer_preferences

On `JobDetailsScreen`, the following fields load from `customer_preferences`:
- `address` → `location_text`
- `postcode` → appended to `location_text`, used for geocoding
- `room_count` → property stepper default
- `has_pets` → pets toggle default

If `customer_preferences` has no saved address (new user or incomplete onboarding), the `AddressConfirmCard` shows an "Add address" empty state that opens `AddressBottomSheet` immediately.

### Trust signals

Prioritised on `CleanerProfileScreen` by hierarchy:
1. **Verification badges** — top-of-hero, visible before user scrolls. Must be earned (only rendered if `cleaner_documents` all have `status = 'approved'`).
2. **Star rating + review count** — immediately below hero. Rating shown to 1 decimal, review count in parentheses.
3. **Jobs completed** — adjacent to rating. Social proof that the cleaner is experienced.
4. **Recent reviews** — scrollable below the fold. First review visible without scrolling.
5. **Response time** — shown below stat row. "Usually responds within 1 hour" (static in v1.0).

### Preventing booking drop-off

| Drop-off risk | Mitigation |
|---|---|
| User unsure of total cost before committing | `PaymentNoteText` on `PricingScreen` clearly states no charge until acceptance |
| User navigates away mid-wizard | Wizard state persisted in AsyncStorage; on next open, prompt "Continue your booking with [name]?" |
| User confused by pending state | `BookingStatusScreen` shows expected response time and a messaging channel |
| Cleaner declines — user leaves app | Decline screen shows "Find another cleaner" CTA, not a dead end |
| Payment screen feels scary | Stripe sheet is a recognised, trusted UI pattern for UK users |

---

## 4. Component Design System (Mobile)

### CleanerCard
**File:** `components/CleanerCard.tsx`

```
Props:
  cleanerId: string
  name: string
  avatarUrl: string | null
  averageRating: number | null
  totalReviews: number
  hourlyRate: number           // pence
  services: string[]           // service names
  isVerified: boolean
  onPress: () => void

Layout:
  Row: [Avatar 52px] [Content column] [Rate column]
  Content: Name (semibold), service chips (horizontal scroll, 2 max shown),
           star + rating + review count
  Rate: £X/hr (right-aligned, 16pt semibold)
  Bottom border, full-width tap target
  isVerified: small teal ✓ badge on avatar bottom-right

Dimensions: 80px height, full width, 16px horizontal padding
```

---

### ServiceSelectorBottomSheet
**File:** `components/ServiceSelectorBottomSheet.tsx`

```
Props:
  services: { id: string; title: string; description: string }[]
  selectedId: string | null
  onSelect: (serviceId: string) => void
  onClose: () => void

Layout:
  BottomSheet (snapPoint 50% screen height)
  Header: drag handle + "Choose a service" label
  FlatList of ServiceOptionRow:
    icon (category-based) + title + description + radio indicator
  Footer: "Confirm" sticky button
```

---

### PriceBreakdownCard
**File:** `components/PriceBreakdownCard.tsx`

```
Props:
  hourlyRateCents: number
  estimatedHours: number
  platformFeeCents: number

Derived:
  subtotalCents = hourlyRateCents × estimatedHours
  totalCents = subtotalCents + platformFeeCents

Layout:
  Card with 16px padding, rounded-xl, shadow-sm
  Row: "£X/hr × Y hrs"  →  "£Z"
  Row: "Booking fee (?)"  →  "£A"
  Divider
  Row bold: "Total"  →  "£B"
  All amounts formatted: (cents / 100).toFixed(2) + ' GBP'
  ? icon opens FeeExplainerBottomSheet
```

---

### StickyBookingCTA
**File:** `components/StickyBookingCTA.tsx`

```
Props:
  label: string
  onPress: () => void
  disabled?: boolean
  loading?: boolean
  subLabel?: string            // e.g. "£48.00 total" shown above button

Layout:
  Absolute positioned View, bottom: 0
  Padding: useSafeAreaInsets().bottom + 16px
  Background: white with top border and subtle shadow
  If subLabel: small grey text above button
  Button: full width, 52px height, teal background, white text, 14px semibold
  Disabled: 40% opacity, non-interactive
  Loading: ActivityIndicator replaces label text
```

---

### StepProgressIndicator
**File:** `components/StepProgressIndicator.tsx`

```
Props:
  totalSteps: number    // 5
  currentStep: number   // 1-indexed

Layout:
  Row of dots (8px diameter circles), 8px gap
  Completed steps: filled teal
  Current step: filled teal + 1px border glow
  Upcoming steps: grey outline
  Centered horizontally in header area
  Does not show step numbers — purely visual
```

---

### LocationPicker
**File:** `components/LocationPicker.tsx`

```
Props:
  initialAddress: string | null
  initialPostcode: string | null
  onChange: (result: { locationText: string; lat: number | null; lng: number | null }) => void

Layout:
  AddressConfirmCard (read-only display) with "Change" link
  Opens AddressBottomSheet on press:
    TextInput with debounced postcode lookup via postcodes.io
    Address line 1 + line 2 inputs
    City input (auto-filled from postcode lookup)
    "Use this address" confirm CTA
```

---

### DateTimeSelector
**File:** `components/DateTimeSelector.tsx`

```
Props:
  availabilitySlots: AvailabilitySlot[]
  bookedSlots: { start: string; end: string }[]
  onSelect: (date: string, startTime: string) => void

Layout:
  WeekStrip: horizontal FlatList of 14 days (2 weeks out)
    Each day: short day name + date number
    Unavailable days (no slots): greyed text, non-tappable
    Selected: teal filled pill

  TimeSlotGrid (updates when day selected):
    2-column grid of time chips (HH:MM format)
    Occupied slots: strikethrough + grey, non-tappable
    Available: white border pill
    Selected: teal filled pill

  No native DateTimePicker used — avoids platform inconsistency
  All slot generation is computed from AvailabilitySlot[] + excluded booked windows
```

---

## 5. Data Flow (Supabase Mapping)

### Tables touched at each wizard step

| Wizard step | Tables read | Tables written |
|---|---|---|
| Discovery | `cleaner_profiles`, `profiles`, `cleaner_services`, `services`, `cleaner_availability` | — |
| Cleaner profile | `cleaner_profiles`, `profiles`, `cleaner_services`, `cleaner_documents`, `reviews` | — |
| Step 1: Service select | `cleaner_services`, `services` | — |
| Step 2: Schedule | `cleaner_availability`, `bookings` (conflict check) | — |
| Step 3: Job details | `customer_preferences` | — (changes held in local state) |
| Step 4: Pricing | `platform_settings` | — |
| Step 5: Confirm | — | `bookings` (INSERT), `notifications` (INSERT) |
| Post-confirm: status | `bookings` (realtime), `messages` (realtime), `profiles` | `messages` (INSERT) |
| Payment | `bookings`, `payments` (via edge fn) | via Stripe webhook → `bookings.payment_status`, `payments` |
| Post-job: review | `reviews` (check exists) | `reviews` (INSERT) |

---

### Booking creation (draft vs confirmed)

**No draft state in v1.0.** The booking is only written to Supabase when the user taps "Confirm request" on `BookingConfirmScreen`. Prior to that, all wizard state is held in:
1. React Navigation route params passed between screens
2. A `useBookingWizard` context/hook that owns the in-flight state
3. AsyncStorage persistence (auto-saved on each step completion, cleared on successful submit)

Rationale: a draft row in Supabase creates noise in cleaner dashboards and admin views. Persisting locally until confirmed keeps the data clean and the schema simple.

---

### Stripe trigger sequence

```
1. Booking INSERT → status='pending_request', payment_status='unpaid'
2. Notification INSERT → cleaner receives push/in-app
3. Cleaner taps Accept (CleanerApp) → booking.status = 'awaiting_customer_payment'
4. Customer receives push notification + BookingStatusScreen updates via realtime
5. Customer taps "Pay now" → calls Edge Function: create-payment-intent
   - Reads booking.quote_cents + platform_fee from booking_financials
   - Creates Stripe PaymentIntent with amount = total_cents
   - Returns client_secret
6. Stripe Payment Sheet opens (expo-stripe / @stripe/stripe-react-native)
7. On payment success → Stripe webhook fires payment_intent.succeeded
   - Edge Function: handle-payment-webhook
   - Updates booking.status = 'payment_authorized', payment_status = 'authorized'
   - Notifies cleaner: "Payment confirmed, proceed with job"
8. Cleaner performs job
9. Cleaner marks complete → booking.status = 'completion_pending_customer'
10. Customer confirms complete → booking.status = 'completed'
11. Edge Function: process-payout fires
    - Reads booking.cleaner_payout_cents
    - Creates Stripe Transfer to cleaner's stripe_account_id
    - Updates payouts row, payout_status = 'released'
```

---

### Cleaner notification flow

```
Trigger                          → Notification type          → Delivery
─────────────────────────────────────────────────────────────────────────
Booking confirmed (customer)     → 'booking_request'          → in-app + push
Customer pays                    → 'payment_confirmed'        → in-app + push
Customer confirms complete        → 'job_confirmed_complete'   → in-app
Review submitted                 → 'new_review'               → in-app
```

Push delivery in v1.0 uses **Expo Push Notifications** (`expo-notifications`). The `expo_push_token` is stored in `profiles.expo_push_token` (add this column in next migration) and passed to a Supabase Edge Function that calls the Expo push API.

---

### Booking status lifecycle

```
pending_request
    │
    ├─(cleaner accepts)──────────────→ awaiting_customer_payment
    │                                         │
    ├─(cleaner declines)─────────────→ cleaner_declined               [terminal]
    │                                         │
    └─(customer cancels)─────────────→ cancelled                      [terminal]
                                              │
                              (customer pays)─┘
                                              │
                                    payment_authorized
                                              │
                                    in_progress (cleaner starts job)
                                              │
                                    completion_pending_customer (cleaner marks done)
                                              │
                                    completed (customer confirms)
                                              │
                                    payout released → [terminal]
                                              │
                              (if dispute)────┘
                                    disputed
                                       └─(resolved)──→ completed / refunded
```

---

## 6. Key UX Risks + Fixes

### Risk 1: Payment confusion — "When do I actually get charged?"

**Drop-off point:** `PricingScreen` → user sees total and abandons because they think they're being charged now  
**Fix:** `PaymentNoteText` component on `PricingScreen` and `BookingConfirmScreen` explicitly states: *"No charge now. You'll pay only if [FirstName] accepts."* This mirrors how Airbnb and Treatwell communicate pre-authorisation.

---

### Risk 2: Pending state anxiety — "Did my request go through?"

**Drop-off point:** After `BookingConfirmScreen`, user doesn't trust the quiet pending state  
**Fix:**  
- `BookingStatusScreen` shows an animated confirmation (booking ID, timestamp, check animation)
- "Expected response within 2 hours" sets expectations
- In-app notification + push fires when cleaner responds
- `ActiveBookingBanner` on `HomeScreen` persists until status changes

---

### Risk 3: Address friction — new users have no saved address

**Drop-off point:** `JobDetailsScreen` for users who skipped onboarding  
**Fix:**  
- Detect empty `customer_preferences` early (on `HomeScreen` load) and show a subtle "Complete your profile for faster booking" nudge
- On `JobDetailsScreen`, if no saved address, open `AddressBottomSheet` immediately rather than showing an empty card
- After a user manually enters an address during booking, prompt "Save this as your default address?" before proceeding

---

### Risk 4: No available time slots

**Drop-off point:** `ScheduleScreen` shows all slots greyed out  
**Fix:**  
- Show earliest next available date as a quick-tap suggestion: "Next available: Tue 20 May → Jump to it"
- If no slots in the next 14 days, show a full "Fully booked" state with "Find another cleaner" CTA
- On `CleanerDiscoveryScreen`, pre-filter by `day_of_week` availability so users don't reach a fully-blocked calendar

---

### Risk 5: Cleaner declines — cold dead end

**Drop-off point:** User receives decline, returns to `BookingStatusScreen`, sees terminal state, leaves  
**Fix:**  
- Decline state shows: "Don't worry — [FirstName] is unavailable, but there are other great cleaners nearby"
- Immediately below: `CleanerCard` list showing top 3 alternative cleaners matching the same service + location
- "Book an alternative" CTA re-enters the wizard with the same service/date pre-filled

---

### Risk 6: Long wizard fatigue on mobile

**Drop-off point:** Users quit mid-wizard when they see 5 steps  
**Fix:**  
- `StepProgressIndicator` shows current step as teal filled, not a numbered label — progress *felt*, not counted
- Each step screen has a single clear question as its title — no paragraphs of instruction
- Steps 3 and 4 (job details and pricing) are read-confirmation steps, not data-entry steps for returning users with saved addresses — they take < 10 seconds each
- AsyncStorage draft means the cost of abandonment is zero — user can return mid-flow

---

### Risk 7: Payment sheet failure (Stripe)

**Drop-off point:** Stripe sheet dismisses (network error, card decline) — user stranded on status screen  
**Fix:**  
- `PayNowButton` on `BookingStatusScreen` is always re-tappable while status is `awaiting_customer_payment`
- On sheet dismissal without success, show an inline `AlertBanner`: "Payment didn't go through. Tap to try again."
- On card decline: show Stripe's native decline message (provided by the SDK) + option to add a different card

---

### Risk 8: Review fatigue — ignored post-job prompt

**Impact:** Low review volume hurts trust signal quality on cleaner profiles  
**Fix:**  
- Review CTA appears on `BookingStatusScreen` (contextual, not a push notification)
- At app launch after a completed booking: single-step "Rate [FirstName]" bottom sheet on `HomeScreen` — star tap is the only required action, comment is optional
- Never send more than one push notification asking for a review per completed booking

---

## Appendix A — Wizard State Shape

```typescript
interface BookingWizardState {
  cleanerId: string
  cleanerName: string
  cleanerAvatarUrl: string | null
  cleanerHourlyRateCents: number

  // Step 1
  serviceId: string | null
  serviceTitleSnapshot: string | null

  // Step 2
  selectedDate: string | null          // 'YYYY-MM-DD'
  selectedStartTime: string | null     // 'HH:MM'
  estimatedHours: number               // default 2

  // Step 3
  locationText: string | null
  latitude: number | null
  longitude: number | null
  notes: string

  // Step 4 (computed, not stored)
  // quoteCents, platformFeeCents, totalCents → derived on render

  // Meta
  lastCompletedStep: 0 | 1 | 2 | 3 | 4
  startedAt: string                    // ISO timestamp
}
```

---

## Appendix B — Recommended Expo Libraries

| Feature | Library |
|---|---|
| Navigation | `@react-navigation/native` + `@react-navigation/stack` + `@react-navigation/bottom-tabs` |
| Bottom sheets | `@gorhom/bottom-sheet` |
| Stripe payments | `@stripe/stripe-react-native` |
| Safe area insets | `react-native-safe-area-context` |
| AsyncStorage | `@react-native-async-storage/async-storage` |
| Push notifications | `expo-notifications` |
| Location/geocoding | `expo-location` + `postcodes.io` API (UK postcode lookup, free, no API key) |
| Map view (v1.1) | `expo-maps` (Expo SDK 52+) |
| Animations | `react-native-reanimated` (already included in Expo SDK) |
| Supabase client | `@supabase/supabase-js` |
| Date utilities | `date-fns` (lightweight, tree-shakeable) |

---

## Appendix C — Screen Inventory Summary

| # | Screen name | Type | Entry point |
|---|---|---|---|
| 1 | HomeScreen | Tab root | App launch |
| 2 | CleanerDiscoveryScreen | Full screen | HomeScreen, SearchTab |
| 3 | CleanerProfileScreen | Full screen (wizard entry) | CleanerDiscoveryScreen |
| 4 | ServiceSelectScreen | Wizard step 1 | CleanerProfileScreen CTA |
| 5 | ScheduleScreen | Wizard step 2 | ServiceSelectScreen |
| 6 | JobDetailsScreen | Wizard step 3 | ScheduleScreen |
| 7 | PricingScreen | Wizard step 4 | JobDetailsScreen |
| 8 | BookingConfirmScreen | Wizard step 5 | PricingScreen |
| 9 | BookingStatusScreen | Full screen | BookingConfirmScreen, BookingListScreen |
| 10 | BookingListScreen | Tab root | BookingsTab |
| 11 | ReviewSubmitBottomSheet | Bottom sheet | BookingStatusScreen |
| — | FilterBottomSheet | Bottom sheet | CleanerDiscoveryScreen |
| — | AddressBottomSheet | Bottom sheet | JobDetailsScreen |
| — | FeeExplainerBottomSheet | Bottom sheet | PricingScreen |
| — | ReviewListBottomSheet | Bottom sheet | CleanerProfileScreen |
| — | NotificationDrawer | Bottom sheet | HomeScreen bell icon |
