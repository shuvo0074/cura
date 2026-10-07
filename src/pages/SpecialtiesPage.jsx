import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import PageHeader from '../components/ui/PageHeader';
import SearchInput from '../components/ui/SearchInput';
import EmptyState from '../components/ui/EmptyState';
import specialties from '../data/specialties.json';
import SpecialtyCard from '../components/home/SpecialtyCard';

export default function SpecialtiesPage() {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return specialties.filter(s => !q || s.name.toLowerCase().includes(q));
  }, [query]);

  return (
    <div>
      <PageHeader title="Explore All Specialities" count={filtered.length}>
        <SearchInput value={query} onChange={setQuery} placeholder={t('search_specialities')} />
      </PageHeader>

      {filtered.length === 0 ? (
        <EmptyState
          title={t('no_results')}
          message={t('empty_try_again')}
          actions={[
            { label: t('clear_search'), onClick: () => setQuery('') },
            { label: t('find_a_doctor'), to: '/doctors' },
          ]}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(s => <SpecialtyCard key={s.id} specialty={s} />)}
        </div>
      )}
    </div>
  );
}
