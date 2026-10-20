import assert from 'node:assert/strict'
import { test, beforeEach, afterEach } from 'vitest'

import { getNextIntake, getNextEligibleIntake, liveOpenNights, allOpenNights } from '../src/lib/recruitmentStore.js'
import { DEFAULT_KEY_DATES, saveKeyDates } from '../src/lib/communicationSettings.js'

// October 2026: the recruit course formed up and the squadron closed enrolment. Until then
// an intake stayed open for ten weeks so an Open Night held just after it still counted,
// which is right for people already coming but wrong for somebody enquiring afterwards.
const at = (iso) => new Date(`${iso}T19:15:00`)
const day = (date) => date.toLocaleDateString('en-CA')
const eligible = { dob: '2013-05-04', schoolYear: 9, schoolYearRecordedAcademicYear: 2026 }

const setDates = (patch) => saveKeyDates({ ...DEFAULT_KEY_DATES, ...patch })

beforeEach(() => setDates({}))
afterEach(() => { try { localStorage.clear() } catch { /* no storage in this environment */ } })

test('with enrolment open, an intake under way still accepts, which is the grace window', () => {
  setDates({ intakeClosedOn: '' })
  assert.ok(day(getNextIntake(at('2026-10-20'))) < '2026-11-01')
})

test('closing October sends a new enquiry to April', () => {
  setDates({ intakeClosedOn: '2026-10-20' })
  assert.equal(day(getNextIntake(at('2026-10-20'))), '2027-04-01')
})

test('closing on the day itself still closes it, not the day after', () => {
  // The close date is inclusive, so "closed up to and including the 20th" means the 20th.
  setDates({ intakeClosedOn: '2026-10-20' })
  assert.equal(day(getNextIntake(at('2026-10-20T23:00:00'.slice(0, 10)))), '2027-04-01')
})

test('an eligible cadet enquiring now is also told April', () => {
  setDates({ intakeClosedOn: '2026-10-20' })
  assert.equal(day(getNextEligibleIntake(eligible, at('2026-10-20'))), '2027-04-01')
})

test('closing October does not swallow April as well', () => {
  setDates({ intakeClosedOn: '2026-10-20' })
  assert.equal(day(getNextIntake(at('2027-02-01'))), '2027-04-01')
})

test('an old close date does not block later intakes', () => {
  // Left over from the last time enrolment was closed, it must not keep biting.
  setDates({ intakeClosedOn: '2026-04-05' })
  // The October intake is in the past, so the grace window starts them on the next parade
  // night rather than a date that has gone.
  assert.ok(day(getNextIntake(at('2026-10-20'))) < '2026-11-01')
})

test('a blank or nonsense close date falls back to the normal rule', () => {
  setDates({ intakeClosedOn: '' })
  const open = day(getNextIntake(at('2026-10-20')))
  setDates({ intakeClosedOn: undefined })
  assert.equal(day(getNextIntake(at('2026-10-20'))), open)
})

test('archived Open Nights stay findable but drop out of the live list', () => {
  setDates({ openNights: ['2026-09-17', '2026-10-08', '2027-03-18'], archivedOpenNights: ['2026-09-17', '2026-10-08'] })
  const live = liveOpenNights()
  assert.deepEqual(live.map((night) => night.id), ['open-night-2027-03-18'])
  // Still present overall, or past attendance and rosters would stop resolving by id.
  assert.ok(allOpenNights().some((night) => night.id === 'open-night-2026-10-08' && night.archived))
})

test('with nothing archived every night is live', () => {
  setDates({ openNights: ['2027-03-18', '2027-03-25'], archivedOpenNights: [] })
  assert.equal(liveOpenNights().length, 2)
})
