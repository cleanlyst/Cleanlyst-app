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
        <form class="coming-soon-form">
          <div class="coming-soon-form__field">
            <label class="coming-soon-form__label" for="email">Email address</label>
            <input
              class="coming-soon-form__input"
              id="email"
              name="email"
              placeholder="Enter your email address"
              type="email"
            />
          </div>
          <button class="coming-soon-form__button" type="submit">Notify Me</button>
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
          Know the cost before you book. Clear hourly rates and upfront pricing mean no surprises
          when your cleaner arrives.
        </p>
      </div>
    </section>
  </main>
</template>
<script lang="ts" setup>
import comingsoon from '@/assets/comingsoon.png'
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
  .coming-soon-form {
    flex-direction: row;
  }
}

@media (min-width: 768px) {
  .coming-soon-highlights {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
</style>
