export interface SubService {
  slug: string
  name: string
  description?: string
  icon?: string
}

export interface ServiceCategory {
  slug: string
  name: string
  icon: string
  subServices: SubService[]
}

export const SERVICE_CATALOG: ServiceCategory[] = [
  {
    slug: 'home-cleaning',
    name: 'Home Cleaning',
    icon: 'home',
    subServices: [
      {
        slug: 'standard-cleaning',
        name: 'Standard Cleaning',
        description:
          'Regular home cleaning including vacuuming, mopping, dusting, and bathroom sanitation.',
        icon: 'cleaning_services',
      },
      {
        slug: 'deep-cleaning',
        name: 'Deep Cleaning',
        description:
          'Thorough top-to-bottom clean including inside appliances, skirting boards, and hard-to-reach areas.',
        icon: 'sanitizer',
      },
      {
        slug: 'airbnb-turnover',
        name: 'Airbnb / Holiday Let Turnover',
        description:
          'Fast, efficient changeover cleaning between guests. Includes linen change, restocking, and inspection.',
        icon: 'bed',
      },
      {
        slug: 'end-of-tenancy',
        name: 'End of Tenancy Cleaning',
        description:
          'Comprehensive move-out clean to meet landlord and agency standards. Deposit protection standard.',
        icon: 'key',
      },
    ],
  },
  {
    slug: 'add-ons',
    name: 'Add-ons',
    icon: 'add_circle',
    subServices: [
      {
        slug: 'oven-cleaning',
        name: 'Oven Cleaning',
        description: 'Full interior oven clean including racks, glass door, and grill pan.',
        icon: 'microwave',
      },
      {
        slug: 'fridge-cleaning',
        name: 'Fridge Cleaning',
        description: 'Complete interior fridge and freezer clean including shelves and drawers.',
        icon: 'kitchen',
      },
      {
        slug: 'laundry',
        name: 'Laundry',
        description: 'Washing and drying one load of laundry during the clean.',
        icon: 'local_laundry_service',
      },
    ],
  },
]

export const CORE_SERVICE_CATEGORY = SERVICE_CATALOG[0]!
export const ADDON_CATEGORY = SERVICE_CATALOG[1]!

export const ADD_ON_PRICES_PENCE: Record<string, number> = {
  'oven-cleaning': 2500,
  'fridge-cleaning': 1500,
  laundry: 2000,
}

export const PROPERTY_SIZE_OPTIONS = [
  { value: 'studio', label: 'Studio / Bedsit', multiplier: 0.8 },
  { value: '1bed', label: '1 Bedroom', multiplier: 1.0 },
  { value: '2bed', label: '2 Bedrooms', multiplier: 1.3 },
  { value: '3bed', label: '3 Bedrooms', multiplier: 1.6 },
  { value: '4bed', label: '4+ Bedrooms', multiplier: 2.0 },
] as const

export const CORE_SERVICE_MATCH_KEYWORDS: Record<string, string[]> = {
  'standard-cleaning': ['standard', 'regular', 'maintenance'],
  'deep-cleaning': ['deep', 'deep clean', 'deep-cleaning', 'deep cleaning'],
  'airbnb-turnover': ['airbnb', 'holiday let', 'turnover', 'changeover', 'vacation rental'],
  'end-of-tenancy': [
    'end of tenancy',
    'move-in',
    'move-out',
    'moveout',
    'movein',
    'tenancy',
    'move in',
    'move out',
  ],
}

export const DURATION_OPTIONS: { label: string; minutes: number }[] = [
  { label: '30 min', minutes: 30 },
  { label: '45 min', minutes: 45 },
  { label: '1 hour', minutes: 60 },
  { label: '1.5 hours', minutes: 90 },
  { label: '2 hours', minutes: 120 },
  { label: '2.5 hours', minutes: 150 },
  { label: '3 hours', minutes: 180 },
  { label: '3.5 hours', minutes: 210 },
  { label: '4 hours', minutes: 240 },
  { label: '5 hours', minutes: 300 },
  { label: '6 hours', minutes: 360 },
  { label: '7 hours', minutes: 420 },
  { label: '8 hours', minutes: 480 },
  { label: 'Full day (8h+)', minutes: 600 },
]

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}
