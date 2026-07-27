import { useEffect, useState } from 'react'
import { PinGate } from './components/AdminSettings'
import JoiningJourney from './components/JoiningJourney'
import { FamilyDashboard, InterestForm, RecruitmentAdmin, RecruitmentHome } from './components/RecruitmentPages'
import { hydrateSharedFamily, hydrateStaffRecruitmentData } from './lib/recruitmentStore'
import { currentStaffPin, forgetStaffPin, redeemJoiningCode, rememberStaffPin } from './lib/sharedRecruitmentStore'
import { PENDING_PAYMENT_KEY } from './components/PortalSteps'

const STAFF_SESSION_KEY = 'joining-portal-staff-unlocked'

function readRoute() {
  const value = window.location.hash.replace(/^#\/?/, '')
  const [page = '', ...parts] = value.split('/').filter(Boolean)
  return { page, parts }
}

export default function App() {
  const [route, setRoute] = useState(readRoute)
  const navigate = (destination) => {
    window.location.hash = destination ? `#/${destination}` : '#/'
  }

  useEffect(() => {
    const change = () => setRoute(readRoute())
    window.addEventListener('hashchange', change)
    return () => window.removeEventListener('hashchange', change)
  }, [])

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [route.page, route.parts])

  // On touch devices the on-screen keyboard covers the lower half of the page.
  // When a field gains focus, bring it (and the button below it) into view.
  useEffect(() => {
    if (!window.matchMedia?.('(pointer: coarse)').matches) return
    const onFocusIn = (event) => {
      const field = event.target
      if (!field.matches?.('input, select, textarea')) return
      setTimeout(() => field.scrollIntoView({ block: 'center', behavior: 'smooth' }), 300)
    }
    document.addEventListener('focusin', onFocusIn)
    return () => document.removeEventListener('focusin', onFocusIn)
  }, [])

  if (route.page === 'interest') return <InterestForm navigate={navigate} />
  if (import.meta.env.DEV && route.page === 'family-preview') return <FamilyDashboard familyId="preview-family" navigate={navigate} previewFamily={previewFamily} />
  if (import.meta.env.DEV && route.page === 'joining-preview') return <JoiningJourney familyId="preview-family" cadetId="preview-cadet" navigate={navigate} previewFamily={joiningPreviewFamily} previewStage="fee" />
  if (import.meta.env.DEV && route.page === 'payment-return-preview') return <PaymentReturnPage preview />
  if (route.page === 'payment-return') return <PaymentReturnPage />
  if (route.page === 'family') return <FamilyDashboard familyId={route.parts[0]} accessToken={route.parts[1] || ''} navigate={navigate} />
  if (route.page === 'staff') return <StaffArea navigate={navigate} />
  if (route.page === 'settings' || route.page === 'admin') return <StaffArea navigate={navigate} initialWorkspace="settings" />
  if (route.page === 'join' && route.parts.length >= 2) return <SharedJoiningJourney familyId={route.parts[0]} cadetId={route.parts[1]} accessToken={route.parts[2] || ''} navigate={navigate} />
  if (route.page === 'join') return <JoiningCodeAccess navigate={navigate} />
  return <RecruitmentHome navigate={navigate} />
}

const previewFamily = {
  id: 'preview-family',
  guardian: { fullName: 'Paul Warburton', email: 'warby697@gmail.com', mobile: '07868306736', verifiedAt: new Date().toISOString() },
  cadets: [{ id: 'preview-cadet', fullName: 'Ben Warburton', status: 'eligible', schoolName: 'St Gregs School', openNightId: '', paperworkStatus: 'locked' }],
}

const joiningPreviewFamily = {
  id: 'preview-family',
  guardian: { fullName: 'Alex Smith', email: 'alex@example.com', mobile: '07123 456789', verifiedAt: new Date().toISOString() },
  cadets: [{ id: 'preview-cadet', fullName: 'Jamie Smith', dob: '2013-04-12', status: 'paperwork_in_progress', paperworkStatus: 'in_progress', attendedAt: new Date().toISOString(), intendedStartDate: '2026-10-01' }],
}

function PaymentReturnPage({ preview = false }) {
  const params = new URLSearchParams(window.location.search)
  const outcome = preview ? 'complete' : params.get('payment_outcome')
  const kind = preview ? 'fee' : params.get('payment_kind')
  const pending = (() => { try { return JSON.parse(sessionStorage.getItem(PENDING_PAYMENT_KEY) || 'null') } catch { return null } })()
  const route = pending?.returnRoute || ''

  useEffect(() => {
    if (preview || outcome !== 'complete' || !route) return
    window.location.hash = route
  }, [outcome, route, preview])

  const cancelled = outcome === 'cancelled'
  const goBack = () => { window.location.hash = route || '#/' }
  return <main className="mx-auto flex min-h-screen max-w-lg items-center px-5 py-12"><section className={`w-full border-2 bg-white p-8 text-center ${cancelled ? 'border-[var(--gold)]' : 'border-[var(--green)]'}`}><div className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full text-2xl font-bold text-white ${cancelled ? 'bg-[var(--amber)]' : 'bg-[var(--green)]'}`}>{cancelled ? '!' : '✓'}</div><p className="mt-5 text-xs font-bold uppercase tracking-wide text-[var(--blue)]">{kind === 'subs' ? 'Direct Debit' : 'Joining fee'}</p><h1 className="mt-2 text-2xl font-semibold text-slate-900">{cancelled ? 'Setup not completed' : 'Payment step completed'}</h1><p className="mt-3 text-sm leading-6 text-slate-600">{cancelled ? 'Nothing has been charged. Tap below to return to your application and try again when ready.' : 'Tap below to return to your application and finish. It should continue on its own in a moment.'}</p><button type="button" onClick={goBack} className="mt-6 w-full rounded-lg bg-[var(--blue)] px-5 py-3 text-sm font-semibold text-white hover:brightness-110">{cancelled ? 'Return to my application' : 'Continue my application'}</button></section></main>
}

function SharedJoiningJourney({ familyId, cadetId, accessToken, navigate }) {
  const [ready, setReady] = useState(!accessToken)
  const [error, setError] = useState('')
  useEffect(() => {
    if (!accessToken) return
    hydrateSharedFamily(familyId, accessToken).then(() => setReady(true)).catch(() => setError('This secure joining link is invalid or has expired.'))
  }, [accessToken, familyId])
  if (error) return <main className="mx-auto max-w-lg px-5 py-20 text-center"><p className="font-semibold text-red-700">{error}</p><button type="button" onClick={() => navigate('join')} className="mt-4 text-sm font-semibold text-[var(--blue)]">Enter the joining code again</button></main>
  if (!ready) return <main className="mx-auto max-w-lg px-5 py-20 text-center"><p className="font-semibold text-[var(--blue)]">Loading the joining paperwork...</p></main>
  return <JoiningJourney familyId={familyId} cadetId={cadetId} navigate={navigate} />
}

function StaffArea({ navigate, initialWorkspace = 'pipeline' }) {
  const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem(STAFF_SESSION_KEY) === 'yes' && Boolean(currentStaffPin()))
  const [loading, setLoading] = useState(() => sessionStorage.getItem(STAFF_SESSION_KEY) === 'yes' && Boolean(currentStaffPin()))
  const [loadError, setLoadError] = useState('')
  useEffect(() => {
    if (!unlocked) return
    setLoading(true)
    hydrateStaffRecruitmentData().then(() => setLoadError('')).catch(() => setLoadError('Could not load the shared recruitment database.')).finally(() => setLoading(false))
  }, [unlocked])
  const unlock = (pin) => {
    rememberStaffPin(pin)
    sessionStorage.setItem(STAFF_SESSION_KEY, 'yes')
    setUnlocked(true)
  }
  if (!unlocked) return <PinGate onBack={() => navigate('')} onUnlock={unlock} />
  if (loading) return <main className="mx-auto max-w-lg px-5 py-24 text-center"><p className="font-semibold text-[var(--blue)]">Loading the shared recruitment records...</p></main>
  if (loadError) return <main className="mx-auto max-w-lg px-5 py-24 text-center"><p className="font-semibold text-red-700">{loadError}</p><button type="button" className="mt-4 text-sm font-semibold text-[var(--blue)]" onClick={() => { setLoadError(''); setUnlocked(false); sessionStorage.removeItem(STAFF_SESSION_KEY); forgetStaffPin() }}>Return to staff login</button></main>
  return <RecruitmentAdmin navigate={navigate} initialWorkspace={initialWorkspace} onLogout={() => { sessionStorage.removeItem(STAFF_SESSION_KEY); forgetStaffPin(); setUnlocked(false); navigate('') }} />
}

function JoiningCodeAccess({ navigate }) {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const find = async (event) => {
    event.preventDefault()
    setError('')
    try {
      const result = await redeemJoiningCode(email, code)
      const sessionKey = `joining-portal:paperwork:${result.cadetId}`
      let existingSession = {}
      try { existingSession = JSON.parse(sessionStorage.getItem(sessionKey) || '{}') } catch { existingSession = {} }
      sessionStorage.setItem(sessionKey, JSON.stringify({ ...existingSession, stage: 'welcome', familyToken: result.token }))
      navigate(`join/${result.family.id}/${result.cadetId}/${result.token}`)
    } catch (accessError) {
      setError(accessError.message || 'No unlocked paperwork was found for those details.')
    }
  }
  const knownCadet = null
  return <main className="mx-auto max-w-lg px-5 py-10"><button onClick={() => navigate('')} className="mb-5 text-sm font-semibold text-slate-500">← Back</button><form onSubmit={find} className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm"><p className="text-xs font-bold uppercase tracking-wide text-[var(--blue)]">Joining paperwork</p><h1 className="mt-2 text-2xl font-semibold text-slate-900">Use your open-night code</h1><p className="mt-2 text-sm text-slate-500">Paperwork is only available after staff record attendance at an open night.</p><label className="mt-5 block text-sm font-medium text-slate-800">Parent email<input type="email" className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5" value={email} onChange={(e) => { setEmail(e.target.value); setError('') }} /></label>{knownCadet && <p className="mt-2 text-xs text-slate-500">Family record found for {knownCadet.fullName}.</p>}<label className="mt-4 block text-sm font-medium text-slate-800">Four-digit joining code<input inputMode="numeric" maxLength={4} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-center text-xl tracking-[0.35em]" value={code} onChange={(e) => { setCode(e.target.value.replace(/\D/g, '')); setError('') }} /></label>{error && <p className="mt-3 text-sm text-red-700">{error}</p>}<button className="mt-5 w-full rounded-lg bg-[var(--blue)] py-2.5 text-sm font-semibold text-white">Continue</button></form></main>
}
