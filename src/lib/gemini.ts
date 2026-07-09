import type { Row } from "../types";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
const MODEL = (import.meta.env.VITE_GEMINI_MODEL as string | undefined) || "gemini-2.5-flash";

// Fields never sent to the Gemini API even though they're shown locally in
// the "Show details" table — keeps direct contact PII off a third-party API.
const PRIVATE_FIELDS = new Set(["Mobile", "Email"]);

export function isGeminiConfigured() {
  return Boolean(API_KEY);
}

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

const SYSTEM_INSTRUCTION = `You are an HR staffing assistant for a Head Office, helping find the right
person for the right task from an internal personnel dataset. You are given a shortlist of
candidate records (already pre-filtered by a search step) relevant to the user's question, as a
JSON array. Each record includes fields such as Name, Occupation, Designation, Team, Umoor, Level,
Skills & SubSkills, Badges, Degrees, Dini Qualification, Hunars, Category & Activities, Hobbies,
360-degree feedback scores (Leadership, Behaviour, Teamwork, Dedication), and LMS courses completed.

Rules:
- Answer only using the candidate records provided below. Never invent people or facts not present in the data.
- When recommending people, always state their Name and ITSID, and briefly justify the match using specific fields (skills, courses, feedback scores, designation, etc).
- If multiple people qualify, rank the best matches first and explain the ranking.
- If nothing in the provided records answers the question, say so plainly and suggest the user rephrase — do not guess.
- Keep answers concise and scannable: short paragraphs, bullet points or a small table when comparing several people.
- Do not mention phone numbers or emails since that data isn't provided to you.`;

function rowsToContext(rows: Row[], columns: string[]): string {
  const cols = columns.filter((c) => !PRIVATE_FIELDS.has(c));
  const compact = rows.map((r) => {
    const obj: Record<string, string> = {};
    for (const c of cols) {
      if (r[c]) obj[c] = r[c];
    }
    return obj;
  });
  return JSON.stringify(compact);
}

export async function* streamAnswer(
  question: string,
  matchedRows: Row[],
  columns: string[],
  history: ChatTurn[],
): AsyncGenerator<string, void, unknown> {
  if (!API_KEY) {
    throw new Error(
      "Gemini API key is not configured. Set VITE_GEMINI_API_KEY in your .env file (see .env.example) and restart the dev server / redeploy.",
    );
  }

  const contextJson = rowsToContext(matchedRows, columns);
  const contents = [
    ...history.slice(-8).map((h) => ({
      role: h.role === "user" ? "user" : "model",
      parts: [{ text: h.content }],
    })),
    {
      role: "user",
      parts: [
        {
          text: `Candidate records (JSON, ${matchedRows.length} matched):\n${contextJson}\n\nQuestion: ${question}`,
        },
      ],
    },
  ];

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:streamGenerateContent?alt=sse&key=${API_KEY}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents,
      systemInstruction: { role: "system", parts: [{ text: SYSTEM_INSTRUCTION }] },
      generationConfig: { temperature: 0.3 },
    }),
  });

  if (!res.ok || !res.body) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Gemini API error (${res.status}): ${errText || res.statusText}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const jsonStr = trimmed.slice(5).trim();
      if (!jsonStr || jsonStr === "[DONE]") continue;
      try {
        const parsed = JSON.parse(jsonStr);
        const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) yield text;
      } catch {
        // ignore partial/non-JSON chunks
      }
    }
  }
}
