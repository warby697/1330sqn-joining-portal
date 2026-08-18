import { FEE_AMOUNT_PENCE } from '../../src/lib/pricing.js'
import { paymentReturnUrls } from './_payment-return.mjs'

const STRIPE_API = process.env.STRIPE_API || 'https://api.stripe.com'

// Stripe's REST API takes form-encoded bodies with bracketed keys for nesting,
// so we flatten the object rather than pulling in the SDK. Keeping this on plain
// fetch matches the GoCardless functions and avoids an ESM bundling dependency.
function formEncode(values, prefix = '') {
  const params = new URLSearchParams()
  const walk = (value, key) => {
    if (value === undefined || value === null || value === '') return
    if (typeof value === 'object') {
      for (const [childKey, childValue] of Object.entries(value)) {
        walk(childValue, key ? `${key}[${childKey}]` : childKey)
      }
      return
    }
    params.append(key, String(value))
  }
  walk(values, prefix)
  return params.toString()
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

export default async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })
  if (!process.env.STRIPE_SECRET_KEY) return json({ error: 'STRIPE_SECRET_KEY is not configured' }, 500)

  const { reference, givenName, familyName, email, returnUrl } = await req.json()
  if (!reference || !email || !returnUrl) return json({ error: 'Missing reference, email or returnUrl' }, 400)

  // The session id is not known until Stripe replies, so the return URL carries the
  // placeholder Stripe substitutes on redirect. The parent's own route (with the family
  // access token) stays in sessionStorage and is never sent to Stripe.
  // URLSearchParams percent-encodes the braces, but Stripe only substitutes the literal
  // token, so put it back after the URL is built.
  const SESSION_PLACEHOLDER = '{CHECKOUT_SESSION_ID}'
  const restore = (value) => value.replace(encodeURIComponent(SESSION_PLACEHOLDER), SESSION_PLACEHOLDER)
  const { redirectUri, exitUri } = paymentReturnUrls(returnUrl, 'fee', SESSION_PLACEHOLDER)

  const res = await fetch(`${STRIPE_API}/v1/checkout/sessions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formEncode({
      mode: 'payment',
      success_url: restore(redirectUri),
      cancel_url: restore(exitUri),
      customer_email: email,
      client_reference_id: reference,
      line_items: {
        0: {
          quantity: 1,
          price_data: {
            currency: 'gbp',
            unit_amount: FEE_AMOUNT_PENCE,
            product_data: { name: '1330 Squadron joining fee' },
          },
        },
      },
      payment_intent_data: {
        description: `1330 Squadron joining fee - ${reference}`,
        metadata: { reference, givenName: givenName || '', familyName: familyName || '' },
      },
      metadata: { reference },
    }),
  })
  const session = await res.json()
  if (!res.ok) return json({ error: session.error?.message || 'Failed to start the payment' }, res.status)

  return json({ sessionId: session.id, authorisationUrl: session.url })
}

export const config = { path: '/api/stripe/create-fee-checkout' }
