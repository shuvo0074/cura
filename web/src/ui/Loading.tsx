import { useT } from '../i18n';
import styles from './ui.module.css';

export function Loading() {
  const { t } = useT();
  return <p className={styles.muted}>{t('common.loading')}</p>;
}
