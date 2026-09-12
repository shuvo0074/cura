import { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../api/client';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/auth/me')
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  async function requestOtp(phone) {
    return api.post('/auth/otp/request', { phone });
  }

  async function verifyOtp(phone, code) {
    const u = await api.post('/auth/otp/verify', { phone, code });
    setUser({ sub: u.id, role: u.role, phone: u.phone });
    return u;
  }

  async function staffLogin(role, email, password) {
    const u = await api.post(`/auth/${role}/login`, { email, password });
    setUser({ sub: u.id, role: u.role, name: u.name, email: u.email });
    return u;
  }

  async function logout() {
    await api.post('/auth/logout');
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, requestOtp, verifyOtp, staffLogin, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
