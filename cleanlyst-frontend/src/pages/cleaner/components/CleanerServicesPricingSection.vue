<template>
  <main class="page-main">
    <!-- ── Page header ───────────────────────────────────────────────────── -->
    <section class="page-header">
      <h1 class="header-title">Services &amp; Pricing</h1>
      <p class="header-copy">Define every service you offer and set your pricing per service.</p>
    </section>

    <!-- ── Hourly Rate card with inline editor ───────────────────────────── -->
    <div class="rate-card">
      <!-- Always-visible header row -->
      <div class="rate-card-header">
        <div class="rate-card-left">
          <span class="material-symbols-outlined rate-icon">payments</span>
          <div>
            <p class="rate-label">Hourly Rate</p>
            <p class="rate-value">{{ hourlyRateLabel }}</p>
          </div>
        </div>
        <button
          class="btn-edit-rate"
          type="button"
          @click="rateEditorOpen ? cancelRateEdit() : openRateEditor()"
        >
          <span class="material-symbols-outlined">{{ rateEditorOpen ? 'close' : 'edit' }}</span>
          {{ rateEditorOpen ? 'Cancel' : 'Edit Rate' }}
        </button>
      </div>

      <!-- Inline expand: rate editor -->
      <Transition name="rate-expand">
        <div v-if="rateEditorOpen" class="rate-editor">
          <div class="rate-editor-row">
            <div class="rate-field">
              <label class="rate-field-label" for="hourly-rate">New rate</label>
              <div class="rate-input-wrap">
                <span class="rate-prefix">£</span>
                <input
                  id="hourly-rate"
                  v-model="rateInput"
                  class="rate-input"
                  :class="{ 'rate-input--error': !!rateError }"
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="0.00"
                  @keydown.enter="saveRate"
                />
                <span class="rate-suffix">/ hr</span>
              </div>
            </div>
            <div class="rate-editor-actions">
              <button class="btn-start" type="button" :disabled="rateSaving" @click="saveRate">
                <span v-if="rateSaving" class="material-symbols-outlined btn-spin"
                  >progress_activity</span
                >
                <span v-else-if="rateSaved" class="material-symbols-outlined">check</span>
                {{ rateSaving ? 'Saving…' : rateSaved ? 'Saved!' : 'Save Rate' }}
              </button>
            </div>
          </div>
          <p v-if="rateError" class="rate-editor-error">{{ rateError }}</p>
        </div>
      </Transition>
    </div>

    <!-- ── Pending notice ────────────────────────────────────────────────── -->
    <div v-if="!isApproved && !store.loading" class="notice-card">
      <span class="material-symbols-outlined notice-icon">info</span>
      <p class="notice-text">
        Your account is still under review. You can browse and plan services now — they will go live
        once your account is approved.
      </p>
    </div>

    <!-- ── Global store error ────────────────────────────────────────────── -->
    <div v-if="store.error" class="error-card">
      <span class="material-symbols-outlined error-icon">error</span>
      <p class="error-text">{{ store.error }}</p>
    </div>

    <!-- ── Loading spinner ───────────────────────────────────────────────── -->
    <div v-if="store.loading" class="loading-state">
      <span class="material-symbols-outlined loading-spin">progress_activity</span>
      <span class="loading-text">Loading your services…</span>
    </div>

    <!-- ── Main content (hidden while loading) ───────────────────────────── -->
    <template v-else>
      <!-- My Services view -->
      <section v-if="view === 'services'" class="services-section">
        <div class="section-header">
          <div class="section-header-left">
            <h2 class="section-title">My Services</h2>
            <span v-if="store.services.length" class="service-count">
              {{ store.services.length }}
            </span>
          </div>
          <!-- Always show — pending cleaners see it and get an RLS error on save -->
          <button class="btn-add" type="button" @click="openWizard">
            <span class="material-symbols-outlined">add</span>
            Add Services
          </button>
        </div>

        <div v-if="wizardSuccess" class="success-card">
          <span class="material-symbols-outlined success-icon">check_circle</span>
          <p class="success-text">Service Added</p>
        </div>

        <MyServicesPanel
          :services="store.services"
          :mutating="mutating"
          @update="handleUpdate"
          @remove="handleRemove"
        />

        <div v-if="!store.services.length" class="empty-cta">
          <button class="btn-start" type="button" @click="openWizard">
            <span class="material-symbols-outlined">add</span>
            Add your first service
          </button>
        </div>
      </section>

      <!-- Add Services wizard -->
      <section v-else-if="view === 'wizard'" class="wizard-section">
        <ServiceSelector
          :existing-titles="existingTitles"
          :saving="store.saving"
          :save-error="wizardError"
          :save-success="wizardSuccess"
          @submit="handleSubmit"
          @cancel="closeWizard"
        />
      </section>
    </template>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useCleanerServicesStore } from '@/stores/cleanerServices'
import type { ServiceDraft } from '@/stores/cleanerServices'
import { requireSupabase } from '@/lib/supabase'
import ServiceSelector from './services/ServiceSelector.vue'
import MyServicesPanel from './services/MyServicesPanel.vue'

function extractMessage(e: unknown, fallback: string): string {
  if (e instanceof Error) return e.message
  if (e && typeof e === 'object' && 'message' in e) {
    const msg = (e as { message: unknown }).message
    if (typeof msg === 'string' && msg) return msg
  }
  return fallback
}

// No props — reads directly from auth store so it can also write back
type View = 'services' | 'wizard'

const auth = useAuthStore()
const store = useCleanerServicesStore()

// ── View state ────────────────────────────────────────────────────────────────
const view = ref<View>('services')
const mutating = ref(false)
const wizardError = ref<string | null>(null)
const wizardSuccess = ref(false)
let wizardSuccessTimer: ReturnType<typeof setTimeout> | null = null

// ── Derived auth data ─────────────────────────────────────────────────────────
const isApproved = computed(
  () => auth.cleanerProfile?.status === 'approved' || auth.profile?.role === 'cleaner_active',
)

const existingTitles = computed(() => new Set(store.services.map((s) => s.title)))

const hourlyRateLabel = computed(() => {
  const amount = auth.cleanerProfile?.hourly_rate_cents
  const currency = auth.cleanerProfile?.currency ?? 'GBP'
  if (amount == null || amount <= 0) return 'Not set'
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(amount / 100)
})

// ── Rate editor state ─────────────────────────────────────────────────────────
const rateEditorOpen = ref(false)
const rateInput = ref('')
const rateSaving = ref(false)
const rateError = ref<string | null>(null)
const rateSaved = ref(false)

function openRateEditor() {
  const current = auth.cleanerProfile?.hourly_rate_cents
  rateInput.value = current && current > 0 ? (current / 100).toFixed(2) : ''
  rateError.value = null
  rateSaved.value = false
  rateEditorOpen.value = true
}

function cancelRateEdit() {
  rateEditorOpen.value = false
  rateError.value = null
}

async function saveRate() {
  rateError.value = null
  rateSaved.value = false

  const value = parseFloat(rateInput.value)
  if (!rateInput.value.trim() || isNaN(value) || value <= 0) {
    rateError.value = 'Enter a valid hourly rate greater than £0'
    return
  }

  const cents = Math.round(value * 100)
  rateSaving.value = true
  try {
    const supabase = requireSupabase()
    const { error } = await supabase
      .from('cleaner_profiles')
      .update({ hourly_rate_cents: cents })
      .eq('user_id', auth.userId!)
    if (error) throw error

    // Update the store in-place so the UI reacts immediately
    if (auth.cleanerProfile) auth.cleanerProfile.hourly_rate_cents = cents

    rateSaved.value = true
    setTimeout(() => {
      rateEditorOpen.value = false
      rateSaved.value = false
    }, 1200)
  } catch (e) {
    rateError.value = extractMessage(e, 'Failed to save rate.')
  } finally {
    rateSaving.value = false
  }
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────
onMounted(async () => {
  // Guard: do NOT call init() if auth is already initialized — it resets
  // cleanerProfile to null mid-render causing isApproved to flicker false.
  if (!auth.initialized) await auth.init()
  if (auth.userId) await store.load(auth.userId)
})

// ── Services handlers ─────────────────────────────────────────────────────────
function openWizard() {
  wizardError.value = null
  wizardSuccess.value = false
  view.value = 'wizard'
}

function closeWizard() {
  if (wizardSuccessTimer !== null) {
    clearTimeout(wizardSuccessTimer)
    wizardSuccessTimer = null
  }
  wizardError.value = null
  wizardSuccess.value = false
  view.value = 'services'
}

async function handleSubmit(drafts: ServiceDraft[]) {
  if (!auth.userId) {
    wizardError.value = 'Authentication error — please refresh the page and try again.'
    return
  }
  console.debug('[CleanerServicesPricingSection] submitting drafts', drafts)
  wizardError.value = null
  wizardSuccess.value = false
  try {
    await store.addMany(auth.userId, drafts)
    view.value = 'services'
    wizardSuccess.value = true
    wizardSuccessTimer = setTimeout(() => {
      wizardSuccessTimer = null
      wizardSuccess.value = false
    }, 1400)
  } catch (e) {
    console.error('[CleanerServicesPricingSection] save failed', e)
    wizardError.value = store.error ?? extractMessage(e, 'Failed to save services.')
  }
}

async function handleUpdate(
  id: string,
  patch: { base_price_cents: number; duration_minutes: number },
) {
  mutating.value = true
  try {
    await store.update(id, patch)
  } finally {
    mutating.value = false
  }
}

async function handleRemove(id: string) {
  mutating.value = true
  try {
    await store.remove(id)
  } finally {
    mutating.value = false
  }
}
</script>

<style scoped>
/* ── Material Symbols ─────────────────────────────────────────────────── */
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

/* ── Page shell ───────────────────────────────────────────────────────── */
.page-main {
  padding-top: 2rem;
  padding-bottom: 5rem;
  padding-left: 1.5rem;
  padding-right: 1.5rem;
  max-width: 80rem;
  margin-left: auto;
  margin-right: auto;
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

@media (min-width: 1024px) {
  .page-main {
    padding-left: 3rem;
    padding-right: 3rem;
  }
}

/* ── Page header ──────────────────────────────────────────────────────── */
.header-title {
  font-size: 32px;
  font-weight: 600;
  line-height: 1.2;
  letter-spacing: -0.02em;
  color: var(--primary, #000000);
  margin: 0 0 0.5rem;
}

.header-copy {
  font-size: 16px;
  font-weight: 400;
  line-height: 1.6;
  color: var(--secondary, #5e5e5e);
  margin: 0;
}

/* ── Rate card ────────────────────────────────────────────────────────── */
.rate-card {
  border: 1px solid var(--outline-variant, #c4c7c7);
  background-color: var(--surface-container-lowest, #ffffff);
}

.rate-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.25rem 1.5rem;
  flex-wrap: wrap;
}

.rate-card-left {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.rate-icon {
  font-size: 1.75rem;
  color: var(--secondary, #5e5e5e);
}

.rate-label {
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--secondary, #5e5e5e);
  margin: 0 0 0.25rem;
}

.rate-value {
  font-size: 26px;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--primary, #000000);
  margin: 0;
}

/* ── Edit Rate button ─────────────────────────────────────────────────── */
.btn-edit-rate {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 1rem;
  background: transparent;
  border: 1px solid var(--outline-variant, #c4c7c7);
  font-size: 14px;
  font-weight: 500;
  letter-spacing: 0.01em;
  color: var(--primary, #000000);
  cursor: pointer;
  transition: background-color 150ms;
  flex-shrink: 0;
}

.btn-edit-rate:hover {
  background: var(--surface-variant, #f4f4f5);
}

.btn-edit-rate .material-symbols-outlined {
  font-size: 1rem;
}

/* ── Rate editor (inline expand) ──────────────────────────────────────── */
.rate-editor {
  border-top: 1px solid var(--outline-variant, #c4c7c7);
  padding: 1.25rem 1.5rem;
  background: var(--surface-variant, #f9f9f9);
}

.rate-editor-row {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 1rem;
}

.rate-field {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.rate-field-label {
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--secondary, #5e5e5e);
}

.rate-input-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.rate-prefix {
  position: absolute;
  left: 0.75rem;
  font-size: 14px;
  color: var(--secondary, #5e5e5e);
  pointer-events: none;
}

.rate-suffix {
  position: absolute;
  right: 0.75rem;
  font-size: 13px;
  color: var(--secondary, #5e5e5e);
  pointer-events: none;
}

.rate-input {
  width: 10rem;
  padding: 0.625rem 3.5rem 0.625rem 1.75rem;
  border: 1px solid var(--outline-variant, #c4c7c7);
  font-size: 15px;
  font-weight: 600;
  color: var(--primary, #000000);
  background: #ffffff;
  outline: none;
  transition: border-color 150ms;
  box-sizing: border-box;
}

.rate-input:focus {
  border-color: var(--primary, #000000);
}

.rate-input--error {
  border-color: #ba1a1a;
}

.rate-editor-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.rate-editor-error {
  font-size: 12px;
  color: #ba1a1a;
  margin: 0.625rem 0 0;
}

/* ── Rate expand transition ───────────────────────────────────────────── */
.rate-expand-enter-active,
.rate-expand-leave-active {
  transition:
    opacity 200ms ease,
    transform 200ms ease;
}

.rate-expand-enter-from,
.rate-expand-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

/* ── Notice / Error banners ───────────────────────────────────────────── */
.notice-card,
.error-card {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 1rem 1.25rem;
  border: 1px solid;
}

.notice-card {
  border-color: var(--outline-variant, #c4c7c7);
  background: var(--surface-variant, #f4f4f5);
}

.notice-icon,
.error-icon {
  font-size: 1.25rem;
  flex-shrink: 0;
  margin-top: 0.1rem;
}

.notice-icon {
  color: var(--secondary, #5e5e5e);
}

.notice-text,
.error-text {
  font-size: 14px;
  line-height: 1.6;
  margin: 0;
}

.error-card {
  border-color: #ba1a1a;
  background: #ffebee;
}

.error-icon {
  color: #ba1a1a;
}
.error-text {
  color: #ba1a1a;
}

/* ── Loading ──────────────────────────────────────────────────────────── */
.loading-state {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 2rem 0;
}

.loading-spin {
  font-size: 1.5rem;
  color: var(--secondary, #5e5e5e);
  animation: spin 1s linear infinite;
}

.loading-text {
  font-size: 14px;
  color: var(--secondary, #5e5e5e);
}

/* ── Services section ─────────────────────────────────────────────────── */
.services-section {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.section-header-left {
  display: flex;
  align-items: center;
  gap: 0.625rem;
}

.section-title {
  font-size: 22px;
  font-weight: 600;
  line-height: 1.3;
  letter-spacing: -0.01em;
  color: var(--primary, #000000);
  margin: 0;
}

.service-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.5rem;
  height: 1.5rem;
  padding: 0 0.375rem;
  background: var(--surface-variant, #e2e2e2);
  color: var(--secondary, #5e5e5e);
  font-size: 12px;
  font-weight: 600;
}

.empty-cta {
  display: flex;
  justify-content: center;
  padding-top: 0.5rem;
}

/* ── Buttons ──────────────────────────────────────────────────────────── */
.btn-start {
  padding: 0.625rem 1.25rem;
  background-color: var(--primary, #000000);
  color: var(--on-primary, #ffffff);
  font-size: 14px;
  font-weight: 500;
  letter-spacing: 0.01em;
  border: none;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  transition: opacity 0.15s;
}

.btn-start:hover:not(:disabled) {
  opacity: 0.85;
}

.btn-start:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.btn-start .material-symbols-outlined {
  font-size: 1rem;
}

.btn-add {
  padding: 0.5rem 1rem;
  background-color: transparent;
  color: var(--primary, #000000);
  font-size: 14px;
  font-weight: 500;
  letter-spacing: 0.01em;
  border: 1px solid var(--outline-variant, #c4c7c7);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  transition: background-color 0.15s;
}

.btn-add:hover {
  background-color: var(--surface-variant, #e2e2e2);
}

.btn-add .material-symbols-outlined {
  font-size: 1rem;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.btn-spin {
  animation: spin 1s linear infinite;
}
</style>
