import { list, put } from "@vercel/blob";

export interface QuestionLogEntry {
  id: string;
  ts: number;
  jamaat: string | null;
  question: string;
}

// One blob per entry rather than a single read-modify-write JSON array: two
// questions logged close together (by different people, or even the same
// person in quick succession) would otherwise race on the shared blob and
// silently drop whichever write lost the race. A unique path per entry makes
// every write independent -- there is nothing to clobber.
const LOG_PREFIX = "question-log/";

export async function readLog(): Promise<QuestionLogEntry[]> {
  const entries: QuestionLogEntry[] = [];
  let cursor: string | undefined;

  do {
    const result = await list({ prefix: LOG_PREFIX, cursor, limit: 1000 });
    const fetched = await Promise.all(
      result.blobs.map(async (b) => {
        try {
          const res = await fetch(b.url, { cache: "no-store" });
          if (!res.ok) return null;
          return (await res.json()) as QuestionLogEntry;
        } catch {
          return null;
        }
      }),
    );
    for (const e of fetched) if (e) entries.push(e);
    cursor = result.hasMore ? result.cursor : undefined;
  } while (cursor);

  return entries;
}

export async function appendLogEntry(entry: QuestionLogEntry): Promise<void> {
  await put(`${LOG_PREFIX}${entry.ts}-${entry.id}.json`, JSON.stringify(entry), {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: false,
    contentType: "application/json",
  });
}
