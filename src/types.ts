export type Row = Record<string, string> & { _id: number };

export interface DatasetMeta {
  fileName: string;
  rowCount: number;
  columns: string[];
  uploadedAt: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  matchedRows?: Row[];
  matchedColumns?: string[];
  searchKeywords?: string[];
  isStreaming?: boolean;
  error?: boolean;
}
