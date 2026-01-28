/**
 * Usage API Types
 */

export interface UsageTokens {
  input_tokens: number;
  output_tokens: number;
  reasoning_tokens: number;
  cached_tokens: number;
  total_tokens: number;
}

export interface UsageDetail {
  timestamp: string;
  source: string;
  auth_index: string;
  tokens: UsageTokens;
  failed: boolean;
}

export interface ModelUsage {
  total_requests: number;
  total_tokens: number;
  details: UsageDetail[];
}

export interface ApiUsage {
  total_requests: number;
  total_tokens: number;
  models: Record<string, ModelUsage>;
}

export interface UsageSummary {
  total_requests: number;
  success_count: number;
  failure_count: number;
  total_tokens: number;
  apis: Record<string, ApiUsage>;
}

export interface UsageResponse {
  failed_requests: number;
  usage: UsageSummary;
}
