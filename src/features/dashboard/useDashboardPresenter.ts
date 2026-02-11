import { useEffect, useCallback, useState, useMemo } from 'react';
import { useAuthStore, useConfigStore, useUsageStore, useCliProxyStore } from '@/stores';
import { useHeaderRefresh } from '@/shared/hooks';
import { authFilesApi } from '@/services/api/auth.service';
import type { ChartConfig } from '@/shared/components/ui/chart';
import type { UsageResponse } from '@/types';

export type TimeGrouping = 'hour' | 'day';

export interface ComparisonLine {
  id: string;
  model: string;
  source: string;
  color: string;
}

interface TrendEntry {
  date: string;
  requests: number;
  tokens: number;
  models: Record<string, { requests: number; tokens: number }>;
  sources: Record<string, { requests: number; tokens: number; models: Record<string, { requests: number; tokens: number }> }>;
}

const CHART_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
];

const DEFAULT_LINE: ComparisonLine = { id: 'line-1', model: 'all', source: 'all', color: 'var(--chart-1)' };

export function formatNumber(num: number) {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toString();
}

export function formatAxisNumber(num: number) {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${Math.round(num / 1_000)}K`;
  return num.toString();
}

export function maskApiName(name: string) {
  if (name.length <= 4) return name;
  return name.substring(0, 2) + '*'.repeat(Math.min(6, name.length - 4)) + name.substring(name.length - 2);
}

function processUsageData(usage: UsageResponse | null) {
  if (!usage?.usage) {
    return {
      modelStats: [] as { name: string; requests: number; tokens: number; failed: number }[],
      trendsByDay: [] as TrendEntry[],
      trendsByHour: [] as TrendEntry[],
      tokenBreakdown: { cached: 0, reasoning: 0 },
      apiStats: [] as { name: string; requests: number; tokens: number; models: { name: string; requests: number; tokens: number }[] }[],
      availableModels: [] as string[],
      availableSources: [] as string[],
    };
  }

  const models: { name: string; requests: number; tokens: number; failed: number }[] = [];
  const apis = usage.usage.apis || {};
  const apiList: { name: string; requests: number; tokens: number; models: { name: string; requests: number; tokens: number }[] }[] = [];

  let cachedTokens = 0;
  let reasoningTokens = 0;

  const dayTrends: Record<string, TrendEntry> = {};
  const hourTrends: Record<string, TrendEntry> = {};

  for (const apiKey of Object.keys(apis)) {
    const api = apis[apiKey];
    const apiModels = api.models || {};
    const currentApiModels: { name: string; requests: number; tokens: number }[] = [];

    for (const modelName of Object.keys(apiModels)) {
      const model = apiModels[modelName];
      const details = model.details || [];
      let modelFailed = 0;

      currentApiModels.push({
        name: modelName,
        requests: model.total_requests || 0,
        tokens: model.total_tokens || 0
      });

      for (const detail of details) {
        if (detail.tokens) {
          cachedTokens += detail.tokens.cached_tokens || 0;
          reasoningTokens += detail.tokens.reasoning_tokens || 0;
        }

        if (detail.timestamp) {
          const dateObj = new Date(detail.timestamp);
          const dayKey = detail.timestamp.split('T')[0];
          const pad = (n: number) => n.toString().padStart(2, '0');
          const hourKey = `${dateObj.getFullYear()}-${pad(dateObj.getMonth() + 1)}-${pad(dateObj.getDate())} ${pad(dateObj.getHours())}:00`;

          const accumulateTrend = (trends: Record<string, TrendEntry>, key: string) => {
            if (!trends[key]) trends[key] = { date: key, requests: 0, tokens: 0, models: {}, sources: {} };
            trends[key].requests += 1;
            trends[key].tokens += detail.tokens?.total_tokens || 0;

            if (!trends[key].models[modelName]) trends[key].models[modelName] = { requests: 0, tokens: 0 };
            trends[key].models[modelName].requests += 1;
            trends[key].models[modelName].tokens += detail.tokens?.total_tokens || 0;

            const source = detail.source || 'unknown';
            if (!trends[key].sources[source]) trends[key].sources[source] = { requests: 0, tokens: 0, models: {} };
            trends[key].sources[source].requests += 1;
            trends[key].sources[source].tokens += detail.tokens?.total_tokens || 0;

            if (!trends[key].sources[source].models[modelName]) trends[key].sources[source].models[modelName] = { requests: 0, tokens: 0 };
            trends[key].sources[source].models[modelName].requests += 1;
            trends[key].sources[source].models[modelName].tokens += detail.tokens?.total_tokens || 0;
          };

          accumulateTrend(dayTrends, dayKey);
          accumulateTrend(hourTrends, hourKey);
        }

        if (detail.failed) modelFailed += 1;
      }

      models.push({
        name: modelName,
        requests: model.total_requests || 0,
        tokens: model.total_tokens || 0,
        failed: modelFailed
      });
    }

    currentApiModels.sort((a, b) => b.requests - a.requests);
    apiList.push({
      name: apiKey,
      requests: api.total_requests || 0,
      tokens: api.total_tokens || 0,
      models: currentApiModels
    });
  }

  models.sort((a, b) => b.requests - a.requests);

  const sources = new Set<string>();
  for (const apiKey of Object.keys(apis)) {
    const apiModels = apis[apiKey].models || {};
    for (const modelName of Object.keys(apiModels)) {
      for (const detail of apiModels[modelName].details || []) {
        if (detail.source) sources.add(detail.source);
      }
    }
  }

  return {
    modelStats: models,
    trendsByDay: Object.values(dayTrends).sort((a, b) => a.date.localeCompare(b.date)),
    trendsByHour: Object.values(hourTrends).sort((a, b) => a.date.localeCompare(b.date)),
    tokenBreakdown: { cached: cachedTokens, reasoning: reasoningTokens },
    apiStats: apiList,
    availableModels: Array.from(new Set(models.map(m => m.name))).sort(),
    availableSources: Array.from(sources).sort(),
  };
}

export function useDashboardPresenter() {
  const { connectionStatus, checkAuth, updateConnectionStatus, apiBase } = useAuthStore();
  const { fetchConfig } = useConfigStore();
  const { usage, loading: usageLoading, fetchUsage } = useUsageStore();
  const { isApiHealthy, checkApiHealth } = useCliProxyStore();

  const [activeAccountsCount, setActiveAccountsCount] = useState<number>(0);
  const [requestTimeGrouping, setRequestTimeGrouping] = useState<TimeGrouping>('day');
  const [tokenTimeGrouping, setTokenTimeGrouping] = useState<TimeGrouping>('day');
  const [expandedApis, setExpandedApis] = useState<Set<string>>(new Set());
  const [comparisonLines, setComparisonLines] = useState<ComparisonLine[]>([DEFAULT_LINE]);

  const addLine = useCallback(() => {
    if (comparisonLines.length >= 9) return;
    const newId = `line-${Date.now()}`;
    const color = CHART_COLORS[comparisonLines.length % CHART_COLORS.length];
    setComparisonLines(prev => [...prev, { id: newId, model: 'all', source: 'all', color }]);
  }, [comparisonLines.length]);

  const removeLine = useCallback((id: string) => {
    setComparisonLines(prev => prev.length <= 1 ? prev : prev.filter(l => l.id !== id));
  }, []);

  const updateLine = useCallback((id: string, field: 'model' | 'source', value: string) => {
    setComparisonLines(prev => prev.map(l => l.id === id ? { ...l, [field]: value } : l));
  }, []);

  const resetLines = useCallback(() => {
    setComparisonLines([DEFAULT_LINE]);
  }, []);

  const loadData = useCallback(async () => {
    try {
      await fetchConfig();
      const response = await authFilesApi.list();
      const filesList = response?.files ?? [];
      setActiveAccountsCount(filesList.length);
      await fetchUsage();
    } catch {
      // Error handled by store/api
    }
  }, [fetchConfig, fetchUsage]);

  useEffect(() => {
    checkApiHealth(apiBase);
  }, [checkApiHealth, apiBase]);

  useEffect(() => {
    if (isApiHealthy) {
      checkAuth();
    } else {
      updateConnectionStatus('disconnected');
    }
  }, [isApiHealthy, checkAuth, updateConnectionStatus]);

  useEffect(() => {
    if (connectionStatus === 'connected') {
      loadData();
    }
  }, [connectionStatus, loadData]);

  useHeaderRefresh(loadData);

  const toggleApi = useCallback((apiName: string) => {
    setExpandedApis(prev => {
      const next = new Set(prev);
      if (next.has(apiName)) next.delete(apiName);
      else next.add(apiName);
      return next;
    });
  }, []);

  const { modelStats, trendsByDay, trendsByHour, tokenBreakdown, apiStats, availableModels, availableSources } =
    useMemo(() => processUsageData(usage), [usage]);

  const getComparisonData = useCallback((type: 'requests' | 'tokens') => {
    const grouping = type === 'requests' ? requestTimeGrouping : tokenTimeGrouping;
    const trends = grouping === 'hour' ? trendsByHour : trendsByDay;

    return trends.map(trend => {
      const dataPoint: Record<string, unknown> = { date: trend.date };

      comparisonLines.forEach(line => {
        let value = 0;

        if (line.model === 'all' && line.source === 'all') {
          value = type === 'requests' ? trend.requests : trend.tokens;
        } else if (line.model === 'all' && line.source !== 'all') {
          const sourceData = trend.sources?.[line.source];
          value = sourceData ? (type === 'requests' ? sourceData.requests : sourceData.tokens) : 0;
        } else if (line.model !== 'all' && line.source === 'all') {
          const modelData = trend.models?.[line.model];
          value = modelData ? (type === 'requests' ? modelData.requests : modelData.tokens) : 0;
        } else {
          const sourceData = trend.sources?.[line.source];
          if (sourceData?.models?.[line.model]) {
            value = type === 'requests' ? sourceData.models[line.model].requests : sourceData.models[line.model].tokens;
          }
        }

        dataPoint[line.id] = value;
      });

      return dataPoint;
    });
  }, [comparisonLines, requestTimeGrouping, tokenTimeGrouping, trendsByDay, trendsByHour]);

  const chartConfig = useMemo(() => {
    const config: ChartConfig = {};
    comparisonLines.forEach(line => {
      let label = '';
      const sourceLabel = maskApiName(line.source);

      if (line.model === 'all' && line.source === 'all') label = 'All Activity';
      else if (line.model === 'all') label = sourceLabel;
      else if (line.source === 'all') label = line.model;
      else label = `${line.model} • ${sourceLabel}`;

      config[line.id] = { label, color: line.color };
    });
    return config;
  }, [comparisonLines]);

  const isUsageStatsEnabled = Boolean(useConfigStore.getState().config?.['usage-statistics-enabled']);

  return {
    connectionStatus,
    usageLoading,
    usage,
    activeAccountsCount,
    loadData,

    // Usage computed data
    modelStats,
    tokenBreakdown,
    apiStats,
    availableModels,
    availableSources,
    isUsageStatsEnabled,

    // Time grouping
    requestTimeGrouping,
    setRequestTimeGrouping,
    tokenTimeGrouping,
    setTokenTimeGrouping,

    // API details expansion
    expandedApis,
    toggleApi,

    // Comparison lines
    comparisonLines,
    addLine,
    removeLine,
    updateLine,
    resetLines,

    // Chart data
    getComparisonData,
    chartConfig,

    // Formatting
    formatNumber,
    formatAxisNumber,
    maskApiName,
  };
}
