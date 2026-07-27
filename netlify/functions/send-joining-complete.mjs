import { renderEmail, bodyToParagraphs } from './_email-layout.mjs'
import { PARENT_SIGNAL_GROUP_URL, CADET_SIGNAL_GROUP_URL } from '../../src/lib/signalGroups.js'

const sender = (raw) => { const match = String(raw || '').match(/<(.+)>/); return `1330 Squadron Staff <${(match ? match[1] : raw).trim()}>` }
const resolve = (text, values) => String(text || '').replace(/{{(\w+)}}/g, (_, key) => values[key] || '')

export default async (request) => {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 })
  const details = await request.json()
  const apiKey = process.env.RESEND_API_KEY
  const rawFrom = process.env.RESEND_FROM
  if (!apiKey || !rawFrom || !details.to) return Response.json({ error: 'Email sending is not configured.' }, { status: 500 })
  const startDate = details.startDate ? new Date(details.startDate).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : 'the confirmed start date'
  const values = { parentName: details.parentName, cadetName: details.cadetName, startDate }
  const subject = resolve(details.template?.subject || 'All set for {{cadetName}} to join 1330 Squadron', values)
  const intro = resolve(details.template?.body || 'Everything is complete. We look forward to seeing {{cadetName}} on {{startDate}} at 6.30pm.', values)
  const paragraphs = bodyToParagraphs(intro)
  paragraphs.push('Please join the Signal groups below for parade-night changes and important updates. In the cadet group, register your cadet as Cdt Firstname Surname, and set phone-number visibility to private in both groups.')
  const { html, text } = renderEmail({
    heading: 'All set for 1330 Squadron',
    paragraphs,
    buttons: [
      { label: 'Join the Parents and Guardians group', url: PARENT_SIGNAL_GROUP_URL, primary: true },
      { label: 'Cadet group', url: CADET_SIGNAL_GROUP_URL, primary: false },
    ],
  })
  const response = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: sender(rawFrom), to: details.to, subject, html }) })
  if (!response.ok) return Response.json({ error: await response.text() }, { status: 502 })
  const provider = await response.json().catch(() => ({}))
  return Response.json({ sent: true, subject, body: text, providerMessageId: provider.id || null })
}
