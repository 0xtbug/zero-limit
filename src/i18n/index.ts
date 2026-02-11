/**
 * i18next Configuration
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import zhCN from './locales/zh-CN.json';
import en from './locales/en.json';
import id from './locales/id.json';
import ja from './locales/ja.json';
import vi from './locales/vi.json';
import th from './locales/th.json';
import ko from './locales/ko.json';
import { getInitialLanguage } from '@/shared/utils/language';

i18n.use(initReactI18next).init({
  resources: {
    'zh-CN': { translation: zhCN },
    en: { translation: en },
    id: { translation: id },
    ja: { translation: ja },
    vi: { translation: vi },
    th: { translation: th },
    ko: { translation: ko },
  },
  lng: getInitialLanguage(),
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false, // React already escapes
  },
  react: {
    useSuspense: false,
  },
});

export default i18n;
