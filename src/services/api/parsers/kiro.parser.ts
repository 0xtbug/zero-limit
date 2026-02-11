import type { QuotaModel, KiroQuotaResult } from '@/types';

export function parseKiroQuota(body: unknown): KiroQuotaResult {
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
