/**
 * API Types
 */

// Config type - MVP version with only used fields
export interface Config {
  raw?: Record<string, unknown>;
  [key: string]: unknown;
}

// OAuth types
export type OAuthProvider = 'codex' | 'anthropic' | 'antigravity' | 'gemini-cli';

export interface OAuthStartResponse {
  url?: string;
  auth_url?: string;
  state?: string;
}

export interface OAuthCallbackResponse {
  status: 'ok';
}

export interface OAuthStatusResponse {
  status: 'ok' | 'wait' | 'error';
  completed?: boolean;
  failed?: boolean;
  error?: string;
  message?: string;
}

// API Call types
export interface ApiCallRequest {
  authIndex?: string;
  method: string;
  url: string;
  header?: Record<string, string>;
  data?: string;
}

export interface ApiCallResult<T = unknown> {
  statusCode: number;
  header: Record<string, string[]>;
  bodyText: string;
  body: T | null;
}

// API Client types
export interface ApiClientConfig {
  apiBase: string;
  managementKey: string;
  timeout?: number;
}

export interface ApiError extends Error {
  status?: number;
  code?: string;
  details?: unknown;
  data?: unknown;
}
