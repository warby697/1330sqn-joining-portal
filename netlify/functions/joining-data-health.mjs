import { joiningPortalCollections, joiningPortalDb } from './_firebase-admin.mjs'

export default async (request) => {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 })
  const { pin } = await request.json().catch(() => ({}))
  const expectedPin = process.env.STAFF_PIN
  if (!expectedPin) return Response.json({ error: 'Not authorised.' }, { status: 401 })
  if (String(pin || '') !== expectedPin) return Response.json({ error: 'Not authorised.' }, { status: 401 })

  try {
    const db = joiningPortalDb()
    await db.collection(joiningPortalCollections.settings).doc('connection').set({
      projectId: 'sqn-ops',
      checkedAt: new Date().toISOString(),
      application: '1330 joining portal',
    }, { merge: true })
    return Response.json({ connected: true, projectId: 'sqn-ops', emailConfigured: Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM), paymentConfigured: Boolean(process.env.GOCARDLESS_ACCESS_TOKEN) })
  } catch (error) {
    console.error('Joining portal Firestore connection failed:', error)
    return Response.json({ connected: false, error: 'Firestore is not configured for this environment.' }, { status: 503 })
  }
}
