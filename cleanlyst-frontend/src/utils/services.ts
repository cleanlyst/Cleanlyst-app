export const SERVICES_HERO_TITLE = 'Professional Cleaning Services'

export const SERVICES_HERO_COPY =
  'Vetted, insured cleaners for every home. Book instantly with upfront pricing, or send a custom request and chat directly with your cleaner.'

export interface ServiceItem {
  slug: string
  title: string
  description: string
  icon: string
  span?: 'wide' | 'full'
}

export const SERVICES: ServiceItem[] = [
  {
    slug: 'standard-cleaning',
    title: 'Standard Cleaning',
    description:
      'Regular maintenance cleaning for apartments and houses. Includes vacuuming, mopping, dusting, and kitchen and bathroom sanitation.',
    icon: 'cleaning_services',
  },
  {
    slug: 'deep-cleaning',
    title: 'Deep Cleaning',
    description:
      'A thorough top-to-bottom clean for homes that need extra attention. Inside appliances, skirting boards, hard-to-reach areas, and more.',
    icon: 'sanitizer',
    span: 'wide',
  },
  {
    slug: 'airbnb-turnover',
    title: 'Airbnb / Holiday Let Turnover',
    description:
      'Fast, reliable changeover cleaning between guests. Linen change, restocking essentials, and a quick property inspection report.',
    icon: 'bed',
  },
  {
    slug: 'end-of-tenancy',
    title: 'End of Tenancy Cleaning',
    description:
      'Comprehensive move-out clean to landlord and letting agency standards. Designed to protect your deposit and satisfy checkout reports.',
    icon: 'key',
    span: 'full',
  },
]

export interface AddOnItem {
  slug: string
  title: string
  description: string
  icon: string
  pricePence: number
}

export const ADD_ONS: AddOnItem[] = [
  {
    slug: 'oven-cleaning',
    title: 'Oven Cleaning',
    description: 'Full interior oven clean including racks, glass door, and grill pan.',
    icon: 'microwave',
    pricePence: 2500,
  },
  {
    slug: 'fridge-cleaning',
    title: 'Fridge Cleaning',
    description: 'Complete interior fridge and freezer clean including shelves and drawers.',
    icon: 'kitchen',
    pricePence: 1500,
  },
  {
    slug: 'laundry',
    title: 'Laundry',
    description: 'Washing and drying one load of laundry during the clean.',
    icon: 'local_laundry_service',
    pricePence: 2000,
  },
]
