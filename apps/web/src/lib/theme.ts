import type { ThemeConfig } from 'antd';

export type BrandKey = 'medipiel' | 'cetaphil' | 'avene';

export interface BrandTheme {
  key: BrandKey;
  name: string;
  theme: ThemeConfig;
}

export const BRAND_THEMES: Record<BrandKey, BrandTheme> = {
  medipiel: {
    key: 'medipiel',
    name: 'Medipiel',
    theme: {
      token: {
        colorPrimary: '#006d75',
        colorBgLayout: '#f5f5f5',
        colorBgContainer: '#ffffff',
        fontFamily:
          "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
        borderRadius: 8
      },
      components: {
        Layout: {
          headerBg: '#ffffff',
          siderBg: '#ffffff'
        }
      }
    }
  },
  cetaphil: {
    key: 'cetaphil',
    name: 'Cetaphil',
    theme: {
      token: {
        colorPrimary: '#005bbb',
        colorInfo: '#005bbb',
        colorLink: '#005bbb',
        colorSuccess: '#00a859',
        colorBgLayout: '#f7fafc',
        colorBgContainer: '#ffffff'
      }
    }
  },
  avene: {
    key: 'avene',
    name: 'Avène',
    theme: {
      token: {
        colorPrimary: '#e76f51',
        colorInfo: '#e76f51',
        colorWarning: '#f4a261',
        colorBgLayout: '#fefaf6',
        colorBgContainer: '#ffffff'
      }
    }
  }
};

export const DEFAULT_BRAND: BrandTheme = BRAND_THEMES.medipiel;

export type ThemeMode = 'light' | 'dark';
