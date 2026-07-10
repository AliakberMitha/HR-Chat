import type { PersonProfile } from "../lib/profiles";
import { profileAssignmentText } from "../lib/profiles";
import type { QueryBreakdownEntry } from "../types";

interface Props {
  profiles: PersonProfile[];
  columns: string[];
  keywords: string[];
  totalMatches: number;
  breakdown?: QueryBreakdownEntry[];
  averageField?: string;
  averageValue?: number;
}

const PREFERRED_ORDER = [
  "ITSID", "Name", "Gender", "Age", "Jamiat", "Jamaat", "Occupation", "Designation",
  "Category & Activities", "Skills & SubSkills", "Badges",
  "Degrees", "Dini Qualification", "Hunars", "Hobbies", "LMS courses done by individual",
  "360 degree feedback data (Leadership)", "360 degree feedback data (Behaviour)",
  "360 degree feedback data (Teamwork)", "360 degree feedback data (Dedication)",
  "Mobile", "Email",
];

const ASSIGNMENT_FIELDS = new Set(["Umoor", "Team", "Level"]);

export default function ShowDetailsTable({
  profiles,
  columns,
  keywords,
  totalMatches,
  breakdown,
  averageField,
  averageValue,
}: Props) {
  const dataCols = columns.filter((c) => !ASSIGNMENT_FIELDS.has(c));
  const orderedCols = [
    ...PREFERRED_ORDER.filter((c) => dataCols.includes(c)),
    ...dataCols.filter((c) => !PREFERRED_ORDER.includes(c)),
    "Roles",
  ];

  return (
    <div className="mt-2 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
      <div className="px-3 py-2 text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 space-y-1">
        <div>
          {totalMatches.toLocaleString()} total matching {totalMatches === 1 ? "person" : "people"}
          {profiles.length > 0 && profiles.length < totalMatches && <> · showing {profiles.length}</>}
          {keywords.length > 0 && (
            <>
              {" "}
              · matched on:{" "}
              {keywords.map((k) => (
                <span key={k} className="inline-block bg-zinc-200 dark:bg-zinc-800 rounded px-1.5 py-0.5 mx-0.5 text-[11px]">
                  {k}
                </span>
              ))}
            </>
          )}
        </div>
        {averageValue !== undefined && averageField && (
          <div>
            Average <strong>{averageField}</strong>: {averageValue.toFixed(2)}
          </div>
        )}
      </div>

      {breakdown && breakdown.length > 0 && (
        <div className="overflow-auto max-h-48 border-b border-zinc-200 dark:border-zinc-800">
          <table className="text-xs w-full">
            <thead className="sticky top-0 bg-white dark:bg-zinc-950">
              <tr>
                <th className="text-left font-medium px-3 py-1.5 border-b border-zinc-200 dark:border-zinc-800">Group</th>
                <th className="text-left font-medium px-3 py-1.5 border-b border-zinc-200 dark:border-zinc-800">Count</th>
              </tr>
            </thead>
            <tbody>
              {breakdown.map((b) => (
                <tr key={b.key} className="odd:bg-zinc-50/50 dark:odd:bg-zinc-900/40">
                  <td className="px-3 py-1 border-b border-zinc-100 dark:border-zinc-900">{b.key}</td>
                  <td className="px-3 py-1 border-b border-zinc-100 dark:border-zinc-900">{b.count.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {profiles.length > 0 && (
        <div className="overflow-auto max-h-80">
          <table className="text-xs w-full">
            <thead className="sticky top-0 bg-white dark:bg-zinc-950">
              <tr>
                {orderedCols.map((c) => (
                  <th key={c} className="text-left font-medium px-3 py-2 border-b border-zinc-200 dark:border-zinc-800 whitespace-nowrap">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {profiles.map((p) => (
                <tr key={p._id} className="odd:bg-zinc-50/50 dark:odd:bg-zinc-900/40">
                  {orderedCols.map((c) => (
                    <td key={c} className="px-3 py-1.5 border-b border-zinc-100 dark:border-zinc-900 whitespace-nowrap max-w-[220px] overflow-hidden text-ellipsis">
                      {c === "Roles" ? profileAssignmentText(p) || "—" : p.fields[c] || "—"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
