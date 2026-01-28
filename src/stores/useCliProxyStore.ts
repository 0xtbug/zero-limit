/**
 * CLI Proxy State Store
 *
 * Manages the CLI Proxy executable path and server status
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';

const STORAGE_KEY = 'cli-proxy-config';

interface CliProxyState {
  exePath: string | null;
  isServerRunning: boolean;
  isApiHealthy: boolean;
  autoStart: boolean;
  runInBackground: boolean;
  serverPid: number | null;

  setExePath: (path: string | null) => void;
  setAutoStart: (autoStart: boolean) => void;
  setRunInBackground: (runInBackground: boolean) => void;
  browseForExe: () => Promise<string | null>;
  startServer: () => Promise<boolean>;
  stopServer: () => Promise<void>;
  checkServerStatus: () => Promise<boolean>;
  checkApiHealth: (apiBase?: string) => Promise<boolean>;
}

export const useCliProxyStore = create<CliProxyState>()(
  persist(
    (set, get) => ({
      exePath: null,
      isServerRunning: false,
      isApiHealthy: false,
      autoStart: false,
      runInBackground: false,
      serverPid: null,

      setExePath: (path) => set({ exePath: path }),

      setAutoStart: (autoStart) => set({ autoStart }),

      setRunInBackground: (runInBackground) => {
        set({ runInBackground });
        // Sync with Rust backend
        invoke('set_run_in_background', { enabled: runInBackground }).catch(console.error);
      },

      browseForExe: async () => {
        try {
          const file = await open({
            multiple: false,
            filters: [{
              name: 'Executable',
              extensions: ['exe']
            }]
          });

          if (file && typeof file === 'string') {
            set({ exePath: file });
            return file;
          }
          return null;
        } catch (err) {
          console.error('Failed to open file dialog:', err);
          return null;
        }
      },

      startServer: async () => {
        const { exePath, isServerRunning } = get();

        if (!exePath || isServerRunning) {
          return false;
        }

        try {
          const pid = await invoke<number>('start_cli_proxy', { exePath });

          set({
            isServerRunning: true,
            serverPid: pid
          });

          return true;
        } catch (err) {
          console.error('Failed to start server:', err);
          return false;
        }
      },

      stopServer: async () => {
        try {
          await invoke('stop_cli_proxy');
        } catch (err) {
          console.error('Failed to stop server:', err);
        }

        set({
          isServerRunning: false,
          isApiHealthy: false,
          serverPid: null
        });
      },

      checkServerStatus: async () => {
        try {
          const running = await invoke<boolean>('is_cli_proxy_running');
          set({ isServerRunning: running });
          return running;
        } catch (err) {
          console.error('Failed to check server status:', err);
          return false;
        }
      },

      checkApiHealth: async (apiBase?: string) => {
        try {
          // Default to localhost if no apiBase provided
          let baseUrl = apiBase || 'http://localhost:8317';
          // Remove trailing slash and /v0/management paths
          baseUrl = baseUrl.replace(/\/?v0\/management\/?$/i, '').replace(/\/+$/, '');
          // Remove protocol if missing, add http
          if (!/^https?:\/\//i.test(baseUrl)) {
            baseUrl = `http://${baseUrl}`;
          }

          const response = await fetch(baseUrl, {
            method: 'GET',
            headers: { 'Accept': 'application/json' },
            signal: AbortSignal.timeout(5000)
          });

          if (response.ok) {
            const data = await response.json();
            // Check for CLI Proxy API signature
            const isHealthy = data?.message === 'CLI Proxy API Server' || Array.isArray(data?.endpoints);
            set({ isApiHealthy: isHealthy });
            return isHealthy;
          }
          set({ isApiHealthy: false });
          return false;
        } catch (err) {
          console.error('API health check failed:', err);
          set({ isApiHealthy: false });
          return false;
        }
      },
    }),
    {
      name: STORAGE_KEY,
      partialize: (state) => ({
        exePath: state.exePath,
        autoStart: state.autoStart,
        runInBackground: state.runInBackground,
      }),
    }
  )
);
