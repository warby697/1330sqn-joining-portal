// Split a free-text full name into forename(s) + surname. Last whitespace-separated
// token is the surname; everything before it is the forename(s).
export function nameParts(full) {
  const parts = String(full || '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { forename: '', surname: '' }
  if (parts.length === 1) return { forename: '', surname: parts[0] }
  return { forename: parts.slice(0, -1).join(' '), surname: parts[parts.length - 1] }
}

// Always derived from the cadet's own name, not whoever signed/is paying - parents and
// cadets don't always share a surname, and staff need to match payments to the cadet.
export function cadetNameParts(formData) {
  return nameParts(formData['cadet.fullName'] || 'CADET')
}

// Payment/kit reference shown to parents and used to reconcile GoCardless payments:
// cadet SURNAME-Firstname (e.g. "SMITH-John"). Stable per cadet so repeat payments
// reconcile to the same cadet.
export function buildReference(formData) {
  const { surname, forename } = cadetNameParts(formData)
  const first = forename ? forename.split(/\s+/)[0] : ''
  const slug = (s) => String(s || '').replace(/[^A-Za-z-]/g, '')
  return [slug(surname).toUpperCase(), slug(first)].filter(Boolean).join('-') || 'CADET'
}
