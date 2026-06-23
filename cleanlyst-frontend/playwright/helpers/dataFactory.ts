/**
 * dataFactory.ts — runtime test data generators.
 *
 * All values are deterministic within a run (use the provided seed helpers)
 * and unique across runs (timestamps in IDs prevent collisions).
 */

let _seq = 0
export function resetSeq() { _seq = 0 }
function seq() { return ++_seq }

export function uniqueEmail(prefix = 'e2e'): string {
  return `${prefix}-${Date.now()}-${seq()}@test.cleanlyst.local`
}

export function uniquePhone(): string {
  const n = String(Date.now()).slice(-8)
  return `0779${n}`
}

export interface CustomerProfile {
  email: string
  password: string
  fullName: string
  phone: string
}

export function makeCustomerProfile(overrides: Partial<CustomerProfile> = {}): CustomerProfile {
  return {
    email:    uniqueEmail('e2e-customer'),
    password: 'TestPassword123!',
    fullName: `Test Customer ${seq()}`,
    phone:    uniquePhone(),
    ...overrides,
  }
}

export interface CleanerProfile {
  email: string
  password: string
  fullName: string
  phone: string
  bio: string
  hourlyRate: string
}

export function makeCleanerProfile(overrides: Partial<CleanerProfile> = {}): CleanerProfile {
  return {
    email:      uniqueEmail('e2e-cleaner'),
    password:   'TestPassword123!',
    fullName:   `Test Cleaner ${seq()}`,
    phone:      uniquePhone(),
    bio:        'Experienced professional cleaner. Test account.',
    hourlyRate: '15',
    ...overrides,
  }
}

export function futureDate(daysAhead = 5): string {
  const d = new Date()
  d.setDate(d.getDate() + daysAhead)
  return d.toISOString().slice(0, 10)
}

export const PROPERTY_DATA = {
  addressLine1: '12 Test Street',
  addressLine2: 'Test Area',
  city:         'Manchester',
  postcode:     'M1 1AA',
  propertyType: 'terraced_house',
  bedrooms:     '2',
  bathrooms:    '1',
}
