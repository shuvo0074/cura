import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, setAccessToken } from '../api/client';

const AuthContext = createContext();

// Where each kind of account lands after logging in.
export function homePathFor(user) {
  if (user?.roles?.includes('admin')) return '/admin';
  if (user?.roles?.includes('doctor')) return '/doctor-dashboard';
  // Clinic accounts sign in with no directory role, and /appointments needs one.
  if (!user?.roles?.length) return '/';
  return '/appointments';
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Reload: there is no token in memory, so restore it from the cookie through /auth/me's retry.
  const refresh = useCallback(
    () => api.get('/auth/me').then(setUser).catch(() => setUser(null)),
    []
  );

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  async function login(email, password) {
    const result = await api.post('/auth/login', { identifier: email, password });
    if (result.status !== 'authenticated') {
      throw new Error('This account needs a verification code, which this site does not support.');
    }
    setAccessToken(result.session.accessToken, result.session.expiresIn);
    const signedIn = await api.get('/auth/me');
    setUser(signedIn);
    return signedIn;
  }

  function startSession({ accessToken, expiresIn, tokenType: _tokenType, ...account }) {
    setAccessToken(accessToken, expiresIn);
    setUser(account);
    return account;
  }

  const register = async fields => startSession(await api.post('/auth/register/patient', fields));
  const registerDoctor = async fields => startSession(await api.post('/auth/register/doctor', fields));

  async function logout() {
    await api.post('/auth/logout').catch(() => {});
    setAccessToken(null);
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
