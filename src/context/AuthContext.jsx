import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, setAccessToken } from '../api/client';
import { dashboardHandoffUrl, dashboardUrl } from '../config/dashboard';

const AuthContext = createContext();

// Where each kind of account lands after logging in.
export function homePathFor(user) {
  if (user?.roles?.includes('super_admin')) return '/admin';
  if (user?.roles?.includes('doctor')) return '/doctor-dashboard';
  // Only patients have appointments here. Clinic accounts and ambulance, pharmacy
  // and hospital owners work on Cura Dashboard, so they land on the home page.
  if (user?.roles?.includes('patient')) return '/appointments';
  return '/';
}

// Cura Dashboard sends people here logged in with a single-use code in the
// fragment (#handoff=…). It is read once per page load (StrictMode runs effects
// twice) and removed from the address before anything else happens.
const HANDOFF = /^#handoff=([A-Za-z0-9_-]{43})$/;
let handoffRedemption = null;

function redeemHandoffFromAddress(navigate) {
  if (handoffRedemption) return handoffRedemption;
  const { hash, pathname, search } = window.location;
  if (!hash.startsWith('#handoff=')) return null;
  navigate({ pathname, search }, { replace: true });
  const code = HANDOFF.exec(hash)?.[1];
  handoffRedemption = code
    ? api
        .post('/auth/handoff/redeem', { code })
        .then(result => {
          setAccessToken(result.session.accessToken, result.session.expiresIn);
          return api.get('/auth/me');
        })
        .catch(() => null)
    : Promise.resolve(null);
  return handoffRedemption;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Reload: there is no token in memory, so restore it from the cookie through /auth/me's retry.
  const refresh = useCallback(
    () => api.get('/auth/me').then(setUser).catch(() => setUser(null)),
    []
  );

  // navigate changes with every route, and this check runs once per page load.
  const navigate = useNavigate();
  const navigateRef = useRef(navigate);
  useEffect(() => {
    navigateRef.current = navigate;
  }, [navigate]);

  useEffect(() => {
    const navigate = (...args) => navigateRef.current(...args);
    let cancelled = false;
    (async () => {
      const handoff = redeemHandoffFromAddress(navigate);
      const handedOver = handoff ? await handoff : null;
      if (cancelled) return;
      if (handedOver) {
        setUser(handedOver);
        setLoading(false);
        navigate(homePathFor(handedOver), { replace: true });
        return;
      }
      const restored = await api.get('/auth/me').catch(() => null);
      if (cancelled) return;
      setUser(restored);
      setLoading(false);
      if (handoff && !restored) navigate('/login?handoff=expired', { replace: true });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // "Open Cura Dashboard": the two sites cannot share a login cookie, so a
  // single-use code that lasts a minute carries this session across.
  async function openDashboard() {
    try {
      const { code } = await api.post('/auth/handoff', {});
      window.location.assign(dashboardHandoffUrl(code));
    } catch {
      window.location.assign(dashboardUrl());
    }
  }

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

  // Forgot password. Returns the signed-in account, or null when the account
  // must log in again (it needs a second code the reset did not prove).
  async function resetPassword({ challengeId, code, password, confirmPassword }) {
    const result = await api.post('/auth/password-reset/confirm', { challengeId, code, password, confirmPassword });
    if (result.status !== 'authenticated') return null;
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

  async function logout() {
    await api.post('/auth/logout').catch(() => {});
    setAccessToken(null);
    setUser(null);
  }

  const hasRole = role => Boolean(user?.roles?.includes(role));

  return (
    <AuthContext.Provider value={{ user, loading, hasRole, login, register, resetPassword, logout, refresh, openDashboard }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
