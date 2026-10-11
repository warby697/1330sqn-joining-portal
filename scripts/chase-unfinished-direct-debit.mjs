// Writes to any parent who paid the joining fee but never finished setting up the
// monthly Direct Debit, with a one-click link back to the step they stopped on.
//
// The point is to ask nothing of them beyond one tap. No joining code to find in an old
// email, no retyping the Form 3822: a fresh access token goes on the family record and the
// link opens their own paperwork, which the resume logic drops back on the Direct Debit
// step with every answer still filled in.
//
// Issuing the token replaces any earlier one for that family, so an older return link in
// their inbox stops working. That is the same behaviour as asking for a return link from
// the portal.
//
// Usage (dry run by default, prints the email and sends nothing):
//   node scripts/chase-unfinished-direct-debit.mjs
//   node scripts/chase-unfinished-direct-debit.mjs --apply
import { readFile } from 'node:fs/promises'
import { randomBytes, createHash } from 'node:crypto'
import { cert, initializeApp } from 'firebase-admin/app'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'

const apply = process.argv.includes('--apply')
const APP_URL = 'https://1330sqn-joining-portal.netlify.app'

// Matches joining-data.mjs, so the link validates the same way the portal's own does.
const newToken = () => randomBytes(24).toString('hex')
const hash = (value) => createHash('sha256').update(String(value)).digest('hex')

const SUBJECT = 'One step left for {{cadetName}}'
const BODY = [
  'Dear {{parentName}},',
  "{{cadetName}}'s joining paperwork is almost complete. The Form 3822 is done and the £30.00 joining fee is paid. The only thing still outstanding is the monthly Direct Debit.",
  'The button below opens your own paperwork at that step. Everything you have already filled in is still there, so there is nothing to type again and no code to find. It takes about two minutes.',
  'The subscription is £18.50 a month. Your first payment would be collected on Monday 2 November and then on the 1st of each month.',
  '{{cadetName}} is very welcome on parade in the meantime, on Mondays and Thursdays at 6.30pm. We would just like this finished so their place is formally confirmed.',
  'If you would rather sort it out in person, or if anything is giving you trouble, please reply to this email or speak to a member of staff on a parade night and we will help.',
  'Yours sincerely,\n\n1330 (Warrington) Squadron',
].join('\n\n')

const keyPath = new URL('../.secrets/joining-portal-firebase-admin.json', import.meta.url)
const db = getFirestore(initializeApp({ credential: cert(JSON.parse(await readFile(keyPath, 'utf8'))), projectId: 'sqn-ops' }, `chase-${Date.now()}`))

const snapshot = await db.collection('joiningPortalFamilies').get()
const targets = []
for (const doc of snapshot.docs) {
  const family = doc.data()
  for (const cadet of family.cadets || []) {
    if (cadet.payments?.fee?.status !== 'paid') continue
    if (cadet.payments?.subs?.status === 'active') continue
    if (cadet.directDebitChaseSentAt) continue
    targets.push({ ref: doc.ref, familyId: doc.id, family, cadet })
  }
}

console.log(apply ? `APPLYING: writing to ${targets.length} parents` : `DRY RUN: would write to ${targets.length} parents`)
console.log()

for (const item of targets) {
  // First name only. Parents type their own name into the form and the capitalisation is
  // whatever they typed, so greeting them by the full name risks "Dear Rachel crookes".
  const firstName = String(item.family.guardian?.fullName || "").trim().split(" ")[0]
  const values = {
    parentName: firstName ? firstName[0].toUpperCase() + firstName.slice(1) : 'Parent or guardian',
    cadetName: item.cadet.fullName,
  }
  const fill = (text) => String(text).replace(/{{([a-zA-Z]+)}}/g, (_, key) => values[key] ?? '')
  const answers = Object.keys(item.cadet.paperworkProgress?.formData || {}).length

  if (!apply) {
    console.log('To:      ' + (item.family.guardian?.email || 'NO EMAIL ON FILE'))
    console.log('Subject: ' + fill(SUBJECT))
    console.log(`Resumes at: ${item.cadet.paperworkProgress?.stage || 'unknown'} step, ${answers} answers already saved`)
    console.log()
    console.log(fill(BODY))
    console.log()
    continue
  }

  const to = item.family.guardian?.email
  if (!to) {
    console.log(`FAILED ${item.cadet.fullName}: no email on file`)
    continue
  }
  try {
    // A fresh token, so the link opens their record without a joining code.
    const token = newToken()
    await item.ref.update({ accessToken: token, accessTokenHash: hash(token), serverUpdatedAt: FieldValue.serverTimestamp() })
    const portalUrl = `${APP_URL}/#/join/${item.familyId}/${item.cadet.id}/${token}`

    const response = await fetch(`${APP_URL}/.netlify/functions/send-direct-joining-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to,
        cadetName: item.cadet.fullName,
        portalUrl,
        heading: 'One step left',
        ctaLabel: 'Finish the Direct Debit',
        template: { subject: fill(SUBJECT), body: fill(BODY) },
      }),
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`)

    const cadets = (item.family.cadets || []).map((cadet) => (cadet.id === item.cadet.id
      ? { ...cadet, directDebitChaseSentAt: new Date().toISOString() }
      : cadet))
    await item.ref.update({ cadets, updatedAt: new Date().toISOString() })
    console.log(`Sent ${item.cadet.fullName} (${to})`)
  } catch (error) {
    console.log(`FAILED ${item.cadet.fullName} (${to}): ${error.message}`)
  }
}

console.log()
if (!apply) console.log('Nothing was sent and no link was issued. Re-run with --apply.')
