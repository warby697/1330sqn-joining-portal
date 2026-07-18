import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { cadetNameParts, buildReference } from '../../src/lib/reference.js'
import {
  GENDER_OPTIONS,
  PRONOUN_OPTIONS,
  ETHNICITY_OPTIONS,
  PREV_ORG_OPTIONS,
  CONDITION_OPTIONS,
  ALLERGY_OPTIONS,
  DIETARY_OPTIONS,
  SEVERITY_OPTIONS,
} from '../../src/lib/options.js'
import { FEE_LABEL, SUBS_LABEL } from '../../src/lib/pricing.js'

const PAGE_WIDTH = 595.28 // A4 portrait, points
const PAGE_HEIGHT = 841.89
const MARGIN = 40
const LABEL_WIDTH = 175

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

function wrapText(text, font, size, maxWidth) {
  const words = String(text).split(/\s+/)
  const lines = []
  let line = ''
  for (const word of words) {
    const test = line ? `${line} ${word}` : word
    if (line && font.widthOfTextAtSize(test, size) > maxWidth) {
      lines.push(line)
      line = word
    } else {
      line = test
    }
  }
  if (line) lines.push(line)
  return lines
}

function labelOf(options, value) {
  return options.find((o) => o.value === value)?.label || value
}

function yn(v) {
  return v === true ? 'Yes' : v === false ? 'No' : undefined
}

function fullAddress(formData, prefix) {
  return [
    formData[`${prefix}.property`],
    formData[`${prefix}.street`],
    formData[`${prefix}.area`],
    formData[`${prefix}.town`],
    formData[`${prefix}.county`],
    formData[`${prefix}.postcode`],
  ].filter(Boolean).join(', ')
}

async function buildFormPdf(formData, reference) {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const usableWidth = PAGE_WIDTH - MARGIN * 2
  const valueWidth = usableWidth - LABEL_WIDTH

  let page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
  let y = PAGE_HEIGHT - MARGIN
  const newPage = () => { page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]); y = PAGE_HEIGHT - MARGIN }
  const ensureSpace = (needed) => { if (y - needed < MARGIN) newPage() }

  const drawRow = (label, value, opts = {}) => {
    const text = value === undefined || value === null || value === '' ? '—' : String(value)
    const valueFont = opts.bold ? bold : font
    const lines = wrapText(text, valueFont, 10, valueWidth)
    const rowHeight = Math.max(16, lines.length * 12 + 4)
    ensureSpace(rowHeight)
    page.drawText(label, { x: MARGIN + (opts.indent || 0), y, size: 9, font, color: GREY })
    lines.forEach((line, i) => {
      page.drawText(line, { x: MARGIN + LABEL_WIDTH, y: y - i * 12, size: 10, font: valueFont, color: opts.color })
    })
    y -= rowHeight
  }

  const drawSectionHeader = (title) => {
    ensureSpace(24)
    page.drawRectangle({ x: MARGIN, y: y - 18, width: usableWidth, height: 18, color: HEADER_BG })
    page.drawText(title, { x: MARGIN + 6, y: y - 13, size: 10, font: bold })
    y -= 24
  }

  const drawSubHeader = (title) => {
    ensureSpace(16)
    page.drawText(title, { x: MARGIN, y, size: 9.5, font: bold, color: rgb(0.12, 0.16, 0.32) })
    y -= 15
  }

  page.drawText('1330 Squadron RAF Air Cadets', { x: MARGIN, y, size: 15, font: bold })
  y -= 18
  page.drawText('Joining Portal — Full Submission (Form 3822A / 3822H)', { x: MARGIN, y, size: 11, font, color: GREY })
  y -= 14
  page.drawText(`Reference: ${reference} · Generated ${new Date().toLocaleString('en-GB')}`, { x: MARGIN, y, size: 9, font, color: GREY })
  y -= 20

  // --- 3822A Section 1a: Cadet's details ---
  drawSectionHeader("1a. Cadet's details")
  drawRow("Cadet's full name", formData['cadet.fullName'])
  drawRow('Date of birth', formData['cadet.dob'])
  drawRow('Nationality', formData['cadet.nationality'])
  drawRow('Religion', formData['cadet.religion'])
  drawRow('Gender', labelOf(GENDER_OPTIONS, formData['cadet.gender']))
  if (formData['cadet.gender'] === 'other') drawRow('Gender (please specify)', formData['cadet.genderOther'])
  drawRow('Pronoun', labelOf(PRONOUN_OPTIONS, formData['cadet.pronoun']))
  drawRow('Ethnicity', labelOf(ETHNICITY_OPTIONS, formData['cadet.ethnicity']))
  y -= 6

  // --- 1b: External agency involvement ---
  drawSectionHeader('1b. External agency involvement')
  drawRow('Social worker/family support worker currently involved?', yn(formData['cadet.externalAgency']))
  y -= 6

  // --- 1c: Cadet's contact details ---
  drawSectionHeader("1c. Cadet's contact details")
  drawRow('Address', fullAddress(formData, 'cadet.address'))
  drawRow('Mobile phone', formData['cadet.mobile'])
  drawRow('Home phone', formData['cadet.homePhone'])
  drawRow("Cadet's primary email", formData['cadet.primaryEmail'])
  drawRow('Secondary email', formData['cadet.secondaryEmail'])
  drawRow('Confirmed email belongs to cadet', yn(formData['cadet.emailConfirmed']))
  y -= 6

  // --- 1d: Previous youth organisations ---
  drawSectionHeader('1d. Previous youth organisations')
  const prevOrgs = formData['cadet.previousOrgs'] || []
  drawRow('Previously belonged to', prevOrgs.length ? prevOrgs.map((v) => labelOf(PREV_ORG_OPTIONS, v)).join(', ') : 'None')
  drawRow('Other organisation', formData['cadet.otherOrg'])
  y -= 6

  // --- 2a: Next of kin - parent/guardian 1 ---
  drawSectionHeader('2a. Next of kin — parent/guardian 1')
  drawRow('Parental responsibility confirmed', yn(formData['parent1.parentalResponsibility']))
  drawRow('Title', formData['parent1.title'])
  drawRow('Full name', formData['parent1.fullName'])
  drawRow('Relationship to cadet', formData['parent1.relationship'])
  drawRow('Address', fullAddress(formData, 'parent1.address'))
  drawRow('Mobile phone', formData['parent1.mobile'])
  drawRow('Home phone', formData['parent1.homePhone'])
  drawRow('Primary email', formData['parent1.primaryEmail'])
  drawRow('Secondary email', formData['parent1.secondaryEmail'])
  y -= 6

  // --- 2b: Second contact ---
  drawSectionHeader('2b. Second contact')
  if (formData.hasSecondContact) {
    drawRow('Title', formData['parent2.title'])
    drawRow('Full name', formData['parent2.fullName'])
    drawRow('Relationship to cadet', formData['parent2.relationship'])
    drawRow('Address', fullAddress(formData, 'parent2.address'))
    drawRow('Mobile phone', formData['parent2.mobile'])
    drawRow('Home phone', formData['parent2.homePhone'])
    drawRow('Primary email', formData['parent2.primaryEmail'])
    drawRow('Secondary email', formData['parent2.secondaryEmail'])
  } else {
    drawRow('Second parent/guardian added', 'No')
  }
  y -= 6

  // --- Section 3: Consent to participate ---
  drawSectionHeader('3. Consent to participate')
  const consentRows = [
    ['Photo/video use to promote the squadron', 'consent.photo'],
    ['Flying — air experience (light aircraft & gliders)', 'consent.flyingLight'],
    ['Flying — solo gliding/powered aircraft', 'consent.flyingSolo'],
    ['Flying — passenger transport aircraft & helicopters', 'consent.flyingTransport'],
    ['Flying — other incl. high-performance jets', 'consent.flyingOther'],
    ['Marksmanship training', 'consent.marksmanship'],
    ['Strenuous physical activity', 'consent.physical'],
    ['Lower-risk unit activities', 'consent.lowerRisk'],
    ["Will inform unit of medical condition changes", 'consent.medicalInform'],
    ['Staff/volunteers may transport child', 'consent.transport'],
  ]
  consentRows.forEach(([label, key]) => {
    const v = formData[key]
    drawRow(label, yn(v), { color: v === true ? GREEN : v === false ? AMBER : undefined })
  })
  y -= 6

  // --- Section 4/5: Medical trigger + treatment consent ---
  drawSectionHeader('4/5. Medical flag & treatment consent')
  drawRow('Medical condition/SEN/allergy/dietary requirement?', yn(formData['cadet.hasMedical']))
  drawRow('OiC may authorise emergency medical treatment', yn(formData['consent.medicalTreatment']), {
    color: formData['consent.medicalTreatment'] === true ? GREEN : formData['consent.medicalTreatment'] === false ? AMBER : undefined,
  })
  y -= 6

  // --- Section 6: Additional information ---
  drawSectionHeader('6. Additional information')
  drawRow('Current school', formData['cadet.school'])
  drawRow('How did you hear about us?', formData['cadet.howHeard'])
  drawRow('Why does your child want to join?', formData['cadet.reasonForJoining'])
  y -= 6

  // --- Payment ---
  drawSectionHeader('Payment')
  drawRow(`Joining fee (${FEE_LABEL})`, PAYMENT_LABELS[formData['payment.feeStatus']] || 'Not started', {
    bold: true,
    color: formData['payment.feeStatus'] === 'unconfirmed' ? AMBER : formData['payment.feeStatus'] ? GREEN : undefined,
  })
  drawRow(`Monthly subs (${SUBS_LABEL})`, PAYMENT_LABELS[formData['payment.subsStatus']] || 'Not started', {
    bold: true,
    color: formData['payment.subsStatus'] === 'unconfirmed' ? AMBER : formData['payment.subsStatus'] ? GREEN : undefined,
  })
  y -= 6

  // --- Section 8: Agreement & signature ---
  drawSectionHeader('8. Agreement & signature (3822A)')
  drawRow('OK for staff to contact using these details?', yn(formData['consent.contactShare']))
  drawRow('Signed by', formData['parent1.fullName'])
  drawRow('Signature', formData['signature.signature'], { bold: true })
  y -= 6

  // --- 3822H: Health Declaration ---
  if (formData['cadet.hasMedical'] === true) {
    drawSectionHeader('Health Declaration (Form 3822H)')

    drawSubHeader('2. Conditions')
    const conditions = formData['health.conditions'] || []
    const details = formData['health.details'] || {}
    if (conditions.length === 0) {
      drawRow('Conditions', 'None detailed')
    } else {
      conditions.forEach((key) => {
        const label = labelOf(CONDITION_OPTIONS, key)
        const d = details[key] || {}
        drawRow(label, labelOf(SEVERITY_OPTIONS, d.severity) || '—', { bold: true })
        drawRow('Sought healthcare advice?', yn(d.soughtAdvice), { indent: 12 })
        drawRow('Day-to-day impact', d.normal, { indent: 12 })
        drawRow('Impact during strenuous activity', d.strenuous, { indent: 12 })
        drawRow('Can control without intervention?', d.control, { indent: 12 })
        const meds = d.medications || []
        if (meds.length === 0) {
          drawRow('Medication', 'None listed', { indent: 12 })
        } else {
          meds.forEach((m, i) => {
            drawRow(`Medication ${i + 1}`, [m.name, m.dosage, m.storage ? `stored: ${m.storage}` : null].filter(Boolean).join(' · ') || '—', { indent: 12 })
          })
        }
      })
      if (conditions.includes('other')) drawRow('Other condition detail', formData['health.conditionsOther'])
    }
    y -= 4

    drawSubHeader('2a. Education, Health and Care Plan')
    drawRow('Has an EHC Plan?', yn(formData['health.ehc']))
    if (formData['health.ehc'] === true) drawRow('Willing to share a copy?', yn(formData['health.ehcShareCopy']), { indent: 12 })
    y -= 4

    drawSubHeader('3. Allergies')
    const allergies = formData['health.allergies'] || []
    const allergyDetails = formData['health.allergyDetails'] || {}
    if (allergies.length === 0) {
      drawRow('Allergies', 'None detailed')
    } else {
      allergies.forEach((key) => {
        const label = labelOf(ALLERGY_OPTIONS, key)
        const d = allergyDetails[key] || {}
        drawRow(label, [labelOf(SEVERITY_OPTIONS, d.severity), d.autoInjector ? 'auto-injector used' : null].filter(Boolean).join(', ') || '—')
      })
      if (allergies.includes('other')) drawRow('Other allergy detail', formData['health.allergiesOther'], { indent: 12 })
    }
    y -= 4

    drawSubHeader('4. Dietary restrictions')
    const dietary = formData['health.dietary'] || []
    drawRow('Dietary restrictions', dietary.length ? dietary.map((v) => labelOf(DIETARY_OPTIONS, v)).join(', ') : 'None')
    if (dietary.includes('other')) drawRow('Other dietary detail', formData['health.dietaryOther'], { indent: 12 })
    y -= 4

    drawSubHeader('5. Declaration & signature')
    drawRow('Signed by (forename)', formData['health.signature']?.forename)
    drawRow('Signed by (surname)', formData['health.signature']?.surname)
    drawRow('Signature', formData['health.signature']?.signature, { bold: true })
  }

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
  if (!formData) {
    return new Response(JSON.stringify({ error: 'Missing formData' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Where completed forms get emailed. Precedence:
  //  1. ADMIN_EMAILS env var (set in Netlify) — central control, wins on every device so
  //     staff can redirect submissions without a code change or worrying which browser was used.
  //  2. The address(es) chosen in the in-app admin panel (sent by the client).
  //  3. A safe default, so a submission can never silently go nowhere.
  const DEFAULT_ADMIN_EMAILS = ['1330squadronops@gmail.com']
  const parseList = (v) => String(v || '').split(',').map((s) => s.trim()).filter(Boolean)
  const envEmails = parseList(process.env.ADMIN_EMAILS)
  const clientEmails = Array.isArray(recipients) ? recipients.map((s) => String(s).trim()).filter(Boolean) : []
  const toList = envEmails.length ? envEmails : clientEmails.length ? clientEmails : DEFAULT_ADMIN_EMAILS

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
      to: toList,
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
