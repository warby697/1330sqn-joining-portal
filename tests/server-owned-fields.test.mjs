import assert from 'node:assert/strict'
import { test } from 'vitest'

// The merge rule the function actually runs, imported rather than copied: a hand copy of
// it here would pass while the real one was broken. The real one runs inside a Firestore
// transaction, so these tests cover the rule itself, which is the part that decides
// whether a stale browser can wipe a recorded payment.
import { keepServerOwnedFields } from '../src/lib/familyMerge.js'

const paidCadet = (extra = {}) => ({
  id: 'cadet-1',
  fullName: 'Jamie Smith',
  payments: { fee: { status: 'paid', paymentId: 'pi_123' }, subs: { status: 'active', mandateId: 'MD1' } },
  paperworkProgress: { stage: 'done', wizardIndex: 12, formData: { a: 1 } },
  ...extra,
})

test('a stale client finishing the paperwork cannot wipe recorded payments', () => {
  const stored = [paidCadet()]
  // The browser's copy predates both payments, which is exactly what markPaperworkComplete sent.
  const incoming = [{ id: 'cadet-1', fullName: 'Jamie Smith', paperworkStatus: 'completed', status: 'ready_to_start' }]
  const [result] = keepServerOwnedFields(incoming, stored)
  assert.deepEqual(result.payments, stored[0].payments)
  assert.deepEqual(result.paperworkProgress, stored[0].paperworkProgress)
  // and the legitimate part of the client's update still lands
  assert.equal(result.paperworkStatus, 'completed')
  assert.equal(result.status, 'ready_to_start')
})

test('a client cannot invent or downgrade a payment either', () => {
  const stored = [paidCadet()]
  const incoming = [{ id: 'cadet-1', payments: { fee: { status: 'unconfirmed' } } }]
  const [result] = keepServerOwnedFields(incoming, stored)
  assert.equal(result.payments.fee.status, 'paid')
})

test('a client cannot fabricate a payment on a cadet that has none', () => {
  const stored = [{ id: 'cadet-1', fullName: 'Jamie Smith' }]
  const incoming = [{ id: 'cadet-1', payments: { fee: { status: 'paid' } } }]
  const [result] = keepServerOwnedFields(incoming, stored)
  assert.equal(result.payments, undefined)
})

test('a genuinely new cadet is passed through untouched', () => {
  const incoming = [{ id: 'cadet-new', fullName: 'New Cadet' }]
  assert.deepEqual(keepServerOwnedFields(incoming, []), incoming)
})

test('other cadets in the family are matched individually', () => {
  const stored = [paidCadet(), { id: 'cadet-2', fullName: 'Sibling' }]
  const incoming = [{ id: 'cadet-2', fullName: 'Sibling', status: 'withdrawn' }, { id: 'cadet-1' }]
  const [sibling, first] = keepServerOwnedFields(incoming, stored)
  assert.equal(sibling.status, 'withdrawn')
  assert.equal(sibling.payments, undefined)
  assert.deepEqual(first.payments, stored[0].payments)
})

test('the joining-form sent flag cannot be cleared by a client, so the email stays once per cadet', () => {
  const stored = [{ id: 'cadet-1', joiningFormSentAt: '2026-08-21T16:50:00.000Z' }]
  const incoming = [{ id: 'cadet-1', paperworkStatus: 'completed' }]
  const [result] = keepServerOwnedFields(incoming, stored)
  assert.equal(result.joiningFormSentAt, '2026-08-21T16:50:00.000Z')
})

test('a stale tab cannot push a corrected start date back to the old one', () => {
  // The October 2026 cohort was given a start date of 1 April 2027 and had it corrected
  // by hand. Twelve of them were part way through the paperwork, so their tabs were still
  // holding the April date.
  const stale = [{ id: 'cadet-1', fullName: 'Jamie Smith', intendedStartDate: '2027-04-01T17:30:00.000Z' }]
  const stored = [{ id: 'cadet-1', fullName: 'Jamie Smith', intendedStartDate: '2026-10-12T17:30:00.000Z' }]
  assert.equal(keepServerOwnedFields(stale, stored)[0].intendedStartDate, '2026-10-12T17:30:00.000Z')
})

test('staff marking attendance can still set the start date in the first place', () => {
  // Unlike a payment, an absent stored value here means it has never been set, not that
  // the client invented it.
  const incoming = [{ id: 'cadet-1', fullName: 'Jamie Smith', intendedStartDate: '2026-10-12T17:30:00.000Z', eligibleIntakeDate: '2026-10-12T17:30:00.000Z' }]
  const stored = [{ id: 'cadet-1', fullName: 'Jamie Smith' }]
  const merged = keepServerOwnedFields(incoming, stored)[0]
  assert.equal(merged.intendedStartDate, '2026-10-12T17:30:00.000Z')
  assert.equal(merged.eligibleIntakeDate, '2026-10-12T17:30:00.000Z')
})
