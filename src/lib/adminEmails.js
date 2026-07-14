const KEY = 'joining-portal-admin-emails'
const DEFAULT_EMAILS = ['recruiting@1330squadron.bader.mod.uk']

export function getAdminEmails() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return DEFAULT_EMAILS
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) && parsed.length ? parsed : DEFAULT_EMAILS
  } catch {
    return DEFAULT_EMAILS
  }
}

export function setAdminEmails(emails) {
  localStorage.setItem(KEY, JSON.stringify(emails.filter((e) => e.trim())))
}
