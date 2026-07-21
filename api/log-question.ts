import type { VercelRequest, VercelResponse } from "@vercel/node";
import { randomUUID } from "node:crypto";
import { appendLogEntry } from "./_lib/questionLogStore";

const MAX_QUESTION_LEN = 2000;

// Public on purpose -- every chat visitor (restricted or not) triggers this
// when they ask a question, not just admins. Best-effort: the caller fires
// this and ignores the result, so a failure here must never surface as a
// chat error.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    const body = req.body as { jamaat?: unknown; question?: unknown } | undefined;
    const question = typeof body?.question === "string" ? body.question.trim() : "";
    if (!question) {
      res.status(400).json({ error: "Missing question." });
      return;
    }

    const jamaatRaw = typeof body?.jamaat === "string" ? body.jamaat.trim() : "";
    const jamaat = jamaatRaw ? jamaatRaw : null;

    await appendLogEntry({
      id: randomUUID(),
      ts: Date.now(),
      jamaat,
      question: question.slice(0, MAX_QUESTION_LEN),
    });

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error("log-question failed:", err);
    res.status(500).json({ error: err instanceof Error ? err.message : "Failed to log the question." });
  }
}
