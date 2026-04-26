import { getSupabaseClient } from '@/services/supabaseClient'

const functionsBaseUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`

async function callFunction<TPayload extends object>(
  functionName: string,
  payload: TPayload,
) {
  const supabase = getSupabaseClient()
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
  if (sessionError) throw sessionError

  const token = sessionData.session?.access_token
  if (!token) throw new Error('Missing auth token')

  const response = await fetch(`${functionsBaseUrl}/${functionName}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  const data = await response.json()
  if (!response.ok) {
    throw new Error(data.error ?? 'Function call failed')
  }

  return data
}

export async function createCheckoutSession(bookingId: string) {
  return callFunction('create-checkout-session', { booking_id: bookingId })
}

export async function releasePayout(bookingId: string) {
  return callFunction('release-payout', { booking_id: bookingId })
}
