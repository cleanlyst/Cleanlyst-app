const PRODUCTION_DOMAINS = [
  'cleanlyst.co.uk',
  'www.cleanlyst.co.uk',
  'cleanlyst.app',
  'www.cleanlyst.app',
] as const

export function isProductionEnvironment(): boolean {
  if (typeof window === 'undefined') {
    return false
  }

  const hostname = window.location.hostname.toLowerCase()

  const isProductionDomain =
    (PRODUCTION_DOMAINS as readonly string[]).includes(hostname)

  // Vercel automatically injects this:
  // production | preview | development
  const vercelEnv =
    import.meta.env.VITE_VERCEL_ENV ??
    import.meta.env.VERCEL_ENV ??
    'development'

  return isProductionDomain && vercelEnv === 'production'
}

export function getEnvironmentName(): 'production' | 'staging' {
  return isProductionEnvironment()
    ? 'production'
    : 'staging'
}

export function logEnvironmentInfo(): void {
  if (import.meta.env.DEV) {
    const hostname =
      typeof window !== 'undefined'
        ? window.location.hostname
        : 'unknown'

    const vercelEnv =
      import.meta.env.VITE_VERCEL_ENV ??
      import.meta.env.VERCEL_ENV ??
      'development'

    console.log(
      `[Environment] Mode: ${getEnvironmentName()} | Hostname: ${hostname} | Vercel: ${vercelEnv}`,
    )
  }
}