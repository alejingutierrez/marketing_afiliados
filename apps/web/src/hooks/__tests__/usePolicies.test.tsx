/* eslint-disable import/order */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useActivePolicies, useActivePolicy } from '@/hooks/usePolicies';

vi.mock('@/providers/AuthProvider', () => ({
  useAuth: vi.fn()
}));

import { useAuth } from '@/providers/AuthProvider';
import type { PolicyType, PolicyVersion } from '@/types/policy';
const useAuthMock = vi.mocked(useAuth);

describe('usePolicies hooks', () => {
  const requestMock = vi.fn();

  const createWrapper = () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false
        }
      }
    });

    const Wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    return { Wrapper, queryClient };
  };

  beforeEach(() => {
    useAuthMock.mockReturnValue({ request: requestMock });
    requestMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('fetches active policies with skipAuth', async () => {
    const samplePolicies: PolicyVersion[] = [
      {
        id: 'terms-v1',
        policyType: 'terms',
        version: '1.0.0',
        documentUrl: 'https://example.com/terms',
        checksum: 'sha256:terms',
        publishedAt: '2024-01-01T00:00:00.000Z',
        isActive: true
      }
    ];
    requestMock.mockResolvedValueOnce(samplePolicies);
    const { Wrapper, queryClient } = createWrapper();

    const { result } = renderHook(() => useActivePolicies(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(requestMock).toHaveBeenCalledWith(
      '/public/policies',
      {
        method: 'GET'
      },
      { skipAuth: true }
    );
    expect(result.current.data).toEqual(samplePolicies);

    queryClient.clear();
  });

  it('fetches active policy by type', async () => {
    const samplePolicy: PolicyVersion = {
      id: 'privacy-v1',
      policyType: 'privacy',
      version: '1.0.0',
      documentUrl: 'https://example.com/privacy',
      checksum: 'sha256:privacy',
      publishedAt: '2024-01-01T00:00:00.000Z',
      isActive: true
    };
    requestMock.mockResolvedValueOnce(samplePolicy);
    const { Wrapper, queryClient } = createWrapper();
    const policyType: PolicyType = 'privacy';

    const { result } = renderHook(() => useActivePolicy(policyType), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(requestMock).toHaveBeenCalledWith(
      `/public/policies/${policyType}`,
      {
        method: 'GET'
      },
      { skipAuth: true }
    );
    expect(result.current.data).toEqual(samplePolicy);

    queryClient.clear();
  });
});
