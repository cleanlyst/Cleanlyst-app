<template>
  <main class="page-main">
    <section class="page-header">
      <div>
        <h1 class="header-title">Preferences</h1>
        <p class="header-sub">Customise how your cleaning sessions are arranged.</p>
      </div>
    </section>

    <div v-if="loadError" class="load-error" role="alert">
      <span class="material-symbols-outlined">error</span>
      {{ loadError }}
    </div>

    <form v-else @submit.prevent="handleSave">
      <!-- Address -->
      <div class="form-card">
        <h2 class="card-heading">Service Address</h2>

        <div class="form-group">
          <label class="form-label" for="address_line_1">Address Line 1</label>
          <input
            id="address_line_1"
            v-model="form.address_line_1"
            class="form-input"
            placeholder="e.g. 12 Baker Street"
            type="text"
          />
        </div>

        <div class="form-group">
          <label class="form-label" for="address_line_2">Address Line 2 <span class="form-label-optional">(optional)</span></label>
          <input
            id="address_line_2"
            v-model="form.address_line_2"
            class="form-input"
            placeholder="Flat, suite, unit…"
            type="text"
          />
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label" for="city">City</label>
            <input
              id="city"
              v-model="form.city"
              class="form-input"
              placeholder="e.g. London"
              type="text"
            />
          </div>

          <div class="form-group">
            <label class="form-label" for="postcode">Postcode</label>
            <input
              id="postcode"
              v-model="form.postcode"
              class="form-input"
              placeholder="e.g. SW1A 1AA"
              type="text"
            />
          </div>
        </div>
      </div>

      <!-- Property Details -->
      <div class="form-card">
        <h2 class="card-heading">Property & Access</h2>

        <div class="form-group">
          <label class="form-label" for="room_count">Number of Rooms</label>
          <select id="room_count" v-model="form.room_count" class="form-select">
            <option :value="null">Select…</option>
            <option v-for="n in 10" :key="n" :value="n">{{ n }} {{ n === 1 ? 'room' : 'rooms' }}</option>
          </select>
        </div>

        <div class="form-group">
          <div class="toggle-row">
            <div class="toggle-info">
              <p class="toggle-label">Pets on Premises</p>
              <p class="toggle-desc">Let the cleaner know there are pets at home</p>
            </div>
            <button
              class="toggle-btn"
              :class="{ 'toggle-btn--on': form.has_pets }"
              type="button"
              :aria-pressed="form.has_pets ?? false"
              @click="form.has_pets = !form.has_pets"
            >
              <span class="toggle-knob"></span>
            </button>
          </div>
        </div>

        <div class="form-group form-group--last">
          <label class="form-label" for="notes">Special Instructions</label>
          <textarea
            id="notes"
            v-model="form.notes"
            class="form-textarea"
            placeholder="Any specific requirements for the cleaner, e.g. focus areas, products to avoid…"
            rows="4"
          ></textarea>
        </div>
      </div>

      <!-- Cleaner Preference -->
      <div class="form-card">
        <h2 class="card-heading">Cleaner Preference</h2>

        <div class="form-group form-group--last">
          <label class="form-label">Preferred Cleaner Gender <span class="form-label-optional">(optional)</span></label>
          <div class="time-grid">
            <label
              v-for="opt in genderOptions"
              :key="opt.value"
              class="time-option"
              :class="{ 'time-option--selected': form.preferred_cleaner_gender === opt.value }"
            >
              <input v-model="form.preferred_cleaner_gender" :value="opt.value" class="sr-only" type="radio" />
              <span class="time-option-name">{{ opt.label }}</span>
            </label>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="form-footer">
        <p v-if="saveStatus === 'success'" class="save-success">
          <span class="material-symbols-outlined save-icon">check_circle</span>
          Preferences saved successfully.
        </p>
        <p v-if="saveError" class="save-error" role="alert">{{ saveError }}</p>
        <button class="btn-primary" :disabled="saving" type="submit">
          {{ saving ? 'Saving…' : 'Save Preferences' }}
        </button>
      </div>
    </form>
  </main>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useCustomerPreferencesStore } from '@/stores/customerPreferences'

const genderOptions = [
  { value: 'no_preference', label: 'No preference' },
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
]

const store = useCustomerPreferencesStore()

const form = reactive({
  address_line_1: '' as string | null,
  address_line_2: '' as string | null,
  city: '' as string | null,
  postcode: '' as string | null,
  room_count: null as number | null,
  has_pets: false,
  preferred_cleaner_gender: 'no_preference' as string | null,
  notes: '' as string | null,
})

const saving = ref(false)
const saveStatus = ref<'idle' | 'success'>('idle')
const saveError = ref('')
const loadError = ref('')

function syncFromStore() {
  const p = store.preferences
  if (!p) return
  form.address_line_1 = p.address_line_1 ?? ''
  form.address_line_2 = p.address_line_2 ?? ''
  form.city = p.city ?? ''
  form.postcode = p.postcode ?? ''
  form.room_count = p.room_count ?? null
  form.has_pets = p.has_pets ?? false
  form.preferred_cleaner_gender = p.preferred_cleaner_gender ?? 'no_preference'
  form.notes = p.notes ?? ''
}

onMounted(async () => {
  try {
    await store.load()
    syncFromStore()
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : 'Failed to load preferences.'
  }
})

async function handleSave() {
  saving.value = true
  saveStatus.value = 'idle'
  saveError.value = ''
  try {
    await store.save({
      address_line_1: form.address_line_1 || null,
      address_line_2: form.address_line_2 || null,
      city: form.city || null,
      postcode: form.postcode || null,
      room_count: form.room_count,
      has_pets: form.has_pets,
      preferred_cleaner_gender: form.preferred_cleaner_gender,
      notes: form.notes || null,
    })
    saveStatus.value = 'success'
    setTimeout(() => {
      saveStatus.value = 'idle'
    }, 3000)
  } catch (e) {
    saveError.value = e instanceof Error ? e.message : 'Failed to save preferences.'
  } finally {
    saving.value = false
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
  display: inline-block;
  line-height: 1;
  text-transform: none;
  letter-spacing: normal;
  word-wrap: normal;
  white-space: nowrap;
  direction: ltr;
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

.page-main {
  padding: 2rem 1.5rem 6rem;
  max-width: 80rem;
  margin: 0 auto;
}

.page-header {
  margin-bottom: 2rem;
}

.header-title {
  font-family: var(--font-h2);
  font-size: 28px;
  font-weight: 600;
  line-height: 1.2;
  letter-spacing: -0.01em;
  color: var(--on-surface, #1a1c1c);
  margin: 0 0 0.25rem;
}

.header-sub {
  font-family: var(--font-body);
  font-size: 16px;
  font-weight: 400;
  line-height: 1.6;
  color: var(--secondary, #5e5e5e);
  margin: 0;
}

.load-error {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 1rem;
  border: 1px solid var(--error, #b00020);
  color: var(--error, #b00020);
  font-family: var(--font-body);
  font-size: 14px;
  margin-bottom: 1.5rem;
}

/* ── Form card ── */
.form-card {
  border: 1px solid var(--outline-variant, #c4c7c7);
  background: #ffffff;
  border-radius: 0.25rem;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
}

.card-heading {
  font-family: var(--font-label-md);
  font-size: 16px;
  font-weight: 500;
  line-height: 1.4;
  letter-spacing: 0.01em;
  color: var(--on-surface, #1a1c1c);
  margin: 0 0 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--surface-container, #eeeeee);
}

/* ── Form groups ── */
.form-group {
  margin-bottom: 1.25rem;
}

.form-group--last {
  margin-bottom: 0;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.form-label {
  display: block;
  font-family: var(--font-label-md);
  font-size: 13px;
  font-weight: 500;
  line-height: 1.4;
  letter-spacing: 0.01em;
  color: var(--on-surface, #1a1c1c);
  margin-bottom: 0.5rem;
}

.form-label-optional {
  font-weight: 400;
  color: var(--secondary, #5e5e5e);
}

/* ── Inputs ── */
.form-input,
.form-select,
.form-textarea {
  display: block;
  width: 100%;
  padding: 0.625rem 0.75rem;
  border: 1px solid var(--outline-variant, #c4c7c7);
  border-radius: 0.25rem;
  font-family: var(--font-body);
  font-size: 16px;
  font-weight: 400;
  line-height: 1.6;
  color: var(--on-surface, #1a1c1c);
  background: #ffffff;
  transition: border-color 200ms ease;
  outline: none;
  box-sizing: border-box;
}

.form-input:focus,
.form-select:focus,
.form-textarea:focus {
  border-color: var(--primary, #000000);
}

.form-textarea {
  resize: vertical;
  min-height: 100px;
}

/* ── Gender radio grid ── */
.time-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.75rem;
}

.time-option {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.875rem 1rem;
  border: 1px solid var(--outline-variant, #c4c7c7);
  border-radius: 0.25rem;
  cursor: pointer;
  transition: border-color 200ms ease;
}

.time-option--selected {
  border-color: var(--primary, #000000);
  background: var(--surface-container, #eeeeee);
}

.time-option-name {
  font-family: var(--font-label-md);
  font-size: 14px;
  font-weight: 500;
  color: var(--on-surface, #1a1c1c);
}

/* ── Toggle ── */
.toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.toggle-info {
  flex: 1;
}

.toggle-label {
  font-family: var(--font-label-md);
  font-size: 14px;
  font-weight: 500;
  line-height: 1.4;
  color: var(--on-surface, #1a1c1c);
  margin: 0 0 0.125rem;
}

.toggle-desc {
  font-family: var(--font-caption);
  font-size: 12px;
  color: var(--secondary, #5e5e5e);
  margin: 0;
}

.toggle-btn {
  width: 3rem;
  height: 1.5rem;
  border-radius: 999px;
  border: 1px solid var(--outline-variant, #c4c7c7);
  background: var(--surface-container, #eeeeee);
  position: relative;
  cursor: pointer;
  transition:
    background-color 200ms ease,
    border-color 200ms ease;
  padding: 0;
  flex-shrink: 0;
}

.toggle-btn--on {
  background: var(--primary, #000000);
  border-color: var(--primary, #000000);
}

.toggle-knob {
  position: absolute;
  top: 50%;
  left: 3px;
  transform: translateY(-50%);
  width: 1rem;
  height: 1rem;
  border-radius: 50%;
  background: #ffffff;
  transition: left 200ms ease;
  pointer-events: none;
}

.toggle-btn--on .toggle-knob {
  left: calc(100% - 19px);
}

/* ── Form footer ── */
.form-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 1rem;
  flex-wrap: wrap;
}

/* ── Buttons ── */
.btn-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.625rem 1.5rem;
  background: #000000;
  color: #ffffff;
  border: 1px solid #000000;
  border-radius: var(--radius, 0.25rem);
  font-family: var(--font-label-md);
  font-size: 14px;
  font-weight: 500;
  line-height: 1.4;
  cursor: pointer;
  text-decoration: none;
  transition: opacity 200ms ease;
}

.btn-primary:hover {
  opacity: 0.85;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* ── Feedback ── */
.save-success {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-family: var(--font-caption);
  font-size: 13px;
  color: #2e7d32;
  margin: 0;
}

.save-error {
  font-family: var(--font-caption);
  font-size: 13px;
  color: var(--error, #b00020);
  margin: 0;
}

.save-icon {
  font-size: 1rem;
}

@media (min-width: 640px) {
  .time-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (min-width: 1024px) {
  .page-main {
    padding-left: 3rem;
    padding-right: 3rem;
  }
}
</style>
