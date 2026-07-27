import { readFile } from 'node:fs/promises'
import { cert, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const familyId = process.argv[2]
if (!familyId) throw new Error('Family ID is required.')

const keyPath = new URL('../.secrets/joining-portal-firebase-admin.json', import.meta.url)
const serviceAccount = JSON.parse(await readFile(keyPath, 'utf8'))
const db = getFirestore(initializeApp({ credential: cert(serviceAccount), projectId: 'sqn-ops' }, `inspect-${Date.now()}`))
const [family, deletion] = await Promise.all([
  db.collection('joiningPortalFamilies').doc(familyId).get(),
  db.collection('joiningPortalDeletedFamilies').doc(familyId).get(),
])

console.log(JSON.stringify({
  familyExists: family.exists,
  deletionMarkerExists: deletion.exists,
  deletion: deletion.exists ? deletion.data() : null,
}))
