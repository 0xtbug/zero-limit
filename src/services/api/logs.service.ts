import { apiClient } from './client'

export interface LogFile {
  name: string
  size: number
  modified: number
}

export interface ServerLogsResponse {
  lines: string[]
  'line-count': number
  'latest-timestamp': number
}

class LogsApi {
  /**
   * Fetch main server logs
   * @param after Optional timestamp to fetch logs after
   * @param limit Optional limit on number of lines
   */
  async getServerLogs(after?: number, limit?: number): Promise<ServerLogsResponse> {
    const params = new URLSearchParams()
    if (after) params.append('after', after.toString())
    if (limit) params.append('limit', limit.toString())

    const response = await apiClient.get<ServerLogsResponse>(`/logs?${params.toString()}`)
    return response
  }

  /**
   * List available request error log files
   */
  async listErrorLogs(): Promise<LogFile[]> {
    const response = await apiClient.get<{ files: LogFile[] }>('/request-error-logs')
    return response.files || []
  }

  /**
   * Download the content of a specific request error log
   * @param name Name of the log file
   */
  async downloadErrorLog(name: string): Promise<string> {
    const response = await apiClient.get<string>(`/request-error-logs/${encodeURIComponent(name)}`, {
      responseType: 'text'
    })
    return response
  }

  /**
   * Clear the error log files and truncate the main log.
   */
  async deleteLogs(): Promise<{ success: boolean; message: string; removed: number }> {
    const response = await apiClient.delete<{ success: boolean; message: string; removed: number }>('/logs')
    return response
  }
}

export const logsApi = new LogsApi()
