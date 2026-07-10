import { setDataset, getProfileCount, getColumns, getAllProfiles, getProfilesForJamaat } from "./dataset";
import { loadProfilesIntoSql } from "./duckdb";
import { saveDataset, loadDataset } from "./persist";
import { fetchRemotePointer, downloadRemoteDataset } from "./remoteDataset";
import type { DatasetMeta } from "../types";
import type { ParseResponse } from "./excelWorker";

export interface PipelineCallbacks {
  onStage: (stage: "reading" | "parsing" | "indexing" | "uploading" | "ready" | "error", label?: string) => void;
  onError: (message: string) => void;
}

export interface ParsedFile {
  meta: DatasetMeta;
  rows: Record<string, string>[];
}

export function parseFile(file: File, cb: PipelineCallbacks): Promise<ParsedFile> {
  return new Promise((resolve, reject) => {
    cb.onStage("reading", "Reading file...");
    const reader = new FileReader();
    reader.onerror = () => {
      const msg = "Could not read the file.";
      cb.onError(msg);
      reject(new Error(msg));
    };
    reader.onload = async () => {
      const buffer = reader.result as ArrayBuffer;
      const worker = new Worker(new URL("./excelWorker.ts", import.meta.url), { type: "module" });

      worker.onmessage = async (e: MessageEvent<ParseResponse>) => {
        const msg = e.data;
        if (msg.type === "progress") {
          cb.onStage("parsing", msg.stage);
        } else if (msg.type === "error") {
          cb.onError(msg.message);
          worker.terminate();
          reject(new Error(msg.message));
        } else if (msg.type === "done") {
          worker.terminate();
          try {
            setDataset(msg.columns, msg.rows);
            cb.onStage("indexing", "Loading into the query engine...");
            await loadProfilesIntoSql(getAllProfiles(), getColumns());

            const meta: DatasetMeta = {
              fileName: file.name,
              rowCount: msg.rows.length,
              personCount: getProfileCount(),
              columns: getColumns(),
              uploadedAt: Date.now(),
            };
            resolve({ meta, rows: msg.rows });
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            cb.onError(message);
            reject(err);
          }
        }
      };
      worker.onerror = (err) => {
        cb.onError(err.message || "Worker failed to parse the file.");
        reject(err);
      };
      worker.postMessage({ type: "parse", buffer }, [buffer]);
    };
    reader.readAsArrayBuffer(file);
  });
}

export async function cacheLocally(meta: DatasetMeta, rows: Record<string, string>[]) {
  await saveDataset(meta, rows);
}

export type ChatLoadResult =
  | { kind: "ready"; meta: DatasetMeta }
  | { kind: "empty"; message?: string }
  | { kind: "error"; message: string; hasCache: boolean };

/**
 * Used by the chat page (any user, no admin rights required). Prefers the
 * shared dataset published by the admin; falls back to this browser's local
 * cache if the server can't be reached, so the page still works offline
 * once a dataset has been loaded once.
 */
export async function loadForChat(cb: PipelineCallbacks): Promise<ChatLoadResult> {
  let pointer;
  try {
    cb.onStage("parsing", "Checking for the shared dataset...");
    pointer = await fetchRemotePointer();
  } catch (err) {
    const cached = await loadDataset();
    if (cached) {
      await hydrateFromRows(cached.meta, cached.rows, cb);
      return { kind: "ready", meta: cached.meta };
    }
    return {
      kind: "error",
      message: err instanceof Error ? err.message : "Could not reach the server.",
      hasCache: false,
    };
  }

  if (!pointer) {
    const cached = await loadDataset();
    if (cached) {
      await hydrateFromRows(cached.meta, cached.rows, cb);
      return { kind: "ready", meta: cached.meta };
    }
    return { kind: "empty" };
  }

  const cached = await loadDataset();
  if (cached && cached.meta.uploadedAt === pointer.meta.uploadedAt && cached.meta.fileName === pointer.meta.fileName) {
    await hydrateFromRows(cached.meta, cached.rows, cb);
    return { kind: "ready", meta: cached.meta };
  }

  try {
    cb.onStage("parsing", "Downloading the shared dataset...");
    const { meta, rows } = await downloadRemoteDataset(pointer, (pct) => {
      cb.onStage("parsing", `Downloading the shared dataset... ${Math.round(pct)}%`);
    });
    await hydrateFromRows(meta, rows, cb);
    await saveDataset(meta, rows);
    return { kind: "ready", meta };
  } catch (err) {
    if (cached) {
      await hydrateFromRows(cached.meta, cached.rows, cb);
      return { kind: "ready", meta: cached.meta };
    }
    return {
      kind: "error",
      message: err instanceof Error ? err.message : "Failed to download the shared dataset.",
      hasCache: false,
    };
  }
}

async function hydrateFromRows(meta: DatasetMeta, rows: Record<string, string>[], cb: PipelineCallbacks) {
  setDataset(meta.columns, rows);
  cb.onStage("indexing", "Loading into the query engine...");
  await loadProfilesIntoSql(getAllProfiles(), getColumns());
  cb.onStage("ready", "Done");
}

/**
 * Used when the chat page is opened with a ?jamaat= restriction. This is a
 * hard boundary, not a prompting convention: only that Jamaat's people are
 * ever loaded into the query engine, so no SQL Gemini could write can
 * surface anyone else's data. To back that up, the full dataset is never
 * written to this browser's IndexedDB cache here (unlike the normal chat
 * flow) -- otherwise someone could read the unrestricted data straight out
 * of local storage in DevTools even though the chat UI itself stays scoped.
 * That trade-off means restricted links always re-fetch fresh from the
 * server rather than using the fast local cache.
 */
export async function loadForChatRestricted(cb: PipelineCallbacks, jamaat: string): Promise<ChatLoadResult> {
  let pointer;
  try {
    cb.onStage("parsing", "Checking for the shared dataset...");
    pointer = await fetchRemotePointer();
  } catch (err) {
    return {
      kind: "error",
      message: err instanceof Error ? err.message : "Could not reach the server.",
      hasCache: false,
    };
  }

  if (!pointer) {
    return { kind: "empty" };
  }

  try {
    cb.onStage("parsing", "Downloading the shared dataset...");
    const { meta, rows } = await downloadRemoteDataset(pointer, (pct) => {
      cb.onStage("parsing", `Downloading the shared dataset... ${Math.round(pct)}%`);
    });

    setDataset(meta.columns, rows);
    const restricted = getProfilesForJamaat(jamaat);
    if (restricted.length === 0) {
      return { kind: "empty", message: `No records found for Jamaat "${jamaat}".` };
    }

    cb.onStage("indexing", "Loading into the query engine...");
    await loadProfilesIntoSql(restricted, getColumns());
    cb.onStage("ready", "Done");

    return { kind: "ready", meta: { ...meta, personCount: restricted.length } };
  } catch (err) {
    return {
      kind: "error",
      message: err instanceof Error ? err.message : "Failed to download the shared dataset.",
      hasCache: false,
    };
  }
}
