import { useState } from 'react';
import {
  Field,
  Modal,
  Row,
  uiStyles as s,
  useMutation,
} from '../../../ui';

import { ChartingTemplate } from './catalog-shared';
import { ModalActions } from '../../../ui';

export function ChartingModal({
  practiceId,
  existing,
  onClose,
  onSaved,
}: {
  practiceId: string;
  existing: ChartingTemplate | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const save = useMutation();
  const [name, setName] = useState(existing?.name ?? '');
  const [diagnoses, setDiagnoses] = useState((existing?.diagnoses ?? []).join('\n'));
  const [labOrders, setLabOrders] = useState((existing?.labOrders ?? []).join('\n'));
  const [followUp, setFollowUp] = useState(existing?.followUpDays ? String(existing.followUpDays) : '');

  const lines = (text: string) =>
    text
      .split('\n')
      .map((x) => x.trim())
      .filter(Boolean);

  const submit = async () => {
    const ok = await save.run('/settings/charting-templates', {
      method: 'PUT',
      body: {
        practiceId,
        ...(existing ? { id: existing.id } : {}),
        name: name.trim(),
        diagnoses: lines(diagnoses),
        labOrders: lines(labOrders),
        followUpDays: followUp ? Number(followUp) : null,
      },
    });
    if (ok) onSaved();
  };

  return (
    <Modal
      title={existing ? 'Edit template' : 'Add template'}
      onClose={onClose}
      wide
      footer={<ModalActions error={save.error} busy={save.busy} onCancel={onClose} onSave={() => void submit()} />}
    >
      <Field label="Template name" required>
        <input className={s.input} value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Row cols={2}>
        <Field label="Diagnoses" hint="One per line.">
          <textarea className={s.textarea} rows={5} value={diagnoses} onChange={(e) => setDiagnoses(e.target.value)} />
        </Field>
        <Field label="Lab orders" hint="One per line.">
          <textarea className={s.textarea} rows={5} value={labOrders} onChange={(e) => setLabOrders(e.target.value)} />
        </Field>
      </Row>
      <Field label="Follow-up after (days)">
        <input
          className={s.input}
          inputMode="numeric"
          value={followUp}
          onChange={(e) => setFollowUp(e.target.value.replace(/\D/g, ''))}
        />
      </Field>
    </Modal>
  );
}
