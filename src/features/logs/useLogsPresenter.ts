import { useState, useCallback, useEffect, useMemo } from 'react'
import { logsApi, type LogFile, type ServerLogsResponse } from '@/services/api/logs.service'
import { toast } from 'sonner'
import { save } from '@tauri-apps/plugin-dialog'
import { writeTextFile } from '@tauri-apps/plugin-fs'

export type LogTab = 'server' | 'error'

export interface ParsedLog {
  timestamp: string
  level: string
  source: string
  message: string
  original: string
}

export function useLogsPresenter() {
  const [activeTab, setActiveTab] = useState<LogTab>('server')

  // State for Error Logs
  const [errorLogs, setErrorLogs] = useState<LogFile[]>([])
  const [isErrorLogsLoading, setIsErrorLogsLoading] = useState(false)
  const [selectedErrorLog, setSelectedErrorLog] = useState<{ name: string; content: string } | null>(null)
  const [isViewingErrorLog, setIsViewingErrorLog] = useState(false)

  // State for Server Logs
  const [serverLogs, setServerLogs] = useState<ServerLogsResponse | null>(null)
  const [isServerLogsLoading, setIsServerLogsLoading] = useState(false)

  // Advanced Filtering State
  const [searchQuery, setSearchQuery] = useState('')
  const [hideManagementLogs, setHideManagementLogs] = useState(true)
  const [showRawLogs, setShowRawLogs] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(true)

  const [isDeleting, setIsDeleting] = useState(false)

  const fetchErrorLogs = useCallback(async () => {
    setIsErrorLogsLoading(true)
    try {
      const files = await logsApi.listErrorLogs()
      setErrorLogs(files)
    } catch (error) {
      console.error('Failed to fetch error logs:', error)
      toast.error('Error fetching logs', {
        description: 'Could not load error logs from server.',
      })
    } finally {
      setIsErrorLogsLoading(false)
    }
  }, [toast])

  const fetchServerLogs = useCallback(async () => {
    setIsServerLogsLoading(true)
    try {
      const logs = await logsApi.getServerLogs()
      setServerLogs(logs)
    } catch (error) {
      console.error('Failed to fetch server logs:', error)
      toast.error('Error fetching server logs', {
        description: 'Could not load server logs.',
      })
    } finally {
      setIsServerLogsLoading(false)
    }
  }, [toast])

  const viewErrorLog = useCallback(async (name: string) => {
    try {
      const content = await logsApi.downloadErrorLog(name)
      setSelectedErrorLog({ name, content })
      setIsViewingErrorLog(true)
    } catch (error) {
      console.error('Failed to view error log:', error)
      toast.error('Error reading log', {
        description: `Failed to load details for ${name}.`,
      })
    }
  }, [])

  const saveErrorLog = useCallback(async (name: string) => {
    try {
      const content = await logsApi.downloadErrorLog(name)
      const filePath = await save({
        defaultPath: name,
        filters: [{ name: 'Log Files', extensions: ['log', 'txt'] }],
      })
      if (filePath) {
        await writeTextFile(filePath, content)
        toast.success('File saved', {
          description: `Saved to ${filePath}`,
        })
      }
    } catch (error) {
      console.error('Failed to save error log:', error)
      toast.error('Error saving log', {
        description: `Failed to save ${name}.`,
      })
    }
  }, [])

  const deleteLogs = useCallback(async () => {
    setIsDeleting(true)
    try {
      const res = await logsApi.deleteLogs()
      if (res.success) {
        toast.success('Logs cleared', {
          description: `Successfully deleted log files.`,
        })
        fetchErrorLogs()
        fetchServerLogs()
      }
    } catch (error) {
      console.error('Failed to clear logs:', error)
      toast.error('Error clearing logs', {
        description: 'Failed to delete logs.',
      })
    } finally {
      setIsDeleting(false)
    }
  }, [fetchErrorLogs, fetchServerLogs])

  useEffect(() => {
    if (activeTab === 'error') {
      fetchErrorLogs()
    } else {
      fetchServerLogs()
    }
  }, [activeTab, fetchErrorLogs, fetchServerLogs])

  useEffect(() => {
    if (activeTab !== 'server' || !autoRefresh) return
    const interval = setInterval(() => {
      fetchServerLogs()
    }, 5000)
    return () => clearInterval(interval)
  }, [activeTab, autoRefresh, fetchServerLogs])

  const parsedServerLogs = useMemo(() => {
    const rawLines = serverLogs?.lines || []
    let loaded = rawLines.length
    let filtered = 0
    let hidden = 0

    const items: ParsedLog[] = []

    for (const line of rawLines) {
      if (!line.trim()) continue

      if (hideManagementLogs && line.includes('/management/')) {
        hidden++
        continue
      }

      const lowerLine = line.toLowerCase()
      if (searchQuery && !lowerLine.includes(searchQuery.toLowerCase())) {
        filtered++
        continue
      }

      // Handle CLIProxy format:
      // [2026-02-22 05:01:35] [--------] [info ] [events.go:152] auth file changed (WRITE)...
      // or standard format:
      // 2026-02-22 04:30:42        DEBUG   events.go:112 file system event detected...

      const cliMatch = line.match(/^\[(.*?)\]\s+\[(.*?)\]\s+\[\s*(info|debug|warn|error|fatal|panic|trace)\s*\]\s+\[(.*?)\]\s+(.*)$/i)
      const stdMatch = line.match(/^(\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2})\s+(INFO|DEBUG|WARN|ERROR|FATAL|PANIC|TRACE|\[GIN\]|\[[A-Z]+\])\s*(.*?\.go:\d+|\S+)?\s+(.*)$/i)

      if (cliMatch) {
        items.push({
          timestamp: cliMatch[1],
          level: cliMatch[3]?.trim().toUpperCase(),
          source: cliMatch[4] || '',
          message: cliMatch[5] || '',
          original: line,
        })
      } else if (stdMatch) {
        items.push({
          timestamp: stdMatch[1],
          level: stdMatch[2]?.trim().toUpperCase(),
          source: stdMatch[3] || '',
          message: stdMatch[4] || '',
          original: line,
        })
      } else {
        items.push({
          timestamp: '',
          level: 'LOG',
          source: '',
          message: line,
          original: line,
        })
      }
    }

    return {
      items,
      stats: {
        loaded,
        filtered,
        hidden
      }
    }
  }, [serverLogs?.lines, hideManagementLogs, searchQuery])

  return {
    activeTab,
    setActiveTab,
    errorLogs,
    isErrorLogsLoading,
    serverLogs,
    isServerLogsLoading,
    selectedErrorLog,
    isViewingErrorLog,
    setIsViewingErrorLog,
    isDeleting,
    searchQuery,
    setSearchQuery,
    hideManagementLogs,
    setHideManagementLogs,
    showRawLogs,
    setShowRawLogs,
    autoRefresh,
    setAutoRefresh,
    parsedServerLogs,
    fetchErrorLogs,
    fetchServerLogs,
    viewErrorLog,
    saveErrorLog,
    deleteLogs,
  }
}
