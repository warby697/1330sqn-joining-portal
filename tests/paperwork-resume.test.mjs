import assert from 'node:assert/strict'
import { test } from 'vitest'

import { feeIsPaid, resolveFormData, resolveStage } from '../src/lib/paperworkResume.js'

const base = { 'cadet.fullName': 'Jamie Smith', 'parent1.primaryEmail': 'alex@example.com' }
const unlocked = { paperworkStatus: 'in_progress' }

test('a fresh unlocked cadet starts at the welcome screen', () => {
  assert.equal(resolveStage(null, unlocked), 'welcome')
})

test('a locked cadet still has to pass the joining-code gate', () => {
  assert.equal(resolveStage(null, { paperworkStatus: 'locked' }), 'gate')
})

test('resumes from the record when this tab has nothing saved', () => {
  const cadet = { ...unlocked, paperworkProgress: { stage: 'wizard', wizardIndex: 4, formData: { 'cadet.dob': '2013-04-12' } } }
  assert.equal(resolveStage(null, cadet), 'wizard')
  assert.equal(resolveFormData(null, cadet, base)['cadet.dob'], '2013-04-12')
})

test('the tab copy wins over the record, being the more recent of the two', () => {
  const saved = { stage: 'gift-aid', wizardIndex: 9, formData: { 'cadet.dob': '2014-01-01' } }
  const cadet = { ...unlocked, paperworkProgress: { stage: 'wizard', wizardIndex: 2, formData: { 'cadet.dob': '2013-04-12' } } }
  assert.equal(resolveStage(saved, cadet), 'gift-aid')
  assert.equal(resolveFormData(saved, cadet, base)['cadet.dob'], '2014-01-01')
})

test('someone who has already paid is never sent back to the fee page', () => {
  const cadet = {
    ...unlocked,
    payments: { fee: { status: 'paid', paymentId: 'pi_123' } },
    paperworkProgress: { stage: 'fee', wizardIndex: 8, formData: {} },
  }
  assert.equal(feeIsPaid(cadet), true)
  assert.equal(resolveStage(null, cadet), 'subs')
  // and the same if they were stranded mid-confirmation
  cadet.paperworkProgress.stage = 'fee-confirming'
  assert.equal(resolveStage(null, cadet), 'subs')
})

test('a recorded payment is carried back into the form data', () => {
  const cadet = { ...unlocked, payments: { fee: { status: 'paid', paymentId: 'pi_123' } } }
  const data = resolveFormData(null, cadet, base)
  assert.equal(data['payment.feeStatus'], 'paid')
  assert.equal(data['payment.feePaymentId'], 'pi_123')
  assert.equal(data['cadet.fullName'], 'Jamie Smith')
})

test('an unpaid cadet is left alone and still reaches the fee page', () => {
  const cadet = { ...unlocked, paperworkProgress: { stage: 'fee', wizardIndex: 8, formData: {} } }
  assert.equal(feeIsPaid(cadet), false)
  assert.equal(resolveStage(null, cadet), 'fee')
  assert.equal(resolveFormData(null, cadet, base)['payment.feeStatus'], undefined)
})

test('the preview stage overrides everything, so the dev routes still work', () => {
  const cadet = { ...unlocked, payments: { fee: { status: 'paid' } }, paperworkProgress: { stage: 'subs' } }
  assert.equal(resolveStage(null, cadet, 'fee'), 'fee')
})
