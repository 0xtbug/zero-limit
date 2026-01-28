/**
 * Tauri Service
 * Wraps Tauri invoke calls for type-safe frontend usage
 */

import { invoke } from '@tauri-apps/api/core';

/**
 * Open URL in system browser
 */
export async function openExternalUrl(url: string): Promise<void> {
  return invoke<void>('open_external_url', { url });
}

/**
 * Check if running in Tauri context
 */
export function isTauri(): boolean {
  return '__TAURI_INTERNALS__' in window;
}

/**
 * Run Kiro CLI authentication
 * @param exePath Path to CLI proxy executable
 * @param authMethod 'google' | 'aws' | 'aws-authcode' | 'import'
 */
export async function runKiroAuth(exePath: string, authMethod: string): Promise<string> {
  return invoke<string>('run_kiro_auth', { exePath, authMethod });
}
