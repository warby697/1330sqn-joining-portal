import { SUBS_AMOUNT_PENCE } from '../../src/lib/pricing.js'

const GC_API = process.env.GOCARDLESS_API || 'https://api.gocardless.com'
const GC_VERSION = '2015-07-06'

function gcHeaders(idempotencyKey) {
  return {
    Authorization: `Bearer ${process.env.GOCARDLESS_ACCESS_TOKEN}`,
    'GoCardless-Version': GC_VERSION,
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
  }
}

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }
  if (!process.env.GOCARDLESS_ACCESS_TOKEN) {
    return new Response(JSON.stringify({ error: 'GOCARDLESS_ACCESS_TOKEN is not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { billingRequestId, reference, startDate } = await req.json()
  if (!billingRequestId || !reference) {
    return new Response(JSON.stringify({ error: 'Missing billingRequestId or reference' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const brRes = await fetch(`${GC_API}/billing_requests/${billingRequestId}`, { headers: gcHeaders() })
  const br = await brRes.json()
  if (!brRes.ok) {
    return new Response(JSON.stringify({ error: br.error?.message || 'Could not look up billing request' }), {
      status: brRes.status,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const mandateId = br.billing_requests?.mandate_request?.links?.mandate
  if (!mandateId) {
    return new Response(
      JSON.stringify({ error: 'pending', message: 'The Direct Debit mandate is not ready yet - it may still be processing, or the setup may have been cancelled.' }),
      { status: 409, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const existingRes = await fetch(`${GC_API}/subscriptions?mandate=${encodeURIComponent(mandateId)}&limit=100`, { headers: gcHeaders() })
  const existing = await existingRes.json()
  if (!existingRes.ok) {
    return new Response(JSON.stringify({ error: existing.error?.message || 'Could not check the existing subscription' }), {
      status: existingRes.status,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  const existingSubscription = existing.subscriptions?.find((item) => item.status !== 'cancelled' && item.metadata?.reference === reference)
  if (existingSubscription) {
    return new Response(JSON.stringify({ mandateId, subscriptionId: existingSubscription.id, status: existingSubscription.status, existing: true }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const subscription = {
    amount: SUBS_AMOUNT_PENCE,
    currency: 'GBP',
    interval: 1,
    interval_unit: 'monthly',
    name: '1330 Squadron monthly subs',
    metadata: { reference },
    links: { mandate: mandateId },
  }
  // Delay the first collection until the cadet actually starts, so paperwork
  // completed months before the intake does not trigger monthly payments in the
  // meantime. Only set a start date comfortably in the future; if the start is
  // imminent or past, let GoCardless begin on its earliest valid date.
  const start = startDate ? new Date(startDate) : null
  if (start && !Number.isNaN(start.getTime()) && start.getTime() > Date.now() + 7 * 24 * 60 * 60 * 1000) {
    subscription.start_date = start.toISOString().slice(0, 10)
  }

  const subRes = await fetch(`${GC_API}/subscriptions`, {
    method: 'POST',
    headers: gcHeaders(`sub-${billingRequestId}`),
    body: JSON.stringify({ subscriptions: subscription }),
  })
  const sub = await subRes.json()
  if (!subRes.ok) {
    return new Response(JSON.stringify({ error: sub.error?.message || 'Failed to create subscription' }), {
      status: subRes.status,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ mandateId, subscriptionId: sub.subscriptions.id, status: sub.subscriptions.status }), {
    headers: { 'Content-Type': 'application/json' },
  })
}

export const config = { path: '/api/gocardless/confirm-subscription' }
