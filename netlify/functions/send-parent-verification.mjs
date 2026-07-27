const escapeHtml = (value) => String(value || '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character]))
export default async (request) => {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 })
  const details = await request.json()
  const apiKey = process.env.RESEND_API_KEY
  const rawFrom = process.env.RESEND_FROM
  if (!apiKey || !rawFrom || !details.to || !details.code) {
    console.error('Parent verification email missing required value:', { apiKey: Boolean(apiKey), from: Boolean(rawFrom), to: Boolean(details.to), code: Boolean(details.code) })
    return Response.json({ error: 'Email sending is not configured.' }, { status: 500 })
  }
  const match = String(rawFrom).match(/<(.+)>/)
  const from = `1330 Squadron Staff <${(match ? match[1] : rawFrom).trim()}>`
  const subject = details.template?.subject || 'Confirm your 1330 Squadron enquiry'
  const introduction = details.template?.body || `Please confirm the enquiry for ${details.cadetName || 'the prospective cadet'}.`
  const content = introduction.split(/\n{2,}/).map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`).join('')
  const html = `<div style="font-family:Arial,sans-serif;max-width:680px;margin:auto;color:#172033;line-height:1.55"><h1 style="color:#003857">Confirm your 1330 Squadron enquiry</h1>${content}<p>Your verification code is:</p><p style="font-size:30px;font-weight:bold;letter-spacing:8px;color:#003857">${escapeHtml(details.code)}</p><p><a href="${escapeHtml(details.portalUrl)}" style="display:inline-block;background:#006399;color:white;padding:12px 18px;text-decoration:none;font-weight:bold">Return to the joining portal</a></p><p>If you did not expect this message, please contact the Squadron.</p><p>Regards,<br><strong>1330 Squadron Staff</strong></p><p style="font-size:12px;color:#667085">This email address is not monitored. If you need assistance, please contact the Squadron through <a href="https://warringtonaircadets.com/">warringtonaircadets.com</a>.</p></div>`
  const response = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from, to: details.to, subject, html }) })
  if (!response.ok) {
    const providerError = await response.text()
    console.error('Resend rejected parent verification email:', providerError)
    return Response.json({ error: providerError }, { status: 502 })
  }
  const provider = await response.json().catch(() => ({}))
  const body = `${introduction}\n\nYour verification code is: ${details.code}\n\nReturn to the joining portal: ${details.portalUrl}\n\nIf you did not expect this message, please contact the Squadron.\n\nRegards,\n1330 Squadron Staff\n\nThis email address is not monitored. If you need assistance, please contact the Squadron at https://warringtonaircadets.com/.`
  return Response.json({ sent: true, subject, body, providerMessageId: provider.id || null })
}
