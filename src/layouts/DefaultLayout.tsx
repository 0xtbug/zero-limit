import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '@/shared/components/ui/button'
import {
  Menu,
  X,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react'
import { useState } from 'react'
import { useAuthStore } from '@/features/auth/auth.store'
import { useInterval, useAppVersion } from '@/shared/hooks'
import { NAV_ITEMS } from '@/constants'


function Default({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const { checkAuth } = useAuthStore()
  const version = useAppVersion()

  // Real-time connection check every 5 seconds
  useInterval(() => {
    checkAuth().catch(() => {
        // Errors are handled within the store, status updates automatically
    })
  }, 5000)

  return (
    <div className="flex h-screen bg-background">
        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside
          className={`fixed inset-y-0 left-0 z-50 transform bg-card border-r transition-all duration-300 lg:static lg:translate-x-0 ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          } ${isCollapsed ? 'lg:w-[70px]' : 'lg:w-64'} w-64`}
        >
          <div className={`flex h-16 items-center border-b px-4 ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
            {!isCollapsed && (
              <div className="flex items-center gap-2">
                <img src="/icon.png" alt="ZeroLimit" className="h-8 w-8" />
                <h1 className="text-lg font-bold">ZeroLimit</h1>
              </div>
            )}

            {/* Mobile Close */}
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-5 w-5" />
            </Button>

            {/* Desktop Collapse Toggle */}
            <Button
              variant="ghost"
              size="icon"
              className="hidden lg:flex h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={() => setIsCollapsed(!isCollapsed)}
            >
              {isCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </Button>
          </div>

          <nav className="space-y-2 p-2 pt-4">
            {NAV_ITEMS.map((item) => {
              const isActive = location.pathname === item.path
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setSidebarOpen(false)}
                  title={isCollapsed ? t(item.labelKey) : undefined}
                  className={`flex items-center rounded-lg py-2 transition-colors ${
                    isCollapsed ? 'justify-center px-0' : 'px-3 gap-3'
                  } ${
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-muted'
                  }`}
                >
                  <item.icon className="h-5 w-5 flex-shrink-0" />
                  {!isCollapsed && <span className="text-sm font-medium">{t(item.labelKey)}</span>}
                </Link>
              )
            })}
          </nav>

          {/* Sidebar Footer */}
          <div className={`absolute bottom-0 left-0 right-0 border-t bg-card/50 ${isCollapsed ? 'p-4 flex justify-center' : 'p-4'}`}>
            {isCollapsed ? (
              <img src="/icon.png" alt="ZeroLimit" className="h-8 w-8" />
            ) : (
              <div className="flex items-center gap-2 px-2">
                <span className="text-sm font-medium text-muted-foreground">
                  v{version}
                </span>
              </div>
            )}
          </div>
        </aside>

        {/* Main content */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Mobile header */}
          <header className="flex h-16 items-center border-b px-4 lg:hidden">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            {!isCollapsed && <h1 className="text-lg font-bold">ZeroLimit</h1>}
          </header>

          {/* Page content */}
          <main className="flex-1 overflow-auto no-scrollbar p-6">{children}</main>
      </div>
    </div>
  )
}

export default Default
