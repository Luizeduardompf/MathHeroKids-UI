import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from '@/locales/en.json';
import pt from '@/locales/pt.json';
import es from '@/locales/es.json';
import fr from '@/locales/fr.json';

import type { SupportedLocale } from '@/constants/config';
import { SUPPORTED_LOCALES, DEFAULT_LOCALE } from '@/constants/config';

export const resources = { en: { translation: en }, pt: { translation: pt }, es: { translation: es }, fr: { translation: fr } } as const;

export const LOCALE_STORAGE_KEY = 'math-hero-locale-v1';

let _initialized = false;

/**
 * Initialize i18n. Language priority:
 * 1. savedLocale (read from AsyncStorage by the caller before app renders)
 * 2. DEFAULT_LOCALE ('pt') — no device auto-detection
 */
export async function initI18n(savedLocale?: SupportedLocale): Promise<void> {
  if (_initialized) return;
  _initialized = true;

  const lng =
    savedLocale && SUPPORTED_LOCALES.includes(savedLocale) ? savedLocale : DEFAULT_LOCALE;

  await i18next.use(initReactI18next).init({
    resources,
    lng,
    fallbackLng: DEFAULT_LOCALE,
    interpolation: { escapeValue: false },
    compatibilityJSON: 'v4',
  });
}

export function changeLocale(locale: SupportedLocale): void {
  void i18next.changeLanguage(locale);
}

export default i18next;
