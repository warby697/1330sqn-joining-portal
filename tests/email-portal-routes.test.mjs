import assert from 'node:assert/strict'
import { test } from 'vitest'

import { emailPortalUrl } from '../src/lib/communicationSettings.js'

const details = { appUrl: 'https://joining.example/', familyId: 'family-1', accessToken: 'secure-token' }

test('paperwork emails open the joining-code page', () => {
  for (const templateId of ['joining_code', 'paperwork_reminder', 'code_expiry_warning']) {
    assert.equal(emailPortalUrl(templateId, details), 'https://joining.example/#/join')
  }
})

test('booking and reminder emails open the secure family record', () => {
  for (const templateId of ['open_night_confirmation', 'open_night_reminder', 'open_night_final_reminder', 'booking_nudge', 'nonattendance', 'start_reminder_7_days', 'start_reminder_24_hours']) {
    assert.equal(emailPortalUrl(templateId, details), 'https://joining.example/#/family/family-1/secure-token')
  }
})

test('staff and withdrawal emails use their intended destinations', () => {
  assert.equal(emailPortalUrl('missed_intake_staff_alert', details), 'https://joining.example/#/staff')
  assert.equal(emailPortalUrl('withdrawal_confirmation', details), 'https://joining.example/#/')
})
