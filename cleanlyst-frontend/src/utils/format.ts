// ── Currency ───────────────────────────────────────────────────────────────

export function formatPence(pence: number | null | undefined, currency = 'GBP'): string {
  if (pence == null) return '—'
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(pence / 100)
}

export function formatCurrency(amount: number | null | undefined, currency = 'GBP'): string {
  if (amount == null) return '—'
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(amount)
}

// ── Date / Time ────────────────────────────────────────────────────────────

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—'
  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date.valueOf())) return 'Invalid date'
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(date)
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '—'
  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date.valueOf())) return 'Invalid date'
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

export function formatRelativeTime(value: string | Date | null | undefined): string {
  if (!value) return '—'
  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date.valueOf())) return 'Invalid date'

  const diffMs = Date.now() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)

  if (diffSec < 60) return 'Just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHour < 24) return `${diffHour}h ago`
  if (diffDay < 7) return `${diffDay}d ago`

  return formatDate(date)
}

// ── Strings ────────────────────────────────────────────────────────────────

export function formatStatus(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export function truncate(value: string, max = 80): string {
  return value.length > max ? `${value.slice(0, max)}…` : value
}

// ── Error messages ─────────────────────────────────────────────────────────

const TECHNICAL_PATTERNS = [
  /column reference/i,
  /ambiguous/i,
  /relation .* does not exist/i,
  /syntax error/i,
  /function .* does not exist/i,
  /invalid input syntax/i,
  /violates.*constraint/i,
  /null value in column/i,
  /duplicate key value/i,
  /permission denied for/i,
  /JWT.*expired/i,
  /PGRST\d+/,
  /ERROR:/i,
]

/**
 * Converts a raw error to a user-friendly message.
 * Strips technical PostgreSQL / network details from user-facing copy.
 */
export function toUserMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (!error) return fallback
  const raw = error instanceof Error ? error.message : String(error)
  for (const pattern of TECHNICAL_PATTERNS) {
    if (pattern.test(raw)) return fallback
  }
  if (raw.length > 300) return fallback
  return raw || fallback
}

// ── Numbers ────────────────────────────────────────────────────────────────

export function formatRating(rating: number | null | undefined, reviews?: number): string {
  if (rating == null) return 'No rating yet'
  const star = rating.toFixed(1)
  return reviews != null ? `${star} (${reviews} review${reviews !== 1 ? 's' : ''})` : star
}
