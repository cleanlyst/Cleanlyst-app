<template>
  <main class="page-main">
    <section class="page-header mb-4">
      <div>
        <h1 class="header-title">Welcome back, {{ auth.profile?.full_name ?? 'Cleaner' }}</h1>
      </div>
      <div>
        <a href="#" class="button-secondary">+ Book a Cleaner</a>
      </div>
    </section>

    <div class="content-grid">
      <section class="main-col">
        <div class="section-header">
          <h2 class="section-title">Upcoming Bookings</h2>
          <span class="booking-count-badge">2 SCHEDULED</span>
        </div>
        <div class="bookings-list">
          <!-- Booking Card 1 -->
          <div class="booking-card">
            <div class="booking-inner">
              <div class="booking-media">
                <img
                  alt="Cleaner profile"
                  class="booking-img"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuA1tWjZbdKboZLWFw3bVbqJq7dvVzYk85LqT9A9A4FN976nRjtKXgBozeBnHCb0cXJ-XQe5weeUQ1ghNayYIQugGAtZgi-tvoPioLQDA7Cnji9Toomnug5bCiUoi-5iPaKU1UlAoL1NBZbBS3L7_QhhZ0wJdSfmfF-_pKvpEfr4OXFbgqQXTAyWcLo_pS8FcaZbWtX7gwQZK3QRsRpVgDKtJ1fUHysbYdEbMgpHRnu4ECZeZkVOdRqMpqX1Nady7zUu0cgHIccFAw"
                />
              </div>
              <div class="booking-body">
                <div class="booking-title-row">
                  <div>
                    <h3 class="booking-title">Deep Apartment Clean</h3>
                    <p class="booking-provider">with Sarah Miller</p>
                  </div>
                  <span class="booking-price">$120.00</span>
                </div>
                <div class="booking-meta">
                  <div class="booking-meta-item">
                    <span
                      class="material-symbols-outlined booking-meta-icon"
                      data-icon="calendar_today"
                      >calendar_today</span
                    >
                    <span class="booking-meta-text">Oct 24, 2024</span>
                  </div>
                  <div class="booking-meta-item">
                    <span class="material-symbols-outlined booking-meta-icon" data-icon="schedule"
                      >schedule</span
                    >
                    <span class="booking-meta-text">10:00 AM - 2:00 PM</span>
                  </div>
                  <div class="booking-meta-item">
                    <span
                      class="material-symbols-outlined booking-meta-icon"
                      data-icon="location_on"
                      >location_on</span
                    >
                    <span class="booking-meta-text">Home (742 Evergreen Terr)</span>
                  </div>
                </div>
              </div>
              <div class="booking-actions">
                <button class="btn-icon">
                  <span class="material-symbols-outlined" data-icon="edit">edit</span>
                </button>
                <button class="btn-icon btn-icon--danger">
                  <span class="material-symbols-outlined" data-icon="cancel">cancel</span>
                </button>
              </div>
            </div>
          </div>

          <!-- Booking Card 2 -->
          <div class="booking-card">
            <div class="booking-inner">
              <div class="booking-media">
                <img
                  alt="Cleaner profile"
                  class="booking-img"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuA2salg7fJwXUrbD1-Wi455-2luTsG7GYMYo_uH1kE1euMYrpY-VTEQT3syuiykc5IwGcLpbtuZXdb6z79KOlw9Vms0QwRB-bRdP8y92xoaQSQQHVlTLEi5WX9oYQaAWyNMRz51jWZ3aQ3JBfRxPc3xyyRm7mlvICbXIwICtuJJNzRYoyxqBnIrBo2TgMoSuuOkl96_BoSQlXThT8spYlc4LwjNHiiJ4su5krvTGuw4zOSKVOUOrHIxQdEzu8oQVxkbugNkodr27Q"
                />
              </div>
              <div class="booking-body">
                <div class="booking-title-row">
                  <div>
                    <h3 class="booking-title">Standard Weekly Maintenance</h3>
                    <p class="booking-provider">with EcoClean Pros</p>
                  </div>
                  <span class="booking-price">$85.00</span>
                </div>
                <div class="booking-meta">
                  <div class="booking-meta-item">
                    <span
                      class="material-symbols-outlined booking-meta-icon"
                      data-icon="calendar_today"
                      >calendar_today</span
                    >
                    <span class="booking-meta-text">Oct 31, 2024</span>
                  </div>
                  <div class="booking-meta-item">
                    <span class="material-symbols-outlined booking-meta-icon" data-icon="schedule"
                      >schedule</span
                    >
                    <span class="booking-meta-text">09:00 AM - 12:00 PM</span>
                  </div>
                  <div class="booking-meta-item">
                    <span
                      class="material-symbols-outlined booking-meta-icon"
                      data-icon="location_on"
                      >location_on</span
                    >
                    <span class="booking-meta-text">Home (742 Evergreen Terr)</span>
                  </div>
                </div>
              </div>
              <div class="booking-actions">
                <button class="btn-icon">
                  <span class="material-symbols-outlined" data-icon="edit">edit</span>
                </button>
                <button class="btn-icon btn-icon--danger">
                  <span class="material-symbols-outlined" data-icon="cancel">cancel</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Sidebar / Insights -->
      <aside class="sidebar">
        <div class="overview-card">
          <h3 class="overview-title">Account Overview</h3>
          <div class="overview-rows">
            <div class="overview-row">
              <span class="overview-label">Total Bookings</span>
              <span class="overview-value">24</span>
            </div>

            <div class="overview-row overview-row--last">
              <span class="overview-label">Next Clean</span>
              <span class="overview-value">In 3 Days</span>
            </div>
          </div>
        </div>
      </aside>
    </div>

    <!-- Past Bookings Section -->
    <section class="past-section">
      <div class="past-header">
        <h2 class="past-title">Past Bookings</h2>
        <button class="view-all-btn">
          View All History
          <span class="material-symbols-outlined view-all-icon" data-icon="arrow_forward"
            >arrow_forward</span
          >
        </button>
      </div>
      <div class="past-grid">
        <!-- Past Booking Item 1 -->
        <div class="past-card">
          <div class="past-card-header">
            <div>
              <p class="past-date">Oct 10, 2024</p>
              <h4 class="past-name">Move-out Cleaning</h4>
            </div>
            <span class="status-badge">COMPLETE</span>
          </div>
          <div class="cleaner-row">
            <div class="cleaner-avatar">
              <span class="material-symbols-outlined cleaner-avatar-icon" data-icon="person"
                >person</span
              >
            </div>
            <span class="cleaner-name">James Wilson</span>
          </div>
          <div class="past-footer">
            <span class="past-price">$180.00</span>
            <button class="rebook-btn">Re-book</button>
          </div>
        </div>

        <!-- Past Booking Item 2 -->
        <div class="past-card">
          <div class="past-card-header">
            <div>
              <p class="past-date">Sep 28, 2024</p>
              <h4 class="past-name">Standard Maintenance</h4>
            </div>
            <span class="status-badge">COMPLETE</span>
          </div>
          <div class="cleaner-row">
            <div class="cleaner-avatar">
              <span class="material-symbols-outlined cleaner-avatar-icon" data-icon="person"
                >person</span
              >
            </div>
            <span class="cleaner-name">Sarah Miller</span>
          </div>
          <div class="past-footer">
            <span class="past-price">$85.00</span>
            <button class="rebook-btn">Re-book</button>
          </div>
        </div>

        <!-- Past Booking Item 3 -->
        <div class="past-card">
          <div class="past-card-header">
            <div>
              <p class="past-date">Sep 14, 2024</p>
              <h4 class="past-name">Deep Window Clean</h4>
            </div>
            <span class="status-badge">COMPLETE</span>
          </div>
          <div class="cleaner-row">
            <div class="cleaner-avatar">
              <span class="material-symbols-outlined cleaner-avatar-icon" data-icon="person"
                >person</span
              >
            </div>
            <span class="cleaner-name">Alex Rivera</span>
          </div>
          <div class="past-footer">
            <span class="past-price">$110.00</span>
            <button class="rebook-btn">Re-book</button>
          </div>
        </div>
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
import type { PropType } from 'vue'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()

interface BookingSummary {
  id: string
  service_title_snapshot: string | null
  location_text: string
  scheduled_start: string
  status: string
}

interface CleanerDataItem {
  id: string
  name: string
  rating: number
  services: string
  price: string
  available: string
  photo?: string
}

defineProps({
  cleanersData: { type: Array as PropType<CleanerDataItem[]>, default: () => [] },
  fallbackPhoto: { type: String, default: '' },
  bookings: { type: Array as PropType<BookingSummary[]>, default: () => [] },
  recentBookings: {
    type: Array as PropType<Array<{ id: string; name: string; detail: string }>>,
    default: () => [],
  },
})
</script>

<style scoped>
.material-symbols-outlined {
  font-variation-settings:
    'FILL' 0,
    'wght' 400,
    'GRAD' 0,
    'opsz' 24;
  display: inline-block;
  line-height: 1;
  text-transform: none;
  letter-spacing: normal;
  word-wrap: normal;
  white-space: nowrap;
  direction: ltr;
}

.page-main {
  padding-top: 2rem;
  padding-bottom: 4rem;
  padding-left: 1.5rem;
  padding-right: 1.5rem;
  max-width: 80rem;
  margin: 0 auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.button-secondary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 1.5rem;
  padding: 0.5rem 2rem;
  border-radius: var(--radius);
  font-family: var(--font-label-md);
  font-size: 14px;
  font-weight: 500;
  line-height: 1.4;
  letter-spacing: 0.01em !important;
  text-decoration: none;
  background: #000000;
  color: #ffffff;
  border: 1px solid #000000;
  transition:
    background-color 200ms ease,
    opacity 200ms ease,
    transform 150ms ease,
    border-color 200ms ease;
}

.button-secondary:hover {
  opacity: 0.85;
}

/* Two-column layout */
.content-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 2rem;
}

/* ── Main column ── */
.main-col {
  width: 100%;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.5rem;
}

.section-title {
  font-family: var(--font-h2);
  font-size: 24px;
  font-weight: 600;
  line-height: 1.3;
  letter-spacing: -0.01em;
  color: var(--on-surface, #1a1c1c);
}

.booking-count-badge {
  background: var(--surface-container, #eeeeee);
  color: var(--on-surface-variant, #444748);
  padding: 0.25rem 0.75rem;
  border-radius: 0.25rem;
  font-family: var(--font-caption);
  font-size: 12px;
  font-weight: 400;
  line-height: 1.4;
}

.bookings-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.booking-card {
  border: 1px solid var(--outline-variant, #c4c7c7);
  background: #ffffff;
  padding: 1.5rem;
  border-radius: 0.25rem;
  transition: border-color 200ms ease;
}

.booking-card:hover {
  border-color: var(--primary, #000000);
}

.booking-inner {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.booking-media {
  width: 100%;
  height: 8rem;
  flex-shrink: 0;
}

.booking-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 0.125rem;
}

.booking-body {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.booking-title-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.booking-title {
  font-family: var(--font-label-md);
  font-size: 14px;
  font-weight: 500;
  line-height: 1.4;
  letter-spacing: 0.01em;
  color: var(--primary, #000000);
}

.booking-provider {
  font-family: var(--font-body);
  font-size: 16px;
  font-weight: 400;
  line-height: 1.6;
  color: var(--secondary, #5e5e5e);
}

.booking-price {
  font-family: var(--font-label-md);
  font-size: 14px;
  font-weight: 500;
  line-height: 1.4;
  letter-spacing: 0.01em;
  color: var(--primary, #000000);
}

.booking-meta {
  margin-top: 1rem;
  display: flex;
  flex-wrap: wrap;
  gap: 1.5rem;
  align-items: center;
}

.booking-meta-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--secondary, #5e5e5e);
}

.booking-meta-icon {
  font-size: 0.875rem;
}

.booking-meta-text {
  font-family: var(--font-caption);
  font-size: 12px;
  font-weight: 400;
  line-height: 1.4;
}

.booking-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}

.btn-icon {
  padding: 0.5rem;
  border: 1px solid var(--outline-variant, #c4c7c7);
  border-radius: 0.125rem;
  background: transparent;
  cursor: pointer;
  transition: background-color 200ms ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-icon:hover {
  background: var(--surface-container, #eeeeee);
}

.btn-icon--danger {
  color: var(--error, #ba1a1a);
}

/* ── Sidebar ── */
.sidebar {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.overview-card {
  border: 1px solid var(--outline-variant, #c4c7c7);
  background: #ffffff;
  padding: 1.5rem;
  border-radius: 0.25rem;
}

.overview-title {
  font-family: var(--font-label-md);
  font-size: 14px;
  font-weight: 500;
  line-height: 1.4;
  letter-spacing: 0.01em;
  margin-bottom: 1rem;
}

.overview-rows {
  display: flex;
  flex-direction: column;
}

.overview-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0;
  border-bottom: 1px solid var(--surface-container, #eeeeee);
}

.overview-row--last {
  border-bottom: none;
}

.overview-label {
  font-family: var(--font-caption);
  font-size: 12px;
  font-weight: 400;
  line-height: 1.4;
  color: var(--secondary, #5e5e5e);
}

.overview-value {
  font-family: var(--font-label-md);
  font-size: 14px;
  font-weight: 500;
  line-height: 1.4;
  letter-spacing: 0.01em;
}

.membership-card {
  border: 1px solid var(--outline-variant, #c4c7c7);
  background: #1c1b1b;
  color: #ffffff;
  padding: 1.5rem;
  border-radius: 0.25rem;
}

.membership-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  opacity: 0.7;
}

.membership-title {
  font-family: var(--font-h2);
  font-size: 24px;
  font-weight: 600;
  line-height: 1.3;
  letter-spacing: -0.01em;
  margin-top: 0.5rem;
}

.membership-desc {
  font-family: var(--font-caption);
  font-size: 12px;
  font-weight: 400;
  line-height: 1.4;
  margin-top: 0.5rem;
  opacity: 0.8;
}

.membership-btn {
  margin-top: 1.5rem;
  width: 100%;
  padding: 0.75rem 0;
  background: #ffffff;
  color: var(--primary, #000000);
  font-family: var(--font-label-md);
  font-size: 14px;
  font-weight: 500;
  line-height: 1.4;
  border: none;
  border-radius: 0.125rem;
  cursor: pointer;
  transition: background-color 200ms ease;
}

.membership-btn:hover {
  background: var(--surface-container, #eeeeee);
}

/* ── Past Bookings ── */
.past-section {
  margin-top: 6rem;
}

.past-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 2rem;
}

.past-title {
  font-family: var(--font-h2);
  font-size: 24px;
  font-weight: 600;
  line-height: 1.3;
  letter-spacing: -0.01em;
  color: var(--on-surface, #1a1c1c);
}

.view-all-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-family: var(--font-label-md);
  font-size: 14px;
  font-weight: 500;
  line-height: 1.4;
  letter-spacing: 0.01em;
  color: var(--secondary, #5e5e5e);
  background: transparent;
  border: none;
  cursor: pointer;
  transition: color 200ms ease;
}

.view-all-btn:hover {
  color: var(--primary, #000000);
}

.view-all-icon {
  font-size: 0.875rem;
}

.past-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.5rem;
}

.past-card {
  border: 1px solid var(--outline-variant, #c4c7c7);
  padding: 1.5rem;
  background: #ffffff;
  transition: border-color 200ms ease;
}

.past-card:hover {
  border-color: #a1a1aa;
}

.past-card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1rem;
}

.past-date {
  font-family: var(--font-caption);
  font-size: 12px;
  font-weight: 400;
  line-height: 1.4;
  color: var(--secondary, #5e5e5e);
}

.past-name {
  font-family: var(--font-label-md);
  font-size: 14px;
  font-weight: 500;
  line-height: 1.4;
  letter-spacing: 0.01em;
}

.status-badge {
  font-size: 10px;
  font-weight: 700;
  background: var(--surface-container, #eeeeee);
  padding: 0.25rem 0.5rem;
  border-radius: 0.125rem;
}

.cleaner-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
}

.cleaner-avatar {
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  background: var(--surface-container, #eeeeee);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
}

.cleaner-avatar-icon {
  font-size: 0.875rem;
}

.cleaner-name {
  font-family: var(--font-caption);
  font-size: 12px;
  font-weight: 400;
  line-height: 1.4;
}

.past-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 1rem;
  border-top: 1px solid var(--surface-container, #eeeeee);
}

.past-price {
  font-family: var(--font-label-md);
  font-size: 14px;
  font-weight: 500;
  line-height: 1.4;
  letter-spacing: 0.01em;
}

.rebook-btn {
  font-family: var(--font-caption);
  font-size: 12px;
  font-weight: 400;
  line-height: 1.4;
  background: transparent;
  border: none;
  cursor: pointer;
  text-decoration: underline;
}

.rebook-btn:hover {
  text-decoration: none;
}

@media (min-width: 768px) {
  .header-title {
    font-size: 32px;
    font-weight: 600;
    line-height: 1.2;
    letter-spacing: -0.02em;
    color: var(--primary, #000000);
    margin-bottom: 0.5rem;
  }
  .booking-inner {
    flex-direction: row;
  }

  .booking-media {
    width: 8rem;
    height: 8rem;
  }

  .booking-actions {
    flex-direction: column;
  }

  .past-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (min-width: 1024px) {
  .page-main {
    padding-left: 3rem;
    padding-right: 3rem;
  }

  .content-grid {
    grid-template-columns: 8fr 4fr;
    gap: 2rem;
  }

  .past-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
</style>
