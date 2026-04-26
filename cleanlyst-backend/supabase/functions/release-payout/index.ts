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

async function stripeRequest(path: string, body: URLSearchParams, stripeSecretKey: string) {
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${stripeSecretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  })

  if (!response.ok) {
    throw new Error(await response.text())
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

    const { booking_id } = await req.json()
    if (!booking_id) {
      return new Response(JSON.stringify({ error: 'booking_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = getEnv('SUPABASE_URL')
    const supabaseAnonKey = getEnv('SUPABASE_ANON_KEY')
    const serviceRoleKey = getEnv('SUPABASE_SERVICE_ROLE_KEY')
    const stripeSecretKey = getEnv('STRIPE_SECRET_KEY')

    const adminClient = createClient(supabaseUrl, serviceRoleKey)
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: userData } = await userClient.auth.getUser()
    if (!userData.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: actorProfile } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', userData.user.id)
      .single()

    if (!actorProfile || actorProfile.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Admin only operation' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: booking, error: bookingError } = await adminClient
      .from('bookings')
      .select('id, cleaner_id, status, cleaner_payout_cents, currency')
      .eq('id', booking_id)
      .single()

    if (bookingError || !booking) {
      return new Response(JSON.stringify({ error: 'Booking not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (booking.status !== 'completed') {
      return new Response(JSON.stringify({ error: 'Booking is not completed' }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: payment } = await adminClient
      .from('payments')
      .select('id, stripe_payment_intent_id, status')
      .eq('booking_id', booking_id)
      .single()

    if (!payment?.stripe_payment_intent_id) {
      return new Response(JSON.stringify({ error: 'Missing payment intent for booking' }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (payment.status === 'authorized') {
      await stripeRequest(
        `payment_intents/${payment.stripe_payment_intent_id}/capture`,
        new URLSearchParams({}),
        stripeSecretKey,
      )

      await adminClient
        .from('payments')
        .update({ status: 'captured', captured_at: new Date().toISOString() })
        .eq('id', payment.id)
    }

    const { data: cleanerProfile } = await adminClient
      .from('cleaner_profiles')
      .select('stripe_account_id')
      .eq('user_id', booking.cleaner_id)
      .single()

    if (!cleanerProfile?.stripe_account_id) {
      return new Response(JSON.stringify({ error: 'Cleaner has no Stripe connected account' }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const transfer = await stripeRequest(
      'transfers',
      new URLSearchParams({
        amount: String(booking.cleaner_payout_cents),
        currency: String(booking.currency ?? 'GBP').toLowerCase(),
        destination: cleanerProfile.stripe_account_id,
        'metadata[booking_id]': booking.id,
      }),
      stripeSecretKey,
    )

    await adminClient.from('payouts').upsert(
      {
        booking_id: booking.id,
        cleaner_id: booking.cleaner_id,
        payment_id: payment.id,
        amount_cents: booking.cleaner_payout_cents,
        currency: booking.currency,
        stripe_transfer_id: transfer.id as string,
        status: 'released',
        released_at: new Date().toISOString(),
      },
      { onConflict: 'booking_id' },
    )

    return new Response(JSON.stringify({ ok: true, transfer_id: transfer.id }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
