/**
 * Auth Files API
 */

import { apiClient } from './client';
import type { AuthFilesResponse } from '@/types';

export const authFilesApi = {
  list: () => apiClient.get<AuthFilesResponse>('/auth-files'),

  deleteFile: (name: string) => apiClient.delete(`/auth-files?name=${encodeURIComponent(name)}`),
};
