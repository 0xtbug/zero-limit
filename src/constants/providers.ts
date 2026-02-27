import type { OAuthProvider } from '@/types';

export const PROVIDERS = [
  { id: 'antigravity', name: 'Antigravity', requiresProjectId: false },
  { id: 'codex', name: 'OpenAI Codex', requiresProjectId: false },
  { id: 'gemini-cli', name: 'Gemini CLI', requiresProjectId: true },
  { id: 'anthropic', name: 'Claude (Anthropic)', requiresProjectId: false },
  { id: 'kiro', name: 'Kiro (CodeWhisperer)', requiresProjectId: false },
  { id: 'copilot', name: 'GitHub Copilot', requiresProjectId: false },
] as const;

export type ProviderId = typeof PROVIDERS[number]['id'];

export const WEBUI_SUPPORTED: OAuthProvider[] = ['codex', 'anthropic', 'antigravity', 'gemini-cli', 'kiro'];

export const PLUS_ONLY_PROVIDERS: ProviderId[] = ['copilot', 'kiro'];

export const CALLBACK_PROVIDER_MAP: Partial<Record<OAuthProvider, string>> = {
  'gemini-cli': 'gemini'
};

export const AUTH_URL_PROVIDER_MAP: Partial<Record<OAuthProvider, string>> = {
  'copilot': 'github'
};

export const ANTIGRAVITY_GROUPS = [
  { id: 'claude-gpt', label: 'Claude/GPT', identifiers: ['claude-sonnet-4-5-thinking', 'claude-opus-4-5-thinking', 'claude-sonnet-4-5'] },
  { id: 'gemini-3-pro', label: 'Gemini 3 Pro', identifiers: ['gemini-3-pro-high', 'gemini-3-pro-low'] },
  { id: 'gemini-2-5-flash', label: 'Gemini 2.5 Flash', identifiers: ['gemini-2.5-flash', 'gemini-2.5-flash-thinking'] },
  { id: 'gemini-2-5-flash-lite', label: 'Gemini 2.5 Flash Lite', identifiers: ['gemini-2.5-flash-lite'] },
  { id: 'gemini-2-5-cu', label: 'Gemini 2.5 CU', identifiers: ['rev19-uic3-1p'] },
  { id: 'gemini-3-flash', label: 'Gemini 3 Flash', identifiers: ['gemini-3-flash'] },
  { id: 'gemini-image', label: 'Gemini 3 Pro Image', identifiers: ['gemini-3-pro-image'] }
];
