export const COUNTRIES = ['United Kingdom'] as const

export type Country = (typeof COUNTRIES)[number]
