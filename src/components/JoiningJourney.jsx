import { useEffect, useMemo, useRef, useState } from 'react'
import Header from './Header'
import ProgressBar from './ProgressBar'
import StepScreen, { stepIncompleteReason, stepBlockedReason } from './StepScreen'
import { FeeStep, FeeConfirmStep, SubsStep, SubsConfirmStep, GiftAidStep, DoneStep, PENDING_PAYMENT_KEY } from './PortalSteps'
import { steps3822A } from '../lib/steps3822A'
import { steps3822H } from '../lib/steps3822H'
import { buildReference } from '../lib/reference'
import { getFamily, markPaperworkComplete, validateJoiningCode } from '../lib/recruitmentStore'
import { savePaperworkProgress } from '../lib/sharedRecruitmentStore'
import { resolveFormData, resolveStage } from '../lib/paperworkResume'

const inputClass = 'mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none focus:border-[var(--blue)] focus:ring-2 focus:ring-[var(--blue)]/20'

function initialFormData(family, cadet) {
  if (!family || !cadet) return {}
  return {
    'cadet.fullName': cadet.fullName,
    'cadet.dob': cadet.dob,
    'parent1.fullName': family.guardian.fullName,
    'parent1.primaryEmail': family.guardian.email,
    'parent1.mobile': family.guardian.mobile,
    'parent1.address.postcode': family.guardian.postcode,
    'meta.familyId': family.id,
    'meta.cadetId': cadet.id,
    'meta.openNightAttendedAt': cadet.attendedAt,
    'meta.intendedStartDate': cadet.intendedStartDate,
  }
}

export default function JoiningJourney({ familyId, cadetId, navigate, previewFamily = null, previewStage = '' }) {
  const family = previewFamily || getFamily(familyId)
  const cadet = family?.cadets.find((item) => item.id === cadetId)
  // A direct joiner never attended an open night, so the thank-you wording below has to differ.
  const directJoiner = Boolean(cadet && !cadet.openNightId)
  const sessionKey = `joining-portal:paperwork:${cadetId || 'unknown'}`
  const saved = previewFamily ? null : (() => { try { return JSON.parse(sessionStorage.getItem(sessionKey) || 'null') } catch { return null } })()
  // See paperworkResume: the tab's copy wins, the record is the fallback, and anyone who has
  // already paid is kept away from the fee page.
  const resumeCadet = previewFamily ? null : cadet
  const [stage, setStage] = useState(() => resolveStage(saved, resumeCadet, previewStage))
  const [wizardIndex, setWizardIndex] = useState((saved || resumeCadet?.paperworkProgress)?.wizardIndex || 0)
  const [formData, setFormData] = useState(() => resolveFormData(saved, resumeCadet, initialFormData(family, cadet)))
  const [pendingPaymentId, setPendingPaymentId] = useState(null)
  const [blocked, setBlocked] = useState(null)
  const savedAtLoad = useRef(saved)

  useEffect(() => {
    if (previewFamily) return
    let pending = null
    try { pending = JSON.parse(sessionStorage.getItem(PENDING_PAYMENT_KEY) || 'null') } catch { pending = null }
    const initialSaved = savedAtLoad.current
    const savedPaymentId = initialSaved?.stage === 'subs-confirming'
      ? initialSaved?.formData?.['payment.subsBillingRequestId']
      : initialSaved?.formData?.['payment.feeBillingRequestId']
    // The fee is a Stripe Checkout session, the subs is a GoCardless billing request.
    // Stripe does substitute the session id into the return URL, so that is a genuine
    // fallback if sessionStorage was lost; GoCardless never did.
    const query = new URLSearchParams(window.location.search)
    const paymentId = pending?.sessionId || pending?.billingRequestId || query.get('session_id') || query.get('billing_request_id') || savedPaymentId
    if (!paymentId) return
    setPendingPaymentId(paymentId)
    const confirmationStage = pending?.kind === 'subs' || initialSaved?.stage === 'subs-confirming' ? 'subs-confirming' : 'fee-confirming'
    setStage(confirmationStage)
    setFormData((current) => ({
      ...current,
      [confirmationStage === 'subs-confirming' ? 'payment.subsBillingRequestId' : 'payment.feeBillingRequestId']: paymentId,
    }))
    window.history.replaceState({}, '', window.location.pathname + window.location.hash)
  }, [previewFamily])

  useEffect(() => {
    if (previewFamily) return
    sessionStorage.setItem(sessionKey, JSON.stringify({ stage, wizardIndex, formData, stepOrderVersion: 2 }))
  }, [sessionKey, stage, wizardIndex, formData, previewFamily])

  // sessionStorage stays the fast local copy; this mirrors it onto the record so the journey
  // survives losing the tab. Best effort and debounced, so a blip never blocks the parent.
  const portalToken = family?._portalToken || ''
  useEffect(() => {
    if (previewFamily || !portalToken || !familyId || !cadetId || stage === 'gate') return
    const timer = setTimeout(() => {
      savePaperworkProgress(familyId, cadetId, portalToken, { progress: { stage, wizardIndex, formData } }).catch(() => undefined)
    }, 1500)
    return () => clearTimeout(timer)
  }, [previewFamily, portalToken, familyId, cadetId, stage, wizardIndex, formData])

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [stage, wizardIndex])

  const steps = useMemo(() => {
    if (formData['cadet.hasMedical'] !== true) return steps3822A
    const medicalIndex = steps3822A.findIndex((item) => item.id === 'medical-trigger')
    return [...steps3822A.slice(0, medicalIndex + 1), ...steps3822H, ...steps3822A.slice(medicalIndex + 1)]
  }, [formData])
  useEffect(() => {
    if (saved?.stepOrderVersion || formData['cadet.hasMedical'] !== true) return
    const legacyStepId = [...steps3822A, ...steps3822H][wizardIndex]?.id
    const migratedIndex = steps.findIndex((item) => item.id === legacyStepId)
    if (migratedIndex >= 0 && migratedIndex !== wizardIndex) setWizardIndex(migratedIndex)
  }, [formData, saved?.stepOrderVersion, steps, wizardIndex])
  const step = steps[wizardIndex]
  const otherCadets = family?.cadets.filter((item) => item.id !== cadetId) || []
  const otherEligibleCadets = otherCadets.filter((item) => item.attendedAt && !['locked', 'completed'].includes(item.paperworkStatus))
  const familyRoute = `family/${family?.id}${family?._portalToken ? `/${family._portalToken}` : ''}`
  const joiningRoute = (nextCadetId) => `join/${family?.id}/${nextCadetId}${family?._portalToken ? `/${family._portalToken}` : ''}`
  if (!family || !cadet) return <div className="min-h-screen"><Header subtitle="Joining paperwork" /><main className="mx-auto max-w-lg px-5 py-8"><div className="rounded-2xl bg-white p-6"><h1 className="text-xl font-semibold">Joining record not found</h1><button onClick={() => navigate('')} className="mt-4 rounded-lg bg-[var(--blue)] px-5 py-2.5 text-sm font-semibold text-white">Back to recruitment</button></div></main></div>

  // Written the moment a payment confirms, and awaited, because this is the only durable
  // proof the parent paid. Without it, losing the tab means being asked to pay again.
  // Deliberately swallows failures: the money has already left their account, so nothing
  // here should ever block them from finishing.
  const recordPayment = async (payment) => {
    if (previewFamily || !portalToken || !familyId || !cadetId) return
    try {
      await savePaperworkProgress(familyId, cadetId, portalToken, { payment })
    } catch (error) {
      console.error('Could not record the payment against the joining record:', error)
    }
  }

  const update = (patch) => { setFormData((current) => ({ ...current, ...patch })); setBlocked(null) }
  const goNext = () => {
    const reason = stepBlockedReason(step, formData) || stepIncompleteReason(step, formData)
    if (reason) return setBlocked(reason)
    if (wizardIndex < steps.length - 1) setWizardIndex((value) => value + 1)
    else setStage('fee')
  }
  const headerSubtitle = stage === 'gate' ? 'Paperwork unlock' : stage === 'welcome' ? (directJoiner ? 'Welcome' : 'Attendance confirmed') : stage === 'wizard' ? `${step.form || '3822A'} - Section ${step.section} - ${step.title}` : stage.includes('fee') ? 'Joining fee' : stage.includes('subs') ? 'Set up subs' : stage === 'gift-aid' ? 'Gift Aid declaration' : 'All done'

  if (stage === 'gate') return <PaperworkGate cadet={cadet} onBack={() => navigate(familyRoute)} onUnlock={async (joiningCode) => {
    let accepted
    try { accepted = await validateJoiningCode(family.id, cadet.id, joiningCode) }
    catch { return false }
    if (!accepted) return false
    update({ 'meta.joiningCode': joiningCode })
    setStage('welcome')
    return true
  }} />

  return <div className="min-h-screen"><Header subtitle={headerSubtitle} /><main className="mx-auto max-w-2xl px-5 py-6">
    {import.meta.env.DEV && <div className="mb-4 border border-[var(--gold)] bg-[var(--gold-soft)] p-3"><p className="text-xs font-bold uppercase tracking-wide text-[var(--amber)]">Local journey shortcuts</p><div className="mt-2 flex flex-wrap gap-2">{[['welcome', 'Welcome'], ['wizard', '3822 forms'], ['fee', 'Joining fee'], ['subs', 'Direct Debit'], ['gift-aid', 'Gift Aid'], ['done', 'Final page']].map(([value, label]) => <button type="button" key={value} onClick={() => { if (value === 'wizard') setWizardIndex(0); setStage(value) }} className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700">{label}</button>)}</div></div>}
    {stage === 'welcome' && <section className="border-2 border-[var(--navy)] bg-white p-7"><p className="text-sm font-semibold text-[var(--blue)]">{directJoiner ? 'Joining paperwork unlocked' : 'Open Night attendance confirmed'}</p><h1 className="mt-2 text-2xl font-semibold text-slate-900">{directJoiner ? 'Thank you for enquiring' : 'Thank you for attending'}</h1><p className="mt-3 text-slate-700">We are glad that <strong>{cadet.fullName || 'your cadet'}</strong> would like to start with 1330 Squadron.</p><p className="mt-3 text-sm leading-6 text-slate-600">{directJoiner ? 'The next section is the formal joining paperwork.' : 'The joining code has been accepted and will not be requested again. The next section is the formal joining paperwork.'} Parent and cadet details already held by the Squadron will be carried into the forms for checking.</p>{otherEligibleCadets.length > 0 && <div className="mt-5 rounded-xl border border-[var(--gold)] bg-[var(--gold-soft)] p-4 text-sm text-slate-700"><p className="font-semibold text-[var(--navy)]">You have {family.cadets.length} cadets linked to this family</p><p className="mt-1">Complete this form for <strong>{cadet.fullName}</strong> first. You will then be prompted to complete a separate form for {otherEligibleCadets.map((item) => item.fullName).join(' and ')}. Shared parent details will be filled in for you.</p></div>}<button type="button" onClick={() => setStage('wizard')} className="mt-6 w-full rounded-lg bg-[var(--blue)] py-3 text-sm font-semibold text-white">Continue to {cadet.fullName || 'cadet'}'s joining forms</button></section>}
    {stage === 'wizard' && <form onSubmit={(event) => { event.preventDefault(); goNext() }}><ProgressBar index={wizardIndex} total={steps.length} label={step.form || 'Form 3822A'} /><div className="mb-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-lg font-semibold text-slate-900 mb-1">{step.title}</h2>{step.subtitle && <p className="text-sm text-slate-500 mb-5">{step.subtitle}</p>}<StepScreen step={step} formData={formData} update={update} /></div>{blocked && <p className="mb-4 rounded-lg bg-[var(--gold-soft)] px-4 py-2.5 text-sm text-[var(--amber)]">{blocked}</p>}<div className="flex gap-3"><button type="button" onClick={() => { setBlocked(null); if (wizardIndex > 0) setWizardIndex((value) => value - 1) }} disabled={wizardIndex === 0} className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-600 disabled:opacity-40">Back</button><button type="submit" className="flex-1 rounded-lg bg-[var(--blue)] py-2.5 text-sm font-semibold text-white">Continue</button></div></form>}
    {stage === 'fee' && <FeeStep formData={formData} onStarted={(feeSessionId) => { setPendingPaymentId(feeSessionId); update({ 'payment.feeBillingRequestId': feeSessionId }); setStage('fee-confirming') }} onBack={() => setStage('wizard')} onSkip={() => { update({ 'payment.feeStatus': 'unconfirmed' }); setStage('subs') }} />}
    {stage === 'fee-confirming' && <FeeConfirmStep sessionId={pendingPaymentId} onDone={async (result) => { sessionStorage.removeItem(PENDING_PAYMENT_KEY); update({ 'payment.feeStatus': 'paid', 'payment.feeBillingRequestId': pendingPaymentId, 'payment.feePaymentId': result?.paymentId || '' }); await recordPayment({ fee: { status: 'paid', sessionId: pendingPaymentId, paymentId: result?.paymentId || '' } }); setStage('subs') }} onContinueUnconfirmed={() => { sessionStorage.removeItem(PENDING_PAYMENT_KEY); update({ 'payment.feeStatus': 'unconfirmed', 'payment.feeBillingRequestId': pendingPaymentId }); setStage('subs') }} onRetry={() => setStage('fee')} />}
    {stage === 'subs' && <SubsStep formData={formData} onStarted={(billingRequestId) => { setPendingPaymentId(billingRequestId); update({ 'payment.subsBillingRequestId': billingRequestId }); setStage('subs-confirming') }} onBack={() => setStage('fee')} onSkip={() => { update({ 'payment.subsStatus': 'unconfirmed' }); setStage('gift-aid') }} />}
    {stage === 'subs-confirming' && <SubsConfirmStep billingRequestId={pendingPaymentId} reference={buildReference(formData)} startDate={formData['meta.intendedStartDate']} onDone={async (result) => { sessionStorage.removeItem(PENDING_PAYMENT_KEY); update({ 'payment.subsStatus': 'active', 'payment.subsBillingRequestId': pendingPaymentId, 'payment.mandateId': result?.mandateId || '', 'payment.subscriptionId': result?.subscriptionId || '' }); await recordPayment({ subs: { status: 'active', billingRequestId: pendingPaymentId, mandateId: result?.mandateId || '', subscriptionId: result?.subscriptionId || '' } }); setStage('gift-aid') }} onContinueUnconfirmed={() => { sessionStorage.removeItem(PENDING_PAYMENT_KEY); update({ 'payment.subsStatus': 'unconfirmed', 'payment.subsBillingRequestId': pendingPaymentId }); setStage('gift-aid') }} onRetry={() => setStage('subs')} />}
    {stage === 'gift-aid' && <GiftAidStep formData={formData} update={update} onBack={() => setStage('subs')} onDone={() => setStage('done')} />}
    {stage === 'done' && <DoneStep formData={formData} nextCadetName={otherEligibleCadets[0]?.fullName || ''} onBackToGiftAid={() => setStage('gift-aid')} onComplete={async () => { if (!previewFamily) { await markPaperworkComplete(family.id, cadet.id); sessionStorage.removeItem(sessionKey); navigate(otherEligibleCadets.length ? joiningRoute(otherEligibleCadets[0].id) : familyRoute) } }} />}
  </main></div>
}

function PaperworkGate({ cadet, onBack, onUnlock }) {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const locked = (!cadet.attendedAt || cadet.paperworkStatus === 'locked')
  const submit = async (event) => { event.preventDefault(); if (!(await onUnlock(code))) setError('That code is not valid for this cadet.') }
  return <div className="min-h-screen"><Header subtitle="Paperwork unlock" /><main className="mx-auto max-w-lg px-5 py-8"><button onClick={onBack} className="mb-4 text-sm font-semibold text-slate-500">← Family dashboard</button><form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm"><p className="text-xs font-bold uppercase tracking-wide text-[var(--blue)]">Formal joining paperwork</p><h1 className="mt-2 text-2xl font-semibold text-slate-900">{cadet.fullName}</h1>{locked ? <div className="mt-5 rounded-xl bg-[var(--gold-soft)] p-4 text-sm text-[var(--amber)]"><p className="font-bold">Paperwork is locked</p><p className="mt-1">A parent and cadet must attend an open night before the joining forms become available.</p></div> : <><p className="mt-3 text-sm text-slate-500">Enter the one-time four-digit code issued after your open night. Known family details will be carried into the form for review.</p><label className="mt-5 block text-sm font-medium text-slate-800">One-time joining code<input inputMode="numeric" maxLength={4} className={inputClass + ' text-center text-xl tracking-[0.35em]'} value={code} onChange={(e) => { setCode(e.target.value.replace(/\D/g, '')); setError('') }} /></label>{error && <p className="mt-3 text-sm text-red-700">{error}</p>}<button type="submit" className="mt-5 w-full rounded-lg bg-[var(--blue)] py-2.5 text-sm font-semibold text-white">Unlock paperwork</button></>}</form></main></div>
}
