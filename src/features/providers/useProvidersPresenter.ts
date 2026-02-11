import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/features/auth/auth.store';
import { authFilesApi } from '@/services/api/auth.service';
import { oauthApi } from '@/services/api/oauth.service';
import { useHeaderRefresh } from '@/shared/hooks';
import { AuthFile, type ProviderId } from '@/types';
import { openExternalUrl, isTauri } from '@/services/tauri';
import { toast } from 'sonner';

export type ProviderStatus = 'idle' | 'waiting' | 'polling' | 'success' | 'error';

export interface ProviderState {
  status: ProviderStatus;
  url?: string;
  state?: string;
  error?: string;
  userCode?: string;
  deviceCode?: string;
  expiresIn?: number;
  interval?: number;
}

export async function openInBrowser(url: string): Promise<void> {
  try {
    if (isTauri()) {
      await openExternalUrl(url);
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  } catch (err) {
    console.warn('Failed to open URL:', err);
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

export function formatName(name: string | undefined | null): string {
  if (!name) return 'Unknown';
  return name.replace(/_gmail_com/g, '').replace(/\.json$/g, '');
}

export function getProviderIconInfo(providerId: string): { path: string; needsInvert: boolean } {
  const id = providerId.toLowerCase();
  if (id.includes('antigravity')) return { path: '/antigravity/antigravity.png', needsInvert: false };
  if (id.includes('claude') || id.includes('anthropic')) return { path: '/claude/claude.png', needsInvert: false };
  if (id.includes('gemini')) return { path: '/gemini/gemini.png', needsInvert: false };
  if (id.includes('codex') || id.includes('openai')) return { path: '/openai/openai.png', needsInvert: false };
  if (id.includes('kiro')) return { path: '/kiro/kiro.png', needsInvert: false };
  if (id.includes('copilot') || id.includes('github')) return { path: '/copilot/copilot.png', needsInvert: true };
  return { path: '', needsInvert: false };
}

export function useProvidersPresenter() {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuthStore();

  const [fileToDelete, setFileToDelete] = useState<string | null>(null);
  const [files, setFiles] = useState<AuthFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [filesError, setFilesError] = useState<string | null>(null);

  const [providerStates, setProviderStates] = useState<Record<string, ProviderState>>({});
  const [callbackUrl, setCallbackUrl] = useState('');
  const [selectedProvider, setSelectedProvider] = useState<ProviderId | null>(null);
  const [projectInput, setProjectInput] = useState('');
  const pollingTimers = useRef<Record<string, number>>({});

  const [isPrivacyMode, setIsPrivacyMode] = useState(true);

  const [expandedProviders, setExpandedProviders] = useState<Record<string, boolean>>({
    antigravity: true,
    codex: true,
    'gemini-cli': true,
    kiro: true,
    copilot: true
  });

  const groupedFiles = useMemo(() => {
    const groups: Record<string, { displayName: string; files: AuthFile[]; iconInfo: { path: string; needsInvert: boolean } }> = {
      antigravity: { displayName: 'Antigravity', files: [], iconInfo: { path: '/antigravity/antigravity.png', needsInvert: false } },
      codex: { displayName: 'Codex (OpenAI)', files: [], iconInfo: { path: '/openai/openai.png', needsInvert: false } },
      'gemini-cli': { displayName: 'Gemini CLI', files: [], iconInfo: { path: '/gemini/gemini.png', needsInvert: false } },
      kiro: { displayName: 'Kiro (CodeWhisperer)', files: [], iconInfo: { path: '/kiro/kiro.png', needsInvert: false } },
      copilot: { displayName: 'GitHub Copilot', files: [], iconInfo: { path: '/copilot/copilot.png', needsInvert: true } }
    };

    files.forEach(file => {
      const p = (file.provider || file.filename || '').toLowerCase();
      if (p.includes('antigravity')) groups.antigravity.files.push(file);
      else if (p.includes('codex') || p.includes('openai')) groups.codex.files.push(file);
      else if (p.includes('gemini')) groups['gemini-cli'].files.push(file);
      else if (p.includes('kiro')) groups.kiro.files.push(file);
      else if (p.includes('copilot') || p.includes('github')) groups.copilot.files.push(file);
    });

    return Object.entries(groups).filter(([, group]) => group.files.length > 0);
  }, [files]);

  const toggleProviderExpanded = useCallback((providerId: string) => {
    setExpandedProviders(prev => ({ ...prev, [providerId]: !prev[providerId] }));
  }, []);

  // Cleanup polling timers on unmount
  useEffect(() => {
    return () => {
      Object.values(pollingTimers.current).forEach((timer) => clearInterval(timer));
    };
  }, []);

  const loadFiles = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoadingFiles(true);
    setFilesError(null);
    try {
      const response = await authFilesApi.list();
      setFiles(response?.files ?? []);
    } catch (err) {
      setFilesError((err as Error).message);
    } finally {
      setLoadingFiles(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  useHeaderRefresh(loadFiles);

  const executeDelete = useCallback(async () => {
    if (!fileToDelete) return;
    try {
      await authFilesApi.deleteFile(fileToDelete);
      setFileToDelete(null);
      await loadFiles();
    } catch (err) {
      setFilesError((err as Error).message);
    }
  }, [fileToDelete, loadFiles]);

  const updateProviderState = useCallback((provider: string, update: Partial<ProviderState>) => {
    setProviderStates((prev) => ({
      ...prev,
      [provider]: { ...prev[provider], ...update },
    }));
  }, []);

  const stopPolling = useCallback((provider: string) => {
    if (pollingTimers.current[provider]) {
      clearInterval(pollingTimers.current[provider]);
      delete pollingTimers.current[provider];
    }
  }, []);

  const startPolling = useCallback((providerId: ProviderId, state: string) => {
    stopPolling(providerId);

    const timer = window.setInterval(async () => {
      try {
        const status = await oauthApi.getAuthStatus(state);
        if (status.status === 'ok' || status.completed) {
          updateProviderState(providerId, { status: 'success' });
          toast.success(t('providers.authSuccess') || 'Provider connected successfully!');
          stopPolling(providerId);
          setSelectedProvider(null);
          loadFiles();
        } else if (status.status === 'error' || status.failed) {
          const errorMsg = status.error || status.message || 'Authentication failed';
          updateProviderState(providerId, { status: 'error', error: errorMsg });
          toast.error(errorMsg);
          stopPolling(providerId);
        }
      } catch (err) {
        console.warn('Polling error:', err);
      }
    }, 3000);

    pollingTimers.current[providerId] = timer;
  }, [stopPolling, loadFiles, updateProviderState, t]);

  const startAuth = useCallback(async (providerId: ProviderId, options?: { projectId?: string }) => {
    stopPolling(providerId);
    updateProviderState(providerId, { status: 'waiting', error: undefined });
    setSelectedProvider(providerId);

    try {
      // Kiro uses a dedicated web OAuth page
      if (providerId === 'kiro') {
        const { apiBase } = useAuthStore.getState();
        const kiroOAuthUrl = `${apiBase}/v0/oauth/kiro`;

        const initialFiles = files.filter(f =>
          f.provider?.toLowerCase().includes('kiro') ||
          f.filename?.toLowerCase().includes('kiro')
        );
        const initialKiroCount = initialFiles.length;

        await openInBrowser(kiroOAuthUrl);
        updateProviderState(providerId, { url: kiroOAuthUrl, status: 'polling' });

        const pollTimer = window.setInterval(async () => {
          try {
            const response = await authFilesApi.list();
            const currentFiles = response?.files ?? [];
            const currentKiroFiles = currentFiles.filter(f =>
              f.provider?.toLowerCase().includes('kiro') ||
              f.filename?.toLowerCase().includes('kiro')
            );

            if (currentKiroFiles.length > initialKiroCount) {
              updateProviderState(providerId, { status: 'success' });
              toast.success(t('providers.authSuccess') || 'Provider connected successfully!');
              stopPolling(providerId);
              setSelectedProvider(null);
              setFiles(currentFiles);
            }
          } catch {
            // Ignore polling errors
          }
        }, 2000);
        pollingTimers.current[providerId] = pollTimer;
        return;
      }

      // Copilot uses device code flow via backend
      if (providerId === 'copilot') {
        try {
          const response = await oauthApi.startAuth('copilot');
          const url = response.url || response.verification_uri;
          const state = response.state;
          const userCode = response.user_code;

          if (!url) throw new Error('No verification URL returned from server');

          updateProviderState(providerId, { status: 'polling', url, state, userCode });
          await openInBrowser(url);

          if (state) {
            startPolling(providerId, state);
          } else {
            const initialFiles = files.filter(f =>
              f.provider?.toLowerCase().includes('github') ||
              f.filename?.toLowerCase().includes('github')
            );
            const initialCount = initialFiles.length;

            const pollTimer = window.setInterval(async () => {
              try {
                const listResponse = await authFilesApi.list();
                const currentFiles = listResponse?.files ?? [];
                const currentGithubFiles = currentFiles.filter(f =>
                  f.provider?.toLowerCase().includes('github') ||
                  f.filename?.toLowerCase().includes('github')
                );

                if (currentGithubFiles.length > initialCount) {
                  updateProviderState(providerId, { status: 'success' });
                  toast.success(t('providers.authSuccess') || 'Provider connected successfully!');
                  stopPolling(providerId);
                  setSelectedProvider(null);
                  setFiles(currentFiles);
                }
              } catch {
                // Ignore polling errors
              }
            }, 3000);
            pollingTimers.current[providerId] = pollTimer;
          }
        } catch (err) {
          const errorMsg = (err as Error).message;
          updateProviderState(providerId, { status: 'error', error: errorMsg });
          toast.error(errorMsg);
        }
        return;
      }

      // Standard OAuth flow
      const response = await oauthApi.startAuth(providerId, options);
      const url = response.url || response.auth_url;
      const state = response.state;

      if (!url) throw new Error('No auth URL returned from server');

      updateProviderState(providerId, { url, state, status: 'polling' });
      await openInBrowser(url);

      if (state) {
        startPolling(providerId, state);
      }
    } catch (err) {
      const errorMsg = (err as Error).message;
      updateProviderState(providerId, { status: 'error', error: errorMsg });
      toast.error(errorMsg);
    }
  }, [files, stopPolling, updateProviderState, startPolling, t]);

  const cancelAuth = useCallback((providerId: ProviderId) => {
    stopPolling(providerId);
    updateProviderState(providerId, { status: 'idle' });
    if (selectedProvider === providerId) {
      setSelectedProvider(null);
    }
  }, [stopPolling, updateProviderState, selectedProvider]);

  const submitCallback = useCallback(async () => {
    if (!selectedProvider || !callbackUrl) return;

    updateProviderState(selectedProvider, { status: 'waiting' });

    try {
      await oauthApi.submitCallback(selectedProvider, callbackUrl);
      updateProviderState(selectedProvider, { status: 'success' });
      stopPolling(selectedProvider);
      setCallbackUrl('');
      setSelectedProvider(null);
      toast.success(t('providers.authSuccess') || 'Provider connected successfully!');
      loadFiles();
    } catch (err) {
      const errorMsg = (err as Error).message;
      updateProviderState(selectedProvider, { status: 'error', error: errorMsg });
      toast.error(errorMsg);
    }
  }, [selectedProvider, callbackUrl, updateProviderState, stopPolling, loadFiles, t]);

  const copyToClipboard = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(t('common.copied') || 'Copied to clipboard!');
    } catch { /* ignore */ }
  }, [t]);

  const togglePrivacyMode = useCallback(() => {
    setIsPrivacyMode(prev => !prev);
  }, []);

  return {
    isAuthenticated,

    // Connected accounts
    files,
    loadingFiles,
    filesError,
    groupedFiles,
    expandedProviders,
    toggleProviderExpanded,

    // Delete confirmation
    fileToDelete,
    setFileToDelete,
    executeDelete,

    // Add provider (OAuth)
    providerStates,
    selectedProvider,
    setSelectedProvider,
    projectInput,
    setProjectInput,
    callbackUrl,
    setCallbackUrl,
    startAuth,
    cancelAuth,
    submitCallback,
    updateProviderState,
    copyToClipboard,

    // Privacy
    isPrivacyMode,
    togglePrivacyMode,

    // Utilities
    openInBrowser,
  };
}
