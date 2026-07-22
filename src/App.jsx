import { useEffect, useMemo, useState } from 'react'
import Header from './components/Header'
import Gate from './components/Gate'
import AdminSettings from './components/AdminSettings'
import ProgressBar from './components/ProgressBar'
import StepScreen, { stepIncompleteReason, stepBlockedReason } from './components/StepScreen'
import { FeeStep, FeeConfirmStep, SubsStep, SubsConfirmStep, GiftAidStep, DoneStep, PENDING_PAYMENT_KEY } from './components/PortalSteps'
import { steps3822A } from './lib/steps3822A'
import { steps3822H } from './lib/steps3822H'
import { buildReference } from './lib/reference'

const SESSION_KEY = 'joining-portal:session'

function loadSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

const initialSession = loadSession()

const routeFromHash = () => window.location.hash === '#admin' ? 'admin' : window.location.hash === '#confirmation-preview' ? 'preview' : window.location.hash === '#gift-aid-preview' ? 'gift-aid-preview' : 'app'
const previewData = {
  'cadet.fullName': 'Alex Example', 'cadet.dob': '2012-05-14', 'cadet.gender': 'prefer-not',
  'cadet.nationality': 'British', 'cadet.school': 'Example High School', 'cadet.address.property': '10',
  'cadet.address.street': 'Example Road', 'cadet.address.town': 'Warrington', 'cadet.address.postcode': 'WA1 1AA',
  'parent1.fullName': 'Sam Example', 'parent1.parentalResponsibility': true, 'parent1.mobile': '07123 456789',
  'parent1.primaryEmail': 'sam@example.com', 'cadet.externalAgency': false, 'cadet.hasMedical': false,
  'payment.feeStatus': 'paid', 'payment.subsStatus': 'active', 'giftAid.status': 'declared',
  'consent.photo': true, 'consent.flyingLight': true, 'consent.flyingSolo': true, 'consent.flyingTransport': true,
  'consent.flyingOther': true, 'consent.marksmanship': true, 'consent.physical': true, 'consent.lowerRisk': true,
  'consent.transport': true, 'consent.medicalTreatment': true, 'consent.contactShare': true, 'signature.signature': 'Sam Example',
}

export default function App() {
  const [route, setRoute] = useState(routeFromHash())
  const [stage, setStage] = useState(initialSession?.stage || 'gate')
  const [wizardIndex, setWizardIndex] = useState(initialSession?.wizardIndex || 0)
  const [formData, setFormData] = useState(initialSession?.formData || {})
  const [pendingBillingRequestId, setPendingBillingRequestId] = useState(null)
  const [blocked, setBlocked] = useState(null)

  // Coming back from a GoCardless hosted flow (fee payment or subs mandate) — the whole page
  // reloads, so we recover the billing request id we stashed in sessionStorage before the
  // redirect (GoCardless doesn't reliably put it in the return URL) and jump straight to the
  // matching confirm step. Falls back to a URL param if one is present.
  useEffect(() => {
    let pending = null
    try {
      const raw = sessionStorage.getItem(PENDING_PAYMENT_KEY)
      if (raw) pending = JSON.parse(raw)
    } catch {
      pending = null
    }
    const urlBillingRequestId = new URLSearchParams(window.location.search).get('billing_request_id')
    const billingRequestId = pending?.billingRequestId || urlBillingRequestId
    if (!billingRequestId) return

    setPendingBillingRequestId(billingRequestId)
    if (pending?.kind === 'subs') setStage('subs-confirming')
    else if (pending?.kind === 'fee') setStage('fee-confirming')
    else setStage((current) => (current === 'subs' ? 'subs-confirming' : 'fee-confirming'))

    sessionStorage.removeItem(PENDING_PAYMENT_KEY)
    window.history.replaceState({}, '', window.location.pathname + window.location.hash)
  }, [])

  useEffect(() => {
    if (route !== 'app') return
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ stage, wizardIndex, formData }))
  }, [route, stage, wizardIndex, formData])

  useEffect(() => {
    if (stage === 'done') sessionStorage.removeItem(SESSION_KEY)
  }, [stage])

  useEffect(() => {
    const onHashChange = () => setRoute(routeFromHash())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const steps = useMemo(
    () => (formData['cadet.hasMedical'] === true ? [...steps3822A, ...steps3822H] : steps3822A),
    [formData['cadet.hasMedical']]
  )

  if (route === 'admin') return <AdminSettings />
  if (route === 'preview') return <div className="min-h-screen"><Header subtitle="Confirmation preview" /><main className="mx-auto max-w-2xl px-5 py-6"><DoneStep formData={previewData} preview /></main></div>
  if (route === 'gift-aid-preview') return <div className="min-h-screen"><Header subtitle="Gift Aid preview" /><main className="mx-auto max-w-2xl px-5 py-6"><GiftAidStep formData={{ ...previewData, 'parent1.address.property': '10', 'parent1.address.street': 'Example Road', 'parent1.address.town': 'Warrington', 'parent1.address.postcode': 'WA1 1AA' }} update={() => {}} onBack={() => {}} onDone={() => {}} /></main></div>

  const update = (patch) => {
    setFormData((prev) => ({ ...prev, ...patch }))
    setBlocked(null)
  }

  const step = steps[wizardIndex]

  const handleEnter = (forename, surname, pin) => {
    setFormData((f) => ({ ...f, 'cadet.fullName': `${forename} ${surname}`.trim(), 'meta.pin': pin }))
    setStage('wizard')
  }

  const goNext = () => {
    const reason = stepBlockedReason(step, formData)
    if (reason) {
      setBlocked(reason)
      return
    }
    const incomplete = stepIncompleteReason(step, formData)
    if (incomplete) {
      setBlocked(incomplete)
      return
    }
    if (wizardIndex < steps.length - 1) {
      setWizardIndex((i) => i + 1)
    } else {
      setStage('fee')
    }
  }

  const goBack = () => {
    setBlocked(null)
    if (wizardIndex > 0) setWizardIndex((i) => i - 1)
  }

  const headerSubtitle =
    stage === 'gate'
      ? 'Joining Portal'
      : stage === 'wizard'
      ? `${step.form || '3822A'} · Section ${step.section} — ${step.title}`
      : stage === 'fee' || stage === 'fee-confirming'
      ? 'Joining fee'
      : stage === 'subs' || stage === 'subs-confirming'
      ? 'Set up subs'
      : stage === 'gift-aid'
      ? 'Gift Aid declaration'
      : 'All done'

  if (stage === 'gate') return <Gate onEnter={handleEnter} />

  return (
    <div className="min-h-screen">
      <Header subtitle={headerSubtitle} />
      <main className="mx-auto max-w-2xl px-5 py-6">
        {stage === 'wizard' && (
          <>
            <ProgressBar index={wizardIndex} total={steps.length} label={step.form || 'Form 3822A'} />
            <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-6 mb-4">
              <h2 className="text-lg font-semibold text-slate-900 mb-1">{step.title}</h2>
              {step.subtitle && <p className="text-sm text-slate-500 mb-5">{step.subtitle}</p>}
              <StepScreen step={step} formData={formData} update={update} />
            </div>

            {blocked && (
              <p className="mb-4 rounded-lg bg-[var(--gold-soft)] px-4 py-2.5 text-sm text-[var(--amber)]">{blocked}</p>
            )}

            <div className="flex gap-3">
              <button
                id="wizard-back"
                onClick={goBack}
                disabled={wizardIndex === 0}
                className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-600 disabled:opacity-40"
              >
                Back
              </button>
              <button
                id="wizard-continue"
                onClick={goNext}
                className="flex-1 rounded-lg bg-[var(--blue)] py-2.5 text-sm font-semibold text-white hover:brightness-110"
              >
                Continue
              </button>
            </div>
          </>
        )}

        {stage === 'fee' && (
          <FeeStep
            formData={formData}
            onBack={() => setStage('wizard')}
            onSkip={() => {
              update({ 'payment.feeStatus': 'unconfirmed' })
              setStage('subs')
            }}
          />
        )}
        {stage === 'fee-confirming' && (
          <FeeConfirmStep
            billingRequestId={pendingBillingRequestId}
            onDone={() => {
              update({ 'payment.feeStatus': 'paid' })
              setStage('subs')
            }}
            onRetry={() => setStage('fee')}
          />
        )}
        {stage === 'subs' && (
          <SubsStep
            formData={formData}
            onBack={() => setStage('fee')}
            onSkip={() => {
              update({ 'payment.subsStatus': 'unconfirmed' })
              setStage('gift-aid')
            }}
          />
        )}
        {stage === 'subs-confirming' && (
          <SubsConfirmStep
            billingRequestId={pendingBillingRequestId}
            reference={buildReference(formData)}
            onDone={() => {
              update({ 'payment.subsStatus': 'active' })
              setStage('gift-aid')
            }}
            onRetry={() => setStage('subs')}
          />
        )}

        {stage === 'gift-aid' && <GiftAidStep formData={formData} update={update} onBack={() => setStage('subs')} onDone={() => setStage('done')} />}

        {stage === 'done' && <DoneStep formData={formData} />}
      </main>
    </div>
  )
}
