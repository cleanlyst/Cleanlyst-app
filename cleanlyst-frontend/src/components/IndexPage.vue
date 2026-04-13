<template>
  <main class="landingPage">
    <section class="heroSection">
      <div class="heroCopy">
        <p class="eyebrow">Trusted home cleaning for busy schedules</p>
        <h1>Book vetted cleaners in minutes, not after ten tabs and three phone calls.</h1>
        <p class="heroText">
          Cleanlyst helps customers find reliable cleaners and gives professionals a calmer way to
          manage bookings, availability, and repeat work.
        </p>

        <div class="ctaRow">
          <button class="primaryCta" type="button" @click="handleBookCleaner">
            Book a cleaner
          </button>
          <router-link :to="{ name: 'Auth' }" class="secondaryCta">
            Sign in or create an account
          </router-link>
        </div>

        <p class="microCopy">
          Guests can browse from here. Booking will ask for sign in first.
        </p>
      </div>

      <div class="heroCard">
        <p class="cardLabel">This week on Cleanlyst</p>
        <div class="statGrid">
          <article>
            <strong>24h</strong>
            <span>Typical turnaround for first booking request</span>
          </article>
          <article>
            <strong>Rated</strong>
            <span>Cleaner profiles built around trust, not just price</span>
          </article>
          <article>
            <strong>Simple</strong>
            <span>Clear snapshots of service, address, notes, and timing</span>
          </article>
        </div>
      </div>
    </section>

    <section class="featureSection">
      <article class="featureCard">
        <h2>For customers</h2>
        <p>Browse services, choose a time, and send a booking request without messy back-and-forth.</p>
      </article>
      <article class="featureCard">
        <h2>For cleaners</h2>
        <p>See incoming work in one dashboard and accept jobs with a single action.</p>
      </article>
      <article class="featureCard">
        <h2>For repeat use</h2>
        <p>Keep your profile, location, and service history ready for the next booking.</p>
      </article>
    </section>
  </main>
</template>

<script lang="ts" setup>
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()

async function handleBookCleaner() {
  if (!auth.isAuthenticated) {
    await router.push({ name: 'Auth', query: { redirect: '/book' } })
    return
  }

  if (auth.hasRole('cleaner')) {
    await router.push({ name: 'CleanerDashboard' })
    return
  }

  await router.push({ name: 'BookCleaner' })
}
</script>

<style scoped>
.landingPage {
  min-height: calc(100vh - 82px);
  padding: 3rem 1rem 4rem;
  background:
    radial-gradient(circle at top left, rgba(231, 119, 86, 0.24), transparent 30%),
    radial-gradient(circle at bottom right, rgba(33, 77, 116, 0.18), transparent 32%),
    linear-gradient(180deg, #f7f3eb 0%, #f2ecdf 100%);
  color: #13223b;
}

.heroSection {
  width: min(1120px, 100%);
  margin: 0 auto;
  display: grid;
  grid-template-columns: 1.3fr 0.9fr;
  gap: 2rem;
  align-items: stretch;
}

.heroCopy,
.heroCard,
.featureCard {
  border-radius: 28px;
  border: 1px solid rgba(19, 34, 59, 0.08);
  box-shadow: 0 22px 60px rgba(19, 34, 59, 0.08);
}

.heroCopy {
  padding: 3rem;
  background: rgba(255, 252, 246, 0.88);
}

.eyebrow {
  margin: 0 0 1rem;
  font-size: 0.82rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #cf5d34;
}

h1 {
  margin: 0;
  font-size: clamp(2.5rem, 6vw, 4.8rem);
  line-height: 0.95;
}

.heroText {
  max-width: 38rem;
  margin: 1.4rem 0 0;
  font-size: 1.08rem;
  line-height: 1.7;
  color: #41506a;
}

.ctaRow {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  margin-top: 2rem;
}

.primaryCta,
.secondaryCta {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 52px;
  padding: 0 1.25rem;
  border-radius: 999px;
  font-weight: 700;
}

.primaryCta {
  border: 0;
  background: #10233d;
  color: #f8f4ed;
  cursor: pointer;
}

.secondaryCta {
  border: 1px solid rgba(16, 35, 61, 0.15);
  color: #10233d;
  background: rgba(255, 255, 255, 0.68);
}

.microCopy {
  margin: 1rem 0 0;
  color: #637188;
}

.heroCard {
  padding: 2rem;
  background: linear-gradient(180deg, #10233d 0%, #1b3558 100%);
  color: #f8f4ed;
}

.cardLabel {
  margin: 0 0 1.5rem;
  font-size: 0.88rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: rgba(248, 244, 237, 0.72);
}

.statGrid {
  display: grid;
  gap: 1rem;
}

.statGrid article {
  padding: 1.2rem;
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.08);
}

.statGrid strong {
  display: block;
  font-size: 1.6rem;
  margin-bottom: 0.45rem;
}

.statGrid span {
  line-height: 1.6;
  color: rgba(248, 244, 237, 0.82);
}

.featureSection {
  width: min(1120px, 100%);
  margin: 2rem auto 0;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1rem;
}

.featureCard {
  padding: 1.5rem;
  background: rgba(255, 255, 255, 0.82);
}

.featureCard h2 {
  margin: 0 0 0.75rem;
  font-size: 1.2rem;
}

.featureCard p {
  margin: 0;
  line-height: 1.7;
  color: #4f5c73;
}

@media (max-width: 900px) {
  .heroSection,
  .featureSection {
    grid-template-columns: 1fr;
  }

  .heroCopy {
    padding: 2rem;
  }
}
</style>
