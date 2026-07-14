import { useEffect, useState } from 'react'
import { buildReference } from '../lib/reference'

function Card({ children }) {
  return <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-6">{children}</div>
}

function Eyebrow({ children }) {
  return <p className="text-xs font-bold uppercase tracking-wide text-[var(--blue)] mb-2">{children}</p>
}

export function FeeStep({ formData }) {
  const ref = buildReference(formData)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const startPayment = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/gocardless/create-fee-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reference: ref,
          givenName: formData['signature.forename'] || '',
          familyName: formData['signature.surname'] || '',
          email: formData['parent1.primaryEmail'] || '',
          returnUrl: window.location.origin + window.location.pathname,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Something went wrong starting the payment')
      window.location.href = data.authorisationUrl
    } catch (e) {
      setError(e.message)
      setLoading(false)
    }
  }

  return (
    <Card>
      <Eyebrow>One-off payment</Eyebrow>
      <h2 className="text-lg font-semibold text-slate-900 mb-2">Joining fee — £30.00</h2>
      <p className="text-sm text-slate-600 mb-4">
        Covers the cadet's initial kit issue and Cadet Portal setup. Paid instantly straight from your bank via
        GoCardless — no card details needed.
      </p>
      <div className="rounded-lg bg-slate-100 px-4 py-2.5 text-sm font-mono text-slate-700 mb-4">
        Reference: <strong>{ref}</strong>
      </div>
      {error && <p className="mb-4 rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</p>}
      <button
        onClick={startPayment}
        disabled={loading}
        className="inline-block rounded-lg bg-[var(--blue)] px-5 py-2.5 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-60"
      >
        {loading ? 'One moment…' : 'Pay £30.00 via GoCardless'}
      </button>
    </Card>
  )
}

export function FeeConfirmStep({ billingRequestId, onDone, onRetry }) {
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
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
        if (!cancelled) setError(e.message)
      })
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

export function SubsStep({ formData }) {
  const ref = buildReference(formData)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const startMandate = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/gocardless/create-billing-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reference: ref,
          givenName: formData['signature.forename'] || '',
          familyName: formData['signature.surname'] || '',
          email: formData['parent1.primaryEmail'] || '',
          returnUrl: window.location.origin + window.location.pathname,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Something went wrong starting the Direct Debit setup')
      window.location.href = data.authorisationUrl
    } catch (e) {
      setError(e.message)
      setLoading(false)
    }
  }

  return (
    <Card>
      <Eyebrow>Ongoing subs</Eyebrow>
      <h2 className="text-lg font-semibold text-slate-900 mb-2">Set up monthly subs — £18.50/month</h2>
      <p className="text-sm text-slate-600 mb-4">
        Collected by Direct Debit via GoCardless — the same reference follows through so subs and this form stay
        linked in our records. You'll be taken to GoCardless's own secure page to enter your bank details.
      </p>
      <div className="rounded-lg bg-slate-100 px-4 py-2.5 text-sm font-mono text-slate-700 mb-4">
        Mandate reference: <strong>{ref}</strong>
      </div>
      {error && <p className="mb-4 rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</p>}
      <button
        onClick={startMandate}
        disabled={loading}
        className="inline-block rounded-lg bg-[var(--blue)] px-5 py-2.5 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-60"
      >
        {loading ? 'One moment…' : 'Set up Direct Debit via GoCardless'}
      </button>
    </Card>
  )
}

export function SubsConfirmStep({ billingRequestId, reference, onDone, onRetry }) {
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
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
        if (!cancelled) setError(e.message)
      })
    return () => {
      cancelled = true
    }
  }, [billingRequestId])

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
