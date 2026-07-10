import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { useDatasetStore } from "../store/useDatasetStore";
import { loadForChat } from "../lib/loadPipeline";
import { getColumns, isLoaded } from "../lib/dataset";
import { getSqlSchemaDescription, runSql, stripTrailingLimit } from "../lib/duckdb";
import { generateSql, streamAnswer, isGeminiConfigured, type ChatTurn } from "../lib/gemini";
import type { ChatMessage } from "../types";
import Header from "../components/Header";
import ChatBubble from "../components/ChatBubble";
import PromptChips from "../components/PromptChips";

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

type LoadOutcome = "loading" | "ready" | "empty" | "error";

export default function ChatPage() {
  const navigate = useNavigate();
  const { meta, setMeta } = useDatasetStore();
  const [outcome, setOutcome] = useState<LoadOutcome>("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadLabel, setLoadLabel] = useState("Loading...");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let cancelled = false;
    async function ensureData() {
      if (isLoaded() && meta) {
        setOutcome("ready");
        return;
      }
      const result = await loadForChat({
        onStage: (_s, label) => !cancelled && setLoadLabel(label || "Loading..."),
        onError: () => {},
      });
      if (cancelled) return;
      if (result.kind === "ready") {
        setMeta(result.meta);
        setOutcome("ready");
      } else if (result.kind === "empty") {
        setOutcome("empty");
      } else {
        setLoadError(result.message);
        setOutcome("error");
      }
    }
    ensureData();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const autosize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  }, []);

  const handleSend = useCallback(
    async (text: string) => {
      const question = text.trim();
      if (!question || sending) return;

      const history: ChatTurn[] = messages
        .filter((m) => !m.error)
        .map((m) => ({ role: m.role, content: m.content }));

      const userMsg: ChatMessage = { id: uid(), role: "user", content: question };
      const assistantId = uid();
      const assistantMsg: ChatMessage = { id: assistantId, role: "assistant", content: "", isStreaming: true };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setInput("");
      setSending(true);
      requestAnimationFrame(autosize);

      if (!isGeminiConfigured()) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, isStreaming: false, error: true, content: "Gemini API key is not configured. Set VITE_GEMINI_API_KEY in your .env file and restart / redeploy." }
              : m,
          ),
        );
        setSending(false);
        return;
      }

      const columns = getColumns();
      let sql: string;
      try {
        const generated = await generateSql(question, getSqlSchemaDescription(columns), history);
        // Gemini's own LIMIT keeps its conversational answer readable, but
        // Show Details / export should reflect every matching row.
        sql = stripTrailingLimit(generated);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to interpret the question.";
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, isStreaming: false, error: true, content: message } : m)),
        );
        setSending(false);
        return;
      }

      let queryResult;
      try {
        queryResult = await runSql(sql);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to run the generated query.";
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, isStreaming: false, error: true, content: message } : m)),
        );
        setSending(false);
        return;
      }

      const totalRowCount = queryResult.rows.length;
      const allRows = queryResult.rows.slice(0, 5000); // sanity cap for the details table / export
      const forAnswer = allRows.slice(0, 200); // keep the Gemini prompt a reasonable size

      try {
        let acc = "";
        for await (const chunk of streamAnswer(question, sql, forAnswer, totalRowCount, history)) {
          acc += chunk;
          const snapshot = acc;
          setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, content: snapshot } : m)));
        }
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, isStreaming: false, sql, resultRows: allRows, totalRowCount } : m,
          ),
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : "Something went wrong talking to Gemini.";
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, isStreaming: false, error: true, content: message } : m)),
        );
      } finally {
        setSending(false);
      }
    },
    [messages, sending, autosize],
  );

  if (outcome === "loading") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
        <div className="w-8 h-8 rounded-full border-2 border-zinc-300 dark:border-zinc-700 border-t-zinc-900 dark:border-t-white animate-spin" />
        <p className="text-xs text-zinc-400">{loadLabel}</p>
      </div>
    );
  }

  if (outcome === "empty") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 px-4 text-center">
        <h2 className="text-lg font-semibold">No HR data has been published yet</h2>
        <p className="text-sm text-zinc-400 max-w-sm">
          Ask your administrator to upload the HR dataset before you can start chatting.
        </p>
        <button
          onClick={() => navigate("/")}
          className="mt-2 text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 underline"
        >
          Are you the admin? Upload data →
        </button>
      </div>
    );
  }

  if (outcome === "error") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 px-4 text-center">
        <h2 className="text-lg font-semibold">Couldn't load the HR dataset</h2>
        <p className="text-sm text-red-500 max-w-sm">{loadError}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-2 rounded-lg border border-zinc-200 dark:border-zinc-800 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-900 transition"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      <Header fileName={meta?.fileName} personCount={meta?.personCount} />

      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-6 flex flex-col gap-4 min-h-full">
          {messages.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-6 text-center">
              <div>
                <h2 className="text-xl font-semibold">Find the right person for the khidmat</h2>
                <p className="text-sm text-zinc-400 mt-1">Ask about skills, courses, feedback scores — or counts, ratios, and breakdowns across the dataset.</p>
              </div>
              <PromptChips onPick={(t) => { setInput(t); requestAnimationFrame(() => { textareaRef.current?.focus(); autosize(); }); }} />
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {messages.map((m) => (
                <ChatBubble key={m.id} message={m} />
              ))}
            </AnimatePresence>
          )}
        </div>
      </div>

      <div className="shrink-0 border-t border-zinc-200 dark:border-zinc-800 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-end gap-2 rounded-2xl border border-zinc-200 dark:border-zinc-800 px-3 py-2 focus-within:border-zinc-400 dark:focus-within:border-zinc-600 transition-colors">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              autosize();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend(input);
              }
            }}
            rows={1}
            placeholder="Ask about your HR data..."
            className="flex-1 resize-none bg-transparent outline-none text-[15px] py-1.5 max-h-40 placeholder:text-zinc-400"
          />
          <button
            onClick={() => handleSend(input)}
            disabled={sending || !input.trim()}
            className="shrink-0 w-8 h-8 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 flex items-center justify-center disabled:opacity-30 transition-opacity"
            aria-label="Send"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none">
              <path d="M12 19V5m0 0-6 6m6-6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
        <p className="text-center text-[11px] text-zinc-300 dark:text-zinc-600 mt-2">
          Answers are generated by AI from your uploaded data and may be imprecise — verify before acting.
        </p>
      </div>
    </div>
  );
}
