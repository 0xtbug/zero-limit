/**
 * Protected Route Component
 */

import { type ReactNode } from 'react';
import { useAuthStore } from '@/features/auth/auth.store';

interface ProtectedRouteProps {
  children: ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, connectionStatus } = useAuthStore();

  // Show loading while checking auth
  if (connectionStatus === 'connecting') {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return null; // App.tsx handles showing LoginPage
  }

  return <>{children}</>;
}
