'use client';

import { Select } from 'antd';

import { useTranslation } from '@/providers/TranslationProvider';

export default function LanguageSwitcher() {
  const { language, setLanguage } = useTranslation();

  return (
    <Select
      size="small"
      value={language}
      onChange={(value) => setLanguage(value)}
      options={[
        { value: 'es', label: 'ES' },
        { value: 'en', label: 'EN' }
      ]}
      style={{ width: 80 }}
    />
  );
}
