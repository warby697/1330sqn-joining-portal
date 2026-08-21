// One-off repair for the Bradley twins, 21 Aug 2026.
//
// Two things to put right before the parent opens her link again:
//   1. Laura is finished and her form has already gone out six times. Stamp
//      joiningFormSentAt so the new once-per-cadet guard treats her as sent and
//      a seventh copy is never produced.
//   2. Jennifer's paperworkProgress is a copy of Laura's form, written by the
//      sibling remount bug. Clear it so Jennifer's form starts clean. Her parent
//      details still carry across from Laura at runtime, which is intended.
//
// Read-only unless --apply is passed.
import { readFile } from 'node:fs/promises'
import { cert, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const apply = process.argv.includes('--apply')
const FAMILY_ID = 'family-mt1sdrt0-1754c'
const keyPath = new URL('../.secrets/joining-portal-firebase-admin.json', import.meta.url)
const db = getFirestore(initializeApp({ credential: cert(JSON.parse(await readFile(keyPath, 'utf8'))), projectId: 'sqn-ops' }, `repair-${Date.now()}`))
const ref = db.collection('joiningPortalFamilies').doc(FAMILY_ID)

const snap = await ref.get()
if (!snap.exists) throw new Error('family not found')
const cadets = snap.get('cadets') || []

const planned = []
const next = cadets.map((cadet) => {
  const updated = { ...cadet }
  if (cadet.paperworkStatus === 'completed' && !cadet.joiningFormSentAt) {
    updated.joiningFormSentAt = cadet.paperworkCompletedAt || new Date().toISOString()
    planned.push(`${cadet.fullName}: stamp joiningFormSentAt = ${updated.joiningFormSentAt} (stops a 7th copy)`)
  }
  const owner = cadet.paperworkProgress?.formData?.['meta.cadetId']
  const wrongOwner = owner && owner !== cadet.id
  const wrongName = cadet.paperworkProgress?.formData?.['cadet.fullName']
  if (cadet.paperworkStatus !== 'completed' && (wrongOwner || (wrongName && wrongName !== cadet.fullName))) {
    delete updated.paperworkProgress
    planned.push(`${cadet.fullName}: clear paperworkProgress (it holds "${wrongName}", not ${cadet.fullName})`)
  }
  return updated
})

console.log(`Family ${FAMILY_ID}`)
if (!planned.length) console.log('Nothing to change.')
for (const line of planned) console.log(' -', line)

if (!apply) {
  console.log('\nDRY RUN - nothing written. Re-run with --apply to commit.')
  process.exit(0)
}
await ref.update({ cadets: next })
console.log('\nApplied.')
process.exit(0)
