import type { QuotaModel, CopilotQuotaResult } from '@/types';
import { formatTimeUntil } from '@/shared/utils/quota.helpers';

export function parseCopilotQuota(body: unknown): CopilotQuotaResult {
  const payload = body as Record<string, unknown> | null;
  if (!payload) return { models: [] };

  const models: QuotaModel[] = [];

  const accessTypeSku = (payload.access_type_sku as string) || '';
  const copilotPlan = (payload.copilot_plan as string) || '';
  let plan = 'Unknown';

  const sku = accessTypeSku.toLowerCase();
  const planLower = copilotPlan.toLowerCase();

  if (sku.includes('enterprise') || planLower === 'enterprise') {
    plan = 'Enterprise';
  } else if (sku.includes('business') || planLower === 'business') {
    plan = 'Business';
  } else if (sku.includes('educational') || sku.includes('pro') || planLower.includes('pro')) {
    plan = 'Pro';
  } else if (planLower === 'individual' && !sku.includes('free_limited')) {
    plan = 'Pro';
  } else if (sku.includes('free_limited') || sku === 'free' || planLower.includes('free')) {
    plan = 'Free';
  } else if (copilotPlan) {
    plan = copilotPlan.charAt(0).toUpperCase() + copilotPlan.slice(1);
  }

  const resetDateStr = (payload.quota_reset_date_utc as string) || (payload.quota_reset_date as string) || (payload.limited_user_reset_date as string);
  let resetTime: string | undefined;
  if (resetDateStr) {
    resetTime = formatTimeUntil(resetDateStr);
  }

  const quotaSnapshots = payload.quota_snapshots as Record<string, unknown> | undefined;
  if (quotaSnapshots) {
    const parseSnapshot = (name: string, snapshot: unknown, defaultTotal: number) => {
      const snap = snapshot as Record<string, unknown> | undefined;
      if (!snap || snap.unlimited === true) return;

      let percentage = 100;
      if (typeof snap.percent_remaining === 'number') {
        percentage = Math.min(100, Math.max(0, snap.percent_remaining));
      } else {
        const remaining = (snap.remaining as number) ?? 0;
        const total = (snap.entitlement as number) ?? defaultTotal;
        if (total > 0) {
          percentage = Math.min(100, Math.max(0, (remaining / total) * 100));
        }
      }

      models.push({ name, percentage: Math.round(percentage), resetTime });
    };

    parseSnapshot('Chat', quotaSnapshots.chat, 50);
    parseSnapshot('Completions', quotaSnapshots.completions, 2000);
    parseSnapshot('Premium', quotaSnapshots.premium_interactions, 50);
  }

  if (models.length === 0) {
    const limitedQuotas = payload.limited_user_quotas as Record<string, unknown> | undefined;
    const monthlyQuotas = payload.monthly_quotas as Record<string, unknown> | undefined;

    if (limitedQuotas && monthlyQuotas) {
      const parseLimit = (name: string, remainingKey: string, totalKey: string) => {
        const remaining = (limitedQuotas[remainingKey] as number) ?? 0;
        const total = (monthlyQuotas[totalKey] as number) ?? 0;
        if (total > 0) {
          const percentage = Math.min(100, Math.max(0, (remaining / total) * 100));
          models.push({ name, percentage: Math.round(percentage), resetTime });
        }
      };

      parseLimit('Chat', 'chat', 'chat');
      parseLimit('Completions', 'completions', 'completions');
    }
  }

  if (models.length === 0) {
    models.push({ name: 'Copilot', percentage: 100, resetTime: undefined });
  }

  return { models, plan };
}
