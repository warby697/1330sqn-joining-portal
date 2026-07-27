import { useState } from 'react'
import { getEmailTemplates, getKeyDates, saveEmailTemplates, saveKeyDates } from '../lib/communicationSettings'
import { changeOpenNightDates, listFamilies, sendOpenNightDateChangeEmail } from '../lib/recruitmentStore'

const field = 'mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900'

export default function AdminCommunications() {
  const [templates, setTemplates] = useState(getEmailTemplates)
  const [dates, setDates] = useState(getKeyDates)
  const [originalDates, setOriginalDates] = useState(getKeyDates)
  const [saved, setSaved] = useState('')

  const updateTemplate = (index, patch) => setTemplates((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item))
  const saveAll = async () => {
    const changed = originalDates.openNights.some((date, index) => date !== dates.openNights[index]) || originalDates.openNights.length !== dates.openNights.length
    let affectedCount = 0
    if (changed) {
      const bookedIds = new Set(originalDates.openNights.filter((date, index) => date !== dates.openNights[index]).map((date) => `open-night-${date}`))
      affectedCount = listFamilies().reduce((total, family) => total + family.cadets.filter((cadet) => bookedIds.has(cadet.openNightId) && !cadet.attendedAt).length, 0)
      if (affectedCount && !window.confirm(`This changes an Open Night with ${affectedCount} booked prospective ${affectedCount === 1 ? 'cadet' : 'cadets'}. Their bookings will be moved and their parents will be emailed. Continue?`)) return
    }
    saveEmailTemplates(templates)
    saveKeyDates(dates)
    if (changed) {
      const affected = await changeOpenNightDates(originalDates.openNights, dates.openNights)
      await Promise.allSettled(affected.map(({ family, cadet, oldDate, newDate }) => sendOpenNightDateChangeEmail(family, cadet, `${oldDate}T19:15:00`, `${newDate}T19:15:00`)))
    }
    setOriginalDates(dates)
    setSaved(affectedCount ? `Saved. ${affectedCount} booking ${affectedCount === 1 ? 'was' : 'were'} moved and the parents were emailed.` : 'Saved to the shared joining database.')
  }

  return <div className="mt-6 space-y-6">
    <section className="border border-slate-200 bg-white p-6">
      <h2 className="text-xl font-semibold text-slate-900">Emails and triggers</h2>
      <p className="mt-1 text-sm text-slate-500">Active emails are sent automatically or by the stated staff action. Switch one off to stop that message without changing the code.</p>
      <p className="mt-3 text-xs text-slate-500">Dynamic fields include: {'{{cadetName}}'}, {'{{parentName}}'}, {'{{openNightDate}}'}, {'{{joiningCode}}'}, {'{{codeExpiry}}'}, {'{{startDate}}'}, {'{{oldDate}}'}, {'{{newDate}}'}, {'{{portalUrl}}'} and {'{{outstandingList}}'} for the missed-intake staff alert.</p>
      <div className="mt-5 space-y-4">{templates.map((template, index) => <details key={template.id} className="border border-slate-200 p-4">
        <summary className="cursor-pointer font-semibold text-slate-900">{template.name} <span className={`ml-2 text-xs ${template.active ? 'text-[var(--green)]' : 'text-[var(--amber)]'}`}>{template.active ? 'Active' : 'Switched off'}</span></summary>
        <div className="mt-4 grid gap-3">
          <label className="flex items-center gap-3 bg-slate-50 p-3 text-sm font-semibold"><input type="checkbox" checked={template.active} onChange={(event) => updateTemplate(index, { active: event.target.checked })} />Send this email</label>
          <p className="text-sm"><strong>Trigger:</strong> {template.trigger}</p>
          <p className="text-sm"><strong>To:</strong> {template.recipient}</p>
          <label className="text-sm font-medium">Subject<input className={field} value={template.subject} onChange={(event) => updateTemplate(index, { subject: event.target.value })} /></label>
          <label className="text-sm font-medium">Email wording<textarea rows="8" className={field} value={template.body} onChange={(event) => updateTemplate(index, { body: event.target.value })} /></label>
        </div>
      </details>)}</div>
    </section>

    <section className="border border-slate-200 bg-white p-6">
      <h2 className="text-xl font-semibold text-slate-900">Key dates and timings</h2>
      <p className="mt-1 text-sm text-slate-500">These values drive recruitment dates, reminders, code expiry and joining instructions.</p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium sm:col-span-2">Open Night dates, one per line<textarea rows="7" className={field} value={dates.openNights.join('\n')} onChange={(event) => setDates({ ...dates, openNights: event.target.value.split(/\s+/).filter(Boolean) })} /></label>
        <label className="text-sm font-medium">Intake dates, month-day<input className={field} value={dates.intakeDates.join(', ')} onChange={(event) => setDates({ ...dates, intakeDates: event.target.value.split(',').map((value) => value.trim()).filter(Boolean) })} /></label>
        <label className="text-sm font-medium">Parade days<input className={field} value={dates.paradeDays} onChange={(event) => setDates({ ...dates, paradeDays: event.target.value })} /></label>
        <label className="text-sm font-medium">Open Night arrival<input type="time" className={field} value={dates.arrivalTime} onChange={(event) => setDates({ ...dates, arrivalTime: event.target.value })} /></label>
        <label className="text-sm font-medium">Open Night start<input type="time" className={field} value={dates.openNightStart} onChange={(event) => setDates({ ...dates, openNightStart: event.target.value })} /></label>
        <label className="text-sm font-medium">Parade time<input type="time" className={field} value={dates.paradeTime} onChange={(event) => setDates({ ...dates, paradeTime: event.target.value })} /></label>
        <label className="text-sm font-medium">Joining code validity, days<input type="number" min="1" className={field} value={dates.joiningCodeDays} onChange={(event) => setDates({ ...dates, joiningCodeDays: Number(event.target.value) })} /></label>
        <label className="text-sm font-medium">First reminder, days before<input type="number" min="1" className={field} value={dates.reminderDaysBefore} onChange={(event) => setDates({ ...dates, reminderDaysBefore: Number(event.target.value) })} /></label>
        <label className="text-sm font-medium">Final reminder, hours before<input type="number" min="1" className={field} value={dates.finalReminderHoursBefore} onChange={(event) => setDates({ ...dates, finalReminderHoursBefore: Number(event.target.value) })} /></label>
      </div>
    </section>
    <div className="flex items-center gap-3"><button onClick={saveAll} className="rounded-lg bg-[var(--blue)] px-5 py-2.5 text-sm font-semibold text-white">Save emails and dates</button>{saved && <p className="text-sm text-[var(--green)]">{saved}</p>}</div>
  </div>
}
