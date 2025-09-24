'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren
} from 'react';

import { API_BASE_URL } from '@/lib/config';
import {
  AUTH_STORAGE_KEY,
  clearAuthSession,
  computeExpiresAt,
  loadAuthSession,
  saveAuthSession,
  type StoredAuthSession,
  type StoredAuthTokens
} from '@/lib/storage';
import type { AppRole, AuthenticatedUser, AuthTokens } from '@/types/auth';

export type AuthStatus = 'checking' | 'authenticated' | 'unauthenticated';

interface AuthState {
  status: AuthStatus;
  user: AuthenticatedUser | null;
  tokens: StoredAuthTokens | null;
  error: string | null;
  isAuthenticating: boolean;
}

interface RequestOptions {
  skipAuth?: boolean;
}

interface AuthContextValue {
  status: AuthStatus;
  user: AuthenticatedUser | null;
  isAuthenticating: boolean;
  error: string | null;
  login: (email: string, password: string, twoFactorCode?: string) => Promise<AuthenticatedUser>;
  logout: () => void;
  refreshTokens: (override?: StoredAuthTokens | null) => Promise<StoredAuthTokens | null>;
  hasRole: (role: AppRole | AppRole[]) => boolean;
  request: <T>(path: string, init?: RequestInit, options?: RequestOptions) => Promise<T>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const defaultState: AuthState = {
  status: 'checking',
  user: null,
  tokens: null,
  error: null,
  isAuthenticating: false
};

function buildUrl(path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
}

function isTokenExpired(tokens: StoredAuthTokens | null): boolean {
  if (!tokens) {
    return true;
  }
  return tokens.expiresAt - Date.now() < 10_000; // diez segundos de margen
}

function parseErrorResponse(payload: unknown, fallbackMessage: string): string {
  if (!payload) {
    return fallbackMessage;
  }

  if (typeof payload === 'string') {
    return payload;
  }

  if (typeof payload === 'object') {
    const maybeRecord = payload as Record<string, unknown>;
    if (typeof maybeRecord.message === 'string') {
      return maybeRecord.message;
    }
    if (typeof maybeRecord.error === 'string') {
      return maybeRecord.error;
    }
  }

  return fallbackMessage;
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<AuthState>(defaultState);
  const refreshPromise = useRef<Promise<StoredAuthTokens | null> | null>(null);

  const persistSession = useCallback((tokens: StoredAuthTokens, user: AuthenticatedUser | null) => {
    const session: StoredAuthSession = {
      tokens,
      user
    };
    saveAuthSession(session);
  }, []);

  const logout = useCallback(() => {
    clearAuthSession();
    setState({
      status: 'unauthenticated',
      user: null,
      tokens: null,
      error: null,
      isAuthenticating: false
    });
  }, []);

  const refreshTokens = useCallback(
    async (override?: StoredAuthTokens | null): Promise<StoredAuthTokens | null> => {
      const currentTokens = override ?? state.tokens;
      if (!currentTokens) {
        return null;
      }

      if (refreshPromise.current) {
        return refreshPromise.current;
      }

      const promise = (async () => {
        try {
          const response = await fetch(buildUrl('/auth/refresh'), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ refreshToken: currentTokens.refreshToken })
          });

          if (!response.ok) {
            throw new Error('Refresh token inválido');
          }

          const body = (await response.json()) as AuthTokens;
          const storedTokens: StoredAuthTokens = {
            ...body,
            expiresAt: computeExpiresAt(body.expiresIn)
          };

          setState((prev) => ({
            ...prev,
            status: 'authenticated',
            tokens: storedTokens,
            error: null,
            isAuthenticating: false
          }));

          persistSession(storedTokens, state.user);
          return storedTokens;
        } catch (error) {
          console.error('Error al refrescar tokens', error);
          logout();
          return null;
        } finally {
          refreshPromise.current = null;
        }
      })();

      refreshPromise.current = promise;
      return promise;
    },
    [logout, persistSession, state.tokens, state.user]
  );

  const fetchProfile = useCallback(async (accessToken: string): Promise<AuthenticatedUser> => {
    const response = await fetch(buildUrl('/auth/profile'), {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    if (!response.ok) {
      throw new Error('No se pudo obtener el perfil del usuario');
    }

    const profile = (await response.json()) as AuthenticatedUser;
    return profile;
  }, []);

  const login = useCallback(
    async (email: string, password: string, twoFactorCode?: string) => {
      setState((prev) => ({
        ...prev,
        isAuthenticating: true,
        error: null
      }));

      try {
        const response = await fetch(buildUrl('/auth/login'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ email, password, ...(twoFactorCode ? { twoFactorCode } : {}) })
        });

        const payload = response.headers.get('content-type')?.includes('application/json')
          ? await response.json()
          : await response.text();

        if (!response.ok) {
          const message = parseErrorResponse(payload, 'Credenciales inválidas');
          throw new Error(message);
        }

        const tokensResponse = payload as AuthTokens;
        const storedTokens: StoredAuthTokens = {
          ...tokensResponse,
          expiresAt: computeExpiresAt(tokensResponse.expiresIn)
        };

        const profile = await fetchProfile(storedTokens.accessToken);

        persistSession(storedTokens, profile);
        setState({
          status: 'authenticated',
          user: profile,
          tokens: storedTokens,
          error: null,
          isAuthenticating: false
        });

        return profile;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'No fue posible iniciar sesión';
        setState({
          status: 'unauthenticated',
          user: null,
          tokens: null,
          error: message,
          isAuthenticating: false
        });
        throw new Error(message);
      }
    },
    [fetchProfile, persistSession]
  );

  const ensureValidAccessToken = useCallback(
    async (): Promise<string | null> => {
      if (!state.tokens) {
        return null;
      }

      if (!isTokenExpired(state.tokens)) {
        return state.tokens.accessToken;
      }

      const refreshed = await refreshTokens();
      return refreshed?.accessToken ?? null;
    },
    [refreshTokens, state.tokens]
  );

  const request = useCallback(
    async <T,>(path: string, init?: RequestInit, options?: RequestOptions): Promise<T> => {
      const skipAuth = options?.skipAuth ?? false;
      const url = buildUrl(path);

      const execute = async (accessToken: string | null, retry: boolean): Promise<T> => {
        const headers = new Headers(init?.headers as HeadersInit | undefined);
        if (!headers.has('Content-Type') && init?.body && !(init.body instanceof FormData)) {
          headers.set('Content-Type', 'application/json');
        }
        if (!skipAuth && accessToken) {
          headers.set('Authorization', `Bearer ${accessToken}`);
        }

        const response = await fetch(url, {
          ...init,
          headers
        });

        const isJson = response.headers.get('content-type')?.includes('application/json');
        const payload = isJson ? await response.json() : await response.text();

        if (response.status === 401 && !skipAuth && retry) {
          const refreshed = await refreshTokens();
          if (refreshed?.accessToken) {
            return execute(refreshed.accessToken, false);
          }
        }

        if (!response.ok) {
          const message = parseErrorResponse(payload, `Error ${response.status}`);
          throw new Error(message);
        }

        return payload as T;
      };

      const token = skipAuth ? null : await ensureValidAccessToken();
      return execute(token, true);
    },
    [ensureValidAccessToken, refreshTokens]
  );

  const hasRole = useCallback(
    (role: AppRole | AppRole[]) => {
      if (!state.user) {
        return false;
      }
      const roles = Array.isArray(role) ? role : [role];
      return roles.some((current) => state.user?.roles.includes(current));
    },
    [state.user]
  );

  useEffect(() => {
    const session = loadAuthSession();
    if (!session) {
      setState((prev) => ({
        ...prev,
        status: 'unauthenticated',
        user: null,
        tokens: null,
        error: null,
        isAuthenticating: false
      }));
      return;
    }

    setState({
      status: 'authenticated',
      user: session.user,
      tokens: session.tokens,
      error: null,
      isAuthenticating: false
    });

    if (isTokenExpired(session.tokens)) {
      void refreshTokens(session.tokens);
    }
  }, [refreshTokens]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const handler = (event: StorageEvent) => {
      if (event.key === AUTH_STORAGE_KEY && !event.newValue) {
        logout();
      }
    };

    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, [logout]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status: state.status,
      user: state.user,
      isAuthenticating: state.isAuthenticating,
      error: state.error,
      login,
      logout,
      refreshTokens,
      hasRole,
      request
    }),
    [state, login, logout, refreshTokens, hasRole, request]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth debe usarse dentro de AuthProvider');
  }
  return ctx;
}
