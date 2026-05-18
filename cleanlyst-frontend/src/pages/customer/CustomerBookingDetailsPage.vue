<template>
  <DashboardLayout :links="customerDashboardLinks" main-label="Booking details">
    <main class="page-main">
      <p v-if="errorMessage" class="error-msg">{{ errorMessage }}</p>

      <div v-if="loading && !booking" class="loading-state">
        <div class="loading-spinner"></div>
        <p class="loading-text">Loading booking…</p>
      </div>

      <div v-if="booking" class="details-grid">
        <!-- Booking Summary -->
        <section class="summary-card">
          <div class="summary-header">
            <div>
              <h1 class="header-title">
                {{ booking.service_title_snapshot ?? 'Cleaning Booking' }}
              </h1>
              <p class="header-copy">Your booking reference</p>
            </div>
            <span :class="['status-pill', statusClass(booking.status)]">
              {{ statusLabel(booking.status) }}
            </span>
          </div>

          <div class="summary-block">
            <h2 class="summary-title">When</h2>
            <p class="summary-text">{{ formatDate(booking.scheduled_start) }}</p>
            <p class="summary-sub">{{ timeRange(booking.scheduled_start, booking.scheduled_end) }}</p>
          </div>

          <div class="summary-block">
            <h2 class="summary-title">Where</h2>
            <p class="summary-text">{{ booking.location_text }}</p>
          </div>

          <div class="summary-block">
            <h2 class="summary-title">Notes</h2>
            <p class="summary-text">{{ booking.notes || 'No notes provided.' }}</p>
          </div>

          <div class="summary-meta-row">
            <div>
              <span class="meta-label">Price</span>
              <p class="summary-text">
                {{ booking.quote_cents != null ? formatPence(booking.quote_cents, booking.currency ?? 'GBP') : '—' }}
              </p>
            </div>
            <div>
              <span class="meta-label">Duration</span>
              <p class="summary-text">
                {{ booking.estimated_hours ? `${booking.estimated_hours}h` : 'TBC' }}
              </p>
            </div>
          </div>
        </section>

        <!-- Actions -->
        <section class="actions-card">
          <div class="section-header">
            <h2 class="section-title">Actions</h2>
          </div>

          <div class="action-group">
            <button
              v-if="booking.status === 'completion_pending_customer'"
              type="button"
              class="btn-primary"
              :disabled="actionLoading"
              @click="confirmComplete"
            >
              {{ actionLoading && activeAction === 'complete' ? 'Completing…' : 'Confirm Complete' }}
            </button>

            <button
              v-if="canCancel"
              type="button"
              class="btn-danger"
              :disabled="actionLoading"
              @click="cancelBooking"
            >
              {{ actionLoading && activeAction === 'cancel' ? 'Cancelling…' : 'Cancel Booking' }}
            </button>

            <div
              v-if="!canCancel && booking.status !== 'completion_pending_customer' && !isTerminal(booking.status)"
              class="status-info"
            >
              <span class="material-symbols-outlined status-info-icon">info</span>
              {{ statusInfo(booking.status) }}
            </div>
          </div>

          <div class="action-footer">
            <p class="footer-copy">Status: {{ statusLabel(booking.status) }}</p>
            <p v-if="successMessage" class="success-text">{{ successMessage }}</p>
          </div>

          <router-link :to="{ name: 'CustomerDashboard' }" class="back-link">
            <span class="material-symbols-outlined">arrow_back</span>
            Back to Dashboard
          </router-link>
        </section>
      </div>

      <!-- Chat Panel -->
      <section v-if="booking" class="chat-panel">
        <div class="section-header">
          <h2 class="section-title">Messages</h2>
          <span class="meta-label">Chat with your cleaner</span>
        </div>

        <div class="messages-box" ref="messagesContainer">
          <template v-if="messages.length === 0">
            <p class="empty-desc">No messages yet. Send a note to coordinate with your cleaner.</p>
          </template>
          <article v-for="msg in messages" :key="msg.id" class="message-item">
            <div
              :class="[
                'message-bubble',
                msg.sender_id === auth.userId ? 'message-bubble--mine' : 'message-bubble--theirs',
              ]"
            >
              <p class="message-text">{{ msg.message }}</p>
              <div class="message-footer">
                <time class="message-time">{{ formatDateTime(msg.created_at) }}</time>
                <span v-if="msg.sender_id === auth.userId && msg.status" class="message-status" :class="`message-status--${msg.status}`">
                  {{ msg.status === 'sending' ? 'Sending…' : msg.status === 'failed' ? 'Failed' : '' }}
                </span>
              </div>
            </div>
          </article>
        </div>

        <form class="message-form" @submit.prevent="sendMessage">
          <textarea
            v-model="messageDraft"
            rows="3"
            placeholder="Write a message..."
            class="message-input"
            :disabled="messageSending"
          />
          <div class="message-actions">
            <p v-if="messageError" class="error-text">{{ messageError }}</p>
            <button
              type="submit"
              class="btn-primary"
              :disabled="messageSending || !messageDraft.trim()"
            >
              {{ messageSending ? 'Sending…' : 'Send message' }}
            </button>
          </div>
        </form>
      </section>
    </main>
  </DashboardLayout>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useMessagesStore } from '@/stores/messages'
import DashboardLayout from '@/layouts/DashboardLayout.vue'
import { customerDashboardLinks } from '@/pages/dasboardLinks'
import { getSupabaseClient } from '@/services/supabaseClient'
import {
  getBookingById,
  transitionBookingState,
  type BookingDetailRow,
} from '@/services/bookingService'
import { formatDate, formatDateTime, formatPence } from '@/utils/format'
import { cancelBooking as cancelBookingRequest } from '@/services/bookingService'

const auth = useAuthStore()
const messagesStore = useMessagesStore()
const route = useRoute()
const bookingId = String(route.params.bookingId ?? '')

const booking = ref<BookingDetailRow | null>(null)
const loading = ref(true)
const actionLoading = ref(false)
const activeAction = ref<string | null>(null)
const messageDraft = ref('')
const messageSending = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const messageError = ref('')
const messagesContainer = ref<HTMLElement | null>(null)
const statusChannel = ref<ReturnType<typeof getSupabaseClient>['channel'] | null>(null)

const messages = computed(() => messagesStore.byBooking[bookingId] ?? [])

const canCancel = computed(() =>
  ['pending_request', 'estimate_proposed'].includes(booking.value?.status ?? ''),
)

function isTerminal(status: string): boolean {
  return ['completed', 'cancelled', 'cleaner_declined', 'disputed', 'refunded'].includes(status)
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    pending_request: 'Pending Approval',
    estimate_proposed: 'Accepted',
    awaiting_customer_payment: 'Awaiting Payment',
    payment_authorized: 'Confirmed',
    in_progress: 'In Progress',
    completion_pending_customer: 'Awaiting Your Confirmation',
    completed: 'Completed',
    cancelled: 'Cancelled',
    cleaner_declined: 'Declined',
    disputed: 'Disputed',
    refunded: 'Refunded',
  }
  return map[status] ?? status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function statusInfo(status: string): string {
  const map: Record<string, string> = {
    payment_authorized: 'Your cleaner will start soon.',
    in_progress: 'Cleaning is in progress.',
  }
  return map[status] ?? ''
}

function statusClass(status: string): string {
  if (status === 'completed') return 'status-pill--completed'
  if (['in_progress', 'payment_authorized'].includes(status)) return 'status-pill--active'
  if (['pending_request', 'estimate_proposed'].includes(status)) return 'status-pill--pending'
  if (['completion_pending_customer'].includes(status)) return 'status-pill--warning'
  return 'status-pill--cancelled'
}

function timeRange(start: string, end: string | null | undefined): string {
  if (!end) return 'Duration TBC'
  const s = new Date(start)
  const e = new Date(end)
  if (Number.isNaN(s.valueOf()) || Number.isNaN(e.valueOf())) return '—'
  const fmt = (d: Date) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return `${fmt(s)} — ${fmt(e)}`
}

async function refreshBooking() {
  loading.value = true
  errorMessage.value = ''
  try {
    const data = await getBookingById(bookingId)
    if (!data) throw new Error('Booking not found.')
    booking.value = data
  } catch (e) {
    errorMessage.value = e instanceof Error ? e.message : 'Failed to load booking.'
  } finally {
    loading.value = false
  }
}

async function confirmComplete() {
  if (!booking.value) return
  actionLoading.value = true
  activeAction.value = 'complete'
  successMessage.value = ''
  errorMessage.value = ''
  try {
    await transitionBookingState(bookingId, 'completed')
    successMessage.value = 'Booking marked as completed.'
    await refreshBooking()
  } catch (e) {
    errorMessage.value = e instanceof Error ? e.message : 'Failed to complete booking.'
  } finally {
    actionLoading.value = false
    activeAction.value = null
  }
}

async function cancelBooking() {
  if (!booking.value) return
  actionLoading.value = true
  activeAction.value = 'cancel'
  successMessage.value = ''
  errorMessage.value = ''
  try {
    await cancelBookingRequest(bookingId)
    successMessage.value = 'Booking cancelled.'
    await refreshBooking()
  } catch (e) {
    errorMessage.value = e instanceof Error ? e.message : 'Failed to cancel booking.'
  } finally {
    actionLoading.value = false
    activeAction.value = null
  }
}

async function sendMessage() {
  if (!booking.value || !messageDraft.value.trim() || !auth.userId) return
  messageSending.value = true
  messageError.value = ''
  const text = messageDraft.value.trim()
  messageDraft.value = ''
  try {
    await messagesStore.sendMessage(bookingId, auth.userId, text)
    await nextTick()
    scrollToBottom()
  } catch (e) {
    messageError.value = e instanceof Error ? e.message : 'Failed to send message.'
  } finally {
    messageSending.value = false
  }
}

function scrollToBottom() {
  nextTick(() => {
    if (!messagesContainer.value) return
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  })
}

watch(
  () => messages.value.length,
  () => scrollToBottom(),
)

onMounted(async () => {
  await auth.init()
  await refreshBooking()
  await messagesStore.loadBookingMessages(bookingId)
  messagesStore.subscribeToBookingMessages(bookingId)

  const supabase = getSupabaseClient()
  const ch = supabase
    .channel(`customer-booking-status-${bookingId}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'bookings', filter: `id=eq.${bookingId}` },
      async () => { await refreshBooking() },
    )
    .subscribe()
  statusChannel.value = ch as any
})

onBeforeUnmount(() => {
  if (statusChannel.value) {
    const supabase = getSupabaseClient()
    supabase.removeChannel(statusChannel.value as any)
  }
  messagesStore.unsubscribeFromBookingMessages(bookingId)
})
</script>

<style scoped>
.material-symbols-outlined {
  font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
  display: inline-block;
  line-height: 1;
  text-transform: none;
  letter-spacing: normal;
  word-wrap: normal;
  white-space: nowrap;
  direction: ltr;
}

.page-main {
  padding: 2rem 1.5rem 5rem;
  max-width: 80rem;
  margin: 0 auto;
  min-height: 100vh;
}

@media (min-width: 1024px) {
  .page-main { padding-left: 3rem; padding-right: 3rem; }
}

.error-msg {
  font-size: 14px;
  font-weight: 500;
  color: #ba1a1a;
  background: #ffdad6;
  border: 1px solid #ba1a1a;
  border-radius: 0.25rem;
  padding: 0.75rem 1rem;
  margin-bottom: 1.5rem;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 4rem 0;
}

.loading-spinner {
  width: 2rem;
  height: 2rem;
  border: 2px solid var(--outline-variant, #c4c7c7);
  border-top-color: var(--primary, #000000);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

.loading-text {
  font-size: 16px;
  color: var(--secondary, #5e5e5e);
}

.details-grid {
  display: grid;
  gap: 1.5rem;
  margin-bottom: 2rem;
}

@media (min-width: 1024px) {
  .details-grid { grid-template-columns: 2fr 1fr; }
}

.summary-card,
.actions-card,
.chat-panel {
  background: #ffffff;
  border: 1px solid var(--outline-variant, #c4c7c7);
  padding: 1.5rem;
}

.summary-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.header-title {
  font-size: 24px;
  font-weight: 700;
  margin: 0 0 0.25rem;
  color: var(--primary, #000000);
}

.header-copy {
  font-size: 14px;
  color: var(--secondary, #5e5e5e);
  margin: 0;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.section-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--primary, #000000);
  margin: 0;
}

.summary-block {
  margin-bottom: 1.25rem;
  padding-bottom: 1.25rem;
  border-bottom: 1px solid var(--surface-variant, #e2e2e2);
}

.summary-block:last-of-type { border-bottom: none; }

.summary-title {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--secondary, #5e5e5e);
  margin: 0 0 0.5rem;
}

.summary-text {
  font-size: 15px;
  color: var(--primary, #000000);
  margin: 0 0 0.25rem;
}

.summary-sub {
  font-size: 13px;
  color: var(--secondary, #5e5e5e);
  margin: 0;
}

.summary-meta-row {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
  margin-top: 1.25rem;
}

.meta-label {
  display: block;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--secondary, #5e5e5e);
  margin-bottom: 0.25rem;
}

/* Status pills */
.status-pill {
  border-radius: 999px;
  padding: 0.25rem 0.75rem;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  white-space: nowrap;
  flex-shrink: 0;
}

.status-pill--pending { background: #fff8e1; color: #e65100; border: 1px solid #ffcc80; }
.status-pill--active { background: #e3f2fd; color: #1565c0; border: 1px solid #90caf9; }
.status-pill--warning { background: #fff3e0; color: #e65100; border: 1px solid #ffcc02; }
.status-pill--completed { background: #e8f5e9; color: #2e7d32; border: 1px solid #a5d6a7; }
.status-pill--cancelled { background: #ffebee; color: #c62828; border: 1px solid #ef9a9a; }

/* Actions */
.action-group {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.action-footer {
  border-top: 1px solid var(--surface-variant, #e2e2e2);
  padding-top: 1rem;
}

.footer-copy {
  font-size: 13px;
  color: var(--secondary, #5e5e5e);
  margin: 0;
}

.success-text {
  margin-top: 0.5rem;
  color: #2e7d32;
  font-weight: 600;
  font-size: 14px;
}

.status-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 13px;
  color: var(--secondary, #5e5e5e);
  background: var(--surface-container, #eeeeee);
  padding: 0.75rem 1rem;
}

.status-info-icon { font-size: 1rem; }

.back-link {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 14px;
  color: var(--secondary, #5e5e5e);
  text-decoration: none;
  margin-top: 1.5rem;
}

.back-link:hover { color: var(--primary, #000000); }
.back-link .material-symbols-outlined { font-size: 1rem; }

/* Buttons */
.btn-primary {
  padding: 0.75rem 1.25rem;
  background: var(--primary, #000000);
  color: #ffffff;
  font-size: 14px;
  font-weight: 500;
  border: none;
  cursor: pointer;
  width: 100%;
  text-align: center;
  transition: opacity 0.15s;
}

.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-primary:not(:disabled):hover { opacity: 0.85; }

.btn-danger {
  padding: 0.75rem 1.25rem;
  background: transparent;
  color: #ba1a1a;
  font-size: 14px;
  font-weight: 500;
  border: 1px solid #ba1a1a;
  cursor: pointer;
  width: 100%;
  transition: background-color 0.15s;
}

.btn-danger:not(:disabled):hover { background: #ffebee; }
.btn-danger:disabled { opacity: 0.6; cursor: not-allowed; }

/* Chat */
.chat-panel {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-top: 0;
}

.messages-box {
  min-height: 16rem;
  max-height: 30rem;
  overflow-y: auto;
  padding: 1rem;
  border: 1px solid var(--outline-variant, #c4c7c7);
  background: #f8fafc;
}

.message-item { margin-bottom: 0.75rem; display: flex; }

.message-bubble {
  display: inline-flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.75rem 1rem;
  background: #ffffff;
  border: 1px solid var(--outline-variant, #c4c7c7);
  max-width: min(85%, 28rem);
}

.message-bubble--mine {
  margin-left: auto;
  background: var(--primary, #000000);
  color: #ffffff;
  border-color: var(--primary, #000000);
}

.message-bubble--theirs { margin-right: auto; }

.message-text { margin: 0; font-size: 14px; line-height: 1.5; }

.message-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.message-time {
  font-size: 11px;
  color: var(--secondary, #5e5e5e);
}

.message-bubble--mine .message-time { color: rgba(255, 255, 255, 0.6); }

.message-status { font-size: 11px; }
.message-status--sending { color: rgba(255, 255, 255, 0.6); }
.message-status--failed { color: #ffcdd2; font-weight: 600; }

.empty-desc {
  font-size: 14px;
  color: var(--secondary, #5e5e5e);
  text-align: center;
  padding: 2rem 0;
}

.message-form { display: grid; gap: 0.75rem; }

.message-input {
  width: 100%;
  border: 1px solid var(--outline-variant, #c4c7c7);
  padding: 0.75rem 1rem;
  font-size: 14px;
  color: var(--primary, #000000);
  background: #ffffff;
  resize: vertical;
  font-family: inherit;
  box-sizing: border-box;
}

.message-input:focus { outline: none; border-color: var(--primary, #000000); }

.message-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}

.error-text { color: #ba1a1a; font-size: 13px; margin: 0; }

.message-actions .btn-primary {
  width: auto;
  padding: 0.5rem 1.25rem;
}
</style>
