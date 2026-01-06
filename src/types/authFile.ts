/**
 * Auth File Types
 */

export interface AuthFile {
  id: string;
  filename: string;
  provider: string;
  isRuntimeOnly?: boolean;
  createdAt?: string;
  modifiedAt?: string;
  // Dynamic fields for extraction
  metadata?: Record<string, unknown>;
  attributes?: Record<string, unknown>;
  id_token?: Record<string, unknown> | string;
  plan_type?: string;
  planType?: string;
  account?: string;
  [key: string]: unknown;
}

export interface AuthFileStats {
  fileId: string;
  successCount: number;
  failureCount: number;
  lastUsed?: string;
}

export interface OAuthExclusion {
  provider: string;
  models: string[];
}
