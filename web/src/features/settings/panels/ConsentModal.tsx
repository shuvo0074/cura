import { useState } from 'react';
import {
  Field,
  Modal,
  uiStyles as s,
  useMutation,
} from '../../../ui';

import { ConsentForm } from './catalog-shared';
import { ModalActions } from '../../../ui';
import { useT } from '../../../i18n';

export function ConsentModal({
  practiceId,
  existing,
  onClose,
  onSaved,
}: {
  practiceId: string;
  existing: ConsentForm | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useT();
  const save = useMutation();
  const [title, setTitle] = useState(existing?.title ?? '');
  const [body, setBody] = useState(existing?.bodyHtml ?? '');

  const submit = async () => {
    const ok = await save.run('/settings/consent-forms', {
      method: 'PUT',
      body: {
        practiceId,
        ...(existing ? { id: existing.id } : {}),
        title: title.trim(),
        bodyHtml: body,
        isActive: existing?.isActive ?? true,
      },
    });
    if (ok) onSaved();
  };

  return (
    <Modal
      title={existing ? t('settings.consent.edit') : t('settings.consent.add')}
      onClose={onClose}
      wide
      footer={<ModalActions error={save.error} busy={save.busy} onCancel={onClose} onSave={() => void submit()} />}
    >
      <Field label={t('settings.titleField')} required>
        <input className={s.input} value={title} onChange={(e) => setTitle(e.target.value)} />
      </Field>
      <Field
        label={t('settings.consent.body')}
        required
        hint={t('settings.consent.bodyHint')}
      >
        <textarea className={s.textarea} rows={12} value={body} onChange={(e) => setBody(e.target.value)} />
      </Field>
    </Modal>
  );
}
