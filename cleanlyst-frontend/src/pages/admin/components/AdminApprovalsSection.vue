<template>
  <div class="bg-background text-on-surface antialiased">
    <main class="flex-grow p-6 lg:p-12 overflow-x-hidden max-w-7xl">
      <header class="mb-12">
        <h1 class="font-h1 text-h1 text-on-surface mb-2">Pending Cleaner Applications</h1>
        <p class="font-body text-body text-on-surface-variant max-w-2xl">
          Review and manage onboarding applications for new service providers.
        </p>
      </header>

      <!-- Search + Filters -->
      <section class="mb-8 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div class="relative w-full md:w-96">
          <span
            class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant"
            >search</span
          >
          <input
            v-model="searchQuery"
            class="w-full pl-10 pr-4 h-12 bg-surface-container-lowest border border-outline-variant rounded font-body text-body focus:border-primary focus:ring-0 outline-none"
            placeholder="Search by name or city..."
            type="text"
            aria-label="Search applications"
            autocomplete="off"
            @input="onSearchInput"
          />
        </div>

        <div class="flex gap-2 w-full md:w-auto">
          <select
            v-model="statusFilter"
            class="px-4 h-12 bg-surface-container-lowest border border-outline-variant font-label-md text-on-surface rounded hover:bg-surface-variant outline-none"
            @change="loadApplications"
          >
            <option value="">All Statuses</option>
            <option value="submitted">Submitted</option>
            <option value="under_review">Under Review</option>
            <option value="needs_info">Needs Info</option>
          </select>

          <select
            v-model="sortOrder"
            class="px-4 h-12 bg-surface-container-lowest border border-outline-variant font-label-md text-on-surface rounded hover:bg-surface-variant outline-none"
            @change="loadApplications"
          >
            <option value="desc">Latest First</option>
            <option value="asc">Oldest First</option>
          </select>
        </div>
      </section>

      <!-- Error -->
      <p v-if="errorMessage" class="mb-4 text-caption text-red-600">{{ errorMessage }}</p>

      <!-- Table -->
      <div
        class="bg-surface-container-lowest border border-outline-variant rounded-lg overflow-hidden"
      >
        <table class="w-full text-left border-collapse">
          <thead class="bg-surface-container-low border-b border-outline-variant">
            <tr>
              <th class="px-6 py-4 font-label-md text-label-md text-on-surface-variant">
                Cleaner Profile
              </th>
              <th class="px-6 py-4 font-label-md text-label-md text-on-surface-variant">
                Location & Date
              </th>
              <th
                class="px-6 py-4 font-label-md text-label-md text-on-surface-variant hidden lg:table-cell"
              >
                Documents
              </th>
              <th
                class="px-6 py-4 font-label-md text-label-md text-on-surface-variant hidden md:table-cell"
              >
                Status
              </th>
              <th class="px-6 py-4 font-label-md text-label-md text-on-surface-variant text-right">
                Actions
              </th>
            </tr>
          </thead>

          <tbody class="divide-y divide-outline-variant">
            <tr v-if="loading">
              <td colspan="5" class="px-6 py-12 text-center text-caption text-on-surface-variant">
                Loading applications…
              </td>
            </tr>
            <tr v-else-if="applications.length === 0">
              <td colspan="5" class="px-6 py-12 text-center text-caption text-on-surface-variant">
                No pending applications.
              </td>
            </tr>
            <tr
              v-else
              v-for="app in applications"
              :key="app.id"
              class="hover:bg-surface-container-low transition-colors"
            >
              <td class="px-6 py-6">
                <div class="flex items-center gap-4">
                  <div
                    class="w-12 h-12 rounded-full overflow-hidden bg-surface-container-high border border-outline-variant flex items-center justify-center"
                  >
                    <img
                      v-if="app.avatar_url"
                      :src="app.avatar_url"
                      :alt="app.full_name ?? ''"
                      class="w-full h-full object-cover"
                    />
                    <span v-else class="material-symbols-outlined text-on-surface-variant"
                      >person</span
                    >
                  </div>
                  <div>
                    <div class="font-body text-body text-on-surface">
                      {{ app.full_name ?? '—' }}
                    </div>
                    <div class="font-caption text-caption text-on-surface-variant">
                      {{ app.email ?? '—' }}
                    </div>
                  </div>
                </div>
              </td>

              <td class="px-6 py-6">
                <div class="font-body text-body text-on-surface">{{ app.city ?? '—' }}</div>
                <div class="font-caption text-caption text-on-surface-variant">
                  Applied: {{ formatDate(app.submitted_at ?? app.updated_at) }}
                </div>
              </td>

              <td class="px-6 py-6 hidden lg:table-cell">
                <div class="flex flex-col gap-1 text-caption">
                  <span :class="docPillClass(app.doc_id)">ID</span>
                  <span :class="docPillClass(app.doc_insurance)">Insurance</span>
                  <span :class="docPillClass(app.doc_dbs)">DBS</span>
                </div>
              </td>

              <td class="px-6 py-6 hidden md:table-cell">
                <span :class="['status-pill', statusPillClass(app.status)]">
                  {{ formatStatus(app.status) }}
                </span>
              </td>

              <td class="px-6 py-6 text-right">
                <div class="flex items-center justify-end gap-2">
                  <button
                    class="px-3 py-1.5 font-label-md text-on-surface bg-surface-container-lowest border border-outline-variant rounded hover:bg-surface-variant transition-colors"
                    @click="openReview(app)"
                  >
                    Review
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        <!-- Pagination -->
        <div
          class="px-6 py-4 bg-surface-container-low border-t border-outline-variant flex items-center justify-between"
        >
          <span class="font-caption text-caption text-on-surface-variant">
            Showing {{ applications.length }} of {{ totalCount }} applications
          </span>

          <div class="flex gap-2">
            <button
              class="p-1 border border-outline-variant bg-surface-container-lowest text-on-surface-variant disabled:opacity-40"
              :disabled="page === 1 || loading"
              @click="goToPage(page - 1)"
            >
              <span class="material-symbols-outlined">chevron_left</span>
            </button>

            <button
              class="p-1 border border-outline-variant bg-surface-container-lowest text-on-surface disabled:opacity-40"
              :disabled="applications.length < pageSize || loading"
              @click="goToPage(page + 1)"
            >
              <span class="material-symbols-outlined">chevron_right</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Summary Insights -->
      <section class="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div
          class="p-padding-card bg-surface-container-lowest border border-outline-variant rounded-lg"
        >
          <div class="font-caption text-caption text-on-surface-variant mb-2">Pending Total</div>
          <div class="font-h1 text-h1 text-on-surface">
            <span v-if="loading" class="animate-pulse">—</span>
            <span v-else>{{ totalCount }}</span>
          </div>
        </div>

        <div
          class="p-padding-card bg-surface-container-lowest border border-outline-variant rounded-lg"
        >
          <div class="font-caption text-caption text-on-surface-variant mb-2">Submitted</div>
          <div class="font-h1 text-h1 text-on-surface">{{ submittedCount }}</div>
        </div>

        <div
          class="p-padding-card bg-surface-container-lowest border border-outline-variant rounded-lg"
        >
          <div class="font-caption text-caption text-on-surface-variant mb-2">Under Review</div>
          <div class="font-h1 text-h1 text-on-surface">{{ underReviewCount }}</div>
        </div>
      </section>

      <!-- All Cleaners -->
      <AdminCleanerListSection />
    </main>

    <!-- Document Preview Modal -->
    <div v-if="docPreview" class="modal-backdrop doc-preview-backdrop" @click.self="docPreview = null" role="dialog" aria-modal="true" :aria-label="docPreview.fileName">
      <div class="doc-preview-box">
        <div class="modal-header">
          <h2 class="font-label-md text-label-md truncate mr-4">{{ docPreview.fileName }}</h2>
          <button class="modal-close" @click="docPreview = null" aria-label="Close document preview">
            <span class="material-symbols-outlined" aria-hidden="true">close</span>
          </button>
        </div>
        <div class="doc-preview-body">
          <img
            v-if="isImage(docPreview.mimeType)"
            :src="docPreview.url"
            :alt="docPreview.fileName"
            class="max-w-full max-h-full object-contain"
          />
          <iframe
            v-else-if="isPdf(docPreview.mimeType)"
            :src="docPreview.url"
            class="w-full h-full border-0"
            title="Document Preview"
          />
        </div>
      </div>
    </div>

    <!-- Review Modal -->
    <div v-if="reviewModal" class="modal-backdrop" @click.self="closeReview" role="dialog" aria-modal="true" aria-labelledby="review-modal-title">
      <div class="modal-box">
        <div class="modal-header">
          <h2 id="review-modal-title" class="font-h2 text-h2">Review Application</h2>
          <button class="modal-close" @click="closeReview">
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>

        <div class="modal-body">
          <div class="mb-4">
            <p class="font-label-md text-label-md">{{ reviewModal.full_name }}</p>
            <p class="text-caption text-on-surface-variant">{{ reviewModal.city ?? '—' }}</p>
            <p class="text-caption text-on-surface-variant mt-1">
              Submitted: {{ formatDate(reviewModal.submitted_at ?? reviewModal.updated_at) }}
            </p>
          </div>

          <!-- Document status in modal -->
          <div class="mb-4 border border-outline-variant rounded overflow-hidden">
            <p class="font-label-md text-label-md px-3 py-2 border-b border-outline-variant bg-surface-container-low">Documents</p>
            <div v-if="modalLoadingDocs" class="px-3 py-4 text-caption text-on-surface-variant text-center">
              Loading documents…
            </div>
            <div
              v-else
              v-for="entry in modalDocStatus"
              :key="entry.type"
              class="flex items-start justify-between gap-3 px-3 py-3 border-b border-outline-variant last:border-0"
            >
              <div class="min-w-0">
                <p class="font-label-sm text-label-sm text-on-surface">{{ entry.label }}</p>
                <template v-if="entry.doc">
                  <p class="text-caption text-on-surface-variant">
                    Uploaded: {{ formatDate(entry.doc.uploaded_at) }}
                  </p>
                  <p
                    class="text-caption font-medium"
                    :class="entry.doc.admin_verified ? 'text-green-700' : 'text-amber-700'"
                  >
                    {{ entry.doc.admin_verified ? 'Verified' : 'Pending Verification' }}
                  </p>
                </template>
                <p v-else class="text-caption text-on-surface-variant italic">No document uploaded</p>
              </div>
              <button
                v-if="entry.doc"
                class="shrink-0 px-3 py-1.5 font-label-md text-on-primary bg-primary rounded hover:opacity-90 transition-opacity disabled:opacity-50 whitespace-nowrap"
                :disabled="docPreviewLoading === entry.type"
                @click="viewDocument(entry.doc!)"
              >
                {{ docPreviewLoading === entry.type ? 'Loading…' : 'View Document' }}
              </button>
            </div>
          </div>
          <p v-if="docPreviewError" class="text-caption text-red-600 mb-3">{{ docPreviewError }}</p>

          <div class="mb-4">
            <label for="review-notes" class="block font-label-md text-label-md mb-1">
              Notes
              <span class="font-caption text-on-surface-variant ml-1"
                >(required for decline — min 10 chars)</span
              >
            </label>
            <textarea
              id="review-notes"
              v-model="reviewNotes"
              rows="3"
              class="w-full p-3 border border-outline-variant rounded font-body text-body focus:border-primary focus:ring-0 outline-none"
              placeholder="Optional for approve/request changes. Required reason for decline..."
            ></textarea>
          </div>

          <p v-if="reviewError" class="text-caption text-red-600 mb-3">{{ reviewError }}</p>
          <p v-if="reviewSuccess" class="text-caption text-green-700 mb-3">{{ reviewSuccess }}</p>

          <div class="flex gap-3">
            <button
              class="flex-1 py-3 bg-primary text-on-primary font-label-md hover:opacity-90 transition-opacity disabled:opacity-50"
              :disabled="!!reviewLoading"
              @click="submitReview('approved')"
            >
              {{ reviewLoading === 'approved' ? 'Approving…' : 'Approve' }}
            </button>
            <button
              class="flex-1 py-3 border border-outline-variant font-label-md hover:bg-surface-container transition-colors disabled:opacity-50"
              :disabled="!!reviewLoading"
              @click="submitReview('needs_info')"
            >
              {{ reviewLoading === 'needs_info' ? 'Requesting…' : 'Request Changes' }}
            </button>
            <button
              class="flex-1 py-3 border border-red-600 text-red-600 font-label-md hover:bg-red-50 transition-colors disabled:opacity-50"
              :disabled="!!reviewLoading"
              @click="submitReview('rejected')"
            >
              {{ reviewLoading === 'rejected' ? 'Declining…' : 'Decline' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { onMounted, ref } from 'vue'
import { requireSupabase } from '@/lib/supabase'
import { reviewCleanerApplication } from '@/services/adminService'
import AdminCleanerListSection from './AdminCleanerListSection.vue'
import { getSignedCleanerDocumentUrl } from '@/services/storageService'
import { formatDate, formatStatus, toUserMessage } from '@/utils/format'

interface CleanerApplicationQueryRow {
  id: string
  status: string
  submitted_at: string | null
  updated_at: string
  profiles?: {
    full_name?: string | null
    avatar_url?: string | null
    city?: string | null
  } | null
}

interface ApplicationRow {
  id: string
  status: string
  submitted_at: string | null
  updated_at: string
  full_name: string | null
  email: string | null
  avatar_url: string | null
  city: string | null
  doc_id: boolean
  doc_insurance: boolean
  doc_dbs: boolean
}

interface DocumentRecord {
  document_type: string
  file_path: string
  mime_type: string | null
  uploaded_at: string
  admin_verified: boolean
}

interface ModalDocStatus {
  type: string
  label: string
  doc: DocumentRecord | null
}

const loading = ref(false)
const errorMessage = ref('')
const searchQuery = ref('')
const statusFilter = ref('')
const sortOrder = ref<'asc' | 'desc'>('desc')
const page = ref(1)
const pageSize = 20
const totalCount = ref(0)
const submittedCount = ref(0)
const underReviewCount = ref(0)
const applications = ref<ApplicationRow[]>([])

const reviewModal = ref<ApplicationRow | null>(null)
const reviewNotes = ref('')
const reviewLoading = ref<string | null>(null)
const reviewError = ref('')
const reviewSuccess = ref('')
const modalDocStatus = ref<ModalDocStatus[]>([])
const modalLoadingDocs = ref(false)

const docPreview = ref<{ url: string; mimeType: string | null; fileName: string } | null>(null)
const docPreviewLoading = ref<string | null>(null)
const docPreviewError = ref('')

let searchTimeout: ReturnType<typeof setTimeout>

onMounted(() => loadApplications())

function onSearchInput() {
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    page.value = 1
    loadApplications()
  }, 350)
}

async function loadApplications() {
  loading.value = true
  errorMessage.value = ''
  try {
    const supabase = requireSupabase()

    const statuses = statusFilter.value
      ? [statusFilter.value]
      : ['submitted', 'under_review', 'needs_info']

    const isSearching = !!searchQuery.value.trim()
    let q = supabase
      .from('cleaner_applications')
      .select(
        `
        id,
        status,
        submitted_at,
        updated_at,
        profiles!cleaner_applications_cleaner_id_fkey (
          full_name,
          avatar_url,
          city
        )
      `,
        { count: 'exact' },
      )
      .in('status', statuses)
      .order('updated_at', { ascending: sortOrder.value === 'asc' })

    if (!isSearching) {
      q = q.range((page.value - 1) * pageSize, page.value * pageSize - 1)
    }

    const { data, error, count } = await q
    if (error) throw error

    const rows = (data ?? []) as CleanerApplicationQueryRow[]
    const appIds = rows.map((r) => r.id)

    // Bulk-fetch document types for all applications in this page
    const docMap = new Map<string, Set<string>>()
    if (appIds.length > 0) {
      const supabase = requireSupabase()
      const { data: docData } = await supabase
        .from('cleaner_application_documents')
        .select('application_id, document_type')
        .in('application_id', appIds)
      for (const d of docData ?? []) {
        if (!docMap.has(d.application_id)) docMap.set(d.application_id, new Set())
        docMap.get(d.application_id)!.add(d.document_type)
      }
    }

    applications.value = rows
      .map((row) => {
        const docTypes = docMap.get(row.id) ?? new Set<string>()
        return {
          id: row.id,
          status: row.status,
          submitted_at: row.submitted_at ?? null,
          updated_at: row.updated_at,
          full_name: row.profiles?.full_name ?? null,
          email: null,
          avatar_url: row.profiles?.avatar_url ?? null,
          city: row.profiles?.city ?? null,
          doc_id: docTypes.has('id_document'),
          doc_insurance: docTypes.has('insurance_document'),
          doc_dbs: docTypes.has('dbs_document'),
        }
      })
      .filter((app: ApplicationRow) => {
        if (!searchQuery.value) return true
        const q = searchQuery.value.toLowerCase()
        return app.full_name?.toLowerCase().includes(q) || app.city?.toLowerCase().includes(q)
      })

    totalCount.value = count ?? 0

    const [sCount, urCount] = await Promise.all([
      supabase
        .from('cleaner_applications')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'submitted'),
      supabase
        .from('cleaner_applications')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'under_review'),
    ])
    submittedCount.value = sCount.count ?? 0
    underReviewCount.value = urCount.count ?? 0
  } catch (e) {
    errorMessage.value = toUserMessage(e, 'Failed to load applications. Please refresh.')
  } finally {
    loading.value = false
  }
}

function goToPage(n: number) {
  page.value = n
  loadApplications()
}

function docPillClass(submitted: boolean): string {
  return submitted
    ? 'status-pill pill--completed'
    : 'status-pill pill--pending'
}

function statusPillClass(status: string): string {
  const map: Record<string, string> = {
    submitted: 'pill--pending',
    under_review: 'pill--active',
    needs_info: 'pill--warning',
    approved: 'pill--completed',
    rejected: 'pill--cancelled',
  }
  return map[status] ?? ''
}

async function openReview(app: ApplicationRow) {
  reviewModal.value = app
  reviewNotes.value = ''
  reviewError.value = ''
  reviewSuccess.value = ''
  modalDocStatus.value = [
    { type: 'id_document', label: 'Identity Document', doc: null },
    { type: 'insurance_document', label: 'Insurance Certificate', doc: null },
    { type: 'dbs_document', label: 'DBS Certificate', doc: null },
  ]
  modalLoadingDocs.value = true
  try {
    const supabase = requireSupabase()
    const { data } = await supabase
      .from('cleaner_application_documents')
      .select('document_type, file_path, mime_type, uploaded_at, admin_verified')
      .eq('application_id', app.id)
    const byType = new Map<string, DocumentRecord>()
    for (const d of data ?? []) byType.set(d.document_type, d as DocumentRecord)
    modalDocStatus.value = [
      { type: 'id_document', label: 'Identity Document', doc: byType.get('id_document') ?? null },
      { type: 'insurance_document', label: 'Insurance Certificate', doc: byType.get('insurance_document') ?? null },
      { type: 'dbs_document', label: 'DBS Certificate', doc: byType.get('dbs_document') ?? null },
    ]
  } catch {
    // non-fatal — show placeholders
  } finally {
    modalLoadingDocs.value = false
  }
}

function closeReview() {
  reviewModal.value = null
  reviewSuccess.value = ''
  docPreview.value = null
}

function fileNameFromPath(path: string): string {
  const last = path.split('/').pop() ?? path
  const dashIdx = last.indexOf('-')
  return dashIdx !== -1 ? last.slice(dashIdx + 1) : last
}

function isImage(mimeType: string | null): boolean {
  return ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(mimeType ?? '')
}

function isPdf(mimeType: string | null): boolean {
  return mimeType === 'application/pdf'
}

async function viewDocument(doc: DocumentRecord) {
  docPreviewLoading.value = doc.document_type
  docPreviewError.value = ''
  try {
    const url = await getSignedCleanerDocumentUrl(doc.file_path)
    const fileName = fileNameFromPath(doc.file_path)
    if (isImage(doc.mime_type) || isPdf(doc.mime_type)) {
      docPreview.value = { url, mimeType: doc.mime_type, fileName }
    } else {
      // unsupported — trigger download
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      a.rel = 'noopener noreferrer'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    }
  } catch (e) {
    docPreviewError.value = toUserMessage(e, 'Failed to load document. Please try again.')
  } finally {
    docPreviewLoading.value = null
  }
}

async function submitReview(action: 'approved' | 'rejected' | 'needs_info') {
  if (!reviewModal.value) return
  reviewLoading.value = action
  reviewError.value = ''
  reviewSuccess.value = ''
  const appId = reviewModal.value.id
  try {
    if (action === 'needs_info') {
      await reviewCleanerApplication(appId, action, undefined, reviewNotes.value || undefined)
      // Update the row in-place (stays in list under 'needs_info' status)
      const idx = applications.value.findIndex((a) => a.id === appId)
      const existing = applications.value[idx]
      if (idx !== -1 && existing !== undefined) {
        applications.value[idx] = { ...existing, status: 'needs_info' }
      }
      reviewSuccess.value = 'Changes requested — the cleaner has been notified.'
    } else {
      await reviewCleanerApplication(appId, action, reviewNotes.value || undefined)
      // Remove from list — approved/rejected applications leave the pending queue
      applications.value = applications.value.filter((a) => a.id !== appId)
      totalCount.value = Math.max(0, totalCount.value - 1)
      closeReview()
    }
  } catch (e) {
    reviewError.value = toUserMessage(e, 'Action failed. Please try again.')
  } finally {
    reviewLoading.value = null
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

.animate-pulse {
  animation: pulse 1.5s ease-in-out infinite;
}
@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.4;
  }
}

/* Status pills */
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

.pill--pending {
  background: #fff8e1;
  color: #e65100;
  border: 1px solid #ffcc80;
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
.pill--completed {
  background: #e8f5e9;
  color: #2e7d32;
  border: 1px solid #a5d6a7;
}
.pill--cancelled {
  background: #ffebee;
  color: #c62828;
  border: 1px solid #ef9a9a;
}

/* Modal */
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

.doc-preview-backdrop {
  z-index: 60;
}

.doc-preview-box {
  background: #ffffff;
  border-radius: 0.5rem;
  width: 100%;
  max-width: 56rem;
  height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.doc-preview-body {
  flex: 1;
  overflow: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: #f5f5f5;
}

.modal-box {
  background: #ffffff;
  border-radius: 0.5rem;
  width: 100%;
  max-width: 28rem;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
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
  overflow-y: auto;
  flex: 1;
}
</style>
