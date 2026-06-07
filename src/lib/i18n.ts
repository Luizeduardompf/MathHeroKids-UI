import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';

import en from '@/locales/en.json';
import pt from '@/locales/pt.json';
import es from '@/locales/es.json';
import fr from '@/locales/fr.json';

import type { SupportedLocale } from '@/constants/config';
import { SUPPORTED_LOCALES, DEFAULT_LOCALE } from '@/constants/config';

export const resources = { en: { translation: en }, pt: { translation: pt }, es: { translation: es }, fr: { translation: fr } } as const;

/**
 * Detect the best locale from device settings, falling back to DEFAULT_LOCALE.
 */
function detectLocale(): SupportedLocale {
  const deviceLocales = getLocales();
  for (const locale of deviceLocales) {
    const lang = locale.languageCode as SupportedLocale;
    if (SUPPORTED_LOCALES.includes(lang)) return lang;
  }
  return DEFAULT_LOCALE;
}

let _initialized = false;

export async function initI18n(savedLocale?: SupportedLocale): Promise<void> {
  if (_initialized) return;
  _initialized = true;

  await i18next.use(initReactI18next).init({
    resources,
    lng: savedLocale ?? detectLocale(),
    fallbackLng: DEFAULT_LOCALE,
    interpolation: {
      escapeValue: false, // React already escapes values
    },
    compatibilityJSON: 'v4',
  });
}

export function changeLocale(locale: SupportedLocale): void {
  void i18next.changeLanguage(locale);
}

export default i18next;
