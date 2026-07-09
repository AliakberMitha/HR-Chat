import { motion } from "framer-motion";
import { PROMPT_SUGGESTIONS } from "../lib/prompts";

export default function PromptChips({ onPick }: { onPick: (template: string) => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-xl"
    >
      {PROMPT_SUGGESTIONS.map((p, i) => (
        <motion.button
          key={p.label}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: i * 0.04 }}
          onClick={() => onPick(p.template)}
          className="text-left rounded-xl border border-zinc-200 dark:border-zinc-800 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
        >
          <p className="text-sm font-medium">{p.label}</p>
          <p className="text-xs text-zinc-400 mt-0.5 line-clamp-2">{p.template}</p>
        </motion.button>
      ))}
    </motion.div>
  );
}
