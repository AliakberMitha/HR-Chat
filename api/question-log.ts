import type { VercelRequest, VercelResponse } from "@vercel/node";
import { extractBearerToken, verifyAdminToken } from "./_lib/adminToken";
import { readLog, type QuestionLogEntry } from "./_lib/questionLogStore";

function monthKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function firstString(v: unknown): string {
  if (typeof v === "string") return v;
  if (Array.isArray(v) && typeof v[0] === "string") return v[0];
  return "";
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "GET") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    const token = extractBearerToken(req.headers.authorization);
    if (!verifyAdminToken(token)) {
      res.status(401).json({ error: "Unauthorized: admin session is missing or expired." });
      return;
    }

    const q = req.query;
    const page = Math.max(1, Math.trunc(Number(firstString(q.page))) || 1);
    const pageSize = Math.min(100, Math.max(1, Math.trunc(Number(firstString(q.pageSize))) || 20));
    const sortByRaw = firstString(q.sortBy);
    const sortBy = sortByRaw === "jamaat" || sortByRaw === "question" ? sortByRaw : "ts";
    const sortDir = firstString(q.sortDir) === "asc" ? "asc" : "desc";
    const jamaatFilter = firstString(q.jamaat);
    const search = firstString(q.search).trim().toLowerCase();
    const dateFromRaw = firstString(q.dateFrom);
    const dateToRaw = firstString(q.dateTo);
    const dateFrom = dateFromRaw ? new Date(`${dateFromRaw}T00:00:00.000Z`).getTime() : null;
    const dateTo = dateToRaw ? new Date(`${dateToRaw}T23:59:59.999Z`).getTime() : null;

    const all = await readLog();

    const distinctJamaats = Array.from(new Set(all.filter((e) => e.jamaat).map((e) => e.jamaat as string))).sort(
      (a, b) => a.localeCompare(b),
    );
    const hasUnrestricted = all.some((e) => !e.jamaat);

    let filtered: QuestionLogEntry[] = all;
    if (jamaatFilter === "__none__") {
      filtered = filtered.filter((e) => !e.jamaat);
    } else if (jamaatFilter) {
      const target = jamaatFilter.toLowerCase();
      filtered = filtered.filter((e) => (e.jamaat ?? "").toLowerCase() === target);
    }
    if (search) {
      filtered = filtered.filter(
        (e) => e.question.toLowerCase().includes(search) || (e.jamaat ?? "").toLowerCase().includes(search),
      );
    }

    // Monthly aggregation respects the jamaat + search filters but ignores the
    // date range, so the chart always shows the full trend for whatever scope
    // is selected -- the table below handles date drill-down separately.
    const monthlyMap = new Map<string, number>();
    for (const e of filtered) {
      const key = monthKey(e.ts);
      monthlyMap.set(key, (monthlyMap.get(key) ?? 0) + 1);
    }
    const monthly = Array.from(monthlyMap.entries())
      .map(([month, count]) => ({ month, count }))
      .sort((a, b) => a.month.localeCompare(b.month));

    let dateFiltered = filtered;
    if (dateFrom != null) dateFiltered = dateFiltered.filter((e) => e.ts >= dateFrom);
    if (dateTo != null) dateFiltered = dateFiltered.filter((e) => e.ts <= dateTo);

    const sorted = [...dateFiltered].sort((a, b) => {
      let cmp: number;
      if (sortBy === "jamaat") cmp = (a.jamaat ?? "").localeCompare(b.jamaat ?? "");
      else if (sortBy === "question") cmp = a.question.localeCompare(b.question);
      else cmp = a.ts - b.ts;
      return sortDir === "asc" ? cmp : -cmp;
    });

    const total = sorted.length;
    const start = (page - 1) * pageSize;
    const entries = sorted.slice(start, start + pageSize);

    res.status(200).json({ entries, total, page, pageSize, distinctJamaats, hasUnrestricted, monthly });
  } catch (err) {
    console.error("question-log failed:", err);
    res.status(500).json({ error: err instanceof Error ? err.message : "Failed to load the question log." });
  }
}
