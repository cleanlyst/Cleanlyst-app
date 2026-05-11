<template>
  <main class="pt-32 pb-24 px-6 max-w-7xl mx-auto">
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-12">
      <!-- Left Column: Booking Form -->
      <div class="lg:col-span-7 space-y-12">
        <section>
          <h1 class="font-h1 text-h1 text-primary mb-4">Request Your Booking</h1>
          <p class="font-body text-body text-secondary max-w-lg">
            Complete the details below to finalize your request. Your cleaner will review and
            confirm within 24 hours.
          </p>
        </section>

        <!-- Address Confirmation Section -->
        <section class="space-y-6">
          <div class="flex items-center justify-between">
            <h2 class="font-h2 text-h2 text-primary">Service Address</h2>
            <button class="text-label-md font-label-md text-primary underline">Edit</button>
          </div>
          <div class="p-6 bg-white border border-outline-variant rounded-lg flex items-start gap-4">
            <span class="material-symbols-outlined text-secondary mt-1">location_on</span>
            <div class="space-y-1">
              <p class="font-label-md text-label-md text-primary">Primary Residence</p>
              <p class="font-body text-body text-secondary">
                1248 Minimalist Way, Apt 4B<br />San Francisco, CA 94103
              </p>
            </div>
          </div>
          <div
            class="h-48 w-full rounded-lg overflow-hidden bg-surface-container grayscale border border-outline-variant"
          >
            <img
              class="w-full h-full object-cover opacity-80"
              alt="Map of San Francisco"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuDC9E-RiA4Moyx1tYsCz9aKqqDURh8NfJG06yHoz5tY-qKRLSnsZLPgiMtt8MQieZeGnitv8AcuFMvOIKALTZdKhWaI-VVUF6TMt3IoUKWzn8bmlki9J4cYn9rZAQLfDRj9byGVM4ZrYFQLkbgjD2-h5yq2WgpD642SCyzgDwmY5uGSX-GAdYejj1pLmLlvMo4Furi3Hzyw2p1lzmvCuRwin3EovRVrPYbB_kexA-GGrNSCbciQT2CwY-xIfl1F3o76hK0VwzySFw"
            />
          </div>
        </section>

        <!-- Notes to Cleaner Section -->
        <section class="space-y-4">
          <label class="block font-label-md text-label-md text-primary" for="notes"
            >Notes to Cleaner (Optional)</label
          >
          <textarea
            id="notes"
            class="w-full p-4 border border-outline-variant rounded-lg focus:ring-0 focus:border-primary font-body text-body bg-white placeholder:text-outline"
            placeholder="e.g. 'Key is under the mat', 'Focus on the kitchen cabinets', 'Please mind the dog'"
            rows="5"
          ></textarea>
          <p class="text-caption font-caption text-secondary">
            Specific instructions help your cleaner provide the best service.
          </p>
        </section>

        <!-- Action Mobile (Hidden on Desktop) -->
        <div class="lg:hidden space-y-4 pt-8">
          <button
            class="w-full py-4 bg-primary text-white font-label-md text-label-md rounded-lg active:scale-[0.98] transition-transform"
            @click="submitBooking"
          >
            Submit Booking Request
          </button>
          <p class="text-center text-caption font-caption text-secondary">
            You won't be charged until the cleaner confirms.
          </p>
        </div>
      </div>

      <!-- Right Column: Summary Sticky -->
      <aside class="lg:col-span-5">
        <div class="sticky top-24 space-y-8">
          <div class="bg-white border border-outline-variant rounded-lg p-8 space-y-8">
            <h2 class="font-h2 text-h2 text-primary">Service Summary</h2>
            <div class="flex items-center gap-4">
              <div
                class="h-16 w-16 rounded-full overflow-hidden bg-surface-container border border-outline-variant"
              >
                <img class="w-full h-full object-cover" :src="cleaner.photo" :alt="cleaner.name" />
              </div>
              <div>
                <p class="font-label-md text-label-md text-primary">{{ cleaner.name }}</p>
                <div class="flex items-center gap-1 text-primary">
                  <span class="material-symbols-outlined text-[16px] star-filled">star</span>
                  <span class="text-caption font-caption"
                    >{{ cleaner.rating }} ({{ cleaner.reviewCount }} reviews)</span
                  >
                </div>
              </div>
            </div>
            <div class="space-y-4 pt-4 border-t border-surface-variant">
              <div class="flex justify-between items-center">
                <div class="flex items-center gap-3">
                  <span class="material-symbols-outlined text-secondary">calendar_today</span>
                  <span class="font-body text-body text-secondary">Thursday, Oct 24</span>
                </div>
                <span class="font-label-md text-label-md text-primary">09:00 AM</span>
              </div>
              <div class="flex justify-between items-center">
                <div class="flex items-center gap-3">
                  <span class="material-symbols-outlined text-secondary">schedule</span>
                  <span class="font-body text-body text-secondary">Duration</span>
                </div>
                <span class="font-label-md text-label-md text-primary">4 Hours</span>
              </div>
              <div class="flex justify-between items-center">
                <div class="flex items-center gap-3">
                  <span class="material-symbols-outlined text-secondary">cleaning_services</span>
                  <span class="font-body text-body text-secondary">Standard Clean</span>
                </div>
                <span class="font-label-md text-label-md text-primary"
                  >${{ basePrice.toFixed(2) }}</span
                >
              </div>
            </div>
            <div class="pt-6 space-y-4 border-t border-surface-variant">
              <div class="flex justify-between items-center">
                <span class="font-body text-body text-secondary">Service Fee</span>
                <span class="font-body text-body text-primary">${{ serviceFee.toFixed(2) }}</span>
              </div>
              <div class="flex justify-between items-center">
                <span class="font-h2 text-h2 text-primary">Total</span>
                <span class="font-h2 text-h2 text-primary">${{ total.toFixed(2) }}</span>
              </div>
            </div>
            <button
              class="hidden lg:block w-full py-4 bg-primary text-white font-label-md text-label-md rounded-lg active:scale-[0.98] transition-transform"
              @click="submitBooking"
            >
              Submit Booking Request
            </button>
            <p class="hidden lg:block text-center text-caption font-caption text-secondary">
              You won't be charged until the cleaner confirms.
            </p>
          </div>
          <div
            class="bg-surface-container-low p-6 rounded-lg border border-outline-variant flex items-start gap-4"
          >
            <span class="material-symbols-outlined text-primary">shield</span>
            <div>
              <p class="font-label-md text-label-md text-primary">Cleanlyst Guarantee</p>
              <p class="text-caption font-caption text-secondary">
                Your payment is held securely and only released 24 hours after the service is
                completed.
              </p>
            </div>
          </div>
        </div>
      </aside>
    </div>
  </main>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import cleanerData from '@/data/cleanerData.json'

const route = useRoute()
const router = useRouter()

const cleaner = computed(() => {
  const id = route.query.cleanerId as string
  return cleanerData.cleanersData.find((c) => c.id === id) ?? cleanerData.cleanersData[0]!
})

const basePrice = computed(() => (cleaner.value?.hourlyRate ?? 0) * 4)
const serviceFee = computed(() => Math.round(basePrice.value * 0.07 * 100) / 100)
const total = computed(() => Math.round((basePrice.value + serviceFee.value) * 100) / 100)

function submitBooking() {
  router.push({ name: 'ConfirmBooking', query: { cleanerId: cleaner.value?.id } })
}
</script>

<style scoped>
.material-symbols-outlined {
  font-variation-settings:
    'FILL' 0,
    'wght' 400,
    'GRAD' 0,
    'opsz' 24;
  vertical-align: middle;
}

.star-filled {
  font-variation-settings:
    'FILL' 1,
    'wght' 400,
    'GRAD' 0,
    'opsz' 24;
}
</style>
