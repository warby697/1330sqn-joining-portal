// Writes to the seven families whose joining confirmation email gave a start date of
// 1 April 2027.
//
// The Open Night on 8 October 2026 fell a week after the 1 October intake, so the portal
// worked the start date out as the following April and put it in their confirmation email.
// The records and the Direct Debits are already corrected; this is the apology.
//
// Sent through the deployed send-joining-complete function, because the Resend key is a
// Netlify secret and is not held locally. That function sets the heading and appends the
// Signal group paragraph and buttons, so this supplies the subject and body only.
//
// Usage (dry run by default, prints the email and sends nothing):
//   node scripts/send-start-date-correction.mjs
//   node scripts/send-start-date-correction.mjs --apply
import { readFile } from 'node:fs/promises'
import { cert, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const apply = process.argv.includes('--apply')
const APP_URL = 'https://1330sqn-joining-portal.netlify.app'

// Only these are written to: paperwork finished, so the confirmation email had already
// gone out carrying the wrong date, and the start date since corrected to 12 October.
const CORRECTED_START = '2026-10-12'
const WRONG_DATE_AS_SENT = 'Thursday 1 April 2027'
const FIRST_COLLECTION = 'Monday 2 November'

const SUBJECT = 'Correction to the start date for {{cadetName}}'
const BODY = [
  'Dear {{parentName}},',
  `When we confirmed {{cadetName}}'s place with us, our email gave a start date of ${WRONG_DATE_AS_SENT}. That date was incorrect and we are sorry for the confusion it will have caused.`,
  '{{cadetName}} is due to start with us on {{startDate}} at 6.30pm. Parade nights are every Monday and Thursday.',
  `The monthly subscription of £18.50 will be collected by Direct Debit on ${FIRST_COLLECTION} and on the 1st of each month after that. The £30.00 joining fee you have already paid is unaffected, and your Direct Debit instruction does not need to be changed.`,
  "There is nothing you need to do. {{cadetName}}'s place is confirmed and their paperwork is complete.",
  'Please accept our apologies for the error.',
  'Yours sincerely,\n\n1330 (Warrington) Squadron',
].join('\n\n')

const keyPath = new URL('../.secrets/joining-portal-firebase-admin.json', import.meta.url)
const db = getFirestore(initializeApp({ credential: cert(JSON.parse(await readFile(keyPath, 'utf8'))), projectId: 'sqn-ops' }, `correct-${Date.now()}`))

const snapshot = await db.collection('joiningPortalFamilies').get()
const recipients = []
for (const doc of snapshot.docs) {
  const family = doc.data()
  for (const cadet of family.cadets || []) {
    if (cadet.paperworkStatus !== 'completed') continue
    if (!String(cadet.intendedStartDate || '').startsWith(CORRECTED_START)) continue
    if (cadet.startDateCorrectionSentAt) continue
    recipients.push({ familyRef: doc.ref, family, cadet })
  }
}

console.log(apply ? `APPLYING: writing to ${recipients.length} families` : `DRY RUN: would write to ${recipients.length} families`)
console.log()

if (!apply) {
  const sample = recipients[0]
  if (sample) {
    const values = {
      parentName: sample.family.guardian?.fullName || 'Parent or guardian',
      cadetName: sample.cadet.fullName,
      startDate: new Date(sample.cadet.intendedStartDate).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
    }
    const fill = (text) => String(text).replace(/{{([a-zA-Z]+)}}/g, (_, key) => values[key] ?? '')
    console.log('To:      ' + (sample.family.guardian?.email || ''))
    console.log('Subject: ' + fill(SUBJECT))
    console.log()
    console.log(fill(BODY))
    console.log()
    console.log('---')
  }
  for (const item of recipients) {
    console.log(`${item.cadet.fullName.padEnd(22)} ${(item.family.guardian?.fullName || '').padEnd(22)} ${item.family.guardian?.email || ''}`)
  }
  console.log()
  console.log('Nothing was sent. Re-run with --apply.')
  process.exit(0)
}

const sent = []
const failed = []
for (const item of recipients) {
  const to = item.family.guardian?.email
  if (!to) {
    failed.push(`${item.cadet.fullName}: no email on file`)
    continue
  }
  try {
    const response = await fetch(`${APP_URL}/.netlify/functions/send-joining-complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to,
        parentName: item.family.guardian?.fullName || 'Parent or guardian',
        cadetName: item.cadet.fullName,
        startDate: item.cadet.intendedStartDate,
        template: { subject: SUBJECT, body: BODY },
      }),
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`)

    // Marked on the record so a re-run cannot write to the same family twice.
    const cadets = (item.family.cadets || []).map((cadet) => (cadet.id === item.cadet.id
      ? { ...cadet, startDateCorrectionSentAt: new Date().toISOString() }
      : cadet))
    await item.familyRef.update({ cadets, updatedAt: new Date().toISOString() })
    sent.push(`${item.cadet.fullName} (${to})`)
  } catch (error) {
    failed.push(`${item.cadet.fullName} (${to}): ${error.message}`)
  }
}

const report = (title, list) => {
  if (!list.length) return
  console.log(title)
  for (const line of list) console.log('  ' + line)
  console.log()
}
report('Sent:', sent)
report('FAILED:', failed)
console.log(`${sent.length} sent, ${failed.length} failed.`)
process.exit(failed.length ? 1 : 0)
