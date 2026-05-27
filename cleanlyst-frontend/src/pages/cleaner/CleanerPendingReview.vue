<template>
  <div class="bg-background text-on-background antialiased font-body min-h-screen">
    <main class="pt-24 pb-24 px-6 max-w-2xl mx-auto">

      <div v-if="loading" class="py-12 text-center text-caption text-on-surface-variant">
        Loading your application…
      </div>

      <template v-else>

        <!-- Declined state -->
        <template v-if="appStatus === 'rejected'">
          <div class="mb-10">
            <h1 class="font-h1 text-h1 text-primary mb-2">Application Declined</h1>
            <p class="font-body text-body text-on-surface-variant max-w-lg">
              Unfortunately, your application was not successful at this time.
            </p>
          </div>

          <div class="flex items-start gap-3 p-4 border border-red-300 bg-red-50 mb-8">
            <span class="material-symbols-outlined text-red-600 mt-0.5 flex-shrink-0">cancel</span>
            <div>
              <p class="font-label-md text-label-md text-red-900 mb-1">Reason for Decline</p>
              <p class="text-caption text-red-800">{{ application?.rejection_reason ?? 'No reason provided.' }}</p>
            </div>
          </div>

          <div class="flex items-start gap-3 p-4 border border-outline-variant bg-surface-container-low mb-8">
            <span class="material-symbols-outlined text-on-surface-variant mt-0.5">info</span>
            <p class="text-caption text-on-surface-variant">
              If you believe this was an error, please contact our support team for assistance.
            </p>
          </div>

          <div class="flex flex-col sm:flex-row gap-3">
            <button
              class="px-6 py-3 border border-outline-variant font-label-md text-on-surface-variant hover:bg-surface-container transition-colors"
              @click="handleLogout"
            >
              Logout
            </button>
          </div>
        </template>

        <!-- Changes requested (needs_info) state -->
        <template v-else-if="appStatus === 'needs_info'">
          <div class="mb-10">
            <h1 class="font-h1 text-h1 text-primary mb-2">Changes Requested</h1>
            <p class="font-body text-body text-on-surface-variant max-w-lg">
              Our team has reviewed your application and requires some changes before it can be approved.
            </p>
          </div>

          <div class="flex items-start gap-3 p-4 border border-amber-400 bg-amber-50 mb-8">
            <span class="material-symbols-outlined text-amber-700 mt-0.5 flex-shrink-0">warning</span>
            <div>
              <p class="font-label-md text-label-md text-amber-900 mb-1">Requested Changes</p>
              <p class="text-caption text-amber-800">{{ application?.requested_info ?? 'Please update your documents and resubmit.' }}</p>
            </div>
          </div>

          <!-- Application progress card -->
          <div class="border border-outline-variant bg-white p-6 space-y-6 mb-8">
            <div class="flex items-center justify-between">
              <h2 class="font-label-md text-label-md text-on-surface">Document Status</h2>
              <span class="status-pill pill--warning">Changes Requested</span>
            </div>
            <div class="space-y-4">
              <div class="flex items-center justify-between py-3 border-b border-outline-variant">
                <div class="flex items-center gap-3">
                  <span :class="['material-symbols-outlined text-base', docs.id_document ? 'text-green-600' : 'text-on-surface-variant']">
                    {{ docs.id_document ? 'check_circle' : 'radio_button_unchecked' }}
                  </span>
                  <span class="font-label-md text-label-md text-on-surface">Identity</span>
                </div>
                <span :class="['text-caption font-medium', docs.id_document ? 'text-green-700' : 'text-on-surface-variant']">
                  {{ docs.id_document ? 'Submitted' : 'Pending' }}
                </span>
              </div>
              <div class="flex items-center justify-between py-3 border-b border-outline-variant">
                <div class="flex items-center gap-3">
                  <span :class="['material-symbols-outlined text-base', docs.insurance_document ? 'text-green-600' : 'text-on-surface-variant']">
                    {{ docs.insurance_document ? 'check_circle' : 'radio_button_unchecked' }}
                  </span>
                  <span class="font-label-md text-label-md text-on-surface">Insurance</span>
                </div>
                <span :class="['text-caption font-medium', docs.insurance_document ? 'text-green-700' : 'text-on-surface-variant']">
                  {{ docs.insurance_document ? 'Submitted' : 'Pending' }}
                </span>
              </div>
              <div class="flex items-center justify-between py-3">
                <div class="flex items-center gap-3">
                  <span :class="['material-symbols-outlined text-base', docs.dbs_document ? 'text-green-600' : 'text-on-surface-variant']">
                    {{ docs.dbs_document ? 'check_circle' : 'radio_button_unchecked' }}
                  </span>
                  <span class="font-label-md text-label-md text-on-surface">DBS Check</span>
                </div>
                <span :class="['text-caption font-medium', docs.dbs_document ? 'text-green-700' : 'text-on-surface-variant']">
                  {{ docs.dbs_document ? 'Submitted' : 'Pending' }}
                </span>
              </div>
            </div>
          </div>

          <div class="flex flex-col sm:flex-row gap-3">
            <button
              class="px-6 py-3 bg-primary text-white font-label-md hover:opacity-90 transition-opacity"
              @click="goUpdateDocuments"
            >
              Update Documents
            </button>
            <button
              class="px-6 py-3 border border-outline-variant font-label-md text-on-surface-variant hover:bg-surface-container transition-colors"
              @click="handleLogout"
            >
              Logout
            </button>
          </div>
        </template>

        <!-- Under review / submitted state -->
        <template v-else>
          <div class="mb-10">
            <h1 class="font-h1 text-h1 text-primary mb-2">Application Under Review</h1>
            <p class="font-body text-body text-on-surface-variant max-w-lg">
              We're reviewing your submitted information.<br />
              You'll receive access to your cleaner dashboard once your application has been approved.
            </p>
          </div>

          <!-- Application progress card -->
          <div class="border border-outline-variant bg-white p-6 space-y-6 mb-8">
            <div class="flex items-center justify-between">
              <h2 class="font-label-md text-label-md text-on-surface">Application Progress</h2>
              <span class="status-pill pill--active">Under Review</span>
            </div>

            <div class="space-y-4">
              <div class="flex items-center justify-between py-3 border-b border-outline-variant">
                <div class="flex items-center gap-3">
                  <span :class="['material-symbols-outlined text-base', docs.id_document ? 'text-green-600' : 'text-on-surface-variant']">
                    {{ docs.id_document ? 'check_circle' : 'radio_button_unchecked' }}
                  </span>
                  <span class="font-label-md text-label-md text-on-surface">Identity</span>
                </div>
                <span :class="['text-caption font-medium', docs.id_document ? 'text-green-700' : 'text-on-surface-variant']">
                  {{ docs.id_document ? 'Submitted' : 'Pending' }}
                </span>
              </div>
              <div class="flex items-center justify-between py-3 border-b border-outline-variant">
                <div class="flex items-center gap-3">
                  <span :class="['material-symbols-outlined text-base', docs.insurance_document ? 'text-green-600' : 'text-on-surface-variant']">
                    {{ docs.insurance_document ? 'check_circle' : 'radio_button_unchecked' }}
                  </span>
                  <span class="font-label-md text-label-md text-on-surface">Insurance</span>
                </div>
                <span :class="['text-caption font-medium', docs.insurance_document ? 'text-green-700' : 'text-on-surface-variant']">
                  {{ docs.insurance_document ? 'Submitted' : 'Pending' }}
                </span>
              </div>
              <div class="flex items-center justify-between py-3">
                <div class="flex items-center gap-3">
                  <span :class="['material-symbols-outlined text-base', docs.dbs_document ? 'text-green-600' : 'text-on-surface-variant']">
                    {{ docs.dbs_document ? 'check_circle' : 'radio_button_unchecked' }}
                  </span>
                  <span class="font-label-md text-label-md text-on-surface">DBS Check</span>
                </div>
                <span :class="['text-caption font-medium', docs.dbs_document ? 'text-green-700' : 'text-on-surface-variant']">
                  {{ docs.dbs_document ? 'Submitted' : 'Pending' }}
                </span>
              </div>
            </div>

            <div v-if="application?.submitted_at" class="text-caption text-on-surface-variant pt-2 border-t border-outline-variant">
              Submitted on {{ formatDate(application.submitted_at) }}
            </div>
          </div>

          <!-- Info notice -->
          <div class="flex items-start gap-3 p-4 border border-outline-variant bg-surface-container-low mb-8">
            <span class="material-symbols-outlined text-on-surface-variant mt-0.5">info</span>
            <p class="text-caption text-on-surface-variant">
              Our team typically reviews applications within 2–3 business days. You'll be notified by email once your application has been processed.
            </p>
          </div>

          <!-- Actions -->
          <div class="flex flex-col sm:flex-row gap-3">
            <button
              class="px-6 py-3 border border-outline-variant font-label-md text-primary hover:bg-surface-container transition-colors"
              @click="showDetailsModal = true"
            >
              View Submitted Details
            </button>
            <button
              class="px-6 py-3 border border-outline-variant font-label-md text-on-surface-variant hover:bg-surface-container transition-colors"
              @click="handleLogout"
            >
              Logout
            </button>
          </div>
        </template>

      </template>
    </main>

    <!-- Submitted details modal -->
    <div v-if="showDetailsModal" class="modal-backdrop" @click.self="showDetailsModal = false">
      <div class="modal-box">
        <div class="modal-header">
          <h2 class="font-h2 text-h2">Submitted Documents</h2>
          <button class="modal-close" @click="showDetailsModal = false">
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>
        <div class="modal-body space-y-3">
          <div v-for="doc in submittedDocsList" :key="doc.type" class="flex items-center gap-3 py-2 border-b border-outline-variant last:border-0">
            <span class="material-symbols-outlined text-primary">description</span>
            <div>
              <p class="font-label-md text-label-md text-on-surface">{{ doc.label }}</p>
              <p class="text-caption text-on-surface-variant">{{ doc.fileName }}</p>
            </div>
            <span class="ml-auto text-caption text-green-700 font-medium">Submitted</span>
          </div>
          <p v-if="submittedDocsList.length === 0" class="text-caption text-on-surface-variant py-4 text-center">
            No documents found.
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useCleanerApplicationStore } from '@/stores/cleanerApplication'
import { getSupabaseClient } from '@/services/supabaseClient'
import { formatDate } from '@/utils/format'

const router = useRouter()
const auth = useAuthStore()
const appStore = useCleanerApplicationStore()

const loading = ref(true)
const showDetailsModal = ref(false)

interface DocStatus {
  id_document: boolean
  insurance_document: boolean
  dbs_document: boolean
}
const docs = ref<DocStatus>({
  id_document: false,
  insurance_document: false,
  dbs_document: false,
})

interface DocRow {
  document_type: string
  file_path: string
}
const docRows = ref<DocRow[]>([])

const application = computed(() => appStore.application)
const appStatus = computed(() => appStore.application?.status ?? null)

const submittedDocsList = computed(() => {
  const labels: Record<string, string> = {
    id_document: 'Identity Document',
    insurance_document: 'Insurance Certificate',
    dbs_document: 'DBS Certificate',
  }
  return docRows.value.map((d) => ({
    type: d.document_type,
    label: labels[d.document_type] ?? d.document_type,
    fileName: d.file_path.split('/').pop() ?? d.file_path,
  }))
})

onMounted(async () => {
  try {
    await appStore.load()
    if (!appStore.application) {
      await router.replace({ name: 'CleanerOnboarding' })
      return
    }
    // Draft means onboarding was never completed
    if (appStore.application.status === 'draft') {
      await router.replace({ name: 'CleanerOnboarding' })
      return
    }
    // Approved — grant dashboard access
    if (auth.cleanerProfile?.onboarding_complete) {
      await router.replace({ name: 'CleanerDashboard' })
      return
    }
    await loadDocs()
  } finally {
    loading.value = false
  }
})

async function loadDocs() {
  if (!appStore.application?.id) return
  const supabase = getSupabaseClient()
  const { data } = await supabase
    .from('cleaner_application_documents')
    .select('document_type, file_path')
    .eq('application_id', appStore.application.id)

  docRows.value = (data ?? []) as DocRow[]
  for (const row of docRows.value) {
    if (row.document_type === 'id_document') docs.value.id_document = true
    if (row.document_type === 'insurance_document') docs.value.insurance_document = true
    if (row.document_type === 'dbs_document') docs.value.dbs_document = true
  }
}

function goUpdateDocuments() {
  router.push({ name: 'CleanerOnboarding' })
}

async function handleLogout() {
  await auth.signOut()
  await router.replace({ name: 'Login' })
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

.status-pill {
  display: inline-block;
  border-radius: 999px;
  padding: 0.2rem 0.6rem;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  white-space: nowrap;
}

.pill--active {
  background: #e3f2fd;
  color: #1565c0;
  border: 1px solid #90caf9;
}

.pill--warning {
  background: #fff3e0;
  color: #bf360c;
  border: 1px solid #ffcc02;
}

.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
  padding: 1rem;
}

.modal-box {
  background: #ffffff;
  border-radius: 0.25rem;
  width: 100%;
  max-width: 28rem;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid var(--outline-variant, #c4c7c7);
}

.modal-close {
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--secondary, #5e5e5e);
  display: flex;
}

.modal-body {
  padding: 1.5rem;
}
</style>
