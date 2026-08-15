import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en.json';
import zh from './locales/zh.json';
import fr from './locales/fr.json';
import es from './locales/es.json';
import fil from './locales/fil.json';
import hi from './locales/hi.json';

export const LANGUAGE_STORAGE_KEY = '@campus_watch_app_language';

export const APP_LANGUAGES = [
  { code: 'en', labelKey: 'language.english' },
  { code: 'zh', labelKey: 'language.chinese' },
  { code: 'fr', labelKey: 'language.french' },
  { code: 'es', labelKey: 'language.spanish' },
  { code: 'fil', labelKey: 'language.filipino' },
  { code: 'hi', labelKey: 'language.hindi' },
];

const resources = {
  en: { translation: en },
  zh: { translation: zh },
  fr: { translation: fr },
  es: { translation: es },
  fil: { translation: fil },
  hi: { translation: hi },
};

let initialized = false;

export async function initI18n() {
  if (initialized) return i18n;

  let lng = 'en';
  try {
    const stored = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (stored && resources[stored]) lng = stored;
  } catch {
    // default English
  }

  await i18n.use(initReactI18next).init({
    resources,
    lng,
    fallbackLng: 'en',
    compatibilityJSON: 'v4',
    interpolation: { escapeValue: false },
  });

  initialized = true;
  return i18n;
}

export async function setAppLanguage(code) {
  if (!resources[code]) return;
  await i18n.changeLanguage(code);
  await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, code);
}

export default i18n;
