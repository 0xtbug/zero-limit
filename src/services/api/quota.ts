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
const KIRO_USAGE_URL = 'https://codewhisperer.us-east-1.amazonaws.com/getUsageLimits?isEmailRequired=true&origin=AI_EDITOR&resourceType=AGENTIC_REQUEST';

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

const KIRO_HEADERS = {
  Authorization: 'Bearer $TOKEN$',
  'Content-Type': 'application/json',
  'User-Agent': 'aws-sdk-js/3.0.0 KiroIDE-0.1.0 os/windows lang/js md/nodejs/18.0.0',
  'x-amz-user-agent': 'aws-sdk-js/3.0.0'
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

export interface KiroQuotaResult {
  models: QuotaModel[];
  plan?: string;
  email?: string;
  tokenExpiresAt?: string;
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

    if (!model || typeof model !== 'object') return;

    if (model.isInternal === true || key.startsWith('chat_') || key.includes('gpt-oss')) return;

    let name = (model.displayName as string) || (model.display_name as string);
    if (!name) {
      if (key === 'rev19-uic3-1p') name = 'Gemini 2.5 Computer Use';
      else if (key === 'gemini-3-pro-image') name = 'Gemini 3 Pro Image';
      else name = key;
    }

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

    if (parsedRemaining === null) {
      const hasResetTime = quotaInfo && (quotaInfo.resetTime || quotaInfo.reset_time);
      if (hasResetTime) {
        parsedRemaining = 0;
      } else {
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

    const usedRaw = window.used_percent ?? window.usedPercent;
    let percentage = 0;

    if (usedRaw !== null && usedRaw !== undefined) {
      percentage = Math.max(0, Math.min(100, 100 - usedRaw));
    } else {
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

  if (payload.rate_limit && typeof payload.rate_limit === 'object') {
     const rl = payload.rate_limit as Record<string, any>;
     processWindow('5-hour limit', rl.primary_window ?? rl.primaryWindow);
     processWindow('Weekly limit', rl.secondary_window ?? rl.secondaryWindow);
  } else {
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

function formatResetTime(isoString: string): string {
  return formatTimeUntil(isoString);
}

function formatQuotaError(result: { statusCode: number; body?: unknown; bodyText?: string }): string {
  const status = result.statusCode;
  const rawMessage = getApiCallErrorMessage(result as any);

  if (status === 401 || status === 403) {
    if (rawMessage.includes('token') || rawMessage.includes('auth') || rawMessage.includes('credential')) {
      return `Token invalid or expired (${status})`;
    }
    return `Access denied (${status})`;
  }

  if (status === 429) {
    return 'Rate limit exceeded';
  }

  if (rawMessage.length > 100) {
    return rawMessage.substring(0, 97) + '...';
  }

  return rawMessage;
}

// Parse Kiro (AWS CodeWhisperer) quota response
function parseKiroQuota(body: unknown): KiroQuotaResult {
  const payload = body as Record<string, unknown> | null;
  if (!payload) return { models: [] };

  const models: QuotaModel[] = [];

  const subscriptionInfo = payload.subscriptionInfo as Record<string, unknown> | undefined;
  const plan = (subscriptionInfo?.subscriptionTitle as string) || 'Standard';

  const breakdownList = payload.usageBreakdownList as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(breakdownList)) {
    for (const breakdown of breakdownList) {
      const displayName = (breakdown.displayName as string) || (breakdown.resourceType as string) || 'Usage';
      const displayNamePlural = (breakdown.displayNamePlural as string) || `${displayName}s`;

      let resetTimeStr: string | undefined;
      const nextReset = (breakdown.nextDateReset as number) || (payload.nextDateReset as number);
      if (nextReset) {
        const resetDate = new Date(nextReset * 1000);
        const now = new Date();
        const diffMs = resetDate.getTime() - now.getTime();
        if (diffMs > 0) {
          const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
          const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
          resetTimeStr = days > 0 ? `${days}d ${hours}h` : `${hours}h 0m`;
        }
      }

      const freeTrialInfo = breakdown.freeTrialInfo as Record<string, unknown> | undefined;
      const hasActiveTrial = freeTrialInfo?.freeTrialStatus === 'ACTIVE';

      if (hasActiveTrial && freeTrialInfo) {
        const used = Math.round((freeTrialInfo.currentUsageWithPrecision as number) ?? (freeTrialInfo.currentUsage as number) ?? 0);
        const total = Math.round((freeTrialInfo.usageLimitWithPrecision as number) ?? (freeTrialInfo.usageLimit as number) ?? 0);
        const remaining = total - used;

        let percentage = 0;
        if (total > 0) {
          percentage = Math.max(0, Math.round(remaining / total * 100));
        }

        let trialResetStr: string | undefined;
        const expiry = freeTrialInfo.freeTrialExpiry as number | undefined;
        if (expiry) {
          const expiryDate = new Date(expiry * 1000);
          const now = new Date();
          const diffMs = expiryDate.getTime() - now.getTime();
          if (diffMs > 0) {
            const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            trialResetStr = days > 0 ? `${days}d ${hours}h` : `${hours}h 0m`;
          }
        }

        models.push({
          name: `Bonus ${displayNamePlural}`,
          percentage,
          resetTime: trialResetStr
        });
      }

      const regularUsed = Math.round((breakdown.currentUsageWithPrecision as number) ?? (breakdown.currentUsage as number) ?? 0);
      const regularTotal = Math.round((breakdown.usageLimitWithPrecision as number) ?? (breakdown.usageLimit as number) ?? 0);
      const regularRemaining = regularTotal - regularUsed;

      if (regularTotal > 0) {
        const percentage = Math.max(0, Math.round(regularRemaining / regularTotal * 100));

        const quotaName = hasActiveTrial ? `Base ${displayNamePlural}` : displayNamePlural;
        models.push({
          name: quotaName,
          percentage,
          resetTime: resetTimeStr
        });
      }
    }
  }

  if (models.length === 0) {
    models.push({ name: 'kiro-standard', percentage: 100, resetTime: undefined });
  }

  const userInfo = payload.userInfo as Record<string, unknown> | undefined;
  const email = userInfo?.email as string | undefined;

  return { models, plan, email };
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
  },

  /**
   * Fetch Kiro (AWS CodeWhisperer) quota for an auth file
   */
  async fetchKiro(authIndex: string): Promise<KiroQuotaResult> {
    try {
      const result = await apiCallApi.request({
        authIndex,
        method: 'GET',
        url: KIRO_USAGE_URL,
        header: { ...KIRO_HEADERS }
      });

      if (result.statusCode >= 200 && result.statusCode < 300) {
        return parseKiroQuota(result.body);
      }

      // Handle 403 (suspended/forbidden) - show as full quota
      if (result.statusCode === 403) {
        const body = result.body as Record<string, unknown> | null;
        const rawReason = (body?.reason as string) || '';
        // Format: TEMPORARILY_SUSPENDED -> Suspended
        const reason = rawReason.replace(/_/g, ' ').toLowerCase().replace(/^\w/, c => c.toUpperCase()) || 'Suspended';
        return {
          models: [{ name: 'Kiro', percentage: 100, resetTime: reason }],
          plan: 'Suspended'
        };
      }

      return { models: [], error: formatQuotaError(result) };
    } catch (err) {
      return { models: [], error: (err as Error).message };
    }
  }
};
