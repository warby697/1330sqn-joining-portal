// Moves an Open Night to a new date: updates the key dates, moves every booking
// that has not yet attended, and emails each affected parent.
//
// Done here rather than through the staff "Emails and key dates" screen because
// that screen builds the parent's booking link from a token the staff session
// does not hold, so its emails carry a link that does not open their booking.
//
// Usage (dry run by default, nothing written or sent):
//   node scripts/move-open-night.mjs --from 2026-09-24 --to 2026-10-08
//   node scripts/move-open-night.mjs --from 2026-09-24 --to 2026-10-08 --apply
import { readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { cert, initializeApp } from 'firebase-admin/app'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'

const arg = (name) => { const i = process.argv.indexOf(name); return i === -1 ? '' : process.argv[i + 1] || '' }
const from = arg('--from')
const to = arg('--to')
const apply = process.argv.includes('--apply')
if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
  console.error('Usage: node scripts/move-open-night.mjs --from YYYY-MM-DD --to YYYY-MM-DD [--apply]')
  process.exit(1)
}

const APP_URL = 'https://1330sqn-joining-portal.netlify.app'
const longDate = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).replace(',', '')

const SUBJECT = 'Change of date: Open Night for {{cadetName}}'
const BODY = [
  'Dear {{parentName}},',
  'We are writing to let you know that the Open Night previously arranged for {{oldDate}} has been postponed. It will now take place on {{newDate}}.',
  'We apologise for any inconvenience this may cause. The booking for {{cadetName}} has been transferred to the new date automatically, so there is nothing further you need to do.',
  "All other arrangements are unchanged. Please arrive at 7.10pm and wait at the gate at Peninsula Barracks, O'Leary Street, Warrington, WA2 7QS. The gate will open at 7.15pm. A parent or guardian and {{cadetName}} should attend together.",
  'If the new date is not convenient, please use the button below to choose another date or to withdraw the enquiry.',
  'We look forward to welcoming you.',
  'Yours sincerely,\n\n1330 Squadron',
].join('\n\n')

const keyPath = new URL('../.secrets/joining-portal-firebase-admin.json', import.meta.url)
const db = getFirestore(initializeApp({ credential: cert(JSON.parse(await readFile(keyPath, 'utf8'))), projectId: 'sqn-ops' }, `move-${Date.now()}`))
const settings = db.collection('joiningPortalSettings')
const families = db.collection('joiningPortalFamilies')
const oldId = `open-night-${from}`
const newId = `open-night-${to}`

const datesDoc = await settings.doc('keyDates').get()
const dates = datesDoc.get('value') || {}
const nights = dates.openNights || []
if (!nights.includes(from)) { console.error(`${from} is not a scheduled Open Night.`); process.exit(1) }
const newNights = [...new Set(nights.map((d) => (d === from ? to : d)))].sort()

const snap = await families.get()
const affected = []
for (const doc of snap.docs) {
  const f = doc.data()
  for (const c of f.cadets || []) {
    if (c.openNightId === oldId && !c.attendedAt && c.status !== 'withdrawn') affected.push({ doc, family: f, cadet: c })
  }
}

const fill = (text, values) => text.replace(/{{(\w+)}}/g, (_, key) => values[key] ?? '')

console.log(`Open Nights: ${nights.join(', ')}`)
console.log(`       now: ${newNights.join(', ')}`)
console.log(`\n${affected.length} booking(s) to move from ${longDate(from)} to ${longDate(to)}:`)
for (const { family, cadet } of affected) console.log(` - ${cadet.fullName} (${family.guardian?.fullName} <${family.guardian?.email}>)${family.accessToken ? '' : '  NO ACCESS TOKEN'}`)

if (affected[0]) {
  const { family, cadet } = affected[0]
  const values = { parentName: family.guardian?.fullName, cadetName: cadet.fullName, oldDate: longDate(from), newDate: longDate(to) }
  console.log('\n--- Email preview ---')
  console.log('Subject:', fill(SUBJECT, values))
  console.log(fill(BODY, values))
  console.log('[button] Review your booking')
}

if (!apply) { console.log('\nDRY RUN - nothing written or sent. Re-run with --apply.'); process.exit(0) }

// 1. The schedule, and the template so any future date change reads the same way.
const templatesDoc = await settings.doc('emailTemplates').get()
const templates = (templatesDoc.get('value') || []).map((t) => (t.id === 'open_night_date_changed' ? { ...t, subject: SUBJECT, body: BODY } : t))
await settings.doc('keyDates').set({ value: { ...dates, openNights: newNights } }, { merge: true })
await settings.doc('emailTemplates').set({ value: templates }, { merge: true })
console.log('\nKey dates and email template updated.')

// 2. Move each booking, then email that parent.
let sent = 0
for (const { doc, family, cadet } of affected) {
  await db.runTransaction(async (t) => {
    const current = await t.get(doc.ref)
    const cadets = (current.get('cadets') || []).map((c) => (c.id === cadet.id && c.openNightId === oldId && !c.attendedAt ? { ...c, openNightId: newId } : c))
    t.update(doc.ref, { cadets, updatedAt: new Date().toISOString(), serverUpdatedAt: FieldValue.serverTimestamp() })
  })
  const values = { parentName: family.guardian?.fullName || 'Parent or guardian', cadetName: cadet.fullName, oldDate: longDate(from), newDate: longDate(to) }
  const portalUrl = `${APP_URL}/#/family/${doc.id}/${family.accessToken || ''}`
  let status = 'failed'
  let providerMessageId = null
  let body = ''
  try {
    const res = await fetch(`${APP_URL}/.netlify/functions/send-open-night-date-change`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: family.guardian.email, ...values, portalUrl, template: { subject: SUBJECT, body: BODY } }),
    })
    const result = await res.json().catch(() => ({}))
    if (res.ok && result.sent) { status = 'sent'; providerMessageId = result.providerMessageId || null; body = result.body || ''; sent += 1 }
    else console.error(`   email failed for ${cadet.fullName}: ${result.error || res.status}`)
  } catch (error) {
    console.error(`   email failed for ${cadet.fullName}: ${error.message}`)
  }
  await doc.ref.update({
    _messages: FieldValue.arrayUnion({
      id: `message-${randomUUID()}`, familyId: doc.id, cadetId: cadet.id, kind: 'open_night_date_changed', templateId: 'open_night_date_changed',
      createdAt: new Date().toISOString(), status, to: family.guardian.email, subject: fill(SUBJECT, values), body, providerMessageId,
    }),
  })
  console.log(` ${status === 'sent' ? 'moved + emailed' : 'moved, EMAIL FAILED'}: ${cadet.fullName}`)
}
console.log(`\nDone. ${affected.length} moved, ${sent} emailed.`)
process.exit(0)
