// Always derived from the cadet's own name, not whoever signed/is paying - parents and
// cadets don't always share a surname, and staff need to match payments to the cadet.
export function cadetNameParts(formData) {
  const parts = (formData['cadet.fullName'] || 'CADET').trim().split(/\s+/)
  const surname = parts.length > 1 ? parts[parts.length - 1] : parts[0]
  const forename = parts.length > 1 ? parts.slice(0, -1).join(' ') : ''
  return { surname, forename }
}

export function buildReference(formData) {
  const { surname, forename } = cadetNameParts(formData)
  const initial = forename ? forename[0].toUpperCase() : 'X'
  const now = new Date()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  return `${surname.toUpperCase()}-${initial}-${mm}${dd}`
}
