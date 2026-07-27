const GC_API = process.env.GOCARDLESS_API || 'https://api.gocardless.com'
const GC_VERSION = '2015-07-06'
const BAD_STATUSES = new Set(['failed', 'cancelled', 'charged_back'])

function gcHeaders() {
  return {
    Authorization: `Bearer ${process.env.GOCARDLESS_ACCESS_TOKEN}`,
    'GoCardless-Version': GC_VERSION,
    Accept: 'application/json',
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

  const { billingRequestId } = await req.json()
  if (!billingRequestId) {
    return new Response(JSON.stringify({ error: 'Missing billingRequestId' }), {
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

  const paymentId = br.billing_requests?.payment_request?.links?.payment
  if (!paymentId) {
    return new Response(
      JSON.stringify({ error: 'pending', message: 'The payment is not ready yet - it may still be processing, or it may have been cancelled.' }),
      { status: 409, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const payRes = await fetch(`${GC_API}/payments/${paymentId}`, { headers: gcHeaders() })
  const pay = await payRes.json()
  if (!payRes.ok) {
    return new Response(JSON.stringify({ error: pay.error?.message || 'Could not look up the payment' }), {
      status: payRes.status,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const status = pay.payments?.status
  if (BAD_STATUSES.has(status)) {
    return new Response(
      JSON.stringify({ error: status, message: `The payment did not go through (${status}). Please try again.` }),
      { status: 409, headers: { 'Content-Type': 'application/json' } }
    )
  }

  return new Response(JSON.stringify({ paymentId, status }), {
    headers: { 'Content-Type': 'application/json' },
  })
}

export const config = { path: '/api/gocardless/confirm-fee-payment' }
