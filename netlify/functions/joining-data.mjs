import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { FieldValue } from 'firebase-admin/firestore'
import { joiningPortalCollections, joiningPortalDb } from './_firebase-admin.mjs'
import { renderEmail, bodyToParagraphs } from './_email-layout.mjs'

const json = (body, status = 200) => Response.json(body, { status })
const hash = (value) => createHash('sha256').update(String(value || '')).digest('hex')
const same = (left, right) => {
  const a = Buffer.from(String(left || ''))
  const b = Buffer.from(String(right || ''))
  return a.length === b.length && timingSafeEqual(a, b)
}
const staffAttempts = new Map()
const staffAllowed = async (pin, db, request) => {
  const address = clientAddress(request)
  const now = Date.now()
  const attempt = staffAttempts.get(address)
  if (attempt?.lockedUntil > now) return false
  const security = await db.collection(joiningPortalCollections.settings).doc('security').get()
  const expectedHash = security.exists ? security.get('pinHash') : hash(process.env.STAFF_PIN || '1918')
  const allowed = same(hash(pin), expectedHash)
  if (allowed) {
    staffAttempts.delete(address)
    return true
  }
  const count = attempt && now - attempt.startedAt < 15 * 60 * 1000 ? attempt.count + 1 : 1
  staffAttempts.set(address, { count, startedAt: count === 1 ? now : attempt.startedAt, lockedUntil: count >= 8 ? now + 15 * 60 * 1000 : 0 })
  return false
}
const cleanFamily = (family) => {
  const value = structuredClone(family || {})
  delete value.portalToken
  delete value._portalToken
  return value
}
const newToken = () => randomBytes(24).toString('hex')
const normalEmail = (value) => String(value || '').trim().toLowerCase()
const clientAddress = (request) => String(request.headers.get('x-nf-client-connection-ip') || request.headers.get('x-forwarded-for') || 'unknown').split(',')[0].trim()

async function consumeRateLimit(db, request, bucket, maximum, windowMs) {
  const ref = db.collection(joiningPortalCollections.rateLimits).doc(hash(`${bucket}:${clientAddress(request)}`))
  const now = Date.now()
  return db.runTransaction(async (transaction) => {
    const current = await transaction.get(ref)
    const value = current.exists ? current.data() : {}
    const windowStartedAt = Number(value.windowStartedAt || 0)
    if (!windowStartedAt || now - windowStartedAt >= windowMs) {
      transaction.set(ref, { bucket, count: 1, windowStartedAt: now, expiresAt: new Date(now + windowMs).toISOString() })
      return true
    }
    if (Number(value.count || 0) >= maximum) return false
    transaction.update(ref, { count: FieldValue.increment(1), expiresAt: new Date(windowStartedAt + windowMs).toISOString() })
    return true
  })
}

async function sendReturnLink(db, to, parentName, portalUrl) {
  const apiKey = process.env.RESEND_API_KEY
  const rawFrom = process.env.RESEND_FROM
  if (!apiKey || !rawFrom) throw new Error('Email sending is not configured.')
  const match = String(rawFrom).match(/<(.+)>/)
  const from = `1330 Squadron Staff <${(match ? match[1] : rawFrom).trim()}>`
  const settings = await db.collection(joiningPortalCollections.settings).doc('emailTemplates').get()
  const template = (settings.exists ? settings.get('value') : []).find((item) => item.id === 'family_return_link')
  const values = { parentName: parentName || 'Parent or guardian', portalUrl }
  const fill = (text) => String(text || '').replace(/{{(\w+)}}/g, (_, key) => values[key] || '')
  const subject = fill(template?.subject || 'Return to your 1330 Squadron joining enquiry')
  const intro = fill(template?.body || 'Dear {{parentName}},\n\nUse the secure button below to return to your family joining record.\n\nIf you did not request this link, you can ignore this email.')
  const { html } = renderEmail({ heading: 'Return to your joining enquiry', paragraphs: bodyToParagraphs(intro), cta: { label: 'Open your joining record', url: portalUrl } })
  const response = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from, to, subject, html }) })
  if (!response.ok) throw new Error(await response.text())
}

export default async (request) => {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 })
  const body = await request.json().catch(() => ({}))
  const db = joiningPortalDb()
  const families = db.collection(joiningPortalCollections.families)

  try {
    if (body.action === 'request-family-access') {
      if (!(await consumeRateLimit(db, request, 'request-family-access', 5, 60 * 60 * 1000))) return json({ error: 'Too many return-link requests. Please try again later.' }, 429)
      const email = normalEmail(body.email)
      const match = email ? await families.where('guardian.email', '==', email).limit(1).get() : null
      if (match && !match.empty) {
        const document = match.docs[0]
        const token = newToken()
        await document.ref.update({ accessToken: token, accessTokenHash: hash(token), serverUpdatedAt: FieldValue.serverTimestamp() })
        const portalUrl = `${process.env.URL || 'https://1330sqn-joining-portal.netlify.app'}/#/family/${document.id}/${token}`
        await sendReturnLink(db, email, document.get('guardian.fullName'), portalUrl)
        return json({ sent: true, found: true })
      }
      return json({ sent: false, found: false })
    }

    if (body.action === 'redeem-joining-code') {
      if (!(await consumeRateLimit(db, request, 'redeem-joining-code', 10, 15 * 60 * 1000))) return json({ error: 'Too many attempts. Please try again later.' }, 429)
      const email = normalEmail(body.email)
      const match = email ? await families.where('guardian.email', '==', email).limit(1).get() : null
      if (!match || match.empty) return json({ error: 'No unlocked paperwork was found for those details.' }, 401)
      const document = match.docs[0]
      const family = document.data()
      const cadet = (family.cadets || []).find((item) => item.joiningCode === String(body.code || ''))
      const expiresAt = cadet?.joiningCodeExpiresAt ? new Date(cadet.joiningCodeExpiresAt) : null
      if (!cadet?.attendedAt || (expiresAt && expiresAt < new Date() && cadet.paperworkStatus !== 'in_progress')) return json({ error: 'That joining code is invalid or has expired.' }, 401)
      cadet.joiningCodeUsedAt ||= new Date().toISOString()
      cadet.paperworkStatus = 'in_progress'
      cadet.status = 'paperwork_in_progress'
      const token = newToken()
      await document.ref.update({ cadets: family.cadets, accessToken: token, accessTokenHash: hash(token), serverUpdatedAt: FieldValue.serverTimestamp() })
      delete family.accessToken
      delete family.accessTokenHash
      return json({ family, token, cadetId: cadet.id })
    }

    // Direct joiner: a family who is skipping the open night entirely. Staff create the
    // record already verified and already unlocked, so the emailed link drops the parent
    // straight into the paperwork. attendedAt is what every downstream gate keys off, so
    // it is set here even though there was no open night to attend.
    if (body.action === 'create-direct-joiner') {
      if (!(await staffAllowed(body.pin, db, request))) return json({ error: 'Not authorised.' }, 401)
      const email = normalEmail(body.guardianEmail)
      const cadetName = String(body.cadetName || '').trim()
      if (!email || !cadetName) return json({ error: 'A guardian email and cadet name are required.' }, 400)

      const existing = await families.where('guardian.email', '==', email).limit(1).get()
      if (!existing.empty) return json({ error: 'An enquiry already exists for that email address. Open it from the pipeline instead.' }, 409)

      const now = new Date().toISOString()
      const token = newToken()
      const suffix = () => `${Date.now().toString(36)}-${randomBytes(3).toString('hex').slice(0, 5)}`
      const cadetId = `cadet-${suffix()}`
      const familyId = `family-${suffix()}`
      const joiningCode = Array.from({ length: 4 }, () => Math.floor(Math.random() * 10)).join('')
      const family = {
        id: familyId,
        createdAt: now,
        updatedAt: now,
        source: body.source || 'Direct',
        sourceDetail: String(body.sourceDetail || '').trim(),
        submittedBy: 'staff',
        directJoiner: true,
        guardian: {
          fullName: String(body.guardianName || '').trim(),
          email,
          mobile: String(body.guardianMobile || '').trim(),
          postcode: String(body.postcode || '').trim().toUpperCase(),
          verifiedAt: now,
        },
        cadets: [{
          id: cadetId,
          fullName: cadetName,
          dob: String(body.cadetDob || ''),
          schoolYear: Number(body.schoolYear) || null,
          schoolYearRecordedAcademicYear: Number(body.schoolYearRecordedAcademicYear) || null,
          status: 'paperwork_in_progress',
          openNightId: null,
          bookedAt: null,
          attendedAt: now,
          openNightAttendanceStatus: null,
          joiningCode,
          joiningCodeExpiresAt: null,
          joiningCodeUsedAt: now,
          paperworkStatus: 'in_progress',
          intendedStartDate: body.intendedStartDate || null,
        }],
        communicationsConsent: Boolean(body.communicationsConsent),
        dataTermsAcceptedAt: null,
        verificationCode: null,
        notes: [{ id: `note-${suffix()}`, createdAt: now, author: 'Staff', text: 'Direct joiner: added by staff without an open night. Paperwork unlocked on creation.' }],
      }
      await families.doc(familyId).set({ ...family, accessToken: token, accessTokenHash: hash(token), serverUpdatedAt: FieldValue.serverTimestamp() })
      return json({ family, familyId, cadetId, token })
    }

    // Paperwork progress and payment state, saved as the parent works through the Form 3822.
    // Deliberately NOT sync-family: that overwrites the whole document, so a parent posting a
    // half-loaded copy could wipe staff edits. This touches only the one cadet, inside a
    // transaction, and only the progress and payment fields.
    //
    // The payment record matters most. Without it a parent who has already paid and then
    // closes the tab is asked to pay a second time.
    if (body.action === 'save-paperwork-progress') {
      const familyId = String(body.familyId || '')
      const cadetId = String(body.cadetId || '')
      const token = String(body.token || '')
      if (!familyId || !cadetId || token.length < 20) return json({ error: 'Paperwork access details are missing.' }, 400)
      const ref = families.doc(familyId)
      const saved = await db.runTransaction(async (transaction) => {
        const current = await transaction.get(ref)
        if (!current.exists) throw new Error('NOT_FOUND')
        if (!same(current.get('accessTokenHash'), hash(token))) throw new Error('NOT_AUTHORISED')
        const cadets = current.get('cadets') || []
        const index = cadets.findIndex((item) => item.id === cadetId)
        if (index === -1) throw new Error('NOT_FOUND')
        const cadet = { ...cadets[index] }
        if (body.progress && typeof body.progress === 'object') {
          cadet.paperworkProgress = {
            stage: String(body.progress.stage || ''),
            wizardIndex: Number(body.progress.wizardIndex) || 0,
            formData: body.progress.formData && typeof body.progress.formData === 'object' ? body.progress.formData : {},
            updatedAt: new Date().toISOString(),
          }
        }
        if (body.payment && typeof body.payment === 'object') {
          cadet.payments = {
            ...(cadet.payments || {}),
            ...(body.payment.fee ? { fee: { ...body.payment.fee, recordedAt: new Date().toISOString() } } : {}),
            ...(body.payment.subs ? { subs: { ...body.payment.subs, recordedAt: new Date().toISOString() } } : {}),
          }
        }
        cadets[index] = cadet
        transaction.update(ref, { cadets, updatedAt: new Date().toISOString(), serverUpdatedAt: FieldValue.serverTimestamp() })
        return true
      })
      return json({ saved })
    }
    if (body.action === 'sync-family') {
      const family = cleanFamily(body.family)
      const familyId = String(family.id || '')
      const token = String(body.token || '')
      const staffAuthorised = await staffAllowed(body.pin, db, request)
      if (!familyId || (token.length < 20 && !staffAuthorised)) return json({ error: 'Family access details are missing.' }, 400)
      const ref = families.doc(familyId)
      const deletedRef = db.collection(joiningPortalCollections.deletedFamilies).doc(familyId)
      await db.runTransaction(async (transaction) => {
        const [current, deleted] = await Promise.all([transaction.get(ref), transaction.get(deletedRef)])
        if (deleted.exists) throw new Error('DELETED_FAMILY')
        if (current.exists && !same(current.get('accessTokenHash'), hash(token)) && !staffAuthorised) throw new Error('NOT_AUTHORISED')
        transaction.set(ref, {
          ...family,
          accessTokenHash: current.exists ? current.get('accessTokenHash') : hash(token),
          accessToken: current.exists ? current.get('accessToken') : token,
          serverUpdatedAt: FieldValue.serverTimestamp(),
        }, { merge: false })
      })
      return json({ saved: true, familyId })
    }

    if (body.action === 'delete-family') {
      const familyId = String(body.familyId || '')
      const ref = families.doc(familyId)
      const current = await ref.get()
      const staffAuthorised = await staffAllowed(body.pin, db, request)
      const tokenAllowed = current.exists && body.token && same(current.get('accessTokenHash'), hash(body.token))
      if (!tokenAllowed && !staffAuthorised) return json({ error: 'Not authorised.' }, 401)
      const batch = db.batch()
      if (current.exists) batch.delete(ref)
      batch.set(db.collection(joiningPortalCollections.deletedFamilies).doc(familyId), {
        deletedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      })
      await batch.commit()
      return json({ deleted: true })
    }

    if (body.action === 'load-family') {
      const current = await families.doc(String(body.familyId || '')).get()
      if (!current.exists) return json({ error: 'Family not found.' }, 404)
      const tokenAllowed = body.token && same(current.get('accessTokenHash'), hash(body.token))
      if (!tokenAllowed && !(await staffAllowed(body.pin, db, request))) return json({ error: 'Not authorised.' }, 401)
      const data = current.data()
      delete data.accessTokenHash
      delete data.accessToken
      const keyDates = await db.collection(joiningPortalCollections.settings).doc('keyDates').get()
      return json({ family: data, settings: keyDates.exists ? { keyDates: keyDates.get('value') } : {} })
    }

    if (body.action === 'staff-snapshot') {
      if (!(await staffAllowed(body.pin, db, request))) return json({ error: 'Not authorised.' }, 401)
      const [familySnapshot, managementSnapshot, settingsSnapshot] = await Promise.all([
        families.get(),
        db.collection(joiningPortalCollections.openNights).get(),
        db.collection(joiningPortalCollections.settings).get(),
      ])
      const familyRecords = familySnapshot.docs.map((document) => {
        const value = document.data()
        delete value.accessTokenHash
        delete value.accessToken
        return value
      })
      const openNightManagement = Object.fromEntries(managementSnapshot.docs.map((document) => [document.id, document.data()]))
      const settings = Object.fromEntries(settingsSnapshot.docs.filter((document) => document.id !== 'security').map((document) => [document.id, document.data().value]))
      return json({ families: familyRecords, openNightManagement, settings })
    }

    if (body.action === 'save-open-night') {
      if (!(await staffAllowed(body.pin, db, request))) return json({ error: 'Not authorised.' }, 401)
      const openNightId = String(body.openNightId || '')
      if (!openNightId) return json({ error: 'Open Night ID is missing.' }, 400)
      await db.collection(joiningPortalCollections.openNights).doc(openNightId).set({
        ...(body.management || {}), serverUpdatedAt: FieldValue.serverTimestamp(),
      }, { merge: false })
      return json({ saved: true })
    }

    if (body.action === 'validate-staff') {
      return (await staffAllowed(body.pin, db, request)) ? json({ valid: true }) : json({ error: 'Incorrect code.' }, 401)
    }

    if (body.action === 'save-setting') {
      if (!(await staffAllowed(body.pin, db, request))) return json({ error: 'Not authorised.' }, 401)
      const allowed = ['emailTemplates', 'keyDates', 'adminEmails']
      if (!allowed.includes(body.key)) return json({ error: 'Unknown setting.' }, 400)
      await db.collection(joiningPortalCollections.settings).doc(body.key).set({ value: body.value, serverUpdatedAt: FieldValue.serverTimestamp() })
      return json({ saved: true })
    }

    if (body.action === 'change-pin') {
      if (!(await staffAllowed(body.pin, db, request))) return json({ error: 'Not authorised.' }, 401)
      if (!/^\d{4}$/.test(String(body.newPin || ''))) return json({ error: 'Code must be exactly four digits.' }, 400)
      await db.collection(joiningPortalCollections.settings).doc('security').set({ pinHash: hash(body.newPin), serverUpdatedAt: FieldValue.serverTimestamp() })
      return json({ saved: true })
    }

    return json({ error: 'Unknown action.' }, 400)
  } catch (error) {
    if (error?.message === 'NOT_AUTHORISED') return json({ error: 'Not authorised.' }, 401)
    if (error?.message === 'NOT_FOUND') return json({ error: 'That joining record could not be found.' }, 404)
    if (error?.message === 'DELETED_FAMILY') return json({ error: 'This application has been deleted and cannot be restored by an old browser session.' }, 410)
    console.error('Joining data request failed:', error)
    return json({ error: 'The joining database request failed.' }, 500)
  }
}
