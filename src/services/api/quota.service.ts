import { apiCallApi, getApiCallErrorMessage } from './apiCall';
import {
  ANTIGRAVITY_QUOTA_URLS,
  GEMINI_CLI_QUOTA_URL,
  CODEX_USAGE_URL,
  ANTIGRAVITY_HEADERS,
  GEMINI_CLI_HEADERS,
  CODEX_HEADERS,
  KIRO_USAGE_URL,
  KIRO_HEADERS,
  COPILOT_ENTITLEMENT_URL,
  COPILOT_HEADERS,
  CLAUDE_USAGE_URL,
  CLAUDE_HEADERS,
} from '@/constants';
import type {
  AntigravityQuotaResult,
  CodexQuotaResult,
  GeminiCliQuotaResult,
  KiroQuotaResult,
  CopilotQuotaResult,
  ClaudeQuotaResult,
} from '@/types';
import {
  parseAntigravityModels,
  parseCodexUsage,
  parseGeminiCliQuota,
  parseKiroQuota,
  parseCopilotQuota,
  parseClaudeUsage,
} from './parsers';

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

export const quotaApi = {
  async fetchClaude(authIndex: string): Promise<ClaudeQuotaResult> {
    try {
      const result = await apiCallApi.request({
        authIndex,
        method: 'GET',
        url: CLAUDE_USAGE_URL,
        header: { ...CLAUDE_HEADERS }
      });

      if (result.statusCode >= 200 && result.statusCode < 300) {
        return parseClaudeUsage(result.body);
      }

      if (result.statusCode === 401) {
        return { models: [], error: 'Token expired, please re-authenticate' };
      }

      return { models: [], error: formatQuotaError(result) };
    } catch (err) {
      return { models: [], error: (err as Error).message };
    }
  },

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

      if (result.statusCode === 403) {
        const body = result.body as Record<string, unknown> | null;
        const rawReason = (body?.reason as string) || '';
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
  },

  async fetchCopilot(authIndex: string): Promise<CopilotQuotaResult> {
    try {
      const result = await apiCallApi.request({
        authIndex,
        method: 'GET',
        url: COPILOT_ENTITLEMENT_URL,
        header: { ...COPILOT_HEADERS }
      });

      if (result.statusCode >= 200 && result.statusCode < 300) {
        return parseCopilotQuota(result.body);
      }

      if (result.statusCode === 401 || result.statusCode === 403) {
        return { models: [], error: 'Token invalid or no Copilot subscription' };
      }

      return { models: [], error: formatQuotaError(result) };
    } catch (err) {
      return { models: [], error: (err as Error).message };
    }
  }
};
