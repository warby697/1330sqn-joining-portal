import { useState } from 'react'
import { addDirectJoiner } from '../lib/recruitmentStore'

const inputClass = 'mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none focus:border-[var(--blue)] focus:ring-2 focus:ring-[var(--blue)]/20'
const primary = 'rounded-lg bg-[var(--blue)] px-5 py-2.5 text-sm font-semibold text-white hover:brightness-110'

const empty = { guardianName: '', guardianEmail: '', cadetNames: [''] }

function Field({ label, children, help }) {
  return <label className="block"><span className="text-sm font-medium text-slate-800">{label}</span>{help && <span className="block text-xs text-slate-500 mt-0.5">{help}</span>}{children}</label>
}

// Adds a family who is joining without attending an Open Night. The record is created
// already verified and already unlocked, and the parent is emailed a link straight into
// the paperwork, so none of the open-night steps are involved.
//
// Staff often have nothing but a name and an email at this point, so that is all we ask
// for. Date of birth, school year, mobile and address are all collected from the parent
// in the Form 3822 itself.
//
// Siblings go on one record rather than two enquiries: the paperwork then chains one form
// into the next and carries the parent's own details across.
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
  const setCadetName = (index) => (event) => {
    const { value } = event.target
    setValues((current) => ({ ...current, cadetNames: current.cadetNames.map((name, i) => (i === index ? value : name)) }))
    setError('')
  }
  const addCadet = () => setValues((current) => ({ ...current, cadetNames: [...current.cadetNames, ''] }))
  const removeCadet = (index) => setValues((current) => ({ ...current, cadetNames: current.cadetNames.filter((_, i) => i !== index) }))

  const submit = async (event) => {
    event.preventDefault()
    if (busy) return
    const names = values.cadetNames.map((name) => name.trim()).filter(Boolean)
    if (!values.guardianEmail.trim() || !names.length) {
      setError('A parent email and at least one cadet name are required.')
      return
    }
    if (new Set(names.map((name) => name.toLowerCase())).size !== names.length) {
      setError('Each cadet needs a different name.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const created = await addDirectJoiner({ ...values, cadetNames: names })
      setResult(created)
      setValues(empty)
      onDataChanged()
    } catch (creationError) {
      setError(creationError.message || 'That direct joiner could not be created.')
    }
    setBusy(false)
  }

  if (result) {
    const cadets = result.family.cadets || []
    return (
      <section className="mt-6 border-2 border-[var(--navy)] bg-white p-6">
        <p className="text-xs font-bold uppercase tracking-wide text-[var(--blue)]">Direct joiner created</p>
        <h2 className="mt-2 text-xl font-semibold text-slate-900">
          {cadets.map((cadet) => cadet.fullName).join(' and ')} {cadets.length > 1 ? 'are' : 'is'} ready to start the paperwork
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
        {cadets.length > 1 && (
          <p className="mt-3 text-sm text-slate-600">
            One link covers all of them. Finishing the first form leads straight into the next, with the parent details
            carried across. Each cadet pays their own joining fee and subscription.
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
        <div className="sm:col-span-2">
          <span className="text-sm font-medium text-slate-800">Cadet full name</span>
          <span className="block text-xs text-slate-500 mt-0.5">
            Date of birth, school year and address are collected from the parent in the Form 3822. For siblings, add each
            of them here so they share one record and one link.
          </span>
          <div className="mt-1.5 grid gap-2">
            {values.cadetNames.map((name, index) => (
              <div key={index} className="flex gap-2">
                <input
                  className={`${inputClass} mt-0`}
                  value={name}
                  onChange={setCadetName(index)}
                  aria-label={`Cadet ${index + 1} full name`}
                />
                {values.cadetNames.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeCadet(index)}
                    className="rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-500 hover:bg-slate-50"
                    aria-label={`Remove cadet ${index + 1}`}
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>
          <button type="button" onClick={addCadet} className="mt-2 text-sm font-semibold text-[var(--blue)] hover:underline">
            Add a sibling
          </button>
        </div>
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
