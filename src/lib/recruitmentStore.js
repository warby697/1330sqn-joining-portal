import { emailPortalUrl, getEmailTemplates, getKeyDates, hydrateCommunicationSettings } from './communicationSettings'
import { hydrateAdminEmails } from './adminEmails'
import { createDirectJoiner, createFamilyToken, deleteSharedFamily, loadSharedFamily, loadStaffSnapshot, saveSharedOpenNight, syncFamily } from './sharedRecruitmentStore'

const STORE_KEY = 'joining-portal:recruitment:v2'
const RESET_MARKER = 'joining-portal:clean-live-run:v1'
try {
  if (!localStorage.getItem(RESET_MARKER)) {
    localStorage.removeItem('joining-portal:recruitment:v1')
    localStorage.removeItem(STORE_KEY)
    Object.keys(sessionStorage).filter((key) => key.startsWith('joining-portal:paperwork:') || key === 'joining-portal:pending-payment').forEach((key) => sessionStorage.removeItem(key))
    localStorage.setItem(RESET_MARKER, new Date().toISOString())
  }
} catch { /* storage may be unavailable */ }

const read = () => {
  try {
    const value = JSON.parse(localStorage.getItem(STORE_KEY) || '{}')
    const families = value.families || []
    families.forEach((family) => {
      if (!family.guardian?.verifiedAt) return
      family.cadets.forEach((cadet) => {
        if (!['eligible', 'future_waiting'].includes(cadet.status)) return
        cadet.eligibleIntakeDate = getNextEligibleIntake(cadet).toISOString()
        cadet.status = isEligibleForNextIntake(cadet) ? 'eligible' : 'future_waiting'
      })
    })
    return { families, messages: value.messages || [], openNightManagement: value.openNightManagement || {} }
  } catch {
    return { families: [], messages: [], openNightManagement: {} }
  }
}

// Writes local state immediately, then syncs ONLY the family/families that
// changed to Firestore. Returns a promise that resolves when that sync lands
// (or rejects if it fails) so callers can wait before advancing the UI.
// Passing no id keeps the write local-only (used when the caller syncs itself).
const write = (data, changedId) => {
  localStorage.setItem(STORE_KEY, JSON.stringify(data))
  window.dispatchEvent(new Event('recruitment-store-change'))
  if (changedId == null) return Promise.resolve()
  const ids = Array.isArray(changedId) ? changedId : [changedId]
  return Promise.all(
    data.families
      .filter((family) => ids.includes(family.id))
      .map((family) => syncFamily({ ...family, _messages: data.messages.filter((message) => message.familyId === family.id) })),
  )
}

const id = (prefix) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
const code = (length = 6) => Array.from({ length }, () => Math.floor(Math.random() * 10)).join('')
const iso = (date = new Date()) => date.toISOString()
const emailTemplate = (id, values) => {
  const template = getEmailTemplates().find((item) => item.id === id)
  const replace = (text) => String(text || '').replace(/{{(\w+)}}/g, (_, key) => values[key] || '')
  return { subject: replace(template?.subject), body: replace(template?.body), active: template?.active !== false }
}
const simulateEmail = () => ['5173', '5190'].includes(window.location.port)

function buildOpenNights() {
  const settings = getKeyDates()
  const [hours, minutes] = settings.openNightStart.split(':').map(Number)
  const dates = settings.openNights.map((value) => { const [year, month, day] = value.split('-').map(Number); return new Date(year, month - 1, day, hours, minutes) })
  return dates.map((date) => ({
    id: `open-night-${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
    startsAt: date.toISOString(), capacity: 50, staffingRequired: ['Event lead', 'OC', 'Additional staff member'], fullNight: true,
  }))
}

export const OPEN_NIGHTS = buildOpenNights()
function refreshOpenNights() { OPEN_NIGHTS.splice(0, OPEN_NIGHTS.length, ...buildOpenNights()) }

export const formatDate = (value, options = {}) => new Date(value).toLocaleDateString('en-GB', {
  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', ...options,
})

export const OPEN_NIGHT_ADDRESS = "Peninsula Barracks, O'Leary Street, Warrington, WA2 7QS"

export function getOpenNightBrief(family, cadet, night) {
  return {
    subject: `Open Night confirmation for ${cadet.fullName || 'prospective cadet'}`,
    date: formatDate(night.startsAt),
    arrivalTime: '7.10pm',
    gateTime: '7.15pm',
    address: OPEN_NIGHT_ADDRESS,
    parentName: family.guardian.fullName,
    cadetName: cadet.fullName,
  }
}

export async function sendOpenNightConfirmation(family, cadet, night) {
  const template = emailTemplate('open_night_confirmation', { parentName: family.guardian.fullName, cadetName: cadet.fullName, openNightDate: formatDate(night.startsAt) })
  if (!template.active) return { skipped: true }
  if (simulateEmail()) return { simulated: true }
  const response = await fetch('/.netlify/functions/send-open-night-confirmation', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: family.guardian.email,
      ...getOpenNightBrief(family, cadet, night),
      portalUrl: emailPortalUrl('open_night_confirmation', { appUrl: `${window.location.origin}${window.location.pathname}`, familyId: family.id, accessToken: family._portalToken || '' }),
      template,
    }),
  })
  if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || 'Could not send the confirmation email')
  const result = await response.json()
  setMessageDeliveryStatus(family.id, cadet.id, 'open_night_confirmation', 'sent', result)
  return result
}

export async function sendJoiningCodeEmail(family, cadet) {
  const template = emailTemplate('joining_code', { parentName: family.guardian.fullName, cadetName: cadet.fullName, joiningCode: cadet.joiningCode, codeExpiry: formatDate(cadet.joiningCodeExpiresAt) })
  if (!template.active) return { skipped: true }
  if (simulateEmail()) return { simulated: true }
  const response = await fetch('/.netlify/functions/send-joining-code', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: family.guardian.email,
      parentName: family.guardian.fullName,
      cadetName: cadet.fullName,
      code: cadet.joiningCode,
      expiresAt: cadet.joiningCodeExpiresAt,
      portalUrl: emailPortalUrl('joining_code', { appUrl: `${window.location.origin}${window.location.pathname}` }),
      template,
    }),
  })
  if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || 'Could not send the joining-code email')
  const result = await response.json()
  setMessageDeliveryStatus(family.id, cadet.id, 'paperwork_unlocked', 'sent', result)
  return result
}

export async function sendDidNotAttendEmail(family, cadet, night) {
  const template = emailTemplate('nonattendance', { parentName: family.guardian.fullName, cadetName: cadet.fullName, openNightDate: night ? formatDate(night.startsAt) : '' })
  if (!template.active) return { skipped: true }
  if (simulateEmail()) return { simulated: true }
  const response = await fetch('/.netlify/functions/send-open-night-nonattendance', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: family.guardian.email,
      parentName: family.guardian.fullName,
      cadetName: cadet.fullName,
      date: night ? formatDate(night.startsAt) : 'your booked Open Night',
      portalUrl: `${window.location.origin}${window.location.pathname}#/family/${family.id}/${family._portalToken || ''}`,
      template,
    }),
  })
  if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || 'Could not send the non-attendance email')
  const result = await response.json()
  setMessageDeliveryStatus(family.id, cadet.id, 'nonattendance', 'sent', result)
  return result
}

export async function sendWithdrawalConfirmationEmail(family, cadet) {
  const template = emailTemplate('withdrawal_confirmation', { parentName: family.guardian.fullName, cadetName: cadet.fullName })
  if (!template.active || !family.guardian.email) return { skipped: true }
  if (simulateEmail() || ['localhost', '127.0.0.1'].includes(window.location.hostname)) return { simulated: true }
  const response = await fetch('/.netlify/functions/send-withdrawal-confirmation', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to: family.guardian.email, parentName: family.guardian.fullName, cadetName: cadet.fullName, template }),
  })
  if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || 'Could not send the withdrawal confirmation email')
  return response.json()
}

export async function sendOpenNightDateChangeEmail(family, cadet, oldDate, newDate) {
  const template = emailTemplate('open_night_date_changed', { parentName: family.guardian.fullName, cadetName: cadet.fullName, oldDate: formatDate(oldDate), newDate: formatDate(newDate), portalUrl: `${window.location.origin}${window.location.pathname}#/family/${family.id}/${family._portalToken || ''}` })
  if (simulateEmail()) return { simulated: true }
  const response = await fetch('/.netlify/functions/send-open-night-date-change', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to: family.guardian.email, parentName: family.guardian.fullName, cadetName: cadet.fullName, oldDate: formatDate(oldDate), newDate: formatDate(newDate), portalUrl: `${window.location.origin}${window.location.pathname}#/family/${family.id}/${family._portalToken || ''}`, template }),
  })
  if (!response.ok) throw new Error('Could not send the changed-date email')
  const result = await response.json()
  setMessageDeliveryStatus(family.id, cadet.id, 'open_night_date_changed', 'sent', result)
  return result
}

export async function changeOpenNightDates(oldDates, newDates) {
  const data = read()
  const affected = []
  oldDates.forEach((oldDate, index) => {
    const newDate = newDates[index]
    if (!newDate || newDate === oldDate) return
    const oldId = `open-night-${oldDate}`
    const newId = `open-night-${newDate}`
    data.families.forEach((family) => family.cadets.forEach((cadet) => {
      if (cadet.openNightId !== oldId || cadet.attendedAt) return
      cadet.openNightId = newId
      affected.push({ family, cadet, oldDate, newDate })
      data.messages.push({ id: id('message'), familyId: family.id, cadetId: cadet.id, createdAt: iso(), status: 'simulated', kind: 'open_night_date_changed', to: family.guardian.email, subject: `Important: Open Night date changed for ${cadet.fullName}` })
    }))
  })
  await write(data, affected.map((item) => item.family.id))
  refreshOpenNights()
  return affected
}

export function listFamilies() {
  return read().families.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
}

export function getFamily(familyId) {
  return read().families.find((family) => family.id === familyId) || null
}

export function persistFamily(family) {
  const sharedFamily = {
    ...family,
    _messages: read().messages.filter((message) => message.familyId === family.id),
  }
  return syncFamily(sharedFamily)
}

export function removeCachedFamily(familyId) {
  const current = read()
  const next = {
    ...current,
    families: current.families.filter((family) => family.id !== familyId),
    messages: current.messages.filter((message) => message.familyId !== familyId),
  }
  localStorage.setItem(STORE_KEY, JSON.stringify(next))
  window.dispatchEvent(new Event('recruitment-store-change'))
}

export function findFamilyByEmail(email) {
  const normalized = String(email || '').trim().toLowerCase()
  return read().families.find((family) => family.guardian.email.toLowerCase() === normalized) || null
}

export async function sendParentVerificationEmail(family) {
  if (!family?.guardian.email) return { skipped: true }
  if (simulateEmail()) return { simulated: true }
  const cadet = family.cadets[0]
  const template = emailTemplate('parent_verification', { parentName: family.guardian.fullName, cadetName: cadet?.fullName })
  if (!template.active) return { skipped: true }
  const response = await fetch('/.netlify/functions/send-parent-verification', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to: family.guardian.email, parentName: family.guardian.fullName, cadetName: cadet?.fullName, code: family.verificationCode, portalUrl: `${window.location.origin}${window.location.pathname}#/family/${family.id}/${family._portalToken || ''}`, template }) })
  if (!response.ok) throw new Error('Could not send the parent verification email')
  const result = await response.json()
  setMessageDeliveryStatus(family.id, cadet?.id, 'parent_verification', 'sent', result)
  return result
}

function setMessageDeliveryStatus(familyId, cadetId, kind, status, delivery = {}) {
  const data = read()
  const matches = data.messages.filter((message) => message.familyId === familyId && message.kind === kind && (!cadetId || !message.cadetId || message.cadetId === cadetId))
  const latest = matches.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0]
  if (!latest) return
  latest.status = status
  latest.sentAt = iso()
  if (delivery.subject) latest.subject = delivery.subject
  if (delivery.body) latest.body = delivery.body
  if (delivery.providerMessageId) latest.providerMessageId = delivery.providerMessageId
  write(data, familyId).catch((error) => console.error('Could not sync message status:', error))
}

export function createEnquiry(values, existingId) {
  const data = read()
  if (existingId) {
    const prior = data.families.find((item) => item.id === existingId)
    if (prior) return prior
  }
  const normalizedEmail = String(values.guardianEmail || '').trim().toLowerCase()
  const family = {
    id: existingId || id('family'),
    _portalToken: createFamilyToken(),
    createdAt: iso(),
    updatedAt: iso(),
    source: values.source || 'Website',
    sourceDetail: values.source === 'School' ? String(values.schoolName || '').trim() : '',
    submittedBy: values.submittedBy,
    guardian: {
      fullName: String(values.guardianName || '').trim(),
      email: normalizedEmail,
      mobile: String(values.guardianMobile || '').trim(),
      postcode: String(values.postcode || '').trim().toUpperCase(),
      verifiedAt: null,
    },
    cadets: [newCadet(values)],
    communicationsConsent: Boolean(values.communicationsConsent),
    dataTermsAcceptedAt: values.dataTermsAccepted ? iso() : null,
    verificationCode: code(6),
    notes: [],
  }
  data.families.push(family)
  if (values.submittedBy !== 'cadet' && family.guardian.email) data.messages.push({
    id: id('message'), familyId: family.id, createdAt: iso(), status: 'simulated', kind: 'parent_verification',
    to: family.guardian.email, subject: 'Confirm your 1330 Squadron enquiry',
  })
  write(data)
  return family
}

export async function updateGuardianDetails(familyId, details) {
  const data = read()
  const family = data.families.find((item) => item.id === familyId)
  if (!family) return null
  family.guardian = {
    ...family.guardian,
    fullName: String(details.fullName || '').trim(),
    email: String(details.email || '').trim().toLowerCase(),
    mobile: String(details.mobile || '').trim(),
    postcode: String(details.postcode || '').trim().toUpperCase(),
  }
    family.communicationsConsent = Boolean(details.communicationsConsent)
    if (details.dataTermsAccepted) family.dataTermsAcceptedAt = family.dataTermsAcceptedAt || iso()
  family.updatedAt = iso()
  data.messages.push({ id: id('message'), familyId, createdAt: iso(), status: 'simulated', kind: 'parent_verification', to: family.guardian.email, subject: 'Confirm your 1330 Squadron enquiry' })
  await write(data, familyId)
  return family
}

export async function addCadetToFamily(familyId, values) {
  const data = read()
  const family = data.families.find((item) => item.id === familyId)
  if (!family) return null
  const duplicate = family.cadets.some((cadet) => cadet.fullName.toLowerCase() === String(values.cadetName || '').trim().toLowerCase())
  if (duplicate) return family

  const cadet = newCadet(values)
  if (family.guardian.verifiedAt) {
    const intake = getNextEligibleIntake(cadet)
    cadet.eligibleIntakeDate = intake.toISOString()
    cadet.status = isEligibleForNextIntake(cadet) ? 'eligible' : 'future_waiting'
  }
  if (values.openNightId && cadet.status === 'eligible') {
    cadet.openNightId = values.openNightId
    cadet.bookedAt = iso()
    cadet.status = 'open_night_booked'
  }
  family.cadets.push(cadet)
  family.updatedAt = iso()
  data.messages.push({
    id: id('message'), familyId, cadetId: cadet.id, createdAt: iso(), status: 'simulated', kind: 'cadet_added',
    to: family.guardian.email, subject: `${cadet.fullName || 'Another cadet'} has been added to your family enquiry`,
  })
  if (cadet.openNightId) {
    const night = OPEN_NIGHTS.find((item) => item.id === cadet.openNightId)
    data.messages.push({
      id: id('message'), familyId, cadetId: cadet.id, createdAt: iso(), status: 'simulated', kind: 'open_night_confirmation',
      to: family.guardian.email, fromName: 'Squadron Ops', subject: `Open Night confirmation for ${cadet.fullName || 'prospective cadet'}`,
      body: night ? getOpenNightBrief(family, cadet, night) : null,
    })
  }
  await write(data, familyId)
  return family
}

export async function verifyGuardian(familyId, verificationCode) {
  const data = read()
  const family = data.families.find((item) => item.id === familyId)
  if (!family || family.verificationCode !== String(verificationCode)) return null
  family.guardian.verifiedAt = iso()
  family.updatedAt = iso()
  family.cadets.forEach((cadet) => {
    const intake = getNextEligibleIntake(cadet)
    cadet.eligibleIntakeDate = intake.toISOString()
    cadet.status = isEligibleForNextIntake(cadet) ? 'eligible' : 'future_waiting'
  })
  await write(data, familyId)
  return family
}

export function bookOpenNight(familyId, cadetId, openNightId) {
  return updateCadet(familyId, cadetId, (cadet, family, data) => {
    const night = OPEN_NIGHTS.find((item) => item.id === openNightId)
    const snapshot = emailTemplate('open_night_confirmation', { parentName: family.guardian.fullName, cadetName: cadet.fullName, openNightDate: night ? formatDate(night.startsAt) : '' })
    if (joiningCodeExpired(cadet)) {
      cadet.attendedAt = null
      cadet.joiningCode = null
      cadet.joiningCodeExpiresAt = null
      cadet.joiningCodeUsedAt = null
      cadet.paperworkStatus = 'locked'
      cadet.intendedStartDate = null
    }
    cadet.openNightId = openNightId
    cadet.bookedAt = iso()
    cadet.status = 'open_night_booked'
    cadet.openNightAttendanceStatus = 'booked'
    data.messages.push({
      id: id('message'), familyId, cadetId, createdAt: iso(), status: 'simulated', kind: 'open_night_confirmation',
      to: family.guardian.email, fromName: 'Squadron Ops', subject: snapshot.subject,
      body: snapshot.body,
    })
  })
}

export function markAttended(familyId, cadetId) {
  return updateCadet(familyId, cadetId, (cadet, family, data) => {
    if (cadet.attendedAt) return
    cadet.attendedAt = iso()
    cadet.openNightAttendanceStatus = 'approved'
    cadet.status = 'paperwork_available'
    cadet.paperworkStatus = 'available'
    cadet.joiningCode = code(4)
    cadet.joiningCodeExpiresAt = new Date(Date.now() + getKeyDates().joiningCodeDays * 24 * 60 * 60 * 1000).toISOString()
    cadet.intendedStartDate = getNextEligibleIntake(cadet, openNightDate(cadet.openNightId)).toISOString()
    const snapshot = emailTemplate('joining_code', { parentName: family.guardian.fullName, cadetName: cadet.fullName, joiningCode: cadet.joiningCode, codeExpiry: formatDate(cadet.joiningCodeExpiresAt) })
    data.messages.push({
      id: id('message'), familyId, cadetId, createdAt: iso(), status: 'simulated', kind: 'paperwork_unlocked',
      to: family.guardian.email, fromName: 'Squadron Ops', subject: snapshot.subject, body: snapshot.body,
      code: cadet.joiningCode, expiresAt: cadet.joiningCodeExpiresAt,
    })
  })
}

export async function validateJoiningCode(familyId, cadetId, joiningCode) {
  let accepted = false
  const family = await updateCadet(familyId, cadetId, (cadet) => {
    const fallbackExpiry = cadet.attendedAt ? new Date(new Date(cadet.attendedAt).getTime() + 30 * 24 * 60 * 60 * 1000) : null
    const expiresAt = cadet.joiningCodeExpiresAt ? new Date(cadet.joiningCodeExpiresAt) : fallbackExpiry
    const validDate = !expiresAt || expiresAt >= new Date() || cadet.paperworkStatus === 'in_progress'
    if (cadet.joiningCode === String(joiningCode) && validDate && ['available', 'in_progress'].includes(cadet.paperworkStatus)) {
      cadet.joiningCodeUsedAt = iso()
      cadet.paperworkStatus = 'in_progress'
      cadet.status = 'paperwork_in_progress'
      accepted = true
    }
  })
  return accepted ? family : null
}

export function joiningCodeExpired(cadet) {
  if (!cadet?.joiningCode || cadet.paperworkStatus === 'in_progress') return false
  const expiry = cadet.joiningCodeExpiresAt
    ? new Date(cadet.joiningCodeExpiresAt)
    : cadet.attendedAt ? new Date(new Date(cadet.attendedAt).getTime() + 30 * 24 * 60 * 60 * 1000) : null
  return Boolean(expiry && expiry < new Date())
}

export function hasMissedIntake(cadet, now = new Date()) {
  if (!cadet?.intendedStartDate || ['joined', 'withdrawn'].includes(cadet.status)) return false
  const reviewDate = new Date(cadet.intendedStartDate)
  reviewDate.setDate(reviewDate.getDate() + 14)
  return now >= reviewDate
}

export function setCadetStatus(familyId, cadetId, status) {
  return updateCadet(familyId, cadetId, (cadet) => { cadet.status = status })
}

export function withdrawCadet(familyId, cadetId, details = {}) {
  return updateCadet(familyId, cadetId, (cadet, family, data) => {
    cadet.status = 'withdrawn'
    cadet.withdrawnAt = iso()
    cadet.withdrawalReason = details.reason || 'not_recorded'
    cadet.withdrawalNote = String(details.note || '').trim()
    cadet.withdrawalSource = details.source || 'staff'
    cadet.openNightAttendanceStatus = 'withdrawn'
    data.messages.push({
      id: id('message'), familyId, cadetId, createdAt: iso(), status: 'simulated', kind: 'withdrawn',
      to: family.guardian.email, subject: `${cadet.fullName || 'Prospective cadet'} withdrawn from recruitment`,
    })
  })
}

export async function deleteCadetEnquiry(familyId, cadetId) {
  const data = read()
  const family = data.families.find((item) => item.id === familyId)
  if (!family) return null
  family.cadets = family.cadets.filter((cadet) => cadet.id !== cadetId)
  data.messages = data.messages.filter((message) => !(message.familyId === familyId && message.cadetId === cadetId))
  if (!family.cadets.length) {
    await deleteSharedFamily(family)
    data.families = data.families.filter((item) => item.id !== familyId)
    data.messages = data.messages.filter((message) => message.familyId !== familyId)
    write(data)
    return null
  }
  family.updatedAt = iso()
  await syncFamily({ ...family, _messages: data.messages.filter((message) => message.familyId === family.id) })
  write(data)
  return family
}

export async function markPaperworkComplete(familyId, cadetId) {
  const family = await updateCadet(familyId, cadetId, (cadet, currentFamily, data) => {
    cadet.paperworkStatus = 'completed'
    cadet.paperworkCompletedAt = iso()
    cadet.status = 'ready_to_start'
    const snapshot = emailTemplate('joining_complete', { parentName: currentFamily.guardian.fullName, cadetName: cadet.fullName, startDate: cadet.intendedStartDate ? formatDate(cadet.intendedStartDate) : '' })
    data.messages.push({ id: id('message'), familyId, cadetId, createdAt: iso(), status: 'sent_with_form', kind: 'joining_complete', to: currentFamily.guardian.email, subject: snapshot.subject, body: snapshot.body })
  })
  return family
}

export function setOpenNightAttendance(familyId, cadetId, details) {
  return updateCadet(familyId, cadetId, (cadet, family, data) => {
    const wasAbsent = cadet.openNightAttendanceStatus === 'absent'
    cadet.openNightAttendanceStatus = details.status || 'booked'
    cadet.parentAttendedOpenNight = Boolean(details.parentAttended)
    cadet.openNightStaffNote = String(details.note || '').trim()
    if (details.status === 'cancelled' || details.status === 'absent') cadet.status = 'open_night_booked'
    if (details.status === 'absent' && !wasAbsent) {
      const night = OPEN_NIGHTS.find((item) => item.id === cadet.openNightId)
      const snapshot = emailTemplate('nonattendance', { parentName: family.guardian.fullName, cadetName: cadet.fullName, openNightDate: night ? formatDate(night.startsAt) : '' })
      data.messages.push({ id: id('message'), familyId, cadetId, createdAt: iso(), status: 'simulated', kind: 'nonattendance', to: family.guardian.email, subject: snapshot.subject, body: snapshot.body })
    }
  })
}

export function getOpenNightManagement(openNightId) {
  return read().openNightManagement[openNightId] || {
    staff: { eventLead: '', oc: '', additional: '' },
    checklist: { gate: false, presentation: false, tourCadets: false, demonstration: false, codes: false },
  }
}

export function updateOpenNightManagement(openNightId, patch) {
  const data = read()
  const current = getOpenNightManagement(openNightId)
  data.openNightManagement[openNightId] = {
    ...current, ...patch,
    staff: { ...current.staff, ...(patch.staff || {}) },
    checklist: { ...current.checklist, ...(patch.checklist || {}) },
    updatedAt: iso(),
  }
  write(data)
  saveSharedOpenNight(openNightId, data.openNightManagement[openNightId]).catch((error) => console.error('Could not sync Open Night preparation:', error))
  return data.openNightManagement[openNightId]
}

export async function hydrateStaffRecruitmentData() {
  const snapshot = await loadStaffSnapshot()
  hydrateCommunicationSettings(snapshot.settings || {})
  refreshOpenNights()
  hydrateAdminEmails(snapshot.settings?.adminEmails)
  const current = read()
  const families = (snapshot.families || []).map((family) => ({ ...family, _portalToken: current.families.find((item) => item.id === family.id)?._portalToken }))
  const messages = families.flatMap((family) => family._messages || [])
  families.forEach((family) => { delete family._messages })
  const next = { families, messages, openNightManagement: snapshot.openNightManagement || {} }
  localStorage.setItem(STORE_KEY, JSON.stringify(next))
  window.dispatchEvent(new Event('recruitment-store-change'))
  return next
}

export async function hydrateSharedFamily(familyId, token) {
  const result = await loadSharedFamily(familyId, token)
  hydrateCommunicationSettings(result.settings || {})
  refreshOpenNights()
  const family = { ...result.family, _portalToken: token }
  const familyMessages = family._messages || []
  delete family._messages
  const current = read()
  const next = {
    ...current,
    families: [...current.families.filter((item) => item.id !== familyId), family],
    messages: [...current.messages.filter((message) => message.familyId !== familyId), ...familyMessages],
  }
  localStorage.setItem(STORE_KEY, JSON.stringify(next))
  window.dispatchEvent(new Event('recruitment-store-change'))
  return family
}

export function getOpenNightRoster(openNightId) {
  return read().families.flatMap((family) => family.cadets
    .filter((cadet) => cadet.openNightId === openNightId)
    .map((cadet) => ({ family, cadet })))
}

export async function addStaffNote(familyId, note) {
  const data = read()
  const family = data.families.find((item) => item.id === familyId)
  if (!family || !note.trim()) return family || null
  family.notes.unshift({ id: id('note'), text: note.trim(), createdAt: iso() })
  family.updatedAt = iso()
  await write(data, familyId)
  return family
}

export function messagesForFamily(familyId) {
  return read().messages.filter((message) => message.familyId === familyId)
}

export function getCommunicationSchedule(family, selectedCadet = null) {
  const cadet = selectedCadet || family?.cadets?.[0]
  if (!family || !cadet || !family.guardian.verifiedAt) return []
  if (cadet.status === 'withdrawn') return []
  const items = []
  if (cadet.openNightAttendanceStatus === 'absent') {
    items.push({ label: 'Missed Open Night action', when: 'Rebook another Open Night or withdraw the enquiry' })
    return items
  }
  if (cadet.status === 'eligible' && !cadet.openNightId) {
    items.push({ label: 'Open Night booking nudge', when: '48 hours after verification if no booking is made' })
  }
  if (cadet.status === 'future_waiting') {
    items.push({ label: 'Eligibility review', when: 'Automatically as age and school year progress' })
  }
  if (cadet.openNightId && !cadet.attendedAt) {
    const night = OPEN_NIGHTS.find((item) => item.id === cadet.openNightId)
    items.push({ label: 'Open-night reminder', when: night ? `7 days before ${formatDate(night.startsAt)}` : '7 days before' })
    items.push({ label: 'Final open-night reminder', when: '24 hours before' })
  }
  if (cadet.attendedAt && cadet.paperworkStatus !== 'completed') {
    items.push({ label: 'Joining paperwork reminder', when: '7 days after the Open Night if incomplete' })
    if (!cadet.joiningCodeUsedAt) items.push({ label: 'Final joining-code warning', when: '72 hours before the unused code expires' })
  }
  if (cadet.intendedStartDate && cadet.paperworkStatus === 'completed') {
    items.push({ label: 'Start-date reminder', when: '7 days before starting, if there is sufficient time' })
    items.push({ label: 'Final start-date reminder', when: '24 hours before starting' })
  }
  return items
}

async function updateCadet(familyId, cadetId, mutate) {
  const data = read()
  const family = data.families.find((item) => item.id === familyId)
  const cadet = family?.cadets.find((item) => item.id === cadetId)
  if (!family || !cadet) return null
  mutate(cadet, family, data)
  family.updatedAt = iso()
  await write(data, familyId)
  return family
}

function openNightDate(openNightId) {
  const night = OPEN_NIGHTS.find((item) => item.id === openNightId)
  return new Date(night?.startsAt || Date.now())
}

function newCadet(values) {
  return {
    id: id('cadet'), fullName: values.cadetName.trim(), dob: values.cadetDob, schoolYear: Number(values.schoolYear),
    schoolYearRecordedAcademicYear: academicYear(new Date()),
    status: 'awaiting_parent', openNightId: null, bookedAt: null, attendedAt: null, joiningCode: null,
    joiningCodeUsedAt: null, paperworkStatus: 'locked', intendedStartDate: null,
  }
}

function firstParadeNightOnOrAfter(date) {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 18, 30)
  while (![1, 4].includes(result.getDay())) result.setDate(result.getDate() + 1)
  return result
}

function academicYear(date) {
  return date.getFullYear() - (date.getMonth() < 8 ? 1 : 0)
}

function schoolYearAt(cadet, date) {
  const recordedAcademicYear = Number(cadet.schoolYearRecordedAcademicYear ?? academicYear(new Date()))
  return Number(cadet.schoolYear) + (academicYear(date) - recordedAcademicYear)
}

function ageAt(dobValue, date) {
  const [year, month, day] = String(dobValue).split('-').map(Number)
  let age = date.getFullYear() - year
  if (date.getMonth() + 1 < month || (date.getMonth() + 1 === month && date.getDate() < day)) age -= 1
  return age
}

function intakeCandidates(from = new Date()) {
  const candidates = []
  for (let year = from.getFullYear(); year <= from.getFullYear() + 8; year += 1) {
    for (const value of getKeyDates().intakeDates) {
      const [month, day] = value.split('-').map(Number)
      const intake = firstParadeNightOnOrAfter(new Date(year, month - 1, day))
      if (intake >= from) candidates.push(intake)
    }
  }
  return candidates
}

// The next intake full stop, with no eligibility screening. A direct joiner has already
// been accepted by staff, and we do not hold their DOB or school year at that point:
// getNextEligibleIntake would fail its age check and fall back to the LAST candidate,
// which is up to 8 years away.
export function getNextIntake(from = new Date()) {
  return intakeCandidates(from)[0]
}
export function getNextEligibleIntake(cadet, from = new Date()) {
  return intakeCandidates(from).find((intake) => ageAt(cadet.dob, intake) >= 13 || schoolYearAt(cadet, intake) >= 8) || intakeCandidates(from).at(-1)
}

function isEligibleForNextIntake(cadet, from = new Date()) {
  const nextIntake = intakeCandidates(from)[0]
  const eligibleIntake = getNextEligibleIntake(cadet, from)
  return nextIntake?.getTime() === eligibleIntake?.getTime()
}

// Direct joiner: staff create the record already unlocked, then email the parent a link
// straight into the paperwork. The intake date is worked out here because that logic
// lives client-side, and the server just stores what it is given.
export async function addDirectJoiner(values) {
  // Staff only supply parent name, parent email and cadet name. Everything else
  // (DOB, school year, mobile, address) is collected from the parent in the 3822A.
  const cadetNames = (Array.isArray(values.cadetNames) ? values.cadetNames : [values.cadetName])
    .map((name) => String(name || '').trim())
    .filter(Boolean)
  const result = await createDirectJoiner({
    guardianName: values.guardianName,
    guardianEmail: values.guardianEmail,
    cadetNames,
    intendedStartDate: getNextIntake().toISOString(),
  })
  // Siblings share one link. It opens the first cadet, and finishing that form hands the
  // parent straight on to the next one.
  const cadetLabel = cadetNames.length > 1
    ? `${cadetNames.slice(0, -1).join(', ')} and ${cadetNames[cadetNames.length - 1]}`
    : cadetNames[0] || ''
  const base = `${window.location.origin}${window.location.pathname}`
  const portalUrl = `${base}#/join/${result.familyId}/${result.cadetId}/${result.token}`
  const template = getEmailTemplates().find((item) => item.id === 'direct_joining_link')
  const fill = (text) => String(text || '').replace(/{{([a-zA-Z]+)}}/g, (_, key) => ({ parentName: values.guardianName || 'Parent or guardian', cadetName: cadetLabel })[key] ?? '')
  const email = await fetch('/.netlify/functions/send-direct-joining-link', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: values.guardianEmail,
      cadetName: cadetLabel,
      portalUrl,
      template: template ? { subject: fill(template.subject), body: fill(template.body) } : null,
    }),
  })
  const emailResult = await email.json().catch(() => ({}))
  return { ...result, portalUrl, emailSent: email.ok, emailError: email.ok ? null : (emailResult.error || 'The email could not be sent.') }
}

