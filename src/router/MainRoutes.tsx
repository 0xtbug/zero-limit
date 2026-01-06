/**
 * Main Routes Definition
 */

import { Navigate, useRoutes, type Location } from 'react-router-dom';
import { DashboardPage } from '@/pages/DashboardPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { ProvidersPage } from '@/pages/ProvidersPage';
import { QuotaPage } from '@/pages/QuotaPage';
import { AboutPage } from '@/pages/AboutPage';

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
