/**
 * Dashboard Page
 */

import { useEffect, useCallback, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore, useConfigStore, useUsageStore, useCliProxyStore } from '@/stores';
import { useHeaderRefresh } from '@/hooks';
import { authFilesApi } from '@/services/api/authFiles';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig
} from '@/components/ui/chart';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { Activity, Users, TrendingDown, BarChart3, Coins, ChevronRight, ChevronDown, Loader2, RefreshCw } from 'lucide-react';
import {

  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid
} from 'recharts';

type TimeGrouping = 'hour' | 'day';

export function DashboardPage() {
  const { t } = useTranslation();
  const { connectionStatus, checkAuth, updateConnectionStatus, apiBase } = useAuthStore();
  const { fetchConfig } = useConfigStore();
  const { usage, loading: usageLoading, fetchUsage } = useUsageStore();
  const { isApiHealthy, checkApiHealth } = useCliProxyStore();

  const [activeAccountsCount, setActiveAccountsCount] = useState<number>(0);
  const [requestTimeGrouping, setRequestTimeGrouping] = useState<TimeGrouping>('day');
  const [tokenTimeGrouping, setTokenTimeGrouping] = useState<TimeGrouping>('day');
  const [expandedApis, setExpandedApis] = useState<Set<string>>(new Set());


  // Multi-line comparison state
  const [comparisonLines, setComparisonLines] = useState<{
    id: string;
    model: string;
    source: string;
    color: string;
  }[]>([
    { id: 'line-1', model: 'all', source: 'all', color: 'var(--chart-1)' }
  ]);

  const CHART_COLORS = [
    'var(--chart-1)',
    'var(--chart-2)',
    'var(--chart-3)',
    'var(--chart-4)',
    'var(--chart-5)',
  ];

  const addLine = () => {
    if (comparisonLines.length >= 9) return;
    const newId = `line-${Date.now()}`;
    const color = CHART_COLORS[comparisonLines.length % CHART_COLORS.length];
    setComparisonLines([...comparisonLines, { id: newId, model: 'all', source: 'all', color }]);
  };

  const removeLine = (id: string) => {
    if (comparisonLines.length <= 1) return;
    setComparisonLines(comparisonLines.filter(l => l.id !== id));
  };

  const updateLine = (id: string, field: 'model' | 'source', value: string) => {
    setComparisonLines(comparisonLines.map(l => l.id === id ? { ...l, [field]: value } : l));
  };

  const resetLines = () => {
    setComparisonLines([
      { id: 'line-1', model: 'all', source: 'all', color: 'var(--chart-1)' }
    ]);
  };

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

  // Check API health on mount
  useEffect(() => {
    checkApiHealth(apiBase);
  }, [checkApiHealth, apiBase]);

  // Re-check auth when API health changes
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

  const toggleApi = (apiName: string) => {
    const newExpanded = new Set(expandedApis);
    if (newExpanded.has(apiName)) {
      newExpanded.delete(apiName);
    } else {
      newExpanded.add(apiName);
    }
    setExpandedApis(newExpanded);
  };

  // Calculate totals and extract model stats
  const { modelStats, trendsByDay, trendsByHour, tokenBreakdown, apiStats, availableModels, availableSources } = useMemo(() => {
    if (!usage?.usage) {
      return {
        modelStats: [],
        trendsByDay: [],
        trendsByHour: [],
        tokenBreakdown: { cached: 0, reasoning: 0 },
        apiStats: [],
        availableModels: [],
        availableSources: []
      };
    }

    // Extract all models from all APIs
    const models: { name: string; requests: number; tokens: number; failed: number }[] = [];
    const apis = usage.usage.apis || {};
    const apiList: {
      name: string;
      requests: number;
      tokens: number;
      models: { name: string; requests: number; tokens: number }[]
    }[] = [];

    // Token breakdown aggregation
    let cachedTokens = 0;
    let reasoningTokens = 0;

    // Trend data aggregation
    const dayTrends: Record<string, {
      date: string;
      requests: number;
      tokens: number;
      models: Record<string, { requests: number; tokens: number }>;
      sources: Record<string, { requests: number; tokens: number; models: Record<string, { requests: number; tokens: number }> }>
    }> = {};
    const hourTrends: Record<string, {
      date: string;
      requests: number;
      tokens: number;
      models: Record<string, { requests: number; tokens: number }>;
      sources: Record<string, { requests: number; tokens: number; models: Record<string, { requests: number; tokens: number }> }>
    }> = {};

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
          // Aggregate token types
          if (detail.tokens) {
            cachedTokens += detail.tokens.cached_tokens || 0;
            reasoningTokens += detail.tokens.reasoning_tokens || 0;
          }

          // Aggregate by date/hour for trends
          if (detail.timestamp) {
            const dateObj = new Date(detail.timestamp);

            // Day key: YYYY-MM-DD
            const dayKey = detail.timestamp.split('T')[0];

            // Hour key: YYYY-MM-DD HH:00
            // We construct it manually to ensure consistent formatting
            const pad = (n: number) => n.toString().padStart(2, '0');
            const hourKey = `${dateObj.getFullYear()}-${pad(dateObj.getMonth() + 1)}-${pad(dateObj.getDate())} ${pad(dateObj.getHours())}:00`;

            // Accumulate day trends with model and source tracking
            if (!dayTrends[dayKey]) dayTrends[dayKey] = { date: dayKey, requests: 0, tokens: 0, models: {}, sources: {} };
            dayTrends[dayKey].requests += 1;
            dayTrends[dayKey].tokens += detail.tokens?.total_tokens || 0;

            // Track by model
            if (!dayTrends[dayKey].models[modelName]) dayTrends[dayKey].models[modelName] = { requests: 0, tokens: 0 };
            dayTrends[dayKey].models[modelName].requests += 1;
            dayTrends[dayKey].models[modelName].tokens += detail.tokens?.total_tokens || 0;

            // Track by source (email)
            const source = detail.source || 'unknown';
            if (!dayTrends[dayKey].sources[source]) dayTrends[dayKey].sources[source] = { requests: 0, tokens: 0, models: {} };
            dayTrends[dayKey].sources[source].requests += 1;
            dayTrends[dayKey].sources[source].tokens += detail.tokens?.total_tokens || 0;

            // Track by source + model
            if (!dayTrends[dayKey].sources[source].models[modelName]) dayTrends[dayKey].sources[source].models[modelName] = { requests: 0, tokens: 0 };
            dayTrends[dayKey].sources[source].models[modelName].requests += 1;
            dayTrends[dayKey].sources[source].models[modelName].tokens += detail.tokens?.total_tokens || 0;

            // Accumulate hour trends with model and source tracking
            if (!hourTrends[hourKey]) hourTrends[hourKey] = { date: hourKey, requests: 0, tokens: 0, models: {}, sources: {} };
            hourTrends[hourKey].requests += 1;
            hourTrends[hourKey].tokens += detail.tokens?.total_tokens || 0;

            // Track by model
            if (!hourTrends[hourKey].models[modelName]) hourTrends[hourKey].models[modelName] = { requests: 0, tokens: 0 };
            hourTrends[hourKey].models[modelName].requests += 1;
            hourTrends[hourKey].models[modelName].tokens += detail.tokens?.total_tokens || 0;

            // Track by source (email)
            if (!hourTrends[hourKey].sources[source]) hourTrends[hourKey].sources[source] = { requests: 0, tokens: 0, models: {} };
            hourTrends[hourKey].sources[source].requests += 1;
            hourTrends[hourKey].sources[source].tokens += detail.tokens?.total_tokens || 0;

            // Track by source + model
            if (!hourTrends[hourKey].sources[source].models[modelName]) hourTrends[hourKey].sources[source].models[modelName] = { requests: 0, tokens: 0 };
            hourTrends[hourKey].sources[source].models[modelName].requests += 1;
            hourTrends[hourKey].sources[source].models[modelName].tokens += detail.tokens?.total_tokens || 0;
          }

          if (detail.failed) {
            modelFailed += 1;
          }
        }

        models.push({
          name: modelName,
          requests: model.total_requests || 0,
          tokens: model.total_tokens || 0,
          failed: modelFailed
        });
      }

      // Sort API models by requests
      currentApiModels.sort((a, b) => b.requests - a.requests);

      apiList.push({
        name: apiKey,
        requests: api.total_requests || 0,
        tokens: api.total_tokens || 0,
        models: currentApiModels
      });
    }

    // Sort models by requests descending
    models.sort((a, b) => b.requests - a.requests);

    // Convert trends to array and sort by date
    const sortedDayTrends = Object.values(dayTrends).sort((a, b) => a.date.localeCompare(b.date));
    const sortedHourTrends = Object.values(hourTrends).sort((a, b) => a.date.localeCompare(b.date));

    // Extract unique model names
    const availableModels = Array.from(new Set(models.map(m => m.name))).sort();

    // Extract unique sources (emails) from all details
    const sources = new Set<string>();
    for (const apiKey of Object.keys(apis)) {
      const apiModels = apis[apiKey].models || {};
      for (const modelName of Object.keys(apiModels)) {
        const details = apiModels[modelName].details || [];
        for (const detail of details) {
          if (detail.source) {
            sources.add(detail.source);
          }
        }
      }
    }
    const availableSources = Array.from(sources).sort();

    return {
      modelStats: models,
      trendsByDay: sortedDayTrends,
      trendsByHour: sortedHourTrends,
      tokenBreakdown: { cached: cachedTokens, reasoning: reasoningTokens },
      apiStats: apiList,
      availableModels,
      availableSources
    };
  }, [usage]);

  // Format large numbers
  const formatNumber = (num: number) => {
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
    if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
    return num.toString();
  };

  // Format number for chart axis
  const formatAxisNumber = (num: number) => {
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
    if (num >= 1_000) return `${Math.round(num / 1_000)}K`;
    return num.toString();
  };

  // Mask API name for privacy
  const maskApiName = (name: string) => {
    if (name.length <= 4) return name;
    return name.substring(0, 2) + '*'.repeat(Math.min(6, name.length - 4)) + name.substring(name.length - 2);
  };

  const getComparisonData = (type: 'requests' | 'tokens') => {
    const grouping = type === 'requests' ? requestTimeGrouping : tokenTimeGrouping;
    const trends = grouping === 'hour' ? trendsByHour : trendsByDay;

    return trends.map(trend => {
      const dataPoint: any = { date: trend.date };

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
             // Both active
             const sourceData = trend.sources?.[line.source];
             if (sourceData && sourceData.models && sourceData.models[line.model]) {
                 value = type === 'requests' ? sourceData.models[line.model].requests : sourceData.models[line.model].tokens;
             }
        }

        dataPoint[line.id] = value;
      });

      return dataPoint;
    });
  };

  const chartConfig = useMemo(() => {
    const config: ChartConfig = {};
    comparisonLines.forEach(line => {
      let label = '';
      const sourceLabel = maskApiName(line.source);

      if (line.model === 'all' && line.source === 'all') label = t('usageStats.allActivity', 'All Activity');
      else if (line.model === 'all') label = sourceLabel;
      else if (line.source === 'all') label = line.model;
      else label = `${line.model} • ${sourceLabel}`;

      config[line.id] = {
        label: label,
        color: line.color,
      };
    });
    return config;
  }, [comparisonLines]);



  return (
    <div className="space-y-6 animate-fade-in p-2">
      {/* Header Section */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            {t('dashboard.hello')} <span className="text-primary">User</span> 👋
          </h1>
          <p className="text-muted-foreground">
            {t('dashboard.welcomeMessage')}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={loadData}
          disabled={usageLoading}
          className="h-8 gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${usageLoading ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">{t('common.refresh', 'Refresh')}</span>
        </Button>
      </div>

              {/* Main Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Total Accounts Card */}
        <Card className="overflow-hidden border-border/50 bg-gradient-to-br from-card to-card/50 hover:shadow-lg transition-all duration-300 gap-2 py-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t('dashboard.totalAccounts')}</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-0">
            <div className="text-3xl font-bold text-foreground">
              {connectionStatus === 'connecting' || usageLoading ? (
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              ) : (
                activeAccountsCount
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {t('dashboard.totalAccounts')}
            </p>
          </CardContent>
        </Card>

        {/* Connection Status Card */}
        <Card className="overflow-hidden border-border/50 bg-gradient-to-br from-card to-card/50 hover:shadow-lg transition-all duration-300 gap-2 py-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t('dashboard.systemStatus')}</CardTitle>
            <Activity className={`h-4 w-4 ${connectionStatus === 'connected' ? 'text-muted-foreground' : 'text-red-500'}`} />
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-0">
            <div className="text-2xl font-bold">
               {connectionStatus === 'connecting' ? (
                 <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
               ) : connectionStatus === 'connected' ? (
                 t('dashboard.status.operational')
               ) : (
                 t('dashboard.status.offline')
               )}
            </div>
             <p className="text-xs flex items-center gap-1.5 mt-1">
               {connectionStatus === 'connected' ? (
                   <>
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-medium">{t('dashboard.status.active')}</span>
                    <span className="text-muted-foreground">{t('dashboard.monitoringEnabled')}</span>
                   </>
               ) : (
                    <>
                    <TrendingDown className="h-3 w-3 text-red-500" />
                    <span className="text-red-600 dark:text-red-400 font-medium">{t('dashboard.status.error')}</span>
                    <span className="text-muted-foreground">{t('dashboard.checkConnection')}</span>
                   </>
               )}
            </p>
          </CardContent>
        </Card>
      </div>



      {/* Usage Statistics Section */}
      <div className="space-y-6">
          <h2 className="text-2xl font-bold tracking-tight">{t('usageStats.title')}</h2>

          {!usage && !usageLoading ? (
                 <Card>
                   <CardContent className="flex items-center justify-center py-8">
                     <span className="text-muted-foreground">{t('usageStats.noData')}</span>
                   </CardContent>
                 </Card>
               ) : (
                 <>
              {/* Summary Cards - Total Requests and Total Tokens */}
              <div className="grid gap-4 md:grid-cols-2">
                {/* Total Requests with breakdown */}
                <Card className="overflow-hidden border-border/50 bg-gradient-to-br from-card to-card/50 hover:shadow-lg transition-all duration-300 gap-2 py-2">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-0">
                    <CardTitle className="text-sm font-medium text-muted-foreground">{t('usageStats.totalRequests')}</CardTitle>
                    <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent className="px-4 pb-4 pt-0">
                    <div className="text-3xl font-bold text-foreground">
                      {usageLoading ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /> : formatNumber(usage?.usage?.total_requests || 0)}
                    </div>
                    <div className="flex flex-col gap-1.5 mt-2 text-xs">
                      <div className="flex items-center justify-between p-1.5 rounded-md bg-emerald-500/5">
                        <span className="text-muted-foreground">{t('usageStats.successfulRequests')}:</span>
                        <span className="font-semibold text-foreground">{usageLoading ? <Loader2 className="h-3 w-3 animate-spin inline ml-1" /> : formatNumber(usage?.usage?.success_count || 0)}</span>
                      </div>
                      <div className="flex items-center justify-between p-1.5 rounded-md bg-red-500/5">
                        <span className="text-muted-foreground">{t('usageStats.failedRequests')}:</span>
                        <span className="font-semibold text-red-600 dark:text-red-400">
                          {usageLoading ? <Loader2 className="h-3 w-3 animate-spin inline ml-1" /> : formatNumber(usage?.usage?.failure_count || 0)}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Total Tokens with breakdown */}
                <Card className="overflow-hidden border-border/50 bg-gradient-to-br from-card to-card/50 hover:shadow-lg transition-all duration-300 gap-2 py-2">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-0">
                    <CardTitle className="text-sm font-medium text-muted-foreground">{t('usageStats.totalTokens')}</CardTitle>
                    <Coins className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent className="px-4 pb-4 pt-0">
                    <div className="text-3xl font-bold text-foreground">
                      {usageLoading ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /> : formatNumber(usage?.usage?.total_tokens || 0)}
                    </div>
                    <div className="flex flex-col gap-1.5 mt-2 text-xs">
                      <div className="flex items-center justify-between p-1.5 rounded-md bg-purple-500/5">
                        <span className="text-muted-foreground">{t('usageStats.cachedTokens')}:</span>
                        <span className="font-semibold text-foreground">{usageLoading ? <Loader2 className="h-3 w-3 animate-spin inline ml-1" /> : formatNumber(tokenBreakdown.cached)}</span>
                      </div>
                      <div className="flex items-center justify-between p-1.5 rounded-md bg-cyan-500/5">
                        <span className="text-muted-foreground">{t('usageStats.reasoningTokens')}:</span>
                        <span className="font-semibold text-foreground">{usageLoading ? <Loader2 className="h-3 w-3 animate-spin inline ml-1" /> : formatNumber(tokenBreakdown.reasoning)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

      {/* Chart Configuration Card */}
      <Card className="border-border/50 bg-card/50 gap-2 py-2">
        <CardHeader className="pb-0 p-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">{t('usageStats.linesToDisplay')}</CardTitle>
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                onClick={resetLines}
              >
                {t('usageStats.resetToDefault')}
              </Button>
              <div className="text-xs text-muted-foreground">{comparisonLines.length}/9 lines</div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-3 pt-0">
          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
            {comparisonLines.map((line, index) => (
              <div key={line.id} className="flex flex-col gap-2 p-2 rounded-lg border border-border/50 bg-background/50">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-muted-foreground">{t('usageStats.line', { index: index + 1 })}</span>
                  {comparisonLines.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-red-500 hover:text-red-600 hover:bg-red-500/10"
                      onClick={() => removeLine(line.id)}
                    >
                      {t('common.delete')}
                    </Button>
                  )}
                </div>

                <Select
                  value={line.model}
                  onValueChange={(value) => updateLine(line.id, 'model', value)}
                >
                  <SelectTrigger className="h-8 w-full">
                    <SelectValue placeholder={t('usageStats.selectModel')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('usageStats.allModels')}</SelectItem>
                    {availableModels.map(m => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={line.source}
                  onValueChange={(value) => updateLine(line.id, 'source', value)}
                >
                  <SelectTrigger className="h-8 w-full">
                    <SelectValue placeholder={t('usageStats.selectSource')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('usageStats.allSources')}</SelectItem>
                    {availableSources.map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="h-1 w-full rounded-full mt-1" style={{ backgroundColor: line.color }}></div>
              </div>
            ))}

            {comparisonLines.length < 9 && (
              <Button
                variant="outline"
                className="h-full min-h-[120px] border-dashed flex flex-col gap-2 hover:bg-accent/50"
                onClick={addLine}
              >
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-xl font-light text-primary">+</span>
                </div>
                <span className="text-xs font-medium">{t('usageStats.addLine')}</span>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

              {/* Charts Row */}
              <div className="grid gap-4 md:grid-cols-2">
                {/* Request Trends Chart */}
                <Card className="overflow-hidden border-border/50 bg-gradient-to-br from-card to-card/50 gap-2">
                  <CardHeader className="flex flex-col space-y-3 pb-0 p-4">
                    <div className="flex flex-row items-center justify-between w-full">
                      <div className="flex flex-col gap-1">
                        <CardTitle className="text-base font-semibold flex items-center gap-2">
                          {t('usageStats.requestTrends')}
                        </CardTitle>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant={requestTimeGrouping === 'hour' ? 'default' : 'outline'}
                          size="sm"
                          className="h-6 px-2 text-xs"
                          onClick={() => setRequestTimeGrouping('hour')}
                        >
                          {t('usageStats.byHour')}
                        </Button>
                        <Button
                          variant={requestTimeGrouping === 'day' ? 'default' : 'outline'}
                          size="sm"
                          className="h-6 px-2 text-xs"
                          onClick={() => setRequestTimeGrouping('day')}
                        >
                          {t('usageStats.byDay')}
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="rounded-lg bg-card/40 border border-border/50 p-4">
                      {/* Legend */}
                      <div className="flex flex-wrap gap-2 mb-4">
                        {comparisonLines.map(line => (
                          <div key={line.id} className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-background/50 border border-border/50 text-xs">
                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: line.color }}></span>
                            <span className="font-medium truncate max-w-[150px]">
                              {line.model === 'all' && line.source === 'all' ? 'All Activity' :
                               line.model === 'all' ? maskApiName(line.source) :
                               line.source === 'all' ? line.model :
                               `${line.model}`}
                            </span>
                          </div>
                        ))}
                      </div>

                      {usageLoading ? (
                        <div className="flex items-center justify-center h-[300px]">
                          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                      ) : getComparisonData('requests').length > 0 ? (
                        <ChartContainer config={chartConfig} className="h-[300px] w-full">
                          <LineChart
                            accessibilityLayer
                            data={getComparisonData('requests')}
                            margin={{
                              left: 12,
                              right: 12,
                              top: 20
                            }}
                          >
                            <CartesianGrid vertical={false} strokeDasharray="3 3" strokeOpacity={0.2} />
                            <XAxis
                              dataKey="date"
                              tickLine={false}
                              axisLine={false}
                              tickMargin={8}
                              tickFormatter={(value) => {
                                const date = new Date(value);
                                return requestTimeGrouping === 'hour'
                                  ? date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
                                  : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                              }}
                            />
                            <YAxis
                              tickLine={false}
                              axisLine={false}
                              tickFormatter={formatAxisNumber}
                              width={40}
                            />
                            <ChartTooltip
                              cursor={{ stroke: 'var(--muted-foreground)', strokeWidth: 1, strokeDasharray: '4 4' }}
                              content={
                                <ChartTooltipContent
                                  className="w-[150px]"
                                  labelFormatter={(value) => {
                                    if (!value) return '';
                                    const date = new Date(value);
                                    return requestTimeGrouping === 'hour'
                                      ? date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
                                      : date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
                                  }}
                                />
                              }
                            />
                            {comparisonLines.map(line => (
                              <Line
                                key={line.id}
                                dataKey={line.id}
                                type="monotone"
                                stroke={line.color}
                                strokeWidth={2}
                                dot={false}
                                activeDot={{ r: 4, strokeWidth: 0 }}
                              />
                            ))}
                          </LineChart>
                        </ChartContainer>
                      ) : (
                        <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">
                          {t('usageStats.noData')}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Token Usage Trends Chart */}
                <Card className="overflow-hidden border-border/50 bg-gradient-to-br from-card to-card/50 gap-2">
                  <CardHeader className="flex flex-col space-y-3 pb-0 p-4">
                    <div className="flex flex-row items-center justify-between w-full">
                      <div className="flex flex-col gap-1">
                        <CardTitle className="text-base font-semibold flex items-center gap-2">
                          {t('usageStats.tokenUsageTrends')}
                        </CardTitle>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant={tokenTimeGrouping === 'hour' ? 'default' : 'outline'}
                          size="sm"
                          className="h-6 px-2 text-xs"
                          onClick={() => setTokenTimeGrouping('hour')}
                        >
                          {t('usageStats.byHour')}
                        </Button>
                        <Button
                          variant={tokenTimeGrouping === 'day' ? 'default' : 'outline'}
                          size="sm"
                          className="h-6 px-2 text-xs"
                          onClick={() => setTokenTimeGrouping('day')}
                        >
                          {t('usageStats.byDay')}
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="rounded-lg bg-card/40 border border-border/50 p-4">
                       {/* Legend */}
                       <div className="flex flex-wrap gap-2 mb-4">
                        {comparisonLines.map(line => (
                          <div key={line.id} className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-background/50 border border-border/50 text-xs">
                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: line.color }}></span>
                            <span className="font-medium truncate max-w-[150px]">
                              {line.model === 'all' && line.source === 'all' ? 'All Activity' :
                               line.model === 'all' ? maskApiName(line.source) :
                               line.source === 'all' ? line.model :
                               `${line.model}`}
                            </span>
                          </div>
                        ))}
                      </div>

                      {usageLoading ? (
                        <div className="flex items-center justify-center h-[300px]">
                          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                      ) : getComparisonData('tokens').length > 0 ? (
                        <ChartContainer config={chartConfig} className="h-[300px] w-full">
                          <LineChart
                            accessibilityLayer
                            data={getComparisonData('tokens')}
                            margin={{
                              left: 12,
                              right: 12,
                              top: 20
                            }}
                          >
                            <CartesianGrid vertical={false} strokeDasharray="3 3" strokeOpacity={0.2} />
                            <XAxis
                              dataKey="date"
                              tickLine={false}
                              axisLine={false}
                              tickMargin={8}
                              tickFormatter={(value) => {
                                const date = new Date(value);
                                return tokenTimeGrouping === 'hour'
                                  ? date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
                                  : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                              }}
                            />
                            <YAxis
                              tickLine={false}
                              axisLine={false}
                              tickFormatter={formatAxisNumber}
                              width={40}
                            />
                            <ChartTooltip
                              cursor={{ stroke: 'var(--muted-foreground)', strokeWidth: 1, strokeDasharray: '4 4' }}
                              content={
                                <ChartTooltipContent
                                  className="w-[150px]"
                                  labelFormatter={(value) => {
                                    if (!value) return '';
                                    const date = new Date(value);
                                    return tokenTimeGrouping === 'hour'
                                      ? date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
                                      : date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
                                  }}
                                />
                              }
                            />
                            {comparisonLines.map(line => (
                              <Line
                                key={line.id}
                                dataKey={line.id}
                                type="monotone"
                                stroke={line.color}
                                strokeWidth={2}
                                dot={false}
                                activeDot={{ r: 4, strokeWidth: 0 }}
                              />
                            ))}
                          </LineChart>
                        </ChartContainer>
                      ) : (
                        <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">
                          {t('usageStats.noData')}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* API Details and Model Statistics Row */}
              <div className="grid gap-4 md:grid-cols-2">
                {/* API Details */}
                <Card className="overflow-hidden border-border/50 bg-gradient-to-br from-card to-card/50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      {t('usageStats.apiDetails')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[400px] rounded-md border" type="always">
                      <div className="min-w-[500px]">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/50">
                            <TableHead className="w-[200px] bg-muted/50">{t('usageStats.sourceName')}</TableHead>
                            <TableHead className="text-right bg-muted/50">{t('usageStats.requestsUpper')}</TableHead>
                            <TableHead className="text-right bg-muted/50">{t('usageStats.tokensUpper')}</TableHead>
                            <TableHead className="w-[50px] bg-muted/50"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {usageLoading ? (
                             <TableRow>
                               <TableCell colSpan={4} className="h-24 text-center">
                                 <div className="flex justify-center items-center">
                                   <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                 </div>
                               </TableCell>
                             </TableRow>
                          ) : apiStats.map((api) => (
                            <>
                              <TableRow
                                key={api.name}
                                className="cursor-pointer hover:bg-muted/50"
                                onClick={() => toggleApi(api.name)}
                              >
                                <TableCell className="font-medium">
                                  {maskApiName(api.name)}
                                </TableCell>
                                <TableCell className="text-right">
                                  {formatNumber(api.requests)}
                                </TableCell>
                                <TableCell className="text-right">
                                  {formatNumber(api.tokens)}
                                </TableCell>
                                <TableCell>
                                  <Button variant="ghost" size="icon" className="h-6 w-6">
                                    {expandedApis.has(api.name) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                  </Button>
                                </TableCell>
                              </TableRow>
                              {expandedApis.has(api.name) && (
                                <TableRow className="hover:bg-transparent">
                                  <TableCell colSpan={4} className="p-0">
                                    <div className="bg-muted/30 p-4 border-t">
                                      <div className="space-y-2">
                                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{t('usageStats.modelsBreakdown')}</h4>
                                        <div className="grid gap-2">
                                          {api.models.map((model) => (
                                            <div key={model.name} className="flex items-center justify-between text-sm p-2 rounded-md hover:bg-background/80 transition-colors border border-transparent hover:border-border/50">
                                              <span className="font-medium">{model.name}</span>
                                              <div className="flex items-center gap-4 text-muted-foreground text-xs">
                                                <div className="flex items-center gap-2">
                                                  <span>Reqs:</span>
                                                  <span className="font-mono text-foreground">{formatNumber(model.requests)}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                  <span>Tokens:</span>
                                                  <span className="font-mono text-foreground">{formatNumber(model.tokens)}</span>
                                                </div>
                                              </div>
                                            </div>
                                          ))}
                                          {api.models.length === 0 && (
                                            <p className="text-sm text-muted-foreground">No models used</p>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              )}
                            </>
                          ))}
                          {apiStats.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={4} className="h-24 text-center">
                                {t('usageStats.noData')}
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                      </div>
                      <ScrollBar orientation="horizontal" />
                    </ScrollArea>
                  </CardContent>
                </Card>

                {/* Model Statistics */}
                <Card className="overflow-hidden border-border/50 bg-gradient-to-br from-card to-card/50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      {t('usageStats.modelStatistics')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[400px] rounded-lg border border-border/50" type="always">
                      <div className="min-w-[500px]">
                      <Table>
                        <TableHeader className="bg-muted/30 sticky top-0">
                          <TableRow>
                            <TableHead className="p-3 font-semibold text-xs uppercase tracking-wide text-muted-foreground">{t('usageStats.modelName').toUpperCase()}</TableHead>
                            <TableHead className="p-3 font-semibold text-xs uppercase tracking-wide text-muted-foreground text-right">{t('usageStats.requestsUpper')}</TableHead>
                            <TableHead className="p-3 font-semibold text-xs uppercase tracking-wide text-muted-foreground text-right">{t('usageStats.tokensUpper')}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody className="divide-y divide-border/30">
                          {usageLoading ? (
                             <TableRow>
                               <TableCell colSpan={3} className="h-24 text-center">
                                 <div className="flex justify-center items-center">
                                   <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                 </div>
                               </TableCell>
                             </TableRow>
                          ) : modelStats.map((model, index) => (
                            <TableRow key={model.name} className={`hover:bg-muted/20 transition-colors ${index % 2 === 0 ? 'bg-background/50' : 'bg-background/30'}`}>
                              <TableCell className="p-3 font-medium text-foreground">{model.name}</TableCell>
                              <TableCell className="p-3 text-right">
                                <span className="font-semibold text-foreground">{formatNumber(model.requests)}</span>
                                {model.failed > 0 && (
                                  <span className="ml-1.5 text-red-600 dark:text-red-400 text-xs font-medium">({model.failed})</span>
                                )}
                              </TableCell>
                              <TableCell className="p-3 text-right">
                                <span className="font-semibold text-foreground">{formatNumber(model.tokens)}</span>
                              </TableCell>
                            </TableRow>
                          ))}
                          {modelStats.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                                {t('usageStats.noData')}
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                      </div>
                      <ScrollBar orientation="horizontal" />
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </div>
    </div>
  );
}
