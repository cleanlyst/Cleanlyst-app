<template>
  <div class="bg-background text-on-background antialiased font-body min-h-screen">
    <main class="pt-24 pb-24 px-6 max-w-3xl mx-auto">

      <!-- Header + Step indicator (SearchCleaner pattern) -->
      <section class="mb-10">
        <h1 class="font-h1 text-h1 text-primary mb-1">Set Up Your Account</h1>
        <div class="flex items-center gap-2 mt-4">
          <template v-for="(label, i) in STEP_LABELS" :key="i">
            <div
              :class="[
                'flex items-center gap-1.5 text-xs font-medium',
                step === i + 1 ? 'text-primary' : step > i + 1 ? 'text-green-700' : 'text-on-surface-variant',
              ]"
            >
              <span
                :class="[
                  'w-5 h-5 flex items-center justify-center text-[10px] font-bold',
                  step === i + 1
                    ? 'bg-primary text-white'
                    : step > i + 1
                      ? 'bg-green-600 text-white'
                      : 'bg-surface-variant text-on-surface-variant',
                ]"
              >
                <span v-if="step > i + 1" class="material-symbols-outlined text-[12px]">check</span>
                <span v-else>{{ i + 1 }}</span>
              </span>
              <span class="hidden sm:inline">{{ label }}</span>
            </div>
            <div v-if="i < STEP_LABELS.length - 1" class="flex-1 h-px bg-outline-variant max-w-8"></div>
          </template>
        </div>
      </section>

      <!-- Step 1: Service Address -->
      <section v-if="step === 1" class="space-y-6">
        <h2 class="font-h2 text-h2 text-primary">Service Address</h2>
        <p class="text-caption text-on-surface-variant">Where would you like your cleaning service?</p>

        <div class="space-y-4">
          <div>
            <label class="block font-label-md text-label-md text-primary mb-2" for="address_line_1">
              Address Line 1 <span class="text-red-500">*</span>
            </label>
            <input
              id="address_line_1"
              v-model="form.address_line_1"
              type="text"
              placeholder="e.g. 12 Baker Street"
              class="w-full h-12 px-3 border border-outline-variant bg-white font-body focus:border-primary focus:ring-0 outline-none"
            />
          </div>

          <div>
            <label class="block font-label-md text-label-md text-primary mb-2" for="address_line_2">
              Address Line 2 <span class="text-on-surface-variant font-normal">(optional)</span>
            </label>
            <input
              id="address_line_2"
              v-model="form.address_line_2"
              type="text"
              placeholder="Flat, suite, unit…"
              class="w-full h-12 px-3 border border-outline-variant bg-white font-body focus:border-primary focus:ring-0 outline-none"
            />
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block font-label-md text-label-md text-primary mb-2" for="city">
                City <span class="text-red-500">*</span>
              </label>
              <select
                id="city"
                v-model="form.city"
                class="w-full h-12 px-3 border border-outline-variant bg-white font-body focus:border-primary focus:ring-0 outline-none"
              >
                <option value="">Select a city</option>
                <option v-for="c in ROLLOUT_CONFIG.cities" :key="c" :value="c">{{ c }}</option>
              </select>
            </div>
            <div>
              <label class="block font-label-md text-label-md text-primary mb-2" for="postcode">
                Postcode <span class="text-red-500">*</span>
              </label>
              <input
                id="postcode"
                v-model="form.postcode"
                type="text"
                placeholder="e.g. WN1 1AA"
                class="w-full h-12 px-3 border border-outline-variant bg-white font-body focus:border-primary focus:ring-0 outline-none"
              />
            </div>
          </div>
        </div>
      </section>

      <!-- Step 2: Property & Access -->
      <section v-else-if="step === 2" class="space-y-6">
        <h2 class="font-h2 text-h2 text-primary">Property & Access</h2>
        <p class="text-caption text-on-surface-variant">Help your cleaner prepare for your home.</p>

        <div class="space-y-4">
          <div>
            <label class="block font-label-md text-label-md text-primary mb-2" for="room_count">
              Number of Rooms
            </label>
            <select
              id="room_count"
              v-model="form.room_count"
              class="w-full h-12 px-3 border border-outline-variant bg-white font-body focus:border-primary focus:ring-0 outline-none"
            >
              <option :value="null">Select…</option>
              <option v-for="n in 10" :key="n" :value="n">{{ n }} {{ n === 1 ? 'room' : 'rooms' }}</option>
            </select>
          </div>

          <div class="border border-outline-variant p-4">
            <div class="flex items-center justify-between gap-4">
              <div>
                <p class="font-label-md text-label-md text-primary">Pets on Premises</p>
                <p class="text-caption text-on-surface-variant mt-0.5">Let the cleaner know there are pets at home</p>
              </div>
              <button
                type="button"
                :class="['w-12 h-6 rounded-full border relative transition-colors', form.has_pets ? 'bg-primary border-primary' : 'bg-surface-variant border-outline-variant']"
                :aria-pressed="form.has_pets"
                @click="form.has_pets = !form.has_pets"
              >
                <span
                  :class="['absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all', form.has_pets ? 'left-[calc(100%-18px)]' : 'left-0.5']"
                ></span>
              </button>
            </div>
          </div>

          <div>
            <label class="block font-label-md text-label-md text-primary mb-2" for="notes">
              Notes / Access Instructions <span class="text-on-surface-variant font-normal">(optional)</span>
            </label>
            <textarea
              id="notes"
              v-model="form.notes"
              rows="4"
              placeholder="e.g. gate code 1234, parking on street, apartment intercom number…"
              class="w-full p-3 border border-outline-variant bg-white font-body focus:border-primary focus:ring-0 outline-none resize-none"
            ></textarea>
          </div>
        </div>
      </section>

      <!-- Step 3: Cleaner Preference -->
      <section v-else-if="step === 3" class="space-y-6">
        <h2 class="font-h2 text-h2 text-primary">Cleaner Preference</h2>
        <p class="text-caption text-on-surface-variant">We'll use this to filter cleaner suggestions for you.</p>

        <fieldset class="space-y-3 border-0 p-0 m-0">
          <legend class="font-label-md text-label-md text-primary mb-3">Preferred Cleaner Gender</legend>
          <label
            v-for="opt in GENDER_OPTIONS"
            :key="opt.value"
            :class="[
              'flex items-center gap-4 p-4 border cursor-pointer transition-colors',
              form.preferred_cleaner_gender === opt.value
                ? 'border-primary bg-surface-variant'
                : 'border-outline-variant bg-white hover:border-primary',
            ]"
          >
            <input
              v-model="form.preferred_cleaner_gender"
              :value="opt.value"
              type="radio"
              class="sr-only"
            />
            <span
              :class="[
                'w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0',
                form.preferred_cleaner_gender === opt.value ? 'border-primary' : 'border-outline-variant',
              ]"
            >
              <span v-if="form.preferred_cleaner_gender === opt.value" class="w-2 h-2 rounded-full bg-primary"></span>
            </span>
            <span class="font-label-md text-label-md text-primary">{{ opt.label }}</span>
          </label>
        </fieldset>
      </section>

      <!-- Error -->
      <p v-if="submitError" class="mt-4 text-caption text-red-600">{{ submitError }}</p>

      <!-- Navigation -->
      <div class="flex items-center justify-between pt-8">
        <button
          v-if="step > 1"
          type="button"
          class="px-6 py-3 border border-outline-variant text-primary font-label-md hover:bg-surface-container"
          @click="prevStep"
        >
          ← Back
        </button>
        <span v-else></span>

        <button
          type="button"
          :disabled="!canNext || submitting"
          class="px-8 py-3 bg-primary text-white font-label-md disabled:opacity-40"
          @click="step < STEP_LABELS.length ? nextStep() : handleComplete()"
        >
          <span v-if="step < STEP_LABELS.length">Continue →</span>
          <span v-else>{{ submitting ? 'Saving…' : 'Complete Setup' }}</span>
        </button>
      </div>

      <!-- Skip link -->
      <div class="text-center mt-6">
        <router-link
          :to="{ name: 'CustomerDashboard' }"
          class="text-caption text-on-surface-variant hover:text-primary transition-colors"
        >
          Skip for now
        </router-link>
      </div>

    </main>
  </div>
</template>

<script lang="ts" setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useCustomerPreferencesStore } from '@/stores/customerPreferences'
import { ROLLOUT_CONFIG } from '@/config/rollout'

const STEP_LABELS = ['Service Address', 'Property & Access', 'Cleaner Preference']

const GENDER_OPTIONS = [
  { value: 'no_preference', label: 'No preference' },
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
]

const router = useRouter()
const store = useCustomerPreferencesStore()

const step = ref(1)
const submitting = ref(false)
const submitError = ref('')

const form = reactive({
  address_line_1: '',
  address_line_2: '',
  city: '',
  postcode: '',
  room_count: null as number | null,
  has_pets: false,
  notes: '',
  preferred_cleaner_gender: 'no_preference',
})

const canNext = computed(() => {
  if (step.value === 1) {
    return !!form.address_line_1.trim() && !!form.city && !!form.postcode.trim()
  }
  return true
})

onMounted(async () => {
  await store.load()
  const p = store.preferences
  if (!p) return
  // If already completed, go straight to dashboard
  if (p.setup_completed_at) {
    router.replace({ name: 'CustomerDashboard' })
    return
  }
  form.address_line_1 = p.address_line_1 ?? ''
  form.address_line_2 = p.address_line_2 ?? ''
  form.city = p.city ?? ''
  form.postcode = p.postcode ?? ''
  form.room_count = p.room_count ?? null
  form.has_pets = p.has_pets ?? false
  form.notes = p.notes ?? ''
  form.preferred_cleaner_gender = p.preferred_cleaner_gender ?? 'no_preference'
})

async function saveStep() {
  if (step.value === 1) {
    await store.save({
      address_line_1: form.address_line_1 || null,
      address_line_2: form.address_line_2 || null,
      city: form.city || null,
      postcode: form.postcode || null,
    })
  } else if (step.value === 2) {
    await store.save({
      room_count: form.room_count,
      has_pets: form.has_pets,
      notes: form.notes || null,
    })
  }
}

async function nextStep() {
  if (!canNext.value) return
  submitError.value = ''
  try {
    await saveStep()
  } catch {
    // Non-fatal — continue anyway; dashboard will show stale data
  }
  step.value++
}

function prevStep() {
  if (step.value > 1) step.value--
}

async function handleComplete() {
  submitting.value = true
  submitError.value = ''
  try {
    await store.save({
      preferred_cleaner_gender: form.preferred_cleaner_gender,
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

.sr-only {
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
</style>
