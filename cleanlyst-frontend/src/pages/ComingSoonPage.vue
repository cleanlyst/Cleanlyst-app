<template>
  <main class="coming-soon-page">
    <!-- Hero Section -->
    <section class="coming-soon-hero">
      <!-- Visual Placeholder for Market Vibe -->
      <div class="coming-soon-visual">
        <img class="coming-soon-visual__image" :src="comingsoon" alt="coming-soon" />
      </div>
      <!-- Content -->
      <div class="coming-soon-content">
        <h1>Trusted local cleaners, booked with confidence.</h1>
        <p>
          Cleanlyst is launching soon in your area! A simple way to book vetted, reliable cleaners
          in your area.
        </p>
      </div>
      <!-- Signup Form -->
      <div class="coming-soon-signup">
        <form class="coming-soon-form" @submit.prevent="onSubmit">
          <div class="coming-soon-form__row">
            <div class="coming-soon-form__field">
              <label class="coming-soon-form__label" for="email">Email address</label>
              <input
                id="email"
                v-model.trim="email"
                class="coming-soon-form__input"
                name="email"
                autocomplete="email"
                placeholder="Enter your email address"
                type="email"
                required
              />
            </div>
            <button
              class="coming-soon-form__button"
              type="submit"
              :disabled="submitting"
              :aria-busy="submitting"
            >
              {{ submitting ? 'Sending…' : 'Notify Me' }}
            </button>
          </div>
          <div class="coming-soon-form__consent">
            <input id="waitlist-consent" v-model="consent" type="checkbox" name="consent" />
            <label for="waitlist-consent">
              I agree to be emailed once when Cleanlyst goes live in the UK. I have read the
              <router-link class="coming-soon-form__consent-link" :to="WAITLIST_PRIVACY_POLICY_URL">
                Privacy Policy
              </router-link>
              (version {{ WAITLIST_PRIVACY_VERSION }}).
            </label>
          </div>
          <p v-if="feedback" class="coming-soon-form__feedback" role="status">{{ feedback }}</p>
        </form>
        <p class="coming-soon-form__note">
          Notify me when Cleanlyst launches in my area. No spam, we promise.
        </p>
      </div>
    </section>

    <!-- Bento Highlights (Subtle Info) -->
    <section class="coming-soon-highlights">
      <div class="coming-soon-highlight">
        <span
          class="material-symbols-outlined coming-soon-highlight__icon"
          data-icon="verified_user"
          >verified_user</span
        >
        <h3>Vetted Professionals</h3>
        <p>
          Every cleaner on Cleanlyst goes through a verification process before joining. Identity
          checks, background screening, and insurance help ensure you book with confidence.
        </p>
      </div>
      <div class="coming-soon-highlight">
        <span class="material-symbols-outlined coming-soon-highlight__icon" data-icon="schedule"
          >schedule</span
        >
        <h3>Smart Booking</h3>
        <p>
          Find cleaners based on your location, availability and needs. Bookings are simple,
          flexible, and designed to fit around your schedule.
        </p>
      </div>
      <div class="coming-soon-highlight">
        <span class="material-symbols-outlined coming-soon-highlight__icon" data-icon="payments"
          >payments</span
        >
        <h3>Transparent Pricing</h3>
        <p>
          Know the cost before you book. Clear service pricing means no surprises when your cleaner
          arrives.
        </p>
      </div>
    </section>
  </main>
</template>
<script lang="ts" setup>
import { ref } from 'vue'
import { useRoute } from 'vue-router'
import comingsoon from '@/assets/comingsoon.png'
import { hasSupabaseConfig, requireSupabase } from '@/lib/supabase'
import { WAITLIST_PRIVACY_POLICY_URL, WAITLIST_PRIVACY_VERSION } from '@/constants/waitlist'

const route = useRoute()
const email = ref('')
const consent = ref(false)
const submitting = ref(false)
const feedback = ref('')

type WaitlistInterest = 'customer' | 'cleaner' | 'unknown'

function interestFromRoute(): WaitlistInterest {
  const raw = typeof route.query.intent === 'string' ? route.query.intent : ''
  if (raw === 'customer' || raw === 'cleaner') return raw
  return 'unknown'
}

async function onSubmit() {
  feedback.value = ''

  if (!hasSupabaseConfig) {
    feedback.value = 'Waitlist sign-up is temporarily unavailable. Please try again later.'
    return
  }

  if (!consent.value) {
    feedback.value = 'Please tick the box to confirm you want a one-off launch email.'
    return
  }

  submitting.value = true
  try {
    const supabase = requireSupabase()
    const { data, error } = await supabase.rpc('submit_waitlist_signup', {
      p_email: email.value,
      p_interest: interestFromRoute(),
      p_consent: true,
      p_privacy_version: WAITLIST_PRIVACY_VERSION,
      p_source_path: route.fullPath,
    })

    if (error) throw error

    const row = Array.isArray(data) ? data[0] : data
    const status = row && typeof row === 'object' && 'status' in row ? String(row.status) : ''

    if (status === 'created') {
      feedback.value = 'Thanks — we will email you when we go live.'
      email.value = ''
      consent.value = false
    } else if (status === 'duplicate') {
      feedback.value = 'You are already on the list.'
    } else {
      feedback.value = 'Please check your email address and try again.'
    }
  } catch {
    feedback.value = 'Something went wrong. Please try again later.'
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.coming-soon-page {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 4rem 1.5rem 0;
  color: var(--on-surface);
  background: var(--background);
  font-family: var(--font-body);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

.coming-soon-hero {
  width: 100%;
  max-width: 48rem;
  padding: 6rem 0;
  text-align: center;
}

.coming-soon-visual {
  position: relative;
  width: 100%;
  aspect-ratio: 21 / 9;
  margin-bottom: 4rem;
  overflow: hidden;
  background: var(--surface-container);
  border: 1px solid var(--outline-variant);
  border-radius: var(--radius);
}

.coming-soon-visual__image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: grayscale(1);
  opacity: 0.2;
}

.coming-soon-visual__icon-wrap {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.coming-soon-visual__icon {
  color: #d4d4d8;
  font-size: 3.75rem;
}

.coming-soon-content {
  display: grid;
  gap: 1.5rem;
}

.coming-soon-content h1 {
  margin: 0;
  color: var(--primary);
  font-family: var(--font-h1);
  font-size: 32px;
  font-weight: 600;
  line-height: 1.2;
  letter-spacing: -0.02em !important;
}

.coming-soon-content p {
  max-width: 36rem;
  margin: 0 auto;
  color: var(--secondary);
  font-family: var(--font-body);
  font-size: 16px;
  font-weight: 400;
  line-height: 1.6;
}

.coming-soon-signup {
  max-width: 28rem;
  padding-top: 2rem;
  margin: 0 auto;
}

.coming-soon-form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.coming-soon-form__row {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.coming-soon-form__field {
  flex-grow: 1;
}

.coming-soon-form__label {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.coming-soon-form__input {
  width: 100%;
  padding: 0.75rem 1rem;
  color: var(--on-surface);
  background: #ffffff;
  border: 1px solid var(--outline-variant);
  border-radius: 0;
  font-family: var(--font-body);
  font-size: 16px;
  font-weight: 400;
  line-height: 1.6;
  transition: border-color 150ms ease;
}

.coming-soon-form__input::placeholder {
  color: var(--outline);
}

.coming-soon-form__input:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: none;
}

.coming-soon-form__button {
  padding: 0.75rem 2rem;
  color: var(--on-primary);
  white-space: nowrap;
  background: var(--primary);
  border-radius: 0;
  font-family: var(--font-label-md);
  font-size: 14px;
  font-weight: 500;
  line-height: 1.4;
  letter-spacing: 0.01em !important;
  transition:
    opacity 150ms ease,
    transform 150ms ease;
}

.coming-soon-form__button:hover {
  opacity: 0.9;
}

.coming-soon-form__button:active {
  transform: scale(0.95);
}

.coming-soon-form__button:disabled {
  cursor: not-allowed;
  opacity: 0.7;
}

.coming-soon-form__consent {
  display: flex;
  gap: 0.5rem;
  align-items: flex-start;
  max-width: 28rem;
  margin: 0 auto;
  text-align: left;
  color: var(--secondary);
  font-family: var(--font-body);
  font-size: 13px;
  font-weight: 400;
  line-height: 1.5;
}

.coming-soon-form__consent input {
  flex-shrink: 0;
  margin-top: 0.2rem;
}

.coming-soon-form__consent-link {
  color: var(--primary);
  text-decoration: underline;
  text-underline-offset: 2px;
}

.coming-soon-form__feedback {
  margin: 0;
  color: var(--primary);
  font-family: var(--font-body);
  font-size: 14px;
  font-weight: 500;
  line-height: 1.5;
}

.coming-soon-form__note {
  margin: 1rem 0 0;
  color: var(--outline);
  font-family: var(--font-caption);
  font-size: 12px;
  font-weight: 400;
  line-height: 1.4;
}

.coming-soon-highlights {
  display: grid;
  grid-template-columns: 1fr;
  width: 100%;
  max-width: 80rem;
  gap: var(--gutter);
  padding: 4rem 0;
}

.coming-soon-highlight {
  padding: 2rem;
  background: var(--surface-container-lowest);
  border: 1px solid var(--outline-variant);
}

.coming-soon-highlight__icon {
  margin-bottom: 1rem;
  color: var(--primary);
  font-size: 1.5rem;
}

.coming-soon-highlight h3 {
  margin: 0 0 0.5rem;
  color: var(--primary);
  font-family: var(--font-h2);
  font-size: 1.125rem;
  font-weight: 600;
  line-height: 1.3;
  letter-spacing: -0.01em !important;
}

.coming-soon-highlight p {
  margin: 0;
  color: var(--secondary);
  font-family: var(--font-body);
  font-size: 0.875rem;
  font-weight: 400;
  line-height: 1.6;
}

@media (min-width: 640px) {
  .coming-soon-form__row {
    flex-direction: row;
    align-items: stretch;
  }

  .coming-soon-form__field {
    flex: 1;
  }
}

@media (min-width: 768px) {
  .coming-soon-highlights {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
</style>
