const API_KEY = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
const MODEL = (import.meta.env.VITE_GEMINI_MODEL as string | undefined) || "gemini-3.5-flash";

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

// --- Text-to-SQL ------------------------------------------------------------
// A small, cheap, non-streaming call that turns the user's free-text question
// into a single read-only DuckDB SQL query, which the app then executes
// exactly against the full in-browser dataset -- so counts, ratios,
// breakdowns, and averages are real numbers, not an LLM eyeballing a sample.

const SQL_SYSTEM_INSTRUCTION = `You write a single read-only DuckDB SQL query (SELECT or WITH ... SELECT
only) to answer a question about an internal HR personnel dataset, given this schema:

{{SCHEMA}}

Rules:
- Output only the SQL query as plain text -- no markdown code fences, no explanation, no trailing semicolon issues.
- Use ONLY the columns listed above; never invent column or table names.
- ALWAYS use case-insensitive substring matching (ILIKE '%value%') for EVERY text/categorical filter --
  never exact equality (=) on a VARCHAR column. This includes jamiat, gender, umoor, team, level,
  designation, occupation, and every other text column. Real values are often longer or differently-cased
  than how a person names them in a question (e.g. someone might say "Al-Amlaak" when the stored value is
  "Umoor Al-Amlaak", or "pakistan" when it's stored "Pakistan") -- ILIKE '%...%' handles this; exact '='
  silently returns zero rows and produces a wrong "nobody matches" answer.
- Umoor/Team/Level live only in the assignments table (one row per person-role; a person can hold several
  roles at once, so a plain JOIN duplicates that person once per matching role).
  - If you only need to FILTER people by Umoor/Team/Level (not display or group by the role itself),
    use a semi-join instead of a JOIN so each person appears once:
    WHERE itsid IN (SELECT itsid FROM assignments WHERE umoor ILIKE '%...%')
  - Only use an actual JOIN when the query also needs to SELECT or GROUP BY umoor/team/level values
    themselves, and add SELECT DISTINCT (or GROUP BY all selected people columns) if you still want one
    row per person rather than one row per matching role.
- When the question is about finding/recommending/comparing specific people, SELECT the relevant people
  columns directly (not just itsid) and LIMIT to a reasonable number (20-50) ordered sensibly (e.g. by a
  relevant score DESC) so there's enough to reason over without being excessive.
- When the question is a pure count of PEOPLE, use COUNT(DISTINCT itsid).
- When the question asks for a ratio, percentage, or breakdown, GROUP BY the relevant column and return
  counts per group (let the app's answer step compute ratios/percentages from the counts).
- When averaging a nullable numeric column, the NULLs (unrecorded values) are already excluded by AVG --
  also return COUNT(<column>) alongside AVG(<column>) so the answer can state how many people the average
  is based on versus the total matched.
- If the question can't be answered from this schema, output: SELECT 'unanswerable' AS error`;

export async function generateSql(question: string, schemaDescription: string, history: ChatTurn[]): Promise<string> {
  requireApiKey();

  const systemInstruction = SQL_SYSTEM_INSTRUCTION.replace("{{SCHEMA}}", schemaDescription);
  const prompt = `${history.length ? `Recent conversation:\n${history.slice(-4).map((h) => `${h.role}: ${h.content}`).join("\n")}\n\n` : ""}Question: ${question}`;

  const res = await fetch(apiUrl("generateContent"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      systemInstruction: { role: "system", parts: [{ text: systemInstruction }] },
      generationConfig: { temperature: 0 },
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Gemini SQL-generation error (${res.status}): ${errText || res.statusText}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text as string | undefined;
  if (!text) throw new Error("Gemini did not return a SQL query.");

  return text
    .trim()
    .replace(/^```sql\s*/i, "")
    .replace(/^```\s*/, "")
    .replace(/```\s*$/, "")
    .replace(/;+\s*$/, "")
    .trim();
}

// --- Final answer -----------------------------------------------------------

function buildAnswerSystemInstruction(validUmoors: string[]): string {
  const umoorSection =
    validUmoors.length > 0
      ? `This tool exists to help Head Office match the right person to the right Umoor. Whenever your
answer names or discusses specific individuals (find/recommend/list/compare questions -- NOT pure
count/ratio/breakdown/average answers that don't name anyone), give EACH person you mention:
- A brief remark: one short clause on why they stand out (skills, badges, feedback scores, designation, etc).
- A suggested Umoor: the single best-fit Umoor for them, chosen ONLY from this exact list of valid Umoor
  names -- never invent or alter one:
  ${validUmoors.join(", ")}
  If nothing about the person clearly points to one Umoor, pick the closest reasonable match and say so
  briefly (e.g. "closest fit given their finance background"). This suggestion can match or differ from
  any Umoor they're already recorded against -- the goal is the best-fit placement, not just confirming
  their current role.`
      : "";

  return `You are an HR staffing assistant for a Head Office, helping find the right person for the right
task and answer analytical questions from an internal personnel dataset.

You are given the exact SQL query that was run against the full dataset and its exact result rows (as
JSON). This result is authoritative and already correct -- state numbers from it precisely, never
recompute, round differently, estimate, or contradict them.

${umoorSection}

Rules:
- Lead with the precise number(s) from the result when the question asks for a count, ratio, breakdown, or average.
- When the result lists individual people, only name/discuss a small, useful subset in your reply --
  roughly the top 10-15 most relevant (or fewer if the question implies a specific small number like "the
  best person" or "top 5"). If the result has more rows than that, say how many there are in total and
  mention that the full list is available via Show Details / Export to Excel below -- do not enumerate
  dozens or hundreds of names in the chat reply, that's unreadable.
- When citing individuals, state their name and itsid, and briefly justify with specific fields (skills, courses, feedback scores, roles, etc).
- A count column named with "AVG" alongside a "COUNT" of the same metric means the average is based on
  only the people who have that value recorded, out of a larger total -- mention both numbers if both are present.
- When ranking or comparing groups by an average, explicitly flag any group whose supporting count is very
  small (roughly under 10) -- a small sample can top a ranking by chance and that's misleading to present
  without the caveat.
- If the result is empty or the query indicates the question is unanswerable from this data, say so plainly -- do not guess.
- Keep answers concise and scannable: short paragraphs, bullet points, or a small table when comparing several people or presenting a breakdown.
- Do not mention phone numbers or emails -- that data isn't provided to you.
- If the result includes tenure/eligibility columns (years_on_post, years_managing_nonpost, years_advisory,
  total_years_served, post_eligibility, years_left_critical, years_left_any_post), explain them in plain
  terms when relevant: years_on_post is time on a CRITICAL post (Secretary/Jt. Secretary/Treasurer/Jt.
  Treasurer); post_eligibility of "Eligible" means they can hold critical or other posts, "Non-critical
  roles only" means they've passed the 6-year critical-post limit, and "Advisory / Member-L2 only" means
  they've hit the 9-year combined cap; a years_left value of 0 means already at that cap.`;
}

export async function* streamAnswer(
  question: string,
  sql: string,
  resultRows: Record<string, unknown>[],
  totalRowCount: number,
  history: ChatTurn[],
  validUmoors: string[] = [],
): AsyncGenerator<string, void, unknown> {
  requireApiKey();

  const resultJson = JSON.stringify(resultRows);
  const truncatedNote = resultRows.length < totalRowCount ? ` (showing ${resultRows.length} of ${totalRowCount} result rows)` : "";

  const contents = [
    ...history.slice(-8).map((h) => ({
      role: h.role === "user" ? "user" : "model",
      parts: [{ text: h.content }],
    })),
    {
      role: "user",
      parts: [
        {
          text: `SQL query run:\n${sql}\n\nResult${truncatedNote}:\n${resultJson}\n\nQuestion: ${question}`,
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
        systemInstruction: { role: "system", parts: [{ text: buildAnswerSystemInstruction(validUmoors) }] },
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
