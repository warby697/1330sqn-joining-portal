import { useState } from 'react'
import { addDirectJoiner } from '../lib/recruitmentStore'

const inputClass = 'mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none focus:border-[var(--blue)] focus:ring-2 focus:ring-[var(--blue)]/20'
const primary = 'rounded-lg bg-[var(--blue)] px-5 py-2.5 text-sm font-semibold text-white hover:brightness-110'

const empty = {
  guardianName: '', guardianEmail: '', guardianMobile: '', postcode: '',
  cadetName: '', cadetDob: '', schoolYear: '', source: 'Direct', sourceDetail: '',
}

function Field({ label, children, help }) {
  return <label className="block"><span className="text-sm font-medium text-slate-800">{label}</span>{help && <span className="block text-xs text-slate-500 mt-0.5">{help}</span>}{children}</label>
}

// Adds a family who is joining without attending an Open Night. The record is created
// already verified and already unlocked, and the parent is emailed a link straight into
// the paperwork, so none of the open-night steps are involved.
export default function DirectJoinerDesk({ onDataChanged }) {
  const [values, setValues] = useState(empty)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const set = (key) => (event) => {
    const { value } = event.target
    setValues((current) => ({ ...current, [key]: value }))
    setError('')
  }

  const submit = async (event) => {
    event.preventDefault()
    if (busy) return
    if (!values.guardianEmail.trim() || !values.cadetName.trim() || !values.cadetDob || !values.schoolYear) {
      setError('Guardian email, cadet name, date of birth and school year are all required.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const created = await addDirectJoiner(values)
      setResult(created)
      setValues(empty)
      onDataChanged()
    } catch (creationError) {
      setError(creationError.message || 'That direct joiner could not be created.')
    }
    setBusy(false)
  }

  if (result) {
    return (
      <section className="mt-6 border-2 border-[var(--navy)] bg-white p-6">
        <p className="text-xs font-bold uppercase tracking-wide text-[var(--blue)]">Direct joiner created</p>
        <h2 className="mt-2 text-xl font-semibold text-slate-900">
          {result.family.cadets[0].fullName} is ready to start the paperwork
        </h2>
        {result.emailSent ? (
          <p className="mt-3 text-sm text-slate-700">
            The paperwork link has been emailed to <strong>{result.family.guardian.email}</strong>.
          </p>
        ) : (
          <p className="mt-3 rounded-lg bg-[var(--gold-soft)] px-4 py-2.5 text-sm text-[var(--amber)]">
            The record was created, but the email did not send: {result.emailError} Send the link below to the parent yourself.
          </p>
        )}
        <p className="mt-4 text-sm font-medium text-slate-800">Paperwork link</p>
        <p className="mt-1 break-all rounded-lg bg-slate-100 px-4 py-2.5 font-mono text-xs text-slate-700">{result.portalUrl}</p>
        <p className="mt-2 text-xs text-slate-500">This link opens the family record without a code, so treat it as private.</p>
        <button type="button" onClick={() => setResult(null)} className={`${primary} mt-5`}>Add another</button>
      </section>
    )
  }

  return (
    <section className="mt-6 border border-slate-200 bg-white p-6">
      <p className="text-xs font-bold uppercase tracking-wide text-[var(--blue)]">Direct joiner</p>
      <h2 className="mt-2 text-xl font-semibold text-slate-900">Add someone who is skipping the Open Night</h2>
      <p className="mt-2 text-sm text-slate-600">
        Use this only when the family is joining without attending an Open Night. The record is created already verified,
        the paperwork is unlocked immediately, and the parent is emailed a link straight into the Form 3822 and payments.
      </p>
      <form onSubmit={submit} className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field label="Parent or guardian name">
          <input className={inputClass} value={values.guardianName} onChange={set('guardianName')} />
        </Field>
        <Field label="Parent or guardian email">
          <input type="email" className={inputClass} value={values.guardianEmail} onChange={set('guardianEmail')} />
        </Field>
        <Field label="Mobile">
          <input className={inputClass} value={values.guardianMobile} onChange={set('guardianMobile')} />
        </Field>
        <Field label="Postcode">
          <input className={inputClass} value={values.postcode} onChange={set('postcode')} />
        </Field>
        <Field label="Cadet full name">
          <input className={inputClass} value={values.cadetName} onChange={set('cadetName')} />
        </Field>
        <Field label="Cadet date of birth">
          <input type="date" className={inputClass} value={values.cadetDob} onChange={set('cadetDob')} />
        </Field>
        <Field label="School year">
          <select className={inputClass} value={values.schoolYear} onChange={set('schoolYear')}>
            <option value="">Select</option>
            {[6, 7, 8, 9, 10, 11, 12, 13].map((year) => <option key={year} value={year}>Year {year}</option>)}
          </select>
        </Field>
        <Field label="How they came to us" help="Recorded against the enquiry for reporting">
          <input className={inputClass} value={values.sourceDetail} onChange={set('sourceDetail')} placeholder="Word of mouth, sibling, school visit" />
        </Field>
        {error && <p className="sm:col-span-2 rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</p>}
        <div className="sm:col-span-2">
          <button type="submit" disabled={busy} className={`${primary} disabled:opacity-60`}>
            {busy ? 'Creating…' : 'Create and email the paperwork link'}
          </button>
        </div>
      </form>
    </section>
  )
}
