'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import type { PropsWithChildren } from 'react';
import { useState } from 'react';

import { AuthProvider } from '@/providers/AuthProvider';
import { LayoutStateProvider } from '@/providers/LayoutStateProvider';
import { ThemeProvider } from '@/providers/ThemeProvider';
import { TranslationProvider } from '@/providers/TranslationProvider';

export default function AppProviders({ children }: PropsWithChildren) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            retry: 1,
            staleTime: 30_000
          }
        }
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <TranslationProvider>
        <ThemeProvider>
          <AuthProvider>
            <LayoutStateProvider>{children}</LayoutStateProvider>
          </AuthProvider>
        </ThemeProvider>
      </TranslationProvider>
      <ReactQueryDevtools initialIsOpen={false} position="bottom-right" />
    </QueryClientProvider>
  );
}
