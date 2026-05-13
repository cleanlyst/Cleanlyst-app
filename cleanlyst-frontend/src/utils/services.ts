export const SERVICES_HERO_TITLE = 'Our Cleaning Services'

export const SERVICES_HERO_COPY =
  'Professional, reliable cleaning solutions tailored to your needs. From routine home upkeep to specialized industrial deep cleans, our marketplace connects you with vetted professionals for every surface.'

export interface ServiceItem {
  slug: string
  title: string
  description: string
  icon: string
  span?: 'wide' | 'full'
}

export const SERVICES: ServiceItem[] = [
  {
    slug: 'home-cleaning',
    title: 'Home Cleaning',
    description:
      'Routine cleaning for apartments, houses, and everyday household upkeep. Includes dusting, vacuuming, and kitchen sanitation.',
    icon: 'home',
  },
  {
    slug: 'commercial-office-cleaning',
    title: 'Commercial & Office Cleaning',
    description:
      'Reliable cleaning for offices, shops, studios, and shared workspaces. Custom schedules to fit your business hours.',
    icon: 'corporate_fare',
  },
  {
    slug: 'windows-glass',
    title: 'Windows & Glass',
    description:
      'Cleaning for windows, mirrors, partitions, and glass surfaces inside and out. Streak-free finishes for maximum clarity.',
    icon: 'window',
  },
  {
    slug: 'vehicle-mobility-cleaning',
    title: 'Vehicle & Mobility Cleaning',
    description:
      'Interior and surface cleaning for cars, vans, and mobility equipment. Specialized care for leather and hard surfaces.',
    icon: 'directions_car',
  },
  {
    slug: 'specialist-interior-cleaning',
    title: 'Specialist Interior Cleaning',
    description:
      'Focused cleaning for carpets, upholstery, mattresses, and delicate interior finishes. Advanced stain removal techniques.',
    icon: 'texture',
    span: 'wide',
  },
  {
    slug: 'exterior-outdoor-cleaning',
    title: 'Exterior & Outdoor Cleaning',
    description:
      'Practical cleaning for patios, driveways, garden areas, and outdoor surfaces. Power washing and seasonal maintenance.',
    icon: 'deck',
  },
  {
    slug: 'bin-waste-cleaning',
    title: 'Bin & Waste Cleaning',
    description:
      'Sanitising and refreshing bins, waste storage areas, and high-use disposal spaces. Odor elimination and hygiene focus.',
    icon: 'delete_outline',
  },
  {
    slug: 'specialist-high-level-services',
    title: 'Specialist & High-Level Services',
    description:
      'Support for deep cleans, post-build work, and harder-to-reach areas. Professional equipment for industrial standards.',
    icon: 'architecture',
  },
  {
    slug: 'personal-item-cleaning',
    title: 'Personal Item Cleaning',
    description:
      'Care for selected personal items such as trainers, bags, curtains, and more. Detailed restoration for items that require a professional touch.',
    icon: 'apparel',
    span: 'full',
  },
]
