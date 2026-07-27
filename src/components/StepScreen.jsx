import FieldRenderer from './FieldRenderer'
import ConditionDetails from './ConditionDetails'
import Allergies from './Allergies'
import Declaration from './Declaration'

function isAnswered(field, formData) {
  const v = formData[field.id]
  if (field.type === 'ack') return v === true
  if (field.type === 'yn') return typeof v === 'boolean'
  if (field.type === 'checklist') return Array.isArray(v) && v.length > 0
  return v !== undefined && v !== null && String(v).trim() !== ''
}

function fieldRequired(field, formData) {
  if (typeof field.requiredIf === 'function') return field.requiredIf(formData)
  return Boolean(field.required)
}

const filled = (v) => v !== undefined && v !== null && String(v).trim() !== ''
const displayDob = (value) => {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/)
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value
}

export default function StepScreen({ step, formData, update }) {
  const onChange = (id, value) => {
    const patch = { [id]: value }
    const match = id.match(/^(parent[12])\.addressSameAsCadet$/)
    if (match && value === true) {
      for (const part of ['property', 'street', 'area', 'town', 'county', 'postcode']) {
        patch[`${match[1]}.address.${part}`] = formData[`cadet.address.${part}`] || ''
      }
    }
    update(patch)
  }

  if (step.kind === 'readonly-intro') {
    return (
      <div className="rounded-xl bg-[var(--navy-soft)] px-5 py-4">
        <p className="text-sm text-slate-700">
          <span className="font-semibold">{formData['cadet.fullName'] || 'Cadet'}</span>
          {formData['cadet.dob'] && <span className="text-slate-500"> · born {displayDob(formData['cadet.dob'])}</span>}
        </p>
        <p className="text-xs text-slate-500 mt-1">Carried over from the form you already filled in - no need to retype it.</p>
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

// Returns a human-readable reason the step can't be completed yet, or null if it's good to go.
// Also covers the custom `kind` screens (declaration, condition-details), which have no
// `fields` array and would otherwise skip validation entirely.
export function stepIncompleteReason(step, formData) {
  if (step.kind === 'declaration') {
    const sig = formData['health.signature'] || {}
    if (!(filled(sig.forename) && filled(sig.surname) && filled(sig.signature))) {
      return 'Please add the signature to complete the health declaration.'
    }
    return null
  }
  if (step.kind === 'condition-details') {
    const ticked = formData['health.conditions'] || []
    const details = formData['health.details'] || {}
    if (!ticked.every((key) => filled(details[key]?.severity))) {
      return 'Please choose a severity for each condition you ticked.'
    }
    return null
  }

  if (!step.fields) return null

  const missing = step.fields.find(
    (f) => fieldRequired(f, formData) && (!f.showIf || f.showIf(formData)) && !isAnswered(f, formData)
  )
  if (missing) return 'Please fill in the required fields (marked *) before continuing.'

  if (typeof step.completeIf === 'function' && !step.completeIf(formData)) {
    return step.incompleteMessage || 'Please complete this section before continuing.'
  }
  return null
}

export function stepBlockedReason(step, formData) {
  const gateField = step.fields?.find((f) => f.gate)
  if (gateField && formData[gateField.id] === false) {
    return 'You must have parental responsibility for this cadet to submit the form.'
  }
  return null
}
