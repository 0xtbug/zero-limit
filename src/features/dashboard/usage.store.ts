/**
 * Usage Statistics Store
 */

import { create } from 'zustand';
import type { UsageResponse } from '@/types';
import { usageApi } from '@/services/api/usage';

interface UsageState {
  usage: UsageResponse | null;
  loading: boolean;
  error: string | null;
  lastFetched: number | null;

  // Actions
  fetchUsage: () => Promise<void>;
  clearUsage: () => void;
}

export const useUsageStore = create<UsageState>()((set, get) => ({
  // Initial state
  usage: null,
  loading: false,
  error: null,
  lastFetched: null,

  // Fetch usage data
  fetchUsage: async () => {
    // Avoid duplicate requests if already loading
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

  // Clear usage data
  clearUsage: () => {
    set({
      usage: null,
      loading: false,
      error: null,
      lastFetched: null
    });
  }
}));
