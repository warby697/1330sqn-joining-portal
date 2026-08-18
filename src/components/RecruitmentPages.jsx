import { useEffect, useMemo, useRef, useState } from 'react'
import { AdminSettingsPanel } from './AdminSettings'
import AdminCommunications from './AdminCommunications'
import DirectJoinerDesk from './DirectJoinerDesk'
import {
  OPEN_NIGHTS, OPEN_NIGHT_ADDRESS, addCadetToFamily, addStaffNote, bookOpenNight, createEnquiry, deleteCadetEnquiry, formatDate,
  getCommunicationSchedule, getFamily, getOpenNightManagement, getOpenNightRoster, hasMissedIntake, hydrateSharedFamily, hydrateStaffRecruitmentData, joiningCodeExpired, listFamilies, markAttended, messagesForFamily, persistFamily, removeCachedFamily, setCadetStatus,
  sendDidNotAttendEmail, sendJoiningCodeEmail, sendOpenNightConfirmation, sendParentVerificationEmail, sendWithdrawalConfirmationEmail, setOpenNightAttendance, updateGuardianDetails, updateOpenNightManagement, verifyGuardian,
} from '../lib/recruitmentStore'
import { requestFamilyAccess } from '../lib/sharedRecruitmentStore'

const inputClass = 'mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none focus:border-[var(--blue)] focus:ring-2 focus:ring-[var(--blue)]/20'
const primary = 'rounded-lg bg-[var(--blue)] px-5 py-2.5 text-sm font-semibold text-white hover:brightness-110'
const secondary = 'rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50'
const INTEREST_DRAFT_KEY = 'joining-portal:interest-draft:v2'
const emptyInterestForm = { submittedBy: 'parent', guardianName: '', guardianEmail: '', guardianMobile: '', cadetName: '', cadetDob: '', schoolYear: '', source: 'Website', schoolName: '', communicationsConsent: false }
const formatDobInput = (value) => {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 8)
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean).join('/')
}
const dobToIso = (value) => {
  const match = String(value || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!match) return ''
  const [, day, month, year] = match
  const date = new Date(Number(year), Number(month) - 1, Number(day))
  if (date.getFullYear() !== Number(year) || date.getMonth() !== Number(month) - 1 || date.getDate() !== Number(day)) return ''
  return `${year}-${month}-${day}`
}
const WITHDRAWAL_REASONS = [
  ['changed_mind', 'Changed their mind'], ['wait_too_long', 'Wait to start was too long'], ['open_night_experience', 'Open Night did not meet expectations'],
  ['dates_unsuitable', 'Open Night dates were unsuitable'], ['joined_elsewhere', 'Joined another organisation'], ['moved_away', 'Moved away'],
  ['eligibility', 'Age or eligibility issue'], ['unable_to_contact', 'Unable to contact family'], ['cost', 'Cost or equipment concerns'], ['other', 'Other reason'],
]
const withdrawalLabel = (value) => WITHDRAWAL_REASONS.find(([key]) => key === value)?.[1] || 'Reason not recorded'

function Page({ children, wide = false }) {
  return <main className={`mx-auto px-5 py-8 ${wide ? 'max-w-6xl' : 'max-w-2xl'}`}>{children}</main>
}

function Field({ label, children, help }) {
  return <label className="block"><span className="text-sm font-medium text-slate-800">{label}</span>{help && <span className="block text-xs text-slate-500 mt-0.5">{help}</span>}{children}</label>
}

export function RecruitmentHome({ navigate }) {
  const [email, setEmail] = useState('')
  const [returnLinkSent, setReturnLinkSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const openFamily = async () => {
    setBusy(true)
    setError('')
    try {
      const result = await requestFamilyAccess(email)
      if (!result.found) {
        setError('No record exists for that email address. Register your interest first, or check the address and try again.')
        return
      }
      setReturnLinkSent(true)
    } catch (accessError) {
      setError(accessError.message || 'The joining record could not be opened.')
    } finally {
      setBusy(false)
    }
  }
  return <Page>
    <section className="relative overflow-hidden rounded-3xl bg-[var(--navy)] px-6 py-9 text-white shadow-xl shadow-slate-900/10 sm:px-10">
      <div className="relative z-10 max-w-[34rem] sm:max-w-[21rem]">
        <p className="text-sm font-semibold text-[var(--sky)]">1330 (Warrington) Squadron</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Interested in joining 1330 Squadron?</h1>
        <p className="mt-4 max-w-xl text-sm leading-6 text-white/80">Register your interest. We will contact your parent or guardian, arrange an open night and explain what happens next.</p>
        <div className="mt-6 flex flex-wrap gap-3"><button onClick={() => navigate('interest')} className="rounded-lg bg-[var(--sky)] px-5 py-2.5 text-sm font-semibold text-[var(--blue)] hover:brightness-105">Register your interest</button><button onClick={() => document.getElementById('continue-enquiry')?.scrollIntoView({ behavior: 'smooth' })} className="rounded-lg border border-white/40 px-5 py-2.5 text-sm font-semibold text-white">Already registered? Continue</button></div>
      </div>
      <img src="/squadron-crest.png" alt="1330 (Warrington) Squadron crest" className="pointer-events-none absolute -bottom-8 -right-5 w-44 opacity-20 sm:bottom-4 sm:right-6 sm:w-48 sm:opacity-100" />
    </section>

    <section className="mt-6 grid gap-4 sm:grid-cols-3">
      {[
        ['1', 'Register interest', 'A parent creates the family enquiry. Cadet enquiries cannot proceed without parent details.'],
        ['2', 'Attend an open night', 'Meet the team, see the squadron and ask questions before paperwork begins.'],
        ['3', 'Complete paperwork', 'Attendance unlocks the existing joining forms, payments and confirmed start date.'],
      ].map(([number, title, text]) => <article key={number} className="rounded-2xl border border-slate-200 bg-white p-5"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--navy-soft)] text-sm font-bold text-[var(--navy)]">{number}</span><h2 className="mt-3 font-semibold text-slate-900">{title}</h2><p className="mt-1 text-sm leading-5 text-slate-500">{text}</p></article>)}
    </section>

    <form id="continue-enquiry" onSubmit={(event) => { event.preventDefault(); openFamily() }} className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
      <h2 className="font-semibold text-slate-900">Already registered? Continue your enquiry</h2>
      <p className="mt-1 text-sm text-slate-500">{returnLinkSent ? `A secure return link has been sent to ${email}.` : 'Enter the parent email address used when the interest was registered. We will email a secure link to open the family record.'}</p>
      {!returnLinkSent && <div className="mt-4 flex flex-col gap-3 sm:flex-row"><input type="email" required className={inputClass + ' mt-0'} placeholder="Parent email address" value={email} onChange={(e) => { setEmail(e.target.value); setError('') }} /><button type="submit" disabled={busy} className={primary + ' disabled:opacity-50'}>{busy ? 'Please wait...' : 'Email secure return link'}</button></div>}
      {returnLinkSent && <div className="mt-4 flex flex-wrap gap-4"><button type="button" onClick={() => navigate('interest')} className="text-sm font-semibold text-[var(--blue)] underline">I have not registered yet</button><button type="button" onClick={() => { setReturnLinkSent(false); setError('') }} className="text-sm font-semibold text-slate-600 underline">Use a different email address</button></div>}
      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
      {error.startsWith('No record exists') && <button type="button" onClick={() => navigate('interest')} className={primary + ' mt-4'}>Register your interest</button>}
    </form>
    <div className="mt-6 flex justify-center"><button onClick={() => navigate('staff')} className="text-xs font-semibold text-slate-400 hover:text-slate-600">Local staff recruitment pipeline</button></div>
  </Page>
}

export function InterestForm({ navigate }) {
  const [values, setValues] = useState(() => {
    try { return { ...emptyInterestForm, ...JSON.parse(sessionStorage.getItem(INTEREST_DRAFT_KEY) || '{}') } }
    catch { return emptyInterestForm }
  })
  const [family, setFamily] = useState(null)
  const [error, setError] = useState('')
  const [showTerms, setShowTerms] = useState(false)
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const submitLock = useRef(false)
  const familyIdRef = useRef(null)
  const set = (key, value) => setValues((current) => ({ ...current, [key]: value }))
  useEffect(() => { sessionStorage.setItem(INTEREST_DRAFT_KEY, JSON.stringify(values)) }, [values])
  const submit = async (event) => {
    event.preventDefault()
    const cadetLed = values.submittedBy === 'cadet'
    const cadetDob = dobToIso(values.cadetDob)
    const required = cadetLed
      ? ['cadetName', 'cadetDob', 'schoolYear']
      : ['guardianName', 'guardianEmail', 'guardianMobile', 'cadetName', 'cadetDob', 'schoolYear']
    if ((required.some((key) => !String(values[key]).trim()) || !cadetDob || (values.source === 'School' && !values.schoolName.trim()) || (!cadetLed && !values.communicationsConsent))) {
      setError('Complete every required field and confirm permission for recruitment communications.')
      return
    }
    if (!cadetLed && !showTerms) { setShowTerms(true); setError(''); window.scrollTo({ top: 0, behavior: 'auto' }); return }
    if (!cadetLed && !termsAccepted) { setError('Read and accept the data and portal terms to continue.'); return }
    if (submitLock.current) return
    submitLock.current = true
    setSubmitting(true)
    const created = createEnquiry({ ...values, cadetDob, communicationsConsent: cadetLed ? false : values.communicationsConsent, dataTermsAccepted: !cadetLed && termsAccepted }, familyIdRef.current)
    familyIdRef.current = created.id
    try {
      await persistFamily(created)
    } catch {
      removeCachedFamily(created.id)
      familyIdRef.current = null
      submitLock.current = false
      setSubmitting(false)
      setError('We could not save this enquiry to the Squadron system. No confirmation email has been sent. Please try again.')
      return
    }
    if (!cadetLed) {
      try { await sendParentVerificationEmail(created) } catch { /* record remains available for staff follow-up */ }
    }
    sessionStorage.removeItem(INTEREST_DRAFT_KEY)
    setFamily(created)
  }
  if (family) return <VerificationPage familyId={family.id} navigate={navigate} cadetLed={values.submittedBy === 'cadet'} />
  const cadetLed = values.submittedBy === 'cadet'
  if (showTerms && !cadetLed) return <Page><button type="button" onClick={() => { setShowTerms(false); setError('') }} className="mb-5 text-sm font-semibold text-slate-500">← Check enquiry details</button><div className="rounded-2xl border border-slate-200 bg-white p-7"><p className="text-xs font-bold uppercase tracking-wide text-[var(--blue)]">Data and portal terms</p><h1 className="mt-2 text-2xl font-semibold text-slate-900">Before you submit the enquiry</h1><div className="mt-5 space-y-4 text-sm leading-6 text-slate-700"><p><strong>What we store:</strong> the parent or guardian's name, email and mobile number; the prospective cadet's name, date of birth and school year; how you heard about us; and your Open Night bookings, attendance, joining progress, our email history with you and any staff notes. We use this to arrange Open Nights, contact you and manage the recruitment process.</p><p><strong>Where it is kept:</strong> these records are held in a secure Google Firebase database and are visible to Squadron recruitment staff. Payment and Direct Debit details are handled by our payment provider, GoCardless; we only receive the result. Emails are sent through an email provider.</p><p><strong>The joining form (Form 3822):</strong> if your cadet goes on to join, this formal enrolment form collects further details, including any medical or health information needed to keep them safe on activities. It is completed in your browser, emailed to the Squadron and to you, and entered onto Bader, the RAF Air Cadets' official membership system. This portal does not keep a copy of the completed 3822.</p><p><strong>Keeping and removing your information:</strong> we keep your recruitment record while your application is active. You can withdraw at any time, which stops recruitment emails and deletes the enquiry, and you can contact the Squadron to have your information removed.</p></div><label className="mt-6 flex items-start gap-3 border-2 border-[var(--navy)] bg-[var(--navy-soft)] p-4 text-sm text-slate-800"><input type="checkbox" className="mt-0.5 h-4 w-4" checked={termsAccepted} onChange={(event) => setTermsAccepted(event.target.checked)} /><span>I am the parent or guardian named in this enquiry. I have read and understood how the joining portal uses and retains our information, and I agree to these terms.</span></label>{error && <p className="mt-3 text-sm text-red-700">{error}</p>}<button type="button" onClick={submit} disabled={submitting} className={primary + ' mt-5 w-full disabled:opacity-50'}>{submitting ? 'Saving…' : 'Accept and submit enquiry'}</button></div></Page>
  return <Page>
    <section className="relative mb-6 overflow-hidden rounded-2xl bg-[var(--navy)] px-6 py-7 pr-28 text-white shadow-lg"><div className="relative z-10 max-w-md"><p className="text-xs font-bold uppercase tracking-wide text-[var(--sky)]">1330 (Warrington) Squadron</p><h1 className="mt-2 text-2xl font-semibold">Start your Air Cadet journey</h1></div><img src="/squadron-crest.png" alt="" className="pointer-events-none absolute bottom-3 right-4 top-3 h-[calc(100%-1.5rem)] w-20 object-contain opacity-90 sm:right-6 sm:w-24" /></section>
    <button onClick={() => navigate('')} className="mb-5 text-sm font-semibold text-slate-500">← Back</button>
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <p className="text-xs font-bold uppercase tracking-wide text-[var(--blue)]">Expression of interest</p>
      <h1 className="mt-2 text-2xl font-semibold text-slate-900">Register an interest</h1>
      <p className="mt-2 text-sm text-slate-500">This is not the formal joining paperwork. It lets us invite you to an open night and keep you informed.</p>
      <form onSubmit={submit} className="mt-6 space-y-5">
        <fieldset><legend className="text-sm font-medium text-slate-800">Who is completing this?</legend><div className="mt-2 flex gap-2">{[['parent', 'Parent / guardian'], ['cadet', 'Prospective cadet']].map(([value, label]) => <button type="button" key={value} onClick={() => set('submittedBy', value)} className={values.submittedBy === value ? primary : secondary}>{label}</button>)}</div></fieldset>
        {cadetLed && <div className="rounded-xl border-2 border-[var(--amber)] bg-[var(--gold-soft)] p-4 text-sm text-[var(--amber)]"><p className="font-bold">We need your parent or guardian to continue.</p><p className="mt-1">Complete what you know, then use the message on the next page to show your parent or guardian. We will not contact them just because you entered their details.</p></div>}
        <div className="grid gap-4 sm:grid-cols-2"><Field label="Prospective cadet’s full name"><input className={inputClass} value={values.cadetName} onChange={(e) => set('cadetName', e.target.value)} /></Field><Field label="Cadet’s date of birth"><input type="text" inputMode="numeric" autoComplete="bday" maxLength={10} placeholder="DD/MM/YYYY" className={inputClass} value={values.cadetDob} onChange={(e) => set('cadetDob', formatDobInput(e.target.value))} /></Field><Field label="Current school year"><select className={inputClass} value={values.schoolYear} onChange={(e) => set('schoolYear', e.target.value)}><option value="">Select…</option>{Array.from({ length: 9 }, (_, index) => index + 5).map((year) => <option key={year} value={year}>Year {year}</option>)}</select></Field></div>
        <hr className="border-slate-200" />
        <h2 className="font-semibold text-slate-900">Parent or guardian details</h2>
        <Field label={cadetLed ? 'Parent or guardian name, if known' : 'Parent/guardian full name'}><input className={inputClass} value={values.guardianName} onChange={(e) => set('guardianName', e.target.value)} /></Field>
        <div className="grid gap-4 sm:grid-cols-2"><Field label={cadetLed ? 'Parent email, if known' : 'Parent email'}><input type="email" className={inputClass} value={values.guardianEmail} onChange={(e) => set('guardianEmail', e.target.value)} /></Field><Field label={cadetLed ? 'Parent mobile, if known' : 'Parent mobile'}><input inputMode="tel" className={inputClass} value={values.guardianMobile} onChange={(e) => set('guardianMobile', e.target.value)} /></Field></div>
        <Field label="How did you hear about us?"><select className={inputClass} value={values.source} onChange={(e) => { set('source', e.target.value); if (e.target.value !== 'School') set('schoolName', '') }}>{['Website', 'Public event', 'School', 'Friend or family', 'Social media', 'Staff referral', 'Other'].map((option) => <option key={option}>{option}</option>)}</select></Field>
        {values.source === 'School' && <Field label="Which school?"><input className={inputClass} value={values.schoolName} onChange={(event) => set('schoolName', event.target.value)} placeholder="School name" /></Field>}
        {cadetLed && <p className="text-sm text-slate-600">Parent details are optional here. Your parent can add or correct them after opening the link on the next page.</p>}
        <label className="flex items-start gap-3 border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700"><input type="checkbox" className="mt-0.5 h-4 w-4" checked={values.communicationsConsent} onChange={(e) => set('communicationsConsent', e.target.checked)} /><span>{cadetLed ? 'I understand that a parent or guardian must complete and verify this enquiry.' : 'I am the parent or guardian named above and agree to receive recruitment, open-night and start-date communications.'}</span></label>
        {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
        <button disabled={submitting} className={primary + ' w-full disabled:opacity-50'}>{submitting ? 'Saving…' : 'Submit interest'}</button>
      </form>
    </div>
  </Page>
}

function VerificationPage({ familyId, navigate, cadetLed = false, embedded = false, onVerified }) {
  const [family, setFamily] = useState(() => getFamily(familyId))
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [emailStatus, setEmailStatus] = useState('')
  const [shareStatus, setShareStatus] = useState('')
  const canShare = typeof navigator.share === 'function'
  const localPreview = ['localhost', '127.0.0.1'].includes(window.location.hostname) || /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(window.location.hostname)
  const [details, setDetails] = useState(() => ({
    fullName: family.guardian.fullName || '', email: family.guardian.email || '', mobile: family.guardian.mobile || '',
    communicationsConsent: Boolean(family.communicationsConsent), dataTermsAccepted: Boolean(family.dataTermsAcceptedAt),
  }))
  const parentLink = `${window.location.origin}${window.location.pathname}#/family/${family.id}/${family._portalToken || ''}`
  const parentMessage = `I’ve seen 1330 Warrington Squadron Air Cadets and I’d really like to join. They need a parent or guardian to complete the next step with me. Can you fill this in for me, please?\n\n${parentLink}`
  const copyParentMessage = async () => {
    try {
      await navigator.clipboard.writeText(parentMessage)
      return true
    } catch {
      const copyArea = document.createElement('textarea')
      copyArea.value = parentMessage
      copyArea.setAttribute('readonly', '')
      copyArea.style.position = 'fixed'
      copyArea.style.opacity = '0'
      document.body.appendChild(copyArea)
      copyArea.select()
      const copied = document.execCommand('copy')
      document.body.removeChild(copyArea)
      return copied
    }
  }
  const shareWithParent = async () => {
    setShareStatus('')
    try {
      if (canShare) {
        await navigator.share({ title: '1330 Squadron Air Cadets', text: parentMessage })
        setShareStatus('Ready for your parent or guardian.')
      } else {
        const copied = await copyParentMessage()
        setShareStatus(copied ? 'Message and link copied. Paste it into WhatsApp, a text message or an email to your parent or guardian.' : 'Select the message above and copy it manually.')
      }
    } catch (shareError) {
      if (shareError?.name === 'AbortError') return
      const copied = await copyParentMessage()
      setShareStatus(copied ? 'Message and link copied. Paste it into WhatsApp, a text message or an email to your parent or guardian.' : 'Select the message above and copy it manually.')
    }
  }
  const copyForParent = async () => {
    const copied = await copyParentMessage()
    setShareStatus(copied ? 'Message and link copied. Paste it into WhatsApp, a text message or an email to your parent or guardian.' : 'Select the message above and copy it manually.')
  }
  const saveParentDetails = async () => {
    const required = ['fullName', 'email', 'mobile']
    if ((required.some((key) => !String(details[key]).trim()) || !details.communicationsConsent || !details.dataTermsAccepted)) {
      setError('Complete the parent contact details and accept the communications and data terms.')
      return
    }
    let updated
    try {
      updated = await updateGuardianDetails(family.id, details)
    } catch {
      setError('Your details could not be saved. Check your connection and try again.')
      return
    }
    setFamily(updated)
    try {
      await sendParentVerificationEmail(updated)
      setEmailStatus('sent')
      setError('')
    } catch {
      setEmailStatus('failed')
      setError('Your details have been saved, but the verification email was not sent. Try again below.')
    }
  }
  const resendVerification = async () => {
    setEmailStatus('sending')
    setError('')
    try {
      await sendParentVerificationEmail(family)
      setEmailStatus('sent')
    } catch {
      setEmailStatus('failed')
      setError('The verification email still could not be sent. Your details remain saved.')
    }
  }
  const verify = async () => {
    let updated
    try {
      updated = await verifyGuardian(family.id, code)
    } catch {
      return setError('We could not confirm your code right now. Check your connection and try again.')
    }
    if (!updated) return setError('That verification code is not correct.')
    setFamily(updated)
    if (onVerified) onVerified(updated)
    else navigate(`family/${family.id}${updated._portalToken ? `/${updated._portalToken}` : ''}`)
  }
  const content = <div className="border border-slate-200 bg-white p-7 text-center">
    <h1 className="text-2xl font-semibold text-slate-900">{cadetLed && !embedded ? 'Ask a parent or guardian to continue' : 'Parent verification required'}</h1>
    {cadetLed && !embedded && <div className="mx-auto mt-4 max-w-md border border-slate-300 bg-slate-50 p-5 text-left text-sm text-slate-700">
      <p className="font-bold text-[var(--navy)]">Send this to your parent or guardian.</p>
      <p className="mt-2 leading-5">They need to check the details and give permission before we can arrange an open night.</p>
      <textarea readOnly rows={6} value={parentMessage} onFocus={(event) => event.currentTarget.select()} aria-label="Message to send to parent or guardian" className="mt-4 w-full resize-none break-words border border-slate-300 bg-white p-3 text-sm leading-5 text-slate-600" />
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">{canShare ? <><button type="button" onClick={shareWithParent} className={primary + ' flex-1'}>Send to parent or guardian</button><button type="button" onClick={copyForParent} className={secondary}>Copy message and link</button></> : <button type="button" onClick={copyForParent} className={primary + ' w-full'}>Copy message and link</button>}</div>
      {shareStatus && <p className="mt-3 font-medium text-[var(--blue)]">{shareStatus}</p>}
    </div>}
    {embedded && !family.communicationsConsent && <div className="mx-auto mt-5 max-w-md space-y-4 text-left">
      <div className="border-l-4 border-[var(--blue)] bg-[var(--navy-soft)] p-4 text-sm leading-6 text-slate-700"><p>You are here because <strong>{family.cadets[0]?.fullName || 'your cadet'}</strong> has shown an interest in joining 1330 (Warrington) Squadron Air Cadets.</p><p className="mt-3">The Squadron is one of the largest in Warrington. We parade every Monday and Thursday from 6.30pm to 9.30pm and deliver a full and exciting Air Cadet and community-focused syllabus, helping cadets develop into exceptional young people.</p><p className="mt-3">To progress their enquiry, we would like to invite you and {family.cadets[0]?.fullName || 'your cadet'} to one of our Open Nights to meet the Squadron and find out more.</p></div>
      <p className="text-sm text-slate-600">Check the details entered by the cadet and complete anything they did not know.</p>
      <Field label="Parent or guardian name"><input className={inputClass} value={details.fullName} onChange={(e) => setDetails({ ...details, fullName: e.target.value })} /></Field>
      <Field label="Email address"><input type="email" className={inputClass} value={details.email} onChange={(e) => setDetails({ ...details, email: e.target.value })} /></Field>
      <Field label="Mobile number"><input inputMode="tel" className={inputClass} value={details.mobile} onChange={(e) => setDetails({ ...details, mobile: e.target.value })} /></Field>
      <label className="flex items-start gap-3 border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700"><input type="checkbox" className="mt-0.5 h-4 w-4" checked={details.communicationsConsent} onChange={(e) => setDetails({ ...details, communicationsConsent: e.target.checked })} /><span>I am the parent or guardian named above and agree to receive recruitment, open-night and start-date communications.</span></label>
      <details className="border-t border-slate-200 py-3 text-xs text-slate-600"><summary className="cursor-pointer font-medium text-[var(--blue)]">Portal data terms</summary><ul className="mt-3 list-disc space-y-2 pl-5 leading-5"><li>We retain the contact, cadet, booking and recruitment details needed to manage the application.</li><li>Form 3822 is held temporarily while it is completed, emailed to the authorised recipients and then removed from the portal.</li><li>Payment details are handled by the payment provider; the portal keeps only the status or reference.</li><li>Withdrawing stops communications and removes the application. Returning later requires a new enquiry.</li></ul></details>
      <label className="flex items-start gap-3 text-sm text-slate-700"><input type="checkbox" className="mt-0.5 h-4 w-4" checked={details.dataTermsAccepted} onChange={(e) => setDetails({ ...details, dataTermsAccepted: e.target.checked })} /><span>I have read and accept the portal data terms.</span></label>
      <button type="button" onClick={saveParentDetails} className={primary + ' w-full'}>Save and continue</button>
    </div>}
    {(embedded || !cadetLed) && family.communicationsConsent && <>
      <p className="mt-3 text-sm text-slate-500">{emailStatus === 'sent' ? <>A verification email has been sent to <strong>{family.guardian.email}</strong>.</> : <>We need to send a six-digit verification code to <strong>{family.guardian.email}</strong>.</>}</p>
      {emailStatus !== 'sent' && <button type="button" onClick={resendVerification} disabled={emailStatus === 'sending'} className={secondary + ' mt-4 disabled:opacity-50'}>{emailStatus === 'sending' ? 'Sending…' : 'Send verification code'}</button>}
      {emailStatus === 'sent' && <button type="button" onClick={resendVerification} disabled={emailStatus === 'sending'} className="mt-3 block w-full text-sm font-semibold text-[var(--blue)] underline disabled:opacity-50">Send the code again</button>}
      {localPreview && emailStatus === 'failed' && <div className="mx-auto mt-4 max-w-xs border-2 border-[var(--gold)] bg-[var(--gold-soft)] p-4"><p className="text-xs font-bold uppercase tracking-wide text-[var(--amber)]">Local testing code</p><p className="mt-1 font-mono text-2xl tracking-[0.3em] text-[var(--navy)]">{family.verificationCode}</p><p className="mt-2 text-xs text-slate-600">Shown only because local email sending failed. This is never displayed on the live website.</p></div>}
      <div className="mx-auto mt-5 flex max-w-xs gap-2"><input inputMode="numeric" maxLength={6} className={inputClass + ' mt-0 text-center tracking-[0.25em]'} value={code} onChange={(e) => { setCode(e.target.value.replace(/\D/g, '')); setError('') }} /><button onClick={verify} className={primary}>Verify</button></div>
    </>}
    {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
  </div>
  return embedded ? content : <Page>{content}</Page>
}

export function FamilyDashboard({ familyId, accessToken = '', navigate, previewFamily = null }) {
  const [family, setFamily] = useState(() => previewFamily || getFamily(familyId))
  const [sharedLoading, setSharedLoading] = useState(Boolean(accessToken))
  const [sharedError, setSharedError] = useState('')
  const [bookingEmailStatus, setBookingEmailStatus] = useState('')
  const [selectedCadetId, setSelectedCadetId] = useState(() => (previewFamily || getFamily(familyId))?.cadets?.[0]?.id || '')
  const [reviewNightId, setReviewNightId] = useState('')
  const [movingBooking, setMovingBooking] = useState(false)
  const [booking, setBooking] = useState(false)
  const [addingCadet, setAddingCadet] = useState(false)
  const [showWithdrawal, setShowWithdrawal] = useState(false)
  useEffect(() => {
    if (!accessToken) return
    hydrateSharedFamily(familyId, accessToken).then((loaded) => { setFamily(loaded); setSelectedCadetId((current) => current || loaded.cadets?.[0]?.id || ''); setSharedError('') }).catch(() => {
      removeCachedFamily(familyId)
      setFamily(null)
      setSharedError('This family record no longer exists, or this secure link has expired.')
    }).finally(() => setSharedLoading(false))
  }, [accessToken, familyId])
  if (sharedLoading) return <Page><p className="text-center font-semibold text-[var(--blue)]">Loading your recruitment record...</p></Page>
  if (sharedError && !family) return <Page><p className="text-red-700">{sharedError}</p><button onClick={() => navigate('')} className={secondary + ' mt-4'}>Back home</button></Page>
  if (!family) return <Page><p>Family account not found.</p><button onClick={() => navigate('')} className={secondary + ' mt-4'}>Back home</button></Page>
  const cadet = family.cadets.find((item) => item.id === selectedCadetId) || family.cadets[0]
  const bookedNight = OPEN_NIGHTS.find((night) => night.id === cadet.openNightId)
  const codeExpired = joiningCodeExpired(cadet)
  const schedule = getCommunicationSchedule(family, cadet)
  const book = async (nightId) => {
    if (booking) return
    setBooking(true)
    let updated
    try {
      updated = await bookOpenNight(family.id, cadet.id, nightId)
    } catch {
      setBooking(false)
      setBookingEmailStatus('We could not save the booking. Check your connection and try again.')
      return
    }
    setBooking(false)
    setFamily(updated)
    setReviewNightId('')
    setMovingBooking(false)
    const night = OPEN_NIGHTS.find((item) => item.id === nightId)
    try {
      const updatedCadet = updated.cadets.find((item) => item.id === cadet.id)
      const result = await sendOpenNightConfirmation(updated, updatedCadet, night)
      setBookingEmailStatus(result.simulated ? 'Confirmation email prepared. Email sending is simulated locally.' : 'Confirmation email sent.')
    } catch {
      setBookingEmailStatus('The booking is saved, but the confirmation email could not be sent. Squadron staff have been notified.')
    }
  }
  const deleteEnquiry = async () => {
    await sendWithdrawalConfirmationEmail(family, cadet)
    const updated = await deleteCadetEnquiry(family.id, cadet.id)
    setShowWithdrawal(false)
    if (!updated) { navigate(''); return }
    setFamily(updated)
    setSelectedCadetId(updated.cadets[0].id)
  }
  const handleCadetAdded = async (updated, cadetId) => {
    setFamily(updated)
    setSelectedCadetId(cadetId)
    setAddingCadet(false)
    const addedCadet = updated.cadets.find((item) => item.id === cadetId)
    const sharedNight = OPEN_NIGHTS.find((item) => item.id === addedCadet?.openNightId)
    if (addedCadet && sharedNight) {
      try {
        const result = await sendOpenNightConfirmation(updated, addedCadet, sharedNight)
        setBookingEmailStatus(result.simulated ? 'Sibling booking confirmation prepared. Email sending is simulated locally.' : 'Sibling booking confirmation sent.')
      } catch {
        setBookingEmailStatus('The sibling is booked, but the confirmation email could not be sent.')
      }
    }
  }
  return <Page>
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-semibold text-[var(--blue)]">Recruitment record</p><h1 className="mt-1 text-2xl font-semibold text-slate-900">{family.guardian.fullName || 'Parent or guardian'}</h1><p className="mt-1 text-sm text-slate-500">{family.cadets.length} prospective {family.cadets.length === 1 ? 'cadet' : 'cadets'} linked to this account</p></div></div>
    <section className="mt-6 border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">{family.cadets.map((item) => <button type="button" key={item.id} onClick={() => { setSelectedCadetId(item.id); setBookingEmailStatus(''); setReviewNightId(''); setMovingBooking(false) }} className={item.id === cadet.id ? primary : secondary}>{item.fullName || 'Unnamed cadet'}</button>)}<button type="button" onClick={() => setAddingCadet((value) => !value)} className={secondary}>+ Add another cadet</button></div>
      {addingCadet && <AddCadetForm family={family} onCancel={() => setAddingCadet(false)} onAdded={handleCadetAdded} />}
    </section>
    <JourneyStatus family={family} cadet={cadet} />
    {family.guardian.verifiedAt && cadet.status === 'eligible' && !bookedNight && <section className="mt-6 border border-slate-200 bg-white px-6 py-5 text-sm leading-6 text-slate-700"><p>You are here because <strong>{cadet.fullName || 'your cadet'}</strong> has shown an interest in joining 1330 (Warrington) Squadron Air Cadets.</p><p className="mt-3">The Squadron is one of the largest in Warrington. We parade every Monday and Thursday from 6.30pm to 9.30pm and deliver a full and exciting Air Cadet and community-focused syllabus, helping cadets develop into exceptional young people.</p><p className="mt-3">To progress their enquiry, we would like to invite you and {cadet.fullName || 'your cadet'} to one of our Open Nights to meet the Squadron and find out more.</p></section>}
    {!family.guardian.verifiedAt && <div className="mt-6"><VerificationPage familyId={family.id} navigate={navigate} cadetLed={family.submittedBy === 'cadet'} embedded onVerified={setFamily} /></div>}
    {family.guardian.verifiedAt && cadet.status === 'future_waiting' && <section className="mt-6 border border-[var(--gold)]/30 bg-[var(--gold-soft)] p-6"><h2 className="font-semibold text-slate-900">Not yet eligible for the next intake</h2><p className="mt-1 text-sm text-slate-600">Enquiries can be made at any age. Cadets normally start at 13. A cadet who is still 12 may be accepted if they will be in Year 8 when they start.</p>{cadet.eligibleIntakeDate && <p className="mt-3 text-sm text-slate-700">Earliest suitable intake: <strong>{formatDate(cadet.eligibleIntakeDate)}</strong>.</p>}<p className="mt-2 text-sm text-slate-600">We will email the parent monthly and invite the family to an open night at the appropriate time.</p></section>}
    {family.guardian.verifiedAt && cadet.status === 'eligible' && !bookedNight && <section className="mt-6 border border-slate-200 bg-white p-6">
      <h2 className="text-xl font-semibold text-slate-900">Book an Open Night</h2>
      <p className="mt-2 text-sm text-slate-700">Your next step is to book and attend an Open Night at the Squadron.</p>
      <p className="mt-1 text-sm text-slate-500">Parents and prospective cadets should attend together. Open Nights run from 19:15 to 20:30. Please arrive at the gate at 19:10.</p>
      <div className="mt-4 grid gap-3">{OPEN_NIGHTS.slice(0, 4).map((night) => <div key={night.id}><button onClick={() => setReviewNightId(night.id)} className={`flex w-full items-center justify-between border px-4 py-3 text-left hover:border-[var(--blue)] ${reviewNightId === night.id ? 'border-[var(--blue)] bg-[var(--navy-soft)]' : 'border-slate-200'}`}><span><strong className="block text-sm text-slate-900">{formatDate(night.startsAt)}</strong><span className="text-xs text-slate-500">Arrival 19:10 · Peninsula Barracks</span></span><span className="text-sm font-semibold text-[var(--blue)]">Select</span></button>{reviewNightId === night.id && <div className="border-2 border-t-0 border-[var(--navy)] bg-slate-50 p-5">
        <p className="text-xs font-bold uppercase tracking-wide text-[var(--blue)]">Review your booking</p>
        <h3 className="mt-1 text-xl font-semibold text-[var(--navy)]">{formatDate(night.startsAt)}</h3>
        <div className="mt-4 space-y-4 text-sm leading-6 text-slate-700">
          <div><h4 className="font-semibold text-slate-900">Who should attend</h4><p>The prospective cadet must attend with a parent or guardian. Both parents or guardians are very welcome to come along.</p></div>
          <div><h4 className="font-semibold text-slate-900">Arrival</h4><p>Please arrive at <strong>19:10</strong> and wait at the gate at <strong>{OPEN_NIGHT_ADDRESS}</strong>. The gate will open at 19:15 and the evening will finish at approximately 20:30.</p></div>
          <div><h4 className="font-semibold text-slate-900">Dress and conduct</h4><p>This is a formal introduction to a uniformed youth organisation based on the values and standards of the Royal Air Force. Prospective cadets should dress smartly, with neat hair and make-up suitable for the occasion. They should address uniformed staff as <strong>Sir</strong> or <strong>Ma'am</strong> unless asked otherwise.</p></div>
          <div><h4 className="font-semibold text-slate-900">What will happen</h4><p>The evening includes a Squadron presentation, a welcome from the Officer Commanding, a cadet-led tour and a short team demonstration. Joining paperwork access is issued after attendance.</p></div>
          <div><h4 className="font-semibold text-slate-900">If you cannot attend</h4><p>Please tell us as early as possible so the place can be released and another date arranged. Please do not simply miss a confirmed booking.</p></div>
        </div>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row"><button type="button" disabled={booking} onClick={() => book(night.id)} className={primary + ' flex-1 disabled:opacity-50'}>{booking ? 'Saving…' : 'Confirm Booking'}</button><button type="button" onClick={() => setReviewNightId('')} className={secondary}>Choose another date</button></div>
      </div>}</div>)}</div>
    </section>}
    {cadet.openNightAttendanceStatus === 'absent' && <section className="mt-6 border-2 border-[var(--gold)] bg-[var(--gold-soft)] p-6"><p className="text-xs font-bold uppercase tracking-wide text-[var(--amber)]">Open Night missed</p><h2 className="mt-2 text-xl font-semibold text-slate-900">Please tell us what you would like to do</h2><p className="mt-2 text-sm text-slate-700">You did not attend the booked Open Night. If you still wish to join, book another date below. If you no longer wish to continue, delete the enquiry.</p><div className="mt-4 grid gap-3">{OPEN_NIGHTS.filter((night) => night.id !== cadet.openNightId && new Date(night.startsAt) > new Date()).map((night) => <button key={night.id} onClick={() => book(night.id)} className="flex items-center justify-between border border-slate-300 bg-white px-4 py-3 text-left"><span><strong className="block text-sm text-slate-900">{formatDate(night.startsAt)}</strong><span className="text-xs text-slate-500">Arrival 19:10</span></span><span className="text-sm font-semibold text-[var(--blue)]">Rebook</span></button>)}</div><button type="button" onClick={() => setShowWithdrawal((value) => !value)} className="mt-5 text-sm font-semibold text-red-700 underline">Delete this cadet's enquiry</button>{showWithdrawal && <DeleteEnquiryConfirmation cadetName={cadet.fullName} onCancel={() => setShowWithdrawal(false)} onDelete={deleteEnquiry} />}{bookingEmailStatus && <p className="mt-3 text-sm text-slate-600">{bookingEmailStatus}</p>}</section>}
    {cadet.status === 'withdrawn' && <section className="mt-6 border border-slate-300 bg-slate-100 p-6"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Enquiry withdrawn</p><h2 className="mt-2 text-xl font-semibold text-slate-900">We will not send further recruitment reminders for {cadet.fullName}.</h2><p className="mt-2 text-sm text-slate-600">Recorded reason: {withdrawalLabel(cadet.withdrawalReason)}. Contact the Squadron if you wish to reopen the enquiry later.</p></section>}
    {bookedNight && !cadet.attendedAt && !['absent', 'withdrawn'].includes(cadet.openNightAttendanceStatus) && <section className="mt-6 border-2 border-[var(--navy)] bg-white p-6">
      <p className="text-sm font-semibold text-[var(--blue)]">Open Night confirmation</p>
      <h2 className="mt-1 text-2xl font-semibold text-[var(--navy)]">{formatDate(bookedNight.startsAt)}</h2>
      <p className="mt-1 text-sm text-slate-700">Prospective cadet: <strong>{cadet.fullName || 'Name not entered'}</strong></p>
      <div className="mt-5 border-t border-slate-200 pt-4 text-sm leading-6 text-slate-700">
        <h3 className="font-semibold text-slate-900">Arrival</h3>
        <p>Please arrive at <strong>7.10pm</strong> and wait at the gate at <strong>{OPEN_NIGHT_ADDRESS}</strong>. The gate will open at 7.15pm.</p>
        <h3 className="mt-4 font-semibold text-slate-900">Dress and conduct</h3>
        <p>This is a formal introduction to a uniformed youth organisation based on the values and standards of the Royal Air Force. Prospective cadets should dress smartly. Hair should be neat and make-up, if worn, should be suitable for the occasion.</p>
        <p className="mt-2">Prospective cadets should address uniformed staff as <strong>Sir</strong> or <strong>Ma'am</strong> unless asked to use another form of address.</p>
        <h3 className="mt-4 font-semibold text-slate-900">What will happen</h3>
        <p>The evening will begin with a presentation about the Squadron and what cadets and parents can expect. The Officer Commanding will give a short welcome brief. Squadron cadets will then lead a tour, followed by a short demonstration from one of our teams.</p>
        <p className="mt-2">At the end of the evening, you will receive the code needed to access the joining paperwork and confirm the proposed start date.</p>
        <h3 className="mt-4 font-semibold text-slate-900">If you cannot attend</h3>
        <p>Please tell us as early as possible so we can release the place and arrange another date. Staff and demonstrations are planned around confirmed attendance, so please do not simply miss the evening without contacting us.</p>
      </div>
      <p className="mt-5 border-t border-slate-200 pt-4 text-sm font-medium text-[var(--navy)]">Formal paperwork remains locked until staff record your attendance.</p>
      {bookingEmailStatus && <p className="mt-2 text-sm text-slate-600">{bookingEmailStatus}</p>}
      <div className="mt-5 border-2 border-[var(--green)] bg-[var(--green-soft)] p-5 text-slate-800">
        <p className="text-xs font-bold uppercase tracking-wide text-[var(--green)]">Booking complete</p>
        <h3 className="mt-1 text-xl font-semibold text-slate-900">That is all you need to do for now</h3>
        <p className="mt-2 text-sm leading-6">Your Open Night place is saved. We will send the booking details and reminders to the parent email address.</p>
        <p className="mt-2 text-sm font-semibold">You can close this page now.</p>
        <p className="mt-2 text-sm leading-6">When you attend, Squadron staff will record your attendance and send the joining code needed for the paperwork.</p>
      </div>
      <button type="button" onClick={() => { setMovingBooking((value) => !value); setReviewNightId('') }} className="mt-5 text-sm font-semibold text-[var(--blue)] underline">{movingBooking ? 'Keep this booking' : 'Move to another Open Night'}</button>
      {movingBooking && <div className="mt-4 border-t border-slate-200 pt-4">
        <h3 className="font-semibold text-slate-900">Choose another date</h3>
        <p className="mt-1 text-sm text-slate-600">Your existing booking remains in place until you confirm the new date.</p>
        <div className="mt-3 grid gap-3">{OPEN_NIGHTS.filter((night) => night.id !== bookedNight.id && new Date(night.startsAt) > new Date()).map((night) => <div key={night.id}><button type="button" onClick={() => setReviewNightId(night.id)} className={`flex w-full items-center justify-between border px-4 py-3 text-left ${reviewNightId === night.id ? 'border-[var(--blue)] bg-[var(--navy-soft)]' : 'border-slate-200 bg-white'}`}><span><strong className="block text-sm text-slate-900">{formatDate(night.startsAt)}</strong><span className="text-xs text-slate-500">Arrival 19:10 · Peninsula Barracks</span></span><span className="text-sm font-semibold text-[var(--blue)]">Select</span></button>{reviewNightId === night.id && <div className="border-2 border-t-0 border-[var(--navy)] bg-slate-50 p-4"><p className="text-xs font-bold uppercase tracking-wide text-[var(--blue)]">Review new date</p><h4 className="mt-1 text-lg font-semibold text-[var(--navy)]">{formatDate(night.startsAt)}</h4><p className="mt-2 text-sm leading-6 text-slate-700">Arrive at 19:10 at {OPEN_NIGHT_ADDRESS}. The prospective cadet must attend with a parent or guardian, and both parents or guardians are welcome.</p><div className="mt-4 flex flex-col gap-2 sm:flex-row"><button type="button" disabled={booking} onClick={() => book(night.id)} className={primary + ' flex-1 disabled:opacity-50'}>{booking ? 'Saving…' : 'Confirm move'}</button><button type="button" onClick={() => setReviewNightId('')} className={secondary}>Choose another date</button></div></div>}</div>)}</div>
      </div>}
    </section>}
    {codeExpired && <section className="mt-6 border-2 border-[var(--gold)] bg-[var(--gold-soft)] p-6"><p className="text-xs font-bold uppercase tracking-wide text-[var(--amber)]">Joining code expired</p><h2 className="mt-2 text-xl font-semibold text-slate-900">Please attend another Open Night</h2><p className="mt-2 text-sm text-slate-700">The joining code was not used within 30 days. Choose another Open Night below and staff will issue a new code after you attend.</p><div className="mt-4 grid gap-3">{OPEN_NIGHTS.filter((night) => new Date(night.startsAt) > new Date()).map((night) => <button key={night.id} onClick={() => book(night.id)} className="flex items-center justify-between border border-slate-300 bg-white px-4 py-3 text-left"><span><strong className="block text-sm text-slate-900">{formatDate(night.startsAt)}</strong><span className="text-xs text-slate-500">Arrival 19:10</span></span><span className="text-sm font-semibold text-[var(--blue)]">Book</span></button>)}</div></section>}
    {cadet.attendedAt && !codeExpired && cadet.paperworkStatus !== 'completed' && <section className="mt-6 rounded-2xl border border-[var(--green)]/30 bg-[var(--green-soft)] p-6"><p className="text-xs font-bold uppercase tracking-wide text-[var(--green)]">Open night complete</p><h2 className="mt-2 text-xl font-semibold text-slate-900">{cadet.paperworkStatus === 'in_progress' ? 'Continue your joining paperwork' : 'Joining paperwork is unlocked'}</h2>{cadet.paperworkStatus !== 'in_progress' && <p className="mt-1 text-sm text-slate-600">Enter the joining code from your email when asked.</p>}{cadet.intendedStartDate && <p className="mt-2 text-sm text-slate-600">Proposed start: <strong>{formatDate(cadet.intendedStartDate)}</strong> at 6.30pm.</p>}<button onClick={() => navigate(`join/${family.id}/${cadet.id}${family._portalToken ? `/${family._portalToken}` : ''}`)} className={primary + ' mt-4'}>{cadet.paperworkStatus === 'in_progress' ? 'Continue paperwork' : 'Enter code and start paperwork'}</button></section>}
    {cadet.paperworkStatus === 'completed' && <section className="mt-6 rounded-2xl border-2 border-[var(--green)] bg-[var(--green-soft)] p-6"><p className="text-xs font-bold uppercase tracking-wide text-[var(--green)]">Registration complete</p><h2 className="mt-2 text-2xl font-semibold text-slate-900">{cadet.fullName} is registered and ready to start</h2><p className="mt-3 text-slate-700">We will see them on <strong>{cadet.intendedStartDate ? formatDate(cadet.intendedStartDate) : 'their confirmed start date'}</strong> at <strong>6.30pm</strong>.</p><div className="mt-5 rounded-xl bg-white p-4 text-sm text-slate-700"><p className="font-semibold text-[var(--navy)]">For their first night, they must:</p><ul className="mt-2 list-disc space-y-1.5 pl-5"><li>Arrive in school uniform</li><li>Bring a full water bottle</li><li>Bring a notepad and pen</li></ul></div></section>}
    <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6"><h2 className="font-semibold text-slate-900">Your communication plan</h2><div className="mt-3 space-y-3">{schedule.length ? schedule.map((item) => <div key={item.label} className="flex items-start justify-between gap-4 border-t border-slate-100 pt-3 text-sm"><span className="font-medium text-slate-800">{item.label}</span><span className="max-w-xs text-right text-slate-500">{item.when}</span></div>) : <p className="text-sm text-slate-500">Verify the parent account to begin recruitment communications.</p>}</div></section>
  </Page>
}

function AddCadetForm({ family, onAdded, onCancel }) {
  const bookedCadets = family.cadets.filter((cadet) => cadet.openNightId && !cadet.attendedAt)
  const [values, setValues] = useState({ cadetName: '', cadetDob: '', schoolYear: '', openNightId: bookedCadets[0]?.openNightId || '' })
  const [error, setError] = useState('')
  const submit = async (event) => {
    event.preventDefault()
    const cadetDob = dobToIso(values.cadetDob)
    if ((!values.cadetName.trim() || !cadetDob || !values.schoolYear)) {
      setError('Enter the cadet name, date of birth and school year.')
      return
    }
    const existingIds = new Set(family.cadets.map((cadet) => cadet.id))
    let updated
    try {
      updated = await addCadetToFamily(family.id, { ...values, cadetDob })
    } catch {
      setError('We could not save this cadet. Check your connection and try again.')
      return
    }
    const added = updated.cadets.find((cadet) => !existingIds.has(cadet.id))
    if (!added) {
      setError('A cadet with that name is already linked to this account.')
      return
    }
    onAdded(updated, added.id)
  }
  return <form onSubmit={submit} className="mt-4 border-t border-slate-200 pt-4">
    <h2 className="font-semibold text-slate-900">Add another cadet</h2>
    <p className="mt-1 text-sm text-slate-500">Parent and guardian details are shared. This cadet will have their own booking, joining code and paperwork.</p>
    <div className="mt-4 grid gap-4 sm:grid-cols-2">
      <Field label="Cadet full name"><input className={inputClass} value={values.cadetName} onChange={(event) => setValues({ ...values, cadetName: event.target.value })} /></Field>
      <Field label="Date of birth"><input type="text" inputMode="numeric" autoComplete="bday" maxLength={10} placeholder="DD/MM/YYYY" className={inputClass} value={values.cadetDob} onChange={(event) => setValues({ ...values, cadetDob: formatDobInput(event.target.value) })} /></Field>
      <Field label="Current school year"><select className={inputClass} value={values.schoolYear} onChange={(event) => setValues({ ...values, schoolYear: event.target.value })}><option value="">Select</option>{Array.from({ length: 9 }, (_, index) => index + 5).map((year) => <option key={year} value={year}>Year {year}</option>)}</select></Field>
      {bookedCadets.length > 0 && <Field label="Open Night"><select className={inputClass} value={values.openNightId} onChange={(event) => setValues({ ...values, openNightId: event.target.value })}><option value="">Book separately later</option>{bookedCadets.map((item) => { const night = OPEN_NIGHTS.find((entry) => entry.id === item.openNightId); return <option key={item.id} value={item.openNightId}>Attend with {item.fullName}{night ? ` on ${formatDate(night.startsAt)}` : ''}</option> })}</select></Field>}
    </div>
    {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
    <div className="mt-4 flex gap-2"><button type="submit" className={primary}>Add cadet</button><button type="button" onClick={onCancel} className={secondary}>Cancel</button></div>
  </form>
}

function DeleteEnquiryConfirmation({ cadetName, onDelete, onCancel }) {
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const confirm = async () => {
    setSending(true)
    setError('')
    try { await onDelete() } catch { setError('The withdrawal email could not be sent, so the application has not been removed. Please try again.') } finally { setSending(false) }
  }
  return <div className="mt-4 border-2 border-red-300 bg-red-50 p-4"><h3 className="font-semibold text-red-900">Withdraw and remove {cadetName || 'this cadet'}'s application?</h3><p className="mt-2 text-sm leading-6 text-red-800">We will email the parent to confirm the withdrawal, then permanently remove the enquiry, booking and communication record. If they wish to return later, they will need to register again from the beginning.</p>{error && <p className="mt-3 text-sm font-semibold text-red-800">{error}</p>}<div className="mt-4 flex flex-wrap gap-2"><button type="button" disabled={sending} onClick={confirm} className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{sending ? 'Emailing and removing...' : 'Confirm withdrawal'}</button><button type="button" disabled={sending} onClick={onCancel} className={secondary}>Keep enquiry</button></div></div>
}

function JourneyStatus({ family, cadet }) {
  const steps = [
    ['Enquiry received', true], ['Parent verified', Boolean(family.guardian.verifiedAt)], ['Open night booked', Boolean(cadet.openNightId)],
    ['Open night attended', Boolean(cadet.attendedAt)], ['Paperwork available', cadet.paperworkStatus !== 'locked'], ['Ready to start', ['ready_to_start', 'joined'].includes(cadet.status)],
  ]
  return <div className="mt-6 grid gap-2 sm:grid-cols-3">{steps.map(([label, done]) => <div key={label} className={`rounded-xl border px-4 py-3 text-sm font-medium ${done ? 'border-[var(--green)]/30 bg-[var(--green-soft)] text-[var(--green)]' : 'border-slate-200 bg-white text-slate-400'}`}>{done ? '✓ ' : '○ '}{label}</div>)}</div>
}

const STATUS_LABELS = {
  awaiting_parent: 'Awaiting parent', future_waiting: 'Waiting for a suitable intake', eligible: 'Eligible - invite', open_night_booked: 'Open night booked',
  paperwork_available: 'Paperwork available', paperwork_in_progress: 'Paperwork in progress', ready_to_start: 'Ready to start', joined: 'Joined', withdrawn: 'Withdrawn',
}

export function RecruitmentAdmin({ navigate, initialWorkspace = 'pipeline', onLogout }) {
  const [families, setFamilies] = useState(() => listFamilies())
  const [selectedId, setSelectedId] = useState(() => listFamilies()[0]?.id || null)
  const [note, setNote] = useState('')
  const [workspace, setWorkspace] = useState(initialWorkspace)
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'auto' }) }, [workspace])
  useEffect(() => {
    let active = true
    const refreshLocal = () => {
      if (!active) return
      const nextFamilies = listFamilies()
      setFamilies(nextFamilies)
      setSelectedId((current) => current && nextFamilies.some((family) => family.id === current) ? current : nextFamilies[0]?.id || null)
    }
    const refreshShared = () => hydrateStaffRecruitmentData().then(refreshLocal).catch(() => undefined)
    window.addEventListener('recruitment-store-change', refreshLocal)
    const timer = window.setInterval(refreshShared, 5000)
    return () => { active = false; window.clearInterval(timer); window.removeEventListener('recruitment-store-change', refreshLocal) }
  }, [])
  const selected = families.find((family) => family.id === selectedId)
  const refresh = () => setFamilies(listFamilies())
  const act = async (fn) => {
    try { await fn() }
    catch { window.alert('That change could not be saved to the Squadron system. Check your connection and try again.') }
    refresh()
  }
  const counts = useMemo(() => { const cadets = families.flatMap((family) => family.cadets); return { total: cadets.length, awaiting: families.filter((f) => !f.guardian.verifiedAt).length, booked: cadets.filter((cadet) => cadet.openNightId && !cadet.attendedAt && cadet.status !== 'withdrawn').length, paperwork: cadets.filter((cadet) => cadet.paperworkStatus !== 'locked').length, missed: cadets.filter((cadet) => hasMissedIntake(cadet)).length, withdrawn: cadets.filter((cadet) => cadet.status === 'withdrawn').length, joined: cadets.filter((cadet) => cadet.status === 'joined').length, active: cadets.filter((cadet) => !['joined', 'withdrawn'].includes(cadet.status)).length } }, [families])
  const withdrawalStats = useMemo(() => families.flatMap((family) => family.cadets).filter((cadet) => cadet.status === 'withdrawn').reduce((result, cadet) => ({ ...result, [cadet.withdrawalReason || 'not_recorded']: (result[cadet.withdrawalReason || 'not_recorded'] || 0) + 1 }), {}), [families])
  const sourceStats = useMemo(() => families.reduce((result, family) => { const label = family.source === 'School' && family.sourceDetail ? `School: ${family.sourceDetail}` : family.source || 'Not recorded'; return { ...result, [label]: (result[label] || 0) + family.cadets.length } }, {}), [families])
  const decided = counts.joined + counts.withdrawn
  const conversion = decided ? Math.round((counts.joined / decided) * 100) : 0
  return <Page wide>
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-wide text-[var(--blue)]">Staff workspace</p><h1 className="mt-1 text-3xl font-semibold text-slate-900">Recruitment</h1></div><div className="flex flex-col items-end gap-3"><button onClick={() => navigate('interest')} className={primary}>Capture enquiry</button><button onClick={onLogout} className="text-xs font-medium text-slate-400 hover:text-slate-600 hover:underline">Log out</button></div></div>
    <div className="mt-5 flex flex-wrap gap-2"><button type="button" onClick={() => setWorkspace('pipeline')} className={workspace === 'pipeline' ? primary : secondary}>Recruitment pipeline</button><button type="button" onClick={() => setWorkspace('open-nights')} className={workspace === 'open-nights' ? primary : secondary}>Open Night desk</button><button type="button" onClick={() => setWorkspace('direct-joiner')} className={workspace === 'direct-joiner' ? primary : secondary}>Direct joiner</button><button type="button" onClick={() => setWorkspace('communications')} className={workspace === 'communications' ? primary : secondary}>Emails and key dates</button><button type="button" onClick={() => setWorkspace('settings')} className={workspace === 'settings' ? primary : secondary}>Settings</button></div>
    {workspace === 'open-nights' && <OpenNightDesk onDataChanged={refresh} />}
    {workspace === 'settings' && <AdminSettingsPanel />}
    {workspace === 'direct-joiner' && <DirectJoinerDesk onDataChanged={refresh} />}
    {workspace === 'communications' && <AdminCommunications />}
    {workspace === 'pipeline' && <>
    <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">{[['Total prospects', counts.total], ['Awaiting parent', counts.awaiting], ['Open nights booked', counts.booked], ['Paperwork unlocked', counts.paperwork], ['Missed intake', counts.missed], ['Withdrawn / lost', counts.withdrawn]].map(([label, value]) => <div key={label} className={`rounded-2xl border bg-white p-4 ${label === 'Missed intake' && value ? 'border-red-300' : 'border-slate-200'}`}><p className="text-xs text-slate-500">{label}</p><p className={`mt-1 text-2xl font-semibold ${label === 'Missed intake' && value ? 'text-red-700' : 'text-slate-900'}`}>{value}</p></div>)}</div>
    {counts.withdrawn > 0 && <section className="mt-5 border border-slate-200 bg-white p-5"><h2 className="font-semibold text-slate-900">Why enquiries are being lost</h2><div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{Object.entries(withdrawalStats).sort((a, b) => b[1] - a[1]).map(([reason, count]) => <div key={reason} className="flex justify-between border border-slate-100 bg-slate-50 px-3 py-2 text-sm"><span>{withdrawalLabel(reason)}</span><strong>{count}</strong></div>)}</div></section>}
    <section className="mt-5 grid gap-5 lg:grid-cols-2"><div className="border border-slate-200 bg-white p-5"><h2 className="font-semibold text-slate-900">Recruitment outcomes</h2><div className="mt-3 grid grid-cols-2 gap-2 text-sm"><div className="bg-[var(--green-soft)] p-3"><span className="block text-slate-600">Joined</span><strong className="text-xl text-[var(--green)]">{counts.joined}</strong></div><div className="bg-red-50 p-3"><span className="block text-slate-600">Did not join</span><strong className="text-xl text-red-700">{counts.withdrawn}</strong></div><div className="bg-slate-50 p-3"><span className="block text-slate-600">Still active</span><strong className="text-xl">{counts.active}</strong></div><div className="bg-[var(--navy-soft)] p-3"><span className="block text-slate-600">Conversion of decided cases</span><strong className="text-xl text-[var(--navy)]">{conversion}%</strong></div></div></div><div className="border border-slate-200 bg-white p-5"><h2 className="font-semibold text-slate-900">How people found us</h2><div className="mt-3 space-y-2">{Object.entries(sourceStats).sort((a, b) => b[1] - a[1]).map(([source, count]) => <div key={source} className="flex justify-between border-b border-slate-100 pb-2 text-sm"><span>{source}</span><strong>{count}</strong></div>)}</div></div></section>
    <div className="mt-6 grid gap-5 lg:grid-cols-[1.05fr_1fr]">
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white"><div className="border-b border-slate-200 px-5 py-4"><h2 className="font-semibold text-slate-900">Families</h2></div>{families.length ? families.map((family) => { const cadet = family.cadets[0]; const missed = family.cadets.some((item) => hasMissedIntake(item)); const emailCount = messagesForFamily(family.id).length; const status = missed ? 'Missed intake - review required' : family.cadets.length > 1 ? family.cadets.map((item) => STATUS_LABELS[item.status] || item.status).join(' / ') : STATUS_LABELS[cadet.status] || cadet.status; return <button key={family.id} onClick={() => setSelectedId(family.id)} className={`block w-full border-b border-slate-100 px-5 py-4 text-left ${selectedId === family.id ? 'bg-[var(--navy-soft)]' : 'hover:bg-slate-50'}`}><div className="flex items-start justify-between gap-3"><span><strong className="block text-sm text-slate-900">{family.cadets.map((item) => item.fullName).join(', ')}</strong><span className="text-xs text-slate-500">{family.guardian.fullName} · {family.guardian.email}</span><span className="mt-1 block text-xs font-medium text-[var(--blue)]">{emailCount} communication {emailCount === 1 ? 'record' : 'records'}</span></span><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${missed ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}`}>{status}</span></div></button> }) : <p className="p-8 text-center text-sm text-slate-500">No enquiries yet. Use “Capture enquiry” to create one.</p>}</section>
      <section className="rounded-2xl border border-slate-200 bg-white p-6">{selected ? <FamilyAdminDetail family={selected} note={note} setNote={setNote} act={act} /> : <p className="text-sm text-slate-500">Select a family to review it.</p>}</section>
    </div></>}
  </Page>
}

function OpenNightDesk({ onDataChanged }) {
  const [nightId, setNightId] = useState(OPEN_NIGHTS[0]?.id || '')
  const [management, setManagement] = useState(() => getOpenNightManagement(OPEN_NIGHTS[0]?.id || ''))
  const [, setVersion] = useState(0)
  const night = OPEN_NIGHTS.find((item) => item.id === nightId)
  const roster = getOpenNightRoster(nightId)
  const selectNight = (value) => {
    setNightId(value)
    setManagement(getOpenNightManagement(value))
  }
  const saveManagement = (patch) => setManagement(updateOpenNightManagement(nightId, patch))
  const refresh = () => { setVersion((value) => value + 1); onDataChanged() }
  const checklistItems = [
    ['gate', 'Gate covered'], ['presentation', 'Presentation ready'], ['tourCadets', 'Tour cadets briefed'],
    ['demonstration', 'Demonstration team ready'], ['codes', 'Joining codes ready'],
  ]
  const eventLeadOptions = Array.from(new Set(['FS Warburton', 'WO Wilton', ...OPEN_NIGHTS.map((item) => getOpenNightManagement(item.id).staff.eventLead).filter(Boolean)]))
  const ready = Object.values(management.staff).every(Boolean) && Object.values(management.checklist).every(Boolean)
  useEffect(() => {
    const refreshShared = () => {
      setManagement(getOpenNightManagement(nightId))
      setVersion((value) => value + 1)
    }
    const timer = window.setInterval(refreshShared, 5000)
    return () => window.clearInterval(timer)
  }, [nightId])
  return <div className="mt-6">
    <section className="border border-slate-200 bg-white p-6">
      <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-semibold text-[var(--blue)]">Open Night desk</p><h2 className="mt-1 text-2xl font-semibold text-slate-900">{night ? formatDate(night.startsAt) : 'Select an event'}</h2><p className="mt-1 text-sm text-slate-500">7.15pm to 8.30pm. Gate opens at 7.15pm.</p></div><label className="text-sm font-medium text-slate-700">Event date<select className={inputClass} value={nightId} onChange={(event) => selectNight(event.target.value)}>{OPEN_NIGHTS.map((item) => <option key={item.id} value={item.id}>{formatDate(item.startsAt)}</option>)}</select></label></div>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <Field label="Event lead"><input list="open-night-event-leads" className={inputClass} value={management.staff.eventLead} onChange={(event) => saveManagement({ staff: { eventLead: event.target.value } })} placeholder="Select or type a staff member" /><datalist id="open-night-event-leads">{eventLeadOptions.map((name) => <option key={name} value={name} />)}</datalist></Field>
        <label className="flex items-center gap-3 self-end rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-800"><input type="checkbox" checked={Boolean(management.staff.oc)} onChange={(event) => saveManagement({ staff: { oc: event.target.checked } })} />OC confirmed</label>
        <Field label="Additional staff member"><input className={inputClass} value={management.staff.additional} onChange={(event) => saveManagement({ staff: { additional: event.target.value } })} /></Field>
      </div>
      <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">{checklistItems.map(([key, label]) => <label key={key} className="flex items-center gap-2 border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700"><input type="checkbox" checked={management.checklist[key]} onChange={(event) => saveManagement({ checklist: { [key]: event.target.checked } })} />{label}</label>)}</div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500"><span>Changes save automatically as you type or tick a box.</span>{management.updatedAt && <span className="font-semibold text-[var(--green)]">Saved {new Date(management.updatedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>}</div>
      <p className={`mt-4 border p-3 text-sm font-semibold ${ready ? 'border-[var(--green)] bg-[var(--green-soft)] text-[var(--green)]' : 'border-[var(--gold)] bg-[var(--gold-soft)] text-[var(--amber)]'}`}>{ready ? 'Staffing and preparation complete.' : 'Open Night preparation is not complete.'}</p>
    </section>
    <section className="mt-5 border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-6 py-4"><h2 className="font-semibold text-slate-900">Booked families</h2><p className="mt-1 text-sm text-slate-500">{roster.length} prospective {roster.length === 1 ? 'cadet' : 'cadets'} booked</p></div>
      {roster.length ? roster.map(({ family, cadet }) => <OpenNightRosterRow key={cadet.id} family={family} cadet={cadet} night={night} onChanged={refresh} />) : <p className="p-8 text-center text-sm text-slate-500">No bookings for this Open Night.</p>}
    </section>
  </div>
}

function OpenNightRosterRow({ family, cadet, night, onChanged }) {
  const [codeEmailStatus, setCodeEmailStatus] = useState('')
  const [absenceEmailStatus, setAbsenceEmailStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const markArrived = async () => {
    if (busy) return
    setBusy(true)
    try { await setOpenNightAttendance(family.id, cadet.id, { status: 'arrived', parentAttended: true, note: '' }) }
    catch { setCodeEmailStatus('That could not be saved. Check your connection and try again.') }
    finally { setBusy(false) }
    onChanged()
  }
  const approve = async () => {
    if (busy) return
    setBusy(true)
    let updated
    try {
      await setOpenNightAttendance(family.id, cadet.id, { status: 'attended', parentAttended: true, note: '' })
      updated = await markAttended(family.id, cadet.id)
    } catch {
      setBusy(false)
      setCodeEmailStatus('The joining code could not be saved. Check your connection and try again.')
      onChanged()
      return
    }
    const approvedCadet = updated.cadets.find((item) => item.id === cadet.id)
    try {
      const result = await sendJoiningCodeEmail(updated, approvedCadet)
      setCodeEmailStatus(result.simulated ? 'Thank-you and joining-code email prepared. Email sending is simulated locally.' : 'Thank-you and joining-code email sent.')
    } catch {
      setCodeEmailStatus('Joining code issued, but the email could not be sent. Contact the parent directly.')
    }
    setBusy(false)
    onChanged()
  }
  const markAbsent = async () => {
    if (busy) return
    setBusy(true)
    try {
      await setOpenNightAttendance(family.id, cadet.id, { status: 'absent', parentAttended: false, note: '' })
    } catch {
      setBusy(false)
      setAbsenceEmailStatus('That could not be saved. Check your connection and try again.')
      onChanged()
      return
    }
    try {
      const result = await sendDidNotAttendEmail(family, cadet, night)
      setAbsenceEmailStatus(result.simulated ? 'Non-attendance email prepared. Email sending is simulated locally.' : 'Non-attendance email sent with rebook and withdraw options.')
    } catch {
      setAbsenceEmailStatus('Marked as did not attend, but the email could not be sent. Contact the parent directly.')
    }
    setBusy(false)
    onChanged()
  }
  return <div className="border-b border-slate-200 p-5 last:border-b-0">
    <div className="flex flex-wrap justify-between gap-3"><div><h3 className="font-semibold text-slate-900">{cadet.fullName || 'Unnamed cadet'}</h3><p className="text-sm text-slate-500">Parent: {family.guardian.fullName || 'Not entered'} · {family.guardian.mobile || family.guardian.email || 'No contact entered'}</p>{family.cadets.length > 1 && <p className="mt-1 text-xs text-[var(--blue)]">Family group of {family.cadets.length} cadets</p>}</div>{cadet.joiningCode && <div className="text-right"><p className="font-mono text-xl font-semibold text-[var(--navy)]">Code {cadet.joiningCode}</p>{cadet.joiningCodeExpiresAt && <p className="text-xs text-slate-500">Use by {new Date(cadet.joiningCodeExpiresAt).toLocaleDateString('en-GB')}</p>}</div>}</div>
    {!cadet.attendedAt && cadet.openNightAttendanceStatus !== 'absent' && <div className="mt-4 flex flex-wrap gap-2">{cadet.openNightAttendanceStatus !== 'arrived' && <button type="button" onClick={markArrived} disabled={busy} className="rounded-lg bg-[var(--blue)] px-5 py-2.5 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50">Arrived</button>}{cadet.openNightAttendanceStatus === 'arrived' && <span className="rounded-lg border border-[var(--blue)] bg-[var(--navy-soft)] px-5 py-2.5 text-sm font-semibold text-[var(--blue)]">Arrived</span>}<button type="button" onClick={markAbsent} disabled={busy} className="rounded-lg border border-red-300 bg-red-50 px-5 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50">Did not attend and email parent</button><button type="button" onClick={approve} disabled={busy || cadet.openNightAttendanceStatus !== 'arrived'} className="rounded-lg bg-[var(--green)] px-5 py-2.5 text-sm font-semibold text-white hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-40">Wants to proceed - issue code and email parent</button></div>}
    {cadet.attendedAt && <p className="mt-4 rounded-lg bg-[var(--green-soft)] px-4 py-3 text-sm font-semibold text-[var(--green)]">Attendance approved and joining code issued.</p>}
    {cadet.openNightAttendanceStatus === 'absent' && <p className="mt-4 rounded-lg bg-[var(--gold-soft)] px-4 py-3 text-sm font-semibold text-[var(--amber)]">Did not attend. The parent has been emailed to rebook or withdraw.</p>}
    {codeEmailStatus && <p className="mt-3 text-sm font-medium text-[var(--blue)]">{codeEmailStatus}</p>}
    {absenceEmailStatus && <p className="mt-3 text-sm font-medium text-[var(--amber)]">{absenceEmailStatus}</p>}
  </div>
}

function FamilyAdminDetail({ family, note, setNote, act }) {
  const [showWithdrawal, setShowWithdrawal] = useState(false)
  const [selectedCadetId, setSelectedCadetId] = useState(family.cadets[0]?.id || '')
  useEffect(() => {
    setSelectedCadetId((current) => family.cadets.some((item) => item.id === current) ? current : family.cadets[0]?.id || '')
    setShowWithdrawal(false)
  }, [family.id, family.cadets])
  const cadet = family.cadets.find((item) => item.id === selectedCadetId) || family.cadets[0]
  const night = OPEN_NIGHTS.find((item) => item.id === cadet.openNightId)
  const messages = messagesForFamily(family.id)
  return <><p className="text-xs font-bold uppercase tracking-wide text-[var(--blue)]">Family record</p>{family.cadets.length > 1 && <div className="mt-2 flex flex-wrap gap-2">{family.cadets.map((item) => <button type="button" key={item.id} onClick={() => { setSelectedCadetId(item.id); setShowWithdrawal(false) }} className={item.id === cadet.id ? primary : secondary}>{item.fullName}</button>)}</div>}<h2 className="mt-3 text-xl font-semibold text-slate-900">{cadet.fullName}</h2>{hasMissedIntake(cadet) && <div className="mt-4 border border-red-300 bg-red-50 p-4 text-sm text-red-800"><p className="font-semibold">Missed intake - review required</p><p className="mt-1">Their intended start date was {formatDate(cadet.intendedStartDate)} and more than 14 days have passed. Check whether the family has contacted the Squadron. If they are no longer joining, use Withdraw / remove below.</p></div>}<dl className="mt-4 space-y-2 text-sm"><div className="flex justify-between gap-4"><dt className="text-slate-500">Parent</dt><dd className="font-medium text-right">{family.guardian.fullName}</dd></div><div className="flex justify-between gap-4"><dt className="text-slate-500">Contact</dt><dd className="font-medium text-right">{family.guardian.email}<br />{family.guardian.mobile}</dd></div><div className="flex justify-between gap-4"><dt className="text-slate-500">Parent verified</dt><dd className="font-medium">{family.guardian.verifiedAt ? 'Yes' : 'No'}</dd></div><div className="flex justify-between gap-4"><dt className="text-slate-500">Open night</dt><dd className="font-medium text-right">{night ? formatDate(night.startsAt) : 'Not booked'}</dd></div><div className="flex justify-between gap-4"><dt className="text-slate-500">Source</dt><dd className="font-medium text-right">{family.source}{family.sourceDetail ? <><br />{family.sourceDetail}</> : null}</dd></div></dl>
    <div className="mt-5 flex flex-wrap gap-2">{cadet.attendedAt && cadet.status !== 'ready_to_start' && <button onClick={() => act(() => setCadetStatus(family.id, cadet.id, 'ready_to_start'))} className={primary}>Mark ready to start</button>}{cadet.status === 'ready_to_start' && <button onClick={() => act(() => setCadetStatus(family.id, cadet.id, 'joined'))} className={primary}>Mark joined</button>}</div>
    {cadet.joiningCode && <div className="mt-5 rounded-xl bg-[var(--green-soft)] p-4"><p className="text-xs font-bold uppercase text-[var(--green)]">Joining paperwork unlocked</p><p className="mt-1 text-sm text-slate-700">One-time code: <strong className="font-mono text-xl text-[var(--navy)]">{cadet.joiningCode}</strong></p></div>}
    <div className="mt-6"><h3 className="text-sm font-semibold text-slate-900">Staff notes</h3><div className="mt-2 flex gap-2"><input className={inputClass + ' mt-0'} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note" /><button onClick={() => { act(() => addStaffNote(family.id, note)); setNote('') }} className={secondary}>Add</button></div>{family.notes.map((item) => <p key={item.id} className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">{item.text}</p>)}</div>
    <div className="mt-6"><h3 className="text-sm font-semibold text-slate-900">Email and communication history</h3><p className="mt-1 text-xs text-slate-500">Family-wide messages apply to every cadet linked to this parent.</p>{family.cadets.map((person) => { const personMessages = messages.filter((message) => !message.cadetId || message.cadetId === person.id); return <div key={person.id} className="mt-4 border border-slate-200 p-4"><h4 className="font-semibold text-[var(--navy)]">{person.fullName}</h4>{personMessages.length ? personMessages.map((message) => <details key={`${person.id}-${message.id}`} className="mt-3 border-t border-slate-100 pt-3 text-sm"><summary className="cursor-pointer list-none"><div className="flex flex-wrap items-start justify-between gap-2"><p className="font-medium text-slate-700">{message.subject}</p><span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">{message.status || 'simulated'}</span></div><p className="mt-1 text-xs text-slate-500">To: {message.to || family.guardian.email}</p><p className="text-xs text-slate-400">{message.createdAt ? new Date(message.createdAt).toLocaleString('en-GB') : 'Date not recorded'}{!message.cadetId ? ' · Family-wide' : ''} · Click to view</p></summary><div className="mt-3 rounded-lg bg-slate-50 p-4"><p className="text-xs font-bold uppercase text-slate-500">Recorded email</p><p className="mt-2 font-semibold text-slate-800">Subject: {message.subject}</p><div className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{typeof message.body === 'string' ? message.body : message.body ? JSON.stringify(message.body, null, 2) : 'The wording was not captured for this older record.'}</div></div></details>) : <p className="mt-2 text-sm text-slate-500">No communications recorded for this cadet.</p>}</div>})}</div>
    <div className="mt-8 border-t border-red-100 pt-5"><button type="button" onClick={() => setShowWithdrawal((value) => !value)} className="rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100">Withdraw / remove</button>{showWithdrawal && <DeleteEnquiryConfirmation cadetName={cadet.fullName} onCancel={() => setShowWithdrawal(false)} onDelete={async () => { await sendWithdrawalConfirmationEmail(family, cadet); await deleteCadetEnquiry(family.id, cadet.id); act(() => undefined); setShowWithdrawal(false) }} />}</div></>
}
