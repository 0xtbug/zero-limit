/**
 * Configuration State Store
 */

import { create } from 'zustand';
import { configApi } from '@/services/api/config';
import type { Config } from '@/types';
import { CACHE_EXPIRY_MS } from '@/utils/constants';

interface ConfigState {
  config: Config | null;
  loading: boolean;
  error: string | null;
  lastFetch: number;

  // Actions
  fetchConfig: (forceRefresh?: boolean) => Promise<Config>;
  clearCache: () => void;
}

let configRequestToken = 0;
let inFlightRequest: { id: number; promise: Promise<Config> } | null = null;

export const useConfigStore = create<ConfigState>((set, get) => ({
  config: null,
  loading: false,
  error: null,
  lastFetch: 0,

  fetchConfig: async (forceRefresh = false) => {
    const { lastFetch, config } = get();

    // Return cached if valid
    if (!forceRefresh && config && Date.now() - lastFetch < CACHE_EXPIRY_MS) {
      return config;
    }

    // Dedupe concurrent requests
    if (inFlightRequest) {
      return inFlightRequest.promise;
    }

    set({ loading: true, error: null });

    const requestId = (configRequestToken += 1);
    try {
      const requestPromise = configApi.getConfig();
      inFlightRequest = { id: requestId, promise: requestPromise };
      const data = await requestPromise;

      // Ignore stale requests
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
}));
