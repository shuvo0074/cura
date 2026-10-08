import { useState } from 'react';
import { Plus, Minus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import HomeSection from './HomeSection';

// Patient questions, from i18n (`faq_items`: [{ q, a }]) so they read in Bangla too.
export default function FaqAccordion() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(-1);
  const items = t('faq_items', { returnObjects: true });

  return (
    <HomeSection title={t('faq_title')}>
      <div className="flex flex-col gap-2.5">
        {items.map((item, i) => (
          <div key={item.q} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <button
              type="button"
              aria-expanded={open === i}
              onClick={() => setOpen(open === i ? -1 : i)}
              className="w-full flex items-center justify-between gap-4 px-4 sm:px-5 py-3.5 text-left">
              <span className="font-semibold text-gray-800 text-sm sm:text-base">{item.q}</span>
              <span className="flex items-center justify-center flex-shrink-0 w-8 h-8 rounded-full border border-primary">
                {open === i ? <Minus size={16} className="text-primary" /> : <Plus size={16} className="text-primary" />}
              </span>
            </button>
            {open === i && <p className="px-4 sm:px-5 pb-4 text-sm text-gray-600 leading-relaxed">{item.a}</p>}
          </div>
        ))}
      </div>
    </HomeSection>
  );
}
