import assert from 'node:assert/strict'
import { test } from 'vitest'

import { paymentReturnUrls } from '../netlify/functions/_payment-return.mjs'

test('creates dedicated successful and cancelled payment return URLs', () => {
  const result = paymentReturnUrls('https://joining.example/#/join/family/cadet/token', 'fee', 'BRQ123')
  assert.equal(result.redirectUri, 'https://joining.example/?payment_kind=fee&billing_request_id=BRQ123&payment_outcome=complete#/payment-return')
  assert.equal(result.exitUri, 'https://joining.example/?payment_kind=fee&billing_request_id=BRQ123&payment_outcome=cancelled#/payment-return')
  assert.equal(result.redirectUri.includes('token'), false)
})
