import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, BadgeCheck, Printer } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { buildShareUrl } from '../utils/share';
import QrCode from '../components/ui/QrCode';
import Photo from '../components/ui/Photo';

// Only the card prints: everything else on the page (header, controls) hides.
const PRINT_CSS = `
@media print {
  @page { size: A5 portrait; margin: 10mm; }
  body * { visibility: hidden !important; }
  #qr-card, #qr-card * { visibility: visible !important; }
  #qr-card { position: absolute; inset: 0; margin: 0 auto; box-shadow: none !important; border: none !important; }
}`;

// A card for the chamber wall or reception desk: patients scan it to open the
// doctor's Cura profile (chambers, hours, phone numbers) and share it.
export default function DoctorQrCardPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [doctor, setDoctor] = useState(null);

  useEffect(() => {
    if (user?.doctorId) api.get(`/doctors/${user.doctorId}`).then(setDoctor).catch(() => {});
  }, [user?.doctorId]);

  if (!doctor) return <div className="flex items-center justify-center h-64 text-gray-400">{t('loading')}</div>;
  const url = buildShareUrl(doctor);
  const workplace = doctor.workplace || doctor.hospital_name || doctor.chamber;

  return (
    <div className="max-w-3xl mx-auto">
      <style>{PRINT_CSS}</style>
      <div className="flex items-center justify-between gap-3 mb-5">
        <Link to="/doctor-dashboard" className="text-gray-500 hover:text-gray-900 flex items-center gap-1.5 text-sm">
          <ArrowLeft size={16} /> {t('back')}
        </Link>
        <button type="button" onClick={() => window.print()}
          className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90">
          <Printer size={16} /> {t('qc_print')}
        </button>
      </div>
      <h1 className="text-xl font-semibold text-gray-950">{t('qc_title')}</h1>
      <p className="text-sm text-gray-500 mt-1 mb-6">{t('qc_hint')}</p>

      <article id="qr-card"
        className="bg-white mx-auto w-full max-w-[420px] aspect-[148/210] rounded-2xl border border-gray-200 shadow-sm p-8 flex flex-col text-center">
        <p className="text-[13px] font-semibold tracking-tight text-primary">Cura</p>

        <div className="mt-6 flex flex-col items-center">
          <Photo src={doctor.photo} alt={doctor.name} iconSize={28} className="w-20 h-20 rounded-xl" />
          <h2 className="mt-4 text-[22px] font-semibold tracking-tight text-gray-950 leading-tight">{doctor.name}</h2>
          {doctor.degrees && <p className="mt-1 text-[13px] text-gray-600 leading-snug">{doctor.degrees}</p>}
          <p className="mt-2 text-sm font-medium text-gray-900">{doctor.headline || doctor.specialty}</p>
          {workplace && <p className="text-xs text-gray-500">{workplace}</p>}
          {doctor.bmdc_verified_at && (
            <p className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-green-700">
              <BadgeCheck size={14} /> {t('bmdc_verified', { no: doctor.bmdc_no })}
            </p>
          )}
        </div>

        <div className="mt-auto pt-6 flex flex-col items-center">
          <QrCode value={url} title={t('pv_qr_alt', { name: doctor.name })} className="w-40 h-40 text-gray-950" />
          <p className="mt-3 text-sm font-semibold text-gray-950">{t('qc_scan')}</p>
          <p className="text-xs text-gray-500 mt-0.5">{t('qc_scan_sub')}</p>
          <p className="mt-3 text-[11px] text-gray-400 break-all">{url.replace(/^https?:\/\//, '')}</p>
        </div>
      </article>
    </div>
  );
}
