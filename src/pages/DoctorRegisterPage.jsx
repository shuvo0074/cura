import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import {
  Mail, Lock, User, Phone, ShieldCheck, BadgeCheck, Search, IdCard, Briefcase, Building2,
  Check, CheckCircle2, ArrowLeft, ArrowRight, Clock,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth, homePathFor } from '../context/AuthContext';
import AuthField, { PasswordField } from '../components/auth/AuthField';
import TagInput from '../components/ui/TagInput';
import specialties from '../data/specialties.json';
import { isValidEmail, normalizeBdPhone, normalizeBmdc, passwordProblemKey } from '../utils/authValidation';

const EMPTY = {
  name: '', email: '', phone: '', password: '', confirmPassword: '',
  bmdcNo: '', specialty: '', designation: '', workplace: '', gender: '', degrees: [],
};
const STEP_FIELDS = [['name', 'email', 'phone', 'password', 'confirmPassword'], ['bmdcNo', 'specialty']];
const STEP_LABELS = ['dreg_step_account', 'dreg_step_practice', 'dreg_step_review'];
// Server errors that belong to a field, and the step that field is on.
const FIELD_ERRORS = { EMAIL_TAKEN: ['email', 0], PHONE_TAKEN: ['phone', 0], BMDC_CLAIMED: ['bmdcNo', 1] };

function displayName(name) {
  const n = name.trim();
  return /^dr\.?\s/i.test(n) ? n : `Dr. ${n}`;
}

function initials(name) {
  return name.replace(/^dr\.?\s*/i, '').trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase()).join('');
}

// How their listing will read, updating as they type: a preview of the
// profile they're building, with the verification state it will start in.
function ProfilePreview({ form }) {
  const { t } = useTranslation();
  const bmdc = normalizeBmdc(form.bmdcNo);
  const role = [form.designation.trim(), form.workplace.trim()].filter(Boolean).join(', ');
  return (
    <div className="bg-white text-gray-900 rounded-2xl p-5 shadow-xl shadow-black/20">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-3">{t('dreg_preview')}</p>
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-action text-white flex items-center justify-center text-xl font-bold ring-4 ring-primary/10 flex-shrink-0">
          {initials(form.name) || <User size={26} />}
        </div>
        <div className="min-w-0">
          <p className="font-bold text-lg leading-tight truncate">
            {form.name.trim() ? displayName(form.name) : <span className="text-gray-300">{t('dreg_preview_name')}</span>}
          </p>
          {form.degrees.length > 0 && (
            <p className="text-xs text-gray-500 truncate">{form.degrees.join(', ')}</p>
          )}
          <p className="text-primary text-sm font-medium truncate">
            {form.specialty || <span className="text-gray-300">{t('dreg_preview_specialty')}</span>}
          </p>
          {role && <p className="text-xs text-gray-500 truncate mt-0.5">{role}</p>}
        </div>
      </div>
      <div className="flex flex-wrap gap-2 mt-4">
        {bmdc && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-600 bg-gray-100 rounded-full px-2.5 py-1">
            <IdCard size={12} /> {t('bmdc_reg_no', { no: bmdc })}
          </span>
        )}
        <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-800 bg-amber-50 rounded-full px-2.5 py-1">
          <Clock size={12} /> {t('dreg_pending_chip')}
        </span>
      </div>
    </div>
  );
}

function Stepper({ step }) {
  const { t } = useTranslation();
  return (
    <ol className="flex items-center gap-2 mb-7">
      {STEP_LABELS.map((key, i) => {
        const done = i < step;
        const current = i === step;
        return (
          <li key={key} className="flex items-center gap-2 flex-1 last:flex-none" aria-current={current ? 'step' : undefined}>
            <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-colors
              ${done ? 'bg-primary text-white' : current ? 'bg-primary/10 text-primary ring-2 ring-primary' : 'bg-gray-100 text-gray-400'}`}>
              {done ? <Check size={14} strokeWidth={3} /> : i + 1}
            </span>
            <span className={`text-xs font-medium hidden sm:block whitespace-nowrap ${current ? 'text-gray-900' : 'text-gray-400'}`}>{t(key)}</span>
            {i < STEP_LABELS.length - 1 && <span className={`h-px flex-1 ${done ? 'bg-primary' : 'bg-gray-200'}`} />}
          </li>
        );
      })}
    </ol>
  );
}

function ReviewRow({ label, value, onEdit }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-start justify-between gap-3 py-2.5">
      <div className="min-w-0">
        <dt className="text-xs text-gray-500">{label}</dt>
        <dd className="text-sm font-medium text-gray-900 break-words">{value || '—'}</dd>
      </div>
      {onEdit && (
        <button type="button" onClick={onEdit} className="text-xs font-semibold text-action hover:underline flex-shrink-0 mt-3">
          {t('dreg_edit')}
        </button>
      )}
    </div>
  );
}

function Done({ verification }) {
  const { t } = useTranslation();
  return (
    <div className="text-center py-6">
      <span className="mx-auto w-16 h-16 rounded-full bg-green-50 text-green-600 flex items-center justify-center mb-5">
        <CheckCircle2 size={34} />
      </span>
      <h2 className="text-xl font-bold text-gray-900">{t('dreg_done_title')}</h2>
      <p className="text-sm text-gray-600 mt-2 max-w-sm mx-auto">{t('dreg_done_body')}</p>
      {verification?.kind === 'claim' && (
        <p className="text-sm text-primary bg-primary/5 rounded-xl px-4 py-3 mt-5 text-left">
          {t('dreg_done_claim', { no: verification.bmdc_no, name: verification.listing_name })}
        </p>
      )}
      <Link to="/doctor-dashboard"
        className="inline-flex items-center gap-2 mt-7 bg-primary text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-primary/90">
        {t('dreg_go_dashboard')} <ArrowRight size={16} />
      </Link>
    </div>
  );
}

export default function DoctorRegisterPage() {
  const { t } = useTranslation();
  const { user, loading, registerDoctor } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY);
  const [step, setStep] = useState(0);
  const [touched, setTouched] = useState({});
  const [serverError, setServerError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  if (!loading && user && !result) return <Navigate to={homePathFor(user)} replace />;

  const passwordKey = passwordProblemKey(form.password);
  const errors = {
    name: form.name.replace(/^dr\.?\s*/i, '').trim().length < 2 && t('auth_err_name'),
    email: !isValidEmail(form.email) && t('auth_err_email'),
    phone: !normalizeBdPhone(form.phone) && t('auth_err_phone'),
    password: passwordKey && t(passwordKey),
    confirmPassword: form.confirmPassword !== form.password && t('auth_err_password_match'),
    bmdcNo: !normalizeBmdc(form.bmdcNo) && t('auth_err_bmdc'),
    specialty: !form.specialty && t('auth_err_specialty'),
  };
  const fieldError = FIELD_ERRORS[serverError?.code];
  if (fieldError) errors[fieldError[0]] = serverError.message;
  const shown = field => touched[field] && errors[field];

  const set = field => e => {
    setForm(f => ({ ...f, [field]: e.target.value }));
    if (serverError) setServerError(null);
  };
  const touch = field => () => setTouched(s => ({ ...s, [field]: true }));

  function next(e) {
    e.preventDefault();
    const fields = STEP_FIELDS[step];
    setTouched(s => ({ ...s, ...Object.fromEntries(fields.map(f => [f, true])) }));
    if (fields.some(f => errors[f])) return;
    if (step === 1) setForm(f => ({ ...f, bmdcNo: normalizeBmdc(f.bmdcNo) }));
    setStep(step + 1);
  }

  async function submit() {
    setBusy(true);
    try {
      const { confirmPassword: _confirm, ...fields } = form;
      const res = await registerDoctor({
        ...fields,
        name: form.name.replace(/^dr\.?\s*/i, '').trim(),
        phone: normalizeBdPhone(form.phone),
        bmdcNo: normalizeBmdc(form.bmdcNo),
        gender: form.gender || undefined,
      });
      setResult(res);
      // The thank-you card is shorter than the form; bring it into view.
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setServerError({ code: err.code, message: err.message });
      const target = FIELD_ERRORS[err.code];
      if (target) {
        setTouched(s => ({ ...s, [target[0]]: true }));
        setStep(target[1]);
      }
    } finally {
      setBusy(false);
    }
  }

  const bmdcOk = normalizeBmdc(form.bmdcNo);

  return (
    <div className="py-4 sm:py-10">
      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] gap-5 lg:gap-10 items-start">
        {/* ── Why join ── */}
        <aside className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-[#002a66] to-[#001a40] text-white p-6 sm:p-8 lg:p-10 lg:sticky lg:top-24">
          <div aria-hidden className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-action/30 blur-3xl" />
          <div className="relative">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-accent text-primary rounded-full px-3 py-1">
              <BadgeCheck size={14} /> {t('dreg_badge')}
            </span>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold leading-tight mt-4">{t('dreg_title')}</h1>
            <p className="text-white/75 text-sm sm:text-base mt-3 max-w-md">{t('dreg_sub')}</p>

            <ul className="hidden lg:flex flex-col gap-5 mt-8">
              {[
                [ShieldCheck, 'dreg_point_verified_t', 'dreg_point_verified_d'],
                [IdCard, 'dreg_point_profile_t', 'dreg_point_profile_d'],
                [Search, 'dreg_point_patients_t', 'dreg_point_patients_d'],
              ].map(([Icon, title, desc]) => (
                <li key={title} className="flex gap-3.5">
                  <span className="w-10 h-10 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center flex-shrink-0">
                    <Icon size={19} className="text-accent" />
                  </span>
                  <div>
                    <p className="font-semibold text-sm">{t(title)}</p>
                    <p className="text-white/65 text-sm mt-0.5">{t(desc)}</p>
                  </div>
                </li>
              ))}
            </ul>

            <div className="hidden lg:block mt-10">
              <ProfilePreview form={form} />
            </div>
          </div>
        </aside>

        {/* ── Form ── */}
        <section className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 sm:p-8">
          {result ? <Done verification={result.verification} /> : (
            <>
              <Stepper step={step} />
              <p className="text-xs font-medium text-gray-400">{t('dreg_step_of', { n: step + 1 })}</p>
              <h2 className="text-xl font-bold text-gray-900 mt-0.5 mb-6">{t(STEP_LABELS[step])}</h2>

              {step === 0 && (
                <form onSubmit={next} className="flex flex-col gap-4" noValidate>
                  <AuthField label={t('auth_full_name')} icon={User} autoComplete="name" placeholder="Nusrat Jahan"
                    value={form.name} onChange={set('name')} onBlur={touch('name')} error={shown('name')} />
                  <AuthField label={t('auth_email')} icon={Mail} type="email" autoComplete="email"
                    value={form.email} onChange={set('email')} onBlur={touch('email')} error={shown('email')} />
                  <AuthField label={t('auth_mobile')} icon={Phone} type="tel" autoComplete="tel" inputMode="tel" placeholder="01XXXXXXXXX"
                    value={form.phone} onChange={set('phone')} onBlur={touch('phone')} error={shown('phone')} hint={t('dreg_mobile_hint')} />
                  <PasswordField label={t('auth_password')} icon={Lock} autoComplete="new-password"
                    value={form.password} onChange={set('password')} onBlur={touch('password')}
                    error={shown('password')} hint={t('auth_password_hint')} />
                  <PasswordField label={t('auth_confirm_password')} icon={Lock} autoComplete="new-password"
                    value={form.confirmPassword} onChange={set('confirmPassword')} onBlur={touch('confirmPassword')}
                    error={shown('confirmPassword')} />
                  <button type="submit" className="mt-2 w-full flex items-center justify-center gap-2 bg-primary text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-primary/90">
                    {t('dreg_continue')} <ArrowRight size={16} />
                  </button>
                </form>
              )}

              {step === 1 && (
                <form onSubmit={next} className="flex flex-col gap-4" noValidate>
                  <AuthField label={t('dreg_bmdc')} icon={IdCard} placeholder="A-12345" autoComplete="off" spellCheck={false}
                    value={form.bmdcNo} onChange={set('bmdcNo')} onBlur={touch('bmdcNo')}
                    error={shown('bmdcNo')} hint={t('dreg_bmdc_hint')}
                    trailing={bmdcOk && !shown('bmdcNo') && (
                      <span className="flex items-center gap-1 text-xs font-medium text-green-700" title={t('dreg_bmdc_ok')}>
                        <CheckCircle2 size={15} /> <span className="hidden sm:inline">{bmdcOk}</span>
                      </span>
                    )} />
                  <div>
                    <label htmlFor="dreg-specialty" className="block text-sm font-medium text-gray-700 mb-1.5">{t('dreg_specialty')}</label>
                    <select id="dreg-specialty" value={form.specialty} onChange={set('specialty')} onBlur={touch('specialty')}
                      aria-invalid={Boolean(shown('specialty'))}
                      className={`w-full border rounded-xl px-3 py-2.5 text-sm bg-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/15
                        ${shown('specialty') ? 'border-red-300' : 'border-gray-200'} ${form.specialty ? 'text-gray-900' : 'text-gray-400'}`}>
                      <option value="">{t('dreg_choose_specialty')}</option>
                      {specialties.map(s => <option key={s.id} value={s.name} className="text-gray-900">{s.name}</option>)}
                    </select>
                    {shown('specialty') && <p className="text-xs mt-1.5 text-red-600">{errors.specialty}</p>}
                  </div>
                  <TagInput label={t('dreg_degrees')} hint={t('dreg_degrees_hint')} placeholder="MBBS, FCPS (Medicine)"
                    max={10} maxLen={60} tags={form.degrees} onChange={v => setForm(f => ({ ...f, degrees: v }))} />
                  <div className="grid sm:grid-cols-2 gap-4">
                    <AuthField label={t('dreg_designation')} optional icon={Briefcase} placeholder={t('dreg_designation_ph')}
                      value={form.designation} onChange={set('designation')} maxLength={120} />
                    <AuthField label={t('dreg_workplace')} optional icon={Building2} placeholder={t('dreg_workplace_ph')}
                      value={form.workplace} onChange={set('workplace')} maxLength={160} />
                  </div>
                  <fieldset>
                    <legend className="block text-sm font-medium text-gray-700 mb-1.5">
                      {t('dreg_gender')} <span className="font-normal text-gray-400">({t('auth_optional')})</span>
                    </legend>
                    <div className="flex gap-2">
                      {['male', 'female'].map(g => (
                        <button key={g} type="button" aria-pressed={form.gender === g}
                          onClick={() => setForm(f => ({ ...f, gender: f.gender === g ? '' : g }))}
                          className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors
                            ${form.gender === g ? 'bg-primary/10 border-primary text-primary' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                          {t(`doctor_gender_${g}`)}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                  <div className="flex gap-3 mt-2">
                    <button type="button" onClick={() => setStep(0)}
                      className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-600 border border-gray-200 hover:bg-gray-50">
                      <ArrowLeft size={16} /> {t('dreg_back')}
                    </button>
                    <button type="submit" className="flex-1 flex items-center justify-center gap-2 bg-primary text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-primary/90">
                      {t('dreg_continue')} <ArrowRight size={16} />
                    </button>
                  </div>
                </form>
              )}

              {step === 2 && (
                <div>
                  <div className="lg:hidden mb-5"><ProfilePreview form={form} /></div>
                  <dl className="divide-y divide-gray-100 border-y border-gray-100">
                    <ReviewRow label={t('auth_full_name')} value={displayName(form.name)} onEdit={() => setStep(0)} />
                    <ReviewRow label={t('auth_email')} value={form.email.trim()} onEdit={() => setStep(0)} />
                    <ReviewRow label={t('auth_mobile')} value={normalizeBdPhone(form.phone)} onEdit={() => setStep(0)} />
                    <ReviewRow label={t('dreg_bmdc')} value={normalizeBmdc(form.bmdcNo)} onEdit={() => setStep(1)} />
                    <ReviewRow label={t('dreg_specialty')} value={form.specialty} onEdit={() => setStep(1)} />
                    {form.degrees.length > 0 && <ReviewRow label={t('dreg_degrees')} value={form.degrees.join(', ')} onEdit={() => setStep(1)} />}
                    {(form.designation || form.workplace) && (
                      <ReviewRow label={`${t('dreg_designation')} · ${t('dreg_workplace')}`}
                        value={[form.designation, form.workplace].filter(Boolean).join(', ')} onEdit={() => setStep(1)} />
                    )}
                  </dl>
                  <p className="flex gap-2 text-xs text-gray-600 bg-secondary rounded-xl px-4 py-3 mt-5">
                    <ShieldCheck size={16} className="text-primary flex-shrink-0" /> {t('dreg_review_note')}
                  </p>
                  {serverError && !fieldError && (
                    <p role="alert" className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mt-4">{serverError.message}</p>
                  )}
                  <div className="flex gap-3 mt-6">
                    <button type="button" onClick={() => setStep(1)} disabled={busy}
                      className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-600 border border-gray-200 hover:bg-gray-50">
                      <ArrowLeft size={16} /> {t('dreg_back')}
                    </button>
                    <button type="button" onClick={submit} disabled={busy}
                      className="flex-1 flex items-center justify-center gap-2 bg-primary text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-50">
                      <BadgeCheck size={16} /> {busy ? t('dreg_submitting') : t('dreg_submit')}
                    </button>
                  </div>
                </div>
              )}

              <p className="text-sm text-gray-600 text-center mt-7">
                {t('dreg_have_account')}{' '}
                <button type="button" onClick={() => navigate('/login')} className="font-semibold text-action hover:underline">{t('login')}</button>
              </p>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
