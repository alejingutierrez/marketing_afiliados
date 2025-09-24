import type { AuthenticatedUser, AuthTokens } from '@/types/auth';

export const AUTH_STORAGE_KEY = 'marketing-afiliados-auth';

export type StoredAuthTokens = AuthTokens & { expiresAt: number };

export interface StoredAuthSession {
  tokens: StoredAuthTokens;
  user: AuthenticatedUser | null;
}

function isBrowser() {
  return typeof window !== 'undefined';
}

export function loadAuthSession(): StoredAuthSession | null {
  if (!isBrowser()) {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as StoredAuthSession;
    if (!parsed.tokens || !parsed.tokens.accessToken || !parsed.tokens.refreshToken) {
      return null;
    }

    return parsed;
  } catch (error) {
    console.warn('No se pudo cargar la sesión almacenada', error);
    return null;
  }
}

export function saveAuthSession(session: StoredAuthSession) {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
}

export function clearAuthSession() {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.removeItem(AUTH_STORAGE_KEY);
}

export function computeExpiresAt(expiresInSeconds: number): number {
  const now = Date.now();
  return now + expiresInSeconds * 1000;
}
