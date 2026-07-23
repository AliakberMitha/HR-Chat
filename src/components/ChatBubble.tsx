import { useState } from "react";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ChatMessage } from "../types";
import TypingIndicator from "./TypingIndicator";
import ShowDetailsTable from "./ShowDetailsTable";

export default function ChatBubble({
  message,
  onRefreshDetails,
}: {
  message: ChatMessage;
  onRefreshDetails?: (id: string, sql: string) => Promise<void>;
}) {
  const [showDetails, setShowDetails] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const isUser = message.role === "user";

  async function handleRefresh() {
    if (!message.sql || refreshing) return;
    setRefreshing(true);
    try {
      await onRefreshDetails?.(message.id, message.sql);
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className={`flex ${isUser ? "justify-end" : "justify-start"}`}
    >
      <div className={`max-w-[85%] sm:max-w-[75%] ${isUser ? "order-2" : ""}`}>
        <div
          className={`rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed ${
            isUser
              ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900"
              : message.error
                ? "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900"
                : "bg-zinc-100 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
          }`}
        >
          {message.isStreaming && !message.content ? (
            <TypingIndicator />
          ) : isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <div className="prose-chat">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
            </div>
          )}
        </div>

        {!isUser && !message.isStreaming && message.sql && (
          <div className="mt-1.5">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowDetails((v) => !v)}
                className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 inline-flex items-center gap-1 transition-colors"
              >
                <svg viewBox="0 0 24 24" className={`w-3 h-3 transition-transform ${showDetails ? "rotate-90" : ""}`} fill="none">
                  <path d="m9 6 6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {showDetails ? "Hide details" : "Show details"}
              </button>
              {onRefreshDetails && (
                <button
                  onClick={handleRefresh}
                  disabled={refreshing}
                  title="Refresh results"
                  aria-label="Refresh results"
                  className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors disabled:opacity-50"
                >
                  <svg viewBox="0 0 24 24" className={`w-3 h-3 ${refreshing ? "animate-spin" : ""}`} fill="none">
                    <path
                      d="M20 11A8 8 0 1 0 18.5 15.5M20 11V5m0 6h-6"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              )}
            </div>
            {showDetails && (
              <ShowDetailsTable resultRows={message.resultRows ?? []} totalRowCount={message.totalRowCount ?? 0} />
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
