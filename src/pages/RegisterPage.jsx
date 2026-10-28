import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { Mail, Lock, User, Phone, Stethoscope } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth, homePathFor } from '../context/AuthContext';
import AuthField, { PasswordField } from '../components/auth/AuthField';
import { isValidEmail, normalizeBdPhone, passwordProblemKey, safeRedirect } from '../utils/authValidation';

// Patient sign-up. Doctors register through /register/doctor.
export default function RegisterPage() {
  const { t } = useTranslation();
  const { user, loading, register } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get('redirect');
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', confirmPassword: '' });
  const [touched, setTouched] = useState({});
  const [serverError, setServerError] = useState(null);
  const [busy, setBusy] = useState(false);

  if (!loading && user) return <Navigate to={safeRedirect(redirect, homePathFor(user))} replace />;

  const errors = {
    name: form.name.trim().length < 2 && t('auth_err_name'),
    email: !isValidEmail(form.email) && t('auth_err_email'),
    phone: form.phone && !normalizeBdPhone(form.phone) && t('auth_err_phone'),
    password: passwordProblemKey(form.password) && t(passwordProblemKey(form.password)),
    confirmPassword: form.confirmPassword !== form.password && t('auth_err_password_match'),
  };
  if (serverError?.code === 'EMAIL_TAKEN') errors.email = serverError.message;
  if (serverError?.code === 'PHONE_TAKEN') errors.phone = serverError.message;
  const shown = field => touched[field] && errors[field];

  const set = field => e => {
    setForm(f => ({ ...f, [field]: e.target.value }));
    setServerError(null);
  };
  const touch = field => () => setTouched(s => ({ ...s, [field]: true }));

  async function handleSubmit(e) {
    e.preventDefault();
    setTouched({ name: true, email: true, phone: true, password: true, confirmPassword: true });
    if (Object.values(errors).some(Boolean)) return;
    setBusy(true);
    try {
      const { confirmPassword: _confirm, ...fields } = form;
      const u = await register({ ...fields, phone: form.phone ? normalizeBdPhone(form.phone) : undefined });
      navigate(safeRedirect(redirect, homePathFor(u)), { replace: true });
    } catch (err) {
      setServerError({ code: err.code, message: err.message });
      setBusy(false);
    }
  }

  const generalError = serverError && !['EMAIL_TAKEN', 'PHONE_TAKEN'].includes(serverError.code) && serverError.message;

  return (
    <div className="flex flex-col items-center py-10 sm:py-16">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8">
        <h1 className="text-2xl font-bold text-gray-900">{t('auth_register_title')}</h1>
        <p className="text-sm text-gray-500 mt-1 mb-6">{t('auth_register_sub')}</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <AuthField label={t('auth_full_name')} icon={User} autoComplete="name"
            value={form.name} onChange={set('name')} onBlur={touch('name')} error={shown('name')} />
          <AuthField label={t('auth_email')} icon={Mail} type="email" autoComplete="email"
            value={form.email} onChange={set('email')} onBlur={touch('email')} error={shown('email')} />
          <AuthField label={t('auth_mobile')} optional icon={Phone} type="tel" autoComplete="tel" inputMode="tel"
            placeholder="01XXXXXXXXX" value={form.phone} onChange={set('phone')} onBlur={touch('phone')} error={shown('phone')} />
          <PasswordField label={t('auth_password')} icon={Lock} autoComplete="new-password"
            value={form.password} onChange={set('password')} onBlur={touch('password')}
            error={shown('password')} hint={t('auth_password_hint')} />
          <PasswordField label={t('auth_confirm_password')} icon={Lock} autoComplete="new-password"
            value={form.confirmPassword} onChange={set('confirmPassword')} onBlur={touch('confirmPassword')}
            error={shown('confirmPassword')} />
          {generalError && <p role="alert" className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{generalError}</p>}
          <button type="submit" disabled={busy}
            className="w-full bg-primary text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 hover:bg-primary/90 transition-colors">
            {busy ? t('auth_creating') : t('auth_create_account')}
          </button>
        </form>

        <p className="text-sm text-gray-600 text-center mt-6">
          {t('auth_have_account')}{' '}
          <Link to={`/login${redirect ? `?redirect=${encodeURIComponent(redirect)}` : ''}`}
            className="font-semibold text-action hover:underline">{t('login')}</Link>
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
