// In-memory stand-in for the joining-data Netlify function + Firestore.
// Installed as global.fetch so tests exercise the real client store and
// sharedRecruitmentStore transport, but nothing ever reaches production.
// Mirrors the important server rules: idempotent set-by-id, token/staff
// authorisation, and the "deleted families cannot reappear" guard.

const jsonResponse = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

export function installFakeServer(options = {}) {
  const state = {
    families: new Map(),        // id -> stored family (includes _token)
    deleted: new Set(),         // ids that were deleted and must not reappear
    settings: new Map(),
    openNights: new Map(),
    staffPin: options.staffPin || '1234',
    calls: [],                  // every request, for assertions
    failSyncTimes: 0,           // inject N consecutive network failures
    delayMs: 0,                 // inject latency
  }

  const handle = (body) => {
    const staffOk = body.pin && body.pin === state.staffPin
    switch (body.action) {
      case 'sync-family': {
        const family = body.family || {}
        const id = String(family.id || '')
        const token = String(body.token || '')
        if (!id || (token.length < 20 && !staffOk)) return jsonResponse({ error: 'Family access details are missing.' }, 400)
        if (state.deleted.has(id)) return jsonResponse({ error: 'This record was deleted.' }, 409)
        const current = state.families.get(id)
        if (current && current._token && token && current._token !== token && !staffOk) return jsonResponse({ error: 'Not authorised.' }, 401)
        state.families.set(id, { ...family, _token: current?._token || token })
        return jsonResponse({ saved: true, familyId: id })
      }
      case 'delete-family': {
        const id = String(body.familyId || '')
        const current = state.families.get(id)
        const tokenOk = current && body.token && current._token === body.token
        if (!tokenOk && !staffOk) return jsonResponse({ error: 'Not authorised.' }, 401)
        state.families.delete(id)
        state.deleted.add(id)
        return jsonResponse({ deleted: true })
      }
      case 'load-family': {
        const current = state.families.get(String(body.familyId || ''))
        if (!current) return jsonResponse({ error: 'Family not found.' }, 404)
        const tokenOk = body.token && current._token === body.token
        if (!tokenOk && !staffOk) return jsonResponse({ error: 'Not authorised.' }, 401)
        const family = { ...current }; delete family._token
        return jsonResponse({ family, settings: {} })
      }
      case 'staff-snapshot': {
        if (!staffOk) return jsonResponse({ error: 'Not authorised.' }, 401)
        const families = [...state.families.values()].map((family) => { const copy = { ...family }; delete copy._token; return copy })
        return jsonResponse({ families, openNightManagement: Object.fromEntries(state.openNights), settings: Object.fromEntries(state.settings) })
      }
      case 'validate-staff':
        return jsonResponse({ valid: body.pin === state.staffPin })
      case 'save-setting':
        state.settings.set(body.key, body.value); return jsonResponse({ saved: true })
      case 'save-open-night':
        state.openNights.set(body.openNightId, body.management); return jsonResponse({ saved: true })
      case 'request-family-access':
        return jsonResponse({ requested: true })
      default:
        return jsonResponse({ ok: true })
    }
  }

  global.fetch = async (url, opts = {}) => {
    const body = (() => { try { return JSON.parse(opts.body || '{}') } catch { return {} } })()
    state.calls.push({ url: String(url), body })
    if (state.delayMs) await new Promise((resolve) => setTimeout(resolve, state.delayMs))
    if (state.failSyncTimes > 0) { state.failSyncTimes -= 1; throw new Error('Network request failed') }
    if (String(url).includes('joining-data')) return handle(body)
    // Email + GoCardless endpoints: pretend success.
    return jsonResponse({ sent: true, ok: true })
  }

  state.syncCalls = () => state.calls.filter((call) => call.body.action === 'sync-family')
  return state
}
