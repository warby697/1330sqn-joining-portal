import { buildReference } from '../lib/reference'
import { CONDITION_OPTIONS, ALLERGY_OPTIONS, GENDER_OPTIONS, PRONOUN_OPTIONS, NATIONALITY_OPTIONS } from '../lib/options'
import { FEE_LABEL, SUBS_LABEL } from '../lib/pricing'

const dash = (v) => (v === undefined || v === null || v === '' ? '—' : v)
const yn = (v) => (v === undefined ? undefined : v ? 'yes' : 'no')

function ConsentRow({ label, value }) {
  const v = yn(value)
  return (
    <tr className="border-b border-dotted border-slate-200">
      <td className="py-1.5 pr-2 text-slate-700">{label}</td>
      <td className="py-1.5 text-right">
        {v === undefined ? (
          <span className="text-slate-400">—</span>
        ) : (
          <span
            className={
              'inline-block rounded-full px-2.5 py-0.5 text-xs font-bold ' +
              (v === 'yes' ? 'bg-[var(--green-soft)] text-[var(--green)]' : 'bg-slate-100 text-slate-500')
            }
          >
            {v === 'yes' ? 'Yes' : 'No'}
          </span>
        )}
      </td>
    </tr>
  )
}

function Row({ k, v }) {
  return (
    <div className="flex justify-between gap-3 py-1.5 border-b border-dotted border-slate-200 text-sm">
      <span className="text-slate-500">{k}</span>
      <span className="font-semibold text-right">{dash(v)}</span>
    </div>
  )
}

const PAYMENT_STATUS_LABELS = {
  paid: { label: 'Paid', className: 'bg-[var(--green-soft)] text-[var(--green)]' },
  active: { label: 'Active', className: 'bg-[var(--green-soft)] text-[var(--green)]' },
  unconfirmed: { label: 'Not confirmed — check GoCardless', className: 'bg-[var(--gold-soft)] text-[var(--amber)]' },
}

function PaymentRow({ k, status }) {
  const info = PAYMENT_STATUS_LABELS[status]
  return (
    <div className="flex justify-between gap-3 py-1.5 border-b border-dotted border-slate-200 text-sm">
      <span className="text-slate-500">{k}</span>
      {info ? (
        <span className={'inline-block rounded-full px-2.5 py-0.5 text-xs font-bold ' + info.className}>
          {info.label}
        </span>
      ) : (
        <span className="font-semibold text-right text-slate-400">—</span>
      )}
    </div>
  )
}

export default function SummaryPreview({ formData }) {
  const ref = buildReference(formData)
  const genderLabel = GENDER_OPTIONS.find((g) => g.value === formData['cadet.gender'])?.label
  const pronounLabel = PRONOUN_OPTIONS.find((p) => p.value === formData['cadet.pronoun'])?.label
  const addr = (p) =>
    [formData[`${p}.property`], formData[`${p}.street`], formData[`${p}.town`], formData[`${p}.postcode`]]
      .filter(Boolean)
      .join(', ')
  const conditions = formData['health.conditions'] || []
  const details = formData['health.details'] || {}
  const allergies = formData['health.allergies'] || []
  const allergyDetails = formData['health.allergyDetails'] || {}
  const age = (() => {
    const dob = formData['cadet.dob']
    if (!dob) return null
    const d = new Date(dob)
    const now = new Date()
    let a = now.getFullYear() - d.getFullYear()
    if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) a--
    return a
  })()

  return (
    <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="bg-[var(--navy)] text-white px-6 py-3.5 flex justify-between items-center text-xs">
        <span className="uppercase tracking-wide opacity-85">1330 Squadron RAF Air Cadets</span>
        <span className="font-mono opacity-85">
          GENERATED {new Date().toLocaleDateString('en-GB')} · REF {ref}
        </span>
      </div>

      <div className="px-6 py-5">
        <div className="flex justify-between items-end border-b-2 border-slate-900 pb-3 mb-4">
          <h3 className="text-lg font-bold text-slate-900">Consent Certificate — Summary</h3>
          <span className="text-xs font-mono text-slate-500">Form 3822A · via joining portal</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 mb-5">
          <div>
            <Row k="Cadet" v={formData['cadet.fullName']} />
            <Row k="Date of birth" v={formData['cadet.dob'] && `${formData['cadet.dob']}${age !== null ? ` (age ${age})` : ''}`} />
            <Row k="Gender / pronoun" v={genderLabel && `${genderLabel}${pronounLabel ? ' · ' + pronounLabel : ''}`} />
            <Row k="Nationality" v={formData['cadet.nationality'] === 'other' ? formData['cadet.nationalityOther'] : NATIONALITY_OPTIONS.find((n) => n.value === formData['cadet.nationality'])?.label} />
            <Row k="School" v={formData['cadet.school']} />
            <Row k="Address" v={addr('cadet.address')} />
          </div>
          <div>
            <Row k="Parent/guardian" v={formData['parent1.fullName']} />
            <Row
              k="Parental responsibility"
              v={formData['parent1.parentalResponsibility'] === true ? 'Confirmed' : formData['parent1.parentalResponsibility'] === false ? 'Not confirmed' : undefined}
            />
            <Row
              k="Contact"
              v={[formData['parent1.mobile'], formData['parent1.primaryEmail']].filter(Boolean).join(' · ')}
            />
            <Row k="External agency involved" v={yn(formData['cadet.externalAgency']) && (formData['cadet.externalAgency'] ? 'Yes' : 'No')} />
            <Row
              k="Medical / allergy flag"
              v={
                formData['cadet.hasMedical'] === true
                  ? 'Yes — Health Declaration below'
                  : formData['cadet.hasMedical'] === false
                  ? 'No'
                  : undefined
              }
            />
          </div>
        </div>

        <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--blue)] mb-2">Payment</p>
        <div className="mb-5">
          <PaymentRow k={`Joining fee (${FEE_LABEL})`} status={formData['payment.feeStatus']} />
          <PaymentRow k={`Monthly subs (${SUBS_LABEL})`} status={formData['payment.subsStatus']} />
        </div>

        <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--blue)] mb-2">Consents given</p>
        <table className="w-full text-sm mb-2">
          <tbody>
            <ConsentRow label="Photo & video use" value={formData['consent.photo']} />
            <ConsentRow label="Flying — air experience" value={formData['consent.flyingLight']} />
            <ConsentRow label="Flying — solo gliding/powered aircraft" value={formData['consent.flyingSolo']} />
            <ConsentRow label="Flying — passenger transport/helicopters" value={formData['consent.flyingTransport']} />
            <ConsentRow label="Flying — other incl. high-performance jets" value={formData['consent.flyingOther']} />
            <ConsentRow label="Marksmanship training" value={formData['consent.marksmanship']} />
            <ConsentRow label="Strenuous physical activity" value={formData['consent.physical']} />
            <ConsentRow label="Lower-risk unit activities" value={formData['consent.lowerRisk']} />
            <ConsentRow label="Transport by staff/volunteers" value={formData['consent.transport']} />
            <ConsentRow label="Emergency medical treatment authorisation" value={formData['consent.medicalTreatment']} />
            <ConsentRow label="Contact detail sharing" value={formData['consent.contactShare']} />
          </tbody>
        </table>

        {formData['cadet.hasMedical'] === true && (
          <>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--blue)] mt-5 mb-2">
              Health Declaration (3822H) — attached
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
              <div>
                {conditions.length === 0 && <p className="text-sm text-slate-400 mb-2">No conditions detailed.</p>}
                {conditions.map((key) => {
                  const label = CONDITION_OPTIONS.find((c) => c.value === key)?.label
                  const d = details[key] || {}
                  return <Row key={key} k={label} v={d.severity ? `${d.severity}` : '—'} />
                })}
              </div>
              <div>
                {allergies.length === 0 && <p className="text-sm text-slate-400 mb-2">No allergies detailed.</p>}
                {allergies.map((key) => {
                  const label = ALLERGY_OPTIONS.find((a) => a.value === key)?.label
                  const d = allergyDetails[key] || {}
                  return (
                    <Row
                      key={key}
                      k={label}
                      v={[d.severity, d.autoInjector ? 'auto-injector' : null].filter(Boolean).join(', ') || '—'}
                    />
                  )
                })}
                <Row
                  k="Dietary restrictions"
                  v={(formData['health.dietary'] || []).length ? formData['health.dietary'].join(', ') : 'None'}
                />
                <Row
                  k="Declaration signed by"
                  v={formData['health.signature']?.signature ? `${formData['health.signature'].signature}` : undefined}
                />
              </div>
            </div>
          </>
        )}

        <div className="flex justify-between items-center border-t-2 border-slate-900 mt-5 pt-3 text-sm">
          <span>
            Signed <strong>{dash(formData['signature.signature'])}</strong>, parent/guardian
          </span>
          <span className="font-mono text-xs text-slate-500">{new Date().toLocaleString('en-GB')}</span>
        </div>

        <div className="mt-5 rounded-lg bg-[var(--navy-soft)] px-4 py-3 text-sm">
          <p className="font-semibold text-[var(--navy)] mb-1">For the parent/guardian copy of this email</p>
          <p className="text-slate-700">
            Save the 1330 Squadron Parent Portal to your phone's home screen for easy access to our signal chat,
            event notices and important squadron updates:{' '}
            <span className="font-mono text-[var(--blue)]">parent.1330squadron.example</span> — log in with the same
            PIN you used to start this form.
          </p>
        </div>
      </div>

      <div className="bg-slate-50 border-t border-slate-200 px-6 py-2.5 flex justify-between text-[11px] text-slate-500">
        <span>OFFICIAL (SENSITIVE) – PERSONAL (When completed)</span>
        <span>Portal copy purges automatically 48h after generation</span>
      </div>
    </div>
  )
}
