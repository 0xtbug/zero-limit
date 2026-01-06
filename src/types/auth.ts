/**
 * Authentication Types
 */

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface AuthState {
  isAuthenticated: boolean;
  apiBase: string;
  managementKey: string;
  rememberPassword: boolean;
  serverVersion: string | null;
  serverBuildDate: string | null;
}

export interface LoginCredentials {
  apiBase: string;
  managementKey: string;
  rememberPassword?: boolean;
}
