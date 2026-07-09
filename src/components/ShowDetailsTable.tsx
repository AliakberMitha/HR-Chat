import type { Row } from "../types";

interface Props {
  rows: Row[];
  columns: string[];
  keywords: string[];
}

const PREFERRED_ORDER = [
  "ITSID", "Name", "Gender", "Age", "Jamiat", "Jamaat", "Occupation", "Designation",
  "Umoor", "Team", "Level", "Category & Activities", "Skills & SubSkills", "Badges",
  "Degrees", "Dini Qualification", "Hunars", "Hobbies", "LMS courses done by individual",
  "360 degree feedback data (Leadership)", "360 degree feedback data (Behaviour)",
  "360 degree feedback data (Teamwork)", "360 degree feedback data (Dedication)",
  "Mobile", "Email",
];

export default function ShowDetailsTable({ rows, columns, keywords }: Props) {
  const orderedCols = [
    ...PREFERRED_ORDER.filter((c) => columns.includes(c)),
    ...columns.filter((c) => c !== "_id" && !PREFERRED_ORDER.includes(c)),
  ];

  return (
    <div className="mt-2 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
      <div className="px-3 py-2 text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
        {rows.length} matched record{rows.length === 1 ? "" : "s"} sent to the model
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
            {rows.map((r) => (
              <tr key={r._id} className="odd:bg-zinc-50/50 dark:odd:bg-zinc-900/40">
                {orderedCols.map((c) => (
                  <td key={c} className="px-3 py-1.5 border-b border-zinc-100 dark:border-zinc-900 whitespace-nowrap max-w-[220px] overflow-hidden text-ellipsis">
                    {r[c] || "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
