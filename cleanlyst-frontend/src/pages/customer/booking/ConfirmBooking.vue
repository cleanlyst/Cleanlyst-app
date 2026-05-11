<template>
  <main class="pt-24 pb-20 max-w-7xl mx-auto px-6 lg:px-12">
    <!-- Header Section: Back button and Breadcrumb -->
    <div class="mb-12">
      <button class="flex items-center gap-2 text-on-surface-variant hover:text-on-surface transition-colors mb-4 group" @click="goBack">
        <span class="material-symbols-outlined text-[20px]">arrow_back</span>
        <span class="font-label-md text-label-md">Back to Bookings</span>
      </button>
      <div class="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 class="font-h1 text-h1 mb-2">Deep Home Cleaning Service</h1>
          <p class="font-body text-body text-on-surface-variant">Booking ID: #CLN-882910</p>
        </div>
        <div class="flex items-center gap-3">
          <span class="px-3 py-1 bg-surface-container-highest text-[10px] font-bold tracking-widest uppercase rounded-sm border border-outline-variant">CONFIRMED</span>
        </div>
      </div>
    </div>

    <!-- Bento Grid Layout for Booking Details -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      <!-- Main Content Area: Messaging & Details -->
      <div class="lg:col-span-8 space-y-8">
        <!-- Service Summary Card -->
        <section class="bg-surface-container-lowest border border-outline-variant p-padding-card">
          <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <p class="font-label-md text-label-md text-on-surface-variant mb-1 uppercase tracking-wider text-[10px]">Date &amp; Time</p>
              <p class="font-body text-body font-semibold">Oct 24, 2024</p>
              <p class="font-body text-body">09:00 AM - 02:00 PM</p>
            </div>
            <div>
              <p class="font-label-md text-label-md text-on-surface-variant mb-1 uppercase tracking-wider text-[10px]">Location</p>
              <p class="font-body text-body">122 Willow Creek Way,</p>
              <p class="font-body text-body">Austin, TX 78701</p>
            </div>
            <div>
              <p class="font-label-md text-label-md text-on-surface-variant mb-1 uppercase tracking-wider text-[10px]">Service Provider</p>
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 bg-surface-container rounded-full overflow-hidden">
                  <img
                    class="w-full h-full object-cover"
                    :src="cleaner.photo"
                    :alt="cleaner.name"
                  />
                </div>
                <p class="font-body text-body font-semibold">{{ cleaner.name }}</p>
              </div>
            </div>
          </div>
        </section>

        <!-- Messaging Interface -->
        <section class="bg-surface-container-lowest border border-outline-variant flex flex-col h-[500px]">
          <div class="p-4 border-b border-outline-variant flex justify-between items-center bg-surface-container-low">
            <h2 class="font-label-md text-label-md">Messages</h2>
            <span class="text-caption text-caption text-on-surface-variant italic">Usually responds in 1 hour</span>
          </div>
          <div class="flex-1 overflow-y-auto p-6 space-y-6">
            <!-- Message Received -->
            <div class="flex gap-4 max-w-[85%]">
              <div class="w-8 h-8 flex-shrink-0 bg-surface-container rounded-full overflow-hidden mt-1">
                <img class="w-full h-full object-cover" :src="cleaner.photo" :alt="cleaner.name" />
              </div>
              <div class="bg-surface-variant p-4 rounded-lg">
                <p class="font-body text-body">Hello! I've confirmed the appointment for Thursday. Should I bring my own cleaning supplies or use yours?</p>
                <p class="text-caption text-[10px] mt-2 text-on-surface-variant">09:12 AM</p>
              </div>
            </div>
            <!-- Message Sent -->
            <div class="flex gap-4 max-w-[85%] ml-auto flex-row-reverse">
              <div class="bg-primary text-on-primary p-4 rounded-lg">
                <p class="font-body text-body">Hi {{ cleaner.name.split(' ')[0] }}! Please bring your own supplies. I've left the gate code in the booking notes. Looking forward to it!</p>
                <p class="text-caption text-[10px] mt-2 opacity-70">09:45 AM</p>
              </div>
            </div>
          </div>
          <div class="p-4 border-t border-outline-variant">
            <div class="relative flex items-center">
              <input
                class="w-full bg-surface-container-low border border-outline-variant py-3 px-4 pr-12 focus:border-primary focus:ring-0 transition-colors"
                placeholder="Type a message..."
                type="text"
              />
              <button class="absolute right-3 material-symbols-outlined text-primary hover:scale-110 transition-transform">send</button>
            </div>
          </div>
        </section>
      </div>

      <!-- Sidebar: Price Breakdown & CTA -->
      <aside class="lg:col-span-4 space-y-8">
        <!-- Price Breakdown Card -->
        <div class="bg-surface-container-lowest border border-outline-variant p-padding-card">
          <h2 class="font-h2 text-h2 mb-6">Payment Summary</h2>
          <div class="space-y-4 mb-6">
            <div class="flex justify-between font-body text-body">
              <span class="text-on-surface-variant">Deep Clean (Base Rate)</span>
              <span>${{ basePrice.toFixed(2) }}</span>
            </div>
            <div class="flex justify-between font-body text-body">
              <span class="text-on-surface-variant">Service Fee</span>
              <span>${{ serviceFee.toFixed(2) }}</span>
            </div>
            <div class="flex justify-between font-body text-body">
              <span class="text-on-surface-variant">Taxes</span>
              <span>${{ taxes.toFixed(2) }}</span>
            </div>
            <div class="pt-4 border-t border-outline-variant flex justify-between font-h2 text-h2">
              <span>Total</span>
              <span>${{ total.toFixed(2) }}</span>
            </div>
          </div>
          <!-- Contextual CTA -->
          <button class="w-full bg-primary text-on-primary py-4 font-label-md text-label-md hover:opacity-90 active:scale-[0.98] transition-all mb-4">
            Confirm Completion &amp; Pay
          </button>
          <button class="w-full border border-outline-variant py-4 font-label-md text-label-md hover:bg-surface-container transition-colors">
            Cancel Booking
          </button>
          <p class="text-caption text-caption text-on-surface-variant mt-4 text-center">
            Payment will be released to the provider only after you confirm completion.
          </p>
        </div>

        <!-- Support Card -->
        <div class="bg-surface-container-low border border-outline-variant p-6 flex items-start gap-4">
          <span class="material-symbols-outlined text-on-surface-variant">help</span>
          <div>
            <h3 class="font-label-md text-label-md mb-1">Need assistance?</h3>
            <p class="text-caption text-caption text-on-surface-variant mb-3">Our trust and safety team is available 24/7 to help with your booking.</p>
            <a class="text-primary font-label-md text-label-md border-b border-primary pb-0.5" href="#">Contact Support</a>
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

const basePrice = computed(() => (cleaner.value?.hourlyRate ?? 0) * 5)
const serviceFee = computed(() => Math.round(basePrice.value * 0.069 * 100) / 100)
const taxes = computed(() => Math.round(basePrice.value * 0.08 * 100) / 100)
const total = computed(() => Math.round((basePrice.value + serviceFee.value + taxes.value) * 100) / 100)

function goBack() {
  router.push({ name: 'BookCleaner' })
}
</script>

<style scoped>
.material-symbols-outlined {
  font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
  vertical-align: middle;
}
</style>
