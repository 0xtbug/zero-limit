/**
 * Quota API Service
 * Fetches quota data for different providers using the /api-call proxy
 */

import { apiCallApi, getApiCallErrorMessage } from './apiCall';

// API URLs
const ANTIGRAVITY_QUOTA_URLS = [
  'https://daily-cloudcode-pa.googleapis.com/v1internal:fetchAvailableModels',
  'https://daily-cloudcode-pa.sandbox.googleapis.com/v1internal:fetchAvailableModels',
  'https://cloudcode-pa.googleapis.com/v1internal:fetchAvailableModels'
];

const GEMINI_CLI_QUOTA_URL = 'https://cloudcode-pa.googleapis.com/v1internal:retrieveUserQuota';
const CODEX_USAGE_URL = 'https://chatgpt.com/backend-api/wham/usage';

// Headers
const ANTIGRAVITY_HEADERS = {
  Authorization: 'Bearer $TOKEN$',
  'Content-Type': 'application/json',
  'User-Agent': 'antigravity/1.11.5 windows/amd64'
};

const GEMINI_CLI_HEADERS = {
  Authorization: 'Bearer $TOKEN$',
  'Content-Type': 'application/json'
};

const CODEX_HEADERS = {
  Authorization: 'Bearer $TOKEN$',
  'Content-Type': 'application/json',
  'User-Agent': 'codex_cli_rs/0.76.0 (Debian 13.0.0; x86_64) WindowsTerminal'
};

import {
  parseCodexUsagePayload,
  formatCodexResetLabel,
  formatTimeUntil,
  type CodexUsageWindow
} from '@/utils/quota';

// Model group definitions
export const ANTIGRAVITY_GROUPS = [
  { id: 'claude-gpt', label: 'Claude/GPT', identifiers: ['claude-sonnet-4-5-thinking', 'claude-opus-4-5-thinking', 'claude-sonnet-4-5'] },
  { id: 'gemini-3-pro', label: 'Gemini 3 Pro', identifiers: ['gemini-3-pro-high', 'gemini-3-pro-low'] },
  { id: 'gemini-2-5-flash', label: 'Gemini 2.5 Flash', identifiers: ['gemini-2.5-flash', 'gemini-2.5-flash-thinking'] },
  { id: 'gemini-2-5-flash-lite', label: 'Gemini 2.5 Flash Lite', identifiers: ['gemini-2.5-flash-lite'] },
  { id: 'gemini-2-5-cu', label: 'Gemini 2.5 CU', identifiers: ['rev19-uic3-1p'] },
  { id: 'gemini-3-flash', label: 'Gemini 3 Flash', identifiers: ['gemini-3-flash'] },
  { id: 'gemini-image', label: 'Gemini 3 Pro Image', identifiers: ['gemini-3-pro-image'] }
];

// Result interfaces
export interface QuotaModel {
  name: string;
  percentage: number;
  resetTime?: string;
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

// Parse Antigravity models response
function parseAntigravityModels(body: unknown): QuotaModel[] {
  const models: QuotaModel[] = [];
  const payload = body as Record<string, unknown> | null;
  if (!payload?.models || typeof payload.models !== 'object') return models;

  const modelsData = payload.models as Record<string, unknown>;

  Object.entries(modelsData).forEach(([key, value]) => {
    const model = value as Record<string, unknown>;

    // Skip if not a valid model object
    if (!model || typeof model !== 'object') return;

    // Skip internal models (e.g. chat_20706) and gpt-oss models
    if (model.isInternal === true || key.startsWith('chat_') || key.includes('gpt-oss')) return;

    // Get display name or fallback to key
    // Get display name or fallback to key
    let name = (model.displayName as string) || (model.display_name as string);
    if (!name) {
      if (key === 'rev19-uic3-1p') name = 'Gemini 2.5 Computer Use';
      else if (key === 'gemini-3-pro-image') name = 'Gemini 3 Pro Image';
      else name = key;
    }

    // Handle nested quotaInfo if present (Antigravity v1internal)
    const quotaInfo = (model.quotaInfo ?? model.quota_info) as Record<string, unknown> | undefined;
    const source = quotaInfo ?? model;

    const remaining = source.remainingFraction ?? source.remaining_fraction ?? source.remaining;

    let parsedRemaining: number | null = null;
    if (typeof remaining === 'number') {
      parsedRemaining = remaining;
    } else if (typeof remaining === 'string') {
        const parsed = parseFloat(remaining);
        if (!isNaN(parsed)) parsedRemaining = parsed;
    }

    // Smart default based on quotaInfo presence:
    // - If quotaInfo exists with resetTime but no remainingFraction = quota depleted (0%)
    // - If no quotaInfo at all = no quota tracking, assume full (100%)
    if (parsedRemaining === null) {
      const hasResetTime = quotaInfo && (quotaInfo.resetTime || quotaInfo.reset_time);
      if (hasResetTime) {
        // quotaInfo exists with resetTime but no remainingFraction = depleted
        parsedRemaining = 0;
      } else {
        // No quota info = default to full quota
        parsedRemaining = 1;
      }
    }

    const reset = source.resetTime ?? source.reset_time;
    let resetTime: string | undefined;
    if (typeof reset === 'string') {
      resetTime = formatResetTime(reset);
    }

    models.push({
      name,
      percentage: Math.round(parsedRemaining * 100),
      resetTime
    });
  });

  // Sort by name for consistency
  return models.sort((a, b) => a.name.localeCompare(b.name));
}

// Parse Codex usage response
function parseCodexUsage(body: unknown): CodexQuotaResult {
  const payload = parseCodexUsagePayload(body);
  if (!payload) return { limits: [] };

  const planType = (payload.plan_type ?? payload.planType ?? 'Plus') as string;
  const limits: Array<{ name: string; percentage: number; resetTime?: string }> = [];

  const processWindow = (
    name: string,
    windowProp: CodexUsageWindow | boolean | undefined
  ) => {
    if (!windowProp || typeof windowProp !== 'object') return;
    const window = windowProp as CodexUsageWindow;

    // Calculate remaining percentage from used_percent
    const usedRaw = window.used_percent ?? window.usedPercent;
    let percentage = 0;

    if (usedRaw !== null && usedRaw !== undefined) {
      // If we have used percent, remaining is 100 - used
      percentage = Math.max(0, Math.min(100, 100 - usedRaw));
    } else {
      // Fallback to count calculation if used_percent is missing
      const remaining = window.remaining_count ?? window.remainingCount ?? 0;
      const total = window.total_count ?? window.totalCount ?? 1;
      percentage = Math.round((Number(remaining) / Math.max(Number(total), 1)) * 100);
    }

    const resetTime = formatCodexResetLabel(window);

    limits.push({
      name,
      percentage,
      resetTime: resetTime !== '-' ? resetTime : undefined
    });
  };


  // Actually, legacy mapping:
  // primary -> 5-hour limit (usually)
  // But wait, the payload has specific keys '5_hour_window' etc if raw,
  // BUT parseCodexUsagePayload interface defines rate_limit as containing windows?
  // Let's check the interface in utils/quota.ts I just added.

  // The interface I added:
  // rate_limit?: Record<string, CodexUsageWindow...
  // BUT the payload from API (Step 699 original file) showed '5_hour_window' at root?
  // No, parseCodexUsage in Step 699 lines 119 read `payload['5_hour_window']` from root.
  // Legacy `parseCodexUsagePayload` (Step 744) does `JSON.parse`.
  // Does legacy interface `CodexUsagePayload` have `5_hour_window`?
  // Step 744 lines 15-26: `rate_limit`, `code_review_rate_limit`.

  // Wait, if the API returns `5_hour_window` at root (as seemingly supported by my previous code),
  // then the legacy interface definition might be for a *different* API version or I misunderstood the mapping.

  // Re-reading user request sample:
  // 5-hour limit
  // Weekly limit

  // If I look at `parseCodexUsage` in Step 699 (lines 119):
  // const hourWindow = payload['5_hour_window'] ?? payload.fiveHourWindow;

  // If legacy `parseCodexUsagePayload` doesn't have these keys, maybe it expects them inside `rate_limit`?

  // Let's look at `buildCodexQuotaWindows` in `quotaConfigs.ts` (Step 694 line 153).
  // It reads `payload.rate_limit`.
  // `rate_limit` has `primary_window` and `secondary_window`.
  // It gives label `codex_quota.primary_window`.
  // Translation file not visible, but legacy UI usually maps Primary -> 5-Hour.

  // So I should map:
  // rate_limit.primary_window -> 5-hour limit
  // rate_limit.secondary_window -> Weekly limit
  // code_review_rate_limit.primary_window -> Code review limit

  // I will follow this mapping.

  if (payload.rate_limit && typeof payload.rate_limit === 'object') {
     const rl = payload.rate_limit as Record<string, any>;
     processWindow('5-hour limit', rl.primary_window ?? rl.primaryWindow);
     processWindow('Weekly limit', rl.secondary_window ?? rl.secondaryWindow);
  } else {
     // Fallback to root keys if rate_limit structure missing (backward compat or diff version)
     processWindow('5-hour limit', (payload['5_hour_window'] ?? payload.fiveHourWindow) as CodexUsageWindow);
     processWindow('Weekly limit', (payload['weekly_window'] ?? payload.weeklyWindow) as CodexUsageWindow);
  }

  if (payload.code_review_rate_limit && typeof payload.code_review_rate_limit === 'object') {
     const cr = payload.code_review_rate_limit as Record<string, any>;
     processWindow('Code review limit', cr.primary_window ?? cr.primaryWindow);
  } else {
     processWindow('Code review limit', (payload['code_review_window'] ?? payload.codeReviewWindow) as CodexUsageWindow);
  }

  return { plan: planType, limits };
}

// Parse Gemini CLI quota response
function parseGeminiCliQuota(body: unknown): GeminiCliQuotaResult {
  const payload = body as Record<string, unknown> | null;
  if (!payload) return { buckets: [] };

  const buckets = payload.buckets as Array<Record<string, unknown>> | undefined;
  if (!Array.isArray(buckets)) return { buckets: [] };

  return {
    buckets: buckets.map((bucket) => ({
      modelId: String(bucket.modelId ?? bucket.model_id ?? 'Unknown'),
      percentage: Math.round(Number(bucket.remainingFraction ?? bucket.remaining_fraction ?? 0) * 100),
      resetTime: typeof bucket.resetTime === 'string' ? formatResetTime(bucket.resetTime) : undefined
    }))
  };
}

// Format reset time to friendly estimate (e.g., "4h 20m")
function formatResetTime(isoString: string): string {
  return formatTimeUntil(isoString);
}

// Helper to format friendly error messages
function formatQuotaError(result: { statusCode: number; body?: unknown; bodyText?: string }): string {
  const status = result.statusCode;
  const rawMessage = getApiCallErrorMessage(result as any); // Cast to any to reuse helper or reimplement

  if (status === 401 || status === 403) {
    if (rawMessage.includes('token') || rawMessage.includes('auth') || rawMessage.includes('credential')) {
      return `Token invalid or expired (${status})`;
    }
    return `Access denied (${status})`;
  }

  if (status === 429) {
    return 'Rate limit exceeded';
  }

  // Truncate very long messages
  if (rawMessage.length > 100) {
    return rawMessage.substring(0, 97) + '...';
  }

  return rawMessage;
}

export const quotaApi = {
  /**
   * Fetch Antigravity quota for an auth file
   */
  async fetchAntigravity(authIndex: string): Promise<AntigravityQuotaResult> {
    let lastError = '';

    for (const url of ANTIGRAVITY_QUOTA_URLS) {
      try {
        const result = await apiCallApi.request({
          authIndex,
          method: 'POST',
          url,
          header: { ...ANTIGRAVITY_HEADERS },
          data: '{}'
        });

        if (result.statusCode >= 200 && result.statusCode < 300) {
          const models = parseAntigravityModels(result.body);
          if (models.length > 0) {
            return { models };
          }
        }
        lastError = formatQuotaError(result);
      } catch (err) {
        lastError = (err as Error).message;
      }
    }

    return { models: [], error: lastError || 'Failed to fetch quota' };
  },

  /**
   * Fetch Codex quota for an auth file
   */
  async fetchCodex(authIndex: string, accountId?: string): Promise<CodexQuotaResult> {
    try {
      const headers: Record<string, string> = { ...CODEX_HEADERS };
      if (accountId) {
        headers['Chatgpt-Account-Id'] = accountId;
      }

      const result = await apiCallApi.request({
        authIndex,
        method: 'GET',
        url: CODEX_USAGE_URL,
        header: headers
      });

      if (result.statusCode >= 200 && result.statusCode < 300) {
        return parseCodexUsage(result.body);
      }

      return { limits: [], error: formatQuotaError(result) };
    } catch (err) {
      return { limits: [], error: (err as Error).message };
    }
  },

  /**
   * Fetch Gemini CLI quota for an auth file
   */
  async fetchGeminiCli(authIndex: string, projectId: string): Promise<GeminiCliQuotaResult> {
    try {
      const result = await apiCallApi.request({
        authIndex,
        method: 'POST',
        url: GEMINI_CLI_QUOTA_URL,
        header: { ...GEMINI_CLI_HEADERS },
        data: JSON.stringify({ project: projectId })
      });

      if (result.statusCode >= 200 && result.statusCode < 300) {
        return parseGeminiCliQuota(result.body);
      }

      return { buckets: [], error: formatQuotaError(result) };
    } catch (err) {
      return { buckets: [], error: (err as Error).message };
    }
  }
};
