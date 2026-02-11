import { create } from 'zustand';
import { configApi } from '@/services/api/config.service';
import type { Config } from '@/types';
import { CACHE_EXPIRY_MS } from '@/constants';

interface ConfigState {
  config: Config | null;
  loading: boolean;
  error: string | null;
  lastFetch: number;
  updatingUsageStats: boolean;
  fetchConfig: (forceRefresh?: boolean) => Promise<Config>;
  clearCache: () => void;
  updateUsageStatistics: (enabled: boolean) => Promise<void>;
}

let configRequestToken = 0;
let inFlightRequest: { id: number; promise: Promise<Config> } | null = null;

export const useConfigStore = create<ConfigState>((set, get) => ({
  config: null,
  loading: false,
  error: null,
  lastFetch: 0,
  updatingUsageStats: false,

  fetchConfig: async (forceRefresh = false) => {
    const { lastFetch, config } = get();

    if (!forceRefresh && config && Date.now() - lastFetch < CACHE_EXPIRY_MS) {
      return config;
    }

    if (inFlightRequest) {
      return inFlightRequest.promise;
    }

    set({ loading: true, error: null });

    const requestId = (configRequestToken += 1);
    try {
      const requestPromise = configApi.getConfig();
      inFlightRequest = { id: requestId, promise: requestPromise };
      const data = await requestPromise;

      if (requestId !== configRequestToken) {
        return data;
      }

      set({
        config: data,
        loading: false,
        lastFetch: Date.now(),
      });

      return data;
    } catch (error: unknown) {
      if (requestId === configRequestToken) {
        set({
          error: (error as Error).message || 'Failed to fetch config',
          loading: false,
        });
      }
      throw error;
    } finally {
      if (inFlightRequest?.id === requestId) {
        inFlightRequest = null;
      }
    }
  },

  clearCache: () => {
    configRequestToken += 1;
    inFlightRequest = null;
    set({ config: null, loading: false, error: null, lastFetch: 0 });
  },

  updateUsageStatistics: async (enabled: boolean) => {
    set({ updatingUsageStats: true, error: null });
    try {
      await configApi.updateUsageStatistics(enabled);
      const { fetchConfig } = get();
      await fetchConfig(true);
    } catch (error: unknown) {
      set({ error: (error as Error).message || 'Failed to update usage statistics' });
      throw error;
    } finally {
      set({ updatingUsageStats: false });
    }
  },
}));
