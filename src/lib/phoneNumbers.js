// Comparing two UK mobile numbers that a parent has typed by hand.
//
// Cadets kept being given their parent's mobile on the Form 3822, which leaves them unable
// to subscribe to the squadron's SMS updates. To catch that we have to treat 07988 511060,
// 07988511060, +447988511060 and 00447988511060 as the same number.

const digitsOnly = (value) => String(value || '').replace(/[^0-9]/g, '')

// Reduces a UK number to its national form, so the same phone always compares equal
// however it was typed. Anything that is not a UK number is left as its digits, which is
// still a fair comparison between two numbers entered the same way.
export function normalisePhone(value) {
  let digits = digitsOnly(value)
  if (digits.startsWith('0044')) digits = digits.slice(4)
  else if (digits.startsWith('44') && digits.length > 10) digits = digits.slice(2)
  else if (digits.startsWith('0')) return digits
  return digits ? `0${digits}` : ''
}

export function samePhone(first, second) {
  const left = normalisePhone(first)
  const right = normalisePhone(second)
  // Too short to be a real number, so do not accuse anyone of reusing one.
  if (left.length < 7 || right.length < 7) return false
  return left === right
}

// Which parent number, if any, the cadet's number duplicates. parent1.mobile is prefilled
// from the enquiry, so this catches the common case on the cadet's own page, before the
// next of kin section has even been reached.
export const PARENT_PHONE_FIELDS = ['parent1.mobile', 'parent2.mobile']

export function clashingParentPhone(formData = {}, cadetField = 'cadet.mobile') {
  const cadetNumber = formData[cadetField]
  if (!String(cadetNumber || '').trim()) return ''
  return PARENT_PHONE_FIELDS.find((field) => samePhone(cadetNumber, formData[field])) || ''
}
