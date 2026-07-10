import type { PersonProfile } from "./lib/profiles";

export interface DatasetMeta {
  fileName: string;
  rowCount: number;
  personCount: number;
  columns: string[];
  uploadedAt: number;
}

export interface QueryBreakdownEntry {
  key: string;
  count: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  matchedProfiles?: PersonProfile[];
  matchedColumns?: string[];
  searchKeywords?: string[];
  totalMatches?: number;
  breakdown?: QueryBreakdownEntry[];
  averageField?: string;
  averageValue?: number;
  isStreaming?: boolean;
  error?: boolean;
}
