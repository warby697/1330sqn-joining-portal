// Read only. For every cadet with a GoCardless subscription, asks GoCardless itself
// when the first payment is actually due. Run it with the token injected, never printed:
//   npx netlify dev:exec node scripts/audit-subscription-dates.mjs
import { readFile } from 'node:fs/promises'
import { cert, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const TOKEN = process.env.GOCARDLESS_ACCESS_TOKEN
if (!TOKEN) {
  console.error('No GOCARDLESS_ACCESS_TOKEN in the environment. Run this through: npx netlify dev:exec node scripts/audit-subscription-dates.mjs')
  process.exit(1)
}
const GC_API = process.env.GOCARDLESS_API || 'https://api.gocardless.com'
const headers = { Authorization: `Bearer ${TOKEN}`, 'GoCardless-Version': '2015-07-06', Accept: 'application/json' }

const keyPath = new URL('../.secrets/joining-portal-firebase-admin.json', import.meta.url)
const serviceAccount = JSON.parse(await readFile(keyPath, 'utf8'))
const db = getFirestore(initializeApp({ credential: cert(serviceAccount), projectId: 'sqn-ops' }, `audit-${Date.now()}`))
const snapshot = await db.collection('joiningPortalFamilies').get()

const rows = []
for (const doc of snapshot.docs) {
  const family = doc.data()
  for (const cadet of family.cadets || []) {
    const subs = cadet.payments?.subs
    if (!subs && !cadet.payments?.fee) continue
    rows.push({
      family: doc.id,
      cadetId: cadet.id,
      parent: family.guardian?.fullName || '',
      email: family.guardian?.email || '',
      cadet: cadet.fullName,
      recordStart: String(cadet.intendedStartDate || '').slice(0, 10),
      feeStatus: cadet.payments?.fee?.status || '',
      subsStatus: subs?.status || '',
      subscriptionId: subs?.subscriptionId || '',
      mandateId: subs?.mandateId || '',
      billingRequestId: subs?.billingRequestId || '',
      updatedAt: String(family.updatedAt || '').slice(0, 10),
    })
  }
}

for (const row of rows) {
  if (!row.subscriptionId) continue
  const res = await fetch(`${GC_API}/subscriptions/${row.subscriptionId}`, { headers })
  const body = await res.json()
  if (!res.ok) {
    row.gc = { error: body.error?.message || `HTTP ${res.status}` }
    continue
  }
  const sub = body.subscriptions
  row.gc = {
    status: sub.status,
    amount: sub.amount,
    startDate: sub.start_date,
    dayOfMonth: sub.day_of_month,
    nextCharge: sub.upcoming_payments?.[0]?.charge_date || null,
    reference: sub.metadata?.reference || '',
    mandate: sub.links?.mandate || '',
  }
}

rows.sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))
await (await import('node:fs/promises')).writeFile(process.argv[2] || 'audit.json', JSON.stringify(rows, null, 1))
for (const row of rows) {
  console.log([
    row.updatedAt,
    row.cadet.padEnd(26),
    ('rec:' + (row.recordStart || '-')).padEnd(15),
    ('gc:' + (row.gc?.startDate || '-')).padEnd(14),
    'next:' + (row.gc?.nextCharge || '-'),
    row.gc?.status || (row.subscriptionId ? '?' : 'NO SUBSCRIPTION'),
    row.gc?.error ? 'ERROR ' + row.gc.error : '',
  ].join('  '))
}
console.log('\nTOTAL', rows.length)
