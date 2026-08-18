import assert from 'node:assert/strict'
import { test } from 'vitest'

import createFeeCheckout from '../netlify/functions/create-fee-checkout.mjs'
import confirmFeeCheckout from '../netlify/functions/confirm-fee-checkout.mjs'
import { FEE_AMOUNT_PENCE } from '../src/lib/pricing.js'

process.env.STRIPE_SECRET_KEY = 'sk_test_key'

const jsonResponse = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json' },
})

const startCheckout = async (returnUrl = 'https://portal.example.com/#/join/family-1/cadet-1/tok') => {
  const originalFetch = globalThis.fetch
  let sent
  globalThis.fetch = async (url, options = {}) => {
    sent = { url: String(url), body: new URLSearchParams(options.body) }
    return jsonResponse({ id: 'cs_test_123', url: 'https://checkout.stripe.com/c/pay/cs_test_123' })
  }
  try {
    const response = await createFeeCheckout(new Request('http://localhost/api', {
      method: 'POST',
      body: JSON.stringify({ reference: 'SMITH-Jamie', givenName: 'Alex', familyName: 'Smith', email: 'alex@example.com', returnUrl }),
    }))
    return { response, sent }
  } finally {
    globalThis.fetch = originalFetch
  }
}

test('creates a Checkout session for the joining fee at the configured price', async () => {
  const { response, sent } = await startCheckout()
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { sessionId: 'cs_test_123', authorisationUrl: 'https://checkout.stripe.com/c/pay/cs_test_123' })
  assert.match(sent.url, /\/v1\/checkout\/sessions$/)
  assert.equal(sent.body.get('mode'), 'payment')
  assert.equal(sent.body.get('line_items[0][price_data][currency]'), 'gbp')
  assert.equal(sent.body.get('line_items[0][price_data][unit_amount]'), String(FEE_AMOUNT_PENCE))
  assert.equal(sent.body.get('customer_email'), 'alex@example.com')
  assert.equal(sent.body.get('client_reference_id'), 'SMITH-Jamie')
})

test('leaves the Stripe session placeholder unescaped and drops the family token', async () => {
  const { sent } = await startCheckout()
  const successUrl = sent.body.get('success_url')
  const cancelUrl = sent.body.get('cancel_url')
  // Stripe only substitutes the literal token, so it must not be percent-encoded.
  assert.ok(successUrl.includes('{CHECKOUT_SESSION_ID}'), successUrl)
  assert.ok(!successUrl.includes('%7BCHECKOUT_SESSION_ID%7D'), successUrl)
  // The family access token must never be handed to Stripe.
  assert.ok(!successUrl.includes('tok'), successUrl)
  assert.ok(!cancelUrl.includes('tok'), cancelUrl)
  assert.ok(successUrl.includes('payment_outcome=complete'), successUrl)
  assert.ok(cancelUrl.includes('payment_outcome=cancelled'), cancelUrl)
})

test('confirms a paid session and returns the payment intent', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => jsonResponse({ id: 'cs_test_123', status: 'complete', payment_status: 'paid', payment_intent: 'pi_123' })
  try {
    const response = await confirmFeeCheckout(new Request('http://localhost/api', { method: 'POST', body: JSON.stringify({ sessionId: 'cs_test_123' }) }))
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { paymentId: 'pi_123', status: 'paid' })
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('treats an unpaid open session as pending so the client keeps retrying', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => jsonResponse({ id: 'cs_test_123', status: 'open', payment_status: 'unpaid' })
  try {
    const response = await confirmFeeCheckout(new Request('http://localhost/api', { method: 'POST', body: JSON.stringify({ sessionId: 'cs_test_123' }) }))
    assert.equal(response.status, 409)
    assert.equal((await response.json()).error, 'pending')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('reports an expired session as a distinct failure', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => jsonResponse({ id: 'cs_test_123', status: 'expired', payment_status: 'unpaid' })
  try {
    const response = await confirmFeeCheckout(new Request('http://localhost/api', { method: 'POST', body: JSON.stringify({ sessionId: 'cs_test_123' }) }))
    assert.equal(response.status, 409)
    assert.equal((await response.json()).error, 'expired')
  } finally {
    globalThis.fetch = originalFetch
  }
})
