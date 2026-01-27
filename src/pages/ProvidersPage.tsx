/**
 * Providers Page
 * Combined view for Connected Accounts and Adding New Providers
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores';
import { authFilesApi } from '@/services/api/authFiles';
import { oauthApi } from '@/services/api/oauth';
import { useHeaderRefresh } from '@/hooks';
import { AuthFile, PROVIDERS, type ProviderId } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Trash2,
  AlertCircle,
  Plus,
  Loader2,
  CheckCircle,
  ExternalLink,
  ClipboardCopy,
  Eye,
  EyeOff
} from 'lucide-react';
import { openExternalUrl, isTauri, runKiroAuth } from '@/services/tauri';
import { useCliProxyStore } from '@/stores';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { maskEmail } from '@/utils/privacy';

// --- Types ---

type ProviderStatus = 'idle' | 'waiting' | 'polling' | 'success' | 'error';

interface ProviderState {
  status: ProviderStatus;
  url?: string;
  state?: string;
  error?: string;
}

// --- Helpers ---

async function openInBrowser(url: string): Promise<void> {
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


// Helper to clean up names
function formatName(name: string | undefined | null): string {
  if (!name) return 'Unknown';
  return name.replace(/_gmail_com/g, '').replace(/\.json$/g, '');
}


export function ProvidersPage() {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuthStore();

  // Confimration state
  const [fileToDelete, setFileToDelete] = useState<string | null>(null);

  // --- State: Connected Accounts ---
  const [files, setFiles] = useState<AuthFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [filesError, setFilesError] = useState<string | null>(null);

  // --- State: Add Provider (OAuth) ---
  const [providerStates, setProviderStates] = useState<Record<string, ProviderState>>({});
  const [callbackUrl, setCallbackUrl] = useState('');
  const [selectedProvider, setSelectedProvider] = useState<ProviderId | null>(null);
  const [projectInput, setProjectInput] = useState('');
  const pollingTimers = useRef<Record<string, number>>({});

  // Privacy state
  const [isPrivacyMode, setIsPrivacyMode] = useState(true);

  // --- Cleanup ---
  useEffect(() => {
    return () => {
      Object.values(pollingTimers.current).forEach((timer) => clearInterval(timer));
    };
  }, []);

  // --- Actions: Connected Accounts ---

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

  const executeDelete = async () => {
    if (!fileToDelete) return;
    try {
      await authFilesApi.deleteFile(fileToDelete);
      setFileToDelete(null);
      await loadFiles();
    } catch (err) {
      setFilesError((err as Error).message);
    }
  };

  // --- Actions: Add Provider (OAuth) ---

  const updateProviderState = (provider: string, update: Partial<ProviderState>) => {
    setProviderStates((prev) => ({
      ...prev,
      [provider]: { ...prev[provider], ...update },
    }));
  };

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
          stopPolling(providerId);
          setSelectedProvider(null);
          loadFiles();
        } else if (status.status === 'error' || status.failed) {
          updateProviderState(providerId, {
            status: 'error',
            error: status.error || status.message || 'Authentication failed'
          });
          stopPolling(providerId);
        }
      } catch (err) {
        console.warn('Polling error:', err);
      }
    }, 3000);

    pollingTimers.current[providerId] = timer;
  }, [stopPolling, loadFiles]);

  const startAuth = async (providerId: ProviderId, options?: { projectId?: string }) => {
    stopPolling(providerId);
    updateProviderState(providerId, { status: 'waiting', error: undefined });
    setSelectedProvider(providerId);

    if (providerId === 'kiro') {
      try {
        const { exePath } = useCliProxyStore.getState();
        if (!exePath) {
          throw new Error('CLI Proxy path not configured. Please set it in Settings.');
        }
        await runKiroAuth(exePath, 'google');
        updateProviderState(providerId, { status: 'success' });
        setSelectedProvider(null);
        await new Promise(resolve => setTimeout(resolve, 500));
        await loadFiles();
      } catch (err) {
        updateProviderState(providerId, {
          status: 'error',
          error: (err as Error).message,
        });
      }
      return;
    }

    try {
      const response = await oauthApi.startAuth(providerId, options);
      const url = response.url || response.auth_url;
      const state = response.state;

      if (!url) {
        throw new Error('No auth URL returned from server');
      }

      updateProviderState(providerId, { url, state, status: 'polling' });
      await openInBrowser(url);

      if (state) {
        startPolling(providerId, state);
      }
    } catch (err) {
      updateProviderState(providerId, {
        status: 'error',
        error: (err as Error).message,
      });
    }
  };

  const cancelAuth = (providerId: ProviderId) => {
    stopPolling(providerId);
    updateProviderState(providerId, { status: 'idle' });
    if (selectedProvider === providerId) {
      setSelectedProvider(null);
    }
  };

  const submitCallback = async () => {
    if (!selectedProvider || !callbackUrl) return;

    updateProviderState(selectedProvider, { status: 'waiting' });

    try {
      await oauthApi.submitCallback(selectedProvider, callbackUrl);
      updateProviderState(selectedProvider, { status: 'success' });
      stopPolling(selectedProvider);
      setCallbackUrl('');
      setSelectedProvider(null);
      loadFiles();
    } catch (err) {
      updateProviderState(selectedProvider, {
        status: 'error',
        error: (err as Error).message,
      });
    }
  };

    const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch { /* ignore */ }
  };

  if (!isAuthenticated) {
     return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">{t('providers.title', 'Providers')}</h1>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">{t('providers.connectPrompt')}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
        <AlertDialog open={!!fileToDelete} onOpenChange={(open) => !open && setFileToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
                    <AlertDialogTitle>{t('common.confirm', 'Are you sure?')}</AlertDialogTitle>
                    <AlertDialogDescription>
                        {t('common.deleteWarning', 'This action cannot be undone. This will permanently delete your account connection.')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={executeDelete} className="bg-destructive hover:bg-destructive/90 text-white">
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">{t('providers.title')}</h1>

          {/* Privacy Toggle */}
           <Button
            variant="outline"
            onClick={() => setIsPrivacyMode(!isPrivacyMode)}
            title={isPrivacyMode ? "Show private info" : "Hide private info"}
          >
            {isPrivacyMode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
        </div>

        {/* --- Section 1: Connected Accounts --- */}
        <section className="space-y-4">
             <div className="flex items-center justify-between px-2">
                <h2 className="text-lg font-semibold flex items-center gap-2 text-muted-foreground">
                    <CheckCircle className="h-5 w-5" />
                    {t('providers.connectedAccounts')} ({files.length})
                </h2>
            </div>

            {filesError && (
                <div className="rounded-md bg-destructive/10 p-4 text-destructive">
                  {filesError}
                </div>
            )}

            {/* List of Connected Accounts */}
            {!loadingFiles && files.length === 0 && (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground border border-dashed rounded-lg">
                    <p>{t('providers.noAccounts')}</p>
                </div>
            )}

            <div className="space-y-1">
                 {files.map((file) => {
                        let iconPath = '';
                        const p = (file.provider || '').toLowerCase();
                        if (p.includes('antigravity')) iconPath = '/antigravity/antigravity.png';
                        else if (p.includes('claude') || p.includes('anthropic')) iconPath = '/claude/claude.png';
                        else if (p.includes('gemini')) iconPath = '/gemini/gemini.png';
                        else if (p.includes('codex') || p.includes('openai')) iconPath = '/openai/openai.png';
                        else if (p.includes('kiro')) iconPath = '/kiro/kiro.png';

                        let rawName: string;
                        if (p.includes('kiro')) {
                          const filename = file.filename || file.id || '';
                          const match = filename.match(/kiro-(\w+)/i);

                          if (match && match[1]) {
                            const method = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
                            rawName = `Kiro (${method})`;
                          } else {
                            const metaEmail = (file.metadata?.email as string) || (file['email'] as string);
                            const authMethod = (file.metadata?.provider as string) || (file.metadata?.auth_method as string);

                            if (metaEmail && metaEmail.trim() !== '') {
                              rawName = formatName(metaEmail);
                            } else if (authMethod) {
                              rawName = `Kiro (${authMethod})`;
                            } else {
                              rawName = 'Kiro';
                            }
                          }
                        } else {
                          rawName = formatName((file.metadata?.email as string) || (file.account as string) || file.filename);
                        }
                        const email = isPrivacyMode ? maskEmail(rawName) : rawName;

                        return (
                        <div key={file.id} className="group flex items-center justify-between p-3 hover:bg-muted/50 rounded-lg transition-colors">
                            <div className="flex items-center gap-4">
                                {/* Provider Icon */}
                                <div className="flex h-8 w-8 items-center justify-center rounded-sm overflow-hidden bg-transparent">
                                       <img
                                        src={iconPath}
                                        alt={file.provider}
                                        className="h-full w-full object-contain"
                                        onError={(e) => {
                                            (e.target as HTMLImageElement).style.display = 'none';
                                            ((e.target as HTMLImageElement).nextSibling as HTMLElement).style.display = 'block';
                                        }}
                                       />
                                       <span className="hidden font-bold">{file.provider.charAt(0).toUpperCase()}</span>
                                </div>

                                <div>
                                    <div className="font-medium text-sm text-foreground">{email}</div>
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                         <span>{file.provider}</span>
                                         <span className="text-[10px]">•</span>
                                         <span className="text-muted-foreground">{t('providers.active')}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 opacity-80 group-hover:opacity-100">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                  onClick={() => setFileToDelete(file.id)}
                                  title={t('common.delete')}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                     )})}

                     {loadingFiles && (
                        <div className="flex justify-center py-4">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                     )}
            </div>
        </section>

        {/* --- Section 2: Add Provider --- */}
        <section className="space-y-4 pt-4 border-t">
            <h2 className="text-lg font-semibold flex items-center gap-2">
                <Plus className="h-5 w-5 text-muted-foreground" />
                {t('providers.addProvider')}
            </h2>

            <div className="grid gap-2">
                {PROVIDERS.map((provider) => {
                    const state = providerStates[provider.id] || { status: 'idle' };
                    const isWaiting = state.status === 'waiting' || state.status === 'polling';
                    const isSuccess = state.status === 'success';

                    let iconPath = '';
                    const pid = provider.id;
                    if (pid === 'antigravity') iconPath = '/antigravity/antigravity.png';
                    else if (pid === 'anthropic' || (pid as string) === 'claude') iconPath = '/claude/claude.png';
                    else if (pid === 'gemini-cli') iconPath = '/gemini/gemini.png';
                    else if (pid === 'codex') iconPath = '/openai/openai.png';
                    else if (pid === 'kiro') iconPath = '/kiro/kiro.png';

                    const isSelected = selectedProvider === provider.id;

                    if (isSelected) {
                        return (
                             <Card key={provider.id} className="border-primary/50 bg-accent/50">
                                <CardHeader className="pb-2">
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="text-base">{provider.name}</CardTitle>
                                        <Button variant="ghost" size="sm" onClick={() => cancelAuth(provider.id)}>{t('common.cancel')}</Button>
                                    </div>
                                    <CardDescription>
                                        {/* Show different message based on state */}
                                        {state.status === 'idle' && provider.requiresProjectId ? t('providers.enterConfig') :
                                         state.status === 'error' ? t('providers.connectionFailed') :
                                         isWaiting ? t('providers.waitingAuth') : t('providers.connecting')}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {state.error && <p className="text-sm text-destructive">{state.error}</p>}

                                    {/* Input Project ID if needed and not yet started (or error) */}
                                    {provider.requiresProjectId && (state.status === 'idle' || state.status === 'error') && (
                                        <div className="space-y-2">
                                            <div className="space-y-1">
                                                <div className="text-sm font-medium">
                                                    {t('providers.googleProjectId')} <span className="text-xs font-normal text-muted-foreground">({t('providers.optional')})</span>
                                                </div>
                                                <Input
                                                    placeholder={t('providers.projectIdPlaceholder')}
                                                    value={projectInput}
                                                    onChange={(e) => setProjectInput(e.target.value)}
                                                />
                                                <p className="text-xs text-muted-foreground">
                                                    {t('providers.projectIdHelp')}
                                                </p>
                                            </div>
                                            <Button
                                                className="w-full"
                                                onClick={() => startAuth(provider.id, { projectId: projectInput || undefined })}
                                            >
                                                {state.status === 'error' ? t('providers.retryConnection') : (projectInput ? t('providers.connectWithProject') : t('providers.autoSelect'))}
                                            </Button>
                                        </div>
                                    )}

                                    {/* Normal Auth Flow (Polling/Waiting) - Only if NOT Error and NOT Idle */}
                                    {state.status !== 'idle' && state.status !== 'error' && (
                                        <>
                                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                <span>{t('providers.completeLogin')}</span>
                                            </div>

                                            {state.url && (
                                                <div className="flex flex-wrap gap-2">
                                                    <Button variant="outline" size="sm" onClick={() => openInBrowser(state.url!)}>
                                                        <ExternalLink className="mr-2 h-4 w-4" />
                                                        {t('providers.openLink')}
                                                    </Button>
                                                    <Button variant="outline" size="sm" onClick={() => copyToClipboard(state.url!)}>
                                                        <ClipboardCopy className="mr-2 h-4 w-4" />
                                                        {t('common.copy')}
                                                    </Button>
                                                </div>
                                            )}
                                        </>
                                    )}

                                     {/* Callback fallback - Only show if polling started */}
                                     {state.status !== 'idle' && (
                                         <div className="pt-2 border-t">
                                            <p className="mb-2 text-xs text-muted-foreground">{t('providers.manualCallback')}</p>
                                            <div className="flex gap-2">
                                                <Input
                                                    placeholder={t('oauth.pasteCallback')}
                                                    value={callbackUrl}
                                                    onChange={(e) => setCallbackUrl(e.target.value)}
                                                    className="h-8 text-sm"
                                                />
                                                <Button size="sm" onClick={submitCallback} disabled={!callbackUrl}>
                                                    {t('providers.verify')}
                                                </Button>
                                            </div>
                                         </div>
                                     )}
                                </CardContent>
                             </Card>
                        );
                    }

                    /* Default List Item View */
                    return (
                        <div
                            key={provider.id}
                            className="flex items-center justify-between rounded-lg border bg-card p-3 transition-colors hover:bg-accent/50"
                        >
                             <div className="flex items-center gap-3">
                                 {/* Icon */}
                                 <div className="flex h-8 w-8 items-center justify-center rounded-md bg-secondary/50 p-1 overflow-hidden">
                                       <img
                                        src={iconPath}
                                        alt={provider.name}
                                        className="h-full w-full object-contain"
                                        onError={(e) => {
                                            (e.target as HTMLImageElement).style.display = 'none';
                                        }}
                                       />
                                       <span className="hidden text-xs font-bold">{provider.id.slice(0,2).toUpperCase()}</span>
                                 </div>
                                 <span className="font-medium">{provider.name}</span>
                                 {provider.requiresProjectId && (
                                    <Badge variant="outline" className="text-[10px] h-5">Project ID</Badge>
                                 )}
                             </div>

                             <div className="flex items-center gap-2">
                                {isSuccess && <Badge className="bg-green-500">{t('auth.connected')}</Badge>}
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-8 w-8 rounded-full border p-0 hover:bg-accent hover:text-accent-foreground"
                                    onClick={() => {
                                        if (provider.requiresProjectId) {
                                             setSelectedProvider(provider.id);
                                             setProjectInput(''); // Reset input
                                             // Don't start auth yet, wait for input
                                             updateProviderState(provider.id, { status: 'idle' });
                                        } else {
                                             startAuth(provider.id);
                                        }
                                    }}
                                    title={t('providers.connect')}
                                >
                                    <Plus className="h-4 w-4" />
                                </Button>
                             </div>
                        </div>
                    );
                })}
            </div>
        </section>
    </div>
  );
}
