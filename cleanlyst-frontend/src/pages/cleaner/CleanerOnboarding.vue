<template>
  <div class="bg-background text-on-background antialiased font-body min-h-screen">
    <main class="pt-24 pb-24 px-6 max-w-3xl mx-auto">

      <!-- Header + Step indicator -->
      <section class="mb-10">
        <h1 class="font-h1 text-h1 text-primary mb-1">Cleaner Application</h1>
        <p class="text-caption text-on-surface-variant mb-4">Upload the required documents to complete your application.</p>
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

      <div v-if="initLoading" class="py-12 text-center text-caption text-on-surface-variant">
        Loading your application…
      </div>

      <template v-else>

        <!-- Requested changes banner (needs_info re-entry) -->
        <div
          v-if="requestedInfo"
          class="flex items-start gap-3 p-4 border border-amber-400 bg-amber-50 mb-6"
        >
          <span class="material-symbols-outlined text-amber-700 mt-0.5 flex-shrink-0">warning</span>
          <div>
            <p class="font-label-md text-label-md text-amber-900 mb-1">Changes Requested</p>
            <p class="text-caption text-amber-800">{{ requestedInfo }}</p>
          </div>
        </div>

        <!-- Step 1: Identity Verification -->

        <section v-if="step === 1" class="space-y-6">
          <div>
            <h2 class="font-h2 text-h2 text-primary">Verify Identity</h2>
            <p class="text-caption text-on-surface-variant mt-1">
              Upload a valid passport or driving licence. This document is required to proceed.
            </p>
          </div>

          <div>
            <label class="block font-label-md text-label-md text-primary mb-2">Document Type</label>
            <div class="grid grid-cols-2 gap-3">
              <label
                v-for="opt in ID_DOC_TYPES"
                :key="opt.value"
                :class="[
                  'flex items-center gap-3 p-4 border cursor-pointer transition-colors',
                  idDocType === opt.value
                    ? 'border-primary bg-surface-variant'
                    : 'border-outline-variant bg-white hover:border-primary',
                ]"
              >
                <input v-model="idDocType" :value="opt.value" type="radio" class="sr-only" />
                <span
                  :class="[
                    'w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0',
                    idDocType === opt.value ? 'border-primary' : 'border-outline-variant',
                  ]"
                >
                  <span v-if="idDocType === opt.value" class="w-2 h-2 rounded-full bg-primary"></span>
                </span>
                <span class="font-label-md text-label-md text-primary">{{ opt.label }}</span>
              </label>
            </div>
          </div>

          <div>
            <label class="block font-label-md text-label-md text-primary mb-2">Upload Document</label>
            <div
              :class="[
                'border-2 border-dashed p-8 text-center transition-colors',
                idFile ? 'border-primary bg-surface-variant' : 'border-outline-variant hover:border-primary',
              ]"
            >
              <input
                ref="idFileInput"
                type="file"
                accept="image/*,.pdf"
                class="hidden"
                @change="onIdFileChange"
              />
              <div v-if="idFile" class="space-y-2">
                <span class="material-symbols-outlined text-3xl text-primary block">description</span>
                <p class="font-label-md text-label-md text-primary">{{ idFile.name }}</p>
                <p class="text-caption text-on-surface-variant">{{ formatFileSize(idFile.size) }}</p>
                <button type="button" class="text-caption text-primary underline" @click="idFile = null">Remove</button>
              </div>
              <div v-else class="space-y-3">
                <span class="material-symbols-outlined text-3xl text-on-surface-variant block">upload_file</span>
                <p class="font-label-md text-label-md text-primary">Drop file here or click to upload</p>
                <p class="text-caption text-on-surface-variant">JPEG, PNG or PDF · Max 10 MB</p>
                <button
                  type="button"
                  class="px-4 py-2 border border-outline-variant font-label-md text-primary hover:bg-surface-container transition-colors"
                  @click="idFileInput?.click()"
                >
                  Choose file
                </button>
              </div>
            </div>
          </div>

          <div v-if="uploadedDocs.id_document" class="flex items-center gap-2 text-green-700 text-caption">
            <span class="material-symbols-outlined text-base">check_circle</span>
            Previously uploaded — uploading a new file will replace it.
          </div>
        </section>

        <!-- Step 2: Public Liability Insurance -->
        <section v-else-if="step === 2" class="space-y-6">
          <div>
            <h2 class="font-h2 text-h2 text-primary">Insurance Verification</h2>
            <p class="text-caption text-on-surface-variant mt-1">
              Upload your public liability insurance certificate. This is required for approval.
            </p>
          </div>

          <div>
            <label class="block font-label-md text-label-md text-primary mb-2">Insurance Certificate</label>
            <div
              :class="[
                'border-2 border-dashed p-8 text-center transition-colors',
                insuranceFile ? 'border-primary bg-surface-variant' : 'border-outline-variant hover:border-primary',
              ]"
            >
              <input
                ref="insuranceFileInput"
                type="file"
                accept="image/*,.pdf"
                class="hidden"
                @change="onInsuranceFileChange"
              />
              <div v-if="insuranceFile" class="space-y-2">
                <span class="material-symbols-outlined text-3xl text-primary block">description</span>
                <p class="font-label-md text-label-md text-primary">{{ insuranceFile.name }}</p>
                <p class="text-caption text-on-surface-variant">{{ formatFileSize(insuranceFile.size) }}</p>
                <button type="button" class="text-caption text-primary underline" @click="insuranceFile = null">Remove</button>
              </div>
              <div v-else class="space-y-3">
                <span class="material-symbols-outlined text-3xl text-on-surface-variant block">upload_file</span>
                <p class="font-label-md text-label-md text-primary">Drop file here or click to upload</p>
                <p class="text-caption text-on-surface-variant">JPEG, PNG or PDF · Max 10 MB</p>
                <button
                  type="button"
                  class="px-4 py-2 border border-outline-variant font-label-md text-primary hover:bg-surface-container transition-colors"
                  @click="insuranceFileInput?.click()"
                >
                  Choose file
                </button>
              </div>
            </div>
          </div>

          <div v-if="uploadedDocs.insurance_document" class="flex items-center gap-2 text-green-700 text-caption">
            <span class="material-symbols-outlined text-base">check_circle</span>
            Previously uploaded — uploading a new file will replace it.
          </div>
        </section>

        <!-- Step 3: DBS Check -->
        <section v-else-if="step === 3" class="space-y-6">
          <div>
            <h2 class="font-h2 text-h2 text-primary">DBS Check</h2>
            <p class="text-caption text-on-surface-variant mt-1">
              DBS verification can be completed later but may be required before approval.
            </p>
          </div>

          <div>
            <label class="block font-label-md text-label-md text-primary mb-2">
              DBS Certificate <span class="text-on-surface-variant font-normal">(optional)</span>
            </label>
            <div
              :class="[
                'border-2 border-dashed p-8 text-center transition-colors',
                dbsFile ? 'border-primary bg-surface-variant' : 'border-outline-variant hover:border-primary',
              ]"
            >
              <input
                ref="dbsFileInput"
                type="file"
                accept="image/*,.pdf"
                class="hidden"
                @change="onDbsFileChange"
              />
              <div v-if="dbsFile" class="space-y-2">
                <span class="material-symbols-outlined text-3xl text-primary block">description</span>
                <p class="font-label-md text-label-md text-primary">{{ dbsFile.name }}</p>
                <p class="text-caption text-on-surface-variant">{{ formatFileSize(dbsFile.size) }}</p>
                <button type="button" class="text-caption text-primary underline" @click="dbsFile = null">Remove</button>
              </div>
              <div v-else class="space-y-3">
                <span class="material-symbols-outlined text-3xl text-on-surface-variant block">upload_file</span>
                <p class="font-label-md text-label-md text-primary">Drop file here or click to upload</p>
                <p class="text-caption text-on-surface-variant">JPEG, PNG or PDF · Max 10 MB</p>
                <button
                  type="button"
                  class="px-4 py-2 border border-outline-variant font-label-md text-primary hover:bg-surface-container transition-colors"
                  @click="dbsFileInput?.click()"
                >
                  Choose file
                </button>
              </div>
            </div>
          </div>

          <div v-if="uploadedDocs.dbs_document" class="flex items-center gap-2 text-green-700 text-caption">
            <span class="material-symbols-outlined text-base">check_circle</span>
            Previously uploaded — uploading a new file will replace it.
          </div>
        </section>

        <!-- Step 4: Payment Methods -->
        <section v-if="step === 4" class="space-y-6">
          <div>
            <h2 class="font-h2 text-h2 text-primary">Payment Methods</h2>
            <p class="text-caption text-on-surface-variant mt-1">
              Select the payment methods you accept from customers. Customers will see these options
              when booking with you. You must accept at least one.
            </p>
          </div>

          <div class="space-y-3">
            <label
              v-for="method in PAYMENT_METHOD_OPTIONS"
              :key="method.value"
              :class="[
                'flex items-start gap-4 p-4 border cursor-pointer transition-colors',
                acceptedPaymentMethods.includes(method.value)
                  ? 'border-primary bg-surface-variant'
                  : 'border-outline-variant bg-white hover:border-primary',
              ]"
            >
              <input
                v-model="acceptedPaymentMethods"
                :value="method.value"
                type="checkbox"
                class="mt-0.5 w-4 h-4 accent-primary flex-shrink-0"
              />
              <div>
                <div class="flex items-center gap-2">
                  <span class="material-symbols-outlined text-xl text-primary">{{ method.icon }}</span>
                  <span class="font-label-md text-label-md text-primary">{{ method.label }}</span>
                </div>
                <p class="text-caption text-on-surface-variant mt-1">{{ method.description }}</p>
              </div>
            </label>
          </div>

          <div
            v-if="acceptedPaymentMethods.length === 0"
            class="flex items-center gap-2 text-amber-700 text-caption"
          >
            <span class="material-symbols-outlined text-base">warning</span>
            Select at least one payment method to continue.
          </div>
        </section>

        <!-- Error -->
        <p v-if="stepError" class="mt-4 text-caption text-red-600">{{ stepError }}</p>

        <!-- Navigation -->
        <div class="flex items-center justify-between pt-8">
          <button
            v-if="step > 1"
            type="button"
            class="px-6 py-3 border border-outline-variant text-primary font-label-md hover:bg-surface-container"
            :disabled="uploading"
            @click="prevStep"
          >
            ← Back
          </button>
          <span v-else></span>

          <button
            type="button"
            :disabled="!canNext || uploading"
            class="px-8 py-3 bg-primary text-white font-label-md disabled:opacity-40 flex items-center gap-2"
            @click="step < STEP_LABELS.length ? handleNext() : handleSubmit()"
          >
            <span v-if="uploading" class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            <span v-if="step < STEP_LABELS.length">{{ uploading ? 'Uploading…' : 'Continue →' }}</span>
            <span v-else>{{ uploading ? 'Submitting…' : 'Submit Application' }}</span>
          </button>
        </div>

      </template>
    </main>
  </div>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { toUserMessage } from '@/utils/format'
import { useAuthStore } from '@/stores/auth'
import { useCleanerApplicationStore } from '@/stores/cleanerApplication'
import { uploadCleanerDocument } from '@/services/applicationService'
import { getSupabaseClient } from '@/services/supabaseClient'

const STEP_LABELS = ['Verify Identity', 'Insurance', 'DBS Check', 'Payment Methods']

const PAYMENT_METHOD_OPTIONS = [
  {
    value: 'card',
    label: 'Card via Cleanlyst',
    icon: 'credit_card',
    description: 'Customers pay by card through the Cleanlyst platform. Payment is authorised before the job.',
  },
  {
    value: 'cash',
    label: 'Cash',
    icon: 'payments',
    description: 'Customers pay you in cash on the day of the clean.',
  },
  {
    value: 'bank_transfer',
    label: 'Bank Transfer',
    icon: 'account_balance',
    description: 'Customers pay by bank transfer before or after the clean.',
  },
]

const ID_DOC_TYPES = [
  { value: 'passport', label: 'Passport' },
  { value: 'driving_licence', label: 'Driving Licence' },
]

const router = useRouter()
const auth = useAuthStore()
const appStore = useCleanerApplicationStore()

const step = ref(1)
const initLoading = ref(true)
const uploading = ref(false)
const stepError = ref('')
const requestedInfo = ref<string | null>(null)

const MAX_FILE_SIZE = 10 * 1024 * 1024
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']

const idDocType = ref<'passport' | 'driving_licence'>('passport')
const idFile = ref<File | null>(null)
const insuranceFile = ref<File | null>(null)
const dbsFile = ref<File | null>(null)
const acceptedPaymentMethods = ref<string[]>(['card'])

const idFileInput = ref<HTMLInputElement | null>(null)
const insuranceFileInput = ref<HTMLInputElement | null>(null)
const dbsFileInput = ref<HTMLInputElement | null>(null)

interface UploadedDocs {
  id_document: boolean
  insurance_document: boolean
  dbs_document: boolean
}
const uploadedDocs = ref<UploadedDocs>({
  id_document: false,
  insurance_document: false,
  dbs_document: false,
})

const canNext = computed(() => {
  if (step.value === 1) return !!idFile.value || uploadedDocs.value.id_document
  if (step.value === 2) return !!insuranceFile.value || uploadedDocs.value.insurance_document
  if (step.value === 4) return acceptedPaymentMethods.value.length > 0
  return true
})

onMounted(async () => {
  try {
    await appStore.createOrLoad()
    if (appStore.application) {
      await loadExistingDocs(appStore.application.id)
    }
    // Load existing payment method preferences if already set
    if (auth.userId) {
      const supabase = getSupabaseClient()
      const { data: cp } = await supabase
        .from('cleaner_profiles')
        .select('accepted_payment_methods')
        .eq('user_id', auth.userId)
        .maybeSingle()
      if (cp?.accepted_payment_methods?.length) {
        acceptedPaymentMethods.value = cp.accepted_payment_methods
      }
    }
    // If submitted/under_review/approved/rejected, go to pending review page
    const status = appStore.application?.status
    if (status && !['draft', 'needs_info'].includes(status)) {
      await router.replace({ name: 'CleanerPendingReview' })
      return
    }
    if (status === 'needs_info') {
      requestedInfo.value = appStore.application?.requested_info ?? null
    }
  } catch (e) {
    stepError.value = toUserMessage(e, 'Failed to load application. Please refresh.')
  } finally {
    initLoading.value = false
  }
})

async function loadExistingDocs(applicationId: string) {
  const supabase = getSupabaseClient()
  const { data } = await supabase
    .from('cleaner_application_documents')
    .select('document_type')
    .eq('application_id', applicationId)

  for (const row of data ?? []) {
    if (row.document_type === 'id_document') uploadedDocs.value.id_document = true
    if (row.document_type === 'insurance_document') uploadedDocs.value.insurance_document = true
    if (row.document_type === 'dbs_document') uploadedDocs.value.dbs_document = true
  }
}

function validateFile(file: File): string | null {
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return 'Only JPEG, PNG, GIF, WebP, or PDF files are accepted.'
  }
  if (file.size > MAX_FILE_SIZE) {
    return `File is too large (${formatFileSize(file.size)}). Maximum size is 10 MB.`
  }
  return null
}

function onIdFileChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  const err = validateFile(file)
  if (err) { stepError.value = err; return }
  stepError.value = ''
  idFile.value = file
}

function onInsuranceFileChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  const err = validateFile(file)
  if (err) { stepError.value = err; return }
  stepError.value = ''
  insuranceFile.value = file
}

function onDbsFileChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  const err = validateFile(file)
  if (err) { stepError.value = err; return }
  stepError.value = ''
  dbsFile.value = file
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function prevStep() {
  if (step.value > 1) step.value--
  stepError.value = ''
}

async function handleNext() {
  if (!canNext.value) return
  stepError.value = ''
  uploading.value = true
  try {
    await uploadCurrentStep()
    step.value++
  } catch (e) {
    stepError.value = toUserMessage(e, 'Upload failed. Please try again.')
  } finally {
    uploading.value = false
  }
}

async function handleSubmit() {
  stepError.value = ''
  uploading.value = true
  try {
    await uploadCurrentStep()
    await appStore.submit()
    await router.replace({ name: 'CleanerPendingReview' })
  } catch (e) {
    stepError.value = toUserMessage(e, 'Submission failed. Please try again.')
  } finally {
    uploading.value = false
  }
}

async function uploadCurrentStep() {
  const userId = auth.userId
  const applicationId = appStore.application?.id
  if (!userId || !applicationId) throw new Error('Application not initialised.')

  if (step.value === 1 && idFile.value) {
    await uploadCleanerDocument(userId, idFile.value.name, idFile.value, applicationId, 'id_document')
    uploadedDocs.value.id_document = true
    idFile.value = null
  }
  if (step.value === 2 && insuranceFile.value) {
    await uploadCleanerDocument(userId, insuranceFile.value.name, insuranceFile.value, applicationId, 'insurance_document')
    uploadedDocs.value.insurance_document = true
    insuranceFile.value = null
  }
  if (step.value === 3 && dbsFile.value) {
    await uploadCleanerDocument(userId, dbsFile.value.name, dbsFile.value, applicationId, 'dbs_document')
    uploadedDocs.value.dbs_document = true
    dbsFile.value = null
  }
  if (step.value === 4 && acceptedPaymentMethods.value.length > 0) {
    const supabase = getSupabaseClient()
    const { error } = await supabase
      .from('cleaner_profiles')
      .update({ accepted_payment_methods: acceptedPaymentMethods.value })
      .eq('user_id', userId)
    if (error) throw new Error(error.message)
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

@keyframes spin {
  to { transform: rotate(360deg); }
}
.animate-spin {
  animation: spin 0.7s linear infinite;
}
</style>
