import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/providers/AuthProvider';
import type { PolicyType, PolicyVersion } from '@/types/policy';

const policiesQueryKey = {
  active: ['policies', 'active'] as const,
  byType: (type: PolicyType) => ['policies', 'active', type] as const
};

export function useActivePolicies() {
  const { request } = useAuth();
  return useQuery({
    queryKey: policiesQueryKey.active,
    queryFn: () =>
      request<PolicyVersion[]>(
        '/public/policies',
        {
          method: 'GET'
        },
        { skipAuth: true }
      )
  });
}

export function useActivePolicy(policyType: PolicyType, enabled = true) {
  const { request } = useAuth();
  return useQuery({
    queryKey: policiesQueryKey.byType(policyType),
    queryFn: () =>
      request<PolicyVersion>(
        `/public/policies/${policyType}`,
        {
          method: 'GET'
        },
        { skipAuth: true }
      ),
    enabled
  });
}
