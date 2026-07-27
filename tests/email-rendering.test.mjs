import { beforeEach, expect, test } from 'vitest'
import sendParentVerification from '../netlify/functions/send-parent-verification.mjs'
import sendJoiningCode from '../netlify/functions/send-joining-code.mjs'
import sendOpenNightConfirmation from '../netlify/functions/send-open-night-confirmation.mjs'
import sendWithdrawal from '../netlify/functions/send-withdrawal-confirmation.mjs'
import sendJoiningComplete from '../netlify/functions/send-joining-complete.mjs'
import { PARENT_SIGNAL_GROUP_URL } from '../src/lib/signalGroups.js'

let sent
const req = (details) => ({ method: 'POST', json: async () => details })

beforeEach(() => {
  process.env.RESEND_API_KEY = 'test-key'
  process.env.RESEND_FROM = '1330 Squadron <noreply@example.com>'
  sent = null
  global.fetch = async (url, opts) => {
    sent = JSON.parse(opts.body)
    return new Response(JSON.stringify({ id: 'prov_1' }), { status: 200 })
  }
})

test('verification email is branded and shows the code and a return button', async () => {
  await sendParentVerification(req({ to: 'p@example.com', cadetName: 'David', code: '482913', portalUrl: 'https://x/#/family/a/b' }))
  expect(sent.html).toContain('1330 (Warrington) Squadron') // branded header
  expect(sent.html).toContain('482913')                     // prominent code
  expect(sent.html).toContain('Return to the joining portal')
  expect(sent.html).toContain('https://x/#/family/a/b')
})

test('joining-code email shows the code and links to the paperwork', async () => {
  await sendJoiningCode(req({ to: 'p@example.com', cadetName: 'David', code: '7314', expiresAt: '2026-08-26', portalUrl: 'https://x/#/join' }))
  expect(sent.html).toContain('7314')
  expect(sent.html).toContain('Start the joining paperwork')
  expect(sent.html).toContain('https://x/#/join')
})

test('open-night confirmation carries a review-booking button', async () => {
  await sendOpenNightConfirmation(req({ to: 'p@example.com', cadetName: 'David', date: 'Thu 17 Sep', address: 'HQ', portalUrl: 'https://x/#/family/a/b' }))
  expect(sent.html).toContain('Review or move your booking')
})

test('withdrawal email has no action button', async () => {
  await sendWithdrawal(req({ to: 'p@example.com', cadetName: 'David' }))
  expect(sent.html).not.toContain('href="https://x')
  expect(sent.html).toContain('Application withdrawn')
})

test('completion email links to the shared Signal groups', async () => {
  await sendJoiningComplete(req({ to: 'p@example.com', parentName: 'Paul', cadetName: 'David', startDate: '2026-10-02' }))
  expect(sent.html).toContain(PARENT_SIGNAL_GROUP_URL)
  expect(sent.html).toContain('Join the Parents and Guardians group')
})
