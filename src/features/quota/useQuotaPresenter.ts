import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuthStore } from '@/features/auth/auth.store';
import { authFilesApi } from '@/services/api/auth.service';
import { quotaApi } from '@/services/api/quota.service';
import type { AuthFile, FileQuota, ProviderSection } from '@/types';
import type { ProviderFilterItem } from '@/features/quota/components/ProviderFilter';
import { resolveCodexChatgptAccountId, resolveCodexPlanType, resolveGeminiCliProjectId } from '@/shared/utils/quota.helpers';

function getProviderType(file: AuthFile): 'antigravity' | 'codex' | 'gemini-cli' | 'kiro' | 'copilot' | 'anthropic' | 'unknown' {
  const filename = (file?.filename || file?.id || '').toLowerCase();

  if (filename.startsWith('antigravity-') || filename.includes('antigravity')) return 'antigravity';
  if (filename.startsWith('codex-') || filename.includes('codex')) return 'codex';
  if (filename.startsWith('gemini-cli-') || filename.includes('gemini')) return 'gemini-cli';
  if (filename.startsWith('kiro-') || filename.includes('kiro')) return 'kiro';
  if (filename.startsWith('github-copilot-') || filename.includes('copilot')) return 'copilot';
  if (filename.startsWith('claude-') || filename.includes('claude') || filename.includes('anthropic')) return 'anthropic';

  const provider = (file?.provider || '').toLowerCase();
  if (provider.includes('antigravity')) return 'antigravity';
  if (provider.includes('codex')) return 'codex';
  if (provider.includes('gemini')) return 'gemini-cli';
  if (provider.includes('kiro')) return 'kiro';
  if (provider.includes('copilot') || provider.includes('github')) return 'copilot';
  if (provider.includes('claude') || provider.includes('anthropic')) return 'anthropic';

  return 'unknown';
}

function formatFilename(name: string): string {
  return name.replace(/_gmail_com/g, '').replace(/\.json$/g, '');
}

const ICON_MAP: Record<string, { path?: string; needsInvert: boolean }> = {
  antigravity: { path: '/antigravity/antigravity.png', needsInvert: false },
  codex: { path: '/openai/openai.png', needsInvert: false },
  'gemini-cli': { path: '/gemini/gemini.png', needsInvert: false },
  kiro: { path: '/kiro/kiro.png', needsInvert: false },
  copilot: { path: '/copilot/copilot.png', needsInvert: true },
  anthropic: { path: '/claude/claude.png', needsInvert: false },
};

const PROVIDER_DISPLAY: { key: string; name: string }[] = [
  { key: 'antigravity', name: 'Antigravity' },
  { key: 'codex', name: 'Codex (OpenAI)' },
  { key: 'gemini-cli', name: 'Gemini CLI' },
  { key: 'kiro', name: 'Kiro (CodeWhisperer)' },
  { key: 'copilot', name: 'GitHub Copilot' },
  { key: 'anthropic', name: 'Claude (Anthropic)' },
  { key: 'unknown', name: 'Other' },
];

export function useQuotaPresenter() {
  const { isAuthenticated } = useAuthStore();
  const [sections, setSections] = useState<ProviderSection[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('antigravity');
  const [viewMode, setViewMode] = useState<'list' | 'card'>('list');
  const [isPrivacyMode, setIsPrivacyMode] = useState(true);

  const fetchQuotaForFile = useCallback(async (fileId: string, providedFile?: AuthFile) => {
    let targetProvider: string | undefined;

    if (providedFile) {
      const type = getProviderType(providedFile);
      if (type !== 'unknown') targetProvider = type;
    }

    if (!targetProvider) {
      for (const section of sections) {
        if (section.files.some(f => f.fileId === fileId)) {
          targetProvider = section.provider;
          break;
        }
      }
    }

    if (!targetProvider) return;

    setSections((prev) => prev.map(section => {
      if (section.provider !== targetProvider) return section;
      return {
        ...section,
        files: section.files.map(f => f.fileId === fileId ? { ...f, loading: true, error: undefined } : f)
      };
    }));

    try {
      let file = providedFile;
      if (!file) {
        const section = sections.find(s => s.provider === targetProvider);
        const fileQuota = section?.files.find(f => f.fileId === fileId);
        file = fileQuota?.originalFile;
      }

      if (!file) throw new Error('File not found');

      const authIndex = (file['auth_index'] as string) || (file['authIndex'] as string) || file.id || file.filename;
      if (!authIndex) throw new Error('No auth index (auth_index, id or filename) found');

      if (targetProvider === 'antigravity') {
        const result = await quotaApi.fetchAntigravity(authIndex);
        setSections((prev) => prev.map(s => s.provider === 'antigravity' ? {
          ...s,
          files: s.files.map(f => f.fileId === fileId ? {
            ...f, loading: false, models: result.models, error: result.error
          } : f)
        } : s));

      } else if (targetProvider === 'codex') {
        const accountId = resolveCodexChatgptAccountId(file);
        const result = await quotaApi.fetchCodex(authIndex, accountId || undefined);
        const plan = result.plan || resolveCodexPlanType(file) || 'Plus';

        setSections((prev) => prev.map(s => s.provider === 'codex' ? {
          ...s,
          files: s.files.map(f => f.fileId === fileId ? {
            ...f, loading: false, plan, limits: result.limits, error: result.error
          } : f)
        } : s));

      } else if (targetProvider === 'gemini-cli') {
        const projectId = resolveGeminiCliProjectId(file);
        if (!projectId) throw new Error('Project ID not found in file');
        const result = await quotaApi.fetchGeminiCli(authIndex, projectId);

        setSections((prev) => prev.map(s => s.provider === 'gemini-cli' ? {
          ...s,
          files: s.files.map(f => f.fileId === fileId ? {
            ...f,
            loading: false,
            models: result.buckets.map(b => ({
              name: b.modelId, percentage: b.percentage, resetTime: b.resetTime
            })),
            error: result.error
          } : f)
        } : s));

      } else if (targetProvider === 'kiro') {
        const result = await quotaApi.fetchKiro(authIndex);
        setSections((prev) => prev.map(s => s.provider === 'kiro' ? {
          ...s,
          files: s.files.map(f => f.fileId === fileId ? {
            ...f, loading: false, plan: result.plan, models: result.models, email: result.email, error: result.error
          } : f)
        } : s));

      } else if (targetProvider === 'copilot') {
        const result = await quotaApi.fetchCopilot(authIndex);
        setSections((prev) => prev.map(s => s.provider === 'copilot' ? {
          ...s,
          files: s.files.map(f => f.fileId === fileId ? {
            ...f, loading: false, plan: result.plan, models: result.models, error: result.error
          } : f)
        } : s));
      } else if (targetProvider === 'anthropic') {
        const result = await quotaApi.fetchClaude(authIndex);
        setSections((prev) => prev.map(s => s.provider === 'anthropic' ? {
          ...s,
          files: s.files.map(f => f.fileId === fileId ? {
            ...f, loading: false, email: result.email, models: result.models, error: result.error
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
  }, [sections]);

  const loadAuthFiles = useCallback(async () => {
    if (!isAuthenticated) return;

    setLoading(true);
    setError(null);

    try {
      const resp = await authFilesApi.list();
      const files: AuthFile[] = Array.isArray(resp) ? resp : (resp as any).items || (resp as any).files || [];

      const grouped: Record<string, FileQuota[]> = {
        antigravity: [], codex: [], 'gemini-cli': [], kiro: [], copilot: [], anthropic: [], unknown: []
      };

      files.forEach((file) => {
        if (!file) return;
        const providerType = getProviderType(file);
        if (grouped[providerType]) {
          grouped[providerType].push({
            fileId: file.id || file.filename || String(Math.random()),
            filename: formatFilename(file.filename || file.id || 'unknown'),
            provider: providerType.charAt(0).toUpperCase() + providerType.slice(1),
            providerKey: providerType,
            loading: false,
            originalFile: file
          });
        }
      });

      setSections(PROVIDER_DISPLAY.map(p => ({
        provider: p.key,
        displayName: p.name,
        files: grouped[p.key] || [],
      })));

      files.forEach((file) => {
        if (file?.id) {
          setTimeout(() => fetchQuotaForFile(file.id, file), 0);
        }
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    loadAuthFiles();
  }, [loadAuthFiles]);

  const filterItems: ProviderFilterItem[] = useMemo(() => {
    return sections
      .filter(s => s.files.length > 0)
      .map(s => {
        const iconInfo = ICON_MAP[s.provider] || { needsInvert: false };
        return {
          id: s.provider,
          label: s.displayName,
          count: s.files.length,
          icon: iconInfo.path,
          iconNeedsInvert: iconInfo.needsInvert
        };
      });
  }, [sections]);

  useEffect(() => {
    if (filterItems.length > 0 && !filterItems.some(i => i.id === activeTab)) {
      setActiveTab(filterItems[0].id);
    }
  }, [filterItems, activeTab]);

  const displayedFiles = useMemo(() => {
    const section = sections.find(s => s.provider === activeTab);
    return section ? section.files : [];
  }, [sections, activeTab]);

  const refreshDisplayed = useCallback(() => {
    displayedFiles.forEach(f => fetchQuotaForFile(f.fileId, f.originalFile));
  }, [displayedFiles, fetchQuotaForFile]);

  const togglePrivacyMode = useCallback(() => {
    setIsPrivacyMode(prev => !prev);
  }, []);

  return {
    isAuthenticated,
    sections,
    loading,
    error,
    activeTab,
    setActiveTab,
    viewMode,
    setViewMode,
    isPrivacyMode,
    togglePrivacyMode,
    filterItems,
    displayedFiles,
    refreshDisplayed,
    fetchQuotaForFile,
  };
}
