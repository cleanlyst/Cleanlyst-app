import { chromium } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://wklmgkqgnwhllnywhfhb.supabase.co'
const SERVICE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndrbG1na3FnbndobGxueXdoZmhiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjA3NzczOCwiZXhwIjoyMDkxNjUzNzM4fQ.HX8k2lDHm3AGaI9EDghSfueOsa1u1NEWiDSdPEmZ73o'
const ANON_KEY     = 'sb_publishable_JVZQZGRwhdg9V6u-xkLTpQ__ayDTnL0'

async function main() {
  const sb = createClient(SUPABASE_URL, SERVICE_KEY)
  
  // Get a valid booking ID
  const { data: booking } = await sb.from('bookings')
    .select('id')
    .eq('status', 'pending_request')
    .limit(1)
    .single()
  
  if (!booking) { console.log('No pending booking found'); return }
  console.log('Using booking:', booking.id)
  
  // Sign in as customer to get auth token
  const sbAnon = createClient(SUPABASE_URL, ANON_KEY)
  const { data: auth, error: authErr } = await sbAnon.auth.signInWithPassword({
    email: 'tilda93@hotmail.co.uk',
    password: process.env.E2E_CUSTOMER_PASSWORD || '',
  })
  if (authErr) { console.error('Auth error:', authErr.message); return }
  const token = auth.session?.access_token
  
  // Call the Edge Function to get a checkout URL
  const resp = await fetch(`${SUPABASE_URL}/functions/v1/create-checkout-session`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      booking_id: booking.id,
      success_url: 'http://127.0.0.1:5173/checkout/success',
      cancel_url: 'http://127.0.0.1:5173/checkout/cancel',
    }),
  })
  const data = await resp.json()
  console.log('Edge Function response:', JSON.stringify(data).substring(0, 200))
  
  if (!data.checkout_url && !data.url) { console.log('No checkout URL'); return }
  const checkoutUrl = data.checkout_url ?? data.url
  console.log('Checkout URL:', checkoutUrl.substring(0, 80))
  
  // Launch browser and inspect the page
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  await page.goto(checkoutUrl, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)
  
  // Dump key DOM info
  const info = await page.evaluate(() => {
    const iframes = Array.from(document.querySelectorAll('iframe')).map(f => ({
      name: f.name,
      src: f.src.substring(0, 100),
      ariahidden: f.getAttribute('aria-hidden'),
      id: f.id,
      class: f.className.substring(0, 60),
    }))
    
    const inputs = Array.from(document.querySelectorAll('input')).map(i => ({
      type: i.type,
      placeholder: i.placeholder,
      name: i.name,
      id: i.id,
    }))
    
    const testids = Array.from(document.querySelectorAll('[data-testid]')).map(el => ({
      testid: el.getAttribute('data-testid'),
      tag: el.tagName,
      class: el.className.substring(0, 60),
    }))
    
    return { iframes, inputs, testids }
  })
  
  console.log('\n=== IFRAMES ===')
  info.iframes.forEach((f, i) => console.log(i, JSON.stringify(f)))
  
  console.log('\n=== INPUTS ===')
  info.inputs.forEach(inp => console.log(JSON.stringify(inp)))
  
  console.log('\n=== DATA-TESTID ELEMENTS ===')
  info.testids.forEach(t => console.log(JSON.stringify(t)))
  
  // Click the card accordion button if found
  console.log('\n=== Clicking card-accordion-item-button ===')
  const btn = page.locator('[data-testid="card-accordion-item-button"]')
  const count = await btn.count()
  console.log('card-accordion-item-button count:', count)
  if (count > 0) {
    await btn.click({ force: true })
    console.log('Clicked! Waiting 3s...')
    await page.waitForTimeout(3000)
  }
  
  // Re-check DOM
  const info2 = await page.evaluate(() => {
    const iframes = Array.from(document.querySelectorAll('iframe')).map(f => ({
      name: f.name, src: f.src.substring(0, 100), ariahidden: f.getAttribute('aria-hidden'),
    }))
    const inputs = Array.from(document.querySelectorAll('input')).map(i => ({
      type: i.type, placeholder: i.placeholder, name: i.name,
    }))
    return { iframes, inputs }
  })
  
  console.log('\n=== AFTER CLICK - IFRAMES ===')
  info2.iframes.forEach((f, i) => console.log(i, JSON.stringify(f)))
  
  console.log('\n=== AFTER CLICK - INPUTS ===')
  info2.inputs.forEach(inp => console.log(JSON.stringify(inp)))
  
  // Check all sub-frames
  console.log('\n=== ALL FRAMES ===')
  for (const frame of page.frames()) {
    try {
      const inputs = await frame.evaluate(() => 
        Array.from(document.querySelectorAll('input')).map(i => ({ 
          placeholder: i.placeholder, name: i.name, id: i.id 
        }))
      )
      if (inputs.length > 0) {
        console.log('Frame:', frame.url().substring(0, 80))
        inputs.forEach(inp => console.log('  input:', JSON.stringify(inp)))
      }
    } catch { /* skip */ }
  }
  
  await browser.close()
}

main().catch(console.error)
