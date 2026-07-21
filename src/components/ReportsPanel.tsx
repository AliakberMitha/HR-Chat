import { useEffect, useState } from "react";
import { fetchQuestionLog, type QuestionLogQuery } from "../lib/questionLog";
import type { QuestionLogResponse } from "../types";
import MonthlyQuestionsChart from "./MonthlyQuestionsChart";

type SortField = QuestionLogQuery["sortBy"];

const PAGE_SIZES = [10, 20, 50, 100];
const DATE_PRESETS = [
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
];

function toDateInput(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function ReportsPanel() {
  const [jamaatFilter, setJamaatFilter] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortBy, setSortBy] = useState<SortField>("ts");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [data, setData] = useState<QuestionLogResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [jamaatFilter, search, dateFrom, dateTo, sortBy, sortDir, pageSize]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchQuestionLog({ page, pageSize, sortBy, sortDir, jamaat: jamaatFilter, search, dateFrom, dateTo })
      .then((res) => {
        if (cancelled) return;
        setData(res);
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load the question log.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [jamaatFilter, search, dateFrom, dateTo, sortBy, sortDir, page, pageSize]);

  const applyPreset = (days: number) => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - (days - 1));
    setDateFrom(toDateInput(from));
    setDateTo(toDateInput(to));
  };

  const clearFilters = () => {
    setJamaatFilter("");
    setSearchInput("");
    setDateFrom("");
    setDateTo("");
  };

  const toggleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortDir(field === "ts" ? "desc" : "asc");
    }
  };

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const startIdx = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endIdx = Math.min(page * pageSize, total);
  const hasFilters = Boolean(jamaatFilter || search || dateFrom || dateTo);

  const sortIndicator = (field: SortField) => (sortBy === field ? (sortDir === "asc" ? " ▲" : " ▼") : "");

  return (
    <div>
      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-400">Jamaat</label>
          <select
            value={jamaatFilter}
            onChange={(e) => setJamaatFilter(e.target.value)}
            className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-transparent px-2.5 py-1.5 text-sm outline-none focus:border-zinc-400 dark:focus:border-zinc-600"
          >
            <option value="">All jamaats</option>
            {data?.hasUnrestricted && <option value="__none__">Unrestricted / Admin</option>}
            {data?.distinctJamaats.map((j) => (
              <option key={j} value={j}>
                {j}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1 flex-1 min-w-[180px]">
          <label className="text-xs text-zinc-400">Search</label>
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search questions or jamaat..."
            className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-transparent px-2.5 py-1.5 text-sm outline-none focus:border-zinc-400 dark:focus:border-zinc-600"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-400">From</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-transparent px-2.5 py-1.5 text-sm outline-none focus:border-zinc-400 dark:focus:border-zinc-600"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-400">To</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-transparent px-2.5 py-1.5 text-sm outline-none focus:border-zinc-400 dark:focus:border-zinc-600"
          />
        </div>
        <div className="flex gap-1">
          {DATE_PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => applyPreset(p.days)}
              className="rounded-lg border border-zinc-200 dark:border-zinc-800 px-2 py-1.5 text-xs text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition"
            >
              {p.label}
            </button>
          ))}
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="rounded-lg border border-zinc-200 dark:border-zinc-800 px-2 py-1.5 text-xs text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      <div className={`transition-opacity ${loading ? "opacity-60" : "opacity-100"}`}>
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 mb-4">
          <h3 className="text-sm font-medium mb-2">
            Questions asked by month
            {jamaatFilter === "__none__" ? " — Unrestricted / Admin" : jamaatFilter ? ` — ${jamaatFilter}` : ""}
          </h3>
          <MonthlyQuestionsChart data={data?.monthly ?? []} />
        </div>

        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead className="border-b border-zinc-200 dark:border-zinc-800">
                <tr>
                  <th
                    onClick={() => toggleSort("ts")}
                    className="cursor-pointer select-none px-3 py-2 text-left font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 whitespace-nowrap"
                  >
                    Asked{sortIndicator("ts")}
                  </th>
                  <th
                    onClick={() => toggleSort("jamaat")}
                    className="cursor-pointer select-none px-3 py-2 text-left font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 whitespace-nowrap"
                  >
                    Jamaat{sortIndicator("jamaat")}
                  </th>
                  <th
                    onClick={() => toggleSort("question")}
                    className="cursor-pointer select-none px-3 py-2 text-left font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                  >
                    Question{sortIndicator("question")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {data?.entries.map((e) => (
                  <tr key={e.id} className="border-b border-zinc-100 dark:border-zinc-900 last:border-b-0">
                    <td className="px-3 py-2 whitespace-nowrap align-top text-zinc-500 dark:text-zinc-400">
                      {new Date(e.ts).toLocaleString()}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap align-top">
                      {e.jamaat ?? <span className="italic text-zinc-400">Unrestricted / Admin</span>}
                    </td>
                    <td className="px-3 py-2 align-top break-words max-w-md">{e.question}</td>
                  </tr>
                ))}
                {data && data.entries.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-3 py-10 text-center text-zinc-400">
                      No questions match these filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 border-t border-zinc-200 dark:border-zinc-800 text-xs text-zinc-400">
            <span>{total === 0 ? "0 results" : `${startIdx}–${endIdx} of ${total}`}</span>
            <div className="flex items-center gap-2">
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-transparent px-2 py-1 text-xs outline-none"
              >
                {PAGE_SIZES.map((n) => (
                  <option key={n} value={n}>
                    {n} / page
                  </option>
                ))}
              </select>
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="rounded-lg border border-zinc-200 dark:border-zinc-800 px-2 py-1 disabled:opacity-30 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition"
              >
                Prev
              </button>
              <span>
                Page {page} of {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-lg border border-zinc-200 dark:border-zinc-800 px-2 py-1 disabled:opacity-30 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
