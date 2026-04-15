<template>
  <main class="landingPage">
    <section class="booking- container">
      <div class="row">
        <div class="col-lg-5">
          <div class="landing-page-booking-form">
            <h2 class="h5">Book Trusted Cleaners in Minutes</h2>
            <p>
              Cleanlyst helps you find cleaners in minutes and not after ten tabs and three phone
              calls.
            </p>

            <form class="bookingForm" @submit.prevent="handleBookCleaner">
              <label class="formField">
                <span>Enter your location</span>
                <input
                  v-model.trim="location"
                  type="text"
                  placeholder="Enter your address"
                  class="addressInput"
                  required
                />
              </label>

              <label class="formField">
                <span>Select your service</span>
                <select v-model="selectedService" class="serviceSelect" required>
                  <option disabled value="">Choose a main service</option>
                  <option v-for="service in mainServices" :key="service" :value="service">
                    {{ service }}
                  </option>
                </select>
              </label>

              <button class="blueButton bookingButton" type="submit">Book a cleaner</button>
            </form>
          </div>
        </div>
        <div class="col-lg-7 hide-mobile">
          <div class="landing-image-box">
            <img src="../assets/landingpage.png" alt="" class="landing-image" />
          </div>
        </div>
      </div>
    </section>

    <HowItWorksSection />
    <OurServicesSection />
    <BecomeProfessionalSection />
  </main>
</template>

<script lang="ts" setup>
import BecomeProfessionalSection from '@/components/BecomeProfessionalSection.vue'
import { ref } from 'vue'
import HowItWorksSection from '@/components/HowItWorksSection.vue'
import OurServicesSection from '@/components/OurServicesSection.vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

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

  if (auth.hasRole('cleaner')) {
    await router.push({ name: 'CleanerDashboard' })
    return
  }

  await router.push(bookingPath)
}
</script>

<style scoped>
section.booking-.container {
  padding: 3rem 30px;
  background: var(--lightBlue);
}

.landing-image-box {
  width: 100%;
  height: 400px;
}

.landing-page-booking-form {
  width: 100%;
  min-height: 400px;
  padding: 1.5rem;
  border-radius: 28px;
  background: var(--white);
  border: 1px solid rgba(19, 34, 59, 0.08);
  box-shadow: 0 22px 60px rgba(19, 34, 59, 0.08);
}

.bookingForm {
  display: grid;
  gap: 0.85rem;
  margin-top: 1.25rem;
}

.formField {
  display: grid;
  gap: 0.45rem;
}

.formField span {
  font-weight: 700;
  color: #20314d;
}

.addressInput,
.serviceSelect {
  width: 100%;
  min-height: 52px;
  padding: 0.9rem 1rem;
  border: 1px solid rgba(19, 34, 59, 0.14);
  border-radius: 18px;
  background: var(--white);
  color: #13223b;
}

.bookingButton {
  justify-self: start;
  margin-top: 0.25rem;
}

img.landing-image {
  object-fit: cover;
  width: 100%;
  height: 100%;
  border-radius: 28px;
}

@media (max-width: 720px) {
  section.booking-.container {
    padding: 10px;
  }

  .col-lg-4,
  .col-lg-8 {
    display: block;
  }

  .landing-page-booking-form {
    min-height: auto;
    margin-bottom: 2rem;
  }

  .landing-image-box {
    height: auto;
  }
}
</style>
