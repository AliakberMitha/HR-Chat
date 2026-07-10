export interface DatasetMeta {
  fileName: string;
  rowCount: number;
  personCount: number;
  columns: string[];
  uploadedAt: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sql?: string;
  resultRows?: Record<string, unknown>[];
  totalRowCount?: number;
  isStreaming?: boolean;
  error?: boolean;
}
