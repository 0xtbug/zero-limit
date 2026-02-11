/**
 * Connection Utilities
 */

import { MANAGEMENT_API_PREFIX } from '@/constants';

/**
 * Normalize an API base URL by:
 * - Trimming whitespace
 * - Removing trailing /v0/management path if present
 * - Removing trailing slashes
 * - Adding http:// protocol if missing
 */
export function normalizeApiBase(base: string): string {
  let normalized = base.trim();

  // Remove trailing /v0/management
  normalized = normalized.replace(/\/?v0\/management\/?$/i, '');

  // Remove trailing slashes
  normalized = normalized.replace(/\/+$/, '');

  // Add protocol if missing
  if (!/^https?:\/\//i.test(normalized)) {
    normalized = `http://${normalized}`;
  }

  return normalized;
}

/**
 * Get the full management API URL
 */
export function getManagementApiUrl(base: string): string {
  return `${normalizeApiBase(base)}${MANAGEMENT_API_PREFIX}`;
}

/**
 * Detect API base URL from current browser location
 * Falls back to localhost:8787 for development
 */
export function detectApiBaseFromLocation(): string {
  if (typeof window === 'undefined') {
    return 'http://localhost:8317';
  }

  const { protocol, hostname, port } = window.location;

  // In Tauri, we're likely on tauri://localhost or similar
  // Default to the CLI Proxy's typical port
  if (hostname === 'localhost' || hostname === 'tauri.localhost') {
    return 'http://localhost:8317';
  }

  // Use the current origin for web deployments
  return `${protocol}//${hostname}${port ? `:${port}` : ''}`;
}
