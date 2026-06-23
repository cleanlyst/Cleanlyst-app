import type { Page, CDPSession } from '@playwright/test'

/**
 * network.ts — CDP-based network condition helpers for stress tests.
 *
 * All helpers return a restore function. Call it at the end of your test to
 * return to normal conditions:
 *
 *   const restore = await throttle3G(page)
 *   // ... test ...
 *   await restore()
 */

async function getCDP(page: Page): Promise<CDPSession> {
  return page.context().newCDPSession(page)
}

export interface NetworkProfile {
  downloadThroughput: number
  uploadThroughput:   number
  latency:            number
}

export const NETWORK_PROFILES: Record<string, NetworkProfile> = {
  offline:  { downloadThroughput: 0,         uploadThroughput: 0,         latency: 0     },
  slow3g:   { downloadThroughput: 50_000,     uploadThroughput: 20_000,    latency: 2000  },
  fast3g:   { downloadThroughput: 1_500_000,  uploadThroughput: 750_000,   latency: 100   },
  fast4g:   { downloadThroughput: 4_000_000,  uploadThroughput: 3_000_000, latency: 20    },
}

export async function setNetworkCondition(
  page: Page,
  profile: NetworkProfile,
): Promise<() => Promise<void>> {
  const client = await getCDP(page)
  await client.send('Network.enable')
  await client.send('Network.emulateNetworkConditions', {
    offline:              profile.downloadThroughput === 0,
    downloadThroughput:   profile.downloadThroughput,
    uploadThroughput:     profile.uploadThroughput,
    latency:              profile.latency,
  })
  return async () => {
    await client.send('Network.emulateNetworkConditions', {
      offline:              false,
      downloadThroughput:   -1,
      uploadThroughput:     -1,
      latency:              0,
    })
  }
}

export async function goOffline(page: Page): Promise<() => Promise<void>> {
  return setNetworkCondition(page, NETWORK_PROFILES.offline)
}

export async function throttle3G(page: Page): Promise<() => Promise<void>> {
  return setNetworkCondition(page, NETWORK_PROFILES.slow3g)
}

/**
 * Intercept all requests to Supabase and delay them by `ms` milliseconds.
 * Useful for testing loading states.
 */
export async function delaySupabaseRequests(page: Page, ms: number): Promise<() => Promise<void>> {
  await page.route('**/rest/v1/**', async (route) => {
    await new Promise((r) => setTimeout(r, ms))
    await route.continue()
  })
  return async () => {
    await page.unroute('**/rest/v1/**')
  }
}

/**
 * Intercept a specific Supabase table request and return an error response.
 * Useful for testing error state handling.
 */
export async function interceptWithError(
  page: Page,
  tablePattern: string,
): Promise<() => Promise<void>> {
  const pattern = `**/rest/v1/${tablePattern}**`
  await page.route(pattern, async (route) => {
    await route.fulfill({ status: 503, body: JSON.stringify({ message: 'Service unavailable' }) })
  })
  return async () => {
    await page.unroute(pattern)
  }
}
