import { renderEmail, bodyToParagraphs } from './_email-layout.mjs'

const sender = (raw) => { const match = String(raw || '').match(/<(.+)>/); return `1330 Squadron Staff <${(match ? match[1] : raw).trim()}>` }

export default async (request) => {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 })
  const apiKey = process.env.RESEND_API_KEY
  const rawFrom = process.env.RESEND_FROM
  if (!apiKey || !rawFrom) return Response.json({ error: 'Email sending is not configured.' }, { status: 500 })
  const details = await request.json()
  if (!details.to || !details.portalUrl) return Response.json({ error: 'Email address and portal link are required.' }, { status: 400 })
  const subject = details.template?.subject || `Action required: missed Open Night for ${details.cadetName || 'prospective cadet'}`
  const intro = details.template?.body || `You did not attend the Open Night booked for ${details.cadetName || 'your prospective cadet'} on ${details.date}.\n\nPlease return to the recruitment portal to rebook or withdraw the enquiry.`
  const { html, text } = renderEmail({
    heading: 'Open Night attendance',
    paragraphs: bodyToParagraphs(intro),
    cta: { label: 'Rebook or withdraw', url: details.portalUrl },
  })
  const response = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: sender(rawFrom), to: details.to, subject, html }) })
  if (!response.ok) return Response.json({ error: `Email service error: ${await response.text()}` }, { status: 502 })
  const provider = await response.json().catch(() => ({}))
  return Response.json({ sent: true, subject, body: text, providerMessageId: provider.id || null })
}
