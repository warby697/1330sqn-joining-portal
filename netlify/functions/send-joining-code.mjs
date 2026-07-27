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
  if (!details.to || !details.code) return Response.json({ error: 'Email address and joining code are required.' }, { status: 400 })
  const expiry = new Date(details.expiresAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  const subject = details.template?.subject || `Thank you for attending - joining code for ${details.cadetName || 'your cadet'}`
  const body = details.template?.body || `Thank you for attending our Open Night.\n\nThe joining code for ${details.cadetName || 'your cadet'} is ${details.code}. It expires on ${expiry}.`
  const customContent = body.split(/\n{2,}/).map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`).join('')
  const html = `<div style="font-family:Arial,sans-serif;max-width:680px;margin:auto;color:#172033;line-height:1.55">
    <h1 style="color:#003857;font-size:24px">Thank you for attending our Open Night</h1>
    ${customContent}
    <p><a href="${escapeHtml(details.portalUrl)}" style="display:inline-block;background:#006399;color:white;padding:12px 18px;text-decoration:none;font-weight:bold">Start the joining paperwork</a></p>
    <p>Regards,<br><strong>1330 Squadron Staff</strong></p><p style="font-size:12px;color:#667085">This email address is not monitored. If you need assistance, please contact the Squadron through <a href="https://warringtonaircadets.com/">warringtonaircadets.com</a>.</p>
  </div>`
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: sender(from), to: details.to, subject, html }),
  })
  if (!response.ok) return Response.json({ error: `Email service error: ${await response.text()}` }, { status: 502 })
  const provider = await response.json().catch(() => ({}))
  return Response.json({ sent: true, subject, body: `${body}\n\nStart the joining paperwork: ${details.portalUrl}\n\nRegards,\n1330 Squadron Staff\n\nThis email address is not monitored. If you need assistance, please contact the Squadron at https://warringtonaircadets.com/.`, providerMessageId: provider.id || null })
}
