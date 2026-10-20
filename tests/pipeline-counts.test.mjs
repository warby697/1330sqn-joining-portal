import assert from 'node:assert/strict'
import { test } from 'vitest'

import { pipelineCounts } from '../src/lib/pipelineCounts.js'

// The dashboard used to lead with the hand-set 'joined' status, which read 2 while 41
// cadets had the form in and both payments running. These fixtures mirror the spread the
// squadron actually had on 20 October 2026 after the October window closed.
const guardian = { verifiedAt: '2026-09-01T00:00:00.000Z' }

const enrolledCadet = (id) => ({
  id,
  status: 'ready_to_start',
  paperworkStatus: 'in_progress',
  joiningFormSentAt: '2026-10-09T00:00:00.000Z',
  payments: { fee: { status: 'paid' }, subs: { status: 'active' } },
})
const midPaperwork = (id) => ({ id, status: 'paperwork_in_progress', paperworkStatus: 'in_progress', payments: { fee: { status: 'paid' } } })
const notStarted = (id) => ({ id, status: 'paperwork_available', paperworkStatus: 'available', payments: {} })
const lockedBooking = (id) => ({ id, status: 'open_night_booked', paperworkStatus: 'locked', openNightId: 'open-night-2027-03-18', payments: {} })
const waitingForLater = (id) => ({ id, status: 'future_waiting', paperworkStatus: 'locked', payments: {} })
const archived = (id, reason) => ({ id, status: 'withdrawn', withdrawalReason: reason, paperworkStatus: 'locked', payments: {} })

const families = [
  { id: 'f1', guardian, cadets: [enrolledCadet('c1'), enrolledCadet('c2')] },
  { id: 'f2', guardian, cadets: [midPaperwork('c3')] },
  { id: 'f3', guardian, cadets: [notStarted('c4')] },
  { id: 'f4', guardian, cadets: [lockedBooking('c5')] },
  { id: 'f5', guardian, cadets: [waitingForLater('c6')] },
  { id: 'f6', guardian, cadets: [archived('c7', 'no_show'), archived('c8', 'duplicate')] },
  { id: 'f7', guardian: { verifiedAt: null }, cadets: [notStarted('c9')] },
]

test('enrolled counts the cadets the squadron actually holds everything for', () => {
  assert.equal(pipelineCounts(families).enrolled, 2)
})

test('an enrolled cadet who never pressed the final button still counts as enrolled', () => {
  // This is the whole point: paperworkStatus is 'in_progress' on both of them.
  const only = [{ id: 'f', guardian, cadets: [enrolledCadet('c')] }]
  assert.equal(pipelineCounts(only).enrolled, 1)
  assert.equal(pipelineCounts(only).active, 0)
})

test('archived enquiries leave the live figures but count as did not join', () => {
  const counts = pipelineCounts(families)
  assert.equal(counts.withdrawn, 2)
  assert.equal(counts.total, 9)
  // The two archived cadets are not in enrolled, active, booked or waiting.
  assert.equal(counts.enrolled + counts.active, 7)
})

test('paperwork outstanding means started but not finished, not everyone unfinished', () => {
  // Someone still locked out has not begun, so they are not "outstanding paperwork".
  const counts = pipelineCounts(families)
  assert.equal(counts.inProgress, 3)
})

test('cadets waiting for a later intake are counted separately, not as lost', () => {
  const counts = pipelineCounts(families)
  assert.equal(counts.waiting, 1)
  assert.equal(counts.withdrawn, 2)
})

test('open nights booked only counts people who have not been yet', () => {
  assert.equal(pipelineCounts(families).booked, 1)
})

test('awaiting parent counts families that never verified', () => {
  assert.equal(pipelineCounts(families).awaiting, 1)
})

test('missed intake is passed in, since it depends on the live key dates', () => {
  assert.equal(pipelineCounts(families).missed, 0)
  assert.equal(pipelineCounts(families, { hasMissedIntake: (cadet) => cadet.id === 'c3' }).missed, 1)
})

test('no families at all does not throw', () => {
  const counts = pipelineCounts([])
  assert.equal(counts.total, 0)
  assert.equal(counts.enrolled, 0)
  assert.equal(pipelineCounts().total, 0)
})

test('a family with no cadets array does not throw', () => {
  assert.equal(pipelineCounts([{ id: 'f', guardian }]).total, 0)
})
