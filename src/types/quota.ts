import type { AuthFile } from './authFile';

export interface QuotaModel {
  name: string;
  percentage: number;
  resetTime?: string;
  displayValue?: string;
}

export interface AntigravityQuotaResult {
  models: QuotaModel[];
  error?: string;
}

export interface CodexQuotaResult {
  plan?: string;
  limits: Array<{ name: string; percentage: number; resetTime?: string }>;
  error?: string;
}

export interface GeminiCliQuotaResult {
  buckets: Array<{ modelId: string; percentage: number; resetTime?: string }>;
  error?: string;
}

export interface KiroQuotaResult {
  models: QuotaModel[];
  plan?: string;
  email?: string;
  tokenExpiresAt?: string;
  error?: string;
}

export interface CopilotQuotaResult {
  models: QuotaModel[];
  plan?: string;
  username?: string;
  error?: string;
}

export interface FileQuota {
  fileId: string;
  filename: string;
  provider: string;
  providerKey: string;
  loading: boolean;
  error?: string;
  originalFile?: AuthFile;
  models?: QuotaModel[];
  plan?: string;
  limits?: Array<{ name: string; percentage: number; resetTime?: string }>;
  email?: string;
}

export interface ProviderSection {
  provider: string;
  displayName: string;
  files: FileQuota[];
}
