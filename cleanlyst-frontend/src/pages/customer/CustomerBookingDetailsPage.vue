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
            <span :class="['status-pill', getStatusPillClass(booking.status)]">
              {{ getBookingStatusLabel(booking, 'customer') }}
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
            <!-- ── Overdue / Awaiting Resolution ── -->
            <template v-if="isOverdue">
              <div class="overdue-panel">
                <div class="overdue-panel__header">
                  <span class="material-symbols-outlined overdue-panel__icon" aria-hidden="true">event_busy</span>
                  <div>
                    <p class="overdue-panel__title">This booking was not completed</p>
                    <p class="overdue-panel__body">
                      This booking was scheduled for {{ formatDate(booking.scheduled_start) }} but appears not to have been completed.
                      If your cleaner did not attend, you can report a no-show and we will review your case.
                    </p>
                  </div>
                </div>

                <p v-if="overdueReportError" class="overdue-panel__error" role="alert">{{ overdueReportError }}</p>

                <div v-if="booking.status === 'awaiting_resolution' && !overdueReportSuccess" class="overdue-panel__actions">
                  <button
                    type="button"
                    class="btn-danger"
                    :disabled="overdueReportLoading"
                    @click="reportOverdueNoShow"
                  >
                    <span v-if="overdueReportLoading">Reporting…</span>
                    <span v-else>Report No-show</span>
                  </button>
                  <a href="mailto:support@cleanlyst.com" class="btn-support">Contact Support</a>
                </div>

                <div v-if="booking.status === 'no_show_reported' || overdueReportSuccess" class="overdue-panel__reported">
                  <span class="material-symbols-outlined" style="font-size:1.25rem;color:#16a34a;" aria-hidden="true">check_circle</span>
                  No-show reported. Our team has been notified and will review your case within 24 hours.
                </div>
              </div>
            </template>

            <!-- Reassignment: cleaner cancelled / no-show / reassign requested -->
            <div v-if="canReassign" class="status-info status-info--warning">
              <span class="material-symbols-outlined status-info-icon">person_off</span>
              Your cleaner is unable to attend this booking.
            </div>
            <button
              v-if="canReassign"
              type="button"
              class="btn-primary"
              @click="openReassignFlow"
            >
              Find Replacement Cleaner
            </button>
            <a v-if="canReassign" href="mailto:support@cleanlyst.com" class="btn-support">
              Contact Support
            </a>

            <!-- Reassignment: a new cleaner has been assigned -->
            <div v-if="hasBeenReassigned" class="reassignment-banner">
              <span class="material-symbols-outlined reassignment-banner__icon">check_circle</span>
              <div>
                <p class="reassignment-banner__title">Replacement cleaner assigned</p>
                <p class="reassignment-banner__body">
                  A replacement cleaner has been assigned to your booking. Your service will continue as scheduled.
                </p>
              </div>
            </div>

            <!-- estimate_adjustment_requested: new Pay-Before-Accept flow -->
            <div v-if="booking.status === 'estimate_adjustment_requested'" class="estimate-card" data-testid="adjustment-card">
              <p class="estimate-label">Your cleaner has requested a price adjustment</p>
              <div class="estimate-breakdown">
                <span class="estimate-row">
                  <span>Original price</span>
                  <strong>{{ formatPence(booking.initial_quote_cents ?? booking.quote_cents ?? 0, booking.currency ?? 'GBP') }}</strong>
                </span>
                <span class="estimate-row">
                  <span>New total</span>
                  <strong>{{ formatPence(booking.proposed_total_cents ?? 0, booking.currency ?? 'GBP') }}</strong>
                </span>
                <span v-if="(booking.adjustment_amount_cents ?? 0) > 0" class="estimate-row estimate-row--due">
                  <span>Additional amount</span>
                  <strong>+{{ formatPence(booking.adjustment_amount_cents ?? 0, booking.currency ?? 'GBP') }}</strong>
                </span>
                <span v-else-if="(booking.adjustment_amount_cents ?? 0) < 0" class="estimate-row" style="color:var(--on-secondary-container)">
                  <span>Discount</span>
                  <strong>{{ formatPence(booking.adjustment_amount_cents ?? 0, booking.currency ?? 'GBP') }}</strong>
                </span>
              </div>
              <p v-if="booking.adjustment_reason" class="estimate-note">
                "{{ booking.adjustment_reason }}"
              </p>
              <p v-if="adjustmentError" class="text-sm text-red-600 mt-2" role="alert">{{ adjustmentError }}</p>
              <div class="modal-actions" style="margin-top:1rem;">
                <button
                  v-if="(booking.adjustment_amount_cents ?? 0) > 0"
                  type="button"
                  class="btn-primary"
                  :disabled="adjustmentLoading !== null"
                  data-testid="accept-adjustment-pay-btn"
                  @click="acceptAdjustmentWithPayment"
                >
                  {{ adjustmentLoading === 'accept_pay' ? 'Redirecting…' : `Accept & Pay ${formatPence(booking.adjustment_amount_cents ?? 0, booking.currency ?? 'GBP')} extra` }}
                </button>
                <button
                  v-else
                  type="button"
                  class="btn-primary"
                  :disabled="adjustmentLoading !== null"
                  data-testid="accept-adjustment-btn"
                  @click="acceptAdjustmentNoCharge"
                >
                  {{ adjustmentLoading === 'accept' ? 'Accepting…' : 'Accept adjustment' }}
                </button>
                <button
                  type="button"
                  class="btn-danger"
                  :disabled="adjustmentLoading !== null"
                  data-testid="reject-adjustment-reassign-btn"
                  @click="rejectAdjustment('reassign')"
                >
                  {{ adjustmentLoading === 'reassign' ? 'Requesting…' : 'Request another cleaner' }}
                </button>
                <button
                  type="button"
                  class="btn-cancel"
                  :disabled="adjustmentLoading !== null"
                  data-testid="reject-adjustment-cancel-btn"
                  @click="rejectAdjustment('cancel')"
                >
                  {{ adjustmentLoading === 'cancel' ? 'Cancelling…' : 'Cancel & request refund' }}
                </button>
              </div>
            </div>

            <!-- estimate_proposed: cleaner raised price and customer owes more -->
            <div v-if="booking.status === 'estimate_proposed' && booking.requires_additional_payment" class="estimate-card">
              <p class="estimate-label">Revised Quote — Additional Payment Required</p>
              <div class="estimate-breakdown">
                <span class="estimate-row">
                  <span>Originally paid</span>
                  <strong>{{ formatPence(booking.initial_quote_cents ?? booking.quote_cents ?? 0, booking.currency ?? 'GBP') }}</strong>
                </span>
                <span class="estimate-row estimate-row--due">
                  <span>Additional due</span>
                  <strong>{{ formatPence(booking.additional_payment_cents ?? 0, booking.currency ?? 'GBP') }}</strong>
                </span>
                <span class="estimate-row estimate-row--total">
                  <span>New total</span>
                  <strong>{{ formatPence(booking.quote_cents ?? 0, booking.currency ?? 'GBP') }}</strong>
                </span>
              </div>
              <p v-if="booking.booking_edit_note" class="estimate-note">
                "{{ booking.booking_edit_note }}"
              </p>
              <button type="button" class="btn-primary" @click="openPayModal">
                Pay Additional {{ formatPence(booking.additional_payment_cents ?? 0, booking.currency ?? 'GBP') }}
              </button>
            </div>

            <!-- estimate_proposed: cleaner revised price down (no extra payment needed) -->
            <div v-else-if="booking.status === 'estimate_proposed' && !booking.requires_additional_payment" class="status-info">
              <span class="material-symbols-outlined status-info-icon">info</span>
              Your cleaner has updated the quote. No additional payment is required.
            </div>

            <!-- Retry payment: booking created but Stripe checkout was cancelled -->
            <div
              v-if="booking.status === 'pending_request' && booking.payment_status === 'unpaid'"
              class="estimate-card"
              data-testid="retry-payment-card"
            >
              <p class="estimate-label">Payment Required</p>
              <p class="estimate-note">
                Your booking is saved but payment has not been completed yet.
              </p>
              <p v-if="payModalError" class="text-sm text-red-600 mt-1" role="alert">{{ payModalError }}</p>
              <button
                type="button"
                class="btn-primary"
                :disabled="paymentProcessing"
                data-testid="retry-payment-btn"
                @click="retryInitialPayment"
              >
                {{ paymentProcessing ? 'Redirecting…' : `Complete Payment — ${formatPence(booking.quote_cents ?? 0, booking.currency ?? 'GBP')}` }}
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

            <div v-if="canCancel" class="status-info">
              <span class="material-symbols-outlined status-info-icon">info</span>
              Cancellations more than 24 hours before your booking receive a full refund. Within 24 hours, a refund is subject to admin review.
            </div>

            <div v-if="canReportNoShow" class="status-info">
              <span class="material-symbols-outlined status-info-icon">warning</span>
              Your cleaner appears not to have started this booking.
            </div>

            <button
              v-if="canReportNoShow"
              type="button"
              class="btn-danger"
              :disabled="actionLoading"
              @click="openNoShowModal"
            >
              Cleaner Didn't Show
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
            <p class="footer-copy">Status: {{ getBookingStatusLabel(booking, 'customer') }}</p>
            <p v-if="successMessage" class="success-text">{{ successMessage }}</p>
          </div>

          <router-link :to="{ name: 'CustomerDashboard' }" class="back-link">
            <span class="material-symbols-outlined">arrow_back</span>
            Back to Dashboard
          </router-link>
        </section>
      </div>

      <BookingTimeline v-if="booking" :booking-id="bookingId" />

      <!-- No-show modal -->
      <div v-if="noShowModalOpen" class="modal-backdrop" @click.self="closeNoShowModal">
        <div class="modal-box">
          <div class="modal-header">
            <h2 class="modal-title">Cleaner didn't attend</h2>
            <button
              class="modal-close"
              type="button"
              :disabled="!!noShowActionLoading"
              @click="closeNoShowModal"
            >
              <span class="material-symbols-outlined">close</span>
            </button>
          </div>
          <div class="modal-body">
            <p class="modal-desc">Your cleaner appears not to have started this booking. How would you like to proceed?</p>
            <p v-if="noShowError" class="modal-error">{{ noShowError }}</p>
            <p v-if="noShowSuccess" class="success-text">{{ noShowSuccess }}</p>

            <div class="modal-actions">
              <button
                class="btn-primary modal-btn"
                type="button"
                :disabled="!!noShowActionLoading || !!booking?.no_show_action"
                @click="requestReplacementCleaner"
              >
                {{
                  noShowActionLoading === 'replacement'
                    ? 'Searching…'
                    : 'Find a replacement cleaner'
                }}
              </button>
              <button
                class="btn-danger modal-btn"
                type="button"
                :disabled="!!noShowActionLoading || !!booking?.no_show_action"
                @click="requestNoShowRefund"
              >
                {{ noShowActionLoading === 'refund' ? 'Refunding…' : 'Request refund' }}
              </button>
              <button
                class="btn-cancel"
                type="button"
                :disabled="!!noShowActionLoading"
                @click="closeNoShowModal"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Reassign cleaner modal -->
      <div v-if="reassignModalOpen" class="ra-backdrop" @click.self="closeReassignFlow">
        <div class="ra-box">
          <!-- Header -->
          <div class="ra-header">
            <div>
              <p class="ra-step-label">Step {{ reassignStep }} of 3</p>
              <h2 class="ra-title">
                {{ reassignStep === 1 ? 'When do you need cleaning?' : reassignStep === 2 ? 'Choose a cleaner' : 'Confirm replacement' }}
              </h2>
            </div>
            <button class="ra-close" type="button" :disabled="reassignConfirmLoading" @click="closeReassignFlow">
              <span class="material-symbols-outlined">close</span>
            </button>
          </div>

          <!-- Body -->
          <div class="ra-body">

            <!-- Step 1: Date & time -->
            <template v-if="reassignStep === 1">
              <p class="ra-step-desc">Choose the date and time for your replacement clean. No additional payment is required.</p>
              <div class="ra-date-grid">
                <div>
                  <label class="ra-field-label">Date</label>
                  <input v-model="reassignDate" type="date" class="ra-input" :min="new Date().toISOString().slice(0, 10)" />
                </div>
                <div>
                  <label class="ra-field-label">Preferred time</label>
                  <input v-model="reassignTime" type="time" class="ra-input" />
                </div>
              </div>
              <p v-if="reassignError" class="ra-error">{{ reassignError }}</p>
            </template>

            <!-- Step 2: Cleaner cards -->
            <template v-else-if="reassignStep === 2">
              <div v-if="reassignSearchLoading" class="ra-loading">
                <div class="ra-spinner"></div>
                Searching for available cleaners…
              </div>
              <div v-else-if="reassignCleaners.length === 0" class="ra-empty">
                <span class="material-symbols-outlined" style="font-size:2.5rem;color:var(--secondary,#5e5e5e)">search_off</span>
                <p>No cleaners available on that date.</p>
                <p style="font-size:12px">Try a different date or contact support.</p>
              </div>
              <div v-else class="ra-cleaner-grid">
                <div v-for="c in reassignCleaners" :key="c.user_id" class="ra-cleaner-card">
                  <div class="ra-card-img-wrap">
                    <img v-if="c.profiles?.avatar_url" :src="c.profiles?.avatar_url" :alt="reassignDisplayName(c)" class="ra-card-img" />
                    <div v-else class="ra-card-img-placeholder">
                      <span class="material-symbols-outlined" style="font-size:2rem;color:var(--secondary,#5e5e5e)">person</span>
                    </div>
                    <span v-if="c.average_rating >= 4.8 && c.review_count >= 5" class="ra-top-badge">Top Rated</span>
                  </div>
                  <div class="ra-card-body">
                    <div class="ra-card-header">
                      <div>
                        <p class="ra-card-name">{{ reassignDisplayName(c) }}</p>
                        <div class="ra-card-rating">
                          <span class="material-symbols-outlined ra-star">star</span>
                          {{ c.average_rating.toFixed(1) }}
                          <span class="ra-review-count">({{ c.review_count }})</span>
                        </div>
                      </div>
                      <div class="ra-card-price">
                        <span>{{ reassignEstimatedPrice(c.user_id) }}</span>
                        <span class="ra-price-sub">per session</span>
                      </div>
                    </div>
                    <p v-if="c.bio" class="ra-card-bio">{{ c.bio }}</p>
                    <div class="ra-card-footer">
                      <div class="ra-card-meta">
                        <span class="ra-card-service">
                          <span class="material-symbols-outlined" style="font-size:14px">cleaning_services</span>
                          {{ reassignServiceTitle(c.user_id) }}
                        </span>
                        <span class="ra-card-avail">
                          <span class="material-symbols-outlined" style="font-size:14px">check_circle</span>
                          Available
                        </span>
                      </div>
                      <button class="ra-select-btn" type="button" @click="selectReassignCleaner(c)">
                        Select Cleaner
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              <p v-if="reassignError" class="ra-error">{{ reassignError }}</p>
            </template>

            <!-- Step 3: Confirm -->
            <template v-else-if="reassignStep === 3">
              <div class="ra-confirm-grid">
                <div class="ra-confirm-block">
                  <span class="ra-confirm-label">Replacement cleaner</span>
                  <p class="ra-confirm-value">{{ reassignSelectedCleaner ? reassignDisplayName(reassignSelectedCleaner) : '—' }}</p>
                  <p class="ra-confirm-sub">
                    ★ {{ reassignSelectedCleaner?.average_rating.toFixed(1) }} · {{ reassignSelectedCleaner?.review_count }} reviews
                  </p>
                </div>
                <div class="ra-confirm-block">
                  <span class="ra-confirm-label">New date &amp; time</span>
                  <p class="ra-confirm-value">{{ reassignDate }}</p>
                  <p class="ra-confirm-sub">Starting at {{ reassignTime }}</p>
                </div>
                <div class="ra-confirm-block">
                  <span class="ra-confirm-label">Service</span>
                  <p class="ra-confirm-value">{{ booking?.service_title_snapshot ?? 'Cleaning' }}</p>
                </div>
                <div class="ra-confirm-block">
                  <span class="ra-confirm-label">Additional cost</span>
                  <p class="ra-confirm-value" style="color:#2e7d32">None — already paid</p>
                </div>
              </div>
              <p v-if="reassignError" class="ra-error">{{ reassignError }}</p>
            </template>

          </div>

          <!-- Footer -->
          <div class="ra-footer">
            <button
              v-if="reassignStep > 1"
              class="btn-modal-cancel"
              type="button"
              :disabled="reassignConfirmLoading"
              @click="reassignStep > 2 ? (reassignStep = 2) : (reassignStep = 1)"
            >
              ← Back
            </button>
            <button class="btn-modal-cancel" type="button" :disabled="reassignConfirmLoading" @click="closeReassignFlow">
              Cancel
            </button>
            <button
              v-if="reassignStep === 1"
              class="btn-modal-confirm"
              type="button"
              :disabled="!reassignDate || reassignSearchLoading"
              @click="goToReassignStep2"
            >
              {{ reassignSearchLoading ? 'Searching…' : 'Find Available Cleaners →' }}
            </button>
            <button
              v-if="reassignStep === 3"
              class="btn-modal-confirm"
              type="button"
              :disabled="reassignConfirmLoading"
              @click="confirmReassignment"
            >
              {{ reassignConfirmLoading ? 'Confirming…' : 'Confirm Replacement' }}
            </button>
          </div>
        </div>
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
                You are about to pay an additional
                <strong>{{
                  booking && booking.additional_payment_cents != null
                    ? formatPence(booking.additional_payment_cents, booking.currency ?? 'GBP')
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
import { track } from '@/utils/analytics'
import { useMessagesStore } from '@/stores/messages'
import type { RealtimeSubscription } from '@/lib/realtime'
import DashboardLayout from '@/layouts/DashboardLayout.vue'
import { customerDashboardLinks } from '@/pages/dasboardLinks'
import { getSupabaseClient } from '@/services/supabaseClient'
import {
  getBookingById,
  transitionBookingState,
  reportCleanerNoShow,
  customerReassignBooking,
  reportNoShowOverdue,
  acceptPriceAdjustmentNoCharge,
  rejectPriceAdjustment,
  type BookingDetailRow,
} from '@/services/bookingService'
import { startAdditionalPayment, startInitialPayment, startAdjustmentPayment } from '@/services/payments/paymentOrchestrator'
import { cancelAsCustomer } from '@/services/bookingLifecycleService'
import { searchCleaners, type CleanerSearchResult } from '@/services/cleanerService'
import BookingTimeline from '@/components/BookingTimeline.vue'
import { formatDate, formatDateTime, formatPence, toUserMessage } from '@/utils/format'
import { getBookingStatusLabel, getStatusPillClass, isOverdueBooking } from '@/utils/bookingStatusLabel'

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
const noShowModalOpen = ref(false)
const noShowActionLoading = ref<'replacement' | 'refund' | null>(null)
const noShowError = ref('')
const noShowSuccess = ref('')
const overdueReportLoading = ref(false)
const overdueReportError = ref('')
const overdueReportSuccess = ref(false)
const currentTime = ref(Date.now())
let noShowClock: ReturnType<typeof setInterval> | null = null
// Customer reassign flow
const reassignModalOpen = ref(false)
const reassignStep = ref<1 | 2 | 3>(1)
const reassignDate = ref('')
const reassignTime = ref('09:00')
const reassignCleaners = ref<CleanerSearchResult[]>([])
const reassignSelectedCleaner = ref<CleanerSearchResult | null>(null)
const reassignSearchLoading = ref(false)
const reassignConfirmLoading = ref(false)
const reassignError = ref('')
const reassignCleanerPrices = ref<Map<string, { price: number; title: string }>>(new Map())
// Estimate adjustment flow
const adjustmentError = ref('')
const adjustmentLoading = ref<'accept_pay' | 'accept' | 'reassign' | 'cancel' | null>(null)

const messages = computed(() => messagesStore.byBooking[bookingId] ?? [])

const canCancel = computed(() =>
  ['pending_request', 'accepted', 'estimate_proposed', 'awaiting_customer_payment', 'payment_authorized'].includes(
    booking.value?.status ?? '',
  ),
)

const canReportNoShow = computed(() => {
  const currentBooking = booking.value
  if (!currentBooking) return false
  if (!['accepted', 'paid'].includes(currentBooking.status)) return false
  if (currentBooking.started_at || currentBooking.completed_at) return false
  if (currentBooking.no_show_action) return false
  const start = new Date(currentBooking.scheduled_start)
  if (Number.isNaN(start.valueOf())) return false
  return currentTime.value > start.getTime() + 30 * 60 * 1000
})

// Customer can self-serve a replacement cleaner after cancellation or no-show
const canReassign = computed(() => {
  const b = booking.value
  if (!b) return false
  return ['cleaner_cancelled', 'cleaner_no_show', 'reassign_requested'].includes(b.status)
})

// A new cleaner has been confirmed (booking is active again)
const hasBeenReassigned = computed(() => {
  const b = booking.value
  if (!b) return false
  return !!b.original_cleaner_id && ['accepted', 'paid', 'in_progress', 'pending_request'].includes(b.status)
})

const isOverdue = computed(() => isOverdueBooking(booking.value?.status ?? ''))

function isTerminal(status: string): boolean {
  return [
    'completed',
    'cancelled',
    'cleaner_cancelled',
    'declined',
    'cleaner_declined',
    'disputed',
    'refunded',
    'awaiting_resolution',
    'no_show_reported',
  ].includes(status)
}

function statusInfo(status: string): string {
  const map: Record<string, string> = {
    pending_request: 'Your request has been sent. Waiting for the cleaner to respond.',
    accepted: 'Your cleaner has accepted. They will start at the scheduled time.',
    paid: 'Payment confirmed. Your cleaner will start at the scheduled time.',
    paid_pending_start: 'Payment confirmed. Your cleaner will start soon.',
    scheduled: 'Your cleaner will start soon.',
    payment_authorized: 'Your cleaner will start soon.',
    in_progress: 'Cleaner is currently cleaning.',
    cleaner_no_show: "We'll help find another available cleaner.",
    reassign_requested: "We are finding a replacement cleaner for you. We'll notify you when one is confirmed.",
    cancelled:
      booking.value?.no_show_action === 'refund_requested'
        ? 'Refund processed successfully'
        : 'This booking has been cancelled.',
  }
  return map[status] ?? ''
}

function openReassignFlow() {
  const b = booking.value
  if (!b) return
  const start = new Date(b.scheduled_start)
  reassignDate.value = Number.isNaN(start.valueOf()) ? '' : b.scheduled_start.slice(0, 10)
  reassignTime.value = Number.isNaN(start.valueOf()) ? '09:00' : b.scheduled_start.slice(11, 16)
  reassignStep.value = 1
  reassignCleaners.value = []
  reassignSelectedCleaner.value = null
  reassignError.value = ''
  reassignCleanerPrices.value = new Map()
  reassignModalOpen.value = true
}

function closeReassignFlow() {
  if (reassignConfirmLoading.value) return
  reassignModalOpen.value = false
  reassignStep.value = 1
  reassignCleaners.value = []
  reassignSelectedCleaner.value = null
  reassignError.value = ''
}

async function goToReassignStep2() {
  if (!booking.value || !reassignDate.value) return
  reassignSearchLoading.value = true
  reassignError.value = ''
  reassignCleaners.value = []
  try {
    const city = replacementSearchCity(booking.value.location_text)
    const found = await searchCleaners({
      serviceCategory: booking.value.category_snapshot ?? undefined,
      availabilityDate: reassignDate.value,
      availabilityTime: reassignTime.value,
      city,
      limit: 12,
    })
    reassignCleaners.value = found.filter((c) => c.user_id !== booking.value!.cleaner_id)
    await loadReassignCleanerPrices(reassignCleaners.value.map((c) => c.user_id))
    reassignStep.value = 2
  } catch (e) {
    reassignError.value = toUserMessage(e, 'Failed to search for cleaners. Please try again.')
  } finally {
    reassignSearchLoading.value = false
  }
}

async function loadReassignCleanerPrices(cleanerIds: string[]) {
  if (!cleanerIds.length) return
  const supabase = getSupabaseClient()
  const { data } = await supabase
    .from('services')
    .select('cleaner_id, base_price_cents, title, category')
    .in('cleaner_id', cleanerIds)
    .eq('active', true)
  if (!data) return
  const map = new Map<string, { price: number; title: string }>()
  const targetCategory = booking.value?.category_snapshot?.toLowerCase() ?? ''
  for (const svc of data) {
    const existing = map.get(svc.cleaner_id)
    const isMatch = (svc.category ?? '').toLowerCase() === targetCategory
    if (!existing || isMatch) {
      map.set(svc.cleaner_id, { price: svc.base_price_cents, title: svc.title })
    }
  }
  reassignCleanerPrices.value = map
}

function reassignEstimatedPrice(cleanerId: string): string {
  const entry = reassignCleanerPrices.value.get(cleanerId)
  if (!entry) return '—'
  return formatPence(entry.price, booking.value?.currency ?? 'GBP')
}

function reassignServiceTitle(cleanerId: string): string {
  return reassignCleanerPrices.value.get(cleanerId)?.title ?? 'Cleaning'
}

function reassignDisplayName(c: CleanerSearchResult): string {
  return c.business_name ?? c.profiles?.full_name ?? 'Cleaner'
}

function selectReassignCleaner(c: CleanerSearchResult) {
  reassignSelectedCleaner.value = c
  reassignStep.value = 3
}

async function confirmReassignment() {
  if (!booking.value || !reassignSelectedCleaner.value || reassignConfirmLoading.value) return
  reassignConfirmLoading.value = true
  reassignError.value = ''
  try {
    const isoStart =
      reassignDate.value && reassignTime.value
        ? new Date(`${reassignDate.value}T${reassignTime.value}:00`).toISOString()
        : undefined
    const updated = await customerReassignBooking(
      bookingId,
      reassignSelectedCleaner.value.user_id,
      isoStart,
    )
    booking.value = updated
    closeReassignFlow()
  } catch (e) {
    reassignError.value = toUserMessage(e, 'Failed to confirm reassignment. Please try again.')
  } finally {
    reassignConfirmLoading.value = false
  }
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
    if (!data) throw new Error('Booking no longer available')
    booking.value = data
  } catch (e) {
    errorMessage.value = toUserMessage(e, 'Failed to load booking. Please refresh.')
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
    // completion_pending_customer → completed: customer confirms via transition_booking_state,
    // which allows this path for customers. complete_booking requires cleaner auth and is
    // only for the cleaner's 'End Job' flow (in_progress → completed).
    await transitionBookingState(bookingId, 'completed')
    successMessage.value = 'Booking marked as completed.'
    await refreshBooking()
  } catch (e) {
    errorMessage.value = toUserMessage(e, 'Failed to confirm completion. Please try again.')
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
    if (booking.value.status === 'payment_authorized') {
      // Stripe hold on card — must cancel via Stripe (not DB-only path).
      // refund-payment Edge Function cancels the uncaptured PaymentIntent,
      // releasing the hold immediately, and updates booking + payment rows.
      const supabase = getSupabaseClient()
      const { error } = await supabase.functions.invoke('refund-payment', {
        body: { booking_id: bookingId, reason: 'requested_by_customer' },
      })
      if (error) throw new Error(error.message ?? 'Failed to cancel payment authorization')
    } else {
      await cancelAsCustomer(bookingId)
    }
    successMessage.value = 'Booking cancelled.'
    await refreshBooking()
  } catch (e) {
    errorMessage.value = toUserMessage(e, 'Failed to cancel booking. Please try again.')
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

async function reportOverdueNoShow() {
  if (!booking.value || overdueReportLoading.value) return
  overdueReportLoading.value = true
  overdueReportError.value = ''
  try {
    await reportNoShowOverdue(bookingId)
    overdueReportSuccess.value = true
    // Reload booking so the status badge updates
    await refreshBooking()
  } catch (e) {
    overdueReportError.value = toUserMessage(e, 'Failed to report no-show. Please try again.')
  } finally {
    overdueReportLoading.value = false
  }
}

function openNoShowModal() {
  noShowModalOpen.value = true
  noShowError.value = ''
  noShowSuccess.value = ''
}

function closeNoShowModal() {
  if (noShowActionLoading.value) return
  noShowModalOpen.value = false
}

function replacementSearchCity(locationText: string): string | undefined {
  const parts = locationText
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
  return parts.length > 1 ? parts[parts.length - 2] : parts[0]
}

async function requestReplacementCleaner() {
  if (!booking.value || noShowActionLoading.value) return
  noShowActionLoading.value = 'replacement'
  noShowError.value = ''
  try {
    const updated = await reportCleanerNoShow(bookingId, 'replacement')
    booking.value = updated
    closeNoShowModal()
    openReassignFlow()
  } catch (e) {
    noShowError.value = toUserMessage(e, 'Failed to request another cleaner. Please try again.')
  } finally {
    noShowActionLoading.value = null
  }
}

async function requestNoShowRefund() {
  if (!booking.value || noShowActionLoading.value) return
  noShowActionLoading.value = 'refund'
  noShowError.value = ''
  noShowSuccess.value = ''
  try {
    const updated = await reportCleanerNoShow(bookingId, 'refund')
    booking.value = updated
    noShowSuccess.value = 'Refund processed successfully'
  } catch (e) {
    noShowError.value = toUserMessage(e, 'Failed to process refund. Please try again.')
  } finally {
    noShowActionLoading.value = null
  }
}

async function confirmPayment() {
  if (!booking.value || paymentProcessing.value) return
  paymentProcessing.value = true
  payModalError.value = ''
  successMessage.value = ''
  try {
    const result = await startAdditionalPayment(bookingId)
    if (result.redirectUrl) {
      // Stripe Checkout — navigate away; success page handles confirmation
      window.location.href = result.redirectUrl
      return
    }
    await refreshBooking()
    paySuccess.value = true
    void track('CHECKOUT_COMPLETED', { booking_id: bookingId, user_id: auth.userId ?? undefined })
  } catch (e) {
    payModalError.value = toUserMessage(e, 'Failed to process payment. Please try again.')
  } finally {
    paymentProcessing.value = false
  }
}

async function retryInitialPayment() {
  if (paymentProcessing.value) return
  paymentProcessing.value = true
  payModalError.value = ''
  try {
    const result = await startInitialPayment(bookingId)
    if (result.redirectUrl) {
      window.location.href = result.redirectUrl
    }
  } catch (e) {
    payModalError.value = toUserMessage(e, 'Failed to restart payment. Please try again.')
    paymentProcessing.value = false
  }
}

async function acceptAdjustmentWithPayment() {
  if (!booking.value || adjustmentLoading.value) return
  adjustmentLoading.value = 'accept_pay'
  adjustmentError.value = ''
  try {
    const result = await startAdjustmentPayment(bookingId)
    if (result.redirectUrl) {
      window.location.href = result.redirectUrl
    }
  } catch (e) {
    adjustmentError.value = toUserMessage(e, 'Failed to start payment. Please try again.')
    adjustmentLoading.value = null
  }
}

async function acceptAdjustmentNoCharge() {
  if (!booking.value || adjustmentLoading.value) return
  adjustmentLoading.value = 'accept'
  adjustmentError.value = ''
  try {
    const updated = await acceptPriceAdjustmentNoCharge(bookingId)
    booking.value = updated
  } catch (e) {
    adjustmentError.value = toUserMessage(e, 'Failed to accept adjustment. Please try again.')
  } finally {
    adjustmentLoading.value = null
  }
}

async function rejectAdjustment(action: 'reassign' | 'cancel') {
  if (!booking.value || adjustmentLoading.value) return
  adjustmentLoading.value = action
  adjustmentError.value = ''
  try {
    const updated = await rejectPriceAdjustment(bookingId, action)
    booking.value = updated
  } catch (e) {
    adjustmentError.value = toUserMessage(e, 'Failed to process request. Please try again.')
  } finally {
    adjustmentLoading.value = null
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
    messageError.value = toUserMessage(e, 'Failed to send message. Please try again.')
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
  noShowClock = setInterval(() => {
    currentTime.value = Date.now()
  }, 30000)
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
  if (noShowClock) clearInterval(noShowClock)
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
  background: #ffffff;
  color: #4c6c4a;
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

.status-info--warning {
  background: #fff3e0;
  color: #e65100;
}

.status-info--finding {
  background: #e3f2fd;
  color: #1565c0;
}

.reassignment-banner {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  background: #e8f5e9;
  border: 1px solid #a5d6a7;
  padding: 1rem;
}

.reassignment-banner__icon {
  color: #2e7d32;
  font-size: 1.25rem;
  flex-shrink: 0;
  margin-top: 1px;
  font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24;
}

.reassignment-banner__title {
  font-size: 14px;
  font-weight: 600;
  color: #1b5e20;
  margin: 0 0 0.25rem;
}

.reassignment-banner__body {
  font-size: 13px;
  color: #2e7d32;
  margin: 0;
  line-height: 1.5;
}

.btn-support {
  display: block;
  padding: 0.75rem 1.25rem;
  background: transparent;
  color: var(--secondary, #5e5e5e);
  font-size: 14px;
  font-weight: 500;
  border: 1px solid var(--outline-variant, #c4c7c7);
  cursor: pointer;
  width: 100%;
  text-align: center;
  text-decoration: none;
  transition: background-color 0.15s;
}

.btn-support:hover {
  background: var(--surface-variant, #e2e2e2);
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

.estimate-breakdown {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  padding: 0.625rem 0;
  border-top: 1px solid var(--outline-variant, #c4c7c7);
  border-bottom: 1px solid var(--outline-variant, #c4c7c7);
  margin: 0.25rem 0 0.5rem;
}

.estimate-row {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  color: var(--secondary, #5e5e5e);
}

.estimate-row--due strong {
  color: var(--error, #ba1a1a);
}

.estimate-row--total {
  font-size: 14px;
  color: var(--on-surface, #1a1c1c);
  font-weight: 600;
  padding-top: 0.375rem;
  border-top: 1px solid var(--outline-variant, #c4c7c7);
  margin-top: 0.25rem;
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

.replacement-list {
  display: grid;
  gap: 0.75rem;
  margin: 1rem 0;
}

.replacement-row {
  border: 1px solid var(--outline-variant, #c4c7c7);
  padding: 0.75rem;
}

.replacement-name {
  margin: 0 0 0.25rem;
  font-size: 14px;
  font-weight: 600;
  color: var(--primary, #000000);
}

.replacement-meta {
  margin: 0;
  font-size: 13px;
  color: var(--secondary, #5e5e5e);
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

/* ── Reassign cleaner modal ───────────────────────────────── */
.ra-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
  padding: 1rem;
}

.ra-box {
  background: #ffffff;
  border-radius: 0.5rem;
  width: 100%;
  max-width: 56rem;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25);
}

.ra-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid var(--outline-variant, #c4c7c7);
  flex-shrink: 0;
}

.ra-step-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--secondary, #5e5e5e);
  margin: 0 0 0.25rem;
}

.ra-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--primary, #000000);
  margin: 0;
}

.ra-close {
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--secondary, #5e5e5e);
  display: flex;
  padding: 0;
  margin-top: 2px;
}

.ra-body {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
}

.ra-footer {
  padding: 1rem 1.5rem;
  border-top: 1px solid var(--outline-variant, #c4c7c7);
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.75rem;
  flex-shrink: 0;
}

/* ── Step 1: Date inputs ─────────────────────────────────── */
.ra-step-desc {
  font-size: 14px;
  color: var(--secondary, #5e5e5e);
  margin: 0 0 1.25rem;
  line-height: 1.6;
}

.ra-date-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.ra-field-label {
  display: block;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--secondary, #5e5e5e);
  margin-bottom: 0.4rem;
}

.ra-input {
  width: 100%;
  height: 2.75rem;
  padding: 0 0.75rem;
  border: 1px solid var(--outline-variant, #c4c7c7);
  background: #ffffff;
  font-size: 14px;
  color: var(--primary, #000000);
  outline: none;
  box-sizing: border-box;
}

.ra-input:focus {
  border-color: var(--primary, #000000);
}

.ra-error {
  font-size: 13px;
  color: #ba1a1a;
  margin: 1rem 0 0;
}

/* ── Step 2: Loading / empty ─────────────────────────────── */
.ra-loading {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 14px;
  color: var(--secondary, #5e5e5e);
  padding: 2rem 0;
}

.ra-spinner {
  width: 1.25rem;
  height: 1.25rem;
  border: 2px solid var(--outline-variant, #c4c7c7);
  border-top-color: var(--primary, #000000);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  flex-shrink: 0;
}

.ra-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 3rem 0;
  text-align: center;
  font-size: 14px;
  color: var(--secondary, #5e5e5e);
}

/* ── Step 2: Cleaner cards ─────────────────────────────── */
.ra-cleaner-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
}

@media (min-width: 600px) {
  .ra-cleaner-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (min-width: 900px) {
  .ra-cleaner-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

.ra-cleaner-card {
  border: 1px solid var(--outline-variant, #c4c7c7);
  background: #ffffff;
  overflow: hidden;
  transition: border-color 0.15s;
}

.ra-cleaner-card:hover {
  border-color: var(--primary, #000000);
}

.ra-card-img-wrap {
  position: relative;
  aspect-ratio: 16/9;
  overflow: hidden;
  background: var(--surface-variant, #e2e2e2);
}

.ra-card-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: grayscale(1);
  transition: filter 0.4s;
}

.ra-cleaner-card:hover .ra-card-img {
  filter: grayscale(0);
}

.ra-card-img-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--surface-container, #eeeeee);
}

.ra-top-badge {
  position: absolute;
  top: 0.5rem;
  left: 0.5rem;
  background: var(--primary, #000000);
  color: #ffffff;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding: 0.2rem 0.5rem;
}

.ra-card-body {
  padding: 0.875rem;
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
}

.ra-card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.5rem;
}

.ra-card-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--primary, #000000);
  margin: 0;
}

.ra-card-rating {
  display: flex;
  align-items: center;
  gap: 0.2rem;
  margin-top: 0.2rem;
  font-size: 13px;
  color: var(--primary, #000000);
}

.ra-star {
  font-size: 14px !important;
  color: #f59e0b;
  font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24;
}

.ra-review-count {
  color: var(--secondary, #5e5e5e);
  font-size: 12px;
}

.ra-card-price {
  text-align: right;
  flex-shrink: 0;
}

.ra-card-price > span:first-child {
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: var(--primary, #000000);
}

.ra-price-sub {
  display: block;
  font-size: 11px;
  color: var(--secondary, #5e5e5e);
}

.ra-card-bio {
  font-size: 12px;
  color: var(--on-surface-variant, #5e5e5e);
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.ra-card-footer {
  border-top: 1px solid var(--outline-variant, #c4c7c7);
  padding-top: 0.625rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.ra-card-meta {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.ra-card-service,
.ra-card-avail {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 11px;
  color: var(--secondary, #5e5e5e);
}

.ra-card-avail {
  color: #2e7d32;
  font-weight: 600;
}

.ra-select-btn {
  width: 100%;
  padding: 0.5rem;
  background: var(--primary, #000000);
  color: #ffffff;
  font-size: 13px;
  font-weight: 500;
  border: none;
  cursor: pointer;
  transition: opacity 0.15s;
}

.ra-select-btn:hover {
  opacity: 0.85;
}

/* ── Step 3: Confirm grid ─────────────────────────────────── */
.ra-confirm-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.25rem;
}

@media (max-width: 480px) {
  .ra-confirm-grid {
    grid-template-columns: 1fr;
  }
}

.ra-confirm-block {
  background: var(--surface-container, #eeeeee);
  padding: 1rem;
}

.ra-confirm-label {
  display: block;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--secondary, #5e5e5e);
  margin-bottom: 0.4rem;
}

.ra-confirm-value {
  font-size: 15px;
  font-weight: 600;
  color: var(--primary, #000000);
  margin: 0;
}

.ra-confirm-sub {
  font-size: 12px;
  color: var(--secondary, #5e5e5e);
  margin: 0.2rem 0 0;
}

/* ── Footer buttons ─────────────────────────────────────── */
.btn-modal-cancel {
  padding: 0.5rem 1rem;
  font-size: 14px;
  font-weight: 500;
  background: transparent;
  color: var(--primary, #000000);
  border: 1px solid var(--outline-variant, #c4c7c7);
  cursor: pointer;
}

.btn-modal-cancel:hover:not(:disabled) {
  background: var(--surface-variant, #e2e2e2);
}

.btn-modal-cancel:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-modal-confirm {
  padding: 0.5rem 1.25rem;
  font-size: 14px;
  font-weight: 500;
  background: var(--primary, #000000);
  color: #ffffff;
  border: none;
  cursor: pointer;
  transition: opacity 0.15s;
}

.btn-modal-confirm:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-modal-confirm:hover:not(:disabled) {
  opacity: 0.85;
}
</style>
