import { readFile } from 'node:fs/promises'
import { cert, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

if (!process.argv.includes('--apply')) throw new Error('Refusing to delete data without --apply.')

const keyPath = new URL('../.secrets/joining-portal-firebase-admin.json', import.meta.url)
const serviceAccount = JSON.parse(await readFile(keyPath, 'utf8'))
if (serviceAccount.project_id !== 'sqn-ops') throw new Error('The service account belongs to the wrong Firebase project.')

const db = getFirestore(initializeApp({ credential: cert(serviceAccount), projectId: 'sqn-ops' }))
const collections = [
  'joiningPortalFamilies',
  'joiningPortalMessages',
  'joiningPortalTemporaryPaperwork',
]

for (const collectionName of collections) {
  let removed = 0
  while (true) {
    const snapshot = await db.collection(collectionName).limit(400).get()
    if (snapshot.empty) break
    const batch = db.batch()
    snapshot.docs.forEach((document) => batch.delete(document.ref))
    await batch.commit()
    removed += snapshot.size
  }
  console.log(`${collectionName}: removed ${removed}`)
}

const settings = await db.collection('joiningPortalSettings').get()
console.log(`joiningPortalSettings: preserved ${settings.size}`)
const deletedFamilies = await db.collection('joiningPortalDeletedFamilies').get()
console.log(`joiningPortalDeletedFamilies: preserved ${deletedFamilies.size}`)
const openNights = await db.collection('joiningPortalOpenNights').get()
console.log(`joiningPortalOpenNights: preserved ${openNights.size}`)
