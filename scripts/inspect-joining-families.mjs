import { readFile } from 'node:fs/promises'
import { cert, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const keyPath = new URL('../.secrets/joining-portal-firebase-admin.json', import.meta.url)
const serviceAccount = JSON.parse(await readFile(keyPath, 'utf8'))
const db = getFirestore(initializeApp({ credential: cert(serviceAccount), projectId: 'sqn-ops' }, `inspect-families-${Date.now()}`))
const snapshot = await db.collection('joiningPortalFamilies').orderBy('createdAt').get()

const families = snapshot.docs.map((document) => {
  const family = document.data()
  return {
    id: document.id,
    createdAt: family.createdAt || null,
    updatedAt: family.updatedAt || null,
    parent: family.guardian?.fullName || '',
    email: family.guardian?.email || '',
    cadets: (family.cadets || []).map((cadet) => ({ id: cadet.id, name: cadet.fullName, status: cadet.status })),
  }
})

console.log(JSON.stringify({ count: families.length, families }, null, 2))
