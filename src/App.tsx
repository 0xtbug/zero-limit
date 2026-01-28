import { useEffect } from 'react'
import { useAuthStore, useThemeStore, useCliProxyStore, useUpdateStore } from '@/stores'
import { ProtectedRoute } from '@/router/ProtectedRoute'
import { MainRoutes } from '@/router/MainRoutes'
import { LoginPage } from '@/pages/LoginPage'
import Default from './layouts/default'
import { invoke } from '@tauri-apps/api/core'
import { Toaster } from '@/components/ui/sonner'

function App() {
  const { isAuthenticated, restoreSession, connectionStatus } = useAuthStore()
  const { theme, setTheme } = useThemeStore()
  const { exePath, autoStart, runInBackground, startServer } = useCliProxyStore()
  const { checkForUpdates } = useUpdateStore()

  useEffect(() => {
    restoreSession()
    // Apply theme immediately on app load
    setTheme(theme)

    // Sync runInBackground setting to Rust backend on startup
    invoke('set_run_in_background', { enabled: runInBackground }).catch(console.error)

    // Auto-start CLI Proxy ONLY if autoStart is enabled AND exePath is set
    if (autoStart && exePath) {
      startServer()
    }

    // Check for updates in background on startup
    checkForUpdates().catch(() => {
      // Silently ignore update check errors on startup
    })
  }, []) // Only run once on mount

  // Show loading during session restore
  if (connectionStatus === 'connecting') {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <LoginPage />
  }

  return (
    <Default>
      <ProtectedRoute>
        <MainRoutes />
      </ProtectedRoute>
      <Toaster position="top-right" />
    </Default>
  )
}

export default App
