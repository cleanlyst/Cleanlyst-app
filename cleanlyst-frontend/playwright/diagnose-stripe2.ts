import { chromium } from '@playwright/test'

const CHECKOUT_URL = 'https://checkout.stripe.com/c/pay/cs_test_a1Tch3XhC8MCIW5nFVKAE5XRGjUYs7KkcshVNzC0bVmJeySXc9yBexH1Qq#fidnandhYHdWcXxpYCc%2FJ2FgY2RwaXEnKSdicGRmZGhqaWBTZHdsZGtxJz8nZmprcXdqaScpJ2R1bE5gfCc%2FJ3VuWnFgdnFaMDRRb2MwUU5AN3NSSUZxMWFXMGNnRzJdRGoxZkBoZmpsT3RXfGN0d11XR0JRa0liYTE0XEFhfGF%2FdGQxR0hJbnRVT3Y3X1A0dk9dbmhsU2dpbjdIVzRVSWk1NX1Lc05TcX9oJyknY3dqaFZgd3Ngdyc%2FcXdwYCknZ2RmbmJ3anBrYUZqaWp3Jz8nJmNjY2NjYycpJ2lkfGpwcVF8dWAnPyd2bGtiaWBabHFgaCcpJ2BrZGdpYFVpZGZgbWppYWB3dic%2FcXdwYHgl'

async function main() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  
  console.log('Navigating to Stripe checkout...')
  await page.goto(CHECKOUT_URL, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(4000)
  
  console.log('Current URL:', page.url())
  
  // Dump all inputs across the MAIN FRAME
  const mainInputs = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('input, [role="textbox"], [contenteditable]')).map(el => ({
      tag: el.tagName,
      type: el.getAttribute('type'),
      placeholder: el.getAttribute('placeholder'),
      ariaLabel: el.getAttribute('aria-label'),
      name: el.getAttribute('name'),
      id: el.id,
      class: el.className.substring(0, 50),
    }))
  })
  console.log('\n=== MAIN FRAME INPUTS ===')
  mainInputs.forEach(i => console.log(JSON.stringify(i)))
  
  // List all iframes
  const iframes = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('iframe')).map(f => ({
      name: f.name,
      src: f.src.substring(0, 100),
      ariaHidden: f.getAttribute('aria-hidden'),
      allow: f.getAttribute('allow'),
      id: f.id,
    }))
  })
  console.log('\n=== IFRAMES ===')
  iframes.forEach((f, i) => console.log(i, JSON.stringify(f)))
  
  // Check data-testid elements
  const testids = await page.evaluate(() =>
    Array.from(document.querySelectorAll('[data-testid]')).map(el => ({
      testid: el.getAttribute('data-testid'),
      tag: el.tagName,
      class: el.className.substring(0, 60),
      ariaLabel: el.getAttribute('aria-label'),
    }))
  )
  console.log('\n=== DATA-TESTID ELEMENTS ===')
  testids.forEach(t => console.log(JSON.stringify(t)))
  
  // Click the card accordion button
  console.log('\n=== Clicking card-accordion-item-button ===')
  const btn = page.locator('[data-testid="card-accordion-item-button"]')
  const count = await btn.count()
  console.log('Button count on main page:', count)
  if (count > 0) {
    const cls = await btn.getAttribute('class')
    console.log('Button class:', cls)
    await btn.click({ force: true })
    console.log('Clicked! Waiting 3s...')
    await page.waitForTimeout(3000)
  }
  
  // After click: check all frames for inputs
  console.log('\n=== ALL FRAMES AFTER CLICK ===')
  for (const frame of page.frames()) {
    try {
      const url = frame.url()
      const inputs = await frame.evaluate(() =>
        Array.from(document.querySelectorAll('input, [role="textbox"]')).map(el => ({
          tag: el.tagName,
          type: el.getAttribute('type'),
          placeholder: el.getAttribute('placeholder'),
          ariaLabel: el.getAttribute('aria-label'),
          name: el.getAttribute('name'),
        }))
      )
      if (inputs.length > 0) {
        console.log(`\nFrame [${url.substring(0, 80)}]:`)
        inputs.forEach(i => console.log('  ', JSON.stringify(i)))
      }
    } catch { /* skip inaccessible */ }
  }
  
  // Screenshot
  await page.screenshot({ path: '/tmp/stripe-after-click.png', fullPage: true })
  console.log('\nScreenshot saved to /tmp/stripe-after-click.png')
  
  await browser.close()
}

main().catch(console.error)
