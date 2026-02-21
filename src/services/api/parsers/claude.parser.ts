import type { ClaudeQuotaResult, QuotaModel } from '@/types/quota';

export function parseClaudeUsage(data: any): ClaudeQuotaResult {
  if (!data || typeof data !== 'object') {
    return { models: [], error: 'Invalid response format' };
  }

  if (data.type === 'error' && data.error) {
    return { models: [], error: data.error.message || 'API Error' };
  }

  const models: QuotaModel[] = [];

  const addUsage = (key: string, name: string) => {
    const usage = data[key];
    if (usage) {
      const utilization = typeof usage.utilization === 'number' ? usage.utilization : parseFloat(usage.utilization);
      if (!isNaN(utilization)) {
        models.push({
          name,
          percentage: Math.max(0, Math.min(100, 100 - utilization)),
          resetTime: usage.resets_at || ''
        });
      }
    }
  };

  addUsage('five_hour', 'five-hour-session');
  addUsage('seven_day', 'seven-day-weekly');
  addUsage('seven_day_sonnet', 'seven-day-sonnet');
  addUsage('seven_day_opus', 'seven-day-opus');

  const extra = data.extra_usage;
  if (extra && extra.is_enabled) {
    const utilization = typeof extra.utilization === 'number' ? extra.utilization : parseFloat(extra.utilization);
    if (!isNaN(utilization)) {
      models.push({
        name: 'extra-usage',
        percentage: Math.max(0, Math.min(100, 100 - utilization)),
        resetTime: '',
        displayValue: extra.used_credits !== undefined && extra.monthly_limit !== undefined
          ? `${extra.used_credits} / ${extra.monthly_limit}`
          : undefined
      });
    }
  }

  if (models.length === 0) {
     return { models: [], error: 'No quota data found' };
  }

  return { models };
}
