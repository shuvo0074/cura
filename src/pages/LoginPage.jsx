import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { Mail, Lock, Stethoscope } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth, homePathFor } from '../context/AuthContext';
import AuthField, { PasswordField } from '../components/auth/AuthField';
import { doctorClaimUrl, doctorRegisterUrl } from '../config/dashboard';
import { safeRedirect } from '../utils/authValidation';

export default function LoginPage() {
  const { t } = useTranslation();
  const { user, loading, login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get('redirect');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!loading && user) return <Navigate to={safeRedirect(redirect, homePathFor(user))} replace />;

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const u = await login(email, password);
      navigate(safeRedirect(redirect, homePathFor(u)), { replace: true });
    } catch (err) {
      // A clinic added this doctor, and they have not created a login yet.
      if (err.code === 'DOCTOR_SIGNUP_REQUIRED') {
        window.location.assign(doctorClaimUrl(email.trim()));
        return;
      }
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-center py-10 sm:py-16">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8">
        <h1 className="text-2xl font-bold text-gray-900">{t('auth_login_title')}</h1>
        <p className="text-sm text-gray-500 mt-1 mb-6">{t('auth_login_sub')}</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <AuthField label={t('auth_email_or_phone')} icon={Mail} type="text" autoComplete="username" required
            value={email} onChange={e => setEmail(e.target.value)} />
          <PasswordField label={t('auth_password')} icon={Lock} autoComplete="current-password" required
            value={password} onChange={e => setPassword(e.target.value)} />
          {error && <p role="alert" className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
          <button type="submit" disabled={busy || !email || !password}
            className="w-full bg-primary text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 hover:bg-primary/90 transition-colors">
            {busy ? t('auth_logging_in') : t('login')}
          </button>
        </form>

        <p className="text-sm text-gray-600 text-center mt-6">
          {t('auth_no_account')}{' '}
          <Link to={`/register${redirect ? `?redirect=${encodeURIComponent(redirect)}` : ''}`}
            className="font-semibold text-action hover:underline">{t('auth_create_account')}</Link>
        </p>
      </div>

      <Link to="/register/doctor"
        className="mt-4 w-full max-w-md flex items-center gap-3 bg-white/70 border border-gray-100 rounded-2xl px-5 py-4 hover:bg-white transition-colors">
        <span className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
          <Stethoscope size={18} />
        </span>
        <span className="text-sm text-gray-600">
          {t('auth_are_you_doctor')} <span className="font-semibold text-primary">{t('auth_doctor_cta')} →</span>
        </span>
      </Link>
    </div>
  );
}
