import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { RefreshCw, AlertCircle, Loader2, LayoutGrid, List, Eye, EyeOff } from 'lucide-react';
import { ProviderFilter } from '@/features/quota/components/ProviderFilter';
import { ProviderQuotaCard } from '@/features/quota/components/ProviderQuotaCard';
import { CompactQuotaCard } from '@/features/quota/components/CompactQuotaCard';
import { useQuotaPresenter } from '@/features/quota/useQuotaPresenter';

export function QuotaPage() {
  const { t } = useTranslation();
  const {
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
  } = useQuotaPresenter();

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
            onClick={togglePrivacyMode}
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
            onClick={refreshDisplayed}
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
                email={file.email || file.originalFile?.account || '********@*****.com'}
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
                email={file.email || file.originalFile?.account || '********@*****.com'}
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
