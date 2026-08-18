import { useEffect, useRef, useState } from 'react'
import { buildReference, nameParts } from '../lib/reference'
import { getEmailTemplates } from '../lib/communicationSettings'
import { FEE_LABEL, SUBS_LABEL } from '../lib/pricing'
import SummaryPreview from './SummaryPreview'
import { PARENT_SIGNAL_GROUP_URL as SIGNAL_GROUP_URL, CADET_SIGNAL_GROUP_URL } from '../lib/signalGroups'

// Stashed before we hand off to GoCardless so we can resume the confirm step on return.
// sessionStorage survives the cross-origin round-trip to GoCardless and back in the same tab;
// GoCardless does not reliably append the billing request id to the return URL, so we can't
// depend on the query string alone.
export const PENDING_PAYMENT_KEY = 'joining-portal:pending-payment'

function Card({ children }) {
  return <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-6">{children}</div>
}

function Eyebrow({ children }) {
  return <p className="text-xs font-bold uppercase tracking-wide text-[var(--blue)] mb-2">{children}</p>
}

export function FeeStep({ formData, onStarted, onSkip, onBack }) {
  const ref = buildReference(formData)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [ack, setAck] = useState(false)

  const startPayment = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/stripe/create-fee-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reference: ref,
          givenName: nameParts(formData['parent1.fullName']).forename,
          familyName: nameParts(formData['parent1.fullName']).surname,
          email: formData['parent1.primaryEmail'] || '',
          returnUrl: window.location.origin + window.location.pathname + window.location.hash,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Something went wrong starting the payment')
      sessionStorage.setItem(PENDING_PAYMENT_KEY, JSON.stringify({ kind: 'fee', sessionId: data.sessionId, returnRoute: window.location.hash }))
      onStarted(data.sessionId)
      // Single tab: send THIS tab to Stripe Checkout. It returns us here, where
      // the confirm step resumes from sessionStorage.
      window.location.href = data.authorisationUrl
    } catch (e) {
      setError(e.message)
      setLoading(false)
    }
  }

  return (
    <Card>
      <div className="mb-5 rounded-xl bg-[var(--navy)] p-5 text-white">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-bold uppercase tracking-wide text-[var(--sky)]">Payment 1 of 2</p>
          <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold uppercase tracking-wide">One-off payment</span>
        </div>
        <h2 className="mt-2 text-2xl font-semibold">Joining fee</h2>
        <p className="mt-3 text-3xl font-bold">{FEE_LABEL} <span className="text-base font-medium text-white/70">once</span></p>
        <p className="mt-2 text-sm leading-6 text-white/80">A single payment to set up the cadet. You will not be charged this again. The monthly subscription is set up on the next page.</p>
      </div>
      <p className="mb-4 text-sm leading-6 text-slate-600">
        The joining fee covers the cadet's initial kit issue and account setup. Payment is taken securely by card through Stripe. You can use a debit or credit card, Apple Pay or Google Pay.
      </p>
      <div className="rounded-lg bg-slate-100 px-4 py-2.5 text-sm font-mono text-slate-700 mb-4">
        Reference: <strong>{ref}</strong>
      </div>
      {error && <p className="mb-4 rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</p>}
      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
        >
          Back
        </button>
        <button
          onClick={startPayment}
          disabled={loading}
          className="flex-1 rounded-lg bg-[var(--blue)] py-2.5 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-60"
        >
          {loading ? 'One moment…' : `Pay ${FEE_LABEL} by card`}
        </button>
      </div>
      {error && (
        <div className="mt-5 pt-5 border-t border-slate-200">
          <label className="flex items-start gap-2 text-sm text-slate-600 mb-3">
            <input
              type="checkbox"
              checked={ack}
              onChange={(e) => setAck(e.target.checked)}
              className="mt-0.5"
            />
            I've already paid, or I'll sort this with the squadron directly - let me continue anyway.
          </label>
          <button
            onClick={onSkip}
            disabled={!ack}
            className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
          >
            Continue anyway
          </button>
        </div>
      )}
    </Card>
  )
}

const CONFIRM_MAX_ATTEMPTS = 73
const CONFIRM_RETRY_DELAY_MS = 2500

// The fee is a Stripe card payment, which is already settled by the time the parent is
// redirected back, so it confirms on the first try. These only exist to cover a slow
// redirect or a momentary network blip, hence the short gap and the short overall window.
const FEE_CONFIRM_MAX_ATTEMPTS = 12
const FEE_CONFIRM_RETRY_DELAY_MS = 700

export function FeeConfirmStep({ sessionId, onDone, onContinueUnconfirmed, onRetry }) {
  const [error, setError] = useState(null)
  const [ack, setAck] = useState(false)
  const [attemptNumber, setAttemptNumber] = useState(0)
  const [retryKey, setRetryKey] = useState(0)
  const onDoneRef = useRef(onDone)
  useEffect(() => { onDoneRef.current = onDone }, [onDone])

  useEffect(() => {
    let cancelled = false
    let attempt = 0
    setError(null)
    setAttemptNumber(0)

    const tryConfirm = () => {
      attempt += 1
      setAttemptNumber(attempt)
      fetch('/api/gocardless/confirm-fee-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      })
        .then(async (res) => {
          const data = await res.json()
          if (!res.ok) throw new Error(data.message || data.error || 'Could not confirm the payment yet')
          if (!cancelled) onDoneRef.current(data)
        })
        .catch((e) => {
          if (cancelled) return
          if (attempt < FEE_CONFIRM_MAX_ATTEMPTS) {
            setTimeout(tryConfirm, FEE_CONFIRM_RETRY_DELAY_MS)
          } else {
            setError(e.message)
          }
        })
    }
    tryConfirm()
    return () => {
      cancelled = true
    }
  }, [sessionId, retryKey])

  if (error) {
    return (
      <Card>
        <Eyebrow>Joining fee</Eyebrow>
        <h2 className="text-lg font-semibold text-slate-900 mb-2">We couldn't confirm that yet</h2>
        <p className="text-sm text-slate-600 mb-4">{error}</p>
        <button
          onClick={() => setRetryKey((key) => key + 1)}
          className="rounded-lg bg-[var(--blue)] px-5 py-2.5 text-sm font-semibold text-white hover:brightness-110"
        >
          Check again
        </button>
        <button onClick={onRetry} className="ml-3 text-sm font-semibold text-slate-500 hover:text-slate-700">Back to payment setup</button>
        <div className="mt-5 pt-5 border-t border-slate-200">
          <label className="flex items-start gap-2 text-sm text-slate-600 mb-3">
            <input
              type="checkbox"
              checked={ack}
              onChange={(e) => setAck(e.target.checked)}
              className="mt-0.5"
            />
            I've already completed this payment at my bank - I don't need to pay again.
          </label>
          <button
            onClick={onContinueUnconfirmed}
            disabled={!ack}
            className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
          >
            Continue anyway
          </button>
        </div>
      </Card>
    )
  }

  return (
    <Card>
      <Eyebrow>Joining fee</Eyebrow>
      <h2 className="text-lg font-semibold text-slate-900 mb-2">Confirming your payment…</h2>
      <p className="text-sm text-slate-600">Just a moment while we check that's gone through.</p>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-label="Checking payment" aria-valuemin="0" aria-valuemax={FEE_CONFIRM_MAX_ATTEMPTS} aria-valuenow={attemptNumber}>
        <div className="h-full rounded-full bg-[var(--blue)] transition-all duration-500" style={{ width: `${Math.max(15, (attemptNumber / FEE_CONFIRM_MAX_ATTEMPTS) * 100)}%` }} />
      </div>
      <p className="mt-2 text-xs text-slate-500">Your card payment has been taken. This page will continue on its own in a moment.</p>
    </Card>
  )
}

export function SubsStep({ formData, onStarted, onSkip, onBack }) {
  const ref = buildReference(formData)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [ack, setAck] = useState(false)
  const start = formData['meta.intendedStartDate'] ? new Date(formData['meta.intendedStartDate']) : null
  const delayedStart = start && !Number.isNaN(start.getTime()) && start.getTime() > Date.now() + 7 * 24 * 60 * 60 * 1000
  const startLabel = delayedStart ? start.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : ''

  const startMandate = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/gocardless/create-billing-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reference: ref,
          givenName: nameParts(formData['parent1.fullName']).forename,
          familyName: nameParts(formData['parent1.fullName']).surname,
          email: formData['parent1.primaryEmail'] || '',
          returnUrl: window.location.origin + window.location.pathname + window.location.hash,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Something went wrong starting the Direct Debit setup')
      sessionStorage.setItem(PENDING_PAYMENT_KEY, JSON.stringify({ kind: 'subs', billingRequestId: data.billingRequestId, returnRoute: window.location.hash }))
      onStarted(data.billingRequestId)
      // Single tab: send THIS tab to GoCardless. It handles any bank/QR handover
      // itself and returns us here, where the confirm step resumes from sessionStorage.
      if (!data.alreadyAuthorised) window.location.href = data.authorisationUrl
    } catch (e) {
      setError(e.message)
      setLoading(false)
    }
  }

  return (
    <Card>
      <div className="mb-5 rounded-xl border-2 border-[var(--green)] bg-[var(--green-soft)] p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-bold uppercase tracking-wide text-[var(--green)]">Payment 2 of 2</p>
          <span className="rounded-full bg-[var(--green)] px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">Repeats every month</span>
        </div>
        <h2 className="mt-2 text-2xl font-semibold text-[var(--navy)]">Monthly subs</h2>
        <p className="mt-3 text-3xl font-bold text-[var(--green)]">{SUBS_LABEL}{delayedStart && <span className="block text-sm font-medium text-slate-500">starting {startLabel}</span>}</p>
        <p className="mt-2 text-sm font-medium leading-6 text-slate-700">This is a recurring monthly Direct Debit, separate from the one-off joining fee. It continues each month until you tell us to stop.</p>
      </div>
      {delayedStart && <div className="mb-5 rounded-2xl border-4 border-[var(--green)] bg-[var(--green-soft)] p-5 text-center">
        <p className="text-sm font-bold uppercase tracking-wide text-[var(--green)]">No money will be taken today</p>
        <p className="mt-2 text-3xl font-extrabold leading-tight text-[var(--navy)]">Your first payment is<br />{startLabel}</p>
        <p className="mt-3 text-sm font-semibold leading-6 text-slate-800">Setting up the Direct Debit now does <strong>not</strong> take any payment. Nothing leaves your account until <strong>{startLabel}</strong>, when they start. You will <strong>not</strong> be charged before then.</p>
      </div>}
      <p className="mb-4 text-sm leading-6 text-slate-600">
        You will be taken to GoCardless's secure page to enter your bank details and authorise the monthly collection.
      </p>
      <div className="rounded-lg bg-slate-100 px-4 py-2.5 text-sm font-mono text-slate-700 mb-4">
        Mandate reference: <strong>{ref}</strong>
      </div>
      {error && <p className="mb-4 rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</p>}
      {delayedStart && <p className="mb-3 text-center text-sm font-bold text-[var(--green)]">Reminder: no payment will be taken until {startLabel}.</p>}
      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
        >
          Back
        </button>
        <button
          onClick={startMandate}
          disabled={loading}
          className="flex-1 rounded-lg bg-[var(--blue)] py-2.5 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-60"
        >
          {loading ? 'One moment…' : delayedStart ? `Set up Direct Debit (first payment ${startLabel})` : `Set up ${SUBS_LABEL} Direct Debit`}
        </button>
      </div>
      {error && (
        <div className="mt-5 pt-5 border-t border-slate-200">
          <label className="flex items-start gap-2 text-sm text-slate-600 mb-3">
            <input
              type="checkbox"
              checked={ack}
              onChange={(e) => setAck(e.target.checked)}
              className="mt-0.5"
            />
            I've already set this up, or I'll sort this with the squadron directly - let me continue anyway.
          </label>
          <button
            onClick={onSkip}
            disabled={!ack}
            className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
          >
            Continue anyway
          </button>
        </div>
      )}
    </Card>
  )
}

export function SubsConfirmStep({ billingRequestId, reference, startDate, onDone, onContinueUnconfirmed, onRetry }) {
  const [error, setError] = useState(null)
  const [ack, setAck] = useState(false)
  const [attemptNumber, setAttemptNumber] = useState(0)
  const [retryKey, setRetryKey] = useState(0)
  const onDoneRef = useRef(onDone)
  useEffect(() => { onDoneRef.current = onDone }, [onDone])

  useEffect(() => {
    let cancelled = false
    let attempt = 0
    setError(null)
    setAttemptNumber(0)

    const tryConfirm = () => {
      attempt += 1
      setAttemptNumber(attempt)
      fetch('/api/gocardless/confirm-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ billingRequestId, reference, startDate }),
      })
        .then(async (res) => {
          const data = await res.json()
          if (!res.ok) throw new Error(data.message || data.error || 'Could not confirm the Direct Debit yet')
          if (!cancelled) onDoneRef.current(data)
        })
        .catch((e) => {
          if (cancelled) return
          if (attempt < CONFIRM_MAX_ATTEMPTS) {
            setTimeout(tryConfirm, CONFIRM_RETRY_DELAY_MS)
          } else {
            setError(e.message)
          }
        })
    }
    tryConfirm()
    return () => {
      cancelled = true
    }
  }, [billingRequestId, reference, startDate, retryKey])

  if (error) {
    return (
      <Card>
        <Eyebrow>Direct Debit</Eyebrow>
        <h2 className="text-lg font-semibold text-slate-900 mb-2">We couldn't confirm that yet</h2>
        <p className="text-sm text-slate-600 mb-4">{error}</p>
        <button
          onClick={() => setRetryKey((key) => key + 1)}
          className="rounded-lg bg-[var(--blue)] px-5 py-2.5 text-sm font-semibold text-white hover:brightness-110"
        >
          Check again
        </button>
        <button onClick={onRetry} className="ml-3 text-sm font-semibold text-slate-500 hover:text-slate-700">Back to Direct Debit setup</button>
        <div className="mt-5 pt-5 border-t border-slate-200">
          <label className="flex items-start gap-2 text-sm text-slate-600 mb-3">
            <input
              type="checkbox"
              checked={ack}
              onChange={(e) => setAck(e.target.checked)}
              className="mt-0.5"
            />
            I've already set this up at my bank - I don't need to do it again.
          </label>
          <button
            onClick={onContinueUnconfirmed}
            disabled={!ack}
            className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
          >
            Continue anyway
          </button>
        </div>
      </Card>
    )
  }

  return (
    <Card>
      <Eyebrow>Direct Debit</Eyebrow>
      <h2 className="text-lg font-semibold text-slate-900 mb-2">Confirming your Direct Debit…</h2>
      <p className="text-sm text-slate-600">Just a moment while we finish setting up your monthly subs.</p>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-label="Checking Direct Debit" aria-valuemin="0" aria-valuemax={CONFIRM_MAX_ATTEMPTS} aria-valuenow={attemptNumber}>
        <div className="h-full rounded-full bg-[var(--blue)] transition-all duration-500" style={{ width: `${Math.max(8, (attemptNumber / CONFIRM_MAX_ATTEMPTS) * 100)}%` }} />
      </div>
      <p className="mt-2 text-xs text-slate-500">Complete the setup in the bank window or app. This page will continue automatically and can wait for up to three minutes.</p>
    </Card>
  )
}

export function GiftAidStep({ formData, update, onDone, onBack }) {
  const inheritedAddress = [formData['parent1.address.property'], formData['parent1.address.street'], formData['parent1.address.area'], formData['parent1.address.town'], formData['parent1.address.county'], formData['parent1.address.postcode']].filter(Boolean).join(', ')
  const donorName = formData['giftAid.donorName'] ?? formData['parent1.fullName'] ?? ''
  const donorAddress = formData['giftAid.address'] ?? inheritedAddress
  const giftScope = formData['giftAid.scope'] ?? 'past-and-future'
  const [error, setError] = useState(null)
  const set = (key, value) => update({ [key]: value })
  const submit = () => {
    if ((!donorName.trim() || !donorAddress.trim() || !giftScope || !formData['giftAid.confirmed'] || !String(formData['giftAid.signature'] || '').trim())) {
      setError('Please complete the donor details, choose which gifts the declaration covers, confirm the taxpayer statement, and type your signature.')
      return
    }
    update({ 'giftAid.donorName': donorName, 'giftAid.address': donorAddress, 'giftAid.scope': giftScope, 'giftAid.status': 'declared', 'giftAid.date': new Date().toISOString().slice(0, 10) })
    onDone()
  }
  const choices = [
    ['enclosed', 'The gift I am making now'],
    ['future', 'All gifts of money I make today and in the future'],
    ['past-and-future', 'All gifts of money I have made in the past six years and all future gifts I make from today'],
  ]
  return <Card>
    <Eyebrow>Gift Aid declaration</Eyebrow>
    <h2 className="text-lg font-semibold text-slate-900 mb-2">Boost your gifts by 25%</h2>
    <p className="text-sm text-slate-600 mb-4">Charity: <strong>1330 (Warrington) Squadron</strong>. Gift Aid is optional; choose “Not eligible / skip” if it does not apply.</p>
    <div className="space-y-4">
      <label className="block text-sm font-medium text-slate-800">Donor's full name *<input className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5" value={donorName} onChange={(e) => set('giftAid.donorName', e.target.value)} /></label>
      <label className="block text-sm font-medium text-slate-800">Home address and postcode *<textarea className="mt-1.5 min-h-20 w-full rounded-lg border border-slate-300 px-3 py-2.5" value={donorAddress} onChange={(e) => set('giftAid.address', e.target.value)} /></label>
      <fieldset><legend className="text-sm font-medium text-slate-800 mb-2">Please treat as Gift Aid donations: *</legend><div className="space-y-2 text-sm text-slate-700">{choices.map(([value, label]) => <label key={value} className="flex items-start gap-2"><input type="radio" name="gift-aid-scope" className="mt-1" checked={giftScope === value} onChange={() => set('giftAid.scope', value)} />{label}</label>)}</div></fieldset>
      <label className="flex items-start gap-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-700"><input type="checkbox" className="mt-1" checked={formData['giftAid.confirmed'] === true} onChange={(e) => set('giftAid.confirmed', e.target.checked)} />I confirm I have paid or will pay enough UK Income Tax and/or Capital Gains Tax in each tax year to cover the Gift Aid reclaimed by all charities and CASCs I donate to. I understand that I am responsible for any difference and that 1330 Squadron will reclaim 25p for every £1 I give.</label>
      <label className="block text-sm font-medium text-slate-800">Type your full name to sign *<input className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-2xl tracking-wide" style={{ fontFamily: '"Segoe Script", "Bradley Hand", "Brush Script MT", cursive' }} autoComplete="off" placeholder="Type your name to confirm and sign" value={formData['giftAid.signature'] || ''} onChange={(e) => set('giftAid.signature', e.target.value)} /></label>
      {error && <p className="rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</p>}
      <div className="flex flex-wrap gap-3"><button onClick={onBack} className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-600">Back</button><button onClick={() => { update({ 'giftAid.status': 'skipped' }); onDone() }} className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700">Not eligible / skip</button><button onClick={submit} className="flex-1 rounded-lg bg-[var(--blue)] px-5 py-2.5 text-sm font-semibold text-white">Submit declaration</button></div>
    </div>
  </Card>
}

export function DoneStep({ formData, onComplete, onBackToGiftAid, nextCadetName = '' }) {
  const [emailStatus, setEmailStatus] = useState('sending')
  const [emailError, setEmailError] = useState(null)
  const [parentSignalOpened, setParentSignalOpened] = useState(false)
  const [cadetSignalOpened, setCadetSignalOpened] = useState(false)
  const [parentSignalConfirmed, setParentSignalConfirmed] = useState(false)
  const [cadetSignalConfirmed, setCadetSignalConfirmed] = useState(false)
  const [uniformConfirmed, setUniformConfirmed] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [finishError, setFinishError] = useState('')
  const allNextStepsConfirmed = parentSignalConfirmed && cadetSignalConfirmed && uniformConfirmed
  const readyToFinish = allNextStepsConfirmed && emailStatus === 'sent'
  const finish = async () => {
    setFinishing(true)
    setFinishError('')
    const template = getEmailTemplates().find((item) => item.id === 'joining_complete')
    if (!['5173', '5190'].includes(window.location.port)) {
      try { await fetch('/.netlify/functions/send-joining-complete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to: formData['parent1.primaryEmail'], parentName: formData['parent1.fullName'], cadetName: formData['cadet.fullName'], startDate: formData['meta.intendedStartDate'], template }) }) } catch { /* form is complete even if the courtesy email fails */ }
    }
    try {
      await onComplete()
    } catch {
      setFinishing(false)
      setFinishError('We could not save the completed status to the Squadron system. Your form remains on this device. Please try again.')
    }
  }

  const sendEmail = () => {
    setEmailStatus('sending')
    setEmailError(null)
    fetch('/api/send-joining-form', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ formData }),
    })
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Could not send the confirmation email')
        setEmailStatus('sent')
      })
      .catch((e) => {
        setEmailError(e.message)
        setEmailStatus('error')
      })
  }

  useEffect(() => {
    sendEmail()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div>
      <div className="rounded-2xl bg-[var(--green-soft)] border border-[var(--green)]/30 px-6 py-5 mb-6 text-center">
        <p className="text-lg font-semibold text-[var(--green)] mb-1">All done - welcome to 1330 Squadron</p>
        <p className="text-sm text-slate-600 mb-3">The completed joining forms are emailed to the authorised recipients and are not retained in the recruitment portal. Your basic recruitment record remains available to you and Squadron staff.</p>
        <div className="text-sm text-slate-700 space-y-2">
          {formData['parent1.primaryEmail'] && (
            <p>
              You'll get a copy emailed to <strong>{formData['parent1.primaryEmail']}</strong> - keep it in case you
              need it, or in case the squadron asks for it again.
            </p>
          )}
          {emailStatus === 'sending' && <p className="text-slate-500">Sending your confirmation…</p>}
          {emailStatus === 'sent' && <p className="font-medium text-[var(--green)]">Confirmation sent.</p>}
          {emailStatus === 'error' && (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-left text-red-700">
              <p>Couldn't send the confirmation email: {emailError}</p>
              <button
                onClick={sendEmail}
                className="mt-2 rounded-lg border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100"
              >
                Try again
              </button>
            </div>
          )}
        </div>
      </div>

      <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-3">Next steps</p>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border border-slate-200 bg-white px-4 py-3 text-sm">
        <span className="text-slate-600">Gift Aid: <strong className="text-slate-800">{formData['giftAid.status'] === 'declared' ? 'Declaration completed' : 'Not declared'}</strong></span>
        <button type="button" onClick={onBackToGiftAid} className="font-semibold text-[var(--blue)] underline">Back to Gift Aid</button>
      </div>

      <div className="mb-5">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-[var(--green)]">
          <span className="flex h-5 w-5 items-center justify-center rounded bg-[var(--green)] text-xs text-white">✓</span>
          <span>1. Form submitted and reviewed</span>
        </div>
        <SummaryPreview formData={formData} />
      </div>

      <div className="rounded-2xl bg-[var(--navy)] text-white p-6">
        <p className="text-sm font-semibold mb-2">2. Join the 1330 Parents &amp; Guardians Group on Signal</p>
        <p className="text-sm font-bold text-white mb-2">This is mandatory and essential for every parent or guardian.</p>
        <p className="text-sm text-white/80 mb-3">We use this group for parade-night changes, event information and important squadron updates. Both parents or guardians may join, and an administrator will approve each request.</p>
        <div className="mb-4 rounded-lg bg-white/10 px-4 py-3 text-sm text-white/90">
          <p>Set your Signal name in this format: <strong>Mr Smith, parent of Cadet Smith</strong>.</p>
          <p className="mt-2">When registering, set your phone number visibility to <strong>private</strong>.</p>
        </div>
        <a
          href={SIGNAL_GROUP_URL}
          target="_blank"
          rel="noreferrer"
          onClick={() => setParentSignalOpened(true)}
          aria-disabled={parentSignalOpened}
          className={'inline-block rounded-lg px-5 py-2.5 text-sm font-semibold transition ' + (parentSignalOpened ? 'pointer-events-none bg-slate-400 text-slate-100' : 'bg-white text-[var(--navy)] hover:brightness-95')}
        >
          {parentSignalOpened ? 'Parents & Guardians group opened' : 'Join the Signal group'}
        </a>
        <p className="mt-3 text-xs text-white/60">Contact the squadron if you have any problems joining.</p>
        <label className="mt-4 flex items-start gap-2 rounded-lg bg-white/10 px-4 py-3 text-sm font-medium text-white">
          <input type="checkbox" className="mt-0.5 h-4 w-4" checked={parentSignalConfirmed} onChange={(e) => setParentSignalConfirmed(e.target.checked)} />
          I confirm the parent/guardian Signal group request has been completed
        </label>
      </div>

      <div className="mt-5 rounded-2xl border-2 border-[var(--blue)] bg-white p-6">
        <p className="text-sm font-semibold text-[var(--navy)] mb-2">3. Ask your cadet to join the Cadet Signal group</p>
        <p className="text-sm text-slate-600 mb-3">Ask your cadet to download Signal on their phone and join the cadet group.</p>
        <div className="mb-4 rounded-lg bg-[var(--navy-soft)] px-4 py-3 text-sm text-slate-700">
          <p>They must register their name in this format: <strong>Cdt James Smith</strong>.</p>
          <p className="mt-2">When registering, they must set their phone number visibility to <strong>private</strong>.</p>
        </div>
        <a href={CADET_SIGNAL_GROUP_URL} target="_blank" rel="noreferrer" onClick={() => setCadetSignalOpened(true)} aria-disabled={cadetSignalOpened} className={'inline-block rounded-lg px-5 py-2.5 text-sm font-semibold transition ' + (cadetSignalOpened ? 'pointer-events-none bg-slate-300 text-slate-500' : 'bg-[var(--blue)] text-white hover:brightness-110')}>{cadetSignalOpened ? 'Cadet group opened' : 'Join the Cadet Signal group'}</a>
        <label className="mt-4 flex items-start gap-2 rounded-lg bg-[var(--navy-soft)] px-4 py-3 text-sm font-medium text-[var(--navy)]">
          <input type="checkbox" className="mt-0.5 h-4 w-4" checked={cadetSignalConfirmed} onChange={(e) => setCadetSignalConfirmed(e.target.checked)} />
          I confirm the cadet Signal group request has been completed
        </label>
      </div>

      <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold text-[var(--navy)] mb-2">4. Uniform &amp; Equipment</p>
        <p className="text-sm text-slate-600 mb-4">Uniform is provided by the squadron once the order arrives from HQ. This can take several months.</p>
        <p className="text-sm font-semibold text-slate-800 mb-2">In addition, your cadet will need to obtain:</p>
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-slate-700">
          <li>Black parade shoes - DMS specifically; eBay is often the best place to look</li>
          <li>MTP shirt, trousers and smock</li>
          <li>MOD brown patrol boots</li>
          <li>Thick socks and boot bands (twisters)</li>
          <li>Black shoe polish and a polishing kit</li>
        </ul>
        <p className="mt-5 text-sm font-semibold text-slate-800 mb-2">Recommended suppliers:</p>
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-slate-700">
          <li>Cadet Direct - they offer a complete MTP set bundle</li>
          <li>Cadet Kit Shop</li>
        </ul>
        <label className="mt-5 flex items-start gap-2 rounded-lg bg-[var(--navy-soft)] px-4 py-3 text-sm font-medium text-[var(--navy)]">
          <input type="checkbox" className="mt-0.5 h-4 w-4" checked={uniformConfirmed} onChange={(e) => setUniformConfirmed(e.target.checked)} />
          I confirm I have seen and understood the uniform and equipment information
        </label>
      </div>

      <div className={'mt-5 rounded-2xl border px-6 py-5 text-center transition ' + (readyToFinish ? 'border-[var(--green)]/30 bg-[var(--green-soft)]' : 'border-slate-300 bg-slate-100')}>
        <p className="text-sm font-semibold text-slate-600 mb-1">5. That’s it</p>
        <p className={'text-lg font-semibold ' + (readyToFinish ? 'text-[var(--green)]' : 'text-slate-700')}>All done.</p>
        <p className="mt-1 text-sm text-slate-600">We’ll see “Cadet {formData['cadet.fullName'] || 'your cadet'}” on Monday and Thursday at 6.30pm.</p>
        <p className="mt-3 text-sm font-medium text-slate-700">Please remember they will need a notepad and pen, and a water bottle.</p>
        <p className="mt-3 text-sm font-semibold text-slate-700">{nextCadetName ? `Next, you will complete a separate form for ${nextCadetName}. Parent and guardian details will already be filled in for checking.` : 'You can now close this window.'}</p>
        {!allNextStepsConfirmed && <p className="mt-2 text-xs font-medium text-slate-500">Complete the three confirmation boxes above to finish.</p>}
        {allNextStepsConfirmed && emailStatus !== 'sent' && <p className="mt-2 text-xs font-medium text-slate-500">The joining form must be emailed successfully before this record can be completed.</p>}
        {finishError && <p className="mt-3 rounded-lg bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700">{finishError}</p>}
        {readyToFinish && <button type="button" disabled={finishing} onClick={finish} className="mt-5 w-full rounded-lg bg-[var(--green)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60">{finishing ? 'Finishing...' : nextCadetName ? `Continue with ${nextCadetName}` : 'Return to the joining portal'}</button>}
      </div>
    </div>
  )
}
