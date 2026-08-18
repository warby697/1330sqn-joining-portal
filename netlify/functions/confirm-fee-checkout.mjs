const STRIPE_API = process.env.STRIPE_API || 'https://api.stripe.com'

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

export default async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })
  if (!process.env.STRIPE_SECRET_KEY) return json({ error: 'STRIPE_SECRET_KEY is not configured' }, 500)

  const { sessionId } = await req.json()
  if (!sessionId) return json({ error: 'Missing sessionId' }, 400)

  const res = await fetch(`${STRIPE_API}/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, {
    headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` },
  })
  const session = await res.json()
  if (!res.ok) return json({ error: session.error?.message || 'Could not look up the payment' }, res.status)

  // paid = money taken. unpaid on an open session just means they have not finished yet,
  // so that is a retry, not a failure. An expired session cannot be completed.
  if (session.payment_status === 'paid') {
    return json({ paymentId: session.payment_intent || session.id, status: 'paid' })
  }
  if (session.status === 'expired') {
    return json({ error: 'expired', message: 'That payment session expired before it was completed. Please try again.' }, 409)
  }
  return json({ error: 'pending', message: 'The payment is not confirmed yet - it may still be processing, or it may have been cancelled.' }, 409)
}

export const config = { path: '/api/stripe/confirm-fee-checkout' }
