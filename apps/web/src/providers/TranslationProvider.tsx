'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren
} from 'react';

import en from '@/locales/en';
import es, { type TranslationSchema } from '@/locales/es';

const STORAGE_KEY = 'marketing-afiliados-language';

export type Language = 'es' | 'en';

type TranslationValue = string | string[] | TranslationSchema | undefined;

interface TranslationContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
  list: (key: string) => string[];
  raw: (key: string) => TranslationValue;
}

const dictionaries: Record<Language, TranslationSchema> = {
  es,
  en
};

const TranslationContext = createContext<TranslationContextValue | undefined>(undefined);

function resolveKey(dictionary: TranslationSchema, key: string): TranslationValue {
  const segments = key.split('.');
  let current: TranslationValue = dictionary;

  for (const segment of segments) {
    if (!current || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, TranslationValue>)[segment];
  }

  return current;
}

function interpolate(value: string, vars?: Record<string, string | number>): string {
  if (!vars) return value;
  return value.replace(/{{(\s*[^}]+\s*)}}/g, (_, token) => {
    const key = token.trim();
    const replacement = vars[key];
    return replacement !== undefined ? String(replacement) : '';
  });
}

export function TranslationProvider({ children }: PropsWithChildren) {
  const [language, setLanguageState] = useState<Language>('es');

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const stored = window.localStorage.getItem(STORAGE_KEY) as Language | null;
    if (stored && (stored === 'es' || stored === 'en')) {
      setLanguageState(stored);
    }
  }, []);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, lang);
    }
  }, []);

  const dictionary = useMemo(() => dictionaries[language], [language]);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      const rawValue = resolveKey(dictionary, key);
      if (typeof rawValue === 'string') {
        return interpolate(rawValue, vars);
      }

      if (Array.isArray(rawValue)) {
        return rawValue.join('\n');
      }

      return key;
    },
    [dictionary]
  );

  const list = useCallback(
    (key: string) => {
      const rawValue = resolveKey(dictionary, key);
      if (Array.isArray(rawValue)) {
        return rawValue;
      }
      if (typeof rawValue === 'string') {
        return [rawValue];
      }
      return [];
    },
    [dictionary]
  );

  const raw = useCallback(
    (key: string) => {
      return resolveKey(dictionary, key);
    },
    [dictionary]
  );

  const value = useMemo<TranslationContextValue>(
    () => ({ language, setLanguage, t, list, raw }),
    [language, setLanguage, t, list, raw]
  );

  return <TranslationContext.Provider value={value}>{children}</TranslationContext.Provider>;
}

export function useTranslation(): TranslationContextValue {
  const ctx = useContext(TranslationContext);
  if (!ctx) {
    throw new Error('useTranslation debe usarse dentro de TranslationProvider');
  }
  return ctx;
}
