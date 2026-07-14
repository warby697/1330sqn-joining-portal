import { useEffect, useMemo, useState } from 'react'
import Header from './components/Header'
import Gate from './components/Gate'
import AdminSettings from './components/AdminSettings'
import ProgressBar from './components/ProgressBar'
import StepScreen, { stepIsComplete, stepBlockedReason } from './components/StepScreen'
import SummaryPreview from './components/SummaryPreview'
import { FeeStep, FeeConfirmStep, SubsStep, SubsConfirmStep } from './components/PortalSteps'
import { steps3822A } from './lib/steps3822A'
import { steps3822H } from './lib/steps3822H'
import { getAdminEmails } from './lib/adminEmails'
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

export default function App() {
  const [route, setRoute] = useState(window.location.hash === '#admin' ? 'admin' : 'app')
  const [stage, setStage] = useState(initialSession?.stage || 'gate')
  const [wizardIndex, setWizardIndex] = useState(initialSession?.wizardIndex || 0)
  const [formData, setFormData] = useState(initialSession?.formData || {})
  const [pendingBillingRequestId, setPendingBillingRequestId] = useState(null)
  const [blocked, setBlocked] = useState(null)
  const [skipValidation, setSkipValidation] = useState(true)

  // Coming back from a GoCardless hosted flow (fee payment or subs mandate) — the whole page
  // reloads, so session state above is restored from sessionStorage; which flow we were on
  // (still sitting in `stage` from before the redirect) decides which confirm step runs.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const billingRequestId = params.get('billing_request_id')
    if (billingRequestId) {
      setPendingBillingRequestId(billingRequestId)
      setStage((current) => (current === 'fee' ? 'fee-confirming' : 'subs-confirming'))
      window.history.replaceState({}, '', window.location.pathname + window.location.hash)
    }
  }, [])

  useEffect(() => {
    if (route !== 'app') return
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ stage, wizardIndex, formData }))
  }, [route, stage, wizardIndex, formData])

  useEffect(() => {
    if (stage === 'done') sessionStorage.removeItem(SESSION_KEY)
  }, [stage])

  useEffect(() => {
    const onHashChange = () => setRoute(window.location.hash === '#admin' ? 'admin' : 'app')
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const steps = useMemo(
    () => (formData['cadet.hasMedical'] === true ? [...steps3822A, ...steps3822H] : steps3822A),
    [formData['cadet.hasMedical']]
  )

  if (route === 'admin') return <AdminSettings />

  const update = (patch) => {
    setFormData((prev) => ({ ...prev, ...patch }))
    setBlocked(null)
  }

  const step = steps[wizardIndex]

  const handleEnter = (surname, pin) => {
    setFormData((f) => ({ ...f, 'signature.surname': surname, 'meta.pin': pin }))
    setStage('wizard')
  }

  const goNext = () => {
    if (!skipValidation) {
      const reason = stepBlockedReason(step, formData)
      if (reason) {
        setBlocked(reason)
        return
      }
      if (!stepIsComplete(step, formData)) {
        setBlocked('Please fill in the required fields (marked *) before continuing.')
        return
      }
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
      : 'All done'

  if (stage === 'gate') return <Gate onEnter={handleEnter} />

  return (
    <div className="min-h-screen">
      <Header
        subtitle={headerSubtitle}
        skipValidation={skipValidation}
        onToggleSkip={() => setSkipValidation((v) => !v)}
      />
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

        {stage === 'fee' && <FeeStep formData={formData} />}
        {stage === 'fee-confirming' && (
          <FeeConfirmStep
            billingRequestId={pendingBillingRequestId}
            onDone={() => setStage('subs')}
            onRetry={() => setStage('fee')}
          />
        )}
        {stage === 'subs' && <SubsStep formData={formData} />}
        {stage === 'subs-confirming' && (
          <SubsConfirmStep
            billingRequestId={pendingBillingRequestId}
            reference={buildReference(formData)}
            onDone={() => setStage('done')}
            onRetry={() => setStage('subs')}
          />
        )}

        {stage === 'done' && (
          <div>
            <div className="rounded-2xl bg-[var(--green-soft)] border border-[var(--green)]/30 px-6 py-5 mb-6 text-center">
              <p className="text-lg font-semibold text-[var(--green)] mb-1">All done — welcome to 1330 Squadron</p>
              <p className="text-sm text-slate-600 mb-3">
                Nothing is stored in this portal — it's cleared automatically.
              </p>
              <div className="text-sm text-slate-700 space-y-1">
                <p>
                  Sent to: <strong>{getAdminEmails().join(', ')}</strong>
                </p>
                {formData['parent1.primaryEmail'] && (
                  <p>
                    A copy has also been emailed to <strong>{formData['parent1.primaryEmail']}</strong> — keep it in
                    case you need it, or in case the squadron asks for it again.
                  </p>
                )}
              </div>
            </div>

            <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-3">Next steps</p>

            <div className="mb-5">
              <p className="text-sm font-semibold text-slate-800 mb-2">1. Review what you've submitted</p>
              <SummaryPreview formData={formData} />
            </div>

            <div className="rounded-2xl bg-[var(--navy)] text-white p-6">
              <p className="text-sm font-semibold mb-2">2. Continue to the Parent Portal</p>
              <p className="text-sm text-white/80 mb-4">
                That's where you'll find the Signal group link, event notices, uniform ordering, and everything else
                going forward — not email. Log in with the same PIN you used to start today
                {formData['meta.pin'] ? (
                  <>
                    {' '}
                    (<strong>{formData['meta.pin']}</strong>)
                  </>
                ) : null}
                .
              </p>
              <a
                href="#"
                onClick={(e) => e.preventDefault()}
                className="inline-block rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-[var(--navy)] hover:brightness-95"
              >
                Open the Parent Portal
              </a>
              <p className="mt-3 text-xs text-white/60">
                Demo only — the Parent Portal isn't built yet. When it is, staff rotating this PIN for new sign-ups
                will rotate the same PIN for parent access at the same time — one change, both apps.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
