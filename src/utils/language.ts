/**
 * Language Utilities
 */

import { STORAGE_KEY_LANGUAGE } from './constants';

const SUPPORTED_LANGUAGES = ['en', 'zh-CN', 'id'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

/**
 * Get the initial language preference
 * Priority: localStorage > browser language > default (en)
 */
export function getInitialLanguage(): SupportedLanguage {
  // Check localStorage
  const stored = localStorage.getItem(STORAGE_KEY_LANGUAGE);
  if (stored && SUPPORTED_LANGUAGES.includes(stored as SupportedLanguage)) {
    return stored as SupportedLanguage;
  }

  // Check browser language
  if (typeof navigator !== 'undefined') {
    const browserLang = navigator.language;
    if (browserLang.startsWith('zh')) {
      return 'zh-CN';
    }
  }

  return 'en';
}

/**
 * Save language preference
 */
export function saveLanguage(lang: SupportedLanguage): void {
  localStorage.setItem(STORAGE_KEY_LANGUAGE, lang);
}
