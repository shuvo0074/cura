import { useState } from 'react';
import {
  Field,
  Modal,
  Row,
  uiStyles as s,
  useMutation,
} from '../../../ui';
import { useT } from '../../../i18n';

import { DRUG_FORMS, DRUG_UNITS, Drug } from './catalog-shared';

export function DrugModal({
  practiceId,
  existing,
  onClose,
  onSaved,
  onDone,
}: {
  practiceId: string;
  existing: Drug | null;
  onClose: () => void;
  onSaved: () => void;
  onDone: () => void;
}) {
  const { t, tm } = useT();
  const save = useMutation();
  const blank = { name: '', form: '', strength: '', unit: '', instruction: '' };
  const [form, setForm] = useState(
    existing
      ? {
          name: existing.name,
          form: existing.form ?? '',
          strength: existing.strength ?? '',
          unit: existing.unit ?? '',
          instruction: existing.instruction ?? '',
        }
      : blank,
  );
  const [added, setAdded] = useState(0);

  const set = <K extends keyof typeof form>(k: K, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const persist = async (): Promise<boolean> => {
    const body = {
      practiceId,
      name: form.name.trim(),
      form: form.form || null,
      strength: form.strength.trim() || null,
      unit: form.unit || null,
      instruction: form.instruction.trim() || null,
    };
    const ok = existing
      ? await save.run(`/settings/drugs/${existing.id}`, { method: 'PUT', body })
      : await save.run('/settings/drugs', { method: 'POST', body });
    if (ok) onSaved();
    return ok;
  };

  return (
    <Modal
      title={existing ? t('settings.drugs.edit') : t('settings.drugs.add')}
      onClose={onClose}
      wide
      footer={
        <>
          {save.error && (
            <span className={s.error} role="alert">
              {tm(save.error)}
            </span>
          )}
          {added > 0 && (
            <span className={s.saved} role="status">
              {t('settings.drugs.savedCount', { count: added })}
            </span>
          )}
          <button type="button" className={s.secondary} onClick={onClose}>
            {t('common.cancel')}
          </button>
          {!existing && (
            // Spec: "Add More clears the fields while keeping the modal open,
            // allowing high-speed continuous entry."
            <button
              type="button"
              className={s.secondary}
              disabled={save.busy || form.name.trim() === ''}
              onClick={() => {
                void persist().then((ok) => {
                  if (ok) {
                    setAdded((n) => n + 1);
                    setForm(blank);
                  }
                });
              }}
            >
              {t('settings.drugs.saveAddMore')}
            </button>
          )}
          <button
            type="button"
            className={s.primary}
            disabled={save.busy || form.name.trim() === ''}
            onClick={() => void persist().then((ok) => ok && onDone())}
          >
            {save.busy ? t('common.saving') : t('common.save')}
          </button>
        </>
      }
    >
      <Row cols={2}>
        <Field label={t('settings.name')} required hint={t('settings.drugs.nameHint')}>
          <input className={s.input} autoFocus value={form.name} onChange={(e) => set('name', e.target.value)} />
        </Field>
        <Field label={t('settings.type')} required>
          <select className={s.input} value={form.form} onChange={(e) => set('form', e.target.value)}>
            <option value="">{t('settings.select')}</option>
            {DRUG_FORMS.map((x) => (
              <option key={x} value={x}>
                {t(`settings.drugs.form.${x}`)}
              </option>
            ))}
          </select>
        </Field>
      </Row>
      <Row cols={2}>
        <Field label={t('settings.drugs.strength')}>
          <input
            className={s.input}
            value={form.strength}
            onChange={(e) => set('strength', e.target.value)}
            placeholder="500"
          />
        </Field>
        <Field label={t('settings.drugs.unit')}>
          <select className={s.input} value={form.unit} onChange={(e) => set('unit', e.target.value)}>
            <option value="">—</option>
            {DRUG_UNITS.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
        </Field>
      </Row>
      <Field label={t('settings.drugs.instruction')} hint={t('settings.drugs.instructionHint')}>
        <input className={s.input} value={form.instruction} onChange={(e) => set('instruction', e.target.value)} />
      </Field>
    </Modal>
  );
}
