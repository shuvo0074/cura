import { useTranslation } from 'react-i18next';
import { Ambulance, ArrowUpRight, Clock, MapPin, Phone } from 'lucide-react';

export default function AmbulanceVendorCard({ vendor, areaName, lang }) {
  const { t } = useTranslation();
  const name = lang === 'bn' ? vendor.name_bn : vendor.name;
  return (
    <li className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5 flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <span className="rounded-xl bg-primary/5 p-2.5 text-primary"><Ambulance size={24} /></span>
        <div className="min-w-0 flex-1">
          <h2 className="font-bold text-gray-900">{name}</h2>
          <p className="text-sm text-gray-500 mt-1 flex items-start gap-1"><MapPin size={14} className="shrink-0 mt-1" />{lang === 'bn' ? vendor.address_bn : vendor.address}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {vendor.categories.map(category => <span key={category} className="text-xs rounded-full px-2.5 py-1 bg-primary/5 text-primary font-medium">{t(`ambulance_category_${category}`)}</span>)}
      </div>
      <div className="text-sm text-gray-600 space-y-1">
        <p>{vendor.dhaka_wide ? t('ambulance_dhaka_wide') : t('ambulance_local_coverage', { area: areaName(vendor.base_area) })}</p>
        {vendor.areaDistance != null && <p className="text-primary font-medium">{t('ambulance_area_distance', { km: vendor.areaDistance.toLocaleString(lang === 'bn' ? 'bn-BD' : 'en', { maximumFractionDigits: 1 }) })}</p>}
        {vendor.features.includes('24_hours') && <p className="flex items-center gap-1.5"><Clock size={14} />{t('ambulance_feature_24_hours')}</p>}
        {vendor.features.filter(f => f !== '24_hours').map(feature => <p key={feature}>{t(`ambulance_feature_${feature}`)}</p>)}
      </div>
      <div className="mt-auto space-y-2">
        {vendor.phones.map((phone, i) => (
          <a key={phone} href={`tel:+88${phone}`} aria-label={t('ambulance_call_vendor', { name, phone })}
            className={`min-h-11 px-3 py-2 flex items-center justify-center gap-2 rounded-xl font-semibold text-sm ${i === 0 ? 'bg-primary text-white hover:bg-primary/90' : 'border border-gray-200 text-primary hover:bg-primary/5'}`}>
            <Phone size={16} /> {i === 0 ? t('ambulance_call_book') : t('ambulance_alternate')} · <span dir="ltr">{phone}</span>
          </a>
        ))}
      </div>
      <a href={vendor.source_url} target="_blank" rel="noopener noreferrer" className="text-xs text-gray-500 hover:text-primary flex items-center gap-1">
        {t('ambulance_source', { date: new Date(`${vendor.source_checked_on}T00:00:00`).toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-GB') })}<ArrowUpRight size={13} />
      </a>
    </li>
  );
}
