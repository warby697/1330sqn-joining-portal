// Works out where a parent should pick up the joining paperwork.
//
// sessionStorage is per tab, so it is empty whenever they reopen the emailed link, switch
// device, or come back the next day. The record carries a mirrored copy so they resume
// instead of starting the Form 3822 again.
//
// The payment guard matters most: the money has already left their account, so a lost tab
// must never put them back on the fee page.

export const FEE_STAGES = ['fee', 'fee-confirming']

export function feeIsPaid(cadet) {
  return cadet?.payments?.fee?.status === 'paid'
}

export function resolveResume(saved, cadet) {
  // The tab's own copy is the most recent, so it wins over the mirrored one.
  return saved || cadet?.paperworkProgress || null
}

export function resolveStage(saved, cadet, previewStage = '') {
  if (previewStage) return previewStage
  const resume = resolveResume(saved, cadet)
  // Someone who already paid must not land back on the fee page.
  if (feeIsPaid(cadet) && FEE_STAGES.includes(resume?.stage)) return 'subs'
  if (resume?.stage) return resume.stage
  return cadet?.paperworkStatus === 'in_progress' ? 'welcome' : 'gate'
}

export function resolveFormData(saved, cadet, base) {
  const resume = resolveResume(saved, cadet)
  return {
    ...base,
    ...(resume?.formData || {}),
    ...(feeIsPaid(cadet)
      ? { 'payment.feeStatus': 'paid', 'payment.feePaymentId': cadet?.payments?.fee?.paymentId || '' }
      : {}),
  }
}
