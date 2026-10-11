// Which cadet fields a browser is not allowed to overwrite.
//
// sync-family replaces the whole family document, so anything a stale tab is holding
// gets written back over the top. Shared by the function and its tests so the rule the
// tests check is the rule that actually runs.

// Written only by the server, from save-paperwork-progress. A browser can hold a copy of the
// family that predates the last payment, and sync-family replaces the whole document, so
// without this a stale client finishing the paperwork silently wipes the record of money
// already taken. Same clobber that has bitten the squadron records before.
export const SERVER_OWNED_CADET_FIELDS = ['payments', 'paperworkProgress', 'joiningFormSentAt']

// Written once, when the Open Night attendance is marked, and never changed by a browser
// afterwards. The start date decides the first Direct Debit and what the joining
// confirmation email tells the parent, and 26 of these had to be corrected by hand after
// the October intake rolled over. A parent part way through the paperwork holds the old
// value in their tab, so without this the correction gets pushed straight back.
export const WRITE_ONCE_CADET_FIELDS = ['intendedStartDate', 'eligibleIntakeDate']

export const keepServerOwnedFields = (incomingCadets, storedCadets) => {
  const stored = new Map((storedCadets || []).map((cadet) => [cadet.id, cadet]))
  return (incomingCadets || []).map((cadet) => {
    const previous = stored.get(cadet.id)
    if (!previous) return cadet
    const merged = { ...cadet }
    for (const field of SERVER_OWNED_CADET_FIELDS) {
      if (previous[field] === undefined) delete merged[field]
      else merged[field] = previous[field]
    }
    // Unlike the above, an absent stored value lets the incoming one through, so staff
    // marking attendance can still set the start date in the first place.
    for (const field of WRITE_ONCE_CADET_FIELDS) {
      if (previous[field] !== undefined) merged[field] = previous[field]
    }
    return merged
  })
}
