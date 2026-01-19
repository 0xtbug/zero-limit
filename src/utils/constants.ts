/**
 * Constants
 */

// Cache
export const CACHE_EXPIRY_MS = 30 * 1000;

// Network
export const MANAGEMENT_API_PREFIX = '/v0/management';
export const REQUEST_TIMEOUT_MS = 30 * 1000;
export const VERSION_HEADER_KEYS = ['x-cpa-version', 'x-server-version'];
export const BUILD_DATE_HEADER_KEYS = ['x-cpa-build-date', 'x-server-build-date'];

// Storage keys
export const STORAGE_KEY_AUTH = 'cli-proxy-auth';
export const STORAGE_KEY_THEME = 'cli-proxy-theme';
export const STORAGE_KEY_LANGUAGE = 'cli-proxy-language';

// App
// export const APP_VERSION = '1.0.0'; // Deprecated in favor of useAppVersion hook
