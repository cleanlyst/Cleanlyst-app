/**
 * testUsers.ts — Lazily-resolved E2E user IDs for the admin-acceptance suite.
 *
 * Call `resolveTestUsers()` in beforeAll hooks. IDs are cached after first call.
 */
import { getUserIdByEmail } from './db'

let customerId: string | null = null
let cleanerId:  string | null = null

export async function resolveTestUsers(): Promise<{ customerId: string; cleanerId: string }> {
  if (!customerId) {
    customerId = await getUserIdByEmail(process.env.E2E_CUSTOMER_EMAIL!)
  }
  if (!cleanerId) {
    cleanerId = await getUserIdByEmail(process.env.E2E_CLEANER_EMAIL!)
  }
  return { customerId: customerId!, cleanerId: cleanerId! }
}
