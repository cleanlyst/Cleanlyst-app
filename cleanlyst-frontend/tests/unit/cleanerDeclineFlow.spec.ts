/**
 * Regression tests for the cleaner "Decline" bug (confirmed production bug):
 *
 *   bookingLifecycleService.declineBooking() used to hardcode the RPC target
 *   status to 'declined'. The canonical transition_booking_state RPC
 *   (20260701000003_estimate_adjustment.sql:850-858) only allows 'declined'
 *   as a target from pending_request — a status cleaners can never see
 *   (RLS blocks it) — and requires 'cleaner_declined' as the target from
 *   payment_authorized, which is the only status the cleaner-facing Decline
 *   button is ever shown for. Every real decline attempt on a paid booking
 *   therefore failed with "Invalid status transition: payment_authorized →
 *   declined (actor: cleaner)".
 *
 * These tests pin down the fix: declineBooking() must derive the correct
 * target status from the booking's current status, matching the SQL
 * DECLINED branch exactly, and must not trigger any payment/refund side
 * effect (decline of a paid booking requires a separate, explicit
 * admin-triggered refund — see refund-payment Edge Function).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { declineBooking } from '@/services/bookingLifecycleService'

const rpc = vi.fn()

vi.mock('@/services/supabaseClient', () => ({
  getSupabaseClient: () => ({ rpc }),
}))

const refundPayment = vi.fn()
vi.mock('@/services/payments/paymentOrchestrator', () => ({
  refundPayment: (...args: unknown[]) => refundPayment(...args),
}))

describe('declineBooking()', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sends cleaner_declined (not declined) for a paid booking — the confirmed bug', async () => {
    rpc.mockResolvedValue({
      data: { id: 'booking-1', status: 'cleaner_declined' },
      error: null,
    })

    await declineBooking('booking-1', 'payment_authorized', 'Not available anymore')

    expect(rpc).toHaveBeenCalledWith('transition_booking_state', {
      p_booking_id: 'booking-1',
      p_target_status: 'cleaner_declined',
      p_note: 'Not available anymore',
    })
    // Explicitly guard against the regression: must never send the old,
    // rejected target status for a payment_authorized source.
    expect(rpc).not.toHaveBeenCalledWith(
      'transition_booking_state',
      expect.objectContaining({ p_target_status: 'declined' }),
    )
  })

  it('resolves with the correct resulting booking status', async () => {
    rpc.mockResolvedValue({
      data: { id: 'booking-1', status: 'cleaner_declined' },
      error: null,
    })

    const result = await declineBooking('booking-1', 'payment_authorized')

    expect(result).toEqual({ id: 'booking-1', status: 'cleaner_declined' })
  })

  it('still sends declined for the legacy pending_request source (admin/pre-payment path)', async () => {
    // Cleaners can never reach this state via the UI (RLS-blocked), but the
    // SQL contract allows an admin to decline an unpaid request as 'declined',
    // and the fix must not regress that legitimate source status.
    rpc.mockResolvedValue({
      data: { id: 'booking-2', status: 'declined' },
      error: null,
    })

    await declineBooking('booking-2', 'pending_request')

    expect(rpc).toHaveBeenCalledWith('transition_booking_state', {
      p_booking_id: 'booking-2',
      p_target_status: 'declined',
      p_note: null,
    })
  })

  it('propagates the RPC error when the transition is rejected as invalid', async () => {
    // Simulates the real SQL behaviour for a state the state machine
    // prohibits (e.g. a booking already 'accepted' cannot be declined).
    rpc.mockResolvedValue({
      data: null,
      error: new Error('Invalid status transition: accepted → cleaner_declined (actor: cleaner)'),
    })

    await expect(declineBooking('booking-3', 'accepted')).rejects.toThrow(
      'Invalid status transition',
    )
  })

  it('never triggers a payment refund as a side effect of declining', async () => {
    rpc.mockResolvedValue({
      data: { id: 'booking-1', status: 'cleaner_declined' },
      error: null,
    })

    await declineBooking('booking-1', 'payment_authorized')

    expect(refundPayment).not.toHaveBeenCalled()
  })

  it('still does not refund even when the RPC call fails', async () => {
    rpc.mockResolvedValue({
      data: null,
      error: new Error('Invalid status transition'),
    })

    await expect(declineBooking('booking-1', 'payment_authorized')).rejects.toThrow(
      'Invalid status transition',
    )
    expect(refundPayment).not.toHaveBeenCalled()
  })
})
