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
              {{ getBookingDisplayStatus(booking, 'customer') }}
            </span>
          </div>

          <div class="summary-block">
            <h2 class="summary-title">When</h2>
            <p class="summary-text">{{ formatDate(booking.scheduled_start) }}</p>
            <p class="summary-sub">
              {{ timeRange(booking.scheduled_start, booking.scheduled_end) }}
            </p>
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
                {{
                  booking.quote_cents != null
                    ? formatPence(booking.quote_cents, booking.currency ?? 'GBP')
                    : '—'
                }}
              </p>
            </div>
            <div>
              <span class="meta-label">Duration</span>
              <p class="summary-text">
                {{
                  booking.duration_minutes
                    ? `${(booking.duration_minutes / 60).toFixed(1)}h`
                    : booking.estimated_hours
                      ? `${booking.estimated_hours}h`
                      : 'TBC'
                }}
              </p>
            </div>
          </div>

          <div v-if="booking.booking_edit_note" class="edit-note-banner">
            <span class="material-symbols-outlined">info</span>
            {{ booking.booking_edit_note }}
          </div>
        </section>

        <!-- Actions -->
        <section class="actions-card">
          <div class="section-header">
            <h2 class="section-title">Actions</h2>
          </div>

          <div class="action-group">
            <button
              v-if="booking.status === 'accepted' && booking.payment_status === 'unpaid'"
              type="button"
              class="btn-primary"
              @click="openPayModal"
            >
              Make Payment
            </button>

            <!-- Custom booking: cleaner has proposed an estimate -->
            <div v-if="booking.status === 'estimate_proposed'" class="estimate-card">
              <p class="estimate-label">Your cleaner has proposed a revised quote</p>
              <p class="estimate-price">
                {{ formatPence(booking.quote_cents ?? 0, booking.currency ?? 'GBP') }}
              </p>
              <p v-if="booking.booking_edit_note" class="estimate-note">
                "{{ booking.booking_edit_note }}"
              </p>
              <button type="button" class="btn-primary" @click="openPayModal">
                Accept Quote &amp; Pay
              </button>
            </div>

            <!-- Legacy: pre-new-flow bookings that still require customer confirmation -->
            <button
              v-if="booking.status === 'completion_pending_customer'"
              type="button"
              class="btn-primary"
              :disabled="actionLoading"
              @click="confirmComplete"
            >
              {{
                actionLoading && activeAction === 'complete' ? 'Completing…' : 'Confirm Complete'
              }}
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
              v-if="
                !canCancel &&
                booking.status !== 'accepted' &&
                booking.status !== 'completion_pending_customer' &&
                !isTerminal(booking.status) &&
                statusInfo(booking.status)
              "
              class="status-info"
            >
              <span class="material-symbols-outlined status-info-icon">info</span>
              {{ statusInfo(booking.status) }}
            </div>
          </div>

          <div class="action-footer">
            <p class="footer-copy">Status: {{ getBookingDisplayStatus(booking, 'customer') }}</p>
            <p v-if="successMessage" class="success-text">{{ successMessage }}</p>
          </div>

          <router-link :to="{ name: 'CustomerDashboard' }" class="back-link">
            <span class="material-symbols-outlined">arrow_back</span>
            Back to Dashboard
          </router-link>
        </section>
      </div>

      <!-- Payment modal -->
      <div v-if="payModalOpen" class="modal-backdrop" @click.self="closePayModal">
        <div class="modal-box">
          <template v-if="!paySuccess">
            <div class="modal-header">
              <h2 class="modal-title">Confirm Payment</h2>
              <button
                class="modal-close"
                type="button"
                :disabled="paymentProcessing"
                @click="closePayModal"
              >
                <span class="material-symbols-outlined">close</span>
              </button>
            </div>
            <div class="modal-body">
              <p class="modal-desc">
                You are about to pay
                <strong>{{
                  booking && booking.quote_cents != null
                    ? formatPence(booking.quote_cents, booking.currency ?? 'GBP')
                    : '—'
                }}</strong>
                for <strong>{{ booking?.service_title_snapshot ?? 'Cleaning Booking' }}</strong
                >.
              </p>
              <p v-if="booking?.booking_edit_note" class="modal-note">
                {{ booking.booking_edit_note }}
              </p>
              <p v-if="payModalError" class="modal-error">{{ payModalError }}</p>
              <div class="modal-actions">
                <button
                  class="btn-primary modal-btn"
                  type="button"
                  :disabled="paymentProcessing"
                  @click="confirmPayment"
                >
                  <span v-if="paymentProcessing" class="btn-spinner"></span>
                  <span v-else>Confirm & Pay</span>
                </button>
                <button
                  class="btn-cancel"
                  type="button"
                  :disabled="paymentProcessing"
                  @click="closePayModal"
                >
                  Cancel
                </button>
              </div>
            </div>
          </template>
          <template v-else>
            <div class="modal-success">
              <span class="material-symbols-outlined success-check">check_circle</span>
              <p class="success-title">Payment Successful!</p>
              <p class="success-sub">Your cleaner will start soon.</p>
              <button class="btn-primary modal-btn" type="button" @click="closePayModal">
                Done
              </button>
            </div>
          </template>
        </div>
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
                <span
                  v-if="msg.sender_id === auth.userId && msg.status"
                  class="message-status"
                  :class="`message-status--${msg.status}`"
                >
                  {{
                    msg.status === 'sending' ? 'Sending…' : msg.status === 'failed' ? 'Failed' : ''
                  }}
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
import type { RealtimeSubscription } from '@/lib/realtime'
import DashboardLayout from '@/layouts/DashboardLayout.vue'
import { customerDashboardLinks } from '@/pages/dasboardLinks'
import { getSupabaseClient } from '@/services/supabaseClient'
import {
  getBookingById,
  transitionBookingState,
  processPaymentDirect,
  type BookingDetailRow,
} from '@/services/bookingService'
import { formatDate, formatDateTime, formatPence } from '@/utils/format'
import { getBookingDisplayStatus } from '@/utils/bookingStatus'
import { cancelBooking as cancelBookingRequest } from '@/services/bookingService'

const auth = useAuthStore()
const messagesStore = useMessagesStore()
const route = useRoute()
const bookingId = String(route.params.bookingId ?? '')

const booking = ref<BookingDetailRow | null>(null)
const loading = ref(true)
const actionLoading = ref(false)
const activeAction = ref<string | null>(null)
const payModalOpen = ref(false)
const paymentProcessing = ref(false)
const paySuccess = ref(false)
const payModalError = ref('')
const messageDraft = ref('')
const messageSending = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const messageError = ref('')
const messagesContainer = ref<HTMLElement | null>(null)
const statusChannel = ref<RealtimeSubscription | null>(null)

const messages = computed(() => messagesStore.byBooking[bookingId] ?? [])

const canCancel = computed(() =>
  ['pending_request', 'accepted', 'estimate_proposed'].includes(booking.value?.status ?? ''),
)

function isTerminal(status: string): boolean {
  return [
    'completed',
    'cancelled',
    'declined',
    'cleaner_declined',
    'disputed',
    'refunded',
  ].includes(status)
}

function statusInfo(status: string): string {
  const map: Record<string, string> = {
    pending_request: 'Your request has been sent. Waiting for the cleaner to respond.',
    accepted: 'Your cleaner has accepted. Complete payment to confirm the booking.',
    paid_pending_start: 'Payment confirmed. Your cleaner will start soon.',
    scheduled: 'Your cleaner will start soon.',
    payment_authorized: 'Your cleaner will start soon.',
    in_progress: 'Cleaning is in progress.',
  }
  return map[status] ?? ''
}

function statusClass(status: string): string {
  if (status === 'completed') return 'status-pill--completed'
  if (['in_progress', 'paid_pending_start', 'scheduled', 'payment_authorized'].includes(status))
    return 'status-pill--active'
  if (['pending_request', 'accepted', 'estimate_proposed'].includes(status))
    return 'status-pill--pending'
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

function openPayModal() {
  payModalOpen.value = true
  paySuccess.value = false
  payModalError.value = ''
}

function closePayModal() {
  if (paymentProcessing.value) return
  payModalOpen.value = false
  paySuccess.value = false
  payModalError.value = ''
}

async function confirmPayment() {
  if (!booking.value || paymentProcessing.value) return
  paymentProcessing.value = true
  payModalError.value = ''
  successMessage.value = ''
  try {
    await new Promise((resolve) => setTimeout(resolve, 1500))
    const updated = await processPaymentDirect(bookingId)
    booking.value = updated
    paySuccess.value = true
  } catch (e) {
    payModalError.value = e instanceof Error ? e.message : 'Failed to process payment.'
  } finally {
    paymentProcessing.value = false
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
      async () => {
        await refreshBooking()
      },
    )
    .subscribe()
  statusChannel.value = ch
})

onBeforeUnmount(() => {
  statusChannel.value?.unsubscribe()
  messagesStore.unsubscribeFromBookingMessages(bookingId)
})
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

.page-main {
  padding: 2rem 1.5rem 5rem;
  max-width: 80rem;
  margin: 0 auto;
  min-height: 100vh;
}

@media (min-width: 1024px) {
  .page-main {
    padding-left: 3rem;
    padding-right: 3rem;
  }
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

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

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
  .details-grid {
    grid-template-columns: 2fr 1fr;
  }
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

.summary-block:last-of-type {
  border-bottom: none;
}

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

.status-pill--pending {
  background: #fff8e1;
  color: #e65100;
  border: 1px solid #ffcc80;
}
.status-pill--active {
  background: #e3f2fd;
  color: #1565c0;
  border: 1px solid #90caf9;
}
.status-pill--warning {
  background: #fff3e0;
  color: #e65100;
  border: 1px solid #ffcc02;
}
.status-pill--completed {
  background: #e8f5e9;
  color: #2e7d32;
  border: 1px solid #a5d6a7;
}
.status-pill--cancelled {
  background: #ffebee;
  color: #c62828;
  border: 1px solid #ef9a9a;
}

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

.status-info-icon {
  font-size: 1rem;
}

.back-link {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 14px;
  color: var(--secondary, #5e5e5e);
  text-decoration: none;
  margin-top: 1.5rem;
}

.back-link:hover {
  color: var(--primary, #000000);
}
.back-link .material-symbols-outlined {
  font-size: 1rem;
}

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

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.btn-primary:not(:disabled):hover {
  opacity: 0.85;
}

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

.btn-danger:not(:disabled):hover {
  background: #ffebee;
}
.btn-danger:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Estimate card */
.estimate-card {
  width: 100%;
  padding: 1rem;
  border: 1px solid var(--outline-variant, #c4c7c7);
  background: var(--surface-container-lowest, #ffffff);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.estimate-label {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--secondary, #5e5e5e);
  margin: 0;
}

.estimate-price {
  font-size: 28px;
  font-weight: 700;
  color: var(--primary, #000000);
  margin: 0;
}

.estimate-note {
  font-size: 13px;
  color: var(--secondary, #5e5e5e);
  font-style: italic;
  margin: 0 0 0.25rem;
}

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

.message-item {
  margin-bottom: 0.75rem;
  display: flex;
}

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

.message-bubble--theirs {
  margin-right: auto;
}

.message-text {
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
}

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

.message-bubble--mine .message-time {
  color: rgba(255, 255, 255, 0.6);
}

.message-status {
  font-size: 11px;
}
.message-status--sending {
  color: rgba(255, 255, 255, 0.6);
}
.message-status--failed {
  color: #ffcdd2;
  font-weight: 600;
}

.empty-desc {
  font-size: 14px;
  color: var(--secondary, #5e5e5e);
  text-align: center;
  padding: 2rem 0;
}

.message-form {
  display: grid;
  gap: 0.75rem;
}

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

.message-input:focus {
  outline: none;
  border-color: var(--primary, #000000);
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
  margin: 0;
}

.message-actions .btn-primary {
  width: auto;
  padding: 0.5rem 1.25rem;
}

.edit-note-banner {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  font-size: 13px;
  color: #1565c0;
  background: #e3f2fd;
  border: 1px solid #90caf9;
  padding: 0.75rem 1rem;
  margin-top: 1.25rem;
}

.edit-note-banner .material-symbols-outlined {
  font-size: 1rem;
  flex-shrink: 0;
  margin-top: 1px;
}

/* ── Payment modal ── */
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
  border-radius: 0.5rem;
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

.modal-title {
  font-size: 20px;
  font-weight: 600;
  margin: 0;
}

.modal-close {
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--secondary, #5e5e5e);
  display: flex;
  padding: 0;
}

.modal-body {
  padding: 1.5rem;
}

.modal-desc {
  font-size: 15px;
  color: var(--primary, #000000);
  margin: 0 0 1rem;
  line-height: 1.6;
}

.modal-note {
  font-size: 13px;
  color: #1565c0;
  background: #e3f2fd;
  border: 1px solid #90caf9;
  padding: 0.625rem 0.875rem;
  margin: 0 0 1rem;
}

.modal-error {
  font-size: 13px;
  color: #ba1a1a;
  margin: 0 0 0.75rem;
}

.modal-actions {
  display: flex;
  gap: 0.75rem;
  margin-top: 1rem;
}

.modal-btn {
  flex: 1;
}

.btn-cancel {
  flex: 1;
  padding: 0.625rem 1rem;
  background: transparent;
  border: 1px solid var(--outline-variant, #c4c7c7);
  border-radius: var(--radius, 0.25rem);
  font-size: 14px;
  cursor: pointer;
  transition: background-color 200ms ease;
}

.btn-cancel:hover {
  background: var(--surface-container, #eeeeee);
}

.modal-success {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 2.5rem 1.5rem;
  gap: 1rem;
  text-align: center;
}

.success-check {
  font-size: 3rem;
  color: #2e7d32;
  font-variation-settings:
    'FILL' 1,
    'wght' 400,
    'GRAD' 0,
    'opsz' 24;
}

.success-title {
  font-size: 18px;
  font-weight: 600;
  margin: 0;
}

.success-sub {
  font-size: 14px;
  color: var(--secondary, #5e5e5e);
  margin: 0;
}

.btn-spinner {
  width: 0.875rem;
  height: 0.875rem;
  border: 2px solid rgba(255, 255, 255, 0.4);
  border-top-color: #ffffff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  display: inline-block;
}
</style>
