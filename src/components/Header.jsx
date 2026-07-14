export default function Header({ subtitle, skipValidation, onToggleSkip }) {
  return (
    <header className="bg-[var(--navy)] text-white">
      <div className="mx-auto max-w-2xl px-5 py-4 flex items-center gap-3">
        <img src="/squadron-crest.png" alt="" className="h-12 w-auto shrink-0 object-contain drop-shadow" />
        <div className="min-w-0">
          <p className="text-[15px] font-semibold leading-tight">1330 Squadron RAF Air Cadets</p>
          <p className="text-xs text-white/70 leading-tight truncate">{subtitle}</p>
        </div>
        {onToggleSkip && (
          <button
            onClick={onToggleSkip}
            className={
              'ml-auto shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold tracking-wide transition ' +
              (skipValidation ? 'bg-[var(--amber)] text-white' : 'bg-white/10 text-white/80')
            }
            title="Toggle whether required fields block Continue — testing aid only"
          >
            {skipValidation ? 'SKIP VALIDATION: ON' : 'DEMO'}
          </button>
        )}
      </div>
    </header>
  )
}
