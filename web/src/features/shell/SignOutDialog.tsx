import { Modal, uiStyles as s } from '../../ui';
import { useT } from '../../i18n';

/** Confirmation before ending the session. */
export function SignOutDialog({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
  const { t } = useT();
  return (
    <Modal
      title={t('shell.signOut.title')}
      onClose={onCancel}
      footer={
        <>
          <button type="button" className={s.secondary} onClick={onCancel}>
            {t('shell.signOut.stay')}
          </button>
          <button type="button" className={s.primary} onClick={onConfirm}>
            {t('shell.signOut.confirm')}
          </button>
        </>
      }
    >
      <p className={s.muted}>{t('shell.signOut.body')}</p>
    </Modal>
  );
}
