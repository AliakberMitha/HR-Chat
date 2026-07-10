import type { PersonProfile, Assignment } from "./profiles";
import { profileAssignmentText } from "./profiles";
import type { QueryBreakdownEntry } from "../types";

export type QueryIntent = "count" | "breakdown" | "average" | "list" | "search";

export interface QueryFilter {
  field: string;
  value: string;
}

export interface QueryPlan {
  intent: QueryIntent;
  keywords: string[];
  filters: QueryFilter[];
  groupByField: string | null;
  metricField: string | null;
}

export interface QueryResult {
  totalMatches: number;
  sample: PersonProfile[];
  breakdown?: QueryBreakdownEntry[];
  average?: { field: string; value: number; count: number };
}

const ASSIGNMENT_FIELDS = new Set<keyof Assignment>(["Umoor", "Team", "Level"]);
const CATEGORICAL_EXACT_FIELDS = new Set(["Gender", "Jamiat", "Jamaat", "Umoor", "Team", "Level"]);

function normalize(s: string): string {
  return s.trim().toLowerCase();
}

function isAssignmentField(field: string): field is keyof Assignment {
  return ASSIGNMENT_FIELDS.has(field as keyof Assignment);
}

function getFieldValues(p: PersonProfile, field: string): string[] {
  if (isAssignmentField(field)) {
    const vals = p.assignments.map((a) => a[field]).filter(Boolean);
    return vals.length ? vals : [""];
  }
  return [p.fields[field] ?? ""];
}

function matchesFilter(p: PersonProfile, filter: QueryFilter): boolean {
  const values = getFieldValues(p, filter.field);
  const target = normalize(filter.value);
  if (!target) return true;
  if (CATEGORICAL_EXACT_FIELDS.has(filter.field)) {
    return values.some((v) => normalize(v) === target);
  }
  return values.some((v) => normalize(v).includes(target));
}

function profileSearchText(p: PersonProfile, columns: string[]): string {
  return (
    columns.map((c) => p.fields[c] ?? "").join(" ") + " " + profileAssignmentText(p)
  ).toLowerCase();
}

export function executeQuery(plan: QueryPlan, allProfiles: PersonProfile[], columns: string[]): QueryResult {
  let matched = allProfiles;

  if (plan.filters?.length) {
    matched = matched.filter((p) => plan.filters.every((f) => matchesFilter(p, f)));
  }

  const keywords = (plan.keywords ?? []).map(normalize).filter(Boolean);
  if (keywords.length) {
    matched = matched.filter((p) => {
      const text = profileSearchText(p, columns);
      return keywords.every((kw) => text.includes(kw));
    });
  }

  const totalMatches = matched.length;

  let breakdown: QueryBreakdownEntry[] | undefined;
  if (plan.groupByField) {
    const counts = new Map<string, { label: string; count: number }>();
    for (const p of matched) {
      const values = [...new Set(getFieldValues(p, plan.groupByField).map((v) => v || "(blank)"))];
      for (const v of values) {
        const key = normalize(v);
        const entry = counts.get(key);
        if (entry) entry.count++;
        else counts.set(key, { label: v, count: 1 });
      }
    }
    breakdown = [...counts.values()]
      .sort((a, b) => b.count - a.count)
      .map(({ label, count }) => ({ key: label, count }));
  }

  let average: QueryResult["average"];
  if (plan.metricField) {
    const nums: number[] = [];
    for (const p of matched) {
      const raw = getFieldValues(p, plan.metricField)[0]?.trim();
      if (!raw) continue; // Number("") === 0 -- must skip blanks explicitly, not coerce them
      const n = Number(raw);
      if (Number.isFinite(n)) nums.push(n);
    }
    if (nums.length) {
      average = {
        field: plan.metricField,
        value: nums.reduce((a, b) => a + b, 0) / nums.length,
        count: nums.length,
      };
    }
  }

  const sampleSize = plan.intent === "list" || plan.intent === "search" ? 60 : 25;
  const sample = matched.slice(0, sampleSize);

  return { totalMatches, sample, breakdown, average };
}
