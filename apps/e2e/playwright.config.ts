import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  expect: {
    timeout: 5_000
  },
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://127.0.0.1:4300',
    headless: process.env.CI ? true : true,
    trace: 'on-first-retry'
  },
  webServer: {
    command: 'pnpm --filter @marketing-afiliados/web dev',
    url: 'http://127.0.0.1:4300',
    reuseExistingServer: !process.env.CI,
    env: {
      NEXT_PUBLIC_API_BASE_URL: 'http://127.0.0.1:4300/api/v1',
      PORT: '4300',
      HOSTNAME: '127.0.0.1',
      NODE_ENV: 'test'
    }
  }
});
