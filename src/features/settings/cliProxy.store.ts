import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { STORAGE_KEY_CLI_PROXY } from '@/constants';

// Semantic version comparison (from Management Center)
function parseVersionSegments(version?: string | null): number[] | null {
  if (!version) return null;
  const cleaned = version.trim().replace(/^v/i, '');
  if (!cleaned) return null;
  const parts = cleaned.split(/[^0-9]+/).filter(Boolean).map(s => parseInt(s, 10)).filter(Number.isFinite);
  return parts.length ? parts : null;
}

function compareVersions(latest?: string | null, current?: string | null): number | null {
  const latestParts = parseVersionSegments(latest);
  const currentParts = parseVersionSegments(current);
  if (!latestParts || !currentParts) return null;
  const length = Math.max(latestParts.length, currentParts.length);
  for (let i = 0; i < length; i++) {
    const l = latestParts[i] || 0;
    const c = currentParts[i] || 0;
    if (l > c) return 1;
    if (l < c) return -1;
  }
  return 0;
}

interface CliProxyState {
  exePath: string | null;
  isServerRunning: boolean;
  isApiHealthy: boolean;
  autoStart: boolean;
  runInBackground: boolean;
  serverPid: number | null;
  hasCompletedOnboarding: boolean;
  cliProxyMode: 'auto_download' | 'manual' | null;
  cliProxyVersion: 'standard' | 'plus' | null;
  cliProxyLatestVersion: string | null;
  currentInstalledVersion: string | null;
  serverBuildDate: string | null;
  isCheckingUpdate: boolean;
  isUpdating: boolean;
  updateAvailable: boolean;
  latestRemoteVersion: string | null;
  setExePath: (path: string | null) => void;
  setAutoStart: (autoStart: boolean) => void;
  setRunInBackground: (runInBackground: boolean) => void;
  setHasCompletedOnboarding: (completed: boolean) => void;
  setCliProxyMode: (mode: 'auto_download' | 'manual' | null) => void;
  setCliProxyVersion: (version: 'standard' | 'plus' | null) => void;
  setCliProxyLatestVersion: (version: string | null) => void;
  browseForExe: () => Promise<string | null>;
  startServer: () => Promise<boolean>;
  stopServer: () => Promise<void>;
  checkServerStatus: () => Promise<boolean>;
  checkApiHealth: (apiBase?: string) => Promise<boolean>;
  checkForProxyUpdate: () => Promise<boolean>;
  updateProxy: () => Promise<boolean>;
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
      hasCompletedOnboarding: false,
      cliProxyMode: null,
      cliProxyVersion: null,
      cliProxyLatestVersion: null,
      currentInstalledVersion: null,
      serverBuildDate: null,
      isCheckingUpdate: false,
      isUpdating: false,
      updateAvailable: false,
      latestRemoteVersion: null,

      setExePath: (path) => set({ exePath: path }),

      setAutoStart: (autoStart) => set({ autoStart }),

      setRunInBackground: (runInBackground) => {
        set({ runInBackground });
        invoke('set_run_in_background', { enabled: runInBackground }).catch(console.error);
      },

      setHasCompletedOnboarding: (hasCompletedOnboarding) => set({ hasCompletedOnboarding }),
      setCliProxyMode: (cliProxyMode) => set({ cliProxyMode }),
      setCliProxyVersion: (cliProxyVersion) => set({ cliProxyVersion }),
      setCliProxyLatestVersion: (cliProxyLatestVersion) => set({ cliProxyLatestVersion }),

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
          let baseUrl = apiBase || 'http://localhost:8317';
          baseUrl = baseUrl.replace(/\/?v0\/management\/?$/i, '').replace(/\/+$/, '');
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

      checkForProxyUpdate: async () => {
        set({ isCheckingUpdate: true });
        try {
          const { useAuthStore } = await import('@/features/auth/auth.store');
          const { apiBase, managementKey } = useAuthStore.getState();
          if (!apiBase || !managementKey) {
            throw new Error('Not logged in — cannot check for updates.');
          }

          const baseUrl = apiBase.replace(/\/?v0\/management\/?$/i, '').replace(/\/+$/, '');

          const info = await invoke<{
            current_version: string | null;
            build_date: string | null;
            latest_version: string | null;
          }>('check_proxy_version', { apiBase: baseUrl, managementKey });

          console.log('[Update Check] Current:', info.current_version, 'Latest:', info.latest_version, 'Build:', info.build_date);

          set({
            currentInstalledVersion: info.current_version,
            serverBuildDate: info.build_date,
            latestRemoteVersion: info.latest_version,
            cliProxyLatestVersion: info.current_version ? `v${info.current_version}` : get().cliProxyLatestVersion,
          });

          // Semantic version comparison
          const comparison = compareVersions(info.latest_version, info.current_version);
          console.log('[Update Check] Comparison result:', comparison);
          const hasUpdate = comparison !== null && comparison > 0;
          set({ updateAvailable: hasUpdate });
          return hasUpdate;
        } catch (err) {
          console.error('Update check failed:', err);
          throw err;
        } finally {
          set({ isCheckingUpdate: false });
        }
      },

      updateProxy: async () => {
        const { cliProxyVersion, latestRemoteVersion, isServerRunning } = get();
        if (!latestRemoteVersion) throw new Error('No update version info available. Check for updates first.');
        set({ isUpdating: true });
        try {
          // 1. Stop server if running
          if (isServerRunning) {
            await get().stopServer();
            await new Promise(r => setTimeout(r, 1000));
          }

          // 2. Auto-detect version from exe filename (cli-proxy-api-plus.exe = plus)
          const version = (get().exePath || '').toLowerCase().includes('plus') ? 'plus' : (cliProxyVersion || 'standard');
          set({ cliProxyVersion: version }); // Persist detected version
          const repo = version === 'plus' ? 'CLIProxyAPIPlus' : 'CLIProxyAPI';
          const res = await fetch(`https://api.github.com/repos/router-for-me/${repo}/releases/latest`, {
            headers: { 'User-Agent': 'CLIProxyAPI' },
          });
          if (!res.ok) throw new Error('Failed to fetch release from GitHub');
          const data = await res.json();

          // 3. Find the right asset
          const { type } = await import('@tauri-apps/plugin-os');
          const osType = await type();
          let osName = 'windows';
          if (osType === 'macos') osName = 'darwin';
          if (osType === 'linux') osName = 'linux';
          const searchString = `${osName}_`;
          const asset = data.assets?.find((a: any) =>
            a.name.toLowerCase().includes(searchString) &&
            (a.name.endsWith('.zip') || a.name.endsWith('.tar.gz') || a.name.endsWith('.tgz'))
          );
          if (!asset?.browser_download_url) throw new Error('No compatible asset found for your OS');

          // 4. Download and extract to the same directory as the current exe
          const currentExePath = get().exePath;
          let targetDir: string | null = null;
          if (currentExePath) {
            // Get parent directory of current exe (e.g. C:\CLIProxyAPI\cli-proxy-api.exe → C:\CLIProxyAPI)
            const sep = currentExePath.includes('\\') ? '\\' : '/';
            const lastSep = currentExePath.lastIndexOf(sep);
            if (lastSep > 0) {
              targetDir = currentExePath.substring(0, lastSep);
            }
          }
          const exePath = await invoke<string>('download_and_extract_proxy', {
            url: asset.browser_download_url,
            targetDir,
          });
          if (exePath) {
            set({
              exePath,
              cliProxyLatestVersion: latestRemoteVersion,
              cliProxyVersion: version,
              updateAvailable: false,
            });
          }

          // 5. Restart server
          await get().startServer();
          return true;
        } catch (err) {
          console.error('Update failed:', err);
          throw err;
        } finally {
          set({ isUpdating: false });
        }
      },
    }),
    {
      name: STORAGE_KEY_CLI_PROXY,
      partialize: (state) => ({
        exePath: state.exePath,
        autoStart: state.autoStart,
        runInBackground: state.runInBackground,
        hasCompletedOnboarding: state.hasCompletedOnboarding,
        cliProxyMode: state.cliProxyMode,
        cliProxyVersion: state.cliProxyVersion,
        cliProxyLatestVersion: state.cliProxyLatestVersion,
        currentInstalledVersion: state.currentInstalledVersion,
        serverBuildDate: state.serverBuildDate,
        latestRemoteVersion: state.latestRemoteVersion,
      }),
    }
  )
);
