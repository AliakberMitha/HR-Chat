import { getAdminToken } from "./adminAuth";
import { parseJsonResponse } from "./apiFetch";
import type { QuestionLogResponse } from "../types";

// Fire-and-forget -- logging must never block or break the chat experience,
// so failures are swallowed rather than surfaced.
export function logQuestion(jamaat: string | null, question: string): void {
  fetch("/api/log-question", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jamaat, question }),
  }).catch(() => {});
}

export interface QuestionLogQuery {
  page: number;
  pageSize: number;
  sortBy: "ts" | "jamaat" | "question";
  sortDir: "asc" | "desc";
  jamaat?: string; // "" = all, "__none__" = unrestricted/admin only
  search?: string;
  dateFrom?: string; // yyyy-mm-dd
  dateTo?: string; // yyyy-mm-dd
}

export async function fetchQuestionLog(params: QuestionLogQuery, signal?: AbortSignal): Promise<QuestionLogResponse> {
  const token = getAdminToken();
  if (!token) throw new Error("You're not signed in as admin.");

  const qs = new URLSearchParams();
  qs.set("page", String(params.page));
  qs.set("pageSize", String(params.pageSize));
  qs.set("sortBy", params.sortBy);
  qs.set("sortDir", params.sortDir);
  if (params.jamaat) qs.set("jamaat", params.jamaat);
  if (params.search) qs.set("search", params.search);
  if (params.dateFrom) qs.set("dateFrom", params.dateFrom);
  if (params.dateTo) qs.set("dateTo", params.dateTo);

  const res = await fetch(`/api/question-log?${qs.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal,
  });
  if (!res.ok) {
    const data = await parseJsonResponse<{ error?: string }>(res).catch(() => ({}) as { error?: string });
    throw new Error(data.error || `Failed to load the question log (${res.status}).`);
  }
  return parseJsonResponse<QuestionLogResponse>(res);
}
