const FROM_NAME = '1330 Squadron Staff'

function sender(raw) {
  const match = String(raw || '').match(/<(.+)>/)
  const email = (match ? match[1] : raw).trim()
  return `${FROM_NAME} <${email}>`
}

const escapeHtml = (value) => String(value || '').replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
}[character]))

export default async (request) => {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 })
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM
  if (!apiKey || !from) return Response.json({ error: 'Email sending is not configured.' }, { status: 500 })

  const details = await request.json()
  if (!details.to || !details.date) return Response.json({ error: 'Email address and open-night date are required.' }, { status: 400 })

  const subject = details.template?.subject || details.subject || '1330 Squadron Open Night confirmation'
  const body = details.template?.body || `This email confirms the Open Night place for ${details.cadetName || 'your cadet'} on ${details.date}.\n\nPlease arrive at 7.10pm and wait at the gate at ${details.address}. The gate will open at 7.15pm.`
  const content = body.split(/\n{2,}/).map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`).join('')
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:680px;margin:auto;color:#172033;line-height:1.55">
      <h1 style="color:#003857;font-size:24px">1330 Squadron Open Night</h1>
      ${content}
      ${details.portalUrl ? `<p><a href="${escapeHtml(details.portalUrl)}" style="display:inline-block;background:#006399;color:white;padding:12px 18px;text-decoration:none;font-weight:bold">Review or move your booking</a></p>` : ''}
      <p>Regards,<br><strong>1330 Squadron Staff</strong></p><p style="font-size:12px;color:#667085">This email address is not monitored. If you need assistance, please contact the Squadron through <a href="https://warringtonaircadets.com/">warringtonaircadets.com</a>.</p>
    </div>`

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: sender(from), to: details.to, subject, html }),
  })
  if (!response.ok) return Response.json({ error: `Email service error: ${await response.text()}` }, { status: 502 })
  const provider = await response.json().catch(() => ({}))
  return Response.json({ sent: true, subject, body: `${body}${details.portalUrl ? `\n\nReview or move your booking: ${details.portalUrl}` : ''}\n\nRegards,\n1330 Squadron Staff\n\nThis email address is not monitored. If you need assistance, please contact the Squadron at https://warringtonaircadets.com/.`, providerMessageId: provider.id || null })
}
