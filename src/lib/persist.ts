import { get, set, del } from "idb-keyval";
import type { DatasetMeta } from "../types";

const ROWS_KEY = "hrchat:rows";
const META_KEY = "hrchat:meta";

export async function saveDataset(meta: DatasetMeta, rows: Record<string, string>[]) {
  await set(ROWS_KEY, rows);
  await set(META_KEY, meta);
}

export async function loadDataset(): Promise<{ meta: DatasetMeta; rows: Record<string, string>[] } | null> {
  const [meta, rows] = await Promise.all([
    get<DatasetMeta>(META_KEY),
    get<Record<string, string>[]>(ROWS_KEY),
  ]);
  if (!meta || !rows) return null;
  return { meta, rows };
}

export async function clearPersistedDataset() {
  await Promise.all([del(ROWS_KEY), del(META_KEY)]);
}
