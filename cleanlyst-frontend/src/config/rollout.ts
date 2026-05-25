export const ROLLOUT_CONFIG = {
  country: 'United Kingdom',
  cities: ['Wigan'],
} as const

export type RolloutCity = (typeof ROLLOUT_CONFIG.cities)[number]

export function isCityEnabled(city: string): boolean {
  return ROLLOUT_CONFIG.cities.some((c) => c.toLowerCase() === city.trim().toLowerCase())
}

export const ROLLOUT_UNAVAILABLE_MESSAGE =
  'Cleanlyst is currently launching in Wigan. More areas coming soon.'
