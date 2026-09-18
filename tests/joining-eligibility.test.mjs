import assert from 'node:assert/strict'
import { test } from 'vitest'

import { MIN_JOINING_AGE, MIN_JOINING_SCHOOL_YEAR, meetsJoiningRequirements } from '../src/lib/recruitmentStore.js'

// The rule is 12 years old AND Year 8 or above. It used to be written as "13 or Year 8",
// so an eleven year old in Year 7 counted as eligible, booked an Open Night, attended, and
// had to be told on the night that he could not join.
const on = (iso) => new Date(`${iso}T19:15:00`)
// schoolYearRecordedAcademicYear pins the year the school year was captured in, so the
// figure is not quietly aged on by the September rollover during these checks.
const cadet = (dob, schoolYear) => ({ dob, schoolYear, schoolYearRecordedAcademicYear: 2026 })

test('the thresholds are 12 and Year 8', () => {
  assert.equal(MIN_JOINING_AGE, 12)
  assert.equal(MIN_JOINING_SCHOOL_YEAR, 8)
})

test('Archie: eleven and in Year 7 is not eligible', () => {
  assert.equal(meetsJoiningRequirements(cadet('2014-10-13', 7), on('2026-09-17')), false)
})

test('old enough but too low a school year is still not eligible', () => {
  // This is the case the old "13 or Year 8" rule got wrong in the other direction.
  assert.equal(meetsJoiningRequirements(cadet('2013-01-01', 7), on('2026-09-17')), false)
})

test('in Year 8 but not yet 12 is not eligible', () => {
  assert.equal(meetsJoiningRequirements(cadet('2014-10-13', 8), on('2026-09-17')), false)
})

test('twelve and in Year 8 is eligible', () => {
  assert.equal(meetsJoiningRequirements(cadet('2014-09-01', 8), on('2026-09-17')), true)
})

test('eligibility is judged on the date they would start, not today', () => {
  const archie = cadet('2014-10-13', 8)
  assert.equal(meetsJoiningRequirements(archie, on('2026-10-01')), false, 'still 11 on 1 October')
  assert.equal(meetsJoiningRequirements(archie, on('2026-10-13')), true, 'turns 12 on 13 October')
})

test('missing details never count as eligible', () => {
  assert.equal(meetsJoiningRequirements({ dob: '', schoolYear: null }), false)
  assert.equal(meetsJoiningRequirements(null), false)
})
