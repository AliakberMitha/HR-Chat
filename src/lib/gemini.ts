import type { PersonProfile } from "./profiles";
import { profileAssignmentText } from "./profiles";
import type { QueryPlan, QueryResult } from "./queryEngine";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
const MODEL = (import.meta.env.VITE_GEMINI_MODEL as string | undefined) || "gemini-2.5-flash";

// Fields never sent to the Gemini API even though they're shown locally in
// the "Show details" table — keeps direct contact PII off a third-party API.
const PRIVATE_FIELDS = new Set(["Mobile", "Email"]);
const ASSIGNMENT_FIELDS = new Set(["Umoor", "Team", "Level"]);
const NUMERIC_FIELDS = [
  "Age",
  "360 degree feedback data (Leadership)",
  "360 degree feedback data (Behaviour)",
  "360 degree feedback data (Teamwork)",
  "360 degree feedback data (Dedication)",
];

export function isGeminiConfigured() {
  return Boolean(API_KEY);
}

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

function apiUrl(method: string) {
  return `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:${method}?key=${API_KEY}`;
}

function requireApiKey() {
  if (!API_KEY) {
    throw new Error(
      "Gemini API key is not configured. Set VITE_GEMINI_API_KEY in your .env file (see .env.example) and restart the dev server / redeploy.",
    );
  }
}

// --- Query planning -------------------------------------------------------
// A small, cheap, non-streaming call that turns the user's free-text question
// into a structured plan the app can execute exactly against the full local
// dataset, rather than asking the model to eyeball-count from a sample.

const PLAN_SYSTEM_INSTRUCTION = `You are a query planner for an internal HR personnel dataset. Turn the
user's question into a structured plan for how to answer it precisely from the data. Output must match
the given JSON schema exactly.

Intent guide:
- "count": pure "how many people..." / "count of people with X" questions.
- "breakdown": ratio / distribution / "how many per X" / "breakdown by X" questions.
- "average": "average <numeric field> of..." / "mean ... of ..." questions.
- "list" or "search": anything asking to find, recommend, compare, or shortlist specific people
  (e.g. "find the best person for...", "who is skilled in...", "compare candidates for...").
  This is the default when the question isn't a count/ratio/average question.

Rules:
- "keywords": free-text terms to substring-match against skill/course/hobby/etc. fields. Use short,
  singular, lowercase-friendly terms (e.g. "videography" not "people skilled in videography").
- "filters": exact-ish filters on categorical fields as {field, value} pairs (e.g. Gender=Male,
  Jamiat=Pakistan, Umoor=Umoor Al-Amlaak). Only include a filter if the question clearly names that value.
- "groupByField": set only for "breakdown" intent — the single field to group/count by.
- "metricField": set only for "average" intent — must be exactly one of: Age, "360 degree feedback data
  (Leadership)", "360 degree feedback data (Behaviour)", "360 degree feedback data (Teamwork)", "360
  degree feedback data (Dedication)".
- Umoor, Team, and Level are multi-valued per person (one person can hold several roles at once) — still
  usable as filters/groupByField, matched against any of a person's roles.
- Leave filters empty and groupByField/metricField null when not applicable. Never invent field names
  outside the provided column list.`;

const PLAN_SCHEMA = {
  type: "OBJECT",
  properties: {
    intent: { type: "STRING", enum: ["count", "breakdown", "average", "list", "search"] },
    keywords: { type: "ARRAY", items: { type: "STRING" } },
    filters: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          field: { type: "STRING" },
          value: { type: "STRING" },
        },
        required: ["field", "value"],
      },
    },
    groupByField: { type: "STRING", nullable: true },
    metricField: { type: "STRING", nullable: true },
  },
  required: ["intent", "keywords", "filters", "groupByField", "metricField"],
};

export async function planQuery(question: string, columns: string[], history: ChatTurn[]): Promise<QueryPlan> {
  requireApiKey();

  const fieldList = columns.filter((c) => c !== "ITSID" && !PRIVATE_FIELDS.has(c)).join(", ");
  const prompt = `Available fields: ${fieldList}
Numeric metric fields: ${NUMERIC_FIELDS.map((f) => `"${f}"`).join(", ")}

${history.length ? `Recent conversation:\n${history.slice(-4).map((h) => `${h.role}: ${h.content}`).join("\n")}\n\n` : ""}Question: ${question}`;

  const res = await fetch(apiUrl("generateContent"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      systemInstruction: { role: "system", parts: [{ text: PLAN_SYSTEM_INSTRUCTION }] },
      generationConfig: {
        temperature: 0,
        responseMimeType: "application/json",
        responseSchema: PLAN_SCHEMA,
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Gemini query-planning error (${res.status}): ${errText || res.statusText}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini did not return a query plan.");

  let parsed: Partial<QueryPlan>;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Gemini returned an invalid query plan.");
  }

  const validIntents = new Set(["count", "breakdown", "average", "list", "search"]);
  return {
    intent: validIntents.has(parsed.intent as string) ? (parsed.intent as QueryPlan["intent"]) : "search",
    keywords: Array.isArray(parsed.keywords) ? parsed.keywords.filter((k) => typeof k === "string") : [],
    filters: Array.isArray(parsed.filters)
      ? parsed.filters.filter(
          (f): f is { field: string; value: string } =>
            !!f && typeof f.field === "string" && typeof f.value === "string",
        )
      : [],
    groupByField: typeof parsed.groupByField === "string" ? parsed.groupByField : null,
    metricField: typeof parsed.metricField === "string" ? parsed.metricField : null,
  };
}

// --- Final answer -----------------------------------------------------------

const ANSWER_SYSTEM_INSTRUCTION = `You are an HR staffing assistant for a Head Office, helping find the
right person for the right task and answer analytical questions from an internal personnel dataset.

You are given two things:
1. Pre-computed EXACT statistics from the FULL dataset (total counts, breakdowns, averages). These are
   authoritative and already correct — state them precisely. Never recompute, round differently, estimate,
   or contradict them.
2. A JSON sample of individual candidate/person records for qualitative detail and citation. This sample
   may be smaller than the total match count — never imply it is the complete list unless the sample size
   equals the stated total.

Rules:
- If exact statistics (count/breakdown/average) are provided, lead your answer with those precise numbers.
- When citing individuals, state their Name and ITSID, and briefly justify with specific fields (skills,
  courses, feedback scores, roles, etc).
- If an average fact is given, it fully and sufficiently answers any average/mean question about that
  metric for the filters already applied — never claim a "specific" or "more precise" average is
  unavailable, and never add a hedge implying the number might not apply to the requested subset; it does.
- An average computed from fewer records than the total match count means most people don't have that
  field filled in — mention the sample size the average is based on (e.g. "526 of 4,586 people have a
  recorded score").
- A person's "Roles" field lists every Umoor/Team/Level assignment they hold — they can hold several.
- If nothing in the provided data answers the question, say so plainly — do not guess.
- Keep answers concise and scannable: short paragraphs, bullet points, or a small table when comparing
  several people or presenting a breakdown.
- Do not mention phone numbers or emails since that data isn't provided to you.`;

function profilesToContext(profiles: PersonProfile[], columns: string[]): string {
  const cols = columns.filter((c) => !PRIVATE_FIELDS.has(c) && !ASSIGNMENT_FIELDS.has(c));
  const compact = profiles.map((p) => {
    const obj: Record<string, string> = {};
    for (const c of cols) {
      if (p.fields[c]) obj[c] = p.fields[c];
    }
    const roles = profileAssignmentText(p);
    if (roles) obj.Roles = roles;
    return obj;
  });
  return JSON.stringify(compact);
}

function factsSummary(plan: QueryPlan, result: QueryResult): string {
  const lines = [`Total matching records in the full dataset: ${result.totalMatches}`];
  if (result.breakdown && plan.groupByField) {
    lines.push(`Breakdown by ${plan.groupByField} (all groups, exact counts): ${JSON.stringify(result.breakdown)}`);
  }
  if (result.average && plan.metricField) {
    lines.push(
      `Average of "${plan.metricField}": ${result.average.value.toFixed(2)}, computed from ${result.average.count} of ${result.totalMatches} matching records that have a recorded value.`,
    );
  }
  return lines.join("\n");
}

export async function* streamAnswer(
  question: string,
  plan: QueryPlan,
  result: QueryResult,
  sampleProfiles: PersonProfile[],
  columns: string[],
  history: ChatTurn[],
): AsyncGenerator<string, void, unknown> {
  requireApiKey();

  const facts = factsSummary(plan, result);
  const sampleJson = profilesToContext(sampleProfiles, columns);

  const contents = [
    ...history.slice(-8).map((h) => ({
      role: h.role === "user" ? "user" : "model",
      parts: [{ text: h.content }],
    })),
    {
      role: "user",
      parts: [
        {
          text: `${facts}\n\nSample candidate records (JSON, ${sampleProfiles.length} of ${result.totalMatches} total shown):\n${sampleJson}\n\nQuestion: ${question}`,
        },
      ],
    },
  ];

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:streamGenerateContent?alt=sse&key=${API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents,
        systemInstruction: { role: "system", parts: [{ text: ANSWER_SYSTEM_INSTRUCTION }] },
        generationConfig: { temperature: 0.3 },
      }),
    },
  );

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
