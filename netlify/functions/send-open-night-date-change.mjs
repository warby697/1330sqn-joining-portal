import { renderEmail, bodyToParagraphs } from './_email-layout.mjs'

const sender = (raw) => { const match = String(raw || '').match(/<(.+)>/); return `1330 Squadron Staff <${(match ? match[1] : raw).trim()}>` }

export default async (request) => {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 })
  const details = await request.json()
  const apiKey = process.env.RESEND_API_KEY
  const rawFrom = process.env.RESEND_FROM
  if (!apiKey || !rawFrom) return Response.json({ error: 'Email sending is not configured.' }, { status: 500 })
  const values = { parentName: details.parentName || 'Parent or guardian', cadetName: details.cadetName, oldDate: details.oldDate, newDate: details.newDate, portalUrl: details.portalUrl }
  const fill = (text) => String(text || '').replace(/{{(\w+)}}/g, (_, key) => values[key] || '')
  const subject = fill(details.template?.subject || 'Important: Open Night date changed for {{cadetName}}')
  const intro = fill(details.template?.body || 'Dear {{parentName}},\n\nThe Open Night booked for {{cadetName}} has moved from {{oldDate}} to {{newDate}}.\n\nYour booking has been moved automatically. If the new date is unsuitable, return to the portal to choose another date or withdraw.')
  const { html, text } = renderEmail({
    heading: 'Open Night date changed',
    paragraphs: bodyToParagraphs(intro),
    cta: details.portalUrl ? { label: 'Review your booking', url: details.portalUrl } : undefined,
  })
  const response = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: sender(rawFrom), to: details.to, subject, html }) })
  if (!response.ok) return Response.json({ error: await response.text() }, { status: 502 })
  const provider = await response.json().catch(() => ({}))
  return Response.json({ sent: true, subject, body: text, providerMessageId: provider.id || null })
}
