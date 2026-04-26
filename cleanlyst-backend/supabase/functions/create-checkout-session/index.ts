import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function getEnv(name: string): string {
  const value = Deno.env.get(name)
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`)
  }

  return value
}

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

    const supabaseUrl = getEnv('SUPABASE_URL')
    const supabaseAnonKey = getEnv('SUPABASE_ANON_KEY')
    const supabaseServiceRoleKey = getEnv('SUPABASE_SERVICE_ROLE_KEY')
    const stripeSecretKey = getEnv('STRIPE_SECRET_KEY')
    const frontendSuccessUrl = getEnv('CHECKOUT_SUCCESS_URL')
    const frontendCancelUrl = getEnv('CHECKOUT_CANCEL_URL')

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
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

    const { booking_id } = await req.json()
    if (!booking_id) {
      return new Response(JSON.stringify({ error: 'booking_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: booking, error: bookingError } = await adminClient
      .from('bookings')
      .select('id, customer_id, status, quote_cents, currency, service_title_snapshot')
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

    if (booking.status !== 'awaiting_customer_payment') {
      return new Response(JSON.stringify({ error: 'Booking is not payable in current state' }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const amountCents = Math.max(Number(booking.quote_cents ?? 0), 0)
    const currency = String(booking.currency ?? 'GBP').toLowerCase()
    const serviceName = booking.service_title_snapshot ?? 'Cleaning service'

    const params = new URLSearchParams({
      mode: 'payment',
      success_url: `${frontendSuccessUrl}?booking_id=${booking.id}`,
      cancel_url: `${frontendCancelUrl}?booking_id=${booking.id}`,
      'line_items[0][price_data][currency]': currency,
      'line_items[0][price_data][product_data][name]': serviceName,
      'line_items[0][price_data][unit_amount]': String(amountCents),
      'line_items[0][quantity]': '1',
      'payment_intent_data[capture_method]': 'manual',
      'metadata[booking_id]': booking.id,
      'metadata[customer_id]': booking.customer_id,
    })

    const session = await createStripeCheckoutSession(params, stripeSecretKey)

    const paymentPayload = {
      booking_id: booking.id,
      stripe_checkout_session_id: session.id as string,
      stripe_payment_intent_id: typeof session.payment_intent === 'string' ? session.payment_intent : null,
      status: 'unpaid',
      amount_cents: amountCents,
      currency: booking.currency,
      metadata: {
        checkout_url: session.url,
      },
    }

    const { error: paymentError } = await adminClient.from('payments').upsert(paymentPayload, {
      onConflict: 'booking_id',
    })

    if (paymentError) {
      throw paymentError
    }

    return new Response(
      JSON.stringify({
        checkout_url: session.url,
        checkout_session_id: session.id,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
