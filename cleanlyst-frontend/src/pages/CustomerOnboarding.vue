<template>
  <div
    class="customer-onboarding-customer-page bg-background text-on-background antialiased font-body"
  >
    <main class="pt-24 pb-20 min-h-screen px-6 lg:px-12">
      <div class="max-w-4xl mx-auto">
        <!-- Step Indicator -->
        <div class="flex items-center justify-between mb-12">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-full bg-zinc-200 flex items-center justify-center">
              <span
                class="material-symbols-outlined text-sm"
                style="font-variation-settings: 'FILL' 1"
                >check</span
              >
            </div>
            <div class="hidden sm:block">
              <p class="text-label-md font-label-md text-zinc-400">Account</p>
            </div>
          </div>
          <div class="h-[1px] flex-1 mx-4 bg-zinc-200"></div>
          <div class="flex items-center gap-3">
            <div
              class="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center"
            >
              <span class="text-label-md font-bold">2</span>
            </div>
            <div>
              <p class="text-label-md font-label-md text-primary">Preferences</p>
            </div>
          </div>
          <div class="h-[1px] flex-1 mx-4 bg-zinc-200"></div>
          <div class="flex items-center gap-3">
            <div
              class="w-8 h-8 rounded-full border border-zinc-200 flex items-center justify-center"
            >
              <span class="text-label-md font-label-md text-zinc-400">3</span>
            </div>
            <div class="hidden sm:block">
              <p class="text-label-md font-label-md text-zinc-400">Schedule</p>
            </div>
          </div>
        </div>
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-12">
          <!-- Left Column: Form -->
          <div class="lg:col-span-8 space-y-12">
            <section>
              <h1 class="font-h1 text-h1 mb-2">Service Preferences</h1>
              <p class="text-secondary text-body max-w-lg">
                Tell us about your property and specific requirements to help us find the perfect
                match for your home.
              </p>
            </section>
            <form class="space-y-10" @submit.prevent="handleSubmit">
              <!-- Property Details Group -->
              <div class="space-y-6">
                <h2 class="font-h2 text-h2">Property Details</h2>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div class="space-y-2">
                    <label class="block font-label-md text-label-md" for="room_count">Number of Rooms</label>
                    <div class="relative">
                      <select
                        id="room_count"
                        v-model="form.room_count"
                        class="w-full bg-white border border-zinc-200 p-3 rounded appearance-none focus:border-primary outline-none text-body"
                      >
                        <option :value="null">Select…</option>
                        <option v-for="n in 10" :key="n" :value="n">{{ n }} {{ n === 1 ? 'room' : 'rooms' }}</option>
                      </select>
                      <span
                        class="material-symbols-outlined absolute right-3 top-3 pointer-events-none text-zinc-400"
                        >expand_more</span
                      >
                    </div>
                  </div>
                </div>
                <div class="space-y-2">
                  <label class="block font-label-md text-label-md" for="address_line_1">Service Address</label>
                  <div class="relative">
                    <span class="material-symbols-outlined absolute left-3 top-3.5 text-zinc-400"
                      >location_on</span
                    >
                    <input
                      id="address_line_1"
                      v-model="form.address_line_1"
                      class="w-full pl-10 pr-3 py-3 border border-zinc-200 rounded focus:border-primary outline-none text-body"
                      placeholder="Street address"
                      type="text"
                    />
                  </div>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div class="space-y-2">
                    <label class="block font-label-md text-label-md" for="city">City</label>
                    <input
                      id="city"
                      v-model="form.city"
                      class="w-full bg-white border border-zinc-200 p-3 rounded focus:border-primary outline-none text-body"
                      placeholder="e.g. London"
                      type="text"
                    />
                  </div>
                  <div class="space-y-2">
                    <label class="block font-label-md text-label-md" for="postcode">Postcode</label>
                    <input
                      id="postcode"
                      v-model="form.postcode"
                      class="w-full bg-white border border-zinc-200 p-3 rounded focus:border-primary outline-none text-body"
                      placeholder="e.g. SW1A 1AA"
                      type="text"
                    />
                  </div>
                </div>
              </div>
              <!-- Cleaner Preferences Group -->
              <div class="space-y-6">
                <h2 class="font-h2 text-h2">Cleaner Preferences</h2>
                <div class="grid grid-cols-1 gap-4">
                  <label
                    class="flex items-start gap-4 p-4 border border-zinc-200 rounded cursor-pointer hover:bg-zinc-50 transition-colors"
                  >
                    <input
                      v-model="form.has_pets"
                      class="mt-1 w-5 h-5 rounded border-zinc-300 text-primary focus:ring-primary"
                      type="checkbox"
                    />
                    <div class="flex-1">
                      <div class="flex items-center gap-2">
                        <span
                          class="material-symbols-outlined text-zinc-900"
                          style="font-variation-settings: 'FILL' 1"
                          >pets</span
                        >
                        <span class="font-label-md text-zinc-900">Pets are Okay</span>
                      </div>
                      <p class="text-caption text-zinc-500">
                        I have pets at home; cleaner must be comfortable around animals.
                      </p>
                    </div>
                  </label>
                </div>
                <div class="space-y-2">
                  <label class="block font-label-md text-label-md" for="notes">Special Instructions</label>
                  <textarea
                    id="notes"
                    v-model="form.notes"
                    class="w-full bg-white border border-zinc-200 p-3 rounded focus:border-primary outline-none text-body resize-y"
                    placeholder="Any specific requirements for the cleaner, e.g. focus areas, products to avoid…"
                    rows="3"
                  ></textarea>
                </div>
              </div>

              <p v-if="submitError" class="text-caption text-error">{{ submitError }}</p>

              <!-- Action Bar -->
              <div
                class="flex flex-col sm:flex-row items-center justify-between gap-6 pt-8 border-t border-zinc-200"
              >
                <router-link
                  class="text-zinc-500 font-label-md hover:text-zinc-900 transition-colors"
                  :to="{ name: 'CustomerDashboard' }"
                >
                  Skip for now
                </router-link>
                <button
                  class="w-full sm:w-auto px-8 py-4 bg-primary text-white font-label-md hover:opacity-90 transition-opacity active:scale-[0.98]"
                  :disabled="submitting"
                  type="submit"
                >
                  {{ submitting ? 'Saving…' : 'Save & Continue' }}
                </button>
              </div>
            </form>
          </div>
          <!-- Right Column: Context/Visual -->
          <div class="lg:col-span-4 space-y-8">
            <div class="p-6 bg-zinc-50 border border-zinc-200 rounded-xl space-y-6">
              <div class="w-full h-48 bg-zinc-200 rounded overflow-hidden">
                <img
                  class="w-full h-full object-cover grayscale opacity-80"
                  alt=""
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuAn1EwVlku_xUGCu8uV7fSlg0eeMkCn5PcgCnxRWDL9zHq4ALywELxR08U4QCy-ECgJudpsENG5r1jRfdbuKCMglamJO8Y2zDrhK9uL77pcDcLowPP1kq2Xc6SX7lBVMvXNDCOaP1xODLF28-alUfMWGEJYPhuSKZcLpApPMRfTOLEiLYvdZWz6V12StgRom6Aw43z6jqY0D_ZKJ53rdbwYuNEraF12nQCmc9d3TvA608dnQnI0UT8wLd4OrZmysSZ9IZmzSGtoRA"
                />
              </div>
              <div class="space-y-4">
                <h3
                  class="font-label-md text-zinc-900 font-bold uppercase tracking-widest text-[10px]"
                >
                  Why details matter
                </h3>
                <div class="flex gap-4">
                  <span class="material-symbols-outlined text-zinc-400">verified_user</span>
                  <p class="text-caption text-zinc-600">
                    Accurate property details ensure we assign cleaners with the right equipment and
                    experience for your home's size.
                  </p>
                </div>
                <div class="flex gap-4">
                  <span class="material-symbols-outlined text-zinc-400">lock</span>
                  <p class="text-caption text-zinc-600">
                    Your address is only shared with verified professionals once a booking is
                    confirmed.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script lang="ts" setup>
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useCustomerPreferencesStore } from '@/stores/customerPreferences'

const router = useRouter()
const store = useCustomerPreferencesStore()

const form = reactive({
  address_line_1: '' as string | null,
  city: '' as string | null,
  postcode: '' as string | null,
  room_count: null as number | null,
  has_pets: false,
  notes: '' as string | null,
})

const submitting = ref(false)
const submitError = ref('')

onMounted(async () => {
  await store.load()
  const p = store.preferences
  if (!p) return
  form.address_line_1 = p.address_line_1 ?? ''
  form.city = p.city ?? ''
  form.postcode = p.postcode ?? ''
  form.room_count = p.room_count ?? null
  form.has_pets = p.has_pets ?? false
  form.notes = p.notes ?? ''
})

async function handleSubmit() {
  submitting.value = true
  submitError.value = ''
  try {
    await store.save({
      address_line_1: form.address_line_1 || null,
      city: form.city || null,
      postcode: form.postcode || null,
      room_count: form.room_count,
      has_pets: form.has_pets,
      notes: form.notes || null,
      setup_completed_at: new Date().toISOString(),
    })
    await router.replace({ name: 'CustomerDashboard' })
  } catch (err) {
    submitError.value = err instanceof Error ? err.message : 'Failed to save preferences.'
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.material-symbols-outlined {
  font-variation-settings:
    'FILL' 0,
    'wght' 400,
    'GRAD' 0,
    'opsz' 24;
}
.customer-onboarding-customer-page {
  font-family: 'Inter', sans-serif;
}
</style>
