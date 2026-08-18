import assert from 'node:assert/strict'
import { test } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'

import { FeeConfirmStep } from '../src/components/PortalSteps'

// The fee moved from GoCardless to Stripe by swapping the endpoint the component posts to.
// The function-level tests all passed while the component was still calling the old
// GoCardless URL with a Stripe session id, so it 400d and retried until it gave up.
// These assert the wiring itself, which is the part that actually broke.

global.IS_REACT_ACT_ENVIRONMENT = true

async function renderConfirm(fetchImpl) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const originalFetch = globalThis.fetch
  globalThis.fetch = fetchImpl
  const root = createRoot(container)
  const done = []
  try {
    await act(async () => {
      root.render(<FeeConfirmStep sessionId="cs_test_123" onDone={(result) => done.push(result)} onContinueUnconfirmed={() => {}} onRetry={() => {}} />)
    })
    return { container, done }
  } finally {
    globalThis.fetch = originalFetch
  }
}

test('confirms the fee against the Stripe endpoint, not the old GoCardless one', async () => {
  const calls = []
  const { done } = await renderConfirm(async (url, options) => {
    calls.push({ url: String(url), body: JSON.parse(options.body) })
    return new Response(JSON.stringify({ paymentId: 'pi_123', status: 'paid' }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  })

  assert.equal(calls.length, 1, 'should confirm on the first try, with no retries')
  assert.equal(calls[0].url, '/api/stripe/confirm-fee-checkout')
  assert.ok(!calls[0].url.includes('gocardless'), 'must not call the GoCardless fee endpoint')
  assert.deepEqual(calls[0].body, { sessionId: 'cs_test_123' })
  assert.deepEqual(done, [{ paymentId: 'pi_123', status: 'paid' }])
})

test('renders nothing while a healthy confirmation is in flight', async () => {
  const { container } = await renderConfirm(async () => new Response(JSON.stringify({ paymentId: 'pi_123', status: 'paid' }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
  // No card, no progress bar, no asking the parent to wait for something already done.
  assert.equal(container.textContent.trim(), '')
  assert.equal(container.querySelector('[role="progressbar"]'), null)
})
