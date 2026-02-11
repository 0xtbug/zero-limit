/**
 * Main Routes Definition
 */

import { Navigate, useRoutes, type Location } from 'react-router-dom';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { SettingsPage } from '@/features/settings/SettingsPage';
import { ProvidersPage } from '@/features/providers/ProvidersPage';
import { QuotaPage } from '@/features/quota/QuotaPage';
import { AboutPage } from '@/features/about/AboutPage';

const mainRoutes = [
  { path: '/', element: <DashboardPage /> },
  { path: '/dashboard', element: <DashboardPage /> },
  { path: '/settings', element: <SettingsPage /> },
  { path: '/providers', element: <ProvidersPage /> },
  { path: '/quota', element: <QuotaPage /> },
  { path: '/about', element: <AboutPage /> },
  { path: '*', element: <Navigate to="/" replace /> },
];

export function MainRoutes({ location }: { location?: Location }) {
  return useRoutes(mainRoutes, location);
}
