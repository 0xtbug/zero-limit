export const MANAGEMENT_API_PREFIX = '/v0/management';
export const REQUEST_TIMEOUT_MS = 30 * 1000;
export const VERSION_HEADER_KEYS = ['x-cpa-version', 'x-server-version'];
export const BUILD_DATE_HEADER_KEYS = ['x-cpa-build-date', 'x-server-build-date'];

export const ANTIGRAVITY_QUOTA_URLS = [
  'https://daily-cloudcode-pa.googleapis.com/v1internal:fetchAvailableModels',
  'https://daily-cloudcode-pa.sandbox.googleapis.com/v1internal:fetchAvailableModels',
  'https://cloudcode-pa.googleapis.com/v1internal:fetchAvailableModels'
];

export const GEMINI_CLI_QUOTA_URL = 'https://cloudcode-pa.googleapis.com/v1internal:retrieveUserQuota';
export const CODEX_USAGE_URL = 'https://chatgpt.com/backend-api/wham/usage';
export const KIRO_USAGE_URL = 'https://codewhisperer.us-east-1.amazonaws.com/getUsageLimits?isEmailRequired=true&origin=AI_EDITOR&resourceType=AGENTIC_REQUEST';
export const COPILOT_ENTITLEMENT_URL = 'https://api.github.com/copilot_internal/user';

export const ANTIGRAVITY_HEADERS: Record<string, string> = {
  Authorization: 'Bearer $TOKEN$',
  'Content-Type': 'application/json',
  'User-Agent': 'antigravity/1.11.5 windows/amd64'
};

export const GEMINI_CLI_HEADERS: Record<string, string> = {
  Authorization: 'Bearer $TOKEN$',
  'Content-Type': 'application/json'
};

export const CODEX_HEADERS: Record<string, string> = {
  Authorization: 'Bearer $TOKEN$',
  'Content-Type': 'application/json',
  'User-Agent': 'codex_cli_rs/0.76.0 (Debian 13.0.0; x86_64) WindowsTerminal'
};

export const KIRO_HEADERS: Record<string, string> = {
  Authorization: 'Bearer $TOKEN$',
  'Content-Type': 'application/json',
  'User-Agent': 'aws-sdk-js/3.0.0 KiroIDE-0.1.0 os/windows lang/js md/nodejs/18.0.0',
  'x-amz-user-agent': 'aws-sdk-js/3.0.0'
};

export const COPILOT_HEADERS: Record<string, string> = {
  Authorization: 'Bearer $TOKEN$',
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28'
};
