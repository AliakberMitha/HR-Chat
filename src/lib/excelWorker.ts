/// <reference lib="webworker" />
import * as XLSX from "xlsx";

export interface ParseRequest {
  type: "parse";
  buffer: ArrayBuffer;
}

export type ParseResponse =
  | { type: "progress"; stage: string }
  | { type: "done"; columns: string[]; rows: Record<string, string>[] }
  | { type: "error"; message: string };

self.onmessage = (e: MessageEvent<ParseRequest>) => {
  if (e.data.type !== "parse") return;
  try {
    post({ type: "progress", stage: "Reading workbook..." });
    const wb = XLSX.read(e.data.buffer, { type: "array", cellDates: false });
    const sheetName = wb.SheetNames[0];
    const sheet = wb.Sheets[sheetName];

    post({ type: "progress", stage: "Converting rows..." });
    const rows: Record<string, string>[] = XLSX.utils.sheet_to_json(sheet, {
      defval: "",
      raw: false,
    });

    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

    post({ type: "done", columns, rows });
  } catch (err) {
    post({ type: "error", message: err instanceof Error ? err.message : String(err) });
  }
};

function post(msg: ParseResponse) {
  (self as unknown as Worker).postMessage(msg);
}
