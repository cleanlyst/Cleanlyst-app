<template>
  <main class="page-main">
    <!-- ── Page header ───────────────────────────────────────────────────── -->
    <section class="page-header">
      <h1 class="header-title">Services &amp; Pricing</h1>
      <p class="header-copy">Define every service you offer and set your pricing per service.</p>
    </section>

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
