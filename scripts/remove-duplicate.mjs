// Remove duplicate joining-portal applications WITHOUT sending any email.
//
// The app's "withdraw/delete" button emails the parent a withdrawal
// confirmation before deleting. This script talks straight to Firestore with
// the admin key, so it deletes the record silently - no parent email, ever.
//
// It mirrors the app's own delete-family behaviour: it removes the family doc
// and writes a tombstone into joiningPortalDeletedFamilies so a stale browser
// session cannot resurrect the record (same as the delete-family function).
//
// USAGE (from Apps/joining-portal):
//   node scripts/remove-duplicate.mjs                      # list + flag likely duplicates (read only)
//   node scripts/remove-duplicate.mjs --family <id>        # DRY RUN: show what removing that family would do
//   node scripts/remove-duplicate.mjs --family <id> --apply
//   node scripts/remove-duplicate.mjs --family <id> --cadet <id>          # DRY RUN: remove one cadet only
//   node scripts/remove-duplicate.mjs --family <id> --cadet <id> --apply
//
// Nothing is written unless --apply is passed.

import { readFile } from 'node:fs/promises'
import { cert, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const FAMILIES = 'joiningPortalFamilies'
const DELETED = 'joiningPortalDeletedFamilies'

const args = process.argv.slice(2)
const flag = (name) => {
  const i = args.indexOf(`--${name}`)
  return i === -1 ? undefined : (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true)
}
const familyId = flag('family')
const cadetId = flag('cadet')
const apply = args.includes('--apply')

const keyPath = new URL('../.secrets/joining-portal-firebase-admin.json', import.meta.url)
const serviceAccount = JSON.parse(await readFile(keyPath, 'utf8'))
const db = getFirestore(initializeApp({ credential: cert(serviceAccount), projectId: 'sqn-ops' }, `remove-dup-${Date.now()}`))

const load = async () => {
  const snapshot = await db.collection(FAMILIES).orderBy('createdAt').get()
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
}

const describe = (family) => ({
  id: family.id,
  createdAt: family.createdAt || null,
  parent: family.guardian?.fullName || '',
  email: family.guardian?.email || '',
  cadets: (family.cadets || []).map((c) => ({ id: c.id, name: c.fullName, dob: c.dateOfBirth || null, status: c.status })),
})

// ---- LIST MODE: no --family given -> show everything and flag likely dupes ----
if (!familyId) {
  const families = await load()
  console.log(JSON.stringify({ count: families.length, families: families.map(describe) }, null, 2))

  const byEmail = new Map()
  const byCadet = new Map()
  for (const f of families) {
    const email = (f.guardian?.email || '').trim().toLowerCase()
    if (email) byEmail.set(email, [...(byEmail.get(email) || []), f.id])
    for (const c of f.cadets || []) {
      const key = `${(c.fullName || '').trim().toLowerCase()}|${c.dateOfBirth || ''}`
      if (key.trim() !== '|') byCadet.set(key, [...(byCadet.get(key) || []), { familyId: f.id, cadetId: c.id }])
    }
  }
  const dupeEmails = [...byEmail].filter(([, ids]) => ids.length > 1)
  const dupeCadets = [...byCadet].filter(([, hits]) => hits.length > 1)

  console.log('\n--- POSSIBLE DUPLICATES ---')
  if (!dupeEmails.length && !dupeCadets.length) console.log('None found by guardian email or cadet name+DOB.')
  for (const [email, ids] of dupeEmails) console.log(`Same guardian email ${email}: families ${ids.join(', ')}`)
  for (const [key, hits] of dupeCadets) console.log(`Same cadet ${key}: ${hits.map((h) => `${h.familyId}/${h.cadetId}`).join(', ')}`)
  console.log('\nTo remove one, re-run with --family <id> (add --cadet <id> to remove a single cadet). No email is sent. Add --apply to commit.')
  process.exit(0)
}

// ---- REMOVE MODE ----
const ref = db.collection(FAMILIES).doc(String(familyId))
const snap = await ref.get()
if (!snap.exists) {
  console.error(`Family ${familyId} not found (already removed?).`)
  process.exit(1)
}
const family = { id: snap.id, ...snap.data() }
console.log('Target family:', JSON.stringify(describe(family), null, 2))

const removeWholeFamily = async () => {
  console.log(`\nWould delete family ${familyId} entirely and write a tombstone to ${DELETED}. No email sent.`)
  if (!apply) return console.log('DRY RUN - nothing written. Re-run with --apply to commit.')
  const batch = db.batch()
  batch.delete(ref)
  batch.set(db.collection(DELETED).doc(String(familyId)), {
    deletedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
  })
  await batch.commit()
  console.log('Done. Family removed, no email sent.')
}

if (!cadetId) {
  await removeWholeFamily()
  process.exit(0)
}

// Single-cadet removal
const cadets = family.cadets || []
if (!cadets.some((c) => c.id === cadetId)) {
  console.error(`Cadet ${cadetId} not found in family ${familyId}. Cadets: ${cadets.map((c) => c.id).join(', ') || '(none)'}`)
  process.exit(1)
}
const remaining = cadets.filter((c) => c.id !== cadetId)

if (!remaining.length) {
  console.log('\nThat is the only cadet in the family, so the whole family will be removed.')
  await removeWholeFamily()
  process.exit(0)
}

console.log(`\nWould remove cadet ${cadetId} and keep ${remaining.length} other cadet(s). Family stays. No email sent.`)
if (!apply) {
  console.log('DRY RUN - nothing written. Re-run with --apply to commit.')
  process.exit(0)
}
await ref.update({ cadets: remaining, updatedAt: new Date().toISOString() })
console.log('Done. Cadet removed, no email sent.')
process.exit(0)
