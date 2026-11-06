import { useEffect, useState } from 'react';
import { useServices } from '../../app/services';
import { Field, Modal, Row, uiStyles as s } from '../../ui';
import { asciiDigits, money, toMinor } from './billing-kit';
import styles from './billing.module.css';
import { PatientPicker } from '../../ui';
import { useT } from '../../i18n';

interface PricingItem {
  id: string;
  name: string;
  priceMinor: number;
  notes: string | null;
}

interface Line {
  pricingItemId: string | null;
  description: string;
  quantity: number;
  unit: string;
  discount: string;
}

const blankLine = (): Line => ({
  pricingItemId: null,
  description: '',
  quantity: 1,
  unit: '',
  discount: '',
});

/**
 * New invoice.
 *
 * Selecting a catalog service fills the price, but the server re-reads the
 * catalog and overrides whatever the client sent for a referenced item — the
 * totals shown here are a preview, never the authority.
 */
export function NewInvoiceDialog({
  practiceId,
  patient: fixedPatient,
  encounterId,
  onClose,
  onCreated,
}: {
  practiceId: string;
  /** Pre-set when raising the invoice from inside a patient's record. */
  patient?: { id: string; fullName: string } | undefined;
  encounterId?: string | undefined;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { http } = useServices();
  const { t, tm, locale } = useT();

  const [catalog, setCatalog] = useState<PricingItem[]>([]);
  const [patient, setPatient] = useState<{ id: string; fullName: string } | null>(
    fixedPatient ?? null,
  );
  const [lines, setLines] = useState<Line[]>([blankLine()]);
  const [discount, setDiscount] = useState('');
  const [tax, setTax] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void http
      .request<PricingItem[]>('/settings/pricing', { query: { practiceId } })
      .then((r) => r.ok && setCatalog(r.value));
  }, [http, practiceId]);

  const setLine = (i: number, patch: Partial<Line>) =>
    setLines((current) => current.map((l, index) => (index === i ? { ...l, ...patch } : l)));

  const chooseService = (i: number, id: string) => {
    const item = catalog.find((c) => c.id === id);
    setLine(i, {
      pricingItemId: item?.id ?? null,
      description: item?.name ?? '',
      unit: item ? (item.priceMinor / 100).toFixed(2) : '',
    });
  };

  const lineTotal = (line: Line) =>
    Math.max(0, toMinor(line.unit) * line.quantity - toMinor(line.discount));

  const subtotal = lines.reduce((sum, l) => sum + lineTotal(l), 0);
  const total = Math.max(0, subtotal - toMinor(discount) + toMinor(tax));

  const usable = lines.filter((l) => l.description.trim() && toMinor(l.unit) >= 0 && l.unit !== '');

  const submit = async () => {
    if (!patient) {
      setError(t('billing.selectPatient'));
      return;
    }
    if (usable.length === 0) {
      setError(t('billing.addLineError'));
      return;
    }

    setBusy(true);
    setError(null);

    const result = await http.request('/billing/invoices', {
      method: 'POST',
      body: {
        practiceId,
        patientId: patient.id,
        ...(encounterId ? { encounterId } : {}),
        lines: usable.map((l) => ({
          ...(l.pricingItemId ? { pricingItemId: l.pricingItemId } : {}),
          ...(l.pricingItemId ? {} : { description: l.description.trim(), unitMinor: toMinor(l.unit) }),
          quantity: l.quantity,
          discountMinor: toMinor(l.discount),
        })),
        discountMinor: toMinor(discount),
        taxMinor: toMinor(tax),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      },
      retry: false,
    });
    setBusy(false);

    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    onCreated();
  };

  return (
    <Modal
      title={t('billing.newInvoice')}
      onClose={onClose}
      wide
      footer={
        <>
          {error && (
            <span className={s.error} role="alert">
              {tm(error)}
            </span>
          )}
          <button type="button" className={s.secondary} onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="button" className={s.primary} onClick={() => void submit()} disabled={busy}>
            {busy ? t('billing.creating') : t('billing.create', { total: money(total, locale) })}
          </button>
        </>
      }
    >
      <Row cols={2}>
        <Field label={t('billing.patient')} required>
          {fixedPatient ? (
            <p className={styles.muted}>{fixedPatient.fullName}</p>
          ) : (
            <PatientPicker practiceId={practiceId} value={patient} onChange={setPatient} />
          )}
        </Field>
      </Row>

      <table className={styles.lineTable}>
        <thead>
          <tr>
            <th>{t('billing.col.service')}</th>
            <th>{t('billing.col.description')}</th>
            <th className={styles.numeric}>{t('billing.col.qty')}</th>
            <th className={styles.numeric}>{t('billing.col.unit')}</th>
            <th className={styles.numeric}>{t('billing.col.discount')}</th>
            <th className={styles.numeric}>{t('billing.col.total')}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {lines.map((line, i) => (
            <tr key={i}>
              <td>
                <select
                  className={s.input}
                  value={line.pricingItemId ?? ''}
                  onChange={(e) => chooseService(i, e.target.value)}
                  aria-label={t('billing.lineService', { n: i + 1 })}
                >
                  <option value="">{t('billing.custom')}</option>
                  {catalog.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </td>
              <td>
                <input
                  className={s.input}
                  value={line.description}
                  onChange={(e) => setLine(i, { description: e.target.value, pricingItemId: null })}
                  placeholder={t('billing.col.description')}
                  aria-label={t('billing.lineDescription', { n: i + 1 })}
                />
              </td>
              <td className={styles.narrow}>
                <input
                  className={s.input}
                  inputMode="numeric"
                  value={line.quantity}
                  onChange={(e) => setLine(i, { quantity: Math.max(1, Number(asciiDigits(e.target.value).replace(/\D/g, '')) || 1) })}
                  aria-label={t('billing.lineQuantity', { n: i + 1 })}
                />
              </td>
              <td className={styles.narrow}>
                <input
                  className={s.input}
                  inputMode="decimal"
                  value={line.unit}
                  onChange={(e) => setLine(i, { unit: e.target.value })}
                  aria-label={t('billing.lineUnit', { n: i + 1 })}
                />
              </td>
              <td className={styles.narrow}>
                <input
                  className={s.input}
                  inputMode="decimal"
                  value={line.discount}
                  onChange={(e) => setLine(i, { discount: e.target.value })}
                  aria-label={t('billing.lineDiscount', { n: i + 1 })}
                />
              </td>
              <td className={styles.numeric}>{money(lineTotal(line), locale)}</td>
              <td>
                {lines.length > 1 && (
                  <button
                    type="button"
                    className={s.iconButton}
                    aria-label={t('billing.removeLine', { n: i + 1 })}
                    onClick={() => setLines((c) => c.filter((_, index) => index !== i))}
                  >
                    ×
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <button type="button" className={s.linkButton} onClick={() => setLines((c) => [...c, blankLine()])}>
        {t('billing.addLine')}
      </button>

      <Row>
        <Field label={t('billing.invoiceDiscountBdt')}>
          <input className={s.input} inputMode="decimal" value={discount} onChange={(e) => setDiscount(e.target.value)} />
        </Field>
        <Field label={t('billing.taxBdt')}>
          <input className={s.input} inputMode="decimal" value={tax} onChange={(e) => setTax(e.target.value)} />
        </Field>
        <Field label={t('billing.col.total')}>
          <p className={styles.grandTotal}>{money(total, locale)}</p>
        </Field>
      </Row>

      <Field label={t('billing.notes')} hint={t('billing.notesHint')}>
        <textarea className={s.textarea} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
    </Modal>
  );
}
