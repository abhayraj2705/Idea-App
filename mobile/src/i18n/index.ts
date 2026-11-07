import { getLocales } from 'expo-localization';
import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './en';

const i18n = createInstance();
void i18n.use(initReactI18next).init({
  resources: { en: { translation: en } },
  lng: getLocales()[0]?.languageCode === 'en' ? 'en' : 'en', // English only at launch (§2)
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  returnNull: false,
});

export default i18n;
export { useTranslation } from 'react-i18next';
