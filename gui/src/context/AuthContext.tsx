'use client';

import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { setBasicAuth, setTokenAuth, clearAuth, set401Handler } from '@/lib/api';
import { useServer } from '@/context/ServerContext';

type StoredAuth =
  | { type: 'basic'; username: string; password: string }
  | { type: 'token'; token: string };

type AuthContextValue = {
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
};

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
    const auth = authMap.current.get(serverKey);
    if (auth) {
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
  }, [serverKey]);

  const login = useCallback(async (username: string, password: string) => {
    if (current.type === 'emu') {
      setBasicAuth(username, password);
      authMap.current.set(serverKey, { type: 'basic', username, password });
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
      authMap.current.set(serverKey, { type: 'token', token });
      setIsAuthenticated(true);
    }
  }, [current, serverKey]);

  const logout = useCallback(() => {
    authMap.current.delete(serverKey);
    clearAuth();
    setIsAuthenticated(false);
    router.push('/login');
  }, [serverKey, router]);

  return (
    <AuthContext.Provider value={{ isAuthenticated, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
