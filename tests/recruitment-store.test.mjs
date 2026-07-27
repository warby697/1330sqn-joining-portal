import { beforeEach, describe, expect, test } from 'vitest'
import { installFakeServer } from './helpers/fake-server.mjs'

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

const enquiry = (over = {}) => ({
  submittedBy: 'parent',
  guardianName: 'Test Parent',
  guardianEmail: 'parent@example.com',
  guardianMobile: '07000 000000',
  cadetName: 'Test Cadet',
  cadetDob: '2013-01-01',
  schoolYear: '8',
  source: 'Website',
  communicationsConsent: true,
  dataTermsAccepted: true,
  ...over,
})

let store
let server

// Mirrors the real interest-form flow: create locally, then persist to the server.
const register = async (over) => {
  const family = store.createEnquiry(enquiry(over))
  await store.persistFamily(family)
  return family
}

beforeEach(async () => {
  localStorage.clear()
  sessionStorage.clear()
  server = installFakeServer()
  store = await import('../src/lib/recruitmentStore.js')
})

describe('recruitment store — Firebase reliability', () => {
  test('a new enquiry is saved to the server', async () => {
    const family = await register()
    await flush()
    expect(server.families.has(family.id)).toBe(true)
  })

  test('editing one family syncs ONLY that family, never the whole list', async () => {
    const a = await register({ guardianEmail: 'a@example.com', cadetName: 'Cadet A' })
    const b = await register({ guardianEmail: 'b@example.com', cadetName: 'Cadet B' })
    await flush()
    server.calls.length = 0

    await store.verifyGuardian(a.id, a.verificationCode)
    await flush()

    const syncedIds = [...new Set(server.syncCalls().map((call) => call.body.family.id))]
    expect(syncedIds).toEqual([a.id])
    expect(syncedIds).not.toContain(b.id)
  })

  test('a failed save is reported to the caller, not swallowed', async () => {
    const a = await register()
    await flush()
    server.failSyncTimes = 1
    await expect(store.verifyGuardian(a.id, a.verificationCode)).rejects.toThrow()
  })

  test('a deleted family cannot reappear on the server', async () => {
    const a = await register()
    await flush()

    await store.deleteCadetEnquiry(a.id, a.cadets[0].id)
    await flush()
    expect(server.families.has(a.id)).toBe(false)
    expect(server.deleted.has(a.id)).toBe(true)

    // A stale background copy trying to re-save must be rejected by the server.
    await expect(store.persistFamily(a)).rejects.toThrow()
    expect(server.families.has(a.id)).toBe(false)
  })
})
