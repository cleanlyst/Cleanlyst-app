import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createReview } from '@/services/reviewService'

const getUser = vi.fn()
const bookingMaybeSingle = vi.fn()
const reviewSingle = vi.fn()
const reviewSelect = vi.fn(() => ({ single: reviewSingle }))
const reviewInsert = vi.fn(() => ({ select: reviewSelect }))
const bookingEqId = vi.fn(() => ({ maybeSingle: bookingMaybeSingle }))
const bookingSelect = vi.fn(() => ({ eq: bookingEqId }))
const from = vi.fn((table: string) => {
  if (table === 'bookings') return { select: bookingSelect }
  return { insert: reviewInsert }
})

vi.mock('@/services/supabaseClient', () => ({
  getSupabaseClient: () => ({
    auth: { getUser },
    from,
  }),
}))

describe('reviewService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getUser.mockResolvedValue({ data: { user: { id: 'customer-1' } }, error: null })
    bookingMaybeSingle.mockResolvedValue({
      data: { customer_id: 'customer-1', cleaner_id: 'cleaner-1' },
      error: null,
    })
    reviewSingle.mockResolvedValue({ data: { id: 'review-1' }, error: null })
  })

  it('creates reviews with reviewer_id and reviewee_id from booking participants', async () => {
    await createReview('booking-1', 5, 'Great service')

    expect(reviewInsert).toHaveBeenCalledWith({
      booking_id: 'booking-1',
      reviewer_id: 'customer-1',
      reviewee_id: 'cleaner-1',
      rating: 5,
      comment: 'Great service',
    })
  })
})
