import { renderEmail, bodyToParagraphs } from './_email-layout.mjs'

const sender = (raw) => { const match = String(raw || '').match(/<(.+)>/); return `1330 Squadron Staff <${(match ? match[1] : raw).trim()}>` }

export default async (request) => {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 })
  const apiKey = process.env.RESEND_API_KEY
  const rawFrom = process.env.RESEND_FROM
  if (!apiKey || !rawFrom) return Response.json({ error: 'Email sending is not configured.' }, { status: 500 })
  const details = await request.json()
  if (!details.to || !details.code) return Response.json({ error: 'Email address and joining code are required.' }, { status: 400 })
  const expiry = new Date(details.expiresAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  const subject = details.template?.subject || `Thank you for attending - joining code for ${details.cadetName || 'your cadet'}`
  const intro = details.template?.body || `Thank you for attending our Open Night.\n\nThe joining code for ${details.cadetName || 'your cadet'} is below. It expires on ${expiry}.`
  const { html, text } = renderEmail({
    heading: 'Thank you for attending our Open Night',
    paragraphs: bodyToParagraphs(intro),
    code: { value: details.code, label: `${details.cadetName || 'Your cadet'}'s joining code`, note: `Expires on ${expiry}` },
    cta: details.portalUrl ? { label: 'Start the joining paperwork', url: details.portalUrl } : undefined,
  })
  const response = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: sender(rawFrom), to: details.to, subject, html }) })
  if (!response.ok) return Response.json({ error: `Email service error: ${await response.text()}` }, { status: 502 })
  const provider = await response.json().catch(() => ({}))
  return Response.json({ sent: true, subject, body: text, providerMessageId: provider.id || null })
}
