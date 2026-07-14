import FieldRenderer from './FieldRenderer'
import ConditionDetails from './ConditionDetails'
import Allergies from './Allergies'
import Declaration from './Declaration'

function isAnswered(field, formData) {
  const v = formData[field.id]
  if (field.type === 'yn' || field.type === 'ack') return typeof v === 'boolean'
  if (field.type === 'checklist') return true
  return v !== undefined && v !== null && v !== ''
}

export default function StepScreen({ step, formData, update }) {
  const onChange = (id, value) => update({ [id]: value })

  if (step.kind === 'readonly-intro') {
    return (
      <div className="rounded-xl bg-[var(--navy-soft)] px-5 py-4">
        <p className="text-sm text-slate-700">
          <span className="font-semibold">{formData['cadet.fullName'] || 'Cadet'}</span>
          {formData['cadet.dob'] && <span className="text-slate-500"> · born {formData['cadet.dob']}</span>}
        </p>
        <p className="text-xs text-slate-500 mt-1">Carried over from the form you already filled in — no need to retype it.</p>
      </div>
    )
  }

  if (step.kind === 'checklist') {
    const arr = formData[step.fieldId] || []
    const toggle = (v) => update({ [step.fieldId]: arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v] })
    return (
      <div>
        <div className="flex flex-wrap gap-2">
          {step.options.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => toggle(o.value)}
              className={
                'rounded-full border px-3.5 py-1.5 text-sm transition ' +
                (arr.includes(o.value)
                  ? 'border-[var(--blue)] bg-[var(--navy-soft)] text-[var(--navy)] font-medium'
                  : 'border-slate-300 bg-white text-slate-600 hover:border-slate-400')
              }
            >
              {o.label}
            </button>
          ))}
        </div>
        {step.otherFieldId && arr.includes('other') && (
          <input
            className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="Please give details"
            value={formData[step.otherFieldId] || ''}
            onChange={(e) => onChange(step.otherFieldId, e.target.value)}
          />
        )}
      </div>
    )
  }

  if (step.kind === 'condition-details') return <ConditionDetails formData={formData} update={update} />
  if (step.kind === 'allergies') return <Allergies formData={formData} update={update} />
  if (step.kind === 'declaration') return <Declaration formData={formData} update={update} />

  const visibleFields = step.fields.filter((f) => !f.showIf || f.showIf(formData))
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4">
      {visibleFields.map((f) => (
        <FieldRenderer key={f.id} field={f} value={formData[f.id]} onChange={onChange} formData={formData} />
      ))}
    </div>
  )
}

export function stepIsComplete(step, formData) {
  if (!step.fields) return true
  return step.fields
    .filter((f) => f.required && (!f.showIf || f.showIf(formData)))
    .every((f) => isAnswered(f, formData))
}

export function stepBlockedReason(step, formData) {
  const gateField = step.fields?.find((f) => f.gate)
  if (gateField && formData[gateField.id] === false) {
    return 'You must have parental responsibility for this cadet to submit the form.'
  }
  return null
}
