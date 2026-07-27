import { useState } from 'react'
import { getPin } from '../lib/pin'

export default function Gate({ onEnter }) {
  const [surname, setSurname] = useState('')
  const [forename, setForename] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')

  const submit = (e) => {
    e.preventDefault()
    if (!surname.trim()) {
      setError("Enter the cadet's surname to continue.")
      return
    }
    if (!forename.trim()) {
      setError("Enter the cadet's first name to continue.")
      return
    }
    if (pin !== getPin()) {
      setError('That code doesn\'t match - check the notice at the squadron HQ.')
      return
    }
    onEnter(forename.trim(), surname.trim(), pin)
  }

  return (
    <div className="min-h-screen flex flex-col">
      <div className="bg-[var(--navy)] text-white pt-10 pb-14 px-5 text-center">
        <img
          src="/squadron-crest.png"
          alt="1330 Squadron RAF Air Cadets crest"
          className="mx-auto h-36 w-auto object-contain drop-shadow-[0_8px_16px_rgba(0,0,0,0.35)] mb-3"
        />
        <h1 className="text-xl font-semibold">1330 Squadron - Joining Portal</h1>
        <p className="text-white/70 text-sm mt-1">Scanned from the QR code at the squadron HQ</p>
      </div>
      <div className="flex-1 flex items-start justify-center px-5 -mt-6">
        <form onSubmit={submit} className="w-full max-w-sm rounded-2xl bg-white shadow-lg shadow-black/5 border border-slate-200 p-6">
          <h2 className="text-base font-semibold text-slate-900 mb-1">Let's get started</h2>
          <p className="text-sm text-slate-500 mb-4">
            Enter the cadet's name and the code given to you at the squadron.
          </p>

          <div className="rounded-lg bg-[var(--navy-soft)] px-3.5 py-3 mb-5">
            <p className="text-sm font-medium text-[var(--navy)]">Takes about 15-20 minutes.</p>
            <p className="text-xs text-slate-600 mt-1">
              Please complete it in one sitting once you start - progress isn't saved if you close the page. You
              have 48 hours from now before this code stops working.
            </p>
          </div>

          <label className="block mb-4">
            <span className="text-sm font-medium text-slate-800">Cadet's surname</span>
            <input
              autoFocus
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-[15px] outline-none focus:border-[var(--blue)] focus:ring-2 focus:ring-[var(--blue)]/20"
              value={surname}
              onChange={(e) => setSurname(e.target.value)}
            />
          </label>

          <label className="block mb-4">
            <span className="text-sm font-medium text-slate-800">Cadet's first name</span>
            <input
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-[15px] outline-none focus:border-[var(--blue)] focus:ring-2 focus:ring-[var(--blue)]/20"
              value={forename}
              onChange={(e) => setForename(e.target.value)}
            />
          </label>

          <label className="block mb-5">
            <span className="text-sm font-medium text-slate-800">4-digit code</span>
            <input
              inputMode="numeric"
              maxLength={4}
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-[15px] tracking-[0.3em] outline-none focus:border-[var(--blue)] focus:ring-2 focus:ring-[var(--blue)]/20"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
            />
          </label>

          {error && <p className="text-sm text-[var(--amber)] mb-4">{error}</p>}

          <button
            type="submit"
            className="w-full rounded-lg bg-[var(--blue)] py-2.5 text-sm font-semibold text-white hover:brightness-110 transition"
          >
            Continue
          </button>
        </form>
      </div>
      <div className="text-center pb-6 pt-2">
        <a
          href="#admin"
          className="text-xs text-slate-400 hover:text-slate-600 hover:underline"
        >
          Staff: manage settings
        </a>
      </div>
    </div>
  )
}
