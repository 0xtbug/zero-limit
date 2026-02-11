import {
  LayoutDashboard,
  BarChart3,
  Users,
  Settings,
  Info,
} from 'lucide-react';

export const NAV_ITEMS = [
  { path: '/dashboard', icon: LayoutDashboard, labelKey: 'nav.dashboard' },
  { path: '/quota', icon: BarChart3, labelKey: 'nav.quota' },
  { path: '/providers', icon: Users, labelKey: 'providers.title' },
  { path: '/settings', icon: Settings, labelKey: 'nav.settings' },
  { path: '/about', icon: Info, labelKey: 'nav.about' },
] as const;

export const ROUTE_PATHS = {
  DASHBOARD: '/dashboard',
  QUOTA: '/quota',
  PROVIDERS: '/providers',
  SETTINGS: '/settings',
  ABOUT: '/about',
  LOGIN: '/login',
} as const;
