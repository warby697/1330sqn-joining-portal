function ageOn(dobStr, onDateStr) {
  if (!dobStr) return null
  const dob = new Date(dobStr)
  const on = onDateStr ? new Date(onDateStr) : new Date()
  let age = on.getFullYear() - dob.getFullYear()
  const m = on.getMonth() - dob.getMonth()
  if (m < 0 || (m === 0 && on.getDate() < dob.getDate())) age--
  return age
}

export default function Declaration({ formData, update }) {
  const age = ageOn(formData['cadet.dob'])
  const isUnder16 = age === null ? true : age < 16
  const sig = formData['health.signature'] || {}
  const patch = (fields) => update({ 'health.signature': { ...sig, ...fields } })

  return (
    <div>
      <div className="rounded-lg bg-slate-100 px-4 py-3 text-sm text-slate-600 mb-5">
        I fully understand that RAF Air Cadets events and activities may be strenuous and conducted in conditions
        that may aggravate my child's condition(s). I've consulted a healthcare professional where there was any
        doubt about my child's fitness to take part, and I'll inform the officer in charge of any change in
        condition before travelling to an activity.
      </div>

      <p className="text-sm font-medium text-slate-800 mb-1">
        {isUnder16
          ? 'Parent/guardian signature'
          : 'Cadet signature'}
      </p>
      <p className="text-xs text-slate-500 mb-3">
        {age === null
          ? 'Date of birth not set yet — defaulting to the parent/guardian block.'
          : isUnder16
          ? `Cadet is ${age}, under 16 — a parent/guardian signs.`
          : `Cadet is ${age}, 16 or over — they sign for themselves.`}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <input
          className="rounded-lg border border-slate-300 px-3 py-2.5 text-[15px]"
          placeholder="Forename"
          value={sig.forename || ''}
          onChange={(e) => patch({ forename: e.target.value })}
        />
        <input
          className="rounded-lg border border-slate-300 px-3 py-2.5 text-[15px]"
          placeholder="Surname"
          value={sig.surname || ''}
          onChange={(e) => patch({ surname: e.target.value })}
        />
        <input
          className="sm:col-span-2 rounded-lg border border-slate-300 px-3 py-2.5 text-[15px]"
          placeholder="Type your name to sign"
          value={sig.signature || ''}
          onChange={(e) => patch({ signature: e.target.value })}
        />
      </div>
    </div>
  )
}
