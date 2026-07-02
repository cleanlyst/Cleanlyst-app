import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function getEnv(name: string): string {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`Missing environment variable: ${name}`)
  return value
}

// Booking statuses that are eligible for a Stripe checkout session.
//   pending_request               — initial payment (wizard flow, immediate after booking creation)
//   awaiting_customer_payment     — additional payment explicitly requested by cleaner (legacy)
//   estimate_proposed             — additional payment for a revised estimate (legacy)
//   estimate_adjustment_requested — additional payment for a price adjustment (new Pay-Before-Accept flow)
const PAYABLE_STATUSES = new Set([
  'pending_request',
  'awaiting_customer_payment',
  'estimate_proposed',
  'estimate_adjustment_requested',
])

async function createStripeCheckoutSession(params: URLSearchParams, stripeSecretKey: string) {
  const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${stripeSecretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  })

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`Stripe checkout session failed: ${errorBody}`)
  }

  return response.json()
}

function isValidHttpUrl(raw: string): boolean {
  try {
    const url = new URL(raw)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl          = getEnv('SUPABASE_URL')
    const supabaseAnonKey      = getEnv('SUPABASE_ANON_KEY')
    const supabaseServiceRoleKey = getEnv('SUPABASE_SERVICE_ROLE_KEY')
    const stripeSecretKey      = getEnv('STRIPE_SECRET_KEY')

    const userClient  = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey)

    const { data: userData, error: userError } = await userClient.auth.getUser()
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json()
    const { booking_id, success_url: bodySuccessUrl, cancel_url: bodyCancelUrl } = body as {
      booking_id: string
      success_url?: string
      cancel_url?: string
    }

    if (!booking_id) {
      return new Response(JSON.stringify({ error: 'booking_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Resolve success/cancel URLs: prefer request body, fall back to env vars.
    // Body-supplied URLs are validated to be http(s) to prevent open-redirect injection.
    const envSuccessUrl = Deno.env.get('CHECKOUT_SUCCESS_URL') ?? ''
    const envCancelUrl  = Deno.env.get('CHECKOUT_CANCEL_URL')  ?? ''

    const rawSuccessUrl = (bodySuccessUrl && isValidHttpUrl(bodySuccessUrl)) ? bodySuccessUrl : envSuccessUrl
    const rawCancelUrl  = (bodyCancelUrl  && isValidHttpUrl(bodyCancelUrl))  ? bodyCancelUrl  : envCancelUrl

    if (!rawSuccessUrl || !rawCancelUrl) {
      return new Response(JSON.stringify({
        error: 'success_url and cancel_url are required (pass in request body or set CHECKOUT_SUCCESS_URL/CHECKOUT_CANCEL_URL env vars)',
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: booking, error: bookingError } = await adminClient
      .from('bookings')
      .select('id, customer_id, status, quote_cents, adjustment_amount_cents, currency, service_title_snapshot')
      .eq('id', booking_id)
      .single()

    if (bookingError || !booking) {
      return new Response(JSON.stringify({ error: 'Booking not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (booking.customer_id !== userData.user.id) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!PAYABLE_STATUSES.has(booking.status)) {
      return new Response(JSON.stringify({
        error: `Booking is not payable in status "${booking.status}". Payable statuses: ${[...PAYABLE_STATUSES].join(', ')}.`,
      }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // For estimate_adjustment_requested: charge only the difference (adjustment_amount_cents).
    // For all other payable statuses: charge the full quote_cents.
    const isAdjustmentPayment = booking.status === 'estimate_adjustment_requested'
    const amountCents = isAdjustmentPayment
      ? Math.max(Number(booking.adjustment_amount_cents ?? 0), 0)
      : Math.max(Number(booking.quote_cents ?? 0), 0)

    if (isAdjustmentPayment && amountCents <= 0) {
      return new Response(JSON.stringify({
        error: 'Adjustment amount is zero or negative — no Stripe checkout required. Use accept_price_adjustment_no_charge RPC instead.',
      }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const currency    = String(booking.currency ?? 'GBP').toLowerCase()
    const serviceName = booking.service_title_snapshot ?? 'Cleaning service'
    const lineItemName = isAdjustmentPayment
      ? `${serviceName} — price adjustment`
      : serviceName

    const params = new URLSearchParams({
      mode:                                      'payment',
      success_url:                               `${rawSuccessUrl}?booking_id=${booking.id}`,
      cancel_url:                                `${rawCancelUrl}?booking_id=${booking.id}`,
      'line_items[0][price_data][currency]':     currency,
      'line_items[0][price_data][product_data][name]': lineItemName,
      'line_items[0][price_data][unit_amount]':  String(amountCents),
      'line_items[0][quantity]':                 '1',
      'payment_intent_data[capture_method]':     'manual',
      'metadata[booking_id]':                    booking.id,
      'metadata[customer_id]':                   booking.customer_id,
      'metadata[payment_type]':                  isAdjustmentPayment ? 'adjustment' : 'initial',
    })

    const session = await createStripeCheckoutSession(params, stripeSecretKey)

    const paymentPayload = {
      booking_id:                  booking.id,
      stripe_checkout_session_id:  session.id as string,
      stripe_payment_intent_id:    typeof session.payment_intent === 'string' ? session.payment_intent : null,
      status:                      'unpaid',
      amount_cents:                amountCents,
      currency:                    booking.currency,
      metadata:                    { checkout_url: session.url },
    }

    const { error: paymentError } = await adminClient.from('payments').upsert(paymentPayload, {
      onConflict: 'booking_id',
    })

    if (paymentError) throw paymentError

    return new Response(
      JSON.stringify({ checkout_url: session.url, checkout_session_id: session.id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const isMissingEnv = message.startsWith('Missing environment variable')
    return new Response(
      JSON.stringify({
        success: false,
        code: isMissingEnv ? 'MISSING_ENV' : 'INTERNAL_ERROR',
        message: isMissingEnv
          ? 'Server configuration error. Contact support.'
          : 'An unexpected error occurred. Please try again.',
        details: message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }
})
