import { useState } from 'react'
import { getAdminEmails, setAdminEmails } from '../lib/adminEmails'

const STAFF_PIN = '1918'

function PinGate({ onUnlock }) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')

  const submit = (e) => {
    e.preventDefault()
    if (pin !== STAFF_PIN) {
      setError('Incorrect PIN.')
      return
    }
    onUnlock()
  }

  return (
    <div className="min-h-screen bg-slate-100 flex items-start justify-center pt-24 px-5">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl bg-white shadow-lg shadow-black/5 border border-slate-200 p-6">
        <h2 className="text-base font-semibold text-slate-900 mb-1">Staff zone</h2>
        <p className="text-sm text-slate-500 mb-4">Enter the staff PIN to manage joining portal settings.</p>
        <input
          autoFocus
          inputMode="numeric"
          maxLength={4}
          className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-[15px] tracking-[0.3em] outline-none focus:border-[var(--blue)] focus:ring-2 focus:ring-[var(--blue)]/20 mb-3"
          value={pin}
          onChange={(e) => {
            setPin(e.target.value.replace(/\D/g, ''))
            setError('')
          }}
        />
        {error && <p className="text-sm text-[var(--amber)] mb-3">{error}</p>}
        <button
          type="submit"
          className="w-full rounded-lg bg-[var(--blue)] py-2.5 text-sm font-semibold text-white hover:brightness-110 transition"
        >
          Continue
        </button>
        <a href="#" className="mt-4 inline-block text-sm text-slate-500 hover:underline">
          ← Back to the joining form
        </a>
      </form>
    </div>
  )
}

export default function AdminSettings() {
  const [unlocked, setUnlocked] = useState(false)
  const [emails, setEmails] = useState(getAdminEmails())
  const [saved, setSaved] = useState(false)

  if (!unlocked) return <PinGate onUnlock={() => setUnlocked(true)} />

  const update = (idx, value) => {
    const next = [...emails]
    next[idx] = value
    setEmails(next)
    setSaved(false)
  }
  const remove = (idx) => {
    setEmails(emails.filter((_, i) => i !== idx))
    setSaved(false)
  }
  const add = () => setEmails([...emails, ''])
  const save = () => {
    setAdminEmails(emails)
    setSaved(true)
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-[var(--navy)] text-white px-5 py-4">
        <p className="text-[15px] font-semibold">Admin — Joining Portal settings</p>
        <p className="text-xs text-white/70">Not part of the parent-facing flow</p>
      </header>
      <main className="mx-auto max-w-lg px-5 py-6">
        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-6">
          <h2 className="text-base font-semibold text-slate-900 mb-1">Where completed forms get sent</h2>
          <p className="text-sm text-slate-500 mb-5">
            Every completed joining form is emailed to every address below. Update this list if a staff member's
            Bader inbox changes — no code change or redeploy needed.
          </p>

          <div className="space-y-2 mb-3">
            {emails.map((email, idx) => (
              <div key={idx} className="flex gap-2">
                <input
                  className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--blue)]"
                  type="email"
                  placeholder="name@bader.mod.uk"
                  value={email}
                  onChange={(e) => update(idx, e.target.value)}
                />
                <button
                  onClick={() => remove(idx)}
                  className="px-3 text-slate-400 hover:text-[var(--amber)]"
                  aria-label="Remove"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          <button onClick={add} className="text-sm font-medium text-[var(--blue)] hover:underline mb-6">
            + Add another address
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={save}
              className="rounded-lg bg-[var(--blue)] px-5 py-2.5 text-sm font-semibold text-white hover:brightness-110"
            >
              Save
            </button>
            {saved && <span className="text-sm text-[var(--green)] font-medium">Saved</span>}
          </div>

          <p className="mt-6 rounded-lg bg-[var(--gold-soft)] px-3 py-2 text-xs text-[var(--amber)]">
            Demo only — stored in this browser's local storage. The real build should use proper staff logins here
            rather than one shared PIN.
          </p>
        </div>

        <a href="#" className="mt-4 inline-block text-sm text-slate-500 hover:underline">
          ← Back to the joining form
        </a>
      </main>
    </div>
  )
}
