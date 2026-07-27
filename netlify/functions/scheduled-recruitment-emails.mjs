import { FieldValue } from 'firebase-admin/firestore'
import { joiningPortalCollections, joiningPortalDb } from './_firebase-admin.mjs'
import { DEFAULT_EMAIL_TEMPLATES, DEFAULT_KEY_DATES, emailPortalUrl } from '../../src/lib/communicationSettings.js'
import { renderEmail, bodyToParagraphs } from './_email-layout.mjs'

// Which reminder gets which button. Start-date reminders are informational, so no button.
const CTA_LABELS = {
  booking_nudge: 'Book your Open Night',
  open_night_reminder: 'Review your booking',
  open_night_final_reminder: 'Review your booking',
  paperwork_reminder: 'Continue the joining paperwork',
  code_expiry_warning: 'Start now',
}

export const config = { schedule: '0 * * * *' }

const APP_URL = process.env.URL || 'https://1330sqn-joining-portal.netlify.app'
const STAFF_ALERT_EMAIL = '1330squadronops@gmail.com'
const hour = 60 * 60 * 1000
const day = 24 * hour
const fill = (text, values) => String(text || '').replace(/{{(\w+)}}/g, (_, key) => values[key] || '')
const formatDate = (value) => new Date(value).toLocaleDateString('en-GB', { timeZone: 'Europe/London', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
const openNightDate = (cadet, settings) => {
  const date = String(cadet.openNightId || '').replace('open-night-', '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
  const summer = date >= `${date.slice(0, 4)}-03-29` && date < `${date.slice(0, 4)}-10-25`
  return new Date(`${date}T${settings.openNightStart || '19:15'}:00${summer ? '+01:00' : '+00:00'}`)
}
const due = (target, now) => target && now >= target && now < new Date(target.getTime() + 2 * hour)

async function sendEmail({ to, subject, heading, intro, cta }) {
  const apiKey = process.env.RESEND_API_KEY
  const rawFrom = process.env.RESEND_FROM
  if (!apiKey || !rawFrom) throw new Error('Email sending is not configured.')
  const match = String(rawFrom).match(/<(.+)>/)
  const from = `1330 Squadron Staff <${(match ? match[1] : rawFrom).trim()}>`
  const { html, text } = renderEmail({ heading, paragraphs: bodyToParagraphs(intro), cta })
  const response = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from, to, subject, html }) })
  if (!response.ok) throw new Error(await response.text())
  return { provider: await response.json(), text }
}

export default async () => {
  const db = joiningPortalDb()
  const [familiesSnapshot, templatesDoc, datesDoc] = await Promise.all([
    db.collection(joiningPortalCollections.families).get(),
    db.collection(joiningPortalCollections.settings).doc('emailTemplates').get(),
    db.collection(joiningPortalCollections.settings).doc('keyDates').get(),
  ])
  const templates = templatesDoc.exists ? templatesDoc.get('value') : DEFAULT_EMAIL_TEMPLATES
  const settings = { ...DEFAULT_KEY_DATES, ...(datesDoc.exists ? datesDoc.get('value') : {}) }
  const now = new Date()
  let sent = 0
  const missedIntakeApplications = []

  for (const document of familiesSnapshot.docs) {
    const family = document.data()
    const existing = family._messages || []
    for (const cadet of family.cadets || []) {
      if (cadet.status === 'withdrawn') continue
      const eventDate = openNightDate(cadet, settings)
      const attended = cadet.attendedAt ? new Date(cadet.attendedAt) : null
      const codeExpiry = cadet.joiningCodeExpiresAt ? new Date(cadet.joiningCodeExpiresAt) : null
      const startDate = cadet.intendedStartDate ? new Date(cadet.intendedStartDate) : null
      const verified = family.guardian?.verifiedAt ? new Date(family.guardian.verifiedAt) : null
      const candidates = [
        { id: 'booking_nudge', when: verified && !cadet.openNightId ? new Date(verified.getTime() + 2 * day) : null },
        { id: 'open_night_reminder', when: eventDate && !attended ? new Date(eventDate.getTime() - Number(settings.reminderDaysBefore || 7) * day) : null },
        { id: 'open_night_final_reminder', when: eventDate && !attended ? new Date(eventDate.getTime() - Number(settings.finalReminderHoursBefore || 24) * hour) : null },
        { id: 'paperwork_reminder', when: attended && cadet.paperworkStatus !== 'completed' ? new Date(attended.getTime() + 7 * day) : null },
        { id: 'code_expiry_warning', when: codeExpiry && !cadet.joiningCodeUsedAt ? new Date(codeExpiry.getTime() - 3 * day) : null },
        { id: 'start_reminder_7_days', when: startDate && cadet.paperworkStatus === 'completed' ? new Date(startDate.getTime() - 7 * day) : null },
        { id: 'start_reminder_24_hours', when: startDate && cadet.paperworkStatus === 'completed' ? new Date(startDate.getTime() - day) : null },
      ]
      for (const candidate of candidates) {
        const template = templates.find((item) => item.id === candidate.id)
        if (!template?.active || !due(candidate.when, now) || existing.some((message) => message.cadetId === cadet.id && message.templateId === candidate.id)) continue
        const values = {
          parentName: family.guardian.fullName,
          cadetName: cadet.fullName,
          openNightDate: eventDate ? formatDate(eventDate) : '',
          codeExpiry: codeExpiry ? formatDate(codeExpiry) : '',
          startDate: startDate ? formatDate(startDate) : '',
        }
        const returnLink = emailPortalUrl(candidate.id, { appUrl: APP_URL, familyId: family.id, accessToken: family.accessToken })
        const subject = fill(template.subject, values)
        const intro = fill(template.body, values)
        const ctaLabel = CTA_LABELS[candidate.id]
        const { provider, text } = await sendEmail({ to: family.guardian.email, subject, heading: subject, intro, cta: ctaLabel ? { label: ctaLabel, url: returnLink } : undefined })
        const message = { id: `message-${crypto.randomUUID()}`, familyId: family.id, cadetId: cadet.id, templateId: candidate.id, kind: candidate.id, createdAt: now.toISOString(), status: 'sent', to: family.guardian.email, subject, body: text, providerMessageId: provider.id || null }
        await document.ref.update({ _messages: FieldValue.arrayUnion(message), serverUpdatedAt: FieldValue.serverTimestamp() })
        existing.push(message)
        sent += 1
      }
      if (startDate && now >= new Date(startDate.getTime() + 14 * day) && !['joined', 'withdrawn'].includes(cadet.status)) {
        const alertKey = `missed_intake_staff_alert:${startDate.toISOString().slice(0, 10)}`
        if (!existing.some((message) => message.cadetId === cadet.id && message.alertKey === alertKey)) {
          missedIntakeApplications.push({ document, family, cadet, startDate, alertKey })
        }
      }
    }
  }

  if (missedIntakeApplications.length) {
    const template = templates.find((item) => item.id === 'missed_intake_staff_alert')
    if (template?.active) {
      const outstandingList = missedIntakeApplications.map(({ family, cadet, startDate }) => `- ${cadet.fullName} - intended start ${formatDate(startDate)} - parent: ${family.guardian.fullName} (${family.guardian.email})`).join('\n')
      const subject = fill(template.subject, { outstandingList })
      const intro = fill(template.body, { outstandingList })
      const { provider, text } = await sendEmail({ to: STAFF_ALERT_EMAIL, subject, heading: 'Applications past their start date', intro, cta: { label: 'Open the staff dashboard', url: `${APP_URL}/#/staff` } })
      for (const item of missedIntakeApplications) {
        const message = { id: `message-${crypto.randomUUID()}`, familyId: item.family.id, cadetId: item.cadet.id, templateId: template.id, alertKey: item.alertKey, kind: template.id, createdAt: now.toISOString(), status: 'sent', to: STAFF_ALERT_EMAIL, subject, body: text, providerMessageId: provider.id || null }
        await item.document.ref.update({ _messages: FieldValue.arrayUnion(message), serverUpdatedAt: FieldValue.serverTimestamp() })
      }
      sent += 1
    }
  }
  return Response.json({ checked: familiesSnapshot.size, sent })
}
