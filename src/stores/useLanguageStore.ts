/**
 * Language State Store
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import i18n from '@/i18n';
import { STORAGE_KEY_LANGUAGE } from '@/utils/constants';
import { SupportedLanguage } from '@/utils/language';

interface LanguageState {
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;
}

export const useLanguageStore = create<LanguageState>()(
  persist(
    (set) => ({
      language: (i18n.language as SupportedLanguage) || 'en',

      setLanguage: (lang) => {
        i18n.changeLanguage(lang);
        set({ language: lang });
      },
    }),
    {
      name: STORAGE_KEY_LANGUAGE,
    }
  )
);
