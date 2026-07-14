export function buildReference(formData) {
  const surname = (formData['signature.surname'] || formData['cadet.fullName'] || 'CADET').split(' ').pop()
  const forename = formData['signature.forename'] || ''
  const initial = forename ? forename[0].toUpperCase() : 'X'
  const now = new Date()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  return `${surname.toUpperCase()}-${initial}-${mm}${dd}`
}
