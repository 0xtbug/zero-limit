import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'motion/react'
import {
  Card,
  CardContent,
} from '@/shared/components/ui/card'

import { Button } from '@/shared/components/ui/button'
import { ScrollArea, ScrollBar } from '@/shared/components/ui/scroll-area'
import { Trash2, AlertCircle, FileText, Download, RotateCcw, EyeOff, Code, Clock, AlertTriangle } from 'lucide-react'
import { Switch } from '@/shared/components/ui/switch'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { cn } from '@/shared/lib/utils'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/shared/components/ui/sheet'
import { useConfigStore } from '@/features/settings/config.store'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/shared/components/ui/tabs'

import { useLogsPresenter, LogTab } from './useLogsPresenter'

function formatBytes(bytes: number, decimals = 2) {
  if (!+bytes) return '0 Bytes'
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`
}

function formatDate(unixSecs: number) {
  return new Date(unixSecs * 1000).toLocaleString()
}

export function LogsPage() {
  const { t } = useTranslation()
  const {
    activeTab,
    setActiveTab,
    errorLogs,
    isErrorLogsLoading,
    isServerLogsLoading,
    selectedErrorLog,
    isViewingErrorLog,
    setIsViewingErrorLog,
    isDeleting,
    fetchErrorLogs,
    fetchServerLogs,
    saveErrorLog,
    deleteLogs,
    searchQuery,
    setSearchQuery,
    hideManagementLogs,
    setHideManagementLogs,
    showRawLogs,
    setShowRawLogs,
    autoRefresh,
    setAutoRefresh,
    parsedServerLogs,
  } = useLogsPresenter()

  const logsEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (autoRefresh) {
      logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [parsedServerLogs.items, autoRefresh])

  const { config: appConfig, fetchConfig: fetchAppConfig } = useConfigStore()
  const loggingEnabled = Boolean(appConfig?.['logging-to-file'] ?? false)

  useEffect(() => {
    if (!appConfig) fetchAppConfig()
  }, [appConfig, fetchAppConfig])

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6 max-w-7xl mx-auto"
    >
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{t('logs.title')}</h2>
        </div>
        <div className="flex items-center gap-2">
          {activeTab === 'server' && (
            <Button variant="outline" size="sm" onClick={async () => {
              try {
                const { save } = await import('@tauri-apps/plugin-dialog')
                const { writeTextFile } = await import('@tauri-apps/plugin-fs')
                const content = parsedServerLogs.items.map(i => i.original).join('\n')
                const defaultName = `server-logs-${new Date().toISOString().replace(/:/g, '-')}.log`
                const filePath = await save({
                  defaultPath: defaultName,
                  filters: [{ name: 'Log Files', extensions: ['log', 'txt'] }],
                })
                if (filePath) {
                  await writeTextFile(filePath, content)
                  const { toast } = await import('sonner')
                  toast.success(t('logs.saved'), { description: filePath })
                }
              } catch (err) {
                console.error('Failed to save logs:', err)
                const { toast } = await import('sonner')
                toast.error(t('logs.saveFailed'))
              }
            }}>
              <Download className="w-4 h-4 mr-2" />
              {t('logs.downloadLogs')}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (activeTab === 'error') fetchErrorLogs()
              else fetchServerLogs()
            }}
            disabled={isErrorLogsLoading || isServerLogsLoading}
          >
            <RotateCcw className={`h-4 w-4 mr-2 ${(isErrorLogsLoading || isServerLogsLoading) ? 'animate-spin' : ''}`} />
            {t('common.refresh')}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={deleteLogs}
            disabled={isDeleting}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            {t('logs.clearLogs')}
          </Button>
        </div>
      </div>

      {!loggingEnabled && (
        <div className="flex items-center gap-3 rounded-lg border border-yellow-900/50 bg-yellow-950/20 p-3 text-sm text-yellow-400">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          <span>{t('logs.loggingDisabled')}</span>
        </div>
      )}

      <Tabs
        value={activeTab}
        onValueChange={(val) => setActiveTab(val as LogTab)}
        className="w-full"
      >
        <TabsList className="w-fit justify-start">
          <TabsTrigger value="server">
            <FileText className="w-4 h-4 mr-2" />
            {t('logs.serverLogs')}
          </TabsTrigger>
          <TabsTrigger value="error">
            <AlertCircle className="w-4 h-4 mr-2" />
            {t('logs.errorLogs')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="error" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground mb-4">
                {t('logs.errorLogsDesc')}
              </p>
              {isErrorLogsLoading ? (
                <div className="flex justify-center p-8 text-sm text-muted-foreground animate-pulse">
                  {t('logs.loadingErrorLogs')}
                </div>
              ) : errorLogs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <AlertCircle className="h-12 w-12 text-muted-foreground mb-4 opacity-20" />
                  <h3 className="text-lg font-medium">{t('logs.noErrorLogs')}</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {t('logs.noErrorLogsDesc')}
                  </p>
                </div>
              ) : (
                <ScrollArea style={{ height: 'calc(100vh - 300px)' }}>
                  <div className="space-y-3 pr-4">
                    {errorLogs.map((log) => (
                      <div
                        key={log.name}
                        className="flex items-center justify-between rounded-lg border bg-card p-4 hover:bg-muted/30 transition-colors"
                      >
                        <div className="flex flex-col gap-1 min-w-0 flex-1 mr-4">
                          <span className="text-sm font-medium font-mono truncate">{log.name}</span>
                          <span className="text-xs text-muted-foreground font-mono">
                            {formatBytes(log.size)}{' '}{formatDate(log.modified)}
                          </span>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => saveErrorLog(log.name)}
                        >
                          {t('common.download')}
                        </Button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="server" className="mt-4 flex flex-col gap-4">
          <Card className="flex-1 flex flex-col overflow-hidden border-border/50">
            <ScrollArea className="border-b bg-muted/20">
              <div className="px-4 py-2.5 flex items-center gap-3">
                <Input
                  placeholder={t('logs.searchPlaceholder')}
                  className="h-8 w-48 text-xs bg-background/50 flex-shrink-0"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <Switch id="hide-mgmt-log" checked={hideManagementLogs} onCheckedChange={setHideManagementLogs} />
                  <Label htmlFor="hide-mgmt-log" className="flex items-center gap-1 cursor-pointer text-xs whitespace-nowrap"><EyeOff className="w-3 h-3"/> {t('logs.hideMgmtLogs')}</Label>
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <Switch id="show-raw" checked={showRawLogs} onCheckedChange={setShowRawLogs} />
                  <Label htmlFor="show-raw" className="flex items-center gap-1 cursor-pointer text-xs whitespace-nowrap"><Code className="w-3 h-3"/> {t('logs.showRawLogs')}</Label>
                </div>

                <div className="flex-1 min-w-4" />

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <Switch id="auto-refresh" checked={autoRefresh} onCheckedChange={setAutoRefresh} />
                  <Label htmlFor="auto-refresh" className="flex items-center gap-1 cursor-pointer text-xs whitespace-nowrap"><Clock className="w-3 h-3"/> {t('logs.autoRefresh')}</Label>
                </div>
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>

            <CardContent className="p-0 bg-[#121212]">
              <div style={{ height: 'calc(100vh - 280px)' }}>
                <ScrollArea className="h-full w-full">
                <div className="flex items-center justify-between p-3 text-xs text-muted-foreground/50 border-b border-zinc-900/50 bg-[#121212] sticky top-0 z-10 w-full backdrop-blur-sm">
                  <span className="italic">{t('logs.scrollUp')}</span>
                  <div className="flex gap-6 font-medium tracking-wide">
                    <span>{t('logs.loaded')}: <span className="text-foreground">{parsedServerLogs.stats.loaded}</span></span>
                    <span>{t('logs.filtered')}: <span className="text-foreground">{parsedServerLogs.stats.filtered}</span></span>
                    <span>{t('logs.hidden')}: <span className="text-foreground">{parsedServerLogs.stats.hidden}</span></span>
                  </div>
                </div>
                {isServerLogsLoading && parsedServerLogs.items.length === 0 ? (
                  <div className="flex justify-center p-8 text-sm text-muted-foreground animate-pulse">
                    {t('logs.loadingServerLogs')}
                  </div>
                ) : showRawLogs ? (
                  <div className="p-4">
                    <pre className="text-xs text-zinc-300 font-mono whitespace-pre-wrap leading-relaxed">
                      {parsedServerLogs.items.length > 0
                        ? parsedServerLogs.items.map(i => i.original).join('\n')
                        : t('logs.noLogsAvailable')}
                    </pre>
                  </div>
                ) : (
                  <div className="flex flex-col pb-4">
                    {parsedServerLogs.items.length > 0 ? parsedServerLogs.items.map((log, i) => (
                      <div key={i} className={cn(
                        "flex gap-4 px-4 py-2 hover:bg-[#1a1a1a] border-b border-zinc-900/50 group text-[11px] font-mono leading-relaxed items-start",
                        (log.level === 'ERROR' || log.level === 'FATAL' || log.level === 'PANIC') && "border-l-2 border-l-red-500 bg-red-950/10"
                      )}>
                          <div className="w-[140px] flex-shrink-0 text-zinc-500 whitespace-nowrap">{log.timestamp}</div>
                          <div className="w-[60px] flex-shrink-0 flex items-center">
                            <span className={cn(
                              "px-2 py-[2px] rounded-full text-[9px] uppercase font-bold tracking-widest border border-transparent",
                              log.level === 'INFO' ? "border-zinc-700/50 text-zinc-300 bg-zinc-800/30" :
                              log.level === 'DEBUG' ? "border-zinc-700/30 text-zinc-500 bg-zinc-800/10" :
                              log.level === 'WARN' ? "border-yellow-900/50 text-yellow-500 bg-yellow-900/20" :
                              log.level === 'ERROR' || log.level === 'FATAL' || log.level === 'PANIC' ? "border-red-900/50 text-red-500 bg-red-900/20" :
                              "border-zinc-800 text-zinc-400"
                            )}>{log.level}</span>
                          </div>
                          <div className="w-[180px] flex-shrink-0 text-zinc-500 truncate" title={log.source}>{log.source}</div>
                          <div className={cn(
                            "flex-1 whitespace-pre-wrap break-all",
                            log.level === 'ERROR' || log.level === 'FATAL' || log.level === 'PANIC' ? "text-red-400" :
                            log.level === 'WARN' ? "text-yellow-400" :
                            "text-zinc-300"
                          )}>{log.message}</div>
                      </div>
                    )) : (
                      <div className="p-8 text-center text-zinc-500 flex flex-col items-center gap-2">
                        <FileText className="w-8 h-8 opacity-20" />
                        <p>{t('logs.noMatchingLogs')}</p>
                      </div>
                    )}
                    <div ref={logsEndRef} />
                  </div>
                )}
                </ScrollArea>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Sheet open={isViewingErrorLog} onOpenChange={setIsViewingErrorLog}>
        <SheetContent side="right" className="w-[90vw] sm:max-w-2xl overflow-hidden flex flex-col p-0 border-l border-border/40 shadow-2xl">
          <div className="p-6 pb-4 border-b bg-muted/30">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2 text-xl">
                <AlertCircle className="h-5 w-5 text-destructive" />
                {t('logs.errorPayloadTitle')}
              </SheetTitle>
              <SheetDescription className="break-all font-mono text-xs">
                {selectedErrorLog?.name}
              </SheetDescription>
            </SheetHeader>
          </div>
          <div className="flex-1 overflow-hidden p-6">
            <ScrollArea className="h-full w-full rounded-md border bg-zinc-950 p-4">
              <pre className="text-xs font-mono text-zinc-300 whitespace-pre-wrap leading-relaxed break-words">
                {selectedErrorLog?.content || t('common.loading')}
              </pre>
            </ScrollArea>
          </div>
          <div className="p-4 border-t bg-muted/30 flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (selectedErrorLog) {
                  const blob = new Blob([selectedErrorLog.content], { type: 'text/plain' })
                  const url = window.URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = selectedErrorLog.name
                  document.body.appendChild(a)
                  a.click()
                  window.URL.revokeObjectURL(url)
                  document.body.removeChild(a)
                }
              }}
            >
              <Download className="h-4 w-4 mr-2" />
              {t('logs.downloadRaw')}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </motion.div>
  )
}
