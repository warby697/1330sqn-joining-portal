import { ALLERGY_OPTIONS, SEVERITY_OPTIONS } from '../lib/options'

export default function Allergies({ formData, update }) {
  const ticked = formData['health.allergies'] || []
  const details = formData['health.allergyDetails'] || {}

  const toggle = (v) => {
    const next = ticked.includes(v) ? ticked.filter((x) => x !== v) : [...ticked, v]
    update({ 'health.allergies': next })
  }
  const patch = (key, fields) => {
    update({ 'health.allergyDetails': { ...details, [key]: { ...details[key], ...fields } } })
  }

  return (
    <div>
      <p className="text-sm font-medium text-slate-800 mb-1.5">Does your child have any allergies?</p>
      <div className="flex flex-wrap gap-2 mb-4">
        {ALLERGY_OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => toggle(o.value)}
            className={
              'rounded-full border px-3.5 py-1.5 text-sm transition ' +
              (ticked.includes(o.value)
                ? 'border-[var(--blue)] bg-[var(--navy-soft)] text-[var(--navy)] font-medium'
                : 'border-slate-300 bg-white text-slate-600 hover:border-slate-400')
            }
          >
            {o.label}
          </button>
        ))}
      </div>

      {ticked.length === 0 && <p className="text-sm text-slate-400">Nothing ticked - skip this if none apply.</p>}

      <div className="space-y-3">
        {ticked.map((key) => {
          const label = ALLERGY_OPTIONS.find((o) => o.value === key)?.label
          const d = details[key] || {}
          return (
            <div key={key} className="rounded-xl border border-slate-200 bg-white p-4">
              <h4 className="text-sm font-semibold text-[var(--navy)] mb-3">{label}</h4>
              {key === 'other' && (
                <input
                  className="mb-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Please give details"
                  value={formData['health.allergiesOther'] || ''}
                  onChange={(e) => update({ 'health.allergiesOther': e.target.value })}
                />
              )}
              <div className="flex flex-wrap items-center gap-6">
                <div>
                  <span className="block text-xs font-medium text-slate-600 mb-1.5">Auto-injector used?</span>
                  <div className="flex gap-2">
                    {[true, false].map((v) => (
                      <button
                        key={String(v)}
                        type="button"
                        onClick={() => patch(key, { autoInjector: v })}
                        className={
                          'rounded-lg border px-4 py-1.5 text-xs font-semibold transition ' +
                          (d.autoInjector === v
                            ? 'border-[var(--green)] bg-[var(--green-soft)] text-[var(--green)]'
                            : 'border-slate-300 bg-white text-slate-500')
                        }
                      >
                        {v ? 'Yes' : 'No'}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
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
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
