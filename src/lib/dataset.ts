import { Index as FlexIndex } from "flexsearch";
import { buildProfiles, profileAssignmentText, type PersonProfile } from "./profiles";

// Columns whose text content is searchable (skills, roles, courses, etc).
// Excludes purely numeric / contact fields (Age, Mobile, Email, ITSID) which
// aren't useful for keyword matching but are still returned in full profiles.
const NON_SEARCH_FIELDS = new Set(["ITSID", "Mobile", "Email", "Age"]);

const STOPWORDS = new Set([
  "the", "a", "an", "is", "are", "was", "were", "be", "been", "for", "of",
  "in", "on", "at", "to", "and", "or", "with", "who", "whom", "which",
  "that", "this", "these", "those", "find", "me", "please", "show", "list",
  "give", "can", "you", "i", "we", "need", "want", "someone", "person",
  "best", "has", "have", "had", "do", "does", "did", "get", "all", "any",
]);

let profiles: PersonProfile[] = [];
let columns: string[] = [];
let index: FlexIndex | null = null;
let indexed = false;

export function setDataset(cols: string[], rawRows: Record<string, string>[]) {
  columns = cols;
  profiles = buildProfiles(rawRows);
  indexed = false;
}

export function getColumns() {
  return columns;
}

export function getProfileCount() {
  return profiles.length;
}

export function getAllProfiles() {
  return profiles;
}

export function isLoaded() {
  return profiles.length > 0;
}

export function clearDataset() {
  profiles = [];
  columns = [];
  index = null;
  indexed = false;
}

export async function buildIndex(onProgress?: (done: number, total: number) => void) {
  if (indexed) return;
  index = new FlexIndex({ tokenize: "forward", cache: true });
  const searchCols = columns.filter((c) => !NON_SEARCH_FIELDS.has(c) && c !== "Umoor" && c !== "Team" && c !== "Level");

  const CHUNK = 5000;
  for (let start = 0; start < profiles.length; start += CHUNK) {
    const end = Math.min(start + CHUNK, profiles.length);
    for (let i = start; i < end; i++) {
      const p = profiles[i];
      const text = searchCols.map((c) => p.fields[c] ?? "").join(" ") + " " + profileAssignmentText(p);
      index.add(p._id, text);
    }
    onProgress?.(end, profiles.length);
    // yield to keep UI responsive
    await new Promise((r) => setTimeout(r, 0));
  }
  indexed = true;
}

export function tokenizeQuery(query: string): string[] {
  return query
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !STOPWORDS.has(w));
}

export interface SearchResult {
  profiles: PersonProfile[];
  keywords: string[];
}

export function searchDataset(query: string, limit = 60): SearchResult {
  if (!index) return { profiles: [], keywords: [] };
  const keywords = tokenizeQuery(query);
  if (keywords.length === 0) return { profiles: [], keywords: [] };

  const tally = new Map<number, number>();
  for (const kw of keywords) {
    const matches = index.search(kw, { limit: 300 }) as number[];
    for (const id of matches) {
      tally.set(id, (tally.get(id) ?? 0) + 1);
    }
  }

  const ranked = [...tally.entries()].sort((a, b) => b[1] - a[1]);
  const top = ranked.slice(0, limit).map(([id]) => profiles[id]).filter(Boolean);
  return { profiles: top, keywords };
}
