export default function ProgressBar({ index, total, label }) {
  const pct = Math.round(((index + 1) / total) * 100)
  return (
    <div className="mb-6">
      <div className="flex justify-between text-xs text-slate-500 mb-1.5">
        <span>{label}</span>
        <span>
          Step {index + 1} of {total}
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
        <div
          className="h-full rounded-full bg-[var(--blue)] transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
