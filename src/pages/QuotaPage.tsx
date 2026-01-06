/**
 * Quota Page with Real API Data (Redesigned)
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores';
import { authFilesApi } from '@/services/api/authFiles';
import { quotaApi } from '@/services/api/quota';
import type { AuthFile } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RefreshCw, AlertCircle, Loader2, LayoutGrid, List, Eye, EyeOff } from 'lucide-react';
import { resolveCodexChatgptAccountId, resolveCodexPlanType, resolveGeminiCliProjectId } from '@/utils/quota';
import { ProviderFilter, type ProviderFilterItem } from '@/components/quota/ProviderFilter';
import { ProviderQuotaCard } from '@/components/quota/ProviderQuotaCard';
import { CompactQuotaCard } from '@/components/quota/CompactQuotaCard';

// Types for quota data
interface ModelQuota {
  name: string;
  percentage: number;
  resetTime?: string;
}

interface FileQuota {
  fileId: string;
  filename: string;
  provider: string; // 'Antigravity', 'Codex', 'Gemini-cli' (display format)
  providerKey: string; // 'antigravity', 'codex', 'gemini-cli' (internal key)
  loading: boolean;
  error?: string;
  originalFile?: AuthFile;
  models?: ModelQuota[];
  // For Codex
  plan?: string;
  limits?: Array<{
    name: string;
    percentage: number;
    resetTime?: string;
  }>;
}

interface ProviderSection {
  provider: string; // Internal key
  displayName: string;
  files: FileQuota[];
}

// Identify provider from filename - with null safety
function getProviderType(file: AuthFile): 'antigravity' | 'codex' | 'gemini-cli' | 'unknown' {
  // Handle missing filename
  const filename = (file?.filename || file?.id || '').toLowerCase();

  if (filename.startsWith('antigravity-') || filename.includes('antigravity')) return 'antigravity';
  if (filename.startsWith('codex-') || filename.includes('codex')) return 'codex';
  if (filename.startsWith('gemini-cli-') || filename.includes('gemini')) return 'gemini-cli';

  // Fallback to provider field
  const provider = (file?.provider || '').toLowerCase();
  if (provider.includes('antigravity')) return 'antigravity';
  if (provider.includes('codex')) return 'codex';
  if (provider.includes('gemini')) return 'gemini-cli';

  return 'unknown';
}

// Helper to clean up filenames
function formatFilename(name: string): string {
  return name.replace(/_gmail_com/g, '').replace(/\.json$/g, '');
}

export function QuotaPage() {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuthStore();
  const [sections, setSections] = useState<ProviderSection[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('antigravity');
  const [viewMode, setViewMode] = useState<'list' | 'card'>('list');
  const [isPrivacyMode, setIsPrivacyMode] = useState(true);

  const loadAuthFiles = useCallback(async () => {
    if (!isAuthenticated) return;

    setLoading(true);
    setError(null);

    try {
      const resp = await authFilesApi.list();
      // Handle potential response wrapper
      const files: AuthFile[] = Array.isArray(resp) ? resp : (resp as any).items || (resp as any).files || [];

      // Group files by provider
      const grouped: Record<string, FileQuota[]> = {
        antigravity: [],
        codex: [],
        'gemini-cli': [],
      };

      files.forEach((file) => {
        if (!file) return; // Skip null/undefined entries
        const providerType = getProviderType(file);
        if (grouped[providerType]) {
          grouped[providerType].push({
            fileId: file.id || file.filename || String(Math.random()),
            filename: formatFilename(file.filename || file.id || t('quotaCard.unknown')),
            provider: providerType.charAt(0).toUpperCase() + providerType.slice(1),
            providerKey: providerType,
            loading: false,
            originalFile: file
          });
        }
      });

      setSections([
        { provider: 'antigravity', displayName: 'Antigravity', files: grouped.antigravity },
        { provider: 'codex', displayName: 'Codex (OpenAI)', files: grouped.codex },
        { provider: 'gemini-cli', displayName: 'Gemini CLI', files: grouped['gemini-cli'] },
      ]);

      // Auto-fetch quota for all files
      files.forEach((file) => {
        if (file?.id) {
          // Add a small delay for each file to avoid flooding
          // Pass the file object directly to ensure we have the fresh auth_index
          setTimeout(() => fetchQuotaForFile(file.id, file), 0);
        }
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  const fetchQuotaForFile = async (fileId: string, providedFile?: AuthFile) => {
    // 1. Determine provider from file (either provided or from state)
    let targetProvider: string | undefined;

    // First, try to find provider from provided file
    if (providedFile) {
        const type = getProviderType(providedFile);
        if (type !== 'unknown') {
            targetProvider = type === 'antigravity' ? 'antigravity' : type === 'codex' ? 'codex' : 'gemini-cli';
        }
    }

    // If not found (or no provided file), look in current state
    if (!targetProvider) {
        for (const section of sections) {
            if (section.files.some(f => f.fileId === fileId)) {
                targetProvider = section.provider;
                break;
            }
        }
    }

    if (!targetProvider) return;

    // 2. Set loading state
    setSections((prev) => prev.map(section => {
        if (section.provider !== targetProvider) return section;
        return {
            ...section,
            files: section.files.map(f => f.fileId === fileId ? { ...f, loading: true, error: undefined } : f)
        };
    }));

    try {
      // 3. Resolve credentials (file object)
      let file = providedFile;
      if (!file) {
        const section = sections.find(s => s.provider === targetProvider);
        const fileQuota = section?.files.find(f => f.fileId === fileId);
        file = fileQuota?.originalFile;
      }

      if (!file) {
        throw new Error('File not found');
      }

      // Prioritize auth_index if available (legacy behavior), fallback to id or filename
      const authIndex = (file['auth_index'] as string) || (file['authIndex'] as string) || file.id || file.filename;

      if (!authIndex) {
        throw new Error('No auth index (auth_index, id or filename) found');
      }

      if (targetProvider === 'antigravity') {
        const result = await quotaApi.fetchAntigravity(authIndex);
        setSections((prev) => prev.map(s => s.provider === 'antigravity' ? {
          ...s,
          files: s.files.map(f => f.fileId === fileId ? {
            ...f,
            loading: false,
            models: result.models,
            error: result.error
          } : f)
        } : s));

      } else if (targetProvider === 'codex') {
        const accountId = resolveCodexChatgptAccountId(file);
        const result = await quotaApi.fetchCodex(authIndex, accountId || undefined);
        const plan = result.plan || resolveCodexPlanType(file) || 'Plus';

        setSections((prev) => prev.map(s => s.provider === 'codex' ? {
          ...s,
          files: s.files.map(f => f.fileId === fileId ? {
            ...f,
            loading: false,
            plan: plan,
            limits: result.limits,
            error: result.error
          } : f)
        } : s));

      } else if (targetProvider === 'gemini-cli') {
        const projectId = resolveGeminiCliProjectId(file);
        if (!projectId) {
            throw new Error('Project ID not found in file');
        }
        const result = await quotaApi.fetchGeminiCli(authIndex, projectId);

        setSections((prev) => prev.map(s => s.provider === 'gemini-cli' ? {
          ...s,
          files: s.files.map(f => f.fileId === fileId ? {
            ...f,
            loading: false,
            models: result.buckets.map(b => ({
              name: b.modelId,
              percentage: b.percentage,
              resetTime: b.resetTime
            })),
            error: result.error
          } : f)
        } : s));
      }
    } catch (err) {
      const msg = (err as Error).message;
      setSections((prev) => prev.map(section => ({
        ...section,
        files: section.files.map(f => f.fileId === fileId ? { ...f, loading: false, error: msg } : f)
      })));
    }
  };

  useEffect(() => {
    loadAuthFiles();
  }, [loadAuthFiles]);

  // Compute filter items for header
  const filterItems: ProviderFilterItem[] = useMemo(() => {
    // Map internal keys to icon paths (assume standard location public/provider/provider.png)
    const getIcon = (key: string) => {
        if (key === 'antigravity') return '/antigravity/antigravity.png';
        if (key === 'codex') return '/openai/openai.png'; // Assuming Codex uses OpenAI icon
        if (key === 'gemini-cli') return '/gemini/gemini.png';
        return undefined;
    };

    return sections
        .filter(s => s.files.length > 0)
        .map(s => ({
            id: s.provider,
            label: s.displayName,
            count: s.files.length,
            icon: getIcon(s.provider)
        }));
  }, [sections]);

  // Ensure active tab is valid (defaults to first available if current empty/invalid)
  useEffect(() => {
      if (filterItems.length > 0 && !filterItems.some(i => i.id === activeTab)) {
          setActiveTab(filterItems[0].id);
      }
  }, [filterItems, activeTab]);

  // Flatten files for display based on active tab
  const displayedFiles = useMemo(() => {
      const section = sections.find(s => s.provider === activeTab);
      return section ? section.files : [];
  }, [sections, activeTab]);

  if (!isAuthenticated) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">{t('quota.title')}</h1>
        </div>
        <Card className="border">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">{t('quota.connectPrompt')}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header & Refresh */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{t('quota.title')}</h1>
        </div>
        <div className="flex items-center gap-2">
          {/* Privacy Toggle */}
           <Button
            variant="outline"
            onClick={() => setIsPrivacyMode(!isPrivacyMode)}
            title={isPrivacyMode ? "Show private info" : "Hide private info"}
          >
            {isPrivacyMode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>

          {/* View Mode Toggle */}
          <div className="flex items-center border rounded-md">
            <Button
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-8 px-2"
              onClick={() => setViewMode('list')}
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'card' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-8 px-2"
              onClick={() => setViewMode('card')}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
          </div>

          <Button
            variant="outline"
            onClick={() => {
                displayedFiles.forEach(f => fetchQuotaForFile(f.fileId, f.originalFile));
            }}
            disabled={loading}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            {t('quota.refreshAll')}
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 p-4 text-destructive">
          {error}
        </div>
      )}

      {/* Filter Tabs */}
      {filterItems.length > 0 && (
          <ProviderFilter
            items={filterItems}
            activeId={activeTab}
            onSelect={setActiveTab}
          />
      )}

      {/* Loading State */}
      {loading && sections.every(s => s.files.length === 0) && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Empty State */}
      {!loading && filterItems.length === 0 && (
          <Card className="border">
              <CardContent className="flex flex-col items-center justify-center py-12">
                  <p className="text-muted-foreground">{t('quota.noCredentials')}</p>
              </CardContent>
          </Card>
      )}

      {/* Filtered Content */}
      {viewMode === 'list' ? (
        <div className="space-y-4">
          {displayedFiles.map(file => {
            const items = file.models || file.limits || [];
            return (
              <ProviderQuotaCard
                key={file.fileId}
                fileId={file.fileId}
                filename={file.filename}
                provider={file.provider}
                email={file.originalFile?.account || '********@*****.com'}
                loading={file.loading}
                error={file.error}
                items={items}
                onRefresh={() => fetchQuotaForFile(file.fileId, file.originalFile)}
                isPrivacyMode={isPrivacyMode}
              />
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {displayedFiles.map(file => {
            const items = file.models || file.limits || [];
            return (
              <CompactQuotaCard
                key={file.fileId}
                fileId={file.fileId}
                filename={file.filename}
                provider={file.provider}
                email={file.originalFile?.account || '********@*****.com'}
                loading={file.loading}
                error={file.error}
                items={items}
                plan={file.plan}
                onRefresh={() => fetchQuotaForFile(file.fileId, file.originalFile)}
                isPrivacyMode={isPrivacyMode}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
