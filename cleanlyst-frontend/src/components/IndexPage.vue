<template>
  <main class="landingPage">
    <section class="booking-container" :style="{ backgroundImage: `url(${landingImage})` }">
      <div class="landing-page-booking-form">
        <h2 class="h4">Book Trusted <span class="green-text">Cleaners</span> in Minutes</h2>
        <p>
          Cleanlyst helps you find cleaners in minutes and not after ten tabs and three phone calls.
        </p>

        <form class="bookingForm" @submit.prevent="handleBookCleaner">
          <label class="formField">
            <span class="visually-hidden">Service type</span>
            <select
              v-model="selectedService"
              class="serviceSelect"
              required
              aria-label="Select a service type"
            >
              <option disabled value="">Choose a main service</option>
              <option v-for="service in mainServices" :key="service" :value="service">
                {{ service }}
              </option>
            </select>
          </label>

          <div class="landing-page-CTA">
            <button class="blueButton bookingButton" type="submit">Book a cleaner</button>

            <router-link
              v-if="!auth.isAuthenticated"
              :to="{ name: 'Login' }"
              class="pointer text-underline"
              >Log in</router-link
            >
          </div>
        </form>
      </div>
    </section>

    <OurServicesSection />
    <BecomeProfessionalSection />
  </main>
</template>

<script lang="ts" setup>
import BecomeProfessionalSection from '@/components/BecomeProfessionalSection.vue'
import { ref } from 'vue'
import OurServicesSection from '@/components/OurServicesSection.vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import landingImage from '@/assets/landingBG.jpg'

const router = useRouter()
const auth = useAuthStore()

const location = ref('')
const selectedService = ref('')

const mainServices = [
  'Home Cleaning',
  'Commercial & Office Cleaning',
  'Windows & Glass',
  'Vehicle & Mobility Cleaning',
  'Specialist Interior Cleaning',
  'Exterior & Outdoor Cleaning',
  'Bin & Waste Cleaning',
  'Specialist & High-Level Services',
  'Personal Item Cleaning',
]

async function handleBookCleaner() {
  if (!location.value || !selectedService.value) {
    return
  }

  const bookingPath = {
    path: '/book',
    query: {
      location: location.value,
      service: selectedService.value,
    },
  }

  if (!auth.isAuthenticated) {
    await router.push({
      name: 'Auth',
      query: {
        redirect: router.resolve(bookingPath).href,
      },
    })
    return
  }

  if (auth.hasRole('cleaner_pending') || auth.hasRole('cleaner_active')) {
    await router.push({ name: 'CleanerDashboard' })
    return
  }

  await router.push(bookingPath)
}
</script>

<style scoped>
section.booking-container {
  position: relative;
  width: 100%;
  min-height: 80vh;
  overflow: hidden;
  display: flex;
  background-repeat: no-repeat;
  background-size: cover;
  background-position: center center;
  padding: 25px 0;
}

section.booking-container::before {
  content: '';
  position: absolute;
  inset: 0;
  background: rgba(255, 255, 255, 0.18);

  z-index: 1;
}

.landing-page-booking-form {
  position: relative;
  z-index: 2;
  padding: 2rem 2.5rem;
  margin-left: 17px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.landing-image-box {
  width: 100%;
  height: 420px;
}

.bookingForm {
  display: flex;
  flex-direction: row;
  margin-top: 1.25rem;
}

.formField {
  margin-right: 13px;
}

.landing-page-CTA {
  display: flex;
  flex-direction: row;
  align-items: center;
}

.bookingButton {
  margin-right: 10px;
}

img.landing-image {
  object-fit: cover;
  width: 100%;
  height: 100%;
  border-radius: 28px;
}
@media (min-width: 769px) {
  section.booking-container {
    padding: 10px 0;
  }
}
@media (max-width: 768px) {
  section.booking-container {
    padding: 10px;
  }

  .bookingForm[data-v-c3327e39] {
    display: flex;
    flex-direction: column;
    margin-top: 1rem;
    width: 100%;
  }

  .landing-page-CTA[data-v-c3327e39] {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;
    margin: 10px 0;
  }
  .landing-page-booking-form {
    min-height: auto;
    margin-bottom: 2rem;
    padding: 0.5rem;
  }
}
</style>
