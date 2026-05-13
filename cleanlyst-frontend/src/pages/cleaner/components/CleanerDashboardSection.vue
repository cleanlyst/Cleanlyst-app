<template>
  <main class="page-main">
    <p v-if="props.errorMessage" class="error-msg">{{ props.errorMessage }}</p>

    <section class="page-header">
      <div>
        <h1 class="header-title">Welcome back, {{ auth.profile?.full_name ?? 'Cleaner' }}</h1>
        <p class="header-copy">
          You have {{ props.bookingTotals.pending + props.bookingTotals.accepted }} upcoming
          bookings.
        </p>
      </div>
      <div class="availability-card">
        <span class="availability-label">Availability Status</span>
        <button aria-checked="true" class="availability-toggle" role="switch">
          <span aria-hidden="true" class="availability-toggle__thumb"></span>
        </button>
        <span class="availability-badge">Active</span>
      </div>
    </section>

    <section class="earnings-grid">
      <div class="earnings-card">
        <div>
          <span class="metric-label">Total Earnings (Oct)</span>
          <h2 class="metric-value-xl">{{ props.earningsToDate }}</h2>
        </div>
        <div class="metric-footer">
          <span class="metric-footer-text">+12% from last month</span>
          <button class="report-btn">
            View Report <span class="material-symbols-outlined">arrow_forward</span>
          </button>
        </div>
      </div>

      <div class="metric-card">
        <div>
          <span class="metric-label">Rating</span>
          <div class="rating-row">
            <h2 class="metric-value">{{ props.ratingLabel }}</h2>
            <span class="material-symbols-outlined star-icon">star</span>
          </div>
        </div>
        <p class="metric-sub">Based on reviews</p>
      </div>

      <div class="metric-card">
        <div>
          <span class="metric-label">Completed</span>
          <h2 class="metric-value">{{ props.bookingTotals.completed }}</h2>
        </div>
        <p class="metric-sub">Jobs this month</p>
      </div>
    </section>

    <section class="content-grid">
      <div class="bookings-col">
        <div class="section-header">
          <h2 class="section-title">Upcoming Bookings</h2>
          <button class="section-link">View Calendar</button>
        </div>
        <div class="bookings-list">
          <div class="booking-card">
            <div class="booking-media">
              <img
                alt="Property Interior"
                class="booking-img"
                data-alt="A clean and minimal modern residential apartment interior with polished wooden floors and large windows. The lighting is bright and airy, reflecting a high-end light mode UI aesthetic. The room is uncluttered, demonstrating professional cleaning standards in a contemporary setting with soft grey and white tones."
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuC0nkOoWrlNT_ABFh8Wh_YdQ8m6TINXPU5jTt4SFqTD39avWjUGl8gCOweaFFLy7AvGwo0NuJv_-xK5KuW2mrzen4vTSddiouGEzNe5grpSJVsfo-YMvwmOm_8iXXE_c7Ic8lRrzxakBdlehfJ-3u-259JHJx7eITg5-wiFpGdx4_uIhGXLNJkP9azoFDhETsgUMVnQV83-0rWD9_glC6M0iVQUOMr0rUZHlyG5kIYqH6k-w7S4hVZhPDn28lTVOOo3gFdOLm9QQg"
              />
            </div>
            <div class="booking-body">
              <div class="booking-title-row">
                <div>
                  <h3 class="booking-title">Deep Clean - Residence 402</h3>
                  <p class="booking-address">1200 Wall St, Downtown</p>
                </div>
                <span class="booking-time-badge">In 2 Hours</span>
              </div>
              <div class="booking-meta">
                <div class="booking-meta-item">
                  <span class="material-symbols-outlined">schedule</span>
                  09:00 AM - 01:00 PM
                </div>
                <div class="booking-meta-item">
                  <span class="material-symbols-outlined">payments</span>
                  $145.00
                </div>
              </div>
            </div>
            <div class="booking-ctas">
              <button class="btn-start">Start</button>
              <button class="btn-action">Details</button>
            </div>
          </div>

          <div class="booking-card">
            <div class="booking-media">
              <img
                alt="Property Interior"
                class="booking-img"
                data-alt="Close up of a minimalist modern bathroom with white marble surfaces and sleek matte black fixtures. The lighting is high-key and crisp, emphasizing cleanliness and professional order. The image maintains a monochrome palette with sharp contrasts, fitting a functional minimalism wireframe design."
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuBsxhDsh8op7AhudhsSUql8N0Gy3oa4Q5qbP7cXS0moRY7AFtBbGITtx52bzNMMMLYGDWZGfCb66RjHNoJYFiB6SiP0AjW3CPNXW6f7tN1WYKsvwDflH7HfatRLk97OUN_asuY-YVgV5oZ7UN4F4MYazTxqPymlE2Iq8XdH5eKMbc6k7G1ncn1ThbO09FzCQKTPQEEhxEujpzwCQELRJ5VmnEY7irweY9cm39Ru7gPDIJVpA83U0SycfnE6hvVLxcLsAhlCz_duLA"
              />
            </div>
            <div class="booking-body">
              <div class="booking-title-row">
                <div>
                  <h3 class="booking-title">Routine Maintenance</h3>
                  <p class="booking-address">45 Oak Lane, Westside</p>
                </div>
                <span class="booking-time-badge">Tomorrow</span>
              </div>
              <div class="booking-meta">
                <div class="booking-meta-item">
                  <span class="material-symbols-outlined">schedule</span>
                  10:00 AM - 12:30 PM
                </div>
                <div class="booking-meta-item">
                  <span class="material-symbols-outlined">payments</span>
                  $85.00
                </div>
              </div>
            </div>
            <div class="booking-ctas">
              <button class="btn-action">Reschedule</button>
              <button class="btn-action">Details</button>
            </div>
          </div>
        </div>
      </div>

      <div class="route-col">
        <h2 class="section-title">Daily Route</h2>
        <div class="route-map-card">
          <div class="route-map">
            <img
              alt="Route Map"
              class="route-map-img"
              data-alt="A stylized minimalist map of a city grid in monochrome black and white tones. The map features clean geometric lines and simple markers for locations. The aesthetic is utilitarian and technical, using varying shades of grey to indicate density and terrain, perfectly aligned with a professional marketplace dashboard style."
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuCMdK9km2cFDeogop2cldqmog_G2vEVC7dZfBbBqJRQB_EE6H3beIE33rcXcqh8KvgdXfPYuXfTbXx-9Bw5MWqemDSw1OUEAyUaKavTWXtZFhD8ga7VZVEiTh1vQgtzXScr3da4QIKbXDUglnFqnw5i5HY8tLPe5VsQgI4tBKFf9hAlMUMIoEcF7Q-CjWRWq3UjTEXi-9zXZR8x2xE8zXwyDZ7ofBlOMfMhf0oCbH9fPgk1cYD5gcXrnq46_1qKdPovdXuR_k7smg"
            />
            <div class="route-overlay">
              <div class="route-pin">
                <span class="material-symbols-outlined">location_on</span>
                <span class="route-pin-label">Next Stop: Wall St</span>
              </div>
            </div>
          </div>
          <div class="route-details">
            <p class="route-details-label">Optimized Path</p>
            <div class="route-stops">
              <div class="route-stop">
                <div class="stop-dot"></div>
                <span class="stop-text">Home Base</span>
              </div>
              <div class="stop-connector"></div>
              <div class="route-stop">
                <div class="stop-dot--empty"></div>
                <span class="stop-text">Residence 402 (2.4 miles)</span>
              </div>
              <div class="stop-connector"></div>
              <div class="route-stop">
                <div class="stop-dot--faded"></div>
                <span class="stop-text stop-text--faded">Westside (6.1 miles)</span>
              </div>
            </div>
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

const props = defineProps({
  earningsToDate: { type: String, default: '—' },
  bookingTotals: {
    type: Object as PropType<{ pending: number; accepted: number; completed: number }>,
    default: () => ({ pending: 0, accepted: 0, completed: 0 }),
  },
  ratingLabel: { type: String, default: 'No rating yet' },
  errorMessage: { type: String, default: '' },
})
</script>

<style scoped>
/* ── Material Symbols ─────────────────────────────────────────── */
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

/* ── Page shell ───────────────────────────────────────────────── */
.page-main {
  padding-top: 2rem;
  padding-bottom: 5rem;
  padding-left: 1.5rem;
  padding-right: 1.5rem;
  max-width: 80rem;
  margin-left: auto;
  margin-right: auto;
  min-height: 100vh;
}

@media (min-width: 1024px) {
  .page-main {
    padding-left: 3rem;
    padding-right: 3rem;
  }
}

/* ── Error message ────────────────────────────────────────────── */
.error-msg {
  font-size: 14px;
  font-weight: 500;
  line-height: 1.4;
  letter-spacing: 0.01em;
  color: #ba1a1a;
  background-color: #ffdad6;
  border: 1px solid #ba1a1a;
  border-radius: 0.25rem;
  padding: 0.75rem 1rem;
  margin-bottom: 1.5rem;
}

/* ── Page header ──────────────────────────────────────────────── */
.page-header {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  margin-bottom: 3rem;
  gap: 1rem;
}

@media (min-width: 768px) {
  .page-header {
    flex-direction: row;
    align-items: flex-end;
  }
}

.header-title {
  font-size: 32px;
  font-weight: 600;
  line-height: 1.2;
  letter-spacing: -0.02em;
  color: var(--primary, #000000);
  margin-bottom: 0.5rem;
}

.header-copy {
  font-size: 16px;
  font-weight: 400;
  line-height: 1.6;
  color: var(--secondary, #5e5e5e);
}

/* ── Availability card ────────────────────────────────────────── */
.availability-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  background-color: var(--surface-container-lowest, #ffffff);
  padding: 1rem;
  border: 1px solid var(--outline-variant, #c4c7c7);
  border-radius: 0.25rem;
}

.availability-label {
  font-size: 14px;
  font-weight: 500;
  line-height: 1.4;
  letter-spacing: 0.01em;
  color: var(--primary, #000000);
}

.availability-toggle {
  position: relative;
  display: inline-flex;
  height: 1.5rem;
  width: 2.75rem;
  flex-shrink: 0;
  cursor: pointer;
  border-radius: 9999px;
  border: 2px solid transparent;
  transition: background-color 0.2s;
  background-color: var(--primary, #000000);
  outline: none;
}

.availability-toggle__thumb {
  pointer-events: none;
  display: inline-block;
  height: 1.25rem;
  width: 1.25rem;
  transform: translateX(1.25rem);
  border-radius: 9999px;
  background-color: var(--on-primary, #ffffff);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  transition: transform 0.2s ease-in-out;
}

.availability-badge {
  font-size: 10px;
  font-weight: 700;
  line-height: 1.4;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--primary, #000000);
  background-color: var(--surface-container, #eeeeee);
  border-radius: 0.25rem;
  padding: 0.125rem 0.5rem;
}

/* ── Earnings grid ────────────────────────────────────────────── */
.earnings-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.5rem;
  margin-bottom: 4rem;
}

@media (min-width: 768px) {
  .earnings-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}

/* ── Earnings card ────────────────────────────────────────────── */
.earnings-card {
  padding: 2rem;
  border: 1px solid var(--outline-variant, #c4c7c7);
  background-color: var(--surface-container-lowest, #ffffff);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

@media (min-width: 768px) {
  .earnings-card {
    grid-column: span 2;
  }
}

.metric-label {
  font-size: 10px;
  font-weight: 500;
  line-height: 1.4;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--secondary, #5e5e5e);
}

.metric-value-xl {
  font-size: 48px;
  font-weight: 700;
  line-height: 1.1;
  letter-spacing: -0.02em;
  color: var(--primary, #000000);
  margin-top: 0.5rem;
}

.metric-footer {
  margin-top: 2rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--surface-variant, #e2e2e2);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.metric-footer-text {
  font-size: 12px;
  font-weight: 400;
  line-height: 1.4;
  color: var(--secondary, #5e5e5e);
}

.report-btn {
  font-size: 14px;
  font-weight: 500;
  line-height: 1.4;
  letter-spacing: 0.01em;
  color: var(--primary, #000000);
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
}

.report-btn:hover {
  text-decoration: underline;
}

/* ── Metric cards (rating, completed) ────────────────────────── */
.metric-card {
  padding: 2rem;
  border: 1px solid var(--outline-variant, #c4c7c7);
  background-color: var(--surface-container-lowest, #ffffff);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.metric-value {
  font-size: 24px;
  font-weight: 600;
  line-height: 1.3;
  letter-spacing: -0.01em;
  color: var(--primary, #000000);
}

.rating-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.star-icon {
  color: var(--primary, #000000);
  font-variation-settings:
    'FILL' 1,
    'wght' 400,
    'GRAD' 0,
    'opsz' 24;
}

.metric-sub {
  font-size: 12px;
  font-weight: 400;
  line-height: 1.4;
  color: var(--secondary, #5e5e5e);
}

/* ── Content grid ─────────────────────────────────────────────── */
.content-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 3rem;
  align-items: start;
}

@media (min-width: 1024px) {
  .content-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

/* ── Bookings column ──────────────────────────────────────────── */
.bookings-col {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

@media (min-width: 1024px) {
  .bookings-col {
    grid-column: span 2;
  }
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.section-title {
  font-size: 24px;
  font-weight: 600;
  line-height: 1.3;
  letter-spacing: -0.01em;
  color: var(--primary, #000000);
}

.section-link {
  font-size: 14px;
  font-weight: 500;
  line-height: 1.4;
  letter-spacing: 0.01em;
  color: var(--secondary, #5e5e5e);
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
}

.section-link:hover {
  color: var(--primary, #000000);
}

.bookings-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* ── Booking card ─────────────────────────────────────────────── */
.booking-card {
  padding: 1.5rem;
  background-color: var(--surface-container-lowest, #ffffff);
  border: 1px solid var(--outline-variant, #c4c7c7);
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  transition: border-color 0.15s;
}

.booking-card:hover {
  border-color: var(--primary, #000000);
}

@media (min-width: 768px) {
  .booking-card {
    flex-direction: row;
  }
}

.booking-media {
  width: 100%;
  height: 8rem;
  background-color: var(--surface-container, #eeeeee);
  flex-shrink: 0;
  overflow: hidden;
}

@media (min-width: 768px) {
  .booking-media {
    width: 8rem;
  }
}

.booking-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.booking-body {
  flex-grow: 1;
}

.booking-title-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.booking-title {
  font-size: 18px;
  font-weight: 700;
  line-height: 1.3;
  color: var(--primary, #000000);
  margin-bottom: 0.25rem;
}

.booking-address {
  font-size: 16px;
  font-weight: 400;
  line-height: 1.6;
  color: var(--secondary, #5e5e5e);
}

.booking-time-badge {
  font-size: 10px;
  font-weight: 700;
  line-height: 1.4;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  background-color: var(--surface-container, #eeeeee);
  padding: 0.25rem 0.5rem;
  white-space: nowrap;
}

.booking-meta {
  margin-top: 1rem;
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  align-items: center;
}

.booking-meta-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 12px;
  font-weight: 400;
  line-height: 1.4;
  color: var(--secondary, #5e5e5e);
}

.booking-meta-item .material-symbols-outlined {
  font-size: 1rem;
}

.booking-ctas {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
}

@media (min-width: 768px) {
  .booking-ctas {
    flex-direction: column;
  }
}

.btn-start {
  padding: 0.5rem 1rem;
  background-color: var(--primary, #000000);
  color: var(--on-primary, #ffffff);
  font-size: 14px;
  font-weight: 500;
  line-height: 1.4;
  letter-spacing: 0.01em;
  border: none;
  cursor: pointer;
}

.btn-action {
  padding: 0.5rem 1rem;
  background-color: transparent;
  color: var(--primary, #000000);
  font-size: 14px;
  font-weight: 500;
  line-height: 1.4;
  letter-spacing: 0.01em;
  border: 1px solid var(--outline-variant, #c4c7c7);
  cursor: pointer;
  transition: background-color 0.15s;
}

.btn-action:hover {
  background-color: var(--surface-variant, #e2e2e2);
}

/* ── Route column ─────────────────────────────────────────────── */
.route-col {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.route-map-card {
  border: 1px solid var(--outline-variant, #c4c7c7);
  background-color: var(--surface-container-lowest, #ffffff);
  padding: 0.5rem;
}

.route-map {
  width: 100%;
  aspect-ratio: 1 / 1;
  background-color: var(--surface-container, #eeeeee);
  position: relative;
}

.route-map-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: grayscale(1);
  opacity: 0.5;
}

.route-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.route-pin {
  padding: 1rem;
  background-color: var(--surface-container-lowest, #ffffff);
  border: 1px solid var(--primary, #000000);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.route-pin .material-symbols-outlined {
  color: var(--primary, #000000);
}

.route-pin-label {
  font-size: 14px;
  font-weight: 500;
  line-height: 1.4;
  letter-spacing: 0.01em;
}

.route-details {
  padding: 1rem;
}

.route-details-label {
  font-size: 10px;
  font-weight: 400;
  line-height: 1.4;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--secondary, #5e5e5e);
  margin-bottom: 0.5rem;
}

.route-stops {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.route-stop {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.stop-dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 9999px;
  background-color: var(--primary, #000000);
  flex-shrink: 0;
}

.stop-dot--empty {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 9999px;
  border: 1px solid var(--primary, #000000);
  background-color: var(--surface-container-lowest, #ffffff);
  flex-shrink: 0;
}

.stop-dot--faded {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 9999px;
  border: 1px solid var(--primary, #000000);
  background-color: var(--surface-container-lowest, #ffffff);
  opacity: 0.4;
  flex-shrink: 0;
}

.stop-connector {
  width: 1px;
  height: 1rem;
  background-color: var(--outline-variant, #c4c7c7);
  margin-left: 0.1875rem;
}

.stop-text {
  font-size: 14px;
  font-weight: 400;
  line-height: 1.6;
  color: var(--primary, #000000);
}

.stop-text--faded {
  color: var(--secondary, #5e5e5e);
}
</style>
