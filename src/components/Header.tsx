export default function Header({
  personCount,
  jamaat,
  onReset,
}: {
  personCount?: number;
  jamaat?: string;
  onReset?: () => void;
}) {
  return (
    <header className="shrink-0 border-b border-zinc-200 dark:border-zinc-800 px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-7 h-7 rounded-lg bg-zinc-900 dark:bg-white flex items-center justify-center shrink-0">
          <svg viewBox="0 0 24 24" className="w-4 h-4 text-white dark:text-zinc-900" fill="none">
            <path d="M4 19.5V4.5A1.5 1.5 0 0 1 5.5 3H16l4 4v12.5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
            <path d="M16 3v3.5A1.5 1.5 0 0 0 17.5 8H20" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          </svg>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium leading-tight">HR Talent Chat</p>
          {personCount != null && (
            <p className="text-xs text-zinc-400 truncate leading-tight">{personCount.toLocaleString()} people</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {jamaat && (
          <span className="text-xs rounded-lg bg-zinc-100 dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 px-2.5 py-1">
            Scoped to {jamaat}
          </span>
        )}
        {onReset && (
          <button
            onClick={onReset}
            title="Reset chat"
            aria-label="Reset chat"
            className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:text-zinc-300 dark:hover:bg-zinc-900 transition-colors"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none">
              <path
                d="M20 11A8 8 0 1 0 18.5 15.5M20 11V5m0 6h-6"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}
      </div>
    </header>
  );
}
