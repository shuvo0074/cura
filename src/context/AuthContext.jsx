import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '../api/client';

const AuthContext = createContext();

// Where each kind of account lands after logging in.
export function homePathFor(user) {
  if (user?.roles?.includes('admin')) return '/admin';
  if (user?.roles?.includes('doctor')) return '/doctor-dashboard';
  return '/appointments';
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(
    () => api.get('/auth/me').then(setUser).catch(() => setUser(null)),
    []
  );

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  async function login(email, password) {
    const u = await api.post('/auth/login', { email, password });
    setUser(u);
    return u;
  }

  async function register(fields) {
    const u = await api.post('/auth/register', fields);
    setUser(u);
    return u;
  }

  async function registerDoctor(fields) {
    const u = await api.post('/auth/register/doctor', fields);
    setUser(u);
    return u;
  }

  async function logout() {
    await api.post('/auth/logout').catch(() => {});
    setUser(null);
  }

  const hasRole = role => Boolean(user?.roles?.includes(role));

  return (
    <AuthContext.Provider value={{ user, loading, hasRole, login, register, registerDoctor, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
