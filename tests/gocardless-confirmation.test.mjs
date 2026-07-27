import assert from 'node:assert/strict'
import { test } from 'vitest'

import confirmFee from '../netlify/functions/confirm-fee-payment.mjs'
import confirmSubscription from '../netlify/functions/confirm-subscription.mjs'
import createFeePayment from '../netlify/functions/create-fee-payment.mjs'
import createBillingRequest from '../netlify/functions/create-billing-request.mjs'

process.env.GOCARDLESS_ACCESS_TOKEN = 'test-token'

const jsonResponse = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json' },
})

test('confirms a fee using payment_request.links.payment', async () => {
  const originalFetch = globalThis.fetch
  const calls = []
  globalThis.fetch = async (url) => {
    calls.push(String(url))
    if (calls.length === 1) return jsonResponse({ billing_requests: { status: 'fulfilled', payment_request: { links: { payment: 'PM123' } } } })
    return jsonResponse({ payments: { id: 'PM123', status: 'confirmed' } })
  }
  try {
    const response = await confirmFee(new Request('http://localhost/api', { method: 'POST', body: JSON.stringify({ billingRequestId: 'BRQ123' }) }))
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { paymentId: 'PM123', status: 'confirmed' })
    assert.match(calls[1], /\/payments\/PM123$/)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('creates a monthly subscription using mandate_request.links.mandate', async () => {
  const originalFetch = globalThis.fetch
  const calls = []
  let subscriptionBody
  globalThis.fetch = async (url, options = {}) => {
    calls.push(String(url))
    if (calls.length === 1) return jsonResponse({ billing_requests: { status: 'fulfilled', mandate_request: { links: { mandate: 'MD123' } } } })
    if (calls.length === 2) return jsonResponse({ subscriptions: [] })
    subscriptionBody = JSON.parse(options.body)
    return jsonResponse({ subscriptions: { id: 'SB123', status: 'active' } }, 201)
  }
  try {
    const response = await confirmSubscription(new Request('http://localhost/api', { method: 'POST', body: JSON.stringify({ billingRequestId: 'BRQ123', reference: 'WARBURTON-Ben' }) }))
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { mandateId: 'MD123', subscriptionId: 'SB123', status: 'active' })
    assert.deepEqual(subscriptionBody.subscriptions.links, { mandate: 'MD123' })
    assert.equal(subscriptionBody.subscriptions.interval, 1)
    assert.equal(subscriptionBody.subscriptions.interval_unit, 'monthly')
    assert.equal(subscriptionBody.subscriptions.start_date, undefined) // no startDate passed -> starts ASAP
  } finally {
    globalThis.fetch = originalFetch
  }
})

async function subscriptionBodyFor(startDate) {
  const originalFetch = globalThis.fetch
  const calls = []
  let body
  globalThis.fetch = async (url, options = {}) => {
    calls.push(String(url))
    if (calls.length === 1) return jsonResponse({ billing_requests: { status: 'fulfilled', mandate_request: { links: { mandate: 'MD123' } } } })
    if (calls.length === 2) return jsonResponse({ subscriptions: [] })
    body = JSON.parse(options.body)
    return jsonResponse({ subscriptions: { id: 'SB123', status: 'active' } }, 201)
  }
  try {
    await confirmSubscription(new Request('http://localhost/api', { method: 'POST', body: JSON.stringify({ billingRequestId: 'BRQ123', reference: 'WARBURTON-Ben', startDate }) }))
    return body.subscriptions
  } finally {
    globalThis.fetch = originalFetch
  }
}

test('delays the first collection to the intended start date when it is in the future', async () => {
  const april = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()
  const sub = await subscriptionBodyFor(april)
  assert.equal(sub.start_date, april.slice(0, 10))
})

test('does not set a start date when the start is imminent or past', async () => {
  const soon = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString()
  assert.equal((await subscriptionBodyFor(soon)).start_date, undefined)
  const past = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  assert.equal((await subscriptionBodyFor(past)).start_date, undefined)
})

test('reuses an already completed fee without creating another hosted flow', async () => {
  const originalFetch = globalThis.fetch
  const calls = []
  globalThis.fetch = async (url) => {
    calls.push(String(url))
    if (calls.length === 1) return jsonResponse({ error: { errors: [{ reason: 'idempotent_creation_conflict', links: { conflicting_resource_id: 'BRQFEE' } }] } }, 409)
    return jsonResponse({ billing_requests: { payment_request: { links: { payment: 'PM123' } } } })
  }
  try {
    const response = await createFeePayment(new Request('http://localhost/api', { method: 'POST', body: JSON.stringify({ reference: 'WARBURTON-Ben', email: 'test@example.com', returnUrl: 'https://example.com/return' }) }))
    assert.deepEqual(await response.json(), { billingRequestId: 'BRQFEE', alreadyAuthorised: true })
    assert.equal(calls.length, 2)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('reuses an existing mandate so the subscription can be created', async () => {
  const originalFetch = globalThis.fetch
  const calls = []
  globalThis.fetch = async (url) => {
    calls.push(String(url))
    if (calls.length === 1) return jsonResponse({ error: { errors: [{ reason: 'idempotent_creation_conflict', links: { conflicting_resource_id: 'BRQSUB' } }] } }, 409)
    return jsonResponse({ billing_requests: { mandate_request: { links: { mandate: 'MD123' } } } })
  }
  try {
    const response = await createBillingRequest(new Request('http://localhost/api', { method: 'POST', body: JSON.stringify({ reference: 'WARBURTON-Ben', email: 'test@example.com', returnUrl: 'https://example.com/return' }) }))
    assert.deepEqual(await response.json(), { billingRequestId: 'BRQSUB', alreadyAuthorised: true })
    assert.equal(calls.length, 2)
  } finally {
    globalThis.fetch = originalFetch
  }
})
