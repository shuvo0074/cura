import { useState } from 'react';
import {
  Check,
  Failed,
  Field,
  Loading,
  Panel,
  Row,
  SaveBar,
  uiStyles as s,
  useMutation,
  useResource,
} from '../../../ui';
import { useT } from '../../../i18n';

import { Printout, SECTIONS, isSection } from './output-shared';

export function PrintoutsPanel({ practiceId }: { practiceId: string }) {
  const [documentType, setDocumentType] = useState<'EMR' | 'BILLING'>('EMR');
  const { data, error, loading, reload } = useResource<Printout>('/settings/printouts', { practiceId, documentType });
  const { t, locale } = useT();
  const save = useMutation();
  const [draft, setDraft] = useState<Partial<Printout>>({});

  const sectionLabel = (key: string) => (isSection(key) ? t(`settings.printouts.section.${key}`) : key);
  // English keeps the section code ("Move vitals up") as it always read.
  const moveName = (key: string) => (locale === 'en' ? key : sectionLabel(key));

  if (loading && !data) return <Loading />;
  if (error && !data) return <Failed message={error} />;
  if (!data) return null;

  const value = { ...data, ...draft };
  const dirty = Object.keys(draft).length > 0;
  const set = <K extends keyof Printout>(k: K, v: Printout[K]) => setDraft((d) => ({ ...d, [k]: v }));

  const submit = async () => {
    // The endpoint is a full upsert, so every field is sent — a partial body
    // would silently reset the untouched ones to their schema defaults.
    const ok = await save.run('/settings/printouts', { method: 'PUT', body: { practiceId, ...value } });
    if (ok) {
      setDraft({});
      await reload();
    }
  };

  const move = (index: number, direction: -1 | 1) => {
    const order = [...(value.sectionOrder.length > 0 ? value.sectionOrder : [...SECTIONS])];
    const target = index + direction;
    if (target < 0 || target >= order.length) return;
    [order[index], order[target]] = [order[target]!, order[index]!];
    set('sectionOrder', order);
  };

  const order = value.sectionOrder.length > 0 ? value.sectionOrder : [...SECTIONS];

  return (
    <Panel title={t('settings.nav.printouts')} description={t('settings.printouts.description')}>
      <div className={s.filters} role="tablist" aria-label={t('settings.printouts.documentType')}>
        {(['EMR', 'BILLING'] as const).map((type) => (
          <button
            key={type}
            type="button"
            role="tab"
            aria-selected={documentType === type}
            data-active={documentType === type || undefined}
            onClick={() => {
              setDocumentType(type);
              setDraft({});
            }}
          >
            {type === 'EMR' ? t('settings.printouts.prescriptions') : t('settings.printouts.invoices')}
          </button>
        ))}
      </div>

      <h3 className={s.subtitle}>{t('settings.printouts.pageSetup')}</h3>
      <Row>
        <Field label={t('settings.printouts.printerType')} hint={t('settings.printouts.printerHint')}>
          <select className={s.input} value={value.printerType} onChange={(e) => set('printerType', e.target.value)}>
            <option value="COLOUR">{t('settings.printouts.printer.COLOUR')}</option>
            <option value="MONOCHROME">{t('settings.printouts.printer.MONOCHROME')}</option>
            <option value="DOT_MATRIX">{t('settings.printouts.printer.DOT_MATRIX')}</option>
          </select>
        </Field>
        <Field label={t('settings.printouts.paperSize')}>
          <select className={s.input} value={value.paperSize} onChange={(e) => set('paperSize', e.target.value)}>
            <option value="A4">A4</option>
            <option value="A5">A5</option>
            <option value="LETTER">{t('settings.printouts.letter')}</option>
          </select>
        </Field>
        <Field label={t('settings.printouts.orientation')}>
          <select className={s.input} value={value.orientation} onChange={(e) => set('orientation', e.target.value)}>
            <option value="PORTRAIT">{t('settings.printouts.portrait')}</option>
            <option value="LANDSCAPE">{t('settings.printouts.landscape')}</option>
          </select>
        </Field>
      </Row>

      <h3 className={s.subtitle}>{t('settings.printouts.margins')}</h3>
      <Row>
        {(
          [
            ['marginTopMm', t('settings.printouts.top')],
            ['marginBottomMm', t('settings.printouts.bottom')],
            ['marginLeftMm', t('settings.printouts.left')],
            ['marginRightMm', t('settings.printouts.right')],
          ] as const
        ).map(([key, label]) => (
          <Field key={key} label={label}>
            <input
              className={s.input}
              inputMode="numeric"
              value={value[key]}
              onChange={(e) => set(key, Number(e.target.value.replace(/\D/g, '') || 0))}
            />
          </Field>
        ))}
      </Row>

      <Row cols={1}>
        <Field label={t('settings.printouts.fontScale', { n: value.fontScale })}>
          <input
            type="range"
            min={50}
            max={200}
            step={5}
            value={value.fontScale}
            onChange={(e) => set('fontScale', Number(e.target.value))}
          />
        </Field>
      </Row>

      <h3 className={s.subtitle}>{t('settings.printouts.headerFooter')}</h3>
      <Check
        label={t('settings.printouts.printHeader')}
        description={t('settings.printouts.printHeaderHint')}
        checked={value.showHeader}
        onChange={(v) => set('showHeader', v)}
      />
      <Check label={t('settings.printouts.printFooter')} checked={value.showFooter} onChange={(v) => set('showFooter', v)} />
      <Row cols={2}>
        <Field label={t('settings.printouts.headerText')}>
          <textarea
            className={s.textarea}
            rows={3}
            value={value.headerHtml ?? ''}
            onChange={(e) => set('headerHtml', e.target.value || null)}
          />
        </Field>
        <Field label={t('settings.printouts.footerText')}>
          <textarea
            className={s.textarea}
            rows={3}
            value={value.footerHtml ?? ''}
            onChange={(e) => set('footerHtml', e.target.value || null)}
          />
        </Field>
      </Row>
      <Field
        label={t('settings.printouts.padKey')}
        hint={t('settings.printouts.padHint')}
      >
        <input
          className={s.input}
          value={value.padImageKey ?? ''}
          onChange={(e) => set('padImageKey', e.target.value || null)}
        />
      </Field>

      <h3 className={s.subtitle}>{t('settings.printouts.sectionOrder')}</h3>
      <p className={s.hint}>{t('settings.printouts.sectionHint')}</p>
      <ol className={s.orderList}>
        {order.map((key, index) => (
          <li key={key}>
            <span>{sectionLabel(key)}</span>
            <button
              type="button"
              className={s.iconButton}
              onClick={() => move(index, -1)}
              disabled={index === 0}
              aria-label={t('settings.printouts.moveUp', { name: moveName(key) })}
            >
              ↑
            </button>
            <button
              type="button"
              className={s.iconButton}
              onClick={() => move(index, 1)}
              disabled={index === order.length - 1}
              aria-label={t('settings.printouts.moveDown', { name: moveName(key) })}
            >
              ↓
            </button>
          </li>
        ))}
      </ol>

      <SaveBar onSave={() => void submit()} busy={save.busy} saved={save.saved} error={save.error} dirty={dirty} />
    </Panel>
  );
}
