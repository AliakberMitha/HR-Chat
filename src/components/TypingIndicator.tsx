export default function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-1 py-2">
      <span className="typing-dot w-1.5 h-1.5 rounded-full bg-zinc-400" style={{ animationDelay: "0ms" }} />
      <span className="typing-dot w-1.5 h-1.5 rounded-full bg-zinc-400" style={{ animationDelay: "150ms" }} />
      <span className="typing-dot w-1.5 h-1.5 rounded-full bg-zinc-400" style={{ animationDelay: "300ms" }} />
    </div>
  );
}
