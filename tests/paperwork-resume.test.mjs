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

// --- 21 Sep 2026: two families lost their paperwork after paying ---
import { isRegression, resolveResume, stageAfterFee, stageAfterForms, withFormPayments } from '../src/lib/paperworkResume.js'

const paidAtGiftAid = () => ({
  paperworkStatus: 'in_progress',
  payments: { fee: { status: 'paid', paymentId: 'pi_1' }, subs: { status: 'active', mandateId: 'MD1', subscriptionId: 'SB1' } },
  paperworkProgress: { stage: 'gift-aid', wizardIndex: 12, formData: Object.fromEntries(Array.from({ length: 72 }, (_, i) => [`f${i}`, i])) },
})

test('re-entering with email and code no longer restarts someone who reached Gift Aid', () => {
  // What the code-redeem page used to put in the tab: a bare marker, no answers.
  const stub = { stage: 'welcome' }
  const cadet = paidAtGiftAid()
  assert.equal(resolveStage(stub, cadet), 'gift-aid')
  assert.equal(Object.keys(resolveResume(stub, cadet).formData).length, 72)
})

test('a tab holding only the access token defers to the saved record', () => {
  const cadet = paidAtGiftAid()
  assert.equal(resolveStage({ familyToken: 'tok' }, cadet), 'gift-aid')
})

test('the fuller copy wins when both copies are at the same stage', () => {
  const cadet = { paperworkProgress: { stage: 'wizard', formData: { a: 1, b: 2, c: 3 } } }
  assert.deepEqual(resolveResume({ stage: 'wizard', formData: { a: 1 } }, cadet).formData, { a: 1, b: 2, c: 3 })
})

test('finishing the form skips straight past payments already made', () => {
  assert.equal(stageAfterForms({}), 'fee')
  assert.equal(stageAfterForms({ payments: { fee: { status: 'paid' } } }), 'subs')
  assert.equal(stageAfterForms(paidAtGiftAid()), 'gift-aid')
  assert.equal(stageAfterFee(paidAtGiftAid()), 'gift-aid')
  assert.equal(stageAfterFee({}), 'subs')
})

test('a payment made during this visit counts before it reaches the loaded record', () => {
  assert.equal(stageAfterForms(withFormPayments({}, { 'payment.feeStatus': 'paid' })), 'subs')
  assert.equal(stageAfterForms(withFormPayments({}, { 'payment.feeStatus': 'paid', 'payment.subsStatus': 'active' })), 'gift-aid')
  // "Continue anyway" is not a payment, so they are still asked.
  assert.equal(stageAfterForms(withFormPayments({}, { 'payment.feeStatus': 'unconfirmed' })), 'fee')
})

test('landing on the Direct Debit page after it is set up moves on to Gift Aid', () => {
  const cadet = { ...paidAtGiftAid(), paperworkProgress: { stage: 'subs', formData: {} } }
  assert.equal(resolveStage(null, cadet), 'gift-aid')
})

test('the server refuses a restarted form over one that got further', () => {
  const stored = paidAtGiftAid().paperworkProgress
  assert.equal(isRegression(stored, { stage: 'wizard', formData: { a: 1 } }), true)
  // Going back a page keeps every answer, so it is allowed.
  assert.equal(isRegression(stored, { stage: 'subs', formData: stored.formData }), false)
  assert.equal(isRegression(stored, { stage: 'done', formData: { ...stored.formData, extra: 1 } }), false)
  assert.equal(isRegression(null, { stage: 'wizard', formData: {} }), false)
})
