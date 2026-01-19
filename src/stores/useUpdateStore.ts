/**
 * Update Store
 * Manages app update state and actions
 */

import { create } from 'zustand';
import { check, Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

type UpdateStatus = 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'error';

interface UpdateInfo {
  version: string;
  date: string | null;
  body: string | null;
}

interface UpdateState {
  status: UpdateStatus;
  updateInfo: UpdateInfo | null;
  downloadProgress: number;
  error: string | null;
  pendingUpdate: Update | null;
}

interface UpdateActions {
  checkForUpdates: () => Promise<void>;
  downloadAndInstall: () => Promise<void>;
  reset: () => void;
}

const initialState: UpdateState = {
  status: 'idle',
  updateInfo: null,
  downloadProgress: 0,
  error: null,
  pendingUpdate: null,
};

export const useUpdateStore = create<UpdateState & UpdateActions>((set, get) => ({
  ...initialState,

  checkForUpdates: async () => {
    set({ status: 'checking', error: null });

    try {
      const update = await check();

      if (update) {
        set({
          status: 'available',
          updateInfo: {
            version: update.version,
            date: update.date,
            body: update.body,
          },
          pendingUpdate: update,
        });
      } else {
        set({ status: 'idle', updateInfo: null });
      }
    } catch (error) {
      set({
        status: 'error',
        error: error instanceof Error ? error.message : 'Failed to check for updates',
      });
    }
  },

  downloadAndInstall: async () => {
    const { pendingUpdate } = get();
    if (!pendingUpdate) return;

    set({ status: 'downloading', downloadProgress: 0 });

    try {
      let downloaded = 0;
      let contentLength = 0;

      await pendingUpdate.downloadAndInstall((event) => {
        switch (event.event) {
          case 'Started':
            contentLength = event.data.contentLength ?? 0;
            break;
          case 'Progress':
            downloaded += event.data.chunkLength;
            if (contentLength > 0) {
              set({ downloadProgress: Math.round((downloaded / contentLength) * 100) });
            }
            break;
          case 'Finished':
            set({ status: 'ready', downloadProgress: 100 });
            break;
        }
      });

      // Relaunch the app
      await relaunch();
    } catch (error) {
      set({
        status: 'error',
        error: error instanceof Error ? error.message : 'Failed to install update',
      });
    }
  },

  reset: () => set(initialState),
}));
