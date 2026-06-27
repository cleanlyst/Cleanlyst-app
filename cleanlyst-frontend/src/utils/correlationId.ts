// Session-scoped correlation ID — generated once per browser session.
// Included in every structured log and error report so a full request trace
// can be reconstructed from the admin monitoring dashboard.

const SESSION_KEY = 'clnst_cid'

function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`
}

function getOrCreate(): string {
  try {
    const existing = sessionStorage.getItem(SESSION_KEY)
    if (existing) return existing
    const id = generateId()
    sessionStorage.setItem(SESSION_KEY, id)
    return id
  } catch {
    return generateId()
  }
}

export const correlationId: string = getOrCreate()
