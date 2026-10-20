// Closes an enrolment window and tidies the pipeline behind it.
//
// Three things, none of which delete anything or email anybody:
//   1. Sets the enrolment close date, so a new enquiry is offered the next intake instead
//      of a recruit course that has already formed up.
//   2. Archives Open Nights that have been and gone. They stay in the settings so their
//      rosters and attendance still resolve, they are just marked so the desk hides them.
//   3. Marks anyone who never attended a past Open Night, and never came back, as not
//      joined, with the reason recorded. Their record is kept in full.
//
// Future Open Nights and the people booked onto them are left completely alone.
//
// Usage (dry run by default):
//   node scripts/close-intake.mjs --closed 2026-10-20
//   node scripts/close-intake.mjs --closed 2026-10-20 --apply
import { readFile } from 'node:fs/promises'
import { cert, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { joiningSettled } from '../src/lib/paperworkComplete.js'

// An enquiry younger than this has not had a fair chance to book or reply.
const RECENT_ENQUIRY_DAYS = 21

const arg = (name) => { const i = process.argv.indexOf(name); return i === -1 ? '' : process.argv[i + 1] || '' }
const apply = process.argv.includes('--apply')
const closedOn = arg('--closed')
if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(closedOn)) {
  console.error('Usage: node scripts/close-intake.mjs --closed YYYY-MM-DD [--apply]')
  process.exit(1)
}

const keyPath = new URL('../.secrets/joining-portal-firebase-admin.json', import.meta.url)
const db = getFirestore(initializeApp({ credential: cert(JSON.parse(await readFile(keyPath, 'utf8'))), projectId: 'sqn-ops' }, `close-${Date.now()}`))

const settingsRef = db.collection('joiningPortalSettings').doc('keyDates')
const settingsDoc = await settingsRef.get()
const keyDates = settingsDoc.exists ? settingsDoc.get('value') : {}
const openNights = keyDates.openNights || []
const alreadyArchived = new Set(keyDates.archivedOpenNights || [])

// A night is past if it happened before today. Nothing in the future is touched.
const today = new Date().toISOString().slice(0, 10)
const toArchive = openNights.filter((date) => date < today && !alreadyArchived.has(date))
const stillLive = openNights.filter((date) => date >= today)

console.log(apply ? 'APPLYING' : 'DRY RUN, nothing written')
console.log()
console.log(`Enrolment closed up to and including: ${closedOn}`)
console.log(`  (was: ${keyDates.intakeClosedOn || 'not set'})`)
console.log()
console.log('Open Nights to archive: ' + (toArchive.join(', ') || 'none'))
console.log('Open Nights left live:  ' + (stillLive.join(', ') || 'none'))
console.log()

const snapshot = await db.collection('joiningPortalFamilies').get()

// Someone can appear twice: a parent enquires, then enquires again, or both parents do.
// Matching on date of birth and the parent email rather than the name, because the names
// are typed differently each time ("George Mairs" and "George Robert MAIRS").
const enrolledKeys = new Set()
for (const doc of snapshot.docs) {
  const family = doc.data()
  for (const cadet of family.cadets || []) {
    if (!joiningSettled(cadet) || !cadet.dob) continue
    enrolledKeys.add(`${cadet.dob}|${String(family.guardian?.email || '').toLowerCase()}`)
  }
}

const archiveList = []
let enrolled = 0
let stillGoing = 0
let futureBooking = 0
let waiting = 0
let recent = 0

for (const doc of snapshot.docs) {
  const family = doc.data()
  for (const cadet of family.cadets || []) {
    if (cadet.status === 'withdrawn') continue
    if (joiningSettled(cadet)) { enrolled += 1; continue }

    const add = (reason, why) => archiveList.push({ ref: doc.ref, family, cadet, reason, why })
    const key = cadet.dob ? `${cadet.dob}|${String(family.guardian?.email || '').toLowerCase()}` : ''

    // Checked before anything else: a second record for a cadet who is already enrolled is
    // a duplicate however new it is, and counting it as a family who decided against us
    // would understate the intake.
    if (key && enrolledKeys.has(key)) { add('duplicate', 'duplicate of an enrolled cadet'); continue }

    // Too young for this intake and deliberately held for a later one. These are future
    // recruits, not people who went quiet: four of them are in Year 6 or 7 and one is the
    // cadet who was turned away at the gate for being too young.
    if (cadet.status === 'future_waiting') { waiting += 1; continue }

    // Too new to have gone anywhere. Two of these enquired in the last five days and one
    // came in this morning, so calling them uncontactable would be nonsense.
    const enquiredAt = family.createdAt ? new Date(family.createdAt) : null
    if (enquiredAt && Date.now() - enquiredAt.getTime() < RECENT_ENQUIRY_DAYS * 24 * 60 * 60 * 1000) { recent += 1; continue }

    const nightDate = String(cadet.openNightId || '').replace('open-night-', '')
    if (nightDate && nightDate >= today) { futureBooking += 1; continue }

    // Anyone who has opened the paperwork is still in play, whatever stage they reached.
    if (cadet.paperworkStatus === 'in_progress' || cadet.paperworkStatus === 'completed') { stillGoing += 1; continue }

    // attendedAt is the only honest test of whether they came. Going on the Open Night
    // date alone labelled six cadets who turned up and were handed a joining code as
    // never having attended.
    if (cadet.attendedAt) add('lapsed_after_open_night', `attended ${String(cadet.attendedAt).slice(0, 10)}, never started the paperwork`)
    else if (nightDate) add('no_show', `booked ${nightDate}, never attended`)
    else add('unable_to_contact', 'never booked an Open Night')
  }
}

console.log(`Enrolled, left alone:              ${enrolled}`)
console.log(`Paperwork under way, left alone:   ${stillGoing}`)
console.log(`Booked on a future night, left alone: ${futureBooking}`)
console.log(`Waiting for a later intake, left alone: ${waiting}`)
console.log(`Enquired in the last ${RECENT_ENQUIRY_DAYS} days, left alone: ${recent}`)
console.log()
const GROUPS = [
  ['no_show', 'Never attended'],
  ['lapsed_after_open_night', 'Attended but never started the paperwork'],
  ['unable_to_contact', 'Never booked an Open Night'],
  ['duplicate', 'Duplicate of a cadet who is already enrolled'],
]
console.log(`To mark as not joined (${archiveList.length} in total):`)
for (const [reason, label] of GROUPS) {
  const group = archiveList.filter((item) => item.reason === reason)
  if (!group.length) continue
  console.log(`  ${label} (${group.length}):`)
  for (const item of group) console.log(`     ${item.cadet.fullName.padEnd(28)} ${item.why}`)
}
console.log()

if (!apply) {
  console.log('Nothing was changed. Re-run with --apply.')
  process.exit(0)
}

await settingsRef.set({
  value: {
    ...keyDates,
    intakeClosedOn: closedOn,
    archivedOpenNights: [...alreadyArchived, ...toArchive].sort(),
  },
  serverUpdatedAt: new Date().toISOString(),
}, { merge: true })
console.log('Settings updated.')

// Grouped by family so each document is written once even with siblings.
const byDoc = new Map()
for (const item of archiveList) {
  if (!byDoc.has(item.ref.path)) byDoc.set(item.ref.path, { ref: item.ref, family: item.family, items: [] })
  byDoc.get(item.ref.path).items.push(item)
}
const now = new Date().toISOString()
for (const { ref, family, items } of byDoc.values()) {
  const ids = new Map(items.map((item) => [item.cadet.id, item.reason]))
  const notes = new Map(items.map((item) => [item.cadet.id, item.why]))
  const cadets = (family.cadets || []).map((cadet) => (ids.has(cadet.id)
    ? {
      ...cadet,
      status: 'withdrawn',
      withdrawnAt: now,
      withdrawalReason: ids.get(cadet.id),
      withdrawalNote: `Archived when the October 2026 enrolment window closed: ${notes.get(cadet.id)}.`,
      withdrawalSource: 'staff',
      openNightAttendanceStatus: 'withdrawn',
    }
    : cadet))
  await ref.update({ cadets, updatedAt: now })
}
console.log(`${archiveList.length} marked as not joined across ${byDoc.size} families. No records deleted and no emails sent.`)
