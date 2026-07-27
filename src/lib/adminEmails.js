const KEY = 'joining-portal-admin-emails'
export const DEFAULT_EMAILS = ['1330squadronops@gmail.com']

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
  const cleaned = emails.filter((e) => e.trim())
  localStorage.setItem(KEY, JSON.stringify(cleaned))
  saveSharedSetting('adminEmails', cleaned).catch((error) => console.error('Could not sync recipient addresses:', error))
}

export function hydrateAdminEmails(emails) {
  if (Array.isArray(emails) && emails.length) localStorage.setItem(KEY, JSON.stringify(emails))
}
import { saveSharedSetting } from './sharedRecruitmentStore.js'
