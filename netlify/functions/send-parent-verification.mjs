import { renderEmail, bodyToParagraphs } from './_email-layout.mjs'

const sender = (raw) => { const match = String(raw || '').match(/<(.+)>/); return `1330 Squadron Staff <${(match ? match[1] : raw).trim()}>` }

export default async (request) => {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 })
  const details = await request.json()
  const apiKey = process.env.RESEND_API_KEY
  const rawFrom = process.env.RESEND_FROM
  if (!apiKey || !rawFrom || !details.to || !details.code) {
    console.error('Parent verification email missing required value:', { apiKey: Boolean(apiKey), from: Boolean(rawFrom), to: Boolean(details.to), code: Boolean(details.code) })
    return Response.json({ error: 'Email sending is not configured.' }, { status: 500 })
  }
  const subject = details.template?.subject || 'Confirm your 1330 Squadron enquiry'
  const intro = details.template?.body || `Please confirm the enquiry for ${details.cadetName || 'the prospective cadet'}.`
  const { html, text } = renderEmail({
    heading: 'Confirm your enquiry',
    paragraphs: bodyToParagraphs(intro),
    code: { value: details.code, label: 'Your verification code', note: 'Enter this on the portal to confirm your details.' },
    cta: details.portalUrl ? { label: 'Return to the joining portal', url: details.portalUrl } : undefined,
  })
  const response = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: sender(rawFrom), to: details.to, subject, html }) })
  if (!response.ok) {
    const providerError = await response.text()
    console.error('Resend rejected parent verification email:', providerError)
    return Response.json({ error: providerError }, { status: 502 })
  }
  const provider = await response.json().catch(() => ({}))
  return Response.json({ sent: true, subject, body: text, providerMessageId: provider.id || null })
}
