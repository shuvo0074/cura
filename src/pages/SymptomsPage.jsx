import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import PageHeader from '../components/ui/PageHeader';
import SearchInput from '../components/ui/SearchInput';
import EmptyState from '../components/ui/EmptyState';
import symptoms from '../data/symptoms.json';
import SymptomCard from '../components/home/SymptomCard';

export default function SymptomsPage() {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return symptoms.filter(s => !q || s.name.toLowerCase().includes(q));
  }, [query]);

  return (
    <div>
      <PageHeader title="Browse All Symptoms" count={filtered.length}>
        <SearchInput value={query} onChange={setQuery} placeholder={t('search_symptoms')} />
      </PageHeader>

      {filtered.length === 0 ? (
        <EmptyState
          title={t('no_results')}
          message={t('empty_try_again')}
          actions={[
            { label: t('clear_search'), onClick: () => setQuery('') },
            { label: t('browse_specialities'), to: '/specialties' },
          ]}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(s => <SymptomCard key={s.id} symptom={s} />)}
        </div>
      )}
    </div>
  );
}
