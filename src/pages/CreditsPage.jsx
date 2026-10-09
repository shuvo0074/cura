import { useTranslation } from 'react-i18next';
import PageHeader from '../components/ui/PageHeader';
import { useSiteContent } from '../context/SiteContentContext';

// Attribution for the photos of Bangladesh used on the site (required by
// their CC BY / CC BY-SA licences; given for CC0 photos too).
export default function CreditsPage() {
  const { t } = useTranslation();
  const { credits } = useSiteContent();
  return (
    <div>
      <PageHeader title={t('credits_title')} />
      <p className="text-sm text-gray-600 max-w-2xl -mt-1 mb-6">{t('credits_intro')}</p>
      <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {(credits ?? []).map(c => (
          <li key={c.file} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 flex gap-3">
            <img src={c.file} alt={c.caption} loading="lazy" className="w-24 h-20 rounded-lg object-cover flex-shrink-0" />
            <div className="min-w-0 text-sm">
              <p className="font-semibold text-gray-900">{c.caption}</p>
              {c.author && <p className="text-gray-600">{t('credits_by')} {c.author}</p>}
              <p className="text-gray-600">
                {c.licenseUrl ? <a href={c.licenseUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">{c.license}</a> : c.license}
                {c.source && <>{' · '}<a href={c.source} target="_blank" rel="noreferrer" className="text-primary hover:underline">{t('credits_source')}</a></>}
                {c.changes && <>{' · '}{c.changes}</>}
              </p>
            </div>
          </li>
        ))}
      </ul>
      <h2 className="text-lg font-bold text-gray-900 mt-8 mb-2">{t('credits_map_title')}</h2>
      <p className="text-sm text-gray-600 max-w-2xl">
        {t('credits_map_body')}{' '}
        <a href="https://www.geoboundaries.org/" target="_blank" rel="noreferrer" className="text-primary hover:underline">geoBoundaries</a>
        {' · '}
        <a href="https://creativecommons.org/licenses/by/3.0/igo/" target="_blank" rel="noreferrer" className="text-primary hover:underline">CC BY 3.0 IGO</a>
      </p>
    </div>
  );
}
