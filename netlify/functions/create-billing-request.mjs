import { randomUUID } from 'node:crypto'
import { paymentReturnUrls } from './_payment-return.mjs'

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

  const { reference, givenName, familyName, email, returnUrl } = await req.json()

  if (!reference || !email || !returnUrl) {
    return new Response(JSON.stringify({ error: 'Missing reference, email or returnUrl' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const brRes = await fetch(`${GC_API}/billing_requests`, {
    method: 'POST',
    headers: gcHeaders(`br-${reference}`),
    body: JSON.stringify({
      billing_requests: {
        mandate_request: { scheme: 'bacs' },
        metadata: { reference },
      },
    }),
  })
  const br = await brRes.json()
  const conflict = br.error?.errors?.find((e) => e.reason === 'idempotent_creation_conflict')
  let billingRequestId
  if (brRes.ok) {
    billingRequestId = br.billing_requests.id
  } else if (conflict?.links?.conflicting_resource_id) {
    // Same person retrying the same day's mandate (e.g. they backed out and clicked again) -
    // reuse the existing billing request rather than erroring, and get them a fresh hosted flow below.
    billingRequestId = conflict.links.conflicting_resource_id
  } else {
    return new Response(JSON.stringify({ error: br.error?.message || 'Failed to create billing request' }), {
      status: brRes.status,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (!brRes.ok) {
    const existingRes = await fetch(`${GC_API}/billing_requests/${billingRequestId}`, { headers: gcHeaders() })
    const existing = await existingRes.json()
    if (existingRes.ok && existing.billing_requests?.mandate_request?.links?.mandate) {
      return new Response(JSON.stringify({ billingRequestId, alreadyAuthorised: true }), { headers: { 'Content-Type': 'application/json' } })
    }
  }

  const { redirectUri, exitUri } = paymentReturnUrls(returnUrl, 'subs', billingRequestId)

  const flowRes = await fetch(`${GC_API}/billing_request_flows`, {
    method: 'POST',
    headers: gcHeaders(`brf-${billingRequestId}-${randomUUID()}`),
    body: JSON.stringify({
      billing_request_flows: {
        redirect_uri: redirectUri,
        exit_uri: exitUri,
        prefilled_customer: {
          given_name: givenName || undefined,
          family_name: familyName || undefined,
          email,
        },
        links: { billing_request: billingRequestId },
      },
    }),
  })
  const flow = await flowRes.json()
  if (!flowRes.ok) {
    return new Response(JSON.stringify({ error: flow.error?.message || 'Failed to create billing request flow' }), {
      status: flowRes.status,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  return new Response(
    JSON.stringify({
      billingRequestId,
      authorisationUrl: flow.billing_request_flows.authorisation_url,
    }),
    { headers: { 'Content-Type': 'application/json' } }
  )
}

export const config = { path: '/api/gocardless/create-billing-request' }
