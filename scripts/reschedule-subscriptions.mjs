// Moves a first Direct Debit collection off 1 April 2027 and onto 1 November 2026.
//
// The Open Night on 8 October 2026 fell a week after the 1 October intake, so the cadets
// from it were given a start date of the following April and their subscriptions were
// created to collect from 1 April 2027. The cause is fixed in subscriptionSchedule.js;
// this moves the mandates that were already set up.
//
// GoCardless will not change the start date of an existing subscription, so each one is
// replaced: the new subscription is created on the same mandate first, and only then is
// the old one cancelled. That order means a failure part way through leaves the cadet
// with a working Direct Debit rather than none. The mandate itself is untouched, so there
// is nothing for the parent to re-authorise and no new email to them.
//
// The access token is a Netlify secret and cannot be read back, so pass it in:
//   GOCARDLESS_ACCESS_TOKEN=live_xxx node scripts/reschedule-subscriptions.mjs
//   GOCARDLESS_ACCESS_TOKEN=live_xxx node scripts/reschedule-subscriptions.mjs --apply
//
// Do one first and check it in the GoCardless dashboard, then run the rest:
//   GOCARDLESS_ACCESS_TOKEN=live_xxx node scripts/reschedule-subscriptions.mjs --cadet "Jenna Dawson" --apply
import { readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { cert, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const apply = process.argv.includes('--apply')
const only = (() => {
  const index = process.argv.indexOf('--cadet')
  return index === -1 ? '' : (process.argv[index + 1] || '').toLowerCase()
})()

// Only subscriptions sitting on this exact date are touched, so the script is safe to
// re-run and cannot disturb anyone who is already paying.
const WRONG_COLLECTION = '2027-04-01'
const NEW_COLLECTION = '2026-11-01'

const TOKEN = process.env.GOCARDLESS_ACCESS_TOKEN
if (!TOKEN) {
  console.error('Set GOCARDLESS_ACCESS_TOKEN. It is stored as a Netlify secret, which cannot be read back, so it has to be passed in.')
  process.exit(1)
}

const GC_API = process.env.GOCARDLESS_API || 'https://api.gocardless.com'
const gcHeaders = (idempotencyKey) => ({
  Authorization: `Bearer ${TOKEN}`,
  'GoCardless-Version': '2015-07-06',
  'Content-Type': 'application/json',
  Accept: 'application/json',
  ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
})

async function gc(path, options = {}) {
  const response = await fetch(`${GC_API}${path}`, options)
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error?.message || `HTTP ${response.status} on ${path}`)
  return body
}

const keyPath = new URL('../.secrets/joining-portal-firebase-admin.json', import.meta.url)
const db = getFirestore(initializeApp({ credential: cert(JSON.parse(await readFile(keyPath, 'utf8'))), projectId: 'sqn-ops' }, `resched-${Date.now()}`))

console.log(apply
  ? `APPLYING: moving first collections from ${WRONG_COLLECTION} to ${NEW_COLLECTION}`
  : `DRY RUN: would move first collections from ${WRONG_COLLECTION} to ${NEW_COLLECTION}`)
console.log()

const snapshot = await db.collection('joiningPortalFamilies').get()
const moved = []
const skipped = []
const failed = []
const noMandate = []

for (const doc of snapshot.docs) {
  const family = doc.data()
  for (const cadet of family.cadets || []) {
    if (only && cadet.fullName.toLowerCase() !== only) continue
    const subs = cadet.payments?.subs
    const feePaid = cadet.payments?.fee?.status === 'paid'

    // Joining fee paid but no mandate at all. There is nothing to reschedule: the parent
    // has to set the Direct Debit up, so this is reported for chasing instead.
    if (feePaid && !subs?.subscriptionId) {
      noMandate.push(`${cadet.fullName} (${family.guardian?.email || 'no email on file'})`)
      continue
    }
    if (!subs?.subscriptionId || !subs?.mandateId) continue

    let existing
    try {
      existing = (await gc(`/subscriptions/${subs.subscriptionId}`, { headers: gcHeaders() })).subscriptions
    } catch (error) {
      failed.push(`${cadet.fullName}: could not read the subscription (${error.message})`)
      continue
    }

    if (existing.start_date !== WRONG_COLLECTION) {
      skipped.push(`${cadet.fullName}: already collecting from ${existing.start_date || 'the earliest available date'}`)
      continue
    }
    if (existing.status !== 'active' && existing.status !== 'pending_customer_approval') {
      skipped.push(`${cadet.fullName}: subscription is ${existing.status}`)
      continue
    }

    if (!apply) {
      moved.push(`${cadet.fullName}: ${existing.start_date} to ${NEW_COLLECTION}, ${(existing.amount / 100).toFixed(2)} a month`)
      continue
    }

    try {
      // Create the replacement first. Same mandate, same amount, same reference, so the
      // parent sees nothing change except the date the money leaves.
      const created = await gc('/subscriptions', {
        method: 'POST',
        headers: gcHeaders(`resched-${cadet.id}`),
        body: JSON.stringify({
          subscriptions: {
            amount: existing.amount,
            currency: existing.currency || 'GBP',
            interval: existing.interval || 1,
            interval_unit: existing.interval_unit || 'monthly',
            name: existing.name,
            metadata: existing.metadata || {},
            start_date: NEW_COLLECTION,
            links: { mandate: subs.mandateId },
          },
        }),
      })
      const replacement = created.subscriptions

      // Only now stand the old one down.
      await gc(`/subscriptions/${subs.subscriptionId}/actions/cancel`, {
        method: 'POST',
        headers: gcHeaders(`cancel-${cadet.id}-${randomUUID()}`),
        body: JSON.stringify({ data: {} }),
      })

      // Point the record at the subscription that is now the live one.
      const cadets = (family.cadets || []).map((item) => (item.id === cadet.id
        ? {
          ...item,
          payments: {
            ...item.payments,
            subs: {
              ...item.payments.subs,
              subscriptionId: replacement.id,
              rescheduledFrom: subs.subscriptionId,
              firstCollection: NEW_COLLECTION,
            },
          },
        }
        : item))
      await doc.ref.update({ cadets, updatedAt: new Date().toISOString() })

      moved.push(`${cadet.fullName}: collecting from ${NEW_COLLECTION}, ${replacement.id}`)
    } catch (error) {
      // Unless the cancel itself is what failed, the old subscription is still in place,
      // so nobody is left without a Direct Debit.
      failed.push(`${cadet.fullName}: ${error.message}`)
    }
  }
}

const report = (title, list) => {
  if (!list.length) return
  console.log(title)
  for (const line of list) console.log('  ' + line)
  console.log()
}
report(apply ? 'Moved:' : 'Would move:', moved)
report('Left alone:', skipped)
report('Joining fee paid but no Direct Debit set up at all:', noMandate)
report('FAILED, needs looking at:', failed)

console.log(`${moved.length} ${apply ? 'moved' : 'to move'}, ${skipped.length} left alone, ${failed.length} failed.`)
if (!apply) console.log('Nothing was changed. Re-run with --apply.')
process.exit(failed.length ? 1 : 0)
