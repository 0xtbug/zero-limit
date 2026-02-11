import type { CodexQuotaResult } from '@/types';
import {
  parseCodexUsagePayload,
  formatCodexResetLabel,
  type CodexUsageWindow
} from '@/shared/utils/quota.helpers';

export function parseCodexUsage(body: unknown): CodexQuotaResult {
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
