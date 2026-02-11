/**
 * Settings Page
 */

import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useThemeStore } from '@/features/settings/theme.store';
import { useLanguageStore } from '@/features/settings/language.store';
import { useAuthStore } from '@/features/auth/auth.store';
import { useCliProxyStore } from '@/features/settings/cliProxy.store';
import { useConfigStore } from '@/features/settings/config.store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Label } from '@/shared/components/ui/label';
import { Sun, Moon, Monitor, LogOut, Globe, Server, FolderOpen, Play, Square, CheckCircle2, BarChart3, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export function SettingsPage() {
  const { t } = useTranslation();
  const { theme, setTheme } = useThemeStore();
  const { language, setLanguage } = useLanguageStore();
  const { logout, connectionStatus } = useAuthStore();
  const { exePath, autoStart, runInBackground, isServerRunning, setAutoStart, setRunInBackground, browseForExe, startServer, stopServer } = useCliProxyStore();
  const { config, fetchConfig, updateUsageStatistics, updatingUsageStats } = useConfigStore();

  useEffect(() => {
    if (connectionStatus === 'connected' && !config) {
      fetchConfig();
    }
  }, [connectionStatus, config, fetchConfig]);

  const usageStatisticsEnabled = Boolean(config?.['usage-statistics-enabled'] ?? true);

  const handleToggleUsageStats = async () => {
    try {
      await updateUsageStatistics(!usageStatisticsEnabled);
    } catch {
      toast.error(t('settings.usageStatsError'));
    }
  };

  const themeOptions = [
    { value: 'light', label: t('settings.light'), icon: Sun },
    { value: 'dark', label: t('settings.dark'), icon: Moon },
    { value: 'system', label: t('settings.system'), icon: Monitor },
  ] as const;

  const languageOptions = [
    { value: 'en', label: 'English' },
    { value: 'zh-CN', label: '中文' },
    { value: 'id', label: 'Indonesia' },
    { value: 'ja', label: '日本語' },
    { value: 'ko', label: '한국어' },
    { value: 'vi', label: 'Tiếng Việt' },
    { value: 'th', label: 'ไทย' },
  ] as const;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t('settings.title')}</h1>
      </div>

      {/* CLI Proxy Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            {t('cliProxy.title')}
          </CardTitle>
          <CardDescription>{t('cliProxy.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Exe Path */}
          <div className="space-y-2">
            <Label>{t('cliProxy.executablePath')}</Label>
            <div className="flex items-center gap-2">
              <div className="flex-1 rounded-md border bg-muted px-3 py-2 text-sm truncate">
                {exePath || t('cliProxy.noPathConfigured')}
              </div>
              <Button variant="outline" size="sm" onClick={browseForExe}>
                <FolderOpen className="mr-2 h-4 w-4" />
                {t('cliProxy.browse')}
              </Button>
            </div>
          </div>

          {/* Auto Start Toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>{t('cliProxy.autoStart')}</Label>
              <p className="text-xs text-muted-foreground">
                {t('cliProxy.autoStartDesc')}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={autoStart}
              onClick={() => setAutoStart(!autoStart)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                autoStart ? 'bg-primary' : 'bg-muted'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  autoStart ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Run in Background Toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>{t('cliProxy.runInBackground')}</Label>
              <p className="text-xs text-muted-foreground">
                {t('cliProxy.runInBackgroundDesc')}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={runInBackground}
              onClick={() => setRunInBackground(!runInBackground)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                runInBackground ? 'bg-primary' : 'bg-muted'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  runInBackground ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Server Status & Controls */}
          <div className="flex items-center justify-between pt-2 border-t">
            <div className="flex items-center gap-2">
              <span className="text-sm">{t('cliProxy.status')}:</span>
              {isServerRunning ? (
                <span className="flex items-center gap-1 text-sm text-green-500">
                  <CheckCircle2 className="h-4 w-4" />
                  {t('cliProxy.running')}
                </span>
              ) : (
                <span className="text-sm text-muted-foreground">{t('cliProxy.stopped')}</span>
              )}
            </div>
            {exePath && (
              isServerRunning ? (
                <Button variant="destructive" size="sm" onClick={stopServer}>
                  <Square className="mr-2 h-4 w-4" />
                  {t('cliProxy.stop')}
                </Button>
              ) : (
                <Button variant="default" size="sm" onClick={startServer}>
                  <Play className="mr-2 h-4 w-4" />
                  {t('cliProxy.start')}
                </Button>
              )
            )}
          </div>
        </CardContent>
      </Card>

      {/* Usage Statistics Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            {t('usageStats.title')}
          </CardTitle>
          <CardDescription>{t('usageStats.settingsDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>{t('usageStats.enabled')}</Label>
              <p className="text-xs text-muted-foreground">
                {t('usageStats.enabledDesc')}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={usageStatisticsEnabled}
              onClick={handleToggleUsageStats}
              disabled={updatingUsageStats || connectionStatus !== 'connected'}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                usageStatisticsEnabled ? 'bg-primary' : 'bg-muted'
              }`}
            >
              {updatingUsageStats ? (
                <Loader2 className="h-4 w-4 animate-spin mx-auto text-muted-foreground" />
              ) : (
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    usageStatisticsEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              )}
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Theme Settings */}
      <Card>
        <CardHeader>
          <CardTitle>{t('settings.theme')}</CardTitle>
          <CardDescription>{t('settings.themeDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            {themeOptions.map((option) => (
              <Button
                key={option.value}
                variant={theme === option.value ? 'default' : 'outline'}
                onClick={() => setTheme(option.value)}
                className="flex items-center gap-2"
              >
                <option.icon className="h-4 w-4" />
                {option.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Language Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            {t('settings.language')}
          </CardTitle>
          <CardDescription>{t('settings.languageDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 flex-wrap">
            {languageOptions.map((option) => (
              <Button
                key={option.value}
                variant={language === option.value ? 'default' : 'outline'}
                onClick={() => setLanguage(option.value)}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Account */}
      <Card>
        <CardHeader>
          <CardTitle>{t('account.title')}</CardTitle>
          <CardDescription>{t('account.manageSession')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={logout} className="flex items-center gap-2">
            <LogOut className="h-4 w-4" />
            {t('auth.logout')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
