/**
 * Login Page
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore, useCliProxyStore } from '@/stores';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Loader2, Server, Key, FolderOpen, Play, Square, CheckCircle2 } from 'lucide-react';

export function LoginPage() {
  const { t } = useTranslation();
  const { login, connectionStatus, connectionError, apiBase: storedApiBase, rememberPassword } = useAuthStore();
  const { exePath, isServerRunning, browseForExe, startServer, stopServer } = useCliProxyStore();

  const [apiBase, setApiBase] = useState(storedApiBase || 'http://localhost:8317');
  const [managementKey, setManagementKey] = useState('');
  const [remember, setRemember] = useState(rememberPassword);
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  const isConnecting = connectionStatus === 'connecting';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      await login({
        apiBase,
        managementKey,
        rememberPassword: remember,
      });
    } catch (err) {
      setError((err as Error).message || t('auth.connectionError'));
    }
  };

  const handleBrowse = async () => {
    await browseForExe();
  };

  const handleStartServer = async () => {
    setIsStarting(true);
    await startServer();
    setIsStarting(false);
  };

  const handleStopServer = async () => {
    await stopServer();
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="mb-4 flex justify-center">
            <img src="/icon.png" alt="ZeroLimit" className="h-16 w-16 rounded-xl" />
          </div>
          <CardTitle className="text-2xl font-bold">{t('auth.appTitle')}</CardTitle>
          <CardDescription>{t('auth.login')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* CLI Proxy Server Section */}
          <div className="space-y-3 rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">CLI Proxy Server</Label>
              {isServerRunning && (
                <span className="flex items-center gap-1 text-xs text-green-500">
                  <CheckCircle2 className="h-3 w-3" />
                  Running
                </span>
              )}
            </div>

            {exePath ? (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground truncate" title={exePath}>
                  {exePath}
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleBrowse}
                    className="flex-1"
                  >
                    <FolderOpen className="mr-2 h-3 w-3" />
                    Change
                  </Button>
                  {isServerRunning ? (
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={handleStopServer}
                      className="flex-1"
                    >
                      <Square className="mr-2 h-3 w-3" />
                      Stop
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="default"
                      size="sm"
                      onClick={handleStartServer}
                      disabled={isStarting}
                      className="flex-1"
                    >
                      {isStarting ? (
                        <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                      ) : (
                        <Play className="mr-2 h-3 w-3" />
                      )}
                      Start
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleBrowse}
                className="w-full"
              >
                <FolderOpen className="mr-2 h-4 w-4" />
                Browse for cli-proxy-api.exe
              </Button>
            )}
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="apiBase">{t('auth.apiBase')}</Label>
              <div className="relative">
                <Server className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="apiBase"
                  type="url"
                  placeholder={t('auth.apiBasePlaceholder')}
                  value={apiBase}
                  onChange={(e) => setApiBase(e.target.value)}
                  className="pl-10"
                  disabled={isConnecting}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="managementKey">{t('auth.managementKey')}</Label>
              <div className="relative">
                <Key className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="managementKey"
                  type="password"
                  placeholder={t('auth.managementKeyPlaceholder')}
                  value={managementKey}
                  onChange={(e) => setManagementKey(e.target.value)}
                  className="pl-10"
                  disabled={isConnecting}
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <input
                id="remember"
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="h-4 w-4 rounded border-input"
                disabled={isConnecting}
              />
              <Label htmlFor="remember" className="cursor-pointer text-sm font-normal">
                {t('auth.rememberMe')}
              </Label>
            </div>

            {(error || connectionError) && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error || connectionError}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={isConnecting || !apiBase || !managementKey}>
              {isConnecting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('auth.connecting')}
                </>
              ) : (
                t('auth.login')
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
