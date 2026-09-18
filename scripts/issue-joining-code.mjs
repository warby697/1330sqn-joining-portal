// Marks a cadet as having attended an Open Night and sends the parent their joining
// code, exactly as the staff "Wants to proceed" button does. For finishing off anyone
// left on "arrived" after the night.
//
//   node scripts/issue-joining-code.mjs --cadet <cadetId> [--cadet <cadetId> ...] [--apply]
import { readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { cert, initializeApp } from 'firebase-admin/app'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'

const wanted = process.argv.reduce((acc, v, i) => (v === '--cadet' ? [...acc, process.argv[i + 1]] : acc), [])
const apply = process.argv.includes('--apply')
if (!wanted.length) { console.error('Usage: node scripts/issue-joining-code.mjs --cadet <id> [--apply]'); process.exit(1) }

const APP_URL = 'https://1330sqn-joining-portal.netlify.app'
const keyPath = new URL('../.secrets/joining-portal-firebase-admin.json', import.meta.url)
const db = getFirestore(initializeApp({ credential: cert(JSON.parse(await readFile(keyPath, 'utf8'))), projectId: 'sqn-ops' }, `code-${Date.now()}`))
const settings = db.collection('joiningPortalSettings')
const kd = (await settings.doc('keyDates').get()).get('value')
const templates = (await settings.doc('emailTemplates').get()).get('value') || []
const template = templates.find((t) => t.id === 'joining_code')

// Same intake rule as the portal: first parade night (Mon/Thu) on or after an intake date.
const firstParade = (d) => { const r = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 18, 30); while (![1, 4].includes(r.getDay())) r.setDate(r.getDate() + 1); return r }
const nextIntake = (from) => { for (let y = from.getFullYear(); y <= from.getFullYear() + 3; y++) for (const v of kd.intakeDates) { const [m, d] = v.split('-').map(Number); const i = firstParade(new Date(y, m - 1, d)); if (i >= from) return i } }
const longDate = (d) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
const fill = (text, v) => String(text || '').replace(/{{(\w+)}}/g, (_, k) => v[k] ?? '')

const snap = await db.collection('joiningPortalFamilies').get()
for (const cadetId of wanted) {
  const doc = snap.docs.find((d) => (d.data().cadets || []).some((c) => c.id === cadetId))
  if (!doc) { console.error(`${cadetId}: not found`); continue }
  const f = doc.data()
  const cadet = f.cadets.find((c) => c.id === cadetId)
  if (cadet.attendedAt) { console.log(`${cadet.fullName}: already attended, skipping`); continue }

  const now = new Date()
  const nightDate = new Date(`${cadet.openNightId.replace('open-night-', '')}T${kd.openNightStart || '19:15'}:00`)
  const code = Array.from({ length: 4 }, () => Math.floor(Math.random() * 10)).join('')
  const expiresAt = new Date(now.getTime() + (kd.joiningCodeDays || 30) * 864e5)
  const intake = nextIntake(nightDate)
  console.log(`${cadet.fullName}: code ${code}, expires ${longDate(expiresAt)}, start ${intake.toDateString()} -> ${f.guardian.email}`)
  if (!apply) continue

  await db.runTransaction(async (t) => {
    const cur = await t.get(doc.ref)
    const cadets = (cur.get('cadets') || []).map((c) => (c.id !== cadetId || c.attendedAt ? c : {
      ...c,
      attendedAt: now.toISOString(),
      openNightAttendanceStatus: 'approved',
      status: 'paperwork_available',
      paperworkStatus: 'available',
      joiningCode: code,
      joiningCodeExpiresAt: expiresAt.toISOString(),
      intendedStartDate: intake.toISOString(),
    }))
    t.update(doc.ref, { cadets, updatedAt: now.toISOString(), serverUpdatedAt: FieldValue.serverTimestamp() })
  })

  const values = { parentName: f.guardian.fullName, cadetName: cadet.fullName, joiningCode: code, codeExpiry: longDate(expiresAt) }
  let status = 'failed'
  let result = {}
  try {
    const res = await fetch(`${APP_URL}/.netlify/functions/send-joining-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: f.guardian.email, cadetName: cadet.fullName, code, expiresAt: expiresAt.toISOString(), portalUrl: `${APP_URL}/#/join`,
        template: template ? { subject: fill(template.subject, values), body: fill(template.body, values) } : null,
      }),
    })
    result = await res.json().catch(() => ({}))
    if (res.ok && result.sent) status = 'sent'
    else console.error(`   email failed: ${result.error || res.status}`)
  } catch (error) { console.error(`   email failed: ${error.message}`) }

  await doc.ref.update({
    _messages: FieldValue.arrayUnion({
      id: `message-${randomUUID()}`, familyId: doc.id, cadetId, kind: 'paperwork_unlocked', templateId: 'joining_code',
      createdAt: now.toISOString(), status, to: f.guardian.email, subject: result.subject || fill(template?.subject, values),
      body: result.body || '', code, expiresAt: expiresAt.toISOString(), providerMessageId: result.providerMessageId || null,
    }),
  })
  console.log(`   ${status === 'sent' ? 'attended + code emailed' : 'attended, EMAIL FAILED'}`)
}
if (!apply) console.log('\nDRY RUN - nothing written or sent. Re-run with --apply.')
process.exit(0)
