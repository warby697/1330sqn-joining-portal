// Repairs the cadets whose start date was pushed to the next April.
//
// The Open Night on 8 October 2026 fell a week after the 1 October intake, so
// "the next intake" meant April 2027. Every cadet from that night was given a start
// date of 1 April 2027, which went into their joining confirmation email, and for the
// ones who had already set up a Direct Debit it also set their first collection to
// 1 April 2027. The cause is fixed in src/lib/recruitmentStore.js; this fixes the
// records that were already written.
//
// Direct Debits are a separate job: see scripts/reschedule-subscriptions.mjs.
//
// Usage (dry run by default, nothing written):
//   node scripts/repair-start-dates.mjs
//   node scripts/repair-start-dates.mjs --apply
import { readFile } from 'node:fs/promises'
import { cert, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const apply = process.argv.includes('--apply')
const WRONG_START_YEAR = '2027-04'

// Parade nights are Monday and Thursday at 6.30pm.
const PARADE_DAYS = [1, 4]
function nextParadeNight(from) {
  const night = new Date(from.getFullYear(), from.getMonth(), from.getDate(), 18, 30)
  if (night <= from) night.setDate(night.getDate() + 1)
  while (!PARADE_DAYS.includes(night.getDay())) night.setDate(night.getDate() + 1)
  return night
}

const keyPath = new URL('../.secrets/joining-portal-firebase-admin.json', import.meta.url)
const db = getFirestore(initializeApp({ credential: cert(JSON.parse(await readFile(keyPath, 'utf8'))), projectId: 'sqn-ops' }, `repair-${Date.now()}`))

const correctStart = nextParadeNight(new Date())
const longDate = (date) => date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
console.log(apply ? `APPLYING. New start date: ${longDate(correctStart)}` : `DRY RUN. New start date would be: ${longDate(correctStart)}`)
console.log()

const snapshot = await db.collection('joiningPortalFamilies').get()
let changed = 0
let families = 0
for (const doc of snapshot.docs) {
  const family = doc.data()
  const cadets = family.cadets || []
  const wrong = cadets.filter((cadet) => String(cadet.intendedStartDate || '').startsWith(WRONG_START_YEAR))
  if (!wrong.length) continue
  families += 1
  for (const cadet of wrong) {
    changed += 1
    const paid = cadet.payments?.subs?.status === 'active' ? 'Direct Debit live' : 'no Direct Debit yet'
    console.log(`${cadet.fullName.padEnd(28)} ${String(cadet.paperworkStatus || '-').padEnd(12)} ${paid}`)
  }
  if (!apply) continue
  const updated = cadets.map((cadet) => (
    String(cadet.intendedStartDate || '').startsWith(WRONG_START_YEAR)
      ? { ...cadet, intendedStartDate: correctStart.toISOString(), eligibleIntakeDate: correctStart.toISOString() }
      : cadet
  ))
  // Only the two date fields are touched, so a parent part way through the paperwork
  // does not have anything else of theirs overwritten.
  await doc.ref.update({ cadets: updated, updatedAt: new Date().toISOString() })
}

console.log()
console.log(`${changed} cadets across ${families} families${apply ? ' updated' : ' would be updated'}.`)
if (!apply) console.log('Nothing was written. Re-run with --apply.')
process.exit(0)
