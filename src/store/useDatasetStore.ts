import { create } from "zustand";
import type { DatasetMeta } from "../types";

export type LoadStage =
  | "idle"
  | "reading"
  | "parsing"
  | "indexing"
  | "uploading"
  | "ready"
  | "error";

interface DatasetState {
  stage: LoadStage;
  progressLabel: string;
  meta: DatasetMeta | null;
  error: string | null;
  setStage: (stage: LoadStage, label?: string) => void;
  setMeta: (meta: DatasetMeta | null) => void;
  setError: (message: string | null) => void;
  reset: () => void;
}

export const useDatasetStore = create<DatasetState>((set) => ({
  stage: "idle",
  progressLabel: "",
  meta: null,
  error: null,
  setStage: (stage, label = "") => set({ stage, progressLabel: label }),
  setMeta: (meta) => set({ meta }),
  setError: (message) => set({ error: message, stage: message ? "error" : "idle" }),
  reset: () => set({ stage: "idle", progressLabel: "", meta: null, error: null }),
}));
