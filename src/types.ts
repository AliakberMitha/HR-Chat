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

export interface QuestionLogEntry {
  id: string;
  ts: number;
  jamaat: string | null;
  question: string;
}

export interface QuestionLogMonthlyCount {
  month: string; // "YYYY-MM"
  count: number;
}

export interface QuestionLogResponse {
  entries: QuestionLogEntry[];
  total: number;
  page: number;
  pageSize: number;
  distinctJamaats: string[];
  hasUnrestricted: boolean;
  monthly: QuestionLogMonthlyCount[];
}
