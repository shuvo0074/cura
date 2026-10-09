import { PhoneCall, Siren } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSiteContent } from '../../context/SiteContentContext';
import { phoneDigits } from '../../utils/phone';
export default function EmergencySection() {
 const { t, i18n } = useTranslation();
 const { contacts } = useSiteContent();
 const number = n => phoneDigits(n, i18n.language);
 return (<div className="rounded-2xl bg-red-50 border border-red-100 p-4 sm:p-5 flex flex-col">
          <h3 className="font-semibold text-red-800 flex items-center gap-2"><Siren size={20} /> {t('home_emergency_title')}</h3>
          <p className="text-sm text-red-900/80 mt-1.5">{t('home_emergency_desc')}</p>
          <div className="mt-auto pt-4 flex flex-col gap-2">
            <a href={`tel:${contacts.emergency}`} className="flex items-center justify-center gap-2 h-12 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold">
              <PhoneCall size={18} /> {t('home_call_999', { number: number(contacts.emergency) })}
            </a>
            <a href={`tel:${contacts.health_line}`} className="flex items-center justify-center gap-2 h-11 rounded-xl border border-red-200 bg-white text-red-800 text-sm font-medium">
              <PhoneCall size={16} /> {t('home_call_16263', { number: number(contacts.health_line) })}
            </a>
            <p className="text-xs text-red-900/60 text-center">{t('home_emergency_note')}</p>
          </div>
        </div>);
}
