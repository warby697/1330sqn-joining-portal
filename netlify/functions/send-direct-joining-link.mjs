import { renderEmail, bodyToParagraphs } from './_email-layout.mjs'

const sender = (raw) => { const match = String(raw || '').match(/<(.+)>/); return `1330 Squadron Staff <${(match ? match[1] : raw).trim()}>` }

export default async (request) => {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 })
  const apiKey = process.env.RESEND_API_KEY
  const rawFrom = process.env.RESEND_FROM
  if (!apiKey || !rawFrom) return Response.json({ error: 'Email sending is not configured.' }, { status: 500 })
  const details = await request.json()
  if (!details.to || !details.portalUrl) return Response.json({ error: 'Email address and portal link are required.' }, { status: 400 })

  const cadetName = details.cadetName || 'your cadet'
  const subject = details.template?.subject || `Joining paperwork for ${cadetName}`
  const intro = details.template?.body || `Thank you for enquiring about 1330 Squadron.\n\nEverything is ready for ${cadetName} to join. The button below opens the joining paperwork, where you will complete the Form 3822, pay the joining fee and set up the monthly subscription.\n\nPlease keep this link to yourself. It opens your family's record and does not need a code.`
  const { html, text } = renderEmail({
    heading: 'Thank you for enquiring',
    paragraphs: bodyToParagraphs(intro),
    cta: { label: 'Start the joining paperwork', url: details.portalUrl },
  })
  const response = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: sender(rawFrom), to: details.to, subject, html }) })
  if (!response.ok) return Response.json({ error: `Email service error: ${await response.text()}` }, { status: 502 })
  const provider = await response.json().catch(() => ({}))
  return Response.json({ sent: true, subject, body: text, providerMessageId: provider.id || null })
}
