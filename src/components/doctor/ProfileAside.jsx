import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BadgeCheck, Check, Info, Link2, Share2 } from 'lucide-react';
import { PANEL } from '../../utils/doctorProfile';
import { buildShareUrl, copyShareLink } from '../../utils/share';
import QrCode from '../ui/QrCode';

function fmtDate(ts, lang) {
  return new Date(ts).toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// What Cura has checked about this profile, said plainly. Verified profiles
// list the checks; listings Cura compiled say so, so nobody mistakes them.
export function VerificationCard({ doctor }) {
  const { t, i18n } = useTranslation();
  const verified = Boolean(doctor.bmdc_verified_at);
  const checks = verified
    ? [t('pv_check_registration'), t('pv_check_identity'), doctor.is_managed && t('pv_check_managed')].filter(Boolean)
    : [];

  return (
    <section className={`${PANEL} p-5`}>
      <div className="flex items-start gap-3">
        <span className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${verified ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
          {verified ? <BadgeCheck size={20} /> : <Info size={18} />}
        </span>
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold text-gray-950 leading-snug">
            {verified ? t('pv_verified_title') : t('pv_unverified_title')}
          </h2>
          <p className="text-[13px] text-gray-500 mt-0.5">
            {verified ? t('pv_verified_on', { date: fmtDate(doctor.bmdc_verified_at, i18n.language) }) : t('pv_unverified_sub')}
          </p>
        </div>
      </div>

      {doctor.bmdc_no && (
        <dl className="mt-4 flex items-baseline justify-between gap-3 rounded-lg bg-gray-50 px-3 py-2.5">
          <dt className="text-xs text-gray-500">{t('pv_bmdc_reg')}</dt>
          <dd className="font-mono text-sm font-semibold text-gray-950 tracking-tight">{doctor.bmdc_no}</dd>
        </dl>
      )}

      {verified ? (
        <ul className="mt-4 space-y-2">
          {checks.map(c => (
            <li key={c} className="flex items-start gap-2 text-[13px] text-gray-700">
              <Check size={15} className="text-green-700 mt-0.5 flex-shrink-0" /> {c}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-[13px] text-gray-600 leading-relaxed">{t('pv_unverified_body')}</p>
      )}

      {doctor.profile_updated_at && (
        <p className="mt-4 pt-4 border-t border-gray-100 text-xs text-gray-500">
          {t('pv_updated', { date: fmtDate(doctor.profile_updated_at, i18n.language) })}
        </p>
      )}
    </section>
  );
}

// The profile's own address, as a link and a QR code patients can scan from
// a screen or a printed chamber card.
export function ShareCard({ doctor, onShare }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const url = buildShareUrl(doctor);

  async function copy() {
    if (await copyShareLink(doctor)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }

  return (
    <section className={`${PANEL} p-5`}>
      <h2 className="text-[15px] font-semibold text-gray-950">{t('pv_share_title')}</h2>
      <div className="mt-4 flex items-center gap-4">
        <QrCode value={url} title={t('pv_qr_alt', { name: doctor.name })}
          className="w-24 h-24 flex-shrink-0 text-gray-950 rounded-md ring-1 ring-gray-200" />
        <p className="text-[13px] text-gray-500 leading-relaxed">{t('pv_share_hint')}</p>
      </div>
      <p className="mt-4 text-[13px] font-medium text-gray-800 truncate" title={url}>{url.replace(/^https?:\/\//, '')}</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button type="button" onClick={copy}
          className="inline-flex items-center justify-center gap-1.5 h-9 rounded-lg border border-gray-200 text-[13px] font-medium text-gray-700 hover:bg-gray-50">
          {copied ? <><Check size={14} className="text-green-700" /> {t('pv_copied')}</> : <><Link2 size={14} /> {t('pv_copy_link')}</>}
        </button>
        <button type="button" onClick={onShare}
          className="inline-flex items-center justify-center gap-1.5 h-9 rounded-lg border border-gray-200 text-[13px] font-medium text-gray-700 hover:bg-gray-50">
          <Share2 size={14} /> {t('share')}
        </button>
      </div>
    </section>
  );
}

// Shown on listings no doctor has claimed yet: what the doctor gains.
export function ClaimCard({ doctor }) {
  const { t } = useTranslation();
  const perks = ['pv_claim_perk_record', 'pv_claim_perk_verified', 'pv_claim_perk_insights', 'pv_claim_perk_peers'];
  return (
    <section className="rounded-2xl bg-gray-950 text-white p-5">
      <p className="text-xs font-medium text-white/60">{t('pv_claim_eyebrow')}</p>
      <h2 className="text-[17px] font-semibold leading-snug mt-1">{t('pv_claim_title', { name: doctor.name })}</h2>
      <ul className="mt-4 space-y-2">
        {perks.map(k => (
          <li key={k} className="flex items-start gap-2 text-[13px] text-white/85">
            <Check size={15} className="text-green-400 mt-0.5 flex-shrink-0" /> {t(k)}
          </li>
        ))}
      </ul>
      <Link to="/register/doctor"
        className="mt-5 flex items-center justify-center h-10 rounded-lg bg-white text-gray-950 text-sm font-semibold hover:bg-white/90">
        {t('pv_claim_button')}
      </Link>
      <p className="text-[11px] text-white/50 mt-2.5 text-center">{t('pv_claim_free')}</p>
    </section>
  );
}
