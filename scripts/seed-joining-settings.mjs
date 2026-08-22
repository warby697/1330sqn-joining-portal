import { DEFAULT_EMAILS } from '../src/lib/adminEmails.js'
import { DEFAULT_EMAIL_TEMPLATES, DEFAULT_KEY_DATES } from '../src/lib/communicationSettings.js'

const baseUrl = process.env.PORTAL_BASE_URL || 'http://localhost:5181'
const pin = process.env.STAFF_PIN
if (!pin) throw new Error('Set STAFF_PIN before running this seed script.')
const settings = { emailTemplates: DEFAULT_EMAIL_TEMPLATES, keyDates: DEFAULT_KEY_DATES, adminEmails: DEFAULT_EMAILS }

for (const [key, value] of Object.entries(settings)) {
  const response = await fetch(`${baseUrl}/.netlify/functions/joining-data`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'save-setting', key, value, pin }),
  })
  if (!response.ok) throw new Error(`${key}: ${await response.text()}`)
}

console.log('Shared joining settings seeded.')
