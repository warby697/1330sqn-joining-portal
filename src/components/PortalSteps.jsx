import { useEffect, useState } from 'react'
import { buildReference, nameParts } from '../lib/reference'
import { getAdminEmails } from '../lib/adminEmails'
import { FEE_LABEL, SUBS_LABEL } from '../lib/pricing'
import SummaryPreview from './SummaryPreview'

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

export function FeeStep({ formData, onSkip, onBack }) {
  const ref = buildReference(formData)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [ack, setAck] = useState(false)

  const startPayment = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/gocardless/create-fee-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reference: ref,
          givenName: nameParts(formData['parent1.fullName']).forename,
          familyName: nameParts(formData['parent1.fullName']).surname,
          email: formData['parent1.primaryEmail'] || '',
          returnUrl: window.location.origin + window.location.pathname,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Something went wrong starting the payment')
      sessionStorage.setItem(PENDING_PAYMENT_KEY, JSON.stringify({ kind: 'fee', billingRequestId: data.billingRequestId }))
      window.location.href = data.authorisationUrl
    } catch (e) {
      setError(e.message)
      setLoading(false)
    }
  }

  return (
    <Card>
      <Eyebrow>One-off payment</Eyebrow>
      <h2 className="text-lg font-semibold text-slate-900 mb-2">Joining fee — {FEE_LABEL}</h2>
      <p className="text-sm text-slate-600 mb-4">
        Covers the cadet's initial kit issue and Cadet Portal setup. Paid instantly straight from your bank via
        GoCardless — no card details needed.
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
          {loading ? 'One moment…' : `Pay ${FEE_LABEL} via GoCardless`}
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
            I've already paid, or I'll sort this with the squadron directly — let me continue anyway.
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

const CONFIRM_MAX_ATTEMPTS = 4
const CONFIRM_RETRY_DELAY_MS = 2500

export function FeeConfirmStep({ billingRequestId, onDone, onRetry }) {
  const [error, setError] = useState(null)
  const [ack, setAck] = useState(false)

  useEffect(() => {
    let cancelled = false
    let attempt = 0

    const tryConfirm = () => {
      attempt += 1
      fetch('/api/gocardless/confirm-fee-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ billingRequestId }),
      })
        .then(async (res) => {
          const data = await res.json()
          if (!res.ok) throw new Error(data.message || data.error || 'Could not confirm the payment yet')
          if (!cancelled) onDone()
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
  }, [billingRequestId])

  if (error) {
    return (
      <Card>
        <Eyebrow>Joining fee</Eyebrow>
        <h2 className="text-lg font-semibold text-slate-900 mb-2">We couldn't confirm that yet</h2>
        <p className="text-sm text-slate-600 mb-4">{error}</p>
        <button
          onClick={onRetry}
          className="rounded-lg bg-[var(--blue)] px-5 py-2.5 text-sm font-semibold text-white hover:brightness-110"
        >
          Back to payment
        </button>
        <div className="mt-5 pt-5 border-t border-slate-200">
          <label className="flex items-start gap-2 text-sm text-slate-600 mb-3">
            <input
              type="checkbox"
              checked={ack}
              onChange={(e) => setAck(e.target.checked)}
              className="mt-0.5"
            />
            I've already completed this payment at my bank — I don't need to pay again.
          </label>
          <button
            onClick={onDone}
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
    </Card>
  )
}

export function SubsStep({ formData, onSkip, onBack }) {
  const ref = buildReference(formData)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [ack, setAck] = useState(false)

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
          returnUrl: window.location.origin + window.location.pathname,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Something went wrong starting the Direct Debit setup')
      sessionStorage.setItem(PENDING_PAYMENT_KEY, JSON.stringify({ kind: 'subs', billingRequestId: data.billingRequestId }))
      window.location.href = data.authorisationUrl
    } catch (e) {
      setError(e.message)
      setLoading(false)
    }
  }

  return (
    <Card>
      <Eyebrow>Ongoing subs</Eyebrow>
      <h2 className="text-lg font-semibold text-slate-900 mb-2">Set up monthly subs — {SUBS_LABEL}</h2>
      <p className="text-sm text-slate-600 mb-4">
        Collected by Direct Debit via GoCardless — the same reference follows through so subs and this form stay
        linked in our records. You'll be taken to GoCardless's own secure page to enter your bank details.
      </p>
      <div className="rounded-lg bg-slate-100 px-4 py-2.5 text-sm font-mono text-slate-700 mb-4">
        Mandate reference: <strong>{ref}</strong>
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
          onClick={startMandate}
          disabled={loading}
          className="flex-1 rounded-lg bg-[var(--blue)] py-2.5 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-60"
        >
          {loading ? 'One moment…' : 'Set up Direct Debit via GoCardless'}
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
            I've already set this up, or I'll sort this with the squadron directly — let me continue anyway.
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

export function SubsConfirmStep({ billingRequestId, reference, onDone, onRetry }) {
  const [error, setError] = useState(null)
  const [ack, setAck] = useState(false)

  useEffect(() => {
    let cancelled = false
    let attempt = 0

    const tryConfirm = () => {
      attempt += 1
      fetch('/api/gocardless/confirm-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ billingRequestId, reference }),
      })
        .then(async (res) => {
          const data = await res.json()
          if (!res.ok) throw new Error(data.message || data.error || 'Could not confirm the Direct Debit yet')
          if (!cancelled) onDone()
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
  }, [billingRequestId, reference])

  if (error) {
    return (
      <Card>
        <Eyebrow>Direct Debit</Eyebrow>
        <h2 className="text-lg font-semibold text-slate-900 mb-2">We couldn't confirm that yet</h2>
        <p className="text-sm text-slate-600 mb-4">{error}</p>
        <button
          onClick={onRetry}
          className="rounded-lg bg-[var(--blue)] px-5 py-2.5 text-sm font-semibold text-white hover:brightness-110"
        >
          Back to Direct Debit setup
        </button>
        <div className="mt-5 pt-5 border-t border-slate-200">
          <label className="flex items-start gap-2 text-sm text-slate-600 mb-3">
            <input
              type="checkbox"
              checked={ack}
              onChange={(e) => setAck(e.target.checked)}
              className="mt-0.5"
            />
            I've already set this up at my bank — I don't need to do it again.
          </label>
          <button
            onClick={onDone}
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
    </Card>
  )
}

export function DoneStep({ formData }) {
  const [emailStatus, setEmailStatus] = useState('sending')
  const [emailError, setEmailError] = useState(null)

  const sendEmail = () => {
    setEmailStatus('sending')
    setEmailError(null)
    fetch('/api/send-joining-form', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ formData, recipients: getAdminEmails() }),
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
        <p className="text-lg font-semibold text-[var(--green)] mb-1">All done — welcome to 1330 Squadron</p>
        <p className="text-sm text-slate-600 mb-3">Nothing is stored in this portal — it's cleared automatically.</p>
        <div className="text-sm text-slate-700 space-y-2">
          {formData['parent1.primaryEmail'] && (
            <p>
              You'll get a copy emailed to <strong>{formData['parent1.primaryEmail']}</strong> — keep it in case you
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

      <div className="mb-5">
        <p className="text-sm font-semibold text-slate-800 mb-2">1. Review what you've submitted</p>
        <SummaryPreview formData={formData} />
      </div>

      <div className="rounded-2xl bg-[var(--navy)] text-white p-6">
        <p className="text-sm font-semibold mb-2">2. Continue to the Parent Portal</p>
        <p className="text-sm text-white/80 mb-4">
          That's where you'll find the Signal group link, event notices, uniform ordering, and everything else going
          forward — not email. Log in with the same PIN you used to start today
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
          Demo only — the Parent Portal isn't built yet. When it is, staff rotating this PIN for new sign-ups will
          rotate the same PIN for parent access at the same time — one change, both apps.
        </p>
      </div>
    </div>
  )
}
