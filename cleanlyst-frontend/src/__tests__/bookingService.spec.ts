import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createBookingRequest, transitionBookingState } from '@/services/bookingService'

const rpc = vi.fn()
const single = vi.fn()
const select = vi.fn(() => ({ single }))
const insert = vi.fn(() => ({ select }))
const from = vi.fn(() => ({ insert }))

vi.mock('@/services/supabaseClient', () => ({
  getSupabaseClient: () => ({ rpc, from }),
}))

describe('bookingService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    rpc.mockResolvedValue({ data: { id: 'booking-1' }, error: null })
    single.mockResolvedValue({ data: { id: 'booking-1' }, error: null })
  })

  it('calls transition_booking_state with the live RPC argument names', async () => {
    await transitionBookingState('booking-1', 'estimate_proposed', 'Accepted')

    expect(rpc).toHaveBeenCalledWith('transition_booking_state', {
      p_booking_id: 'booking-1',
      p_target_status: 'estimate_proposed',
      p_note: 'Accepted',
    })
  })

  it('creates booking requests with service_id and notes', async () => {
    await createBookingRequest({
      customerId: 'customer-1',
      cleanerId: 'cleaner-1',
      serviceId: 'service-1',
      serviceTitleSnapshot: 'Deep clean',
      locationText: '10 High Street',
      scheduledStart: '2026-06-01T09:00:00.000Z',
      scheduledEnd: '2026-06-01T11:00:00.000Z',
      quoteCents: 5000,
      cleanerPayoutCents: 4500,
      notes: 'Please focus on the kitchen.',
    })

    expect(from).toHaveBeenCalledWith('bookings')
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        service_id: 'service-1',
        status: 'pending_request',
        notes: 'Please focus on the kitchen.',
      }),
    )
  })
})
