/**
 * Dashboard Page
 */

import { useEffect, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore, useConfigStore } from '@/stores';
import { useHeaderRefresh } from '@/hooks';
import { authFilesApi } from '@/services/api/authFiles';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity, Users, TrendingDown } from 'lucide-react';

export function DashboardPage() {
  const { t } = useTranslation();
  const { connectionStatus } = useAuthStore();
  const { fetchConfig } = useConfigStore();

  const [activeAccountsCount, setActiveAccountsCount] = useState<number>(0);

  const loadData = useCallback(async () => {
    try {
      await fetchConfig();
      const response = await authFilesApi.list();
      const filesList = response?.files ?? [];
      setActiveAccountsCount(filesList.length);
    } catch {
      // Error handled by store/api
    }
  }, [fetchConfig]);

  useEffect(() => {
    if (connectionStatus === 'connected') {
      loadData();
    }
  }, [connectionStatus, loadData]);

  useHeaderRefresh(loadData);

  return (
    <div className="space-y-8 animate-fade-in p-2">
      {/* Header Section */}
      <div className="flex flex-col gap-1 mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Hello <span className="text-primary">User</span> 👋
        </h1>
        <p className="text-muted-foreground">
          {t('dashboard.welcomeMessage')}
        </p>
      </div>

      {/* Main Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Total Accounts Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('dashboard.totalAccounts')}</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeAccountsCount}</div>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
              <span>{t('dashboard.totalAccounts')}</span>
            </p>
          </CardContent>
        </Card>

        {/* Connection Status Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('dashboard.systemStatus')}</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-2">
               {connectionStatus === 'connected' ? t('dashboard.status.operational') : t('dashboard.status.offline')}
            </div>
             <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
               {connectionStatus === 'connected' ? (
                   <>
                    <span className="relative flex h-2 w-2 mr-1">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    <span className="text-emerald-500 font-medium">{t('dashboard.status.active')}</span>
                    <span>{t('dashboard.monitoringEnabled')}</span>
                   </>
               ) : (
                    <>
                    <TrendingDown className="h-3 w-3 text-red-500" />
                    <span className="text-red-500 font-medium">{t('dashboard.status.error')}</span>
                    <span>{t('dashboard.checkConnection')}</span>
                   </>
               )}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
