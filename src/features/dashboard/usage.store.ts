import { create } from 'zustand';
import type { UsageResponse } from '@/types';
import { usageApi } from '@/services/api/usage.service';

interface UsageState {
  usage: UsageResponse | null;
  loading: boolean;
  error: string | null;
  lastFetched: number | null;
  fetchUsage: () => Promise<void>;
  clearUsage: () => void;
}

export const useUsageStore = create<UsageState>()((set, get) => ({
  usage: null,
  loading: false,
  error: null,
  lastFetched: null,

  fetchUsage: async () => {
    if (get().loading) return;

    set({ loading: true, error: null });

    try {
      const data = await usageApi.getUsage();
      set({
        usage: data,
        loading: false,
        error: null,
        lastFetched: Date.now()
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch usage data';
      set({
        loading: false,
        error: message
      });
    }
  },

  clearUsage: () => {
    set({
      usage: null,
      loading: false,
      error: null,
      lastFetched: null
    });
  }
}));
