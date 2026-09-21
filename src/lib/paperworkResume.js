// Works out where a parent should pick up the joining paperwork.
//
// sessionStorage is per tab, so it is empty whenever they reopen the emailed link, switch
// device, or come back the next day. The record carries a mirrored copy so they resume
// instead of starting the Form 3822 again.
//
// The payment guard matters most: the money has already left their account, so a lost tab
// must never put them back on a payment page.
//
// Plain module with no browser dependencies, so the server shares the same stage order.

export const STAGE_ORDER = ['gate', 'welcome', 'wizard', 'fee', 'fee-confirming', 'subs', 'subs-confirming', 'gift-aid', 'done']
export const FEE_STAGES = ['fee', 'fee-confirming']
export const SUBS_STAGES = ['subs', 'subs-confirming']

export const stageRank = (stage) => STAGE_ORDER.indexOf(stage)
const answerCount = (copy) => Object.keys(copy?.formData || {}).length

export function feeIsPaid(cadet) {
  return cadet?.payments?.fee?.status === 'paid'
}

export function subsIsActive(cadet) {
  return cadet?.payments?.subs?.status === 'active'
}

// Two copies can exist: this tab's, and the one mirrored onto the record. Take whichever
// has got further. The tab's copy used to win outright, but re-entering with the email and
// joining code seeded the tab with a bare "start at the welcome page" marker, which then
// beat a record that had reached Gift Aid, restarted the parent, and was saved over their
// finished form. Two families lost their paperwork that way after paying.
export function resolveResume(saved, cadet) {
  const record = cadet?.paperworkProgress || null
  if (!saved?.stage && !answerCount(saved)) return record
  if (!record) return saved
  const bySave = stageRank(saved.stage) - stageRank(record.stage)
  if (bySave !== 0) return bySave > 0 ? saved : record
  return answerCount(saved) >= answerCount(record) ? saved : record
}

// A payment made during this visit is in the form data before it reaches the loaded record,
// so check both. Only a confirmed payment counts; "continue anyway" does not.
export function withFormPayments(cadet, formData = {}) {
  const fee = feeIsPaid(cadet) || formData['payment.feeStatus'] === 'paid'
  const subs = subsIsActive(cadet) || formData['payment.subsStatus'] === 'active'
  return { ...cadet, payments: { ...(cadet?.payments || {}), ...(fee ? { fee: { ...(cadet?.payments?.fee || {}), status: 'paid' } } : {}), ...(subs ? { subs: { ...(cadet?.payments?.subs || {}), status: 'active' } } : {}) } }
}

// The page to move to once the Form 3822 itself is finished, skipping anything already paid.
export function stageAfterForms(cadet) {
  if (!feeIsPaid(cadet)) return 'fee'
  if (!subsIsActive(cadet)) return 'subs'
  return 'gift-aid'
}

// The page to move to once the joining fee is settled.
export function stageAfterFee(cadet) {
  return subsIsActive(cadet) ? 'gift-aid' : 'subs'
}

export function resolveStage(saved, cadet, previewStage = '') {
  if (previewStage) return previewStage
  const resume = resolveResume(saved, cadet)
  const stage = resume?.stage
  // Someone who already paid must not land back on a payment page.
  if (FEE_STAGES.includes(stage) && feeIsPaid(cadet)) return stageAfterFee(cadet)
  if (SUBS_STAGES.includes(stage) && subsIsActive(cadet)) return 'gift-aid'
  if (stage) return stage
  return cadet?.paperworkStatus === 'in_progress' ? 'welcome' : 'gate'
}

export function resolveFormData(saved, cadet, base) {
  const resume = resolveResume(saved, cadet)
  return {
    ...base,
    ...(resume?.formData || {}),
    ...(feeIsPaid(cadet) ? { 'payment.feeStatus': 'paid', 'payment.feePaymentId': cadet?.payments?.fee?.paymentId || '' } : {}),
    ...(subsIsActive(cadet) ? { 'payment.subsStatus': 'active', 'payment.mandateId': cadet?.payments?.subs?.mandateId || '', 'payment.subscriptionId': cadet?.payments?.subs?.subscriptionId || '' } : {}),
  }
}

// Server-side guard: never let a save replace a copy that is both further along and fuller.
// That combination only happens when a parent has been restarted, never by moving back a
// page, which keeps every answer.
export function isRegression(stored, incoming) {
  if (!stored) return false
  return stageRank(incoming?.stage) < stageRank(stored.stage) && answerCount(incoming) < answerCount(stored)
}
