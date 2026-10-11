// When the first Direct Debit should be collected.
//
// Subs run on the 1st of the month, which is what every mandate on the squadron is set
// to. The rule is the 1st of the month the cadet starts parading in, or the next 1st if
// that has already gone by. Nothing else: the date the cadet starts is not the date the
// money moves, and conflating the two sent sixteen first collections to April 2027.
//
// Worked out on the server so a client holding an out of date start date cannot schedule
// a collection for the wrong month.

export const COLLECTION_DAY_OF_MONTH = 1

// BACS needs a few working days of notice. The same week of headroom the subscription
// code has always used, so a collection date is never set too late to be honoured.
const MIN_LEAD_DAYS = 7

// A cadet never waits longer than this to start, because Open Nights run a few weeks
// ahead of an intake, not half a year. A start date further out than this is a stale
// record rather than a real wait, so it is not allowed to hold the money back: the
// squadron would far rather collect and refund a month than find out in April that
// nobody has paid since October.
const MAX_LEAD_MONTHS = 4

const atMidday = (year, month) => new Date(year, month, COLLECTION_DAY_OF_MONTH, 12)

export function firstCollectionDate(startDate, from = new Date()) {
  const start = startDate ? new Date(startDate) : null
  const latest = atMidday(from.getFullYear(), from.getMonth() + MAX_LEAD_MONTHS)
  const credible = start && !Number.isNaN(start.getTime()) && start > from && start < latest
  const starts = credible ? start : from
  const earliest = new Date(from.getTime() + MIN_LEAD_DAYS * 24 * 60 * 60 * 1000)
  let month = starts.getMonth()
  let candidate = atMidday(starts.getFullYear(), month)
  // Rolling the month index past 11 is fine: the Date constructor carries it into the
  // next year.
  while (candidate < earliest) {
    month += 1
    candidate = atMidday(starts.getFullYear(), month)
  }
  return `${candidate.getFullYear()}-${String(candidate.getMonth() + 1).padStart(2, '0')}-${String(COLLECTION_DAY_OF_MONTH).padStart(2, '0')}`
}
