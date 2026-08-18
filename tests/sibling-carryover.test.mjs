import assert from 'node:assert/strict'
import { test } from 'vitest'

// Mirrors sharedSiblingAnswers in JoiningJourney. Getting this wrong in either direction
// is bad: too little and a parent retypes everything for the second child, too much and
// one child's medical answers or a paid fee leak onto the other.
const SHARED_WITH_SIBLINGS = ['parent1.', 'parent2.', 'hasSecondContact']

function sharedSiblingAnswers(family, cadet) {
  const siblings = (family?.cadets || []).filter((item) => item.id !== cadet?.id)
  const source = siblings
    .map((item) => item.paperworkProgress)
    .filter(Boolean)
    .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))[0]
  if (!source?.formData) return {}
  return Object.fromEntries(
    Object.entries(source.formData).filter(([key]) => SHARED_WITH_SIBLINGS.some((prefix) => key.startsWith(prefix)))
  )
}

const twinA = {
  id: 'cadet-a',
  fullName: 'Alice',
  paperworkProgress: {
    updatedAt: '2026-08-18T10:00:00.000Z',
    formData: {
      'parent1.fullName': 'Jane Smith',
      'parent1.address.line1': '12 Example Street',
      'parent2.fullName': 'Sam Smith',
      hasSecondContact: true,
      'cadet.fullName': 'Alice',
      'cadet.dob': '2013-01-01',
      'health.conditions': 'asthma',
      'consent.photography': true,
      'signature.parent': 'Jane Smith',
      'payment.feeStatus': 'paid',
    },
  },
}
const twinB = { id: 'cadet-b', fullName: 'Bob' }
const family = { cadets: [twinA, twinB] }

test("carries the parent's own details onto the sibling's form", () => {
  const shared = sharedSiblingAnswers(family, twinB)
  assert.equal(shared['parent1.fullName'], 'Jane Smith')
  assert.equal(shared['parent1.address.line1'], '12 Example Street')
  assert.equal(shared['parent2.fullName'], 'Sam Smith')
  assert.equal(shared.hasSecondContact, true)
})

test('never carries anything that belongs to the other child', () => {
  const shared = sharedSiblingAnswers(family, twinB)
  for (const key of ['cadet.fullName', 'cadet.dob', 'health.conditions', 'consent.photography', 'signature.parent']) {
    assert.equal(shared[key], undefined, `${key} must not leak between siblings`)
  }
})

test('never carries a payment, so the second cadet still pays their own fee', () => {
  assert.equal(sharedSiblingAnswers(family, twinB)['payment.feeStatus'], undefined)
})

test('an only child gets nothing to carry', () => {
  assert.deepEqual(sharedSiblingAnswers({ cadets: [twinB] }, twinB), {})
})

test('does not read its own progress back as if it were a sibling', () => {
  assert.deepEqual(sharedSiblingAnswers({ cadets: [twinA] }, twinA), {})
})

test('takes the sibling who has got furthest when there are several', () => {
  const older = { id: 'cadet-c', paperworkProgress: { updatedAt: '2026-08-01T10:00:00.000Z', formData: { 'parent1.fullName': 'Stale Name' } } }
  const shared = sharedSiblingAnswers({ cadets: [older, twinA, twinB] }, twinB)
  assert.equal(shared['parent1.fullName'], 'Jane Smith')
})
