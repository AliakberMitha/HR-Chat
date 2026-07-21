import { list, put } from "@vercel/blob";

export interface QuestionLogEntry {
  id: string;
  ts: number;
  jamaat: string | null;
  question: string;
}

const LOG_PATH = "question-log.json";
// Bounds how large the log blob can grow; oldest entries are dropped past this.
const MAX_ENTRIES = 20000;

export async function readLog(): Promise<QuestionLogEntry[]> {
  const { blobs } = await list({ prefix: LOG_PATH, limit: 1 });
  const pointer = blobs.find((b) => b.pathname === LOG_PATH);
  if (!pointer) return [];

  const res = await fetch(pointer.url, { cache: "no-store" });
  if (!res.ok) return [];

  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export async function appendLogEntry(entry: QuestionLogEntry): Promise<void> {
  const entries = await readLog();
  entries.push(entry);
  const trimmed = entries.length > MAX_ENTRIES ? entries.slice(entries.length - MAX_ENTRIES) : entries;

  await put(LOG_PATH, JSON.stringify(trimmed), {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
  });
}
