/**
 * Types barrel export
 */

export * from './auth';
export * from './authFile';
export * from './api';

// Provider types - Array format for UI iteration
export const PROVIDERS = [
  { id: 'antigravity', name: 'Antigravity', requiresProjectId: false },
  { id: 'codex', name: 'OpenAI Codex', requiresProjectId: false },
  { id: 'gemini-cli', name: 'Gemini CLI', requiresProjectId: true },
  { id: 'anthropic', name: 'Claude (Anthropic)', requiresProjectId: false },
] as const;

export type ProviderId = typeof PROVIDERS[number]['id'];

// Auth files response type
export interface AuthFilesResponse {
  files?: import('./authFile').AuthFile[];
  [key: string]: unknown;
}
