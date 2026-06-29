import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, tokenStore, setUnauthorizedHandler } from '../api/client';
import type { AuthUser, Role } from '../api/types';

interface AuthCtx {
  user: AuthUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  hasRole: (...roles: Role[]) => boolean;
}

const AuthContext = createContext<AuthCtx | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      tokenStore.clear();
      setUser(null);
    });
  }, []);

  // Restaure la session au démarrage si un token est présent
  useEffect(() => {
    const token = tokenStore.get();
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .get('/auth/me')
      .then((res) => setUser(res.data.user))
      .catch(() => {
        tokenStore.clear();
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (username: string, password: string) => {
    const res = await api.post('/auth/login', { username, password });
    tokenStore.set(res.data.token);
    setUser(res.data.user);
  };

  const logout = () => {
    tokenStore.clear();
    setUser(null);
  };

  const hasRole = (...roles: Role[]) => (user ? roles.includes(user.role) : false);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthCtx {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé dans AuthProvider');
  return ctx;
}
