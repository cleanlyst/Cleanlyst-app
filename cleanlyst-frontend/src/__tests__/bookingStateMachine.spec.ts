import { describe, expect, it } from 'vitest'
import { useBookingStateMachine } from '@/composables/useBookingStateMachine'

describe('useBookingStateMachine', () => {
  it('allows valid transitions', () => {
    const { canTransition } = useBookingStateMachine()
    expect(canTransition('pending_request', 'estimate_proposed')).toBe(true)
    expect(canTransition('pending_request', 'cleaner_declined')).toBe(true)
    expect(canTransition('estimate_proposed', 'awaiting_customer_payment')).toBe(true)
    expect(canTransition('awaiting_customer_payment', 'payment_authorized')).toBe(true)
    expect(canTransition('in_progress', 'completion_pending_customer')).toBe(true)
    expect(canTransition('completion_pending_customer', 'disputed')).toBe(true)
    expect(canTransition('disputed', 'refunded')).toBe(true)
  })

  it('blocks invalid transitions', () => {
    const { canTransition } = useBookingStateMachine()
    expect(canTransition('pending_request', 'completed')).toBe(false)
    expect(canTransition('pending_request', 'awaiting_customer_payment')).toBe(false)
    expect(canTransition('in_progress', 'completed')).toBe(false)
    expect(canTransition('payment_authorized', 'refunded')).toBe(false)
  })
})
