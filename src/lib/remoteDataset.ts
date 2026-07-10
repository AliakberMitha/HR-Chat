import { upload } from "@vercel/blob/client";
import { gzipJson, gunzipJson } from "./compress";
import { getAdminToken } from "./adminAuth";
import { parseJsonResponse } from "./apiFetch";
import type { DatasetMeta } from "../types";

export interface RemotePointer {
  url: string;
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
): Promise<{ meta: DatasetMeta; rows: Record<string, string>[] }> {
  const res = await fetch(pointer.url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to download the dataset (${res.status}).`);
  const blob = await res.blob();
  const rows = await gunzipJson<Record<string, string>[]>(blob);
  return { meta: pointer.meta, rows };
}

export async function uploadRemoteDataset(
  meta: DatasetMeta,
  rows: Record<string, string>[],
  onProgress?: (pct: number) => void,
): Promise<void> {
  const token = getAdminToken();
  if (!token) throw new Error("You're not signed in as admin.");

  const gz = await gzipJson(rows);

  const result = await upload("dataset.json.gz", gz, {
    access: "public",
    handleUploadUrl: "/api/dataset-upload",
    clientPayload: token,
    contentType: "application/gzip",
    onUploadProgress: (event) => onProgress?.(event.percentage),
  });

  const setRes = await fetch("/api/dataset-set-current", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, url: result.url, meta }),
  });
  if (!setRes.ok) {
    const data = await parseJsonResponse<{ error?: string }>(setRes).catch(() => ({}) as { error?: string });
    throw new Error(data.error || "Failed to publish the dataset pointer.");
  }
}
