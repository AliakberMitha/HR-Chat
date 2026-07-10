export default function Header({ fileName, personCount }: { fileName?: string; personCount?: number }) {
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
          {fileName && (
            <p className="text-xs text-zinc-400 truncate leading-tight">
              {fileName} · {personCount?.toLocaleString()} people
            </p>
          )}
        </div>
      </div>
    </header>
  );
}
