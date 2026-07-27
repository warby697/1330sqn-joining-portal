import { CONDITION_OPTIONS, SEVERITY_OPTIONS } from '../lib/options'

const labelFor = (key) => CONDITION_OPTIONS.find((c) => c.value === key)?.label || key

export default function ConditionDetails({ formData, update }) {
  const ticked = formData['health.conditions'] || []
  const details = formData['health.details'] || {}

  if (ticked.length === 0) {
    return (
      <p className="text-sm text-slate-500 rounded-lg bg-slate-100 px-4 py-3">
        No conditions were ticked on the previous screen, so there's nothing to add detail to here - go back if that
        wasn't right.
      </p>
    )
  }

  const patch = (key, fields) => {
    update({ 'health.details': { ...details, [key]: { ...details[key], ...fields } } })
  }

  const addMedication = (key) => {
    const cur = details[key]?.medications || []
    patch(key, { medications: [...cur, { name: '', dosage: '', storage: '' }] })
  }
  const updateMedication = (key, idx, field, value) => {
    const cur = [...(details[key]?.medications || [])]
    cur[idx] = { ...cur[idx], [field]: value }
    patch(key, { medications: cur })
  }
  const removeMedication = (key, idx) => {
    const cur = (details[key]?.medications || []).filter((_, i) => i !== idx)
    patch(key, { medications: cur })
  }

  return (
    <div className="space-y-5">
      {ticked.map((key) => {
        const d = details[key] || {}
        return (
          <div key={key} className="rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-[var(--navy)] mb-3">{labelFor(key)}</h3>

            <div className="mb-3">
              <span className="block text-xs font-medium text-slate-600 mb-1.5">Severity</span>
              <div className="flex gap-2">
                {SEVERITY_OPTIONS.map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => patch(key, { severity: s.value })}
                    className={
                      'rounded-full border px-3.5 py-1 text-xs font-medium transition ' +
                      (d.severity === s.value
                        ? 'border-[var(--amber)] bg-[var(--gold-soft)] text-[var(--amber)]'
                        : 'border-slate-300 bg-white text-slate-500')
                    }
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-3">
              <span className="block text-xs font-medium text-slate-600 mb-1.5">
                Have you sought advice from a healthcare professional?
              </span>
              <div className="flex gap-2">
                {[true, false].map((v) => (
                  <button
                    key={String(v)}
                    type="button"
                    onClick={() => patch(key, { soughtAdvice: v })}
                    className={
                      'rounded-lg border px-4 py-1.5 text-xs font-semibold transition ' +
                      (d.soughtAdvice === v
                        ? 'border-[var(--green)] bg-[var(--green-soft)] text-[var(--green)]'
                        : 'border-slate-300 bg-white text-slate-500')
                    }
                  >
                    {v ? 'Yes' : 'No'}
                  </button>
                ))}
              </div>
            </div>

            {[
              ['normal', 'How is your child affected during normal day-to-day activities?'],
              ['strenuous', 'How is your child affected during strenuous activity?'],
              ['control', 'Can they control it without further intervention?'],
            ].map(([f, label]) => (
              <div key={f} className="mb-3">
                <span className="block text-xs font-medium text-slate-600 mb-1.5">{label}</span>
                <textarea
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--blue)]"
                  rows={2}
                  value={d[f] || ''}
                  onChange={(e) => patch(key, { [f]: e.target.value })}
                />
              </div>
            ))}

            <div>
              <span className="block text-xs font-medium text-slate-600 mb-1.5">Medication</span>
              <div className="space-y-2">
                {(d.medications || []).map((m, idx) => (
                  <div key={idx} className="grid gap-2 sm:grid-cols-3">
                    <input
                      className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm"
                      placeholder="Name"
                      value={m.name}
                      onChange={(e) => updateMedication(key, idx, 'name', e.target.value)}
                    />
                    <input
                      className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm"
                      placeholder="Dosage and frequency"
                      value={m.dosage}
                      onChange={(e) => updateMedication(key, idx, 'dosage', e.target.value)}
                    />
                    <div className="flex gap-1.5">
                      <input
                        className="min-w-0 flex-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm"
                        placeholder="Where is it stored?"
                        value={m.storage}
                        onChange={(e) => updateMedication(key, idx, 'storage', e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => removeMedication(key, idx)}
                        className="px-2 text-slate-400 hover:text-[var(--amber)]"
                        aria-label="Remove medication"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => addMedication(key)}
                className="mt-2 text-xs font-medium text-[var(--blue)] hover:underline"
              >
                + Add a medication
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
