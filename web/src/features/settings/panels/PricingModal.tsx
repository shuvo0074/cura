import { useState } from 'react';
import {
  Field,
  Modal,
  uiStyles as s,
  useMutation,
} from '../../../ui';

import { PricingItem } from './catalog-shared';
import { ModalActions } from '../../../ui';

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
        priceMinor: Math.round(Number(price || 0) * 100),
        notes: notes.trim() || null,
      },
    });
    if (ok) onSaved();
  };

  return (
    <Modal
      title={existing ? 'Edit treatment' : 'Add treatment'}
      onClose={onClose}
      footer={<ModalActions error={save.error} busy={save.busy} onCancel={onClose} onSave={() => void submit()} />}
    >
      <Field label="Treatment name" required>
        <input className={s.input} value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="Price (BDT)" required>
        <input className={s.input} inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
      </Field>
      <Field label="Notes" hint="Internal instructions, or a description printed on the invoice.">
        <textarea className={s.textarea} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
    </Modal>
  );
}
