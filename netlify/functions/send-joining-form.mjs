import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { cadetNameParts, buildReference } from '../../src/lib/reference.js'
import { GENDER_OPTIONS, PRONOUN_OPTIONS, CONDITION_OPTIONS, ALLERGY_OPTIONS } from '../../src/lib/options.js'

const PAGE_WIDTH = 595.28 // A4 portrait, points
const PAGE_HEIGHT = 841.89
const MARGIN = 40

const GREEN = rgb(0.16, 0.4, 0.24)
const AMBER = rgb(0.7, 0.5, 0.1)
const GREY = rgb(0.5, 0.5, 0.5)
const HEADER_BG = rgb(0.93, 0.94, 0.96)

const PAYMENT_LABELS = { paid: 'Paid', active: 'Active', unconfirmed: 'NOT CONFIRMED — check GoCardless' }
const SENDER_DISPLAY_NAME = '1330 Squadron RAF Air Cadets'

// Parents shouldn't see (or reply to) the raw sending address - just a friendly name. Works
// whether RESEND_FROM is a bare address or already "Name <address>" formatted.
function formatFrom(raw) {
  const match = raw.match(/<(.+)>/)
  const email = (match ? match[1] : raw).trim()
  return `${SENDER_DISPLAY_NAME} <${email}>`
}

async function buildFormPdf(formData, reference) {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const usableWidth = PAGE_WIDTH - MARGIN * 2

  let page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
  let y = PAGE_HEIGHT - MARGIN
  const newPage = () => { page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]); y = PAGE_HEIGHT - MARGIN }
  const ensureSpace = (needed) => { if (y - needed < MARGIN) newPage() }

  const drawRow = (label, value, opts = {}) => {
    ensureSpace(16)
    page.drawText(label, { x: MARGIN, y, size: 9, font, color: GREY })
    page.drawText(String(value ?? '—'), { x: MARGIN + 170, y, size: 10, font: opts.bold ? bold : font, color: opts.color })
    y -= 16
  }

  const drawSectionHeader = (title) => {
    ensureSpace(24)
    page.drawRectangle({ x: MARGIN, y: y - 18, width: usableWidth, height: 18, color: HEADER_BG })
    page.drawText(title, { x: MARGIN + 6, y: y - 13, size: 10, font: bold })
    y -= 24
  }

  page.drawText('1330 Squadron RAF Air Cadets', { x: MARGIN, y, size: 15, font: bold })
  y -= 18
  page.drawText('Joining Portal — Consent Certificate & Payment Summary', { x: MARGIN, y, size: 11, font, color: GREY })
  y -= 14
  page.drawText(`Reference: ${reference} · Generated ${new Date().toLocaleString('en-GB')}`, { x: MARGIN, y, size: 9, font, color: GREY })
  y -= 20

  const genderLabel = GENDER_OPTIONS.find((g) => g.value === formData['cadet.gender'])?.label
  const pronounLabel = PRONOUN_OPTIONS.find((p) => p.value === formData['cadet.pronoun'])?.label
  const addr = (p) => [formData[`${p}.property`], formData[`${p}.street`], formData[`${p}.town`], formData[`${p}.postcode`]].filter(Boolean).join(', ')

  drawSectionHeader('Cadet details')
  drawRow("Cadet's full name", formData['cadet.fullName'])
  drawRow('Date of birth', formData['cadet.dob'])
  drawRow('Gender / pronoun', [genderLabel, pronounLabel].filter(Boolean).join(' · ') || undefined)
  drawRow('Nationality', formData['cadet.nationality'])
  drawRow('Address', addr('cadet.address'))
  drawRow('Cadet email', formData['cadet.primaryEmail'])
  y -= 6

  drawSectionHeader('Parent/guardian details')
  drawRow('Parent/guardian', formData['parent1.fullName'])
  drawRow('Relationship', formData['parent1.relationship'])
  drawRow('Parental responsibility', formData['parent1.parentalResponsibility'] === true ? 'Confirmed' : formData['parent1.parentalResponsibility'] === false ? 'Not confirmed' : undefined)
  drawRow('Contact', [formData['parent1.mobile'], formData['parent1.primaryEmail']].filter(Boolean).join(' · '))
  drawRow('External agency involved', formData['cadet.externalAgency'] === true ? 'Yes' : formData['cadet.externalAgency'] === false ? 'No' : undefined)
  drawRow('Medical/allergy flag', formData['cadet.hasMedical'] === true ? 'Yes — see Health Declaration below' : formData['cadet.hasMedical'] === false ? 'No' : undefined)
  y -= 6

  drawSectionHeader('Payment')
  drawRow('Joining fee (£30.00)', PAYMENT_LABELS[formData['payment.feeStatus']] || 'Not started', {
    bold: true,
    color: formData['payment.feeStatus'] === 'unconfirmed' ? AMBER : formData['payment.feeStatus'] ? GREEN : undefined,
  })
  drawRow('Monthly subs (£18.50/month)', PAYMENT_LABELS[formData['payment.subsStatus']] || 'Not started', {
    bold: true,
    color: formData['payment.subsStatus'] === 'unconfirmed' ? AMBER : formData['payment.subsStatus'] ? GREEN : undefined,
  })
  y -= 6

  drawSectionHeader('Consents given')
  const consents = [
    ['Photo & video use', 'consent.photo'],
    ['Flying — air experience', 'consent.flyingLight'],
    ['Flying — solo gliding/powered aircraft', 'consent.flyingSolo'],
    ['Flying — passenger transport/helicopters', 'consent.flyingTransport'],
    ['Flying — other incl. high-performance jets', 'consent.flyingOther'],
    ['Marksmanship training', 'consent.marksmanship'],
    ['Strenuous physical activity', 'consent.physical'],
    ['Lower-risk unit activities', 'consent.lowerRisk'],
    ['Transport by staff/volunteers', 'consent.transport'],
    ['Emergency medical treatment authorisation', 'consent.medicalTreatment'],
    ['Contact detail sharing', 'consent.contactShare'],
  ]
  consents.forEach(([label, key]) => {
    const v = formData[key]
    drawRow(label, v === undefined ? undefined : v ? 'Yes' : 'No', { color: v ? GREEN : undefined })
  })
  y -= 6

  if (formData['cadet.hasMedical'] === true) {
    drawSectionHeader('Health Declaration (3822H)')
    const conditions = formData['health.conditions'] || []
    const details = formData['health.details'] || {}
    if (conditions.length === 0) {
      drawRow('Conditions', 'None detailed')
    } else {
      conditions.forEach((key) => {
        const label = CONDITION_OPTIONS.find((c) => c.value === key)?.label || key
        drawRow(label, details[key]?.severity || '—')
      })
    }
    const allergies = formData['health.allergies'] || []
    const allergyDetails = formData['health.allergyDetails'] || {}
    if (allergies.length === 0) {
      drawRow('Allergies', 'None detailed')
    } else {
      allergies.forEach((key) => {
        const label = ALLERGY_OPTIONS.find((a) => a.value === key)?.label || key
        const d = allergyDetails[key] || {}
        drawRow(label, [d.severity, d.autoInjector ? 'auto-injector' : null].filter(Boolean).join(', ') || '—')
      })
    }
    drawRow('Dietary restrictions', (formData['health.dietary'] || []).length ? formData['health.dietary'].join(', ') : 'None')
    drawRow('Declaration signed by', formData['health.signature']?.signature)
    y -= 6
  }

  ensureSpace(20)
  page.drawText(`Signed ${formData['signature.signature'] || '—'}, parent/guardian`, { x: MARGIN, y, size: 10, font: bold })
  y -= 20

  const bytes = await doc.save()
  return bytes
}

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM
  if (!apiKey || !from) {
    return new Response(JSON.stringify({
      error: 'Email sending is not configured yet - RESEND_API_KEY and RESEND_FROM need to be set in Netlify environment variables.',
    }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }

  let body
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), { status: 400 })
  }

  const { formData, recipients } = body
  if (!formData || !Array.isArray(recipients) || recipients.length === 0) {
    return new Response(JSON.stringify({ error: 'Missing formData or recipients' }), { status: 400 })
  }

  const { surname, forename } = cadetNameParts(formData)
  const reference = buildReference(formData)

  const pdfBytes = await buildFormPdf(formData, reference)
  const pdfBase64 = Buffer.from(pdfBytes).toString('base64')

  const subject = `New Joiner - ${surname}, ${forename}`
  const feeLabel = PAYMENT_LABELS[formData['payment.feeStatus']] || 'not started'
  const subsLabel = PAYMENT_LABELS[formData['payment.subsStatus']] || 'not started'
  const bodyText = `New joining form submitted for ${formData['cadet.fullName'] || 'a cadet'} (ref ${reference}).\n\nJoining fee: ${feeLabel}\nMonthly subs: ${subsLabel}\n\nFull form attached as PDF.`
  const parentEmail = formData['parent1.primaryEmail']

  const resendRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: formatFrom(from),
      to: recipients,
      ...(parentEmail ? { cc: [parentEmail] } : {}),
      subject,
      text: bodyText,
      attachments: [{ filename: `${surname} joining form.pdf`, content: pdfBase64 }],
    }),
  })

  if (!resendRes.ok) {
    const errText = await resendRes.text()
    return new Response(JSON.stringify({ error: `Resend API error: ${errText}` }), { status: 502, headers: { 'Content-Type': 'application/json' } })
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

export const config = { path: '/api/send-joining-form' }
