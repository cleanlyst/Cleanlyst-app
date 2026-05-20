export type Cleaner = {
  id: string;
  name: string;
  businessName: string | null;
  bio: string | null;
  hourlyRate: number;
  hourlyRateCents: number | null;
  currency: string | null;
  rating: number;
  averageRating: number;
  reviewCount: number;
  serviceRadiusKm: number | null;
  avatarUrl: string | null;
  city: string | null;
};
