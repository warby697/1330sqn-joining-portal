// Shared, email-client-safe layout for every recruitment/joining email.
// One place to control branding so individual senders only supply content.

const NAVY = '#003857'
const BLUE = '#006399'
const SKY = '#e4f1f9'
const INK = '#172033'
const MUTED = '#667085'
const PAGE = '#eef2f6'
const LINE = '#d9e1e8'

export const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
}[character]))

const paragraphHtml = (text) => escapeHtml(text).replace(/\n/g, '<br>')

// Split a plain-text template body into paragraphs. Bare URLs are dropped from
// the visible copy because the layout renders them as real buttons instead.
export const bodyToParagraphs = (body) => String(body || '')
  .split(/\n{2,}/)
  .map((paragraph) => paragraph.trim())
  .filter(Boolean)

const button = ({ label, url, primary = true }) => `
  <table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0"><tr><td style="border-radius:8px;background:${primary ? BLUE : '#ffffff'}">
    <a href="${escapeHtml(url)}" style="display:inline-block;padding:13px 26px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;color:${primary ? '#ffffff' : NAVY};text-decoration:none;border-radius:8px;border:${primary ? 'none' : `2px solid ${NAVY}`}">${escapeHtml(label)}&nbsp;&rsaquo;</a>
  </td></tr></table>`

/**
 * Build the HTML + plain-text versions of an email from structured content.
 * @param {object} content
 * @param {string} content.heading      Big title inside the card.
 * @param {string[]} content.paragraphs Body paragraphs (plain text).
 * @param {object} [content.code]       { value, label, note } - prominent code box.
 * @param {object} [content.cta]        { label, url } - primary action button.
 * @param {object[]} [content.buttons]  Extra buttons [{ label, url, primary }].
 * @param {string} [content.preheader]  Hidden inbox-preview text.
 */
export function renderEmail({ heading, paragraphs = [], code, cta, buttons = [], preheader = '' }) {
  const codeBlock = code ? `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:22px 0">
      <tr><td style="background:${SKY};border:1px solid ${LINE};border-radius:10px;padding:20px;text-align:center">
        <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;color:${BLUE}">${escapeHtml(code.label || 'Your code')}</div>
        <div style="font-family:'Courier New',monospace;font-size:34px;font-weight:bold;letter-spacing:8px;color:${NAVY};margin-top:8px">${escapeHtml(code.value)}</div>
        ${code.note ? `<div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${MUTED};margin-top:8px">${escapeHtml(code.note)}</div>` : ''}
      </td></tr>
    </table>` : ''

  const ctaBlock = cta ? button({ label: cta.label, url: cta.url, primary: true }) : ''
  const buttonsBlock = buttons.map((b) => button({ label: b.label, url: b.url, primary: b.primary !== false })).join('')
  const bodyBlock = paragraphs.map((p) => `<p style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:${INK}">${paragraphHtml(p)}</p>`).join('')

  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"></head>
<body style="margin:0;padding:0;background:${PAGE}">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(preheader || heading)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAGE}"><tr><td align="center" style="padding:24px 12px">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px">
      <tr><td style="background:${NAVY};border-radius:14px 14px 0 0;padding:22px 28px">
        <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;color:#9ec9e2">1330 (Warrington) Squadron</div>
        <div style="font-family:Arial,Helvetica,sans-serif;font-size:20px;font-weight:bold;color:#ffffff;margin-top:2px">Air Cadets &middot; Joining</div>
      </td></tr>
      <tr><td style="background:#ffffff;padding:30px 28px 26px">
        <h1 style="margin:0 0 18px;font-family:Arial,Helvetica,sans-serif;font-size:22px;line-height:1.3;color:${NAVY}">${escapeHtml(heading)}</h1>
        ${bodyBlock}
        ${codeBlock}
        ${ctaBlock}
        ${buttonsBlock}
      </td></tr>
      <tr><td style="background:#ffffff;border-radius:0 0 14px 14px;border-top:1px solid ${LINE};padding:20px 28px">
        <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.6;color:${INK}">Regards,<br><strong>1330 Squadron Staff</strong></p>
        <p style="margin:12px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:${MUTED}">This mailbox is not monitored. If you need help, contact the Squadron via <a href="https://warringtonaircadets.com/" style="color:${BLUE}">warringtonaircadets.com</a>.</p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`

  const textParts = [...paragraphs]
  if (code) textParts.push(`${code.label || 'Your code'}: ${code.value}${code.note ? ` (${code.note})` : ''}`)
  if (cta) textParts.push(`${cta.label}: ${cta.url}`)
  buttons.forEach((b) => textParts.push(`${b.label}: ${b.url}`))
  textParts.push('Regards,\n1330 Squadron Staff')
  textParts.push('This mailbox is not monitored. If you need help, contact the Squadron at https://warringtonaircadets.com/.')
  const text = textParts.join('\n\n')

  return { html, text }
}
