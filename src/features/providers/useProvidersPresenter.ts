import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/features/auth/auth.store';
import { authFilesApi } from '@/services/api/auth.service';
import { oauthApi } from '@/services/api/oauth.service';
import { useHeaderRefresh } from '@/shared/hooks';
import { AuthFile, type ProviderId } from '@/types';
import { openExternalUrl, isTauri } from '@/services/tauri';
import { toast } from 'sonner';
import { PLUS_ONLY_PROVIDERS } from '@/constants';
import { useCliProxyStore } from '@/features/settings/cliProxy.store';

export function detectIsPlusVersion(serverVersion: string | null | undefined): boolean | null {
  if (!serverVersion) return null;
  const cleaned = serverVersion.trim().replace(/^v/i, '');
  if (!cleaned) return null;
  return /-/.test(cleaned);
}

export function checkIsNonPlusServer(): boolean {
  const { serverVersion } = useAuthStore.getState();
  const fromServerVersion = detectIsPlusVersion(serverVersion);
  if (fromServerVersion !== null) return !fromServerVersion;

  const { currentInstalledVersion, cliProxyVersion, exePath } = useCliProxyStore.getState();
  const fromInstalledVersion = detectIsPlusVersion(currentInstalledVersion);
  if (fromInstalledVersion !== null) return !fromInstalledVersion;

  if (cliProxyVersion === 'plus') return false;
  if (cliProxyVersion === 'standard') return true;

  if (exePath && exePath.toLowerCase().includes('plus')) return false;

  return false;
}

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
  const filesRef = useRef<AuthFile[]>(files);

  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  const [loadingFiles, setLoadingFiles] = useState(false);
  const [filesError, setFilesError] = useState<string | null>(null);

  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [showDeleteAllConfirmation, setShowDeleteAllConfirmation] = useState(false);

  const [showCopyAllModal, setShowCopyAllModal] = useState(false);
  const [copyingAll, setCopyingAll] = useState(false);
  const [selectedProvidersForCopy, setSelectedProvidersForCopy] = useState<string[]>([]);

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
    copilot: true,
    anthropic: true,
    other: true
  });

  const groupedFiles = useMemo(() => {
    const groups: Record<string, { displayName: string; files: AuthFile[]; iconInfo: { path: string; needsInvert: boolean } }> = {
      antigravity: { displayName: 'Antigravity', files: [], iconInfo: { path: '/antigravity/antigravity.png', needsInvert: false } },
      codex: { displayName: 'Codex (OpenAI)', files: [], iconInfo: { path: '/openai/openai.png', needsInvert: false } },
      'gemini-cli': { displayName: 'Gemini CLI', files: [], iconInfo: { path: '/gemini/gemini.png', needsInvert: false } },
      kiro: { displayName: 'Kiro (CodeWhisperer)', files: [], iconInfo: { path: '/kiro/kiro.png', needsInvert: false } },
      copilot: { displayName: 'GitHub Copilot', files: [], iconInfo: { path: '/copilot/copilot.png', needsInvert: true } },
      anthropic: { displayName: 'Claude (Anthropic)', files: [], iconInfo: { path: '/claude/claude.png', needsInvert: false } },
      other: { displayName: 'Other', files: [], iconInfo: { path: '', needsInvert: false } }
    };

    files.forEach(file => {
      const p = (file.provider || file.filename || '').toLowerCase();
      if (p.includes('antigravity')) groups.antigravity.files.push(file);
      else if (p.includes('codex') || p.includes('openai')) groups.codex.files.push(file);
      else if (p.includes('gemini')) groups['gemini-cli'].files.push(file);
      else if (p.includes('kiro')) groups.kiro.files.push(file);
      else if (p.includes('copilot') || p.includes('github')) groups.copilot.files.push(file);
      else if (p.includes('claude') || p.includes('anthropic')) groups.anthropic.files.push(file);
      else groups.other.files.push(file);
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

  const executeDeleteAll = useCallback(async () => {
    setIsDeletingAll(true);
    try {
      await authFilesApi.deleteAll();
      setShowDeleteAllConfirmation(false);
      await loadFiles();
      toast.success(t('providers.deleteAllSuccess') || 'All accounts deleted successfully');
    } catch (err) {
      setFilesError((err as Error).message);
      toast.error((err as Error).message);
    } finally {
      setIsDeletingAll(false);
    }
  }, [loadFiles, t]);

  const openCopyAllModal = useCallback(() => {
    const allProviderIds = groupedFiles.map(([id]) => id);
    setSelectedProvidersForCopy(allProviderIds);
    setShowCopyAllModal(true);
  }, [groupedFiles]);

  const toggleCopyProvider = useCallback((providerId: string) => {
    setSelectedProvidersForCopy(prev => {
      if (prev.includes(providerId)) {
        return prev.filter(id => id !== providerId);
      } else {
        return [...prev, providerId];
      }
    });
  }, []);

  const executeCopyAll = useCallback(async () => {
    if (selectedProvidersForCopy.length === 0) return;

    setCopyingAll(true);
    try {
      const results: Array<{ provider: string, account: string, refresh_token: string }> = [];

      const filesToProcess = groupedFiles
        .filter(([id]) => selectedProvidersForCopy.includes(id))
        .flatMap(([, group]) => group.files);

      for (const file of filesToProcess) {
        let name = file.name || file.filename || file.id;
        if (!name) continue;
        if (!name.toLowerCase().endsWith('.json')) {
          name = `${name}.json`;
        }

        try {
          const data = await authFilesApi.download(name);
          if (data && data.refresh_token) {
            results.push({
              provider: file.provider,
              account: (file.metadata?.email as string) || (file.account as string) || file.filename,
              refresh_token: data.refresh_token
            });
          }
        } catch (err) {
          console.error(`Failed to download ${name}`, err);
        }
      }

      if (results.length > 0) {
        const tokens = results.map(r => r.refresh_token).join('\n');
        await navigator.clipboard.writeText(tokens);
        toast.success(t('providers.copySuccess') || 'Refresh tokens copied to clipboard');
        setShowCopyAllModal(false);
      } else {
        toast.warning(t('providers.noTokensFound') || 'No refresh tokens found');
      }
    } catch (err) {
      toast.error(t('common.error') || 'An error occurred');
    } finally {
      setCopyingAll(false);
    }
  }, [groupedFiles, selectedProvidersForCopy, t]);

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
    // Block plus-only providers when using standard (non-plus) CLIProxyAPI
    if (PLUS_ONLY_PROVIDERS.includes(providerId) && checkIsNonPlusServer()) {
      toast.error(t('providers.plusOnly', 'This provider requires CLIProxyAPI Plus version'));
      return;
    }

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

  const copyRefreshToken = useCallback(async (filename: string | undefined | null) => {
    try {
      if (!filename) {
        toast.error('Filename is missing');
        return;
      }
      let name = filename;
      if (!name.toLowerCase().endsWith('.json')) {
        name = `${name}.json`;
      }
      const data = await authFilesApi.download(name);
      const refreshToken = data.refresh_token;

      if (refreshToken) {
        await navigator.clipboard.writeText(refreshToken);
        toast.success(t('common.copied') || 'Copied to clipboard!');
      } else {
        toast.error('No refresh token found in this file');
      }
    } catch (err) {
      toast.error(`Failed to copy refresh token: ${(err as Error).message}`);
    }
  }, [t]);

  const downloadAuthFile = useCallback(async (filename: string | undefined | null) => {
    try {
      if (!filename) throw new Error('Filename is missing');
      let name = filename;
      if (!name.toLowerCase().endsWith('.json')) name = `${name}.json`;

      const { save } = await import('@tauri-apps/plugin-dialog');
      const { writeTextFile } = await import('@tauri-apps/plugin-fs');

      const data = await authFilesApi.download(name);

      const filePath = await save({
        defaultPath: name,
        filters: [{ name: 'JSON', extensions: ['json'] }],
      });

      if (filePath) {
        await writeTextFile(filePath, JSON.stringify(data, null, 2));
        toast.success(t('providers.downloadSuccess', 'File downloaded successfully'));
      }
    } catch (err) {
      toast.error(t('providers.downloadFailed', 'Failed to download file') + `: ${(err as Error).message}`);
    }
  }, [t]);

  const downloadAllAuthFiles = useCallback(async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const { writeTextFile } = await import('@tauri-apps/plugin-fs');
      const { join } = await import('@tauri-apps/api/path');

      const dirPath = await open({
        directory: true,
        multiple: false,
        title: 'Select Destination Folder'
      });

      if (!dirPath || typeof dirPath !== 'string') return;

      let successCount = 0;
      const currentFiles = filesRef.current;

      console.log('Downloading all files. Count:', currentFiles.length);

      for (const file of currentFiles) {
        try {
          const name = file.name || file.filename || file.id;
          if (!name) continue;

          let fileName = name;
          if (!fileName.toLowerCase().endsWith('.json')) fileName = `${fileName}.json`;

          const data = await authFilesApi.download(fileName);
          const fullPath = await join(dirPath, fileName);
          await writeTextFile(fullPath, JSON.stringify(data, null, 2));
          successCount++;
        } catch (e) {
          console.error('Failed to download file:', file.id, e);
        }
      }

      toast.success(t('providers.downloadSuccess', 'Downloaded {{count}} files successfully', { count: successCount }));
    } catch (err) {
      toast.error(t('providers.downloadFailed', 'Failed to download files') + `: ${(err as Error).message}`);
    }
  }, [t]);

  const uploadAuthFile = useCallback(async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const { readTextFile } = await import('@tauri-apps/plugin-fs');
      const { basename } = await import('@tauri-apps/api/path');

      const filePaths = await open({
        multiple: true,
        filters: [{ name: 'JSON', extensions: ['json'] }],
      });

      if (!filePaths || filePaths.length === 0) return;
      const paths = Array.isArray(filePaths) ? filePaths : [filePaths];

      let uploads = 0;
      for (const path of paths) {
        try {
          const content = await readTextFile(path);
          const name = await basename(path);

          const blob = new Blob([content], { type: 'application/json' });
          const formData = new FormData();
          formData.append('file', blob, name);

          await authFilesApi.upload(formData);
          uploads++;
        } catch (e) {
          console.error('Failed to upload file:', path, e);
        }
      }

      if (uploads > 0) {
        toast.success(t('providers.uploadSuccess', 'Files uploaded successfully'));
        loadFiles();
      }
    } catch (err) {
      toast.error(t('providers.uploadFailed', 'Failed to upload files') + `: ${(err as Error).message}`);
    }
  }, [t, loadFiles]);

  const togglePrivacyMode = useCallback(() => {
    setIsPrivacyMode(prev => !prev);
  }, []);

  // Auto-detect Plus version from multiple sources
  const { serverVersion } = useAuthStore();
  const { currentInstalledVersion, cliProxyVersion, exePath } = useCliProxyStore();
  const isNonPlusServer = useMemo(() => {
    // Check serverVersion (from API response headers)
    const fromServer = detectIsPlusVersion(serverVersion);
    if (fromServer !== null) return !fromServer;
    // Check currentInstalledVersion (from update check)
    const fromInstalled = detectIsPlusVersion(currentInstalledVersion);
    if (fromInstalled !== null) return !fromInstalled;
    // Check explicit cliProxyVersion
    if (cliProxyVersion === 'plus') return false;
    if (cliProxyVersion === 'standard') return true;
    // Check exe path
    if (exePath && exePath.toLowerCase().includes('plus')) return false;
    return false;
  }, [serverVersion, currentInstalledVersion, cliProxyVersion, exePath]);

  return {
    isAuthenticated,
    isNonPlusServer,

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

    // Delete All
    isDeletingAll,
    executeDeleteAll,
    showDeleteAllConfirmation,
    setShowDeleteAllConfirmation,

    // Copy All
    showCopyAllModal,
    setShowCopyAllModal,
    copyingAll,
    selectedProvidersForCopy,
    openCopyAllModal,
    toggleCopyProvider,
    executeCopyAll,

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
    copyRefreshToken,
    downloadAuthFile,
    downloadAllAuthFiles,
    uploadAuthFile,

    // Privacy
    isPrivacyMode,
    togglePrivacyMode,

    // Utilities
    openInBrowser,
  };
}
