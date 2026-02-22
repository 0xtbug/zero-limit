/**
 * Auth Files API
 */

import { apiClient } from './client';
import type { AuthFilesResponse } from '@/types';

export const authFilesApi = {
  list: () => apiClient.get<AuthFilesResponse>('/auth-files'),

  deleteFile: (name: string) => apiClient.delete(`/auth-files?name=${encodeURIComponent(name)}`),

  deleteAll: () => apiClient.delete('/auth-files?all=true'),

  download: (name: string) => apiClient.get<any>(`/auth-files/download?name=${encodeURIComponent(name)}`),

  upload: (formData: FormData) => apiClient.post<{ status: string }>('/auth-files', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
};
