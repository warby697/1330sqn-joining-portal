const PARENT_SIGNAL = 'https://signal.group/#CjQKIJl8L_m4RIX-eXFqO_wg0W67AFFtSTaSblV85N69sJpuEhA3cQq0MDddoeUX1NK03zwp'
const CADET_SIGNAL = 'https://signal.group/#CjQKIH7uvVYV4_6nkB2_On2y7TGMKyavN9l0x-7fIA2Hu643EhAHIDTmsmZJ_9tAC9_b8Jrt'
const escapeHtml = (value) => String(value || '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character]))
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
  const body = resolve(details.template?.body || 'Everything is complete. We look forward to seeing {{cadetName}} on {{startDate}} at 6.30pm.', values)
  const paragraphs = body.split(/\n+/).filter(Boolean).map((line) => `<p>${escapeHtml(line)}</p>`).join('')
  const match = String(rawFrom).match(/<(.+)>/)
  const from = `1330 Squadron Staff <${(match ? match[1] : rawFrom).trim()}>`
  const includesSignalLinks = body.includes('signal.group')
  const signalLinks = includesSignalLinks ? '' : `<h2 style="color:#003857;font-size:18px">Signal groups</h2><p><a href="${PARENT_SIGNAL}">1330 Parents and Guardians Group</a></p><p><a href="${CADET_SIGNAL}">1330 Cadet Group</a></p><p>Set phone-number visibility to private in both groups.</p>`
  const html = `<div style="font-family:Arial,sans-serif;max-width:680px;margin:auto;color:#172033;line-height:1.55"><h1 style="color:#003857">All set for 1330 Squadron</h1>${paragraphs}${signalLinks}<p>Regards,<br><strong>1330 Squadron Staff</strong></p><p style="font-size:12px;color:#667085">This email address is not monitored. If you need assistance, please contact the Squadron through <a href="https://warringtonaircadets.com/">warringtonaircadets.com</a>.</p></div>`
  const response = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from, to: details.to, subject, html }) })
  if (!response.ok) return Response.json({ error: await response.text() }, { status: 502 })
  const provider = await response.json().catch(() => ({}))
  return Response.json({ sent: true, subject, body: `${body}\n\nRegards,\n1330 Squadron Staff\n\nThis email address is not monitored. If you need assistance, please contact the Squadron at https://warringtonaircadets.com/.`, providerMessageId: provider.id || null })
}
