import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { Mail, Lock, KeyRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { useAuth, homePathFor } from '../context/AuthContext';
import AuthField, { PasswordField } from '../components/auth/AuthField';
import { doctorClaimUrl } from '../config/dashboard';
import { isValidEmail, normalizeBdPhone, passwordProblemKey, safeRedirect } from '../utils/authValidation';

// Forgot password: a code goes to the email or mobile number the person logs in
// with, and a correct code plus a new password logs them in.
export default function ForgotPasswordPage() {
  const { t } = useTranslation();
  const { user, loading, resetPassword } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get('redirect');
  const loginPath = `/login${redirect ? `?redirect=${encodeURIComponent(redirect)}` : ''}`;

  const [phase, setPhase] = useState('identifier');
  const [identifier, setIdentifier] = useState('');
  const [challenge, setChallenge] = useState(null);
  const [form, setForm] = useState({ code: '', password: '', confirmPassword: '' });
  const [touched, setTouched] = useState({});
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  // Someone already logged in is not here to reset; a fresh reset logs in and navigates itself.
  if (!loading && user && !busy) return <Navigate to={safeRedirect(redirect, homePathFor(user))} replace />;

  const isEmail = identifier.includes('@');
  const cleanIdentifier = isEmail ? identifier.trim() : normalizeBdPhone(identifier);
  const identifierOk = isEmail ? isValidEmail(identifier) : Boolean(cleanIdentifier);

  const errors = {
    code: !/^\d{6}$/.test(form.code) && t('reset_err_code_format'),
    password: passwordProblemKey(form.password) && t(passwordProblemKey(form.password)),
    confirmPassword: form.confirmPassword !== form.password && t('auth_err_password_match'),
  };
  const shown = field => touched[field] && errors[field];

  const set = field => e => {
    const value = field === 'code' ? e.target.value.replace(/\D/g, '').slice(0, 6) : e.target.value;
    setForm(f => ({ ...f, [field]: value }));
    setError('');
  };
  const touch = field => () => setTouched(s => ({ ...s, [field]: true }));

  const messageFor = err => (err.code === 'RATE_LIMITED' ? t('reset_err_wait') : err.message);

  async function sendCode(resending) {
    setError('');
    setNotice('');
    if (!identifierOk) {
      setError(t('reset_err_identifier'));
      return;
    }
    setBusy(true);
    try {
      const result = await api.post('/auth/password-reset/request', { identifier: cleanIdentifier });
      setChallenge(result.challenge);
      setPhase('code');
      setForm({ code: '', password: '', confirmPassword: '' });
      setTouched({});
      if (resending) setNotice(t('reset_new_code_sent'));
    } catch (err) {
      // A clinic added this doctor, and they have not created a login yet.
      if (err.code === 'DOCTOR_SIGNUP_REQUIRED') {
        window.location.assign(doctorClaimUrl(identifier.trim()));
        return;
      }
      setError(messageFor(err));
    }
    setBusy(false);
  }

  function handleIdentifier(e) {
    e.preventDefault();
    sendCode(false);
  }

  async function handleNewPassword(e) {
    e.preventDefault();
    setTouched({ code: true, password: true, confirmPassword: true });
    setNotice('');
    if (Object.values(errors).some(Boolean)) return;
    setBusy(true);
    try {
      const signedIn = await resetPassword({ challengeId: challenge.challengeId, ...form });
      if (signedIn) {
        navigate(safeRedirect(redirect, homePathFor(signedIn)), { replace: true });
        return;
      }
      setPhase('done');
    } catch (err) {
      setError(err.code === 'VALIDATION_FAILED' ? t('reset_err_code') : messageFor(err));
      setForm(f => ({ ...f, code: '' }));
    }
    setBusy(false);
  }

  const errorBox = error && <p role="alert" className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>;
  const primary = 'w-full bg-primary text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 hover:bg-primary/90 transition-colors';
  const secondary = 'text-sm font-semibold text-action hover:underline disabled:opacity-50';

  return (
    <div className="flex flex-col items-center py-10 sm:py-16">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8">
        {phase === 'done' ? (
          <>
            <h1 className="text-2xl font-bold text-gray-900">{t('reset_done_title')}</h1>
            <p role="status" className="text-sm text-gray-500 mt-1 mb-6">{t('reset_done_sub')}</p>
            <Link to={loginPath} className={`${primary} block text-center`}>{t('login')}</Link>
          </>
        ) : phase === 'code' ? (
          <>
            <h1 className="text-2xl font-bold text-gray-900">{t('reset_code_title')}</h1>
            <p className="text-sm text-gray-500 mt-1 mb-6">
              {t('reset_code_sub', { destination: challenge?.maskedDestination })}
            </p>
            <form onSubmit={handleNewPassword} className="flex flex-col gap-4" noValidate>
              <AuthField label={t('reset_code')} icon={KeyRound} inputMode="numeric" autoComplete="one-time-code"
                maxLength={6} autoFocus value={form.code} onChange={set('code')} onBlur={touch('code')}
                error={shown('code')} />
              <PasswordField label={t('reset_new_password')} icon={Lock} autoComplete="new-password"
                value={form.password} onChange={set('password')} onBlur={touch('password')}
                error={shown('password')} hint={t('auth_password_hint')} />
              <PasswordField label={t('auth_confirm_password')} icon={Lock} autoComplete="new-password"
                value={form.confirmPassword} onChange={set('confirmPassword')} onBlur={touch('confirmPassword')}
                error={shown('confirmPassword')} />
              {notice && <p role="status" className="text-sm text-gray-600">{notice}</p>}
              {errorBox}
              <button type="submit" disabled={busy} className={primary}>
                {busy ? t('reset_saving') : t('reset_change_password')}
              </button>
            </form>
            <div className="flex items-center justify-between gap-4 mt-6">
              <button type="button" disabled={busy} onClick={() => sendCode(true)} className={secondary}>
                {t('reset_send_again')}
              </button>
              <button type="button" disabled={busy} className={secondary}
                onClick={() => { setPhase('identifier'); setError(''); setNotice(''); }}>
                {t('reset_other_address')}
              </button>
            </div>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-gray-900">{t('reset_title')}</h1>
            <p className="text-sm text-gray-500 mt-1 mb-6">{t('reset_sub')}</p>
            <form onSubmit={handleIdentifier} className="flex flex-col gap-4" noValidate>
              <AuthField label={t('auth_email_or_phone')} icon={Mail} type="text" autoComplete="username" autoFocus
                value={identifier} onChange={e => { setIdentifier(e.target.value); setError(''); }} />
              {errorBox}
              <button type="submit" disabled={busy || !identifier.trim()} className={primary}>
                {busy ? t('reset_sending') : t('reset_send_code')}
              </button>
            </form>
          </>
        )}

        {phase !== 'done' && (
          <p className="text-sm text-gray-600 text-center mt-6">
            {t('reset_remembered')}{' '}
            <Link to={loginPath} className="font-semibold text-action hover:underline">{t('login')}</Link>
          </p>
        )}
      </div>
    </div>
  );
}
