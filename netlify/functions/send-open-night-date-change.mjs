const escapeHtml = (value) => String(value || '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character]))
export default async (request) => {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 })
  const details = await request.json()
  const apiKey = process.env.RESEND_API_KEY
  const rawFrom = process.env.RESEND_FROM
  if (!apiKey || !rawFrom) return Response.json({ error: 'Email sending is not configured.' }, { status: 500 })
  const match = String(rawFrom).match(/<(.+)>/)
  const from = `1330 Squadron Staff <${(match ? match[1] : rawFrom).trim()}>`
  const values = { parentName: details.parentName || 'Parent or guardian', cadetName: details.cadetName, oldDate: details.oldDate, newDate: details.newDate, portalUrl: details.portalUrl }
  const fill = (text) => String(text || '').replace(/{{(\w+)}}/g, (_, key) => values[key] || '')
  const subject = fill(details.template?.subject || 'Important: Open Night date changed for {{cadetName}}')
  const body = fill(details.template?.body || 'Dear {{parentName}},\n\nThe Open Night booked for {{cadetName}} has moved from {{oldDate}} to {{newDate}}.\n\nYour booking has been moved automatically. If the new date is unsuitable, return to the portal to choose another date or withdraw.\n\nReview your booking: {{portalUrl}}')
  const html = `<div style="font-family:Arial,sans-serif;max-width:680px;margin:auto;color:#172033;line-height:1.55"><p>${escapeHtml(body).replace(/\n/g, '<br>')}</p><p>Regards,<br><strong>1330 Squadron Staff</strong></p><p style="font-size:12px;color:#667085">This email address is not monitored. If you need assistance, please contact the Squadron through <a href="https://warringtonaircadets.com/">warringtonaircadets.com</a>.</p></div>`
  const response = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from, to: details.to, subject, html }) })
  if (!response.ok) return Response.json({ error: await response.text() }, { status: 502 })
  const provider = await response.json().catch(() => ({}))
  return Response.json({ sent: true, subject, body: `${body}\n\nRegards,\n1330 Squadron Staff\n\nThis email address is not monitored. If you need assistance, please contact the Squadron at https://warringtonaircadets.com/.`, providerMessageId: provider.id || null })
}
