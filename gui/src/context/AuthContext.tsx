'use client';

import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { setBasicAuth, setTokenAuth, clearAuth, set401Handler } from '@/lib/api';
import { useServer, ServerType } from '@/context/ServerContext';

type StoredAuth =
  | { type: 'basic'; username: string; password: string }
  | { type: 'token'; token: string };

type AuthContextValue = {
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
};

const COOKIE_MAX_AGE = 60 * 60 * 8; // 8時間

function saveAuthCookie(serverType: ServerType, auth: StoredAuth) {
  const value = encodeURIComponent(JSON.stringify(auth));
  document.cookie = `redfish_auth_${serverType}=${value}; SameSite=Strict; max-age=${COOKIE_MAX_AGE}; path=/`;
}

function loadAuthCookie(serverType: ServerType): StoredAuth | null {
  const match = document.cookie.match(new RegExp(`redfish_auth_${serverType}=([^;]+)`));
  if (!match) return null;
  try {
    return JSON.parse(decodeURIComponent(match[1])) as StoredAuth;
  } catch {
    return null;
  }
}

function clearAuthCookie(serverType: ServerType) {
  document.cookie = `redfish_auth_${serverType}=; SameSite=Strict; max-age=0; path=/`;
}

const AuthContext = createContext<AuthContextValue>({
  isAuthenticated: false,
  login: async () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { current } = useServer();
  const serverKey = `${current.host}:${current.port}`;
  const authMap = useRef<Map<string, StoredAuth>>(new Map());
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    set401Handler(() => {
      setIsAuthenticated(false);
      const redirect = window.location.pathname + window.location.search;
      router.push(`/login?redirect=${encodeURIComponent(redirect)}`);
    });
    return () => set401Handler(null);
  }, [router]);

  useEffect(() => {
    let auth = authMap.current.get(serverKey) ?? loadAuthCookie(current.type);
    if (auth) {
      authMap.current.set(serverKey, auth);
      if (auth.type === 'basic') {
        setBasicAuth(auth.username, auth.password);
      } else {
        setTokenAuth(auth.token);
      }
      setIsAuthenticated(true);
    } else {
      clearAuth();
      setIsAuthenticated(false);
    }
  }, [serverKey, current.type]);

  const login = useCallback(async (username: string, password: string) => {
    if (current.type === 'emu') {
      setBasicAuth(username, password);
      const auth: StoredAuth = { type: 'basic', username, password };
      authMap.current.set(serverKey, auth);
      saveAuthCookie(current.type, auth);
      setIsAuthenticated(true);
    } else {
      const res = await fetch(`/api/proxy/${current.type}/redfish/v1/SessionService/Sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ UserName: username, Password: password }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          (err as { error?: { message?: string } })?.error?.message
          || `ログイン失敗 (HTTP ${res.status})`
        );
      }
      const token = res.headers.get('x-auth-token');
      if (!token) throw new Error('認証トークンの取得に失敗しました');
      setTokenAuth(token);
      const auth: StoredAuth = { type: 'token', token };
      authMap.current.set(serverKey, auth);
      saveAuthCookie(current.type, auth);
      setIsAuthenticated(true);
    }
  }, [current, serverKey]);

  const logout = useCallback(() => {
    authMap.current.delete(serverKey);
    clearAuthCookie(current.type);
    clearAuth();
    setIsAuthenticated(false);
    router.push('/login');
  }, [serverKey, current.type, router]);

  return (
    <AuthContext.Provider value={{ isAuthenticated, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
