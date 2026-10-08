import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Clock, House, MapPin, Phone, ReceiptText } from 'lucide-react';
import CentreBanner from './CentreBanner';
import { is24x7 } from './hospitalCatalogue';

export default function CentreCard({ centre }) {
  const { t, i18n } = useTranslation();
  const homeSample = (centre.services || []).some(s => s.key === 'home_sample');
  const published = (centre.tests || []).filter(x => x.price != null && x.source_url).slice(0, 3);
  return (
    <li className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
      <Link to={`/diagnostic-centres/${centre.id}`} tabIndex={-1} aria-hidden="true">
        <CentreBanner centre={centre} className="w-full h-32" />
      </Link>
      <div className="p-5 flex flex-col gap-3 flex-1">
        <div className="flex items-start gap-3">
          <div className="min-w-0">
            <Link to={`/diagnostic-centres/${centre.id}`} className="font-semibold text-gray-900 leading-snug hover:text-primary">{centre.name}</Link>
            <p className="flex items-start gap-1.5 text-sm text-gray-500 mt-1">
              <MapPin size={14} className="text-primary flex-shrink-0 mt-0.5" /> {centre.address}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {centre.opening_hours && (
            <span className={`inline-flex items-center gap-1 text-xs font-medium rounded-full px-2.5 py-1 ${is24x7(centre.opening_hours) ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
              <Clock size={12} /> {is24x7(centre.opening_hours) ? t('open_24_hours') : centre.opening_hours}
            </span>
          )}
          {homeSample && (
            <span className="inline-flex items-center gap-1 text-xs font-medium rounded-full px-2.5 py-1 bg-primary/5 text-primary">
              <House size={12} /> {t('home_sample_short')}
            </span>
          )}
        </div>
        {published.length > 0 && <div className="rounded-xl bg-primary/5 px-3 py-2 text-xs text-primary">
          <p className="font-semibold mb-1">{t('centre_published_prices')}</p>
          {published.map(test => <p key={test.name}>{t('centre_price_preview', { test: test.name, price: test.price.toLocaleString(i18n.language === 'bn' ? 'bn-BD' : 'en') })}</p>)}
        </div>}
        <div className="flex gap-2 mt-auto">
          {centre.hotline && (
            <a href={`tel:${centre.hotline}`}
              className="flex-1 flex items-center justify-center gap-1.5 h-10 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90">
              <Phone size={15} /> {t('call')} {centre.hotline}
            </a>
          )}
          <Link to={`/diagnostic-centres/${centre.id}`}
            className="flex-1 flex items-center justify-center gap-1.5 h-10 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:border-primary hover:text-primary">
            <ReceiptText size={15} /> {t('jump_tests')}
          </Link>
        </div>
      </div>
    </li>
  );
}
