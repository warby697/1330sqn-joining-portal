import assert from 'node:assert/strict'
import { test } from 'vitest'

import { firstCollectionDate, COLLECTION_DAY_OF_MONTH } from '../src/lib/subscriptionSchedule.js'
import { getNextEligibleIntake, getNextIntake } from '../src/lib/recruitmentStore.js'

// The Open Night on 8 October 2026 fell a week after the 1 October intake. Both the start
// date and the first Direct Debit were worked out from "the next intake", which by then
// meant April 2027: 26 cadets were given a start date six months away and the sixteen who
// had already paid had their first collection set for 1 April 2027.
const at = (iso) => new Date(`${iso}T19:15:00`)
const day = (date) => date.toLocaleDateString('en-CA')
const eligible = { dob: '2013-05-04', schoolYear: 9, schoolYearRecordedAcademicYear: 2026 }

test('collections land on the 1st', () => {
  assert.equal(COLLECTION_DAY_OF_MONTH, 1)
})

test('the October cohort collects on 1 November, not 1 April', () => {
  assert.equal(firstCollectionDate('2026-10-12', at('2026-10-11')), '2026-11-01')
})

test('a start date left over from the closed intake is ignored', () => {
  // The exact record the sixteen were carrying: finishing the paperwork on 10 October
  // with a start date of 1 April 2027 still collects from November.
  assert.equal(firstCollectionDate('2027-04-01', at('2026-10-10')), '2026-11-01')
})

test('the September cohort is unchanged: start 1 October, collect 1 October', () => {
  assert.equal(firstCollectionDate('2026-10-01', at('2026-09-18')), '2026-10-01')
})

test('a cadet starting mid month collects from the 1st of that month if there is time', () => {
  assert.equal(firstCollectionDate('2026-11-16', at('2026-10-20')), '2026-11-01')
})

test('the 1st rolls on when it is too close for BACS', () => {
  // Paperwork finished on 29 October cannot be collected on 1 November.
  assert.equal(firstCollectionDate('2026-10-29', at('2026-10-29')), '2026-12-01')
})

test('no start date still produces a real collection date', () => {
  assert.equal(firstCollectionDate('', at('2026-10-11')), '2026-11-01')
  assert.equal(firstCollectionDate(null, at('2026-10-11')), '2026-11-01')
  assert.equal(firstCollectionDate('not a date', at('2026-10-11')), '2026-11-01')
})

test('the December collection carries into the new year', () => {
  assert.equal(firstCollectionDate('2026-12-28', at('2026-12-28')), '2027-02-01')
})

test('an intake under way still counts, so nobody waits six months', () => {
  // 11 October 2026: the intake opened on the 1st. The next start is days away, not April.
  const start = getNextEligibleIntake(eligible, at('2026-10-11'))
  assert.ok(start < at('2026-11-01'), `expected an October start, got ${start.toISOString()}`)
})

test('the Open Night cohort starts on a parade night, never in the past', () => {
  const openNight = at('2026-10-08')
  const start = getNextEligibleIntake(eligible, openNight)
  assert.ok(day(start) >= day(openNight), `start ${day(start)} is before the Open Night`)
  assert.ok(start < at('2026-11-01'), `expected an October start, got ${start.toISOString()}`)
  assert.ok([1, 4].includes(start.getDay()), `start ${start.toISOString()} is not a parade night`)
})

test('a direct joiner gets the same near start date', () => {
  assert.ok(getNextIntake(at('2026-10-11')) < at('2026-11-01'))
})

test('an intake stops counting once the recruit course has run', () => {
  // Far enough past 1 October and the next real intake is April, as it should be.
  const start = getNextIntake(at('2026-12-20'))
  assert.ok(day(start) >= '2027-04-01', `expected April, got ${day(start)}`)
})
