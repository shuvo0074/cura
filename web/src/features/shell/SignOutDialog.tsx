import { Modal, uiStyles as s } from '../../ui';

/** Confirmation before ending the session. */
export function SignOutDialog({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
  return (
    <Modal
      title="Log out?"
      onClose={onCancel}
      footer={
        <>
          <button type="button" className={s.secondary} onClick={onCancel}>
            Stay signed in
          </button>
          <button type="button" className={s.primary} onClick={onConfirm}>
            Log out
          </button>
        </>
      }
    >
      <p className={s.muted}>You will need your password (and a code, if two-factor is on) to sign back in.</p>
    </Modal>
  );
}
