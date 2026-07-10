import { useState } from "react";

interface Props {
  resultRows: Record<string, unknown>[];
  totalRowCount: number;
}

export default function ShowDetailsTable({ resultRows, totalRowCount }: Props) {
  const [exporting, setExporting] = useState(false);
  const columns = resultRows.length > 0 ? Object.keys(resultRows[0]) : [];

  async function handleExport() {
    setExporting(true);
    try {
      const XLSX = await import("xlsx");
      const ws = XLSX.utils.json_to_sheet(resultRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Results");
      XLSX.writeFile(wb, `hr-chat-results-${Date.now()}.xlsx`);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="mt-2 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
      <div className="px-3 py-2 text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-2">
        <div>
          {totalRowCount.toLocaleString()} result row{totalRowCount === 1 ? "" : "s"}
        </div>
        {resultRows.length > 0 && (
          <button
            onClick={handleExport}
            disabled={exporting}
            className="shrink-0 text-xs rounded-lg border border-zinc-200 dark:border-zinc-800 px-2.5 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
          >
            {exporting ? "Exporting..." : "Export to Excel"}
          </button>
        )}
      </div>

      {resultRows.length > 0 && (
        <div className="overflow-auto max-h-80">
          <table className="text-xs w-full">
            <thead className="sticky top-0 bg-white dark:bg-zinc-950">
              <tr>
                {columns.map((c) => (
                  <th key={c} className="text-left font-medium px-3 py-2 border-b border-zinc-200 dark:border-zinc-800 whitespace-nowrap">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {resultRows.map((row, i) => (
                <tr key={i} className="odd:bg-zinc-50/50 dark:odd:bg-zinc-900/40">
                  {columns.map((c) => (
                    <td key={c} className="px-3 py-1.5 border-b border-zinc-100 dark:border-zinc-900 whitespace-nowrap max-w-[220px] overflow-hidden text-ellipsis">
                      {row[c] === null || row[c] === undefined || row[c] === "" ? "—" : String(row[c])}
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
