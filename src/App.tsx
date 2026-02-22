import { useEffect } from 'react'
import { useAuthStore } from '@/features/auth/auth.store'
import { useThemeStore } from '@/features/settings/theme.store'
import { useCliProxyStore } from '@/features/settings/cliProxy.store'
import { useUpdateStore } from '@/features/about/update.store'
import { ProtectedRoute } from '@/router/ProtectedRoute'
import { MainRoutes } from '@/router/MainRoutes'
import { LoginPage } from '@/features/auth/LoginPage'
import { OnboardingFlow } from '@/features/onboarding/OnboardingFlow'
import Default from './layouts/DefaultLayout'
import { invoke } from '@tauri-apps/api/core'
import { Toaster } from '@/shared/components/ui/sonner'

function App() {
  const { isAuthenticated, restoreSession, connectionStatus } = useAuthStore()
  const { theme, setTheme } = useThemeStore()
  const { exePath, autoStart, runInBackground, startServer, hasCompletedOnboarding, checkForProxyUpdate } = useCliProxyStore()
  const { checkForUpdates } = useUpdateStore()

  useEffect(() => {
    restoreSession()
    setTheme(theme)

    invoke('set_run_in_background', { enabled: runInBackground }).catch(console.error)
    if (autoStart && exePath) {
      startServer()
    }

    checkForUpdates().catch(() => {
    })
    checkForProxyUpdate().catch(() => {})
  }, [])

  if (connectionStatus === 'connecting') {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!isAuthenticated) {
    if (!hasCompletedOnboarding) {
       return <OnboardingFlow />
    }
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
