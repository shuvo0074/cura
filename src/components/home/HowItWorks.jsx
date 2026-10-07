import { CalendarCheck, Search, Ticket } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import HomeSection from './HomeSection';

const STEPS = [
  { icon: Search, title: 'home_how_1_title', desc: 'home_how_1_desc' },
  { icon: CalendarCheck, title: 'home_how_2_title', desc: 'home_how_2_desc' },
  { icon: Ticket, title: 'home_how_3_title', desc: 'home_how_3_desc' },
];

export default function HowItWorks() {
  const { t } = useTranslation();
  return (
    <HomeSection title={t('home_how_title')}>
      <ol className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
        {STEPS.map(({ icon: Icon, title, desc }, i) => (
          <li key={title} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex md:flex-col gap-3">
            <div className="relative flex-shrink-0 w-11 h-11 rounded-full bg-primary/10 text-primary flex items-center justify-center">
              <Icon size={20} />
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center">{i + 1}</span>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">{t(title)}</h3>
              <p className="text-sm text-gray-600 mt-0.5">{t(desc)}</p>
            </div>
          </li>
        ))}
      </ol>
    </HomeSection>
  );
}
