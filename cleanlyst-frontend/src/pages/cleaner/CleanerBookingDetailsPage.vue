<template>
  <DashboardLayout :links="cleanerDashboardLinks" main-label="Booking details">
    <main class="page-main">
      <p v-if="errorMessage" class="error-msg">{{ errorMessage }}</p>

      <div v-if="loading && !booking" class="loading-state">
        <div class="loading-spinner"></div>
        <p class="loading-text">Loading booking…</p>
      </div>

      <div v-if="booking" class="details-grid">
        <section class="booking-summary-card">
          <div class="summary-header">
            <div>
              <h1 class="header-title">
                {{ booking.service_title_snapshot ?? 'Cleaning booking' }}
              </h1>
              <p class="header-copy">Booking for {{ booking.customer?.full_name ?? 'Customer' }}</p>
            </div>
            <span :class="['status-pill', statusClass(booking.status)]">{{
              formatStatusLabel(booking.status)
            }}</span>
          </div>

          <div class="summary-block">
            <h2 class="summary-title">Customer</h2>
            <div class="customer-row">
              <div class="avatar-placeholder">
                <span class="material-symbols-outlined">person</span>
              </div>
              <div>
                <p class="summary-text">{{ booking.customer?.full_name ?? '—' }}</p>
                <p class="summary-sub">
                  {{ booking.customer?.avatar_url ? 'Has profile image' : 'No avatar available' }}
                </p>
              </div>
            </div>
          </div>

          <div class="summary-block">
            <h2 class="summary-title">When</h2>
            <p class="summary-text">{{ formatDate(booking.scheduled_start) }}</p>
            <p class="summary-sub">
              {{ orderTimeRange(booking.scheduled_start, booking.scheduled_end) }}
            </p>
          </div>

          <div class="summary-block">
            <h2 class="summary-title">Where</h2>
            <p class="summary-text">{{ booking.location_text }}</p>
          </div>

          <div class="summary-block">
            <h2 class="summary-title">About this job</h2>
            <p class="summary-text">{{ booking.notes || 'No notes provided.' }}</p>
          </div>

          <div class="summary-meta-row">
            <div>
              <span class="meta-label">Estimate</span>
              <p class="summary-text">
                {{ booking.estimated_hours ? `${booking.estimated_hours}h` : 'Not set' }}
              </p>
            </div>
            <div>
              <span class="meta-label">Earnings</span>
              <p class="summary-text">
                {{
                  booking.cleaner_payout_cents != null
                    ? formatPence(booking.cleaner_payout_cents, booking.currency ?? 'GBP')
                    : '—'
                }}
              </p>
            </div>
          </div>
        </section>

        <section class="booking-actions-card">
          <div class="section-header">
            <h2 class="section-title">Booking actions</h2>
          </div>

          <div class="action-group">
            <button
              v-if="booking.status === 'pending_request'"
              type="button"
              class="btn-start"
              :disabled="actionLoading"
              @click="acceptBooking"
            >
              {{ actionLoading && activeAction === 'accept' ? 'Accepting…' : 'Accept booking' }}
            </button>
            <button
              v-if="booking.status === 'pending_request'"
              type="button"
              class="btn-decline"
              :disabled="actionLoading"
              @click="declineBooking"
            >
              {{ actionLoading && activeAction === 'decline' ? 'Declining…' : 'Decline booking' }}
            </button>

            <button
              v-if="
                booking.status === 'payment_authorized' &&
                !isWithinStartWindow(booking) &&
                !isAfterStart(booking)
              "
              type="button"
              class="btn-secondary"
              disabled
            >
              Available in {{ countdownText(booking.scheduled_start) }}
            </button>
            <button
              v-if="booking.status === 'payment_authorized' && isWithinStartWindow(booking)"
              type="button"
              class="btn-start"
              :disabled="actionLoading"
              @click="startCleaning"
            >
              {{ actionLoading && activeAction === 'start' ? 'Starting…' : 'Start Cleaning' }}
            </button>
            <button
              v-if="booking.status === 'in_progress'"
              type="button"
              class="btn-start"
              :disabled="actionLoading"
              @click="endJob"
            >
              {{ actionLoading && activeAction === 'end' ? 'Ending…' : 'End Job' }}
            </button>
            <button
              v-if="booking.status === 'payment_authorized' && isAfterStart(booking)"
              type="button"
              class="btn-secondary"
              disabled
            >
              Cleaning In Progress
            </button>
            <button
              v-if="
                booking.status === 'estimate_proposed' ||
                booking.status === 'awaiting_customer_payment'
              "
              type="button"
              class="btn-secondary"
              disabled
            >
              Awaiting customer payment
            </button>

            <button type="button" class="btn-action" @click="editModalOpen = true">
              Edit booking
            </button>
          </div>

          <div class="action-summary">
            <p class="summary-copy">Current status: {{ formatStatusLabel(booking.status) }}</p>
            <p v-if="successMessage" class="success-text">{{ successMessage }}</p>
          </div>
        </section>
      </div>

      <section v-if="booking" class="chat-panel">
        <div class="section-header">
          <h2 class="section-title">Messages</h2>
          <span class="meta-label">You and the customer can chat here.</span>
        </div>

        <div class="messages-box" ref="messagesContainer">
          <template v-if="messages.length === 0">
            <p class="empty-desc">
              No messages yet. Send the first note to coordinate with the customer.
            </p>
          </template>
          <article v-for="message in messages" :key="message.id" class="message-item">
            <div
              :class="[
                'message-bubble',
                message.sender_id === auth.userId ? 'message-bubble--mine' : '',
              ]"
            >
              <p class="message-text">{{ message.message }}</p>
              <time class="message-time">{{ formatDateTime(message.created_at) }}</time>
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
              class="btn-start"
              :disabled="messageSending || !messageDraft.trim()"
            >
              {{ messageSending ? 'Sending…' : 'Send message' }}
            </button>
          </div>
        </form>
      </section>

      <AppModal v-model="editModalOpen" title="Edit booking details" size="md">
        <div class="modal-field">
          <label class="modal-label" for="estimatedHours">Duration (hours)</label>
          <input
            id="estimatedHours"
            type="number"
            min="0"
            step="0.5"
            class="modal-input"
            v-model.number="editEstimatedHours"
          />
        </div>
        <div class="modal-field">
          <label class="modal-label" for="bookingNotes">Notes</label>
          <textarea id="bookingNotes" rows="4" class="modal-textarea" v-model="editNotes" />
        </div>
        <template #footer>
          <button type="button" class="btn-action" @click="editModalOpen = false">Cancel</button>
          <button
            type="button"
            class="btn-start"
            :disabled="savingBooking || !booking"
            @click="saveBookingDetails"
          >
            {{ savingBooking ? 'Saving…' : 'Save changes' }}
          </button>
        </template>
      </AppModal>
    </main>
  </DashboardLayout>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useMessagesStore } from '@/stores/messages'
import DashboardLayout from '@/layouts/DashboardLayout.vue'
import { cleanerDashboardLinks } from '@/pages/dasboardLinks'
import AppModal from '@/components/ui/AppModal.vue'
import { getSupabaseClient } from '@/services/supabaseClient'
import type { RealtimeSubscription } from '@/lib/realtime'
import {
  getBookingById,
  updateBookingDetails,
  transitionBookingState,
  type BookingDetailRow,
} from '@/services/bookingService'
import { formatDate, formatDateTime, formatPence, formatStatus } from '@/utils/format'

const auth = useAuthStore()
const messagesStore = useMessagesStore()
const route = useRoute()
const bookingId = String(route.params.bookingId ?? '')
const booking = ref<BookingDetailRow | null>(null)
const loading = ref(true)
const actionLoading = ref(false)
const savingBooking = ref(false)
const activeAction = ref<string | null>(null)
const editModalOpen = ref(false)
const editEstimatedHours = ref<number | null>(null)
const editNotes = ref<string | null>(null)
const messageDraft = ref('')
const messageSending = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const messageError = ref('')
const messagesContainer = ref<HTMLElement | null>(null)
const statusChannel = ref<RealtimeSubscription | null>(null)
const paymentsChannel = ref<RealtimeSubscription | null>(null)

const messages = computed(() => messagesStore.byBooking[bookingId] ?? [])

function formatStatusLabel(value: string): string {
  if (value === 'payment_authorized') return 'Paid'
  if (value === 'estimate_proposed') return 'Accepted'
  if (value === 'pending_request') return 'Incoming request'
  if (value === 'completion_pending_customer') return 'Awaiting customer confirmation'
  if (value === 'cleaner_declined') return 'Declined'
  return formatStatus(value)
}

function statusClass(status: string) {
  if (status === 'completed') return 'status-pill--completed'
  if (status === 'in_progress') return 'status-pill--active'
  if (status === 'pending_request' || status === 'estimate_proposed') return 'status-pill--pending'
  if (status === 'cancelled' || status === 'cleaner_declined' || status === 'refunded')
    return 'status-pill--cancelled'
  return 'status-pill--active'
}

function orderTimeRange(start: string, end: string | null) {
  if (!end) return 'Duration not set'
  const startDate = new Date(start)
  const endDate = new Date(end)
  if (Number.isNaN(startDate.valueOf()) || Number.isNaN(endDate.valueOf()))
    return 'Duration not available'
  return `${startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} — ${endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
}

function countdownText(startValue: string) {
  const start = new Date(startValue)
  const diffMs = start.getTime() - Date.now()
  if (diffMs <= 0) return '0m'
  const minutes = Math.floor(diffMs / 60000)
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  if (hours > 0) return `${hours}h ${remainingMinutes}m`
  return `${remainingMinutes}m`
}

function isWithinStartWindow(currentBooking: BookingDetailRow) {
  const start = new Date(currentBooking.scheduled_start).getTime()
  const now = Date.now()
  return (
    currentBooking.status === 'payment_authorized' && now >= start - 30 * 60 * 1000 && now <= start
  )
}

function isAfterStart(currentBooking: BookingDetailRow) {
  const start = new Date(currentBooking.scheduled_start).getTime()
  return Date.now() > start
}

async function refreshBooking() {
  loading.value = true
  errorMessage.value = ''
  successMessage.value = ''
  try {
    const data = await getBookingById(bookingId)
    if (!data) {
      throw new Error('Booking not found.')
    }
    booking.value = data
    editEstimatedHours.value = booking.value.estimated_hours
    editNotes.value = booking.value.notes
  } catch (e) {
    errorMessage.value = e instanceof Error ? e.message : 'Failed to load booking.'
  } finally {
    loading.value = false
  }
}

async function acceptBooking() {
  if (!booking.value) return
  actionLoading.value = true
  activeAction.value = 'accept'
  errorMessage.value = ''
  successMessage.value = ''
  try {
    await transitionBookingState(bookingId, 'estimate_proposed')
    successMessage.value = 'Booking accepted'
    await refreshBooking()
  } catch (e) {
    errorMessage.value = e instanceof Error ? e.message : 'Failed to accept booking.'
  } finally {
    actionLoading.value = false
    activeAction.value = null
  }
}

async function declineBooking() {
  if (!booking.value) return
  actionLoading.value = true
  activeAction.value = 'decline'
  errorMessage.value = ''
  successMessage.value = ''
  try {
    await transitionBookingState(bookingId, 'cleaner_declined')
    successMessage.value = 'Booking declined'
    await refreshBooking()
  } catch (e) {
    errorMessage.value = e instanceof Error ? e.message : 'Failed to decline booking.'
  } finally {
    actionLoading.value = false
    activeAction.value = null
  }
}

async function startCleaning() {
  if (!booking.value) return
  actionLoading.value = true
  activeAction.value = 'start'
  errorMessage.value = ''
  successMessage.value = ''
  try {
    await transitionBookingState(bookingId, 'in_progress')
    successMessage.value = 'Cleaning Started'
    await refreshBooking()
  } catch (e) {
    errorMessage.value = e instanceof Error ? e.message : 'Failed to start cleaning.'
  } finally {
    actionLoading.value = false
    activeAction.value = null
  }
}

async function endJob() {
  if (!booking.value) return
  actionLoading.value = true
  activeAction.value = 'end'
  errorMessage.value = ''
  successMessage.value = ''
  try {
    await transitionBookingState(bookingId, 'completion_pending_customer')
    successMessage.value = 'Work completed. Awaiting customer confirmation.'
    await refreshBooking()
  } catch (e) {
    errorMessage.value = e instanceof Error ? e.message : 'Failed to end job.'
  } finally {
    actionLoading.value = false
    activeAction.value = null
  }
}

async function saveBookingDetails() {
  if (!booking.value) return
  savingBooking.value = true
  errorMessage.value = ''
  successMessage.value = ''
  try {
    await updateBookingDetails(bookingId, {
      notes: editNotes.value ?? null,
      estimated_hours: editEstimatedHours.value ?? null,
    })
    editModalOpen.value = false
    successMessage.value = 'Changes Saved'
    await refreshBooking()
  } catch (e) {
    errorMessage.value = e instanceof Error ? e.message : 'Failed to save booking.'
  } finally {
    savingBooking.value = false
  }
}

async function sendMessage() {
  if (!booking.value || !messageDraft.value.trim() || !auth.userId) return
  messageSending.value = true
  messageError.value = ''
  try {
    await messagesStore.sendMessage(bookingId, auth.userId, messageDraft.value.trim())
    messageDraft.value = ''
    await nextTick()
    scrollMessagesToBottom()
  } catch (e) {
    messageError.value = e instanceof Error ? e.message : 'Failed to send message.'
  } finally {
    messageSending.value = false
  }
}

function scrollMessagesToBottom() {
  nextTick(() => {
    if (!messagesContainer.value) return
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  })
}

watch(
  () => messages.value.length,
  () => {
    scrollMessagesToBottom()
  },
)

onMounted(async () => {
  await auth.init()
  await refreshBooking()
  await messagesStore.loadBookingMessages(bookingId)
  messagesStore.subscribeToBookingMessages(bookingId)

  const supabase = getSupabaseClient()
  statusChannel.value = supabase
    .channel(`booking-status-${bookingId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'bookings',
        filter: `id=eq.${bookingId}`,
      },
      async () => {
        await refreshBooking()
      },
    )
    .subscribe()

  paymentsChannel.value = supabase
    .channel(`booking-payments-${bookingId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'payments',
        filter: `booking_id=eq.${bookingId}`,
      },
      async () => {
        await refreshBooking()
      },
    )
    .subscribe()
})

onBeforeUnmount(() => {
  statusChannel.value?.unsubscribe()
  paymentsChannel.value?.unsubscribe()
  messagesStore.unsubscribeFromBookingMessages(bookingId)
})
</script>

<style scoped>
.page-main {
  padding: 2rem 1.5rem 5rem;
  max-width: 80rem;
  margin: 0 auto;
  min-height: 100vh;
}

.details-grid {
  display: grid;
  gap: 1.5rem;
  margin-bottom: 2rem;
}

@media (min-width: 1024px) {
  .details-grid {
    grid-template-columns: 2fr 1fr;
  }
}

.booking-summary-card,
.booking-actions-card,
.chat-panel {
  background: #ffffff;
  border: 1px solid var(--outline-variant, #c4c7c7);
  border-radius: 0; /* match customer view: no rounded containers */
  padding: 1.5rem;
}

.summary-header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: flex-start;
  margin-bottom: 1.5rem;
}

.section-title {
  font-size: 20px;
  font-weight: 600;
  margin-bottom: 1rem;
}

.header-title {
  font-size: 28px;
  font-weight: 700;
  margin: 0 0 0.5rem;
}

.header-copy,
.summary-text,
.summary-sub {
  margin: 0;
  color: var(--secondary, #5e5e5e);
}

.summary-block {
  margin-bottom: 1.25rem;
}

.summary-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--primary, #000000);
  margin-bottom: 0.5rem;
}

.customer-row {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.avatar-placeholder {
  width: 3rem;
  height: 3rem;
  border-radius: 9999px;
  background: var(--surface-container, #eeeeee);
  display: grid;
  place-items: center;
}

.summary-meta-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}

.meta-label {
  display: block;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--secondary, #5e5e5e);
  margin-bottom: 0.25rem;
}

.action-group {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.action-summary {
  border-top: 1px solid var(--surface-variant, #e4e4e7);
  padding-top: 1rem;
}

.summary-copy {
  font-size: 14px;
  color: var(--secondary, #5e5e5e);
  margin: 0;
}

.success-text {
  margin-top: 0.75rem;
  color: #2e7d32;
  font-weight: 600;
}

.chat-panel {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.messages-box {
  min-height: 16rem;
  max-height: 28rem;
  overflow-y: auto;
  padding: 1rem;
  border: 1px solid var(--outline-variant, #c4c7c7);
  border-radius: 0; /* no radius */
  background: var(--surface-container, #f8fafc);
}

.message-item {
  margin-bottom: 0.75rem;
  display: flex;
}

.message-bubble {
  display: inline-flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.9rem 1rem;
  background: #ffffff;
  border: 1px solid var(--outline-variant, #c4c7c7);
  max-width: min(85%, 28rem);
  border-radius: 0; /* no rounded bubbles */
}

/* Cleaner (auth user) messages: align left */
.message-bubble--mine {
  margin-right: auto;
  background: var(--primary, #000000);
  color: #ffffff;
  border-color: var(--primary, #000000);
}

/* Customer messages: align right */
.message-bubble:not(.message-bubble--mine) {
  margin-left: auto;
}

.message-text {
  margin: 0;
}

.message-time {
  font-size: 11px;
  color: var(--secondary, #5e5e5e);
}

.message-form {
  display: grid;
  gap: 1rem;
}

.message-input,
.modal-input,
.modal-textarea {
  width: 100%;
  border: 1px solid var(--outline-variant, #c4c7c7);
  border-radius: 0; /* no radius on inputs */
  padding: 0.9rem 1rem;
  font-size: 14px;
  color: var(--primary, #000000);
  background: #ffffff;
}

.message-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}

.error-text {
  color: #ba1a1a;
  font-size: 13px;
}

.btn-start,
.btn-action,
.btn-secondary,
.btn-decline {
  padding: 0.75rem 1rem;
  border: none;
  border-radius: 0; /* CTAs with no radius */
  font-weight: 600;
  cursor: pointer;
}
.btn-start {
  background: var(--primary, #000000);
  color: #ffffff;
}
.btn-action {
  background: transparent;
  color: var(--primary, #000000);
  border: 1px solid var(--outline-variant, #c4c7c7);
}
.btn-secondary {
  background: var(--surface-container, #eeeeee);
  color: var(--primary, #000000);
}
.btn-decline {
  background: transparent;
  color: #ba1a1a;
  border: 1px solid #ba1a1a;
}

.modal-field {
  margin-bottom: 1rem;
}

.modal-label {
  display: block;
  margin-bottom: 0.5rem;
  font-size: 14px;
  font-weight: 700;
}

.modal-textarea {
  min-height: 7rem;
}
</style>
