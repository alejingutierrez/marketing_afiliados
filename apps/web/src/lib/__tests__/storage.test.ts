import { describe, expect, it, vi } from 'vitest';

import { AUTH_STORAGE_KEY, clearAuthSession, computeExpiresAt, saveAuthSession } from '@/lib/storage';

vi.stubGlobal('window', {
  localStorage: {
    store: new Map<string, string>(),
    getItem(key: string) {
      return this.store.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      this.store.set(key, value);
    },
    removeItem(key: string) {
      this.store.delete(key);
    }
  }
} as unknown as Window & typeof globalThis);

describe('storage helpers', () => {
  it('computes expiry timestamps in milliseconds', () => {
    const now = Date.now();
    const expires = computeExpiresAt(60);
    expect(expires).toBeGreaterThan(now);
    expect(expires).toBeLessThanOrEqual(now + 60_000 + 5); // tolerance
  });

  it('persists auth session', () => {
    saveAuthSession({
      tokens: {
        accessToken: 'a',
        refreshToken: 'b',
        expiresIn: 3600,
        expiresAt: computeExpiresAt(3600)
      },
      user: {
        sub: 'user-1',
        email: 'user@example.com',
        roles: ['influencer'],
        tenantId: 'medipiel'
      }
    });

    expect(window.localStorage.getItem(AUTH_STORAGE_KEY)).not.toBeNull();
    clearAuthSession();
    expect(window.localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
  });
});
