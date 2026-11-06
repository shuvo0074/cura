import { useT } from '../i18n';
import styles from './ui.module.css';

export function Failed({ message }: { message: string }) {
  // Messages from Cura API are English; known ones are shown in the current language.
  const { tm } = useT();
  return (
    <p className={styles.error} role="alert">
      {tm(message)}
    </p>
  );
}
