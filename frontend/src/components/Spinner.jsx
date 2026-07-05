/**
 * A spinning loading indicator (CSS animation, currentColor). Pair with a label
 * so "loading" never looks like a frozen screen.
 */
export default function Spinner({ className = 'h-5 w-5', label }) {
  return (
    <span className="inline-flex items-center gap-2 text-slate-400">
      <svg className={`${className} animate-spin`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-90" d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      </svg>
      {label && <span className="text-sm">{label}</span>}
    </span>
  );
}
