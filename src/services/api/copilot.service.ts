/**
 * GitHub Copilot Device Flow Service
 *
 * Implements the GitHub OAuth2 device flow entirely in the frontend,
 * so it works with the base CLIProxyAPI (which lacks /github-auth-url).
 *
 * All GitHub API calls are proxied through Tauri Rust commands to avoid
 * CORS restrictions — GitHub's device flow endpoints do not set CORS headers.
 *
 * Flow:
 *   1. invoke('github_request_device_code')  → get device_code + user_code + verification_uri
 *   2. Show user_code to user, open verification_uri in browser
 *   3. Poll invoke('github_poll_token') until authorized
 *   4. invoke('github_fetch_user_info')  → fetch username / email / name
 *   5. Build CopilotTokenStorage JSON, upload via POST /auth-files
 */

import { invoke } from '@tauri-apps/api/core'

const DEFAULT_POLL_INTERVAL_MS = 5000
const MAX_POLL_DURATION_MS = 15 * 60 * 1000

export interface CopilotDeviceCode {
  device_code: string
  user_code: string
  verification_uri: string
  expires_in: number
  interval: number
}

export interface CopilotTokenData {
  access_token: string
  token_type: string
  scope: string
}

export interface CopilotUserInfo {
  login: string
  email: string | null
  name: string | null
}

/** Shape stored as the auth JSON file (mirrors Go CopilotTokenStorage) */
export interface CopilotTokenStorage {
  access_token: string
  token_type: string
  scope: string
  username: string
  email?: string
  name?: string
  type: 'github-copilot'
}

/** Step 1: Request device code via Rust (bypasses CORS) */
export async function requestDeviceCode(): Promise<CopilotDeviceCode> {
  return invoke<CopilotDeviceCode>('github_request_device_code')
}

/**
 * Step 2+3: Poll GitHub until the user authorizes.
 * Resolves with the access token on success, rejects on error/timeout.
 */
export async function pollForToken(
  deviceCode: CopilotDeviceCode,
  signal?: AbortSignal,
): Promise<CopilotTokenData> {
  let intervalMs = Math.max(deviceCode.interval * 1000, DEFAULT_POLL_INTERVAL_MS)
  const deadline = Date.now() + Math.min(deviceCode.expires_in * 1000, MAX_POLL_DURATION_MS)

  while (Date.now() < deadline) {
    if (signal?.aborted) {
      throw new Error('Authentication cancelled')
    }

    await new Promise<void>((resolve) => setTimeout(resolve, intervalMs))

    if (signal?.aborted) {
      throw new Error('Authentication cancelled')
    }

    const data = await invoke<{
      access_token?: string
      token_type?: string
      scope?: string
      error?: string
      error_description?: string
    }>('github_poll_token', { deviceCode: deviceCode.device_code })

    if (data.error) {
      switch (data.error) {
        case 'authorization_pending':
          continue
        case 'slow_down':
          intervalMs += 5000
          continue
        case 'expired_token':
          throw new Error('Device code expired. Please try again.')
        case 'access_denied':
          throw new Error('Access denied by user.')
        default:
          throw new Error(data.error_description || data.error || 'Token exchange failed')
      }
    }

    if (!data.access_token) {
      throw new Error('Empty access token received')
    }

    return {
      access_token: data.access_token,
      token_type: data.token_type ?? 'bearer',
      scope: data.scope ?? '',
    }
  }

  throw new Error('Device code expired. Please try again.')
}

/** Step 4: Fetch GitHub user profile via Rust (bypasses CORS) */
export async function fetchUserInfo(accessToken: string): Promise<CopilotUserInfo> {
  const data = await invoke<{ login?: string; email?: string | null; name?: string | null }>(
    'github_fetch_user_info',
    { accessToken },
  )
  return {
    login: data.login ?? '',
    email: data.email ?? null,
    name: data.name ?? null,
  }
}

/** Build the JSON blob that gets uploaded as an auth file */
export function buildTokenStorage(
  tokenData: CopilotTokenData,
  userInfo: CopilotUserInfo,
): { storage: CopilotTokenStorage; fileName: string } {
  const username = userInfo.login || 'github-user'
  const storage: CopilotTokenStorage = {
    access_token: tokenData.access_token,
    token_type: tokenData.token_type,
    scope: tokenData.scope,
    username,
    type: 'github-copilot',
  }
  if (userInfo.email) storage.email = userInfo.email
  if (userInfo.name) storage.name = userInfo.name

  const fileName = `github-copilot-${username}.json`
  return { storage, fileName }
}

/**
 * Upload the token storage JSON as a multipart file to the backend /auth-files endpoint.
 * Uses the existing authFilesApi.upload() so it goes through the same auth/base-URL as everything else.
 */
export async function uploadTokenFile(
  storage: CopilotTokenStorage,
  fileName: string,
  uploadFn: (formData: FormData) => Promise<unknown>,
): Promise<void> {
  const blob = new Blob([JSON.stringify(storage, null, 2)], { type: 'application/json' })
  const formData = new FormData()
  formData.append('file', blob, fileName)
  await uploadFn(formData)
}
