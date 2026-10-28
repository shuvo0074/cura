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

import { Printout, SECTIONS } from './output-shared';

export function PrintoutsPanel({ practiceId }: { practiceId: string }) {
  const [documentType, setDocumentType] = useState<'EMR' | 'BILLING'>('EMR');
  const { data, error, loading, reload } = useResource<Printout>('/settings/printouts', { practiceId, documentType });
  const save = useMutation();
  const [draft, setDraft] = useState<Partial<Printout>>({});

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
    const order = [...(value.sectionOrder.length > 0 ? value.sectionOrder : SECTIONS.map((x) => x.key))];
    const target = index + direction;
    if (target < 0 || target >= order.length) return;
    [order[index], order[target]] = [order[target]!, order[index]!];
    set('sectionOrder', order);
  };

  const order = value.sectionOrder.length > 0 ? value.sectionOrder : SECTIONS.map((x) => x.key);

  return (
    <Panel title="Printouts" description="Page setup and layout for generated PDFs.">
      <div className={s.filters} role="tablist" aria-label="Document type">
        {(['EMR', 'BILLING'] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={documentType === t}
            data-active={documentType === t || undefined}
            onClick={() => {
              setDocumentType(t);
              setDraft({});
            }}
          >
            {t === 'EMR' ? 'Prescriptions' : 'Invoices'}
          </button>
        ))}
      </div>

      <h3 className={s.subtitle}>Page setup</h3>
      <Row>
        <Field label="Printer type" hint="Dot matrix drops graphics and maximises contrast.">
          <select className={s.input} value={value.printerType} onChange={(e) => set('printerType', e.target.value)}>
            <option value="COLOUR">Colour (inkjet / laser)</option>
            <option value="MONOCHROME">Black &amp; white</option>
            <option value="DOT_MATRIX">Dot matrix</option>
          </select>
        </Field>
        <Field label="Paper size">
          <select className={s.input} value={value.paperSize} onChange={(e) => set('paperSize', e.target.value)}>
            <option value="A4">A4</option>
            <option value="A5">A5</option>
            <option value="LETTER">Letter</option>
          </select>
        </Field>
        <Field label="Orientation">
          <select className={s.input} value={value.orientation} onChange={(e) => set('orientation', e.target.value)}>
            <option value="PORTRAIT">Portrait</option>
            <option value="LANDSCAPE">Landscape</option>
          </select>
        </Field>
      </Row>

      <h3 className={s.subtitle}>Margins (mm)</h3>
      <Row>
        {(
          [
            ['marginTopMm', 'Top'],
            ['marginBottomMm', 'Bottom'],
            ['marginLeftMm', 'Left'],
            ['marginRightMm', 'Right'],
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
        <Field label={`Font scale — ${value.fontScale}%`}>
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

      <h3 className={s.subtitle}>Header &amp; footer</h3>
      <Check
        label="Print the system header"
        description="Turn this off when printing onto pre-printed pads that already carry the clinic identity."
        checked={value.showHeader}
        onChange={(v) => set('showHeader', v)}
      />
      <Check label="Print the system footer" checked={value.showFooter} onChange={(v) => set('showFooter', v)} />
      <Row cols={2}>
        <Field label="Header text">
          <textarea
            className={s.textarea}
            rows={3}
            value={value.headerHtml ?? ''}
            onChange={(e) => set('headerHtml', e.target.value || null)}
          />
        </Field>
        <Field label="Footer text">
          <textarea
            className={s.textarea}
            rows={3}
            value={value.footerHtml ?? ''}
            onChange={(e) => set('footerHtml', e.target.value || null)}
          />
        </Field>
      </Row>
      <Field
        label="Scanned pad image key"
        hint="Uploaded pad used as a background. Pair it with the header and footer switched off."
      >
        <input
          className={s.input}
          value={value.padImageKey ?? ''}
          onChange={(e) => set('padImageKey', e.target.value || null)}
        />
      </Field>

      <h3 className={s.subtitle}>Section order</h3>
      <p className={s.hint}>Sections print top to bottom in this order.</p>
      <ol className={s.orderList}>
        {order.map((key, index) => (
          <li key={key}>
            <span>{SECTIONS.find((x) => x.key === key)?.label ?? key}</span>
            <button
              type="button"
              className={s.iconButton}
              onClick={() => move(index, -1)}
              disabled={index === 0}
              aria-label={`Move ${key} up`}
            >
              ↑
            </button>
            <button
              type="button"
              className={s.iconButton}
              onClick={() => move(index, 1)}
              disabled={index === order.length - 1}
              aria-label={`Move ${key} down`}
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
