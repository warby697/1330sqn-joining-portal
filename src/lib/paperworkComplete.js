// Whether the squadron actually holds a cadet's joining paperwork.
//
// paperworkStatus only reaches 'completed' when the parent presses the final button, and
// that button needs three tick boxes (both Signal groups and the uniform). Plenty of
// parents finish the form, pay the fee and set up the Direct Debit, then close the page on
// that last screen. Nothing is missing as far as the squadron is concerned: the Form 3822
// has already been emailed over and the money is set up.
//
// Chasing those parents for paperwork we are holding is what this exists to stop. It
// happened to seventeen families before this was separated out.
//
// The three tests are the three things the squadron needs, and none of them can be faked
// by a browser: joiningFormSentAt is stamped by the function that emails the PDF, and both
// payment statuses are written from the payment provider's own confirmation.
export function squadronHasPaperwork(cadet) {
  return Boolean(cadet?.joiningFormSentAt)
    && cadet?.payments?.fee?.status === 'paid'
    && cadet?.payments?.subs?.status === 'active'
}

// Everything done, whether or not the parent pressed the final button. Use this to decide
// what to tell a parent; use paperworkStatus itself only for staff-facing progress.
export function joiningSettled(cadet) {
  return cadet?.paperworkStatus === 'completed' || squadronHasPaperwork(cadet)
}

// What is genuinely still outstanding, so a reminder can name it instead of implying the
// parent has done nothing.
export function outstandingJoiningItems(cadet) {
  const missing = []
  if (!cadet?.joiningFormSentAt) missing.push('the Form 3822 enrolment form')
  if (cadet?.payments?.fee?.status !== 'paid') missing.push('the joining fee')
  if (cadet?.payments?.subs?.status !== 'active') missing.push('the monthly Direct Debit')
  return missing
}
