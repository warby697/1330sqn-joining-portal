function Label({ field, formData }) {
  const text = field.labelFor ? field.labelFor(formData || {}) : field.label
  return (
    <label className="block mb-1.5" htmlFor={field.id}>
      <span className="text-sm font-medium text-slate-800">{text}</span>
      {field.required && <span className="text-[var(--amber)] ml-1">*</span>}
      {field.help && <span className="block text-xs text-slate-500 mt-0.5">{field.help}</span>}
    </label>
  )
}

const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-[15px] text-slate-900 outline-none transition focus:border-[var(--blue)] focus:ring-2 focus:ring-[var(--blue)]/20'

export default function FieldRenderer({ field, value, onChange, formData }) {
  if (field.type === 'notice') {
    const text = field.textFor ? field.textFor(formData || {}) : field.text
    return (
      <div className="sm:col-span-2 rounded-lg border-2 border-[var(--amber)] bg-[var(--gold-soft)] px-4 py-3">
        <p className="text-sm font-bold text-[var(--amber)]">{text}</p>
      </div>
    )
  }

  if (field.type === 'readback') {
    const val = field.valueFor ? field.valueFor(formData || {}) : ''
    return (
      <div className="sm:col-span-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
        <span className="block text-xs font-medium text-slate-500">{field.label}</span>
        <span className="block text-[15px] font-semibold text-slate-800 mt-0.5">{val || '—'}</span>
        {field.help && <span className="block text-xs text-slate-500 mt-1">{field.help}</span>}
      </div>
    )
  }

  if (field.type === 'details') {
    return (
      <details className="sm:col-span-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 group">
        <summary className="cursor-pointer text-sm font-medium text-[var(--blue)] select-none">
          {field.summary}
        </summary>
        <div className="mt-3 space-y-3 text-sm text-slate-600 whitespace-pre-line">{field.text}</div>
      </details>
    )
  }

  if (field.type === 'text') {
    return (
      <div className={field.half ? 'sm:col-span-1' : 'sm:col-span-2'}>
        <Label field={field} formData={formData} />
        <input
          id={field.id}
          className={inputClass}
          type="text"
          value={value || ''}
          onChange={(e) => onChange(field.id, e.target.value)}
          placeholder={field.placeholder}
        />
        {field.otherValue && value === field.otherValue && field.otherField && (
          <div className="mt-3">
            <FieldRenderer field={field.otherField} value={value} onChange={onChange} />
          </div>
        )}
      </div>
    )
  }

  if (field.type === 'textarea') {
    return (
      <div className="sm:col-span-2">
        <Label field={field} />
        <textarea
          id={field.id}
          className={inputClass + ' min-h-[88px] resize-y'}
          value={value || ''}
          onChange={(e) => onChange(field.id, e.target.value)}
        />
      </div>
    )
  }

  if (field.type === 'date') {
    return (
      <div className={field.half ? 'sm:col-span-1' : 'sm:col-span-2'}>
        <Label field={field} />
        <input
          id={field.id}
          className={inputClass}
          type="date"
          value={value || ''}
          onChange={(e) => onChange(field.id, e.target.value)}
        />
      </div>
    )
  }

  if (field.type === 'yn' || field.type === 'ack') {
    const isAck = field.type === 'ack'
    return (
      <div className="sm:col-span-2">
        <Label field={field} />
        {isAck ? (
          <button
            type="button"
            onClick={() => onChange(field.id, !value)}
            className={
              'flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm font-medium transition ' +
              (value
                ? 'border-[var(--green)] bg-[var(--green-soft)] text-[var(--green)]'
                : 'border-slate-300 bg-white text-slate-600')
            }
          >
            <span
              className={
                'flex h-4 w-4 items-center justify-center rounded border ' +
                (value ? 'border-[var(--green)] bg-[var(--green)] text-white' : 'border-slate-300')
              }
            >
              {value ? '✓' : ''}
            </span>
            I confirm
          </button>
        ) : (
          <div className="flex gap-2">
            {[
              { v: true, l: 'Yes' },
              { v: false, l: 'No' },
            ].map((opt) => (
              <button
                key={String(opt.v)}
                type="button"
                onClick={() => onChange(field.id, opt.v)}
                className={
                  'rounded-lg border px-5 py-2 text-sm font-semibold transition ' +
                  (value === opt.v
                    ? opt.v
                      ? 'border-[var(--green)] bg-[var(--green-soft)] text-[var(--green)]'
                      : 'border-slate-400 bg-slate-100 text-slate-700'
                    : 'border-slate-300 bg-white text-slate-500 hover:border-slate-400')
                }
              >
                {opt.l}
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  if (field.type === 'select') {
    return (
      <div className={field.half ? 'sm:col-span-1' : 'sm:col-span-2'}>
        <Label field={field} />
        <select
          id={field.id}
          className={inputClass}
          value={value || ''}
          onChange={(e) => onChange(field.id, e.target.value)}
        >
          <option value="" disabled>
            Select…
          </option>
          {field.grouped
            ? Object.entries(
                field.options.reduce((acc, o) => {
                  const g = o.group || ''
                  ;(acc[g] ||= []).push(o)
                  return acc
                }, {})
              ).map(([group, opts]) =>
                group ? (
                  <optgroup key={group} label={group}>
                    {opts.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </optgroup>
                ) : (
                  opts.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))
                )
              )
            : field.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
        </select>
        {field.otherValue && value === field.otherValue && field.otherField && (
          <div className="mt-3">
            <FieldRenderer field={field.otherField} value={undefined} onChange={onChange} />
          </div>
        )}
      </div>
    )
  }

  if (field.type === 'checklist') {
    const arr = value || []
    const toggle = (v) => {
      onChange(field.id, arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v])
    }
    return (
      <div className="sm:col-span-2">
        <Label field={field} />
        <div className="flex flex-wrap gap-2">
          {field.options.map((o) => (
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
      </div>
    )
  }

  return null
}
