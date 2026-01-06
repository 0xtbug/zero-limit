/**
 * Config API
 */

import { apiClient } from './client';
import type { Config } from '@/types';

export const configApi = {
  /**
   * Get configuration
   */
  async getConfig(): Promise<Config> {
    const raw = await apiClient.get('/config');
    return { ...raw, raw };
  },
};
