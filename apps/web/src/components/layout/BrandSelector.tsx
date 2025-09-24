'use client';

import { Select } from 'antd';

import { useThemePreferences } from '@/providers/ThemeProvider';

export default function BrandSelector() {
  const { brand, availableBrands, setBrand, mode, setMode } = useThemePreferences();

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <Select
        size="small"
        value={brand.key}
        onChange={setBrand}
        options={availableBrands.map((item) => ({
          value: item.key,
          label: item.name
        }))}
        style={{ minWidth: 140 }}
      />
      <Select
        size="small"
        value={mode}
        onChange={(value) => setMode(value)}
        options={[
          { value: 'light', label: '☀️' },
          { value: 'dark', label: '🌙' }
        ]}
        style={{ width: 70 }}
      />
    </div>
  );
}
