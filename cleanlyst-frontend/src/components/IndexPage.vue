<template>
  <main class="pt-16">

    <!-- ── Hero ──────────────────────────────────────────────────────────── -->
    <section class="hero-section">
      <div class="hero-inner">
        <h1 class="hero-title">Trusted home cleaners,<br />booked in minutes.</h1>
        <p class="hero-copy">
          Professional, vetted cleaners available across the UK. Fixed prices, no surprises —
          just a spotless home.
        </p>
        <div class="hero-actions">

          <!-- Guest: acquisition CTAs -->
          <template v-if="isGuest">
            <router-link :to="{ name: 'SignupCustomer' }" class="button-primary">
              Book Cleaner
            </router-link>
            <router-link :to="{ name: 'SignupCleaner' }" class="button-secondary">
              Join as a cleaner
            </router-link>
          </template>

          <!-- Customer: booking CTA only -->
          <template v-else-if="isCustomer">
            <router-link :to="{ name: 'BookCleaner' }" class="button-primary">
              Book Cleaner
            </router-link>
          </template>

          <!-- Cleaner / Admin: dashboard CTA -->
          <template v-else>
            <router-link :to="{ name: dashboardRouteName }" class="button-primary">
              Go to dashboard
            </router-link>
          </template>

        </div>
      </div>
    </section>

    <!-- ── Trust strip ────────────────────────────────────────────────────── -->
    <section class="trust-strip">
      <div class="trust-inner">
        <div class="trust-item">
          <span class="material-symbols-outlined trust-icon">verified_user</span>
          <span class="trust-text">Fully vetted &amp; background-checked cleaners</span>
        </div>
        <div class="trust-item">
          <span class="material-symbols-outlined trust-icon">price_check</span>
          <span class="trust-text">Fixed pricing — no hidden fees</span>
        </div>
        <div class="trust-item">
          <span class="material-symbols-outlined trust-icon">thumb_up</span>
          <span class="trust-text">Satisfaction guaranteed on every clean</span>
        </div>
      </div>
    </section>

    <!-- ── Service cards ──────────────────────────────────────────────────── -->
    <section class="services-section">
      <div class="services-inner">

        <!-- Guest / Customer / Admin: what we clean -->
        <template v-if="!isCleaner">
          <div class="services-header">
            <h2 class="section-title">What we clean</h2>
            <p class="section-copy">
              Choose from our core home cleaning services — all with fixed, upfront pricing.
            </p>
          </div>
          <div class="service-grid">
            <article
              v-for="svc in customerServices"
              :key="svc.slug"
              class="service-card"
            >
              <span class="material-symbols-outlined service-card__icon">{{ svc.icon }}</span>
              <h3 class="service-card__title">{{ svc.title }}</h3>
              <p class="service-card__copy">{{ svc.description }}</p>
            </article>
          </div>
        </template>

        <!-- Cleaner: business overview -->
        <template v-else>
          <div class="services-header">
            <h2 class="section-title">Your Cleaning Business Overview</h2>
            <p class="section-copy">
              Manage jobs, availability, and earnings from one place.
            </p>
          </div>
          <div class="service-grid">
            <router-link
              v-for="tile in cleanerTiles"
              :key="tile.slug"
              :to="{ name: tile.route }"
              class="service-card"
            >
              <span class="material-symbols-outlined service-card__icon">{{ tile.icon }}</span>
              <h3 class="service-card__title">{{ tile.title }}</h3>
              <p class="service-card__copy">{{ tile.description }}</p>
              <span class="service-card__cta">
                {{ tile.cta }}
                <span class="material-symbols-outlined service-card__arrow">arrow_forward</span>
              </span>
            </router-link>
          </div>
        </template>

      </div>
    </section>

    <!-- ── How it works ───────────────────────────────────────────────────── -->
    <section class="how-section">
      <div class="how-inner">
        <h2 class="section-title">How it works</h2>
        <p class="section-copy">Book a professional clean in three simple steps.</p>

        <div class="steps-grid">
          <div class="step">
            <div class="step-number">1</div>
            <h3 class="step-title">Pick your service</h3>
            <p class="step-copy">
              Select the type of clean you need and tell us about your property.
            </p>
          </div>
          <div class="step">
            <div class="step-number">2</div>
            <h3 class="step-title">Choose your cleaner</h3>
            <p class="step-copy">
              Browse available cleaners near you, see their ratings, and pick the right fit.
            </p>
          </div>
          <div class="step">
            <div class="step-number">3</div>
            <h3 class="step-title">Sit back and relax</h3>
            <p class="step-copy">
              Your cleaner arrives on time. Pay securely online — no cash required.
            </p>
          </div>
        </div>
      </div>
    </section>

    <!-- ── Social proof ───────────────────────────────────────────────────── -->
    <section class="testimonial-section">
      <div class="testimonial-inner">
        <div class="stars">
          <span v-for="n in 5" :key="n" class="material-symbols-outlined star-icon">star</span>
        </div>
        <blockquote class="testimonial-quote">
          "The booking process was seamless and the cleaning was exceptional. Finally a service
          that values quality over quantity."
        </blockquote>
        <p class="testimonial-author">— Sarah J., London</p>
      </div>
    </section>

    <!-- ── Final CTA ──────────────────────────────────────────────────────── -->
    <section class="cta-panel">
      <div class="callout-panel">

        <!-- Guest: acquisition focus -->
        <template v-if="isGuest">
          <h2>Ready for a spotless home?</h2>
          <p>
            Book a trusted cleaner today. Fixed prices, flexible scheduling, and a 100%
            satisfaction guarantee on every clean.
          </p>
          <div class="callout-actions">
            <router-link :to="{ name: 'SignupCustomer' }" class="button-primary">
              Book Cleaner
            </router-link>
            <router-link :to="{ name: 'SignupCleaner' }" class="button-secondary">
              Join as a cleaner
            </router-link>
          </div>
        </template>

        <!-- Customer: drive bookings -->
        <template v-else-if="isCustomer">
          <h2>Ready for a spotless home?</h2>
          <p>
            Book a trusted cleaner today. Fixed prices, flexible scheduling, and a 100%
            satisfaction guarantee on every clean.
          </p>
          <div class="callout-actions">
            <router-link :to="{ name: 'BookCleaner' }" class="button-primary">
              Book Cleaner
            </router-link>
          </div>
        </template>

        <!-- Cleaner: drive dashboard usage -->
        <template v-else-if="isCleaner">
          <h2>Ready for your next job?</h2>
          <p>
            Manage your upcoming bookings, update your availability, and track your earnings
            — all from your dashboard.
          </p>
          <div class="callout-actions">
            <router-link :to="{ name: 'CleanerDashboard' }" class="button-primary">
              Go to dashboard
            </router-link>
          </div>
        </template>

        <!-- Admin -->
        <template v-else>
          <h2>Platform Overview</h2>
          <p>
            Manage bookings, cleaners, and platform settings from the admin dashboard.
          </p>
          <div class="callout-actions">
            <router-link :to="{ name: 'AdminDashboard' }" class="button-primary">
              Go to dashboard
            </router-link>
          </div>
        </template>

      </div>
    </section>

  </main>
</template>

<script setup lang="ts">
import { useRolePermissions } from '@/composables/useRolePermissions'

const { isGuest, isCustomer, isCleaner, dashboardRouteName } = useRolePermissions()

const customerServices = [
  {
    slug: 'standard-cleaning',
    icon: 'home',
    title: 'Standard Cleaning',
    description: 'Regular cleaning for homes that need a reliable maintenance clean.',
  },
  {
    slug: 'deep-cleaning',
    icon: 'cleaning_services',
    title: 'Deep Cleaning',
    description: 'A thorough top-to-bottom clean for homes that need extra attention.',
  },
  {
    slug: 'end-of-tenancy',
    icon: 'key',
    title: 'End of Tenancy',
    description: 'Move-out ready. Get your deposit back with a comprehensive tenancy clean.',
  },
  {
    slug: 'airbnb-turnover',
    icon: 'bed',
    title: 'Airbnb Turnover',
    description: 'Fast, reliable turnovers between guests — linen changes included.',
  },
]

const cleanerTiles = [
  {
    slug: 'jobs',
    icon: 'calendar_month',
    title: 'Upcoming Jobs',
    description: 'See upcoming bookings and today\'s schedule.',
    cta: 'View Bookings',
    route: 'CleanerBookings',
  },
  {
    slug: 'availability',
    icon: 'schedule',
    title: 'Availability',
    description: 'Manage your working days and times.',
    cta: 'Update Availability',
    route: 'CleanerAvailability',
  },
  {
    slug: 'earnings',
    icon: 'payments',
    title: 'Earnings',
    description: 'Track completed jobs and payouts.',
    cta: 'View Earnings',
    route: 'CleanerFinancials',
  },
  {
    slug: 'performance',
    icon: 'star_rate',
    title: 'Performance',
    description: 'Monitor ratings and completed jobs.',
    cta: 'View Dashboard',
    route: 'CleanerDashboard',
  },
]
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

main {
  min-height: 100vh;
  color: var(--on-background);
  background: var(--background);
  font-family: var(--font-body);
}

h1, h2, h3, p, blockquote {
  margin: 0;
}

/* ── Shared section layout ── */
.hero-section,
.trust-strip,
.services-section,
.how-section,
.testimonial-section,
.cta-panel {
  width: 100%;
}

.hero-inner,
.trust-inner,
.services-inner,
.how-inner,
.testimonial-inner {
  max-width: 80rem;
  margin: 0 auto;
  padding-right: 1.5rem;
  padding-left: 1.5rem;
}

/* ── Hero ── */
.hero-section {
  padding-top: 6rem;
  padding-bottom: 6rem;
  background: var(--background);
}

.hero-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.hero-title {
  max-width: 42rem;
  margin-bottom: 1.5rem;
  color: var(--primary);
  font-family: var(--font-h1);
  font-size: 36px;
  font-weight: 600;
  line-height: 1.15;
  letter-spacing: -0.02em;
}

.hero-copy {
  max-width: 34rem;
  margin-bottom: 2.5rem;
  color: var(--secondary);
  font-size: 1.125rem;
  font-weight: 400;
  line-height: 1.6;
}

.hero-actions,
.callout-actions {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.button-primary,
.button-secondary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 3rem;
  padding: 0.875rem 2rem;
  font-size: 14px;
  font-weight: 500;
  line-height: 1.4;
  letter-spacing: 0.01em;
  text-decoration: none;
  transition:
    background-color 200ms ease,
    opacity 200ms ease,
    transform 150ms ease,
    border-color 200ms ease;
}

.button-primary {
  color: var(--on-primary);
  background: var(--primary);
}

.button-primary:hover {
  opacity: 0.88;
}

.button-secondary {
  color: var(--primary);
  border: 1px solid var(--outline-variant);
}

.button-secondary:hover {
  background: var(--surface-container-low);
}

.button-primary:active,
.button-secondary:active {
  transform: scale(0.97);
}

/* ── Trust strip ── */
.trust-strip {
  background: var(--surface-container-lowest);
  border-top: 1px solid var(--outline-variant);
  border-bottom: 1px solid var(--outline-variant);
}

.trust-inner {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  padding-top: 2rem;
  padding-bottom: 2rem;
}

.trust-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  color: var(--primary);
}

.trust-icon {
  font-size: 1.375rem;
  flex-shrink: 0;
  color: var(--primary);
}

.trust-text {
  font-size: 14px;
  font-weight: 500;
  line-height: 1.4;
  color: var(--primary);
}

/* ── Shared section headings ── */
.section-title {
  font-size: 28px;
  font-weight: 600;
  line-height: 1.2;
  letter-spacing: -0.02em;
  color: var(--primary);
  margin-bottom: 0.75rem;
}

.section-copy {
  font-size: 1rem;
  font-weight: 400;
  line-height: 1.6;
  color: var(--secondary);
}

/* ── Service cards ── */
.services-section {
  padding-top: 5rem;
  padding-bottom: 5rem;
}

.services-header {
  margin-bottom: 2.5rem;
}

.service-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.25rem;
}

.service-card {
  display: flex;
  flex-direction: column;
  padding: 2rem;
  background: #ffffff;
  border: 1px solid var(--outline-variant);
  text-decoration: none;
  color: inherit;
  transition: border-color 200ms ease, box-shadow 200ms ease;
}

.service-card:hover {
  border-color: var(--primary);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06);
}

.service-card__icon {
  font-size: 2rem;
  color: var(--primary);
  margin-bottom: 1.25rem;
}

.service-card__title {
  font-size: 17px;
  font-weight: 600;
  line-height: 1.3;
  color: var(--primary);
  margin-bottom: 0.5rem;
}

.service-card__copy {
  font-size: 14px;
  font-weight: 400;
  line-height: 1.6;
  color: var(--secondary);
  flex: 1;
  margin-bottom: 1.5rem;
}

.service-card__cta {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 13px;
  font-weight: 500;
  color: var(--primary);
  letter-spacing: 0.01em;
}

.service-card__arrow {
  font-size: 1rem;
  transition: transform 200ms ease;
}

.service-card:hover .service-card__arrow {
  transform: translateX(3px);
}

/* ── How it works ── */
.how-section {
  padding-top: 5rem;
  padding-bottom: 5rem;
  background: var(--surface-container-lowest);
  border-top: 1px solid var(--outline-variant);
  border-bottom: 1px solid var(--outline-variant);
}

.how-inner .section-copy {
  margin-bottom: 3rem;
}

.steps-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 2.5rem;
}

.step {
  display: flex;
  flex-direction: column;
}

.step-number {
  width: 2.5rem;
  height: 2.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid var(--outline-variant);
  color: var(--secondary);
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 1.25rem;
  flex-shrink: 0;
}

.step-title {
  font-size: 17px;
  font-weight: 600;
  line-height: 1.3;
  color: var(--primary);
  margin-bottom: 0.5rem;
}

.step-copy {
  font-size: 14px;
  font-weight: 400;
  line-height: 1.6;
  color: var(--secondary);
}

/* ── Testimonial ── */
.testimonial-section {
  padding-top: 5rem;
  padding-bottom: 5rem;
}

.testimonial-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  max-width: 42rem;
}

.stars {
  display: flex;
  gap: 0.25rem;
  margin-bottom: 1.5rem;
  color: var(--primary);
}

.star-icon {
  font-size: 1.25rem;
  font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24;
}

.testimonial-quote {
  font-size: 1.125rem;
  font-style: italic;
  line-height: 1.65;
  color: var(--primary);
  margin-bottom: 1.25rem;
}

.testimonial-author {
  font-size: 14px;
  font-weight: 500;
  color: var(--secondary);
  letter-spacing: 0.01em;
}

/* ── CTA panel ── */
.cta-panel {
  padding-top: 0;
  padding-bottom: 5rem;
}

.callout-panel {
  max-width: 80rem;
  margin: 0 auto;
  padding: 4rem 1.5rem;
  color: var(--on-primary);
  text-align: center;
  background: var(--primary);
}

.callout-panel h2 {
  font-size: 28px;
  font-weight: 600;
  line-height: 1.2;
  letter-spacing: -0.02em;
  color: var(--on-primary);
  margin-bottom: 1.25rem;
}

.callout-panel > p,
.callout-panel template > p {
  max-width: 34rem;
  margin: 0 auto 2.5rem;
  color: rgba(255, 255, 255, 0.8);
  font-size: 1rem;
  line-height: 1.6;
}

.callout-panel .button-primary {
  color: var(--primary);
  background: #ffffff;
}

.callout-panel .button-primary:hover {
  background: var(--surface-variant);
  opacity: 1;
}

.callout-panel .button-secondary {
  color: #ffffff;
  border-color: rgba(255, 255, 255, 0.5);
}

.callout-panel .button-secondary:hover {
  background: rgba(255, 255, 255, 0.1);
}

/* ── Responsive ── */
@media (min-width: 640px) {
  .hero-actions,
  .callout-actions {
    flex-direction: row;
    justify-content: center;
  }
}

@media (min-width: 768px) {
  .hero-section {
    padding-top: 10rem;
    padding-bottom: 10rem;
  }

  .hero-title {
    font-size: 52px;
  }

  .trust-inner {
    flex-direction: row;
    justify-content: center;
    gap: 3rem;
  }

  .service-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .steps-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 2rem;
  }
}

@media (min-width: 1024px) {
  .hero-inner,
  .trust-inner,
  .services-inner,
  .how-inner,
  .testimonial-inner {
    padding-right: 3rem;
    padding-left: 3rem;
  }

  .callout-panel {
    padding-right: 3rem;
    padding-left: 3rem;
  }

  .service-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}
</style>
