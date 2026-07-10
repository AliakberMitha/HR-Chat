import { gzipJson, gunzipJson } from "./compress";
import { getAdminToken } from "./adminAuth";
import { parseJsonResponse } from "./apiFetch";
import type { DatasetMeta } from "../types";

// Rows are uploaded/downloaded in fixed-size chunks, each POSTed straight to our
// own same-origin API (no cross-origin calls, so no CORS surface at all) and
// safely under Vercel's ~4.5MB serverless function body limit once gzipped.
const CHUNK_ROWS = 20000;

export interface RemotePointer {
  chunkUrls: string[];
  meta: DatasetMeta;
}

export async function fetchRemotePointer(): Promise<RemotePointer | null> {
  const res = await fetch("/api/dataset");
  if (res.status === 404) return null;
  if (!res.ok) {
    const data = await parseJsonResponse<{ error?: string }>(res).catch(() => ({}) as { error?: string });
    throw new Error(data.error || `Failed to check for a shared dataset (${res.status}).`);
  }
  return parseJsonResponse<RemotePointer>(res);
}

export async function downloadRemoteDataset(
  pointer: RemotePointer,
  onProgress?: (pct: number) => void,
): Promise<{ meta: DatasetMeta; rows: Record<string, string>[] }> {
  const rows: Record<string, string>[] = [];
  const total = pointer.chunkUrls.length;
  for (let i = 0; i < total; i++) {
    const res = await fetch(pointer.chunkUrls[i], { cache: "no-store" });
    if (!res.ok) throw new Error(`Failed to download dataset chunk ${i + 1}/${total} (${res.status}).`);
    const blob = await res.blob();
    const chunkRows = await gunzipJson<Record<string, string>[]>(blob);
    rows.push(...chunkRows);
    onProgress?.(((i + 1) / total) * 100);
  }
  return { meta: pointer.meta, rows };
}

export async function uploadRemoteDataset(
  meta: DatasetMeta,
  rows: Record<string, string>[],
  onProgress?: (pct: number) => void,
): Promise<void> {
  const token = getAdminToken();
  if (!token) throw new Error("You're not signed in as admin.");

  const chunks: Record<string, string>[][] = [];
  for (let i = 0; i < rows.length; i += CHUNK_ROWS) {
    chunks.push(rows.slice(i, i + CHUNK_ROWS));
  }

  const chunkUrls: string[] = [];
  for (let i = 0; i < chunks.length; i++) {
    const gz = await gzipJson(chunks[i]);
    const res = await fetch(`/api/dataset-upload-chunk?index=${i}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        Authorization: `Bearer ${token}`,
      },
      body: gz,
    });
    const data = await parseJsonResponse<{ url?: string; error?: string }>(res);
    if (!res.ok || !data.url) {
      throw new Error(data.error || `Failed to upload chunk ${i + 1}/${chunks.length}.`);
    }
    chunkUrls.push(data.url);
    onProgress?.(((i + 1) / chunks.length) * 100);
  }

  const setRes = await fetch("/api/dataset-set-current", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, chunkUrls, meta }),
  });
  if (!setRes.ok) {
    const data = await parseJsonResponse<{ error?: string }>(setRes).catch(() => ({}) as { error?: string });
    throw new Error(data.error || "Failed to publish the dataset pointer.");
  }
}
