import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const PROJECT_ID = 'sqn-ops'

function credentials() {
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n')
  if (projectId || clientEmail || privateKey) {
    if (projectId !== PROJECT_ID || !clientEmail || !privateKey) throw new Error('Firebase administrator configuration is incomplete or for the wrong project.')
    return cert({ projectId, clientEmail, privateKey })
  }
  const encoded = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64
  if (encoded) {
    const serviceAccount = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'))
    if (serviceAccount.project_id !== PROJECT_ID) throw new Error('Firebase service account is for the wrong project.')
    return cert(serviceAccount)
  }
  return applicationDefault()
}

export function joiningPortalDb() {
  const app = getApps()[0] || initializeApp({ credential: credentials(), projectId: PROJECT_ID })
  return getFirestore(app)
}

export const joiningPortalCollections = Object.freeze({
  families: 'joiningPortalFamilies',
  deletedFamilies: 'joiningPortalDeletedFamilies',
  openNights: 'joiningPortalOpenNights',
  messages: 'joiningPortalMessages',
  settings: 'joiningPortalSettings',
  rateLimits: 'joiningPortalRateLimits',
  temporaryPaperwork: 'joiningPortalTemporaryPaperwork',
})
