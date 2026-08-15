import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { I18nextProvider } from 'react-i18next';
import i18n, { APP_LANGUAGES, initI18n, setAppLanguage } from './i18n';

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [ready, setReady] = useState(false);
  const [language, setLanguage] = useState('en');

  useEffect(() => {
    initI18n()
      .then((instance) => {
        setLanguage(instance.language);
        setReady(true);
      })
      .catch((err) => {
        console.warn('i18n init failed, falling back to English:', err?.message);
        setLanguage('en');
        setReady(true);
      });
  }, []);

  const changeLanguage = useCallback(async (code) => {
    await setAppLanguage(code);
    setLanguage(code);
  }, []);

  const value = useMemo(
    () => ({
      language,
      languages: APP_LANGUAGES,
      changeLanguage,
      ready,
    }),
    [language, changeLanguage, ready]
  );

  if (!ready) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <I18nextProvider i18n={i18n}>
      <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
    </I18nextProvider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}
