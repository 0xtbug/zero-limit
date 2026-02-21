/**
 * Config API
 */

import { apiClient } from './client';
import type { Config } from '@/types';

export const configApi = {
  /**
   * Get configuration (JSON)
   */
  async getConfig(): Promise<Config> {
    const raw = await apiClient.get<Record<string, unknown>>('/config');
    return { ...raw, raw };
  },

  /**
   * Get YAML configuration for editing
   */
  async getConfigYaml(): Promise<string> {
    return await apiClient.get<string>('/config.yaml', {
      headers: { 'Accept': 'application/yaml, text/yaml, text/plain' },
      responseType: 'text',
    });
  },

  /**
   * Update configuration via YAML
   */
  async updateConfigYaml(yamlContent: string): Promise<{ ok: boolean; changed?: string[] }> {
    return await apiClient.put<{ ok: boolean; changed?: string[] }>('/config.yaml', yamlContent, {
      headers: { 'Content-Type': 'application/yaml' },
    });
  },

  /**
   * Update usage statistics enabled setting
   */
  async updateUsageStatistics(enabled: boolean): Promise<{ ok: boolean; changed?: string[] }> {
    const yamlContent = await this.getConfigYaml();
    const updatedYaml = yamlContent.replace(
      /^usage-statistics-enabled:\s*(true|false)$/m,
      `usage-statistics-enabled: ${enabled}`
    );
    return await this.updateConfigYaml(updatedYaml);
  },

  /**
   * Update logging-to-file setting
   */
  async updateLoggingToFile(enabled: boolean): Promise<{ ok: boolean; changed?: string[] }> {
    const yamlContent = await this.getConfigYaml();
    const updatedYaml = yamlContent.replace(
      /^logging-to-file:\s*(true|false)$/m,
      `logging-to-file: ${enabled}`
    );
    return await this.updateConfigYaml(updatedYaml);
  },
};
