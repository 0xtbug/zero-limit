import type { GeminiCliQuotaResult } from '@/types';
import { formatTimeUntil } from '@/shared/utils/quota.helpers';

export function parseGeminiCliQuota(body: unknown): GeminiCliQuotaResult {
  const payload = body as Record<string, unknown> | null;
  if (!payload) return { buckets: [] };

  const buckets = payload.buckets as Array<Record<string, unknown>> | undefined;
  if (!Array.isArray(buckets)) return { buckets: [] };

  return {
    buckets: buckets.map((bucket) => ({
      modelId: String(bucket.modelId ?? bucket.model_id ?? 'Unknown'),
      percentage: Math.round(Number(bucket.remainingFraction ?? bucket.remaining_fraction ?? 0) * 100),
      resetTime: typeof bucket.resetTime === 'string' ? formatTimeUntil(bucket.resetTime) : undefined
    }))
  };
}
