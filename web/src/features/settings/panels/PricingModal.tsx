import { useState } from 'react';
import {
  Field,
  Modal,
  uiStyles as s,
  useMutation,
} from '../../../ui';

import { PricingItem, asciiDigits } from './catalog-shared';
import { ModalActions } from '../../../ui';
import { useT } from '../../../i18n';

export function PricingModal({
  practiceId,
  existing,
  onClose,
  onSaved,
}: {
  practiceId: string;
  existing: PricingItem | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useT();
  const save = useMutation();
  const [name, setName] = useState(existing?.name ?? '');
  const [price, setPrice] = useState(existing ? (existing.priceMinor / 100).toFixed(2) : '');
  const [notes, setNotes] = useState(existing?.notes ?? '');

  const submit = async () => {
    const ok = await save.run('/settings/pricing', {
      method: 'PUT',
      body: {
        practiceId,
        ...(existing ? { id: existing.id } : {}),
        name: name.trim(),
        // Rounded into minor units so no float ever reaches a currency column.
        priceMinor: Math.round(Number(asciiDigits(price) || 0) * 100),
        notes: notes.trim() || null,
      },
    });
    if (ok) onSaved();
  };

  return (
    <Modal
      title={existing ? t('settings.pricing.edit') : t('settings.pricing.add')}
      onClose={onClose}
      footer={<ModalActions error={save.error} busy={save.busy} onCancel={onClose} onSave={() => void submit()} />}
    >
      <Field label={t('settings.pricing.treatmentName')} required>
        <input className={s.input} value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label={t('settings.pricing.priceBdt')} required>
        <input className={s.input} inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
      </Field>
      <Field label={t('settings.notes')} hint={t('settings.pricing.notesHint')}>
        <textarea className={s.textarea} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
    </Modal>
  );
}
