import { useEffect } from 'react'
import { useAuthStore, useThemeStore, useCliProxyStore } from '@/stores'
import { ProtectedRoute } from '@/router/ProtectedRoute'
import { MainRoutes } from '@/router/MainRoutes'
import { LoginPage } from '@/pages/LoginPage'
import Default from './layouts/default'
import { invoke } from '@tauri-apps/api/core'

function App() {
  const { isAuthenticated, restoreSession, connectionStatus } = useAuthStore()
  const { theme, setTheme } = useThemeStore()
  const { exePath, autoStart, runInBackground, startServer } = useCliProxyStore()

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
    </Default>
  )
}

export default App
