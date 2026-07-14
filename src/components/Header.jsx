export default function Header({ subtitle }) {
  return (
    <header className="bg-[var(--navy)] text-white">
      <div className="mx-auto max-w-2xl px-5 py-4 flex items-center gap-3">
        <img src="/squadron-crest.png" alt="" className="h-12 w-auto shrink-0 object-contain drop-shadow" />
        <div className="min-w-0">
          <p className="text-[15px] font-semibold leading-tight">1330 Squadron RAF Air Cadets</p>
          <p className="text-xs text-white/70 leading-tight truncate">{subtitle}</p>
        </div>
      </div>
    </header>
  )
}
