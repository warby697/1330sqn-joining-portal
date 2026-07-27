import { readFile } from 'node:fs/promises'
import { cert, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

if (!process.argv.includes('--apply')) throw new Error('Refusing to delete records without --apply.')

const duplicateIds = [
  'family-ms28hgrd-sjpf1',
  'family-ms28hita-tjy5m',
  'family-ms28hj6w-34kcg',
]
const keepId = 'family-ms28hfma-yoq0t'
const keyPath = new URL('../.secrets/joining-portal-firebase-admin.json', import.meta.url)
const serviceAccount = JSON.parse(await readFile(keyPath, 'utf8'))
const db = getFirestore(initializeApp({ credential: cert(serviceAccount), projectId: 'sqn-ops' }, `remove-duplicates-${Date.now()}`))

const keep = await db.collection('joiningPortalFamilies').doc(keepId).get()
const keepData = keep.exists ? keep.data() : null
if (!keepData || keepData.cadets?.[0]?.status !== 'ready_to_start') throw new Error('The completed David James record was not found. Nothing was deleted.')

for (const familyId of duplicateIds) {
  const reference = db.collection('joiningPortalFamilies').doc(familyId)
  const document = await reference.get()
  if (!document.exists) continue
  const data = document.data()
  const cadets = data.cadets || []
  if (data.guardian?.email !== 'warby697@gmail.com' || cadets.length !== 1 || cadets[0]?.fullName !== 'David James' || cadets[0]?.status !== 'awaiting_parent') {
    throw new Error(`Refusing to delete unexpected record ${familyId}.`)
  }
  const batch = db.batch()
  batch.delete(reference)
  batch.set(db.collection('joiningPortalDeletedFamilies').doc(familyId), {
    deletedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
    reason: 'duplicate_registration',
  })
  await batch.commit()
  console.log(`Removed duplicate ${familyId}`)
}

console.log(`Preserved completed record ${keepId}`)
