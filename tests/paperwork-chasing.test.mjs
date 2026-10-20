import assert from 'node:assert/strict'
import { test } from 'vitest'

import { squadronHasPaperwork, joiningSettled, outstandingJoiningItems } from '../src/lib/paperworkComplete.js'

// Seventeen families were emailed to say their paperwork was outstanding when the squadron
// already had it. The reminder asked whether paperworkStatus was 'completed', which only
// happens when the parent presses the final button behind three tick boxes. Twelve of them
// had reached that last page with the form emailed, the fee paid and the Direct Debit live,
// and simply closed the tab.
const finishedButNeverPressedComplete = {
  fullName: 'James Peter Edwards',
  paperworkStatus: 'in_progress',
  joiningFormSentAt: '2026-10-09T18:12:00.000Z',
  payments: { fee: { status: 'paid' }, subs: { status: 'active' } },
  paperworkProgress: { stage: 'done' },
}

test('a parent who finished everything but the last button is not chased', () => {
  assert.equal(squadronHasPaperwork(finishedButNeverPressedComplete), true)
  assert.equal(joiningSettled(finishedButNeverPressedComplete), true)
  assert.deepEqual(outstandingJoiningItems(finishedButNeverPressedComplete), [])
})

test('pressing the final button still counts, obviously', () => {
  assert.equal(joiningSettled({ paperworkStatus: 'completed' }), true)
})

test('someone who really has done nothing is still chased', () => {
  const nothing = { paperworkStatus: 'in_progress', payments: {} }
  assert.equal(joiningSettled(nothing), false)
  assert.deepEqual(outstandingJoiningItems(nothing), [
    'the Form 3822 enrolment form',
    'the joining fee',
    'the monthly Direct Debit',
  ])
})

test('the fee alone is not enough to stop a chase', () => {
  // Thomas Forshaw: fee paid, form in, no Direct Debit. He genuinely needed chasing.
  const feeOnly = {
    paperworkStatus: 'in_progress',
    joiningFormSentAt: '2026-10-11T16:24:00.000Z',
    payments: { fee: { status: 'paid' } },
  }
  assert.equal(squadronHasPaperwork(feeOnly), false)
  assert.equal(joiningSettled(feeOnly), false)
  assert.deepEqual(outstandingJoiningItems(feeOnly), ['the monthly Direct Debit'])
})

test('an unconfirmed Direct Debit does not count as set up', () => {
  // "Continue anyway" leaves subs unconfirmed. The money is not flowing, so chase.
  const unconfirmed = {
    paperworkStatus: 'in_progress',
    joiningFormSentAt: '2026-10-11T16:24:00.000Z',
    payments: { fee: { status: 'paid' }, subs: { status: 'unconfirmed' } },
  }
  assert.equal(joiningSettled(unconfirmed), false)
  assert.deepEqual(outstandingJoiningItems(unconfirmed), ['the monthly Direct Debit'])
})

test('paid up but the form never reached the squadron is still chased', () => {
  const noForm = {
    paperworkStatus: 'in_progress',
    payments: { fee: { status: 'paid' }, subs: { status: 'active' } },
  }
  assert.equal(squadronHasPaperwork(noForm), false)
  assert.deepEqual(outstandingJoiningItems(noForm), ['the Form 3822 enrolment form'])
})

test('a missing or empty record never counts as settled', () => {
  assert.equal(joiningSettled(undefined), false)
  assert.equal(joiningSettled(null), false)
  assert.equal(joiningSettled({}), false)
  assert.equal(squadronHasPaperwork({}), false)
})

test('reaching the last page on its own proves nothing', () => {
  // stage 'done' only means they saw the screen, not that the money or form went through.
  const lookedAtIt = { paperworkStatus: 'in_progress', paperworkProgress: { stage: 'done' }, payments: {} }
  assert.equal(joiningSettled(lookedAtIt), false)
})

test('a fully enrolled cadet has not missed their own intake', async () => {
  const { hasMissedIntake } = await import('../src/lib/recruitmentStore.js')
  // 26 October 2026: a fortnight after the 12 October start. Every enrolled cadet was
  // about to be reported to staff as having missed the intake they were sitting in.
  const settled = { ...finishedButNeverPressedComplete, status: 'ready_to_start', intendedStartDate: '2026-10-12T17:30:00.000Z' }
  assert.equal(hasMissedIntake(settled, new Date('2026-10-26T20:00:00Z')), false)
})

test('someone past their start date with the Direct Debit missing is still flagged', async () => {
  const { hasMissedIntake } = await import('../src/lib/recruitmentStore.js')
  const stuck = {
    status: 'paperwork_in_progress',
    intendedStartDate: '2026-10-12T17:30:00.000Z',
    joiningFormSentAt: '2026-10-11T16:24:00.000Z',
    payments: { fee: { status: 'paid' } },
  }
  assert.equal(hasMissedIntake(stuck, new Date('2026-10-26T20:00:00Z')), true)
})
