import { beforeEach, describe, expect, it, vi } from 'vitest'
import { searchCleaners } from '@/services/cleanerService'

type QueryResponse = { data: unknown; error: unknown }

class MockQuery {
  eqCalls: Array<[string, unknown]> = []
  inCalls: Array<[string, unknown[]]> = []
  orCalls: string[] = []
  lteCalls: Array<[string, unknown]> = []
  gtCalls: Array<[string, unknown]> = []
  rangeCalls: Array<[number, number]> = []
  orderCalls: Array<[string, unknown]> = []

  constructor(
    readonly table: string,
    private response: QueryResponse,
  ) {}

  select() {
    return this
  }

  eq(column: string, value: unknown) {
    this.eqCalls.push([column, value])
    return this
  }

  in(column: string, values: unknown[]) {
    this.inCalls.push([column, values])
    return this
  }

  or(filter: string) {
    this.orCalls.push(filter)
    return this
  }

  lte(column: string, value: unknown) {
    this.lteCalls.push([column, value])
    return this
  }

  gt(column: string, value: unknown) {
    this.gtCalls.push([column, value])
    return this
  }

  range(start: number, end: number) {
    this.rangeCalls.push([start, end])
    return this
  }

  order(column: string, options?: unknown) {
    this.orderCalls.push([column, options])
    return this
  }

  then<TResult1 = QueryResponse, TResult2 = never>(
    onfulfilled?: ((value: QueryResponse) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return Promise.resolve(this.response).then(onfulfilled, onrejected)
  }
}

const rpc = vi.fn()
const queries: MockQuery[] = []
let responsesByTable: Record<string, QueryResponse[]>

vi.mock('@/services/supabaseClient', () => ({
  getSupabaseClient: () => ({
    from: (table: string) => {
      const response = responsesByTable[table]?.shift() ?? { data: [], error: null }
      const query = new MockQuery(table, response)
      queries.push(query)
      return query
    },
    rpc,
  }),
}))

describe('cleanerService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    queries.length = 0
    responsesByTable = {
      services: [
        {
          data: [{ cleaner_id: 'cleaner-1' }, { cleaner_id: 'cleaner-2' }],
          error: null,
        },
      ],
      availability_overrides: [{ data: [], error: null }],
      availability_slots: [
        {
          data: [
            { cleaner_id: 'cleaner-1' },
            { cleaner_id: 'cleaner-2' },
            { cleaner_id: 'cleaner-3' },
          ],
          error: null,
        },
      ],
      cleaner_profiles: [
        {
          data: [
            {
              user_id: 'cleaner-1',
              business_name: 'Clean One',
              bio: null,
              currency: 'GBP',
              average_rating: 5,
              review_count: 4,
              service_radius_km: 10,
              profiles: { full_name: 'Clean One', avatar_url: null, city: 'Wigan' },
            },
          ],
          error: null,
        },
      ],
    }
    rpc.mockImplementation((_name, args) =>
      Promise.resolve({ data: args.p_cleaner_id === 'cleaner-2', error: null }),
    )
  })

  it('filters marketplace cleaners by MVP service, availability, active flag, and booking conflicts', async () => {
    const cleaners = await searchCleaners({
      serviceSlug: 'standard-cleaning',
      availabilityDate: '2026-06-12',
      availabilityTime: '10:00',
      durationMinutes: 120,
      limit: 15,
    })

    expect(cleaners).toHaveLength(1)
    expect(cleaners[0]?.user_id).toBe('cleaner-1')

    const serviceQuery = queries.find((query) => query.table === 'services')
    expect(serviceQuery?.eqCalls).toContainEqual(['active', true])
    expect(serviceQuery?.orCalls[0]).toContain('title.ilike.%standard%')
    expect(serviceQuery?.orCalls[0]).toContain('description.ilike.%regular%')

    const slotQuery = queries.find((query) => query.table === 'availability_slots')
    expect(slotQuery?.eqCalls).toContainEqual(['day_of_week', 5])
    expect(slotQuery?.eqCalls).toContainEqual(['active', true])
    expect(slotQuery?.lteCalls).toContainEqual(['start_time', '10:00:00'])
    expect(slotQuery?.gtCalls).toContainEqual(['end_time', '10:00:00'])

    expect(rpc).toHaveBeenCalledWith(
      'cleaner_has_booking_conflict',
      expect.objectContaining({ p_cleaner_id: 'cleaner-1' }),
    )
    expect(rpc).toHaveBeenCalledWith(
      'cleaner_has_booking_conflict',
      expect.objectContaining({ p_cleaner_id: 'cleaner-2' }),
    )

    const profileQuery = queries.find((query) => query.table === 'cleaner_profiles')
    expect(profileQuery?.eqCalls).toContainEqual(['status', 'approved'])
    expect(profileQuery?.eqCalls).toContainEqual(['is_available', true])
    expect(profileQuery?.inCalls).toContainEqual(['user_id', ['cleaner-1', 'cleaner-2']])
    expect(profileQuery?.inCalls).toContainEqual(['user_id', ['cleaner-1', 'cleaner-3']])
  })
})
