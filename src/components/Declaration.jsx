import { useEffect, useMemo } from 'react'

function ageOn(dobStr, onDateStr) {
  if (!dobStr) return null
  const uk = String(dobStr).match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  const dob = uk ? new Date(Number(uk[3]), Number(uk[2]) - 1, Number(uk[1])) : new Date(dobStr)
  const on = onDateStr ? new Date(onDateStr) : new Date()
  let age = on.getFullYear() - dob.getFullYear()
  const m = on.getMonth() - dob.getMonth()
  if (m < 0 || (m === 0 && on.getDate() < dob.getDate())) age--
  return age
}

export default function Declaration({ formData, update }) {
  const age = ageOn(formData['cadet.dob'])
  const isUnder16 = age === null ? true : age < 16
  const signatureValue = formData['health.signature']
  const sig = useMemo(() => signatureValue || {}, [signatureValue])
  const patch = (fields) => update({ 'health.signature': { ...sig, ...fields } })
  const signerName = String(isUnder16 ? formData['parent1.fullName'] || '' : formData['cadet.fullName'] || '').trim()
  const nameParts = signerName.split(/\s+/).filter(Boolean)
  const suggestedSurname = nameParts.length > 1 ? nameParts.at(-1) : ''
  const suggestedForename = nameParts.length > 1 ? nameParts.slice(0, -1).join(' ') : nameParts[0] || ''

  useEffect(() => {
    if (!signerName) return
    const removeAutomaticSignature = !sig.manualEntryRequired && sig.signature === signerName
    const next = { ...sig, forename: sig.forename || suggestedForename, surname: sig.surname || suggestedSurname, signature: removeAutomaticSignature ? '' : sig.signature || '', manualEntryRequired: true }
    if (next.forename === sig.forename && next.surname === sig.surname && next.signature === sig.signature && sig.manualEntryRequired) return
    update({ 'health.signature': next })
  }, [sig, signerName, suggestedForename, suggestedSurname, update])

  return (
    <div>
      <div className="rounded-lg bg-slate-100 px-4 py-3 text-sm text-slate-600 mb-5">
        I understand that RAF Air Cadets events and activities may be physically strenuous and may take place in
        environmental conditions involving dust, fumes, extremes of temperature or altitude. These conditions may
        aggravate my child's medical condition or conditions. I confirm that I have sought advice from a healthcare
        professional wherever there has been any doubt about my child's suitability or fitness to take part. If my
        child's condition changes after this declaration is signed, I will inform the officer in charge before my
        child travels to the event or activity.
      </div>

      <p className="text-xs text-slate-500 mb-3">
        {age === null
          ? 'Date of birth is not set, so the parent or guardian must sign.'
          : isUnder16
          ? `Cadet is ${age} and under 16. A parent or guardian must sign.`
          : `Cadet is ${age} or over. They sign for themselves.`}
      </p>

      <div className="grid grid-cols-1 gap-4">
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
          <span className="block text-xs font-medium text-slate-500">Signing as</span>
          <span className="mt-0.5 block text-[15px] font-semibold text-slate-800">{signerName}</span>
          <span className="mt-1 block text-xs text-slate-500">{isUnder16 ? 'Parent or guardian with parental responsibility' : 'Cadet aged 16 or over'}</span>
        </div>
        <label className="block text-sm font-medium text-slate-800">Type your full name to sign <span className="text-[var(--amber)]">*</span></label>
        <input
          className="-mt-3 rounded-lg border border-slate-300 px-3 py-2.5 text-2xl tracking-wide"
          style={{ fontFamily: '"Segoe Script", "Bradley Hand", "Brush Script MT", cursive' }}
          placeholder="Type your name to confirm and sign"
          value={sig.signature || ''}
          onChange={(e) => patch({ signature: e.target.value, date: e.target.value ? sig.date || new Date().toISOString().slice(0, 10) : '' })}
        />
        {sig.date && <p className="text-sm text-slate-600">Declaration date: <strong>{new Date(`${sig.date}T12:00:00`).toLocaleDateString('en-GB')}</strong></p>}
      </div>
    </div>
  )
}
