import { resolve } from 'node:path';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: [resolve(__dirname, 'src/tests/setup.ts')],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      reporter: ['text', 'lcov'],
      exclude: ['src/tests/**', 'src/locales/**']
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@components': resolve(__dirname, 'src/components'),
      '@hooks': resolve(__dirname, 'src/hooks'),
      '@providers': resolve(__dirname, 'src/providers'),
      '@lib': resolve(__dirname, 'src/lib'),
      '@locales': resolve(__dirname, 'src/locales'),
      '@types': resolve(__dirname, 'src/types'),
      '@views': resolve(__dirname, 'src/views')
    }
  }
});
