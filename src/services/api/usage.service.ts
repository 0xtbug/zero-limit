/**
 * Usage API Service
 */

import { apiClient } from './client';
import type { UsageResponse } from '@/types';

export const usageApi = {
  /**
   * Get usage statistics
   */
  getUsage: async (): Promise<UsageResponse> => {
    return apiClient.get<UsageResponse>('/usage');
  }
};
