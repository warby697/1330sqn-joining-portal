import assert from 'node:assert/strict'
import { test } from 'vitest'

import { normalisePhone, samePhone, clashingParentPhone } from '../src/lib/phoneNumbers.js'
import { steps3822A } from '../src/lib/steps3822A.js'

// Cadets kept being given their parent's mobile on the Form 3822, which leaves them unable
// to subscribe to the squadron's SMS updates. The numbers have to match however they were
// typed, or the check is worthless.

test('the same number typed different ways still matches', () => {
  assert.ok(samePhone('07988511060', '07988 511060'))
  assert.ok(samePhone('07988511060', '+447988511060'))
  assert.ok(samePhone('07988511060', '00447988511060'))
  assert.ok(samePhone('07988511060', '07988-511-060'))
  assert.ok(samePhone('  07988511060  ', '(07988) 511060'))
})

test('different numbers do not match', () => {
  assert.equal(samePhone('07988511060', '07988511061'), false)
  assert.equal(samePhone('07988511060', '01925123456'), false)
})

test('a blank or half typed number never counts as a match', () => {
  // Otherwise a parent gets accused of reusing their number while still typing.
  assert.equal(samePhone('', ''), false)
  assert.equal(samePhone('079', '079'), false)
  assert.equal(samePhone(undefined, null), false)
  assert.equal(samePhone('07988511060', ''), false)
})

test('normalising puts a UK number into its 0 form', () => {
  assert.equal(normalisePhone('+44 7988 511060'), '07988511060')
  assert.equal(normalisePhone('07988511060'), '07988511060')
  assert.equal(normalisePhone(''), '')
})

test("the cadet's mobile is flagged when it is the parent's number from the enquiry", () => {
  // parent1.mobile is prefilled from the enquiry, so this fires on the cadet's own page
  // before the next of kin section has been reached.
  const clash = clashingParentPhone({ 'cadet.mobile': '+447988511060', 'parent1.mobile': '07988511060' })
  assert.equal(clash, 'parent1.mobile')
})

test("a second guardian's mobile is caught too", () => {
  assert.equal(clashingParentPhone({ 'cadet.mobile': '07111222333', 'parent2.mobile': '07111 222333' }), 'parent2.mobile')
})

test("a cadet's own distinct mobile is not flagged", () => {
  assert.equal(clashingParentPhone({ 'cadet.mobile': '07111222333', 'parent1.mobile': '07988511060' }), '')
})

test('sharing the home phone with a parent is not an error', () => {
  // The landline is the family's, so matching it proves nothing.
  assert.equal(clashingParentPhone({ 'cadet.mobile': '01925123456', 'cadet.homePhone': '01925123456' }), '')
})

const contactStep = steps3822A.find((step) => step.id === 'contact-details')

test('the page will not let a parent past with their own number in the cadet field', () => {
  const blocked = {
    'cadet.mobile': '07988511060',
    'parent1.mobile': '07988 511060',
    'cadet.primaryEmail': 'oliver@example.com',
  }
  assert.equal(contactStep.completeIf(blocked), false)
  assert.match(contactStep.incompleteMessage, /not the same as a parent/)
})

test("the page accepts the cadet's own number", () => {
  assert.equal(contactStep.completeIf({ 'cadet.mobile': '07111222333', 'parent1.mobile': '07988511060' }), true)
})

test('a cadet with no mobile can still get through on the home phone', () => {
  // Plenty of twelve year olds have no phone. The rule must not shut them out.
  assert.equal(contactStep.completeIf({ 'cadet.mobile': '', 'cadet.homePhone': '01925123456' }), true)
})

test('no phone number at all is still blocked', () => {
  assert.equal(contactStep.completeIf({ 'cadet.mobile': '', 'cadet.homePhone': '' }), false)
})

test('the confirmation tick is only asked for when a mobile was entered', () => {
  const ack = contactStep.fields.find((field) => field.id === 'cadet.mobileConfirmed')
  assert.ok(ack, 'the mobile confirmation field is missing')
  assert.equal(ack.requiredIf({ 'cadet.mobile': '07111222333' }), true)
  assert.equal(ack.requiredIf({ 'cadet.mobile': '' }), false)
  assert.equal(ack.showIf({ 'cadet.mobile': '' }), false)
})

test('the warning names the cadet and says why their own number is needed', () => {
  const notice = contactStep.fields.find((field) => field.id === 'cadet.mobileNotice')
  const text = notice.textFor({ 'cadet.fullName': 'Oliver Thomas Kaminski' })
  assert.match(text, /Oliver/)
  assert.match(text, /NOT a parent/)
  assert.match(text, /text messages/)
  // And it must still read properly before the name is known.
  assert.match(notice.textFor({}), /the cadet's own mobile number/)
})
