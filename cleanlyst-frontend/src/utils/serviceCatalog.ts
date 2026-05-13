export interface SubService {
  slug: string
  name: string
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
      { slug: 'standard-home-cleaning', name: 'Standard Home Cleaning' },
      { slug: 'deep-cleaning', name: 'Deep Cleaning' },
      { slug: 'end-of-tenancy', name: 'End of Tenancy / Move-In Move-Out' },
      { slug: 'airbnb-turnover', name: 'Airbnb / Holiday Let Turnover' },
      { slug: 'inside-oven', name: 'Inside Oven' },
      { slug: 'inside-fridge', name: 'Inside Fridge/Freezer' },
      { slug: 'inside-cupboards', name: 'Inside Cupboards' },
      { slug: 'laundry-ironing', name: 'Laundry & Ironing' },
      { slug: 'decluttering', name: 'Decluttering / Organising' },
      { slug: 'pet-area', name: 'Pet Area Cleaning' },
    ],
  },
  {
    slug: 'commercial-office',
    name: 'Commercial & Office Cleaning',
    icon: 'business_center',
    subServices: [
      { slug: 'office-cleaning', name: 'Office Cleaning' },
      { slug: 'retail-store', name: 'Retail Store Cleaning' },
      { slug: 'restaurant-kitchen', name: 'Restaurant / Kitchen Hygiene' },
      { slug: 'school-nursery', name: 'School / Nursery Cleaning' },
      { slug: 'healthcare-clinic', name: 'Healthcare / Clinic Cleaning' },
      { slug: 'warehouse-industrial', name: 'Warehouse / Industrial Cleaning' },
      { slug: 'post-construction', name: 'Post-Construction / Builders Clean' },
    ],
  },
  {
    slug: 'windows-glass',
    name: 'Windows & Glass',
    icon: 'window',
    subServices: [
      { slug: 'interior-windows', name: 'Interior Window Cleaning' },
      { slug: 'exterior-windows', name: 'Exterior Window Cleaning' },
      { slug: 'glass-doors-mirrors', name: 'Glass Doors & Mirrors' },
      { slug: 'high-reach-windows', name: 'High-reach Window Cleaning' },
    ],
  },
  {
    slug: 'vehicle-mobility',
    name: 'Vehicle & Mobility Cleaning',
    icon: 'directions_car',
    subServices: [
      { slug: 'car-valet', name: 'Car Valet / Mobile Car Wash' },
      { slug: 'interior-car-shampoo', name: 'Interior Car Shampoo' },
      { slug: 'mobile-bike', name: 'Mobile Bike Cleaning' },
      { slug: 'motorhome-campervan', name: 'Motorhome / Campervan Cleaning' },
      { slug: 'fleet-vehicles', name: 'Fleet Vehicle Cleaning' },
      { slug: 'boat-cleaning', name: 'Boat Cleaning' },
    ],
  },
  {
    slug: 'specialist-interior',
    name: 'Specialist Interior Cleaning',
    icon: 'weekend',
    subServices: [
      { slug: 'carpet-upholstery', name: 'Carpet & Upholstery Cleaning' },
      { slug: 'mattress-cleaning', name: 'Mattress Cleaning' },
      { slug: 'rug-cleaning', name: 'Rug Cleaning' },
      { slug: 'curtain-blind', name: 'Curtain / Blind Cleaning' },
      { slug: 'leather-cleaning', name: 'Leather Cleaning' },
      { slug: 'odour-smoke', name: 'Odour / Smoke Removal' },
      { slug: 'allergen-reduction', name: 'Allergen Reduction Cleaning' },
    ],
  },
  {
    slug: 'exterior-outdoor',
    name: 'Exterior & Outdoor Cleaning',
    icon: 'yard',
    subServices: [
      { slug: 'pressure-washing', name: 'Pressure Washing' },
      { slug: 'gutter-cleaning', name: 'Gutter Cleaning' },
      { slug: 'roof-cleaning', name: 'Roof Cleaning' },
      { slug: 'deck-patio', name: 'Deck / Patio Cleaning' },
      { slug: 'fence-cleaning', name: 'Fence Cleaning' },
      { slug: 'solar-panels', name: 'Solar Panel Cleaning' },
      { slug: 'garden-waste', name: 'Garden Waste / Debris Cleanup' },
    ],
  },
  {
    slug: 'bin-waste',
    name: 'Bin & Waste Cleaning',
    icon: 'delete_sweep',
    subServices: [
      { slug: 'wheelie-bin', name: 'Wheelie Bin Cleaning' },
      { slug: 'recycling-bin', name: 'Recycling Bin Cleaning' },
      { slug: 'food-waste-bin', name: 'Food Waste Bin Cleaning' },
    ],
  },
  {
    slug: 'specialist-high-level',
    name: 'Specialist & High-Level Services',
    icon: 'science',
    subServices: [
      { slug: 'mould-cleaning', name: 'Mould Cleaning' },
      { slug: 'biohazard-cleaning', name: 'Biohazard Cleaning' },
      { slug: 'crime-scene-trauma', name: 'Crime Scene / Trauma Cleaning' },
      { slug: 'pest-prep', name: 'Pest-Prep / Post-Treatment Cleaning' },
    ],
  },
  {
    slug: 'personal-items',
    name: 'Personal Item Cleaning',
    icon: 'dry_cleaning',
    subServices: [
      { slug: 'sneaker-shoe', name: 'Sneaker / Shoe Cleaning' },
      { slug: 'bag-fabric', name: 'Bag / Fabric Item Cleaning' },
    ],
  },
]

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
