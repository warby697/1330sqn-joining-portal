const escapeHtml = (value) => String(value || '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character]))
const sender = (raw) => {
  const match = String(raw || '').match(/<(.+)>/)
  return `1330 Squadron Staff <${(match ? match[1] : raw).trim()}>`
}

export default async (request) => {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 })
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM
  if (!apiKey || !from) return Response.json({ error: 'Email sending is not configured.' }, { status: 500 })

  const details = await request.json()
  if (!details.to) return Response.json({ error: 'Parent email address is required.' }, { status: 400 })
  const subject = details.template?.subject || `Application withdrawn for ${details.cadetName || 'prospective cadet'}`
  const body = details.template?.body || `This confirms that the application for ${details.cadetName || 'the prospective cadet'} has been withdrawn. You will not receive further recruitment emails about this application.`
  const content = body.split(/\n{2,}/).map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`).join('')
  const html = `<div style="font-family:Arial,sans-serif;max-width:680px;margin:auto;color:#172033;line-height:1.55"><h1 style="color:#003857">Application withdrawn</h1>${content}<p>Regards,<br><strong>1330 Squadron Staff</strong></p><p style="font-size:12px;color:#667085">This email address is not monitored. If you need assistance, please contact the Squadron through <a href="https://warringtonaircadets.com/">warringtonaircadets.com</a>.</p></div>`
  const response = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: sender(from), to: details.to, subject, html }) })
  if (!response.ok) return Response.json({ error: await response.text() }, { status: 502 })
  const provider = await response.json().catch(() => ({}))
  return Response.json({ sent: true, subject, body: `${body}\n\nRegards,\n1330 Squadron Staff\n\nThis email address is not monitored. If you need assistance, please contact the Squadron at https://warringtonaircadets.com/.`, providerMessageId: provider.id || null })
}
