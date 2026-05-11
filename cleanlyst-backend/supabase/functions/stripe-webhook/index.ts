import { createClient } from 'jsr:@supabase/supabase-js@2'

function getEnv(name: string): string {
  const value = Deno.env.get(name)
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`)
  }
  return value
}

async function toHex(buffer: ArrayBuffer): Promise<string> {
  const bytes = new Uint8Array(buffer)
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

async function signPayload(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )

  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
  return toHex(signature)
}

async function verifyStripeSignature(payload: string, stripeSignature: string, secret: string): Promise<boolean> {
  const parts = stripeSignature.split(',').map((part) => part.trim())
  const timestamp = parts.find((part) => part.startsWith('t='))?.replace('t=', '')
  const expectedSignature = parts.find((part) => part.startsWith('v1='))?.replace('v1=', '')

  if (!timestamp || !expectedSignature) {
    return false
  }

  const signedPayload = `${timestamp}.${payload}`
  const computed = await signPayload(secret, signedPayload)
  return computed === expectedSignature
}

Deno.serve(async (req) => {
  try {
    const supabaseUrl = getEnv('SUPABASE_URL')
    const serviceRoleKey = getEnv('SUPABASE_SERVICE_ROLE_KEY')
    const webhookSecret = getEnv('STRIPE_WEBHOOK_SECRET')

    const signature = req.headers.get('stripe-signature')
    if (!signature) {
      return new Response(JSON.stringify({ error: 'Missing stripe-signature header' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const rawBody = await req.text()
    const isValid = await verifyStripeSignature(rawBody, signature, webhookSecret)
    if (!isValid) {
      return new Response(JSON.stringify({ error: 'Invalid webhook signature' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const event = JSON.parse(rawBody) as {
      id: string
      type: string
      data: { object: Record<string, unknown> }
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey)
    const { data: existingEvent } = await adminClient
      .from('payment_webhook_events')
      .select('id')
      .eq('stripe_event_id', event.id)
      .maybeSingle()

    if (existingEvent) {
      return new Response(JSON.stringify({ ok: true, deduped: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const { error: insertEventError } = await adminClient.from('payment_webhook_events').insert({
      stripe_event_id: event.id,
      stripe_event_type: event.type,
      payload: event as unknown as Record<string, unknown>,
    })

    if (insertEventError) throw insertEventError

    const object = event.data.object
    const bookingId = String((object.metadata as Record<string, unknown> | undefined)?.booking_id ?? '')

    if (bookingId) {
      if (event.type === 'checkout.session.completed') {
        const paymentIntentId = String(object.payment_intent ?? '')
        const sessionId = String(object.id ?? '')

        await adminClient
          .from('payments')
          .update({
            stripe_checkout_session_id: sessionId,
            stripe_payment_intent_id: paymentIntentId || null,
            status: 'authorized',
            authorized_at: new Date().toISOString(),
            last_webhook_event_id: event.id,
          })
          .eq('booking_id', bookingId)

        await adminClient
          .from('bookings')
          .update({ status: 'payment_authorized' })
          .eq('id', bookingId)
      }

      if (event.type === 'payment_intent.payment_failed') {
        const paymentIntentId = String(object.id ?? '')
        await adminClient
          .from('payments')
          .update({
            status: 'failed',
            failed_at: new Date().toISOString(),
            last_webhook_event_id: event.id,
          })
          .eq('stripe_payment_intent_id', paymentIntentId)
      }

      if (event.type === 'payment_intent.succeeded') {
        const paymentIntentId = String(object.id ?? '')
        await adminClient
          .from('payments')
          .update({
            status: 'captured',
            captured_at: new Date().toISOString(),
            last_webhook_event_id: event.id,
          })
          .eq('stripe_payment_intent_id', paymentIntentId)
      }

      if (event.type === 'charge.refunded') {
        const paymentIntentId = String(object.payment_intent ?? '')
        await adminClient
          .from('payments')
          .update({
            status: 'refunded',
            refunded_at: new Date().toISOString(),
            last_webhook_event_id: event.id,
          })
          .eq('stripe_payment_intent_id', paymentIntentId)

        await adminClient.from('bookings').update({ status: 'refunded' }).eq('id', bookingId)
      }
    }

    // ── transfer.paid: Stripe has settled funds into the cleaner's account ─
    // Fires days after the transfer is created. No booking_id in metadata —
    // look up the payout row via stripe_transfer_id instead.
    if (event.type === 'transfer.paid') {
      const transferId = String(object.id ?? '')
      if (transferId) {
        await adminClient
          .from('payouts')
          .update({ status: 'paid' })
          .eq('stripe_transfer_id', transferId)
      }
    }

    await adminClient
      .from('payment_webhook_events')
      .update({
        processed_at: new Date().toISOString(),
      })
      .eq('stripe_event_id', event.id)

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected webhook error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
