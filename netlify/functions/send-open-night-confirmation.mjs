import { renderEmail, bodyToParagraphs } from './_email-layout.mjs'

const sender = (raw) => { const match = String(raw || '').match(/<(.+)>/); return `1330 Squadron Staff <${(match ? match[1] : raw).trim()}>` }

export default async (request) => {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 })
  const apiKey = process.env.RESEND_API_KEY
  const rawFrom = process.env.RESEND_FROM
  if (!apiKey || !rawFrom) return Response.json({ error: 'Email sending is not configured.' }, { status: 500 })
  const details = await request.json()
  if (!details.to || !details.date) return Response.json({ error: 'Email address and open-night date are required.' }, { status: 400 })
  const subject = details.template?.subject || details.subject || '1330 Squadron Open Night confirmation'
  const intro = details.template?.body || `This email confirms the Open Night place for ${details.cadetName || 'your cadet'} on ${details.date}.\n\nPlease arrive at 7.10pm and wait at the gate at ${details.address}. The gate will open at 7.15pm.`
  const { html, text } = renderEmail({
    heading: '1330 Squadron Open Night confirmed',
    paragraphs: bodyToParagraphs(intro),
    cta: details.portalUrl ? { label: 'Review or move your booking', url: details.portalUrl } : undefined,
  })
  const response = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: sender(rawFrom), to: details.to, subject, html }) })
  if (!response.ok) return Response.json({ error: `Email service error: ${await response.text()}` }, { status: 502 })
  const provider = await response.json().catch(() => ({}))
  return Response.json({ sent: true, subject, body: text, providerMessageId: provider.id || null })
}
